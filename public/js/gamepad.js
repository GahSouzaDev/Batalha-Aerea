// gamepad.js — Suporte a controle Xbox
// Analógico esquerdo = movimento (simula as teclas W/A/S/D reais, então
// respeita qualquer remapeamento de teclado que o jogador já tenha feito).
// Analógico direito = câmera/mira. Gatilhos/ombreiras (LT/RT/LB/RB) = ataques.
// A = acelerador. Y = esc/pausa. Também dá pra navegar nos menus com o D-pad.

let gpConnected = false;
let gpIndex = null;
let gpPrevButtons = [];
let gpMenuFocusIndex = 0;
let gpMenuNavCooldown = 0;
const GAMEPAD_MENU_NAV_DELAY = 0.22;

window.addEventListener('gamepadconnected', (e) => {
  gpConnected = true;
  gpIndex = e.gamepad.index;
  showTemporaryMessage && showTemporaryMessage('🎮 Controle conectado: ' + e.gamepad.id, 2000);
});
window.addEventListener('gamepaddisconnected', (e) => {
  if (e.gamepad.index === gpIndex) { gpConnected = false; gpIndex = null; }
});

function getActiveGamepad() {
  if (gpIndex === null) return null;
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  return pads[gpIndex] || null;
}

function applyDeadzone(v) {
  return Math.abs(v) < GAMEPAD_DEADZONE ? 0 : v;
}

// ================================================================
//  NAVEGAÇÃO DE MENUS COM O CONTROLE
// ================================================================
function getVisibleMenuFocusables() {
  // Acha o menu/modal/overlay visível "mais de cima" e pega os elementos
  // clicáveis dentro dele.
  const containers = [
    ...document.querySelectorAll('.overlay:not(.hidden)'),
    ...document.querySelectorAll('.modal:not(.hidden)'),
  ];
  let container = document.getElementById('main-menu');
  if (container && container.classList.contains('hidden')) container = null;
  const active = containers.length ? containers[containers.length - 1] : container;
  if (!active) return null;
  const focusables = Array.from(active.querySelectorAll('button, input, select'))
    .filter(el => el.offsetParent !== null && !el.disabled);
  return focusables.length ? { active, focusables } : null;
}

function updateGamepadMenuNav(dt, gp) {
  const menu = getVisibleMenuFocusables();
  if (!menu) { gpMenuFocusIndex = 0; return; }

  gpMenuNavCooldown -= dt;
  const axisY = gp.axes[1] || 0;
  const dpadDown = gp.buttons[13] && gp.buttons[13].pressed;
  const dpadUp = gp.buttons[12] && gp.buttons[12].pressed;

  if (gpMenuNavCooldown <= 0) {
    let moved = false;
    if (dpadDown || axisY > 0.5) { gpMenuFocusIndex++; moved = true; }
    else if (dpadUp || axisY < -0.5) { gpMenuFocusIndex--; moved = true; }
    if (moved) {
      gpMenuNavCooldown = GAMEPAD_MENU_NAV_DELAY;
      const n = menu.focusables.length;
      gpMenuFocusIndex = ((gpMenuFocusIndex % n) + n) % n;
    }
  }

  menu.focusables.forEach((el, i) => {
    if (i === gpMenuFocusIndex) el.classList.add('gp-focused');
    else el.classList.remove('gp-focused');
  });

  const focused = menu.focusables[gpMenuFocusIndex];
  if (focused && !document.getElementById('gp-focus-style')) {
    const style = document.createElement('style');
    style.id = 'gp-focus-style';
    style.textContent = '.gp-focused{outline:3px solid #00e5ff !important;outline-offset:2px;}';
    document.head.appendChild(style);
  }

  const aPressed = gp.buttons[gamepadBinds.throttle] && gp.buttons[gamepadBinds.throttle].pressed;
  const aWasPressed = gpPrevButtons[gamepadBinds.throttle];
  if (aPressed && !aWasPressed && focused) focused.click();

  const bPressed = gp.buttons[1] && gp.buttons[1].pressed;
  const bWasPressed = gpPrevButtons[1];
  if (bPressed && !bWasPressed) {
    const closeBtn = menu.active.querySelector('[id*="close"], .btn-danger');
    if (closeBtn) closeBtn.click();
  }
}

