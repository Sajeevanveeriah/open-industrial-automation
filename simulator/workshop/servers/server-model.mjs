const requirements={database:{ram:4,disk:12},application:{ram:2,disk:4}};
const users=['operator','engineer','visitor','svc-app'];
const groups=['view','admin','database'];
const keys={host:['name','ram','disk'],deploy:['name','service'],grant:['user','group'],revoke:['user','group'],certificate:['name','days'],route:['name'],power:['name','on'],network:['name','on'],write:['user','label'],read:['user'],backup:['name'],damage:[],restore:['name'],replicate:['name'],patch:['name','version'],migrate:['name'],rollback:['name'],verify:['name'],advance:['seconds'],targets:['rto','rpo']};
function check(ok,message){if(!ok)throw Error(message);}
function integer(value,min,max,name){check(Number.isInteger(value)&&value>=min&&value<=max,name+' must be an integer from '+min+' to '+max+'.');return value;}
function ident(v){check(typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,30}$/.test(v),'Use 1-31 letters, digits, underscores or hyphens for names.');return v;}
function host(s,name){const h=s.hosts.find(h=>h.name===name);check(h,'Unknown host.');return h;}
function account(s,user,group){return s.groups[user]?.includes(group);}
function audit(s,action,actor,result){s.audit.push({at:s.time,action,actor,result});}
function hash(rows){
  let h=2166136261;
  for(const row of rows){const str=JSON.stringify([row.id,row.at,row.label]);for(let i=0;i<str.length;i++)h=Math.imul(h^str.charCodeAt(i),16777619);}
  return (h>>>0).toString(16).padStart(8,'0');
}
export function storage(h){return {ram:h.services.reduce((sum,n)=>sum+requirements[n].ram,0),disk:h.services.reduce((sum,n)=>sum+requirements[n].disk,0)+h.rows.length*0.01};}
export function probe(s,h=s.hosts.find(x=>x.name===s.dns)){
  if(!h)return 'Application DNS record missing';
  if(!h.power)return 'Host offline';
  if(!h.network)return 'Virtual switch disconnected';
  if(!h.services.includes('application'))return 'Application service absent';
  if(h.expiry<=s.time)return 'Server certificate expired';
  if(!account(s,'svc-app','database'))return 'Service identity denied by database';
  if(!h.services.includes('database'))return 'Database service absent';
  if(h.app!==h.schema)return 'Application and database versions incompatible';
  return 'Healthy';
}
function currentRows(s){return s.hosts.find(h=>h.name===s.dns)?.rows||[];}
function updateAvailability(s,was,baseline){
  const now=probe(s);
  if(was==='Healthy'&&now!=='Healthy'&&!s.outage){s.outage={start:s.time,baseline:[...baseline],source:s.dns};audit(s,'outage','monitor',now);}
  if(now==='Healthy'&&s.outage){
    const restored=new Set(currentRows(s).map(r=>r.id)),missing=s.outage.baseline.filter(r=>!restored.has(r.id));
    const lastRecoverable=[...s.outage.baseline].reverse().find(r=>restored.has(r.id));
    const destination=s.hosts.find(h=>h.name===s.dns);
    const point=destination.image?.source===s.outage.source?destination.image.at:(lastRecoverable?.at??0);
    s.lastRecovery={start:s.outage.start,end:s.time,rto:s.time-s.outage.start,rpo:missing.length?Math.max(0,s.outage.start-point):0,
      missing:missing.map(r=>r.id),expected:s.outage.baseline.length,recovered:s.outage.baseline.length-missing.length};
    audit(s,'recovery','monitor','Application probe healthy; '+missing.length+' committed records missing');
    s.outage=null;
  }
}
export function createServers(reference=false){
  const s={version:1,time:0,hosts:[],dns:null,groups:Object.fromEntries(users.map(u=>[u,[]])),rto:60,rpo:5,audit:[],log:[],issued:0,backup:null,outage:null,lastRecovery:null};
  if(reference){
    for(const name of ['alpha','bravo']){
      operate(s,'host',{name,ram:8,disk:32});
      for(const service of ['database','application'])operate(s,'deploy',{name,service});
      operate(s,'certificate',{name,days:30});
    }
    for(const [user,group]of [['svc-app','database'],['operator','view'],['engineer','admin']])operate(s,'grant',{user,group});
    operate(s,'route',{name:'alpha'});
  }
  return s;
}
export function operate(s,action,args={}){
  check(Object.hasOwn(keys,action)&&args&&typeof args==='object'&&!Array.isArray(args),'Unknown server action.');
  check(Object.keys(args).length===keys[action].length&&keys[action].every(k=>Object.hasOwn(args,k)),'Unexpected action fields.');
  check(s.log.length<450,'Study limit is 450 operations.');
  const before=probe(s),baseline=currentRows(s).slice(),name=args.name,user=args.user;
  let result=action,actor='infrastructure engineer';
  if (action==='host') {
    ident(name);integer(args.ram,1,128,'Memory GiB');integer(args.disk,1,1024,'Disk GB');
    check(s.hosts.length<8&&!s.hosts.some(h=>h.name===name),'Choose a unique name. Up to eight hosts.');
    s.hosts.push({name,ram:args.ram,disk:args.disk,services:[],power:true,network:true,expiry:0,app:1,schema:1,previous:null,image:null,rows:[],verification:null});
    result='Provisioned '+name;
  }else if(action==='grant'||action==='revoke'){
    check(users.includes(user)&&groups.includes(args.group),'Unknown identity or group.');
    if(action==='grant')s.groups[user]=[...new Set([...s.groups[user],args.group])];
    else s.groups[user]=s.groups[user].filter(g=>g!==args.group);
    result=user+' '+action+' '+args.group;
  }else if(action==='advance'){
    integer(args.seconds,1,86400,'Elapsed seconds');check(s.time+args.seconds<=31536000,'Time exceeds one synthetic year.');
    const active=s.hosts.find(x=>x.name===s.dns);
    if(before==='Healthy'&&active.expiry<=s.time+args.seconds){
      s.outage={start:active.expiry,baseline:[...baseline],source:s.dns};
      s.audit.push({at:active.expiry,action:'outage',actor:'monitor',result:'Server certificate expired'});
    }
    s.time+=args.seconds;result='Clock advanced '+args.seconds+' s';
  }else if(action==='targets'){
    integer(args.rto,0,86400,'RTO');integer(args.rpo,0,86400,'RPO');s.rto=args.rto;s.rpo=args.rpo;
  }else if(action==='damage'){
    check(s.backup,'Take a backup first.');s.backup.checksum='damaged';result='Backup integrity fault injected';
  }else if(action==='write'||action==='read'){
    check(users.includes(user),'Unknown identity.');actor=user;
    if(action==='write')ident(args.label);
    const health=probe(s);
    if(health!=='Healthy')result='Unavailable: '+health;
    else if(!account(s,user,action==='write'?'admin':'view')&&!account(s,user,'admin'))result='Access denied';
    else if(action==='read')result='Read '+currentRows(s).length+' production records';
    else {
      const h=host(s,s.dns);
      if(storage(h).disk+0.01>h.disk)result='Storage allocation exhausted';
      else{h.rows.push({id:'TX-'+(++s.issued),at:s.time,label:args.label});result='Committed '+h.rows.at(-1).id;}
    }
  }else{
    const h=host(s,name);
    if(action==='deploy'){
      check(Object.hasOwn(requirements,args.service),'Unknown service.');check(!h.services.includes(args.service),'Already deployed.');
      const usage=storage(h),need=requirements[args.service];
      check(usage.ram+need.ram<=h.ram&&usage.disk+need.disk<=h.disk,'Insufficient allocated memory or disk.');
      check(h.power&&h.network,'Host management endpoint unavailable.');h.services.push(args.service);result='Deployed '+args.service+' on '+name;
    }else if(action==='route'){s.dns=name;result='Application DNS -> '+name;}
    else if(action==='power'||action==='network'){check(typeof args.on==='boolean','Choose on or off.');h[action]=args.on;result=name+' '+action+' '+(args.on?'on':'off');}
    else if(action==='certificate'){integer(args.days,1,365,'Certificate lifetime');h.expiry=s.time+args.days*86400;result='Certificate expires at '+h.expiry+' s';}
    else if(action==='patch'){
      integer(args.version,1,2,'Application version');check(h.power&&h.network&&h.services.includes('application'),'Application management endpoint unavailable.');
      check(h.app!==args.version,'Specified version is already active.');
      h.previous={app:h.app,schema:h.schema};h.app=args.version;result=name+' application v'+h.app;
    }else if(action==='migrate'){
      check(h.power&&h.network&&h.services.includes('database'),'Database management endpoint unavailable.');h.schema=h.app;result='Database compatibility set to v'+h.schema;
    }else if(action==='rollback'){
      check(h.power&&h.network&&h.previous,'No recoverable patch checkpoint on this host.');
      h.app=h.previous.app;h.schema=h.previous.schema;h.previous=null;result='Restored application/schema v'+h.app+'/'+h.schema;
    }else if(action==='verify'){
      const health=probe(s,h);h.verification={at:s.time,app:h.app,schema:h.schema,result:health};result=name+' canary: '+health;
    }else{
      check(h.power&&h.network&&h.services.includes('database'),'Selected database unavailable.');
      if(action==='backup'){s.backup={at:s.time,source:name,checksum:hash(h.rows),restored:false,rows:[...h.rows]};result='Independent archive captured '+h.rows.length+' records';}
      if(action==='restore'){
        if(!s.backup||hash(s.backup.rows)!==s.backup.checksum) {
          result='Restore blocked: backup absent or integrity check failed';
          s.log.push([action,{...args}]);audit(s,action,actor,result);return result;
        }
        check(h.disk>=requirements.database.disk+(h.services.includes('application')?requirements.application.disk:0)+s.backup.rows.length*0.01,'Destination storage too small.');
        h.rows=[...s.backup.rows];h.image={at:s.backup.at,source:s.backup.source};s.backup.restored=true;result='Restored verified archive onto '+name;
      }
      if(action==='replicate'){
        const active=s.hosts.find(x=>x.name===s.dns);check(active&&active!==h&&probe(s)==='Healthy','Select a different host and a healthy primary.');
        check(h.disk>=storage(h).disk-h.rows.length*0.01+active.rows.length*0.01,'Replica storage too small.');
        h.rows=[...active.rows];h.image={at:s.time,source:active.name};result='Replicated '+h.rows.length+' committed records to '+name;
      }
    }
  }
  s.log.push([action,{...args}]);audit(s,action,actor,result);updateAvailability(s,before,baseline);
  return result;
}
export function assessments(s){
  const active=s.hosts.find(h=>h.name===s.dns),spare=s.hosts.filter(h=>h!==active&&probe(s,h)==='Healthy');
  const proof=s.lastRecovery;
  return [
    ['Application service and identity path',probe(s)==='Healthy'],
    ['Healthy standby with matching committed IDs',Boolean(active)&&spare.some(h=>hash(h.rows)===hash(active.rows))],
    ['Proven authorised read and prohibited visitor access',s.audit.some(a=>a.action==='read'&&a.actor==='operator'&&a.result.startsWith('Read '))&&s.audit.some(a=>a.action==='read'&&a.actor==='visitor'&&a.result==='Access denied')&&!account(s,'visitor','view')&&!account(s,'visitor','admin')],
    ['Backup checksum verified by restore',Boolean(s.backup?.restored&&hash(s.backup.rows)===s.backup.checksum)],
    ['Measured RTO and RPO meet targets',Boolean(proof&&proof.expected>0&&proof.rto<=s.rto&&proof.rpo<=s.rpo)]
  ];
}
export function exportServers(s){return {format:'oia-server-study',version:1,log:s.log.map(([act,args])=>[act,{...args}])};}
export function importServers(doc){
  check(doc?.format==='oia-server-study'&&doc.version===1&&Array.isArray(doc.log)&&doc.log.length<=450,'Unsupported server study.');
  const s=createServers();for(const row of doc.log){check(Array.isArray(row)&&row.length===2,'Invalid server action.');operate(s,...row);}return s;
}
