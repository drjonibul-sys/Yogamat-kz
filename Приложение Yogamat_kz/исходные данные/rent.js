/* Monthly rent ledger. A paid record belongs to its rental period. */
(() => {
  'use strict';
  const MAX_PERIODS = 3600;
  const FUTURE_MONTHS = 6;
  const emptyRent = () => ({defaultAmount:null, startMonth:null, payments:[]});
  const currentMonth = () => todayISO().slice(0,7);
  let selectedMonth = currentMonth();

  function validMonth(value) {
    return typeof value === 'string' && /^(19\d{2}|20\d{2}|21\d{2}|2200)-(0[1-9]|1[0-2])$/.test(value);
  }
  function validAmount(value) { return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1e12; }
  function monthIndex(month) { const [year,number] = month.split('-').map(Number); return year*12+number-1; }
  function indexMonth(index) { return Math.floor(index/12)+'-'+String(index%12+1).padStart(2,'0'); }
  function monthTitle(month) {
    if (!validMonth(month)) return '—';
    const name = new Date(month+'-01T12:00:00').toLocaleDateString('ru-RU',{month:'long',year:'numeric'});
    return name.charAt(0).toLocaleUpperCase('ru')+name.slice(1);
  }
  function rentModel() { return state.rent || emptyRent(); }
  function payments() { return Array.isArray(rentModel().payments) ? rentModel().payments : []; }
  function configured() { const rent=rentModel(); return validAmount(rent.defaultAmount) && validMonth(rent.startMonth); }
  function paymentFor(month) { return payments().find(payment=>payment.month===month); }
  function rentExpensesByMonth() {
    const result={};
    for (const payment of payments()) {
      if (payment.paid!==true || !validMonth(payment.month) || !validAmount(payment.amount)) continue;
      // Validation rejects duplicate periods. This guard also protects an old local store.
      if (Object.prototype.hasOwnProperty.call(result,payment.month)) continue;
      result[payment.month]=payment.amount;
    }
    return result;
  }
  function totalPaidRent() { return Object.values(rentExpensesByMonth()).reduce((sum,amount)=>sum+amount,0); }

  function ensureRentPeriods(explicitMonth) {
    let changed=false;
    if (!state.rent) { state.rent=emptyRent(); changed=true; }
    if (!configured()) return changed;
    const rent=state.rent, start=monthIndex(rent.startMonth), current=monthIndex(currentMonth());
    const end=Math.min(Math.max(start,current)+FUTURE_MONTHS,monthIndex('2200-12'));
    if (end-start+1>MAX_PERIODS) throw new Error('Слишком большой диапазон месяцев аренды');
    if (explicitMonth!==undefined && (!validMonth(explicitMonth) || explicitMonth<rent.startMonth)) throw new Error('Выберите месяц не раньше начала учёта аренды');
    const existing=new Set(rent.payments.map(payment=>payment.month));
    const add = month => {
      if (existing.has(month)) return;
      if (rent.payments.length>=MAX_PERIODS) throw new Error('Достигнут предел периодов аренды');
      rent.payments.push({id:uid(),month,amount:rent.defaultAmount,paid:false,paidDate:null});
      existing.add(month); changed=true;
    };
    for (let index=start;index<=end;index++) add(indexMonth(index));
    if (explicitMonth!==undefined) add(explicitMonth);
    return changed;
  }

  function refreshRentViews() {
    renderHeader(); renderDashboard(); renderFinance(); renderRent();
  }
  function transact(action,message) {
    const before=JSON.stringify(state);
    try { action(); saveState(); }
    catch (error) {
      state=JSON.parse(before);
      showToast('Не удалось сохранить аренду: '+error.message);
      return false;
    }
    refreshRentViews();
    if (message) showToast(message);
    return true;
  }
  function readAmount(id) {
    const raw=document.getElementById(id)?.value.trim() || '';
    const value=Number(raw);
    if (!raw || !validAmount(value)) throw new Error('Укажите неотрицательную сумму аренды');
    return value;
  }

  function configureRent() {
    if (configured()) return false; // After setup the amount is fixed; only payment confirmation remains.
    let amount,start;
    try {
      amount=readAmount('fRentDefaultAmount'); start=document.getElementById('fRentStartMonth').value;
      if (!validMonth(start)) throw new Error('Укажите месяц начала учёта');
      if (monthIndex(currentMonth())-monthIndex(start)+1>MAX_PERIODS) throw new Error('Слишком большой диапазон месяцев аренды');
    } catch (error) { showToast(error.message); return false; }
    const previousSelection=selectedMonth;
    selectedMonth=currentMonth()<start ? start : currentMonth();
    const saved=transact(()=>{
      state.rent={defaultAmount:amount,startMonth:start,payments:[]};
      ensureRentPeriods(selectedMonth);
    },'Аренда настроена на текущий и шесть следующих месяцев');
    if (!saved) selectedMonth=previousSelection;
    return saved;
  }
  function selectRentMonth(month) {
    if (!configured()) { showToast('Сначала укажите сумму аренды'); return false; }
    if (!validMonth(month) || month<rentModel().startMonth) { showToast('Выберите месяц не раньше начала учёта аренды'); return false; }
    const before=JSON.stringify(state), previousSelection=selectedMonth;
    try {
      if (ensureRentPeriods(month)) saveState();
      selectedMonth=month;
    } catch (error) {
      state=JSON.parse(before); selectedMonth=previousSelection;
      renderRent();
      showToast('Не удалось открыть период: '+error.message); return false;
    }
    renderRent(); renderRentReminder();
    return true;
  }
  function shiftRentMonth(delta) {
    const next=indexMonth(monthIndex(selectedMonth)+Number(delta));
    return selectRentMonth(next);
  }
  function openRentMonth(month) {
    if (month && !selectRentMonth(month)) return;
    showPage('rent');
  }
  function toggleRentPaid(month) {
    const payment=paymentFor(month);
    if (!payment) { showToast('Сначала откройте период аренды'); return false; }
    const marking=!payment.paid;
    return transact(()=>{payment.paid=marking;payment.paidDate=marking?todayISO():null;},marking?'Оплата аренды учтена за '+monthTitle(month):'Отметка об оплате аренды снята');
  }
  function paidControl(payment) {
    return paySwitchHtml(!!payment.paid,`toggleRentPaid('${payment.month}')`);
  }
  function renderRent() {
    const page=document.getElementById('page-rent'); if (!page) return;
    const rent=rentModel(), ready=configured(), current=currentMonth();
    if (ready && selectedMonth<rent.startMonth) selectedMonth=current<rent.startMonth?rent.startMonth:current;
    const payment=ready?paymentFor(selectedMonth):null;
    const monthPaid=payment?.paid?payment.amount:0;
    page.innerHTML=`
      <div class="section-title"><h2>Аренда</h2></div>
      <p class="help-note">Из дохода вычитается только оплаченная аренда. Платёж относится к выбранному месяцу аренды, даже если оплачен позже. Накопительный доход пересчитывается автоматически.</p>
      <div class="stat-grid rent-stats">
        <div class="stat-card"><div class="num" id="rentTotalPaid">${fmtMoney(totalPaidRent())}</div><div class="label">всего выплачено аренды</div></div>
        <div class="stat-card clay"><div class="num" id="rentMonthPaid">${fmtMoney(monthPaid)}</div><div class="label">оплачено за ${escapeHtml(monthTitle(selectedMonth))}</div></div>
      </div>
      ${ready?`<div class="card rent-summary"><div class="kv"><span class="k">Аренда в месяц</span><strong>${fmtMoney(rent.defaultAmount)}</strong></div><div class="kv"><span class="k">Учёт ведётся с</span><span>${escapeHtml(monthTitle(rent.startMonth))}</span></div></div>`:`<div class="card rent-settings">
        <h3 style="margin:0 0 12px;font-size:16px">Настроить аренду</h3>
        <div class="row2">
          <div><label for="fRentDefaultAmount">Ежемесячная аренда, ₸</label><input id="fRentDefaultAmount" type="number" min="0" max="1000000000000" step="any" inputmode="decimal" value="" placeholder="Например: 60000"></div>
          <div><label for="fRentStartMonth">Начало учёта</label><input id="fRentStartMonth" type="month" min="1900-01" max="2200-12" value="${current}"></div>
        </div>
        <p class="field-hint">Сумма указывается один раз и подставляется на текущий и шесть следующих месяцев. Дальше остаётся только отмечать оплату.</p>
        <button type="button" class="btn" onclick="configureRent()">Начать учёт аренды</button>
      </div>`}
      ${ready?`
        <section class="card rent-period">
          <div class="rent-month-nav">
            <button type="button" class="btn secondary small" onclick="shiftRentMonth(-1)" aria-label="Предыдущий месяц" ${selectedMonth===rent.startMonth?'disabled':''}>←</button>
            <div><label for="rentMonthInput">Месяц аренды</label><input id="rentMonthInput" type="month" min="${rent.startMonth}" max="2200-12" value="${selectedMonth}" onchange="selectRentMonth(this.value)"></div>
            <button type="button" class="btn secondary small" onclick="shiftRentMonth(1)" aria-label="Следующий месяц">→</button>
          </div>
          ${payment?`
            <div class="kv"><span class="k">Аренда за ${escapeHtml(monthTitle(selectedMonth))}</span><strong>${fmtMoney(payment.amount)}</strong></div>
            <div class="rent-payment-state">${paidControl(payment)}<span class="${payment.paid?'rent-paid-note':'rent-due-note'}">${payment.paid?'Дата оплаты: '+fmtDate(payment.paidDate):'Ожидает оплаты — пока не уменьшает доход'}</span></div>
            <p class="field-hint">Отметьте «оплачено», когда аренда внесена: сумма вычтется из дохода за этот месяц.</p>
          `:`<p>Этот период ещё не создан.</p><button type="button" class="btn secondary" onclick="selectRentMonth('${selectedMonth}')">Открыть период</button>`}
        </section>
        <div class="section-title rent-history-heading"><h3>История по месяцам</h3></div>
        <div class="rent-history">${[...payments()].sort((a,b)=>b.month.localeCompare(a.month)).map(item=>`
          <article class="card rent-history-row">
            <div class="rent-history-main"><button type="button" class="rent-period-link" onclick="selectRentMonth('${item.month}')">${escapeHtml(monthTitle(item.month))}</button><div class="rent-history-sub">${item.paid?'Оплачено: '+fmtDate(item.paidDate):item.month<current?'Ожидает оплаты за прошедший месяц':item.month===current?'Ожидает оплаты':'Будущий период'}</div></div>
            <div class="rent-history-payment"><strong>${fmtMoney(item.amount)}</strong>${paidControl(item)}</div>
          </article>`).join('')}</div>
      `:'<div class="empty">Укажите сумму один раз — следующие месяцы будут заполняться автоматически.</div>'}`;
  }
  function renderRentReminder() {
    const card=document.getElementById('rentReminderCard'); if (!card) return;
    card.hidden=false;
    if (!configured()) {
      card.className='card rent-reminder';
      card.innerHTML='<div><h3>Настройте аренду</h3><p>Укажите ежемесячную сумму, чтобы учитывать оплату и доход после аренды.</p></div><button type="button" class="btn secondary small" onclick="openRentMonth()">Указать сумму</button>';
      return;
    }
    const current=currentMonth(), rent=rentModel();
    if (current<rent.startMonth) {
      card.className='card rent-reminder';
      card.innerHTML=`<div><h3>Аренда</h3><p>Учёт начнётся с ${escapeHtml(monthTitle(rent.startMonth))}.</p></div><button type="button" class="btn secondary small" onclick="openRentMonth('${rent.startMonth}')">Открыть</button>`;
      return;
    }
    const due=payments().filter(payment=>payment.paid!==true && payment.month<=current).sort((a,b)=>a.month.localeCompare(b.month));
    const currentRecord=paymentFor(current);
    if (due.length || !currentRecord) {
      const target=due[0]?.month || current;
      const planned=due.reduce((sum,item)=>sum+item.amount,0);
      const labels=due.slice(0,3).map(item=>monthTitle(item.month)).join(', ');
      card.className='card rent-reminder rent-reminder-due';
      card.innerHTML=`<div><h3>Необходимо оплатить аренду</h3><p>${due.length?escapeHtml(labels)+(due.length>3?' и ещё '+(due.length-3):'')+' · '+fmtMoney(planned):escapeHtml(monthTitle(current))}</p><p>До отметки «оплачено» эта сумма не вычитается из дохода.</p></div><button type="button" class="btn small" onclick="openRentMonth('${target}')">Перейти к оплате</button>`;
    } else {
      card.className='card rent-reminder rent-reminder-paid';
      card.innerHTML=`<div><h3>Аренда оплачена</h3><p>${escapeHtml(monthTitle(current))} · ${fmtMoney(currentRecord.amount)} · ${fmtDate(currentRecord.paidDate)}</p></div><button type="button" class="btn secondary small" onclick="openRentMonth('${current}')">Подробнее</button>`;
    }
  }

  Object.assign(window,{ensureRentPeriods,rentExpensesByMonth,totalPaidRent,renderRent,renderRentReminder,configureRent,selectRentMonth,shiftRentMonth,openRentMonth,toggleRentPaid});

  const page=document.createElement('main');page.id='page-rent';page.className='page';
  const tabbar=document.querySelector('.tabbar');tabbar.before(page);
  const tab=document.createElement('button');tab.type='button';tab.className='tabbtn';tab.dataset.tab='rent';
  tab.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7"/><path d="M9 10h6"/></svg><span class="tl">Аренда</span>';
  tab.addEventListener('click',()=>showPage('rent'));
  const financeTab=tabbar.querySelector('[data-tab="finance"]');
  if (financeTab) financeTab.after(tab); else tabbar.append(tab);

  const before=JSON.stringify(state);
  try { if (ensureRentPeriods()) saveState(); }
  catch (error) {state=JSON.parse(before);showToast('Не удалось подготовить аренду: '+error.message);}
  refreshRentViews();
  let knownMonth=currentMonth();
  setInterval(()=>{
    if (document.hidden || currentMonth()===knownMonth) return;
    if (typeof syncRentPeriods==='function') syncRentPeriods();
    knownMonth=currentMonth();
    renderHeader(); renderRentReminder();
    if (document.getElementById('page-finance')?.classList.contains('active')) renderFinance();
  },60000);
})();
