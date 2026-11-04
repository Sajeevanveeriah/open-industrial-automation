const {createHash}=require('node:crypto');

function staticOcctBindings(source) {
  const sha=createHash('sha256').update(source).digest('hex');
  if (sha!=='3fb44ce11d00611f9b3f3c5775d520ebab48930c1f08279b7b1316f05f0d3379') throw Error('Review OCCT bindings before updating the pinned converter.');
  const js=source.toString('utf8');
  const first=js.indexOf('function createJsInvoker(');
  const firstEnd=js.indexOf('var ensureOverloadTable=',first);
  const next=js.indexOf('var __emval_get_method_caller=');
  const nextEnd=js.indexOf('var __emval_get_property=',next);
  const directInvoker=`function craftInvokerFunction(humanName, argTypes, classType, invoke, target, isAsync) {
    if (isAsync) throwBindingError("Asynchronous OCCT invokers are unsupported");
    const method = argTypes[1] !== null && classType !== null;
    const stacked = usesDestructorStack(argTypes);
    return createNamedFunction(humanName, function(...args) {
      const destructors = stacked ? [] : null;
      const wired = [];
      const first = method ? 1 : 2;
      try {
        for (let i=first;i<argTypes.length;i++)
          wired.push(argTypes[i].toWireType(destructors,i===1?this:args[i-2]));
        const result = invoke(target,...wired);
        return argTypes[0].name === "void" ? undefined : argTypes[0].fromWireType(result);
      } finally {
        if (stacked) runDestructors(destructors);
        else for (let i=0;i<wired.length;i++) {
          const destroy=argTypes[first+i].destructorFunction;
          if (destroy) destroy(wired[i]);
        }
      }
    });
  }`;
  const methodCaller=`var __emval_get_method_caller=(argCount,pointer,kind)=>{
    const types=emval_lookupTypes(argCount,pointer), retType=types.shift();
    return emval_addMethodCaller((obj,fn,destructorsRef,args)=>{
      let offset=args;
      const values=types.map(t=>{const v=t.readValueFromPointer(offset);offset+=t.argPackAdvance;return v;});
      const rv=kind===1?Reflect.construct(fn,values):Reflect.apply(fn,obj,values);
      if (!retType.isVoid) return emval_returnValue(retType,destructorsRef,rv);
    });
  };`;
  return js.slice(0,first)+directInvoker+js.slice(firstEnd,next)+methodCaller+js.slice(nextEnd);
}
module.exports={staticOcctBindings};
