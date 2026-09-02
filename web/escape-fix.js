(function () {
  'use strict';

  function repairDynamicControls(root) {
    root.querySelectorAll('[data-action="start-cip"]').forEach((button) => {
      button.setAttribute('aria-label', 'Start CIP');
    });
  }

  let queued = false;
  const queueRepair = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      repairDynamicControls(document);
    });
  };

  const workspace = document.querySelector('#workspace');
  if (workspace) new MutationObserver(queueRepair).observe(workspace, { childList: true, subtree: true });
  repairDynamicControls(document);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const dialog = document.querySelector('#commandDialog');
    if (dialog instanceof HTMLDialogElement && dialog.open) dialog.close();
  }, true);
})();
