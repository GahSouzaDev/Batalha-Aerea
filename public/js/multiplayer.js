// multiplayer.js – COMPLETO COM SINCRONIA TOTAL DA HABILIDADE BIMOTOR
const remotePlayers = new Map();
const onlineState = { active: false, socket: null, myId: null, isHost: false, roomId: null, ready: false, isFreeRoom: false };
let currentMode = 'ffa';
let currentPlaneMode = 'livre';
let myTeam = null;
let combatEnabled = true;
let prepTimer = 0;
let lastKnownRoomState = null;
let matchEnded = false;

function silenceAllEngines() {
  if (localParts && localParts.engineSound) localParts.engineSound.setVolume(0);
  remotePlayers.forEach(rp => { if (rp.parts && rp.parts.engineSound) rp.parts.engineSound.setVolume(0); });
}
const PLANE_ICONS_MAP = PLANE_ICONS;

function leaveOnlineIfNeeded() {
  if (typeof voiceChatDisconnect === 'function') voiceChatDisconnect();
  if (typeof textChatReset === 'function') textChatReset();
  if (onlineState.socket) { onlineState.socket.disconnect(); onlineState.socket = null; }
  onlineState.active = false;
  onlineState.isFreeRoom = false;
  lastKnownRoomState = null;
  remotePlayers.forEach(rp => { detachEngineSound(rp.parts); if (rp.mesh.parent) scene.remove(rp.mesh); if (rp.label) rp.label.remove(); });
  remotePlayers.clear();
  document.getElementById('lobby-overlay').classList.add('hidden');
  document.getElementById('matchend-overlay').classList.add('hidden');
  hideLoadingScreen();
  if (window.remoteLaserMesh) {
    scene.remove(window.remoteLaserMesh);
    window.remoteLaserMesh.geometry.dispose();
    window.remoteLaserMesh.material.dispose();
    window.remoteLaserMesh = null;
  }
  if (window.remoteLaserLight) {
    scene.remove(window.remoteLaserLight);
    window.remoteLaserLight = null;
  }
}

function connectOnline(roomId, playerData, password) {
  const socket = io({ transports: ['websocket', 'polling'], reconnectionAttempts: 5, reconnectionDelay: 1000, timeout: 20000 });
  onlineState.socket = socket;
  onlineState.active = true;
  onlineState.isFreeRoom = false;

  socket.on('connect', () => {
    onlineState.myId = socket.id;
    if (roomId) {
      socket.emit('join-room', { roomId, password, playerData }, (res) => {
        if (!res.success) {
          document.getElementById('lobby-error').textContent = res.message || 'Erro ao entrar na sala.';
          document.getElementById('lobby-error').style.display = 'block';
          setTimeout(() => { leaveOnlineIfNeeded(); document.getElementById('main-menu').classList.remove('hidden'); }, 2000);
          return;
        }
        onlineState.roomId = roomId;
        document.getElementById('lobby-error').style.display = 'none';
        if (typeof voiceChatConnect === 'function') voiceChatConnect(playerData);
        if (typeof textChatOnConnect === 'function') textChatOnConnect();
      });
    } else {
      const createData = window.__pendingCreateRoom;
      socket.emit('create-room', createData, (res) => {
        if (!res.success) {
          document.getElementById('lobby-error').textContent = res.message || 'Erro ao criar sala.';
          document.getElementById('lobby-error').style.display = 'block';
          setTimeout(() => { leaveOnlineIfNeeded(); document.getElementById('main-menu').classList.remove('hidden'); }, 2000);
          return;
        }
        onlineState.roomId = res.roomId;
        document.getElementById('lobby-error').style.display = 'none';
        if (typeof voiceChatConnect === 'function') voiceChatConnect(createData.playerData);
        if (typeof textChatOnConnect === 'function') textChatOnConnect();
      });
    }
  });

  bindCommonSocketHandlers(socket);
}

