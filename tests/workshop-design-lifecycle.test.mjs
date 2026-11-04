import test from 'node:test';
import assert from 'node:assert/strict';
import {solve,generate,revision,drawing,inspectFit} from '../simulator/workshop/cad/features.mjs';
import {part} from '../simulator/workshop/site/geometry.mjs';
import {join,articulate,overlaps} from '../simulator/workshop/site/assembly.mjs';
import {defaultDesign,newCase,applyCase,openCase,packCase,stages,incidents,mission,evaluate} from '../simulator/workshop/commissioning/lifecycle.mjs';
import {grade,proof,trial} from '../simulator/workshop/site/foundations.mjs';
import {execute} from '../simulator/workshop/site/scan-code.mjs';
const design={kind:'bracket',constraints:[{kind:'width',value:100},{kind:'perimeter',value:280}],depth:30,wall:4,tolerance:.1};
const close=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t,a+' versus '+b);
function volume(mesh){
  let volume=0;for(let n=0;n<mesh.i.length;n+=3){
    const [a,b,c]=mesh.i.slice(n,n+3).map(j=>mesh.p.slice(3*j,3*j+3));
    volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
  }return Math.abs(volume)*1e9;
}
test('independent dimensional constraints, conflicting dimensions and closed feature volume',()=>{
  assert.equal(solve(design).h,40);
  assert.throws(()=>solve({...design,constraints:[{kind:'width',value:100},{kind:'width',value:100}]}),/Under-constrained/);
  assert.throws(()=>solve({...design,constraints:[...design.constraints,{kind:'height',value:60}]}),/Conflicting/);
  close(volume(generate(design)),(100*4+36*4)*30);
  close(volume(generate({...design,kind:'conveyor'})),(100*4+2*36*4)*30);
  close(volume(generate({...design,kind:'guard'})),100*40*30);
  const volumeOfTube=Math.PI*(50**2-46**2)*40;
  close(volume(generate({...design,kind:'mount'}))/volumeOfTube,1,.002);
  const first=revision([],design,'Clear sensor mounting hole'),second=revision([first],{...design,tolerance:.2},'Allow larger running clearance');
  assert.equal(inspectFit(first,100.15).pass,false);assert.equal(inspectFit(second,100.15).pass,true);
  assert.match(drawing(second),/Rev 2/);
});
test('hinged parent drives a sliding child and rotated envelope test distinguishes touching',()=>{
  const base=part('base','cabinet'),arm=part('arm','bracket',{x:1}),tip=part('tool','sensor',{x:2});
  const l={parts:[base,arm,tip]};join(l,'base','arm','revolute',-90,90,0,0);join(l,'arm','tool','prismatic',0,1,0,0);
  l.joints[0].value=90;l.joints[1].value=.5;articulate(l);close(tip.x,0);close(tip.y,2.5);
  assert.throws(()=>join(structuredClone(l),'tool','base','fixed',0,0,0,0),/Cyclic/);
  const a=part('a','guard',{x:0,y:0,length:1,width:.1,height:1,yaw:45}),b={...a,x:.1,y:-.1};
  assert.equal(overlaps(a,b),false);assert.equal(overlaps(a,{...a,x:.02}),true);assert.equal(overlaps(a,{...a,z:1}),false);
});
test('capital and annual costs, independent point and recovery estimates, false integrated acceptance rejected',()=>{
  const spec=mission(1),warm=evaluate(defaultDesign,spec),single=evaluate({...defaultDesign,standby:'single'},spec);
  assert.equal(warm.capex,4050);assert.equal(warm.recovery,6);assert.equal(warm.dataLoss,2);assert.equal(warm.annual,1290);assert.equal(warm.total,9210);
  assert.equal(single.recovery,21);assert.equal(single.backupTime,250);assert.equal(single.pointAge,3);assert.equal(single.dataLoss,6);
  const c=newCase(1),decisions=[['Engineering','allocate'],['Supplier','witness'],['Maintenance','trace'],['Corporate IT','restore'],['Quality','reconcile'],['Operations','handover']];
  assert.equal(applyCase(c,'nextStage',[stages[0],'Finance','allocate']),false);assert.equal(c.phase,0);
  for(const [i,d] of decisions.slice(0,4).entries())assert.ok(applyCase(c,'nextStage',[stages[i],...d]));
  assert.throws(()=>applyCase(c,'nextStage',[stages[4],...decisions[4]]),/objectives/);
  applyCase(c,'estimate',[{...defaultDesign},6,{...defaultDesign,standby:'single'},'Meet restoration objective']);
  for(let i=4;i<6;i++)applyCase(c,'nextStage',[stages[i],...decisions[i]]);
  assert.equal(applyCase(c,'retire',[89,true,true,'Corporate IT']),false);
  assert.ok(applyCase(c,'retire',[120,true,true,'Corporate IT']));
  for(const q of incidents)assert.ok(applyCase(c,'respond',[q.id,q.correct]));
  assert.deepEqual(openCase(packCase(c)),c);assert.throws(()=>openCase({version:1,seed:1,log:[['retire',[999,true,true,'Corporate IT']]]}));
});
test('only distinct correctly solved transfer cases earn demonstration, all three language subsets follow scan edges',()=>{
  const t=trial('travel',1);const worked={id:'travel',type:'worked',seed:1,answers:t.expected};
  const a={...worked,type:'challenge'},b={...a,seed:2,answers:trial('travel',2).expected};
  assert.equal(proof([worked,worked],'travel'),false);assert.equal(proof([a,a],'travel'),false);assert.ok(proof([a,b],'travel'));assert.deepEqual(grade('travel',1,[-99,-2]),[false,false]);
  for(const language of ['C++','TypeScript','Python']){
    const expr=language==='Python'?'input and not previous':'input && !previous';
    assert.deepEqual(execute(language,expr,'0111100110').map(r=>r.count),[0,1,1,1,1,1,1,2,2,2]);
    assert.throws(()=>execute(language,'fetch(input)','01'));
  }
});
import {recordKey,poseAt,sweep,gap,validateFootprint,checkTimeline} from '../simulator/workshop/site/motion.mjs';
test('authored motion has known metres, interpolation, midedge collision and conservative clear result',()=>{
  const base=part('base','cell'),child=part('slider','carton',{x:-1,length:.2,width:.2,height:.2}),obstacle=part('post','cabinet',{x:0,length:.2,width:.2,height:.2});
  const scene={parts:[base,child,obstacle]};join(scene,'base','slider','prismatic',0,2,0,0);
  recordKey(scene,0,'linear');scene.joints[0].value=2;recordKey(scene,2,'linear');
  const childAt=t=>poseAt(scene,t).parts[1];close(childAt(.25).x,-.75);close(childAt(1).x,0);
  assert.ok(gap(childAt(0),obstacle)>.79);assert.ok(gap(childAt(2),obstacle)>.79);
  const hit=sweep(scene);assert.equal(hit.status,'collision');close(hit.time,1);
  obstacle.y=.6;assert.equal(sweep(scene).status,'clear');obstacle.y=0;
  scene.motion[0].interpolation='hold';close(childAt(1.9).x,-1);close(childAt(2).x,1);assert.equal(sweep(scene).status,'clear');
  assert.throws(()=>checkTimeline({...scene,motion:Array(41).fill(scene.motion[0])}),/40/);
  assert.throws(()=>recordKey(scene,3,'spline'),/Unsupported/);
});
test('rotation sweeps through a separated obstacle and shaped prism separates an empty bounding-box corner',()=>{
  const root=part('root','cell'),arm=part('arm','guard',{x:1,y:0,length:.2,width:.2,height:.2}),post=part('post','cabinet',{x:0,y:1,length:.3,width:.3,height:.3});
  const scene={parts:[root,arm,post]};join(scene,'root','arm','revolute',0,180,0,0);recordKey(scene,0,'linear');scene.joints[0].value=180;recordKey(scene,2,'linear');const midway=poseAt(scene,1).parts[1];close(midway.x,0);close(midway.y,1);assert.equal(sweep(scene).status,'collision');
  const plate=part('plate','bracket',{width:2,length:2,height:.2}),pin=part('pin','sensor',{x:.75,y:.75,length:.1,width:.1,height:.1});assert.ok(gap(plate,pin)<0);
  plate.proxy=validateFootprint([[-.5,-.5],[.5,-.5],[-.5,.5]]);assert.ok(gap(plate,pin)>.9);
  assert.throws(()=>validateFootprint([[0,0],[.4,.4],[0,.4],[.4,0]]),/convex/);
});
test('free closed sketches extrude and revolve with independent volume and safe limits',()=>{
  const custom={...design,kind:'extrude',profile:[[-5,-5],[15,-5],[15,5],[5,5],[5,15],[-5,15]]};
  close(volume(generate(custom)),300*30);assert.equal(solve(custom).w,20);
  const tube={...custom,kind:'revolve',profile:[[10,-5],[20,-5],[20,15],[10,15]]};
  assert.equal(solve(tube).w,40);close(volume(generate(tube))/(Math.PI*300*20),1,.002);
  assert.throws(()=>generate({...tube,profile:[[0,0],[10,0],[10,10],[0,10]]}),/positive radial/);
  assert.throws(()=>generate({...custom,profile:[[0,0],[5,5],[0,5],[5,0]]}),/intersect/);
  assert.throws(()=>generate({...custom,profile:Array(49).fill([1,1])}),/48/);
});
