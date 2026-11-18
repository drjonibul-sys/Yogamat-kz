/* Browser/PWA adapter. Business data stays in the existing localStorage model. */
(() => {
  'use strict';
  const standalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  let installPrompt = null, registration = null, offlineReady = false;
  let installError = '', updateRequested = false, version = '';
  let coreReady = false, preparing = false, loaded = 0, total = 0, cacheError = '';
  let autoPreparedVersion = '', checking = false;
  // The sheet no longer follows visualViewport: resizing a fixed overlay while the iPad keyboard opens can make Safari drop the input focus.

  const card = document.createElement('section');
  card.id = 'pwaStatusCard'; card.className = 'card pwa-status';
  card.innerHTML = '<div class="pwa-status-main"><h3 id="pwaLaunchStatus">Йога-практика</h3><p id="pwaOfflineStatus" role="status">Подготовка автономной работы…</p><progress id="pwaDownloadProgress" hidden aria-label="Загрузка автономной копии"></progress></div><div class="pwa-actions"><button type="button" class="btn secondary small" id="pwaInstallHelp">На главный экран</button><button type="button" class="btn secondary small" id="pwaDownload" hidden>Скачать для офлайн</button><button type="button" class="btn small" id="pwaUpdate" hidden>Обновить</button></div>';
  document.getElementById('settingsPwaSlot').append(card);
  document.getElementById('pwaInstallHelp').addEventListener('click', openInstallHelp);
  const headerButton = document.createElement('button');
  headerButton.className = 'pwa-install-header';
  headerButton.type = 'button'; headerButton.setAttribute('aria-label', 'Установка на домашний экран');
  headerButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M8 5H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-3M12 15V2m-4 4 4-4 4 4"/></svg>';
  headerButton.addEventListener('click', openInstallHelp);
  document.querySelector('.app-header').append(headerButton);

  function renderStatus() {
    const installed = standalone();
    document.getElementById('pwaLaunchStatus').textContent = installed
      ? 'Приложение с домашнего экрана' : 'Открыто во вкладке браузера';
    const status = document.getElementById('pwaOfflineStatus');
    const count = total ? ` Сохранено файлов: ${loaded} из ${total}.` : '';
    status.textContent = installError || (offlineReady
      ? (navigator.onLine ? 'Готово к работе без интернета. Справочник и иллюстрации сохранены.' : 'Без подключения к сети. Учёт, справочник и иллюстрации доступны.')
      : cacheError === 'storage'
        ? 'Недостаточно места для полной автономной копии. Освободите место на устройстве и нажмите «Повторить загрузку».' + count
        : preparing
          ? 'Загружаем автономную копию. Оставьте приложение открытым.' + count
          : cacheError
            ? 'Загрузка прервалась. Проверьте интернет и вход в приложение, затем нажмите «Повторить загрузку».' + count
            : coreReady
              ? 'Учёт и тексты доступны без сети. Иллюстрации ещё не все сохранены.' + count
              : 'Подготовка автономной работы. Оставьте приложение открытым с интернетом.');
    card.dataset.offlineReady = String(offlineReady);
    document.getElementById('pwaInstallHelp').textContent = installed ? 'Об установке' : 'На главный экран';
    const progress = document.getElementById('pwaDownloadProgress');
    progress.hidden = !total || offlineReady;
    progress.max = total || 1; progress.value = loaded;
    const download = document.getElementById('pwaDownload');
    download.hidden = offlineReady || !('serviceWorker' in navigator) || !isSecureContext || location.protocol === 'file:';
    download.disabled = preparing || checking;
    download.textContent = preparing ? 'Загрузка…' : (cacheError || installError ? 'Повторить загрузку' : 'Скачать для офлайн');
    document.getElementById('pwaUpdate').hidden = !registration?.waiting;
  }
  function openInstallHelp() {
    const isLocalFile = location.protocol === 'file:';
    openSheet(`<div class="sheet-head"><h3>На домашнем экране</h3><button class="sheet-close" type="button" onclick="closeSheet()" aria-label="Закрыть">✕</button></div>
      ${standalone() ? '<p>Приложение уже запущено с домашнего экрана.</p>' : ''}
      ${isLocalFile ? '<p>Для установки откройте приложение по HTTPS-ссылке. Локальный HTML-файл нельзя установить с автономной работой на iPhone.</p>' : ''}
      <h4>iPhone и iPad</h4>
      <ol class="pwa-install-steps"><li>Откройте эту страницу в <strong>Safari</strong>.</li><li>Нажмите <strong>«Поделиться»</strong> (квадрат со стрелкой вверх).</li><li>Выберите <strong>«На экран „Домой“»</strong> / <strong>«Добавить на экран Домой»</strong>. Если есть переключатель <strong>«Открывать как веб-приложение»</strong>, включите его.</li><li>Нажмите <strong>«Добавить»</strong> и запускайте «Йога-практика» с появившегося значка.</li></ol>
      <p class="field-hint">Если страница открыта внутри другого приложения, сначала выберите «Открыть в Safari».</p>
      ${installPrompt && !standalone() ? '<button class="btn" type="button" id="pwaNativeInstall">Установить приложение</button>' : ''}
      <h4>Запуск со значка и работа без сети</h4><p>Страница Safari сама не закрывается и не превращается в отдельное приложение. Установите значок и запустите приложение с него. В блоке «Обзор» появится «Приложение с домашнего экрана». Это состояние не зависит от подключения к интернету.</p><p>${offlineReady ? 'Автономная копия готова.' : 'При первом открытии дождитесь надписи «Готово к работе без интернета» на странице «Обзор».'} После установки дождитесь готовности именно в окне со значка: Safari и установленное приложение могут хранить отдельные копии. Для проверки включите авиарежим, отключите Wi-Fi, закройте приложение и откройте его со значка. Внешние ссылки на источники требуют сети.</p>
      <h4>Если на iPad всё ещё открывается Safari</h4><p>Откройте HTTPS-ссылку непосредственно в Safari и создайте значок заново через «Поделиться → На экран Домой». Если есть переключатель «Открывать как веб-приложение», включите его. Старый ярлык может быть обычной закладкой. Перед удалением старого значка сохраните JSON-копию данных. Обновите iPadOS до последней версии, доступной для вашего iPad.</p><h4>Ваши данные</h4><p>Клиенты и абонементы хранятся в этом браузере на этом устройстве. Синхронизации между iPhone и iPad нет. Регулярно сохраняйте JSON через шестерёнку → «Сохранить копию в файл».</p>
      <p class="field-hint">Установленное веб-приложение и вкладка Safari могут иметь отдельные хранилища. Перед переносом сохраните JSON, затем восстановите его в приложении, открытом со значка. Очистка данных сайта может удалить локальные записи и копии.</p>`);
    document.getElementById('pwaNativeInstall')?.addEventListener('click', async () => {
      const prompt = installPrompt; if (!prompt) return;
      await prompt.prompt();
      const choice = await prompt.userChoice;
      installPrompt = null;
      if (choice.outcome === 'accepted') { closeSheet(); showToast('Завершите установку в браузере'); }
      else openInstallHelp();
    });
  }
  window.openPwaInstallHelp = openInstallHelp;
  addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; });
  addEventListener('appinstalled', () => { installPrompt = null; renderStatus(); });
  addEventListener('online', () => { autoPreparedVersion = ''; refreshCacheStatus(); renderStatus(); });
  addEventListener('offline', renderStatus);

  function prepareOffline() {
    const worker = registration?.active || navigator.serviceWorker?.controller;
    if (!worker || !navigator.onLine) { renderStatus(); return; }
    preparing = true; cacheError = ''; installError = '';
    worker.postMessage({type:'PREPARE_OFFLINE'});
    renderStatus();
  }
  function acceptStatus(data) {
    if (typeof data?.ready !== 'boolean') return;
    offlineReady = data.ready;
    coreReady = data.coreReady === true || offlineReady;
    loaded = Number(data.loaded) || 0; total = Number(data.total) || 0;
    preparing = data.preparing === true; cacheError = data.error || '';
    version = typeof data.version === 'string' ? data.version : '';
    if (coreReady) installError = '';
    renderStatus();
    if (coreReady && !offlineReady && !preparing && navigator.onLine && version && autoPreparedVersion !== version) {
      autoPreparedVersion = version;
      prepareOffline();
    }
  }
  async function refreshCacheStatus() {
    const worker = registration?.active || navigator.serviceWorker?.controller;
    if (!worker) return;
    const channel = new MessageChannel();
    const timeout = setTimeout(() => {
      channel.port1.close(); preparing = false;
      installError = 'Не удалось проверить автономную копию. Нажмите «Повторить загрузку» при подключении к интернету.';
      renderStatus();
    }, 15000);
    channel.port1.onmessage = event => {
      clearTimeout(timeout); channel.port1.close(); acceptStatus(event.data);
    };
    worker.postMessage({type:'CACHE_STATUS'}, [channel.port2]);
  }
  navigator.serviceWorker?.addEventListener('message', event => {
    if (event.data?.type === 'CACHE_STATUS') acceptStatus(event.data);
  });
  document.getElementById('pwaDownload').addEventListener('click', async () => {
    if (checking) return;
    checking = true; installError = ''; renderStatus();
    try {
      if (!registration) await registerWorker();
      else if (navigator.onLine) await registration.update();
      autoPreparedVersion = version;
      prepareOffline();
      await refreshCacheStatus();
    } catch {
      installError = 'Не удалось загрузить обновление. Проверьте интернет и вход в приложение.';
    } finally { checking = false; renderStatus(); }
  });
  document.getElementById('pwaUpdate').addEventListener('click', () => {
    if (!registration?.waiting) return;
    // An update is user-initiated, so an open form is never discarded automatically.
    if (!confirm('Обновить приложение? Открытая несохранённая форма будет закрыта. Сохранённые данные останутся на устройстве.')) return;
    updateRequested = true;
    registration.waiting.postMessage({type:'SKIP_WAITING'});
  });
  function registerWorker() {
    return navigator.serviceWorker.register('./sw.js', {scope:'./', updateViaCache:'none'}).then(async reg => {
      registration = reg;
      const observe = worker => worker?.addEventListener('statechange', () => {
        renderStatus();
        if (worker.state === 'activated') refreshCacheStatus();
        if (worker.state === 'redundant' && !coreReady) {
          installError = 'Не удалось подготовить автономную копию. Проверьте интернет и нажмите «Повторить загрузку».';
          preparing = false; renderStatus();
        }
      });
      observe(reg.installing);
      reg.addEventListener('updatefound', () => observe(reg.installing));
      renderStatus();
      await navigator.serviceWorker.ready;
      await refreshCacheStatus();
    }).catch(() => {
      preparing = false;
      installError = 'Автономная работа пока недоступна. Проверьте интернет и вход в приложение, затем нажмите «Повторить загрузку».';
      renderStatus();
    });
  }
  if ('serviceWorker' in navigator && isSecureContext && location.protocol !== 'file:') {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (updateRequested) location.reload();
      else refreshCacheStatus();
    });
    registerWorker();
  } else {
    installError = location.protocol === 'file:'
      ? 'Для установки и автономной работы откройте приложение по HTTPS-ссылке.'
      : 'Этот браузер не поддерживает автономную установку. Откройте HTTPS-ссылку в Safari.';
    renderStatus();
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      syncRentPeriods();
      if(typeof renderRentReminder==='function') renderRentReminder();
      checkAutoBackup(); renderHeader(); refreshCacheStatus();
      renderStatus();
      if (navigator.onLine) registration?.update().catch(() => {});
    }
  });
  // Separate browser tabs share localStorage but hold separate in-memory state.
  addEventListener('storage', event => {
    if (event.storageArea !== localStorage || event.key !== STORAGE_KEY) return;
    if (!event.newValue || document.getElementById('overlay').classList.contains('active')) {
      if (document.getElementById('pwaStorageConflict')) return;
      const notice = document.createElement('div');
      notice.id = 'pwaStorageConflict'; notice.className = 'pwa-storage-conflict';
      notice.setAttribute('role','alertdialog'); notice.setAttribute('aria-modal','true');
      notice.setAttribute('aria-labelledby','pwaConflictTitle');
      notice.innerHTML = '<div class="card"><h3 id="pwaConflictTitle">Данные изменились в другой вкладке</h3><p>Обновите приложение, чтобы использовать актуальные записи. Несохранённая форма будет закрыта.</p><button type="button" class="btn">Загрузить актуальные данные</button></div>';
      notice.querySelector('button').addEventListener('click', () => location.reload());
      document.body.append(notice);
      for (const element of document.body.children) if (element !== notice) element.inert = true;
      notice.querySelector('button').focus();
      return;
    }
    try {
      state = validateSnapshot(JSON.parse(event.newValue));
      const current = document.querySelector('.page.active')?.id.replace('page-','');
      if (current === 'client-detail') renderClientDetail();
      else if (current && current !== 'help') showPage(current);
      renderHeader();
      showToast('Данные обновлены из другой вкладки');
    } catch {
      showToast('Не удалось загрузить данные из другой вкладки. Сохраните внешнюю копию.');
    }
  });

  const originalArchive = archiveHtml;
  archiveHtml = function () {
    return originalArchive()
      .replace('Автоматическая копия создаётся раз в неделю и сохраняется в локальном хранилище браузера — там же, где хранятся все данные приложения.',
        'Копии сохраняются на этом устройстве. Синхронизации между устройствами нет. Сохраните JSON отдельно в «Файлы»: очистка данных сайта удаляет и записи, и внутренние копии. Автокопия проверяется при открытии и возвращении в приложение.')
      .replace('Скачать в файл', 'Сохранить копию в файл');
  };
  exportBackupFile = async function () {
    const content = JSON.stringify({exportedAt:new Date().toISOString(), ...snapshotData()}, null, 2);
    const name = 'yoga-tracker-backup-' + todayISO() + '.json';
    const file = new File([content], name, {type:'application/json'});
    if (navigator.canShare?.({files:[file]}) && navigator.share) {
      try { await navigator.share({files:[file], title:'Резервная копия — Йога-практика'}); }
      catch (error) {
        if (error.name !== 'AbortError') download();
      }
      return;
    }
    download();
    function download() {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      showToast('Выберите место сохранения копии в браузере');
    }
  };
  renderStatus();
})();
