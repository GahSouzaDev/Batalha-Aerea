// main.js
const clock = new THREE.Clock();

// DIAGNÓSTICO: se o problema é a GPU perdendo o contexto WebGL (sintoma
// bate: tudo fica branco/sem textura depois de alguns segundos), isso vai
// aparecer no console como "[WEBGL] contexto perdido". Se aparecer, o
// avião realista com muitas luzes/partículas é a causa mais provável —
// já reduzi o número de luzes em plane-model-realistic.js, teste de novo.
if (renderer && renderer.domElement) {
  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    console.error('[WEBGL] contexto perdido — a GPU derrubou o rendering. Isso confirma sobrecarga (muitas luzes/texturas), não é bug de textura em si.');
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    console.warn('[WEBGL] contexto restaurado — mas as texturas/estado da GPU precisam ser recarregados manualmente (ainda não implementado).');
  });
}

// CORREÇÃO IMPORTANTE: antes, TUDO abaixo (voo, armas, bots, clima,
// dirigível) rodava incondicionalmente no loop, mesmo com state.isPaused
// true ou com o menu principal na tela. Só o "prepTimer" verificava
// isso. Na prática isso significa: pausar o jogo ou voltar pro menu
// NUNCA parava a simulação de verdade — o dirigível continuava voando e
// anunciando, o clima continuava mudando, e o motor do avião (que é
// atualizado dentro de updateFlight) continuava tocando o som dele.
// Agora existe uma única flag `simulationRunning` que trava tudo isso de
// uma vez quando o jogo está pausado OU o menu principal está visível.
const mainMenuEl = document.getElementById('main-menu');

function isMainMenuVisible() {
  return !!(mainMenuEl && !mainMenuEl.classList.contains('hidden'));
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  const inMenu = isMainMenuVisible();
  const simulationRunning = !state.isPaused && !loadingActive && !inMenu;

  if (!onlineState.socket && simulationRunning) {
    if (prepTimer > 0) {
      prepTimer -= dt;
      state.invulnerable = true;
      if (prepTimer <= 0) {
        prepTimer = 0;
        combatEnabled = true;
        state.invulnerable = false;
        showTemporaryMessage('⚔️ COMBATE LIBERADO!', 1800);
        announceCombatStart();
      }
    }
  }

  // Congela/descongela o clima e o dirigível junto com o resto da
  // simulação (idempotente — ver weather.js). Isso garante que nenhum
  // timer de clima/dirigível ande enquanto pausado ou no menu.
  if (typeof setWeatherPaused === 'function') setWeatherPaused(!simulationRunning);

  if (simulationRunning) {
    updateSpecial(dt);
    updateWeaponCooldowns(dt);
    updateFlight(dt);
    if (!onlineState.socket) updateEnemyBots(dt);
    if (onlineState.socket) updateRemotePlayers(dt); // CORREÇÃO: faltava essa chamada — sem ela os aviões remotos nunca se moviam na tela, mesmo a posição chegando certinho do servidor.
    updateMissiles(dt);
    updateBombs(dt);
    updateExplosions(dt);
    updateMachineGunBullets(dt);
    if (typeof updateWeather === 'function') updateWeather(dt);
  }

  if (typeof updateGamepad === 'function') updateGamepad(dt);
  // PEDIDO: enquanto o menu principal ou o lobby estiverem na tela, a
  // câmera de voo normal dá lugar a uma câmera orbital livre em volta
  // do avião (ver menu-camera.js), pra poder ver/girar o avião 360°
  // sem precisar sair da tela de menu.
  if (typeof isMenuPreviewActive === 'function' && isMenuPreviewActive()) {
    updateMenuPreviewCamera(dt);
  } else {
    updateCamera(dt);
    if (typeof refreshMenuCollapseUI === 'function') refreshMenuCollapseUI();
  }
  updateHUD();
  if (typeof updateRadar === 'function') updateRadar(dt);
  updateScoreboardLoop(dt);

  renderer.render(scene, camera);
}

document.getElementById('main-menu').classList.remove('hidden');
combatEnabled = true;
prepTimer = 0;

animate();

const pauseOverlay = document.createElement('div');
pauseOverlay.className = 'overlay hidden';
pauseOverlay.id = 'pause-overlay';
pauseOverlay.innerHTML = `
  <div class="overlay-card">
    <div class="overlay-title">PAUSA</div>
    <div class="overlay-sub">Jogo pausado.</div>
    <div style="display:flex;flex-direction:column;gap:10px;align-items:center;">
      <button class="btn-secondary" id="resume-btn" style="background:linear-gradient(135deg,#00e5ff,#0088aa);color:#00131a;font-weight:700;width:100%;max-width:240px;">Continuar</button>
      <button class="btn-secondary" id="pause-change-plane-btn" style="width:100%;max-width:240px;display:none;">✈️ Trocar de Avião</button>
      <button class="btn-secondary" id="pause-audio-btn" style="width:100%;max-width:240px;display:none;">🎙️ Áudio / Voz</button>
      <button class="btn-secondary btn-danger" id="menu-btn" style="width:100%;max-width:240px;">Menu</button>
    </div>
  </div>
`;
document.body.appendChild(pauseOverlay);
document.getElementById('resume-btn').addEventListener('click', resumeGame);
document.getElementById('menu-btn').addEventListener('click', () => {
  if (onlineState.socket) onlineState.socket.emit('leave-room');
  // PEDIDO: ao voltar pro menu, o clima/dirigível não podem só "pausar
  // congelados" (isso ainda deixaria o narrador terminando de falar uma
  // frase que já estava na fila) — aqui é um corte total: some com
  // chuva/neblina/tempestade, desaparece o dirigível se tiver um voando,
  // e cancela qualquer fala pendente do narrador.
  if (typeof haltWeatherForMenu === 'function') haltWeatherForMenu();
  // O som do motor do avião não deveria nem existir no menu. Esse hook
  // é chamado se existir (ver sound.js/flight.js do projeto — não fazem
  // parte destes arquivos, então só dá pra deixar o gancho pronto aqui).
  if (typeof stopAllEngineSounds === 'function') stopAllEngineSounds();
  goToMenu();
});
// PEDIDO: trocar de avião pela pausa só faz sentido no treino com bots
// (visibilidade real disso é decidida em pauseGame(), ver
// player-lifecycle.js). Na Sala Livre, o avião só muda quando você
// morre (ver botão em #spectator-hud); em salas criadas, só no lobby.
document.getElementById('pause-change-plane-btn').addEventListener('click', () => {
  if (typeof openSwitchPlaneModal === 'function') openSwitchPlaneModal('pause-bots');
});
document.getElementById('pause-audio-btn').addEventListener('click', () => {
  if (typeof openAudioSettingsModal === 'function') openAudioSettingsModal();
});