import {freshAdvanced,checkAdvanced} from './advanced-schema.mjs';
const idPattern = /^[A-Za-z][A-Za-z0-9_-]{0,23}$/;
export const kinds = ['camera', 'viewer', 'recorder', 'reader', 'controller', 'switch', 'router', 'server','plc','io','gateway'];
export const protocols = ['icmp', 'video', 'archive', 'door', 'dns', 'ntp', 'admin','modbus','opcua','mqtt'];
const servicePorts = {icmp:'ICMP echo', video:'RTSP 554', archive:'HTTPS 443', door:'controller 4370', dns:'DNS 53', ntp:'NTP 123', admin:'SSH 22',modbus:'Modbus TCP 502',opcua:'OPC UA 4840',mqtt:'MQTT 1883'};
export const newRack = () => ({format:'oia.rack',version:1,advanced:freshAdvanced(),devices:[],links:[],rules:[],clock:0,clips:[],backup:null,outage:null,recovery:null,events:[],packets:[],mac:[],hits:[],bindings:[],leases:[],sequence:0,process:{count:0,previous:false,sensor:false,sampledAt:null,quality:'Unknown',lastValue:null,sourceTime:null,arrivalTime:null,pending:[],posted:[]},background:[]});
function check(value, message) { if (!value) throw new Error(message); }
function finite(n,min,max) {return Number.isFinite(n) && n>=min && n<=max;}
function integer(n,min,max){return Number.isInteger(n)&&finite(n,min,max);}
function validId(id){return typeof id==='string' && idPattern.test(id);}
export function ipv4(s) {
  if(typeof s!=='string'||! /^(0|[1-9]\d{0,2})(\.(0|[1-9]\d{0,2})){3}$/.test(s))return null;
  const octets=s.split('.').map(Number);
  return octets.every(n=>n<=255)?octets.reduce((a,n)=>a*256+n,0):null;
}
const sameNet=(a,b,p)=>Math.floor(ipv4(a)/2**(32-p))===Math.floor(ipv4(b)/2**(32-p));
const byId=(r,id)=>r.devices.find(d=>d.id===id);
const infrastructure=d=>['switch','router'].includes(d.kind);
export function device(id,kind,ip='10.24.10.10') {
  return {id,kind,ip,prefix:24,gateway:'10.24.10.1',power:true,budgetW:60,drawW:kind==='camera'?8:0,bitrate:4,clockOffset:0,service:true,credential:true,cert:true,storageGB:250,addressPool:4,groups:['operator'],zone:'cell',interfaces:[]};
}
function validateDevice(d) {
  check(d&&validId(d.id)&&kinds.includes(d.kind),'Use a unique asset ID and supported equipment type.');
  check(ipv4(d.ip)!==null&&ipv4(d.gateway)!==null&&integer(d.prefix,1,30),'Check IPv4 address, gateway and prefix (1 to 30).');
  check(['power','service','credential','cert'].every(k=>typeof d[k]==='boolean'),'Invalid service state.');
  check(finite(d.budgetW,0,10000)&&finite(d.drawW,0,1000)&&finite(d.bitrate,0.1,1000)&&finite(d.storageGB,0.001,1000000)&&finite(d.clockOffset,-86400,86400),'Equipment value outside model bounds.');
  check(integer(d.addressPool??4,1,64),'Address pool must contain 1 to 64 leases.');
  check(validId(d.zone)&&Array.isArray(d.groups)&&d.groups.length<=12&&d.groups.every(validId),'Invalid zone or identity group.');
  check(Array.isArray(d.interfaces)&&d.interfaces.length<=16&&d.interfaces.every(i=>integer(i.vlan,1,4094)&&ipv4(i.ip)!==null&&integer(i.prefix,1,30)),'Invalid router interface.');
  check(new Set(d.interfaces.map(i=>i.vlan)).size===d.interfaces.length,'A router has one interface per VLAN.');
}
export function putDevice(r,d) {
  validateDevice(d);
  check(Object.keys(d).every(k=>Object.hasOwn(device(d.id,d.kind),k)),'Unknown equipment parameter.');
  check(d.interfaces.every(i=>Object.keys(i).every(k=>['vlan','ip','prefix'].includes(k))),'Unknown router interface field.');
  const old=byId(r,d.id);
  check(!old || old.kind===d.kind,'An existing ID belongs to another type.');
  if(old)Object.assign(old,structuredClone(d));
  else {check(r.devices.length<48,'Rack full (48 assets).');r.devices.push(structuredClone(d));}
}
export function patch(r,link) {
  const {id,a,b,pa,pb,vlans,mode,media,opticA,opticB,up,capacity}=link;
  check(Object.keys(link).every(k=>['id','a','b','pa','pb','vlans','peerVlans','mode','media','opticA','opticB','up','capacity'].includes(k)),'Unknown patch parameter.');
  check(validId(id)&&byId(r,a)&&byId(r,b)&&a!==b,'Select distinct installed endpoints.');
  check(integer(pa,1,48)&&integer(pb,1,48),'Ports range from 1 to 48.');
  check([['switch','router'].includes(byId(r,a).kind)||pa===1,['switch','router'].includes(byId(r,b).kind)||pb===1].every(Boolean),'End stations use port 1.');
  check(['access','trunk'].includes(mode)&&Array.isArray(vlans)&&vlans.length>0&&vlans.length<=16&&vlans.every(v=>integer(v,1,4094))&&(mode!=='access'||vlans.length===1),'Use one access VLAN or a trunk allowlist.');
  check(link.peerVlans===undefined||(Array.isArray(link.peerVlans)&&link.peerVlans.length>0&&link.peerVlans.length<=16&&link.peerVlans.every(v=>integer(v,1,4094))),'Invalid peer VLAN allowlist.');
  check(mode!=='trunk'||[a,b].every(id=>infrastructure(byId(r,id))),'Trunks require infrastructure at both ends.');
  check(['copper','fibre'].includes(media)&&['SX','LX'].includes(opticA)&&['SX','LX'].includes(opticB)&&typeof up==='boolean'&&finite(capacity,0.01,100000),'Check medium, optics, link state and capacity.');
  check(!r.links.some(l=>l.id!==id&&[[l.a,l.pa],[l.b,l.pb]].some(([d,p])=>(d===a&&p===pa)||(d===b&&p===pb))),'A selected port already has a patch lead.');
  const ix=r.links.findIndex(l=>l.id===id);
  if(ix<0){check(r.links.length<96,'Patch schedule full.');r.links.push(structuredClone(link));} else r.links[ix]=structuredClone(link);
}
export function setRule(r,from,to,protocol,allowed){
  check(validId(from)&&validId(to)&&protocols.includes(protocol)&&typeof allowed==='boolean','Invalid firewall rule.');
  const match=x=>x.from===from&&x.to===to&&x.protocol===protocol;
  r.rules=r.rules.filter(x=>!match(x));if(allowed){check(r.rules.length<160,'Rule table full.');r.rules.push({from,to,protocol});}
}
export function referenceRack() {
  const r=newRack();
  for(const [id,kind,ip] of [['EDGE','switch','10.24.10.2'],['CORE','switch','10.24.20.2'],['GW','router','10.24.10.1'],['CAM','camera','10.24.10.11'],['VIEW','viewer','10.24.10.12'],['NVR','recorder','10.24.20.21'],['READ','reader','10.24.20.22'],['DOOR','controller','10.24.20.23'],['INFRA','server','10.24.20.30'],['PLC','plc','10.24.10.31'],['DI','io','10.24.10.32'],['GATE','gateway','10.24.20.33']]){
    const d=device(id,kind,ip);if(ip.startsWith('10.24.20.')){d.gateway='10.24.20.1';d.zone='services';}
    if(kind==='router')d.interfaces=[{vlan:10,ip:'10.24.10.1',prefix:24},{vlan:20,ip:'10.24.20.1',prefix:24}];putDevice(r,d);
  }
  for(const [a,pa,b,pb,vlans] of [['CAM',1,'EDGE',1,[10]],['VIEW',1,'EDGE',2,[10]],['EDGE',8,'CORE',8,[10,20]],['CORE',7,'GW',1,[10,20]],['NVR',1,'CORE',1,[20]],['READ',1,'CORE',2,[20]],['DOOR',1,'CORE',3,[20]],['INFRA',1,'CORE',4,[20]],['PLC',1,'EDGE',3,[10]],['DI',1,'EDGE',5,[10]],['GATE',1,'CORE',5,[20]]])patch(r,{id:a+'_'+b,a,pa,b,pb,mode:vlans.length>1?'trunk':'access',vlans,media:'copper',opticA:'SX',opticB:'SX',capacity:100,up:true});
  setRule(r,'services','cell','video',true);setRule(r,'cell','services','archive',true);setRule(r,'cell','services','dns',true);setRule(r,'cell','services','ntp',true);setRule(r,'services','cell','opcua',true);
  return r;
}
const incidentLinks=(r,id)=>r.links.filter(l=>l.a===id||l.b===id);
const other=(l,id)=>l.a===id?l.b:l.a;
export const portAt=(l,id)=>l.a===id?l.pa:l.pb;
export function physical(r,l) {
  if(!l.up)return 'Cable disconnected';
  if([l.a,l.b].some(id=>!byId(r,id)?.power))return 'Supply off';
  if(l.media==='fibre'&&l.opticA!==l.opticB)return 'Optics mismatch';
  for(const id of [l.a,l.b]){
    const d=byId(r,id);if(!d.drawW)continue;
    const sw=byId(r,other(l,id));
    if(l.media!=='copper'||sw.kind!=='switch')return 'Power over Ethernet unavailable';
    let used=0;
    for(const candidate of incidentLinks(r,sw.id).filter(x=>x.up&&x.media==='copper').sort((a,b)=>portAt(a,sw.id)-portAt(b,sw.id))){
      const client=byId(r,other(candidate,sw.id));
      if(!client.power||client.drawW===0||used+client.drawW>sw.budgetW){if(candidate.id===l.id)return 'Power budget exceeded';continue;}
      used+=client.drawW;if(candidate.id===l.id)break;
    }
  }
  return 'Link up';
}
function paths(r,start,vlan) {
  const paths=new Map([[start,[]]]), queue=[start];
  for(let i=0;i<queue.length;i++){
    const id=queue[i];
    if(id!==start&&byId(r,id).kind!=='switch')continue;
    for(const link of incidentLinks(r,id)){
      const next=other(link,id);
      if(paths.has(next)||!link.vlans.includes(vlan)||(link.peerVlans&&!link.peerVlans.includes(vlan))||physical(r,link)!=='Link up')continue;
      paths.set(next,[...paths.get(id),link]);queue.push(next);
    }
  }
  return paths;
}
function audit(r,kind,message){r.events.push({time:r.clock,kind,message});r.events=r.events.slice(-240);}
export function probe(r,from,to,protocol='icmp',observe=false) {
  const a=byId(r,from),b=byId(r,to), trace=[], hops=[];
  const result=(ok,reason)=>({ok,reason,protocol,trace,hops:[...hops]});
  if(!a||!b||infrastructure(a)||infrastructure(b)||a===b||!protocols.includes(protocol))return result(false,'Select two different end stations.');
  const af=incidentLinks(r,from)[0],bf=incidentLinks(r,to)[0];
  if(!af||!bf)return result(false,'No patch lead');
  for(const l of [af,bf])if(physical(r,l)!=='Link up')return result(false,physical(r,l));
  const av=af.vlans[0],bv=bf.vlans[0],visible=paths(r,from,av);
  const duplicate=(d,tree)=>r.devices.some(x=>x.id!==d.id&&!infrastructure(x)&&x.ip===d.ip&&tree.has(x.id));
  if(duplicate(a,visible)||duplicate(b,paths(r,to,bv)))return result(false,'Duplicate IPv4 address in broadcast domain');
  function frame(start,end,tree,vlan) {
    const route=tree.get(end);
    const key=start+'/'+end+'/'+vlan;
    const cache=observe&&r.mac.find(x=>x.key===key&&x.expiry>r.clock&&x.path===route?.map(l=>l.id).join('/'));
    if(!cache)trace.push({kind:'ARP broadcast',vlan,at:[...tree.keys()],from:start,to:end});
    if(!route)return false;
    const nodes=[start];for(const l of route)nodes.push(other(l,nodes.at(-1)));
    trace.push({kind:servicePorts[protocol],vlan,at:nodes,from:start,to:end});
    hops.push(...route.map(l=>l.id));
    if(observe){
      for(let i=1;i<nodes.length;i++){
        const sw=byId(r,nodes[i]);if(sw.kind!=='switch')continue;
        const addr=hardwareAddress(r,start),port=portAt(route[i-1],sw.id);
        r.bindings=r.bindings.filter(b=>!(b.switch===sw.id&&b.vlan===vlan&&b.addr===addr)).slice(-191);
        r.bindings.push({switch:sw.id,vlan,addr,port,expiry:r.clock+300});
      }
    }
    if(observe&&!cache){r.mac=r.mac.filter(x=>x.key!==key).slice(-127);r.mac.push({key,path:route.map(l=>l.id).join('/'),expiry:r.clock+60});}
    return true;
  }
  let ok;
  if(sameNet(a.ip,b.ip,a.prefix)){
    ok=frame(from,to,visible,av);
    if(!ok)return result(false,'ARP unresolved on source VLAN');
    if(!sameNet(a.ip,b.ip,b.prefix))return result(false,'Asymmetric subnet masks: return path differs');
  }else {
    const router=r.devices.find(d=>d.kind==='router'&&visible.has(d.id)&&d.interfaces.some(i=>i.vlan===av&&i.ip===a.gateway&&sameNet(i.ip,a.ip,i.prefix)&&sameNet(a.ip,i.ip,a.prefix)));
    if(!router)return result(false,'Gateway unreachable');
    frame(from,router.id,visible,av);
    const egress=router.interfaces.find(i=>i.vlan===bv&&sameNet(i.ip,b.ip,i.prefix));
    if(!egress||b.gateway!==egress.ip||!sameNet(b.ip,egress.ip,b.prefix))return result(false,'Missing route or return gateway');
    const permitted=r.rules.some(rule=>rule.from===a.zone&&rule.to===b.zone&&rule.protocol===protocol);
    if(observe){r.hits.push({time:r.clock,from,to,protocol,permitted});r.hits=r.hits.slice(-120);}
    if(!permitted)return result(false,'Firewall denied '+servicePorts[protocol]);
    if(!frame(router.id,to,paths(r,router.id,bv),bv))return result(false,'No egress path on destination VLAN');
  }
  if(protocol==='icmp')return result(true,'Echo reply');
  if(!b.service)return result(false,'Destination service stopped');
  const serverKinds={video:['camera'],archive:['recorder'],door:['controller'],dns:['server'],ntp:['server'],admin:['server','recorder'],modbus:['io'],opcua:['plc'],mqtt:['server']};
  if(!serverKinds[protocol].includes(b.kind))return result(false,'Port closed');
  if(['archive','admin'].includes(protocol)&&!b.cert)return result(false,'Certificate expired');
  if(['video','archive','door','admin'].includes(protocol)){
    if(!a.credential||!a.groups.some(g=>b.groups.includes(g)))return result(false,'Identity denied');
    if(Math.abs(a.clockOffset-b.clockOffset)>5)return result(false,'Clock offset beyond 5 s');
  }
  if(protocol==='video'&&hops.some(id=>r.links.find(l=>l.id===id).capacity-backgroundLoad(r,id)<b.bitrate))return result(false,'Insufficient stream capacity');
  return result(true,'Session established');
}
export function inspect(r,from,to,protocol){
  const p=probe(r,from,to,protocol,true);
  r.packets.push(...p.trace.map(f=>({...f,time:r.clock})));r.packets=r.packets.slice(-160);
  audit(r,'probe',from+' → '+to+' '+servicePorts[protocol]+': '+p.reason);return p;
}
export function payloadGB(streams,mbit,hours,duty=1){check(integer(streams,1,48)&&finite(mbit,.1,1000)&&finite(hours,0,8760)&&finite(duty,0,1),'Invalid recording assumptions.');return streams*mbit*3600*hours*duty/8000;}
export function tick(r,seconds){check(integer(seconds,1,86400)&&r.clock+seconds<=1e8,'Invalid elapsed seconds.');r.clock+=seconds;}
export function record(r,recorder,camera,seconds=30){
  check(integer(seconds,1,3600)&&r.clips.length<500,'Recording limit exceeded.');
  const result=inspect(r,recorder,camera,'video');const n=byId(r,recorder);
  check(n?.kind==='recorder'&&n.service,'Recording service offline');check(result.ok,result.reason);
  const gb=payloadGB(1,byId(r,camera).bitrate,seconds/3600);
  check(r.clips.filter(c=>c.recorder===recorder).reduce((n,c)=>n+c.gb,gb)<=n.storageGB,'Recording volume full');
  const start=r.clock;tick(r,seconds);const clip={id:++r.sequence,camera,recorder,start,end:r.clock,gb};r.clips.push(clip);
  audit(r,'record','Stored clip '+clip.id);return clip;
}
export function retrieve(r,viewer,recorder,id){
  const p=inspect(r,viewer,recorder,'archive');check(p.ok,p.reason);
  const clip=r.clips.find(c=>c.recorder===recorder&&c.id===id);check(clip,'Clip missing on selected recorder');audit(r,'retrieve','Retrieved clip '+clip.id);return clip;
}
export function door(r,reader,controller,group){
  check(byId(r,reader)?.kind==='reader','Select a credential reader.');
  const p=inspect(r,reader,controller,'door');
  const ok=p.ok&&byId(r,controller).groups.includes(group);
  audit(r,'access',reader+' / '+controller+' / '+group+' / '+(ok?'granted':p.ok?'credential denied':p.reason));return ok;
}
export function snapshot(r,recorder){
  check(byId(r,recorder)?.kind==='recorder'&&byId(r,recorder).power&&byId(r,recorder).service,'Recorder offline.');
  const clips=r.clips.filter(c=>c.recorder===recorder);r.backup={recorder,time:r.clock,clips:structuredClone(clips)};audit(r,'backup','Protected '+clips.length+' clips.');
}
export function failVolume(r,recorder){
  const d=byId(r,recorder);check(d?.kind==='recorder'&&d.service&&!r.outage,'Recorder already down or missing.');
  const clips=r.clips.filter(c=>c.recorder===recorder);
  r.outage={recorder,time:r.clock,ids:clips.map(c=>c.id)};d.service=false;r.clips=r.clips.filter(c=>c.recorder!==recorder);audit(r,'outage','Volume lost at '+recorder);
}
export function restore(r){
  const {outage,backup}=r;check(outage&&backup&&backup.recorder===outage.recorder,'No matching recovery point.');
  const d=byId(r,outage.recorder);check(d.power,'Recorder supply off.');
  r.clips=[...r.clips.filter(c=>c.recorder!==d.id),...structuredClone(backup.clips)];d.service=true;
  r.recovery={recorder:d.id,elapsedS:r.clock-outage.time,pointAgeS:outage.time-backup.time,lostClips:outage.ids.filter(id=>!backup.clips.some(c=>c.id===id)).length};
  r.outage=null;audit(r,'restore','Volume restored. Verify event retrieval.');return r.recovery;
}
export function assess(r,{camera,viewer,recorder,uplink}){
  const video=probe(r,viewer,camera,'video'), remote=probe(r,recorder,camera,'video'), archive=probe(r,viewer,recorder,'archive');
  const management=probe(r,viewer,recorder,'admin');
  const l=r.links.find(x=>x.id===uplink), isolated=structuredClone(r);
  if(l)isolated.links.find(x=>x.id===uplink).up=false;
  const offline=probe(isolated,viewer,camera,'video'),noRecording=probe(isolated,recorder,camera,'video');
  const clip=r.clips.find(c=>c.recorder===recorder&&c.camera===camera);
  return [
    {name:'Viewing station receives camera video',ok:video.ok,detail:video.reason},
    {name:'Recorder reaches camera across routed boundary',ok:remote.ok&&new Set(remote.trace.map(f=>f.vlan)).size===2,detail:remote.reason},
    {name:'Viewer retrieves stored camera event',ok:archive.ok&&Boolean(clip),detail:archive.ok?(clip?'Retrievable clip '+clip.id:'No matching stored clip'):archive.reason},
    {name:'Management port denied at the firewall',ok:management.reason.startsWith('Firewall denied'),detail:management.reason},
    {name:'Local video survives loss of the recording uplink',ok:Boolean(l?.up)&&remote.ok&&offline.ok&&!noRecording.ok,detail:offline.reason+' locally / '+noRecording.reason+' at recorder'}
  ];
}
function limitedList(items,limit,f,testMessage){check(Array.isArray(items)&&items.length<=limit,testMessage);for(const x of items)check(f(x),testMessage);}
export function importRack(data) {
  check(typeof data==='string'&&data.length<=256000,'Rack project exceeds 256 kB.');
  const src=JSON.parse(data,(key,value)=>{check(!['__proto__','prototype','constructor'].includes(key),'Unsafe rack field.');return value;}),r=newRack();check(src?.format===r.format&&src.version===r.version,'Unsupported rack project.');
  limitedList(src.devices,48,d=>{putDevice(r,d);return true;},'Invalid equipment schedule.');
  check(src.devices.length===r.devices.length,'Duplicate equipment ID.');
  limitedList(src.links,96,l=>{patch(r,l);return true;},'Invalid patch schedule.');check(src.links.length===r.links.length,'Duplicate lead ID.');
  limitedList(src.rules,160,x=>{setRule(r,x.from,x.to,x.protocol,true);return true;},'Invalid rule table.');
  const plain=(value,allowed)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>allowed.includes(k));
  check(plain(src,Object.keys(r)),'Unknown rack project fields.');
  const proc=src.process??r.process;
  check(plain(proc,Object.keys(r.process)),'Unknown control image fields.');
  proc.sampledAt??=proc.sourceTime??null;
  check(proc.sampledAt===null||integer(proc.sampledAt,0,src.clock),'Invalid source scan time.');
  check(integer(proc.count,0,1e8)&&typeof proc.previous==='boolean'&&typeof proc.sensor==='boolean'&&['Unknown','Good','Stale'].includes(proc.quality),'Invalid control image.');
  check(proc.lastValue===null||integer(proc.lastValue,0,1e8),'Invalid telemetry count.');
  for(const key of ['sourceTime','arrivalTime'])check(proc[key]===null||integer(proc[key],0,src.clock),'Invalid telemetry timestamp.');
  check((proc.lastValue===null)===(proc.sourceTime===null)&&(proc.sourceTime===null||proc.sourceTime<=proc.arrivalTime)&&(proc.quality!=='Good'||proc.lastValue!==null),'Inconsistent telemetry snapshot.');
  const msg=x=>plain(x,['id','value','time'])&&integer(x.id,1,src.sequence)&&integer(x.value,0,1e8)&&integer(x.time,0,src.clock);
  limitedList(proc.pending,500,msg,'Invalid broker queue.');limitedList(proc.posted,500,msg,'Invalid broker ledger.');check([proc.pending,proc.posted].every(items=>new Set(items.map(v=>v.id)).size===items.length),'Duplicate observation ID.');r.process=proc;
  limitedList(src.background??[],64,e=>byId(r,e.from)&&byId(r,e.to)&&e.from!==e.to&&finite(e.rate,0.01,100000),'Invalid background flow.');
  check(new Set((src.background??[]).map(f=>f.from+'/'+f.to)).size===(src.background??[]).length,'Duplicate traffic flow.');r.background=src.background??[];
  check(integer(src.clock,0,1e8)&&integer(src.sequence,0,1e8),'Invalid recorder clock or sequence.');
  r.clock=src.clock;r.sequence=src.sequence;
  const validClip=c=>integer(c?.id,1,r.sequence)&&byId(r,c.recorder)?.kind==='recorder'&&byId(r,c.camera)?.kind==='camera'&&integer(c.start,0,r.clock)&&integer(c.end,c.start+1,r.clock)&&finite(c.gb,0.0000001,10000);
  function clips(list){limitedList(list,500,validClip,'Invalid clip register.');check(new Set(list.map(c=>c.id)).size===list.length,'Duplicate clip ID.');return list;}
  r.clips=clips(src.clips);
  const time=t=>integer(t,0,r.clock),label=s=>typeof s==='string'&&s.length<=240;
  if(src.backup!==null){const b=src.backup;check(b&&time(b.time)&&byId(r,b.recorder)?.kind==='recorder','Invalid backup point.');clips(b.clips);check(b.clips.every(c=>c.end<=b.time&&c.recorder===b.recorder),'Invalid backup contents.');r.backup=b;}
  if(src.outage!==null){const o=src.outage;check(o&&time(o.time)&&byId(r,o.recorder)?.kind==='recorder','Invalid outage.');limitedList(o.ids,500,id=>integer(id,1,r.sequence),'Invalid outage manifest.');r.outage=o;}
  if(src.recovery!==null){const x=src.recovery;check(x&&byId(r,x.recorder)?.kind==='recorder'&&time(x.elapsedS)&&time(x.pointAgeS)&&integer(x.lostClips,0,500),'Invalid recovery report.');r.recovery=x;}
  limitedList(src.events,240,e=>time(e.time)&&label(e.kind)&&label(e.message),'Invalid audit log.');r.events=src.events;
  limitedList(src.packets,160,p=>time(p.time)&&label(p.kind)&&integer(p.vlan,1,4094)&&byId(r,p.from)&&byId(r,p.to)&&Array.isArray(p.at)&&p.at.length<=48&&p.at.every(id=>byId(r,id)),'Invalid packet capture.');r.packets=src.packets;
  limitedList(src.mac,128,m=>label(m.key)&&(typeof m.path==='string'&&m.path.length<=2400)&&integer(m.expiry,0,r.clock+60),'Invalid neighbour cache.');r.mac=src.mac;
  limitedList(src.hits,120,h=>time(h.time)&&byId(r,h.from)&&byId(r,h.to)&&protocols.includes(h.protocol)&&typeof h.permitted==='boolean','Invalid firewall log.');r.hits=src.hits;
  limitedList(src.bindings??[],192,b=>byId(r,b.switch)?.kind==='switch'&&integer(b.vlan,1,4094)&&/^02(:[0-9a-f]{2}){5}$/.test(b.addr)&&integer(b.port,1,48)&&integer(b.expiry,0,r.clock+300),'Invalid learned MAC table.');r.bindings=src.bindings??[];
  limitedList(src.leases??[],64,l=>byId(r,l.server)?.kind==='server'&&byId(r,l.client)&&ipv4(l.ip)!==null&&integer(l.expiry,0,r.clock+3600),'Invalid address lease.');r.leases=src.leases??[];
  r.advanced=checkAdvanced(src.advanced??freshAdvanced(),r);
  return r;
}

