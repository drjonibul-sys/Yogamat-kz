# Прокрутка списка клиентов в окне «Запись на занятие» (1.8.1)
from playwright.sync_api import sync_playwright
import sys, os
B='http://localhost:8765/'; bad=0
def ok(n,c):
    global bad; print(('OK  ' if c else 'FAIL ')+n); bad+= (not c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':390,'height':700},locale='ru-RU',has_touch=True,is_mobile=True).new_page()
    pg.goto(B); pg.wait_for_selector('.auth'); pg.click('.mode-card[data-mode=studio]'); pg.fill('.auth input >> nth=0','Анна'); pg.fill('.auth input >> nth=1','1234'); pg.fill('.auth input >> nth=2','1234')
    pg.select_option('.auth select','Город, в котором вы родились?'); pg.fill('.auth input[aria-label="Ответ на контрольный вопрос"]','Астана'); pg.click('text=Начать работу'); pg.wait_for_selector('.tabbar')
    pg.goto(B+'#/settings'); pg.wait_for_selector('text=Восстановить базу из файла JSON')
    with pg.expect_file_chooser() as fc: pg.click('text=Восстановить базу из файла JSON')
    fc.value.set_files(os.environ.get('MANY','/tmp/many.json')); pg.wait_for_selector('.overlay >> text=Восстановить'); pg.locator('.overlay').last.locator('button:has-text("Восстановить")').click(); pg.wait_for_selector('text=Загружено из прежнего')
    pg.evaluate("()=>{App.store.state.subscriptions.forEach(x=>{x.visitsLeft=5}); App.store.emit&&App.store.emit();}")
    pg.goto(B+'#/classes'); pg.wait_for_selector('.list-row'); pg.locator('.list-row').first.click(); pg.wait_for_selector('.sheet')
    pg.click('text=Записать'); pg.wait_for_selector('.search')
    m=pg.evaluate("""()=>{const b=[...document.querySelectorAll('.sheet-body')].pop(); const l=b.querySelector('.card.flat'); b.scrollTop=b.scrollHeight;
      return {ch:b.clientHeight,sh:b.scrollHeight,top:b.scrollTop,list:l.getBoundingClientRect().height,lsh:l.scrollHeight}}""")
    print(m)
    ok('список не сжат', m['list']>=m['lsh']-1)
    ok('лист прокручивается', m['sh']>m['ch'] and m['top']>0)
    b.close()
sys.exit(1 if bad else 0)
