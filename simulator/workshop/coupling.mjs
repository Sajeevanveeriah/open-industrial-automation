import {reference as referenceCircuit, readNet, sample} from './electrical/circuit.mjs';
import {referenceRack, importRack, probe} from './infrastructure/rack.mjs';
import {newCell, validateCell, reset, start, step, recover} from './robot/kinematics.mjs';
import {validate, bracketMeasurement} from './site/geometry.mjs';

const requireThat=(condition,message)=>{if(!condition)throw Error(message);};

export function prepareCoupling(extensions, bindings={}) {
  const circuit=extensions.electrical?readNet(extensions.electrical):referenceCircuit();
  if(!extensions.electrical)circuit.parts.find(p=>p.kind==='switch').on=true;
  const rack=importRack(JSON.stringify(extensions.infrastructure||referenceRack()));
  const arm=validateCell(structuredClone(extensions.robot||newCell()));
  reset(arm);
  const selected=(id,kind,items)=>items.find(a=>a.id===id && a.kind===kind)?.id;
  const choose=(field,kind,items)=>selected(bindings[field]??items.find(a=>a.kind===kind)?.id,kind,items);
  const map={enable:choose('enable','input',circuit.parts),plc:choose('plc','plc',rack.devices),io:choose('io','io',rack.devices),gateway:choose('gateway','gateway',rack.devices)};
  requireThat(Object.values(map).every(Boolean),'Provide a circuit input, rack PLC, remote I/O device and supervisory gateway.');
  const layout=extensions.layout?bracketMeasurement(validate(structuredClone(extensions.layout))):null;
  const design={circuit,rack,arm,map,layout};
  requireThat(JSON.stringify(design).length<=160000,'Coupled configurations must fit within 160 kB. Export a smaller design.');
  return design;
}
export function bindCoupling(design){
  requireThat(design?.map && design.circuit && design.rack && design.arm,'Invalid coupled project.');
  const validated=prepareCoupling({electrical:design.circuit,infrastructure:design.rack,robot:design.arm},design.map);
  if(design.layout){
    const {position,length,conveyor,bracket}=design.layout;
    requireThat(Number.isFinite(length)&&length>0&&length<=100&&Number.isFinite(position)&&position>=0&&position<=length&&typeof conveyor==='string'&&typeof bracket==='string','Invalid conveyor frame.');
    validated.layout={position,length,conveyor,bracket};
  }
  const state={...validated,coils:[],power:false,owner:null,cache:null,io:false,upstream:false,sourceScan:null,reportedCount:null,quality:'No sample',powerStop:false,linkFault:null,vacuumLoss:false};
  refreshPaths(state);
  return state;
}
function refreshPaths(s){
  const plc=s.rack.devices.find(d=>d.id===s.map.plc);
  s.executing=Boolean(plc?.power&&plc.service&&!s.controllerStop);
  s.io=s.executing&&probe(s.rack,s.map.plc,s.map.io,'modbus').ok;
  s.upstream=s.executing&&probe(s.rack,s.map.gateway,s.map.plc,'opcua').ok;
}
export function setDisturbance(s,name,value){
  if(name==='link'){
    requireThat(value===null||s.rack.links.some(l=>l.id===value),'Select an installed patch lead.');
    if(s.linkFault){s.rack.links.find(l=>l.id===s.linkFault.id).up=s.linkFault.wasUp;s.linkFault=null;}
    if(value!==null){const lead=s.rack.links.find(l=>l.id===value);s.linkFault={id:lead.id,wasUp:lead.up};lead.up=false;}
    refreshPaths(s);
  }else{
    requireThat(['powerStop','vacuumLoss','controllerStop'].includes(name)&&typeof value==='boolean','Invalid coupled disturbance.');
    s[name]=value;
    if(name==='controllerStop')refreshPaths(s);
  }
}
export function electricalScan(s){
  // Passive components are steady between coil/fuse transitions. Cache the settled solution.
  if(!s.cache){
    const before=s.circuit.parts.filter(p=>p.kind==='fuse'&&p.blown).length;
    const result=sample(s.circuit,s.coils);
    const stable=s.coils.join('|')===result.coils.join('|') && before===s.circuit.parts.filter(p=>p.kind==='fuse'&&p.blown).length;
    s.coils=result.coils;
    s.power=result.live.includes(s.map.enable);
    if(stable)s.cache={power:s.power};
  }
  return s.power&&!s.powerStop;
}
export function supervisoryScan(s,scan,count){
  if(scan%10!==0)return;
  s.quality=s.upstream?'Good':'Stale';
  if(s.upstream){s.reportedCount=count;s.sourceScan=scan;}
}
export function robotScan(s,carton,localVacuum){
  if(s.owner!==null && s.owner!==carton)return 'busy';
  if(s.owner===null){
    const pose=s.arm.q.slice();reset(s.arm);s.arm.q=pose;
    s.arm.carton.id=carton;s.owner=carton;start(s.arm);
  }
  const vacuum=s.arm.signals.vacuum;
  s.arm.signals.vacuum=vacuum&&localVacuum&&!s.vacuumLoss;
  try{step(s.arm,5);}finally{s.arm.signals.vacuum=vacuum;}
  if(s.arm.phase==='fault')return s.arm.fault;
  if(s.arm.phase!=='complete')return 'busy';
  requireThat(s.arm.palletised.includes(carton),'Missing robot transfer receipt.');
  s.owner=null;return 'placed';
}
export function resetCoupledRobot(s){
  if(s?.arm.phase==='fault')recover(s.arm);
}
