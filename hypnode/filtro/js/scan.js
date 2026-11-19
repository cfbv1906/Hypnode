import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/vision_bundle.mjs";

const $ = (s) => document.querySelector(s);
const cam = $("#cam"), cv = $("#fx"), ctx = cv.getContext("2d");

/* ───────── Emociones ───────── */
const EMO = {
  neutro: { rgb: "110,92,255", tag: "DREAM SCAN · ESCANEANDO", titulo: "Esperando tu gesto", rem: "—", bpm: null, luz: "—", p: null },
  feliz:  { rgb: "255,209,102", tag: "ESTADO · FELIZ", titulo: "Sueño lúcido positivo", rem: "ALTA · 82%", bpm: 78, luz: "ÁMBAR #FFD166", p: "chispas" },
  estres: { rgb: "255,107,107", tag: "ESTADO · ESTRÉS", titulo: "Carga emocional elevada", rem: "PICOS · 94%", bpm: 112, luz: "ROJO PULSANTE", p: "rayos" },
  triste: { rgb: "74,144,217",  tag: "ESTADO · TRISTE", titulo: "Introspección onírica", rem: "BAJA · 31%", bpm: 58, luz: "AZUL PROFUNDO", p: "gotas" },
  calma:  { rgb: "127,255,212", tag: "ESTADO · CALMA", titulo: "Sueño profundo y reparador", rem: "PROFUNDA · 66%", bpm: 52, luz: "MENTA CONSTANTE", p: "aros" },
};
const AUDIO_SRC = { feliz: "assets/audio/feliz.mp3", estres: "assets/audio/estres.mp3", triste: "assets/audio/triste.mp3", calma: "assets/audio/calma.mp3" };

/* ───────── Audio: SFX sintetizados + pistas ───────── */
let AC = null, master = null, muted = false;
const tracks = {};
function initAudio() {
  if (AC) { if (AC.state === "suspended") AC.resume(); return; }
  AC = new (window.AudioContext || window.webkitAudioContext)();
  master = AC.createGain(); master.gain.value = 1;
  const comp = AC.createDynamicsCompressor(); master.connect(comp); comp.connect(AC.destination);
  for (const k in AUDIO_SRC) {
    const el = new Audio(AUDIO_SRC[k]); el.preload = "auto"; el.loop = k !== "estres"; el.crossOrigin = "anonymous";
    const g = AC.createGain(); g.gain.value = 0;
    try { AC.createMediaElementSource(el).connect(g); g.connect(master); } catch (e) { g.connect(master); }
    tracks[k] = { el, g };
    // desbloqueo en iOS dentro del gesto
    el.muted = true; const p = el.play(); if (p) p.then(() => { el.pause(); el.currentTime = 0; el.muted = false; }).catch(() => { el.muted = false; });
  }
}
function tone(t0, f, d, o = {}) {
  const { type = "sine", v = 0.18, f2 = null, a = 0.008 } = o;
  const os = AC.createOscillator(), g = AC.createGain();
  os.type = type; os.frequency.setValueAtTime(f, t0);
  if (f2) os.frequency.exponentialRampToValueAtTime(f2, t0 + d);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  os.connect(g); g.connect(master); os.start(t0); os.stop(t0 + d + 0.05);
}
const SFX = {
  click: (t) => { tone(t, 880, .09, { type: "triangle", v: .16, f2: 1320 }); },
  atras: (t) => { tone(t, 700, .1, { type: "triangle", v: .15, f2: 420 }); },
  iniciar: (t) => { [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(t + i * .07, f, .34, { type: "sine", v: .15 })); tone(t, 98, .8, { type: "sawtooth", v: .05, f2: 196 }); },
  sensor: (t) => { tone(t, 1200, .06, { type: "square", v: .06 }); },
  listo: (t) => { tone(t, 659.25, .12, { type: "triangle", v: .15 }); tone(t + .1, 987.77, .3, { type: "triangle", v: .15 }); },
  rostro: (t) => { tone(t, 520, .1, { type: "sine", v: .12, f2: 780 }); tone(t + .09, 1040, .16, { type: "sine", v: .1 }); },
  feliz: (t) => { [659.25, 830.6, 987.77].forEach((f, i) => tone(t + i * .06, f, .22, { type: "triangle", v: .1 })); },
  estres: (t) => { tone(t, 220, .22, { type: "sawtooth", v: .09, f2: 110 }); tone(t + .05, 233, .22, { type: "square", v: .04, f2: 117 }); },
  triste: (t) => { tone(t, 392, .35, { type: "sine", v: .1, f2: 330 }); tone(t + .12, 311, .4, { type: "sine", v: .08, f2: 262 }); },
  calma: (t) => { tone(t, 523.25, .7, { type: "sine", v: .08, a: .12 }); tone(t + .05, 783.99, .8, { type: "sine", v: .06, a: .14 }); },
  foto: (t) => { tone(t, 2400, .04, { type: "square", v: .08 }); tone(t + .05, 1500, .08, { type: "square", v: .07 }); },
  mute: (t) => { tone(t, 600, .07, { type: "triangle", v: .12 }); },
  reset: (t) => { tone(t, 500, .12, { type: "sine", v: .12, f2: 900 }); tone(t + .1, 900, .12, { type: "sine", v: .1, f2: 500 }); },
};
function sfx(n) { if (!AC || muted) return; try { SFX[n](AC.currentTime + 0.005); } catch (e) {} }
function vib(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }

