import * as THREE from '../../vendor/three.module.js';
import {SVGRenderer} from '../../vendor/SVGRenderer.js';
import {describeCell,metricDistance,moveField,movedParameter} from './geometry.mjs';

const up=new THREE.Vector3(0,0,1),unitY=new THREE.Vector3(0,1,0);
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const dom=(name,css)=>{const e=document.createElement(name);e.className=css;return e;};

export function createViewport(container, {onSelect=()=>{},onMove=()=>{}}={}) {
  const surface=dom('div','studio-viewport-surface'),caption=dom('div','studio-viewport-caption');
  surface.style.cssText='position:relative;overflow:hidden;width:100%;height:100%;min-height:200px;touch-action:none;user-select:none';
  caption.style.cssText='position:absolute;left:10px;bottom:8px;max-width:95%;color:#34535b;background:#f5f8f2e8;border-radius:3px;padding:2px 5px;font:11px/1.4 system-ui;pointer-events:none';
  surface.tabIndex=0;surface.setAttribute('role','group');surface.setAttribute('aria-label','Interactive 3D packaging assembly. Tab to focus. Left and right move a selected adjustable asset. Up and down select equipment. Shift and arrows orbit; plus and minus zoom; Home fits the cell.');
  const canvas=dom('canvas','studio-viewport-canvas');
  let renderer,webgl=false;
  try{
    const gl=canvas.getContext('webgl2',{alpha:false,antialias:true,powerPreference:'low-power',preserveDrawingBuffer:false});
    if(gl){renderer=new THREE.WebGLRenderer({canvas,context:gl,antialias:true,alpha:false});webgl=true;renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));}
  }catch{webgl=false;}
  if(!webgl)renderer=new SVGRenderer();
  const viewElement=renderer.domElement;viewElement.style.cssText='display:block;width:100%;height:100%;position:absolute;inset:0';
  viewElement.setAttribute('aria-hidden','true');surface.dataset.renderer=webgl?'webgl':'svg';
  surface.append(viewElement,caption);container.replaceChildren(surface);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#e8eeea');
  scene.add(new THREE.AmbientLight(0xffffff,1.35));
  const sun=new THREE.DirectionalLight(0xfff1d9,1.80);sun.position.set(-5,-7,12);scene.add(sun);
  const fill=new THREE.DirectionalLight(0xcddbe6,.65);fill.position.set(3,6,5);scene.add(fill);
  const camera=new THREE.OrthographicCamera(-4,4,3,-3,.01,5000);camera.up.copy(up);
  const content=new THREE.Group();scene.add(content);
  const grid=new THREE.GridHelper(30,60,'#8daba4','#c7d4ce');grid.rotation.x=Math.PI/2;grid.position.z=-.015;scene.add(grid);
  const geo={box:new THREE.BoxGeometry(1,1,1),rod:new THREE.CylinderGeometry(.5,.5,1,12),sphere:new THREE.SphereGeometry(.5,10,7)};
  const materials=new Map(),meshes=new Map(),raycaster=new THREE.Raycaster();
  const highlight=new THREE.Box3Helper(new THREE.Box3(),0x187864);highlight.visible=false;scene.add(highlight);
  const overlay=dom('div','studio-viewport-tag');overlay.style.cssText='position:absolute;pointer-events:none;padding:3px 6px;background:#164940;color:white;border-radius:3px;font:600 11px/1.25 system-ui;transform:translate(-50%,-115%);white-space:nowrap';
  overlay.hidden=true;surface.append(overlay);
  let p=null,selected=null,geometry=null,azimuth=-1.04,elevation=.52,span=4,centre=new THREE.Vector3(1.65,.35,.62),width=1,height=1,hadAssets=false,disposed=false,preview=null;
  const inspectPanel=dom('details','studio-viewport-inspect');inspectPanel.style.cssText='position:absolute;right:8px;top:8px;z-index:2;max-width:80%;max-height:85%;overflow:auto;color:#254b4c;background:#f6f9f5f2;border:1px solid #b8cbc1;border-radius:5px;padding:3px 7px;font:12px/1.4 system-ui';
  const summary=dom('summary','');summary.textContent='Inspect';summary.style.cursor='pointer';inspectPanel.append(summary);surface.append(inspectPanel);
  function tool(text,fn){
    const b=dom('button','');b.type='button';b.textContent=text;b.style.cssText='font:inherit;color:inherit;background:white;border:1px solid #b0c4ba;border-radius:3px;margin:3px 2px;padding:3px 5px;cursor:pointer';b.onclick=fn;inspectPanel.append(b);return b;
  }
  let exploded=false,measuring=false,points=[],datumSignature='',solidSource=null,solidGeometry=null;
  const lineGeometry=new THREE.BufferGeometry(),rulerLine=new THREE.Line(lineGeometry,new THREE.LineBasicMaterial({color:0x9b362b,depthTest:false}));
  rulerLine.visible=false;rulerLine.renderOrder=8;scene.add(rulerLine);
  const rulerDots=[0,1].map(()=>{const m=new THREE.Mesh(geo.sphere,material('#b53e2b'));m.scale.setScalar(.055);m.visible=false;scene.add(m);return m;});
  const focusButton=tool('Fit selection',()=>{if(highlight.visible){focusBounds(highlight.box);paint();}});
  const explodedButton=tool('Explode',()=>{exploded=!exploded;points=[];measuring=false;setMeshes();showMeasurement();});
  const measureButton=tool('Measure',()=>{measuring=!measuring;if(measuring){exploded=false;points=[];}setMeshes();showMeasurement();});
  const rulerTools=dom('div','');rulerTools.hidden=true;inspectPanel.append(rulerTools);
  const anchorList=dom('select','');anchorList.setAttribute('aria-label','Measurement reference');anchorList.style.cssText='font:inherit;max-width:100%';rulerTools.append(anchorList);
  const addDatum=tool('Use datum',()=>{const datum=geometry.datums.find(v=>v.id===anchorList.value);if(datum)measurePoint(datum.point.slice());});rulerTools.append(addDatum);
  const result=dom('output','');result.style.cssText='display:block;max-width:275px;white-space:normal';rulerTools.append(result);
  function showMeasurement(){
    explodedButton.setAttribute('aria-pressed',String(exploded));measureButton.setAttribute('aria-pressed',String(measuring));surface.dataset.exploded=String(exploded);
    rulerTools.hidden=!measuring;
    for(let i=0;i<2;i++){rulerDots[i].visible=measuring&&!!points[i];if(points[i])rulerDots[i].position.set(...points[i]);}
    rulerLine.visible=measuring&&points.length===2;
    if(rulerLine.visible){lineGeometry.setFromPoints(points.map(v=>new THREE.Vector3(...v)));lineGeometry.computeBoundingSphere();}
    const coords=points.map((v,i)=>(i?'B':'A')+' ('+v.map(n=>n.toFixed(3)).join(', ')+') m');
    result.textContent=points.length===2?coords.join(' / ')+' · Distance '+metricDistance(...points).toFixed(3)+' m.':(coords.join(' ')+' Select '+(points.length?'second':'first')+' surface point or datum.').trim();paint();
  }
  function measurePoint(point){if(points.length===2)points=[];points.push(point);showMeasurement();}
  const offsets={bracket:[0,-.25,.36],sensor:[0,-.48,.68],conveyor:[0,0,0],plc:[-.45,.40,.06],robot:[.48,.12,.4],camera:[0,.55,.28],switch:[-.15,.60,.15],hmi:[.5,-.42,.14],viewer:[.18,.65,.12],erp:[0,.76,.22]};
  function displayOffset(owner){return exploded?(offsets[p.assets.find(a=>a.id===owner)?.type]||[0,0,.25]):[0,0,0];}
  function shapeGeometry(item){
    if(item.kind!=='solid')return geo[item.kind];
    if(solidSource!==item.mesh){
      solidGeometry?.dispose();solidGeometry=new THREE.BufferGeometry();
      solidGeometry.setAttribute('position',new THREE.Float32BufferAttribute(item.mesh.p,3));solidGeometry.setIndex(item.mesh.i);solidGeometry.computeVertexNormals();solidSource=item.mesh;
    }
    return solidGeometry;
  }
  const pointers=new Map();let gesture=null,pinch=null;
  function material(colour){
    if(!materials.has(colour))materials.set(colour,new THREE.MeshLambertMaterial({color:colour,flatShading:true}));
    return materials.get(colour);
  }
  function size(){
    if(disposed)return;
    const rect=surface.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);
    renderer.setSize(width,height,false);viewElement.style.width='100%';viewElement.style.height='100%';paint();
  }
  function projection(){
    const distance=Math.max(25,span*4);camera.position.set(Math.cos(azimuth)*Math.cos(elevation),Math.sin(azimuth)*Math.cos(elevation),Math.sin(elevation)).multiplyScalar(distance).add(centre);
    camera.lookAt(centre);camera.left=-span*width/height/2;camera.right=-camera.left;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  }
  function paint(){
    if(disposed)return;projection();scene.updateMatrixWorld(true);
    const tag=geometry?.labels.find(a=>a.id===selected);
    if(tag){
      const location=new THREE.Vector3(...tag.at).add(new THREE.Vector3(...displayOffset(tag.id))).project(camera);overlay.textContent=tag.id;overlay.style.left=(location.x/2+.5)*100+'%';overlay.style.top=(.5-location.y/2)*100+'%';
      overlay.hidden=Math.abs(location.x)>1||Math.abs(location.y)>1;
    }else overlay.hidden=true;
    renderer.render(scene,camera);
  }
  function focusBounds(chosen){
    const bounds=chosen?.clone()||new THREE.Box3();
    if(!chosen)for(const mesh of meshes.values())bounds.expandByObject(mesh);
    if(bounds.isEmpty()){centre.set(1,.1,.4);span=3.5;return;}
    bounds.getCenter(centre);
    projection();
    const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),above=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
    const extent=bounds.getSize(new THREE.Vector3()),projected=axis=>extent.x*Math.abs(axis.x)+extent.y*Math.abs(axis.y)+extent.z*Math.abs(axis.z);
    span=Math.max(1,projected(above)*1.12,projected(right)*1.12*height/width);
  }
  function setMeshes(){
    const effective=preview?{...p,assets:p.assets.map(a=>a.id===preview.id?{...a,...preview.patch}:a)}:p;
    geometry=describeCell(effective);const keep=new Set();
    for(const item of geometry.parts){
      keep.add(item.key);let mesh=meshes.get(item.key);
      if(!mesh){mesh=new THREE.Mesh(shapeGeometry(item),material(item.colour));content.add(mesh);meshes.set(item.key,mesh);}
      mesh.geometry=shapeGeometry(item);mesh.material=material(item.colour);mesh.userData.owner=item.owner;
      mesh.position.set(...item.at).add(new THREE.Vector3(...displayOffset(item.owner)));mesh.scale.set(...item.size);mesh.quaternion.identity();
      if(item.direction)mesh.quaternion.setFromUnitVectors(unitY,new THREE.Vector3(...item.direction));
      mesh.updateMatrixWorld(true);
    }
    for(const [key,mesh] of meshes)if(!keep.has(key)){content.remove(mesh);meshes.delete(key);}
    highlight.box.makeEmpty();for(const mesh of meshes.values())if(selected&&mesh.userData.owner===selected)highlight.box.expandByObject(mesh);
    highlight.visible=!highlight.box.isEmpty();if(highlight.visible)highlight.box.expandByScalar(.018);
    focusButton.disabled=!highlight.visible;
    const signature=geometry.datums.map(a=>a.id).join('|');
    if(signature!==datumSignature){datumSignature=signature;const previous=anchorList.value;anchorList.replaceChildren(...geometry.datums.map(a=>new Option(a.label,a.id)));if(geometry.datums.some(a=>a.id===previous))anchorList.value=previous;}
    const asset=p.assets.find(a=>a.id===selected),field=asset&&moveField(asset.type);
    caption.textContent=asset?asset.id+' · '+asset.type+(geometry.parts.some(item=>item.kind==='solid'&&item.owner===asset.id)?' · authored solid':'')+(field?' · '+(preview?.patch[field[0]]??asset[field[0]]).toFixed(2)+' m'+(exploded?' · exploded':' · drag along X'):' · selected') : p.assets.length?'Select equipment · drag background to orbit':'Empty cell · place equipment to begin';
    surface.dataset.selected=selected||'';surface.dataset.scan=String(p.runtime.scan);
    if(!hadAssets&&p.assets.length){focusBounds();hadAssets=true;}if(!p.assets.length)hadAssets=false;
    paint();
  }
  function update(project,id){
    if(disposed||!project)return;p=project;selected=typeof id==='object'&&id?id.id:id;setMeshes();
  }
  function view(mode){
    if(mode==='top'){azimuth=-Math.PI/2;elevation=Math.PI/2-.0001;}
    else if(mode==='front'){azimuth=-Math.PI/2;elevation=.001;}
    else if(mode==='iso'){azimuth=-1.04;elevation=.52;}
    else if(mode==='fit')focusBounds();
    else if(mode==='focus'&&highlight.visible)focusBounds(highlight.box);
    else return;
    surface.dataset.view=mode;paint();
  }
  function hit(x,y){
    const r=surface.getBoundingClientRect(),cursor=new THREE.Vector2((x-r.left)*2/width-1,1-(y-r.top)*2/height);
    raycaster.setFromCamera(cursor,camera);
    const hits=raycaster.intersectObjects(content.children,false);return measuring?hits[0]:hits.find(item=>item.object.userData.owner);
  }
  function select(id){if(!id)return;selected=id;onSelect(id);if(p)setMeshes();}
  function metresAlongX(dx,dy){
    const origin=centre.clone().project(camera),along=centre.clone().add(new THREE.Vector3(1,0,0)).project(camera);
    const sx=(along.x-origin.x)*width/2,sy=-(along.y-origin.y)*height/2;
    return (sx*dx+sy*dy)/Math.max(1,sx*sx+sy*sy);
  }
  function pan(dx,dy){
    const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),above=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
    centre.addScaledVector(right,-dx*span/height).addScaledVector(above,dy*span/height);
  }
  function wheel(e){e.preventDefault();span=clamp(span*Math.exp(clamp(e.deltaY,-250,250)*.0016),.15,600);paint();}
  function multi(){const [a,b]=[...pointers.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.max(2,Math.hypot(a.x-b.x,a.y-b.y))};}
  function down(e){
    if(!p||e.button>2||inspectPanel.contains(e.target))return;e.preventDefault();surface.focus({preventScroll:true});surface.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===2){gesture=null;preview=null;pinch=multi();setMeshes();return;}
    if(pointers.size>2)return;
    const intersection=hit(e.clientX,e.clientY),picked=intersection?.object.userData.owner,asset=p.assets.find(a=>a.id===picked);
    const action=e.button!==0||e.shiftKey?'pan':measuring&&intersection?'measure':!exploded&&asset&&moveField(asset.type)?'move':'orbit';
    gesture={id:picked,point:intersection?.point.toArray(),asset:asset&&{...asset},action,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,dragged:false};
  }
  function move(e){
    if(!pointers.has(e.pointerId))return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===2){const q=multi();if(pinch){span=clamp(span*pinch.d/q.d,.15,600);pan(q.x-pinch.x,q.y-pinch.y);paint();}pinch=q;return;}
    if(!gesture||pointers.size!==1)return;
    const g=gesture,totalX=e.clientX-g.x,totalY=e.clientY-g.y;
    if(Math.hypot(totalX,totalY)<4&&!g.dragged)return;
    g.dragged=true;
    const dx=e.clientX-g.lastX,dy=e.clientY-g.lastY;g.lastX=e.clientX;g.lastY=e.clientY;
    if(g.action==='move'){
      const patch=movedParameter(g.asset,metresAlongX(totalX,totalY));
      if(!preview)select(g.id);
      preview={id:g.id,patch};setMeshes();return;
    }
    if(g.action==='pan')pan(dx,dy);else{azimuth-=dx*.009;elevation=clamp(elevation+dy*.007,-.25,Math.PI/2-.0001);}
    paint();
  }
  function end(e,cancel){
    if(!pointers.has(e.pointerId))return;
    const g=gesture,commit=preview;gesture=null;pinch=null;pointers.delete(e.pointerId);preview=null;
    if(!cancel&&g){
      if(!g.dragged&&g.action==='measure')measurePoint(g.point);
      else if(!g.dragged&&g.id)select(g.id);
      else if(commit&&g.action==='move'&&Object.entries(commit.patch).some(([k,v])=>g.asset[k]!==v))onMove(commit.id,commit.patch);
    }
    if(p)setMeshes();if(surface.hasPointerCapture(e.pointerId))surface.releasePointerCapture(e.pointerId);
  }
  function key(e){
    if(inspectPanel.contains(e.target)||!p||e.altKey||e.ctrlKey||e.metaKey)return;
    if(e.key==='Home')view('fit');
    else if(e.key==='+'||e.key==='='||e.key==='-'){span=clamp(span*(e.key==='-'?1.2:1/1.2),.15,600);paint();}
    else if(e.key.startsWith('Arrow')){
      if(e.shiftKey){if(e.key==='ArrowLeft')azimuth-=.15;if(e.key==='ArrowRight')azimuth+=.15;if(e.key==='ArrowUp')elevation=clamp(elevation+.1,-.25,1.57);if(e.key==='ArrowDown')elevation=clamp(elevation-.1,-.25,1.57);paint();}
      else if(e.key==='ArrowUp'||e.key==='ArrowDown'){const n=p.assets.length;if(n){const i=p.assets.findIndex(a=>a.id===selected);select(p.assets[(i+(e.key==='ArrowDown'?1:-1)+n)%n].id);}}
      else {const a=p.assets.find(a=>a.id===selected),patch=a&&movedParameter(a,e.key==='ArrowRight'?.05:-.05);if(patch)onMove(a.id,patch);}
    }else return;
    e.preventDefault();
  }
  const listeners=new AbortController(),opts={signal:listeners.signal};
  surface.addEventListener('pointerdown',down,opts);surface.addEventListener('pointermove',move,opts);surface.addEventListener('pointerup',e=>end(e,false),opts);surface.addEventListener('pointercancel',e=>end(e,true),opts);
  surface.addEventListener('wheel',wheel,{...opts,passive:false});surface.addEventListener('contextmenu',e=>e.preventDefault(),opts);surface.addEventListener('keydown',key,opts);
  const observer=new ResizeObserver(size);observer.observe(surface);size();
  function dispose(){
    if(disposed)return;disposed=true;observer.disconnect();listeners.abort();for(const geom of Object.values(geo))geom.dispose();for(const m of materials.values())m.dispose();
    solidGeometry?.dispose();lineGeometry.dispose();rulerLine.material.dispose();highlight.dispose();grid.dispose();renderer.dispose?.();surface.remove();meshes.clear();p=null;
  }
  return {update,view,dispose};
}
