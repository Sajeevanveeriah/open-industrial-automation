const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const {_electron:electron}=require('../node_modules/playwright');
(async()=>{
  const root=path.resolve('evidence-local');
  await fs.mkdir(root,{recursive:true});
  const profile=await fs.mkdtemp(path.join(root,'crash-'));
  const binary=require('electron');
  const launch=()=>electron.launch({executablePath:binary,args:[__dirname,'--workshop-test-hidden','--user-data-dir='+profile],timeout:45000});
  const recoveryText='Retain the checkpoint after the renderer or process stops.';
  let app=await launch();
  try{
    const page=await app.firstWindow();page.setDefaultTimeout(15000);
    await page.waitForFunction(()=>!document.body.inert && document.getElementById('mode')?.options.length>0);
    await page.locator('#notebook').fill(recoveryText);await page.locator('#save').click();
    await app.evaluate(async({session,dialog,BrowserWindow})=>{
      await session.defaultSession.flushStorageData();
      dialog.showMessageBox=async (_win,options)=>{
        if(options.message.includes('workshop view stopped')){globalThis.__recoveryObserved=true;return {response:0};}
        throw Error('Unexpected native dialogue');
      };
      setTimeout(()=>BrowserWindow.getAllWindows()[0].webContents.forcefullyCrashRenderer(),200);
    });
    await new Promise((resolve,reject)=>{
      const end=Date.now()+20000;
      const sample=async()=>{
        try{
          const ok=await app.evaluate(async({BrowserWindow})=>globalThis.__recoveryObserved===true && await BrowserWindow.getAllWindows()[0].webContents.executeJavaScript("document.querySelector('#notebook')?.value || ''"));
          if(ok===recoveryText)return resolve();
        }catch{}
        if(Date.now()>end) reject(Error('No recovered checkpoint after renderer crash.'));
        else setTimeout(sample,250);
      };sample();
    });
    console.log('A forced renderer crash triggered the actual recovery handler and reopened the saved notebook.');
    const pid=await app.evaluate(({app})=>({pid:process.pid,profile:app.getPath('userData'),binary:process.execPath}));
    assert.equal(path.resolve(pid.profile),profile);
    assert.equal(path.resolve(pid.binary).toLowerCase(),path.resolve(binary).toLowerCase());
    const stopped=app.waitForEvent('close',{timeout:15000});
    process.kill(pid.pid,'SIGKILL');await stopped;
    app=await launch();
    const reopened=await app.firstWindow();reopened.setDefaultTimeout(15000);
    await reopened.waitForFunction(text=>document.getElementById('notebook')?.value===text,recoveryText);
    console.log('Abrupt termination of the isolated development main process and relaunch retained the same notebook.');
  }finally{
    await app.close().catch(()=>{});
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
