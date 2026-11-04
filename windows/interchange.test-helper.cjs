const {chromium}=require('../node_modules/playwright');
const http=require('node:http');
const path=require('node:path');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const {resolveAsset}=require('./native.cjs');
async function interchange(project, site, directory) {
  const server=http.createServer(async (req,res)=>{
    try {
      const file=resolveAsset(site,new URL(req.url,'workshop://local').href);
      const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
      res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
      res.end(await fs.readFile(file));
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({channel:'msedge',headless:true});
    const page=await browser.newPage();page.setDefaultTimeout(15000);
    await page.goto('http://127.0.0.1:'+server.address().port+'/workshop/classic.html');
    await page.locator('#mode option').first().waitFor({state:'attached'});
    await page.locator('#file').setInputFiles(project);
    await page.locator('#confirm button[value="replace"]').click();
    await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('Portable project opened'));
    assert.match(await page.locator('#asset').innerText(),/transfer-belt/);
    await page.locator('#notebook').fill('Validated in browser after Windows export.');
    const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#export').click()]);
    const returned=path.join(directory,'browser-roundtrip.json');
    await download.saveAs(returned);
    assert.equal(JSON.parse(await fs.readFile(returned,'utf8')).learning.notebook,'Validated in browser after Windows export.');
    return returned;
  } finally { if(browser) await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
module.exports={interchange};
