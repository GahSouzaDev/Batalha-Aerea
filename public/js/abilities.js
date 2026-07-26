// abilities.js – COM LASER SYNC
// PEDIDO: cooldown da Bomba (1) = metade do cooldown do Especial (3); e o
// cooldown do 2 (nova bomba de área) = metade do cooldown da Bomba (1).
// Definido aqui em cima, no topo, pra ficar disponível pro weapons.js
// (carregado logo depois) calcular BOMB_COOLDOWN e SUPER_COOLDOWN a partir
// deste valor único, sem duplicar o número em vários lugares.
const SPECIAL_COOLDOWN = 22.0;

let prevSpecialActive = false;
const fieldHitCooldowns = new Map();
const FIELD_DMG = 150;
const FIELD_RANGE = 15;
const FIELD_HIT_COOLDOWN = 0.5;

let laserActive = false;
let laserMesh = null;
let laserLight = null;
let laserTimer = 0;
const LASER_DURATION = 5.0;
const LASER_DMG_PER_SEC = 150;
const LASER_MAX_RANGE = 200;
const LASER_WIDTH = 0.8;

let bimotorOverdriveActive = false;
let bimotorTrailTimer = 0;
const BIMOTOR_OVERDRIVE_DURATION = 3.0;  // <-- ALTERADO: 3 segundos
const BIMOTOR_SPEED_MULT_MAX = 3.2;
const BIMOTOR_TRAIL_INTERVAL = 0.025;

// PEDIDO: SR-71 invisível pode acelerar até 10x a velocidade máxima normal
// dele, só durante os 5s da habilidade (ver physics.js/updateFlight).
const SR71_INVISIBLE_DURATION = 5.0;
const SR71_INVISIBLE_SPEED_MULT = 2;

let bombardeioInterval = null;
let bombardeioCount = 0;
const BOMBARDEIO_TOTAL = 5;
const BOMBARDEIO_INTERVAL = 1.0;

// ================================================================
//  NOVO — A-1A AMX: Míssil Teleguiado Lento
//  2 mísseis soltos dentro dos 5s padrão de habilidade (t=0 e t=2.5s).
//  Cada um voa na metade da velocidade do tiro normal e só persegue o
//  alvo mais próximo durante os primeiros 2,5s de voo DELE MESMO — depois
//  disso vira reto. Reaproveita a cor/dano da Rajada do Cessna (precisa
//  de 2 acertos pra matar).
// ================================================================
let amxMissileInterval = null;
let amxMissileCount = 0;
const AMX_MISSILE_COUNT = 5;
const AMX_MISSILE_INTERVAL = 1;
const AMX_MISSILE_HOMING_DURATION = 3;
const AMX_MISSILE_SPEED = 100; // metade da velocidade do tiro normal (CESSNA_BOMB_SPEED / 2 = 200 / 2)
const AMX_MISSILE_LIFE = 6.0;
const AMX_MISSILE_COLOR = 0xff3300;

// ================================================================
//  NOVO — F-22 Raptor: Impulso Hipersônico
//  Fase 1 (0-2s): carrega energia, freia bastante e fica invulnerável.
//  Fase 2 (2-3s): dispara a onda de choque e é arremessado pra frente.
//  Fase 3 (3-5s): recuperação suave de volta à velocidade normal.
//  (a física de velocidade em si mora em physics.js, que lê essas
//  constantes; aqui cuidamos do timer, da invulnerabilidade e do "gatilho
//  único" da explosão)
// ================================================================
const F22_BOOST_TOTAL = 5.0;
const F22_BOOST_CHARGE = 2.0;
const F22_BOOST_BURST = 1.0;
const F22_BOOST_SPEED_MULT = 2.2;
const F22_CHARGE_TARGET_FACTOR = 0.15;
let f22ShockwaveFired = false;

// ================================================================
//  NOVO — Boeing 737: Rastro Luminoso
//  Deixa uma trilha de "bolhas" de luz formando atrás do avião enquanto a
//  habilidade dura (5s). A trilha fica parada no ar (não se move com o
//  avião) e continua existindo até o fim da habilidade; só então começa a
//  desaparecer (fade). Quem tocar em qualquer ponto dela sofre o mesmo
//  dano por segundo do Laser do OVNI.
// ================================================================
let b737TrailActive = false;
let b737TrailOrbs = []; // { mesh, mat, life }
let b737TrailSampleTimer = 0;
const B737_ORB_LIFETIME = 5.0; // cada bola fica parada no ar por 5s antes de explodir
const B737_ORB_EXPLOSION_DMG = 25;
const B737_TRAIL_SAMPLE_INTERVAL = 0.25;
const B737_TRAIL_HIT_RADIUS = 4.5;
const B737_TRAIL_DMG_PER_SEC = LASER_DMG_PER_SEC; // mesmo dano do laser do OVNI
const B737_TRAIL_HIT_COOLDOWN = 0.5;
const B737_TRAIL_COLOR = 0x00e5ff;
const b737TrailHitCooldowns = new Map();

// Cessna: rajada de 5 bombas atiradas pra frente, 1 por segundo, 5 tiros
// em 5 segundos no total (mesma bomba vermelha/mesmo dano/raio do
// Bombardeio do Boeing, só que atirada pra frente igual um tiro normal,
// na mesma velocidade do tiro normal, em vez de solta pra baixo).
let cessnaBombInterval = null;
let cessnaBombCount = 0;
const CESSNA_BOMB_TOTAL = 5;
const CESSNA_BOMB_INTERVAL = 1.0;

// ================================================================
//  NOVO — 14-Bis: Hiper Velocidade
//  Chega a 5x a velocidade máxima normal dele (rampa progressiva ao
//  longo dos 5s, igual ao Bimotor/SR-71/F-22), fica invulnerável e
//  extremamente manobrável (ver spec.speedFactor/baseRotationSpeed em
//  plane-specs.js) — mas, diferente do SR-71, NÃO fica invisível: solta
//  um rastro de fogo atrás (mesmo efeito visual da sobrecarga do
//  Bimotor) o tempo todo, sem cair/explodir no final.
// ================================================================
let quatorzebisTrailTimer = 0;
const QUATORZEBIS_HYPER_DURATION = 5.0;
const QUATORZEBIS_HYPER_SPEED_MULT = 20.0;
const QUATORZEBIS_TRAIL_INTERVAL = 0.05;

// ================================================================
//  NOVO — Hilson Bi-Mono: Super Metralhadora
//  Ao apertar o "3", liga uma rajada MUITO rápida de tiros azuis
//  (mirados pela mira/câmera, igual ao tiro básico) por 5s. Cooldown
//  próprio de 10s (bem menor que o padrão de 22s) — reaproveita o
//  fireMachineGun genérico de weapons.js.
// ================================================================
let biplanoMgInterval = null;
const BIPLANO_MG_COOLDOWN = 50.0;
const BIPLANO_MG_FIRE_INTERVAL = 0.1; // ~12 tiros por segundo
const BIPLANO_MG_COLOR = 0x2288ff;

