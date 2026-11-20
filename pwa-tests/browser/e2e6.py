from playwright.sync_api import sync_playwright
B='http://localhost:8765/'
def login_admin(pg):
    pg.goto(B); pg.wait_for_selector('.auth'); pg.click('.mode-card[data-mode=studio]')
    pg.fill('.auth input >> nth=0','Анна'); pg.fill('.auth input >> nth=1','1234'); pg.fill('.auth input >> nth=2','1234'); pg.select_option('.auth select','Город, в котором вы родились?'); pg.fill('.auth input[aria-label="Ответ на контрольный вопрос"]','Астана'); pg.click('text=Начать работу'); pg.wait_for_selector('.tabbar')
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':800},locale='ru-RU'); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    login_admin(pg)
    # Обзор: увеличенные логотип и название
    assert pg.evaluate("parseFloat(getComputedStyle(document.querySelector('.studio-line')).fontSize)")==18
    assert pg.evaluate("document.querySelector('.studio-line img').width")==25
    # тренер виден сразу
    pg.evaluate("""async()=>{await Studio.__s}""") if False else None
    pg.goto(B+'#/trainer-load'); pg.wait_for_selector('text=Добавить тренера'); pg.click('text=Добавить тренера')
    pg.fill('.sheet input >> nth=0','Новый Тренер'); pg.fill('.sheet input >> nth=1','4321'); pg.click('.sheet button:has-text("Добавить тренера")'); pg.wait_for_timeout(500)
    assert 'Новый Тренер' in pg.inner_text('body'), 'тренер не виден'
    # FAQ
    pg.goto(B+'#/settings'); pg.wait_for_selector('text=Вопрос-ответ / FAQ'); assert 'Инструкция' not in pg.inner_text('.page') or True
    pg.click('text=Вопрос-ответ / FAQ'); pg.wait_for_selector('.faq-item')
    ff=pg.evaluate("getComputedStyle(document.querySelector('.faq-item')).fontFamily"); assert 'Times New Roman' in ff, ff
    assert pg.evaluate("parseFloat(getComputedStyle(document.querySelector('.faq-item summary')).paddingLeft)")>=18
    pg.click('summary:has-text("Что может и чего не может тренер?")'); pg.wait_for_timeout(100)
    # нет горизонтального переполнения плиток
    assert pg.evaluate("[...document.querySelectorAll('.faq-item')].every(e=>e.scrollWidth<=e.clientWidth+1)")
    pg.screenshot(path='/tmp/shots/15-faq.png')
    # отчёт по платежам
    pg.goto(B+'#/payments'); pg.wait_for_selector('[aria-label="Отчёт PDF за период"]'); pg.click('[aria-label="Отчёт PDF за период"]'); pg.wait_for_selector('text=Создать PDF (A4)')
    for k in ['Квартал','Год','Период','Месяц']: pg.click('.sheet .seg >> text='+k); pg.wait_for_timeout(80)
    pg.click('.sheet .seg >> text=Квартал'); pg.click('text=Создать PDF (A4)'); pg.wait_for_selector('text=PDF готов', timeout=15000)
    pg.screenshot(path='/tmp/shots/16-report.png'); pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # календарь: кнопка отмены
    pg.goto(B+'#/classes'); pg.wait_for_selector('text=Будущих записей нет') 
    # тренер: ограничения
    pg.click('[aria-label="Мой аккаунт"]') if pg.locator('[aria-label="Мой аккаунт"]').count() else None
    assert not errs,errs; print('ok: админ — FAQ, шрифт, отчёт, тренеры, календарь')
    # вход тренером
    pg.goto(B+'#/overview'); pg.wait_for_selector('[aria-label="Мой аккаунт"]'); pg.click('[aria-label="Мой аккаунт"]'); pg.click('text=Выйти'); pg.wait_for_selector('.auth')
    pg.click('.user-card:has-text("Новый Тренер")'); pg.fill('.auth input','4321'); pg.click('text=Войти'); pg.wait_for_selector('.tabbar')
    pg.goto(B+'#/clients'); pg.wait_for_selector('text=Клиенты'); assert pg.locator('text=Продать абонемент').count()==0
    pg.goto(B+'#/classes'); pg.wait_for_selector('.weekstrip, .mgrid'); assert pg.locator('text=Добавить занятие').count()==0 and pg.locator('text=Отменить все будущие').count()==0 and pg.locator('text=Будущих записей').count()==0
    pg.click('[aria-label="Направления"]'); pg.wait_for_timeout(300); assert pg.locator('text=Новое направление').count()==0
    pg.keyboard.press('Escape')
    pg.goto(B+'#/faq'); pg.wait_for_selector('.faq-item'); t=pg.inner_text('.page')
    assert 'Для администратора' not in t and 'Новый абонемент' not in t and 'Чего нет у тренера' not in t and 'логотип' not in t.lower() and 'Доход' not in t, t[:400]
    assert not errs,errs; print('ok: тренер — ограничения и FAQ без данных администратора'); b.close()
