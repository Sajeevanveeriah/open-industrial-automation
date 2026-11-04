import test from 'node:test';
import assert from 'node:assert/strict';
import {initialPart,analyse,moveVertex,resizeSketch,stlBytes,drawingSvg,projectContext,persistPart} from '../simulator/workshop/studio/part/part-model.mjs';
import {createProject,addAsset,loadProject,saveProject} from '../simulator/workshop/model.mjs';
const near=(a,b,eps=1e-6)=>assert.ok(Math.abs(a-b)<=eps,a+' vs '+b);
test('80 by 50 by 6 L section volume and millimetre STL agree with independent signed tetrahedron sum',()=>{
  const p=initialPart(),r=analyse(p),area=80*6+(50-6)*6;near(r.areaMM2,area);near(r.volumeMM3,area*25);
  const bytes=stlBytes(p),v=new DataView(bytes.buffer),count=v.getUint32(80,true);assert.equal(bytes.length,84+count*50);
  let six=0,xmax=0;for(let i=0;i<count;i++){const data=Array.from({length:9},(_,k)=>v.getFloat32(84+i*50+12+k*4,true));const [ax,ay,az,bx,by,bz,cx,cy,cz]=data;six+=ax*(by*cz-bz*cy)-ay*(bx*cz-bz*cx)+az*(bx*cy-by*cx);xmax=Math.max(xmax,ax,bx,cx);}
  near(six/6,area*25);near(xmax,80);assert.match(drawingSvg(p),/80.00/);
});
test('closed sketch edits, dimension scale and a revolved annulus produce independent dimensions and volumes',()=>{
  const p=initialPart(),q=moveVertex(p,3,7.4,8.6);assert.deepEqual(q.profile[3],[7,9]);assert.deepEqual(p.profile[3],[6,6]);
  const scaled=resizeSketch(p,160,100);near(analyse(scaled).volumeMM3,4*analyse(p).volumeMM3);
  const collar={...p,kind:'revolve',axisX:0,profile:[[10,0],[15,0],[15,20],[10,20]]};near(analyse(collar).volumeMM3,Math.PI*(15**2-10**2)*20);
  assert.throws(()=>analyse({...collar,axisX:11}),/positive radial/);assert.throws(()=>moveVertex(p,1,0,0),/duplicated/);
});
test('profile save merges latest unrelated work, detects stale part and preserves history on mount',()=>{
  const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};storage.setItem('oia-workshop-profile-v1','A/B');
  let c=projectContext(storage);const p=createProject('blank');addAsset(p,'plc','CPU');p.extensions.notes={ticket:7};storage.setItem(c.key,saveProject(p));const old=c;
  c=persistPart(storage,c,initialPart(),true);const latest=loadProject(storage.getItem(c.key));assert.equal(latest.extensions.notes.ticket,7);assert.equal(latest.assets.length,2);assert.equal(latest.extensions.studioPart.mount.assetId,'PartMount');assert.equal(latest.assets[0].id,'CPU');near(latest.assets[1].width,.080);
  c=persistPart(storage,c,{...c.part,kind:'revolve'});const revolved=loadProject(storage.getItem(c.key));near(revolved.assets[1].width,.170);
  assert.throws(()=>persistPart(storage,old,initialPart()),/changed/);storage.setItem('oia-workshop-profile-v1','B');assert.throws(()=>persistPart(storage,c,initialPart()),/learner/);
});

test('a replacement project with no previous part cannot receive a stale editor mount',()=>{
  const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)},key='oia-workshop-v1:Learner:active';
  storage.setItem(key,saveProject(createProject('reference',7)));const original=projectContext(storage);
  const replacement=createProject('blank',73);replacement.extensions.UnrelatedDesign={revision:4};storage.setItem(key,saveProject(replacement));
  const before=storage.getItem(key);assert.throws(()=>persistPart(storage,original,initialPart(),true),/replaced or rewound/);assert.equal(storage.getItem(key),before);
  const context=projectContext(storage);addAsset(replacement,'plc','CPU');storage.setItem(key,saveProject(replacement));assert.doesNotThrow(()=>persistPart(storage,context,initialPart(),true));
});
import {drawings,attempt,recordPrediction,checkBracket,mountedRecord,angleProfile,drawingBrief} from '../simulator/workshop/studio/part/bracket-practical.mjs';
test('two independent bracket drawings reject starter, bad prediction, rework and inert evidence',()=>{
  for(const [d,nominal] of [[drawings.A,20.736],[drawings.B,18.792]]){
    const a=attempt(d),correct={...a.start,depth:d.depth,profile:angleProfile(d.width,d.height,d.wall)};
    assert.ok(!checkBracket(a,a.start).pass);assert.ok(!checkBracket(a,correct).pass);
    recordPrediction(a,nominal+1);a.edited=true;assert.ok(!checkBracket(a,correct).pass);
    assert.throws(()=>recordPrediction(a,nominal),/another attempt/);
    const retry=attempt(d);recordPrediction(retry,nominal);retry.edited=true;
    assert.ok(!checkBracket(retry,{...correct,profile:angleProfile(d.width,d.height,d.wall+1)}).pass);
    assert.ok(checkBracket(retry,correct).pass);
    assert.throws(()=>mountedRecord(retry,correct,4),/mounting/);
    const record=mountedRecord(retry,{...correct,mount:{assetId:'EYE-MOUNT'}},4);
    assert.equal(record.measured.volumeCM3,nominal);assert.equal(record.assetId,'EYE-MOUNT');
  }
  const custom=drawingBrief({...drawings.A,width:90});assert.equal(custom.id,'custom');assert.throws(()=>drawingBrief({...drawings.A,tolerance:500}));
});
