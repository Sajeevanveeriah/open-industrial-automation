import {drawings,drawingBrief,attempt,recordPrediction,angleProfile,geometryKey,checkBracket} from './bracket-practical.mjs';
import {initialPart,analyse,moveVertex,resizeSketch,stlBytes,drawingSvg,projectContext,persistPart} from './part-model.mjs';
const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg',rad=Math.PI/180;
let part=initialPart(),context=null,selected=3,undo=[],redo=[],drag=null,sliderStart=null,sketchMap,model,az=-53,el=27,orbit=null;
let activeAttempt=null,verifiedKey='',freePart=null,practicalMounted=false;
const status=s=>{$('status').textContent=s;if(activeAttempt)$('drawing-status').textContent=s;},fmt=(n,d=3)=>Number(n.toFixed(d)).toString();
try{context=projectContext(localStorage);if(context.part)part=structuredClone(context.part);}catch(e){status('Saved project unavailable: '+e.message);}
function element(parent,tag,attrs,text){const e=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;parent.append(e);return e;}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function remember(previous){if(same(previous,part))return;undo.push(previous);if(undo.length>60)undo.shift();redo=[];}
function apply(next,record=true){const prior=part,result=analyse(next);
  if(activeAttempt&&geometryKey(next)!==geometryKey(prior)){
    if(activeAttempt.prediction===null)throw Error('Record your predicted volume before editing the starter.');
    activeAttempt.edited=true;verifiedKey='';practicalMounted=false;$('drawing-checks').replaceChildren();$('inspect-mounted').hidden=true;$('drawing-status').textContent='Geometry changed. Verify this revision before mounting.';
  }
  part=next;model=result;if(record)remember(prior);render();}
function perform(fn){try{fn();}catch(e){status(e.message);}}
function repaintSolid(){
  const canvas=$('solid'),ctx=canvas.getContext('2d'),{p,i}=model.mesh,n=p.length/3,points=[],min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let j=0;j<p.length;j++){const k=j%3;min[k]=Math.min(min[k],p[j]);max[k]=Math.max(max[k],p[j]);}
  const centre=max.map((v,k)=>(v+min[k])/2),span=Math.hypot(...max.map((v,k)=>v-min[k])),scale=canvas.height*.83/span;
  const yaw=az*rad,pitch=el*rad,c=Math.cos(yaw),s=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
  const project=(x,y,z)=>[canvas.width/2+(-s*x+c*y)*scale,canvas.height/2-(-c*sp*x-s*sp*y+cp*z)*scale,cp*(c*x+s*y)+sp*z];
  for(let j=0;j<n;j++)points.push(project(p[3*j]-centre[0],p[3*j+1]-centre[1],p[3*j+2]-centre[2]));
  ctx.clearRect(0,0,canvas.width,canvas.height);const bg=ctx.createLinearGradient(0,0,0,canvas.height);bg.addColorStop(0,'#f1f6f4');bg.addColorStop(1,'#d6e3de');ctx.fillStyle=bg;ctx.fillRect(0,0,canvas.width,canvas.height);
  const faces=[],edgeMap=new Map();
  for(let j=0;j<i.length;j+=3){
    const a=i[j],b=i[j+1],d=i[j+2],v=points[a],w=points[b],q=points[d];if((w[0]-v[0])*(q[1]-v[1])-(w[1]-v[1])*(q[0]-v[0])>=0)continue;
    const u=[0,1,2].map(k=>p[3*b+k]-p[3*a+k]),t=[0,1,2].map(k=>p[3*d+k]-p[3*a+k]),normal=[u[1]*t[2]-u[2]*t[1],u[2]*t[0]-u[0]*t[2],u[0]*t[1]-u[1]*t[0]],len=Math.hypot(...normal);
    const k=.55+.42*Math.max(0,(normal[0]*.25-normal[1]*.55+normal[2]*.8)/len);
    faces.push({p:[v,w,q],z:(v[2]+w[2]+q[2])/3,colour:'rgb('+[64,154,130].map(x=>Math.round(x*k)).join(',')+')'});
    for(const [j,h] of [[a,b],[b,d],[d,a]]){
      const id=j<h?j+'_'+h:h+'_'+j,prev=edgeMap.get(id),unit=normal.map(v=>v/len);
      if(prev)prev.crease=prev.normal.reduce((sum,v,k)=>sum+v*unit[k],0)<.94;else edgeMap.set(id,{j,h,normal:unit,crease:true});
    }
  }
  for(const f of faces.sort((a,b)=>a.z-b.z)){
    ctx.fillStyle=f.colour;ctx.strokeStyle=f.colour;ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(...f.p[0].slice(0,2));for(const v of f.p.slice(1))ctx.lineTo(...v.slice(0,2));ctx.closePath();ctx.fill();ctx.stroke();
  }
  ctx.strokeStyle='#224f45';ctx.lineWidth=1.2;
  for(const {j,h,crease} of edgeMap.values())if(crease){ctx.beginPath();ctx.moveTo(...points[j].slice(0,2));ctx.lineTo(...points[h].slice(0,2));ctx.stroke();}
  const origin=[53,canvas.height-40];
  for(const [v,colour,text] of [[[1,0,0],'#994322','X'],[[0,1,0],'#337047','Y'],[[0,0,1],'#346591','Z']]){
    const q=project(...v),x=origin[0]+(q[0]-canvas.width/2)*30/scale,y=origin[1]+(q[1]-canvas.height/2)*30/scale;ctx.strokeStyle=colour;ctx.fillStyle=colour;ctx.beginPath();ctx.moveTo(...origin);ctx.lineTo(x,y);ctx.stroke();ctx.font='bold 13px system-ui';ctx.fillText(text,x+2,y-2);
  }
  $('elevation').value=el;$('solidInfo').textContent='Orbit '+fmt(az,0)+'° · elevation '+fmt(el,0)+'° · '+i.length/3+' triangles · '+fmt((max[0]-min[0])*1000)+' × '+fmt((max[1]-min[1])*1000)+' × '+fmt((max[2]-min[2])*1000)+' mm';
}
function layout(){const minX=Math.min(model.minX,part.kind==='revolve'?part.axisX:model.minX),width=model.minX+model.width-minX;
  const scale=Math.min(408/Math.max(1,width),238/Math.max(1,model.height));
  return {scale,offsetX:(520-width*scale)/2-minX*scale,offsetY:(340+model.height*scale)/2+model.minZ*scale};}
