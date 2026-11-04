export const kinds = {
  room:['Room',10,7,3,'#b5c9cc'],cell:['Work cell',5,3,2,'#8aafa8'],cabinet:['Cabinet',0.8,0.6,2,'#77989e'],conveyor:['Conveyor',4,0.65,0.8,'#4d7976'],bracket:['Sensor bracket',0.1,0.07,0.12,'#dd994a'],sensor:['Photoeye',0.08,0.04,0.08,'#326c65'],camera:['Camera',0.16,0.09,0.12,'#6c879b'],guard:['Guard panel',2,0.08,1.8,'#bf955a'],robot:['Robot pedestal',0.75,0.75,1.4,'#c0844f'],utility:['Utility route',3,0.12,0.12,'#6598ac'],supply:['Power supply',0.2,0.17,0.17,'#a8a67d'],rack:['Network rack',0.6,0.9,2,'#536d81'],door:['Door opening',1,0.1,2.1,'#a38c6a'],carton:['Carton',0.45,0.3,0.25,'#bf905c'],pallet:['Pallet',1.2,1,0.15,'#ae8c68']
};
export const fields = {x:'Centre X (m)',y:'Centre Y (m)',z:'Underside Z (m)',length:'Length along X (m)',width:'Width along Y (m)',height:'Height along Z (m)',yaw:'Yaw (degrees)'};
const fail = text=>{throw Error(text);};
export function part(id,kind,pose={}) {
  if(!Object.hasOwn(kinds,kind)||typeof id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,47}$/.test(id))fail('Use a unique asset ID with letters, digits, underscores or hyphens.');
  const [,length,width,height]=kinds[kind];return {id,kind,parent:'',x:0,y:0,z:0,length,width,height,yaw:0,...pose};
}
export function validate(layout) {
  if(layout?.version!==1||!Array.isArray(layout.parts)||layout.parts.length>180)fail('Unsupported or oversized layout.');
  const ids=new Set();
  for(const p of layout.parts){
    part(p.id,p.kind);if(ids.has(p.id))fail('Asset ID already exists.');ids.add(p.id);
    for(const k of Object.keys(fields)){const v=p[k];if(!Number.isFinite(v)||Math.abs(v)>1000||(['length','width','height'].includes(k)&&v<=0)|| (k==='z'&&v<0))fail('Use finite positive dimensions, a non-negative height and coordinates within 1,000 m.');}
    if(typeof p.parent!=='string')fail('Invalid assembly parent.');
  }
  for(const p of layout.parts){
    let cur=p;const seen=new Set();
    while(cur.parent){if(seen.has(cur.id))fail('An assembly cannot contain itself.');seen.add(cur.id);cur=layout.parts.find(a=>a.id===cur.parent);if(!cur||!['room','cell'].includes(cur.kind))fail('Select a room or work cell as the parent.');}
  }
  return layout;
}
export function empty(){return {version:1,parts:[]};}
export function reference() {
  return validate({version:1,parts:[
    part('room-01','room'),part('pack-01','cell',{parent:'room-01'}),part('belt','conveyor',{parent:'pack-01'}),
    part('bracket','bracket',{parent:'pack-01',x:-1,z:.8}),part('eye','sensor',{parent:'pack-01',x:-1,z:.92}),
    part('guard-01','guard',{parent:'pack-01',y:-1.3}),part('robot','robot',{parent:'pack-01',x:1.5,y:.9}),
    part('cabinet-01','cabinet',{parent:'room-01',x:3,y:2}),part('camera','camera',{parent:'room-01',x:-2.5,y:2.1,z:2.6}),
    part('air-01','utility',{parent:'room-01',x:2.5,y:1,z:2.8,yaw:90}),part('pallet-01','pallet',{parent:'pack-01',x:2.6,y:.4})
  ]});
}
export const radians=deg=>deg*Math.PI/180;
export function relativeTo(p,ref) {
  const angle=radians(ref.yaw),dx=p.x-ref.x,dy=p.y-ref.y;
  return {along:dx*Math.cos(angle)+dy*Math.sin(angle),across:-dx*Math.sin(angle)+dy*Math.cos(angle),above:p.z-ref.z};
}
export function seat(p,ref,axis) {
  if(axis==='x'||axis==='y'||axis==='yaw')p[axis]=ref[axis];
  else if(axis==='top')p.z=ref.z+ref.height;
  else if(axis==='end'){const ang=radians(ref.yaw),len=(ref.length+p.length)/2;p.yaw=ref.yaw;p.x=ref.x+Math.cos(ang)*len;p.y=ref.y+Math.sin(ang)*len;}
  else fail('Invalid alignment constraint.');
}
export function corners(p,section=Infinity) {
  if(p.z>=section)return [];
  const ang=radians(p.yaw),c=Math.cos(ang),s=Math.sin(ang),points=[];
  for(const z of [p.z,Math.min(p.z+p.height,section)])
    for(const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
      const u=a*p.length/2,v=b*p.width/2;points.push([p.x+c*u-s*v,p.y+s*u+c*v,z]);
    }
  return points;
}
export function bracketMeasurement(layout) {
  const brackets=layout.parts.filter(p=>p.kind==='bracket'),belts=layout.parts.filter(p=>p.kind==='conveyor');
  if(brackets.length!==1||belts.length!==1)fail('The cell transfer requires one bracket and one conveyor.');
  const [b]=brackets,[belt]=belts,local=relativeTo(b,belt),position=local.along+belt.length/2;
  if(position<0||position>belt.length||Math.abs(local.across)>belt.width/2||Math.abs(local.above-belt.height)>0.02)fail('Seat the bracket on the conveyor top within 0.02 m and inside its footprint.');
  return {bracket:b.id,conveyor:belt.id,position,length:belt.length};
}
export function projectFaces(camera,faces) {
  const c=Math.cos(camera.yaw),s=Math.sin(camera.yaw),pitch=camera.pitch,sp=Math.sin(pitch),cp=Math.cos(pitch);
  const toEye=([x,y,z])=>{x-=camera.x;y-=camera.y;z-=camera.z;const forward=x*c+y*s;return [x*s-y*c,z*cp+forward*sp,forward*cp-z*sp];};
  function nearClip(points){
    const out=[];for(let i=0;i<points.length;i++){
      const a=points[(i+points.length-1)%points.length],b=points[i],insideA=a[2]>=.08,insideB=b[2]>=.08;
      if(insideA!==insideB){const t=(.08-a[2])/(b[2]-a[2]);out.push(a.map((n,j)=>n+(b[j]-n)*t));}
      if(insideB)out.push(b);
    }return out;
  }
  return faces.flatMap(face=>{
    const points=nearClip(face.points.map(toEye));if(points.length<3)return [];
    const centre=points.reduce((sum,p)=>sum+p[2],0)/points.length;
    const projected=points.map(([x,y,z])=>[360+camera.focal*x/z,215-camera.focal*y/z]);
    return [{...face,depth:centre,projected}];
  }).sort((a,b)=>b.depth-a.depth);
}