// ================================================================
//  SALA LIVRE — entra direto numa partida persistente e sempre em
//  andamento, sem lobby, sem "pronto", sem host. Dá pra entrar e sair
//  a qualquer momento (o botão de menu, na pausa, já emite
//  'leave-room' normalmente). Ao entrar (ou reviver depois de abatido),
//  o servidor dá um tempo de decolagem sem levar dano só pra você —
//  isso chega pelo campo "invulnerable" do snapshot, que o jogo já
//  respeita (ver applyDamageToPlayer em player-lifecycle.js).
// ================================================================
function joinFreeRoom(playerData) {
  const socket = io({ transports: ['websocket', 'polling'], reconnectionAttempts: 5, reconnectionDelay: 1000, timeout: 20000 });
  onlineState.socket = socket;
  onlineState.active = true;
  onlineState.isFreeRoom = true;

  socket.on('connect', () => {
    onlineState.myId = socket.id;
    socket.emit('join-free-room', playerData, (res) => {
      if (!res || !res.success) {
        showTemporaryMessage('Não foi possível entrar na Sala Livre.', 2500);
        leaveOnlineIfNeeded();
        document.getElementById('main-menu').classList.remove('hidden');
        return;
      }
      onlineState.roomId = res.roomId;
    });
  });

  socket.on('free-room-enter', (data) => {
    beginOnlineMatch({ mode: 'ffa', map: data.map, planeMode: 'livre', players: data.players });
    showLoadingScreen(() => {
      showTemporaryMessage('🕊️ Sala Livre — decole com calma, você está protegido no início!', 3200);
    });
    if (typeof voiceChatConnect === 'function') voiceChatConnect(playerData);
        if (typeof textChatOnConnect === 'function') textChatOnConnect();
  });

  // Reaparecer sozinho, sem esperar ninguém: o servidor já escolheu um
  // novo ponto de spawn e mandou o tempo de invulnerabilidade junto
  // (chega pelo snapshot normal).
  socket.on('player-respawned', (data) => {
    const pos = data.position || { x: 0, y: 0.1, z: 0 };
    if (data.id === onlineState.myId) {
      revivePlayer();
      state.position.set(pos.x, pos.y, pos.z);
      state.yaw = data.yaw || 0;
    } else {
      const rp = remotePlayers.get(data.id);
      if (rp) {
        rp.alive = true;
        rp.mesh.position.set(pos.x, pos.y, pos.z);
        rp.targetPos.set(pos.x, pos.y, pos.z);
        rp.mesh.rotation.set(0, data.yaw || 0, 0);
        if (!rp.mesh.parent) scene.add(rp.mesh);
        rp.mesh.visible = true;
        if (rp.label) rp.label.el.style.display = '';
      }
    }
  });

  bindCommonSocketHandlers(socket);
}

// ===== addRemotePlayer =====
// Cria o avião/label de um jogador remoto. Usada tanto na entrada da
// partida (beginOnlineMatch, lista completa de uma vez) quanto quando
// alguém entra depois — na Sala Livre, que é persistente e sempre "em
// andamento" (ver socket.on('player-joined', ...) logo abaixo).
function addRemotePlayer(p) {
  if (p.id === onlineState.myId) return;
  if (remotePlayers.has(p.id)) return;
  const parts = createPlaneInstance(p.planeType || 'cessna', p.color, planeModelStyle);
  const grp = parts.group;
  const pos = p.position || { x: 0, y: 0.1, z: 0 };
  grp.position.set(pos.x, pos.y, pos.z);
  grp.rotation.set(0, p.yaw || 0, 0);
  scene.add(grp);
  attachEngineSound(parts, (PLANE_SPECS[p.planeType] || PLANE_SPECS.cessna).sound, false);
  const label = createEnemyLabel(p.name, p.color);
  remotePlayers.set(p.id, {
    mesh: grp, parts, label, alive: true, invisible: false,
    targetPos: new THREE.Vector3(pos.x, pos.y, pos.z),
    targetYaw: p.yaw || 0, targetPitch: 0, targetRoll: 0,
    team: p.team, _lastHealth: p.health != null ? p.health : 100, kills: 0, deaths: 0, _abilityTimeout: null, _trailInterval: null,
    planeType: p.planeType || 'cessna',
  });
}

