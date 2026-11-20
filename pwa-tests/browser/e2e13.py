# Кнопка «Источник» (1.9.0): только администратор, копирование, смена, проверка связи, сброс
from playwright.sync_api import sync_playwright
import sys
B='http://localhost:8765/'; bad=0
def ok(n,c):
    global bad; print(('OK   ' if c else 'FAIL ')+n); bad+= (not c)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':800},locale='ru-RU',permissions=['clipboard-read','clipboard-write'],service_workers='block'); pg=ctx.new_page()
    pg.goto(B); pg.wait_for_selector('.auth'); pg.click('.mode-card[data-mode=studio]'); pg.fill('.auth input >> nth=0','Анна'); pg.fill('.auth input >> nth=1','1234'); pg.fill('.auth input >> nth=2','1234')
    pg.select_option('.auth select','Город, в котором вы родились?'); pg.fill('.auth input[aria-label="Ответ на контрольный вопрос"]','Астана'); pg.click('text=Начать работу'); pg.wait_for_selector('.tabbar')
    pg.goto(B+'#/settings'); pg.wait_for_selector('button:has-text("Источник")'); ok('кнопка «Источник» у администратора', True)
    pg.click('button:has-text("Источник")'); pg.wait_for_selector('.src-url')
    ok('показан стандартный адрес', pg.inner_text('.src-url').strip()==B)
    pg.click('text=Копировать адрес'); pg.wait_for_timeout(300); ok('адрес скопирован', pg.evaluate('navigator.clipboard.readText()')==B)
    pg.click('text=Проверить связь'); pg.wait_for_selector('text=Связь есть'); ok('проверка связи', True)
    pg.fill('input[aria-label="Новый адрес источника"]','http://example.com/x'); pg.click('.sheet-foot >> text=Сохранить'); pg.wait_for_selector('.err'); ok('http не принят', 'https' in pg.inner_text('.err'))
    pg.fill('input[aria-label="Новый адрес источника"]','localhost:8765/index.html'); pg.click('.sheet-foot >> text=Сохранить'); pg.wait_for_timeout(300)
    ok('localhost = свой адрес (без подтверждения)', pg.evaluate("App.sourceIsOwn()"))
    pg.goto(B+'#/settings'); pg.wait_for_selector('button:has-text("Источник")'); pg.evaluate("App.setPref('source','https://example.org/app')")
    ok('источник меняет адрес проверки', pg.evaluate("App.sourceBase()")=='https://example.org/app/')
    pg.click('button:has-text("Источник")'); pg.wait_for_selector('.src-url'); pg.click('text=Вернуть стандартный'); pg.wait_for_timeout(300)
    ok('сброс на стандартный', pg.evaluate("App.sourceBase()")==B)
    # тренер не видит «Источник»
    pg.evaluate("(async()=>{const s=App.store; await s.addTrainer?s.addTrainer('Ольга','4321'):0})()")
    pg.evaluate("App.store.addTrainer('Ольга','4321')"); pg.wait_for_timeout(1500); pg.evaluate("App.store.logOut()"); pg.wait_for_selector('.auth:not([hidden])')
    pg.click('.user-card:has-text("Ольга")'); pg.fill('.auth input','4321'); pg.click('.auth >> text=Войти'); pg.wait_for_function("document.querySelectorAll('.tab').length===4")
    pg.goto(B+'#/settings'); pg.wait_for_selector('button:has-text("Проверить обновление")'); ok('тренер не видит «Источник»', pg.locator('button:has-text("Источник")').count()==0)
    b.close()
sys.exit(1 if bad else 0)
