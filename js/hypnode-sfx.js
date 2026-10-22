// Hypnode — sonidos UX sintetizados con Web Audio (sin archivos de audio).
// playSfx('luz' | 'sonido' | 'forma' | 'modelo' | 'cerrar')

let ctx = null;
let master = null;

function tone(ctx, out, { type = 'sine', f, f2, t, a = 0.005, d = 0.2, peak = 0.3 }) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + a + d + 0.05);
}

function click(ctx, out, t, freq, dur, peak) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = 1;
    const g = ctx.createGain();
    g.gain.value = peak;
    src.connect(bp).connect(g).connect(out);
    src.start(t);
}

export const SFX = {
    // LUZ: arpegio ascendente brillante, como un destello
    luz(ctx, out) {
        const t = ctx.currentTime + 0.01;
        [659.25, 880, 1318.5].forEach((f, i) => tone(ctx, out, { f, t: t + i * 0.07, d: 0.3, peak: 0.22 }));
        tone(ctx, out, { type: 'triangle', f: 2637, t: t + 0.2, d: 0.25, peak: 0.07 });
    },

    // SONIDO: dos notas suaves con eco
    sonido(ctx, out) {
        const t = ctx.currentTime + 0.01;
        const dry = ctx.createGain();
        const delay = ctx.createDelay();
        const fb = ctx.createGain();
        delay.delayTime.value = 0.13;
        fb.gain.value = 0.35;
        dry.connect(out);
        dry.connect(delay);
        delay.connect(fb).connect(delay);
        delay.connect(out);
        tone(ctx, dry, { f: 523.25, f2: 535, t, d: 0.3, peak: 0.25 });
        tone(ctx, dry, { f: 783.99, f2: 800, t: t + 0.09, d: 0.4, peak: 0.22 });
    },

    // FORMA: clic mecánico seco + golpe grave + resonancia metálica
    forma(ctx, out) {
        const t = ctx.currentTime + 0.01;
        click(ctx, out, t, 2500, 0.03, 0.5);
        tone(ctx, out, { f: 220, f2: 90, t, d: 0.12, peak: 0.35 });
        tone(ctx, out, { type: 'triangle', f: 1760, t: t + 0.02, d: 0.18, peak: 0.07 });
        tone(ctx, out, { type: 'triangle', f: 2349, t: t + 0.02, d: 0.14, peak: 0.04 });
    },

    // MODELO: barrido grave que "enciende" el dispositivo + destello final
    modelo(ctx, out) {
        const t = ctx.currentTime + 0.01;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, t);
        filter.frequency.exponentialRampToValueAtTime(2500, t + 0.5);
        filter.connect(out);
        tone(ctx, filter, { type: 'sawtooth', f: 110, f2: 330, t, a: 0.05, d: 0.55, peak: 0.16 });
        tone(ctx, out, { f: 55, f2: 110, t, a: 0.03, d: 0.6, peak: 0.3 });
        tone(ctx, out, { f: 1760, t: t + 0.35, d: 0.4, peak: 0.07 });
        tone(ctx, out, { f: 2349, t: t + 0.42, d: 0.35, peak: 0.05 });
    },

    // FILTRO: barrido ascendente tipo escáner al abrir el filtro facial
    filtro(ctx, out) {
        const t = ctx.currentTime + 0.01;
        tone(ctx, out, { f: 400, f2: 1600, t, a: 0.02, d: 0.35, peak: 0.14 });
        tone(ctx, out, { type: 'triangle', f: 1200, f2: 2400, t: t + 0.15, d: 0.22, peak: 0.07 });
        click(ctx, out, t + 0.3, 3500, 0.025, 0.25);
    },

    // EMOCIÓN: secuencia de notas configurable (cada estado emocional tiene la suya)
    emocion(ctx, out, o = {}) {
        const t = ctx.currentTime + 0.01;
        const { notes = [523.25], step = 0.06, type = 'sine', a = 0.005, d = 0.3, peak = 0.2 } = o;
        notes.forEach((f, i) => tone(ctx, out, { type, f, t: t + i * step, a, d, peak }));
    },

    // CERRAR: blip descendente suave
    cerrar(ctx, out) {
        const t = ctx.currentTime + 0.01;
        tone(ctx, out, { f: 700, f2: 420, t, d: 0.1, peak: 0.15 });
    }
};

// El AudioContext debe crearse/reanudarse dentro de un gesto del usuario (toque o clic).
export function playSfx(name, opts) {
    try {
        if (!ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            ctx = new AC();
            master = ctx.createGain();
            master.gain.value = 0.8;
            const comp = ctx.createDynamicsCompressor();
            master.connect(comp).connect(ctx.destination);
        }
        if (ctx.state === 'suspended') ctx.resume();
        SFX[name]?.(ctx, master, opts);
    } catch (e) {
        console.warn('hypnode-sfx:', e);
    }
}
