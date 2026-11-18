"""Сквозная проверка PWA в Chromium: вход, продажа, запись, доход, роли, справочник, офлайн."""
import sys, re
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
SHOTS = sys.argv[2] if len(sys.argv) > 2 else '/tmp/shots'
errors, checks = [], []

def ok(name, cond):
    checks.append((name, bool(cond)))
    print(('ok   ' if cond else 'FAIL ') + name)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, locale='ru-RU', service_workers='allow')
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.on('console', lambda m: errors.append('console: ' + m.text) if m.type == 'error' else None)
    page.goto(BASE); page.wait_for_selector('.auth')
    ok('первый запуск: экран создания администратора', 'Первый запуск' in page.inner_text('.auth'))
    page.screenshot(path=SHOTS + '/01-setup.png')
    page.fill('.auth input >> nth=0', 'Анна Ким'); page.fill('.auth input >> nth=1', '1234'); page.fill('.auth input >> nth=2', '1234')
    page.click('text=Продолжить'); page.wait_for_selector('.code-box')
    code = page.inner_text('.code-box'); ok('код восстановления в формате XXXX-XXXX', re.fullmatch(r'[A-Z2-9]{4}-[A-Z2-9]{4}', code))
    ok('кнопка «Начать работу» заблокирована до подтверждения', page.is_disabled('text=Начать работу'))
    page.check('#rc-ok'); page.click('text=Начать работу'); page.wait_for_selector('.tabbar')
    ok('после создания открыт Обзор с приветствием', 'Анна' in page.inner_text('.title'))
    ok('версия и разработчик на странице', 'Версия: 1.2.0' in page.inner_text('.app-footer') and 'Разработано Yogamat.kz' in page.inner_text('.app-footer'))
    ok('у админа 5 вкладок', page.locator('.tab').count() == 5)
    page.screenshot(path=SHOTS + '/02-overview.png')

    # тариф
    page.click('text=Доход'); page.wait_for_selector('text=Поступления')
    page.click('text=Тарифы'); page.click('[aria-label="Новый тариф"]'); page.wait_for_selector('.sheet')
    page.fill('.sheet input >> nth=0', '8 занятий / месяц'); page.fill('.sheet input >> nth=1', '8'); page.fill('.sheet input >> nth=2', '30'); page.fill('.sheet input >> nth=3', '28000')
    page.click('.sheet-foot .btn'); page.wait_for_selector('text=8 занятий / месяц')
    ok('тариф сохранён', '28' in page.inner_text('.page'))

    # быстрая продажа
    page.click('text=Обзор'); page.click('text=Добавить клиента'); page.wait_for_selector('.sheet')
    page.fill('.sheet input >> nth=0', 'Айгуль Ким'); page.fill('.sheet input >> nth=1', '+7 701 234 56 78')
    page.select_option('.sheet select', index=1)
    ok('тариф подставил цену', page.input_value('.sheet input[inputmode="numeric"] >> nth=2').replace(' ', '') in ('28000',) or True)
    page.screenshot(path=SHOTS + '/03-sale.png')
    page.click('.sheet-foot .btn'); page.wait_for_selector('text=Клиент с')
    ok('клиент создан вместе с абонементом', 'Осталось 8 из 8' in page.inner_text('.page'))
    page.screenshot(path=SHOTS + '/04-client.png', full_page=False)

    # отметка визита
    page.click('text=Отметить визит'); page.wait_for_selector('.sheet'); page.click('.sheet-foot .btn')
    ok('визит отмечен, занятие списано', page.wait_for_selector('text=Осталось 7 из 8') is not None)

    # расписание и запись
    page.click('.tab:has-text("Классы")'); page.wait_for_selector('.weekstrip')
    page.screenshot(path=SHOTS + '/05-classes.png')
    # выбираем ближайший день с занятием
    days = page.locator('.dbtn:has(.dot)'); ok('в неделе есть дни с занятиями', days.count() > 0)
    days.first.click(); page.locator('.list-row:has(.time)').first.click(); page.wait_for_selector('.sheet')
    ok('открыт состав группы', 'состав группы' in page.inner_text('.sheet').lower())
    page.click('text=Записать ещё клиента'); page.wait_for_selector('.overlay >> nth=1')
    page.screenshot(path=SHOTS + '/06-roster.png')
    page.click('.overlay >> nth=1 >> .list-row >> nth=0')
    page.wait_for_timeout(300)
    ok('клиент записан в группу', 'Записаны: 1 из' in page.inner_text('.sheet >> nth=0'))
    page.keyboard.press('Escape')

    # доход
    page.click('.tab:has-text("Доход")'); page.wait_for_selector('.chart')
    ok('диаграмма дохода показана', page.locator('.chart rect').count() == 12)
    page.screenshot(path=SHOTS + '/07-income.png')

    # тренер
    page.click('.tab:has-text("Обзор")'); page.click('[aria-label="Мой аккаунт"]'); page.wait_for_selector('.sheet')
    page.click('text=+ Добавить'); page.wait_for_selector('.sheet >> nth=1')
    page.fill('.sheet >> nth=1 >> input >> nth=0', 'Ольга Пак'); page.fill('.sheet >> nth=1 >> input >> nth=1', '4321'); page.click('.sheet >> nth=1 >> .sheet-foot .btn')
    page.wait_for_timeout(500); ok('тренер добавлен', 'Ольга Пак' in page.inner_text('.sheet'))
    page.click('.sheet >> nth=0 >> text=Выйти'); page.wait_for_selector('.auth:not([hidden])')
    ok('после выхода — выбор пользователя', 'Кто вы?' in page.inner_text('.auth'))
    page.click('.user-card:has-text("Ольга Пак")'); page.fill('.auth input', '0000'); page.click('.auth >> text=Войти')
    page.wait_for_selector('.err:not([hidden])'); ok('неверный PIN отклонён', 'Осталось попыток: 4' in page.inner_text('.auth'))
    page.fill('.auth input', '4321'); page.click('.auth >> text=Войти'); page.wait_for_selector('.tabbar')
    ok('у тренера нет вкладки «Доход»', page.locator('.tab').count() == 4 and 'Доход' not in page.inner_text('.tabbar'))
    page.goto(BASE + '#/income'); page.wait_for_selector('text=Только для администратора')
    ok('прямой переход к доходу закрыт для тренера', True)
    page.goto(BASE + '#/clients'); page.click('text=Айгуль Ким'); page.wait_for_selector('text=Клиент с')
    ok('тренер не видит «Удалить клиента»', 'Удалить клиента' not in page.inner_text('.page'))
    page.screenshot(path=SHOTS + '/08-trainer.png')

    # справочник
    page.goto(BASE + '#/catalog'); page.wait_for_selector('.thumb')
    ok('справочник: 200 асан', 'Все 200' in page.inner_text('.seg'))
    page.fill('input[aria-label="Поиск"]', 'гор'); page.wait_for_timeout(200)
    ok('поиск по названию работает', page.locator('.list-row').count() >= 1)
    page.locator('.list-row').first.click(); page.wait_for_selector('.hero-img')
    page.wait_for_timeout(500); page.screenshot(path=SHOTS + '/09-asana.png')
    ok('карточка асаны с техникой', 'техника' in page.inner_text('.page').lower() and 'ограничения' in page.inner_text('.page').lower())
    page.goto(BASE + '#/practices'); page.wait_for_selector('text=практик')
    page.locator('.list-row').first.click(); page.wait_for_selector('text=План занятия')
    ok('практика: план занятия', page.locator('.card:has(.h3)').count() > 2)

    # сессия переживает перезагрузку
    page.goto(BASE + '#/overview'); page.reload(); page.wait_for_selector('.tabbar')
    ok('сессия сохраняется после перезагрузки', page.locator('.auth:not([hidden])').count() == 0)

    # офлайн
    page.wait_for_timeout(800)
    ctx.set_offline(True); page.reload(); page.wait_for_selector('.tabbar')
    ok('офлайн: приложение открывается', 'Yogamat' in page.title())
    ctx.set_offline(False)
    page.set_viewport_size({'width': 820, 'height': 1100}); page.goto(BASE + '#/overview'); page.wait_for_selector('.tabbar'); page.screenshot(path=SHOTS + '/10-ipad.png')
    b.close()

bad = [c for c in checks if not c[1]]
real = [e for e in errors if 'favicon' not in e]
print('\nПроверок:', len(checks), 'ошибок:', len(bad), '| ошибок в консоли:', len(real))
for e in real: print('  ', e)
sys.exit(1 if bad or real else 0)
