"""PDF-выгрузка: A4 книжный, кириллица, несколько страниц, кнопки."""
import sys, base64, re, subprocess
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
res = []
def ok(n, c): res.append(bool(c)); print(('ok   ' if c else 'FAIL ') + n)
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 390, 'height': 844}, locale='ru-RU'); page = ctx.new_page()
    errs = []; page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto(BASE); page.wait_for_selector('.auth')
    page.fill('.auth input >> nth=0', 'Анна'); page.fill('.auth input >> nth=1', '1234'); page.fill('.auth input >> nth=2', '1234')
    page.click('text=Продолжить'); page.check('#rc-ok'); page.click('text=Начать работу'); page.wait_for_selector('.tabbar')
    page.evaluate("""() => { const s = App.store; for (let i = 1; i <= 45; i++) { s.addQuickSale({ name: 'Клиент Длинная-Фамилия ' + i, phone: '+7 701 234 56 ' + String(i).padStart(2,'0'), tariffName: '8 занятий / месяц', purchaseDate: '2026-11-01', expiryDate: '2026-12-01', visitsTotal: 8, price: 28000, paid: i % 3 !== 0, paidDate: i % 3 !== 0 ? '2026-11-05' : null }); } }""")
    b64 = page.evaluate("""async () => { const r = await Pdf.build('Клиенты студии', App.store.clientsCSV(), 'Студия · 18.11.2026'); const buf = new Uint8Array(await r.blob.arrayBuffer()); let s=''; for (let i=0;i<buf.length;i+=8192) s+=String.fromCharCode.apply(null, buf.subarray(i,i+8192)); return btoa(s) + '|' + r.pages; }""")
    data, pages = b64.split('|'); raw = base64.b64decode(data); open('/tmp/shots/clients.pdf', 'wb').write(raw)
    ok('это PDF', raw[:5] == b'%PDF-')
    mb = re.findall(rb'/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]', raw)
    ok('формат A4 книжный (595×842)', mb and round(float(mb[0][0])) == 595 and round(float(mb[0][1])) == 842)
    ok('несколько страниц (%s)' % pages, int(pages) >= 2)
    subprocess.run(['pdftoppm', '-r', '70', '-png', '-f', '1', '-l', '1', '/tmp/shots/clients.pdf', '/tmp/shots/pdf-clients'], check=True)
    txt = subprocess.run(['pdftotext', '-layout', '/tmp/shots/clients.pdf', '-'], capture_output=True, text=True).stdout
    flat = re.sub(r'\s+', ' ', txt); ok('кириллица, телефон и колонтитул в тексте PDF', 'Длинная-Фамилия 1' in flat and '+7 701 234 56 01' in flat and 'Стр. 1 из 2' in flat and 'Разработано yoga_matkz' in flat and 'Стр. 1 из' in txt and 'Разработано yoga_matkz' in txt)
    # кнопка и окно
    page.goto(BASE + '#/clients'); page.wait_for_selector('text=PDF'); page.click('.btn:has-text("PDF")'); page.wait_for_selector('text=PDF готов', timeout=20000)
    ok('кнопка «PDF» открывает окно готового файла', 'A4 книжный' in page.inner_text('.sheet')); page.keyboard.press('Escape')
    page.goto(BASE + '#/settings'); page.wait_for_selector('text=Скачать табель (PDF, A4)'); page.click('text=Скачать табель (PDF, A4)'); page.wait_for_selector('text=PDF готов', timeout=20000)
    ok('табель визитов: PDF создаётся даже без записей', True); page.keyboard.press('Escape')
    page.goto(BASE + '#/debts'); page.wait_for_selector('.btn:has-text("PDF")'); page.click('.btn:has-text("PDF")'); page.wait_for_selector('text=PDF готов', timeout=20000); ok('долги: PDF создаётся', True)
    b.close()
print('ошибок страницы:', errs); sys.exit(0 if all(res) and not errs else 1)
