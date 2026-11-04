const assert=require('node:assert/strict');

async function runCellPractical(page){
  await page.locator('#cell-studio').click();
  await page.waitForFunction(()=>document.body.dataset.ready==='true'&&!document.body.inert&&document.getElementById('asset-tree'));
  await page.locator('#practical-track').selectOption('wiring');
  await page.locator('#practical-start').click();
  const result=page.locator('#practical-result');
  for (const [index,measured,required] of [[1,'I1','I0'],[2,'I0','I1']]) {
    await page.locator('#practical-prediction').selectOption(measured);
    await page.locator('#practical-diagnose').click();
    if(index===1){
      await page.locator('#practical-wire-input').selectOption(measured);
      await page.locator('#practical-rewire').click();
      await page.locator('#practical-prove').click();
      await page.locator("#practical-result[data-kind='Repair test'][data-pass='false']").waitFor();
      console.log('Wrong terminal was rejected: '+await result.innerText());
    }
    await page.locator('#practical-wire-input').selectOption(required);
    await page.locator('#practical-rewire').click();
    await page.locator('#practical-prove').click();
    const verdict=await result.innerText();
    assert.equal(await result.getAttribute('data-kind'),'Repair test');
    assert.equal(await result.getAttribute('data-pass'),'true',verdict);
    console.log('Cell wiring assessment '+index+': '+verdict);
    if(index===1)await page.locator('#practical-transfer').click();
  }
  await page.locator('#practical-return').click();
}
async function runPartPractical(page){
  await page.locator('#part-design').click();
  await page.locator('#practical-start').click();
  await page.locator('#volume-prediction').fill('20.736');
  await page.locator('#predict-form button').click();
  await page.locator('#verify-drawing').click();
  assert.match(await page.locator('#drawing-checks').innerText(),/REWORK/);
  await page.locator('#width').fill('100');await page.locator('#height').fill('50');
  await page.locator('#dimensions button').click();
  await page.locator('#wall-size').fill('6');await page.locator('#wall-form button').click();
  await page.locator('#depth').fill('24');await page.locator('#depth').press('Tab');
  await page.locator('#verify-drawing').click();
  const records=await page.locator('#drawing-checks li').allTextContents();
  assert.equal(records.length,7);assert.ok(records.every(r=>r.startsWith('PASS')),records.join(' / '));
  await page.locator('#mount-verified').click();
  await page.locator('#inspect-mounted').waitFor({state:'visible'});
  console.log('Bracket: initial failed geometry, 20.736 cm³ prediction, seven measured checks passed, verified part mounted.');
}
async function runDrivePractical(page){
  await page.locator('#analysis').click();
  await page.locator('#drive-job > summary').click();
  const form=page.locator('#drive-trial'),proof=page.locator('#drive-proof');
  await form.locator('[name=force]').fill('6');
  await form.getByRole('button',{name:'Test my controller'}).click();
  assert.match(await proof.innerText(),/Job remains open/);
  for(const [load,force,kp,ki] of [[1,6,32,28],[2,7,55,30]]){
    await form.locator('[name=force]').fill(String(force));
    await form.locator('[name=kp]').fill(String(kp));await form.locator('[name=ki]').fill(String(ki));
    await form.getByRole('button',{name:'Test my controller'}).click();
    const result=await proof.innerText();
    assert.match(result,load===1?/Job accepted/:/Transfer test accepted/);
    console.log('Drive commissioning '+load+': '+result);
    if(load===1)await page.locator('#drive-next').click();
  }
  await page.getByRole('link',{name:/Engineering studio/i}).click();
  await page.waitForFunction(()=>document.body.dataset.ready==='true' && document.getElementById('asset-tree') && !document.body.inert);
}
module.exports={runCellPractical,runPartPractical,runDrivePractical};
