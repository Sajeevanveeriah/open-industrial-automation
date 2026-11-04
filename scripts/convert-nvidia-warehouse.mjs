import {createHash} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Vector3} from 'three';
import {USDLoader} from 'three/addons/loaders/USDLoader.js';
import {MeshoptSimplifier} from 'three/addons/libs/meshopt_simplifier.module.js';

const revision='c7fe115cb79c7ddbd0532630d7768b5736b0ecc4';
const dataset='https://huggingface.co/datasets/nvidia/PhysicalAI-SimReady-Warehouse-01';
const output=fileURLToPath(new URL('../simulator/workshop/studio/facility/assets/',import.meta.url));
const assets=[
 ['rack','RackLargeEmpty_A1','de857a11c8cd110ac14fe48ab78d5ef6f69f329e713ffea4642618c34581f226',2164254,1800],
 ['pallet','Pallet_A1','e2daf9a345758e11de17ab96791a8a8ea5ba20daefc70b28e79c18e521837b80',88021,400],
 ['jack','SM_HeavyDutyPalletTruck_A01_01','74a11f7e4d438ae9923c67688c3885f2033563162497126fe67fb9a97de4cb05',11056445,1500],
 ['forklift','SM_Forklift_A01_Orange_01','2d8bb50e26a9c4e33add8825b7b9b2190299fdef6e8cfd01f25e07b0ce8ee795',16220217,2500]
];
function check(condition,reason){if(!condition)throw Error(reason);}
const sha=b=>createHash('sha256').update(b).digest('hex');
const rounded=n=>Math.round(n*10000)/10000;
function colour(kind,name){
 if(kind==='rack')return /leg|post|frame/i.test(name)?'#406a88':'#df883a';
 if(kind==='pallet')return '#b89060';
 if(/whe|tyre|tire|rubber|seat|fork|handle|cabin|black|steer|chain|hose|lever|mast/i.test(name.replace(/^SM_Forklift_[^/]*?01(?=[/_])/i,'')))return '#3c4749';
 if(/metal|steel|bolt|screw|rim|chrome|piston/i.test(name))return '#9aa6a6';
 if(/light|lamp|reflector/i.test(name))return '#ecd78c';
 return kind==='jack'?'#dba43d':'#dc8138';
}
function simplifyGroup(group,budget){
 const coords=[],indices=[],keys=new Map();
 for(const v of group){
  const k=v.join(',');let index=keys.get(k);if(index===undefined){index=keys.size;keys.set(k,index);coords.push(...v);}indices.push(index);
 }
 const pos=new Float32Array(coords),idx=new Uint32Array(indices),target=Math.min(idx.length,3*Math.max(8,budget));
 let lod=idx;
 if(target<idx.length){
  [lod]=MeshoptSimplifier.simplify(idx,pos,3,target,0.035,['Prune']);
  if(lod.length>target*1.05){const [coarse]=MeshoptSimplifier.simplifySloppy(idx,pos,3,null,target,0.06);if(coarse.length)lod=coarse;}
 }
 const out=[],map=new Map(),remapped=[];
 for(let i=0;i<lod.length;i+=3){
  const tri=[lod[i],lod[i+1],lod[i+2]];if(new Set(tri).size!==3)continue;
  for(const old of tri){if(!map.has(old)){map.set(old,out.length/3);out.push(...coords.slice(old*3,old*3+3));}remapped.push(map.get(old));}
 }
 return {positions:out,indices:remapped};
}
function geometry(root,kind,budget){
 root.updateMatrixWorld(true);
 const batches=new Map(),prims=[],lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity],position=new Vector3();
 root.traverseVisible(mesh=>{
  if(!mesh.isMesh||!mesh.geometry?.attributes.position)return;
  const attr=mesh.geometry.attributes.position,index=mesh.geometry.index,triangleCount=(index?.count??attr.count)/3;
  check(Number.isInteger(triangleCount),'Expected triangulated source: '+mesh.name);
  prims.push({name:mesh.name,triangles:triangleCount});
  const color=colour(kind,mesh.name),batch=batches.get(color)||[];batches.set(color,batch);
  for(let i=0;i<triangleCount*3;i++){
   const vi=index?index.getX(i):i;
   position.fromBufferAttribute(attr,vi).applyMatrix4(mesh.matrixWorld);
   const xyz=[position.x,-position.z,position.y].map(rounded);
   check(xyz.every(Number.isFinite),'Non-finite geometry: '+mesh.name);
   for(let a=0;a<3;a++){lo[a]=Math.min(lo[a],xyz[a]);hi[a]=Math.max(hi[a],xyz[a]);}
   batch.push(xyz);
  }
 });
 check(prims.length>0,'USD contains no visible meshes: '+kind);
 const triangles=prims.reduce((n,p)=>n+p.triangles,0),origin=[(hi[0]+lo[0])/2,(hi[1]+lo[1])/2,lo[2]],size=hi.map((v,i)=>rounded(v-lo[i]));
 const positions=[],indices=[],groups=[];
 for(const [color,verts] of batches){
  const reduced=simplifyGroup(verts,Math.round(budget*verts.length/(triangles*3))),offset=positions.length/3;
  for(let i=0;i<reduced.positions.length;i++)positions.push(rounded(reduced.positions[i]-origin[i%3]));
  const start=indices.length;for(const i of reduced.indices)indices.push(i+offset);
  groups.push({start,count:indices.length-start,color});
 }
 check(indices.length>=3&&indices.length/3<=budget*1.15,'LOD outside triangle budget: '+kind+' '+indices.length/3);
 const actual=[0,1,2].map(axis=>{const v=positions.filter((_,i)=>i%3===axis);return Math.max(...v)-Math.min(...v);});
 check(actual.every((v,i)=>v>=size[i]*0.84),'Simplified envelope shrank by over 16%: '+kind);
 return {mesh:{positions,indices,groups,size},triangles,prims};
}
async function convert([kind,stem,digest,bytes,budget]){
 const path='Props/general/'+stem+'/'+stem+'.usd',url=dataset+'/resolve/'+revision+'/'+path;
 const source=process.env.OIA_NVIDIA_USD_DIR?await readFile(join(resolve(process.env.OIA_NVIDIA_USD_DIR),stem+'.usd')):await (async()=>{
  const response=await fetch(url,{signal:AbortSignal.timeout(120000)});check(response.ok,'USD download failed: '+response.status+' '+url);
  check(!response.headers.has('content-length')||Number(response.headers.get('content-length'))<=bytes,'Unexpected asset size.');
  const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;check(size<=bytes,'USD byte budget exceeded.');chunks.push(chunk);}return Buffer.concat(chunks);
 })();
 check(source.length===bytes&&sha(source)===digest,'Source digest or byte count mismatch for '+stem);
 const model=new USDLoader().parse(source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength));
 const {mesh,triangles,prims}=geometry(model,kind,budget);
 const published={asset:stem,source:url,sha256:digest,sourceBytes:bytes,sourceTriangles:triangles,convertedTriangles:mesh.indices.length/3,vertices:mesh.positions.length/3,sizeMetres:mesh.size,primCount:prims.length};
 console.log(kind,JSON.stringify(published));return {kind,mesh,published};
}
await MeshoptSimplifier.ready;
const results=await Promise.all(assets.map(convert));
await mkdir(output,{recursive:true});
const moduleCode='export const warehouseMeshes = {\n'+results.map(r=>'  '+r.kind+': '+JSON.stringify(r.mesh)).join(',\n')+'\n};\n';
await writeFile(join(output,'warehouse-meshes.mjs'),moduleCode);
const manifest={dataset:'NVIDIA Physical AI SimReady Warehouse OpenUSD Dataset',datasetRevision:revision,datasetCard:dataset+'/blob/'+revision+'/README.md',creator:'NVIDIA Corporation',sourceLicense:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',conversion:'Static triangulated visual level of detail; metre vertices centred on floor, Z up; educational flat colours replace source materials. Source physics, textures and articulation are excluded.',converter:'scripts/convert-nvidia-warehouse.mjs',outputSha256:sha(moduleCode),assets:results.map(r=>r.published)};
await writeFile(join(output,'warehouse-provenance.json'),JSON.stringify(manifest,null,2)+'\n');
