import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
const server = process.env.OIA_BASE_URL ? null : await createServer({configFile:false,root:'dist',server:{host:'127.0.0.1',port:0}});
await server?.listen();
const url=(process.env.OIA_BASE_URL || server.resolvedUrls.local[0]).replace(/\/$/,'')+'/workshop/studio/index.html';
const browser=await chromium.launch({executablePath:process.env.OIA_CHROMIUM || undefined});
try {
  const page=await browser.newPage();
  await page.route(/\/studio\/studio\.mjs(?:\?|$)/,route=>route.abort('failed'));
  await page.goto(url);
  await page.getByRole('alert').filter({hasText:'could not initialise'}).waitFor();
  await page.getByRole('link',{name:'Open classic workshop'}).click();
  await page.waitForFunction(()=>!document.body.inert&&document.querySelector('#mode option'));
  assert.match(page.url(),/\/classic\.html$/);
  await page.unroute(/\/studio\/studio\.mjs(?:\?|$)/);
  await page.getByRole('link',{name:'3D studio',exact:true}).click();
  await page.waitForFunction(()=>document.body.dataset.ready==='true'&&document.querySelector('#viewport [data-renderer]'));
  console.log('A failed studio module offers Classic and a working route back into the initialised studio.');
} finally {await browser.close();await server?.close();}
