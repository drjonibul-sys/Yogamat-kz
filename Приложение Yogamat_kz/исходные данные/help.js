(() => {
  'use strict';
  const poses = window.YOGA_ASANAS || [];
  const images = window.YOGA_IMAGES || {};
  const practices = window.YOGA_PRACTICES || [];
  const practiceGroups = [
    {key:'1-2',level:2,kind:'transition',title:'Переход с лёгкого на средний уровень',label:'Лёгкая → средняя'},
    {key:'2-3',level:3,kind:'transition',title:'Переход со среднего на тяжёлый уровень',label:'Средняя → тяжёлая'},
    {key:'1',level:1,kind:'regular',title:'Лёгкая',label:'Лёгкая'},
    {key:'2',level:2,kind:'regular',title:'Средняя',label:'Средняя'},
    {key:'3',level:3,kind:'regular',title:'Тяжёлая',label:'Тяжёлая'}
  ];
  const practiceFilters = ['1','1-2','2','2-3','3'].map(key => practiceGroups.find(group => group.key === key));
  let helpView = 'asanas', practiceGroup = 'all', selectedPractice = null;
  let practiceScroll = 0, practicePoseReturn = null;
  const levels = {1:'Лёгкий', 2:'Средний', 3:'Тяжёлый'};
  const favoriteKey = 'yogaTrackerAsanaFavorites_v1';
  let favorites;
  try { favorites = new Set(JSON.parse(localStorage.getItem(favoriteKey) || '[]')); }
  catch { favorites = new Set(); }
  let level = 'all', onlyFavorites = false, selected = null;
  const page = document.createElement('main');
  page.id = 'page-help'; page.className = 'page';
  page.innerHTML = `
    <div class="section-title"><h2>Справка</h2><span class="level-badge">Хатха-йога</span></div>
    <div id="helpViews" class="help-filters help-views" role="group" aria-label="Раздел справки">
      <button type="button" class="pill active" data-help-view="asanas" aria-pressed="true">Асаны</button>
      <button type="button" class="pill" data-help-view="practices" aria-pressed="false">Практики</button>
    </div>
    <div id="helpCatalog">
      <div class="card help-intro"><h3>От простого к сложному</h3>
        <p>${poses.length} асан и вариантов для знакомства и осознанной практики. Откройте карточку, чтобы посмотреть технику, опорные точки и варианты упрощения.</p></div>
      <p class="help-note">Порядок условный: сложность зависит от подвижности и подготовки. Отдельные карточки не образуют последовательность занятия: примеры комплексов находятся во вкладке «Практики». Дышите свободно; при боли, онемении или головокружении прекратите выполнение. Сложные балансы и перевёрнутые позы осваивают с преподавателем.</p>
      <label for="asanaSearch">Найти асану</label>
      <input id="asanaSearch" type="search" placeholder="Название, транскрипция или хинди…" autocomplete="off">
      <div class="help-filters" aria-label="Уровень сложности">
        <button class="pill active" data-level="all">Все</button>
        <button class="pill" data-level="1">Лёгкий</button>
        <button class="pill" data-level="2">Средний</button>
        <button class="pill" data-level="3">Тяжёлый</button>
        <button class="pill" id="asanaFavorites" aria-pressed="false">☆ Избранное</button>
      </div>
      <div class="help-meta"><span id="asanaCount" role="status"></span><span>По возрастанию сложности</span></div>
      <div id="asanaList"></div>
      <details class="help-sources card"><summary>О названиях, источниках и иллюстрациях</summary>
        <p>Традиционные названия асан происходят из санскрита. Здесь они записаны деванагари, как принято и в хинди, и сопровождаются приближённой русской транскрипцией. «Хинди» — название языка; «индийский» не обозначает отдельный язык.</p>
        <p>Техника обобщена по материалам <a href="https://yoga.ayush.gov.in/" target="_blank" rel="noopener">Ministry of AYUSH</a>, YogaEasy / EkhartYoga, Yoga.org и Yoga Journal. Ссылки на конкретные материалы указаны в карточках. Для открывания внешних ссылок нужен интернет.</p>
        <p>Анатомические иллюстрации созданы для «Йога-практики» и сохранены внутри приложения для работы без интернета. Женская фигура и мягкая подсветка мышц помогают рассмотреть положение тела. Подсветка мышц условная; описанные опоры и упрощения могут отсутствовать на рисунке.</p>
      </details>
      <details class="help-sources card"><summary>Как пользоваться приложением</summary>
        <p><strong>Клиенты → Тарифы → Абонементы.</strong> Добавьте клиента, выберите тариф и оформите продажу. Валюта — казахстанский тенге (₸). Переключатель «оплачено» сохраняет дату оплаты.</p>
        <p><strong>Визиты.</strong> Нажатие на день списывает одно занятие; повторное нажатие возвращает его. Посещение также можно отменить в карточке клиента. Перенос занятия продлевает срок абонемента без списания визита.</p>
        <p><strong>Доход.</strong> Оплаченные абонементы учитываются по дате оплаты. Из суммы вычитается только оплаченная аренда за выбранный месяц аренды. Исправление старого платежа пересчитывает соответствующий месяц и накопительный итог.</p>
        <p><strong>Аренда.</strong> Укажите сумму и месяц начала учёта один раз. Она автоматически подставляется на текущий и шесть следующих месяцев; окно продлевается каждый месяц. Напоминания появляются только за текущий и прошедшие неоплаченные месяцы. В разделе аренды показаны история и общая выплаченная сумма. Суммы уже созданных периодов можно исправлять отдельно.</p>
        <p><strong>Копии.</strong> Шестерёнка в шапке открывает резервное копирование. Раз в неделю при запуске или возвращении в приложение создаётся локальная копия; сохраняются последние 25. Отдельно экспортируйте JSON в «Файлы». Очистка данных сайта может удалить все записи и внутренние копии. Сохраняйте JSON отдельно в «Файлы». Синхронизации между устройствами нет.</p>
        <p><strong>Перенос прежних данных.</strong> Экспортируйте JSON из исходного HTML-приложения и восстановите его здесь через «Файлы». Перед восстановлением создаётся копия текущих данных.</p>
      </details>
    </div>
    <div id="helpPractices" style="display:none">
      <div class="card help-intro"><h3>Примеры проведения практик</h3><p>${practices.length} комплексов: по 3 для каждого уровня и по 3 для переходов между соседними уровнями. Каждый занимает не более 75 минут.</p></div>
      <p class="help-note">Сначала показаны переходные практики, затем основные: лёгкая, средняя и тяжёлая. Время включает обе стороны, входы, выходы и паузы; это не длительность непрерывного удержания асаны.</p>
      <details class="card practice-guidelines"><summary>Как выбирать нагрузку и следить за ощущениями</summary>
        <ul><li>Выберите знакомый уровень. Дышите свободно, без задержек и намеренно форсированных вдохов. Если дыхание сбивается, сократите удержание и отдохните.</li>
        <li>Допустимы умеренная мышечная работа и мягкое вытяжение. При острой или нарастающей боли, онемении, головокружении либо давлении в суставе прекратите элемент и перейдите в удобный отдых.</li>
        <li>Время этапа — общий бюджет: обе стороны, короткие подходы, перестановка опор и отдых. Не заполняйте паузы дополнительными повторами. Если требуется больше времени, пропустите следующий элемент, сохранив заключительный отдых.</li>
        <li>Если вы ведёте группу, заранее покажите опоры и простой вариант, давайте подсказки до входа в позу. В паузах уточняйте, спокойно ли дыхание и нет ли давления в суставах; глубину положения каждый выбирает самостоятельно.</li>
        <li>Переходите к усложнению по устойчивости, свободе дыхания и контролю выхода, а не по числу выполненных занятий. Опора и более простой вариант подходят для любого уровня.</li>
        <li>Баланс на руках и полный мост должны быть уже изучены с преподавателем. Первое освоение не проводят по тексту. При выраженных индивидуальных ограничениях последовательность нужно адаптировать с преподавателем.</li></ul>
      </details>
      <div class="help-filters" role="group" aria-label="Сложность практики">
        <button type="button" class="pill active" data-practice-level="all" aria-pressed="true">Все</button>
        ${practiceFilters.map(group => `<button type="button" class="pill" data-practice-level="${group.key}" aria-pressed="false" aria-label="${group.title}">${group.label}</button>`).join('')}
      </div>
      <p class="help-meta" id="practiceCount" role="status"></p>
      <div id="practiceList"></div>
      <p class="help-note">Примеры последовательностей составлены для приложения на основе техники из справочника. Это ориентиры для планирования занятия; указанное время не является гарантией подходящей лично вам нагрузки. Карточки асан с названиями, иллюстрациями и источниками открываются из каждого этапа.</p>
    </div>
    <article id="asanaDetail" style="display:none"></article>
    <article id="practiceDetail" style="display:none"></article>`;
  document.querySelector('.tabbar').before(page);
  const tab = document.createElement('button');
  tab.className = 'tabbtn'; tab.dataset.tab = 'help';
  tab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 5c-3-2-7-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-2-1-6-1-9 1v15"/></svg><span class="tl">Справка</span>';
  tab.addEventListener('click', () => { showPage('help'); showHelpOverview(); });
  document.querySelector('.tabbar').append(tab);
  const originalShowPage = showPage;
  showPage = function (name) {
    originalShowPage(name);
    document.querySelectorAll('.tabbtn').forEach(b => b.setAttribute('aria-current', b.dataset.tab === name ? 'page' : 'false'));
    if (name === 'help') { renderCatalog(); renderPractices(); }
  };
  function normalize(s) { return String(s || '').toLocaleLowerCase('ru').replace(/ё/g,'е'); }
  function info(pose) { return images[pose.imageKey] || images[pose.id] || {}; }
  function renderArt(pose, kind) {
    const image = info(pose);
    const columns = Number(image.columns) || 1, rows = Number(image.rows) || 1;
    const column = Number(image.column) || 0, row = Number(image.row) || 0;
    const x = columns > 1 ? column / (columns - 1) * 100 : 0;
    const y = rows > 1 ? row / (rows - 1) * 100 : 0;
    const label = pose.russian + ' — анатомическая иллюстрация';
    return `<div class="asana-art-frame ${kind === 'thumbnail' ? 'asana-thumb' : 'asana-art-stage'}"><div class="asana-art" role="img" aria-label="${escapeHtml(label)}" style="--art-url:url('${escapeHtml(image.path || '')}');--art-cols:${columns};--art-rows:${rows};--art-x:${x}%;--art-y:${y}%"></div></div>`;
  }
  function badge(pose) { return `<span class="level-badge level-${pose.level}">${levels[pose.level]}</span>`; }
  function renderCatalog() {
    const query = normalize(document.getElementById('asanaSearch').value).trim();
    const list = poses.filter(p => (level === 'all' || String(p.level) === level) &&
      (!onlyFavorites || favorites.has(p.id)) &&
      normalize([p.russian,p.hindi,p.transcription,p.sanskritLatin,p.summary].join(' ')).includes(query))
      .sort((a,b) => a.level-b.level || a.order-b.order);
    document.getElementById('asanaCount').textContent = `Найдено: ${list.length} из ${poses.length}`;
    const cardHtml = p => `
      <button class="asana-card" data-id="${escapeHtml(p.id)}" aria-label="${escapeHtml(p.russian)}, ${levels[p.level]}">
        ${renderArt(p, 'thumbnail')}
        <div>${badge(p)}<h3>${escapeHtml(p.russian)}</h3>
          <div class="asana-name">${escapeHtml(p.transcription)}</div>
          <div class="asana-hindi" lang="hi">${escapeHtml(p.hindi)}</div>
          <p class="asana-summary">${escapeHtml(p.summary)}</p></div>
      </button>`;
    document.getElementById('asanaList').innerHTML = [1,2,3].map(number => {
      const group = list.filter(p => p.level === number);
      if (!group.length) return '';
      return `<section class="asana-level-group" aria-labelledby="asana-level-${number}"><h3 class="asana-level-heading" id="asana-level-${number}"><span>${levels[number]}</span><span class="level-badge level-${number}">${group.length}</span></h3><div class="asana-grid">${group.map(cardHtml).join('')}</div></section>`;
    }).join('') || '<div class="help-empty card">Асаны не найдены. Попробуйте другое название или измените фильтры.</div>';
    document.querySelectorAll('.asana-card').forEach(b => b.addEventListener('click', () => showPose(b.dataset.id)));
  }
  function section(title, value, ordered = false) {
    if (!value) return '';
    const content = Array.isArray(value) ? `<${ordered?'ol':'ul'}>${value.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</${ordered?'ol':'ul'}>` : `<p>${escapeHtml(value)}</p>`;
    return `<section class="card asana-section"><h3>${title}</h3>${content}</section>`;
  }
  function showPose(id, fromPractice = null) {
    const p = poses.find(x => x.id === id); if (!p) return;
    selected = id;
    document.getElementById('helpPractices').style.display = 'none';
    document.getElementById('practiceDetail').style.display = 'none';
    document.getElementById('helpViews').style.display = 'none';
    const sources = (p.sources || []).map(s => typeof s === 'string' ? {title:s,url:s} : s);
    document.getElementById('helpCatalog').style.display = 'none';
    const detail = document.getElementById('asanaDetail'); detail.style.display = '';
    detail.innerHTML = `
      <button class="btn secondary small" id="helpBack">${fromPractice ? '← К практике' : '← К справочнику'}</button>
      <div class="asana-heading"><div>${badge(p)}<h2 tabindex="-1">${escapeHtml(p.russian)}</h2>
        <div class="asana-hindi" lang="hi">${escapeHtml(p.hindi)}</div>
        <div class="asana-name">${escapeHtml(p.transcription)}</div>
        <div class="asana-transcription">${escapeHtml(p.sanskritLatin)}</div></div>
        <button class="favorite-button" id="asanaFavorite" aria-pressed="${favorites.has(id)}" aria-label="${favorites.has(id)?'Удалить из избранного':'Добавить в избранное'}">${favorites.has(id)?'★':'☆'}</button></div>
      <figure class="asana-hero">${renderArt(p, 'detail')}
        <figcaption>Анатомическая иллюстрация. Подсветка мышц условная.</figcaption></figure>
      ${section('О положении', p.summary)}
      ${section('Как выполнять', p.steps, true)}
      ${section('На что обратить внимание', p.attention)}
      ${section('Упрощение и опоры', p.modifications)}
      ${section('Осторожность', p.caution)}
      ${section('Дыхание и время', p.duration)}
      <section class="card asana-section help-sources"><h3>Подробнее о технике</h3><ul>${sources.map(s=>`<li><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.title || s.url)}</a></li>`).join('')}</ul></section>`;
    document.getElementById('helpBack').addEventListener('click', () => fromPractice ? showPractice(fromPractice, true) : showCatalog());
    document.getElementById('asanaFavorite').addEventListener('click', () => {
      favorites.has(id) ? favorites.delete(id) : favorites.add(id);
      localStorage.setItem(favoriteKey, JSON.stringify([...favorites]));
      const b = document.getElementById('asanaFavorite');
      b.textContent = favorites.has(id)?'★':'☆'; b.setAttribute('aria-pressed', String(favorites.has(id)));
      b.setAttribute('aria-label', favorites.has(id)?'Удалить из избранного':'Добавить в избранное');
    });
    window.scrollTo(0,0);
    detail.querySelector('h2').focus({preventScroll:true});
  }
  function showCatalog() {
    setHelpView('asanas');
    document.getElementById('helpCatalog').style.display = '';
    document.getElementById('asanaDetail').style.display = 'none';
    renderCatalog();
    if (selected) document.querySelector(`[data-id="${selected}"]`)?.focus({preventScroll:true});
    window.scrollTo(0,0);
  }
  function setHelpView(name) {
    helpView = name;
    document.getElementById('helpViews').style.display = '';
    document.getElementById('helpCatalog').style.display = name === 'asanas' ? '' : 'none';
    document.getElementById('helpPractices').style.display = name === 'practices' ? '' : 'none';
    document.getElementById('asanaDetail').style.display = 'none';
    document.getElementById('practiceDetail').style.display = 'none';
    document.querySelectorAll('[data-help-view]').forEach(button => {
      const active = button.dataset.helpView === name;
      button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
    });
  }
  function showHelpOverview() {
    if (helpView === 'practices') showPracticeCatalog();
    else showCatalog();
  }
  function practiceBadge(p) {
    const group = practiceGroups.find(item => item.level === p.level && item.kind === p.kind);
    return `<span class="level-badge level-${p.level}${p.kind === 'transition' ? ' practice-transition' : ''}">${group.label}</span>`;
  }
  function renderPractices() {
    const visibleGroups = practiceGroups.filter(group => practiceGroup === 'all' || group.key === practiceGroup);
    const list = practices.filter(p => visibleGroups.some(group => p.level === group.level && p.kind === group.kind));
    document.getElementById('practiceCount').textContent = `Показано: ${list.length} из ${practices.length} · 45–75 минут`;
    const card = p => {
      const cover = poses.find(pose => pose.id === p.coverPose);
      return `<button type="button" class="practice-card" data-practice-id="${escapeHtml(p.id)}" aria-label="${escapeHtml(p.title)}, ${p.durationMinutes} минут">
        ${cover ? renderArt(cover,'thumbnail') : ''}<div><div class="practice-tags">${practiceBadge(p)}<span class="practice-duration">${p.durationMinutes} мин</span></div>
        <h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.goal)}</p><span class="practice-open">${p.stages.length} этапов · Открыть план →</span></div></button>`;
    };
    document.getElementById('practiceList').innerHTML = visibleGroups.map(group => {
      const plans = list.filter(p => p.level === group.level && p.kind === group.kind);
      if (!plans.length) return '';
      return `<section class="practice-level-group" data-practice-group="${group.key}" aria-labelledby="practice-group-${group.key}"><h3 class="asana-level-heading" id="practice-group-${group.key}">${group.title}<span class="level-badge level-${group.level}${group.kind === 'transition' ? ' practice-transition' : ''}">${plans.length} практики</span></h3>
        <div class="practice-grid">${plans.map(card).join('')}</div></section>`;
    }).join('');
    document.querySelectorAll('[data-practice-id]').forEach(button => button.addEventListener('click', () => showPractice(button.dataset.practiceId)));
  }
  function clock(minute) { return String(minute).padStart(2,'0') + ':00'; }
  function showPractice(id, restore = false) {
    const p = practices.find(item => item.id === id); if (!p) return;
    selectedPractice = id; helpView = 'practices';
    for (const key of ['helpCatalog','helpPractices','asanaDetail','helpViews']) document.getElementById(key).style.display = 'none';
    const detail = document.getElementById('practiceDetail'); detail.style.display = '';
    let elapsed = 0;
    const timeline = p.stages.map((stage,index) => {
      const start = elapsed; elapsed += stage.minutes;
      return `<li class="card practice-stage"><div class="practice-stage-head"><span class="practice-time">${clock(start)}–${clock(elapsed)}</span><span class="level-badge">${stage.minutes} мин</span></div>
        <h3>${index+1}. ${escapeHtml(stage.title)}</h3>
        <p>${escapeHtml(stage.action)}</p>
        <dl><dt>Техника</dt><dd>${escapeHtml(stage.technique)}</dd><dt>Ощущения и внимание</dt><dd>${escapeHtml(stage.sensations)}</dd><dt>Как упростить</dt><dd>${escapeHtml(stage.adaptation)}</dd></dl>
        <div class="practice-pose-links" aria-label="Карточки асан этапа">${stage.poses.map(poseId => {
          const pose = poses.find(item => item.id === poseId);
          return pose ? `<button type="button" class="btn secondary small practice-pose" data-practice-pose="${escapeHtml(pose.id)}">${escapeHtml(pose.russian)} ↗</button>` : '';
        }).join('')}</div></li>`;
    }).join('');
    detail.innerHTML = `<button type="button" class="btn secondary small" id="practiceBack">← К практикам</button>
      <div class="asana-heading"><div><div class="practice-tags">${practiceBadge(p)}</div><h2 tabindex="-1">${escapeHtml(p.title)}</h2><p class="practice-detail-meta">${p.durationMinutes} минут · ${p.stages.length} этапов</p></div></div>
      <section class="card asana-section"><h3>Задача практики</h3><p>${escapeHtml(p.goal)}</p><dl class="practice-facts"><dt>Кому подойдёт</dt><dd>${escapeHtml(p.suitable)}</dd><dt>Что подготовить</dt><dd>${escapeHtml(p.equipment)}</dd></dl></section>
      ${section('Основные аспекты',p.focus)}
      ${p.readiness ? section('Когда переходить к следующему шагу',p.readiness) : ''}
      <p class="help-note">Время каждого этапа включает обе стороны, входы, выходы и отдых. В силовых позах соблюдайте короткие подходы из описания. При острой боли, онемении или головокружении прекратите элемент. При сбившемся дыхании уменьшите нагрузку. Сохраните время на заключительный отдых.</p>
      <h3 class="practice-plan-title">План занятия</h3><ol class="practice-timeline">${timeline}</ol>
      <div class="card practice-finish"><strong>Итого: ${p.durationMinutes} минут</strong><p>Завершите занятие отдыхом; не добавляйте новые сложные попытки после заключительного этапа.</p><button type="button" class="btn secondary small" id="practiceBackBottom">К списку практик</button></div>`;
    document.getElementById('practiceBack').addEventListener('click',showPracticeCatalog);
    document.getElementById('practiceBackBottom').addEventListener('click',showPracticeCatalog);
    document.querySelectorAll('[data-practice-pose]').forEach(button => button.addEventListener('click', () => {
      practiceScroll = window.scrollY || 0; practicePoseReturn = button.dataset.practicePose;
      showPose(button.dataset.practicePose,p.id);
    }));
    if (restore) {
      document.querySelector(`[data-practice-pose="${practicePoseReturn}"]`)?.focus({preventScroll:true});
      window.scrollTo(0,practiceScroll);
    } else {
      window.scrollTo(0,0);detail.querySelector('h2').focus({preventScroll:true});
    }
  }
  function showPracticeCatalog() {
    setHelpView('practices');renderPractices();
    if (selectedPractice) document.querySelector(`[data-practice-id="${selectedPractice}"]`)?.focus({preventScroll:true});
    window.scrollTo(0,0);
  }
  document.querySelectorAll('[data-help-view]').forEach(button => button.addEventListener('click', () => {
    button.dataset.helpView === 'practices' ? showPracticeCatalog() : showCatalog();
  }));
  document.querySelectorAll('[data-practice-level]').forEach(button => button.addEventListener('click', () => {
    practiceGroup = button.dataset.practiceLevel;
    document.querySelectorAll('[data-practice-level]').forEach(item => {
      const active = item === button;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active));
    });
    renderPractices();
  }));
  document.getElementById('asanaSearch').addEventListener('input', renderCatalog);
  document.querySelectorAll('[data-level]').forEach(b => b.addEventListener('click', () => {
    level = b.dataset.level;
    document.querySelectorAll('[data-level]').forEach(x => x.classList.toggle('active', x === b));
    renderCatalog();
  }));
  document.getElementById('asanaFavorites').addEventListener('click', e => {
    onlyFavorites = !onlyFavorites;
    e.currentTarget.classList.toggle('active', onlyFavorites);
    e.currentTarget.setAttribute('aria-pressed', String(onlyFavorites)); renderCatalog();
  });
  renderCatalog();
  renderPractices();
})();
