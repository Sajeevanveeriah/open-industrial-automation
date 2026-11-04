import test from 'node:test';
import assert from 'node:assert/strict';
import {scenario,advance,exportRun,importRun} from '../simulator/engine.mjs';
import {createLedger,transform,balance,traceLot,historyQuery,spc,reliability,indicators,counterexample} from '../simulator/workshop/production/analytics.mjs';
test('split, rework and recombine reconcile gross intake, explicit losses and inherited raw identities',()=>{
  const ledger=createLedger([{id:'A',rawLotId:'RAW-1',pendingKg:90,releasedKg:10,holdReasons:[]},{id:'B',rawLotId:'RAW-2',pendingKg:0,releasedKg:50,holdReasons:['inspection']}]);
  transform(ledger,{kind:'Split',parents:[{id:'A',kg:40}],output:'C',loss:0});
  transform(ledger,{kind:'Rework',parents:[{id:'C',kg:30}],output:'D',loss:4});
  transform(ledger,{kind:'Recombine',parents:[{id:'D',kg:26},{id:'B',kg:20}],output:'E',loss:2});
  assert.deepEqual(balance(ledger),{input:150,inventory:144,loss:6,residual:0,pass:true});
  const tr=traceLot(ledger,'E');assert.deepEqual(tr.raw,['RAW-1','RAW-2']);assert.equal(tr.hold,true);assert.deepEqual(new Set(tr.ancestors),new Set(['A','B','C','D']));
  assert.deepEqual(traceLot(ledger,'A').descendants,['C','D','E']);
  const saved=structuredClone(ledger);
  for(const op of [
    {kind:'Split',parents:[{id:'A',kg:61}],output:'F',loss:0},
    {kind:'Recombine',parents:[{id:'A',kg:10},{id:'A',kg:10}],output:'F',loss:0},
    {kind:'Rework',parents:[{id:'A',kg:10}],output:'B',loss:1}
  ]){assert.throws(()=>transform(ledger,op));assert.deepEqual(ledger,saved);}
});
test('historian exposes missed observations separately from deliberate deadband compression',()=>{
  const s={time:90,history:[0,15,30,75,90].map((time,i)=>({time,powerKW:[1,1.2,1.4,1.5,1.8][i]}))};
  const q=historyQuery(s,'powerKW',0,90,1);assert.equal(q.total,5);assert.equal(q.expected,7);
  assert.deepEqual(q.points.map(x=>x.time),[0,75,90]);assert.deepEqual(q.gaps,[{from:30,to:75}]);
  assert.throws(()=>historyQuery(s,'powerKW',-1,90));
});
test('SPC applies independent baseline sample mean and sample standard deviation',()=>{
  const result=spc([1,2,3,5,5.01,-2],3);
  assert.equal(result.mean,2);assert.equal(result.sd,1);assert.equal(result.low,-1);assert.equal(result.high,5);
  assert.deepEqual(result.violations,[4,5]);assert.throws(()=>spc([1],1));
});
test('fault observation includes right-censored duration but excludes it from MTTR',()=>{
  const rows=[[10,'fault'],[20,'clearFault'],[70,'fault']].map(([at,type])=>({at,type,payload:{id:'pack-film'}}));
  const [r]=reliability(rows,100);
  assert.equal(r.affectedS,40);assert.equal(r.mttr,10);assert.equal(r.mtbf,30);assert.equal(r.openAt,70);
});
test('reference replay before and after film break has better reported availability and lower actual output',()=>{
  const [a,b]=counterexample();assert.equal(a.end-a.start,b.end-b.start);
  assert.ok(a.packed>3000&&a.packed<4000);assert.equal(b.packed,0);assert.ok(b.availability>a.availability);
});
test('window advances the authentic reference plant and recorded study can reproduce its balance',()=>{
  const p=scenario('baseline');advance(p,60);const q=importRun(exportRun(p)),m=indicators(q);
  assert.equal(q.time,2460);assert.equal(m.plannedS,2460);assert.ok(Math.abs(m.conservation.residualKg)<0.0001);
  assert.equal(m.idealKg,24000*m.runningS/3600);assert.deepEqual(createLedger(q.finishedLots),createLedger(p.finishedLots));
});
