import {defaultParameters,simulate} from './experiment.mjs';

export function commissioningCase(id){
  if(id!==1&&id!==2)throw Error('Unknown drive test.');
  return {...defaultParameters,mass:id===1?8:12,setpoint:id===1?.75:.6,drag:id===1?4:5,load:id===1?3:4,kp:4,ki:0};
}

export function commission(id,predictedForce,kp,ki){
  const p=commissioningCase(id);
  if(![predictedForce,kp,ki].every(Number.isFinite))throw Error('Enter a predicted force and both controller gains.');
  const run=simulate({...p,kp,ki}),{time,speed}=run.data;
  const hold=p.drag*p.setpoint+p.load;
  const rise=time.find((t,i)=>speed[i]>=.9*p.setpoint);
  let lastOutside=-1;
  for(let i=0;i<speed.length;i++)if(time[i]>=p.loadAt&&Math.abs(speed[i]-p.setpoint)>.02)lastOutside=i;
  const settled=lastOutside<0?0:lastOutside===speed.length-1?Infinity:time[lastOutside+1]-p.loadAt;
  const overshoot=Math.max(0,Math.max(...speed)/p.setpoint-1);
  const checks=[
    {name:'Steady holding force',pass:Math.abs(predictedForce-hold)<=.05,reading:predictedForce.toFixed(2)+' N predicted',hint:'At constant speed the motor balances drag and the applied load. Multiply drag by the demanded speed, then add the load.'},
    {name:'Reach 90% demand within 1.2 s',pass:rise!==undefined&&rise-p.stepAt<=1.2,reading:rise===undefined?'Demand not reached':(rise-p.stepAt).toFixed(2)+' s',hint:'Inspect the rising trace before the load step. Proportional gain raises the initial demand for motor force.'},
    {name:'Recover to ±0.02 m/s within 3 s',pass:settled<=3,reading:Number.isFinite(settled)?settled.toFixed(2)+' s':'Outside tolerance at end',hint:'Inspect the trace after the load arrives. Integral action compensates a persistent speed error.'},
    {name:'Limit overshoot to 5%',pass:overshoot<=.05,reading:(100*overshoot).toFixed(1)+'%',hint:'If speed peaks above demand, compare the integral and proportional terms. Adjust one gain and run the same case again.'}
  ];
  return {run,checks,pass:checks.every(c=>c.pass)};
}
