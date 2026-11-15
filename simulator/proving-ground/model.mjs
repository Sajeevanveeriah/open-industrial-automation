const TAU = 2 * Math.PI;
const SCAN_S = 0.008;
const DESIGN_SPEED = 2.5;
const TONNES_PER_HOUR_PER_MPS = 11.5;
const AMR_SPEED = 1.4;
const QUALITY = 0.994;

const asset = (id, name, zone, pillars, controller, protocol, scanMs) =>
  Object.freeze({id, name, zone, pillars: Object.freeze(pillars), controller, protocol, scanMs});

export const ASSETS = Object.freeze([
  asset('Z1-WB-01', 'Raw reception and weighbridge', 'Z1', [1, 2, 3, 6], 'OpenPLC Runtime v3 / IEC 61131-3 ST', 'Modbus TCP', 8),
  asset('Z2-SB-01', 'Climate-controlled storage bunkers', 'Z2', [1, 2, 3], 'OpenPLC Runtime v3 / IEC 61131-3 ST', 'OPC UA', 8),
  asset('Z3-PEEL-01', 'Steam peeler and brush tables', 'Z3', [1, 3], 'OpenPLC Runtime v3 / IEC 61131-3 ST', 'Modbus TCP', 8),
  asset('Z3-SORT-01', 'Optical inspection and reject', 'Z3', [2, 4, 5], 'Industrial vision controller', 'MQTT Sparkplug B', 20),
  asset('Z3-FRY-01', 'Continuous thermal fryer', 'Z3', [1, 2, 3, 6], 'OpenPLC Runtime v3 / IEC 61131-3 ST', 'OPC UA', 8),
  asset('Z4-ROB-01', 'Six-axis robotic palletiser', 'Z4', [1, 3, 4], 'ROS2 Humble / cell sequencer', 'OPC UA', 8),
  asset('Z4-CS-01', 'Automated cold store', 'Z4', [1, 3, 5, 6], 'OpenPLC Runtime v3 / IEC 61131-3 ST', 'OPC UA', 8),
  asset('AMR-01', 'Gendio autonomous rover', 'Perimeter', [2, 4, 5, 6], 'Gendio Controller ESP32-S3 / ROS2 Humble', 'CAN / LoRaWAN', 20)
]);
const byId = new Map(ASSETS.map(a => [a.id, a]));
const bounds = {speed: [0, DESIGN_SPEED], heat: [150, 195], cold: [-25, -15]};
const round = (n, digits = 2) => Number(n.toFixed(digits));

function derive(s) {
  const blocked = s.faults.jam || s.thermalTrip;
  s.beltSpeed = blocked ? 0 : s.speed;
  s.drumRpm = s.faults.jam || s.speed === 0 ? 0 : 12;
  s.robotCpm = s.beltSpeed * (14.2 / 1.6);
  s.roverSpeed = s.faults.obstacle ? 0 : AMR_SPEED;
  s.humidity = s.faults.humidity ? 97.5 : 92;
  s.purge = s.humidity > 96;
  s.sorterPass = QUALITY * 100;
  s.throughput = s.beltSpeed * TONNES_PER_HOUR_PER_MPS;
  s.heaterKw = s.thermalTrip ? 0 : Math.max(0, 150 + 200 * s.beltSpeed + (s.heat - 150) * 1.8 + (s.heat - s.fryerTemp) * 6);
  s.powerKw = 118 + 61 * s.beltSpeed + s.heaterKw + (s.stackerPowered ? 45 + (-15 - s.cold) * 2 : 0) + (s.purge ? 8 : 0);
  s.specificEnergy = s.throughput > 0 ? s.powerKw / s.throughput : null;
  s.rate = 96 + 0.24 * s.powerKw + 3.2 * s.throughput;
  s.oee = s.seconds > 0 ? 100 * s.goodTonnes / (DESIGN_SPEED * TONNES_PER_HOUR_PER_MPS * s.seconds / 3600) : 100 * QUALITY * s.beltSpeed / DESIGN_SPEED;
}

