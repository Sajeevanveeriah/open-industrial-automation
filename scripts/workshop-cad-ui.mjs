import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';
const local=process.env.OIA_BASE_URL?null:await createServer({configFile:false,root:'dist',server:{host:'127.0.0.1',port:4197,strictPort:true}});
await local?.listen();
const base=process.env.OIA_BASE_URL||'http://127.0.0.1:4197';
const browser=await chromium.launch({executablePath:process.env.OIA_CHROMIUM||undefined});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base.replace(/\/$/,'')+'/workshop/cad/index.html');
 for(const [file,x,parts] of [['photoeye-assembly.step','0.1000',2],['photoeye.glb','0.1000',1],['carton.stl','0.3200',1],['picker.urdf','0.6000',3],['cell.usda','2.0000',3]]){
   await page.selectOption('#example',file);await page.click('#load');
   await page.waitForFunction(()=>!document.querySelector('#mount').disabled||!document.querySelector('#status').textContent.includes('Reading'));
   const status=await page.locator('#status').innerText();assert.ok(status.includes(file),status);
   assert.equal(await page.locator('#part option').count(),parts+1);
   assert.ok((await page.locator('#dimensions').innerText()).includes(x),await page.locator('#dimensions').innerText());
 }
 await page.setInputFiles('#file',{name:'bad.gltf',mimeType:'application/json',buffer:Buffer.from('{"buffers":[{"uri":"https://invalid.local/mesh"}]}')});
 await page.click('#import');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('embedded'));
 assert.ok(await page.locator('#mount').isDisabled());
 await page.setInputFiles('#file',{name:'large.step',mimeType:'application/octet-stream',buffer:Buffer.alloc(1048577)});
 await page.click('#import');await page.getByText('Choose a non-empty local file no larger than 1 MiB.').waitFor();
 await page.selectOption('#example','photoeye-assembly.step');await page.click('#load');await page.click('#cancel');
 assert.equal(await page.locator('#status').innerText(),'Import cancelled.');
 await page.click('#generate');await page.click('#mount');await page.getByText('CAD and engine workspace',{exact:true}).click();await page.locator('#cad-info').getByText(/Parametric bracket.*measured width 0[.]100 m/).waitFor();
 assert.deepEqual(errors,[]);console.log('CAD UI passed: 390 × 844, five file formats, known dimensions, hierarchy, external reference, excessive size, cancellation and mount navigation.');
}finally{await browser.close();await local?.close();}
