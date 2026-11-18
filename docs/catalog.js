/* Йога-студия yoga_matkz — справочник асан и комплексы для занятий */
(function () {
  'use strict';
  const { RU } = Studio;
  const { h, clear, icon, pill, empty, chip, input, bar } = UI;
  const App = window.App; const store = App.store; const { page, section, listRow } = App;

  const cache = {}; const pending = {};
  function load(name) {
    if (cache[name]) return Promise.resolve(cache[name]);
    if (!pending[name]) pending[name] = fetch('data/' + name + '.json').then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then((d) => { cache[name] = d; return d; });
    return pending[name];
  }
  function withData(names, build, title, back) {
    if (names.every((n) => cache[n])) return build(...names.map((n) => cache[n]));
    const holder = h('div', { class: 'page' }, h('div', { class: 'head' }, back ? h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Назад', onclick: () => App.go(back) }, icon('back')) : null, h('h1', null, title)), h('div', { class: 'card soft' }, 'Загрузка справочника…'));
    Promise.all(names.map(load)).then(() => App.rerender(), () => { clear(holder); holder.append(page(title, { back }, empty('alert', 'Справочник недоступен', 'Нужен интернет при первом открытии. После этого он работает без сети.'))); });
    return holder;
  }
  const levelTitle = (l) => (l === 1 ? 'Лёгкий' : l === 2 ? 'Средний' : 'Тяжёлый');
  const thumb = (a, big) => h('div', { class: big ? 'hero-img' : 'thumb', role: 'img', 'aria-label': a.russian, style: { backgroundImage: 'url(images/' + (big ? 'a' : 't') + '/' + a.imageKey + '.webp)', backgroundSize: 'cover' } });
  const star = (a) => { const on = store.state.favoriteAsanas.includes(a.id); const b = h('button', { class: 'icon-btn', type: 'button', 'aria-label': on ? 'Убрать из избранного' : 'В избранное', onclick: (e) => { e.stopPropagation(); store.toggleFavoriteAsana(a.id); } }, icon('star')); if (on) { b.style.background = 'var(--sage)'; b.style.color = 'var(--on-sage)'; } return b; };

  /* ---------- Справочник ---------- */
  const state = { q: '', filter: 'all' };
  function catalog() {
    return withData(['asanas'], (asanas) => {
      const list = h('div'); const chips = h('div', { class: 'seg' });
      const count = (l) => asanas.filter((a) => a.level === l).length;
      const draw = () => {
        clear(list); const q = state.q.toLowerCase();
        const items = asanas.filter((a) => (state.filter === 'all' || (state.filter === 'fav' ? store.state.favoriteAsanas.includes(a.id) : a.level === +state.filter))
          && (!q || [a.russian, a.hindi, a.transcription, a.sanskritLatin].join(' ').toLowerCase().includes(q))).sort((a, b) => a.order - b.order);
        if (!items.length) return list.appendChild(empty(state.filter === 'fav' ? 'star' : 'search', state.filter === 'fav' ? 'В избранном пусто' : 'Ничего не нашли', state.filter === 'fav' ? 'Нажмите звёздочку в карточке асаны.' : 'Попробуйте другое название.'));
        list.appendChild(h('div', { class: 'card flat' }, items.map((a) => listRow([thumb(a), h('div', { class: 'grow' }, h('div', { class: 'trunc', style: { fontWeight: 600 } }, a.russian), h('div', { class: 'soft small trunc' }, a.transcription + ' · ' + a.sanskritLatin)), pill(levelTitle(a.level), a.level === 1 ? '' : a.level === 2 ? 'sand' : 'warn')], () => App.go('/asana/' + a.id)))));
      };
      const drawChips = () => { clear(chips); [['all', 'Все ' + asanas.length], ['1', 'Лёгкий ' + count(1)], ['2', 'Средний ' + count(2)], ['3', 'Тяжёлый ' + count(3)], ['fav', 'Избранное ' + store.state.favoriteAsanas.length]].forEach(([k, l]) => chips.appendChild(chip(l, state.filter === k, () => { state.filter = k; drawChips(); draw(); }))); };
      drawChips(); draw();
      return page('Справочник асан', { back: '/overview' }, h('div', { class: 'search' }, icon('search'), input({ placeholder: 'Поиск по названию…', 'aria-label': 'Поиск', value: state.q, oninput: (e) => { state.q = e.target.value.trim(); draw(); } })), chips, list);
    }, 'Справочник асан', '/overview');
  }

  function asanaPage(id) {
    return withData(['asanas', 'images'], (asanas, images) => {
      const a = asanas.find((x) => x.id === id);
      if (!a) return page('Асана', { back: '/catalog' }, empty('search', 'Асана не найдена', ''));
      const img = images[a.imageKey] || {}; const ul = (items, cls) => h(cls === 'ol' ? 'ol' : 'ul', { class: cls === 'ol' ? 'steps' : 'bullets' }, items.map((t) => h('li', null, t)));
      return page(a.russian, { back: '/catalog', right: star(a) }, thumb(a, true),
        h('div', { class: 'card' }, h('div', { class: 'row wrap' }, pill(levelTitle(a.level)), pill(a.duration, 'sand')), h('div', { class: 'h3' }, a.hindi + ' · ' + a.sanskritLatin), h('div', { class: 'soft' }, a.transcription), h('div', null, a.summary)),
        section('Техника'), h('div', { class: 'card' }, ul(a.steps, 'ol')),
        section('Важно'), h('div', { class: 'card' }, ul(a.attention)),
        section('Упрощения'), h('div', { class: 'card' }, h('div', null, a.modifications)),
        section('Ограничения'), h('div', { class: 'card warn' }, h('div', null, a.caution)),
        section('Источники'), h('div', { class: 'card' }, a.sources.map((s) => h('a', { class: 'link', href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.title)), h('div', { class: 'hint' }, (img.author || '') + (img.description ? ' · ' + img.description : ''))),
        h('div', { class: 'hint' }, 'Справочник носит информационный характер и не заменяет консультацию врача или тренера.'));
    }, 'Асана', '/catalog');
  }

  /* ---------- Практики ---------- */
  const GROUPS = [['easy', 'Лёгкая'], ['easyToMedium', 'Лёгкая → средняя'], ['medium', 'Средняя'], ['mediumToHard', 'Средняя → тяжёлая'], ['hard', 'Тяжёлая']];
  const groupOf = (p) => (p.kind === 'transition' ? (p.level >= 3 ? 'mediumToHard' : 'easyToMedium') : p.level === 1 ? 'easy' : p.level === 2 ? 'medium' : 'hard');
  const groupKind = (g) => (g === 'easy' ? '' : g === 'hard' ? 'warn' : g === 'medium' || g === 'easyToMedium' ? 'warn' : 'sand');
  function practices() {
    return withData(['practices'], (all) => {
      const fil = state.pf || 'all'; const list = h('div', { class: 'stack' }); const chips = h('div', { class: 'seg' });
      const draw = () => {
        clear(list); const items = all.filter((p) => fil === 'all' || groupOf(p) === state.pf);
        const mins = all.map((p) => p.durationMinutes);
        GROUPS.forEach(([g, t]) => { const part = items.filter((p) => groupOf(p) === g); if (!part.length) return;
          list.appendChild(section(t)); list.appendChild(h('div', { class: 'card flat' }, part.map((p) => listRow([h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 } }, p.title), h('div', { class: 'soft small' }, p.goal)), pill(p.durationMinutes + ' мин', groupKind(g))], () => App.go('/practice/' + p.id))))); });
        list.prepend(h('div', { class: 'soft small' }, all.length + ' практик · ' + Math.min.apply(null, mins) + '–' + Math.max.apply(null, mins) + ' мин'));
      };
      const drawChips = () => { clear(chips); [['all', 'Все']].concat(GROUPS).forEach(([k, l]) => chips.appendChild(chip(l, (state.pf || 'all') === k, () => { state.pf = k; drawChips(); draw(); }))); };
      state.pf = state.pf || 'all'; drawChips(); draw();
      return page('Комплексы для занятий', { back: '/overview' }, chips, list);
    }, 'Комплексы для занятий', '/overview');
  }
  function practicePage(id) {
    return withData(['practices', 'asanas'], (all, asanas) => {
      const p = all.find((x) => x.id === id);
      if (!p) return page('Практика', { back: '/practices' }, empty('search', 'Практика не найдена', ''));
      const byId = {}; asanas.forEach((a) => { byId[a.id] = a; });
      const info = (t, v) => (v ? h('div', null, h('div', { class: 'soft small', style: { fontWeight: 600 } }, t), h('div', null, v)) : null);
      return page(p.title, { back: '/practices' }, h('div', { class: 'card' }, h('div', { class: 'row wrap' }, pill(GROUPS.find((g) => g[0] === groupOf(p))[1], groupKind(groupOf(p))), pill(p.durationMinutes + ' мин', 'sand')),
        info('Задача', p.goal), info('Подходит', p.suitable), info('Готовность к переходу', p.readiness), info('Оборудование', p.equipment)),
        section('Ориентиры'), h('div', { class: 'card' }, h('ul', { class: 'bullets' }, p.focus.map((f) => h('li', null, f)))),
        section('План занятия'),
        p.stages.map((st, i) => h('div', { class: 'card' }, h('div', { class: 'row between' }, h('div', { class: 'h3' }, (i + 1) + '. ' + st.title), pill(st.minutes + ' мин')),
          h('div', { class: 'row wrap', style: { gap: '8px' } }, st.poses.map((pid) => { const a = byId[pid]; return a ? h('button', { class: 'chip', type: 'button', onclick: () => App.go('/asana/' + a.id) }, a.russian) : null; })),
          info(null, st.action), info('Техника', st.technique), info('Ощущения', st.sensations), info('Если сложно', st.adaptation))),
        h('div', { class: 'hint' }, 'При боли, головокружении или дискомфорте остановитесь. Практика не заменяет консультацию врача.'));
    }, 'Практика', '/practices');
  }

  App.routes['/catalog'] = { tab: 'overview', build: catalog };
  App.routes['/asana'] = { tab: 'overview', build: asanaPage };
  App.routes['/practices'] = { tab: 'overview', build: practices };
  App.routes['/practice'] = { tab: 'overview', build: practicePage };
})();
