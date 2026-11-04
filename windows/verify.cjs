const { _electron:electron }=require('../node_modules/playwright');
const {strict:assert}=require('node:assert');
const fs=require('node:fs/promises');
const path=require('node:path');
(async()=>{
  const directory=path.resolve('evidence-local');
  await fs.mkdir(directory,{recursive:true});
  const exe=process.argv[2]||path.join(directory,'installed','Industrial Engineering Workshop.exe');
  const project=path.join(directory,'windows-roundtrip.json');
  const app=await electron.launch({executablePath:exe,args:['--workshop-test-hidden',...(process.argv.includes('--dev')?[__dirname]:[]),'--user-data-dir='+path.join(directory,'qa-profile')],timeout:60000});
  try{
    console.log('Main process attached');const page=await app.firstWindow({timeout:12000});console.log('Workshop window attached',page.url());
    page.setDefaultTimeout(12000);
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.locator('#mode option').first().waitFor({state:'attached'});
    await page.waitForLoadState('load');
    console.log('Initial app painted',await page.title());
    await app.context().setOffline(true);
    await page.reload({waitUntil:'domcontentloaded',timeout:12000});
    await page.locator('#mode option').first().waitFor({state:'attached'});
    assert.equal(await page.locator('h1').innerText(),'Packaging workshop');
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
      const returned=await require('./interchange.test-helper.cjs').interchange(project,path.resolve('../dist'),directory);
      await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},returned);
      await page.locator('#import').click();await replace();
      await page.waitForFunction(()=>document.getElementById('notebook').value==='Validated in browser after Windows export.');
      console.log('Windows -> Microsoft Edge -> Windows project interchange passed.');
    }
    await page.screenshot({path:path.join(directory,'installed-workshop.png')});
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
