import {checkPlan,checkRoute} from './settings.mjs';
export const STEP=.02;
const TAU=2*Math.PI,rad=Math.PI/180,limit=50000,phases=['idle','toPick','grip','toPlace','release','complete','fault'];
function requireThat(value,message){if(!value)throw Error(message);}
const bounded=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
const integer=(n,min,max)=>Number.isInteger(n)&&bounded(n,min,max);
const point=p=>p&&bounded(p.x,-10,10)&&bounded(p.y,-10,10);
const joints=q=>Array.isArray(q)&&q.length===2&&q.every(x=>bounded(x,-Math.PI,Math.PI));
const identifier=s=>typeof s==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(s);
export function newCell(){
  return {format:'oia.robot',version:1,base:{x:0,y:0,yaw:0},arm:{upper:.6,fore:.4,tcp:.08,rate:1.4,branch:1},
    stations:{pick:{x:.78,y:.15},place:{x:.30,y:.78}},carton:{id:'CASE-001',x:.78,y:.15},pallet:{id:'PAL-001',x:.30,y:.78},
    keepout:{x:-.60,y:.2,r:.10},signals:{vacuum:true,ready:true,delay:5},q:[0,Math.PI/2],tick:0,started:null,phase:'idle',resume:null,wait:0,gripped:false,palletised:[],fault:null,events:[],trail:[]};
}
export function forward(c,q=c.q){
  const {x,y,yaw}=c.base,{upper,fore,tcp}=c.arm,a=yaw+q[0],b=a+q[1];
  const elbow={x:x+upper*Math.cos(a),y:y+upper*Math.sin(a)};
  const wrist={x:elbow.x+fore*Math.cos(b),y:elbow.y+fore*Math.sin(b)};
  return {base:{x,y},elbow,wrist,tip:{x:wrist.x+tcp*Math.cos(b),y:wrist.y+tcp*Math.sin(b)}};
}
export function inverse(c,target){
  const {upper,fore,tcp,branch}=c.arm,l=fore+tcp;
  const x=target.x-c.base.x,y=target.y-c.base.y,d=(x*x+y*y-upper*upper-l*l)/(2*upper*l);
  requireThat(Math.abs(d)<=1+1e-10,'Target outside annular reach');
  const b=branch*Math.acos(Math.min(1,Math.max(-1,d))),a=Math.atan2(y,x)-c.base.yaw-Math.atan2(l*Math.sin(b),upper+l*Math.cos(b));
  const first=Math.atan2(Math.sin(a),Math.cos(a));requireThat(Math.abs(b)<=170*rad,'Elbow exceeds the 170° joint limit');
  return [first,b];
}
function distanceToSegment(p,a,b){
  const x=b.x-a.x,y=b.y-a.y,den=x*x+y*y;
  const t=den?Math.max(0,Math.min(1,((p.x-a.x)*x+(p.y-a.y)*y)/den)):0;
  return Math.hypot(p.x-a.x-t*x,p.y-a.y-t*y);
}
export function clearance(c,q=c.q){
  const f=forward(c,q),p=c.keepout;
  return Math.min(distanceToSegment(p,f.base,f.elbow),distanceToSegment(p,f.elbow,f.tip))-p.r-.025;
}
export function calibrate(c,fiducial){
  const {wrist}=forward(c),angle=c.base.yaw+c.q[0]+c.q[1];
  const x=fiducial.x-wrist.x,y=fiducial.y-wrist.y;
  const tcp=x*Math.cos(angle)+y*Math.sin(angle);
  requireThat(Math.abs(-x*Math.sin(angle)+y*Math.cos(angle))<=.001,'Fiducial is more than 1 mm off the tool axis');
  requireThat(bounded(tcp,0,.5),'Tool offset outside 0 to 0.5 m');return tcp;
}
function note(c,message){c.events.push({tick:c.tick,message});c.events=c.events.slice(-120);}
function record(c){
  const f=forward(c);c.trail.push({tick:c.tick,q:[...c.q],x:f.tip.x,y:f.tip.y,phase:c.phase});c.trail=c.trail.slice(-2000);
}
function fail(c,message){c.fault=message;c.resume=c.phase;c.phase='fault';note(c,message);}
export function start(c){
  requireThat(c.phase==='idle','Reset the run to start a fresh carton.');
  c.started=c.tick;c.phase='toPick';note(c,'Controller requested pick');record(c);
}
export function recover(c){
  requireThat(c.phase==='fault'&&c.resume,'No active fault.');
  c.phase=c.resume;c.resume=null;c.fault=null;c.wait=0;note(c,'Fault reset; retry current operation');
}
export function reset(c){
  Object.assign(c,{tick:0,started:null,phase:'idle',resume:null,wait:0,gripped:false,palletised:[],fault:null,events:[],trail:[],q:[0,Math.PI/2]});
}
function move(c,target){
  const desired=inverse(c,target),delta=desired.map((x,i)=>x-c.q[i]),peak=Math.max(...delta.map(Math.abs));
  const fraction=peak===0?1:Math.min(1,c.arm.rate*STEP/peak);
  const next=c.q.map((x,i)=>x+fraction*delta[i]);
  for(const ratio of [.25,.5,.75,1]){
    const q=c.q.map((x,i)=>x+(next[i]-x)*ratio);
    requireThat(clearance(c,q)>0,'Guard clearance breached');
  }
  c.q=next;return fraction===1;
}
export function step(c,n=1){
  requireThat(integer(n,1,5000),'Invalid number of 20 ms steps.');
  for(let i=0;i<n;i++){
    if(['idle','complete','fault'].includes(c.phase))break;
    requireThat(c.tick<limit,'Run limit reached');c.tick++;
    try{
      if(c.phase==='toPick'&&move(c,c.stations.pick)){c.phase='grip';c.wait=0;note(c,'At pick; requested vacuum');}
      else if(c.phase==='grip'){
        c.wait++;
        if(!c.signals.ready&&c.wait>=100)throw Error('PLC ready handshake timed out');
        if(c.signals.ready&&c.wait>=c.signals.delay){
          requireThat(c.signals.vacuum,'Vacuum feedback missing');
          const tip=forward(c).tip;requireThat(Math.hypot(tip.x-c.carton.x,tip.y-c.carton.y)<=.02,'No carton within 20 mm of tool');
          c.gripped=true;c.phase='toPlace';note(c,'Vacuum confirmed; carton attached');
        }
      }else if(c.phase==='toPlace'){
        requireThat(c.signals.vacuum,'Vacuum lost during travel');
        if(move(c,c.stations.place)){c.phase='release';note(c,'Release requested');}
      }else if(c.phase==='release'){
        requireThat(c.signals.vacuum,'Vacuum lost before placement confirmation');
        const tip=forward(c).tip;requireThat(Math.hypot(tip.x-c.pallet.x,tip.y-c.pallet.y)<=.03,'Pallet centre outside 30 mm placement tolerance');
        requireThat(c.gripped&&!c.palletised.includes(c.carton.id),'Invalid carton identity at transfer');
        c.palletised.push(c.carton.id);c.gripped=false;c.phase='complete';note(c,'Placed '+c.carton.id+' on '+c.pallet.id);
      }
    }catch(e){fail(c,e.message);}
    record(c);
  }
  return c.phase;
}
export function validateCell(c){
  const plain=(obj,fields)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&Object.keys(obj).every(k=>fields.includes(k));
  const shape=newCell();requireThat(plain(c,[...Object.keys(shape),'advanced']),'Unknown robot project field.');
  if(c.advanced!==undefined){
    const d=c.advanced;
    requireThat(plain(d,['plan','route','ticks','cancelled']) && integer(d.ticks,0,3000) && typeof d.cancelled==='boolean','Invalid advanced practice checkpoint.');
    checkPlan(d.plan);checkRoute(d.route);
  }
  for(const key of ['base','arm','stations','carton','pallet','keepout','signals'])requireThat(plain(c[key],Object.keys(shape[key])),'Unknown robot configuration field.');
  requireThat(['pick','place'].every(k=>plain(c.stations[k],['x','y'])),'Unknown target frame field.');
  requireThat(c?.format==='oia.robot'&&c.version===1&&point(c.base)&&bounded(c.base.yaw,-TAU,TAU),'Invalid cell format or base frame.');
  const a=c.arm;requireThat(a&&bounded(a.upper,.05,3)&&bounded(a.fore,.05,3)&&bounded(a.tcp,0,.5)&&bounded(a.rate,.05,4)&&[-1,1].includes(a.branch),'Invalid link dimensions or joint rate.');
  requireThat(point(c.stations?.pick)&&point(c.stations.place)&&point(c.carton)&&point(c.pallet)&&identifier(c.carton.id)&&identifier(c.pallet.id),'Invalid target or material identity.');
  requireThat(point(c.keepout)&&bounded(c.keepout.r,.005,2)&&joints(c.q)&&Math.abs(c.q[1])<=170*rad,'Invalid guard or joint pose.');
  requireThat(typeof c.signals?.ready==='boolean'&&typeof c.signals.vacuum==='boolean'&&integer(c.signals.delay,1,100),'Invalid handshake state.');
  requireThat(integer(c.tick,0,limit)&&(c.started===null||integer(c.started,0,c.tick))&&phases.includes(c.phase)&&integer(c.wait,0,50000)&&typeof c.gripped==='boolean','Invalid controller runtime.');
  requireThat(Array.isArray(c.palletised)&&c.palletised.length<=1&&c.palletised.every(id=>id===c.carton.id),'Invalid pallet register.');
  requireThat((c.phase==='complete')===(c.palletised.length===1)&&(c.phase==='fault'?(typeof c.fault==='string'&&c.fault.length<=160&&['toPick','grip','toPlace','release'].includes(c.resume)):c.fault===null&&c.resume===null),'Inconsistent first-out record.');
  requireThat(c.gripped===['toPlace','release'].includes(c.phase==='fault'?c.resume:c.phase),'Inconsistent vacuum state.');
  requireThat(Array.isArray(c.events)&&c.events.length<=120&&c.events.every((e,i)=>plain(e,['tick','message'])&&integer(e.tick,i?c.events[i-1].tick:0,c.tick)&&typeof e.message==='string'&&e.message.length<180),'Invalid log.');
  requireThat(Array.isArray(c.trail)&&c.trail.length<=2000&&c.trail.every((v,i)=>plain(v,['tick','q','x','y','phase'])&&integer(v.tick,i?c.trail[i-1].tick+1:0,c.tick)&&point(v)&&joints(v.q)&&phases.includes(v.phase)),'Invalid trajectory.');
  requireThat(c.phase==='idle'?(c.started===null&&c.tick===0&&c.events.length===0&&c.trail.length===0):c.started!==null,'Invalid controller start time.');
  requireThat(c.phase!=='complete'||c.events.some(e=>e.message==='Placed '+c.carton.id+' on '+c.pallet.id),'Missing transfer evidence.');
  return c;
}
export function importRecording(text){
  requireThat(typeof text==='string'&&text.length<=4_000_000,'Recording exceeds 4 MB.');const x=JSON.parse(text);
  requireThat(x?.schema==='oia.engine-run/1'&&x.scenario==='packaging-pilot/1'&&x.source==='isaac-sim'&&x.units==='SI'&&x.upAxis==='Z'&&x.frame==='cell','Unsupported scenario, engine or frame.');
  requireThat(typeof x.engineVersion==='string'&&x.engineVersion.length>0&&x.engineVersion.length<=100&&typeof x.runId==='string'&&x.runId.length>0&&x.runId.length<=100,'Missing engine or run identity.');
  requireThat(Number.isFinite(x.stepSeconds)&&Math.abs(x.stepSeconds-1/60)<=1e-12&&Number.isFinite(x.wallSeconds)&&x.wallSeconds>0&&(x.vrAMMiB===null||bounded(x.vrAMMiB,0,1000000)),'Invalid run metrics.');
  requireThat(Array.isArray(x.samples)&&x.samples.length===241&&x.samples.every((s,i)=>Number.isFinite(s.timeS)&&Math.abs(s.timeS-i/60)<=1e-8&&bounded(s.cartonXM,-100,100)&&bounded(s.robotJointRad,-TAU*2,TAU*2)&&typeof s.sensorHigh==='boolean'),'Invalid timestamped samples.');
  return x;
}
