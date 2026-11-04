import test from 'node:test';
import assert from 'node:assert/strict';
import { bracketMeasurement, corners, empty, part, projectFaces, reference, relativeTo, seat, validate } from '../simulator/workshop/site/geometry.mjs';
test('rotated 4 m conveyor, bracket 1 m from its entry, known 100 mm dimension',()=>{
  const layout=empty();
  const belt=part('belt','conveyor',{x:3,y:2,yaw:90});
  const bracket=part('bracket','bracket',{x:3,y:1});
  seat(bracket,belt,'top');layout.parts.push(belt,bracket);
  assert.equal(bracketMeasurement(layout).position,1);
  assert.ok(Math.abs(relativeTo(bracket,belt).across)<1e-10);
  const box=corners(bracket);assert.ok(Math.abs(box[1][0]-box[0][0]-.1)<1e-10);
  bracket.x=4;assert.throws(()=>bracketMeasurement(layout),/footprint/);
});
test('alignment follows conveyor yaw and clips section at its height',()=>{
  const a=part('a','conveyor',{x:2,y:1,yaw:90}),b=part('b','conveyor',{length:2});
  seat(b,a,'end');assert.equal(b.x,2);assert.equal(b.y,4);assert.equal(b.yaw,90);
  assert.equal(Math.max(...corners(b,.24).map(p=>p[2])),.24);
});
test('invalid trees, dimensions and IDs rejected',()=>{
  const layout=reference();layout.parts[0].parent='pack-01';assert.throws(()=>validate(layout),/contain itself/);
  assert.throws(()=>validate({version:1,parts:[part('dup','room'),part('dup','room')]}));
  assert.throws(()=>validate({version:1,parts:[part('r','room',{length:0})]}));
});
test('floor-level geometry behind eye is invisible and near-plane crossing stays finite',()=>{
  const camera={x:0,y:0,z:0,yaw:0,pitch:0,focal:500};
  assert.equal(projectFaces(camera,[{points:[[-1,0,0],[-1,1,0],[-1,0,1]]}]).length,0);
  const faces=projectFaces(camera,[{points:[[-1,0,0],[3,1,0],[3,0,1]]}]);
  assert.equal(faces[0].projected.length,4);assert.ok(faces[0].projected.flat().every(Number.isFinite));
});
