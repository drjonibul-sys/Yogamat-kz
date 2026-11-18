/* Логотип: значок ярлыка, водяной знак, собственный логотип (администратор). Хранится на устройстве, не входит в резервные копии. */
(() => {
  'use strict';
  const KEY = 'yogaTrackerLogo_v1';
  const DEFAULT_SRC = 'icons/logo.png';
  const links = {
    icon: document.querySelector('link[rel="icon"]'),
    apple: document.querySelector('link[rel="apple-touch-icon"]')
  };
  const defaults = { icon: links.icon && links.icon.getAttribute('href'), apple: links.apple && links.apple.getAttribute('href') };
  let custom = null, showMark = true;

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (data && typeof data === 'object') {
        showMark = data.mark !== false;
        if (typeof data.logo === 'string' && data.logo.startsWith('data:image/') && typeof data.icon === 'string' && data.icon.startsWith('data:image/')) custom = { logo: data.logo, icon: data.icon };
      }
    } catch { /* стандартный логотип */ }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ logo: custom && custom.logo, icon: custom && custom.icon, mark: showMark })); return true; }
    catch { if (typeof showToast === 'function') showToast('Не удалось сохранить логотип: нет места в памяти браузера'); return false; }
  }
  const logoSrc = () => (custom ? custom.logo : DEFAULT_SRC);
  window.appLogoSrc = logoSrc;

  const mark = document.createElement('img');
  mark.id = 'appWatermark'; mark.alt = ''; mark.setAttribute('aria-hidden', 'true'); mark.draggable = false;
  document.body.append(mark);

  function apply() {
    mark.src = logoSrc();
    mark.hidden = !showMark;
    if (links.icon) links.icon.setAttribute('href', custom ? custom.icon : defaults.icon);
    if (links.apple) links.apple.setAttribute('href', custom ? custom.icon : defaults.apple);
    document.querySelectorAll('.login-logo').forEach(img => { img.src = logoSrc(); });
    render();
  }

  function render() {
    const card = document.getElementById('settingsLogoCard'); if (!card) return;
    card.innerHTML = `<div class="logo-preview">
        <img class="logo-thumb" id="logoThumb" alt="Текущий логотип" src="${logoSrc()}">
        <div><strong>${custom ? 'Свой логотип' : 'Стандартный логотип'}</strong>
          <div class="field-hint" style="margin:2px 0 0">Используется как значок ярлыка и водяной знак на страницах.</div></div>
      </div>
      <input id="logoFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
      <div class="btn-row"><button class="btn secondary small" style="flex:1" id="logoUpload" type="button">Загрузить логотип</button>
        <button class="btn secondary small" style="flex:1" id="logoReset" type="button" ${custom ? '' : 'disabled'}>Вернуть стандартный</button></div>
      <label class="check-row" style="margin-top:12px"><input id="logoMark" type="checkbox" ${showMark ? 'checked' : ''}> Показывать водяной знак на страницах</label>
      <div class="logo-note">Подойдёт квадратная или близкая к квадрату картинка (PNG, JPG), от 512 px по большей стороне. Прозрачный фон будет залит белым. После смены логотипа значок на домашнем экране не обновляется сам: удалите ярлык и добавьте его заново («Поделиться» → «На экран Домой»).</div>`;
    const file = card.querySelector('#logoFile');
    card.querySelector('#logoUpload').onclick = () => { if (admin()) file.click(); };
    card.querySelector('#logoReset').onclick = () => {
      if (!admin()) return;
      custom = null; if (save()) { apply(); notify('Стандартный логотип восстановлен'); }
    };
    card.querySelector('#logoMark').onchange = event => {
      if (!admin()) { event.target.checked = showMark; return; }
      showMark = event.target.checked; if (save()) apply();
    };
    file.onchange = () => { const chosen = file.files && file.files[0]; file.value = ''; if (chosen) importFile(chosen); };
  }
  const admin = () => { if (typeof isAdmin === 'function' ? isAdmin() : true) return true; notify('Доступно только администратору'); return false; };
  const notify = text => { if (typeof showToast === 'function') showToast(text); };

  function importFile(file) {
    if (!/^image\//.test(file.type)) return notify('Выберите изображение (PNG или JPG)');
    if (file.size > 10 * 1024 * 1024) return notify('Файл больше 10 МБ');
    const url = URL.createObjectURL(file), image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      const w = image.naturalWidth, h = image.naturalHeight;
      if (!w || !h) return notify('Не удалось прочитать изображение');
      if (Math.max(w, h) < 128) return notify('Изображение слишком маленькое (минимум 128 px)');
      const draw = (width, height, pad) => {
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, width, height);
        const scale = Math.min((width * (1 - pad)) / w, (height * (1 - pad)) / h);
        const dw = w * scale, dh = h * scale;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(image, (width - dw) / 2, (height - dh) / 2, dw, dh);
        return canvas;
      };
      try {
        const longSide = Math.min(800, Math.max(w, h)), ratio = w / h;
        const lw = ratio >= 1 ? longSide : Math.round(longSide * ratio), lh = ratio >= 1 ? Math.round(longSide / ratio) : longSide;
        custom = { logo: draw(lw, lh, 0).toDataURL('image/jpeg', 0.92), icon: draw(512, 512, 0.1).toDataURL('image/jpeg', 0.92) };
      } catch { return notify('Не удалось обработать изображение'); }
      if (save()) { apply(); notify('Логотип сохранён'); } else { custom = null; load(); apply(); }
    };
    image.onerror = () => { URL.revokeObjectURL(url); notify('Не удалось открыть изображение'); };
    image.src = url;
  }

  load(); apply();
  window.renderLogoSettings = render;
})();
