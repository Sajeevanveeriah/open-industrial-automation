import {crateTint} from './architecture.mjs';
const cap=(n,min,max)=>Math.max(min,Math.min(max,n));
export function facilityPlan(container,{onSelect=()=>{},onCamera=()=>{}}={}){
  const canvas=document.createElement('canvas');canvas.dataset.renderer='plan';container.dataset.renderer='plan';canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Interactive warehouse plan. Select an aisle, bay, vehicle or loading dock. Arrow keys pan; plus and minus zoom.');
  canvas.style.cssText='display:block;width:100%;height:100%;touch-action:none;min-height:220px';container.replaceChildren(canvas);
  const ctx=canvas.getContext('2d');let s,selected='',centre=[0,-4],width=130,mode='overview',hover=null,cutaway=true,pointer=null,scale=1,offset=[0,0];
  const entities=()=>s?[...s.vehicles,...s.bays,...s.doors,...s.conveyors,...s.aisles]:[];
  const lookup=()=>entities().find(e=>e.id===selected);
  function render(){
    if(!s)return;const h=Math.max(220,canvas.clientHeight),w=Math.max(180,canvas.clientWidth),ratio=Math.min(window.devicePixelRatio||1,1.5);
    if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);}
    const tracked=lookup();if(mode==='follow'&&tracked)centre=[tracked.x,tracked.y];
    scale=Math.min(w/width,h/(width*.53));offset=[w/2-centre[0]*scale,h/2+centre[1]*scale];
    const px=x=>offset[0]+x*scale,py=y=>offset[1]-y*scale;
    ctx.setTransform(ratio,0,0,ratio,0,0);ctx.fillStyle='#e4e8df';ctx.fillRect(0,0,w,h);
    function rect(x,y,sx,sy,colour){ctx.fillStyle=colour;ctx.fillRect(px(x-sx/2),py(y+sy/2),sx*scale,sy*scale);}
    function word(x,y,t,colour='#2e4650',sz=10){ctx.fillStyle=colour;ctx.font='600 '+sz+'px system-ui';ctx.fillText(t,px(x),py(y));}
    rect(0,1,130,56,'#b3beb7');rect(0,-44,143,32,'#767e80');
    for(const a of s.aisles){rect(a.x,-17,1.5,.18,'#e1ba56');if(scale>6||Number(a.id.slice(1))%2===0)word(a.x-.6,-18.7,a.id,'#425457',Math.max(9,scale*.43));}
    for(const b of s.bays){rect(b.x,b.y,1.35,3.95,'#405e71');rect(b.x,b.y,1.23,3.73,'#aca492');if(b.stock.length)rect(b.x,b.y,1.09,2.68,crateTint(b.stock.at(-1).sku));}
    for(const c of s.conveyors){rect(c.x,c.y,c.length,1.4,'#667c81');for(const p of c.parcels||[])rect(c.x-c.length/2+p.progress,c.y,1.02,.9,crateTint(p.sku));}
    for(const d of s.doors){rect(d.x,d.y,4.15,1.05,d.open?'#d0ae53':'#b05243');rect(d.x,d.y-6.7,2.49,11.85,'#e0e2d6');rect(d.x,d.y-14.6,2.36,2.3,'#427080');if(scale>6)word(d.x+1.3,d.y+1,d.id);}
    for(const v of s.vehicles){ctx.save();ctx.translate(px(v.x),py(v.y));ctx.rotate(-v.heading);ctx.fillStyle=v.fault?'#ac4539':'#d89234';ctx.fillRect(-scale*.85,-scale*.47,scale*1.7,scale*.94);ctx.fillStyle='#31464d';ctx.fillRect(scale*.5,-scale*.46,scale*.23,scale*.92);if(v.load){ctx.fillStyle=crateTint(v.load.sku);ctx.fillRect(scale*.78,-scale*.54,scale*1.18,scale*1.08);}ctx.restore();}
    if(tracked){ctx.strokeStyle='#007e71';ctx.lineWidth=2;ctx.beginPath();ctx.arc(px(tracked.x),py(tracked.y),Math.max(9,scale*1.3),0,Math.PI*2);ctx.stroke();word(tracked.x+1.5,tracked.y+1.5,tracked.id);}
    ctx.fillStyle='#f8f9f0e8';ctx.fillRect(8,h-29,176,21);ctx.fillStyle='#35535a';ctx.font='600 11px system-ui';ctx.fillText('2D plan · metres · north up',14,h-14);
  }
  function view(name){mode=name;const v=lookup();if(name==='overview'||name==='plan'){width=138;centre=[0,-5];}else if(name==='dock'){width=58;centre=[0,-30];}else if(name==='packing'){width=64;centre=[0,21];}else{width=26;centre=v?[v.x,v.y]:[0,-14];}render();onCamera(saveView());}
  function saveView(){return {version:1,mode,centre:[...centre,1],distance:width,yaw:-1.12,pitch:.68,cutaway};}
  function restoreView(p){if(p?.version!==1||!Array.isArray(p.centre)||!p.centre.every(Number.isFinite)||!Number.isFinite(p.distance))return false;centre=p.centre.slice(0,2);width=cap(p.distance,5,280);mode=p.mode==='follow'?'follow':'custom';cutaway=p.cutaway!==false;render();return true;}
  const events=new AbortController(),listen=(type,fn,opt={})=>canvas.addEventListener(type,fn,{...opt,signal:events.signal});
  listen('pointerdown',e=>{canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);pointer={x:e.clientX,y:e.clientY,old:[...centre],drag:false};});
  listen('pointermove',e=>{if(!pointer)return;const x=e.clientX-pointer.x,y=e.clientY-pointer.y;if(Math.hypot(x,y)>3||pointer.drag){pointer.drag=true;mode='custom';centre=[pointer.old[0]-x/scale,pointer.old[1]+y/scale];render();}});
  listen('pointerup',e=>{if(!pointer)return;if(!pointer.drag){const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left-offset[0])/scale,y=(offset[1]-(e.clientY-r.top))/scale;
    const closest=entities().map(o=>[o,Math.hypot(o.x-x,o.y-y)]).sort((a,b)=>a[1]-b[1])[0];if(closest&&closest[1]<Math.max(1.5,12/scale)){selected=closest[0].id;onSelect(selected);}}pointer=null;render();});
  listen('pointercancel',()=>pointer=null);
  listen('wheel',e=>{e.preventDefault();width=cap(width*Math.exp(cap(e.deltaY,-200,200)*.0018),5,280);render();},{passive:false});
  listen('keydown',e=>{if(e.key==='Home')view('overview');else if(e.key==='+'||e.key==='=')width/=1.2;else if(e.key==='-')width*=1.2;else if(e.key.startsWith('Arrow')){mode='custom';const d=width*.04;if(e.key==='ArrowLeft')centre[0]-=d;if(e.key==='ArrowRight')centre[0]+=d;if(e.key==='ArrowDown')centre[1]-=d;if(e.key==='ArrowUp')centre[1]+=d;}else return;e.preventDefault();render();});
  const observer=new ResizeObserver(render);observer.observe(canvas);
  return {update(next){s=next;render();},select(id){selected=id;render();},view,saveView,restoreView,setCutaway(v){cutaway=Boolean(v);},dispose(){events.abort();observer.disconnect();canvas.remove();}};
}
