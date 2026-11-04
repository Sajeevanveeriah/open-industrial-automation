const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const need=(v,m)=>{if(!v)throw Error(m);};
export const roles=['Engineering','Corporate IT','Operations','Maintenance','Quality','Supply chain','Finance','Supplier'];
export const stages=['Requirements','Factory acceptance','Installation','Site acceptance','Integrated test','Operations','Retirement'];
export function mission(seed=1){
  need(integer(seed,0,100000),'Seed must be an integer from 0 to 100000.');
  const outage=180+((seed*73)%520),recordsPerMinute=1+(seed%3);
  return {seed,outage,recordsPerMinute,rto:8+seed%5,rpo:4+seed%3,hours:4000+100*(seed%11),lifetime:3+seed%3,archiveDays:90+30*(seed%3)};
}
export const defaultDesign={standby:'warm',independent:true,backupMinutes:5,restoreMinutes:18,testMinutes:3,unitCost:1800,downtimeCost:15,serviceHours:8};
export function evaluate(plan,spec){
  need(plan && ['single','warm','hot'].includes(plan.standby)&&typeof plan.independent==='boolean','Select a supported standby and power domain.');
  for(const [k,min,max] of [['backupMinutes',1,240],['restoreMinutes',1,240],['testMinutes',1,30],['unitCost',100,50000],['downtimeCost',1,10000],['serviceHours',1,100]])need(integer(plan[k],min,max),'Invalid '+k+' value.');
  const additional=plan.standby==='single'?0:1, independent=additional&&plan.independent;
  const transfer=plan.standby==='hot'?1:3;
  const restart=independent?transfer:plan.restoreMinutes;
  const recovery=restart+plan.testMinutes;
  const backupTime=Math.floor((spec.outage-1)/plan.backupMinutes)*plan.backupMinutes;
  const pointAge=independent?(plan.standby==='hot'?0:1):spec.outage-backupTime;
  const dataLoss=pointAge*spec.recordsPerMinute;
  const capex=(1+additional)*plan.unitCost+(independent?450:0);
  const annual=(1+additional)*plan.serviceHours*75+recovery*plan.downtimeCost;
  const total=capex+spec.lifetime*annual;
  return {recovery,backupTime,pointAge,dataLoss,capex,annual,total,
    availability:1-recovery/(spec.hours*60),pass:recovery<=spec.rto&&pointAge<=spec.rpo};
}
export const incidents=[
  {id:'vendor',role:'Supplier',question:'Support asks for a shared, unrestricted remote login to restore a reporting interface. What operational step comes first?',options:[['record','Record scope and preserve the logs. Ask Corporate IT for a time-limited, observed session.'],['share','Enable shared access and reconstruct the timeline afterwards.']],correct:'record',outcome:'The retained access trail identifies the vendor activity and its expiry.'},
  {id:'quality',role:'Quality',question:'The case count has recovered. Quality still sees a gap in the lot record. What happens to dispatch?',options:[['dispatch','Dispatch immediately using the recovered physical count.'],['hold','Hold affected lots. Trace their identifiers before releasing stock.']],correct:'hold',outcome:'Quality retains a release decision for the reconciled lot.'},
  {id:'maintenance',role:'Maintenance',question:'Both servers stopped during power distribution maintenance. Which evidence isolates the common cause?',options:[['power','Trace each supply to its independent upstream source and compare interruption times.'],['cpu','Replace the faster processor and repeat the application ping.']],correct:'power',outcome:'The power-domain evidence explains why a second host alone cannot establish resilience.'},
  {id:'supply',role:'Supply chain',question:'Inventory was posted while its receipt timed out. Which action avoids a second stock movement?',options:[['new','Generate a new order key for a quick resend.'],['same','Preserve the original posting key and reconcile the receiver ledger before retrying.']],correct:'same',outcome:'The same business key links the resend to the committed movement.'},
  {id:'finance',role:'Finance',question:'The lower capital quotation has a slower restore. What belongs in the approval?',options:[['life','Compare capital, annual labour and outage cost over the same service life.'],['price','Choose the lowest purchase price without testing recovery.']],correct:'life',outcome:'Finance can compare designs across a common time boundary.'},
  {id:'operations',role:'Operations',question:'The recorder responds to ping after a failover. Can production close the incident?',options:[['ping','Close it as soon as the echo reply returns.'],['retrieve','Retrieve a known recording and reconcile the expected event count.']],correct:'retrieve',outcome:'Application-level retrieval confirms the operator outcome.'}
];
export function newCase(seed=1){return {version:1,seed,design:{...defaultDesign},results:[],phase:0,assessments:[],retirement:null};}
export function estimate(c,design,prediction,alternative,reason){
  const m=mission(c.seed),a=evaluate(design,m),b=evaluate(alternative,m);
  need(Number.isFinite(prediction)&&prediction>=0,'Predict recovery time first.');
  need(typeof reason==='string'&&reason.trim().length>=8&&reason.length<=260,'Record the design trade-off.');
  need(a.capex!==b.capex||a.recovery!==b.recovery||a.pointAge!==b.pointAge,'Choose a materially different comparison.');
  need(c.results.length<24,'Case run register full.');
  c.design={...design};const r={design:{...design},alternative:{...alternative},prediction,reason:reason.trim(),observed:a,comparison:b};
  c.results.push(r);return r;
}
export function nextStage(c,stage,role,action){
  need(c.phase<stages.length-1&&stage===stages[c.phase],'Follow the recorded lifecycle order.');
  const decisions=[
    ['Engineering','allocate'],['Supplier','witness'],['Maintenance','trace'],
    ['Corporate IT','restore'],['Quality','reconcile'],['Operations','handover']
  ];
  const [who,what]=decisions[c.phase];const run=c.results.at(-1);
  if(stage==='Integrated test')need(run?.observed.pass&&Math.abs(run.prediction-run.observed.recovery)<=.01,'Recovery objectives and independent prediction must pass before integrated acceptance.');
  if(role!==who||action!==what)return false;
  c.phase++;return true;
}
export function respond(c,id,value){
  const q=incidents.find(i=>i.id===id);need(q&&q.options.some(([v])=>v===value),'Invalid case response.');
  need(c.assessments.length<80,'Response register full.');
  const pass=value===q.correct;c.assessments.push({id,value,pass});return pass;
}
export function retire(c,retain,exported,revoked,owner){
  const spec=mission(c.seed);
  need(c.phase===6,'Complete operational handover first.');
  need(integer(retain,0,3650)&&typeof exported==='boolean'&&typeof revoked==='boolean'&&roles.includes(owner),'Invalid retirement record.');
  const pass=retain>=spec.archiveDays&&exported&&revoked&&owner==='Corporate IT';
  c.retirement={retain,exported,revoked,owner,pass};return pass;
}
export function verifyCase(c){
  need(c?.version===1&&integer(c.phase,0,6)&&Array.isArray(c.results)&&c.results.length<=24&&Array.isArray(c.assessments)&&c.assessments.length<=80,'Invalid lifecycle case.');
  const spec=mission(c.seed);evaluate(c.design,spec);
  for(const r of c.results){evaluate(r.design,spec);evaluate(r.alternative,spec);need(typeof r.reason==='string'&&r.reason.length<=260&&Number.isFinite(r.prediction),'Invalid trial.');}
  for(const a of c.assessments)need(incidents.some(q=>q.id===a.id&&q.options.some(([v])=>v===a.value)),'Invalid case response.');
  return c;
}
export function applyCase(c,action,args){
  c.log??=[];need(c.log.length<140,'Lifecycle action limit reached.');
  const run={estimate,nextStage,respond,retire}[action];
  need(Object.hasOwn({estimate,nextStage,respond,retire},action)&&Array.isArray(args)&&args.length<=5,'Invalid lifecycle action.');
  const outcome=run(c,...args);c.log.push([action,structuredClone(args)]);return outcome;
}
export function openCase(raw){
  need(raw?.version===1&&Array.isArray(raw.log)&&raw.log.length<=140,'Invalid lifecycle journal.');
  const c=newCase(raw.seed);for(const entry of raw.log){need(Array.isArray(entry)&&entry.length===2,'Invalid lifecycle entry.');applyCase(c,entry[0],entry[1]);}
  return c;
}
export function packCase(c){return {version:1,seed:c.seed,log:c.log||[]};}
