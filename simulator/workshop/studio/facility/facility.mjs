import {createFacility,advance,act,totals,availableStock,loadFacility,saveFacility,PRODUCTS,DT} from './facility-model.mjs';
const $=id=>document.getElementById(id),make=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
import {shiftDesk} from './shift-desk.mjs';
import {openRecovery,writeRecovery,rearmRecovery} from './recovery.mjs';
let storage;try{storage=window.localStorage;}catch{}
const recovery=openRecovery(storage);
let desk,freeState,freeView;
let s,scene,selected,tracked,camera='follow',speed=1,running=!matchMedia('(prefers-reduced-motion: reduce)').matches,carry=0,lastTime,pose=[],lastRender=0,lastPanel=0,lastSave=0,lastText='',selectionStamp='',noticeTimer;
const flags={inspect:true,list:innerWidth>740,journey:innerWidth>740};
const find=(rows,id)=>rows.find(o=>o.id===id),tables=['vehicles','bays','aisles','doors','conveyors','orders'],sku=id=>PRODUCTS.find(p=>p.sku===id)?.name??id;
function lookup(id){for(const table of tables){const asset=find(s[table],id);if(asset)return {asset,table};}return {};}
const clock=t=>{const sec=Math.floor(t*DT);return [Math.floor(sec/3600),Math.floor(sec/60)%60,sec%60].map(n=>String(n).padStart(2,'0')).join(':');};
function report(msg){$('notice').textContent=msg;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{$('notice').textContent='';},4200);}
function setView(view){
  camera=view;scene?.view(view);
  for(const [id,mode] of [['follow','follow'],['overview','overview'],['aisle-camera','aisle'],['dock-camera','dock'],['plan','plan']])$(id).setAttribute('aria-pressed',String(mode===view));
}
function persist(){if(desk?.active){desk.persist();return;}const was=recovery.writable;if(!writeRecovery(recovery,storage,s,{running,speed,selected,camera})&&was)report(recovery.issue);}
function runAction(name,data){
  try{desk?.before(name,data);}catch(error){desk?.fail(error);throw error;}
  const message=act(s,name,data);desk?.after(name,data);persist();update(true);report(message);return message;
}
function guard(fn){return async e=>{try{await fn(e);}catch(err){if($('dialog').open)$('dialog-message').textContent=err.message;else report(err.message);}};}
function relate(o,table){
  if(table==='orders')return o;
  if(table==='vehicles')return find(s.orders,o.task)||[...s.orders].reverse().find(t=>t.vehicle===o.id);
  if(table==='bays')return [...s.orders].reverse().find(t=>t.bay===o.id);
  if(table==='aisles')return [...s.orders].reverse().find(t=>t.bay.startsWith(o.id+'-'));
  if(table==='doors')return [...s.orders].reverse().find(t=>t.door===o.id);
}
function select(id,focus=true){
  const {asset:a,table}=lookup(id);if(!a)return;
  selected=id;desk?.observed(id);const order=relate(a,table);if(order)tracked=order.id;
  $('asset-select').value=table==='orders'?'':id;scene?.select(table==='orders'?(order.vehicle||order.bay):id);
  if(focus){
    if(table==='vehicles'||(table==='orders'&&order.vehicle))setView('follow');
    else if(table==='bays'||table==='aisles')setView('aisle');
    else if(table==='doors')setView('dock');
    else if(table==='conveyors')setView('packing');
  }
  update(true);
}
function setFold(name,open){flags[name]=open;$(name+'-body').hidden=!open;$('fold-'+name).setAttribute('aria-expanded',String(open));}
for(const name of Object.keys(flags))$('fold-'+name).onclick=()=>{setFold(name,!flags[name]);if(name==='list')activity();else if(name==='journey')journey();else inspect();};
function dl(pairs){const d=$('asset-details');d.replaceChildren();for(const [key,val] of pairs){d.append(make('dt',key),make('dd',val));}}
function productRows(items){return items.length?items.slice(-10).map(p=>[p.id,p.sku,p.lot].join(' · ')).join('\n'):'No stock at this location.';}
function inspect(){
  const {asset:a,table}=lookup(selected);if(!a)return;
  let title=a.id,state='',summary='',details=[],stock='',button='Inspect task',fault='',alert=false;
  if(table==='vehicles'){
    const o=relate(a,table);title='Pallet truck '+a.id;state=a.state;alert=a.fault||a.state==='waiting';summary=o?sku(o.sku)+' · '+o.id:'Available for the next pick.';
    details=[['Speed',a.state==='travelling'?a.speed.toFixed(2)+' m/s':'0 m/s'],['Fork elevation',a.forkHeightM.toFixed(2)+' m'],['Load',a.load?.id||'Empty forks'],['Destination',o?(o.status==='picking'?o.bay:o.door):'Standby'],['Position',a.x.toFixed(1)+', '+a.y.toFixed(1)+' m']];
    stock=a.load?productRows([a.load]):'No pallet on the forks.';fault=a.fault?'Recover truck':'Inject truck fault';button=o?'Inspect order':'Create order';
  }else if(table==='bays'){
    title='Rack bay '+a.id;state=a.stock.length+' of '+a.capacity+' positions filled';summary='Aisle '+a.aisle+' / '+(a.side==='L'?'left':'right')+' face / column '+a.column;
    details=[['Available',availableStock(s,a).length+' pallets'],['Floor position',a.x.toFixed(1)+', '+a.y.toFixed(1)+' m']];stock=productRows(a.stock);button='Pick from bay';fault=find(s.aisles,a.aisle).blocked?'Reopen aisle':'Block aisle';
  }else if(table==='aisles'){
    const bays=s.bays.filter(b=>b.aisle===a.id),stockN=bays.reduce((n,b)=>n+b.stock.length,0),v=s.vehicles.find(v=>v.lane===a.id);
    title='Storage aisle '+a.id;state=a.blocked?'Entry blocked':'Entry available';alert=a.blocked;summary='Two facing racks with eight bays on each side.';details=[['Stored stock',stockN+' pallets'],['Capacity',bays.length*3+' positions'],['Inside aisle',v?.id||'Clear']];stock=bays.map(b=>b.id+' · '+b.stock.length+' pallets').join('\n');fault=a.blocked?'Reopen aisle':'Block aisle';button='Inspect rack bay';
  }else if(table==='doors'){
    title='Dispatch door '+a.id;state=a.open?'Door open':'Door closed';alert=!a.open;summary='Trailer '+a.trailer+' · outbound staging';details=[['Ready',a.staged.length+' pallets'],['Dispatched',a.dispatched.length+' pallets'],['Current truck',s.vehicles.find(v=>v.dock===a.id)?.id||'Clear']];stock=productRows([...a.staged,...a.dispatched]);button=a.staged.length?'Dispatch staged pallet':'Create order';fault=a.open?'Close door':'Reopen door';
  }else if(table==='conveyors'){
    title='Receiving line '+a.id;state=a.running?'Belt running':'Belt stopped';alert=!a.running;summary='Inbound pallets travel to available storage positions.';details=[['Belt length',a.length+' m'],['Surface speed',a.running?'0.50 m/s':'0 m/s'],['In transit',a.parcels.length+' pallets']];stock=productRows(a.parcels);button='Inspect receiving bay';fault=a.running?'Stop conveyor':'Restart conveyor';
  }else{
    title='Order '+a.id;state=a.status;summary=sku(a.sku);details=[['Inventory',a.pallet],['Intake lot',a.lot],['Pick location',a.bay],['Dispatch door',a.door],['Assigned truck',a.vehicle||'Waiting']];stock=productRows([{id:a.pallet,sku:a.sku,lot:a.lot}]);button=a.status==='staged'?'Dispatch order':a.status==='dispatched'?'Inspect trailer':'Redirect order';
  }
  $('asset-name').textContent=title;$('asset-state').textContent=state.toUpperCase();$('asset-state').classList.toggle('alert',alert);$('asset-summary').textContent=summary;dl(details);$('stock-list').textContent=stock;$('stock-list').style.whiteSpace='pre-line';$('asset-action').textContent=button;$('fault-toggle').hidden=!fault;$('fault-toggle').textContent=fault;
}
function rowState(o,cat){return cat==='vehicles'?o.state:cat==='orders'?o.status:cat==='bays'?o.stock.length+'/'+o.capacity+' pallets':cat==='aisles'?(o.blocked?'Blocked':'Open'):cat==='doors'?(o.open?'Open':'Closed'):(o.running?'Running':'Stopped');}
function activity(){
  if(!flags.list)return;const cat=$('category').value,filter=$('filter').value.toLowerCase();const rows=s[cat].filter(a=>{
    const content=[a.id,rowState(a,cat),a.load?.id,a.task,a.sku,a.lot,a.pallet,a.trailer,...(a.stock||[]).flatMap(p=>[p.sku,p.lot,p.id])].filter(Boolean).join(' ').toLowerCase();return content.includes(filter);
  }).slice();
  const sort=$('sort').value;
  const load=a=>a.stock?.length??a.staged?.length??(a.load||a.pallet?1:0);
  rows.sort((a,b)=>sort==='state'?rowState(a,cat).localeCompare(rowState(b,cat))||a.id.localeCompare(b.id):sort==='load'?load(b)-load(a)||a.id.localeCompare(b.id):a.id.localeCompare(b.id));
  $('list-count').textContent=rows.length;const snapshot=cat+'|'+rows.slice(0,50).map(a=>[a.id,rowState(a,cat),a.task,a.load?.id,a.id===selected].join(':')).join('|');
  if(snapshot===lastText)return;lastText=snapshot;
  const container=$('activity-list'),active=document.activeElement?.dataset?.id;container.replaceChildren();
  for(const a of rows.slice(0,50)){const b=make('button');b.dataset.id=a.id;b.setAttribute('aria-pressed',String(a.id===selected));b.append(make('b',a.id),make('span',rowState(a,cat)+(a.task?' · '+a.task:'')));b.onclick=()=>select(a.id);container.append(b);}
  if(active)Array.from(container.children).find(el=>el.dataset.id===active)?.focus({preventScroll:true});
  if(!rows.length)container.append(make('p','No matching assets.'));else if(rows.length>50)container.append(make('small','First 50 shown. Filter by ID to narrow the list.'));
}
function journey(){
  const o=find(s.orders,tracked);$('journey-id').textContent=o?o.pallet:'No tracked order';$('journey-route').textContent=o?o.lot+' · '+o.bay+' → '+o.door+' · '+o.sku:'Select an order or a truck to trace its pallet.';const list=$('journey-stops');list.replaceChildren();
  if(o)for(const m of o.journey.slice(-6)){const li=make('li',m.step);li.title=m.asset;li.append(make('span',clock(m.tick)));list.append(li);}
}
function update(force=false){
  if(force){lastText='';scene?.update(s);}
  const t=totals(s),pending=s.orders.filter(o=>!['dispatched','cancelled'].includes(o.status)),busy=s.vehicles.reduce((n,v)=>n+v.busyTicks,0);
  $('k-orders').textContent=pending.length;$('k-queue').textContent=pending.filter(o=>o.status==='queued').length+' awaiting pick';
  $('k-fill').textContent=(100*t.rack/(s.bays.length*3)).toFixed(1)+'%';$('k-stock').textContent=t.rack+' / '+s.bays.length*3+' positions';
  $('k-busy').textContent=Math.round(100*busy/(s.tick*s.vehicles.length))+'%';$('k-sent').textContent=t.sent;
  $('clock').textContent=clock(s.tick);$('toggle-play').textContent=running?'Pause':'Play';$('toggle-play').setAttribute('aria-label',running?'Pause simulation':'Resume simulation');if(flags.inspect)inspect();if(flags.journey)journey();activity();desk?.draw();
}
function poses(){return s.vehicles.map(v=>({x:v.x,y:v.y,heading:v.heading,forkHeightM:v.forkHeightM}));}
function animate(now){
  const elapsed=lastTime===undefined?0:Math.min(.5,(now-lastTime)/1000);lastTime=now;
  if(running){
    carry+=elapsed*speed;while(carry>=DT){pose=poses();try{advance(s);carry-=DT;}catch(e){running=false;carry=0;report(e.message);break;}}
    if(now-lastRender>=40&&scene){
      const t=Math.min(1,carry/DT);const display={...s,vehicles:s.vehicles.map((v,i)=>({...v,x:pose[i].x+(v.x-pose[i].x)*t,y:pose[i].y+(v.y-pose[i].y)*t,forkHeightM:pose[i].forkHeightM+(v.forkHeightM-pose[i].forkHeightM)*t}))};
      scene.update(display);lastRender=now;
    }
    if(now-lastPanel>350){update();lastPanel=now;}
    if(now-lastSave>4000){persist();lastSave=now;}
  }
  requestAnimationFrame(animate);
}
function chooseInitial(){
  const v=s.vehicles.find(v=>v.load&&v.state==='travelling')||s.vehicles[0];selected=v.id;tracked=v.task;pose=poses();$('asset-select').replaceChildren();
  for(const key of tables.filter(x=>x!=='orders')){const opt=make('optgroup');opt.label=key;for(const a of s[key])opt.append(new Option(a.id,a.id));$('asset-select').append(opt);}
  $('asset-select').value=v.id;scene?.update(s);scene?.select(v.id);setView('follow');update(true);
}
function dialog(title){$('dialog-title').textContent=title;$('dialog-body').replaceChildren();$('dialog-message').textContent='';if(!$('dialog').open)$('dialog').showModal();return $('dialog-body');}
function field(form,label,options,value){const l=make('label',label),input=make('select');for(const [id,txt] of options)input.append(new Option(txt,id));if(value)input.value=value;l.append(input);form.append(l);return input;}
function button(where,title,fn,id){const b=make('button',title);b.type='button';if(id)b.id=id;b.onclick=guard(fn);where.append(b);return b;}
function orderForm(order=null,bayId=null,doorId=null){
  const body=dialog(order?'Redirect '+order.id:'Create a dispatch order'),form=make('form');body.append(form);
  const p=field(form,'Product',PRODUCTS.map(p=>[p.sku,p.sku+' · '+p.name]),order?.sku||desk?.active?.ticket.sku||find(s.bays,bayId)?.stock[0]?.sku);p.disabled=!!order;
  const b=field(form,'Reserve from rack bay',[]),d=field(form,'Dispatch door',s.doors.map(a=>[a.id,a.id+' · '+a.trailer+(a.open?'':' · closed')]),order?.door||doorId);
  function refresh(){
    b.replaceChildren();const rows=s.bays.filter(a=>order?.status==='delivering'?a.id===order.bay:(order?.bay===a.id||availableStock(s,a).some(x=>x.sku===p.value)));
    for(const a of rows)b.append(new Option(a.id+' · '+a.stock.length+' stored',a.id));if(rows.some(a=>a.id===(order?.bay||bayId)))b.value=order?.bay||bayId;
    b.disabled=order?.status==='delivering';
  }p.onchange=refresh;refresh();const submit=make('button',order?'Apply redirect':'Reserve pallet and release order');submit.className='primary';form.append(submit);
  form.onsubmit=guard(e=>{e.preventDefault();if(order){runAction('redirect',{order:order.id,bay:b.value,door:d.value});select(order.id,false);}else{runAction('order',{bay:b.value,door:d.value,sku:p.value});select(s.orders.at(-1).id,false);}setFold('inspect',true);$('dialog').close();});
}
function scenario(){
  const body=dialog('Scenario and evidence');body.append(make('p','The local shelf retains this learner’s simulated run. Export the action log to replay equipment movement, stock reservations and dispatches on either edition.'));
  const t=totals(s);body.append(make('p','Reconciliation: '+t.rack+' racked + '+t.line+' on belts + '+t.moving+' on vehicles + '+t.staged+' staged + '+t.sent+' dispatched = '+t.total+' identified pallets. Initial balance '+s.initialCount+'.'));
  const row=make('div');row.className='dialog-actions';body.append(row);
  if(!recovery.writable){
    body.append(make('p',recovery.issue));button(row,'Replace local recovery with this run',()=>{
      if(!confirm('Replace this learner’s existing saved facility scenario with the current run?'))return;
      rearmRecovery(recovery,storage);persist();scenario();
    },'replace-recovery');
  }
  button(row,'Export scenario',async()=>{const text=saveFacility(s);if(window.workshopHost?.saveProject){if(await window.workshopHost.saveProject(text))$('dialog-message').textContent='Scenario exported.';}else{download(text,'facility-scenario.json');$('dialog-message').textContent='Scenario exported.';}},'scenario-export');
  button(row,'Import scenario',async()=>{if(desk?.active)throw Error('Return to Free shift before opening a different facility scenario.');if(window.workshopHost?.openProject){const text=await window.workshopHost.openProject();if(text!==null&&text!==undefined)confirmImport(text);}else $('scenario-file').click();},'scenario-import');
  button(row,s.auto?'Stop automatic demand':'Enable automatic demand',()=>{runAction('auto',{enabled:!s.auto});scenario();},'auto-demand');
  button(row,'Restart demonstration',()=>{if(desk?.active)throw Error('Use Choose a job to retry this assignment or return to Free shift.');if(confirm('Replace the current facility run with the original demonstration?')){s=createFacility();running=!matchMedia('(prefers-reduced-motion: reduce)').matches;carry=0;chooseInitial();persist();$('dialog').close();}},'restart');
  const credits=make('p','Geometry adapted from NVIDIA Corporation’s Physical AI SimReady Warehouse OpenUSD Dataset. Offline visual meshes are transformed, simplified and recoloured under CC BY 4.0. '),link=make('a','Full attribution, licence and source layers');link.href='./assets/ATTRIBUTION.md';credits.append(link);body.append(credits);
  button(row,'Download dispatch register',()=>{const records=s.doors.flatMap(d=>d.dispatched.map(p=>({door:d.id,trailer:d.trailer,...p})));download(JSON.stringify({units:'pallets',simulatedSeconds:s.tick*DT,records,balance:t},null,2),'facility-dispatch.json');});
}
function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=make('a');a.download=name;a.href=url;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function confirmImport(text){const next=loadFacility(text);if(!confirm('Open this scenario in place of the current run?'))return;s=next;running=false;carry=0;chooseInitial();persist();$('dialog').close();report('Scenario reopened at '+clock(s.tick)+'.');}
$('scenario-file').onchange=guard(async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;if(f.size>=512000)throw Error('Scenario exceeds 512 kB.');confirmImport(await f.text());});
$('asset-action').onclick=guard(()=>{const {asset:a,table}=lookup(selected);
  if(table==='vehicles'){const o=relate(a,table);if(o)select(o.id,false);else orderForm();}
  if(table==='bays')orderForm(null,a.id);if(table==='aisles')select(s.bays.find(b=>b.aisle===a.id).id);
  if(table==='doors'){const o=s.orders.find(o=>o.status==='staged'&&o.door===a.id);if(o){runAction('dispatch',{order:o.id});select(o.id,false);}else orderForm(null,null,a.id);}
  if(table==='conveyors'){if(a.parcels[0])select(a.parcels[0].destination);else select(s.bays[0].id);}
  if(table==='orders'){if(a.status==='staged')runAction('dispatch',{order:a.id});else if(a.status==='dispatched')select(a.door);else orderForm(a);}
});
$('fault-toggle').onclick=guard(()=>{const {asset:a,table}=lookup(selected);
  if(table==='vehicles')runAction('truck',{id:a.id,fault:!a.fault});
  if(['bays','aisles'].includes(table)){const aisle=table==='aisles'?a:find(s.aisles,a.aisle);runAction('aisle',{id:aisle.id,blocked:!aisle.blocked});}
  if(table==='doors')runAction('door',{id:a.id,open:!a.open});if(table==='conveyors')runAction('conveyor',{id:a.id,running:!a.running});
});
$('menu').onclick=scenario;$('close').onclick=()=>$('dialog').close();$('order-open').onclick=()=>orderForm();
$('category').onchange=$('sort').onchange=$('filter').oninput=activity;$('asset-select').onchange=e=>select(e.target.value);
$('toggle-play').onclick=()=>{running=!running;lastTime=undefined;carry=0;pose=poses();update(true);persist();};
$('step').onclick=guard(()=>{running=false;advance(s,4);carry=0;pose=poses();update(true);persist();});
$('speed').onchange=e=>{speed=Number(e.target.value);};
$('follow').onclick=()=>{const {asset:a,table}=lookup(selected);const pick=table==='vehicles'?a:find(s.vehicles,relate(a,table)?.vehicle)||s.vehicles.find(v=>v.load)||s.vehicles[0];select(pick.id);};
for(const [id,view] of [['overview','overview'],['plan','plan'],['aisle-camera','aisle'],['dock-camera','dock']])$(id).onclick=()=>setView(view);
window.addEventListener('pagehide',persist);document.addEventListener('visibilitychange',()=>{lastTime=undefined;});
s=recovery.scenario;freeState=s;freeView=recovery.view;if(recovery.issue)report(recovery.issue);
function swapFloor(floor,play){
  s=floor;running=play;carry=0;lastTime=undefined;chooseInitial();
}
desk=shiftDesk({profile:recovery.profile,storage,selected:()=>selected,choose:(id,focus=true)=>{setFold('inspect',true);select(id,focus);},dialog,orderForm,report,download,mutate:runAction,
  saveFree:()=>{freeState=s;freeView={running,speed,selected,camera};persist();},
  swap:swapFloor,
  restoreFree:()=>{swapFloor(freeState,freeView?.running??!matchMedia('(prefers-reduced-motion: reduce)').matches);if(freeView?.selected&&lookup(freeView.selected).asset)select(freeView.selected,false);if(freeView?.camera)setView(freeView.camera);},
  synced:()=>{running=false;carry=0;pose=poses();update(true);}
});
if(desk.active){s=desk.active.floor;running=false;}
for(const [k,v] of Object.entries(flags))setFold(k,v);
const viewport=$('facility-viewport');
const controls={onSelect:id=>select(id),onCamera:view=>{if(typeof view==='string')camera=view;}};
try{
  const {createFacilityScene}=await import('./scene.mjs');
  scene=await createFacilityScene(viewport,controls);
}catch(error){
  try{
    viewport.replaceChildren();
    const {facilityPlan}=await import('./plan.mjs');
    scene=facilityPlan(viewport,controls);
    report('3D unavailable. The interactive floor plan is ready.');
  }catch(planError){
    document.dispatchEvent(new CustomEvent('facility-start-failed',{detail:error.message+' / '+planError.message}));
  }
}
if(scene){
  chooseInitial();const saved=desk.active?null:recovery.view;
  if(saved){if([1,2,5,10].includes(saved.speed)){speed=saved.speed;$('speed').value=speed;}if(typeof saved.running==='boolean')running=saved.running&&!matchMedia('(prefers-reduced-motion: reduce)').matches;if(lookup(saved.selected).asset)select(saved.selected,false);if(['follow','overview','aisle','dock','plan','packing','floor'].includes(saved.camera))setView(saved.camera);update(true);}
  const requestedJob=new URL(location.href).searchParams.get('job');if(requestedJob)desk.openJob(requestedJob);
  $('room').inert=false;$('recovery').hidden=true;document.body.inert=false;document.body.dataset.ready='true';requestAnimationFrame(animate);
}
