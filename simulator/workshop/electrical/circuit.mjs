export const catalogue = {
  supply:['+','0V'], fuse:['in','out'], switch:['in','out'], coil:['A1','A2'], contact:['13','14'], lamp:['+','-'], input:['signal','common'], terminal:['1','2'], resistor:['1','2']
};
export const blank=()=>({version:1,parts:[],wires:[]});
const fail=msg=>{throw Error(msg);};
export function place(net,kind,id){
  if(!Object.hasOwn(catalogue,kind)||!/^\w[\w-]{0,30}$/.test(id)||net.parts.some(p=>p.id===id)||net.parts.length>=40)fail('Choose a unique component label (up to 31 characters).');
  if(kind==='supply'&&net.parts.some(p=>p.kind==='supply'))fail('This bench supports one isolated DC supply.');
  const p={id,kind,on:kind!=='switch',ohms:kind==='coil'?480:kind==='input'?4700:240,volts:24,rating:1,coil:'',blown:false};
  net.parts.push(p);return p;
}
export function pins(net){return net.parts.flatMap(p=>catalogue[p.kind].map(name=>p.id+'.'+name));}
export function wire(net,a,b){
  const available=pins(net);if(a===b||!available.includes(a)||!available.includes(b)||net.wires.length>=120)fail('Select two distinct supported terminals.');
  if(net.wires.some(([c,d])=>a===c&&b===d||a===d&&b===c))fail('Terminals already connected.');
  net.wires.push([a,b]);
}
function branches(net,energised){
  return net.parts.flatMap(p=>{
    let r=p.ohms;
    switch(p.kind){
      case 'supply':return [];
      case 'switch':if(!p.on)return [];r=.01;break;
      case 'contact':if(!energised.has(p.coil))return [];r=.01;break;
      case 'fuse':if(p.blown)return [];r=.02;break;
      case 'terminal':r=.001;break;
    }
    const [a,b]=catalogue[p.kind].map(k=>p.id+'.'+k);return [{p,a,b,r}];
  });
}
function network(net,energised){
  const terminals=pins(net),leader=new Map(terminals.map(k=>[k,k]));
  const root=k=>{while(leader.get(k)!==k)k=leader.get(k);return k;};
  for(const [a,b] of net.wires)leader.set(root(a),root(b));
  const supply=net.parts.find(p=>p.kind==='supply'),edges=branches(net,energised).map(e=>({...e,a:root(e.a),b:root(e.b)}));
  const values=new Map(),currents={};let supplyAmps=0;
  if(supply){
    const plus=root(supply.id+'.+'),zero=root(supply.id+'.0V'),vs=supply.on?supply.volts:0;
    const reached=new Set([plus,zero]);
    for(let n=0;n<terminals.length;n++){const before=reached.size;for(const e of edges)if(reached.has(e.a)||reached.has(e.b)){reached.add(e.a);reached.add(e.b);}if(before===reached.size)break;}
    const nodes=[...reached].filter(k=>k!==zero),N=nodes.length,M=nodes.map(()=>Array(N+1).fill(0));
    const stamp=(a,b,g,i=0)=>{const j=nodes.indexOf(a),k=nodes.indexOf(b);if(j>=0){M[j][j]+=g;M[j][N]+=i;if(k>=0)M[j][k]-=g;}if(k>=0){M[k][k]+=g;M[k][N]-=i;if(j>=0)M[k][j]-=g;}};
    stamp(plus,zero,5,5*vs);
    for(const e of edges)if(reached.has(e.a))stamp(e.a,e.b,1/e.r);
    for(let i=0;i<N;i++){
      const d=M[i][i];if(Math.abs(d)<1e-12)fail('Singular circuit.');for(let k=i;k<=N;k++)M[i][k]/=d;
      for(let j=0;j<N;j++)if(j!==i){const f=M[j][i];for(let k=i;k<=N;k++)M[j][k]-=f*M[i][k];}
    }
    values.set(zero,0);nodes.forEach((k,j)=>values.set(k,M[j][N]));supplyAmps=(vs-values.get(plus))/.2;
  }
  for(const e of edges)currents[e.p.id]=((values.get(e.a)??0)-(values.get(e.b)??0))/e.r;
  return {voltage:Object.fromEntries(terminals.map(k=>[k,values.get(root(k))??null])),currents,supplyAmps};
}
export function sample(net,previous=[]){
  const energised=new Set(previous),result=network(net,energised);
  const voltage=p=>{const [a,b]=catalogue[p.kind].map(k=>result.voltage[p.id+'.'+k]);return a===null||b===null?0:a-b;};
  for(const p of net.parts)if(p.kind==='fuse'&&Math.abs(result.currents[p.id]||0)>p.rating)p.blown=true;
  return {...result,coils:net.parts.filter(p=>p.kind==='coil'&&Math.abs(voltage(p))>=18).map(p=>p.id),live:net.parts.filter(p=>['input','lamp'].includes(p.kind)&&voltage(p)>=12).map(p=>p.id)};
}
export function reference(){
  const n=blank();for(const [k,id] of [['supply','PS1'],['fuse','F1'],['switch','S1'],['coil','K1'],['contact','K1-NO'],['input','DI0'],['lamp','H1']])place(n,k,id);
  n.parts.find(p=>p.kind==='contact').coil='K1';
  for(const [a,b] of [['PS1.+','F1.in'],['F1.out','S1.in'],['S1.out','K1.A1'],['K1.A2','PS1.0V'],['F1.out','K1-NO.13'],['K1-NO.14','DI0.signal'],['DI0.common','PS1.0V'],['K1-NO.14','H1.+'],['H1.-','PS1.0V']])wire(n,a,b);
  return n;
}
export function readNet(raw){
  if(!raw||raw.version!==1||!Array.isArray(raw.parts)||!Array.isArray(raw.wires))fail('Invalid circuit.');
  const n=blank();
  for(const q of raw.parts){const p=place(n,q.kind,q.id);for(const [key,lo,hi] of [['ohms',.1,1e6],['volts',0,30],['rating',.05,10]]){if(!Number.isFinite(q[key])||q[key]<lo||q[key]>hi)fail('Invalid component value.');p[key]=q[key];}
    if(typeof q.on!=='boolean'||typeof q.blown!=='boolean'||typeof q.coil!=='string'||q.coil.length>31)fail('Invalid contact state.');
    Object.assign(p,{on:q.on,blown:q.blown,coil:q.coil});}
  for(const pair of raw.wires){if(!Array.isArray(pair)||pair.length!==2)fail('Invalid wire.');wire(n,...pair);}return n;
}
