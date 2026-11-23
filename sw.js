// Offline support. Network first (so updates show up right away), cache as the fallback.
const CACHE = 'driveway-daily-v1';
const SHELL = [
  './', './index.html', './styles.css', './manifest.webmanifest', './config.js',
  './icons/icon-192.png', './icons/apple-touch-icon.png',
  './src/main.js',
  './src/lib/preact.js', './src/lib/util.js', './src/lib/dates.js', './src/lib/logic.js',
  './src/lib/defaults.js', './src/lib/store.js', './src/lib/cloud.js',
  './src/ui/common.js', './src/ui/checkin.js', './src/ui/today.js', './src/ui/tasks.js', './src/ui/eod.js',
  './src/ui/cash.js', './src/ui/wins.js', './src/ui/settings.js', './src/ui/goals.js', './src/ui/celebrate.js',
  './src/ui/sunday.js', './src/ui/login.js',
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
