// Hypnode · home — fondo de nodos, modos interactivos, estados emocionales y sonidos UX.

// ---------- Sonidos UX (Web Audio, sintetizados) ----------
let ctx = null;
function audio() {
  if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC(); }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function nota(f, t0, dur = 0.25, tipo = 'sine', vol = 0.11) {
  const c = audio(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = tipo; o.frequency.value = f;
  const t = c.currentTime + t0;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
}
const SONIDOS = {
  click() { nota(660, 0, 0.12, 'triangle'); nota(990, 0.06, 0.18, 'sine'); },
  luz() { [523, 659, 784, 1047].forEach((f, i) => nota(f, i * 0.055, 0.35, 'sine')); },
  sonido() { nota(220, 0, 0.5, 'sine', 0.14); nota(330, 0.08, 0.5, 'sine', 0.1); nota(440, 0.16, 0.6, 'sine', 0.08); },
  forma() { nota(392, 0, 0.1, 'square', 0.05); nota(587, 0.07, 0.1, 'square', 0.05); nota(784, 0.14, 0.22, 'square', 0.05); },
  feliz() { [523, 659, 784, 1047].forEach((f, i) => nota(f, i * 0.06, 0.3)); },
  triste() { [440, 349, 294].forEach((f, i) => nota(f, i * 0.14, 0.5)); },
  estres() { [466, 494, 466, 494, 523].forEach((f, i) => nota(f, i * 0.045, 0.08, 'square', 0.045)); },
  calma() { nota(262, 0, 0.9, 'sine', 0.1); nota(392, 0.1, 0.9, 'sine', 0.08); nota(523, 0.2, 1, 'sine', 0.06); }
};
const sfx = (n) => { try { SONIDOS[n] && SONIDOS[n](); } catch (e) { /* sin audio */ } };
document.querySelectorAll('[data-sfx]').forEach((el) => el.addEventListener('pointerdown', () => sfx(el.dataset.sfx)));

// ---------- Nav ----------
const nav = document.getElementById('nav');
addEventListener('scroll', () => nav.classList.toggle('sol', scrollY > 30), { passive: true });

// ---------- Revelar al hacer scroll ----------
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('vis'); io.unobserve(e.target); } }), { threshold: 0.15 });
document.querySelectorAll('.rev').forEach((el, i) => { el.style.transitionDelay = (i % 3) * 90 + 'ms'; io.observe(el); });

// ---------- Fondo: red de nodos ----------
(() => {
  const cv = document.getElementById('red'), g = cv.getContext('2d');
  let W, H, pts = [], mouse = { x: -999, y: -999 };
  const reducir = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function size() {
    const d = Math.min(devicePixelRatio || 1, 2);
    W = cv.width = innerWidth * d; H = cv.height = innerHeight * d; g.setTransform(d, 0, 0, d, 0, 0);
    const n = Math.round(innerWidth * innerHeight / 22000);
    pts = Array.from({ length: Math.min(n, 70) }, () => ({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, vx: (Math.random() - .5) * .25, vy: (Math.random() - .5) * .25 }));
  }
  function frame() {
    g.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of pts) {
      if (!reducir) { p.x += p.vx; p.y += p.vy; }
      if (p.x < 0 || p.x > innerWidth) p.vx *= -1;
      if (p.y < 0 || p.y > innerHeight) p.vy *= -1;
    }
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, d = Math.hypot(dx, dy);
        if (d < 150) { g.strokeStyle = `rgba(110,92,255,${(1 - d / 150) * .35})`; g.lineWidth = 1; g.beginPath(); g.moveTo(pts[i].x, pts[i].y); g.lineTo(pts[j].x, pts[j].y); g.stroke(); }
      }
      const m = Math.hypot(pts[i].x - mouse.x, pts[i].y - mouse.y);
      g.fillStyle = m < 160 ? '#4ECDFF' : '#C9CDD6';
      g.globalAlpha = m < 160 ? 1 : .55;
      g.beginPath(); g.arc(pts[i].x, pts[i].y, m < 160 ? 2.6 : 1.6, 0, 7); g.fill(); g.globalAlpha = 1;
      if (m < 160) { g.strokeStyle = `rgba(78,205,255,${(1 - m / 160) * .5})`; g.beginPath(); g.moveTo(pts[i].x, pts[i].y); g.lineTo(mouse.x, mouse.y); g.stroke(); }
    }
    requestAnimationFrame(frame);
  }
  addEventListener('resize', size); addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  size(); frame();
})();