// ================================================================
//  Handlers de socket compartilhados entre sala normal e sala livre.
// ================================================================
function bindCommonSocketHandlers(socket) {
  // CORREÇÃO: na Sala Livre (persistente, todo mundo entra em momentos
  // diferentes) quem já estava voando nunca ficava sabendo que alguém
  // novo entrou — o avião do novo jogador simplesmente não aparecia pra
  // quem já estava lá. O servidor agora avisa (ver server.js) e aqui a
  // gente só cria o avião remoto dessa pessoa, igual já fazíamos ao
  // entrar numa partida normal.
  socket.on('player-joined', (p) => { addRemotePlayer(p); });

  socket.on('room-update', (data) => {
    renderLobby(data);
    onlineState.isHost = (data.hostId === socket.id);
    lastKnownRoomState = data.state;
    updateScoreboardFromRoom(data);
  });

  socket.on('match-loading', (data) => {
    document.getElementById('lobby-overlay').classList.add('hidden');
    beginOnlineMatch(data);
  });

  socket.on('match-begin', (data) => {
    combatEnabled = false;
    prepTimer = data.prepTime || 14;
    matchEnded = false;
    hideLoadingScreen();
    announceTakeoff();
  });

  socket.on('snapshot', (data) => {
    prepTimer = data.prepTimer || 0;
    combatEnabled = !!data.combatEnabled;
    data.players.forEach(p => {
      if (p.id === onlineState.myId) {
        state.health = p.health;
        state.shield = p.shield || 0;
        state.kills = p.kills || 0;
        state.deaths = p.deaths || 0;
        state.specialActive = p.abilityActive || false;
        state.specialTimer = p.abilityTimer || 0;
        state.specialCooldown = p.abilityCooldown || 0;
        // CORREÇÃO (bug do F-22 se auto-abatendo, só em multiplayer):
        // o servidor só marca "invulnerable" true no respawn/decolagem —
        // ele não sabe nada sobre a invulnerabilidade que roda 100% no
        // cliente durante habilidades (campo do Jato, sobrecarga do
        // Bimotor, carga/rajada do F-22). Como o snapshot chega em
        // paralelo ao loop local (abilities.js), ele podia pousar bem no
        // meio da janela de invulnerabilidade da habilidade e sobrescrever
        // state.invulnerable de volta pra "false" — no exato instante em
        // que a onda de choque do F-22 disparava, isso fazia o dano da
        // própria explosão valer contra o próprio jogador. Enquanto uma
        // habilidade local está ativa, quem manda na invulnerabilidade é
        // o cliente (abilities.js/physics.js), não o snapshot do servidor.
        if (!state.specialActive) {
          state.invulnerable = !!p.invulnerable;
        }
        if (p.state === 'dead' && !state.isDead) killPlayer();
        if (p.state === 'alive' && state.isDead) revivePlayer();
        return;
      }
      const rp = remotePlayers.get(p.id);
      if (!rp) return;
      rp.targetPos.set(p.position.x, p.position.y, p.position.z);
      rp.targetYaw = p.yaw || 0;
      rp.targetPitch = p.pitch || 0;
      rp.targetRoll = p.roll || 0;
      rp.alive = (p.state === 'alive');
      rp.invisible = !!p.invisible;
      rp._lastHealth = p.health;
      rp.kills = p.kills || 0;
      rp.deaths = p.deaths || 0;
      if (rp.alive && !rp.mesh.parent) scene.add(rp.mesh);
      if (!rp.alive && rp.mesh.parent) scene.remove(rp.mesh);
      rp.mesh.visible = rp.alive && !rp.invisible;
      if (rp.label) { rp.label.setHealth(p.health, MAX_HEALTH); rp.label.el.style.display = (rp.alive && !rp.invisible) ? '' : 'none'; }
    });
    updateScoreboardFromRoom(null);
  });

  socket.on('combat-enabled', () => { combatEnabled = true; showTemporaryMessage('⚔️ COMBATE LIBERADO!', 1800); playSound('checkpoint'); announceCombatStart(); });

  socket.on('shot-fired', (data) => {
    const origin = new THREE.Vector3(data.origin[0], data.origin[1], data.origin[2]);
    const dir = new THREE.Vector3(data.direction[0], data.direction[1], data.direction[2]);
    const isSuper = data.weaponType === 'missile';
    const abilityColor = data.weaponType === 'ability-missile' ? (data.color || 0xff0000) : undefined;
    // PEDIDO (míssil lento do AMX): replica a velocidade reduzida também
    // pra quem vê o míssil de outro jogador, senão pareceria mais rápido
    // do que realmente é.
    const opts = (data.weaponType === 'ability-missile' && data.speed) ? { speed: data.speed } : undefined;
    spawnMissile(isSuper, origin, dir, true, abilityColor, opts);
  });

  socket.on('bomb-fired', (data) => {
    const origin = new THREE.Vector3(data.origin[0], data.origin[1], data.origin[2]);
    const velocity = data.velocity
      ? new THREE.Vector3(data.velocity[0], data.velocity[1], data.velocity[2])
      : new THREE.Vector3(0, -1.5, 0);
    if (data.isSpecial) {
      dropSpecialBomb(origin, velocity, data.color || 0xff0000, data.damageFactor || 1.0, data.radiusFactor || 1.0, true, data.sizeScale || 1.0, data.explosionColor || null);
    } else {
      dropBomb(true, origin, velocity);
    }
  });

  socket.on('mg-fired', (data) => {
    const origin = new THREE.Vector3(data.origin[0], data.origin[1], data.origin[2]);
    const dir = new THREE.Vector3(data.direction[0], data.direction[1], data.direction[2]);
    const color = data.color != null ? data.color : 0xff0000;
    const speed = data.speed != null ? data.speed : 78;
    const bulletMat = new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 1.5 });
    const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), bulletMat);
    bullet.position.copy(origin);
    scene.add(bullet);
    machineGunBullets.push({ mesh: bullet, position: origin.clone(), velocity: dir.clone().multiplyScalar(speed), life: 1.2, dmg: 0, remote: true });
  });

  socket.on('health-update', (data) => {
    if (data.id === onlineState.myId) {
      state.health = data.health;
      state.shield = data.shield || 0;
    } else {
      const rp = remotePlayers.get(data.id);
      if (rp && rp.label) {
        const oldHealth = rp._lastHealth != null ? rp._lastHealth : 100;
        if (data.health < oldHealth) { flashRemote(data.id); playSound('hit'); }
        rp._lastHealth = data.health;
        rp.label.setHealth(data.health, MAX_HEALTH);
      }
    }
    updateScoreboardFromRoom(null);
  });

  socket.on('player-killed', (data) => {
    if (data.id === onlineState.myId) { killPlayer(); playSound('death'); }
    else {
      const rp = remotePlayers.get(data.id);
      if (rp) { rp.alive = false; createExplosion(rp.mesh.position.clone(), true); detachEngineSound(rp.parts); if (rp.mesh.parent) scene.remove(rp.mesh); if (rp.label) rp.label.el.style.display = 'none'; }
    }
    // PEDIDO: feed de abates — mostra quem abateu quem na tela.
    if (typeof pushKillFeed === 'function') {
      const killerName = data.killerName || 'Alguém';
      const targetName = data.targetName || 'Alguém';
      if (!data.killerId || data.killerId === data.id) {
        pushKillFeed('💥 ' + targetName + ' foi abatido');
      } else {
        pushKillFeed('🎯 ' + killerName + ' abateu ' + targetName);
      }
    }
    // Narração por voz do abate — todo mundo na sala recebe este mesmo
    // evento do servidor, então todo mundo ouve o anúncio no mesmo momento.
    if (!data.killerId || data.killerId === data.id) {
      announceKill(null, data.targetName);
    } else {
      announceKill(data.killerName, data.targetName);
    }
    updateScoreboardFromRoom(null);
  });

  socket.on('ability-activated', (data) => {
    const rp = remotePlayers.get(data.id);
    if (!rp) return;

    const toRemove = [];
    rp.mesh.children.forEach(c => {
      if (['remote-shield', 'remote-field', 'remote-trail', 'remote-glow', 'remote-glow2'].includes(c.name)) toRemove.push(c);
    });
    toRemove.forEach(c => rp.mesh.remove(c));
    if (rp._abilityTimeout) { clearTimeout(rp._abilityTimeout); rp._abilityTimeout = null; }
    if (rp._trailInterval) { clearInterval(rp._trailInterval); rp._trailInterval = null; }

    const clearRemoteEffect = () => {
      rp.mesh.children.filter(c => c.name === 'remote-field' || c.name === 'remote-glow' || c.name === 'remote-glow2').forEach(c => rp.mesh.remove(c));
      if (rp._trailInterval) { clearInterval(rp._trailInterval); rp._trailInterval = null; }
    };

    if ((data.type || rp.planeType) === 'jato') {
      const fieldMesh = new THREE.Mesh(
        new THREE.SphereGeometry(15, 20, 20),
        new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.12, wireframe: true })
      );
      fieldMesh.name = 'remote-field';
      rp.mesh.add(fieldMesh);
      const glow = new THREE.PointLight(0xff0000, 2.0, 10);
      glow.name = 'remote-field';
      rp.mesh.add(glow);
      rp._abilityTimeout = setTimeout(clearRemoteEffect, 5000);
    }
    else if ((data.type || rp.planeType) === 'bimotor') {
      // Efeitos visuais remotos do Bimotor
      const glow1 = new THREE.PointLight(0xff6600, 3.5, 18);
      glow1.name = 'remote-glow';
      rp.mesh.add(glow1);
      const glow2 = new THREE.PointLight(0xff2200, 2.5, 12);
      glow2.name = 'remote-glow2';
      rp.mesh.add(glow2);

      const intervalMs = BIMOTOR_TRAIL_INTERVAL * 1000;
      let elapsed = 0;
      const maxDuration = 5000;
      rp._trailInterval = setInterval(() => {
        if (!rp.alive || elapsed >= maxDuration) {
          clearInterval(rp._trailInterval);
          rp._trailInterval = null;
          return;
        }
        const pos = rp.mesh.position.clone();
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(rp.mesh.quaternion);
        const tailOffset = dir.clone().multiplyScalar(2.2);
        tailOffset.y += 0.1;
        pos.add(tailOffset);
        spawnFireTrailPuff(pos);
        if (Math.random() < 0.5) {
          const offset2 = dir.clone().multiplyScalar(3.5);
          offset2.y += 0.1;
          const pos2 = rp.mesh.position.clone().add(offset2);
          spawnFireTrailPuff(pos2);
        }
        elapsed += intervalMs;
      }, intervalMs);

      rp._abilityTimeout = setTimeout(() => {
        clearRemoteEffect();
        rp._abilityTimeout = null;
      }, maxDuration);
    }
    else if ((data.type || rp.planeType) === 'f22') {
      // Efeito visual remoto do Impulso Hipersônico — brilho branco/azul
      // gelado enquanto dura (o dano de verdade já veio pelo evento
      // 'bomb-exploded' da onda de choque, isso aqui é só estética).
      const glow = new THREE.PointLight(0xbfe9ff, 3.0, 14);
      glow.name = 'remote-glow';
      rp.mesh.add(glow);
      rp._abilityTimeout = setTimeout(clearRemoteEffect, 5000);
    }
    else if ((data.type || rp.planeType) === 'b737') {
      // Réplica cosmética do Rastro Luminoso: vai soltando bolhas de luz
      // ao longo da posição do jogador remoto, só pra aparecer na tela dos
      // outros. O dano de quem encosta nele é resolvido no cliente de
      // quem está USANDO a habilidade (mesmo padrão de bomba/laser), não
      // aqui — isso aqui não afeta o resultado da partida, é só visual.
      const sampleMs = 80;
      let elapsedB737 = 0;
      const maxDurationB737 = 5000;
      rp._trailInterval = setInterval(() => {
        if (!rp.alive || elapsedB737 >= maxDurationB737) {
          clearInterval(rp._trailInterval);
          rp._trailInterval = null;
          return;
        }
        const geo = new THREE.SphereGeometry(0.55, 8, 8);
        const mat = new THREE.MeshBasicMaterial({
          color: 0x00e5ff, transparent: true, opacity: 0.8,
          blending: THREE.AdditiveBlending, depthWrite: false
        });
        const orb = new THREE.Mesh(geo, mat);
        orb.position.copy(rp.mesh.position);
        scene.add(orb);
        const start = performance.now();
        const life = 2600;
        (function fadeOrb() {
          const t = (performance.now() - start) / life;
          if (t >= 1) { scene.remove(orb); geo.dispose(); mat.dispose(); return; }
          mat.opacity = 0.8 * (1 - t);
          requestAnimationFrame(fadeOrb);
        })();
        elapsedB737 += sampleMs;
      }, sampleMs);
      rp._abilityTimeout = setTimeout(() => {
        if (rp._trailInterval) { clearInterval(rp._trailInterval); rp._trailInterval = null; }
      }, maxDurationB737 + 600);
    }
    // ===== NOVO — 14-Bis: rastro de fogo remoto =====
    else if ((data.type || rp.planeType) === 'quatorzebis') {
      const intervalMs = QUATORZEBIS_TRAIL_INTERVAL * 1000;
      let elapsed = 0;
      const maxDuration = 5000;
      rp._trailInterval = setInterval(() => {
        if (!rp.alive || elapsed >= maxDuration) {
          clearInterval(rp._trailInterval);
          rp._trailInterval = null;
          return;
        }
        const pos = rp.mesh.position.clone();
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(rp.mesh.quaternion);
        const tailOffset = dir.clone().multiplyScalar(1.6);
        tailOffset.y += 0.1;
        pos.add(tailOffset);
        spawnFireTrailPuff(pos); // cores aleatórias
        elapsed += intervalMs;
      }, intervalMs);
      rp._abilityTimeout = setTimeout(() => {
        if (rp._trailInterval) {
          clearInterval(rp._trailInterval);
          rp._trailInterval = null;
        }
      }, maxDuration);
    }
  });

  // ===== EXPLOSÃO REMOTA – AGORA COM COR E TIPO =====
  socket.on('bomb-exploded', (data) => {
    const pos = new THREE.Vector3(data.position[0], data.position[1], data.position[2]);
    const radius = data.radius || 75;
    const color = data.color || 0xff8800;
    // NOVO: 'blimp' entra na mesma lista pra quem vê a explosão do
    // dirigível (ver weather.js) por este evento de rede também ganhar
    // a explosão grande, e não a bolinha de partícula padrão.
    const isSuper = data.weaponType === 'overdrive' || data.weaponType === 'bomb' || data.weaponType === 'shockwave' || data.weaponType === 'blimp';
    const isBomb = data.weaponType === 'bomb' || data.weaponType === 'overdrive' || data.weaponType === 'shockwave' || data.weaponType === 'blimp';
    createExplosion(pos, isSuper, isBomb, color, radius);
    cameraShake(1.0, 0.8);
    playSound('explosion');
  });

  // NOVO — anel de onda de choque do Helicóptero (sem explosão de
  // partículas, só o anel — ver spawnShockwaveRing em weapons.js).
  socket.on('shockwave-pulse', (data) => {
    const pos = new THREE.Vector3(data.position[0], data.position[1], data.position[2]);
    spawnShockwaveRing(pos, data.color || 0x7fd6ff, data.radius || 12);
    cameraShake(0.8, 0.5);
    playSound('shockwave_pulse');
  });

  socket.on('match-end', (data) => {
    playSound('victory');
    showMatchEnd(data);
    matchEnded = true;
    silenceAllEngines();
  });

  socket.on('room-reset', () => {
    matchEnded = false;
    lastKnownRoomState = null;
    document.getElementById('matchend-overlay').classList.add('hidden');
    document.getElementById('lobby-overlay').classList.remove('hidden');
    onlineState.ready = false;
    document.getElementById('lobby-ready-btn').textContent = 'PRONTO';
    document.getElementById('lobby-ready-btn').style.background = 'rgba(0,229,255,0.12)';
    remotePlayers.forEach(rp => { detachEngineSound(rp.parts); if (rp.mesh.parent) scene.remove(rp.mesh); if (rp.label) rp.label.remove(); });
    remotePlayers.clear();
    revivePlayer();
    state.kills = 0; state.deaths = 0;
    updateScoreboardFromRoom(null);
  });

  socket.on('error', (data) => {
    document.getElementById('lobby-error').textContent = data.message || 'Erro';
    document.getElementById('lobby-error').style.display = 'block';
  });

  socket.on('player-left', (data) => {
    const rp = remotePlayers.get(data.id);
    if (rp) { if (rp._abilityTimeout) clearTimeout(rp._abilityTimeout); if (rp._trailInterval) clearInterval(rp._trailInterval); detachEngineSound(rp.parts); if (rp.mesh.parent) scene.remove(rp.mesh); if (rp.label) rp.label.remove(); remotePlayers.delete(data.id); }
    updateScoreboardFromRoom(null);
  });

  socket.on('laser-update', (data) => {
    if (!data.active) {
      if (window.remoteLaserMesh) {
        scene.remove(window.remoteLaserMesh);
        window.remoteLaserMesh.geometry.dispose();
        window.remoteLaserMesh.material.dispose();
        window.remoteLaserMesh = null;
      }
      if (window.remoteLaserLight) {
        scene.remove(window.remoteLaserLight);
        window.remoteLaserLight = null;
      }
      return;
    }

    if (!window.remoteLaserMesh) {
      const geometry = new THREE.CylinderGeometry(0.8 * 0.3, 0.8, 200, 8, 1);
      const material = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      window.remoteLaserMesh = new THREE.Mesh(geometry, material);
      scene.add(window.remoteLaserMesh);
      window.remoteLaserLight = new THREE.PointLight(0xff0000, 2, 200);
      scene.add(window.remoteLaserLight);
    }

    const pos = new THREE.Vector3(data.position[0], data.position[1], data.position[2]);
    const dir = new THREE.Vector3(data.direction[0], data.direction[1], data.direction[2]);
    const endPos = pos.clone().add(dir.clone().multiplyScalar(200));
    const midPos = pos.clone().add(endPos).multiplyScalar(0.5);

    window.remoteLaserMesh.position.copy(midPos);
    const up = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
    window.remoteLaserMesh.quaternion.copy(quat);
    const dist = pos.distanceTo(endPos);
    window.remoteLaserMesh.scale.set(1, dist / 200, 1);

    window.remoteLaserLight.position.copy(midPos);

    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GROUND_LEVEL);
    const groundRay = new THREE.Ray(pos, dir);
    const groundHit = groundRay.intersectPlane(groundPlane, new THREE.Vector3());
    if (groundHit && pos.distanceTo(groundHit) <= LASER_MAX_RANGE && Math.random() < 0.3) {
      createExplosion(groundHit, false, false, 0xff0000);
    }
  });
}

