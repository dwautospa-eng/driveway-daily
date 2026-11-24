// Offline support. Network first (so updates show up right away), cache as the fallback.
const CACHE = 'driveway-daily-v2';
const SHELL = [
  './', './index.html', './styles.css', './manifest.webmanifest', './config.js',
  './icon-192.png', './apple-touch-icon.png',
  './main.js',
  './preact.js', './util.js', './dates.js', './logic.js',
  './defaults.js', './store.js', './cloud.js',
  './common.js', './checkin.js', './today.js', './tasks.js', './eod.js',
  './cash.js', './wins.js', './settings.js', './goals.js', './celebrate.js',
  './sunday.js', './login.js',
];
const CDN = ['unpkg.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const ours = url.origin === self.location.origin;
  if (!ours && !CDN.includes(url.hostname)) return; // never touch Supabase / API calls
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: ours }).then((hit) => hit || caches.match('./index.html'))),
  );
});
