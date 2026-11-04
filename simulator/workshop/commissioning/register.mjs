const $=id=>document.getElementById(id);
const inbound='oia-case-register-v1', outbound='oia-workshop-commissioning-transfer-v1';
const definitions=[
 ['counter','Count precisely one event per observed carton','plc','Hold the input high for consecutive scans. Clear it, then introduce a second carton.','Factory acceptance test'],
 ['video','Obtain an authorised camera session through the commissioned path','camera','Confirm power and link. Verify VLAN membership, time and viewing permission.','Site acceptance test'],
 ['erp','Commit exactly one stock movement per pallet after acknowledgement loss','erp','Drop the first acknowledgement, retry and compare confirmed pallet and posting keys.','Integrated commissioning']];
const titles={travel:'Carton crosses mounted beam',sensor:'Correct input energises',counter:'Exactly one count per observed carton',hmi:'Display equals live counter',video:'Authorised video session',pallet:'One pallet per introduced carton',erp:'All pallet movements confirmed once',commissioning:'Three acceptance stages passed',transfer:'Predicted travel time within one scan'};
const templates={
 'Rack schedule':'Rack A / access switch / two local camera and viewing ports / reserve one uplink.',
 'Network plan':'Camera and viewer require a permitted session. Keep production control independent of the reporting uplink.',
 'I/O list':'Photoeye output → PLC input I0. Count at the rising transition. Record the terminal used in the final design.',
 'Interface control document':'Pallet completion → order posting → acknowledgement. A retry retains the original pallet key.',
 'Risk register':'Duplicate inventory after an acknowledgement timeout. Detect by comparing accepted postings and physical pallet IDs.',
 'Punch list':'Check that the retained input does not increment at every scan. Close against a recorded retest.',
 'As-built record':'Record final mount position, units, belt speed, terminal, tag and network path after SAT.',
 'Operator instructions':'If vacuum is lost, preserve the first-out event. Restore the cause, verify the handshake and reset.',
 'Shift handover':'Record the last accepted order, outstanding acknowledgements, open incidents and who owns the next test.'};
const key='oia-register-standalone-v1';
let packet,reg,index=0;
try{packet=JSON.parse(sessionStorage.getItem(inbound)||'null');}catch{}
const initial=()=>({version:1,rows:definitions.map(([measure,need,asset,procedure,phase],i)=>({id:'REQ-'+(i+1),revision:1,measure,need,asset,procedure,phase})),results:[],docs:{...templates},revisions:[]});
try{reg=packet?(packet.register||initial()):JSON.parse(sessionStorage.getItem(key)||'null')||initial();}catch{reg=initial();}
const stages=['Factory acceptance test','Site acceptance test','Integrated commissioning'];
const textField=(record,key,max)=>typeof record?.[key]==='string'&&record[key].length<=max;
const rowShape=row=>row&&textField(row,'id',32)&&Number.isSafeInteger(row.revision)&&row.revision>=0&&
  textField(row,'need',450)&&textField(row,'procedure',500)&&textField(row,'asset',80)&&stages.includes(row.phase)&&Object.hasOwn(titles,row.measure);
const valid=reg?.version===1&&Array.isArray(reg.rows)&&reg.rows.length>0&&reg.rows.length<=80&&reg.rows.every(rowShape)&&
  Array.isArray(reg.results)&&reg.results.length<=256&&reg.results.every(r=>rowShape(r)&&['PASS','FAIL'].includes(r.outcome)&&Number.isSafeInteger(r.scan)&&
    ['tester','witness','authority','observation','action'].every(k=>textField(r,k,600)))&&
  reg.docs&&Object.keys(templates).every(k=>textField(reg.docs,k,5000))&&Array.isArray(reg.revisions)&&reg.revisions.length<=150&&
  reg.revisions.every(r=>r&&Object.hasOwn(templates,r.name)&&textField(r,'previous',5000));
