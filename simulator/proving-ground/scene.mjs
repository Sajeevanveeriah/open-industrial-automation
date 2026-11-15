import * as T from '../vendor/three.module.js';

const tau = 2 * Math.PI;
const steel = '#bccbd0', navy = '#263c52', iron = '#435668', amber = '#f5b700';
const cold = '#61abc1', red = '#ef4444', green = '#10b981', timber = '#b7814b';
const xyz = (x, y, z) => new T.Vector3(x,y,z);
const clamp = (x, lo, hi) => Math.max(lo,Math.min(hi,x));
const assets = [
  ['Z1-WB-01',-16,-6], ['Z2-SB-01',-1,-7], ['Z3-PEEL-01',-12,4], ['Z3-SORT-01',-4,4],
  ['Z3-FRY-01',4,4], ['Z4-ROB-01',13,4], ['Z4-CS-01',16,-6], ['AMR-01',-18,10]
];
const poses = {
  overview:[0,1.4,-0.3,59,.21,.60], z1:[-15.7,1.4,-5,21,-.36,.43],
  z2:[-1.5,2,-7.4,22,.36,.49], z3:[-4,1.45,4,34,.16,.44],
  z4:[15.2,2.1,-2,26,.76,.46], amr:[0,.6,0,7,.83,.38]
};
const route = new T.CatmullRomCurve3([
  [-22,0,10],[20,0,10],[23,0,7],[23,0,-12],[20,0,-14],[-20,0,-14],[-23,0,-11],[-23,0,7]
].map(p=>xyz(...p)),true,'catmullrom',.08);
const perimeter = route.getLength();

