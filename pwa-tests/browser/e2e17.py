# 1.13.0: раздел «Обновление» выше «Расписание», анимация кнопки, окно результата проверки
from playwright.sync_api import sync_playwright
import sys
B='http://localhost:8765/'; bad=0
def ok(n,c):
    global bad; print(('OK   ' if c else 'FAIL ')+n); bad+= (not c)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':800},locale='ru-RU',service_workers='block',device_scale_factor=2); pg=ctx.new_page()
    ver={'v':None}
    def h(r):
        import json, time; time.sleep(0.0); r.fulfill(status=200,content_type='application/json',body=json.dumps({'version':ver['v']})) if ver['v'] else r.continue_()
    pg.route('**/version.json*', h)
    pg.goto(B); pg.wait_for_selector('.auth'); pg.fill('.auth input >> nth=0','Анна'); pg.fill('.auth input >> nth=1','1234'); pg.fill('.auth input >> nth=2','1234')
    pg.select_option('.auth select','Город, в котором вы родились?'); pg.fill('.auth input[aria-label="Ответ на контрольный вопрос"]','Астана'); pg.click('text=Начать работу'); pg.wait_for_selector('.tabbar')
    pg.goto(B+'#/settings'); pg.wait_for_selector('button.chk-btn')
    secs=pg.locator('.page h2, .page .section').all_inner_texts()
    flat=pg.text_content('.page'); ok('порядок: Оформление → Обновление → Расписание', flat.index('Оформление')<flat.index('Обновление')<flat.index('Расписание'))
    ok('в «О приложении» кнопки проверки больше нет', pg.locator('button.chk-btn').count()==1)
    # та же версия
    pg.click('button.chk-btn'); pg.wait_for_selector('button.chk-btn.busy'); ok('анимация: кнопка «Проверяем…» со спиннером', 'Проверяем' in pg.inner_text('button.chk-btn') and pg.locator('.chk-spin').is_visible())
    pg.wait_for_selector('.overlay[aria-label="Проверка обновления"]'); t=pg.inner_text('.overlay'); ok('окно: «У вас последняя версия» и номер', 'последняя версия' in t and '1.13.0' in t)
    pg.click('.overlay >> text=Готово'); pg.wait_for_function("document.querySelector('button.chk-btn') && !document.querySelector('button.chk-btn.busy')"); ok('кнопка вернулась в исходное состояние', 'Проверить обновление' in pg.inner_text('button.chk-btn') and pg.locator('button.chk-btn.busy').count()==0)
    # есть новая
    ver['v']='9.9.9'; pg.click('button.chk-btn'); pg.wait_for_selector('.overlay[aria-label="Доступно обновление"]'); t=pg.inner_text('.overlay'); ok('окно: «Доступна версия 9.9.9», Установить/Позже', '9.9.9' in t and 'Установить' in t and 'Позже' in t)
    pg.screenshot(path='/tmp/upd.png'); pg.click('.overlay button:has-text("Позже")'); pg.wait_for_timeout(2500); ok('после «Позже» автоокно не всплывает повторно', pg.locator('.overlay').count()==0)
    # нет связи
    pg.unroute('**/version.json*'); pg.route('**/version.json*', lambda r: r.abort()); pg.click('button.chk-btn'); pg.wait_for_selector('.overlay[aria-label="Проверка обновления"]'); ok('окно: «Не удалось проверить»', 'Не удалось проверить' in pg.inner_text('.overlay'))
    b.close()
sys.exit(1 if bad else 0)
