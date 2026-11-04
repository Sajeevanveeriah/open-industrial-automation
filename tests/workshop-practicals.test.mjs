import test from 'node:test';
import assert from 'node:assert/strict';
import {makePractical,diagnose,prove,transferCase,recordPractical} from '../simulator/workshop/studio/practicals.mjs';
import {configure,connect,command,step,saveProject,loadProject} from '../simulator/workshop/model.mjs';
test('wiring requires predicted live fault, two measured repairs and an independently changed mapping',()=>{
 const p=makePractical('wiring');assert.throws(()=>prove(p));assert.throws(()=>transferCase(p));
 assert.equal(diagnose(p,'I0').pass,false);assert.equal(diagnose(p,'I1').pass,true);assert.equal(prove(p).pass,false);
 connect(p,'eye','out','plc','I0');assert.equal(prove(p).pass,true);assert.throws(()=>recordPractical(p));
 const q=transferCase(loadProject(saveProject(p)));assert.equal(diagnose(q,'I0').pass,true);
 configure(q,'plc',{input:'I0'});assert.equal(prove(q).pass,true);assert.ok(recordPractical(loadProject(saveProject(q))).transfer.proof.pass);
});
test('counter rejects both repeated increments and a late falling-edge count on five and seven real scans',()=>{
 const p=makePractical('counting');assert.equal(diagnose(p,'5').evidence.programHigh,5);assert.equal(prove(p).pass,false);
 configure(p,'plc',{mode:'falling'});assert.equal(prove(p).pass,false);configure(p,'plc',{mode:'rising'});assert.equal(prove(p).pass,true);
 const q=transferCase(p);assert.equal(diagnose(q,'7').evidence.programHigh,7);
 command(q,'installProgram',{language:'ST',source:'IF R_TRIG(I1) THEN COUNT := COUNT + 1; END_IF;'});
 assert.equal(prove(q).pass,true);
});
test('camera learner must distinguish an active-link VLAN fault from permitted forwarding with denied identity',()=>{
 const p=makePractical('camera');const a=diagnose(p,'VLAN path');assert.equal(a.evidence.link,true);assert.equal(a.evidence.reachable,false);assert.equal(prove(p).pass,false);
 configure(p,'switch',{vlan2:40});assert.equal(prove(p).pass,true);const q=transferCase(p);
 const b=diagnose(q,'Viewing permission');assert.equal(b.evidence.reachable,true);assert.equal(b.evidence.video,false);assert.equal(prove(q).pass,false);
 configure(q,'camera',{permitted:true});const c=prove(q);assert.equal(c.pass,true);assert.equal(c.evidence.denied.video,false);
});
test('robot and business exercise needs the same carton, failed vacuum repair and a distinct lost ACK before confirmation',()=>{
 let p=makePractical('recovery');for(const variant of [1,2]){
  const first=diagnose(p,variant===1?'1':'0');assert.equal(first.pass,true);assert.equal(prove(p).pass,false);
  configure(p,'robot',{vacuum:true});command(p,'resetRobot');step(p,1);
  assert.equal(p.runtime.postings.length,variant===1?1:0);
  if(variant===2){configure(p,'erp',{online:true});command(p,'retryERP');}
  assert.equal(prove(p).pass,false);configure(p,'erp',{dropAck:false});command(p,'retryERP');command(p,'retryERP');
  assert.equal(prove(p).pass,true);assert.equal(p.runtime.pallets.length,1);assert.equal(p.runtime.postings.length,1);
  if(variant===1)p=transferCase(loadProject(saveProject(p)));
 }assert.ok(recordPractical(loadProject(saveProject(p))).transfer.proof.pass);
});
