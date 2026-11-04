import {referenceRack,importRack} from './rack.mjs';
import {checkAdvanced} from './advanced-schema.mjs';
import {topologyExample,convergence,frameSequence,neighbours6,precisionTime,traffic,serialLine,optics,captureSurvey,handover,advancedAssessment} from './fabric.mjs';
const $=id=>document.getElementById(id),bridge='oia-workshop-rack-transfer-v1',local='oia-industrial-rack-v1';
let r=referenceRack();
try{const raw=sessionStorage.getItem(bridge)??localStorage.getItem(local);if(raw&&raw!=='null')r=importRack(raw);}catch(e){$('status').textContent=e.message;}
const ids=kind=>r.devices.filter(d=>!kind||d.kind===kind).map(d=>d.id);
const ends=()=>r.devices.filter(d=>!['switch','router'].includes(d.kind)).map(d=>d.id);
const links=()=>r.links.map(l=>l.id);
const forms={};
function register(id,spec,buttons,run){
  forms[id]={spec,buttons,run};
  $(id).onsubmit=e=>{e.preventDefault();act(()=>{const vals=values(id);run(vals,e.submitter.value);});};
}
function initialise(){
  for(const [id,{spec,buttons}] of Object.entries(forms)){
    const nodes=[];for(const [key,label,type,initial] of spec()){
      const l=document.createElement('label'),input=Array.isArray(type)?document.createElement('select'):document.createElement('input');
      l.textContent=label;input.name=key;
      if(Array.isArray(type))input.replaceChildren(...type.map(v=>new Option(v,v)));
      else{input.type=type;if(type==='number')input.step='any';}
      if(type==='checkbox')input.checked=initial;else if(!Array.isArray(type)||type.includes(String(initial)))input.value=initial;
      l.append(input);nodes.push(l);
    }
    for(const [key,title] of buttons){const b=document.createElement('button');b.value=key;b.textContent=title;nodes.push(b);}
    $(id).replaceChildren(...nodes);
  }
  $('topology').textContent=r.links.map(l=>l.id+' ('+l.a+':'+l.pa+' to '+l.b+':'+l.pb+')').join(' · ');
  $('chainOut').textContent=r.advanced.custody.map(e=>e.time+' s · '+e.actor+' · '+e.action).join('\n');
  $('acceptOut').textContent=r.advanced.report.join('\n');plot();
}
function values(id){
  return Object.fromEntries([...$(id).querySelectorAll('input,select')].map(i=>[i.name,i.type==='checkbox'?i.checked:i.type==='number'?(i.value===''?NaN:Number(i.value)):i.value]));
}
function persist(){const raw=JSON.stringify(r);if(raw.length>256000)throw Error('Rack exceeds project capacity.');sessionStorage.setItem(bridge,raw);localStorage.setItem(local,raw);}
function act(fn){try{fn();persist();$('status').textContent='Experiment recorded.';}catch(e){$('status').textContent=e.message;}}
function update(patch){const next={...r.advanced,...patch};checkAdvanced(next,r);r.advanced=next;}
const list=s=>s.split(',').map(v=>v.trim()).filter(Boolean);
const formPath=()=>values('paths');
register('paths',()=>[
  ['from','Producer',ends(),'PLC'],['to','Consumer',ends(),'DI'],['lead','Lead under fault',links(),'EDGE_CORE'],['flow','Flow hash','number',0],
  ['bundle','Enable link aggregation','checkbox',r.advanced.bundle],['members','Aggregated lead IDs (comma-separated)','text',r.advanced.lagGroup.join(',')],
  ['detect','Detection delay, ms','number',r.advanced.detectMs],['fwd','Tree forwarding delay, ms','number',r.advanced.forwardMs],
  ['interval','Probe interval, ms','number',r.advanced.sampleMs],['deadline','First-reply deadline, ms','number',r.advanced.deadlineMs]
],[['fault','Cut lead and measure']],v=>{
  if(!Number.isInteger(v.flow)||v.flow<0||v.flow>65535)throw Error('Flow hash ranges from 0 to 65535.');
  update({bundle:v.bundle,lagGroup:list(v.members),detectMs:v.detect,forwardMs:v.fwd,sampleMs:v.interval,deadlineMs:v.deadline});
  const x=convergence(r,v.from,v.to,v.lead,v.flow);
  $('route').textContent=['Active path '+(x.before.join(' → ')||'absent'),'Surviving path '+(x.after.join(' → ')||'absent'),(x.affected?'Active path interrupted.':'Selected lead did not carry this flow.')+' Lost probes '+x.loss+'. First reply '+(x.restoredMs??'none')+' ms. '+(x.pass?'Pass':'Open'),...x.observations.slice(0,20).map(o=>o.sentMs+' ms sent / '+(o.returnedMs===null?'lost':o.returnedMs+' ms returned'))].join('\n');
});
register('frames',()=>[
 ['sw','Switch to mirror',ids('switch'),r.advanced.mirrorSwitch||'EDGE'],['port','Mirror source port','number',r.advanced.mirrorPort],['group','Multicast group','text',r.advanced.membership],['members','Subscribed host IDs','text',r.advanced.subscribers.join(',')],['snoop','Enable IGMP snooping','checkbox',r.advanced.snooping]
],[['learn','Trace unknown and learned unicast'],['group','Trace multicast']],(v,mode)=>{
  update({mirrorSwitch:v.sw,mirrorPort:v.port,membership:v.group,subscribers:list(v.members),snooping:v.snoop});const {from,to}=formPath(),x=frameSequence(r,from,to,{group:mode==='group'});
  $('captureOut').textContent=[...x.frames.map(f=>[f.description,'Observed end stations '+(f.station.join(', ')||'none'),'Mirror '+(f.mirror.join(', ')||'no frames'),'Egress '+f.visits.map(h=>h.from+'→'+h.to+' ('+h.link+')').join(', ')].join('\n')),'Learned entries '+x.mac.map(m=>m.key+' on '+m.link).join(', ')].join('\n\n');
});
register('ipv6',()=>[['id','Host',ends(),'PLC'],['address','Unicast IPv6 address','text','fd24:a::31'],['prefix','Prefix bits','number',64]],[['assign','Apply IPv6 address'],['test','Solicit neighbour']],(v,mode)=>{
  if(mode==='assign'){update({ipv6:[...r.advanced.ipv6.filter(x=>x.id!==v.id),v]});$('ipv6Out').textContent=r.advanced.ipv6.map(x=>x.id+' '+x.address+'/'+x.prefix).join('\n');}
  else{const {from,to}=formPath(),x=neighbours6(r,from,to);$('ipv6Out').textContent=x.solicitedNode+' at '+x.ethernet+'\n'+x.path.join(' → ');}
});
register('ptp',()=>[['offset','True slave offset, µs','number',80],['bias','Extra forward delay, µs','number',12]],[['sync','Exchange four timestamps']],v=>{const {from,to}=formPath(),t=precisionTime(r,from,to,v.offset,v.bias);$('ptpOut').textContent='T1, T2, T3, T4 (µs): '+t.timestamps.join(', ')+'\nEstimated offset '+t.offsetEstimateUs+' µs; mean path delay '+t.meanDelayUs+' µs; residual after correction '+t.residualUs+' µs.';});
register('timing',()=>[['protocol','Transaction',['PROFINET RT','EtherNet/IP implicit','Modbus TCP poll'],'PROFINET RT'],['period','Period or poll deadline, ms','number',4],['congestion','Competing 1518-byte frames each period','number',20],['qos','Strict priority for control frames','checkbox',false],['fail','Fail selected uplink at cycle four','checkbox',false]],[['run','Measure 12 cycles']],v=>{
  const {from,to,lead}=formPath(),x=traffic(r,from,to,{protocol:v.protocol,periodMs:v.period,congestion:v.congestion,qos:v.qos,outageLead:v.fail?lead:null});
  $('timingOut').textContent=[x.protocol+' · bottleneck '+x.capacity+' Mbit/s','Min '+x.minMs+' ms; max '+x.maxMs+' ms; jitter '+x.jitterMs+' ms; '+x.failed+' missed deadlines.',...x.cycles.map(c=>'Cycle '+c.cycle+' at '+c.atMs+' ms / '+(c.latencyMs??'lost')+' ms / '+(c.onTime?'on time':'missed'))].join('\n');
});
register('serial',()=>[['hex','Unit, function and data (hex)','text','01 03 00 00 00 0A'],['baud','Bit rate',['1200','2400','4800','9600','19200'],'9600'],['parity','Sender parity',['E','O','N'],'E'],['peer','Receiver parity',['E','O','N'],'E'],['stop','Stop bits',['1','2'],'1'],['gap','Inter-frame gap, ms','number',5]],[['send','Transmit RTU frame']],v=>{
  const x=serialLine({hex:v.hex,baud:+v.baud,parity:v.parity,peerParity:v.peer,stop:+v.stop,gapMs:v.gap});$('serialOut').textContent=x.wire+'\nCharacter '+x.charMs+' ms; frame '+x.durationMs+' ms; minimum silence '+x.minGapMs+' ms. '+x.reason;
});
const lensFields={x:'Mount X, m',y:'Mount Y, m',yaw:'Yaw, degrees',hfov:'Horizontal field of view, degrees',width:'Horizontal pixels',height:'Vertical pixels',fps:'Frames per second',range:'Detection range, m',targetX:'Target X, m',targetY:'Target Y, m',privateX:'Restricted point X, m',privateY:'Restricted point Y, m',featureM:'Feature width, m',minPixels:'Required pixels across feature'};
register('lens',()=>[['camera','Camera',ids('camera'),r.advanced.lens.camera||'CAM'],...Object.entries(lensFields).map(([k,l])=>[k,l,'number',r.advanced.lens[k]])],[['apply','Aim and inspect'],['record','Record accepted scene']],(v,mode)=>{
  update({lens:v});plot();if(mode==='record'){const {viewer,recorder}=values('chain'),x=captureSurvey(r,viewer,recorder);$('lensOut').textContent+='\nVerified recording '+x.clip.id+' / '+x.clip.start+' to '+x.clip.end+' s.';$('chain').elements.clip.value=x.clip.id;}
});
function plot(){
  const l=r.advanced.lens,x=optics(l),c=$('plan'),ctx=c.getContext('2d'),a=l.yaw*Math.PI/180,f=l.hfov*Math.PI/360;
  const span=Math.max(1,l.range,Math.abs(l.targetX-l.x),Math.abs(l.targetY-l.y),Math.abs(l.privateX-l.x),Math.abs(l.privateY-l.y)),s=115/span;
  const P=(x,y)=>[c.width/2+(x-l.x)*s,c.height/2-(y-l.y)*s];
  ctx.clearRect(0,0,c.width,c.height);const centre=P(l.x,l.y);ctx.beginPath();ctx.moveTo(...centre);ctx.arc(...centre,l.range*s,-a-f,-a+f);ctx.closePath();ctx.fillStyle='#d1e5d9';ctx.fill();ctx.strokeStyle='#2e6452';ctx.stroke();
  for(const [px,py,label,color] of [[l.x,l.y,'Camera','#164b55'],[l.targetX,l.targetY,'Target','#366022'],[l.privateX,l.privateY,'Restricted','#963813']]){const p=P(px,py);ctx.fillStyle=color;ctx.beginPath();ctx.arc(...p,4,0,2*Math.PI);ctx.fill();ctx.font='14px system-ui';ctx.fillText(label,p[0]+6,p[1]-5);}
  $('lensOut').textContent='Target '+(x.target.visible?'visible':'outside field')+' / '+x.target.featurePixels+' px across feature; required '+l.minPixels+' px. Restricted point '+(x.privacy.visible?'visible':'excluded')+'.\nVertical field '+x.verticalFovDeg+'°, sample interval '+x.samplingIntervalMs+' ms. Optical check '+(x.pass?'passed.':'open.');
}
register('chain',()=>[['viewer','Viewing station',ids('viewer'),'VIEW'],['recorder','Recording server',ids('recorder'),'NVR'],['clip','Clip ID','number',1],['actor','Synthetic staff ID','text','operator1'],['role','Responsibility',['Operator','IT custodian','Facilities lead','Duty engineer'],'Operator'],['action','Handover step',['Preserve','Restrict access','Escalate egress','Accept handover'],'Preserve']],[['log','Record custody action']],v=>{handover(r,{...v,clipId:v.clip});$('chainOut').textContent=r.advanced.custody.map(e=>e.time+' s · '+e.actor+' · '+e.action).join('\n');});
$('assess').onclick=()=>act(()=>{const checks=advancedAssessment(r,{...formPath(),...values('chain')});r.advanced.report=checks.map(c=>(c.pass?'PASS':'OPEN')+' · '+c.name+' · '+c.detail).map(s=>s.slice(0,700));$('acceptOut').textContent=r.advanced.report.join('\n');});
for(const type of ['parallel','ring'])$(type).onclick=()=>{if(confirm('Replace this rack with the worked topology? Export the rack first to keep a separate copy.'))act(()=>{r=topologyExample(type);initialise();$('route').textContent='';});};
initialise();

document.body.inert=false;