// ===== updateRemotePlayers =====
function updateRemotePlayers(dt) {
  if (!remotePlayers.size) return;
  const lerpFactor = Math.min(1, dt * 8);
  remotePlayers.forEach((rp) => {
    if (!rp.mesh) return;
    if (!rp.alive || matchEnded) {
      if (rp.parts && rp.parts.engineSound) rp.parts.engineSound.setVolume(0);
      return;
    }
    const prevPos = rp._lastLerpPos || rp.mesh.position.clone();
    rp.mesh.position.lerp(rp.targetPos, lerpFactor);
    rp.mesh.rotation.set(
      rp.mesh.rotation.x + (rp.targetPitch - rp.mesh.rotation.x) * lerpFactor,
      rp.mesh.rotation.y + (rp.targetYaw - rp.mesh.rotation.y) * lerpFactor,
      rp.mesh.rotation.z + (rp.targetRoll - rp.mesh.rotation.z) * lerpFactor
    );
    if (!rp._lastLerpPos) rp._lastLerpPos = new THREE.Vector3();
    const distMoved = prevPos.distanceTo(rp.mesh.position);
    rp._lastLerpPos.copy(rp.mesh.position);
    if (rp.parts) {
      const speedEstimate = dt > 0 ? Math.min(1, (distMoved / dt) / 5) : 0;
      if (typeof rp.parts.update === 'function') rp.parts.update(0, speedEstimate);
      if (rp.parts.engineSound) updateEngineSound(rp.parts, speedEstimate);
    }
  });
}

