const crypto=require('node:crypto');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const asar=require('@electron/asar');

async function filesIn(dir,prefix='') {
  const out=[];
  for(const entry of await fs.readdir(path.join(dir,prefix),{withFileTypes:true})){
    const key=path.join(prefix,entry.name);
    if(entry.isDirectory())out.push(...await filesIn(dir,key));
    else if(entry.isFile())out.push(key);
  }
  return out.sort();
}
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
  const [program,website]=process.argv.slice(2);
  if(!program||!website)throw Error('Supply the package executable path and frozen browser build directory.');
  const resources=path.join(path.dirname(path.resolve(program)),'resources'),archive=path.join(resources,'app.asar');
  const version=JSON.parse(await fs.readFile(path.join(__dirname,'package.json'),'utf8')).version;
  const info=JSON.parse(asar.extractFile(archive,'package.json'));
  assert.equal(info.version,version);
  for(const name of ['main.cjs','preload.cjs','engine.cjs','native.cjs','occt.cjs']){
    const expected=await fs.readFile(path.join(__dirname,name));
    assert.equal(digest(asar.extractFile(archive,name)),digest(expected),name+' differs from the release source');
  }
  const site=path.resolve(website),keys=await filesIn(site),tree=crypto.createHash('sha256');
  for(const file of keys){
    const expected=digest(await fs.readFile(path.join(site,file)));
    assert.equal(digest(await fs.readFile(path.join(resources,'site',file))),expected,file+' differs from the frozen web build');
    tree.update(file.split(path.sep).join('/')+'\0'+expected+'\n');
  }
  const nativeFiles=['convert.py','engine/scenario.json','engine/pilot.py','engine-ui/index.html','engine-ui/view.js'];
  for(const file of nativeFiles){
    const deployed=file.startsWith('engine-ui/')?'site/workshop/native/'+path.basename(file):file;
    assert.equal(digest(await fs.readFile(path.join(resources,deployed))),digest(await fs.readFile(path.join(__dirname,file))),file+' differs from the native resources');
  }
  console.log(JSON.stringify({version:info.version,sharedFiles:keys.length,sharedTreeSha256:tree.digest('hex'),asarSha256:digest(await fs.readFile(archive)),verifiedHostModules:5,verifiedNativeResources:nativeFiles.length}));
})().catch(e=>{console.error(e);process.exitCode=1;});
