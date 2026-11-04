const requireValue=(condition,message)=>{if(!condition)throw Error(message);};
const finite=(v,lo,hi)=>Number.isFinite(v)&&v>=lo&&v<=hi;
export const drawings={
  A:{id:'A',title:'Conveyor photoeye mount',width:100,height:50,wall:6,depth:24,tolerance:.15,volumeTolerance:.15},
  B:{id:'B',title:'Inspection camera stop',width:75,height:60,wall:4.5,depth:32,tolerance:.10,volumeTolerance:.10}
};
export function drawingBrief(data){
  requireValue(data&&typeof data.title==='string'&&data.title.trim().length>0&&data.title.length<=72,'Name the drawing in 1 to 72 characters.');
  const {width,height,wall,depth,tolerance,volumeTolerance}=data;
  requireValue(finite(width,25,400)&&finite(height,20,250)&&finite(depth,5,100),'Width must be 25-400 mm, height 20-250 mm and depth 5-100 mm.');
  requireValue(finite(wall,2,Math.min(width,height)/3),'Choose a wall at least 2 mm and no more than one third of the shorter side.');
  requireValue(finite(tolerance,.01,.5)&&finite(volumeTolerance,.005,.5),'Use a dimensional tolerance of 0.01-0.50 mm and volume tolerance of 0.005-0.50 cm³.');
  const out={title:data.title.trim(),width,height,wall,depth,tolerance,volumeTolerance};
  const fixed=Object.values(drawings).find(d=>Object.keys(out).every(k=>out[k]===d[k]));return {id:fixed?.id||'custom',...out};
}
const round=n=>Math.round(n*1000)/1000;
export function angleProfile(w,h,t,x=0,z=0){return [[0,0],[w,0],[w,t],[t,t],[t,h],[0,h]].map(([a,b])=>[round(a+x),round(b+z)]);}
export function startingPart(brief){
  const d=drawingBrief(brief);
  return {version:1,kind:'extrude',profile:angleProfile(d.width*.8,d.height*.80,d.wall*.75),depth:round(d.depth*.72),tolerance:d.tolerance,axisX:-5,snap:1};
}
export function targetVolume(d){return (d.width+d.height-d.wall)*d.wall*d.depth/1000;}
export function attempt(brief){const b=drawingBrief(brief);return {brief:b,start:startingPart(b),prediction:null,edited:false};}
export function geometryKey(p){return JSON.stringify([p.kind,p.profile,p.depth,p.axisX]);}
export function recordPrediction(a,value){
  requireValue(!a.edited,'Start another attempt to revise a prediction after editing.');
  requireValue(finite(value,.001,100000),'Enter a positive predicted volume in cm³.');
  a.prediction=value;
}
export function checkBracket(a,part){
  const d=drawingBrief(a.brief),p=part.profile;
  requireValue(Array.isArray(p)&&p.length>=3&&p.length<=48&&p.every(v=>Array.isArray(v)&&v.length===2&&v.every(Number.isFinite)),'Invalid measured profile.');
  const xs=p.map(v=>v[0]),zs=p.map(v=>v[1]),left=Math.min(...xs),bottom=Math.min(...zs),w=Math.max(...xs)-left,h=Math.max(...zs)-bottom;
  const area=Math.abs(p.reduce((sum,[x,z],i)=>{const next=p[(i+1)%p.length];return sum+x*next[1]-z*next[0];},0))/2;
  const volume=area*part.depth/1000,nominal=targetVolume(d),corners=angleProfile(d.width,d.height,d.wall,left,bottom);
  const near=(v,target,tol)=>Number.isFinite(v)&&Math.abs(v-target)<=tol+1e-9;
  const shape=part.kind==='extrude'&&p.length===6&&corners.every(([x,z])=>p.some(([u,v])=>near(x,u,d.tolerance)&&near(z,v,d.tolerance)));
  const checks=[
    ['Geometry edited',a.edited&&geometryKey(part)!==geometryKey(a.start),'Starter geometry must change.'],
    ['Extruded angle section',shape,'Six orthogonal corners with both walls '+d.wall+' mm.'],
    ['Width',near(w,d.width,d.tolerance),round(w)+' mm / '+d.width+' mm'],
    ['Height',near(h,d.height,d.tolerance),round(h)+' mm / '+d.height+' mm'],
    ['Depth',near(part.depth,d.depth,d.tolerance),round(part.depth)+' mm / '+d.depth+' mm'],
    ['Calculated volume',near(volume,nominal,d.volumeTolerance),round(volume)+' cm³ / '+round(nominal)+' cm³'],
    ['Prior prediction',near(a.prediction,nominal,d.volumeTolerance),a.prediction===null?'Record a prediction before editing.':a.prediction+' cm³ / '+round(nominal)+' cm³']
  ];
  return {pass:checks.every(([,ok])=>ok),checks,measured:{width:w,height:h,depth:part.depth,areaMM2:area,volumeCM3:volume}};
}
export function mountedRecord(a,part,scan){
  requireValue(a?.start&&geometryKey(a.start)===geometryKey(startingPart(a.brief)),'Practical starter is invalid.');
  const result=checkBracket(a,part);requireValue(result.pass&&typeof part.mount?.assetId==='string','Verify a conforming bracket before mounting.');
  return {drawing:drawingBrief(a.brief),predictedCM3:a.prediction,measured:result.measured,assetId:part.mount.assetId,scan,profile:part.profile.map(v=>[...v]),operation:part.kind};
}