// ================================================================
//  NOVO — Piper Seneca: Rajada Dupla
//  Solta um par de mísseis retos (sem perseguição) de cada asa, 1 par
//  por segundo, 5 pares em 5s — reaproveita spawnMissile.
// ================================================================
let senecaMissileInterval = null;
let senecaMissileCount = 0;
const SENECA_MISSILE_TOTAL = 20;
const SENECA_MISSILE_INTERVAL = 0.25;
const SENECA_MISSILE_SPEED = 160;
const SENECA_MISSILE_COLOR = 0x33ff88;
const SENECA_WING_OFFSET = 1.6;

// ================================================================
//  NOVO — B-2 Spirit: Bombardeio Furtivo
//  Igual ao Bombardeio do A380, só que 1 bomba a cada 0.5s (10 bombas em
//  5s), caindo 2x mais rápido e com raio de dano menor (mas o dano em si
//  não tem limite de altura, então quem estiver embaixo é atingido do
//  mesmo jeito — ver Math.hypot só em x/z no dano em weapons.js). Bomba,
//  explosão e onda de choque todas brancas.
// ================================================================
let b2BombInterval = null;
let b2BombCount = 0;
const B2_BOMB_TOTAL = 10;
const B2_BOMB_INTERVAL = 0.5;
const B2_BOMB_GRAVITY_MULT = 2.0;
const B2_BOMB_RADIUS_FACTOR = 0.28;
const B2_BOMB_COLOR = 0xffffff;

// ================================================================
//  NOVO — Helicóptero: Ondas de Choque
//  5 pulsos de onda de choque ao longo dos 5s da habilidade (1 por
//  segundo), sem explosão de partículas — só o anel de choque, grosso e
//  bem visível, com dano em área em todas as direções (precisa de 2
//  pulsos pra matar). Fica invulnerável enquanto durar, senão o próprio
//  helicóptero se abateria com o primeiro pulso (mesma lição do bug do
//  F-22 corrigido acima).
// ================================================================
let heliShockwaveInterval = null;
let heliShockwaveCount = 0;
const HELI_SHOCKWAVE_TOTAL = 5;
const HELI_SHOCKWAVE_INTERVAL = 1.0;
const HELI_SHOCKWAVE_DMG = MAX_HEALTH / 2; // precisa de 2 pulsos pra matar
// PEDIDO: raio grande, na mesma faixa do estouro do F-22/ATR. Valor fixo
// em vez de "BOMB_BLAST_RADIUS * 0.55" — BOMB_BLAST_RADIUS só existe
// depois que weapons.js carrega, e abilities.js carrega ANTES de
// weapons.js no index.html, então ler essa constante aqui (no momento em
// que o arquivo é interpretado, fora de qualquer função) quebrava o jogo
// inteiro com "BOMB_BLAST_RADIUS is not defined". BOMB_BLAST_RADIUS vale
// 75 em weapons.js, então 75 * 0.55 = 41.25 mantém o mesmo tamanho.
const HELI_SHOCKWAVE_RADIUS = 41.25;
const HELI_SHOCKWAVE_COLOR = 0x7fd6ff;

// ================================================================
//  NOVO — X-Wing (T-65/T-70): Metralhadora Laser
//  Igual à Super Metralhadora do Bi-Mono, mas em forma de FEIXE DE LASER
//  de verdade (bolt alongado brilhante, não uma bolinha recolorida — ver
//  buildBulletMesh em weapons.js) e alternando entre os dois canhões
//  esquerdo/direito a cada disparo, 10 disparos por segundo — "liga e
//  desliga" em vez de feixe contínuo como o laser do OVNI.
// ================================================================
let xwingLaserInterval = null;
let xwingLaserSide = -1; // alterna entre canhão esquerdo (-1) e direito (1)
const XWING_LASER_FIRE_INTERVAL = 0.1; // 10 disparos por segundo
const XWING_LASER_COLOR = 0x00aaff;
const XWING_LASER_SPEED = 130;
const XWING_LASER_CANNON_OFFSET = 0.9; // distância lateral dos canhões (pontas das S-foils)
const XWING_LASER_BOLT_LENGTH = 2.6;
const XWING_LASER_BOLT_RADIUS = 0.06;

function fireXwingLaser() {
  xwingLaserSide *= -1;
  fireMachineGun({
    color: XWING_LASER_COLOR,
    explosionColor: XWING_LASER_COLOR,
    weaponType: 'xwing-laser',
    speed: XWING_LASER_SPEED,
    bolt: true,
    boltLength: XWING_LASER_BOLT_LENGTH,
    boltRadius: XWING_LASER_BOLT_RADIUS,
    sideOffset: xwingLaserSide * XWING_LASER_CANNON_OFFSET,
  });
}
const CESSNA_BOMB_SPEED = 200; // mesma velocidade do tiro normal (spawnMissile)
// duração da habilidade tem que cobrir até o último tiro (4 * 1s = 4s) +
// uma folga pra garantir que o último intervalo do setInterval rode antes
// do especial ser desligado. Total: 5s.
const CESSNA_BOMB_ABILITY_DURATION = CESSNA_BOMB_INTERVAL * (CESSNA_BOMB_TOTAL - 1) + 1.0;

let laserUpdateInterval = null;

function stopAllSpecialTimers() {
  if (bombardeioInterval) { clearInterval(bombardeioInterval); bombardeioInterval = null; }
  if (cessnaBombInterval) { clearInterval(cessnaBombInterval); cessnaBombInterval = null; }
  if (laserUpdateInterval) { clearInterval(laserUpdateInterval); laserUpdateInterval = null; }
  if (amxMissileInterval) { clearInterval(amxMissileInterval); amxMissileInterval = null; }
  amxMissileCount = 0;

  if (biplanoMgInterval) { clearInterval(biplanoMgInterval); biplanoMgInterval = null; }
  if (senecaMissileInterval) { clearInterval(senecaMissileInterval); senecaMissileInterval = null; }
  senecaMissileCount = 0;
  if (b2BombInterval) { clearInterval(b2BombInterval); b2BombInterval = null; }
  b2BombCount = 0;
  if (heliShockwaveInterval) { clearInterval(heliShockwaveInterval); heliShockwaveInterval = null; }
  heliShockwaveCount = 0;
  if (xwingLaserInterval) { clearInterval(xwingLaserInterval); xwingLaserInterval = null; }
  quatorzebisTrailTimer = 0;

  f22ShockwaveFired = false;

  b737TrailActive = false;
  clearLightTrailOrbs();
  b737TrailHitCooldowns.clear();

  if (laserActive && onlineState.socket) {
    onlineState.socket.emit('laser-update', { active: false });
  }
  laserActive = false;
  laserTimer = 0;
  if (laserMesh) {
    scene.remove(laserMesh);
    laserMesh.geometry.dispose();
    laserMesh.material.dispose();
    laserMesh = null;
  }
  if (laserLight) {
    scene.remove(laserLight);
    laserLight = null;
  }

  bimotorOverdriveActive = false;
  bimotorTrailTimer = 0;

  bombardeioCount = 0;
  cessnaBombCount = 0;
  fieldHitCooldowns.clear();

  state.invisible = false;
  state.invulnerable = false;
}