function alarmList(s) {
  const entries = [];
  const alarm = (id, asset, severity, message) => entries.push({id, asset, severity, message});
  if (s.faults.jam) alarm('INTAKE_TORQUE', 'Z1-WB-01', 'FAULT', 'Intake drive torque trip');
  if (s.purge) alarm('BUNKER_RH', 'Z2-SB-01', 'WARNING', 'High humidity - condensate purge active');
  if (s.thermalTrip) alarm('FRYER_HH', 'Z3-FRY-01', 'FAULT', 'High-temperature interlock - heater isolated');
  if (s.faults.obstacle) alarm('AMR_ZONE', 'AMR-01', 'WARNING', 'LiDAR protective zone occupied');
  if (!s.primaryPower) alarm('COLD_FEED', 'Z4-CS-01', s.stackerPowered ? 'WARNING' : 'FAULT', 'Cold store primary feeder unavailable');
  return entries;
}

export function createState() {
  const s = {speed: 1.6, heat: 175, cold: -20, fryerTemp: 175, coldTemp: -20,
    seconds: 0, scans: 0, remainder: 0, travel: 0, drumAngle: 0, robotAngle: 0,
    roverTravel: 0, cranePhase: 0, goodTonnes: 0, soc: 88, thermalTrip: false,
    primaryPower: true, backupPower: true, feeder: 'Primary', transferScans: 0, stackerPowered: true,
    faults: {heat: false, obstacle: false, jam: false, humidity: false}};
  derive(s);
  s.alarms = alarmList(s);
  return s;
}

export function setPoint(s, key, value) {
  if (!Object.hasOwn(bounds, key) || !Number.isFinite(value) || value < bounds[key][0] || value > bounds[key][1]) throw RangeError('Setpoint outside the model range');
  s[key] = value;
  derive(s);
}

export function setFault(s, key, enabled) {
  if (!Object.hasOwn(s.faults, key) || typeof enabled !== 'boolean') throw TypeError('Invalid fault selection');
  s.faults[key] = enabled;
  if (key === 'heat' && enabled) {s.fryerTemp = Math.max(192, s.fryerTemp); s.thermalTrip = true;}
  derive(s);
  s.alarms = alarmList(s);
}

function scanPower(s) {
  if (s.primaryPower) {s.transferScans = 0; s.feeder = 'Primary'; s.stackerPowered = true; return;}
  s.transferScans++;
  s.feeder = s.transferScans >= 3 && s.backupPower ? 'Backup' : 'Transfer';
  s.stackerPowered = s.feeder === 'Backup' || s.transferScans <= 4;
}

const fryerGain = -Math.expm1(-SCAN_S / 8);
const coldGain = -Math.expm1(-SCAN_S / 24);

export function advance(s, deltaS) {
  if (!Number.isFinite(deltaS) || deltaS < 0 || deltaS > 3600) throw RangeError('Advance by 0 to 3600 seconds');
  const pending = s.remainder + deltaS;
  const count = Math.floor(pending / SCAN_S + 1e-9);
  s.remainder = Math.max(0, pending - count * SCAN_S);
  for (let i = 0; i < count; i++) {
    scanPower(s);
    const thermalTarget = s.faults.heat ? 192 : s.thermalTrip ? 170 : s.heat;
    s.fryerTemp += (thermalTarget - s.fryerTemp) * fryerGain;
    s.coldTemp += ((s.stackerPowered ? s.cold : 4) - s.coldTemp) * coldGain;
    if (s.fryerTemp > 188) s.thermalTrip = true;
    else if (!s.faults.heat && s.fryerTemp < 184 && s.heat < 184) s.thermalTrip = false;
    s.scans++;
    s.seconds = s.scans * SCAN_S;
    derive(s);
    s.travel += s.beltSpeed * SCAN_S;
    s.drumAngle = (s.drumAngle + TAU * s.drumRpm * SCAN_S / 60) % TAU;
    s.robotAngle = (s.robotAngle + TAU * s.robotCpm * SCAN_S / 60) % TAU;
    s.roverTravel += s.roverSpeed * SCAN_S;
    s.soc = Math.max(0, s.soc - (s.roverSpeed ? 0.5 : 0.08) * SCAN_S / 3600);
    if (s.stackerPowered) s.cranePhase = (s.cranePhase + TAU * SCAN_S / 32) % TAU;
    s.goodTonnes += s.throughput * QUALITY * SCAN_S / 3600;
  }
  derive(s);
  s.alarms = alarmList(s);
  return s;
}

export function status(s, id) {
  if (!byId.has(id)) throw RangeError('Unknown plant asset');
  if (id === 'AMR-01' && s.faults.obstacle) return 'INTERLOCK_HOLD';
  const alarm = s.alarms.find(a => a.asset === id);
  return !alarm ? 'NOMINAL' : alarm.severity === 'FAULT' ? 'TRIP' : 'WARNING';
}

