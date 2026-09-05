import {VERSION, LIMITS, STAGES, RECIPES, FAULTS, CLEAN_PHASES, SCENARIOS, SOURCES, ASSUMPTIONS} from './catalog.mjs';
import {COMPONENTS, clamp, mass, zeroComponents, addComponents, splitParcel, thermal, dwell, outputFactor, transformParcel, piStep} from './physics.mjs';

const copy = value => JSON.parse(JSON.stringify(value));
const finite = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const recipeFor = id => RECIPES.find(r => r.id === id);
const stageFor = (s,id) => s.stages.find(x => x.id === id);
const faultFor = id => FAULTS.find(x => x.id === id);
const has = (s,id) => s.faults.includes(id);
const wip = s => s.stages.reduce((n,x) => n + x.massKg,0);
const rawAvailable = s => s.rawLots.find(x => x.grade === 'RELEASED' && x.kg > 1e-6);
const queuedOrder = s => s.orders.find(x => x.status === 'QUEUED' && x.recipe === s.activeRecipe);
const activeOrder = s => s.orders.find(x => x.id === s.activeOrderId);
const no = reason => ({ok:false,reason});
const yes = reason => ({ok:true,reason});
const roles = ['instructor','operator','engineer','quality','maintenance','reviewer'];
const permissions = {
 operator:['start','hold','resume','drain','estop','resetTrip','ack','receive','order','selectRecipe','dispatch','reconcile'],
 engineer:['start','hold','resume','drain','estop','resetTrip','ack','feed','setpoint','tune','speed','selectRecipe','reconcile'],
 quality:['ack','sample','challenge','release','reject','approveRaw','rejectRaw','recall','hold','estop'],
 maintenance:['ack','hold','estop','isolate','unisolate','repair','clean','restock'],
 reviewer:[]
};
const commandNames = new Set(['role','start','hold','resume','drain','estop','resetTrip','ack','receive','order','selectRecipe','dispatch','reconcile','feed','setpoint','tune','speed','sample','challenge','release','reject','approveRaw','rejectRaw','recall','isolate','unisolate','repair','clean','restock','fault','clearFault']);

function event(s, kind, message, details = {}) {
  const item = {id:`EV-${++s.counters.event}`,at:s.time,kind,message,details};
  s.events.push(item);
  if (s.events.length > LIMITS.maxEvents) s.events.shift();
  return item;
}
function transmit(s, kind, payload) {
  const item = {id:`MSG-${++s.counters.message}`,at:s.time,kind,payload,status:'PENDING',attempts:0,lastAttempt:null};
  s.outbox.push(item);
  deliver(s,item);
}
function deliver(s,item) {
  if (item.status === 'DELIVERED') return;
  item.attempts += 1;
  item.lastAttempt = s.time;
  if (has(s,'erp-offline')) return;
  if (!s.delivered.some(x => x.id === item.id)) s.delivered.push({id:item.id,at:s.time,kind:item.kind});
  item.status = 'DELIVERED';
}
function alarm(s,code,condition,unit,severity,message) {
  let a = s.alarms.find(x => x.code === code && x.active);
  if (condition && !a) {
    a = {id:`AL-${++s.counters.alarm}`,code,unit,severity,message,active:true,firstAt:s.time,lastAt:s.time,ackAt:null,clearAt:null};
    s.alarms.push(a);
    event(s,'ALARM',message,{code,unit,severity});
  } else if (!condition && a) {
    a.active = false; a.clearAt = s.time; a.lastAt = s.time;
    event(s,'RETURN',`${code}: condition returned to normal`,{code});
  } else if (a) a.lastAt = s.time;
}
function setMode(s,next,reason) {
  if (s.mode === next) return;
  const previous = s.mode;
  s.mode = next;
  event(s,'STATE',`${previous} -> ${next}: ${reason}`);
}
function quarantineWIP(s,reason) {
  for (const stage of s.stages) for (const p of stage.queue) if (!p.holdReasons.includes(reason)) p.holdReasons.push(reason);
}
function updateAlarms(s) {
  for (const f of FAULTS) alarm(s,f.id,has(s,f.id),f.unit,f.severity,f.effect);
  alarm(s,'raw-starved',s.mode === 'RUNNING' && !rawAvailable(s),'intake','HIGH','No released raw material available');
  alarm(s,'water-tank-low',s.utilities.waterM3 < 5,'wash','HIGH','Process water inventory is low');
  alarm(s,'ww-level-high',s.ww.volumeM3 > 225,'wastewater','HIGH','Equalisation volume is constraining intake');
  alarm(s,'oil-low',s.stores.oilKg < 500,'fry','HIGH','Fresh-oil inventory is low');
  alarm(s,'film-low',s.stores.filmKg < 10,'pack','HIGH','Packaging-film inventory is low');
  alarm(s,'cold-store-high',s.warehouse.tempC > -18,'warehouse','HIGH','Cold-store temperature outside illustrative limit');
  alarm(s,'thermal-fry-high',s.loops.fry.pv > 200,'fry','TRIP','Model fryer high-high trip');
}

