import {compileLadder,compileProgram,executeScan,newController} from './practice/plc.mjs';
const controllers=new WeakMap();
export const SCAN_SECONDS = 0.1;
const MAX_SCANS = 36000;
const MAX_BYTES = 2 * 1024 * 1024;
const defaults = {
  conveyor: { speed: 0.25, length: 4 },
  bracket: { x: 1, width: 0.1 },
  sensor: { x: 0, width: 0.125 },
  plc: { input: 'I0', mode: 'rising' },
  hmi: { tag: 'count' },
  camera: { ip: '192.168.1.10', mask: 24, gateway: '192.168.1.1', bitrate: 4, power: 8, timeSynced: true, permitted: true },
  switch: { vlan1: 10, vlan2: 10, vlan3: 10, vlan4: 10, poeBudget: 30, uplink: true, route: false },
  viewer: { ip: '192.168.1.20', mask: 24, gateway: '192.168.1.1' },
  robot: { target: 2, vacuum: true, enabled: true },
  erp: { online: true, dropAck: false }
};
const bounds = { speed: [0.01, 5], length: [0.1, 100], x: [-100, 100], width: [0.001, 10], mask: [1, 30], bitrate: [0.01, 1000], power: [0, 90], poeBudget: [0, 1000], target: [0, 100] };
const portPairs = [
  ['conveyor', 'track', 'bracket', 'base'], ['bracket', 'mount', 'sensor', 'base'],
  ['sensor', 'out', 'plc', 'I0'], ['sensor', 'out', 'plc', 'I1'],
  ['plc', 'bus', 'hmi', 'bus'], ['plc', 'request', 'robot', 'request'], ['robot', 'ack', 'plc', 'ack']
];
const reference = {
  belt: 'conveyor', bracket: 'bracket', eye: 'sensor', plc: 'plc', hmi: 'hmi',
  camera: 'camera', switch: 'switch', viewer: 'viewer', robot: 'robot', erp: 'erp'
};
function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}
function identifier(value) {
  requireValue(typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value), 'Use a short alphanumeric identifier.');
  return value;
}
function number(value, min, max) {
  requireValue(Number.isFinite(value) && value >= min && value <= max, `Expected a number from ${min} to ${max}.`);
  return value;
}
function ipv4(value) {
  requireValue(typeof value === 'string' && /^(0|[1-9]\d{0,2})(\.(0|[1-9]\d{0,2})){3}$/.test(value), 'Invalid IPv4 address.');
  return value.split('.').reduce((n, octet) => n * 256 + number(Number(octet), 0, 255), 0);
}
function asset(p, id) { return p.assets.find(a => a.id === id); }
function first(p, type) { return p.assets.find(a => a.type === type); }
function source(p, target, input) { return asset(p, p.links.find(l => l.to === target?.id && l.input === input)?.from); }
function endpoint(p, device) {
  const l = p.links.find(l => l.from === device?.id && l.port === 'eth');
  return l && { sw: asset(p, l.to), vlan: asset(p, l.to)['vlan' + l.input.slice(1)], port: l.input };
}
function record(p, kind, a, message) {
  const r = p.runtime;
  r.events.push({ id: ++r.eventId, scan: r.scan, kind, asset: a || 'cell', message });
  if (r.events.length > 1024) r.events.shift();
}
function action(p, op, args, cost=1) {
  requireValue(p.runtime.replayCost+cost<=3000000,'Simulation exceeds replay budget.');
  requireValue(p.history.length < 20000, 'Project action limit reached.');
  p.history.push([op, ...structuredClone(args)]);
  p.runtime.replayCost+=cost;
}
export function createProject(start = 'blank', seed = 1) {
  requireValue(['reference','blank'].includes(start), 'Unknown project start.');
  requireValue(Number.isSafeInteger(seed) && seed >= 0 && seed <= 0xffffffff, 'Invalid project seed.');
  const p = { format: 'oia-workshop', version: 1, start, seed, assets: [], links: [], history: [],
    learning: {bookmarks: [], notebook: '', depth: 'Foundations', chapter: 1}, extensions: {},
    runtime: {scan: 0, count: 0, lastInput: false, program:null, controller:null, diagnostic:null, inputs: {I0:false,I1:false}, scans: [], events: [], eventId:0, replayCost:0, inputCartons:[],
      cartons: [], pallets: [], postings: [], evidence: [], firstOut:null, order:null, prediction:null} };
  if (start === 'reference') {
    for (const [id, type] of Object.entries(reference)) addAsset(p, type, id);
    for (const row of [['belt','track','bracket','base'],['bracket','mount','eye','base'],['eye','out','plc','I0'],['plc','bus','hmi','bus'],['camera','eth','switch','p1'],['viewer','eth','switch','p2'],['plc','request','robot','request'],['robot','ack','plc','ack']]) connect(p,...row);
    p.history = [];
  }
  return p;
}
export function addAsset(p,type,id) {
  identifier(id);
  requireValue(Object.hasOwn(defaults,type) && !asset(p,id) && !first(p,type), 'Each pilot cell supports one asset per function and unique asset IDs.');
  action(p,'addAsset',[type,id]);
  const a = {id,type,...defaults[type]};
  p.assets.push(a);
  return a;
}
export function configure(p,id,patch) {
  const a = asset(p,id);
  requireValue(a && patch && typeof patch === 'object' && !Array.isArray(patch), 'Invalid asset configuration.');
  for (const [key,value] of Object.entries(patch)) {
    requireValue(Object.hasOwn(defaults[a.type],key), 'Unknown asset parameter: ' + key);
    if (/^vlan[1-4]$/.test(key)) { number(value,1,4094); requireValue(Number.isInteger(value),'A VLAN ID must be an integer.'); }
    else if (Object.hasOwn(bounds,key)) {number(value,...bounds[key]); if (key === 'mask') requireValue(Number.isInteger(value),'Use an integer prefix length.');}
    else if (key === 'ip' || key === 'gateway') ipv4(value);
    else if (key === 'mode') requireValue(['rising','falling','level'].includes(value),'Unsupported counter instruction.');
    else if (key === 'input') requireValue(['I0','I1'].includes(value),'Unsupported input.');
    else if (key === 'tag') requireValue(['count','I0','I1'].includes(value),'Unsupported display tag.');
    else requireValue(typeof value === 'boolean','Expected an on/off setting.');
  }
  action(p,'configure',[id,patch]);
  Object.assign(a,patch);
  if (a.type==='plc' && Object.hasOwn(patch,'mode')) {
    p.runtime.program=null;p.runtime.controller=null;p.runtime.diagnostic=null;controllers.delete(p);
  }
}
export function connect(p,from,port,to,input) {
  const a=asset(p,from), b=asset(p,to);
  requireValue(a && b,'Both connection endpoints must exist.');
  const ethernet = ['camera','viewer'].includes(a.type) && port === 'eth' && b.type === 'switch' && /^p[1-4]$/.test(input);
  requireValue(ethernet || portPairs.some(row => row.every((v,i)=>v === [a.type,port,b.type,input][i])), 'Incompatible terminal types.');
  action(p,'connect',[from,port,to,input]);
  p.links=p.links.filter(l=>!(l.from === from && l.port === port) && !(l.to === to && l.input === input));
  p.links.push({from,port,to,input});
}
export function addCarton(p,lot='LOT-1') {
  const belt=first(p,'conveyor'), r=p.runtime;
  requireValue(belt && r.cartons.length < 500,'Place a conveyor first. Maximum 500 cartons per run.');
  identifier(lot);
  action(p,'addCarton',[lot]);
  const c={id:'CT-'+(r.cartons.length+1),lot,x:0,status:'moving',startScan:r.scan,order:r.order,detected:null,requestScan:null};
  r.cartons.push(c);
  record(p,'feed',belt.id,c.id+' entered from '+lot);
  return c;
}
export function network(p) {
  const camera=first(p,'camera'), viewer=first(p,'viewer'), c=endpoint(p,camera), v=endpoint(p,viewer);
  const power=Boolean(c && c.sw.poeBudget >= camera.power), link=power && Boolean(c);
  let reason='Video available', reachable=false;
  if (!c) reason='Camera cable open';
  else if (!power) reason='Insufficient power over Ethernet budget';
  else if (!v) reason='Viewing station cable open';
  else if (camera.ip === viewer.ip) reason='Duplicate IPv4 address';
  else {
    const sameSubnet=(a,b)=>Math.floor(ipv4(a.ip)/2**(32-a.mask)) === Math.floor(ipv4(b.ip)/2**(32-a.mask));
    const sameLan=c.vlan === v.vlan && sameSubnet(camera,viewer) && sameSubnet(viewer,camera);
    const gatewayOK=a=>sameSubnet(a,{ip:a.gateway}) && a.ip !== a.gateway;
    const routed=c.sw.route && c.sw.uplink && c.vlan !== v.vlan && !sameSubnet(camera,viewer) && !sameSubnet(viewer,camera) && gatewayOK(camera) && gatewayOK(viewer);
    reachable=sameLan || routed;
    if (!reachable) reason=c.vlan !== v.vlan ? 'No permitted route between VLANs' : 'Subnet or gateway mismatch';
    else if (!camera.timeSynced) reason='Camera clock unsynchronised';
    else if (!camera.permitted) reason='Viewing identity denied';
  }
  return {power,link,reachable,video:reason==='Video available',reason};
}
export function scaleAnalogue(mA) {
  number(mA,-100,100);
  return {value:(mA-4)*100/16,quality:mA<4 || mA>20 ? 'out-of-range' : 'good'};
}
export function retentionGB(streams,mbitPerSecond,hours,duty=1) {
  number(streams,0,10000); number(mbitPerSecond,0,10000); number(hours,0,87600); number(duty,0,1);
  return streams*mbitPerSecond*hours*3600*duty/8000;
}
function post(p, pal) {
  const erp=first(p,'erp'), r=p.runtime;
  if (!erp?.online || !pal.order) return;
  const key=pal.order+'/'+pal.id;
  if (!r.postings.some(e=>e.key===key)) {
    r.postings.push({key,pallet:pal.id,lot:pal.lot,order:pal.order,quantity:1});
    record(p,'erp-commit',erp.id,'Inventory +1 for '+key);
  }
  pal.attempts++;
  if (erp.dropAck) {
    pal.lostAckAt=r.scan;
    record(p,'ack-lost',erp.id,'Acknowledgement lost for '+key);
    return;
  }
  pal.status='confirmed'; pal.confirmedAt=r.scan;
  record(p,'ack',erp.id,'Receipt confirmed for '+key);
}
function tick(p) {
  const r=p.runtime, belt=first(p,'conveyor'), eye=first(p,'sensor'), plc=first(p,'plc'), robot=first(p,'robot');
  const bracket=source(p,eye,'base'), mounted=Boolean(bracket && belt && source(p,bracket,'base')===belt);
  const pos=mounted ? bracket.x + eye.x : NaN;
  r.scan++;
  const inputs={I0:false,I1:false};
  const inBeam=[];
  const wires=p.links.filter(l=>eye && plc && l.from===eye.id && l.to===plc.id);
  for (const c of r.cartons) {
    if (c.status!=='moving') continue;
    c.x=+(c.x+belt.speed*SCAN_SECONDS).toFixed(9);
    if (c.x<=belt.length && c.x>=pos && c.x<pos+eye.width) {
      inBeam.push(c);
      for (const wire of wires) inputs[wire.input]=true;
      if (c.detected===null) { c.detected=r.scan;record(p,'detection',eye.id,c.id+' crossed the beam'); }
    }
  }
  const input=plc ? inputs[plc.input] : false;
  let pulse=plc && (plc.mode==='level' ? input : plc.mode==='rising' ? input&&!r.lastInput : !input&&r.lastInput);
  if (r.program && plc) {
    const previous=r.count;
    try {
      r.controller=executeScan(controllers.get(p),r.controller,{IN:input,I0:inputs.I0,I1:inputs.I1},SCAN_SECONDS);
      r.count=r.controller.COUNT;
      r.diagnostic=null;
    } catch (error) {
      if (r.diagnostic!==error.message) record(p,'program-fault',plc.id,error.message);
      r.diagnostic=error.message;
    }
    pulse=r.count>previous && !r.diagnostic;
  } else if (pulse) r.count++;
  if (pulse) {
    const acquired=plc.mode==='falling' ? r.cartons.filter(c=>r.inputCartons.includes(c.id)) : inBeam;
    const next=acquired.find(c=>c.requestScan===null);
    if (next) next.requestScan=r.scan;
  }
  r.inputCartons=input ? inBeam.map(c=>c.id) : [];
  r.inputs=inputs;
  r.lastInput=input;
  r.scans.push({scan:r.scan,input,count:r.count,...inputs});
  if (r.scans.length>100) r.scans.shift();
  const request=plc && robot && source(p,robot,'request')===plc;
  const ack=request && source(p,plc,'ack')===robot;
  let usedRobot=false;
  for (const c of r.cartons) {
    if (!['moving','waiting'].includes(c.status)) continue;
    if (robot && c.x>=robot.target && robot.target<=belt.length && c.requestScan!==null && request && robot.enabled) {
      if (c.status==='moving' && c.x-robot.target<=belt.speed*SCAN_SECONDS) c.status='waiting';
      if (c.status==='waiting' && !r.firstOut && !usedRobot) {
        if (!robot.vacuum || !ack) {
          r.firstOut={scan:r.scan,asset:robot.id,carton:c.id,reason:robot.vacuum?'Acknowledgement circuit open':'Vacuum pickup failed'};
          record(p,'first-out',robot.id,r.firstOut.reason);
        } else {
          usedRobot=true;
          c.status='palletised';
          const pal={id:'PAL-'+(r.pallets.length+1),carton:c.id,order:c.order||r.order,lot:c.lot,status:'pending',attempts:0,placedAt:r.scan};
          r.pallets.push(pal);
          record(p,'placed',robot.id,c.id+' on '+pal.id);
          post(p,pal);
        }
      }
    }
    if (c.status==='moving' && c.x>belt.length) {c.status='missed';record(p,'missed',belt.id,c.id+' left the belt');}
  }
}
export function step(p,scans=1) {
  requireValue(Number.isSafeInteger(scans) && scans>0 && p.runtime.scan+scans<=MAX_SCANS,'Scan limit exceeded.');
  const count=p.runtime.cartons.length;
  const cost=scans*(1+count+(p.runtime.program?p.runtime.program.source.length:0));
  requireValue(p.runtime.replayCost+cost<=3000000,'Simulation exceeds replay budget.');
  const last=p.history.at(-1);
  if (last?.[0]==='step') last[1]+=scans;
  else action(p,'step',[scans],0);
  p.runtime.replayCost+=cost;
  for (let i=0;i<scans;i++) tick(p);
  return p.runtime;
}
export function inspect(p) {
  const r=p.runtime,hmi=first(p,'hmi'),plc=first(p,'plc');
  const bound=hmi && plc && source(p,hmi,'bus')===plc;
  return {time:r.scan*SCAN_SECONDS,input:r.lastInput,hmi:bound ? hmi.tag==='count'?r.count:r.inputs[hmi.tag]:null,network:network(p),firstOut:r.firstOut};
}
function countsEdges(p,plc) {
  if (!plc) return false;
  const eye=first(p,'sensor'),wired=eye && p.links.find(l=>l.from===eye.id && l.port==='out' && l.to===plc.id);
  if (!wired) return false;
  if (!p.runtime.program) return plc.mode==='rising' && wired.input===plc.input;
  const program=controllers.get(p);
  try {
    for (const pattern of ['01111100110','110000110101']) {
      let state=newController(),expected=0,last=false;
      for (const bit of pattern) {
        const high=bit==='1';
        if (high&&!last) expected++;
        state=executeScan(program,state,{IN:wired.input===plc.input&&high,I0:wired.input==='I0'&&high,I1:wired.input==='I1'&&high},SCAN_SECONDS);
        if (state.COUNT!==expected) return false;
        last=high;
      }
    }
    return true;
  } catch { return false; }
}
export function assess(p) {
  const r=p.runtime, reads=inspect(p), seen=r.cartons.filter(c=>c.detected!==null), firstSeen=seen.find(c=>c.id===r.prediction?.carton);
  const row=(id,pass,reason)=>({id,pass:Boolean(pass),reason});
  const plc=first(p,'plc'),eye=first(p,'sensor');
  const passesEdges=countsEdges(p,plc);
  const wired=eye && plc && (source(p,plc,plc.input)===eye || passesEdges);
  return [
    row('travel', seen.length>0, 'Move a carton across the mounted beam.'),
    row('sensor', wired && seen.length>0, 'Wire the sensor to the input read by the program.'),
    row('counter', seen.length>0 && r.count===seen.length && !r.diagnostic && passesEdges && wired, 'Count once per detected carton on a rising edge.'),
    row('hmi', reads.hmi===r.count && first(p,'hmi')?.tag==='count' && r.count>0, 'Bind the live display to the counter.'),
    row('video', reads.network.video, reads.network.reason),
    row('pallet', r.pallets.length>0 && r.pallets.length===r.cartons.length && !r.firstOut, 'Recover the cell and place every introduced carton once.'),
    row('erp', r.pallets.length>0 && r.pallets.every(x=>x.status==='confirmed') && r.postings.length===r.pallets.length,'Reconcile every pallet with one confirmed inventory movement.'),
    row('commissioning', ['FAT','SAT','Integrated'].every(ph=>r.evidence.some(e=>e.phase===ph && e.pass)), 'Capture passing evidence at all three stages.'),
    row('transfer', firstSeen && Math.abs((firstSeen.detected-firstSeen.startScan)*SCAN_SECONDS-r.prediction.seconds)<=SCAN_SECONDS+1e-8,'Predict the next carton travel time to within one 100 ms scan.')
  ];
}
export function command(p,name,args={}) {
  const r=p.runtime;
  requireValue(args && typeof args==='object' && !Array.isArray(args),'Invalid command arguments.');
  if (name==='releaseOrder') {
    identifier(args.id);
    action(p,'command',[name,{id:args.id}],1+r.pallets.length+r.pallets.filter(p=>!p.order).length*(1+r.pallets.length)); r.order=args.id;
    for (const pal of r.pallets.filter(pal=>!pal.order)) {pal.order=args.id;post(p,pal);}
    record(p,'order','cell','Released '+args.id);
  } else if (name==='resetRobot') {
    if (r.firstOut) {
      const robot=first(p,'robot'), plc=first(p,'plc');
      requireValue(robot?.vacuum,'Restore vacuum before resetting.');
      requireValue(plc && source(p,plc,'ack')===robot,'Restore the acknowledgement circuit before resetting.');
    }
    action(p,'command',[name,{}]);
    if (r.firstOut) {
      const affected=r.cartons.find(c=>c.id===r.firstOut.carton);
      affected.recovery={faultAt:r.firstOut.scan,resetAt:r.scan,reason:r.firstOut.reason};
    }
    r.firstOut=null;record(p,'reset','cell','Robot reset');
  } else if (name==='retryERP') {
    const pending=r.pallets.filter(x=>x.status==='pending');
    action(p,'command',[name,{}],1+r.pallets.length+pending.length*(1+r.pallets.length));
    for (const pal of pending) post(p,pal);
  } else if (name==='installProgram') {
    const {language,source}=args,plc=first(p,'plc');
    requireValue(plc && ['ST','Ladder'].includes(language) && typeof source==='string' && source.length<=1600,'Place a PLC and select a supported language.');
    const program=language==='ST'?compileProgram(source):compileLadder(source);
    action(p,'command',[name,{language,source}]);
    controllers.set(p,program);r.program={language,source};r.controller={...newController(),COUNT:r.count};r.diagnostic=null;
    record(p,'program',plc.id,'Controller program installed at scan '+r.scan);
  } else if (name==='predict') {
    number(args.seconds,0,3600); action(p,'command',[name,{seconds:args.seconds}]);
    r.prediction={seconds:args.seconds,carton:'CT-'+(r.cartons.length+1)};
  } else if (name==='disconnect') {
    const {from,port}=args;
    requireValue(p.links.some(l=>l.from===from && l.port===port),'Cable not found.');
    action(p,'command',[name,{from,port}]);p.links=p.links.filter(l=>l.from!==from || l.port!==port);
  } else if (name==='evidence') {
    const {phase,tester,witness,authority}=args;
    requireValue(['FAT','SAT','Integrated'].includes(phase),'Invalid commissioning phase.');
    for (const v of [tester,witness,authority]) requireValue(typeof v==='string' && v.trim() && v.length<=80,'Enter the commissioning roles.');
    requireValue(new Set([tester,witness,authority].map(s=>s.trim().toLowerCase())).size===3,'Tester, witness and acceptance authority must be distinct.');
    requireValue(r.evidence.length<256,'Evidence register full.');
    const ids=phase==='FAT'?['counter','hmi']:phase==='SAT'?['sensor','video']:['pallet','erp'];
    action(p,'command',[name,{phase,tester,witness,authority}],500+r.cartons.length*(1+r.pallets.length));
    const checks=assess(p).filter(c=>ids.includes(c.id));
    if (phase==='Integrated') {
      const recovered=r.pallets.find(pal=>{
        const c=r.cartons.find(c=>c.id===pal.carton), path=c?.recovery;
        return path?.reason==='Vacuum pickup failed' && path.faultAt<=path.resetAt && path.resetAt<=pal.placedAt
          && pal.lostAckAt>=pal.placedAt && pal.confirmedAt>=pal.lostAckAt && pal.attempts>=2 && pal.status==='confirmed';
      });
      checks.push({id:'fault-recovery',pass:Boolean(recovered),reason:recovered?'Recovered '+recovered.carton+' and reconciled '+recovered.id+'.':'Inject vacuum failure, repair and reset. Lose the acknowledgement for that pallet, retry and confirm one movement.'});
    }
    r.evidence.push({phase,tester,witness,authority,scan:r.scan,pass:checks.every(c=>c.pass),checks});
  } else throw new Error('Unknown workshop command.');
}
function metadata(value,level=0) {
  requireValue(level<=12,'Project metadata nesting limit exceeded.');
  if (value===null || typeof value==='boolean' || Number.isFinite(value)) return;
  if (typeof value==='string') { requireValue(value.length<=131072,'Metadata string too long.');return; }
  requireValue(value && typeof value==='object' && Object.keys(value).length<=4096,'Invalid project metadata.');
  for (const [key,child] of Object.entries(value)) {
    requireValue(!['__proto__','prototype','constructor'].includes(key) && key.length<=128,'Invalid metadata field.');
    metadata(child,level+1);
  }
}
export function saveProject(p) {
  const {format,version,start,seed,history,learning,extensions}=p;
  metadata(learning);metadata(extensions);
  const raw=JSON.stringify({format,version,start,seed,history,learning,extensions});
  requireValue(new TextEncoder().encode(raw).length<=MAX_BYTES,'Project exceeds 2 MiB.');
  return raw;
}
export function loadProject(raw) {
  requireValue(typeof raw==='string' && raw.length<=MAX_BYTES && new TextEncoder().encode(raw).length<=MAX_BYTES,'Project exceeds 2 MiB.');
  const d=JSON.parse(raw);
  requireValue(d?.format==='oia-workshop' && d.version===1 && Array.isArray(d.history) && d.history.length<=20000,'Unsupported workshop project.');
  requireValue(d.learning && !Array.isArray(d.learning) && typeof d.learning==='object' && d.extensions && !Array.isArray(d.extensions) && typeof d.extensions==='object','Invalid project metadata.');
  metadata(d.learning);metadata(d.extensions);
  requireValue(typeof d.learning.notebook==='string' && Array.isArray(d.learning.bookmarks) && typeof d.learning.depth==='string' && Number.isInteger(d.learning.chapter),'Invalid learner profile.');
  requireValue(['reference','blank'].includes(d.start) && Number.isSafeInteger(d.seed),'Missing project origin.');
  const p=createProject(d.start,d.seed), actions={addAsset,configure,connect,addCarton,step,command};
  for (const row of d.history) {
    requireValue(Array.isArray(row) && typeof row[0]==='string' && Object.hasOwn(actions,row[0]) && row.length<=5,'Invalid recorded action.');
    const [name,...args]=row;
    actions[name](p,...args);
  }
  p.learning=d.learning;p.extensions=d.extensions;
  return p;
}
