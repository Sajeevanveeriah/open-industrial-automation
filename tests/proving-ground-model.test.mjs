import test from 'node:test';
import assert from 'node:assert/strict';
import {ASSETS, FAT, createState, setPoint, setFault, advance, status, hierarchy, telemetry, payload, validFrame, fatStep} from '../simulator/proving-ground/model.mjs';

function near(actual,expected,tolerance=1e-8){
  assert.ok(Math.abs(actual-expected)<=tolerance,actual+' differs from '+expected);
}

test('nominal one-second movement, power, specific energy and currency have independent expected values',()=>{
  const s=createState();
  advance(s,1);
  assert.equal(s.scans,125);
  near(s.travel,1.6);
  near(s.drumAngle,2*Math.PI/5);
  near(s.robotAngle,14.2*2*Math.PI/60);
  near(s.cranePhase,2*Math.PI/32);
  near(s.roverTravel,1.4);
  near(s.throughput,18.4);
  near(s.powerKw,785.6);
  near(s.specificEnergy,785.6/18.4);
  near(s.rate,96+785.6*.24+18.4*3.2);
  near(s.oee,63.616);
  assert.deepEqual(s.alarms,[]);
  const amr=telemetry(s,'AMR-01');
  assert.equal(amr[2].value,10);assert.equal(amr[3].value,0);
});

test('thermal response reaches one time constant and reset respects the deadband',()=>{
  const s=createState();
  setPoint(s,'heat',185);
  setPoint(s,'cold',-25);
  advance(s,8);
  near(s.fryerTemp,185-10/Math.E);
  near(s.coldTemp,-25+5*Math.exp(-8/24));
  setPoint(s,'heat',195);
  advance(s,16);
  assert.equal(status(s,'Z3-FRY-01'),'TRIP');
  assert.equal(s.throughput,0);assert.equal(s.heaterKw,0);
  assert.equal(s.specificEnergy,null);
  setPoint(s,'heat',175);advance(s,30);
  assert.equal(status(s,'Z3-FRY-01'),'NOMINAL');
  assert.ok(s.heaterKw>0);near(s.throughput,18.4);
});

test('local faults affect their own mechanisms and expose distinguishable inspector evidence',()=>{
  const s=createState();
  setFault(s,'humidity',true);
  setFault(s,'obstacle',true);
  setFault(s,'jam',true);
  setFault(s,'heat',true);
  advance(s,1);
  assert.equal(s.alarms.length,4);
  assert.equal(s.travel,0);assert.equal(s.drumAngle,0);assert.equal(s.robotAngle,0);
  assert.equal(s.roverTravel,0);
  assert.equal(telemetry(s,'Z2-SB-01')[2].value,'PURGE');
  assert.equal(telemetry(s,'Z1-WB-01')[2].value,160);
  setFault(s,'jam',false);setFault(s,'obstacle',false);setFault(s,'heat',false);
  advance(s,16);
  assert.ok(s.travel>0);assert.ok(s.drumAngle>0);near(s.roverTravel,22.4);
  assert.equal(s.alarms.length,1);
  setPoint(s,'speed',0);
  assert.equal(s.specificEnergy,null);assert.ok(s.rate>0);
  setFault(s,'humidity',false);assert.equal(s.alarms.length,0);
});

test('the same control sequence at different render frequencies has the same engineering state',()=>{
  const a=createState(),b=createState();
  for(const s of [a,b]){setPoint(s,'heat',183);setPoint(s,'cold',-23);}
  advance(a,2);
  for(let i=0;i<120;i++)advance(b,1/60);
  for(const key of ['scans','seconds','travel','roverTravel','fryerTemp','coldTemp','goodTonnes','oee','rate'])assert.equal(a[key],b[key]);
  for(const change of [['speed',-1],['speed',2.51],['cold',Infinity],['heat',196],['weight',15]])assert.throws(()=>setPoint(a,...change));
  assert.throws(()=>setFault(a,'jam',1));assert.throws(()=>advance(a,-1));
});

test('typed telemetry has four distinct metrics per asset, a numeric primary measurement and bounded sequence',()=>{
  const s=createState();
  assert.equal(ASSETS.length,8);
  const seq=255,timestamp=1700000000123;
  for(const a of ASSETS){
    assert.ok(hierarchy(a).endsWith('/ WorkCenter: '+a.id));
    const rows=telemetry(s,a.id);assert.equal(rows.length,4);assert.equal(typeof rows[0].value,'number');
    const frame=payload(s,a.id,timestamp,seq);
    assert.equal(frame.topic,'spBv1.0/Voltwyn/NDATA/Dooen/'+a.id);
    assert.ok(validFrame(JSON.parse(JSON.stringify(frame)),a.id));
    assert.ok(!validFrame({...frame,topic:'invalid'},a.id));
    frame.payload.metrics[1].value=null;assert.ok(!validFrame(frame,a.id));
  }
  assert.throws(()=>payload(s,'AMR-01',timestamp,256));
  assert.throws(()=>payload(s,'not-an-asset',timestamp,0));
  assert.ok(!validFrame(null,'AMR-01'));
});

test('FAT operates on isolated copies; feeder transfer bridges the outage and an unavailable spare does not',()=>{
  const s=createState();advance(s,.017);setPoint(s,'speed',0);setFault(s,'jam',true);
  const original=structuredClone(s);
  assert.equal(FAT.length,6);
  for(let i=0;i<6;i++)assert.equal(fatStep(i,s).pass,true,FAT[i]);
  assert.deepEqual(s,original);
  s.primaryPower=false;
  advance(s,.008);assert.equal(s.feeder,'Transfer');assert.ok(s.stackerPowered);
  advance(s,.016);assert.equal(s.feeder,'Backup');assert.ok(s.stackerPowered);
  const fail=createState();fail.primaryPower=false;fail.backupPower=false;
  advance(fail,.032);assert.ok(fail.stackerPowered);
  advance(fail,.008);assert.equal(fail.stackerPowered,false);
  const phase=fail.cranePhase;advance(fail,2);assert.equal(fail.cranePhase,phase);
});