// ===== renderLobby =====
function renderLobby(data) {
  if (data.state !== 'waiting') { document.getElementById('lobby-overlay').classList.add('hidden'); return; }
  document.getElementById('lobby-overlay').classList.remove('hidden');
  document.getElementById('lobby-title').textContent = 'SALA: ' + data.name;
  document.getElementById('lobby-sub').textContent = 'Aguardando todos ficarem prontos...';
  document.getElementById('lobby-room-info').textContent = mapLabel(data.map) + ' | ' + modeLabel(data.mode) + ' | ' + planeModeLabel(data.planeMode) + ' | 👥 ' + data.players.length + '/' + data.maxPlayers;
  currentPlaneMode = data.planeMode || 'livre';

  const amHost = (data.hostId === onlineState.myId);
  const list = document.getElementById('lobby-list');
  list.innerHTML = '';
  const voteTally = {};

  function buildPlayerRow(p, showTeamBadge) {
    const div = document.createElement('div');
    div.className = 'lobby-player';
    const readyText = p.ready ? 'PRONTO' : 'NÃO PRONTO';
    const readyClass = p.ready ? 'ready-badge' : 'notready-badge';
    let teamBadge = '';
    if (showTeamBadge && data.mode === 'teams') {
      teamBadge = '<span class="team-badge ' + (p.team || 'red') + '" data-pid="' + p.id + '">' + (p.team === 'blue' ? '🔵 AZUL' : '🔴 VERMELHO') + '</span>';
    }
    let vehicleBadge = '';
    if (currentPlaneMode === 'sorteio') {
      if (p.vote) { voteTally[p.vote] = (voteTally[p.vote] || 0) + 1; vehicleBadge = '<span class="vehicle-badge" title="voto">🗳️' + PLANE_ICONS_MAP[p.vote] + '</span>'; }
      else vehicleBadge = '<span class="vehicle-badge" title="sem voto" style="opacity:0.4;">🗳️❓</span>';
    } else {
      const planeIcon = PLANE_ICONS_MAP[p.planeType] || '🛩️';
      vehicleBadge = '<span class="vehicle-badge" title="' + (p.planeType || 'cessna') + '" style="font-size:14px;margin:0 4px;">' + planeIcon + '</span>';
    }
    let crownBtn = '';
    if (amHost && p.id !== data.hostId) crownBtn = '<button class="crown-btn" data-pid="' + p.id + '" title="Tornar host" style="background:none;border:none;cursor:pointer;font-size:14px;padding:2px 4px;">👑</button>';
    div.innerHTML = '<div class="dot" style="background:' + p.color + '"></div><span class="name">' + p.name + '</span>' + (p.id === data.hostId ? '<span class="host-badge">HOST</span>' : '') + vehicleBadge + teamBadge + '<span class="' + readyClass + '">' + readyText + '</span>' + crownBtn;
    return div;
  }

  const listLabel = document.getElementById('lobby-list-label');

  // PEDIDO: no modo Esquadrões, uma coluna pra cada time (em vez de uma
  // lista só misturada) — facilita ver de cara quem está em cada lado,
  // e cada coluna tem seu próprio botão pra entrar naquele time.
  if (data.mode === 'teams') {
    if (listLabel) listLabel.textContent = 'Esquadrões';
    list.className = 'team-columns';
    const redPlayers = data.players.filter(p => p.team !== 'blue');
    const bluePlayers = data.players.filter(p => p.team === 'blue');

    const redCol = document.createElement('div');
    redCol.className = 'team-column red';
    redCol.innerHTML = '<div class="team-column-header"><span>🔴 VERMELHO (' + redPlayers.length + ')</span><button class="team-join-btn' + (myTeam !== 'blue' ? ' mine' : '') + '" data-team="red">ENTRAR</button></div>';
    redPlayers.forEach(p => redCol.appendChild(buildPlayerRow(p, false)));

    const blueCol = document.createElement('div');
    blueCol.className = 'team-column blue';
    blueCol.innerHTML = '<div class="team-column-header"><span>🔵 AZUL (' + bluePlayers.length + ')</span><button class="team-join-btn' + (myTeam === 'blue' ? ' mine' : '') + '" data-team="blue">ENTRAR</button></div>';
    bluePlayers.forEach(p => blueCol.appendChild(buildPlayerRow(p, false)));

    list.appendChild(redCol);
    list.appendChild(blueCol);
    list.querySelectorAll('.team-join-btn').forEach(btn => {
      btn.addEventListener('click', () => { if (onlineState.socket) onlineState.socket.emit('set-team', btn.dataset.team); });
    });
  } else {
    if (listLabel) listLabel.textContent = 'Piloto na sala';
    list.className = 'lobby-list';
    data.players.forEach(p => list.appendChild(buildPlayerRow(p, true)));
  }
  list.querySelectorAll('.crown-btn').forEach(btn => btn.addEventListener('click', () => { if (onlineState.socket) onlineState.socket.emit('transfer-host', btn.dataset.pid); }));

  const me = data.players.find(p => p.id === onlineState.myId);
  if (me) {
    onlineState.ready = me.ready;
    myTeam = me.team;
    document.getElementById('lobby-ready-btn').textContent = me.ready ? 'CANCELAR PRONTO' : 'PRONTO';
    document.getElementById('lobby-ready-btn').style.background = me.ready ? 'linear-gradient(135deg,#4cff8b,#2aaf6a)' : 'rgba(0,229,255,0.12)';
    const currentPick = currentPlaneMode === 'sorteio' ? me.vote : me.planeType;
    // CORREÇÃO: isso sincronizava a grade antiga de aviões (removida no
    // carrossel novo) com o voto/avião do servidor. Agora sincroniza o
    // índice do carrossel do lobby com o mesmo valor.
    if (currentPick && typeof carouselIndexes !== 'undefined' && typeof planeIndexOf === 'function') {
      carouselIndexes['lobby'] = planeIndexOf(currentPick);
      if (typeof renderCarousel === 'function') renderCarousel('lobby');
    }
  }
  document.getElementById('lobby-plane-mode-note').textContent = currentPlaneMode === 'sorteio'
    ? '🎲 Modo sorteio/votação: escolha vira seu VOTO. O avião final da partida é decidido por votação (ou sorteio se empatar / só 2 jogadores).'
    : '🎮 Modo livre: troque de avião quando quiser antes de começar.';

  document.getElementById('lobby-start-btn').style.display = (onlineState.isHost && data.state === 'waiting') ? 'inline-block' : 'none';

  const hostSettings = document.getElementById('lobby-host-settings');
  if (hostSettings) {
    hostSettings.classList.toggle('hidden', !amHost);
    if (amHost) {
      document.querySelectorAll('#lobby-env-options .env-btn').forEach(b => b.classList.toggle('selected', b.dataset.env === data.map));
      document.querySelectorAll('#lobby-mode-options .mode-btn').forEach(b => b.classList.toggle('selected', b.dataset.mode === data.mode));
      document.querySelectorAll('#lobby-planemode-options .planemode-btn').forEach(b => b.classList.toggle('selected', b.dataset.planemode === data.planeMode));
    }
  }
}

