import { createProject, addAsset, configure, connect, addCarton, step, command, inspect, assess, saveProject, loadProject as replayProject } from './model.mjs';
import { chapters, coaching, depths, modes, paths } from './curriculum.mjs';

const el = id => document.getElementById(id);
const element = (tag, content) => {
  const node = document.createElement(tag);
  if (content !== undefined) node.textContent = content;
  return node;
};
const buttons = (title, handler) => {
  const button = element('button', title);
  button.type = 'button';
  button.addEventListener('click', guard(handler));
  return button;
};
function options(node, items, value) {
  node.replaceChildren(...items.map(item => {
    const [key, label] = Array.isArray(item) ? item : [item, item];
    return new Option(label, key);
  }));
  if (Array.from(node.options).some(o => o.value === String(value))) node.value = value;
}
let timer, alertTimer, lastTime, carry, checkpoint, undos = [], selected = '', callback, profile = 'Learner', mode = modes[0], active;
const types = {conveyor:'Conveyor',bracket:'Mounting bracket',sensor:'Photoeye',plc:'Programmable logic controller',hmi:'Operator display',camera:'Camera',switch:'Managed switch',viewer:'Viewing station',robot:'Robot and vacuum gripper',erp:'ERP endpoint'};
const outs = {conveyor:['track'],bracket:['mount'],sensor:['out'],plc:['bus','request'],camera:['eth'],viewer:['eth'],robot:['ack']};
const ins = {bracket:['base'],sensor:['base'],plc:['I0','I1','ack'],hmi:['bus'],switch:['p1','p2','p3','p4'],robot:['request']};
const labels = {speed:'Belt speed (m/s)',length:'Belt length (m)',x:'Position along belt (m)',width:'Width (m)',input:'PLC input',mode:'Counter instruction',tag:'Display tag',ip:'IPv4 address',mask:'Prefix length (bits)',gateway:'Gateway address',bitrate:'Stream rate (Mbit/s)',power:'Required power (W)',timeSynced:'Synchronised time',permitted:'Viewing permission',poeBudget:'Power over Ethernet budget (W)',uplink:'Uplink connected',route:'Permit routed traffic',target:'Pick target (m)',vacuum:'Vacuum available',enabled:'Robot enabled',online:'ERP online',dropAck:'Drop acknowledgement'};
const enumerated = {input:['I0','I1'],mode:[['rising','Rising edge'],['level','Every high scan'],['falling','Falling edge']],tag:['count','I0','I1']};
const key = suffix => 'oia-workshop-v1:' + encodeURIComponent(profile) + ':' + suffix;
function tell(message) {
  el('notice').textContent = message;
  clearTimeout(alertTimer);
  alertTimer = setTimeout(() => { el('notice').textContent = ''; }, 8500);
}
function guard(fn) {
  return async event => {
    try { await fn(event); } catch (error) { tell(error.message); }
  };
}
function listen(id, event, handler) { el(id).addEventListener(event, guard(handler)); }
function submit(id, handler) { listen(id, 'submit', e => { e.preventDefault(); return handler(); }); }
const recordLike=value=>value!==null && typeof value==='object' && !Array.isArray(value);
function validateDisplay(p) {
  const l=p.learning, cad=p.extensions.cad;
  const bad=reason=>{throw Error('Invalid project '+reason+'.');};
  if(!depths.includes(l.depth)||!Number.isInteger(l.chapter)||l.chapter<1||l.chapter>chapters.length||
     !Array.isArray(l.bookmarks)||l.bookmarks.some(n=>!Number.isInteger(n)||n<1||n>chapters.length)||
     l.notebook.length>4000||(l.mode!==undefined&&!modes.includes(l.mode)))bad('learning record');
  for(const f of ['videoBlocked','videoRestored'])if(l[f]!==undefined&&typeof l[f]!=='boolean')bad('network learning evidence');
  if(l.demonstrated!==undefined && (!recordLike(l.demonstrated)||Object.entries(l.demonstrated).some(([id,e])=>
    !chapters.some(ch=>ch.test===id)||!recordLike(e)||!Number.isSafeInteger(e.scan)||e.scan<0||!Number.isSafeInteger(e.seed)||e.seed<0)))bad('assessment record');
  if(cad!=null){
    if(!recordLike(cad)||typeof cad.name!=='string'||!cad.name.trim()||cad.name.length>255||!Number.isFinite(cad.widthM)||cad.widthM<=0)bad('CAD measurement');
    if(cad.dimensionsM!==undefined&&(!Array.isArray(cad.dimensionsM)||cad.dimensionsM.length!==3||cad.dimensionsM.some(v=>!Number.isFinite(v)||v<0)))bad('CAD dimensions');
    if(cad.sourceChunks!==undefined&&(!Array.isArray(cad.sourceChunks)||!cad.sourceChunks.length||cad.sourceChunks.some(s=>typeof s!=='string'||!s.length||s.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(s))))bad('CAD source bytes');
    if(cad.upAxis!==undefined&&!['Z','Y','format'].includes(cad.upAxis))bad('CAD up axis');
    if(cad.sourceUnit!==undefined && cad.sourceUnit!=='format' && ![.001,.0254,1].includes(cad.sourceUnit))bad('CAD scale');
    if(cad.deviation!==undefined&&(!Number.isFinite(cad.deviation)||cad.deviation<=0))bad('CAD tolerance');
    if(cad.parts!==undefined&&(!Array.isArray(cad.parts)||cad.parts.some(s=>typeof s!=='string')))bad('CAD part tree');
  }
  for(const key of ['practice','layout','robot','electrical','servers','commissioning','infrastructure'])
    if(p.extensions[key]!=null&&!recordLike(p.extensions[key]))bad(key+' workspace');
  if(p.assets.some(a=>!Object.hasOwn(types,a.type)||typeof a.id!=='string'))bad('asset schedule');
  return p;
}
function loadProject(text){return validateDisplay(replayProject(text));}
function storeCurrent() {
  localStorage.setItem(key('active'), saveProject(active));
}
function persist() {
  try { storeCurrent(); } catch (e) { tell('Local recovery could not be saved: ' + e.message + ' Export this project.'); }
}
function pause() {
  clearInterval(timer); timer = undefined;
  el('play').textContent = 'Run clock';
}
function refresh(all = false) {
  if (all) { drawDesign(); drawGuide(); drawCabinet(); }
  drawReadings();
}
function runtime(action, message) {
  action();
  undos = [];
  refresh(); persist();
  if (message) tell(message);
}
function design(action, message) {
  pause();
  const before = saveProject(active), oldPath=inspect(active).network;
  action();
  const newPath=inspect(active).network;
  if(oldPath.video && !newPath.video && newPath.link && !newPath.reachable)active.learning.videoBlocked=true;
  if(active.learning.videoBlocked && !oldPath.video && newPath.video)active.learning.videoRestored=true;
  undos.push(before);
  if (undos.length > 20) undos.shift();
  refresh(true); persist(); tell(message);
}
function replaceProject(project, message) {
  pause(); active = project; checkpoint = null; undos = []; selected = '';
  active.learning.chapter = Math.max(1,Math.min(chapters.length,active.learning.chapter));
  if (!depths.includes(active.learning.depth)) active.learning.depth = depths[1];
  mode = modes.includes(active.learning.mode) ? active.learning.mode : mode;
  active.learning.mode=mode; el('assessment').replaceChildren(); el('comparison').textContent='';
  refresh(true); persist(); if (message) tell(message);
}
function confirmReplace(action) {
  pause(); callback = action; el('confirm').returnValue='cancel'; el('confirm').showModal();
}
listen('confirm','close', () => { const run = callback; callback = null; if (el('confirm').returnValue === 'replace') run?.(); });
function fresh(start) { return createProject(start, crypto.getRandomValues(new Uint32Array(1))[0]); }
function changeMode(value) {
  mode = value; active.learning.mode = value; drawGuide(); persist();
}
function svgNode(type, attrs, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg',type);
  for (const [key,value] of Object.entries(attrs)) node.setAttribute(key,value);
  if (text !== undefined) node.textContent = text;
  return node;
}
function drawScene() {
  const svg = svgNode('svg',{viewBox:'0 0 620 205',role:'img','aria-label':'Side view of the current cell. Belt direction is left to right. All equipment can also be selected in the asset inspector.'});
  const add = (type,attrs,text) => svg.append(svgNode(type,attrs,text));
  const text = (x,y,value) => add('text',{x,y},value);
  for (let x=25;x<620;x+=36) add('line',{x1:x,y1:0,x2:x,y2:205,stroke:'#d8e4df'});
  for (let y=25;y<205;y+=36) add('line',{x1:0,y1:y,x2:620,y2:y,stroke:'#d8e4df'});
  const find = type => active.assets.find(a=>a.type === type);
  const belt=find('conveyor'), bracket=find('bracket'), eye=find('sensor'), robot=find('robot');
  if (!belt) { text(25,92,'Empty packaging cell');text(25,118,'Place a conveyor to begin.'); }
  else {
    const pos = m => 42 + Math.min(1,Math.max(0,m/belt.length))*532;
    add('rect',{x:35,y:120,width:550,height:20,rx:10,fill:'#35575f'});
    for (let x=47;x<580;x+=27) add('circle',{cx:x,cy:130,r:5,fill:'#c4d6d0'});
    for (const x of [85,530]) add('path',{d:'M'+x+' 140v25h23',fill:'none',stroke:'#5e7678','stroke-width':5});
    text(35,190,'0 m');text(500,190,belt.length+' m');
    const joined = (from,port,to,input) => active.links.some(l=>l.from===from?.id&&l.port===port&&l.to===to?.id&&l.input===input);
    if (bracket && joined(belt,'track',bracket,'base')) {
      const x=pos(bracket.x);add('path',{d:'M'+x+' 120V84h13',fill:'none',stroke:'#566c73','stroke-width':5});
      if (eye && joined(bracket,'mount',eye,'base')) {
        const x=pos(bracket.x+eye.x); add('rect',{x:x-8,y:72,width:16,height:13,fill:'#00725c'});
        add('line',{x1:x,y1:85,x2:x,y2:119,stroke:'#a84c13','stroke-dasharray':'4 3','stroke-width':2});text(Math.min(x,510),65,'Photoeye');
      }
    }
    if (robot) {const x=pos(robot.target);add('path',{d:'M'+x+' 105l20 -42 -32 -22',fill:'none',stroke:'#ab6331','stroke-width':8});text(Math.min(x+20,520),42,'Robot');}
    for (const carton of active.runtime.cartons.filter(c=>['moving','waiting'].includes(c.status)).slice(-50)) {
      const x=pos(carton.x);add('rect',{x:x-13,y:98,width:14,height:21,fill:'#d48b43',stroke:'#6f4428'});
    }
    text(25,28,'Conveyor '+belt.id+'  /  '+belt.speed+' m/s');
  }
  el('drawing').replaceChildren(svg);
}
function drawReadings() {
  const state = inspect(active), r=active.runtime;
  drawScene();
  const values=[['Simulation time',state.time.toFixed(1)+' s'],['PLC input',state.input?'HIGH':'LOW'],['PLC counter',r.count],['HMI display',state.hmi===null?'Unbound':String(state.hmi)]];
  el('readings').replaceChildren(...values.map(([name,value])=>{const box=element('div');box.append(element('small',name),element('strong',value));return box;}));
  el('diagnostics').replaceChildren(element('p','Camera: '+state.network.reason+'. Power '+(state.network.power?'on':'off')+', physical link '+(state.network.link?'up':'down')+', IP path '+(state.network.reachable?'available':'unavailable')+'.'),element('p',state.firstOut?'First-out at scan '+state.firstOut.scan+': '+state.firstOut.reason:'First-out: clear.'));
  el('events').replaceChildren(...r.events.slice(-10).reverse().map(ev=>element('li',(ev.scan/10).toFixed(1)+' s · '+ev.asset+' · '+ev.message)));
  el('scans').replaceChildren(...r.scans.slice(-15).reverse().map(s=>{const tr=element('tr');for(const v of [s.scan,+s.I0,+s.I1,s.count])tr.append(element('td',v));return tr;}));
  el('records').replaceChildren(element('p','Active order: '+(r.order||'none')+'. Pallets: '+r.pallets.length+'. Accepted postings: '+r.postings.length+'.'),...r.pallets.slice(-12).map(p=>element('p',[p.id,p.carton,p.lot,p.order||'unassigned',p.status].join(' / '))));
  el('restore').disabled=!checkpoint;el('undo').disabled=!undos.length;
  el('carton').disabled=!active.assets.some(a=>a.type==='conveyor');
  if(r.program)el('diagnostics').append(element('p','Active PLC program: '+r.program.language+'. '+(r.diagnostic||'Running without a diagnostic.')));
  if (el('assessment').children.length) drawAssessment();
}
function drawAssessment() {
  const checks=assess(active);
  el('assessment').replaceChildren(...checks.map(c=>element('li',(c.pass?'Passed':'Open')+' · '+(chapters.find(ch=>ch.test===c.id)?.title||c.id)+' · '+c.reason)));
}
function chapterMastery() {
  const checks=assess(active), checked=id=>checks.some(c=>c.id===id&&c.pass);
  const report=active.learning.demonstrated && typeof active.learning.demonstrated==='object' && !Array.isArray(active.learning.demonstrated)?active.learning.demonstrated:{};
  const configured=(type,keys)=>active.history.some(([op,id,patch])=>op==='configure'&&current(id)?.type===type&&keys.some(key=>Object.hasOwn(patch,key)));
  const placed=type=>active.history.some(([op,kind])=>op==='addAsset'&&kind===type);
  const wired=(from,to)=>active.history.some(([op,id,,target])=>op==='connect'&&current(id)?.type===from&&current(target)?.type===to);
  const cmd=name=>active.history.some(([op,n])=>op==='command'&&n===name);
  const events=active.runtime.events;
  const sequence=(...kinds)=>{let index=-1;return kinds.every(kind=>{index=events.findIndex((e,i)=>i>index&&e.kind===kind);return index>=0;});};
  const predicted=cmd('predict')&&checked('transfer');
  const evidence={
    travel:predicted&&(placed('conveyor')||configured('conveyor',['speed'])||configured('bracket',['x'])),
    sensor:wired('sensor','plc')&&(active.runtime.scans.some(s=>s.input)||active.runtime.cartons.some(c=>c.requestScan!==null&&Number.isFinite(c.requestScan))),
    counter:cmd('installProgram')||configured('plc',['mode'])||placed('plc')&&wired('sensor','plc'),
    hmi:wired('plc','hmi')||configured('hmi',['tag']),
    video:active.learning.videoBlocked&&active.learning.videoRestored,
    pallet:sequence('first-out','reset','placed'),
    erp:cmd('retryERP')&&sequence('erp-commit','ack-lost','ack'),
    commissioning:active.runtime.evidence.filter(e=>e.pass).every(e=>new Set([e.tester,e.witness,e.authority]).size===3)&&cmd('evidence'),
    transfer:active.start==='blank'&&predicted&&placed('conveyor')&&wired('bracket','sensor')
  };
  for(const c of checks)if(c.pass&&evidence[c.id])report[c.id]={scan:active.runtime.scan,seed:active.seed};
  active.learning.demonstrated=report;
}
function drawGuide() {
  options(el('mode'),modes,mode);options(el('depth'),depths,active.learning.depth);options(el('chapter'),chapters.map((c,i)=>[i+1,(i+1)+'. '+c.title]),active.learning.chapter);
  const chapter=chapters[active.learning.chapter-1], intro=element('p','CHAPTER '+String(active.learning.chapter).padStart(2,'0')+' / '+mode.toUpperCase());intro.className='kicker';
  const title=element('h2',chapter.question);title.id='guide-title';
  const guide=el('guide');guide.replaceChildren(intro,title);
  const chain=element('div');chain.className='chain';chain.append(...chapter.chain.map((s,i)=>element('span',(i+1)+'. '+s)));guide.append(chain);
  guide.append(element('p',coaching[chapter.test][Math.max(0,depths.indexOf(active.learning.depth))]));
  if (mode==='Free Build') guide.append(element('p','Use the inspector to place equipment with your own IDs and connect individual terminals. Return to Guided Learning to resume this chapter.'));
  if (mode==='Explore the Reference Plant') {
    const a=element('a','Open the complete potato processing plant');a.href='../';guide.append(a,element('p','Use Load reference cell for an editable packaging cell in this workshop.'));
  }
  if (mode==='Commissioning') guide.append(element('p','Lifecycle order: define requirements, witness supplier FAT, install assets and cabling, complete SAT, test integrated recovery, then issue the handover. Chapters follow one carton and revisit these phases for teaching.'));
  if (mode==='Engineering Challenge') guide.append(element('p','Build a new cell. Choose a different detection distance, predict the next carton crossing, then prove the intended count and business posting.'));
  if (mode==='Incident Shift') guide.append(element('p','Start an incident to load a working reference with a repeatable fault. Diagnose the failed layer before changing the design.'),buttons('Start incident',()=>confirmReplace(()=>{const p=fresh('reference');const fault=p.seed%3;if(fault===0)configure(p,'switch',{vlan1:40});if(fault===1)configure(p,'camera',{permitted:false});if(fault===2)configure(p,'switch',{poeBudget:2});p.learning.chapter=5;p.learning.mode=mode;replaceProject(p,'Incident started. Read the camera diagnostics.');})));
  if (mode!=='Free Build') {
    const instructions=element('details');
    instructions.append(element('summary','Worked example and practical steps'),element('p',chapter.example));
    const list=element('ol');list.append(...chapter.actions.map(a=>element('li',a)));instructions.append(list);guide.append(instructions);
    if(active.learning.depth==='Explore')guide.append(element('p',chapter.actions[0]));
    const hint=element('details');hint.append(element('summary',"I don’t know yet"),element('p',chapter.hint),element('p',chapter.misconception));guide.append(hint);
  }
  const actions=element('div');actions.className='tools';
  actions.append(buttons('Open in Free Build',()=>changeMode('Free Build')),buttons('Start this chapter independently',()=>confirmReplace(()=>{const p=fresh(active.learning.chapter===1?'blank':'reference');p.learning.chapter=active.learning.chapter;p.learning.depth=active.learning.depth;p.learning.mode=mode;replaceProject(p,'Chapter opened as an editable project.');})));
  const jump=element('a','Go to cell schematic');jump.href='#bench';actions.prepend(jump);guide.append(actions);
  const mastery=active.learning.demonstrated?.[chapter.test];if(mastery)guide.append(element('p','Assessment recorded at scan '+mastery.scan+' in seed '+mastery.seed+'.'));
  const path=element('details');path.append(element('summary','Role learning path'));for(const [stage,task] of paths)path.append(element('p',stage+' · '+task));guide.append(path);
  if(mode==="Engineer’s Reference"){guide.append(element('p','This built-in packaging cell uses a one-dimensional constant-speed belt, a sampled beam and a discrete pick target. Each 100 ms tick samples the input, executes the counter, processes the handshake and posts completed pallets. Use the full plant for process and mass-flow dynamics.'));}
}
function current(id) { return active.assets.find(a=>a.id===id); }
function configForm() {
  selected=el('asset').value;
  const a=current(selected), form=el('config');form.replaceChildren();
  if(!a) {form.append(element('p','Place equipment to edit its dimensions, signals or settings.'));return;}
  for(const [key,val] of Object.entries(a)){
    if(key==='id'||key==='type')continue;
    const label=element('label',labels[key]||(/^vlan/.test(key)?'Port '+key.slice(-1)+' access VLAN':key));
    const select=Object.hasOwn(enumerated,key)||typeof val==='boolean', field=element(select?'select':'input');field.name=key;
    if(typeof val==='boolean')options(field,[['true','On'],['false','Off']],String(val));
    else if(Object.hasOwn(enumerated,key))options(field,enumerated[key],val);
    else {field.type=typeof val==='number'?'number':'text';if(field.type==='number')field.step='any';field.value=val;field.required=true;}
    label.append(field);form.append(label);
  }
  const apply=element('button','Apply settings');form.append(apply);
}
function terminals() {
  options(el('out'),outs[current(el('from').value)?.type]||[],el('out').value);
  options(el('in'),ins[current(el('to').value)?.type]||[],el('in').value);
}
function drawDesign() {
  const assetList=active.assets.map(a=>[a.id,types[a.type]+' · '+a.id]);
  options(el('asset'),assetList,selected);configForm();
  options(el('from'),assetList.filter(([id])=>outs[current(id).type]),el('from').value);
  options(el('to'),assetList.filter(([id])=>ins[current(id).type]),el('to').value);terminals();
  el('links').replaceChildren(...active.links.map(l=>{const li=element('li',l.from+'.'+l.port+' → '+l.to+'.'+l.input+' ');li.append(buttons('Unplug '+l.from+'.'+l.port,()=>design(()=>command(active,'disconnect',{from:l.from,port:l.port}),'Connection removed.')));return li;}));
  el('asset-type').value=Object.keys(types).find(type=>!active.assets.some(a=>a.type===type))||'conveyor';
  el('new-id').value=el('asset-type').value;
  el('notebook').value=active.learning.notebook;
  const placement=el('placement');placement.replaceChildren();
  const belt=active.assets.find(a=>a.type==='conveyor'),bracket=active.assets.find(a=>a.type==='bracket');
  if(belt&&bracket){
    const label=element('label','Bracket position along conveyor (m)');
    const slider=element('input');slider.type='range';slider.min='0';slider.max=belt.length;slider.step='0.01';slider.value=bracket.x;
    const readout=element('output',bracket.x.toFixed(2)+' m');slider.addEventListener('input',()=>{readout.textContent=Number(slider.value).toFixed(2)+' m';});
    slider.addEventListener('change',guard(()=>design(()=>configure(active,bracket.id,{x:Number(slider.value)}),'Bracket position changed.')));
    label.append(slider,readout);placement.append(label);
  }
  drawCad();
}
function drawCad() {
  const actions=el('cad-actions'), info=el('cad-info');actions.replaceChildren();info.replaceChildren();
  const a=element('a','Open CAD import bench');a.href='./cad/index.html';
  a.addEventListener('click',()=>{persist();sessionStorage.removeItem('oia-workshop-cad-transfer-v1');sessionStorage.setItem('oia-workshop-cad-source-v1',JSON.stringify(active.extensions.cad||null));});
  const pr=element('a','Applied engineering bench');pr.href='./practice/index.html';
  pr.addEventListener('click',()=>{persist();const {pallets,postings,cartons,order,scans}=active.runtime;sessionStorage.setItem('oia-workshop-practice-transfer-v1',JSON.stringify({data:active.extensions.practice||{},records:{pallets,postings,cartons,order,scans}}));});
  const robot=element('a','Robot kinematics and pallet bench');robot.href='./robot/index.html';
  robot.addEventListener('click',()=>{persist();sessionStorage.setItem('oia-workshop-robot-transfer-v1',JSON.stringify(active.extensions.robot??null));});
  const site=element('a','Site assembly');site.href='./site/index.html';
  site.addEventListener('click',()=>{persist();sessionStorage.setItem('oia-workshop-layout-transfer-v1',JSON.stringify(active.extensions.layout??null));sessionStorage.setItem('oia-workshop-layout-context-v1',JSON.stringify(active.assets.map(({id,type})=>({id,type}))));});
  const production=element('a','Production analysis');production.href='./production/index.html';
  const electrical=element('a','Electrical wiring bench');electrical.href='./electrical/index.html';
  electrical.addEventListener('click',()=>{persist();sessionStorage.setItem('oia-workshop-electrical-transfer-v1',JSON.stringify(active.extensions.electrical??null));});
  const servers=element('a','Server commissioning');servers.href='./servers/index.html';
  servers.addEventListener('click',()=>{persist();sessionStorage.setItem('oia-workshop-servers-v1',JSON.stringify({data:active.extensions.servers??null}));});
  actions.append(a,site,electrical,pr,robot,production,servers);
  const cad=active.extensions.cad;
  if(cad) {
    info.append(element('p',String(cad.name)+' · measured width '+Number(cad.widthM).toFixed(3)+' m'));
    actions.append(buttons('Apply measured bracket width',()=>design(()=>{const bracket=active.assets.find(a=>a.type==='bracket');if(!bracket)throw Error('Place a mounting bracket first.');configure(active,bracket.id,{width:cad.widthM});selected=bracket.id;},'Bracket width set from the imported measurement.')));
  }
  const host=window.workshopHost;
  if(host?.pickStep)actions.append(buttons('Import STEP with FreeCAD',async()=>{
    const mesh=await host.pickStep(.25);
    if(!mesh)return;
    if(typeof mesh.sourceBase64!=='string'||!Array.isArray(mesh.dimensionsM)||!Array.isArray(mesh.triangles)||!Array.isArray(mesh.verticesM)||typeof mesh.kernel!=='string')throw Error('Incomplete CAD conversion result.');
    if(mesh.sourceBase64.length>1398104)throw Error('The portable CAD bench supports source files up to 1 MiB.');
    const cad={name:mesh.name,widthM:mesh.dimensionsM[0],dimensionsM:mesh.dimensionsM,upAxis:'Z',sourceUnit:'format',deviation:.00025,
      parts:[mesh.name],kernel:mesh.kernel,vertices:mesh.verticesM.length,triangles:mesh.triangles.length,sourceChunks:mesh.sourceBase64.match(/.{1,40960}/g)};
    const candidate={...active,extensions:{...active.extensions,cad}};
    validateDisplay(candidate);saveProject(candidate);
    active.extensions=candidate.extensions;drawCad();persist();
    tell(cad.name+' measured with '+cad.kernel+'. Use Apply measured bracket width to install.');
  }));
  if(host?.startPilot){const native=element('a','Windows simulation engines');native.href='./native/index.html';actions.append(native);}
  if(host?.engineStatus)actions.append(buttons('Detect Isaac Sim',async()=>{const result=await host.engineStatus();info.append(element('p',result.detail));}));
}
function download(name,text) {
  const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
  const link=element('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function variantNames() {
  const prefix=key('variant:');
  return Object.keys(localStorage).filter(k=>k.startsWith(prefix)).map(k=>k.slice(prefix.length)).sort();
}
function drawCabinet() {
  el('profile-name').value=profile;
  try { options(el('variants'),variantNames(),el('variants').value); } catch { options(el('variants'),[]); }
  const marks=active.learning.bookmarks.filter(n=>Number.isInteger(n)&&chapters[n-1]);
  const place=el('bookmarks');place.replaceChildren(element('span','Bookmarks: '));
  for(const n of marks)place.append(buttons(chapters[n-1].title,()=>{active.learning.chapter=n;drawGuide();persist();}));
  if(!marks.length)place.append('none');
}
function variant() {
  const raw=localStorage.getItem(key('variant:'+el('variants').value));
  if(!raw)throw Error('Save a named variant first.');
  return loadProject(raw);
}
options(el('asset-type'),Object.entries(types));
listen('asset-type','change',()=>{el('new-id').value=el('asset-type').value;});
listen('asset','change',configForm);listen('from','change',terminals);listen('to','change',terminals);
submit('place',()=>design(()=>{selected=addAsset(active,el('asset-type').value,el('new-id').value.trim()).id;},'Asset placed.'));
submit('config',()=>design(()=>{const a=current(selected), patch={};for(const [key,value] of new FormData(el('config'))){patch[key]=typeof a[key]==='boolean'?value==='true':typeof a[key]==='number'?Number(value):value;}configure(active,selected,patch);},'Asset settings applied.'));
submit('wire',()=>design(()=>connect(active,el('from').value,el('out').value,el('to').value,el('in').value),'Terminals connected.'));
listen('mode','change',()=>changeMode(el('mode').value));
listen('chapter','change',()=>{active.learning.chapter=Number(el('chapter').value);drawGuide();persist();});
listen('depth','change',()=>{active.learning.depth=el('depth').value;drawGuide();persist();});
listen('blank','click',()=>confirmReplace(()=>{mode='Start from Zero';replaceProject(fresh('blank'),'Blank cell opened.');}));
listen('reference','click',()=>confirmReplace(()=>{mode='Explore the Reference Plant';replaceProject(fresh('reference'),'Editable reference cell opened.');}));
listen('step','click',()=>{pause();runtime(()=>step(active));});
listen('second','click',()=>{pause();runtime(()=>step(active,10));});
listen('play','click',()=>{
  if(timer){pause();persist();return;}
  el('play').textContent='Pause clock';lastTime=performance.now();carry=0;
  timer=setInterval(()=>{try{const now=performance.now();carry+=Math.min(1000,now-lastTime)*Number(el('speed').value);lastTime=now;const ticks=Math.floor(carry/100);if(ticks){carry-=ticks*100;step(active,ticks);undos=[];refresh();if(active.runtime.scan%25<ticks)persist();}}catch(e){pause();tell(e.message);}},100);
});
listen('carton','click',()=>runtime(()=>addCarton(active),'Carton added at belt entry.'));
listen('checkpoint','click',()=>{checkpoint=saveProject(active);refresh();tell('Checkpoint captured at scan '+active.runtime.scan+'.');});
listen('restore','click',()=>{if(!checkpoint)return;pause();active=loadProject(checkpoint);mode=modes.includes(active.learning.mode)?active.learning.mode:mode;undos=[];refresh(true);persist();tell('Runtime checkpoint restored.');});
listen('undo','click',()=>{if(!undos.length)return;pause();const learning=active.learning,extensions=active.extensions;active=loadProject(undos.pop());active.learning=learning;active.extensions=extensions;refresh(true);persist();tell('Last design edit reversed.');});
submit('prediction',()=>runtime(()=>command(active,'predict',{seconds:Number(el('predict').value)}),'Prediction recorded for the next carton.'));
submit('order',()=>runtime(()=>command(active,'releaseOrder',{id:el('order-id').value.trim()}),'Order released.'));
listen('reset','click',()=>runtime(()=>command(active,'resetRobot'),'Robot reset requested.'));
listen('retry','click',()=>runtime(()=>command(active,'retryERP'),'Pending deliveries retried. Inspect postings and pallet status.'));
submit('witness',()=>runtime(()=>command(active,'evidence',{phase:el('phase').value,tester:el('tester').value,witness:el('observer').value,authority:el('authority').value}),'Test evidence recorded.'));
listen('assess','click',()=>{chapterMastery();drawGuide();drawAssessment();persist();tell(assess(active).filter(c=>c.pass).length+' of 9 checks passed.');});
listen('evidence','click',()=>{const r=active.runtime;download('packaging-commissioning.json',JSON.stringify({format:'oia-commissioning-evidence',version:1,engine:'built-in',seed:active.seed,scan:r.scan,scanSeconds:0.1,assets:active.assets,links:active.links,observations:inspect(active),assessment:assess(active),firstOut:r.firstOut,events:r.events,pallets:r.pallets,postings:r.postings,tests:r.evidence,handover:active.learning.notebook,project:JSON.parse(saveProject(active))},null,2));});
listen('save','click',()=>{storeCurrent();tell('Project saved for '+profile+'.');});
listen('export','click',async()=>{const raw=saveProject(active);if(window.workshopHost?.saveProject){if(await window.workshopHost.saveProject(raw))tell('Project saved to disk.');}else download('packaging-workshop.oia.json',raw);});
function importText(raw) {
  const loaded=loadProject(raw);confirmReplace(()=>replaceProject(loaded,'Portable project opened.'));
}
listen('import','click',async()=>{if(window.workshopHost?.openProject){const raw=await window.workshopHost.openProject();if(raw!==null)importText(raw);}else el('file').click();});
listen('file','change',async()=>{const file=el('file').files[0];el('file').value='';if(!file)return;if(file.size>2*1024*1024)throw Error('Project exceeds 2 MiB.');importText(await file.text());});
listen('profile','click',()=>{const name=el('profile-name').value.trim();if(!name)throw Error('Enter a profile name.');storeCurrent();const old=profile;profile=name;let p;try{const raw=localStorage.getItem(key('active'));p=raw?loadProject(raw):fresh('blank');}catch(e){profile=old;throw e;}localStorage.setItem('oia-workshop-profile-v1',name);replaceProject(p,'Profile opened: '+name+'.');});
listen('clone','click',()=>{const name=el('variant-name').value.trim();if(!name)throw Error('Name the variant first.');if(localStorage.getItem(key('variant:'+name)))throw Error('A variant with this name exists. Choose a new name.');localStorage.setItem(key('variant:'+name),saveProject(active));drawCabinet();el('variants').value=name;tell('Variant saved.');});
listen('open-variant','click',()=>{const p=variant();confirmReplace(()=>replaceProject(p,'Variant opened.'));});
listen('compare','click',()=>{const other=variant(), differences=[];for(const id of new Set([...active.assets,...other.assets].map(a=>a.id))){const a=current(id),b=other.assets.find(s=>s.id===id);if(!a||!b)differences.push(id+' is present only in '+(a?'current design':'saved variant'));else for(const k of Object.keys(a))if(a[k]!==b[k])differences.push(id+'.'+k+': '+b[k]+' → '+a[k]);}if(JSON.stringify(other.links)!==JSON.stringify(active.links))differences.push('terminal connections differ');el('comparison').textContent=(differences.join('. ')||'Identical asset settings and connections')+'. Counts: saved '+other.runtime.count+', current '+active.runtime.count+'.';});
listen('notebook','input',()=>{active.learning.notebook=el('notebook').value;persist();});
listen('bookmark','click',()=>{if(!active.learning.bookmarks.includes(active.learning.chapter))active.learning.bookmarks.push(active.learning.chapter);drawCabinet();persist();tell('Chapter bookmarked.');});
listen('rack-link','click',()=>{persist();const storage='oia-workshop-rack-transfer-v1';sessionStorage.setItem(storage,JSON.stringify(active.extensions.infrastructure??null));});
listen('case-link','click',()=>{persist();sessionStorage.setItem('oia-case-register-v1',JSON.stringify({register:active.extensions.commissioning||null,assets:active.assets.map(a=>a.id),checks:assess(active),scan:active.runtime.scan}));});
window.addEventListener('pagehide',()=>{pause();persist();});
function restoreBench() {
  for(const [name,slot] of [['rack','infrastructure'],['cad','cad'],['practice','practice'],['commissioning','commissioning'],['robot','robot'],['layout','layout'],['electrical','electrical'],['servers','servers']]){
    const key=name==='servers'?'oia-workshop-servers-v1':'oia-workshop-'+name+'-transfer-v1', value=sessionStorage.getItem(key);if(!value)continue;
    sessionStorage.removeItem(key);
    if(value.length>2*1024*1024)throw Error('Returned bench data exceeds project limit.');
    const data=JSON.parse(value), imported=['practice','servers'].includes(name)?data.data:name==='layout'?(data?.layout??data):data;
    if(name==='cad'&&(!Number.isFinite(data.widthM)||data.widthM<=0))throw Error('Returned CAD measurement is missing.');
    const candidate=loadProject(saveProject({...active,extensions:{...active.extensions,[slot]:imported}}));
    if(name==='practice' && data.install) {
      sessionStorage.removeItem(key);
      if(!candidate.assets.some(a=>a.type==='plc'))tell('Experiment retained. Place a PLC before installing the program.');
      else command(candidate,'installProgram',{source:data.install.source,language:data.install.language});
    }
    if(name==='layout' && data?.install) {
      const {bracket,conveyor,position,length}=data.install;
      if(current(bracket)?.type!=='bracket'||current(conveyor)?.type!=='conveyor')throw Error('Layout mount references a different cell.');
      configure(candidate,conveyor,{length});configure(candidate,bracket,{x:position});
    }
    saveProject(candidate);active=candidate;sessionStorage.removeItem(key);
  }
}
active=createProject('blank');
try {profile=localStorage.getItem('oia-workshop-profile-v1')||profile;const raw=localStorage.getItem(key('active'));if(raw)active=loadProject(raw);restoreBench();} catch(e){tell('Recovery: '+e.message);}
mode=modes.includes(active.learning.mode)?active.learning.mode:modes[0];
active.learning.chapter=Math.max(1,Math.min(chapters.length,active.learning.chapter));
refresh(true);

window.addEventListener('pageshow',guard(event=>{
  if(event.persisted){restoreBench();refresh(true);persist();}
}));