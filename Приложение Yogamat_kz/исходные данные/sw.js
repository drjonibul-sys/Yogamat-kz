/* Only this app's static files are cached; records remain in localStorage. */
'use strict';
const VERSION = '95330c3252ee9b94';
const ASSETS = [
  "app-update.json",
  "asanas.js",
  "auth-config.js",
  "auth.js",
  "fonts.css",
  "fonts/font-0.ttf",
  "fonts/font-1.ttf",
  "fonts/font-2.ttf",
  "fonts/font-3.ttf",
  "fonts/font-4.ttf",
  "fonts/font-5.ttf",
  "fonts/font-6.ttf",
  "fonts/font-7.ttf",
  "fonts/fraunces-OFL.txt",
  "fonts/worksans-OFL.txt",
  "help.js",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/logo.png",
  "images.js",
  "images/anatomy/atlas-1.png",
  "images/anatomy/atlas-10.png",
  "images/anatomy/atlas-11.png",
  "images/anatomy/atlas-12.png",
  "images/anatomy/atlas-13.png",
  "images/anatomy/atlas-14.png",
  "images/anatomy/atlas-15.png",
  "images/anatomy/atlas-16.png",
  "images/anatomy/atlas-17.png",
  "images/anatomy/atlas-18.png",
  "images/anatomy/atlas-19.png",
  "images/anatomy/atlas-2.png",
  "images/anatomy/atlas-20.png",
  "images/anatomy/atlas-21.png",
  "images/anatomy/atlas-22.png",
  "images/anatomy/atlas-23.png",
  "images/anatomy/atlas-24.png",
  "images/anatomy/atlas-25.png",
  "images/anatomy/atlas-26.png",
  "images/anatomy/atlas-27.png",
  "images/anatomy/atlas-28.png",
  "images/anatomy/atlas-29.png",
  "images/anatomy/atlas-3.png",
  "images/anatomy/atlas-30.png",
  "images/anatomy/atlas-31.png",
  "images/anatomy/atlas-32.png",
  "images/anatomy/atlas-33.png",
  "images/anatomy/atlas-34.png",
  "images/anatomy/atlas-35.png",
  "images/anatomy/atlas-4.png",
  "images/anatomy/atlas-5.png",
  "images/anatomy/atlas-6.png",
  "images/anatomy/atlas-7.png",
  "images/anatomy/atlas-8.png",
  "images/anatomy/atlas-9.png",
  "index.html",
  "logo.css",
  "logo.js",
  "manifest.webmanifest",
  "mobile.css",
  "practices.css",
  "practices.js",
  "pwa.css",
  "pwa.js",
  "rent.css",
  "rent.js",
  "team.css",
  "team.js",
  "updates.js",
  "validation.js"
];
const HASHES = {"asanas.js": "5dad22991bb2d792", "auth-config.js": "5ef00b1eb568faf4", "auth.js": "1e3e2ebaadb99787", "fonts.css": "deba976c40c009cc", "fonts/font-0.ttf": "3eb6cf0a14feb187", "fonts/font-1.ttf": "0c2fad18ed36cc40", "fonts/font-2.ttf": "ff7cf63717c27756", "fonts/font-3.ttf": "f0a9d39b9f14079c", "fonts/font-4.ttf": "a131e7022b34ef19", "fonts/font-5.ttf": "caf10fc663629866", "fonts/font-6.ttf": "4bcd994d0502df7c", "fonts/font-7.ttf": "e8398b22225a1f97", "fonts/fraunces-OFL.txt": "bdf4c22802eaf804", "fonts/worksans-OFL.txt": "749aca05078664ce", "help.js": "d814b6374b6a866c", "icons/apple-touch-icon.png": "1121b1030250ce6c", "icons/icon-192.png": "3dd0d82d0c5256b7", "icons/icon-512.png": "3f59678c1436e11e", "icons/icon-maskable-512.png": "0dec348c0226f99c", "icons/logo.png": "1d0546cc52993f79", "images.js": "5a81f4f0090ded63", "images/anatomy/atlas-1.png": "4293973c34405750", "images/anatomy/atlas-10.png": "958fead8de98be3f", "images/anatomy/atlas-11.png": "10bdb16fe46d14d3", "images/anatomy/atlas-12.png": "8b6f6ae0a6e89756", "images/anatomy/atlas-13.png": "aef18e828ff9c418", "images/anatomy/atlas-14.png": "b005f2615dcca846", "images/anatomy/atlas-15.png": "c82a9fadf448c559", "images/anatomy/atlas-16.png": "36775d2dca23ff5e", "images/anatomy/atlas-17.png": "9a03d36138f2308d", "images/anatomy/atlas-18.png": "d20b2d436a86f744", "images/anatomy/atlas-19.png": "7cda6d63799621c0", "images/anatomy/atlas-2.png": "1ea563a2f9386d49", "images/anatomy/atlas-20.png": "3b2c97962cf03a38", "images/anatomy/atlas-21.png": "680956eb2bab181e", "images/anatomy/atlas-22.png": "a9c0e56cd054c867", "images/anatomy/atlas-23.png": "210b5e9842d685fb", "images/anatomy/atlas-24.png": "e07f68077f1f15ac", "images/anatomy/atlas-25.png": "b3091465bfd49021", "images/anatomy/atlas-26.png": "7b62d5a6ce7d1dab", "images/anatomy/atlas-27.png": "61b0f1ac98022470", "images/anatomy/atlas-28.png": "f75072889f0e292e", "images/anatomy/atlas-29.png": "e3a558f5b373f349", "images/anatomy/atlas-3.png": "c7d20481d9211074", "images/anatomy/atlas-30.png": "da60a711be914107", "images/anatomy/atlas-31.png": "40c3e93b3c8813ff", "images/anatomy/atlas-32.png": "f372fae84e8c7169", "images/anatomy/atlas-33.png": "f512387840fc8237", "images/anatomy/atlas-34.png": "06212ec3ad93cab5", "images/anatomy/atlas-35.png": "405f88a69ea99791", "images/anatomy/atlas-4.png": "e2d5192f5e85cdf4", "images/anatomy/atlas-5.png": "71ad4182cf70a86f", "images/anatomy/atlas-6.png": "a95f7946cf02fa2f", "images/anatomy/atlas-7.png": "21fc371449f5df9a", "images/anatomy/atlas-8.png": "0fd67343ddb78216", "images/anatomy/atlas-9.png": "84b677d9aaf638cf", "index.html": "1661791907d02c48", "logo.css": "55e13657d13d4634", "logo.js": "6cf307e59bb7bf31", "manifest.webmanifest": "7644c58c96bd19e5", "mobile.css": "a54afa4e22100843", "practices.css": "bd31726b27fda068", "practices.js": "69e4569e4662269f", "pwa.css": "8f339340a207f0c7", "pwa.js": "7b1aa0023d233c51", "rent.css": "9a4f4e7f1663115c", "rent.js": "b6eb682ebc8bf946", "team.css": "0eb2171989702eae", "team.js": "7d299d601bf6150c", "updates.js": "3a11dcee69b77a0b", "validation.js": "c30022a445b122d6"};
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
