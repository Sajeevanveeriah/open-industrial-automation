import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const target=resolve('dist');
await rm(target,{recursive:true,force:true});
await mkdir(target,{recursive:true});
await cp(resolve('web'),target,{recursive:true});
await cp(resolve('simulator'),resolve(target,'potato'),{recursive:true});
await writeFile(resolve(target,'.nojekyll'),'\n','utf8');
console.log('Built OIA suite and connected potato simulation at dist/potato/.');
