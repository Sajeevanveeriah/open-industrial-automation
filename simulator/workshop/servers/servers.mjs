import {createServers,operate,probe,storage,assessments,exportServers,importServers} from './server-model.mjs';
const key='oia-workshop-servers-v1',$=id=>document.getElementById(id), el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
let state;
try{const d=JSON.parse(sessionStorage.getItem(key)||'null');state=d?.data?importServers(d.data):createServers(true);}
catch(error){state=createServers();$('result').textContent='Stored estate unavailable: '+error.message;}
const actions={host:'Provision host',deploy:'Deploy service',grant:'Grant group membership',revoke:'Revoke group membership',certificate:'Issue server certificate',route:'Set application DNS target',write:'Commit production record',read:'Read application records',replicate:'Synchronise standby',backup:'Take independent backup',damage:'Inject archive corruption',restore:'Restore archive',power:'Change host power',network:'Change virtual switch link',patch:'Apply application patch',verify:'Probe canary host',migrate:'Set database schema compatibility',rollback:'Roll back last patch',advance:'Advance simulation clock',targets:'Set recovery objectives'};
function options(node,pairs){for(const [value,label]of pairs){const o=el('option',label);o.value=value;node.append(o);}}
options($('action'),Object.entries(actions));
function fields(){
  const a=$('action').value;$('fields').replaceChildren();
  const field=(id,label,value,choices)=>{
    const l=el('label',label),input=el(choices?'select':'input');input.id=id;
    if(choices)options(input,choices.map(c=>[c,c]));else input.type=typeof value==='number'?'number':'text';
    if(value!==null&&value!==undefined)input.value=value;l.append(input);$('fields').append(l);
  };
  if(a==='host'){field('name','New host identifier','host-'+(state.hosts.length+1));field('ram','Allocated memory (GiB)',8);field('disk','Allocated storage (GB)',32);}
  else if(['deploy','certificate','route','replicate','backup','restore','power','network','patch','verify','migrate','rollback'].includes(a))field('name','Target host',null,state.hosts.map(h=>h.name));
  if(a==='deploy')field('service','Service',null,['database','application']);
  if(['grant','revoke','write','read'].includes(a))field('user','Synthetic identity',a==='write'?'engineer':a==='read'?'operator':'svc-app',['operator','engineer','visitor','svc-app']);
  if(['grant','revoke'].includes(a))field('group','Group','database',['view','admin','database']);
  if(a==='certificate')field('days','Validity (days)',30);
  if(a==='write')field('label','Transaction lot or order identifier','LOT-'+(state.issued+1));
  if(a==='power'||a==='network')field('on','State',null,['off','on']);
  if(a==='patch')field('version','Target version',2);
  if(a==='advance')field('seconds','Elapsed simulation seconds',10);
  if(a==='targets'){field('rto','Maximum recovery time (s)',state.rto);field('rpo','Maximum recovery point age (s)',state.rpo);}
}
function table(id,header,rows){
  const t=el('table'),head=el('thead'),headRow=el('tr'),body=el('tbody');
  for(const title of header){const th=el('th',title);th.scope='col';headRow.append(th);}
  head.append(headRow);t.append(head,body);
  for(const row of rows){const tr=el('tr');for(const v of row)tr.append(el('td',v));body.append(tr);}$(id).replaceChildren(t);
}
function persist(){try{sessionStorage.setItem(key,JSON.stringify({data:exportServers(state)}));}catch{$('result').textContent='Session storage unavailable; this estate could not be preserved.';}}
function draw(){
  const target=state.hosts.find(h=>h.name===state.dns);
  $('path').textContent='t = '+state.time+' s | DNS → '+(state.dns||'unassigned')+' → '+probe(state);
  table('hosts',['Host','Allocation in use','Version and services','Health'],state.hosts.map(h=>{const use=storage(h);return [h.name,use.ram+'/'+h.ram+' GiB, '+use.disk.toFixed(2)+'/'+h.disk+' GB',h.services.join(' + ')+' · app v'+h.app+' / DB v'+h.schema,probe(state,h)];}));
  $('members').textContent='Group membership: '+Object.entries(state.groups).map(([user,groups])=>user+' = '+(groups.join(', ')||'none')).join(' | ')+'. Active record IDs: '+(target?.rows.map(r=>r.id+' ('+r.label+')').slice(-12).join(', ')||'none')+'.';
  $('checks').replaceChildren(...assessments(state).map(([label,pass])=>el('li',(pass?'Pass: ':'Open: ')+label)));
  const r=state.lastRecovery;
  $('record').textContent='Targets: RTO '+state.rto+' s / RPO '+state.rpo+' s. '+(state.outage?'Current outage since '+state.outage.start+' s. ':'')+(r?'Most recent recovery '+r.start+'-'+r.end+' s. Measured RTO '+r.rto+' s, RPO '+r.rpo+' s; '+r.recovered+'/'+r.expected+' committed records recovered. Missing: '+(r.missing.join(', ')||'none')+'.':'No completed service recovery.')+' Archive: '+(state.backup?state.backup.source+' at '+state.backup.at+' s, checksum '+state.backup.checksum:'none')+'.';
  table('audit',['Simulation s','Actor','Action','Result'],state.audit.slice(-30).reverse().map(a=>[a.at,a.actor,a.action,a.result]));
}
$('action').onchange=fields;
$('execute').onclick=()=>{
  try {
    const args=Object.fromEntries([...$('fields').querySelectorAll('input,select')].map(n=>[n.id,n.id==='on'?n.value==='on':n.type==='number'?Number(n.value):n.value]));
    $('result').textContent=operate(state,$('action').value,args);draw();persist();
  }catch(error){$('result').textContent=error.message;}
};
function reset(ref){if(!confirm('Replace this server estate and its local audit?'))return;state=createServers(ref);fields();draw();persist();$('result').textContent=ref?'Reference estate opened.':'Empty estate opened.';}
$('blank').onclick=()=>reset(false);$('ref').onclick=()=>reset(true);
fields();draw();persist();
