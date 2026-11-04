import {createShift,currentGoal,progress,targetOrder,receipt,locateStock,checkReservation,recordReservation,identifyTruck,diagnose,recoverRoute,dispatched,verifyReceipt,nextEvent,evidence,encodeShift,decodeShift,roles} from './shift-model.mjs';
import {availableStock,PRODUCTS} from './facility-model.mjs';

const $=id=>document.getElementById(id);
const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
const find=(rows,id)=>rows.find(r=>r.id===id);
const lines={
  locate:'Inspect rack stock and match the pallet ID and intake lot on the job ticket.',
  reserve:'Create the dispatch order. Select the ticket product, confirmed bay and requested customer dock.',
  identify:'Inspect the order to find its assigned truck. Select that vehicle and verify its task.',
  diagnose:'A loaded truck is waiting. Inspect its destination door and identify which dependency has failed.',
  recover:'Restore the original door or redirect this loaded order to another open door. Keep the pallet and lot unchanged.',
  dispatch:'Move the order to staging, then release its pallet onto the trailer at the assigned door.',
  verify:'Compare the dispatch manifest with the original ticket. Record the pallet, lot and trailer to finish.',
  complete:'All observed objectives passed. Your learner record contains the dispatch receipt and timed actions.'
};
const titles={locate:'Find matching pallet',reserve:'Create dispatch order',identify:'Identify assigned truck',diagnose:'Investigate delay',recover:'Restore dispatch path',dispatch:'Advance to next event',verify:'Verify dispatch receipt',complete:'View completion record'};
const hints={
  locate:'SKU means stock keeping unit: it identifies the product. PL labels one pallet. LT groups stock from the same intake lot. Search the PL or LT code, then check both before reserving.',
  reserve:'The dispatch order form lists products, rack bays and dock doors. Compare all three with your ticket before releasing it.',
  identify:'Read “Assigned truck” on the order. If it still says Waiting, advance the warehouse until the assignment appears.',
  diagnose:'Compare the truck’s load and fault state with the Open or Closed status of its destination door.',
  recover:'One valid repair is to reopen the closed dispatch door. Another is to redirect the existing order to a different open door.',
  dispatch:'Advance to the next operational event until the order is staged. Dispatch it once and check its trailer record.',
  verify:'Use the values printed in the committed manifest, including the PL-, LT- and TR- prefixes.'
};
export function shiftDesk(host){
  const key='oia-facility-jobs-v1:'+encodeURIComponent(host.profile),preview=createShift(),data={version:1,active:null,compact:false,drafts:{},completed:[]};
  let m=null,raw=null,writable=true,issue='',previewFeedback='',inspectId=null,skipPersist=false;
  try{
    raw=host.storage.getItem(key);
    if(raw){if(raw.length>2200000)throw Error('Job record exceeds the storage limit.');const saved=JSON.parse(raw);
      if(saved?.version!==1||!saved.drafts||!Array.isArray(saved.completed)||saved.completed.length>100)throw Error('Invalid job register.');
      Object.assign(data,saved);if(data.active)m=decodeShift(data.drafts[data.active]);}
  }catch(e){writable=false;issue='Job storage unavailable. Existing learner records are preserved.';m=null;}
  function persist(){
    if(!writable||skipPersist)return;
    try{
      if((host.storage.getItem('oia-workshop-profile-v1')||'Learner')!==host.profile||host.storage.getItem(key)!==raw)throw Error('The job register changed in another view.');
      if(m)data.drafts[m.kind]=encodeShift(m);const next=JSON.stringify(data);if(next.length>2200000)throw Error('Job storage is full.');
      if(next!==raw){host.storage.setItem(key,next);raw=next;}
    }catch(e){writable=false;issue=e.message+' Keep the completion record open to export it.';}
  }
  function hintText(){return (m?m.feedback:previewFeedback)||issue||'';}
  function draw(){
    const active=m||preview,goal=currentGoal(active),[n,total]=progress(active),t=active.ticket,o=targetOrder(active);
    $('shift-desk').dataset.compact=String(!m&&data.compact);
    $('shift-heading').textContent=roles[active.kind];$('shift-progress').textContent=n+' / '+total+' objectives';$('shift-meter').max=total;$('shift-meter').value=n;
    $('shift-objective').textContent=active.kind==='incident'?'Recover delayed order '+o.id+' at '+t.door:'Release '+t.sku+' to dock '+t.door;
    $('shift-instruction').textContent=goal==='complete'?lines.complete:(t.pallet+' · '+t.lot+' · '+t.sku+' · '+t.door+'. '+lines[goal]);
    $('shift-feedback').textContent=hintText();
    $('shift-primary').textContent=data.compact&&!m?'Open your first shift':goal==='dispatch'&&o.status==='staged'?'Dispatch staged pallet':goal==='identify'&&!o.vehicle?'Advance to truck assignment':goal==='locate'&&inspectId?'Confirm selected stock':titles[goal];
    $('shift-hint').hidden=goal==='complete'||(!m&&data.compact)||active.kind==='challenge';$('shift-free').hidden=!m&&data.compact;
  }
  function fail(err){if(m){m.attempts=Math.min(1e6,m.attempts+1);m.feedback=err.message;persist();}draw();if($('dialog').open)$('dialog-message').textContent=err.message;else host.report(err.message);}
  function guarded(fn){return async e=>{try{await fn(e);}catch(err){fail(err);}};}
  function button(parent,label,fn,id){const b=node('button',label);b.type='button';if(id)b.id=id;b.onclick=guarded(fn);parent.append(b);return b;}
  function start(kind,replace=false){
    if(m)persist();else host.saveFree();
    let seed=kind==='challenge'?((Number(data.drafts.challenge?.seed)||7)*113+53)%65536:7;
    const next=!replace&&data.drafts[kind]?decodeShift(data.drafts[kind]):createShift(kind,seed);
    m=next;data.active=kind;data.compact=false;inspectId=null;skipPersist=true;
    try{host.swap(m.floor,false);}finally{skipPersist=false;}
    persist();draw();
  }
  function free(){
    if(m){persist();m=null;data.active=null;host.restoreFree();}
    data.compact=true;inspectId=null;persist();draw();$('dialog').close();
  }
  function selected(){return host.selected();}
  function jobDialog(title){const body=host.dialog(title);body.classList.add('job-dialog');return body;}
  function stockFinder(){
    const body=jobDialog('Find the requested stock'),t=m.ticket;
    body.append(node('p','Pick list: '+t.sku+' / intake lot '+t.lot+' / pallet '+t.pallet+'. Inspect a bay, then confirm the stock from its inventory.'));
    body.append(node('p','The SKU (stock keeping unit) identifies the product. PL labels one pallet. LT identifies its intake lot. Two pallets can hold the same fries; matching the lot lets the team trace a shipment back to intake.'));
    const l=node('label','Search available inventory'),input=node('input');input.id='job-stock-query';input.type='search';input.value=t.sku;l.append(input);body.append(l);const list=node('div');list.className='stock-candidates';body.append(list);
    function results(){
      list.replaceChildren();const q=input.value.trim().toUpperCase();
      const all=m.floor.bays.flatMap(b=>availableStock(m.floor,b).map(p=>({p,b})));
      const targetIndex=all.findIndex(x=>x.p.id===t.pallet);const ordered=all.slice(Math.max(0,targetIndex-7)).concat(all.slice(0,Math.max(0,targetIndex-7)));
      const matches=ordered.filter(({p,b})=>[b.id,p.sku,p.lot,p.id].join(' ').includes(q));
      for(const {p,b} of matches.slice(0,32)){
        const btt=button(list,b.id+' · '+p.sku+' · '+p.lot+' · '+p.id,()=>{
          inspectId=b.id;host.choose(b.id);$('stock-details').open=true;$('dialog').close();
          m.feedback='Inspect '+b.id+' in the asset panel, then confirm the stock against the ticket.';draw();persist();
        });btt.dataset.pallet=p.id;
      }
      if(!matches.length)list.append(node('p','No matching available stock. Check the product, lot or pallet ID.'));
    }input.oninput=results;results();
  }
  function advanceOrder(){
    m.feedback=nextEvent(m);host.synced();persist();draw();
  }
  function checkTruck(){
    const o=targetOrder(m);if(!o.vehicle){advanceOrder();return;}
    const body=jobDialog('Identify the assigned vehicle');
    body.append(node('p','Dispatch order '+o.id+' is assigned to '+o.vehicle+'. Inspect a truck and verify its task against this order.'));
    for(const v of m.floor.vehicles){
      const b=button(body,'Inspect '+v.id+' · '+(v.task||'idle'),()=>{host.choose(v.id);try{identifyTruck(m,v.id);$('dialog').close();persist();draw();}catch(e){fail(e);}});b.dataset.truck=v.id;
    }
  }
  function incident(){
    const o=targetOrder(m),body=jobDialog('Diagnose the delayed order'),v=find(m.floor.vehicles,o.vehicle);host.choose(v.id);
    body.append(node('p',o.id+' / '+v.id+' / '+v.state+' / aboard '+(v.load?.id||'empty')+' / destination '+o.door+'. Inspect a dock and identify the reason.'));
    const select=node('select');select.id='job-inspect-door';select.setAttribute('aria-label','Inspect dispatch door');select.append(new Option('Choose a door',''));for(const d of m.floor.doors)select.append(new Option(d.id,d.id));body.append(select);
    const reading=node('p');body.append(reading);select.onchange=()=>{const d=find(m.floor.doors,select.value);if(d){host.choose(d.id);reading.textContent=d.id+' · '+(d.open?'Open':'Closed')+' · trailer '+d.trailer;}};
    for(const [cause,text] of [['truck','Truck drive fault'],['pallet','Missing pallet'],['door','Unavailable destination door']])button(body,text,()=>{diagnose(m,select.value,cause);$('dialog').close();persist();draw();},'job-cause-'+cause);
  }
  function recovery(){
    const body=jobDialog('Restore a dispatch path'),o=targetOrder(m);body.append(node('p','Recover '+o.id+' with '+o.pallet+' still on '+o.vehicle+'. Select an operational action.'));
    button(body,'Inspect and reopen '+o.door,()=>{host.choose(o.door);$('dialog').close();m.feedback='Use Reopen door in the asset inspector. The pickup and order must remain intact.';draw();},'job-repair');
    button(body,'Redirect existing order',()=>{host.choose(o.id,false);host.orderForm(o);},'job-redirect');
  }
  function manifest(){
    const body=jobDialog('Verify the dispatch receipt'),r=receipt(m);if(!r)throw Error('No matching dispatch receipt.');
    const d=node('dl');d.className='manifest';for(const [label,value] of [['Order',r.order],['Pallet',r.id],['Product',r.sku],['Intake lot',r.lot],['Trailer',r.trailer],['Door',r.door]])d.append(node('dt',label),node('dd',value));body.append(d);
    const form=node('form');form.className='job-form';for(const [name,label] of [['pallet','Received pallet ID'],['lot','Verified intake lot'],['trailer','Receiving trailer ID']]){
      const l=node('label',label),input=node('input');input.id='job-'+name;input.name=name;input.required=true;l.append(input);form.append(l);
    }
    const submit=node('button','Verify and sign off');submit.className='primary';form.append(submit);body.append(form);form.onsubmit=guarded(e=>{
      e.preventDefault();const answers=Object.fromEntries([...new FormData(form)].map(([k,v])=>[k,v.trim().toUpperCase()]));
      verifyReceipt(m,answers);const row=evidence(m,host.profile);
      data.completed=data.completed.filter(x=>!(x.kind===row.kind&&x.seed===row.seed));data.completed.push(row);data.completed=data.completed.slice(-100);
      $('dialog').close();persist();draw();
    });
  }
  function completions(){
    const body=jobDialog('Learner evidence');body.append(node('p','Learner: '+host.profile+'. '+data.completed.length+' completed assignment(s).'));
    for(const row of [...data.completed].reverse()){
      const wrap=node('details'),title=node('summary',row.role+' · '+row.order+' · seed '+row.seed);wrap.append(title);
      const steps=node('ol');for(const item of row.proof)steps.append(node('li',item.at*.25+' s · '+item.measurement));wrap.append(steps);body.append(wrap);
    }
    if(data.completed.length)button(body,'Export completion evidence',()=>host.download(JSON.stringify({profile:host.profile,completed:data.completed},null,2),'shift-evidence.json'),'job-export-evidence');
    button(body,'Choose another job',jobs);
  }
  function jobs(){
    const body=jobDialog('Choose a practical job'),list=node('div');list.className='job-choice';body.append(list);
    for(const [kind,desc] of [['operator','Find a lot, reserve a pallet, follow its truck and sign off the trailer receipt.'],['incident','Diagnose a blocked dispatch and recover the original load.'],['challenge','Deliver a different stock and dock assignment independently.']]){
      const b=button(list,roles[kind],()=>{start(kind);$('dialog').close();draw();},'job-start-'+kind);b.append(node('small',desc));
    }
    for(const [label,href,desc] of [['Wire a photoeye','../index.html?practical=wiring','Verify the input at the intended PLC terminal.'],['Fix the carton counter','../index.html?practical=counting','Correct a repeated count using scan evidence.'],['Commission a camera','../index.html?practical=camera','Restore a camera session through its network path.'],['Recover a posting','../index.html?practical=recovery','Reconcile one stock movement after an acknowledgement failure.'],['Build a bracket','../part/index.html?practical=bracket','Edit the sketch and extrude a bracket to its drawing.'],['Tune a drive','../analysis/index.html?practical=drive','Predict drive force, tune the response and test a second load.']]){
      const a=node('a',label);a.href=href;a.append(node('small',desc));list.append(a);
    }
    if(m)button(list,m.kind==='challenge'?'New independent seed':'Retry current assignment',()=>{
      if(confirm('Restart these practical objectives on a new job copy? Completed evidence and the free shift are retained.')){start(m.kind,true);$('dialog').close();}
    },'job-retry');
    button(list,'My completion records',completions,'job-evidence');button(list,'Return to free shift',free);
  }
  function primary(){
    if(!m){start('operator');}
    const goal=currentGoal(m),o=targetOrder(m);
    if(goal==='locate'){
      if(inspectId){
        try{locateStock(m,selected());inspectId=null;persist();draw();}
        catch(e){inspectId=null;throw e;}
      }else stockFinder();
    }else if(goal==='reserve')host.orderForm(null,m.ticket.bay);
    else if(goal==='identify')checkTruck();
    else if(goal==='diagnose')incident();
    else if(goal==='recover')recovery();
    else if(goal==='dispatch'){if(o.status!=='staged')advanceOrder();else{host.choose(o.id,false);host.mutate('dispatch',{order:o.id});}}
    else if(goal==='verify')manifest();else completions();
  }
  $('shift-primary').onclick=guarded(primary);$('shift-jobs').onclick=guarded(jobs);$('shift-free').onclick=guarded(free);$('shift-hint').onclick=()=>{const text=hints[currentGoal(m||preview)];if(m){m.feedback=text;persist();draw();}else{previewFeedback=text;draw();}};
  const observer=new ResizeObserver(()=>document.documentElement.style.setProperty('--shift-height',$('shift-desk').offsetHeight+'px'));observer.observe($('shift-desk'));draw();
  return {get active(){return m;},persist,draw,fail,free,
    openJob(kind){if(Object.hasOwn(roles,kind)){if(!m||m.kind!==kind)start(kind);data.compact=false;draw();}},
    observed(id){if(m&&currentGoal(m)==='locate'&&find(m.floor.bays,id)){inspectId=id;draw();}},
    before(name,args){
      if(!m)return;
      const goal=currentGoal(m);
      if(name==='order')checkReservation(m,args);
      if(name==='dispatch')requiredGoal(goal==='dispatch'&&args.order===m.order,'Dispatch the assigned order after completing its inspection objectives.');
      if(m.kind==='incident'&&['door','redirect'].includes(name)&&goal==='diagnose')throw Error('Capture the dock diagnosis before changing the route.');
      if(name==='redirect'&&args.order===m.order){if(m.kind!=='incident'&&(args.bay!==m.ticket.bay||args.door!==m.ticket.door))throw Error('This customer order must keep the confirmed pallet and requested dispatch door.');const d=find(m.floor.doors,args.door);if(!d?.open)throw Error('That door is closed. Choose an open destination.');}
      if(name==='auto'&&args.enabled)throw Error('Automatic demand is paused during this assignment. Return to Free shift to enable it.');
    },
    after(name,args){
      if(!m)return;const goal=currentGoal(m);
      if(name==='order')recordReservation(m,m.floor.orders.at(-1));
      if(goal==='recover'&&(name==='door'||name==='redirect')){const o=targetOrder(m);if(find(m.floor.doors,o.door).open)recoverRoute(m);}
      if(name==='dispatch'&&args.order===m.order)dispatched(m);
      persist();draw();
    }
  };
}
function requiredGoal(test,message){if(!test)throw Error(message);}
