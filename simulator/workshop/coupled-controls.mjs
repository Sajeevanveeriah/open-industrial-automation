import {prepareCoupling} from './coupling.mjs';
import {command} from './model.mjs';

export function bindClockControls(current, run){
  const get=id=>document.getElementById(id);
  const bind=get('sync-bind'),disconnect=get('sync-open'),restore=get('sync-connect');
  let lastPorts='';
  function handle(button,action){
    button.addEventListener('click',()=>{
      try{run(action); get('sync-error').textContent='';}
      catch(e){get('sync-error').textContent=e.message;}
    });
  }
  function selectedBindings(){
    return Object.fromEntries(['enable','plc','io','gateway'].map(key=>[key,get('sync-'+key).value.trim()]).filter(([,value])=>value));
  }
  const fault=(name,value)=>command(current(),'benchFault',{name,value});
  handle(bind,()=>{
    const project=current();
    const design=prepareCoupling(project.extensions,selectedBindings());
    command(project,'bindBenches',{design});
  });
  handle(disconnect,()=>fault('link',get('sync-link').value));
  handle(restore,()=>fault('link',null));
  handle(get('sync-processor'),()=>fault('controllerStop',!current().runtime.coupled.controllerStop));
  handle(get('sync-power'),()=>fault('powerStop',!current().runtime.coupled.powerStop));
  handle(get('sync-vacuum'),()=>fault('vacuumLoss',!current().runtime.coupled.vacuumLoss));
  return ()=>{
    const r=current().runtime,s=r.coupled;
    bind.disabled=Boolean(s)||r.cartons.length>0||r.scan>0;
    for(const id of ['sync-open','sync-connect','sync-power','sync-vacuum','sync-link','sync-processor'])get(id).disabled=!s;
    if(!s){lastPorts='';get('sync-link').replaceChildren();get('sync-read').textContent='Benches run independently.';return;}
    const ports=s.rack.links.map(l=>l.id);
    const portKey=JSON.stringify(ports);
    if(portKey!==lastPorts){get('sync-link').replaceChildren(...ports.map(id=>new Option(id,id)));lastPorts=portKey;}
    get('sync-processor').textContent=s.controllerStop?'Resume PLC service':'Stop PLC service';
    get('sync-power').textContent=s.powerStop?'Restore motion enable':'Interrupt motion enable';
    get('sync-vacuum').textContent=s.vacuumLoss?'Restore vacuum feedback':'Interrupt vacuum feedback';
    get('sync-read').textContent=[
      'PLC service '+(s.executing?'running':'stopped')+'; scan '+r.scan+' at '+(r.scan/10).toFixed(1)+' s',
      'Enable '+s.map.enable+' '+(s.power&&!s.powerStop?'on':'off')+'; cyclic I/O '+(s.io?'connected':'unavailable'),
      'Robot '+s.arm.phase+'; owner '+(s.owner||'none')+'; joint angles '+s.arm.q.map(a=>a.toFixed(3)).join(', ')+' rad',
      'Supervisory count '+(s.reportedCount??'unavailable')+'; quality '+s.quality+'; source scan '+(s.sourceScan??'none'),
      'Disconnected lead '+(s.linkFault?.id||'none')
    ].join('\n');
  };
}
