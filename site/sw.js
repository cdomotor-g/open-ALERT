// open-ALERT — the offline helper for the installed app.
//
// Network first: online, every page and file comes fresh from the site (new
// prices show at once); the last good copy is kept, so the app still opens
// without a signal. Only this site's own files are handled.

const CACHE = 'open-alert-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('open-alert-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req)
    .then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })
    .catch(() => caches.match(req, { ignoreSearch: true })
      .then(hit => hit || (req.mode === 'navigate' ? caches.match(new URL('./', self.location).href) : null))
      .then(hit => hit || Response.error())));
});
