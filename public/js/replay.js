// replay.js – gravação e reprodução de projéteis (mísseis, bombas, balas)
// ================================================================
//  REPLAY DE ABATE (KILLCAM) — grava um histórico curto de posição dos
//  aviões E dos projéteis ativos a cada amostra. Na reprodução, os
//  projéteis são recriados a partir dos dados gravados e interpolados
//  suavemente entre amostras (em vez de "pular" de posição em posição).
//
//  REVISÃO NESTA VERSÃO (pedido: "deixar muito melhor"):
//   1) TAXA DE AMOSTRAGEM MAIOR: de 10 amostras/seg pra 20 amostras/seg
//      (REPLAY_SAMPLE_DT 0.1 -> 0.05) — movimento mais suave, tanto dos
//      aviões quanto dos projéteis.
//   2) PROJÉTEIS COM POOL REAPROVEITÁVEL (correção de performance
//      importante): a versão anterior chamava `clearReplayProjectiles()`
//      + `createReplayProjectile()` a CADA FRAME DE TELA (60x/seg),
//      destruindo e recriando geometrias/materiais/meshes toda hora —
//      isso é caro (aloca memória e força garbage collection sem parar,
//      é a receita clássica de engasgo/soluço visual). Agora existe um
//      "pool" por tipo (mísseis/bombas/balas): os objetos 3D só são
//      criados/destruídos quando o NÚMERO de projéteis muda entre uma
//      amostra e outra — a cada frame de tela normal, só a POSIÇÃO deles
//      é atualizada (interpolada suavemente entre a amostra anterior e a
//      seguinte), que é praticamente de graça.
//   3) CÂMERA: mais perto da vítima (o foco principal do replay), com um
//      leve balanço suave (bem pequeno, bem lento) em vez de ficar
//      travada 100% estática — mas SEM voltar a girar continuamente
//      (isso já foi tirado antes por causa de reclamação de vertigem;
//      aqui é só uma respiração sutil de câmera, não uma órbita).
// ================================================================

const REPLAY_HISTORY_SECONDS = 8;
const REPLAY_SAMPLE_DT = 0.05; // 20 amostras/seg (era 0.1 = 10/seg)
const REPLAY_PRE_SECONDS = 4.0;
const REPLAY_POST_SECONDS = 1.0;
const REPLAY_TOTAL_SECONDS = REPLAY_PRE_SECONDS + REPLAY_POST_SECONDS;

let replayBuffer = [];
let replayClock = 0;
let replaySampleAccum = 0;
let replayState = null;
let lastKillClip = null;

function isReplayActive() { return !!replayState; }

function resetReplayBuffer() {
  replayBuffer = [];
  replayClock = 0;
  replaySampleAccum = 0;
  lastKillClip = null;
  // CORREÇÃO: faltava limpar o POOL VISUAL de projéteis do replay aqui.
  // Se uma partida terminasse (ou uma nova começasse) enquanto ainda
  // existiam mísseis/bombas/balas "fantasmas" do replay anterior na
  // cena, eles ficavam pra sempre — daí aparecer uma bomba flutuando
  // parada no ar logo na partida seguinte. resetReplayBuffer() já é
  // chamado em todo início de partida nova (goToMenu, restartGame,
  // beginOnlineMatch), então limpar o pool aqui cobre todos os casos de
  // uma vez.
  if (typeof clearReplayProjectiles === 'function') clearReplayProjectiles();
}

