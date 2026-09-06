// Migration worker: retire only this project's old cache-first application.
// Do not cache HTML or model assets, and do not touch neighbouring GitHub sites.
const root = new URL('./', self.location.href);
root.pathname = root.pathname.replace(/(?:suite|potato)\/$/, '');
const owned = url => { const u = new URL(url); return u.origin === root.origin && u.pathname.startsWith(root.pathname); };
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const name of await caches.keys()) {
    if (!name.startsWith('oia-')) continue;
    const cache = await caches.open(name);
    for (const request of await cache.keys()) {
      if (owned(request.url)) { await cache.delete(request); }
    }
  }
  await self.clients.claim();
  // Ask the painted page, not the cache, which application is running.
  // Cacheless intermediate releases also need automatic replacement.
  for (const client of await self.clients.matchAll({type:'window'})) {
    if (!owned(client.url)) continue;
    const current = await new Promise(resolve => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => {channel.port1.close();resolve(false);}, 800);
      channel.port1.onmessage = event => {clearTimeout(timer);channel.port1.close();resolve(event.data === 'potato-spatial-7');};
      client.postMessage({type:'POTATO_VERSION_REQUEST'}, [channel.port2]);
    });
    // Navigation fetches wait for activation; never await them inside activate.
    if (!current) void client.navigate(root.href + '?release=potato-spatial-7#plant').catch(()=>{});
  }
})()));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !owned(event.request.url)) return;
  if (event.request.mode === 'navigate') {
    const url = new URL(event.request.url);
    if (url.pathname !== root.pathname && url.pathname !== root.pathname + 'index.html') {
      event.respondWith(Promise.resolve(Response.redirect(root.href + '#plant', 302)));
      return;
    }
  }
  event.respondWith(fetch(event.request, {cache:'no-store'}));
});
