import { STEP, inverse, clearance } from './kinematics.mjs';

import {checkPlan,checkRoute,requireValue} from './settings.mjs';
export {defaultPlan,defaultRoute,checkPlan,checkRoute} from './settings.mjs';
export function profile(start,end,t,duration){
  const u=Math.max(0,Math.min(1,t/duration)),d=end-start;
  return {q:start+d*(10*u**3-15*u**4+6*u**5),v:d*(30*u**2-60*u**3+30*u**4)/duration,a:d*(60*u-180*u**2+120*u**3)/duration**2};
}
export function jointTorque(c,q,v,a,load){
  const l1=c.arm.upper,l2=c.arm.fore+c.arm.tcp,lc1=l1/2,lc2=l2/2,m1=2,m2=1;
  const i1=m1*l1*l1/12,i2=m2*l2*l2/12;
  const h=l1*(m2*lc2+load*l2),cos=Math.cos(q[1]),sin=Math.sin(q[1]);
  const m22=i2+m2*lc2**2+load*l2**2;
  const m12=m22+h*cos,m11=i1+m1*lc1**2+(m2+load)*l1**2+m22+2*h*cos;
  return [m11*a[0]+m12*a[1]-h*sin*(2*v[0]*v[1]+v[1]**2),m12*a[0]+m22*a[1]+h*sin*v[0]**2];
}
export function planPallet(c, settings) {
  const p=checkPlan(settings),samples=[],slots=[],events=[];
  const duration=Math.ceil(p.transferS/STEP)*STEP;
  let time=0,q0=[...c.q],maxTorque=0,minClearance=Infinity,peakRate=0,minJacobian=Infinity,delivered=0;
  function travel(target,load,phase,id) {
    const q1=inverse(c,target),count=Math.round(duration/STEP);
    for(let k=0;k<=count;k++){
      const pair=q1.map((q,i)=>profile(q0[i],q,k*STEP,duration)),q=pair.map(s=>s.q),v=pair.map(s=>s.v);
      const tau=jointTorque(c,q,v,pair.map(s=>s.a),load);
      const torque=Math.max(...tau.map(Math.abs)),gap=clearance(c,q),rate=Math.max(...v.map(Math.abs));
      const det=Math.abs(c.arm.upper*(c.arm.fore+c.arm.tcp)*Math.sin(q[1]));
      maxTorque=Math.max(maxTorque,torque);minClearance=Math.min(minClearance,gap);peakRate=Math.max(peakRate,rate);minJacobian=Math.min(minJacobian,det);
      const stamp=time+k*STEP;
      if(k===count || k%5===0)samples.push({timeS:stamp,q,tau,phase,id,clearanceM:gap,jacobianM2:det});
      if(gap<=0)throw Error(phase+' intersects the guard at '+stamp.toFixed(2)+' s');
      if(rate>c.arm.rate+1e-9)throw Error(phase+' exceeds joint rate at '+stamp.toFixed(2)+' s');
      if(torque>p.torqueNm)throw Error(phase+' exceeds joint torque at '+stamp.toFixed(2)+' s');
      if(det<.0001)throw Error(phase+' enters the teaching singularity band at '+stamp.toFixed(2)+' s');
    }
    q0=q1;time+=duration;
    events.push({timeS:time,phase,id,x:target.x,y:target.y});
  }
  try{
    if((p.columns>1&&p.pitchM<.06)||(p.rows>1&&p.pitchM<.05))throw Error('Adjacent carton footprints overlap on the pallet.');
    if((p.columns-1)*p.pitchM+.06>.50||(p.rows-1)*p.pitchM+.05>.40)throw Error('Pattern exceeds the 0.50 × 0.40 m pallet surface.');
    for(let row=0;row<p.rows;row++) for(let col=0;col<p.columns;col++){
      const id=c.carton.id+'-'+(delivered+1);
      const index=row%2?p.columns-1-col:col;
      const slot={x:c.pallet.x+index*p.pitchM,y:c.pallet.y+row*p.pitchM};
      const intercept={x:c.carton.x+p.beltMps*duration,y:c.carton.y};
      travel(intercept,0,'intercept',id); travel(slot,p.payloadKg,'place',id);
      slots.push({id,row,column:index,...slot});delivered++;
    }
  }catch(e){return {pass:false,reason:e.message,samples,slots,events,delivered,maxTorque,minClearance,peakRate,minJacobian};}
  return {pass:true,reason:'Each carton arrived at its allocated slot.',samples,slots,events,delivered,maxTorque,minClearance,peakRate,minJacobian};
}

