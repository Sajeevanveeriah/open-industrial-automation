self.onmessage = async ({data}) => {
  try {
    importScripts('../../vendor/occt/occt-import-js.js');
    const kernel = await occtimportjs({locateFile:name => new URL('../../vendor/occt/'+name, location.href).href});
    const converted = kernel.ReadStepFile(new Uint8Array(data.bytes), {linearUnit:'meter',linearDeflectionType:'absolute_value',linearDeflection:data.deviation,angularDeflection:0.5});
    if (!converted.success || !converted.meshes.length) throw Error('No STEP solids could be tessellated.');
    if(converted.meshes.length>256||converted.meshes.reduce((n,m)=>n+m.index.array.length,0)>300000||converted.meshes.reduce((n,m)=>n+m.attributes.position.array.length,0)>300000)throw Error('STEP geometry limit exceeded.');
    postMessage({parts:converted.meshes.map(m=>({name:m.name||'Solid',p:m.attributes.position.array,i:m.index.array,color:m.color})),tree:converted.root});
  } catch (error) { postMessage({error:error.message}); }
};
