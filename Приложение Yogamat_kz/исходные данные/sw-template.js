/* Only this app's static files are cached; records remain in localStorage. */
'use strict';
const VERSION = '__VERSION__';
const ASSETS = __ASSETS__;
const HASHES = __HASHES__;
const MANIFEST_URL = new URL('__asset-hashes.json', self.registration.scope).href;
const BASE = self.registration.scope;
const PREFIX = 'yoga-practice:' + BASE + ':';
const CACHE = PREFIX + VERSION;
// Static hosting redirects index.html to the directory URL (307). Fetch it directly.
const assetURLs = ASSETS.map(path => path === 'index.html' ? BASE : new URL(path, BASE).href);
const coreURLs = assetURLs.filter(url => !url.includes('/images/anatomy/'));
const allowed = new Set(assetURLs);
const indexURL = BASE;
const legacyIndexURL = new URL('index.html', BASE).href;
let preparation = null, lastError = '';

async function checkedAsset(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(new Request(url, {cache:'reload', credentials:'same-origin', redirect:'error', signal:controller.signal}));
    if (!response.ok || response.redirected || response.type === 'opaque') throw new Error('network');
    if (response.url && new URL(response.url).origin !== new URL(BASE).origin) throw new Error('network');
    const mime = response.headers.get('Content-Type') || '';
    if (url === indexURL) {
      if (!mime.includes('text/html') || !(await response.clone().text()).includes('content="yoga-practice-pwa"')) throw new Error('network');
    } else if (mime.includes('text/html')) {
      throw new Error('network'); // Never store an authentication page instead of an asset.
    }
    return response;
  } finally { clearTimeout(timer); }
}
// Reuse unchanged non-core files (illustrations) from the previous version's cache,
// so an update does not re-download ~55 MB and offline images stay available.
async function inheritUnchanged(cache) {
  try {
    const names = (await caches.keys()).filter(key => key.startsWith(PREFIX) && key !== CACHE);
    for (const name of names) {
      const old = await caches.open(name);
      const saved = await old.match(MANIFEST_URL);
      if (!saved) continue;
      const oldHashes = await saved.json();
      for (const path of ASSETS) {
        const url = path === 'index.html' ? BASE : new URL(path, BASE).href;
        if (coreURLs.includes(url) || !HASHES[path] || oldHashes[path] !== HASHES[path]) continue;
        if (await cache.match(url)) continue;
        const hit = await old.match(url);
        if (hit && hit.ok) { try { await cache.put(url, hit); } catch { /* quota: downloaded later */ } }
      }
    }
  } catch { /* Inheriting is an optimisation only. */ }
}
async function cacheStatus() {
  const cache = await caches.open(CACHE);
  // Read keys, not dozens of multi-megabyte response bodies on older iPads.
  const keys = new Set((await cache.keys()).map(request => request.url));
  const loaded = assetURLs.filter(url => keys.has(url)).length;
  return {type:'CACHE_STATUS',version:VERSION,ready:loaded===assetURLs.length,
    coreReady:coreURLs.every(url => keys.has(url)),loaded,total:assetURLs.length,
    preparing:!!preparation,error:lastError};
}
async function broadcastStatus() {
  const status = await cacheStatus();
  for (const client of await self.clients.matchAll({type:'window',includeUncontrolled:true})) client.postMessage(status);
}
async function saveAssets(urls, skipCached, progress) {
  const cache = await caches.open(CACHE);
  const keys = skipCached ? new Set((await cache.keys()).map(request => request.url)) : new Set();
  const pending = urls.filter(url => !keys.has(url));
  let next = 0, failure = null;
  async function runner() {
    while (next < pending.length) {
      const url = pending[next++];
      try { await cache.put(url, await checkedAsset(url)); }
      catch (error) { failure = error; lastError = error.name === 'QuotaExceededError' ? 'storage' : 'network'; }
      if (progress) await broadcastStatus();
    }
  }
  // Two downloads at a time keep memory and connections bounded on iPad Pro 10.5.
  await Promise.all([runner(),runner()]);
  if (failure) throw failure;
}
function prepareOffline() {
  if (preparation) return preparation;
  lastError = '';
  preparation = (async () => {
    try { await saveAssets([...coreURLs,...assetURLs.filter(url => !coreURLs.includes(url))],true,true); }
    catch { /* Successful files remain saved; the next attempt resumes missing files. */ }
    finally { preparation = null; await broadcastStatus(); }
  })();
  return preparation;
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    try {
      await saveAssets(coreURLs,false,false);
      const cache = await caches.open(CACHE);
      await cache.put(MANIFEST_URL, new Response(JSON.stringify(HASHES), {headers:{'Content-Type':'application/json'}}));
      await inheritUnchanged(cache);
    }
    catch (error) { await caches.delete(CACHE); throw error; }
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== new URL(BASE).origin) return;
  // Always fetch update metadata from the network; never serve a stale manifest.
  if (url.pathname === new URL('app-update.json', BASE).pathname) {
    event.respondWith(fetch(new Request(request, {cache:'no-store'})));
    return;
  }
  const bare = new URL(url.href); bare.search = ''; bare.hash = '';
  const navigation = request.mode === 'navigate' && (bare.href === indexURL || bare.href === legacyIndexURL);
  if (!navigation && !allowed.has(bare.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const asset = navigation ? indexURL : bare.href;
    const cached = await cache.match(asset);
    if (cached) return cached;
    try {
      const response = await checkedAsset(asset);
      try { await cache.put(asset,response.clone()); } catch { /* A full disk must not block online use. */ }
      return response;
    } catch {
      if (navigation) return new Response('<!doctype html><html lang="ru"><meta charset="utf-8"><title>Йога-практика</title><p>Для загрузки приложения подключитесь к интернету и откройте его снова.</p></html>', {status:503,headers:{'Content-Type':'text/html; charset=utf-8'}});
      return Response.error();
    }
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') { event.waitUntil(self.skipWaiting()); return; }
  if (event.data?.type === 'PREPARE_OFFLINE') { event.waitUntil(prepareOffline()); return; }
  if (event.data?.type === 'CACHE_STATUS') {
    event.waitUntil((async () => {
      const status = await cacheStatus();
      if (event.ports?.[0]) event.ports[0].postMessage(status);
      else event.source?.postMessage(status);
    })());
  }
});
