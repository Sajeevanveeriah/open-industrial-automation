import {Matrix4, Quaternion, Vector3, Euler} from '../../vendor/three.module.js';

const demand = (ok, message) => { if (!ok) throw Error(message); };
const numbers = value => value.trim().split(/[\s,]+/).map(Number);
const decoder = new TextDecoder();
export function box(name, size, origin=[0,0,0]) {
  demand(size.length===3 && size.every(n=>Number.isFinite(n)&&n>0),'Box dimensions must be positive.');
  const p=[];
  for (let v=0;v<8;v++) for (let k=0;k<3;k++) p.push(origin[k]+((v>>k)&1)*size[k]);
  return {name,p,i:[0,1,3,0,3,2,4,6,7,4,7,5,0,4,5,0,5,1,2,3,7,2,7,6,0,2,6,0,6,4,1,5,7,1,7,3]};
}
export function transform(part,matrix) {
  const point=new Vector3();
  for(let k=0;k<part.p.length;k+=3) point.fromArray(part.p,k).applyMatrix4(matrix).toArray(part.p,k);
  return part;
}
function pose(xyz,rotation) {
  const quaternion=new Quaternion().setFromEuler(new Euler(...rotation,'ZYX'));
  return new Matrix4().compose(new Vector3(...xyz),quaternion,new Vector3(1,1,1));
}
export function stl(bytes,scale) {
  demand([1,.001,.0254].includes(scale),'Choose the STL source units.');
  const view=new DataView(bytes),p=[];
  const count=bytes.byteLength>=84?view.getUint32(80,true):0;
  if(count && 84+50*count===bytes.byteLength) {
    for(let n=0;n<count;n++) for(let k=0;k<9;k++) p.push(view.getFloat32(84+n*50+12+4*k,true)*scale);
  } else {
    const source=decoder.decode(bytes);
    demand(/^\s*solid\b/i.test(source)&&/endsolid/i.test(source),'Invalid STL.');
    for(const match of source.matchAll(/\bvertex\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)/gi)) p.push(...match.slice(1).map(v=>Number(v)*scale));
  }
  demand(p.length>0 && p.length%9===0,'Incomplete STL triangles.');
  return [{name:'STL surface',p,i:Array.from({length:p.length/3},(_,i)=>i)}];
}
export function gltf(bytes,binary) {
  const view=new DataView(bytes); let model, payload;
  if(binary){
    demand(bytes.byteLength>=28 && view.getUint32(0,true)===0x46546c67 && view.getUint32(4,true)===2 && view.getUint32(8,true)===bytes.byteLength,'Invalid GLB container.');
    const length=view.getUint32(12,true),offset=20+length;
    demand(view.getUint32(16,true)===0x4e4f534a && offset+8<=bytes.byteLength && view.getUint32(offset+4,true)===0x004e4942 && offset+8+view.getUint32(offset,true)===bytes.byteLength,'Invalid GLB chunks.');
    model=JSON.parse(decoder.decode(bytes.slice(20,offset)));payload=bytes.slice(offset+8);
  }else{
    model=JSON.parse(decoder.decode(bytes));
    const uri=model.buffers?.[0]?.uri||'';
    demand(/^data:application\/(?:octet-stream|gltf-buffer);base64,[a-z\d+/=]+$/i.test(uri),'Only embedded glTF buffers are supported.');
    payload=Uint8Array.from(atob(uri.split(',')[1]),c=>c.charCodeAt(0)).buffer;
  }
  demand(model.asset?.version==='2.0' && model.buffers?.length===1 && (!binary||!model.buffers[0].uri) && !model.images?.length && !model.extensionsRequired?.length && !model.skins?.length && !model.animations?.length,'Requires static geometry without external assets, textures or extensions.');
  const buf=new DataView(payload),parts=[],seen=new Set();let vertices=0,indices=0;
  function accessor(id,positions) {
    const a=model.accessors[id], v=model.bufferViews[a.bufferView];
    const [width,read]={5121:[1,'getUint8'],5123:[2,'getUint16'],5125:[4,'getUint32'],5126:[4,'getFloat32']}[a.componentType]||[];
    demand(!a.sparse && v.buffer===0 && Number.isSafeInteger(a.count) && a.count>0 && a.count<=120000 && (positions?a.componentType===5126&&a.type==='VEC3':width&&a.componentType!==5126&&a.type==='SCALAR'),'Unsupported accessor or geometry limit.');
    const dim=positions?3:1, stride=v.byteStride??dim*width, start=(v.byteOffset??0)+(a.byteOffset??0);
    demand(stride>=dim*width && start>=0 && start+(a.count-1)*stride+dim*width<=(v.byteOffset??0)+v.byteLength && (v.byteOffset??0)+v.byteLength<=buf.byteLength,'Accessor exceeds buffer.');
    return Array.from({length:a.count*dim},(_,i)=>buf[read](start+Math.floor(i/dim)*stride+(i%dim)*width,true));
  }
  function visit(id,parent,depth){
    demand(depth<50&&!seen.has(id)&&seen.size<256,'Invalid or excessive glTF hierarchy.');seen.add(id);
    const n=model.nodes[id], local=n.matrix?new Matrix4().fromArray(n.matrix):new Matrix4().compose(new Vector3(...(n.translation||[0,0,0])),new Quaternion(...(n.rotation||[0,0,0,1])),new Vector3(...(n.scale||[1,1,1])));
    const world=parent.clone().multiply(local);
    if(n.mesh!==undefined) for(const m of model.meshes[n.mesh].primitives) {
      demand((m.mode??4)===4 && !m.targets,'Only static triangles are supported.');
      const positions=model.accessors[m.attributes.POSITION]?.count, count=m.indices===undefined?positions:model.accessors[m.indices]?.count;
      demand(Number.isSafeInteger(positions)&&positions>0&&Number.isSafeInteger(count)&&count>0&&parts.length<256,'Invalid primitive.');
      vertices+=positions;indices+=count;
      demand(vertices<=100000&&indices<=300000,'Geometry limit exceeded before allocation.');
      const p=accessor(m.attributes.POSITION,true);
      parts.push(transform({name:n.name||model.meshes[n.mesh].name||'Mesh',p,i:m.indices===undefined?Array.from({length:p.length/3},(_,i)=>i):accessor(m.indices,false),color:model.materials?.[m.material]?.pbrMetallicRoughness?.baseColorFactor},world));
    }
    for(const child of n.children||[]) visit(child,world,depth+1);
  }
  for(const id of model.scenes[model.scene??0].nodes)visit(id,new Matrix4(),0);
  return parts;
}
export function urdf(src){
  demand(!/<!DOCTYPE|<!ENTITY|<mesh\b|<texture\b|<xacro:|<gazebo\b/i.test(src),'Only self-contained robot box visuals are supported.');
  const xml=new DOMParser().parseFromString(src,'application/xml');
  demand(xml.documentElement.tagName==='robot'&&!xml.querySelector('parsererror'),'Invalid robot XML.');
  const links=new Map(),joints=new Map(),parts=[];
  const attr=(el,key,fallback)=>numbers(el?.getAttribute(key)||fallback);
  const origin=el=>pose(attr(el,'xyz','0 0 0'),attr(el,'rpy','0 0 0'));
  for(const link of xml.querySelectorAll('robot > link')) {const id=link.getAttribute('name');demand(id&&!links.has(id)&&links.size<128,'Invalid robot link.');links.set(id,link);}
  for(const j of xml.querySelectorAll('robot > joint')){
    const child=j.querySelector('child')?.getAttribute('link'),parent=j.querySelector('parent')?.getAttribute('link');
    demand(['fixed','revolute','continuous','prismatic'].includes(j.getAttribute('type'))&&links.has(child)&&links.has(parent)&&!joints.has(child),'Invalid joint or missing link.');
    joints.set(child,{parent,frame:origin(j.querySelector('origin'))});
  }
  function frame(id,visited=new Set()){demand(!visited.has(id),'Cyclic robot.');visited.add(id);const j=joints.get(id);return j?frame(j.parent,visited).multiply(j.frame):new Matrix4();}
  for(const [name,link] of links)for(const v of link.querySelectorAll(':scope > visual')){
    demand(parts.length<256,'Part limit exceeded.');const b=v.querySelector('geometry > box');demand(b,'Only box visuals are supported.');
    const size=attr(b,'size','');parts.push(transform(box(name,size,size.map(n=>-n/2)),frame(name).multiply(origin(v.querySelector('origin')))));
  }
  return parts;
}
export function usda(src){
  demand(src.startsWith('#usda 1.0')&&!/[@<>]|\b(?:references|payload|subLayers|inherits|variantSet)\b/.test(src)&&/metersPerUnit\s*=\s*1(?:\.0+)?\s/.test(src)&&/upAxis\s*=\s*"Z"/.test(src),'Requires a self-contained metre, Z-up ASCII stage.');
  const parts=[];const body=src.slice(src.indexOf(')')+1);
  const rest=body.replace(/def Cube "(\w+)"\s*\{([^{}]*)\}/g,(_,name,fields)=>{
    const value=(key)=>{const m=fields.match(new RegExp('xformOp:'+key+'\\s*=\\s*\\(([^)]+)\\)'));demand(m,'Cube requires translation and scale.');return numbers(m[1]);};
    demand(/double size\s*=\s*1\s/.test(fields)&&fields.includes('["xformOp:translate", "xformOp:scale"]'),'Unsupported cube transform.');
    demand(parts.length<256,'Part limit exceeded.');const size=value('scale'),centre=value('translate');parts.push(box(name,size,centre.map((v,i)=>v-size[i]/2)));return '';
  });
  demand(!rest.trim()&&parts.length,'Only flat cube stages are supported.');return parts;
}
export function bounds(parts){
  demand(parts.length>0&&parts.length<=256,'No supported parts or part limit exceeded.');
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let total=0;
  for(const {p,i} of parts){
    total+=i.length;
    demand(p.length&&p.length%3===0&&i.length>0&&i.length%3===0&&i.every(n=>Number.isInteger(n)&&n>=0&&n<p.length/3)&&total<=300000,'Invalid triangles or excessive geometry.');
    p.forEach((n,k)=>{demand(Number.isFinite(n)&&Math.abs(n)<1e5,'Invalid site coordinate.');const a=k%3;min[a]=Math.min(min[a],n);max[a]=Math.max(max[a],n);});
  }
  return {min,max,size:max.map((n,k)=>n-min[k])};
}
