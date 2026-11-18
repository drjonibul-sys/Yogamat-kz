/* Вход по e-mail через Supabase Auth (одноразовый код из письма, без ссылок) и список разрешённых адресов.
   Клиентская база в Supabase не отправляется: сервер хранит только адреса, роли и имена. */
(() => {
  'use strict';
  const CONFIG_KEY = 'yogaTrackerAuthConfig_v1', CACHE_KEY = 'yogaTrackerEmailSession_v1';
  const OFFLINE_DAYS = 7, RECHECK_MS = 12 * 60 * 60 * 1000;
  const norm = value => String(value || '').trim().toLowerCase();
  const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 120;

  function readConfig() {
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null'); } catch { /* файловые настройки */ }
    const file = window.YOGA_AUTH_CONFIG || {};
    const url = String((stored && stored.url) || file.url || '').trim().replace(/\/+$/, '');
    const anonKey = String((stored && stored.anonKey) || file.anonKey || '').trim();
    return { url, anonKey, fromFile: !(stored && stored.url) };
  }
  let config = readConfig();
  const goodUrl = url => /^https:\/\/[^\s/]+$/.test(url) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url);
  const configured = () => goodUrl(config.url) && config.anonKey.length > 20;
  /* только при открытии через сайт: https или localhost (проверка разработчика) */
  const siteMode = () => location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  const enabled = () => configured() && siteMode();

  let cache = null;
  function loadCache() { try { const d = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); cache = d && typeof d === 'object' ? d : null; } catch { cache = null; } }
  function saveCache() { try { if (cache) localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); else localStorage.removeItem(CACHE_KEY); } catch { /* память заполнена: сеанс останется до перезагрузки */ } }
  loadCache();

  async function call(path, { method = 'GET', body, token, prefer } = {}) {
    const headers = { apikey: config.anonKey, 'Content-Type': 'application/json' };
    headers.Authorization = 'Bearer ' + (token || config.anonKey);
    if (prefer) headers.Prefer = prefer;
    let response;
    try { response = await fetch(config.url + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch { const error = new Error('Нет связи с сервером. Проверьте интернет.'); error.offline = true; throw error; }
    let data = null; const text = await response.text();
    if (text) { try { data = JSON.parse(text); } catch { data = text; } }
    if (!response.ok) {
      const error = new Error((data && (data.error_description || data.msg || data.message)) || ('Ошибка сервера ' + response.status));
      error.status = response.status; throw error;
    }
    return data;
  }

  const ROLE_NAMES = { admin: 'Администратор', trainer: 'Тренер' };
  const publicTeam = rows => (Array.isArray(rows) ? rows : []).filter(r => r && r.active !== false).map(r => ({ id: norm(r.email), name: r.display_name || r.email, role: r.role, email: norm(r.email) }));

  async function tokenFor() {
    if (!cache) throw new Error('Нет сеанса');
    if (cache.access_token && cache.expires_at && Date.now() < cache.expires_at - 30000) return cache.access_token;
    const data = await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: cache.refresh_token } });
    applyTokens(data); saveCache(); return cache.access_token;
  }
  function applyTokens(data) {
    cache.access_token = data.access_token; cache.refresh_token = data.refresh_token || cache.refresh_token;
    cache.expires_at = Date.now() + (Number(data.expires_in) || 3600) * 1000;
  }
  async function loadProfile(token, email) {
    const rows = await call('/rest/v1/allowed_emails?select=email,role,display_name,active&order=display_name', { token });
    const mine = (Array.isArray(rows) ? rows : []).find(r => norm(r.email) === email);
    return { mine, team: publicTeam(rows) };
  }

  const api = {
    enabled, configured, siteMode,
    config: () => ({ url: config.url, anonKey: config.anonKey, fromFile: config.fromFile }),
    setConfig(url, anonKey) {
      url = String(url || '').trim().replace(/\/+$/, ''); anonKey = String(anonKey || '').trim();
      if (!url && !anonKey) { try { localStorage.removeItem(CONFIG_KEY); } catch { /* нет доступа */ } config = readConfig(); return; }
      if (!goodUrl(url)) throw new Error('Адрес проекта: https://xxxx.supabase.co');
      if (anonKey.length < 20) throw new Error('Вставьте публичный ключ anon');
      if (/service_role/i.test(anonKey)) throw new Error('Ключ service_role использовать нельзя');
      try { const payload = JSON.parse(atob(anonKey.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); if (payload.role === 'service_role') throw new Error('Ключ service_role использовать нельзя'); }
      catch (error) { if (/service_role/.test(error.message)) throw error; }
      localStorage.setItem(CONFIG_KEY, JSON.stringify({ url, anonKey })); config = readConfig();
    },
    /* пользователь из сохранённого сеанса; null, если нужен вход */
    user() {
      if (!enabled() || !cache || !cache.email || !cache.role || cache.active === false) return null;
      if (Date.now() - (cache.verifiedAt || 0) > OFFLINE_DAYS * 86400000) return null;
      return { role: cache.role, email: cache.email, name: cache.name || cache.email };
    },
    needsOnlineCheck: () => !!cache && Date.now() - (cache.verifiedAt || 0) > OFFLINE_DAYS * 86400000,
    team: () => (cache && cache.team) || [],
    async requestCode(email) {
      email = norm(email);
      if (!validEmail(email)) throw new Error('Введите адрес электронной почты');
      const allowed = await call('/rest/v1/rpc/email_allowed', { method: 'POST', body: { p_email: email } });
      if (allowed !== true) throw new Error('Для этого адреса доступ не выдан. Обратитесь к администратору.');
      await call('/auth/v1/otp', { method: 'POST', body: { email, create_user: true } });
      return email;
    },
    async verify(email, code) {
      email = norm(email); code = String(code || '').replace(/\s+/g, '');
      if (!/^\d{6,10}$/.test(code)) throw new Error('Введите код из письма (цифры)');
      const data = await call('/auth/v1/verify', { method: 'POST', body: { type: 'email', email, token: code } });
      if (!data || !data.access_token) throw new Error('Неверный или просроченный код');
      const { mine, team } = await loadProfile(data.access_token, email);
      if (!mine || mine.active === false || !ROLE_NAMES[mine.role]) { try { await call('/auth/v1/logout', { method: 'POST', token: data.access_token }); } catch { /* уже без доступа */ } throw new Error('Для этого адреса доступ не выдан. Обратитесь к администратору.'); }
      cache = { email, role: mine.role, name: mine.display_name || '', active: true, verifiedAt: Date.now(), team };
      applyTokens(data); saveCache();
      return api.user();
    },
    /* сверка с сервером: роль, имя, отключение; без сети кэш действует до OFFLINE_DAYS */
    async revalidate() {
      if (!enabled() || !cache) return { ok: false };
      if (Date.now() - (cache.checkedAt || 0) < RECHECK_MS && !api.needsOnlineCheck()) return { ok: true, skipped: true };
      try {
        const token = await tokenFor();
        const { mine, team } = await loadProfile(token, cache.email);
        if (!mine || mine.active === false) { cache = null; saveCache(); return { ok: false, revoked: true }; }
        cache.role = mine.role; cache.name = mine.display_name || ''; cache.team = team; cache.verifiedAt = Date.now(); cache.checkedAt = Date.now(); saveCache();
        return { ok: true, changed: true };
      } catch (error) {
        if (error.offline) return { ok: !api.needsOnlineCheck(), offline: true };
        if (error.status === 400 || error.status === 401 || error.status === 403) { cache = null; saveCache(); return { ok: false, revoked: true }; }
        return { ok: !api.needsOnlineCheck(), error: error.message };
      }
    },
    async signOut() {
      const token = cache && cache.access_token;
      cache = null; saveCache();
      if (token && enabled()) { try { await call('/auth/v1/logout', { method: 'POST', token }); } catch { /* сеанс уже очищен на устройстве */ } }
    },
    /* список адресов (администратор) */
    async list() { const token = await tokenFor(); const rows = await call('/rest/v1/allowed_emails?select=email,role,display_name,active&order=display_name', { token }); if (cache) { cache.team = publicTeam(rows); saveCache(); } return Array.isArray(rows) ? rows : []; },
    async save(row) {
      const email = norm(row.email);
      if (!validEmail(email)) throw new Error('Введите корректный адрес');
      if (!ROLE_NAMES[row.role]) throw new Error('Выберите роль');
      const token = await tokenFor();
      await call('/rest/v1/allowed_emails?on_conflict=email', { method: 'POST', token, prefer: 'resolution=merge-duplicates,return=minimal', body: { email, role: row.role, display_name: String(row.name || '').trim().slice(0, 60), active: row.active !== false } });
    },
    async remove(email) { const token = await tokenFor(); await call('/rest/v1/allowed_emails?email=eq.' + encodeURIComponent(norm(email)), { method: 'DELETE', token }); },
    roleName: role => ROLE_NAMES[role] || role
  };
  window.__emailAuth = api;
  window.addEventListener('online', () => { if (typeof window.__emailAuthOnline === 'function') window.__emailAuthOnline(); });
})();
