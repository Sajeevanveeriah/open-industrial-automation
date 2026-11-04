import test from 'node:test';
import assert from 'node:assert/strict';
import {commission} from '../simulator/workshop/studio/analysis/commission.mjs';
test('drive assignment measures separate prediction, tracking and transfer criteria',()=>{
 const weak=commission(1,6,4,0);
 assert.equal(weak.checks[0].pass,true);assert.equal(weak.pass,false);
 assert.equal(commission(1,0,45,30).pass,false);
 assert.equal(commission(1,6,45,30).pass,true);
 assert.equal(commission(1,6,50,30).pass,true);
 assert.equal(commission(2,6,45,30).pass,false);
 assert.equal(commission(2,7,45,30).pass,true);
});
