// mobile-controls.js — Controles em tela pra celular
// Detecta mobile, força landscape (paisagem) pra ficar igual pra todo mundo,
// e cria: joystick virtual (movimento W/A/S/D), área de arrastar pra
// câmera/mira, botão de acelerador (liga/desliga) e botões de ataque
// (tiro básico maior embaixo; míssil, bomba e especial menores).

let forceMobileControls = false;
let mobileControlsActive = false;

function isMobileDevice() {
  const ua = navigator.userAgent || '';
  const touch = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(ua);
  // iPadOS manda UA de Mac desktop por padrão (sem "iPad"/"Mobile" na string),
  // então detectamos pelo touch multiTouch (maxTouchPoints > 1) + plataforma Mac.
  const isIpadOS = touch && (navigator.maxTouchPoints || 0) > 1 && /Mac/i.test(navigator.platform || '');
  return forceMobileControls || isIpadOS || (touch && mobileUA);
}

// ================================================================
//  FORÇA PAISAGEM — tenta a Screen Orientation API (precisa de fullscreen
//  em vários navegadores, então tentamos travar no primeiro toque) e usa
//  um fallback 100% CSS (rotaciona a página) pra quando a API não rola.
// ================================================================
function applyLandscapeCSSFallback() {
  // PEDIDO: o travamento de paisagem (e por consequência os controles,
  // que dependem dessa classe) não deve mexer na tela enquanto qualquer
  // menu/overlay/modal estiver aberto — só faz sentido durante o voo de
  // verdade.
  const overlayOpen = document.querySelectorAll('.overlay:not(.hidden), .modal:not(.hidden)').length > 0;
  const isPortrait = window.innerHeight > window.innerWidth;
  document.body.classList.toggle('force-landscape', !overlayOpen && isPortrait);
}

function forceLandscape() {
  const style = document.createElement('style');
  style.textContent = `
    body.force-landscape {
      position: absolute; top: 0; left: 0;
      width: 100vh; height: 100vw;
      transform-origin: 0 0;
      transform: rotate(90deg) translateY(-100%);
      overflow: hidden;
    }
  `;
  document.head.appendChild(style);

  const tryLock = () => {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
  };
  document.addEventListener('touchstart', tryLock, { once: true });
  document.addEventListener('click', tryLock, { once: true });

  applyLandscapeCSSFallback();
  window.addEventListener('resize', applyLandscapeCSSFallback);
  window.addEventListener('orientationchange', applyLandscapeCSSFallback);
}

// ================================================================
//  CONTROLES EM TELA
// ================================================================
let mobileControlsWrap = null;

