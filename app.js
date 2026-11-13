/* Liza Nails: booking form talking to the bookings service on b.net
   (exposed through Tailscale Funnel). ?api=http://localhost:18081 overrides it for testing. */
(function () {
  'use strict';

  const API = new URLSearchParams(location.search).get('api') || 'https://berry-k3s.tail4064e5.ts.net:10000';

  /* lengths[].nails — длина для превью и для сервиса записи (short | medium | long);
     api — id услуги для сервиса, если он не знает её под своим id */
  const SERVICES = [
    { id: 'manicure',     cat: 'Маникюр', name: 'Маникюр (без покрытия)', time: '50 мин', design: false, lengths: [{ price: 1500 }] },
    { id: 'japanese',     cat: 'Маникюр', name: 'Японский маникюр', time: '50 мин', api: 'manicure', design: false, lengths: [{ price: 1600 }] },
    { id: 'manicure_gel', cat: 'Маникюр + покрытие', name: 'Маникюр + покрытие', time: '1 ч 30 мин – 2 ч', design: true, lengths: [
      { name: '1–2', price: 1700, nails: 'short' }, { name: '3–4', price: 1800, nails: 'medium' },
    ] },
    { id: 'extension',    cat: 'Наращивание', name: 'Наращивание', time: '2 ч 30 мин – 3 ч 30 мин', design: true, lengths: [
      { name: '1–2', price: 1800, nails: 'short' }, { name: '3', price: 1900, nails: 'medium' }, { name: '4', price: 2000, nails: 'medium' },
      { name: '5', price: 2100, nails: 'long' }, { name: '6', price: 2200, nails: 'long' },
    ] },
  ];
  const LEVELS = [
    { id: '',       name: 'Без дизайна', price: 0,   text: 'Однотонное покрытие, идеально ровно.' },
    { id: 'light',  name: 'Лёгкий',      full: 'Простой дизайн', price: 200, text: 'Пара акцентов на 1–2 ногтях: полоска, цветок, точка, сердечко.' },
    { id: 'medium', name: 'Средний',     full: 'Дизайн средней сложности', price: 400, text: 'Рисунок на каждом ногте: полоски, точки, френч, волны.' },
    { id: 'crazy',  name: 'Крейзи',      full: 'Дизайн крейзи', price: 600, text: 'Мудборд: на каждом ногте свой рисунок, яркие цвета, хром, стразы.' },
  ];
  const ADDONS = [
    { id: 'removal', name: 'Снятие покрытия', price: 500 },
    { id: 'repair',  name: 'Ремонт ногтя',    price: 200 },
  ];
  const COLORS = [
    ['#ff2e88', 'горячий розовый'], ['#ffc2d9', 'пудровый'], ['#e9c3b0', 'нюд'], ['#fff4ec', 'молочный'],
    ['#d4142f', 'красный'], ['#141014', 'чёрный'], ['#c9a7ff', 'лаванда'], ['#d7ff3a', 'кислотный лайм'],
  ];
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
  async function loadMonth(m) {
    $('cal-msg').textContent = 'Загружаю свободные окна…';
    $('cal-msg').hidden = false;
    try {
      const r = await fetch(API + '/api/slots' + (m ? '?month=' + m : ''));
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      st.month = d.month; st.today = d.today; st.free = d.free || {};
      if (!st.months.length) st.months = [d.month, shiftMonth(d.month, 1)];
      $('cal-msg').hidden = Object.keys(st.free).length > 0;
      $('cal-msg').textContent = 'В этом месяце свободных окон нет — загляни в следующий.';
    } catch (e) {
      st.free = {};
      if (!st.month) { const n = new Date(); st.month = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; st.months = [st.month, shiftMonth(st.month, 1)]; }
      $('cal-msg').textContent = 'Онлайн-запись сейчас недоступна. Попробуй чуть позже 🙏';
    }
    if (st.date && !(st.free[st.date] || []).includes(st.time)) { st.time = ''; }
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
  const adds = () => ADDONS.filter(a => st.addons.includes(a.id));
  const from = s => (s.lengths.length > 1 ? 'от ' : '') + fmt(s.lengths[0].price);

  function renderChoices() {
    $('services').innerHTML = SERVICES.map(s => `<button type="button" class="pill pill--svc${s.id === st.service ? ' on' : ''}" data-svc="${s.id}"><b>${s.name}</b><small>${from(s)}${s.time ? ' · ' + s.time : ''}</small></button>`).join('');
    const ls = svc().lengths;
    $('length-block').hidden = ls.length < 2;
    $('lengths').className = 'levels levels--' + ls.length;
    $('lengths').innerHTML = ls.map((l, i) => `<button type="button" class="level${i === st.length ? ' on' : ''}" data-len="${i}">${l.name}<small>${fmt(l.price)}</small></button>`).join('');
    $('addons').innerHTML = ADDONS.map(a => `<button type="button" class="level${st.addons.includes(a.id) ? ' on' : ''}" data-add="${a.id}">${a.name}<small>+${fmt(a.price)}</small></button>`).join('');
    $('design-block').classList.toggle('off', !svc().design);
    $('levels-pick').innerHTML = LEVELS.map(l => `<button type="button" class="level${l.id === st.design ? ' on' : ''}${l.id === 'crazy' ? ' level--crazy' : ''}" data-lvl="${l.id}">${l.name}<small>${l.price ? '+' + fmt(l.price) : 'включено'}</small></button>`).join('');
    $('colors').innerHTML = COLORS.map(([c, n]) => `<button type="button" class="swatch${c === st.color ? ' on' : ''}" data-color="${c}" style="--c:${c}" title="${n}" aria-label="${n}"></button>`).join('');
    preview();
    summary();
  }

  function preview() {
    const l = lvl();
    Nails.render($('hand'), { design: l.id, length: len().nails || 'short', color: st.color, seed: st.seed });
    $('preview-tag').textContent = l.id ? l.name.toLowerCase() : (svc().design ? 'без дизайна' : 'без покрытия');
    $('preview-tag').classList.toggle('crazy', l.id === 'crazy');
    $('preview-text').textContent = svc().design ? l.text : 'Без покрытия: ухоженные ногти, кутикула, форма, масло.';
    $('shuffle').hidden = !l.id;
    if (!svc().design) Nails.render($('hand'), { design: '', length: 'short', color: '#f7d6cf', seed: 1 });
  }

  $('services').addEventListener('click', e => {
    const b = e.target.closest('[data-svc]');
    if (b) { st.service = b.dataset.svc; if (st.length >= svc().lengths.length) st.length = 0; renderChoices(); }
  });
  $('lengths').addEventListener('click', e => {
    const b = e.target.closest('[data-len]');
    if (b) { st.length = +b.dataset.len; renderChoices(); }
  });
  $('addons').addEventListener('click', e => {
    const b = e.target.closest('[data-add]');
    if (!b) return;
    const id = b.dataset.add;
    st.addons = st.addons.includes(id) ? st.addons.filter(x => x !== id) : [...st.addons, id];
    renderChoices();
  });
  $('levels-pick').addEventListener('click', e => {
    const b = e.target.closest('[data-lvl]');
    if (b && svc().design) { st.design = b.dataset.lvl; st.seed = Math.floor(Math.random() * 1e6); renderChoices(); }
  });
  $('colors').addEventListener('click', e => {
    const b = e.target.closest('[data-color]');
    if (b && svc().design) { st.color = b.dataset.color; renderChoices(); }
  });
  $('shuffle').onclick = () => { st.seed = Math.floor(Math.random() * 1e6); preview(); };

  function summary() {
    const s = svc(), l = lvl(), a = adds();
    const total = len().price + l.price + a.reduce((n, x) => n + x.price, 0);
    let when = 'Выбери окно в календаре';
    if (st.date) {
      const [y, m, d] = st.date.split('-').map(Number);
      when = `${d} ${MONTHS_GEN[m - 1]}, ${WD[new Date(y, m - 1, d).getDay()]}` + (st.time ? ` в ${st.time}` : ' — выбери время');
    }
    const what = [s.name, len().name && 'длина ' + len().name, l.id && 'дизайн «' + l.name.toLowerCase() + '»', ...a.map(x => x.name.toLowerCase())];
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
    const extra = [s.api && s.name, len().name && 'длина ' + len().name, ...adds().map(x => x.name.toLowerCase())].filter(Boolean);
    Object.entries({
      date: st.date, time: st.time, service: s.api || s.id, length: len().nails || 'short', design: l.id, color: s.design ? st.color : '',
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
    if (!svc().design) { st.service = 'manicure_gel'; st.length = 0; }
    st.design = b.dataset.pick;
    renderChoices();
    $('book').scrollIntoView({ behavior: 'smooth' });
  });

  const row = (name, note, price) => `<div class="pl"><span>${name}${note ? `<small>${note}</small>` : ''}</span><b>${price}</b></div>`;
  $('price-list').innerHTML = [...new Set(SERVICES.map(s => s.cat))].map(c => `<h3>${c}</h3>` + SERVICES.filter(s => s.cat === c).map(s =>
    s.lengths.length > 1
      ? s.lengths.map(l => row('Длина ' + l.name, s.time, fmt(l.price))).join('')
      : row(s.name, s.time, fmt(s.lengths[0].price))).join('')).join('');
  $('design-prices').innerHTML = '<h3>Дополнительные услуги</h3>'
    + LEVELS.filter(l => l.id).map(l => row(l.full, l.text, (l.id === 'crazy' ? 'от ' : '+') + fmt(l.price))).join('')
    + ADDONS.map(a => row(a.name, '', fmt(a.price))).join('');
  $('year').textContent = new Date().getFullYear();

  renderChoices();
  loadMonth('');
})();
