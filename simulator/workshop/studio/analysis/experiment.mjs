export const defaultParameters=Object.freeze({
  duration:12,period:0.02,initial:0,setpoint:0.75,stepAt:0.5,
  mass:8,drag:4,kp:24,ki:12,limit:16,load:3,loadAt:6,mode:'closed'
});
export const limits={duration:[.2,120],period:[.002,.5],initial:[0,5],setpoint:[0,5],stepAt:[0,120],
  mass:[.1,250],drag:[0,100],kp:[0,1000],ki:[0,2000],limit:[.1,1000],load:[0,1000],loadAt:[0,120]};
export const observable={
  speed:{name:'Belt speed',unit:'m/s'},target:{name:'Speed demand',unit:'m/s'},
  position:{name:'Belt travel',unit:'m'},drive:{name:'Drive force',unit:'N'},
  resistance:{name:'Applied load',unit:'N'},error:{name:'Tracking error',unit:'m/s'}
};
const valid=(condition,message)=>{if(!condition)throw Error(message);};
export function validate(p){
  valid(p&&['closed','coast'].includes(p.mode),'Select a supported controller mode.');
  for(const [key,[min,max]] of Object.entries(limits))valid(Number.isFinite(p[key])&&p[key]>=min&&p[key]<=max,key+' must be between '+min+' and '+max+'.');
  valid(p.period<=p.duration,'The control period exceeds the experiment duration.');
  valid(Math.ceil(p.duration/p.period)<=12000,'Use at most 12,000 steps. Increase the sample period or shorten the run.');
  return {...Object.fromEntries(Object.keys(limits).map(k=>[k,p[k]])),mode:p.mode};
}
function integrate(speed,force,dt,mass,drag){
  let horizon=dt;
  if(force<0&&speed<=0)return {speed:0,travel:0};
  if(force<0){
    const toStop=drag?mass/drag*Math.log1p(drag*speed/-force):mass*speed/-force;
    horizon=Math.min(dt,toStop);
  }
  const a=(force-drag*speed)/mass;
  let delta,travel;
  if(drag===0){delta=a*horizon;travel=speed*horizon+.5*a*horizon*horizon;}
  else{
    const tau=mass/drag,z=horizon/tau,term=-Math.expm1(-z);
    delta=a*tau*term;
    const integral=z<.0001?horizon*horizon*(.5-z/6+z*z/24):tau*(horizon-tau*term);
    travel=speed*horizon+a*integral;
  }
  return {speed:horizon<dt?0:Math.max(0,speed+delta),travel:Math.max(0,travel)};
}
export function simulate(parameters=defaultParameters){
  const p=validate(parameters),n=Math.ceil(p.duration/p.period),data={time:[],speed:[],target:[],position:[],drive:[],resistance:[],error:[]};
  let speed=p.initial,position=0,integral=0,peak=speed,iae=0,saturatedSeconds=0;
  for(let i=0;i<=n;i++){
    const t=i===n?p.duration:i*p.period,dt=i===n?0:Math.min(p.period,p.duration-t);
    const target=t+1e-12>=p.stepAt?p.setpoint:p.initial,load=t+1e-12>=p.loadAt?p.load:0,error=target-speed;
    const raw=p.kp*error+integral,drive=p.mode==='coast'?0:Math.max(-p.limit,Math.min(p.limit,raw));
    if(p.mode==='closed'&&Math.abs(drive)>=p.limit)saturatedSeconds+=dt;
    if(p.mode==='closed'&&!(raw>=p.limit&&error>0)&&!(raw<=-p.limit&&error<0))integral+=p.ki*error*dt;
    const sample={time:t,speed,target,position,drive,resistance:load,error};
    for(const key of Object.keys(data))data[key].push(sample[key]);
    iae+=Math.abs(error)*dt;peak=Math.max(peak,speed);
    const next=integrate(speed,drive-load,dt,p.mass,p.drag);speed=next.speed;position+=next.travel;
  }
  return {parameters:p,data,metrics:{peak,travel:position,iae,saturatedSeconds,finalSpeed:data.speed.at(-1),samples:n+1}};
}
export function sweep(parameters,key,values){
  valid(['kp','ki','load','mass'].includes(key),'Choose a supported sweep parameter.');
  valid(Array.isArray(values)&&values.length>=2&&values.length<=5&&new Set(values).size===values.length,'Enter two to five distinct sweep values.');
  return values.map(value=>simulate({...parameters,[key]:value}));
}
export function sampleAt(run,time){
  const data=run.data.time;valid(Number.isFinite(time)&&time>=0&&time<=data.at(-1)+1e-9,'Time outside run.');
  let lo=0,hi=data.length-1;while(lo<hi){const mid=Math.floor((lo+hi)/2);if(data[mid]<time)lo=mid+1;else hi=mid;}
  return lo>0&&time-data[lo-1]<=data[lo]-time?lo-1:lo;
}
export function csv(runs){
  valid(runs.length>0,'Show at least one run before exporting.');
  const headers=['run','mode',...Object.keys(limits),'time_s',...Object.keys(observable).map(k=>k+'_'+observable[k].unit.replace('/','_per_'))];
  const lines=[headers.join(',')];
  for(const {id,result:r} of runs){
    valid(Number.isSafeInteger(id)&&id>0,'Invalid run ID.');
    const meta=[id,r.parameters.mode,...Object.keys(limits).map(k=>r.parameters[k])].join(',');
    for(let i=0;i<r.data.time.length;i++)lines.push(meta+','+[r.data.time[i],...Object.keys(observable).map(k=>r.data[k][i])].map(n=>Number(n.toPrecision(12))).join(','));
  }
  return lines.join('\r\n')+'\r\n';
}
