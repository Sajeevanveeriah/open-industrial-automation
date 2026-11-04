const fs = require('node:fs/promises');
const path = require('node:path');
const {spawn,execFile} = require('node:child_process');
const {promisify} = require('node:util');
const {createHash,randomUUID} = require('node:crypto');
const {readBounded} = require('./native.cjs');
const runFile = promisify(execFile);

function validateRun(input) {
  if (input?.schema !== 'oia.engine-run/1' || input.scenario !== 'packaging-pilot/1' || input.source !== 'isaac-sim' || input.units !== 'SI' || input.upAxis !== 'Z' || input.frame !== 'cell' || typeof input.runId !== 'string' || !input.runId || input.runId.length > 100 || typeof input.engineVersion !== 'string' || !input.engineVersion || input.engineVersion.length > 100) throw Error('Unsupported engine recording or frame.');
  const dt = 1/60;
  if (!Number.isFinite(input.stepSeconds) || Math.abs(input.stepSeconds-dt)>1e-12 || !Number.isFinite(input.wallSeconds) || input.wallSeconds<=0 || !Array.isArray(input.samples) || input.samples.length!==241) throw Error('Expected 241 recorded samples over four simulated seconds.');
  if (input.vrAMMiB !== null && (!Number.isFinite(input.vrAMMiB) || input.vrAMMiB < 0)) throw Error('Invalid memory measurement.');
  const captures=input.cameraFrames??[];
  if (!Array.isArray(captures) || captures.length>2 || captures.some((f,i)=>!f || f.width!==640 || f.height!==480 || f.timeS!==i*4 || !/^[a-f0-9]{64}$/.test(f.rgbSha256) || !Number.isFinite(f.meanPixel) || f.meanPixel<0 || f.meanPixel>255)) throw Error('Invalid camera frame evidence.');
  let worst = 0, jointError=0, wrongBeam=0, high = null;
  input.samples.forEach((s,i) => {
    if (!s || !Number.isFinite(s.timeS) || Math.abs(s.timeS-i*dt)>1e-8 || !Number.isFinite(s.cartonXM) || !Number.isFinite(s.robotJointRad) || typeof s.sensorHigh!=='boolean') throw Error('Recording contains an invalid sample.');
    worst = Math.max(worst,Math.abs(s.cartonXM-(0.4+0.25*s.timeS)));
    jointError=Math.max(jointError,Math.abs(s.robotJointRad-Math.PI*s.timeS/8));
    const expectedX=0.4+0.25*s.timeS, edgeDistance=Math.abs(Math.abs(expectedX-1)-.15);
    if(edgeDistance>.25*dt+1e-9 && s.sensorHigh!==(Math.abs(expectedX-1)<=.15))wrongBeam++;
    if (high===null && s.sensorHigh) high=s.timeS;
  });
  return {engine:input.engineVersion,id:input.runId,samples:input.samples.length,maxPositionErrorM:worst,maxJointErrorRad:jointError,beamMismatches:wrongBeam,frames:captures.length,firstDetectionS:high,
    finalJointRad:input.samples.at(-1).robotJointRad,realTimeFactor:4/input.wallSeconds,meanFrameMs:input.wallSeconds*1000/input.samples.length,vrAMMiB:input.vrAMMiB};
}

async function trustedExecutable(root) {
  const executable = await fs.realpath(path.join(root,'kit','kit.exe'));
  const experience = await fs.realpath(path.join(root,'apps','isaacsim.exp.full.kit'));
  const base = await fs.realpath(root);
  if (executable.toLowerCase()!==path.join(base,'kit','kit.exe').toLowerCase() || experience.toLowerCase()!==path.join(base,'apps','isaacsim.exp.full.kit').toLowerCase()) throw Error('Installation contains redirected launch files.');
  const shell = path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
  const signature = await runFile(shell,['-NoProfile','-NonInteractive','-Command',"$s=Get-AuthenticodeSignature -LiteralPath $env:OIA_KIT; if($s.Status -ne 'Valid' -or $s.SignerCertificate.Subject -notmatch '(^|, )O=NVIDIA Corporation(,|$)'){exit 7}; (Get-Item -LiteralPath $env:OIA_KIT).VersionInfo.ProductVersion"],{env:{...process.env,OIA_KIT:executable},windowsHide:true,timeout:15000});
  return {executable,experience,version:signature.stdout.trim() || 'NVIDIA Kit'};
}

