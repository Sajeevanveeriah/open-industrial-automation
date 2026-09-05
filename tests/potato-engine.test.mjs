import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlant, act, advance, summarise, assertPlant, exportRun, importRun, replayRun, scenario, tags, review, csv} from '../simulator/engine.mjs';
import {STAGES, RECIPES, FAULTS, SCENARIOS} from '../simulator/catalog.mjs';

const ok = (s, type, data = {}) => { const r = act(s, type, data); assert.equal(r.ok, true, `${type}: ${r.reason}`); return r; };
const no = (s, type, data = {}) => { const r = act(s, type, data); assert.equal(r.ok, false, `${type} must be refused`); assert.ok(r.reason); return r; };
function operating() {const s=createPlant(); ok(s,'start'); advance(s,2400); return s;}
function finished() {const s=operating(); ok(s,'drain'); advance(s,7200); assert.equal(s.mode,'STOPPED'); return s;}
function firstLot(s) {const l=s.finishedLots.find(x=>x.pendingKg>1); assert.ok(l,'finished lot required');return l;}

test('catalogue has unique equipment, product, fault and scenario identifiers',()=>{
 for(const list of [STAGES,RECIPES,FAULTS,SCENARIOS]) assert.equal(new Set(list.map(x=>x.id)).size,list.length);
 assert.ok(STAGES.length>=15); assert.ok(RECIPES.length>=4); assert.ok(FAULTS.length>=15);
});
test('cold start is stopped with zero fabricated throughput and conserved inventory',()=>{
 const s=createPlant(); assert.equal(s.mode,'STOPPED'); assert.equal(s.time,0); assert.equal(summarise(s).outputKgH,0); assertPlant(s);
});
test('seed and explicit clocks make independent plants identical',()=>{
 const a=createPlant({seed:73}),b=createPlant({seed:73});ok(a,'start');ok(b,'start');advance(a,3600);advance(b,3600);assert.deepEqual(a,b);
});
test('one-second integration is invariant to external batch size',()=>{
 const a=createPlant(),b=createPlant();ok(a,'start');ok(b,'start');advance(a,1800);for(let i=0;i<30;i++)advance(b,60);assert.deepEqual(a,b);
});
test('zero time is a no-op; invalid and excessive durations are rejected',()=>{
 const s=createPlant(),before=JSON.stringify(s);advance(s,0);assert.equal(JSON.stringify(s),before);
 for(const n of [-1,0.5,NaN,Infinity,86401]) assert.throws(()=>advance(s,n));
});
test('start requires warm-up; product cannot teleport to finished goods',()=>{
 const s=createPlant();ok(s,'start');assert.equal(s.mode,'STARTING');advance(s,30);assert.equal(s.finishedLots.length,0);assertPlant(s);
});
test('normal production traverses the entire train and creates traceable material',()=>{
 const s=operating();assert.equal(s.mode,'RUNNING');assert.ok(s.finishedLots.length>0);
 assert.ok(s.stages.every(x=>x.processedKg>0));assert.ok(s.finishedLots.every(x=>x.rawLotId&&x.orderId&&x.recipe));assertPlant(s);
});
test('all recipes can complete a campaign with conserved components',()=>{
 for(const recipe of RECIPES){const s=createPlant();ok(s,'selectRecipe',{id:recipe.id});ok(s,'start');advance(s,5400);if(['RUNNING','STARTING','HELD'].includes(s.mode))ok(s,'drain');advance(s,7200);assert.equal(s.mode,'STOPPED',recipe.id);assert.ok(s.finishedLots.length,recipe.id);assertPlant(s);}
});
test('recipe change with work in process is refused without mutating state',()=>{
 const s=operating(),id=s.activeRecipe;no(s,'selectRecipe',{id:'coated'});assert.equal(s.activeRecipe,id);assertPlant(s);
});
test('controlled drain stops feed and empties every queue without disappearing mass',()=>{
 const s=operating(),fed=s.ledger.rawFedKg;ok(s,'drain');advance(s,7200);assert.equal(s.ledger.rawFedKg,fed);assert.equal(s.mode,'STOPPED');assert.ok(s.stages.every(x=>x.massKg<1e-6));assertPlant(s);
});
test('hold retains material; resume is explicit',()=>{
 const s=operating(),before=s.ledger.rawFedKg;ok(s,'hold');advance(s,120);assert.equal(s.mode,'HELD');assert.equal(s.ledger.rawFedKg,before);assertPlant(s);ok(s,'resume');advance(s,60);assert.ok(s.ledger.rawFedKg>before);
});
test('emergency stop latches; clear cause and reset do not restart automatically',()=>{
 const s=operating();ok(s,'estop');advance(s,1);assert.equal(s.mode,'TRIPPED');no(s,'resume');no(s,'resetTrip');ok(s,'clearFault',{id:'estop'});ok(s,'resetTrip');assert.equal(s.mode,'HELD');ok(s,'resume');assert.equal(s.mode,'RUNNING');assertPlant(s);
});
test('every injected fault has an observable alarm and can be cleared',()=>{
 for(const fault of FAULTS){const s=operating();ok(s,'fault',{id:fault.id});advance(s,2);assert.ok(s.alarms.some(a=>a.code===fault.id&&a.active),fault.id);ok(s,'clearFault',{id:fault.id});advance(s,1);assert.ok(!s.faults.includes(fault.id),fault.id);assertPlant(s);}
});
test('packaging blockage increases upstream inventory, never exceeds buffer limits',()=>{
 const s=operating();ok(s,'fault',{id:'pack-film'});const before=s.ledger.packedKg;advance(s,1800);assert.equal(s.ledger.packedKg,before);assert.ok(s.stages.some(x=>x.status==='BLOCKED'));assertPlant(s);
});
test('starvation produces no invented material',()=>{
 const s=createPlant();for(const l of s.rawLots)l.grade='HOLD';no(s,'start');advance(s,3600);assert.equal(s.ledger.rawFedKg,0);assertPlant(s);
});
test('acknowledgement does not clear an active physical alarm',()=>{
 const s=operating();ok(s,'fault',{id:'conveyor-jam'});advance(s,1);const a=s.alarms.find(x=>x.code==='conveyor-jam'&&x.active);ok(s,'ack',{id:a.id});assert.equal(a.active,true);assert.notEqual(a.ackAt,null);ok(s,'clearFault',{id:'conveyor-jam'});advance(s,1);assert.equal(a.active,false);
});
test('unknown commands, roles, stages and nonfinite setpoints fail safely',()=>{
 const s=createPlant();no(s,'not-a-command');no(s,'role',{id:'root'});no(s,'speed',{id:'missing',value:1});
 for(const v of [NaN,Infinity,-999,1000,'175',null])no(s,'setpoint',{id:'fry',value:v});assertPlant(s);
});
test('bounded controls and PI tuning alter the actual model',()=>{
 const s=operating();ok(s,'feed',{value:18000});ok(s,'setpoint',{id:'fry',value:180});ok(s,'tune',{id:'fry',kp:2.5,ki:0.015});ok(s,'speed',{id:'cut',value:0.8});advance(s,1800);assert.equal(s.feedKgH,18000);assert.equal(s.loops.fry.sp,180);assert.equal(s.stages.find(x=>x.id==='cut').speed,0.8);assertPlant(s);
});
test('reviewer role cannot operate the simulated plant',()=>{
 const s=createPlant();ok(s,'role',{id:'reviewer'});no(s,'start');no(s,'fault',{id:'power-loss'});no(s,'setpoint',{id:'fry',value:180});ok(s,'role',{id:'instructor'});ok(s,'start');
});
test('sensor bias propagates into controller feedback and quality diagnostics',()=>{
 const s=operating();ok(s,'fault',{id:'sensor-drift'});advance(s,900);assert.ok(s.loops.blanch.measured-s.loops.blanch.pv>=9);assertPlant(s);
});
test('communications loss freezes gateway samples but local model continues',()=>{
 const s=operating(),before=s.ledger.rawFedKg;ok(s,'fault',{id:'comms-loss'});const a=tags(s);advance(s,90);const b=tags(s);assert.ok(s.ledger.rawFedKg>before);assert.deepEqual(a.map(t=>t.value),b.map(t=>t.value));assert.ok(b.every(t=>t.quality==='STALE'));no(s,'setpoint',{id:'fry',value:180});ok(s,'clearFault',{id:'comms-loss'});assert.ok(tags(s).every(t=>t.quality==='GOOD'));
});
test('receipt, sampled approval and rejection reconcile raw material inventory',()=>{
 const s=createPlant();ok(s,'receive',{kg:25000,dryMatter:21,sugar:0.12,source:'SIM-TEST'});const l=s.rawLots.at(-1);assert.equal(l.grade,'HOLD');ok(s,'approveRaw',{id:l.id});assert.equal(l.grade,'RELEASED');ok(s,'receive',{kg:10000,dryMatter:14,sugar:0.9,source:'SIM-BAD'});const bad=s.rawLots.at(-1);no(s,'approveRaw',{id:bad.id});ok(s,'rejectRaw',{id:bad.id});assert.equal(bad.kg,0);assertPlant(s);
});
test('invalid receipt cannot corrupt a plant',()=>{
 const s=createPlant(),before=JSON.stringify(s);no(s,'receive',{kg:-1,dryMatter:21,sugar:0.1,source:'x'});assert.equal(JSON.stringify(s),before);
});
test('finished goods require a passed sample and current detector challenge before release',()=>{
 const s=finished(),l=firstLot(s);no(s,'release',{id:l.id});ok(s,'sample',{id:l.id});ok(s,'challenge');const result=act(s,'release',{id:l.id});if(l.holdReasons.length){assert.equal(result.ok,false);}else{assert.equal(result.ok,true);assert.ok(l.releasedKg>0);}assertPlant(s);
});
test('dispatch cannot ship quarantine; release and dispatch conserve total material',()=>{
 const s=finished(),l=firstLot(s);no(s,'dispatch',{id:l.id,kg:100});ok(s,'sample',{id:l.id});ok(s,'challenge');
 assert.deepEqual(l.holdReasons,[]);{ok(s,'release',{id:l.id});const kg=Math.min(100,l.releasedKg);ok(s,'dispatch',{id:l.id,kg});assert.equal(l.shippedKg,kg);}assertPlant(s);
});
test('recall holds remaining stock and identifies previously shipped quantity',()=>{
 const s=finished(),l=firstLot(s);ok(s,'sample',{id:l.id});ok(s,'challenge');
 assert.deepEqual(l.holdReasons,[]);{ok(s,'release',{id:l.id});ok(s,'dispatch',{id:l.id,kg:100});ok(s,'recall',{id:l.rawLotId});assert.equal(l.releasedKg,0);assert.equal(l.recalled,true);assert.equal(l.shippedKg,100);no(s,'release',{id:l.id});}assertPlant(s);
});
test('rejecting a quarantined finished lot is a recorded mass disposition',()=>{
 const s=finished(),l=firstLot(s),kg=l.pendingKg;ok(s,'reject',{id:l.id});assert.equal(l.pendingKg,0);assert.equal(l.scrappedKg,kg);assertPlant(s);
});
test('maintenance isolation is refused while moving and repair requires isolation',()=>{
 const s=operating();no(s,'isolate',{id:'pack'});no(s,'repair',{id:'pack'});ok(s,'hold');ok(s,'isolate',{id:'pack'});ok(s,'repair',{id:'pack'});ok(s,'unisolate',{id:'pack'});assert.equal(s.stages.find(x=>x.id==='pack').isolated,false);assertPlant(s);
});
test('cleaning is interlocked against production and leaves traceable completion',()=>{
 const s=operating();no(s,'clean');ok(s,'drain');advance(s,12000);assert.equal(s.mode,'STOPPED');ok(s,'clean');advance(s,1200);assert.equal(s.clean.state,'CLEAN');assert.equal(s.mode,'STOPPED');assertPlant(s);
});
test('cleaning pauses on utility loss rather than claiming completion',()=>{
 const s=createPlant();ok(s,'clean');ok(s,'fault',{id:'water-low'});advance(s,1200);assert.notEqual(s.clean.state,'CLEAN');ok(s,'clearFault',{id:'water-low'});advance(s,1800);assert.equal(s.clean.state,'CLEAN');assertPlant(s);
});
test('ERP offline outbox retries and delivers idempotently after restoration',()=>{
 const s=createPlant();ok(s,'fault',{id:'erp-offline'});ok(s,'order',{recipe:'straight',rawKg:5000});advance(s,180);assert.ok(s.outbox.some(x=>x.status==='PENDING'));ok(s,'clearFault',{id:'erp-offline'});ok(s,'reconcile');const count=s.delivered.length;ok(s,'reconcile');assert.equal(s.delivered.length,count);assert.equal(new Set(s.delivered.map(x=>x.id)).size,count);
});
test('water, wastewater COD and material balances close over an eight-hour shift',()=>{
 const s=createPlant();ok(s,'start');advance(s,28800);const a=assertPlant(s);assert.ok(Math.abs(a.residualKg)<1e-4);assert.ok(Math.abs(a.waterResidualM3)<1e-6);assert.ok(Math.abs(a.codResidualKg)<1e-5);assert.ok(s.utilities.electricKWh>0);assert.ok(s.ww.treatedM3>0);
});
test('export and import reconstruct deterministic operating state, not arbitrary objects',()=>{
 const s=operating();ok(s,'feed',{value:22000});ok(s,'fault',{id:'conveyor-jam'});advance(s,180);ok(s,'clearFault',{id:'conveyor-jam'});advance(s,120);const r=importRun(exportRun(s));assert.deepEqual(r,s);assertPlant(r);
});
test('replay to an earlier clock is deterministic and leaves the present unchanged',()=>{
 const s=operating(),before=JSON.stringify(s),run=JSON.parse(exportRun(s));const r=replayRun(run,900);assert.equal(r.time,900);assert.equal(JSON.stringify(s),before);assert.deepEqual(r,replayRun(run,900));assertPlant(r);
});
test('invalid imports and future-format data are rejected, not silently accepted',()=>{
 for(const raw of ['{}','null','[]','not JSON',JSON.stringify({format:'potato-sim/99',seed:42,until:1,commands:[]})])assert.throws(()=>importRun(raw));
 const r=JSON.parse(exportRun(createPlant()));r.commands=[{at:0,type:'setpoint',payload:{id:'fry',value:99999}}];assert.throws(()=>importRun(JSON.stringify(r)));
});
test('all built-in scenarios produce a valid, replayable plant',()=>{
 for(const preset of SCENARIOS){const s=scenario(preset.id);assertPlant(s);const r=importRun(exportRun(s));assert.deepEqual(summarise(r),summarise(s),preset.id);}
});
test('tags are unique, dimensioned and derived from simulation state',()=>{
 const s=operating(),t=tags(s);assert.ok(t.length>=100);assert.equal(new Set(t.map(x=>x.id)).size,t.length);assert.ok(t.every(x=>x.unit&&x.type&&Number.isFinite(x.at)));assert.ok(t.some(x=>x.id==='FRY-901.TT.PV'));
});
test('review and CSV exports have real model data and provenance',()=>{
 const s=operating(),r=review(s);assert.equal(r.simulationOnly,true);assert.ok(r.sources.length>=3);assert.equal(r.summary.time,s.time);assert.ok(csv(s,'historian').startsWith('time_s,'));assert.ok(csv(s,'tags').includes('FRY-901.TT.PV'));assert.ok(csv(s,'genealogy').includes('raw_lot'));
});
test('bounded fault sequences retain invariants under adversarial operation',()=>{
 const s=operating();let seed=1023;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<90;i++){const f=FAULTS[Math.floor(random()*FAULTS.length)].id;act(s,'fault',{id:f});advance(s,1+Math.floor(random()*120));assertPlant(s);act(s,'clearFault',{id:f});if(s.mode==='TRIPPED')act(s,'resetTrip');if(s.mode==='HELD')act(s,'resume');advance(s,30);assertPlant(s);}
});