export function planRoute(settings) {
  const p=checkRoute(settings),stop=new Set(p.blocked?p.blocked.split(';'):[]),goal=p.goalX+','+p.goalY;
  requireValue(!stop.has('0,0')&&!stop.has(goal),'Start or goal is inside an occupied cell.');
  const queue=[[0,0]],parents=new Map([['0,0',null]]);
  for(let i=0;i<queue.length;i++){
    const [x,y]=queue[i],key=x+','+y;
    if(key===goal) break;
    for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){
      const nx=x+dx,ny=y+dy,k=nx+','+ny;
      if(nx<0||nx>5||ny<0||ny>3||stop.has(k)||parents.has(k))continue;
      parents.set(k,key);queue.push([nx,ny]);
    }
  }
  requireValue(parents.has(goal),'No four-neighbour route exists to this goal.');
  const route=[];
  for(let key=goal;key!==null;key=parents.get(key))route.push(key.split(',').map(Number));
  return route.reverse();
}
export function newMission(settings) {
  const p=checkRoute(settings);
  return {settings:p,route:planRoute(p),index:0,heading:p.startYaw,truth:[0,0],odom:[0,0],mapToOdom:[0,0],variance:.01,timeS:0,elapsedTicks:0,
    state:(p.goalX||p.goalY)?'accepted':'succeeded',feedback:[],events:['0.00 s /navigate goal accepted'],published:0,received:0,dropped:0};
}
export function cancelMission(m) {
  requireValue(['accepted','executing'].includes(m.state),'Only an active goal can be cancelled.');
  m.state='cancelled';m.events.push(m.timeS.toFixed(2)+' s /navigate cancel accepted');
}
export const estimate=m=>m.odom.map((v,i)=>v+m.mapToOdom[i]);
export function vehicleStep(m) {
  if(!['accepted','executing'].includes(m.state))return;
  m.state='executing';m.elapsedTicks++;m.timeS=m.elapsedTicks*.1;
  const p=m.settings,target=m.route[m.index+1],from=m.route[m.index],dx=target[0]-from[0],dy=target[1]-from[1],direction=dx===1?0:dy===1?1:dx===-1?2:3;
  if(m.heading!==direction) {
    m.heading=(m.heading+(((direction-m.heading+4)%4===3)?3:1))%4;
    m.events.push(m.timeS.toFixed(2)+' s rotate in place');return;
  }
  const axis=dx?0:1,sign=dx||dy;
  const remaining=(target[axis]-estimate(m)[axis])*sign;
  const commanded=Math.min(.05,Math.max(0,remaining));
  m.odom[axis]+=sign*commanded;
  m.truth[axis]+=sign*commanded*(1-p.slip);
  m.variance+=commanded*.02;
  for(const cell of p.blocked?p.blocked.split(';'):[]){
    const [cx,cy]=cell.split(',').map(Number);
    const gap=Math.hypot(Math.max(0,Math.abs(m.truth[0]-cx)-.5),Math.max(0,Math.abs(m.truth[1]-cy)-.5));
    if(gap<.15){m.state='aborted';m.events.push(m.timeS.toFixed(2)+' s physical chassis entered the obstacle clearance envelope');return;}
  }
  m.published++;
  const match=p.reliability==='reliable'||p.subscriber==='best-effort';
  const drop=p.dropEvery>0&&m.published%p.dropEvery===0;
  let transport=match?'delivered':'incompatible QoS';
  if(match&&drop&&p.reliability==='best-effort'){m.dropped++;transport='lost';}
  if(match&&drop&&p.reliability==='reliable')transport='retransmitted';
  if(match && transport!=='lost')m.received++;
  const update=match&&transport!=='lost'&&p.landmarkEvery&&m.published%p.landmarkEvery===0;
  if(update){
    const gain=m.variance/(m.variance+.0025),before=estimate(m);
    m.mapToOdom=m.mapToOdom.map((n,i)=>n+gain*(m.truth[i]-before[i]));
    m.variance*=(1-gain);
  }
  m.feedback.push({stampS:m.timeS,topic:'/wheel/odom',frame:'odom',truth:[...m.truth],estimate:estimate(m),heading:m.heading,transport,landmark:!!update});
  if((target[axis]-estimate(m)[axis])*sign<=.01){
    m.index++;
    m.events.push(m.timeS.toFixed(2)+' s /navigate feedback cell '+target);
    if(m.index===m.route.length-1){
      m.state='succeeded';m.events.push(m.timeS.toFixed(2)+' s action reported goal reached');
    }
  }
  if(m.elapsedTicks>=3000 && m.state==='executing') {m.state='aborted';m.events.push('300.00 s action timed out');}
}
export function routeAssessment(m){
  const physicalError=Math.hypot(m.truth[0]-m.settings.goalX,m.truth[1]-m.settings.goalY);
  return {physicalError,pass:m.state==='succeeded'&&physicalError<=.10&&m.received>0};
}
