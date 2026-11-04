import * as T from '../../../vendor/three.module.js';
import {warehouseMeshes} from './assets/warehouse-meshes.mjs';
const sourceNames=['rack','pallet','jack','forklift'];
export function sourceLibrary(){
  const geometries={},materials={},scales={};
  for(const name of sourceNames){
    const raw=warehouseMeshes[name],geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(raw.positions,3));geometry.setIndex(raw.indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
    for(const [i,g] of raw.groups.entries())geometry.addGroup(g.start,g.count,i);
    geometries[name]=geometry;materials[name]=raw.groups.map(group=>new T.MeshStandardMaterial({color:group.color,roughness:name==='pallet'?.92:.7,metalness:name==='pallet'?0:.14,flatShading:true}));
    scales[name]=raw.size;
  }
  function make(name,placements){
    const g=geometries[name],m=materials[name],mesh=new T.InstancedMesh(g,m,placements.length),helper=new T.Object3D();
    for(const [i,p] of placements.entries()){
      helper.position.set(p.x,p.y,p.z);helper.rotation.set(0,0,p.yaw||0);
      helper.scale.set(...(p.scale??[1,1,1]));helper.updateMatrix();mesh.setMatrixAt(i,helper.matrix);
    }
    mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();return mesh;
  }
  function detailRack(bays){return make('rack',bays.map(p=>({x:p.x,y:p.y,z:.025,scale:[1.31/scales.rack[0],3.97/scales.rack[1],3.42/scales.rack[2]]})));}
  function stockBases(bays){
    const placements=[];
    for(const bay of bays)for(const [i,p] of bay.stock.entries())placements.push({x:bay.x,y:bay.y,z:.19+((p.level??i+1)-1)*1.12,scale:[.98,2.00,.70]});
    return make('pallet',placements);
  }
  function docks(s){const group=new T.Group();group.add(make('jack',s.doors.flatMap((p,i)=>[{x:p.x+3.0,y:p.y+2.0,z:.025,yaw:i*.28},{x:p.x+3.85,y:p.y+2.1,z:.025,yaw:i*.28}])));return group;}
  function lift(){
    const raw=warehouseMeshes.forklift,lower=[],moving=[];
    for(let i=0;i<raw.indices.length;i+=3){
      const triangle=raw.indices.slice(i,i+3),ys=triangle.map(k=>raw.positions[k*3+1]),zs=triangle.map(k=>raw.positions[k*3+2]);
      const target=Math.max(...zs)<.16&&Math.min(...ys)<.15?moving:lower;target.push(...triangle);
    }
    const cloned=(indices)=>{
      const g=new T.BufferGeometry();g.setAttribute('position',geometries.forklift.getAttribute('position'));g.setAttribute('normal',geometries.forklift.getAttribute('normal'));g.setIndex(indices);g.computeBoundingSphere();
      const body=new T.Mesh(g,new T.MeshStandardMaterial({color:'#525951',roughness:.72,metalness:.22,flatShading:true}));body.castShadow=true;body.receiveShadow=true;body.rotation.z=Math.PI/2;
      body.userData.ownsSourceGeometry=true;return body;
    };
    return {frame:cloned(lower),forks:cloned(moving)};
  }
  return {make,detailRack,stockBases,docks,lift,dispose(){Object.values(geometries).forEach(g=>g.dispose());Object.values(materials).flat().forEach(m=>m.dispose());}};
}