// ================================================================
//  SERIALIZAÇÃO DE PROJÉTEIS (gravação — dados puros, sem THREE)
// ================================================================
function serializeProjectiles() {
  const result = { missiles: [], bombs: [], bullets: [] };

  if (typeof missiles !== 'undefined' && missiles) {
    missiles.forEach(m => {
      result.missiles.push({
        pos: { x: m.position.x, y: m.position.y, z: m.position.z },
        vel: { x: m.velocity.x, y: m.velocity.y, z: m.velocity.z },
        color: m.color || 0x00e5ff,
      });
    });
  }

  if (typeof bombs !== 'undefined' && bombs) {
    bombs.forEach(b => {
      result.bombs.push({
        pos: { x: b.position.x, y: b.position.y, z: b.position.z },
        vel: { x: b.velocity.x, y: b.velocity.y, z: b.velocity.z },
        color: b.color || 0xff0000,
        fireTrail: !!b.fireTrail,
        fireTrailColor: b.fireTrailColor || null,
      });
    });
  }

  if (typeof machineGunBullets !== 'undefined' && machineGunBullets) {
    machineGunBullets.forEach(b => {
      result.bullets.push({
        pos: { x: b.position.x, y: b.position.y, z: b.position.z },
        vel: { x: b.velocity.x, y: b.velocity.y, z: b.velocity.z },
        color: (b.mesh && b.mesh.material && b.mesh.material.color && b.mesh.material.color.getHex) ? b.mesh.material.color.getHex() : 0xff8800,
        isBolt: !!(b.mesh && b.mesh.userData && b.mesh.userData.isBolt),
        boltLength: (b.mesh && b.mesh.userData && b.mesh.userData.boltLength) || 2.4,
        boltRadius: (b.mesh && b.mesh.userData && b.mesh.userData.boltRadius) || 0.055,
      });
    });
  }

  return result;
}

// ---- Gravação ----
function recordReplayFrame(dt) {
  if (replayState) return; // não grava durante o próprio replay
  replayClock += dt;
  replaySampleAccum += dt;
  if (replaySampleAccum < REPLAY_SAMPLE_DT) return;
  replaySampleAccum = 0;

  const frame = {
    t: replayClock,
    local: null,
    remotes: {},
    bots: {},
    projectiles: serializeProjectiles(),
  };

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

// ---- Captura ----
function captureKillClip(victimId, killerId) {
  if (replayBuffer.length < 2) return null;
  const clipStart = replayClock - REPLAY_PRE_SECONDS;
  const frames = replayBuffer.filter(f => f.t >= clipStart).map(f => JSON.parse(JSON.stringify(f)));
  if (frames.length < 2) return null;
  return { frames, victimId: victimId || null, killerId: killerId || null };
}

// ---- Ajudantes de interpolação ----
function replayLerp(a, b, t) { return a + (b - a) * t; }
function replayLerpAngle(a, b, t) {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

// ---- Buscar entidade num frame gravado ----
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

function getReplayFocusPosition(frame, entityId) {
  const e = findEntityInFrame(frame, entityId);
  if (e && e.pos && typeof THREE !== 'undefined') return new THREE.Vector3(e.pos.x, e.pos.y, e.pos.z);
  return null;
}

// ---- Obter o mesh do avião local ----
function getLocalPlaneMesh() {
  if (typeof vehicle !== 'undefined' && vehicle && vehicle.isObject3D) return vehicle;
  if (typeof localParts !== 'undefined' && localParts && localParts.group) return localParts.group;
  return null;
}

// ---- Esconder/restaurar efeitos dinâmicos originais (explosões etc.) ----
function hideDynamicEffectsForReplay() {
  const hidden = [];
  const hideObj = (o) => { if (o && o.visible !== false) { hidden.push(o); o.visible = false; } };
  if (typeof explosions !== 'undefined' && explosions) {
    explosions.forEach(exp => { hideObj(exp.points); hideObj(exp.ring); });
  }
  return hidden;
}
function restoreDynamicEffectsAfterReplay(hidden) {
  if (!hidden) return;
  hidden.forEach(o => { o.visible = true; });
}

// ================================================================
//  POOL DE PROJÉTEIS DO REPLAY — criados uma vez, só reposicionados
// ================================================================
const replayProjectilePool = { missiles: [], bombs: [], bullets: [] };

function _disposeReplayEntry(entry) {
  if (!entry) return;
  if (entry.mesh) {
    scene.remove(entry.mesh);
    if (entry.mesh.traverse) {
      entry.mesh.traverse(o => {
        if (o.geometry && o.geometry.dispose) o.geometry.dispose();
        if (o.material && o.material.dispose) o.material.dispose();
      });
    }
  }
  if (entry.trail) {
    scene.remove(entry.trail);
    if (entry.trail.geometry) entry.trail.geometry.dispose();
    if (entry.trail.material) entry.trail.material.dispose();
  }
}

function clearReplayProjectiles() {
  ['missiles', 'bombs', 'bullets'].forEach(kind => {
    replayProjectilePool[kind].forEach(_disposeReplayEntry);
    replayProjectilePool[kind].length = 0;
  });
}

function _makeMissileEntry(color) {
  const sphereMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.0, roughness: 0.15, metalness: 0.05 });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 12), sphereMat);
  mesh.castShadow = true;
  scene.add(mesh);
  return { mesh, mat: sphereMat };
}

