// player-lifecycle.js
function togglePause() { if (state.isPaused) resumeGame(); else pauseGame(); }
function pauseGame() {
  if (state.isPaused || state.isDead) return;
  state.isPaused = true;
  document.getElementById('pause-overlay').classList.remove('hidden');
  // PEDIDO: trocar de avião pela pausa só no treino com bots. Na Sala
  // Livre o avião só troca quando morre (tem mecânica de recuperar
  // vida enquanto vivo); em sala criada, só no lobby.
  const changeBtn = document.getElementById('pause-change-plane-btn');
  if (changeBtn) changeBtn.style.display = (!onlineState.socket) ? '' : 'none';
  // Áudio/Voz só faz sentido em partida online (sala livre ou sala
  // criada) — no treino com bots não existe chat de voz nenhum.
  const audioBtn = document.getElementById('pause-audio-btn');
  if (audioBtn) audioBtn.style.display = onlineState.socket ? '' : 'none';
}
function resumeGame() { if (!state.isPaused) return; state.isPaused = false; document.getElementById('pause-overlay').classList.add('hidden'); }

function goToMenu() {
  state.isPaused = false;
  document.getElementById('pause-overlay').classList.add('hidden');
  document.getElementById('main-menu').classList.remove('hidden');
  document.getElementById('restart-overlay')?.classList.add('hidden');
  leaveOnlineIfNeeded();
  resetLocalStateForMenu();
  // PEDIDO: limpa o histórico de replay ao voltar pro menu — sem isso,
  // o próximo treino/partida poderia acabar montando um "replay" com
  // posições de uma sessão anterior.
  if (typeof resetReplayBuffer === 'function') resetReplayBuffer();
  botsEnabled = true;
  spawnEnemyBots();
  buildEnvironment('cidade');
  rebuildVehicle();
  document.getElementById('crosshair').classList.remove('hidden');
}

function resetLocalStateForMenu() {
  state.position.copy(START_POS);
  state.velocity = 0;
  state.isAccelerating = false;
  state.isCrashed = false;
  state.isCrashDying = false;
  state.crashTimer = 0;
  state.yaw = 0; state.pitch = 0; state.roll = 0;
  state.fallVelocity = 0;
  state.isDead = false;
  state.isSpectator = false;
  state.health = MAX_HEALTH;
  state.maxHealth = MAX_HEALTH;
  state.shield = 0;
  state.kills = 0;
  state.deaths = 0;
  state.specialActive = false;
  state.specialTimer = 0;
  state.specialCooldown = 0;
  state.invisible = false;
  state.invulnerable = false;
  state.freeCam = false;
  cam.yaw = 0; cam.pitch = 0; cam.radius = 9; cam.targetRadius = 9;
  document.getElementById('spectator-hud').classList.remove('show');
  document.getElementById('death-overlay').classList.remove('show');
  document.getElementById('restart-overlay')?.classList.add('hidden');
  setSpectatorTint(false);
  stopAllSpecialTimers();
  removeSpecialEffects();
  prevSpecialActive = false;
  showSpecialIndicator(false);
  missiles.forEach(m => { scene.remove(m.mesh); if (m.trail) scene.remove(m.trail); });
  missiles.length = 0;
  bombs.forEach(b => scene.remove(b.mesh));
  bombs.length = 0;
  machineGunBullets.forEach(b => scene.remove(b.mesh));
  machineGunBullets.length = 0;
  combatEnabled = true;
  prepTimer = 0;
}

function applyDamageToPlayer(dmg) {
  if (state.isDead || state.isPaused || state.isSpectator) return;
  if (state.invulnerable) return;
  if (state.shield > 0) {
    const absorbed = Math.min(state.shield, dmg);
    state.shield -= absorbed;
    dmg -= absorbed;
    if (dmg <= 0) return;
  }
  state.health = Math.max(0, state.health - dmg);
  flashVehicle();
  if (state.health <= 0) killPlayer();
  cameraShake(0.55, 0.3);
}

function setSpectatorTint(show) {
  document.getElementById('spectator-tint').classList.toggle('show', show);
  document.getElementById('spectator-waiting').classList.toggle('show', show);
}

