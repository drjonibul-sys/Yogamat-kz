/* Roles: administrator (full access) and trainers (class work only).
   This is an interface-level restriction on a single device: PINs are stored as salted hashes,
   but data in localStorage is not encrypted. Access records are kept apart from backups and exports. */
(() => {
  'use strict';
  const ACCESS_KEY = 'yogaTrackerAccess_v1', SESSION_KEY = 'yogaTrackerSession_v1';
  const ITERATIONS = 2000, MAX_TRIES = 5, LOCK_MS = 30000;
  const RESTRICTED_FOR_TRAINER = ['plans','sales','finance','rent'];
  const ADMIN_ONLY_FUNCTIONS = ['openClientSheet','saveClient','deleteClient','openPlanSheet','savePlan','deletePlan',
    'openSaleSheet','saveSale','toggleSubPaid','openSubEditSheet','saveSubEdit','deleteSubscription','saveClass','deleteClass',
    'configureRent','toggleRentPaid','openArchiveSheet','manualBackupNow','exportBackupFile','importBackupFile','restoreBackup','deleteBackup'];

  /* ---------- SHA-256 (synchronous, works on plain http and in Safari) ---------- */
  const K = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  function sha256(message) {
    const bytes = new TextEncoder().encode(message), length = bytes.length;
    const padded = ((length + 9 + 63) >> 6) << 6, buffer = new Uint8Array(padded);
    buffer.set(bytes); buffer[length] = 0x80;
    const view = new DataView(buffer.buffer);
    view.setUint32(padded - 4, (length * 8) >>> 0); view.setUint32(padded - 8, Math.floor(length * 8 / 4294967296));
    let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
    const w = new Uint32Array(64);
    for (let offset = 0; offset < padded; offset += 64) {
      for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i-15],7) ^ rotr(w[i-15],18) ^ (w[i-15] >>> 3);
        const s1 = rotr(w[i-2],17) ^ rotr(w[i-2],19) ^ (w[i-2] >>> 10);
        w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
      }
      let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e,6) ^ rotr(e,11) ^ rotr(e,25), ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
        const S0 = rotr(a,2) ^ rotr(a,13) ^ rotr(a,22), maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) | 0;
        h=g; g=f; f=e; e=(d + t1) | 0; d=c; c=b; b=a; a=(t1 + t2) | 0;
      }
      h0=(h0+a)|0; h1=(h1+b)|0; h2=(h2+c)|0; h3=(h3+d)|0; h4=(h4+e)|0; h5=(h5+f)|0; h6=(h6+g)|0; h7=(h7+h)|0;
    }
    return [h0,h1,h2,h3,h4,h5,h6,h7].map(x => (x >>> 0).toString(16).padStart(8,'0')).join('');
  }
  function randomHex(bytes) {
    const array = new Uint8Array(bytes);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(array);
    else for (let i = 0; i < bytes; i++) array[i] = Math.floor(Math.random() * 256);
    return [...array].map(x => x.toString(16).padStart(2,'0')).join('');
  }
  function randomDigits(count) {
    const array = new Uint32Array(count);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(array);
    else for (let i = 0; i < count; i++) array[i] = Math.floor(Math.random() * 4294967296);
    return [...array].map(x => String(x % 10)).join('');
  }
  function makeSecret(secret) {
    const salt = randomHex(12); let hash = salt + '|' + secret;
    for (let i = 0; i < ITERATIONS; i++) hash = sha256(salt + hash);
    return {salt, hash};
  }
  function checkSecret(secret, record) {
    if (!record || !record.salt || !record.hash) return false;
    let hash = record.salt + '|' + secret;
    for (let i = 0; i < ITERATIONS; i++) hash = sha256(record.salt + hash);
    return hash === record.hash;
  }

  /* ---------- storage ---------- */
  function loadAccess() {
    try {
      const data = JSON.parse(localStorage.getItem(ACCESS_KEY) || 'null');
      if (data && data.admin && data.admin.hash && Array.isArray(data.trainers)) return data;
    } catch { /* treated as first launch */ }
    return null;
  }
  let access = loadAccess();
  /* вход по e-mail (auth.js): при открытии через сайт роли берутся с сервера, локальные PIN не используются */
  const mail = window.__emailAuth;
  const emailMode = () => !!(mail && mail.enabled());
  if (emailMode()) access = {v:1, admin:{}, trainers:[], emailOnly:true};
  function saveAccess() {
    if (access && access.emailOnly) return true;
    try { localStorage.setItem(ACCESS_KEY, JSON.stringify(access)); return true; }
    catch { showToast('Не удалось сохранить пользователей: нет места в памяти браузера'); return false; }
  }
  let session = null;
  function loadSession() {
    if (emailMode()) { const u = mail.user(); return u ? {role:u.role, id:u.email, via:'email'} : null; }
    try {
      const data = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (!data || !access) return null;
      if (data.role === 'admin') return {role:'admin', id:'admin'};
      if (data.role === 'trainer' && access.trainers.some(t => t.id === data.id && t.active !== false)) return {role:'trainer', id:data.id};
    } catch { /* ignore */ }
    return null;
  }
  function setSession(value) {
    session = value;
    if (emailMode()) return;
    try { if (value) localStorage.setItem(SESSION_KEY, JSON.stringify(value)); else localStorage.removeItem(SESSION_KEY); } catch { /* session stays in memory */ }
  }
  function current() {
    if (!session) return null;
    if (session.via === 'email') { const u = mail && mail.user(); return u ? {role:u.role, id:u.email, name:u.name, email:u.email} : null; }
    if (session.role === 'admin') return {role:'admin', id:'admin', name:(access && access.adminName) || 'Администратор'};
    const trainer = access && access.trainers.find(t => t.id === session.id);
    return trainer ? {role:'trainer', id:trainer.id, name:trainer.name} : null;
  }
  const esc = s => escapeHtml(s == null ? '' : s);
  const validPin = pin => /^\d{4,8}$/.test(pin);
  const normAnswer = text => String(text || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, '');
  const validAnswer = text => normAnswer(text).length >= 3;
  /* контрольный вопрос: у администратора хранится в access.question/answer, у тренера — в его записи */
  const qaHolder = user => !user ? null : user.role === 'admin' ? access : access.trainers.find(t => t.id === user.id) || null;
  const hasQA = user => { const h = qaHolder(user); return !!(h && h.question && h.answer); };
  const STANDARD_QUESTIONS = ['Девичья фамилия матери?','Кличка вашего первого домашнего питомца?','Город, в котором вы родились?','Имя вашего лучшего школьного друга?','Ваше любимое блюдо в детстве?'];
  /* выпадающий список: 5 типовых вопросов + «Ваш вопрос»; id — у select, свой вопрос — в поле id + 'Custom' */
  function questionPickerHtml(id, current, optional) {
    const isCustom = !!current && !STANDARD_QUESTIONS.includes(current);
    const opt = (v, l, sel) => `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(l)}</option>`;
    return `<select id="${id}" class="question-select">
        ${optional ? opt('', '— без контрольного вопроса —', !current) : (!current ? opt('', 'Выберите вопрос', true) : '')}
        ${STANDARD_QUESTIONS.map(q => opt(q, q, q === current)).join('')}
        ${opt('__custom', 'Ваш вопрос', isCustom)}
      </select>
      <input id="${id}Custom" class="question-custom" maxlength="80" autocomplete="off" placeholder="Введите ваш вопрос" value="${isCustom ? esc(current) : ''}"${isCustom ? '' : ' hidden'}>`;
  }
  function wireQuestionPicker(root, id) {
    const sel = root.querySelector('#' + id), custom = root.querySelector('#' + id + 'Custom');
    sel.onchange = () => { custom.hidden = sel.value !== '__custom'; if (!custom.hidden) custom.focus(); };
  }
  function pickedQuestion(root, id) {
    const sel = root.querySelector('#' + id);
    return sel.value === '__custom' ? root.querySelector('#' + id + 'Custom').value.trim() : sel.value;
  }
  function setUserPin(user, pin) {
    if (user.role === 'admin') access.admin = makeSecret(pin);
    else { const t = access.trainers.find(x => x.id === user.id); if (t) Object.assign(t, makeSecret(pin)); }
  }
  const ownPinRecord = user => user.role === 'admin' ? access.admin : access.trainers.find(t => t.id === user.id);

  /* ---------- public API used by the app core ---------- */
  window.__access = {
    role: () => current() ? current().role : 'none',
    name: () => current() ? current().name : '',
    canOpen: page => { const user = current(); return !!user && (user.role === 'admin' || !RESTRICTED_FOR_TRAINER.includes(page)); },
    sha256
  };
  window.listTrainers = () => emailMode() ? mail.team().filter(t => t.role === 'trainer').map(t => ({id:t.id, name:t.name})) : access ? access.trainers.filter(t => t.active !== false).map(t => ({id:t.id, name:t.name})) : [];
  window.trainerName = id => { if (emailMode()) { const m = mail.team().find(x => x.id === id); return m ? m.name : ''; } const t = access && access.trainers.find(x => x.id === id); return t ? t.name : ''; };

  /* ---------- role application ---------- */
  function applyRole() {
    const user = current();
    document.body.classList.toggle('locked', !user);
    document.body.classList.toggle('role-trainer', !!user && user.role === 'trainer');
    document.body.classList.toggle('role-admin', !!user && user.role === 'admin');
    const greeting = document.querySelector('.app-header h1');
    if (greeting) greeting.textContent = user ? `Добро пожаловать, ${user.name}!` : 'Добро пожаловать!';
    document.querySelectorAll('.tabbtn').forEach(button => {
      button.hidden = !!user && user.role === 'trainer' && RESTRICTED_FOR_TRAINER.includes(button.dataset.tab);
    });
    if (!user) return;
    const active = document.querySelector('.page.active');
    const activeName = active ? active.id.replace(/^page-/, '') : 'dashboard';
    if (!window.__access.canOpen(activeName)) showPage('dashboard');
    else refreshViews();
    if (document.getElementById('page-settings').classList.contains('active')) renderSettings();
  }
  function guard(name) {
    const original = window[name];
    if (typeof original !== 'function') return;
    window[name] = function (...args) {
      if (!isAdmin()) { showToast('Доступно только администратору'); return undefined; }
      return original.apply(this, args);
    };
  }
  ADMIN_ONLY_FUNCTIONS.forEach(guard);

  /* ---------- login screen ---------- */
  const screen = document.createElement('div');
  screen.id = 'loginScreen'; screen.className = 'login-screen';
  screen.setAttribute('role', 'dialog'); screen.setAttribute('aria-modal', 'true'); screen.setAttribute('aria-label', 'Вход');
  document.body.append(screen);
  let failures = 0, lockedUntil = 0, selectedUser = null;

  const logoImg = () => `<img class="login-logo" alt="" src="${typeof window.appLogoSrc === 'function' ? window.appLogoSrc() : 'icons/logo.png'}">`;
  function showLogin(mode, extra) {
    screen.hidden = false;
    document.body.classList.add('locked');
    if (emailMode() || mode === 'email') return showEmailLogin(extra || {});
    if (mode === 'setup') {
      screen.innerHTML = `<form class="login-card" id="loginForm" autocomplete="off">
        ${logoImg()}<h2>Первый запуск</h2>
        <p class="field-hint">Задайте PIN администратора (4–8 цифр). Администратор видит и редактирует всё: клиентов, абонементы, тарифы, направления, аренду, доход, пользователей и резервные копии.</p>
        <label for="loginName">Ваше имя (по желанию)</label>
        <input id="loginName" maxlength="40" autocomplete="off" placeholder="Например: Айдана" enterkeyhint="next">
        <label for="loginPin">PIN</label>
        <input id="loginPin" type="password" inputmode="numeric" maxlength="8" autocomplete="off" enterkeyhint="next">
        <label for="loginPin2">Повторите PIN</label>
        <input id="loginPin2" type="password" inputmode="numeric" maxlength="8" autocomplete="off" enterkeyhint="next">
        <label for="loginQuestion">Контрольный вопрос (по желанию)</label>
        ${questionPickerHtml('loginQuestion', '', true)}
        <label for="loginAnswer">Ответ на вопрос</label>
        <input id="loginAnswer" maxlength="60" autocomplete="off" enterkeyhint="done">
        <div class="field-hint">С помощью вопроса можно будет сменить PIN, если вы его забудете. Регистр и пробелы в ответе не важны.</div>
        <div class="login-error" id="loginError" role="alert"></div>
        <button class="btn" type="submit">Создать</button>
      </form>`;
      wireQuestionPicker(screen, 'loginQuestion');
      screen.querySelector('#loginForm').onsubmit = event => {
        event.preventDefault();
        const pin = screen.querySelector('#loginPin').value, again = screen.querySelector('#loginPin2').value;
        if (!validPin(pin)) return loginError('PIN: от 4 до 8 цифр');
        if (pin !== again) return loginError('PIN не совпадают');
        const question = pickedQuestion(screen, 'loginQuestion'), answer = screen.querySelector('#loginAnswer').value;
        if (question || answer) {
          if (!question) return loginError(screen.querySelector('#loginQuestion').value === '__custom' ? 'Введите ваш вопрос' : 'Выберите контрольный вопрос или очистите ответ');
          if (!validAnswer(answer)) return loginError('Ответ: не короче 3 символов');
        }
        const code = randomDigits(8);
        access = {v:1, admin:makeSecret(pin), recovery:makeSecret(code), trainers:[]};
        const adminName = screen.querySelector('#loginName').value.trim();
        if (adminName) access.adminName = adminName;
        if (question) { access.question = question; access.answer = makeSecret(normAnswer(answer)); }
        if (!saveAccess()) { access = null; return; }
        showLogin('code', {code, then:'admin'});
      };
    } else if (mode === 'code') {
      const code = extra.code.replace(/(\d{4})(\d{4})/, '$1-$2');
      screen.innerHTML = `<div class="login-card">
        <h2>Код восстановления</h2>
        <p class="field-hint">Если забудете PIN администратора, этот код позволит задать новый. Запишите его и храните отдельно от планшета. Он показывается один раз.</p>
        <div class="recovery-code" id="recoveryCode">${code}</div>
        <button class="btn" id="loginContinue">Я записал(а) код — продолжить</button>
      </div>`;
      screen.querySelector('#loginContinue').onclick = () => { if (extra.then === 'admin') enter({role:'admin', id:'admin'}); else showLogin('choose'); };
    } else if (mode === 'recover') {
      const isAdminUser = selectedUser.role === 'admin';
      const holder = qaHolder(selectedUser);
      const hasQuestion = hasQA(selectedUser);
      if (!isAdminUser && !hasQuestion) {
        screen.innerHTML = `<div class="login-card">
          <h2>Восстановление PIN</h2>
          <p class="field-hint">Контрольный вопрос не задан. Обратитесь к администратору: он задаст вам новый PIN в Настройки → Пользователи и роли.</p>
          <button class="btn secondary" type="button" id="loginBack">Назад</button>
        </div>`;
        screen.querySelector('#loginBack').onclick = () => showLogin('pin');
        return;
      }
      const byQuestion = hasQuestion && !(isAdminUser && extra && extra.method === 'code');
      screen.innerHTML = `<form class="login-card" id="loginForm" autocomplete="off">
        <h2>Восстановление PIN</h2>
        <p class="field-hint">${isAdminUser ? 'Администратор' : esc(selectedUser.name)}</p>
        ${byQuestion
          ? `<label for="loginAnswer">${esc(holder.question)}</label>
        <input id="loginAnswer" maxlength="60" autocomplete="off" placeholder="Ответ на контрольный вопрос">`
          : `<label for="loginCode">Код восстановления</label>
        <input id="loginCode" inputmode="numeric" maxlength="9" autocomplete="off" placeholder="0000-0000">`}
        <label for="loginPin">Новый PIN</label>
        <input id="loginPin" type="password" inputmode="numeric" maxlength="8" autocomplete="off">
        <label for="loginPin2">Повторите новый PIN</label>
        <input id="loginPin2" type="password" inputmode="numeric" maxlength="8" autocomplete="off">
        <div class="login-error" id="loginError" role="alert"></div>
        <button class="btn" type="submit">Сменить PIN</button>
        ${isAdminUser && hasQuestion ? `<button class="login-link" type="button" id="loginSwitch">${byQuestion ? 'Восстановить по коду' : 'Восстановить по контрольному вопросу'}</button>` : ''}
        <button class="btn secondary" type="button" id="loginBack" style="margin-top:8px">Назад</button>
      </form>`;
      screen.querySelector('#loginBack').onclick = () => showLogin('pin');
      const switcher = screen.querySelector('#loginSwitch');
      if (switcher) switcher.onclick = () => showLogin('recover', {method: byQuestion ? 'code' : 'question'});
      screen.querySelector('#loginForm').onsubmit = event => {
        event.preventDefault();
        if (throttled()) return;
        const pin = screen.querySelector('#loginPin').value, again = screen.querySelector('#loginPin2').value;
        if (!validPin(pin)) return loginError('PIN: от 4 до 8 цифр');
        if (pin !== again) return loginError('PIN не совпадают');
        if (byQuestion) {
          if (!checkSecret(normAnswer(screen.querySelector('#loginAnswer').value), holder.answer)) return failed('Неверный ответ');
          setUserPin(selectedUser, pin);
          if (!saveAccess()) return;
          failures = 0; enter({role:selectedUser.role, id:selectedUser.id}); showToast('PIN изменён');
          return;
        }
        const code = screen.querySelector('#loginCode').value.replace(/\D/g, '');
        if (!checkSecret(code, access.recovery)) return failed('Неверный код восстановления');
        const fresh = randomDigits(8);
        access.admin = makeSecret(pin); access.recovery = makeSecret(fresh);
        if (!saveAccess()) return;
        failures = 0; showLogin('code', {code:fresh, then:'admin'});
      };
    } else if (mode === 'pin') {
      const label = selectedUser.role === 'admin' ? (access.adminName ? 'Администратор · ' + access.adminName : 'Администратор') : selectedUser.name;
      screen.innerHTML = `<form class="login-card" id="loginForm" autocomplete="off">
        <h2>${esc(label)}</h2>
        <label for="loginPin">PIN</label>
        <input id="loginPin" type="password" inputmode="numeric" maxlength="8" autocomplete="off" enterkeyhint="done">
        <div class="login-error" id="loginError" role="alert"></div>
        <button class="btn" type="submit">Войти</button>
        <button class="btn secondary" type="button" id="loginBack" style="margin-top:8px">Назад</button>
        <button class="login-link" type="button" id="loginForgot">Забыли PIN?</button>
      </form>`;
      screen.querySelector('#loginBack').onclick = () => showLogin('choose');
      const forgot = screen.querySelector('#loginForgot'); if (forgot) forgot.onclick = () => showLogin('recover');
      screen.querySelector('#loginForm').onsubmit = event => {
        event.preventDefault();
        if (throttled()) return;
        const pin = screen.querySelector('#loginPin').value;
        const record = selectedUser.role === 'admin' ? access.admin : access.trainers.find(t => t.id === selectedUser.id);
        if (record && validPin(pin) && checkSecret(pin, record)) { failures = 0; enter({role:selectedUser.role, id:selectedUser.id}); }
        else failed('Неверный PIN');
      };
      setTimeout(() => screen.querySelector('#loginPin')?.focus(), 0);
    } else {
      const trainers = access.trainers.filter(t => t.active !== false);
      screen.innerHTML = `<div class="login-card">
        ${logoImg()}<h2>Йога-практика</h2>
        <p class="field-hint">Выберите, кто работает с приложением.</p>
        <button class="btn" type="button" data-user="admin">Администратор${access.adminName ? ' · ' + esc(access.adminName) : ''}</button>
        ${trainers.map(t => `<button class="btn secondary" type="button" style="margin-top:8px" data-user="${esc(t.id)}">Тренер · ${esc(t.name)}</button>`).join('')}
      </div>`;
      screen.querySelectorAll('[data-user]').forEach(button => button.onclick = () => {
        const id = button.dataset.user;
        selectedUser = id === 'admin' ? {role:'admin', id:'admin'} : {role:'trainer', id, name:(access.trainers.find(t => t.id === id) || {}).name};
        showLogin('pin');
      });
    }
  }
  function showEmailLogin(extra) {
    screen.hidden = false; document.body.classList.add('locked');
    const step = extra.step === 'code' ? 'code' : 'email';
    const email = extra.email || '';
    screen.innerHTML = `<form class="login-card" id="loginForm" autocomplete="on" novalidate>
      ${logoImg()}<h2>Вход по e-mail</h2>
      ${step === 'email'
        ? `<p class="field-hint">${esc(extra.notice || 'Введите адрес электронной почты, который выдал администратор. Мы отправим на него код для входа.')}</p>
      <label for="loginEmail">Электронная почта</label>
      <input id="loginEmail" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" maxlength="120" enterkeyhint="send" value="${esc(email)}" placeholder="name@example.com">`
        : `<p class="field-hint">Код отправлен на ${esc(email)}. Введите его из письма (проверьте и папку «Спам»).</p>
      <label for="loginCode">Код из письма</label>
      <input id="loginCode" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="10" enterkeyhint="done" placeholder="123456">`}
      <div class="login-error" id="loginError" role="alert"></div>
      <button class="btn" type="submit" id="loginSubmit">${step === 'email' ? 'Получить код' : 'Войти'}</button>
      ${step === 'code' ? '<button class="login-link" type="button" id="loginResend">Отправить код ещё раз</button><button class="btn secondary" type="button" id="loginBack" style="margin-top:8px">Изменить адрес</button>' : ''}
    </form>`;
    const form = screen.querySelector('#loginForm'), submit = screen.querySelector('#loginSubmit');
    const busy = on => { submit.disabled = on; submit.textContent = on ? 'Подождите…' : (step === 'email' ? 'Получить код' : 'Войти'); };
    const send = async address => {
      busy(true);
      try { await mail.requestCode(address); showEmailLogin({step:'code', email:address.trim().toLowerCase()}); }
      catch (error) { busy(false); loginError(error.message); }
    };
    if (step === 'code') {
      screen.querySelector('#loginBack').onclick = () => showEmailLogin({step:'email', email});
      screen.querySelector('#loginResend').onclick = () => { if (!throttled()) send(email); };
    }
    form.onsubmit = async event => {
      event.preventDefault();
      if (step === 'email') { send(screen.querySelector('#loginEmail').value); return; }
      if (throttled()) return;
      busy(true);
      try {
        const user = await mail.verify(email, screen.querySelector('#loginCode').value);
        failures = 0; enter({role:user.role, id:user.email, via:'email'}); afterEmailLogin();
      } catch (error) { busy(false); if (error.offline || error.status >= 500) loginError(error.message); else failed(error.message); }
    };
    setTimeout(() => (screen.querySelector('#loginEmail') || screen.querySelector('#loginCode'))?.focus(), 0);
  }
  /* сверка роли с сервером при запуске и при появлении сети */
  function afterEmailLogin() {
    if (!emailMode()) return;
    mail.revalidate().then(result => {
      if (!session) return;
      if (result && result.revoked) { setSession(null); applyRole(); showEmailLogin({notice:'Доступ для этого адреса закрыт или сеанс истёк. Войдите снова.'}); }
      else if (result && result.changed) { const u = mail.user(); if (u) { session = {role:u.role, id:u.email, via:'email'}; applyRole(); } }
      else if (result && !result.ok) { setSession(null); applyRole(); showEmailLogin({notice:'Нужна проверка доступа через интернет. Подключитесь к сети и войдите снова.'}); }
    });
  }
  window.__emailAuthOnline = afterEmailLogin;
  function loginError(message) { const box = screen.querySelector('#loginError'); if (box) box.textContent = message; return false; }
  function throttled() {
    if (Date.now() < lockedUntil) { loginError('Слишком много попыток. Подождите ' + Math.ceil((lockedUntil - Date.now()) / 1000) + ' с.'); return true; }
    return false;
  }
  function failed(message) {
    failures++;
    if (failures >= MAX_TRIES) { failures = 0; lockedUntil = Date.now() + LOCK_MS; loginError(message + '. Повторите через 30 секунд.'); }
    else loginError(message + ' (попыток осталось: ' + (MAX_TRIES - failures) + ')');
  }
  function enter(value) {
    setSession(value);
    screen.hidden = true; screen.innerHTML = '';
    applyRole();
    showPage('dashboard');
  }
  function logout() {
    if (emailMode()) { mail.signOut(); setSession(null); applyRole(); showLogin('email'); return; }
    setSession(null); applyRole(); showLogin('choose');
  }

  /* ---------- settings: current user and user management (admin) ---------- */
  window.renderAccessSettings = function () {
    const user = current(); if (!user) return;
    const userCard = document.getElementById('settingsUserCard');
    userCard.innerHTML = `<div class="kv"><span class="k">Вы вошли как</span><strong>${esc(user.name)}</strong></div>
      <div class="kv"><span class="k">Роль</span><span>${user.role === 'admin' ? 'Администратор' : 'Тренер'}</span></div>
      <div class="kv"><span class="k">Контрольный вопрос</span><span>${hasQA(user) ? esc(qaHolder(user).question) : 'не задан'}</span></div>
      <div class="btn-row" style="margin-top:12px"><button class="btn secondary small" style="flex:1" id="settingsOwnPin">Сменить PIN</button>
        <button class="btn secondary small" style="flex:1" id="settingsOwnQuestion">${hasQA(user) ? 'Изменить вопрос' : 'Задать вопрос'}</button></div>
      <div class="field-hint">${hasQA(user) ? 'Если забудете PIN, на экране входа нажмите «Забыли PIN?» и ответьте на вопрос.' : 'Задайте контрольный вопрос, чтобы при необходимости самостоятельно восстановить PIN.'}</div>
      ${user.role === 'admin' ? '<button class="btn secondary" style="margin-top:12px" id="settingsOwnName">' + (access.adminName ? 'Изменить имя' : 'Указать имя') + '</button>' : ''}
      <button class="btn secondary" style="margin-top:12px" id="settingsLogout">Сменить пользователя</button>`;
    const nameBtn = userCard.querySelector('#settingsOwnName'); if (nameBtn) nameBtn.onclick = openAdminNameSheet;
    userCard.querySelector('#settingsLogout').onclick = logout;
    userCard.querySelector('#settingsOwnPin').onclick = openOwnPinSheet;
    userCard.querySelector('#settingsOwnQuestion').onclick = openQuestionSheet;
    const box = document.getElementById('settingsUsersCard');
    if (user.role !== 'admin') { box.innerHTML = ''; return; }
    box.innerHTML = `<div class="user-row"><div class="main"><div class="title">Администратор</div><div class="sub">полный доступ</div></div>
        <button class="btn secondary small" data-act="admin-pin">Сменить PIN</button></div>
      ${access.trainers.map(t => `<div class="user-row"><div class="main"><div class="title">${esc(t.name)}</div><div class="sub">тренер${t.active === false ? ' · отключён' : ''}${t.question ? ' · есть контрольный вопрос' : ''}</div></div>
        <button class="btn secondary small" data-act="trainer" data-id="${esc(t.id)}">Изменить</button></div>`).join('')}
      <div class="btn-row"><button class="btn small" style="flex:1" data-act="trainer-new">Добавить тренера</button>
        <button class="btn secondary small" style="flex:1" data-act="new-code">Новый код восстановления</button></div>
      <div class="field-hint">Тренеры работают в разделах «Клиенты», «Визиты» и «Классы»: отмечают посещения, меняют даты посещений и оформляют переносы. Тарифы, абонементы, доход, аренда и настройки — только у администратора.</div>`;
    box.querySelectorAll('[data-act]').forEach(button => button.onclick = () => {
      const act = button.dataset.act;
      if (act === 'admin-pin') openOwnPinSheet();
      else if (act === 'new-code') openNewCodeSheet();
      else openTrainerSheet(act === 'trainer' ? button.dataset.id : '');
    });
  };
  function openOwnPinSheet() {
    const user = current(); if (!user) return;
    openSheet(`<div class="sheet-head"><h3>Смена PIN</h3><div class="sheet-close" onclick="closeSheet()">✕</div></div>
      <label for="fAdminOld">Текущий PIN</label><input id="fAdminOld" type="password" inputmode="numeric" maxlength="8" autocomplete="off">
      <label for="fAdminNew">Новый PIN (4–8 цифр)</label><input id="fAdminNew" type="password" inputmode="numeric" maxlength="8" autocomplete="off">
      <label for="fAdminNew2">Повторите новый PIN</label><input id="fAdminNew2" type="password" inputmode="numeric" maxlength="8" autocomplete="off">
      <button class="btn" id="fAdminSave">Сохранить</button>`);
    document.getElementById('fAdminSave').onclick = () => {
      const old = fieldValue('fAdminOld'), pin = fieldValue('fAdminNew'), again = fieldValue('fAdminNew2');
      if (!checkSecret(old, ownPinRecord(user))) return showToast('Текущий PIN неверный');
      if (!validPin(pin)) return showToast('PIN: от 4 до 8 цифр');
      if (pin !== again) return showToast('PIN не совпадают');
      setUserPin(user, pin);
      if (saveAccess()) { closeSheet(); showToast('PIN изменён'); }
    };
  }
  function openAdminNameSheet() {
    if (!current() || current().role !== 'admin') return;
    openSheet(`<div class="sheet-head"><h3>Имя администратора</h3><div class="sheet-close" onclick="closeSheet()">✕</div></div>
      <div class="field-hint">Имя показывается в приветствии и в отметках посещений. Оставьте пустым, чтобы вернуть «Администратор».</div>
      <label for="fAdminName">Имя</label><input id="fAdminName" maxlength="40" autocomplete="off" value="${esc(access.adminName || '')}" placeholder="Например: Айдана">
      <button class="btn" id="fAdminNameSave">Сохранить</button>`);
    document.getElementById('fAdminNameSave').onclick = () => {
      const name = fieldValue('fAdminName').trim();
      if (name) access.adminName = name; else delete access.adminName;
      if (saveAccess()) { closeSheet(); applyRole(); renderAccessSettings(); showToast('Имя сохранено'); }
    };
  }
  function openQuestionSheet() {
    const user = current(); if (!user) return;
    const holder = qaHolder(user);
    openSheet(`<div class="sheet-head"><h3>Контрольный вопрос</h3><div class="sheet-close" onclick="closeSheet()">✕</div></div>
      <div class="field-hint">Позволяет сменить свой PIN на экране входа («Забыли PIN?»). Регистр и пробелы в ответе не важны. Выбирайте ответ, который знаете только вы.</div>
      <label for="fQuestion">Вопрос</label>${questionPickerHtml('fQuestion', holder.question || '', false)}
      <label for="fAnswer">Ответ</label><input id="fAnswer" maxlength="60" autocomplete="off">
      <label for="fQuestionPin">Ваш PIN</label><input id="fQuestionPin" type="password" inputmode="numeric" maxlength="8" autocomplete="off">
      <button class="btn" id="fQuestionSave">Сохранить</button>
      ${holder.question ? '<button class="btn secondary" id="fQuestionClear" style="margin-top:8px">Удалить контрольный вопрос</button>' : ''}`);
    wireQuestionPicker(document, 'fQuestion');
    const verify = () => { if (checkSecret(fieldValue('fQuestionPin'), ownPinRecord(user))) return true; showToast('PIN неверный'); return false; };
    document.getElementById('fQuestionSave').onclick = () => {
      const question = pickedQuestion(document, 'fQuestion'), answer = fieldValue('fAnswer');
      if (!question) return showToast(fieldValue('fQuestion') === '__custom' ? 'Введите ваш вопрос' : 'Выберите вопрос');
      if (!validAnswer(answer)) return showToast('Ответ: не короче 3 символов');
      if (!verify()) return;
      holder.question = question; holder.answer = makeSecret(normAnswer(answer));
      if (saveAccess()) { closeSheet(); renderAccessSettings(); showToast('Контрольный вопрос сохранён'); }
    };
    const clear = document.getElementById('fQuestionClear');
    if (clear) clear.onclick = () => {
      if (!verify()) return;
      delete holder.question; delete holder.answer;
      if (saveAccess()) { closeSheet(); renderAccessSettings(); showToast('Контрольный вопрос удалён'); }
    };
  }
  function openNewCodeSheet() {
    openSheet(`<div class="sheet-head"><h3>Новый код восстановления</h3><div class="sheet-close" onclick="closeSheet()">✕</div></div>
      <div class="field-hint">Прежний код перестанет действовать.</div>
      <label for="fCodePin">PIN администратора</label><input id="fCodePin" type="password" inputmode="numeric" maxlength="8" autocomplete="off">
      <button class="btn" id="fCodeCreate">Создать код</button>`);
    document.getElementById('fCodeCreate').onclick = () => {
      if (!checkSecret(fieldValue('fCodePin'), access.admin)) return showToast('PIN неверный');
      const code = randomDigits(8); access.recovery = makeSecret(code);
      if (!saveAccess()) return;
      document.getElementById('sheetContent').innerHTML = `<div class="sheet-head"><h3>Код восстановления</h3><div class="sheet-close" onclick="closeSheet()">✕</div></div>
        <p class="field-hint">Запишите код. Он показывается один раз.</p><div class="recovery-code">${code.replace(/(\d{4})(\d{4})/, '$1-$2')}</div>
        <button class="btn" onclick="closeSheet()">Готово</button>`;
    };
  }
  function openTrainerSheet(id) {
    const trainer = id ? access.trainers.find(t => t.id === id) : null;
    openSheet(`<div class="sheet-head"><h3>${trainer ? 'Изменить тренера' : 'Новый тренер'}</h3><div class="sheet-close" onclick="closeSheet()">✕</div></div>
      <label for="fTrainerName">Имя</label><input id="fTrainerName" value="${trainer ? esc(trainer.name) : ''}" placeholder="Имя Фамилия">
      <label for="fTrainerPin">${trainer ? 'Новый PIN (оставьте пустым, чтобы не менять)' : 'PIN (4–8 цифр)'}</label>
      <input id="fTrainerPin" type="password" inputmode="numeric" maxlength="8" autocomplete="off">
      <label class="check-row" style="margin-top:12px"><input id="fTrainerActive" type="checkbox" ${!trainer || trainer.active !== false ? 'checked' : ''}> Может входить в приложение</label>
      <button class="btn" id="fTrainerSave">Сохранить</button>
      ${trainer ? '<button class="btn danger" style="margin-top:8px" id="fTrainerDelete">Удалить тренера</button>' : ''}`);
    document.getElementById('fTrainerSave').onclick = () => {
      const name = fieldValue('fTrainerName').trim(), pin = fieldValue('fTrainerPin');
      if (!name) return showToast('Введите имя тренера');
      if (access.trainers.some(t => t.id !== id && t.name.trim().toLowerCase() === name.toLowerCase())) return showToast('Тренер с таким именем уже есть');
      if (!trainer && !validPin(pin)) return showToast('PIN: от 4 до 8 цифр');
      if (trainer && pin && !validPin(pin)) return showToast('PIN: от 4 до 8 цифр');
      const active = document.getElementById('fTrainerActive').checked;
      if (trainer) { trainer.name = name; trainer.active = active; if (pin) Object.assign(trainer, makeSecret(pin)); }
      else access.trainers.push({id:uid(), name, active, ...makeSecret(pin)});
      if (saveAccess()) { closeSheet(); renderAccessSettings(); showToast('Тренер сохранён'); }
    };
    const remove = document.getElementById('fTrainerDelete');
    if (remove) remove.onclick = () => {
      if (!confirm('Удалить тренера «' + trainer.name + '»? В направлениях он будет снят.')) return;
      access.trainers = access.trainers.filter(t => t.id !== id);
      (state.classes || []).forEach(c => { c.trainerIds = (c.trainerIds || []).filter(x => x !== id); });
      saveState();
      if (saveAccess()) { closeSheet(); renderAccessSettings(); showToast('Тренер удалён'); }
    };
  }

  /* ---------- logout button (в шапке, слева от кнопки установки) ---------- */
  const logoutBtn = document.createElement('button');
  logoutBtn.type = 'button'; logoutBtn.className = 'logout-btn'; logoutBtn.id = 'logoutBtn';
  logoutBtn.setAttribute('aria-label', 'Выход');
  logoutBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 4H6a2 2 0 00-2 2v12a2 2 0 002 2h4"/><path d="M15 8l4 4-4 4M19 12H9"/></svg><span>Выход</span>';
  logoutBtn.addEventListener('click', logout);
  const hdr = document.querySelector('.app-header');
  if (hdr) hdr.append(logoutBtn);

  /* ---------- версия и разработчик на каждой вкладке ---------- */
  const footer = document.querySelector('.app-footer');
  function placeFooter() {
    const label = document.getElementById('appVersionLabel');
    if (label && typeof APP_VERSION === 'string') label.textContent = 'Версия: ' + APP_VERSION;
    const active = document.querySelector('.page.active');
    if (footer && active && footer.parentNode !== active) active.append(footer);
  }
  /* ---------- настройки: вход по e-mail ---------- */
  const renderLocalSettings = window.renderAccessSettings;
  window.renderAccessSettings = function () {
    if (emailMode()) return renderEmailSettings();
    renderLocalSettings();
    renderAuthConfigCard();
  };
  function renderEmailSettings() {
    const user = current(); if (!user) return;
    const userCard = document.getElementById('settingsUserCard');
    userCard.innerHTML = `<div class="kv"><span class="k">Вы вошли как</span><strong>${esc(user.name)}</strong></div>
      <div class="kv"><span class="k">E-mail</span><span>${esc(user.email)}</span></div>
      <div class="kv"><span class="k">Роль</span><span>${esc(mail.roleName(user.role))}</span></div>
      <div class="field-hint">Вход выполняется по коду из письма. Сеанс сохраняется на устройстве; без интернета приложение работает до 7 дней, затем нужна проверка доступа.</div>
      <button class="btn secondary" style="margin-top:12px" id="settingsLogout">Выйти</button>`;
    userCard.querySelector('#settingsLogout').onclick = logout;
    const box = document.getElementById('settingsUsersCard');
    if (user.role !== 'admin') { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="field-hint">Загрузка списка…</div>';
    mail.list().then(rows => drawEmailTeam(box, rows, user)).catch(error => {
      box.innerHTML = `<div class="field-hint">Не удалось получить список: ${esc(error.message)}</div><div class="btn-row"><button class="btn secondary small" id="teamRetry">Повторить</button></div>`;
      box.querySelector('#teamRetry').onclick = renderEmailSettings;
    });
  }
  function drawEmailTeam(box, rows, user) {
    box.innerHTML = `${rows.map(r => `<div class="user-row"><div class="main"><div class="title">${esc(r.display_name || r.email)}</div><div class="sub">${esc(r.email)} · ${esc(mail.roleName(r.role))}${r.active === false ? ' · отключён' : ''}</div></div>
        <button class="btn secondary small" data-mail="${esc(r.email)}">Изменить</button></div>`).join('')}
      <div class="btn-row"><button class="btn small" style="flex:1" id="teamAdd">Добавить адрес</button></div>
      <div class="field-hint">Войти могут только адреса из этого списка. Тренеры работают в разделах «Клиенты», «Визиты» и «Классы»; тарифы, абонементы, доход, аренда и настройки — только у администратора. Отключение закрывает доступ при ближайшей проверке с интернетом; данные на устройстве тренера при этом не удаляются.</div>`;
    box.querySelector('#teamAdd').onclick = () => openMailSheet(null, rows, user);
    box.querySelectorAll('[data-mail]').forEach(button => button.onclick = () => openMailSheet(rows.find(r => r.email === button.dataset.mail), rows, user));
  }
  function openMailSheet(row, rows, user) {
    openSheet(`<div class="sheet-head"><h3>${row ? 'Изменить доступ' : 'Новый адрес'}</h3><div class="sheet-close" onclick="closeSheet()">✕</div></div>
      <label for="fMail">Электронная почта</label><input id="fMail" type="email" inputmode="email" autocapitalize="off" spellcheck="false" maxlength="120" value="${row ? esc(row.email) : ''}" ${row ? 'readonly' : ''} placeholder="name@example.com">
      <label for="fMailName">Имя</label><input id="fMailName" maxlength="60" value="${row ? esc(row.display_name || '') : ''}" placeholder="Имя Фамилия">
      <label for="fMailRole">Роль</label><select id="fMailRole"><option value="trainer"${row && row.role === 'admin' ? '' : ' selected'}>Тренер</option><option value="admin"${row && row.role === 'admin' ? ' selected' : ''}>Администратор</option></select>
      <label class="check-row" style="margin-top:12px"><input id="fMailActive" type="checkbox" ${!row || row.active !== false ? 'checked' : ''}> Может входить в приложение</label>
      <button class="btn" id="fMailSave">Сохранить</button>
      ${row ? '<button class="btn danger" style="margin-top:8px" id="fMailDelete">Удалить адрес</button>' : ''}`);
    const self = row && row.email === user.email;
    document.getElementById('fMailSave').onclick = async () => {
      const entry = {email:fieldValue('fMail'), name:fieldValue('fMailName'), role:fieldValue('fMailRole'), active:document.getElementById('fMailActive').checked};
      if (self && (entry.role !== 'admin' || !entry.active)) return showToast('Нельзя снять доступ у самого себя');
      if (!row && rows.some(r => r.email === entry.email.trim().toLowerCase())) return showToast('Этот адрес уже есть в списке');
      try { await mail.save(entry); closeSheet(); renderEmailSettings(); showToast('Сохранено'); }
      catch (error) { showToast(error.message); }
    };
    const remove = document.getElementById('fMailDelete');
    if (remove) remove.onclick = async () => {
      if (self) return showToast('Нельзя удалить самого себя');
      if (!confirm('Удалить адрес «' + row.email + '»? Он больше не сможет войти.')) return;
      try { await mail.remove(row.email); closeSheet(); renderEmailSettings(); showToast('Адрес удалён'); }
      catch (error) { showToast(error.message); }
    };
  }
  /* подключение к Supabase из приложения (если адрес и ключ не заданы в auth-config.js) */
  function renderAuthConfigCard() {
    const user = current(); const box = document.getElementById('settingsUsersCard');
    if (!mail || !user || user.role !== 'admin' || !box) return;
    const cfg = mail.config();
    const wrap = document.createElement('div');
    wrap.className = 'email-config';
    wrap.innerHTML = `<div class="section-title" style="margin-top:18px"><h2 style="font-size:14px">Вход по e-mail</h2></div>
      <div class="field-hint" style="margin:0 0 8px">${mail.configured() ? (mail.siteMode() ? 'Подключено. Вход по e-mail включится при следующем открытии.' : 'Подключено. Вход по e-mail работает при открытии через сайт (https).') : 'Не подключено: работает вход по PIN. Для входа по e-mail укажите проект Supabase (см. docs/EMAIL-AUTH.md).'}</div>
      <label for="fAuthUrl">Адрес проекта</label><input id="fAuthUrl" type="url" inputmode="url" autocapitalize="off" spellcheck="false" placeholder="https://xxxx.supabase.co" value="${esc(cfg.url)}">
      <label for="fAuthKey">Публичный ключ (anon)</label><input id="fAuthKey" autocapitalize="off" spellcheck="false" value="${esc(cfg.anonKey)}">
      <div class="btn-row"><button class="btn secondary small" style="flex:1" id="fAuthSave">Сохранить</button><button class="btn secondary small" style="flex:1" id="fAuthClear">Отключить</button></div>`;
    box.append(wrap);
    wrap.querySelector('#fAuthSave').onclick = () => { try { mail.setConfig(fieldValue('fAuthUrl'), fieldValue('fAuthKey')); showToast('Сохранено'); renderAccessSettings(); } catch (error) { showToast(error.message); } };
    wrap.querySelector('#fAuthClear').onclick = () => { mail.setConfig('', ''); showToast('Отключено'); renderAccessSettings(); };
  }

  const showPageBeforeFooter = window.showPage;
  window.showPage = showPage = function (...args) { const result = showPageBeforeFooter.apply(this, args); placeFooter(); return result; };
  placeFooter();

  /* ---------- start ---------- */
  session = loadSession();
  if (emailMode()) { if (!session) showEmailLogin({}); else { screen.hidden = true; applyRole(); afterEmailLogin(); } }
  else if (!access) showLogin('setup');
  else if (!session) showLogin('choose');
  else { screen.hidden = true; applyRole(); }
})();
