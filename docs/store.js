/* Йога-студия yoga_matkz — ядро данных (порт StudioStore.swift нативного приложения).
   Работает в браузере и в Node (для тестов). Даты — ключи «ГГГГ-ММ-ДД» в местном времени. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Studio = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const APP_VERSION = '1.8.2';

  /* ---------- Даты и форматирование (RU) ---------- */
  const pad = (n, w) => String(n).padStart(w || 2, '0');
  const RU = {
    weekdayShort: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    weekdayLong: ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'],
    months: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
    monthsShort: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
    monthsGen: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
    key(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); },
    date(key) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key || '');
      if (!m) return null;
      const d = new Date(+m[1], +m[2] - 1, +m[3]);
      return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
    },
    isValidDay(key) { return !!RU.date(key); },
    addDays(days, key) {
      const d = RU.date(key); if (!d) return key;
      d.setDate(d.getDate() + days); return RU.key(d);
    },
    addDaysToDate(d, days) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + days); return x; },
    daysBetween(a, b) {
      const x = RU.date(a), y = RU.date(b); if (!x || !y) return 0;
      return Math.round((Date.UTC(y.getFullYear(), y.getMonth(), y.getDate()) - Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())) / 86400000);
    },
    /** 1 — понедельник … 7 — воскресенье */
    weekdayIndex(d) { return ((d.getDay() + 6) % 7) + 1; },
    startOfWeek(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return RU.addDaysToDate(x, -(RU.weekdayIndex(x) - 1)); },
    longDay(key) { const d = RU.date(key); return d ? d.getDate() + ' ' + RU.monthsGen[d.getMonth()] : key; },
    shortDate(key) { const d = RU.date(key); return d ? pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() : key; },
    weekdayTitle(d) { return RU.weekdayLong[RU.weekdayIndex(d) - 1] + ', ' + d.getDate() + ' ' + RU.monthsGen[d.getMonth()]; },
    dayTitle(key, today) {
      today = today || RU.key(new Date());
      if (key === today) return 'Сегодня';
      if (key === RU.addDays(-1, today)) return 'Вчера';
      return RU.longDay(key);
    },
    time(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); },
    classTime(min) { return pad(Math.floor(min / 60)) + ':' + pad(min % 60); },
    minutesOf(d) { return d.getHours() * 60 + d.getMinutes(); },
    monthKey(y, m) { return pad(y, 4) + '-' + pad(m); },
    monthTitle(d) { return RU.months[d.getMonth()] + ' ' + d.getFullYear(); },
    addMonths(n, y, m) { const t = y * 12 + (m - 1) + n; return { year: Math.floor(t / 12), month: t % 12 + 1 }; },
    weekRange(start) {
      const end = RU.addDaysToDate(start, 6);
      const a = RU.monthsGen[start.getMonth()], b = RU.monthsGen[end.getMonth()];
      return a === b ? start.getDate() + '–' + end.getDate() + ' ' + b : start.getDate() + ' ' + a + ' – ' + end.getDate() + ' ' + b;
    },
    monthGrid(d) {
      const first = new Date(d.getFullYear(), d.getMonth(), 1);
      const lead = RU.weekdayIndex(first) - 1;
      const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const cells = Array(lead).fill(null);
      for (let i = 0; i < days; i++) cells.push(new Date(d.getFullYear(), d.getMonth(), i + 1));
      while (cells.length % 7) cells.push(null);
      const rows = []; for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
      return rows;
    },
    number(v) { return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); },
    money(v) { return RU.number(v) + ' ₸'; },
    shortAxis(v) {
      const a = Math.abs(v);
      if (a >= 1e6) return String(Math.round(v / 1e5) / 10).replace('.', ',') + 'M';
      if (a >= 1e3) return Math.round(v / 1e3) + 'K';
      return String(Math.round(v));
    },
    millions(v) {
      if (Math.abs(v) >= 1e6) return '₸ ' + String(Math.round(v / 1e4) / 100).replace('.', ',') + ' млн';
      return '₸ ' + RU.number(v);
    },
    plural(n, one, few, many) {
      const a = Math.abs(n), m10 = a % 10, m100 = a % 100;
      if (m10 === 1 && m100 !== 11) return one;
      if (m10 >= 2 && m10 <= 4 && !(m100 >= 12 && m100 <= 14)) return few;
      return many;
    },
    classes: (n) => RU.plural(n, 'занятие', 'занятия', 'занятий'),
    days: (n) => RU.plural(n, 'день', 'дня', 'дней'),
    clients: (n) => RU.plural(n, 'клиент', 'клиента', 'клиентов'),
    visits: (n) => RU.plural(n, 'визит', 'визита', 'визитов'),
    payments: (n) => RU.plural(n, 'оплата', 'оплаты', 'оплат'),
    transfers: (n) => RU.plural(n, 'перенос', 'переноса', 'переносов'),
    weeks: (n) => RU.plural(n, 'неделя', 'недели', 'недель'),
    compare: (a, b) => String(a).localeCompare(String(b), 'ru', { numeric: true, sensitivity: 'base' })
  };

  const DEFAULT_CLASSES = [{"name":"Хатха-йога","type":"yoga","level":"Лёгкий","durationMin":60,"capacity":12,"trainer":"Анна Ким","hall":"зал №1","weekdays":[1,3,5],"startMinutes":540,"equipment":"Коврик, блоки, ремень","details":"Классическая практика асан, дыхания и расслабления в спокойном темпе. Баланс силы и гибкости."},{"name":"Йога для начинающих","type":"yoga","level":"Лёгкий","durationMin":60,"capacity":12,"trainer":"Анна Ким","hall":"зал №1","weekdays":[2,4],"startMinutes":540,"equipment":"Коврик, блоки","details":"Базовые асаны, выравнивание и дыхание. Подходит для первого знакомства с йогой."},{"name":"Виньяса-флоу","type":"yoga","level":"Средний","durationMin":75,"capacity":12,"trainer":"Анна Ким","hall":"зал №1","weekdays":[1,3],"startMinutes":1080,"equipment":"Коврик","details":"Динамичная последовательность асан, связанных с дыханием. Развивает выносливость и координацию."},{"name":"Аштанга-виньяса","type":"yoga","level":"Продвинутый","durationMin":90,"capacity":10,"trainer":"Дмитрий Ли","hall":"зал №1","weekdays":[2,4],"startMinutes":420,"equipment":"Коврик","details":"Строгая последовательность поз в быстром темпе. Требует подготовки и регулярной практики."},{"name":"Йога Айенгара","type":"yoga","level":"Средний","durationMin":75,"capacity":10,"trainer":"Ольга Пак","hall":"зал №2","weekdays":[6],"startMinutes":600,"equipment":"Коврик, блоки, ремни, болстеры","details":"Точное выравнивание и длительное удержание поз с использованием опор."},{"name":"Инь-йога","type":"yoga","level":"Лёгкий","durationMin":75,"capacity":12,"trainer":"Дмитрий Ли","hall":"зал №2","weekdays":[2,4],"startMinutes":1200,"equipment":"Коврик, болстеры, одеяла","details":"Долгие пассивные позы для глубокого расслабления соединительных тканей."},{"name":"Кундалини-йога","type":"yoga","level":"Средний","durationMin":75,"capacity":14,"trainer":"Ольга Пак","hall":"зал №2","weekdays":[3],"startMinutes":1200,"equipment":"Коврик, плед","details":"Крия, дыхательные техники, мантры и медитация."},{"name":"Йога для спины и осанки","type":"yoga","level":"Лёгкий","durationMin":60,"capacity":12,"trainer":"Ольга Пак","hall":"зал №2","weekdays":[1,5],"startMinutes":720,"equipment":"Коврик, блоки, ремни","details":"Оздоровительная практика для позвоночника, снятия напряжения в шее и пояснице."},{"name":"Пренатальная йога","type":"yoga","level":"Лёгкий","durationMin":60,"capacity":8,"trainer":"Анна Ким","hall":"зал №2","weekdays":[6],"startMinutes":720,"equipment":"Коврик, болстеры, блоки","details":"Мягкая практика для беременных: дыхание, подвижность таза, расслабление."},{"name":"Йога-нидра","type":"yoga","level":"Лёгкий","durationMin":45,"capacity":15,"trainer":"Дмитрий Ли","hall":"зал №1","weekdays":[7],"startMinutes":1140,"equipment":"Коврик, плед, болстер","details":"Глубокая релаксация в положении лёжа под голос ведущего."},{"name":"Мат-пилатес","type":"pilates","level":"Средний","durationMin":55,"capacity":12,"trainer":"Ольга Пак","hall":"зал №2","weekdays":[1,3],"startMinutes":1140,"equipment":"Коврик","details":"Упражнения на коврике для мышц кора, осанки и контроля дыхания."},{"name":"Пилатес для начинающих","type":"pilates","level":"Лёгкий","durationMin":55,"capacity":12,"trainer":"Ольга Пак","hall":"зал №2","weekdays":[2,4],"startMinutes":690,"equipment":"Коврик, мяч","details":"Основные принципы пилатеса, базовые упражнения и техника безопасного выполнения."},{"name":"Пилатес на реформере","type":"pilates","level":"Средний","durationMin":55,"capacity":6,"trainer":"Ольга Пак","hall":"зал №3","weekdays":[3,6],"startMinutes":540,"equipment":"Реформер","details":"Тренировка на реформере с пружинным сопротивлением. Малые группы."},{"name":"Пилатес с малым оборудованием","type":"pilates","level":"Средний","durationMin":55,"capacity":10,"trainer":"Ольга Пак","hall":"зал №2","weekdays":[5],"startMinutes":1140,"equipment":"Мячи, кольца, ленты, ролики","details":"Разнообразная нагрузка с фитболом, кольцом, эспандерами и роликами."},{"name":"Пилатес для спины и кора","type":"pilates","level":"Лёгкий","durationMin":55,"capacity":10,"trainer":"Ольга Пак","hall":"зал №2","weekdays":[2],"startMinutes":1080,"equipment":"Коврик, ролик","details":"Укрепление глубоких мышц спины и живота, профилактика болей в пояснице."},{"name":"Пренатальный и постнатальный пилатес","type":"pilates","level":"Лёгкий","durationMin":55,"capacity":8,"trainer":"Анна Ким","hall":"зал №2","weekdays":[7],"startMinutes":690,"equipment":"Коврик, мяч","details":"Безопасные упражнения во время беременности и для восстановления после родов."}];

  const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  const trim = (s) => String(s == null ? '' : s).trim();

  /* ---------- Хэш PIN ---------- */
  const subtle = () => (typeof crypto !== 'undefined' && crypto.subtle) ? crypto.subtle : null;
  const hex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  async function sha256(text) {
    const s = subtle();
    if (!s) throw new Error('Для входа по PIN нужен защищённый адрес (https)');
    return hex(await s.digest('SHA-256', new TextEncoder().encode(text)));
  }
  const makeSalt = () => {
    const a = new Uint8Array(16);
    (typeof crypto !== 'undefined' ? crypto : require('crypto').webcrypto).getRandomValues(a);
    return hex(a);
  };
  async function hashPin(secret, salt) { /* прежний способ (2000 последовательных SHA-256) — только для проверки старых записей */
    let h = salt + ':' + secret;
    for (let i = 0; i < 2000; i++) h = await sha256(h + salt);
    return h;
  }
  async function hashPin2(secret, salt) { /* PBKDF2: один встроенный вызов, быстро на iPhone/iPad */
    const s = subtle(); if (!s) throw new Error('Для входа по PIN нужен защищённый адрес (https)');
    const enc = new TextEncoder();
    const key = await s.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
    return hex(await s.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100000 }, key, 256));
  }

  /* ---------- Хранилище ---------- */
  const KEYS = { data: 'yogamat.studio.v1', pins: 'yogamat.pins.v1', session: 'yogamat.session.v1', backups: 'yogamat.backups.v1', auth: 'yogamat.auth.v1', prefs: 'yogamat.prefs.v1', lastBackup: 'yogamat.lastBackup.v1' };

  function memoryStorage() {
    const m = {};
    return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } };
  }

  function createStore(options) {
    options = options || {};
    const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : memoryStorage());
    const now = options.now || (() => new Date());
    const listeners = [];
    const S = {
      clients: [], subscriptions: [], visits: [], transfers: [],
      classes: [], tariffs: [], rentSettings: null, rentPeriods: [],
      staff: [], favoriteAsanas: [], studioName: 'Студия yoga_matkz', studioLogo: null
    };
    let currentUserID = null;
    let saveError = null;
    const todayKey = () => RU.key(now());
    const fail = (m) => { throw new Error(m); };

    const read = (k, fallback) => { try { const v = storage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } };
    const write = (k, v) => { try { storage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };

    const api = {
      state: S,
      RU, APP_VERSION, KEYS,
      get saveError() { return saveError; },
      get currentUserID() { return currentUserID; },
      subscribe(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
      emit() { listeners.slice().forEach((f) => f()); }
    };

    function defaultClasses() { return DEFAULT_CLASSES.map((c) => Object.assign({ id: uid(), active: true, trainerIDs: [] }, c)); }
    api.defaultClasses = defaultClasses;

    function snapshot() {
      return {
        version: 1, clients: S.clients, subscriptions: S.subscriptions, visits: S.visits, transfers: S.transfers,
        studioName: S.studioName, studioLogo: S.studioLogo || null, classes: S.classes, tariffs: S.tariffs, rentSettings: S.rentSettings,
        rentPeriods: S.rentPeriods, staff: S.staff, favoriteAsanas: S.favoriteAsanas.slice().sort()
      };
    }
    api.snapshot = snapshot;

    function apply(snap) {
      S.clients = snap.clients || []; S.subscriptions = snap.subscriptions || []; S.visits = snap.visits || [];
      S.transfers = snap.transfers || [];
      S.classes = snap.classes || S.classes || defaultClasses();
      S.tariffs = snap.tariffs || []; S.rentSettings = snap.rentSettings || null; S.rentPeriods = snap.rentPeriods || [];
      S.staff = snap.staff || S.staff || []; S.favoriteAsanas = snap.favoriteAsanas || S.favoriteAsanas || [];
      if (snap.studioName) S.studioName = snap.studioName === 'Студия Yogamat.kz' ? 'Студия yoga_matkz' : snap.studioName; /* прежнее название по умолчанию */
      S.studioLogo = isLogo(snap.studioLogo) ? snap.studioLogo : null;
    }

    function persist() {
      const ok = write(KEYS.data, snapshot());
      saveError = ok ? null : 'Не удалось сохранить данные: нет места в хранилище браузера';
      api.emit();
    }
    api.persist = persist;

    function load() {
      const snap = read(KEYS.data, null);
      if (!snap) { S.classes = defaultClasses(); persist(); return false; }
      apply(snap);
      ensureRentPeriods();
      return true;
    }

    /* ----- сотрудники и вход ----- */
    const staffById = (id) => S.staff.find((u) => u.id === id);
    Object.defineProperty(api, 'currentUser', { get() { const u = currentUserID && staffById(currentUserID); return u && u.active ? u : null; } });
    Object.defineProperty(api, 'isAdmin', { get() { const u = api.currentUser; return !!u && u.role === 'admin'; } });
    Object.defineProperty(api, 'trainers', { get() { return S.staff.filter((u) => u.role === 'trainer' && u.active); } });
    api.staffUser = staffById;
    api.trainerNames = (item) => {
      const ids = item.trainerIDs || [];
      const names = S.staff.filter((u) => ids.includes(u.id)).map((u) => u.name);
      return names.length ? names.join(', ') : (item.trainer || '');
    };
    api.isValidPIN = (pin) => /^\d{4,8}$/.test(String(pin));
    /* контрольный вопрос (вместо кода восстановления): типовые вопросы и нормализация ответа */
    api.STANDARD_QUESTIONS = STANDARD_QUESTIONS;
    api.normAnswer = normAnswer;
    api.isValidAnswer = (t) => normAnswer(t).length >= 3;

    const pins = () => { const p = read(KEYS.pins, {}); if (p['recovery.code']) { delete p['recovery.code']; write(KEYS.pins, p); } return p; }; /* код восстановления отменён: старый удаляется */
    const setVault = (account, value) => { const p = pins(); p[account] = value; write(KEYS.pins, p); };
    async function makeRecord(secret) { const salt = makeSalt(); return 'v2$' + salt + ':' + (await hashPin2(secret, salt)); }
    const isV2 = (record) => typeof record === 'string' && record.startsWith('v2$');
    async function matches(secret, record) {
      if (!record) return false;
      const v2 = isV2(record); const body = v2 ? record.slice(3) : record;
      const i = body.indexOf(':'); if (i < 0) return false;
      const salt = body.slice(0, i);
      return (await (v2 ? hashPin2 : hashPin)(secret, salt)) === body.slice(i + 1);
    }
    const attempts = () => read(KEYS.auth, {});
    const setAttempts = (a) => write(KEYS.auth, a);
    api.lockRemainingSeconds = (userID) => {
      const a = attempts()[userID]; if (!a || !a.lockUntil) return 0;
      const s = (a.lockUntil - now().getTime()) / 1000;
      return s > 0 ? Math.ceil(s) : 0;
    };
    const clearAttempts = (id) => { const a = attempts(); delete a[id]; setAttempts(a); };
    function startSession(id) { currentUserID = id; try { storage.setItem(KEYS.session, id); } catch (e) { /* без сессии */ } api.emit(); }

    api.setupAdmin = async (name, pin, question, answer) => {
      if (S.staff.length) fail('Аккаунт администратора уже создан');
      if (!api.isValidPIN(pin)) fail('PIN — от 4 до 8 цифр');
      checkQA(question, answer);
      const user = { id: uid(), name: trim(name) || 'Администратор', role: 'admin', active: true };
      S.staff = [user];
      setVault('pin.' + user.id, await makeRecord(pin));
      setVault('qa.' + user.id, { question: trim(question), answer: await makeRecord(normAnswer(answer)) });
      persist(); startSession(user.id);
      return user;
    };
    function checkQA(question, answer) {
      if (!trim(question)) fail('Выберите контрольный вопрос или введите свой');
      if (trim(question).length > 80) fail('Вопрос слишком длинный (до 80 знаков)');
      if (!api.isValidAnswer(answer)) fail('Ответ — не короче 3 знаков (буквы или цифры)');
    }
    api.hasQuestion = (userID) => { const q = pins()['qa.' + userID]; return !!(q && q.question && q.answer); };
    api.questionOf = (userID) => (api.hasQuestion(userID) ? pins()['qa.' + userID].question : '');
    api.setQuestion = async (userID, question, answer, pin) => {
      if (!staffById(userID)) fail('Пользователь не найден');
      if (!(await matches(pin, pins()['pin.' + userID]))) fail('PIN неверный');
      checkQA(question, answer);
      setVault('qa.' + userID, { question: trim(question), answer: await makeRecord(normAnswer(answer)) }); api.emit();
    };
    api.clearQuestion = async (userID, pin) => {
      if (!(await matches(pin, pins()['pin.' + userID]))) fail('PIN неверный');
      const p = pins(); delete p['qa.' + userID]; write(KEYS.pins, p); api.emit();
    };
    api.addTrainer = async (name, pin) => {
      if (!api.isValidPIN(pin)) fail('PIN — от 4 до 8 цифр');
      if (!trim(name)) fail('Введите имя тренера');
      const user = { id: uid(), name: trim(name), role: 'trainer', active: true };
      S.staff.push(user);
      setVault('pin.' + user.id, await makeRecord(pin));
      persist(); return user;
    };
    api.updateStaffName = (id, name) => {
      const u = staffById(id); if (!u) fail('Сотрудник не найден');
      if (!trim(name)) fail('Введите имя');
      u.name = trim(name); persist();
    };
    api.setPIN = async (userID, pin) => {
      if (!staffById(userID)) fail('Сотрудник не найден');
      if (!api.isValidPIN(pin)) fail('PIN — от 4 до 8 цифр');
      setVault('pin.' + userID, await makeRecord(pin)); clearAttempts(userID);
    };
    api.changePIN = async (userID, current, next) => {
      const record = pins()['pin.' + userID];
      if (!record) fail('PIN не найден — восстановите доступ по контрольному вопросу');
      if (!(await matches(current, record))) fail('Текущий PIN неверный');
      if (!api.isValidPIN(next)) fail('PIN — от 4 до 8 цифр');
      setVault('pin.' + userID, await makeRecord(next));
    };
    api.setStaffActive = (id, active) => {
      const u = staffById(id); if (!u || u.role === 'admin') return;
      u.active = !!active;
      if (!active && currentUserID === id) api.logOut();
      persist();
    };
    api.deleteStaff = (id) => {
      const u = staffById(id); if (!u || u.role === 'admin') return;
      S.staff = S.staff.filter((x) => x.id !== id);
      const p = pins(); delete p['pin.' + id]; delete p['qa.' + id]; write(KEYS.pins, p);
      S.classes.forEach((c) => { c.trainerIDs = (c.trainerIDs || []).filter((x) => x !== id); });
      if (currentUserID === id) api.logOut();
      persist();
    };
    api.logIn = async (userID, pin) => {
      const locked = api.lockRemainingSeconds(userID);
      if (locked > 0) fail('Слишком много попыток. Вход заблокирован ещё на ' + locked + ' с.');
      const u = staffById(userID);
      if (!u || !u.active) fail('Пользователь не найден или отключён');
      const record = pins()['pin.' + userID];
      if (!record) fail('PIN не найден — восстановите доступ по контрольному вопросу');
      if (!(await matches(pin, record))) {
        const a = attempts(); const cur = a[userID] || { count: 0 };
        cur.count += 1;
        if (cur.count >= 5) { a[userID] = { count: 0, lockUntil: now().getTime() + 30000 }; setAttempts(a); fail('Слишком много попыток. Вход заблокирован на 30 секунд.'); }
        a[userID] = cur; setAttempts(a);
        fail('Неверный PIN. Осталось попыток: ' + Math.max(0, 5 - cur.count) + '.');
      }
      clearAttempts(userID);
      if (!isV2(record)) { try { setVault('pin.' + userID, await makeRecord(pin)); } catch (e) { /* остаётся прежняя запись */ } } /* тихий переход на быстрый хэш */
      startSession(userID);
    };
    /* общий счётчик попыток с входом: 5 неверных — пауза 30 с */
    function failAttempt(userID, message) {
      const a = attempts(); const cur = a[userID] || { count: 0 }; cur.count += 1;
      if (cur.count >= 5) { a[userID] = { count: 0, lockUntil: now().getTime() + 30000 }; setAttempts(a); fail('Слишком много попыток. Заблокировано на 30 секунд.'); }
      a[userID] = cur; setAttempts(a); fail(message + ' Осталось попыток: ' + Math.max(0, 5 - cur.count) + '.');
    }
    api.resetPINByAnswer = async (userID, answer, pin) => {
      const locked = api.lockRemainingSeconds(userID);
      if (locked > 0) fail('Слишком много попыток. Заблокировано ещё на ' + locked + ' с.');
      const u = staffById(userID); if (!u || !u.active) fail('Пользователь не найден или отключён');
      const qa = pins()['qa.' + userID]; if (!qa || !qa.answer) fail('Контрольный вопрос не задан');
      if (!api.isValidPIN(pin)) fail('PIN — от 4 до 8 цифр');
      if (!(await matches(normAnswer(answer), qa.answer))) failAttempt(userID, 'Неверный ответ.');
      setVault('pin.' + userID, await makeRecord(pin)); clearAttempts(userID);
    };
    api.logOut = () => { currentUserID = null; try { storage.removeItem(KEYS.session); } catch (e) { /* ок */ } api.emit(); };
    function restoreSession() {
      let id = null; try { id = storage.getItem(KEYS.session); } catch (e) { /* ок */ }
      const u = id && staffById(id);
      if (u && u.active) currentUserID = id;
    }

    /* ----- справочник асан ----- */
    api.toggleFavoriteAsana = (id) => {
      const i = S.favoriteAsanas.indexOf(id);
      if (i >= 0) S.favoriteAsanas.splice(i, 1); else S.favoriteAsanas.push(id);
      persist();
    };

    /* ----- клиенты ----- */
    api.client = (id) => S.clients.find((c) => c.id === id);
    api.addClient = ({ name, phone, note, since }) => {
      if (!trim(name)) fail('Введите имя клиента');
      const c = { id: uid(), name: trim(name), phone: trim(phone), note: trim(note), since: since || todayKey() };
      S.clients.push(c); persist(); return c;
    };
    api.updateClient = (id, { name, phone, note, since }) => {
      if (!trim(name)) fail('Введите имя клиента');
      const c = api.client(id); if (!c) fail('Клиент не найден');
      Object.assign(c, { name: trim(name), phone: trim(phone), note: trim(note), since: since || c.since });
      persist();
    };
    const noTrainer = (msg) => { const u = api.currentUser; if (u && u.role === 'trainer') fail(msg); };
    api.addQuickSale = (o) => {
      noTrainer('Продавать абонементы может только администратор');
      if (!trim(o.name)) fail('Введите имя клиента');
      if (!trim(o.tariffName)) fail('Выберите тариф');
      const c = { id: uid(), name: trim(o.name), phone: trim(o.phone), note: '', since: todayKey() };
      S.clients.push(c);
      try {
        api.addSubscription(Object.assign({}, o, { clientID: c.id, paidDate: o.paid ? o.paidDate : null }));
      } catch (e) { S.clients = S.clients.filter((x) => x.id !== c.id); persist(); throw e; }
      return c;
    };
    api.deleteClient = (id) => {
      if (!api.isAdmin) fail('Удалять клиентов может только администратор');
      if (!api.client(id)) fail('Клиент не найден');
      if (options.backupBeforeDelete !== false) { try { api.createBackup(); } catch (e) { fail('Не удалось создать резервную копию перед удалением: ' + e.message); } }
      S.clients = S.clients.filter((c) => c.id !== id);
      S.subscriptions = S.subscriptions.filter((s) => s.clientID !== id);
      S.visits = S.visits.filter((v) => v.clientID !== id);
      S.transfers = S.transfers.filter((t) => t.clientID !== id);
      persist();
    };

    /* ----- абонементы ----- */
    api.subscription = (id) => S.subscriptions.find((s) => s.id === id);
    api.subscriptionsOf = (clientID) => S.subscriptions.filter((s) => s.clientID === clientID).sort((a, b) => (a.purchaseDate < b.purchaseDate ? 1 : a.purchaseDate > b.purchaseDate ? -1 : 0));
    api.statusOf = (s) => {
      if (s.visitsLeft <= 0) return 'finished';
      if (s.expiryDate < todayKey()) return 'expired';
      return 'active';
    };
    api.statusTitle = (st) => ({ active: 'активен', finished: 'занятия закончились', expired: 'срок истёк' }[st]);
    api.activeSubscription = (clientID) => {
      const list = api.subscriptionsOf(clientID).filter((s) => api.statusOf(s) === 'active');
      list.sort((a, b) => (a.expiryDate < b.expiryDate ? -1 : a.expiryDate > b.expiryDate ? 1 : 0));
      return list[0] || null;
    };
    api.clientsWithActiveSubscription = () => S.clients.filter((c) => api.activeSubscription(c.id)).sort((a, b) => RU.compare(a.name, b.name));
    api.addSubscription = (o) => {
      noTrainer('Продавать абонементы может только администратор');
      const name = trim(o.tariffName);
      if (!name) fail('Введите название тарифа');
      if (!(o.expiryDate >= o.purchaseDate)) fail('Срок действия раньше даты покупки');
      if (!(o.visitsTotal >= 1)) fail('Занятий должно быть не меньше одного');
      if (!(o.price >= 0)) fail('Укажите цену — ноль или больше');
      if (o.paid && !o.paidDate) fail('Укажите дату оплаты');
      const s = { id: uid(), clientID: o.clientID, tariffName: name, purchaseDate: o.purchaseDate, expiryDate: o.expiryDate, visitsTotal: o.visitsTotal, visitsLeft: o.visitsTotal, price: o.price, paid: !!o.paid, paidDate: o.paid ? o.paidDate : null };
      S.subscriptions.push(s); persist(); return s;
    };
    api.setPaid = (id, paid) => {
      const s = api.subscription(id); if (!s) return;
      s.paid = !!paid; s.paidDate = paid ? todayKey() : null; persist();
    };
    api.setPaidDate = (id, date) => {
      const s = api.subscription(id); if (!s) return;
      s.paid = true; s.paidDate = date; persist();
    };

    /* ----- визиты ----- */
    api.visitsOf = (clientID) => S.visits.filter((v) => v.clientID === clientID).sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : (a.createdAt < b.createdAt ? 1 : -1)));
    api.todayVisits = () => S.visits.filter((v) => v.date === todayKey()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    api.markVisit = (clientID, date, classID) => {
      const sub = api.activeSubscription(clientID);
      if (!sub) fail('У клиента нет активного абонемента');
      if (S.visits.some((v) => v.clientID === clientID && v.date === date)) fail('Посещение в этот день уже отмечено');
      sub.visitsLeft = Math.max(0, sub.visitsLeft - 1);
      S.visits.push({ id: uid(), clientID, subscriptionID: sub.id, date, classID: classID || null, createdAt: now().toISOString() });
      persist();
    };
    api.cancelBooking = (visitID) => {
      const i = S.visits.findIndex((v) => v.id === visitID);
      if (i < 0) fail('Запись не найдена');
      const v = S.visits[i];
      const sub = api.subscription(v.subscriptionID);
      if (sub) sub.visitsLeft = Math.min(sub.visitsTotal, sub.visitsLeft + 1);
      S.visits.splice(i, 1); persist();
    };

    /* отмена всех записей на будущие занятия (после сегодняшнего дня): занятия возвращаются в абонементы */
    api.futureBookings = () => S.visits.filter((v) => v.classID && v.date > todayKey());
    api.cancelFutureBookings = () => {
      if (!api.isAdmin) fail('Отменять записи может только администратор');
      const list = api.futureBookings(); const ids = new Set(list.map((v) => v.id));
      list.forEach((v) => { const sub = api.subscription(v.subscriptionID); if (sub) sub.visitsLeft = Math.min(sub.visitsTotal, sub.visitsLeft + 1); });
      S.visits = S.visits.filter((v) => !ids.has(v.id)); persist();
      return { count: list.length, clients: new Set(list.map((v) => v.clientID)).size };
    };

    /* ----- классы и запись ----- */
    api.studioClass = (id) => S.classes.find((c) => c.id === id);
    api.orderedClasses = () => S.classes.slice().sort((a, b) => (a.type !== b.type ? (a.type === 'yoga' ? -1 : 1) : RU.compare(a.name, b.name)));
    api.classesOnWeekday = (w) => S.classes.filter((c) => c.active && c.weekdays.includes(w)).sort((a, b) => a.startMinutes - b.startMinutes);
    api.classesOn = (key) => { const d = RU.date(key); return d ? api.classesOnWeekday(RU.weekdayIndex(d)) : []; };
    api.bookedCount = (classID, key) => S.visits.filter((v) => v.classID === classID && v.date === key).length;
    api.bookedVisits = (classID, key) => S.visits.filter((v) => v.classID === classID && v.date === key).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    api.bookVisit = (clientID, classID, date) => {
      const item = api.studioClass(classID);
      if (!item || !item.active) fail('Занятие не найдено или не проводится');
      if (S.visits.some((v) => v.clientID === clientID && v.date === date)) fail('Клиент уже записан в этот день');
      if (api.bookedCount(classID, date) >= item.capacity) fail('В группе нет свободных мест');
      api.markVisit(clientID, date, classID);
    };
    api.repeatBooking = (clientID, classID, fromKey, weeks) => {
      const item = api.studioClass(classID);
      if (!item || !item.active) fail('Занятие не найдено или не проводится');
      if (!(weeks >= 1 && weeks <= 12)) fail('Укажите от 1 до 12 недель');
      const sub = api.activeSubscription(clientID);
      if (!sub) fail('У клиента нет активного абонемента');
      const start = RU.date(fromKey); if (!start) fail('Укажите корректную дату');
      let created = 0, skipped = 0;
      for (let off = 0; off < weeks * 7; off++) {
        const d = RU.addDaysToDate(start, off);
        if (!item.weekdays.includes(RU.weekdayIndex(d))) continue;
        const k = RU.key(d);
        if (S.visits.some((v) => v.clientID === clientID && v.date === k)) { skipped++; continue; }
        if (api.bookedCount(classID, k) >= item.capacity) { skipped++; continue; }
        if (sub.visitsLeft <= 0) { skipped++; continue; }
        sub.visitsLeft -= 1;
        S.visits.push({ id: uid(), clientID, subscriptionID: sub.id, date: k, classID, createdAt: now().toISOString() });
        created++;
      }
      persist(); return { created, skipped };
    };
    api.saveClass = (value) => {
      noTrainer('Создавать и менять направления может только администратор');
      const c = Object.assign({}, value);
      c.name = trim(c.name);
      if (!c.name) fail('Введите название занятия');
      if (!(c.durationMin >= 15)) fail('Длительность — не меньше 15 минут');
      if (!(c.capacity >= 1)) fail('Мест в группе — не меньше одного');
      ['trainer', 'hall', 'equipment', 'details'].forEach((k) => { c[k] = trim(c[k]); });
      if (!c.id) c.id = uid();
      const i = S.classes.findIndex((x) => x.id === c.id);
      if (i >= 0) S.classes[i] = c; else S.classes.push(c);
      persist(); return c;
    };
    api.deleteClass = (id) => {
      S.classes = S.classes.filter((c) => c.id !== id);
      S.visits.forEach((v) => { if (v.classID === id) v.classID = null; });
      persist();
    };

    /* ----- переносы ----- */
    api.transfersOf = (clientID) => S.transfers.filter((t) => t.clientID === clientID).sort((a, b) => (a.date < b.date ? 1 : -1));
    api.addTransfer = (subscriptionID, days, date, note) => {
      if (!(days >= 1)) fail('Укажите число дней — от одного');
      const s = api.subscription(subscriptionID); if (!s) fail('Абонемент не найден');
      s.expiryDate = RU.addDays(days, s.expiryDate);
      S.transfers.push({ id: uid(), clientID: s.clientID, subscriptionID, days, date, note: trim(note) });
      persist();
    };

    /* ----- аренда ----- */
    const curYear = () => now().getFullYear();
    const curMonth = () => now().getMonth() + 1;
    const idx = (y, m) => y * 12 + m - 1;
    const curIndex = () => idx(curYear(), curMonth());
    const periodIndex = (p) => idx(p.year, p.month);
    const byPeriod = (a, b) => periodIndex(a) - periodIndex(b);
    api.rentPeriodsAscending = () => S.rentPeriods.slice().sort(byPeriod);
    api.currentRentPeriod = () => S.rentPeriods.find((p) => p.year === curYear() && p.month === curMonth()) || null;
    api.unpaidRentPeriods = () => S.rentPeriods.filter((p) => !p.paid && periodIndex(p) <= curIndex()).sort(byPeriod);
    api.missedRentPeriods = () => S.rentPeriods.filter((p) => !p.paid && periodIndex(p) < curIndex()).sort(byPeriod);
    api.pastAndCurrentRentPeriods = () => api.rentPeriodsAscending().filter((p) => periodIndex(p) <= curIndex()).reverse();
    api.upcomingRentPeriods = () => api.rentPeriodsAscending().filter((p) => periodIndex(p) > curIndex());
    api.paidRentTotal = () => S.rentSettings ? S.rentPeriods.filter((p) => p.paid).length * S.rentSettings.monthlyAmount : 0;
    api.setupRent = (amount, startYear, startMonth) => {
      if (S.rentSettings) fail('Аренда уже настроена');
      if (!(amount >= 0)) fail('Укажите сумму — ноль или больше');
      S.rentSettings = { monthlyAmount: amount, startYear, startMonth };
      ensureRentPeriods(true); persist();
    };
    function ensureRentPeriods(skipPersist) {
      const st = S.rentSettings; if (!st) return;
      const start = idx(st.startYear, st.startMonth);
      const end = Math.max(curIndex(), start) + 6;
      let changed = false;
      for (let i = start; i <= end; i++) {
        const year = Math.floor(i / 12), month = i % 12 + 1;
        if (!S.rentPeriods.some((p) => p.year === year && p.month === month)) {
          S.rentPeriods.push({ id: uid(), year, month, paid: false, paidDate: null }); changed = true;
        }
      }
      if (changed && !skipPersist) persist();
    }
    api.refreshRentWindow = () => ensureRentPeriods();
    api.setRentPaid = (id, paid) => {
      const p = S.rentPeriods.find((x) => x.id === id); if (!p) return;
      p.paid = !!paid; p.paidDate = paid ? todayKey() : null; persist();
    };
    api.rentExpensesByMonth = () => {
      const out = {}; if (!S.rentSettings) return out;
      S.rentPeriods.filter((p) => p.paid).forEach((p) => { const k = RU.monthKey(p.year, p.month); out[k] = (out[k] || 0) + S.rentSettings.monthlyAmount; });
      return out;
    };
    api.rentExpense = (y, m) => api.rentExpensesByMonth()[RU.monthKey(y, m)] || 0;

    /* ----- тарифы ----- */
    api.orderedTariffs = () => S.tariffs.slice().sort((a, b) => (a.visitsCount !== b.visitsCount ? a.visitsCount - b.visitsCount : a.price - b.price));
    api.saveTariff = (value) => {
      const t = Object.assign({}, value); t.name = trim(t.name);
      if (!t.name) fail('Введите название тарифа');
      if (!(t.visitsCount >= 1)) fail('Занятий — не меньше одного');
      if (!(t.durationDays >= 1)) fail('Срок — не меньше одного дня');
      if (!(t.price >= 0)) fail('Укажите цену — ноль или больше');
      if (!t.id) t.id = uid();
      const i = S.tariffs.findIndex((x) => x.id === t.id);
      if (i >= 0) S.tariffs[i] = t; else S.tariffs.push(t);
      persist(); return t;
    };
    api.deleteTariff = (id) => { S.tariffs = S.tariffs.filter((t) => t.id !== id); persist(); };

    /* ----- доход ----- */
    api.paidSubscriptions = () => S.subscriptions.filter((s) => s.paid && RU.isValidDay(s.paidDate) && s.price >= 0);
    api.paidWithoutDate = () => S.subscriptions.filter((s) => s.paid && !RU.isValidDay(s.paidDate));
    api.unpaidSubscriptions = () => S.subscriptions.filter((s) => !s.paid);
    api.receiptsByMonth = () => {
      const out = {};
      api.paidSubscriptions().forEach((s) => { const k = s.paidDate.slice(0, 7); out[k] = (out[k] || 0) + s.price; });
      return out;
    };
    api.receipts = (y, m) => api.receiptsByMonth()[RU.monthKey(y, m)] || 0;
    api.receiptsYear = (y) => { const b = api.receiptsByMonth(); let t = 0; for (let m = 1; m <= 12; m++) t += b[RU.monthKey(y, m)] || 0; return t; };
    api.paidCount = (y, m) => { const p = RU.monthKey(y, m); return api.paidSubscriptions().filter((s) => s.paidDate.startsWith(p)).length; };
    api.monthlyReceipts = (y) => { const b = api.receiptsByMonth(); return Array.from({ length: 12 }, (_, i) => b[RU.monthKey(y, i + 1)] || 0); };
    api.netIncome = (y, m) => api.receipts(y, m) - api.rentExpense(y, m);
    api.netIncomeYear = (y) => { let t = 0; for (let m = 1; m <= 12; m++) t += api.netIncome(y, m); return t; };
    api.monthlyNet = (y) => Array.from({ length: 12 }, (_, i) => api.netIncome(y, i + 1));
    api.receiptYears = () => {
      const ys = new Set(Object.keys(api.receiptsByMonth()).map((k) => +k.slice(0, 4)));
      ys.add(curYear());
      return Array.from(ys).sort((a, b) => b - a);
    };

    /* ----- сводка ----- */
    api.endingSoon = () => {
      const today = todayKey(); const out = [];
      S.subscriptions.forEach((s) => {
        if (api.statusOf(s) !== 'active') return;
        const client = api.client(s.clientID); if (!client) return;
        const daysLeft = RU.daysBetween(today, s.expiryDate);
        if (!(s.visitsLeft <= 2 || daysLeft <= 5)) return;
        let reason;
        if (s.visitsLeft <= 2) reason = 'осталось ' + s.visitsLeft + ' ' + RU.classes(s.visitsLeft);
        else if (daysLeft <= 1) reason = 'остался 1 день';
        else reason = 'истекает через ' + daysLeft + ' ' + RU.days(daysLeft);
        out.push({ client, subscription: s, reason, daysLeft });
      });
      return out.sort((a, b) => a.subscription.visitsLeft - b.subscription.visitsLeft);
    };

    /* ----- нагрузка ----- */
    function sessionsInMonth(item, year, month) {
      const today = todayKey(); const days = new Date(year, month, 0).getDate(); let n = 0;
      for (let d = 1; d <= days; d++) {
        const dt = new Date(year, month - 1, d);
        if (RU.key(dt) > today) continue;
        if (item.weekdays.includes(RU.weekdayIndex(dt))) n++;
      }
      return n;
    }
    const pct = (visits, capacity) => capacity > 0 ? Math.min(100, Math.round(visits / capacity * 100)) : 0;
    api.classLoad = (year, month) => {
      const key = RU.monthKey(year, month); const reports = [];
      S.classes.filter((c) => c.active).forEach((item) => {
        const sessions = sessionsInMonth(item, year, month); if (!sessions) return;
        const visits = S.visits.filter((v) => v.classID === item.id && v.date.startsWith(key)).length;
        reports.push({ item, sessions, visits, occupancy: pct(visits, sessions * item.capacity) });
      });
      reports.sort((a, b) => (a.occupancy !== b.occupancy ? b.occupancy - a.occupancy : RU.compare(a.item.name, b.item.name)));
      const totalSessions = reports.reduce((s, r) => s + r.sessions, 0);
      const totalVisits = reports.reduce((s, r) => s + r.visits, 0);
      const cap = reports.reduce((s, r) => s + r.sessions * r.item.capacity, 0);
      return { reports, totalSessions, totalVisits, average: pct(totalVisits, cap) };
    };
    api.isAssigned = (item, trainer) => {
      if (!item.active) return false;
      if (item.trainerIDs && item.trainerIDs.length) return item.trainerIDs.includes(trainer.id);
      return !!item.trainer && item.trainer.toLowerCase().includes(trainer.name.toLowerCase());
    };
    api.trainerLoad = (year, month) => {
      const key = RU.monthKey(year, month); const out = [];
      S.staff.filter((u) => u.role === 'trainer').forEach((trainer) => {
        const directions = []; let sessions = 0;
        S.classes.filter((c) => api.isAssigned(c, trainer)).forEach((item) => {
          const n = sessionsInMonth(item, year, month); if (!n) return;
          const visits = S.visits.filter((v) => v.classID === item.id && v.date.startsWith(key)).length;
          directions.push({ item, sessions: n, visits }); sessions += n;
        });
        if (!sessions && !trainer.active) return; /* работающий тренер виден всегда, даже без занятий */
        const visits = directions.reduce((s, d) => s + d.visits, 0);
        const cap = directions.reduce((s, d) => s + d.sessions * d.item.capacity, 0);
        out.push({ trainer, directions: directions.sort((a, b) => b.sessions - a.sessions), sessions, visits, occupancy: pct(visits, cap) });
      });
      return out.sort((a, b) => (a.sessions !== b.sessions ? b.sessions - a.sessions : RU.compare(a.trainer.name, b.trainer.name)));
    };
    api.isMine = (item) => {
      const u = api.currentUser; if (!u) return false;
      if (item.trainerIDs && item.trainerIDs.length) return item.trainerIDs.includes(u.id);
      return !!item.trainer && item.trainer.toLowerCase().includes(u.name.toLowerCase());
    };

    /* ----- настройки, копии, импорт ----- */
    /* логотип студии: картинка data:image/… до ~250 КБ; null — вернуть стандартный */
    const LOGO_MAX = 250000;
    function isLogo(v) { return typeof v === 'string' && /^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= LOGO_MAX; }
    api.setStudioLogo = (dataUrl) => {
      if (!api.isAdmin) fail('Менять логотип может только администратор');
      if (dataUrl == null) S.studioLogo = null; else { if (!isLogo(dataUrl)) fail('Логотип должен быть картинкой PNG, JPEG или WebP небольшого размера'); S.studioLogo = dataUrl; }
      persist();
    };
    api.logoSrc = () => (isLogo(S.studioLogo) ? S.studioLogo : 'icons/logo.png');
    api.setStudioName = (name) => { if (!trim(name)) return; S.studioName = trim(name); persist(); };
    api.backups = () => read(KEYS.backups, []).sort((a, b) => (a.at < b.at ? 1 : -1));
    api.createBackup = () => {
      const list = read(KEYS.backups, []);
      const entry = { id: uid(), at: now().toISOString(), size: 0, data: snapshot() };
      entry.size = JSON.stringify(entry.data).length;
      list.push(entry);
      list.sort((a, b) => (a.at < b.at ? 1 : -1));
      let trimmed = list.slice(0, 25);
      while (!write(KEYS.backups, trimmed)) {
        if (trimmed.length <= 1) fail('Не хватило места для резервной копии');
        trimmed = trimmed.slice(0, -1);
      }
      try { storage.setItem(KEYS.lastBackup, String(now().getTime())); } catch (e) { /* ок */ }
      return entry;
    };
    api.maintainAutomaticBackup = () => {
      const list = api.backups();
      if (!list.length) { try { api.createBackup(); } catch (e) { /* ок */ } return; }
      if (now().getTime() - new Date(list[0].at).getTime() > 7 * 86400000) { try { api.createBackup(); } catch (e) { /* ок */ } }
    };
    api.deleteBackup = (id) => write(KEYS.backups, read(KEYS.backups, []).filter((b) => b.id !== id));
    api.restoreBackup = (id) => {
      const b = read(KEYS.backups, []).find((x) => x.id === id);
      if (!b) fail('Копия не найдена');
      api.importSnapshot(b.data);
    };
    function validate(snap) {
      if (!snap || typeof snap !== 'object' || !Array.isArray(snap.clients) || !Array.isArray(snap.subscriptions) || !Array.isArray(snap.visits)) fail('Файл не похож на копию базы');
      if (snap.studioLogo != null && !isLogo(snap.studioLogo)) fail('В файле некорректный логотип студии');
      const cids = new Set(snap.clients.map((c) => c.id)); const sids = new Set(snap.subscriptions.map((s) => s.id));
      snap.subscriptions.forEach((s) => {
        if (!(s.visitsTotal >= 1 && s.visitsLeft >= 0 && s.visitsLeft <= s.visitsTotal)) fail('В абонементах некорректное число занятий');
        if (!(s.price >= 0)) fail('В абонементах указана отрицательная цена');
        if (!RU.isValidDay(s.purchaseDate) || !RU.isValidDay(s.expiryDate) || s.expiryDate < s.purchaseDate) fail('В абонементах некорректные даты');
      });
      snap.visits.forEach((v) => { if (!cids.has(v.clientID) || !sids.has(v.subscriptionID) || !RU.isValidDay(v.date)) fail('В визитах есть запись с неизвестным клиентом или абонементом'); });
      (snap.transfers || []).forEach((t) => { if (!cids.has(t.clientID) || !sids.has(t.subscriptionID) || !(t.days >= 1)) fail('В переносах есть некорректная запись'); });
      (snap.classes || []).forEach((c) => { if (!(c.capacity >= 1 && c.durationMin >= 1)) fail('В направлениях есть некорректное занятие'); });
      (snap.tariffs || []).forEach((t) => { if (!(t.visitsCount >= 1 && t.durationDays >= 1 && t.price >= 0)) fail('В тарифах есть некорректная запись'); });
      if (snap.rentSettings && !(snap.rentSettings.monthlyAmount >= 0 && snap.rentSettings.startMonth >= 1 && snap.rentSettings.startMonth <= 12)) fail('В настройках аренды некорректные данные');
    }
    /* копия из прежнего приложения (yoga-tracker): clients/plans/subscriptions/visits/transfers/rent */
    const isLegacy = (s) => !!s && typeof s === 'object' && !Array.isArray(s.tariffs) && (Array.isArray(s.plans) || (s.rent && typeof s.rent === 'object') || (Array.isArray(s.clients) && s.clients[0] && 'clientId' in (Array.isArray(s.subscriptions) && s.subscriptions[0] || {})));
    api.isLegacyBackup = isLegacy;
    api.convertLegacyBackup = (old) => {
      const arr = (k) => (Array.isArray(old[k]) ? old[k] : []); const day = (v) => (typeof v === 'string' ? v.slice(0, 10) : '');
      const plans = arr('plans'); const planName = new Map(plans.map((p) => [p.id, p.name]));
      const clients = arr('clients').map((c) => ({ id: String(c.id), name: trim(c.name), phone: trim(c.phone), note: [trim(c.notes), trim(c.attendanceNote)].filter(Boolean).join('\n'), since: RU.isValidDay(day(c.createdAt)) ? day(c.createdAt) : todayKey() }));
      const cids = new Set(clients.map((c) => c.id));
      const subscriptions = arr('subscriptions').map((s) => ({ id: String(s.id), clientID: String(s.clientId), tariffName: trim(planName.get(s.planId) || s.tariffName || s.planName || 'Абонемент'), purchaseDate: day(s.purchaseDate), expiryDate: day(s.expiryDate), visitsTotal: Number(s.visitsTotal), visitsLeft: Number(s.visitsLeft), price: Number(s.price) || 0, paid: !!s.paid, paidDate: s.paid ? (day(s.paidDate) || day(s.purchaseDate)) : null }));
      const sids = new Set(subscriptions.map((s) => s.id));
      const orphanSubs = subscriptions.filter((s) => !cids.has(s.clientID)).length; if (orphanSubs) fail('В файле ' + orphanSubs + ' абонемент(а) без клиента — файл повреждён');
      const visits = arr('visits').map((v) => ({ id: String(v.id), clientID: String(v.clientId), subscriptionID: String(v.subscriptionId), date: day(v.date), classID: v.classId || null, createdAt: v.createdAt || (day(v.date) + 'T00:00:00.000Z') }));
      const transfers = arr('transfers').map((t) => ({ id: String(t.id), clientID: String(t.clientId), subscriptionID: String(t.subscriptionId), days: Number(t.daysAdded != null ? t.daysAdded : t.days), date: day(t.date), note: trim(t.comment || t.note) }));
      const tariffs = plans.map((p) => ({ id: String(p.id), name: trim(p.name), visitsCount: Number(p.visitsCount), durationDays: Number(p.durationDays), price: Number(p.price) || 0 }));
      let rentSettings = null; let rentPeriods = [];
      if (old.rent && typeof old.rent === 'object') {
        const [sy, sm] = String(old.rent.startMonth || '').split('-').map(Number);
        if (sy && sm >= 1 && sm <= 12) rentSettings = { monthlyAmount: Number(old.rent.defaultAmount) || 0, startYear: sy, startMonth: sm };
        rentPeriods = (Array.isArray(old.rent.payments) ? old.rent.payments : []).map((p) => { const [y, m] = String(p.month).split('-').map(Number); return { id: String(p.id), year: y, month: m, paid: !!p.paid, paidDate: p.paid ? (day(p.paidDate) || null) : null }; }).filter((p) => p.year && p.month >= 1 && p.month <= 12);
      }
      /* учётные записи, направления, избранное, название и логотип остаются текущими */
      const cur = snapshot();
      return Object.assign({}, cur, { version: 1, clients, subscriptions, visits, transfers, tariffs, rentSettings, rentPeriods });
    };
    api.importSnapshot = (snap) => {
      if (typeof snap === 'string') { try { snap = JSON.parse(snap); } catch (e) { fail('Файл не похож на копию базы'); } }
      const legacy = isLegacy(snap); if (legacy) snap = api.convertLegacyBackup(snap);
      validate(snap);
      try { api.createBackup(); } catch (e) { /* копия перед заменой — по возможности */ }
      apply(JSON.parse(JSON.stringify(snap)));
      ensureRentPeriods(true);
      persist();
      if (currentUserID && !S.staff.some((u) => u.id === currentUserID && u.active)) api.logOut();
      return { legacy, clients: S.clients.length, subscriptions: S.subscriptions.length, visits: S.visits.length, transfers: S.transfers.length };
    };
    api.exportJSON = () => JSON.stringify(snapshot(), null, 1);

    /* ----- CSV ----- */
    const csvCell = (v) => { let s = String(v == null ? '' : v); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const csv = (rows) => '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n');
    api.clientsCSV = () => {
      const rows = [['Клиент', 'Телефон', 'Клиент с', 'Абонемент', 'Осталось занятий', 'Всего занятий', 'Действует до', 'Цена, ₸', 'Оплата', 'Дата оплаты', 'Заметка']];
      S.clients.slice().sort((a, b) => RU.compare(a.name, b.name)).forEach((c) => {
        const subs = api.subscriptionsOf(c.id);
        if (!subs.length) rows.push([c.name, c.phone, RU.shortDate(c.since), '', '', '', '', '', '', '', c.note]);
        subs.forEach((s) => rows.push([c.name, c.phone, RU.shortDate(c.since), s.tariffName, s.visitsLeft, s.visitsTotal, RU.shortDate(s.expiryDate), s.price, s.paid ? 'оплачено' : 'не оплачено', s.paidDate ? RU.shortDate(s.paidDate) : '', c.note]));
      });
      return csv(rows);
    };
    api.visitsCSV = (year, month) => {
      const prefix = RU.monthKey(year, month);
      const rows = [['Дата', 'Время записи', 'Клиент', 'Занятие', 'Абонемент']];
      S.visits.filter((v) => v.date.startsWith(prefix)).sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : (a.createdAt < b.createdAt ? -1 : 1))).forEach((v) => {
        const c = api.client(v.clientID), k = v.classID && api.studioClass(v.classID), s = api.subscription(v.subscriptionID);
        rows.push([RU.shortDate(v.date), RU.time(new Date(v.createdAt)), c ? c.name : '—', k ? k.name : '', s ? s.tariffName : '']);
      });
      return csv(rows);
    };
    /* отчёт по платежам за период [from..to] (ключи YYYY-MM-DD): оплаты абонементов и оплаченная аренда */
    api.paymentsReport = (from, to) => {
      const subs = api.paidSubscriptions().filter((s) => s.paidDate >= from && s.paidDate <= to).sort((a, b) => (a.paidDate < b.paidDate ? -1 : 1));
      const rent = S.rentPeriods.filter((p) => p.paid && RU.isValidDay(p.paidDate) && p.paidDate >= from && p.paidDate <= to).sort((a, b) => (a.paidDate < b.paidDate ? -1 : 1));
      const income = subs.reduce((s, x) => s + x.price, 0); const rentSum = rent.reduce((s, p) => s + ((S.rentSettings && S.rentSettings.monthlyAmount) || 0), 0);
      return { subs, rent, income, rentSum, total: income - rentSum };
    };
    api.paymentsCSV = (from, to) => {
      const r = api.paymentsReport(from, to); const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
      const rows = [['Дата', 'Вид', 'Клиент / описание', 'Тариф', 'Сумма, ₸']];
      r.subs.forEach((s) => { const c = api.client(s.clientID); rows.push([RU.shortDate(s.paidDate), 'Абонемент', c ? c.name : '—', s.tariffName, fmt(s.price)]); });
      const amount = (S.rentSettings && S.rentSettings.monthlyAmount) || 0;
      r.rent.forEach((p) => rows.push([RU.shortDate(p.paidDate), 'Аренда', 'Аренда за ' + RU.months[p.month - 1].toLowerCase() + ' ' + p.year, '', '−' + fmt(amount)]));
      rows.push(['', '', 'Поступления от абонементов', '', fmt(r.income)]);
      if (r.rent.length) rows.push(['', '', 'Аренда', '', '−' + fmt(r.rentSum)]);
      rows.push(['', '', 'Итого', '', fmt(r.total)]);
      return csv(rows);
    };
    api.debtsCSV = () => {
      const rows = [['Клиент', 'Телефон', 'Абонемент', 'Куплен', 'Цена, ₸']];
      api.unpaidSubscriptions().sort((a, b) => (a.purchaseDate < b.purchaseDate ? 1 : -1)).forEach((s) => {
        const c = api.client(s.clientID);
        rows.push([c ? c.name : '—', c ? c.phone : '', s.tariffName, RU.shortDate(s.purchaseDate), s.price]);
      });
      return csv(rows);
    };

    /* ----- запуск ----- */
    api.reload = () => { load(); restoreSession(); api.emit(); };
    api.load = () => { const had = load(); restoreSession(); return had; };
    return api;
  }

  /** Сравнение версий X.Y.Z по числам: 1 — a новее, -1 — b новее, 0 — равны. */
  const STANDARD_QUESTIONS = ['Девичья фамилия матери?', 'Кличка вашего первого домашнего питомца?', 'Город, в котором вы родились?', 'Имя вашего лучшего школьного друга?', 'Ваше любимое блюдо в детстве?'];
  const normAnswer = (t) => String(t || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, '');
  function cmpVersion(a, b) {
    const pa = String(a).split('.').map((x) => parseInt(x, 10) || 0), pb = String(b).split('.').map((x) => parseInt(x, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length, 3); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d > 0 ? 1 : -1; }
    return 0;
  }
  /** Приводит телефон к виду «+7 701 234 56 78»; чужие коды стран не трогает. */
  function formatPhone(v) {
    v = String(v == null ? '' : v).trim(); if (!v) return '';
    if (/^\+/.test(v) && !/^\+7/.test(v) && v.replace(/\D/g, '').length > 0 && v[1] !== '7') return v;
    let d = v.replace(/\D/g, '');
    if (!d) return '';
    if (/^\+/.test(v) || d[0] === '8' || (d.length === 11 && d[0] === '7')) d = d.slice(1);
    d = d.slice(0, 10);
    let out = '+7'; if (d.length) out += ' ' + d.slice(0, 3); if (d.length > 3) out += ' ' + d.slice(3, 6);
    if (d.length > 6) out += ' ' + d.slice(6, 8); if (d.length > 8) out += ' ' + d.slice(8, 10);
    return out;
  }

  return { createStore, cmpVersion, formatPhone, RU, APP_VERSION, KEYS, memoryStorage, uid, STANDARD_QUESTIONS };
});
