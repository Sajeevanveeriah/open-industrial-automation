import {scenario,summarise,replayRun,exportRun,assertPlant} from '../../engine.mjs';
export const channels={outputKgH:'Packed rate (kg/h)',packedKg:'Cumulative packed mass (kg)',wipKg:'In-process inventory (kg)',feedKgH:'Scheduled feed (kg/h)',fryC:'Fryer temperature (°C)',blanchC:'Blanch temperature (°C)',freezeC:'Freezer temperature (°C)',waterM3:'Water tank (m³)',powerKW:'Electric demand (kW)',activeAlarms:'Active alarms'};
const unitError=1e-4;
function ensure(condition,why){if(!condition)throw Error(why);}
function amount(v){ensure(Number.isFinite(v)&&v>0,'Enter a positive mass in kilograms.');return v;}
export function historyQuery(s,channel,start=0,end=s.time,deadband=0){
  ensure(Object.hasOwn(channels,channel),'Unknown historian channel.');
  ensure(Number.isFinite(start)&&Number.isFinite(end)&&start>=0&&end>=start&&end<=s.time,'Choose a window within the run.');
  ensure(Number.isFinite(deadband)&&deadband>=0,'Deadband must be non-negative.');
  const all=s.history.filter(h=>h.time>=start&&h.time<=end);
  let prior,previous;
  const result=[],gaps=[];
  for(const [i,h] of all.entries()){
    if(previous!==undefined&&h.time-previous>15)gaps.push({from:previous,to:h.time});
    const gap=previous!==undefined&&h.time-previous>15;
    if(i===0||i===all.length-1||gap||Math.abs(h[channel]-prior)>=deadband){result.push({time:h.time,value:h[channel]});prior=h[channel];}
    previous=h.time;
  }
  return {points:result,gaps,total:all.length,expected:Math.max(0,Math.floor(end/15)-Math.ceil(start/15)+1),lastAgeS:all.length?end-all.at(-1).time:null};
}
export function spc(values,baselineLength){
  ensure(Number.isInteger(baselineLength)&&baselineLength>=2&&baselineLength<values.length,'Select at least two baseline observations and one later measurement.');
  ensure(values.every(Number.isFinite),'Invalid measurement.');
  const baseline=values.slice(0,baselineLength),mean=baseline.reduce((a,b)=>a+b,0)/baseline.length;
  const sd=Math.sqrt(baseline.reduce((s,x)=>s+(x-mean)**2,0)/(baseline.length-1)),low=mean-3*sd,high=mean+3*sd;
  return {mean,sd,low,high,violations:values.flatMap((v,i)=>i>=baselineLength&&(v<low||v>high)?[i]:[])};
}
export function reliability(journal,until){
  const events=new Map();
  for(const item of journal){
    const incoming=item.type==='fault'||item.type==='estop',outgoing=item.type==='clearFault'||item.type==='releaseEstop';
    if(!incoming&&!outgoing)continue;
    const code=['estop','releaseEstop'].includes(item.type)?'estop':item.payload.id;
    if(!events.has(code)) events.set(code,{code,failures:0,repairs:0,restoredS:0,openAt:null});
    const row=events.get(code);
    if(incoming&&row.openAt===null){row.openAt=item.at;row.failures++;}
    if(outgoing&&row.openAt!==null){row.restoredS+=item.at-row.openAt;row.openAt=null;row.repairs++;}
  }
  return [...events.values()].map(r=>{
    const affectedS=r.restoredS+(r.openAt===null?0:until-r.openAt);
    return {...r,affectedS,mttr:r.repairs?r.restoredS/r.repairs:null,mtbf:r.failures?(until-affectedS)/r.failures:null};
  }).sort((a,b)=>b.affectedS-a.affectedS||a.code.localeCompare(b.code));
}
export function indicators(s){
  const summary=summarise(s),t=summary.productKg/1000;
  return {summary,idealKg:24000*s.uptime.runningS/3600,plannedS:s.uptime.plannedS,runningS:s.uptime.runningS,
    waterPerT:t?summary.waterM3/t:null,kWhPerT:t?summary.electricKWh/t:null,conservation:assertPlant(s)};
}
export function counterexample(){
  const end=scenario('pack-blockage'),before=replayRun(JSON.parse(exportRun(end)),2400);
  function row(s){
    const from=s.history.find(h=>h.time===s.time-600),to=s.history.find(h=>h.time===s.time);
    return {end:s.time,start:s.time-600,availability:summarise(s).availability,running:s.uptime.runningS,planned:s.uptime.plannedS,packed:to.packedKg-from.packedKg};
  }
  return [row(before),row(end)];
}
export function createLedger(lots){
  const nodes=lots.filter(l=>l.pendingKg+l.releasedKg>unitError).map(l=>{
    const kg=l.pendingKg+l.releasedKg;
    return {id:l.id,kg,remaining:kg,parents:[],raw:[l.rawLotId],hold:Boolean(l.recalled||l.holdReasons.length),kind:'reference inventory'};
  });
  return {initial:nodes.reduce((a,b)=>a+b.kg,0),nodes,operations:[],lossKg:0};
}
export function transform(ledger,{parents,output,loss,kind}){
  ensure(['Split','Rework','Recombine'].includes(kind),'Choose a material operation.');
  ensure(Array.isArray(parents)&&parents.length>=1&&parents.length<=2&&new Set(parents.map(p=>p.id)).size===parents.length,'Choose separate source lots.');
  ensure(kind==='Recombine'?parents.length===2:parents.length===1,'Source count does not match operation.');
  ensure(ledger.nodes.length<500,'Lot register limit reached.');
  ensure(typeof output==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(output)&&!ledger.nodes.some(n=>n.id===output),'Choose a unique child lot identifier.');
  const links=parents.map(p=>{
    const source=ledger.nodes.find(n=>n.id===p.id);
    ensure(source&&amount(p.kg)<=source.remaining,'Source inventory is insufficient.');
    return {source,kg:p.kg};
  });
  const inputKg=links.reduce((a,l)=>a+l.kg,0);
  ensure(Number.isFinite(loss)&&loss>=0&&loss<inputKg,'Loss must be non-negative and less than input mass.');
  ensure(kind!=='Split'||loss===0,'Splitting alone cannot consume mass.');
  const kg=inputKg-loss,raw=[...new Set(links.flatMap(l=>l.source.raw))];
  const child={id:output,kg,remaining:kg,parents:links.map(l=>({id:l.source.id,kg:l.kg})),raw,hold:links.some(l=>l.source.hold),kind};
  for(const link of links)link.source.remaining-=link.kg;
  ledger.nodes.push(child);ledger.lossKg+=loss;
  ledger.operations.push({kind,output,parents:child.parents,inputKg,kg,loss});
  return child;
}
export function balance(ledger){
  const inventory=ledger.nodes.reduce((a,n)=>a+n.remaining,0),residual=ledger.initial-inventory-ledger.lossKg;
  return {input:ledger.initial,inventory,loss:ledger.lossKg,residual,pass:Math.abs(residual)<=unitError};
}
export function traceLot(ledger,id){
  const node=ledger.nodes.find(n=>n.id===id);ensure(node,'Unknown lot.');
  const ancestors=new Set(),descendants=new Set([id]),queue=[node];
  while(queue.length){const current=queue.pop();for(const p of current.parents)if(!ancestors.has(p.id)){ancestors.add(p.id);queue.push(ledger.nodes.find(n=>n.id===p.id));}}
  for(const n of ledger.nodes)if(n.parents.some(p=>descendants.has(p.id)))descendants.add(n.id);
  descendants.delete(id);
  return {raw:node.raw,ancestors:[...ancestors],descendants:[...descendants],hold:node.hold};
}
