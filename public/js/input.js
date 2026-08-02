// input.js
const keys = {};

function isAction(action) {
  const code = keybinds[action];
  return !!(code && keys[code]);
}

// CORREÇÃO: as teclas do jogo (W/A/S/D/Espaço/1/2/3) ficavam "presas" nos
// campos de texto do menu (nome da sala, senha, nome do piloto etc.) porque
// esses listeners eram globais e incondicionais — mesmo com um <input>
// focado, o jogo interceptava a tecla, chamava preventDefault() e ainda
// disparava ações de jogo (acelerar, atirar...) enquanto você tentava digitar.
function isTypingTarget() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

window.addEventListener('keydown', (e) => {
  if (isTypingTarget()) return; // deixa o campo de texto do menu funcionar normalmente

  const controlKeys = [
    keybinds.throttle,
    keybinds.climbUp,
    keybinds.climbDown,
    keybinds.rollLeft,
    keybinds.rollRight,
    keybinds.bomb,
    keybinds.missile,
    keybinds.special,
    'Escape',
    'ArrowUp', 'ArrowDownArrowUp', 'ArrowLeft', 'ArrowRight',
    'Space',
    'ShiftLeft', 'ShiftRight'
  ];
  if (controlKeys.includes(e.code)) {
    e.preventDefault();
  }

  keys[e.code] = true;

  if (e.code === keybinds.throttle) {
    state.isAccelerating = true;
  }
  if (e.code === 'Escape') {
    togglePause();
  }
  if (e.code === keybinds.bomb && !state.isPaused && !state.isDead && !state.isSpectator && combatEnabled) {
    dropBomb();
  }
  if (e.code === keybinds.missile && !state.isPaused && !state.isDead && !state.isSpectator && combatEnabled) {
    fireHeavyBomb();
  }
  if (e.code === 'Enter' && !state.isPaused && !state.isDead && !state.isSpectator && combatEnabled) {
    fireMissile(false);
  }
  if (e.code === keybinds.special && !state.isPaused && !state.isDead && !state.isSpectator && combatEnabled) {
    triggerSpecial();
  }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    cam.yaw = 0;
    cam.pitch = 0;
  }
  // Chat de voz: em modo PTT, segurar a tecla transmite; em modo "sempre
  // ligado", cada aperto alterna mutar/desmutar (repeat do teclado é
  // ignorado — só conta o primeiro keydown, ver voice-chat.js).
  if (e.code === keybinds.voicePTT && typeof voiceChatHandlePTTKey === 'function') {
    voiceChatHandlePTTKey(true, e.repeat);
  }
});

window.addEventListener('keyup', (e) => {
  if (isTypingTarget()) return;

  const controlKeys = [
    keybinds.throttle,
    keybinds.climbUp,
    keybinds.climbDown,
    keybinds.rollLeft,
    keybinds.rollRight,
    'Space'
  ];
  if (controlKeys.includes(e.code)) {
    e.preventDefault();
  }

  keys[e.code] = false;
  if (e.code === keybinds.throttle) {
    state.isAccelerating = false;
  }
  if (e.code === keybinds.voicePTT && typeof voiceChatHandlePTTKey === 'function') {
    voiceChatHandlePTTKey(false, false);
  }
});

renderer.domElement.addEventListener('mousedown', (e) => {
  if (e.button === 0) {
    if (!state.isPaused && !state.isDead && !state.isSpectator && combatEnabled) {
      fireMissile(false);
    }
  } else if (e.button === 2) {
    cam.yaw = 0;
    cam.pitch = 0;
  }
});

renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('mousemove', (e) => {
  if (state.isPaused) return;
  // PEDIDO: no modo espectador (morto), o mouse controla a câmera LIVRE
  // (ver camera.js/updateSpectatorFreeCam) em vez da câmera de voo normal.
  if (state.isSpectator) { addSpectatorMouseDelta(e.movementX, e.movementY); return; }
  cam.yaw -= e.movementX * 0.0032;
  cam.pitch -= e.movementY * 0.0032;
});