import test from 'node:test';
import assert from 'node:assert/strict';
import {createServers,operate,probe,storage,assessments,exportServers,importServers} from '../simulator/workshop/servers/server-model.mjs';
function make(primary='PRIMARY',standby='DR',ram=8,disk=32){
  const s=createServers();
  for(const name of [primary,standby]){
    operate(s,'host',{name,ram,disk});for(const service of ['database','application'])operate(s,'deploy',{name,service});
    operate(s,'certificate',{name,days:2});
  }
  for(const [user,group]of [['svc-app','database'],['operator','view'],['engineer','admin']])operate(s,'grant',{user,group});
  operate(s,'route',{name:primary});return s;
}
test('two valid named host designs recover with zero loss and pass positive and prohibited paths',()=>{
  for(const [a,b,ram,disk]of [['IT-A','IT-B',6,20],['WS03','WS01',16,128]]){
    const s=make(a,b,ram,disk);
    assert.equal(operate(s,'write',{user:'engineer',label:'LOT-12'}),'Committed TX-1');
    assert.equal(operate(s,'read',{user:'operator'}),'Read 1 production records');assert.equal(operate(s,'read',{user:'visitor'}),'Access denied');
    operate(s,'backup',{name:a});operate(s,'restore',{name:b});operate(s,'power',{name:a,on:false});operate(s,'advance',{seconds:12});operate(s,'route',{name:b});
    assert.deepEqual(s.lastRecovery,{start:0,end:12,rto:12,rpo:0,missing:[],expected:1,recovered:1});
    operate(s,'power',{name:a,on:true});assert.ok(assessments(s).every(([,pass])=>pass));assert.deepEqual(importServers(exportServers(s)),s);
  }
});
test('stale replica reports committed data loss, failed target and exact outage time',()=>{
  const s=make();operate(s,'advance',{seconds:10});operate(s,'write',{user:'engineer',label:'LOT-A'});operate(s,'replicate',{name:'DR'});
  operate(s,'advance',{seconds:10});operate(s,'write',{user:'engineer',label:'LOT-B'});operate(s,'advance',{seconds:5});
  operate(s,'power',{name:'PRIMARY',on:false});operate(s,'advance',{seconds:20});operate(s,'route',{name:'DR'});
  assert.equal(s.lastRecovery.rto,20);assert.equal(s.lastRecovery.rpo,15);assert.deepEqual(s.lastRecovery.missing,['TX-2']);assert.equal(assessments(s).at(-1)[1],false);
});
test('patch canary isolates incompatibility from live service and supports schema alignment or rollback',()=>{
  const s=make();operate(s,'patch',{name:'DR',version:2});
  assert.match(operate(s,'verify',{name:'DR'}),/incompatible/);assert.equal(probe(s),'Healthy');
  operate(s,'migrate',{name:'DR'});assert.match(operate(s,'verify',{name:'DR'}),/Healthy/);
  operate(s,'rollback',{name:'DR'});assert.equal(s.hosts[1].app,1);assert.equal(s.hosts[1].schema,1);
});
test('corrupt archive cannot overwrite records, denied writes and missing dependencies leave audit evidence',()=>{
  const s=make();operate(s,'write',{user:'engineer',label:'O-1'});operate(s,'backup',{name:'PRIMARY'});operate(s,'replicate',{name:'DR'});operate(s,'damage');
  assert.match(operate(s,'restore',{name:'DR'}),/integrity/);assert.match(s.audit.at(-1).result,/blocked/);assert.equal(s.hosts[1].rows.length,1);
  assert.equal(operate(s,'write',{user:'operator',label:'O-2'}),'Access denied');
  operate(s,'revoke',{user:'svc-app',group:'database'});assert.match(probe(s),/identity denied/);assert.equal(s.audit.at(-1).action,'outage');
});
test('capacity constraints are transactional, certificate failure retains exact expiry inside time jump',()=>{
  const s=createServers();operate(s,'host',{name:'tiny',ram:5,disk:15});operate(s,'deploy',{name:'tiny',service:'database'});
  assert.throws(()=>operate(s,'deploy',{name:'tiny',service:'application'}),/Insufficient/);assert.deepEqual(storage(s.hosts[0]),{ram:4,disk:12});
  const full=make();operate(full,'certificate',{name:'PRIMARY',days:1});operate(full,'advance',{seconds:86400});operate(full,'advance',{seconds:30});
  assert.equal(full.outage.start,86400);operate(full,'certificate',{name:'PRIMARY',days:10});assert.equal(full.lastRecovery.rto,30);
  assert.throws(()=>importServers({format:'oia-server-study',version:1,log:[['fetch',{url:'https://test.invalid'}]]}));
});
test('backup taken after the last write establishes the true recoverable point',()=>{
  const s=make();operate(s,'write',{user:'engineer',label:'O-1'});operate(s,'advance',{seconds:40});
  operate(s,'backup',{name:'PRIMARY'});operate(s,'advance',{seconds:5});operate(s,'write',{user:'engineer',label:'O-2'});
  operate(s,'advance',{seconds:5});operate(s,'power',{name:'PRIMARY',on:false});
  operate(s,'restore',{name:'DR'});operate(s,'advance',{seconds:12});operate(s,'route',{name:'DR'});
  assert.equal(s.lastRecovery.rpo,10);assert.equal(s.lastRecovery.rto,12);assert.deepEqual(s.lastRecovery.missing,['TX-2']);
});
test('OS guests on shared hypervisor fail together; separate domain and mirrored member recovery preserve committed identity',async()=>{
  const {faultDomainChecks}=await import('../simulator/workshop/servers/server-model.mjs');const s=make();
  operate(s,'write',{user:'engineer',label:'LOT-X'});operate(s,'replicate',{name:'DR'});
  for(const [name,os] of [['PRIMARY','Linux'],['DR','Windows']])operate(s,'platform',{name,os,domain:'HV-A'});
  assert.equal(faultDomainChecks(s)[1][1],false);operate(s,'hypervisor',{domain:'HV-A',on:false});
  assert.equal(probe(s),'Hypervisor domain offline');operate(s,'route',{name:'DR'});assert.equal(probe(s),'Hypervisor domain offline');
  operate(s,'hypervisor',{domain:'HV-A',on:true});operate(s,'platform',{name:'PRIMARY',os:'Linux',domain:'HV-B'});
  assert.equal(faultDomainChecks(s)[1][1],true);operate(s,'mirror',{name:'DR'});operate(s,'diskFault',{name:'DR',member:1});
  assert.equal(probe(s),'Healthy');assert.equal(operate(s,'read',{user:'operator'}),'Read 1 production records');
  operate(s,'replaceDisk',{name:'DR',member:1});assert.equal(faultDomainChecks(s)[0][1],true);
  operate(s,'backup',{name:'PRIMARY'});operate(s,'diskFault',{name:'DR',member:1});operate(s,'diskFault',{name:'DR',member:2});
  assert.equal(probe(s),'Data volume unavailable');assert.equal(s.hosts[1].rows.length,0);
  operate(s,'replaceDisk',{name:'DR',member:1});operate(s,'restore',{name:'DR'});assert.equal(s.hosts[1].rows[0].id,'TX-1');assert.deepEqual(importServers(exportServers(s)),s);
});
