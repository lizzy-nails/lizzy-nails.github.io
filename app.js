/* Liza Nails: booking form talking to the bookings service on b.net
   (exposed through Tailscale Funnel). ?api=http://localhost:18081 overrides it for testing. */
(function () {
  'use strict';

  const API = new URLSearchParams(location.search).get('api') || 'https://berry-k3s.tail4064e5.ts.net:10000';

  /* lengths[].nails — длина для превью и для сервиса записи (short | medium | long);
     api — id услуги для сервиса, если он не знает её под своим id;
     min — сколько минут держать в календаре (верхняя граница time): окна, куда услуга не влезает, не показываются */
  // col — столбик в «Что делаем»: 1 слева (без покрытия), 2 справа (с покрытием)
  const SERVICES = [
    { id: 'manicure', col: 1,     cat: 'Маникюр', name: 'Маникюр (без покрытия)', time: '50 мин', min: 50, design: false, lengths: [{ price: 1500 }] },
    { id: 'japanese', col: 1,     cat: 'Маникюр', name: 'Японский маникюр', time: '50 мин', min: 50, api: 'manicure', design: false, lengths: [{ price: 1600 }] },
    { id: 'removal', col: 1,      cat: 'Маникюр', name: 'Снятие покрытия', time: '30 мин', min: 30, api: 'manicure', design: false, lengths: [{ price: 500 }] },
    { id: 'manicure_gel', col: 2, cat: 'Маникюр + покрытие', name: 'Маникюр + покрытие', time: '1 ч 30 мин – 2 ч', min: 120, incl: 'снятие включено', design: true, lengths: [
      { name: '1–2', price: 1700, nails: 'short' }, { name: '3–4', price: 1800, nails: 'medium' },
    ] },
    { id: 'extension',    col: 2, cat: 'Наращивание', name: 'Наращивание', time: '2 ч 30 мин – 3 ч 30 мин', min: 210, incl: 'снятие включено', design: true, lengths: [
      { name: '1–2', price: 1800, nails: 'short' }, { name: '3', price: 1900, nails: 'medium' }, { name: '4', price: 2000, nails: 'medium' },
      { name: '5', price: 2100, nails: 'long' }, { name: '6', price: 2200, nails: 'long' },
    ] },
  ];
  /* Портфолио: фото лежат в works/NN.jpg (до 640 px по высоте). [имя, ширина, высота];
     если список пуст, коллаж собирается из нарисованных превью. */
  const WORKS = [
    ['01', 480, 640],
    ['02', 871, 640],
    ['03', 853, 640],
    ['04', 480, 640],
    ['05', 854, 640],
    ['06', 480, 640],
    ['07', 480, 640],
    ['08', 480, 640],
    ['09', 480, 640],
    ['10', 960, 634],
    ['11', 480, 640],
    ['12', 480, 640],
    ['13', 480, 640],
    ['14', 960, 617],
    ['15', 853, 640],
    ['16', 480, 640],
    ['17', 853, 640],
    ['18', 480, 640],
    ['19', 480, 640],
    ['20', 480, 640],
    ['21', 581, 640],
    ['22', 756, 640],
    ['23', 480, 640],
    ['24', 480, 640],
  ];
  const LEVELS = [
    { id: '',       name: 'Без дизайна', price: 0,   text: 'Однотонное покрытие без рисунка.' },
    { id: 'light',  name: 'Лёгкий',      full: 'Простой дизайн', price: 200, min: 15, text: 'Френч, слайдеры, полоски, точки, сердечки и т. д.' },
    { id: 'medium', name: 'Средний',     full: 'Дизайн средней сложности', price: 400, min: 30, text: 'Дизайн средней сложности.' },
    { id: 'crazy',  name: 'Крейзи',      full: 'Дизайн крейзи', price: 600, min: 40, text: 'Дизайн по мудборду.' },
  ];
  const ADDONS = [
    { id: 'repair',  name: 'Ремонт ногтя',    price: 200, min: 20, design: true }, // design — только к услугам с покрытием
  ];
  // запасной список, пока не ответил сервис: актуальные цвета Лиза ведёт на nails.b.net (/api/colors)
  let COLORS = [
    ['#ff2e88', 'горячий розовый'], ['#ffc2d9', 'пудровый'], ['#e9c3b0', 'нюд'], ['#fff4ec', 'молочный'],
    ['#d4142f', 'красный'], ['#141014', 'чёрный'], ['#c9a7ff', 'лаванда'], ['#d7ff3a', 'кислотный лайм'],
  ];
  // радужный порядок по семействам: розовый → красный → оранжевый → жёлтый → зелёный → голубой → синий → фиолетовый,
  // внутри семейства от светлого к тёмному; приглушённые (белый, нюд, «кошки», серый, чёрный) — в конце, тоже от светлого
  function rainbow(list) {
    const FAMILY = [300, 345, 10, 45, 70, 165, 200, 240]; // начала семейств по оттенку
    const key = ([hex]) => {
      const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
      const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b);
      const light = 0.299 * r + 0.587 * g + 0.114 * b;
      if (d < 0.25 && d <= 0.45 * mx) return [FAMILY.length, -light];
      let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h = (h * 60 + 360) % 360;
      const f = FAMILY.findIndex((s, i) => (h - s + 360) % 360 < (FAMILY[(i + 1) % FAMILY.length] - s + 360) % 360);
      return [f, -light];
    };
    return list.map(c => [c, key(c)]).sort((a, b) => a[1][0] - b[1][0] || a[1][1] - b[1][1]).map(([c]) => c);
  }
  COLORS = rainbow(COLORS);
  /* базы есть всегда, независимо от списка на b.net: на сайте — квадратиками перед лаками.
     [hex, название, подпись, цвет для превью]; hex как у этих баз на b.net, одноимённые цвета оттуда не дублируем */
  const BASES = [
    ['#fffafa', 'прозрачный', 'база, есть всегда', '#f6e4dd'],
    ['#ffffff', 'молочный', 'база, есть всегда', '#fff6f0'],
    ['#f9d8c9', 'нюд', 'база, есть всегда', '#f9d8c9'],
  ];
  const notBase = ([hex, name]) => !BASES.some(([h, n]) => h === hex.toLowerCase() || n === String(name).trim().toLowerCase());
  COLORS = COLORS.filter(notBase);
  const LATER = 'Выберу на месте';
  const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const ERRORS = {
    SLOT_TAKEN: 'Это окно только что заняли — выбери другое.',
    BAD_PHONE: 'Проверь телефон — нужно 10–15 цифр.',
    TOO_MANY_BOOKINGS: 'На этот номер уже есть несколько записей. Напиши Лизе, если нужно ещё.',
    SLOW_DOWN: 'Слишком много заявок подряд, попробуй через час.',
    PHOTO_TOO_BIG: 'Одно из фото слишком большое.',
    BAD_PHOTO: 'Не получилось прочитать фото — попробуй другое (jpg, png).',
  };

  const $ = id => document.getElementById(id);
  const fmt = n => n.toLocaleString('ru-RU') + ' ₽';
  const st = {
    month: '', months: [], free: {}, today: '',
    date: '', time: '', service: 'manicure_gel', length: 0, design: 'light', color: COLORS[0][0], addons: [],
    seed: 7, photos: [], // { blob, url }
  };

  /* ── slots ─────────────────────────────────────────── */
  let loads = 0; // ответ на устаревший запрос (сменили месяц или услугу) не применяем
  async function loadMonth(m) {
    const n = ++loads;
    $('cal-msg').textContent = 'Загружаю свободные окна…';
    $('cal-msg').hidden = false;
    try {
      const r = await fetch(API + '/api/slots?minutes=' + need() + (m ? '&month=' + m : ''));
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      if (n !== loads) return;
      st.month = d.month; st.today = d.today; st.free = d.free || {};
      if (!st.months.length) st.months = [d.month, shiftMonth(d.month, 1)];
      $('cal-msg').hidden = Object.keys(st.free).length > 0;
      $('cal-msg').textContent = 'В этом месяце свободных окон нет — загляни в следующий.';
    } catch (e) {
      if (n !== loads) return;
      st.free = {};
      if (!st.month) { const n = new Date(); st.month = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; st.months = [st.month, shiftMonth(st.month, 1)]; }
      $('cal-msg').textContent = 'Онлайн-запись сейчас недоступна. Попробуй чуть позже 🙏';
    }
    if (st.date && !(st.free[st.date] || []).includes(st.time)) {
      if (st.time && st.date.startsWith(st.month)) {
        $('cal-msg').textContent = 'Выбранная услуга не помещается в это окно — выбери другое время.';
        $('cal-msg').hidden = false;
      }
      st.time = '';
    }
    renderCal();
  }

  function shiftMonth(m, n) {
    const [y, mo] = m.split('-').map(Number);
    const d = new Date(y, mo - 1 + n, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function renderCal() {
    const [y, m] = st.month.split('-').map(Number);
    $('month-name').textContent = `${MONTHS[m - 1]} ${y}`;
    $('prev').disabled = st.month === st.months[0];
    $('next').disabled = st.month === st.months[st.months.length - 1];
    const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;
    const days = new Date(y, m, 0).getDate();
    let html = '<span></span>'.repeat(lead);
    for (let d = 1; d <= days; d++) {
      const date = `${st.month}-${String(d).padStart(2, '0')}`;
      const n = (st.free[date] || []).length;
      const cls = [n ? 'has' : 'none', date === st.date ? 'sel' : '', date === st.today ? 'today' : ''].join(' ');
      html += `<button type="button" class="${cls}" data-date="${date}" ${n ? '' : 'disabled'}>${d}${n ? `<i>${n}</i>` : ''}</button>`;
    }
    $('cal').innerHTML = html;
    const times = st.date && st.date.startsWith(st.month) ? (st.free[st.date] || []) : [];
    $('times').innerHTML = times.length
      ? times.map(t => `<button type="button" class="pill${t === st.time ? ' on' : ''}" data-time="${t}">${t}</button>`).join('')
      : (st.date ? '' : '<p class="times__hint">Розовые дни — есть окна. Цифра — сколько.</p>');
    summary();
  }

  $('cal').addEventListener('click', e => {
    const b = e.target.closest('button[data-date]');
    if (!b) return;
    st.date = b.dataset.date;
    const t = st.free[st.date] || [];
    st.time = t.length === 1 ? t[0] : (t.includes(st.time) ? st.time : '');
    renderCal();
  });
  $('times').addEventListener('click', e => {
    const b = e.target.closest('[data-time]');
    if (!b) return;
    st.time = b.dataset.time;
    renderCal();
  });
  $('prev').onclick = () => loadMonth(shiftMonth(st.month, -1));
  $('next').onclick = () => loadMonth(shiftMonth(st.month, 1));

  /* ── service, design, colour ───────────────────────── */
  const svc = () => SERVICES.find(s => s.id === st.service);
  const lvl = () => LEVELS.find(l => l.id === (svc().design ? st.design : ''));
  const len = () => svc().lengths[st.length] || svc().lengths[0];
  const adds = () => ADDONS.filter(a => st.addons.includes(a.id) && (!a.design || svc().design));
  const need = () => svc().min + (lvl().min || 0) + adds().reduce((n, a) => n + (a.min || 0), 0); // минут держать в календаре
  const mins = n => n + ' мин';
  const findColor = hex => BASES.find(([c]) => c === hex) || COLORS.find(([c]) => c === hex);
  const colorName = () => { const c = st.color && findColor(st.color); return st.color ? (c && (c[1] || c[2])) || '' : LATER; };
  // подпись под цветами: название + «база» или эффект (у лаков с эффектом — другого цвета)
  const colorLabel = hex => {
    if (!hex) return LATER;
    const c = findColor(hex);
    if (!c) return '';
    const base = BASES.includes(c);
    return [c[1], c[2] && `<span class="swatch-name__${base ? 'base' : 'fx'}">${base ? c[2] : '✦ эффект: ' + c[2]}</span>`].filter(Boolean).join(' · ');
  };
  const from = s => (s.lengths.length > 1 ? 'от ' : '') + fmt(s.lengths[0].price);

  function renderChoices() {
    const pill = s => `<button type="button" class="pill pill--svc${s.id === st.service ? ' on' : ''}" data-svc="${s.id}"><b>${s.name}</b><small>${[from(s), s.time, s.incl].filter(Boolean).join(' · ')}</small></button>`;
    $('services').innerHTML = [1, 2].map(c => `<div class="pills__col">${SERVICES.filter(s => s.col === c).map(pill).join('')}</div>`).join('');
    const ls = svc().lengths;
    $('length-block').hidden = ls.length < 2;
    $('lengths').className = 'levels levels--' + ls.length;
    $('lengths').innerHTML = ls.map((l, i) => `<button type="button" class="level${i === st.length ? ' on' : ''}" data-len="${i}">${l.name}<small>${fmt(l.price)}</small></button>`).join('');
    $('addons').innerHTML = ADDONS.map(a => {
      const off = a.design && !svc().design;
      return `<button type="button" class="level${!off && st.addons.includes(a.id) ? ' on' : ''}" data-add="${a.id}"${off ? ' disabled title="Только к маникюру с покрытием и наращиванию"' : ''}>${a.name}<small>+${fmt(a.price)} · ${mins(a.min)}</small></button>`;
    }).join('');
    $('design-block').classList.toggle('off', !svc().design);
    $('levels-pick').innerHTML = LEVELS.map(l => `<button type="button" class="level${l.id === st.design ? ' on' : ''}${l.id === 'crazy' ? ' level--crazy' : ''}" data-lvl="${l.id}">${l.name}<small>${l.price ? `+${fmt(l.price)} · ${mins(l.min)}` : 'включено'}</small></button>`).join('');
    const sw = (cls, [c, n, fx]) => `<button type="button" class="swatch${cls}${c === st.color ? ' on' : ''}" data-color="${c}" style="--c:${c}" title="${n || fx || ''}" aria-label="${n || fx || 'цвет'}"></button>`;
    $('colors').innerHTML = BASES.map((b, i) => sw(' swatch--base' + (i ? '' : ' swatch--clear'), b)).join('')
      + '<span class="swatches__sep" aria-hidden="true"></span>'
      + COLORS.map(c => sw(c[2] ? ' swatch--fx' : '', c)).join('')
      + `<button type="button" class="swatch swatch--later${st.color ? '' : ' on'}" data-color="" title="${LATER}" aria-label="${LATER}">?</button>`;
    $('color-name').innerHTML = colorLabel(st.color) || '&nbsp;';
    preview();
    summary();
  }

  function preview() {
    const l = lvl();
    Nails.render($('hand'), { design: l.id, length: len().nails || 'short', color: ((st.color && BASES.find(([c]) => c === st.color)) || [])[3] || st.color || '#f3e3dc', seed: st.seed });
    $('preview-tag').textContent = l.id ? l.name.toLowerCase() : (svc().design ? 'без дизайна' : 'без покрытия');
    $('preview-tag').classList.toggle('crazy', l.id === 'crazy');
    $('preview-text').textContent = svc().design ? l.text : 'Без покрытия: кутикула, форма, масло.';
    $('shuffle').hidden = !l.id;
    if (!svc().design) Nails.render($('hand'), { design: '', length: 'short', color: '#f7d6cf', seed: 1 });
  }

  $('services').addEventListener('click', e => {
    const b = e.target.closest('[data-svc]');
    if (!b) return;
    const was = need();
    st.service = b.dataset.svc; if (st.length >= svc().lengths.length) st.length = 0;
    if (!svc().design) st.addons = st.addons.filter(id => !ADDONS.find(a => a.id === id).design);
    renderChoices();
    refit(was);
  });
  const refit = was => { if (need() !== was && st.month) loadMonth(st.month); }; // другая длительность — другие окна
  $('lengths').addEventListener('click', e => {
    const b = e.target.closest('[data-len]');
    if (b) { st.length = +b.dataset.len; renderChoices(); }
  });
  $('addons').addEventListener('click', e => {
    const b = e.target.closest('[data-add]');
    if (!b) return;
    const id = b.dataset.add, was = need();
    st.addons = st.addons.includes(id) ? st.addons.filter(x => x !== id) : [...st.addons, id];
    renderChoices();
    refit(was);
  });
  $('levels-pick').addEventListener('click', e => {
    const b = e.target.closest('[data-lvl]');
    if (b && svc().design) { const was = need(); st.design = b.dataset.lvl; st.seed = Math.floor(Math.random() * 1e6); renderChoices(); refit(was); }
  });
  $('colors').addEventListener('click', e => {
    const b = e.target.closest('[data-color]');
    if (b && svc().design) { st.color = b.dataset.color; renderChoices(); }
  });
  $('colors').addEventListener('mouseover', e => { // на десктопе — название цвета под курсором
    const b = e.target.closest('[data-color]');
    if (b) $('color-name').innerHTML = colorLabel(b.dataset.color) || '&nbsp;';
  });
  $('colors').addEventListener('mouseleave', () => { $('color-name').innerHTML = colorLabel(st.color) || '&nbsp;'; });
  $('shuffle').onclick = () => { st.seed = Math.floor(Math.random() * 1e6); preview(); };

  function summary() {
    const s = svc(), l = lvl(), a = adds();
    const total = len().price + l.price + a.reduce((n, x) => n + x.price, 0);
    let when = 'Выбери окно в календаре';
    if (st.date) {
      const [y, m, d] = st.date.split('-').map(Number);
      when = `${d} ${MONTHS_GEN[m - 1]}, ${WD[new Date(y, m - 1, d).getDay()]}` + (st.time ? ` в ${st.time}` : ' — выбери время');
    }
    const what = [s.name, len().name && 'длина ' + len().name, l.id && 'дизайн «' + l.name.toLowerCase() + '»', s.design && (st.color ? colorName() && 'цвет «' + colorName() + '»' : 'цвет на месте'), ...a.map(x => x.name.toLowerCase())];
    $('summary').innerHTML = `<b>${when}</b><span>${what.filter(Boolean).join(' · ')}</span><strong>${l.id === 'crazy' ? 'от ' : ''}${fmt(total)}</strong>`;
    $('submit').disabled = !(st.date && st.time);
  }

  /* ── reference photos: downscaled in the browser ───── */
  async function shrink(file) {
    const img = await createImageBitmap(file).catch(() => null);
    if (!img) return null;
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    return new Promise(res => cv.toBlob(res, 'image/jpeg', 0.85));
  }

  async function addFiles(list) {
    for (const f of list) {
      if (st.photos.length >= 5) break;
      if (!f.type.startsWith('image/')) continue;
      const blob = await shrink(f);
      if (blob && blob.size < 4 << 20) st.photos.push({ blob, url: URL.createObjectURL(blob) });
    }
    renderThumbs();
  }

  function renderThumbs() {
    $('thumbs').innerHTML = st.photos.map((p, i) => `<div class="thumb"><img src="${p.url}" alt=""><button type="button" data-rm="${i}" aria-label="убрать">×</button></div>`).join('');
    $('drop').classList.toggle('full', st.photos.length >= 5);
  }

  $('files').addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });
  $('thumbs').addEventListener('click', e => {
    const i = e.target.dataset.rm;
    if (i === undefined) return;
    URL.revokeObjectURL(st.photos[i].url);
    st.photos.splice(i, 1);
    renderThumbs();
  });
  ['dragover', 'dragleave', 'drop'].forEach(t => $('drop').addEventListener(t, e => {
    e.preventDefault();
    $('drop').classList.toggle('over', t === 'dragover');
    if (t === 'drop') addFiles(e.dataTransfer.files);
  }));

  /* ── submit ────────────────────────────────────────── */
  $('booker').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, err = $('form-err');
    err.textContent = '';
    if (!st.date || !st.time) { err.textContent = 'Выбери день и время.'; return; }
    if (!f.name.value.trim()) { err.textContent = 'Как тебя зовут?'; f.name.focus(); return; }
    if (f.phone.value.replace(/\D/g, '').length < 10) { err.textContent = ERRORS.BAD_PHONE; f.phone.focus(); return; }

    const fd = new FormData();
    const s = svc(), l = lvl();
    // сервис знает только старые id услуг и short/medium/long — точную услугу, длину и доп. услуги пишем в комментарий
    const extra = [s.api && s.name, len().name && 'длина ' + len().name, s.design && !st.color && 'цвет выберет на месте', ...adds().map(x => x.name.toLowerCase())].filter(Boolean);
    Object.entries({
      date: st.date, time: st.time, minutes: need(), service: s.api || s.id, length: len().nails || 'short', design: l.id, color: s.design ? st.color : '',
      name: f.name.value, phone: f.phone.value, contact: f.contact.value, website: f.website.value,
      comment: (extra.length ? `[${extra.join('; ')}] ` : '') + f.comment.value,
    }).forEach(([k, v]) => fd.append(k, v));
    st.photos.forEach((p, i) => fd.append('photos', p.blob, `ref${i + 1}.jpg`));

    $('submit').disabled = true;
    $('submit').textContent = 'Отправляю…';
    try {
      const r = await fetch(API + '/api/bookings', { method: 'POST', body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        err.textContent = ERRORS[d.detail] || 'Что-то пошло не так. Попробуй ещё раз или напиши Лизе.';
        if (d.detail === 'SLOT_TAKEN') { st.time = ''; loadMonth(st.month); }
        return;
      }
      $('done-text').textContent = $('summary').querySelector('b').textContent + ' — ' + svc().name.toLowerCase() + '.';
      $('booker').classList.add('hidden');
      $('done').classList.remove('hidden');
      $('book').scrollIntoView({ behavior: 'smooth' });
    } catch (x) {
      err.textContent = 'Не удалось связаться с сервером записи. Проверь интернет и попробуй ещё раз.';
    } finally {
      $('submit').textContent = 'Записаться';
      summary();
    }
  });

  $('again').onclick = () => {
    $('booker').reset();
    st.photos.forEach(p => URL.revokeObjectURL(p.url));
    st.photos = []; st.date = ''; st.time = ''; st.addons = [];
    renderThumbs();
    $('done').classList.add('hidden');
    $('booker').classList.remove('hidden');
    loadMonth(st.month);
  };

  /* ── static sections ───────────────────────────────── */
  $('level-cards').innerHTML = LEVELS.filter(l => l.id).map(l => `
    <article class="lcard">
      <svg id="lv-${l.id}" viewBox="0 0 500 330" aria-hidden="true"></svg>
      <h3>${l.name}</h3><p>${l.text}</p><span class="lcard__price">+${fmt(l.price)}</span>
      <button type="button" class="btn btn--sm" data-pick="${l.id}">Выбрать</button>
    </article>`).join('');
  Nails.render($('lv-light'), { design: 'light', length: 'short', color: '#ffc2d9', seed: 11 });
  Nails.render($('lv-medium'), { design: 'medium', length: 'medium', color: '#fff4ec', seed: 5 });
  Nails.render($('lv-crazy'), { design: 'crazy', length: 'long', color: '#ff2e88', seed: 3 });
  Nails.render($('about-hand'), { design: 'medium', length: 'medium', color: '#141014', seed: 42 });
  $('level-cards').addEventListener('click', e => {
    const b = e.target.closest('[data-pick]');
    if (!b) return;
    const was = need();
    if (!svc().design) { st.service = 'manicure_gel'; st.length = 0; }
    st.design = b.dataset.pick;
    renderChoices();
    refit(was);
    $('book').scrollIntoView({ behavior: 'smooth' });
  });

  const row = (name, note, price) => `<div class="pl"><span>${name}${note ? `<small>${note}</small>` : ''}</span><b>${price}</b></div>`;
  $('price-list').innerHTML = [...new Set(SERVICES.map(s => s.cat))].map(c => `<h3>${c}</h3>` + SERVICES.filter(s => s.cat === c).map(s =>
    s.lengths.length > 1
      ? s.lengths.map(l => row('Длина ' + l.name, [s.time, s.incl].filter(Boolean).join(' · '), fmt(l.price))).join('')
      : row(s.name, s.time, fmt(s.lengths[0].price))).join('')).join('');
  $('design-prices').innerHTML = '<h3>Дополнительные услуги</h3>'
    + LEVELS.filter(l => l.id).map(l => row(l.full, l.text + ' · ' + mins(l.min), (l.id === 'crazy' ? 'от ' : '+') + fmt(l.price))).join('')
    + ADDONS.map(a => row(a.name, mins(a.min) + (a.design ? ' · к покрытию и наращиванию' : ''), fmt(a.price))).join('');
  /* ── портфолио: два ряда коллажа едут навстречу ─────── */
  (function works() {
    const designs = ['light', 'medium', 'crazy'], lens = ['short', 'medium', 'long'];
    const tiles = WORKS.length
      ? WORKS.map(([n, w, h], i) => ({ src: `works/${n}.jpg`, w, h, i }))
      : Array.from({ length: 12 }, (_, i) => ({ i }));
    const half = Math.ceil(tiles.length / 2);
    const tile = t => t.src
      ? `<figure class="work work--photo work--${t.i % 3}"><img src="${t.src}" width="${t.w}" height="${t.h}" alt="Работа Лизы" loading="lazy" decoding="async"></figure>`
      : `<figure class="work work--${t.i % 3}"><svg data-w="${t.i}" viewBox="0 0 500 330" aria-hidden="true"></svg></figure>`;
    // каждый ряд повторён дважды, чтобы анимация сдвига на -50% шла без шва
    $('works').innerHTML = [tiles.slice(0, half), tiles.slice(half)].map((row, r) =>
      `<div class="works__row${r ? ' works__row--rev' : ''}"><div class="works__track">${row.map(tile).join('')}${row.map(tile).join('')}</div></div>`).join('');
    if (WORKS.length) {
      // по клику — крупно; закрывается кликом или Esc
      const box = document.createElement('div');
      box.className = 'lightbox hidden';
      box.innerHTML = '<img alt="Работа Лизы">';
      document.body.append(box);
      const close = () => box.classList.add('hidden');
      box.onclick = close;
      document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
      $('works').addEventListener('click', e => {
        const img = e.target.closest('.work img');
        if (!img) return;
        box.firstChild.src = img.src;
        box.classList.remove('hidden');
      });
      return;
    }
    $('works').querySelectorAll('svg[data-w]').forEach(svg => {
      const i = +svg.dataset.w;
      Nails.render(svg, { design: designs[i % 3], length: lens[(i * 2) % 3], color: COLORS[(i * 3) % COLORS.length][0], seed: 100 + i * 17 });
    });
  })();

  $('year').textContent = new Date().getFullYear();

  renderChoices();
  loadMonth('');
  fetch(API + '/api/colors').then(r => r.ok ? r.json() : Promise.reject()).then(list => {
    if (!Array.isArray(list)) return;
    const esc = v => String(v || '').trim().replace(/[&<>"']/g, ch => '&#' + ch.charCodeAt(0) + ';');
    COLORS = rainbow(list.filter(c => /^#[0-9a-f]{6}$/i.test(c.hex))
      .map(c => [c.hex.toLowerCase(), esc(c.name), esc(c.effect)]).filter(notBase));
    if (st.color && !findColor(st.color)) st.color = COLORS.length ? COLORS[0][0] : BASES[0][0];
    renderChoices();
  }).catch(() => {}); // старый сервис без /api/colors — остаётся запасной список
})();
