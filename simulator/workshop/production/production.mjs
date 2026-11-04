import {recipeBook,revision,batch,restoreBook,maintenanceAssessment,safetyAssessment,processCampaign,processProof} from './capstones.mjs';
import {scenario,exportRun,importRun,advance,review,act} from '../../engine.mjs';
import {SCENARIOS} from '../../catalog.mjs';
import {channels,createLedger,transform,traceLot,balance,indicators,spc,historyQuery,reliability,counterexample} from './analytics.mjs';
const $=id=>document.getElementById(id),num=id=>Number($(id).value);
let state,ledger,origin='',book=recipeBook(),trialState=null,lastProof=null;
const format=(n,d=2)=>Number.isFinite(n)?n.toLocaleString('en-AU',{maximumFractionDigits:d}):'insufficient observations';
const e=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
function table(id,headers,rows){
  const t=e('table'),head=e('thead'),body=e('tbody'),r=e('tr');
  for(const h of headers){const th=e('th',h);th.scope='col';r.append(th);}
  head.append(r);t.append(head,body);
  for(const row of rows){const tr=e('tr');for(const v of row)tr.append(e('td',String(v)));body.append(tr);}
  $(id).replaceChildren(t);
}
function options(id,items,value){
  $(id).replaceChildren();for(const [key,name]of items){const opt=e('option',name);opt.value=key;$(id).append(opt);}
  if(items.some(([key])=>key===value))$(id).value=value;
}
const message=s=>$('status').textContent=s;
function invoke(fn){try{fn();}catch(error){message(error.message);}}
function lotTrace(){
  if(!ledger.nodes.length){$('genealogy').textContent='No finished inventory in this run.';return;}
  const tr=traceLot(ledger,$('trace').value);
  $('genealogy').textContent=['Raw intake: '+tr.raw.join(', '),'Parent chain: '+(tr.ancestors.join(', ')||'source finished lot'),'Affected descendants: '+(tr.descendants.join(', ')||'none'),'Quality: '+(tr.hold?'hold inherited':'no inherited hold; release still requires disposition')].join('\n');
}
function drawLedger(last){
  const items=ledger.nodes.filter(n=>n.remaining>0).map(n=>[n.id,n.id+' · '+format(n.remaining,3)+' kg']);
  for(const id of ['source','second'])options(id,items,$(id).value);
  options('trace',ledger.nodes.map(n=>[n.id,n.id]),last||$('trace').value);lotTrace();
  $('child').value='DERIVED-'+(ledger.operations.length+1);
  const bal=balance(ledger);
  $('mass').textContent='Initial '+format(bal.input,4)+' kg | current '+format(bal.inventory,4)+' kg | recorded loss '+format(bal.loss,4)+' kg | residual '+format(bal.residual,6)+' kg | '+(bal.pass?'balanced within 0.0001 kg':'balance failure');
  table('moves',['Operation','Parent allocation','Child lot','Output kg','Loss kg'],ledger.operations.slice(-8).map(x=>[x.kind,x.parents.map(l=>l.id+' '+format(l.kg)+' kg').join(', '),x.output,format(x.kg),format(x.loss)]));
}
function drawTrend(){
  const channel=$('signal').value,start=num('from'),end=num('until'),h=historyQuery(state,channel,start,end,num('band')),base=num('base');
  const sample=state.history.filter(x=>x.time>=start&&x.time<=end).map(x=>x[channel]);
  const lines=['Recorded '+h.total+' / '+h.expected+' scheduled samples; '+h.points.length+' displayed. Last sample age: '+format(h.lastAgeS)+' s.',
    'Internal gaps: '+(h.gaps.map(g=>g.from+'-'+g.to+' s').join(', ')||'none')];
  if(sample.length>base&&Number.isInteger(base)&&base>=2){
    const band=spc(sample,base);
    lines.push('Baseline n = '+base+', mean '+format(band.mean)+', sample standard deviation '+format(band.sd)+'. Three-sigma interval '+format(band.low)+' to '+format(band.high)+'.','Subsequent values outside interval: '+band.violations.length+' / '+(sample.length-base)+'. Limits describe this baseline; they are not product tolerances.');
  }else lines.push('SPC needs at least two baseline samples and one later observation.');
  lines.push('Simulation s | '+channels[channel],...h.points.slice(-8).map(v=>v.time+' | '+format(v.value,3)));
  $('trend').textContent=lines.join('\n');$('chart').replaceChildren();
  if(h.points.length<2)return;
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 600 120');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('role','img');svg.setAttribute('aria-label',channels[channel]+' from '+start+' to '+end+' seconds');
  const low=Math.min(...h.points.map(p=>p.value)),high=Math.max(...h.points.map(p=>p.value));
  const line=document.createElementNS(ns,'path');let prior=null;
  line.setAttribute('d',h.points.map(p=>{const lift=!prior||h.gaps.some(g=>prior.time<=g.from&&g.to<=p.time);prior=p;return (lift?'M':'L')+((p.time-start)*596/(end-start||1)+2)+' '+(116-(p.value-low)*112/(high-low||1));}).join(' '));
  line.setAttribute('fill','none');line.setAttribute('stroke','#10634c');line.setAttribute('stroke-width','2.5');svg.append(line);$('chart').append(svg,e('p','Scale '+format(low)+' to '+format(high)+' | '+channels[channel]));
}
function draw(){
  const m=indicators(state),s=m.summary;
  $('origin').textContent=origin+' · '+state.time+' simulation s · '+state.mode;
  const pct=x=>format(100*x)+'%';
  table('kpis',['Indicator','Measured','Basis'],[
    ['Availability',pct(s.availability),m.runningS+' running s / '+m.plannedS+' planned s'],
    ['Performance',pct(s.performance),format(s.productKg)+' kg packed / '+format(m.idealKg)+' ideal kg (24,000 kg/h), capped at 100%'],
    ['Quality',pct(s.quality),'Unaffected finished mass / total finished mass'],
    ['OEE',pct(s.oee),'Availability × performance × quality'],
    ['Water intensity',format(m.waterPerT)+' m³/t','Water used / tonnes of finished product'],
    ['Electric intensity',format(m.kWhPerT)+' kWh/t','Electric demand integrated over run / tonnes finished'],
    ['Plant mass residual',format(m.conservation.residualKg,6)+' kg','Whole reference material ledger, tolerance 0.0001 kg']
  ]);
  const faults=reliability(state.journal,state.time);
  if(!faults.length)$('faults').textContent='No injected failures in the recorded interval. A mean repair time cannot be estimated.';
  else table('faults',['Cause','Occurrences','Observed s','MTBF s','MTTR s','Status'],faults.map(f=>[f.code,f.failures,format(f.affectedS),format(f.mtbf),format(f.mttr),f.openAt===null?'cleared':'open']));
  options('process-recipe',(state.customRecipes||[]).map(r=>[r.id,r.name]),$('process-recipe').value);
  options('recipe',book.recipes.map(r=>[r.id,r.id]),$('recipe').value);
  const lots=state.finishedLots.map(l=>[l.id,l.id+' · '+l.rawLotId]);options('trial-lot',lots,$('trial-lot').value);options('cap-lot',lots,$('cap-lot').value);
  $('recipe-report').textContent=book.batches.slice(-8).map(b=>b.order+' '+b.recipe+' · '+b.raw+' · '+b.bags+' bags, '+format(b.heel,3)+' kg heel, '+format(b.loss,3)+' kg loss, residual '+format(b.balance,6)+' kg · '+b.disposition).join('\n');
  $('until').value=state.time;$('from').value=0;drawTrend();drawLedger();
}
function setRun(next,source,operations=[],finding='',recipes=null){
  if(!Array.isArray(operations)||operations.length>500||typeof finding!=='string'||finding.length>4000)throw Error('Invalid production study.');
  const register=createLedger(next.finishedLots);
  for(const op of operations)transform(register,op);
  const restored=restoreBook(recipes,next);state=next;ledger=register;book=restored;origin=source;$('finding').value=finding;draw();
}
options('scenario',SCENARIOS.map(s=>[s.id,s.name]),'baseline');options('signal',Object.entries(channels));
let incoming;
try{incoming=sessionStorage.getItem('oia-reference-analysis-run-v1');}catch{}
try{setRun(incoming?importRun(incoming):scenario('baseline'),incoming?'Current reference plant replay':'Steady production scenario');}
catch(error){setRun(scenario('baseline'),'Steady production scenario');message('Incoming replay unavailable: '+error.message);}
$('load').onclick=()=>invoke(()=>{if((ledger.operations.length||book.recipes.length)&&!confirm('Replace this analysis and its lot register?'))return;setRun(scenario($('scenario').value),$('scenario').selectedOptions[0].textContent);message('Scenario opened.');});
$('file').onchange=async()=>{
  try{const f=$('file').files[0];if(!f)return;if(f.size>2*1024*1024)throw Error('Maximum study size is 2 MiB.');
    const raw=await f.text(),doc=JSON.parse(raw);
    const study=doc.format==='oia-production-study'&&doc.version===1;
    const next=importRun(study?JSON.stringify(doc.run):raw);
    if((ledger.operations.length||book.recipes.length)&&!confirm('Replace this analysis and its lot register?'))return;
    setRun(next,f.name,study?doc.operations:[],study?doc.finding:'',study?doc.recipes:null);message('Replayed the recorded commands.');}
  catch(error){message(error.message);}finally{$('file').value='';}
};
$('advance').onclick=()=>invoke(()=>{if(ledger.operations.length||book.batches.length)throw Error('Export this study, then load the replay before advancing its material boundary.');
  advance(state,60);ledger=createLedger(state.finishedLots);draw();message('Advanced 60 simulation seconds.');});
