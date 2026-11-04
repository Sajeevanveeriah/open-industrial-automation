import {features,constraints,generate,solve,revision,drawing,inspectFit} from './features.mjs';
export function featureBench(present) {
  const $=id=>document.getElementById(id);
  let book=[];
  for(const [key,label] of Object.entries(features))$('feature').add(new Option(label,key));
  for(const id of ['a','b','c'])for(const [key,label] of Object.entries(constraints))$('constraint-'+id).add(new Option(label,key));
  $('constraint-b').value='height';
  function readDesign(){
    const dims=['a','b','c'].filter(k=>$('constraint-'+k).value).map(k=>({kind:$('constraint-'+k).value,value:Number($('value-'+k).value)}));
    const kind=$('feature').value, design={kind,constraints:dims,wall:Number($('wall').value),depth:Number($('depth').value),tolerance:Number($('tol').value)};
    if(['extrude','revolve'].includes(kind)){const raw=$('profile-vertices').value.trim();if(raw.length>1200)throw Error('Sketch exceeds 1,200 characters.');design.profile=raw.split(/\s+/).map(s=>s.split(',').map(v=>v.trim()?Number(v):NaN));}
    return design;
  }
  function action(id,fn){$(id).onclick=()=>{try{fn();}catch(error){$('sketch-status').textContent=error.message;}};}
  function preview(design,issued){
    const mesh=generate(design),{w,h}=solve(design);
    present(mesh,issued?{featureBook:structuredClone(book),featureRevision:issued.number}:{});
    $('mount').disabled=!issued;$('sketch-status').textContent='Solved width '+w.toFixed(2)+' mm, height '+h.toFixed(2)+' mm. '+(issued?'Drawing revision '+issued.number+'.':'Issue a revision to transfer it.');
  }
  function register(){const list=$('drawing-rev');list.replaceChildren(...book.map(r=>new Option('Revision '+r.number,r.number)));list.value=String(book.length);}
  const chosen=()=>book[Number($('drawing-rev').value)-1];
  function show(){
    const r=chosen();if(!r)return;
    preview(r.design,r);$('feature').value=r.design.kind;
    if(r.design.profile)$('profile-vertices').value=r.design.profile.map(p=>p.join(',')).join(' ');
    for(const [i,k] of ['a','b','c'].entries()){
      const v=r.design.constraints?.[i];$('constraint-'+k).value=v?.kind||'';if(v)$('value-'+k).value=v.value;
    }
    for(const [id,k] of [['wall','wall'],['depth','depth'],['tol','tolerance']])$(id).value=r.design[k];
    const svg=new DOMParser().parseFromString(drawing(r),'image/svg+xml').documentElement;
    svg.setAttribute('width','100%');svg.removeAttribute('height');$('drawing-preview').replaceChildren(document.importNode(svg,true));
    $('revision-reason').textContent=r.reason;$('fit-result').textContent='';
  }
  action('solve',()=>preview(readDesign(),null));
  action('issue',()=>{const r=revision(book,readDesign(),$('design-reason').value);book.push(r);register();show();});
  $('drawing-rev').onchange=show;
  action('inspect-fit',()=>{const r=chosen();if(!r||!$('measured').value.trim())throw Error('Select an issued revision and enter a measurement.');const result=inspectFit(r,Number($('measured').value));$('fit-result').textContent=(result.pass?'PASS':'FAIL')+' · deviation '+result.deviation.toFixed(3)+' mm against ± '+r.design.tolerance+' mm on revision '+r.number;});
  action('drawing-export',()=>{const r=chosen();if(!r)throw Error('Issue a drawing first.');const url=URL.createObjectURL(new Blob([drawing(r)],{type:'image/svg+xml'}));const link=document.createElement('a');link.href=url;link.download=r.design.kind+'-Rev'+String(r.number).padStart(2,'0')+'.svg';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  return prior=>{
    if(!Array.isArray(prior.featureBook)||!prior.featureBook.length||prior.featureBook.length>24)throw Error('Invalid drawing register.');
    const restored=[];for(const row of prior.featureBook)restored.push(revision(restored,row.design,row.reason));
    book=restored;register();if(book.some(r=>r.number===prior.featureRevision))$('drawing-rev').value=String(prior.featureRevision);show();
  };
}
