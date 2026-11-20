# 2.0.0: обновление с 1.14.1 сохраняет все данные пользователя (тот же адрес/хранилище, сервер подменяется)
# Запуск: python3 e2e21.py <папка docs версии 1.14.1> <папка docs версии 2.0.0>
from playwright.sync_api import sync_playwright
import sys, subprocess, time, json
OLD, NEW = sys.argv[1], sys.argv[2]; PORT=8767; B='http://localhost:%d/'%PORT; bad=0
def ok(n,c):
    global bad; print(('OK   ' if c else 'FAIL ')+n); bad+= (not c)
def serve(d):
    pr=subprocess.Popen(['python3','-m','http.server',str(PORT),'-d',d],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1); return pr
DUMP="()=>{const o={};for(const k of Object.keys(localStorage)){if(k.startsWith('yogamat.'))o[k]=localStorage.getItem(k)}return o}"
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':800},locale='ru-RU',service_workers='block'); pg=ctx.new_page()
    ctx.route('**/*', lambda r: r.continue_(headers={**r.request.headers,'cache-control':'no-cache'}))  # как при обновлении: файлы берутся с сервера
    srv=serve(OLD)
    pg.goto(B); pg.wait_for_selector('.auth'); pg.fill('.auth input >> nth=0','Анна'); pg.fill('.auth input >> nth=1','1234'); pg.fill('.auth input >> nth=2','1234')
    pg.select_option('.auth select','Город, в котором вы родились?'); pg.fill('.auth input[aria-label="Ответ на контрольный вопрос"]','Астана'); pg.click('text=Начать работу'); pg.wait_for_selector('.tab')
    pg.evaluate("""()=>{const s=App.store; s.addQuickSale({name:'Айгуль',phone:'+7 701 234 56 78',tariffName:'8 занятий',purchaseDate:'2026-11-01',expiryDate:'2027-12-30',visitsTotal:8,price:28000,paid:true,paidDate:'2026-11-01'});
      s.addQuickSale({name:'Мария',phone:'',tariffName:'4',purchaseDate:'2026-11-05',expiryDate:'2027-12-30',visitsTotal:4,price:12000,paid:false}); s.saveTariff({name:'Тест',visitsCount:4,durationDays:30,price:1000}); s.setupRent(50000,2026,10);
      s.markVisit(s.state.clients[0].id,'2026-11-10'); s.setStudioName('Моя студия'); s.createBackup(); App.setPref('theme','dark');}""")
    pg.wait_for_timeout(300)
    before=pg.evaluate(DUMP); data_before=json.loads(before['yogamat.studio.v1'])
    ok('в 1.14.1 нет поля mode', 'mode' not in data_before)
    srv.terminate(); srv.wait(); time.sleep(0.5)
    srv=serve(NEW); pg.reload(); pg.wait_for_selector('.tab',timeout=10000)
    ok('после обновления вход сохранён (без экрана выбора режима и PIN)', pg.locator('.mode-card').count()==0 and pg.locator('.tabbar').count()==1)
    ok('версия 2.0.0', '2.0.0' in pg.text_content('.app-footer'))
    ok('режим «Студия» присвоен автоматически', pg.evaluate("App.store.mode")=='studio')
    after=json.loads(pg.evaluate(DUMP)['yogamat.studio.v1'])
    for k in ['clients','subscriptions','visits','transfers','absences','classes','tariffs','rentSettings','rentPeriods','staff','favoriteAsanas','studioName']:
        ok('данные не изменились: '+k, after.get(k)==data_before.get(k))
    other=[k for k in before if k!='yogamat.studio.v1']
    now=pg.evaluate(DUMP)
    for k in other: ok('ключ сохранён без изменений: '+k, now.get(k)==before[k])
    ok('16 классов на месте', len(after['classes'])==16)
    pg.goto(B+'#/clients'); pg.wait_for_timeout(400); t=' '.join(pg.text_content('#main').split())
    ok('клиенты видны', 'Айгуль' in t and 'Мария' in t)
    ok('тема сохранена', pg.evaluate("document.documentElement.getAttribute('data-theme')")=='dark')
    ok('копия, созданная в 1.14.1, доступна и восстанавливается', pg.evaluate("(()=>{const b=App.store.backups();if(!b.length)return false;App.store.restoreBackup(b[0].id);return App.store.state.clients.length===2})()"))
    # выход и вход старым PIN
    pg.evaluate("App.store.logOut()"); pg.wait_for_selector('.user-card'); pg.click('.user-card'); pg.fill('.auth input','1234'); pg.click('text=Войти'); pg.wait_for_selector('.tab')
    ok('вход прежним PIN работает', True)
    srv.terminate(); b.close(); print('итог: ошибок',bad)
sys.exit(1 if bad else 0)
