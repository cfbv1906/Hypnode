// Hypnode — botones LUZ / SONIDO / FORMA sobre la realidad aumentada.
// Se muestran cuando MindAR detecta la tarjeta y se ocultan cuando se pierde.
// Uso: <script type="module" src="js/hypnode-ui.js"></script> en index.html

import { playSfx } from './hypnode-sfx.js';

const INFO = {
    luz: {
        titulo: 'LUZ',
        texto: 'Al detectar tu fase REM, el núcleo convierte cada sueño en un pulso de luz. Su color e intensidad cambian con la emoción que soñaste.',
        icono: `
            <svg class="hy-ico hy-luz" viewBox="0 0 64 64">
                <path class="bolt" pathLength="100" d="M36 4 L16 34 H30 L24 60 L48 26 H34 L44 4 Z"/>
                <circle class="node" cx="36" cy="4" r="2.5"/><circle class="node" cx="16" cy="34" r="2.5"/>
                <circle class="node" cx="24" cy="60" r="2.5"/><circle class="node" cx="48" cy="26" r="2.5"/>
                <circle class="node" cx="44" cy="4" r="2.5"/>
            </svg>`
    },
    sonido: {
        titulo: 'SONIDO',
        texto: 'Las ondas de tu sueño se transforman en un paisaje sonoro único. El ritmo sigue tu pulso y se calma poco a poco mientras despiertas.',
        icono: `
            <svg class="hy-ico hy-sonido" viewBox="0 0 64 64">
                <path class="wave wave2" d="M2 32 Q9 4 16 32 T30 32 T44 32 T58 32"/>
                <path class="wave" d="M2 32 Q9 12 16 32 T30 32 T44 32 T58 32"/>
                <circle class="node" cx="2" cy="32" r="2.5"/><circle class="node" cx="30" cy="32" r="2.5"/>
                <circle class="node" cx="58" cy="32" r="2.5"/>
            </svg>`
    },
    forma: {
        titulo: 'FORMA',
        texto: 'La estructura del sueño se materializa en geometría. Cada faceta del dispositivo representa un fragmento de lo que viviste mientras dormías.',
        icono: `
            <svg class="hy-ico hy-forma" viewBox="0 0 64 64">
                <polygon points="30,6 57,22 47,55 16,52 7,24"/>
                <polygon class="inner" points="30,6 57,22 47,55 16,52 7,24"/>
                <circle class="node" cx="30" cy="6" r="2.5"/><circle class="node" cx="57" cy="22" r="2.5"/>
                <circle class="node" cx="47" cy="55" r="2.5"/><circle class="node" cx="16" cy="52" r="2.5"/>
                <circle class="node" cx="7" cy="24" r="2.5"/>
            </svg>`
    }
};

const HIDE_DELAY = 1200; // tolera pérdidas breves del tracking

let ui, panel, iconBox, titleEl, textEl, buttons, topEl, filterBtn, toastEl, toastTimer;
let current = null;      // modo abierto
let typeTimer = null;
let hideTimer = null;

function addAsset(tag, attrs) {
    const el = document.createElement(tag);
    Object.assign(el, attrs);
    document.head.appendChild(el);
}

function build() {
    addAsset('link', { rel: 'stylesheet', href: new URL('../css/hypnode-ui.css', import.meta.url).href });
    addAsset('link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap' });

    ui = document.createElement('div');
    ui.id = 'hy-ui';
    ui.innerHTML = `
        <div id="hy-panel">
            <div id="hy-icon"></div>
            <div>
                <h3 id="hy-title"></h3>
                <p id="hy-text"></p>
            </div>
        </div>
        <div id="hy-buttons">
            <button data-modo="luz">LUZ</button>
            <button data-modo="sonido">SONIDO</button>
            <button data-modo="forma">FORMA</button>
        </div>`;
    document.body.appendChild(ui);

    panel = ui.querySelector('#hy-panel');
    iconBox = ui.querySelector('#hy-icon');
    titleEl = ui.querySelector('#hy-title');
    textEl = ui.querySelector('#hy-text');
    buttons = ui.querySelectorAll('#hy-buttons button');

    buttons.forEach((btn) => {
        btn.addEventListener('click', () => toggle(btn.dataset.modo));
    });
    panel.addEventListener('click', () => { playSfx('cerrar'); closePanel(); });

    // Los toques sobre el UI no deben llegar al raycast del modelo 3D
    // (MindARController escucha pointerdown / touchstart en document).
    ['pointerdown', 'touchstart'].forEach((type) => {
        ui.addEventListener(type, (ev) => ev.stopPropagation());
    });

    // Botón superior: abre el filtro facial
    topEl = document.createElement('div');
    topEl.id = 'hy-top';
    topEl.innerHTML = `
        <button id="hy-filter-btn">
            <svg viewBox="0 0 24 24"><polygon points="12,2 20,6 19,15 12,22 5,15 4,6"/>
                <circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/></svg>
            FILTRO FACIAL
        </button>`;
    document.body.appendChild(topEl);
    ['pointerdown', 'touchstart'].forEach((type) => {
        topEl.addEventListener(type, (ev) => ev.stopPropagation());
    });
    filterBtn = topEl.querySelector('button');
    filterBtn.addEventListener('click', openFilterMode);

    toastEl = document.createElement('div');
    toastEl.id = 'hy-toast';
    document.body.appendChild(toastEl);
}