// ===== beginOnlineMatch =====
function beginOnlineMatch(data) {
  showLoadingScreen(() => { if (onlineState.socket) onlineState.socket.emit('client-loaded'); });

  matchEnded = false;
  revivePlayer();
  remotePlayers.forEach(rp => { detachEngineSound(rp.parts); if (rp.mesh.parent) scene.remove(rp.mesh); if (rp.label) rp.label.remove(); });
  remotePlayers.clear();
  botsEnabled = false;
  enemyBots.forEach(e => { if (e.mesh.parent) scene.remove(e.mesh); if (e.label) e.label.remove(); });
  enemyBots = [];

  currentMode = data.mode || 'ffa';
  currentPlaneMode = data.planeMode || 'livre';
  buildEnvironment(data.map || 'cidade');
  combatEnabled = false;
  prepTimer = 0;

  if (data.sorteioResult) showTemporaryMessage('🎲 Sorteado: ' + (PLANE_SPECS[data.sorteioResult]?.label || data.sorteioResult), 2500);

  data.players.forEach(p => addRemotePlayer(p));

  const myData = data.players.find(p => p.id === onlineState.myId);
  if (myData) {
    selectedPlaneType = myData.planeType || selectedPlaneType;
    myTeam = myData.team;
    state.maxHealth = MAX_HEALTH;
    state.health = myData.health || state.maxHealth;
    const pos = myData.position || { x: 0, y: 0.1, z: 0 };
    state.position.set(pos.x, pos.y, pos.z);
    state.yaw = myData.yaw || 0;
  } else {
    state.position.copy(START_POS);
    state.maxHealth = MAX_HEALTH;
  }

  state.velocity = 0; state.pitch = 0; state.roll = 0; state.fallVelocity = 0;
  state.isDead = false; state.isSpectator = false; state.isCrashed = false; state.crashTimer = 0;
  state.specialActive = false; state.specialTimer = 0; state.specialCooldown = 0;
  state.kills = 0; state.deaths = 0; state.invulnerable = true;
  document.getElementById('death-overlay').classList.remove('show');
  document.getElementById('spectator-hud').classList.remove('show');
  setSpectatorTint(false);
  updateScoreboardFromRoom(null);
  rebuildVehicle();
  removeSpecialEffects();
  prevSpecialActive = false;
  showSpecialIndicator(false);
  missiles.forEach(m => { scene.remove(m.mesh); if (m.trail) scene.remove(m.trail); });
  missiles.length = 0;
  document.getElementById('crosshair').classList.remove('hidden');
}

