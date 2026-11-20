'use strict';
const assert = require('assert');
const { createStore, RU, memoryStorage, KEYS: Studio_KEYS } = require('../docs/store.js');

let t0 = new Date(2026, 10, 18, 12, 0); // 18 ноября 2026, среда
const mk = () => { t0 = new Date(2026, 10, 18, 12, 0); const s = createStore({ storage: memoryStorage(), now: () => t0, backupBeforeDelete: true }); s.load(); return s; };
let passed = 0;
const test = async (name, fn) => { try { await fn(); passed++; console.log('ok  ', name); } catch (e) { console.log('FAIL', name, '\n   ', e.message); process.exitCode = 1; } };
const throws = (fn, msg) => { try { fn(); } catch (e) { assert(e.message.includes(msg), 'ожидали «' + msg + '», получили «' + e.message + '»'); return; } assert.fail('не было ошибки: ' + msg); };
const rejects = async (p, msg) => { try { await p; } catch (e) { assert(e.message.includes(msg), 'ожидали «' + msg + '», получили «' + e.message + '»'); return; } assert.fail('не было ошибки: ' + msg); };
const sale = (s, extra) => s.addQuickSale(Object.assign({ name: 'Айгуль', phone: '+7 701', tariffName: '8 занятий', purchaseDate: '2026-11-10', expiryDate: '2026-12-10', visitsTotal: 8, price: 28000, paid: true, paidDate: '2026-11-10' }, extra));

