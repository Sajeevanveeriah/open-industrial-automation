import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
const local=process.env.OIA_BASE_URL?null:await createServer({configFile:false,root:'dist',optimizeDeps:{noDiscovery:true},server:{host:'127.0.0.1',port:0}});
await local?.listen();
const base=(process.env.OIA_BASE_URL??local.resolvedUrls.local[0]).replace(/\/$/,'');
const browser=await chromium.launch({executablePath:process.env.OIA_CHROMIUM||undefined});
try{
  for(const width of [390,1440]){
    const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    const click=n=>page.getByRole('button',{name:n,exact:true}).click();
    const expectText=(id,text)=>page.locator(id).filter({hasText:text}).waitFor();
    async function accessibility(){
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.addScriptTag({path:'node_modules/axe-core/axe.min.js'});
      assert.deepEqual(await page.evaluate(async()=>(await axe.run()).violations.map(v=>v.id)),[]);
    }
    await page.goto(base+'/workshop/infrastructure/index.html');
    await page.getByRole('link',{name:'Open network assurance and camera survey'}).click();
    await click('Open three-switch ring');await click('Cut lead and measure');
    await expectText('#route','20.214 ms');await click('Trace unknown and learned unicast');await expectText('#captureOut','Known unicast');
    await click('Trace multicast');await click('Solicit neighbour');await expectText('#ipv6Out','ff02::1:ff00:0032');
    await click('Exchange four timestamps');await expectText('#ptpOut','residual after correction -6');
    await click('Measure 12 cycles');await click('Transmit RTU frame');await expectText('#serialOut','C5 CD');
    await click('Aim and inspect');await click('Record accepted scene');await expectText('#lensOut','Verified recording 1');
    await click('Record custody action');await expectText('#chainOut','Preserve');
    await click('Run engineering acceptance');await expectText('#acceptOut','OPEN');await accessibility();
    await page.getByRole('link',{name:'Rack and services'}).click();await expectText('#schedule','RING_A');
    await page.getByText('Install or configure equipment',{exact:true}).click();await page.locator('#chooseAsset').selectOption('NVR');
    await page.locator('#asset [name=groups]').fill('operator,investigator');await click('Apply asset');
    await page.getByRole('link',{name:'Open network assurance and camera survey'}).click();
    for(const [role,actor,action] of [['IT custodian','Custodian','Restrict access'],['Facilities lead','Facilities','Escalate egress'],['Duty engineer','Duty','Accept handover']]){
      await page.getByLabel('Responsibility').selectOption(role);await page.getByLabel('Synthetic staff ID').fill(actor);
      await page.getByLabel('Handover step').selectOption(action);await click('Record custody action');await expectText('#chainOut',action);
    }
    await click('Run engineering acceptance');const report=await page.locator('#acceptOut').innerText();
    assert.equal(report.split('\n').length,6);assert.ok(report.split('\n').every(row=>row.startsWith('PASS')));
    await page.goto(base+'/workshop/servers/index.html');
    await page.locator('#action').selectOption('mirror');await click('Execute simulated operation');await expectText('#result','Mirror synchronised');
    await page.locator('#action').selectOption('diskFault');await click('Execute simulated operation');await expectText('#result','Mirror degraded');
    await accessibility();assert.deepEqual(errors,[]);console.log(width+' × 900: six network and CCTV checks passed, RAID member loss retained service, no page errors, overflow or axe violations.');
    await page.close();
  }
}finally{await browser.close();await local?.close();}
