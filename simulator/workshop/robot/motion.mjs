import {newCell,validateCell} from './kinematics.mjs';
import {defaultPlan,defaultRoute,checkPlan,checkRoute,planPallet,newMission,vehicleStep,cancelMission,routeAssessment} from './advanced.mjs';
const $=id=>document.getElementById(id),sessionKey='oia-workshop-robot-transfer-v1',localKey='oia-planar-cell-v1';
const el=(type,text)=>{const e=document.createElement(type);if(text!==undefined)e.textContent=text;return e;};
let c,plan,route,m,result;
const pFields=[
 ['beltMps','Belt speed (m/s)',0,1,.01],['transferS','One leg duration (s)',.2,10,.02],['payloadKg','Carton mass (kg)',0,20,.1],['torqueNm','Joint torque limit (N·m)',.1,150,.1],
 ['rows','Pallet rows',1,4,1],['columns','Pallet columns',1,4,1],['pitchM','Slot pitch (m)',.02,.30,.01]
];
const rFields=[
 ['goalX','Destination X (m)',0,5,1],['goalY','Destination Y (m)',0,3,1],['slip','Wheel slip fraction',0,.35,.01],['landmarkEvery','Landmark interval (publications; 0 off)',0,10,1],
 ['dropEvery','Lose every nth message (0 off)',0,10,1],['startYaw','Initial heading',['0','1','2','3'],['East','North','West','South']],['reliability','Writer reliability',['reliable','best-effort']],['subscriber','Reader requirement',['reliable','best-effort']]
];
function fields(id,defs,state){
  $(id).replaceChildren(...defs.map(([name,label,min,max,step])=>{
    const wrapper=el('label',label),input=el(Array.isArray(min)?'select':'input');input.name=name;
    if(Array.isArray(min))min.forEach((v,i)=>input.add(new Option(max?max[i]:v,v)));
    else{input.type='number';input.min=min;input.max=max;input.step=step;input.required=true;}
    input.value=state[name];wrapper.append(input);return wrapper;
  }));
}
function read(form,defs,state){
  const obj={...state};for(const [name] of defs){const v=$(form).elements.namedItem(name).value;obj[name]=typeof state[name]==='number'?Number(v):v;}return obj;
}
function persist(){
  c.advanced={plan,route:m.settings,ticks:m.elapsedTicks,cancelled:m.state==='cancelled'};
  const raw=JSON.stringify(validateCell(c));
  sessionStorage.setItem(sessionKey,raw);localStorage.setItem(localKey,raw);
}
function graph(){
  const tiles=[],planned=new Set(m.route.map(v=>v.join(','))),cell=m.truth.map(Math.round).join(','),blocked=new Set(route.blocked?route.blocked.split(';'):[]);
  for(let y=3;y>=0;y--)for(let x=0;x<6;x++){
    const key=[x,y].join(','),wall=blocked.has(key),label=wall?'Wall':key===cell?'Robot':key===[route.goalX,route.goalY].join(',')?'Goal':planned.has(key)?'Route':'Open';
    const tile=el('button',key+' '+label);tile.type='button';tile.setAttribute('aria-pressed',String(wall));
    if(planned.has(key))tile.classList.add('planned');if(key===cell)tile.classList.add('vehicle');
    tile.onclick=()=>{if(wall)blocked.delete(key);else blocked.add(key);route={...route,blocked:[...blocked].join(';')};graph();$('status').textContent='Map edited. Accept a new goal to use this occupancy grid.';};
    tiles.push(tile);
  }
  $('grid').replaceChildren(...tiles);
}
function inspectMotion(){
  const s=result.samples[+$('motion-cursor').value];
  $('motion-reading').textContent=s?[s.id+' / '+s.phase+' / '+s.timeS.toFixed(2)+' s','Joint angles '+s.q.map(v=>v.toFixed(3)).join(', ')+' rad','Joint torque '+s.tau.map(v=>v.toFixed(2)).join(', ')+' N·m','Clearance '+s.clearanceM.toFixed(3)+' m; |det J| '+s.jacobianM2.toFixed(5)+' m²'].join('\n'):'No reachable trajectory sample.';
}
function reportMotion(){
  result=planPallet(c,plan);$('motion-result').textContent=(result.pass?'Accepted. ':'Failed. ')+result.reason+' Delivered '+result.delivered+'/'+(plan.rows*plan.columns)+' cartons. Peak torque '+result.maxTorque.toFixed(2)+' N·m.';
  $('motion-cursor').max=Math.max(0,result.samples.length-1);$('motion-cursor').value=$('motion-cursor').max;inspectMotion();
  const list=el('ol');result.slots.forEach(s=>list.append(el('li',s.id+' → row '+(s.row+1)+', column '+(s.column+1)+' at '+s.x.toFixed(3)+', '+s.y.toFixed(3)+' m')));$('slots').replaceChildren(list);
}
function inspectRoute(){
  const s=m.feedback[+$('route-cursor').value];
  $('route-reading').textContent=s?[s.topic+' / '+s.stampS.toFixed(1)+' s / '+s.transport,'Localisation (map): '+s.estimate.map(v=>v.toFixed(3)).join(', ')+' m','Fixture truth (map): '+s.truth.map(v=>v.toFixed(3)).join(', ')+' m','Landmark correction: '+(s.landmark?'applied':'none')].join('\n'):'No topic sample yet.';
}
function reportRoute(){
  const a=routeAssessment(m),active=['accepted','executing'].includes(m.state);
  $('route-result').textContent='Action '+m.state+' · '+m.timeS.toFixed(1)+' s · error '+a.physicalError.toFixed(3)+' m · '+m.received+'/'+m.published+' messages received · '+(active?'test running':a.pass?'acceptance passed':'acceptance failed');
  $('route-cursor').max=Math.max(0,m.feedback.length-1);$('route-cursor').value=$('route-cursor').max;inspectRoute();graph();
  $('events').textContent=m.events.slice(-10).join('\n')+'\nmap → odom: '+m.mapToOdom.map(v=>v.toFixed(3)).join(', ')+' m\nodom → base: '+m.odom.map(v=>v.toFixed(3)).join(', ')+' m';
  for(const id of ['tick','finish','cancel'])$(id).disabled=!active;
}
function run(fn){try{fn();persist();$('status').textContent='Checkpoint saved in the robot project.';}catch(e){$('status').textContent=e.message;}}
try{
  const raw=sessionStorage.getItem(sessionKey)??localStorage.getItem(localKey);
  c=raw&&raw!=='null'?validateCell(JSON.parse(raw)):newCell();
  plan=checkPlan(c.advanced?.plan||defaultPlan);route=checkRoute(c.advanced?.route||defaultRoute);m=newMission(route);
  for(let i=0;i<(c.advanced?.ticks||0);i++)vehicleStep(m);
  if(c.advanced?.cancelled)cancelMission(m);
  fields('plan-settings',pFields,plan);fields('route-settings',rFields,route);reportMotion();reportRoute();
  $('motion').onsubmit=e=>{e.preventDefault();run(()=>{plan=checkPlan(read('motion',pFields,plan));reportMotion();});};
  $('navigation').onsubmit=e=>{e.preventDefault();run(()=>{const next=checkRoute(read('navigation',rFields,route));m=newMission(next);route=next;reportRoute();});};
  $('tick').onclick=()=>run(()=>{vehicleStep(m);reportRoute();});
  $('finish').onclick=()=>run(()=>{while(['accepted','executing'].includes(m.state))vehicleStep(m);reportRoute();});
  $('cancel').onclick=()=>run(()=>{cancelMission(m);reportRoute();});
  $('motion-cursor').oninput=inspectMotion;$('route-cursor').oninput=inspectRoute;
  document.body.inert=false;
}catch(e){$('status').textContent=e.message;document.body.inert=false;}
