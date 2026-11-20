# 1.10.0: кнопка «?» и автоматическое предложение обновления
from playwright.sync_api import sync_playwright
import sys
B='http://localhost:8765/'; bad=0
def ok(n,c):
    global bad; print(('OK   ' if c else 'FAIL ')+n); bad+= (not c)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':800},locale='ru-RU',service_workers='block'); pg=ctx.new_page()
    pg.route('**/version.json*', lambda r: r.fulfill(status=200, content_type='application/json', body='{"version":"9.9.9"}'))
    pg.goto(B); pg.wait_for_selector('.auth'); pg.click('.mode-card[data-mode=studio]'); pg.fill('.auth input >> nth=0','Анна'); pg.fill('.auth input >> nth=1','1234'); pg.fill('.auth input >> nth=2','1234')
    pg.select_option('.auth select','Город, в котором вы родились?'); pg.fill('.auth input[aria-label="Ответ на контрольный вопрос"]','Астана'); pg.click('text=Начать работу'); pg.wait_for_selector('.tabbar')
    pg.wait_for_selector('.overlay[aria-label="Доступно обновление"]', timeout=5000); ok('после входа — окно предложения обновления', '9.9.9' in pg.inner_text('.overlay'))
    pg.click('.overlay >> text=Позже'); pg.wait_for_timeout(1500); ok('«Позже» — окно не повторяется', pg.locator('.overlay').count()==0)
    pg.click('button[aria-label="Инструкция"]'); pg.wait_for_selector('.faq'); ok('«?» открывает инструкцию (админ)', 'Для администратора' in pg.inner_text('.page'))
    # автопроверка при возврате в приложение: новая версия -> окно
    pg.goto(B+'#/overview'); pg.wait_for_selector('.tabbar')
    pg.evaluate("App.prefs.autoUpdate=false"); ok('флаг автопроверки читается', pg.evaluate("App.prefs.autoUpdate")==False)
    # тренер видит «?»
    pg.evaluate("App.store.addTrainer('Ольга','4321')"); pg.wait_for_timeout(1500); pg.evaluate("App.store.logOut()"); pg.wait_for_selector('.auth:not([hidden])')
    pg.click('.user-card:has-text("Ольга")'); pg.fill('.auth input','4321'); pg.click('.auth >> text=Войти'); pg.wait_for_function("document.querySelectorAll('.tab').length===4")
    pg.wait_for_selector('button[aria-label="Инструкция"]'); pg.click('button[aria-label="Инструкция"]'); pg.wait_for_selector('.faq'); ok('«?» открывает инструкцию (тренер)', 'Для тренера' in pg.inner_text('.page') and 'Для администратора' not in pg.inner_text('.page'))
    b.close()
sys.exit(1 if bad else 0)
