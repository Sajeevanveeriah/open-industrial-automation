import * as T from '../../../vendor/three.module.js';
import {batch,crateTint,hash,label} from './architecture.mjs';
const black='#293036',tyre='#282a29',steel='#647680',zinc='#adb8b7';
export function palletBody(kit,load){
  const b=batch(kit),tint=crateTint(load.sku),n=hash(load.id),tiers=2+n%2,h=.76+(n%3)*.04;
  for(const x of [-.40,0,.40])b.box('#9c7950',x,0,.045,.14,1.12,.09);
  for(let i=0;i<6;i++)b.box('#bc9968',0,-.48+i*.19,.117,1.10,.14,.07);
  for(let r=0;r<tiers;r++)for(let a=0;a<2;a++)for(let c=0;c<2;c++){
    b.box(tint,(a-.5)*.53,(c-.5)*.51,.154+(r+.5)*h/tiers,.525,.505,h/tiers-.009,null,'carton');
  }
  for(const y of [-.28,.28])b.box('#9e8971',0,y,.155+h,1.07,.017,.011);
  return b.finish();
}
export function buildStacker(kit,id){
  const b=batch(kit),paint=['#e6ad41','#cc6943','#cd853a','#d29444'][hash(id)%4];
  b.shade(-.13,0,2.75,1.57);
  b.box(black,-.10,0,.34,2.0,1.0,.29);b.box(paint,-.38,0,.61,1.37,.98,.46);
  b.box(paint,-.88,0,.76,.50,.97,.36);b.box(black,-1.12,0,.63,.078,.97,.29);b.box(steel,-1.169,0,.62,.03,.63,.14);
  for(let i=0;i<6;i++)b.box('#42494a',-.91,-.501,.72+i*.045,.32,.018,.020);
  for(const side of [-1,1]){
    b.box('#e0c786',-.39,side*.509,.64,.61,.018,.109);
    b.box(black,-.39,side*.524,.64,.39,.016,.038);
    b.box(black,.04,side*.48,.73,.46,.16,.16);
    b.rod(steel,[-.62,side*.425,.77],[-.60,side*.425,2.12],.059);
    b.rod(steel,[.47,side*.425,.72],[.22,side*.425,2.12],.059);
    b.box(black,-.19,side*.43,2.15,.98,.098,.085);b.box(paint,-.23,side*.45,2.22,1.09,.066,.055);
    b.box(black,.49,side*.45,1.64,.04,.12,.12);b.box('#bbd5d8',.483,side*.49,1.64,.02,.08,.085,null,'glass');
    b.box('#f4dfb2',.33,side*.38,2.10,.09,.10,.09,null,'lamp');
  }
  for(let i=0;i<6;i++)b.box(steel,-.66+i*.17,0,2.17,.060,.85,.065);
  b.box('#423f36',-.38,0,.92,.48,.52,.13);b.box('#363a39',-.60,0,1.13,.10,.50,.40,[0,-.12,0]);
  b.rod(black,[.13,-.15,.75],[.20,-.12,1.23],.06);
  b.add('torus','rubber','#323538',.20,-.12,1.27,.32,.32,.26,[0,.42,0]);b.rod(black,[.05,-.12,1.23],[.31,-.12,1.30],.026);
  b.rod(black,[.10,.21,.9],[.15,.21,1.2],.018);b.add('sphere','rubber',black,.15,.21,1.21,.055,.055,.055);
  b.box('#293a3f',.4,0,.90,.30,.81,.18,[0,-.22,0]);b.box('#97b7ae',.33,0,1.02,.19,.30,.025,[0,-.22,0]);
  b.rod('#31383b',[.71,-.38,.27],[.71,-.38,2.28],.09);b.rod('#31383b',[.71,.38,.27],[.71,.38,2.28],.09);
  for(const y of [-.33,.33]){b.box('#3d4445',.74,y,1.29,.14,.076,2.05);b.box('#a2adab',.79,y,1.32,.035,.057,1.90);}
  b.box(black,.74,0,.42,.14,.78,.12);b.box(black,.74,0,2.23,.14,.81,.10);
  b.rod(zinc,[.72,0,.39],[.72,0,1.73],.099);b.rod('#737d7d',[.71,-.12,.34],[.71,-.12,2.10],.033);
  b.add('sphere','lamp','#f5a629',-.54,0,2.30,.129,.129,.17);
  const root=b.finish(),wheels=[];
  for(const [x,z,r] of [[-.74,.263,.245],[.56,.30,.297]])for(const side of [-1,1]){
    const wheel=batch(kit);
    wheel.rod(tyre,[0,-.106,0],[0,.106,0],2*r,'rubber','wheel');
    wheel.rod(steel,[0,side*.085,0],[0,side*.119,0],r*1.18,'steel','wheel');
    wheel.rod(paint,[0,side*.114,0],[0,side*.128,0],r*.72,'paint','wheel');
    for(let t=0;t<5;t++){const ang=2*Math.PI*t/5;wheel.add('sphere','steel',zinc,r*.42*Math.cos(ang),side*.128,r*.42*Math.sin(ang),.024,.017,.024);}
    for(let i=0;i<10;i++){const ang=Math.PI*i/5;wheel.box('#3b3c38',r*.98*Math.cos(ang),0,r*.98*Math.sin(ang),.044,.172,.01,[0,-ang+Math.PI/2,0]);}
    const obj=wheel.finish();obj.position.set(x,side*.46,z);root.add(obj);wheels.push(obj);
  }
  const lift=batch(kit);
  for(const y of [-.244,.244]){
    lift.box('#4b5251',.875,y,.38,.085,.095,.82);lift.box('#565c59',1.37,y,.007,1.04,.092,.068);lift.box('#9a9f98',1.91,y,.001,.11,.086,.045,[0,.09,0]);
    lift.box('#68706e',.83,y,.94,.073,.095,1.49);
  }
  lift.box(black,.865,0,.42,.095,.83,.18);lift.box(steel,.86,0,.81,.085,.82,.06);
  for(const y of [-.35,-.18,0,.18,.35])lift.box(steel,.855,y,.59,.05,.027,.45);
  const carriage=lift.finish();root.add(carriage);
  return {root,wheels,carriage};
}
export function buildTruck(kit,index){
  const b=batch(kit),colour=['#e4e5db','#aebfc4','#dedecc','#b4c5b5'][index%4],cab=['#406278','#8d584a','#65877c','#b29256'][index%4];
  b.shade(0,-7,4.4,17.2);b.box(black,0,-6.5,1.05,2.10,11.9,.25);
  b.box(colour,0,-6.55,2.65,2.49,11.9,2.94);b.box('#d2d3c8',0,-6.54,4.18,2.55,11.96,.12,null,'steel');
  for(const x of [-1.26,1.26]){
    b.box('#a3b1ad',x,-6.54,1.19,.065,11.97,.20,null,'steel');b.box('#9ba6a3',x,-6.54,4.12,.056,11.95,.075,null,'steel');
    for(let j=0;j<26;j++)b.box('#bdc3bb',x,-.82-j*.449,2.70,.026,.028,2.80,null,'steel');
    for(let j=0;j<8;j++)b.box(j%2?'#d09d60':'#d9d8be',x*1.019,-1.1-j*1.35,1.23,.018,.45,.043);
  }
  for(const y of [-3.22,-4.48,-12.5,-15.25])for(const x of [-1.05,1.05]){
    b.rod(black,[x-.18,y,.49],[x+.18,y,.49],.97,'rubber','wheel');b.rod('#8c9698',[x-.21,y,.49],[x+.21,y,.49],.55,'steel','wheel');
  }
  b.box(black,0,-14, .72,2.16,3.7,.29);b.box(cab,0,-14.75,1.88,2.43,2.28,2.18);b.box(cab,0,-14.86,3.04,2.40,1.86,.34);
  b.box('#638590',0,-15.90,2.28,2.13,.045,.83,[-.10,0,0],'glass');
  for(const side of [-1,1]){
    b.box('#6f8b93',side*1.225,-14.8,2.30,.04,1.55,.85,null,'glass');b.box('#a0aaab',side*1.24,-14.45,1.51,.05,.34,.07);
    b.box('#343d40',side*1.35,-15.58,2.16,.24,.13,.37);b.box('#98a3a3',side*1.2,-14.1,.83,.41,1.39,.18);
  }
  b.box('#364246',0,-15.92,1.51,1.40,.072,.50);for(let k=0;k<4;k++)b.box('#959f9e',0,-15.962,1.34+k*.12,1.32,.02,.031);
  for(const side of [-1,1])b.box('#eddfa9',side*.90,-15.93,1.25,.39,.08,.19,null,'lamp');
  const group=b.finish();const brand=label('COLD CHAIN  /  '+String(index+1).padStart(2,'0'),3.1,.49,{bg:'#526e77',font:78});
  brand.position.set(-1.298,-4.0,3.05);brand.rotation.set(Math.PI/2,0,-Math.PI/2);group.add(brand);
  return group;
}
export function disposeTree(obj){obj.traverse(x=>{if(x.isInstancedMesh)x.dispose();if(x.userData.owns){x.geometry.dispose();x.material.map?.dispose();x.material.dispose();}});obj.removeFromParent();}
