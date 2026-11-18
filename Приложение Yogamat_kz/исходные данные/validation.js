/* Validate imported data before replacing the live store, and preserve visit accounting. */
(function(){
  'use strict';
  const collections=['clients','plans','subscriptions','visits','transfers'];
  const safeID=value=>typeof value==='string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
  const text=(value,max=2000)=>typeof value==='string' && value.length<=max;
  const integer=(value,min=0,max=1000000)=>Number.isSafeInteger(value) && value>=min && value<=max;
  const money=value=>typeof value==='number' && Number.isFinite(value) && value>=0 && value<=1e12;
  const month=value=>typeof value==='string' && /^(19\d{2}|20\d{2}|21\d{2}|2200)-(0[1-9]|1[0-2])$/.test(value);
  function date(value){
    if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
    const d=new Date(value+'T12:00:00');
    return !Number.isNaN(d.getTime()) && localISO(d)===value && d.getFullYear()>=1900 && d.getFullYear()<=2200;
  }
  function fail(message){throw new Error(message);}
  function assert(condition,message){if(!condition)fail(message);}
  function optionalText(value,max){assert(value===undefined || text(value,max),'Некорректное текстовое поле');return value||'';}
  window.validateSnapshot=function(input){
    assert(input && typeof input==='object' && !Array.isArray(input),'Файл не похож на резервную копию');
    const out={};
    for(const key of collections){
      assert(Array.isArray(input[key]),'В копии отсутствует список «'+key+'»');
      assert(input[key].length<=50000,'Слишком много записей в копии');
      const ids=new Set();
      for(const record of input[key]){
        assert(record && typeof record==='object' && !Array.isArray(record) && safeID(record.id),'Некорректный идентификатор записи');
        assert(!ids.has(record.id),'Повторяющийся идентификатор записи');ids.add(record.id);
      }
    }
    out.clients=input.clients.map(c=>{
      assert(text(c.name,200) && c.name.trim(),'У клиента не указано имя');assert(date(c.createdAt),'Некорректная дата клиента');
      return {id:c.id,name:c.name,phone:optionalText(c.phone,100),notes:optionalText(c.notes,5000),attendanceNote:optionalText(c.attendanceNote,2000),createdAt:c.createdAt};
    });
    out.plans=input.plans.map(p=>{
      assert(text(p.name,200) && p.name.trim() && integer(p.visitsCount,1) && integer(p.durationDays,1,36500) && money(p.price),'Некорректный тариф');
      return {id:p.id,name:p.name,visitsCount:p.visitsCount,durationDays:p.durationDays,price:p.price};
    });
    const clientIDs=new Set(out.clients.map(c=>c.id));
    out.subscriptions=input.subscriptions.map(s=>{
      assert(clientIDs.has(s.clientId) && safeID(s.planId),'Некорректная ссылка в абонементе');
      assert(date(s.purchaseDate) && date(s.expiryDate) && s.expiryDate>=s.purchaseDate,'Некорректные даты абонемента');
      assert(integer(s.visitsTotal,1) && integer(s.visitsLeft,0,s.visitsTotal) && money(s.price),'Некорректные занятия или цена абонемента');
      assert(s.paid===undefined || typeof s.paid==='boolean','Некорректная отметка об оплате');
      assert(!s.paid || date(s.paidDate),'Некорректная дата оплаты');
      return {id:s.id,clientId:s.clientId,planId:s.planId,purchaseDate:s.purchaseDate,expiryDate:s.expiryDate,visitsTotal:s.visitsTotal,visitsLeft:s.visitsLeft,price:s.price,paid:!!s.paid,paidDate:s.paid?s.paidDate:null};
    });
    const subscriptions=new Map(out.subscriptions.map(s=>[s.id,s]));
    out.visits=input.visits.map(v=>{
      const s=subscriptions.get(v.subscriptionId);
      assert(s && s.clientId===v.clientId && date(v.date),'Некорректная ссылка или дата посещения');
      assert(text(v.createdAt,60) && !Number.isNaN(Date.parse(v.createdAt)),'Некорректное время посещения');
      return {id:v.id,clientId:v.clientId,subscriptionId:v.subscriptionId,date:v.date,createdAt:v.createdAt,classId:(typeof v.classId==='string' && safeID(v.classId))?v.classId:'',markedBy:optionalText(v.markedBy,200),editedBy:optionalText(v.editedBy,200)};
    });
    out.transfers=input.transfers.map(t=>{
      const s=subscriptions.get(t.subscriptionId);
      assert(s && s.clientId===t.clientId && date(t.date) && integer(t.daysAdded,1,36500),'Некорректный перенос');
      return {id:t.id,clientId:t.clientId,subscriptionId:t.subscriptionId,date:t.date,daysAdded:t.daysAdded,comment:optionalText(t.comment,2000)};
    });
    if(input.classes===undefined){ out.classes=Array.isArray(state.classes)?state.classes:[]; }
    else {
      assert(Array.isArray(input.classes) && input.classes.length<=500,'Некорректный список направлений');
      const classIds=new Set();
      out.classes=input.classes.map(c=>{
        assert(c && typeof c==='object' && !Array.isArray(c) && safeID(c.id) && !classIds.has(c.id),'Некорректное направление');classIds.add(c.id);
        assert(text(c.name,200) && c.name.trim(),'У направления не указано название');
        assert(['yoga','pilates','other'].includes(c.type),'Некорректный вид направления');
        assert(integer(c.durationMin===undefined?0:c.durationMin,0,600) && integer(c.capacity===undefined?0:c.capacity,0,1000),'Некорректная длительность или число мест');
        assert(c.trainerIds===undefined || (Array.isArray(c.trainerIds) && c.trainerIds.length<=100 && c.trainerIds.every(safeID)),'Некорректный список тренеров');
        return {id:c.id,name:c.name,type:c.type,level:optionalText(c.level,100),durationMin:c.durationMin||0,capacity:c.capacity||0,trainerIds:c.trainerIds||[],schedule:optionalText(c.schedule,500),equipment:optionalText(c.equipment,500),description:optionalText(c.description,5000),active:c.active!==false};
      });
    }
    out.rent=emptyRentState();
    if(input.rent!==undefined){
      const rent=input.rent;
      assert(rent && typeof rent==='object' && !Array.isArray(rent),'Некорректные настройки аренды');
      assert(Array.isArray(rent.payments) && rent.payments.length<=3600,'Некорректный список платежей аренды');
      const configured=money(rent.defaultAmount) && month(rent.startMonth);
      assert(configured || (rent.defaultAmount===null && rent.startMonth===null && rent.payments.length===0),'Проверьте сумму и начало учёта аренды');
      const months=new Set(),ids=new Set();
      const payments=rent.payments.map(payment=>{
        assert(payment && typeof payment==='object' && !Array.isArray(payment) && safeID(payment.id),'Некорректный платёж аренды');
        assert(!ids.has(payment.id),'Повторяющийся идентификатор аренды');ids.add(payment.id);
        assert(month(payment.month) && payment.month>=rent.startMonth,'Некорректный месяц аренды');
        assert(!months.has(payment.month),'Повторяющийся месяц аренды');months.add(payment.month);
        assert(money(payment.amount) && typeof payment.paid==='boolean','Некорректная сумма или отметка оплаты аренды');
        assert(!payment.paid || date(payment.paidDate),'Некорректная дата оплаты аренды');
        return {id:payment.id,month:payment.month,amount:payment.amount,paid:payment.paid,paidDate:payment.paid?payment.paidDate:null};
      });
      out.rent={defaultAmount:rent.defaultAmount,startMonth:rent.startMonth,payments};
    }
    return out;
  };
  window.applySnapshot=function(data){
    const validated=validateSnapshot(data);
    const previous=state;
    try{
      state=validated;
      if(typeof ensureRentPeriods==='function') ensureRentPeriods();
      saveState();
    }catch(error){state=previous;throw error;}
  };
  window.restoreSnapshotText=function(raw,confirmation){
    let validated;
    try{
      assert(typeof raw==='string' && raw.length<=20*1024*1024,'Файл слишком большой');
      validated=validateSnapshot(JSON.parse(raw));
    }catch(error){showToast('Копия не загружена: '+(error instanceof SyntaxError?'ошибка JSON':error.message));return false;}
    if(!confirm(confirmation || 'Восстановить данные из файла? Текущее состояние сохранится в копии «перед восстановлением».'))return false;
    const previous=state;
    try{
      createBackup('pre-restore');
      state=validated;
      if(typeof ensureRentPeriods==='function') ensureRentPeriods();
      saveState();
    }catch(error){state=previous;showToast('Не удалось сохранить данные: '+error.message);return false;}
    closeSheet();showPage('dashboard');showToast('Данные восстановлены');return true;
  };
  window.importBackupFile=function(input){
    const file=input.files && input.files[0];if(!file)return;
    if(file.size>20*1024*1024){showToast('Файл слишком большой');input.value='';return;}
    const reader=new FileReader();
    reader.onload=()=>{restoreSnapshotText(String(reader.result));input.value='';};
    reader.onerror=()=>{showToast('Не удалось прочитать файл');input.value='';};
    reader.readAsText(file);
  };
  window.restoreBackup=function(id){
    const backup=loadBackups().find(b=>b.id===id);if(!backup)return;
    restoreSnapshotText(backup.data,'Восстановить выбранную резервную копию? Текущее состояние сохранится в копии «перед восстановлением».');
  };
  const originalSavePlan=savePlan,originalSaveSale=saveSale,originalSaveTransfer=saveTransfer;
  window.savePlan=function(id){
    const count=Number(document.getElementById('fPlanVisits').value),days=Number(document.getElementById('fPlanDuration').value),price=Number(document.getElementById('fPlanPrice').value);
    if(!integer(count,1) || !integer(days,1,36500) || !money(price)){showToast('Укажите целые занятия, срок и неотрицательную цену');return;}
    // Original routine requires a nonzero price; allow a free tariff explicitly.
    if(price===0){
      const name=document.getElementById('fPlanName').value.trim();if(!name){showToast('Введите название тарифа');return;}
      const record={name,visitsCount:count,durationDays:days,price};
      if(id){const plan=getPlan(id);if(!plan)return;Object.assign(plan,record);}else state.plans.push({id:uid(),...record});
      saveState();closeSheet();renderPlans();showToast('Тариф сохранён');return;
    }
    originalSavePlan(id);
  };
  window.saveSale=function(){
    const count=Number(document.getElementById('fSaleVisits').value),price=Number(document.getElementById('fSalePrice').value),start=document.getElementById('fSaleDate').value,end=document.getElementById('fSaleExpiry').value;
    if(!integer(count,1) || !money(price) || !date(start) || !date(end) || end<start){showToast('Проверьте занятия, цену и даты абонемента');return;}
    originalSaveSale();
  };
  window.saveTransfer=function(id){
    const sub=state.subscriptions.find(s=>s.id===id),days=Number(document.getElementById('fTransferDays').value),when=document.getElementById('fTransferDate').value;
    if(!sub || !integer(days,1,36500) || !date(when) || !date(addDays(sub.expiryDate,days))){showToast('Проверьте число дней и дату переноса');return;}
    originalSaveTransfer(id);
  };
  function eligibleSubscription(clientId,when){
    return state.subscriptions.filter(s=>s.clientId===clientId && s.visitsLeft>0 && s.purchaseDate<=when && s.expiryDate>=when).sort((a,b)=>a.expiryDate.localeCompare(b.expiryDate))[0];
  }
  function addVisit(clientId,when,classId){
    if(!date(when)){showToast('Укажите корректную дату занятия');return false;}
    if(state.visits.some(v=>v.clientId===clientId && v.date===when)){showToast('Посещение в этот день уже отмечено');return false;}
    const sub=eligibleSubscription(clientId,when);
    if(!sub){showToast('На эту дату нет действующего абонемента');return false;}
    sub.visitsLeft-=1;
    state.visits.push({id:uid(),clientId,subscriptionId:sub.id,date:when,classId:classId||'',markedBy:actorName(),createdAt:new Date().toISOString()});saveState();return true;
  }
  window.saveVisit=function(){
    const cls=document.getElementById('fVisitClass');
    if(!addVisit(document.getElementById('fVisitClient').value,document.getElementById('fVisitDate').value,cls?cls.value:''))return;
    closeSheet();renderDashboard();
    if(document.getElementById('page-visits').classList.contains('active'))renderVisitsPage();
    if(document.getElementById('page-client-detail').classList.contains('active'))renderClientDetail();
    if(document.getElementById('page-attendance').classList.contains('active'))renderAttendanceGrid();
    showToast('Посещение отмечено');
  };
  window.toggleAttendanceCell=function(clientId,when){
    const filter=typeof attendanceClassFilter==='string'?attendanceClassFilter:'';
    const existing=state.visits.find(v=>v.clientId===clientId && v.date===when);
    if(existing && filter && existing.classId!==filter){showToast('В этот день отмечено другое направление');return;}
    if(existing){
      const sub=state.subscriptions.find(s=>s.id===existing.subscriptionId);if(sub)sub.visitsLeft=Math.min(sub.visitsTotal,sub.visitsLeft+1);
      state.visits=state.visits.filter(v=>v.id!==existing.id);saveState();renderAttendanceGrid();renderHeader();showToast('Отметка снята');return;
    }
    if(addVisit(clientId,when,filter)){renderAttendanceGrid();renderHeader();showToast('Визит отмечен');}
  };
})();