export function createPlant({seed = 42} = {}) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Seed must be an unsigned 32-bit integer');
  const r = recipeFor('straight');
  const loop = (sp, cooling, gain, tau, kW) => ({sp,pv:20,measured:20,output:0,error:sp-20,kp:2,ki:0.02,integral:0,cooling,gain,tau,kW});
  const rawLots = [
    {id:'SIM-VIC-001',source:'Synthetic Victorian lot',kg:80000,dryMatter:21,sugar:0.12,grade:'RELEASED',receivedAt:0},
    {id:'SIM-SA-002',source:'Synthetic South Australian lot',kg:60000,dryMatter:20.5,sugar:0.15,grade:'RELEASED',receivedAt:0},
    {id:'SIM-NSW-003',source:'Synthetic New South Wales lot',kg:60000,dryMatter:22,sugar:0.10,grade:'RELEASED',receivedAt:0}
  ];
  const s = {
    version:VERSION,seed,time:0,role:'instructor',mode:'STOPPED',activeRecipe:r.id,activeOrderId:null,feedKgH:30000,
    rawLots,finishedLots:[],shipments:[],faults:[],alarms:[],events:[],journal:[],history:[],outbox:[],delivered:[],jobs:[],gatewaySnapshot:null,
    orders:[{id:'SIM-ORDER-001',recipe:r.id,targetRawKg:40000,rawFedKg:0,producedKg:0,status:'QUEUED',createdAt:0}],
    stages:STAGES.map(x => ({...x,queue:[],massKg:0,speed:1,status:'STOPPED',flowKgS:0,processedKg:0,runningS:0,wear:0,isolated:false})),
    loops:{blanch:loop(r.blanchC,false,100,40,4000),fry:loop(r.fryC,false,210,65,6000),freeze:loop(r.freezeC,true,90,65,4500)},
    clean:{state:'CLEAN',phase:0,elapsed:0,lastCompleted:0,history:[],reason:'Initial synthetic clean state'},
    challenge:{at:null,passed:false},
    stores:{oilKg:16000,coatKg:10000,filmKg:2000,filmUsedKg:0},
    warehouse:{tempC:-22,capacityKg:250000},
    counters:{event:0,alarm:0,raw:3,order:1,lot:0,message:0,shipment:0,job:0},
    ledger:{initialRawKg:200000,receivedRawKg:0,rawFedKg:0,rawRejectedKg:0,oilAddedKg:0,coatAddedKg:0,waterAddedKg:0,vapourKg:0,packedKg:0,waste:zeroComponents(),initialOilKg:16000,initialCoatKg:10000,restockOilKg:0,restockCoatKg:0},
    utilities:{waterM3:150,waterInitialM3:150,waterSupplyM3:0,waterUsedM3:0,steamKPa:1200,airKPa:650,electricKWh:0,thermalKWh:0,refrigerationKWh:0,powerKW:0,thermalKW:0,waterRateM3H:0},
    ww:{volumeM3:40,initialM3:40,inM3:0,treatedM3:0,recoveryM3:0,dischargeM3:0,codKg:200,initialCodKg:200,codInKg:0,codRemovedKg:0,codOutKg:0,capacityM3:250,pHM:7.1},
    uptime:{plannedS:0,runningS:0,holdS:0,tripS:0},
    recent:{packedKg:0,at:0,outputKgH:0}
  };
  event(s,'INITIALISE','Independent potato-processing simulation initialised; all data synthetic');
  recordHistory(s);
  return s;
}

