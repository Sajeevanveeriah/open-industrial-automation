import {defaultDesign,roles,stages,incidents,mission,newCase,openCase,packCase,applyCase} from './lifecycle.mjs';
export function lifecycleBench(existing,persist) {
  const $=id=>document.getElementById(id);
  const options=(id,items)=>$(id).replaceChildren(...items.map(v=>Array.isArray(v)?new Option(v[1],v[0]):new Option(v,v)));
  let c=existing?openCase(existing):newCase();
  const form=$('case-plan');
  const setDesign=d=>{
    for(const [k,v] of Object.entries(d)){const e=form.elements.namedItem(k);if(e.type==='checkbox')e.checked=v;else e.value=v;}
  };
  const getDesign=()=>Object.fromEntries(Object.entries(defaultDesign).map(([k,v])=>{const e=form.elements.namedItem(k);return [k,typeof v==='boolean'?e.checked:typeof v==='number'?Number(e.value):e.value];}));
  const choices=[['allocate','Allocate a measurable requirement'],['witness','Witness supplier control tests'],['trace','Trace installed supplies and cables'],['restore','Restore the installed service and retrieve data'],['reconcile','Reconcile material and business evidence'],['handover','Transfer outstanding issues and instructions']];
  function render(){
    const m=mission(c.seed), latest=c.results.at(-1);
    $('case-seed').value=c.seed;$('case-spec').textContent='Case '+m.seed+'. A common power-domain loss occurs at minute '+m.outage+'. The application commits '+m.recordsPerMinute+' records/min. Recovery time objective '+m.rto+' min. Recovery point objective '+m.rpo+' min. Service '+m.hours+' h/year for '+m.lifetime+' years. Retain archives for '+m.archiveDays+' days.';
    $('case-stage').textContent='Current phase: '+stages[c.phase];$('advance-stage').disabled=c.phase===6;
    $('case-observed').textContent=c.results.map((r,i)=>'Trial '+(i+1)+': predicted '+r.prediction+' min, recovered '+r.observed.recovery+' min; recovery point '+r.observed.pointAge+' min; lost '+r.observed.dataLoss+' records. '+(r.observed.pass?'Objectives met.':'Objectives missed.')+' Capital AUD '+r.observed.capex+', annual AUD '+r.observed.annual+', lifecycle AUD '+r.observed.total+'. Alternative AUD '+r.comparison.total+', recovery '+r.comparison.recovery+' min. Model availability '+(100*r.observed.availability).toFixed(4)+'%. '+r.reason).join('\n');
    const passed=incidents.filter(q=>c.assessments.filter(a=>a.id===q.id).at(-1)?.pass);
    $('case-score').textContent=passed.length+' of '+incidents.length+' role decisions supported. '+(c.retirement?.pass?'Retirement record accepted.':'Retirement open.')+' '+(latest&&latest.observed.pass&&latest.prediction===latest.observed.recovery&&c.retirement?.pass&&passed.length===incidents.length?'Capstone passed.':'');
  }
  function roleQuestion(){const q=incidents.find(v=>v.id===$('case-incident').value);$('case-question').textContent=q.role+' · '+q.question;options('case-response',q.options);}
  options('case-role',roles);options('case-decision',choices);options('case-owner',roles);options('case-incident',incidents.map(q=>[q.id,q.role]));roleQuestion();
  function commit(action,args){
    const next=openCase(packCase(c));const result=applyCase(next,action,args);persist(packCase(next));c=next;render();return result;
  }
  const act=(id,fn)=>{$(id).onclick=()=>{try{fn();}catch(e){$('case-status').textContent=e.message;}};};
  act('case-new',()=>{const n=Number($('case-seed').value);mission(n);const next=newCase(n);if((c.log||[]).length&&!confirm('Start another lifecycle case? Export the register to keep this one.'))return;persist(packCase(next));c=next;setDesign(c.design);render();});
  act('case-test',()=>{
    if(!$('case-predict').value.trim())throw Error('Enter a predicted recovery time.');
    const d=getDesign(),alt={...d,standby:$('case-alternative').value};
    commit('estimate',[d,Number($('case-predict').value),alt,$('case-reason').value]);$('case-status').textContent='Trial recorded.';
  });
  act('advance-stage',()=>{$('case-status').textContent=commit('nextStage',[stages[c.phase],$('case-role').value,$('case-decision').value])?'Phase evidence accepted.':'Choose the role and evidence appropriate to this phase.';});
  $('case-incident').onchange=roleQuestion;
  act('case-answer',()=>{const q=incidents.find(v=>v.id===$('case-incident').value);$('case-status').textContent=commit('respond',[q.id,$('case-response').value])?q.outcome:'The requirement remains open. Preserve the evidence and reconsider the affected role.';});
  act('case-retire',()=>{$('case-status').textContent=commit('retire',[Number($('case-retention').value),$('case-archive').checked,$('case-revoke').checked,$('case-owner').value])?'Retirement evidence accepted.':'Hold retirement until retention, retrieval, credential revocation and ownership meet the case.';});
  setDesign(c.design);render();
}