function createPlant(scene){
  const geo = {
    box:new T.BoxGeometry(), cylinder:new T.CylinderGeometry(.5,.5,1,20),
    cone:new T.CylinderGeometry(.5,.16,1,8), dome:new T.SphereGeometry(.5,20,12),
    tuber:new T.IcosahedronGeometry(.5,1), ring:new T.TorusGeometry(.5,.035,6,32)
  };
  const material = new T.MeshStandardMaterial({roughness:.52,metalness:.20});
  const resources=new Set([material,...Object.values(geo)]);
  const t=new T.Object3D(),color=new T.Color(),collections=new Map();
  const groups=new Map();
  function group(parent,x=0,y=0,z=0){
    const g=new T.Group();parent.add(g);g.position.set(x,y,z);return g;
  }
  const floor=group(scene);
  for(const [id,x,z] of assets){const g=group(scene,x,0,z);g.userData.asset=id;groups.set(id,g);}
  function solid(parent,shape,col,x,y,z,w,h,d,rx=0,ry=0,rz=0){
    let shapes=collections.get(parent);
    if(!shapes)collections.set(parent,shapes=new Map());
    if(!shapes.has(shape))shapes.set(shape,[]);
    t.position.set(x,y,z);t.rotation.set(rx,ry,rz);t.scale.set(w,h,d);t.updateMatrix();
    shapes.get(shape).push([t.matrix.clone(),col]);
  }
  const box=(p,c,x,y,z,w,h,d,rx,ry,rz)=>solid(p,'box',c,x,y,z,w,h,d,rx,ry,rz);
  const cyl=(p,c,x,y,z,w,h,d,rx,ry,rz)=>solid(p,'cylinder',c,x,y,z,w,h,d,rx,ry,rz);
  function pipe(p,c,a,b,r){
    const start=xyz(...a),end=xyz(...b),delta=end.clone().sub(start),e=new T.Euler().setFromQuaternion(
      new T.Quaternion().setFromUnitVectors(xyz(0,1,0),delta.clone().normalize()));
    start.lerp(end,.5);cyl(p,c,start.x,start.y,start.z,2*r,delta.length(),2*r,e.x,e.y,e.z);
  }
  function lettering(parent,words,x,y,z,width,height,flat=true){
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#182b42';ctx.fillRect(0,0,1024,128);ctx.fillStyle='#f5b700';ctx.fillRect(0,0,14,128);
    ctx.font='bold 76px Arial';ctx.fillStyle='#e2edf4';ctx.textBaseline='middle';ctx.fillText(words,34,69,951);
    const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;
    const m=new T.MeshBasicMaterial({map:tex,side:T.DoubleSide});
    const g=new T.PlaneGeometry(width,height),obj=new T.Mesh(g,m);
    resources.add(tex);resources.add(m);resources.add(g);
    obj.position.set(x,y,z);if(flat)obj.rotation.x=-Math.PI/2;parent.add(obj);
  }
  function border(p,x,z,w,d){
    for(const side of [-1,1]){
      box(p,'#bba563',x,.082,z+side*d/2,w,.025,.065);
      box(p,'#bba563',x+side*w/2,.082,z,.065,.025,d);
    }
  }
  function pallet(p,x,y,z){
    for(const u of [-.49,0,.49])box(p,timber,x+u,y+.1,z,.13,.2,1.08);
    for(let t=0;t<5;t++)box(p,'#d7b886',x,y+.23,z-.44+t*.22,1.16,.065,.17);
    for(const u of [-.29,.29])for(const v of [-.25,.25]){
      box(p,'#bd945c',x+u,y+.66,z+v,.54,.8,.475);
      box(p,'#e1cdb0',x+u,y+1.067,z+v,.09,.018,.475);
    }
  }
  function conveyor(p,x,z,length,width,elev=1){
    box(p,iron,x,elev,z,length,.22,width);
    box(p,'#344854',x,elev+.14,z,length-.05,.06,width-.14);
    for(const side of [-1,1]){
      box(p,steel,x,elev+.24,z+side*width*.5,length,.15,.09);
      for(let offset=-length*.46;offset<=length*.47;offset+=2)
        box(p,iron,x+offset,elev*.50,z+side*width*.40,.15,elev,.15);
    }
    for(let u=.25;u<length;u+=.63)cyl(p,'#607480',x-length/2+u,elev+.175,z,.10,width-.2,.10,Math.PI/2);
  }
  const indicators=new Map();
  function beacon(p,id,x,y,z){
    cyl(p,navy,x,y-.05,z,.22,.5,.22);
    const m=new T.MeshBasicMaterial({color:green});
    const lens=new T.Mesh(geo.cylinder,m);lens.position.set(x,y+.29,z);lens.scale.set(.19,.28,.19);
    p.add(lens);resources.add(m);if(!indicators.has(id))indicators.set(id,[]);indicators.get(id).push(m);
  }
  box(floor,'#374b5b',0,-.3,-1,52,.6,32);
  box(floor,'#506575',0,.016,-1,51.6,.03,31.6);
  for(let x=-24;x<=24;x+=2)box(floor,'#546b7a',x,.045,-1,.014,.014,31.5);
  for(let z=-16;z<=14;z+=2)box(floor,'#546b7a',0,.045,z,51.5,.014,.014);
  border(floor,-15.5,-6.0,11.8,11.5);border(floor,-1.5,-7.5,13.9,10);
  border(floor,-4,4.1,30,7.4);border(floor,15.9,-2,10.5,18.6);
  lettering(floor,'01   /   RECEPTION',-15.6,.091,-.85,7.7,.92);
  lettering(floor,'02   /   STORAGE',-1.5,.091,-2.95,7.4,.92);
  lettering(floor,'03   /   PROCESS HALL',-4.2,.091,7.15,9,.95);
  lettering(floor,'04   /   DISPATCH',15.8,.091,6.55,7.4,.9);

  const reception=groups.get('Z1-WB-01');
  for(const z of [-3,0]){
    box(reception,navy,0,.27,z,8.6,.44,2.4);
    for(const side of [-1,1])box(reception,steel,0,.55,z+side*1.12,8.6,.13,.10);
    for(const x of [-3.85,3.85])for(const side of [-1,1])cyl(reception,amber,x,.18,z+side*.83,.4,.22,.4);
    for(let x=-4.7;x<4.8;x+=1)box(reception,'#f1d059',x,.09,z+1.30,.53,.026,.105);
  }
  const truck=group(reception,-.4,0,-3);
  box(truck,'#96a9b5',0,1.44,0,5.5,1.05,1.85);
  box(truck,'#6a7a7e',0,2.0,0,5.25,.14,1.7);
  box(truck,amber,-3.3,1.25,0,1.55,1.5,1.8);
  box(truck,'#304f65',-3.4,1.85,.02,1.38,.55,1.83);
  box(truck,'#e9d499',-3.32,2.17,0,1.55,.12,1.86);
  for(const x of [-3.4,.9,2])for(const z of [-.91,.91])cyl(truck,'#24323e',x,.82,z,.7,.22,.7,Math.PI/2);
  solid(reception,'cone',steel,-4.0,2.2,2.7,2.4,2.1,2.4,0,Math.PI/8);
  for(const u of [-.85,.85])for(const v of [-.85,.85])box(reception,iron,-4+u,1.06,2.7+v,.14,2.1,.14);
  box(reception,iron,.1,.5,2.7,5.2,.82,2.35);
  const drum=group(reception,0,1.74,2.7);
  cyl(drum,'#aabdc4',0,0,0,1.7,4.9,1.7,0,0,Math.PI/2);
  for(const x of [-2.28,-.75,.75,2.28])solid(drum,'ring',amber,x,0,0,1.77,1.77,1.77,0,Math.PI/2);
  for(let i=0;i<8;i++){const a=i*tau/8;box(drum,iron,0,.85*Math.cos(a),.85*Math.sin(a),4.55,.05,.10,a);}
  beacon(reception,'Z1-WB-01',3.9,.8,1.8);

  const bunkers=groups.get('Z2-SB-01'),fans=[];
  for(let i=0;i<4;i++){
    const x=(i-1.5)*3.2;
    box(bunkers,'#9caeb4',x,2,-1.5,3.0,3.9,5.1);
    box(bunkers,'#d9e1df',x,4,-1.5,3.1,.18,5.23);
    box(bunkers,navy,x,1.2,1.09,2.1,2.38,.12);
    for(let k=0;k<7;k++)box(bunkers,iron,x,.35+.27*k,1.18,1.95,.05,.08);
    box(bunkers,iron,x,4.37,-1.6,2.16,.68,2.4);
    for(const z of [-2.13,-1.05]){
      cyl(bunkers,'#243741',x,4.74,z,.92,.10,.92);
      const fan=group(bunkers,x,4.82,z);fans.push(fan);
      for(let k=0;k<3;k++)box(fan,'#b1bebe',0,0,0,.78,.05,.09,0,k*Math.PI/3);
    }
    beacon(bunkers,'Z2-SB-01',x+1.15,2.45,1.2);
    lettering(bunkers,'BUNKER 0'+(i+1),x,3.25,1.075,2.5,.41,false);
  }
  conveyor(bunkers,-.05,2.45,13.1,1.05,2.2);
  pipe(bunkers,cold,[-6.3,3.37,-4.3],[5.5,3.37,-4.3],.14);

  const peel=groups.get('Z3-PEEL-01'),sort=groups.get('Z3-SORT-01'),fry=groups.get('Z3-FRY-01');
  const robot=groups.get('Z4-ROB-01');
  conveyor(peel,.5,0,12,1.8);conveyor(sort,.25,0,4.5,1.8);conveyor(fry,.5,0,11.2,1.8);
  conveyor(robot,-1.25,0,5,1.8);
  cyl(peel,steel,-1.95,2.65,-1.5,2.9,3.4,2.9);
  solid(peel,'dome',steel,-1.95,4.32,-1.5,2.9,1.37,2.9);
  for(const y of [1.3,3.66,4.25])cyl(peel,iron,-1.95,y,-1.5,3.0,.12,3.0);
  for(const z of [-2.45,-.55])for(const x of [-2.9,-1])box(peel,iron,x,.60,z,.23,1.2,.23);
  pipe(peel,amber,[-1.95,4.7,-1.5],[-1.95,5.3,-1.5],.18);
  pipe(peel,steel,[-1.95,5.3,-1.5],[-4.4,5.3,-1.5],.15);
  pipe(peel,steel,[-4.4,5.3,-1.5],[-4.4,.4,-1.5],.15);
  const brushes=[];
  for(let i=0;i<6;i++){
    const brush=group(peel,i*.39,1.25,0);brushes.push(brush);
    cyl(brush,'#7c9495',0,0,0,.36,1.62,.36,Math.PI/2);
    for(let j=0;j<8;j++){
      const a=j*tau/8;
      box(brush,'#394f53',.18*Math.cos(a),.18*Math.sin(a),0,.05,.04,1.6,0,0,a);
    }
  }
  beacon(peel,'Z3-PEEL-01',.9,2,-1.16);
  for(const z of [-1.08,1.08])box(sort,iron,0,1.9,z,.32,2.7,.32);
  box(sort,'#768a96',0,3.27,0,2.45,.62,2.66);
  for(const z of [-.78,-.26,.26,.78])box(sort,navy,-.03,2.89,z,.39,.22,.25);
  box(sort,amber,1.03,.89,1.47,1.3,.16,1.6,.4);
  box(sort,iron,1.03,.33,2.32,1.6,.55,1.12);
  for(const z of [-.6,.1,.75])box(sort,'#b99356',1.03,.67,2.4+.15*z,.3,.22,.24);
  beacon(sort,'Z3-SORT-01',.9,3.55,.84);
  const laserMat=new T.MeshBasicMaterial({color:'#33dbc0',transparent:true,opacity:.38,side:T.DoubleSide,depthWrite:false});
  const laser=new T.Mesh(new T.PlaneGeometry(1.72,1.68),laserMat);
  laser.rotation.y=Math.PI/2;laser.position.set(.02,2.08,0);sort.add(laser);resources.add(laser.geometry);resources.add(laserMat);

  for(const z of [-1.24,1.24])box(fry,steel,0,2.09,z,7.7,1.7,.24);
  box(fry,'#b7c7cd',0,3.05,0,7.9,.35,2.7);
  box(fry,iron,0,1.42,0,7.95,.33,2.8);
  for(const x of [-2.7,2.6]){
    cyl(fry,iron,x,4.04,0,.58,2,.58);
    cyl(fry,steel,x,5.13,0,.82,.18,.82);
  }
  const thermalMat=new T.MeshStandardMaterial({color:'#fa8d32',emissive:'#ff5c09',emissiveIntensity:.8});
  resources.add(thermalMat);
  for(let i=0;i<6;i++)for(const side of [-1,1]){
    const port=new T.Mesh(geo.box,thermalMat);port.scale.set(1.02,.54,.055);
    port.position.set(-3.06+i*1.22,2.06,side*1.386);fry.add(port);
  }
  beacon(fry,'Z3-FRY-01',3.4,3.35,1.0);

  const goods=new T.InstancedMesh(geo.tuber,material,59);
  goods.instanceMatrix.setUsage(T.DynamicDrawUsage);goods.frustumCulled=false;scene.add(goods);
  const raw=new T.Color('#966331'),peeled=new T.Color('#eed584'),fried=new T.Color('#db9939');
  for(let i=0;i<goods.count;i++)goods.setColorAt(i,raw);

  const pedestal=group(robot,1,.12,-1.5);
  cyl(pedestal,navy,0,.36,0,1.3,.72,1.3);cyl(pedestal,amber,0,.77,0,1.12,.22,1.12);
  const yaw=group(pedestal,0,.85,0),shoulder=group(yaw,0,.39,0),elbow=group(shoulder,0,2.24,0);
  const roll=group(elbow,0,1.96,0),wrist=group(roll,0,.44,0),tool=group(wrist,0,.38,0);
  for(const [g,length] of [[shoulder,2.24],[elbow,1.96]]){
    box(g,amber,0,length/2,0,.42,length,.42);
    box(g,iron,.14,length/2,.22,.13,length*.83,.10);
    cyl(g,navy,0,0,0,.64,.59,.64,Math.PI/2);
    cyl(g,amber,0,0,.31,.40,.10,.40,Math.PI/2);
  }
  cyl(roll,iron,0,.20,0,.37,.41,.37);
  cyl(wrist,amber,0,.18,0,.34,.37,.34);
  box(tool,navy,0,.07,0,1.06,.15,.68);
  for(const x of [-.39,.39])for(const z of [-.22,.22])cyl(tool,'#566971',x,.22,z,.18,.17,.18);
  pallet(robot,3,0,1.0);pallet(robot,4.3,0,1.0);beacon(robot,'Z4-ROB-01',.25,1.1,-2.5);

  const warehouse=groups.get('Z4-CS-01');
  for(const z of [-2.35,2.35]){
    for(let i=0;i<6;i++)for(const side of [-1,1])box(warehouse,navy,-4+i*1.6,3.12,z+side*.67,.12,6.22,.12);
    for(let k=0;k<4;k++){
      const y=.31+k*1.52;
      for(const side of [-1,1])box(warehouse,'#cc972d',0,y,z+side*.67,8.15,.19,.11);
      for(let i=0;i<5;i++){
        box(warehouse,'#6b808a',-3.2+i*1.6,y-.06,z,1.56,.1,1.42);
        if((i+2*k+(z>0?1:0))%5!==1)pallet(warehouse,-3.2+i*1.6,y+.07,z);
      }
    }
    for(const x of [-4,4])for(let k=0;k<4;k++)pipe(warehouse,cold,[x,.28+1.52*k,z-.67],[x,1.7+1.52*k,z+.67],.045);
  }
  for(const z of [-.72,.72])box(warehouse,steel,0,.15,z,9.5,.16,.12);
  const crane=group(warehouse);
  box(crane,amber,0,.38,0,1.10,.49,1.7);
  for(const z of [-.47,.47])box(crane,amber,0,3.46,z,.20,6.27,.18);
  const carriage=group(crane);box(carriage,iron,0,0,0,.97,.25,1.68);
  for(const x of [-.34,.34])box(carriage,steel,x,.06,.89,.15,.12,1.98);
  beacon(warehouse,'Z4-CS-01',-4.12,6.53,-2.35);

  const rover=groups.get('AMR-01');
  box(rover,amber,0,.49,0,2.14,.54,1.3);
  box(rover,'#243649',0,.81,0,1.79,.19,1.15);
  for(const x of [-.67,.67])for(const z of [-.63,.63])cyl(rover,'#24303b',x,.31,z,.56,.19,.56,Math.PI/2);
  cyl(rover,steel,.35,1.03,0,.25,.32,.25);cyl(rover,cold,.35,1.23,0,.28,.13,.28);
  box(rover,navy,1.03,.51,0,.12,.21,.84);beacon(rover,'AMR-01',-.55,.88,.22);
  const scanMat=new T.MeshBasicMaterial({color:'#3ecbc1',transparent:true,opacity:.18,side:T.DoubleSide,depthWrite:false});
  const scan=new T.Mesh(new T.ConeGeometry(1.2,3.5,24,1,true),scanMat);
  const turret=group(rover,.35,1.20,0);scan.rotation.z=Math.PI/2;scan.position.set(1.75,0,0);turret.add(scan);resources.add(scan.geometry);resources.add(scanMat);
  const routeGeo=new T.BufferGeometry().setFromPoints(route.getPoints(180));
  const routeMat=new T.LineDashedMaterial({color:'#4d8b94',dashSize:.7,gapSize:.45});
  const routeLine=new T.Line(routeGeo,routeMat);routeLine.computeLineDistances();routeLine.position.y=.085;scene.add(routeLine);resources.add(routeGeo);resources.add(routeMat);

  const assetMaterials=new Map();
  for(const [parent,shapes] of collections){
    let owner=parent;
    while(owner&&!owner.userData.asset)owner=owner.parent;
    let mat=material;
    if(owner){
      if(!assetMaterials.has(owner.userData.asset)){const copy=material.clone();resources.add(copy);assetMaterials.set(owner.userData.asset,copy);}
      mat=assetMaterials.get(owner.userData.asset);
    }
    for(const [shape,items] of shapes){
      const mesh=new T.InstancedMesh(geo[shape],mat,items.length);
      items.forEach(([matrix,col],i)=>{mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,color.set(col));});
      mesh.castShadow=parent!==floor;mesh.receiveShadow=true;parent.add(mesh);
    }
  }
  function animate(s,selected,visible){
    drum.rotation.x=s.drumAngle;
    for(const brush of brushes)brush.rotation.z=-s.travel/.18;
    for(const g of fans)g.rotation.y=s.seconds*(s.faults.humidity?7:4);
    laser.visible=s.throughput>0;laserMat.opacity=.2+.45*(1+Math.sin(s.seconds*14))/2;
    thermalMat.emissiveIntensity=.12+1.3*clamp((s.fryerTemp-145)/50,0,1);
    thermalMat.color.set(s.thermalTrip?red:'#f79531');
    thermalMat.emissive.set(s.thermalTrip?'#ff241a':'#ec591c');
    const phase=s.robotAngle;
    yaw.rotation.y=.1+.86*Math.sin(phase);shoulder.rotation.z=-.35-.35*Math.sin(phase);
    elbow.rotation.z=-1.5+.6*Math.cos(phase);roll.rotation.y=.58*Math.cos(phase);
    wrist.rotation.z=1.7+.2*Math.sin(phase);tool.rotation.y=.62*Math.sin(phase);
    crane.position.x=3.7*Math.sin(s.cranePhase);carriage.position.y=2.8+2.3*Math.sin(s.cranePhase*2);
    const u=((s.roverTravel%perimeter)+perimeter)%perimeter/perimeter;
    route.getPointAt(u,rover.position);
    const heading=route.getTangentAt(u);
    rover.rotation.y=Math.atan2(-heading.z,heading.x);
    turret.rotation.y=s.seconds*2.4;scanMat.color.set(s.faults.obstacle?'#f59e0b':'#38bed0');
    const alarms={'Z1-WB-01':s.faults.jam,'Z2-SB-01':s.faults.humidity,'Z3-FRY-01':s.thermalTrip,'AMR-01':s.faults.obstacle};
    for(const [id,g] of groups){
      g.visible=visible.has(id);
      const mat=assetMaterials.get(id);
      mat.emissive.set(alarms[id]?id==='AMR-01'||id==='Z2-SB-01'?'#6d3400':'#c01b12':id===selected?'#153747':'#000000');
      for(const m of indicators.get(id)||[])m.color.set(alarms[id]?id==='AMR-01'||id==='Z2-SB-01'?'#f59e0b':red:green);
    }
    for(let i=0;i<goods.count;i++){
      const x=-17.5+((s.travel+i*.52)%30.7),id=x< -6.25?'Z3-PEEL-01':x< -1.75?'Z3-SORT-01':x<10.25?'Z3-FRY-01':'Z4-ROB-01';
      t.position.set(x,1.34,4+Math.sin(i*14.17)*.58);t.rotation.set(0,i*1.65,0);
      const scale=visible.has(id)?1:0;t.scale.set(.44*scale,.27*scale,.30*scale);t.updateMatrix();
      goods.setMatrixAt(i,t.matrix);goods.setColorAt(i,x<-12?raw:x<4?peeled:fried);
    }
    goods.instanceMatrix.needsUpdate=true;goods.instanceColor.needsUpdate=true;
    routeLine.visible=rover.visible;
  }
  return {groups,animate,dispose(){scene.traverse(obj=>{if(obj.isInstancedMesh)obj.dispose();});for(const resource of resources)resource.dispose();}};
}
function createPlan(container,onSelect){
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  canvas.style.cssText='width:100%;height:100%;display:block;touch-action:manipulation';
  canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Factory floor plan. Select a machine on the plan or from the asset list.');
  canvas.dataset.renderer='plan';container.replaceChildren(canvas);
  let state,selection,visible,view='overview',hit=[];
  function draw(){
    if(!state)return;
    const {width:w,height:h}=container.getBoundingClientRect();if(w<1||h<1)return;
    const dpr=Math.min(devicePixelRatio||1,1.5);
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#0f1e33';ctx.fillRect(0,0,w,h);
    const pose=poses[view],amr=route.getPointAt(((state.roverTravel%perimeter)+perimeter)%perimeter/perimeter);
    const span=view==='overview'?56:view==='amr'?17:(view==='z3'?40:28);
    const scale=Math.min(w/span,h/(span*.7)),cx=view==='amr'?amr.x:pose[0],cz=view==='amr'?amr.z:pose[2];
    const project=(x,z)=>[w/2+(x-cx)*scale,h/2+(z-cz)*scale];
    const drawRect=(x,z,dx,dz,colour)=>{const [sx,sy]=project(x-dx/2,z-dz/2);ctx.fillStyle=colour;ctx.fillRect(sx,sy,dx*scale,dz*scale);};
    drawRect(0,-1,52,32,'#34485b');
    for(let x=-24;x<=24;x+=2)drawRect(x,-1,.025,31,'#566879');
    for(let z=-16;z<=14;z+=2)drawRect(0,z,51,.025,'#566879');
    ctx.strokeStyle='#507b86';ctx.setLineDash([4,4]);ctx.beginPath();
    route.getPoints(90).forEach((p,i)=>{const pt=project(p.x,p.z);if(i)ctx.lineTo(...pt);else ctx.moveTo(...pt);});
    ctx.closePath();ctx.stroke();ctx.setLineDash([]);
    hit=[];
    const sizes=[[10,6.8],[12.8,5.4],[6,3.4],[2.5,3],[7.4,3],[3,3],[9,7],[2.5,1.5]];
    for(const [i,[id,xx,zz]] of assets.entries()){
      if(!visible.has(id))continue;
      const x=id==='AMR-01'?amr.x:xx,z=id==='AMR-01'?amr.z:zz,[dx,dz]=sizes[i];
      const faulty=[state.faults.jam,state.faults.humidity,false,false,state.thermalTrip,false,false,state.faults.obstacle][i];
      drawRect(x,z,dx,dz,faulty?'#ac412c':id===selection?'#a47619':'#57788d');
      const [sx,sy]=project(x,z);
      ctx.textAlign='center';ctx.font='600 10px sans-serif';ctx.fillStyle='#fff';ctx.fillText(id,sx,sy+4);
      hit.push({id,x:sx,y:sy,w:Math.max(dx*scale,40),h:Math.max(dz*scale,20)});
    }
    ctx.textAlign='left';ctx.fillStyle='#94a3b8';ctx.fillText('PLAN  /  WEBGL UNAVAILABLE',12,19);
  }
  canvas.addEventListener('click',e=>{const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;const a=hit.find(a=>Math.abs(a.x-x)<a.w/2&&Math.abs(a.y-y)<a.h/2);if(a)onSelect(a.id);});
  const observer=new ResizeObserver(draw);observer.observe(container);
  return {update(s,id,ids){state=s;selection=id;visible=new Set(ids??assets.map(a=>a[0]));draw();},preset(key){if(poses[key])view=key;draw();},dispose(){observer.disconnect();canvas.remove();}};
}

