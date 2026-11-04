const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const {_electron:electron}=require('../node_modules/playwright');

(async()=>{
  const [priorExe,nextExe]=process.argv.slice(2);
  if(!priorExe||!nextExe)throw Error('Supply the existing 0.3.0 executable and the new executable (or --dev).');
  const root=path.resolve('evidence-local');
  await fs.mkdir(root,{recursive:true});
  const profile=await fs.mkdtemp(path.join(root,'graded-upgrade-'));
  async function launch(exe){
    const development=exe==='--dev';
    const app=await electron.launch({executablePath:development?require('electron'):path.resolve(exe),
      args:[...(development?[__dirname]:[]),'--workshop-test-hidden','--user-data-dir='+profile]});
    const info=await app.evaluate(({app})=>({profile:app.getPath('userData'),version:app.getVersion()}));
    assert.equal(path.resolve(info.profile),profile);
    const page=await app.firstWindow();page.setDefaultTimeout(15000);
    await page.waitForFunction(()=>document.body?.dataset.ready==='true' && !document.body.inert);
    return {app,page,version:info.version};
  }
  let instance=await launch(priorExe);
  try{
    assert.equal(instance.version,'0.3.0');
    let page=instance.page;
    if((await page.locator('#toggle-play').innerText()).includes('Pause'))await page.locator('#toggle-play').click();
    await page.locator('#asset-select').selectOption('AMR-01');
    await page.locator('#fault-toggle').click();
    await page.waitForFunction(()=>document.getElementById('fault-toggle').textContent==='Recover truck');
    await instance.app.evaluate(({session})=>session.defaultSession.flushStorageData());
    await instance.app.close();
    instance=await launch(nextExe);
    assert.equal(instance.version,'0.3.1');
    page=instance.page;
    assert.equal(await page.locator('#shift-primary').innerText(),'Find matching pallet');
    await page.locator('#shift-primary').click();
    await page.locator('[data-pallet="PL-00157"]').click();
    await page.locator('#shift-primary').click();
    assert.match(await page.locator('#shift-progress').innerText(),/1\s*\/\s*5/);
    await page.locator('#shift-free').click();
    await page.locator('#asset-select').selectOption('AMR-01');
    await page.waitForFunction(()=>document.getElementById('fault-toggle').textContent==='Recover truck');
    console.log('An existing 0.3.0 profile received the first actionable 0.3.1 objective. After performing the job, returning to free shift recovered its original AMR-01 fault.');
  }finally{await instance.app.close().catch(()=>{});}
})().catch(error=>{console.error(error);process.exitCode=1;});