// fromCollision=true quando essa morte veio de uma colisão estrutural
// (triggerExplosiveCrash, em physics.js), que já mostrou a própria
// explosão e já silenciou o motor alguns segundos antes de chamar isto
// aqui — então não repetimos esse efeito de novo.
//
// killerId (opcional) = socket id de quem te abateu, quando conhecido
// (ver socket.on('player-killed') em multiplayer.js). Usado só pra
// escolher pra quem a câmera do replay deve olhar (ver PEDIDO abaixo) —
// se não vier, o replay ainda toca, só que orbitando apenas a sua
// própria morte.
function killPlayer(fromCollision, killerId) {
  if (state.isDead) return;
  state.isDead = true;
  state.isSpectator = true;
  state.isCrashed = false;
  state.isCrashDying = false;
  state.fallVelocity = -6;
  // Feed de abates offline (bots/solo) — online já vem pelo evento
  // 'player-killed' do servidor, então não duplicamos aqui.
  if (!onlineState.socket && typeof pushKillFeed === 'function') {
    pushKillFeed(fromCollision ? '💥 Você caiu em combate' : '☠️ Você foi abatido');
  }
  if (!onlineState.socket) {
    announceKill(null, _localPlayerName());
  }
  // Avião abatido não faz mais som de motor até reviver/começar outra partida.
  if (localParts && localParts.engineSound) localParts.engineSound.setVolume(0);
  playSound('death');
  stopAllSpecialTimers();
  removeSpecialEffects();
  prevSpecialActive = false;
  showSpecialIndicator(false);
  state.specialActive = false;
  state.specialTimer = 0;
  missiles.forEach(m => { scene.remove(m.mesh); if (m.trail) scene.remove(m.trail); });
  missiles.length = 0;
  machineGunBullets.forEach(b => scene.remove(b.mesh));
  machineGunBullets.length = 0;

  // No multiplayer a tela cinza (modo espectador) aparece logo — o placar/
  // vencedor é decidido pelo servidor e chega pelo evento 'match-end'
  // (ver socket.on('match-end', ...) em multiplayer.js), que já existe e
  // mostra a tela de vencedor automaticamente quando o servidor decidir.
  if (onlineState.socket) {
    setSpectatorTint(true);
  }

  // PEDIDO: na Sala Livre, só dá pra trocar de avião quando você morre
  // (enquanto vivo o avião fica o mesmo — tem mecânica própria pra
  // recuperar vida). O respawn em si continua automático (o servidor
  // decide a hora); esse botão só deixa escolher outro avião ANTES
  // dele acontecer.
  const changePlaneBtn = document.getElementById('spectator-change-plane-btn');
  if (changePlaneBtn) {
    changePlaneBtn.style.display = (onlineState.socket && onlineState.isFreeRoom) ? 'inline-block' : 'none';
    if (!changePlaneBtn.dataset.bound) {
      changePlaneBtn.dataset.bound = '1';
      changePlaneBtn.addEventListener('click', () => {
        if (typeof openSwitchPlaneModal === 'function') openSwitchPlaneModal('free-room');
      });
    }
  }

  // PEDIDO: replay individual de cada abate (pra quem morreu ver como
  // morreu) volta a existir, mas SÓ EM SALA CRIADA (Todos Contra Todos/
  // Esquadrão) — onlineState.socket true e onlineState.isFreeRoom false.
  // Na Sala Livre e no treino com bots, cada morte é comum demais (na
  // Sala Livre em especial, é praticamente contínuo) e travar a câmera/
  // HUD por alguns segundos ali no meio do jogo é o que causava bug/
  // pausa incômoda — por isso nesses dois casos vai direto pro modo
  // espectador, sem replay nenhum. O replay do ÚLTIMO abate da partida
  // pra TODOS verem, antes do placar final, continua existindo à parte
  // (ver socket.on('match-end') em multiplayer.js) e não depende disto
  // aqui.
  const isCreatedRoom = !!(onlineState.socket && !onlineState.isFreeRoom);
  const clip = (isCreatedRoom && typeof captureKillClip === 'function') ? captureKillClip('local', killerId || null) : null;
  const onClimax = fromCollision ? null : (focusPos) => {
    createExplosion((focusPos || state.position).clone(), true, false);
  };
  if (clip && typeof beginReplayPlayback === 'function') {
    beginReplayPlayback(clip, fromCollision ? '💥 Replay da colisão' : '💀 Replay do seu abate', () => enterSpectatorFlow(), onClimax);
  } else {
    // Sala Livre, treino com bots, ou sem histórico suficiente pra montar
    // um replay (ex: morreu nos primeiros instantes) — mantém o
    // comportamento sem replay: explode na hora e segue direto pro modo
    // espectador.
    if (!fromCollision) createExplosion(state.position.clone(), true, false);
    enterSpectatorFlow();
  }
}

