import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const root = (process.env.OIA_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const browser = await chromium.launch({executablePath: process.env.OIA_CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({viewport: {width, height: 900}, permissions: ['clipboard-read','clipboard-write']});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    const landing = await page.goto(root + '/');
    assert.equal(landing.status(), 200);
    await page.locator('a.proving-entry').click();
    await page.waitForURL('**/proving-ground/index.html');
    await page.waitForFunction(() => document.body.dataset.ready === 'true');
    assert.equal(await page.locator('#pillars button').count(), 7);
    assert.equal(await page.locator('#cameras button').count(), 6);
    assert.equal(await page.locator('#asset-select option').count(), 8);
    assert.equal(await page.locator('#telemetry .metric').count(), 4);
    assert.match(await page.locator('#clock').innerText(), /UTC\+1[01]/);
    assert.equal(Number(await page.locator('#kpi-throughput').innerText()), 18.4);
    const speed = page.locator('#set-speed');
    await speed.focus();
    await speed.press('Home');
    await page.waitForFunction(() => Number(document.querySelector('#kpi-throughput').textContent) === 0);
    await speed.press('End');
    await page.waitForFunction(() => Number(document.querySelector('#kpi-throughput').textContent) > 28);
    for (const [fault, asset, expected] of [
      ['heat','Z3-FRY-01','TRIP'], ['obstacle','AMR-01','INTERLOCK_HOLD'],
      ['jam','Z1-WB-01','TRIP'], ['humidity','Z2-SB-01','WARNING']
    ]) {
      await page.selectOption('#asset-select',asset);
      await page.locator('#fault-'+fault).click();
      await page.waitForFunction(expected => document.querySelector('#asset-status').textContent === expected, expected);
      assert.ok(Number(await page.locator('#kpi-alarms').innerText()) > 0);
      await page.locator('#fault-'+fault).click();
    }
    for (const id of ['z1','z2','z3','z4','amr','overview']) await page.locator('[data-camera="'+id+'"]').click();
    await page.locator('[data-pillar="4"]').click();
    await page.locator('[data-pillar="0"]').click();
    await page.selectOption('#asset-select','AMR-01');
    await page.waitForFunction(() => document.querySelector('#topic').textContent.includes('spBv1.0/Voltwyn/NDATA/Dooen/AMR-01'));
    await page.locator('#pause').click();
    const frozen = await page.locator('#payload').innerText();
    const parsed = JSON.parse(frozen);
    assert.ok(Number.isInteger(parsed.seq) && parsed.metrics.length === 4);
    await page.waitForTimeout(1250);
    assert.equal(await page.locator('#payload').innerText(), frozen);
    await page.locator('#copy').click();
    assert.deepEqual(JSON.parse(await page.evaluate(()=>navigator.clipboard.readText())), parsed);
    await page.locator('#pause').click();
    await page.waitForFunction(last => document.querySelector('#payload').textContent !== last, frozen);
    await page.locator('#run-fat').click();
    await page.waitForFunction(() => document.querySelectorAll('#fat-results li[data-pass="true"]').length === 6);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
    assert.deepEqual(errors, []);
    console.log(width+' px: root navigation, controls, trips, camera presets, inspector, 1 Hz stream, clipboard and six FAT results passed.');
    await context.close();
  }
} finally { await browser.close(); }
