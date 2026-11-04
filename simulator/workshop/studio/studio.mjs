import {createProject,addAsset,configure,connect,addCarton,step,command,inspect,saveProject,loadProject,assess} from '../model.mjs';
import {icon,catalogue,ports,propNames,choices,benches} from './catalogue.mjs';
const $=id=>document.getElementById(id);
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
for(const slot of document.querySelectorAll('[data-icon]'))slot.replaceChildren(icon(slot.dataset.icon));
const profileKey='oia-workshop-profile-v1',returnKey='oia-studio-bench-return-v1';
let profile='Learner',project,selected='',viewport=null,undo=[],timer=0,lastTime=0,carry=0,viewMode='iso',lesson=null,shownConsole='measure';
let writable=true,dirty=false,knownSlot=null,alertGiven=false,storageWarning='';
const facilityLink=node('a','Live facility','facility-link');facilityLink.id='live-facility';facilityLink.href='./facility/index.html';document.querySelector('.mast-space').after(facilityLink);
facilityLink.onclick=e=>{try{prepBench('facility');}catch(error){e.preventDefault();notify(error.message,true);}};
const analysisCommand=node('button');analysisCommand.id='analysis';analysisCommand.append(icon('settings'),node('span','Analysis'));$('part-design').after(analysisCommand);
const quickRun=node('button',undefined,'primary quick-run');quickRun.id='quick-run';document.querySelector('.title-meta').append(quickRun);
const projectHelp=node('p',undefined,'project-help');$('project-title').after(projectHelp);
$('workspace').before($('lesson'));
function quickTransport(){quickRun.replaceChildren(icon(timer?'pause':'play'),node('span',timer?'Pause simulation':project?.start==='reference'?'Run demo':'Run simulation'));quickRun.disabled=!project?.assets.length;}
function validatedLesson(p){
 const s=p.learning.studioLesson;
 if(!s||!Array.isArray(s.runs)||s.runs.length>2||!s.runs.every(id=>typeof id==='string'&&p.runtime.cartons.some(c=>c.id===id)))return null;
 const minimum={first:0,running1:1,move:1,predict:1,running2:2,done:2};
 if(!Object.hasOwn(minimum,s.phase)||s.runs.length!==minimum[s.phase]||(s.runs.length===2&&!Number.isFinite(s.prediction)))return null;
 return s;
}
const localKey=(suffix='active')=>'oia-workshop-v1:'+encodeURIComponent(profile)+':'+suffix;
function notify(message,bad=false){$('notice').textContent=storageWarning||message;$('notice').classList.toggle('error',bad||Boolean(storageWarning));}
function guarded(fn){return async(...args)=>{try{await fn(...args);}catch(e){if($('dialog').open)$('dialog-error').textContent=e.message;else notify(e.message,true);}};}
const on=(id,fn)=>$(id).addEventListener('click',guarded(fn));
const selectedAsset=()=>project.assets.find(a=>a.id===selected);
const findType=t=>project.assets.find(a=>a.type===t);
const name=a=>a?catalogue[a.type][0]:'No asset';
function reference(){const p=createProject('reference');command(p,'releaseOrder',{id:'ORDER-001'});addCarton(p,'INTAKE-001');return p;}
function persist(force=false){
 if(!writable||(!dirty&&!force))return;
 try{
   const current=localStorage.getItem(localKey());
   if(current!==knownSlot){pause(false);writable=false;storageWarning='This project changed in another window. Save a file copy before reloading.';notify(storageWarning,true);return;}
   const raw=saveProject(project);localStorage.setItem(localKey(),raw);knownSlot=raw;dirty=false;
 }catch(e){if(!alertGiven){notify('Local recovery unavailable. Use Save project to keep a file copy.',true);alertGiven=true;}}
}
function restoreActive(){
 storageWarning='';try{
  profile=localStorage.getItem(profileKey)||'Learner';const raw=localStorage.getItem(localKey());
  knownSlot=raw;project=raw?loadProject(raw):reference();writable=true;dirty=!raw;alertGiven=false;
 }catch(e){project=reference();writable=false;notify('Saved project could not be opened. A reference preview is available; the saved copy is preserved.',true);}
 selected=project.assets.find(a=>a.type==='conveyor')?.id||project.assets[0]?.id||'';
 lesson=validatedLesson(project);
 $('profile-label').textContent=profile;
}
function pause(save=true){
 if(timer){clearInterval(timer);timer=0;}carry=0;
 $('play-label').textContent='Run cell';$('play').setAttribute('aria-label','Run cell');$('play').firstElementChild.replaceChildren(icon('play'));
 quickTransport();if(save&&project)persist();
}
function mark(){dirty=true;}
function freshView(p){
 pause();project=p;writable=true;undo=[];selected=findType('conveyor')?.id||p.assets[0]?.id||'';
 lesson=validatedLesson(p);mark();persist();drawAll();viewport?.view('fit');
}
function setPanel(which){$('workspace').dataset.panel=which;document.querySelectorAll('[data-panel]').forEach(b=>{if(b.tagName==='BUTTON')b.setAttribute('aria-pressed',String(b.dataset.panel===which));});}
function select(id,panel=false){
 if(!project.assets.some(a=>a.id===id))return;
 selected=id;drawTree();drawProperties();updateScene();
 if(panel&&matchMedia('(max-width:760px)').matches)setPanel('inspect');
}
function edit(fn,msg){
 pause();const previous=saveProject(project);fn();undo.push(previous);if(undo.length>16)undo.shift();
 mark();persist();drawAll();if(msg)notify(msg);
}
function runAction(fn,msg){fn();undo=[];mark();drawRuntime();if(!timer)persist();if(msg)notify(msg);}
function btn(label,fn,cls,id){const b=node('button',label,cls);if(id)b.id=id;b.type='button';b.onclick=guarded(fn);return b;}
function modal(title,kicker='Workspace'){
 pause();$('dialog-kicker').textContent=kicker;$('dialog-title').textContent=title;$('dialog-error').textContent='';$('dialog-body').replaceChildren();if(!$('dialog').open)$('dialog').showModal();
 return $('dialog-body');
}
function close(){$('dialog').close();}
function dialogField(parent,title,input){input.setAttribute('aria-label',title);const l=node('label',title,'dialog-field');l.append(input);parent.append(l);return input;}
function selectBox(pairs){const e=node('select');for(const [v,k] of pairs)e.append(new Option(k,v));return e;}
function choice(body,title,detail,ico,fn,id){const b=btn('',fn,'choice',id),copy=node('span');copy.append(node('strong',title),node('small',detail));b.append(icon(ico),copy);body.append(b);return b;}
function dialogHelp(body,t){body.append(node('p',t,'helper'));}
function drawTree(){
 const tree=$('asset-tree'),filter=$('search').value.trim().toLowerCase();tree.replaceChildren();
 for(const group of ['Mechanical','Control','Network & IT']){
  const items=project.assets.filter(a=>catalogue[a.type][1]===group&&(name(a)+' '+a.id).toLowerCase().includes(filter));if(!items.length)continue;
  tree.append(node('div',group,'group-label'));
  for(const a of items){const b=btn('',()=>select(a.id,true),'asset-row');b.dataset.asset=a.id;b.setAttribute('aria-pressed',String(a.id===selected));b.title=name(a)+' · '+a.id;b.append(icon(a.type),node('span',name(a)));tree.append(b);}
 }
 if(!tree.childElementCount)tree.append(node('p',filter?'No matching assets.':'No assets placed.','group-label'));
 $('asset-total').textContent=project.assets.length;
}
function drawProperties(){
 const area=$('properties'),a=selectedAsset();area.replaceChildren();
 if(!a){area.append(node('p','Select an asset in the view or assembly browser to inspect its parameters.','helper'));return;}
 area.append(node('div',a.id+' / '+catalogue[a.type][1],'asset-id'),node('h3',name(a),'prop-heading'),node('p',catalogue[a.type][2],'prop-desc'));
 const form=node('form',undefined,'prop-section');form.append(node('div','Properties','group-label'));
 for(const [k,v] of Object.entries(a)){
  if(['id','type'].includes(k))continue;
  const l=node('label',propNames[k]||(/^vlan\d+$/.test(k)?'Port '+k.slice(4)+' VLAN':k),'prop-field'),input=choices[k]?selectBox(choices[k].map(v=>[v,v])):node('input');
  input.name=k;input.id='prop-'+k;if(input.tagName==='INPUT'){input.type=typeof v==='boolean'?'checkbox':typeof v==='number'?'number':'text';if(input.type==='number')input.step='any';}
  if(typeof v==='boolean')input.checked=v;else input.value=v;l.append(input);form.append(l);
 }
 const apply=node('button','Apply changes','apply');apply.type='submit';apply.id='apply-properties';form.append(apply);
 form.onsubmit=guarded(e=>{e.preventDefault();const patch={};for(const input of form.elements){if(!input.name)continue;const v=input.type==='checkbox'?input.checked:input.type==='number'?input.valueAsNumber:input.value;if(a[input.name]!==v)patch[input.name]=v;}
  if(!Object.keys(patch).length){notify('No property changes to apply.');return;}edit(()=>configure(project,a.id,patch),name(a)+' updated.');});
 area.append(form);const cable=node('div',undefined,'prop-section');cable.append(node('div','Connections','group-label'));const ul=node('ul',undefined,'port-list');
 for(const l of project.links.filter(x=>x.from===a.id||x.to===a.id))ul.append(node('li',l.from+'.'+l.port+' → '+l.to+'.'+l.input));
 if(!ul.childElementCount)ul.append(node('li','No terminal connections.'));cable.append(ul);area.append(cable);
}
function updateScene(){viewport?.update(project,selected);$('selection-note').textContent=selectedAsset()?name(selectedAsset())+' selected':'Nothing selected';$('empty-hint').hidden=project.assets.length>0;}
function seconds(n){return (n*0.1).toFixed(1);}
function clock(scan){const secs=Math.floor(scan/10);return String(Math.floor(secs/60)).padStart(2,'0')+':'+String(secs%60).padStart(2,'0')+'.'+scan%10;}
function drawRuntime(){
 const r=project.runtime,obs=inspect(project);$('clock').textContent=clock(r.scan);$('undo').disabled=!undo.length;
 $('step').disabled=!project.assets.length;$('play').disabled=!project.assets.length;$('add-carton').disabled=!findType('conveyor');
 const meters=[['Belt speed',findType('conveyor')?.speed??'—','m/s'],['PLC count',findType('plc')?r.count:'—','cartons'],['Photoeye input',findType('plc')?(r.inputs.I0?'HIGH':'LOW'):'—','I0'],['Pallets placed',r.pallets.length,'pallets'],['Camera path',obs.network.video?'Online':findType('camera')?'Offline':'—','video']];
 $('measures').replaceChildren(...meters.map(([l,v,u])=>{const d=node('div',undefined,'meter');d.append(node('span',l),node('b',String(v)),node('small',u));return d;}));
 if(shownConsole==='events'){
  const ul=node('ol',undefined,'event-log');ul.tabIndex=0;for(const e of r.events.slice(-12).reverse()){const li=node('li');li.append(node('span',seconds(e.scan)+' s'),node('span',e.asset),node('span',e.message));ul.append(li);}if(!ul.childElementCount)ul.append(node('li','No events yet.'));$('events').replaceChildren(ul);
 }
 updateScene();
}
function drawAll(){
 quickTransport();projectHelp.textContent=lesson?'Follow the timing practical and compare measured sensor crossings.':project.assets.length?'Inspect an asset, change its properties or run the cell to follow a carton.':'Start with a conveyor, then place the sensor and wire its input.';const guided=Boolean(lesson);$('project-title').textContent=guided?'Photoeye timing':project.start==='reference'?'Packaging cell':'Free build cell';$('project-kind').textContent=guided?'Guided practical':project.start==='reference'?'Reference design':'Free build';
 $('meta').textContent=project.assets.length+' assets · '+project.links.length+' connections';drawTree();drawProperties();drawRuntime();drawLesson();
 try{$('restore').disabled=!localStorage.getItem(localKey('studio:checkpoint'));}catch{$('restore').disabled=true;}
}
function launch(){
 if(timer){pause();notify('Clock paused at '+clock(project.runtime.scan)+'.');return;}
 if(!project.assets.length)throw Error('Place a conveyor before starting the clock.');
 if(findType('conveyor')&&!project.runtime.cartons.some(c=>['moving','waiting'].includes(c.status))){addCarton(project,'INTAKE-001');mark();}
 undo=[];carry=0;lastTime=performance.now();$('play-label').textContent='Pause cell';$('play').setAttribute('aria-label','Pause cell');$('play').firstElementChild.replaceChildren(icon('pause'));
 timer=setInterval(()=>{try{const now=performance.now();carry+=Math.min((now-lastTime)/1000,0.5)*Number($('rate').value);lastTime=now;const n=Math.floor(carry/0.1);if(!n)return;carry-=n*0.1;step(project,n);mark();checkLesson();drawRuntime();if(project.runtime.scan%20<n)persist();}catch(e){pause(false);notify(e.message,true);}},40);
 quickTransport();notify('Clock running. Watch the carton cross the photoeye.');
}
function placeDialog(preferred){
 const body=modal('Place an asset','Cell design'),available=Object.keys(catalogue).filter(t=>!findType(t));
 if(!available.length){dialogHelp(body,'This cell already contains every supported asset type. Choose New project to build a different design.');return;}
 dialogHelp(body,'Choose a function, then give the asset a unique identifier. The pilot supports one device per function.');
 const type=dialogField(body,'Asset type',selectBox(available.map(t=>[t,catalogue[t][0]])));if(available.includes(preferred))type.value=preferred;
 const id=dialogField(body,'Asset identifier',node('input'));id.value=catalogue[type.value][3];id.maxLength=64;type.onchange=()=>id.value=catalogue[type.value][3];
 body.append(btn('Place asset',()=>{const key=id.value.trim();edit(()=>addAsset(project,type.value,key));select(key);setPanel('scene');close();notify(name(selectedAsset())+' placed in the assembly.');},'primary','confirm-place'));
}
function wireDialog(){
 const body=modal('Connect terminals','Cell design');const src=project.assets.filter(a=>ports[a.type][0].length),dst=project.assets.filter(a=>ports[a.type][1].length);
 if(!src.length||!dst.length){dialogHelp(body,'Place a source and a compatible destination first, such as a conveyor and mounting bracket.');body.append(btn('Place asset',()=>placeDialog(),'primary'));return;}
 const pairs=(list)=>list.map(a=>[a.id,name(a)+' · '+a.id]);
 const from=dialogField(body,'Source asset',selectBox(pairs(src))),port=dialogField(body,'Source terminal',selectBox([])),to=dialogField(body,'Destination asset',selectBox(pairs(dst))),input=dialogField(body,'Destination terminal',selectBox([]));
 function fill(sel,term,side){const a=project.assets.find(a=>a.id===sel.value);term.replaceChildren(...ports[a.type][side].map(p=>new Option(p,p)));}
 from.onchange=()=>fill(from,port,0);to.onchange=()=>fill(to,input,1);if(src.some(a=>a.id===selected))from.value=selected;from.onchange();to.onchange();
 dialogHelp(body,'Connecting to an occupied terminal replaces its connection. Incompatible terminal types are rejected.');
 body.append(btn('Connect terminals',()=>{edit(()=>connect(project,from.value,port.value,to.value,input.value),'Connected '+from.value+'.'+port.value+' to '+to.value+'.'+input.value+'.');close();},'primary','confirm-wire'));
}
function newDialog(){
 const b=modal('New project','Project');dialogHelp(b,'Starting a new design keeps the current project as a local checkpoint.');
 const replace=(type)=>{checkpoint();freshView(type==='blank'?createProject('blank'):reference());close();setPanel('scene');notify(type==='blank'?'Empty site ready. Place your first conveyor.':'Reference cell ready. Run the clock to follow the carton.');};
 choice(b,'Blank workshop','Start with an empty site and choose each asset.','new',()=>replace('blank'),'start-blank');
 choice(b,'Reference packaging cell','Open the complete wired cell with one carton staged.','cube',()=>replace('reference'),'start-reference');
}
function checkpoint(){localStorage.setItem(localKey('studio:checkpoint'),saveProject(project));$('restore').disabled=false;}
async function savedFile(){
 const raw=saveProject(project);
 if(window.workshopHost?.saveProject){if(await window.workshopHost.saveProject(raw))notify('Project saved to disk.');}
 else{const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),link=node('a');link.href=url;link.download='packaging-cell.oia.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Portable project downloaded.');}
 persist();
}
function openRaw(raw){const p=loadProject(raw);checkpoint();freshView(p);notify('Project opened. Previous design retained as a checkpoint.');}
function prepBench(id){
 pause();persist();if(!writable)throw Error('Save your file and reload the current profile before changing workspaces.');
 sessionStorage.removeItem(returnKey);
 if(['facility','part','analysis','factory','classic'].includes(id))return;
 sessionStorage.setItem(returnKey,'1');
 const ext=project.extensions,r=project.runtime;
 if(id==='cad'){sessionStorage.removeItem('oia-workshop-cad-transfer-v1');sessionStorage.setItem('oia-workshop-cad-source-v1',JSON.stringify(ext.cad||null));}
 else if(id==='commissioning'){sessionStorage.setItem('oia-case-register-v1',JSON.stringify({register:ext.commissioning??null,assets:project.assets.map(a=>a.id),checks:assess(project),scan:r.scan}));}
 else if(id==='servers'){sessionStorage.setItem('oia-workshop-servers-v1',JSON.stringify({data:ext.servers??null}));}
 else if(id==='practice'){const {pallets,postings,cartons,order,scans}=r;sessionStorage.setItem('oia-workshop-practice-transfer-v1',JSON.stringify({data:ext.practice||{},records:{pallets,postings,cartons,order,scans}}));}
 else if(id!=='production'){
  const field=id==='rack'?'infrastructure':id;sessionStorage.setItem('oia-workshop-'+id+'-transfer-v1',JSON.stringify(ext[field]??null));
  if(id==='layout')sessionStorage.setItem('oia-workshop-layout-context-v1',JSON.stringify(project.assets.map(({id,type})=>({id,type}))));
 }
}
function goBench(id){const b=benches.find(b=>b[0]===id);if(!b)return;prepBench(id);location.assign(b[3]);}
function toolsDialog(){
 const b=modal('Engineering workspaces','Workspace directory');
 for(const [id,title,detail,url]of benches){const a=node('a',undefined,'tool-link');a.href=url;a.append(icon(id==='part'?'part':'tool'));const x=node('span');x.append(node('strong',title),node('small',detail));a.append(x);a.onclick=e=>{try{prepBench(id);}catch(err){e.preventDefault();$('dialog-error').textContent=err.message;}};b.append(a);}
}
function profileDialog(){
 const b=modal('Learner profile','Local workspace');dialogHelp(b,'Each profile keeps its active project, lesson and checkpoint on this device.');
 const inp=dialogField(b,'Profile name',node('input'));inp.maxLength=60;inp.value=profile;
 b.append(btn('Open profile',()=>{const next=inp.value.trim();if(!next)throw Error('Enter a profile name.');persist();localStorage.setItem(profileKey,next);restoreActive();undo=[];close();drawAll();notify('Opened '+profile+'.');},'primary'));
}
function startLesson(){
 pause();if(lesson){$('lesson').hidden=false;drawLesson();$('lesson').scrollIntoView({block:'nearest'});return;}
 localStorage.setItem(localKey('studio:lesson-return'),saveProject(project));
 const p=createProject('reference');p.learning.mode='Guided Learning';p.learning.chapter=1;
 p.learning.studioLesson={phase:'first',runs:[],prediction:null};
 freshView(p);select(findType('bracket').id);notify('First lesson opened. Run the baseline carton.');$('lesson').scrollIntoView({block:'nearest'});
}
function lessonRun(second){
 pause();const c=addCarton(project,'LAB-INTAKE');lesson.runs.push(c.id);lesson.phase=second?'running2':'running1';mark();$('rate').value='4';launch();drawLesson();
}
function checkLesson(){
 if(!lesson||!['running1','running2'].includes(lesson.phase))return;
 const id=lesson.runs.at(-1),c=project.runtime.cartons.find(c=>c.id===id);
 if(c?.detected!==null&&c?.detected!==undefined){pause(false);lesson.phase=lesson.phase==='running1'?'move':'done';mark();persist();drawLesson();notify('Photoeye detected '+id+' at '+seconds(c.detected-c.startScan)+' s travel time.');}
 else if(c?.status==='missed'){pause(false);lesson.phase=lesson.phase==='running1'?'first':'predict';lesson.runs.pop();drawLesson();notify('The carton left the belt. Recheck the sensor mount and beam position before retrying.',true);}
}
function drawLesson(){
 const panel=$('lesson');panel.hidden=!lesson;if(!lesson)return;
 const acts=$('lesson-actions');acts.replaceChildren();const belt=findType('conveyor'),br=findType('bracket'),eye=findType('sensor');
 const heading=$('lesson-heading'),text=$('lesson-text');
 if(!belt||!br||!eye){heading.textContent='Reconnect the lesson cell';text.textContent='This project needs a conveyor, bracket and photoeye. Open a reference design to begin again.';return;}
 const c1=project.runtime.cartons.find(c=>c.id===lesson.runs[0]),c2=project.runtime.cartons.find(c=>c.id===lesson.runs[1]);
 const first=c1?.detected!=null?(c1.detected-c1.startScan)*0.1:null,second=c2?.detected!=null?(c2.detected-c2.startScan)*0.1:null;
 if(lesson.phase==='first'){heading.textContent='1. Measure the first crossing';text.textContent='The bracket is '+br.x.toFixed(2)+' m from entry. At '+belt.speed.toFixed(2)+' m/s, how long will the carton take to reach the beam? Run it and watch the photoeye.';acts.append(btn('Run baseline carton',()=>lessonRun(false),'primary','lesson-run-first'));}
 if(lesson.phase==='running1'||lesson.phase==='running2'){heading.textContent='Tracking '+lesson.runs.at(-1);text.textContent='The clock stops when this carton crosses the beam. The timestamp comes from the sampled sensor event.';acts.append(btn(timer?'Pause run':'Resume run',()=>{launch();drawLesson();},'outline'));}
 if(lesson.phase==='move'){heading.textContent='2. Move the mounting bracket';text.textContent='Measured baseline: '+first?.toFixed(1)+' s. Move the bracket 0.50 m downstream. Keep the belt speed constant.';acts.append(btn('Move bracket +0.50 m',()=>{if(br.x+0.5+eye.x>belt.length)throw Error('Increase the belt length before moving the bracket.');edit(()=>configure(project,br.id,{x:+(br.x+0.5).toFixed(3)}));lesson.phase='predict';mark();persist();select(br.id);drawLesson();},'primary','lesson-move'));}
 if(lesson.phase==='predict'){heading.textContent='3. Predict the new crossing';text.textContent='The beam is now '+(br.x+eye.x).toFixed(2)+' m from entry. Divide distance by belt speed. Enter a prediction in seconds and test the second carton.';
  const l=node('label','Prediction (s) ','predict-field'),n=node('input');n.type='number';n.step='0.1';n.min='0';n.max='3600';n.id='lesson-prediction';l.append(n);acts.append(l,btn('Test prediction',()=>{if(!n.value||!Number.isFinite(n.valueAsNumber)||n.valueAsNumber<0)throw Error('Enter your predicted time in seconds.');lesson.prediction=n.valueAsNumber;command(project,'predict',{seconds:lesson.prediction});lessonRun(true);},'primary','lesson-run-second'));}
 if(lesson.phase==='done'){
 const pass=first!==null&&second!==null&&Math.abs(second-lesson.prediction)<=0.100001;
 heading.textContent=pass?'Prediction verified':'Compare prediction and measurement';text.textContent='Baseline '+first?.toFixed(1)+' s · moved sensor '+second?.toFixed(1)+' s · change '+(second-first).toFixed(1)+' s. Your prediction was '+lesson.prediction+' s. Scan tolerance is 0.1 s.';
 acts.append(btn('Return to my project',()=>{const raw=localStorage.getItem(localKey('studio:lesson-return'));if(!raw)throw Error('No prior project is stored on this device. Use New project to start a design.');
 const p=loadProject(raw);p.learning.studioTimingEvidence={baseline:first,second,prediction:lesson.prediction,pass};freshView(p);notify('Original project restored with the measured lesson result.');},'outline'));
 }
}
on('new-project',newDialog);on('open-project',async()=>{pause();if(window.workshopHost?.openProject){const raw=await window.workshopHost.openProject();if(raw!==null)openRaw(raw);}else $('import-file').click();});
$('import-file').onchange=guarded(async()=>{const f=$('import-file').files[0];$('import-file').value='';if(f){if(f.size>2*1024*1024)throw Error('Maximum project size is 2 MiB.');openRaw(await f.text());}});
on('save-project',savedFile);on('place',()=>placeDialog());on('tree-place',()=>placeDialog());on('empty-place',()=>placeDialog('conveyor'));on('wire',wireDialog);on('empty-demo',()=>{checkpoint();freshView(reference());setPanel('scene');launch();notify('Reference demo running. Restore checkpoint to return to your empty project.');});
on('part-design',()=>goBench('part'));on('benches',toolsDialog);on('profile-btn',profileDialog);on('start-lesson',startLesson);
on('quick-run',launch);on('analysis',()=>goBench('analysis'));on('play',launch);on('step',()=>{pause();runAction(()=>step(project,1));checkLesson();});
on('add-carton',()=>runAction(()=>addCarton(project,'INTAKE-001'),'Carton placed at the belt entry.'));
on('checkpoint',()=>{checkpoint();notify('Runtime checkpoint saved at '+clock(project.runtime.scan)+'.');});
on('restore',()=>{const raw=localStorage.getItem(localKey('studio:checkpoint'));if(!raw)throw Error('Save a checkpoint first.');freshView(loadProject(raw));notify('Runtime checkpoint restored.');});
on('undo',()=>{const previous=undo.at(-1);if(!previous)return;pause();project=loadProject(previous);undo.pop();lesson=validatedLesson(project);if(!selectedAsset())selected=project.assets[0]?.id||'';mark();persist();drawAll();notify('Design edit reversed.');});
on('dialog-close',close);on('hide-lesson',()=>{$('lesson').hidden=true;});
on('measure-tab',()=>{shownConsole='measure';switchConsole();});on('events-tab',()=>{shownConsole='events';switchConsole();});
function switchConsole(){$('measures').hidden=shownConsole!=='measure';$('events').hidden=shownConsole!=='events';$('measure-tab').setAttribute('aria-pressed',String(shownConsole==='measure'));$('events-tab').setAttribute('aria-pressed',String(shownConsole==='events'));drawRuntime();}
for(const id of ['iso','top','front','fit'])on(id,()=>{viewport?.view(id);if(id!=='fit')viewMode=id;for(const v of ['iso','top','front'])$(v).setAttribute('aria-pressed',String(v===viewMode));});
for(const b of document.querySelectorAll('.mobile-tabs button'))b.onclick=()=>setPanel(b.dataset.panel);
$('search').oninput=drawTree;$('classic-link').onclick=()=>prepBench('classic');
window.addEventListener('keydown',e=>{if($('dialog').open||e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,select,textarea,button,a'))return;if(e.code==='Space'){e.preventDefault();guarded(launch)();}else if(e.key==='.'){$('step').click();}});
window.addEventListener('pagehide',()=>{pause(false);persist();});
window.addEventListener('pageshow',e=>{if(e.persisted){restoreActive();undo=[];drawAll();}});
restoreActive();
{
 const {createViewport}=await import('./viewport.mjs');
 viewport=await createViewport($('viewport'),{onSelect:id=>select(id),onMove:(id,patch)=>{try{edit(()=>configure(project,id,patch),'Geometry updated.');select(id);}catch(e){notify(e.message,true);}}});
}
drawAll();persist();document.body.inert=false;document.body.dataset.ready='true';
