import * as T from '../../../vendor/three.module.js';

const steel='#344e6a',silver='#afbcc1',orange='#bd5836',yellow='#e7b646',charcoal='#323b40',white='#e1e7e6';
const q=new T.Quaternion(),v=new T.Vector3(),one=new T.Vector3(),tz=new T.Vector3(0,0,1),ty=new T.Vector3(0,1,0),mat=new T.Matrix4();
export function hash(text){let n=2166136261;for(const c of String(text))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
export function crateTint(sku){return ['#b58b59','#b99468','#c3a97d','#ad8258','#c5bba0','#7f9e90','#9aa6a6','#ad9a79'][hash(sku)%8];}
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
export function makeKit(){
  const g={box:new T.BoxGeometry(1,1,1),tube:new T.CylinderGeometry(.5,.5,1,12),fineTube:new T.CylinderGeometry(.5,.5,1,8),wheel:new T.CylinderGeometry(.5,.5,1,16),sphere:new T.SphereGeometry(.5,12,8),torus:new T.TorusGeometry(.42,.08,7,16),flat:new T.PlaneGeometry(1,1)};
  const atlas=canvas(128,128),ctx=atlas.getContext('2d');ctx.fillStyle='#f2e8d2';ctx.fillRect(0,0,128,128);
  ctx.fillStyle='#ddc9a4';ctx.fillRect(55,0,15,128);ctx.fillStyle='#b39d79';ctx.fillRect(64,0,1,128);ctx.fillRect(1,0,1,128);ctx.fillRect(0,125,128,2);ctx.fillStyle='#eae9d8';ctx.fillRect(78,76,35,30);
  ctx.fillStyle='#555955';for(let i=0;i<19;i++)ctx.fillRect(81+i*1.5,87,i%4===0?1.6:.7,10);ctx.fillRect(81,79,22,2);
  ctx.font='bold 6px monospace';ctx.fillStyle='#72664e';ctx.fillText('LOT C / 04',4,112);ctx.font='bold 4px monospace';ctx.fillText('STORE DRY',4,118);ctx.strokeStyle='#8d7f64';ctx.lineWidth=1;ctx.strokeRect(5,8,13,12);ctx.fillText('↑ ↑',6,17);
  for(let i=0;i<1400;i++){const v=(i*131+53)%251;ctx.fillStyle='rgba(111,88,58,'+(v%10/210)+')';ctx.fillRect((i*71)%128,(i*47+Math.floor(i/31))%128,1+(i%4),1);}
  const boxTexture=new T.CanvasTexture(atlas);boxTexture.colorSpace=T.SRGBColorSpace;
  const m={steel:new T.MeshStandardMaterial({roughness:.60,metalness:.22}),paint:new T.MeshStandardMaterial({roughness:.78,metalness:.06}),carton:new T.MeshStandardMaterial({map:boxTexture,roughness:.96}),rubber:new T.MeshStandardMaterial({roughness:1}),stripe:new T.MeshBasicMaterial({side:T.DoubleSide}),lamp:new T.MeshBasicMaterial(),glass:new T.MeshStandardMaterial({roughness:.28,metalness:.25,transparent:true,opacity:.47,depthWrite:false})};
  const contact=canvas(48,48),cx=contact.getContext('2d'),rad=cx.createRadialGradient(24,24,3,24,24,24);rad.addColorStop(0,'rgba(30,36,34,0.34)');rad.addColorStop(.58,'rgba(30,36,34,0.18)');rad.addColorStop(1,'rgba(30,36,34,0)');cx.fillStyle=rad;cx.fillRect(0,0,48,48);
  const shadow=new T.CanvasTexture(contact);m.shade=new T.MeshBasicMaterial({map:shadow,transparent:true,depthWrite:false,side:T.DoubleSide});
  return {g,m,dispose(){Object.values(g).forEach(x=>x.dispose());Object.values(m).forEach(x=>x.dispose());boxTexture.dispose();shadow.dispose();}};
}
export function batch(kit){
  const groups=new Map(),result=new T.Group();
  function add(geom,material,colour,x,y,z,sx,sy,sz,rotation=null){
    const key=geom+'|'+material;let row=groups.get(key);if(!row){row={geom,material,matrices:[],colours:[]};groups.set(key,row);}
    if(rotation instanceof T.Quaternion)q.copy(rotation);else if(rotation)q.setFromEuler(new T.Euler(...rotation));else q.identity();
    mat.compose(v.set(x,y,z),q,one.set(sx,sy,sz));row.matrices.push(mat.clone());row.colours.push(colour);
  }
  const box=(c,x,y,z,w,d,h,rot=null,m='paint')=>add('box',m,c,x,y,z,w,d,h,rot);
  const rod=(c,a,b,d,m='steel',geom='fineTube')=>{const dir=new T.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]),l=dir.length();if(l>.0001)add(geom,m,c,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,d,l,d,new T.Quaternion().setFromUnitVectors(ty,dir.divideScalar(l)));};
  const mark=(c,x,y,w,d,yaw=0)=>add('flat','stripe',c,x,y,.021,w,d,1,[0,0,yaw]);
  const shade=(x,y,w,d)=>add('flat','shade','#ffffff',x,y,.018,w,d,1);
  function finish(){const color=new T.Color();for(const row of groups.values()){
    const mesh=new T.InstancedMesh(kit.g[row.geom],kit.m[row.material],row.matrices.length);
    row.matrices.forEach((matrix,i)=>{mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,color.set(row.colours[i]));});
    mesh.castShadow=!['stripe','shade','lamp','glass'].includes(row.material);mesh.receiveShadow=!['stripe','shade','lamp'].includes(row.material);mesh.computeBoundingSphere();result.add(mesh);
  }groups.clear();return result;}
  return {add,box,rod,mark,shade,finish};
}
export function releaseBatch(group){group.traverse(obj=>{if(obj.isInstancedMesh)obj.dispose();});group.removeFromParent();}
export function label(text,width,height,{bg='#254c56',fg='#fff',font=80}={}){
  const img=canvas(1024,192),ctx=img.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,img.width,img.height);ctx.fillStyle=fg;ctx.font='700 '+font+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,98,990);
  const tex=new T.CanvasTexture(img);tex.colorSpace=T.SRGBColorSpace;const mesh=new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map:tex,side:T.DoubleSide}));mesh.userData.owns=true;return mesh;
}
function footGuard(b,x,y){
  b.box('#e9ae32',x,y,.32,.31,.31,.64);b.box(charcoal,x,y,.34,.318,.318,.12);b.box('#816f54',x,y,.04,.41,.41,.08);
}
export function buildRacks(kit,s){
  const b=batch(kit),sections=new Map();
  for(const bay of s.bays){const key=bay.aisle+bay.side;const rows=sections.get(key)||[];rows.push(bay);sections.set(key,rows);}
  for(const bays of sections.values()){
    bays.sort((a,b)=>a.y-b.y);const x=bays[0].x,first=bays[0].y-1.88,end=bays.at(-1).y+1.88,l=end-first,cy=(first+end)/2;
    b.shade(x,cy,2.6,l+2.3);
    for(let col=0;col<=bays.length;col++){
      const y=col===bays.length?end:bays[col].y-1.88;
      for(const side of [-1,1]){
        b.box(steel,x+side*.60,y,1.79,.105,.12,3.58,null,'steel');
        b.box('#819097',x+side*.60,y,.05,.25,.25,.095,null,'steel');
        if(col===0||col===bays.length)footGuard(b,x+side*.62,y);
      }
      for(let level=0;level<3;level++){
        const z=.25+level*1.12;
        b.rod('#91a0a0',[x-.59,y,z],[x+.59,y,z+.98],.042);b.rod('#91a0a0',[x+.59,y,z],[x-.59,y,z+.98],.042);
      }
    }
    for(let level=0;level<3;level++){
      const z=.18+1.12*level;
      for(const side of [-1,1])b.box(orange,x+side*.60,cy,z,.085,l,.17,null,'steel');
      for(const bay of bays){
        b.box('#9da4a1',x,bay.y,z-.035,1.22,3.80,.052,null,'steel');
        b.box('#e8e4bd',x-.653,bay.y-.85,z+.015,.017,.35,.089);
      }
    }
    for(const y of [first-.3,end+.3]){b.mark(yellow,x,y,1.65,.14);b.box(yellow,x,y,.13,1.52,.11,.26);}
  }
  return b.finish();
}
export function buildInventory(kit,s){
  const b=batch(kit);let count=0;
  for(const bay of s.bays)for(const [index,load] of bay.stock.entries()){
    const level=(load.level??(index+1))-1;
    const base=.235+level*1.12,x=bay.x,y=bay.y,mix=hash(load.id),tint=crateTint(load.sku);
    const bands=2+(mix%3),height=.71+(mix%4)*.066,kind=(mix>>3)%4;
    for(const dy of [-.60,0,.60])b.box('#a98759',x,y+dy,base,1.11,.16,.11);
    b.box('#bb9b6e',x,y,base+.073,1.17,1.65,.08);
    for(let row=0;row<bands;row++){
      const n=kind===0?1:2;for(let k=0;k<n;k++){
        const py=y+(k-(n-1)/2)*(.82);
        b.box(tint,x,py,base+.12+(row+.5)*height/bands,1.10,n===1?1.54:.77,height/bands-.018,null,'carton');
      }
    }
    if(kind===2){for(const dy of [-.45,.45]){b.box('#6f7465',x-.558,y+dy,base+.12+height/2,.015,.035,height);b.box('#818475',x,y+dy,base+.12+height+.006,1.13,.035,.013);}}
    count++;
  }
  const obj=b.finish();obj.userData.loadedPallets=count;return obj;
}
function stair(b,x,y,levels){
  for(let i=0;i<levels;i++)b.box('#929e9b',x,y+i*.30,.10+i*.18,1.1,.31,.17,null,'steel');
  for(const dx of [-.54,.54])b.rod(yellow,[x+dx,y,1],[x+dx,y+(levels-1)*.30,1+(levels-1)*.18],.06);
}
export function buildFactory(kit,s){
  const b=batch(kit),labels=new T.Group();
  const sign=(t,w,h,x,y,z,face=false,style)=>{const m=label(t,w,h,style);m.position.set(x,y,z);if(face)m.rotation.x=Math.PI/2;labels.add(m);return m;};
  b.box('#9eaaa8',0,1,-.14,130,56,.28);b.box('#6c7678',0,-43,-.23,143,33,.30);b.box('#c8cbbe',0,-61,-.33,155,4,.50);
  for(let x=-64;x<=64;x+=8){b.mark('#8f9996',x,1,.023,56);b.mark('#dddcd0',x,-49,3,.11);}
  for(let y=-24;y<=25;y+=7)b.mark('#8e9996',0,y,129,.026);
  for(const y of [-22.80,17.8]){b.mark(yellow,0,y,127,.10);b.mark(yellow,0,y+.33,127,.07);}
  for(let x=-60;x<=60;x+=12){for(const y of [-20.9,19.20]){
    b.mark('#e3dfba',x,y,.85,.13);b.mark('#e3dfba',x+.28,y+.17,.46,.12,-.70);b.mark('#e3dfba',x+.28,y-.17,.46,.12,.70);
  }}
  for(const aisle of s.aisles){
    const x=aisle.x;for(const y of [-16.60,16.60]){b.mark(yellow,x,y,1.4,.11);b.mark('#e1dfca',x-.72,y+.25,.07,.56);}
    const m=sign(aisle.id,1.75,.68,x,-17.58,.037,false,{bg:'#354d56',fg:'#f9edb7',font:109});m.rotation.z=0;
    if(Number(aisle.id.replace(/\D/g,''))%2===1){b.rod(steel,[x-1.65,-15.98,3.55],[x-1.65,-15.98,4.18],.05);sign(aisle.id,1.20,.50,x-1.65,-16,3.95,true,{bg:'#25566a',font:109});}
  }
  // Rear wall and clerestory give the cutaway its permanent orientation.
  b.box('#c7d2d0',0,29,4.45,131,.24,8.9);b.box('#6a828a',0,28.80,1.0,131,.12,2.0);
  for(let x=-62;x<=62;x+=4){b.box('#98bbc7',x,28.77,6.92,3.70,.07,1.52,null,'glass');b.box('#e4e7dd',x,28.60,6.12,4,.14,.1);}
  for(let x=-64;x<=64;x+=8){
    b.box(steel,x,27.65,4.70,.24,.29,9.4,null,'steel');
    b.box('#90a7a6',x,27.65,8.70,.26,4.3,.17,null,'steel');
    b.rod('#829a9e',[x,27.6,7.5],[x,25.70,8.69],.12);
    b.box('#dae3da',x,25.75,8.52,1.5,.35,.19,null,'steel');b.box('#fff1cb',x,25.75,8.40,1.4,.28,.055,null,'lamp');
  }
  b.box('#5a747c',0,27.5,9.32,130,.40,.42,null,'steel');
  for(let x=-60;x<=55;x+=12){
    b.rod('#b95943',[x,27.1,7.8],[x+12,27.1,7.8],.12);b.rod('#b5c4c2',[x,27.2,8.12],[x+12,27.2,8.12],.14);
  }
  sign('DISPATCH  /  COLD STORE',10,.90,-41,28.53,4.65,true,{font:81});sign('PACKAGING HALL',10,.90,4,28.53,4.65,true,{font:83});
  for(const [n,door] of s.doors.entries()){
    const x=door.x,y=door.y;
    b.box('#a9b0ab',x,y, .14,5.25,3,.28);for(const dx of [-2,2]){b.box('#334958',x+dx,y,.98,.23,.48,1.96);b.box(yellow,x+dx,y-.15,.5,.31,.18,.66);}
    for(const dx of [-2.02,2.02])for(let i=0;i<8;i++)b.mark('#e3d7a8',x+dx,y-2.0-i*1.45,.11,1.15);
    for(let j=-3;j<=3;j++)b.mark('#e1b04a',x+j*.44,y+2.05,.22,1.2,-.32);
    sign(door.id,1.7,.54,x,y+2.96,.04,false,{bg:'#b99d58',fg:'#272f30',font:108});
  }
  for(const [i,conv] of s.conveyors.entries()){
    const x=conv.x,y=conv.y,len=conv.length,deck=1.15;
    b.box('#556a65',x,y,deck,len,1.0,.16);
    for(const dy of [-.52,.52]){b.box(silver,x,y+dy,deck-.06,len,.075,.29,null,'steel');b.box('#b5c2be',x,y+dy,deck+.29,len,.05,.05,null,'steel');}
    for(let j=-len/2+.25;j<=len/2;j+=.65)b.rod('#9eafab',[x+j,y-.49,deck+.09],[x+j,y+.49,deck+.09],.12);
    for(let j=-len/2+.4;j<=len/2;j+=3){for(const dy of [-.42,.42])b.box(steel,x+j,y+dy,.54,.12,.12,1.05,null,'steel');}
    for(const at of [-.30,.10,.34]){
      const xx=x+len*at;b.box('#d7ded8',xx,y,1.82,1.42,1.63,1.28,null,'steel');b.box('#566f79',xx,y-.825,1.97,.92,.04,.64);
      b.box('#90b3ba',xx,y-.856,1.98,.72,.03,.43,null,'glass');b.box('#526b74',xx+.79,y,1.12,.32,1.38,.70);
      b.rod('#38484a',[xx-.47,y-.66,2.46],[xx-.47,y-.66,2.83],.05);b.box('#87bc7b',xx-.47,y-.66,2.83,.15,.15,.16,null,'lamp');
    }
    b.shade(x,y,len+1,2);sign(conv.id+' / PACK LINE',4,1,x+len*.22,y+1.45,.032,false,{bg:'#426464',font:88});
  }
  // Stainless process vessels and a service deck beyond the carton lines.
  for(let k=0;k<4;k++){
    const x=-56+k*3.1,y=24;b.rod('#b3c3bf',[x,y,.55],[x,y,3.0],2.05,'steel','tube');
    b.add('sphere','steel','#b5c3bc',x,y,3.0,2.05,2.05,.67);b.add('sphere','steel','#9aaca9',x,y,.54,2.04,2.04,.48);
    for(const dx of [-.65,.65])for(const dy of [-.62,.62])b.box(steel,x+dx,y+dy,.26,.12,.12,.52,null,'steel');
    b.rod('#9caaaa',[x,y,3.34],[x,y,3.80],.18);b.rod('#aeb7ae',[x,y,3.8],[x,26,3.8],.18);
  }
  stair(b,-44,23,7);
  for(const y of [18.3,-22.45]){b.mark('#417970',61,y,4.2,1.8);for(let i=0;i<7;i++)b.mark('#d2d6c0',59.3+i*.52,y,.26,1.45);}
  const root=b.finish();root.add(labels);return root;
}
export function buildRoof(kit){
  const b=batch(kit);
  for(let x=-63;x<=63;x+=10.5){
    for(const y of [-26,28]){b.box(steel,x,y,4.65,.29,.30,9.30,null,'steel');footGuard(b,x,y);}
    b.box('#637b82',x,1,9.08,.19,54,.22,null,'steel');b.box('#879ca0',x,1,8.23,.14,54,.14,null,'steel');
    for(let y=-26;y<27;y+=3)b.rod('#82969a',[x,y,8.23],[x,y+1.5,9.08],.085);
  }
  for(const y of [-21,-8,6,19])b.box('#b3beb9',0,y,9.12,129,.15,.15,null,'steel');return b.finish();
}