export function permissives(s) {
  return [
    {id:'trip',ok:!s.faults.some(id => faultFor(id)?.severity === 'TRIP') && s.loops.fry.pv <= 200,reason:'No active protective trip'},
    {id:'raw',ok:Boolean(rawAvailable(s)),reason:'At least one released raw lot'},
    {id:'order',ok:Boolean(activeOrder(s) || queuedOrder(s)),reason:'Compatible active or queued campaign'},
    {id:'water',ok:s.utilities.waterM3 >= 5 && !has(s,'water-low'),reason:'Process water available'},
    {id:'steam',ok:!has(s,'steam-low'),reason:'Steam supply available'},
    {id:'air',ok:!has(s,'air-low'),reason:'Compressed air available'},
    {id:'isolation',ok:s.stages.every(x => !x.isolated),reason:'All equipment released from maintenance isolation'},
    {id:'wastewater',ok:s.ww.volumeM3 < 235,reason:'Wastewater equalisation has capacity'},
    {id:'cold',ok:!has(s,'freezer-loss'),reason:'Refrigeration supply available'}
  ];
}
function validateCommand(s,type,p) {
  if (!commandNames.has(type)) return 'Unknown command';
  if (s.journal.length >= LIMITS.maxCommands) return 'This run has reached its 3,000-command boundary. Export it and start a new run.';
  if (!p || typeof p !== 'object' || Array.isArray(p)) return 'Command payload must be an object';
  if (type === 'role') return roles.includes(p.id) ? null : 'Unknown simulation role';
  if (s.role !== 'instructor' && !permissions[s.role]?.includes(type)) return `The ${s.role} simulation role cannot perform ${type}`;
  if (has(s,'comms-loss') && !['fault','clearFault','role','estop','reconcile'].includes(type)) return 'Supervisory gateway is unavailable; use the instructor to restore it';
  const st = stageFor(s,p.id), lot = s.finishedLots.find(x => x.id === p.id), raw = s.rawLots.find(x => x.id === p.id);
  switch (type) {
    case 'start': {
      if (s.mode !== 'STOPPED') return 'Start requires STOPPED';
      if (s.clean.state !== 'CLEAN') return 'Complete line sanitation before a new campaign';
      const bad = permissives(s).filter(x => !x.ok);
      return bad.length ? bad.map(x => x.reason).join('; ') : null;
    }
    case 'hold': return ['RUNNING','STARTING','DRAINING'].includes(s.mode) ? null : 'Hold requires a moving or starting line';
    case 'resume': {
      if (s.mode !== 'HELD') return 'Resume requires HELD, not a latched trip';
      const bad = permissives(s).filter(x => !x.ok && !['raw','order'].includes(x.id));
      return bad.length ? bad.map(x => x.reason).join('; ') : null;
    }
    case 'drain': return ['RUNNING','HELD','STARTING'].includes(s.mode) ? null : 'Drain requires an active or held campaign';
    case 'estop': return has(s,'estop') ? 'Emergency stop is already active' : null;
    case 'resetTrip': return s.mode !== 'TRIPPED' ? 'No latched trip to reset' : s.faults.some(id => faultFor(id)?.severity === 'TRIP') || s.loops.fry.pv > 200 ? 'Remove every trip cause and allow temperature to recover first' : null;
    case 'fault': return !faultFor(p.id) ? 'Unknown fault' : has(s,p.id) ? 'Fault already active' : null;
    case 'clearFault': return has(s,p.id) ? null : 'Fault is not active';
    case 'feed': return finite(p.value,1000,40000) ? null : 'Raw feed must be 1,000-40,000 kg/h';
    case 'setpoint': {const bounds={blanch:[60,95],fry:[155,195],freeze:[-45,-18]};return Object.hasOwn(bounds,p.id) && finite(p.value,...bounds[p.id]) ? null : 'Setpoint is outside its finite model range';}
    case 'tune': return Object.hasOwn(s.loops,p.id) && finite(p.kp,0,20) && finite(p.ki,0,1) ? null : 'PI gains require Kp 0-20 and Ki 0-1';
    case 'speed': return st && finite(p.value,0.5,1.2) ? null : 'Select equipment and a speed multiplier of 0.5-1.2';
    case 'selectRecipe': return !recipeFor(p.id) ? 'Unknown recipe' : s.mode !== 'STOPPED' || wip(s)>1e-6 ? 'Recipe changes require stopped, empty equipment' : null;
    case 'receive': return finite(p.kg,1000,50000) && finite(p.dryMatter,10,35) && finite(p.sugar,0,2) && typeof p.source === 'string' && p.source.trim().length > 0 && p.source.length <= 100 ? null : 'Receipt requires 1,000-50,000 kg, 10-35% dry matter, 0-2% sugar and a source label';
    case 'approveRaw': return !raw || raw.grade !== 'HOLD' ? 'Select a held raw lot' : raw.dryMatter < 18 || raw.dryMatter > 25 || raw.sugar > 0.35 ? 'Raw sample fails the illustrative specification' : null;
    case 'rejectRaw': return raw && raw.kg > 0 && raw.grade === 'HOLD' ? null : 'Only a held raw lot with remaining stock can be rejected';
    case 'order': return recipeFor(p.recipe) && finite(p.rawKg,1000,200000) && s.orders.length < 100 ? null : 'Campaign requires a known recipe and 1,000-200,000 kg raw allocation; maximum 100 orders';
    case 'sample': return lot && lot.pendingKg > 0 ? null : 'Select finished stock awaiting a quality decision';
    case 'challenge': return has(s,'metal-detect') ? 'Challenge failed while inspection fault is present' : null;
    case 'release':
      if (!lot || lot.pendingKg <= 0) return 'No pending stock in this lot';
      if (lot.recalled || lot.holdReasons.length) return 'Persistent quality hold requires rejection or a separately engineered investigation, not acknowledgement';
      if (!lot.sample?.passed || lot.sample.coveredKg + 1e-6 < lot.totalKg) return 'A passing sample must cover all material currently produced in this lot';
      if (!s.challenge.passed || s.challenge.at === null || s.time-s.challenge.at > 3600) return 'Perform a passing detector challenge within the last simulated hour';
      return s.warehouse.tempC <= -18 ? null : 'Cold store is outside the illustrative release window';
    case 'reject': return lot && lot.pendingKg > 0 ? null : 'No quarantined mass to reject';
    case 'dispatch': return !lot || lot.recalled || lot.holdReasons.length || s.warehouse.tempC > -18 ? 'Lot is not eligible for dispatch' : finite(p.kg,0.01,lot.releasedKg) ? null : 'Dispatch quantity must not exceed released stock';
    case 'recall': return s.rawLots.some(x=>x.id===p.id) ? null : 'Select a raw-lot identifier to trace and recall';
    case 'isolate': return !st ? 'Unknown equipment' : !['HELD','STOPPED','TRIPPED'].includes(s.mode) ? 'Stop motion before simulated isolation' : st.isolated ? 'Already isolated' : null;
    case 'unisolate': return st?.isolated ? null : 'Equipment is not isolated';
    case 'repair': return !st?.isolated ? 'Isolate equipment before maintenance' : s.loops[p.id]?.pv > 60 ? 'Wait for the hot system to cool below 60 deg C in this model' : null;
    case 'clean': return s.mode !== 'STOPPED' || wip(s)>1e-6 ? 'Sanitation requires a stopped, empty line' : s.loops.fry.pv > 60 ? 'Fryer must cool below 60 deg C before simulated inspection' : s.stages.some(x=>x.isolated) ? 'Release equipment isolation before automated sanitation' : null;
    case 'restock': return ['oilKg','coatKg','filmKg'].includes(p.id) && finite(p.kg,1,20000) ? null : 'Select a consumable and 1-20,000 kg';
    case 'ack': return s.alarms.some(x => x.id === p.id && x.ackAt === null) ? null : 'Alarm does not exist or is already acknowledged';
    case 'reconcile': return null;
    default: return 'Command not implemented';
  }
}

