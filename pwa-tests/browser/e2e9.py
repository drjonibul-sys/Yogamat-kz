import json, datetime as dt
from playwright.sync_api import sync_playwright
B='http://localhost:8765/'
n=40; d0=dt.date(2026,10,1)
legacy={"exportedAt":"2026-11-18T09:00:00.000Z","plans":[{"id":"p1","name":"8 занятий / месяц","visitsCount":8,"durationDays":60,"price":20000}],"transfers":[],
 "clients":[{"id":"c%d"%i,"name":"Клиент %02d"%i,"phone":"","notes":"","createdAt":"2026-10-01"} for i in range(n)],
 "subscriptions":[{"id":"s%d"%i,"clientId":"c%d"%i,"planId":"p1","purchaseDate":"2026-10-01","expiryDate":"2026-12-30","visitsTotal":8,"visitsLeft":0,"price":20000,"paid":True,"paidDate":"2026-10-%02d"%(1+i%28)} for i in range(n)],
 "visits":[{"id":"v%d_%d"%(i,k),"clientId":"c%d"%i,"subscriptionId":"s%d"%i,"date":(d0+dt.timedelta(days=k*7+i%5)).isoformat(),"createdAt":"2026-10-01T10:00:00.000Z"} for i in range(n) for k in range(8)],
 "rent":{"defaultAmount":60000,"startMonth":"2026-10","payments":[]}}
json.dump(legacy,open('/tmp/many.json','w',encoding='utf-8'),ensure_ascii=False)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':390,'height':800},locale='ru-RU').new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(B); pg.wait_for_selector('.auth'); pg.fill('.auth input >> nth=0','Анна'); pg.fill('.auth input >> nth=1','1234'); pg.fill('.auth input >> nth=2','1234')
    pg.select_option('.auth select','Город, в котором вы родились?'); pg.fill('.auth input[aria-label="Ответ на контрольный вопрос"]','Астана'); pg.click('text=Начать работу'); pg.wait_for_selector('.tabbar')
    pg.goto(B+'#/settings'); pg.wait_for_selector('text=Восстановить базу из файла JSON')
    with pg.expect_file_chooser() as fc: pg.click('text=Восстановить базу из файла JSON')
    fc.value.set_files('/tmp/many.json'); pg.wait_for_selector('.overlay >> text=Восстановить'); pg.locator('.overlay').last.locator('button:has-text("Восстановить")').click(); pg.wait_for_selector('text=Загружено из прежнего')
    for url,name in [('#/clients','Клиенты'),('#/visits','Визиты'),('#/income','Доход'),('#/classes','Классы')]:
        pg.goto(B+url); pg.wait_for_selector('.head.sticky'); pg.wait_for_timeout(400)
        pg.evaluate("document.getElementById('main').scrollTop = 600"); pg.wait_for_timeout(250)
        st=pg.evaluate("document.getElementById('main').scrollTop"); top=pg.evaluate("document.querySelector('.head.sticky').getBoundingClientRect().top")
        vis=pg.locator('.head.sticky h1').is_visible() and pg.inner_text('.head.sticky h1').strip()==name
        res=abs(top)<2 and vis and st>100; print(('ok  ' if res else 'FAIL'),'пояс закреплён:',name,'scrollTop',st,'top',top); assert res
        if name=='Клиенты': pg.screenshot(path='/tmp/shots/22-sticky-clients.png')
    assert not errs,errs; b.close()
