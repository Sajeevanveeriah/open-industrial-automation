import {tags,newStation,screen,widget,channel,scan,connection,display,importStation,exportStation,assessHmi} from './supervision.mjs';
const $=id=>document.getElementById(id),num=id=>Number($(id).value),key='oia-workshop-practice-transfer-v1';
let transfer={},s;
try{transfer=JSON.parse(sessionStorage.getItem(key)||'{}');s=importStation(transfer.data?.supervision);}catch{s=newStation();}
if(!transfer.data)transfer.data={};
for(const id of ['tag','channel'])for(const t of Object.keys(tags))$(id).append(new Option(t,t));
function draw(){
 const old=$('page').value;$('page').replaceChildren(...s.screens.map(p=>new Option(p.name,p.name)));if(s.screens.some(p=>p.name===old))$('page').value=old;
 const p=s.screens.find(p=>p.name===$('page').value);$('screen').replaceChildren();
 for(const w of p?.widgets||[]){const d=display(s,w),line=document.createElement('p'),trend=s.history.filter(r=>r.tag===w.tag).slice(-8).map(r=>(r.value*w.scale+w.offset).toFixed(1));
  line.textContent=w.id+' | '+(w.style==='Trend'?trend.join(' → '):w.style==='Indicator'&&d.value!==null?(d.value>=w.alarm?'HIGH':'NORMAL'):(d.value??'unavailable'))+' '+w.units+' | '+d.quality+' | source scan '+(d.source??'-')+' | received '+(d.acquired??'-');$('screen').append(line);}
 $('link').textContent=s.connected?'Disconnect gateway':'Reconnect gateway';
 $('history').textContent='Local scan '+s.tick+' count '+s.values.count+' | Gateway '+(s.connected?'online':'offline')+'\nFirst-out: '+(s.firstOut?s.firstOut.screen+'/'+s.firstOut.widget+' at scan '+s.firstOut.tick:'none')+'\nTag | value | source scan | acquired scan | quality\n'+s.history.slice(-12).map(r=>[r.tag,r.value,r.source,r.acquired,r.quality].join(' | ')).join('\n')+'\n'+s.journal.slice(-4).map(r=>r.tick+' '+r.msg).join('\n');
}
function run(id,fn){$(id).onclick=()=>{try{const msg=fn();draw();transfer.data.supervision=exportStation(s);sessionStorage.setItem(key,JSON.stringify(transfer));$('status').textContent=msg||'Applied.';}catch(e){$('status').textContent=e.message;}};}
run('add',()=>{screen(s,$('name').value);draw();$('page').value=$('name').value.trim();});
run('bind',()=>widget(s,$('page').value,$('id').value,$('tag').value,num('scale'),num('offset'),$('unit').value,num('alarm'),$('style').value));
run('configure',()=>channel(s,$('channel').value,$('mode').value,num('period'),num('db'),num('lag')));
const input=()=>({I0:$('i0').checked,I1:$('i1').checked,temperature:num('temp')});
run('step',()=>scan(s,input()));run('ten',()=>{for(let i=0;i<10;i++)scan(s,input());});run('link',()=>connection(s,!s.connected));run('test',()=>assessHmi(s)?'Pass. Your design displayed two transitions, retained stale timestamps and recovered the correct count.':'Add two populated screens, a count widget, an I0 widget and acquisition channels. Prove stale hold and both rising edges.');
run('recorded',()=>{const rows=transfer.records?.scans||[];if(!rows.length)throw Error('Advance the packaging cell before entering to capture a trace.');for(const r of rows)scan(s,{I0:r.I0,I1:r.I1,count:r.count});return 'Consumed '+rows.length+' recorded input scans.';});
$('page').onchange=draw;draw();

document.body.inert=false;
