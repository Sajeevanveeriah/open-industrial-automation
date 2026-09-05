// Schematic equipment and product forms. Geometry is illustrative, never site CAD.
const machines={
 intake:'<path d="M18 22h65l-10 30H32z"/><path d="M36 52v13h76l15-17"/><circle cx="30" cy="72" r="6"/><circle cx="109" cy="72" r="6"/>',
 wash:'<rect x="20" y="30" width="113" height="32" rx="15"/><path d="M39 32l13 28m10-28l13 28m10-28l13 28m10-28l13 28M30 22h95"/><path class="water" d="M39 23v9m22-9v9m22-9v9m22-9v9"/>',
 peel:'<path d="M48 19h62v8H48zM44 30h70v32H44zM54 62v12m50-12v12M60 17V9h31"/><path class="heat" d="M58 48q-9-7 0-15m20 15q-9-7 0-15m20 15q-9-7 0-15"/>',
 sort:'<path d="M15 57h130v10H15zM53 57V20h55v37M64 27h33v8H64z"/><path class="scan" d="M69 37l-14 18m35-18l13 18"/><path d="M105 67l18 14"/>',
 cut:'<path d="M14 57h130v10H14zM57 20h49v37H57zM64 28h35v23H64zM72 28v23m9-23v23m9-23v23m-26-15h35m-35 8h35"/>',
 blanch:'<path d="M17 37h125v29H17zM29 37V25h99v12M32 66v9m96-9v9"/><path class="water" d="M27 48q9-8 18 0t18 0t18 0t18 0t18 0"/><path class="heat" d="M54 20q-7-6 0-12m24 12q-7-6 0-12m24 12q-7-6 0-12"/>',
 dry:'<path d="M16 59h126v9H16zM32 58V23h96v35"/><circle cx="61" cy="37" r="10"/><circle cx="101" cy="37" r="10"/><path d="M61 27v20m-10-10h20m30-10v20m-10-10h20"/>',
 coat:'<path d="M54 13h45l-8 22H62zM76 35v10M17 57h126v10H17z"/><path class="heat" d="M76 45l-13 10m13-10v10m0-10l13 10"/>',
 form:'<path d="M45 17h70v27H45zM63 44v12m17-12v12m17-12v12M18 61h126v9H18z"/>',
 fry:'<path d="M15 40h131v26H15zM26 40V28h111v12M33 66v9m96-9v9"/><path class="oil" d="M24 51q10-8 20 0t20 0t20 0t20 0t20 0"/><path class="heat" d="M48 22q-7-7 0-15m29 15q-7-7 0-15m29 15q-7-7 0-15"/>',
 cool:'<path d="M15 58h130v10H15zM34 53V22h92v31"/><path class="water" d="M52 29v22m28-22v22m28-22v22m-64-7l8 7 8-7m12 0l8 7 8-7m12 0l8 7 8-7"/>',
 freeze:'<path d="M24 21h111v47H24zM35 57h90M44 47h73M35 37h90"/><path class="water" d="M80 24v36M65 33l30 18M65 51l30-18"/>',
 inspect:'<path d="M16 58h127v10H16zM52 58V20h59v38M62 58V30h39v28"/><path class="scan" d="M67 35l30 18m0-18L67 53"/>',
 pack:'<path d="M49 14h56v14H49zM61 28v15l-8 13v15h48V56l-9-13V28M56 62h42M69 33h17"/>',
 pallet:'<path d="M27 68h110v8H27zM31 41h31v26H31zM65 41h31v26H65zM99 41h31v26H99zM47 14h31v25H47zM81 14h31v25H81zM40 76v5m42-5v5m43-5v5"/>'
};
export function productForm(id,recipe={}) {
 if(['intake','wash','peel','sort'].includes(id)) return 'Whole potatoes';
 if(['pack','pallet'].includes(id)) return 'Packed frozen product';
 const shape=recipe.formed?(['cut','blanch','dry','coat'].includes(id)?'shredded potato':'formed pieces'):recipe.id==='wedges'?'potato wedges':'potato strips';
 return (['freeze','inspect'].includes(id)?'Frozen ':'')+shape;
}
export function equipmentSvg(st,moving=false){
 const raw=['intake','wash','peel','sort'].includes(st.id),packed=['pack','pallet'].includes(st.id);
 const pieces=Array.from({length:5},(_,i)=>raw?`<ellipse cx="${20+i*27}" cy="82" rx="7" ry="4"/>`:packed?`<rect x="${14+i*27}" y="76" width="15" height="10" rx="1"/>`:`<path d="M${17+i*27} 78l13 5m-14-1l13 5"/>`).join('');
 return `<svg class="equipment-art ${moving&&st.flowKgS>0?'moving':''}" viewBox="0 0 160 92" aria-hidden="true"><g class="machine">${machines[st.id]||''}</g><g class="potato ${raw?'whole':packed?'carton':'strips'}" style="opacity:${st.massKg>0?1:.22}">${pieces}</g></svg>`;
}
