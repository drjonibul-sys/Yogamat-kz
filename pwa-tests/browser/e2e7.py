from playwright.sync_api import sync_playwright
B='http://localhost:8765/'
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':390,'height':900},device_scale_factor=2,locale='ru-RU').new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(B); pg.wait_for_selector('.auth')
    assert pg.locator('text=Код восстановления').count()==0 and pg.locator('#rc-ok').count()==0
    assert pg.locator('.auth select option').count()==7  # выбор + 5 типовых + свой
    pg.screenshot(path='/tmp/shots/18-setup-q.png')
    pg.fill('.auth input >> nth=0','Анна'); pg.fill('.auth input >> nth=1','1234'); pg.fill('.auth input >> nth=2','1234')
    pg.select_option('.auth select','__custom'); pg.fill('.auth input[aria-label="Свой вопрос"]','Любимый цвет?'); pg.fill('.auth input[aria-label="Ответ на контрольный вопрос"]','Зелёный'); pg.click('text=Начать работу'); pg.wait_for_selector('.tabbar')
    # выйти, забыли PIN
    pg.click('[aria-label="Мой аккаунт"]'); pg.wait_for_selector('text=Контрольный вопрос'); assert pg.locator('text=задан — для восстановления PIN').count()==1; pg.click('text=Выйти'); pg.wait_for_selector('.auth')
    pg.click('.user-card'); pg.click('text=Забыли PIN?'); pg.wait_for_selector('text=Любимый цвет?'); pg.screenshot(path='/tmp/shots/19-recover.png')
    pg.fill('.auth input[aria-label="Ответ"]','нет'); pg.fill('.auth input >> nth=1','7777'); pg.fill('.auth input >> nth=2','7777'); pg.click('text=Сменить PIN и войти'); pg.wait_for_selector('text=Неверный ответ')
    pg.fill('.auth input[aria-label="Ответ"]',' зелёный! '); pg.click('text=Сменить PIN и войти'); pg.wait_for_selector('.tabbar')
    # удалить вопрос -> напоминание на Обзоре
    pg.click('[aria-label="Мой аккаунт"]'); pg.click('text=Контрольный вопрос'); pg.wait_for_selector('text=Удалить вопрос'); pg.fill('.sheet input[type=password]','7777'); pg.click('text=Удалить вопрос'); pg.locator('.overlay').last.locator('button:has-text("Удалить")').click(); pg.wait_for_timeout(500)
    pg.goto(B+'#/overview'); pg.wait_for_selector('text=Задайте контрольный вопрос')
    assert not errs,errs; print('ok: контрольный вопрос — настройка, восстановление, удаление'); b.close()
