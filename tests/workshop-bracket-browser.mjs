import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
const local=process.env.OIA_BASE_URL?null:await createServer({configFile:false,root:process.env.OIA_WORKSHOP_SOURCE||'dist',optimizeDeps:{noDiscovery:true},server:{host:'127.0.0.1',port:0}});
await local?.listen();const base=(process.env.OIA_BASE_URL??local.resolvedUrls.local[0]).replace(/\/$/,'');
const browser=await chromium.launch({executablePath:process.env.OIA_CHROMIUM||undefined});
try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/workshop/studio/part/index.html?practical=bracket');await page.locator('#drawing-need').filter({hasText:'Conveyor photoeye mount'}).waitFor();
  const click=id=>page.locator('#'+id).click();const input=(id,val)=>page.locator('#'+id).fill(String(val));
  async function shape(w,h,wall,depth){
    await input('width',w);await input('height',h);await page.locator('#dimensions button').click();await input('wall-size',wall);await page.locator('#wall-form button').click();await input('depth',depth);await page.locator('#depth').press('Tab');
  }
  async function predict(n){await input('volume-prediction',n);await page.locator('#predict-form button').click();}
  await click('verify-drawing');assert.ok(await page.locator('#mount-verified').isDisabled());assert.match(await page.locator('#drawing-checks').innerText(),/REWORK.*Width/);
  await predict(25);await shape(100,50,6,24);await click('verify-drawing');assert.ok(await page.locator('#mount-verified').isDisabled());assert.match(await page.locator('#drawing-checks').innerText(),/REWORK.*Prior prediction/);
  await click('restart-drawing');await predict(20.736);await shape(99,50,6,24);await click('verify-drawing');assert.ok(await page.locator('#mount-verified').isDisabled());
  await shape(100,50,6,24);await click('verify-drawing');assert.equal(await page.locator('#mount-verified').isEnabled(),true);
  await input('depth',25);await page.locator('#depth').press('Tab');assert.ok(await page.locator('#mount-verified').isDisabled());
  await click('undo');await click('verify-drawing');await click('mount-verified');assert.match(await page.locator('#drawing-evidence').innerText(),/1 mounted record/);
  await page.locator('#drawing-choice').selectOption('B');await predict(18.792);await shape(75,60,4.5,32);await click('verify-drawing');await click('mount-verified');assert.match(await page.locator('#drawing-evidence').innerText(),/2 mounted records/);
  const output=page.waitForEvent('download');await click('export-drawing-evidence');const records=JSON.parse(await readFile(await(await output).path(),'utf8'));assert.equal(records.records.length,2);assert.equal(records.records[1].predictedCM3,18.792);
  if(process.env.OIA_WORKSHOP_SCREENSHOTS){await mkdir(process.env.OIA_WORKSHOP_SCREENSHOTS,{recursive:true});await page.setViewportSize({width:1440,height:920});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:resolve(process.env.OIA_WORKSHOP_SCREENSHOTS,'bracket-practical-verified.png')});await page.setViewportSize({width:390,height:844});}
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('oia-workshop-v1:Learner:active')));
  assert.deepEqual(saved.extensions.bracketDrawingEvidence.map(r=>[r.drawing.id,r.measured.volumeCM3,r.assetId]),[['A',20.736,'PartMount'],['B',18.792,'PartMount']]);
  assert.equal(saved.extensions.studioPart.depth,32);
  await page.reload();await page.locator('#drawing-evidence').filter({hasText:'2 mounted records'}).waitFor();
  await page.getByText('Edit design brief',{exact:true}).click();await input('brief-title','Transfer mount');await input('brief-width',110);await page.locator('#brief-form button').click();
  assert.match(await page.locator('#drawing-need').innerText(),/Transfer mount/);assert.ok(await page.locator('#mount-verified').isDisabled());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  console.log('390px direct practical: incorrect prior prediction and dimensions rejected; changed geometry invalidates acceptance; undo/retest, two distinct mounted drawing records, project reload and editable transfer brief passed.');
}finally{await browser.close();await local?.close();}
