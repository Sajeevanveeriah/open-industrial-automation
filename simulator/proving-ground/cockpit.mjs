import {ASSETS, FAT, advance, createState, fatStep, hierarchy, payload, setFault, setPoint, status, telemetry} from './model.mjs';
import {createScene} from './scene.mjs';

const $ = id => document.getElementById(id);
const element = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const button = (text, fn) => {
  const node = element('button', text);
  node.type = 'button';
  node.addEventListener('click', fn);
  return node;
};
const put = (node, text) => {
  if (node.textContent !== text) node.textContent = text;
};
const state = createState();
const byId = new Map(ASSETS.map(asset => [asset.id, asset]));
const history = new Map(ASSETS.map(asset => [asset.id, []]));
const streamSeq = new Map(ASSETS.map(asset => [asset.id, 0]));
const number = new Intl.NumberFormat('en-AU', {maximumFractionDigits: 2});
const metricName = name => name === 'LoRaWANHeartbeat' ? 'LoRaWAN heartbeat' : name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
const unit = text => text === 'deg C' ? '°C' : text;
const valueText = metric => {
  const value = typeof metric.value === 'number' ? number.format(metric.value) : typeof metric.value === 'boolean' ? (metric.value ? 'On' : 'Off') : metric.value;
  return String(value) + (metric.unit ? ' ' + unit(metric.unit) : '');
};
const level = name => name === 'NOMINAL' ? 'ok' : name === 'TRIP' || name === 'FAULT' ? 'fault' : 'warn';
const clockFormat = new Intl.DateTimeFormat('en-AU', {timeZone: 'Australia/Melbourne', hourCycle:'h23', hour:'2-digit', minute:'2-digit', second:'2-digit', timeZoneName:'shortOffset'});
const cameraLabels = {overview:'Overview', z1:'Zone 1: Reception', z2:'Zone 2: Bunkers', z3:'Zone 3: Processing', z4:'Zone 4: Cold Store', amr:'Follow AMR-01'};
const pillarLabels = ['All Pillars','1. Physical System','2. Sensing','3. Control','4. Autonomy','5. Industrial IT/AI','6. Verification'];
let selected = 'Z3-FRY-01', visibleIds = ASSETS.map(a => a.id), paused = false, scene;
let lastAlarm = null, latestCopy = '', copyRevision = 0;
const cards = Array.from({length:4}, () => {
  const cell = element('div', undefined, 'metric'), name = element('span', '', 'metric-name');
  const value = element('span', '', 'reading'), badge = element('small', '', 'badge');
  cell.append(name, value, badge);
  $('telemetry').append(cell);
  return {name,value,badge};
});

function displayClock(){
  const parts = clockFormat.formatToParts(new Date());
  const offset = parts.find(p => p.type === 'timeZoneName').value.replace('GMT','UTC');
  const time = parts.filter(p => ['hour','minute','second'].includes(p.type)).map(p=>p.value).join(':');
  put($('clock'), time+' '+(offset==='UTC+11'?'AEDT':'AEST')+' '+offset);
}

function renderMetrics(){
  put($('kpi-throughput'),state.throughput.toFixed(1));
  put($('kpi-energy'),state.specificEnergy === null ? 'N/A' : state.specificEnergy.toFixed(1));
  $('kpi-energy').title = state.specificEnergy === null ? 'No product flow for a per-tonne calculation' : 'Energy per tonne of product';
  put($('kpi-oee'),state.oee.toFixed(1));
  put($('kpi-rate'), number.format(state.rate));
  put($('kpi-alarms'),String(state.alarms.length));
  $('kpi-alarms').dataset.level = state.alarms.length ? 'fault' : 'ok';
  const signature = state.alarms.map(a=>a.id+a.severity).join('|');
  if (signature !== lastAlarm) {
    lastAlarm = signature;
    const lines = state.alarms.map(a=>{
      const p=element('p'), badge=element('strong',a.severity,'status');
      badge.dataset.level=level(a.severity); p.append(badge,' '+a.asset+' / '+a.message);
      return p;
    });
    $('alarm-list').replaceChildren(...(lines.length ? lines : [element('p','Nominal - no active alarms')]));
  }
  const health=status(state, selected);
  put($('asset-status'),health);
  $('asset-status').dataset.level=level(health);
  const metrics=telemetry(state,selected);
  metrics.forEach((metric,i)=>{
    put(cards[i].name,metricName(metric.name)); put(cards[i].value,valueText(metric));
    put(cards[i].badge,health); cards[i].badge.dataset.level=level(health);
  });
  put($('trend-name'),metricName(metrics[0].name)+' / '+unit(metrics[0].unit));
}

