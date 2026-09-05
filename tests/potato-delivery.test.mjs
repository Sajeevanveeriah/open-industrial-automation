import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
test('published root and alias open the potato twin with resolvable local assets',async()=>{
 for(const folder of ['dist','dist/potato']) {
  const html=await readFile(`${folder}/index.html`,'utf8');
  assert.match(html,/<title>Potato Plant Digital Twin/);
  assert.doesNotMatch(html,/src="\.\/app.js"/);
  for(const match of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)) await access(resolve(folder,match[1].split('?')[0]));
  const app=await readFile(`${folder}/app.mjs`,'utf8');
  for(const match of app.matchAll(/from '(\.\/[^']+)'/g)) await access(resolve(folder,match[1].split('?')[0]));
 }
 assert.match(await readFile('dist/suite/index.html','utf8'),/Open Industrial Automation/);
 await access('dist/suite/products/index.html');
});
test('root cache migration cannot keep serving the water-process application',async()=>{
 const sw=await readFile('dist/sw.js','utf8');
 assert.match(sw,/skipWaiting/);assert.match(sw,/clients.claim/);
 assert.doesNotMatch(sw,/caches.match|respondWith/);
});
test('installer workflows are absent and browser gates remain',async()=>{
 for(const p of ['desktop.yml','release.yml']) await assert.rejects(access(`.github/workflows/${p}`));
 const ci=await readFile('.github/workflows/ci.yml','utf8');
 assert.doesNotMatch(ci,/--prefix desktop|desktop:verify/);
 assert.match(ci,/test:simulation-ui/);assert.match(ci,/test:delivery/);
});
