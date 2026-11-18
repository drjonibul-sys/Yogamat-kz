/* Йога-студия Yogamat.kz — запуск, вход по PIN, навигация */
(function () {
  'use strict';
  const { RU } = Studio;
  const { h, clear, icon, avatar, field, input, toast } = UI;
  const App = window.App; const store = App.store;

  const root = document.getElementById('app');
  const bg = h('div', { class: 'bg', 'aria-hidden': 'true' }, h('img', { src: 'icons/logo.png', alt: '' }));
  const scroller = h('div', { class: 'page-scroll', id: 'main' });
  const tabbar = h('div', { class: 'tabbar-wrap' });
  root.append(bg, scroller, tabbar);
  const authRoot = h('div', { class: 'auth', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Вход' });
  document.body.appendChild(authRoot);

  const TABS = [['overview', 'Обзор', 'home'], ['clients', 'Клиенты', 'people'], ['visits', 'Визиты', 'calendar'], ['income', 'Доход', 'chart'], ['classes', 'Классы', 'lotus']];

  /* ---------- маршруты ---------- */
  function parse() {
    const raw = (location.hash || '#/overview').slice(1); const parts = raw.split('/').filter(Boolean);
    return { path: '/' + (parts[0] || 'overview'), param: parts[1] ? decodeURIComponent(parts[1]) : null };
  }
  let lastKey = null; let queued = false;
  function render() {
    queued = false;
    if (!store.currentUser) { showAuth(); return; }
    if (!authRoot.hidden) { authRoot.hidden = true; clear(authRoot); authDrawn = false; clearInterval(timer); document.body.classList.remove('locked'); }
    const { path, param } = parse(); const route = App.routes[path] || App.routes['/overview'];
    const key = path + '/' + (param || ''); const keep = key === lastKey ? scroller.scrollTop : 0; lastKey = key;
    let node; try { node = route.build(param); } catch (e) { console.error(e); node = h('div', { class: 'page' }, h('div', { class: 'card warn' }, 'Не удалось показать экран: ' + e.message)); }
    clear(scroller); scroller.append(node, UI.footer(Studio.APP_VERSION)); scroller.scrollTop = keep;
    clear(tabbar);
    const tabs = TABS.filter((t) => t[0] !== 'income' || store.isAdmin);
    tabbar.appendChild(h('nav', { class: 'tabbar', 'aria-label': 'Разделы' }, tabs.map(([id, title, ic]) => h('button', { class: 'tab' + (route.tab === id ? ' on' : ''), type: 'button', 'aria-current': route.tab === id ? 'page' : null, onclick: () => { if (location.hash === '#/' + id) scroller.scrollTo({ top: 0, behavior: 'smooth' }); else App.go('/' + id); } },
      h('span', { class: 'ico' }, icon(ic)), h('span', null, title)))));
    document.title = 'Yogamat.kz';
  }
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(render); } };
  App.rerender = schedule;
  window.addEventListener('hashchange', () => { App.hasPrev = true; schedule(); });
  store.subscribe(schedule);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { if (store.currentUser) { store.refreshRentWindow(); store.maintainAutomaticBackup(); } schedule(); } });

  /* ---------- вход ---------- */
  let authDrawn = false; let timer = null;
  function showAuth() {
    document.body.classList.add('locked'); authRoot.hidden = false; UI.closeAllSheets();
    if (authDrawn) return;
    if (!store.state.staff.length) authSetup(); else authChoose();
  }
  const authShell = (title, lead, ...kids) => { clearInterval(timer); authDrawn = true; clear(authRoot); authRoot.appendChild(h('div', { class: 'auth-inner' }, h('img', { class: 'logo', src: 'icons/logo.png', alt: 'Yogamat.kz' }), h('h1', null, title), lead ? h('p', { class: 'lead' }, lead) : null, ...kids, UI.footer(Studio.APP_VERSION))); const f = authRoot.querySelector('input'); if (f) setTimeout(() => f.focus({ preventScroll: true }), 50); };
  const pinInput = (ph) => input({ type: 'password', inputmode: 'numeric', pattern: '[0-9]*', maxlength: 8, class: 'inp pin', placeholder: ph || '••••', autocomplete: 'off' });
  const errBox = () => h('div', { class: 'err', role: 'alert', hidden: true });
  const showErr = (box, msg) => { box.textContent = msg; box.hidden = !msg; };

  function authSetup() {
    const name = input({ placeholder: 'Например: Анна Ким', autocapitalize: 'words' }); const pin = pinInput('PIN, 4–8 цифр'); const pin2 = pinInput('Повторите PIN'); const err = errBox();
    const go = h('button', { class: 'btn', type: 'button' }, 'Продолжить');
    go.addEventListener('click', () => {
      if (!store.isValidPIN(pin.value)) return showErr(err, 'PIN — от 4 до 8 цифр');
      if (pin.value !== pin2.value) return showErr(err, 'PIN не совпадает с повтором');
      authRecoveryStep(name.value, pin.value);
    });
    authShell('Первый запуск', 'Создайте аккаунт администратора студии. Данные хранятся только на этом устройстве.', field('Ваше имя', name), field('PIN для входа', pin), field(null, pin2), err, go);
  }
  function authRecoveryStep(name, pin) {
    const code = store.makeRecoveryCode(); const ok = h('input', { type: 'checkbox', id: 'rc-ok' }); const err = errBox();
    const go = h('button', { class: 'btn', type: 'button', disabled: true }, 'Начать работу');
    ok.addEventListener('change', () => { go.disabled = !ok.checked; });
    const copy = h('button', { class: 'btn soft-btn', type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(code); toast('Код скопирован'); } catch (e) { toast('Запишите код вручную'); } } }, 'Скопировать код');
    go.addEventListener('click', async () => { go.disabled = true; try { await store.setupAdmin(name, pin, code); } catch (e) { showErr(err, e.message); go.disabled = false; } });
    authShell('Код восстановления', 'Если забудете PIN, этот код вернёт доступ. Запишите его и храните отдельно от телефона — повторно он не показывается.', h('div', { class: 'code-box', 'aria-label': 'Код восстановления' }, code), copy,
      h('label', { class: 'row', style: { gap: '10px' } }, ok, h('span', null, 'Я записал(а) код восстановления')), err, go);
  }
  function authChoose() {
    const users = store.state.staff.filter((u) => u.active);
    authShell('Кто вы?', 'Выберите себя, чтобы войти в приложение.', ...users.map((u) => h('button', { class: 'user-card', type: 'button', onclick: () => authPin(u) }, avatar(u.name, 48), h('div', { class: 'grow' }, h('div', { class: 'h3' }, u.name), h('div', { class: 'soft small' }, u.role === 'admin' ? 'Администратор' : 'Тренер')), icon('chev', 'chev'))));
  }
  function authPin(user) {
    const pin = pinInput(); const err = errBox(); const go = h('button', { class: 'btn', type: 'button' }, 'Войти');
    const lockTick = () => { const s = store.lockRemainingSeconds(user.id); if (s > 0) { showErr(err, 'Вход заблокирован ещё на ' + s + ' с.'); go.disabled = true; } else { if (go.disabled) { go.disabled = false; showErr(err, ''); } clearInterval(timer); } };
    const run = async () => { if (go.disabled) return; go.disabled = true; try { await store.logIn(user.id, pin.value); } catch (e) { showErr(err, e.message); pin.value = ''; go.disabled = false; pin.focus(); lockTick(); if (store.lockRemainingSeconds(user.id) > 0) timer = setInterval(lockTick, 1000); } };
    go.addEventListener('click', run); pin.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
    authShell(user.name, 'Введите PIN', pin, err, go,
      h('button', { class: 'link', type: 'button', onclick: () => authRecover(user) }, 'Забыли PIN?'), store.state.staff.filter((u) => u.active).length > 1 ? h('button', { class: 'link', type: 'button', style: { color: 'var(--ink-soft)' }, onclick: authChoose }, 'Назад') : null);
    lockTick(); if (store.lockRemainingSeconds(user.id) > 0) timer = setInterval(lockTick, 1000);
  }
  function authRecover(user) {
    const code = input({ placeholder: 'XXXX-XXXX', autocapitalize: 'characters', style: { textTransform: 'uppercase' } }); const pin = pinInput('Новый PIN, 4–8 цифр'); const pin2 = pinInput('Повторите новый PIN'); const err = errBox();
    const go = h('button', { class: 'btn', type: 'button' }, 'Сменить PIN и войти');
    go.addEventListener('click', async () => { if (pin.value !== pin2.value) return showErr(err, 'PIN не совпадает с повтором'); go.disabled = true; try { await store.resetPIN(user.id, code.value, pin.value); await store.logIn(user.id, pin.value); } catch (e) { showErr(err, e.message); go.disabled = false; } });
    authShell('Восстановление доступа', user.name + ': введите код восстановления и задайте новый PIN.', field('Код восстановления', code), field('Новый PIN', pin), field(null, pin2), err, go, h('button', { class: 'link', type: 'button', style: { color: 'var(--ink-soft)' }, onclick: () => authPin(user) }, 'Назад'));
  }
  /* ---------- тема ---------- */
  const metas = Array.from(document.querySelectorAll('meta[name="theme-color"]')).map((m) => ({ m, media: m.getAttribute('media'), content: m.getAttribute('content') }));
  App.setTheme = (mode) => {
    App.setPref('theme', mode);
    const el = document.documentElement; const explicit = mode === 'light' || mode === 'dark';
    if (explicit) el.setAttribute('data-theme', mode); else el.removeAttribute('data-theme');
    metas.forEach((x) => { if (explicit) { x.m.removeAttribute('media'); x.m.setAttribute('content', mode === 'dark' ? '#141B16' : '#F3F6EF'); } else { if (x.media) x.m.setAttribute('media', x.media); x.m.setAttribute('content', x.content); } });
  };
  if (App.prefs.theme === 'light' || App.prefs.theme === 'dark') App.setTheme(App.prefs.theme);

  /* ---------- проверка версии на сайте ---------- */
  App.update = null;
  App.checkUpdate = async () => {
    try {
      const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const v = String((await r.json()).version || '');
      const c = Studio.cmpVersion(v, Studio.APP_VERSION);
      App.update = { version: v, state: c > 0 ? 'new' : c < 0 ? 'older' : 'same' };
    } catch (e) { App.update = { state: 'offline' }; }
    schedule(); return App.update;
  };

  /* ---------- запуск ---------- */
  store.load();
  store.refreshRentWindow();
  if (store.currentUser) store.maintainAutomaticBackup();
  if (!location.hash) history.replaceState(null, '', '#/overview');
  render();
  if (navigator.onLine !== false) App.checkUpdate();
  window.addEventListener('online', () => App.checkUpdate());

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* офлайн-режим недоступен */ }); });
  }
})();
