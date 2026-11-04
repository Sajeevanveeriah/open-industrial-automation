export const tags={count:'cartons',I0:'state',I1:'state',temperature:'°C'};
const fail=(v,msg)=>{if(!v)throw Error(msg);};
function label(v){fail(typeof v==='string'&&v.trim()&&v.length<=40,'Use a 1-40 character label.');return v.trim();}
export function newStation(){return {version:1,actions:[],screens:[],tick:0,connected:true,values:{count:0,I0:0,I1:0,temperature:20},channels:[],journal:[],history:[],firstOut:null,previous:false};}
function keep(s,op,args){
 fail(s.actions.length<4000,'Maximum 4,000 recorded HMI actions.');
 const last=s.actions.at(-1);
 if(op==='scan'&&last?.[0]==='scan'&&JSON.stringify(last[1])===JSON.stringify(args))last[2]++;
 else s.actions.push([op,structuredClone(args),1]);
}
export function screen(s,name){name=label(name);fail(s.screens.length<8&&!s.screens.some(x=>x.name===name),'Choose a unique screen. Maximum eight.');keep(s,'screen',[name]);s.screens.push({name,widgets:[]});}
export function widget(s,page,id,tag,scale,offset,units,alarm,style){
 const p=s.screens.find(x=>x.name===page);fail(p&&Object.hasOwn(tags,tag),'Choose a screen and tag.');
 id=label(id);fail(Number.isFinite(scale)&&scale!==0&&Math.abs(scale)<=100000&&Number.isFinite(offset)&&Math.abs(offset)<=100000&&Number.isFinite(alarm)&&Math.abs(alarm)<=1e9,'Invalid display scaling or limit.');
 fail(['Numeric','Indicator','Trend'].includes(style),'Invalid display style.');
 const w={id,tag,scale,offset,units:label(units),alarm,style};const i=p.widgets.findIndex(x=>x.id===id);
 fail(i>=0||p.widgets.length<12,'Screen widget limit reached.');keep(s,'widget',[page,id,tag,scale,offset,units,alarm,style]);if(i>=0)p.widgets[i]=w;else p.widgets.push(w);
}
export function channel(s,id,mode,period,deadband,lag){
 fail(Object.hasOwn(tags,id)&&['Poll','Subscribe'].includes(mode),'Invalid channel.');
 fail(Number.isInteger(period)&&period>=1&&period<=100&&Number.isInteger(lag)&&lag>=0&&lag<=20&&Number.isFinite(deadband)&&deadband>=0&&deadband<=10000,'Invalid acquisition settings.');
 const old=s.channels.find(c=>c.id===id),cfg={id,mode,period,deadband,lag,queue:[],lastSent:null,lastStored:null,live:null};
 keep(s,'channel',[id,mode,period,deadband,lag]);if(old)Object.assign(old,cfg);else s.channels.push(cfg);
}
function audit(s,msg){s.journal.push({tick:s.tick,msg});if(s.journal.length>80)s.journal.shift();}
export function connection(s,on){fail(typeof on==='boolean','Choose link state.');if(s.connected===on)return;keep(s,'connection',[on]);s.connected=on;
 if(!on)for(const c of s.channels){c.queue=[];c.lastSent=null;if(c.live){c.live={...c.live,quality:'STALE'};s.history.push({...c.live,acquired:s.tick});if(s.history.length>2048)s.history.shift();}}
 audit(s,on?'Gateway connected':'Gateway lost; local control continues');}
