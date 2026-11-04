importScripts('./vendor/sql-wasm.js');
self.onmessage=async({data})=>{
  try{
    const [{queryRecords},SQL]=await Promise.all([import('./database.mjs'),initSqlJs({locateFile:name=>'./vendor/'+name})]);
    self.postMessage(queryRecords(SQL,data.records,data.query));
  }catch(error){self.postMessage({error:error.message});}
};
