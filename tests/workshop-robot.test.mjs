import test from 'node:test';
import assert from 'node:assert/strict';
import {newCell,forward,inverse,clearance,calibrate,start,step,recover,validateCell,importRecording} from '../simulator/workshop/robot/kinematics.mjs';
const close=(actual,wanted,tol=1e-10)=>assert.ok(Math.abs(actual-wanted)<=tol,actual+' differs from '+wanted);
test('two orthogonal links with rotated translated base land at independently calculated TCP',()=>{
  const c=newCell();c.base={x:1,y:2,yaw:Math.PI/2};c.arm={upper:.6,fore:.4,tcp:.1,branch:1,rate:1};
  const f=forward(c,[0,Math.PI/2]);close(f.elbow.x,1);close(f.elbow.y,2.6);close(f.wrist.x,.6);close(f.tip.x,.5);close(f.tip.y,2.6);
  const q=inverse(c,{x:.5,y:2.6});close(q[0],0);close(q[1],Math.PI/2);
  close(calibrate(c,{x:.5,y:2.6}),.1);assert.throws(()=>calibrate(c,{x:.5,y:2.61}),/off the tool axis/);
});
test('elbow-up and elbow-down solutions reach the same point; annular limits and clearance are independent',()=>{
  const c=newCell();c.arm.upper=.5;c.arm.fore=.5;c.arm.tcp=0;
  let q=inverse(c,{x:.5,y:.5});close(q[0],0);close(q[1],Math.PI/2);c.arm.branch=-1;
  q=inverse(c,{x:.5,y:.5});close(q[0],Math.PI/2);close(q[1],-Math.PI/2);
  assert.throws(()=>inverse(c,{x:1.01,y:0}),/outside/);
  c.keepout={x:.2,y:.1,r:.05};close(clearance(c,[0,0]),.025);
});
test('first-out latches, vacuum retry resumes a single carton, replay and different tick batching match',()=>{
  const c=newCell();c.signals.vacuum=false;start(c);step(c,1000);assert.equal(c.phase,'fault');assert.equal(c.fault,'Vacuum feedback missing');
  const t=c.tick;step(c,500);assert.equal(c.tick,t);assert.equal(c.palletised.length,0);c.signals.vacuum=true;recover(c);
  step(c,4);const copy=validateCell(JSON.parse(JSON.stringify(c)));step(c,1000);
  while(!['fault','complete'].includes(copy.phase))step(copy);
  assert.deepEqual(copy,c);assert.equal(c.phase,'complete');assert.deepEqual(c.palletised,['CASE-001']);
  assert.equal(c.events.filter(e=>e.message.startsWith('Placed ')).length,1);
});
test('PLC timeout, reach, clearance and incorrect pick position give different first causes',()=>{
  for(const [change,expected] of [[c=>c.signals.ready=false,'PLC ready handshake timed out'],[c=>c.stations.pick.x=5,'Target outside annular reach'],[c=>c.keepout={x:0,y:0,r:.1},'Guard clearance breached'],[c=>c.carton.y+=.1,'No carton within 20 mm of tool']]){
    const c=newCell();change(c);start(c);step(c,1000);assert.equal(c.fault,expected);assert.equal(c.palletised.length,0);
  }
});
test('two valid workcell geometries pass; runtime rejects inconsistent identities',()=>{
  for(const variant of [false,true]){
    const c=newCell();if(variant){c.base.x=-.15;c.base.y=.08;c.base.yaw=.25;c.carton.x=c.stations.pick.x=.62;c.pallet.x=c.stations.place.x=.15;}
    start(c);step(c,1000);validateCell(c);assert.equal(c.phase,'complete');assert.equal(c.palletised[0],c.carton.id);
    assert.throws(()=>validateCell({...c,palletised:[]}),/Inconsistent/);
  }
});
test('external results validation requires SI Z-up contracting and strictly ordered finite samples',()=>{
  const contract={schema:'oia.engine-run/1',scenario:'packaging-pilot/1',source:'isaac-sim',engineVersion:'fixture',runId:'fixture-01',units:'SI',upAxis:'Z',frame:'cell',stepSeconds:1/60,wallSeconds:1,vrAMMiB:null,samples:Array.from({length:241},(_,i)=>({timeS:i/60,cartonXM:.4+i/240,robotJointRad:i/600,sensorHigh:i>=120}))};
  assert.equal(importRecording(JSON.stringify(contract)).samples.length,241);
  for(const data of [{...contract,units:'mm'},{...contract,source:'built-in'},{...contract,samples:[contract.samples[0],contract.samples[0]]}])assert.throws(()=>importRecording(JSON.stringify(data)));
});
test('vacuum loss between arrival at place and acceptance holds the carton for a single retry',()=>{
  const c=newCell();start(c);while(c.phase!=='release')step(c);c.signals.vacuum=false;step(c);
  assert.equal(c.phase,'fault');assert.equal(c.fault,'Vacuum lost before placement confirmation');assert.equal(c.gripped,true);assert.deepEqual(c.palletised,[]);
  const restored=validateCell(JSON.parse(JSON.stringify(c)));restored.signals.vacuum=true;recover(restored);step(restored);assert.equal(restored.phase,'complete');assert.deepEqual(restored.palletised,['CASE-001']);
  assert.throws(()=>validateCell({...restored,externalCommand:'run'}),/Unknown/);
  assert.throws(()=>validateCell({...restored,events:[]}),/Missing transfer evidence/);
});