function _makeBombEntry(color, withTrail, trailColor) {
  const bombMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.4, emissive: color, emissiveIntensity: 0.4 });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 10), bombMat);
  mesh.castShadow = true;
  scene.add(mesh);
  let trail = null;
  if (withTrail) {
    const trailMat = new THREE.PointsMaterial({ color: trailColor || 0xff4400, size: 0.5, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.55, depthWrite: false, sizeAttenuation: true });
    const positions = new Float32Array(12 * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    trail = new THREE.Points(geometry, trailMat);
    scene.add(trail);
  }
  return { mesh, trail, mat: bombMat };
}

function _makeBulletEntry(color, isBolt, boltLength, boltRadius) {
  let mesh;
  if (isBolt) {
    const group = new THREE.Group();
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const core = new THREE.Mesh(new THREE.CylinderGeometry(boltRadius * 0.4, boltRadius * 0.4, boltLength, 6), coreMat);
    core.rotation.x = Math.PI / 2;
    group.add(core);
    const glowMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(boltRadius, boltRadius * 1.3, boltLength, 8), glowMat);
    glow.rotation.x = Math.PI / 2;
    group.add(glow);
    mesh = group;
  } else {
    const bulletMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.5 });
    mesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), bulletMat);
    mesh.castShadow = true;
  }
  scene.add(mesh);
  return { mesh };
}

function _ensurePoolSize(kind, count, sampleData) {
  const pool = replayProjectilePool[kind];
  while (pool.length < count) {
    const d = sampleData[pool.length] || sampleData[0] || {};
    let entry;
    if (kind === 'missiles') entry = _makeMissileEntry(d.color || 0x00e5ff);
    else if (kind === 'bombs') entry = _makeBombEntry(d.color || 0xff0000, !!d.fireTrail, d.fireTrailColor);
    else entry = _makeBulletEntry(d.color || 0xff8800, !!d.isBolt, d.boltLength || 2.4, d.boltRadius || 0.055);
    pool.push(entry);
  }
  while (pool.length > count) {
    _disposeReplayEntry(pool.pop());
  }
}

const _projTmpDir = new THREE.Vector3();
function _updatePoolPositions(kind, listA, listB, t) {
  const count = (listA || []).length;
  _ensurePoolSize(kind, count, listA || []);
  const pool = replayProjectilePool[kind];
  for (let i = 0; i < count; i++) {
    const a = listA[i];
    const b = (listB && listB[i]) ? listB[i] : a;
    const entry = pool[i];
    if (!entry || !entry.mesh) continue;
    const x = replayLerp(a.pos.x, b.pos.x, t);
    const y = replayLerp(a.pos.y, b.pos.y, t);
    const z = replayLerp(a.pos.z, b.pos.z, t);
    entry.mesh.position.set(x, y, z);
    if (kind === 'bullets' && a.isBolt && a.vel) {
      _projTmpDir.set(a.vel.x, a.vel.y, a.vel.z);
      if (_projTmpDir.lengthSq() > 0.0001) {
        _projTmpDir.normalize();
        entry.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _projTmpDir);
      }
    }
    if (kind === 'bombs' && entry.trail) {
      const positions = entry.trail.geometry.attributes.position.array;
      for (let p = 0; p < 12; p++) {
        positions[p * 3] = x + (Math.random() - 0.5) * 0.4;
        positions[p * 3 + 1] = y + (Math.random() - 0.5) * 0.4;
        positions[p * 3 + 2] = z + (Math.random() - 0.5) * 0.4;
      }
      entry.trail.geometry.attributes.position.needsUpdate = true;
    }
  }
}

function updateReplayProjectiles(projA, projB, t) {
  if (!projA) return;
  _updatePoolPositions('missiles', projA.missiles, projB && projB.missiles, t);
  _updatePoolPositions('bombs', projA.bombs, projB && projB.bombs, t);
  _updatePoolPositions('bullets', projA.bullets, projB && projB.bullets, t);
}

