import {initialPart,analyse,moveVertex,resizeSketch,stlBytes,drawingSvg,projectContext,persistPart} from './part-model.mjs';
const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg',rad=Math.PI/180;
let part=initialPart(),context=null,selected=3,undo=[],redo=[],drag=null,sliderStart=null,sketchMap,model,az=-53,el=27,orbit=null;
const status=s=>{$('status').textContent=s;},fmt=(n,d=3)=>Number(n.toFixed(d)).toString();
try{context=projectContext(localStorage);if(context.part)part=structuredClone(context.part);}catch(e){status('Saved project unavailable: '+e.message);}
function element(parent,tag,attrs,text){const e=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;parent.append(e);return e;}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function remember(previous){if(same(previous,part))return;undo.push(previous);if(undo.length>60)undo.shift();redo=[];}
function apply(next,record=true){const prior=part,result=analyse(next);part=next;model=result;if(record)remember(prior);render();}
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
$('save').onclick=()=>store(false);$('mount').onclick=()=>store(true);
model=analyse(part);render();