export function scan(s,{I0=0,I1=0,temperature=20,count}={}){
 fail(s.tick<36000&&[0,1,false,true].includes(I0)&&[0,1,false,true].includes(I1)&&Number.isFinite(temperature)&&Math.abs(temperature)<=500,'Invalid source sample or run limit.');
 if(count!==undefined)fail(Number.isSafeInteger(count)&&count>=0&&count<=1e9,'Invalid source count.');
 keep(s,'scan',[count===undefined?{I0,I1,temperature}:{I0,I1,temperature,count}]);s.tick++;s.values={I0:Number(I0),I1:Number(I1),temperature,count:count??s.values.count+Number(Boolean(I0)&&!s.previous)};s.previous=Boolean(I0);
 for(const c of s.channels){
   if(!s.connected)continue;
   const value=s.values[c.id],send=c.mode==='Poll'?s.tick%c.period===0:c.lastSent!==value||s.tick%c.period===0;
   if(send){c.queue.push({value,source:s.tick,due:s.tick+c.lag});c.lastSent=value;}
   while(c.queue.length&&c.queue[0].due<=s.tick){
     const packet=c.queue.shift(),last=c.lastStored,sample={tag:c.id,value:packet.value,source:packet.source,acquired:s.tick,quality:'GOOD'};
     const restored=c.live?.quality==='STALE';c.live=sample;
     if(restored||last===null||Math.abs(sample.value-last)>c.deadband){s.history.push(sample);c.lastStored=sample.value;if(s.history.length>2048)s.history.shift();}
   }
 }
 if(!s.firstOut)for(const p of s.screens){for(const w of p.widgets){const d=display(s,w);if(d.quality==='GOOD'&&d.value>=w.alarm){s.firstOut={tick:s.tick,source:d.source,widget:w.id,screen:p.name,value:d.value};audit(s,'First-out '+p.name+'/'+w.id);return;}}}
}
export function display(s,w){const d=s.channels.find(c=>c.id===w.tag)?.live;return {value:d?d.value*w.scale+w.offset:null,quality:d?.quality??'NO DATA',source:d?.source??null,acquired:d?.acquired??null};}
export function restorePanel(doc){
 const s=newStation();if(!doc)return s;
 fail(doc.version===1&&Array.isArray(doc.screens)&&doc.screens.length<=8&&Array.isArray(doc.channels)&&doc.channels.length<=4,'Unsupported HMI design.');
 for(const p of doc.screens){screen(s,p.name);fail(Array.isArray(p.widgets)&&p.widgets.length<=12,'Invalid widgets.');for(const w of p.widgets)widget(s,p.name,w.id,w.tag,w.scale,w.offset,w.units,w.alarm,w.style);}
 for(const c of doc.channels)channel(s,c.id,c.mode,c.period,c.deadband,c.lag);
 return s;
}
export function panelDesign(s){return {version:1,screens:structuredClone(s.screens),channels:s.channels.map(({id,mode,period,deadband,lag})=>({id,mode,period,deadband,lag}))};}
export function assessHmi(s){
 const d=restorePanel(panelDesign(s));if(d.screens.filter(p=>p.widgets.length>0).length<2)return false;
 const widgets=d.screens.flatMap(p=>p.widgets),counter=widgets.find(w=>w.tag==='count'),input=widgets.find(w=>w.tag==='I0');
 if(!counter||!input||!d.channels.some(c=>c.id==='count')||!d.channels.some(c=>c.id==='I0'))return false;
 for(let i=0;i<125;i++)scan(d,{I0:i>0});
 const before=display(d,counter);connection(d,false);scan(d,{I0:0});scan(d,{I0:1});
 const loss=display(d,counter);connection(d,true);for(let i=0;i<125;i++)scan(d,{I0:1});
 return before.value===counter.scale+counter.offset&&loss.quality==='STALE'&&loss.source===before.source&&display(d,counter).value===2*counter.scale+counter.offset&&display(d,input).value===input.scale+input.offset;
}

export function exportStation(s){return {version:2,actions:structuredClone(s.actions)};}
export function importStation(doc){
 if(!doc||doc.version===1)return restorePanel(doc);
 fail(doc.version===2&&Array.isArray(doc.actions)&&doc.actions.length<=4000,'Invalid station record.');
 const s=newStation(),ops={screen,widget,channel,connection,scan};
 for(const row of doc.actions){
  fail(Array.isArray(row)&&row.length===3&&Object.hasOwn(ops,row[0])&&Array.isArray(row[1])&&row[1].length<=8&&Number.isInteger(row[2])&&row[2]>=1&&row[2]<=(row[0]==='scan'?36000:1),'Invalid HMI event.');
  for(let i=0;i<row[2];i++)ops[row[0]](s,...row[1]);
 }
 return s;
}
