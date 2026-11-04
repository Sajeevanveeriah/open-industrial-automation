import assert from 'node:assert/strict';

export async function checkStudioPracticals(page,width){
 const ids=width>=1000?['wiring','counting','camera','recovery']:['wiring','camera'];
 for(const id of ids){
  await page.selectOption('#practical-track',id);await page.click('#practical-start');
  assert.equal(new URL(page.url()).searchParams.get('practical'),id);
  for(const edition of [1,2]){
   const answer={wiring:['I1','I0'],counting:['5','7'],camera:['VLAN path','Viewing permission'],recovery:['1','0']}[id][edition-1];
   await page.selectOption('#practical-prediction',answer);await page.click('#practical-diagnose');
   assert.equal(await page.locator('#practical-result').getAttribute('data-pass'),'true',id+' fault prediction, case '+edition);
   await page.click('#practical-prove');
   assert.equal(await page.locator('#practical-result').getAttribute('data-pass'),'false',id+' accepted an unrepaired fault');
   if(id==='wiring'){
    await page.selectOption('#practical-wire-input',edition===1?'I0':'I1');await page.click('#practical-rewire');
   }else if(id==='counting'){
    await page.selectOption('#practical-mode','rising');await page.click('#practical-program');
   }else if(id==='camera'){
    if(edition===1){await page.fill('#practical-p2','40');await page.click('#practical-vlan');}
    else{await page.selectOption('#practical-permission','true');await page.click('#practical-grant');}
   }else{
    await page.selectOption('#practical-vacuum','true');await page.click('#practical-apply-vacuum');
    await page.click('#practical-reset');await page.click('#practical-pick');
    if(edition===2){await page.selectOption('#practical-online','true');await page.click('#practical-apply-online');await page.click('#practical-retry');}
    await page.selectOption('#practical-dropAck','false');await page.click('#practical-apply-dropAck');await page.click('#practical-retry');
   }
   await page.click('#practical-prove');
   assert.equal(await page.locator('#practical-result').getAttribute('data-pass'),'true',id+' repair, case '+edition);
   assert.equal(await page.locator('#practical-result').getAttribute('data-kind'),'Repair test');
   if(edition===1){await page.reload();await page.locator('#practical-transfer').click();}
  }
  await page.click('#practical-return');await page.locator('#practical-start').waitFor();
  assert.equal(new URL(page.url()).searchParams.has('practical'),false);
 }
 const outcomes=await page.evaluate(()=>JSON.parse(localStorage.getItem('oia-workshop-v1:Learner:active')).learning.practicalResults);
 for(const id of ids){assert.equal(outcomes[id].guided.proof.pass,true);assert.equal(outcomes[id].transfer.proof.pass,true);}
 console.log(width+'px: '+ids.join(', ')+' practicals rejected faulted designs and accepted guided and changed repairs via learner controls.');
}
