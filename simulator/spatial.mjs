// Geometric study model. Dimensions and arrangement are illustrative, never as-built.
import * as T from './vendor/three.module.js';
import {SVGRenderer} from './vendor/SVGRenderer.js';

export const LAYOUT = [
 ['intake',-16,-8],['wash',-8,-8],['peel',0,-8],['sort',8,-8],['cut',16,-8],
 ['blanch',16,0],['dry',8,0],['coat',0,0],['form',-8,0],['fry',-16,0],
 ['cool',-16,8],['freeze',-8,8],['inspect',0,8],['pack',8,8],['pallet',16,8]
];
const colours={steel:0xbcc8cc,light:0xe6ecee,dark:0x51616a,belt:0x3c5260,blue:0x2563af,green:0x26815c,amber:0xb98121,red:0xbc453c};
const material=(c,metal=.35)=>new T.MeshStandardMaterial({color:c,metalness:metal,roughness:.48});
const mats=Object.fromEntries(Object.entries(colours).map(([k,v])=>[k,material(v)]));
mats.potato=material(0xc99c54,0);mats.fries=material(0xe3be72,0);mats.box=material(0xb49568,0);mats.water=material(0x669daf,.1);mats.oil=material(0x9c782b,.2);
const geometryCache=new Map();
function box(g,x,y,z,w,h,d,m=mats.steel){const key=`b:${w}:${h}:${d}`;if(!geometryCache.has(key))geometryCache.set(key,new T.BoxGeometry(w,h,d));const o=new T.Mesh(geometryCache.get(key),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;}
function cylinder(g,x,y,z,r,h,m=mats.steel,axis='y',r2=r){const key=`c:${r}:${r2}:${h}`;if(!geometryCache.has(key))geometryCache.set(key,new T.CylinderGeometry(r,r2,h,20));const o=new T.Mesh(geometryCache.get(key),m);o.position.set(x,y,z);if(axis==='x')o.rotation.z=Math.PI/2;if(axis==='z')o.rotation.x=Math.PI/2;o.castShadow=true;o.receiveShadow=true;g.add(o);return o;}
function pipe(g,from,to,r=.06,m=mats.steel){const a=new T.Vector3(...from),b=new T.Vector3(...to),d=b.clone().sub(a),o=cylinder(g,0,0,0,r,d.length(),m);o.position.copy(a.add(b).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;}
function legs(g,w,d,height=1.2){for(const x of [-w/2,w/2])for(const z of [-d/2,d/2]){box(g,x,height/2,z,.11,height,.11,mats.dark);cylinder(g,x,.05,z,.15,.1,mats.dark);}}
function rail(g,w,d,y=2){for(const z of [-d/2,d/2]){pipe(g,[-w/2,y,z],[w/2,y,z],.035);for(let x=-w/2;x<=w/2;x+=w/4)pipe(g,[x,y-.7,z],[x,y,z],.025);}}
function conveyor(g,w=5,d=1.4,y=1.3){box(g,0,y,0,w,.14,d,mats.belt);for(const z of [-d/2,d/2])box(g,0,y+.12,z,w,.2,.1);for(let x=-w/2+.2;x<w/2;x+=.45)cylinder(g,x,y-.06,0,.09,d,mats.steel,'z');legs(g,w-.3,d-.15,y);}
function panels(g,w,h,d,y=1.3){box(g,0,y+h/2,0,w,h,d,mats.light);for(let x=-w/2+.15;x<w/2;x+=1.2){box(g,x,y+h/2,d/2+.02,.025,h,.025,mats.dark);box(g,x+.17,y+h*.55,d/2+.06,.055,.25,.05,mats.dark);}}
function drive(g,x,y,z){cylinder(g,x,y,z,.22,.48,mats.green,'z');for(let a=0;a<5;a++)box(g,x,y,z-.2+a*.1,.5,.36,.025,mats.dark);}
function platform(g,w=5,d=2.6){box(g,0,1.25,d/2+.6,w,.12,.8);rail(g,w,.75,2.2);for(let i=0;i<5;i++)box(g,-w/2-.15,.14+i*.24,d/2+1.9-i*.24,.75,.1,.3);}
function machine(id){const g=new T.Group();const parts={};
 switch(id){
 case 'intake': {
  legs(g,3.2,2.5,3);const h=cylinder(g,0,2.8,0,2.2,2,mats.steel,'y',.85);h.geometry=new T.CylinderGeometry(2.2,.85,2,4,1,true);h.rotation.y=Math.PI/4;
  box(g,0,2.95,0,2.65,.12,2.65,mats.potato);conveyor(g,5,1.35,.9);drive(g,1.8,.7,.9);break;
 }
 case 'wash':case 'coat': {
  conveyor(g,5.5);cylinder(g,0,2.1,0,1,3.8,mats.steel,'x');
  for(const x of [-1.65,0,1.65]){cylinder(g,x,2.1,0,1.05,.1,mats.dark,'x');}
  cylinder(g,2,2.1,0,.7,.1,mats.dark,'x');for(const x of [-1.5,1.5])box(g,x,1.1,0,.28,1.8,1.8,mats.dark);
  pipe(g,[-2,3.3,-.5],[2,3.3,-.5],.08,id==='wash'?mats.blue:mats.steel);for(const x of [-1.5,0,1.5])pipe(g,[x,3.3,-.5],[x,2.9,0],.04);drive(g,1.4,.7,1);break;
 }
 case 'peel': {
  legs(g,2,2,1.3);cylinder(g,0,2.5,0,1.2,2.8);cylinder(g,0,4,0,1.24,.15,mats.dark);cylinder(g,0,4.25,0,.55,.4);pipe(g,[0,4.4,0],[0,4.4,-1.6],.15);pipe(g,[0,4.4,-1.6],[0,0,-1.6],.15);conveyor(g,5,1.3,1);platform(g,3,2.7);break;
 }
 case 'sort':case 'inspect': {
  conveyor(g,5.1);box(g,0,2.15,0,1.6,1.6,2.05,mats.light);box(g,0,1.68,1.04,1.03,.55,.045,mats.dark);box(g,.45,2.45,1.08,.42,.3,.05,mats.blue);pipe(g,[-.7,2.8,0],[.7,2.8,0],.08,mats.blue);drive(g,1.8,.9,.9);break;
 }
 case 'cut': {
  conveyor(g,5.4);cylinder(g,0,1.9,0,.7,2.4,mats.steel,'x');box(g,.7,1.5,0,.7,1.5,1.8);pipe(g,[-2.5,1.9,0],[-1.1,1.9,0],.35);drive(g,.6,1.05,1.2);break;
 }
 case 'blanch':case 'fry': {
  legs(g,5,2.7,1.3);box(g,0,1.7,0,5.6,1.1,3);box(g,0,2.28,0,5.2,.06,2.5,id==='fry'?mats.oil:mats.water);
  for(const z of [-1.4,1.4])box(g,0,2.5,z,5.7,.45,.2,mats.light);
  for(let x=-2.4;x<=2.4;x+=1.2)pipe(g,[x,2.3,-1.4],[x,2.7,1.4],.045);
  box(g,0,3.15,0,5.9,.22,3.05,mats.light);cylinder(g,-1.6,4,0,.32,1.7);cylinder(g,1.6,3.8,0,.26,1.3);
  pipe(g,[-2,1.1,-1.8],[2,1.1,-1.8],.15,id==='fry'?mats.amber:mats.blue);platform(g,5.5,3);drive(g,2.6,1,1.8);break;
 }
 case 'dry':case 'cool':case 'freeze': {
  conveyor(g,6.1,1.5,1.15);panels(g,5.5,id==='freeze'?3:1.9,2.9,1.2);
  const top=id==='freeze'?4.25:3.16;parts.fans=[];
  for(const x of [-1.7,0,1.7]){cylinder(g,x,top,0,.58,.24,mats.dark);const fan=new T.Group();fan.position.set(x,top+.15,0);for(let i=0;i<4;i++){const blade=box(fan,0,0,0,1,.025,.14);blade.rotation.y=i*Math.PI/4;}g.add(fan);parts.fans.push(fan);}
  if(id==='freeze')for(const x of [-2,0,2])box(g,x,2.7,1.5,.08,2.7,.06,mats.blue);drive(g,2.6,.8,1.5);break;
 }
 case 'form': {
  conveyor(g,5);panels(g,2.4,1.25,2,1.25);cylinder(g,0,3,0,.95,1,mats.steel,'y',.45);cylinder(g,0,2,0,.5,2,mats.dark,'z');drive(g,1.4,.85,.8);break;
 }
 case 'pack': {
  conveyor(g,5);legs(g,2.7,2.5,4.2);box(g,0,3.6,0,3,.2,2.8);cylinder(g,0,4.1,0,1.15,.8,mats.steel,'y',.3);
  for(let a=0;a<12;a++){const t=a*Math.PI/6;box(g,Math.cos(t),3.9,Math.sin(t),.35,.65,.4);}
  for(const x of [-.6,.6]){cylinder(g,x,2.6,0,.22,1.2);box(g,x,1.7,0,.55,.7,.3,mats.fries);box(g,x,2.2,0,.8,.14,.55,mats.dark);}
  box(g,1.5,2.9,1.4,.55,.65,.15,mats.blue);break;
 }
 case 'pallet': {
  conveyor(g,5);cylinder(g,0,.8,-.2,.65,1.6,mats.amber);const robot=new T.Group();robot.position.set(0,1.6,-.2);
  cylinder(robot,0,0,0,.42,.85,mats.dark,'z');pipe(robot,[0,0,0],[-.6,1.8,0],.26,mats.amber);cylinder(robot,-.6,1.8,0,.33,.7,mats.dark,'z');pipe(robot,[-.6,1.8,0],[1.2,2.4,0],.22,mats.amber);pipe(robot,[1.2,2.4,0],[1.2,1.7,0],.13,mats.dark);box(robot,1.2,1.6,0,.85,.13,.85);g.add(robot);parts.robot=robot;
  for(const z of [-2.5,2.5]){for(const x of [-3,0,3])box(g,x,1.15,z,.06,2.3,.06,mats.amber);for(const y of [.3,1.25,2.2])pipe(g,[-3,y,z],[3,y,z],.025,mats.amber);for(let x=-3;x<=3;x+=.25)pipe(g,[x,.3,z],[x,2.2,z],.008,mats.dark);}
  for(const y of [.15,.65,1.15])for(const x of [1.3,2])for(const z of [1,1.7])box(g,x,y,z,.6,.43,.6,mats.box);break;
 }
 }
 // Common control cabinet and signal column.
 box(g,-1.7,1.4,-1.7,.65,1.4,.35,mats.light);box(g,-1.7,1.65,-1.89,.42,.28,.03,mats.blue);
 pipe(g,[-1.7,2.1,-1.7],[-1.7,2.7,-1.7],.035);parts.lamp=cylinder(g,-1.7,2.75,-1.7,.09,.18,mats.green);
 return {g,...parts};
}
export class SpatialPlant {
 constructor(host,onSelect,onFailure){
  this.host=host;this.onSelect=onSelect;this.zoom=1;this.yaw=.24;this.plan=false;this.overlay='status';this.labels=true;this.services=true;this.running=false;this.model=null;this.focusId=null;this.disposed=false;
  this.scene=new T.Scene();this.scene.background=new T.Color(0xe9edef);
  this.camera=new T.OrthographicCamera(-30,30,20,-20,.1,180);this.target=new T.Vector3(0,0,0);
  try{const canvas=document.createElement('canvas'),context=canvas.getContext('webgl2',{antialias:true,alpha:false,powerPreference:'low-power'});this.vector=!context;this.renderer=context?new T.WebGLRenderer({canvas,context,antialias:true,alpha:false}):new SVGRenderer();host.dataset.renderer=this.vector?'vector':'webgl';}catch(e){onFailure(e);return;}
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));if(this.renderer.shadowMap){this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;}this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.1;
  this.canvas=this.renderer.domElement;this.canvas.setAttribute('aria-label','Interactive 3D potato plant. Select a numbered equipment marker to inspect.');this.canvas.setAttribute('role','img');host.append(this.canvas);
  this.scene.add(this.vector?new T.AmbientLight(0xffffff,.25):new T.HemisphereLight(0xffffff,0x667b87,1.7));const sun=new T.DirectionalLight(0xffffff,this.vector ? .45 : 2);sun.position.set(-12,32,18);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-34,right:34,top:28,bottom:-28,far:100});sun.shadow.bias=-.0005;sun.shadow.normalBias=.03;this.scene.add(sun);
  box(this.scene,0,-.18,0,48,.3,29,material(0xcfd8dc,0));
  const grid=new T.GridHelper(48,24,0xc1ccd1,0xd0d9dd);grid.position.y=-.018;grid.scale.z=29/48;this.scene.add(grid);
  for(const z of [-11,-3,5,12]){box(this.scene,0,.005,z,44,.025,.045,material(0xb3bec4,0));}
  this.objects=new Map();this.markers=new Map();this.hit=[];this.items=[];this.visualTime=0;
  LAYOUT.forEach(([id,x,z],i)=>{
   const obj=machine(id);obj.g.position.set(x,0,z);obj.g.userData.unit=id;obj.g.traverse(o=>{if(o.isMesh){o.userData.unit=id;this.hit.push(o);}});this.scene.add(obj.g);this.objects.set(id,obj);
   const b=document.createElement('button');b.type='button';b.className='asset-pin';b.dataset.unit=id;b.innerHTML=`<span>${String(i+1).padStart(2,'0')}</span><strong></strong><small></small>`;host.append(b);this.markers.set(id,b);
   const dir=i>=5&&i<10?-1:1;
   for(let j=0;j<12;j++){const p=new T.Mesh(i<4?new T.IcosahedronGeometry(.13,1):new T.BoxGeometry(.22,.055,.07),i<4?mats.potato:mats.fries);p.userData={unit:id,j,dir};this.scene.add(p);this.items.push(p);}
  });
  for(let i=0;i<14;i++){const a=LAYOUT[i],b=LAYOUT[i+1];const x=(a[1]+b[1])/2,z=(a[2]+b[2])/2,distance=Math.hypot(b[1]-a[1],b[2]-a[2]);const g=new T.Group();conveyor(g,Math.max(1,distance-3.4),1.2,1.2);g.position.set(x,0,z);g.rotation.y=a[1]===b[1]?Math.PI/2:0;this.scene.add(g);}
  this.serviceGroup=new T.Group();this.scene.add(this.serviceGroup);
  for(const [z,mat] of [[-12.5,mats.blue],[-11.9,mats.green]]){pipe(this.serviceGroup,[-22,4.5,z],[21,4.5,z],.075,mat);for(const x of [-20,-8,0,8,20]){pipe(this.serviceGroup,[x,.1,z],[x,4.5,z],.055);pipe(this.serviceGroup,[x,4.5,z],[x,3.4,-8],.055,mat);}}
  for(const x of [-21,21]){cylinder(this.serviceGroup,x,2,-11,1.1,4);cylinder(this.serviceGroup,x,4.05,-11,1.1,.12,mats.dark);}
  const outline=new T.EdgesGeometry(new T.BoxGeometry(6.5,4.8,4));this.selection=new T.LineSegments(outline,new T.LineBasicMaterial({color:colours.blue,transparent:true,opacity:.7}));this.scene.add(this.selection);
  this.raycaster=new T.Raycaster();this.pointer=new T.Vector2();this.drag=null;
  this.down=e=>{if(e.button!==0)return;this.drag={x:e.clientX,y:e.clientY,yaw:this.yaw,moved:false};this.canvas.setPointerCapture(e.pointerId);};
  this.move=e=>{if(!this.drag)return;const dx=e.clientX-this.drag.x;if(Math.abs(dx)>4)this.drag.moved=true;if(this.drag.moved){this.yaw=this.drag.yaw+dx*.008;this.plan=false;this.cameraUpdate();}};
  this.up=e=>{if(!this.drag)return;const d=this.drag;this.drag=null;if(d.moved)return;const r=this.canvas.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);const h=this.raycaster.intersectObjects(this.hit,false)[0];if(h)this.onSelect(h.object.userData.unit);};
  this.wheel=e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();this.command(e.deltaY>0?'out':'in');};
  this.canvas.addEventListener('pointerdown',this.down);this.canvas.addEventListener('pointermove',this.move);this.canvas.addEventListener('pointerup',this.up);this.canvas.addEventListener('pointercancel',()=>this.drag=null);this.canvas.addEventListener('wheel',this.wheel,{passive:false});
  this.contextLost=e=>{e.preventDefault();onFailure(new Error('3D graphics context lost'));};this.canvas.addEventListener('webglcontextlost',this.contextLost);
  this.resize=new ResizeObserver(()=>this.cameraUpdate());this.resize.observe(host);this.cameraUpdate();
  this.dirty=true;this.lastFrame=0;this.frame=now=>{if(this.disposed)return;if(!document.hidden&&(this.dirty||(this.running&&now-this.lastFrame>(this.vector?200:33)))){this.animate();this.renderer.render(this.scene,this.camera);this.lastFrame=now;this.dirty=false;}this.raf=requestAnimationFrame(this.frame);};this.raf=requestAnimationFrame(this.frame);
 }
 cameraUpdate(){this.dirty=true;if(!this.renderer)return;const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);const aspect=w/h,size=Math.max(17,28/aspect)/this.zoom;this.camera.left=-size*aspect;this.camera.right=size*aspect;this.camera.top=size;this.camera.bottom=-size;const elev=this.plan?Math.PI/2-.001:.82,dist=55;this.camera.position.set(this.target.x+Math.sin(this.yaw)*Math.cos(elev)*dist,Math.sin(elev)*dist,this.target.z+Math.cos(this.yaw)*Math.cos(elev)*dist);this.camera.lookAt(this.target);this.camera.updateProjectionMatrix();this.positionLabels();}
 command(action){switch(action){case 'fit':this.zoom=1;this.yaw=.24;this.plan=false;this.target.set(0,0,0);this.focusId=null;break;case 'plan':this.plan=true;this.yaw=0;break;case 'orbit':this.plan=false;this.yaw+=Math.PI/6;break;case 'in':this.zoom=Math.min(3,this.zoom+.25);break;case 'out':this.zoom=Math.max(.7,this.zoom-.25);break;case 'focus':{const p=LAYOUT.find(x=>x[0]===this.selected);if(p){this.target.set(p[1],1,p[2]);this.zoom=2.5;this.focusId=this.selected;}break;}}this.cameraUpdate();this.host.dataset.camera=`${this.plan?'plan':'orbit'}:${this.yaw.toFixed(2)}:${this.zoom.toFixed(2)}:${this.focusId||'all'}`;}
 update(s,selected,playing,rate,{overlay='status',labels=true,services=true,dark=false}={}){
  if(!this.renderer)return;this.dirty=true;this.model=s;this.selected=selected;this.running=playing;this.rate=rate;this.overlay=overlay;this.labels=labels;this.serviceGroup.visible=services;this.sampleAt=performance.now();this.scene.background.set(dark?0x27333c:0xe9edef);
  const p=LAYOUT.find(x=>x[0]===selected);this.selection.position.set(p[1],2.35,p[2]);
  for(const st of s.stages){const obj=this.objects.get(st.id),b=this.markers.get(st.id);let label=st.status,colour=st.status==='FAULT'||s.mode==='TRIPPED'?colours.red:st.status==='BLOCKED'||st.status==='TEMPERATURE'?colours.amber:st.flowKgS>0?colours.green:0x748591;
   if(overlay==='inventory'){label=`${(st.massKg/st.bufferKg*100).toFixed(0)}% buffer`;colour=st.massKg/st.bufferKg>.8?colours.amber:colours.blue;}
   if(overlay==='temperature'){label=s.loops[st.id]?`${s.loops[st.id].pv.toFixed(1)} °C`:'No temperature loop';colour=s.loops[st.id]?(s.loops[st.id].pv>100?colours.amber:colours.blue):0x748591;}
   if(overlay==='flow')label=`${(st.flowKgS*3.6).toFixed(1)} t/h`;
   obj.lamp.material=colour===colours.red?mats.red:colour===colours.amber?mats.amber:st.flowKgS>0?mats.green:mats.dark;
   b.setAttribute('aria-label',`Inspect ${st.name}`);b.setAttribute('aria-pressed',String(st.id===selected));b.querySelector('strong').textContent=st.name;b.querySelector('small').textContent=label;b.style.setProperty('--pin','#'+colour.toString(16).padStart(6,'0'));b.classList.toggle('selected',st.id===selected);b.classList.toggle('details',labels);b.title=`${st.tag} · ${st.name} · ${label}`;
  }
  this.positionLabels();this.animate();
 }
 positionLabels(){if(!this.renderer)return;for(const [id,b] of this.markers){const p=LAYOUT.find(x=>x[0]===id);const v=new T.Vector3(p[1],this.plan ? .3 : 4.9,p[2]).project(this.camera);b.style.left=((v.x*.5+.5)*100)+'%';b.style.top=((-v.y*.5+.5)*100)+'%';b.hidden=Math.abs(v.x)>1.1||Math.abs(v.y)>1.1;}}
 animate(){if(!this.model)return;const s=this.model,reduce=matchMedia('(prefers-reduced-motion: reduce)').matches,t=s.time+(this.running&&!reduce?Math.min(1,(performance.now()-this.sampleAt)/1000)*this.rate:0);for(const p of this.items){const st=s.stages.find(x=>x.id===p.userData.unit),l=LAYOUT.find(x=>x[0]===st.id);p.visible=st.massKg>.01;const move=st.flowKgS>0&&['RUNNING','DRAINING'].includes(s.mode)?t*.35:0;const x=((p.userData.j/12*5+move)%5-2.5)*p.userData.dir;p.position.set(l[1]+x,1.43,l[2]+(p.userData.j%3-1)*.3);}
  for(const [id,obj] of this.objects){const st=s.stages.find(x=>x.id===id);if(st.flowKgS>0&&this.running&&!reduce){for(const f of obj.fans||[])f.rotation.y=t*1.5;if(obj.robot)obj.robot.rotation.y=Math.sin(t*.3)*.6;}}
 }
 dispose(){this.disposed=true;cancelAnimationFrame(this.raf);this.resize?.disconnect();this.canvas?.removeEventListener('wheel',this.wheel);this.canvas?.removeEventListener('webglcontextlost',this.contextLost);this.renderer?.dispose?.();this.renderer?.forceContextLoss?.();const sharedGeometries=new Set(geometryCache.values()),sharedMaterials=new Set(Object.values(mats));this.scene.traverse(o=>{if(o.geometry&&!sharedGeometries.has(o.geometry))o.geometry.dispose();if(o.material&&!Array.isArray(o.material)&&!sharedMaterials.has(o.material))o.material.dispose();o.shadow?.dispose?.();});this.host.replaceChildren();}
}