test('late quality hold identifies earlier shipments from the same finished lot',()=>{
 const s=operating(),l=firstLot(s);assert.deepEqual(l.holdReasons,[]);ok(s,'sample',{id:l.id});ok(s,'challenge');ok(s,'release',{id:l.id});ok(s,'dispatch',{id:l.id,kg:100});ok(s,'fault',{id:'metal-detect'});advance(s,120);assert.ok(l.holdReasons.length);assert.ok(s.shipments.every(x=>x.recallRequired));assert.equal(l.releasedKg,0);assertPlant(s);
});
test('invalid control identifiers do not mutate loops',()=>{
 const s=createPlant(),before=JSON.stringify(s.loops);no(s,'tune',{id:'unknown-loop',kp:2,ki:0.1});no(s,'setpoint',{id:'unknown-loop',value:80});assert.equal(JSON.stringify(s.loops),before);
});

test('Stop retains the active campaign and WIP; Start restarts it without new sanitation or allocation',()=>{
 const s=operating(),id=s.activeOrderId,wip=summarise(s).wipKg,fed=s.ledger.rawFedKg;
 ok(s,'stop');assert.equal(s.mode,'STOPPED');assert.ok(s.stages.every(x=>x.flowKgS===0));
 advance(s,600);assert.equal(s.ledger.rawFedKg,fed);assert.equal(summarise(s).wipKg,wip);
 ok(s,'start');assert.equal(s.activeOrderId,id);assert.equal(s.mode,'STARTING');advance(s,2400);assert.ok(s.ledger.rawFedKg>fed);assertPlant(s);
 assert.deepEqual(importRun(exportRun(s)),s);
});
test('Hold and Stop preserve drain intent and never restart raw feed',()=>{
 for(const command of ['hold','stop']){const s=operating();ok(s,'drain');advance(s,30);const fed=s.ledger.rawFedKg;ok(s,command);advance(s,60);ok(s,command==='hold'?'resume':'start');advance(s,7200);assert.equal(s.ledger.rawFedKg,fed);assert.equal(s.mode,'STOPPED');assertPlant(s);}
});
test('Resume during cold warm-up cannot bypass thermal readiness',()=>{
 const s=createPlant();ok(s,'start');advance(s,10);ok(s,'hold');ok(s,'resume');assert.equal(s.mode,'STARTING');advance(s,10);assert.equal(s.ledger.rawFedKg,0);
});
test('Stop cannot clear a trip; sanitation can be interrupted and restarted',()=>{
 const tripped=operating();ok(tripped,'estop');no(tripped,'stop');assert.equal(tripped.mode,'TRIPPED');
 const s=createPlant();ok(s,'clean');advance(s,30);ok(s,'stop');assert.equal(s.clean.state,'DIRTY');no(s,'start');ok(s,'clean');assert.equal(s.clean.elapsed,0);advance(s,1200);assert.equal(s.clean.state,'CLEAN');assertPlant(s);
});

test('a retained empty campaign cannot bypass interrupted sanitation',()=>{
 const s=createPlant();ok(s,'start');ok(s,'stop');ok(s,'clean');ok(s,'stop');no(s,'start');ok(s,'clean');advance(s,1200);ok(s,'start');assertPlant(s);
});

test('operator can release E-stop, reset, and resume without clearing other trip causes',()=>{
 for(const role of ['instructor','operator','engineer']){const s=operating();ok(s,'role',{id:role});ok(s,'estop');no(s,'resetTrip');ok(s,'releaseEstop');assert.equal(s.mode,'TRIPPED');assert.equal(s.faults.includes('estop'),false);ok(s,'resetTrip');assert.equal(s.mode,'HELD');ok(s,'resume');advance(s,60);assert.equal(s.mode,'RUNNING');assertPlant(s);assert.deepEqual(importRun(exportRun(s)),s);}
 const s=operating();ok(s,'fault',{id:'power-loss'});ok(s,'estop');ok(s,'releaseEstop');assert.ok(s.faults.includes('power-loss'));no(s,'resetTrip');assert.equal(s.mode,'TRIPPED');
});
