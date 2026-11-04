import {solve,generate,drawing} from '../../cad/features.mjs';
import {createProject,addAsset,configure,loadProject,saveProject} from '../../model.mjs';
const check=(ok,msg)=>{if(!ok)throw Error(msg);};
export function initialPart(){
  const bracket={kind:'bracket',constraints:[{kind:'width',value:80},{kind:'height',value:50}],depth:25,wall:6,tolerance:.1};
  return {version:1,kind:'extrude',profile:solve(bracket).profile,depth:25,tolerance:.1,axisX:-5,snap:1,mount:null};
}
export function definition(p){
  check(p?.version===1&&['extrude','revolve'].includes(p.kind)&&Number.isFinite(p.axisX)&&Math.abs(p.axisX)<=2000&&[.1,.5,1,2,5,10].includes(p.snap),'Invalid part settings.');
  check(p.mount==null||(typeof p.mount==='object'&&typeof p.mount.assetId==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(p.mount.assetId)&&p.mount.frame==='bracket'&&p.mount.units==='m'),'Invalid cell mount.');
  check(Array.isArray(p.profile)&&p.profile.length>=3&&p.profile.length<=48&&p.profile.every(v=>Array.isArray(v)&&v.length===2&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<=2000)),'Invalid sketch profile.');
  return {kind:p.kind,depth:p.depth,tolerance:p.tolerance,profile:p.profile.map(([x,z])=>[p.kind==='revolve'?x-p.axisX:x,z])};
}
export function analyse(p){
  const def=definition(p),{profile}=solve(def),mesh=generate(def);
  const xs=p.profile.map(v=>v[0]),zs=p.profile.map(v=>v[1]),minX=Math.min(...xs),minZ=Math.min(...zs);
  let area2=0,firstMoment6=0;
  for(let i=0;i<profile.length;i++){const a=profile[i],b=profile[(i+1)%profile.length],cross=a[0]*b[1]-b[0]*a[1];area2+=cross;firstMoment6+=(a[0]+b[0])*cross;}
  const volumeMM3=p.kind==='extrude'?area2*p.depth/2:Math.PI*firstMoment6/3;
  return {mesh,width:Math.max(...xs)-minX,height:Math.max(...zs)-minZ,minX,minZ,areaMM2:area2/2,volumeMM3};
}
export function moveVertex(p,index,x,z,doSnap=true){
  check(Number.isInteger(index)&&index>=0&&index<p.profile.length,'Choose a sketch vertex.');
  const quantise=v=>doSnap?Number((Math.round(v/p.snap)*p.snap).toFixed(6)):v;
  const next=structuredClone(p);next.profile[index]=[quantise(x),quantise(z)];analyse(next);return next;
}
export function resizeSketch(p,width,height){
  check(Number.isFinite(width)&&width>=1&&width<=2000&&Number.isFinite(height)&&height>=1&&height<=2000,'Profile dimensions must be between 1 and 2,000 mm.');
  const b=analyse(p),next=structuredClone(p);next.profile=p.profile.map(([x,z])=>[b.minX+(x-b.minX)*width/b.width,b.minZ+(z-b.minZ)*height/b.height]);analyse(next);return next;
}
export function drawingSvg(p){return drawing({design:definition(p),number:1});}
export function stlBytes(p){
  const mesh=analyse(p).mesh,faces=mesh.i.length/3,bytes=new Uint8Array(84+faces*50),view=new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode('Engineering Studio | millimetres | '+p.kind));view.setUint32(80,faces,true);
  for(let f=0;f<faces;f++){
    const vertices=mesh.i.slice(3*f,3*f+3).map(id=>mesh.p.slice(3*id,3*id+3).map(v=>v*1000));
    const [a,b,c]=vertices,u=b.map((v,k)=>v-a[k]),w=c.map((v,k)=>v-a[k]),n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]],m=Math.hypot(...n);
    check(m>0,'Degenerate STL triangle.');
    [...n.map(v=>v/m),...vertices.flat()].forEach((v,k)=>view.setFloat32(84+50*f+k*4,v,true));
  }return bytes;
}
const profileKey='oia-workshop-profile-v1';
export function projectContext(storage){
  const profile=storage.getItem(profileKey)||'Learner',key='oia-workshop-v1:'+encodeURIComponent(profile)+':active',raw=storage.getItem(key),project=raw?loadProject(raw):createProject('blank');
  const part=project.extensions.studioPart??null;if(part)analyse(part);
  return {profile,key,origin:project.start,seed:project.seed,history:structuredClone(project.history),part,bracket:project.assets.find(a=>a.type==='bracket')?.id??null,signature:JSON.stringify(part)};
}
export function persistPart(storage,context,p,mount=false){
  analyse(p);const fresh=projectContext(storage);
  check(fresh.profile===context.profile,'The active learner changed. Reopen Part Studio before saving.');
  const sameBranch=fresh.origin===context.origin&&fresh.seed===context.seed&&fresh.history.length>=context.history.length&&context.history.every((row,i)=>{
    const current=fresh.history[i];
    if(JSON.stringify(row)===JSON.stringify(current))return true;
    return i===context.history.length-1&&row[0]==='step'&&current?.[0]==='step'&&current[1]>=row[1];
  });
  check(sameBranch,'The active project was replaced or rewound. Reopen Part Studio before saving.');
  check(fresh.signature===context.signature,'The saved part changed in another view. Reopen Part Studio before saving.');
  const raw=storage.getItem(fresh.key),project=raw?loadProject(raw):createProject('blank');const saved=structuredClone(p);
  if(mount){
    let bracket=project.assets.find(a=>a.type==='bracket');
    if(!bracket){let id='PartMount',n=1;while(project.assets.some(a=>a.id===id))id='PartMount'+n++;bracket=addAsset(project,'bracket',id);}
    saved.mount={assetId:bracket.id,frame:'bracket',units:'m'};
  }
  if(saved.mount){
    const target=project.assets.find(a=>a.type==='bracket'&&a.id===saved.mount.assetId);
    check(target,'The target bracket is missing from the active project.');
    const width=solve(definition(saved)).w/1000;
    if(Math.abs(target.width-width)>1e-12)configure(project,target.id,{width});
  }
  project.extensions.studioPart=saved;
  storage.setItem(fresh.key,saveProject(project));return {...fresh,bracket:project.assets.find(a=>a.type==='bracket')?.id??null,part:saved,signature:JSON.stringify(saved)};
}
