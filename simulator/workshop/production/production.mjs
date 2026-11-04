import {scenario,exportRun,importRun,advance,review} from '../../engine.mjs';
import {SCENARIOS} from '../../catalog.mjs';
import {channels,createLedger,transform,traceLot,balance,indicators,spc,historyQuery,reliability,counterexample} from './analytics.mjs';
const $=id=>document.getElementById(id),num=id=>Number($(id).value);
let state,ledger,origin='';
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
  $('until').value=state.time;$('from').value=0;drawTrend();drawLedger();
}
function setRun(next,source,operations=[],finding=''){
  if(!Array.isArray(operations)||operations.length>500||typeof finding!=='string'||finding.length>4000)throw Error('Invalid production study.');
  const register=createLedger(next.finishedLots);
  for(const op of operations)transform(register,op);
  state=next;ledger=register;origin=source;$('finding').value=finding;draw();
}
options('scenario',SCENARIOS.map(s=>[s.id,s.name]),'baseline');options('signal',Object.entries(channels));
let incoming;
try{incoming=sessionStorage.getItem('oia-reference-analysis-run-v1');}catch{}
try{setRun(incoming?importRun(incoming):scenario('baseline'),incoming?'Current reference plant replay':'Steady production scenario');}
catch(error){setRun(scenario('baseline'),'Steady production scenario');message('Incoming replay unavailable: '+error.message);}
$('load').onclick=()=>invoke(()=>{if(ledger.operations.length&&!confirm('Replace this analysis and its lot register?'))return;setRun(scenario($('scenario').value),$('scenario').selectedOptions[0].textContent);message('Scenario opened.');});
$('file').onchange=async()=>{
  try{const f=$('file').files[0];if(!f)return;if(f.size>2*1024*1024)throw Error('Maximum study size is 2 MiB.');
    const raw=await f.text(),doc=JSON.parse(raw);
    const study=doc.format==='oia-production-study'&&doc.version===1;
    const next=importRun(study?JSON.stringify(doc.run):raw);
    if(ledger.operations.length&&!confirm('Replace this analysis and its lot register?'))return;
    setRun(next,f.name,study?doc.operations:[],study?doc.finding:'');message('Replayed the recorded commands.');}
  catch(error){message(error.message);}finally{$('file').value='';}
};
$('advance').onclick=()=>invoke(()=>{if(ledger.operations.length)throw Error('Export this study, then load the replay before advancing its material boundary.');
  advance(state,60);ledger=createLedger(state.finishedLots);draw();message('Advanced 60 simulation seconds.');});
$('query').onclick=()=>invoke(drawTrend);$('trace').onchange=()=>invoke(lotTrace);
$('apply').onclick=()=>invoke(()=>{const parents=[{id:$('source').value,kg:num('kg')}];if($('kind').value==='Recombine')parents.push({id:$('second').value,kg:num('kg2')});
  const child=transform(ledger,{parents,output:$('child').value,loss:num('loss'),kind:$('kind').value});drawLedger(child.id);message('Posted '+child.id+'.');});
$('compare').onclick=()=>invoke(()=>{const pair=counterexample();
  $('comparison').textContent=pair.map(x=>x.start+'-'+x.end+' s: '+format(x.packed)+' kg packed; cumulative availability '+(100*x.availability).toFixed(2)+'% ('+x.running+' / '+x.planned+' s).').join('\n')+'\nRunning time increased while the packer stopped producing. Use delivered kilograms and service demand alongside availability.';});
$('export').onclick=()=>invoke(()=>{const bundle={format:'oia-production-study',version:1,run:JSON.parse(exportRun(state)),operations:ledger.operations.map(({kind,output,parents,loss})=>({kind,output,parents,loss})),finding:$('finding').value,conservation:review(state).conservation};
  const url=URL.createObjectURL(new Blob([JSON.stringify(bundle)],{type:'application/json'})),a=e('a');a.href=url;a.download='production-study.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);message('Exported replay, study operations and finding.');});

document.body.inert = false;
