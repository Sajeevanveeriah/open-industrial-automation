export const subjects={
 travel:{title:'Distance, scale and sampling',period:'First day',bench:'../index.html',action:'Build a packaging belt. Move its sensor and compare first-detection scans.',instrument:'Belt scale and first beam event',wrong:'Clock playback speed is separate from belt speed.'},
 yield:{title:'Mass, yield and uncertainty',period:'First week',bench:'../production/index.html',action:'Compare intake, loss and accepted mass. State the time boundary before reporting yield.',instrument:'Intake and accepted mass ledger',wrong:'Yield uses intake mass in the denominator. Saleable mass excludes scrap.'},
 address:{title:'Binary, hexadecimal and CIDR',period:'First week',bench:'../infrastructure/index.html',action:'Build an access network and choose a valid client address with the correct prefix.',instrument:'Interface address, route and ARP table',wrong:'The network and broadcast addresses cannot be assigned to hosts in this exercise.'},
 rack:{title:'Power, bytes and retention',period:'30 days',bench:'../infrastructure/index.html',action:'Commission surveillance storage and compare payload with the available volume.',instrument:'Recorder register, link load and disk capacity',wrong:'A byte contains eight bits. A decimal gigabyte contains one billion bytes.'},
 control:{title:'Boolean logic and programming',period:'First week',bench:'../practice/index.html',action:'Run the same sampled input in Python, TypeScript or C++ subset notation, then program rising-edge detection in the PLC bench.',instrument:'Scan-by-scan input and counter',wrong:'A level remains true on every high scan. A rising edge occurs once until it rearms.'},
 motion:{title:'Vectors, frames and speed',period:'60 days',bench:'../robot/index.html',action:'Teach a target in a rotated base frame. Compare its global position with the accepted carton.',instrument:'Cell-frame tool coordinates',wrong:'Rotate the local vector before adding the base translation.'},
 spc:{title:'Mean, range and process variation',period:'60 days',bench:'../production/index.html',action:'Measure a short production run and distinguish average fill from the variation within it.',instrument:'Checkweigher samples in grams',wrong:'A correct mean can conceal low and high fills. The range uses both extremes.'},
 recovery:{title:'Recovery and engineering economics',period:'90 days',bench:'../commissioning/index.html',action:'Predict the restoration time, prove data retrieval and compare two standby designs.',instrument:'Outage, restore and validation timestamps',wrong:'The recovery interval ends when the application is usable and its records are verified.'}
};
const choices=(seed,arr)=>arr[seed%arr.length];
export function trial(id,seed){
  if(!Object.hasOwn(subjects,id)||!Number.isInteger(seed)||seed<0||seed>100000)throw Error('Unknown exercise or seed.');
  const a=1+(seed*17)%9,b=2+(seed*13)%7;
  if(id==='travel'){
    const distance=(a+1)*.25,speed=choices(b,[.125,.25,.5]),seconds=distance/speed;
    return {question:'The beam is '+distance+' m downstream; the belt moves at '+speed+' m/s. Predict arrival and the first 100 ms scan at or after arrival.',labels:['Arrival (s)','Scan number'],expected:[seconds,Math.ceil(seconds*10)],tolerance:[.001,0],explanation:'Time = distance / speed; scans = ceiling(time / 0.1 s).'};
  }
  if(id==='yield'){
    const incoming=1000+a*100,loss=(a+b)*10,hold=b*5;
    return {question:'A run receives '+incoming+' kg. Rejection is '+loss+' kg and '+hold+' kg of unspoilt output is held. Calculate saleable mass and its percentage of intake.',labels:['Saleable mass (kg)','Saleable yield (%)'],expected:[incoming-loss-hold,100*(incoming-loss-hold)/incoming],tolerance:[.001,.011],explanation:'Saleable output = intake - rejection - held. Divide by intake and multiply by 100.'};
  }
  if(id==='address'){
    const prefix=choices(a,[25,26,27,28]),block=2**(32-prefix),last=1+(seed*19+53)%253,network=Math.floor(last/block)*block;
    return {question:'The client is 10.32.4.'+last+'/'+prefix+'. Calculate the network’s final octet and the number of usable host addresses. The client octet is 0x'+last.toString(16).toUpperCase()+' in hexadecimal.',labels:['Network final octet (decimal)','Usable host addresses'],expected:[network,block-2],tolerance:[0,0],explanation:'Block size = 2 to the power (32 - prefix). Round the octet down to the block boundary, then reserve the network and broadcast addresses.'};
  }
  if(id==='rack'){
    const cams=a+1,rate=b,hours=8*(a%3+1),duty=choices(b,[.25,.5,1]);
    return {question:cams+' cameras at '+rate+' Mbit/s each record for '+hours+' h at '+(100*duty)+'% duty. Determine simultaneous peak bandwidth and stored payload, excluding overhead.',labels:['Peak bandwidth (Mbit/s)','Payload (decimal GB)'],expected:[cams*rate,cams*rate*3600*hours*duty/8000],tolerance:[0,.0011],explanation:'Peak assumes simultaneous streams. Storage scales peak Mbit/s by seconds and recording duty, then divides by 8000.'};
  }
  if(id==='control'){
    const pattern=choices(seed,['00111001100','01111001110100','1100011100110','01110011101','0110001011110','001101001110']);
    let edges=0,previous='0';for(const bit of pattern){if(previous==='0'&&bit==='1')edges++;previous=bit;}
    return {question:'At successive 100 ms scans the input reads '+pattern+'. Predict the level-sensitive and rising-edge counts. The retained previous input starts low.',labels:['Level count','Rising-edge count'],expected:[Array.from(pattern).filter(v=>v==='1').length,edges],tolerance:[0,0],pattern,explanation:'Mark each high sample, then mark only transitions from 0 to 1.'};
  }
  if(id==='motion'){
    const yaw=choices(seed,[0,90,180,270]),x=a/10,y=b/10,u=(a+2)/10,v=b/20,r=yaw*Math.PI/180;
    return {question:'Base translation is ('+x+', '+y+') m, yaw '+yaw+' degrees anticlockwise. A target in its frame is ('+u+', '+v+') m. Locate it in the cell frame.',labels:['Cell X (m)','Cell Y (m)'],expected:[x+u*Math.cos(r)-v*Math.sin(r),y+u*Math.sin(r)+v*Math.cos(r)],tolerance:[.001,.001],explanation:'X = base X + u cos(yaw) - v sin(yaw); Y = base Y + u sin(yaw) + v cos(yaw).'};
  }
  if(id==='spc'){
    const readings=[1000+a,1000-b,1000+2*b,1000-2*a,1000+a+b];
    return {question:'Five sorted packs weigh '+readings.join(', ')+' g. Determine the mean and range for this run.',labels:['Mean fill (g)','Observed range (g)'],expected:[readings.reduce((a,b)=>a+b)/5,Math.max(...readings)-Math.min(...readings)],tolerance:[.01,.001],explanation:'Mean = sum / number of observations. Range = maximum - minimum.'};
  }
  const fail=60+a*2,last=fail-b,ready=fail+2*a+b;
  return {question:'The outage starts at minute '+fail+'. Latest recoverable record is stamped minute '+last+'. A test user retrieves it at minute '+ready+'. Measure recovery and record age.',labels:['Recovery interval (min)','Recovery point age (min)'],expected:[ready-fail,fail-last],tolerance:[0,0],explanation:'Recovery interval = successful retrieval - failure. Recovery point age = failure - last protected record.'};
}
export function grade(id,seed,answers){
  const q=trial(id,seed);if(!Array.isArray(answers)||answers.length!==2||!answers.every(Number.isFinite))throw Error('Enter two finite predictions.');
  return q.expected.map((n,i)=>Math.abs(answers[i]-n)<=q.tolerance[i]+1e-9);
}
export function proof(history,id){
  const good=history.filter(d=>d.id===id&&d.type==='challenge'&&grade(id,d.seed,d.answers).every(Boolean));
  return new Set(good.map(r=>JSON.stringify(trial(id,r.seed).expected))).size>=2;
}
export function corpus(raw){
  if(!raw)return [];
  if(raw.version!==1||!Array.isArray(raw.history)||raw.history.length>240)throw Error('Invalid foundations register.');
  return raw.history.map(r=>{if(!['worked','challenge'].includes(r.type))throw Error('Unknown record type.');grade(r.id,r.seed,r.answers);return {id:r.id,seed:r.seed,type:r.type,answers:[...r.answers]};});
}
