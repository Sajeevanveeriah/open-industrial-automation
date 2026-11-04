const requireThat=(valid,message)=>{if(!valid)throw Error(message);};
const limits=(n,lo,hi)=>Number.isFinite(n)&&n>=lo&&n<=hi;
export const features={bracket:'L-section sensor bracket',mount:'Revolved camera collar',guard:'Guard plate',conveyor:'Conveyor channel',extrude:'Custom closed profile extrusion',revolve:'Custom closed profile revolution'};
export const constraints={width:'Overall width (mm)',height:'Height (mm)',perimeter:'Enclosing perimeter (mm)',ratio:'Width / height ratio',equal:'Equal width and height'};
function equation(kind,value) {
  requireThat(Object.hasOwn(constraints,kind)&&limits(value,0.001,10000),'Enter a positive constraint value.');
  return {width:[1,0,value],height:[0,1,value],perimeter:[2,2,value],ratio:[1,-value,0],equal:[1,-1,0]}[kind];
}
const revolved=kind=>kind==='mount'||kind==='revolve';
function freeSketch(design){
  const raw=design.profile;
  requireThat(Array.isArray(raw)&&raw.length>=3&&raw.length<=48,'Use 3 to 48 straight-edged sketch vertices.');
  requireThat(raw.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>limits(n,-2000,2000))),'Sketch coordinates must be finite millimetres within ±2000.');
  requireThat(limits(design.depth,.1,2000)&&limits(design.tolerance,.001,10),'Check extrusion depth and tolerance.');
  const points=raw.map(p=>[...p]);if(points[0][0]===points.at(-1)[0]&&points[0][1]===points.at(-1)[1])points.pop();
  requireThat(points.length>=3&&new Set(points.map(p=>p.join(','))).size===points.length,'Sketch has duplicated vertices.');
  const signed=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  const within=(v,a,b)=>v>=Math.min(a,b)-1e-8&&v<=Math.max(a,b)+1e-8;
  const on=(p,a,b)=>Math.abs(signed(a,b,p))<1e-8&&within(p[0],a[0],b[0])&&within(p[1],a[1],b[1]);
  let area=0;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],c=points[(i+2)%points.length];
    requireThat(Math.abs(signed(a,b,c))>1e-8,'Remove collinear sketch vertices.');
    area+=a[0]*b[1]-a[1]*b[0];
    for(let j=i+2;j<points.length;j++){
      if(i===0&&j===points.length-1)continue;
      const c=points[j],d=points[(j+1)%points.length];
      const crosses=signed(a,b,c)*signed(a,b,d)<0&&signed(c,d,a)*signed(c,d,b)<0;
      requireThat(!crosses&&![on(a,c,d),on(b,c,d),on(c,a,b),on(d,a,b)].some(Boolean),'Sketch edges intersect.');
    }
  }
  requireThat(Math.abs(area)>1e-6,'Zero-area sketch.');if(area<0)points.reverse();
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
  const rev=revolved(design.kind);
  if(rev)requireThat(xmin>.001,'Revolved profiles must remain on the positive radial side of the axis.');
  return {w:rev?2*xmax:xmax-xmin,h:ymax-ymin,profile:points,originX:rev?0:xmin,originZ:ymin};
}
export function solve(def) {
  if(def?.kind==='extrude'||def?.kind==='revolve')return freeSketch(def);
  requireThat(def&&Object.hasOwn(features,def.kind)&&Array.isArray(def.constraints)&&def.constraints.length>=2&&def.constraints.length<=3,'Choose a feature and two or three dimensions.');
  const rows=def.constraints.map(c=>equation(c.kind,c.value));
  let solution=null;
  for(let i=0;i<rows.length&&!solution;i++)for(const [a,b,k] of rows.slice(i+1)){
    const [x,y,d]=rows[i],det=x*b-y*a;
    if(Math.abs(det)>1e-10){solution=[(d*b-k*y)/det,(x*k-a*d)/det];break;}
  }
  requireThat(solution,'Under-constrained sketch: the dimensions do not independently fix width and height.');
  const [w,h]=solution;
  requireThat(rows.every(([a,b,v])=>Math.abs(a*w+b*h-v)<1e-7),'Conflicting dimensions: the third constraint disagrees with the solved sketch.');
  requireThat(limits(w,2,2000)&&limits(h,2,2000),'Solved dimensions must lie between 2 and 2,000 mm.');
  requireThat(limits(def.depth,0.1,2000)&&limits(def.wall,.1,Math.min(w,h)/2-.001)&&limits(def.tolerance,.001,10),'Check feature depth, wall thickness and bilateral tolerance.');
  const t=def.wall;
  const profile=def.kind==='bracket'?[[0,0],[w,0],[w,t],[t,t],[t,h],[0,h]]:
    def.kind==='conveyor'?[[0,0],[w,0],[w,h],[w-t,h],[w-t,t],[t,t],[t,h],[0,h]]:
    def.kind==='mount'?[[w/2-t,0],[w/2,0],[w/2,h],[w/2-t,h]]:[[0,0],[w,0],[w,h],[0,h]];
  return {w,h,profile};
}
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function triangulate(points){
  const remaining=points.map((_,i)=>i),faces=[];
  while(remaining.length>3){
    let found=false;
    for(let j=0;j<remaining.length;j++){
      const a=remaining[(j+remaining.length-1)%remaining.length],b=remaining[j],c=remaining[(j+1)%remaining.length];
      if(cross(points[a],points[b],points[c])<=0)continue;
      const inside=remaining.some(k=>![a,b,c].includes(k)&&[[a,b],[b,c],[c,a]].every(([u,v])=>cross(points[u],points[v],points[k])>=0));
      if(inside)continue;
      faces.push(a,b,c);remaining.splice(j,1);found=true;break;
    }
    requireThat(found,'Profile cannot be triangulated.');
  }
  return [...faces,...remaining];
}
export function generate(def) {
  const {profile}=solve(def),p=[],i=[],count=profile.length,rev=revolved(def.kind),slices=rev?64:2;
  for(let s=0;s<slices;s++)for(const [u,v] of profile){
    const angle=2*Math.PI*s/slices;
    const xyz=rev?[u*Math.cos(angle),u*Math.sin(angle),v]:[u,s*def.depth,v];
    p.push(...xyz.map(n=>n/1000));
  }
  for(let s=0;s<(rev?slices:1);s++){
    const row=s*count,next=(s+1)%slices*count;
    for(let k=0;k<count;k++){const j=(k+1)%count;i.push(row+k,next+k,next+j,row+k,next+j,row+j);}
  }
  if(!rev){
    const cap=triangulate(profile);for(let j=0;j<cap.length;j+=3){const [a,b,c]=cap.slice(j,j+3);i.push(a,b,c,count+c,count+b,count+a);}
  }
  return {name:features[def.kind],p,i};
}
export function drawing(rev){
  const {design,number}=rev,{w,h,profile,originX=0,originZ=0}=solve(design);
  requireThat(Number.isInteger(number)&&number>=1&&number<=24,'Invalid revision.');
  const sc=Math.min(390/w,180/h);
  const ring=revolved(design.kind),project=coordinates=>coordinates.map(([u,v])=>[80+(ring?w/2+u:u-originX)*sc,245-(v-originZ)*sc].join(',')).join(' ');
  const poly=project(profile);
  const x=80+w*sc,y=245-h*sc, tol=design.tolerance;
  return '<svg xmlns="http://www.w3.org/2000/svg" width="580" height="355" viewBox="0 0 580 355" role="img" aria-label="Dimensioned section drawing"><rect width="580" height="355" fill="white"/><g fill="#173a3d" font-family="sans-serif"><text x="24" y="33" font-size="20">'+features[design.kind]+' / Rev '+number+'</text><polygon points="'+poly+'" fill="#cce2dc" stroke="#23514c" stroke-width="2"/>'+ (ring?'<polygon points="'+project(profile.map(([x,z])=>[-x,z]))+'" fill="#cce2dc" stroke="#23514c"/><line x1="'+(80+w*sc/2)+'" x2="'+(80+w*sc/2)+'" y1="50" y2="253" stroke="#607b72" stroke-dasharray="5 4"/>':'') +'<path d="M80 253v20m0 -9H'+x+'m0 -11v20 M'+(x+8)+' '+y+'h20m-10 0V245m-10 0h20" fill="none" stroke="#23514c"/><text x="80" y="293">'+(ring?'Outside diameter ':'Width ')+w.toFixed(2)+' ± '+tol+' mm</text><text x="'+(x+30)+'" y="'+(y+20)+'">'+h.toFixed(2)+' mm</text><text x="24" y="327">'+(ring?'Full revolution · axis Z':'Extrusion '+design.depth+' mm')+(design.kind==='extrude'||design.kind==='revolve'?'':' · wall '+design.wall+' mm')+' · dimensions govern</text></g></svg>';
}
export function revision(book,design,reason) {
  requireThat(Array.isArray(book)&&book.length<24,'Drawing register is full.');
  requireThat(typeof reason==='string'&&reason.trim().length>0&&reason.length<=160,'Record the design reason before issuing the drawing.');
  solve(design);return {number:book.length+1,design:structuredClone(design),reason:reason.trim()};
}
export function inspectFit(rev,measured){
  const {w}=solve(rev.design);requireThat(limits(measured,0,3000),'Enter a measured width in mm.');
  return {nominal:w,deviation:measured-w,pass:Math.abs(measured-w)<=rev.design.tolerance+1e-9};
}
