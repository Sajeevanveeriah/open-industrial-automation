const rad=d=>d*Math.PI/180;
const ok=(v,s)=>{if(!v)throw Error(s);};
const bounded=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b;
export function articulate(layout){
  const joints=layout.joints??[];ok(Array.isArray(joints)&&joints.length<=180,'Invalid joint schedule.');
  const byId=new Map(layout.parts.map(p=>[p.id,p])),incoming=new Map();
  for(const j of joints){
    ok(j&&byId.has(j.parent)&&byId.has(j.child)&&j.parent!==j.child&&!incoming.has(j.child),'Each child needs one installed parent joint.');
    ok(['fixed','revolute','prismatic'].includes(j.kind)&&bounded(j.min,-360,360)&&bounded(j.max,j.min,360)&&bounded(j.value,j.min,j.max)&&['dx','dy','dz','dyaw','pivotX','pivotY'].every(k=>bounded(j[k],-2000,2000)),'Invalid joint limits or rest frame.');
    incoming.set(j.child,j);
  }
  const done=new Set(),visiting=new Set();
  function place(id){
    if(done.has(id))return;ok(!visiting.has(id),'Cyclic joint chain.');visiting.add(id);
    const j=incoming.get(id);if(j){
      place(j.parent);const base=byId.get(j.parent),p=byId.get(id),yaw=rad(base.yaw);
      const jointAngle=j.kind==='revolute'?rad(j.value):0,x=j.dx-j.pivotX,y=j.dy-j.pivotY;
      const u=j.pivotX+x*Math.cos(jointAngle)-y*Math.sin(jointAngle)+(j.kind==='prismatic'?j.value:0);
      const v=j.pivotY+x*Math.sin(jointAngle)+y*Math.cos(jointAngle);
      p.x=base.x+u*Math.cos(yaw)-v*Math.sin(yaw);p.y=base.y+u*Math.sin(yaw)+v*Math.cos(yaw);
      p.z=base.z+j.dz;p.yaw=((base.yaw+j.dyaw+(j.kind==='revolute'?j.value:0)+540)%360)-180;
    }
    visiting.delete(id);done.add(id);
  }
  for(const p of layout.parts)place(p.id);
  return layout;
}
export function join(layout,parent,child,kind,min,max,pivotX,pivotY){
  ok(Number.isFinite(min)&&min<=0&&Number.isFinite(max)&&max>=0,'The rest position must lie within both travel limits.');
  const a=layout.parts.find(p=>p.id===parent),b=layout.parts.find(p=>p.id===child);
  ok(a&&b&&a!==b,'Select two different installed parts.');
  const angle=rad(a.yaw),x=b.x-a.x,y=b.y-a.y;
  const joint={parent,child,kind,min,max,value:0,pivotX,pivotY,dx:x*Math.cos(angle)+y*Math.sin(angle),dy:-x*Math.sin(angle)+y*Math.cos(angle),dz:b.z-a.z,dyaw:b.yaw-a.yaw};
  layout.joints=[...(layout.joints||[]).filter(j=>j.child!==child),joint];articulate(layout);return joint;
}
export function overlaps(a,b,tolerance=.001){
  const z=Math.min(a.z+a.height,b.z+b.height)-Math.max(a.z,b.z);
  if(z<=tolerance)return false;
  const aa=rad(a.yaw),ba=rad(b.yaw),d=[b.x-a.x,b.y-a.y];
  const radius=(p,angle,axis)=>Math.abs(Math.cos(angle-axis))*p.length/2+Math.abs(Math.sin(angle-axis))*p.width/2;
  return [aa,aa+Math.PI/2,ba,ba+Math.PI/2].every(axis=>{
    const separation=Math.abs(d[0]*Math.cos(axis)+d[1]*Math.sin(axis));return radius(a,aa,axis)+radius(b,ba,axis)-separation>tolerance;
  });
}
