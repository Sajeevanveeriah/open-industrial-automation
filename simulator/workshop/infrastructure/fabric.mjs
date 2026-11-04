import {inspectCustody} from './advanced-schema.mjs';
import {physical,portAt,device,putDevice,patch,referenceRack,record,retrieve,probe} from './rack.mjs';
import {range,ipv6} from './advanced-schema.mjs';
const ok=(c,m)=>{if(!c)throw Error(m);};
const get=(r,id)=>r.devices.find(d=>d.id===id);
const next=(l,id)=>l.a===id?l.b:l.a;
const fixed=(n,d=3)=>Number(n.toFixed(d));
const isSwitch=(r,id)=>get(r,id)?.kind==='switch';
const incident=(r,id)=>r.links.filter(l=>l.a===id||l.b===id);
function vlanAt(r,id){const l=incident(r,id)[0];ok(l&&!isSwitch(r,id)&&get(r,id)?.kind!=='router','Choose a patched end station.');return l.vlans[0];}
function selectedBundle(r){
  const links=r.advanced.lagGroup.map(id=>r.links.find(l=>l.id===id));
  if(!r.advanced.bundle||!links.length)return new Set();
  const [first]=links,ends=[first.a,first.b].sort().join('/');
  ok(links.every(l=>[l.a,l.b].sort().join('/')===ends&&isSwitch(r,l.a)&&isSwitch(r,l.b)&&l.mode==='trunk'&&l.capacity===first.capacity&&[...l.vlans].sort().join() === [...first.vlans].sort().join()&&[...(l.peerVlans??l.vlans)].sort().join() === [...(first.peerVlans??first.vlans)].sort().join()),'Group equal-speed parallel trunks with identical VLAN membership.');
  return new Set(links.map(l=>l.id));
}
function tree(r,vlan,hash=0,down=[]){
  ok(Number.isInteger(hash)&&hash>=0&&hash<=65535,'Invalid flow hash.');
  const group=selectedBundle(r),usable=r.links.filter(l=>!down.includes(l.id)&&l.vlans.includes(vlan)&&(l.peerVlans??l.vlans).includes(vlan)&&physical(r,l)==='Link up').sort((a,b)=>a.id.localeCompare(b.id));
  const members=usable.filter(l=>group.has(l.id)),member=members[hash%Math.max(1,members.length)],roots=new Map(),edges=[];
  const root=id=>{while(roots.has(id))id=roots.get(id);return id;};
  for(const link of usable){
    if(group.has(link.id)&&link!==member)continue;
    if(!isSwitch(r,link.a)||!isSwitch(r,link.b)){edges.push(link);continue;}
    const a=root(link.a),b=root(link.b);if(a===b)continue;
    roots.set(b,a);edges.push(link);
  }
  return edges;
}
function routes(r,edges,start){
  const out=new Map([[start,[]]]),queue=[start];
  for(let i=0;i<queue.length;i++){
    const id=queue[i];if(id!==start&&!isSwitch(r,id))continue;
    for(const l of edges.filter(e=>e.a===id||e.b===id)){
      const n=next(l,id);if(out.has(n))continue;out.set(n,[...out.get(id),l]);queue.push(n);
    }
  }return out;
}
function flight(route,bytes){
  return route.reduce((ms,l)=>ms+bytes*8/(l.capacity*1000)+.005,0)+Math.max(0,route.length-1)*.020;
}
function serial(r,src,dst,hash=0,down=[]){
  const v=vlanAt(r,src);return routes(r,tree(r,v,hash,down),src).get(dst);
}
export function topologyExample(type){
  const r=referenceRack(),a=r.advanced;
  const di=r.links.find(l=>l.a==='DI');patch(r,{...di,b:'CORE',pb:10});
  const link=(id,a,pa,b,pb)=>patch(r,{id,a,pa,b,pb,mode:'trunk',vlans:[10,20],media:'fibre',opticA:'SX',opticB:'SX',capacity:100,up:true});
  if(type==='parallel'){link('STANDBY','EDGE',9,'CORE',9);a.bundle=true;a.lagGroup=['EDGE_CORE','STANDBY'];}
  else if(type==='ring'){
    putDevice(r,device('TRANSIT','switch','10.24.10.3'));link('RING_A','EDGE',9,'TRANSIT',1);link('RING_B','TRANSIT',2,'CORE',9);
  }else throw Error('Unknown topology.');
  a.mirrorSwitch='EDGE';a.mirrorPort=8;a.subscribers=['DI'];a.ipv6=[{id:'PLC',address:'fd24:a::31',prefix:64},{id:'DI',address:'fd24:a::32',prefix:64}];a.lens.camera='CAM';return r;
}
export function convergence(r,from,to,broken,hash=0){
  ok(from!==to,'Choose different end stations.');const a=r.advanced,base=serial(r,from,to,hash),after=serial(r,from,to,hash,[broken]);
  const affected=Boolean(base?.some(l=>l.id===broken)),group=selectedBundle(r);
  const downtime=affected?a.detectMs+(group.has(broken)&&after?.some(l=>group.has(l.id))?0:a.forwardMs):0;
  const observations=[],sample=a.sampleMs,stop=Math.max(40,downtime+sample*2);
  for(let t=0;t<=stop;t+=sample){
    const route=affected&&t<downtime?null:after;
    observations.push({sentMs:t,returnedMs:route?fixed(t+2*flight(route,84)):null,path:route?.map(l=>l.id)??[]});
  }
  const restored=observations.find(x=>x.returnedMs!==null);
  return {before:base?.map(l=>l.id)??[],after:after?.map(l=>l.id)??[],affected,restoredMs:restored?.returnedMs??null,loss:observations.filter(x=>x.returnedMs===null).length,observations,pass:Boolean(base&&affected&&after&&restored&&restored.returnedMs<=a.deadlineMs)};
}
export function frameSequence(r,src,dst,{group=false,snoop=r.advanced.snooping}={}){
  ok(src!==dst,'Choose two different end stations.');const vlan=vlanAt(r,src),edges=tree(r,vlan),mac=new Map(),frames=[];
  const send=(from,to,description,mode)=>{
    const visits=[],station=[],mirror=[],stack=[{at:from,ingress:null}];
    while(stack.length){
      const {at,ingress}=stack.pop();
      if(ingress&&!isSwitch(r,at)){station.push(at);continue;}
      const adj=edges.filter(l=>(l.a===at||l.b===at)&&l.id!==ingress?.id);
      let candidates=adj;
      if(ingress){
        mac.set(at+'/'+from,ingress.id);
        const known=mac.get(at+'/'+to);
        if(mode==='unicast'&&known)candidates=adj.filter(l=>l.id===known);
        else if(mode==='multicast'&&snoop){
          const paths=routes(r,edges,at);
          candidates=adj.filter(l=>r.advanced.subscribers.some(id=>paths.get(id)?.[0]?.id===l.id));
        }
      }
      for(const l of candidates){
        const n=next(l,at);visits.push({link:l.id,from:at,to:n});
        if([at,n].includes(r.advanced.mirrorSwitch)&&portAt(l,r.advanced.mirrorSwitch)===r.advanced.mirrorPort)mirror.push(l.id+' '+at+' → '+n);
        stack.push({at:n,ingress:l});
      }
    }
    const result={description,from,to,station,visits,mirror};frames.push(result);return result;
  };
  if(group)send(src,r.advanced.membership,'Multicast data','multicast');
  else {
    const initial=send(src,dst,'First unicast, destination unknown','unicast');
    if(initial.station.includes(dst)){send(dst,src,'Reply learns return address','unicast');send(src,dst,'Known unicast','unicast');}
  }
  return {frames,mac:[...mac].map(([key,link])=>({key,link}))};
}
export function neighbours6(r,from,to){
  const a=r.advanced.ipv6.find(v=>v.id===from),b=r.advanced.ipv6.find(v=>v.id===to);
  ok(a&&b,'Assign both IPv6 interfaces.');const src=ipv6(a.address),target=ipv6(b.address),link=serial(r,from,to);
  const local=(x,y,p)=>x>>BigInt(128-p)===y>>BigInt(128-p);
  ok(local(src,target,a.prefix)&&local(src,target,b.prefix),'No on-link prefix or IPv6 router.');
  ok(link,'Neighbour solicitation did not reach the peer VLAN.');
  for(const v of [a,b])ok(!r.advanced.ipv6.some(x=>x.id!==v.id&&ipv6(x.address)===ipv6(v.address)&&serial(r,v.id,x.id)),'Duplicate IPv6 address on link.');
  const low=target&0xffffffn;
  return {solicitedNode:'ff02::1:ff'+(low>>16n).toString(16).padStart(2,'0')+':'+(low&65535n).toString(16).padStart(4,'0'),ethernet:'33:33:ff:'+low.toString(16).padStart(6,'0').match(/../g).join(':'),path:link.map(l=>l.id)};
}
export function precisionTime(r,from,to,offsetUs,asymmetryUs){
  const path=serial(r,from,to);ok(path,'A layer 2 time path is required.');
  ok(range(offsetUs,-1e6,1e6)&&range(asymmetryUs,0,1e5),'Invalid timing inputs.');
  const fw=flight(path,100)*1000+asymmetryUs,rv=flight(path,100)*1000;
  const t1=1000000,t2=t1+fw+offsetUs,t3=t2+1000,t4=t3-offsetUs+rv;
  const estimate=((t2-t1)-(t4-t3))/2;
  return {timestamps:[t1,t2,t3,t4].map(v=>fixed(v)),offsetEstimateUs:fixed(estimate),meanDelayUs:fixed(((t2-t1)+(t4-t3))/2),residualUs:fixed(offsetUs-estimate)};
}
export function traffic(r,from,to,{periodMs=4,congestion=10,qos=false,protocol='PROFINET RT',outageLead=null}={}){
  const path=serial(r,from,to);ok(path&&from!==to,'The cyclic producer and consumer need a common forwarding path.');
  ok(['PROFINET RT','EtherNet/IP implicit','Modbus TCP poll'].includes(protocol)&&range(periodMs,.1,1000)&&Number.isInteger(congestion)&&range(congestion,0,50),'Invalid traffic experiment.');
  const capacity=Math.min(...path.map(l=>l.capacity)),controlBytes=protocol==='PROFINET RT'?96:protocol==='EtherNet/IP implicit'?128:110;
  const events=[];for(let i=0;i<12;i++){for(let k=0;k<congestion;k++)events.push({arrival:i*periodMs,priority:0,bytes:1518});events.push({arrival:i*periodMs,priority:1,bytes:controlBytes,seq:i});}
  const queue=[],completed=[];let clock=0,cursor=0;const fail=outageLead?convergence(r,from,to,outageLead):null;
  const newPath=fail?.after.length?fail.after.map(id=>r.links.find(l=>l.id===id)):null;
  while(cursor<events.length||queue.length){
    if(!queue.length)clock=Math.max(clock,events[cursor].arrival);
    while(cursor<events.length&&events[cursor].arrival<=clock+1e-8)queue.push(events[cursor++]);
    const i=qos?queue.findIndex(e=>e.priority===1):-1,job=queue.splice(i<0?0:i,1)[0];
    const activePath=fail?.affected&&newPath&&job.arrival>=periodMs*4+(fail.restoredMs??Infinity)?newPath:path;
    const effectiveRate=activePath===path?capacity:Math.min(...activePath.map(l=>l.capacity));
    clock+=job.bytes*8/(effectiveRate*1000);
    if(job.priority){
      const failAt=periodMs*4;
      const lost=fail?.affected&&job.arrival>=failAt&&(fail.restoredMs===null||job.arrival<failAt+fail.restoredMs);
      const rest=flight(activePath,job.bytes)-job.bytes*8/(effectiveRate*1000);
      const latency=clock-job.arrival+rest+(protocol==='Modbus TCP poll'?flight(activePath,95)+.5:0);
      completed.push({cycle:job.seq,atMs:fixed(job.arrival),latencyMs:lost?null:fixed(latency),onTime:!lost&&latency<=periodMs});
    }
  }
  const latency=completed.filter(x=>x.latencyMs!==null).map(x=>x.latencyMs);
  return {protocol,capacity,cycles:completed,minMs:Math.min(...latency),maxMs:Math.max(...latency),jitterMs:fixed(Math.max(...latency)-Math.min(...latency)),failed:completed.filter(x=>!x.onTime).length};
}
export function crc16(bytes){
  let crc=65535;for(const b of bytes){crc^=b;for(let j=0;j<8;j++)crc=crc&1?(crc>>>1)^0xa001:crc>>>1;}return crc;
}
export function serialLine({hex,baud,parity,peerParity,stop,gapMs}){
  ok(typeof hex==='string'&&/^[\da-f]{2}(?:\s+[\da-f]{2}){1,251}$/i.test(hex.trim()),'Enter 2 to 252 hexadecimal bytes.');
  ok([1200,2400,4800,9600,19200].includes(baud)&&['N','E','O'].includes(parity)&&['N','E','O'].includes(peerParity)&&[1,2].includes(stop)&&range(gapMs,0,500),'Invalid UART framing or gap.');
  const bytes=hex.trim().split(/\s+/).map(h=>parseInt(h,16)),crc=crc16(bytes),frame=[...bytes,crc&255,crc>>>8],bits=1+8+(parity==='N'?0:1)+stop,charMs=1000*bits/baud;
  return {wire:frame.map(b=>b.toString(16).padStart(2,'0')).join(' ').toUpperCase(),charMs:fixed(charMs,6),durationMs:fixed(frame.length*charMs,6),minGapMs:fixed(3.5*charMs,6),ok:parity===peerParity&&gapMs>=3.5*charMs,reason:parity!==peerParity?'Parity mismatch':gapMs<3.5*charMs?'Silent interval too short':'Frame accepted'};
}
export function optics(l){
  const angle=l.yaw*Math.PI/180,focal=l.width/(2*Math.tan(l.hfov*Math.PI/360));
  function project(x,y){
    const dx=x-l.x,dy=y-l.y,forward=dx*Math.cos(angle)+dy*Math.sin(angle),side=-dx*Math.sin(angle)+dy*Math.cos(angle);
    const distance=Math.hypot(dx,dy),pixel=forward>0?l.width/2+focal*side/forward:null;
    return {distanceM:fixed(distance),axialM:fixed(forward),pixelX:pixel===null?null:fixed(pixel),visible:pixel!==null&&pixel>=0&&pixel<l.width&&distance<=l.range,featurePixels:forward>0?fixed(focal*l.featureM/forward):0};
  }
  const target=project(l.targetX,l.targetY),privacy=project(l.privateX,l.privateY);
  return {target,privacy,verticalFovDeg:fixed(2*Math.atan(l.height/(2*focal))*180/Math.PI),samplingIntervalMs:fixed(1000/l.fps),pass:target.visible&&target.featurePixels>=l.minPixels&&!privacy.visible};
}
function lensSignature(l){return Object.keys(l).sort().map(k=>k+'='+l[k]).join('|');}
export function captureSurvey(r,viewer,recorder){
  const l=r.advanced.lens,m=optics(l),cam=get(r,l.camera);
  ok(cam?.kind==='camera','Select an installed camera.');ok(m.target.visible&&m.target.featurePixels>=l.minPixels,'Target absent or insufficient image detail.');
  ok(!m.privacy.visible,'Restricted area is visible; re-aim or narrow the field before recording.');
  ok(probe(r,viewer,cam.id,'video').ok,'Viewing station cannot establish the camera session.');
  ok(r.advanced.surveys.length<120,'Optical survey register full.');const clip=record(r,recorder,cam.id,10);
  r.advanced.surveys.push({clip:clip.id,camera:cam.id,recorder,signature:lensSignature(l)});return {...m,clip};
}
export function handover(r,{actor,role,action,viewer,recorder,clipId}){
  ok(/^[A-Za-z][A-Za-z0-9_-]{0,23}$/.test(actor),'Use a synthetic staff ID.');
  const log=r.advanced.custody;
  ok(log.length<120,'Custody log full.');
  const history=log.map(e=>e.action),msg=action+' / '+clipId;
  ok(Number.isInteger(clipId)&&clipId>0,'Select a recorded synthetic event.');
  const clip=r.clips.find(c=>c.id===clipId&&c.recorder===recorder);
  ok(clip,'Recording missing on the selected server.');
  ok(r.advanced.surveys.some(s=>s.clip===clip.id&&s.camera===clip.camera&&s.recorder===recorder),'Select an optically surveyed incident clip.');
  if(action==='Preserve'){
    ok(role==='Operator','The observing operator preserves the event.');
    ok(!history.includes(msg),'Evidence already preserved.');
    retrieve(r,viewer,recorder,clipId);
  }else if(action==='Restrict access'){
    ok(role==='IT custodian'&&history.includes('Preserve / '+clipId),'IT must receive preserved evidence first.');
    const server=get(r,recorder);ok(!server.groups.includes('visitor')&&server.groups.includes('investigator'),'Restrict recorder groups and include investigator.');
  }else if(action==='Escalate egress'){
    ok(role==='Facilities lead'&&history.includes('Restrict access / '+clipId),'The facilities lead must receive access-controlled evidence.');
  }else if(action==='Accept handover'){
    ok(role==='Duty engineer'&&history.includes('Escalate egress / '+clipId),'Escalate the emergency-egress concern before accepting handover.');
    ok(!log.some(e=>e.actor===actor&&e.action.endsWith(' / '+clipId)),'An independent witness must accept the handover.');
    retrieve(r,viewer,recorder,clipId);
  }else throw Error('Choose a custody action.');
  ok(!history.includes(msg),'Action already logged.');log.push({time:r.clock,actor,role,action:msg,viewer,recorder,camera:clip.camera,clip:clipId});return msg;
}
export function advancedAssessment(r,{from,to,lead,flow,viewer,recorder}){
  const results=[],report=(name,ok,detail)=>results.push({name,pass:Boolean(ok),detail});
  try{const c=convergence(r,from,to,lead,flow);report('Active uplink failure restores the intended peer by its deadline',c.pass,'Before '+c.before.join(' → ')+'; after '+c.after.join(' → ')+'; first returned probe '+(c.restoredMs??'none')+' ms.');}catch(e){report('Active uplink recovery',false,e.message);}
  try{const f=frameSequence(r,from,to),first=f.frames[0],last=f.frames[2],m=frameSequence(r,from,to,{group:true}).frames[0];report('Known unicast excludes a flooded bystander and mirror sees selected flow',first.station.length>(last?.station.length??0)&&last?.station.includes(to)&&last.mirror.length>0,'Flood '+first.station.join(', ')+'; known '+(last?.station.join(', ')??'none')+'; mirrored '+(last?.mirror.length??0));report('Multicast reaches only subscribing end stations',r.advanced.snooping&&m.station.includes(to)&&m.station.every(id=>r.advanced.subscribers.includes(id)),'Recipients '+m.station.join(', '));}catch(e){report('Layer 2 observations',false,e.message);}
  try{const n=neighbours6(r,from,to);report('IPv6 peer reachable without duplicate address',true,n.solicitedNode+' via '+n.path.join(' → '));}catch(e){report('IPv6 peer reachable without duplicate address',false,e.message);}
  const l=r.advanced.lens,view=optics(l),clip=r.clips.findLast(c=>c.camera===l.camera&&c.recorder===recorder&&r.advanced.surveys.some(s=>s.clip===c.id&&s.camera===l.camera&&s.recorder===recorder&&s.signature===lensSignature(l)));
  report('Target resolves, restricted area is excluded and recorded event is accessible',view.pass&&clip&&probe(r,viewer,recorder,'archive').ok,'Target '+view.target.featurePixels+' px; restricted area '+(view.privacy.visible?'visible':'excluded')+'; clip '+(clip?.id??'none'));
  const chain=clip?inspectCustody(r.advanced,r).get(clip.id):null;
  report('Controlled incident handover witnessed independently',chain?.length===4,'Matched custody steps '+(chain?.length??0)+' of 4 for clip '+(clip?.id??'none'));
  return results;
}
