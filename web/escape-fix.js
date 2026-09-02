(function () {
  'use strict';

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const dialog = document.querySelector('#commandDialog');
    if (dialog instanceof HTMLDialogElement && dialog.open) dialog.close();
  }, true);
})();
