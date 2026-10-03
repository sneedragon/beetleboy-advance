// The app now lives in js/*.js. Only a page cached from before that change
// still loads this file: clear its cache (proxy.php answers a request without
// a version with Clear-Site-Data) and reload once to get the current page.
(() => {
  try { if (sessionStorage.getItem('bb_reloaded')) return; sessionStorage.setItem('bb_reloaded', '1'); } catch {}
  fetch('proxy.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    .finally(() => location.reload());
})();
