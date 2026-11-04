const { _electron:electron }=require('../node_modules/playwright');
const {strict:assert}=require('node:assert');
const fs=require('node:fs/promises');
const path=require('node:path');
(async()=>{
  const directory=path.resolve(process.env.OIA_TEST_DIRECTORY || 'evidence-local');
  await fs.mkdir(directory,{recursive:true});
  const exe=process.argv[2]||path.join(directory,'installed','Industrial Engineering Workshop.exe');
  const project=path.join(directory,'windows-roundtrip.json');
  const app=await electron.launch({executablePath:exe,args:['--workshop-test-hidden',...(process.argv.includes('--dev')?[path.resolve(process.env.OIA_TEST_HOST || __dirname)]:[]),'--user-data-dir='+path.join(directory,'qa-profile')],timeout:60000});
  try{
    console.log('Main process attached');const page=await app.firstWindow({timeout:12000});console.log('Workshop window attached',page.url());
    page.setDefaultTimeout(12000);
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await require('./facility.test-helper.cjs').verifyFacility(app,page,directory);
    await page.waitForFunction(()=>document.body?.dataset.ready==='true' && !document.body.inert && document.querySelector('#viewport canvas, #viewport svg') && document.querySelector('#asset-tree'));
    await page.waitForLoadState('load');
    console.log('Initial app painted',await page.title());
    await app.context().setOffline(true);
    await page.reload({waitUntil:'domcontentloaded',timeout:12000});
    await page.waitForFunction(()=>document.body?.dataset.ready==='true' && !document.body.inert);
    assert.ok(page.url().endsWith('/workshop/studio/index.html'));
    assert.equal(await page.evaluate(()=>typeof window.workshopHost.saveProject),'function');
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    const image=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64'));
    await fs.writeFile(path.join(directory,'studio-native.png'),Buffer.from(image,'base64'));
    const studioFile=path.join(directory,'studio-native-project.json');
    await app.evaluate(({dialog},file)=>{
      globalThis.studioTestDialogs={open:dialog.showOpenDialog,save:dialog.showSaveDialog};
      dialog.showSaveDialog=async()=>({canceled:false,filePath:file});
      dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});
    },studioFile);
    const originalFile=await fs.stat(studioFile).catch(()=>null);
    await page.locator('#save-project').click();
    await page.waitForFunction(()=>!document.body.inert);
    const deadline=Date.now()+10000;
    while(Date.now()<deadline){
      const stat=await fs.stat(studioFile).catch(()=>null);
      if(stat?.size>0 && (!originalFile || stat.mtimeMs>originalFile.mtimeMs)) break;
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    const original=JSON.parse(await fs.readFile(studioFile,'utf8'));
    assert.ok(Object.keys(original).length>1);
    const firstScene=await page.locator('#asset-tree').innerText();
    await page.locator('#new-project').click();await page.locator('#start-blank').click();
    await page.waitForFunction(prior=>document.getElementById('asset-tree')?.innerText!==prior,firstScene);
    await page.locator('#open-project').click();
    await page.waitForFunction(prior=>document.getElementById('asset-tree')?.innerText===prior,firstScene);
    const dimensions=await page.locator('#viewport').boundingBox();
    assert.ok(dimensions && dimensions.width>200 && dimensions.height>160);
    const rendering=await page.locator('#viewport [data-renderer]').first().getAttribute('data-renderer');
    assert.ok(['webgl','svg'].includes(rendering));
    console.log('Installed engineering viewport',rendering,Math.round(dimensions.width)+' × '+Math.round(dimensions.height),'CSS px');
    await app.evaluate(({dialog})=>{
      dialog.showOpenDialog=globalThis.studioTestDialogs.open;
      dialog.showSaveDialog=globalThis.studioTestDialogs.save;
      delete globalThis.studioTestDialogs;
    });
    console.log('Offline studio first-run, native save, blank project and native reopen passed.');
    await page.goto('workshop://local/workshop/classic.html');
    await page.locator('#mode option').first().waitFor({state:'attached'});
    assert.equal(await page.locator('h1').innerText(),'Packaging workshop');
    for (const [relative, asset] of [['commissioning/index.html','register.mjs'],['classic.html','workshop.mjs']]) {
      let release;
      const held=new Promise(resolve=>{release=resolve;});
      const pattern='**/'+asset+'*';
      await page.route(pattern,async route=>{await held;await route.continue();});
      try {
        await page.goto('workshop://local/workshop/'+relative,{waitUntil:'commit'});
        await page.waitForFunction(()=>document.body?.inert && document.querySelector('header a'));
        assert.equal(await page.locator('header a').first().evaluate(a=>a.closest('[inert]')===document.body),true);
      } finally { release(); }
      await page.waitForFunction(()=>document.body?.inert===false);
      await page.unroute(pattern);
      console.log('Before module startup the whole body, including the header, was inert; enabled after startup:',relative);
    }
    assert.equal(await page.evaluate(()=>typeof window.require),'undefined');
    assert.equal(await page.evaluate(()=>typeof window.workshopHost?.openProject),'function');
    if (process.env.OIA_FREECAD_TEST==='1') {
      const {promisify}=require('node:util'), run=promisify(require('node:child_process').execFile);
      const mainPid=await app.evaluate(()=>process.pid),source=path.resolve('../simulator/workshop/cad/assets/photoeye-assembly.step');
      await page.getByText('CAD and engine workspace',{exact:true}).click();
      const choose=run('powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(__dirname,'pick-file.ps1'),'-AppPid',String(mainPid),'-File',source],{windowsHide:true,timeout:35000});
      await Promise.all([choose,page.getByRole('button',{name:'Import STEP with FreeCAD'}).click()]);
      await page.waitForFunction(()=>document.getElementById('cad-info').textContent.includes('0.100 m'));
      console.log('Native Windows STEP chooser and FreeCAD:',await page.locator('#cad-info').innerText());
    }
    await app.evaluate(({dialog},project)=>{
      dialog.showSaveDialog=async()=>({canceled:false,filePath:project});
      dialog.showOpenDialog=async()=>({canceled:false,filePaths:[project]});
    },project);
    await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},studioFile);
    await page.locator('#import').click();await replace();
    await page.waitForFunction(()=>document.getElementById('notice')?.textContent.includes('Portable project opened'));
    assert.ok(await page.locator('#asset option').count()>=10);
    await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},project);
    async function replace(){await page.locator('#confirm button[value="replace"]').click();}
    await page.locator('#blank').click();await replace();await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('Blank cell opened'));
    await page.locator('#asset-type').selectOption('conveyor');
    await page.locator('#new-id').fill('transfer-belt');
    await page.locator('#place button').click();
    await page.locator('#export').click();
    await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('saved to disk'));
    const saved=JSON.parse(await fs.readFile(project,'utf8'));
    assert.match(JSON.stringify(saved),/transfer-belt/);
    await page.locator('#blank').click();await replace();await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('Blank cell opened'));
    await page.locator('#import').click();await replace();await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('Portable project opened'));
    assert.match(await page.locator('#asset').innerText(),/transfer-belt/);
    if (!process.argv.includes('--base')) {
      const returned=await require('./interchange.test-helper.cjs').interchange(project,path.resolve(process.env.OIA_TEST_SITE || '../dist'),directory);
      await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},returned);
      await page.locator('#import').click();await replace();
      await page.waitForFunction(()=>document.getElementById('notebook').value==='Validated in browser after Windows export.');
      await page.goto('workshop://local/workshop/studio/index.html');
      await page.waitForFunction(()=>document.body?.dataset.ready==='true' && !document.body.inert);
      await page.locator('#open-project').click();
      await page.waitForFunction(()=>document.getElementById('notice')?.textContent.includes('Project opened'));
      const roundtrip=path.join(directory,'studio-reexport.json');
      await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},roundtrip);
      await page.locator('#save-project').click();
      const until=Date.now()+10000;
      let exported;
      while(Date.now()<until && !exported){try{exported=JSON.parse(await fs.readFile(roundtrip,'utf8'));}catch{await new Promise(r=>setTimeout(r,50));}}
      assert.equal(exported?.learning?.notebook,'Validated in browser after Windows export.');
      assert.match(JSON.stringify(exported.history),/transfer-belt/);
      await page.goto('workshop://local/workshop/classic.html');
      await page.waitForFunction(()=>!document.body.inert && document.getElementById('mode')?.options.length);
      console.log('Studio -> Classic and Classic -> Microsoft Edge -> Studio project interchange passed.');
    }
    const classicImage=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64'));
    await fs.writeFile(path.join(directory,'installed-workshop.png'),Buffer.from(classicImage,'base64'));
    console.log('Offline workshop launch and native file roundtrip passed',JSON.stringify(await page.evaluate(()=>({viewport:[innerWidth,innerHeight],platform:navigator.userAgent}))));
    if (process.argv.includes('--base'))return;
    await page.goto('workshop://local/workshop/cad/index.html');
    await page.locator('#load').click();
    await page.waitForFunction(()=>document.getElementById('dimensions').textContent.includes('0.1000'),{},{timeout:35000});
    console.log('CAD:',await page.locator('#dimensions').innerText());
    await page.goto('workshop://local/workshop/practice/index.html');
    await page.locator('#bench').selectOption('sql');
    await page.locator('#query').fill('SELECT 13 * 11 AS product');
    await page.locator('#run').click();
    await page.waitForFunction(()=>document.getElementById('result').textContent.includes('143'));
    console.log('SQL:',await page.locator('#result').innerText());
    await page.goto('workshop://local/workshop/native/index.html');
    await page.waitForFunction(()=>document.getElementById('runtime').textContent.length>0);
    console.log('External engine discovery:',await page.locator('#runtime').innerText());
    assert.deepEqual(errors,[]);
  }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
