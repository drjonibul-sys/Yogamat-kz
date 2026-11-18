'use strict';
const assert = require('assert');
const { createStore, RU, memoryStorage } = require('../docs/store.js');

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
    await s.setupAdmin('Анна', '1234', 'ABCD-EFGH');
    s.deleteClient(c.id);
    assert.strictEqual(s.state.clients.length, 0); assert.strictEqual(s.state.subscriptions.length, 0); assert.strictEqual(s.state.visits.length, 0);
    assert.strictEqual(s.backups().length, 1);
  });

  await test('PIN: вход, неверный PIN, блокировка на 30 с после 5 попыток', async () => {
    const s = mk();
    await rejects(s.setupAdmin('А', '12', 'AAAA-BBBB'), '4 до 8');
    const admin = await s.setupAdmin('Анна', '1234', 'ABCD-EFGH');
    assert(s.isAdmin); s.logOut(); assert(!s.currentUser);
    await rejects(s.logIn(admin.id, '0000'), 'Осталось попыток: 4');
    await s.logIn(admin.id, '1234'); assert(s.isAdmin); s.logOut();
    for (let i = 0; i < 4; i++) await rejects(s.logIn(admin.id, '1111'), 'Неверный PIN');
    await rejects(s.logIn(admin.id, '1111'), 'на 30 секунд');
    await rejects(s.logIn(admin.id, '1234'), 'заблокирован ещё');
    t0 = new Date(t0.getTime() + 31000);
    await s.logIn(admin.id, '1234'); assert(s.isAdmin);
  });

  await test('восстановление по коду и смена PIN', async () => {
    const s = mk(); const admin = await s.setupAdmin('Анна', '1234', 'abcd efgh');
    s.logOut();
    await rejects(s.resetPIN(admin.id, 'WRONG-CODE', '5555'), 'не подходит');
    await s.resetPIN(admin.id, 'ABCD-EFGH', '5555');
    await rejects(s.logIn(admin.id, '1234'), 'Неверный PIN');
    await s.logIn(admin.id, '5555');
    await rejects(s.changePIN(admin.id, '0000', '7777'), 'Текущий PIN неверный');
    await s.changePIN(admin.id, '5555', '7777'); s.logOut(); await s.logIn(admin.id, '7777');
  });

  await test('тренеры: добавление, отключение, удаление, права', async () => {
    const s = mk(); const admin = await s.setupAdmin('Анна', '1234', 'ABCD-EFGH');
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
    const admin = await a.setupAdmin('Анна', '1234', 'ABCD-EFGH');
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
    await a.setupAdmin('Анна', '1234', 'ABCD-EFGH');
    a.setStudioLogo(png); assert.strictEqual(a.logoSrc(), png);
    for (const bad of ['http://x/y.png', 'data:text/html;base64,AAAA', 'data:image/svg+xml;base64,AAAA', 'data:image/png;base64,' + 'A'.repeat(260000)]) assert.throws(() => a.setStudioLogo(bad), /Логотип/);
    const b = createStore({ storage, now: () => t0 }); b.load(); assert.strictEqual(b.logoSrc(), png);
    assert.strictEqual(a.snapshot().studioLogo, png);
    assert.throws(() => a.importSnapshot(Object.assign({}, a.snapshot(), { studioLogo: 'javascript:alert(1)' })), /логотип/);
    a.setStudioLogo(null); assert.strictEqual(a.logoSrc(), 'icons/logo.png');
  });
  await test('инструкция подключена и охватывает обе роли', () => {
    const fs = require('fs'); const d = __dirname + '/../docs/';
    assert(fs.readFileSync(d + 'index.html', 'utf8').includes('guide.js')); assert(fs.readFileSync(d + 'sw.js', 'utf8').includes('guide.js'));
    const src = fs.readFileSync(d + 'guide.js', 'utf8'); const rev = /GUIDE_REV = '([\d.]+)'/.exec(src)[1];
    assert(rev.split('.').length === 3); assert(src.includes('Как изменить название и логотип студии?') && src.includes('Как войти в приложение?'));
  });
  await test('новый тренер виден в «Тренеры» сразу, даже без занятий', async () => {
    const s = mk(); await s.setupAdmin('Анна', '1234', 'ABCD-EFGH'); await s.addTrainer('Новый Тренер', '4321');
    const r = s.trainerLoad(2026, 11).find((x) => x.trainer.name === 'Новый Тренер'); assert(r && r.sessions === 0 && r.occupancy === 0);
  });
  await test('тренер не может продавать абонементы и создавать классы; администратор может', async () => {
    const s = mk(); await s.setupAdmin('Анна', '1234', 'ABCD-EFGH'); const tr = await s.addTrainer('Новый Тренер', '4321');
    await s.logOut(); await s.logIn(tr.id, '4321'); assert(!s.isAdmin);
    assert.throws(() => sale(s), /только администратор/);
    assert.throws(() => s.saveClass({ name: 'Новое', type: 'yoga', level: 'Лёгкий', durationMin: 60, capacity: 10, weekdays: [1], startMinutes: 600, active: true }), /только администратор/);
    assert.throws(() => s.cancelFutureBookings(), /только администратор/);
  });
  await test('отмена всех будущих записей одним действием возвращает занятия', async () => {
    const s = mk(); await s.setupAdmin('Анна', '1234', 'ABCD-EFGH'); const c = sale(s); const cls = s.state.classes[0];
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
  await test('версия в version.json совпадает', () => {
    assert.strictEqual(JSON.parse(require('fs').readFileSync(__dirname + '/../docs/version.json', 'utf8')).version, require('../docs/store.js').APP_VERSION);
  });
  await test('версия в sw.js, store.js и index совпадает', () => {
    const fs = require('fs'); const sw = fs.readFileSync(__dirname + '/../docs/sw.js', 'utf8');
    assert.strictEqual(/VERSION = '([\d.]+)'/.exec(sw)[1], require('../docs/store.js').APP_VERSION);
    for (const f of ['index.html', 'manifest.webmanifest', 'app.js']) assert(fs.existsSync(__dirname + '/../docs/' + f), f);
  });

  console.log('\nПройдено тестов:', passed, process.exitCode ? '— есть ошибки' : '— всё хорошо');
})();
