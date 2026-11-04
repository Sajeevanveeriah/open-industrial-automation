import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultParameters,simulate,sweep,sampleAt,csv} from '../simulator/workshop/studio/analysis/experiment.mjs';
const near=(got,expected,tol=1e-8)=>assert.ok(Math.abs(got-expected)<=tol,got+' differs from '+expected);
test('unpowered drive coasts to 1/e after one physical time constant, exact integrated travel',()=>{
 for(const period of [.01,.125,.3]){const r=simulate({...defaultParameters,duration:2,period,initial:1,mode:'coast',load:0});
 near(r.metrics.finalSpeed,Math.exp(-1));near(r.metrics.travel,2*(1-Math.exp(-1)));assert.equal(r.data.time.at(-1),2);}
});
test('loaded brake stops without reversal; zero drag, constant deceleration, partial step',()=>{
 const r=simulate({...defaultParameters,initial:2,mass:2,drag:0,mode:'coast',load:4,loadAt:0,duration:1.13,period:.3});
 near(r.metrics.finalSpeed,0);near(r.metrics.travel,1);assert.equal(r.data.time.length,5);
});
test('saturated PI plant and delayed demand have hand-calculated first control samples',()=>{
 const r=simulate({...defaultParameters,duration:1,period:.25,initial:0,mass:2,drag:0,kp:10,ki:2,limit:2,setpoint:1,stepAt:.3,load:0});
 assert.deepEqual(r.data.target,[0,0,1,1,1]);assert.deepEqual(r.data.drive,[0,0,2,2,2]);near(r.metrics.finalSpeed,.5);near(r.metrics.travel,.125);near(r.metrics.saturatedSeconds,.5);
});
test('sweep isolates requested parameter, CSV preserves full numeric arrays and spacing, rejects invalid inputs',()=>{
 const rows=sweep(defaultParameters,'kp',[8,24,48]);assert.equal(rows.length,3);assert.ok(rows[0].metrics.iae>rows[2].metrics.iae);assert.deepEqual(defaultParameters.kp,24);
 const select=sampleAt(rows[1],.499);assert.equal(rows[1].data.time[select],.5);
 const text=csv([{id:2,result:rows[1]}]);assert.equal(text.trim().split('\r\n').length,602);assert.match(text,/speed_m_per_s/);
 for(const change of [{duration:120,period:.002},{kp:Infinity},{mode:'eval'},{duration:-1}])assert.throws(()=>simulate({...defaultParameters,...change}));
 assert.throws(()=>sweep(defaultParameters,'__proto__',[1,2]));assert.throws(()=>sweep(defaultParameters,'kp',[2,2]));
});