let curTrack = null;
function fadeTo(g, v, d) { const t = AC.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(v, t + d); }
function playTrack(k) {
  if (!AC) return;
  stopTrack(0.35);
  if (!k || !tracks[k]) return;
  const tr = tracks[k]; curTrack = k;
  tr.el.currentTime = 0; const p = tr.el.play(); if (p) p.catch(() => {});
  fadeTo(tr.g, k === "calma" ? 0.9 : 1, 0.25);
}
function stopTrack(d = 0.6) {
  if (!AC || !curTrack) return;
  const tr = tracks[curTrack]; fadeTo(tr.g, 0, d);
  const el = tr.el; setTimeout(() => { if (curTrack !== null && tracks[curTrack].el === el) return; el.pause(); }, d * 1000 + 60);
  curTrack = null;
}

/* ───────── UI ───────── */
const hud = $("#hud"), aviso = $("#aviso"), guia = $("#guia"), chips = document.querySelectorAll("#chips button");
let emo = "neutro";
function setEmo(k, manual = false) {
  if (k === emo) return;
  emo = k; const e = EMO[k];
  document.body.dataset.emo = k;
  $("#h-tag").textContent = e.tag; $("#h-titulo").textContent = e.titulo; $("#h-rem").textContent = e.rem; $("#h-luz").textContent = e.luz;
  $("#h-bpm").textContent = e.bpm ? e.bpm + " BPM" : "— BPM";
  chips.forEach((c) => c.classList.toggle("on", c.dataset.emo === k));
  parts.length = 0;
  if (k === "neutro") { stopTrack(0.7); return; }
  sfx(k); vib(k === "estres" ? [40, 30, 60] : 30);
  playTrack(k);
  guia.classList.add("hide");
  if (manual) manualUntil = performance.now() + 6000;
}
let manualUntil = 0;

document.querySelectorAll("[data-sfx]").forEach((a) => a.addEventListener("pointerdown", () => { initAudio(); sfx(a.dataset.sfx); }));
chips.forEach((c) => c.addEventListener("click", () => { initAudio(); lastGesture = performance.now(); setEmo(c.dataset.emo, true); }));
$("#mute").addEventListener("click", (e) => {
  initAudio(); const b = e.currentTarget;
  if (muted) { muted = false; master.gain.value = 1; b.classList.remove("m"); sfx("mute"); }
  else { sfx("mute"); muted = true; master.gain.setTargetAtTime(0, AC.currentTime, .05); b.classList.add("m"); }
});
$("#giro").addEventListener("click", () => { sfx("reset"); vib(20); manualUntil = 0; setEmo("neutro"); guia.classList.remove("hide"); });
$("#foto").addEventListener("click", () => { sfx("foto"); vib(40); foto(); });

/* ───────── Arranque ───────── */
const show = (id, on) => $(id).classList.toggle("off", !on);
const paso = (n) => { $("#p" + n).classList.add("ok"); $("#c-barra").style.width = (n * 33.4) + "%"; sfx("sensor"); };
let landmarker = null;

