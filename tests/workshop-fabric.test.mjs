import test from 'node:test';
import assert from 'node:assert/strict';
import {referenceRack,importRack,patch,putDevice,device,record} from '../simulator/workshop/infrastructure/rack.mjs';
import {checkAdvanced,ipv6} from '../simulator/workshop/infrastructure/advanced-schema.mjs';
import {topologyExample,convergence,frameSequence,neighbours6,precisionTime,traffic,crc16,serialLine,optics,captureSurvey,handover,advancedAssessment} from '../simulator/workshop/infrastructure/fabric.mjs';
const close=(a,b,eps=.001)=>assert.ok(Math.abs(a-b)<=eps,a+' != '+b);
test('learner-patched parallel trunks and three-switch ring meet the restoration deadline; disjoint fault domains matter',()=>{
  for(const type of ['parallel','ring']){
    const r=topologyExample(type),x=convergence(r,'PLC','DI','EDGE_CORE');
    assert.equal(x.affected,true);assert.equal(x.pass,true);assert.ok(!x.after.includes('EDGE_CORE'));
    assert.equal(x.loss,type==='parallel'?2:5);close(x.restoredMs,type==='parallel'?8.15032:20.21376);
    r.advanced.deadlineMs=6;assert.equal(convergence(r,'PLC','DI','EDGE_CORE').pass,false);
    r.devices.find(d=>d.id==='EDGE').power=false;assert.equal(convergence(r,'PLC','DI','EDGE_CORE').pass,false);
  }
  const r=topologyExample('parallel');assert.ok(convergence(r,'PLC','DI','STANDBY',1).before.includes('STANDBY'));
  r.links.find(l=>l.id==='STANDBY').up=false;assert.equal(convergence(r,'PLC','DI','EDGE_CORE').restoredMs,null);
});
test('independently built third switch tree survives an active cable fault and rejects irrelevant loss',()=>{
  const r=referenceRack();putDevice(r,device('BYPASS','switch','10.24.10.200'));
  const di=r.links.find(l=>l.a==='DI');patch(r,{...di,b:'CORE',pb:11});
  const trunk=r.links.find(l=>l.id==='EDGE_CORE');
  patch(r,{...trunk,id:'WEST',a:'EDGE',pa:19,b:'BYPASS',pb:1});patch(r,{...trunk,id:'EAST',a:'CORE',pa:19,b:'BYPASS',pb:2});
  const result=convergence(r,'PLC','DI','EDGE_CORE');assert.equal(result.pass,true);assert.ok(result.after.includes('WEST'));
  assert.equal(convergence(r,'PLC','DI','CAM_EDGE').pass,false);
});
test('actual loop-free egress replicates unknown unicast but limits learned return paths, mirror and IGMP group',()=>{
  const r=topologyExample('ring');const {frames}=frameSequence(r,'PLC','DI');
  assert.ok(frames[0].station.includes('CAM'));assert.ok(!frames[0].station.includes('NVR'));assert.deepEqual(frames[2].station,['DI']);assert.equal(frames[2].mirror.length,1);
  r.advanced.mirrorPort=1;assert.equal(frameSequence(r,'PLC','DI').frames[2].mirror.length,0);
  const snooped=frameSequence(r,'PLC','DI',{group:true});assert.deepEqual(snooped.frames[0].station,['DI']);
  const flooded=frameSequence(r,'PLC','DI',{group:true,snoop:false});assert.ok(flooded.frames[0].station.includes('VIEW'));
});
test('IPv6 compressed parsing, solicited-node bytes, duplicate address and incorrect prefix diagnostics',()=>{
  const r=topologyExample('parallel');assert.equal(ipv6('fd24:a::31'),ipv6('fd24:000a:0000:0000:0000:0000:0000:0031'));
  const n=neighbours6(r,'PLC','DI');assert.equal(n.solicitedNode,'ff02::1:ff00:0032');assert.equal(n.ethernet,'33:33:ff:00:00:32');
  r.advanced.ipv6.push({id:'VIEW',address:'fd24:a::32',prefix:64});assert.throws(()=>neighbours6(r,'PLC','DI'),/Duplicate/);
  r.advanced.ipv6.pop();r.advanced.ipv6[1].address='fd24:b::32';assert.throws(()=>neighbours6(r,'PLC','DI'),/prefix/);
  for(const s of [':',':::','1::2::3','::zz','10.0.0.1'])assert.throws(()=>ipv6(s));
});
test('four-timestamp two-way offset has half-asymmetry bias, QoS meets a deadline FIFO misses, protocol timings differ',()=>{
  const r=topologyExample('parallel'),t=precisionTime(r,'PLC','DI',80,12);assert.equal(t.offsetEstimateUs,86);assert.equal(t.residualUs,-6);
  const base={periodMs:2,congestion:20},fifo=traffic(r,'PLC','DI',base),prio=traffic(r,'PLC','DI',{...base,qos:true});
  assert.ok(fifo.failed>0);assert.equal(prio.failed,0);assert.ok(prio.maxMs<fifo.maxMs);
  const simple=traffic(r,'PLC','DI',{congestion:0});close(simple.minMs,3*(96*8/100000+.005)+2*.02);
  assert.ok(traffic(r,'PLC','DI',{congestion:0,protocol:'Modbus TCP poll'}).minMs>simple.minMs+.5);
  const cut=traffic(r,'PLC','DI',{periodMs:4,congestion:0,outageLead:'EDGE_CORE'});assert.ok(cut.cycles.some(c=>c.latencyMs===null));
});
test('known Modbus read request and CRC, 11 bits per character, turnaround and parity',()=>{
  const sample={hex:'01 03 00 00 00 0A',baud:9600,parity:'E',peerParity:'E',stop:1,gapMs:5},x=serialLine(sample);
  assert.equal(crc16([1,3,0,0,0,10]),0xcdc5);assert.equal(x.wire,'01 03 00 00 00 0A C5 CD');
  close(x.durationMs,8*11/9600*1000);close(x.minGapMs,3.5*11/9600*1000);assert.equal(x.ok,true);
  assert.equal(serialLine({...sample,gapMs:3.9}).reason,'Silent interval too short');assert.equal(serialLine({...sample,peerParity:'O'}).reason,'Parity mismatch');
});
test('camera survey respects scene geometry, optical resolution, permission, and witnessed custody',()=>{
  const r=topologyExample('ring'),l=r.advanced.lens;Object.assign(l,{hfov:90,width:1000,height:500,targetX:5,targetY:0,privateX:4,privateY:6,featureM:.2,minPixels:20});
  assert.equal(optics(l).target.featurePixels,20);assert.equal(optics(l).pass,true);
  l.privateY=1;assert.throws(()=>captureSurvey(r,'VIEW','NVR'),/Restricted/);assert.equal(r.clips.length,0);l.privateY=6;
  const clip=captureSurvey(r,'VIEW','NVR').clip;assert.equal(clip.end-clip.start,10);
  const log=(action,role,actor)=>handover(r,{role,actor,action,clipId:clip.id,viewer:'VIEW',recorder:'NVR'});
  assert.throws(()=>log('Accept handover','Duty engineer','Duty'),/Escalate/);log('Preserve','Operator','Operations');
  assert.throws(()=>log('Restrict access','IT custodian','Custodian'),/Restrict recorder/);r.devices.find(d=>d.id==='NVR').groups.push('investigator');
  log('Restrict access','IT custodian','Custodian');log('Escalate egress','Facilities lead','Facilities');
  assert.throws(()=>log('Accept handover','Duty engineer','Custodian'),/independent/);log('Accept handover','Duty engineer','Duty');
  assert.ok(advancedAssessment(r,{from:'PLC',to:'DI',lead:'EDGE_CORE',flow:0,viewer:'VIEW',recorder:'NVR'}).every(row=>row.pass));
  assert.deepEqual(importRack(JSON.stringify(r)).advanced,r.advanced);
});
test('reject unknown topology settings, invalid clock intervals, malicious group IDs and malformed IPv6 assignments',()=>{
  const r=referenceRack(),original=JSON.stringify(r);
  for(const patch of [{sampleMs:0},{lagGroup:['absent']},{membership:'239.500.1.1'},{runCommand:'unsafe'},{ipv6:[{id:'CAM',address:'::1',prefix:64}]}]){
    const a={...r.advanced,...patch};assert.throws(()=>checkAdvanced(a,r));
  }
  assert.equal(JSON.stringify(r),original);
});
test('custody acceptance rejects orphaned or out-of-order imported history and cannot carry across incidents',()=>{
 const r=topologyExample('ring'),query={from:'PLC',to:'DI',lead:'EDGE_CORE',flow:0,viewer:'VIEW',recorder:'NVR'};
 const fake=structuredClone(r);fake.advanced.custody=[{actor:'Inspector',time:0,action:'Accept handover / 9999'}];
 assert.throws(()=>importRack(JSON.stringify(fake)),/custody/);
 const id=captureSurvey(r,'VIEW','NVR').clip.id;
 r.devices.find(d=>d.id==='NVR').groups.push('investigator');
 for(const [action,role,actor] of [['Preserve','Operator','Operator1'],['Restrict access','IT custodian','IT1'],['Escalate egress','Facilities lead','FM1'],['Accept handover','Duty engineer','Duty1']])handover(r,{action,role,actor,viewer:'VIEW',recorder:'NVR',clipId:id});
 assert.ok(advancedAssessment(r,query).at(-1).pass);
 const partial=structuredClone(r);partial.advanced.custody.shift();assert.throws(()=>importRack(JSON.stringify(partial)),/custody/);
 captureSurvey(r,'VIEW','NVR');assert.equal(advancedAssessment(r,query).at(-1).pass,false);
});
