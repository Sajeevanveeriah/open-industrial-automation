import {createPlant,act,advance,summarise,assertPlant} from '../../engine.mjs';
export function recipeBook(){return {version:1,recipes:[],batches:[]};}
function ok(value,why){if(!value)throw Error(why);}
function range(n,a,b,field){ok(Number.isFinite(n)&&n>=a&&n<=b,'Invalid '+field+'.');return n;}
export function revision(book,{name,coatPct,lossPct,bagKg}){
 ok(typeof name==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9 -]{0,39}$/.test(name),'Name the recipe with 1-40 letters, digits, spaces or hyphens.');
 range(coatPct,0,25,'coating percentage');range(lossPct,0,30,'loss percentage');range(bagKg,0.1,25,'bag mass');
 ok(book.recipes.length<100,'Recipe revision limit reached.');
 const rev=book.recipes.filter(r=>r.name===name).length+1,r={id:name+'@'+rev,name,rev,coatPct,lossPct,bagKg};
 book.recipes.push(r);return r;
}
export function batch(book,plant,{recipe,lot,kg,order}){
 const r=book.recipes.find(r=>r.id===recipe),fg=plant.finishedLots.find(f=>f.id===lot);
 ok(r&&fg,'Choose an authorised recipe revision and a source lot.');
 ok(typeof order==='string'&&/^[a-zA-Z0-9_-]{1,40}$/.test(order)&&!book.batches.some(b=>b.order===order),'Choose a unique order identifier.');
 ok(book.batches.length<200,'Maximum 200 study orders.');
 const used=book.batches.filter(b=>b.lot===lot).reduce((n,b)=>n+b.kg,0);
 range(kg,0.001,fg.pendingKg+fg.releasedKg-used,'stock allocation');
 const coating=kg*r.coatPct/100,input=kg+coating,loss=input*r.lossPct/100,yieldKg=input-loss;
 const bags=Math.floor((yieldKg+1e-10)/r.bagKg),packed=bags*r.bagKg,heel=Math.max(0,yieldKg-packed);
 const row={order,recipe,lot,raw:fg.rawLotId,kg,coating,loss,bags,packed,heel,balance:input-loss-packed-heel,
   disposition:fg.holdReasons.length||fg.recalled?'HOLD - source quality':'PENDING - new batch inspection'};
 book.batches.push(row);return row;
}
export function restoreBook(doc,plant){
 const b=recipeBook();if(!doc)return b;
 ok(doc.version===1&&Array.isArray(doc.recipes)&&doc.recipes.length<=100&&Array.isArray(doc.batches)&&doc.batches.length<=200,'Invalid recipe study.');
 for(const r of doc.recipes){const added=revision(b,r);ok(added.id===r.id,'Recipe revision mismatch.');}
 for(const row of doc.batches)batch(b,plant,row);
 return b;
}
export function maintenanceAssessment(s){
 const faultIndex=s.journal.findLastIndex(c=>c.type==='fault'&&c.payload.id==='pack-film'),fault=s.journal[faultIndex];
 const job=fault&&s.jobs.find(j=>j.equipment==='pack'&&j.state==='COMPLETE'&&j.at>=fault.at);
 if(!fault||!job)return {pass:false,reason:'Prove a packaging fault, controlled hold, isolation and recorded work order.'};
 const jobCmd=s.journal.findIndex((c,i)=>i>faultIndex&&c.type==='repair'&&c.payload.id==='pack');
 if(jobCmd<0)return {pass:false,reason:'No corrective work order after the most recent fault.'};
 const after=s.journal.slice(jobCmd+1),releaseIndex=after.findIndex(c=>c.type==='unisolate'&&c.payload.id==='pack'),resume=after.find((c,i)=>i>releaseIndex&&c.type==='resume');
 const production=s.history.filter(h=>resume&&h.time>resume.at&&h.outputKgH>0);
 return {pass:releaseIndex>=0&&Boolean(resume)&&production.length>=2&&!s.faults.includes('pack-film'),reason:'Work order '+job.id+', retained '+job.retainedMaterialKg.toFixed(2)+' kg; '+production.length+' subsequent positive-rate samples.'};
}
export function safetyAssessment(s){
 const compromised=s.finishedLots.filter(l=>l.recalled||l.holdReasons.length);
 const affected=compromised.map(l=>l.id),held=compromised.reduce((n,l)=>n+l.pendingKg,0),scrap=compromised.reduce((n,l)=>n+l.scrappedKg,0);
 const notices=s.shipments.filter(sh=>affected.includes(sh.lotId));
 const origins=new Set(compromised.map(l=>l.rawLotId)),rawHeld=[...origins].every(id=>s.rawLots.some(r=>r.id===id&&r.recalled&&r.grade==='HOLD'));
 const wipHeld=s.stages.every(st=>st.queue.every(parcel=>!origins.has(parcel.rawLotId)||parcel.holdReasons.includes('Raw-lot recall')));
 return {pass:['HELD','STOPPED','TRIPPED'].includes(s.mode)&&rawHeld&&wipHeld&&compromised.length>0&&s.journal.some(c=>c.type==='recall')&&held<1e-6&&scrap>0&&notices.every(sh=>sh.recallRequired),affected,held,scrap,shipments:notices.length};
}

export function processCampaign(source,recipe,rawKg,seconds){
 range(rawKg,1000,200000,'raw allocation');range(seconds,60,10800,'campaign seconds');
 ok(Number.isInteger(seconds),'Use whole simulation seconds.');
 const trial=createPlant({seed:source.seed});
 function apply(type,p){const r=act(trial,type,p);ok(r.ok,r.reason);}
 for(const m of source.journal.filter(c=>c.type==='authorRecipe'))apply(m.type,m.payload);
 ok(trial.customRecipes?.some(r=>r.id===recipe),'Register a process recipe first.');
 apply('order',{recipe,rawKg});apply('selectRecipe',{id:recipe});apply('start',{});
 advance(trial,seconds);assertPlant(trial);return trial;
}
export function processProof(s){
 const order=s.orders.find(o=>s.customRecipes?.some(r=>r.id===o.recipe)),r=s.customRecipes?.find(r=>r.id===order?.recipe);
 if(!r)return null;
 const records=s.finishedLots.filter(l=>l.orderId===order.id).map(l=>({lot:l.id,raw:l.rawLotId,recipe:l.recipe,order:l.orderId,kg:l.totalKg,core:l.maxCoreC,hold:[...l.holdReasons],recall:l.recalled,shipments:s.shipments.filter(sh=>sh.lotId===l.id).map(sh=>sh.id)}));
 const packed=records.reduce((n,l)=>n+l.kg,0),summary=summarise(s);
 return {recipe:r.id,name:r.name,order:order.id,raw:order.rawFedKg,packed,first:s.finishedLots.find(l=>l.orderId===order.id)?.firstAt??null,
  window:s.time,meanKgH:s.time?packed*3600/s.time:0,yield:order.rawFedKg?packed/order.rawFedKg:0,fullBags:records.reduce((n,l)=>n+Math.floor(l.kg/r.bagKg),0),
  holds:records.filter(l=>l.hold.length||l.recall).length,quality:summary.quality,records};
}