$("#iniciar").addEventListener("click", async () => {
  initAudio(); sfx("iniciar"); vib(25);
  show("#intro", false); show("#carga", true);
  try {
    cam.setAttribute("playsinline", ""); cam.muted = true;
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    cam.srcObject = stream; await cam.play();
    paso(1);
    const fs = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm");
    const opts = (d) => ({ baseOptions: { modelAssetPath: "assets/mediapipe/face_landmarker.task", delegate: d }, runningMode: "VIDEO", numFaces: 1, outputFaceBlendshapes: true });
    try { landmarker = await FaceLandmarker.createFromOptions(fs, opts("GPU")); }
    catch (e) { landmarker = await FaceLandmarker.createFromOptions(fs, opts("CPU")); }
    paso(2); await new Promise((r) => setTimeout(r, 350)); paso(3);
    await new Promise((r) => setTimeout(r, 450));
    sfx("listo");
    show("#carga", false); hud.classList.remove("off");
    resize(); requestAnimationFrame(loop);
  } catch (err) {
    console.error(err);
    $("#e-texto").textContent = err && err.name === "NotAllowedError" ? "Permiso de cámara denegado. Actívalo en los ajustes del navegador y reintenta." : "No se pudo acceder a la cámara o al modelo facial (" + (err && err.message || err) + ").";
    show("#carga", false); show("#error", true);
  }
});

/* ───────── Detección de gestos ───────── */
const BS = {};
const sm = { smile: 0, brow: 0, frown: 0, pout: 0, blink: 0 };
const T = { smile: .45, brow: .40, pout: .30, blink: .55 };
let cand = null, candSince = 0, lastGesture = 0, faceSeen = 0;
function readBlend(cats) { for (const c of cats) BS[c.categoryName] = c.score; }
const g = (n) => BS[n] || 0;
function metrics() {
  const raw = {
    smile: (g("mouthSmileLeft") + g("mouthSmileRight")) / 2,
    brow: (g("browDownLeft") + g("browDownRight")) / 2,
    pout: Math.max((g("mouthFrownLeft") + g("mouthFrownRight")) / 2 * 1.2, g("mouthShrugLower") * .6, g("mouthPucker") * .6, g("mouthRollLower") * .6),
    blink: (g("eyeBlinkLeft") + g("eyeBlinkRight")) / 2,
  };
  for (const k in raw) sm[k] += (raw[k] - sm[k]) * 0.5;
}
function classify(now) {
  let c = null;
  if (sm.blink > T.blink) c = "calma";
  else if (sm.smile > T.smile) c = "feliz";
  else if (sm.brow > T.brow) c = "estres";
  else if (sm.pout > T.pout) c = "triste";
  if (c !== cand) { cand = c; candSince = now; }
  if (c) {
    const need = c === "calma" ? 450 : 220;
    if (now - candSince >= need) { lastGesture = now; if (c !== emo) setEmo(c); else lastGesture = now; }
  } else if (emo !== "neutro" && now - lastGesture > 1800 && now > manualUntil) setEmo("neutro");
}
window.__hyp = { sm, T, get emo() { return emo; }, setEmo, classify: () => classify(performance.now()), BS };

/* ───────── Dibujo ───────── */
let W = 0, H = 0, DPR = 1, parts = [], lastVT = -1, lms = null;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
  cv.width = W * DPR; cv.height = H * DPR;
}
addEventListener("resize", resize);
const TESS = FaceLandmarker.FACE_LANDMARKS_TESSELATION, OVAL = FaceLandmarker.FACE_LANDMARKS_FACE_OVAL;
const NODOS = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 1, 4, 168, 6, 33, 133, 263, 362, 61, 291, 13, 14];

function map(l, vw, vh, s, ox, oy) { return [l.x * vw * s + ox, l.y * vh * s + oy]; }

