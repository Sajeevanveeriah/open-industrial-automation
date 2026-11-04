const assert=require('node:assert/strict');
async function runFloorPractical(page){
  const primary=page.locator('#shift-primary'),progress=page.locator('#shift-progress');
  const bounds=await primary.boundingBox(),viewport=await page.evaluate(()=>({w:innerWidth,h:innerHeight}));
  assert.ok(bounds && bounds.y>=0 && bounds.y+bounds.height<=viewport.h,'Initial job action must fit within the first screen');
  assert.match(await primary.innerText(),/Find matching pallet/);
  await primary.click();await page.locator('[data-pallet="PL-00157"]').click();await primary.click();
  assert.match(await progress.innerText(),/1\s*\/\s*5/);
  await primary.click();
  const door=page.getByLabel('Dispatch door'),submit=page.getByRole('button',{name:'Reserve pallet and release order'});
  await door.selectOption('D01');await submit.click();
  assert.match(await page.locator('#dialog-message').innerText(),/Wrong dispatch door/i);
  assert.match(await progress.innerText(),/1\s*\/\s*5/);
  await door.selectOption('D02');await submit.click();
  assert.match(await progress.innerText(),/2\s*\/\s*5/);
  await primary.click();await primary.click();await page.locator('[data-truck="AMR-02"]').click();
  assert.match(await progress.innerText(),/3\s*\/\s*5/);
  for(let i=0;i<7 && (await progress.innerText()).startsWith('3');i++)await primary.click();
  assert.match(await progress.innerText(),/4\s*\/\s*5/);
  await primary.click();await page.locator('#job-pallet').fill('PL-00157');await page.locator('#job-lot').fill('LT-309');await page.locator('#job-trailer').fill('TR-02');
  await page.getByRole('button',{name:'Verify and sign off'}).click();
  assert.match(await progress.innerText(),/5\s*\/\s*5/);
  await page.reload();await page.waitForFunction(()=>!document.body.inert&&document.body.dataset.ready==='true');
  assert.match(await progress.innerText(),/5\s*\/\s*5/);
  console.log('Floor job: wrong D01 rejected at 1/5, accepted D02 reservation, identified truck AMR-02, dispatched PL-00157 and signed LT-309 at TR-02. Restored all five objectives after reload.');
}
module.exports={runFloorPractical};
