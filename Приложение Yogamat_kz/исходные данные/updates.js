/* Optional update manager: settings, source checks, explicit consent. Records are never modified. */
(() => {
  'use strict';
  const KEY = 'yoga-practice-update-settings-v1';
  const DEFAULT = new URL('./', location.href).href;
  const LIMIT_MS = 6 * 60 * 60 * 1000;
  let settings = {source:DEFAULT, auto:true, lastCheck:0};
  let busy = false;
  let status = 'Новая версия ещё не проверялась.';
  let candidate = null;
  let reg = null;
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (typeof stored.source === 'string') settings.source = stored.source;
    if (typeof stored.auto === 'boolean') settings.auto = stored.auto;
    if (Number.isFinite(stored.lastCheck)) settings.lastCheck = stored.lastCheck;
  } catch { /* Legacy settings are not relevant to user records. */ }
  const save = () => localStorage.setItem(KEY, JSON.stringify(settings));
  /* при первом открытии через сайт адрес источника обновлений запоминается автоматически; изменить можно вручную */
  try { if (!localStorage.getItem(KEY) && location.protocol === 'https:') save(); } catch { /* адрес останется по умолчанию */ }
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function normalize(source) {
    const url = new URL(source, location.href);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
      throw Error('Введите HTTPS-адрес каталога приложения без логина, параметров и фрагмента.');
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1')
      throw Error('Для проверки необходим HTTPS-адрес.');
    if (!url.pathname.endsWith('/')) url.pathname += '/';
    return url.href;
  }
  function isInstallable(source) {
    return source === DEFAULT;
  }
  function render() {
    const area = document.getElementById('yogaUpdateSettings');
    if (!area) return;
    area.innerHTML = `
      <h4 style="margin:12px 0 8px">Обновления приложения</h4>
      <label style="display:block;margin:7px 0">Адрес сайта-источника
        <input id="yogaUpdateSource" type="url" autocomplete="url" spellcheck="false" value="${esc(settings.source)}" style="display:block;width:100%;margin-top:5px" />
      </label>
      <div class="btn-row" style="margin:8px 0">
        <button type="button" class="btn secondary small" id="yogaSaveSource">Сохранить адрес</button>
        <button type="button" class="btn secondary small" id="yogaResetSource">Вернуть текущий сайт</button>
      </div>
      <label style="display:flex;gap:8px;align-items:center"><input id="yogaUpdateAuto" type="checkbox" ${settings.auto?'checked':''}> Автоматически проверять при открытии и каждые 6 часов</label>
      <p id="yogaUpdateStatus" role="status" class="field-hint" style="margin:10px 0;white-space:pre-wrap">${esc(status)}</p>
      <div class="btn-row">
        <button type="button" class="btn secondary small" id="yogaCheckUpdate" ${busy?'disabled':''}>${busy?'Проверка…':'Проверить обновления'}</button>
        <button type="button" class="btn small" id="yogaInstallUpdate" ${candidate?'':'hidden'}>Установить обновление</button>
      </div>
      <p class="field-hint" style="margin-top:9px">Обновляются только ресурсы приложения в PWA-кэше. Клиенты, абонементы, платежи, посещения, аренда и резервные копии не изменяются. Перед установкой рекомендуется сохранить JSON-копию отдельно.</p>
      <p class="field-hint">Установить обновление можно только с того же HTTPS-адреса и каталога, где установлено приложение. Внешний источник можно указать для проверки, если сервер разрешает CORS; для его установки необходимо сначала опубликовать новую версию на текущем сайте. Обновления сайта не заменяют файлы на сервере.</p>`;
    area.querySelector('#yogaSaveSource').onclick = () => {
      try { settings.source = normalize(area.querySelector('#yogaUpdateSource').value.trim()); settings.lastCheck=0; save(); candidate=null;
        status='Источник сохранён: ' + settings.source; render(); }
      catch (error) { status=error.message; render(); }
    };
    area.querySelector('#yogaResetSource').onclick = () => {settings.source=DEFAULT; settings.lastCheck=0;candidate=null;save();status='Источник сброшен на текущий сайт.';render();};
    area.querySelector('#yogaUpdateAuto').onchange = event => {settings.auto=event.target.checked;save(); if(settings.auto) check(false);};
    area.querySelector('#yogaCheckUpdate').onclick = () => check(true);
    area.querySelector('#yogaInstallUpdate').onclick = install;
  }
  const previousArchive = window.archiveHtml;
  window.archiveHtml = function () {
    const html = previousArchive();
    return html.replace(/(<div class="section-title" style="margin-top:20px"><h2 style="font-size:15px">Сохранённые копии<\/h2><\/div>)/,
      '<div id="yogaUpdateSettings" class="card" style="margin-top:16px;padding:12px"><p>Настройки обновления загружаются…</p></div>$1');
  };
  const originalOpenArchive = window.openArchiveSheet;
  window.openArchiveSheet = function () { originalOpenArchive(); render(); };
  // Archive can be refreshed by backup actions; refresh update settings in same turn.
  const originalRefreshArchive = window.refreshArchiveSheetIfOpen;
  window.refreshArchiveSheetIfOpen = function () {originalRefreshArchive();render();};
  async function workerRegistration() {
    if (!('serviceWorker' in navigator) || !isSecureContext || location.protocol === 'file:')
      throw Error('Проверка установки доступна только в PWA на HTTPS (либо localhost).');
    reg = await navigator.serviceWorker.getRegistration('./') || await navigator.serviceWorker.register('./sw.js', {scope:'./',updateViaCache:'none'});
    return reg;
  }
  async function check(manual) {
    if (busy || !navigator.onLine) {if(manual){status='Нет подключения к интернету.';render();}return;}
    busy=true;candidate=null;status='Проверка опубликованной версии…';render();
    try {
      const source=normalize(settings.source);
      const endpoint=new URL('app-update.json',source);
      const response=await fetch(endpoint.href,{cache:'no-store',mode:'cors',redirect:'error',credentials: source===DEFAULT?'same-origin':'omit'});
      if(!response.ok || response.type==='opaque') throw Error('Сервер не предоставил метаданные версии (HTTP '+response.status+').');
      const manifest=await response.json();
      if(manifest?.schema!==1 || manifest.app!=='yoga-practice-pwa' || !/^[0-9a-f]{16}$/.test(manifest.version))
        throw Error('На указанном сайте нет совместимого файла app-update.json.');
      const registration=await workerRegistration();
      if(isInstallable(source)) await registration.update();
      const active=registration.active;
      const current=await new Promise(resolve => {
        if(!active){resolve(null);return;}
        const channel=new MessageChannel();
        const timer=setTimeout(()=>{channel.port1.close();resolve(null);},5000);
        channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data?.version||null);};
        active.postMessage({type:'CACHE_STATUS'},[channel.port2]);
      });
      if(isInstallable(source) && registration.waiting && current && current!==manifest.version) {
        candidate={version:manifest.version, registration};
        status='Доступно обновление. Текущая версия: '+current+'; новая: '+manifest.version+'. Установка только после подтверждения.';
      } else if(current===manifest.version) {
        status='Установлена актуальная версия: '+manifest.version+'.';
      } else if(!isInstallable(source)) {
        status='Источник сообщает версию '+manifest.version+'. Текущая: '+(current||'не определена')+'. Это другой адрес: браузер не может заменить приложение с другого домена. Опубликуйте файлы обновления на текущем HTTPS-сайте.';
      } else if(registration.installing) {
        status='Версия '+manifest.version+' обнаружена, загрузка нового пакета ещё не завершилась. Повторите проверку после завершения загрузки.';
      } else {
        status='Источник сообщает версию '+manifest.version+', текущая: '+(current||'не определена')+'. Готовое обновление пока не найдено; проверьте публикацию sw.js на сервере.';
      }
      settings.lastCheck=Date.now();save();
    } catch(error) {status='Не удалось проверить обновления: '+(error?.message||'ошибка сети')+'. Для внешнего сайта необходим доступ CORS и app-update.json.';}
    finally {busy=false;render();}
  }
  async function install() {
    if(!candidate) return;
    const {registration,version}=candidate;
    if (!registration.waiting) {candidate=null;status='Обновление ещё не готово. Проверьте снова.';render();return;}
    if(!confirm('Установить версию '+version+'? Приложение перезапустится. Сохранённые данные пользователей и резервные копии не удаляются. Несохранённые формы могут быть закрыты.')) return;
    // Preserve business data; no localStorage clearing, schema reset, or cache deletion outside app cache.
    try { if(typeof createBackup==='function') createBackup('pre-update'); } catch { /* Optional backup; never block updates because quota is full. */ }
    sessionStorage.setItem('yoga-pwa-update-reload','1');
    registration.waiting.postMessage({type:'SKIP_WAITING'});
    status='Подтверждено. Активация обновления…';render();
  }
  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    if(sessionStorage.getItem('yoga-pwa-update-reload')==='1') {
      sessionStorage.removeItem('yoga-pwa-update-reload');location.reload();
    }
  });
  function autoCheck() {
    if(settings.auto && navigator.onLine && Date.now()-settings.lastCheck>=LIMIT_MS) check(false);
  }
  addEventListener('online',autoCheck);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden) autoCheck();});
  // The site may be loading a large offline atlas; postpone check until initialization finishes.
  if(document.readyState==='complete') autoCheck();
  else addEventListener('load',autoCheck,{once:true});
})();
