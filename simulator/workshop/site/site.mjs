import {footprint,gap,checkTimeline,recordKey,poseAt,sweep,validateFootprint} from './motion.mjs';
import {articulate,join} from './assembly.mjs';
import { kinds, fields, part, validate, empty, reference, radians, relativeTo, seat, corners, bracketMeasurement, projectFaces } from './geometry.mjs';
const $=id=>document.getElementById(id),transfer='oia-workshop-layout-transfer-v1',contextKey='oia-workshop-layout-context-v1';
const svg=(tag,attrs,content)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(content!==undefined)n.textContent=content;return n;};
let frameRequest=0,preview=null;
let layout=empty(),selected='',history=[],isolated=false,angle=40,scale=32,centre=[0,0,0],walk=[-4,-4,1.6],context=[],pending=null;
let hideNotice;function msg(message){$('notice').textContent=message;clearTimeout(hideNotice);hideNotice=setTimeout(()=>{$('notice').textContent='';},6000);}
function guard(fn){return e=>{try{fn(e);}catch(err){msg(err.message);}};}
function listen(id,event,fn){$(id).addEventListener(event,guard(fn));}
function form(id,fn){listen(id,'submit',e=>{e.preventDefault();fn();});}
function pick(){return layout.parts.find(a=>a.id===selected);}
function persist(){sessionStorage.setItem(transfer,JSON.stringify({layout,install:pending}));}
function mutate(fn){
  stopMotion();const next=structuredClone(layout);fn(next);articulate(next);validate(next);checkTimeline(next);
  history.push(layout);if(history.length>40)history.shift();layout=next;pending=null;persist();render();
}
function setOpts(node,data,value){node.replaceChildren(...data.map(([v,t])=>new Option(t,v)));if(data.some(([v])=>v===value))node.value=value;}
function fit(){
  const points=layout.parts.flatMap(p=>corners(p));if(!points.length){centre=[0,0,0];scale=32;return;}
  const min=[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))),max=[0,1,2].map(i=>Math.max(...points.map(p=>p[i])));
  centre=min.map((n,i)=>(n+max[i])/2);scale=Math.max(.4,Math.min(90,570/Math.max(1,max[0]-min[0]),320/Math.max(1,max[1]-min[1])));
  walk=[min[0]-.8,min[1]-.8,1.6];angle=Math.atan2(centre[1]-walk[1],centre[0]-walk[0])*180/Math.PI;$('zoom').value='1';
}
function focus(){const p=pick();if(!p)return;centre=[p.x,p.y,p.z+p.height*.5];scale=Math.min(180,180/Math.max(p.length,p.width,p.height));const a=radians(angle);walk=[p.x-3*Math.cos(a),p.y-3*Math.sin(a),1.6];draw();}
const polys=[[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]];
function draw(){
  const scene=$('scene');scene.replaceChildren();
  const view=$('view').value,zoom=Number($('zoom').value),section=Number($('section').value),visible=(preview||layout).parts.filter(p=>!isolated||p.id===selected);
  const yaw=radians(angle),c=Math.cos(yaw),s=Math.sin(yaw),m=scale*zoom;
  const base=[...visible].sort((a,b)=>(['room','cell'].includes(a.kind)?-1:0)-(['room','cell'].includes(b.kind)?-1:0)||a.z-b.z);
  const plan=([x,y])=>{x-=centre[0];y-=centre[1];return [360+m*(c*x+s*y),215+m*(s*x-c*y)];};
  const pointString=points=>points.map(p=>p.map(n=>Number(n.toFixed(2))).join(',')).join(' ');
  function plane(points,part,face=0){
    scene.append(svg('polygon',{points:pointString(points),fill:kinds[part.kind][4],'fill-opacity':['room','cell'].includes(part.kind)?.11:.78,stroke:part.id===selected?'#a63d12':'#3f6065','stroke-width':part.id===selected?2.4:1,'data-id':part.id,'data-face':face}));
  }
  const grid=step=>{for(let i=-10;i<=10;i++){const x=centre[0]+step*i,y=centre[1]+step*i;for(const ends of [[[x,centre[1]-10*step],[x,centre[1]+10*step]],[[centre[0]-10*step,y],[centre[0]+10*step,y]]]){const [a,b]=ends.map(plan);scene.append(svg('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:'#ccded6'}));}}};
  if(view==='plan'){
    grid(m>=18?1:5);
    for(const p of base){const cube=corners(p,section);if(!cube.length)continue;const shape=footprint(p).map(plan);plane(shape,p);if(p.id===selected){const [x,y]=plan([p.x,p.y]);scene.append(svg('text',{x:x+3,y:y-4},p.id));}}
  }else{
    const distance=610/m,pitch=view==='walk'?.06:.55;
    const camera=view==='walk'?{x:walk[0],y:walk[1],z:walk[2],yaw,pitch,focal:470*zoom}:{x:centre[0]-c*distance*Math.cos(pitch),y:centre[1]-s*distance*Math.cos(pitch),z:centre[2]+distance*Math.sin(pitch),yaw,pitch,focal:610};
    const faces=[];
    for(const p of base){const cube=corners(p,section);if(!cube.length)continue;if(p.proxy){const outline=footprint(p),lower=outline.map(([x,y])=>[x,y,p.z]),upper=outline.map(([x,y])=>[x,y,Math.min(section,p.z+p.height)]);faces.push({p,face:4,points:upper});for(let n=0;n<upper.length;n++){const j=(n+1)%upper.length;faces.push({p,face:n+5,points:[lower[n],lower[j],upper[j],upper[n]]});}continue;}
      const boundary=['room','cell'].includes(p.kind);for(const [i,indices] of polys.entries()){if(boundary&&i===4)continue;faces.push({p,face:i,points:indices.map(k=>cube[k])});}}
    for(const f of projectFaces(camera,faces))plane(f.projected,f.p,f.face);
  }
  if(!visible.length)scene.append(svg('text',{x:30,y:180},'Empty site. Place a room or equipment.'));
  $('pose').textContent=view==='walk'?'Eye position ('+walk.map(n=>n.toFixed(2)).join(', ')+') m. Heading '+angle.toFixed(0)+' degrees.':view==='plan'?'Floor plan in metres. X and Y are site coordinates.':'Perspective orbit centred at ('+centre.map(n=>n.toFixed(2)).join(', ')+') m.';
  const p=pick(),ref=layout.parts.find(a=>a.id===$('other').value);
  $('dimensions').textContent=p?p.id+' · '+[p.length,p.width,p.height].map(n=>n.toFixed(2)).join(' × ')+' m · centre ('+p.x.toFixed(2)+', '+p.y.toFixed(2)+') m · yaw '+p.yaw+'°':'Select an asset to inspect dimensions.';
  if(p&&ref){const local=relativeTo(p,ref);$('clearance').textContent='Relative to '+ref.id+': along X '+local.along.toFixed(3)+' m, across Y '+local.across.toFixed(3)+' m, above base '+local.above.toFixed(3)+' m. Vertical gap to top '+(local.above-ref.height).toFixed(3)+' m.';}else $('clearance').textContent='Place two parts to measure their relative coordinates.';
}
function render(){
  if(!pick())selected=layout.parts[0]?.id||'';
  const tree=[];
  function descend(parent,depth){for(const a of layout.parts.filter(p=>p.parent===parent)){tree.push([a.id,'　'.repeat(depth)+a.id+' · '+kinds[a.kind][0]]);descend(a.id,depth+1);}}
  descend('',0);setOpts($('tree'),tree,selected);
  const p=pick(),joint=layout.joints?.find(j=>j.child===selected);
  $('motion-list').textContent=(layout.motion||[]).map(k=>k.t+' s / '+k.interpolation+' / '+k.values.map(v=>v[0]+'='+Number(v[1].toFixed(3))).join(', ')).join('\n');
  $('scrub-motion').max=layout.motion?.at(-1)?.t||0;$('scrub-motion').value=0;$('proxy').value=p?.proxy?.map(v=>v.join(',')).join(' ')||'';
  $('joint-reading').textContent=joint?joint.parent+' to '+joint.child+' / '+joint.kind+' / travel '+joint.value+' / limits '+joint.min+' to '+joint.max:'Free asset. No incoming joint.';
  $('joint-value').value=joint?.value??0;$('interference-result').textContent='';
  setOpts($('parent'),[['','Site origin'],...layout.parts.filter(a=>a.id!==selected&&['room','cell'].includes(a.kind)).map(a=>[a.id,a.id])],p?.parent||'');
  setOpts($('other'),tree.filter(([id])=>id!==selected),$('other').value);
  $('fields').replaceChildren();
  if(p){for(const [key,title] of Object.entries(fields)){const label=document.createElement('label');label.textContent=title;const input=document.createElement('input');input.name=key;input.type='number';input.step='any';input.value=p[key];input.required=true;label.append(input);$('fields').append(label);}}
  $('apply').disabled=!p;$('undo-site').disabled=!history.length;$('isolate').setAttribute('aria-pressed',String(isolated));draw();
}
function chooseKind(){const kind=$('kind').value,existing=context.find(a=>a.type===kind&&!layout.parts.some(p=>p.id===a.id));let id=existing?.id||kind,n=1;while(layout.parts.some(p=>p.id===id))id=kind+'-'+(++n);$('part-id').value=id;}
function snap(n){const a=Number($('snap').value);return a?+(Math.round(n/a)*a).toFixed(5):n;}
function nudge(axis,direction){mutate(next=>{const p=next.parts.find(a=>a.id===selected);if(!p)throw Error('Select a part.');p[axis]=+(p[axis]+direction*(Number($('snap').value)||.1)).toFixed(5);});}
form('add',()=>{const id=$('part-id').value.trim(),kind=$('kind').value;mutate(next=>{next.parts.push(part(id,kind));});selected=id;render();chooseKind();});
function stopMotion(){cancelAnimationFrame(frameRequest);frameRequest=0;preview=null;}
function observeMotion(t){preview=poseAt(layout,t);$('scrub-motion').value=t;$('motion-reading').textContent=t.toFixed(3)+' s · '+preview.joints.map(j=>j.child+' '+Number(j.value.toFixed(3))+(j.kind==='revolute'?'°':j.kind==='prismatic'?' m':' fixed')).join(' / ');draw();}
listen('capture-key','click',()=>mutate(next=>recordKey(next,Number($('key-time').value),$('blend').value)));
listen('clear-keys','click',()=>mutate(next=>{next.motion=[];}));
listen('scrub-motion','input',()=>{stopMotion();observeMotion(Number($('scrub-motion').value));});
listen('play-motion','click',()=>{stopMotion();const last=layout.motion?.at(-1)?.t;if(!last)throw Error('Capture two timed poses first.');let start;function frame(now){start??=now;const t=Math.min(last,Math.max(0,(now-start)/1000));observeMotion(t);if(t<last)frameRequest=requestAnimationFrame(frame);}frameRequest=requestAnimationFrame(frame);});
listen('pause-motion','click',()=>{cancelAnimationFrame(frameRequest);frameRequest=0;});
listen('check-sweep','click',()=>{const r=sweep(layout);$('sweep-reading').textContent=r.status==='clear'?'Clear across all interpolated segments within 1 mm penetration tolerance.':r.status+' / '+r.pair.join(' and ')+' / '+r.time.toFixed(3)+' s. '+(r.status==='unresolved'?'Refine the trajectory or simplify geometry.':'Inspect the reported pose.');if(r.pair){stopMotion();observeMotion(r.time);}});
listen('set-proxy','click',()=>{const raw=$('proxy').value.trim();if(raw.length>500)throw Error('Footprint exceeds 500 characters.');mutate(next=>{const p=next.parts.find(p=>p.id===selected);if(!p)throw Error('Select a solid asset.');if(!raw){delete p.proxy;return;}p.proxy=validateFootprint(raw.split(/\s+/).map(v=>v.split(',').map(s=>s.trim()?Number(s):NaN)));});});
window.addEventListener('pagehide',stopMotion);
form('joint-form',()=>{const f=new FormData($('joint-form'));mutate(next=>join(next,$('other').value,selected,f.get('kind'),+f.get('min'),+f.get('max'),+f.get('px'),+f.get('py')));msg('Joint attached at rest.');});
form('drive-form',()=>mutate(next=>{const j=next.joints?.find(j=>j.child===selected);if(!j||j.kind==='fixed')throw Error('Select a movable joint.');j.value=Number($('joint-value').value);}));
listen('detach','click',()=>mutate(next=>{next.joints=(next.joints||[]).filter(j=>j.child!==selected);}));
listen('interference','click',()=>{const solids=layout.parts.filter(p=>!['room','cell'].includes(p.kind));const hits=[];for(let i=0;i<solids.length;i++)for(const other of solids.slice(i+1))if(gap(solids[i],other)<-.001)hits.push(solids[i].id+' / '+other.id);$('interference-result').textContent=hits.length?hits.length+' overlapping pairs: '+hits.join(', '):'No solid envelope overlaps above 1 mm.';});
form('edit',()=>{if(layout.joints?.some(j=>j.child===selected))throw Error('Detach the child before editing its rest pose.');const f=new FormData($('edit'));mutate(next=>{const p=next.parts.find(a=>a.id===selected);for(const key of Object.keys(fields))p[key]=['x','y','z'].includes(key)?snap(Number(f.get(key))):Number(f.get(key));p.parent=$('parent').value;});msg('Pose and dimensions applied.');});
form('align',()=>{const id=$('other').value;mutate(next=>{const p=next.parts.find(a=>a.id===selected),ref=next.parts.find(a=>a.id===id);if(!p||!ref)throw Error('Select two different parts.');seat(p,ref,$('axis').value);});msg('Selection aligned.');});
listen('kind','change',chooseKind);listen('tree','change',()=>{selected=$('tree').value;render();});listen('scene','click',e=>{const id=e.target.dataset.id;if(id){selected=id;render();}});
for(const [id,axis,d] of [['move-west','x',-1],['move-east','x',1],['move-south','y',-1],['move-north','y',1]])listen(id,'click',()=>nudge(axis,d));
listen('remove','click',()=>{if(!pick())return;mutate(next=>{const removed=next.parts.find(a=>a.id===selected);for(const p of next.parts)if(p.parent===selected)p.parent=removed.parent;next.parts=next.parts.filter(a=>a.id!==selected);next.joints=(next.joints||[]).filter(j=>j.parent!==selected&&j.child!==selected);});msg('Part removed. Its children remain in the site.');});
listen('undo-site','click',()=>{stopMotion();if(!history.length)return;layout=history.pop();pending=null;persist();render();});
listen('sample','click',()=>{mutate(next=>{next.parts=reference().parts;next.joints=[];next.motion=[];});fit();render();msg('Training layout loaded. Undo design edit restores the previous layout.');});
listen('mount','click',()=>{const measured=bracketMeasurement(layout);if(!context.some(a=>a.type==='conveyor'&&a.id===measured.conveyor)||!context.some(a=>a.type==='bracket'&&a.id===measured.bracket))throw Error('Place matching conveyor and bracket IDs in the packaging cell before transfer.');pending=measured;persist();$('mount-result').textContent='Ready to transfer '+measured.position.toFixed(3)+' m from belt entry. Return to the workshop to apply.';});
for(const id of ['view','section','zoom','other'])listen(id,'change',draw);
for(const [id,d] of [['left',1],['right',-1]])listen(id,'click',()=>{angle=(angle+d*15+360)%360;draw();});
for(const [id,d] of [['forward',1],['back',-1]])listen(id,'click',()=>{const a=radians(angle),p=$('view').value==='walk'?walk:centre;p[0]+=d*.5*Math.cos(a);p[1]+=d*.5*Math.sin(a);draw();});
listen('focus','click',focus);listen('fit','click',()=>{fit();draw();});listen('isolate','click',()=>{isolated=!isolated;render();});
listen('return','click',persist);
setOpts($('kind'),Object.entries(kinds).map(([k,v])=>[k,v[0]]),'room');
try {const incoming=JSON.parse(sessionStorage.getItem(transfer)||'null');if(incoming){const candidate=validate(articulate(validate(incoming.layout??incoming)));checkTimeline(candidate);layout=candidate;}context=JSON.parse(sessionStorage.getItem(contextKey)||'[]');} catch(err){msg(err.message);}
chooseKind();fit();render();
$('part-id').disabled=false;

document.body.inert = false;
