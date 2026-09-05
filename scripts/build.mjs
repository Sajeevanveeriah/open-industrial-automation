import {cp,mkdir,rm,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const target=resolve('dist');
await rm(target,{recursive:true,force:true});
await mkdir(target,{recursive:true});
await cp(resolve('simulator'),target,{recursive:true});
let html=await readFile(resolve(target,'index.html'),'utf8');
for(const file of ['styles.css','app.mjs']){const hash=createHash('sha256').update(await readFile(resolve(target,file))).digest('hex').slice(0,12);html=html.replace(file+'?v=potato-controls-5',file+'?v=potato-controls-5-'+hash);}
await writeFile(resolve(target,'index.html'),html);
const products=['operations','control','hmi','alarms','historian','performance','integration','mes','materials','assets','quality','security','identity','deployment','migration'];
const aliases=['potato','suite','demo','studio','products',...products.map(x=>'products/'+x),'suite/demo','suite/studio','suite/products',...products.map(x=>'suite/products/'+x)];
for (const alias of aliases) {
 const back='../'.repeat(alias.split('/').length);
 await mkdir(resolve(target,alias),{recursive:true});
 await writeFile(resolve(target,alias,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=${back}?release=potato-controls-5#plant"><title>Opening potato plant digital twin</title><p><a href="${back}?release=potato-controls-5#plant">Open the potato plant digital twin</a></p></html>`);
}
// Keep only tiny migration workers at previously registered scopes.
for (const alias of ['suite','potato']) await cp('simulator/sw.js',resolve(target,alias,'sw.js'));
for (const alias of ['', 'suite/']) {
 const back=alias?'../':'./';
 for (const file of ['runtime-bootstrap.js','app.js','product-shell.js']) {
  await writeFile(resolve(target,alias,file),`location.replace(new URL('${back}?release=potato-controls-5#plant',document.currentScript?.src || document.baseURI).href);\n`);
 }
}
await writeFile(resolve(target,'release.json'),JSON.stringify({release:'potato-controls-5',commit:process.env.GITHUB_SHA||'local'}));
await writeFile(resolve(target,'.nojekyll'),'\n');
console.log('Built potato-only application with redirects for every retired entry point.');
