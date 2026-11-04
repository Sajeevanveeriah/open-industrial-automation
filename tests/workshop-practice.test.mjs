import test from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import {compileProgram,compileLadder,newController,executeScan} from '../simulator/workshop/practice/plc.mjs';
import {sampling,circuit,loop,inspection,observation} from '../simulator/workshop/practice/experiments.mjs';
import {readQuery,queryRecords} from '../simulator/workshop/practice/database.mjs';
import {createProject,command,addCarton,step,saveProject,loadProject,configure} from '../simulator/workshop/model.mjs';

test('ST and Ladder independently count two rising edges across nine retained scans',()=>{
  for(const p of [compileProgram('IF R_TRIG(IN) THEN COUNT := COUNT+1; END_IF;'),compileLadder('NO(IN) & NC(TRIP) -> CTU(COUNT)')]){
    let state=newController();const counts=[];
    for(const sample of [false,true,true,true,true,true,false,true,true]) {state=executeScan(p,state,{IN:sample});counts.push(state.COUNT);}
    assert.deepEqual(counts,[0,1,1,1,1,1,1,2,2]);
  }
});
test('timer delay, Boolean precedence, setpoint comparison, analogue scale, falling edge and state mode',()=>{
  const p=compileProgram('OUTPUT := SCALE(ANALOGUE); RUN := TON(I0 AND NOT I1,0.3); IF RUN AND OUTPUT >= SETPOINT THEN MODE := 2; ELSE MODE := 1; END_IF; IF F_TRIG(I0) THEN COUNT := COUNT+1; END_IF;');
  let s=newController();
  const modes=[1,1,1,0].map(I0=>{s=executeScan(p,s,{I0,I1:0,ANALOGUE:12,SETPOINT:50});return s.MODE;});
  assert.deepEqual(modes,[1,1,2,1]);assert.equal(s.OUTPUT,50);assert.equal(s.COUNT,1);
});
test('PLC syntax, immutable inputs, token and runtime limits',()=>{
  for(const invalid of ['I0 := 1;','RUN := load(1);','RUN := TON(I0);','IF IN COUNT := 1; END_IF;','COUNT := 1;'.repeat(200)])assert.throws(()=>compileProgram(invalid));
  assert.throws(()=>compileLadder('NO(I0) -> JUMP(9)'));
  assert.throws(()=>executeScan(compileProgram('OUTPUT := 1 / I0;'),newController(),{I0:0}),/Division by zero/);
});
test('custom program governs actual cell, diagnostics, replay and switching back to preset',()=>{
  const p=createProject('reference');command(p,'installProgram',{language:'ST',source:'IF IN THEN COUNT := COUNT + 1; END_IF;'});
  addCarton(p);step(p,44);assert.equal(p.runtime.count,5);
  const q=loadProject(saveProject(p));assert.deepEqual(q.runtime,p.runtime);
  command(q,'installProgram',{language:'ST',source:'OUTPUT := 1 / 0;'});step(q,5);assert.match(q.runtime.diagnostic,/Division by zero/);
  assert.equal(q.runtime.events.filter(e=>e.kind==='program-fault').length,1);
  configure(q,'plc',{mode:'rising'});addCarton(q);step(q,44);assert.equal(q.runtime.count,6);
});
test('DC current, power, open circuit, fuse trip and dead measurement',()=>{
  let p=circuit();assert.equal(p.current,0.02);assert.equal(p.power,0.48);assert.equal(p.continuity,null);
  p=circuit({broken:true});assert.equal(p.voltage,0);
  assert.equal(circuit({supply:0,resistance:100}).continuity,100);
  assert.equal(circuit({resistance:10,fuse:0.1}).overcurrent,true);
});
test('thermal control settles and the no-controller case approaches new passive equilibrium',()=>{
  const controlled=loop();assert.ok(Math.abs(controlled.final-55)<0.1);
  const idle=loop({kp:0,ki:0,kd:0,load:10});assert.ok(Math.abs(idle.final-10)<0.04);
  assert.equal(idle.rows.find(x=>x.time===49).disturbance,0);assert.equal(idle.rows.find(x=>x.time===50).disturbance,10);
  assert.ok(controlled.rows.every(r=>r.output>=0&&r.output<=100));
});
test('sampling aliases 7 Hz to 3 Hz at 10 Hz; supervised stall misses samples and trips timeout',()=>{
  assert.equal(sampling().aliasHz,3);assert.equal(sampling({sampleHz:30}).aliasHz,7);
  const stall=sampling({sampleHz:100,stallMs:450,watchdogMs:200});assert.equal(stall.resets,2);assert.equal(stall.missed,45);
});
test('synthetic datasets are separated by run, reproducible and responsive to light',()=>{
  for(const kind of ['condition','optical']){
    const r=inspection({kind});assert.ok(!r.trainingRuns.includes(r.testRun));
    assert.equal(r.model.predictions.filter(p=>p.defect).length,8);
    assert.equal(r.model.correct+r.model.falseRejects+r.model.falseAccepts,32);assert.ok(r.model.correct>24);
    assert.deepEqual(r.weights,inspection({kind}).weights);
  }
  assert.notDeepEqual(observation(5,3,0.6).pixels,observation(5,3,1).pixels);
  assert.ok(inspection({lighting:0.3}).baseline.falseRejects>inspection({lighting:1}).baseline.falseRejects);
});
test('offline SQLite joins actual pallet, intake and accepted business movement',async()=>{
  const SQL=await initSqlJs();const p=createProject('reference');
  command(p,'releaseOrder',{id:'ORDER-5'});addCarton(p,'INTAKE-1');step(p,81);
  const result=queryRecords(SQL,p.runtime,'SELECT pallets.id, cartons.lot, postings.quantity FROM pallets JOIN cartons ON pallets.carton=cartons.id LEFT JOIN postings ON postings.pallet=pallets.id');
  assert.deepEqual(result.values,[['PAL-1','INTAKE-1',1]]);
  assert.deepEqual(queryRecords(SQL,p.runtime,'SELECT COUNT(*) AS total FROM pallets').values,[[1]]);
  for(const query of ['UPDATE cartons SET x=0','SELECT id FROM cartons; SELECT 1','SELECT randomblob(100000)','SELECT 1 -- comment','ATTACH DATABASE anything']) assert.throws(()=>readQuery(query));
});
