const variables = ['I0','I1','IN','COUNT','RUN','TRIP','MODE','OUTPUT','ANALOGUE','SETPOINT'];
const constants = {TRUE:1,FALSE:0};
const blocks = ['R_TRIG','F_TRIG','TON','SCALE'];
const order = {OR:1,AND:2,'=':3,'<>':3,'<':3,'>':3,'<=':3,'>=':3,'+':4,'-':4,'*':5,'/':5};
function fail(message) { throw Error(message); }
function tokens(source) {
  if(typeof source!=='string'||source.length>1600) fail('Program limit is 1,600 characters.');
  const lex=/\s+|:=|<=|>=|<>|[();,+*/=<>&|-]|\d+(?:\.\d+)?|[A-Za-z_][A-Za-z_0-9]*/gy;
  const list=[];let cursor=0;
  while(cursor<source.length) {
    lex.lastIndex=cursor;const match=lex.exec(source);
    if(!match) fail('Unexpected character at '+(cursor+1)+'.');
    if(match[0].trim()) list.push(match[0].toUpperCase());
    cursor=lex.lastIndex;
  }
  if(list.length>350) fail('Maximum 350 program tokens.');
  return list;
}
export function compileProgram(text) {
  if(typeof text!=='string'||text.length>1600)fail('Program limit is 1,600 characters.');
  const definitions=new Map();
  let remaining=text.trimStart();
  while(/^FUNCTION_BLOCK\b/i.test(remaining)){
    const m=/^FUNCTION_BLOCK\s+([A-Za-z_][A-Za-z_0-9]*)\s*;([\s\S]*?)END_FUNCTION_BLOCK\s*;/i.exec(remaining);
    if(!m||definitions.size>=4)fail('Use up to four FUNCTION_BLOCK name; ... END_FUNCTION_BLOCK; definitions.');
    const name=m[1].toUpperCase();
    if(definitions.has(name)||variables.includes(name)||blocks.includes(name)||Object.hasOwn(constants,name))fail('Choose a unique function block name.');
    if(/FUNCTION_BLOCK/i.test(m[2]))fail('Nested function blocks are unsupported.');
    definitions.set(name,compileProgram(m[2]));remaining=remaining.slice(m[0].length).trimStart();
  }
  const list=tokens(remaining);let index=0, memory=0;
  const current=()=>list[index];
  function take(expected) {
    if(current()!==expected) fail('Expected '+expected+' at token '+(index+1)+'.');
    index++;
  }
  function expression(precedence=0,depth=0) {
    if(depth>18) fail('Expression nesting exceeds 18.');
    const token=list[index++];
    let node;
    if(token==='NOT'||token==='-') node={op:'unary',fn:token,a:expression(6,depth+1)};
    else if(token==='(') {node=expression(0,depth+1);take(')');}
    else if(definitions.has(token)){
      take('(');const a=expression(0,depth+1);take(')');node={op:'instance',a,program:definitions.get(token),slot:memory++};
    }
    else if(blocks.includes(token)) {
      take('(');const args=[expression(0,depth+1)];
      while(current()===',') {index++;args.push(expression(0,depth+1));}
      take(')');
      if(args.length!==({R_TRIG:1,F_TRIG:1,TON:2,SCALE:1})[token]) fail('Incorrect argument count for '+token+'.');
      node={op:'block',fn:token,args,slot:memory++};
    } else if(variables.includes(token)) node={op:'read',key:token};
    else if(Object.hasOwn(constants,token)||/^\d+(\.\d+)?$/.test(token)) node={op:'literal',value:constants[token]??Number(token)};
    else fail('Unknown expression at token '+index+': '+(token??'end')+'.');
    while(Object.hasOwn(order,current())&&order[current()]>precedence) {
      const op=list[index++];node={op:'binary',fn:op,a:node,b:expression(order[op],depth+1)};
    }
    return node;
  }
  function statements(depth=0) {
    if(depth>8) fail('IF nesting exceeds eight.');
    const result=[];
    while(current() && !['ELSE','END_IF'].includes(current())) {
      if(current()==='IF') {
        index++;const condition=expression();take('THEN');const yes=statements(depth+1);
        let no=[];if(current()==='ELSE'){index++;no=statements(depth+1);}
        take('END_IF');take(';');result.push({condition,yes,no});
      } else {
        const key=list[index++];if(!['COUNT','RUN','TRIP','MODE','OUTPUT'].includes(key)) fail('Invalid output tag '+key+'.');
        take(':=');const expr=expression();take(';');result.push({key,expr});
      }
    }
    return result;
  }
  const result=statements();
  if(index!==list.length||!result.length) fail('Expected a complete non-empty program.');
  return result;
}
export function compileLadder(text) {
  const rungs=text.trim().split(/\r?\n/);
  if(rungs.length>20) fail('Maximum 20 ladder rungs.');
  const converted=rungs.map((line,i)=>{
    const parts=line.split('->');
    if(parts.length!==2) fail('Rung '+(i+1)+' requires contacts -> instruction.');
    const [contacts,coil]=parts.map(s=>s.trim().toUpperCase());
    const gate=contacts.replace(/\bNO\((\w+)\)/g,'$1').replace(/\bNC\((\w+)\)/g,'(NOT $1)').replaceAll('&',' AND ').replaceAll('|',' OR ');
    const match=/^(COIL|CTU)\((RUN|TRIP|OUTPUT|COUNT)\)$/.exec(coil);
    if(!match||match[1]==='CTU'&&match[2]!=='COUNT') fail('Invalid coil or counter at rung '+(i+1)+'.');
    return match[1]==='CTU' ? 'IF R_TRIG('+gate+') THEN COUNT := COUNT+1; END_IF;' : match[2]+' := '+gate+';';
  });
  return compileProgram(converted.join('\n'));
}
export function newController() {return {COUNT:0,RUN:0,TRIP:0,MODE:0,OUTPUT:0,memory:{}};}
export function executeScan(program,state,inputs,dt=0.1) {
  const s={...state,...inputs,memory:{...state.memory}};
  function read(node) {
    if(node.op==='literal') return node.value;
    if(node.op==='read') return Number(s[node.key]??0);
    if(node.op==='unary') {const v=read(node.a);return node.fn==='NOT'?Number(!v):-v;}
    if(node.op==='instance'){
      const v=read(node.a),instance=executeScan(node.program,s.memory[node.slot]??newController(),{IN:v},dt);
      s.memory[node.slot]=instance;
      return instance.OUTPUT;
    }
    if(node.op==='block') {
      const [v,delay]=node.args.map(read),prev=s.memory[node.slot]??0;
      if(node.fn==='SCALE') return (v-4)*6.25;
      if(node.fn==='TON') {
        if(delay<0) fail('TON delay must be non-negative seconds.');
        s.memory[node.slot]=v?prev+dt:0;return Number(Boolean(v)&&s.memory[node.slot]+1e-10>=delay);
      }
      s.memory[node.slot]=Number(Boolean(v));
      return Number(node.fn==='R_TRIG'?Boolean(v)&&!prev:!v&&Boolean(prev));
    }
    const a=read(node.a),b=read(node.b);
    switch(node.fn) {
      case 'OR':return Number(Boolean(a||b)); case 'AND':return Number(Boolean(a&&b));
      case '=':return Number(a===b);case '<>':return Number(a!==b);
      case '>':return Number(a>b);case '<':return Number(a<b);case '>=':return Number(a>=b);case '<=':return Number(a<=b);
      case '+':return a+b;case '-':return a-b;case '*':return a*b;case '/':if(b===0) fail('Division by zero.');return a/b;
    }
  }
  function run(rows) {
    for(const row of rows) {
      if(row.condition) run(read(row.condition)?row.yes:row.no);
      else {
        const value=read(row.expr);
        if(!Number.isFinite(value)||Math.abs(value)>1e9) fail('Numeric range exceeded at '+row.key+'.');
        s[row.key]=value;
      }
    }
  }
  run(program);
  return Object.fromEntries(['COUNT','RUN','TRIP','MODE','OUTPUT','memory'].map(k=>[k,s[k]]));
}

export function restartController(current,policy){
  if(!['Cold','Count retained','Count and blocks retained'].includes(policy))fail('Unknown restart policy.');
  const fresh=newController();
  if(policy!=='Cold')fresh.COUNT=current.COUNT;
  if(policy==='Count and blocks retained')fresh.memory=structuredClone(current.memory);
  return fresh;
}