export function hardwareAddress(r,id){
  const pos=r.devices.findIndex(d=>d.id===id);check(pos>=0,'Unknown interface.');
  return '02:00:00:00:00:'+(pos+1).toString(16).padStart(2,'0');
}
const toIP=n=>[24,16,8,0].map(b=>Math.floor(n/2**b)%256).join('.');
export function lease(r,client,server){
  const c=byId(r,client),s=byId(r,server);check(c&&!infrastructure(c)&&s?.kind==='server'&&s.service&&c!==s,'Select a DHCP server and a different end station.');
  const link=incidentLinks(r,client)[0];check(link&&paths(r,client,link.vlans[0]).has(server),'DHCP discovery did not reach the server on this VLAN.');
  const n=ipv4(s.ip),size=2**(32-s.prefix),base=Math.floor(n/size)*size;
  const occupied=new Set(r.devices.filter(d=>d!==c).map(d=>d.ip));occupied.add(s.gateway);
  const active=r.leases.filter(l=>l.expiry>r.clock&&l.client!==client);
  const count=Math.min(s.addressPool??4,size-2);
  let available;for(let i=0;i<count;i++){
    const ip=toIP(base+size-2-i);
    if(!occupied.has(ip)&&!active.some(l=>l.ip===ip)){available=ip;break;}
  }
  check(available,'DHCP pool exhausted.');
  c.ip=available;c.prefix=s.prefix;c.gateway=s.gateway;
  const l={client,server,ip:available,expiry:r.clock+3600};r.leases=[...active,l];audit(r,'DHCP','Leased '+available+' to '+client+' for 3600 s');return l;
}
export function resolveName(r,client,server,name){
  const result=inspect(r,client,server,'dns');check(result.ok,result.reason);
  const target=r.devices.find(d=>d.id.toLowerCase()+'.cell.test'===name.trim().toLowerCase());
  check(target,'DNS name has no address record');audit(r,'DNS',name+' → '+target.ip);return target.ip;
}
export function synchronise(r,client,server){
  const result=inspect(r,client,server,'ntp');check(result.ok,result.reason);
  const d=byId(r,client),s=byId(r,server),old=d.clockOffset;d.clockOffset=s.clockOffset;
  audit(r,'NTP',client+' clock corrected by '+(s.clockOffset-old)+' s');return d.clockOffset;
}

