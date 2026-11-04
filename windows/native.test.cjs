const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {readBounded,saveAtomic,projectText,resolveAsset,convertStep,engineStatus} = require('./native.cjs');

test('offline protocol restricts schemes, hosts, drives, UNC and traversal', () => {
  const base = path.resolve('site');
  assert.equal(resolveAsset(base,'workshop://local/workshop/'), path.join(base,'workshop/index.html'));
  for (const url of ['https://local/workshop/','workshop://other/index.html','workshop://local/%2E%2E%2Fprivate','workshop://local/C%3A/Windows/','workshop://local/%5C%5Cserver']) assert.equal(resolveAsset(base,url),null);
});

test('local save atomically replaces a valid project and retains it after malformed or oversized data', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),'oia-files-'));
  t.after(() => fs.rm(dir,{recursive:true,force:true}));
  const file = path.join(dir,'cell.json');
  await saveAtomic(file,'{"version":1}');
  await saveAtomic(file,'{"version":2}');
  await assert.rejects(()=>saveAtomic(file,'{'));
  assert.equal(await fs.readFile(file,'utf8'),'{"version":2}');
  assert.throws(()=>projectText(' '.repeat(8388609)),/limit/);
  await assert.rejects(()=>readBounded(file,2),/limit/);
  assert.equal((await readBounded(file,64)).length,13);
  assert.deepEqual(await fs.readdir(dir),['cell.json']);
});

test('kernel converts actual STEP assembly from 100 mm to 0.100 m', {skip:process.env.OIA_FREECAD_TEST!=='1'}, async () => {
  const file = path.resolve('../simulator/workshop/cad/assets/photoeye-assembly.step');
  const converted = await convertStep(file,path.resolve('convert.py'));
  assert.ok(Math.abs(converted.dimensionsM[0]-0.100)<1e-6);
  assert.ok(converted.triangles.length>=12);
  assert.equal(converted.axis,'Z-up');
  assert.equal(Buffer.from(converted.sourceBase64,'base64').compare(await fs.readFile(file)),0);
});

test('invalid imports stop before external model parsing', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),'oia-step-'));
  t.after(() => fs.rm(dir,{recursive:true,force:true}));
  const file = path.join(dir,'bad.step');
  for (const text of ['garbage','ISO-10303-21;REFERENCE;']) {
    await fs.writeFile(file,text);
    await assert.rejects(()=>convertStep(file,'unused'),/self-contained/);
  }
  await assert.rejects(()=>convertStep('a.FCStd','unused'),/STEP/);
  await assert.rejects(()=>convertStep(file,'unused',0.00001),/tolerance/);
  assert.equal((await engineStatus(dir)).available,false);
});
const {validateRun}=require('./engine.cjs');
test('external run validation compares independently specified values and rejects timing and unit faults',()=>{
 const samples=Array.from({length:241},(_,i)=>({timeS:i/60,cartonXM:0.4+i/240,robotJointRad:Math.PI*i/480,sensorHigh:i>=108&&i<=180}));
 const run={schema:'oia.engine-run/1',scenario:'packaging-pilot/1',source:'isaac-sim',units:'SI',upAxis:'Z',frame:'cell',runId:'test-run',engineVersion:'test fixture',stepSeconds:1/60,samples,wallSeconds:8,vrAMMiB:null};
 const compared=validateRun(run);
 assert.equal(compared.firstDetectionS,1.8);assert.equal(compared.realTimeFactor,0.5);assert.equal(compared.maxPositionErrorM,0);
 assert.throws(()=>validateRun({...run,units:'mm'}),/Unsupported/);
 assert.throws(()=>validateRun({...run,samples:samples.slice(1)}),/241/);
 const rows=structuredClone(samples);rows[1].timeS=2;assert.throws(()=>validateRun({...run,samples:rows}),/invalid sample/);
});
