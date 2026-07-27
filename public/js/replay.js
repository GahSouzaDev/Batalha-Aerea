// replay.js
// ================================================================
//  REPLAY DE ABATE (KILLCAM) — grava um histórico curto de posição dos
//  aviões (você, remotos e bots) e, no momento de uma morte, toca uma
//  repetição cinematográfica de 5s (4s reconstituindo o que aconteceu
//  ANTES do abate + 1s parado no instante exato do impacto, depois),
//  sempre tocada até o fim, mostrando quem matou quem, ANTES de:
//    a) o próprio abatido entrar no modo espectador (ver killPlayer/
//       enterSpectatorFlow em player-lifecycle.js)
//    b) o placar final aparecer, mostrando o ÚLTIMO abate da partida
//       (ver socket.on('match-end') em multiplayer.js)
//
//  Não depende de nenhum arquivo além dos globais que o jogo já usa:
//  state, camera, scene, renderer, remotePlayers, enemyBots, localParts,
//  onlineState, THREE. Tudo é acessado com checagem defensiva
//  (typeof ... !== 'undefined') pra nunca quebrar o resto do jogo caso
//  algum desses não exista no contexto em que for chamado.
// ================================================================

const REPLAY_HISTORY_SECONDS = 8;    // quanto tempo de histórico mantemos gravado
const REPLAY_SAMPLE_DT = 0.1;        // grava um "quadro" a cada 100ms (de sobra pra interpolar suave)
const REPLAY_PRE_SECONDS = 4.0;      // PEDIDO: 4s reconstituindo o que aconteceu ANTES do abate
const REPLAY_POST_SECONDS = 1.0;     // PEDIDO: +1s parado no instante exato do impacto, depois do abate
const REPLAY_TOTAL_SECONDS = REPLAY_PRE_SECONDS + REPLAY_POST_SECONDS;

let replayBuffer = [];        // lista de quadros gravados: {t, local, remotes:{id:...}, bots:{idx:...}}
let replayClock = 0;          // relógio interno crescente, só um eixo de tempo pro buffer
let replaySampleAccum = 0;
let replayState = null;       // estado da reprodução em andamento (null = não está tocando)
let lastKillClip = null;      // guardado pra tocar antes do placar final (ver multiplayer.js)

function isReplayActive() { return !!replayState; }

// Limpa o buffer/estado — chamar ao começar um treino/partida novo, pra
// não misturar histórico de uma sessão com a de outra (ids de jogadores
// remotos, por exemplo, não se repetem entre partidas).
function resetReplayBuffer() {
  replayBuffer = [];
  replayClock = 0;
  replaySampleAccum = 0;
  lastKillClip = null;
}

// ================================================================
//  GRAVAÇÃO — chamada todo frame (ver main.js, dentro do bloco
//  "if (simulationRunning)") enquanto o jogo está rodando de verdade.
// ================================================================
function recordReplayFrame(dt) {
  if (replayActive_guard()) return; // não grava por cima de si mesmo enquanto está tocando um replay
  replayClock += dt;
  replaySampleAccum += dt;
  if (replaySampleAccum < REPLAY_SAMPLE_DT) return;
  replaySampleAccum = 0;

  const frame = { t: replayClock, local: null, remotes: {}, bots: {} };

  if (typeof state !== 'undefined' && state && state.position) {
    frame.local = {
      pos: { x: state.position.x, y: state.position.y, z: state.position.z },
      yaw: state.yaw || 0, pitch: state.pitch || 0, roll: state.roll || 0,
    };
  }

  if (typeof remotePlayers !== 'undefined' && remotePlayers) {
    remotePlayers.forEach((rp, id) => {
      if (!rp || !rp.mesh) return;
      frame.remotes[id] = {
        pos: { x: rp.mesh.position.x, y: rp.mesh.position.y, z: rp.mesh.position.z },
        rot: { x: rp.mesh.rotation.x, y: rp.mesh.rotation.y, z: rp.mesh.rotation.z },
      };
    });
  }

  if (typeof enemyBots !== 'undefined' && enemyBots) {
    enemyBots.forEach((e, idx) => {
      if (!e || !e.mesh) return;
      frame.bots[idx] = {
        pos: { x: e.mesh.position.x, y: e.mesh.position.y, z: e.mesh.position.z },
        rot: { x: e.mesh.rotation.x, y: e.mesh.rotation.y, z: e.mesh.rotation.z },
      };
    });
  }

  replayBuffer.push(frame);
  const minT = replayClock - REPLAY_HISTORY_SECONDS;
  while (replayBuffer.length && replayBuffer[0].t < minT) replayBuffer.shift();
}