// ---------- Hero: inclinación del producto ----------
(() => {
  const vis = document.getElementById('vis'), prod = document.getElementById('prod');
  if (!vis || matchMedia('(pointer: coarse)').matches) return;
  vis.addEventListener('pointermove', (e) => {
    const r = vis.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    prod.style.transform = `perspective(900px) rotateY(${x * 14}deg) rotateX(${-y * 10}deg)`;
  });
  vis.addEventListener('pointerleave', () => { prod.style.transform = ''; });
})();

// ---------- Modos LUZ / SONIDO / FORMA (lienzo animado) ----------
const MODOS = {
  luz: { tag: '// LUZ', titulo: 'Sueños en secuencias lumínicas', texto: 'Convierte patrones oníricos en secuencias lumínicas inmersivas. La intensidad y el color se adaptan a la emoción dominante del sueño.', val: 72 },
  sonido: { tag: '// SONIDO', titulo: 'Ondas cerebrales hechas música', texto: 'Traduce ondas cerebrales en paisajes sonoros generativos. Cada sesión REM produce una composición única e irrepetible.', val: 58 },
  forma: { tag: '// FORMA', titulo: 'Arquitecturas de sueños en 3D', texto: 'Materializa arquitecturas de sueños en geometrías 3D interactivas. Explora el espacio onírico desde cualquier ángulo.', val: 91 }
};
(() => {
  const cv = document.getElementById('modo-canvas'), g = cv.getContext('2d');
  let modo = 'luz', t = 0;
  const W = cv.width, H = cv.height, cx = W / 2, cy = H / 2;
  function luz() {
    for (let i = 0; i < 4; i++) {
      const r = ((t * 40 + i * 70) % 280) + 10, a = 1 - r / 290;
      g.strokeStyle = `rgba(78,205,255,${a * .8})`; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
    }
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, 90 + Math.sin(t * 2) * 14);
    gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.3, 'rgba(78,205,255,.8)'); gr.addColorStop(1, 'rgba(110,92,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 120, 0, 7); g.fill();
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * 6.283 + t * .6, r = 150 + Math.sin(t * 2 + i) * 14;
      g.fillStyle = '#C9CDD6'; g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r * .65, 3, 0, 7); g.fill();
    }
  }
  function sonido() {
    for (let k = 0; k < 3; k++) {
      g.strokeStyle = k === 0 ? '#4ECDFF' : k === 1 ? '#6E5CFF' : '#C9CDD655'; g.lineWidth = k === 0 ? 3 : 2; g.beginPath();
      for (let x = 0; x <= W; x += 4) {
        const env = Math.sin(x / W * Math.PI), y = cy + Math.sin(x * .03 * (k + 1) + t * (2 + k)) * 80 * env * (.5 + .5 * Math.sin(t + k));
        x ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }
    for (let i = 0; i < 40; i++) {
      const x = i * (W / 39), h = 10 + Math.abs(Math.sin(t * 3 + i * .5)) * 36;
      g.fillStyle = 'rgba(110,92,255,.35)'; g.fillRect(x - 2, H - 20 - h, 4, h);
    }
  }
  function forma() {
    const R = 120, a = t * .7, c = Math.cos(a), s = Math.sin(a), b = t * .4, cb = Math.cos(b), sb = Math.sin(b);
    const V = [[0, -1, 0], [1, 0, 0], [0, 0, 1], [-1, 0, 0], [0, 0, -1], [0, 1, 0]].map(([x, y, z]) => {
      let X = x * c + z * s, Z = -x * s + z * c, Y = y * cb - Z * sb; Z = y * sb + Z * cb;
      const k = 300 / (300 + Z * R); return [cx + X * R * k * 1.2, cy + Y * R * k * 1.2, Z];
    });
    const E = [[0, 1], [0, 2], [0, 3], [0, 4], [5, 1], [5, 2], [5, 3], [5, 4], [1, 2], [2, 3], [3, 4], [4, 1]];
    g.lineWidth = 2;
    for (const [i, j] of E) { g.strokeStyle = 'rgba(110,92,255,.9)'; g.beginPath(); g.moveTo(V[i][0], V[i][1]); g.lineTo(V[j][0], V[j][1]); g.stroke(); }
    for (const v of V) { g.fillStyle = '#4ECDFF'; g.beginPath(); g.arc(v[0], v[1], 5 + v[2] * 1.5, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(78,205,255,.07)'; g.beginPath(); g.moveTo(V[0][0], V[0][1]); [1, 2, 3, 4, 1].forEach((i) => g.lineTo(V[i][0], V[i][1])); g.fill();
  }
  function frame() {
    t += .016; g.clearRect(0, 0, W, H);
    ({ luz, sonido, forma })[modo]();
    requestAnimationFrame(frame);
  }
  frame();
  const $ = (id) => document.getElementById(id);
  document.querySelectorAll('.selector button').forEach((b) => b.addEventListener('click', () => {
    modo = b.dataset.modo; const m = MODOS[modo];
    document.querySelectorAll('.selector button').forEach((x) => x.classList.toggle('on', x === b));
    $('m-tag').textContent = m.tag; $('m-titulo').textContent = m.titulo; $('m-texto').textContent = m.texto;
    $('m-barra').style.width = m.val + '%'; $('m-val').textContent = m.val + '%';
    sfx(modo);
  }));
})();

// ---------- Dream Scan: estados emocionales ----------
const EMO = {
  feliz: { tag: 'FELIZ', titulo: 'Sueño vívido', texto: 'Tonos cálidos y dorados. Frecuencia de onda alta. Asociado con sueños lúcidos positivos.', rem: 'ALTA', bpm: '88 BPM', luz: 'ÁMBAR CÁLIDO' },
  triste: { tag: 'TRISTE', titulo: 'Sueño lento', texto: 'Azul profundo y frío. Frecuencia baja. Refleja estados de introspección onírica.', rem: 'BAJA', bpm: '42 BPM', luz: 'AZUL PROFUNDO' },
  estres: { tag: 'ESTRÉS', titulo: 'Señal irregular', texto: 'Rojo intenso y pulsante. Picos de actividad neural. Detecta sueños con carga emocional elevada.', rem: 'FRAGMENTADA', bpm: '120 BPM', luz: 'ROJO ALERTA' },
  calma: { tag: 'CALMA', titulo: 'Ondas delta', texto: 'Verde menta suave. Ondas constantes. Indica estados de sueño profundo y reparador.', rem: 'ESTABLE', bpm: '28 BPM', luz: 'VERDE MENTA' }
};
(() => {
  const sec = document.getElementById('dreamscan'), img = document.getElementById('scan-img');
  const $ = (id) => document.getElementById(id);
  document.querySelectorAll('.emos button').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.emo, e = EMO[k];
    document.querySelectorAll('.emos button').forEach((x) => x.classList.toggle('on', x === b));
    sec.dataset.emo = k;
    $('e-tag').textContent = '// ESTADO · ' + e.tag; $('e-titulo').textContent = e.titulo; $('e-texto').textContent = e.texto;
    $('e-rem').textContent = e.rem; $('e-bpm').textContent = e.bpm; $('e-luz').textContent = e.luz;
    img.classList.add('cambia');
    setTimeout(() => { img.src = `assets/img/scan-${k}.webp`; img.alt = 'Filtro Dream Scan en estado ' + e.tag.toLowerCase(); img.classList.remove('cambia'); }, 220);
    sfx(k);
  }));
})();
