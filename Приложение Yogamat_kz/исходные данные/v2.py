from playwright.sync_api import sync_playwright
URL='http://localhost:8101/'
out=lambda *a: print(*a, flush=True)
def login_admin_setup(pg):
    pg.goto(URL); pg.wait_for_timeout(500)
    pg.fill('#loginPin','1234'); pg.fill('#loginPin2','1234'); pg.click('#loginForm button[type=submit]'); pg.wait_for_timeout(300); pg.click('#loginContinue'); pg.wait_for_timeout(300)
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':1112,'height':834},locale='ru-RU',timezone_id='Asia/Aqtobe',service_workers='block')
    pg=ctx.new_page(); errs=[]; dl=[]
    pg.on('pageerror',lambda e:errs.append(str(e)[:200])); pg.on('console',lambda m: errs.append('console:'+m.text[:200]) if m.type=='error' else None)
    pg.on('dialog',lambda d:(dl.append(d.message[:90]),d.accept()))
    login_admin_setup(pg)
    # --- classes
    pg.click('.tabbtn[data-tab=classes]'); pg.wait_for_timeout(300)
    out('classes total:',pg.locator('#classList .class-card').count(),'| tabs:',pg.evaluate("[...document.querySelectorAll('.tabbtn')].map(b=>b.dataset.tab).join(',')"))
    pg.click('#classFilterPills .pill >> text=Пилатес'); out('pilates:',pg.locator('#classList .class-card').count())
    pg.click('#classFilterPills .pill >> text=Все')
    pg.screenshot(path='shots/10-classes.png')
    # add trainer first
    pg.click('.header-settings-btn'); pg.wait_for_timeout(200)
    pg.click('[data-act=trainer-new]'); pg.wait_for_timeout(200)
    pg.click('#fTrainerName'); pg.keyboard.type('Айдана Ж.'); pg.click('#fTrainerPin'); pg.keyboard.type('4321')
    out('typed name:',pg.input_value('#fTrainerName'),'pin len:',len(pg.input_value('#fTrainerPin')))
    pg.click('#fTrainerSave'); pg.wait_for_timeout(300)
    out('trainers listed:',pg.inner_text('#settingsUsersCard').replace('\n',' | ')[:200])
    # edit class -> add own class with trainer
    pg.click('.tabbtn[data-tab=classes]'); pg.click('#page-classes .btn-add'); pg.wait_for_timeout(200)
    pg.fill('#fClassName','Йога для беременных+'); pg.fill('#fClassSchedule','Вт, Чт 10:00')
    pg.check('.class-trainer'); pg.click('#sheetContent .btn >> text=Сохранить'); pg.wait_for_timeout(300)
    out('classes after add:',pg.locator('#classList .class-card').count(), 'has trainer line:', 'Тренер: Айдана' in pg.inner_text('#classList'))
    # edit existing class
    pg.click('#classList .class-card >> nth=0'); pg.wait_for_timeout(200)
    pg.fill('#fClassCapacity','9'); pg.fill('#fClassDescription','Тест описания'); pg.click('#sheetContent .btn >> text=Сохранить'); pg.wait_for_timeout(200)
    out('first class edited:', pg.evaluate("state.classes.some(c=>c.capacity===9&&c.description==='Тест описания')"))
    # delete class
    pg.click('#classList .class-card >> text=Йога для беременных+'); pg.wait_for_timeout(200); pg.click('#sheetContent .btn.danger'); pg.wait_for_timeout(200)
    out('after delete:',pg.locator('#classList .class-card').count())
    # --- client + sale via UI
    pg.click('.tabbtn[data-tab=clients]'); pg.click('#page-clients .btn-add'); pg.wait_for_timeout(200)
    pg.click('#fClientName'); pg.keyboard.type('Мария Тестова'); pg.fill('#fClientPhone','7001112233'); pg.click('#fClientNotes'); pg.keyboard.type('Колени')
    out('typing works: name=',pg.input_value('#fClientName'),'phone=',pg.input_value('#fClientPhone'),'notes=',pg.input_value('#fClientNotes'))
    pg.click('#sheetContent .btn >> text=Сохранить'); pg.wait_for_timeout(300)
    pg.click('#clientList .list-row >> nth=0'); pg.wait_for_timeout(300)
    pg.click('#page-client-detail .btn-row .btn >> text=Продать'); pg.wait_for_timeout(300)
    pg.click('#sheetContent .btn >> text=Продать абонемент'); pg.wait_for_timeout(300)
    out('subs:',pg.evaluate("state.subscriptions.length"))
    # edit subscription
    pg.click('#cdSubs .btn >> text=Изменить абонемент'); pg.wait_for_timeout(300)
    pg.screenshot(path='shots/11-subedit.png')
    pg.fill('#fSubEditPrice','25000'); pg.fill('#fSubEditTotal','10'); pg.fill('#fSubEditLeft','9'); pg.fill('#fSubEditExpiry','2027-01-15')
    pg.click('#fSubEditPaid'); out('paid date prefilled:',pg.input_value('#fSubEditPaidDate'))
    pg.fill('#fSubEditPaidDate','2026-11-05')
    pg.click('#sheetContent .btn >> text=Сохранить'); pg.wait_for_timeout(300)
    s=pg.evaluate("state.subscriptions[0]"); out('sub edited:',{k:s[k] for k in ['visitsTotal','visitsLeft','price','expiryDate','paid','paidDate']})
    # bad edit rejected
    pg.click('#cdSubs .btn >> text=Изменить абонемент'); pg.fill('#fSubEditLeft','99'); pg.click('#sheetContent .btn >> text=Сохранить'); pg.wait_for_timeout(200)
    out('invalid rejected, toast:',pg.inner_text('#toast')); pg.click('.sheet-close')
    # visit via sheet with direction
    pg.click('#page-client-detail .btn >> text=Отметить визит'); pg.wait_for_timeout(300)
    pg.select_option('#fVisitClass',index=1); pg.click('#sheetContent .btn >> text=Отметить'); pg.wait_for_timeout(300)
    out('visits:',pg.evaluate("state.visits.map(v=>({d:v.date,c:!!v.classId,by:v.markedBy}))"))
    # edit visit
    pg.click('.subtab[data-cd=visits]'); pg.click('#cdVisits .btn >> text=Изменить'); pg.wait_for_timeout(200)
    pg.fill('#fVisitEditDate','2026-11-10'); pg.click('#sheetContent .btn >> text=Сохранить'); out('before-purchase toast:',pg.inner_text('#toast')); pg.fill('#fVisitEditDate','2026-11-20'); pg.click('#sheetContent .btn >> text=Сохранить'); pg.wait_for_timeout(300)
    out('visit date after edit:',pg.evaluate("state.visits[0].date"),'| list:',pg.inner_text('#cdVisits').replace('\n',' | ')[:100])
    pg.click('#cdVisits .btn >> text=Изменить'); pg.fill('#fVisitEditDate','2028-01-01'); pg.click('#sheetContent .btn >> text=Сохранить'); pg.wait_for_timeout(200)
    out('visit outside term toast:',pg.inner_text('#toast')); pg.click('.sheet-close')
    # transfer add/edit/delete
    pg.click('.subtab[data-cd=subs]'); pg.click('#cdSubs .btn >> text=Перенести'); pg.wait_for_timeout(200)
    pg.fill('#fTransferDays','7'); pg.click('#sheetContent .btn >> text=Продлить'); pg.wait_for_timeout(300)
    out('expiry after transfer:',pg.evaluate("state.subscriptions[0].expiryDate"))
    pg.click('.subtab[data-cd=info]'); pg.click('#cdInfo .row-actions .btn >> nth=0'); pg.wait_for_timeout(200)
    pg.fill('#fTransferEditDays','10'); pg.click('#sheetContent .btn >> text=Сохранить'); pg.wait_for_timeout(300)
    out('expiry after edit 7->10:',pg.evaluate("state.subscriptions[0].expiryDate"))
    pg.click('#cdInfo .row-actions .btn >> nth=0'); pg.click('#sheetContent .btn.danger'); pg.wait_for_timeout(300)
    out('expiry after delete:',pg.evaluate("state.subscriptions[0].expiryDate"),'transfers:',pg.evaluate("state.transfers.length"))
    # client edit incl since + attendance note
    pg.click('#cdInfo .btn >> text=Редактировать клиента'); pg.wait_for_timeout(200)
    pg.fill('#fClientName','Мария Т.'); pg.fill('#fClientSince','2026-09-01'); pg.fill('#fClientAttNote','йога-блок'); pg.click('#sheetContent .btn >> text=Сохранить'); pg.wait_for_timeout(300)
    out('client:',pg.evaluate("(({name,createdAt,attendanceNote})=>({name,createdAt,attendanceNote}))(state.clients[0])"))
    # attendance grid with class filter
    pg.click('.tabbtn[data-tab=attendance]'); pg.wait_for_timeout(300)
    out('filter options:',pg.locator('#attClassFilter option').count())
    pg.screenshot(path='shots/12-grid.png')
    # rent
    pg.click('.tabbtn[data-tab=rent]'); pg.wait_for_timeout(300)
    pg.fill('#fRentDefaultAmount','60000'); pg.click('#page-rent .btn >> text=Начать учёт'); pg.wait_for_timeout(400)
    rp=pg.inner_text('#page-rent'); out('rent page has "Сохранить"?', 'Сохранить' in rp, '| inputs:', pg.evaluate("[...document.querySelectorAll('#page-rent input')].map(i=>i.id||i.type)"))
    pg.screenshot(path='shots/13-rent.png',full_page=True)
    pg.click('#page-rent .rent-payment-state .pay-switch'); pg.wait_for_timeout(300)
    out('rent paid:',pg.evaluate("state.rent.payments.filter(x=>x.paid).length"))
    out('errs',errs,'dialogs',dl)
    ctx.storage_state(path='state.json')
    b.close()