const metric = (name, value, unit, type = 'Double') => ({name, value: typeof value === 'number' ? round(value, 4) : value, unit, type});
export function telemetry(s, id) {
  switch (id) {
    case 'Z1-WB-01': return [metric('WashDrumSpeed', s.drumRpm, 'rpm'), metric('LineFeed', s.throughput, 't/h'), metric('DriveTorque', s.faults.jam ? 160 : 18 + 30 * s.speed, 'N m'), metric('JamInterlock', s.faults.jam, '', 'Boolean')];
    case 'Z2-SB-01': return [metric('RelativeHumidity', s.humidity, '% RH'), metric('BunkerTemperature', 4, 'deg C'), metric('DamperState', s.purge ? 'PURGE' : 'NORMAL', '', 'String'), metric('EvaporatorPower', s.purge ? 20 : 12, 'kW')];
    case 'Z3-PEEL-01': return [metric('SteamPressure', 1450, 'kPa'), metric('BrushSpeed', s.beltSpeed * 48 / 1.6, 'rpm'), metric('ProductFeed', s.throughput, 't/h'), metric('BrushDrive', s.beltSpeed > 0, '', 'Boolean')];
    case 'Z3-SORT-01': return [metric('OpticalPassRate', s.sorterPass, '%'), metric('RejectRate', s.throughput * (1 - QUALITY), 't/h'), metric('InspectionArray', s.beltSpeed > 0, '', 'Boolean'), metric('LineSpeed', s.beltSpeed, 'm/s')];
    case 'Z3-FRY-01': return [metric('OilTemperature', s.fryerTemp, 'deg C'), metric('DemandTemperature', s.heat, 'deg C'), metric('HeaterPower', s.heaterKw, 'kW'), metric('HighTemperatureTrip', s.thermalTrip, '', 'Boolean')];
    case 'Z4-ROB-01': return [metric('PalletisingRate', s.robotCpm, 'cpm'), metric('CyclePhase', s.robotAngle / TAU * 100, '%'), metric('ConveyorSpeed', s.beltSpeed, 'm/s'), metric('Vacuum', s.beltSpeed > 0 ? -72 : 0, 'kPa')];
    case 'Z4-CS-01': return [metric('StoreTemperature', s.coldTemp, 'deg C'), metric('DemandTemperature', s.cold, 'deg C'), metric('Feeder', s.feeder, '', 'String'), metric('CranePowerAvailable', s.stackerPowered, '', 'Boolean')];
    case 'AMR-01': return [metric('GroundSpeed', s.roverSpeed, 'm/s'), metric('BatteryCharge', s.soc, '%'), metric('CANHeartbeat', Math.floor(s.seconds * 10) % 65536, '', 'UInt32'), metric('LoRaWANHeartbeat', Math.floor(s.seconds / 2) % 65536, '', 'UInt32')];
    default: throw RangeError('Unknown plant asset');
  }
}

export const hierarchy = asset => 'Enterprise: Voltwyn / Site: Dooen-Digital-Twin / Area: ' + asset.zone + ' / WorkCenter: ' + asset.id;

export function payload(s, id, timestamp, seq) {
  if (!Number.isSafeInteger(timestamp) || timestamp < 0 || !Number.isInteger(seq) || seq < 0 || seq > 255) throw RangeError('Invalid message sequence or timestamp');
  return {topic:'spBv1.0/Voltwyn/NDATA/Dooen/'+id, payload:{timestamp,seq,metrics:telemetry(s,id).map(m=>({name:m.name,timestamp,dataType:m.type,value:m.value}))}};
}

export function validFrame(frame, id) {
  const p = frame?.payload;
  if (!byId.has(id) || frame?.topic !== 'spBv1.0/Voltwyn/NDATA/Dooen/'+id || !Number.isSafeInteger(p?.timestamp) || p.timestamp < 0 || !Number.isInteger(p.seq) || p.seq < 0 || p.seq > 255 || !Array.isArray(p.metrics)) return false;
  const expected = telemetry(createState(), id);
  if (p.metrics.length !== expected.length || new Set(p.metrics.map(m=>m?.name)).size !== expected.length) return false;
  return p.metrics.every(m=>{
    const field=expected.find(f=>f.name===m?.name);
    if (!field || m.dataType!==field.type || m.timestamp!==p.timestamp) return false;
    if (m.dataType==='Double') return Number.isFinite(m.value);
    if (m.dataType==='UInt32') return Number.isInteger(m.value) && m.value>=0 && m.value<=4294967295;
    return typeof m.value === (m.dataType==='String' ? 'string' : 'boolean');
  });
}