export function backgroundLoad(r,lead){
  return r.background.reduce((total,flow)=>{
    const route=probe(r,flow.from,flow.to,'icmp');
    return total+(route.ok&&route.hops.includes(lead)?flow.rate:0);
  },0);
}
export function setLoad(r,from,to,rate){
  check(byId(r,from)&&byId(r,to)&&from!==to&&finite(rate,0,100000),'Choose distinct hosts and a valid offered rate.');
  const flows=r.background.filter(f=>!(f.from===from&&f.to===to));if(rate>0)flows.push({from,to,rate});
  check(flows.length<=64,'Background flow limit.');r.background=flows;
}
export function controlCycle(r,plc,io,value){
  check(byId(r,plc)?.kind==='plc'&&typeof value==='boolean','Select a programmable logic controller.');
  check(byId(r,plc).service&&byId(r,plc).power,'PLC scan service stopped');
  const p=inspect(r,plc,io,'modbus');check(p.ok,p.reason);
  tick(r,1);const m=r.process;m.sensor=value;m.sampledAt=r.clock;if(value&&!m.previous)m.count++;m.previous=value;
  audit(r,'cycle',plc+' read '+io+' = '+Number(value)+'; count '+m.count);return m.count;
}
export function sampleTag(r,gateway,plc){
  check(byId(r,gateway)?.kind==='gateway','Select a supervisory gateway.');
  const result=inspect(r,gateway,plc,'opcua'),m=r.process;m.arrivalTime=r.clock;
  if(!result.ok){m.quality='Stale';audit(r,'quality','Retained previous count; '+result.reason);return false;}
  if(m.sampledAt===null){m.quality='Unknown';audit(r,'quality','No completed source scan');return false;}
  m.lastValue=m.count;m.sourceTime=m.sampledAt;m.quality='Good';return true;
}
export function enqueueTag(r){
  const m=r.process;check(m.quality==='Good'&&m.lastValue!==null,'Acquire a good source value first.');
  check(m.pending.length<500,'Queue full.');const id=++r.sequence;m.pending.push({id,time:m.sourceTime,value:m.lastValue});return id;
}
export function publishTag(r,gateway,broker,dropAck=false){
  check(byId(r,gateway)?.kind==='gateway','Select a publishing gateway.');const m=r.process,msg=m.pending[0];check(msg,'Queue is empty.');
  const p=inspect(r,gateway,broker,'mqtt');check(p.ok,p.reason);
  if(!m.posted.some(x=>x.id===msg.id)){check(m.posted.length<500,'Consumer ledger full.');m.posted.push({...msg});}
  if(!dropAck)m.pending.shift();audit(r,'broker','Message '+msg.id+(dropAck?' committed; acknowledgement lost':' acknowledged'));return msg.id;
}