function trend(){
  const canvas=$('trend'), ctx=canvas.getContext('2d');
  if(!ctx)return;
  const w=Math.max(100,Math.round(canvas.clientWidth)),h=58,dpr=Math.min(devicePixelRatio||1,2);
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  ctx.strokeStyle='#293e58';ctx.lineWidth=1;ctx.beginPath();
  for(let x=0;x<=4;x++){ctx.moveTo(x*w/4,0);ctx.lineTo(x*w/4,h);}
  for(let y=1;y<=3;y++){ctx.moveTo(0,y*h/4);ctx.lineTo(w,y*h/4);}ctx.stroke();
  const samples=history.get(selected);
  if(!samples.length)return;
  const min=Math.min(...samples.map(p=>p.value)),max=Math.max(...samples.map(p=>p.value));
  const spread=max-min||Math.max(.02,Math.abs(max)*.01);
  const low=min-spread*.12,high=max+spread*.12, end=samples.at(-1).time;
  const y=v=>h-3-(v-low)/(high-low)*(h-6);
  ctx.lineWidth=2;ctx.strokeStyle='#f5b700';ctx.beginPath();
  samples.forEach((p,i)=>{
    const x=2+(p.time-end+60)/60*(w-4);
    if(!i || p.time-samples[i-1].time>1.6)ctx.moveTo(x,y(p.value));else ctx.lineTo(x,y(p.value));
  });
  ctx.stroke();ctx.fillStyle='#f5b700';ctx.beginPath();ctx.arc(w-2,y(samples.at(-1).value),2,0,Math.PI*2);ctx.fill();
  const description=number.format(min)+' to '+number.format(max)+' '+unit(telemetry(state,selected)[0].unit);
  put($('trend-range'),description);canvas.setAttribute('aria-label',metricName(telemetry(state,selected)[0].name)+' over the last 60 seconds: '+description);
}
function sampleTrend(){
  for(const asset of ASSETS){
    const samples=history.get(asset.id),value=telemetry(state,asset.id)[0].value;
    if(samples.at(-1)?.time===state.seconds)continue;
    samples.push({time:state.seconds,value});
    while(samples.length>61 || samples[0].time<state.seconds-60)samples.shift();
  }
  trend();
}

function publishFrame(){
  if(paused)return;
  const seq=streamSeq.get(selected), frame=payload(state,selected,Date.now(),seq);
  streamSeq.set(selected,(seq+1)%256);
  latestCopy=JSON.stringify(frame.payload,null,2);
  put($('topic'),frame.topic);put($('payload'),latestCopy);
}
function selectAsset(id){
  if(!visibleIds.includes(id))return;
  selected=id;
  const a=byId.get(id);
  $('asset-select').value=id;
  put($('asset-name'),a.name);put($('asset-path'),hierarchy(a));
  put($('runtime'),a.controller);put($('protocol'),a.protocol);put($('scan'),number.format(a.scanMs)+' ms');
  renderMetrics();trend();
  if(!paused)publishFrame();
  scene?.update(state,selected,visibleIds);
}
function setPillar(index){
  visibleIds=ASSETS.filter(a=>index===0||a.pillars.includes(index)).map(a=>a.id);
  for(const tab of $('pillars').children)tab.setAttribute('aria-pressed',String(Number(tab.dataset.pillar)===index));
  $('asset-select').replaceChildren(...visibleIds.map(id=>new Option(id+' / '+byId.get(id).name,id)));
  selectAsset(visibleIds.includes(selected)?selected:visibleIds[0]);
}
pillarLabels.forEach((label,i)=>{
  const tab=button(label,()=>setPillar(i));tab.dataset.pillar=i;$('pillars').append(tab);
});
$('asset-select').addEventListener('change',e=>selectAsset(e.target.value));
Object.entries(cameraLabels).forEach(([key,label])=>{
  const b=button(label,()=>{
    scene?.preset(key);
    $('camera-name').textContent=label;
    for(const other of $('cameras').children)other.setAttribute('aria-pressed',String(other===b));
  }); b.dataset.camera=key;b.setAttribute('aria-pressed',String(key==='overview'));$('cameras').append(b);
});