// nome interno separado só pra não colidir com isReplayActive() sendo
// chamada de dentro do próprio arquivo antes dela existir na leitura
function replayActive_guard() { return !!replayState; }

// ================================================================
//  CAPTURA — recorta os últimos REPLAY_PRE_SECONDS do que já foi
//  gravado. victimId/killerId podem ser: 'local', o socket id de um
//  jogador remoto (inclusive o SEU PRÓPRIO socket id, em partidas
//  online — ver findEntityInFrame) ou 'bot-N' (mesmo padrão usado em
//  scoreboard.js pros bots).
// ================================================================
function captureKillClip(victimId, killerId) {
  if (replayBuffer.length < 2) return null;
  const clipStart = replayClock - REPLAY_PRE_SECONDS;
  const frames = replayBuffer.filter(f => f.t >= clipStart).map(f => JSON.parse(JSON.stringify(f)));
  if (frames.length < 2) return null;
  return { frames, victimId: victimId || null, killerId: killerId || null };
}

function findEntityInFrame(frame, entityId) {
  if (!entityId || !frame) return null;
  if (entityId === 'local') return frame.local;
  if (typeof onlineState !== 'undefined' && onlineState && onlineState.myId && entityId === onlineState.myId) return frame.local;
  if (frame.remotes && frame.remotes[entityId]) return frame.remotes[entityId];
  if (typeof entityId === 'string' && entityId.indexOf('bot-') === 0) {
    const idx = entityId.slice(4);
    if (frame.bots && frame.bots[idx]) return frame.bots[idx];
  }
  return null;
}

