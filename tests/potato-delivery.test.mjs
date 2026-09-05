import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
test('published root opens potato with resolvable assets',async()=>{
 const html=await readFile('dist/index.html','utf8');assert.match(html,/<title>Potato Plant Digital Twin/);
 for(const m of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g))await access(resolve('dist',m[1].split('?')[0]));
 const app=await readFile('dist/app.mjs','utf8');
 for(const m of app.matchAll(/from '(\.\/[^']+)'/g))await access(resolve('dist',m[1].split('?')[0]));
 assert.doesNotMatch(app,/Open original OIA suite/);
});
test('retired application and installers are absent; old bookmarks redirect',async()=>{
 for(const path of ['web','desktop','dist/model.json','dist/suite/model.json','.github/workflows/desktop.yml','.github/workflows/release.yml'])await assert.rejects(access(path));
 for(const path of ['potato','suite','products/operations','suite/products/operations','demo','studio'])assert.match(await readFile(`dist/${path}/index.html`,'utf8'),/http-equiv="refresh".*potato-recovery-6#plant/);
 assert.match(await readFile('dist/suite/sw.js','utf8'),/client.navigate/);
});
test('delivery has cache migration and live browser gates',async()=>{
 for(const path of ['ci.yml','pages.yml']){const workflow=await readFile('.github/workflows/'+path,'utf8');assert.match(workflow,/test:migration/);assert.match(workflow,/test:simulation-ui/);assert.doesNotMatch(workflow,/test:web|test:products|desktop:verify/);}
});
