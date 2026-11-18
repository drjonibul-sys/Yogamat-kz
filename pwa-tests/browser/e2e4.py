from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':390,'height':800},locale='ru-RU').new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8765/'); pg.wait_for_selector('.auth')
    pg.fill('.auth input >> nth=0','Анна'); pg.fill('.auth input >> nth=1','1234'); pg.fill('.auth input >> nth=2','1234'); pg.click('text=Продолжить'); pg.check('#rc-ok'); pg.click('text=Начать работу'); pg.wait_for_selector('.tabbar')
    pg.goto('http://localhost:8765/#/tariffs'); pg.wait_for_timeout(300)
    pg.locator('button[aria-label="Новый тариф"]').first.click(); pg.wait_for_timeout(300)
    inp=pg.locator('input[placeholder="15 000"]').first; inp.click(); inp.press_sequentially('1234567')
    v=inp.input_value().replace('\u00a0',' '); assert v=='1 234 567',v
    inp.press('Backspace'); v=inp.input_value().replace('\u00a0',' '); assert v=='123 456',v
    inp.fill(''); inp.press_sequentially('15000,5'); v=inp.input_value().replace('\u00a0',' '); assert v=='15 000,5',v
    assert pg.evaluate("getComputedStyle(document.body).webkitTextStrokeWidth")=='0.15px'
    assert not errs,errs; print('ok: разделители разрядов, контраст'); b.close()
