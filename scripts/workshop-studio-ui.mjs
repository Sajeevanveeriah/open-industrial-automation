import {checkStudioPracticals} from './workshop-studio-practicals-ui.mjs';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {chromium} from 'playwright';
import {createProject,configure,saveProject,loadProject} from '../simulator/workshop/model.mjs';

const source=process.env.OIA_WORKSHOP_SOURCE,root=resolve(source||'dist');
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.svg':'image/svg+xml','.json':'application/json'};
let server,browser;
const base=(process.env.OIA_BASE_URL||await new Promise(done=>{
  server=createServer(async(req,res)=>{try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const dir=source&&(pathname.startsWith('/vendor/')||pathname.includes('/practice/vendor/'))?resolve('dist'):root;
    const path=resolve(dir,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
    if(!path.startsWith(dir+sep))throw Error();
    const content=await readFile(path);res.setHeader('content-type',mime[extname(path)]||'application/octet-stream');res.end(content);
  }catch{res.writeHead(404);res.end();}});
  server.listen(0,'127.0.0.1',()=>done('http://127.0.0.1:'+server.address().port));
})).replace(/\/$/,'');
const entry=base+'/workshop/index.html',studio=base+'/workshop/studio/index.html',slot='oia-workshop-v1:Learner:active';
const ready=p=>p.waitForFunction(()=>document.body.dataset.ready==='true'&&!document.body.inert);
const raw=p=>p.evaluate(key=>localStorage.getItem(key),slot);
async function diagnose(p,width){
  await p.addScriptTag({path:'node_modules/axe-core/axe.min.js'});
  const r=await p.evaluate(async()=>({overflow:document.documentElement.scrollWidth>innerWidth,violations:(await axe.run(document,{runOnly:['wcag2a','wcag2aa','wcag21aa']})).violations.map(v=>[v.id,v.nodes.map(n=>n.target)])}));
  assert.deepEqual(r,{overflow:false,violations:[]},width+'px accessibility: '+JSON.stringify(r));
}
async function panel(p,label,width){if(width<761)await p.locator('.mobile-tabs').getByRole('button',{name:label,exact:true}).click();}
async function inspect(p,id,width){await panel(p,'Assets',width);await p.locator('[data-asset="'+id+'"]').click();await panel(p,'Inspector',width);}
async function ss(p,width){if(!process.env.OIA_WORKSHOP_SCREENSHOTS)return;await mkdir(process.env.OIA_WORKSHOP_SCREENSHOTS,{recursive:true});await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:resolve(process.env.OIA_WORKSHOP_SCREENSHOTS,'studio-'+width+'.png')});}
try{
 browser=await chromium.launch({...process.env.OIA_CHROMIUM?{executablePath:process.env.OIA_CHROMIUM}:{},args:['--enable-unsafe-swiftshader']});
 for(const width of [1440,390]){
  const c=await browser.newContext({viewport:{width,height:width===1440?900:844}}),p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);
  await p.goto(entry);await p.waitForURL(url=>url.pathname.endsWith('/studio/index.html')||url.pathname.endsWith('/facility/index.html'));
  if(p.url()!==studio){
    await p.waitForFunction(()=>['true','error'].includes(document.body?.dataset.ready),null,{timeout:45000});
    assert.equal(await p.locator('body').getAttribute('data-ready'),'true','Facility startup: '+await p.locator('#recovery-cause').textContent()+' / '+errors.join(' / '));
    await p.locator('#cell-studio').click();
  }
  await p.waitForURL(studio);await ready(p);
  assert.equal(await p.locator('#asset-tree .asset-row').count(),10);assert.ok(await p.locator('#viewport canvas,#viewport svg').count()>0);assert.equal(await p.locator('.viewport-error').count(),0);
  await diagnose(p,width);await ss(p,width);await checkStudioPracticals(p,width);
  const runbox=await p.locator('#quick-run').boundingBox();assert.ok(runbox.y+runbox.height<844);assert.equal(await p.locator('#analysis').isVisible(),true);
  await p.click('#quick-run');await p.waitForFunction(()=>document.querySelector('#clock').textContent!=='00:00.0');await p.click('#quick-run');const paused=await p.locator('#clock').innerText();await p.waitForTimeout(180);assert.equal(await p.locator('#clock').innerText(),paused);
  await inspect(p,'belt',width);await p.fill('#prop-speed','0.5');await p.fill('#prop-length','5');await p.click('#apply-properties');
  const edited=loadProject(await raw(p));assert.equal(edited.assets.find(a=>a.id==='belt').speed,0.5);assert.equal(edited.assets.find(a=>a.id==='belt').length,5);
  await p.click('#checkpoint');await p.fill('#prop-length','6');await p.click('#apply-properties');await p.click('#restore');assert.equal(loadProject(await raw(p)).assets.find(a=>a.id==='belt').length,5);
  await p.click('#start-lesson');await p.click('#lesson-run-first');await p.locator('#lesson-move').waitFor();await p.click('#lesson-move');await p.fill('#lesson-prediction','6');await p.click('#lesson-run-second');await p.getByText('Prediction verified',{exact:true}).waitFor();
  assert.match(await p.locator('#lesson-text').innerText(),/Baseline 4\.0 s · moved sensor 6\.0 s · change 2\.0 s/);
  await p.getByRole('button',{name:'Return to my project'}).click();assert.equal(loadProject(await raw(p)).assets.find(a=>a.id==='belt').speed,0.5);
  const downloadPromise=p.waitForEvent('download');await p.click('#save-project');const download=await downloadPromise;const exported=await readFile(await download.path(),'utf8');assert.equal(loadProject(exported).learning.studioTimingEvidence.pass,true);
  await p.click('#new-project');await p.click('#start-blank');await p.reload();await ready(p);assert.equal(await p.locator('#empty-hint').isVisible(),true);assert.equal(loadProject(await raw(p)).assets.length,0);
  await p.click('#empty-demo');await p.waitForFunction(()=>document.querySelector('#clock').textContent!=='00:00.0');await p.click('#quick-run');await p.click('#restore');assert.equal(loadProject(await raw(p)).assets.length,0);
  await p.click('#empty-place');await p.click('#confirm-place');assert.equal(loadProject(await raw(p)).assets[0].type,'conveyor');
  await p.click('#place');await p.getByLabel('Asset type',{exact:true}).selectOption('bracket');await p.click('#confirm-place');await p.click('#wire');await p.getByLabel('Source asset',{exact:true}).selectOption('belt');await p.getByLabel('Destination asset',{exact:true}).selectOption('bracket');await p.click('#confirm-wire');assert.deepEqual(loadProject(await raw(p)).links,[{from:'belt',port:'track',to:'bracket',input:'base'}]);
  await p.locator('#import-file').setInputFiles({name:'round-trip.oia.json',mimeType:'application/json',buffer:Buffer.from(exported)});await p.waitForFunction(()=>document.querySelectorAll('#asset-tree .asset-row').length===10);
  await p.click('#benches');const links=await p.locator('.tool-link').evaluateAll(items=>items.map(a=>({href:a.href,text:a.querySelector('strong').textContent})));
  assert.ok(links.length>=13);for(const dest of links)assert.equal((await p.request.get(dest.href)).status(),200,dest.text);
  const site=p.getByRole('link',{name:/Site assembly/});await site.click();await p.fill('#part-id','STUDIO-SITE-01');await p.locator('#add button').click();await p.click('#return');await p.waitForURL(studio);await ready(p);
  assert.match(JSON.stringify(loadProject(await raw(p)).extensions.layout),/STUDIO-SITE-01/);
  await p.click('#analysis');await p.locator('header a[href="../index.html"]').click();await ready(p);
  await p.click('#part-design');const partReturn=p.locator('a[href="../index.html"]').first();await partReturn.click();await ready(p);
  const before=await raw(p),changed=loadProject(before);configure(changed,'belt',{length:8});
  const other=await c.newPage();await other.goto(studio);await ready(other);await other.evaluate(([k,v])=>localStorage.setItem(k,v),[slot,saveProject(changed)]);await other.close();
  await inspect(p,'belt',width);await p.fill('#prop-length','7');await p.click('#apply-properties');assert.equal(loadProject(await raw(p)).assets.find(a=>a.id==='belt').length,8);assert.match(await p.locator('#notice').innerText(),/another window/);
  await p.reload();await ready(p);assert.equal(loadProject(await raw(p)).assets.find(a=>a.id==='belt').length,8);
  await p.click('#profile-btn');await p.getByLabel('Profile name',{exact:true}).fill('Studio-QA');await p.getByRole('button',{name:'Open profile',exact:true}).click();assert.equal(await p.locator('#profile-label').textContent(),'Studio-QA');
  assert.equal(loadProject(await raw(p)).assets.find(a=>a.id==='belt').length,8);assert.deepEqual(errors,[]);
  console.log(width+'px: default 3D, run/pause, dimensional edits, lesson 4.0/6.0 s, blank recovery, free assembly, project round trip, '+links.length+' route checks, real site handoff, analysis and part returns, conflict protection and isolated profile passed.');await c.close();
 }
}finally{if(browser)await browser.close();if(server)await new Promise(done=>server.close(done));}
