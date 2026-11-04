import {createFacility,advance,act,availableStock,saveFacility,loadFacility,totals,DT} from './facility-model.mjs';

export const roles={operator:'Dispatch operator',incident:'Incident controller',challenge:'Independent dispatch challenge'};
const required=(ok,message)=>{if(!ok)throw Error(message);};
const byId=(list,id)=>list.find(x=>x.id===id);
const gates={
  operator:['locate','reserve','identify','dispatch','verify'],
  incident:['diagnose','recover','dispatch','verify'],
  challenge:['locate','reserve','identify','dispatch','verify']
};
function candidates(floor){
  return floor.bays.flatMap(b=>availableStock(floor,b).map(p=>({bay:b.id,pallet:p.id,lot:p.lot,sku:p.sku})));
}
export function createShift(kind='operator',seed=7){
  required(Object.hasOwn(roles,kind)&&Number.isInteger(seed)&&seed>=0&&seed<=65535,'Unknown shift assignment.');
  const floor=createFacility(seed);
  act(floor,'auto',{enabled:false});
  let ticket,order=null;
  if(kind==='incident'){
    const moving=floor.vehicles.filter(v=>v.load&&v.task);
    const truck=moving[seed%moving.length],job=byId(floor.orders,truck.task);
    ticket={bay:job.bay,pallet:job.pallet,sku:job.sku,lot:job.lot,door:job.door};order=job.id;
    act(floor,'door',{id:job.door,open:false});
    for(let i=0;i<700&&!(truck.state==='waiting'&&['dock','stage'].includes(truck.route[0]?.kind));i++)advance(floor);
    required(truck.state==='waiting'&&!byId(floor.doors,job.door).open,'Unable to establish the dispatch incident.');
  }else{
    const stock=candidates(floor);ticket={...stock[(seed*113+41)%stock.length],door:floor.doors[(seed+2)%4].id};
  }
  return {floor,kind,seed,ticket,order,proof:[],feedback:'',attempts:0};
}
export const currentGoal=m=>gates[m.kind][m.proof.length]||'complete';
export const progress=m=>[m.proof.length,gates[m.kind].length];
export function targetOrder(m){return byId(m.floor.orders,m.order);}
export function receipt(m){
  const all=m.floor.doors.flatMap(d=>d.dispatched.filter(p=>p.order===m.order||p.id===m.ticket.pallet).map(p=>({...p,door:d.id,trailer:d.trailer})));
  return all.length===1?all[0]:null;
}
function prove(m,goal,asset,message){
  required(currentGoal(m)===goal,'Complete the current objective first.');
  m.proof.push({goal,asset,at:m.floor.tick,measurement:message});m.feedback=message;return message;
}
export function locateStock(m,bayId){
  const b=byId(m.floor.bays,bayId);required(b,'Inspect a rack bay first.');
  const p=availableStock(m.floor,b).find(p=>p.id===m.ticket.pallet&&p.sku===m.ticket.sku&&p.lot===m.ticket.lot);
  required(p,'This bay does not contain the requested available pallet. Compare its pallet ID and intake lot with the job ticket.');
  return prove(m,'locate',b.id,'Matched '+p.id+' and '+p.lot+' at '+b.id+'.');
}
export function checkReservation(m,args){
  required(currentGoal(m)==='reserve','Confirm the matching stock in its rack before releasing an order.');
  const t=m.ticket;required(args.sku===t.sku,'Product mismatch. The job calls for '+t.sku+'.');
  required(args.door===t.door,'Wrong dispatch door. The customer ticket specifies '+t.door+'.');
  const b=byId(m.floor.bays,args.bay);required(b&&availableStock(m.floor,b).find(p=>p.sku===args.sku)?.id===t.pallet,'Wrong source. Reserve the pallet and lot you confirmed in the rack.');
}
export function recordReservation(m,order){
  required(order.pallet===m.ticket.pallet&&order.sku===m.ticket.sku&&order.door===m.ticket.door,'Order allocation does not match the job.');
  m.order=order.id;return prove(m,'reserve',order.id,'Reserved '+order.pallet+' on '+order.id+' for '+order.door+'.');
}
export function identifyTruck(m,truckId){
  const order=targetOrder(m);required(order?.vehicle,'The order is queued. Advance to truck assignment.');
  required(truckId===order.vehicle,'This truck is assigned to a different task. Inspect '+order.id+' and compare its assigned vehicle.');
  required(order.journey.some(e=>e.step==='Assigned'&&e.asset===truckId),'The order has no matching vehicle assignment.');
  return prove(m,'identify',truckId,'Vehicle '+truckId+' matches the dispatch order.');
}
export function diagnose(m,selected,cause){
  const o=targetOrder(m),d=byId(m.floor.doors,o.door),v=byId(m.floor.vehicles,o.vehicle);
  required(selected===d.id,'Inspect the destination door listed on the delayed order.');
  required(!d.open&&v.load?.id===m.ticket.pallet&&!v.fault&&v.state==='waiting','Check the waiting vehicle, its retained load and destination availability.');
  required(cause==='door','The pallet is aboard and the truck is healthy. The destination door reports closed.');
  return prove(m,'diagnose',d.id,'Confirmed '+d.id+' closed while '+v.id+' retained '+v.load.id+'.');
}
export function recoverRoute(m){
  const o=targetOrder(m),d=byId(m.floor.doors,o.door);
  required(d.open,'The selected destination is still closed. Reopen it or redirect to an open door.');
  required(o.pallet===m.ticket.pallet&&o.lot===m.ticket.lot,'Recovery must retain the original pallet and lot.');
  return prove(m,'recover',d.id,'Restored an available path to '+d.id+' for '+o.pallet+'.');
}
export function dispatched(m){
  const o=targetOrder(m),r=receipt(m);
  required(r&&r.order===o.id&&r.id===m.ticket.pallet&&r.lot===m.ticket.lot&&r.door===o.door&&(m.kind==='incident'||r.door===m.ticket.door),'No unique matching dispatch receipt found.');
  return prove(m,'dispatch',o.id,'Dispatched '+r.id+' once at '+r.door+' on '+r.trailer+'.');
}
export function verifyReceipt(m,answer){
  const r=receipt(m),t=totals(m.floor);
  required(r&&answer.pallet===r.id,'Pallet ID does not match the dispatch register. Open the manifest and find the order ID.');
  required(answer.trailer===r.trailer,'Trailer mismatch. Use the destination trailer on the dispatch receipt.');
  required(answer.lot===r.lot,'Intake lot mismatch. Compare the original stock record with the manifest.');
  required(t.total===m.floor.initialCount,'Facility inventory is out of balance.');
  return prove(m,'verify',r.trailer,'Verified '+r.id+', '+r.lot+', '+r.trailer+' and one stock movement; '+t.total+' pallets reconcile.');
}
export function nextEvent(m){
  const o=targetOrder(m);required(o,'Reserve the job pallet first.');
  required(!['staged','dispatched'].includes(o.status),'The pallet is already at dispatch. Inspect its door or receipt.');
  const before=o.status,start=m.floor.tick;
  for(let i=0;i<1600&&o.status===before;i++)advance(m.floor);
  const elapsed=(m.floor.tick-start)*DT;
  return o.status!==before?o.id+' changed from '+before+' to '+o.status+' after '+elapsed+' simulated seconds.':'No movement after '+elapsed+' simulated seconds. Inspect the vehicle and door for a fault.';
}
export function evidence(m,profile){
  required(currentGoal(m)==='complete','Finish the observed objectives before recording completion.');
  return {version:1,profile,role:roles[m.kind],kind:m.kind,seed:m.seed,order:m.order,pallet:m.ticket.pallet,lot:m.ticket.lot,receipt:receipt(m),proof:structuredClone(m.proof),incorrectAttempts:m.attempts};
}
export function encodeShift(m){return {version:1,kind:m.kind,seed:m.seed,order:m.order,proof:m.proof,attempts:m.attempts,feedback:m.feedback,floor:JSON.parse(saveFacility(m.floor))};}
export function decodeShift(data){
  required(data?.version===1&&Number.isInteger(data.attempts)&&data.attempts>=0&&data.attempts<=1e6&&Array.isArray(data.proof),'Invalid saved shift.');
  const m=createShift(data.kind,data.seed),floor=loadFacility(JSON.stringify(data.floor));
  required(floor.seed===m.seed&&data.proof.length<=gates[m.kind].length&&data.proof.every((p,i)=>p.goal===gates[m.kind][i]&&Number.isInteger(p.at)&&p.at>=0&&p.at<=floor.tick&&typeof p.asset==='string'&&p.asset.length<=120&&typeof p.measurement==='string'&&p.measurement.length<500),'Invalid saved shift evidence.');
  const job=byId(floor.orders,data.order);
  required(data.order===null||job?.pallet===m.ticket.pallet&&job.lot===m.ticket.lot,'Saved order points at different stock.');
  Object.assign(m,{floor,order:data.order,proof:data.proof,attempts:data.attempts,feedback:typeof data.feedback==='string'?data.feedback.slice(0,500):''});
  if(currentGoal(m)==='complete')required(receipt(m)?.id===m.ticket.pallet,'Missing completion receipt.');
  return m;
}
