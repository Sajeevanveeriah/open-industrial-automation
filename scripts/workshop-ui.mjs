import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import { chromium } from 'playwright';

const root = resolve(process.env.OIA_WORKSHOP_SOURCE || 'dist');
const mime = { '.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml' };
let server;
const base = process.env.OIA_BASE_URL || await new Promise(done => {
  server = createServer(async (req,res)=>{
    try {
      const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      const baseRoot=process.env.OIA_WORKSHOP_SOURCE&&path.startsWith('/vendor/')?resolve('dist'):root;
      const file=resolve(baseRoot,'.'+path+(path.endsWith('/')?'index.html':''));
      if(!file.startsWith(baseRoot+sep))throw Error();
      const content=await readFile(file);res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(content);
    } catch { res.writeHead(404);res.end(); }
  });
  server.listen(0,'127.0.0.1',()=>done('http://127.0.0.1:'+server.address().port));
});
let browser;
try {
  browser=await chromium.launch(process.env.OIA_CHROMIUM?{executablePath:process.env.OIA_CHROMIUM}: {});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.addInitScript({path:resolve('node_modules/axe-core/axe.min.js')});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const click=name=>page.getByRole('button',{name,exact:true}).click();
  const apply=async(id,field,value)=>{await page.locator('#asset').selectOption(id);await page.locator('#config [name="'+field+'"]').selectOption(value);await click('Apply settings');};
  const place=async(type,id)=>{await page.locator('#asset-type').selectOption(type);await page.locator('#new-id').fill(id);await click('Place asset');};
  const wire=async(from,out,to,input)=>{await page.locator('#from').selectOption(from);await page.locator('#out').selectOption(out);await page.locator('#to').selectOption(to);await page.locator('#in').selectOption(input);await click('Connect terminals');};
  const run=async(n)=>{for(let i=0;i<n;i++)await click('Step 1 s');};
  const notice=async(regex)=>{assert.match(await page.locator('#notice').innerText(),regex);};
  const url=base.replace(/\/$/,'')+'/workshop/index.html';
  let releaseModule;
  const delayed=new Promise(resolve=>{releaseModule=resolve;});
  const siteEntry=/\/site\/site\.mjs(?:\?|$)/;
  await page.route(siteEntry,async route=>{await delayed;await route.continue();});
  try {
    await page.goto(new URL('./site/index.html',url).href,{waitUntil:'commit'});
    await page.locator('#sample').waitFor({state:'attached'});
    const button=page.locator('#sample');
    await button.scrollIntoViewIfNeeded();
    assert.ok(await button.evaluate(el=>{
      const rect=el.getBoundingClientRect();
      return el.closest('main').inert && document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)!==el;
    }));
  } finally { releaseModule(); }
  await click('Load training layout');
  assert.equal(await page.locator('#tree option').count(),11);
  await page.unroute(siteEntry);
  await page.goto(url);
  await page.getByRole('heading',{name:'Packaging workshop'}).waitFor();
  assert.equal(await page.locator('#readings strong').first().textContent(),'0.0 s');
  await place('conveyor','transfer-belt');
  const pilotDownload=page.waitForEvent('download');await click('Export project');const pilot=await pilotDownload;
  assert.deepEqual(JSON.parse(await readFile(await pilot.path(),'utf8')).history[0],['addAsset','conveyor','transfer-belt']);await place('bracket','mount-A');await place('sensor','eye-A');await place('plc','controller-A');
  await page.getByText('Wire a connection',{exact:true}).click();
  await wire('transfer-belt','track','mount-A','base');await wire('mount-A','mount','eye-A','base');await wire('eye-A','out','controller-A','I0');
  await click('Record prediction');await click('Add carton');await click('Take checkpoint');
  await run(4);assert.match(await page.locator('#events').innerText(),/4.0 s.*crossed/);assert.equal(await page.locator('#readings strong').nth(2).textContent(),'1');
  await click('Assess current design');assert.match(await page.locator('#assessment').innerText(),/Passed · Transfer/);
  await click('Restore checkpoint');assert.equal(await page.locator('#readings strong').nth(2).textContent(),'0');
  await apply('controller-A','mode','level');await run(5);assert.equal(await page.locator('#readings strong').nth(2).textContent(),'5');
  await page.locator('#variant-name').fill('Five scans');await click('Save variant');
  await click('Load reference cell');await click('Replace cell');
  await click('New blank cell');await page.keyboard.press('Escape');assert.equal(await page.locator('#asset option').count(),10);
  await page.locator('#order-id').fill('ORDER-QA');await click('Release order');await apply('erp','dropAck','true');await apply('robot','vacuum','false');
  await click('Add carton');await run(8);assert.match(await page.locator('#diagnostics').innerText(),/Vacuum pickup failed/);
  await apply('robot','vacuum','true');await click('Reset robot');await click('Step 1 scan');assert.match(await page.locator('#records').textContent(),/PAL-1.+pending/);
  await apply('erp','dropAck','false');await click('Retry ERP delivery');assert.match(await page.locator('#records').textContent(),/Accepted postings: 1.+confirmed/);
  await page.locator('#asset').selectOption('switch');await page.locator('#config [name=vlan1]').fill('40');await click('Apply settings');assert.match(await page.locator('#diagnostics').textContent(),/No permitted route.*physical link up/);
  await click('Undo design edit');assert.match(await page.locator('#diagnostics').textContent(),/Video available/);
  await page.locator('#tester').fill('Test engineer');await page.locator('#observer').fill('Witness engineer');await page.locator('#authority').fill('Acceptance engineer');
  for(const phase of ['FAT','SAT','Integrated']){await page.locator('#phase').selectOption(phase);await click('Capture test evidence');await notice(/recorded/);}
  await click('Assess current design');assert.match(await page.locator('#assessment').innerText(),/Passed · Witness/);
  const pending=page.waitForEvent('download');await click('Export commissioning pack');const download=await pending;
  const report=JSON.parse(await readFile(await download.path(),'utf8'));assert.equal(report.tests.length,3);assert.equal(report.postings.length,1);
  const imported=Buffer.from(JSON.stringify(report.project));await page.locator('#file').setInputFiles({name:'portable.oia.json',mimeType:'application/json',buffer:imported});await click('Replace cell');
  assert.match(await page.locator('#records').textContent(),/ORDER-QA/);
  const malicious={...report.project,extensions:{cad:{name:{toString:1},widthM:.1}}};
  await page.locator('#file').setInputFiles({name:'bad.oia.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(malicious))});
  await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('Invalid project CAD'));
  assert.equal(await page.locator('#confirm').isVisible(),false);
  await click('Save locally');await page.reload();await page.waitForFunction(()=>document.getElementById('records')?.textContent.includes('PAL-1'));
  const afterBad=page.waitForEvent('download');await click('Export project');assert.deepEqual(JSON.parse(await readFile(await (await afterBad).path(),'utf8')),report.project);
  const started=performance.now();await click('Step 1 s');console.log('10-scan UI action including Playwright: '+(performance.now()-started).toFixed(1)+' ms.');
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(process.env.OIA_WORKSHOP_SCREENSHOTS){await mkdir(process.env.OIA_WORKSHOP_SCREENSHOTS,{recursive:true});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:resolve(process.env.OIA_WORKSHOP_SCREENSHOTS,'workshop-'+width+'.png')});}
  }
  const axe=await page.evaluate(async()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));
  assert.deepEqual(axe.violations.map(v=>[v.id,v.nodes.map(n=>n.target)]),[]);console.log('Automated WCAG A/AA checks: '+axe.passes.length+' rules passed.');
  await page.getByText('CAD and engine workspace',{exact:true}).click();
  await page.getByRole('link',{name:'Site assembly'}).click();
  await click('Load training layout');assert.equal(await page.locator('#tree option').count(),11);
  await page.locator('#tree').selectOption('bracket');await page.locator('#edit [name=x]').fill('-0.5');await click('Apply dimensions and pose');
  await page.locator('#view').selectOption('orbit');assert.ok(await page.locator('#scene polygon').count()>11);
  await click('Isolate selection');assert.equal(await page.locator('#scene polygon[data-id=bracket]').count(),5);
  await page.locator('#section').fill('0.6');await page.locator('#section').dispatchEvent('change');assert.equal(await page.locator('#scene polygon').count(),0);
  await page.locator('#section').fill('4');await page.locator('#section').dispatchEvent('change');await click('Isolate selection');
  await page.locator('#view').selectOption('walk');const pose=await page.locator('#pose').textContent();await click('Move forwards');assert.notEqual(await page.locator('#pose').textContent(),pose);
  const siteAxe=await page.evaluate(async()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));assert.deepEqual(siteAxe.violations.map(v=>v.id),[]);
  if(process.env.OIA_WORKSHOP_SCREENSHOTS){await page.setViewportSize({width:1440,height:900});await page.locator('#view').selectOption('orbit');await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:resolve(process.env.OIA_WORKSHOP_SCREENSHOTS,'site-orbit.png')});}
  await click('Use bracket position in cell');assert.match(await page.locator('#mount-result').textContent(),/1.500 m/);
  await page.getByRole('link',{name:'Return layout to workshop'}).click();await page.locator('#asset').selectOption('bracket');
  assert.equal(await page.locator('#config [name=x]').inputValue(),'1.5');
  const exported=page.waitForEvent('download');await click('Export project');const saved=await exported;
  assert.equal(JSON.parse(await readFile(await saved.path(),'utf8')).extensions.layout.parts.length,11);
  const benchMenu=page.getByText('CAD and engine workspace',{exact:true});
  const openTools=async()=>{if(!await page.getByRole('link',{name:'Site assembly'}).isVisible())await benchMenu.click();};
  await openTools();await page.getByRole('link',{name:'Electrical wiring bench'}).click();await page.locator('#reference').click();await page.locator('#read').click();await page.locator('#back').click();
  await page.locator('#rack-link').click();await page.locator('#probe button').click();await page.locator('a[href="../index.html"]').first().click();
  await openTools();await page.getByRole('link',{name:'Robot kinematics and pallet bench'}).click();await page.locator('#start').click();await page.locator('#step').click();await page.locator('a[href="../index.html"]').first().click();
  await openTools();await page.getByRole('link',{name:'Applied engineering bench'}).click();await page.locator('#run').click();await page.locator('#finding').fill('The first high scan increments once.');await page.locator('#capture').click();await page.locator('#apply').click();await page.locator('a[href="../index.html"]').first().click();
  await page.waitForFunction(()=>document.getElementById('diagnostics')?.textContent.includes('Active PLC program: ST'));
  await page.locator('#case-link').click();await page.locator('a[href="../index.html"]').first().click();
  await openTools();await page.getByRole('link',{name:'Server commissioning'}).click();await page.locator('#execute').waitFor();await page.locator('a[href="../index.html"]').first().click();
  await openTools();await page.getByRole('link',{name:'Open CAD import bench'}).click();await page.waitForLoadState('load');await page.waitForFunction(()=>typeof document.getElementById('generate')?.onclick==='function');await page.locator('#generate').click();await page.locator('#mount').click();
  await openTools();await page.getByRole('link',{name:'Open CAD import bench'}).click();await page.locator('#reopen').click();await page.locator('#mount').click();
  const combined=page.waitForEvent('download');await click('Export project');const portable=JSON.parse(await readFile(await (await combined).path(),'utf8'));
  for(const slot of ['layout','electrical','practice','robot','infrastructure','commissioning','servers','cad'])assert.ok(portable.extensions[slot],slot+' missing');
  assert.equal(portable.learning.demonstrated.video,undefined,'One successful network path must not earn fault diagnosis mastery.');
  assert.ok(portable.learning.demonstrated.pallet);assert.ok(portable.learning.demonstrated.erp);
  await page.locator('#profile-name').fill('Another learner');await click('Switch profile');assert.equal(await page.locator('#asset option').count(),0);
  assert.deepEqual(errors,[]);console.log('Workshop passed: independent blank build, travel, scan count, edit undo, checkpoint, robot recovery, acknowledgement loss, commissioning, interchange, profile isolation and responsive layout.');
} finally { await browser?.close();if(server)await new Promise(r=>server.close(r)); }