// Sequência que era executada na hora, direto dentro de killPlayer()
// antes de existir o replay — agora só roda DEPOIS do replay terminar
// (ou na hora, se não tiver clipe pra mostrar). Mantém exatamente o
// mesmo comportamento de antes (tela "ABATIDO" por 1800ms, depois
// espectador, depois o menu de recomeçar no modo solo).
function enterSpectatorFlow() {
  document.getElementById('death-overlay').classList.add('show');
  document.getElementById('spectator-hud').classList.add('show');
  document.getElementById('crosshair').classList.add('hidden');
  setTimeout(() => {
    document.getElementById('death-overlay').classList.remove('show');
    if (state.isSpectator) setSpectatorTint(true);
    // No single player o menu de reinício só aparece depois da tela cinza,
    // não junto da explosão.
    if (!onlineState.socket) showRestartOverlay();
  }, 1800);
}

function showRestartOverlay() {
  // CORREÇÃO: index.html já tem um #restart-overlay estático no HTML. Esse
  // código só ligava os cliques dos botões dentro do "if (!overlay)" — ou
  // seja, só quando ELE MESMO criava o elemento do zero. Como o elemento já
  // existe na página, esse bloco nunca rodava e os botões ficavam sem
  // nenhum clique vinculado (por isso "não fazia nada"). Agora ligamos os
  // cliques sempre, com uma flag pra não duplicar o listener se essa função
  // for chamada mais de uma vez.
  let overlay = document.getElementById('restart-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'restart-overlay';
    overlay.className = 'overlay';
    overlay.innerHTML = `
      <div class="overlay-card" style="max-width:380px;">
        <div class="overlay-title" style="font-size:22px;">💥 ABATIDO</div>
        <div class="overlay-sub">O que deseja fazer?</div>
        <div style="display:flex;flex-direction:column;gap:12px;align-items:center;margin-top:16px;">
          <button id="btn-restart" class="btn-secondary" style="width:100%;max-width:240px;background:linear-gradient(135deg,#4cff8b,#2aaf6a);color:#00131a;font-weight:700;">🔁 RECOMEÇAR</button>
          <button id="btn-restart-menu" class="btn-secondary" style="width:100%;max-width:240px;">🏠 MENU PRINCIPAL</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }
  if (!overlay.dataset.boundClicks) {
    overlay.dataset.boundClicks = '1';
    document.getElementById('btn-restart').addEventListener('click', () => {
      document.getElementById('restart-overlay').classList.add('hidden');
      restartGame();
    });
    document.getElementById('btn-restart-menu').addEventListener('click', () => {
      document.getElementById('restart-overlay').classList.add('hidden');
      goToMenu();
    });
  }
  overlay.classList.remove('hidden');
}

function restartGame() {
  resetLocalStateForMenu();
  // PEDIDO: mesma limpeza de goToMenu() — recomeçar a partida solo não
  // deve carregar histórico de replay da tentativa anterior.
  if (typeof resetReplayBuffer === 'function') resetReplayBuffer();
  botsEnabled = true;
  spawnEnemyBots();
  buildEnvironment('cidade');
  rebuildVehicle();
  document.getElementById('crosshair').classList.remove('hidden');
  combatEnabled = false;
  prepTimer = 14;
  state.isSpectator = false;
  state.isDead = false;
  state.health = MAX_HEALTH;
  state.maxHealth = MAX_HEALTH;
  document.getElementById('spectator-hud').classList.remove('show');
  setSpectatorTint(false);
  document.getElementById('restart-overlay')?.classList.add('hidden');
  playSound('start');
  announceTakeoff();
}

function revivePlayer() {
  state.isDead = false;
  state.isSpectator = false;
  const changePlaneBtn = document.getElementById('spectator-change-plane-btn');
  if (changePlaneBtn) changePlaneBtn.style.display = 'none';
  if (typeof closeSwitchPlaneModal === 'function') closeSwitchPlaneModal();
  state.health = state.maxHealth;
  state.shield = 0;
  document.getElementById('death-overlay').classList.remove('show');
  document.getElementById('spectator-hud').classList.remove('show');
  setSpectatorTint(false);
  document.getElementById('crosshair').classList.remove('hidden');
  state.velocity = 0; state.pitch = 0; state.roll = 0; state.fallVelocity = 0;
  state.isCrashed = false; state.isCrashDying = false; state.crashTimer = 0;
  state.specialActive = false; state.specialTimer = 0; state.specialCooldown = 0;
  stopAllSpecialTimers();
  rebuildVehicle();
  removeSpecialEffects();
  prevSpecialActive = false;
  showSpecialIndicator(false);
  missiles.forEach(m => { scene.remove(m.mesh); if (m.trail) scene.remove(m.trail); });
  missiles.length = 0;
}