/* Йога-студия yoga_matkz — каркас, обзор, клиенты, визиты, классы */
(function () {
  'use strict';
  const { RU } = Studio;
  const { h, clear, icon, avatar, pill, statusPill, empty, bar, chip, footer, field, input, textarea, select, toggle, stepper, num, moneyInput, sheet, confirmBox, toast, formSheet } = UI;

  const store = Studio.createStore();
  const prefsKey = Studio.KEYS.prefs;
  const prefs = (() => { try { return JSON.parse(localStorage.getItem(prefsKey)) || {}; } catch (e) { return {}; } })();
  const setPref = (k, v) => { prefs[k] = v; try { localStorage.setItem(prefsKey, JSON.stringify(prefs)); } catch (e) { /* ок */ } };

  const App = { hasPrev: false, store, prefs, setPref, routes: {}, rerender: () => {}, go: (path) => { location.hash = '#' + path; } };
  window.App = App;
  const today = () => RU.key(new Date());
  const monthlyCard = (...kids) => h('div', { class: 'card' }, ...kids);

  /* ---------- каркас страницы ---------- */
  function page(title, opts, ...kids) {
    opts = opts || {};
    const head = h('div', { class: 'head' + (opts.back || opts.sticky ? ' sticky' : '') },
      opts.back ? h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Назад', onclick: () => (App.hasPrev ? history.back() : App.go(typeof opts.back === 'string' ? opts.back : '/overview')) }, icon('back')) : null,
      h('h1', { class: opts.back || opts.sticky ? '' : 'title' }, title), opts.right || null);
    return h('div', { class: 'page' }, head, ...kids);
  }
  const section = (t) => h('div', { class: 'sec-title' }, t);
  const row = (l, r) => h('div', { class: 'row between' }, h('span', { class: 'soft' }, l), h('b', { class: 'num' }, r));
  function listRow(children, onclick) {
    return onclick ? h('button', { class: 'list-row', type: 'button', onclick }, children, icon('chev', 'chev'))
      : h('div', { class: 'list-row' }, children);
  }
  const navRow = (ic, title, sub, path) => listRow([
    h('div', { class: 'avatar', style: { width: '38px', height: '38px' } }, icon(ic)),
    h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 } }, title), sub ? h('div', { class: 'soft small' }, sub) : null)
  ], () => App.go(path));
  const needAdmin = () => store.isAdmin;

  /* ---------- выбор клиента ---------- */
  function pickClient(title, candidates, onPick, note) {
    sheet(title, (s) => {
      let q = '';
      const list = h('div', { class: 'card flat' });
      const draw = () => {
        clear(list);
        const items = candidates().filter((c) => !q || c.name.toLowerCase().includes(q) || (c.phone || '').includes(q));
        if (!items.length) list.appendChild(h('div', { class: 'empty soft small' }, 'Никого не нашли'));
        items.forEach((c) => list.appendChild(listRow([avatar(c.name, 40), h('div', { class: 'grow' }, h('div', { class: 'trunc', style: { fontWeight: 600 } }, c.name), subLine(c))],
          () => { s.close(); onPick(c); })));
      };
      const subLine = (c) => {
        const sub = store.activeSubscription(c.id);
        return h('div', { class: 'soft small' }, sub ? 'Осталось ' + sub.visitsLeft + ' из ' + sub.visitsTotal + ' · до ' + RU.longDay(sub.expiryDate) : 'нет абонемента');
      };
      s.body.appendChild(h('div', { class: 'search' }, icon('search'), input({ placeholder: 'Найти клиента…', 'aria-label': 'Поиск', oninput: (e) => { q = e.target.value.trim().toLowerCase(); draw(); } })));
      if (note) s.body.appendChild(h('div', { class: 'hint' }, note));
      s.body.appendChild(list); draw();
    });
  }

  /* ---------- формы ---------- */
  function clientForm(client) {
    formSheet(client ? 'Клиент' : 'Новый клиент', 'Сохранить', (s) => {
      const name = input({ value: client ? client.name : '', placeholder: 'Имя и фамилия', autocapitalize: 'words' });
      const phone = UI.phoneInput(client ? client.phone : '');
      const since = input({ type: 'date', value: client ? client.since : today() });
      const note = textarea({ placeholder: 'Например: беременность, ограничения', value: client ? client.note : '' });
      s.body.append(field('Имя', name), field('Телефон', phone), field('Клиент с', since), field('Заметка', note));
      return { save() {
        const data = { name: name.value, phone: UI.phoneValue(phone), note: note.value, since: since.value };
        if (client) store.updateClient(client.id, data); else { const c = store.addClient(data); toast('Клиент добавлен'); App.go('/client/' + c.id); }
      } };
    });
  }

  /** Продажа абонемента: для нового клиента (clientID пустой) создаётся клиент вместе с абонементом. */
  function saleForm(clientID) {
    const fixed = clientID ? store.client(clientID) : null;
    formSheet(fixed ? 'Новый абонемент' : 'Быстрая продажа', fixed ? 'Сохранить абонемент' : 'Создать клиента и абонемент', (s) => {
      const tariffs = store.orderedTariffs();
      const name = input({ placeholder: 'Имя и фамилия', autocapitalize: 'words' });
      const phone = UI.phoneInput('');
      const tName = input({ placeholder: 'Например: 8 занятий / месяц' });
      const visits = input({ type: 'number', inputmode: 'numeric', min: 1, value: '8' });
      const days = input({ type: 'number', inputmode: 'numeric', min: 1, value: '30' });
      const price = moneyInput('');
      const bought = input({ type: 'date', value: today() });
      const expiry = input({ type: 'date', value: RU.addDays(30, today()) });
      const paidDate = input({ type: 'date', value: today() });
      const paidWrap = h('div', { class: 'field' }, h('label', null, 'Дата оплаты'), paidDate);
      let paid = true; paidWrap.hidden = !paid;
      const syncExpiry = () => { if (RU.isValidDay(bought.value) && num(days.value) >= 1) expiry.value = RU.addDays(Math.round(num(days.value)), bought.value); };
      const pick = select([{ value: '', label: tariffs.length ? 'Выбрать из тарифов…' : 'Тарифов пока нет — введите вручную' }].concat(tariffs.map((t) => ({ value: t.id, label: t.name + ' · ' + RU.money(t.price) }))), '', (e) => {
        const t = tariffs.find((x) => x.id === e.target.value); if (!t) return;
        tName.value = t.name; visits.value = t.visitsCount; days.value = t.durationDays; price.value = t.price; syncExpiry();
      });
      bought.addEventListener('change', syncExpiry); days.addEventListener('input', syncExpiry);
      if (!fixed) s.body.append(field('Клиент', name), field('Телефон', phone));
      else s.body.appendChild(h('div', { class: 'row' }, avatar(fixed.name, 40), h('b', null, fixed.name)));
      s.body.append(field('Тариф', pick), field('Название абонемента', tName),
        h('div', { class: 'row' }, h('div', { class: 'grow' }, field('Занятий', visits)), h('div', { class: 'grow' }, field('Срок, дней', days))),
        field('Цена, ₸', price),
        h('div', { class: 'row' }, h('div', { class: 'grow' }, field('Дата покупки', bought)), h('div', { class: 'grow' }, field('Действует до', expiry))),
        toggle('Оплачено', paid, (v) => { paid = v; paidWrap.hidden = !v; }), paidWrap);
      return { save() {
        const o = { tariffName: tName.value, purchaseDate: bought.value, expiryDate: expiry.value, visitsTotal: Math.round(num(visits.value)), price: num(price.value || '0'), paid, paidDate: paid ? paidDate.value : null };
        if (!isFinite(o.price)) throw new Error('Укажите цену числом');
        if (!(o.visitsTotal >= 1)) throw new Error('Занятий должно быть не меньше одного');
        if (fixed) { store.addSubscription(Object.assign(o, { clientID: fixed.id })); toast('Абонемент добавлен'); }
        else { const c = store.addQuickSale(Object.assign(o, { name: name.value, phone: UI.phoneValue(phone) })); toast('Клиент и абонемент сохранены'); App.go('/client/' + c.id); }
      } };
    });
  }

  function markVisitForm(initialClientID, initialClassID, initialDate) {
    formSheet('Отметить визит', 'Отметить', (s) => {
      let clientID = initialClientID || ''; let classID = initialClassID || '';
      const date = input({ type: 'date', value: initialDate || today() });
      const clientBox = h('div');
      const classSel = h('div');
      const info = h('div', { class: 'hint' });
      const drawClient = () => {
        clear(clientBox); const c = clientID && store.client(clientID);
        clientBox.appendChild(c
          ? h('div', { class: 'row' }, avatar(c.name, 40), h('div', { class: 'grow' }, h('b', null, c.name)), h('button', { class: 'btn sm soft-btn', type: 'button', onclick: choose }, 'Сменить'))
          : h('button', { class: 'btn soft-btn', type: 'button', onclick: choose }, 'Выбрать клиента'));
        const sub = c && store.activeSubscription(c.id);
        info.textContent = c ? (sub ? 'Спишется с «' + sub.tariffName + '», осталось ' + sub.visitsLeft : 'У клиента нет активного абонемента') : '';
      };
      const choose = () => pickClient('Клиенты с абонементом', () => store.clientsWithActiveSubscription(), (c) => { clientID = c.id; drawClient(); });
      const drawClass = () => {
        clear(classSel); const list = store.classesOn(date.value);
        const sel = select([{ value: '', label: 'Без привязки к занятию' }].concat(list.map((c) => ({ value: c.id, label: RU.classTime(c.startMinutes) + ' · ' + c.name + ' (' + store.bookedCount(c.id, date.value) + '/' + c.capacity + ')' }))), list.some((c) => c.id === classID) ? classID : '', (e) => { classID = e.target.value; });
        if (!list.some((c) => c.id === classID)) classID = '';
        classSel.appendChild(field('Занятие', sel));
      };
      date.addEventListener('change', drawClass);
      s.body.append(field('Клиент', clientBox), info, field('Дата', date), classSel);
      drawClient(); drawClass();
      return { save() {
        if (!clientID) throw new Error('Выберите клиента');
        if (!RU.isValidDay(date.value)) throw new Error('Укажите дату');
        if (classID) store.bookVisit(clientID, classID, date.value); else store.markVisit(clientID, date.value, null);
        toast('Визит отмечен');
      } };
    });
  }
  App.markVisitForm = markVisitForm;

  function transferForm(sub) {
    formSheet('Перенос срока', 'Продлить', (s) => {
      let days = 7;
      const date = input({ type: 'date', value: today() }); const note = input({ placeholder: 'Причина: болезнь, отъезд…' });
      s.body.append(h('div', { class: 'soft' }, '«' + sub.tariffName + '» действует до ' + RU.longDay(sub.expiryDate)),
        field('На сколько дней продлить', stepper(7, 1, 90, 1, (v) => { days = v; }, (v) => v + ' ' + RU.days(v))), field('Дата переноса', date), field('Причина', note));
      return { save() { store.addTransfer(sub.id, days, date.value, note.value); toast('Срок продлён'); } };
    });
  }
  /** Корректировка проданного абонемента (администратор). */
  function editSubForm(sub) {
    const c = store.client(sub.clientID);
    formSheet('Изменить абонемент', 'Сохранить', (s) => {
      const tName = input({ value: sub.tariffName }); const total = input({ type: 'number', inputmode: 'numeric', min: 1, value: String(sub.visitsTotal) }); const left = input({ type: 'number', inputmode: 'numeric', min: 0, value: String(sub.visitsLeft) });
      const bought = input({ type: 'date', value: sub.purchaseDate }); const expiry = input({ type: 'date', value: sub.expiryDate }); const price = moneyInput(String(sub.price));
      const paidDate = input({ type: 'date', value: sub.paidDate || today() }); const paidWrap = h('div', { class: 'field' }, h('label', null, 'Дата оплаты'), paidDate);
      let paid = !!sub.paid; paidWrap.hidden = !paid;
      s.body.append(h('div', { class: 'row' }, avatar(c ? c.name : '?', 40), h('b', null, c ? c.name : '—')), field('Название абонемента', tName),
        h('div', { class: 'row' }, h('div', { class: 'grow' }, field('Занятий всего', total)), h('div', { class: 'grow' }, field('Осталось', left))),
        field('Цена, ₸', price), h('div', { class: 'row' }, h('div', { class: 'grow' }, field('Дата покупки', bought)), h('div', { class: 'grow' }, field('Действует до', expiry))),
        toggle('Оплачено', paid, (v) => { paid = v; paidWrap.hidden = !v; }), paidWrap,
        h('div', { class: 'hint' }, 'Уже отмеченные визиты не меняются. «Осталось» правится вручную — проверьте число после изменения «Занятий всего».'));
      const del = h('button', { class: 'btn danger', type: 'button', onclick: async () => {
        if (!(await confirmBox('Удалить абонемент?', '«' + sub.tariffName + '» будет удалён. Это возможно, только если по нему нет визитов, пропусков и переносов.', 'Удалить', true))) return;
        try { store.deleteSubscription(sub.id); toast('Абонемент удалён'); s.close(); } catch (e) { s.error(e.message); } } }, icon('trash'), 'Удалить абонемент');
      return { extra: [del], save() {
        const o = { tariffName: tName.value, purchaseDate: bought.value, expiryDate: expiry.value, visitsTotal: Math.round(num(total.value)), visitsLeft: Math.round(num(left.value)), price: num(price.value || '0'), paid, paidDate: paid ? paidDate.value : null };
        if (!isFinite(o.price)) throw new Error('Укажите цену числом');
        store.updateSubscription(sub.id, o); toast('Абонемент изменён');
      } };
    });
  }

  function paidDateForm(sub) {
    formSheet('Дата оплаты', 'Сохранить', (s) => {
      const date = input({ type: 'date', value: sub.paidDate || today() });
      s.body.append(h('div', { class: 'soft' }, '«' + sub.tariffName + '» · ' + RU.money(sub.price)), field('Фактическая дата оплаты', date));
      return { save() { if (!RU.isValidDay(date.value)) throw new Error('Укажите дату'); store.setPaidDate(sub.id, date.value); } };
    });
  }
  App.paidDateForm = paidDateForm;

  /* ---------- Обзор ---------- */
  function overview() {
    const hr = new Date().getHours();
    const greet = hr < 12 ? 'Доброе утро' : hr < 18 ? 'Добрый день' : 'Добрый вечер';
    const u = store.currentUser; const cards = [];
    const stat = (ic, title, value, onclick) => h('button', { class: 'stat', type: 'button', onclick }, h('div', { class: 'ic' }, icon(ic)), h('b', { class: 'num' }, String(value)), h('span', null, title));
    const ending = store.endingSoon(); const tv = store.todayVisits();
    cards.push(h('div', { class: 'stats' }, stat('people', 'Клиентов', store.state.clients.length, () => App.go('/clients')),
      stat('calendar', 'Занятий сегодня', tv.length, () => App.go('/visits')), stat('alert', 'Заканчиваются', ending.length, () => document.getElementById('ending') && document.getElementById('ending').scrollIntoView({ behavior: 'smooth' }))));
    if (App.update && App.update.state === 'new') cards.push(h('div', { class: 'card tint' }, h('div', { class: 'h3' }, 'Доступна версия ' + App.update.version), h('div', { class: 'small soft' }, 'Установлена ' + Studio.APP_VERSION + '. Обновление применится после перезапуска.'), h('button', { class: 'btn', type: 'button', onclick: () => App.installUpdate() }, 'Обновить')));
    if (u && !store.hasQuestion(u.id)) cards.push(h('button', { class: 'card warn', type: 'button', style: { textAlign: 'left' }, onclick: () => App.questionForm() }, h('div', { class: 'row' }, icon('key'), h('div', { class: 'grow' }, h('div', { class: 'h3' }, 'Задайте контрольный вопрос'), h('div', { class: 'soft small' }, 'Без него забытый PIN не восстановить.')), icon('chev', 'chev'))));
    if (store.saveError) cards.push(h('div', { class: 'card warn' }, h('div', { class: 'row top' }, icon('alert'), h('div', { class: 'small' }, store.saveError))));
    cards.push(h('div', { class: 'row' },
      h('button', { class: 'btn', type: 'button', onclick: () => (store.isAdmin ? saleForm(null) : clientForm(null)) }, icon('plus'), 'Добавить клиента'),
      h('button', { class: 'btn soft-btn', type: 'button', onclick: () => markVisitForm() }, icon('check'), 'Отметить визит')));
    if (store.isAdmin && store.state.rentSettings) {
      const unpaid = store.unpaidRentPeriods();
      if (unpaid.length) {
        const missed = store.missedRentPeriods(); const cur = store.currentRentPeriod();
        const line = missed.length ? 'Просрочено: ' + missed.map((p) => RU.months[p.month - 1].toLowerCase()).join(', ') : (cur && !cur.paid ? 'Оплатите аренду за ' + RU.months[cur.month - 1].toLowerCase() : '');
        cards.push(h('button', { class: 'card warn', type: 'button', style: { textAlign: 'left' }, onclick: () => App.go('/rent') }, h('div', { class: 'row' }, icon('key'), h('div', { class: 'grow' }, h('b', null, 'Аренда · ' + RU.money(store.state.rentSettings.monthlyAmount)), h('div', { class: 'small soft' }, line)), icon('chev', 'chev'))));
      }
    }
    if (store.isAdmin) {
      const debts = store.unpaidSubscriptions();
      if (debts.length) {
        const rows = debts.sort((a, b) => (a.purchaseDate < b.purchaseDate ? 1 : -1)).slice(0, 4).map((s) => {
          const c = store.client(s.clientID); if (!c) return null;
          return h('div', { class: 'list-row' }, h('button', { class: 'grow', type: 'button', style: { textAlign: 'left', minWidth: 0 }, onclick: () => App.go('/client/' + c.id) },
            h('div', { class: 'trunc', style: { fontWeight: 600 } }, c.name), h('div', { class: 'soft small trunc' }, '«' + s.tariffName + '» · куплен ' + RU.shortDate(s.purchaseDate))),
            h('button', { class: 'btn sm soft-btn', type: 'button', onclick: () => { store.setPaid(s.id, true); toast('Оплата отмечена'); } }, 'Оплачено'));
        });
        cards.push(section('Ждут оплаты'), h('div', { class: 'card flat' }, rows), debts.length > 4 ? h('button', { class: 'link', type: 'button', onclick: () => App.go('/debts') }, 'Все долги (' + debts.length + ')') : null);
      }
    }
    // идут сейчас
    const nowMin = RU.minutesOf(new Date());
    const running = store.classesOn(today()).filter((c) => c.startMinutes <= nowMin && nowMin < c.startMinutes + c.durationMin);
    if (running.length) {
      cards.push(section('Сейчас'), h('div', { class: 'card flat' }, running.map((c) => listRow([h('div', { class: 'time' }, RU.classTime(c.startMinutes)),
        h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 } }, c.name), h('div', { class: 'soft small' }, store.trainerNames(c) + (c.hall ? ' · ' + c.hall : ''))),
        pill(store.bookedCount(c.id, today()) + '/' + c.capacity)], () => rosterSheet(c.id, today())))));
    }
    cards.push(section('Сегодня'));
    cards.push(tv.length ? h('div', { class: 'card flat' }, tv.map((v) => {
      const c = store.client(v.clientID); const k = v.classID && store.studioClass(v.classID);
      return listRow([avatar(c ? c.name : '?', 40), h('div', { class: 'grow' }, h('div', { class: 'trunc', style: { fontWeight: 600 } }, c ? c.name : '—'), h('div', { class: 'soft small trunc' }, (k ? k.name + ' · ' : '') + RU.time(new Date(v.createdAt))))], c ? () => App.go('/client/' + c.id) : null);
    })) : h('div', { class: 'card' }, h('div', { class: 'h3' }, 'Сегодня ещё никого не отметили'), h('div', { class: 'soft small' }, 'Отметьте визит — занятие спишется с абонемента клиента.')));
    cards.push(h('div', { id: 'ending' }), section('Заканчиваются'));
    cards.push(ending.length ? h('div', { class: 'card flat' }, ending.map((e) => listRow([avatar(e.client.name, 40), h('div', { class: 'grow' }, h('div', { class: 'trunc', style: { fontWeight: 600 } }, e.client.name), h('div', { class: 'soft small' }, e.reason + ' · до ' + RU.longDay(e.subscription.expiryDate)))], () => App.go('/client/' + e.client.id))))
      : h('div', { class: 'card' }, h('div', { class: 'soft' }, 'Пока ни у кого не заканчивается абонемент.')));
    cards.push(h('div', { class: 'card flat' }, navRow('book', 'Справочник асан', '200 поз с техникой и ограничениями', '/catalog'), navRow('lotus', 'Комплексы для занятий', '15 практик по уровням', '/practices')));

    const head = h('div', { class: 'row top' }, h('div', { class: 'grow stack s8' },
      h('div', { class: 'title' }, greet + (u ? ', ' + u.name.split(' ')[0] : '')), h('div', { class: 'soft' }, RU.weekdayTitle(new Date())),
      h('div', { class: 'row soft studio-line', style: { gap: '8px' } }, h('img', { src: store.logoSrc(), alt: '', width: 25, height: 25, style: { borderRadius: '7px', objectFit: 'contain' } }), store.state.studioName), App.offlineBadge()),
      h('button', { class: 'icon-btn help-btn', type: 'button', 'aria-label': 'Инструкция', title: 'Инструкция', onclick: () => App.go('/faq') }, '?'),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Настройки', onclick: () => App.go('/settings') }, icon('gear')),
      h('button', { class: 'avatar', type: 'button', 'aria-label': 'Мой аккаунт', onclick: () => App.accountSheet(), style: { width: '46px', height: '46px', border: '1px solid var(--sage)' } }, (u ? u.name : '?').trim()[0].toUpperCase()));
    return h('div', { class: 'page' }, head, ...cards);
  }

  /* ---------- Клиенты ---------- */
  function clientsPage() {
    let q = '';
    const list = h('div');
    const draw = () => {
      clear(list);
      const items = store.state.clients.filter((c) => !q || c.name.toLowerCase().includes(q) || (c.phone || '').replace(/\D/g, '').includes(q.replace(/\D/g, '') || '\u0000')).sort((a, b) => RU.compare(a.name, b.name));
      if (!store.state.clients.length) return list.appendChild(empty('people', 'Клиентов пока нет', 'Добавьте первого клиента вместе с абонементом.'));
      if (!items.length) return list.appendChild(empty('search', 'Ничего не нашли', 'Проверьте имя или номер телефона.'));
      list.appendChild(h('div', { class: 'card flat' }, items.map((c) => {
        const sub = store.activeSubscription(c.id); const last = store.subscriptionsOf(c.id)[0];
        return listRow([avatar(c.name, 44), h('div', { class: 'grow' }, h('div', { class: 'trunc', style: { fontWeight: 600 } }, c.name),
          h('div', { class: 'soft small trunc' }, sub ? sub.visitsLeft + ' из ' + sub.visitsTotal + ' · до ' + RU.longDay(sub.expiryDate) : (last ? 'нет активного абонемента' : 'нет абонемента'))),
          sub ? (sub.visitsLeft <= 2 ? pill('мало', 'warn') : null) : pill('нет', 'gray')], () => App.go('/client/' + c.id));
      })));
    };
    const search = h('div', { class: 'search' }, icon('search'), input({ placeholder: 'Поиск по имени или телефону', 'aria-label': 'Поиск', oninput: (e) => { q = e.target.value.trim().toLowerCase(); draw(); } }));
    draw();
    return page('Клиенты', { sticky: true, right: h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Новый клиент', onclick: () => clientForm(null) }, icon('plus')) },
      h('div', { class: 'row' }, store.isAdmin ? h('button', { class: 'btn', type: 'button', onclick: () => saleForm(null) }, 'Продать абонемент') : null,
        h('button', { class: 'btn soft-btn', type: 'button', onclick: () => { UI.saveFile('klienty-' + today() + '.csv', store.clientsCSV(), 'text/csv;charset=utf-8'); } }, icon('download'), 'CSV'),
        h('button', { class: 'btn soft-btn', type: 'button', onclick: () => Pdf.exportPDF('Клиенты студии', store.clientsCSV(), 'klienty-' + today() + '.pdf') }, icon('download'), 'PDF')),
      search, list);
  }

  function clientPage(id) {
    const c = store.client(id);
    if (!c) return page('Клиент', { back: '/clients' }, empty('people', 'Клиент не найден', 'Возможно, он был удалён.'));
    const subs = store.subscriptionsOf(c.id); const active = store.activeSubscription(c.id); const visits = store.visitsOf(c.id); const transfers = store.transfersOf(c.id);
    const kids = [];
    kids.push(h('div', { class: 'card' }, h('div', { class: 'row' }, avatar(c.name, 60), h('div', { class: 'grow' }, h('div', { class: 'h2' }, c.name), h('div', { class: 'soft small' }, 'Клиент с ' + RU.longDay(c.since))),
      h('button', { class: 'btn sm soft-btn', type: 'button', onclick: () => clientForm(c) }, 'Изменить')),
      c.phone ? h('div', { class: 'row' }, icon('user'), h('a', { class: 'link', href: 'tel:' + c.phone.replace(/[^+\d]/g, '') }, c.phone)) : null,
      c.note ? h('div', { class: 'soft' }, c.note) : null));
    const subCard = (s, isActive) => {
      const used = s.visitsTotal - s.visitsLeft; const pct = s.visitsTotal > 0 ? Math.round(used / s.visitsTotal * 100) : 0;
      return h('div', { class: 'card' },
        h('div', { class: 'row between' }, h('div', { class: 'h3 trunc' }, s.tariffName), statusPill(store, s)),
        h('div', { class: 'row between small' }, h('span', null, s.visitsTotal > 500 ? 'Безлимит' : 'Осталось ' + s.visitsLeft + ' из ' + s.visitsTotal), h('span', { class: 'soft' }, pct + '%')),
        bar(pct, isActive && s.visitsLeft <= 2),
        row('Срок', RU.shortDate(s.purchaseDate) + ' — ' + RU.shortDate(s.expiryDate)), row('Цена', RU.money(s.price)),
        h('div', { class: 'row between' }, h('div', { class: 'row', style: { gap: '8px' } }, pill(s.paid ? 'Оплачено' : 'Не оплачено', s.paid ? '' : 'warn'), s.paid && s.paidDate ? h('span', { class: 'soft small' }, RU.shortDate(s.paidDate)) : null),
          h('div', { class: 'row', style: { gap: '8px' } }, s.paid ? h('button', { class: 'link small', type: 'button', onclick: () => paidDateForm(s) }, 'Дата') : null,
            h('button', { class: 'btn sm soft-btn', type: 'button', onclick: () => { if (s.paid) store.setPaid(s.id, false); else store.setPaid(s.id, true); } }, s.paid ? 'Снять оплату' : 'Отметить оплату'))),
        isActive ? h('button', { class: 'btn soft-btn', type: 'button', onclick: () => transferForm(s) }, icon('repeat'), 'Перенести срок') : null,
        store.isAdmin ? h('button', { class: 'btn soft-btn', type: 'button', onclick: () => editSubForm(s) }, icon('edit'), 'Изменить абонемент') : null);
    };
    kids.push(section('Абонемент'));
    kids.push(active ? subCard(active, true) : h('div', { class: 'card warn' }, h('div', { class: 'h3' }, 'Нет активного абонемента'), h('div', { class: 'soft small' }, store.isAdmin ? 'Продайте новый — и клиента можно записывать на занятия.' : 'Новый абонемент оформляет администратор.')));
    kids.push(h('div', { class: 'row' }, store.isAdmin ? h('button', { class: 'btn', type: 'button', onclick: () => saleForm(c.id) }, 'Новый абонемент') : null,
      h('button', { class: 'btn soft-btn', type: 'button', onclick: () => markVisitForm(c.id) }, 'Отметить визит')));
    const past = subs.filter((s) => !active || s.id !== active.id);
    if (past.length) { kids.push(section('Прошлые абонементы')); past.forEach((s) => kids.push(subCard(s, false))); }
    kids.push(section('Посещения'));
    kids.push(visits.length ? h('div', { class: 'card flat' }, visits.slice(0, 40).map((v) => {
      const k = v.classID && store.studioClass(v.classID);
      return listRow([h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 } }, RU.longDay(v.date)), h('div', { class: 'soft small' }, k ? k.name : 'без привязки к занятию')),
        h('button', { class: 'link danger small', type: 'button', onclick: async () => { if (await confirmBox('Отменить визит?', 'Занятие вернётся на абонемент клиента.', 'Отменить визит', true)) { store.cancelBooking(v.id); toast('Визит отменён'); } } }, 'Отменить')]);
    })) : h('div', { class: 'card' }, h('div', { class: 'soft' }, 'Визитов пока нет.')));
    if (transfers.length) { kids.push(section('Переносы')); kids.push(h('div', { class: 'card flat' }, transfers.map((t) => listRow([h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 } }, '+' + t.days + ' ' + RU.days(t.days)), h('div', { class: 'soft small' }, RU.shortDate(t.date) + (t.note ? ' · ' + t.note : '')))])))); }
    if (store.isAdmin) kids.push(h('button', { class: 'btn danger', type: 'button', onclick: async () => {
      if (!(await confirmBox('Удалить клиента?', 'Вместе с абонементами, визитами и переносами. Перед удалением будет создана резервная копия.', 'Удалить клиента', true))) return;
      try { store.deleteClient(c.id); toast('Клиент удалён'); App.go('/clients'); } catch (e) { toast(e.message); }
    } }, icon('trash'), 'Удалить клиента'));
    return page(c.name, { back: '/clients' }, ...kids);
  }

  /* ---------- Визиты ---------- */
  function visitsJournal() {
    let q = '', mode = prefs.visitsMode || 'week';
    const list = h('div', { class: 'stack' });
    const draw = () => {
      clear(list); const t = today();
      const from = mode === 'today' ? t : mode === 'week' ? RU.addDays(-6, t) : mode === 'month' ? RU.addDays(-29, t) : '';
      const items = store.state.visits.filter((v) => (!from || v.date >= from) && (!q || (store.client(v.clientID) || { name: '' }).name.toLowerCase().includes(q)))
        .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : (a.createdAt < b.createdAt ? 1 : -1)));
      if (!items.length) return list.appendChild(empty('calendar', q ? 'Ничего не нашли' : 'Визитов пока нет', q ? '' : 'Отметьте первый визит — он появится здесь.'));
      const groups = []; items.forEach((v) => { const g = groups[groups.length - 1]; if (g && g.date === v.date) g.list.push(v); else groups.push({ date: v.date, list: [v] }); });
      groups.forEach((g) => {
        list.appendChild(h('div', { class: 'row between' }, section(RU.dayTitle(g.date)), h('span', { class: 'soft small' }, g.list.length + ' ' + RU.visits(g.list.length))));
        list.appendChild(h('div', { class: 'card flat' }, g.list.map((v) => {
          const c = store.client(v.clientID); const k = v.classID && store.studioClass(v.classID);
          return listRow([avatar(c ? c.name : '?', 40), h('div', { class: 'grow' }, h('div', { class: 'trunc', style: { fontWeight: 600 } }, c ? c.name : '—'),
            h('div', { class: 'soft small trunc' }, RU.time(new Date(v.createdAt)) + (k ? ' · ' + k.name : ''))),
            h('button', { class: 'link danger small', type: 'button', onclick: async () => { if (await confirmBox('Отменить визит?', 'Занятие вернётся на абонемент клиента.', 'Отменить визит', true)) { store.cancelBooking(v.id); toast('Визит отменён'); } } }, 'Отменить')]);
        })));
      });
    };
    const chips = h('div', { class: 'seg' });
    const drawChips = () => { clear(chips); [['today', 'Сегодня'], ['week', '7 дней'], ['month', '30 дней'], ['all', 'Все']].forEach(([k, l]) => chips.appendChild(chip(l, mode === k, () => { mode = k; setPref('visitsMode', k); drawChips(); draw(); }))); };
    drawChips(); draw();
    return [h('div', { class: 'search' }, icon('search'), input({ placeholder: 'Поиск по имени клиента', 'aria-label': 'Поиск', oninput: (e) => { q = e.target.value.trim().toLowerCase(); draw(); } })), chips, list];
  }

  /* ---------- Визиты: таблица недели (как в первоначальной версии) ---------- */
  const weekView = { start: null, classID: '', scroll: 0 }; /* состояние живёт вне построения экрана: экран перерисовывается после каждой отметки */
  /* Пропуск: занятие сгорело. Перенос и снятие — только вручную, для одного клиента и одной даты, с подтверждением. */
  function absenceSheet(c, date) {
    const a = store.absenceOn(c.id, date); if (!a) return;
    sheet('Пропуск занятия', (s) => {
      const draw = () => {
        clear(s.body); const cur = store.absenceOn(c.id, date); if (!cur) return s.close();
        const sub = store.subscription(cur.subscriptionID) || store.activeSubscription(c.id);
        s.body.appendChild(h('div', { class: 'card' }, h('div', { class: 'h3' }, c.name), h('div', { class: 'soft small' }, 'Пропуск: ' + RU.longDay(date)),
          cur.transferredTo ? h('div', { class: 'small' }, 'Занятие перенесено на ' + RU.longDay(cur.transferredTo) + '.') : h('div', { class: 'small' }, 'Занятие сгорело — с абонемента оно не возвращается.')));
        if (cur.transferredTo) {
          s.body.appendChild(h('div', { class: 'hint' }, 'На новую дату поставлено посещение. Если отменить запись на новую дату, перенос будет снят и занятие снова сгорит.'));
          s.body.appendChild(h('button', { class: 'btn danger', type: 'button', onclick: async () => { if (await confirmBox('Отменить перенос?', c.name + ': запись на ' + RU.longDay(cur.transferredTo) + ' будет удалена, занятие за ' + RU.longDay(date) + ' снова сгорит.', 'Отменить перенос', true)) { try { store.cancelBooking(cur.transferVisitID); toast('Перенос отменён'); } catch (e) { toast(e.message); } draw(); } } }, 'Отменить перенос'));
          return;
        }
        const nd = input({ type: 'date', value: '', min: RU.key(RU.addDaysToDate(RU.date(date), 1)), max: sub ? sub.expiryDate : '', 'aria-label': 'Дата переноса' });
        s.body.appendChild(field('Перенести занятие на дату (по желанию)', nd));
        s.body.appendChild(h('div', { class: 'hint' }, 'Перенос устанавливается только вручную: одному клиенту и на одну дату. На новую дату ставится посещение (занятие спишется там). Не позже окончания абонемента' + (sub ? ' (' + RU.longDay(sub.expiryDate) + ')' : '') + '.'));
        s.body.appendChild(h('button', { class: 'btn', type: 'button', onclick: async () => {
          s.error(''); if (!nd.value) return s.error('Выберите дату переноса');
          if (!(await confirmBox('Перенести занятие?', c.name + ': занятие от ' + RU.longDay(date) + ' переносится на ' + RU.longDay(nd.value) + '. Сгоревшее занятие возвращается, на новую дату ставится посещение.', 'Перенести'))) return;
          try { store.transferAbsence(c.id, date, nd.value); toast('Занятие перенесено на ' + RU.longDay(nd.value)); draw(); } catch (e) { s.error(e.message); }
        } }, 'Перенести на выбранную дату'));
        s.body.appendChild(h('button', { class: 'btn soft-btn', type: 'button', onclick: async () => { if (await confirmBox('Снять пропуск?', c.name + ': пропуск за ' + RU.longDay(date) + ' будет снят, занятие вернётся в абонемент.', 'Снять пропуск')) { try { store.clearAbsence(c.id, date); toast('Пропуск снят, занятие возвращено'); } catch (e) { toast(e.message); } s.close(); } } }, 'Снять пропуск (вернуть занятие)'));
        s.body.appendChild(h('button', { class: 'btn soft-btn', type: 'button', onclick: () => s.close() }, 'Оставить — занятие сгорает'));
      };
      draw();
    });
  }
  function weekGrid() {
    const t = today(); if (!weekView.start) weekView.start = RU.key(RU.startOfWeek(new Date()));
    const start = RU.date(weekView.start); const dates = []; for (let i = 0; i < 7; i++) dates.push(RU.key(RU.addDaysToDate(start, i)));
    if (weekView.classID && !store.studioClass(weekView.classID)) weekView.classID = '';
    const cf = weekView.classID;
    const shift = (days) => { weekView.start = RU.key(RU.addDaysToDate(RU.date(weekView.start), days)); App.rerender(); };
    const nav = h('div', { class: 'att-nav' },
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Предыдущая неделя', onclick: () => shift(-7) }, icon('chev', 'flip')),
      h('div', { class: 'att-lbl' }, RU.weekRange(start) + ' ' + RU.date(dates[6]).getFullYear()),
      h('button', { class: 'chip', type: 'button', onclick: () => { weekView.start = RU.key(RU.startOfWeek(new Date())); App.rerender(); } }, 'Сегодня'),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Следующая неделя', onclick: () => shift(7) }, icon('chev')));
    const filter = select([{ value: '', label: 'Все направления' }].concat(store.orderedClasses().map((c) => ({ value: c.id, label: c.name }))), cf, (e) => { weekView.classID = e.target.value; App.rerender(); });
    const clients = store.weekGridClients(dates);
    if (!clients.length) return [nav, filter, empty('people', 'Нет клиентов с действующим абонементом', 'Продайте абонемент — клиент появится в таблице недели.')];
    const th = (cls, ...kids) => h('th', { class: cls || '' }, ...kids);
    const head = h('tr', null, th('name-col', 'Клиент'), th('num-col left', 'Осталось'), th('num-col', 'Прошло'),
      ...dates.map((d, i) => { const dt = RU.date(d); return th(d === t ? 'today' : '', h('div', { class: 'day-head' }, h('div', { class: 'wd' }, RU.weekdayShort[i]), h('div', { class: 'dn' }, String(dt.getDate())), h('div', { class: 'mo' }, RU.monthsShort[dt.getMonth()]))); }), th('note-col', 'Примечание'));
    const totals = dates.map(() => 0);
    const rows = clients.map((c) => {
      const sub = store.activeSubscription(c.id);
      const left = sub ? (sub.visitsTotal > 500 ? '∞' : String(sub.visitsLeft)) : '—';
      const cells = dates.map((d, i) => {
        const v = store.state.visits.find((x) => x.clientID === c.id && x.date === d && (!cf || x.classID === cf));
        const ab = !v && store.absenceOn(c.id, d); const miss = !!ab; const moved = !!(ab && ab.transferredTo);
        if (v) totals[i]++;
        const td = h('td', { class: 'day-col' + (v ? ' done' : moved ? ' moved' : miss ? ' miss' : '') + (d === t && !v && !miss ? ' today' : ''), role: 'button', tabindex: '0', 'aria-label': c.name + ', ' + RU.longDay(d) + ': ' + (v ? 'посещение' : moved ? 'пропуск, занятие перенесено' : miss ? 'пропуск, занятие сгорело' : 'не отмечено'), title: moved ? 'Перенесено на ' + ab.transferredTo : '' },
          v ? '✓' : moved ? '↪' : miss ? '✕' : '');
        const act = () => { if (miss) return absenceSheet(c, d); try { store.cycleAttendance(c.id, d, cf || null); } catch (e) { toast(e.message); } };
        td.addEventListener('click', act); td.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
        return td;
      });
      const last = sub || store.subscriptionsOf(c.id).slice().sort((x, y) => (x.purchaseDate < y.purchaseDate ? 1 : -1))[0]; /* без действующего — последний абонемент */
      const pay = !last ? 'нет абонемента' : (last.paid ? 'Оплачено: ' + (last.paidDate ? RU.shortDate(last.paidDate) : 'дата не указана') : 'Не оплачено') + (sub ? '' : ' · абонемент завершён');
      const note = input({ value: c.attendanceNote || '', placeholder: 'Комментарий…', maxlength: 200, 'aria-label': 'Примечание: ' + c.name, onchange: (e) => { try { store.setAttendanceNote(c.id, e.target.value); } catch (er) { toast(er.message); } } });
      const passed = sub ? store.passedVisits(sub) : null;
      return h('tr', null, h('td', { class: 'name-col', onclick: () => App.go('/client/' + c.id) }, c.name),
        h('td', { class: 'num-col left' + (sub && sub.visitsLeft <= 2 && sub.visitsTotal <= 500 ? ' low' : '') }, left), h('td', { class: 'num-col' }, passed == null ? '—' : String(passed)), ...cells,
        h('td', { class: 'note-col' }, h('div', { class: 'pay-note' + (last && last.paid ? ' paid' : '') }, pay), note));
    });
    const foot = h('tr', { class: 'tot' }, h('td', { class: 'name-col' }, 'Всего за день'), h('td', { class: 'num-col' }), h('td', { class: 'num-col' }), ...totals.map((n) => h('td', null, n ? String(n) : '')), h('td', null));
    const wrap = h('div', { class: 'att-wrap' }, h('table', { class: 'att-table' }, h('thead', null, head), h('tbody', null, rows, foot)));
    wrap.addEventListener('scroll', () => { weekView.scroll = wrap.scrollLeft; }, { passive: true });
    requestAnimationFrame(() => { wrap.scrollLeft = weekView.scroll; });
    return [nav, filter, wrap, h('div', { class: 'hint' }, 'Нажмите на ячейку: ✓ посещение (занятие списывается) → ✕ пропуск (занятие сгорает). Нажатие на ✕ открывает окно: перенести занятие на конкретную дату, снять пропуск или оставить. ↪ — занятие перенесено вручную. Пропуск отмечается только за сегодня и прошедшие дни.')];
  }

  function visitsPage() {
    const view = prefs.visitsView === 'log' ? 'log' : 'week';
    const seg = h('div', { class: 'seg' }, chip('Неделя', view === 'week', () => { setPref('visitsView', 'week'); App.rerender(); }), chip('Журнал', view === 'log', () => { setPref('visitsView', 'log'); App.rerender(); }));
    return page('Визиты', { sticky: true, right: h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Отметить визит', onclick: () => markVisitForm() }, icon('plus')) }, seg, ...(view === 'week' ? weekGrid() : visitsJournal()));
  }

  /* ---------- Классы и расписание ---------- */
  function rosterSheet(classID, dateKey) {
    const item = store.studioClass(classID); if (!item) return;
    const s = sheet(item.name, (s) => {
      const draw = () => {
        clear(s.body); const booked = store.bookedVisits(classID, dateKey); const free = item.capacity - booked.length;
        s.body.appendChild(h('div', { class: 'card' },
          h('div', { class: 'row between' }, h('div', null, h('div', { class: 'h3' }, RU.longDay(dateKey) + ' · ' + RU.classTime(item.startMinutes)), h('div', { class: 'soft small' }, (store.trainerNames(item) || 'тренер не назначен') + (item.hall ? ' · ' + item.hall : ''))), pill(item.level, 'sand')),
          h('div', { class: 'row between small' }, h('span', null, 'Записаны: ' + booked.length + ' из ' + item.capacity), h('span', { class: 'soft' }, free > 0 ? 'свободно ' + free : 'мест нет')), bar(booked.length / item.capacity * 100, free <= 0),
          item.details ? h('div', { class: 'soft small' }, item.details) : null, item.equipment ? h('div', { class: 'small' }, h('b', null, 'Оборудование: '), item.equipment) : null));
        s.body.appendChild(section('Состав группы'));
        s.body.appendChild(booked.length ? h('div', { class: 'card flat' }, booked.map((v) => { const c = store.client(v.clientID); return listRow([avatar(c ? c.name : '?', 38), h('div', { class: 'grow trunc', style: { fontWeight: 600 } }, c ? c.name : '—'),
          h('button', { class: 'link danger small', type: 'button', onclick: async () => { if (await confirmBox('Отменить запись?', (c ? c.name : 'Клиент') + ' будет убран из группы, занятие вернётся на абонемент.', 'Отменить запись', true)) { store.cancelBooking(v.id); draw(); } } }, 'Убрать')]); }))
          : h('div', { class: 'card' }, h('div', { class: 'soft' }, 'Пока никто не записан')));
        const cand = () => store.clientsWithActiveSubscription().filter((c) => !store.state.visits.some((v) => v.clientID === c.id && v.date === dateKey));
        s.body.appendChild(h('div', { class: 'stack s8' },
          h('button', { class: 'btn', type: 'button', disabled: free <= 0, onclick: () => pickClient('Запись на занятие', cand, (c) => { try { store.bookVisit(c.id, classID, dateKey); toast(c.name + ' записан(а)'); } catch (e) { toast(e.message); } draw(); }, 'Спишется с ближайшего по сроку абонемента') }, icon('plus'), 'Записать ещё клиента'),
          h('button', { class: 'btn soft-btn', type: 'button', onclick: () => pickClient('Кого записывать постоянно?', () => store.clientsWithActiveSubscription(), (c) => repeatForm(c, item, dateKey, draw)) }, icon('repeat'), 'Записать на несколько недель')));
        if (store.isAdmin) s.body.appendChild(h('button', { class: 'btn soft-btn', type: 'button', onclick: () => { s.close(); classEditor(classID); } }, 'Изменить направление'));
      };
      draw(); s.redraw = draw;
    });
    return s;
  }
  function repeatForm(client, item, dateKey, after) {
    formSheet('Постоянная запись', 'Записать', (s) => {
      let weeks = 4; const days = item.weekdays.slice().sort().map((d) => RU.weekdayShort[d - 1]).join(', ');
      s.body.append(h('div', { class: 'row' }, avatar(client.name, 40), h('b', null, client.name)), h('div', { class: 'soft' }, 'Все занятия «' + item.name + '» (' + days + ') начиная с ' + RU.longDay(dateKey) + '. Занятия спишутся с абонемента, занятые и повторные дни пропускаются.'),
        field('На сколько недель', stepper(4, 1, 12, 1, (v) => { weeks = v; }, (v) => v + ' ' + RU.weeks(v))));
      return { save() { const r = store.repeatBooking(client.id, item.id, dateKey, weeks); toast('Записей: ' + r.created + (r.skipped ? ', пропущено: ' + r.skipped : '')); if (after) after(); } };
    });
  }

  function classEditor(classID) {
    const base = classID ? store.studioClass(classID) : { name: '', type: 'yoga', level: 'Лёгкий', durationMin: 60, capacity: 12, trainer: '', trainerIDs: [], hall: '', weekdays: [], startMinutes: 540, equipment: '', details: '', active: true };
    const cls = JSON.parse(JSON.stringify(base));
    formSheet(classID ? 'Направление' : 'Новое направление', 'Сохранить', (s) => {
      const name = input({ value: cls.name, placeholder: 'Например: Хатха-йога', autocapitalize: 'words' });
      const type = select([{ value: 'yoga', label: 'Йога' }, { value: 'pilates', label: 'Пилатес' }], cls.type, (e) => { cls.type = e.target.value; });
      const level = select(['Лёгкий', 'Средний', 'Продвинутый'].map((l) => ({ value: l, label: l })), cls.level, (e) => { cls.level = e.target.value; });
      const hall = input({ value: cls.hall, placeholder: 'Например: зал №1' }); const equip = input({ value: cls.equipment, placeholder: 'Например: коврик, блоки' });
      const details = textarea({ value: cls.details, placeholder: 'О чём занятие, кому подходит' });
      const time = input({ type: 'time', value: RU.classTime(cls.startMinutes) });
      const trainerText = input({ value: cls.trainer, placeholder: 'Например: Анна Ким' });
      const dayBtns = h('div', { class: 'days' }, RU.weekdayShort.map((d, i) => { const b = h('button', { class: 'day-btn' + (cls.weekdays.includes(i + 1) ? ' on' : ''), type: 'button', onclick: () => { const w = i + 1; cls.weekdays = cls.weekdays.includes(w) ? cls.weekdays.filter((x) => x !== w) : cls.weekdays.concat(w); b.classList.toggle('on'); } }, d); return b; }));
      const trainers = store.trainers; const tBox = trainers.length ? h('div', { class: 'stack s8' }, trainers.map((t) => toggle(t.name, (cls.trainerIDs || []).includes(t.id), (v) => { cls.trainerIDs = (cls.trainerIDs || []).filter((x) => x !== t.id); if (v) cls.trainerIDs.push(t.id); }))) : null;
      s.body.append(field('Название', name), h('div', { class: 'row' }, h('div', { class: 'grow' }, field('Тип', type)), h('div', { class: 'grow' }, field('Уровень', level))),
        field('Дни недели', dayBtns), field('Время начала', time),
        field('Длительность', stepper(cls.durationMin, 15, 180, 5, (v) => { cls.durationMin = v; }, (v) => v + ' мин')), field('Мест в группе', stepper(cls.capacity, 1, 60, 1, (v) => { cls.capacity = v; })),
        tBox ? field('Тренеры', tBox) : null, field(tBox ? 'Тренер (если не выбран выше)' : 'Тренер', trainerText), field('Зал', hall), field('Оборудование', equip), field('Описание', details),
        toggle('Направление проводится', cls.active, (v) => { cls.active = v; }));
      const extra = classID ? [h('button', { class: 'btn danger', type: 'button', onclick: async () => { if (await confirmBox('Удалить направление?', 'Записи клиентов сохранятся, но потеряют привязку к занятию.', 'Удалить', true)) { store.deleteClass(classID); s.close(); toast('Направление удалено'); } } }, 'Удалить занятие')] : [];
      return { extra, save() {
        const [hh, mm] = (time.value || '09:00').split(':').map(Number);
        Object.assign(cls, { name: name.value, hall: hall.value, equipment: equip.value, details: details.value, trainer: trainerText.value, startMinutes: hh * 60 + mm });
        store.saveClass(cls);
      } };
    });
  }

  function directionsSheet() {
    sheet('Направления', (s) => {
      const draw = () => {
        clear(s.body);
        if (store.isAdmin) s.body.appendChild(h('button', { class: 'btn', type: 'button', onclick: () => { s.close(); classEditor(null); } }, icon('plus'), 'Новое направление'));
        const list = store.orderedClasses();
        s.body.appendChild(h('div', { class: 'card flat' }, list.map((c) => listRow([h('div', { class: 'grow' }, h('div', { class: 'trunc', style: { fontWeight: 600 } }, c.name), h('div', { class: 'soft small trunc' }, (c.type === 'yoga' ? 'Йога' : 'Пилатес') + ' · ' + weekdaysLabel(c) + ' · ' + RU.classTime(c.startMinutes))),
          c.active ? pill(c.level, 'sand') : pill('не проводится', 'gray')], store.isAdmin ? () => { s.close(); classEditor(c.id); } : null))));
        s.body.appendChild(h('div', { class: 'hint' }, 'Направлений: ' + list.length));
      }; draw();
    });
  }
  const weekdaysLabel = (c) => (c.weekdays.length ? c.weekdays.slice().sort().map((d) => RU.weekdayShort[d - 1]).join(', ') : 'расписание не задано');

  function classesPage() {
    let mode = prefs.classesMode || 'week'; let active = new Date(); active.setHours(0, 0, 0, 0); let weekStart = RU.startOfWeek(active); let monthStart = new Date(active.getFullYear(), active.getMonth(), 1);
    const body = h('div', { class: 'stack' });
    const visibleFor = (weekday) => store.classesOnWeekday(weekday).filter((c) => !(prefs.onlyMine && !store.isAdmin && store.currentUser && store.currentUser.role === 'trainer') || store.isMine(c));
    const draw = () => {
      clear(body); const activeKey = RU.key(active); const isToday = activeKey === today();
      const modeChips = h('div', { class: 'seg' }, chip('Неделя', mode === 'week', () => { mode = 'week'; setPref('classesMode', mode); draw(); }), chip('Месяц', mode === 'month', () => { mode = 'month'; setPref('classesMode', mode); draw(); }));
      const label = mode === 'week' ? RU.weekRange(weekStart) : RU.monthTitle(monthStart);
      const shift = (n) => { if (mode === 'week') { weekStart = RU.addDaysToDate(weekStart, 7 * n); active = RU.addDaysToDate(active, 7 * n); } else { monthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() + n, 1); active = new Date(monthStart); } draw(); };
      body.appendChild(h('div', { class: 'row between' }, h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Назад', onclick: () => shift(-1) }, icon('back')), h('div', { class: 'h3' }, label),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Вперёд', onclick: () => shift(1) }, icon('chev'))));
      body.appendChild(modeChips);
      const dayBtn = (d) => { const k = RU.key(d); const has = visibleFor(RU.weekdayIndex(d)).length > 0;
        return h('button', { class: 'dbtn' + (k === activeKey ? ' on' : '') + (k === today() ? ' today' : ''), type: 'button', onclick: () => { active = d; if (mode === 'month') { mode = 'week'; weekStart = RU.startOfWeek(d); } draw(); } },
          h('span', null, RU.weekdayShort[RU.weekdayIndex(d) - 1]), h('b', null, String(d.getDate())), has ? h('i', { class: 'dot' }) : h('i', { style: { width: '5px', height: '5px' } })); };
      if (mode === 'week') body.appendChild(h('div', { class: 'weekstrip' }, Array.from({ length: 7 }, (_, i) => dayBtn(RU.addDaysToDate(weekStart, i)))));
      else body.appendChild(h('div', { class: 'mgrid' }, RU.weekdayShort.map((d) => h('div', { class: 'hd' }, d)), RU.monthGrid(monthStart).reduce((a, r) => a.concat(r), []).map((d) => d ? dayBtn(d) : h('div'))));
      let dayList = visibleFor(RU.weekdayIndex(active)); const nowMin = RU.minutesOf(new Date()); let passed = false;
      if (prefs.hidePast && isToday) { const f = dayList.filter((c) => c.startMinutes >= nowMin); passed = dayList.length > 0 && !f.length; dayList = f; }
      body.appendChild(section(RU.weekdayTitle(active)));
      if (!dayList.length) body.appendChild(empty('calendar', passed ? 'Занятия на сегодня прошли' : (prefs.onlyMine && !store.isAdmin ? 'Ваших занятий нет' : 'Свободный день'), passed ? '' : 'В этот день занятий нет.'));
      else body.appendChild(h('div', { class: 'card flat' }, dayList.map((c) => {
        const n = store.bookedCount(c.id, activeKey); const full = n >= c.capacity;
        return listRow([h('div', { class: 'time' }, RU.classTime(c.startMinutes)), h('div', { class: 'grow' }, h('div', { class: 'trunc', style: { fontWeight: 600 } }, c.name),
          h('div', { class: 'soft small trunc' }, (store.trainerNames(c) || 'тренер не назначен') + (c.hall ? ' · ' + c.hall : ''))), full ? pill('мест нет', 'warn') : pill(n + '/' + c.capacity)], () => rosterSheet(c.id, activeKey));
      })));
      if (store.isAdmin) {
        body.appendChild(h('button', { class: 'btn soft-btn', type: 'button', onclick: () => classEditor(null) }, icon('plus'), 'Добавить занятие'));
        const fb = store.futureBookings();
        body.appendChild(h('button', { class: 'btn danger', type: 'button', disabled: !fb.length, onclick: async () => {
          const n = store.futureBookings().length; const cl = new Set(store.futureBookings().map((v) => v.clientID)).size;
          if (!(await confirmBox('Отменить все будущие записи?', 'Будут отменены записи на все занятия после сегодняшнего дня: ' + n + ' ' + (n % 10 === 1 && n % 100 !== 11 ? 'запись' : 'записей') + ', клиентов: ' + cl + '. Занятия вернутся в абонементы клиентов. Расписание не меняется.', 'Отменить все', true))) return;
          try { const r = store.cancelFutureBookings(); toast('Отменено записей: ' + r.count); draw(); } catch (e) { toast(e.message); } } }, fb.length ? 'Отменить все будущие записи (' + fb.length + ')' : 'Будущих записей нет'));
      }
    };
    draw();
    return page('Классы', { sticky: true, right: h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Направления', onclick: directionsSheet }, icon('lotus')) }, body,
      h('button', { class: 'btn soft-btn', type: 'button', onclick: directionsSheet }, 'Все направления'));
  }

  Object.assign(App, { page, section, row, listRow, navRow, needAdmin, pickClient, saleForm, clientForm, rosterSheet, classEditor, directionsSheet, weekdaysLabel, monthlyCard, today });
  App.routes['/overview'] = { tab: 'overview', build: overview };
  App.routes['/clients'] = { tab: 'clients', build: clientsPage };
  App.routes['/client'] = { tab: 'clients', build: (id) => clientPage(id) };
  App.routes['/visits'] = { tab: 'visits', build: visitsPage };
  App.routes['/classes'] = { tab: 'classes', build: classesPage };
})();
