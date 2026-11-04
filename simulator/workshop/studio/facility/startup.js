(() => {
  function fail(reason){
    if(document.body.dataset.ready==='true')return;
    document.body.dataset.ready='error';document.body.inert=false;
    document.getElementById('room').inert=true;document.getElementById('recovery').hidden=false;
    document.getElementById('recovery-cause').textContent=reason;
    document.getElementById('retry-load').onclick=()=>location.reload();
  }
  document.addEventListener('facility-start-failed',e=>fail(e.detail||'Renderer unavailable.'));
  setTimeout(()=>{if(document.body.dataset.ready==='false')fail('The renderer is taking longer than expected.');},20000);
})();