// ---- Aplicar quadro interpolado na cena (aviões) ----
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

  updateReplayProjectiles(frameA.projectiles, frameB.projectiles, t);
}

// ================================================================
//  CONTROLE DE REPRODUÇÃO
// ================================================================
function beginReplayPlayback(clip, label, onComplete, onClimax) {
  try {
    _beginReplayPlaybackImpl(clip, label, onComplete, onClimax);
  } catch (err) {
    console.error('[replay] erro ao iniciar o replay — pulando:', err);
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

  clearReplayProjectiles();

  replayState = {
    clip, onComplete, onClimax,
    climaxFired: false,
    savedVehicleVisible: (typeof vehicle !== 'undefined' && vehicle) ? vehicle.visible : null,
    elapsed: 0,
    t0: clip.frames[0].t,
    savedCamPos: (typeof camera !== 'undefined') ? camera.position.clone() : null,
    savedCamQuat: (typeof camera !== 'undefined') ? camera.quaternion.clone() : null,
    hiddenEffects: hideDynamicEffectsForReplay(),
  };
  if (typeof vehicle !== 'undefined' && vehicle) vehicle.visible = true;
}

function forceAbortReplay() {
  const rs = replayState;
  replayState = null;
  document.body.classList.remove('replay-active');
  const overlay = document.getElementById('replay-overlay');
  if (overlay) overlay.classList.add('hidden');
  clearReplayProjectiles();
  if (_replayTracerMesh && typeof scene !== 'undefined') {
    scene.remove(_replayTracerMesh);
    _replayTracerMesh.geometry.dispose();
    _replayTracerMesh.material.dispose();
    _replayTracerMesh = null;
  }
  if (rs) {
    if (typeof vehicle !== 'undefined' && vehicle && rs.savedVehicleVisible !== null && rs.savedVehicleVisible !== undefined) {
      vehicle.visible = rs.savedVehicleVisible;
    }
    try {
      if (typeof camera !== 'undefined' && rs.savedCamPos) {
        camera.position.copy(rs.savedCamPos);
        camera.quaternion.copy(rs.savedCamQuat);
      }
    } catch (e) {}
    try { restoreDynamicEffectsAfterReplay(rs.hiddenEffects); } catch (e) {}
    if (rs.onComplete) { try { rs.onComplete(); } catch (e) {} }
  }
}

const REPLAY_WATCHDOG_MAX_MS = 20000;
let _replayWatchdogStartedAt = null;
setInterval(() => {
  if (!replayState) { _replayWatchdogStartedAt = null; return; }
  if (_replayWatchdogStartedAt === null) _replayWatchdogStartedAt = performance.now();
  if (performance.now() - _replayWatchdogStartedAt > REPLAY_WATCHDOG_MAX_MS) {
    console.warn('[replay] watchdog: replay preso por tempo demais — forçando o fim.');
    _replayWatchdogStartedAt = null;
    forceAbortReplay();
  }
}, 2000);

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && isReplayActive()) forceAbortReplay();
  });
}

function updateReplayPlayback(dt) {
  try {
    _updateReplayPlaybackImpl(dt);
  } catch (err) {
    console.error('[replay] erro durante a reprodução — abortando:', err);
    forceAbortReplay();
  }
}

