import base64, struct, zlib
from playwright.sync_api import sync_playwright
def png(path):
    w=h=40; raw=b''.join(b'\x00'+bytes([220,40,40,255])*w for _ in range(h))
    def ch(t,d): c=struct.pack('>I',len(d))+t+d; return c+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
    open(path,'wb').write(b'\x89PNG\r\n\x1a\n'+ch(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6,0,0,0))+ch(b'IDAT',zlib.compress(raw))+ch(b'IEND',b''))
png('/tmp/logo-test.png')
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':390,'height':800},locale='ru-RU').new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8765/'); pg.wait_for_selector('.auth')
    pg.fill('.auth input >> nth=0','Анна'); pg.fill('.auth input >> nth=1','1234'); pg.fill('.auth input >> nth=2','1234'); pg.click('text=Продолжить'); pg.check('#rc-ok'); pg.click('text=Начать работу'); pg.wait_for_selector('.tabbar')
    pg.goto('http://localhost:8765/#/settings'); pg.wait_for_selector('text=Название студии')
    name=pg.locator('input[aria-label="Название студии"]'); name.fill('Студия Лотос'); name.press('Tab')
    with pg.expect_file_chooser() as fc: pg.click('text=Выбрать логотип')
    fc.value.set_files('/tmp/logo-test.png'); pg.wait_for_timeout(600)
    src=pg.evaluate("document.querySelector('img[alt=\"Логотип\"]').src"); assert src.startswith('data:image/'),src[:30]
    assert pg.evaluate("document.querySelector('.bg img').src").startswith('data:image/')
    pg.goto('http://localhost:8765/#/overview'); pg.wait_for_selector('.title'); assert 'Студия Лотос' in pg.inner_text('body')
    assert pg.evaluate("document.title")=='Студия Лотос'
    pg.goto('http://localhost:8765/#/settings'); pg.wait_for_selector('text=Вернуть стандартный'); pg.click('text=Вернуть стандартный'); pg.wait_for_timeout(200)
    assert 'icons/logo.png' in pg.evaluate("document.querySelector('img[alt=\"Логотип\"]').src")
    # инструкция админа
    pg.goto('http://localhost:8765/#/faq'); pg.wait_for_selector('.faq-item'); assert pg.locator('.faq-item').count()>=8; pg.click('summary:has-text("название и логотип студии")'); assert pg.is_visible('text=восстанавливает исходный логотип')
    pg.screenshot(path='/tmp/shots/14-guide.png',full_page=False)
    # тренер видит только свою часть
    assert pg.evaluate("Guide.forRole('trainer').length")==1 and pg.evaluate("Guide.forRole('admin').length")==2
    assert not errs,errs; print('ok: логотип, название, инструкция'); b.close()
