import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {join} from 'node:path';
const local=process.env.OIA_BASE_URL?null:await createServer({configFile:false,root:'dist',optimizeDeps:{noDiscovery:true},server:{host:'127.0.0.1',port:0}});
await local?.listen();const base=(process.env.OIA_BASE_URL??local.resolvedUrls.local[0]).replace(/\/$/,'');
const url=base+'/workshop/studio/facility/index.html';
const browser=await chromium.launch({executablePath:process.env.OIA_CHROMIUM||undefined});
try{
  for(const width of [1440,390]){
    const page=await browser.newPage({viewport:{width,height:900},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    const click=id=>page.locator('#'+id).click(),goal=async n=>{await page.locator('#shift-progress').filter({hasText:n+' / 5'}).waitFor();};
    const ready=()=>page.waitForFunction(()=>document.body.dataset.ready==='true'&&!document.body.inert);
    await page.goto(url);await ready();await goal(0);const cta=await page.locator('#shift-primary').boundingBox();assert.ok(cta&&cta.y+cta.height<400);
    if(process.env.OIA_SHIFT_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.OIA_SHIFT_SCREENSHOT_DIR,'facility-operator-shift-'+width+'.png'),animations:'disabled'});
    await click('shift-primary');const wrong=page.locator('.stock-candidates button:not([data-pallet="PL-00157"])').first();await wrong.click();await click('shift-primary');await goal(0);assert.match(await page.locator('#shift-feedback').innerText(),/does not contain/);
    await click('shift-primary');await page.locator('[data-pallet="PL-00157"]').click();await click('shift-primary');await goal(1);await click('shift-primary');
    const form=page.locator('#dialog-body form');await form.locator('select').nth(2).selectOption('D01');await form.locator('button.primary').click();await goal(1);assert.match(await page.locator('#dialog-message').innerText(),/Wrong dispatch door/);
    await form.locator('select').nth(2).selectOption('D02');await form.locator('button.primary').click();await goal(2);
    const freeBefore=await page.evaluate(()=>localStorage.getItem('oia-facility-v1:Learner'));await page.reload();await ready();await goal(2);
    await click('shift-primary');await click('shift-primary');await page.locator('[data-truck="AMR-08"]').click();assert.match(await page.locator('#dialog-message').innerText(),/different task/);await page.locator('[data-truck="AMR-02"]').click();await goal(3);
    await click('shift-primary');await click('shift-primary');await click('shift-primary');await goal(4);await click('shift-primary');
    await page.locator('#job-pallet').fill('PL-00157');await page.locator('#job-lot').fill('LT-309');await page.locator('#job-trailer').fill('TR-01');await page.getByRole('button',{name:'Verify and sign off'}).click();assert.match(await page.locator('#dialog-message').innerText(),/Trailer mismatch/);
    await page.locator('#job-trailer').fill('TR-02');await page.getByRole('button',{name:'Verify and sign off'}).click();await goal(5);await page.reload();await ready();await goal(5);
    assert.equal(await page.evaluate(()=>localStorage.getItem('oia-facility-v1:Learner')),freeBefore);
    await click('shift-primary');await page.locator('summary').filter({hasText:'Dispatch operator'}).click();await page.locator('#dialog-body').filter({hasText:'PL-00157'}).waitFor();await click('close');
    await page.goto(url+'?job=incident');await ready();await click('shift-primary');await page.locator('#job-inspect-door').selectOption('D03');await click('job-cause-truck');assert.match(await page.locator('#dialog-message').innerText(),/truck is healthy/);await click('job-cause-door');
    await click('shift-primary');await click('job-redirect');await page.locator('#dialog-body form select').nth(2).selectOption('D04');await page.getByRole('button',{name:'Apply redirect'}).click();assert.match(await page.locator('#shift-progress').innerText(),/2 \/ 4/);
    await click('shift-primary');await click('shift-primary');await click('shift-primary');await page.locator('#job-pallet').fill('PL-00214');await page.locator('#job-lot').fill('LT-313');await page.locator('#job-trailer').fill('TR-04');await page.getByRole('button',{name:'Verify and sign off'}).click();assert.match(await page.locator('#shift-progress').innerText(),/4 \/ 4/);
    await page.goto(url+'?job=challenge');await ready();await goal(0);assert.doesNotMatch(await page.locator('#shift-instruction').innerText(),/PL-00157/);await page.goto(url+'?job=operator');await ready();await goal(5);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.addScriptTag({path:'node_modules/axe-core/axe.min.js'});const violations=await page.evaluate(async()=>(await axe.run()).violations.map(v=>[v.id,v.nodes.map(n=>n.target)]));assert.deepEqual(violations,[]);assert.deepEqual(errors,[]);
    console.log(width+' × 900: first action visible, four wrong answers rejected, correct original stock delivered once, operator and incident awards reopened independently, new transfer seed and untouched free shift verified.');await page.close();
  }
}finally{await browser.close();await local?.close();}
