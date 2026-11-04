import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {chromium} from 'playwright';
const scenario='<meta charset="utf-8"><div id="cell" style="width:900px;height:540px"></div><script type="module">import {createViewport} from "/workshop/studio/viewport.mjs";import {createProject,configure,step,addCarton} from "/workshop/model.mjs";window.project=createProject("reference");window.asset="";window.viewport=createViewport(document.getElementById("cell"),{onSelect:id=>{asset=id;viewport.update(project,id)},onMove:(id,patch)=>{configure(project,id,patch);viewport.update(project,asset)}});viewport.update(project,asset);window.advance=()=>{addCarton(project);step(project,30);viewport.update(project,asset)};</script>';
const server=createServer(async(req,res)=>{try{const url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(url==='/'){res.setHeader('Content-Type','text/html');res.end(scenario);return;}
  const root=resolve(url.startsWith('/vendor/')?'dist':(process.env.OIA_WORKSHOP_SOURCE||'dist'));
  const file=resolve(root,'.'+url);if(!file.startsWith(root+sep))throw Error();
  const content=await readFile(file);res.setHeader('Content-Type',({'.mjs':'text/javascript','.js':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(content);
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({...(process.env.OIA_CHROMIUM?{executablePath:process.env.OIA_CHROMIUM}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{for(const fallback of [false,true]){
  const page=await browser.newPage();page.setDefaultTimeout(6000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(fallback)await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:original.call(this,type,...args);};});
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.viewport);
  const surface=page.locator('.studio-viewport-surface');
  assert.equal(await surface.getAttribute('data-renderer'),fallback?'svg':'webgl');
  await surface.locator('summary').click();
  await surface.getByRole('button',{name:'Measure',exact:true}).click();
  await surface.getByLabel('Measurement reference').selectOption('belt-start');await surface.getByRole('button',{name:'Use datum'}).click();
  await surface.getByLabel('Measurement reference').selectOption('belt-end');await surface.getByRole('button',{name:'Use datum'}).click();
  assert.match(await surface.locator('output').innerText(),/A \(0.000, 0.000, 0.800\) m.*B \(4.000, 0.000, 0.800\) m.*Distance 4.000 m/);
  await surface.getByRole('button',{name:'Measure',exact:true}).click();
  const source=await page.evaluate(()=>JSON.stringify(project)),renderable=surface.locator('canvas,svg').first();
  const digest=async()=>createHash('sha256').update(fallback?await renderable.evaluate(e=>Array.from(e.querySelectorAll('path'),p=>p.getAttribute('d')).join('')):await renderable.screenshot()).digest('hex');
  const assembled=await digest();await surface.getByRole('button',{name:'Explode'}).click();assert.notEqual(await digest(),assembled);
  await surface.getByRole('button',{name:'Explode'}).click();assert.equal(await digest(),assembled);assert.equal(await page.evaluate(()=>JSON.stringify(project)),source);
  await surface.locator('summary').click();
  if(fallback)assert.ok(await surface.locator('svg path').count()>12);
  await page.evaluate(()=>{viewport.view('top');viewport.view('fit');});
  let pos;
  for(let y=180;y<=360&&!pos;y+=30)for(let x=220;x<=650&&!pos;x+=50){
    await page.mouse.click(x,y);if(await surface.getAttribute('data-selected')==='belt')pos={x,y};
  }
  assert.ok(pos,'Ray selection must hit the model conveyor.');
  const before=await page.evaluate(()=>project.assets.find(a=>a.type==='conveyor').length);
  await page.mouse.move(pos.x,pos.y);await page.mouse.down();await page.mouse.move(pos.x+50,pos.y,{steps:3});await page.mouse.up();
  assert.ok(await page.evaluate(()=>project.assets.find(a=>a.type==='conveyor').length)>before,'Dragging changes actual belt length.');
  await surface.focus();await page.keyboard.press('ArrowDown');assert.equal(await surface.getAttribute('data-selected'),'bracket');await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(()=>project.assets.find(a=>a.type==='bracket').x),1.05);
  await surface.locator('summary').click();await surface.getByRole('button',{name:'Fit selection'}).click();await surface.locator('summary').click();
  await page.evaluate(()=>{viewport.view('iso');viewport.view('fit');advance();});assert.equal(await surface.getAttribute('data-scan'),'30');
  if(process.env.OIA_WORKSHOP_SCREENSHOTS){const directory=resolve(process.env.OIA_WORKSHOP_SCREENSHOTS);await mkdir(directory,{recursive:true});await surface.screenshot({path:resolve(directory,'studio-viewport-'+(fallback?'svg':'webgl')+'.png')});}
  const timing=await page.evaluate(()=>{const durations=[];for(let i=0;i<15;i++){const start=performance.now();viewport.update(project,asset);durations.push(performance.now()-start);}durations.sort((a,b)=>a-b);return {median:durations[7].toFixed(2),worst:durations.at(-1).toFixed(2)};});
  console.log('900 × 540, 10 assets, one moving carton, scene refresh CPU median '+timing.median+' ms, worst '+timing.worst+' ms.');await page.keyboard.press('Shift+ArrowRight');await page.keyboard.press('+');await page.mouse.wheel(0,120);
  await page.evaluate(()=>viewport.dispose());assert.equal(await surface.count(),0);assert.deepEqual(errors,[]);console.log((fallback?'Projected SVG':'WebGL 2')+' passed ray selection, direct drag, keyboard edit, model advance and disposal.');await page.close();
}
  const studio=await browser.newPage({viewport:{width:1380,height:920}});studio.setDefaultTimeout(12000);
  await studio.goto('http://127.0.0.1:'+server.address().port+'/workshop/studio/index.html');
  await studio.locator('#part-design').click();await studio.locator('#mount').click();await studio.locator('button[data-asset=bracket]').click();
  await studio.waitForFunction(()=>document.querySelector('.studio-viewport-caption')?.textContent.includes('authored solid'));
  if(process.env.OIA_WORKSHOP_SCREENSHOTS)await studio.screenshot({path:resolve(process.env.OIA_WORKSHOP_SCREENSHOTS,'studio-mounted-part.png')});
  console.log('Engineering Studio → Part Studio → Mount on bracket → authored mesh selected in the cell passed.');await studio.close();
}finally{await browser.close();await new Promise(r=>server.close(r));}
