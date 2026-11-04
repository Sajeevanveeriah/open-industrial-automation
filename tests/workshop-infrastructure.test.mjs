import test from 'node:test';
import assert from 'node:assert/strict';
import {referenceRack,patch,probe,inspect,assess,payloadGB,record,retrieve,door,snapshot,failVolume,restore,tick,importRack,physical} from '../simulator/workshop/infrastructure/rack.mjs';

const plan={viewer:'VIEW',camera:'CAM',recorder:'NVR',uplink:'EDGE_CORE'};
test('two address plans and patch layouts meet the same behavioural requirements',()=>{
  for(const variant of [false,true]){
    const r=referenceRack();
    if(variant){
      for(const d of r.devices){d.ip=d.ip.replace('10.24','172.18');d.gateway=d.gateway.replace('10.24','172.18');for(const i of d.interfaces)i.ip=i.ip.replace('10.24','172.18');}
      const l=r.links.find(l=>l.id==='VIEW_EDGE');patch(r,{...l,pb:4});
    }
    record(r,'NVR','CAM');assert.deepEqual(assess(r,plan).map(x=>x.ok),[true,true,true,true,true]);
    r.rules.push({from:'cell',to:'services',protocol:'admin'});assert.equal(assess(r,plan)[3].ok,false);
  }
});
test('VLAN mismatch preserves physical carrier but breaks local ARP; local video survives upstream isolation',()=>{
  const r=referenceRack(),lead=r.links.find(l=>l.id==='CAM_EDGE');
  patch(r,{...lead,vlans:[42]});assert.equal(physical(r,lead),'Link up');assert.equal(probe(r,'VIEW','CAM','video').reason,'ARP unresolved on source VLAN');
  patch(r,{...lead,vlans:[10]});r.links.find(l=>l.id==='EDGE_CORE').up=false;
  assert.equal(probe(r,'VIEW','CAM','video').ok,true);assert.equal(probe(r,'NVR','CAM','video').ok,false);
});
test('broadcast and subsequent unicast have distinct observation points and routed sessions cross the firewall',()=>{
  const r=referenceRack(),first=inspect(r,'VIEW','CAM','video');
  assert.ok(first.trace[0].at.includes('CORE'));assert.ok(!first.trace[0].at.includes('NVR'));
  const next=inspect(r,'VIEW','CAM','video');assert.equal(next.trace.length,1);assert.deepEqual(next.trace[0].at,['VIEW','EDGE','CAM']);
  assert.equal(inspect(r,'VIEW','NVR','admin').ok,false);assert.equal(r.hits.at(-1).permitted,false);
  assert.deepEqual(inspect(r,'NVR','CAM','video').trace.filter(f=>f.kind==='RTSP 554').map(f=>f.vlan),[20,10]);
});
test('independent physical and application faults produce distinct evidence',()=>{
  const r=referenceRack(),cam=r.devices.find(d=>d.id==='CAM'),sw=r.devices.find(d=>d.id==='EDGE');
  sw.budgetW=7;assert.equal(probe(r,'VIEW','CAM','video').reason,'Power budget exceeded');sw.budgetW=60;
  cam.service=false;assert.equal(probe(r,'VIEW','CAM').ok,true);assert.equal(probe(r,'VIEW','CAM','video').reason,'Destination service stopped');
  cam.service=true;cam.clockOffset=6;assert.match(probe(r,'VIEW','CAM','video').reason,/Clock/);cam.clockOffset=0;
  cam.groups=['engineering'];assert.equal(probe(r,'VIEW','CAM','video').reason,'Identity denied');
});
test('payload, actual loss, recovery time and retrieved clip are tied to one register',()=>{
  assert.equal(payloadGB(4,4,24),172.8);
  const r=referenceRack();const c=record(r,'NVR','CAM',60);assert.equal(c.gb,0.03);snapshot(r,'NVR');record(r,'NVR','CAM',30);failVolume(r,'NVR');
  const restored=importRack(JSON.stringify(r));tick(restored,120);assert.deepEqual(restore(restored),{recorder:'NVR',elapsedS:120,pointAgeS:30,lostClips:1});
  assert.equal(retrieve(restored,'VIEW','NVR',1).start,0);assert.throws(()=>retrieve(restored,'VIEW','NVR',2),/missing/);
  assert.equal(door(restored,'READ','DOOR','operator'),true);assert.equal(door(restored,'READ','DOOR','visitor'),false);
});
test('rejected port conflicts and malformed packages do not replace existing state',()=>{
  const r=referenceRack(),l=r.links[0],before=JSON.stringify(r);
  assert.throws(()=>patch(r,{...l,id:'DUP'}),/already/);assert.equal(JSON.stringify(r),before);
  for(const input of ['{','[]',' '.repeat(256001),JSON.stringify({...r,devices:[...r.devices,r.devices[0]]})])assert.throws(()=>importRack(input));
});
test('local DHCP and routed DNS/time services expose separate dependencies',async()=>{
  const {lease,resolveName,synchronise,hardwareAddress}=await import('../simulator/workshop/infrastructure/rack.mjs');
  const r=referenceRack(),server=r.devices.find(d=>d.id==='INFRA');server.addressPool=1;
  assert.equal(lease(r,'READ','INFRA').ip,'10.24.20.254');assert.throws(()=>lease(r,'DOOR','INFRA'),/exhausted/);
  assert.throws(()=>lease(r,'VIEW','INFRA'),/VLAN/);
  assert.equal(resolveName(r,'VIEW','INFRA','cam.cell.test'),'10.24.10.11');
  assert.throws(()=>resolveName(r,'VIEW','INFRA','missing.cell.test'),/no address/);
  r.devices.find(d=>d.id==='VIEW').clockOffset=90;assert.equal(synchronise(r,'VIEW','INFRA'),0);
  assert.ok(r.bindings.some(b=>b.switch==='EDGE'&&b.vlan===10&&b.port===2&&b.addr===hardwareAddress(r,'VIEW')));
  assert.deepEqual(importRack(JSON.stringify(r)),r);
});
test('local register counts through an upstream outage; stale values, broker retries and firewall evidence stay distinct',async()=>{
  const {controlCycle,sampleTag,enqueueTag,publishTag}=await import('../simulator/workshop/infrastructure/rack.mjs');
  const r=referenceRack();for(const level of [false,true,true])controlCycle(r,'PLC','DI',level);
  assert.equal(r.process.count,1);assert.equal(sampleTag(r,'GATE','PLC'),true);r.links.find(l=>l.id==='EDGE_CORE').up=false;
  controlCycle(r,'PLC','DI',false);controlCycle(r,'PLC','DI',true);assert.equal(r.process.count,2);
  assert.equal(sampleTag(r,'GATE','PLC'),false);assert.equal(r.process.lastValue,1);assert.equal(r.process.quality,'Stale');
  r.links.find(l=>l.id==='EDGE_CORE').up=true;sampleTag(r,'GATE','PLC');enqueueTag(r);
  publishTag(r,'GATE','INFRA',true);publishTag(r,'GATE','INFRA');assert.equal(r.process.posted.length,1);assert.equal(r.process.pending.length,0);
});
test('trunk peer membership and offered load alter measured service while physical carrier remains active',async()=>{
  const {setLoad,backgroundLoad}=await import('../simulator/workshop/infrastructure/rack.mjs');
  const r=referenceRack(),l=r.links.find(l=>l.id==='EDGE_CORE');l.peerVlans=[20];assert.equal(probe(r,'NVR','CAM','video').ok,false);
  l.peerVlans=[10,20];assert.equal(probe(r,'NVR','CAM','video').ok,true);
  setLoad(r,'VIEW','CAM',97);assert.equal(backgroundLoad(r,'CAM_EDGE'),97);
  assert.equal(probe(r,'VIEW','CAM','video').reason,'Insufficient stream capacity');
  setLoad(r,'VIEW','CAM',96);assert.equal(probe(r,'VIEW','CAM','video').ok,true);
});
test('PLC source time precedes delayed arrival and stopped controller cannot scan',async()=>{
  const {controlCycle,sampleTag}=await import('../simulator/workshop/infrastructure/rack.mjs');
  const r=referenceRack();assert.equal(sampleTag(r,'GATE','PLC'),false);assert.equal(r.process.quality,'Unknown');
  controlCycle(r,'PLC','DI',true);tick(r,100);sampleTag(r,'GATE','PLC');
  assert.deepEqual([r.process.sourceTime,r.process.arrivalTime,r.process.lastValue],[1,101,1]);
  r.devices.find(d=>d.id==='PLC').service=false;
  assert.throws(()=>controlCycle(r,'PLC','DI',false),/scan service stopped/);assert.equal(r.clock,101);
  assert.equal(sampleTag(r,'GATE','PLC'),false);assert.equal(r.process.quality,'Stale');assert.equal(r.process.sourceTime,1);
  for(const modify of [r=>r.process.arrivalTime=-1,r=>r.devices[0].script='launch',r=>r.links[0].target='outside',r=>r.process.pending=[{id:200,time:900,value:8}]]){
    const x=structuredClone(r);modify(x);assert.throws(()=>importRack(JSON.stringify(x)));
  }
});
