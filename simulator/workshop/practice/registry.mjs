import {inspection,observation} from './experiments.mjs';
const sigmoid=v=>1/(1+Math.exp(-Math.min(40,Math.max(-40,v))));
function check(ok,msg){if(!ok)throw Error(msg);}
export function registry(){return {version:1,active:'baseline',previous:null,releases:[],audit:[],observations:[]};}
export function candidate(r,{kind,seed,threshold,lighting=1,offset=0,falseAcceptCost=5}){
 check(['optical','condition'].includes(kind)&&Number.isInteger(seed)&&seed>=1&&seed<=99995,'Choose an integer starting run.');
 check(Number.isFinite(threshold)&&threshold>0&&threshold<1,'Threshold must be between 0 and 1.');
 check(r.audit.length<126,'Deployment audit full.');check(r.releases.length<10,'Ten saved models per study.');
 const fit=inspection({kind,seed,threshold,lighting,offset,falseAcceptCost});const id='M'+(r.releases.length+1);
 const release={id,kind,seed,threshold,weights:fit.weights,train:[...fit.trainingRuns],validation:fit.testRun,cost:fit.model.cost};
 r.releases.push(release);r.audit.push('Validated '+id+' on later run '+fit.testRun);return release;
}
export function activate(r,id){
 check(r.audit.length<126,'Deployment audit full.');check(r.releases.some(m=>m.id===id)&&id!==r.active,'Select a different registered version.');r.previous=r.active;r.active=id;r.audit.push('Deployed '+id);
}
export function rollback(r){
 check(r.audit.length<127,'Deployment audit full.');check(r.previous!==null,'Deploy a model before rollback.');const old=r.active;r.active=r.previous;r.previous=null;r.audit.push('Rolled back '+old+' to '+r.active);
}
export function inspectRelease(r,{id=r.active,run,kind,lighting=1,offset=0,threshold=0.5,falseAcceptCost=5}){
 check(['condition','optical'].includes(kind)&&Number.isFinite(lighting)&&lighting>=0.1&&lighting<=2&&Number.isFinite(offset)&&Math.abs(offset)<=16&&Number.isFinite(threshold)&&threshold>0&&threshold<1&&Number.isFinite(falseAcceptCost)&&falseAcceptCost>=0&&falseAcceptCost<=1000,'Invalid production inspection settings.');
 const m=r.releases.find(x=>x.id===id);check(id==='baseline'||m?.kind===kind,'The model does not match this instrument.');
 check(Number.isSafeInteger(run)&&run>0&&run<=100001&&(!m||run>m.validation),'Production run must be later than all training and validation runs.');
 const rows=[];let falseAccepts=0,falseRejects=0;
 for(let i=0;i<32;i++){
  const observationRow=observation(run,i,lighting,kind,offset),[a,b]=observationRow.features;
  const confidence=m?sigmoid(m.weights[0]+m.weights[1]*a+m.weights[2]*b):Math.min(1,kind==='condition'?b:a*6);
  const reject=confidence>=(m?.threshold??threshold);
  falseAccepts+=Number(!reject&&observationRow.defect);falseRejects+=Number(reject&&!observationRow.defect);
  rows.push({index:i,actual:observationRow.defect,reject,confidence});
 }
 return {id,run,rows,falseAccepts,falseRejects,cost:falseAccepts*falseAcceptCost+falseRejects};
}
export function dataset({kind,seed,lighting=1,offset=0}){
 check(['optical','condition'].includes(kind)&&Number.isInteger(seed)&&seed>=1&&seed<=99995,'Invalid dataset.');
 const runs=[];
 for(let step=0;step<6;step++){
  const role=step<4?'training':step===4?'validation':'later production';
  const run=seed+step,rows=[];
  for(let i=0;i<(step<4?20:32);i++){
   const x=observation(run,i,step<4?0.9+(run%3)*0.1:lighting,kind,step<4?0:offset);
   rows.push({index:i,tSequence:step*100+i,label:x.defect?'defect':'normal',features:x.features,data:Array.from(x.pixels||x.samples)});
  }runs.push({run,role,rows});
 }
 return {format:'synthetic-inspection-dataset/1',kind,dimensions:kind==='optical'?[32,24]:[128],runs};
}
export function restoreRegistry(doc){
 const r=registry();if(!doc)return r;
 check(doc.version===1&&Array.isArray(doc.releases)&&doc.releases.length<=10&&Array.isArray(doc.audit)&&doc.audit.length<=128,'Invalid model register.');
 for(const m of doc.releases){check(m.id==='M'+(r.releases.length+1)&&['optical','condition'].includes(m.kind)&&Number.isInteger(m.seed)&&Array.isArray(m.weights)&&m.weights.length===3&&m.weights.every(Number.isFinite)&&m.validation===m.seed+4&&m.threshold>0&&m.threshold<1,'Invalid trained model.');r.releases.push(structuredClone(m));}
 const ids=['baseline',...r.releases.map(v=>v.id)];
 check(ids.includes(doc.active)&&(doc.previous===null||ids.includes(doc.previous))&&doc.audit.every(v=>typeof v==='string'&&v.length<=130),'Invalid deployment history.');
 r.active=doc.active;r.previous=doc.previous;r.audit=[...doc.audit];
 const rows=doc.observations||[];check(Array.isArray(rows)&&rows.length<=48,'Invalid deployment observations.');
 for(const a of rows){
  check(a&&Number.isInteger(a.after)&&a.after>=0&&a.after<=r.audit.length&&ids.includes(a.id),'Invalid deployment evidence.');
  const result=inspectRelease(r,a);r.observations.push({id:result.id,kind:a.kind,run:a.run,lighting:a.lighting,offset:a.offset,threshold:a.threshold,falseAcceptCost:a.falseAcceptCost,after:a.after,falseAccepts:result.falseAccepts,falseRejects:result.falseRejects,cost:result.cost});
 }
 return r;
}

