# 2.0.0: режимы «Индивидуальный тренер» / «Студия»
from playwright.sync_api import sync_playwright
import sys
B='http://localhost:8765/'; bad=0
def ok(n,c):
    global bad; print(('OK   ' if c else 'FAIL ')+n); bad+= (not c)
def tx(pg,sel): return ' '.join((pg.text_content(sel) or '').split())
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':800},locale='ru-RU',service_workers='block'); pg=ctx.new_page()
    pg.goto(B); pg.wait_for_selector('.auth')
    ok('выбор режима при первом запуске', pg.locator('.mode-card').count()==2)
    pg.click('.mode-card[data-mode=solo]'); pg.wait_for_selector('input[aria-label="Ваше направление"]')
    pg.fill('.auth input >> nth=0','Мария'); pg.fill('input[aria-label="Ваше направление"]','Хатха-йога'); pg.fill('.auth input >> nth=2','1234'); pg.fill('.auth input >> nth=3','1234')
    pg.select_option('.auth select','Город, в котором вы родились?'); pg.fill('.auth input[aria-label="Ответ на контрольный вопрос"]','Астана'); pg.click('text=Начать работу'); pg.wait_for_selector('.tabbar')
    ok('режим solo сохранён', pg.evaluate("App.store.mode")=='solo')
    ok('одно направление вместо 16', pg.evaluate("App.store.state.classes.length")==1 and pg.evaluate("App.store.state.classes[0].name")=='Хатха-йога')
    ok('вкладка «Расписание» вместо «Классы»', 'Расписание' in tx(pg,'.tabbar') and 'Классы' not in tx(pg,'.tabbar'))
    ok('4 вкладки без пустых', pg.locator('.tab').count()==5)
    pg.goto(B+'#/income'); pg.wait_for_selector('text=Платежи'); t=tx(pg,'#main')
    ok('Доход: нет раздела «Тренеры»', 'По нагрузке' not in t and 'Долги' in t)
    pg.goto(B+'#/classes'); pg.wait_for_timeout(300)
    pg.evaluate("App.classEditor(App.store.state.classes[0].id)"); pg.wait_for_selector('.overlay'); o=tx(pg,'.overlay')
    ok('редактор направления без зала/мест/тренера', 'Зал' not in o and 'Мест в группе' not in o and 'Тренер' not in o and 'Длительность' in o); pg.keyboard.press('Escape')
    pg.evaluate("App.accountSheet()"); pg.wait_for_selector('.overlay'); o=tx(pg,'.overlay'); ok('аккаунт: нет блока тренеров', 'Тренеров пока нет' not in o and 'Индивидуальный тренер' in o); pg.keyboard.press('Escape')
    pg.evaluate("App.store.addQuickSale({name:'Айгуль',phone:'',tariffName:'8',purchaseDate:'2026-11-01',expiryDate:'2027-12-30',visitsTotal:8,price:28000,paid:true,paidDate:'2026-11-01'})")
    pg.goto(B+'#/visits'); pg.wait_for_selector('.att-table'); ok('таблица визитов работает', 'Айгуль' in tx(pg,'.att-table'))
    pg.goto(B+'#/faq'); pg.wait_for_timeout(300); ok('FAQ содержит раздел про режимы', 'Индивидуальный режим' in tx(pg,'#main') or 'Два режима' in tx(pg,'#main'))
    pg.goto(B+'#/settings'); pg.wait_for_selector('text=Режим работы'); ok('настройки: название практики', 'Название практики' in tx(pg,'#main'))
    # переключение в студию
    pg.click('.seg >> text=Студия'); pg.click('button:has-text("Сменить")'); pg.wait_for_timeout(400)
    ok('переключено в студию, данные на месте', pg.evaluate("App.store.mode")=='studio' and pg.evaluate("App.store.state.clients.length")==1)
    ok('вкладка «Классы» вернулась', 'Классы' in tx(pg,'.tabbar'))
    pg.reload(); pg.wait_for_selector('.auth,.tabbar'); ok('режим сохраняется после перезапуска', pg.evaluate("App.store.mode")=='studio')
    # бэкап хранит режим
    ok('снимок содержит mode', pg.evaluate("App.store.snapshot().mode")=='studio')
    print('итог: ошибок', bad); b.close()
sys.exit(1 if bad else 0)
