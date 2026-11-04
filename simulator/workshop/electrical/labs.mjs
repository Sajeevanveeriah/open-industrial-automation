import {drawing,terminals,instrument,calibration,drive,transducer,wiring} from './instruments.mjs';
const el=(t,text)=>{const n=document.createElement(t);if(text!==undefined)n.textContent=text;return n;};
const area=document.querySelector('#instrument-labs');
let wires=[];
function field(zone,title,value,options){
 const l=el('label',title),n=el(options?'select':'input');if(options){for(const v of options)n.append(new Option(v,v));}else{n.type=typeof value==='boolean'?'checkbox':'number';if(n.type==='number')n.step='any';}
 n.type==='checkbox'?n.checked=value:n.value=value;l.append(n);zone.append(l);return n;
}
function group(title,body){const box=el('section');box.append(el('h2',title),el('p',body));area.append(box);return box;}
function action(zone,name,fn,output){const b=el('button',name);zone.append(b);b.onclick=()=>{try{fn();}catch(e){output.textContent=e.message;}};}
const loop=group('Wire the transmitter loop','Trace a two-wire 4-20 mA transmitter from a 24 V supply, through the input burden and back to 0 V. TB.1A and TB.1B share a terminal; TB.2A and TB.2B share the second. Wire either component first while preserving both polarities. Predict 3.00 V at 12 mA across 250 Ω.');
const out=el('pre');out.setAttribute('role','status');
const a=field(loop,'Lead from','PS.+',terminals),b=field(loop,'Lead to','TB.1A',terminals),link=field(loop,'Patch schedule','',[]);
function draw(){link.replaceChildren(...wires.map(([a,b],i)=>new Option(a+' → '+b,i)));}
action(loop,'Connect lead',()=>{if(a.value===b.value||wires.length>=12||wires.some(w=>w.includes(a.value)&&w.includes(b.value)))throw Error('Choose a new pair of terminals.');wires.push([a.value,b.value]);draw();},out);
action(loop,'Disconnect selected lead',()=>{if(link.selectedIndex>=0)wires.splice(link.selectedIndex,1);draw();},out);
action(loop,'Load worked drawing',()=>{wires=structuredClone(drawing);draw();},out);
action(loop,'Clear drawing',()=>{wires=[];draw();},out);
const lf={};for(const [k,label,v]of [['supply','Supply voltage (V)',24],['burden','Input burden (Ω)',250],['cable','Total cable resistance (Ω)',10],['range','Full-scale engineering units',100],['actual','Measured process value',50],['zero','Transmitter zero error (mA)',0],['gain','Transmitter span multiplier',1],['injection','Calibrator output (mA)',12]])lf[k]=field(loop,label,v);
const mode=field(loop,'Stimulus','process',['process','inject']);
const values=fields=>Object.fromEntries(Object.entries(fields).map(([k,n])=>[k,n.type==='checkbox'?n.checked:n.tagName==='SELECT'?n.value:Number(n.value)]));
action(loop,'Measure current and burden voltage',()=>{const v=instrument(wires,{...values(lf),readMode:mode.value});out.textContent=v.circuit+' | '+v.quality+'\n'+v.mA.toFixed(3)+' mA | '+v.burdenV.toFixed(3)+' V | indicated '+v.pv.toFixed(3)+' engineering units | '+v.headroom.toFixed(2)+' V across transmitter.';},out);
action(loop,'Run three-point calibration',()=>{const rows=calibration(wires,values(lf));out.textContent=rows.map(r=>r.ideal+' mA target: '+r.observed.toFixed(3)+' mA '+(r.pass?'PASS':'FAIL')).join('\n')+'\nTolerance ±0.08 mA. Change the span, zero or burden and repeat.';},out);loop.append(out);
const ac=group('Commission a three-phase drive','Balanced sinusoidal, star-connected motor approximation. Line-to-line RMS differs from phase-to-neutral peak and instantaneous voltage. Shaft speed includes slip. Phase loss trips the simulated drive. These are virtual measurements only.');
const af={};for(const [k,l,v]of [['lineV','Line-to-line RMS (V)',415],['hz','Electrical frequency (Hz)',50],['poles','Motor poles',4],['slip','Slip fraction',0.03],['lineA','Line current (A)',8],['pf','Power factor',0.85],['efficiency','Motor efficiency',0.9],['time','Waveform sample time (s)',0.005],['phaseLoss','Open one phase',false],['run','Drive run command',true]])af[k]=field(ac,l,v);
const reading=el('pre');action(ac,'Read AC meter and tachometer',()=>{const d=drive(values(af));reading.textContent=d.status+'\nLine '+d.lineRms.toFixed(2)+' V RMS; phase '+d.phaseRms.toFixed(2)+' V RMS, '+d.peak.toFixed(2)+' V peak and '+d.instant.toFixed(2)+' V at sample.\nSpeed '+d.rpm.toFixed(1)+' rpm; electrical '+d.kW.toFixed(3)+' kW; shaft '+d.shaftKW.toFixed(3)+' kW; torque '+d.torque.toFixed(2)+' N m.';},reading);ac.append(reading);
const sen=group('Commission a field sensor','Compare the physical value with the indicated value. Pt100 uses a local linear 0.385 Ω/°C approximation; two equal leads add resistance. Type K uses a local 0.041 mV/°C approximation. The encoder counts signed pulses per gate. The 200 kg load cell uses 2 mV/V at 10 V excitation. These educational approximations exclude industrial calibration uncertainties.');
const sf={type:field(sen,'Transducer','RTD',['RTD','TC','Encoder','Load cell'])};for(const [k,l,v]of [['value','Physical temperature (°C), speed (rpm) or mass (kg)',50],['lead','Resistance of one lead (Ω)',1],['cold','Cold-junction temperature (°C)',20],['compensate','Use lead or cold-junction compensation',false],['pulses','Pulses per revolution',1024],['window','Encoder gate time (s)',1]])sf[k]=field(sen,l,v);
const report=el('pre');action(sen,'Measure sensor',()=>{const r=transducer(values(sf));report.textContent=r.signal.toFixed(4)+' '+r.unit+' → '+r.indicated.toFixed(3)+' '+r.engineering;},report);sen.append(report);

const projectKey='oia-workshop-electrical-transfer-v1';
function saveLab(){
 try{
  const net=JSON.parse(sessionStorage.getItem(projectKey)||'null')||{version:1,parts:[],wires:[]};
  net.instruments={wires,loop:values(lf),ac:values(af),sensor:values(sf),mode:mode.value};
  sessionStorage.setItem(projectKey,JSON.stringify(net));
 }catch{}
}
try{
 const saved=JSON.parse(sessionStorage.getItem(projectKey)||'null')?.instruments;
 if(saved){wiring(saved.wires);instrument(saved.wires,saved.loop);drive(saved.ac);transducer(saved.sensor);
  wires=structuredClone(saved.wires);draw();
  for(const [fields,data] of [[lf,saved.loop],[af,saved.ac],[sf,saved.sensor]])for(const [key,input] of Object.entries(fields)){if(Object.hasOwn(data,key)){if(input.type==='checkbox')input.checked=data[key];else input.value=data[key];}}
  mode.value=saved.mode==='inject'?'inject':'process';}
}catch{out.textContent='Invalid saved instrument settings. Begin a new measurement.';}
area.addEventListener('change',saveLab);area.addEventListener('click',e=>{if(e.target.tagName==='BUTTON')saveLab();});
