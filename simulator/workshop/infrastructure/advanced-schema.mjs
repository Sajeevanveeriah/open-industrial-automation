const ok=(value,message)=>{if(!value)throw Error(message);};
export const range=(x,a,b)=>Number.isFinite(x)&&x>=a&&x<=b;
export const custodySteps=['Preserve','Restrict access','Escalate egress','Accept handover'];
export const custodyRoles=['Operator','IT custodian','Facilities lead','Duty engineer'];
export function inspectCustody(advanced,rack){
  const byClip=new Map();
  for(const event of advanced.custody){
    const survey=advanced.surveys.find(s=>s.clip===event.clip&&s.camera===event.camera&&s.recorder===event.recorder);
    const chain=byClip.get(event.clip)||[],i=chain.length;
    const clip=rack.clips.find(c=>c.id===event.clip);
    ok(survey&&i<4&&event.role===custodyRoles[i]&&event.action===custodySteps[i]+' / '+event.clip,'Invalid custody sequence or survey.');
    ok(rack.devices.some(d=>d.id===event.viewer&&d.kind==='viewer')&&event.time>=(clip?.end??0)&&event.time>=(chain.at(-1)?.time??0),'Invalid custody witness or chronology.');
    if(i===3)ok(chain.every(e=>e.actor!==event.actor),'An independent witness must accept the handover.');
    chain.push(event);byClip.set(event.clip,chain);
  }
  return byClip;
}
export function freshAdvanced(){
  return {bundle:false,snooping:true,subscribers:[],ipv6:[],membership:'239.24.1.1',sampleMs:4,detectMs:8,forwardMs:12,deadlineMs:30,
    mirrorSwitch:'',mirrorPort:1,lagGroup:[],lens:{camera:'',x:0,y:0,yaw:0,hfov:60,width:1920,height:1080,fps:15,range:12,targetX:5,targetY:0,privateX:4,privateY:4,featureM:.15,minPixels:30},
    surveys:[],custody:[],report:[]};
}
const id=s=>typeof s==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,23}$/.test(s);
export function ipv6(s){
  if(typeof s!=='string'||!s.length||s.length>39||s.includes('.')||s.includes('%'))throw Error('Enter an IPv6 address in hexadecimal notation.');
  const sides=s.toLowerCase().split('::');if(sides.length>2)throw Error('IPv6 may contain only one compressed group.');
  const parse=x=>x?x.split(':').map(h=>{ok(/^[a-f0-9]{1,4}$/.test(h),'Invalid IPv6 hextet.');return parseInt(h,16);}):[];
  const a=parse(sides[0]),b=parse(sides[1]);const n=8-a.length-b.length;
  ok(sides.length===1?n===0:n>=1,'Invalid IPv6 length.');
  return [...a,...Array(n).fill(0),...b].reduce((v,h)=>(v<<16n)+BigInt(h),0n);
}
export function checkAdvanced(a,r){
  const ids=r.devices.map(d=>d.id),linkIds=r.links.map(l=>l.id);
  ok(a&&Object.keys(a).every(k=>Object.hasOwn(freshAdvanced(),k)),'Unknown experiment setting.');
  ok(typeof a.bundle==='boolean'&&typeof a.snooping==='boolean'&&Array.isArray(a.subscribers)&&a.subscribers.length<=48&&a.subscribers.every(i=>ids.includes(i)),'Invalid multicast experiment.');
  ok(Array.isArray(a.lagGroup)&&a.lagGroup.length<=8&&a.lagGroup.every(i=>linkIds.includes(i))&&new Set(a.lagGroup).size===a.lagGroup.length,'Invalid aggregation group.');
  ok(/^239\.(?:\d{1,3}\.){2}\d{1,3}$/.test(a.membership)&&a.membership.split('.').every(o=>Number(o)<=255),'Choose an administratively scoped 239.x.x.x group.');
  ok(Array.isArray(a.ipv6)&&a.ipv6.length<=48&&new Set(a.ipv6.map(v=>v.id)).size===a.ipv6.length,'Invalid IPv6 address table.');
  for(const x of a.ipv6){ok(ids.includes(x.id)&&Number.isInteger(x.prefix)&&range(x.prefix,1,128),'Invalid IPv6 interface.');const n=ipv6(x.address);ok(n!==0n&&n!==1n&&n>>120n!==255n,'Assign a unicast IPv6 address.');}
  for(const k of ['detectMs','forwardMs','sampleMs','deadlineMs'])ok(Number.isInteger(a[k])&&range(a[k],k==='sampleMs'?1:0,2000),'Invalid convergence timing.');
  ok((a.mirrorSwitch===''||ids.includes(a.mirrorSwitch))&&Number.isInteger(a.mirrorPort)&&range(a.mirrorPort,1,48),'Invalid mirror source.');
  const l=a.lens;ok(l&&Object.keys(l).every(k=>Object.hasOwn(freshAdvanced().lens,k))&&(l.camera===''||ids.includes(l.camera)),'Invalid camera mount.');
  for(const k of ['x','y','targetX','targetY','privateX','privateY'])ok(range(l[k],-500,500),'Invalid floor coordinate.');
  ok(range(l.yaw,-360,360)&&range(l.hfov,5,170)&&range(l.width,160,8192)&&range(l.height,120,8192)&&range(l.fps,1,240)&&range(l.range,.1,200)&&range(l.featureM,.001,2)&&range(l.minPixels,1,1000),'Invalid optical requirement.');
  a.surveys??=[];
  ok(Array.isArray(a.surveys)&&a.surveys.length<=120&&a.surveys.every(x=>Number.isInteger(x.clip)&&x.clip>0&&ids.includes(x.camera)&&ids.includes(x.recorder)&&typeof x.signature==='string'&&x.signature.length<512),'Invalid optical survey evidence.');
  ok(Array.isArray(a.custody)&&a.custody.length<=120&&a.custody.every(e=>id(e.actor)&&typeof e.action==='string'&&e.action.length<100&&Number.isInteger(e.time)&&e.time>=0&&e.time<=r.clock),'Invalid custody record.');
  inspectCustody(a,r);
  ok(Array.isArray(a.report)&&a.report.length<=40&&a.report.every(s=>typeof s==='string'&&s.length<=700),'Invalid acceptance report.');return a;
}
