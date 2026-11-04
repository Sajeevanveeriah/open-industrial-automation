import {createProject,addCarton,configure,connect,step,command,inspect,loadProject,saveProject} from '../model.mjs';

export const practicals={
 wiring:{title:'Find the missing PLC input',brief:'The photoeye sees the carton, but the counter stays at zero. Find which input terminal actually energises, then make the wiring and program agree.',prediction:'Which terminal will energise before you repair it?',options:['I0','I1','Neither'],hint:'Compare the I0 and I1 traces with the input selected in the PLC. You can rewire the field lead or change the program input.'},
 counting:{title:'Count one carton once',brief:'One carton holds the photoeye high across several scans. Measure the repeat count, then correct the executable controller and prove it on two separate cartons.',prediction:'How many increments will the faulty program make during this crossing?',options:['1','3','5','7'],hint:'A level can remain true across consecutive scans. Count the low-to-high transition and retain the previous state between scans.'},
 camera:{title:'Restore the camera feed',brief:'The camera has an active Ethernet link and the operator cannot view video. Locate the failing layer, repair its configuration and prove the application and access controls.',prediction:'Which test will expose the initial fault?',options:['VLAN path','Viewing permission','PoE supply'],hint:'A lit port proves physical link. Compare endpoint access VLANs, IP reachability and the identity permission independently.'},
 recovery:{title:'Recover one pallet and one posting',brief:'A vacuum pick fails. Restore the same carton, investigate its unconfirmed posting and deliver exactly one accepted inventory movement.',prediction:'When the repaired robot first places this pallet, how many ERP postings will have committed?',options:['0','1','2'],hint:'Repair the physical cause before resetting. Read the pallet status and committed inventory separately. Retry the original delivery with its existing key.'}
};
const check=(v,msg)=>{if(!v)throw Error(msg);};
export function makePractical(id,edition=1,token='',prior=null){
 check(Object.hasOwn(practicals,id)&&[1,2].includes(edition),'Unknown practical or case.');
 const p=createProject('reference',edition),alt=edition===2;
 if(id==='wiring'){
  configure(p,'plc',{input:alt?'I1':'I0'});connect(p,'eye','out','plc',alt?'I0':'I1');
  if(alt)configure(p,'bracket',{x:1.5});
 }else if(id==='counting'){
  configure(p,'plc',{mode:'level'});if(alt){configure(p,'eye',{width:0.175});connect(p,'eye','out','plc','I1');configure(p,'plc',{input:'I1'});}
 }else if(id==='camera'){
  configure(p,'switch',alt?{vlan1:32,vlan2:32}:{vlan1:40});
  if(alt)configure(p,'camera',{permitted:false});
 }else{
  configure(p,'robot',{vacuum:false,target:alt?1.75:2});configure(p,'erp',{online:!alt,dropAck:true});command(p,'releaseOrder',{id:alt?'ORDER-TRANSFER':'ORDER-RECOVERY'});
 }
 p.learning.studioPractical={id,edition,token,prior,observed:null,proof:null,last:null};return p;
}
const at=(p,type)=>p.assets.find(a=>a.type===type);
const lot=(p)=>p.learning.studioPractical.edition===1?'INTAKE-GUIDED':'INTAKE-TRANSFER';
export function caseSettings(p){
 const t=p.learning.studioPractical;return t.id==='wiring'?'PLC configured input '+at(p,'plc').input+' · beam '+at(p,'bracket').x+' m'
 :t.id==='counting'?'Beam footprint '+at(p,'sensor').width+' m · belt '+at(p,'conveyor').speed+' m/s · 100 ms scan'
 :t.id==='camera'?'Compare switch access ports p1 and p2, then inspect the camera identity.'
 :'Order '+p.runtime.order+' · pick '+at(p,'robot').target+' m · ERP '+(at(p,'erp').online?'online':'offline')+'.';
}
function crossing(p){
 const belt=at(p,'conveyor'),bracket=at(p,'bracket'),eye=at(p,'sensor'),pos=bracket.x+eye.x;
 check(pos>0&&pos+eye.width<=belt.length,'Place the full beam inside the conveyor before testing.');
 const samples=Math.ceil((pos+eye.width)/(belt.speed*0.1))+2;check(samples>=2&&samples<=1000,'Choose a crossing within 100 seconds.');
 const c=addCarton(p,lot(p)),start=p.runtime.count,rows=[];for(let i=0;i<samples;i++){step(p);rows.push({...p.runtime.scans.at(-1)});}
 const high=field=>rows.filter(r=>r[field]).length;
 const energised=rows.filter(r=>r.I0||r.I1);
 return {carton:c.id,detected:c.detected,edgeCounted:energised.length>0&&energised.every(r=>r.count===start+1),increment:p.runtime.count-start,I0:high('I0'),I1:high('I1'),programHigh:high('input'),rows:rows.filter((r,i)=>r.I0||r.I1||rows[i-1]?.I0||rows[i-1]?.I1).slice(0,12)};
}
function sampleCamera(p){const n=inspect(p).network;return {power:n.power,link:n.link,reachable:n.reachable,video:n.video,reason:n.reason};}
function recovery(p){
 const c=p.runtime.cartons[0],pal=p.runtime.pallets.find(v=>v.carton===c?.id);
 return {carton:c?.id??null,lot:c?.lot??null,firstOut:p.runtime.firstOut?.reason??null,repaired:c?.recovery?.reason??null,pallet:pal?.id??null,order:pal?.order??p.runtime.order,status:pal?.status??null,attempts:pal?.attempts??0,lostAckAt:pal?.lostAckAt??null,confirmedAt:pal?.confirmedAt??null,postings:p.runtime.postings.length,units:p.runtime.postings.reduce((n,r)=>n+r.quantity,0)};
}
export function diagnose(p,prediction){
 const t=p.learning.studioPractical;check(practicals[t.id].options.includes(prediction),'Choose a prediction before measuring.');
 check(!t.observed,'Fault evidence is already captured. Test your repair or restart this case.');
 let evidence,answer,expectedFault;
 if(t.id==='wiring'||t.id==='counting'){
  evidence=crossing(p);const terminal=evidence.I0>0?'I0':evidence.I1>0?'I1':'Neither';
  answer=t.id==='wiring'?terminal:String(evidence.increment);
  expectedFault=t.id==='wiring'?evidence.detected!==null&&terminal!=='Neither'&&evidence.increment===0:evidence.increment===evidence.programHigh&&evidence.increment===(t.edition===1?5:7);
 }else if(t.id==='camera'){evidence=sampleCamera(p);answer=evidence.reachable?'Viewing permission':evidence.power?'VLAN path':'PoE supply';expectedFault=evidence.link&&!evidence.video;}
 else{
  if(!p.runtime.cartons.length)addCarton(p,lot(p));
  for(let n=0;n<300&&!p.runtime.firstOut;n++)step(p);
  evidence=recovery(p);expectedFault=p.runtime.firstOut?.category==='vacuum'&&evidence.pallet===null;
  answer=at(p,'erp').online?'1':'0';
 }
 const outcome={kind:'Fault measurement',prediction,answer,evidence,pass:Boolean(expectedFault&&prediction===answer)};
 t.last=outcome;
 if(outcome.pass)t.observed=outcome;
 return outcome;
}
export function prove(p){
 const t=p.learning.studioPractical;check(t.observed?.pass,'Measure the original fault with the correct prediction before testing a repair.');
 let evidence,pass;
 if(t.id==='wiring'||t.id==='counting'){
  const first=crossing(p),second=crossing(p);
  evidence={first,second};const required=t.id==='counting'?(t.edition===1?5:7):1;
  pass=[first,second].every(x=>x.detected!==null&&Math.max(x.I0,x.I1)>=required&&x.edgeCounted&&x.increment===1);
 }else if(t.id==='camera'){
  const actual=sampleCamera(p),clone=loadProject(saveProject(p));configure(clone,at(clone,'camera').id,{permitted:false});const denied=sampleCamera(clone);
  evidence={actual,denied};pass=actual.video&&denied.reachable&&!denied.video;
 }else{
  evidence=recovery(p);const pal=p.runtime.pallets[0],record=p.runtime.postings[0];
  pass=p.runtime.pallets.length===1&&evidence.repaired==='Vacuum pickup failed'&&evidence.carton===t.observed.evidence.carton&&evidence.status==='confirmed'&&evidence.lostAckAt!==null&&evidence.confirmedAt>=evidence.lostAckAt&&evidence.attempts>=2&&evidence.postings===1&&evidence.units===1&&record?.pallet===pal?.id&&record?.lot===evidence.lot&&record?.order===evidence.order;
 }
 const outcome={kind:'Repair test',pass:Boolean(pass),evidence,scan:p.runtime.scan};t.last=outcome;
 if(outcome.pass)t.proof=outcome;return outcome;
}
export function transferCase(p){const t=p.learning.studioPractical;check(t.edition===1&&t.proof?.pass,'Prove the guided repair before transfer.');return makePractical(t.id,2,t.token,{observed:t.observed,proof:t.proof});}
export function recordPractical(p){
 const t=p.learning.studioPractical;
 check(t.edition===2&&t.prior?.proof?.pass&&t.observed?.pass&&t.proof?.pass,'Complete the changed case to record competence.');
 return {id:t.id,guided:t.prior,transfer:{observed:t.observed,proof:t.proof}};
}