export function observeDeployment(r,settings){
 check(r.observations.length<48,'Deployment observation log full.');
 const params={kind:settings.kind,run:settings.run,lighting:settings.lighting??1,offset:settings.offset??0,threshold:settings.threshold??0.5,falseAcceptCost:settings.falseAcceptCost??5};
 const q=inspectRelease(r,params);
 r.observations.push({...params,id:q.id,after:r.audit.length,falseAccepts:q.falseAccepts,falseRejects:q.falseRejects,cost:q.cost});
 return q;
}
export function deploymentAssessment(r){
 for(let i=0;i<r.audit.length;i++){
  const rolled=/^Rolled back (M\d+) to (baseline|M\d+)$/.exec(r.audit[i]);if(!rolled)continue;
  const [,candidate,previous]=rolled;const deployed=r.audit.slice(0,i).lastIndexOf('Deployed '+candidate);if(deployed<0)continue;
  for(const before of r.observations.filter(x=>x.id===previous&&x.after<=deployed)){
   const match=x=>['kind','run','lighting','offset','threshold','falseAcceptCost'].every(k=>x[k]===before[k]);
   const during=r.observations.find(x=>x.id===candidate&&x.after>deployed&&x.after<=i&&match(x));
   const after=r.observations.find(x=>x.id===previous&&x.after>i&&match(x)&&x.falseAccepts===before.falseAccepts&&x.falseRejects===before.falseRejects&&x.cost===before.cost);
   if(during&&after)return {pass:true,reason:'Run '+before.run+': '+previous+' cost '+before.cost+', '+candidate+' cost '+during.cost+', restored cost '+after.cost+'. Identical run, labels and operating conditions.'};
  }
 }
 return {pass:false,reason:'Evaluate the current detector first, deploy and evaluate a candidate on that same later production run, then roll back and repeat without changing the settings.'};
}
