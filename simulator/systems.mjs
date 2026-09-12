import {VENDORS} from './vendors.mjs';
// Browser reference models. No fieldbus, electrical certification or vendor runtime.
export const GATES = [
 ['commercial','Commercial definition','Products, customers, capacity, packaging and funded business case'],
 ['site','Site and approvals','Site suitability, planning, environmental and food-business approval evidence'],
 ['design','Coordinated design','HACCP basis, hygienic zoning, utilities, electrical and machinery hazard review'],
 ['procure','Procurement and FAT','Specifications, supplier reviews and factory acceptance records'],
 ['build','Mechanical completion','Installation, cable checks, calibration and defect closure'],
 ['cold','Cold commissioning','I/O, motors, interlocks, emergency stops and recovery'],
 ['wet','Wet commissioning','Flows, temperatures, CIP, capacity and site acceptance'],
 ['validate','Validation','Cleaning, allergens, process limits, traceability and shelf-life evidence'],
 ['launch','Launch readiness','Training, maintenance, emergency arrangements and pilot-batch review'],
 ['improve','Continuous improvement','Yield, OEE, customer feedback and controlled change review']
];
export const NODES = ['ERP','MES','HISTORIAN','DMZ','SCADA','PLC','REMOTE-IO','ROBOT'];
const ops=['vendor','wire','breaker','overload','plc','network','robotFault','robotGate','robotReset','robotRate','purchase','receivePO','sales','planSales','reserve','invoice','workOrder','completeWork','evidence','gate','change','latency'];
const positive=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const item=(list,id)=>list.find(x=>x.id===id);
export function createSystems(stages){return {
 version:1, vendor:'siemens', scanMs:100, scans:0, plcRun:true, watchdog:false, latencyMs:20,
 cabinets:stages.map((st,i)=>({id:`CP-${String(i+1).padStart(2,'0')}`,stage:st.id,breaker:true,overload:false,volts:24,currentA:0})),
 wires:stages.flatMap((st,i)=>['READY','PE','OL','RUN','SPEED','TEMP'].map((signal,j)=>({id:`W${i+1}-${j+1}`,stage:st.id,cabinet:`CP-${String(i+1).padStart(2,'0')}`,terminal:`X${i+1}:${j+1}`,device:`${st.tag}.${signal}`,address:`${j<3?'I':j===3?'Q':j===4?'AQ':'AI'}${i}.${j}`,signal,broken:false,value:0,quality:'GOOD'}))),
 io:{}, nodes:NODES.map(id=>({id,online:true})),
 robots:[{id:'case',name:'Case packing robot',stage:'pack',cycleS:2,payloadKg:5,parallel:4,toolKg:1,reachM:0.8,progress:0,cycles:0,handledKg:0,fault:false,gateOpen:false,latched:false,status:'READY',position:[0,0,0],grip:false},{id:'pallet',name:'Palletising robot',stage:'pallet',cycleS:3,payloadKg:30,parallel:1,toolKg:20,reachM:2.4,progress:0,cycles:0,handledKg:0,fault:false,gateOpen:false,latched:false,status:'READY',position:[0,0,0],grip:false}],
 warehouse:{auto:true,amrs:[{id:'AMR-01',battery:100,status:'IDLE',remaining:0,mission:null},{id:'AMR-02',battery:100,status:'IDLE',remaining:0,mission:null}],missions:[],accountedKg:0,storedKg:0,capacityPallets:500},
 purchases:[],sales:[],workOrders:[],spares:10,evidence:[],gates:GATES.map(([id])=>({id,status:'OPEN',note:''})),changes:[],downtimeS:0,cost:{rawAUD:0,energyAUD:0,packagingAUD:0,totalAUD:0},next:0,events:[]
};}
export function systemReason(s,p){
 const x=s.systems;if(!ops.includes(p.op))return 'Unknown systems operation';
 if(!['instructor','engineer','maintenance'].includes(s.role))return 'Select Instructor, Engineer or Maintenance for the engineering simulator';
 const stopped=['STOPPED','HELD','TRIPPED'].includes(s.mode);
 switch(p.op){
 case 'vendor':return Object.hasOwn(VENDORS,p.id)&&stopped?null:'Hold or stop the line before changing the reference vendor';
 case 'wire':return item(x.wires,p.id)?null:'Unknown wire';
 case 'breaker':case 'overload':return item(x.cabinets,p.id)?null:'Unknown cabinet';
 case 'plc':return null;
 case 'network':return item(x.nodes,p.id)?null:'Unknown network node';
 case 'latency':return positive(p.value,0,1000)?null:'Latency must be 0-1,000 ms';
 case 'robotGate':case 'robotFault':return item(x.robots,p.id)?null:'Unknown robot';
 case 'robotReset':{const r=item(x.robots,p.id);return !r?'Unknown robot':r.fault||r.gateOpen?'Remove gripper fault and close cell gate before reset':s.mode==='TRIPPED'?'Recover the plant trip before robot reset':!x.nodes.find(n=>n.id==='ROBOT').online?'Restore robot communication before reset':!stopped?'Hold or stop the line before resetting the robot':!r.latched?'Robot is not latched':null;}
 case 'robotRate':return item(x.robots,p.id)&&positive(p.value,0.5,20)&&stopped?null:'Hold or stop, then set a cycle time from 0.5 to 20 s';
 case 'purchase':return positive(p.kg,1000,50000)&&positive(p.price,0.01,10)&&x.purchases.length<100?null:'Purchase requires 1,000-50,000 kg and AUD 0.01-10/kg; limit 100';
 case 'receivePO':return item(x.purchases,p.id)?.status==='ORDERED'?null:'Purchase is missing or already received';
 case 'sales':return positive(p.kg,1,100000)&&positive(p.price,0.01,100)&&x.sales.length<100?null:'Sales order requires 1-100,000 kg and AUD 0.01-100/kg; limit 100';
 case 'planSales':{const o=item(x.sales,p.id);return !o||o.campaignId?'Select a sales order without a campaign':s.orders.length>=100?'Campaign limit reached':null;}
 case 'reserve':{const o=item(x.sales,p.id),available=s.finishedLots.reduce((n,l)=>n+l.releasedKg,0)-x.sales.filter(a=>a.status==='RESERVED').reduce((n,a)=>n+a.kg,0);return !o||o.status!=='OPEN'?'Select an open sales order':available<o.kg?'Insufficient quality-released stock':null;}
 case 'invoice':{const o=item(x.sales,p.id),shipped=s.shipments.reduce((n,a)=>n+a.kg,0),invoiced=x.sales.filter(a=>a.status==='INVOICED').reduce((n,a)=>n+a.kg,0);return !o||o.status!=='RESERVED'?'Reserve this order first':shipped-invoiced<o.kg?'Dispatch sufficient released stock in Quality before invoicing':null;}
 case 'workOrder':return s.stages.some(a=>a.id===p.id)&&x.workOrders.length<100?null:'Unknown equipment or work-order limit reached';
 case 'completeWork':{const w=item(x.workOrders,p.id);return !w||w.status!=='OPEN'?'Select an open work order':!s.stages.find(a=>a.id===w.stage)?.isolated?'Isolate this equipment in Maintenance first':x.spares<1?'No spare assemblies available':null;}
 case 'evidence':return GATES.some(a=>a[0]===p.id)&&typeof p.note==='string'&&p.note.trim().length>=8&&p.note.length<=500?null:'Select a gate and enter 8-500 characters of review evidence';
 case 'gate':{const i=x.gates.findIndex(a=>a.id===p.id);return i<0?'Unknown gate':x.gates[i].status==='ACCEPTED'?'Gate already accepted':i>0&&x.gates[i-1].status!=='ACCEPTED'?'Accept the preceding gate first':!x.evidence.some(a=>a.gate===p.id)?'Record review evidence before accepting this gate':null;}
 case 'change':return typeof p.note==='string'&&p.note.trim().length>=8&&p.note.length<=500?null:'Describe the change in 8-500 characters';
 }
}
export function applySystem(s,p){
 const x=s.systems;const id=prefix=>`${prefix}-${++x.next}`;
 switch(p.op){
 case 'vendor':x.vendor=p.id;break;
 case 'wire':{const w=item(x.wires,p.id);w.broken=!w.broken;break;}
 case 'breaker':{const c=item(x.cabinets,p.id);c.breaker=!c.breaker;break;}
 case 'overload':{const c=item(x.cabinets,p.id);c.overload=!c.overload;break;}
 case 'plc':x.plcRun=!x.plcRun;break;
 case 'network':{const n=item(x.nodes,p.id);n.online=!n.online;break;}
 case 'latency':x.latencyMs=p.value;break;
 case 'robotGate':{const r=item(x.robots,p.id);r.gateOpen=!r.gateOpen;if(r.gateOpen)r.latched=true;break;}
 case 'robotFault':{const r=item(x.robots,p.id);r.fault=!r.fault;if(r.fault||r.gateOpen)r.latched=true;break;}
 case 'robotReset':{const r=item(x.robots,p.id);r.latched=false;r.progress=0;r.grip=false;break;}
 case 'robotRate':item(x.robots,p.id).cycleS=p.value;break;
 case 'purchase':x.purchases.push({id:id('PO'),kg:p.kg,price:p.price,status:'ORDERED'});break;
 case 'receivePO':{const po=item(x.purchases,p.id);po.status='RECEIVED';po.rawLotId=`SIM-RAW-${String(++s.counters.raw).padStart(3,'0')}`;s.rawLots.push({id:po.rawLotId,source:po.id,kg:po.kg,dryMatter:21,sugar:0.12,grade:'HOLD',receivedAt:s.time});s.ledger.receivedRawKg+=po.kg;break;}
 case 'sales':x.sales.push({id:id('SO'),kg:p.kg,price:p.price,status:'OPEN'});break;
 case 'planSales':{const o=item(x.sales,p.id);const campaign={id:`SIM-ORDER-${String(++s.counters.order).padStart(3,'0')}`,recipe:s.activeRecipe,targetRawKg:Math.max(1000,Math.ceil(o.kg/0.7)),rawFedKg:0,producedKg:0,status:'QUEUED',createdAt:s.time};s.orders.push(campaign);o.campaignId=campaign.id;break;}
 case 'reserve':item(x.sales,p.id).status='RESERVED';break;
 case 'invoice':{const o=item(x.sales,p.id);o.status='INVOICED';o.invoice=id('INV');o.totalAUD=o.kg*o.price;break;}
 case 'workOrder':x.workOrders.push({id:id('WO'),stage:p.id,status:'OPEN',at:s.time});break;
 case 'completeWork':{const w=item(x.workOrders,p.id);w.status='COMPLETE';x.spares--;const c=x.cabinets.find(a=>a.stage===w.stage);c.overload=false;for(const wire of x.wires.filter(a=>a.stage===w.stage))wire.broken=false;s.stages.find(a=>a.id===w.stage).wear=0;break;}
 case 'evidence':x.evidence.push({id:id('EVID'),gate:p.id,note:p.note.trim(),at:s.time});break;
 case 'gate':item(x.gates,p.id).status='ACCEPTED';break;
 case 'change':x.changes.push({id:id('CHANGE'),note:p.note.trim(),at:s.time});for(const g of x.gates)g.status='OPEN';x.evidence=[];break;
 }
 x.events.push({at:s.time,operation:p.op,target:p.id||'',description:p.note||''});if(x.events.length>300)x.events.shift();scanSystems(s,0);
}
function updateRobotPose(r,enabled){const t=r.progress;r.grip=enabled&&t>=0.2&&t<0.8;r.position=[Math.sin(t*Math.PI*2)*Math.min(0.6,r.reachM),0.6+Math.sin(t*Math.PI)*0.8,t<0.5?0:0.8];}
export function scanSystems(s,dt=1){
 const x=s.systems,online=id=>item(x.nodes,id).online;
 x.scans+=Math.round(dt*1000/x.scanMs);x.watchdog=x.latencyMs>500||!online('PLC');
 for(const [ci,c] of x.cabinets.entries()){
 const st=s.stages.find(a=>a.id===c.stage),wires=x.wires.slice(ci*6,ci*6+6),ok=signal=>!wires.find(w=>w.signal===signal).broken;
 c.volts=c.breaker&&!s.faults.includes('power-loss')?24:0;
 const ready=c.volts===24&&!c.overload&&ok('READY')&&ok('OL');
 const input=ready&&ok('PE')&&(!s.loops[st.id]||ok('TEMP')),network=online('REMOTE-IO')&&!x.watchdog;
 const output=x.plcRun&&network&&input&&ok('RUN')&&ok('SPEED')&&(!s.loops[st.id]||ok('TEMP'))&&!st.isolated&&['RUNNING','DRAINING'].includes(s.mode);
 x.io[st.id]={ready,input,output,quality:network?'GOOD':'STALE',reason:!ready?'POWER / OVERLOAD / READY WIRE':!input?'PHOTOEYE / TEMPERATURE CIRCUIT':!network?'I/O NETWORK / WATCHDOG':!x.plcRun?'PLC STOP':!ok('RUN')||!ok('SPEED')?'OUTPUT CIRCUIT':s.loops[st.id]&&!ok('TEMP')?'TEMPERATURE CIRCUIT':st.isolated?'ISOLATED':'PERMISSIVE'};
 c.currentA=output?st.kW*1000/(Math.sqrt(3)*415*0.88):0;
 for(const w of wires){w.quality=w.broken?'BAD':network?'GOOD':'STALE';w.value=w.broken?0:w.signal==='TEMP'?(s.loops[st.id]?.measured??20):w.signal==='SPEED'?(output?st.speed*100:0):w.signal==='RUN'?Number(output):w.signal==='PE'?Number(input):Number(ready);}
 }
 for(const r of x.robots){
 const st=s.stages.find(a=>a.id===r.stage);if(r.fault||r.gateOpen)r.latched=true;
 const enabled=x.io[r.stage].output&&online('ROBOT')&&!r.latched;
 r.status=r.latched?'FAULT':!online('ROBOT')?'OFFLINE':!enabled?'STOPPED':st.massKg<0.01?'STARVED':'READY';
 // Robot paths are task-space teaching trajectories, not vendor kinematics.
 if(enabled&&st.flowKgS>0)r.status='CYCLING';
 updateRobotPose(r,enabled);
 }
}
export function systemBlock(s,stage){const x=s.systems,io=x.io[stage];if(!io?.output)return io?.reason||'PLC NOT SCANNED';const r=x.robots.find(a=>a.stage===stage);if(r?.latched||r?.fault)return 'ROBOT FAULT';if(r&&!item(x.nodes,'ROBOT').online)return 'ROBOT NETWORK';if(stage==='pallet'&&x.warehouse.missions.filter(a=>a.status!=='STORED').length>=4)return 'PALLET BUFFER';return null;}
export function systemCapacity(s,stage){const r=s.systems.robots.find(a=>a.stage===stage);return r?r.payloadKg*r.parallel/r.cycleS:Infinity;}
export function advanceSystems(s){
 const x=s.systems;
 for(const r of x.robots){const flow=s.stages.find(st=>st.id===r.stage).flowKgS;if(flow>0){r.handledKg+=flow;r.progress+=1/r.cycleS;while(r.progress>=1){r.cycles++;r.progress--;}r.status='CYCLING';updateRobotPose(r,true);}}
 const w=x.warehouse,total=s.finishedLots.reduce((n,l)=>n+l.totalKg,0);
 while(total-w.accountedKg>=600&&w.missions.length<500){const seq=w.missions.length+1;w.missions.push({id:`PAL-${seq}`,kg:600,status:'WAITING',location:`CS-${String(seq).padStart(3,'0')}`});w.accountedKg+=600;}
 // Single shared aisle reservation avoids simultaneous robot occupancy.
 const aisleOccupied=w.amrs.some(a=>a.status==='MOVING');
 for(const a of w.amrs){
 if(a.status==='MOVING'){if(s.mode==='TRIPPED'||!item(x.nodes,'ROBOT').online)continue;a.remaining--;a.battery=Math.max(0,a.battery-0.002);if(a.remaining<=0){item(w.missions,a.mission).status='STORED';w.storedKg+=600;a.status='IDLE';a.mission=null;}}
 else if(a.battery<20||a.status==='CHARGING'){a.status='CHARGING';a.battery=Math.min(100,a.battery+0.1);if(a.battery>=95)a.status='IDLE';}
 else if(!aisleOccupied&&!w.amrs.some(b=>b.status==='MOVING')&&['RUNNING','DRAINING'].includes(s.mode)&&item(x.nodes,'ROBOT').online){const mission=w.missions.find(m=>m.status==='WAITING');if(mission){mission.status='TRANSIT';a.mission=mission.id;a.remaining=45;a.status='MOVING';}}
 }
 if(['RUNNING','DRAINING'].includes(s.mode)&&s.stages.some(a=>systemBlock(s,a.id)))x.downtimeS++;
 x.cost={rawAUD:s.ledger.rawFedKg*0.3,energyAUD:s.utilities.electricKWh*0.25+s.utilities.thermalKWh*0.08,packagingAUD:s.stores.filmUsedKg*3};x.cost.totalAUD=Object.values(x.cost).reduce((a,b)=>a+b,0);
}
