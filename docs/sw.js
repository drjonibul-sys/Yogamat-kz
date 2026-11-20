/* Йога-студия yoga_matkz — офлайн-режим. Версия кэша совпадает с версией приложения (проверяется тестом). */
const VERSION = '2.0.0';
const CACHE = 'yogamat-' + VERSION;
importScripts('shell.js');
const SHELL = self.SHELL_FILES;
const IMG_CACHE = 'yogamat-img'; /* картинки справочника не зависят от версии и не перекачиваются при обновлении */

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('yogamat-') && k !== CACHE && k !== IMG_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.endsWith('/version.json')) return;
  const heavy = url.pathname.includes('/images/');
  if (heavy) { // картинки: из кэша, при отсутствии — из сети с сохранением
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(IMG_CACHE).then((c) => c.put(req, copy)); } return res; })));
    return;
  }
  // оболочка приложения: сразу из кэша (запуск без сети и без ожидания); новая версия приходит через обновление service worker (кэш назван версией)
  e.respondWith(caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : null)).then((hit) => hit ||
    fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; })
      .catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
