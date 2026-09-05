import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? pathToFileURL(resolve(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright/index.mjs')).href : 'playwright');
let server;
const root=resolve('dist');
const base=process.env.OIA_BASE_URL?.replace(/\/$/,'')||'http://127.0.0.1:4185';
if(!process.env.OIA_BASE_URL){server=createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,base).pathname);const file=resolve(root,'.'+path+(path.endsWith('/')?'index.html':''));if(!file.startsWith(root+sep))throw Error();const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css'};res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end('Not found');}});await new Promise(r=>server.listen(4185,'127.0.0.1',r));}
let browser;
try{
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(base+'/');await page.getByRole('heading',{name:'Process overview',exact:true}).waitFor();
 assert.equal(await page.locator('.equipment-art').count(),15);
 assert.equal(await page.locator('.rail-bottom a').getAttribute('href'),new URL(base+'/suite/').pathname);
 const routes=['Process overview','Control & I/O','Production & intake','Quality & genealogy','Utilities & environment','Maintenance & sanitation','Alarms & historian','Integration lab','Scenario studio','Engineering reference'];
 for(const name of routes){await page.getByRole('link',{name,exact:true}).click();await page.getByRole('heading',{name,exact:true}).waitFor();assert.equal(await page.locator('body').evaluate(e=>e.scrollWidth>innerWidth),false,name+' overflow');}
 async function preset(name){await page.getByRole('link',{name:'Scenario studio',exact:true}).click();await page.getByRole('button',{name:new RegExp('^'+name+' ')}).click();await page.getByRole('button',{name:'Replace run',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});}
 await preset('Steady production');await page.getByRole('link',{name:'Process overview',exact:true}).click();assert.equal(await page.getByRole('button',{name:/^Inspect /}).count(),15);
 await page.getByRole('button',{name:'Hold',exact:true}).click();assert.match(await page.locator('.transport').innerText(),/HELD/);await page.getByRole('button',{name:'Resume',exact:true}).click();assert.match(await page.locator('.transport').innerText(),/RUNNING/);
 await page.getByRole('button',{name:'E-stop',exact:true}).click();assert.match(await page.locator('.transport').innerText(),/TRIPPED/);await page.getByRole('button',{name:'Reset trip',exact:true}).click();assert.match(await page.locator('#notice').innerText(),/Remove every trip cause/);
 await page.getByRole('link',{name:'Scenario studio',exact:true}).click();await page.locator('.fault-row').filter({hasText:'Emergency stop'}).getByRole('button',{name:'Remove cause'}).click();await page.getByRole('button',{name:'Reset trip',exact:true}).click();assert.match(await page.locator('.transport').innerText(),/HELD/);
 await preset('Complete campaign');await page.getByRole('link',{name:'Quality & genealogy',exact:true}).click();await page.getByRole('button',{name:'Sample lot',exact:true}).click();await page.getByRole('button',{name:'Run detector challenge',exact:true}).click();await page.getByRole('button',{name:'Release lot',exact:true}).click();await page.getByLabel('Dispatch mass (kg)').fill('100');await page.getByRole('button',{name:'Record dispatch',exact:true}).click();assert.match(await page.locator('main').innerText(),/SIM-SHIP-1/);
 await page.getByRole('link',{name:'Control & I/O',exact:true}).click();await page.getByLabel('Filter tags').fill('FRY-901.TT');assert.equal(await page.locator('#tag-table tbody tr').count(),3);
 await page.getByRole('link',{name:'Scenario studio',exact:true}).click();await page.getByLabel('Simulated second to inspect').fill('900');await page.getByRole('button',{name:'Inspect earlier state',exact:true}).click();assert.match(await page.locator('.replay-bar').innerText(),/READ-ONLY/);assert.equal(await page.getByRole('button',{name:'Start',exact:true}).isEnabled(),false);await page.locator('.replay-bar').getByRole('button',{name:'Return to present'}).click();
 await page.getByRole('link',{name:'Engineering reference',exact:true}).click();await page.getByRole('button',{name:'Save in this browser'}).click();const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export replayable run'}).click();const download=await downloadPromise;assert.match(download.suggestedFilename(),/Run.json$/);
 await page.getByRole('combobox',{name:'Role simulation'}).selectOption('reviewer');await page.getByRole('button',{name:'Start',exact:true}).click();assert.match(await page.locator('#notice').innerText(),/reviewer.*cannot/);await page.getByRole('combobox',{name:'Role simulation'}).selectOption('instructor');
 await page.getByRole('button',{name:'Dark',exact:true}).click();assert.equal(await page.locator('body').getAttribute('data-theme'),'dark');await page.getByRole('button',{name:'Light',exact:true}).click();
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});for(const name of routes){await page.getByRole('link',{name,exact:true}).click();assert.equal(await page.locator('body').evaluate(e=>e.scrollWidth>innerWidth),false,name+' overflow at '+width);}}
 await page.keyboard.press('Tab');assert.notEqual(await page.evaluate(()=>document.activeElement.tagName),'BODY');
 assert.deepEqual(errors,[]);console.log('PASS: ten routes, three viewports, 15 equipment selectors, hold/resume, trip guards/recovery, quality release/dispatch, tag filtering, time lens, save/export, role restrictions, themes and keyboard focus.');
}finally{await browser?.close();if(server)await new Promise(r=>server.close(r));}
