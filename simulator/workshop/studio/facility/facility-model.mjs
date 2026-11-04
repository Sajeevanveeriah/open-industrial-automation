export const DT=.25;
export const PRODUCTS=[
  {sku:'FR-09',name:'9 mm straight fries'},{sku:'WG-12',name:'Skin-on wedges'},
  {sku:'CR-07',name:'Crinkle-cut fries'},{sku:'HS-04',name:'Hash brown cartons'}
];
const count=22,vehicles=8,limit=28800,maxEvents=4096,centre=i=>(i-10.5)*5.5;
const safe=(v,m)=>{if(!v)throw Error(m);},int=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
const pad=n=>String(n).padStart(2,'0'),find=(rows,id)=>rows.find(r=>r.id===id);
const newPallet=(n,seed)=>({id:'PL-'+String(n).padStart(5,'0'),sku:PRODUCTS[(n+seed)%4].sku,lot:'LT-'+String(300+Math.floor(n/16))});
function event(s,type,asset,detail){s.events.push({tick:s.tick,type,asset,detail});if(s.events.length>120)s.events.shift();}
function log(s,action,args){
  safe(s.history.length<maxEvents,'Scenario edit log full. Export this run before starting another.');
  s.history.push([action,...args]);
}
function available(s,bay,sku,ignore){
  return bay.stock.find(p=>p.sku===sku&&!s.orders.some(o=>o.id!==ignore&&o.pallet===p.id&&!['dispatched','cancelled'].includes(o.status)));
}
function newOrder(s,bay,door,pallet,automatic){
  safe(s.orders.length<1200,'Order register full.');const o={id:'SO-'+String(s.orders.length+1).padStart(4,'0'),bay:bay.id,door:door.id,pallet:pallet.id,sku:pallet.sku,lot:pallet.lot,status:'queued',vehicle:null,created:s.tick,staged:null,automatic,journey:[{tick:s.tick,step:'Reserved',asset:bay.id}]};
  s.orders.push(o);event(s,'Order',o.id,'Reserved '+pallet.id+' in '+bay.id+' for '+door.id);return o;
}
function initial(seed){
  const s={version:1,seed,tick:0,aisles:[],bays:[],doors:[],vehicles:[],conveyors:[],orders:[],events:[],history:[],auto:true,initialCount:0};
  for(let i=0;i<count;i++){
    const id='A'+pad(i+1),x=centre(i);s.aisles.push({id,x,y:0,blocked:false});
    for(const side of ['L','R'])for(let col=1;col<=8;col++){
      const bay={id:id+'-'+side+pad(col),aisle:id,side,column:col,x:x+(side==='L'?-1.65:1.65),y:-14+4*(col-1),z:0,capacity:3,stock:[]};
      const n=1+(seed+i*7+col*3+(side==='R'?2:0))%3;
      for(let k=0;k<n;k++)bay.stock.push({...newPallet(++s.initialCount,seed),level:k+1});s.bays.push(bay);
    }
  }
  for(let i=0;i<4;i++)s.doors.push({id:'D'+pad(i+1),x:(i-1.5)*29,y:-28,open:true,trailer:'TR-'+pad(i+1),staged:[],dispatched:[]});
  for(let i=0;i<vehicles;i++)s.vehicles.push({id:'AMR-'+pad(i+1),x:centre(i*3),y:-20,z:0,heading:Math.PI/2,load:null,task:null,state:'idle',fault:false,lane:null,dock:null,route:[],kind:'electric-pallet-stacker',level:1,forkHeightM:.11,busyTicks:0,remaining:0,speed:2.5+.15*(i%4)});
  for(let i=0;i<2;i++){
    const parcels=[];for(let j=0;j<4;j++)parcels.push({...newPallet(++s.initialCount,seed),progress:j*8,destination:s.bays[(i*161+j*13+seed)%s.bays.length].id});
    s.conveyors.push({id:'CV-'+pad(i+1),x:i?27:-27,y:21,length:40,running:true,parcels});
  }
  for(let i=0;i<16;i++){
    const bay=s.bays[(((i*3)%count)*16+(i*3+seed)%16)],pal=bay.stock[0];
    if(available(s,bay,pal.sku))newOrder(s,bay,s.doors[i%4],pal,true);
  }
  for(let i=0;i<48;i++)tick(s);
  return s;
}
export function createFacility(seed=7){safe(int(seed,0,65535),'Seed must be an integer from 0 to 65535.');return initial(seed);}
const move=(x,y)=>({kind:'travel',x,y}),gate=(kind,id)=>({kind,id});
function sourceRoute(s,v,o){
  const bay=find(s.bays,o.bay),aisle=find(s.aisles,bay.aisle),steps=[];
  if(v.lane){const old=find(s.aisles,v.lane);steps.push(move(old.x,-20),gate('leave',old.id));}
  else if(Math.abs(v.y+20)>1e-8)steps.push(move(v.x,-20));
  steps.push(move(aisle.x,-20),gate('enter',aisle.id),move(aisle.x,bay.y),gate('pick',bay.id));return steps;
}
function doorRoute(s,v,o){
  const d=find(s.doors,o.door),out=[];
  if(v.lane){out.push(move(find(s.aisles,v.lane).x,-20),gate('leave',v.lane));}
  else if(Math.abs(v.y+20)>1e-8)out.push(move(v.x,-20));
  return [...out,move(d.x,-20),gate('dock',d.id),move(d.x,d.y),gate('stage',d.id)];
}
function assign(s,v){
  const o=s.orders.find(o=>o.status==='queued');if(!o)return;
  o.vehicle=v.id;o.status='picking';o.journey.push({tick:s.tick,step:'Assigned',asset:v.id});v.task=o.id;v.route=sourceRoute(s,v,o);
}
function truckStep(s,v){
  if(v.fault){v.state='fault';return;}
  if(!v.task)assign(s,v);if(!v.task){v.state='idle';return;}
  const o=find(s.orders,v.task);let budget=DT;
  if(!v.remaining)v.forkHeightM=v.load?.18:.11;
  for(let transitions=0;transitions<16&&budget>1e-9&&v.route.length;transitions++){
    const op=v.route[0];
    if(op.kind==='travel'){
      v.state='travelling';const dx=op.x-v.x,dy=op.y-v.y,dist=Math.hypot(dx,dy);
      if(dist>1e-8){v.heading=Math.atan2(dy,dx);const use=Math.min(budget,dist/v.speed);v.x+=Math.cos(v.heading)*v.speed*use;v.y+=Math.sin(v.heading)*v.speed*use;budget-=use;}
      if(Math.hypot(op.x-v.x,op.y-v.y)>1e-7)return;
      v.x=op.x;v.y=op.y;v.route.shift();continue;
    }
    if(op.kind==='enter'){
      const aisle=find(s.aisles,op.id);
      if(aisle.blocked||s.vehicles.some(x=>x!==v&&x.lane===op.id)){v.state='waiting';return;}
      v.lane=op.id;
    }else if(op.kind==='leave'){v.lane=null;}
    else if(op.kind==='dock'||op.kind==='stage'){
      const door=find(s.doors,op.id);
      if(!door.open){v.state='waiting';return;}
      if(op.kind==='dock'&&s.vehicles.some(x=>x!==v&&x.dock===op.id)){v.state='waiting';return;}
      if(op.kind==='dock')v.dock=op.id;
      else{
        v.state='unloading';if(!v.remaining)v.remaining=1.25;const used=Math.min(v.remaining,budget);v.remaining-=used;budget-=used;if(v.remaining>1e-9)return;
        safe(v.load?.id===o.pallet&&!door.staged.some(p=>p.id===o.pallet),'Dispatch staging identity mismatch.');
        door.staged.push(v.load);v.load=null;v.dock=null;v.task=null;v.state='idle';v.remaining=0;o.status='staged';o.staged=s.tick;o.journey.push({tick:s.tick,step:'Staged',asset:door.id});
        event(s,'Staged',door.id,o.id+' / '+o.pallet+' ready for trailer');v.route.shift();return;
      }
    }else if(op.kind==='pick'){
      v.state='loading';const stored=find(s.bays,o.bay).stock.find(p=>p.id===o.pallet);v.level=stored?.level||1;
      if(!v.remaining)v.remaining=1.5;v.forkHeightM=.11+(.11+1.12*(v.level-1))*Math.min(1,(1.5-v.remaining)/.75);
      const use=Math.min(v.remaining,budget);v.remaining-=use;budget-=use;if(v.remaining>1e-9)return;
      const b=find(s.bays,o.bay),ix=b.stock.findIndex(p=>p.id===o.pallet);safe(ix>=0&&!v.load,'Reserved pallet absent from bay.');
      v.load=b.stock.splice(ix,1)[0];v.level=v.load.level;v.forkHeightM=.18;o.journey.push({tick:s.tick,step:'Picked',asset:b.id});v.remaining=0;o.status='delivering';v.route=doorRoute(s,v,o);event(s,'Pick',v.id,'Loaded '+v.load.id+' from '+o.bay);continue;
    }
    v.route.shift();
  }
}
function dispatch(s,o){
  const door=find(s.doors,o.door);safe(o.status==='staged'&&door.open,'Stage the pallet at an open door first.');
  const ix=door.staged.findIndex(p=>p.id===o.pallet);safe(ix>=0,'Staged pallet missing.');
  door.dispatched.push({...door.staged.splice(ix,1)[0],order:o.id,tick:s.tick});o.status='dispatched';o.journey.push({tick:s.tick,step:'Dispatched',asset:door.trailer});event(s,'Dispatch',door.id,o.id+' / '+o.pallet+' loaded onto '+door.trailer);
}
function tick(s){
  s.tick++;
  for(const c of s.conveyors){
    if(!c.running)continue;
    for(let i=c.parcels.length-1;i>=0;i--){const p=c.parcels[i];p.progress=Math.min(c.length,p.progress+.5*DT);
      if(p.progress<c.length)continue;const preferred=find(s.bays,p.destination),b=preferred.stock.length<preferred.capacity?preferred:s.bays.find(b=>b.stock.length<b.capacity);
      if(b){b.stock.push({id:p.id,sku:p.sku,lot:p.lot,level:[1,2,3].find(n=>!b.stock.some(p=>p.level===n))});c.parcels.splice(i,1);event(s,'Receipt',c.id,p.id+' transferred to '+b.id);}
    }
  }
  for(const v of s.vehicles){truckStep(s,v);if(['travelling','loading','unloading'].includes(v.state))v.busyTicks++;}
  if(s.auto&&s.tick%16===0){
    for(const o of s.orders)if(o.automatic&&o.status==='staged'&&s.tick-o.staged>=48&&find(s.doors,o.door).open)dispatch(s,o);
    if(s.orders.filter(o=>o.automatic&&['queued','picking','delivering'].includes(o.status)).length<vehicles+3){
      let index=(s.orders.length*73+s.seed)%s.bays.length;for(let i=0;i<s.bays.length;i++,index=(index+1)%s.bays.length){
        const b=s.bays[index];if(find(s.aisles,b.aisle).blocked)continue;const p=b.stock.find(p=>available(s,b,p.sku)?.id===p.id);
        if(p){newOrder(s,b,s.doors[s.orders.length%4],p,true);break;}
      }
    }
  }
}
export function advance(s,ticks=1){
  safe(int(ticks,1,limit)&&s.tick+ticks<=limit,'Two-hour session limit reached. Export the scenario to retain it.');
  const last=s.history.at(-1);if(last?.[0]==='advance')last[1]+=ticks;else log(s,'advance',[ticks]);
  for(let i=0;i<ticks;i++)tick(s);
}
export function act(s,name,opts={}){
  safe(opts&&typeof opts==='object'&&!Array.isArray(opts),'Invalid action parameters.');
  const keys={order:['bay','door','sku'],dispatch:['order'],truck:['id','fault'],aisle:['id','blocked'],door:['id','open'],conveyor:['id','running'],redirect:['order','bay','door'],auto:['enabled']};
  safe(Object.hasOwn(keys,name)&&Object.keys(opts).length===keys[name].length&&keys[name].every(k=>Object.hasOwn(opts,k)),'Unknown or malformed facility action.');
  safe(s.history.length<maxEvents,'Scenario log full.');
  let msg;
  if(name==='order'){
    const b=find(s.bays,opts.bay),d=find(s.doors,opts.door),pal=b&&available(s,b,opts.sku);
    safe(b&&d&&pal,'No unreserved pallet of this product in the selected bay.');
    const o=newOrder(s,b,d,pal,false);msg='Created '+o.id;
  }else if(name==='dispatch'){
    const o=find(s.orders,opts.order);safe(o,'Unknown order.');dispatch(s,o);msg='Dispatched '+o.id;
  }else if(name==='redirect'){
    const o=find(s.orders,opts.order),d=find(s.doors,opts.door),b=find(s.bays,opts.bay);
    safe(o&&d&&b&&['queued','picking','delivering'].includes(o.status),'Only an active order can be redirected.');
    const v=find(s.vehicles,o.vehicle);
    if(o.status==='delivering'){
      safe(o.bay===opts.bay,'The loaded pallet must retain its source bay.');o.door=d.id;v.dock=null;v.remaining=0;v.route=doorRoute(s,v,o);
    }else{
      const pal=available(s,b,o.sku,o.id);safe(pal,'The alternate bay has no available matching stock.');
      o.bay=b.id;o.pallet=pal.id;o.lot=pal.lot;o.door=d.id;
      if(v){v.remaining=0;v.route=sourceRoute(s,v,o);}
    }
    o.journey.push({tick:s.tick,step:'Redirected',asset:b.id+' / '+d.id});event(s,'Redirect',o.id,'Source '+b.id+' / destination '+d.id);msg='Redirected '+o.id;
  }else if(name==='auto'){safe(typeof opts.enabled==='boolean','Choose on or off.');s.auto=opts.enabled;msg='Automatic demand '+(s.auto?'on':'off');}
  else{
    const spec={truck:[s.vehicles,'fault'],aisle:[s.aisles,'blocked'],door:[s.doors,'open'],conveyor:[s.conveyors,'running']};
    const [rows,key]=spec[name],a=find(rows,opts.id);safe(a&&typeof opts[key]==='boolean','Unknown asset or state.');
    a[key]=opts[key];if(name==='truck'&&a.fault)a.state='fault';event(s,'Control',a.id,key+' = '+a[key]);msg=a.id+' · '+key+' = '+a[key];
  }
  log(s,name,[{...opts}]);return msg;
}
export function availableStock(s,bay){return bay.stock.filter(p=>!s.orders.some(o=>o.pallet===p.id&&!['cancelled','dispatched'].includes(o.status)));}
export function totals(s){
  const rack=s.bays.reduce((n,b)=>n+b.stock.length,0),line=s.conveyors.reduce((n,c)=>n+c.parcels.length,0),moving=s.vehicles.filter(v=>v.load).length,staged=s.doors.reduce((n,d)=>n+d.staged.length,0),sent=s.doors.reduce((n,d)=>n+d.dispatched.length,0);
  return {rack,line,moving,staged,sent,total:rack+line+moving+staged+sent};
}
export function saveFacility(s){return JSON.stringify({format:'oia-facility',version:1,seed:s.seed,history:s.history});}
export function loadFacility(text){
  safe(typeof text==='string'&&text.length<512000,'Scenario must be smaller than 512 kB.');
  const d=JSON.parse(text);safe(d?.format==='oia-facility'&&d.version===1&&int(d.seed,0,65535)&&Array.isArray(d.history)&&d.history.length<=maxEvents,'Unsupported facility scenario.');
  const s=createFacility(d.seed);
  for(const row of d.history){safe(Array.isArray(row)&&row.length===2,'Malformed scenario record.');
    if(row[0]==='advance'){safe(int(row[1],1,limit),'Invalid time record.');advance(s,row[1]);}
    else act(s,row[0],row[1]);
  }return s;
}
