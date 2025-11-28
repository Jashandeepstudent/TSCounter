
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open('meurbal-cache').then(cache => {
      return cache.addAll([
        './',
        './index.html',
        './melogo.png',
        './manifest.json'
      ]);
    })
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(response => {
      return response || fetch(e.request);
    })
  );
});
