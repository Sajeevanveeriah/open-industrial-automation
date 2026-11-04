import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createServer} from 'vite';
const local=process.env.OIA_BASE_URL?null:await createServer({configFile:false,root:'dist',optimizeDeps:{noDiscovery:true},server:{host:'127.0.0.1',port:0}});
await local?.listen();const base=(process.env.OIA_BASE_URL??local.resolvedUrls.local[0]).replace(/\/$/,'');
const browser=await chromium.launch({executablePath:process.env.OIA_CHROMIUM||undefined});
try{for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:900},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/workshop/studio/part/index.html');await page.locator('#measure').filter({hasText:'18.6 cm³'}).waitFor();
  const meshImage=()=>page.locator('#solid').evaluate(c=>c.toDataURL());
  const initial=await meshImage();const shaded=await page.locator('#solid').evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let fill=0;for(let i=0;i<d.length;i+=4)if(d[i+1]>d[i]*1.7&&d[i+1]<155)fill++;return fill;});
  assert.ok(shaded>6000,'Initial part must paint shaded faces.');
  const corner=page.locator('#handles [data-index="3"]');await corner.focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#px').inputValue(),'7');
  assert.notEqual(await meshImage(),initial);await page.getByRole('button',{name:'Undo edit'}).click();assert.equal(await meshImage(),initial);
  await corner.scrollIntoViewIfNeeded();const box=await corner.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+14,box.y+box.height/2-5,{steps:4});await page.mouse.up();
  assert.notEqual(await page.locator('#px').inputValue(),'6');const changed=await meshImage();assert.notEqual(changed,initial);
  await page.getByRole('button',{name:'Undo edit'}).click();assert.equal(await meshImage(),initial);await page.getByRole('button',{name:'Redo edit'}).click();assert.equal(await meshImage(),changed);
  await page.getByLabel('Live extrusion preview (mm)').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#depth').inputValue(),'25.1');
  await page.getByRole('button',{name:'Orbit right'}).click();assert.notEqual(await meshImage(),changed);
  await page.getByLabel('Feature operation',{exact:true}).selectOption('revolve');await page.locator('#featureBadge').filter({hasText:'Revolved solid'}).waitFor();
  for(const [name,ext] of [['Download STL','.stl'],['Download drawing','.svg']]){
    const pending=page.waitForEvent('download');await page.getByRole('button',{name}).click();const d=await pending;assert.ok(d.suggestedFilename().endsWith(ext));assert.ok((await readFile(await d.path())).length>512);
  }
  await page.getByRole('button',{name:'Save into active project'}).click();await page.locator('#status').filter({hasText:'Saved to Learner'}).waitFor();
  await page.reload();await page.locator('#featureBadge').filter({hasText:'Revolved solid'}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.addScriptTag({path:'node_modules/axe-core/axe.min.js'});
  assert.deepEqual(await page.evaluate(async()=>(await axe.run()).violations.map(v=>[v.id,v.nodes.map(n=>n.target)])),[]);
  await page.locator('#mount').click();await page.waitForURL('**/workshop/studio/index.html');
  await page.waitForFunction(()=>document.body.dataset.ready==='true');
  await page.locator('[data-renderer]').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('[data-renderer]')?.textContent.includes('authored solid'));
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('oia-workshop-v1:Learner:active')).extensions.studioPart.mount.assetId),'PartMount');
  assert.deepEqual(errors,[]);console.log(width+' px: '+shaded+' initial shaded pixels; live drag and nudge, exact undo/redo, extrusion, orbit, revolution, both downloads, save/reopen and cell mount passed; no page errors or axe violations.');await page.close();
}}finally{await browser.close();await local?.close();}
