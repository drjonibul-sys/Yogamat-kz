from playwright.sync_api import sync_playwright
B='http://localhost:8765/'
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':800},device_scale_factor=2,locale='ru-RU'); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(B); pg.wait_for_selector('.auth'); pg.fill('.auth input >> nth=0','Анна'); pg.fill('.auth input >> nth=1','1234'); pg.fill('.auth input >> nth=2','1234')
    pg.select_option('.auth select','Город, в котором вы родились?'); pg.fill('.auth input[aria-label="Ответ на контрольный вопрос"]','Астана'); pg.click('text=Начать работу'); pg.wait_for_selector('.tabbar')
    pg.wait_for_selector('.off-badge'); pg.screenshot(path='/tmp/shots/25-off-start.png')
    pg.wait_for_selector('.off-badge.ready', timeout=60000); assert pg.inner_text('.off-badge').strip()=='Офлайн: готово'
    pg.screenshot(path='/tmp/shots/26-off-ready.png')
    st=pg.evaluate("({...App.offline.state})"); print('состояние:',st['shellHave'],'/',st['shellTotal'],' картинки',st['imgHave'],'/',st['imgTotal'])
    assert st['shellHave']==st['shellTotal']>0 and st['imgHave']==st['imgTotal']==400
    # настройки: подробный блок
    pg.goto(B+'#/settings'); pg.wait_for_selector('text=Работа без интернета'); assert pg.locator('.off-head.ready').count()==1; assert 'null' not in pg.inner_text('.page'); pg.screenshot(path='/tmp/shots/27-off-settings.png')
    # --- полностью без сети: перезагрузка, вход по сессии, справочник с картинками
    ctx.set_offline(True); pg.goto(B+'#/overview'); pg.reload(); pg.wait_for_selector('.tabbar', timeout=15000)
    pg.wait_for_selector('.off-badge.offline'); assert 'работает офлайн' in pg.inner_text('.off-badge')
    pg.goto(B+'#/catalog'); pg.wait_for_selector('.thumb'); pg.wait_for_timeout(500)
    ok=pg.evaluate("""async()=>{const r=await fetch('images/t/tadasana.webp'); const b=await r.blob(); return r.ok && b.size>500}"""); assert ok,'картинка не из кэша'
    pg.goto(B+'#/asana/tadasana'); pg.wait_for_selector('.hero-img'); pg.goto(B+'#/practices'); pg.wait_for_selector('.list-row')
    pg.goto(B+'#/clients'); pg.wait_for_selector('text=Клиенты')
    pg.screenshot(path='/tmp/shots/28-offline.png')
    pg.goto(B+'#/overview'); pg.wait_for_selector('.off-badge.offline'); ctx.set_offline(False); pg.wait_for_selector('.off-badge:not(.offline)',timeout=10000)
    assert not errs,errs; print('ok: офлайн — готовность, кэш, работа без сети'); b.close()