(async () => {
  await test('даты: ключи, дни недели, плюрализация', () => {
    assert.strictEqual(RU.key(new Date(2026, 10, 18)), '2026-11-18');
    assert.strictEqual(RU.weekdayIndex(new Date(2026, 10, 18)), 3); // среда
    assert.strictEqual(RU.weekdayIndex(new Date(2026, 10, 22)), 7); // воскресенье
    assert.strictEqual(RU.addDays(14, '2026-11-18'), '2026-12-02');
    assert.strictEqual(RU.daysBetween('2026-11-18', '2026-11-23'), 5);
    assert.strictEqual(RU.isValidDay('2026-02-30'), false);
    assert.strictEqual(RU.classes(1) + RU.classes(2) + RU.classes(5) + RU.classes(11) + RU.classes(21), 'занятиезанятиязанятийзанятийзанятие');
    assert.strictEqual(RU.money(412000), '412 000 ₸');
    assert.strictEqual(RU.weekRange(RU.startOfWeek(new Date(2026, 10, 18))), '16–22 ноября');
  });

  await test('16 направлений по умолчанию: 10 йоги и 6 пилатеса', () => {
    const s = mk();
    assert.strictEqual(s.state.classes.length, 16);
    assert.strictEqual(s.state.classes.filter((c) => c.type === 'yoga').length, 10);
    assert.strictEqual(s.state.classes.filter((c) => c.type === 'pilates').length, 6);
    assert.strictEqual(s.state.classes.find((c) => c.name === 'Пилатес для начинающих').startMinutes, 11 * 60 + 30);
  });

  await test('быстрая продажа создаёт клиента и абонемент; ошибка откатывает клиента', () => {
    const s = mk(); const c = sale(s);
    assert.strictEqual(s.state.clients.length, 1);
    assert.strictEqual(s.subscriptionsOf(c.id)[0].visitsLeft, 8);
    throws(() => sale(s, { name: 'Бек', expiryDate: '2026-11-01' }), 'раньше даты покупки');
    assert.strictEqual(s.state.clients.length, 1);
    throws(() => sale(s, { name: '  ' }), 'Введите имя клиента');
  });

  await test('валидация абонемента', () => {
    const s = mk(); const c = s.addClient({ name: 'А' });
    const base = { clientID: c.id, tariffName: 'Т', purchaseDate: '2026-11-10', expiryDate: '2026-12-10', visitsTotal: 4, price: 100, paid: false };
    throws(() => s.addSubscription(Object.assign({}, base, { visitsTotal: 0 })), 'не меньше одного');
    throws(() => s.addSubscription(Object.assign({}, base, { price: -1 })), 'ноль или больше');
    throws(() => s.addSubscription(Object.assign({}, base, { paid: true, paidDate: null })), 'дату оплаты');
  });

  await test('отметка визита списывает занятие, дубль в тот же день запрещён', () => {
    const s = mk(); const c = sale(s);
    s.markVisit(c.id, '2026-11-18');
    assert.strictEqual(s.subscriptionsOf(c.id)[0].visitsLeft, 7);
    throws(() => s.markVisit(c.id, '2026-11-18'), 'уже отмечено');
    const c2 = s.addClient({ name: 'Без абонемента' });
    throws(() => s.markVisit(c2.id, '2026-11-18'), 'нет активного абонемента');
  });

  await test('списание идёт с абонемента с ближайшим сроком', () => {
    const s = mk(); const c = sale(s, { expiryDate: '2026-12-20' });
    const second = s.addSubscription({ clientID: c.id, tariffName: 'Короткий', purchaseDate: '2026-11-15', expiryDate: '2026-11-25', visitsTotal: 2, price: 1, paid: false });
    assert.strictEqual(s.activeSubscription(c.id).id, second.id);
  });

  await test('статусы: закончились, срок истёк, активен', () => {
    const s = mk(); const c = sale(s);
    const sub = s.subscriptionsOf(c.id)[0];
    assert.strictEqual(s.statusOf(sub), 'active');
    sub.visitsLeft = 0; assert.strictEqual(s.statusOf(sub), 'finished');
    sub.visitsLeft = 3; sub.expiryDate = '2026-11-17'; assert.strictEqual(s.statusOf(sub), 'expired');
  });

  await test('запись на занятие: места, дубли, отмена возвращает занятие', () => {
    const s = mk();
    const cls = s.saveClass({ name: 'Малая группа', type: 'yoga', level: 'Лёгкий', durationMin: 60, capacity: 2, trainer: '', hall: '', weekdays: [3], startMinutes: 600, equipment: '', details: '', active: true, trainerIDs: [] });
    const a = sale(s, { name: 'А' }), b = sale(s, { name: 'Б' }), c = sale(s, { name: 'В' });
    s.bookVisit(a.id, cls.id, '2026-11-18'); s.bookVisit(b.id, cls.id, '2026-11-18');
    throws(() => s.bookVisit(c.id, cls.id, '2026-11-18'), 'нет свободных мест');
    throws(() => s.bookVisit(a.id, cls.id, '2026-11-18'), 'уже записан');
    assert.strictEqual(s.bookedCount(cls.id, '2026-11-18'), 2);
    const v = s.bookedVisits(cls.id, '2026-11-18')[0];
    s.cancelBooking(v.id);
    assert.strictEqual(s.subscriptionsOf(a.id)[0].visitsLeft, 8);
    assert.strictEqual(s.bookedCount(cls.id, '2026-11-18'), 1);
    s.bookVisit(c.id, cls.id, '2026-11-18');
  });

  await test('постоянная запись на недели: считает созданные и пропущенные', () => {
    const s = mk();
    const cls = s.saveClass({ name: 'Пн/Ср', type: 'yoga', level: 'Лёгкий', durationMin: 60, capacity: 5, trainer: '', hall: '', weekdays: [1, 3], startMinutes: 600, equipment: '', details: '', active: true, trainerIDs: [] });
    const a = sale(s, { visitsTotal: 3 });
    const r = s.repeatBooking(a.id, cls.id, '2026-11-18', 2); // ср 18, пн 23, ср 25, пн 30 => 4 дня, но занятий 3
    assert.deepStrictEqual(r, { created: 3, skipped: 1 });
    assert.strictEqual(s.subscriptionsOf(a.id)[0].visitsLeft, 0);
    throws(() => s.repeatBooking(a.id, cls.id, '2026-11-18', 13), 'от 1 до 12');
  });

  await test('перенос продлевает срок абонемента', () => {
    const s = mk(); const c = sale(s); const sub = s.subscriptionsOf(c.id)[0];
    s.addTransfer(sub.id, 7, '2026-11-18', ' болезнь ');
    assert.strictEqual(sub.expiryDate, '2026-12-17');
    assert.strictEqual(s.transfersOf(c.id)[0].note, 'болезнь');
    throws(() => s.addTransfer(sub.id, 0, '2026-11-18', ''), 'от одного');
  });

  await test('сводка «заканчиваются»: по занятиям и по сроку', () => {
    const s = mk();
    sale(s, { name: 'Мало занятий', visitsTotal: 2 });
    sale(s, { name: 'Скоро срок', expiryDate: '2026-11-21' });
    sale(s, { name: 'Всё хорошо' });
    sale(s, { name: 'Завтра', expiryDate: '2026-11-19' });
    const e = s.endingSoon();
    const by = (n) => e.find((x) => x.client.name === n);
    assert.strictEqual(e.length, 3);
    assert.strictEqual(by('Мало занятий').reason, 'осталось 2 занятия');
    assert.strictEqual(by('Скоро срок').reason, 'истекает через 3 дня');
    assert.strictEqual(by('Завтра').reason, 'остался 1 день');
    assert.strictEqual(e[0].client.name, 'Мало занятий');
  });

  await test('доход: учитываются только оплаченные с датой; чистый доход = поступления − аренда', () => {
    const s = mk();
    sale(s, { paidDate: '2026-11-05', price: 28000 });
    sale(s, { name: 'Б', paid: false, paidDate: null, price: 16000 });
    sale(s, { name: 'В', paidDate: '2026-10-20', price: 10000 });
    assert.strictEqual(s.receipts(2026, 11), 28000);
    assert.strictEqual(s.receipts(2026, 10), 10000);
    assert.strictEqual(s.receiptsYear(2026), 38000);
    assert.strictEqual(s.paidCount(2026, 11), 1);
    assert.strictEqual(s.unpaidSubscriptions().length, 1);
    s.setupRent(200000, 2026, 10);
    const periods = s.rentPeriodsAscending();
    assert.strictEqual(periods[0].month, 10); assert.strictEqual(periods.length, 8); // окт 2026 … май 2027 (текущий + 6)
    s.setRentPaid(periods[1].id, true);
    assert.strictEqual(s.rentExpense(2026, 11), 200000);
    assert.strictEqual(s.netIncome(2026, 11), 28000 - 200000);
    assert.strictEqual(s.netIncomeYear(2026), 38000 - 200000);
    assert.strictEqual(s.unpaidRentPeriods().length, 1); // октябрь не оплачен
    assert.strictEqual(s.missedRentPeriods().length, 1);
    assert.strictEqual(s.upcomingRentPeriods().length, 6);
    assert.strictEqual(s.paidRentTotal(), 200000);
    throws(() => s.setupRent(1, 2026, 1), 'уже настроена');
  });

  await test('оплата: отметка ставит сегодняшнюю дату, снятие — убирает', () => {
    const s = mk(); const c = sale(s, { paid: false, paidDate: null }); const sub = s.subscriptionsOf(c.id)[0];
    s.setPaid(sub.id, true); assert.strictEqual(sub.paidDate, '2026-11-18');
    s.setPaidDate(sub.id, '2026-11-03'); assert.strictEqual(sub.paidDate, '2026-11-03');
    s.setPaid(sub.id, false); assert.strictEqual(sub.paidDate, null);
  });

  await test('нагрузка направлений: считает только прошедшие занятия', () => {
    const s = mk();
    const cls = s.saveClass({ name: 'Среды', type: 'yoga', level: 'Лёгкий', durationMin: 60, capacity: 4, trainer: '', hall: '', weekdays: [3], startMinutes: 600, equipment: '', details: '', active: true, trainerIDs: [] });
    const a = sale(s);
    s.bookVisit(a.id, cls.id, '2026-11-04');
    const r = s.classLoad(2026, 11).reports.find((x) => x.item.id === cls.id);
    assert.strictEqual(r.sessions, 3); // 4, 11, 18 ноября (25-е ещё впереди)
    assert.strictEqual(r.visits, 1);
    assert.strictEqual(r.occupancy, Math.round(1 / 12 * 100));
  });

  await test('удаление клиента: только админ, делает копию, чистит связанное', async () => {
    const s = mk(); const c = sale(s); s.markVisit(c.id, '2026-11-18');
    throws(() => s.deleteClient(c.id), 'только администратор');
    await s.setupAdmin('Анна', '1234', 'Город, в котором вы родились?', 'Астана');
    s.deleteClient(c.id);
    assert.strictEqual(s.state.clients.length, 0); assert.strictEqual(s.state.subscriptions.length, 0); assert.strictEqual(s.state.visits.length, 0);
    assert.strictEqual(s.backups().length, 1);
  });

  await test('PIN: вход, неверный PIN, блокировка на 30 с после 5 попыток', async () => {
    const s = mk();
    await rejects(s.setupAdmin('А', '12', 'Город, в котором вы родились?', 'Астана'), '4 до 8');
    const admin = await s.setupAdmin('Анна', '1234', 'Город, в котором вы родились?', 'Астана');
    assert(s.isAdmin); s.logOut(); assert(!s.currentUser);
    await rejects(s.logIn(admin.id, '0000'), 'Осталось попыток: 4');
    await s.logIn(admin.id, '1234'); assert(s.isAdmin); s.logOut();
    for (let i = 0; i < 4; i++) await rejects(s.logIn(admin.id, '1111'), 'Неверный PIN');
    await rejects(s.logIn(admin.id, '1111'), 'на 30 секунд');
    await rejects(s.logIn(admin.id, '1234'), 'заблокирован ещё');
    t0 = new Date(t0.getTime() + 31000);
    await s.logIn(admin.id, '1234'); assert(s.isAdmin);
  });

  await test('восстановление PIN по контрольному вопросу, лимит попыток, код отменён', async () => {
    const s = mk(); await rejects(s.setupAdmin('Анна', '1234', '', 'Астана'), 'Выберите контрольный вопрос'); await rejects(s.setupAdmin('Анна', '1234', 'Город?', 'ab'), 'не короче 3');
    const admin = await s.setupAdmin('Анна', '1234', 'Город, в котором вы родились?', 'Астана');
    assert.strictEqual(s.questionOf(admin.id), 'Город, в котором вы родились?'); assert(s.hasQuestion(admin.id)); s.logOut();
    await rejects(s.resetPINByAnswer(admin.id, 'Алматы', '5555'), 'Неверный ответ');
    await s.resetPINByAnswer(admin.id, '  аСТана!! ', '5555');
    await rejects(s.logIn(admin.id, '1234'), 'Неверный PIN'); await s.logIn(admin.id, '5555');
    await rejects(s.changePIN(admin.id, '0000', '7777'), 'Текущий PIN неверный');
    await s.changePIN(admin.id, '5555', '7777'); s.logOut(); await s.logIn(admin.id, '7777');
    for (let i = 0; i < 4; i++) await rejects(s.resetPINByAnswer(admin.id, 'x' + i + 'yz', '1111'), 'Осталось попыток');
    await rejects(s.resetPINByAnswer(admin.id, 'qwerty', '1111'), 'аблокировано'); assert(s.lockRemainingSeconds(admin.id) > 0);
    t0 = new Date(t0.getTime() + 31000); await s.resetPINByAnswer(admin.id, 'Астана', '2222');
    await s.setQuestion(admin.id, 'Свой вопрос?', 'Ответ один', '2222'); assert.strictEqual(s.questionOf(admin.id), 'Свой вопрос?'); await rejects(s.setQuestion(admin.id, 'Q?', 'Ответ', '0000'), 'PIN неверный');
    await s.clearQuestion(admin.id, '2222'); assert(!s.hasQuestion(admin.id)); await rejects(s.resetPINByAnswer(admin.id, 'Ответ один', '3333'), 'не задан');
    assert.strictEqual(typeof s.makeRecoveryCode, 'undefined'); assert.strictEqual(typeof s.resetPIN, 'undefined');
  });
  await test('старый код восстановления удаляется из хранилища; ответы не попадают в копии', async () => {
    const storage = memoryStorage(); const s = createStore({ storage, now: () => t0 }); s.load(); const admin = await s.setupAdmin('Анна', '1234', 'Город?', 'Астана');
    const p = JSON.parse(storage.getItem(Studio_KEYS.pins)); p['recovery.code'] = 'abc:def'; storage.setItem(Studio_KEYS.pins, JSON.stringify(p));
    const s2 = createStore({ storage, now: () => t0 }); s2.load(); s2.logOut(); await rejects(s2.logIn(admin.id, '9999'), 'Неверный PIN');
    assert(!('recovery.code' in JSON.parse(storage.getItem(Studio_KEYS.pins)))); assert(!JSON.stringify(s2.snapshot()).includes('Астана'));
  });

  await test('тренеры: добавление, отключение, удаление, права', async () => {
    const s = mk(); const admin = await s.setupAdmin('Анна', '1234', 'Город, в котором вы родились?', 'Астана');
    const tr = await s.addTrainer('Ольга Пак', '4321');
    const cls = s.state.classes[0]; cls.trainerIDs = [tr.id];
    assert.strictEqual(s.trainerNames(cls), 'Ольга Пак');
    s.setStaffActive(admin.id, false); assert(s.staffUser(admin.id).active, 'админа отключить нельзя');
    s.logOut(); await s.logIn(tr.id, '4321'); assert(!s.isAdmin); assert(s.currentUser.role === 'trainer');
    assert(s.isMine(cls));
    s.setStaffActive(tr.id, false); assert(!s.currentUser, 'отключённого выбрасывает из сессии');
    await rejects(s.logIn(tr.id, '4321'), 'отключён');
    s.setStaffActive(tr.id, true); s.deleteStaff(tr.id);
    assert.deepStrictEqual(cls.trainerIDs, []); assert.strictEqual(s.state.staff.length, 1);
  });

  await test('сессия переживает перезагрузку', async () => {
    const storage = memoryStorage();
    const a = createStore({ storage, now: () => t0 }); a.load();
    const admin = await a.setupAdmin('Анна', '1234', 'Город, в котором вы родились?', 'Астана');
    const b = createStore({ storage, now: () => t0 }); b.load();
    assert(b.isAdmin); assert.strictEqual(b.currentUser.id, admin.id);
  });

  await test('резервные копии, восстановление и проверка файла', () => {
    const s = mk(); sale(s); s.createBackup();
    const id = s.backups()[0].id;
    s.state.clients.length = 0; s.persist();
    s.restoreBackup(id);
    assert.strictEqual(s.state.clients.length, 1);
    throws(() => s.importSnapshot('не json'), 'не похож');
    const bad = JSON.parse(s.exportJSON()); bad.subscriptions[0].visitsLeft = 99;
    throws(() => s.importSnapshot(bad), 'некорректное число занятий');
    const bad2 = JSON.parse(s.exportJSON()); bad2.visits.push({ id: 'x', clientID: 'нет', subscriptionID: 'нет', date: '2026-11-18' });
    throws(() => s.importSnapshot(bad2), 'неизвестным клиентом');
    for (let i = 0; i < 30; i++) s.createBackup();
    assert.strictEqual(s.backups().length, 25);
  });

  await test('CSV: BOM, разделитель «;», экранирование и защита от формул', () => {
    const s = mk(); sale(s, { name: '=Опасный; "клиент"' });
    const csv = s.clientsCSV();
    assert(csv.startsWith('﻿Клиент;Телефон'));
    assert(csv.includes('"\'=Опасный; ""клиент"""'));
    assert(s.visitsCSV(2026, 11).split('\r\n').length === 1);
    assert(s.debtsCSV().split('\r\n').length === 1);
  });

  await test('данные сохраняются и читаются из хранилища', () => {
    const storage = memoryStorage();
    const a = createStore({ storage, now: () => t0 }); a.load(); sale(a); a.setStudioName('Моя студия');
    const b = createStore({ storage, now: () => t0 }); b.load();
    assert.strictEqual(b.state.clients.length, 1); assert.strictEqual(b.state.studioName, 'Моя студия');
  });

  await test('сравнение версий: числами, а не строками', () => {
    const { cmpVersion } = require('../docs/store.js');
    assert.strictEqual(cmpVersion('1.1.0', '1.1.0'), 0); assert.strictEqual(cmpVersion('1.10.0', '1.9.0'), 1);
    assert.strictEqual(cmpVersion('1.0.0', '1.0.1'), -1); assert.strictEqual(cmpVersion('2.0', '1.9.9'), 1); assert.strictEqual(cmpVersion('1.0', '1.0.0'), 0);
  });
  await test('телефон: подстановка +7 и форматирование', () => {
    const { formatPhone: f } = require('../docs/store.js');
    assert.strictEqual(f('87012345678'), '+7 701 234 56 78'); assert.strictEqual(f('+7 701 234 5678'), '+7 701 234 56 78');
    assert.strictEqual(f('701 234 56 78'), '+7 701 234 56 78'); assert.strictEqual(f('77012345678'), '+7 701 234 56 78');
    assert.strictEqual(f('+7 70'), '+7 70'); assert.strictEqual(f(''), ''); assert.strictEqual(f('+380 44 123'), '+380 44 123');
  });
  await test('логотип студии: только админ, проверка формата, сохранение, копия, возврат', async () => {
    const storage = memoryStorage(); const a = createStore({ storage, now: () => t0 }); a.load();
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    assert.strictEqual(a.logoSrc(), 'icons/logo.png');
    await a.setupAdmin('Анна', '1234', 'Город, в котором вы родились?', 'Астана');
    a.setStudioLogo(png); assert.strictEqual(a.logoSrc(), png);
    for (const bad of ['http://x/y.png', 'data:text/html;base64,AAAA', 'data:image/svg+xml;base64,AAAA', 'data:image/png;base64,' + 'A'.repeat(260000)]) assert.throws(() => a.setStudioLogo(bad), /Логотип/);
    const b = createStore({ storage, now: () => t0 }); b.load(); assert.strictEqual(b.logoSrc(), png);
    assert.strictEqual(a.snapshot().studioLogo, png);
    assert.throws(() => a.importSnapshot(Object.assign({}, a.snapshot(), { studioLogo: 'javascript:alert(1)' })), /логотип/);
    a.setStudioLogo(null); assert.strictEqual(a.logoSrc(), 'icons/logo.png');
  });
  await test('инструкция подключена и охватывает обе роли', () => {
    const fs = require('fs'); const d = __dirname + '/../docs/';
    assert(fs.readFileSync(d + 'index.html', 'utf8').includes('guide.js')); assert(fs.readFileSync(d + 'shell.js', 'utf8').includes('guide.js'));
    const src = fs.readFileSync(d + 'guide.js', 'utf8'); const rev = /GUIDE_REV = '([\d.]+)'/.exec(src)[1];
    assert(rev.split('.').length === 3); assert(src.includes('Как изменить название и логотип студии?') && src.includes('Как войти в приложение?'));
  });
  await test('новый тренер виден в «Тренеры» сразу, даже без занятий', async () => {
    const s = mk(); await s.setupAdmin('Анна', '1234', 'Город, в котором вы родились?', 'Астана'); await s.addTrainer('Новый Тренер', '4321');
    const r = s.trainerLoad(2026, 11).find((x) => x.trainer.name === 'Новый Тренер'); assert(r && r.sessions === 0 && r.occupancy === 0);
  });
  await test('тренер не может продавать абонементы и создавать классы; администратор может', async () => {
    const s = mk(); await s.setupAdmin('Анна', '1234', 'Город, в котором вы родились?', 'Астана'); const tr = await s.addTrainer('Новый Тренер', '4321');
    await s.logOut(); await s.logIn(tr.id, '4321'); assert(!s.isAdmin);
    assert.throws(() => sale(s), /только администратор/);
    assert.throws(() => s.saveClass({ name: 'Новое', type: 'yoga', level: 'Лёгкий', durationMin: 60, capacity: 10, weekdays: [1], startMinutes: 600, active: true }), /только администратор/);
    assert.throws(() => s.cancelFutureBookings(), /только администратор/);
  });
  await test('отмена всех будущих записей одним действием возвращает занятия', async () => {
    const s = mk(); await s.setupAdmin('Анна', '1234', 'Город, в котором вы родились?', 'Астана'); const c = sale(s); const cls = s.state.classes[0];
    const sub = s.state.subscriptions[0]; const before = sub.visitsLeft; const wd = cls.weekdays[0];
    let d = new Date(t0); d.setDate(d.getDate() + 1); while (RU.weekdayIndex(d) !== wd) d.setDate(d.getDate() + 1);
    s.bookVisit(c.id, cls.id, RU.key(d)); assert.strictEqual(s.futureBookings().length, 1); assert.strictEqual(sub.visitsLeft, before - 1);
    const r = s.cancelFutureBookings(); assert.strictEqual(r.count, 1); assert.strictEqual(s.futureBookings().length, 0); assert.strictEqual(sub.visitsLeft, before);
  });
  await test('отчёт по платежам: период, аренда и итог', async () => {
    const s = mk(); s.addQuickSale({ name: 'А', phone: '', tariffName: '8', visitsTotal: 8, purchaseDate: '2026-11-02', expiryDate: '2026-12-02', price: 28000, paid: true, paidDate: '2026-11-03' });
    s.addQuickSale({ name: 'Б', phone: '', tariffName: '8', visitsTotal: 8, purchaseDate: '2026-08-02', expiryDate: '2026-09-02', price: 10000, paid: true, paidDate: '2026-08-05' });
    assert.strictEqual(s.paymentsReport('2026-11-01', '2026-11-30').total, 28000); assert.strictEqual(s.paymentsReport('2026-07-01', '2026-12-31').total, 38000);
    assert(s.paymentsCSV('2026-07-01', '2026-12-31').includes('Итого')); assert.strictEqual(s.paymentsReport('2026-12-01', '2026-12-31').total, 0);
  });
  await test('название студии по умолчанию — yoga_matkz; прежнее по умолчанию переименовывается, своё сохраняется', () => {
    assert.strictEqual(mk().state.studioName, 'Студия yoga_matkz');
    const st = memoryStorage(); const a = createStore({ storage: st, now: () => t0 }); a.load(); a.importSnapshot(Object.assign({}, a.snapshot(), { studioName: 'Студия Yogamat.kz' }));
    assert.strictEqual(a.state.studioName, 'Студия yoga_matkz');
    a.importSnapshot(Object.assign({}, a.snapshot(), { studioName: 'Моя студия' })); assert.strictEqual(a.state.studioName, 'Моя студия');
  });
  const legacyFixture = () => ({ exportedAt: '2026-11-18T09:55:58.776Z',
    clients: [{ id: 'c1', name: 'Клиент Один', phone: '+7 700 000-00-01', notes: 'заметка', attendanceNote: 'по вторникам', createdAt: '2026-09-16' }, { id: 'c2', name: 'Клиент Два', phone: '', notes: '', createdAt: '2026-10-01' }],
    plans: [{ id: 'p1', name: '8 занятий / месяц', visitsCount: 8, durationDays: 30, price: 20000 }],
    subscriptions: [{ id: 's1', clientId: 'c1', planId: 'p1', purchaseDate: '2026-10-05', expiryDate: '2026-11-12', visitsTotal: 8, visitsLeft: 6, price: 20000, paid: true, paidDate: '2026-10-05' }, { id: 's2', clientId: 'c2', planId: 'p1', purchaseDate: '2026-11-02', expiryDate: '2026-12-02', visitsTotal: 8, visitsLeft: 8, price: 20000, paid: false, paidDate: null }],
    visits: [{ id: 'v1', clientId: 'c1', subscriptionId: 's1', date: '2026-10-06', createdAt: '2026-10-06T10:00:00.000Z' }, { id: 'v2', clientId: 'c1', subscriptionId: 's1', date: '2026-10-13', createdAt: '2026-10-13T10:00:00.000Z' }],
    transfers: [{ id: 't1', clientId: 'c1', subscriptionId: 's1', date: '2026-10-21', daysAdded: 2, comment: 'Отпуск' }],
    rent: { defaultAmount: 60000, startMonth: '2026-11', payments: [{ id: 'r1', month: '2026-11', amount: 60000, paid: true, paidDate: '2026-11-15' }, { id: 'r2', month: '2026-12', amount: 60000, paid: false, paidDate: null }] } });
  await test('импорт копии прежнего приложения (yoga-tracker): данные, аренда, сохранение аккаунтов', async () => {
    const s = mk(); await s.setupAdmin('Анна', '1234', 'Город?', 'Астана'); const staff = s.state.staff.length; const classes = s.state.classes.length;
    assert(s.isLegacyBackup(legacyFixture())); const r = s.importSnapshot(JSON.stringify(legacyFixture()));
    assert.deepStrictEqual([r.legacy, r.clients, r.subscriptions, r.visits, r.transfers], [true, 2, 2, 2, 1]);
    assert.strictEqual(s.state.clients[0].note, 'заметка\nпо вторникам'); assert.strictEqual(s.state.clients[1].note, ''); assert.strictEqual(s.state.clients[0].since, '2026-09-16');
    assert.strictEqual(s.state.subscriptions[0].tariffName, '8 занятий / месяц'); assert.strictEqual(s.state.subscriptions[0].clientID, 'c1'); assert.strictEqual(s.state.subscriptions[0].visitsLeft, 6);
    assert.strictEqual(s.state.transfers[0].days, 2); assert.strictEqual(s.state.transfers[0].note, 'Отпуск'); assert.strictEqual(s.state.tariffs.length, 1);
    assert.deepStrictEqual(s.state.rentSettings, { monthlyAmount: 60000, startYear: 2026, startMonth: 11 }); assert(s.state.rentPeriods.find((p) => p.year === 2026 && p.month === 11).paid);
    assert.strictEqual(s.state.staff.length, staff); assert.strictEqual(s.state.classes.length, classes); assert(s.currentUser, 'остался в системе');
    assert.strictEqual(s.paidSubscriptions().length, 1); assert.strictEqual(s.unpaidSubscriptions().length, 1);
    assert.strictEqual(s.importSnapshot(s.snapshot()).legacy, false);
  });
  await test('импорт копии прежнего приложения: повреждённый файл отклоняется понятной ошибкой', async () => {
    const s = mk(); await s.setupAdmin('Анна', '1234', 'Город?', 'Астана'); const bad = legacyFixture(); bad.subscriptions[0].clientId = 'нет';
    assert.throws(() => s.importSnapshot(bad), /без клиента/); const bad2 = legacyFixture(); bad2.visits[0].subscriptionId = 'нет'; assert.throws(() => s.importSnapshot(bad2), /неизвестным/);
    assert.strictEqual(s.state.clients.length, 0);
  });
  await test('офлайн: все файлы из shell.js существуют, скрипты index.html и sw.js согласованы', () => {
    const fs = require('fs'); const d = __dirname + '/../docs/'; const shell = fs.readFileSync(d + 'shell.js', 'utf8');
    const files = (/\[([\s\S]*?)\];/.exec(shell)[1].match(/'([^']+)'/g) || []).map((x) => x.slice(1, -1));
    for (const f of files) if (f !== './') assert(fs.existsSync(d + f), 'нет файла из списка офлайн: ' + f);
    const html = fs.readFileSync(d + 'index.html', 'utf8'); for (const m of html.matchAll(/<script src="([^"]+)"/g)) assert(files.includes(m[1]), 'скрипт не в списке офлайн: ' + m[1]);
    assert(files.includes('app.css') && files.includes('manifest.webmanifest') && files.includes('data/asanas.json'));
    const sw = fs.readFileSync(d + 'sw.js', 'utf8'); assert(sw.includes("importScripts('shell.js')") && sw.includes('IMG_CACHE'));
    const asanas = JSON.parse(fs.readFileSync(d + 'data/asanas.json', 'utf8')); for (const a of asanas) for (const k of ['a', 't']) assert(fs.existsSync(d + 'images/' + k + '/' + a.imageKey + '.webp'), 'нет картинки ' + a.imageKey);
  });
  await test('версия в version.json совпадает', () => {
    assert.strictEqual(JSON.parse(require('fs').readFileSync(__dirname + '/../docs/version.json', 'utf8')).version, require('../docs/store.js').APP_VERSION);
  });
  await test('PIN: старая запись (2000×SHA-256) принимается и тихо переходит на быстрый хэш', async () => {
    const crypto = require('crypto'); const st = memoryStorage();
    const s = createStore({ storage: st, now: () => t0 }); s.load();
    await s.setupAdmin('Анна', '4321', 'Город, в котором вы родились?', 'Астана'); const admin = s.state.staff[0]; s.logOut();
    // подменяем запись на формат прежней версии
    const salt = 'abc123'; let h = salt + ':4321'; for (let i = 0; i < 2000; i++) h = crypto.createHash('sha256').update(h + salt).digest('hex');
    const pk = Studio_KEYS.pins; const pins = JSON.parse(st.getItem(pk)); pins['pin.' + admin.id] = salt + ':' + h; st.setItem(pk, JSON.stringify(pins));
    await s.logIn(admin.id, '4321'); assert(s.isAdmin); s.logOut();
    assert(JSON.parse(st.getItem(pk))['pin.' + admin.id].startsWith('v2$'), 'запись должна обновиться');
    await s.logIn(admin.id, '4321'); assert(s.isAdmin); s.logOut();
    await rejects(s.logIn(admin.id, '0000'), 'Неверный PIN');
  });

  await test('таблица недели: ✓ → ✕ (занятие сгорает), снятие и ручной перенос, примечание, экспорт', async () => {
    const s = mk(); const c = sale(s); const sub = s.activeSubscription(c.id); const left0 = sub.visitsLeft;
    assert.strictEqual(s.cycleAttendance(c.id, '2026-11-17', null), 'visit'); assert.strictEqual(sub.visitsLeft, left0 - 1);
    assert.strictEqual(s.cycleAttendance(c.id, '2026-11-17', null), 'absent'); assert.strictEqual(sub.visitsLeft, left0 - 1, 'пропуск: занятие сгорает');
    assert.strictEqual(s.absencesCount(c.id), 1);
    throws(() => s.cycleAttendance(c.id, '2026-11-17', null), 'вручную'); // автоматического снятия нет
    s.clearAbsence(c.id, '2026-11-17'); assert.strictEqual(sub.visitsLeft, left0, 'снятие вручную возвращает занятие'); assert.strictEqual(s.absencesCount(c.id), 0);
    // будущий день: ✓ допустим (запись), второй клик снимает с возвратом, пропуск запрещён
    assert.strictEqual(s.cycleAttendance(c.id, '2026-11-20', null), 'visit'); assert.strictEqual(s.cycleAttendance(c.id, '2026-11-20', null), 'empty'); assert.strictEqual(sub.visitsLeft, left0);
    throws(() => s.markAbsence(c.id, '2026-11-20'), 'только за сегодня');
    // перенос вручную
    s.markVisit(c.id, '2026-11-16'); s.cycleAttendance(c.id, '2026-11-16', null); assert.strictEqual(sub.visitsLeft, left0 - 1);
    throws(() => s.transferAbsence(c.id, '2026-11-16', '2026-11-15'), 'позже даты пропуска');
    throws(() => s.transferAbsence(c.id, '2026-11-16', '2030-01-01'), 'окончания абонемента');
    s.transferAbsence(c.id, '2026-11-16', '2026-11-19'); const ab = s.absenceOn(c.id, '2026-11-16');
    assert.strictEqual(ab.transferredTo, '2026-11-19'); assert.strictEqual(sub.visitsLeft, left0 - 1, 'перенос: занятие списано один раз, на новую дату');
    assert(s.state.visits.some((v) => v.date === '2026-11-19')); assert.strictEqual(s.absencesCount(c.id), 0, 'перенесённый не считается пропуском');
    throws(() => s.clearAbsence(c.id, '2026-11-16'), 'перенесено');
    s.cancelBooking(ab.transferVisitID); assert.strictEqual(s.absenceOn(c.id, '2026-11-16').transferredTo, null); assert.strictEqual(sub.visitsLeft, left0 - 1, 'отмена переноса: занятие снова сгорело');
    assert.strictEqual(s.absencesCount(c.id), 1);
    s.markVisit(c.id, '2026-11-16'); assert.strictEqual(s.absencesCount(c.id), 0, 'пришёл — сгоревшее возвращено'); assert.strictEqual(sub.visitsLeft, left0 - 1);
    s.cancelBooking(s.state.visits.find((v) => v.date === '2026-11-16').id); s.markAbsence(c.id, '2026-11-16');
    s.setAttendanceNote(c.id, '  болела  '); assert.strictEqual(s.client(c.id).attendanceNote, 'болела');
    assert(s.weekGridClients(['2026-11-16', '2026-11-17']).some((x) => x.id === c.id));
    const snap = JSON.parse(JSON.stringify(s.snapshot())); assert.strictEqual(snap.absences.length, 1);
    const s2 = mk(); s2.importSnapshot(snap); assert.strictEqual(s2.absencesCount(c.id), 1); assert.strictEqual(s2.client(c.id).attendanceNote, 'болела');
    snap.absences[0].clientID = 'нет'; throws(() => mk().importSnapshot(snap), 'пропусках');
    await s.setupAdmin('Анна', '1234', 'Город, в котором вы родились?', 'Астана'); s.deleteClient(c.id); assert.strictEqual(s.state.absences.length, 0);
  });

  await test('корректировка проданного абонемента и «Прошло»', async () => {
    const s = mk(); const c = sale(s); const sub = s.activeSubscription(c.id);
    s.markVisit(c.id, '2026-11-17'); s.markVisit(c.id, '2026-11-18'); s.markVisit(c.id, '2026-11-25'); // третий — будущая запись
    assert.strictEqual(s.passedVisits(sub), 2, '«Прошло» — только наступившие дни'); assert.strictEqual(s.passedVisits(null), 0);
    const base = { tariffName: '12 занятий', purchaseDate: '2026-11-10', expiryDate: '2026-12-20', visitsTotal: 12, visitsLeft: 9, price: 35000, paid: false, paidDate: null };
    s.updateSubscription(sub.id, base); assert.strictEqual(sub.visitsTotal, 12); assert.strictEqual(sub.price, 35000); assert.strictEqual(sub.paid, false); assert.strictEqual(sub.paidDate, null);
    s.updateSubscription(sub.id, Object.assign({}, base, { paid: true, paidDate: '2026-11-12' })); assert.strictEqual(sub.paidDate, '2026-11-12');
    throws(() => s.updateSubscription(sub.id, Object.assign({}, base, { visitsLeft: 13 })), 'от 0 до 12');
    throws(() => s.updateSubscription(sub.id, Object.assign({}, base, { expiryDate: '2026-11-01' })), 'раньше даты покупки');
    throws(() => s.updateSubscription(sub.id, Object.assign({}, base, { tariffName: ' ' })), 'название');
    throws(() => s.updateSubscription(sub.id, Object.assign({}, base, { paid: true, paidDate: '' })), 'дату оплаты');
    throws(() => s.deleteSubscription(sub.id), 'нельзя');
    const c2 = sale(s, { name: 'Бота' }); const sub2 = s.activeSubscription(c2.id); s.deleteSubscription(sub2.id); assert(!s.subscription(sub2.id));
    const snap = s.snapshot(); const s2 = mk(); s2.importSnapshot(JSON.parse(JSON.stringify(snap))); assert.strictEqual(s2.subscription(sub.id).visitsTotal, 12);
    await s.setupAdmin('Анна', '1234', 'Город, в котором вы родились?', 'Астана'); await s.addTrainer('Ольга', '4321'); s.logOut();
    await s.logIn(s.state.staff.find((u) => u.role === 'trainer').id, '4321'); throws(() => s.updateSubscription(sub.id, base), 'только администратор'); throws(() => s.deleteSubscription(sub.id), 'только администратор');
  });

  await test('аренда: ручная корректировка периода, суммы, даты, настройки и начало учёта', async () => {
    const s = mk(); await s.setupAdmin('Анна', '1234', 'Город, в котором вы родились?', 'Астана');
    s.setupRent(200000, 2026, 9); s.refreshRentWindow();
    const per = (m) => s.state.rentPeriods.find((p) => p.year === 2026 && p.month === m);
    assert(per(9) && per(10) && per(11)); assert.strictEqual(s.rentAmount(per(9)), 200000);
    s.updateRentPeriod(per(9).id, { amount: 150000, paid: true, paidDate: '2026-09-05' });
    assert.strictEqual(per(9).paid, true); assert.strictEqual(per(9).paidDate, '2026-09-05'); assert.strictEqual(s.rentAmount(per(9)), 150000);
    s.setRentPaid(per(10).id, true); assert.strictEqual(per(10).amount, 200000, 'сумма фиксируется при оплате');
    assert.strictEqual(s.paidRentTotal(), 350000); assert.strictEqual(s.rentExpense(2026, 9), 150000);
    s.updateRentSettings({ monthlyAmount: 250000, startYear: 2026, startMonth: 8 });
    assert.strictEqual(s.rentAmount(per(10)), 200000, 'оплаченное не меняется'); assert.strictEqual(s.rentAmount(per(11)), 250000, 'неоплаченное — по новой сумме');
    assert(per(8), 'ранний месяц начала добавил период'); s.updateRentPeriod(per(8).id, { amount: 100000, paid: true, paidDate: '2026-08-03' }); assert.strictEqual(s.rentExpense(2026, 8), 100000);
    throws(() => s.updateRentSettings({ monthlyAmount: 1, startYear: 2026, startMonth: 11 }), 'оплаченные периоды');
    throws(() => s.updateRentPeriod(per(9).id, { amount: -5, paid: false }), 'сумму');
    throws(() => s.updateRentPeriod(per(9).id, { amount: 1, paid: true, paidDate: '' }), 'дату оплаты');
    throws(() => s.updateRentPeriod(per(9).id, { amount: 1, paid: true, paidDate: '2030-01-01' }), 'в будущем');
    s.updateRentPeriod(per(9).id, { amount: 150000, paid: false }); assert.strictEqual(per(9).paidDate, null); assert.strictEqual(s.rentExpense(2026, 9), 0);
    const r = s.paymentsReport('2026-08-01', '2026-10-31'); assert.strictEqual(r.rentSum, 100000, 'по дате оплаты: оплата сентября снята, октябрь оплачен ноября');
    assert(s.paymentsCSV('2026-08-01', '2026-10-31').includes('−100'), 'CSV берёт сумму периода');
    const snap = JSON.parse(JSON.stringify(s.snapshot())); const s2 = mk(); s2.importSnapshot(snap); assert.strictEqual(s2.rentAmount(s2.state.rentPeriods.find((p) => p.month === 8)), 100000);
    snap.rentPeriods[0].amount = -1; throws(() => mk().importSnapshot(snap), 'периодах аренды');
    await s.addTrainer('Ольга', '4321'); s.logOut(); await s.logIn(s.state.staff.find((u) => u.role === 'trainer').id, '4321');
    throws(() => s.updateRentPeriod(per(9).id, { amount: 1, paid: false }), 'только администратор'); throws(() => s.updateRentSettings({ monthlyAmount: 1, startYear: 2026, startMonth: 8 }), 'только администратор');
  });

  await test('версия в sw.js, store.js и index совпадает', () => {
    const fs = require('fs'); const sw = fs.readFileSync(__dirname + '/../docs/sw.js', 'utf8');
    assert.strictEqual(/VERSION = '([\d.]+)'/.exec(sw)[1], require('../docs/store.js').APP_VERSION);
    for (const f of ['index.html', 'manifest.webmanifest', 'app.js']) assert(fs.existsSync(__dirname + '/../docs/' + f), f);
  });

  console.log('\nПройдено тестов:', passed, process.exitCode ? '— есть ошибки' : '— всё хорошо');
})();
