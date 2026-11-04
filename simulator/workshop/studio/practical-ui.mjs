import {command,configure,connect,step} from '../model.mjs';
import {practicals,caseSettings,makePractical,diagnose,prove,transferCase,recordPractical} from './practicals.mjs';
const element=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
function select(id,items,value){
 const s=element('select');s.id=id;for(const [key,label]of items)s.append(new Option(label,key));if(value!=null)s.value=value;return s;
}
function labelled(label,control){const l=element('label',label,'practical-field');l.append(control);return l;}
const flag=v=>v?'yes':'no';
function reading(e){
 if(!e)return '';
 if(e.first)return 'Two fresh cartons: '+[e.first,e.second].map(x=>x.carton+' ('+x.programHigh+' high scans, count +'+x.increment+')').join(' · ')+'.';
 if(e.actual)return 'Actual path: '+e.actual.reason+'. Independent test with viewing permission withdrawn: '+e.denied.reason+'; IP reachable '+flag(e.denied.reachable)+'.';
 if('increment'in e)return e.carton+': I0 high '+e.I0+' scans, I1 high '+e.I1+' scans, program input high '+e.programHigh+' scans. Counter change +'+e.increment+'.';
 if('power'in e)return 'Power '+flag(e.power)+' · Ethernet link '+flag(e.link)+' · IP reachable '+flag(e.reachable)+' · Video '+flag(e.video)+'. '+e.reason+'.';
 return 'Carton '+(e.carton||'none')+' · lot '+(e.lot||'none')+' · first-out: '+(e.firstOut||e.repaired||'none')+' · pallet '+(e.pallet||'none')+' · ERP '+(e.status||'awaiting pick')+' · '+e.postings+' posting(s), '+e.units+' inventory unit(s), '+e.attempts+' delivery attempt(s).';
}
function scanEvidence(e){
 const rows=e?.rows||e?.first?.rows;if(!rows?.length)return null;
 const details=element('details'),summary=element('summary','Inspect the PLC scan record'),table=element('table'),head=element('tr');
 for(const x of ['Scan','I0','I1','Program input','Count'])head.append(element('th',x));table.append(head);
 for(const r of rows){const row=element('tr');for(const v of [r.scan,+r.I0,+r.I1,+r.input,r.count])row.append(element('td',String(v)));table.append(row);}
 details.append(summary,table);return details;
}
export function installPracticals({active,replace,save,load,pause,sync,inspectAsset,notify,guard,key}){
 const area=element('section',undefined,'practical-ladder');area.id='engineering-practicals';area.setAttribute('aria-label','Hands-on engineering practicals');
 document.getElementById('workspace').before(area);
 const temporaryOriginals=new Map();
 let choice='wiring',showHint=false,prediction='';
 const button=(id,title,fn,cls='outline')=>{const b=element('button',title,cls);b.type='button';b.id=id;b.onclick=guard(fn);return b;};
 const track=()=>active().learning.studioPractical;
 function sourceKey(token){return key('studio:practical-return:'+token);}
 function begin(id){
  if(!Object.hasOwn(practicals,id))return;
  const old=track();
  if(old?.id===id){draw();area.scrollIntoView({block:'nearest'});return;}
  pause();const token=old?.token||crypto.randomUUID();
  if(!old){
   const original=save(active());
   try{localStorage.setItem(sourceKey(token),original);}catch{temporaryOriginals.set(token,original);}
  }
  showHint=false;prediction='';choice=id;replace(makePractical(id,1,token));
  const url=new URL(location.href);url.searchParams.set('practical',id);history.replaceState(history.state,'',url);
  notify('Fault case opened. Predict the measurement before testing.');area.scrollIntoView({block:'nearest'});
 }
 function returnProject(){
  const t=track();let raw=temporaryOriginals.get(t?.token);
  if(!raw&&typeof t?.token==='string'){try{raw=localStorage.getItem(sourceKey(t.token));}catch{}}
  if(!raw)throw Error('The original project is on the device where this practical began. Save this case to retain it, then open your project.');
  const previous=load(raw);
  if(t.edition===2&&t.proof?.pass){
   previous.learning.practicalResults??={};previous.learning.practicalResults[t.id]=recordPractical(active());
  }
  const url=new URL(location.href);url.searchParams.delete('practical');history.replaceState(history.state,'',url);
  replace(previous);
  try{
   if(localStorage.getItem(key('active'))===save(previous)){localStorage.removeItem(sourceKey(t.token));temporaryOriginals.delete(t.token);}
  }catch{}
  showHint=false;prediction='';notify('Original project restored'+(t.edition===2&&t.proof?.pass?' with the two-case assessment record.':'.'));
 }
 function commit(fn,reason){
  pause();const result=fn();sync();draw();if(reason)notify(reason);return result;
 }
 function renderEvidence(t){
  const last=t.last,r=element('div',undefined,'practical-result');r.id='practical-result';r.setAttribute('role','status');
  r.dataset.pass=String(Boolean(last?.pass));r.dataset.kind=last?.kind||'';
  if(!last){r.textContent='Evidence appears after running the fault measurement.';return r;}
  r.append(element('strong',last.kind+' · '+(last.pass?'Passed':'Not yet passed')),element('p',reading(last.evidence)));
  if(!last.pass)r.append(element('p',last.kind==='Fault measurement'?'Compare your prediction with the measured record, then repeat. If the original fault was already altered, restart this case.':'The current design has not met the acceptance conditions. Inspect its live configuration and retest.'));
  const scans=scanEvidence(last.evidence);if(scans)r.append(scans);return r;
 }
 function draw(){
  area.replaceChildren();const p=active(),t=track();
  if(p.learning.studioLesson&&!t){area.hidden=true;return;}area.hidden=false;
  if(!t||!Object.hasOwn(practicals,t.id)){
   const row=element('div',undefined,'practical-entry');const copy=element('div');copy.append(element('strong','Engineering practicals'),element('p','Diagnose a live fault, repair the cell and prove your fix on a different case.'));
   const s=select('practical-track',Object.entries(practicals).map(([id,x])=>[id,x.title]),choice);s.onchange=()=>choice=s.value;
   row.append(copy,labelled('Choose a task',s),button('practical-start','Start practical',()=>begin(s.value),'primary'));
   const recorded=Object.keys(p.learning.practicalResults||{}).filter(id=>Object.hasOwn(practicals,id)).length;
   if(recorded)copy.append(element('small',recorded+' of 4 transfer assessments recorded.'));area.append(row);return;
  }
  const spec=practicals[t.id],head=element('div',undefined,'practical-head'),names=element('div');names.append(element('small',t.edition===1?'Guided fault diagnosis':'Independent transfer case'),element('h2',spec.title));
  head.append(names,button('practical-return',t.edition===2&&t.proof?.pass?'Record result and return':'Return to my project',returnProject));area.append(head,element('p',spec.brief),element('p',caseSettings(p),'practical-context'));
  const actions=element('div',undefined,'practical-actions');area.append(actions);const fields=x=>x.map(v=>[v,v]);
  if(!t.observed){
   const s=select('practical-prediction',[['','Choose a prediction'],...fields(spec.options)],prediction);s.onchange=()=>prediction=s.value;
   actions.append(labelled(spec.prediction,s),button('practical-diagnose','Measure fault',()=>commit(()=>diagnose(p,s.value)),'primary'));
  }else{
   let hint='';const cfg=(id,patch)=>commit(()=>configure(p,id,patch),'Applied to the live cell.');
   if(t.id==='wiring'){
    hint='Repair the mapping. Connect the sensor output to your chosen PLC terminal, or change which terminal the controller reads.';
    const w=p.links.find(l=>l.from==='eye'&&l.to==='plc'),s=select('practical-wire-input',fields(['I0','I1']),w?.input);
    actions.append(labelled('Photoeye output → PLC terminal',s),button('practical-rewire','Connect sensor output',()=>commit(()=>connect(p,'eye','out','plc',s.value),'Photoeye lead connected to '+s.value+'.')),button('practical-inspect','Inspect PLC',()=>inspectAsset('plc')));
   }else if(t.id==='counting'){
    hint='Choose the counter instruction. Two new crossings must each add one count while the input remains high for the recorded scan width.';
    const plc=p.assets.find(a=>a.id==='plc'),s=select('practical-mode',[['level','Count every high scan'],['rising','Count low-to-high transition'],['falling','Count high-to-low transition']],plc.mode);
    actions.append(labelled('Executable PLC instruction',s),button('practical-program','Apply instruction',()=>cfg('plc',{mode:s.value})),button('practical-inspect','Inspect PLC',()=>inspectAsset('plc')));
   }else if(t.id==='camera'){
    hint='Start from the link and reachability readings. Set the two switch ports or viewing permission to match the intended local path.';
    const sw=p.assets.find(a=>a.id==='switch'),camera=p.assets.find(a=>a.id==='camera'),x=element('input'),y=element('input');for(const [n,id,v]of [[x,'practical-p1',sw.vlan1],[y,'practical-p2',sw.vlan2]]){n.type='number';n.min=1;n.max=4094;n.value=v;n.id=id;}
    const perm=select('practical-permission',[['true','Allowed'],['false','Denied']],String(camera.permitted));
    actions.append(labelled('Camera port VLAN',x),labelled('Viewer port VLAN',y),button('practical-vlan','Apply VLANs',()=>cfg('switch',{vlan1:x.valueAsNumber,vlan2:y.valueAsNumber})),labelled('Viewing identity',perm),button('practical-grant','Apply permission',()=>cfg('camera',{permitted:perm.value==='true'})));
   }else{
    hint=t.edition===1?'Restore the physical cause, reset and step the pick. Check the ERP posting and pending acknowledgement before repairing delivery.':'ERP starts offline. Restore its service and retry once with the acknowledgement fault present. Inspect the committed posting before repairing acknowledgement delivery.';
    for(const [id,title,asset,prop,yes,no]of [['vacuum','Vacuum circuit','robot','vacuum','Available','Failed'],['online','ERP service','erp','online','Online','Offline'],['dropAck','Acknowledgement path','erp','dropAck','Drop','Deliver']]){
     const s=select('practical-'+id,[['true',yes],['false',no]],String(p.assets.find(a=>a.id===asset)[prop]));
     actions.append(labelled(title,s),button('practical-apply-'+id,'Set '+title.toLowerCase(),()=>cfg(asset,{[prop]:s.value==='true'})));
    }
    actions.append(button('practical-reset','Reset robot',()=>commit(()=>command(p,'resetRobot'))),button('practical-pick','Step pick',()=>commit(()=>step(p,1))),button('practical-retry','Retry delivery',()=>commit(()=>command(p,'retryERP'))));
    const r=p.runtime;area.append(element('p','Live delivery: '+r.pallets.length+' pallet(s), '+r.postings.length+' committed posting(s), '+(r.pallets[0]?.status||'not placed')+'.','practical-context'));
   }
   area.insertBefore(element('p',hint,'practical-instruction'),actions);
   actions.append(button('practical-prove','Test my repair',()=>commit(()=>prove(p)),'primary'));
   if(t.edition===1&&t.proof?.pass)actions.append(button('practical-transfer','Open transfer case',()=>{prediction='';showHint=false;replace(transferCase(p));notify('Different case loaded. Predict from its actual configuration.');},'primary'));
  }
  area.append(renderEvidence(t));const tools=element('div',undefined,'practical-tools');
  tools.append(button('practical-hint',showHint?'Hide hint':'I don’t know yet',()=>{showHint=!showHint;draw();}),button('practical-restart','Restart this case',()=>{prediction='';replace(makePractical(t.id,t.edition,t.token,t.prior));}));
  area.append(tools);if(showHint)area.append(element('p',spec.hint,'practical-context'));
 }
 return {draw,begin,openFromURL(){const id=new URL(location.href).searchParams.get('practical');if(id&&Object.hasOwn(practicals,id))begin(id);}};
}