function createMobileControls() {
  const wrap = document.createElement('div');
  wrap.id = 'mobile-controls';
  // PEDIDO: começa ESCONDIDO — só aparece quando o jogo detectar que
  // estamos realmente voando (nenhum menu/overlay na tela). Isso evita o
  // painel ficar em cima do menu bloqueando cliques, e evita ele aparecer
  // "sempre", inclusive em computador.
  wrap.style.cssText = 'position:fixed;inset:0;z-index:500;pointer-events:none;user-select:none;-webkit-user-select:none;display:none;';
  document.body.appendChild(wrap);
  mobileControlsWrap = wrap;

  const style = document.createElement('style');
  style.textContent = `
    .mc-btn { position:absolute; border-radius:50%; background:rgba(0,20,30,0.55); border:2px solid rgba(0,229,255,0.55); color:#eafcff; display:flex; align-items:center; justify-content:center; pointer-events:auto; touch-action:none; -webkit-tap-highlight-color:transparent; }
    .mc-btn.active { background:rgba(0,229,255,0.4); transform:scale(0.94); }
  `;
  document.head.appendChild(style);

  // ===== JOYSTICK DE MOVIMENTO (esquerda, meio pra baixo) =====
  const joyOuter = document.createElement('div');
  joyOuter.id = 'mc-joystick-outer';
  joyOuter.style.cssText = 'position:absolute;left:24px;bottom:24px;width:130px;height:130px;border-radius:50%;background:rgba(0,20,30,0.45);border:2px solid rgba(0,229,255,0.45);pointer-events:auto;touch-action:none;';
  const joyInner = document.createElement('div');
  joyInner.id = 'mc-joystick-inner';
  joyInner.style.cssText = 'position:absolute;left:50%;top:50%;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;background:rgba(0,229,255,0.55);transition:transform 0.05s linear;';
  joyOuter.appendChild(joyInner);
  wrap.appendChild(joyOuter);

  let joyTouchId = null;
  function joyCenter() {
    const r = joyOuter.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, radius: r.width / 2 };
  }
  function joyMove(clientX, clientY) {
    const c = joyCenter();
    let dx = clientX - c.x, dy = clientY - c.y;
    const dist = Math.hypot(dx, dy);
    if (dist > c.radius) { dx = dx / dist * c.radius; dy = dy / dist * c.radius; }
    joyInner.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    const nx = dx / c.radius, ny = dy / c.radius;
    // pedido: cima=W, baixo=S, esquerda=A, direita=D
    keys['KeyW'] = ny < -0.3;
    keys['KeyS'] = ny > 0.3;
    keys['KeyA'] = nx < -0.3;
    keys['KeyD'] = nx > 0.3;
  }
  function joyReset() {
    joyInner.style.transform = 'translate(0,0)';
    keys['KeyW'] = false; keys['KeyS'] = false; keys['KeyA'] = false; keys['KeyD'] = false;
  }
  joyOuter.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    joyTouchId = t.identifier;
    joyMove(t.clientX, t.clientY);
  }, { passive: false });
  joyOuter.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === joyTouchId) joyMove(t.clientX, t.clientY);
  }, { passive: false });
  const joyEnd = (e) => {
    for (const t of e.changedTouches) if (t.identifier === joyTouchId) { joyTouchId = null; joyReset(); }
  };
  joyOuter.addEventListener('touchend', joyEnd);
  joyOuter.addEventListener('touchcancel', joyEnd);

  // ===== BOTÃO DE ACELERADOR (liga/desliga, não segurar) =====
  // PEDIDO: virou uma chave gangorra de verdade, com um "LED" que muda de
  // cor (vermelho apagado = desligado, verde aceso = ligado) em vez de só
  // um botão redondo que muda de cor de fundo — fica muito mais claro de
  // bater o olho e saber o estado sem precisar ler o texto.
  const throttleBtn = document.createElement('button');
  throttleBtn.id = 'mc-throttle';
  throttleBtn.className = 'mc-toggle-switch';
  throttleBtn.innerHTML = '<span class="mc-toggle-led"></span><span class="mc-toggle-text">MOTOR</span>';
  throttleBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    state.isAccelerating = !state.isAccelerating;
    throttleBtn.classList.toggle('on', state.isAccelerating);
  }, { passive: false });
  wrap.appendChild(throttleBtn);

  // ===== ÁREA DE ARRASTAR PRA CÂMERA/MIRA (lado direito da tela) =====
  const lookZone = document.createElement('div');
  lookZone.id = 'mc-look-zone';
  lookZone.style.cssText = 'position:absolute;right:0;top:0;width:62%;height:100%;pointer-events:auto;touch-action:none;';
  wrap.appendChild(lookZone);
  let lookTouchId = null, lastLookX = 0, lastLookY = 0, lookStartX = 0, lookStartY = 0, lookStartTime = 0;
  lookZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    lookTouchId = t.identifier;
    lastLookX = lookStartX = t.clientX;
    lastLookY = lookStartY = t.clientY;
    lookStartTime = performance.now();
  }, { passive: false });
  lookZone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== lookTouchId) continue;
      const dx = t.clientX - lastLookX, dy = t.clientY - lastLookY;
      lastLookX = t.clientX; lastLookY = t.clientY;
      if (!state.isPaused && !state.isSpectator) {
        cam.yaw -= dx * 0.0042;
        cam.pitch -= dy * 0.0042;
      }
    }
  }, { passive: false });
  lookZone.addEventListener('touchend', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== lookTouchId) continue;
      lookTouchId = null;
      // toque rápido sem arrastar = também atira (além do botão dedicado)
      const dt = performance.now() - lookStartTime;
      const moved = Math.hypot(t.clientX - lookStartX, t.clientY - lookStartY);
      if (dt < 220 && moved < 14 && !state.isPaused && !state.isDead && !state.isSpectator && combatEnabled) {
        fireMissile(false);
      }
    }
  });

  // ===== BOTÕES DE ATAQUE =====
  function attackButton(id, label, size, right, bottom, fontSize, onPress) {
    const btn = document.createElement('button');
    btn.id = id;
    btn.className = 'mc-btn';
    btn.style.cssText = 'right:' + right + 'px;bottom:' + bottom + 'px;width:' + size + 'px;height:' + size + 'px;font-size:' + fontSize + 'px;';
    btn.textContent = label;
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      btn.classList.add('active');
      onPress();
    }, { passive: false });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); btn.classList.remove('active'); });
    wrap.appendChild(btn);
    return btn;
  }

  const guardAndFire = (fn) => () => {
    if (!state.isPaused && !state.isDead && !state.isSpectator && combatEnabled) fn();
  };

  // ===== BOTÕES DO CANTO SUPERIOR ESQUERDO (pausa + tela cheia) =====
  // CORREÇÃO: os dois ficavam "embaixo um do outro" em vez de lado a lado
  // porque, no truque de CSS que gira a tela inteira 90° pra simular
  // paisagem (quando o navegador não suporta screen.orientation.lock),
  // os eixos top/left do body ficam efetivamente trocados — então dois
  // botões com left diferente e top igual acabavam um embaixo do outro
  // na tela, não lado a lado. Agora os dois vivem dentro do MESMO
  // container flex (#mc-topleft-group), e o CSS troca a direção do flex
  // pra "column" quando o truque de rotação está ativo — assim eles
  // continuam lado a lado na tela de verdade, seja qual for o método de
  // paisagem em uso.
  const topLeftGroup = document.createElement('div');
  topLeftGroup.id = 'mc-topleft-group';
  wrap.appendChild(topLeftGroup);

  const pauseBtn = document.createElement('button');
  pauseBtn.id = 'mc-pause';
  pauseBtn.textContent = '⏸';
  pauseBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    pauseBtn.classList.add('active');
    togglePause();
  }, { passive: false });
  pauseBtn.addEventListener('touchend', (e) => { e.preventDefault(); pauseBtn.classList.remove('active'); });
  topLeftGroup.appendChild(pauseBtn);

  // ===== BOTÃO DE TELA CHEIA (ao lado do pause) =====
  // PEDIDO: no celular a barra de endereço do navegador come um espaço
  // enorme da tela e atrapalha o jogo — esse botão pede fullscreen real
  // (Fullscreen API) pra sumir com ela. Alterna: se já estiver em tela
  // cheia, sai; senão, entra.
  const fullscreenBtn = document.createElement('button');
  fullscreenBtn.id = 'mc-fullscreen';
  fullscreenBtn.textContent = '⛶';
  function isCurrentlyFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }
  function updateFullscreenIcon() {
    fullscreenBtn.textContent = isCurrentlyFullscreen() ? '⤢' : '⛶';
  }
  fullscreenBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    fullscreenBtn.classList.add('active');
    const el = document.documentElement;
    if (!isCurrentlyFullscreen()) {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) req.call(el).catch(() => {});
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document).catch(() => {});
    }
  }, { passive: false });
  fullscreenBtn.addEventListener('touchend', (e) => { e.preventDefault(); fullscreenBtn.classList.remove('active'); });
  document.addEventListener('fullscreenchange', updateFullscreenIcon);
  document.addEventListener('webkitfullscreenchange', updateFullscreenIcon);
  topLeftGroup.appendChild(fullscreenBtn);

  // ===== BOTÃO DE MUDO (embaixo do de tela cheia) =====
  // PEDIDO: botão de mudo no mobile, logo abaixo do de expandir tela.
  // Usa a mesma variável global de mudo do menu/lobby (gameSoundMuted,
  // definida em ui-menu.js), então ligar/desligar aqui reflete lá e
  // vice-versa.
  const muteBtn = document.createElement('button');
  muteBtn.id = 'mc-mute';
  function updateMuteBtnIcon() {
    muteBtn.textContent = (typeof gameSoundMuted !== 'undefined' && gameSoundMuted) ? '🔇' : '🔊';
  }
  updateMuteBtnIcon();
  window.updateMuteButtonIcon = updateMuteBtnIcon;
  muteBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    muteBtn.classList.add('active');
    const nextMuted = !(typeof gameSoundMuted !== 'undefined' && gameSoundMuted);
    if (typeof setGameSoundMuted === 'function') setGameSoundMuted(nextMuted);
    updateMuteBtnIcon();
  }, { passive: false });
  muteBtn.addEventListener('touchend', (e) => { e.preventDefault(); muteBtn.classList.remove('active'); });
  topLeftGroup.appendChild(muteBtn);

  // ===== BOTÃO DE MICROFONE =====
  // PEDIDO: no celular não existe "segurar" prático voando — então, seja
  // qual for o modo escolhido nas configurações de áudio (PTT ou sempre
  // ligado), o botão do celular sempre funciona como uma CHAVE: um clique
  // liga o microfone, outro desliga, sem precisar segurar (igual ao
  // interruptor do acelerador). Some sozinho quando não há chat de voz
  // ativo.
  //
  // CORREÇÃO: antes esse botão era filho de #mc-topleft-group, que fica
  // dentro do wrap de controles de VOO — e esse wrap inteiro some
  // (display:none) sempre que qualquer overlay está aberto (lobby, pausa
  // etc). Só que é EXATAMENTE no lobby que o mic mais importa (escolhendo
  // avião com o chat de voz ligado). Por isso ele agora é um elemento
  // próprio, direto no body, com posição fixa dele mesmo — nunca some
  // junto com os outros controles de voo.
  const micBtn = document.createElement('button');
  micBtn.id = 'mc-mic';
  micBtn.style.display = 'none';
  function updateMicBtnIcon() {
    const connected = (typeof voiceChat !== 'undefined') && voiceChat.enabled;
    micBtn.style.display = connected ? '' : 'none';
    if (!connected) return;
    micBtn.textContent = voiceChat.micOn ? '🎙️' : '🔴';
    micBtn.classList.toggle('mic-live', !!voiceChat.micOn);
  }
  window.updateMicButtonIcon = updateMicBtnIcon;
  micBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    micBtn.classList.add('active');
    if (typeof voiceChatToggleMic === 'function') voiceChatToggleMic();
    updateMicBtnIcon();
  }, { passive: false });
  micBtn.addEventListener('touchend', (e) => { e.preventDefault(); micBtn.classList.remove('active'); });
  document.body.appendChild(micBtn);
  setInterval(updateMicBtnIcon, 400);

  // tiro básico — maior, embaixo
  attackButton('mc-fire', '🎯', 92, 26, 26, 30, guardAndFire(() => fireMissile(false)));
  // míssil, bomba, especial — menores, em cima do de tiro
  attackButton('mc-missile', '🚀', 58, 20, 148, 22, guardAndFire(() => fireHeavyBomb()));
  attackButton('mc-bomb', '💣', 58, 90, 148, 22, guardAndFire(() => dropBomb()));
  attackButton('mc-special', '⚡', 58, 160, 148, 22, guardAndFire(() => triggerSpecial()));

  // Estado inicial correto na hora da criação (sem esperar o 1º tick do
  // intervalo), já que nesse momento o usuário quase sempre ainda está
  // no menu.
  updateMobileControlsVisibility();
}

