import {subjects,trial,grade,proof,corpus} from './foundations.mjs';
import {execute,parse} from './scan-code.mjs';
const $=id=>document.getElementById(id),key='oia-workshop-foundations-transfer-v1';
let history=[],revisions=[],id='travel',seed=1,type='worked',locked=false;
try{
  const raw=JSON.parse(sessionStorage.getItem(key)||'null');history=corpus(raw);
  if(raw?.revisions){if(!Array.isArray(raw.revisions)||raw.revisions.length>32)throw Error('Invalid revision history.');for(const r of raw.revisions){parse(r.lang,r.expr);if(typeof r.reason!=='string'||r.reason.length>100)throw Error('Invalid revision.');}revisions=raw.revisions;}
}catch(e){$('result').textContent=e.message;}
function save(){sessionStorage.setItem(key,JSON.stringify({version:1,history,revisions}));}
for(const [key,s] of Object.entries(subjects))$('subject').add(new Option(s.title,key));
function register(){
  const passed=Object.keys(subjects).filter(key=>proof(history,key));
  $('progress').textContent=passed.length+' of '+Object.keys(subjects).length+' calculation competencies demonstrated. '+passed.map(key=>subjects[key].title).join(' · ');
  $('records').replaceChildren(...history.slice(-12).reverse().map(r=>{const li=document.createElement('li');li.textContent=subjects[r.id].title+' · case '+r.seed+' · '+r.type+' · '+grade(r.id,r.seed,r.answers).filter(Boolean).length+'/2 predictions within tolerance.';return li;}));
  $('revs').replaceChildren(...revisions.map((r,i)=>new Option((i+1)+'. '+r.reason,i)));$('revs').value=String(revisions.length-1);
}
function show(){
  const s=subjects[id],q=trial(id,seed);locked=false;$('first').value='';$('second').value='';
  $('target').textContent=s.period+' · '+s.action;$('instrument').textContent='Inspect: '+s.instrument+'.';$('workbench').href=s.bench;$('question').textContent=q.question;
  $('first-label').textContent=q.labels[0];$('second-label').textContent=q.labels[1];$('case').textContent=(type==='worked'?'Worked example':'Independent challenge')+' · case '+seed;
  $('hint').textContent=q.explanation+' '+s.wrong;$('worked-result').textContent=type==='worked'?'Worked result: '+q.expected.map((x,i)=>q.labels[i]+' = '+Number(x.toFixed(3))).join(' · '):'';
  $('result').textContent='';register();
}
function challenge(){
  const prior=history.filter(r=>r.id===id).map(r=>JSON.stringify(trial(id,r.seed).expected));prior.push(JSON.stringify(trial(id,1).expected));
  seed=crypto.getRandomValues(new Uint32Array(1))[0]%99000;
  for(let i=0;i<250&&prior.includes(JSON.stringify(trial(id,seed).expected));i++)seed++;
  type='challenge';show();
}
$('subject').onchange=()=>{id=$('subject').value;type='worked';seed=1;show();};$('worked').onclick=()=>{type='worked';seed=1;show();};$('challenge').onclick=challenge;
$('predict').onsubmit=e=>{e.preventDefault();if(locked){$('result').textContent='Open a different case for a fresh attempt.';return;}if(history.length>=240){$('result').textContent='Learning register full.';return;}
 const answers=[Number($('first').value),Number($('second').value)],checks=grade(id,seed,answers);history.push({id,seed,type,answers});locked=true;save();register();$('result').textContent=checks.every(Boolean)?'Both predictions within tolerance.':checks.map((ok,i)=>trial(id,seed).labels[i]+': '+(ok?'within tolerance':'recheck the units and boundary')).join(' · ');};
function act(id,fn){$(id).onclick=()=>{try{fn();}catch(e){$('gitresult').textContent=e.message;}};}
act('execute',()=>{const rows=execute($('lang').value,$('expr').value,$('pattern').value);$('trace').textContent='Scan   In   Previous   Count   Expected\n'+rows.map(r=>[r.scan,+r.input,+r.previous,r.count,r.expected].join('         ')).join('\n');
 const pass=['00111011','11100010010','000010','100000','11111'].every(p=>execute($('lang').value,$('expr').value,p).every(r=>r.count===r.expected));$('gitresult').textContent=pass?'All held-input and rearm tests passed.':'Regression detected. Compare the first divergent scan.';});
act('commit',()=>{const lang=$('lang').value,expr=$('expr').value,reason=$('reason').value.trim();parse(lang,expr);if(!reason||revisions.length>=32)throw Error('Enter a revision reason; maximum 32 revisions.');revisions.push({lang,expr,reason});save();register();$('gitresult').textContent='Source revision recorded.';});
act('diff',()=>{const r=revisions[Number($('revs').value)];if(!r)throw Error('Commit an expression first.');$('gitresult').textContent='Revision: '+r.lang+' / '+r.expr+' · Working copy: '+$('lang').value+' / '+$('expr').value;});
act('checkout',()=>{const r=revisions[Number($('revs').value)];if(!r)throw Error('Select a saved revision.');$('lang').value=r.lang;$('expr').value=r.expr;$('gitresult').textContent='Working copy restored.';});
show();document.body.inert=false;
