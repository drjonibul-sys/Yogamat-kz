# 1.14.1: масштаб 100% — viewport зафиксирован, шрифт полей ≥16 px (нет автоувеличения iOS при фокусе), нет горизонтального переполнения
from playwright.sync_api import sync_playwright
import sys, datetime
B='http://localhost:8765/'; bad=0
def ok(n,c):
    global bad; print(('OK   ' if c else 'FAIL ')+n); bad+= (not c)
JS="""()=>{const small=[...document.querySelectorAll('input,select,textarea')].filter(e=>!['checkbox','radio','hidden'].includes(e.type)&&parseFloat(getComputedStyle(e).fontSize)<16).map(e=>(e.getAttribute('aria-label')||e.placeholder||e.className||e.tagName)+':'+getComputedStyle(e).fontSize);
 return {small, over: document.documentElement.scrollWidth>window.innerWidth+1, scale: window.visualViewport?window.visualViewport.scale:1}}"""
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':800},locale='ru-RU',service_workers='block',has_touch=True,is_mobile=True); pg=ctx.new_page()
    pg.goto(B); pg.wait_for_selector('.auth'); pg.click('.mode-card[data-mode=studio]'); 
    meta=pg.get_attribute('meta[name=viewport]','content'); ok('viewport: масштаб зафиксирован на 1', 'initial-scale=1' in meta and 'maximum-scale=1' in meta and 'user-scalable=no' in meta)
    r=pg.evaluate(JS); ok('вход/настройка: шрифт полей ≥16 px %s'%r['small'], not r['small'])
    pg.fill('.auth input >> nth=0','Анна'); pg.fill('.auth input >> nth=1','1234'); pg.fill('.auth input >> nth=2','1234')
    pg.select_option('.auth select','Город, в котором вы родились?'); pg.fill('.auth input[aria-label="Ответ на контрольный вопрос"]','Астана'); pg.click('text=Начать работу'); pg.wait_for_selector('.tabbar')
    t=datetime.date.today()
    pg.evaluate("""([d0])=>{const s=App.store; s.addQuickSale({name:'Айгуль',phone:'',tariffName:'8 занятий',purchaseDate:d0,expiryDate:'2027-12-30',visitsTotal:8,price:28000,paid:true,paidDate:d0}); s.saveTariff({name:'Т',visitsCount:4,durationDays:30,price:1000}); s.setupRent(1000,%d,%d);}"""%(t.year,t.month),[ (t-datetime.timedelta(days=3)).isoformat() ]) if False else None
    pg.evaluate("([d0,y,m])=>{const s=App.store; s.addQuickSale({name:'Айгуль',phone:'',tariffName:'8 занятий',purchaseDate:d0,expiryDate:'2027-12-30',visitsTotal:8,price:28000,paid:true,paidDate:d0}); s.saveTariff({name:'Т',visitsCount:4,durationDays:30,price:1000}); s.setupRent(1000,y,m);}",[(t-datetime.timedelta(days=3)).isoformat(), t.year, t.month])
    cid=pg.evaluate("App.store.state.clients[0].id")
    for vp in [(390,800),(834,1112),(1112,834)]:
        pg.set_viewport_size({'width':vp[0],'height':vp[1]})
        for url in ['#/overview','#/clients','#/client/'+cid,'#/visits','#/income','#/classes','#/settings','#/rent','#/tariffs','#/payments','#/faq','#/catalog']:
            pg.goto(B+url); pg.wait_for_timeout(250); r=pg.evaluate(JS)
            ok('%dx%d %s: поля ≥16 px, без переполнения, масштаб 1'%(vp[0],vp[1],url), not r['small'] and not r['over'] and r['scale']==1) if (r['small'] or r['over'] or r['scale']!=1) else None
            if r['small'] or r['over']: print('     ',r)
    pg.set_viewport_size({'width':390,'height':800})
    # окна с полями
    pg.goto(B+'#/visits'); pg.wait_for_selector('.att-table'); r=pg.evaluate(JS); ok('таблица недели: поле примечания ≥16 px', not r['small'])
    pg.goto(B+'#/client/'+cid); pg.click('text=Изменить абонемент'); pg.wait_for_selector('.overlay'); r=pg.evaluate(JS); ok('окно «Изменить абонемент»: поля ≥16 px', not r['small'] and r['scale']==1); pg.keyboard.press('Escape')
    pg.goto(B+'#/rent'); pg.locator('button:has-text("Изменить")').first.click(); pg.wait_for_selector('.overlay'); r=pg.evaluate(JS); ok('окно аренды: поля ≥16 px', not r['small']); pg.keyboard.press('Escape')
    pg.goto(B+'#/settings'); pg.click('button:has-text("Источник")'); pg.wait_for_selector('.src-url'); r=pg.evaluate(JS); ok('окно «Источник»: поля ≥16 px', not r['small'])
    print('итог: проверено', 'ошибок', bad)
    b.close()
sys.exit(1 if bad else 0)
