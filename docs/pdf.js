/* Йога-студия yoga_matkz — выгрузка таблиц CSV в PDF (A4, книжная ориентация) */
(function () {
  'use strict';
  const { h, sheet, toast, icon } = UI;
  const loading = {};
  function script(src) {
    if (!loading[src]) loading[src] = new Promise((ok, bad) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => { delete loading[src]; bad(new Error('Не удалось загрузить ' + src)); }; document.head.appendChild(s); });
    return loading[src];
  }
  const fonts = {};
  async function fontB64(name) {
    if (fonts[name]) return fonts[name];
    const r = await fetch('vendor/' + name); if (!r.ok) throw new Error('Не удалось загрузить шрифт');
    const bytes = new Uint8Array(await r.arrayBuffer()); let bin = ''; for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return (fonts[name] = btoa(bin));
  }

  /** Разбор CSV с разделителем «;», кавычками и BOM. Убирает защитный апостроф перед «=+-@». */
  function parseCSV(text) {
    text = String(text).replace(/^﻿/, ''); const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === ';') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.map((r) => r.map((v) => v.replace(/^'(?=[=+\-@])/, '')));
  }

  async function build(title, csv, subtitle) {
    await script('vendor/jspdf.umd.min.js'); await script('vendor/jspdf.plugin.autotable.min.js');
    const rows = parseCSV(csv).filter((r) => r.some((v) => v !== '')); if (!rows.length) throw new Error('Нет данных для выгрузки');
    const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    doc.addFileToVFS('DejaVuSans.ttf', await fontB64('font-regular.ttf')); doc.addFont('DejaVuSans.ttf', 'DejaVu', 'normal');
    doc.addFileToVFS('DejaVuSans-Bold.ttf', await fontB64('font-bold.ttf')); doc.addFont('DejaVuSans-Bold.ttf', 'DejaVu', 'bold');
    let head = rows[0]; let body = rows.slice(1);
    const keep = head.map((_, i) => !body.length || body.some((r) => String(r[i] || '').trim() !== '')); // пустые колонки не печатаем
    head = head.filter((_, i) => keep[i]); body = body.map((r) => r.filter((_, i) => keep[i]).map((v) => (/^[+\d][\d\s.+()-]*$/.test(v) ? v.replace(/\s/g, '\u00a0') : v))); // телефоны и числа не переносим
    const cols = head.length; const fs = cols > 9 ? 6.5 : cols > 6 ? 7.5 : 9; const M = 12;
    doc.setFont('DejaVu', 'bold'); doc.setFontSize(15); doc.setTextColor(31, 42, 34); doc.text(title, M, 16);
    doc.setFont('DejaVu', 'normal'); doc.setFontSize(8.5); doc.setTextColor(110, 124, 111);
    doc.text(subtitle || '', M, 21.5);
    // ширины колонок считаем сами: слова не рвутся, лишнее место делится пропорционально тексту
    const cw = fs * 0.24; const avail = 210 - 2 * M; const columnStyles = {};
    const need = [], pref = [];
    head.forEach((hd, i) => {
      const cells = body.map((r) => String(r[i] || '')); const word = Math.max.apply(null, [hd].concat(cells).map((t) => Math.max.apply(null, t.split(/\s+/).map((w) => w.length).concat([1]))));
      const full = Math.max.apply(null, cells.map((t) => t.length).concat([1])); const numeric = cells.some((t) => t) && cells.every((t) => !t || /^[+\d][\d\s\u00a0.+()-]*$/.test(t)); need.push(Math.max(Math.min(word, 22), numeric ? Math.min(full, 22) : 0) * cw * 1.06 + 3); pref.push(Math.max(need[i], Math.min(full, 30) * cw + 3));
    });
    const sumNeed = need.reduce((x, y) => x + y, 0), sumPref = pref.reduce((x, y) => x + y, 0);
    head.forEach((_, i) => {
      let w;
      if (sumPref <= avail) w = pref[i] + (avail - sumPref) * (pref[i] / sumPref);
      else if (sumNeed >= avail) w = need[i] * (avail / sumNeed);
      else w = need[i] + (avail - sumNeed) * ((pref[i] - need[i]) / (sumPref - sumNeed || 1));
      columnStyles[i] = { cellWidth: w };
    });
    doc.autoTable({ columnStyles,
      head: [head], body: body.length ? body : [['Нет записей'].concat(Array(cols - 1).fill(''))], startY: 26, margin: { left: M, right: M, top: 14, bottom: 16 },
      styles: { font: 'DejaVu', fontSize: fs, cellPadding: 1.3, textColor: [31, 42, 34], lineColor: [228, 233, 223], lineWidth: 0.1, overflow: 'linebreak', valign: 'middle' },
      headStyles: { fillColor: [92, 122, 88], textColor: 255, fontStyle: 'bold' }, alternateRowStyles: { fillColor: [243, 246, 239] }, theme: 'grid', rowPageBreak: 'avoid'
    });
    const n = doc.getNumberOfPages(); const W = doc.internal.pageSize.getWidth(); const Hh = doc.internal.pageSize.getHeight();
    for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFont('DejaVu', 'normal'); doc.setFontSize(7.5); doc.setTextColor(110, 124, 111);
      doc.text('Версия ' + Studio.APP_VERSION + ' · Разработано yoga_matkz', M, Hh - 8); doc.text('Стр. ' + i + ' из ' + n, W - M, Hh - 8, { align: 'right' }); }
    return { blob: doc.output('blob'), pages: n };
  }

  async function exportPDF(title, csv, filename, subtitle) {
    toast('Готовим PDF…');
    let res; try { res = await build(title, csv, subtitle || (App.store.state.studioName + ' · ' + Studio.RU.shortDate(App.today()))); } catch (e) { toast(e.message || 'Не удалось создать PDF'); return; }
    const file = new File([res.blob], filename, { type: 'application/pdf' }); const url = URL.createObjectURL(res.blob);
    sheet('PDF готов', (s) => {
      s.body.appendChild(h('div', { class: 'card' }, h('div', { class: 'h3' }, title), h('div', { class: 'soft small' }, filename + ' · A4 книжный · страниц: ' + res.pages + ' · ' + Math.max(1, Math.round(res.blob.size / 1024)) + ' КБ')));
      const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
      const save = h('button', { class: 'btn', type: 'button', onclick: async () => {
        if (canShare) { try { await navigator.share({ files: [file], title }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
        const a = h('a', { href: url, download: filename }); document.body.appendChild(a); a.click(); a.remove();
      } }, icon('download'), canShare ? 'Сохранить или отправить' : 'Скачать PDF');
      const open = h('a', { class: 'btn soft-btn', href: url, target: '_blank', rel: 'noopener', style: { textDecoration: 'none' } }, 'Открыть для просмотра');
      s.body.append(save, open, h('div', { class: 'hint' }, 'На iPhone и iPad выберите «Сохранить в Файлы» или отправьте файл в мессенджер.'));
    }, { onclose: () => setTimeout(() => URL.revokeObjectURL(url), 60000) });
  }
  window.Pdf = { exportPDF, parseCSV, build };
})();