// ================================================================
//  LOOP PRINCIPAL DO GAMEPAD (chamado a cada frame por main.js)
// ================================================================
function updateGamepad(dt) {
  const gp = getActiveGamepad();
  if (!gp) return;

  const inMenu = !!getVisibleMenuFocusables();
  if (inMenu) {
    updateGamepadMenuNav(dt, gp);
    gpPrevButtons = gp.buttons.map(b => b.pressed);
    return;
  }

  if (!state.isPaused && !state.isSpectator) {
    // ===== ANALÓGICO ESQUERDO = MOVIMENTO (simula W/A/S/D de verdade) =====
    const lx = applyDeadzone(gp.axes[0] || 0);
    const ly = applyDeadzone(gp.axes[1] || 0);
    // regra pedida: cima=W, baixo=S, esquerda=A, direita=D
    keys['KeyW'] = ly < 0;
    keys['KeyS'] = ly > 0;
    keys['KeyA'] = lx < 0;
    keys['KeyD'] = lx > 0;

    // ===== ANALÓGICO DIREITO = CÂMERA/MIRA =====
    const rx = applyDeadzone(gp.axes[2] || 0);
    const ry = applyDeadzone(gp.axes[3] || 0);
    if (rx !== 0 || ry !== 0) {
      cam.yaw -= rx * 2.2 * dt;
      cam.pitch -= ry * 1.6 * dt;
    }
  } else {
    keys['KeyW'] = false; keys['KeyS'] = false; keys['KeyA'] = false; keys['KeyD'] = false;
  }

  // ===== BOTÕES =====
  const pressed = (idx) => !!(gp.buttons[idx] && gp.buttons[idx].pressed);
  const justPressed = (idx) => pressed(idx) && !gpPrevButtons[idx];

  // A = acelerador (segurar)
  state.isAccelerating = pressed(gamepadBinds.throttle) || (keys[keybinds.throttle] || false);

  // Y = esc/pausa
  if (justPressed(gamepadBinds.esc)) togglePause();

  if (!state.isPaused && !state.isDead && !state.isSpectator && combatEnabled) {
    if (justPressed(gamepadBinds.bomb)) dropBomb();
    if (justPressed(gamepadBinds.missile)) fireMissile(true);
    if (justPressed(gamepadBinds.special)) triggerSpecial();
    if (justPressed(gamepadBinds.shoot)) fireMissile(false);
  }

  // Chat de voz pelo controle: em modo PTT segura o botão pra transmitir
  // (igual ao Shift do teclado); em modo "sempre ligado" cada aperto
  // alterna mutar/desmutar. Funciona mesmo em pausa/espectador.
  if (typeof voiceChatHandlePTTButton === 'function') {
    voiceChatHandlePTTButton(pressed(gamepadBinds.mic), justPressed(gamepadBinds.mic));
  }

  gpPrevButtons = gp.buttons.map(b => b.pressed);
}

// ================================================================
//  REMAPEAMENTO DOS BOTÕES DO GAMEPAD (chamado pelo menu de controles)
// ================================================================
const GAMEPAD_ACTION_LABELS = {
  throttle: 'Acelerar', esc: 'Pausa/ESC', bomb: 'Soltar Bomba',
  missile: 'Míssil Reforçado', special: 'Habilidade Especial', shoot: 'Tiro Básico',
  mic: 'Chat de Voz (PTT/Mutar)',
};

function renderGamepadConfig(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '<div style="font-size:11px;color:#7fbfd6;margin-bottom:8px;">' +
    (gpConnected ? '🎮 Controle conectado.' : '🎮 Nenhum controle detectado — conecte e pressione um botão.') +
    ' Analógico esquerdo = movimento, direito = câmera.</div>';
  Object.keys(GAMEPAD_ACTION_LABELS).forEach(action => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.08);';
    const label = document.createElement('span');
    label.textContent = GAMEPAD_ACTION_LABELS[action];
    label.style.fontSize = '13px';
    const btn = document.createElement('button');
    btn.className = 'btn-secondary';
    btn.style.cssText = 'padding:4px 12px;font-size:12px;min-width:70px;';
    btn.textContent = GAMEPAD_BUTTON_LABELS[gamepadBinds[action]] || '?';
    btn.addEventListener('click', () => {
      btn.textContent = '...';
      const captureStart = performance.now();
      const poll = setInterval(() => {
        const gp = getActiveGamepad();
        if (!gp) {
          if (performance.now() - captureStart > 8000) { clearInterval(poll); btn.textContent = GAMEPAD_BUTTON_LABELS[gamepadBinds[action]]; }
          return;
        }
        for (let i = 0; i < gp.buttons.length; i++) {
          if (gp.buttons[i].pressed) {
            gamepadBinds[action] = i;
            btn.textContent = GAMEPAD_BUTTON_LABELS[i] || ('#' + i);
            clearInterval(poll);
            return;
          }
        }
        if (performance.now() - captureStart > 8000) { clearInterval(poll); btn.textContent = GAMEPAD_BUTTON_LABELS[gamepadBinds[action]]; }
      }, 50);
    });
    row.appendChild(label); row.appendChild(btn);
    container.appendChild(row);
  });
  const resetBtn = document.createElement('button');
  resetBtn.className = 'btn-secondary';
  resetBtn.textContent = 'Restaurar padrão do controle';
  resetBtn.style.cssText = 'margin-top:10px;width:100%;';
  resetBtn.addEventListener('click', () => { gamepadBinds = { ...DEFAULT_GAMEPAD_BINDS }; renderGamepadConfig(containerId); });
  container.appendChild(resetBtn);
}