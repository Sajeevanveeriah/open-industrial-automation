import {articulate} from './assembly.mjs';
const check=(condition,message)=>{if(!condition)throw Error(message);};
export function validateFootprint(points){
  check(Array.isArray(points)&&points.length>=3&&points.length<=16,'Use 3 to 16 convex footprint vertices.');
  for(const p of points)check(Array.isArray(p)&&p.length===2&&p.every(v=>Number.isFinite(v)&&Math.abs(v)<=.5),'Footprint coordinates range from -0.5 to 0.5.');
  let orientation=0;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dy=b[1]-a[1];
    for(let j=0;j<points.length;j++){
      if(i===j||(i+1)%points.length===j)continue;
      const cross=dx*(points[j][1]-a[1])-dy*(points[j][0]-a[0]);
      check(Math.abs(cross)>1e-8,'Duplicate or collinear footprint vertices.');
      orientation||=Math.sign(cross);check(orientation*cross>0,'Use a convex perimeter in clockwise or anticlockwise order.');
    }
  }
  return points;
}
const box=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]];
export function footprint(p){
  const phi=p.yaw*Math.PI/180,c=Math.cos(phi),s=Math.sin(phi);
  return (p.proxy||box).map(([u,v])=>[p.x+c*u*p.length-s*v*p.width,p.y+s*u*p.length+c*v*p.width]);
}
export function gap(a,b){
  let best=Math.max(a.z-b.z-b.height,b.z-a.z-a.height);
  const pa=footprint(a),pb=footprint(b);
  for(const polygon of [pa,pb])for(let i=0;i<polygon.length;i++){
    const u=polygon[i],v=polygon[(i+1)%polygon.length],dx=v[0]-u[0],dy=v[1]-u[1],len=Math.hypot(dx,dy);
    const project=p=>(p[0]*dy-p[1]*dx)/len;
    const A=pa.map(project),B=pb.map(project);
    best=Math.max(best,Math.min(...A)-Math.max(...B),Math.min(...B)-Math.max(...A));
  }
  return best;
}
export function checkTimeline(layout){
  const keys=layout.motion??[], joints=(layout.joints||[]).filter(j=>j.kind!=='fixed');
  for(const p of layout.parts)if(p.proxy)validateFootprint(p.proxy);
  check(Array.isArray(keys)&&keys.length<=40,'At most 40 keyframes.');
  for(const [i,key] of keys.entries()){
    check(Number.isFinite(key.t)&&key.t>=0&&key.t<=60&&(i?key.t-keys[i-1].t>=.00999999:key.t===0),'Start at 0 s; use unique times at least 0.01 s apart, up to 60 s.');
    check(key.interpolation==='linear'||key.interpolation==='hold','Unsupported interpolation.');
    check(Array.isArray(key.values)&&key.values.length===joints.length&&key.values.length<=48,'Keyframes must match the movable joints. Clear the timeline before changing joint topology.');
    const ids=new Set();for(const pair of key.values){check(Array.isArray(pair)&&pair.length===2&&!ids.has(pair[0]),'Repeated or malformed joint key.');ids.add(pair[0]);const j=joints.find(j=>j.child===pair[0]);check(j&&Number.isFinite(pair[1])&&pair[1]>=j.min&&pair[1]<=j.max,'Joint key outside configured travel.');}
  }
  return keys;
}
export function recordKey(layout,t,interpolation){
  const joints=(layout.joints||[]).filter(j=>j.kind!=='fixed');check(joints.length>0&&joints.length<=48,'Attach 1 to 48 movable joints first.');
  const key={t,interpolation,values:joints.map(j=>[j.child,j.value])},next=(layout.motion||[]).filter(k=>k.t!==t);next.push(key);
  const candidate={...layout,motion:next.sort((a,b)=>a.t-b.t)};checkTimeline(candidate);layout.motion=candidate.motion;
}
function at(layout,t,keys){
  const next=structuredClone({...layout,motion:undefined}),joints=next.joints||[];
  let i=0;while(i<keys.length-1&&keys[i+1].t<=t)i++;
  const a=keys[i],b=keys[Math.min(i+1,keys.length-1)],blend=a===b||a.interpolation==='hold'?0:(t-a.t)/(b.t-a.t);
  const B=new Map(b.values);for(const [id,v] of a.values)joints.find(j=>j.child===id).value=v+(B.get(id)-v)*blend;
  return articulate(next);
}
export function poseAt(layout,t){
  const keys=checkTimeline(layout);check(keys.length&&Number.isFinite(t)&&t>=0&&t<=keys.at(-1).t,'Time outside authored sequence.');return at(layout,t,keys);
}
function speedBound(parts,joints,first,last,duration){
  const before=new Map(first.values),after=new Map(last.values),byChild=new Map(joints.map(j=>[j.child,j]));
  return parts.map(p=>{
    let reach=Math.hypot(p.length,p.width)/2,speed=0,id=p.id,j;
    while((j=byChild.get(id))){
      const swing=Math.hypot(j.dx-j.pivotX,j.dy-j.pivotY);
      const rate=j.kind==='fixed'?0:Math.abs(after.get(id)-before.get(id))/duration;
      if(j.kind==='revolute')speed+=(reach+swing)*rate*Math.PI/180;
      if(j.kind==='prismatic')speed+=rate;
      reach+=swing+Math.hypot(j.pivotX,j.pivotY)+(j.kind==='prismatic'?Math.max(Math.abs(before.get(id)),Math.abs(after.get(id))):0);
      id=j.parent;
    }
    return speed;
  });
}
export function sweep(layout){
  const keys=checkTimeline(layout);check(keys.length>=2,'Capture at least two timed poses.');
  const ids=layout.parts.filter(p=>!['room','cell'].includes(p.kind)).map(p=>p.id);
  check(ids.length<=32&&(keys.length-1)*ids.length*(ids.length-1)/2<=9000,'Sweep supports up to 32 solids and 9,000 pair-segments.');
  const pairs=[];for(let i=0;i<ids.length;i++)for(let k=i+1;k<ids.length;k++)pairs.push([i,k]);
  let count=0,uncertain=null;
  for(let frame=1;frame<keys.length;frame++){
    const a=keys[frame-1],b=keys[frame],duration=b.t-a.t,cache=new Map();
    function solids(t){if(!cache.has(t)){
      const state=at(layout,t,keys),parts=new Map(state.parts.map(p=>[p.id,p]));if(cache.size>=256)cache.clear();cache.set(t,ids.map(id=>parts.get(id)));
    }return cache.get(t);}
    const start=solids(a.t),end=solids(b.t),speeds=speedBound(start,layout.joints,a,b,duration);
    for(const [i,j] of pairs){
      const pair=[ids[i],ids[j]],result=(status,time)=>({status,time,pair,checks:count});
      if(++count>20000)return result('unresolved',a.t);
      if(gap(start[i],start[j])<-.001)return result('collision',a.t);
      if(gap(end[i],end[j])<-.001)return result('collision',b.t);
      if(a.interpolation==='hold'||speeds[i]+speeds[j]===0)continue;
      const pending=[[a.t,b.t]];
      while(pending.length){
        const [lo,hi]=pending.pop(),mid=(lo+hi)/2;
        if(++count>20000)return result('unresolved',mid);
        const model=solids(mid),separation=gap(model[i],model[j]);
        if(separation<-.001)return result('collision',mid);
        if(separation+.001>=(speeds[i]+speeds[j])*(hi-lo)/2)continue;
        if(hi-lo<=.001){uncertain??=result('unresolved',mid);continue;}
        pending.push([mid,hi],[lo,mid]);
      }
    }
  }
  return uncertain||{status:'clear',checks:count};
}