// Mensaje corto en pantalla (ms = 0 → se queda hasta hideToast()).
export function toast(msg, ms = 2600) {
    if (!toastEl) return;
    clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    if (ms > 0) toastTimer = setTimeout(hideToast, ms);
}

export function hideToast() {
    clearTimeout(toastTimer);
    toastEl?.classList.remove('on');
}

async function openFilterMode() {
    playSfx('filtro');
    filterBtn.disabled = true;
    try {
        const m = await import('./hypnode-filter.js');
        await m.openFilter();
    } catch (e) {
        console.error('hypnode-ui: no se pudo abrir el filtro', e);
        toast('No se pudo abrir el filtro facial.');
    } finally {
        filterBtn.disabled = false;
    }
}

function typeText(text) {
    clearInterval(typeTimer);
    textEl.classList.remove('done');
    textEl.textContent = '';
    let i = 0;
    typeTimer = setInterval(() => {
        textEl.textContent = text.slice(0, ++i);
        if (i >= text.length) {
            clearInterval(typeTimer);
            textEl.classList.add('done');
        }
    }, 18);
}

function toggle(modo) {
    if (current === modo) { playSfx('cerrar'); closePanel(); return; }
    current = modo;
    playSfx(modo);
    const info = INFO[modo];
    buttons.forEach((b) => b.classList.toggle('active', b.dataset.modo === modo));
    iconBox.innerHTML = info.icono;
    titleEl.textContent = info.titulo;
    typeText(info.texto);
    panel.classList.add('open');
}

function closePanel() {
    current = null;
    clearInterval(typeTimer);
    panel.classList.remove('open');
    buttons.forEach((b) => b.classList.remove('active'));
}

function show() {
    clearTimeout(hideTimer);
    ui.classList.add('visible');
}

function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
        ui.classList.remove('visible');
        closePanel();
    }, HIDE_DELAY);
}

// Sonido al tocar el modelo 3D. MindARController.onArClick busca un onClick en el
// objeto tocado o en sus padres, así que basta con ponerlo en ARContent.
let lastModelTap = 0;
function hookModelTap() {
    const targets = window.player?.imageTargets || [];
    targets.forEach((it) => {
        if (!it.arContent) return;
        it.arContent.onClick = () => {
            const now = performance.now();
            if (now - lastModelTap < 400) return;
            lastModelTap = now;
            playSfx('modelo');
        };
    });
}

// index.html crea window.mindarController al pulsar "Iniciar" (y uno nuevo si se reintenta).
// Esperamos a que exista y nos enganchamos a sus eventos found / lost.
let attached = null;
function watchController() {
    setInterval(() => {
        const mc = window.mindarController;
        if (mc && mc !== attached) {
            attached = mc;
            hookModelTap();
            mc.addListener('found', show);
            mc.addListener('lost', scheduleHide);
            mc.addListener('start', showTop);
            if (mc.started) showTop();
        }
    }, 300);
}

function showTop() {
    topEl.classList.add('visible');
}

// El filtro facial pausa el modo tarjeta: ocultamos botones y panel mientras está abierto.
window.addEventListener('hypnode:filter-open', () => {
    clearTimeout(hideTimer);
    ui.classList.remove('visible');
    closePanel();
    topEl.classList.remove('visible');
});
window.addEventListener('hypnode:filter-close', () => {
    if (attached?.started) showTop();
});

build();
watchController();
