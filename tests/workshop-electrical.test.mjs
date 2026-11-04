import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank,place,wire,sample,reference,readNet} from '../simulator/workshop/electrical/circuit.mjs';
test('DC divider with 0.2 ohm source, floating branch and retained sample',()=>{
 const n=blank();for(const [type,id] of [['supply','PS'],['resistor','R1'],['resistor','R2'],['lamp','floating']])place(n,type,id);
 wire(n,'PS.+','R1.1');wire(n,'R1.2','R2.1');wire(n,'R2.2','PS.0V');
 const r=sample(readNet(n));assert.ok(Math.abs(r.supplyAmps-24/480.2)<1e-10);assert.ok(Math.abs(r.voltage['R2.1']-24*240/480.2)<1e-9);assert.equal(r.voltage['floating.+'],null);
});
test('coil precedes contact and overload opens fuse at next sample',()=>{
 const n=reference();assert.deepEqual(sample(n).coils,[]);n.parts.find(p=>p.id==='S1').on=true;
 const first=sample(n);assert.deepEqual(first.live,[]);assert.deepEqual(first.coils,['K1']);assert.deepEqual(sample(n,first.coils).live,['DI0','H1']);
 wire(n,'F1.out','PS1.0V');sample(n);assert.ok(n.parts.find(p=>p.id==='F1').blown);assert.ok(Math.abs(sample(n).supplyAmps)<1e-9);
});
