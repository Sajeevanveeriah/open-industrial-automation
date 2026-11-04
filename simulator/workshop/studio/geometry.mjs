import {analyse} from './part/part-model.mjs';
import {forward} from '../robot/kinematics.mjs';

const metal='#92a4ac', dark='#324650',frame='#536973',orange='#df882e',blue='#326885',black='#273741';
export function moveField(type){
  return {bracket:['x',-100,100],sensor:['x',-100,100],robot:['target',0,100],conveyor:['length',.1,100]}[type]||null;
}
export function movedParameter(asset,delta,snap=.05){
  const field=moveField(asset.type);if(!field||!Number.isFinite(delta))return null;
  const [name,min,max]=field,n=Math.max(min,Math.min(max,Math.round((asset[name]+delta)/snap)*snap));
  return {[name]:Number(n.toFixed(5))};
}
const authoredMeshes=new WeakMap();
function authoredBracket(project,bracket){
  const part=project.extensions?.studioPart;
  if(!part||part.mount?.assetId!==bracket.id||part.mount.frame!=='bracket'||part.mount.units!=='m')return null;
  if(!authoredMeshes.has(part)){
    try{authoredMeshes.set(part,analyse(part).mesh);}catch{authoredMeshes.set(part,null);}
  }
  return authoredMeshes.get(part);
}
export function metricDistance(a,b){return Math.hypot(...a.map((v,i)=>v-b[i]));}
export function describeCell(project){
  const parts=[],labels=[],datums=[],assets=project.assets,run=project.runtime;
  const find=type=>assets.find(a=>a.type===type);
  const belt=find('conveyor'),bracket=find('bracket'),eye=find('sensor'),robot=find('robot'),rack=find('switch');
  const length=belt?.length||4,target=robot?.target??2;
  const connected=(a,port,b,input)=>a&&b&&project.links.some(l=>l.from===a.id&&l.port===port&&l.to===b.id&&l.input===input);
  const bracketOn=connected(belt,'track',bracket,'base'),eyeOn=bracketOn&&connected(bracket,'mount',eye,'base');
  let owner=null,id=0;
  const piece=(kind,at,size,colour,extra={})=>parts.push({key:(owner??'site')+':'+id++,owner,kind,at,size,colour,...extra});
  const box=(at,size,colour,extra)=>piece('box',at,size,colour,extra);
  const rod=(a,b,diameter,colour)=>{const v=a.map((n,i)=>b[i]-n),l=Math.hypot(...v);if(l>.00001)piece('rod',a.map((n,i)=>(n+b[i])/2),[diameter,l,diameter],colour,{direction:v.map(n=>n/l)});};
  const dot=(x,y,z,d,col)=>piece('sphere',[x,y,z],[d,d,d],col);
  const bind=(asset,at)=>{owner=asset.id;id=0;labels.push({id:owner,type:asset.type,at});};
  if(belt){
    datums.push({id:belt.id+'-start',label:belt.id+' · belt entry',point:[0,0,.80]},{id:belt.id+'-end',label:belt.id+' · belt exit',point:[length,0,.80]});
    bind(belt,[length/2,0,1.06]);const deck=.80;
    box([length/2,0,deck],[length,.61,.07],'#47676a');
    for(const y of [-.36,.36]){
      box([length/2,y,deck-.04],[length+.10,.07,.17],metal);
      box([length/2,y,deck+.13],[length,.025,.035],'#adc2c8');
      for(const x of [length*.09,length*.91]){
        box([x,y,.36],[.075,.075,.7],frame);box([x,y,.044],[.17,.14,.045],black);
        rod([x,y,.58],[Math.min(length,x+.27),y,.74],.035,metal);
        box([x,y,.865],[.03,.03,.18],frame);
      }
    }
    const rollers=Math.max(3,Math.min(36,Math.round(length/.20)));
    for(let i=0;i<rollers;i++){
      const x=length*i/(rollers-1);rod([x,-.34,deck+.026],[x,.34,deck+.026],.075,metal);
    }
    rod([length,-.34,.76],[length,-.60,.76],.15,blue);
    box([length,-.48,.89],[.13,.13,.08],dark);
  }
  const sx=bracketOn?bracket.x:bracket?.x??0;
  if(bracket){
    bind(bracket,[sx,-.47,1.08]);
    const y=bracketOn?-.40:-1,z=bracketOn?.8:.15;
    const mesh=authoredBracket(project,bracket);
    if(mesh){piece('solid',[sx,y,z],[1,1,1],metal,{mesh});}
    else{
    box([sx,y,z],[Math.max(.04,bracket.width),.17,.038],metal);
    box([sx,y-.07,z+.12],[Math.max(.04,bracket.width),.025,.24],metal);
    for(const sign of [-1,1])dot(sx+sign*bracket.width*.32,y,z+.025,.024,black);
    }
    datums.push({id:bracket.id+'-datum',label:bracket.id+' · mounting datum',point:[sx,y,z]});
  }
  if(eye){
    const x=eyeOn?sx+eye.x:eye.x,y=eyeOn?-.44:-1.1,z=eyeOn?1.025:.35;
    datums.push({id:eye.id+'-datum',label:eye.id+' · optical face',point:[x,y+.073,z]});
    bind(eye,[x,y,z+.15]);box([x,y,z],[.14,.092,.11],blue);rod([x,y+.045,z],[x,y+.073,z],.067,black);
    dot(x+.035,y,z+.059,.024,run.lastInput?'#9cdf76':'#e6aa3e');
    if(eyeOn)rod([x,y+.074,z],[x,.37,z],.009,run.lastInput?'#e59024':'#ac6754');
  }
  const plc=find('plc');
  if(plc){
    const x=-.60,y=.95;bind(plc,[x,y,1.36]);
    box([x,y,.62],[.66,.37,1.18],'#9aa9ac');box([x,y-.19,.93],[.53,.035,.33],dark);
    for(let i=0;i<5;i++){box([x-.18+i*.09,y-.22,.94],[.07,.05,.24],i===0?blue:frame);dot(x-.18+i*.09,y-.25,1.01,.024,i===0||run.lastInput?'#94c976':'#617779');}
    box([x,y-.2,.43],[.45,.045,.24],metal);
  }
  for(const [i,type] of ['switch','erp','viewer','hmi'].entries()){
    const a=find(type);if(!a)continue;
    const x=type==='hmi'?length+.45:-.8+i*.72,y=type==='hmi'?-.65:1.8;bind(a,[x,y,1.15]);
    if(type==='viewer'||type==='hmi'){
      box([x,y,.48],[.08,.08,.92],frame);box([x,y,.03],[.39,.32,.06],frame);box([x,y,.98],[.51,.12,.34],black);
      box([x,y-.066,.98],[.43,.013,.26],type==='hmi'?'#5596a7':'#699ba2');
    }else{
      box([x,y,.50],[.58,.50,.98],dark);
      for(let k=0;k<5;k++){box([x,y-.26,.20+k*.155],[.52,.04,.12],k===4?blue:frame);for(let j=0;j<4;j++)box([x-.16+j*.10,y-.283,.20+k*.155],[.056,.015,.045],black);}
      dot(x+.18,y-.29,.82,.03,a.online===false?'#c78451':'#84c38e');
    }
  }
  const camera=find('camera');
  if(camera){
    const x=Math.min(length*.75,1.5),y=.72;bind(camera,[x,y,1.99]);rod([x,y,.04],[x,y,1.70],.052,metal);box([x,y,.035],[.23,.22,.06],metal);
    rod([x,y,1.66],[x,y-.16,1.78],.05,dark);box([x,y-.22,1.78],[.16,.31,.14],'#ced6d3');rod([x,y-.38,1.78],[x,y-.43,1.78],.10,black);
  }
  let pallet=[target+.18,1.55,.13],grip=null;
  if(robot){
    bind(robot,[target,.72,1.67]);
    const arm=run.coupled?.arm;let base,elbow,wrist,tip;
    if(arm){
      const f=forward(arm),offset=[target-arm.stations.pick.x,-arm.stations.pick.y];
      const at=(p,z)=>[p.x+offset[0],p.y+offset[1],z];
      base=at(f.base,1.15);elbow=at(f.elbow,1.38);wrist=at(f.wrist,1.20);tip=at(f.tip,1.10);
      pallet=at(arm.pallet,.13);if(arm.gripped)grip=tip;
    }else{
      base=[target,.77,1.02];elbow=[target+.14,.51,1.50];
      wrist=[target,.14,1.24];tip=[target,0,1.085];
    }
    datums.push({id:robot.id+'-tip',label:robot.id+' · tool reference',point:tip});
    box([base[0],base[1],.13],[.38,.38,.25],dark);rod([base[0],base[1],.25],base,.19,orange);
    rod(base,elbow,.16,orange);rod(elbow,wrist,.12,orange);rod(wrist,tip,.055,metal);
    dot(...base,.22,frame);dot(...elbow,.18,orange);dot(...wrist,.13,frame);
    rod(tip,[tip[0],tip[1],tip[2]-.045],.09,run.firstOut?'#c14e37':black);
    for(let i=-1;i<2;i++)box([pallet[0]+i*.25,pallet[1],.045],[.10,.70,.09],'#94774f');
    for(let i=-2;i<=2;i++)box([pallet[0],pallet[1]+i*.144,.105],[.76,.134,.075],'#b79c74');
  }
  const cartons=run.cartons.filter(c=>['moving','waiting'].includes(c.status)).slice(-80);
  const visible=run.pallets.slice(-24);
  function carton(c,x,y,z){
    owner=null;id=c.id;parts.push({key:'product:'+c.id,owner:null,kind:'box',at:[x,y,z],size:[.19,.28,.20],colour:'#cc9d64'});
    parts.push({key:'seal:'+c.id,owner:null,kind:'box',at:[x,y,z+.101],size:[.035,.28,.006],colour:'#dec39b'});
  }
  for(const c of cartons){const held=grip&&run.coupled.owner===c.id;carton(c,held?grip[0]:c.x-.095,held?grip[1]:0,held?grip[2]-.15:.956);}
  visible.forEach((pal,n)=>carton({id:pal.carton},pallet[0]+(n%3-1)*.21,pallet[1]+(Math.floor(n/3)%2-.5)*.30,.25+Math.floor(n/6)*.21));
  return {parts,labels,datums,length,cartons:cartons.length,pallets:run.pallets.length};
}
