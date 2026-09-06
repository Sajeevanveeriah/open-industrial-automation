import {cp,mkdir,rm,writeFile,readFile,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const target=resolve('dist');
await rm(target,{recursive:true,force:true});
await mkdir(target,{recursive:true});
await cp(resolve('simulator'),target,{recursive:true});
await mkdir(resolve(target,'vendor'),{recursive:true});
for(const file of ['three.module.js','three.core.js'])await cp(resolve('node_modules/three/build',file),resolve(target,'vendor',file));
for(const file of ['SVGRenderer.js','Projector.js']){const code=await readFile(resolve('node_modules/three/examples/jsm/renderers',file),'utf8');await writeFile(resolve(target,'vendor',file),code.replaceAll("from 'three'","from './three.module.js'"));}
await cp(resolve('node_modules/three/LICENSE'),resolve(target,'vendor/THREE-LICENSE.txt'));
// Version every module edge, including transitive renderer dependencies. The
// hash is derived from source bytes; unchanged vendor modules keep their cache.
const modules=new Map();
for(const f of await readdir(target,{recursive:true}))if(/\.(mjs|js)$/.test(f)&&f!=='sw.js'){const path=resolve(target,f),code=await readFile(path,'utf8');modules.set(path,{code,hash:createHash('sha256').update(code).digest('hex').slice(0,12)});}
for(const [path,{code}] of modules)await writeFile(path,code.replace(/((?:from\s+|import\s*)['"])(\.\/[^'"]+\.(?:mjs|js))(['"])/g,(all,prefix,file,quote)=>{const dep=modules.get(resolve(dirname(path),file));return dep?`${prefix}${file}?v=${dep.hash}${quote}`:all;}));
let html=await readFile(resolve(target,'index.html'),'utf8');
for(const file of ['styles.css','app.mjs']){const hash=createHash('sha256').update(await readFile(resolve(target,file))).digest('hex').slice(0,12);html=html.replace(file+'?v=potato-spatial-7',file+'?v=potato-spatial-7-'+hash);}
await writeFile(resolve(target,'index.html'),html);
const products=['operations','control','hmi','alarms','historian','performance','integration','mes','materials','assets','quality','security','identity','deployment','migration'];
const aliases=['potato','suite','demo','studio','products',...products.map(x=>'products/'+x),'suite/demo','suite/studio','suite/products',...products.map(x=>'suite/products/'+x)];
for (const alias of aliases) {
 const back='../'.repeat(alias.split('/').length);
 await mkdir(resolve(target,alias),{recursive:true});
 await writeFile(resolve(target,alias,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=${back}?release=potato-spatial-7#plant"><title>Opening potato plant digital twin</title><p><a href="${back}?release=potato-spatial-7#plant">Open the potato plant digital twin</a></p></html>`);
}
// Keep only tiny migration workers at previously registered scopes.
for (const alias of ['suite','potato']) await cp('simulator/sw.js',resolve(target,alias,'sw.js'));
for (const alias of ['', 'suite/']) {
 const back=alias?'../':'./';
 for (const file of ['runtime-bootstrap.js','app.js','product-shell.js']) {
  await writeFile(resolve(target,alias,file),`location.replace(new URL('${back}?release=potato-spatial-7#plant',document.currentScript?.src || document.baseURI).href);\n`);
 }
}
await writeFile(resolve(target,'release.json'),JSON.stringify({release:'potato-spatial-7',commit:process.env.GITHUB_SHA||'local'}));
await writeFile(resolve(target,'.nojekyll'),'\n');
console.log('Built potato-only application with redirects for every retired entry point.');
