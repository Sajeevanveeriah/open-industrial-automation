import test from 'node:test';
import assert from 'node:assert/strict';
import {createFacility,advance,act,totals,availableStock,saveFacility,loadFacility,DT} from '../simulator/workshop/studio/facility/facility-model.mjs';
import {openRecovery,writeRecovery,rearmRecovery} from '../simulator/workshop/studio/facility/recovery.mjs';
const find=(rows,id)=>rows.find(x=>x.id===id);
function unique(s){
  const pallets=[...s.bays.flatMap(b=>b.stock),...s.conveyors.flatMap(c=>c.parcels),...s.vehicles.flatMap(v=>v.load?[v.load]:[]),...s.doors.flatMap(d=>[...d.staged,...d.dispatched])];
  assert.equal(pallets.length,s.initialCount);assert.equal(new Set(pallets.map(p=>p.id)).size,s.initialCount);
  assert.ok(s.bays.every(b=>b.stock.length<=b.capacity&&new Set(b.stock.map(p=>p.level)).size===b.stock.length));
  const lanes=s.vehicles.map(v=>v.lane).filter(Boolean);assert.equal(new Set(lanes).size,lanes.length);
}
test('22 aisles, two faces and eight bays per face; deterministic moving reference has real, unique food inventory',()=>{
  const s=createFacility();assert.equal(s.aisles.length,22);assert.equal(s.bays.length,22*2*8);assert.equal(s.vehicles.length,8);assert.equal(s.initialCount,704);unique(s);
  const v=s.vehicles.find(v=>v.load&&v.state==='travelling'&&v.route[0].kind==='travel'&&Math.hypot(v.route[0].x-v.x,v.route[0].y-v.y)>v.speed*DT),before=[v.x,v.y];advance(s,1);assert.ok(Math.abs(Math.hypot(v.x-before[0],v.y-before[1])-v.speed*DT)<1e-9);
  advance(s,799);assert.equal(totals(s).sent,28);unique(s);assert.ok(s.doors.every(d=>d.dispatched.every(p=>p.sku&&p.lot&&p.order)));
});
test('user orders reserve only actual stock, recover a fault, stage and dispatch once with lot continuity',()=>{
  const s=createFacility();act(s,'auto',{enabled:false});const bay=s.bays.find(b=>availableStock(s,b).length),pal=availableStock(s,bay)[0];
  act(s,'order',{bay:bay.id,door:'D03',sku:pal.sku});const o=s.orders.at(-1);assert.equal(o.pallet,pal.id);
  const other=bay.stock.filter(p=>p.sku===pal.sku&&p.id!==pal.id);if(!other.length)assert.throws(()=>act(s,'order',{bay:bay.id,door:'D03',sku:pal.sku}),/No unreserved/);
  while(!o.vehicle)advance(s,4);const v=find(s.vehicles,o.vehicle);act(s,'truck',{id:v.id,fault:true});const xy=[v.x,v.y];advance(s,20);assert.deepEqual([v.x,v.y],xy);
  act(s,'truck',{id:v.id,fault:false});for(let i=0;i<400&&o.status!=='staged';i++)advance(s,4);
  assert.equal(o.status,'staged');act(s,'dispatch',{order:o.id});assert.throws(()=>act(s,'dispatch',{order:o.id}),/Stage/);
  assert.deepEqual(o.journey.map(m=>m.step),['Reserved','Assigned','Picked','Staged','Dispatched']);const record=find(s.doors,'D03').dispatched.at(-1);assert.deepEqual([record.id,record.lot,record.sku],[pal.id,pal.lot,pal.sku]);unique(s);
});
test('blocked entry queues stock; alternate bay and door redirect unlock the route without moving the original pallet',()=>{
  const s=createFacility();act(s,'auto',{enabled:false});const o=s.orders.find(o=>o.status==='queued'),b=find(s.bays,o.bay),old=o.pallet;
  act(s,'aisle',{id:b.aisle,blocked:true});for(let i=0;i<400;i++){advance(s);if(o.vehicle&&find(s.vehicles,o.vehicle).state==='waiting')break;}
  const v=find(s.vehicles,o.vehicle);assert.equal(v.state,'waiting');
  const alternate=s.bays.find(b2=>b2.aisle!==b.aisle&&availableStock(s,b2).some(p=>p.sku===o.sku));act(s,'redirect',{order:o.id,bay:alternate.id,door:'D04'});
  act(s,'door',{id:'D04',open:false});for(let i=0;i<400&&!(v.state==='waiting'&&o.status==='delivering');i++)advance(s,4);
  assert.equal(v.load.id,o.pallet);assert.ok(b.stock.some(p=>p.id===old));act(s,'redirect',{order:o.id,bay:alternate.id,door:'D01'});
  for(let i=0;i<200&&o.status!=='staged';i++)advance(s,4);assert.equal(o.status,'staged');unique(s);
});
test('replay, different frame batching, conveyor stop and invalid import retain stock and first-out evidence',()=>{
  const a=createFacility(11),b=createFacility(11);const pos=a.conveyors[0].parcels[0].progress;
  for(const s of [a,b])act(s,'conveyor',{id:'CV-01',running:false});
  advance(a,224);for(let i=0;i<32;i++)advance(b,7);assert.deepEqual(a,b);assert.equal(a.conveyors[0].parcels[0].progress,pos);
  const c=loadFacility(saveFacility(a));assert.deepEqual(c,a);advance(a,100);advance(c,100);assert.deepEqual(c,a);unique(c);
  for(const raw of ['{}','{',JSON.stringify({format:'oia-facility',version:1,seed:7,history:[['advance',9999999]]}),JSON.stringify({format:'oia-facility',version:1,seed:7,history:[['constructor',{}]]})])assert.throws(()=>loadFacility(raw));
});
test('damaged and concurrently changed recovery entries are retained until explicit replacement',()=>{
  const map=new Map(),io={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)},key='oia-facility-v1:Learner';map.set(key,'bad');
  const corrupt=openRecovery(io);assert.equal(corrupt.writable,false);assert.equal(writeRecovery(corrupt,io,corrupt.scenario),false);assert.equal(map.get(key),'bad');
  rearmRecovery(corrupt,io);assert.equal(writeRecovery(corrupt,io,corrupt.scenario),true);const a=openRecovery(io),b=openRecovery(io);advance(a.scenario,4);writeRecovery(a,io,a.scenario);
  advance(b.scenario,8);assert.equal(writeRecovery(b,io,b.scenario),false);assert.deepEqual(loadFacility(map.get(key)),a.scenario);
  assert.equal(openRecovery(null).writable,false);assert.equal(openRecovery(null).scenario.aisles.length,22);
});
