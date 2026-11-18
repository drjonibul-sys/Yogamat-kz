import time
from playwright.sync_api import sync_playwright
B='http://localhost:8765/'
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':800},device_scale_factor=2,locale='ru-RU',service_workers='block'); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    # «на сайте» версия новее
    ctx.route('**/version.json*', lambda r: r.fulfill(status=200, content_type='application/json', body='{"version":"9.9.9"}'))
    pg.goto(B); pg.wait_for_selector('.auth'); pg.fill('.auth input >> nth=0','Анна'); pg.fill('.auth input >> nth=1','1234'); pg.fill('.auth input >> nth=2','1234')
    pg.select_option('.auth select','Город, в котором вы родились?'); pg.fill('.auth input[aria-label="Ответ на контрольный вопрос"]','Астана'); pg.click('text=Начать работу'); pg.wait_for_selector('.tabbar')
    pg.wait_for_selector('text=Доступна версия 9.9.9')
    # замедляем скачивание файлов оболочки
    state={'n':0,'fail':False}
    def slow(route):
        state['n']+=1
        if state['fail'] and state['n']>4: return route.abort()
        time.sleep(0.12); route.continue_()
    for pat in ['**/*.js','**/*.css','**/*.ttf','**/*.webmanifest','**/*.png','**/index.html']: ctx.route(pat, slow)
    # --- сбой сети посередине: старая версия остаётся, есть «Повторить»
    state['fail']=True; pg.click('text=Обновить до 9.9.9 >> nth=0') if pg.locator('text=Обновить до 9.9.9').count() else pg.click('button:has-text("Обновить")')
    pg.wait_for_selector('.upd'); assert pg.get_attribute('.upd','aria-busy')=='true'
    pg.wait_for_selector('.upd.err', timeout=20000); assert 'прежней версии' in pg.inner_text('.upd'); pg.screenshot(path='/tmp/shots/24-upd-error.png')
    assert pg.locator('.upd button:has-text("Повторить")').count()==1
    pg.click('.upd button:has-text("Закрыть")'); assert pg.locator('.upd').count()==0; assert pg.evaluate("!document.body.classList.contains('locked')")
    # --- успешный ход: проценты растут, затем перезапуск
    state['fail']=False; state['n']=0; seen=set()
    pg.click('button:has-text("Обновить")')
    pg.wait_for_selector('.upd'); shot=False; t0=time.time()
    while time.time()-t0<40:
        try: v=int(pg.get_attribute('.upd-bar','aria-valuenow',timeout=500)); seen.add(v)
        except Exception: break
        if 30<v<70 and not shot: pg.screenshot(path='/tmp/shots/23-upd-progress.png'); shot=True
        if v==100: pg.wait_for_timeout(900); break
        pg.wait_for_timeout(80)
    pg.wait_for_function("!document.querySelector('.upd')", timeout=15000)
    print('значения хода:', sorted(seen)[:12], '… всего', len(seen))
    assert len(seen)>=5 and max(seen)>=88 and shot
    pg.wait_for_selector('.tabbar'); assert not errs,errs; print('ok: окно обновления — ход, ошибка сети, перезапуск'); b.close()
