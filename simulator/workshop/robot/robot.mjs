import {newCell,STEP,forward,inverse,clearance,calibrate,step,start,recover,reset,validateCell,importRecording} from './kinematics.mjs';
const $=id=>document.getElementById(id),degrees=180/Math.PI,bridge='oia-workshop-robot-transfer-v1',local='oia-planar-cell-v1';
let c=newCell(),playing=false,carry=0,last=null,external=null;
function load(text){if(text.length>1000000)throw Error('Project exceeds 1 MB.');return validateCell(JSON.parse(text));}
try{const raw=sessionStorage.getItem(bridge)??localStorage.getItem(local);if(raw&&raw!=='null')c=load(raw);}catch(e){$('status').textContent=e.message;}
function persist(){try{const data=JSON.stringify(c);localStorage.setItem(local,data);sessionStorage.setItem(bridge,data);}catch{$('status').textContent='Local storage unavailable. Export the robot project.';}}
function action(fn){try{const message=fn();$('status').textContent=message??'Applied.';}catch(e){$('status').textContent=e.message;}render();persist();}
const editable=()=>{if(!['idle','fault'].includes(c.phase)||playing)throw Error('Pause and reset the run or stop at a fault before changing geometry.');};
const fields=[
 ['base.x','Base X, m'],['base.y','Base Y, m'],['base.yaw','Base yaw, °'],['arm.upper','Upper link, m'],['arm.fore','Forearm, m'],['arm.tcp','Tool offset, m'],['arm.rate','Joint rate, °/s'],['arm.branch','Elbow branch (+1 or -1)'],
 ['stations.pick.x','Pick target X, m'],['stations.pick.y','Pick target Y, m'],['stations.place.x','Place target X, m'],['stations.place.y','Place target Y, m'],['carton.x','Carton X, m'],['carton.y','Carton Y, m'],['pallet.x','Pallet X, m'],['pallet.y','Pallet Y, m'],['keepout.x','Guard X, m'],['keepout.y','Guard Y, m'],['keepout.r','Guard radius, m']
];
function entry(obj,path){const parts=path.split('.'),name=parts.pop();return [parts.reduce((o,k)=>o[k],obj),name];}
for(const [key,label] of fields){const container=document.createElement('label'),field=document.createElement('input');container.textContent=label;field.type='number';field.step='any';field.required=true;field.name=key;container.append(field);$('design').append(container);}
const apply=document.createElement('button');apply.textContent='Apply geometry';$('design').append(apply);
function fill(){for(const [key] of fields){const [o,k]=entry(c,key);$('design').elements.namedItem(key).value=Number((o[k]*(['yaw','rate'].includes(k)?degrees:1)).toFixed(7));}
  for(const key of ['ready','vacuum'])$('signals').elements[key].checked=c.signals[key];$('signals').elements.delay.value=c.signals.delay;
}
function draw(){
  const svg=$('geometry');svg.replaceChildren();const f=forward(c),points=[f.base,f.elbow,f.tip,c.keepout,c.stations.pick,c.stations.place,c.carton,c.pallet];
  const scale=105/Math.max(.8,...points.map(p=>Math.max(Math.abs(p.x),Math.abs(p.y))),Math.abs(c.keepout.x)+c.keepout.r,Math.abs(c.keepout.y)+c.keepout.r);
  const x=p=>p.x*scale,y=p=>-p.y*scale;
  function add(tag,attrs){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,value);svg.append(el);return el;}
  function line(a,b,col,w=1){return add('line',{x1:x(a),y1:y(a),x2:x(b),y2:y(b),stroke:col,'stroke-width':w,'stroke-linecap':'round'});}
  function circle(p,r,fill,stroke='none',dash='none'){return add('circle',{cx:x(p),cy:y(p),r,fill,stroke,'stroke-width':1,'stroke-dasharray':dash});}
  function caption(p,t,dy=-4){add('text',{x:x(p)+3,y:y(p)+dy}).textContent=t;}
  line({x:-130/scale,y:0},{x:130/scale,y:0},'#9fafaa',.5);line({x:0,y:-120/scale},{x:0,y:120/scale},'#9fafaa',.5);
  circle(c.keepout,c.keepout.r*scale,'#f4ded5','#8c4020','3 1');caption(c.keepout,'Guard');
  if(c.trail.length>1)add('polyline',{points:c.trail.map(p=>x(p)+','+y(p)).join(' '),fill:'none',stroke:'#5a8090','stroke-width':.9});
  circle(c.stations.pick,5,'none','#7a5906','1 1');circle(c.stations.place,6,'none','#225e3e','1 1');
  add('rect',{x:x(c.pallet)-5,y:y(c.pallet)-5,width:10,height:10,fill:'#c5d8bb',stroke:'#365326'});caption(c.pallet,c.pallet.id,-8);
  line(f.base,{x:f.base.x+.18*Math.cos(c.base.yaw),y:f.base.y+.18*Math.sin(c.base.yaw)},'#ab5319',1.7);
  line(f.base,f.elbow,'#335b5b',5);line(f.elbow,f.wrist,'#3d8480',4);line(f.wrist,f.tip,'#7e5b1e',2);
  for(const p of [f.base,f.elbow,f.wrist])circle(p,2.4,'white','#254b46');
  const carton=c.gripped?f.tip:c.palletised.length?c.pallet:c.carton;
  add('rect',{x:x(carton)-2,y:y(carton)-2,width:4,height:4,fill:'#a75214'});caption(carton,c.carton.id,8);
  circle(f.tip,1.5,'#1a3531');caption(f.base,'Base',7);
}
function sample(){
  const s=c.trail[Number($('scrub').value)];$('history').textContent=s?'Built-in planar engine | '+(s.tick*STEP).toFixed(2)+' s | '+s.phase+' | shoulder '+(s.q[0]*degrees).toFixed(2)+'° | elbow '+(s.q[1]*degrees).toFixed(2)+'° | TCP ('+s.x.toFixed(3)+', '+s.y.toFixed(3)+') m':'No built-in run samples.';
}
function compare(){if(!external)return;const s=external.samples[Number($('extScrub').value)],near=c.trail.reduce((best,p)=>!best||Math.abs(p.tick*STEP-s.timeS)<Math.abs(best.tick*STEP-s.timeS)?p:best,null);
  $('provenance').textContent=['Imported file; engine identity supplied by the recording',external.source+' '+external.engineVersion+' | '+external.runId,'Scenario '+external.scenario+' | '+external.frame+' / '+external.upAxis+' up / '+external.units,'External '+s.timeS.toFixed(3)+' s | joint '+s.robotJointRad.toFixed(4)+' rad | carton X '+s.cartonXM.toFixed(4)+' m | sensor '+(s.sensorHigh?'high':'low'),near?'Closest built-in sample '+(near.tick*STEP).toFixed(3)+' s | shoulder '+near.q[0].toFixed(4)+' rad':'No built-in samples available.'].join('\n');
}
function render(){
  const tip=forward(c).tip,remaining=clearance(c),cycle=c.started===null?0:(c.tick-c.started)*STEP;
  $('telemetry').textContent=[c.phase+' | '+(c.tick*STEP).toFixed(2)+' s','Joints '+c.q.map(v=>(v*degrees).toFixed(1)+'°').join(' / '),'TCP '+tip.x.toFixed(3)+', '+tip.y.toFixed(3)+' m','Clearance '+remaining.toFixed(3)+' m',c.fault?'First-out: '+c.fault:null].filter(Boolean).join(' · ');
  $('carton').textContent='Carton '+c.carton.id+' / '+(c.gripped?'attached':c.palletised.length?'on '+c.pallet.id:'on conveyor')+' / pallet quantity '+c.palletised.length+' / cycle '+cycle.toFixed(2)+' s.';
  $('events').replaceChildren(...c.events.slice().reverse().map(e=>{const tr=document.createElement('tr');tr.insertCell().textContent=(e.tick*STEP).toFixed(2);tr.insertCell().textContent=e.message;return tr;}));
  $('start').disabled=c.phase!=='idle';$('recover').disabled=c.phase!=='fault';$('play').disabled=playing||['idle','complete','fault'].includes(c.phase);$('pause').disabled=!playing;$('step').disabled=$('play').disabled;
  $('scrub').max=Math.max(0,c.trail.length-1);$('scrub').value=$('scrub').max;sample();compare();draw();
}
function frame(now){
  if(!playing)return;
  if(last!==null)carry+=Math.min((now-last)/1000,.25)*Number($('speed').value);
  last=now;const n=Math.floor(carry/STEP);if(n){carry-=n*STEP;step(c,n);if(['fault','complete'].includes(c.phase)){playing=false;persist();}render();}
  if(playing)requestAnimationFrame(frame);
}
$('start').onclick=()=>action(()=>{start(c);return 'Cycle ready. Step or run the controller.';});
$('step').onclick=()=>action(()=>{step(c);return c.fault??c.phase;});
$('play').onclick=()=>action(()=>{playing=true;carry=0;last=null;requestAnimationFrame(frame);return 'Running.';});
$('pause').onclick=()=>action(()=>{playing=false;return 'Paused.';});
$('recover').onclick=()=>action(()=>{recover(c);return 'Retry ready. Step or run the controller.';});
$('reset').onclick=()=>action(()=>{playing=false;reset(c);return 'Run reset. Design retained.';});
$('design').onsubmit=e=>{e.preventDefault();action(()=>{editable();const trial=structuredClone(c);for(const [key] of fields){const [obj,k]=entry(trial,key);obj[k]=Number(e.target.elements.namedItem(key).value)/(['yaw','rate'].includes(k)?degrees:1);}
  c=validateCell(trial);return 'Geometry applied.';});};
