// Hypnode — sonidos UX sintetizados con Web Audio (sin archivos de audio).
// playSfx('luz' | 'sonido' | 'forma' | 'modelo' | 'cerrar' | 'inicio' | 'detectado' | 'click' | 'atras')

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
    // LUZ: destello ascendente brillante con chisporroteo final
    luz(ctx, out) {
        const t = ctx.currentTime + 0.01;
        tone(ctx, out, { type: 'sawtooth', f: 300, f2: 2400, t, a: 0.01, d: 0.28, peak: 0.07 });
        [659.25, 880, 1318.5, 1760, 2637].forEach((f, i) => tone(ctx, out, { f, t: t + 0.05 + i * 0.06, d: 0.4, peak: 0.3 }));
        click(ctx, out, t + 0.02, 5000, 0.05, 0.35);
        [3520, 4186, 3136].forEach((f, i) => tone(ctx, out, { type: 'triangle', f, t: t + 0.35 + i * 0.04, d: 0.12, peak: 0.08 }));
    },

    // SONIDO: onda con vibrato + dos notas con eco largo
    sonido(ctx, out) {
        const t = ctx.currentTime + 0.01;
        const dry = ctx.createGain();
        const delay = ctx.createDelay();
        const fb = ctx.createGain();
        delay.delayTime.value = 0.16;
        fb.gain.value = 0.45;
        dry.connect(out);
        dry.connect(delay);
        delay.connect(fb).connect(delay);
        delay.connect(out);
        const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = 440;
        lfo.frequency.value = 9; lg.gain.value = 14;
        lfo.connect(lg).connect(o.frequency);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.3, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        o.connect(g).connect(dry);
        o.start(t); lfo.start(t); o.stop(t + 0.6); lfo.stop(t + 0.6);
        tone(ctx, dry, { f: 523.25, t: t + 0.04, d: 0.5, peak: 0.28 });
        tone(ctx, dry, { f: 783.99, f2: 800, t: t + 0.14, d: 0.6, peak: 0.26 });
        tone(ctx, dry, { f: 1046.5, t: t + 0.26, d: 0.6, peak: 0.16 });
    },

    // FORMA: clic mecánico + golpe grave + resonancia metálica de cristal
    forma(ctx, out) {
        const t = ctx.currentTime + 0.01;
        click(ctx, out, t, 2500, 0.04, 0.7);
        tone(ctx, out, { f: 200, f2: 55, t, d: 0.2, peak: 0.6 });
        [1760, 2349, 2960, 3520].forEach((f, i) => tone(ctx, out, { type: 'triangle', f, t: t + 0.03 + i * 0.045, d: 0.3, peak: 0.12 }));
        click(ctx, out, t + 0.2, 3500, 0.025, 0.3);
    },

    // INICIO: arranque del dispositivo (barrido grave + acorde de nodos)
    inicio(ctx, out) {
        const t = ctx.currentTime + 0.01;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(200, t);
        f.frequency.exponentialRampToValueAtTime(3000, t + 0.6);
        f.connect(out);
        tone(ctx, f, { type: 'sawtooth', f: 82, f2: 246, t, a: 0.05, d: 0.7, peak: 0.2 });
        [392, 523.25, 659.25, 783.99, 1046.5].forEach((fr, i) => tone(ctx, out, { f: fr, t: t + 0.25 + i * 0.07, d: 0.45, peak: 0.2 }));
    },

    // DETECTADO: la tarjeta fue reconocida (dos pings ascendentes)
    detectado(ctx, out) {
        const t = ctx.currentTime + 0.01;
        tone(ctx, out, { f: 880, t, d: 0.14, peak: 0.22 });
        tone(ctx, out, { f: 1318.5, t: t + 0.09, d: 0.3, peak: 0.24 });
        click(ctx, out, t, 4000, 0.02, 0.2);
    },

    // CLIC genérico de botón
    click(ctx, out) {
        const t = ctx.currentTime + 0.01;
        tone(ctx, out, { type: 'triangle', f: 880, f2: 1320, t, d: 0.09, peak: 0.25 });
        click(ctx, out, t, 3000, 0.02, 0.25);
    },

    // ATRÁS / volver
    atras(ctx, out) {
        const t = ctx.currentTime + 0.01;
        tone(ctx, out, { type: 'triangle', f: 700, f2: 400, t, d: 0.12, peak: 0.22 });
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
            master.gain.value = 1;
            const comp = ctx.createDynamicsCompressor();
            master.connect(comp).connect(ctx.destination);
        }
        if (ctx.state === 'suspended') ctx.resume();
        SFX[name]?.(ctx, master, opts);
    } catch (e) {
        console.warn('hypnode-sfx:', e);
    }
}
