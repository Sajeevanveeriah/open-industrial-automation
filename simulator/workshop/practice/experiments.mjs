function range(v,min,max,name) {
  if (!Number.isFinite(v)||v<min||v>max) throw Error(name+' must be between '+min+' and '+max+'.');
  return v;
}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function loop({kp=2,ki=0.3,kd=0,delay=2,load=15,setpoint=55,antiWindup=true,feedForward=0,cascade=false}={}) {
  range(kp,0,20,'Kp');range(ki,0,10,'Ki');range(kd,0,10,'Kd');range(delay,0,10,'Delay');range(load,0,50,'Load');
  range(setpoint,20,90,'Setpoint');range(feedForward,0,2,'Feed-forward');
  const dt=0.1,dead=Math.round(delay/dt),line=Array(dead).fill(0),rows=[];
  let process=20,integral=0,previous=20,actuator=0,absoluteError=0;
  for(let i=0;i<=1200;i++) {
    const time=i*dt, disturbance=time>=50?load:0, error=setpoint-process;
    const derivative=-(process-previous)/dt;
    const free=kp*error+integral+kd*derivative+feedForward*disturbance;
    const output=clamp(free,0,100);
    if(!antiWindup || free===output || (free-output)*error<0) integral+=ki*error*dt;
    const delivered=dead ? line.shift():output; if(dead) line.push(output);
    const command=cascade?clamp(delivered+2*(delivered-actuator),0,100):delivered;
    actuator+=(command-actuator)*dt/1.2;
    previous=process;process+=(20+actuator-disturbance-process)*dt/12;
    absoluteError+=Math.abs(error)*dt;
    if(i%10===0) rows.push({time,setpoint,process:previous,output,actuator,disturbance});
  }
  return {rows,absoluteError,final:rows.at(-1).process,peak:Math.max(...rows.map(x=>x.process))};
}
export function sampling({signalHz=7,sampleHz=10,alpha=0.4,stallMs=0,watchdogMs=200}={}) {
  range(signalHz,0.1,100,'Signal frequency');range(sampleHz,1,200,'Sample frequency');
  range(alpha,0.01,1,'Filter weight');range(stallMs,0,500,'CPU stall');range(watchdogMs,10,1000,'Watchdog');
  const rows=[];let filtered=0,previous=-Infinity,crossings=0,queued=0,boot=0,resets=0;
  for(let i=0;i<sampleHz*2;i++) {
    const time=i/sampleHz,stalled=time>=1&&time<1+stallMs/1000;
    if(stalled) {queued++;if(time-boot>=watchdogMs/1000){resets++;boot=time;filtered=0;}continue;}
    boot=time;
    const signal=Math.sin(2*Math.PI*signalHz*time+0.21);
    filtered+=alpha*(signal-filtered);
    if(previous<=0&&signal>0&&Number.isFinite(previous))crossings++;
    previous=signal;
    rows.push({time,signal,filtered});
  }
  return {rows,crossings,missed:queued,resets,aliasHz:Math.abs(signalHz-sampleHz*Math.round(signalHz/sampleHz))};
}
function random(seed) {
  let s=seed>>>0;
  return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
}
export function observation(run,index,lighting=1,kind='optical',offset=0) {
  const rng=random(run*10007+index*97+7);
  const defect=(index+run)%4===0;
  const feature=[];
  if(kind==='condition') {
    const samples=[],amp=0.75+0.35*rng();
    for(let t=0;t<128;t++) samples.push(amp*Math.sin(2*Math.PI*t/16)+(rng()-0.5)*0.2+(defect&&t%17===0?2.3:0));
    const rms=Math.sqrt(samples.reduce((s,v)=>s+v*v,0)/samples.length),crest=Math.max(...samples.map(Math.abs))/rms;
    return {run,index,defect,samples,features:[rms,crest/4],kind};
  }
  const width=32,height=24,pixels=new Uint8Array(width*height),cx=16+offset,patchX=cx-3+rng()*6,patchY=11+rng()*3;
  let sum=0,dark=0,contrast=0,count=0,min=255;
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const inside=((x-cx)/11)**2+((y-12)/8)**2<1;
    const spot=defect&&((x-patchX)**2+(y-patchY)**2)<9;
    let v=inside ? (spot?54:155)+30*rng() : 18+5*rng();
    v=Math.round(clamp(v*lighting,0,255));
    pixels[y*width+x]=v;
    if(inside){sum+=v;dark+=Number(v<100);min=Math.min(min,v);count++;}
  }
  contrast=count?(sum/count-min)/Math.max(1,sum/count):0;
  feature.push(count?dark/count:0,contrast);
  return {run,index,defect,pixels,width,height,features:feature,kind};
}
const sigmoid=x=>1/(1+Math.exp(-clamp(x,-40,40)));
export function inspection({kind='optical',lighting=1,offset=0,threshold=0.5,falseAcceptCost=5,seed=1}={}) {
  range(lighting,0.1,2,'Lighting');range(offset,-16,16,'Camera offset');range(threshold,0.01,0.99,'Threshold');
  range(falseAcceptCost,0,1000,'False acceptance cost');range(seed,1,100000,'Run seed');
  const train=[],test=[],weights=[0,0,0];
  for(let run=seed;run<seed+4;run++) for(let i=0;i<20;i++)train.push(observation(run,i,0.9+(run%3)*0.1,kind));
  for(let i=0;i<32;i++) test.push(observation(seed+4,i,lighting,kind,offset));
  for(let epoch=0;epoch<120;epoch++)for(const row of train){
    const [x,y]=row.features,delta=Number(row.defect)-sigmoid(weights[0]+weights[1]*x+weights[2]*y);
    weights[0]+=0.08*delta;weights[1]+=0.08*delta*x;weights[2]+=0.08*delta*y;
  }
  function score(useModel) {
    const result={falseAccepts:0,falseRejects:0,correct:0,predictions:[]};
    for(const row of test) {
      const [x,y]=row.features;
      const probability=useModel?sigmoid(weights[0]+weights[1]*x+weights[2]*y):kind==='condition'?clamp(y,0,1):clamp(x*6,0,1);
      const reject=probability>=threshold;
      if(reject===row.defect) result.correct++;
      else if(row.defect) result.falseAccepts++;
      else result.falseRejects++;
      result.predictions.push({index:row.index,probability,reject,defect:row.defect});
    }
    result.cost=result.falseAccepts*falseAcceptCost+result.falseRejects;
    return result;
  }
  return {trainingRuns:[seed,seed+1,seed+2,seed+3],testRun:seed+4,weights,baseline:score(false),model:score(true),preview:test.find(r=>r.defect)};
}
export function circuit({supply=24,resistance=1200,fuse=0.1,closed=true,broken=false}={}) {
  range(supply,0,48,'Simulated supply');range(resistance,1,100000,'Resistance');range(fuse,0.001,5,'Fuse rating');
  const demand=supply/resistance,overcurrent=closed&&!broken&&demand>fuse;
  const current=closed&&!broken&&!overcurrent?demand:0;
  return {current,voltage:current*resistance,power:current*(current*resistance),overcurrent,
    continuity:supply===0 ? closed&&!broken?resistance:Infinity:null};
}
