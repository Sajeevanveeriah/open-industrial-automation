import {defaultParameters,limits,observable,simulate,sweep,sampleAt,csv} from './experiment.mjs';
const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
const labels={duration:'Run duration (s)',period:'Sample period (s)',initial:'Initial speed (m/s)',setpoint:'Speed demand (m/s)',stepAt:'Demand step (s)',mass:'Equivalent mass (kg)',drag:'Viscous drag (N·s/m)',kp:'Proportional gain (N·s/m)',ki:'Integral gain (N/m)',limit:'Drive force limit (N)',load:'Disturbance load (N)',loadAt:'Load step (s)'};
const colours=['#055c6b','#aa481f','#663c8d','#467029','#934d73','#465889','#775c10','#4b6360'];
const dashes=['','9 3','3 3','10 3 2 3','6 2','12 4','4 2 1 2','1 3'];
let runs=[],sequence=0,windowStart=0,windowEnd=12,at=6;
const fmt=(v,d=3)=>Number(v.toFixed(d)).toString(),shown=()=>runs.filter(r=>r.visible);
for(const [key,label] of Object.entries(labels)){
  const l=document.createElement('label'),i=document.createElement('input');l.textContent=label;i.name=key;i.type='number';i.required=true;i.step='any';[i.min,i.max]=limits[key];i.value=defaultParameters[key];l.append(i);$('fields').append(l);
}
for(const [key,{name,unit}] of Object.entries(observable))$('channel').append(new Option(name+' ('+unit+')',key));
function parameters(){const p={mode:$('parameters').elements.mode.value};for(const key of Object.keys(labels))p[key]=Number($('parameters').elements.namedItem(key).value);return p;}
function maximumTime(){return Math.max(.2,...(shown().length?shown():runs).map(r=>r.result.parameters.duration));}
function fit(){windowStart=0;windowEnd=maximumTime();at=Math.min(at,windowEnd);}
function zoom(ratio){
  const max=maximumTime(),min=Math.min(max,Math.max(.002,Math.min(...(shown().length?shown():runs).map(r=>r.result.parameters.period))*2));
  const span=Math.max(min,Math.min(max,(windowEnd-windowStart)*ratio));
  windowStart=Math.max(0,Math.min(max-span,at-span/2));windowEnd=windowStart+span;draw();
}
function add(results){
  if(runs.length+results.length>8)throw Error('Keep up to eight runs. Remove a run before adding these traces.');
  for(const {result,label} of results){const id=++sequence;runs.push({id,result,label,visible:true,colour:colours[(id-1)%8],dash:dashes[(id-1)%8]});}
  fit();legend();draw();
}
function action(fn){try{const message=fn();$('status').textContent=message??'';}catch(e){$('status').textContent=e.message;}}
function legend(){
  $('runs').replaceChildren();
  for(const r of runs){
    const row=document.createElement('div'),label=document.createElement('label'),check=document.createElement('input'),colour=document.createElement('span'),details=document.createElement('small'),remove=document.createElement('button');
    row.className='run';check.type='checkbox';check.checked=r.visible;check.setAttribute('aria-label','Show run '+r.id);colour.className='swatch';colour.style.background=r.colour;label.append(check,colour,document.createTextNode('R'+r.id+' · '+r.label));
    const m=r.result.metrics;details.textContent='Final '+fmt(m.finalSpeed)+' m/s · travel '+fmt(m.travel)+' m · integrated error '+fmt(m.iae)+' m · force limited '+fmt(m.saturatedSeconds)+' s · '+m.samples+' samples';
    remove.textContent='Remove';remove.setAttribute('aria-label','Remove run '+r.id);remove.disabled=runs.length===1;
    check.onchange=()=>{r.visible=check.checked;fit();draw();};remove.onclick=()=>{runs=runs.filter(x=>x!==r);fit();legend();draw();};
    row.append(label,details,remove);$('runs').append(row);
  }
}
function element(tag,attrs,text){
  const e=document.createElementNS(ns,tag);for(const [name,v] of Object.entries(attrs))e.setAttribute(name,v);if(text!==undefined)e.textContent=text;$('drawing').append(e);return e;
}
const box={left:67,right:740,top:25,bottom:265};
function draw(){
  const selected=$('channel').value,channel=observable[selected],visible=shown(),series=[];
  for(const r of visible){
    series.push({run:r,key:selected,colour:r.colour,dash:r.dash});
    if(selected==='speed')series.push({run:r,key:'target',colour:r.colour,dash:'2 5',target:true});
  }
  let low=0,high=0;
  for(const {run,key} of series){const d=run.result.data;for(let i=0;i<d.time.length;i++)if(d.time[i]>=windowStart&&d.time[i]<=windowEnd){low=Math.min(low,d[key][i]);high=Math.max(high,d[key][i]);}}
  if(high===low)high=low+1;const pad=(high-low)*.07;high+=pad;low-=pad;
  const X=t=>box.left+(box.right-box.left)*(t-windowStart)/(windowEnd-windowStart),Y=v=>box.bottom-(box.bottom-box.top)*(v-low)/(high-low);
  const text=(x,y,value,anchor='start')=>element('text',{x,y,'text-anchor':anchor,'font-size':12,fill:'#344f59'},value);
  const line=(x1,y1,x2,y2,stroke,extra={})=>element('line',{x1,y1,x2,y2,stroke,...extra});
  $('drawing').replaceChildren();text(box.left,15,channel.name+' ('+channel.unit+')');
  for(let i=0;i<=5;i++){
    const value=low+(high-low)*i/5,time=windowStart+(windowEnd-windowStart)*i/5,x=X(time),y=Y(value);
    line(box.left,y,box.right,y,'#cedcde');text(box.left-8,y+4,fmt(value),'end');line(x,box.top,x,box.bottom,'#dce5e6');text(x,box.bottom+19,fmt(time,3),'middle');
  }
  text((box.left+box.right)/2,307,'Simulation time (s)','middle');
  for(const s of series){
    const d=s.run.result.data,time=d.time,values=d[s.key];let path='',bucket=-1,group=[];
    const flush=()=>{if(!group.length)return;const first=group[0],last=group.at(-1);let mini=first,maxi=first;for(const i of group){if(values[i]<values[mini])mini=i;if(values[i]>values[maxi])maxi=i;}
      for(const i of [...new Set([first,mini,maxi,last])].sort((a,b)=>a-b))path+=(path?' L':'M')+X(time[i]).toFixed(2)+' '+Y(values[i]).toFixed(2);group=[];};
    for(let i=0;i<time.length;i++){if(time[i]<windowStart||time[i]>windowEnd)continue;const col=Math.floor(X(time[i]));if(col!==bucket){flush();bucket=col;}group.push(i);}flush();
    element('path',{d:path,fill:'none',stroke:s.colour,'stroke-width':s.target?1.5:2.6,'stroke-dasharray':s.dash});
  }
  line(X(at),box.top,X(at),box.bottom,'#192d31',{'stroke-dasharray':'4 3','stroke-width':1.4});
  const body=$('samples');body.replaceChildren();
  for(const r of visible){const tr=document.createElement('tr'),data=r.result.data;
    const index=at<=data.time.at(-1)+1e-9?sampleAt(r.result,at):-1;
    const values=index<0?['R'+r.id,'Outside run','—','—','—']:['R'+r.id,fmt(data.time[index],4),fmt(data[selected][index],4)+' '+channel.unit,fmt(data.target[index],4),fmt(data.drive[index],4)];
    for(const value of values)tr.insertCell().textContent=value;body.append(tr);
  }
  $('chartDesc').textContent=visible.length+' visible runs. '+channel.name+' against simulation time from '+fmt(windowStart)+' to '+fmt(windowEnd)+' seconds. Exact samples are available in the inspection table.';
  $('cursor').min=windowStart;$('cursor').max=windowEnd;$('cursor').step=visible.length?Math.min(...visible.map(r=>r.result.parameters.period)):.02;$('cursor').value=at;
  $('cursor').setAttribute('aria-valuetext',fmt(at,4)+' seconds');$('view').textContent=fmt(windowStart)+'–'+fmt(windowEnd)+' s · cursor '+fmt(at,4)+' s'+(selected==='speed'?' · dotted lines show speed demand':'');
  $('zoomOut').disabled=windowEnd-windowStart>=maximumTime()-1e-9;$('export').disabled=!visible.length;
}
$('parameters').onsubmit=e=>{e.preventDefault();action(()=>{const result=simulate(parameters());add([{result,label:result.parameters.mode==='coast'?'Coast down':'PI response'}]);return 'Added run '+sequence+'.';});};
$('sweep').onsubmit=e=>{e.preventDefault();action(()=>{if(!$('parameters').reportValidity())return 'Check the experiment settings.';const f=e.target.elements,key=f.parameter.value;
  const tokens=f.values.value.split(',').map(s=>s.trim());if(tokens.some(s=>!s||!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(s)))throw Error('Enter numeric sweep values separated by commas.');
  const numbers=tokens.map(Number),results=sweep(parameters(),key,numbers);add(results.map((result,i)=>({result,label:key+' = '+fmt(numbers[i])})));return 'Added '+results.length+' comparison runs.';});};
$('channel').onchange=draw;$('cursor').oninput=e=>{at=Number(e.target.value);draw();};
$('zoomIn').onclick=()=>zoom(.5);$('zoomOut').onclick=()=>zoom(2);$('fit').onclick=()=>{fit();draw();};
$('chart').onclick=e=>{const point=new DOMPoint(e.clientX,e.clientY).matrixTransform($('chart').getScreenCTM().inverse());const x=Math.max(0,Math.min(1,(point.x-box.left)/(box.right-box.left)));at=windowStart+x*(windowEnd-windowStart);draw();};
$('export').onclick=()=>action(()=>{const blob=new Blob([csv(shown())],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='drive-response.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return 'Exported '+shown().length+' visible runs with parameters and samples.';});
add([{result:simulate(),label:'Reference drive'}]);$('status').textContent='Reference run ready. Change the settings or sweep a gain to compare responses.';
