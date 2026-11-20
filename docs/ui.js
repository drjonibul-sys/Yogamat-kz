/* Йога-студия yoga_matkz — общие элементы интерфейса */
(function () {
  'use strict';
  const { RU } = Studio;

  /* ---------- DOM ---------- */
  function h(tag, props) {
    const el = document.createElement(tag);
    const kids = Array.prototype.slice.call(arguments, 2);
    if (props) {
      Object.keys(props).forEach((k) => {
        const v = props[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'value') el.value = v;
        else if (k === 'checked') el.checked = !!v;
        else if (k === 'disabled') el.disabled = !!v;
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    (function add(list) {
      list.forEach((c) => {
        if (c == null || c === false) return;
        if (Array.isArray(c)) add(c);
        else el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
      });
    })(kids);
    return el;
  }
  const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  /* ---------- иконки ---------- */
  const PATHS = {
    home: '<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14.5c2.4 0 4.2 1.7 4.2 4.5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    chart: '<path d="M5 20V11M12 20V5M19 20v-7"/>',
    lotus: '<circle cx="12" cy="5.5" r="2.2"/><path d="M12 8.5v5M12 13.5l-4 6M12 13.5l4 6M5 11.5l7 2 7-2"/>',
    back: '<path d="m14.5 5.5-6.5 6.5 6.5 6.5"/>',
    chev: '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    gear: '<path d="M4 7h9M19 7h1M4 17h1M11 17h9"/><circle cx="16" cy="7" r="2.4"/><circle cx="8" cy="17" r="2.4"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    edit: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z"/><path d="m14.5 7.5 3 3"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.5h9.4L17.5 7"/>',
    download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
    upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19.5h14"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
  logout: '<path d="M10 4.5H6a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6 19.5h4M15 8l4 4-4 4M19 12H9.5"/>',
    star: '<path d="m12 4 2.4 5 5.4.7-4 3.8 1 5.4L12 16.2 7.2 18.9l1-5.4-4-3.8 5.4-.7z"/>',
    book: '<path d="M5 4.5h10a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3zM5 16.5a3 3 0 0 1 3-3h10"/>',
    money: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M9.5 10c0-1 1-1.7 2.5-1.7s2.5.7 2.5 1.7c0 2.4-5 1.2-5 3.7 0 1 1 1.7 2.5 1.7s2.5-.7 2.5-1.7"/>',
    alert: '<path d="M12 4 3.5 19.5h17zM12 10v4.5M12 17v.3"/>',
    user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c0-3.6 3-6 7-6s7 2.4 7 6"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    repeat: '<path d="M4.5 11V9.5a3 3 0 0 1 3-3H18M15.5 3.5l3 3-3 3M19.5 13v1.5a3 3 0 0 1-3 3H6M8.5 20.5l-3-3 3-3"/>',
    key: '<circle cx="8" cy="14" r="3.5"/><path d="m10.5 11.5 8-8M15.5 6.5l2 2M13.5 8.5l2 2"/>'
  };
  function icon(name, cls) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '1.9'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true'); if (cls) s.setAttribute('class', cls);
    s.innerHTML = PATHS[name] || '';
    return s;
  }

  /* ---------- мелкие компоненты ---------- */
  function avatar(name, size) {
    size = size || 44;
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    const ini = parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '·';
    return h('div', { class: 'avatar', style: { width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.38) + 'px' } }, ini);
  }
  const pill = (text, kind) => h('span', { class: 'pill' + (kind ? ' ' + kind : '') }, text);
  function statusPill(store, sub) {
    const st = store.statusOf(sub);
    return pill(store.statusTitle(st), st === 'active' ? '' : st === 'finished' ? 'sand' : 'warn');
  }
  function empty(ic, title, message) {
    return h('div', { class: 'card' }, h('div', { class: 'empty' },
      h('div', { class: 'ic' }, icon(ic)), h('div', { class: 'h3' }, title), message ? h('div', { class: 'soft small' }, message) : null));
  }
  function bar(percent, warn) { return h('div', { class: 'bar' + (warn ? ' warn' : '') }, h('i', { style: { width: Math.max(0, Math.min(100, percent)) + '%' } })); }
  function chip(label, on, onclick) { return h('button', { class: 'chip' + (on ? ' on' : ''), type: 'button', onclick }, label); }
  function footer(version) {
    return h('div', { class: 'app-footer' }, 'Версия: ' + version + ' · ', h('em', null, 'Разработано yoga_matkz'));
  }

  /* ---------- поля форм ---------- */
  function field(label, input, hint) {
    const id = 'f' + Math.random().toString(36).slice(2, 8);
    if (input.setAttribute && /^(INPUT|SELECT|TEXTAREA)$/.test(input.tagName)) input.id = id;
    return h('div', { class: 'field' }, label ? h('label', { for: id }, label) : null, input, hint ? h('div', { class: 'hint' }, hint) : null);
  }
  const input = (o) => h('input', Object.assign({ class: 'inp', type: 'text', autocomplete: 'off', autocapitalize: 'sentences' }, o));
  const textarea = (o) => h('textarea', Object.assign({ class: 'inp' }, o));
  function select(options, value, onchange) {
    const s = h('select', { class: 'inp', onchange }, options.map((o) => h('option', { value: o.value }, o.label)));
    s.value = value; return s;
  }
  /* выбор контрольного вопроса: 5 типовых + «Свой вопрос» */
  function questionPicker(current) {
    const std = Studio.STANDARD_QUESTIONS; const custom = !!current && !std.includes(current);
    const sel = h('select', { class: 'inp', 'aria-label': 'Контрольный вопрос' }, h('option', { value: '' }, 'Выберите вопрос'), std.map((q) => h('option', { value: q }, q)), h('option', { value: '__custom' }, 'Свой вопрос'));
    const own = h('input', { class: 'inp', maxlength: 80, autocomplete: 'off', placeholder: 'Введите ваш вопрос', 'aria-label': 'Свой вопрос', hidden: !custom, value: custom ? current : '' });
    sel.value = custom ? '__custom' : (current || '');
    sel.addEventListener('change', () => { own.hidden = sel.value !== '__custom'; if (!own.hidden) own.focus(); });
    return { el: h('div', { class: 'stack s8' }, sel, own), value: () => (sel.value === '__custom' ? own.value.trim() : sel.value) };
  }
  function toggle(label, on, onchange, sub) {
    const b = h('button', { class: 'toggle', type: 'button', role: 'switch', 'aria-checked': on ? 'true' : 'false' },
      h('span', null, h('div', null, label), sub ? h('div', { class: 'hint' }, sub) : null), h('span', { class: 'sw' }));
    b.addEventListener('click', () => { const v = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', v ? 'true' : 'false'); onchange(v); });
    return b;
  }
  function stepper(value, min, max, step, onchange, fmt) {
    let v = value; const out = h('b', { class: 'num' }, fmt ? fmt(v) : String(v));
    const set = (n) => { v = Math.max(min, Math.min(max, n)); out.textContent = fmt ? fmt(v) : String(v); onchange(v); };
    return h('div', { class: 'stepper' }, h('button', { type: 'button', 'aria-label': 'Меньше', onclick: () => set(v - step) }, '−'), out, h('button', { type: 'button', 'aria-label': 'Больше', onclick: () => set(v + step) }, '+'));
  }
  function phoneInput(value) {
    const i = input({ type: 'tel', inputmode: 'tel', placeholder: '+7 701 234 56 78', autocomplete: 'tel', value: Studio.formatPhone(value || '') });
    i.addEventListener('focus', () => { if (!i.value.trim()) { i.value = '+7 '; setTimeout(() => { try { i.setSelectionRange(3, 3); } catch (e) { /* ок */ } }, 0); } });
    i.addEventListener('input', () => { const v = i.value; i.value = (v.trim() === '+' || v.trim() === '') ? v : Studio.formatPhone(v); });
    i.addEventListener('blur', () => { if (i.value.replace(/\D/g, '') === '7' && /^\+7\s*$/.test(i.value)) i.value = ''; });
    return i;
  }
  const phoneValue = (i) => (/^\+7\s*$/.test(i.value) ? '' : i.value.trim());
  const num = (s) => { const n = Number(String(s).replace(/[\s ]/g, '').replace(',', '.')); return isFinite(n) ? n : NaN; };
  /* суммы: разделитель разрядов (15 000), дробная часть сохраняется */
  const groupDigits = (s) => {
    const t = String(s).replace(/[^\d.,]/g, '').replace(',', '.'); const [a, ...r] = t.split('.'); const frac = r.join('').slice(0, 2);
    const g = a.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
    return t.includes('.') ? g + ',' + frac : g;
  };
  const moneyInput = (value) => {
    const i = input({ type: 'text', inputmode: 'decimal', placeholder: '15 000', autocomplete: 'off' });
    const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    Object.defineProperty(i, 'value', { get() { return proto.get.call(i); }, set(v) { proto.set.call(i, v == null || v === '' ? '' : groupDigits(v)); }, configurable: true });
    i.addEventListener('input', () => {
      const cur = proto.get.call(i); const pos = i.selectionStart == null ? cur.length : i.selectionStart;
      const sig = cur.slice(0, pos).replace(/[^\d.,]/g, '').length; const f = groupDigits(cur);
      if (f === cur) return; proto.set.call(i, f);
      let n = 0, p = 0; while (p < f.length && n < sig) { if (/[\d,]/.test(f[p])) n++; p++; }
      try { i.setSelectionRange(p, p); } catch (e) { /* не критично */ }
    });
    i.value = value;
    return i;
  };

  /* ---------- окна ---------- */
  let sheetStack = [];
  function sheet(title, build, opts) {
    opts = opts || {};
    const overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
    const body = h('div', { class: 'sheet-body' });
    const foot = h('div', { class: 'sheet-foot', hidden: true });
    const api = {
      el: overlay, body, foot,
      close() { overlay.remove(); sheetStack = sheetStack.filter((s) => s !== api); if (opts.onclose) opts.onclose(); },
      setFoot(nodes) { clear(foot); nodes.forEach((n) => foot.appendChild(n)); foot.hidden = !nodes.length; },
      error(msg) { let e = body.querySelector('.err'); if (!msg) { if (e) e.remove(); return; } if (!e) { e = h('div', { class: 'err', role: 'alert' }); body.appendChild(e); } e.textContent = msg; e.scrollIntoView({ block: 'nearest' }); }
    };
    const closeBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Закрыть', onclick: () => api.close() }, icon('close'));
    overlay.appendChild(h('div', { class: 'sheet' }, h('div', { class: 'sheet-head' }, h('h2', null, title), closeBtn), body, foot));
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) api.close(); });
    build(api);
    document.body.appendChild(overlay); sheetStack.push(api);
    return api;
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheetStack.length) sheetStack[sheetStack.length - 1].close(); });
  const closeAllSheets = () => sheetStack.slice().forEach((s) => s.close());

  function confirmBox(title, text, okLabel, danger) {
    return new Promise((resolve) => {
      let done = false; const fin = (v) => { if (!done) { done = true; resolve(v); } };
      sheet(title, (s) => {
        s.body.appendChild(h('p', { class: 'soft' }, text));
        s.setFoot([h('button', { class: 'btn' + (danger ? ' danger' : ''), type: 'button', onclick: () => { fin(true); s.close(); } }, okLabel || 'Да'),
          h('button', { class: 'btn soft-btn', type: 'button', onclick: () => s.close() }, 'Отмена')]);
      }, { onclose: () => fin(false) });
    });
  }
  let toastTimer;
  function toast(text) {
    document.querySelectorAll('.toast').forEach((t) => t.remove());
    const t = h('div', { class: 'toast', role: 'status' }, text); document.body.appendChild(t);
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 2600);
  }

  /** Форма в окне: build(api) должен вернуть {save: () => void|Promise} — ошибки показываются в окне. */
  function formSheet(title, saveLabel, build, opts) {
    return sheet(title, (s) => {
      const form = build(s);
      const submit = h('button', { class: 'btn', type: 'button' }, saveLabel || 'Сохранить');
      const run = async () => {
        s.error('');
        try { submit.disabled = true; const r = await form.save(); if (r !== false) s.close(); } catch (e) { s.error(e.message || String(e)); } finally { submit.disabled = false; }
      };
      submit.addEventListener('click', run);
      s.body.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); run(); } });
      s.setFoot([submit].concat(form.extra || []));
    }, opts);
  }

  /* ---------- файлы ---------- */
  function saveFile(name, text, type) {
    const blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: name }); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  function pickFile(accept) {
    return new Promise((resolve) => {
      const i = h('input', { type: 'file', accept, style: { display: 'none' } });
      i.addEventListener('change', () => { const f = i.files[0]; i.remove(); if (!f) return resolve(null); const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => resolve(null); r.readAsText(f); });
      document.body.appendChild(i); i.click();
    });
  }

  /* выбор картинки: уменьшаем до 256×256 (с прозрачностью), результат — data:URL */
  function pickLogo() {
    return new Promise((resolve) => {
      const i = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/*', style: { display: 'none' } });
      i.addEventListener('change', () => {
        const f = i.files[0]; i.remove(); if (!f) return resolve(null);
        const url = URL.createObjectURL(f); const img = new Image();
        img.onload = () => {
          try {
            const side = 256; const c = document.createElement('canvas'); c.width = side; c.height = side; const g = c.getContext('2d');
            const k = Math.min(side / img.width, side / img.height); const w = img.width * k; const hh = img.height * k;
            g.drawImage(img, (side - w) / 2, (side - hh) / 2, w, hh);
            let out = c.toDataURL('image/webp', 0.92); if (!/^data:image\/webp/.test(out)) out = c.toDataURL('image/png');
            URL.revokeObjectURL(url); resolve(out);
          } catch (e) { resolve(null); }
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
        img.src = url;
      });
      document.body.appendChild(i); i.click();
    });
  }
  window.UI = { questionPicker, pickLogo, h, clear, icon, avatar, pill, statusPill, empty, bar, chip, footer, field, input, textarea, select, toggle, stepper, phoneInput, phoneValue, num, moneyInput, sheet, closeAllSheets, confirmBox, toast, formSheet, saveFile, pickFile };
})();