// ===== showMatchEnd =====
function showMatchEnd(data) {
  document.getElementById('matchend-overlay').classList.remove('hidden');
  const title = document.getElementById('matchend-title');
  const sub = document.getElementById('matchend-sub');
  if (data.winner) {
    if (typeof data.winner === 'object' && data.winner.id === onlineState.myId) { title.textContent = '🏆 VITÓRIA!'; playSound('victory'); }
    else if (typeof data.winner === 'object') { title.textContent = data.winner.name + ' VENCEU'; playSound('death'); }
    else if (data.winner === 'red' || data.winner === 'blue') {
      const won = myTeam === data.winner;
      title.textContent = won ? ('🏆 ESQUADRÃO ' + (data.winner === 'red' ? 'VERMELHO' : 'AZUL') + ' VENCEU!') : 'DERROTA';
      playSound(won ? 'victory' : 'death');
    } else title.textContent = 'FIM DE PARTIDA';
  } else title.textContent = 'FIM DE PARTIDA';
  sub.textContent = data.message || 'Voltando para a sala em instantes...';

  const sbEl = document.getElementById('matchend-scoreboard');
  sbEl.innerHTML = '';
  if (data.standings && data.standings.length) {
    data.standings.sort((a, b) => b.kills - a.kills);
    data.standings.forEach(p => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;padding:5px 10px;background:rgba(0,229,255,0.04);border-radius:8px;font-size:12px;margin-bottom:3px;';
      row.innerHTML = '<span>' + p.name + '</span><span style="color:#ff8a00;">⚔ ' + p.kills + ' &nbsp; 💀 ' + p.deaths + '</span>';
      sbEl.appendChild(row);
    });
  }
}