export function act(s,type,payload = {}) {
  const reason = validateCommand(s,type,payload);
  if (reason) return no(reason);
  const p = copy(payload);
  s.journal.push({at:s.time,type,payload:p});
  const st = stageFor(s,p.id), lot = s.finishedLots.find(x=>x.id===p.id), raw = s.rawLots.find(x=>x.id===p.id);
  switch(type) {
    case 'role': s.role=p.id; break;
    case 'start': s.activeOrderId=queuedOrder(s).id;activeOrder(s).status='ACTIVE';setMode(s,'STARTING','Warm-up sequence requested');break;
    case 'hold': setMode(s,'HELD','Operator hold');break;
    case 'resume': setMode(s,activeOrder(s)?.rawFedKg < activeOrder(s)?.targetRawKg ? 'RUNNING':'DRAINING','Explicit operator resume');break;
    case 'drain': setMode(s,'DRAINING','Raw feed disabled; retain and drain in-process material');break;
    case 'estop': s.faults.push('estop');setMode(s,'TRIPPED','Emergency stop latched');quarantineWIP(s,'Protective shutdown review hold');break;
    case 'resetTrip': setMode(s,'HELD','Trip reset; restart remains manual');break;
    case 'fault':
      if(p.id==='comms-loss')s.gatewaySnapshot=liveTags(s);
      s.faults.push(p.id);
      if(p.id==='fryer-overtemp')s.loops.fry.pv=205;
      if(faultFor(p.id).severity==='TRIP'){setMode(s,'TRIPPED',p.id);quarantineWIP(s,'Protective shutdown review hold');}
      break;
    case 'clearFault':s.faults=s.faults.filter(x=>x!==p.id);if(p.id==='comms-loss')s.gatewaySnapshot=null;break;
    case 'feed':s.feedKgH=p.value;break;
    case 'setpoint':s.loops[p.id].sp=p.value;break;
    case 'tune':s.loops[p.id].kp=p.kp;s.loops[p.id].ki=p.ki;break;
    case 'speed':st.speed=p.value;break;
    case 'selectRecipe': {
      s.activeRecipe=p.id;const r=recipeFor(p.id);
      s.loops.blanch.sp=r.blanchC;s.loops.fry.sp=r.fryC;s.loops.freeze.sp=r.freezeC;
      const pending=s.orders.find(x=>x.status==='QUEUED');if(pending)pending.recipe=p.id;
      break;
    }
    case 'receive': {
      const r={id:`SIM-RAW-${String(++s.counters.raw).padStart(3,'0')}`,source:p.source.trim(),kg:p.kg,dryMatter:p.dryMatter,sugar:p.sugar,grade:'HOLD',receivedAt:s.time};
      s.rawLots.push(r);s.ledger.receivedRawKg+=p.kg;transmit(s,'RECEIPT',{id:r.id,kg:p.kg});break;
    }
    case 'approveRaw':raw.grade='RELEASED';break;
    case 'rejectRaw':s.ledger.rawRejectedKg+=raw.kg;raw.kg=0;raw.grade='REJECTED';break;
    case 'order': {
      const o={id:`SIM-ORDER-${String(++s.counters.order).padStart(3,'0')}`,recipe:p.recipe,targetRawKg:p.rawKg,rawFedKg:0,producedKg:0,status:'QUEUED',createdAt:s.time};
      s.orders.push(o);transmit(s,'ORDER',{id:o.id,recipe:p.recipe,rawKg:p.rawKg});break;
    }
    case 'sample':lot.sample={at:s.time,coveredKg:lot.totalKg,passed:!lot.holdReasons.length&&!lot.recalled&&lot.maxCoreC<=-18,coreC:lot.maxCoreC,oilPercent:lot.totalKg?lot.components.oil/lot.totalKg*100:0};break;
    case 'challenge':s.challenge={at:s.time,passed:true};break;
    case 'release':lot.releasedKg+=lot.pendingKg;lot.pendingKg=0;transmit(s,'QUALITY_RELEASE',{id:lot.id,kg:lot.releasedKg});break;
    case 'reject':lot.scrappedKg+=lot.pendingKg;lot.pendingKg=0;break;
    case 'dispatch': {
      lot.releasedKg-=p.kg;lot.shippedKg+=p.kg;
      const shipment={id:`SIM-SHIP-${++s.counters.shipment}`,lotId:lot.id,rawLotId:lot.rawLotId,kg:p.kg,at:s.time,recallRequired:false};
      s.shipments.push(shipment);transmit(s,'DISPATCH',shipment);break;
    }
    case 'recall': {
      const r=s.rawLots.find(x=>x.id===p.id);r.grade='HOLD';
      for(const x of s.finishedLots.filter(x=>x.rawLotId===p.id)){x.recalled=true;x.pendingKg+=x.releasedKg;x.releasedKg=0;if(!x.holdReasons.includes('Raw-lot recall'))x.holdReasons.push('Raw-lot recall');}
      for(const x of s.shipments.filter(x=>x.rawLotId===p.id))x.recallRequired=true;
      for(const x of s.stages)for(const item of x.queue)if(item.rawLotId===p.id&&!item.holdReasons.includes('Raw-lot recall'))item.holdReasons.push('Raw-lot recall');
      transmit(s,'RECALL',{rawLotId:p.id});break;
    }
    case 'isolate':st.isolated=true;break;
    case 'unisolate':st.isolated=false;break;
    case 'repair': {
      st.wear=0;s.jobs.push({id:`WO-${++s.counters.job}`,equipment:st.id,at:s.time,state:'COMPLETE',action:'Simulated isolated inspection and repair',retainedMaterialKg:st.massKg});
      const relevant=FAULTS.filter(f=>f.unit===st.id&&!['TRIP'].includes(f.severity)).map(f=>f.id);
      s.faults=s.faults.filter(id=>!relevant.includes(id));
      break;
    }
    case 'clean':s.clean.state='IN_PROGRESS';s.clean.phase=0;s.clean.elapsed=0;s.clean.reason='Sanitation sequence active';setMode(s,'CLEANING','Wet and dry zones separated');break;
    case 'restock':s.stores[p.id]+=p.kg;if(p.id==='oilKg')s.ledger.restockOilKg+=p.kg;if(p.id==='coatKg')s.ledger.restockCoatKg+=p.kg;break;
    case 'ack':s.alarms.find(x=>x.id===p.id).ackAt=s.time;break;
    case 'reconcile':for(const item of s.outbox)deliver(s,item);break;
  }
  event(s,'COMMAND',`${type} (${s.role})`,p);
  updateAlarms(s);
  return yes(`${type} applied at ${s.time} s`);
}

