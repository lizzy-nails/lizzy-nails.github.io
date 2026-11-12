/* Nails: draws four fingers of a hand (back side, nails up) as SVG.
   Nails.render(svgEl, { design: '' | 'light' | 'medium' | 'crazy', length: 'short' | 'medium' | 'long', color: '#rrggbb', seed: n }) */
(function () {
  'use strict';

  /* index, middle, ring, little: left edge, width, fingertip y */
  const FINGERS = [
    { x: 52,  w: 92, tip: 112 },
    { x: 158, w: 96, tip: 90 },
    { x: 268, w: 90, tip: 108 },
    { x: 372, w: 76, tip: 150 },
  ];
  /* how far the free edge goes past the fingertip, and how pointed it is */
  const LENGTH = {
    short:  { ext: 4,  shape: 'squoval' },
    medium: { ext: 30, shape: 'oval' },
    long:   { ext: 64, shape: 'almond' },
  };
  const SKIN = '#f2c7b0', SKIN_SH = '#d9a088';
  const NEON = ['#ff2e88', '#d7ff3a', '#7b5cff', '#00d1c1', '#ff7a1a', '#ffe14d', '#120a10', '#ffffff'];

  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }
  const pick = (r, a) => a[Math.floor(r() * a.length)];

  function lum(hex) {
    const n = parseInt(hex.slice(1), 16);
    return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  }
  const contrast = (base, r) => lum(base) > 0.6 ? pick(r, ['#120a10', '#ff2e88', '#d4142f']) : pick(r, ['#ffffff', '#ffc2d9', '#d7ff3a']);

  /* nail plate, origin at its top-left: free edge on top, rounded cuticle at the bottom */
  function nailPath(w, h, shape) {
    const b = w * 0.42; // cuticle roundness
    let top;
    if (shape === 'squoval') {
      const r = w * 0.32;
      top = `M0 ${r} Q0 0 ${r} 0 L${w - r} 0 Q${w} 0 ${w} ${r}`;
    } else {
      const t = shape === 'almond' ? w * 1.05 : w * 0.62; // height of the curved tip
      const k = shape === 'almond' ? 0.18 : 0.02;
      top = `M0 ${t} C0 ${t * 0.45} ${w * (0.5 - k - 0.22)} 0 ${w / 2} 0 C${w * (0.5 + k + 0.22)} 0 ${w} ${t * 0.45} ${w} ${t}`;
    }
    return `${top} L${w} ${h - b} Q${w} ${h} ${w / 2} ${h} Q0 ${h} 0 ${h - b} Z`;
  }

  /* ── motifs: (w, h, colours, r) → svg inside the nail ── */
  const heart = (cx, cy, s, c) => `<path transform="translate(${cx} ${cy}) scale(${s})" d="M0 4C-6-3-11 2-8 6L0 13L8 6C11 2 6-3 0 4Z" fill="${c}"/>`;
  const star = (cx, cy, s, c) => {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 5 * i - Math.PI / 2, rr = i % 2 ? s * 0.45 : s;
      d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(1) + ' ' + (cy + rr * Math.sin(a)).toFixed(1);
    }
    return `<path d="${d}Z" fill="${c}"/>`;
  };
  const flower = (cx, cy, s, c, mid) => {
    let p = '';
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * 2 / 5 * i;
      p += `<circle cx="${(cx + Math.cos(a) * s).toFixed(1)}" cy="${(cy + Math.sin(a) * s).toFixed(1)}" r="${s * 0.75}" fill="${c}"/>`;
    }
    return p + `<circle cx="${cx}" cy="${cy}" r="${s * 0.55}" fill="${mid}"/>`;
  };
  const gem = (cx, cy, s, c) => `<circle cx="${cx}" cy="${cy}" r="${s}" fill="${c}" stroke="#fff" stroke-width="1.5"/><circle cx="${cx - s * 0.35}" cy="${cy - s * 0.35}" r="${s * 0.3}" fill="#fff" opacity=".9"/>`;

  const M = {
    /* light */
    stripe: (w, h, c) => `<path d="M-4 ${h * 0.55} L${w + 4} ${h * 0.45}" stroke="${c.acc}" stroke-width="4"/>`,
    flower: (w, h, c) => flower(w * 0.5, h * 0.5, 7, c.acc, c.acc2),
    dot: (w, h, c) => `<circle cx="${w / 2}" cy="${h * 0.62}" r="5" fill="${c.acc}"/>`,
    heart: (w, h, c) => heart(w / 2, h * 0.45, 1.4, c.acc),
    tipline: (w, h, c) => `<path d="M0 ${h * 0.24} Q${w / 2} ${h * 0.34} ${w} ${h * 0.24}" stroke="${c.acc}" stroke-width="3" fill="none"/>`,

    /* medium */
    stripes: (w, h, c) => [0, 1, 2, 3, 4, 5, 6, 7].map(i => `<path d="M-10 ${12 + i * 22} L${w + 10} ${12 + i * 22 - 26}" stroke="${i % 2 ? c.acc2 : c.acc}" stroke-width="5"/>`).join(''),
    dots: (w, h, c) => {
      let s = '';
      for (let y = 10; y < h + 10; y += 17) for (let x = (y / 17) % 2 ? 8 : 17; x < w; x += 18) s += `<circle cx="${x}" cy="${y}" r="4.2" fill="${c.acc}"/>`;
      return s;
    },
    french: (w, h, c) => `<path d="M-2 -2 H${w + 2} V${h * 0.26} Q${w / 2} ${h * 0.4} -2 ${h * 0.26} Z" fill="${c.acc}"/><path d="M0 ${h * 0.32} Q${w / 2} ${h * 0.46} ${w} ${h * 0.32}" stroke="${c.acc2}" stroke-width="3" fill="none"/>`,
    waves: (w, h, c) => [0, 1, 2, 3, 4].map(i => `<path d="M-6 ${24 + i * 26} q${w / 4} -16 ${w / 2} 0 t${w / 2} 0 t${w / 2} 0" stroke="${i % 2 ? c.acc2 : c.acc}" stroke-width="5" fill="none"/>`).join(''),
    moon: (w, h, c) => `<circle cx="${w / 2}" cy="${h + 4}" r="${w * 0.42}" fill="${c.acc}"/><circle cx="${w / 2}" cy="${h + 4}" r="${w * 0.42 - 5}" fill="${c.base}"/>${[0.25, 0.5, 0.75].map(k => `<circle cx="${w * k}" cy="${h * 0.3}" r="3.5" fill="${c.acc2}"/>`).join('')}`,
    lines: (w, h, c) => [0.25, 0.5, 0.75].map(k => `<path d="M${w * k} -2 V${h + 2}" stroke="${c.acc}" stroke-width="3"/>`).join('') + `<path d="M-2 ${h * 0.55} H${w + 2}" stroke="${c.acc2}" stroke-width="3"/>`,

    /* crazy */
    checker: (w, h, c) => {
      let s = '';
      for (let y = 0; y < h + 14; y += 14) for (let x = 0; x < w; x += 14) if ((x + y) / 14 % 2 === 0) s += `<rect x="${x}" y="${y}" width="14" height="14" fill="${c.acc}"/>`;
      return s;
    },
    flames: (w, h, c) => [c.acc, c.acc2].map((col, i) => `<path d="M-4 ${h + 4} L-4 ${h * (0.55 + i * 0.12)} C${w * 0.1} ${h * 0.3} ${w * 0.25} ${h * (0.62 + i * 0.1)} ${w * 0.3} ${h * (0.28 + i * 0.12)} C${w * 0.42} ${h * (0.5 + i * 0.1)} ${w * 0.5} ${h * 0.6} ${w * 0.6} ${h * (0.18 + i * 0.12)} C${w * 0.7} ${h * 0.5} ${w * 0.85} ${h * 0.45} ${w + 4} ${h * (0.35 + i * 0.12)} L${w + 4} ${h + 4} Z" fill="${col}"/>`).join(''),
    leopard: (w, h, c, r) => {
      let s = '';
      for (let i = 0; i < 10; i++) {
        const x = r() * w, y = r() * h, rx = 5 + r() * 4;
        s += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${(rx * 0.75).toFixed(1)}" fill="${c.acc2}" stroke="${c.acc}" stroke-width="3" stroke-dasharray="7 4" transform="rotate(${(r() * 90).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
      }
      return s;
    },
    hearts: (w, h, c, r) => [0, 1, 2, 3, 4].map(i => heart(8 + r() * (w - 16), 10 + i * (h / 5), 0.8 + r() * 0.8, i % 2 ? c.acc : c.acc2)).join(''),
    stars: (w, h, c, r) => `<rect x="-2" y="-2" width="${w + 4}" height="${h + 4}" fill="url(#${c.chrome})" opacity=".85"/>` + [0, 1, 2, 3].map(() => star(8 + r() * (w - 16), 10 + r() * (h - 20), 5 + r() * 6, c.acc)).join(''),
    smiley: (w, h, c) => {
      const cx = w / 2, cy = h * 0.5, R = w * 0.34;
      return `<circle cx="${cx}" cy="${cy}" r="${R}" fill="#ffe14d" stroke="#120a10" stroke-width="2.5"/><circle cx="${cx - R * 0.35}" cy="${cy - R * 0.2}" r="${R * 0.11}" fill="#120a10"/><circle cx="${cx + R * 0.35}" cy="${cy - R * 0.2}" r="${R * 0.11}" fill="#120a10"/><path d="M${cx - R * 0.5} ${cy + R * 0.15} Q${cx} ${cy + R * 0.75} ${cx + R * 0.5} ${cy + R * 0.15}" stroke="#120a10" stroke-width="2.5" fill="none"/>`;
    },
    bolt: (w, h, c) => `<path d="M${w * 0.62} ${h * 0.08} L${w * 0.2} ${h * 0.55} L${w * 0.48} ${h * 0.55} L${w * 0.32} ${h * 0.95} L${w * 0.82} ${h * 0.4} L${w * 0.54} ${h * 0.4} Z" fill="${c.acc}" stroke="#120a10" stroke-width="2.5"/>`,
    swirl: (w, h, c) => [c.acc, c.acc2, '#ffffff'].map((col, i) => `<path d="M${-10 + i * 6} ${h * 0.1 + i * 30} C${w * 0.8} ${h * 0.05 + i * 30} ${w * 0.1} ${h * 0.5 + i * 25} ${w + 10} ${h * 0.45 + i * 30}" stroke="${col}" stroke-width="10" fill="none" stroke-linecap="round"/>`).join(''),
    cherry: (w, h, c) => `<path d="M${w * 0.5} ${h * 0.2} Q${w * 0.35} ${h * 0.4} ${w * 0.3} ${h * 0.55} M${w * 0.5} ${h * 0.2} Q${w * 0.62} ${h * 0.4} ${w * 0.7} ${h * 0.52}" stroke="#2e7d32" stroke-width="3" fill="none"/><circle cx="${w * 0.3}" cy="${h * 0.6}" r="${w * 0.15}" fill="#d4142f"/><circle cx="${w * 0.7}" cy="${h * 0.57}" r="${w * 0.15}" fill="#d4142f"/><circle cx="${w * 0.26}" cy="${h * 0.57}" r="3" fill="#fff"/><circle cx="${w * 0.66}" cy="${h * 0.54}" r="3" fill="#fff"/>`,
    blobs: (w, h, c, r) => [c.acc, c.acc2, pick(r, NEON)].map((col, i) => `<circle cx="${(r() * w).toFixed(1)}" cy="${(h * (0.2 + i * 0.3)).toFixed(1)}" r="${(12 + r() * 12).toFixed(1)}" fill="${col}"/>`).join(''),
  };

  const SETS = {
    light: ['stripe', 'flower', 'dot', 'heart', 'tipline'],
    medium: ['stripes', 'dots', 'french', 'waves', 'moon', 'lines'],
    crazy: ['checker', 'flames', 'leopard', 'hearts', 'stars', 'smiley', 'bolt', 'swirl', 'cherry', 'blobs'],
  };

  /* motif per finger (index, middle, ring, little); null: base colour only */
  function plan(design, r) {
    if (!design) return [null, null, null, null];
    if (design === 'light') {
      const m = pick(r, SETS.light), out = [null, null, m, null]; // accent on the ring finger
      if (r() < 0.5) out[0] = r() < 0.5 ? m : pick(r, SETS.light);
      return out;
    }
    if (design === 'medium') {
      const a = pick(r, SETS.medium), b = pick(r, SETS.medium.filter(x => x !== a));
      return [a, a, b, a];
    }
    const pool = SETS.crazy.slice();
    return FINGERS.map(() => pool.splice(Math.floor(r() * pool.length), 1)[0]);
  }

  function render(svg, opt) {
    const r = rng(opt.seed || 1);
    const base = opt.color || '#ff2e88';
    const len = LENGTH[opt.length] || LENGTH.medium;
    const motifs = plan(opt.design, r);
    const id = svg.id || 'hand';
    const crazy = opt.design === 'crazy';

    const nails = FINGERS.map(f => {
      const w = f.w * 0.7, top = f.tip - len.ext, cut = f.tip + f.w * 1.2; // cuticle y
      return { x: f.x + (f.w - w) / 2, y: top, w, h: cut - top };
    });

    let out = `<defs><linearGradient id="${id}-chrome" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#d9d4e8"/><stop offset=".55" stop-color="#ffffff"/><stop offset="1" stop-color="#b8b2c9"/></linearGradient>`;
    nails.forEach((n, i) => { out += `<clipPath id="${id}-nc${i}"><path d="${nailPath(n.w, n.h, len.shape)}"/></clipPath>`; });
    out += '</defs>';

    /* palm and fingers */
    out += `<path d="M30 330 L30 300 Q30 280 60 280 L440 280 Q470 280 470 300 L470 330 Z" fill="${SKIN}"/>`;
    FINGERS.forEach(f => {
      out += `<rect x="${f.x}" y="${f.tip}" width="${f.w}" height="${330 - f.tip + 20}" rx="${f.w / 2}" fill="${SKIN}" stroke="${SKIN_SH}" stroke-width="2"/>`;
      const k = f.tip + f.w * 1.2 + 46; // knuckle creases
      out += `<path d="M${f.x + f.w * 0.3} ${k} q${f.w * 0.2} 5 ${f.w * 0.4} 0 M${f.x + f.w * 0.34} ${k + 9} q${f.w * 0.16} 4 ${f.w * 0.32} 0" stroke="${SKIN_SH}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    });

    nails.forEach((n, i) => {
      const nb = crazy && r() < 0.5 ? pick(r, NEON.filter(x => x !== base)) : base;
      const c = { base: nb, acc: crazy ? pick(r, NEON.filter(x => x !== nb)) : contrast(nb, r), acc2: '', chrome: id + '-chrome' };
      c.acc2 = crazy ? pick(r, NEON.filter(x => x !== nb && x !== c.acc)) : (lum(nb) > 0.6 ? '#ffffff' : '#ff2e88');
      const path = nailPath(n.w, n.h, len.shape);
      out += `<g transform="translate(${n.x.toFixed(1)} ${n.y})">`;
      out += `<path d="M-3 ${n.h - n.w * 0.42} Q-3 ${n.h + 5} ${n.w / 2} ${n.h + 5} Q${n.w + 3} ${n.h + 5} ${n.w + 3} ${n.h - n.w * 0.42}" fill="none" stroke="${SKIN_SH}" stroke-width="2"/>`;
      out += `<g clip-path="url(#${id}-nc${i})"><rect x="-4" y="-4" width="${n.w + 8}" height="${n.h + 8}" fill="${nb}"/>`;
      if (motifs[i]) out += M[motifs[i]](n.w, n.h, c, r);
      if (crazy && r() < 0.45) out += gem(n.w * 0.5, n.h * 0.84, 5, pick(r, ['#ff2e88', '#7b5cff', '#00d1c1']));
      out += `<path d="M${n.w * 0.22} ${n.h * 0.78} C${n.w * 0.17} ${n.h * 0.4} ${n.w * 0.24} ${n.h * 0.2} ${n.w * 0.36} ${n.h * 0.1}" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".45"/>`;
      out += `</g><path d="${path}" fill="none" stroke="#120a10" stroke-width="2.5"/></g>`;
    });
    svg.innerHTML = out;
  }

  window.Nails = { render };
})();