$('query').onclick=()=>invoke(drawTrend);$('trace').onchange=()=>invoke(lotTrace);
$('apply').onclick=()=>invoke(()=>{const parents=[{id:$('source').value,kg:num('kg')}];if($('kind').value==='Recombine')parents.push({id:$('second').value,kg:num('kg2')});
  const child=transform(ledger,{parents,output:$('child').value,loss:num('loss'),kind:$('kind').value});drawLedger(child.id);message('Posted '+child.id+'.');});
$('compare').onclick=()=>invoke(()=>{const pair=counterexample();
  $('comparison').textContent=pair.map(x=>x.start+'-'+x.end+' s: '+format(x.packed)+' kg packed; cumulative availability '+(100*x.availability).toFixed(2)+'% ('+x.running+' / '+x.planned+' s).').join('\n')+'\nRunning time increased while the packer stopped producing. Use delivered kilograms and service demand alongside availability.';});
$('export').onclick=()=>invoke(()=>{const bundle={format:'oia-production-study',version:1,run:JSON.parse(exportRun(state)),operations:ledger.operations.map(({kind,output,parents,loss})=>({kind,output,parents,loss})),finding:$('finding').value,recipes:book,conservation:review(state).conservation};
  const url=URL.createObjectURL(new Blob([JSON.stringify(bundle)],{type:'application/json'})),a=e('a');a.href=url;a.download='production-study.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);message('Exported replay, study operations and finding.');});

document.body.inert = false;

$('revision').onclick=()=>invoke(()=>{const r=revision(book,{name:$('recipe-name').value,coatPct:num('coat'),lossPct:num('trim'),bagKg:num('bag')});draw();$('recipe').value=r.id;message('Registered '+r.id+'.');});
$('trial').onclick=()=>invoke(()=>{const b=batch(book,state,{recipe:$('recipe').value,lot:$('trial-lot').value,kg:num('allocation'),order:$('trial-order').value});draw();message('Trial balance '+format(b.balance,6)+' kg.');});
$('cap-execute').onclick=()=>invoke(()=>{
 if(ledger.operations.length||book.batches.length)throw Error('Export the allocated study and open its original replay before changing factory inventory.');
 const lot=state.finishedLots.find(l=>l.id===$('cap-lot').value),ops={'Hold line':['hold',{}],'Isolate packer':['isolate',{id:'pack'}],'Repair packer':['repair',{id:'pack'}],'Release isolation':['unisolate',{id:'pack'}],'Resume line':['resume',{}],'Sample finished lot':['sample',{id:lot?.id}],'Challenge detector':['challenge',{}],'Attempt quality release':['release',{id:lot?.id}],'Recall raw intake':['recall',{id:lot?.rawLotId}],'Reject compromised lot':['reject',{id:lot?.id}]};
 const [op,payload]=ops[$('cap-action').value];if(op==='reject'&&!(lot?.recalled||lot?.holdReasons.length))throw Error('Select a compromised lot for this investigation.');
 const r=act(state,op,payload);if(!r.ok)throw Error(r.reason);ledger=createLedger(state.finishedLots);draw();$('cap-result').textContent=r.reason;message(r.reason);
});
$('cap-assess').onclick=()=>invoke(()=>{const m=maintenanceAssessment(state),q=safetyAssessment(state),pk=state.stages.find(x=>x.id==='pack');
 $('cap-result').textContent=(m.pass?'PASS':'OPEN')+' maintenance: '+m.reason+' Packer wear '+pk.wear.toFixed(4)+', retained '+pk.massKg.toFixed(2)+' kg.\n'+(q.pass?'PASS':'OPEN')+' recall containment: '+q.affected.join(', ')+'; pending '+format(q.held)+' kg; rejected '+format(q.scrap)+' kg; associated shipments '+q.shipments+'.';});

$('author').onclick=()=>invoke(()=>{const r=act(state,'authorRecipe',{name:$('process-name').value,cutMm:num('cut'),blanchC:num('blanch'),fryC:num('fry'),freezeC:num('freeze'),freezeS:num('dwell'),coatPct:num('process-coat'),bagKg:num('process-bag'),skinOn:$('skin').checked,formed:$('formed').checked});if(!r.ok)throw Error(r.reason);draw();$('process-recipe').value=state.customRecipes.at(-1).id;message('Registered '+state.customRecipes.at(-1).name+'.');});
function proofText(q){return q.name+' / '+q.recipe+' / '+q.order+' at '+q.window+' s: first pack '+(q.first??'none')+' s; raw '+format(q.raw)+' kg; packed '+format(q.packed)+' kg ('+q.fullBags+' full bag equivalents); mean '+format(q.meanKgH)+' kg/h; yield '+format(q.yield*100)+'%; held lots '+q.holds+'.';}
$('simulate-recipe').onclick=()=>invoke(()=>{
 const next=processCampaign(state,$('process-recipe').value,num('process-raw'),num('process-seconds')),q=processProof(next);
 const msg=['Current: '+proofText(q),...q.records.map(r=>r.raw+' → '+r.order+' / '+r.recipe+' → '+r.lot+' | max core '+format(r.core)+' °C | '+(r.hold.join(', ')||'pending inspection')+' | shipments '+(r.shipments.join(', ')||'none'))];
 if(lastProof)msg.push('Previous: '+proofText(lastProof));
 trialState=next;lastProof=q;$('process-result').textContent=msg.join('\n');message('Reference plant trial completed.');});
$('open-trial').onclick=()=>invoke(()=>{if(!trialState)throw Error('Run a process campaign first.');if(!confirm('Open the new campaign as this study? Export current study records first if required.'))return;setRun(trialState,'Authored process campaign');message('Campaign opened. Use the capstone actions on its real lots.');});
$('export-trial').onclick=()=>invoke(()=>{if(!trialState)throw Error('Run a process campaign first.');const url=URL.createObjectURL(new Blob([exportRun(trialState)],{type:'application/json'})),a=e('a');a.href=url;a.download='process-campaign.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Exported replay with immutable recipe and commands.');});
