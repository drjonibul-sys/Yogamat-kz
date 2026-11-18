/* Йога-студия yoga_matkz — офлайн-режим. Версия кэша совпадает с версией приложения (проверяется тестом). */
const VERSION = '1.6.0';
const CACHE = 'yogamat-' + VERSION;
const SHELL = ['./', 'index.html', 'app.css', 'store.js', 'ui.js', 'screens.js', 'screens2.js', 'catalog.js', 'guide.js', 'pdf.js', 'app.js', 'vendor/jspdf.umd.min.js', 'vendor/jspdf.plugin.autotable.min.js', 'vendor/font-regular.ttf', 'vendor/font-bold.ttf', 'manifest.webmanifest',
  'icons/logo.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'data/asanas.json', 'data/practices.json', 'data/images.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('yogamat-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.endsWith('/version.json')) return;
  const heavy = url.pathname.includes('/images/');
  if (heavy) { // картинки: из кэша, при отсутствии — из сети с сохранением
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; })));
    return;
  }
  // страницы и скрипты: сначала сеть (чтобы обновления доходили сразу), без сети — кэш
  e.respondWith(fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; })
    .catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
