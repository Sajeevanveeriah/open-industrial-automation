// Named reference configurations, not installed software or an as-built equipment list.
export const VENDORS = {
  siemens: {name:'Siemens / ABB / SAP',plc:'SIMATIC S7-1500',io:'ET 200SP',scada:'WinCC Unified',mes:'Opcenter Execution Process',erp:'SAP S/4HANA',bus:'PROFINET',robot:'ABB reference cells',scanMs:100},
  rockwell: {name:'Rockwell / ABB / SAP',plc:'ControlLogix 5580',io:'POINT I/O',scada:'FactoryTalk View',mes:'FactoryTalk ProductionCentre',erp:'SAP S/4HANA',bus:'EtherNet/IP',robot:'ABB reference cells',scanMs:100},
  neutral: {name:'Vendor-neutral',plc:'Cyclic controller',io:'Distributed I/O',scada:'Supervisory interface',mes:'Manufacturing execution',erp:'Enterprise planning',bus:'Industrial Ethernet',robot:'Generic robotic cells',scanMs:100}
};
export function signalAddress(profile,wire){
  const i=Number(wire.cabinet.slice(3))-1,channel=['READY','PE','OL','RUN','SPEED','TEMP'].indexOf(wire.signal);
  if(profile==='siemens')return channel<3?`%I${i}.${channel}`:channel===3?`%Q${i}.0`:channel===4?`%QW${64+i*2}`:`%IW${64+i*2}`;
  if(profile==='rockwell')return `Local:${i+1}:${channel===3||channel===4?'O':'I'}.Data[${channel}]`;
  return `${wire.stage}.${wire.signal}`;
}
export const ROBOT_REFERENCE = {
  case:{name:'ABB IRB 360-6/1600',payloadKg:6,diameterM:1.6,toolKg:1,parallel:4,cycleS:2},
  pallet:{name:'ABB IRB 460',payloadKg:110,reachM:2.4,toolKg:20,parallel:1,cycleS:3}
};
export const VENDOR_SOURCES = [
 ['Siemens controller simulation boundary','https://developer.siemens.com/s7-plcsim-advanced/overview.html'],
 ['ABB IRB 360 variants','https://www.abb.com/global/en/areas/robotics/products/robots/delta-robots/irb-360'],
 ['ABB IRB 460 specification','https://www.abb.com/global/en/areas/robotics/products/robots/articulated-robots/medium-robots/irb-460'],
 ['SAP manufacturing planning','https://www.sap.com/australia/products/scm/manufacturing-for-planning-and-scheduling.html']
];
