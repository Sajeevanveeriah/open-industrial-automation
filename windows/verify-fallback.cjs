const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const {_electron:electron}=require('../node_modules/playwright');

(async()=>{
  const qa=path.resolve('evidence-local');
  await fs.mkdir(qa,{recursive:true});
  const folder=await fs.mkdtemp(path.join(qa,'surface-recovery-'));
  const staged=path.join(folder,'windows'),site=path.join(folder,'dist');
  await fs.mkdir(staged);
  for(const name of ['main.cjs','preload.cjs','package.json','engine.cjs','native.cjs','occt.cjs'])await fs.copyFile(path.join(__dirname,name),path.join(staged,name));
  await fs.cp(path.resolve(process.env.OIA_TEST_SITE || '../dist'),site,{recursive:true});
  const facility=path.join(site,'workshop/studio/facility/index.html'),studio=path.join(site,'workshop/studio/index.html'),classic=path.join(site,'workshop/classic.html');
  await fs.access(classic);await fs.access(studio);
  await fs.mkdir(path.dirname(facility),{recursive:true});
  const blank='<!doctype html><title>Unavailable surface</title><body inert></body>';
  await fs.writeFile(facility,blank);
  for(const [label,expected] of [['facility','Packaging cell'],['facility and studio','Packaging workshop'],['all','Workshop files could not be opened']]){
    if(label==='facility and studio')await fs.writeFile(studio,blank);
    if(label==='all')await fs.writeFile(classic,blank);
    const app=await electron.launch({executablePath:require('electron'),args:[staged,'--workshop-test-hidden','--user-data-dir='+path.join(folder,'profile-'+label)],timeout:40000});
    try{
      const page=await app.firstWindow();
      await page.waitForFunction(title=>document.querySelector('h1')?.textContent===title,expected,{timeout:30000});
      if(label==='facility'){
        assert.ok(page.url().endsWith('/workshop/studio/index.html'));
        await page.waitForFunction(()=>document.body.dataset.ready==='true' && !document.body.inert);
      }else if(label==='facility and studio'){
        assert.ok(page.url().endsWith('/workshop/classic.html'));
        await page.waitForFunction(()=>!document.body.inert && document.querySelector('#mode option'));
        assert.equal(await page.evaluate(()=>typeof window.workshopHost.openProject),'function');
      }else assert.equal(await page.evaluate(()=>typeof window.workshopHost),'undefined');
      console.log(label+' blank: '+expected);
    }finally{await app.close();}
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