// ================================================================
//  RECARGA NOS PRÓPRIOS BOTÕES — PEDIDO: em vez do HUD de tecla
//  (Clique/1/2/3, que não faz sentido sem teclado), os botões de
//  ataque na tela ficam vermelhos sozinhos enquanto estiverem
//  recarregando/em uso, usando as mesmas variáveis que o HUD de
//  desktop já lê (missileCooldown, superReady, bombCooldown,
//  state.specialCooldown/specialActive — ver weapons.js e hud.js).
// ================================================================
function updateAttackButtonCooldowns() {
  if (!mobileControlsWrap || mobileControlsWrap.style.display === 'none') return;
  const setCd = (id, onCooldown) => {
    const btn = document.getElementById(id);
    if (btn) btn.classList.toggle('mc-cooldown', !!onCooldown);
  };
  setCd('mc-fire', typeof missileCooldown !== 'undefined' && missileCooldown > 0);
  setCd('mc-missile', typeof superReady !== 'undefined' && !superReady);
  setCd('mc-bomb', typeof bombCooldown !== 'undefined' && bombCooldown > 0);
  setCd('mc-special', typeof state !== 'undefined' && state && (state.specialCooldown > 0 || state.specialActive));
}
setInterval(updateAttackButtonCooldowns, 150);

