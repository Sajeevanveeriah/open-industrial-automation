const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {fork}=require('node:child_process');
const {once}=require('node:events');
const {saveAtomic,readBounded}=require('./native.cjs');

async function interruptedWriter() {
  const [filename,boundary]=process.argv.slice(3);
  const replace=fs.rename.bind(fs);
  fs.rename=async(...args)=>{
    if(boundary==='after')await replace(...args);
    process.send('reached');
    await new Promise(()=>{});
  };
  process.on('message',()=>{});
  await saveAtomic(filename,'{"revision":2,"asset":"belt-B"}');
}

if(process.argv[2]==='writer') {
  interruptedWriter().catch(e=>{console.error(e);process.exitCode=1;});
}else{
  for(const boundary of ['before','after']){
    test('killed writer '+boundary+' atomic replacement retains a complete project',async t=>{
      const root=path.resolve('evidence-local');await fs.mkdir(root,{recursive:true});
      const dir=await fs.mkdtemp(path.join(root,'atomic-'));
      t.after(()=>fs.rm(dir,{recursive:true,force:true}));
      const filename=path.join(dir,'project.json');
      await saveAtomic(filename,'{"revision":1,"asset":"belt-A"}');
      const child=fork(__filename,['writer',filename,boundary],{stdio:['ignore','pipe','pipe','ipc']});
      t.after(()=>{if(child.exitCode===null&&!child.killed)child.kill();});
      const timeout=AbortSignal.timeout(10000);
      assert.deepEqual(await once(child,'message',{signal:timeout}),['reached',undefined]);
      const exited=once(child,'exit',{signal:timeout});child.kill();await exited;
      const expected=boundary==='before'?{revision:1,asset:'belt-A'}:{revision:2,asset:'belt-B'};
      assert.deepEqual(JSON.parse((await readBounded(filename,4096)).toString()),expected);
      const remnants=(await fs.readdir(dir)).filter(p=>p.endsWith('.part'));
      assert.equal(remnants.length,boundary==='before'?1:0);
    });
  }
}