function showTemporaryMessage(msg, duration = 1500) {
  let el = document.getElementById('temp-msg');
  if (!el) {
    el = document.createElement('div');
    el.id = 'temp-msg';
    el.style.cssText = `
      position: fixed; top: 20%; left: 50%; transform: translateX(-50%);
      color: #ff4444; background: rgba(0,0,0,0.8); padding: 8px 20px;
      border-radius: 8px; font-size: 18px; font-weight: bold;
      pointer-events: none; z-index: 1000; transition: opacity 0.3s;
      font-family: sans-serif;
    `;
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = 1;
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => { el.style.opacity = 0; }, duration);
}

function triggerSpecial() {
  if (state.isPaused || state.isDead || state.isSpectator) return;
  if (!combatEnabled) { showTemporaryMessage('⛔ Aguarde liberar o combate!'); return; }
  if (state.specialCooldown > 0 || state.specialActive) return;

  stopAllSpecialTimers();

  state.specialActive = true;
  state.specialTimer = 5.0; // padrão para outros tipos
  state.specialCooldown = SPECIAL_COOLDOWN;
  fieldHitCooldowns.clear();

  const type = selectedPlaneType;
  // Cada avião tem seu próprio "timbre" de habilidade (ver sound.js) — só
  // de ouvir já dá pra saber qual poder está sendo usado. Se algum tipo
  // novo ainda não tiver som dedicado, sound.js cai no som genérico.
  playSound('special_' + type);

  // ===== ENVIA PARA O SERVIDOR O TIPO DE HABILIDADE =====
  if (onlineState.socket) {
    onlineState.socket.emit('ability-trigger', { type: type });
  }

  if (type === 'bimotor') {
    // Sobrescreve o tempo para 3 segundos
    state.specialTimer = BIMOTOR_OVERDRIVE_DURATION;
    startBimotorOverdrive();
  } else if (type === 'jato') {
    state.invulnerable = true;
    applySpecialEffects(type);
  } else if (type === 'sr71') {
    state.invisible = true;
    applySpecialEffects(type);
  } else if (type === 'ovni') {
    startLaser();
  } else if (type === 'cessna') {
    state.specialTimer = CESSNA_BOMB_ABILITY_DURATION;
    cessnaBombCount = 0;
    if (cessnaBombInterval) clearInterval(cessnaBombInterval);
    cessnaBombInterval = setInterval(() => {
      if (!state.specialActive || cessnaBombCount >= CESSNA_BOMB_TOTAL) {
        clearInterval(cessnaBombInterval);
        cessnaBombInterval = null;
        return;
      }
      fireCessnaBomb();
      cessnaBombCount++;
    }, CESSNA_BOMB_INTERVAL * 1000);
    fireCessnaBomb();
    cessnaBombCount++;
  } else if (type === 'boing') {
    bombardeioCount = 0;
    if (bombardeioInterval) clearInterval(bombardeioInterval);
    bombardeioInterval = setInterval(() => {
      if (!state.specialActive || bombardeioCount >= BOMBARDEIO_TOTAL) {
        clearInterval(bombardeioInterval);
        bombardeioInterval = null;
        return;
      }
      dropBombardeio();
      bombardeioCount++;
    }, BOMBARDEIO_INTERVAL * 1000);
    dropBombardeio();
    bombardeioCount++;
  } else if (type === 'amx') {
    amxMissileCount = 0;
    if (amxMissileInterval) clearInterval(amxMissileInterval);
    amxMissileInterval = setInterval(() => {
      if (!state.specialActive || amxMissileCount >= AMX_MISSILE_COUNT) {
        clearInterval(amxMissileInterval);
        amxMissileInterval = null;
        return;
      }
      fireAmxMissile();
      amxMissileCount++;
    }, AMX_MISSILE_INTERVAL * 1000);
    fireAmxMissile();
    amxMissileCount++;
  } else if (type === 'f22') {
    f22ShockwaveFired = false;
    state.invulnerable = true;
    applySpecialEffects(type);
  } else if (type === 'b737') {
    startLightTrail();
  } else if (type === 'quatorzebis') {
    state.specialTimer = QUATORZEBIS_HYPER_DURATION;
    state.invulnerable = true;
    quatorzebisTrailTimer = 0;
    applySpecialEffects(type);
  } else if (type === 'biplano') {
    // Cooldown próprio, bem mais curto que o padrão (10s em vez de 22s).
    state.specialCooldown = BIPLANO_MG_COOLDOWN;
    if (biplanoMgInterval) clearInterval(biplanoMgInterval);
    biplanoMgInterval = setInterval(() => {
      if (!state.specialActive) {
        clearInterval(biplanoMgInterval);
        biplanoMgInterval = null;
        return;
      }
      fireMachineGun({ color: BIPLANO_MG_COLOR, explosionColor: BIPLANO_MG_COLOR, weaponType: 'biplano-mg' });
    }, BIPLANO_MG_FIRE_INTERVAL * 1000);
    fireMachineGun({ color: BIPLANO_MG_COLOR, explosionColor: BIPLANO_MG_COLOR, weaponType: 'biplano-mg' });
  } else if (type === 'seneca') {
    senecaMissileCount = 0;
    if (senecaMissileInterval) clearInterval(senecaMissileInterval);
    senecaMissileInterval = setInterval(() => {
      if (!state.specialActive || senecaMissileCount >= SENECA_MISSILE_TOTAL) {
        clearInterval(senecaMissileInterval);
        senecaMissileInterval = null;
        return;
      }
      fireSenecaMissiles();
      senecaMissileCount++;
    }, SENECA_MISSILE_INTERVAL * 1000);
    fireSenecaMissiles();
    senecaMissileCount++;
  } else if (type === 'b2spirit') {
    b2BombCount = 0;
    if (b2BombInterval) clearInterval(b2BombInterval);
    b2BombInterval = setInterval(() => {
      if (!state.specialActive || b2BombCount >= B2_BOMB_TOTAL) {
        clearInterval(b2BombInterval);
        b2BombInterval = null;
        return;
      }
      dropB2Bomb();
      b2BombCount++;
    }, B2_BOMB_INTERVAL * 1000);
    dropB2Bomb();
    b2BombCount++;
  } else if (type === 'heli') {
    // Invulnerável durante os pulsos: cada onda de choque nasce na
    // posição do próprio helicóptero, então sem isso ele se abateria
    // sozinho no primeiro pulso (mesma causa do bug do F-22 corrigido
    // acima).
    state.invulnerable = true;
    heliShockwaveCount = 0;
    if (heliShockwaveInterval) clearInterval(heliShockwaveInterval);
    heliShockwaveInterval = setInterval(() => {
      if (!state.specialActive || heliShockwaveCount >= HELI_SHOCKWAVE_TOTAL) {
        clearInterval(heliShockwaveInterval);
        heliShockwaveInterval = null;
        return;
      }
      triggerHeliShockwavePulse();
      heliShockwaveCount++;
    }, HELI_SHOCKWAVE_INTERVAL * 1000);
    triggerHeliShockwavePulse();
    heliShockwaveCount++;
  } else if (type === 'xwing') {
    xwingLaserSide = -1;
    if (xwingLaserInterval) clearInterval(xwingLaserInterval);
    xwingLaserInterval = setInterval(() => {
      if (!state.specialActive) {
        clearInterval(xwingLaserInterval);
        xwingLaserInterval = null;
        return;
      }
      fireXwingLaser();
    }, XWING_LASER_FIRE_INTERVAL * 1000);
    fireXwingLaser();
  } else {
    applySpecialEffects(type);
  }

  if (onlineState.socket) onlineState.socket.emit('ability-trigger');
}

