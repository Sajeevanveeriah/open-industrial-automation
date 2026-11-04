import test from 'node:test';
import assert from 'node:assert/strict';
import {instrument,drawing,drive,calibration,transducer} from '../simulator/workshop/electrical/instruments.mjs';
import {newStation,screen,widget,channel,scan,connection,display,assessHmi,importStation,exportStation} from '../simulator/workshop/practice/supervision.mjs';
import {compileProgram,newController,executeScan,restartController} from '../simulator/workshop/practice/plc.mjs';
import {registry,candidate,activate,rollback,inspectRelease,restoreRegistry,dataset,observeDeployment,deploymentAssessment} from '../simulator/workshop/practice/registry.mjs';
import {recipeBook,revision,batch,restoreBook,safetyAssessment,maintenanceAssessment,processCampaign,processProof} from '../simulator/workshop/production/capstones.mjs';
import {act,scenario,advance,exportRun,importRun,assertPlant} from '../simulator/engine.mjs';
import {command,createProject,step,loadProject,saveProject,addCarton} from '../simulator/workshop/model.mjs';
test('two valid loop drawings and distinct open, bypass, compliance and span failures',()=>{
 const reverse=[['PS.+','AI.+'],['AI.-','TX.+'],['TX.-','PS.0']];
 for(const w of [drawing,reverse]){
  const q=instrument(w,{actual:50});assert.equal(q.mA,12);assert.equal(q.burdenV,3);assert.deepEqual(calibration(w,{}).map(m=>m.observed),[4,12,20]);
 }
 assert.match(instrument(drawing.slice(1)).quality,/Open/);
 assert.match(instrument([...drawing,['AI.+','AI.-']]).quality,/bypassed/);
 assert.equal(instrument(drawing,{supply:12,burden:500,cable:0,actual:100}).mA,4);
 assert.equal(calibration(drawing,{gain:1.1}).at(-1).pass,false);
});
test('RMS, peak, slip, loss and four sensor checks give independent expected results',()=>{
 const d=drive({lineV:Math.sqrt(3)*240,hz:50,poles:4,slip:0.04});assert.ok(Math.abs(d.phaseRms-240)<1e-9);assert.equal(d.rpm,1440);
 assert.ok(Math.abs(d.peak-339.41125)<0.00001);assert.equal(drive({phaseLoss:true}).kW,0);
 assert.equal(transducer({value:100,lead:1,compensate:true}).signal,140.5);assert.equal(transducer({value:100,lead:1,compensate:true}).indicated,100);
 assert.equal(transducer({type:'TC',value:100,cold:25,compensate:false}).indicated,75);
 assert.equal(transducer({type:'Encoder',value:120,pulses:100,window:0.5}).signal,100);
 assert.equal(transducer({type:'Load cell',value:100}).signal,10);
});
function design(){
 const s=newStation();for(const [p,t]of [['Overview','count'],['Diagnostics','I0']]){screen(s,p);widget(s,p,'Indicator '+t,t,1,0,'units',8,'Numeric');channel(s,t,'Subscribe',2,0,1);}
 return s;
}
test('two-screen assessment checks actual tag path, freeze, recovery, compression and timestamps',()=>{
 const s=design();assert.equal(assessHmi(s),true);const w=s.screens[0].widgets[0];
 scan(s,{I0:1});assert.equal(display(s,w).quality,'NO DATA');scan(s,{I0:1});assert.deepEqual(display(s,w),{value:1,quality:'GOOD',source:1,acquired:2});
 connection(s,false);scan(s,{I0:0});scan(s,{I0:1});assert.equal(display(s,w).quality,'STALE');assert.equal(s.values.count,2);assert.equal(display(s,w).value,1);
 const copy=importStation(exportStation(s));assert.deepEqual(copy,s);
 connection(copy,true);scan(copy,{I0:1});scan(copy,{I0:1});assert.equal(display(copy,w).value,2);
 channel(s,'temperature','Poll',2,5,1);connection(s,true);for(let i=0;i<6;i++)scan(s,{temperature:20+i});
 assert.equal(s.history.filter(h=>h.tag==='temperature').length,1);
 const bad=design();bad.screens[1].widgets=[];assert.equal(assessHmi(bad),false);
});
test('isolated editable function block instances, retained-edge restart and actual portable PLC restart',()=>{
 const program=compileProgram('FUNCTION_BLOCK EDGE; OUTPUT := R_TRIG(IN); END_FUNCTION_BLOCK; IF EDGE(I0) OR EDGE(I1) THEN COUNT := COUNT + 1; END_IF;');
 let st=newController();for(const [I0,I1]of [[1,0],[1,1],[1,1]])st=executeScan(program,st,{I0,I1});
 assert.equal(st.COUNT,2);
 const kept=executeScan(program,restartController(st,'Count and blocks retained'),{I0:1,I1:1});
 const repeated=executeScan(program,restartController(st,'Count retained'),{I0:1,I1:1});
 assert.equal(kept.COUNT,2);assert.equal(repeated.COUNT,3);
 const p=createProject('reference');command(p,'installProgram',{source:'IF R_TRIG(IN) THEN COUNT := COUNT + 1; END_IF;',language:'ST'});addCarton(p);step(p,41);
 command(p,'restartPLC',{policy:'Count retained'});step(p,1);assert.equal(p.runtime.count,2);assert.deepEqual(loadProject(saveProject(p)).runtime,p.runtime);
});
test('later-run validation blocks reuse, complete dataset export, model deploy and rollback predictions',()=>{
 const r=registry(),m=candidate(r,{kind:'optical',seed:10,threshold:0.5});
 const args={run:15,kind:'optical',lighting:0.6};const first=inspectRelease(r,args);activate(r,m.id);
 assert.throws(()=>inspectRelease(r,{...args,run:14}),/later/);const deployed=inspectRelease(r,args);assert.equal(deployed.rows.length,32);
 assert.notDeepEqual(deployed.rows.map(r=>r.confidence),first.rows.map(r=>r.confidence));
 rollback(r);assert.deepEqual(inspectRelease(restoreRegistry(r),args),first);
 const d=dataset({kind:'optical',seed:10});assert.equal(d.runs.flatMap(r=>r.rows).length,144);assert.ok(d.runs.every(r=>r.rows[0].data.length===768));assert.deepEqual(d.runs.map(x=>x.role),['training','training','training','training','validation','later production']);
});
test('revision-controlled recipe trial reconciles full bags, heel, loss and ancestry without double allocation',()=>{
 const plant=scenario('baseline'),book=recipeBook(),params={name:'Test cut',coatPct:5,lossPct:2,bagKg:2.5};
 const first=revision(book,params);const second=revision(book,{...params,bagKg:10});assert.equal(second.rev,2);
 const lot=plant.finishedLots[0].id,req={recipe:first.id,lot,kg:100,order:'PROD-1'};
 const v=batch(book,plant,req);assert.equal(v.coating,5);assert.equal(v.loss,2.1);assert.equal(v.bags,41);assert.ok(Math.abs(v.heel-0.4)<1e-9);assert.ok(Math.abs(v.balance)<1e-8);assert.equal(v.raw,plant.finishedLots[0].rawLotId);
 assert.throws(()=>batch(book,plant,req));assert.deepEqual(restoreBook(book,plant),book);assert.throws(()=>batch(book,plant,{...req,order:'OVER',kg:plant.finishedLots[0].totalKg}));
});
test('maintenance and recall assessments require real physical output resumption and affected inventory disposition',()=>{
 const p=scenario('pack-blockage');assert.equal(maintenanceAssessment(p).pass,false);assert.equal(act(p,'repair',{id:'pack'}).ok,false);
 for(const [op,payload]of [['hold',{}],['isolate',{id:'pack'}],['repair',{id:'pack'}],['unisolate',{id:'pack'}],['resume',{}]])assert.equal(act(p,op,payload).ok,true);
 assert.equal(maintenanceAssessment(p).pass,false);advance(p,60);assert.equal(maintenanceAssessment(p).pass,true);
 const q=scenario('quality-hold'),lot=q.finishedLots[0];assert.equal(act(q,'release',{id:lot.id}).ok,false);
 act(q,'recall',{id:lot.rawLotId});assert.equal(safetyAssessment(q).pass,false);act(q,'reject',{id:lot.id});assert.equal(safetyAssessment(q).pass,false);act(q,'hold');assert.equal(safetyAssessment(q).pass,true);
});