export function createScene(container,onSelect){
  let renderer;
  try{renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}
  catch{return createPlan(container,onSelect);}
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(39,1,.08,380);
  scene.background=new T.Color('#0f1e33');scene.fog=new T.FogExp2('#0f1e33',.005);
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
  scene.add(new T.HemisphereLight('#e6f6ff','#8292a7',2.35));
  const key=new T.DirectionalLight('#ffefd0',2.45);key.position.set(-21,38,18);key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);
  Object.assign(key.shadow.camera,{left:-32,right:32,bottom:-32,top:32,near:1,far:110});
  key.shadow.normalBias=.045;scene.add(key);
  const rim=new T.DirectionalLight('#86bddd',1.45);rim.position.set(11,14,-22);scene.add(rim);
  const kit=createPlant(scene),canvas=renderer.domElement;
  canvas.tabIndex=0;canvas.dataset.renderer='webgl';
  canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label','Interactive 3D factory. Drag to orbit, shift-drag to pan, scroll to zoom. Select equipment to inspect. Arrow keys orbit and plus or minus zoom.');
  canvas.style.cssText='width:100%;height:100%;display:block;touch-action:none;cursor:grab';
  container.replaceChildren(canvas);
  const ctrl=new AbortController(),points=new Map(),target=xyz(0,0,0),ray=new T.Raycaster(),ndc=new T.Vector2();
  let width=1,height=1,yaw=.21,elevation=.60,range=59,mode='overview',moved=false,gesture=null;
  let lastDraw=0,activeState=null,selected=null,visible=new Set(assets.map(a=>a[0])),lastKeys='';
  function fitDistance(){
    const aspect=width/height,vertical=2*Math.tan(camera.fov*Math.PI/360);
    return Math.max(44,1.16*Math.max(59/(aspect*vertical),31/vertical));
  }
  function position(){
    if(mode==='amr'&&activeState){
      const v=kit.groups.get('AMR-01');target.copy(v.position);target.y=1;
    }
    const r=range*Math.cos(elevation);
    camera.position.set(target.x+r*Math.sin(yaw),target.y+range*Math.sin(elevation),target.z+r*Math.cos(yaw));
    camera.lookAt(target);camera.updateMatrixWorld();
  }
  function draw(){
    if(!activeState||!width||!height)return;
    position();renderer.render(scene,camera);lastDraw=performance.now();
  }
  function size(){
    const r=container.getBoundingClientRect();width=Math.max(1,Math.round(r.width));height=Math.max(1,Math.round(r.height));
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
    if(mode==='overview')range=fitDistance();draw();
  }
  function preset(k){
    const p=poses[k];if(!p)return;mode=k;target.set(p[0],p[1],p[2]);yaw=p[4];elevation=p[5];
    range=k==='overview'?fitDistance():p[3]*Math.max(1,1.38/camera.aspect);draw();
  }
  function rotate(dx,dy){yaw-=dx*.008;elevation=clamp(elevation+dy*.007,.10,1.49);}
  function pan(dx,dy){
    const scale=2*range*Math.tan(camera.fov*Math.PI/360)/height;
    target.x=clamp(target.x+(-dx*Math.cos(yaw)-dy*Math.sin(yaw))*scale,-31,31);
    target.z=clamp(target.z+(dx*Math.sin(yaw)-dy*Math.cos(yaw))*scale,-22,22);
  }
  function zoom(factor){range=clamp(range*factor,3.5,200);}
  function select(e){
    const rect=canvas.getBoundingClientRect();ndc.set(2*(e.clientX-rect.left)/rect.width-1,1-2*(e.clientY-rect.top)/rect.height);
    ray.setFromCamera(ndc,camera);
    const hits=ray.intersectObjects([...kit.groups.values()].filter(g=>g.visible),true);
    if(hits.length){let o=hits[0].object;while(o&&!o.userData.asset)o=o.parent;if(o)onSelect(o.userData.asset);}
  }
  function pair(){
    const [a,b]=points.values();return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,span:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};
  }
  function listen(name,handler,options={}){canvas.addEventListener(name,handler,{...options,signal:ctrl.signal});}
  listen('contextmenu',e=>e.preventDefault());
  listen('pointerdown',e=>{
    if(!points.size)moved=false;
    canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';
    points.set(e.pointerId,{x:e.clientX,y:e.clientY,x0:e.clientX,y0:e.clientY,pan:e.shiftKey||e.button===2||e.button===1});
    if(points.size===2){moved=true;gesture=pair();}
  });
  listen('pointermove',e=>{
    const prev=points.get(e.pointerId);if(!prev)return;
    const dx=e.clientX-prev.x,dy=e.clientY-prev.y;prev.x=e.clientX;prev.y=e.clientY;
    if(Math.hypot(prev.x-prev.x0,prev.y-prev.y0)>4)moved=true;
    if(!moved)return;mode='free';
    if(points.size===2&&gesture){const next=pair();pan(next.x-gesture.x,next.y-gesture.y);zoom(gesture.span/next.span);gesture=next;}
    else if(prev.pan)pan(dx,dy);else rotate(dx,dy);draw();
  });
  function end(e,click){
    if(!points.has(e.pointerId))return;
    if(click&&!moved&&e.button===0)select(e);points.delete(e.pointerId);gesture=null;
    if(!points.size)canvas.style.cursor='grab';
  }
  listen('pointerup',e=>end(e,true));listen('pointercancel',e=>end(e,false));listen('lostpointercapture',e=>end(e,false));
  listen('wheel',e=>{e.preventDefault();if(mode!=='amr')mode='free';zoom(Math.exp(clamp(e.deltaY,-180,180)*.0018));draw();},{passive:false});
  listen('keydown',e=>{
    const step=10;
    if(e.key==='Home'){preset('overview');e.preventDefault();return;}
    const movement={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}[e.key];
    if(movement){mode='free';if(e.shiftKey)pan(...movement);else rotate(...movement);}
    else if(['+','=','-'].includes(e.key)){mode='free';zoom(e.key==='-'?1.15:1/1.15);}
    else return;e.preventDefault();draw();
  });
  const observer=new ResizeObserver(size);observer.observe(container);size();preset('overview');
  return {
    update(s,id,ids){
      const next=ids??assets.map(a=>a[0]),keys=Array.from(next).join('/');
      const changed=keys!==lastKeys||selected!==id||!activeState;
      if(keys!==lastKeys){visible=new Set(next);lastKeys=keys;}
      activeState=s;selected=id;
      if(changed||performance.now()-lastDraw>=1000/30){kit.animate(s,id,visible);draw();}
    },
    preset,
    dispose(){ctrl.abort();observer.disconnect();kit.dispose();key.shadow.dispose();renderer.dispose();canvas.remove();}
  };
}
