// Hypnode — filtro facial "Dream Scan".
// Se abre desde el botón FILTRO FACIAL (hypnode-ui.js): pausa el modo tarjeta,
// activa la cámara frontal con MindAR Face y dibuja la malla + hexágonos sobre el rostro.
// Al cerrar, vuelve al modo tarjeta.

import * as THREE from 'three';
import { playSfx } from './hypnode-sfx.js';
import { toast, hideToast } from './hypnode-ui.js';

const FACE_MODULE = 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-face-three.prod.js';

// ---------- Estados emocionales ----------
const EMOCIONES = {
    feliz: {
        nombre: 'FELIZ', color: '#FFD166', rgb: '255,209,102', bpm: 88,
        titulo: 'SUEÑO VÍVIDO', rem: 'ALTA ACTIVIDAD', output: 'ÁMBAR CÁLIDO',
        pulso: 'agudo',
        sfx: { notes: [523.25, 659.25, 783.99, 1046.5], step: 0.06, d: 0.3, peak: 0.2 }
    },
    triste: {
        nombre: 'TRISTE', color: '#4A90D9', rgb: '74,144,217', bpm: 42,
        titulo: 'SUEÑO LENTO', rem: 'ACTIVIDAD BAJA', output: 'AZUL PROFUNDO',
        pulso: 'suave',
        sfx: { notes: [440, 349.23, 293.66], step: 0.14, a: 0.02, d: 0.5, peak: 0.2 }
    },
    estresado: {
        nombre: 'ESTRESADO', color: '#FF6B6B', rgb: '255,107,107', bpm: 120,
        titulo: 'SEÑAL IRREGULAR', rem: 'FRAGMENTADO', output: 'ROJO ALERTA',
        pulso: 'agudo', irregular: true,
        sfx: { notes: [466.16, 493.88, 466.16, 493.88, 523.25], step: 0.045, type: 'square', d: 0.07, peak: 0.07 }
    },
    tranquilo: {
        nombre: 'TRANQUILO', color: '#7FFFD4', rgb: '127,255,212', bpm: 28,
        titulo: 'ONDAS DELTA', rem: 'ESTABLE', output: 'VERDE MENTA',
        pulso: 'suave',
        sfx: { notes: [261.63, 392, 523.25], step: 0, a: 0.12, d: 0.9, peak: 0.14 }
    }
};
const ORDEN = ['feliz', 'triste', 'estresado', 'tranquilo'];

// ---------- Malla: puntos del modelo facial de MediaPipe (468 landmarks) ----------
const NODOS = [10, 67, 297, 9, 116, 345, 133, 362, 6, 205, 425, 98, 327, 2, 61, 291, 152, 172, 397];
const ARISTAS = [
    [10, 67], [10, 297], [67, 9], [297, 9], [67, 116], [297, 345],
    [9, 133], [9, 362], [133, 6], [362, 6], [116, 133], [345, 362],
    [133, 205], [362, 425], [116, 205], [345, 425], [133, 98], [362, 327],
    [6, 98], [6, 327], [205, 98], [425, 327], [98, 2], [327, 2],
    [205, 61], [425, 291], [2, 61], [2, 291], [61, 152], [291, 152], [2, 152],
    [205, 172], [425, 397], [172, 152], [397, 152]
];
const IDX = Object.fromEntries(NODOS.map((n, i) => [n, i]));

// Hexágonos flotantes: posición relativa al centro del rostro y radio, en unidades del ancho facial.
const HEXAGONOS = [
    { x: -0.81, y: 0.29, r: 0.10 }, { x: 0.85, y: 0.33, r: 0.10 },
    { x: -0.88, y: -0.61, r: 0.075 }, { x: 0.87, y: -0.60, r: 0.075 },
    { x: -0.52, y: -1.10, r: 0.065 }, { x: 0.49, y: -1.08, r: 0.065 }
];

const MSG_CARGANDO = '// CARGANDO FILTRO…';
const MSG_ROSTRO = '// MUESTRA TU ROSTRO A LA CÁMARA';

let abierto = false;
let cssAdded = false;

function addCss() {
    if (cssAdded) return;
    cssAdded = true;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('../css/hypnode-filter.css', import.meta.url).href;
    document.head.appendChild(link);
}

