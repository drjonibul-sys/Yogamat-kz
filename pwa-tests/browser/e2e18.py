# 1.14.0: ручная корректировка аренды за прошлые периоды
from playwright.sync_api import sync_playwright
import sys, datetime
B='http://localhost:8765/'; bad=0
def ok(n,c):
    global bad; print(('OK   ' if c else 'FAIL ')+n); bad+= (not c)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':800},locale='ru-RU',service_workers='block'); pg=ctx.new_page()
    pg.goto(B); pg.wait_for_selector('.auth'); pg.fill('.auth input >> nth=0','Анна'); pg.fill('.auth input >> nth=1','1234'); pg.fill('.auth input >> nth=2','1234')
    pg.select_option('.auth select','Город, в котором вы родились?'); pg.fill('.auth input[aria-label="Ответ на контрольный вопрос"]','Астана'); pg.click('text=Начать работу'); pg.wait_for_selector('.tabbar')
    t=datetime.date.today(); y,m=t.year,t.month; sm=m-2 if m>2 else m+10; sy=y if m>2 else y-1
    pg.evaluate("([a,y,m])=>App.store.setupRent(a,y,m)",[200000,sy,sm])
    pg.goto(B+'#/rent'); pg.wait_for_selector('text=Настройки аренды')
    first=pg.locator('.card.flat .list-row').last  # самый ранний из прошлых (список от новых к старым)
    ok('у месяцев есть «Изменить»', pg.locator('button:has-text("Изменить")').count()>=3)
    pg.locator('.card.flat').first.locator('button:has-text("Изменить")').last.click(); pg.wait_for_selector('.overlay[aria-label^="Аренда:"]'); sh=pg.locator('.overlay[aria-label^="Аренда:"]')
    sh.locator('input').first.fill('150 000')
    sh.locator('.toggle, button[role="switch"], [role="switch"]').first.click(); pg.wait_for_timeout(200)
    d=(t-datetime.timedelta(days=40)).isoformat(); sh.locator('input[type="date"]').fill(d); sh.locator('.sheet-foot .btn').first.click(); pg.wait_for_timeout(400)
    rp=pg.evaluate("App.store.rentPeriodsAscending()[0]"); ok('прошлый период: 150 000, оплачено, дата', rp['amount']==150000 and rp['paid'] and rp['paidDate']==d)
    import re
    tx=re.sub(r'\s+',' ',pg.text_content('.page')); ok('в списке видна сумма и «оплачено»', '150 000' in tx and 'оплачено' in tx)
    pg.click('button:has-text("Настройки аренды")'); pg.wait_for_selector('.overlay[aria-label="Настройки аренды"]'); sh=pg.locator('.overlay[aria-label="Настройки аренды"]'); sh.locator('input').first.fill('250 000'); sh.locator('.sheet-foot .btn').first.click(); pg.wait_for_timeout(400)
    ok('новая сумма по умолчанию, оплаченный период не изменился', pg.evaluate("App.store.state.rentSettings.monthlyAmount")==250000 and pg.evaluate("App.store.rentAmount(App.store.rentPeriodsAscending()[0])")==150000)
    b.close()
sys.exit(1 if bad else 0)