function startBimotorOverdrive() {
  bimotorOverdriveActive = true;
  bimotorTrailTimer = 0;
  state.invulnerable = true;
  applySpecialEffects('bimotor');
}

function spawnFireTrailPuff(position, colorOverride) {
  const size = 0.7 + Math.random() * 1.2;
  const geo = new THREE.SphereGeometry(size, 6, 6);
  let color;
  if (colorOverride != null) {
    color = colorOverride;
  } else {
    const colorVal = Math.random();
    if (colorVal < 0.4) color = 0xff5500;
    else if (colorVal < 0.7) color = 0xffaa00;
    else color = 0xff2200;
  }
  const mat = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const puff = new THREE.Mesh(geo, mat);
  puff.position.copy(position);
  scene.add(puff);
  const start = performance.now();
  const duration = 500 + Math.random() * 400;
  (function fade() {
    const t = (performance.now() - start) / duration;
    if (t >= 1) { scene.remove(puff); geo.dispose(); mat.dispose(); return; }
    puff.scale.setScalar(1 + t * 3.5);
    mat.opacity = 0.9 * (1 - t);
    puff.position.y += 0.02;
    requestAnimationFrame(fade);
  })();

  if (Math.random() < 0.4) {
    const geo2 = new THREE.SphereGeometry(size * 0.5 + 0.3, 5, 5);
    const mat2 = new THREE.MeshBasicMaterial({
      color: 0xffaa44,
      transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const puff2 = new THREE.Mesh(geo2, mat2);
    puff2.position.copy(position);
    puff2.position.x += (Math.random() - 0.5) * 0.5;
    puff2.position.z += (Math.random() - 0.5) * 0.5;
    scene.add(puff2);
    const start2 = performance.now();
    const dur2 = 300 + Math.random() * 300;
    (function fade2() {
      const t = (performance.now() - start2) / dur2;
      if (t >= 1) { scene.remove(puff2); geo2.dispose(); mat2.dispose(); return; }
      puff2.scale.setScalar(1 + t * 4);
      mat2.opacity = 0.5 * (1 - t);
      puff2.position.y += 0.03;
      requestAnimationFrame(fade2);
    })();
  }
}

function triggerBimotorMegaExplosion() {
  const pos = state.position.clone();
  const dmg = BOMB_DMG * 2;
  const radius = BOMB_BLAST_RADIUS * 2;

  createExplosion(pos, true, true, 0xffee66, radius);
  createExplosion(pos, true, true, 0xff3300, radius * 0.65);

  const megaFlash = new THREE.PointLight(0xffee99, 30, radius * 3.5);
  megaFlash.position.copy(pos);
  scene.add(megaFlash);
  const flashStart = performance.now();
  (function fadeFlash() {
    const t = (performance.now() - flashStart) / 900;
    if (t >= 1) { scene.remove(megaFlash); return; }
    megaFlash.intensity = 30 * (1 - t);
    requestAnimationFrame(fadeFlash);
  })();

  cameraShake(2.6, 1.7);
  playSound('explosion');

  resolveBombDamage(pos, false, dmg, radius, 'overdrive');

  // =================================================================
  //  REDUZ A VELOCIDADE ATUAL EM 50% (metade) após a explosão
  // =================================================================
  state.velocity *= 0.5;
}

function dropBombardeio() {
  const origin = state.position.clone();
  origin.y -= 0.6;
  const velocity = new THREE.Vector3(
    -state.velocity * Math.sin(state.yaw),
    -1.5 * 0.75,
    -state.velocity * Math.cos(state.yaw)
  );
  dropSpecialBomb(origin, velocity, 0xff0000, 0.5, 0.5, false, 1.0, null, false, true);

  if (onlineState.socket) {
    onlineState.socket.emit('bomb-fired', {
      origin: origin.toArray(),
      velocity: velocity.toArray(),
      isSpecial: true,
      color: 0xff0000,
      damageFactor: 0.5,
      radiusFactor: 0.5
    });
  }
}

// Mesma bomba vermelha do Bombardeio (mesmo dano/raio via damageFactor/
// radiusFactor 0.5), só que atirada pra frente na direção da mira em vez
// de solta pra baixo. A gravidade em updateBombs (weapons.js) ainda puxa
// ela pra baixo com o tempo, então ela voa e cai como um projétil normal.
// PEDIDO: bomba da Rajada do Cessna 2/3 menor visualmente e com metade do
// dano de vida por tiro (50 de 100), precisando de 2 acertos pra matar.
// BOMB_DMG * damageFactor = MAX_HEALTH / 2
const CESSNA_BOMB_SIZE_SCALE = 2 / 3;

function fireCessnaBomb() {
  const dir = getAimDirection();
  const origin = state.position.clone().add(dir.clone().multiplyScalar(2.2));
  const velocity = dir.clone().multiplyScalar(CESSNA_BOMB_SPEED);
  const cessnaBombDamageFactor = (MAX_HEALTH / 2) / BOMB_DMG;
  dropSpecialBomb(origin, velocity, 0xff0000, cessnaBombDamageFactor, 0.5, false, CESSNA_BOMB_SIZE_SCALE, null, true);
  playSound('bomb_drop');

  const flash = new THREE.PointLight(0xff0000, 2.0, 8);
  flash.position.copy(origin);
  scene.add(flash);
  setTimeout(() => scene.remove(flash), 100);

  if (onlineState.socket) {
    onlineState.socket.emit('bomb-fired', {
      origin: origin.toArray(),
      velocity: velocity.toArray(),
      isSpecial: true,
      color: 0xff0000,
      damageFactor: cessnaBombDamageFactor,
      radiusFactor: 0.5,
      sizeScale: CESSNA_BOMB_SIZE_SCALE,
      withTrail: true
    });
  }
}

// ================================================================
//  NOVO — A-1A AMX: dispara o míssil lento/semi-teleguiado.
//  Usa o mesmo pipeline do tiro básico (spawnMissile), só que com
//  velocidade reduzida (AMX_MISSILE_SPEED) e um limite de tempo de
//  perseguição (AMX_MISSILE_HOMING_DURATION) — depois disso o míssil
//  continua reto. O dano é o mesmo do tiro básico (NORMAL_DMG = 50, ou
//  seja, precisa de 2 acertos pra matar, igual à Rajada do Cessna).
// ================================================================
function fireAmxMissile() {
  const dir = getAimDirection();
  const origin = state.position.clone().add(dir.clone().multiplyScalar(2.2));
  spawnMissile(false, origin, dir, false, AMX_MISSILE_COLOR, {
    speed: AMX_MISSILE_SPEED,
    life: AMX_MISSILE_LIFE,
    homingDuration: AMX_MISSILE_HOMING_DURATION
  });
  playSound('shot');

  const flash = new THREE.PointLight(AMX_MISSILE_COLOR, 2.0, 8);
  flash.position.copy(origin);
  scene.add(flash);
  setTimeout(() => scene.remove(flash), 100);

  if (onlineState.socket) {
    onlineState.socket.emit('shot-fired', {
      isSuper: false,
      origin: origin.toArray(),
      direction: dir.toArray(),
      weaponType: 'ability-missile',
      color: AMX_MISSILE_COLOR,
      speed: AMX_MISSILE_SPEED
    });
  }
}

// ================================================================
//  NOVO — Piper Seneca: dispara um par de mísseis retos (sem
//  perseguição — homingDuration bem curto faz o míssil virar reto quase
//  instantaneamente), um saindo de cada asa, pra lembrar um bimotor de
//  verdade atirando dos dois lados ao mesmo tempo.
// ================================================================
function fireSenecaMissiles() {
  const dir = getAimDirection();
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(getVehicleQuaternion());
  [-1, 1].forEach((side) => {
    const origin = state.position.clone()
      .add(dir.clone().multiplyScalar(2.0))
      .add(right.clone().multiplyScalar(side * SENECA_WING_OFFSET));
    spawnMissile(false, origin, dir, false, SENECA_MISSILE_COLOR, {
      speed: SENECA_MISSILE_SPEED,
      life: 5.0,
      homingDuration: 0.05
    });
    const flash = new THREE.PointLight(SENECA_MISSILE_COLOR, 2.0, 8);
    flash.position.copy(origin);
    scene.add(flash);
    setTimeout(() => scene.remove(flash), 100);
    if (onlineState.socket) {
      onlineState.socket.emit('shot-fired', {
        isSuper: false,
        origin: origin.toArray(),
        direction: dir.toArray(),
        weaponType: 'ability-missile',
        color: SENECA_MISSILE_COLOR,
        speed: SENECA_MISSILE_SPEED
      });
    }
  });
  playSound('shot');
}

// ================================================================
//  NOVO — B-2 Spirit: bombardeio furtivo — igual ao Bombardeio do A380
//  (dropBombardeio), só que mais rápido, com bomba/explosão/onda de
//  choque brancas, raio de dano menor e queda 2x mais rápida
//  (gravityMult, ver weapons.js/updateBombs).
// ================================================================
function dropB2Bomb() {
  const origin = state.position.clone();
  origin.y -= 0.6;
  const velocity = new THREE.Vector3(
    -state.velocity * Math.sin(state.yaw),
    -1.5 * 0.75 * B2_BOMB_GRAVITY_MULT,
    -state.velocity * Math.cos(state.yaw)
  );
  const dmgFactor = (MAX_HEALTH / 2) / BOMB_DMG;
  dropSpecialBomb(origin, velocity, B2_BOMB_COLOR, dmgFactor, B2_BOMB_RADIUS_FACTOR, false, 1.0, B2_BOMB_COLOR, false, true, B2_BOMB_GRAVITY_MULT, B2_BOMB_COLOR);

  if (onlineState.socket) {
    onlineState.socket.emit('bomb-fired', {
      origin: origin.toArray(),
      velocity: velocity.toArray(),
      isSpecial: true,
      color: B2_BOMB_COLOR,
      damageFactor: dmgFactor,
      radiusFactor: B2_BOMB_RADIUS_FACTOR,
      explosionColor: B2_BOMB_COLOR
    });
  }
}

// ================================================================
//  NOVO — Helicóptero: pulso de onda de choque. Sem explosão de
//  partículas — só um anel grosso se expandindo (ver spawnShockwaveRing
//  em weapons.js) — com dano em área via resolveBombDamage, mas com o
//  broadcast de explosão padrão desligado (suppressBroadcast=true) pra
//  não aparecer uma explosão genérica na tela de quem está vendo de
//  fora; em vez disso mandamos nosso próprio evento 'shockwave-pulse'
//  pra sincronizar só o anel visual.
// ================================================================
function triggerHeliShockwavePulse() {
  const pos = state.position.clone();
  spawnShockwaveRing(pos, HELI_SHOCKWAVE_COLOR, HELI_SHOCKWAVE_RADIUS);
  cameraShake(1.0, 0.7);
  playSound('shockwave_pulse');
  resolveBombDamage(pos, false, HELI_SHOCKWAVE_DMG, HELI_SHOCKWAVE_RADIUS, 'heli-shockwave', true);
  if (onlineState.socket) {
    onlineState.socket.emit('shockwave-pulse', {
      position: pos.toArray(),
      radius: HELI_SHOCKWAVE_RADIUS,
      color: HELI_SHOCKWAVE_COLOR
    });
  }
}

// ================================================================
//  NOVO — F-22 Raptor: onda de choque do Impulso Hipersônico.
//  Disparada uma única vez (ver f22ShockwaveFired em updateSpecial),
//  exatamente quando a fase de carga termina. Reaproveita o mesmo padrão
//  da megaexplosão do ATR (createExplosion + resolveBombDamage).
// ================================================================
function triggerF22Shockwave() {
  const pos = state.position.clone();
  const dmg = BOMB_DMG * 1.5;
  const radius = BOMB_BLAST_RADIUS * 1.3;

  // Segurança extra (além da correção no snapshot do multiplayer.js):
  // garante que o próprio F-22 está invulnerável no instante exato em que
  // sua onda de choque calcula dano, não importa o que tenha acontecido
  // um instante antes.
  state.invulnerable = true;

  createExplosion(pos, true, true, 0xbfe9ff, radius);
  createExplosion(pos, true, true, 0xffffff, radius * 0.6);
  cameraShake(2.2, 1.4);
  playSound('explosion');
  resolveBombDamage(pos, false, dmg, radius, 'shockwave');
  showTemporaryMessage('💥 ESTOURO SÔNICO!', 1500);
}

// ================================================================
//  NOVO — Boeing 737: Rastro Luminoso.
// ================================================================
function clearLightTrailOrbs() {
  b737TrailOrbs.forEach(o => {
    scene.remove(o.mesh);
    o.mesh.geometry.dispose();
    o.mat.dispose();
  });
  b737TrailOrbs = [];
}

function spawnLightTrailOrb(position) {
  const geo = new THREE.SphereGeometry(0.55, 8, 8);
  const mat = new THREE.MeshBasicMaterial({
    color: B737_TRAIL_COLOR,
    transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(position);
  scene.add(mesh);
  // PEDIDO: cada bola fica parada exatamente onde foi solta (não segue o
  // avião) e carrega seu próprio relógio de vida — ela some só quando
  // ESSA bola em particular completar 5s, explodindo no final, em vez de
  // todo o rastro sumir de uma vez quando a habilidade acaba.
  b737TrailOrbs.push({ mesh, mat, life: B737_ORB_LIFETIME });
}

// Detona uma bola individual do rastro: pequena explosão + dano em área,
// igual às bombas normais, só que num raio mais contido (ver
// B737_TRAIL_HIT_RADIUS) — não é pra ser tão forte quanto uma bomba do
// Bombardeio do A380, é só o "estouro" natural no fim da vida da bola.
function explodeTrailOrb(orb) {
  createExplosion(orb.mesh.position.clone(), false, true, B737_TRAIL_COLOR, B737_TRAIL_HIT_RADIUS * 1.1);
  cameraShake(0.3, 0.2);
  playSound('explosion');
  resolveBombDamage(orb.mesh.position.clone(), false, B737_ORB_EXPLOSION_DMG, B737_TRAIL_HIT_RADIUS, 'light-trail-orb');
  scene.remove(orb.mesh);
  orb.mesh.geometry.dispose();
  orb.mat.dispose();
}

function startLightTrail() {
  b737TrailActive = true;
  b737TrailSampleTimer = 0;
  b737TrailHitCooldowns.clear();
  clearLightTrailOrbs();
  applySpecialEffects('b737');
  spawnLightTrailOrb(state.position.clone());
}

// Roda TODO frame (mesmo depois da habilidade acabar, enquanto ainda
// existirem bolas vivas contando seus próprios 5s) — por isso é chamado
// direto de updateSpecial(dt), fora do bloco "if (state.specialActive)".
function updateLightTrail(dt) {
  if (!b737TrailActive) return;

  for (let i = b737TrailOrbs.length - 1; i >= 0; i--) {
    const orb = b737TrailOrbs[i];
    orb.life -= dt;
    // Nos últimos instantes, pisca/intensifica a bola pra avisar que ela
    // está prestes a explodir, em vez de só sumir sem aviso.
    if (orb.life < 1.0) {
      orb.mat.opacity = 0.5 + 0.5 * Math.abs(Math.sin(orb.life * 18));
    }
    if (orb.life <= 0) {
      explodeTrailOrb(orb);
      b737TrailOrbs.splice(i, 1);
    }
  }

  if (!state.specialActive && b737TrailOrbs.length === 0) {
    b737TrailActive = false;
    b737TrailHitCooldowns.clear();
    return;
  }

  if (b737TrailOrbs.length === 0) return;

  enemyBots.forEach(bot => {
    if (!bot.alive) return;
    const key = 'bot-' + bot.mesh.uuid;
    if (b737TrailHitCooldowns.has(key)) return;
    for (let i = 0; i < b737TrailOrbs.length; i++) {
      if (bot.mesh.position.distanceTo(b737TrailOrbs[i].mesh.position) < B737_TRAIL_HIT_RADIUS) {
        bot.health -= B737_TRAIL_DMG_PER_SEC * B737_TRAIL_HIT_COOLDOWN;
        flashBot(bot);
        playSound('hit');
        b737TrailHitCooldowns.set(key, B737_TRAIL_HIT_COOLDOWN);
        if (bot.health <= 0) killBot(bot);
        break;
      }
    }
  });

  if (onlineState.socket) {
    remotePlayers.forEach((rp, id) => {
      if (!rp.alive) return;
      const key = 'rp-' + id;
      if (b737TrailHitCooldowns.has(key)) return;
      for (let i = 0; i < b737TrailOrbs.length; i++) {
        if (rp.mesh.position.distanceTo(b737TrailOrbs[i].mesh.position) < B737_TRAIL_HIT_RADIUS) {
          onlineState.socket.emit('hit', { targetId: id, weaponType: 'light-trail' });
          flashRemote(id);
          b737TrailHitCooldowns.set(key, B737_TRAIL_HIT_COOLDOWN);
          break;
        }
      }
    });
  }

  b737TrailHitCooldowns.forEach((v, k) => {
    const nv = v - dt;
    if (nv <= 0) b737TrailHitCooldowns.delete(k);
    else b737TrailHitCooldowns.set(k, nv);
  });
}

function startLaser() {
  laserActive = true;
  laserTimer = 0;
  if (laserMesh) {
    scene.remove(laserMesh);
    laserMesh.geometry.dispose();
    laserMesh.material.dispose();
    laserMesh = null;
  }
  if (laserLight) {
    scene.remove(laserLight);
    laserLight = null;
  }

  const geometry = new THREE.CylinderGeometry(LASER_WIDTH * 0.3, LASER_WIDTH, LASER_MAX_RANGE, 8, 1);
  const material = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  laserMesh = new THREE.Mesh(geometry, material);
  scene.add(laserMesh);

  laserLight = new THREE.PointLight(0xff0000, 2, LASER_MAX_RANGE);
  scene.add(laserLight);

  applySpecialEffects('ovni');

  if (onlineState.socket) {
    if (laserUpdateInterval) clearInterval(laserUpdateInterval);
    laserUpdateInterval = setInterval(() => {
      if (!laserActive) {
        clearInterval(laserUpdateInterval);
        laserUpdateInterval = null;
        return;
      }
      const dir = getAimDirection();
      const startPos = state.position.clone().add(dir.clone().multiplyScalar(0.5));
      onlineState.socket.emit('laser-update', {
        position: startPos.toArray(),
        direction: dir.toArray(),
        active: true
      });
    }, 50);
  }
}

function updateLaser(dt) {
  if (!laserActive) return;
  laserTimer += dt;
  if (laserTimer >= LASER_DURATION) {
    laserActive = false;
    if (laserMesh) {
      scene.remove(laserMesh);
      laserMesh.geometry.dispose();
      laserMesh.material.dispose();
      laserMesh = null;
    }
    if (laserLight) {
      scene.remove(laserLight);
      laserLight = null;
    }
    state.specialActive = false;
    state.specialTimer = 0;
    removeSpecialEffects();
    showSpecialIndicator(false);
    if (onlineState.socket) {
      onlineState.socket.emit('laser-update', { active: false });
      if (laserUpdateInterval) {
        clearInterval(laserUpdateInterval);
        laserUpdateInterval = null;
      }
    }
    return;
  }

  const dir = getAimDirection();
  const startPos = state.position.clone().add(dir.clone().multiplyScalar(0.5));
  const endPos = startPos.clone().add(dir.clone().multiplyScalar(LASER_MAX_RANGE));
  const midPos = startPos.clone().add(endPos).multiplyScalar(0.5);

  if (laserMesh) {
    laserMesh.position.copy(midPos);
    const up = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
    laserMesh.quaternion.copy(quat);
    const dist = startPos.distanceTo(endPos);
    laserMesh.scale.set(1, dist / LASER_MAX_RANGE, 1);
  }
  if (laserLight) {
    laserLight.position.copy(midPos);
  }

  const damagePerFrame = LASER_DMG_PER_SEC * dt;
  const raycaster = new THREE.Raycaster(startPos, dir, 0, LASER_MAX_RANGE);

  enemyBots.forEach(bot => {
    if (!bot.alive) return;
    const intersects = raycaster.intersectObject(bot.mesh, true);
    if (intersects.length > 0) {
      bot.health -= damagePerFrame;
      flashBot(bot);
      if (bot.health <= 0) killBot(bot);
    }
  });

  if (onlineState.socket) {
    remotePlayers.forEach((rp, id) => {
      if (!rp.alive) return;
      const intersects = raycaster.intersectObject(rp.mesh, true);
      if (intersects.length > 0) {
        onlineState.socket.emit('hit', { targetId: id, weaponType: 'laser' });
        flashRemote(id);
      }
    });
  }

  if (window.__destructibles) {
    window.__destructibles.forEach(obj => {
      if (!obj.alive) return;
      const intersects = raycaster.intersectObject(obj.mesh, true);
      if (intersects.length > 0) {
        obj.alive = false;
        obj.mesh.visible = false;
        createExplosion(obj.mesh.position.clone(), false, false, 0xff0000);
      }
    });
  }

  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GROUND_LEVEL);
  const ray = new THREE.Ray(startPos, dir);
  const intersectPoint = ray.intersectPlane(plane);
  if (intersectPoint) {
    if (Math.random() < 0.3) {
      createExplosion(intersectPoint, false, false, 0xff0000);
    }
  }
}

function applySpecialEffects(type) {
  removeSpecialEffects();
  if (type === 'bimotor') {
    const glow = new THREE.PointLight(0xff6600, 4.0, 18);
    glow.name = 'special-glow';
    vehicle.add(glow);
    const glow2 = new THREE.PointLight(0xff2200, 3.0, 12);
    glow2.name = 'special-glow';
    vehicle.add(glow2);
  } else if (type === 'jato') {
    const fieldMesh = new THREE.Mesh(
      new THREE.SphereGeometry(FIELD_RANGE, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.12, wireframe: true })
    );
    fieldMesh.name = 'damage-ring';
    vehicle.add(fieldMesh);
    const glow = new THREE.PointLight(0xff0000, 2.0, 10);
    glow.name = 'special-glow';
    vehicle.add(glow);
  } else if (type === 'sr71') {
    const glow = new THREE.PointLight(0xff0000, 1.5, 5);
    glow.name = 'special-glow';
    vehicle.add(glow);
  } else if (type === 'ovni') {
    const glow = new THREE.PointLight(0xff0000, 2.0, 15);
    glow.name = 'special-glow';
    vehicle.add(glow);
  } else if (type === 'amx') {
    const glow = new THREE.PointLight(AMX_MISSILE_COLOR, 1.6, 8);
    glow.name = 'special-glow';
    vehicle.add(glow);
  } else if (type === 'f22') {
    const glow = new THREE.PointLight(0xbfe9ff, 2.5, 12);
    glow.name = 'special-glow';
    vehicle.add(glow);
  } else if (type === 'b737') {
    const glow = new THREE.PointLight(B737_TRAIL_COLOR, 1.8, 10);
    glow.name = 'special-glow';
    vehicle.add(glow);
  }
}

function removeSpecialEffects() {
  const toRemove = [];
  vehicle.children.forEach(c => {
    if (['shield-mesh', 'damage-ring', 'turbo-trail', 'special-glow', 'special-ring'].includes(c.name)) {
      toRemove.push(c);
    }
  });
  toRemove.forEach(c => vehicle.remove(c));
}

function updateSpecial(dt) {
  if (state.specialCooldown > 0) {
    state.specialCooldown -= dt;
    if (state.specialCooldown < 0) state.specialCooldown = 0;
  }

  if (laserActive) {
    updateLaser(dt);
    return;
  }

  // O rastro luminoso do 737 precisa continuar sendo atualizado (dano +
  // fade) mesmo depois que a habilidade termina, então roda fora do
  // "if (state.specialActive)" abaixo.
  updateLightTrail(dt);

  if (state.specialActive) {
    state.specialTimer -= dt;
    if (selectedPlaneType === 'bimotor') {
      state.invulnerable = true;
      bimotorTrailTimer -= dt;
      if (bimotorTrailTimer <= 0) {
        bimotorTrailTimer = BIMOTOR_TRAIL_INTERVAL;
        const tailOffset = new THREE.Vector3(0, 0.1, 2.2).applyQuaternion(getVehicleQuaternion());
        spawnFireTrailPuff(state.position.clone().add(tailOffset));
        if (Math.random() < 0.5) {
          const offset2 = new THREE.Vector3(0, 0.1, 3.5).applyQuaternion(getVehicleQuaternion());
          spawnFireTrailPuff(state.position.clone().add(offset2));
        }
      }
    } else if (selectedPlaneType === 'jato') {
      state.invulnerable = true;
      enemyBots.forEach(bot => {
        if (!bot.alive) return;
        const key = 'bot-' + bot.mesh.uuid;
        if (fieldHitCooldowns.has(key)) return;
        if (state.position.distanceTo(bot.mesh.position) < FIELD_RANGE) {
          bot.health -= FIELD_DMG;
          fieldHitCooldowns.set(key, FIELD_HIT_COOLDOWN);
          createExplosion(bot.mesh.position.clone(), false, false, 0xff0000);
          flashBot(bot);
          playSound('hit');
          if (bot.health <= 0) killBot(bot);
        }
      });
    } else if (selectedPlaneType === 'sr71') {
      state.invisible = true;
    } else if (selectedPlaneType === 'cessna') {
      // Rajada de bombas: os tiros já são disparados pelo cessnaBombInterval
      // criado em triggerSpecial, não precisa de nada por frame aqui.
    } else if (selectedPlaneType === 'ovni') {
      // laser
    } else if (selectedPlaneType === 'boing') {
      // bombardeio
    } else if (selectedPlaneType === 'amx') {
      // Mísseis já são disparados pelo amxMissileInterval criado em
      // triggerSpecial, não precisa de nada por frame aqui.
    } else if (selectedPlaneType === 'f22') {
      // A física de velocidade (carga/rajada/recuperação) mora em
      // physics.js. Aqui só cuidamos do "gatilho único" da onda de choque
      // (no instante exato em que a fase de carga termina) e de manter a
      // invulnerabilidade durante carga + rajada (fases 1 e 2).
      const f22Elapsed = F22_BOOST_TOTAL - state.specialTimer;
      if (f22Elapsed >= F22_BOOST_CHARGE && !f22ShockwaveFired) {
        f22ShockwaveFired = true;
        triggerF22Shockwave();
      }
      state.invulnerable = f22Elapsed < (F22_BOOST_CHARGE + F22_BOOST_BURST);
    } else if (selectedPlaneType === 'b737') {
      b737TrailSampleTimer -= dt;
      if (b737TrailSampleTimer <= 0) {
        b737TrailSampleTimer = B737_TRAIL_SAMPLE_INTERVAL;
        spawnLightTrailOrb(state.position.clone());
      }
    } else if (selectedPlaneType === 'quatorzebis') {
      // Hiper Velocidade: invulnerável o tempo todo + rastro de fogo
      // atrás (mesmo efeito do ATR), sem cair/explodir no final.
      state.invulnerable = true;
      quatorzebisTrailTimer -= dt;
      if (quatorzebisTrailTimer <= 0) {
        quatorzebisTrailTimer = QUATORZEBIS_TRAIL_INTERVAL;
        const tailOffset = new THREE.Vector3(0, 0.1, 1.6).applyQuaternion(getVehicleQuaternion());
        spawnFireTrailPuff(state.position.clone().add(tailOffset));
      }
    } else if (selectedPlaneType === 'biplano') {
      // Super Metralhadora: os tiros já saem pelo biplanoMgInterval criado
      // em triggerSpecial, não precisa de nada por frame aqui.
    } else if (selectedPlaneType === 'seneca') {
      // Rajada Dupla: mísseis já saem pelo senecaMissileInterval.
    } else if (selectedPlaneType === 'b2spirit') {
      // Bombardeio Furtivo: bombas já caem pelo b2BombInterval.
    } else if (selectedPlaneType === 'heli') {
      // Ondas de Choque: invulnerável durante toda a habilidade (senão o
      // próprio helicóptero morreria no primeiro pulso — ver comentário
      // em triggerSpecial). Os pulsos em si já saem pelo
      // heliShockwaveInterval criado lá.
      state.invulnerable = true;
    } else if (selectedPlaneType === 'xwing') {
      // Metralhadora Laser: os disparos já saem pelo xwingLaserInterval.
    }

    if (state.specialTimer <= 0) {
      state.specialActive = false;
      state.specialTimer = 0;
      if (selectedPlaneType === 'bimotor') {
        triggerBimotorMegaExplosion();
        bimotorOverdriveActive = false;
        state.invulnerable = false;
      } else if (selectedPlaneType === 'jato') {
        state.invulnerable = false;
      } else if (selectedPlaneType === 'sr71') {
        state.invisible = false;
      } else if (selectedPlaneType === 'boing') {
        if (bombardeioInterval) {
          clearInterval(bombardeioInterval);
          bombardeioInterval = null;
        }
      } else if (selectedPlaneType === 'cessna') {
        if (cessnaBombInterval) {
          clearInterval(cessnaBombInterval);
          cessnaBombInterval = null;
        }
      } else if (selectedPlaneType === 'amx') {
        if (amxMissileInterval) {
          clearInterval(amxMissileInterval);
          amxMissileInterval = null;
        }
      } else if (selectedPlaneType === 'f22') {
        state.invulnerable = false;
        f22ShockwaveFired = false;
      } else if (selectedPlaneType === 'b737') {
        // Não faz mais nada aqui: cada bola já tem seu próprio contador de
        // 5s (ver updateLightTrail) e explode sozinha quando a vida dela
        // acabar, independente do fim da habilidade.
      } else if (selectedPlaneType === 'quatorzebis') {
        state.invulnerable = false;
      } else if (selectedPlaneType === 'biplano') {
        if (biplanoMgInterval) { clearInterval(biplanoMgInterval); biplanoMgInterval = null; }
      } else if (selectedPlaneType === 'seneca') {
        if (senecaMissileInterval) { clearInterval(senecaMissileInterval); senecaMissileInterval = null; }
        senecaMissileCount = 0;
      } else if (selectedPlaneType === 'b2spirit') {
        if (b2BombInterval) { clearInterval(b2BombInterval); b2BombInterval = null; }
        b2BombCount = 0;
      } else if (selectedPlaneType === 'heli') {
        state.invulnerable = false;
        if (heliShockwaveInterval) { clearInterval(heliShockwaveInterval); heliShockwaveInterval = null; }
        heliShockwaveCount = 0;
      } else if (selectedPlaneType === 'xwing') {
        if (xwingLaserInterval) { clearInterval(xwingLaserInterval); xwingLaserInterval = null; }
      }
      removeSpecialEffects();
      showSpecialIndicator(false);
    }
  }

  fieldHitCooldowns.forEach((v, k) => {
    const nv = v - dt;
    if (nv <= 0) fieldHitCooldowns.delete(k);
    else fieldHitCooldowns.set(k, nv);
  });

  if (state.specialActive) {
    showSpecialIndicator(true);
    if (!prevSpecialActive) {
      applySpecialEffects(selectedPlaneType);
    }
  } else {
    if (prevSpecialActive) {
      removeSpecialEffects();
      showSpecialIndicator(false);
    }
  }
  prevSpecialActive = state.specialActive;
}

let specialIndicatorEl = null;
function showSpecialIndicator(show) {
  if (!specialIndicatorEl) {
    specialIndicatorEl = document.createElement('div');
    specialIndicatorEl.id = 'special-indicator';
    document.body.appendChild(specialIndicatorEl);
  }
  if (show) {
    const typeName = currentPlaneSpec.specialLabel;
    const timer = Math.ceil(state.specialTimer);
    specialIndicatorEl.textContent = timer > 0 ? ('⚡ ' + typeName + ' ' + timer + 's') : ('⚡ ' + typeName + ' ATIVO!');
    specialIndicatorEl.classList.add('show');
  } else {
    specialIndicatorEl.classList.remove('show');
  }
}