// ================================================================
//  VISIBILIDADE DO PAINEL DE TOQUE — só aparece durante o voo de
//  verdade (nenhum menu, pausa, lobby ou modal aberto), igual à regra
//  que já existe pro volume do motor (isOverlayVisible, em
//  positional-audio.js). Roda em intervalo curto porque o estado do
//  menu pode mudar por vários caminhos diferentes (ready/start no
//  lobby, morte, pausa, etc.) e centralizar num único lugar é mais
//  confiável do que tentar pegar cada ponto de transição na mão.
// ================================================================
function updateMobileControlsVisibility() {
  if (!mobileControlsWrap) return;
  const overlayOpen = document.querySelectorAll('.overlay:not(.hidden), .modal:not(.hidden)').length > 0;
  const gameplayActive = !overlayOpen && isMobileDevice();
  mobileControlsWrap.style.display = gameplayActive ? '' : 'none';
  applyLandscapeCSSFallback();
}
setInterval(updateMobileControlsVisibility, 200);

function initMobileControls() {
  if (mobileControlsActive) { console.log('[mobile-controls] já ativo, ignorando nova chamada.'); return; }
  if (!isMobileDevice()) {
    console.log('[mobile-controls] dispositivo não detectado como mobile. touch=', ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0, 'UA=', navigator.userAgent, '— marque o checkbox "Controles de toque (celular)" no menu pra forçar.');
    return;
  }
  console.log('[mobile-controls] ativando controles de toque.');
  mobileControlsActive = true;
  document.body.classList.add('mobile-hud');
  forceLandscape();
  createMobileControls();
}

// PEDIDO: em alguns aparelhos a detecção automática (touch + user-agent
// mobile) falha — tablets Android sem "Mobile" na UA, navegadores em modo
// desktop, etc. — e os controles em tela simplesmente não apareciam. Agora
// tem um checkbox no menu ("Controles de toque (celular)") pra forçar a
// ativação manualmente, independente da detecção automática.
function bindForceMobileControlsCheckbox() {
  const cb = document.getElementById('force-mobile-controls');
  if (!cb) return;
  cb.addEventListener('change', function() {
    forceMobileControls = this.checked;
    if (forceMobileControls) initMobileControls();
    // Se desmarcado, o próprio loop de visibilidade (updateMobileControlsVisibility)
    // já esconde o painel no próximo tick — não precisa recarregar a página.
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { initMobileControls(); bindForceMobileControlsCheckbox(); });
} else {
  initMobileControls();
  bindForceMobileControlsCheckbox();
}