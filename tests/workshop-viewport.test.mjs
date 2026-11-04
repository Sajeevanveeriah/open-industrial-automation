import test from 'node:test';
import assert from 'node:assert/strict';
import {describeCell,movedParameter} from '../simulator/workshop/studio/geometry.mjs';
import {createProject,addCarton,configure,step} from '../simulator/workshop/model.mjs';
test('world model maps leading carton edge, mount, input and pallet identity to one set of SI coordinates',()=>{
  const p=createProject('reference');configure(p,'bracket',{x:1.5});configure(p,'eye',{x:.25});
  const c=addCarton(p);step(p,20);
  const shape=describeCell(p);
  assert.equal(shape.labels.length,10);
  assert.equal(shape.labels.find(a=>a.id==='eye').at[0],1.75);
  const product=shape.parts.find(s=>s.key==='product:'+c.id);
  assert.equal(product.at[0]+product.size[0]/2,.5);
  step(p,65);assert.equal(p.runtime.pallets.length,1);
  const placed=describeCell(p);assert.equal(placed.pallets,1);assert.equal(placed.cartons,0);assert.notEqual(placed.parts.find(s=>s.key==='product:'+c.id).at[1],0);
});
test('empty site, disconnected beam, geometry budgets and design delta bounds',()=>{
  assert.deepEqual(describeCell(createProject()).parts,[]);
  const p=createProject('reference');p.links=p.links.filter(l=>l.port!=='mount');configure(p,'belt',{length:100});
  const shape=describeCell(p);assert.ok(shape.parts.filter(s=>s.owner==='belt').length<80);
  assert.equal(shape.parts.some(s=>s.owner==='eye'&&s.size[0]===.009),false);
  assert.deepEqual(movedParameter({type:'conveyor',length:.12},-1),{length:.1});
  assert.deepEqual(movedParameter({type:'bracket',x:1},.14),{x:1.15});
  assert.equal(movedParameter({type:'switch'},1),null);
});
import {initialPart} from '../simulator/workshop/studio/part/part-model.mjs';
import {metricDistance} from '../simulator/workshop/studio/geometry.mjs';
test('mounted part has exact design triangles and datum distance reflects metres',()=>{
  const p=createProject('reference'),design=initialPart();p.extensions.studioPart=design;
  assert.equal(describeCell(p).parts.some(part=>part.kind==='solid'),false);
  design.mount={assetId:'bracket',frame:'bracket',units:'m'};
  const cell=describeCell(p),body=cell.parts.find(part=>part.kind==='solid');
  assert.ok(body?.mesh.i.length>=12);
  const xyz=body.mesh.p,coords=i=>xyz.filter((_,j)=>j%3===i);
  assert.equal(Math.max(...coords(0))-Math.min(...coords(0)),.080);
  assert.equal(Math.max(...coords(1))-Math.min(...coords(1)),.025);
  assert.equal(Math.max(...coords(2))-Math.min(...coords(2)),.050);
  assert.equal(metricDistance(...cell.datums.filter(d=>d.id.startsWith('belt-')).map(d=>d.point)),4);
  assert.equal(metricDistance([1,2,3],[4,6,15]),13);
});