function spawn(e, bx) {
  const [cx, cy, rx, ry] = bx; const p = e.p; if (!p || parts.length > 90) return;
  const a = Math.random() * Math.PI * 2;
  if (p === "chispas") parts.push({ t: p, x: cx + (Math.random() - .5) * rx * 2, y: cy + ry * .6, vx: (Math.random() - .5) * 20, vy: -40 - Math.random() * 70, l: 1, d: .7 + Math.random() * .6, r: 1.5 + Math.random() * 2.5 });
  if (p === "gotas") parts.push({ t: p, x: cx + (Math.random() - .5) * rx * 1.6, y: cy - ry * .5 + Math.random() * ry * .5, vx: 0, vy: 50 + Math.random() * 60, l: 1, d: 1.3, r: 1.5 + Math.random() * 2 });
  if (p === "aros") parts.push({ t: p, x: cx, y: cy, vx: 0, vy: 0, l: 1, d: 2.4, r: rx * .9, grow: 38 + Math.random() * 20 });
  if (p === "rayos") { const r0 = Math.max(rx, ry) * 1.02; parts.push({ t: p, x: cx + Math.cos(a) * r0, y: cy + Math.sin(a) * r0 * .95, vx: Math.cos(a), vy: Math.sin(a), l: 1, d: .28 + Math.random() * .2, r: 18 + Math.random() * 40 }); }
}
function drawParts(dt, rgb) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const q = parts[i]; q.l -= dt / q.d; if (q.l <= 0) { parts.splice(i, 1); continue; }
    ctx.strokeStyle = ctx.fillStyle = `rgba(${rgb},${Math.min(1, q.l)})`;
    if (q.t === "chispas") { q.x += q.vx * dt; q.y += q.vy * dt; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 6.3); ctx.fill(); }
    else if (q.t === "gotas") { q.y += q.vy * dt; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(q.x, q.y - q.r * 3); ctx.lineTo(q.x, q.y); ctx.stroke(); }
    else if (q.t === "aros") { q.r += q.grow * dt; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(q.x, q.y, q.r, q.r * 1.2, 0, 0, 6.3); ctx.stroke(); }
    else if (q.t === "rayos") { ctx.lineWidth = 2; ctx.beginPath(); let x = q.x, y = q.y; ctx.moveTo(x, y); for (let k = 0; k < 4; k++) { x += q.vx * q.r / 4 + (Math.random() - .5) * 10; y += q.vy * q.r / 4 + (Math.random() - .5) * 10; ctx.lineTo(x, y); } ctx.stroke(); }
  }
}

