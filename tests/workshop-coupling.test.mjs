import assert from 'node:assert/strict';
import test from 'node:test';
import {prepareCoupling} from '../simulator/workshop/coupling.mjs';
import {createProject,connect,configure,assess,command,step,addCarton,loadProject,saveProject} from '../simulator/workshop/model.mjs';
import {reference as layout} from '../simulator/workshop/site/geometry.mjs';

function commissioned(extra={}) {
  const p=createProject('reference');
  command(p,'bindBenches',{design:prepareCoupling(extra)});
  command(p,'releaseOrder',{id:'ORDER-TEST'});
  addCarton(p,'INTAKE-ALPHA');
  return p;
}
const fault=(p,name,value)=>command(p,'benchFault',{name,value});
test('one timeline preserves a carton through physical detection, robot motion, restored in-flight state and posting',()=>{
  const p=commissioned({layout:layout()});
  step(p,81);
  assert.equal(p.runtime.count,1);
  assert.equal(p.runtime.pallets.length,0);
  assert.equal(p.runtime.coupled.owner,'CT-1');
  const restored=loadProject(saveProject(p));step(p,30);
  for(let k=0;k<30;k++)step(restored);
  assert.deepEqual(restored.runtime,p.runtime);
  assert.equal(p.runtime.pallets.length,1);
  assert.deepEqual(p.runtime.postings.map(x=>[x.lot,x.quantity]),[['INTAKE-ALPHA',1]]);
});
test('power pause physically freezes travel; reporting isolation retains old source time while local detection continues',()=>{
  const p=commissioned();step(p,10);
  const x=p.runtime.cartons[0].x;
  fault(p,'powerStop',true);step(p,20);assert.equal(p.runtime.cartons[0].x,x);
  fault(p,'powerStop',false);
  const link=p.runtime.coupled.rack.links.find(l=>l.a==='GATE'||l.b==='GATE');
  fault(p,'link',link.id);step(p,40);
  assert.equal(p.runtime.count,1);assert.equal(p.runtime.coupled.quality,'Stale');
  assert.equal(p.runtime.coupled.reportedCount,0);assert.equal(p.runtime.coupled.sourceScan,30);
  fault(p,'link',null);step(p,10);assert.equal(p.runtime.coupled.reportedCount,1);
});
test('remote I/O outage blocks control while optical evidence survives; vacuum fails before inventory movement',()=>{
 const p=commissioned();const link=p.runtime.coupled.rack.links.find(l=>l.a==='DI'||l.b==='DI');
 fault(p,'link',link.id);step(p,50);assert.ok(p.runtime.cartons[0].detected);assert.equal(p.runtime.count,0);
 const other=commissioned();fault(other,'vacuumLoss',true);step(other,110);
 assert.ok(other.runtime.firstOut);assert.equal(other.runtime.postings.length,0);
 fault(other,'vacuumLoss',false);command(other,'resetRobot');step(other,50);assert.equal(other.runtime.postings.length,1);
});

test('a stopped rack controller cannot execute ST or issue a pick while the powered belt still crosses the photoeye',()=>{
 const p=commissioned();
 command(p,'installProgram',{language:'ST',source:'COUNT := COUNT + 1;'});
 fault(p,'controllerStop',true);step(p,100);
 assert.ok(p.runtime.cartons[0].detected);assert.equal(p.runtime.count,0);
 assert.equal(p.runtime.pallets.length,0);assert.equal(p.runtime.coupled.executing,false);
 assert.deepEqual(loadProject(saveProject(p)).runtime,p.runtime);
 fault(p,'controllerStop',false);step(p);assert.equal(p.runtime.count,1);
});
test('file learning claims do not create earned mastery; a replayed assessment uses observed network denial and recovery',()=>{
 const p=createProject('reference');
 p.learning.demonstrated={travel:{scan:200,seed:5}};
 p.learning.videoBlocked=p.learning.videoRestored=true;
 command(p,'assessSkills');assert.deepEqual(p.runtime.earned,{});
 const forged=loadProject(saveProject(p));assert.deepEqual(forged.runtime.earned,{});
});

test('rewiring after a missed signal requires a fresh observed scan before SAT can pass',()=>{
 const p=createProject('reference');
 command(p,'disconnect',{from:'eye',port:'out'});addCarton(p);step(p,60);
 connect(p,'eye','out','plc','I0');assert.equal(assess(p).find(x=>x.id==='sensor').pass,false);
 command(p,'evidence',{phase:'SAT',tester:'T',witness:'W',authority:'A'});assert.equal(p.runtime.evidence.at(-1).pass,false);
 addCarton(p);step(p,40);assert.equal(assess(p).find(x=>x.id==='sensor').pass,true);
});

test('integrated assessment recognises coupled vacuum recovery and lost acknowledgement on the same identified carton',()=>{
 const p=commissioned();
 configure(p,'erp',{dropAck:true});fault(p,'vacuumLoss',true);step(p,120);
 assert.equal(p.runtime.firstOut.category,'vacuum');assert.equal(p.runtime.postings.length,0);
 fault(p,'vacuumLoss',false);command(p,'resetRobot');step(p,110);
 configure(p,'erp',{dropAck:false});command(p,'retryERP');command(p,'evidence',{phase:'Integrated',tester:'T',witness:'W',authority:'A'});
 assert.equal(p.runtime.evidence.at(-1).pass,true);assert.equal(p.runtime.postings.length,1);
});
