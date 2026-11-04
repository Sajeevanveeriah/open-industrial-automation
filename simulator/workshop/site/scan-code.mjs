const terms=['input','previous'];
export function parse(language,source) {
  if(!['Python','TypeScript','C++'].includes(language)||typeof source!=='string'||source.length>120)throw Error('Unsupported language or oversized expression.');
  const tokens=source.match(/[A-Za-z_]+|&&|\|\||!|\(|\)|\S/g)||[],ops=language==='Python'?['not','and','or']:['!','&&','||'];let i=0;
  function atom(){const t=tokens[i++];if(t===ops[0])return ['not',atom()];if(t==='('){const v=or();if(tokens[i++]!==')')throw Error('Missing closing parenthesis.');return v;}if(!terms.includes(t))throw Error('Expected input or previous.');return t;}
  function and(){let v=atom();while(tokens[i]===ops[1]){i++;v=['and',v,atom()];}return v;}
  function or(){let v=and();while(tokens[i]===ops[2]){i++;v=['or',v,and()];}return v;}
  const ast=or();if(i!==tokens.length)throw Error('Unexpected token '+tokens[i]+'.');return ast;
}
function val(n,input,previous){if(n==='input')return input;if(n==='previous')return previous;if(n[0]==='not')return !val(n[1],input,previous);if(n[0]==='and')return val(n[1],input,previous)&&val(n[2],input,previous);return val(n[1],input,previous)||val(n[2],input,previous);}
export function execute(language,source,pattern){
  if(typeof pattern!=='string'||!/^[01]{1,96}$/.test(pattern))throw Error('Use 1 to 96 binary samples.');
  const ast=parse(language,source);let count=0,expected=0,previous=false;
  return Array.from(pattern,(bit,i)=>{const input=bit==='1';if(input&&!previous)expected++;if(val(ast,input,previous))count++;const row={scan:i+1,input,previous,count,expected};previous=input;return row;});
}
