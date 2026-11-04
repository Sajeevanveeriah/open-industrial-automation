export const terminals=['PS.+','PS.0','TB.1A','TB.1B','TB.2A','TB.2B','TX.+','TX.-','AI.+','AI.-'];
export const drawing=[['PS.+','TB.1A'],['TB.1B','TX.+'],['TX.-','TB.2A'],['TB.2B','AI.+'],['AI.-','PS.0']];
const finite=(v,min,max)=>{if(!Number.isFinite(v)||v<min||v>max)throw Error('Value outside '+min+' to '+max+'.');return v;};
export function wiring(wires){
 if(!Array.isArray(wires)||wires.length>12)throw Error('Maximum twelve patch leads.');
 const links=new Map(terminals.map(p=>[p,[]]));
 for(const [a,b] of [...wires,['TB.1A','TB.1B'],['TB.2A','TB.2B']]){
   if(!links.has(a)||!links.has(b)||a===b)throw Error('Invalid loop terminal.');
   links.get(a).push(b);links.get(b).push(a);
 }
 const group=new Map();
 for(const pin of terminals)if(!group.has(pin)){const queue=[pin];group.set(pin,pin);while(queue.length){for(const next of links.get(queue.pop()))if(!group.has(next)){group.set(next,pin);queue.push(next);}}}
 const same=(a,b)=>group.get(a)===group.get(b);
 if(same('PS.+','PS.0'))return 'Supply short';
 if(same('AI.+','AI.-'))return 'Input burden bypassed';
 if(same('TX.+','TX.-'))return 'Transmitter bypassed';
 if(same('PS.+','TX.+')&&same('TX.-','AI.+')&&same('AI.-','PS.0'))return 'Closed';
 if(same('PS.+','AI.+')&&same('AI.-','TX.+')&&same('TX.-','PS.0'))return 'Closed';
 if(same('PS.+','TX.-')||same('PS.0','TX.+'))return 'Transmitter polarity reversed';
 return 'Open or miswired loop';
}
export function instrument(wires,{supply=24,burden=250,cable=10,range=100,actual=50,zero=0,gain=1,readMode='process',injection=12}={}){
 finite(supply,0,48);finite(burden,1,2000);finite(cable,0,500);finite(range,1,2000);finite(actual,-2000,4000);finite(zero,-4,4);finite(gain,0.5,1.5);finite(injection,0,24);
 const circuit=wiring(wires),requested=readMode==='inject'?injection:4+16*actual/range*gain+zero;
 const compliance=Math.max(0,(supply-10)/(cable+burden)*1000),mA=circuit==='Closed'?Math.max(0,Math.min(requested,compliance)):0;
 return {circuit,requested,mA,burdenV:mA*burden/1000,pv:(mA-4)*range/16,headroom:supply-mA*(burden+cable)/1000,quality:circuit!=='Closed'?circuit:mA+1e-8<requested?'Compliance limited':mA<4||mA>20?'Out of range':'Good'};
}
export function calibration(wires,settings){
 return [0,0.5,1].map(f=>{const ideal=4+16*f,x=instrument(wires,{...settings,readMode:'process',actual:(settings.range||100)*f});return {fraction:f,ideal,observed:x.mA,pass:x.quality==='Good'&&Math.abs(x.mA-ideal)<=0.08};});
}
export function drive({lineV=415,hz=50,poles=4,slip=0.03,lineA=8,pf=0.85,efficiency=0.9,run=true,phaseLoss=false,time=0}={}){
 finite(lineV,0,690);finite(hz,1,100);if(![2,4,6,8].includes(poles))throw Error('Choose an even motor pole count.');finite(slip,0,1);finite(lineA,0,100);finite(pf,0,1);finite(efficiency,0,1);finite(time,0,1);
 const active=run&&!phaseLoss,lineRms=active?lineV:0,phaseRms=lineRms/Math.sqrt(3),rpm=active?120*hz/poles*(1-slip):0,kW=Math.sqrt(3)*lineRms*lineA*pf/1000;
 return {lineRms,phaseRms,peak:Math.sqrt(2)*phaseRms,instant:Math.sqrt(2)*phaseRms*Math.sin(2*Math.PI*hz*time),rpm,kW,shaftKW:kW*efficiency,torque:rpm?1000*kW*efficiency/(rpm*2*Math.PI/60):0,status:!run?'Stopped':phaseLoss?'Phase-loss trip':'Running'};
}
export function transducer({type='RTD',value=50,lead=1,compensate=false,cold=20,pulses=1024,window=1}={}){
 finite(value,-50,200);finite(lead,0,20);finite(cold,-20,80);finite(pulses,1,4096);finite(window,0.01,10);
 if(type==='RTD'){const ohms=100+0.385*value+2*lead;return {signal:ohms,unit:'Ω',indicated:(ohms-100-(compensate?2*lead:0))/0.385,engineering:'°C'};}
 if(type==='TC'){const mV=(value-cold)*0.041;return {signal:mV,unit:'mV',indicated:mV/0.041+(compensate?cold:0),engineering:'°C'};}
 if(type==='Encoder'){const edges=Math.trunc(value*pulses*window/60);return {signal:edges,unit:'signed pulses',indicated:edges*60/(pulses*window),engineering:'rpm'};}
 if(type==='Load cell'){const mV=10*2*value/200;return {signal:mV,unit:'mV',indicated:mV*200/20,engineering:'kg'};}
 throw Error('Unsupported sensor.');
}
