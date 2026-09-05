import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
// Serve an actual cache-first legacy session, then replace its server release.
// No reload/clear-data operation is permitted after the worker update.
let deployed=false,cacheLegacy=true;
const origin='http://127.0.0.1:4186';
const prefix='/open-industrial-automation/';
const server=createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,origin).pathname;
  res.setHeader('Cache-Control','no-store');
  if(!path.startsWith(prefix)){res.end('Neighbouring project');return;}
  res.setHeader('Content-Type',path.endsWith('.js')||path.endsWith('.mjs')?'text/javascript':path.endsWith('.css')?'text/css':'text/html');
  if(!deployed){
   if(path.endsWith('sw.js')){res.end(`const entry=new URL('./',self.location).href;self.addEventListener('install',e=>e.waitUntil(${cacheLegacy?"caches.open('oia-suite-v2.2').then(c=>c.add(entry))":"Promise.resolve()"}.then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request))));`);return;}
   res.end('<!doctype html><title>Old water application</title><h1>TK-101 MIX TANK</h1>');return;
  }
  const relative=path.slice(prefix.length)+(path.endsWith('/')?'index.html':'');
  const file=resolve('dist',relative);if(!file.startsWith(resolve('dist')+'/'))throw Error();res.end(await readFile(file));
 }catch{res.writeHead(404);res.end('Missing');}
});
await new Promise(r=>server.listen(4186,'127.0.0.1',r));
let browser;
try{
 browser=await chromium.launch();
 for(const [scope,cached] of [['',true], ['suite/',true], ['',false]]){
  cacheLegacy=cached;
  deployed=false;const context=await browser.newContext();const page=await context.newPage();
  await page.goto(origin+prefix+scope);
  await page.evaluate(async()=>{await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;});
  await page.reload();assert.equal(await page.locator('h1').innerText(),'TK-101 MIX TANK');
  await page.evaluate(async()=>{const cache=await caches.open('oia-suite-v2.2');await cache.put('/neighbour/keep',new Response('preserve'));localStorage.setItem('potato-sim-sentinel','preserve');});
  deployed=true;
  await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
  await page.getByRole('heading',{name:'Process overview',exact:true}).waitFor({timeout:30000});
  assert.equal(await page.locator('.equipment-art').count(),15);
  assert.equal(new URL(page.url()).pathname,prefix);
  assert.equal(await page.getByText('TK-101 MIX TANK',{exact:true}).count(),0);
  const retained=await page.evaluate(async()=>({neighbour:await(await caches.match('/neighbour/keep')).text(),own:(await(await caches.open('oia-suite-v2.2')).keys()).filter(r=>new URL(r.url).pathname.startsWith('/open-industrial-automation/')).length,saved:localStorage.getItem('potato-sim-sentinel')}));
  assert.deepEqual(retained,{neighbour:'preserve',own:0,saved:'preserve'});
  await context.close();
 }
 console.log('PASS: root, nested cached and cacheless older applications automatically become potato without manual reload; neighbouring cache and saved data preserved.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
