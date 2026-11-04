import * as T from '../../../vendor/three.module.js';
import {batch,buildFactory,buildInventory,buildRacks,buildRoof,crateTint,makeKit} from './architecture.mjs';
import {buildStacker,buildTruck,disposeTree,palletBody} from './fleet.mjs';
import {sourceLibrary} from './sources.mjs';
import {facilityPlan} from './plan.mjs';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),v3=(x,y,z)=>new T.Vector3(x,y,z),modes=['overview','aisle','dock','packing','plan','follow','floor','custom'];
const zAxis=v3(0,0,1),boxGeo=new T.BoxGeometry(1,1,1);
export function warehouseCamera(raw){
  if(raw?.version!==1||!modes.includes(raw.mode)||!Array.isArray(raw.centre)||raw.centre.length!==3||!raw.centre.every(n=>Number.isFinite(n)&&Math.abs(n)<=400)||!Number.isFinite(raw.distance)||raw.distance<.65||raw.distance>300||!Number.isFinite(raw.yaw)||Math.abs(raw.yaw)>100||!Number.isFinite(raw.pitch)||raw.pitch<-.6||raw.pitch>1.571||typeof raw.cutaway!=='boolean')return null;
  return {version:1,mode:raw.mode,centre:[...raw.centre],distance:raw.distance,yaw:raw.yaw,pitch:raw.pitch,cutaway:raw.cutaway};
}
function elements(s){return [...s.vehicles,...s.bays,...s.doors,...s.aisles,...s.conveyors];}
export function createFacilityScene(container,{onSelect=()=>{},onCamera=()=>{}}={}){
  const canvas=document.createElement('canvas');
  let renderer;
  try{
    const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,powerPreference:'high-performance'});
    if(gl)renderer=new T.WebGLRenderer({canvas,context:gl,antialias:true,alpha:false});
  }catch{}
  if(!renderer)return facilityPlan(container,{onSelect,onCamera});
  canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Interactive fulfilment centre. Drag to orbit, shift-drag to pan, scroll to approach. W A S D move the floor camera. Select equipment to inspect.');canvas.dataset.renderer='webgl';container.dataset.renderer='webgl';canvas.style.cssText='display:block;width:100%;height:100%;touch-action:none;min-height:220px';
  container.replaceChildren(canvas);
  const scene=new T.Scene();scene.background=new T.Color('#d6e0e3');scene.fog=new T.FogExp2('#d4dde0',.0027);
  const camera=new T.PerspectiveCamera(48,1,.08,520);camera.up.copy(zAxis);
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.45));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.21;
  scene.add(new T.HemisphereLight(0xeaf2ff,0xb6ad98,1.85));
  const key=new T.DirectionalLight(0xfff1d4,2.25);key.position.set(-28,-42,55);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-46,right:46,top:40,bottom:-40,near:1,far:150});key.shadow.normalBias=.026;key.shadow.bias=-.00022;scene.add(key,key.target);
  const fill=new T.DirectionalLight(0xdfeaf1,.67);fill.position.set(28,12,17);scene.add(fill);
  const kit=makeKit(),lib=sourceLibrary(),root=new T.Group();scene.add(root);
  const pickers=[],vehicleMeshes=new Map(),trucks=new Map(),parcels=new Map(),stageLoads=new Map(),aisleRows=[];
  const pickMat=new T.MeshBasicMaterial({visible:false}),ray=new T.Raycaster();
  const ring=new T.Mesh(new T.RingGeometry(1.49,1.61,64),new T.MeshBasicMaterial({color:0x009284,transparent:true,opacity:.91,depthWrite:false}));
  ring.position.z=.034;ring.visible=false;root.add(ring);
  const routeLine=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial({color:0x0b9788,transparent:true,opacity:.85}));routeLine.visible=false;root.add(routeLine);
  const direction=new T.Vector3(),target=v3(-4,-5,1.7),eye=new T.Vector3(),look=new T.Vector3(),focus=new T.Vector3();
  let model=null,structure='',inventory='',stock=null,stockBases=null,factory=null,roof=null,dockProps=null,selected='',mode='overview',cutaway=true,distance=89,yaw=-2.03,pitch=.60,drag=null,pinch=null,disposed=false,synchronised=false,renderAt=0,followTurn=0,followManual=false,pathSig='',pointerSeq=new Map();
  let floorHeading=Math.PI*.5,floorPitch=-.02;
  const handler=new AbortController(),listen=(type,fn,opt={})=>canvas.addEventListener(type,fn,{...opt,signal:handler.signal});
  function selectedEntity(){return model&&elements(model).find(e=>e.id===selected);}
  function pickBox(id,x,y,z,w,d,h,rotation=0){
    const mesh=new T.Mesh(boxGeo,pickMat);mesh.position.set(x,y,z);mesh.scale.set(w,d,h);mesh.rotation.z=rotation;mesh.userData.id=id;mesh.updateMatrixWorld();pickers.push(mesh);return mesh;
  }
  function setSize(){if(disposed)return;const bounds=container.getBoundingClientRect();const w=Math.max(1,bounds.width),h=Math.max(220,bounds.height);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();if(model)draw(true);}
  function removeStructure(){
    for(const g of [factory,roof,dockProps,stock,stockBases])if(g)disposeTree(g);
    for(const r of aisleRows){disposeTree(r.coarse);disposeTree(r.detail);}aisleRows.length=0;
    trucks.forEach(g=>disposeTree(g));trucks.clear();vehicleMeshes.forEach(v=>{disposeTree(v.root);for(const g of v.owned||[]){g.geometry.dispose();g.material.dispose();}});vehicleMeshes.clear();
    for(const map of [parcels,stageLoads]){map.forEach(g=>disposeTree(g));map.clear();}
    pickers.length=0;inventory='';pathSig='';
  }
  function architecture(s){
    removeStructure();factory=buildFactory(kit,s);roof=buildRoof(kit);dockProps=lib.docks(s);root.add(factory,roof,dockProps);roof.visible=!cutaway;
    for(const aisle of s.aisles){
      const bays=s.bays.filter(b=>b.aisle===aisle.id),coarse=buildRacks(kit,{bays}),detail=lib.detailRack(bays);root.add(coarse,detail);aisleRows.push({x:aisle.x,coarse,detail});
      pickBox(aisle.id,aisle.x,0,.025,1.75,32,.05);
    }
    for(const b of s.bays)pickBox(b.id,b.x,b.y,1.73,1.39,3.94,3.46);
    for(const d of s.doors){const truck=buildTruck(kit,trucks.size);truck.position.set(d.x,d.y,.025);root.add(truck);trucks.set(d.id,truck);pickBox(d.id,d.x,d.y-7.4,1.96,2.7,16.2,4.1);}
    for(const c of s.conveyors)pickBox(c.id,c.x,c.y,1.20,c.length,1.65,2.4);
    for(const [i,v] of s.vehicles.entries()){
      let truck;
      if(i%3!==0)truck=buildStacker(kit,v.id);
      else{
        const body=lib.lift(),group=new T.Group(),carriage=new T.Group(),b=batch(kit);
        group.add(body.frame);carriage.add(body.forks);group.add(carriage);
        b.box('#bb873a',-.62,0,.54,.48,.72,.28);for(const y of [-.26,.26])b.box('#5a6261',-.05,y,.76,.09,.05,1.4);
        group.add(b.finish());truck={root:group,carriage,wheels:[],owned:[body.frame,body.forks],real:true};
      }
      truck.picker=pickBox(v.id,v.x,v.y,1.1,2.9,1.24,2.24);truck.travel=0;truck.last=[v.x,v.y];
      root.add(truck.root);vehicleMeshes.set(v.id,truck);
    }
  }
  function redrawInventory(s){
    const sig=s.bays.map(b=>b.stock.map(v=>v.id+'@'+v.level).join(',')).join('|');if(sig===inventory)return;
    if(stock)disposeTree(stock);if(stockBases)disposeTree(stockBases);
    stock=buildInventory(kit,s);stockBases=lib.stockBases(s.bays);root.add(stock,stockBases);inventory=sig;
    canvas.dataset.pallets=String(stock.userData.loadedPallets);
  }
  function updateLoads(list,cache){
    const seen=new Set();
    for(const v of list){seen.add(v.id);let shape=cache.get(v.id);if(!shape){shape=palletBody(kit,v);root.add(shape);cache.set(v.id,shape);}shape.position.set(v.x,v.y,v.z);shape.rotation.z=v.yaw||0;}
    for(const [id,obj] of cache)if(!seen.has(id)){disposeTree(obj);cache.delete(id);}
  }
  function dynamics(s){
    for(const v of s.vehicles){
      const obj=vehicleMeshes.get(v.id);if(!obj)continue;
      const travel=Math.hypot(v.x-obj.last[0],v.y-obj.last[1]);obj.travel+=Math.min(2,travel);obj.last=[v.x,v.y];
      obj.root.position.set(v.x,v.y,.035+(v.z||0));obj.root.rotation.z=v.heading;
      obj.picker.position.set(v.x,v.y,1.13);obj.picker.rotation.z=v.heading;obj.picker.updateMatrixWorld(true);
      obj.carriage.position.z=Math.max(.065,v.forkHeightM??.11);for(const wheel of obj.wheels)wheel.rotation.y=obj.travel/.27;
      if(obj.load?.userData.id!==v.load?.id){
        if(obj.load)disposeTree(obj.load);obj.load=null;
        if(v.load){obj.load=palletBody(kit,v.load);obj.load.userData.id=v.load.id;obj.load.position.set(obj.real?.48:1.42,0,.06);obj.carriage.add(obj.load);}
      }
    }
    updateLoads(s.conveyors.flatMap(c=>(c.parcels||[]).map(p=>({...p,x:c.x-c.length/2+p.progress,y:c.y,z:1.28}))),parcels);
    updateLoads(s.doors.flatMap(d=>(d.staged||[]).slice(-8).map((p,i)=>({...(typeof p==='string'?{id:p,sku:p}:p),x:d.x+(i%2-.5)*1.38,y:d.y+3.3+Math.floor(i/2)*1.24,z:.05}))),stageLoads);
    for(const d of s.doors)trucks.get(d.id).visible=Boolean(d.trailer);
  }
  function frameCamera(snap){
    const v=model.vehicles.find(v=>v.id===selected),dt=Math.min(.15,Math.max(.005,(performance.now()-renderAt)/1000));
    if(mode==='follow'&&v){
      const h=v.heading+followTurn,front=v3(Math.cos(h),Math.sin(h),0),side=v3(-front.y,front.x,0);
      const loadHeight=v.forkHeightM??.2;
      look.set(v.x,v.y,1.06+Math.max(0,loadHeight-.22)*.45).addScaledVector(front,.57);
      if(followManual){
        eye.set(v.x,v.y,1.20+distance*Math.sin(pitch)).addScaledVector(front,-distance*Math.cos(pitch)).addScaledVector(side,distance*.28);
      }else if(v.y < -16.5){
        eye.set(v.x-distance*.68,v.y-distance*.65,1.15+distance*.42);
        look.set(v.x+.4,v.y+.45,1.02+Math.max(0,loadHeight-.22)*.45);
      }else if(v.y<=17){
        const aisle=model.aisles.reduce((best,a)=>Math.abs(a.x-v.x)<Math.abs(best.x-v.x)?a:best,model.aisles[0]);
        eye.set(aisle.x-.18,Math.max(-21,v.y-distance*.95),1.4+distance*.28);
        look.set(v.x,v.y+.3,1.04+Math.max(0,loadHeight-.22)*.45);
      }else{
        eye.set(v.x-distance*.65,v.y-distance*.75,1.30+distance*.40);
      }
      if(snap||!synchronised){camera.position.copy(eye);focus.copy(look);}else{const alpha=1-Math.exp(-dt*9);camera.position.lerp(eye,alpha);focus.lerp(look,alpha);}
      target.copy(focus);
    }else if(mode==='floor'){
      camera.position.copy(target);camera.position.z=1.68;focus.copy(camera.position).add(v3(Math.cos(floorHeading)*Math.cos(floorPitch),Math.sin(floorHeading)*Math.cos(floorPitch),Math.sin(floorPitch)));
    }else{
      focus.copy(target);camera.position.set(Math.cos(yaw)*Math.cos(pitch),Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch)).multiplyScalar(distance).add(target);
    }
    camera.lookAt(focus);camera.updateMatrixWorld();synchronised=true;renderAt=performance.now();
    const nearView=mode==='floor'||mode==='follow'||distance<25;
    for(const aisle of aisleRows){const close=nearView&&Math.abs(aisle.x-focus.x)<9;aisle.detail.visible=close;aisle.coarse.visible=!close;}
    if(nearView){key.position.set(focus.x-18,focus.y-24,36);key.target.position.set(focus.x,focus.y,0);}
    else{key.position.set(-28,-35,62);key.target.position.set(0,0,0);}
    const extent=nearView?20:84,shadow=key.shadow.camera;if(shadow.top!==extent){Object.assign(shadow,{left:-extent,right:extent,top:extent,bottom:-extent});shadow.updateProjectionMatrix();}
  }
  function highlight(){
    const a=selectedEntity();ring.visible=Boolean(a);routeLine.visible=false;
    if(!a)return;
    const sz=a.kind==='electric-pallet-stacker'?.88:a.stock?1.17:a.trailer?1.8:a.parcels?1.5:1.0;
    ring.scale.set(sz,sz,1);ring.position.set(a.x,a.y,.045);
    if(a.route?.length){
      const stops=a.route.filter(r=>r.kind==='travel').slice(0,4),points=[[a.x,a.y],...stops.map(r=>[r.x,r.y])];
      if(points.length>1){const sig=JSON.stringify(points);if(pathSig!==sig){routeLine.geometry.dispose();routeLine.geometry=new T.BufferGeometry().setFromPoints(points.map(([x,y])=>v3(x,y,.043)));pathSig=sig;}routeLine.visible=true;}
    }
  }
  function draw(snap=false){if(!model||disposed)return;frameCamera(snap);highlight();renderer.render(scene,camera);}
  function update(s){
    if(disposed||!s)return;model=s;const signature=[s.aisles.length,s.bays.length,s.vehicles.map(v=>v.id),s.doors.map(d=>d.id)].join('/');
    if(structure!==signature){architecture(s);structure=signature;}
    redrawInventory(s);dynamics(s);draw();
  }
  function select(id){const old=selected;selected=id;canvas.dataset.selected=id;if(old!==id&&mode==='follow')synchronised=false;draw();}
  function view(name){
    if(!modes.includes(name))return;const a=selectedEntity(),vehicle=model?.vehicles.find(v=>v.id===selected)||model?.vehicles[0];
    mode=name;canvas.dataset.view=name;
    if(name==='follow'&&vehicle){if(vehicle.id!==selected){selected=vehicle.id;canvas.dataset.selected=selected;}distance=6.3;pitch=.38;followTurn=.58;followManual=false;synchronised=false;}
    else if(name==='floor'){target.set(a?.x??-5,(a?.y??-13)-4,1.68);floorHeading=Math.PI/2;floorPitch=-.02;}
    else if(name==='plan'){target.set(0,-6,0);yaw=-Math.PI/2;pitch=Math.PI/2-.0002;distance=Math.max(110,154/Math.max(.7,camera.aspect));}
    else if(name==='dock'){target.set(a?.trailer?a.x:8,-31,1.4);distance=24;yaw=-2.13;pitch=.40;}
    else if(name==='packing'){target.set(a?.parcels?a.x:19,21,1.15);distance=21;yaw=-2.12;pitch=.37;}
    else if(name==='aisle'){target.set(a?.x??0,a?.y??-8,1.25);distance=13;yaw=-1.76;pitch=.32;}
    else{target.set(0,-5,1.4);yaw=-1.83;pitch=.64;target.set(0,-10,1.5);
      const normal=v3(Math.cos(yaw)*Math.cos(pitch),Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch)),right=new T.Vector3().crossVectors(zAxis,normal).normalize(),vertical=new T.Vector3().crossVectors(normal,right).normalize(),tan=Math.tan(camera.fov*Math.PI/360);
      distance=20;for(const x of [-68,68])for(const y of [-48,31])for(const z of [0,10]){const p=v3(x,y,z).sub(target);distance=Math.max(distance,p.dot(normal)+Math.max(Math.abs(p.dot(right))/(tan*camera.aspect),Math.abs(p.dot(vertical))/tan)*1.12);}
}
    draw(true);onCamera(name);
  }
  function saveView(){return {version:1,mode,centre:target.toArray(),distance,yaw:mode==='follow'?followTurn:mode==='floor'?floorHeading:yaw,pitch:mode==='floor'?floorPitch:pitch,cutaway};}
  function restoreView(raw){const pose=warehouseCamera(raw);if(!pose)return false;mode=pose.mode;target.fromArray(pose.centre);distance=pose.distance;yaw=pose.yaw;pitch=pose.pitch;floorHeading=yaw;floorPitch=pitch;followTurn=yaw;followManual=mode==='follow';setCutaway(pose.cutaway);canvas.dataset.view=mode;synchronised=false;draw(true);onCamera(mode);return true;}
  function setCutaway(value){cutaway=Boolean(value);if(roof)roof.visible=!cutaway;canvas.dataset.cutaway=String(cutaway);draw();}
  function floorWalk(forward,side){
    target.x=clamp(target.x+Math.cos(floorHeading)*forward-Math.sin(floorHeading)*side,-72,72);
    target.y=clamp(target.y+Math.sin(floorHeading)*forward+Math.cos(floorHeading)*side,-52,32);
  }
  function pan(dx,dy){
    if(mode==='floor'){floorWalk(dy*.03,-dx*.03);return;}
    if(mode==='follow'){mode='custom';yaw=Math.atan2(camera.position.y-focus.y,camera.position.x-focus.x);target.copy(focus);}
    mode='custom';canvas.dataset.view=mode;const k=distance/Math.max(220,canvas.clientHeight)*.84;
    target.x+=(-Math.sin(yaw)*dx+Math.cos(yaw)*dy)*k;target.y+=(Math.cos(yaw)*dx+Math.sin(yaw)*dy)*k;
    target.x=clamp(target.x,-80,80);target.y=clamp(target.y,-60,45);
  }
  function rotate(dx,dy){
    if(mode==='floor'){floorHeading-=dx*.007;floorPitch=clamp(floorPitch-dy*.004,-.48,1.25);}
    else if(mode==='follow'){followManual=true;followTurn-=dx*.008;pitch=clamp(pitch+dy*.006,.05,1.43);}
    else{mode='custom';canvas.dataset.view=mode;yaw-=dx*.008;pitch=clamp(pitch+dy*.006,.045,1.567);}
  }
  function zoom(factor){if(mode==='floor')floorWalk((1-factor)*5,0);else distance=clamp(distance*factor,1.15,270);}
  function midpoint(){const [a,b]=[...pointerSeq.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.max(2,Math.hypot(a.x-b.x,a.y-b.y))};}
  function pick(e){
    const r=canvas.getBoundingClientRect();ray.setFromCamera({x:(e.clientX-r.left)/r.width*2-1,y:1-(e.clientY-r.top)/r.height*2},camera);
    const hit=ray.intersectObjects(pickers,false)[0];if(hit){select(hit.object.userData.id);onSelect(selected);}
  }
  listen('pointerdown',e=>{e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);pointerSeq.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointerSeq.size===2){pinch=midpoint();drag=null;return;}drag={x:e.clientX,y:e.clientY,ox:e.clientX,oy:e.clientY,pan:e.shiftKey||e.button!==0,moved:false};});
  listen('pointermove',e=>{if(!pointerSeq.has(e.pointerId))return;pointerSeq.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointerSeq.size===2){const now=midpoint();if(pinch){zoom(pinch.d/now.d);pan(now.x-pinch.x,now.y-pinch.y);}pinch=now;draw(true);return;}
    if(!drag||pointerSeq.size!==1)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(e.clientX-drag.ox,e.clientY-drag.oy)<3&&!drag.moved)return;
    drag.moved=true;drag.x=e.clientX;drag.y=e.clientY;if(drag.pan)pan(dx,dy);else rotate(dx,dy);draw(true);
  });
  listen('pointerup',e=>{if(drag&&!drag.moved&&pointerSeq.size===1)pick(e);pointerSeq.delete(e.pointerId);drag=null;pinch=null;});
  listen('pointercancel',e=>{pointerSeq.delete(e.pointerId);drag=null;pinch=null;});
  listen('wheel',e=>{e.preventDefault();zoom(Math.exp(clamp(e.deltaY,-240,240)*.0018));draw(true);},{passive:false});
  listen('contextmenu',e=>e.preventDefault());
  listen('keydown',e=>{const k=e.key.toLowerCase();if(k==='home')view('overview');else if(['+','=','-'].includes(k))zoom(k==='-'?1.20:1/1.20);else if(mode==='floor'&&['w','a','s','d'].includes(k))floorWalk(k==='w'?.8:k==='s'?-.8:0,k==='a'?.8:k==='d'?-.8:0);else if(k.startsWith('arrow')){const x=k==='arrowleft'?-13:k==='arrowright'?13:0,y=k==='arrowup'?-13:k==='arrowdown'?13:0;if(e.shiftKey)pan(x,y);else rotate(x,y);}else return;e.preventDefault();draw(true);});
  const observer=new ResizeObserver(setSize);observer.observe(container);setSize();
  function dispose(){if(disposed)return;disposed=true;handler.abort();observer.disconnect();removeStructure();ring.geometry.dispose();ring.material.dispose();routeLine.geometry.dispose();routeLine.material.dispose();pickMat.dispose();kit.dispose();lib.dispose();key.shadow.dispose();renderer.dispose();canvas.remove();}
  return {update,select,view,saveView,restoreView,setCutaway,dispose};
}
