/* Liza Nails: booking form talking to the bookings service on b.net
   (exposed through Tailscale Funnel). ?api=http://localhost:18081 overrides it for testing. */
(function () {
  'use strict';

  const API = new URLSearchParams(location.search).get('api') || 'https://berry-k3s.tail4064e5.ts.net:10000';

  const SERVICES = [
    { id: 'manicure_gel', name: 'Маникюр + покрытие', price: 2300, time: '1 ч 45 мин', design: true },
    { id: 'extension',    name: 'Наращивание',        price: 3500, time: '2 ч 30 мин', design: true },
    { id: 'strengthen',   name: 'Укрепление + покрытие', price: 2700, time: '2 ч', design: true },
    { id: 'pedicure',     name: 'Педикюр + покрытие', price: 2800, time: '1 ч 50 мин', design: true },
    { id: 'manicure',     name: 'Маникюр без покрытия', price: 1200, time: '45 мин', design: false },
  ];
  const LEVELS = [
    { id: '',       name: 'Без дизайна', price: 0,    text: 'Однотонное покрытие, идеально ровно.' },
    { id: 'light',  name: 'Лёгкий',      price: 300,  text: 'Пара акцентов: полосочка, цветочек, точка, сердечко — на 1–2 ногтях.' },
    { id: 'medium', name: 'Средний',     price: 800,  text: 'Рисунок на каждом ногте: полоски, точки, френч, волны, узоры.' },
    { id: 'crazy',  name: 'Крейзи',      price: 1800, text: 'Целый мудборд: каждый ноготь — своя история, неон, хром, стразы.' },
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
    date: '', time: '', service: 'manicure_gel', design: 'light', color: COLORS[0][0],
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

  function renderChoices() {
    $('services').innerHTML = SERVICES.map(s => `<button type="button" class="pill pill--svc${s.id === st.service ? ' on' : ''}" data-svc="${s.id}"><b>${s.name}</b><small>${fmt(s.price)} · ${s.time}</small></button>`).join('');
    $('design-block').classList.toggle('off', !svc().design);
    $('levels-pick').innerHTML = LEVELS.map(l => `<button type="button" class="level${l.id === st.design ? ' on' : ''}${l.id === 'crazy' ? ' level--crazy' : ''}" data-lvl="${l.id}">${l.name}<small>${l.price ? '+' + fmt(l.price) : 'включено'}</small></button>`).join('');
    $('colors').innerHTML = COLORS.map(([c, n]) => `<button type="button" class="swatch${c === st.color ? ' on' : ''}" data-color="${c}" style="--c:${c}" title="${n}" aria-label="${n}"></button>`).join('');
    preview();
    summary();
  }

  function preview() {
    const l = lvl();
    Nails.render($('hand'), { design: l.id, color: st.color, seed: st.seed });
    $('preview-tag').textContent = l.id ? l.name.toLowerCase() : (svc().design ? 'без дизайна' : 'без покрытия');
    $('preview-tag').classList.toggle('crazy', l.id === 'crazy');
    $('preview-text').textContent = svc().design ? l.text : 'Без покрытия: ухоженные ногти, кутикула, форма, масло.';
    $('shuffle').hidden = !l.id;
    if (!svc().design) Nails.render($('hand'), { design: '', color: '#f7d6cf', seed: 1 });
  }

  $('services').addEventListener('click', e => {
    const b = e.target.closest('[data-svc]');
    if (b) { st.service = b.dataset.svc; renderChoices(); }
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
    const s = svc(), l = lvl();
    const total = s.price + l.price;
    let when = 'Выбери окно в календаре';
    if (st.date) {
      const [y, m, d] = st.date.split('-').map(Number);
      when = `${d} ${MONTHS_GEN[m - 1]}, ${WD[new Date(y, m - 1, d).getDay()]}` + (st.time ? ` в ${st.time}` : ' — выбери время');
    }
    $('summary').innerHTML = `<b>${when}</b><span>${s.name}${l.id ? ' · дизайн «' + l.name.toLowerCase() + '»' : ''}</span><strong>${l.id === 'crazy' ? 'от ' : ''}${fmt(total)}</strong>`;
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
    const l = lvl();
    Object.entries({
      date: st.date, time: st.time, service: st.service, design: l.id, color: svc().design ? st.color : '',
      name: f.name.value, phone: f.phone.value, contact: f.contact.value, comment: f.comment.value, website: f.website.value,
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
    st.photos = []; st.date = ''; st.time = '';
    renderThumbs();
    $('done').classList.add('hidden');
    $('booker').classList.remove('hidden');
    loadMonth(st.month);
  };

  /* ── static sections ───────────────────────────────── */
  $('level-cards').innerHTML = LEVELS.filter(l => l.id).map(l => `
    <article class="lcard${l.id === 'crazy' ? ' lcard--crazy' : ''}">
      <svg id="lv-${l.id}" viewBox="0 0 500 330" aria-hidden="true"></svg>
      <h3>${l.name}</h3><p>${l.text}</p><span class="lcard__price">+${fmt(l.price)}</span>
      <button type="button" class="btn btn--sm" data-pick="${l.id}">Хочу так</button>
    </article>`).join('');
  Nails.render($('lv-light'), { design: 'light', color: '#ffc2d9', seed: 11 });
  Nails.render($('lv-medium'), { design: 'medium', color: '#fff4ec', seed: 5 });
  Nails.render($('lv-crazy'), { design: 'crazy', color: '#ff2e88', seed: 3 });
  Nails.render($('about-hand'), { design: 'crazy', color: '#141014', seed: 42 });
  $('level-cards').addEventListener('click', e => {
    const b = e.target.closest('[data-pick]');
    if (!b) return;
    if (!svc().design) st.service = 'manicure_gel';
    st.design = b.dataset.pick;
    renderChoices();
    $('book').scrollIntoView({ behavior: 'smooth' });
  });

  $('price-list').innerHTML = '<h3>Услуги</h3>' + SERVICES.map(s => `<div class="pl"><span>${s.name}<small>${s.time}</small></span><b>${fmt(s.price)}</b></div>`).join('');
  $('design-prices').innerHTML = '<h3>Дизайн</h3>' + LEVELS.map(l => `<div class="pl"><span>${l.name}<small>${l.text}</small></span><b>${l.price ? (l.id === 'crazy' ? 'от ' : '+') + fmt(l.price) : '—'}</b></div>`).join('');
  $('year').textContent = new Date().getFullYear();

  renderChoices();
  loadMonth('');
})();
