// Replace the legacy cache-first root worker. Always use network-fresh application
// assets; intentionally no fetch handler and no unrelated cache deletion.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