export const FAT = Object.freeze(['FAT-01 ISA-95 tag hierarchy and naming audit','FAT-02 OPC UA / OpenPLC scan time verification','FAT-03 Thermal high-temperature interlock trip','FAT-04 AMR LiDAR protective zone E-stop','FAT-05 MQTT Sparkplug B payload schema validation','FAT-06 Cold store redundant power transfer']);

export function fatStep(index, live) {
  const s = structuredClone(live);
  const result = (pass, detail) => ({pass:Boolean(pass),detail});
  switch(index){
    case 0: {
      const paths=ASSETS.map(hierarchy),names=ASSETS.map(a=>a.id);
      const tags=ASSETS.flatMap(a=>telemetry(s,a.id).map(m=>hierarchy(a)+'/Tag: '+m.name));
      const uniqueTags=tags.every(tag=>/\/Tag: [A-Za-z][A-Za-z0-9]*$/.test(tag)) && new Set(tags).size===tags.length;
      const valid=ASSETS.every(a=>a.id==='AMR-01'?a.zone==='Perimeter':/^Z[1-4]-[A-Z]+-\d{2}$/.test(a.id)&&a.id.startsWith(a.zone+'-'));
      return result(valid && uniqueTags && new Set(paths).size===ASSETS.length && new Set(names).size===ASSETS.length,'Checked '+paths.length+' work centres and '+tags.length+' unique tag paths.');
    }
    case 1: {
      const initial=s.scans, time=s.seconds;
      advance(s,1);
      const cycles=s.scans-initial, ms=1000*(s.seconds-time)/cycles;
      return result(cycles===125 && ms<10,cycles+' simulated scans in 1.000 s; mean interval '+ms.toFixed(2)+' ms.');
    }
    case 2: {
      setPoint(s,'speed',1.6);setPoint(s,'heat',175);setFault(s,'heat',false);setFault(s,'jam',false);
      advance(s,24);
      const initialPower=s.heaterKw, initialThroughput=s.throughput;
      setFault(s,'heat',true);advance(s,SCAN_S);
      const tripped=initialPower>0 && initialThroughput>0 && s.fryerTemp>188 && s.thermalTrip && s.heaterKw===0 && s.throughput===0;
      return result(tripped,'Oil '+s.fryerTemp.toFixed(1)+' deg C; heater '+initialPower.toFixed(1)+' to '+s.heaterKw.toFixed(1)+' kW; line '+initialThroughput.toFixed(1)+' to '+s.throughput.toFixed(1)+' t/h.');
    }
    case 3: {
      setFault(s,'obstacle',false);advance(s,SCAN_S);const moving=s.roverSpeed>0;
      const pos=s.roverTravel;
      setFault(s,'obstacle',true);advance(s,1);
      return result(moving && pos===s.roverTravel && status(s,'AMR-01')==='INTERLOCK_HOLD','Rover travel during 1.000 s protective hold: '+(s.roverTravel-pos).toFixed(3)+' m.');
    }
    case 4: {
      const valid=ASSETS.every((a,i)=>validFrame(JSON.parse(JSON.stringify(payload(s,a.id,Math.round(s.seconds*1000),i))),a.id));
      const invalid=payload(s,'AMR-01',0,255);invalid.payload.metrics[2].value=-1;
      return result(valid&&!validFrame(invalid,'AMR-01'),'Validated eight JSON metric sets and rejected an invalid heartbeat.');
    }
    case 5: {
      s.primaryPower=false;s.backupPower=true;s.transferScans=0;
      const begin=s.cranePhase;let alwaysOn=true;
      for(let i=0;i<3;i++){advance(s,SCAN_S);alwaysOn=alwaysOn&&s.stackerPowered;}
      return result(s.feeder==='Backup'&&alwaysOn&&begin!==s.cranePhase,'Backup feeder '+s.feeder+'; transfer '+(s.transferScans*SCAN_S*1000).toFixed(0)+' ms; crane '+(alwaysOn?'energised':'unpowered')+'.');
    }
    default: throw RangeError('Unknown FAT step');
  }
}
