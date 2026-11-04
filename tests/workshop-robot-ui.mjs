import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=path.resolve('dist'),types={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
  try {
    const file=path.resolve(base,'.'+new URL(req.url,'http://localhost').pathname);
    if(!file.startsWith(base+path.sep))throw Error();
    res.setHeader('Content-Type',types[path.extname(file)]??'application/octet-stream');
    res.end(await fs.readFile(file));
  }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try {
  browser=await chromium.launch(process.env.OIA_CHROMIUM?{executablePath:process.env.OIA_CHROMIUM}:{});
  for(const width of [390,1280]){
    const page=await browser.newPage({viewport:{width,height:850}});page.setDefaultTimeout(12000);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto((process.env.OIA_BASE_URL||('http://127.0.0.1:'+server.address().port)).replace(/\/$/,'')+'/workshop/robot/index.html');
    await page.getByRole('link',{name:'Conveyor tracking, pallet patterns and mobile navigation'}).click();
    await page.waitForFunction(()=>!document.body.inert && document.querySelector('#motion-result')?.textContent.includes('Accepted'));
    await page.locator('[name=pitchM]').fill('0.02');await page.getByRole('button',{name:'Evaluate joint trajectory'}).click();
    assert.match(await page.locator('#motion-result').innerText(),/overlap/);
    await page.locator('[name=pitchM]').fill('0.08');await page.locator('[name=rows]').fill('1');await page.getByRole('button',{name:'Evaluate joint trajectory'}).click();
    assert.match(await page.locator('#motion-result').innerText(),/Delivered 2\/2/);
    await page.getByRole('button',{name:'Step 100 ms'}).click();await page.getByRole('button',{name:'Cancel goal'}).click();
    assert.match(await page.locator('#route-result').innerText(),/cancelled/);
    await page.locator('[name=reliability]').selectOption('best-effort');
    await page.getByRole('button',{name:'Accept navigation goal'}).click();await page.getByRole('button',{name:'Run goal to result'}).click();
    assert.match(await page.locator('#route-result').innerText(),/acceptance failed/);
    assert.match(await page.locator('#route-reading').innerText(),/incompatible QoS/);
    await page.locator('[name=reliability]').selectOption('reliable');
    await page.getByRole('button',{name:'Accept navigation goal'}).click();await page.getByRole('button',{name:'Run goal to result'}).click();
    assert.match(await page.locator('#route-result').innerText(),/acceptance passed/);
    await page.getByRole('link',{name:'Return to robot cell'}).click();
    const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#save').click()]);
    const returned=JSON.parse(await fs.readFile(await download.path(),'utf8'));
    assert.equal(returned.advanced.plan.rows,1);assert.ok(returned.advanced.ticks>1);
    await page.getByRole('link',{name:'Conveyor tracking, pallet patterns and mobile navigation'}).click();
    await page.waitForFunction(()=>document.getElementById('route-result')?.textContent.includes('acceptance passed'));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    assert.deepEqual(errors,[]);await page.close();console.log('Passed at '+width+' CSS px: changed pattern, QoS failure, recovery, export and checkpoint replay.');
  }
} finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
