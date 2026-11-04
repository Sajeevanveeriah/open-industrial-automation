import test from 'node:test';
import assert from 'node:assert/strict';
import {createShift,currentGoal,locateStock,checkReservation,recordReservation,identifyTruck,diagnose,recoverRoute,dispatched,verifyReceipt,nextEvent,targetOrder,receipt,evidence,encodeShift,decodeShift} from '../simulator/workshop/studio/facility/shift-model.mjs';
import {act,totals} from '../simulator/workshop/studio/facility/facility-model.mjs';
function reserve(m){
 const t=m.ticket,args={bay:t.bay,sku:t.sku,door:t.door};
 locateStock(m,t.bay);checkReservation(m,args);act(m.floor,'order',args);recordReservation(m,m.floor.orders.at(-1));
}
function deliver(m){
 const o=targetOrder(m);
 for(let i=0;i<5&&o.status!=='staged';i++)nextEvent(m);
 assert.equal(o.status,'staged');act(m.floor,'dispatch',{order:o.id});dispatched(m);
 const r=receipt(m);verifyReceipt(m,{pallet:r.id,lot:r.lot,trailer:r.trailer});
}
test('dispatch shift requires correct inventory, dock, truck and unique trailer receipt after reopen',()=>{
 let m=createShift(),t=m.ticket;assert.equal(currentGoal(m),'locate');assert.equal(t.pallet,'PL-00157');
 assert.throws(()=>locateStock(m,'A01-L01'),/does not contain/);assert.equal(m.proof.length,0);
 locateStock(m,t.bay);assert.throws(()=>checkReservation(m,{bay:t.bay,sku:t.sku,door:'D01'}),/Wrong dispatch door/);
 const args={bay:t.bay,sku:t.sku,door:t.door};checkReservation(m,args);act(m.floor,'order',args);recordReservation(m,m.floor.orders.at(-1));nextEvent(m);
 const vehicle=targetOrder(m).vehicle;assert.equal(vehicle,'AMR-02');assert.throws(()=>identifyTruck(m,'AMR-08'),/different task/);identifyTruck(m,vehicle);
 m=decodeShift(encodeShift(m));assert.equal(currentGoal(m),'dispatch');deliver(m);
 const e=evidence(m,'Technician');assert.equal(e.profile,'Technician');assert.equal(e.receipt.trailer,'TR-02');assert.equal(e.proof.length,5);assert.equal(e.receipt.id,t.pallet);
 assert.throws(()=>act(m.floor,'dispatch',{order:m.order}),/Stage/);assert.equal(totals(m.floor).total,m.floor.initialCount);assert.equal(currentGoal(decodeShift(encodeShift(m))),'complete');
});
test('incident has two valid recoveries retaining the actual pallet and lot; incorrect diagnoses earn no objective',()=>{
 for(const route of ['repair','redirect']){
   const m=createShift('incident',7),o=targetOrder(m),original=o.door;assert.equal(m.floor.doors.find(d=>d.id===original).open,false);
   assert.throws(()=>diagnose(m,original,'truck'),/truck is healthy/);assert.equal(m.proof.length,0);
   diagnose(m,original,'door');assert.throws(()=>recoverRoute(m),/still closed/);
   if(route==='repair')act(m.floor,'door',{id:original,open:true});
   else act(m.floor,'redirect',{order:o.id,bay:o.bay,door:m.floor.doors.find(d=>d.open).id});
   recoverRoute(m);deliver(m);assert.equal(evidence(m,'Incident controller').proof.length,4);assert.equal(receipt(m).id,m.ticket.pallet);
   assert.equal(route==='repair',receipt(m).door===original);
 }
});
test('changed-seed independent assignments use stock and evidence from their own floor',()=>{
 const a=createShift('challenge',843),b=createShift('challenge',10991);assert.notEqual(a.ticket.pallet,b.ticket.pallet);
 for(const m of [a,b]){reserve(m);nextEvent(m);identifyTruck(m,targetOrder(m).vehicle);deliver(m);assert.equal(evidence(m,'Operator').kind,'challenge');}
 const d=encodeShift(a);d.seed=b.seed;assert.throws(()=>decodeShift(d),/Invalid saved shift evidence/);
});
