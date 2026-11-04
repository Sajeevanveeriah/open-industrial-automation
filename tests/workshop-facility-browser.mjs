import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createServer} from 'vite';
const local=process.env.OIA_BASE_URL?null:await createServer({configFile:false,root:'dist',optimizeDeps:{noDiscovery:true},server:{host:'127.0.0.1',port:0}});
await local?.listen();const base=(process.env.OIA_BASE_URL??local.resolvedUrls.local[0]).replace(/\/$/,'');
const browser=await chromium.launch({executablePath:process.env.OIA_CHROMIUM||undefined});
try{
  for(const width of [1440,390]){
    const page=await browser.newPage({viewport:{width,height:900},acceptDownloads:true}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    const click=id=>page.locator('#'+id).click();
    page.on('crash',()=>console.error('Facility renderer crashed at '+page.url()));
    page.on('console',msg=>{if(msg.type()==='error')console.error('Facility console: '+msg.text());});
    await page.goto(base+'/workshop/index.html');await page.waitForURL('**/studio/facility/index.html');await page.waitForFunction(()=>document.body.dataset.ready==='true'&&!document.body.inert);
    const renderer=await page.locator('#facility-viewport').getAttribute('data-renderer');assert.ok(['webgl','plan'].includes(renderer));
    const started=await page.locator('#clock').innerText();await page.waitForFunction(t=>document.getElementById('clock').textContent!==t,started);
    await click('toggle-play');const paused=await page.locator('#clock').innerText();await page.waitForTimeout(350);assert.equal(await page.locator('#clock').innerText(),paused);
    assert.equal(await page.locator('#asset-select option').count(),22+352+8+4+2);
    if(await page.locator('#fold-list').getAttribute('aria-expanded')==='false')await click('fold-list');
    await page.locator('#asset-select').selectOption('AMR-02');await click('fault-toggle');assert.equal(await page.locator('#asset-state').innerText(),'FAULT');
    await click('step');assert.match(await page.locator('#asset-details').innerText(),/0 m\/s/);await click('fault-toggle');await click('step');assert.notEqual(await page.locator('#asset-state').innerText(),'FAULT');
    await click('overview');await click('follow');assert.equal(await page.locator('#follow').getAttribute('aria-pressed'),'true');
    await page.locator('#asset-select').selectOption('A01-L01');assert.match(await page.locator('#asset-name').innerText(),/A01-L01/);await click('fault-toggle');await page.locator('#asset-select').selectOption('A01');assert.equal(await page.locator('#asset-state').innerText(),'ENTRY BLOCKED');await click('fault-toggle');assert.equal(await page.locator('#asset-state').innerText(),'ENTRY AVAILABLE');
    await click('menu');await click('auto-demand');await click('close');await click('order-open');
    const form=page.locator('#dialog-body form');await form.locator('button[type=submit],button.primary').click();const order=(await page.locator('#asset-name').innerText()).replace('Order ','');assert.match(order,/^SO-\d+$/);assert.match(await page.locator('#asset-details').innerText(),/PL-\d+/);
    await page.locator('#speed').selectOption('10');await click('toggle-play');
    await page.waitForFunction(()=>document.getElementById('asset-state').textContent==='STAGED',null,{timeout:60000});await click('toggle-play');
    await click('asset-action');assert.equal(await page.locator('#asset-state').innerText(),'DISPATCHED');if(await page.locator('#fold-journey').getAttribute('aria-expanded')==='false')await click('fold-journey');assert.match(await page.locator('#journey-stops').innerText(),/Dispatched/);
    if(await page.locator('#fold-list').getAttribute('aria-expanded')==='false')await click('fold-list');await page.locator('#category').selectOption('orders');await page.locator('#filter').fill(order);assert.equal(await page.locator('#activity-list button').count(),1);await page.locator('#activity-list button').click();assert.match(await page.locator('#asset-name').innerText(),new RegExp(order));
    await click('menu');const downloadEvent=page.waitForEvent('download');await click('scenario-export');const file=await downloadEvent,text=await readFile(await file.path(),'utf8'),doc=JSON.parse(text);assert.equal(doc.format,'oia-facility');assert.ok(doc.history.some(r=>r[0]==='dispatch'));
    const clock=await page.locator('#clock').innerText();await page.locator('#scenario-file').setInputFiles({name:'facility-scenario.json',mimeType:'application/json',buffer:Buffer.from(text)});await page.locator('#dialog').waitFor({state:'hidden'});assert.equal(await page.locator('#clock').innerText(),clock);assert.equal(await page.locator('#toggle-play').innerText(),'Play');
    await page.reload();await page.waitForFunction(()=>document.body.dataset.ready==='true');assert.equal(await page.locator('#clock').innerText(),clock);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.addScriptTag({path:'node_modules/axe-core/axe.min.js'});const violations=await page.evaluate(async()=>(await axe.run()).violations.map(v=>[v.id,v.nodes.map(n=>n.target)]));assert.deepEqual(violations,[]);assert.deepEqual(errors,[]);
    console.log(width+' × 900 / '+renderer+': live opening, pause/step/fault recovery, selectable 388 assets, real reservation/pick/dispatch, pallet timeline, activity filter and exported/reopened scenario verified; no page errors, overflow or axe violations.');
    await page.close();
  }
  const offline=await browser.newPage({viewport:{width:390,height:844}});
  await offline.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}});});
  await offline.goto(base+'/workshop/studio/facility/index.html');await offline.waitForFunction(()=>document.body.dataset.ready==='true');assert.equal(await offline.locator('#asset-select option').count(),388);await offline.close();
  console.log('Unavailable local storage still opens a usable in-memory facility.');
}finally{await browser.close();await local?.close();}