function sketch(){
  if(!drag)sketchMap=layout();const m=sketchMap,X=x=>m.offsetX+x*m.scale,Y=z=>m.offsetY-z*m.scale;
  const grid=$('grid');grid.replaceChildren();let spacing=part.snap;while(spacing*m.scale<20)spacing*=2;
  for(let x=Math.ceil(-m.offsetX/m.scale/spacing)*spacing;X(x)<520;x+=spacing){element(grid,'line',{x1:X(x),x2:X(x),y1:12,y2:320,stroke:'#dde7e3'});element(grid,'text',{x:X(x)+2,y:333,'font-size':10,fill:'#485c56'},fmt(x,1));}
  for(let z=Math.ceil((m.offsetY-320)/m.scale/spacing)*spacing;Y(z)>8;z+=spacing){element(grid,'line',{x1:20,x2:505,y1:Y(z),y2:Y(z),stroke:'#dde7e3'});element(grid,'text',{x:2,y:Y(z)-2,'font-size':10,fill:'#485c56'},fmt(z,1));}
  if(part.kind==='revolve')element(grid,'line',{x1:X(part.axisX),x2:X(part.axisX),y1:10,y2:318,stroke:'#a95226','stroke-dasharray':'6 4','stroke-width':2});
  $('outline').setAttribute('d',part.profile.map(([x,z],i)=>(i?' L':'M')+X(x)+' '+Y(z)).join('')+' Z');
  const handles=$('handles');
  if(handles.children.length!==part.profile.length*2){
    handles.replaceChildren();part.profile.forEach((_,i)=>{element(handles,'circle',{tabindex:0,role:'button','data-index':i,r:7});element(handles,'text',{},String(i+1));});
    $('selected').replaceChildren(...part.profile.map((_,i)=>new Option('Vertex '+(i+1),i)));
  }
  part.profile.forEach(([x,z],i)=>{const h=handles.children[2*i],label=handles.children[2*i+1];h.setAttribute('cx',X(x));h.setAttribute('cy',Y(z));h.setAttribute('aria-pressed',String(i===selected));h.setAttribute('aria-label','Vertex '+(i+1)+', X '+fmt(x)+' mm, Z '+fmt(z)+' mm');label.setAttribute('x',X(x)+8);label.setAttribute('y',Y(z)-5);});
  $('selected').value=selected;$('px').value=fmt(part.profile[selected][0],6);$('pz').value=fmt(part.profile[selected][1],6);
}
function render(){
  selected=Math.min(selected,part.profile.length-1);sketch();repaintSolid();
  $('feature').value=part.kind;$('featureBadge').textContent=part.kind==='extrude'?'Extruded solid':'Revolved solid';$('snap').value=part.snap;
  $('width').value=fmt(model.width,6);$('height').value=fmt(model.height,6);$('axis').value=part.axisX;$('depth').value=part.depth;$('depthSlide').max=Math.max(200,part.depth);$('depthSlide').value=part.depth;
  $('extrudeControls').hidden=part.kind!=='extrude';$('revolveControls').hidden=part.kind!=='revolve';
  $('measure').textContent='Section '+fmt(model.areaMM2)+' mm² · nominal solid volume '+fmt(model.volumeMM3/1000)+' cm³.';
  $('undo').disabled=!undo.length;$('redo').disabled=!redo.length;$('project').textContent=context?'Active learner: '+context.profile+'. '+(part.mount?'Mounted on '+part.mount.assetId+'.':'Part is independent of the cell.'):'Active project could not be opened.';
  $('mount').textContent=context?.bracket?'Mount on '+context.bracket+' and return':'Place bracket, mount and return';$('mount').disabled=$('save').disabled=!context;
  $('wall-form').hidden=!activeAttempt;$('practical').hidden=!activeAttempt;$('practical-start').hidden=Boolean(activeAttempt);
  $('save').textContent=activeAttempt?'Save practical draft':'Save into active project';
  if(activeAttempt){
    $('mount').disabled=true;$('mount').textContent='Mount using drawing verification';
    $('mount-verified').disabled=!context||practicalMounted||verifiedKey!==geometryKey(part);
    $('volume-prediction').disabled=activeAttempt.edited;
    $('predict-form').querySelector('button').disabled=activeAttempt.edited;
  }
}
const svgXY=e=>new DOMPoint(e.clientX,e.clientY).matrixTransform($('sketch').getScreenCTM().inverse());
$('handles').onpointerdown=e=>{const index=e.target.dataset.index;if(index===undefined)return;e.preventDefault();selected=Number(index);e.target.focus();drag={previous:structuredClone(part),pointer:e.pointerId};$('sketch').setPointerCapture(e.pointerId);sketch();};
$('sketch').onpointermove=e=>{if(!drag||e.pointerId!==drag.pointer)return;perform(()=>{const v=svgXY(e);apply(moveVertex(part,selected,(v.x-sketchMap.offsetX)/sketchMap.scale,(sketchMap.offsetY-v.y)/sketchMap.scale),false);status('Editing vertex '+(selected+1)+'.');});};
$('sketch').onpointerup=e=>{if(!drag)return;const prior=drag.previous;drag=null;remember(prior);render();};
$('sketch').onpointercancel=()=>{if(drag){const prior=drag.previous;drag=null;apply(prior,false);}};
$('handles').onkeydown=e=>{const idx=e.target.dataset.index;if(idx===undefined)return;selected=Number(idx);if(e.key==='Enter'||e.key===' '){e.preventDefault();sketch();return;}
 const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]}[e.key];if(!d)return;e.preventDefault();perform(()=>{const p=part.profile[selected],n=part.snap*(e.shiftKey?10:1);apply(moveVertex(part,selected,p[0]+d[0]*n,p[1]+d[1]*n,false));status('Nudged vertex '+(selected+1)+'.');});};