function replayLerp(a, b, t) { return a + (b - a) * t; }
function replayLerpAngle(a, b, t) {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

// PEDIDO/DEBUG: tenta achar o Object3D do SEU avião por vários nomes
// comuns, já que não tenho acesso a vehicle-core.js/physics.js pra
// confirmar o nome exato da variável. Se NENHUM desses existir, o avião
// local não se move durante o replay (só os remotos/bots, que usam
// remotePlayers/enemyBots — esses eu tenho certeza que existem, porque
// aparecem em multiplayer.js/scoreboard.js). Rode no console do
// navegador, durante o voo: digite "localParts" e me mande o que
// aparecer, pra eu travar o nome certo.
function getLocalPlaneMesh() {
  if (typeof localParts !== 'undefined' && localParts && localParts.group) return localParts.group;
  if (typeof playerParts !== 'undefined' && playerParts && playerParts.group) return playerParts.group;
  if (typeof vehicleParts !== 'undefined' && vehicleParts && vehicleParts.group) return vehicleParts.group;
  if (typeof myParts !== 'undefined' && myParts && myParts.group) return myParts.group;
  if (typeof vehicle !== 'undefined' && vehicle && vehicle.isObject3D) return vehicle;
  if (typeof playerVehicle !== 'undefined' && playerVehicle && playerVehicle.isObject3D) return playerVehicle;
  if (typeof playerMesh !== 'undefined' && playerMesh && playerMesh.isObject3D) return playerMesh;
  return null;
}

// PEDIDO/CORREÇÃO: o bug real não era a câmera nem o avião — era que
// QUALQUER explosão/míssil/bomba/bala que já existisse na cena (do
// combate real, momentos antes da morte) continuava VISÍVEL e
// CONGELADA durante o replay inteiro (updateExplosions/updateMissiles/
// updateBombs/updateMachineGunBullets não rodam com o replay ativo,
// então nada nesses arrays anima nem some). Resultado: você via os
// aviões voltando no tempo, só que com a explosão (que só devia
// aparecer no final, no clímax) já parada ali desde o primeiro quadro.
// Por isso escondemos tudo isso ao começar o replay, e devolvemos a
// visibilidade exatamente como estava ao terminar.
function hideDynamicEffectsForReplay() {
  const hidden = [];
  const hideObj = (o) => { if (o && o.visible !== false) { hidden.push(o); o.visible = false; } };

  if (typeof explosions !== 'undefined' && explosions) {
    explosions.forEach(exp => { hideObj(exp.points); hideObj(exp.ring); });
  }
  if (typeof missiles !== 'undefined' && missiles) {
    missiles.forEach(m => { hideObj(m.mesh); hideObj(m.trail); });
  }
  if (typeof bombs !== 'undefined' && bombs) {
    bombs.forEach(b => hideObj(b.mesh));
  }
  if (typeof machineGunBullets !== 'undefined' && machineGunBullets) {
    machineGunBullets.forEach(b => hideObj(b.mesh));
  }
  return hidden;
}

function restoreDynamicEffectsAfterReplay(hidden) {
  if (!hidden) return;
  hidden.forEach(o => { o.visible = true; });
}

// Aplica de volta um quadro interpolado nos objetos 3D REAIS da cena
// (seu avião, os remotos e os bots) — assim a mesma cena/renderer do
// jogo mostra exatamente a posição gravada daquele instante, sem
// precisar duplicar geometria nem criar uma cena paralela.
function applyReplayFrameToScene(frameA, frameB, t) {
  const localMesh = getLocalPlaneMesh();
  if (localMesh && frameA.local && frameB.local) {
    localMesh.position.set(
      replayLerp(frameA.local.pos.x, frameB.local.pos.x, t),
      replayLerp(frameA.local.pos.y, frameB.local.pos.y, t),
      replayLerp(frameA.local.pos.z, frameB.local.pos.z, t)
    );
    localMesh.rotation.set(
      replayLerp(frameA.local.pitch, frameB.local.pitch, t),
      replayLerpAngle(frameA.local.yaw, frameB.local.yaw, t),
      replayLerp(frameA.local.roll, frameB.local.roll, t)
    );
  }

  if (typeof remotePlayers !== 'undefined' && remotePlayers) {
    remotePlayers.forEach((rp, id) => {
      const a = frameA.remotes && frameA.remotes[id];
      const b = frameB.remotes && frameB.remotes[id];
      if (!a || !b || !rp.mesh) return;
      rp.mesh.position.set(replayLerp(a.pos.x, b.pos.x, t), replayLerp(a.pos.y, b.pos.y, t), replayLerp(a.pos.z, b.pos.z, t));
      rp.mesh.rotation.set(replayLerp(a.rot.x, b.rot.x, t), replayLerpAngle(a.rot.y, b.rot.y, t), replayLerp(a.rot.z, b.rot.z, t));
      if (!rp.mesh.parent && typeof scene !== 'undefined') scene.add(rp.mesh);
    });
  }

  if (typeof enemyBots !== 'undefined' && enemyBots) {
    enemyBots.forEach((e, idx) => {
      const a = frameA.bots && frameA.bots[idx];
      const b = frameB.bots && frameB.bots[idx];
      if (!a || !b || !e.mesh) return;
      e.mesh.position.set(replayLerp(a.pos.x, b.pos.x, t), replayLerp(a.pos.y, b.pos.y, t), replayLerp(a.pos.z, b.pos.z, t));
      e.mesh.rotation.set(replayLerp(a.rot.x, b.rot.x, t), replayLerpAngle(a.rot.y, b.rot.y, t), replayLerp(a.rot.z, b.rot.z, t));
    });
  }
}

function getReplayFocusPosition(frame, entityId) {
  const e = findEntityInFrame(frame, entityId);
  if (e && e.pos && typeof THREE !== 'undefined') return new THREE.Vector3(e.pos.x, e.pos.y, e.pos.z);
  return null;
}

// ================================================================
//  REPRODUÇÃO — chamada todo frame pelo main.js enquanto isReplayActive()
//  for true. Não roda o próprio loop de render: quem chama
//  renderer.render(scene, camera) continua sendo o animate() do
//  main.js, isso aqui só posiciona a câmera/os aviões antes disso.
// ================================================================
// onClimax(focusPos) — opcional — é chamado UMA vez, perto do fim da
// reprodução (sincronizado com o instante exato do abate no clipe), pra
// quem chamou poder criar a explosão/efeito NA HORA CERTA em vez de já
// ter acontecido antes do replay começar (isso é o que causava "a
// explosão já aconteceu" antes desse ajuste).
function beginReplayPlayback(clip, label, onComplete, onClimax) {
  try {
    _beginReplayPlaybackImpl(clip, label, onComplete, onClimax);
  } catch (err) {
    // PEDIDO/CORREÇÃO CRÍTICA: qualquer erro aqui dentro NÃO PODE travar
    // o jogo. Antes, um erro no meio disso deixava a tela preta pra
    // sempre (o replay nunca terminava, o HUD normal nunca voltava).
    // Agora: loga o erro, limpa tudo que essa tentativa de replay possa
    // ter deixado pela metade, e segue o jogo normalmente (sem replay).
    console.error('[replay] erro ao iniciar o replay — pulando o replay pra não travar o jogo:', err);
    replayState = null;
    document.body.classList.remove('replay-active');
    const overlay = document.getElementById('replay-overlay');
    if (overlay) overlay.classList.add('hidden');
    if (onComplete) onComplete();
  }
}

function _beginReplayPlaybackImpl(clip, label, onComplete, onClimax) {
  if (!clip || !clip.frames || clip.frames.length < 2) { if (onComplete) onComplete(); return; }

  document.body.classList.add('replay-active');
  const overlay = document.getElementById('replay-overlay');
  const subEl = document.getElementById('replay-sub-label');
  if (overlay) overlay.classList.remove('hidden');
  if (subEl) subEl.textContent = label || 'Repetição do abate';
  if (typeof silenceAllEngines === 'function') silenceAllEngines();

  replayState = {
    clip, onComplete, onClimax,
    climaxFired: false,
    startWall: performance.now(),
    t0: clip.frames[0].t,
    savedCamPos: (typeof camera !== 'undefined') ? camera.position.clone() : null,
    savedCamQuat: (typeof camera !== 'undefined') ? camera.quaternion.clone() : null,
    hiddenEffects: hideDynamicEffectsForReplay(),
  };
}

function updateReplayPlayback(dt) {
  try {
    _updateReplayPlaybackImpl(dt);
  } catch (err) {
    // PEDIDO/CORREÇÃO CRÍTICA: mesma lógica — se ALGO quebrar no meio da
    // reprodução (quadro corrompido, mesh sumiu no meio do caminho etc.),
    // aborta o replay imediatamente e devolve o jogo pro normal, em vez
    // de ficar re-lançando o mesmo erro pra sempre (que é o que travava
    // a tela preta: o renderer.render() do main.js nunca era alcançado).
    console.error('[replay] erro durante a reprodução — abortando o replay pra não travar o jogo:', err);
    forceAbortReplay();
  }
}

function forceAbortReplay() {
  const rs = replayState;
  replayState = null;
  document.body.classList.remove('replay-active');
  const overlay = document.getElementById('replay-overlay');
  if (overlay) overlay.classList.add('hidden');
  if (rs) {
    try {
      if (typeof camera !== 'undefined' && rs.savedCamPos) {
        camera.position.copy(rs.savedCamPos);
        camera.quaternion.copy(rs.savedCamQuat);
      }
    } catch (e) { /* ignora — prioridade é não travar */ }
    try { restoreDynamicEffectsAfterReplay(rs.hiddenEffects); } catch (e) { /* idem */ }
    if (rs.onComplete) { try { rs.onComplete(); } catch (e) { console.error('[replay] erro no onComplete:', e); } }
  }
}

function _updateReplayPlaybackImpl(dt) {
  const rs = replayState;
  if (!rs) return;
  const elapsed = (performance.now() - rs.startWall) / 1000;
  const frames = rs.clip.frames;

  let fA, fB, localT;
  if (elapsed <= REPLAY_PRE_SECONDS) {
    // FASE 1 — rewind: percorre os quadros gravados ANTES do abate.
    const target = rs.t0 + elapsed;
    let i = 0;
    while (i < frames.length - 2 && frames[i + 1].t < target) i++;
    fA = frames[i];
    fB = frames[Math.min(i + 1, frames.length - 1)];
    const span = Math.max(0.0001, fB.t - fA.t);
    localT = Math.max(0, Math.min(1, (target - fA.t) / span));
  } else {
    // FASE 2 — pós-abate: segura tudo parado no ÚLTIMO quadro gravado
    // (o instante exato do impacto), pra dar tempo de ver o resultado.
    fA = frames[frames.length - 1];
    fB = fA;
    localT = 0;
  }

  applyReplayFrameToScene(fA, fB, localT);

  let focus = null;
  if (typeof camera !== 'undefined') {
    const victimPos = getReplayFocusPosition(fB, rs.clip.victimId);
    const killerPos = getReplayFocusPosition(fB, rs.clip.killerId);
    focus = victimPos || killerPos;
    if (focus) {
      const hasBoth = !!(victimPos && killerPos);
      const midpoint = hasBoth ? victimPos.clone().add(killerPos).multiplyScalar(0.5) : focus;
      const dist = hasBoth ? Math.max(9, victimPos.distanceTo(killerPos) * 1.7) : 15;
      const angle = 0.3 + elapsed * 0.9; // orbita devagar em volta da cena durante o replay
      const camOffset = new THREE.Vector3(Math.sin(angle) * dist, dist * 0.4 + 4, Math.cos(angle) * dist);
      camera.position.copy(midpoint).add(camOffset);
      camera.lookAt(midpoint);
    }
  }

  // PEDIDO: o "clímax" (explosão + reaparecimento de qualquer explosão/
  // míssil que já existia antes do replay) acontece exatamente na
  // transição da fase 1 pra fase 2 — ou seja, no instante exato do
  // abate, não antes e não só lá no finalzinho.
  if (!rs.climaxFired && elapsed >= REPLAY_PRE_SECONDS) {
    rs.climaxFired = true;
    restoreDynamicEffectsAfterReplay(rs.hiddenEffects);
    if (rs.onClimax) rs.onClimax(focus);
  }

  if (elapsed >= REPLAY_TOTAL_SECONDS) endReplayPlayback();
}

function endReplayPlayback() {
  const rs = replayState;
  if (!rs) return;
  replayState = null;
  document.body.classList.remove('replay-active');
  const overlay = document.getElementById('replay-overlay');
  if (overlay) overlay.classList.add('hidden');
  if (typeof camera !== 'undefined' && rs.savedCamPos) {
    camera.position.copy(rs.savedCamPos);
    camera.quaternion.copy(rs.savedCamQuat);
  }
  if (!rs.climaxFired) restoreDynamicEffectsAfterReplay(rs.hiddenEffects); // segurança, caso o clímax nunca tenha disparado
  const cb = rs.onComplete;
  if (cb) cb();
}