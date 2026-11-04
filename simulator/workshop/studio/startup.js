(() => {
  const body = document.body;
  const panel = document.getElementById('studio-startup');
  function show(message) {
    if (body.dataset.ready === 'true') return;
    panel.querySelector('p').textContent = message;
    panel.hidden = false;
    body.dataset.startupHelp = 'true';
    body.inert = false;
  }
  const timer = setTimeout(() => show('The assembly is still loading. You can wait, reload, or open the classic workshop.'), 15000);
  const observer = new MutationObserver(() => {
    if (body.dataset.ready !== 'true') return;
    clearTimeout(timer);
    panel.hidden = true;
    delete body.dataset.startupHelp;
    observer.disconnect();
  });
  observer.observe(body, {attributes: true, attributeFilter: ['data-ready']});
  window.addEventListener('error', event => {
    if (event.target instanceof HTMLScriptElement || event.error) {
      show('The studio could not initialise its assembly view. Reload the studio or open the classic workshop.');
    }
  }, true);
})();
