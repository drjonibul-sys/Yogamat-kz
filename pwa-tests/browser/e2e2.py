"""Проверка версии 1.1.0: тема, телефон, возврат из асаны в комплекс, порядок кнопок, сравнение версий."""
import sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
res = []
def ok(n, c): res.append(bool(c)); print(('ok   ' if c else 'FAIL ') + n)
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 390, 'height': 844}, locale='ru-RU', color_scheme='light'); page = ctx.new_page()
    errs = []; page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto(BASE); page.wait_for_selector('.auth')
    page.fill('.auth input >> nth=0', 'Анна'); page.fill('.auth input >> nth=1', '1234'); page.fill('.auth input >> nth=2', '1234')
    page.select_option('.auth select','Город, в котором вы родились?'); page.fill('.auth input[aria-label="Ответ на контрольный вопрос"]','Астана'); page.click('text=Начать работу'); page.wait_for_selector('.tabbar')
    # тема
    page.goto(BASE + '#/settings'); page.wait_for_selector('text=Как в системе')
    bg = lambda: page.evaluate("getComputedStyle(document.body).backgroundColor")
    light = bg(); page.click('.chip:has-text("Тёмная")'); dark = bg()
    ok('тёмная тема меняет фон', light != dark and page.evaluate("document.documentElement.dataset.theme") == 'dark')
    page.reload(); page.wait_for_selector('.tabbar'); ok('тема сохраняется после перезапуска', bg() == dark)
    page.goto(BASE + '#/settings'); page.click('.chip:has-text("Как в системе")')
    ok('«как в системе» снимает принудительную тему', page.evaluate("document.documentElement.dataset.theme") is None and bg() == light)
    page.emulate_media(color_scheme='dark'); page.wait_for_timeout(100); ok('следует системной тёмной теме', bg() == dark)
    page.click('.chip:has-text("Светлая")'); ok('«светлая» перекрывает тёмную систему', bg() == light)
    page.emulate_media(color_scheme='light')
    # телефон
    page.goto(BASE + '#/clients'); page.click('[aria-label="Новый клиент"]'); page.wait_for_selector('.sheet')
    ph = page.locator('.sheet input[type="tel"]'); ph.focus(); ok('при фокусе подставляется +7', ph.input_value() == '+7 ')
    ph.type('7012345678'); ok('набор форматируется', ph.input_value() == '+7 701 234 56 78')
    ph.fill(''); ph.fill('87051112233'); ph.dispatch_event('input'); ok('8… заменяется на +7', ph.input_value() == '+7 705 111 22 33')
    page.fill('.sheet input >> nth=0', 'Тест'); page.click('.sheet-foot .btn'); page.wait_for_selector('text=Клиент с')
    ok('телефон сохранён в формате', '+7 705 111 22 33' in page.inner_text('.page'))
    # порядок кнопок комплексов
    page.goto(BASE + '#/practices'); page.wait_for_selector('.seg .chip')
    ok('порядок кнопок комплексов', [t.strip() for t in page.locator('.seg .chip').all_inner_texts()] == ['Все', 'Лёгкая', 'Лёгкая → средняя', 'Средняя', 'Средняя → тяжёлая', 'Тяжёлая'])
    heads = [t.lower() for t in page.locator('.sec-title').all_inner_texts()]
    ok('разделы списка в том же порядке', heads == ['лёгкая', 'лёгкая → средняя', 'средняя', 'средняя → тяжёлая', 'тяжёлая'])
    # возврат из асаны в комплекс
    page.locator('.list-row').first.click(); page.wait_for_selector('text=План занятия'); url = page.url
    page.locator('.chip:has-text("") >> nth=7').click() if False else None
    page.locator('.card .chip').first.click(); page.wait_for_selector('.hero-img')
    page.click('[aria-label="Назад"]'); page.wait_for_selector('text=План занятия')
    ok('возврат из асаны ведёт в комплекс', page.url == url)
    page.click('[aria-label="Назад"]'); page.wait_for_selector('.seg .chip'); ok('следующий возврат — список комплексов', page.url.endswith('#/practices'))
    p2 = ctx.new_page(); p2.goto(BASE + '#/asana/tadasana'); p2.wait_for_selector('.hero-img'); page = p2; page.click('[aria-label="Назад"]'); page.wait_for_selector('text=Справочник асан')
    ok('прямая ссылка на асану: назад — в справочник', page.url.endswith('#/catalog'))
    # позиция прокрутки при возврате
    page = ctx.pages[0]; page.goto(BASE + '#/practices'); page.wait_for_selector('.list-row')
    page.locator('.list-row').nth(8).scroll_into_view_if_needed(); page.wait_for_timeout(200)
    y0 = page.evaluate("document.getElementById('main').scrollTop"); ok('список комплексов прокручен', y0 > 200)
    page.locator('.list-row').nth(8).click(); page.wait_for_selector('text=План занятия'); page.locator('.card .chip').first.click(); page.wait_for_selector('.hero-img')
    ok('новая страница открывается сверху', page.evaluate("document.getElementById('main').scrollTop") == 0)
    page.click('[aria-label="Назад"]'); page.wait_for_selector('text=План занятия'); page.click('[aria-label="Назад"]'); page.wait_for_selector('.seg .chip'); page.wait_for_timeout(300)
    y1 = page.evaluate("document.getElementById('main').scrollTop"); ok('возврат в ту же позицию списка (%d → %d)' % (y0, y1), abs(y1 - y0) <= 2)
    page.locator('.list-row').nth(8).click(); page.wait_for_selector('text=План занятия')
    page.evaluate("document.getElementById('main').scrollTop = 600"); page.wait_for_timeout(100); y2 = page.evaluate("document.getElementById('main').scrollTop")
    page.locator('.card .chip').nth(1).click(); page.wait_for_selector('.hero-img'); page.click('[aria-label="Назад"]'); page.wait_for_selector('text=План занятия'); page.wait_for_timeout(300)
    y3 = page.evaluate("document.getElementById('main').scrollTop"); ok('возврат в ту же позицию внутри комплекса (%d → %d)' % (y2, y3), y2 > 0 and abs(y3 - y2) <= 2)
    # закреплённый верхний пояс
    for url, name in [('#/practices', 'список комплексов'), ('#/practice/' + page.evaluate("fetch('data/practices.json').then(r=>r.json()).then(d=>d[0].id)"), 'комплекс'), ('#/asana/tadasana', 'асана')]:
        page.goto(BASE + url); page.wait_for_selector('.head.sticky'); page.wait_for_load_state('networkidle'); page.wait_for_timeout(400); page.evaluate("document.getElementById('main').scrollTop = 700"); page.wait_for_timeout(250)
        top = page.evaluate("document.querySelector('.head.sticky').getBoundingClientRect().top"); vis = page.locator('.head.sticky [aria-label="Назад"]').is_visible()
        ok('верхний пояс закреплён: ' + name, abs(top) < 2 and vis and page.evaluate("document.getElementById('main').scrollTop") > 100)
    page.click('.head.sticky [aria-label="Назад"]'); page.wait_for_timeout(200)
    # версии
    page.goto(BASE + '#/settings'); page.wait_for_selector('text=Проверить обновление'); page.wait_for_timeout(600)
    ok('та же версия на сайте — не «обновление»', 'актуальная версия 1.11.0' in page.inner_text('.page') and 'Обновить до' not in page.inner_text('.page'))
    page.route('**/version.json*', lambda r: r.fulfill(status=200, content_type='application/json', body='{"version":"1.99.0"}'))
    page.click('text=Проверить обновление'); page.wait_for_selector('text=Обновить до 1.99.0'); ok('1.99.0 новее 1.11.0 (числовое сравнение)', True)
    page.unroute('**/version.json*'); page.route('**/version.json*', lambda r: r.fulfill(status=200, content_type='application/json', body='{"version":"1.0.9"}'))
    page.click('text=Проверить обновление'); page.wait_for_timeout(500); ok('старая версия на сайте не считается обновлением', 'Обновить до' not in page.inner_text('.page'))
    page.unroute('**/version.json*'); page.route('**/version.json*', lambda r: r.abort())
    page.click('text=Проверить обновление'); page.wait_for_timeout(500); ok('нет связи — честное сообщение', 'нет связи' in page.inner_text('.page'))
    b.close()
print('ошибок страницы:', errs); sys.exit(0 if all(res) and not errs else 1)
