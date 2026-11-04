import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,addAsset,configure,connect,addCarton,step,command,inspect,assess,saveProject,loadProject,retentionGB,scaleAnalogue} from '../simulator/workshop/model.mjs';

const checks = p => Object.fromEntries(assess(p).map(c=>[c.id,c.pass]));
function runCell(position,port) {
  const p=createProject('reference');
  configure(p,'bracket',{x:position});
  connect(p,'viewer','eth','switch',port);
  command(p,'predict',{seconds:position/0.25});
  command(p,'releaseOrder',{id:'RUN-101'});
  addCarton(p,'INTAKE-47');
  step(p,85);
  return p;
}
test('two valid designs produce measured delay of 2 s within a 100 ms scan',()=>{
  const a=runCell(0.5,'p3'), b=runCell(1,'p4');
  assert.equal(a.runtime.cartons[0].detected,20);
  assert.equal(b.runtime.cartons[0].detected,40);
  assert.equal((b.runtime.cartons[0].detected-a.runtime.cartons[0].detected)*0.1,2);
  for (const p of [a,b]) {
    for (const [id,v] of Object.entries(checks(p))) if (id!=='commissioning') assert.equal(v,true,id);
    assert.equal(p.runtime.postings[0].lot,'INTAKE-47');
  }
});
test('empty workshop accepts independently named equipment and incorrect wiring energises actual terminal',()=>{
  const p=createProject();
  for (const [id,type] of [['B2','conveyor'],['S17','sensor'],['J18','bracket'],['CPU1','plc']]) addAsset(p,type,id);
  connect(p,'B2','track','J18','base');connect(p,'J18','mount','S17','base');connect(p,'S17','out','CPU1','I1');
  addCarton(p);step(p,41);
  assert.deepEqual(p.runtime.inputs,{I0:false,I1:true});assert.equal(p.runtime.count,0);
  assert.equal(checks(p).sensor,false);
  configure(p,'CPU1',{input:'I1'});step(p);assert.equal(p.runtime.count,1);
});
test('five high scans count once, requires low then new high; level counts five times',()=>{
  for (const [mode,expected] of [['rising',1],['level',5]]) {
    const p=createProject('reference');configure(p,'plc',{mode});addCarton(p);
    step(p,44);assert.equal(p.runtime.count,expected);
    assert.deepEqual(p.runtime.scans.slice(-5).map(x=>x.I0),[true,true,true,true,true]);
    step(p,1);assert.equal(inspect(p).input,false);
    addCarton(p);step(p,44);assert.equal(p.runtime.count,expected*2);
  }
});
test('analogue scaling preserves diagnostic overrange and CCTV uses decimal payload units',()=>{
  for(const [signal,result] of [[4,0],[12,50],[20,100]]) assert.deepEqual(scaleAnalogue(signal),{value:result,quality:'good'});
  assert.deepEqual(scaleAnalogue(3.2),{value:(3.2-4)*6.25,quality:'out-of-range'});
  assert.equal(retentionGB(4,4,24),172.8);assert.equal(retentionGB(4,4,24,0.25),43.2);
});
test('network tools distinguish link, isolated VLAN, local flow, clock and permission',()=>{
  const p=createProject('reference');
  configure(p,'switch',{vlan2:20});assert.equal(inspect(p).network.link,true);assert.equal(inspect(p).network.reachable,false);
  configure(p,'switch',{vlan2:10,uplink:false});assert.equal(inspect(p).network.video,true);
  configure(p,'camera',{permitted:false});assert.equal(inspect(p).network.reachable,true);assert.equal(inspect(p).network.video,false);
  configure(p,'camera',{permitted:true,timeSynced:false});assert.match(inspect(p).network.reason,/clock/);
  configure(p,'switch',{poeBudget:4});assert.equal(inspect(p).network.power,false);
});
test('failed pick, checkpoint, commit with lost acknowledgement and retry preserve one movement',()=>{
  const p=createProject('reference');
  configure(p,'robot',{vacuum:false});configure(p,'erp',{dropAck:true});addCarton(p,'INTAKE-25');step(p,80);
  assert.equal(p.runtime.firstOut.scan,80);assert.equal(p.runtime.pallets.length,0);
  assert.throws(()=>command(p,'resetRobot'));
  const q=loadProject(saveProject(p));assert.deepEqual(q.runtime,p.runtime);
  configure(q,'robot',{vacuum:true});command(q,'resetRobot');step(q,1);
  command(q,'releaseOrder',{id:'ORD-2'});
  assert.equal(q.runtime.pallets[0].status,'pending');assert.equal(q.runtime.postings.length,1);
  command(q,'retryERP');command(q,'retryERP');
  const restored=loadProject(saveProject(q));
  configure(restored,'erp',{dropAck:false});command(restored,'retryERP');command(restored,'retryERP');
  assert.equal(restored.runtime.postings.length,1);assert.equal(restored.runtime.postings[0].quantity,1);
  assert.equal(restored.runtime.pallets[0].status,'confirmed');
  assert.equal(restored.runtime.pallets[0].lot,'INTAKE-25');
});
test('render batching and in-flight replay preserve exact state and event identity',()=>{
  const a=createProject('reference'),b=createProject('reference');
  addCarton(a);addCarton(b);step(a,100);
  for(let i=0;i<37;i++) step(b);
  const c=loadProject(saveProject(b));for(let i=37;i<100;i++) step(c);
  assert.deepEqual(c.runtime,a.runtime);
});
test('assessment checks the actual count and video plus independent signed-role records',()=>{
  const p=runCell(1,'p3');
  for(const phase of ['FAT','SAT','Integrated']) command(p,'evidence',{phase,tester:'Installer',witness:'Quality',authority:'Operations'});
  assert.equal(checks(p).commissioning,false);
  assert.equal(p.runtime.evidence.at(-1).checks.find(c=>c.id==='fault-recovery').pass,false);
  configure(p,'plc',{mode:'level'});configure(p,'camera',{permitted:false});
  assert.equal(checks(p).counter,false);assert.equal(checks(p).video,false);
  assert.throws(()=>command(p,'evidence',{phase:'SAT',tester:'A',witness:'a',authority:'B'}));
});
test('schema and typed ports reject malformed projects, unknown actions, unsafe metadata and oversized input',()=>{
  const p=createProject('reference');assert.throws(()=>connect(p,'eye','out','erp','eth'));
  assert.throws(()=>configure(p,'camera',{ip:'999.0.0.1'}));assert.throws(()=>configure(p,'camera',{mask:24.5}));
  for(const bad of ['{','x'.repeat(2097153),'{}']) assert.throws(()=>loadProject(bad));
  const base=JSON.parse(saveProject(p));
  for(const history of [[['constructor']], [['step',36001]], [['configure','camera',{process:'cmd.exe'}]]]) {
    assert.throws(()=>loadProject(JSON.stringify({...base,history})));
  }
  assert.throws(()=>loadProject(JSON.stringify({...base,extensions:JSON.parse('{"__proto__":{"a":1}}')})));
  p.extensions.cad={part:'AS-BRACKET',dimensionMetres:100/1000};
  const copy=loadProject(saveProject(p));assert.equal(copy.extensions.cad.dimensionMetres,0.100);
});
test('one retained PLC request cannot collect an uncounted carton after wiring changes',()=>{
  const p=runCell(1,'p3');
  connect(p,'eye','out','plc','I1');
  addCarton(p,'INTAKE-48');step(p,170);
  assert.equal(p.runtime.count,1);
  assert.equal(p.runtime.cartons[1].status,'missed');
  assert.equal(p.runtime.pallets.length,1);
});
test('simultaneous cartons obscuring one beam yield one edge and one pickup',()=>{
  const p=createProject('reference');
  addCarton(p,'LOT-A');addCarton(p,'LOT-B');step(p,170);
  assert.equal(p.runtime.count,1);assert.equal(p.runtime.pallets.length,1);
  assert.equal(checks(p).pallet,false);assert.equal(checks(p).counter,false);
});
test('actual one-carton coincidence cannot earn the custom counter assessment',()=>{
  const p=createProject('reference');
  command(p,'installProgram',{language:'ST',source:'IF IN THEN COUNT := 1; END_IF;'});
  addCarton(p);step(p,50);
  assert.equal(p.runtime.count,1);assert.equal(checks(p).counter,false);
});
test('program reading I1 exercises the real wire even when the IN alias maps to I0',()=>{
  const p=createProject('reference');connect(p,'eye','out','plc','I1');
  command(p,'installProgram',{language:'ST',source:'IF R_TRIG(I1) THEN COUNT := COUNT + 1; END_IF;'});
  addCarton(p);step(p,60);assert.equal(p.runtime.count,1);assert.equal(checks(p).counter,true);
  command(p,'installProgram',{language:'ST',source:'IF R_TRIG(I0) THEN COUNT := COUNT + 1; END_IF;'});
  assert.equal(checks(p).counter,false);
});
test('integrated commissioning requires recovery on the same identified pallet',()=>{
  const p=createProject('reference');configure(p,'robot',{vacuum:false});configure(p,'erp',{dropAck:true});
  command(p,'releaseOrder',{id:'O-1'});addCarton(p);step(p,81);
  configure(p,'robot',{vacuum:true});command(p,'resetRobot');step(p);configure(p,'erp',{dropAck:false});command(p,'retryERP');
  for (const phase of ['FAT','SAT','Integrated']) command(p,'evidence',{phase,tester:'A',witness:'B',authority:'C'});
  assert.equal(checks(p).commissioning,true);
  assert.equal(loadProject(saveProject(p)).runtime.evidence.at(-1).pass,true);
});
test('retry-heavy imported histories debit replay work before large repeated pending scans',()=>{
  const p=createProject('reference');command(p,'releaseOrder',{id:'O-1'});configure(p,'erp',{dropAck:true});
  for(let i=0;i<30;i++){addCarton(p);step(p,10);}step(p,81);
  const doc=JSON.parse(saveProject(p));for(let i=0;i<3500;i++)doc.history.push(['command','retryERP',{}]);
  assert.throws(()=>loadProject(JSON.stringify(doc)),/replay budget/);
});