function nextPacket(s,stage,packet) {
  const r=recipeFor(packet.recipe);
  packet.entered=s.time;packet.ready=s.time+dwell(stage,r);
  stage.queue.push(packet);stage.massKg+=mass(packet);
}
function finishedPacket(s,p) {
  const kg=mass(p),key=`${p.orderId}/${p.rawLotId}/${p.recipe}`;
  let lot=s.finishedLots.find(x=>x.key===key);
  if(!lot){
    lot={id:`SIM-FG-${String(++s.counters.lot).padStart(4,'0')}`,key,rawLotId:p.rawLotId,orderId:p.orderId,recipe:p.recipe,totalKg:0,pendingKg:0,releasedKg:0,shippedKg:0,scrappedKg:0,components:zeroComponents(),holdReasons:[],sample:null,recalled:false,firstAt:s.time,lastAt:s.time,maxCoreC:p.tempC};
    s.finishedLots.push(lot);transmit(s,'LOT_CREATED',{id:lot.id,rawLotId:p.rawLotId,orderId:p.orderId});
  }
  lot.totalKg+=kg;lot.pendingKg+=kg;addComponents(lot.components,p);lot.lastAt=s.time;lot.maxCoreC=Math.max(lot.maxCoreC,p.tempC);
  const previouslyHeld=lot.holdReasons.length>0;
  for(const reason of p.holdReasons)if(!lot.holdReasons.includes(reason))lot.holdReasons.push(reason);
  if(!previouslyHeld&&lot.holdReasons.length){
    for(const shipment of s.shipments.filter(x=>x.lotId===lot.id))shipment.recallRequired=true;
    event(s,'QUALITY','Finished-lot hold applies to all related stock and shipments',{lotId:lot.id});
  }
  if(lot.holdReasons.length&&lot.releasedKg>0){lot.pendingKg+=lot.releasedKg;lot.releasedKg=0;}
  s.orders.find(x=>x.id===p.orderId).producedKg+=kg;
}
function stageBlocked(s,st) {
  if(st.isolated)return 'ISOLATED';
  const ids={wash:['water-low'],peel:['steam-low'],cut:['conveyor-jam'],pack:['pack-film','air-low']};
  if((ids[st.id]||[]).some(id=>has(s,id)))return 'FAULT';
  if(st.id==='wash'&&(s.utilities.waterM3<1||s.ww.volumeM3>245))return 'UTILITY';
  if(st.id==='fry'&&s.stores.oilKg<1)return 'CONSUMABLE';
  if(st.id==='coat'&&recipeFor(s.activeRecipe).coatFraction&&s.stores.coatKg<1)return 'CONSUMABLE';
  if(st.id==='pack'&&s.stores.filmKg<0.01)return 'CONSUMABLE';
  if(st.id==='freeze'&&s.loops.freeze.pv>-18)return 'TEMPERATURE';
  return null;
}
function processStages(s) {
  for(const st of s.stages){st.flowKgS=0;st.status=st.isolated?'ISOLATED':s.mode;}
  if(!['RUNNING','DRAINING'].includes(s.mode))return;
  for(let i=s.stages.length-1;i>=0;i--){
    const st=s.stages[i],next=s.stages[i+1],blocked=stageBlocked(s,st);
    if(blocked){st.status=blocked;continue;}
    if(!st.queue.length){st.status='STARVED';continue;}
    st.status='RESIDENCE';
    let capacity=st.capacityKgH*st.speed/3600;
    while(capacity>1e-8&&st.queue.length){
      const packet=st.queue[0];
      if(packet.ready>s.time)break;
      const r=recipeFor(packet.recipe),factor=outputFactor(st.id,r,s.faults);
      const availableSpace=next?Math.max(0,next.bufferKg-next.massKg):Math.max(0,s.warehouse.capacityKg-s.finishedLots.reduce((n,l)=>n+l.pendingKg+l.releasedKg,0));
      let kg=Math.min(mass(packet),capacity,availableSpace/factor);
      if(st.id==='blanch')kg=Math.min(kg,s.utilities.waterM3*1000/0.015);
      if(st.id==='fry')kg=Math.min(kg,s.stores.oilKg/0.04);
      if(st.id==='coat'&&r.coatFraction)kg=Math.min(kg,s.stores.coatKg/r.coatFraction);
      if(st.id==='pack')kg=Math.min(kg,s.stores.filmKg/0.003);
      if(kg<=1e-8){st.status='BLOCKED';break;}
      const part=splitParcel(packet,kg),result=transformParcel(part,st,r,s.loops,s.faults,s.time);
      const out=result.parcel;
      st.massKg-=kg;capacity-=kg;st.processedKg+=kg;st.flowKgS+=kg;st.status='RUNNING';
      if(mass(packet)<1e-8){st.massKg-=mass(packet);st.queue.shift();}
      addComponents(s.ledger.waste,result.waste);s.ledger.vapourKg+=result.vapourKg;
      s.stores.oilKg-=result.additions.oil;s.stores.coatKg-=result.additions.coat;
      s.ledger.oilAddedKg+=result.additions.oil;s.ledger.coatAddedKg+=result.additions.coat;s.ledger.waterAddedKg+=result.additions.water;
      const uptakeM3=result.additions.water/1000;s.utilities.waterM3-=uptakeM3;s.utilities.waterUsedM3+=uptakeM3;
      if(st.id==='pack'){const film=kg*0.003;s.stores.filmKg-=film;s.stores.filmUsedKg+=film;s.ledger.packedKg+=kg;}
      if(next)nextPacket(s,next,out);else finishedPacket(s,out);
    }
    if(st.flowKgS>0){st.runningS++;st.wear=clamp(st.wear+st.flowKgS/st.capacityKgH/12,0,100);}
  }
}
function feed(s) {
  if(s.mode!=='RUNNING')return;
  let order=activeOrder(s);
  if(!order)return;
  if(order.rawFedKg>=order.targetRawKg-1e-6){
    const next=queuedOrder(s);
    if(next){order.status='DRAINING';s.activeOrderId=next.id;next.status='ACTIVE';order=next;}
    else {setMode(s,'DRAINING','Campaign raw allocation completed');return;}
  }
  if(s.ww.volumeM3>235||s.utilities.waterM3<5||has(s,'water-low')||has(s,'steam-low')||has(s,'freezer-loss')||s.stages.some(x=>x.isolated))return;
  const raw=rawAvailable(s),st=s.stages[0];if(!raw)return;
  const kg=Math.min(s.feedKgH/3600,st.capacityKgH*st.speed/3600,Math.max(0,st.bufferKg-st.massKg),raw.kg,order.targetRawKg-order.rawFedKg);
  if(kg<=1e-8)return;
  const p={water:kg*(1-raw.dryMatter/100),dry:kg*raw.dryMatter/100,oil:0,coat:0,tempC:15,rawLotId:raw.id,orderId:order.id,recipe:order.recipe,sugar:raw.sugar,holdReasons:[],entered:s.time,ready:0};
  raw.kg-=kg;order.rawFedKg+=kg;s.ledger.rawFedKg+=kg;s.clean.state='DIRTY';nextPacket(s,st,p);
}
function utilityStep(s) {
  const powered=!has(s,'power-loss');
  const active=['STARTING','RUNNING','HELD','DRAINING'].includes(s.mode);
  const heat=powered&&active&&!['fire-trip','fryer-overtemp'].some(id=>has(s,id));
  const u=s.utilities;
  u.steamKPa=thermal(u.steamKPa,has(s,'steam-low')||!powered?300:1200,1,8);
  u.airKPa=thermal(u.airKPa,has(s,'air-low')||!powered?150:650,1,8);
  const blanchLoad=stageFor(s,'blanch').flowKgS*3600/33000*12;
  const fryLoad=stageFor(s,'fry').flowKgS*3600/28000*18;
  const freezeLoad=stageFor(s,'freeze').flowKgS*3600/26000*12;
  piStep(s.loops.blanch,{enabled:heat,capacity:has(s,'steam-low')?0.1:1,load:blanchLoad,bias:has(s,'sensor-drift')?12:0});
  piStep(s.loops.fry,{enabled:heat,capacity:1,load:fryLoad});
  piStep(s.loops.freeze,{enabled:powered&&active,capacity:has(s,'freezer-loss')?0:1,load:freezeLoad});
  const cleaningWater=s.mode==='CLEANING'?(CLEAN_PHASES[s.clean.phase]?.waterM3H||0)/3600:0;
  const washDemand=stageFor(s,'wash').flowKgS*0.0018;
  // Treatment is a separate conserved volume and COD balance, not a display-only utility.
  const requested=powered&&!has(s,'water-low')?(washDemand+cleaningWater):0;
  const use=Math.min(requested,u.waterM3,Math.max(0,(s.ww.capacityM3-s.ww.volumeM3)/0.9));
  u.waterM3-=use;u.waterUsedM3+=use;u.waterRateM3H=use*3600;
  const incoming=use*0.9,cod=incoming*3;
  s.ww.volumeM3+=incoming;s.ww.inM3+=incoming;s.ww.codKg+=cod;s.ww.codInKg+=cod;
  const replenishment=powered&&!has(s,'water-low')?Math.min(100/3600,Math.max(0,150-u.waterM3)):0;
  u.waterM3+=replenishment;u.waterSupplyM3+=replenishment;
  const treated=powered&&!has(s,'wastewater-high')?Math.min(s.ww.volumeM3,90/3600):0;
  const codDraw=s.ww.volumeM3>0?s.ww.codKg*treated/s.ww.volumeM3:0;
  s.ww.volumeM3-=treated;s.ww.treatedM3+=treated;s.ww.recoveryM3+=treated*0.65;s.ww.dischargeM3+=treated*0.35;
  s.ww.codKg-=codDraw;s.ww.codRemovedKg+=codDraw*0.92;s.ww.codOutKg+=codDraw*0.08;
  s.ww.pHM=thermal(s.ww.pHM,s.mode==='CLEANING'?7.7:7.1,1,300);
  const heatKW=s.loops.blanch.output/100*s.loops.blanch.kW+s.loops.fry.output/100*s.loops.fry.kW;
  const refrigerationKW=s.loops.freeze.output/100*s.loops.freeze.kW/3;
  const motorKW=powered?s.stages.reduce((n,x)=>n+(x.status==='RUNNING'?x.kW*x.speed**3:x.status==='RESIDENCE'?x.kW*0.25:0),0):0;
  u.thermalKW=heatKW;u.powerKW=motorKW+refrigerationKW+(powered?120:0);
  u.thermalKWh+=heatKW/3600;u.refrigerationKWh+=refrigerationKW/3600;u.electricKWh+=u.powerKW/3600;
  s.warehouse.tempC=thermal(s.warehouse.tempC,!powered||has(s,'warehouse-warm')?20:-22,1,1800);
  if(s.warehouse.tempC>-18){
    for(const lot of s.finishedLots){
      if(lot.pendingKg+lot.releasedKg<=0)continue;
      if(!lot.holdReasons.includes('Cold-store excursion'))lot.holdReasons.push('Cold-store excursion');
      lot.pendingKg+=lot.releasedKg;lot.releasedKg=0;
    }
  }
}
function sanitationStep(s) {
  if(s.mode!=='CLEANING')return;
  const phase=CLEAN_PHASES[s.clean.phase];
  const ready=!has(s,'power-loss')&&!has(s,'water-low')&&!has(s,'steam-low')&&s.utilities.waterM3>5&&s.ww.volumeM3<235;
  s.clean.reason=ready?phase.method:'Paused: restore utilities and wastewater capacity';
  if(!ready)return;
  s.clean.elapsed++;
  if(s.clean.elapsed>=phase.durationS){
    s.clean.history.push({at:s.time,phase:phase.name,result:'SIMULATED PASS'});s.clean.elapsed=0;s.clean.phase++;
    if(s.clean.phase===CLEAN_PHASES.length){s.clean.state='CLEAN';s.clean.lastCompleted=s.time;s.clean.reason='All simulated sanitation stages completed';setMode(s,'STOPPED','Sanitation completed');}
  }
}
function tick(s) {
  s.time++;
  utilityStep(s);
  if(s.loops.fry.pv>200&&s.mode!=='TRIPPED'){setMode(s,'TRIPPED','Fryer high-high temperature');quarantineWIP(s,'Protective shutdown review hold');}
  if(s.mode==='STARTING'&&Math.abs(s.loops.blanch.pv-s.loops.blanch.sp)<4&&Math.abs(s.loops.fry.pv-s.loops.fry.sp)<4&&Math.abs(s.loops.freeze.pv-s.loops.freeze.sp)<4)setMode(s,'RUNNING','Thermal systems ready');
  processStages(s);feed(s);sanitationStep(s);
  if(s.mode==='DRAINING'&&wip(s)<1e-6){
    const order=activeOrder(s);if(order)order.status=order.rawFedKg>=order.targetRawKg-1e-6?'COMPLETE':'STOPPED_EARLY';
    s.activeOrderId=null;setMode(s,'STOPPED','All work in process drained');
  }
  for(const o of s.orders.filter(x=>x.status==='DRAINING'))if(!s.stages.some(st=>st.queue.some(p=>p.orderId===o.id)))o.status='COMPLETE';
  if(['STARTING','RUNNING','HELD','DRAINING','TRIPPED'].includes(s.mode))s.uptime.plannedS++;
  if(s.mode==='RUNNING'||s.mode==='DRAINING')s.uptime.runningS++;
  if(s.mode==='HELD')s.uptime.holdS++;
  if(s.mode==='TRIPPED')s.uptime.tripS++;
  if(s.time%60===0){for(const item of s.outbox)if(item.status==='PENDING')deliver(s,item);}
  updateAlarms(s);
  if(s.time%LIMITS.historySeconds===0)recordHistory(s);
}
export function advance(s,seconds) {
  if(!Number.isInteger(seconds)||seconds<0||seconds>LIMITS.maxSeconds||s.time+seconds>LIMITS.maxSeconds)throw new RangeError('Advance requires whole seconds within a 24-hour simulation');
  for(let i=0;i<seconds;i++)tick(s);
  return s;
}
function recordHistory(s) {
  const dt=s.time-s.recent.at;
  if(dt>0)s.recent.outputKgH=(s.ledger.packedKg-s.recent.packedKg)*3600/dt;
  s.recent.at=s.time;s.recent.packedKg=s.ledger.packedKg;
  s.history.push({time:s.time,mode:s.mode,feedKgH:s.mode==='RUNNING'?s.feedKgH:0,outputKgH:s.recent.outputKgH,wipKg:wip(s),packedKg:s.ledger.packedKg,blanchC:s.loops.blanch.pv,fryC:s.loops.fry.pv,freezeC:s.loops.freeze.pv,waterM3:s.utilities.waterM3,wwM3:s.ww.volumeM3,powerKW:s.utilities.powerKW,activeAlarms:s.alarms.filter(x=>x.active).length});
}
export function summarise(s) {
  const rawKg=s.rawLots.reduce((n,x)=>n+x.kg,0),productKg=s.finishedLots.reduce((n,x)=>n+x.totalKg,0);
  const pendingKg=s.finishedLots.reduce((n,x)=>n+x.pendingKg,0),releasedKg=s.finishedLots.reduce((n,x)=>n+x.releasedKg,0),shippedKg=s.finishedLots.reduce((n,x)=>n+x.shippedKg,0);
  const goodKg=s.finishedLots.filter(x=>!x.holdReasons.length&&!x.recalled).reduce((n,x)=>n+x.totalKg,0);
  const availability=s.uptime.plannedS?s.uptime.runningS/s.uptime.plannedS:0;
  const performance=s.uptime.runningS?clamp(s.ledger.packedKg/(24000*s.uptime.runningS/3600),0,1):0;
  const quality=productKg?goodKg/productKg:0;
  return {time:s.time,mode:s.mode,recipe:s.activeRecipe,rawKg,wipKg:wip(s),productKg,pendingKg,releasedKg,shippedKg,rawFedKg:s.ledger.rawFedKg,outputKgH:s.recent.outputKgH,yield:s.ledger.rawFedKg?productKg/s.ledger.rawFedKg:0,availability,performance,quality,oee:availability*performance*quality,electricKWh:s.utilities.electricKWh,thermalKWh:s.utilities.thermalKWh,waterM3:s.utilities.waterUsedM3,wasteKg:mass(s.ledger.waste)+s.ledger.rawRejectedKg,vapourKg:s.ledger.vapourKg,activeAlarms:s.alarms.filter(x=>x.active).length,unacknowledged:s.alarms.filter(x=>x.active&&x.ackAt===null).length};
}
export function assertPlant(s) {
  const problems=[];
  const nonnegative=(label,n)=>{if(!Number.isFinite(n)||n < -1e-5)problems.push(`${label}: ${n}`);};
  for(const st of s.stages){
    nonnegative(st.id,st.massKg);
    if(st.massKg>st.bufferKg+1e-5)problems.push(`${st.id}: buffer exceeded`);
    const sum=st.queue.reduce((n,p)=>n+mass(p),0);
    if(Math.abs(sum-st.massKg)>1e-5)problems.push(`${st.id}: queue accounting mismatch`);
    for(const p of st.queue){for(const k of COMPONENTS)nonnegative(`${st.id}.${k}`,p[k]);if(!Number.isFinite(p.tempC))problems.push(`${st.id}: nonfinite temperature`);}
  }
  for(const lot of s.finishedLots){
    for(const k of ['pendingKg','releasedKg','shippedKg','scrappedKg'])nonnegative(`${lot.id}.${k}`,lot[k]);
    if(Math.abs(lot.totalKg-lot.pendingKg-lot.releasedKg-lot.shippedKg-lot.scrappedKg)>1e-5)problems.push(`${lot.id}: disposition imbalance`);
    if(Math.abs(lot.totalKg-mass(lot.components))>1e-5)problems.push(`${lot.id}: component imbalance`);
  }
  for(const lot of s.rawLots)nonnegative(lot.id,lot.kg);
  for(const [key,l] of Object.entries(s.loops))for(const field of ['pv','sp','measured','output','integral'])if(!Number.isFinite(l[field]))problems.push(`${key}.${field}: nonfinite`);
  for(const [key,n] of Object.entries(s.stores))nonnegative(key,n);
  const L=s.ledger,u=s.utilities,ww=s.ww;
  const raw=s.rawLots.reduce((n,x)=>n+x.kg,0),product=s.finishedLots.reduce((n,x)=>n+x.totalKg,0);
  const residualKg=L.initialRawKg+L.receivedRawKg+L.oilAddedKg+L.coatAddedKg+L.waterAddedKg-raw-wip(s)-product-mass(L.waste)-L.rawRejectedKg-L.vapourKg;
  const waterResidualM3=u.waterInitialM3+u.waterSupplyM3-u.waterUsedM3-u.waterM3;
  const wwResidualM3=ww.initialM3+ww.inM3-ww.treatedM3-ww.volumeM3;
  const codResidualKg=ww.initialCodKg+ww.codInKg-ww.codRemovedKg-ww.codOutKg-ww.codKg;
  const oilResidualKg=L.initialOilKg+L.restockOilKg-L.oilAddedKg-s.stores.oilKg;
  const coatResidualKg=L.initialCoatKg+L.restockCoatKg-L.coatAddedKg-s.stores.coatKg;
  for(const [name,value] of Object.entries({residualKg,waterResidualM3,wwResidualM3,codResidualKg,oilResidualKg,coatResidualKg}))if(!Number.isFinite(value)||Math.abs(value)>1e-4)problems.push(`${name}: ${value}`);
  nonnegative('water',u.waterM3);nonnegative('wastewater',ww.volumeM3);nonnegative('COD',ww.codKg);
  if(ww.volumeM3>ww.capacityM3+1e-6)problems.push('Wastewater capacity exceeded');
  if(problems.length)throw new Error(problems.join('; '));
  return {residualKg,waterResidualM3,wwResidualM3,codResidualKg,oilResidualKg,coatResidualKg};
}

