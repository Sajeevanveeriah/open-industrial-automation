import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
const source=resolve(process.env.OIA_WORKSHOP_SOURCE||'dist');
let server;
const root=process.env.OIA_BASE_URL||await new Promise(done=>{
  server=createServer(async(req,res)=>{try{
    let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(p.endsWith('/'))p+='index.html';
    const base=process.env.OIA_WORKSHOP_SOURCE&&p.startsWith('/vendor/')?resolve('dist'):source;
    const file=resolve(base,'.'+p);if(!file.startsWith(base+sep))throw Error();
    const mime={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.svg':'image/svg+xml'};
    const bytes=await readFile(file);res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(bytes);
  }catch{res.writeHead(404);res.end();}});server.listen(0,'127.0.0.1',()=>done('http://127.0.0.1:'+server.address().port));
});
const browser=await chromium.launch(process.env.OIA_CHROMIUM?{executablePath:process.env.OIA_CHROMIUM}:{});
try{
  const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
  const button=name=>page.getByRole('button',{name,exact:true});
  const openTools=async()=>{if(!await page.getByRole('link',{name:'Site assembly'}).isVisible())await page.getByText('CAD and engine workspace',{exact:true}).click();};
  const clickLink=async name=>{await page.getByRole('link',{name,exact:true}).click();await page.waitForLoadState('load');};
  await page.goto(root.replace(/\/$/,'')+'/workshop/index.html');await openTools();await clickLink('Open CAD import bench');
  await page.locator('#constraint-b').selectOption('perimeter');await page.locator('#value-b').fill('280');await page.locator('#solve').click();assert.match(await page.locator('#sketch-status').innerText(),/height 40.00/);
  await page.locator('#constraint-c').selectOption('height');await page.locator('#value-c').fill('42');await page.locator('#solve').click();assert.match(await page.locator('#sketch-status').innerText(),/Conflicting/);
  await page.locator('#constraint-c').selectOption('');await page.locator('#design-reason').fill('Mount a sensor at the edge.');await page.locator('#issue').click();
  await page.locator('#feature').selectOption('mount');await page.locator('#tol').fill('0.2');await page.locator('#design-reason').fill('Allow wider collar fit.');await page.locator('#issue').click();
  await page.locator('#measured').fill('100.15');await page.locator('#inspect-fit').click();assert.match(await page.locator('#fit-result').innerText(),/PASS/);
  await page.locator('#drawing-rev').selectOption('1');await page.locator('#inspect-fit').click();assert.match(await page.locator('#fit-result').innerText(),/FAIL/);
  await page.locator('#feature').selectOption('revolve');await page.locator('#profile-vertices').fill('10,0 20,0 20,15 10,15');await page.locator('#design-reason').fill('Set a 40 mm outside diameter');await page.locator('#issue').click();assert.match(await page.locator('#dimensions').innerText(),/0.0400 × 0.0400 × 0.0150/);
  await page.locator('#drawing-rev').selectOption('2');const out=page.waitForEvent('download');await page.locator('#drawing-export').click();assert.match((await out).suggestedFilename(),/Rev02.svg/);
  await page.locator('#mount').click();await openTools();await clickLink('Open CAD import bench');await page.locator('#reopen').click();assert.equal(await page.locator('#drawing-rev option').count(),3);assert.equal(await page.locator('#feature').inputValue(),'mount');await page.locator('#mount').click();
  await openTools();await clickLink('Site assembly');await page.locator('#sample').click();await page.locator('#tree').selectOption('bracket');await page.locator('#other').selectOption('belt');
  await page.locator('#joint-form [name=kind]').selectOption('prismatic');await page.locator('#joint-form button').click();await page.locator('#joint-value').fill('0.5');await page.locator('#drive-form button').first().click();
  assert.match(await page.locator('#joint-reading').innerText(),/travel 0.5/);await page.locator('#interference').click();assert.match(await page.locator('#interference-result').innerText(),/overlap/);
  await page.locator('#proxy').fill('-0.5,-0.5 0.5,-0.5 -0.5,0.5');await page.locator('#set-proxy').click();await page.locator('#capture-key').click();
  await page.locator('#joint-value').fill('1.5');await page.locator('#drive-form button').first().click();await page.locator('#key-time').fill('2');await page.locator('#capture-key').click();
  await page.locator('#scrub-motion').fill('1');assert.match(await page.locator('#motion-reading').innerText(),/bracket 1 m/);
  await page.evaluate(()=>{
    const real=window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame=callback=>{
      window.requestAnimationFrame=real;
      return real(timestamp=>callback(timestamp-500));
    };
  });
  await page.locator('#play-motion').click();await page.waitForFunction(()=>document.getElementById('motion-reading').textContent.startsWith('2.000 s'));assert.match(await page.locator('#motion-reading').innerText(),/bracket 1.5 m/);
  await page.locator('#check-sweep').click();assert.match(await page.locator('#sweep-reading').innerText(),/Clear|collision|unresolved/);await page.locator('#return').click();
  await page.locator('#case-link').click();await page.waitForLoadState('load');await page.locator('#case-predict').fill('6');await page.locator('#case-reason').fill('Constrain recovery and verify data retrieval.');await page.locator('#case-test').click();assert.match(await page.locator('#case-observed').innerText(),/recovered 6 min/);
  const phases=[['Engineering','allocate'],['Supplier','witness'],['Maintenance','trace'],['Corporate IT','restore'],['Quality','reconcile'],['Operations','handover']];
  for(const [role,act] of phases){await page.locator('#case-role').selectOption(role);await page.locator('#case-decision').selectOption(act);await page.locator('#advance-stage').click();}
  await page.locator('#case-retention').fill('120');await page.locator('#case-archive').check();await page.locator('#case-revoke').check();await page.locator('#case-owner').selectOption('Corporate IT');await page.locator('#case-retire').click();
  assert.match(await page.locator('#case-score').innerText(),/Retirement record accepted/);assert.doesNotMatch(await page.locator('#case-score').innerText(),/Capstone passed/);
  for(const [id,v] of [['vendor','record'],['quality','hold'],['maintenance','power'],['supply','same'],['finance','life'],['operations','retrieve']]){await page.locator('#case-incident').selectOption(id);await page.locator('#case-response').selectOption(v);await page.locator('#case-answer').click();}
  assert.match(await page.locator('#case-score').innerText(),/Capstone passed/);await page.locator('#return').click();
  await page.getByText('Role learning path',{exact:true}).click();await clickLink('Open foundations and prior-learning challenges');
  await page.locator('#challenge').click();const text=await page.locator('#question').innerText(),[distance,speed]=text.match(/[\d]+(?:\.\d+)?/g).map(Number);
  await page.locator('#first').fill(String(distance/speed));await page.locator('#second').fill(String(Math.ceil(10*distance/speed)));await page.locator('#predict button').click();assert.match(await page.locator('#result').innerText(),/Both predictions/);assert.match(await page.locator('#progress').innerText(),/^0 of/);
  await page.locator('#lang').selectOption('C++');await page.locator('#expr').fill('input && !previous');await page.locator('#execute').click();assert.match(await page.locator('#gitresult').innerText(),/passed/);await page.locator('#reason').fill('Count once per rising edge');await page.locator('#commit').click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await clickLink('Return to engineering workshop');
  const packed=page.waitForEvent('download');await button('Export project').click();const data=JSON.parse(await readFile(await(await packed).path(),'utf8'));
  assert.equal(data.extensions.cad.featureBook.length,3);assert.equal(data.extensions.layout.joints.length,1);assert.equal(data.extensions.layout.motion.length,2);assert.equal(data.extensions.layout.parts.find(p=>p.id==='bracket').proxy.length,3);assert.equal(data.extensions.foundations.revisions.length,1);assert.ok(data.extensions.commissioning.lifecycle.log.length>=14);
  assert.deepEqual(errors,[]);console.log('Metre-scale joints, CAD constraint/revolve/drawing revisions, lifecycle capstone, role predictions and source revisions passed through real mobile-width workshop navigation and portable export.');
}finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
