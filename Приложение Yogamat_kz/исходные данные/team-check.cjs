/* Node-only checks for roles: hashing, session gating, guarded functions. No browser is used. */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const dist = path.resolve(__dirname, '../dist');
const results = [];
function test(name, run) {
  try { run(); results.push({name, status:'passed'}); console.log('PASS ' + name); }
  catch (error) { results.push({name, status:'failed', error:error.stack}); console.error('FAIL ' + name + '\n' + error.stack); }
}
function stub() {
  const target = function () {};
  return new Proxy(target, {
    get: (t, key) => key === 'classList' ? {toggle() {}, add() {}, remove() {}, contains() { return false; }} : key === 'style' || key === 'dataset' ? {} : key === Symbol.toPrimitive ? () => '' : key === 'length' ? 0 : stub(),
    set: () => true, apply: () => stub(), construct: () => stub()
  });
}
function load(seed = {}) {
  const store = new Map(Object.entries(seed));
  const toasts = [];
  const document = {createElement: () => stub(), body: stub(), getElementById: () => stub(), querySelector: () => stub(), querySelectorAll: () => []};
  const context = {
    document, console, Math, JSON, Date, Uint8Array, Uint32Array, DataView, TextEncoder, Promise, Set, Map, Array, Object, String, Number, RegExp, Error, setTimeout() {},
    localStorage: {getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key)},
    escapeHtml: value => String(value), showToast: message => toasts.push(message), fieldValue: () => '', uid: () => 'id' + Math.random().toString(36).slice(2),
    state: {classes: [], visits: []}, saveState() {}, showPage() {}, refreshViews() {}, renderSettings() {}, openSheet() {}, closeSheet() {}, confirm: () => true,
    isAdmin() { return !context.window.__access || context.window.__access.role() === 'admin'; }
  };
  context.window = context;
  vm.createContext(context);
  const calls = [];
  for (const name of ['openSaleSheet', 'toggleSubPaid', 'saveClass', 'openArchiveSheet']) context[name] = () => calls.push(name);
  vm.runInContext(fs.readFileSync(path.join(dist, 'team.js'), 'utf8'), context, {filename: 'team.js'});
  return {context, store, toasts, calls};
}
const salted = (secret, salt) => { let hash = salt + '|' + secret; for (let i = 0; i < 2000; i++) hash = crypto.createHash('sha256').update(salt + hash).digest('hex'); return hash; };

test('SHA-256 matches Node crypto for short, long and Unicode input', () => {
  const {context} = load();
  for (const text of ['', 'abc', '1234', 'Йога-практика', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), 'я'.repeat(500)])
    assert.equal(context.window.__access.sha256(text), crypto.createHash('sha256').update(text).digest('hex'), JSON.stringify(text).slice(0, 20));
});
test('Without a session the app is locked: nobody counts as administrator', () => {
  const {context} = load();
  assert.equal(context.window.__access.role(), 'none');
  assert.equal(context.isAdmin(), false);
  assert.equal(context.window.__access.canOpen('dashboard'), false);
});
function seeded(role, id) {
  const salt = 'abcdef012345';
  const access = {v:1, admin:{salt, hash:salted('1234', salt)}, recovery:{salt, hash:salted('11112222', salt)},
    trainers:[{id:'t1', name:'Айдана', active:true, salt, hash:salted('4321', salt)}, {id:'t2', name:'Отключён', active:false, salt, hash:salted('0000', salt)}]};
  return load({yogaTrackerAccess_v1: JSON.stringify(access), yogaTrackerSession_v1: JSON.stringify({role, id})});
}
test('Administrator can open every section and call guarded functions', () => {
  const {context, calls} = seeded('admin', 'admin');
  assert.equal(context.window.__access.role(), 'admin');
  for (const page of ['plans', 'sales', 'finance', 'rent', 'clients', 'settings']) assert.equal(context.window.__access.canOpen(page), true, page);
  context.openSaleSheet(); context.saveClass('x');
  assert.deepEqual(calls, ['openSaleSheet', 'saveClass']);
});
test('Trainer sees class work only; finance, tariffs, sales, rent and admin functions are blocked', () => {
  const {context, calls, toasts} = seeded('trainer', 't1');
  assert.equal(context.window.__access.role(), 'trainer');
  assert.equal(context.window.__access.name(), 'Айдана');
  for (const page of ['plans', 'sales', 'finance', 'rent']) assert.equal(context.window.__access.canOpen(page), false, page);
  for (const page of ['dashboard', 'clients', 'attendance', 'classes', 'settings', 'help']) assert.equal(context.window.__access.canOpen(page), true, page);
  for (const name of ['openSaleSheet', 'toggleSubPaid', 'saveClass', 'openArchiveSheet']) context[name]();
  assert.deepEqual(calls, [], 'Guarded functions must not run for a trainer');
  assert.equal(toasts.length, 4);
});
test('A deactivated trainer cannot resume a stored session', () => {
  const {context} = seeded('trainer', 't2');
  assert.equal(context.window.__access.role(), 'none');
});
test('Trainer list for directions excludes deactivated trainers', () => {
  const {context} = seeded('admin', 'admin');
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.listTrainers())), [{id:'t1', name:'Айдана'}]);
  assert.equal(context.window.trainerName('t1'), 'Айдана');
});
test('Access records are not part of exported snapshots', () => {
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  const snapshot = html.match(/function snapshotData\(\)\{[\s\S]*?\n\}/)[0];
  assert.ok(!/access|pin|hash|trainers/i.test(snapshot), snapshot);
  assert.match(snapshot, /classes/);
});
fs.writeFileSync(path.join(__dirname, 'team-results.json'), JSON.stringify({results}, null, 2) + '\n');
if (results.some(r => r.status === 'failed')) process.exitCode = 1;
