import {catalogue,blank,place,pins,wire,readNet,reference,sample} from './circuit.mjs';
const $=id=>document.getElementById(id),key='oia-workshop-electrical-transfer-v1';
let net=reference(),coils=[];
try{const data=JSON.parse(sessionStorage.getItem(key)||'null');if(data)net=readNet(data);}catch{$('result').textContent='Invalid stored circuit. Relay exercise opened.';}
function options(id,items){const el=$(id),old=el.value;el.replaceChildren(...items.map(k=>new Option(k)));if(items.includes(old))el.value=old;}
function settings(){
 const p=net.parts.find(q=>q.id===$('part').value),area=$('settings');area.replaceChildren();if(!p)return;
 function field(key,title,value,type){const label=document.createElement('label'),input=document.createElement('input');input.id='set-'+key;input.type=type;label.append(title,input);if(type==='checkbox')input.checked=value;else input.value=value;area.append(label);}
 if(['supply','switch'].includes(p.kind))field('on','Energised or closed',p.on,'checkbox');
 if(p.kind==='supply')field('volts','Supply voltage (V)',p.volts,'number');
 if(['coil','resistor','lamp','input'].includes(p.kind))field('ohms','Load resistance (Ω)',p.ohms,'number');
 if(p.kind==='contact')field('coil','Controlling coil label',p.coil,'text');
 if(p.kind==='fuse'){field('rating','Fuse rating (A)',p.rating,'number');area.append(p.blown?'Fuse open. Apply setting to replace.':'Fuse intact.');}
}
function draw(){options('part',net.parts.map(p=>p.id));options('a',pins(net));options('b',pins(net));options('cable',net.wires.map(([a,b])=>a+' → '+b));settings();}
function save(){sessionStorage.setItem(key,JSON.stringify(net));}
function act(fn){return ()=>{try{fn();save();}catch(e){$('result').textContent=e.message;}};}
options('kind',Object.keys(catalogue));draw();
$('blank').onclick=act(()=>{net=blank();coils=[];draw();$('outputs').textContent='';$('result').textContent='Empty circuit.';});
$('reference').onclick=act(()=>{net=reference();coils=[];draw();$('outputs').textContent='';$('result').textContent='Relay exercise loaded.';});
$('part').onchange=settings;
$('place').onclick=act(()=>{place(net,$('kind').value,$('id').value.trim());draw();});
$('wire').onclick=act(()=>{wire(net,$('a').value,$('b').value);draw();});
$('open').onclick=act(()=>{const i=$('cable').selectedIndex;if(i>=0)net.wires.splice(i,1);draw();});
$('edit').onclick=act(()=>{const clone=structuredClone(net),p=clone.parts.find(q=>q.id===$('part').value);for(const el of $('settings').querySelectorAll('input'))p[el.id.slice(4)]=el.type==='checkbox'?el.checked:el.type==='number'?el.valueAsNumber:el.value;if(p.kind==='fuse')p.blown=false;net=readNet(clone);draw();$('result').textContent='Setting applied. Take a fresh sample.';});
$('read').onclick=act(()=>{const r=sample(net,coils);coils=r.coils;const a=r.voltage[$('a').value],b=r.voltage[$('b').value];$('result').textContent=a==null||b==null?'Voltage undefined: floating probe.':(a-b).toFixed(3)+' V DC';$('outputs').textContent='Supply '+r.supplyAmps.toFixed(3)+' A\nEnergised coils: '+(r.coils.join(', ')||'none')+'\nActive loads: '+(r.live.join(', ')||'none')+'\n'+Object.entries(r.currents).map(([id,i])=>id+': '+(1000*i).toFixed(2)+' mA').join('\n');settings();});
$('back').onclick=save;

document.querySelector('main').inert = false;
