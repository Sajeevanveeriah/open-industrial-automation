const path=require('node:path');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const {_electron:electron}=require('../node_modules/playwright');
const {runCellPractical,runPartPractical,runDrivePractical}=require('./cell-jobs.test-helper.cjs');
(async()=>{
  const root=path.resolve('evidence-local');
  await fs.mkdir(root,{recursive:true});
  const dir=await fs.mkdtemp(path.join(root,'graded-jobs-'));
  const development=process.argv.includes('--dev');
  const binary=development?require('electron'):path.resolve(process.argv[2]);
  const args=development?[path.resolve(process.env.OIA_TEST_HOST || __dirname)]:[];
  args.push('--workshop-test-hidden','--user-data-dir='+path.join(dir,'profile'));
  const app=await electron.launch({executablePath:binary,args,timeout:45000});
  async function screenshot(page,name){
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    const png=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64'));
    await fs.writeFile(path.join(dir,name+'.png'),Buffer.from(png,'base64'));
  }
  try{
    const page=await app.firstWindow();page.setDefaultTimeout(15000);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.waitForFunction(()=>document.body?.dataset.ready==='true' && !document.body.inert);
    assert.ok(page.url().endsWith('/workshop/studio/facility/index.html'));
    await app.context().setOffline(true);await page.reload();
    await page.waitForFunction(()=>document.body?.dataset.ready==='true' && !document.body.inert);
    console.log('Offline normal entry:',page.url(),'executable version',await app.evaluate(({app})=>app.getVersion()),'evidence',dir);
    if(!process.argv.includes('--cell-only')){
      await screenshot(page,'First-Run');
      await require('./floor-jobs.test-helper.cjs').runFloorPractical(page);
      await screenshot(page,'Floor-Assessment');
    }
    await runCellPractical(page);
    await runDrivePractical(page);
    await runPartPractical(page);
    await screenshot(page,'Mounted-Bracket');
    assert.deepEqual(errors,[]);
  }finally{await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
