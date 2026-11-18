import sys
from playwright.sync_api import sync_playwright
URL='http://localhost:8101/'
out=lambda *a: print(*a, flush=True)
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':1112,'height':834},locale='ru-RU',timezone_id='Asia/Aqtobe',service_workers='block',device_scale_factor=1)
    pg=ctx.new_page(); errs=[]; dl=[]
    pg.on('pageerror',lambda e:errs.append(str(e)[:200])); pg.on('console',lambda m: errs.append('console:'+m.text[:200]) if m.type=='error' else None)
    pg.on('dialog',lambda d:(dl.append(d.message[:90]),d.accept()))
    pg.goto(URL); pg.wait_for_timeout(600)
    out('locked:',pg.evaluate("document.body.classList.contains('locked')"),'| setup shown:',pg.is_visible('#loginPin2'))
    # SHA-256 known vector
    out('sha256(abc):',pg.evaluate("__access.sha256('abc')"))
    pg.fill('#loginPin','12'); pg.fill('#loginPin2','12'); pg.click('#loginForm button[type=submit]'); out('short pin err:',pg.inner_text('#loginError'))
    pg.fill('#loginPin','1234'); pg.fill('#loginPin2','1235'); pg.click('#loginForm button[type=submit]'); out('mismatch err:',pg.inner_text('#loginError'))
    pg.fill('#loginPin','1234'); pg.fill('#loginPin2','1234'); pg.click('#loginForm button[type=submit]'); pg.wait_for_timeout(400)
    code=pg.inner_text('#recoveryCode'); out('recovery code:',code)
    pg.screenshot(path='../shots/01-code.png')
    pg.click('#loginContinue'); pg.wait_for_timeout(300)
    out('role:',pg.evaluate("__access.role()"),'locked:',pg.evaluate("document.body.classList.contains('locked')"))
    # dashboard no backup/pwa
    dash=pg.inner_text('#page-dashboard'); out('dashboard has backup/pwa text:', 'Резервное' in dash, 'домашнего' in dash)
    pg.screenshot(path='../shots/02-dash.png')
    # settings
    pg.click('.header-settings-btn'); pg.wait_for_timeout(400)
    st=pg.inner_text('#page-settings'); out('settings:',st.replace('\n',' | ')[:700])
    foot=pg.evaluate("""()=>{const v=document.getElementById('appVersionLabel');const c=document.querySelector('.app-credit em');
      return {ver:v.textContent,verBottom:v.getBoundingClientRect().bottom,credTop:c.getBoundingClientRect().top,italic:getComputedStyle(c).fontStyle,credit:c.textContent}}""")
    out('footer:',foot)
    pg.screenshot(path='../shots/03-settings.png',full_page=True)
    out('errs',errs,'dialogs',dl)
    b.close()