class Pilot {
  constructor(resources,stage,folder) {
    this.resources=resources; this.stage=stage; this.folder=folder; this.message='Ready'; this.tail=''; this.result=null; this.child=null;
  }
  async compare(recording) {
    const summary=validateRun(recording);
    const files=[['scenarioSha256',path.join(this.resources,'scenario.json')],['stageSha256',this.stage]];
    summary.inputIdentity='Recording omits input hashes.';
    if(files.some(([key])=>Object.hasOwn(recording,key))){
      if(!files.every(([key])=>typeof recording[key]==='string' && /^[a-f0-9]{64}$/.test(recording[key])))throw Error('Invalid scenario or stage digest.');
      const digests=await Promise.all(files.map(async ([,file])=>createHash('sha256').update(await readBounded(file,2097152)).digest('hex')));
      summary.inputIdentity=files.every(([key],i)=>recording[key]===digests[i])?'Scenario and stage match this installation.':'Scenario or stage differs from this installation.';
    }
    return summary;
  }
  async start(root,camera=false) {
    if(typeof camera!=='boolean')throw Error('Unsupported camera option.');
    if (this.child) throw Error('A pilot is already running.');
    const {executable,experience,version} = await trustedExecutable(root);
    const id=randomUUID(), dir=path.join(this.folder,id);
    await fs.mkdir(dir,{recursive:true});
    const script=path.join(this.resources,'pilot.py');
    this.lastDir=dir; this.result=null; this.tail=''; this.message='Starting signed NVIDIA Kit';
    const child=spawn(executable,[experience,'--enable','isaacsim.core.version','--no-window','--/app/extensions/registryEnabled=false','--/app/window/width=640','--/app/window/height=480','--exec','"'+script+'"'],{
      shell:false,cwd:root,windowsHide:true,env:{...process.env,OIA_ENGINE_RUN:dir,OIA_ENGINE_ID:id,OIA_ENGINE_VERSION:version,OIA_ENGINE_STAGE:this.stage,OIA_ENGINE_CAMERA:camera?'1':'0'},
      stdio:['ignore','pipe','pipe']});
    this.child=child;
    const add = buf => {this.tail=(this.tail+buf.toString()).slice(-12000);};
    child.stdout.on('data',add); child.stderr.on('data',add);
    child.once('error',e=>{this.message=e.message;});
    child.once('close',async code=>{
      try {
        await fs.writeFile(path.join(dir,'engine.log'),this.tail);
        if (code!==0) throw Error('Kit stopped with exit code '+code+'.');
        const recording=JSON.parse((await readBounded(path.join(dir,'result.json'),2097152)).toString());
        if (recording.runId!==id) throw Error('Run identity differs from the launched process.');
        const comparison=await this.compare(recording);
        if(comparison.inputIdentity!=='Scenario and stage match this installation.')throw Error('Live pilot input hashes do not match its launch inputs.');
        this.result=comparison; this.message='Live process completed';
      } catch(e) {this.message='Engine supplied no verified result. '+e.message;}
      finally {this.child=null;}
    });
  }
  async stop() {
    const child=this.child;
    if (!child) return;
    await fs.writeFile(path.join(this.lastDir,'stop.request'),'stop',{flag:'a'});
    this.message='Stopping at the next pilot step';
    setTimeout(()=>{if(this.child===child) child.kill();},5000).unref();
  }
  status() {return {running:!!this.child,message:this.message,log:this.tail,summary:this.result};}
}
module.exports={Pilot,validateRun};
