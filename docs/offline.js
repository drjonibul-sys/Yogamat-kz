/* Готовность к работе без интернета: проверка кэша, фоновая загрузка справочника, индикаторы. */
(function () {
  'use strict';
  const App = window.App; const { h, clear } = UI;
  const IMG_CACHE = 'yogamat-img';
  const st = { supported: 'serviceWorker' in navigator && location.protocol !== 'file:' && typeof caches !== 'undefined', controlled: false, shellHave: 0, shellTotal: 0, imgHave: 0, imgTotal: 0, busy: false, error: null };
  const online = () => navigator.onLine !== false;
  const subs = new Set(); const emit = () => subs.forEach((f) => { try { f(); } catch (e) { /* ок */ } });
  const url = (u) => new URL(u, document.baseURI).href;
  let imgUrls = null;

  async function imageList() {
    if (imgUrls) return imgUrls;
    const r = await fetch('data/asanas.json'); const list = await r.json();
    imgUrls = list.flatMap((a) => ['images/a/' + a.imageKey + '.webp', 'images/t/' + a.imageKey + '.webp']); return imgUrls;
  }
  async function inspect() {
    if (!st.supported) { emit(); return st; }
    try {
      st.controlled = !!navigator.serviceWorker.controller;
      const files = window.SHELL_FILES || []; st.shellTotal = files.length;
      const c = await caches.open('yogamat-' + Studio.APP_VERSION); let have = 0;
      for (const f of files) if (await c.match(url(f))) have++;
      st.shellHave = have;
      const list = await imageList(); st.imgTotal = list.length;
      const ic = await caches.open(IMG_CACHE); const keys = await ic.keys(); const set = new Set(keys.map((k) => k.url));
      st.imgHave = list.filter((u) => set.has(url(u))).length;
    } catch (e) { st.error = e.message; }
    emit(); return st;
  }
  /* скачать недостающие картинки справочника (по 4 одновременно); они сохраняются service worker'ом */
  async function prepare() {
    if (st.busy || !st.supported || !online()) return;
    st.busy = true; st.error = null; emit();
    try {
      const list = await imageList(); const ic = await caches.open(IMG_CACHE); const have = new Set((await ic.keys()).map((k) => k.url));
      const todo = list.filter((u) => !have.has(url(u))); let i = 0; let failed = 0;
      const worker = async () => { while (i < todo.length) { const u = todo[i++]; try { const r = await fetch(u); if (!r.ok) throw new Error('HTTP ' + r.status); if (!(await ic.match(url(u)))) await ic.put(url(u), r.clone()); await r.arrayBuffer(); } catch (e) { failed++; } st.imgHave = Math.min(st.imgTotal, st.imgTotal - todo.length + i - failed); emit(); } };
      await Promise.all([worker(), worker(), worker(), worker()]);
      if (failed) st.error = 'Не удалось загрузить файлов: ' + failed + '. Повторите при стабильном интернете.';
    } catch (e) { st.error = e.message; }
    st.busy = false; await inspect();
  }
  const level = () => {
    if (!st.supported) return 'unsupported';
    if (!st.controlled || st.shellHave < st.shellTotal) return 'preparing';
    if (st.imgTotal && st.imgHave < st.imgTotal) return st.busy ? 'loading' : 'partial';
    return 'ready';
  };
  const pctImg = () => (st.imgTotal ? Math.round((st.imgHave / st.imgTotal) * 100) : 100);
  const label = () => ({ unsupported: 'Офлайн недоступен в этом браузере', preparing: 'Подготовка к офлайн…', loading: 'Загрузка справочника для офлайн… ' + pctImg() + '%', partial: 'Офлайн: основное готово, справочник ' + pctImg() + '%', ready: 'Офлайн: готово' }[level()]);

  /* маленькая плашка для Обзора: обновляется на месте */
  App.offlineBadge = () => {
    const el = h('button', { class: 'off-badge', type: 'button', 'aria-live': 'polite', onclick: () => App.go('/settings') });
    const paint = () => { const lv = level(); el.className = 'off-badge ' + (online() ? lv : 'offline'); el.textContent = ''; el.append(h('i', { 'aria-hidden': 'true' }), document.createTextNode(online() ? label() : 'Нет сети · работает офлайн')); };
    const f = () => { if (!el.isConnected && el.__seen) { subs.delete(f); return; } el.__seen = el.__seen || el.isConnected; paint(); };
    subs.add(f); paint(); return el;
  };
  /* подробный блок для «Настройки» */
  App.offlineBlock = () => {
    const box = h('div', { class: 'stack s8' });
    const paint = () => {
      clear(box); const lv = level();
      const row = (ok, title, sub) => h('div', { class: 'off-row' }, h('i', { class: ok ? 'ok' : 'wait', 'aria-hidden': 'true' }), h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 } }, title), sub ? h('div', { class: 'soft small' }, sub) : null));
      box.append(...[h('div', { class: 'off-head ' + lv }, h('b', null, label())),
        row(st.controlled && st.shellHave >= st.shellTotal, 'Приложение', st.shellTotal ? 'файлов в памяти устройства: ' + st.shellHave + ' из ' + st.shellTotal : 'проверка…'),
        row(st.imgTotal > 0 && st.imgHave >= st.imgTotal, 'Справочник асан (иллюстрации)', st.imgTotal ? st.imgHave + ' из ' + st.imgTotal + ' (' + pctImg() + '%)' : 'проверка…'),
        st.busy ? h('div', { class: 'upd-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pctImg()), 'aria-label': 'Загрузка для офлайн' }, h('i', { style: { width: pctImg() + '%' } })) : null,
        st.error ? h('div', { class: 'card warn small' }, st.error) : null,
        h('div', { class: 'row' }, h('button', { class: 'btn soft-btn', type: 'button', disabled: st.busy || !online() || !st.supported, onclick: prepare }, st.busy ? 'Загрузка…' : lv === 'ready' ? 'Проверить ещё раз' : 'Загрузить для офлайн'), h('button', { class: 'btn soft-btn', type: 'button', onclick: inspect }, 'Обновить статус')),
        h('div', { class: 'hint' }, 'Данные клиентов и расписание хранятся на устройстве и всегда доступны без интернета. Для надёжной работы добавьте приложение на экран «Домой» (Safari: «Поделиться» → «На экран Домой») и откройте его один раз с интернетом. Если долго не открывать приложение, iOS может очистить память сайта — сохраняйте базу в файл JSON.')].filter(Boolean));
    };
    const f = () => { if (!box.isConnected && box.__seen) { subs.delete(f); return; } box.__seen = box.__seen || box.isConnected; paint(); };
    subs.add(f); paint(); return box;
  };
  App.offline = { state: st, inspect, prepare, level, label };

  App.offline.start = async () => {
    window.addEventListener('online', () => { emit(); inspect().then(() => { if (level() === 'partial') prepare(); }); });
    window.addEventListener('offline', () => { emit(); });
    if (!st.supported) return emit();
    try { await navigator.serviceWorker.ready; } catch (e) { /* ок */ }
    await inspect();
    await new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(() => setTimeout(r, 6000), { timeout: 12000 }) : setTimeout(r, 8000))); /* докачка справочника — не мешает запуску */
    await inspect();
    const conn = navigator.connection; const saver = conn && conn.saveData;
    if (online() && !saver && level() !== 'ready') prepare(); /* фоновая загрузка справочника, пока есть интернет */
    navigator.serviceWorker.addEventListener('controllerchange', () => inspect());
  };
})();
