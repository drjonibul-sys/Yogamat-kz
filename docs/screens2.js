/* Йога-студия yoga_matkz — доход, платежи, долги, тарифы, аренда, нагрузка, настройки, аккаунт */
(function () {
  'use strict';
  const { RU } = Studio;
  const { h, clear, icon, avatar, pill, empty, bar, chip, field, input, select, toggle, num, moneyInput, sheet, confirmBox, toast, formSheet } = UI;
  const App = window.App; const store = App.store; const { page, section, row, listRow, navRow } = App;
  const gate = (build) => (...a) => (store.isAdmin ? build(...a) : page('Нет доступа', { back: '/overview' }, empty('key', 'Только для администратора', 'Этот раздел доступен администратору студии.')));

  /* выбор года и месяца */
  function periodPicker(state, onchange, withMonth) {
    const cy = new Date().getFullYear(); const years = [cy - 2, cy - 1, cy, cy + 1];
    store.receiptYears().forEach((y) => { if (!years.includes(y)) years.push(y); }); years.sort((a, b) => b - a);
    const y = select(years.map((v) => ({ value: v, label: String(v) })), state.year, (e) => { state.year = +e.target.value; onchange(); });
    const m = select(RU.months.map((n, i) => ({ value: i + 1, label: n })), state.month, (e) => { state.month = +e.target.value; onchange(); });
    return h('div', { class: 'row' }, withMonth === false ? null : h('div', { class: 'grow' }, m), h('div', { style: { width: '110px', flex: 'none' } }, y));
  }
  const nowState = () => ({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });

  /* столбчатая диаграмма по месяцам (SVG) */
  function barChart(values, selected) {
    const W = 360, Hh = 150, pad = 18, bw = 20, gap = (W - pad * 2 - bw * 12) / 11; const max = Math.max.apply(null, values.map(Math.abs).concat([1]));
    const ns = 'http://www.w3.org/2000/svg'; const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + (Hh + 22)); svg.setAttribute('class', 'chart'); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Поступления по месяцам');
    const el = (n, a, t) => { const e = document.createElementNS(ns, n); Object.keys(a).forEach((k) => e.setAttribute(k, a[k])); if (t != null) e.textContent = t; svg.appendChild(e); return e; };
    el('line', { x1: pad, x2: W - pad, y1: Hh, y2: Hh, class: 'axis' });
    values.forEach((v, i) => {
      const x = pad + i * (bw + gap); const hh = Math.max(v ? 3 : 0, Math.abs(v) / max * (Hh - 30));
      el('rect', { x, y: Hh - hh, width: bw, height: hh, rx: 6, class: 'bar-fill' + (i + 1 === selected ? ' cur' : '') + (v < 0 ? ' neg' : '') });
      el('text', { x: x + bw / 2, y: Hh + 14, 'text-anchor': 'middle' }, RU.monthsShort[i].slice(0, 3));
      if (v && (i + 1 === selected || Math.abs(v) === max)) el('text', { x: x + bw / 2, y: Hh - hh - 4, 'text-anchor': 'middle', style: 'font-weight:700' }, RU.shortAxis(v));
    });
    return svg;
  }

  /* ---------- Доход ---------- */
  function income() {
    const st = nowState(); const box = h('div', { class: 'stack' });
    const draw = () => {
      clear(box);
      const rec = store.receipts(st.year, st.month); const rent = store.rentExpense(st.year, st.month); const net = rec - rent;
      const prev = RU.addMonths(-1, st.year, st.month); const prevRec = store.receipts(prev.year, prev.month);
      const change = prevRec > 0 ? Math.round((rec - prevRec) / prevRec * 100) : null;
      box.appendChild(periodPicker(st, draw));
      box.appendChild(h('div', { class: 'card tint' }, h('div', { class: 'soft small' }, 'Поступления · ' + RU.months[st.month - 1] + ' ' + st.year), h('div', { class: 'title num' }, RU.money(rec)),
        h('div', { class: 'small soft' }, store.paidCount(st.year, st.month) + ' ' + RU.payments(store.paidCount(st.year, st.month)) + (change == null ? '' : ' · ' + (change > 0 ? '+' : '') + change + '% к прошлому месяцу'))));
      box.appendChild(h('div', { class: 'card' }, row('Поступления', RU.money(rec)), row('Аренда студии', '− ' + RU.money(rent)), h('div', { class: 'row between', style: { borderTop: '1px solid var(--hairline)', paddingTop: '10px' } }, h('b', null, 'Итог'), h('b', { class: 'num', style: { color: net < 0 ? 'var(--danger)' : 'var(--sage-deep)' } }, RU.money(net)))));
      const monthly = store.monthlyReceipts(st.year); const year = store.receiptsYear(st.year); const months = monthly.filter((v) => v > 0).length;
      box.appendChild(section('По месяцам'));
      box.appendChild(h('div', { class: 'card' }, barChart(monthly, st.month), h('div', { class: 'row between' }, h('div', null, h('div', { class: 'soft small' }, 'За год'), h('b', { class: 'num' }, RU.millions(year))), h('div', null, h('div', { class: 'soft small' }, 'Средний месяц'), h('b', { class: 'num' }, RU.millions(months ? year / months : 0))), h('div', null, h('div', { class: 'soft small' }, 'Чистый за год'), h('b', { class: 'num' }, RU.millions(store.netIncomeYear(st.year)))))));
      const missing = store.paidWithoutDate();
      if (missing.length) box.appendChild(h('div', { class: 'card warn' }, h('div', { class: 'small' }, 'Абонементов с оплатой без даты: ' + missing.length + '. В доход они не входят — укажите дату оплаты в карточке клиента.')));
      box.appendChild(h('div', { class: 'card flat' }, navRow('money', 'Платежи', 'Все оплаты по датам', '/payments'), navRow('alert', 'Долги', 'Не отмечена оплата', '/debts'), navRow('key', 'Аренда студии', 'Ежемесячно', '/rent'),
        navRow('book', 'Тарифы', 'Цены и сроки абонементов', '/tariffs'), navRow('chart', 'Загрузка направлений', 'Занятия, визиты и заполняемость', '/class-load'), navRow('people', 'Тренеры', 'По нагрузке', '/trainer-load')));
    };
    draw(); return page('Доход', {}, box);
  }

  /* ---------- Отчёт по платежам: месяц / квартал / год / свободный период ---------- */
  function periodRange(kind, y, m, q, from, to) {
    const pad = (n) => String(n).padStart(2, '0'); const last = (yy, mm) => new Date(yy, mm, 0).getDate();
    if (kind === 'month') return [y + '-' + pad(m) + '-01', y + '-' + pad(m) + '-' + pad(last(y, m)), RU.months[m - 1] + ' ' + y];
    if (kind === 'quarter') { const a = (q - 1) * 3 + 1; return [y + '-' + pad(a) + '-01', y + '-' + pad(a + 2) + '-' + pad(last(y, a + 2)), q + ' квартал ' + y]; }
    if (kind === 'year') return [y + '-01-01', y + '-12-31', y + ' год'];
    return [from, to, RU.shortDate(from) + ' — ' + RU.shortDate(to)];
  }
  App.periodRange = periodRange;
  function reportSheet(st) {
    UI.sheet('Отчёт по платежам', (s) => {
      const d = new Date(); const state = { kind: 'month', year: st.year, month: st.month, quarter: Math.floor(d.getMonth() / 3) + 1, from: RU.key(new Date(d.getFullYear(), d.getMonth(), 1)), to: RU.key(d) };
      const body = h('div', { class: 'stack' }); s.body.appendChild(body);
      const draw = () => {
        clear(body); const seg = h('div', { class: 'seg' });
        [['month', 'Месяц'], ['quarter', 'Квартал'], ['year', 'Год'], ['custom', 'Период']].forEach(([k, l]) => seg.appendChild(chip(l, state.kind === k, () => { state.kind = k; draw(); })));
        body.appendChild(seg);
        const cy = d.getFullYear(); const years = [cy - 2, cy - 1, cy, cy + 1]; store.receiptYears().forEach((y) => { if (!years.includes(y)) years.push(y); }); years.sort((a, b) => b - a);
        const yearSel = select(years.map((v) => ({ value: v, label: String(v) })), state.year, (e) => { state.year = +e.target.value; draw(); });
        if (state.kind === 'month') body.appendChild(h('div', { class: 'row' }, h('div', { class: 'grow' }, select(RU.months.map((n, i) => ({ value: i + 1, label: n })), state.month, (e) => { state.month = +e.target.value; draw(); })), h('div', { style: { width: '110px', flex: 'none' } }, yearSel)));
        else if (state.kind === 'quarter') body.appendChild(h('div', { class: 'row' }, h('div', { class: 'grow' }, select([1, 2, 3, 4].map((q) => ({ value: q, label: q + ' квартал' })), state.quarter, (e) => { state.quarter = +e.target.value; draw(); })), h('div', { style: { width: '110px', flex: 'none' } }, yearSel)));
        else if (state.kind === 'year') body.appendChild(h('div', { style: { width: '140px' } }, yearSel));
        else {
          const f = input({ type: 'date', value: state.from, 'aria-label': 'С даты', onchange: (e) => { state.from = e.target.value; draw(); } }); const t = input({ type: 'date', value: state.to, 'aria-label': 'По дату', onchange: (e) => { state.to = e.target.value; draw(); } });
          body.appendChild(h('div', { class: 'row' }, h('div', { class: 'grow' }, field('С', f)), h('div', { class: 'grow' }, field('По', t))));
        }
        const [from, to, label] = periodRange(state.kind, state.year, state.month, state.quarter, state.from, state.to);
        const bad = !RU.isValidDay(from) || !RU.isValidDay(to) || from > to;
        const r = bad ? null : store.paymentsReport(from, to);
        body.appendChild(bad ? h('div', { class: 'card warn' }, 'Проверьте даты: начало должно быть не позже конца.') : h('div', { class: 'card tint' }, h('div', { class: 'soft small' }, label), h('div', { class: 'h2 num' }, 'Итого ' + RU.money(r.total)), h('div', { class: 'soft small' }, 'Оплат абонементов: ' + r.subs.length + (r.rent.length ? ' · аренда: ' + r.rent.length : ''))));
        body.appendChild(h('button', { class: 'btn', type: 'button', disabled: bad, onclick: () => Pdf.exportPDF('Платежи — ' + label, store.paymentsCSV(from, to), 'platezhi-' + from + '_' + to + '.pdf', store.state.studioName + ' · ' + label) }, icon('download'), 'Создать PDF (A4)'));
        body.appendChild(h('button', { class: 'btn soft-btn', type: 'button', disabled: bad, onclick: () => UI.saveFile('platezhi-' + from + '_' + to + '.csv', store.paymentsCSV(from, to), 'text/csv;charset=utf-8') }, icon('download'), 'Скачать CSV'));
      };
      draw();
    });
  }

  /* ---------- Платежи ---------- */
  function payments() {
    const st = nowState(); const box = h('div', { class: 'stack' });
    const draw = () => {
      clear(box); box.appendChild(periodPicker(st, draw));
      const prefix = RU.monthKey(st.year, st.month);
      const subs = store.paidSubscriptions().filter((s) => s.paidDate.startsWith(prefix)).sort((a, b) => (a.paidDate < b.paidDate ? 1 : -1));
      const rentPaid = store.state.rentPeriods.filter((p) => p.paid && p.year === st.year && p.month === st.month);
      const total = subs.reduce((s, x) => s + x.price, 0);
      box.appendChild(h('div', { class: 'card tint' }, h('div', { class: 'soft small' }, 'Всего за месяц'), h('div', { class: 'title num' }, RU.money(total))));
      if (!subs.length && !rentPaid.length) return box.appendChild(empty('money', 'За этот месяц платежей нет', ''));
      box.appendChild(section('Абонементы'));
      box.appendChild(subs.length ? h('div', { class: 'card flat' }, subs.map((s) => { const c = store.client(s.clientID); return listRow([h('div', { class: 'grow' }, h('div', { class: 'trunc', style: { fontWeight: 600 } }, c ? c.name + ' · ' + s.tariffName : s.tariffName), h('div', { class: 'soft small' }, RU.shortDate(s.paidDate))), h('b', { class: 'num' }, RU.money(s.price))], c ? () => App.go('/client/' + c.id) : null); }))
        : h('div', { class: 'card soft' }, 'Нет оплат абонементов'));
      if (rentPaid.length) { box.appendChild(section('Аренда')); box.appendChild(h('div', { class: 'card flat' }, rentPaid.map((p) => listRow([h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 } }, 'Аренда за ' + RU.months[p.month - 1].toLowerCase()), p.paidDate ? h('div', { class: 'soft small' }, 'оплачено ' + RU.longDay(p.paidDate)) : null), h('b', { class: 'num' }, '− ' + RU.money(store.state.rentSettings.monthlyAmount))])))); }
    };
    draw(); return page('Платежи', { back: '/income', right: h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Отчёт PDF за период', onclick: () => reportSheet(st) }, icon('download')) }, box);
  }

  /* ---------- Долги ---------- */
  function debts() {
    const list = store.unpaidSubscriptions().sort((a, b) => (a.purchaseDate < b.purchaseDate ? 1 : -1));
    const total = list.reduce((s, x) => s + x.price, 0);
    return page('Долги', { back: '/income', right: h('div', { class: 'row', style: { gap: '8px' } }, h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Выгрузить CSV', onclick: () => UI.saveFile('dolgi-' + App.today() + '.csv', store.debtsCSV(), 'text/csv;charset=utf-8') }, icon('download')), h('button', { class: 'btn sm', type: 'button', onclick: () => Pdf.exportPDF('Долги по абонементам', store.debtsCSV(), 'dolgi-' + App.today() + '.pdf') }, 'PDF')) },
      list.length ? h('div', { class: 'card warn' }, h('div', { class: 'soft small' }, 'Не отмечена оплата · новые сверху'), h('div', { class: 'title num' }, RU.money(total)), h('div', { class: 'small soft' }, list.length + ' абонементов')) : null,
      list.length ? h('div', { class: 'card flat' }, list.map((s) => { const c = store.client(s.clientID); return h('div', { class: 'list-row' }, h('button', { class: 'grow', type: 'button', style: { textAlign: 'left', minWidth: 0 }, onclick: () => c && App.go('/client/' + c.id) },
        h('div', { class: 'trunc', style: { fontWeight: 600 } }, c ? c.name : '—'), h('div', { class: 'soft small trunc' }, '«' + s.tariffName + '» · ' + RU.shortDate(s.purchaseDate) + ' · ' + RU.money(s.price))),
        h('button', { class: 'btn sm soft-btn', type: 'button', onclick: () => { store.setPaid(s.id, true); toast('Оплата отмечена'); } }, 'Оплачено')); }))
        : empty('check', 'Неоплаченных абонементов нет', 'Все продажи отмечены как оплаченные.'));
  }

  /* ---------- Тарифы ---------- */
  function tariffForm(t) {
    formSheet(t ? 'Тариф' : 'Новый тариф', 'Сохранить', (s) => {
      const name = input({ value: t ? t.name : '', placeholder: 'Например: 8 занятий / месяц', autocapitalize: 'sentences' });
      const visits = input({ type: 'number', inputmode: 'numeric', min: 1, value: t ? t.visitsCount : 8 }); const days = input({ type: 'number', inputmode: 'numeric', min: 1, value: t ? t.durationDays : 30 }); const price = moneyInput(t ? t.price : '');
      s.body.append(field('Название', name), h('div', { class: 'row' }, h('div', { class: 'grow' }, field('Занятий', visits, 'Безлимит — 999')), h('div', { class: 'grow' }, field('Срок, дней', days))), field('Цена, ₸', price));
      const extra = t ? [h('button', { class: 'btn danger', type: 'button', onclick: async () => { if (await confirmBox('Удалить тариф?', 'Уже проданные абонементы не изменятся.', 'Удалить тариф', true)) { store.deleteTariff(t.id); s.close(); } } }, 'Удалить тариф')] : [];
      return { extra, save() { const p = num(price.value); if (!isFinite(p)) throw new Error('Укажите цену числом'); store.saveTariff({ id: t ? t.id : undefined, name: name.value, visitsCount: Math.round(num(visits.value)), durationDays: Math.round(num(days.value)), price: p }); } };
    });
  }
  function tariffs() {
    const list = store.orderedTariffs();
    return page('Тарифы', { back: '/income', right: h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Новый тариф', onclick: () => tariffForm(null) }, icon('plus')) },
      list.length ? h('div', { class: 'card flat' }, list.map((t) => listRow([h('div', { class: 'avatar', style: { width: '42px', height: '42px' } }, t.visitsCount > 500 ? '∞' : String(t.visitsCount)), h('div', { class: 'grow' }, h('div', { class: 'trunc', style: { fontWeight: 600 } }, t.name), h('div', { class: 'soft small' }, t.durationDays + ' ' + RU.days(t.durationDays))), h('b', { class: 'num' }, RU.money(t.price))], () => tariffForm(t))))
        : empty('book', 'Тарифов пока нет', 'Добавьте тарифы — их можно будет выбирать при продаже абонемента.'));
  }

  /* ---------- Аренда ---------- */
  function rentSetup() {
    formSheet('Аренда студии', 'Включить учёт', (s) => {
      const amount = moneyInput(''); const d = new Date(); const start = select(RU.months.map((n, i) => ({ value: i + 1, label: n })), d.getMonth() + 1, () => {}); const y = input({ type: 'number', inputmode: 'numeric', value: d.getFullYear() });
      s.body.append(h('div', { class: 'soft' }, 'Укажите сумму аренды в месяц и месяц, с которого вести учёт. Оплаченная аренда вычитается из дохода.'), field('Ежемесячно, ₸', amount, 'Например: 200 000'), h('div', { class: 'row' }, h('div', { class: 'grow' }, field('Учёт с', start)), h('div', { style: { width: '110px' } }, field('Год', y))));
      return { save() { const a = num(amount.value); if (!isFinite(a)) throw new Error('Укажите сумму числом'); store.setupRent(a, Math.round(num(y.value)), +start.value); } };
    });
  }
  function rent() {
    const st = store.state.rentSettings;
    if (!st) return page('Аренда студии', { back: '/income' }, h('div', { class: 'card' }, h('div', { class: 'h3' }, 'Учёт аренды не настроен'), h('div', { class: 'soft' }, 'Включите учёт — приложение напомнит об оплате и учтёт аренду в итоговом доходе.'), h('button', { class: 'btn', type: 'button', onclick: rentSetup }, 'Настроить аренду')));
    const cur = store.pastAndCurrentRentPeriods(); const up = store.upcomingRentPeriods(); const missed = store.missedRentPeriods().map((p) => p.id); const cp = store.currentRentPeriod();
    const prow = (p) => { const late = missed.includes(p.id); return listRow([h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 } }, RU.months[p.month - 1] + ' ' + p.year), h('div', { class: 'soft small' }, p.paid ? 'оплачено' + (p.paidDate ? ' ' + RU.longDay(p.paidDate) : '') : (late ? 'просрочено' : (cp && cp.id === p.id ? 'текущий' : 'ожидает')))),
      p.paid ? pill('Оплачено') : (late ? pill('просрочено', 'warn') : null), h('button', { class: 'btn sm ' + (p.paid ? 'soft-btn' : ''), type: 'button', onclick: () => store.setRentPaid(p.id, !p.paid) }, p.paid ? 'Снять' : 'Оплатить')]); };
    return page('Аренда студии', { back: '/income' }, h('div', { class: 'card tint' }, h('div', { class: 'soft small' }, 'Ежемесячно'), h('div', { class: 'title num' }, RU.money(st.monthlyAmount)),
      row('Учёт с', RU.months[st.startMonth - 1].toLowerCase() + ' ' + st.startYear), row('Оплачено периодов', String(store.state.rentPeriods.filter((p) => p.paid).length)), row('Выплачено всего', RU.money(store.paidRentTotal()))),
      section('Текущий и прошлые месяцы'), h('div', { class: 'card flat' }, cur.map(prow)), up.length ? section('Предстоящие месяцы') : null, up.length ? h('div', { class: 'card flat' }, up.map(prow)) : null);
  }

  /* ---------- Нагрузка ---------- */
  function classLoad() {
    const st = nowState(); const box = h('div', { class: 'stack' });
    const draw = () => {
      clear(box); box.appendChild(periodPicker(st, draw)); const r = store.classLoad(st.year, st.month);
      if (!r.reports.length) return box.appendChild(empty('chart', 'Нет занятий в этом месяце', 'Учитываются уже прошедшие занятия по расписанию.'));
      box.appendChild(h('div', { class: 'card tint' }, h('div', { class: 'soft small' }, 'Средняя загрузка'), h('div', { class: 'title' }, r.average + '%'), h('div', { class: 'small soft' }, r.totalSessions + ' ' + RU.classes(r.totalSessions) + ' · ' + r.totalVisits + ' ' + RU.visits(r.totalVisits))));
      box.appendChild(h('div', { class: 'card flat' }, r.reports.map((x) => h('div', { class: 'list-row', style: { flexDirection: 'column', alignItems: 'stretch', gap: '8px' } },
        h('div', { class: 'row between' }, h('div', { class: 'trunc', style: { fontWeight: 600 } }, x.item.name), h('b', null, x.occupancy + '%')), bar(x.occupancy, x.occupancy < 30),
        h('div', { class: 'soft small' }, x.sessions + ' ' + RU.classes(x.sessions) + ' · ' + x.visits + ' ' + RU.visits(x.visits) + ' · мест ' + x.item.capacity)))));
    };
    draw(); return page('Загрузка направлений', { back: '/income' }, box);
  }
  function trainerLoad() {
    const st = nowState(); const box = h('div', { class: 'stack' });
    const draw = () => {
      clear(box); box.appendChild(periodPicker(st, draw)); const list = store.trainerLoad(st.year, st.month);
      box.appendChild(h('button', { class: 'btn soft-btn', type: 'button', onclick: () => trainerForm(null) }, icon('plus'), 'Добавить тренера'));
      if (!list.length) return box.appendChild(empty('people', 'Тренеров пока нет', 'Нажмите «Добавить тренера», затем назначьте его на направления в расписании.'));
      list.forEach((t) => box.appendChild(h('div', { class: 'card', role: 'button', tabindex: 0, style: { cursor: 'pointer' }, 'aria-label': 'Тренер ' + t.trainer.name + ': изменить', onclick: () => trainerForm(t.trainer) }, h('div', { class: 'row' }, avatar(t.trainer.name, 44), h('div', { class: 'grow' }, h('div', { class: 'h3' }, t.trainer.name), h('div', { class: 'soft small' }, (t.trainer.active ? '' : 'отключён · ') + (t.sessions ? t.sessions + ' ' + RU.classes(t.sessions) + ' · ' + t.visits + ' ' + RU.visits(t.visits) : 'в этом месяце занятий нет — назначьте на направления'))), h('b', null, t.occupancy + '%')), bar(t.occupancy),
        h('div', { class: 'stack s8' }, t.directions.map((d) => h('div', { class: 'row between small' }, h('span', { class: 'trunc' }, d.item.name), h('span', { class: 'soft' }, d.sessions + ' зан. · ' + d.visits + ' виз.')))))));
    };
    draw(); return page('Тренеры', { back: '/income' }, box);
  }

  /* ---------- Аккаунт ---------- */
  function pinFields() { return { a: input({ type: 'password', inputmode: 'numeric', maxlength: 8, placeholder: 'Текущий PIN', autocomplete: 'current-password' }), b: input({ type: 'password', inputmode: 'numeric', maxlength: 8, placeholder: 'Новый PIN (4–8 цифр)', autocomplete: 'new-password' }), c: input({ type: 'password', inputmode: 'numeric', maxlength: 8, placeholder: 'Повторите новый PIN', autocomplete: 'new-password' }) }; }
  function changePinForm() {
    const u = store.currentUser;
    formSheet('Сменить PIN', 'Сохранить PIN', (s) => { const f = pinFields(); s.body.append(field('Текущий PIN', f.a), field('Новый PIN', f.b), field('Повтор', f.c));
      return { async save() { if (f.b.value !== f.c.value) throw new Error('PIN не совпадает с повтором'); await store.changePIN(u.id, f.a.value, f.b.value); toast('PIN изменён'); } }; });
  }
  function trainerForm(user) {
    formSheet(user ? user.name : 'Новый тренер', user ? 'Сохранить' : 'Добавить тренера', (s) => {
      const name = input({ value: user ? user.name : '', placeholder: 'Например: Ольга Пак', autocapitalize: 'words' }); const pin = input({ type: 'password', inputmode: 'numeric', maxlength: 8, placeholder: user ? 'Новый PIN (если нужно сменить)' : 'PIN, 4–8 цифр', autocomplete: 'new-password' });
      s.body.append(field('Имя', name), field(user ? 'Новый PIN' : 'PIN для входа', pin));
      if (user) s.body.appendChild(toggle('Тренер работает', user.active, (v) => store.setStaffActive(user.id, v), 'Отключённый тренер не может войти'));
      const extra = user ? [h('button', { class: 'btn danger', type: 'button', onclick: async () => { if (await confirmBox('Удалить тренера?', user.name + ' будет убран из направлений.', 'Удалить тренера', true)) { store.deleteStaff(user.id); s.close(); } } }, 'Удалить тренера')] : [];
      return { extra, async save() { if (user) { store.updateStaffName(user.id, name.value); if (pin.value) await store.setPIN(user.id, pin.value); } else { await store.addTrainer(name.value, pin.value); toast('Тренер добавлен'); } } };
    });
  }
  function accountSheet() {
    const u = store.currentUser; if (!u) return;
    sheet('Аккаунт', (s) => {
      const draw = () => {
        clear(s.body);
        s.body.appendChild(h('div', { class: 'card' }, h('div', { class: 'row' }, avatar(u.name, 56), h('div', { class: 'grow' }, h('div', { class: 'h2' }, u.name), h('div', { class: 'soft small' }, u.role === 'admin' ? 'Администратор · полный доступ' : 'Тренер · свои занятия и клиенты')))));
        s.body.appendChild(h('div', { class: 'card flat' }, listRow([icon('key'), h('div', { class: 'grow' }, 'Сменить PIN')], changePinForm)));
        if (store.isAdmin) {
          s.body.appendChild(h('div', { class: 'row between' }, App.section('Тренеры'), h('button', { class: 'link', type: 'button', onclick: () => trainerForm(null) }, '+ Добавить')));
          const staff = store.state.staff.filter((x) => x.role === 'trainer');
          s.body.appendChild(staff.length ? h('div', { class: 'card flat' }, staff.map((t) => listRow([avatar(t.name, 38), h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 } }, t.name), h('div', { class: 'soft small' }, t.active ? 'работает' : 'отключён')), t.active ? null : pill('отключён', 'gray')], () => trainerForm(t))))
            : h('div', { class: 'card' }, h('div', { class: 'h3' }, 'Тренеров пока нет'), h('div', { class: 'soft small' }, 'Тренер входит по своему PIN и видит свои занятия; доход и удаление клиентов ему недоступны.')));
        }
        s.body.appendChild(h('button', { class: 'btn danger', type: 'button', onclick: () => { s.close(); store.logOut(); } }, icon('logout'), 'Выйти'));
      };
      draw(); const unsub = store.subscribe(() => { if (document.body.contains(s.el)) draw(); else unsub(); });
    });
  }
  App.accountSheet = accountSheet;

  /* ---------- Настройки ---------- */
  function settings() {
    const box = h('div', { class: 'stack' }); const thisYear = new Date().getFullYear();
    const draw = () => {
      clear(box);
      if (store.isAdmin) {
        const name = input({ value: store.state.studioName, 'aria-label': 'Название студии', onchange: (e) => { store.setStudioName(e.target.value); toast('Название сохранено'); } });
        const logoBox = h('div', { class: 'row', style: { gap: '14px' } }, h('img', { src: store.logoSrc(), alt: 'Логотип', width: 64, height: 64, style: { borderRadius: '14px', objectFit: 'contain', background: 'var(--card)', border: '1px solid var(--hairline)' } }),
          h('div', { class: 'grow stack s8' },
            h('button', { class: 'btn sm soft-btn', type: 'button', onclick: async () => { const d = await UI.pickLogo(); if (d == null) return toast('Не удалось прочитать картинку'); try { store.setStudioLogo(d); toast('Логотип обновлён'); draw(); } catch (e) { toast(e.message); } } }, icon('download'), 'Выбрать логотип'),
            store.state.studioLogo ? h('button', { class: 'link small', type: 'button', onclick: () => { store.setStudioLogo(null); toast('Возвращён стандартный логотип'); draw(); } }, 'Вернуть стандартный') : null));
        box.appendChild(h('div', { class: 'card' }, field('Название студии', name), logoBox, h('div', { class: 'hint' }, 'Логотип и название видны на Обзоре, фоне и экране входа. Иконка приложения на экране «Домой» не меняется.')));
      }
      box.appendChild(section('Оформление'));
      const cur = App.prefs.theme === 'light' || App.prefs.theme === 'dark' ? App.prefs.theme : 'system';
      const themeChips = h('div', { class: 'seg' });
      [['light', 'Светлая'], ['dark', 'Тёмная'], ['system', 'Как в системе']].forEach(([k, l]) => themeChips.appendChild(chip(l, cur === k, () => { App.setTheme(k); draw(); })));
      box.appendChild(h('div', { class: 'card' }, themeChips));
      box.appendChild(section('Расписание'));
      const trainerOnly = store.currentUser && store.currentUser.role === 'trainer';
      box.appendChild(h('div', { class: 'card' }, toggle('Скрывать прошедшие занятия', !!App.prefs.hidePast, (v) => App.setPref('hidePast', v), 'Только на сегодняшний день'),
        trainerOnly ? toggle('Только мои занятия', !!App.prefs.onlyMine, (v) => App.setPref('onlyMine', v)) : null));
      const ymState = { year: thisYear, month: new Date().getMonth() + 1 };
      box.appendChild(section('Табель визитов'));
      box.appendChild(h('div', { class: 'card' }, periodPicker(ymState, () => {}), h('button', { class: 'btn soft-btn', type: 'button', onclick: () => UI.saveFile('vizity-' + RU.monthKey(ymState.year, ymState.month) + '.csv', store.visitsCSV(ymState.year, ymState.month), 'text/csv;charset=utf-8') }, icon('download'), 'Скачать табель (CSV)'),
        h('button', { class: 'btn soft-btn', type: 'button', onclick: () => Pdf.exportPDF('Табель визитов — ' + RU.months[ymState.month - 1] + ' ' + ymState.year, store.visitsCSV(ymState.year, ymState.month), 'vizity-' + RU.monthKey(ymState.year, ymState.month) + '.pdf') }, icon('download'), 'Скачать табель (PDF, A4)'),
        h('div', { class: 'hint' }, 'Файл открывается в Excel и «Numbers».')));
      if (store.isAdmin) {
        box.appendChild(section('Данные'));
        box.appendChild(h('div', { class: 'card' },
          h('button', { class: 'btn soft-btn', type: 'button', onclick: () => { UI.saveFile('yogamat-baza-' + App.today() + '.json', store.exportJSON(), 'application/json'); toast('База сохранена в файл'); } }, icon('download'), 'Сохранить базу в файл JSON'),
          h('button', { class: 'btn soft-btn', type: 'button', onclick: async () => { const text = await UI.pickFile('.json,application/json'); if (text == null) return; if (!(await confirmBox('Восстановить базу из файла?', 'Текущие данные будут заменены. Перед этим создаётся резервная копия.', 'Восстановить', true))) return; try { store.importSnapshot(text); toast('База восстановлена'); draw(); } catch (e) { toast(e.message); } } }, icon('upload'), 'Восстановить базу из файла JSON'),
          h('div', { class: 'hint' }, 'Данные хранятся только на этом устройстве. Сохраняйте файл базы — например, раз в неделю.')));
        box.appendChild(section('Резервные копии'));
        const backups = store.backups();
        box.appendChild(h('div', { class: 'card' }, h('button', { class: 'btn', type: 'button', onclick: () => { try { store.createBackup(); toast('Копия создана'); draw(); } catch (e) { toast(e.message); } } }, 'Создать копию сейчас'),
          backups.length ? h('div', { class: 'card flat', style: { boxShadow: 'none' } }, backups.slice(0, 8).map((b) => listRow([h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 } }, RU.shortDate(RU.key(new Date(b.at))) + ' ' + RU.time(new Date(b.at))), h('div', { class: 'soft small' }, Math.max(1, Math.round(b.size / 1024)) + ' КБ · клиентов: ' + (b.data.clients || []).length)),
            h('button', { class: 'btn sm soft-btn', type: 'button', onclick: async () => { if (await confirmBox('Восстановить копию?', 'Текущие данные будут заменены данными копии от ' + RU.shortDate(RU.key(new Date(b.at))) + '.', 'Восстановить', true)) { try { store.restoreBackup(b.id); toast('Копия восстановлена'); draw(); } catch (e) { toast(e.message); } } } }, 'Вернуть'),
            h('button', { class: 'link danger small', type: 'button', onclick: () => { store.deleteBackup(b.id); draw(); } }, 'Удалить')]))) : h('div', { class: 'soft small' }, 'Копий пока нет. Раз в неделю при запуске создаётся автоматическая копия.')));
      }
      box.appendChild(section('О приложении'));
      box.appendChild(h('div', { class: 'card' }, row('Студия', store.state.studioName), row('Версия', Studio.APP_VERSION), h('div', { class: 'row between' }, h('span', { class: 'soft' }, 'Разработано'), h('em', null, 'yoga_matkz')),
        updateBlock(draw),
        h('div', { class: 'card flat', style: { boxShadow: 'none' } }, navRow('book', 'Вопрос-ответ / FAQ', 'Инструкция по приложению для вашей роли', '/faq')),
        h('div', { class: 'hint' }, 'Справочник асан: иллюстрации и источники указаны в карточках асан.')));
      box.appendChild(h('button', { class: 'btn danger', type: 'button', onclick: () => store.logOut() }, icon('logout'), 'Выйти'));
    };
    draw(); return page('Настройки', { back: '/overview' }, box);
  }

  function applyUpdate() {
    return (async () => { try { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map((r) => r.unregister())); const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k))); } catch (e) { /* ок */ } location.reload(); })();
  }
  App.applyUpdate = applyUpdate;
  function updateBlock(redraw) {
    const u = App.update; const box = h('div', { class: 'stack s8' });
    const line = h('div', { class: 'small' }, !u ? 'Проверка обновлений не выполнялась.' : u.state === 'new' ? 'Доступна новая версия ' + u.version + ' (установлена ' + Studio.APP_VERSION + ').' : u.state === 'same' ? 'Установлена актуальная версия ' + Studio.APP_VERSION + '. Версия на сайте: ' + u.version + '.' : u.state === 'older' ? 'Установленная версия (' + Studio.APP_VERSION + ') новее, чем на сайте (' + u.version + ').' : 'Не удалось проверить: нет связи с сайтом.');
    box.appendChild(line);
    if (u && u.state === 'new') box.appendChild(h('button', { class: 'btn', type: 'button', onclick: applyUpdate }, 'Обновить до ' + u.version));
    box.appendChild(h('button', { class: 'btn soft-btn', type: 'button', onclick: async () => { await App.checkUpdate(); redraw(); } }, 'Проверить обновление'));
    return box;
  }
  App.routes['/income'] = { tab: 'income', build: gate(income) };
  App.routes['/payments'] = { tab: 'income', build: gate(payments) };
  App.routes['/debts'] = { tab: 'income', build: gate(debts) };
  App.routes['/tariffs'] = { tab: 'income', build: gate(tariffs) };
  App.routes['/rent'] = { tab: 'income', build: gate(rent) };
  App.routes['/class-load'] = { tab: 'income', build: gate(classLoad) };
  /* ---------- Вопрос-ответ / FAQ ---------- */
  function faq() {
    const box = h('div', { class: 'stack' });
    Guide.forRole(store.isAdmin ? 'admin' : 'trainer').forEach(([part, topics]) => {
      box.appendChild(h('div', { class: 'faq-part' }, part));
      box.appendChild(h('div', { class: 'faq' }, topics.map(([q, paras]) => h('details', { class: 'faq-item' }, h('summary', null, h('span', null, q)), h('div', { class: 'faq-body' }, paras.map((p) => (p.startsWith('• ') ? h('div', { class: 'faq-li' }, p.slice(2)) : h('p', null, p))))))));
    });
    box.appendChild(h('div', { class: 'hint' }, 'Инструкция обновляется вместе с приложением (ред. ' + Guide.REV + ').'));
    return page('Вопрос-ответ / FAQ', { back: '/settings' }, box);
  }
  App.routes['/faq'] = { tab: 'overview', build: faq };
  App.routes['/trainer-load'] = { tab: 'income', build: gate(trainerLoad) };
  App.routes['/settings'] = { tab: 'overview', build: settings };
})();