test('authored reference recipes drive all stages, preserve identities, alter yield and thermal holds on independent orders',()=>{
 const origin=scenario('cold-start'),params={name:'Skin trial',cutMm:9,blanchC:82,fryC:175,freezeC:-35,freezeS:720,coatPct:0,bagKg:2.5,formed:false,skinOn:false};
 assert.equal(act(origin,'authorRecipe',{...params,freezeS:0}).ok,false);
 assert.equal(act(origin,'authorRecipe',{...params,name:'<unsafe>'}).ok,false);
 for(const setting of [params,{...params,cutMm:15,freezeS:120,coatPct:5,skinOn:true},{...params,freezeS:1400}])assert.equal(act(origin,'authorRecipe',setting).ok,true);
 assert.deepEqual(origin.customRecipes.map(r=>r.revision),[1,2,3]);
 const runs=origin.customRecipes.map(r=>processCampaign(origin,r.id,6000,2400)),[normal,rush,long]=runs.map(processProof);
 assert.equal(normal.order,'SIM-ORDER-002');assert.equal(normal.first,1589);assert.equal(rush.first,974);assert.equal(long.first-normal.first,1400-720);
 assert.equal(normal.holds,0);assert.equal(rush.holds,1);assert.ok(rush.yield>normal.yield);assert.ok(long.meanKgH<normal.meanKgH/2);
 assert.ok(runs[1].finishedLots[0].components.coat>0);assert.equal(runs[0].finishedLots[0].components.coat,0);
 const p=importRun(exportRun(runs[1]));assert.deepEqual(processProof(p),rush);assert.ok(Math.abs(assertPlant(p).residualKg)<0.0001);
 const lot=p.finishedLots[0];assert.equal(act(p,'release',{id:lot.id}).ok,false);assert.equal(act(p,'recall',{id:lot.rawLotId}).ok,true);
 const trace=processProof(p).records[0];assert.equal(trace.recall,true);assert.equal(trace.raw,'SIM-VIC-001');assert.equal(trace.recipe,'USR-002');
});
test('deployment assessment requires independent production evidence on identical conditions before, during and after rollback',()=>{
 const r=registry(),m=candidate(r,{kind:'optical',seed:1,threshold:0.5}),set={kind:'optical',run:6};
 observeDeployment(r,set);activate(r,m.id);observeDeployment(r,set);rollback(r);assert.equal(deploymentAssessment(r).pass,false);
 observeDeployment(r,{...set,lighting:0.5});assert.equal(deploymentAssessment(r).pass,false);
 observeDeployment(r,set);assert.equal(deploymentAssessment(restoreRegistry(r)).pass,true);
});
