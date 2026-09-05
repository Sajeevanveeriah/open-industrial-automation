// Migration worker: retire only this project's old cache-first application.
// Do not cache HTML or model assets, and do not touch neighbouring GitHub sites.
const root = new URL('./', self.location.href);
root.pathname = root.pathname.replace(/(?:suite|potato)\/$/, '');
const owned = url => { const u = new URL(url); return u.origin === root.origin && u.pathname.startsWith(root.pathname); };
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  let stale = false;
  for (const name of await caches.keys()) {
    if (!name.startsWith('oia-')) continue;
    const cache = await caches.open(name);
    for (const request of await cache.keys()) {
      if (owned(request.url)) { stale = true; await cache.delete(request); }
    }
  }
  await self.clients.claim();
  // Claiming alone leaves the retired UI painted until a manual reload.
  if (stale || self.registration.scope !== root.href) {
    for (const client of await self.clients.matchAll({type:'window'})) {
      if (owned(client.url)) await client.navigate(root.href + '?release=potato-only-3#plant');
    }
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
