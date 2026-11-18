"""Сценарий входа по e-mail на тестовом сервере (запуск: python3 tests/browser/v5-email.py из папки проекта)."""
import subprocess,time,json
from playwright.sync_api import sync_playwright
import os
root=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))+'/'  # корень проекта (папка с app/)
mock=subprocess.Popen(['python3',root+'tests/mock_supabase.py','54321']); srv=subprocess.Popen(['python3','-m','http.server','8770','-d',root+'dist'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1.2)
o=lambda *a:print(*a,flush=True)
KEY='x'*40
cfg=json.dumps({'url':'http://127.0.0.1:54321','anonKey':KEY})
with sync_playwright() as p:
  b=p.chromium.launch()
  # 1) без настройки: прежний вход по PIN
  c0=b.new_context(viewport={'width':1112,'height':834},locale='ru-RU',service_workers='block'); pg=c0.new_page(); pg.goto('http://localhost:8770/index.html'); pg.wait_for_timeout(500)
  o('not configured -> PIN setup shown:',pg.inner_text('#loginScreen h2'))
  c0.close()
  ctx=b.new_context(viewport={'width':1112,'height':834},locale='ru-RU',service_workers='block'); ctx.add_init_script("if(!localStorage.yogaTrackerAuthConfig_v1) localStorage.yogaTrackerAuthConfig_v1=%s;"%json.dumps(cfg))
  pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)[:150]))
  pg.goto('http://localhost:8770/index.html'); pg.wait_for_timeout(600)
  o('email login:',pg.inner_text('#loginScreen h2'),'| locked',pg.evaluate("document.body.classList.contains('locked')"))
  pg.fill('#loginEmail','stranger@x.kz'); pg.click('#loginSubmit'); pg.wait_for_timeout(500); o('stranger:',pg.inner_text('#loginError'))
  pg.fill('#loginEmail','not-an-email'); pg.click('#loginSubmit'); pg.wait_for_timeout(300); o('bad format:',pg.inner_text('#loginError'))
  pg.fill('#loginEmail','Admin@Test.kz'); pg.click('#loginSubmit'); pg.wait_for_timeout(500); o('code step:',pg.inner_text('#loginScreen .field-hint'))
  pg.fill('#loginCode','000000'); pg.click('#loginSubmit'); pg.wait_for_timeout(400); o('wrong code:',pg.inner_text('#loginError'))
  pg.fill('#loginCode','123456'); pg.click('#loginSubmit'); pg.wait_for_timeout(900)
  o('in:',pg.evaluate("__access.role()+' / '+__access.name()"),'| locked',pg.evaluate("document.body.classList.contains('locked')"),'| greeting:',pg.inner_text('.app-header h1'))
  pg.click('.header-settings-btn'); pg.wait_for_timeout(700)
  o('settings card:',pg.inner_text('#settingsUserCard').replace('\n',' | ')[:150]); o('team:',pg.inner_text('#settingsUsersCard').replace('\n',' | ')[:200])
  pg.click('#teamAdd'); pg.fill('#fMail','New.Coach@test.kz'); pg.fill('#fMailName','Тренер Асель'); pg.click('#fMailSave'); pg.wait_for_timeout(800)
  o('after add:',pg.locator('#settingsUsersCard .user-row').count(),'rows | trainers for classes:',pg.evaluate("listTrainers().map(t=>t.name).join(',')"))
  pg.click('[data-mail="admin@test.kz"]'); pg.click('#fMailDelete'); pg.wait_for_timeout(300); o('self-delete toast:',pg.inner_text('#toast'))
  pg.evaluate("closeSheet()")
  # перезагрузка: сеанс сохранён
  pg.reload(); pg.wait_for_timeout(700); o('reload keeps session:',pg.evaluate("__access.role()"),'| login hidden:',pg.evaluate("document.getElementById('loginScreen').hidden"))
  # выход -> тренер
  pg.click('#logoutBtn'); pg.wait_for_timeout(500); o('after logout:',pg.inner_text('#loginScreen h2'))
  pg.fill('#loginEmail','coach@test.kz'); pg.click('#loginSubmit'); pg.wait_for_timeout(500); pg.fill('#loginCode','123456'); pg.click('#loginSubmit'); pg.wait_for_timeout(900)
  o('trainer:',pg.evaluate("__access.role()+' / '+__access.name()"),'| tabs:',pg.evaluate("[...document.querySelectorAll('.tabbtn')].filter(b=>!b.hidden).map(b=>b.dataset.tab).join(',')"))
  pg.click('.header-settings-btn'); pg.wait_for_timeout(500); o('trainer settings users box empty:',pg.inner_text('#settingsUsersCard').strip()=='', '| card:',pg.inner_text('#settingsUserCard').replace('\n',' | ')[:110])
  o('trainer cannot save:',pg.evaluate("""(async()=>{try{await __emailAuth.save({email:'x@y.kz',role:'admin',name:'x'});return 'allowed!'}catch(e){return e.message}})()"""))
  # отключение тренера на сервере -> при проверке выход
  pg.evaluate("fetch('http://127.0.0.1:54321/__set',{method:'POST',headers:{apikey:'%s'},body:JSON.stringify({email:'coach@test.kz',role:'trainer',display_name:'Тренер Нурлан',active:false})})"%KEY); pg.wait_for_timeout(300)
  pg.evaluate("(()=>{const c=JSON.parse(localStorage.yogaTrackerEmailSession_v1);c.checkedAt=0;localStorage.yogaTrackerEmailSession_v1=JSON.stringify(c)})()"); pg.reload(); pg.wait_for_timeout(1200)
  o('dbg',pg.evaluate("document.getElementById('loginScreen').hidden+' '+document.getElementById('loginScreen').innerText.slice(0,80)"),errs); o('revoked ->',pg.inner_text('#loginScreen .field-hint'),'| locked',pg.evaluate("document.body.classList.contains('locked')"))
  # срок офлайн-доступа истёк
  pg.evaluate("fetch('http://127.0.0.1:54321/__set',{method:'POST',headers:{apikey:'%s'},body:JSON.stringify({email:'coach@test.kz',role:'trainer',display_name:'Тренер Нурлан',active:true})})"%KEY)
  pg.fill('#loginEmail','coach@test.kz'); pg.click('#loginSubmit'); pg.wait_for_timeout(500); pg.fill('#loginCode','123456'); pg.click('#loginSubmit'); pg.wait_for_timeout(800)
  pg.evaluate("(()=>{const c=JSON.parse(localStorage.yogaTrackerEmailSession_v1);c.verifiedAt=Date.now()-8*86400000;localStorage.yogaTrackerEmailSession_v1=JSON.stringify(c)})()")
  pg.route('http://127.0.0.1:54321/**',lambda r:r.abort()); pg.reload(); pg.wait_for_timeout(700); o('8 days offline ->',pg.inner_text('#loginScreen h2'))
  pg.evaluate("(()=>{const c=JSON.parse(localStorage.yogaTrackerEmailSession_v1);c.verifiedAt=Date.now()-2*86400000;localStorage.yogaTrackerEmailSession_v1=JSON.stringify(c)})()")
  pg.reload(); pg.wait_for_timeout(700); o('2 days offline still in:',pg.evaluate("document.getElementById('loginScreen').hidden"))
  o('errors',errs); b.close()
srv.terminate(); mock.terminate()
