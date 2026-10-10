/* Offline cache for the hosted build. Bump CACHE when assets change. */
var CACHE = 'mi-gams-v2';
var CORE = [
  './', './index.html', './css/game.css', './js/core.js', './js/builders.js', './js/game.js', './js/loop.js', './js/ui.js',
  './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-192.png', './icons/maskable-512.png',
  './icons/apple-touch-icon.png', './icons/favicon-32.png',
  './audio/music.mp3', './audio/hit.mp3', './audio/heart.mp3', './audio/shoot.mp3', './audio/explode.mp3',
  './audio/levelup.mp3', './audio/gameover.mp3', './audio/roar.mp3', './audio/whoosh.mp3',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      /* Cache the core one by one so a single failing URL (fonts offline) does not abort the install. */
      return Promise.all(CORE.map(function (u) { return c.add(u).catch(function () {}); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* Same-origin html, css and js: network first so updates land on the next open, cache when offline.
   Audio, icons, three.js and fonts: cache first, they never change without a cache-name bump. */
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  var same = url.origin === location.origin;
  if (!same && url.hostname !== 'cdnjs.cloudflare.com' && !isFont) return;
  var code = same && /\.(html|css|js|webmanifest)$|\/$/.test(url.pathname);
  function store(res) {
    if (res && (res.ok || res.type === 'opaque')) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
    return res;
  }
  if (code || req.mode === 'navigate') {
    e.respondWith(fetch(req).then(store).catch(function () {
      return caches.match(req).then(function (hit) { return hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined); });
    }));
  } else {
    e.respondWith(caches.match(req).then(function (hit) { return hit || fetch(req).then(store); }));
  }
});
