/* Actual-income regression checks. Node VM; no browser or device is emulated. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const dist = path.resolve(__dirname, '../dist');
const results = [];

function app(){
  const elements = new Map(), stored = new Map();
  function element(){
    const classes = new Set();
    return {innerHTML:'',textContent:'',value:'',hidden:false,style:{},dataset:{},
      classList:{add(...names){names.forEach(n=>classes.add(n));},remove(...names){names.forEach(n=>classes.delete(n));},contains(name){return classes.has(name);},toggle(name,on){if(on===undefined)on=!classes.has(name);on?classes.add(name):classes.delete(name);}},
      addEventListener(){},setAttribute(){},getAttribute(){return null;}};
  }
  const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},querySelectorAll(){return [];},querySelector(){return element();},addEventListener(){}};
  const localStorage={getItem(key){return stored.get(key)||null;},setItem(key,value){stored.set(key,String(value));},removeItem(key){stored.delete(key);}};
  const NativeDate=Date;
  class FixedDate extends NativeDate {constructor(...args){super(...(args.length?args:['2026-11-09T10:00:00Z']));}static now(){return new NativeDate('2026-11-09T10:00:00Z').getTime();}}
  const context={document,localStorage,Date:FixedDate,console,Math,JSON,Number,String,Set,Map,Array,Object,RegExp,Error,SyntaxError,confirm(){return true;},setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},scrollTo(){},addEventListener(){}};
  context.window=context;
  vm.createContext(context);
  const html=fs.readFileSync(path.join(dist,'index.html'),'utf8');
  for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(match[1].trim())vm.runInContext(match[1],context);
  vm.runInContext(fs.readFileSync(path.join(dist,'validation.js'),'utf8'),context);
  context.charts={};
  context.drawBarChart=(id,labels,values)=>{context.charts[id]={labels:Array.from(labels),values:Array.from(values)};};
  context.drawLineChart=(id,labels,values)=>{context.charts[id]={labels:Array.from(labels),values:Array.from(values)};};
  return {context,elements,stored,evaluate(source){return vm.runInContext(source,context);},el(id){return document.getElementById(id);},setData(data){context.payload=JSON.stringify(data);vm.runInContext('state=JSON.parse(payload)',context);}};
}
function subscription(id,price,paid,paidDate){return {id,clientId:'c1',planId:'p1',purchaseDate:'2025-11-01',expiryDate:'2027-12-31',visitsTotal:8,visitsLeft:8,price,...(paid===undefined?{}:{paid}),...(paidDate===undefined?{}:{paidDate})};}
function snapshot(subscriptions=[]){return {clients:[{id:'c1',name:'Анна',createdAt:'2025-11-01'}],plans:[{id:'p1',name:'8 занятий',visitsCount:8,durationDays:30,price:24000}],subscriptions,visits:[],transfers:[]};}
function money(text){return Number(text.replace(/[^\d.-]/g,''));}
function test(name,run){try{run();results.push({name,status:'passed'});console.log('PASS '+name);}catch(error){results.push({name,status:'failed',error:error.stack});console.error('FAIL '+name+'\n'+error.stack);}}

test('Unpaid sales do not contribute; payment month drives header, annual chart, table and all-time income',()=>{
  const a=app();
  a.setData(snapshot([
    subscription('unpaid',120000,false),subscription('old-paid',25000,true),
    subscription('last-year',10000,true,'2025-12-15'),subscription('october',20000,true,'2026-10-12'),
    subscription('november',30000,true,'2026-11-08'),subscription('old-unmarked',400000),
    subscription('invalid-date',70000,true,'2026-02-30'),subscription('string-flag',90000,'true','2026-11-01')
  ]));
  a.context.renderHeader();a.context.setFinanceMonth(10);
  assert.equal(money(a.el('hdrMonthIncome').textContent),30000);
  assert.equal(money(a.el('hdrTotalIncome').textContent),60000);
  assert.equal(money(a.el('finMonthNum').textContent),20000);
  assert.equal(money(a.el('finYearNum').textContent),50000);
  assert.equal(a.el('finMonthLabel').textContent,'Октябрь 2026');
  assert.deepEqual(a.context.charts.chartMonthly.values,[0,0,0,0,0,0,0,0,0,20000,30000,0]);
  assert.deepEqual(a.context.charts.chartCumulative.values,[10000,30000,60000]);
  assert.ok(!a.el('finTable').innerHTML.includes('120'));
  assert.match(a.el('finTable').innerHTML,/накопл\. 60/);
  assert.equal(a.el('financeDataNotice').hidden,false);
  assert.match(a.el('financeDataNotice').textContent,/: 2\./);
});

test('Historical year and selected month match payments; cumulative chart respects selected year',()=>{
  const a=app();a.setData(snapshot([subscription('a',10000,true,'2025-12-15'),subscription('b',20000,true,'2026-10-15')]));
  a.context.setFinanceYear(2025);a.context.setFinanceMonth(12);
  assert.equal(money(a.el('finMonthNum').textContent),10000);
  assert.equal(money(a.el('finYearNum').textContent),10000);
  assert.equal(a.el('finMonthLabel').textContent,'Декабрь 2025');
  assert.deepEqual(a.context.charts.chartCumulative.values,[10000]);
  a.context.setFinanceMonth(1);assert.equal(money(a.el('finMonthNum').textContent),0);
  a.context.setFinanceMonth(99);assert.equal(a.el('finMonthLabel').textContent,'Январь 2025');
});

test('Paid toggle immediately updates every income surface, persists payment date, and removes income when cleared',()=>{
  const a=app();a.setData(snapshot([subscription('s1',24000,false)]));
  a.context.renderHeader();a.context.renderFinance();
  assert.equal(money(a.el('hdrTotalIncome').textContent),0);
  a.context.toggleSubPaid('s1');
  assert.equal(money(a.el('hdrMonthIncome').textContent),24000);
  assert.equal(money(a.el('hdrTotalIncome').textContent),24000);
  assert.equal(money(a.el('finMonthNum').textContent),24000);
  assert.equal(money(a.el('finYearNum').textContent),24000);
  assert.equal(a.evaluate('state.subscriptions[0].paidDate'),'2026-11-09');
  let saved=JSON.parse(a.stored.get('yogaTrackerData_v1'));assert.equal(saved.subscriptions[0].paid,true);
  assert.equal(saved.subscriptions[0].paidDate,'2026-11-09');
  a.context.toggleSubPaid('s1');
  assert.equal(money(a.el('hdrTotalIncome').textContent),0);
  assert.equal(money(a.el('finMonthNum').textContent),0);
  assert.deepEqual(a.context.charts.chartCumulative.values,[0]);
  saved=JSON.parse(a.stored.get('yogaTrackerData_v1'));assert.equal(saved.subscriptions[0].paid,false);assert.equal(saved.subscriptions[0].paidDate,null);
});

test('Paid-at-sale uses actual payment date rather than historical purchase date',()=>{
  const a=app();a.setData(snapshot());
  const fields={fSaleClient:'c1',fSalePlan:'p1',fSaleDate:'2026-10-01',fSaleVisits:'8',fSalePrice:'24000',fSaleExpiry:'2026-12-01'};
  for(const [id,value] of Object.entries(fields))a.el(id).value=value;
  a.el('fSalePaid').classList.add('on');a.context.saveSale();
  assert.equal(a.evaluate('state.subscriptions[0].purchaseDate'),'2026-10-01');
  assert.equal(a.evaluate('state.subscriptions[0].paidDate'),'2026-11-09');
  a.context.setFinanceMonth(10);assert.equal(money(a.el('finMonthNum').textContent),0);
  a.context.setFinanceMonth(11);assert.equal(money(a.el('finMonthNum').textContent),24000);
});

test('Valid restored paid receipts count, unmarked legacy sales remain unpaid, and undated paid imports are rejected',()=>{
  const a=app();
  const valid=snapshot([subscription('paid',15000,true,'2026-10-15'),subscription('unmarked',100000)]);
  assert.equal(a.context.restoreSnapshotText(JSON.stringify(valid)),true);
  a.context.renderHeader();a.context.setFinanceMonth(10);
  assert.equal(money(a.el('hdrTotalIncome').textContent),15000);
  assert.equal(money(a.el('finMonthNum').textContent),15000);
  assert.equal(a.evaluate('state.subscriptions[1].paid'),false);
  const invalid=snapshot([subscription('undated',50000,true)]);
  assert.equal(a.context.restoreSnapshotText(JSON.stringify(invalid)),false);
  a.context.renderHeader();assert.equal(money(a.el('hdrTotalIncome').textContent),15000);
});

test('Deleting a client immediately refreshes income after their paid subscriptions are removed',()=>{
  const a=app();a.setData(snapshot([subscription('paid',24000,true,'2026-11-08'),subscription('unpaid',12000,false)]));
  a.context.renderHeader();
  assert.equal(money(a.el('hdrMonthIncome').textContent),24000);
  assert.equal(money(a.el('hdrTotalIncome').textContent),24000);
  a.context.deleteClient('c1');
  assert.equal(money(a.el('hdrMonthIncome').textContent),0);
  assert.equal(money(a.el('hdrTotalIncome').textContent),0);
  assert.equal(a.evaluate('state.clients.length'),0);
  assert.equal(a.evaluate('state.subscriptions.length'),0);
  const saved=JSON.parse(a.stored.get('yogaTrackerData_v1'));assert.equal(saved.subscriptions.length,0);
  a.context.renderFinance();assert.equal(money(a.el('finYearNum').textContent),0);
});

fs.writeFileSync(path.join(__dirname,'income-results.json'),JSON.stringify({engine:'Node.js VM',note:'Income calculations and rendered values; no browser or iOS runtime',results},null,2)+'\n');
if(results.some(result=>result.status==='failed'))process.exitCode=1;