$('selected').onchange=e=>{selected=+e.target.value;sketch();};
$('vertexForm').onsubmit=e=>{e.preventDefault();perform(()=>apply(moveVertex(part,selected,Number($('px').value),Number($('pz').value),false)));};
$('dimensions').onsubmit=e=>{e.preventDefault();perform(()=>apply(resizeSketch(part,Number($('width').value),Number($('height').value))));};
for(const [id,key] of [['snap','snap'],['axis','axisX'],['depth','depth']])$(id).onchange=e=>{perform(()=>{if(!e.target.value.trim())throw Error('Enter a dimension.');apply({...part,[key]:Number(e.target.value)});});render();};
$('feature').onchange=e=>{perform(()=>apply({...part,kind:e.target.value}));render();};
$('depthSlide').oninput=e=>{sliderStart??=structuredClone(part);perform(()=>apply({...part,depth:Number(e.target.value)},false));};
$('depthSlide').onchange=()=>{if(sliderStart){remember(sliderStart);sliderStart=null;render();}};
$('undo').onclick=()=>{if(undo.length){redo.push(part);apply(undo.pop(),false);status('Undid one edit.');}};
$('redo').onclick=()=>{if(redo.length){undo.push(part);apply(redo.pop(),false);status('Reapplied one edit.');}};
function orbitBy(a,e){az=(az+a+540)%360-180;el=Math.min(80,Math.max(-70,el+e));repaintSolid();}
$('solid').onpointerdown=e=>{orbit={x:e.clientX,y:e.clientY};e.target.setPointerCapture(e.pointerId);};$('solid').onpointermove=e=>{if(orbit){orbitBy((orbit.x-e.clientX)*.5,(e.clientY-orbit.y)*.5);orbit={x:e.clientX,y:e.clientY};}};
$('solid').onpointerup=$('solid').onpointercancel=()=>{orbit=null;};
$('solid').onkeydown=e=>{const d={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,5],ArrowDown:[0,-5]}[e.key];if(d){e.preventDefault();orbitBy(...d);}};
$('left').onclick=()=>orbitBy(-15,0);$('right').onclick=()=>orbitBy(15,0);$('iso').onclick=()=>{az=-53;el=27;repaintSolid();};
$('elevation').oninput=e=>{el=Number(e.target.value);repaintSolid();};
function download(content,mime,name){const url=URL.createObjectURL(new Blob([content],{type:mime})),a=document.createElement('a');a.download=name;a.href=url;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('mesh').onclick=()=>perform(()=>download(stlBytes(part),'model/stl','studio-part-mm.stl'));$('drawing').onclick=()=>perform(()=>download(drawingSvg(part),'image/svg+xml','studio-part-drawing.svg'));
function store(mount){perform(()=>{context=persistPart(localStorage,context,part,mount);part=structuredClone(context.part);render();status('Saved to '+context.profile+'’s active project.');if(mount)location.assign('../index.html');});}
$('save').onclick=()=>activeAttempt?perform(()=>{sessionStorage.setItem(draftKey(),JSON.stringify({attempt:activeAttempt,part}));status('Practical draft saved in this tab.');}):store(false);$('mount').onclick=()=>store(true);
function draftKey(){return 'oia-bracket-practical/'+encodeURIComponent(context?.profile||'Learner')+'/'+String(context?.seed??0)+'/'+String(context?.origin||'blank');}
function evidence(){
  const records=context?.records||[],latest=records.at(-1);$('export-drawing-evidence').hidden=!records.length;
  $('drawing-evidence').textContent=!latest?'No mounted drawing evidence in this project.':records.length+' mounted record'+(records.length===1?'':'s')+'. Latest: '+String(latest.drawing?.title||'Bracket')+' / '+String(latest.assetId)+' / predicted '+Number(latest.predictedCM3).toFixed(3)+' cm³ / measured '+Number(latest.measured?.volumeCM3).toFixed(3)+' cm³.';
}
function showTarget(){
  const d=activeAttempt.brief;
  for(const k of ['title','width','height','wall','depth','tolerance','volumeTolerance'])$('brief-'+k).value=d[k];
  $('drawing-choice').querySelector('option[value="custom"]')?.remove();
  if(d.id==='custom')$('drawing-choice').add(new Option('Custom · '+d.title,'custom'));$('drawing-choice').value=d.id;
  $('drawing-need').textContent=d.title+'. Fit an L-section '+d.width+' × '+d.height+' mm, with two '+d.wall+' mm walls and '+d.depth+' mm extrusion. Each indicated geometry tolerance is ±'+d.tolerance+' mm. The predicted and measured volumes must each be within ±'+d.volumeTolerance+' cm³ of the drawing volume.';
  const drawing=$('target-view');drawing.replaceChildren();const scale=Math.min(215/d.width,99/d.height),X=x=>30+x*scale,Y=z=>128-z*scale;
  element(drawing,'polygon',{points:angleProfile(d.width,d.height,d.wall).map(([x,z])=>X(x)+','+Y(z)).join(' '),fill:'#bdd7cb',stroke:'#245b4c','stroke-width':2});
  const line=(x1,y1,x2,y2)=>element(drawing,'line',{x1,y1,x2,y2,stroke:'#46665f'});
  line(30,138,X(d.width),138);line(30,133,30,143);line(X(d.width),133,X(d.width),143);
  line(X(d.width)+13,Y(d.height),X(d.width)+13,128);line(X(d.width)+8,Y(d.height),X(d.width)+18,Y(d.height));line(X(d.width)+8,128,X(d.width)+18,128);
  element(drawing,'text',{x:31,y:159,fill:'#23493f','font-size':12},d.width+' mm');
  element(drawing,'text',{x:X(d.width)+19,y:(Y(d.height)+128)/2,fill:'#23493f','font-size':12},d.height+' mm');
  element(drawing,'text',{x:30,y:20,fill:'#23493f','font-size':12},'End view · wall '+d.wall+' mm');
  $('drawing-checks').replaceChildren();$('volume-prediction').value=activeAttempt.prediction??'';$('wall-size').value='';
  $('drawing-status').textContent=activeAttempt.prediction===null?'Record your prediction, then modify the starter.':'Prediction recorded. Edit the starter and verify the result.';
  evidence();
}
function begin(brief,restore=false){
  const a=attempt(brief);let next=a.start;freePart??=structuredClone(part);
  if(restore){
    try{const draft=JSON.parse(sessionStorage.getItem(draftKey())||'null');if(draft){
      const b=attempt(draft.attempt.brief);if(draft.attempt.prediction!==null)recordPrediction(b,draft.attempt.prediction);
      analyse(draft.part);b.edited=geometryKey(b.start)!==geometryKey(draft.part)||draft.attempt.edited===true;
      if(b.edited&&b.prediction===null)throw Error('Draft prediction missing.');Object.assign(a,b);next=draft.part;
    }}catch{}
  }
  activeAttempt=a;part=structuredClone(next);delete part.mount;practicalMounted=false;verifiedKey='';selected=3;undo=[];redo=[];model=analyse(part);
  $('inspect-mounted').hidden=true;showTarget();render();$('practical').scrollIntoView({block:'start'});
}
$('practical-start').onclick=()=>perform(()=>begin(drawings.A,true));
$('practical-leave').onclick=()=>{part=structuredClone(practicalMounted?context.part:freePart);activeAttempt=null;freePart=null;verifiedKey='';undo=[];redo=[];selected=3;model=analyse(part);render();};
$('drawing-choice').onchange=()=>perform(()=>{const d=drawings[$('drawing-choice').value];if(d)begin(d);});
$('brief-form').onsubmit=e=>{e.preventDefault();perform(()=>{const record={title:$('brief-title').value};for(const k of ['width','height','wall','depth','tolerance','volumeTolerance'])record[k]=Number($('brief-'+k).value);begin(drawingBrief(record));});};
$('restart-drawing').onclick=()=>perform(()=>begin(activeAttempt.brief));
$('predict-form').onsubmit=e=>{e.preventDefault();perform(()=>{recordPrediction(activeAttempt,Number($('volume-prediction').value));verifiedKey='';status('Prediction recorded. Edit the geometry and verify it.');render();});};
$('wall-form').onsubmit=e=>{e.preventDefault();perform(()=>{const t=Number($('wall-size').value);if(!Number.isFinite(t)||t<=0||t>=Math.min(model.width,model.height))throw Error('Enter a positive wall smaller than both outside dimensions.');
 apply({...part,profile:angleProfile(model.width,model.height,t,model.minX,model.minZ)});status('Equal wall thickness applied. Verify the changed geometry.');});};
$('verify-drawing').onclick=()=>perform(()=>{const result=checkBracket(activeAttempt,part);$('drawing-checks').replaceChildren(...result.checks.map(([name,ok,detail])=>{const li=document.createElement('li');li.textContent=(ok?'PASS':'REWORK')+' · '+name+' · '+detail;return li;}));verifiedKey=result.pass?geometryKey(part):'';status(result.pass?'Inspection passed. Mount this verified revision to capture evidence.':'Inspection failed. Correct the indicated values or retry with a new prediction.');render();});
$('export-drawing-evidence').onclick=()=>perform(()=>download(JSON.stringify({format:'oia-part-inspection',version:1,units:{geometry:'mm',profileArea:'mm²',volume:'cm³'},records:context.records},null,2),'application/json','bracket-inspection-register.json'));
$('mount-verified').onclick=()=>perform(()=>{if(verifiedKey!==geometryKey(part)||!checkBracket(activeAttempt,part).pass||practicalMounted)throw Error('Verify this drawing revision before mounting.');
 context=persistPart(localStorage,context,part,true,activeAttempt);part=structuredClone(context.part);freePart=structuredClone(part);practicalMounted=true;sessionStorage.removeItem(draftKey());evidence();$('inspect-mounted').hidden=false;status('Bracket mounted and drawing evidence saved to the active project.');render();});
model=analyse(part);render();
if(new URLSearchParams(location.search).get('practical')==='bracket')begin(drawings.A,true);
