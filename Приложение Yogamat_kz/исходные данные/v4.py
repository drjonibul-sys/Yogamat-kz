from playwright.sync_api import sync_playwright
URL='http://localhost:8101/'
out=lambda *a: print(*a, flush=True)
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':1112,'height':834},locale='ru-RU',timezone_id='Asia/Aqtobe',service_workers='block',storage_state='state.json')
    pg=ctx.new_page(); errs=[]; dl=[]
    pg.on('pageerror',lambda e:errs.append(str(e)[:200])); pg.on('console',lambda m: errs.append('console:'+m.text[:200]) if m.type=='error' else None)
    pg.on('dialog',lambda d:(dl.append(d.message[:90]),d.accept()))
    pg.goto(URL); pg.wait_for_timeout(500)
    pg.click('.header-settings-btn'); pg.click('#settingsLogout'); pg.wait_for_timeout(200)
    pg.click('[data-user]:has-text("Тренер")'); pg.fill('#loginPin','4321'); pg.click('#loginForm button[type=submit]'); pg.wait_for_timeout(400)
    out('role:',pg.evaluate("__access.role()"),'name:',pg.evaluate("__access.name()"))
    vis=pg.evaluate("[...document.querySelectorAll('.tabbtn')].filter(b=>b.offsetParent!==null).map(b=>b.dataset.tab).join(',')"); out('visible tabs:',vis)
    out('header stats visible:',pg.evaluate("[...document.querySelectorAll('.header-stat .item')].map(e=>e.offsetParent!==null)"))
    out('dash admin-only hidden (sell btn):',not pg.is_visible('#page-dashboard .admin-only'),'| rent card hidden:',not pg.is_visible('#rentReminderCard'))
    pg.screenshot(path='shots/20-trainer-dash.png')
    # forbidden pages/functions
    for name in ['finance','rent','sales','plans']:
        pg.evaluate(f"showPage('{name}')"); out(f'showPage({name}) -> active:',pg.evaluate("document.querySelector('.page.active').id"))
    pg.evaluate("openSaleSheet()"); out('openSaleSheet toast:',pg.inner_text('#toast'),'| sheet open:',pg.evaluate("document.getElementById('overlay').classList.contains('active')"))
    n=pg.evaluate("state.subscriptions[0].paid"); pg.evaluate("toggleSubPaid(state.subscriptions[0].id)"); out('toggleSubPaid blocked:',pg.evaluate("state.subscriptions[0].paid")==n)
    pg.evaluate("openClientSheet()"); out('openClientSheet open?',pg.evaluate("document.getElementById('overlay').classList.contains('active')"))
    pg.evaluate("openSubEditSheet(state.subscriptions[0].id)"); out('openSubEditSheet open?',pg.evaluate("document.getElementById('overlay').classList.contains('active')"))
    pg.evaluate("saveClass('')"); pg.evaluate("openArchiveSheet()"); out('archive open?',pg.evaluate("document.getElementById('overlay').classList.contains('active')"))
    # settings for trainer
    pg.click('.header-settings-btn'); pg.wait_for_timeout(300)
    out('settings visible text:',pg.inner_text('#page-settings').replace('\n',' | ')[:300])
    pg.screenshot(path='shots/21-trainer-settings.png')
    # clients and detail
    pg.click('.tabbtn[data-tab=clients]'); out('add client btn visible:',pg.is_visible('#page-clients .btn-add'))
    pg.click('#clientList .list-row >> nth=0'); pg.wait_for_timeout(300)
    d=pg.inner_text('#cdSubs'); out('sub card shows price/pay?', '₸' in d, 'оплачено' in d.lower(), '| has edit sub btn:', 'Изменить абонемент' in d, '| transfer btn:', 'Перенести' in d)
    pg.screenshot(path='shots/22-trainer-detail.png')
    pg.click('.subtab[data-cd=info]'); out('info:', pg.inner_text('#cdInfo').replace('\n',' | ')[:200])
    # trainer allowed: visit mark, edit visit date, transfer
    pg.click('.subtab[data-cd=subs]'); pg.click('#page-client-detail .btn >> text=Отметить визит'); pg.fill('#fVisitDate','2026-11-18'); pg.click('#sheetContent .btn >> text=Отметить'); pg.wait_for_timeout(300)
    out('visits:',pg.evaluate("state.visits.map(v=>v.date+'/'+v.markedBy).join(', ')"))
    pg.click('.subtab[data-cd=visits]'); pg.click('#cdVisits .list-row >> nth=0 >> text=Изменить'); pg.fill('#fVisitEditDate','2026-11-19'); pg.click('#sheetContent .btn >> text=Сохранить'); pg.wait_for_timeout(300)
    out('after trainer edit:',pg.evaluate("state.visits.map(v=>v.date+'/'+(v.editedBy||'')).join(', ')"))
    pg.click('.subtab[data-cd=subs]'); pg.click('#cdSubs .btn >> text=Перенести'); pg.fill('#fTransferDays','3'); pg.click('#sheetContent .btn >> text=Продлить'); pg.wait_for_timeout(300)
    out('trainer transfer ok:',pg.evaluate("state.transfers.length"),pg.evaluate("state.subscriptions[0].expiryDate"))
    pg.click('.subtab[data-cd=info]'); pg.click('#cdInfo .row-actions .btn'); pg.fill('#fTransferEditDays','5'); pg.click('#sheetContent .btn >> text=Сохранить'); pg.wait_for_timeout(200)
    out('trainer edit transfer:',pg.evaluate("state.subscriptions[0].expiryDate"))
    # attendance grid for trainer: note edit + toggle
    pg.click('.tabbtn[data-tab=attendance]'); pg.wait_for_timeout(300)
    out('pay-note visible in grid:',pg.is_visible('.att-table .pay-note'))
    pg.fill('.att-table .note-col input','принести коврик'); pg.keyboard.press('Tab'); pg.wait_for_timeout(200)
    out('note saved:',pg.evaluate("state.clients[0].attendanceNote"))
    pg.screenshot(path='shots/23-trainer-grid.png')
    # classes view-only
    pg.click('.tabbtn[data-tab=classes]'); out('class + btn visible:',pg.is_visible('#page-classes .btn-add')); pg.click('#classList .class-card >> nth=0'); pg.wait_for_timeout(200)
    out('class view sheet inputs:',pg.locator('#sheetContent input').count()); pg.screenshot(path='shots/24-trainer-class.png'); pg.click('.sheet-close')
    out('errs',errs,'dialogs',dl)
    b.close()
