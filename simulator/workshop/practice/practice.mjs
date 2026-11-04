import {compileProgram,compileLadder,executeScan,newController} from './plc.mjs';
import {loop,sampling,inspection,circuit} from './experiments.mjs';
import {createProject,step,addCarton,command,scaleAnalogue} from '../model.mjs';
const $=id=>document.getElementById(id), key='oia-workshop-practice-transfer-v1';
let transfer;
try{transfer=JSON.parse(sessionStorage.getItem(key)||'null')||{data:{},records:{}};}catch{transfer={data:{},records:{}};}
const data=transfer.data&&typeof transfer.data==='object'?transfer.data:{};
transfer.data=data;
if(!Array.isArray(data.evidence))data.evidence=[];
let latest=null, epoch=0;
const ST='IF R_TRIG(IN) THEN\n  COUNT := COUNT + 1;\nEND_IF;';
const LAD='NO(IN) -> CTU(COUNT)';
const query='SELECT pallets.id, cartons.lot, postings.quantity\nFROM pallets JOIN cartons ON pallets.carton = cartons.id\nLEFT JOIN postings ON postings.pallet = pallets.id';
const lab={
 plc:['Can five positive scans represent one carton?', 'Run the input pattern as 100 ms scans. The PLC samples inputs, executes the program once and retains its outputs. Compare a level increment with a rising-edge count. IN is the input mapped by the cell.', 'Use 01111100110. Mark each change from 0 to 1. Try IF IN THEN COUNT := COUNT + 1; END_IF; and compare consecutive counts.'],
 circuit:['Does a 24 V supply prove the load is energised?', 'This isolated direct-current circuit has an ideal supply, switch, fuse and load in series. Voltage is measured across the load, current through it. The independent transmitter sends 4-20 mA for 0-100 engineering units.', 'Close the switch. Predict 24 V / 1,200 ohms = 0.020 A. Open the wire and compare the voltmeter and loop injection. Continuity uses a de-energised circuit.'],
 process:['Can the controller recover after a sudden heat load?', 'Tune a first-order thermal plant and observe temperature, demand and actuator output. The loop runs at 0.1 s, the actuator time constant is 1.2 s and the process time constant is 12 s. A synthetic load step starts at 50 s.', 'Start with proportional action only. Increase integral gain and inspect the steady error. Compare anti-windup at high gain, then try disturbance feed-forward.'],
 embedded:['What frequency does the sampled signal appear to have?', 'A synthetic sine wave represents a sensor. Interrupts schedule samples, a first-order digital filter smooths them and a CPU stall can lose samples. A watchdog restarts state after its timeout.', 'Take 10 samples/s of a 7 Hz signal. The samples mimic a 3 Hz signal. Increase the sample rate beyond twice the source frequency.'],
 optical:['Can the same threshold cope with changed lighting?', 'Four synthetic production runs train a two-feature logistic classifier. A separate later run tests it against a fixed dark-area rule. The image is a generated 32 × 24 monochrome crop. Test lighting changes exposure; offset shifts the crop.', 'Dim the light and compare false rejects with the baseline. Restore the previous settings to roll back. False accepts carry your selected cost.'],
 condition:['Does occasional bearing impact change spectral-free vibration evidence?', 'Inspect 128 synthetic acceleration samples per window. Root mean square amplitude and crest factor feed a logistic classifier trained on four runs. Compare it with a crest threshold on a separate run. Outputs are advisory.', 'An infrequent high peak can increase crest factor while barely moving RMS amplitude. Compare costs at a high and low threshold.'],
 sql:['Which intake lot contributed to each posted pallet?', 'Run a read-only Structured Query Language (SQL) query on the packaging record. Cartons, pallets, postings and the last 100 scans are available. One result row is one observation; an absent acknowledgement and an absent posting are different conditions.', 'Join pallets.carton to cartons.id, then use a LEFT JOIN from pallets.id to postings.pallet. Use COUNT(*) or SUM(quantity) to reconcile before and after a retry.']
};
function save(){try{sessionStorage.setItem(key,JSON.stringify(transfer));}catch{$('status').textContent='Session storage unavailable. Export the main project before leaving.';}}
function element(tag,txt){const node=document.createElement(tag);if(txt!==undefined)node.textContent=txt;return node;}
function field(id,label,value,choices){
  const box=element('label',label), tag=choices?'select':id==='program'||id==='query'?'textarea':'input',input=element(tag);
  input.id=id;
  if(choices){for(const text of choices){const opt=element('option',text);opt.value=text;input.append(opt);}}
  else if(tag==='textarea'){input.rows=id==='program'?6:5;}
  else if(typeof value==='number'){input.type='number';input.step='any';}
  else if(typeof value==='boolean'){input.type='checkbox';}
  input.type==='checkbox'?input.checked=value:input.value=value;
  box.append(input);$('controls').append(box);return input;
}
function remember(){const name=$('bench').value; data[name]=Object.fromEntries([...$('controls').querySelectorAll('input,textarea,select')].map(e=>[e.id,e.type==='checkbox'?e.checked:e.value]));save();}
function configure(){
  const name=$('bench').value, d=data[name]||{};
  $('controls').replaceChildren();$('result').textContent='Run the experiment to collect a measurement.';$('visual').replaceChildren();latest=null;epoch++;
  const [q,ex,h]=lab[name];$('question').textContent=q;$('explanation').textContent=ex;$('hint').textContent=h;
  $('apply').hidden=name!=='plc';
  const f=(id,label,v,choices)=>field(id,label,d[id]===undefined?v:typeof v==='number'?Number(d[id]):d[id],choices);
  if(name==='plc'){
    const lang=f('language','Program language','ST',['ST','Ladder']);
    f('program','Controller source',ST);f('pattern','Test input pattern (0 or 1 per scan)','01111100110');
    f('inputSource','Signal source','Test pattern',['Test pattern','Recorded cell scans']);
    lang.onchange=()=>{$('program').value=lang.value==='ST'?ST:LAD;remember();};
    const docs=element('details');docs.append(element('summary','Instructions and supported semantics'),element('p','ST: assignments, IF / THEN / ELSE / END_IF, arithmetic, comparisons, AND, OR, NOT. Retained writable tags: COUNT, RUN, TRIP, MODE, OUTPUT. Inputs: IN, I0, I1, ANALOGUE, SETPOINT. R_TRIG(x), F_TRIG(x), TON(x, seconds), SCALE(mA). Blocks update when their expression executes. Ladder: NO(tag), NC(tag), & series, | parallel, -> COIL(tag) or -> CTU(COUNT). Rungs execute top to bottom. Installing a program retains the cell count and resets its block memory. This educational language has no personnel safety function.'));$('controls').append(docs);
  }
  if(name==='circuit'){
    for(const row of [['supply','Supply (V)',24],['resistance','Load (ohms)',1200],['fuse','Fuse limit (A)',0.1],['closed','Switch closed',true],['broken','Break conductor',false],['mA','Injected transmitter current (mA)',12]])f(...row);
  }
  if(name==='process'){
    for(const row of [['kp','Proportional gain',2],['ki','Integral gain per second',0.3],['kd','Derivative gain (s)',0],['delay','Transport delay (s)',2],['load','Disturbance magnitude (°C equivalent)',15],['setpoint','Setpoint (°C)',55],['antiWindup','Conditional anti-windup',true],['feedForward','Disturbance feed-forward gain',0],['cascade','Enable inner actuator feedback',false]])f(...row);
  }
  if(name==='embedded'){
    for(const row of [['signalHz','Source frequency (Hz)',7],['sampleHz','Sample frequency (Hz)',10],['alpha','Filter weight (0.01-1)',0.4],['stallMs','CPU stall at 1 s (ms)',0],['watchdogMs','Watchdog timeout (ms)',200]])f(...row);
  }
  if(['optical','condition'].includes(name)){
    if(name==='optical'){f('lighting','Lighting multiplier',1);f('offset','Camera offset (pixels)',0);}
    f('threshold','Rejection threshold (0.01-0.99)',0.5);f('falseAcceptCost','Cost of one false acceptance',5);f('seed','First training run',1);
  }
  if(name==='sql'){
    f('dataset','Record source','Current packaging cell',['Current packaging cell','Separate training campaign']);
    f('query','SQL statement',query);
    $('controls').append(element('p','Tables: cartons(id, lot, x, status, startScan, detected), pallets(id, carton, lot, orderId, status, attempts), postings(key, pallet, lot, orderId, quantity), scans(scan, input, count, I0, I1). Use AS for aliases. Results limited to 200 rows.'));
  }
}
function inputs(){return Object.fromEntries([...$('controls').querySelectorAll('input,textarea,select')].map(e=>[e.id,e.type==='checkbox'?e.checked:e.type==='number'?Number(e.value):e.value]));}
function plot(rows,series,unit){
  if(!rows.length)return;
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 500 130');svg.setAttribute('role','img');svg.setAttribute('aria-label',unit+' trend: '+series.join(', '));
  const all=rows.flatMap(r=>series.map(k=>r[k])),min=Math.min(...all),max=Math.max(...all);
  series.forEach((key,i)=>{const line=document.createElementNS(ns,'polyline');line.setAttribute('points',rows.map((r,j)=>`${5+j*490/Math.max(1,rows.length-1)},${120-(r[key]-min)*110/(max-min||1)}`).join(' '));line.setAttribute('stroke',['#085d4a','#b75018','#364985'][i]);line.setAttribute('stroke-width','2');line.setAttribute('fill','none');if(i)line.setAttribute('stroke-dasharray',i===1?'6 3':'2 3');svg.append(line);});
  $('visual').append(svg,element('p',series.map((k,i)=>k+' ('+['solid','dashed','dotted'][i]+')').join(' · ')+' | range '+min.toFixed(2)+' to '+max.toFixed(2)+' '+unit));
}
function image(preview){
  const c=element('canvas');c.width=preview.width;c.height=preview.height;c.setAttribute('aria-label','Monochrome synthetic potato with labelled surface defect');c.setAttribute('role','img');
  const ctx=c.getContext('2d'),img=ctx.createImageData(c.width,c.height);
  preview.pixels.forEach((v,i)=>{for(let ch=0;ch<3;ch++)img.data[i*4+ch]=v;img.data[i*4+3]=255;});ctx.putImageData(img,0,0);$('visual').append(c);
}
function sqlRecords(dataset){
  if(dataset==='Current packaging cell')return transfer.records||{};
  const p=createProject('reference');
  command(p,'releaseOrder',{id:'RUN-04'});
  for(const lot of ['INTAKE-23','INTAKE-24']){addCarton(p,lot);step(p,85);}
  return p.runtime;
}
function sql(records,query){
  return new Promise((resolve,reject)=>{
    const worker=new Worker('./sql-worker.js');
    const timer=setTimeout(()=>{worker.terminate();reject(Error('Query exceeded 4 s. Reduce the join size.'));},4000);
    function finish(){clearTimeout(timer);worker.terminate();}
    worker.onmessage=e=>{finish();e.data.error?reject(Error(e.data.error)):resolve(e.data);};
    worker.onerror=()=>{finish();reject(Error('SQL engine could not load. Open the built workshop containing the offline SQLite runtime.'));};
    worker.postMessage({records,query});
  });
}
async function run(){
  const current=++epoch,name=$('bench').value,p=inputs(),lines=[];latest=null;$('visual').replaceChildren();
  remember();
  try{
    if(name==='plc'){
      const prog=p.language==='ST'?compileProgram(p.program):compileLadder(p.program);
      const recorded=p.inputSource==='Recorded cell scans';
      if(!recorded&&!/^[01]{1,100}$/.test(p.pattern))throw Error('Enter 1-100 binary samples.');
      const seq=recorded?(transfer.records?.scans||[]):Array.from(p.pattern,x=>({input:x==='1',I0:x==='1',I1:false}));
      if(!seq.length)throw Error('Advance the packaging cell, then return to capture its input trace.');
      let state=newController();
      lines.push('Scan | I0 I1 | Count | Run | Trip | Output');
      seq.forEach((r,i)=>{state=executeScan(prog,state,{I0:r.I0,I1:r.I1,IN:r.input,ANALOGUE:12,SETPOINT:50});lines.push([r.scan??i+1,Number(r.I0)+'  '+Number(r.I1),state.COUNT,state.RUN,state.TRIP,state.OUTPUT].join(' | '));});
      const heldOut=['0001110100011110','1000110010101101','1100000010110001'].filter(bits=>bits!==p.pattern).slice(0,2);
      const proof=heldOut.every(bits=>{
        let state=newController(),previous=0,expected=0;
        for(const bit of bits) {
          const input=Number(bit);
          if(input&&!previous)expected++;
          state=executeScan(prog,state,{IN:input,I0:input,I1:0});
          if(state.COUNT!==expected)return false;
          previous=input;
        }
        return true;
      });
      lines.push(proof?'Assessment passed: two unseen patterns counted once per rising edge.':'Counter assessment: compare the count with each 0-to-1 transition on two independent patterns.');
    } else if(name==='circuit'){
      const r=circuit(p),a=scaleAnalogue(p.mA);lines.push('Load voltage: '+r.voltage.toFixed(3)+' V','Series current: '+(r.current*1000).toFixed(2)+' mA','Load power: '+r.power.toFixed(3)+' W','Fuse: '+(r.overcurrent?'open on overcurrent':'intact'),'Continuity: '+(r.continuity===null?'isolate supply to measure':Number.isFinite(r.continuity)?r.continuity+' ohms':'open circuit'),'Transmitter: '+a.value.toFixed(2)+' engineering units, quality '+a.quality);
    } else if(name==='process'){
      const r=loop(p);plot(r.rows,['process','setpoint'],'°C');lines.push('At 120 s: '+r.final.toFixed(2)+' °C; peak: '+r.peak.toFixed(2)+' °C','Integrated absolute error: '+r.absoluteError.toFixed(2)+' °C s','s | setpoint °C | actual °C | controller % | actuator %',...r.rows.filter((_,i)=>i%10===0).map(x=>[x.time,x.setpoint,x.process,x.output,x.actuator].map(n=>n.toFixed(2)).join(' | ')));
    } else if(name==='embedded'){
      const r=sampling(p);plot(r.rows,['signal','filtered'],'normalised');lines.push('Predicted alias: '+r.aliasHz.toFixed(2)+' Hz','Observed positive crossings: '+r.crossings,'Missed scheduled samples: '+r.missed,'Watchdog resets: '+r.resets,'Captured '+r.rows.length+' samples over 2 s.');
    } else if(name==='optical'||name==='condition'){
      const started=performance.now(),r=inspection({...p,kind:name});const elapsed=performance.now()-started;
      name==='optical'?image(r.preview):plot(r.preview.samples.map((v,i)=>({v,i})),['v'],'normalised acceleration');
      lines.push('Training runs: '+r.trainingRuns.join(', ')+' | held-out run: '+r.testRun,'32 test windows, 8 are defective. False rejection cost = 1.','Baseline: '+r.baseline.correct+' correct; false accepts '+r.baseline.falseAccepts+'; false rejects '+r.baseline.falseRejects+'; cost '+r.baseline.cost,'Logistic model: '+r.model.correct+' correct; false accepts '+r.model.falseAccepts+'; false rejects '+r.model.falseRejects+'; cost '+r.model.cost,'Training, data generation and scoring elapsed on this device: '+elapsed.toFixed(1)+' ms','Fitted weights: '+r.weights.map(v=>v.toFixed(3)).join(', '),'Index | actual defect | predicted probability | decision',...r.model.predictions.slice(0,8).map(v=>[v.index,v.defect,v.probability.toFixed(3),v.reject?'reject':'accept'].join(' | ')));
    } else {
      const r=await sql(sqlRecords(p.dataset),p.query);if(current!==epoch)return;
      lines.push(p.dataset,r.columns.join(' | '),...r.values.map(row=>row.map(v=>v??'NULL').join(' | ')),r.values.length+' result rows.');
    }
    latest={name,prediction:$('prediction').value.slice(0,1000),measurement:lines.join('\n').slice(0,4000)};
    $('result').textContent=lines.join('\n');
  }catch(error){if(current===epoch)$('result').textContent=error.message;}
}
function evidence(){
  const list=$('evidence');list.replaceChildren();
  for(const e of data.evidence.filter(e=>e&&typeof e==='object').slice(-8)){list.append(element('li',String(e.name)+' | '+String(e.finding)));}
}
$('bench').onchange=configure;$('run').onclick=run;
$('controls').addEventListener('input',()=>{latest=null;epoch++;});
$('apply').onclick=()=>{try{const p=inputs();p.language==='ST'?compileProgram(p.program):compileLadder(p.program);
  transfer.install={language:p.language,source:p.program};remember();$('status').textContent='Program ready. Return to the workshop to install it on the placed PLC.';
}catch(error){$('status').textContent=error.message;}};
$('capture').onclick=()=>{if(!latest||!$('finding').value.trim()){$('status').textContent='Run an experiment with these settings and write a finding first.';return;}
  if(data.evidence.length>=32){$('status').textContent='The 32-record learning register is full.';return;}
  data.evidence.push({...latest,finding:$('finding').value.slice(0,800)});save();evidence();$('status').textContent='Captured with the current workshop project.';};
configure();evidence();