function _updateReplayPlaybackImpl(dt) {
  const rs = replayState;
  if (!rs) return;
  rs.elapsed += Math.max(0, Math.min(dt, 0.05));
  const elapsed = rs.elapsed;
  const frames = rs.clip.frames;

  let fA, fB, localT;
  if (elapsed <= REPLAY_PRE_SECONDS) {
    const target = rs.t0 + elapsed;
    let i = 0;
    while (i < frames.length - 2 && frames[i + 1].t < target) i++;
    fA = frames[i];
    fB = frames[Math.min(i + 1, frames.length - 1)];
    const span = Math.max(0.0001, fB.t - fA.t);
    localT = Math.max(0, Math.min(1, (target - fA.t) / span));
  } else {
    fA = frames[frames.length - 1];
    fB = fA;
    localT = 0;
  }

  applyReplayFrameToScene(fA, fB, localT);

  if (typeof camera !== 'undefined') {
    const victimPos = getReplayFocusPosition(fB, rs.clip.victimId);
    const killerPos = getReplayFocusPosition(fB, rs.clip.killerId);
    const target = victimPos || killerPos;
    if (target) {
      let camDir = new THREE.Vector3(0, 0, 1);
      if (victimPos && killerPos) {
        camDir.subVectors(killerPos, victimPos).normalize();
      }
      const breathe = Math.sin(elapsed * 0.35) * 0.12;
      const sideAxis = new THREE.Vector3(0, 1, 0).cross(camDir).normalize();
      camDir.addScaledVector(sideAxis, breathe).normalize();

      const postT = Math.max(0, Math.min(1, (elapsed - REPLAY_PRE_SECONDS) / REPLAY_POST_SECONDS));
      const baseDist = 8.5;
      const finalDist = 3.2;
      const dist = THREE.MathUtils.lerp(baseDist, finalDist, postT);
      const offset = camDir.clone().multiplyScalar(-dist).add(new THREE.Vector3(0, 2.2, 0));
      const desiredPos = target.clone().add(offset);
      if (!rs._camPos) rs._camPos = desiredPos.clone();
      rs._camPos.lerp(desiredPos, Math.min(1, 5 * dt));
      camera.position.copy(rs._camPos);
      camera.lookAt(target);
    }
  }

  if (!rs.climaxFired && elapsed >= REPLAY_PRE_SECONDS) {
    rs.climaxFired = true;
    restoreDynamicEffectsAfterReplay(rs.hiddenEffects);
    const kp = getReplayFocusPosition(fB, rs.clip.killerId);
    const vp = getReplayFocusPosition(fB, rs.clip.victimId);
    if (kp && vp) spawnReplayTracer(kp, vp);
    if (rs.onClimax) rs.onClimax(null);
  }

  if (elapsed >= REPLAY_TOTAL_SECONDS) endReplayPlayback();
}

let _replayTracerMesh = null;
function spawnReplayTracer(fromPos, toPos) {
  if (typeof THREE === 'undefined' || typeof scene === 'undefined') return;
  if (_replayTracerMesh) { scene.remove(_replayTracerMesh); _replayTracerMesh.geometry.dispose(); _replayTracerMesh.material.dispose(); _replayTracerMesh = null; }
  const geo = new THREE.BufferGeometry().setFromPoints([fromPos.clone(), toPos.clone()]);
  const mat = new THREE.LineBasicMaterial({ color: 0xfff27a, transparent: true, opacity: 0.95 });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  _replayTracerMesh = line;
  const start = performance.now();
  const fade = () => {
    if (!_replayTracerMesh) return;
    const t = (performance.now() - start) / 350;
    if (t >= 1) { scene.remove(_replayTracerMesh); mat.dispose(); geo.dispose(); _replayTracerMesh = null; return; }
    mat.opacity = 0.95 * (1 - t);
    requestAnimationFrame(fade);
  };
  requestAnimationFrame(fade);
}

function endReplayPlayback() {
  const rs = replayState;
  if (!rs) return;
  replayState = null;
  document.body.classList.remove('replay-active');
  const overlay = document.getElementById('replay-overlay');
  if (overlay) overlay.classList.add('hidden');
  clearReplayProjectiles();
  if (_replayTracerMesh && typeof scene !== 'undefined') {
    scene.remove(_replayTracerMesh);
    _replayTracerMesh.geometry.dispose();
    _replayTracerMesh.material.dispose();
    _replayTracerMesh = null;
  }
  if (typeof camera !== 'undefined' && rs.savedCamPos) {
    camera.position.copy(rs.savedCamPos);
    camera.quaternion.copy(rs.savedCamQuat);
  }
  if (typeof vehicle !== 'undefined' && vehicle && rs.savedVehicleVisible !== null && rs.savedVehicleVisible !== undefined) {
    vehicle.visible = rs.savedVehicleVisible;
  }
  if (!rs.climaxFired) restoreDynamicEffectsAfterReplay(rs.hiddenEffects);
  const cb = rs.onComplete;
  if (cb) cb();
}