if(!valid){reg=initial();$('status').textContent='Invalid register rejected. The training register is open.';}
function store(){const json=JSON.stringify(reg);if(json.length>200000)throw Error('Register is full. Export before starting another.');sessionStorage.setItem(packet?outbound:key,json);}
function act(fn){try{fn();}catch(e){$('status').textContent=e.message;}}
for(const [id,label] of Object.entries(titles))$('measure').add(new Option(label,id));
for(const asset of packet?.assets||[])$('assets').append(new Option(String(asset)));
for(const name of Object.keys(templates))$('document').add(new Option(name));
function show(){
 $('entry').replaceChildren(...reg.rows.map((row,i)=>new Option(row.id+' · revision '+row.revision,i)));$('entry').value=String(index);
 for(const field of ['need','asset','procedure','phase','measure'])$(field).value=reg.rows[index][field];
 $('body').value=reg.docs[$('document').value]||'';
 $('history').textContent=reg.results.filter(r=>r.id===reg.rows[index].id).map(r=>r.outcome+' · scan '+r.scan+' · '+r.id+' rev '+r.revision+'\n'+r.observation+'\nTester '+r.tester+' / witness '+r.witness+' / authority '+r.authority+'\n'+r.action).join('\n\n');
 $('source').textContent=packet?'Measurements captured from the packaging cell at scan '+packet.scan+'.':'Open this register from the packaging cell to capture a live test result.';
}
$('new').onclick=()=>act(()=>{if(reg.rows.length>=80)throw Error('Requirement limit reached.');index=reg.rows.length;reg.rows.push({id:'REQ-'+(index+1),revision:0,need:'',asset:'',procedure:'',phase:'Factory acceptance test',measure:'travel'});show();$('need').focus();});
$('save').onclick=()=>act(()=>{const row=reg.rows[index],next={...row,revision:row.revision+1};for(const field of ['need','asset','procedure','phase','measure']){next[field]=$(field).value.trim();if(!next[field])throw Error('Complete the requirement, allocation and procedure.');}reg.rows[index]=next;store();show();$('status').textContent='Saved '+next.id+' revision '+next.revision+'.';});
$('capture').onclick=()=>act(()=>{const row=reg.rows[index],check=packet?.checks?.find(c=>c.id===row.measure);if(!check||!row.revision)throw Error('Open a saved requirement from the current packaging cell.');
 if(['need','asset','procedure','phase','measure'].some(k=>$(k).value.trim()!==row[k]))throw Error('Save the edited revision before capturing its test.');
 const roles=['tester','witness','authority'].map(k=>$(k).value.trim());if(roles.some(v=>!v)||new Set(roles.map(v=>v.toLowerCase())).size!==3)throw Error('Enter three distinct commissioning roles.');
 if(reg.results.length>=256)throw Error('Test record limit reached.');
 const action=$('action').value.trim();if(!check.pass&&!action)throw Error('Record the symptom and the next corrective action.');
 reg.results.push({...row,tester:roles[0],witness:roles[1],authority:roles[2],scan:packet.scan,outcome:check.pass?'PASS':'FAIL',observation:check.pass?titles[row.measure]:check.reason,action});store();show();$('status').textContent='Test retained.';});
$('record').onclick=()=>act(()=>{if(reg.revisions.length>=150)throw Error('Document revision limit reached.');const name=$('document').value,body=$('body').value.trim();if(!body)throw Error('Enter document content.');reg.revisions.push({name,previous:reg.docs[name],scan:packet?.scan??null});reg.docs[name]=body;store();$('status').textContent='Document revision saved.';});
$('entry').onchange=()=>{index=Number($('entry').value);show();};$('document').onchange=()=>{$('body').value=reg.docs[$('document').value];};
$('return').onclick=e=>{try{store();}catch(err){e.preventDefault();$('status').textContent=err.message;}};
$('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(reg,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='commissioning-register.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);};
show();

document.querySelector('main').inert = false;
