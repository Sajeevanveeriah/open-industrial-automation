const schema={
  cartons:['id','lot','x','status','startScan','detected'],
  pallets:['id','carton','lot','orderId','status','attempts'],
  postings:['key','pallet','lot','orderId','quantity'],
  scans:['scan','input','count','I0','I1']
};
const vocabulary=new Set(('SELECT DISTINCT FROM WHERE JOIN INNER LEFT OUTER ON AS AND OR NOT IS NULL TRUE FALSE ORDER BY ASC DESC GROUP HAVING LIMIT OFFSET COUNT SUM AVG MIN MAX ROUND COALESCE LIKE IN BETWEEN CASE WHEN THEN ELSE END '+Object.keys(schema).join(' ')+' '+Object.values(schema).flat().join(' ')).toUpperCase().split(' '));
export function readQuery(raw) {
  if(typeof raw!=='string'||raw.length>2000)throw Error('Query limit is 2,000 characters.');
  const source=raw.trim().replace(/;$/,'');
  if(!/^SELECT\b/i.test(source))throw Error('Start with SELECT.');
  const mask=source.replace(/'(?:[^']|'')*'/g,"''");
  if(/['";]/.test(mask.replaceAll("''",''))||/--|\/\*|[^\w\s'(),.=*+/<>&%-]/.test(mask))throw Error('Only one read-only query is supported.');
  const aliases=new Set();
  for(const match of mask.matchAll(/\bAS\s+([A-Za-z_]\w*)/gi)) aliases.add(match[1].toUpperCase());
  for(const name of mask.matchAll(/\b[A-Za-z_]\w*\b/g)) {
    const word=name[0].toUpperCase();
    if(!vocabulary.has(word)&&!aliases.has(word))throw Error('Unknown query term '+name[0]+'. Declare aliases with AS.');
    if(aliases.has(word)&&/^\s*\(/.test(mask.slice(name.index+name[0].length))&&!['COUNT','SUM','AVG','MIN','MAX','ROUND','COALESCE'].includes(word))throw Error('Unsupported query function.');
  }
  return 'SELECT * FROM ('+source+') LIMIT 200';
}
export function queryRecords(SQL,records,query) {
  const sql=readQuery(query),db=new SQL.Database();
  try {
    for(const [name,fields] of Object.entries(schema)) {
      db.run('CREATE TABLE '+name+' ('+fields.map(f=>'"'+f+'"').join(',')+')');
      const insert=db.prepare('INSERT INTO '+name+' VALUES ('+fields.map(()=>'?').join(',')+')');
      try{
        for(const row of (records[name]??[]).slice(0,1024)) insert.run(fields.map(f=>{
          const v=row[f==='orderId'?'order':f];
          return typeof v==='boolean'?Number(v):typeof v==='number'||typeof v==='string'?v:null;
        }));
      }finally{insert.free();}
    }
    db.run('PRAGMA query_only=ON');
    const stmt=db.prepare(sql),columns=stmt.getColumnNames(),values=[];
    try{while(stmt.step())values.push(stmt.get());}finally{stmt.free();}
    return {columns,values};
  }finally{db.close();}
}