function glowTexture(core) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(core, 'rgba(255,255,255,1)');
    gr.addColorStop(Math.min(core + 0.18, 0.95), 'rgba(255,255,255,0.3)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

function buildDom() {
    const root = document.createElement('div');
    root.id = 'hf-root';
    root.innerHTML = `
        <div id="hf-cam"></div>
        <div id="hf-glow"></div>
        <div id="hf-vignette"></div>
        <div id="hf-ui">
            <div id="hf-top">
                <div id="hf-info"><div></div><div></div><div></div></div>
                <button id="hf-close" aria-label="Cerrar filtro" disabled>
                    <svg viewBox="0 0 24 24"><path d="M5 5 L19 19 M19 5 L5 19"/></svg>
                </button>
            </div>
            <div id="hf-hint"></div>
            <div id="hf-bottom">
                <div id="hf-mark">
                    <svg viewBox="0 0 24 24"><polygon points="12,3 21,10 17.5,21 6.5,21 3,10"/></svg>
                    <span>HYPNODE</span>
                </div>
                <div id="hf-panel">
                    <div id="hf-label">// ESTADO EMOCIONAL DETECTADO</div>
                    <div id="hf-grid">
                        ${ORDEN.map((k) => `<button data-emo="${k}">${EMOCIONES[k].nombre}</button>`).join('')}
                    </div>
                </div>
            </div>
        </div>`;
    document.body.appendChild(root);
    return root;
}

export async function openFilter() {
    if (abierto) return;
    abierto = true;
    addCss();

    const mc = window.mindarController;
    window.dispatchEvent(new CustomEvent('hypnode:filter-open'));

    const root = buildDom();
    const camEl = root.querySelector('#hf-cam');
    const infoEl = root.querySelector('#hf-info');
    const hintEl = root.querySelector('#hf-hint');
    const closeBtn = root.querySelector('#hf-close');
    const emoButtons = root.querySelectorAll('#hf-grid button');

    // Oculta lo del modo tarjeta mientras dura el filtro.
    const logEl = document.getElementById('log');
    const logDisplay = logEl ? logEl.style.display : '';
    if (logEl) logEl.style.display = 'none';
    const arContainer = document.getElementById('ar-container');
    if (arContainer) arContainer.style.display = 'none';

    // Libera la cámara trasera del modo tarjeta (y su contexto WebGL).
    const oldRenderer = mc?.mindar?.renderer;
    try { mc?.stop(); } catch (e) { console.warn('hypnode-filter: stop AR', e); }
    try { oldRenderer?.dispose(); oldRenderer?.forceContextLoss?.(); } catch (e) { /* noop */ }

    setHint(MSG_CARGANDO);

    let face = null;
    let disposables = [];
    let cerrando = false;

    function setHint(text) {
        hintEl.textContent = text || '';
        hintEl.classList.toggle('on', !!text);
    }

    // ---------- Emoción activa ----------
    let emo = EMOCIONES.feliz;
    const colorActual = new THREE.Color(emo.color);
    const colorObjetivo = new THREE.Color(emo.color);

    function setEmocion(key, sonar) {
        emo = EMOCIONES[key];
        colorObjetivo.set(emo.color);
        root.style.setProperty('--emo', emo.color);
        root.style.setProperty('--emo-rgb', emo.rgb);
        root.style.setProperty('--bpm', emo.bpm);
        emoButtons.forEach((b) => b.classList.toggle('active', b.dataset.emo === key));
        infoEl.children[0].textContent = `DREAM SCAN — ${emo.titulo}`;
        infoEl.children[1].textContent = `REM: ${emo.rem} / ${emo.bpm} BPM /`;
        infoEl.children[2].textContent = `OUTPUT: ${emo.output}`;
        infoEl.classList.remove('swap');
        void infoEl.offsetWidth; // reinicia la animación
        infoEl.classList.add('swap');
        if (sonar) playSfx('emocion', emo.sfx);
    }
    setEmocion('feliz', false);
    emoButtons.forEach((b) => b.addEventListener('click', () => setEmocion(b.dataset.emo, true)));

    // ---------- Cierre ----------
    async function cerrar() {
        if (cerrando) return;
        cerrando = true;
        playSfx('cerrar');

        try { face?.renderer?.setAnimationLoop(null); } catch (e) { /* noop */ }
        try { face?.stop(); } catch (e) { console.warn('hypnode-filter: stop face', e); }
        disposables.forEach((d) => { try { d.dispose(); } catch (e) { /* noop */ } });
        try { face?.renderer?.dispose(); face?.renderer?.forceContextLoss?.(); } catch (e) { /* noop */ }

        root.remove();
        if (logEl) logEl.style.display = logDisplay;
        if (arContainer) arContainer.style.display = '';

        toast('Reiniciando cámara…', 0);
        try {
            await mc.start();
            hideToast();
        } catch (e) {
            console.error('hypnode-filter: no se pudo reiniciar el modo tarjeta', e);
            toast('No se pudo reiniciar la cámara AR. Recarga la página.', 5000);
        }
        abierto = false;
        window.dispatchEvent(new CustomEvent('hypnode:filter-close'));
    }
    closeBtn.addEventListener('click', cerrar);

    // ---------- Arranque de MindAR Face ----------
    let ok = false;
    try {
        const { MindARThree } = await import(FACE_MODULE);

        // MindAR deja un listener de resize que falla tras stop(); lo neutralizamos.
        class SafeFace extends MindARThree {
            _resize() { if (!this._dead) super._resize(); }
            stop() {
                this._dead = true;
                try { super.stop(); } catch (e) { try { this.video?.remove(); } catch (e2) { /* noop */ } }
            }
        }

        face = new SafeFace({ container: camEl, uiLoading: 'no', uiScanning: 'no', uiError: 'no' });
        const anchors = NODOS.map((n) => face.addAnchor(n));
        anchors.forEach((a) => { a.group.visible = false; });

        // ----- Contenido 3D (se dibuja en las mismas coordenadas de cámara que los anchors) -----
        const world = new THREE.Group();
        world.visible = false;
        face.scene.add(world);

        const dotTex = glowTexture(0.22);
        const haloTex = glowTexture(0.0);
        disposables.push(dotTex, haloTex);

        // Líneas
        const lineGeo = new THREE.BufferGeometry();
        const linePos = new Float32Array(ARISTAS.length * 2 * 3);
        lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3).setUsage(THREE.DynamicDrawUsage));
        const lineMat = new THREE.LineBasicMaterial({ color: emo.color, transparent: true, opacity: 0.9, depthTest: false });
        const lines = new THREE.LineSegments(lineGeo, lineMat);
        lines.frustumCulled = false;
        lines.renderOrder = 10;
        world.add(lines);
        disposables.push(lineGeo, lineMat);

        // Nodos
        const nodeMat = new THREE.SpriteMaterial({
            map: dotTex, color: emo.color, transparent: true, depthTest: false, blending: THREE.AdditiveBlending
        });
        disposables.push(nodeMat);
        const nodeSprites = NODOS.map(() => {
            const s = new THREE.Sprite(nodeMat);
            s.renderOrder = 11;
            world.add(s);
            return s;
        });

        // Hexágonos flotantes
        const ringGeo = new THREE.RingGeometry(0.82, 1, 6);
        const fillGeo = new THREE.CircleGeometry(0.58, 6);
        disposables.push(ringGeo, fillGeo);
        const hexes = HEXAGONOS.map((spec) => {
            const group = new THREE.Group();
            const ringMat = new THREE.MeshBasicMaterial({ color: emo.color, transparent: true, depthTest: false, side: THREE.DoubleSide });
            const fillMat = new THREE.MeshBasicMaterial({ color: emo.color, transparent: true, opacity: 0.5, depthTest: false, side: THREE.DoubleSide });
            const haloMat = new THREE.SpriteMaterial({
                map: haloTex, color: emo.color, transparent: true, depthTest: false, blending: THREE.AdditiveBlending
            });
            disposables.push(ringMat, fillMat, haloMat);
            const ring = new THREE.Mesh(ringGeo, ringMat);
            const fill = new THREE.Mesh(fillGeo, fillMat);
            const halo = new THREE.Sprite(haloMat);
            halo.scale.setScalar(3.4);
            ring.renderOrder = 9; fill.renderOrder = 9; halo.renderOrder = 8;
            group.add(halo, ring, fill);
            world.add(group);
            return { spec, group, ringMat, fillMat, haloMat };
        });

        // ----- Bucle de dibujo -----
        const pos = NODOS.map(() => new THREE.Vector3());
        let hadFace = false;

        // Zona visible: el video se recorta (cover) y el panel inferior tapa una parte;
        // los hexágonos se mantienen dentro para que nunca queden fuera de pantalla.
        let panelFrac = 0;
        const bottomEl = root.querySelector('#hf-bottom');
        function medirPanel() {
            panelFrac = bottomEl.offsetHeight / Math.max(1, root.clientHeight);
        }
        window.addEventListener('resize', medirPanel);
        disposables.push({ dispose: () => window.removeEventListener('resize', medirPanel) });

        function zonaVisible(z) {
            const camAspect = face.camera.aspect;
            const contAspect = camEl.clientWidth / Math.max(1, camEl.clientHeight);
            const k = Math.abs(z) * Math.tan(THREE.MathUtils.degToRad(face.camera.fov) / 2);
            const wide = contAspect >= camAspect;
            const halfH = k * (wide ? camAspect / contAspect : 1);
            const halfW = k * (wide ? camAspect : contAspect);
            return { halfW, halfH };
        }

        function pulso(t) {
            let tt = t;
            if (emo.irregular) tt += 0.12 * Math.sin(t * 3.7) + 0.06 * Math.sin(t * 9.1);
            const fase = (tt * emo.bpm / 60) % 1;
            const f = fase < 0 ? fase + 1 : fase;
            if (emo.pulso === 'suave') return 0.5 + 0.5 * Math.sin(f * Math.PI * 2 - Math.PI / 2);
            return Math.exp(-5 * f);
        }

        function tick() {
            const t = performance.now() / 1000;
            const hasFace = anchors[0].group.visible;

            if (hasFace !== hadFace) {
                hadFace = hasFace;
                world.visible = hasFace;
                setHint(hasFace ? null : MSG_ROSTRO);
            }

            colorActual.lerp(colorObjetivo, 0.12);

            if (hasFace) {
                for (let i = 0; i < anchors.length; i++) {
                    const e = anchors[i].group.matrix.elements;
                    pos[i].set(e[12], e[13], e[14]);
                }

                const pTop = pos[IDX[10]], pChin = pos[IDX[152]];
                const pL = pos[IDX[116]], pR = pos[IDX[345]];
                const w = pL.distanceTo(pR);

                if (w > 1e-3) {
                    // líneas
                    ARISTAS.forEach(([a, b], i) => {
                        const pa = pos[IDX[a]], pb = pos[IDX[b]];
                        linePos.set([pa.x, pa.y, pa.z, pb.x, pb.y, pb.z], i * 6);
                    });
                    lineGeo.attributes.position.needsUpdate = true;

                    const p = pulso(t);

                    nodeSprites.forEach((s, i) => {
                        s.position.copy(pos[i]);
                        s.scale.setScalar(w * 0.075 * (1 + 0.3 * p));
                    });

                    // hexágonos alrededor de la cabeza (siguen la inclinación del rostro)
                    const cx = (pTop.x + pChin.x) / 2, cy = (pTop.y + pChin.y) / 2, cz = (pTop.z + pChin.z) / 2;
                    const roll = Math.atan2(pR.y - pL.y, pR.x - pL.x);
                    const cr = Math.cos(roll), sr = Math.sin(roll);

                    const { halfW, halfH } = zonaVisible(cz);
                    const yMin = -halfH + 2 * halfH * panelFrac;

                    hexes.forEach((h, i) => {
                        const dx = h.spec.x * w;
                        const dy = h.spec.y * w + Math.sin(t * 1.1 + i * 1.3) * 0.04 * w;
                        const r = h.spec.r * w * 1.35;
                        const hx = THREE.MathUtils.clamp(cx + dx * cr - dy * sr, -halfW + r, halfW - r);
                        const hy = Math.max(cy + dx * sr + dy * cr, yMin + r);
                        h.group.position.set(hx, hy, cz);
                        h.group.rotation.z = roll + Math.PI / 6;
                        h.group.scale.setScalar(h.spec.r * w * (1 + 0.12 * p));
                        h.ringMat.opacity = 0.85;
                        h.fillMat.opacity = 0.3 + 0.5 * p;
                        h.haloMat.opacity = 0.18 + 0.5 * p;
                    });
                }
            }

            lineMat.color.copy(colorActual);
            nodeMat.color.copy(colorActual);
            hexes.forEach((h) => {
                h.ringMat.color.copy(colorActual);
                h.fillMat.color.copy(colorActual);
                h.haloMat.color.copy(colorActual);
            });

            face.renderer.render(face.scene, face.camera);
        }

        await face.start();
        medirPanel();
        face.renderer.setAnimationLoop(tick);
        setHint(MSG_ROSTRO);
        closeBtn.disabled = false;
        ok = true;
    } catch (e) {
        console.error('Filtro facial:', e);
    }

    if (!ok) {
        toast('No se pudo abrir el filtro. Revisa el permiso de cámara y la conexión.', 4500);
        await cerrar();
    }
}