for(const [key,title,min,max,step,units] of [
  ['speed','Line speed',0,2.5,.1,'m/s'],['heat','Thermal fryer',150,195,.5,'°C'],['cold','Cold store',-25,-15,.5,'°C']
]){
  const label=element('label',undefined,'control-field'), head=element('span',undefined,'field-head');
  const caption=element('span',title), output=element('span',state[key].toFixed(1)+' '+units,'field-value');
  const input=element('input');input.type='range';input.id='set-'+key;input.min=min;input.max=max;input.step=step;input.value=state[key];input.setAttribute('aria-label',title);
  input.addEventListener('input',()=>{
    setPoint(state,key,input.valueAsNumber);output.textContent=state[key].toFixed(1)+' '+units;renderMetrics();scene?.update(state,selected,visibleIds);
  });head.append(caption,output);label.append(head,input);$('setpoints').append(label);
}
for(const [key,label] of [['heat','Z3 Fryer Over-Temp (>188 °C)'],['obstacle','AMR-01 Obstacle Stop'],['jam','Z1 Intake Jam'],['humidity','Z2 High Humidity (>96 %)']]){
  const b=button('',()=>{
    setFault(state,key,!state.faults[key]);b.setAttribute('aria-pressed',String(state.faults[key]));renderMetrics();scene?.update(state,selected,visibleIds);
  });b.id='fault-'+key;b.setAttribute('aria-pressed','false');b.className='fault-switch';b.append(element('i'),element('span',label));$('faults').append(b);
}

const fatRows=FAT.map(name=>{
  const row=element('li'),detail=element('details'),summary=element('summary'),message=element('p');
  summary.textContent=name;detail.append(summary,message);row.append(detail);$('fat-results').append(row);
  return {row,summary,message,name};
});
$('run-fat').addEventListener('click',async()=>{
  $('run-fat').disabled=true;
  const snapshot=structuredClone(state);
  let passed=0;
  try{
    for(const r of fatRows){delete r.row.dataset.pass;r.summary.textContent=r.name;r.message.textContent='Awaiting test.';}
    for(const [i,r] of fatRows.entries()){
      $('fat-summary').textContent='Running '+(i+1)+' of '+fatRows.length;
      await new Promise(resolve=>setTimeout(resolve,220));
      const result=fatStep(i,snapshot);
      r.row.dataset.pass=String(result.pass);r.summary.textContent=(result.pass?'PASS':'FAIL')+' / '+r.name;
      r.message.textContent=result.detail;
      if(result.pass)passed++;
    }
    $('fat-summary').textContent=passed+' of '+fatRows.length+' passed';
  }catch(error){$('fat-summary').textContent='Test interrupted: '+error.message;}
  finally{$('run-fat').disabled=false;}
});
$('pause').addEventListener('click',()=>{
  paused=!paused;$('pause').textContent=paused?'Resume':'Pause';$('pause').setAttribute('aria-pressed',String(paused));
  if(!paused)publishFrame();
});
$('copy').addEventListener('click',async()=>{
  const revision=++copyRevision;
  try{
    await navigator.clipboard.writeText(latestCopy);
    $('copy-status').textContent='Payload copied.';
  }catch{
    paused=true;$('pause').textContent='Resume';$('pause').setAttribute('aria-pressed','true');
    const range=document.createRange();range.selectNodeContents($('payload'));
    const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
    $('copy-status').textContent='Payload selected. Use your copy command.';
  }
  setTimeout(()=>{if(revision===copyRevision)$('copy-status').textContent='';},3000);
});

try{scene=createScene($('floor-viewport'),selectAsset);}
catch{
  const fallback=element('div',undefined,'fallback');fallback.append(element('p','3D view unavailable. Select equipment to inspect the running plant.'));

  $('floor-viewport').replaceChildren(fallback);
  for(const b of $('cameras').children)b.disabled=true;
  $('orbit-help').textContent='The controls, telemetry stream and acceptance tests use the same simulated plant.';
}
setPillar(0);sampleTrend();displayClock();
let last=performance.now(),lastUi=last,lastScene=last;
function frame(now){
  advance(state,Math.max(0,Math.min((now-last)/1000,1)));last=now;
  if(now-lastScene>=32){scene?.update(state,selected,visibleIds);lastScene=now;}
  if(now-lastUi>=150){renderMetrics();lastUi=now;}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
setInterval(()=>{displayClock();sampleTrend();publishFrame();},1000);
window.addEventListener('resize',trend);
document.addEventListener('visibilitychange',()=>{last=performance.now();});
document.body.dataset.ready='true';
