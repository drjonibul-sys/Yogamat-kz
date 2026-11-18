/* Rent and net-income regressions. Node VM only; no browser/iOS rendering. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const dist = path.resolve(__dirname, '../dist');
const results = [];
const deep = value => JSON.parse(JSON.stringify(value));
const money = value => Number(String(value).replace(/[^\d.-]/g, ''));

function harness(initialDate = '2026-11-09T10:00:00Z', initialStorage = {}) {
  const ids = new Map(), storage = new Map(Object.entries(initialStorage));
  const intervals = [];
  let clock = initialDate, failStorage = false;
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag; this.children = []; this.nodes = []; this.events = new Map();
      this.style = {}; this.dataset = {}; this.attributes = {}; this.value = ''; this.textContent = ''; this.hidden = false;
      const classes = new Set();
      this.classList = {add(...names){names.forEach(x=>classes.add(x));},remove(...names){names.forEach(x=>classes.delete(x));},contains(name){return classes.has(name);},toggle(name,on){if(on===undefined)on=!classes.has(name);on?classes.add(name):classes.delete(name);return on;}};
    }
    set innerHTML(value) {
      this.html = String(value);
      for (const node of this.nodes) if (node.id && ids.get(node.id) === node) ids.delete(node.id);
      this.nodes = [];
      for (const match of this.html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/gi)) {
        const node = new Element(match[1]);
        for (const attr of match[2].matchAll(/([a-z][a-z0-9-]*)="([^"]*)"/gi)) {
          node.attributes[attr[1]] = attr[2];
          if (attr[1] === 'id') {node.id = attr[2]; ids.set(node.id,node);}
          if (attr[1] === 'value') node.value = attr[2];
          if (attr[1] === 'class') {node.className=attr[2];attr[2].split(/\s+/).forEach(x=>node.classList.add(x));}
          if (attr[1].startsWith('data-')) node.dataset[attr[1].slice(5)] = attr[2];
        }
        this.nodes.push(node);
      }
    }
    get innerHTML() {return this.html || '';}
    addEventListener(name,fn) {this.events.set(name,fn);}
    setAttribute(name,value) {this.attributes[name]=String(value);}
    getAttribute(name) {return this.attributes[name] ?? null;}
    append(node) {this.children.push(node);if(node.id)ids.set(node.id,node);}
    before(node) {if(node.id)ids.set(node.id,node);}
    after(node) {if(node.id)ids.set(node.id,node);}
    focus() {}
    querySelector(selector) {return selector==='[data-tab="finance"]' ? financeTab : null;}
  }
  const nav = new Element('nav'), financeTab = new Element('button');
  const element = id => {if (!ids.has(id)) {const e=new Element();e.id=id;ids.set(id,e);}return ids.get(id);};
  const document = {
    createElement(tag){return new Element(tag);},
    getElementById(id){return element(id);},
    querySelector(selector){if(selector==='.tabbar')return nav;return null;},
    querySelectorAll(selector){
      if(selector==='.page')return [...ids.values()].filter(x=>x.id?.startsWith('page-'));
      if(selector==='.tabbtn')return [financeTab,...nav.children];
      return [];
    },
    addEventListener(){}
  };
  const NativeDate=Date;
  class FixedDate extends NativeDate {constructor(...args){super(...(args.length?args:[clock]));}static now(){return new NativeDate(clock).getTime();}}
  const localStorage={getItem(key){return storage.get(key)||null;},setItem(key,value){if(failStorage)throw new Error('Simulated quota failure');storage.set(key,String(value));},removeItem(key){storage.delete(key);}};
  const context={document,localStorage,Date:FixedDate,console,Math,JSON,Number,String,Set,Map,Array,Object,RegExp,Error,SyntaxError,confirm(){return true;},setTimeout(){return 1;},clearTimeout(){},setInterval(fn,delay){intervals.push({fn,delay});return intervals.length;},scrollTo(){},addEventListener(){}};
  context.window=context;vm.createContext(context);
  const html=fs.readFileSync(path.join(dist,'index.html'),'utf8');
  for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(match[1].trim())vm.runInContext(match[1],context);
  for(const file of ['validation.js','rent.js'])vm.runInContext(fs.readFileSync(path.join(dist,file),'utf8'),context,{filename:file});
  const evaluate=source=>vm.runInContext(source,context);
  return {context,storage,el:element,evaluate,setDate(value){clock=value;},tickInterval(delay){intervals.filter(item=>item.delay===delay).forEach(item=>item.fn());},failStorage(value){failStorage=value;},getData(){return deep(evaluate('state'));},setData(value){context.payload=JSON.stringify(value);evaluate('state=JSON.parse(payload)');context.renderHeader();context.renderDashboard();context.renderFinance();context.renderRent();},configure(amount=10000,start='2026-11'){element('fRentDefaultAmount').value=String(amount);element('fRentStartMonth').value=start;return context.configureRent();}};
}
function base(receipts=[]) {
  return {clients:[{id:'c1',name:'Анна',createdAt:'2025-01-01'}],plans:[{id:'p1',name:'8 занятий',visitsCount:8,durationDays:30,price:24000}],subscriptions:receipts.map((p,i)=>({id:'s'+i,clientId:'c1',planId:'p1',purchaseDate:'2025-01-01',expiryDate:'2027-12-31',visitsTotal:8,visitsLeft:8,price:p.amount,paid:p.paid!==false,paidDate:p.paid===false?null:p.date})),visits:[],transfers:[]};
}
function payment(data,month) {return data.rent.payments.find(x=>x.month===month);}
function test(name,run) {try{run();results.push({name,status:'passed'});console.log('PASS '+name);}catch(error){results.push({name,status:'failed',error:error.stack});console.error('FAIL '+name+'\n'+error.stack);}}

test('Configuring rent creates unpaid monthly entries and a dashboard reminder without reducing income',()=>{
  const a=harness();a.setData(base([{date:'2026-11-08',amount:50000}]));
  assert.match(a.el('rentReminderCard').innerHTML,/Настройте аренду/);
  assert.equal(a.configure(10000,'2026-10'),true);
  assert.deepEqual(a.getData().rent.payments.map(p=>p.month),['2026-10','2026-11','2026-12','2027-01','2027-02','2027-03','2027-04','2027-05']);
  assert.ok(a.getData().rent.payments.every(p=>p.amount===10000&&!p.paid&&p.paidDate===null));
  assert.equal(money(a.el('hdrMonthIncome').textContent),50000);
  assert.equal(a.context.totalPaidRent(),0);
  assert.match(a.el('rentReminderCard').innerHTML,/Необходимо оплатить аренду/);
  assert.match(a.el('rentReminderCard').innerHTML,/Октябрь/);
  assert.match(a.el('rentReminderCard').innerHTML,/Ноябрь/);
  assert.ok(!a.el('rentReminderCard').innerHTML.includes('Декабрь'),'Future planned rent is not overdue');
});

test('Paid rent reduces its month and all-time net income once; clearing the switch restores both',()=>{
  const a=harness();a.setData(base([{date:'2026-10-08',amount:30000},{date:'2026-11-08',amount:50000}]));a.configure(10000);
  assert.equal(a.context.toggleRentPaid('2026-11'),true);
  assert.equal(money(a.el('hdrMonthIncome').textContent),40000);
  assert.equal(money(a.el('hdrTotalIncome').textContent),70000);
  assert.equal(money(a.el('finMonthNum').textContent),40000);
  assert.equal(money(a.el('finYearNum').textContent),70000);
  assert.equal(money(a.el('finReceiptsNum').textContent),50000);
  assert.equal(money(a.el('finRentNum').textContent),10000);
  assert.equal(a.context.totalPaidRent(),10000);
  assert.equal(payment(a.getData(),'2026-11').paidDate,'2026-11-09');
  a.context.renderHeader();a.context.renderFinance();a.context.renderRent();
  assert.equal(a.context.totalPaidRent(),10000,'Rerendering must not double charge');
  assert.match(a.el('rentReminderCard').innerHTML,/Аренда оплачена/);
  assert.equal(a.context.toggleRentPaid('2026-11'),true);
  assert.equal(money(a.el('hdrMonthIncome').textContent),50000);
  assert.equal(money(a.el('hdrTotalIncome').textContent),80000);
  assert.equal(a.context.totalPaidRent(),0);
  assert.equal(payment(a.getData(),'2026-11').paidDate,null);
  assert.match(a.el('rentReminderCard').innerHTML,/Необходимо оплатить аренду/);
});

test('After setup the rent amount cannot be corrected or re-saved: only payment confirmation remains',()=>{
  const a=harness();a.setData(base([{date:'2026-11-08',amount:50000}]));a.configure(10000);a.context.toggleRentPaid('2026-11');
  assert.equal(typeof a.context.saveRentAmount,'undefined');
  assert.equal(typeof a.context.saveRentDefault,'undefined');
  assert.equal(typeof a.context.rentHasUnsavedChanges,'undefined');
  const page=a.el('page-rent').innerHTML;
  assert.ok(!page.includes('fRentMonthAmount') && !page.includes('fRentDefaultAmount'),'No amount inputs after setup');
  assert.ok(!page.includes('Сохранить сумму') && !page.includes('saveRent'),'No amount-saving buttons');
  assert.match(page,/toggleRentPaid\('2026-11'\)/,'The payment switch stays');
  assert.equal(a.context.configureRent(),false,'Setup cannot be repeated to change the amount');
  assert.equal(money(a.el('hdrMonthIncome').textContent),40000);
  assert.equal(a.context.totalPaidRent(),10000);
  assert.equal(payment(a.getData(),'2026-11').paidDate,'2026-11-09');
});
test('Future periods keep the amount set at setup and paid amounts remain unchanged',()=>{
  const a=harness();a.setData(base());a.configure(10000);a.context.toggleRentPaid('2026-11');
  assert.equal(payment(a.getData(),'2026-11').amount,10000);
  a.setDate('2026-12-02T12:00:00Z');assert.equal(a.context.ensureRentPeriods(),true);a.context.saveState();a.context.renderRentReminder();
  const december=payment(a.getData(),'2026-12');assert.equal(december.amount,10000);assert.equal(december.paid,false);
  assert.equal(payment(a.getData(),'2027-06').amount,10000,'Newly extended horizon uses the same amount');
  assert.equal(a.context.totalPaidRent(),10000);
  assert.match(a.el('rentReminderCard').innerHTML,/Декабрь/);
});
test('Six future months are created across year boundaries and advance automatically without duplicate expenses',()=>{
  const a=harness('2026-12-20T12:00:00Z');a.setData(base());a.configure(18000,'2026-12');
  assert.deepEqual(a.getData().rent.payments.map(p=>p.month),['2026-12','2027-01','2027-02','2027-03','2027-04','2027-05','2027-06']);
  assert.equal(a.context.totalPaidRent(),0);assert.equal(money(a.el('hdrTotalIncome').textContent),0);
  a.context.toggleRentPaid('2026-12');
  assert.match(a.el('rentReminderCard').innerHTML,/Аренда оплачена/,'The six unpaid future months do not trigger a reminder');
  const paid=deep(payment(a.getData(),'2026-12'));
  a.setDate('2027-01-01T12:00:00Z');a.tickInterval(60000);
  assert.equal(payment(a.getData(),'2027-07').amount,18000);
  assert.deepEqual(payment(a.getData(),'2026-12'),paid);
  assert.equal(a.context.ensureRentPeriods(),false);
  assert.equal(new Set(a.getData().rent.payments.map(p=>p.month)).size,8);
  assert.equal(a.context.totalPaidRent(),18000);
  assert.match(a.el('rentReminderCard').innerHTML,/Январь/);
  assert.ok(!a.el('rentReminderCard').innerHTML.includes('Февраль'));
});

test('Previously saved rent gains a six-month horizon without overwriting paid or corrected records',()=>{
  const original=base();
  original.rent={defaultAmount:12000,startMonth:'2026-11',payments:[
    {id:'rent-old',month:'2026-11',amount:9000,paid:true,paidDate:'2026-11-08'},
    {id:'rent-edited',month:'2026-12',amount:14000,paid:false,paidDate:null}
  ]};
  const a=harness('2026-11-09T12:00:00Z',{'yogaTrackerData_v1':JSON.stringify(original)});
  assert.equal(a.getData().rent.payments.length,7);
  assert.deepEqual(payment(a.getData(),'2026-11'),original.rent.payments[0]);
  assert.deepEqual(payment(a.getData(),'2026-12'),original.rent.payments[1]);
  assert.equal(payment(a.getData(),'2027-05').amount,12000);
  assert.equal(a.context.totalPaidRent(),9000);
  assert.equal(a.context.ensureRentPeriods(),false);
  assert.match(a.el('rentReminderCard').innerHTML,/Аренда оплачена/);
  const future=harness();future.setData(base());future.configure(10000,'2028-01');
  assert.deepEqual(future.getData().rent.payments.map(p=>p.month),['2028-01','2028-02','2028-03','2028-04','2028-05','2028-06','2028-07']);
  assert.ok(!future.el('rentReminderCard').innerHTML.includes('Необходимо оплатить'));
});

test('Paying an older rental period corrects that month rather than the actual activation month',()=>{
  const a=harness();a.setData(base([{date:'2025-12-15',amount:20000},{date:'2026-11-08',amount:50000}]));a.configure(10000,'2025-12');
  assert.equal(a.context.toggleRentPaid('2025-12'),true);
  assert.equal(payment(a.getData(),'2025-12').paidDate,'2026-11-09');
  a.context.setFinanceYear(2025);a.context.setFinanceMonth(12);
  assert.equal(money(a.el('finMonthNum').textContent),10000);
  assert.equal(money(a.el('finYearNum').textContent),10000);
  assert.equal(money(a.el('hdrMonthIncome').textContent),50000);
  assert.equal(money(a.el('hdrTotalIncome').textContent),60000);
  assert.match(a.el('rentReminderCard').innerHTML,/Необходимо оплатить аренду/,'Other unpaid periods remain due');
});

test('A storage failure while confirming payment rolls the ledger back',()=>{
  const a=harness();a.setData(base([{date:'2026-11-08',amount:50000}]));a.configure(10000);
  const before=a.getData();a.failStorage(true);
  assert.equal(a.context.toggleRentPaid('2026-11'),false);
  assert.deepEqual(a.getData(),before);
  a.failStorage(false);a.context.renderHeader();assert.equal(money(a.el('hdrTotalIncome').textContent),50000);
});
test('Payment confirmation works independently for each period without any draft state',()=>{
  const a=harness();a.setData(base());a.configure(10000,'2026-10');a.context.openRentMonth('2026-11');
  assert.equal(a.context.toggleRentPaid('2026-10'),true);
  assert.equal(payment(a.getData(),'2026-10').paid,true);
  assert.equal(payment(a.getData(),'2026-11').paid,false);
  assert.equal(a.context.toggleRentPaid('2026-11'),true);
  assert.equal(a.context.totalPaidRent(),20000);
});
test('Foreground month rollover creates the new reminder and keeps existing amounts',()=>{
  const a=harness('2026-11-30T12:00:00Z');a.setData(base());a.configure(10000);a.context.toggleRentPaid('2026-11');a.context.openRentMonth('2026-11');
  a.setDate('2026-12-01T12:00:00Z');a.tickInterval(60000);
  assert.equal(payment(a.getData(),'2026-12').amount,10000);
  assert.equal(payment(a.getData(),'2026-12').paid,false);
  assert.equal(payment(a.getData(),'2026-11').amount,10000);
  assert.equal(a.context.totalPaidRent(),10000);
  assert.match(a.el('rentReminderCard').innerHTML,/Декабрь/);
});
test('Rent snapshots, manual backups and restore preserve configuration and payments; old backups migrate empty',()=>{
  const a=harness();a.setData(base([{date:'2026-11-08',amount:50000}]));a.configure(10000);a.context.toggleRentPaid('2026-11');
  const snapshot=deep(a.context.snapshotData());assert.ok(snapshot.rent,'Rent is included in export payload');
  assert.equal(snapshot.rent.defaultAmount,10000);assert.equal(payment(snapshot,'2026-11').paid,true);
  const backup=a.context.createBackup('manual');assert.deepEqual(JSON.parse(backup.data).rent,snapshot.rent);
  assert.equal(a.context.restoreSnapshotText(JSON.stringify(snapshot)),true);
  assert.equal(a.context.totalPaidRent(),10000);assert.equal(money(a.el('hdrTotalIncome').textContent),40000);
  const old=base([{date:'2026-11-08',amount:50000}]);
  assert.equal(a.context.restoreSnapshotText(JSON.stringify(old)),true);
  assert.deepEqual(a.getData().rent,{defaultAmount:null,startMonth:null,payments:[]});
  assert.equal(a.context.totalPaidRent(),0);assert.equal(money(a.el('hdrTotalIncome').textContent),50000);
  const safety=a.context.loadBackups()[0];assert.equal(safety.type,'pre-restore');
  assert.equal(payment(JSON.parse(safety.data),'2026-11').paid,true,'Legacy restore keeps the paid ledger in its safety backup');
});

test('Reloading saved data preserves paid rent and creates only new unpaid periods on a later month',()=>{
  const a=harness();a.setData(base([{date:'2026-11-08',amount:50000}]));a.configure(10000);a.context.toggleRentPaid('2026-11');
  const stored=a.storage.get('yogaTrackerData_v1');assert.ok(stored);
  const reloaded=harness('2026-12-02T12:00:00Z',{'yogaTrackerData_v1':stored});
  assert.equal(payment(reloaded.getData(),'2026-11').paid,true);
  assert.equal(payment(reloaded.getData(),'2026-11').paidDate,'2026-11-09');
  assert.equal(payment(reloaded.getData(),'2026-12').paid,false);
  assert.equal(payment(reloaded.getData(),'2026-12').amount,10000);
  assert.equal(reloaded.context.totalPaidRent(),10000);
  assert.equal(money(reloaded.el('hdrMonthIncome').textContent),0,'New unpaid rent does not reduce the new month');
  assert.equal(money(reloaded.el('hdrTotalIncome').textContent),40000);
  assert.match(reloaded.el('rentReminderCard').innerHTML,/Декабрь/);
});

test('Malformed or duplicate rent periods cannot replace valid data during import',()=>{
  const a=harness();a.setData(base());a.configure(10000);a.context.toggleRentPaid('2026-11');
  const valid=deep(a.context.snapshotData());
  for(const mutate of [
    data=>data.rent.payments.push({...data.rent.payments[0],id:'duplicate'}),
    data=>data.rent.payments[0].month='2026-13',
    data=>data.rent.payments[0].amount=-10,
    data=>data.rent.payments[0].paid='true',
    data=>data.rent.payments[0].paidDate=null,
    data=>data.rent.defaultAmount='10000'
  ]){
    const bad=deep(valid);mutate(bad);
    assert.equal(a.context.restoreSnapshotText(JSON.stringify(bad)),false);
    assert.deepEqual(a.getData().rent,valid.rent);
  }
});

test('Zero rent remains a paid status without generating a deduction or reminder for a future month',()=>{
  const a=harness();a.setData(base([{date:'2026-11-08',amount:50000}]));
  assert.equal(a.configure(0),true);
  assert.match(a.el('rentReminderCard').innerHTML,/Необходимо оплатить аренду/);
  assert.equal(a.context.toggleRentPaid('2026-11'),true);
  assert.equal(money(a.el('hdrMonthIncome').textContent),50000);
  assert.equal(a.context.totalPaidRent(),0);
  assert.match(a.el('rentReminderCard').innerHTML,/Аренда оплачена/);
  assert.equal(a.context.selectRentMonth('2026-12'),true);
  assert.equal(payment(a.getData(),'2026-12').paid,false);
  assert.match(a.el('rentReminderCard').innerHTML,/Аренда оплачена/,'Unpaid future records are not overdue');
});

test('Rent-only months produce negative income and visible bounded negative bars and cumulative line',()=>{
  const a=harness();a.setData(base());a.configure(10000);a.context.toggleRentPaid('2026-11');
  assert.equal(money(a.el('hdrMonthIncome').textContent),-10000);
  assert.equal(money(a.el('hdrTotalIncome').textContent),-10000);
  assert.equal(money(a.el('finMonthNum').textContent),-10000);
  assert.equal(money(a.el('finYearNum').textContent),-10000);
  assert.match(a.el('finTable').innerHTML,/-10/);
  const bars=[...a.el('chartMonthly').innerHTML.matchAll(/<rect\b([^>]*)>/g)].map(match=>Object.fromEntries([...match[1].matchAll(/([a-z]+)="([^"]*)"/g)].map(x=>[x[1],x[2]])));
  assert.ok(bars.some(bar=>Number(bar.height)>1),'A negative receipt month has a visible bar');
  for(const bar of bars){assert.ok(Number(bar.y)>=0&&Number(bar.height)>=0&&Number(bar.y)+Number(bar.height)<=160.1,'Bar fits SVG');}
  const dots=[...a.el('chartCumulative').innerHTML.matchAll(/<circle\b([^>]*)>/g)];
  assert.ok(dots.length>0);
  for(const dot of dots){const y=Number(dot[1].match(/\bcy="([^"]+)"/)[1]);assert.ok(y>=0&&y<=160,'Cumulative line fits SVG');}
});

test('Mixed income across zero keeps both positive and negative bars visible and historical cumulative totals correct',()=>{
  const a=harness();a.setData(base([{date:'2026-10-08',amount:5000},{date:'2026-11-08',amount:25000}]));a.configure(10000,'2026-10');
  a.context.toggleRentPaid('2026-10');a.context.toggleRentPaid('2026-11');
  assert.equal(money(a.el('hdrTotalIncome').textContent),10000);
  const bars=[...a.el('chartMonthly').innerHTML.matchAll(/<rect\b([^>]*)>/g)].map(match=>Object.fromEntries([...match[1].matchAll(/([a-z]+)="([^"]*)"/g)].map(x=>[x[1],x[2]])));
  const visible=bars.filter(bar=>Number(bar.height)>0);assert.equal(visible.length,2);
  assert.ok(visible.some(bar=>bar.fill==='var(--rose)'),'Negative month gets a visible expense-colored bar');
  assert.ok(visible.some(bar=>bar.fill==='var(--sage)'),'Positive month keeps its income bar');
  for(const bar of visible){assert.ok(Number(bar.y)>=0&&Number(bar.y)+Number(bar.height)<=160.1);}
  a.context.setFinanceMonth(10);assert.equal(money(a.el('finMonthNum').textContent),-5000);
  a.context.setFinanceMonth(11);assert.equal(money(a.el('finMonthNum').textContent),15000);
  const dots=[...a.el('chartCumulative').innerHTML.matchAll(/\bcy="([^"]+)"/g)].map(match=>Number(match[1]));
  assert.equal(dots.length,2);assert.ok(dots.every(y=>y>=0&&y<=160));assert.ok(dots[0]>dots[1]);
});

fs.writeFileSync(path.join(__dirname,'rent-results.json'),JSON.stringify({engine:'Node.js VM with minimal DOM',note:'Rent ledger, net income and backups; no browser or iOS execution',results},null,2)+'\n');
if(results.some(result=>result.status==='failed'))process.exitCode=1;
