import {box,bounds,stl,gltf,urdf,usda} from './geometry.mjs';
const $=id=>document.getElementById(id);
let source=null, parts=[], tree='', worker, epoch=0;
function reset(message){
  epoch++;worker?.terminate();worker=null;source=null;parts=[];tree='';
  $('mount').disabled=true;$('part').replaceChildren(new Option('Assembly',''));
  $('tree').textContent='';$('dimensions').textContent='';$('status').textContent=message;draw();
}
function draw(){
  const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);if(!parts.length)return;
  const subset=$('part').value===''?parts:[parts[Number($('part').value)]];
  const {min,max,size}=bounds(subset);
  const angle=Number($('angle').value)*Math.PI/180, cs=Math.cos(angle),sn=Math.sin(angle);
  const zoom=320/Math.max(.001,Math.hypot(...size));
  const faces=[];
  for(const [idx,part] of subset.entries()){
    const vertices=[];
    for(let k=0;k<part.p.length;k+=3){
      const [x,y,z]=[0,1,2].map(a=>part.p[k+a]-(min[a]+max[a])/2);
      const depth=x*sn+y*cs;
      vertices.push([360+(x*cs-y*sn)*zoom,200-(z*.85-depth*.52)*zoom,depth*.85+z*.52]);
    }
    for(let n=0;n<part.i.length;n+=3){
      const tri=part.i.slice(n,n+3).map(j=>vertices[j]);
      faces.push({tri,depth:tri.reduce((s,v)=>s+v[2],0),colour:part.color?'rgb('+part.color.slice(0,3).map(n=>Math.round(n*225)).join(',')+')':['#77ae99','#dbaf65','#80b3cd'][idx%3]});
    }
  }
  faces.sort((a,b)=>a.depth-b.depth);
  for(const {tri,colour} of faces){
    ctx.beginPath();ctx.moveTo(...tri[0].slice(0,2));ctx.lineTo(...tri[1].slice(0,2));ctx.lineTo(...tri[2].slice(0,2));ctx.closePath();ctx.fillStyle=colour;ctx.fill();ctx.strokeStyle='#355b5266';ctx.lineWidth=.65;ctx.stroke();
  }
  $('dimensions').textContent='Mesh bounding box (X × Y × Z)\n'+size.map(n=>n.toFixed(4)).join(' × ')+' m';
}
function present(name,bytes,items,hierarchy,up){
  if(up==='Y') for(const part of items)for(let k=0;k<part.p.length;k+=3){const y=part.p[k+1];part.p[k+1]=-part.p[k+2];part.p[k+2]=y;}
  const {size}=bounds(items);
  parts=items;tree=hierarchy||items.map(p=>p.name).join('\n');
  source={name,widthM:size[0],upAxis:up,dimensionsM:size,deviation:Number($('tess').value),sourceUnit:name.toLowerCase().endsWith('.stl')?Number($('unit').value):'format',parts:items.map(p=>p.name)};
  if(bytes){
    const b=new Uint8Array(bytes),chunks=[];
    for(let n=0;n<b.length;n+=30720)chunks.push(btoa(String.fromCharCode(...b.subarray(n,n+30720))));
    source.sourceChunks=chunks;
  }
  $('part').replaceChildren(new Option('Assembly',''),...parts.map((p,i)=>new Option(p.name,String(i))));
  $('tree').textContent=tree;$('status').textContent=name+' · '+items.length+' parts · '+items.reduce((s,p)=>s+p.i.length/3,0)+' triangles';
  $('mount').disabled=false;draw();
}
function hierarchy(node,depth=0){return ' '.repeat(depth*2)+(node.name||'Assembly')+'\n'+(node.children||[]).map(n=>hierarchy(n,depth+1)).join('');}
async function load(bundled,stored=null){
  reset('Reading geometry…');const token=epoch;
  try{
    let name,bytes;
    if(stored){
      if(!Array.isArray(stored.sourceChunks)||stored.sourceChunks.length>35)throw Error('Invalid saved CAD source.');
      let total=0;const decoded=stored.sourceChunks.map(chunk=>{if(typeof chunk!=='string'||chunk.length>40960)throw Error('Invalid source chunk.');const block=Uint8Array.from(atob(chunk),c=>c.charCodeAt(0));total+=block.length;return block;});
      if(total<1||total>1048576)throw Error('Saved geometry exceeds 1 MiB.');
      const restored=new Uint8Array(total);let off=0;for(const block of decoded){restored.set(block,off);off+=block.length;}
      name=stored.name;bytes=restored.buffer;$('axis').value=stored.upAxis;$('unit').value=String(stored.sourceUnit);$('tess').value=String(stored.deviation||.00025);
    }else if(bundled){name=$('example').value;const res=await fetch('assets/'+name);if(!res.ok)throw Error('Training component unavailable.');bytes=await res.arrayBuffer();if(name.endsWith('.stl'))$('unit').value='.001';}
    else{const file=$('file').files[0];if(!file||!file.size||file.size>1048576)throw Error('Choose a non-empty local file no larger than 1 MiB.');name=file.name;bytes=await file.arrayBuffer();}
    if(token!==epoch)return;
    const ext=name.split('.').pop().toLowerCase(),text=()=>new TextDecoder().decode(bytes);
    let items,structure;const up=$('axis').value==='format'?(['gltf','glb'].includes(ext)?'Y':'Z'):$('axis').value;
    if(['step','stp'].includes(ext)){
      if(!/^\s*ISO-10303-21;/.test(text())||/EXTERNALLY_DEFINED|DOCUMENT_FILE|EXTERNAL_SOURCE/i.test(text()))throw Error('Requires self-contained STEP geometry.');
      const result=await new Promise((resolve,reject)=>{
        const job=new Worker('./step-worker.js');worker=job;const timeout=setTimeout(()=>{job.terminate();reject(Error('Conversion exceeded 25 seconds.'));},25000);
        job.onmessage=e=>{clearTimeout(timeout);job.terminate();e.data.error?reject(Error(e.data.error)):resolve(e.data);};
        job.onerror=e=>{clearTimeout(timeout);job.terminate();reject(Error(e.message));};
        job.postMessage({bytes,deviation:Number($('tess').value)});
      });items=result.parts;structure=hierarchy(result.tree);
    }else if(ext==='stl')items=stl(bytes,Number($('unit').value));
    else if(['gltf','glb'].includes(ext))items=gltf(bytes,ext==='glb');
    else if(ext==='urdf')items=urdf(text());
    else if(['usd','usda'].includes(ext))items=usda(text());
    else throw Error('Unsupported format.');
    if(token===epoch)present(name,bytes,items,structure,up);
  }catch(e){if(token===epoch)reset(e.message);}
}
$('example').onchange=()=>{$('download').href='assets/'+$('example').value;};
$('load').onclick=()=>load(true);$('import').onclick=()=>load(false);$('cancel').onclick=()=>reset('Import cancelled.');
$('part').onchange=draw;$('angle').oninput=draw;
$('generate').onclick=()=>{
  reset('');const mm=Number($('width').value);if(mm<20||mm>600||!Number.isFinite(mm)){reset('Set a width between 20 and 600 mm.');return;}
  present('Parametric bracket',null,[box('Base',[mm/1000,.04,.006]),box('Upright',[.006,.03,.044],[.007,.003,.006])],'Base\n  Upright','Z');
};
$('mount').onclick=()=>{try{sessionStorage.setItem('oia-workshop-cad-transfer-v1',JSON.stringify(source));location.assign('../index.html');}catch{ $('status').textContent='Session storage is full. Use a smaller source file.'; }};

try {
  const prior=JSON.parse(sessionStorage.getItem('oia-workshop-cad-source-v1')||'null');
  if(prior?.sourceChunks){$('reopen').hidden=false;$('reopen').onclick=()=>load(false,prior);}
  else if(prior?.name==='Parametric bracket'&&Number.isFinite(prior.widthM)){$('reopen').hidden=false;$('reopen').onclick=()=>{$('width').value=prior.widthM*1000;$('generate').click();};}
} catch { $('status').textContent='Stored CAD metadata could not be read.'; }

document.querySelector('main').inert = false;
