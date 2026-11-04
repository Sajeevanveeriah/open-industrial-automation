const host=window.workshopHost;
const get=id=>document.getElementById(id);
let imported=null;
async function update(){
  const result=await host.pilotStatus();
  get('state').textContent=result.message;
  get('log').textContent=result.log;
  get('run').disabled=result.running;
  get('stop').disabled=!result.running;
  const data=imported||result.summary;
  if(data) get('result').textContent=[
    imported?'Imported recording (self-declared provenance)':'Live locally launched process',
    'Engine: '+data.engine,'Run: '+data.id,'Samples: '+data.samples,
    'Maximum carton position error: '+data.maxPositionErrorM.toFixed(6)+' m',
    'First beam detection: '+(data.firstDetectionS===null?'no detection':data.firstDetectionS.toFixed(3)+' s'),
    'Final joint: '+data.finalJointRad.toFixed(4)+' rad','Real-time factor: '+data.realTimeFactor.toFixed(3),
    'Mean Kit update and sample: '+data.meanFrameMs.toFixed(2)+' ms',
    'VRAM: '+(data.vrAMMiB===null?'unmeasured':data.vrAMMiB+' MiB')].join('\n');
}
async function detect(){get('runtime').textContent=(await host.engineStatus()).detail;}
function bind(id,action){get(id).onclick=async()=>{try{await action();await update();}catch(e){get('result').textContent=e.message;}};}
bind('locate',async()=>{await host.locatePilot();await detect();});
bind('run',async()=>{await host.startPilot();imported=null;get('result').textContent='';});
bind('stop',()=>host.stopPilot());
bind('import',async()=>{const data=await host.importPilot();if(data) imported=data;});
detect().catch(e=>{get('runtime').textContent=e.message;});
update().catch(e=>{get('state').textContent=e.message;});
setInterval(()=>update().catch(e=>{get('state').textContent=e.message;}),1500);
