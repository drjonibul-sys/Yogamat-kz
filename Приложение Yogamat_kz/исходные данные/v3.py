from playwright.sync_api import sync_playwright
URL='http://localhost:8101/'
out=lambda *a: print(*a, flush=True)
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':1112,'height':834},locale='ru-RU',timezone_id='Asia/Aqtobe',service_workers='block',storage_state='state.json')
    pg=ctx.new_page(); errs=[]; dl=[]
    pg.on('pageerror',lambda e:errs.append(str(e)[:200])); pg.on('console',lambda m: errs.append('console:'+m.text[:200]) if m.type=='error' else None)
    pg.on('dialog',lambda d:(dl.append(d.message[:90]),d.accept()))
    pg.goto(URL); pg.wait_for_timeout(600)
    out('session persisted as admin:',pg.evaluate("__access.role()"))
    # backup roundtrip with classes
    pg.evaluate("createBackup('manual')"); n=pg.evaluate("state.classes.length")
    pg.evaluate("state.classes=state.classes.slice(0,3);saveState()")
    bid=pg.evaluate("loadBackups()[0].id"); pg.evaluate(f"restoreBackup('{bid}')"); pg.wait_for_timeout(300)
    out('classes restored:',pg.evaluate("state.classes.length"),'/',n,'| visit classId kept:',pg.evaluate("!!state.visits[0].classId"),'| subs:',pg.evaluate("state.subscriptions.length"))
    snap=pg.evaluate("JSON.stringify(Object.assign({exportedAt:'x'},snapshotData()))")
    ok=pg.evaluate("(s)=>{try{const v=validateSnapshot(JSON.parse(s));return v.classes.length+':'+v.visits[0].classId.length}catch(e){return 'ERR '+e.message}}",snap); out('validateSnapshot:',ok)
    old=pg.evaluate("(()=>{const s=snapshotData();delete s.classes;return JSON.stringify(s)})()")
    out('old backup w/o classes keeps current classes:',pg.evaluate("(s)=>validateSnapshot(JSON.parse(s)).classes.length",old))
    # access store not in backups
    out('access keys in snapshot?', 'hash' in snap)
    # logout, trainer login
    pg.click('.header-settings-btn'); pg.click('#settingsLogout'); pg.wait_for_timeout(300)
    out('choose users:',pg.inner_text('#loginScreen').replace('\n',' | '))
    pg.click('[data-user]:has-text("Тренер")'); pg.fill('#loginPin','0000'); pg.click('#loginForm button[type=submit]'); out('wrong pin:',pg.inner_text('#loginError'))
    for i in range(4): pg.fill('#loginPin','0000'); pg.click('#loginForm button[type=submit]')
    out('after 5 fails:',pg.inner_text('#loginError')); pg.fill('#loginPin','4321'); pg.click('#loginForm button[type=submit]'); out('locked out right pin:',pg.inner_text('#loginError'))
    pg.evaluate("1"); 
    b.close()
