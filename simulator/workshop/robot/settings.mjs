export const defaultPlan = Object.freeze({beltMps:0.04, transferS:2, payloadKg:1, torqueNm:12, rows:2, columns:2, pitchM:0.09});
export const defaultRoute = Object.freeze({goalX:5, goalY:3, slip:0.12, landmarkEvery:2, reliability:'reliable', subscriber:'reliable', dropEvery:3, startYaw:0, blocked:'2,0;2,1;2,2'});
const bounded = (n,lo,hi) => Number.isFinite(n) && n>=lo && n<=hi;
export function requireValue(ok,message){ if(!ok) throw Error(message); }
const numeric=(value,lo,hi,name)=>requireValue(bounded(value,lo,hi),name+' is outside the exercise range.');
const whole=(value,lo,hi,name)=>{numeric(value,lo,hi,name);requireValue(Number.isInteger(value),name+' must be an integer.');};
export function checkPlan(p){
  known(p,defaultPlan);
  numeric(p.beltMps,0,1,'Belt speed');numeric(p.transferS,0.2,10,'Travel time');numeric(p.payloadKg,0,20,'Carton mass');numeric(p.torqueNm,0.1,150,'Torque limit');
  whole(p.rows,1,4,'Rows');whole(p.columns,1,4,'Columns');numeric(p.pitchM,.02,.3,'Pitch');
  return {...defaultPlan,...p};
}
export function checkRoute(p){
  known(p,defaultRoute);
  whole(p.goalX,0,5,'Goal X');whole(p.goalY,0,3,'Goal Y');numeric(p.slip,0,.35,'Wheel slip');
  whole(p.landmarkEvery,0,10,'Landmark interval');whole(p.dropEvery,0,10,'Drop interval');whole(p.startYaw,0,3,'Initial heading');
  requireValue(['reliable','best-effort'].includes(p.reliability)&&['reliable','best-effort'].includes(p.subscriber),'Unknown reliability policy.');
  requireValue(typeof p.blocked==='string' && p.blocked.length<=100 && (!p.blocked||p.blocked.split(';').every(s=>/^[0-5],[0-3]$/.test(s))),'Use semicolon-separated grid coordinates such as 2,0;2,1.');
  return {...defaultRoute,...p};
}

function known(p,shape){requireValue(p && typeof p==='object' && !Array.isArray(p) && Object.keys(p).length===Object.keys(shape).length && Object.keys(p).every(k=>Object.hasOwn(shape,k)),'Unknown or missing configuration field.');}