function liveTags(s) {
  const result=[];
  const tag=(id,value,unit,type='Float64')=>result.push({id,value,unit,type,at:s.time,quality:'GOOD'});
  for(const st of s.stages){
    tag(`${st.tag}.STATUS`,st.status,'state','String');tag(`${st.tag}.WT.PV`,st.massKg,'kg');tag(`${st.tag}.FT.PV`,st.flowKgS*3600,'kg/h');tag(`${st.tag}.SPEED.SP`,st.speed,'ratio');tag(`${st.tag}.RUN`,st.status==='RUNNING','boolean','Boolean');tag(`${st.tag}.ISOLATED`,st.isolated,'boolean','Boolean');tag(`${st.tag}.TOTAL`,st.processedKg,'kg');
  }
  for(const [id,l] of Object.entries(s.loops)){const st=stageFor(s,id);tag(`${st.tag}.TT.PV`,l.measured,'deg C');tag(`${st.tag}.TT.TRUTH`,l.pv,'deg C');tag(`${st.tag}.TT.SP`,l.sp,'deg C');tag(`${st.tag}.CV`,l.output,'%');}
  tag('UTIL-STEAM.PT',s.utilities.steamKPa,'kPa');tag('UTIL-AIR.PT',s.utilities.airKPa,'kPa');tag('UTIL-WATER.LT',s.utilities.waterM3,'m3');tag('WW-EQ.LT',s.ww.volumeM3,'m3');tag('WW-EQ.COD',s.ww.volumeM3?s.ww.codKg/s.ww.volumeM3:0,'kg/m3');tag('COLD-STORE.TT',s.warehouse.tempC,'deg C');tag('PLANT.MODE',s.mode,'state','String');tag('PLANT.CLOCK',s.time,'s');
  return result;
}
export function tags(s) {
  if(has(s,'comms-loss')&&s.gatewaySnapshot)return s.gatewaySnapshot.map(x=>({...x,quality:'STALE'}));
  return liveTags(s);
}
export function exportRun(s) {
  return JSON.stringify({format:'potato-sim/1',version:VERSION,seed:s.seed,until:s.time,commands:s.journal},null,2);
}
function validateRun(run) {
  if(!run||Array.isArray(run)||run.format!=='potato-sim/1'||run.version!==VERSION||!Number.isInteger(run.seed)||run.seed<0||run.seed>0xffffffff||!Number.isInteger(run.until)||run.until<0||run.until>LIMITS.maxSeconds||!Array.isArray(run.commands)||run.commands.length>LIMITS.maxCommands)throw new Error('Unsupported or invalid simulation run');
  let previous=0;
  for(const item of run.commands){
    if(!item||!Number.isInteger(item.at)||item.at<previous||item.at>run.until||!commandNames.has(item.type)||!item.payload||typeof item.payload!=='object'||Array.isArray(item.payload))throw new Error('Invalid command journal');
    if(Object.keys(item.payload).some(k=>['__proto__','prototype','constructor'].includes(k)))throw new Error('Unsafe payload key');
    previous=item.at;
  }
}
export function replayRun(run,until = run?.until) {
  validateRun(run);
  if(!Number.isInteger(until)||until<0||until>run.until)throw new RangeError('Replay clock is outside the recorded interval');
  const s=createPlant({seed:run.seed});
  for(const item of run.commands){if(item.at>until)break;advance(s,item.at-s.time);const r=act(s,item.type,item.payload);if(!r.ok)throw new Error(`Invalid recorded action at ${item.at}: ${r.reason}`);}
  advance(s,until-s.time);assertPlant(s);return s;
}
export function importRun(text) {
  if(typeof text!=='string'||text.length>LIMITS.maxImportBytes)throw new RangeError('Run import exceeds its supported size');
  const run=JSON.parse(text);return replayRun(run);
}
export function scenario(id,seed = 42) {
  const preset=SCENARIOS.find(x=>x.id===id);if(!preset)throw new Error('Unknown scenario');
  return replayRun({format:'potato-sim/1',version:VERSION,seed,until:preset.until,commands:preset.events});
}
export function review(s) {
  return {title:'Potato-Plant-Simulation - independent engineering study',version:VERSION,simulationOnly:true,notAValidatedDooenDigitalTwin:true,author:'Sajeevan Veeriah',sources:copy(SOURCES),assumptions:copy(ASSUMPTIONS),summary:summarise(s),conservation:assertPlant(s),recipes:copy(RECIPES),equipment:copy(STAGES),controls:copy(s.loops),orders:copy(s.orders),rawLots:copy(s.rawLots),finishedLots:copy(s.finishedLots),shipments:copy(s.shipments),utilities:copy(s.utilities),wastewater:copy(s.ww),alarms:copy(s.alarms),events:copy(s.events),sanitation:copy(s.clean),maintenance:copy(s.jobs),integration:{outbox:copy(s.outbox),delivered:copy(s.delivered)},history:copy(s.history),run:JSON.parse(exportRun(s))};
}
export function csv(s,kind) {
  let columns,rows;
  if(kind==='historian'){columns=['time_s','mode','feed_kg_h','output_kg_h','wip_kg','packed_kg','blanch_degC','fry_degC','freeze_degC','water_m3','wastewater_m3','electric_kW','active_alarms'];rows=s.history.map(x=>Object.values(x));}
  else if(kind==='tags'){columns=['tag','value','unit','type','time_s','quality'];rows=tags(s).map(x=>[x.id,x.value,x.unit,x.type,x.at,x.quality]);}
  else if(kind==='genealogy'){columns=['finished_lot','raw_lot','order','recipe','total_kg','pending_kg','released_kg','shipped_kg','scrapped_kg','hold_reasons'];rows=s.finishedLots.map(x=>[x.id,x.rawLotId,x.orderId,x.recipe,x.totalKg,x.pendingKg,x.releasedKg,x.shippedKg,x.scrappedKg,x.holdReasons.join('; ')]);}
  else throw new Error('Unknown CSV export');
  const quote=value=>{let text=String(value??'');if(typeof value==='string'&&/^[=+@\-\t\r]/.test(text))text=`'${text}`;return `"${text.replaceAll('"','""')}"`;};
  return `${columns.join(',')}\n${rows.map(row=>row.map(quote).join(',')).join('\n')}\n`;
}

