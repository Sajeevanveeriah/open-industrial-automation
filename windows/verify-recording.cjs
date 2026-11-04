const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {_electron:electron}=require('../node_modules/playwright');
(async()=>{
  const base=path.resolve('evidence-local');await fs.mkdir(base,{recursive:true});
  const dir=await fs.mkdtemp(path.join(base,'recording-')),file=path.join(dir,'contract-test.json');
  const record={schema:'oia.engine-run/1',scenario:'packaging-pilot/1',source:'isaac-sim',scenarioSha256:require('node:crypto').createHash('sha256').update(await fs.readFile('engine/scenario.json')).digest('hex'),stageSha256:require('node:crypto').createHash('sha256').update(await fs.readFile('../dist/workshop/cad/assets/cell.usda')).digest('hex'),units:'SI',upAxis:'Z',frame:'cell',
    engineVersion:'contract-test',runId:'known-input-fixture',stepSeconds:1/60,wallSeconds:8,vrAMMiB:null,
    samples:Array.from({length:241},(_,i)=>({timeS:i/60,cartonXM:.4+i/240,robotJointRad:Math.PI*i/480,sensorHigh:i>=108&&i<=180}))};
  await fs.writeFile(file,JSON.stringify(record));
  const app=await electron.launch({executablePath:require('electron'),args:[__dirname,'--workshop-test-hidden','--user-data-dir='+path.join(dir,'profile')]});
  try{
    const page=await app.firstWindow();page.setDefaultTimeout(10000);
    await page.waitForFunction(()=>document.body?.dataset.ready==='true' && !document.body.inert);
    await page.goto('workshop://local/workshop/native/index.html');
    await app.evaluate(({dialog},selected)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[selected]});},file);
    await page.locator('#import').click();
    await page.waitForFunction(()=>document.getElementById('result').textContent.length>0);
    const output=await page.locator('#result').innerText();
    assert.match(output,/0\.000000 m/);assert.match(output,/1\.800 s/);assert.match(output,/0\.500/);assert.match(output,/Beam discrepancies away from sample boundaries: 0/);
    assert.match(output,/known-input-fixture/);assert.match(output,/Scenario and stage match/);
    await fs.writeFile(file,JSON.stringify({...record,scenarioSha256:'0'.repeat(64)}));await page.locator('#import').click();
    await page.waitForFunction(()=>document.getElementById('result').textContent.includes('differs from this installation'));
    await fs.writeFile(file,JSON.stringify({...record,frame:'unauthorised'}));
    await page.locator('#import').click();await page.waitForFunction(()=>document.getElementById('result').textContent.includes('Unsupported'));
    console.log('Windows dev UI imported the synthetic control file as self-declared, calculated 1.800 s and 0.500 real-time factor; wrong frame rejected.');
  } finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
