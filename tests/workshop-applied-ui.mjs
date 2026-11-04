import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
const root=resolve(process.env.WORKSHOP_UI_ROOT||'dist');
const srv=createServer(async(req,res)=>{try{
 const part=decodeURIComponent(new URL(req.url,'http://localhost').pathname),path=resolve(root,'.'+part);
 if(!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
 const data=await readFile(path);res.setHeader('content-type',({'.mjs':'text/javascript','.js':'text/javascript','.html':'text/html','.css':'text/css','.wasm':'application/wasm'})[extname(path)]||'application/octet-stream');res.end(data);
}catch{res.writeHead(404);res.end();}});
await new Promise(ok=>srv.listen(0,'127.0.0.1',ok));
let browser;
try{
 browser=await chromium.launch(process.env.OIA_CHROMIUM?{executablePath:process.env.OIA_CHROMIUM}:{});
 const p=await browser.newPage({viewport:{width:390,height:844}});
 const url=(process.env.OIA_BASE_URL||('http://127.0.0.1:'+srv.address().port)).replace(/\/$/,'')+'/workshop/';
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 async function a11y(name){
  await p.addScriptTag({path:'node_modules/axe-core/axe.min.js'});
  const check=await p.evaluate(async()=>({overflow:document.documentElement.scrollWidth>innerWidth,errors:(await axe.run(document,{runOnly:['wcag2a','wcag2aa','wcag21aa']})).violations.map(v=>v.id)}));
  assert.deepEqual(check,{overflow:false,errors:[]},name+' mobile accessibility: '+JSON.stringify(check));console.log(name,'390 x 844, axe passed');
 }
 await p.goto(url+'electrical/index.html');await p.getByRole('button',{name:'Load worked drawing'}).click();
 await p.getByRole('button',{name:'Run three-point calibration'}).click();assert.match(await p.locator('#instrument-labs').innerText(),/20 mA target: 20.000 mA PASS/);
 await p.getByRole('button',{name:'Read AC meter and tachometer'}).click();assert.match(await p.locator('#instrument-labs').innerText(),/1455.0 rpm/);await a11y('Electrical');
 await p.goto(url+'practice/index.html');await p.getByRole('link',{name:'HMI and historian studio'}).click();
 for(const [name,t]of [['Line','count'],['Wiring','I0']]){
  await p.fill('#name',name);await p.click('#add');await p.fill('#id',t.toUpperCase());await p.selectOption('#tag',t);await p.click('#bind');await p.selectOption('#channel',t);await p.click('#configure');
 }
 await p.click('#test');assert.match(await p.locator('#status').innerText(),/Pass\./);
 await p.check('#i0');await p.click('#ten');await p.click('#link');assert.match(await p.locator('#screen').innerText(),/STALE/);
 await p.reload();await p.selectOption('#page','Wiring');assert.match(await p.locator('#screen').innerText(),/STALE/);await a11y('HMI historian');
 await p.getByRole('link',{name:'Applied engineering',exact:true}).click();await p.selectOption('#bench','optical');await p.getByRole('button',{name:'Train and register candidate'}).click();
 await p.getByRole('button',{name:'Evaluate deployed model'}).click();await p.getByRole('button',{name:'Deploy selected candidate'}).click();await p.getByRole('button',{name:'Evaluate deployed model'}).click();assert.match(await p.locator('#result').innerText(),/active M1/);
 await p.getByRole('button',{name:'Roll back deployment'}).click();await p.getByRole('button',{name:'Evaluate deployed model'}).click();assert.match(await p.locator('#result').innerText(),/active baseline/);await p.getByRole('button',{name:'Assess deployment and rollback'}).click();assert.match(await p.locator('#result').innerText(),/Pass\./);await a11y('Model deployment');
 await p.goto(url+'production/index.html');await p.click('#revision');await p.click('#trial');assert.match(await p.locator('#recipe-report').innerText(),/41 bags/);
 await p.click('#author');await p.click('#simulate-recipe');assert.match(await p.locator('#process-result').innerText(),/first pack 1589 s/);
 await p.fill('#dwell','120');await p.fill('#cut','15');await p.click('#author');await p.click('#simulate-recipe');assert.match(await p.locator('#process-result').innerText(),/held lots 1/);assert.match(await p.locator('#process-result').innerText(),/SIM-VIC-001/);
 await a11y('Production capstone');assert.deepEqual(errors,[]);console.log('All four normal-entry practicals passed.');
}finally{if(browser)await browser.close();await new Promise(ok=>srv.close(ok));}