$('signals').onsubmit=e=>{e.preventDefault();action(()=>{const f=e.target.elements,trial=structuredClone(c);trial.signals={vacuum:f.vacuum.checked,ready:f.ready.checked,delay:Number(f.delay.value)};c=validateCell(trial);return 'Signals applied.';});};
$('teach').onsubmit=e=>{e.preventDefault();action(()=>{editable();const f=e.target.elements;
  if(e.submitter.value==='teach'){c.stations[f.target.value]=forward(c).tip;fill();return 'Station taught from current TCP.';}
  const q=[Number(f.j1.value)/degrees,Number(f.j2.value)/degrees];if(clearance(c,q)<=0)throw Error('Jog target intersects guard.');const next=structuredClone(c);next.q=q;c=validateCell(next);return 'Joint pose selected.';
});};
$('calibration').onsubmit=e=>{e.preventDefault();action(()=>{editable();const f=e.target.elements;c.arm.tcp=calibrate(c,{x:+f.x.value,y:+f.y.value});fill();return 'Measured tool offset '+c.arm.tcp.toFixed(4)+' m.';});};
$('scrub').oninput=sample;$('extScrub').oninput=compare;
$('save').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(c)],{type:'application/json'}));a.href=url;a.download='robot-cell.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
for(const [name,max] of [['open',1e6],['external',4e6]])$(name).onchange=async e=>{const file=e.target.files[0];if(!file)return;try{
  if(file.size>max)throw Error('File exceeds import limit.');const text=await file.text();
  if(name==='open'){const next=load(text);playing=false;c=next;fill();render();persist();}
  else{external=importRecording(text);$('extScrub').max=external.samples.length-1;$('extScrub').value=0;compare();}
  $('status').textContent='Opened '+file.name;
}catch(err){$('status').textContent=err.message;}e.target.value='';};
addEventListener('pagehide',persist);fill();render();persist();

document.body.inert = false;
