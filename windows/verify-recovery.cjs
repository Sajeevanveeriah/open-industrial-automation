const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { _electron: electron } = require('../node_modules/playwright');

async function waitForRecovered(app, url, expression) {
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    try {
      const ready = await app.evaluate(async ({ BrowserWindow }, request) => {
        const contents = BrowserWindow.getAllWindows()[0].webContents;
        return contents.getURL() === request.url && await contents.executeJavaScript(request.expression);
      }, { url, expression });
      if (ready) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw Error('The saved ' + url + ' state did not recover.');
}

(async () => {
  const root = path.resolve('evidence-local');
  await fs.mkdir(root, { recursive: true });
  const binary = require('electron');
  const folder = path.resolve(process.env.OIA_TEST_HOST || __dirname);
  const base = 'workshop://local/workshop/';
  const cases = [
    { name: 'facility', route: 'studio/facility/index.html', expected: "document.getElementById('fault-toggle')?.textContent==='Recover truck' && document.getElementById('asset-select')?.value==='AMR-01'" },
    { name: 'studio', route: 'studio/index.html', expected: "document.body?.dataset.ready==='true' && !document.body.inert && document.getElementById('meta')?.textContent.includes('0 assets')" },
    { name: 'classic', route: 'classic.html', expected: "document.getElementById('notebook')?.value==='Saved recovery acceptance record.'" }
  ];
  for (const item of cases) {
    const profile = await fs.mkdtemp(path.join(root, 'recover-' + item.name + '-'));
    const launch = () => electron.launch({
      executablePath: binary,
      args: [folder, '--workshop-test-hidden', '--user-data-dir=' + profile],
      timeout: 45000
    });
    let app = await launch();
    try {
      let page = await app.firstWindow();
      page.setDefaultTimeout(15000);
      await page.waitForFunction(() => document.body?.dataset.ready === 'true' && !document.body.inert);
      const url = base + item.route;
      if (page.url() !== url) await page.goto(url);
      if (item.name === 'facility') {
        if(await page.locator('#shift-free').isVisible())await page.locator('#shift-free').click();
        if ((await page.locator('#toggle-play').innerText()).includes('Pause')) await page.locator('#toggle-play').click();
        await page.locator('#asset-select').selectOption('AMR-01');
        await page.locator('#fault-toggle').click();
      } else if (item.name === 'studio') {
        await page.waitForFunction(() => document.body?.dataset.ready === 'true' && !document.body.inert);
        await page.locator('#new-project').click();
        await page.locator('#start-blank').click();
      } else {
        await page.waitForFunction(() => !document.body.inert && document.getElementById('mode')?.options.length > 0);
        await page.locator('#notebook').fill('Saved recovery acceptance record.');
        await page.locator('#save').click();
      }
      await page.waitForFunction(item.expected);
      await app.evaluate(async ({ session, dialog, BrowserWindow }) => {
        await session.defaultSession.flushStorageData();
        dialog.showMessageBox = async (_window, options) => {
          if (!options.message.includes('workshop view stopped')) throw Error('Unexpected native dialogue.');
          return { response: 0 };
        };
        setTimeout(() => BrowserWindow.getAllWindows()[0].webContents.forcefullyCrashRenderer(), 150);
      });
      await page.waitForEvent('crash');
      await waitForRecovered(app, url, item.expected);
      console.log(item.name + ': actual renderer crash handler reopened the retained learner state.');

      const processInfo = await app.evaluate(({ app }) => ({
        pid: process.pid,
        profile: app.getPath('userData'),
        executable: process.execPath
      }));
      assert.equal(path.resolve(processInfo.profile), profile);
      assert.equal(path.resolve(processInfo.executable).toLowerCase(), path.resolve(binary).toLowerCase());
      const stopped = app.waitForEvent('close', { timeout: 15000 });
      process.kill(processInfo.pid, 'SIGKILL');
      await stopped;
      app = await launch();
      page = await app.firstWindow();
      await page.waitForFunction(() => document.body?.dataset.ready === 'true' && !document.body.inert);
      if (page.url() !== url) await page.goto(url);
      await page.waitForFunction(item.expected);
      console.log(item.name + ': abrupt isolated main-process termination and relaunch retained the same state.');
    } finally {
      await app.close().catch(() => {});
    }
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
