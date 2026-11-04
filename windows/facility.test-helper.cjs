const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');

async function verifyFacility(app,page,directory) {
  const ready=()=>document.body?.dataset.ready==='true' && !document.body.inert && document.querySelector('#facility-viewport canvas, #facility-viewport svg') && document.querySelector('#asset-select option');
  await page.waitForFunction(ready,null,{timeout:20000});
  assert.ok(page.url().endsWith('/workshop/studio/facility/index.html'));
  await app.context().setOffline(true);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(ready);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
  await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  const data=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64'));
  await fs.writeFile(path.join(directory,'facility-native.png'),Buffer.from(data,'base64'));
  const size=await page.locator('#facility-viewport').boundingBox();
  assert.ok(size.width>200 && size.height>160);
  const count=await page.locator('#asset-select option').count();
  assert.ok(count>10,'Expected plant-wide selectable assets');
  console.log('Facility ready offline:',Math.round(size.width)+' × '+Math.round(size.height)+' CSS px, '+count+' inventory options.');
  const metrics=await page.evaluate(async()=>{
    const canvas=document.querySelector('#facility-viewport canvas'),gl=canvas?.getContext('webgl2');
    const ext=gl?.getExtension('WEBGL_debug_renderer_info');
    const samples=[];
    let last;
    await new Promise(done=>{
      const frame=now=>{
        if(last!==undefined)samples.push(now-last);last=now;
        if(samples.length<90)requestAnimationFrame(frame);else done();
      };
      requestAnimationFrame(frame);
    });
    const sorted=[...samples].sort((a,b)=>a-b);
    return {observations:samples.length,meanFrameMs:samples.reduce((a,b)=>a+b,0)/samples.length,p95FrameMs:sorted[Math.ceil(sorted.length*.95)-1],
      renderer:gl&&ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unreported',devicePixelRatio,screen:[innerWidth,innerHeight],visibility:document.visibilityState};
  });
  await fs.writeFile(path.join(directory,'facility-metrics.json'),JSON.stringify({...metrics,inventoryOptions:count,offlineEmulated:true,backgroundThrottling:false},null,2));
  console.log('Native facility RAF measurement:',JSON.stringify(metrics));

  const file=path.join(directory,'facility-native-'+Date.now()+'.json');
  await app.evaluate(({dialog},target)=>{
    globalThis.savedFacilityDialogs={open:dialog.showOpenDialog,save:dialog.showSaveDialog};
    let saves=0;
    dialog.showSaveDialog=async()=>({canceled:false,filePath:saves++===0?target:target+'.reopened.json'});
    dialog.showOpenDialog=async()=>({canceled:false,filePaths:[target]});
  },file);
  try {
    if(!await page.locator('#scenario-export').isVisible())await page.locator('#menu').click();
    await page.locator('#scenario-export').click();
    let raw;
    for(let i=0;i<100&&!raw;i++){try{raw=JSON.parse(await fs.readFile(file,'utf8'));}catch{await new Promise(resolve=>setTimeout(resolve,100));}}
    assert.equal(raw?.format,'oia-facility');assert.equal(raw.version,1);
    const seed=(raw.seed+1)%65536;
    await fs.writeFile(file,JSON.stringify({...raw,seed,history:[]}));
    if(!await page.locator('#scenario-import').isVisible())await page.locator('#menu').click();
    page.once('dialog',async question=>{assert.match(question.message(),/Open this scenario in place/);await question.accept();});
    await page.locator('#scenario-import').click();
    await page.waitForFunction(expected=>Object.values(localStorage).some(value=>{
      try{const r=JSON.parse(value);return r.format==='oia-facility' && r.seed===expected;}catch{return false;}
    }),seed);
    if(!await page.locator('#scenario-export').isVisible())await page.locator('#menu').click();
    await page.locator('#scenario-export').click();
    let opened;
    for(let i=0;i<100&&!opened;i++){try{opened=JSON.parse(await fs.readFile(file+'.reopened.json','utf8'));}catch{await new Promise(resolve=>setTimeout(resolve,100));}}
    assert.equal(opened?.seed,seed);
    console.log('Native facility scenario export, different-seed import and re-export passed.');
  }finally{
    await app.evaluate(({dialog})=>{
      dialog.showOpenDialog=globalThis.savedFacilityDialogs.open;dialog.showSaveDialog=globalThis.savedFacilityDialogs.save;delete globalThis.savedFacilityDialogs;
    });
  }
  if(await page.locator('#close').isVisible())await page.locator('#close').click();
  await page.locator('#cell-studio').click();
  await page.waitForFunction(()=>document.body?.dataset.ready==='true' && !document.body.inert && document.querySelector('#asset-tree'));
}
module.exports={verifyFacility};
