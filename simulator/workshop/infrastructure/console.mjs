import {kinds,protocols,newRack,referenceRack,device,putDevice,patch,setRule,physical,inspect,record,retrieve,door,snapshot,failVolume,restore,tick,payloadGB,assess,importRack,lease,resolveName,synchronise,hardwareAddress,backgroundLoad,setLoad,controlCycle,sampleTag,enqueueTag,publishTag} from './rack.mjs';
const $=id=>document.getElementById(id);
const form=name=>$(name).elements;
const transfer='oia-workshop-rack-transfer-v1',saveKey='oia-industrial-rack-v1';
let rack=referenceRack();
const status=s=>{$('status').textContent=s;};
try{const raw=sessionStorage.getItem(transfer)??localStorage.getItem(saveKey);if(raw&&raw!=='null')rack=importRack(raw);}catch(error){status('Saved rack could not open: '+error.message);}
function save(){
  const value=JSON.stringify(rack);
  try{sessionStorage.setItem(transfer,value);localStorage.setItem(saveKey,value);}
  catch{status('Local storage unavailable. Export the rack before leaving.');}
}
const depths=[
  'Trace the two ends of the camera cable. Predict whether a picture needs more than power. Send a video probe from VIEW to CAM, then disconnect the cable and repeat.',
  'A VLAN is a virtual local area network. Address Resolution Protocol (ARP) finds the local Ethernet destination for an IPv4 neighbour. Predict which hosts hear the first request. Compare the CAM and NVR capture points after one local video probe.',
  'The recorder reports a missing stream. Keep the camera powered, move its access port to another VLAN and compare a physical inspection with a video probe. Repair the port and retrieve a recorded event.',
  'Predict which sessions survive an EDGE_CORE uplink failure. Record your reasoning, disconnect the uplink and compare local viewing with remote recording. Reconnect and inspect the firewall log before changing a rule.',
  'Start empty. Select two subnets and a boundary, reserve ports and budget power. Prove viewing, recording, management isolation and local operation during loss of the recording uplink. Calculate storage, fail the recorder after a backup, recover and hand over the measured loss.'
];
$('depth').onchange=()=>{$('lesson').textContent=depths[$('depth').selectedIndex];};$('depth').onchange();
const table=(where,headers,rows)=>{
  const t=document.createElement('table'),head=t.createTHead().insertRow();
  for(const h of headers){const th=document.createElement('th');th.scope='col';th.textContent=h;head.append(th);}
  const body=t.createTBody();for(const row of rows){const tr=body.insertRow();for(const v of row)tr.insertCell().textContent=v;}
  $(where).replaceChildren(t);
};
function options(el,values,preferred){
  const prev=el.value;
  el.replaceChildren(...values.map(x=>new Option(x,x)));
  if(values.includes(prev))el.value=prev;else if(values.includes(preferred))el.value=preferred;
}
function render(){
  const ids=rack.devices.map(d=>d.id),end=rack.devices.filter(d=>!['switch','router'].includes(d.kind)).map(d=>d.id);
  options($('chooseAsset'),['',...ids]);options($('chooseLead'),['',...rack.links.map(l=>l.id)]);
  options(form('lead').a,ids,'CAM');options(form('lead').b,ids,'EDGE');
  options(form('probe').from,end,'VIEW');options(form('probe').to,end,'CAM');options($('capture'),ids,'EDGE');
  for(const id of ['services','acceptance','access']){
    for(const kind of ['camera','viewer','recorder','reader','controller']){
      if(form(id)[kind])options(form(id)[kind],rack.devices.filter(d=>d.kind===kind).map(d=>d.id));
    }
  }
  for(const kind of ['plc','io','gateway','broker']){
    options(form('industrialOps')[kind],rack.devices.filter(d=>d.kind===(kind==='broker'?'server':kind)).map(d=>d.id));
  }
  options(form('load').from,end,'VIEW');options(form('load').to,end,'CAM');
  const m=rack.process;$('industrialOut').textContent=['Input '+Number(m.sensor)+' | local count '+m.count,'Gateway value '+(m.lastValue??'unread')+' | quality '+m.quality+' | source '+(m.sourceTime??'unread')+' s | last poll '+(m.arrivalTime??'unread')+' s','Pending messages '+m.pending.length+' | unique broker deliveries '+m.posted.length].join('\n');
  options(form('host').client,end,'VIEW');options(form('host').server,rack.devices.filter(d=>d.kind==='server').map(d=>d.id),'INFRA');
  options(form('acceptance').uplink,rack.links.map(l=>l.id),'EDGE_CORE');
  table('inventory',['Asset','Function','IP / prefix','Gateway','Zone','Supply','Service'],rack.devices.map(d=>[d.id,d.kind,d.ip+'/'+d.prefix,d.gateway,d.zone,d.power?'On':'Off',d.service?'Running':'Stopped']));
  table('schedule',['Lead','From','To','Medium','VLANs A / B','Capacity (Mbit/s)','Demand (Mbit/s)','Physical inspection'],rack.links.map(l=>[l.id,l.a+' / '+l.pa,l.b+' / '+l.pb,l.media,l.vlans.join(', ')+' / '+(l.peerVlans??l.vlans).join(', '),l.capacity,backgroundLoad(rack,l.id),physical(rack,l)]));
  table('rules',['Source zone','Destination zone','Permitted service'],rack.rules.map(x=>[x.from,x.to,x.protocol]));
  table('clips',['Clip','Camera','Server','Start (s)','End (s)','GB'],rack.clips.map(c=>[c.id,c.camera,c.recorder,c.start,c.end,Number(c.gb.toFixed(6))]));
  table('log',['Time (s)','Record','Finding'],rack.events.slice(-40).reverse().map(e=>[e.time,e.kind,e.message]));
  $('clock').textContent='Clock '+rack.clock+' s';
  $('recovery').textContent=rack.outage?'Volume offline. Recovery timer running.':rack.recovery?'Recovery time '+rack.recovery.elapsedS+' s. Recovery point age '+rack.recovery.pointAgeS+' s. Lost clips '+rack.recovery.lostClips+'.':'No volume recovery recorded.';
  $('tables').textContent=['Firewall decisions',...rack.hits.slice(-10).map(h=>h.time+' s | '+h.from+' → '+h.to+' | '+h.protocol+' | '+(h.permitted?'permit':'deny')), '','Switch forwarding database',...rack.bindings.filter(m=>m.expiry>rack.clock).map(m=>m.switch+' | VLAN '+m.vlan+' | '+m.addr+' | port '+m.port),'','Learned neighbour paths',...rack.mac.filter(m=>m.expiry>rack.clock).map(m=>m.key+' via '+m.path+' expires '+m.expiry+' s')].join('\n');
  capture();
}
function capture(){const id=$('capture').value;table('packets',['Time (s)','Frame','VLAN','From','To'],rack.packets.filter(p=>p.at.includes(id)).slice(-20).reverse().map(p=>[p.time,p.kind,p.vlan,p.from,p.to]));}
$('capture').onchange=capture;
function action(fn){
  try{const result=fn();status(typeof result==='string'?result:'Applied to the rack.');}
  catch(e){status(e.message);}
  render();save();
}
function handle(id,fn){$(id).onsubmit=e=>{e.preventDefault();action(()=>fn(Object.fromEntries(new FormData(e.currentTarget)),e.submitter));};}
options(form('asset').kind,kinds);options(form('probe').protocol,protocols,'video');options(form('rule').protocol,protocols,'archive');
function loadFields(f,obj){
  if(!obj)return;
  if(f.namedItem('peerVlans'))f.namedItem('peerVlans').value='';
  for(const [k,v] of Object.entries(obj)){const field=f.namedItem(k);if(!field)continue;
    if(field.type==='checkbox')field.checked=v;
    else if(k==='interfaces')field.value=v.map(i=>i.vlan+'='+i.ip+'/'+i.prefix).join(',');
    else field.value=Array.isArray(v)?v.join(','):v;
  }
}
$('chooseAsset').onchange=e=>loadFields(form('asset'),rack.devices.find(d=>d.id===e.target.value));
$('chooseLead').onchange=e=>loadFields(form('lead'),rack.links.find(d=>d.id===e.target.value));
handle('asset',v=>{
  const d=device(v.id.trim(),v.kind,v.ip.trim());
  for(const k of ['prefix','budgetW','drawW','bitrate','storageGB','clockOffset','addressPool'])d[k]=Number(v[k]);
  for(const k of ['power','service','credential','cert'])d[k]=v[k]==='on';
  d.gateway=v.gateway.trim();d.zone=v.zone.trim();d.groups=v.groups.split(',').map(x=>x.trim()).filter(Boolean);
  d.interfaces=v.interfaces.trim()?v.interfaces.split(',').map(s=>{const m=/^\s*(\d+)\s*=\s*([\d.]+)\/(\d+)\s*$/.exec(s);if(!m)throw Error('Use VLAN=address/prefix.');return {vlan:+m[1],ip:m[2],prefix:+m[3]};}):[];
  putDevice(rack,d);return 'Configured '+d.id+'.';
});
handle('lead',v=>{patch(rack,{...v,peerVlans:v.peerVlans.trim()?v.peerVlans.split(',').map(Number):undefined,pa:+v.pa,pb:+v.pb,capacity:+v.capacity,vlans:v.vlans.split(',').map(Number),up:v.up==='on'});return 'Patched '+v.id+'.';});
handle('rule',v=>setRule(rack,v.from.trim(),v.to.trim(),v.protocol,v.allowed==='on'));
handle('probe',v=>{
  const p=inspect(rack,v.from,v.to,v.protocol),src=rack.devices.find(d=>d.id===v.from);
  $('probeOut').textContent=[src?'Source '+src.id+' '+src.ip+'/'+src.prefix+' via '+src.gateway:'No source',p.reason,...p.trace.map(f=>f.kind+' | VLAN '+f.vlan+' | '+f.at.join(' → '))].join('\n');
  return p.reason;
});
handle('host',(v,b)=>{
  const d=rack.devices.find(x=>x.id===v.client);if(!d)throw Error('Install a client first.');
  let out;
  if(b.value==='config')out=[d.id,hardwareAddress(rack,d.id),d.ip+'/'+d.prefix,'Default gateway '+d.gateway,'Clock offset '+d.clockOffset+' s'].join(' | ');
  else if(b.value==='dns')out=v.hostname+' resolves to '+resolveName(rack,v.client,v.server,v.hostname);
  else if(b.value==='time')out='Time synchronised, offset '+synchronise(rack,v.client,v.server)+' s';
  else out='Leased '+lease(rack,v.client,v.server).ip;
  $('hostOut').textContent=out;return out;
});
handle('load',v=>setLoad(rack,v.from,v.to,+v.rate));
handle('industrialOps',(v,b)=>{
  switch(b.value){
    case 'low':case 'high':return 'Local count '+controlCycle(rack,v.plc,v.io,b.value==='high')+'.';
    case 'read':return sampleTag(rack,v.gateway,v.plc)?'Good tag received.':(rack.process.quality==='Unknown'?'No source scan yet.':'Upstream read failed; retained value is stale.');
    case 'queue':return 'Queued observation '+enqueueTag(rack)+'.';
    case 'drop':case 'deliver':return 'Delivered observation '+publishTag(rack,v.gateway,v.broker,b.value==='drop')+'.';
  }
});
handle('services',(v,b)=>{
  switch(b.value){
    case 'record':return 'Stored clip '+record(rack,v.recorder,v.camera).id+'.';
    case 'retrieve':return 'Retrieved clip '+retrieve(rack,v.viewer,v.recorder,+v.clip).id+'.';
    case 'backup':snapshot(rack,v.recorder);return 'Backup captured.';
    case 'fail':failVolume(rack,v.recorder);return 'Synthetic recorder volume failed.';
    case 'wait':tick(rack,60);return 'Advanced 60 s.';
    case 'restore':restore(rack);return 'Volume restored.';
  }
});
handle('retention',v=>{const gb=payloadGB(+v.streams,+v.rate,+v.hours,+v.duty/100);$('payload').textContent=v.streams+' × '+v.rate+' Mbit/s × '+v.hours+' h × 3600 s/h × '+v.duty+'% ÷ 8000 Mbit/GB = '+Number(gb.toFixed(6))+' GB';return 'Payload calculated.';});
handle('access',v=>door(rack,v.reader,v.controller,v.group.trim())?'Door access granted.':'Door access denied.');
handle('acceptance',v=>{const checks=assess(rack,v);table('results',['Requirement','Outcome','Evidence'],checks.map(c=>[c.name,c.ok?'Pass':'Fail',c.detail]));return checks.filter(c=>c.ok).length+' of '+checks.length+' checks passed.';});
function replace(value){rack=value;$('probeOut').textContent='';$('results').replaceChildren();render();save();}
for(const [id,fn] of [['blank',newRack],['reference',referenceRack]])$(id).onclick=()=>{
  if(!confirm('Replace this rack? Export first to keep a separate copy.'))return;
  replace(fn());status(id==='blank'?'Empty rack opened.':'Reference rack opened.');
};
$('export').onclick=()=>{const a=document.createElement('a');const url=URL.createObjectURL(new Blob([JSON.stringify(rack)],{type:'application/json'}));a.href=url;a.download='rack-project.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>256000)throw Error('File exceeds 256 kB.');const next=importRack(await file.text());replace(next);status('Opened '+file.name);}catch(error){status(error.message);}e.target.value='';};
render();save();