let lastT = performance.now(), partAcc = 0, scanY = 0, hudT = 0;
function loop() {
  requestAnimationFrame(loop);
  const now = performance.now(), dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
  const vw = cam.videoWidth, vh = cam.videoHeight; if (!vw) return;
  if (cam.currentTime !== lastVT && landmarker) {
    lastVT = cam.currentTime;
    try {
      const r = landmarker.detectForVideo(cam, now);
      if (r.faceLandmarks && r.faceLandmarks.length) {
        lms = r.faceLandmarks[0]; faceSeen = now;
        if (!window.__hyp.freeze && r.faceBlendshapes && r.faceBlendshapes[0]) { readBlend(r.faceBlendshapes[0].categories); metrics(); classify(now); }
      } else lms = null;
    } catch (e) { console.warn(e); }
  }
  const hasFace = !!lms && now - faceSeen < 400;
  aviso.classList.toggle("hide", hasFace);
  if (!hasFace && emo !== "neutro" && now - faceSeen > 5000 && now > manualUntil) setEmo("neutro");

  const e = EMO[emo], rgb = e.rgb;
  const s = Math.max(W / vw, H / vh), ox = (W - vw * s) / 2, oy = (H - vh * s) / 2;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
  ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1);
  ctx.drawImage(cam, ox, oy, vw * s, vh * s);
  // tinte según emoción
  ctx.fillStyle = `rgba(${rgb},${emo === "neutro" ? .05 : .13})`; ctx.fillRect(0, 0, W, H);

  if (hasFace) {
    const P = lms.map((l) => map(l, vw, vh, s, ox, oy));
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const q of P) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2, ry = (y1 - y0) / 2;
    const pulse = emo === "estres" ? .55 + .45 * Math.sin(now / 90) : 1;
    // malla
    ctx.lineWidth = 0.6; ctx.strokeStyle = `rgba(${rgb},${.22 * pulse + .08})`; ctx.beginPath();
    for (const c of TESS) { const a = P[c.start], b = P[c.end]; ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
    ctx.stroke();
    // contorno
    ctx.lineWidth = 2; ctx.strokeStyle = `rgba(${rgb},${.9 * pulse})`; ctx.shadowColor = `rgb(${rgb})`; ctx.shadowBlur = 12; ctx.beginPath();
    for (const c of OVAL) { const a = P[c.start], b = P[c.end]; ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
    ctx.stroke(); ctx.shadowBlur = 0;
    // nodos hexagonales
    const hr = Math.max(3, rx * .035);
    ctx.fillStyle = `rgba(${rgb},.95)`;
    for (const i of NODOS) { const [x, y] = P[i]; ctx.beginPath(); for (let k = 0; k < 6; k++) { const an = k * Math.PI / 3 + Math.PI / 6; ctx.lineTo(x + Math.cos(an) * hr, y + Math.sin(an) * hr); } ctx.closePath(); ctx.fill(); }
    // línea de escaneo
    if (emo === "neutro") {
      scanY = (scanY + dt * .5) % 1; const yy = y0 + (y1 - y0) * scanY;
      const gr = ctx.createLinearGradient(0, yy - 26, 0, yy + 2); gr.addColorStop(0, "rgba(78,205,255,0)"); gr.addColorStop(1, "rgba(78,205,255,.55)");
      ctx.fillStyle = gr; ctx.fillRect(x0 - 10, yy - 26, x1 - x0 + 20, 28);
      ctx.fillStyle = "rgba(78,205,255,.95)"; ctx.fillRect(x0 - 10, yy, x1 - x0 + 20, 1.5);
    }
    // esquinas de encuadre
    const m = 14, L = 22; ctx.lineWidth = 2; ctx.strokeStyle = `rgba(${rgb},.9)`; ctx.beginPath();
    [[x0 - m, y0 - m, 1, 1], [x1 + m, y0 - m, -1, 1], [x0 - m, y1 + m, 1, -1], [x1 + m, y1 + m, -1, -1]].forEach(([x, y, dx, dy]) => { ctx.moveTo(x, y + dy * L); ctx.lineTo(x, y); ctx.lineTo(x + dx * L, y); });
    ctx.stroke();
    // partículas
    partAcc += dt; const rate = emo === "estres" ? .03 : emo === "aros" ? .7 : emo === "calma" ? .8 : .06;
    while (partAcc > rate) { partAcc -= rate; spawn(e, [cx, cy, rx, ry]); }
  }
  drawParts(dt, rgb);
  ctx.restore();
  // BPM vivo
  if (e.bpm && now - hudT > 700) { hudT = now; $("#h-bpm").textContent = (e.bpm + Math.round((Math.random() - .5) * 4)) + " BPM"; }
}

/* ───────── Foto ───────── */
function foto() {
  const out = document.createElement("canvas"); out.width = cv.width; out.height = cv.height; const o = out.getContext("2d");
  o.drawImage(cv, 0, 0);
  const e = EMO[emo], sc = out.width / 390;
  const gr = o.createLinearGradient(0, out.height - 150 * sc, 0, out.height); gr.addColorStop(0, "rgba(16,17,20,0)"); gr.addColorStop(1, "rgba(16,17,20,.85)");
  o.fillStyle = gr; o.fillRect(0, out.height - 150 * sc, out.width, 150 * sc);
  o.fillStyle = `rgb(${e.rgb})`; o.font = `700 ${22 * sc}px Outfit, sans-serif`; o.fillText("HYPNODE · DREAM SCAN", 18 * sc, out.height - 56 * sc);
  o.fillStyle = "#fff"; o.font = `400 ${12 * sc}px "Space Mono", monospace`;
  o.fillText(`${e.tag.replace("ESTADO · ", "")} · ${e.titulo}`, 18 * sc, out.height - 34 * sc);
  o.fillStyle = "#C9CDD6"; o.font = `400 ${10 * sc}px "Space Mono", monospace`; o.fillText(`REM ${e.rem}  ·  LUZ ${e.luz}`, 18 * sc, out.height - 16 * sc);
  $("#flash").classList.remove("go"); void $("#flash").offsetWidth; $("#flash").classList.add("go");
  out.toBlob((b) => { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `hypnode-dreamscan-${emo}.png`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, "image/png");
}
