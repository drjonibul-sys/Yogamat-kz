import json
from playwright.sync_api import sync_playwright
B='http://localhost:8765/'
legacy={"exportedAt":"2026-11-18T09:55:58.776Z","clients":[{"id":"c1","name":"Клиент Один","phone":"+7 700 000-00-01","notes":"","attendanceNote":"","createdAt":"2026-09-16"}],
 "plans":[{"id":"p1","name":"8 занятий / месяц","visitsCount":8,"durationDays":30,"price":20000}],
 "subscriptions":[{"id":"s1","clientId":"c1","planId":"p1","purchaseDate":"2026-10-05","expiryDate":"2026-12-12","visitsTotal":8,"visitsLeft":7,"price":20000,"paid":True,"paidDate":"2026-11-05"}],
 "visits":[{"id":"v1","clientId":"c1","subscriptionId":"s1","date":"2026-11-06","createdAt":"2026-11-06T10:00:00.000Z"}],"transfers":[],
 "rent":{"defaultAmount":60000,"startMonth":"2026-11","payments":[{"id":"r1","month":"2026-11","amount":60000,"paid":True,"paidDate":"2026-11-15"}]}}
json.dump(legacy,open('/tmp/legacy-backup.json','w',encoding='utf-8'),ensure_ascii=False)
open('/tmp/bad.json','w').write('{"hello": 1}')
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':390,'height':900},locale='ru-RU').new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(B); pg.wait_for_selector('.auth'); pg.fill('.auth input >> nth=0','Анна'); pg.fill('.auth input >> nth=1','1234'); pg.fill('.auth input >> nth=2','1234')
    pg.select_option('.auth select','Город, в котором вы родились?'); pg.fill('.auth input[aria-label="Ответ на контрольный вопрос"]','Астана'); pg.click('text=Начать работу'); pg.wait_for_selector('.tabbar')
    pg.goto(B+'#/settings'); pg.wait_for_selector('text=Восстановить базу из файла JSON')
    for f,expect in [('/tmp/bad.json','не похож'),('/tmp/legacy-backup.json','Загружено из прежнего приложения: клиентов 1')]:
        with pg.expect_file_chooser() as fc: pg.click('text=Восстановить базу из файла JSON')
        fc.value.set_files(f); pg.wait_for_selector('text=Восстановить >> nth=-1'); pg.locator('.overlay').last.locator('button:has-text("Восстановить")').click()
        pg.wait_for_selector('text='+expect, timeout=8000)
    pg.goto(B+'#/clients'); pg.wait_for_selector('text=Клиент Один')
    pg.goto(B+'#/payments'); pg.wait_for_timeout(400); assert '20' in pg.inner_text('.page')
    pg.reload(); pg.wait_for_selector('.tabbar')  # остался в системе, данные сохранены
    pg.goto(B+'#/clients'); pg.wait_for_selector('text=Клиент Один')
    assert not errs,errs; print('ok: импорт файла прежнего приложения через интерфейс'); b.close()
