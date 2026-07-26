// ================================================================
//  weather.js — CLIMA DINÂMICO
//  A cada poucos minutos, um evento é sorteado dentre os permitidos
//  pro mapa atual (ver MAP_WEATHER_PROFILES em map-cidade.js):
//    🌧️ chuva        (cidade, floresta)
//    🌫️ neblina       (cidade, floresta)
//    🏜️ tempestade de areia (deserto)
//    🛩️ dirigível     (cidade, deserto, floresta) — atirar nele explode
//       e causa dano em área em todo mundo que estiver perto.
//  'laboratorio' fica de fora de propósito (já tem atmosfera própria).
//
//  Tudo é avisado ANTES pelo narrador de voz (voice-announcer.js) e
//  entra/sai GRADUALMENTE (fog + partículas leves interpoladas ao
//  longo de vários segundos) — dá pra ver a chuva/tempestade chegando
//  de longe antes dela cobrir a tela.
//
//  MULTIPLAYER: não existe estado de servidor pra clima (isso exigiria
//  mexer no backend, que não faz parte destes arquivos). Em vez disso
//  cada cliente roda a MESMA sequência de eventos de forma determinística
//  — a semente do sorteio é derivada do ID da sala (onlineState.roomId),
//  então todo mundo na mesma sala sorteia os mesmos eventos, na mesma
//  ordem. Pequenas variações de timing entre clientes (poucos segundos)
//  podem acontecer, mas a experiência visual fica igual pra todos.
//
//  DIRIGÍVEL: os "nós de colisão" dele são espalhados ao longo do
//  corpo inteiro e plugados direto em window.__destructibles — o
//  mesmo array que balas de metralhadora, mísseis, bombas e o laser JÁ
//  verificam (ver weapons.js/abilities.js). Ou seja: qualquer arma que
//  já existe no jogo acerta o dirigível sem precisar mexer nesses
//  arquivos. Quando ele "morre" (qualquer nó marcado alive=false),
//  weather.js detecta isso no próprio update() e dispara a explosão
//  grande com dano em área (reaproveitando resolveBombDamage, de
//  weapons.js — o mesmo sistema usado pelas bombas normais, que já
//  cuida de acertar bots, jogadores remotos e você mesmo, e já avisa
//  os outros clientes da sala pra verem a explosão também).
// ================================================================

const weatherGroup = new THREE.Group();
scene.add(weatherGroup);

let weatherMapMode = null;
let weatherRng = Math.random;
let weatherBaseFog = { color: 0x87CEEB, near: 100, far: 700 };
let weatherBaseSky = 0x87CEEB;
let weatherOverlayEl = null;

// PEDIDO: pausar o clima/dirigível junto com o resto do jogo (pausa ou
// menu principal) — ver setWeatherPaused()/main.js. Enquanto pausado,
// updateWeather() nem sequer mexe nos timers, então tudo fica
// congelado exatamente onde estava (nada de "correr por baixo dos
// panos" enquanto o jogo tá parado).
let weatherPaused = false;

// ---- clima atmosférico (chuva / neblina / tempestade) ----
// PEDIDO: intervalo entre eventos aleatório, mín. 40s / máx. 1min30 (90s).
const ATMO_MIN_GAP = 40, ATMO_MAX_GAP = 90;
const ATMO_WARNING_LEAD = 8;
const ATMO_TRANSITION_IN = 8;
// PEDIDO: evento dura bem menos que antes (era 45–85s).
const ATMO_ACTIVE_MIN = 18, ATMO_ACTIVE_MAX = 35;
const ATMO_TRANSITION_OUT = 8;

const atmo = { type: null, phase: 'idle', timer: 0, intensity: 0, lastType: null };

// ---- dirigível ----
// PEDIDO: tava aparecendo dirigível demais — dobramos o teto (era até
// 180s) pra sair pela metade da frequência, mantendo o mesmo espírito
// (aleatório cheio, sem mínimo, só um teto pra poder aparecer).
const BLIMP_MIN_GAP = 0, BLIMP_MAX_GAP = 360;
const BLIMP_WARNING_LEAD = 8;
const BLIMP_SPEED = 16;
const BLIMP_ALTITUDE_MIN = 65, BLIMP_ALTITUDE_MAX = 95;
const BLIMP_LENGTH = 42;
const BLIMP_SPAWN_RADIUS = 650;
const BLIMP_EXPLOSION_RADIUS = 55;
const BLIMP_EXPLOSION_DAMAGE = 90;
const BLIMP_HIT_NODES = 5;

const blimp = {
  phase: 'idle', timer: 0,
  group: null, nodes: [], shared: null,
  dir: new THREE.Vector3(), speed: 0, traveled: 0, totalDist: 0,
};

// ================================================================
//  RNG determinístico (mesma sala => mesma sequência de clima)
// ================================================================
function _hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0; }
  return h >>> 0;
}
function _mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function _lerpNum(a, b, t) { return a + (b - a) * t; }

// ================================================================
//  PARTÍCULAS (criadas uma única vez, só ligam/desligam opacidade —
//  barato de manter, nada é recriado a cada evento de clima)
// ================================================================
const RAIN_COUNT = 900, RAIN_BOX = 260, RAIN_HEIGHT = 140;
const SAND_COUNT = 700, SAND_BOX = 320;

function _createPointCloud(count, colorHex, size) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: colorHex, size, transparent: true, opacity: 0,
    depthWrite: false, sizeAttenuation: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.visible = false;
  pts.frustumCulled = false;
  weatherGroup.add(pts);
  return pts;
}

// PEDIDO: a chuva tava quase invisível (ponto de 0.35, sem textura —
// vira um pixel redondo genérico). Agora cada gota usa um sprite em
// forma de traço vertical (um retângulo com fade nas pontas), maior e
// com blending aditivo, então lê como "chuva" de verdade, não como
// poeira.
function _buildRainDropTexture() {
  const w = 16, h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(220,235,255,0)');
  grad.addColorStop(0.15, 'rgba(220,235,255,0.9)');
  grad.addColorStop(0.85, 'rgba(220,235,255,0.9)');
  grad.addColorStop(1, 'rgba(220,235,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(w / 2 - 2, 0, 4, h);
  return new THREE.CanvasTexture(canvas);
}
const _rainDropTexture = _buildRainDropTexture();

const RAIN_SIZE = 2.4;
const rainPoints = _createPointCloud(RAIN_COUNT, 0xdcebff, RAIN_SIZE);
rainPoints.material.map = _rainDropTexture;
rainPoints.material.blending = THREE.AdditiveBlending;
rainPoints.material.needsUpdate = true;
(function initRain() {
  const arr = rainPoints.geometry.attributes.position.array;
  for (let i = 0; i < RAIN_COUNT; i++) {
    arr[i * 3] = (Math.random() - 0.5) * RAIN_BOX;
    arr[i * 3 + 1] = Math.random() * RAIN_HEIGHT;
    arr[i * 3 + 2] = (Math.random() - 0.5) * RAIN_BOX;
  }
})();

const sandPoints = _createPointCloud(SAND_COUNT, 0xd9a35c, 0.6);
(function initSand() {
  const arr = sandPoints.geometry.attributes.position.array;
  for (let i = 0; i < SAND_COUNT; i++) {
    arr[i * 3] = (Math.random() - 0.5) * SAND_BOX;
    arr[i * 3 + 1] = Math.random() * 60 + 2;
    arr[i * 3 + 2] = (Math.random() - 0.5) * SAND_BOX;
  }
})();

// PEDIDO: neblina tinha só fog+overlay, sem nenhuma partícula de
// verdade. Adicionamos uma nuvem leve de "flocos" de névoa (poucas
// partículas, grandes e bem transparentes, deslocando devagar) — dá
// profundidade sem pesar (bem menos partículas que a chuva/areia).
const FOG_PARTICLE_COUNT = 140, FOG_BOX = 220, FOG_HEIGHT = 34;
const fogPoints = _createPointCloud(FOG_PARTICLE_COUNT, 0xffffff, 9);
fogPoints.material.opacity = 0;
(function initFogParticles() {
  const arr = fogPoints.geometry.attributes.position.array;
  for (let i = 0; i < FOG_PARTICLE_COUNT; i++) {
    arr[i * 3] = (Math.random() - 0.5) * FOG_BOX;
    arr[i * 3 + 1] = Math.random() * FOG_HEIGHT + 1;
    arr[i * 3 + 2] = (Math.random() - 0.5) * FOG_BOX;
  }
})();
function _updateFogParticles(dt) {
  const p = _playerPos();
  fogPoints.position.set(p.x, 0, p.z);
  const arr = fogPoints.geometry.attributes.position.array;
  const driftX = 2.2, driftZ = 1.1;
  for (let i = 0; i < FOG_PARTICLE_COUNT; i++) {
    arr[i * 3] += driftX * dt;
    arr[i * 3 + 2] += driftZ * dt;
    if (arr[i * 3] > FOG_BOX / 2) {
      arr[i * 3] = -FOG_BOX / 2;
      arr[i * 3 + 1] = Math.random() * FOG_HEIGHT + 1;
      arr[i * 3 + 2] = (Math.random() - 0.5) * FOG_BOX;
    }
  }
  fogPoints.geometry.attributes.position.needsUpdate = true;
}

function _ensureOverlay() {
  if (weatherOverlayEl) return;
  weatherOverlayEl = document.createElement('div');
  weatherOverlayEl.id = 'weather-overlay';
  weatherOverlayEl.style.cssText = `
    position:fixed; inset:0; pointer-events:none; z-index:5;
    opacity:0; mix-blend-mode:multiply;
  `;
  document.body.appendChild(weatherOverlayEl);
}

function _playerPos() {
  return (typeof state !== 'undefined' && state.position) ? state.position : new THREE.Vector3();
}

function _updateRainParticles(dt) {
  const p = _playerPos();
  rainPoints.position.set(p.x, 0, p.z);
  const arr = rainPoints.geometry.attributes.position.array;
  const fallSpeed = 55;
  for (let i = 0; i < RAIN_COUNT; i++) {
    arr[i * 3 + 1] -= fallSpeed * dt;
    if (arr[i * 3 + 1] < -2) {
      arr[i * 3] = (Math.random() - 0.5) * RAIN_BOX;
      arr[i * 3 + 1] = RAIN_HEIGHT * (0.6 + Math.random() * 0.4);
      arr[i * 3 + 2] = (Math.random() - 0.5) * RAIN_BOX;
    }
  }
  rainPoints.geometry.attributes.position.needsUpdate = true;
}

function _updateSandParticles(dt) {
  const p = _playerPos();
  sandPoints.position.set(p.x, 0, p.z);
  const arr = sandPoints.geometry.attributes.position.array;
  const windX = 34, windZ = 14, fallSpeed = 1.5;
  for (let i = 0; i < SAND_COUNT; i++) {
    arr[i * 3] += windX * dt;
    arr[i * 3 + 2] += windZ * dt;
    arr[i * 3 + 1] -= fallSpeed * dt;
    if (arr[i * 3] > SAND_BOX / 2 || arr[i * 3 + 1] < 0) {
      arr[i * 3] = -SAND_BOX / 2 + Math.random() * 20;
      arr[i * 3 + 1] = Math.random() * 55 + 2;
      arr[i * 3 + 2] = (Math.random() - 0.5) * SAND_BOX;
    }
  }
  sandPoints.geometry.attributes.position.needsUpdate = true;
}

// Chuva digital do mapa Laboratório — anima independente do resto do
// clima (esse mapa nem participa do ciclo dinâmico), só reaproveita o
// mesmo loop de update pra não precisar mexer em main.js de novo.
function _updateDigitalRain(dt) {
  const rain = window.__labDigitalRain;
  if (!rain || !rain.parent) return;
  const arr = rain.geometry.attributes.position.array;
  const speed = 34;
  for (let i = 1; i < arr.length; i += 3) {
    arr[i] -= speed * dt;
    if (arr[i] < -2) arr[i] = 150 + Math.random() * 20;
  }
  rain.geometry.attributes.position.needsUpdate = true;
}

// ================================================================
//  FOG / OVERLAY — interpola gradualmente entre o "clima base" do
//  mapa (capturado em resetWeather) e o visual-alvo do evento atual.
// ================================================================
function _restoreBaseFog() {
  if (scene.fog) {
    scene.fog.color.setHex(weatherBaseFog.color);
    scene.fog.near = weatherBaseFog.near;
    scene.fog.far = weatherBaseFog.far;
  }
  if (scene.background && scene.background.isColor) scene.background.setHex(weatherBaseSky);
  _ensureOverlay();
  weatherOverlayEl.style.opacity = '0';
  rainPoints.visible = false; rainPoints.material.opacity = 0;
  sandPoints.visible = false; sandPoints.material.opacity = 0;
  fogPoints.visible = false; fogPoints.material.opacity = 0;
}

function _hideAllAtmoEffects() { _restoreBaseFog(); }

function _applyAtmoIntensity(type, t) {
  _ensureOverlay();
  const baseColor = new THREE.Color(weatherBaseFog.color);
  const baseSky = new THREE.Color(weatherBaseSky);
  let targetColor, targetNear, targetFar, overlayRGB, overlayMax, targetSky;

  if (type === 'chuva') {
    targetColor = new THREE.Color(0x4c5b66); targetNear = 60; targetFar = 280;
    overlayRGB = '10,18,32'; overlayMax = 0.12;
    // PEDIDO: o céu tem que escurecer de verdade durante a chuva, não só
    // a névoa — antes só o fog mudava e o background continuava azul-céu
    // normal, ficava estranho (chovendo com céu de sol).
    targetSky = new THREE.Color(0x39424c);
  } else if (type === 'neblina') {
    // PEDIDO: neblina tava densa e escura demais (near=12/far=100,
    // opacity=0.30 — cortava a visibilidade quase toda). Agora ela só
    // "esbranquiça" o ar sem grudar tão perto e sem escurecer a tela.
    targetColor = new THREE.Color(0xdfe4e0); targetNear = 55; targetFar = 260;
    overlayRGB = '210,215,212'; overlayMax = 0.14;
    targetSky = new THREE.Color(0xc9d2ce);
  } else if (type === 'tempestade') {
    targetColor = new THREE.Color(0xcf9a5c); targetNear = 30; targetFar = 170;
    overlayRGB = '190,120,45'; overlayMax = 0.22;
    targetSky = new THREE.Color(0xb9884e);
  } else {
    return;
  }

  if (scene.fog) {
    scene.fog.color.copy(baseColor).lerp(targetColor, t);
    scene.fog.near = _lerpNum(weatherBaseFog.near, targetNear, t);
    scene.fog.far = _lerpNum(weatherBaseFog.far, targetFar, t);
  }
  if (scene.background && scene.background.isColor) {
    scene.background.copy(baseSky).lerp(targetSky, t);
  }

  weatherOverlayEl.style.background =
    `radial-gradient(circle at 50% 45%, rgba(${overlayRGB},0) 30%, rgba(${overlayRGB},${overlayMax}) 100%)`;
  weatherOverlayEl.style.opacity = String(Math.min(1, t));

  rainPoints.visible = type === 'chuva' && t > 0.02;
  rainPoints.material.opacity = type === 'chuva' ? 0.9 * t : 0;
  sandPoints.visible = type === 'tempestade' && t > 0.02;
  sandPoints.material.opacity = type === 'tempestade' ? 0.9 * t : 0;
  fogPoints.visible = type === 'neblina' && t > 0.02;
  fogPoints.material.opacity = type === 'neblina' ? 0.35 * t : 0;
}

// ================================================================
//  NARRAÇÃO
// ================================================================
function _atmoIcon(type) { return type === 'chuva' ? '🌧️' : type === 'neblina' ? '🌫️' : type === 'tempestade' ? '🏜️' : '🌦️'; }
function _atmoNome(type) { return type === 'chuva' ? 'Chuva' : type === 'neblina' ? 'Neblina' : type === 'tempestade' ? 'Tempestade de areia' : 'Clima'; }

function _announceAtmoIncoming(type) {
  const falas = {
    chuva: 'Chuva se aproximando!',
    neblina: 'Neblina se aproximando!',
    tempestade: 'Tempestade de areia chegando!',
  };
  voiceAnnounce(falas[type], false);
  showTemporaryMessage(_atmoIcon(type) + ' ' + _atmoNome(type) + ' se aproximando...', 4500);
}
function _announceAtmoClearing(type) {
  const falas = {
    chuva: 'Chuva passando.',
    neblina: 'Neblina se dissipando.',
    tempestade: 'Tempestade passando.',
  };
  voiceAnnounce(falas[type], true);
  showTemporaryMessage(_atmoIcon(type) + ' ' + _atmoNome(type) + ' passando...', 3500);
}

// ================================================================
//  MÁQUINA DE ESTADOS — CLIMA ATMOSFÉRICO
// ================================================================
// PEDIDO: evitar repetir o mesmo tipo de clima duas vezes seguidas (ex:
// sempre cair "neblina" por azar do sorteio). Se o mapa só tiver uma
// opção só (ou o sorteio "trava" nela por falta de alternativa), caímos
// de volta pra lista original — não trava o jogo esperando um tipo que
// não existe.
function _pickAtmoType(options, exclude) {
  let pool = options;
  if (exclude && options.length > 1) {
    const filtered = options.filter(k => k !== exclude);
    if (filtered.length) pool = filtered;
  }
  return pool[Math.floor(weatherRng() * pool.length)];
}

function _updateAtmospheric(dt, profile) {
  const options = profile.filter(k => k === 'chuva' || k === 'neblina' || k === 'tempestade');
  if (!options.length) {
    if (atmo.phase !== 'idle') { atmo.phase = 'idle'; atmo.type = null; atmo.intensity = 0; _hideAllAtmoEffects(); }
    return;
  }

  atmo.timer -= dt;

  if (atmo.phase === 'idle') {
    if (atmo.timer <= 0) {
      atmo.type = _pickAtmoType(options, atmo.lastType);
      atmo.lastType = atmo.type;
      atmo.phase = 'aviso';
      atmo.timer = ATMO_WARNING_LEAD;
      _announceAtmoIncoming(atmo.type);
      _wlog('evento sorteado: ' + atmo.type + ' (aviso por ' + ATMO_WARNING_LEAD + 's)');
    }
  } else if (atmo.phase === 'aviso') {
    if (atmo.timer <= 0) { atmo.phase = 'entrando'; atmo.timer = ATMO_TRANSITION_IN; _wlog(atmo.type + ' entrando...'); }
  } else if (atmo.phase === 'entrando') {
    atmo.intensity = 1 - Math.max(0, atmo.timer) / ATMO_TRANSITION_IN;
    _applyAtmoIntensity(atmo.type, atmo.intensity);
    if (atmo.timer <= 0) {
      atmo.intensity = 1; _applyAtmoIntensity(atmo.type, 1);
      atmo.phase = 'ativo';
      atmo.timer = ATMO_ACTIVE_MIN + weatherRng() * (ATMO_ACTIVE_MAX - ATMO_ACTIVE_MIN);
      _wlog(atmo.type + ' ATIVO por ~' + atmo.timer.toFixed(0) + 's');
    }
  } else if (atmo.phase === 'ativo') {
    if (atmo.timer <= 0) {
      atmo.phase = 'saindo'; atmo.timer = ATMO_TRANSITION_OUT;
      _announceAtmoClearing(atmo.type);
      _wlog(atmo.type + ' saindo...');
    }
  } else if (atmo.phase === 'saindo') {
    atmo.intensity = Math.max(0, atmo.timer) / ATMO_TRANSITION_OUT;
    _applyAtmoIntensity(atmo.type, atmo.intensity);
    if (atmo.timer <= 0) {
      _hideAllAtmoEffects();
      _wlog(atmo.type + ' terminou. Próximo evento em ~' + (ATMO_MIN_GAP + (ATMO_MAX_GAP - ATMO_MIN_GAP) / 2).toFixed(0) + 's (médio)');
      atmo.type = null; atmo.phase = 'idle';
      atmo.timer = ATMO_MIN_GAP + weatherRng() * (ATMO_MAX_GAP - ATMO_MIN_GAP);
    }
  }

  if (atmo.phase === 'entrando' || atmo.phase === 'ativo' || atmo.phase === 'saindo') {
    if (rainPoints.visible) _updateRainParticles(dt);
    if (sandPoints.visible) _updateSandParticles(dt);
    if (fogPoints.visible) _updateFogParticles(dt);
  }
}

// ================================================================
//  DIRIGÍVEL
// ================================================================
function _spawnBlimp() {
  const angle = weatherRng() * Math.PI * 2;
  const start = new THREE.Vector3(
    Math.cos(angle) * BLIMP_SPAWN_RADIUS,
    BLIMP_ALTITUDE_MIN + weatherRng() * (BLIMP_ALTITUDE_MAX - BLIMP_ALTITUDE_MIN),
    Math.sin(angle) * BLIMP_SPAWN_RADIUS
  );
  const end = start.clone().multiplyScalar(-1);
  end.y = start.y;
  const dir = end.clone().sub(start).normalize();

  const group = new THREE.Group();
  group.position.copy(start);
  group.rotation.y = Math.atan2(dir.x, dir.z);

  const envelope = new THREE.Mesh(
    new THREE.SphereGeometry(4.2, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.6, metalness: 0.05 })
  );
  envelope.scale.set(1, 1, BLIMP_LENGTH / (4.2 * 2));
  group.add(envelope);

  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 8.4, BLIMP_LENGTH * 0.85),
    new THREE.MeshStandardMaterial({ color: 0xcc3333, roughness: 0.6 })
  );
  stripe.position.y = 0.2;
  group.add(stripe);

  const finMat = new THREE.MeshStandardMaterial({ color: 0x883333, roughness: 0.7 });
  const finV = new THREE.Mesh(new THREE.BoxGeometry(0.3, 7, 6), finMat);
  finV.position.set(0, 0, -BLIMP_LENGTH / 2 + 2);
  group.add(finV);
  const finH = new THREE.Mesh(new THREE.BoxGeometry(9, 0.3, 6), finMat);
  finH.position.set(0, 0, -BLIMP_LENGTH / 2 + 2);
  group.add(finH);

  const gondola = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 1.7, 6.5),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.85 })
  );
  gondola.position.y = -5.3;
  group.add(gondola);

  weatherGroup.add(group);

  const shared = { alive: true };
  const nodes = [];
  for (let i = 0; i < BLIMP_HIT_NODES; i++) {
    const localOffset = (i / (BLIMP_HIT_NODES - 1) - 0.5) * BLIMP_LENGTH;
    const posHolder = new THREE.Vector3();
    const proxy = { mesh: { position: posHolder, visible: true }, isBlimpNode: true };
    Object.defineProperty(proxy, 'alive', {
      get() { return shared.alive; },
      set(v) { if (!v) shared.alive = false; },
    });
    nodes.push({ proxy, localOffset, posHolder });
    if (!window.__destructibles) window.__destructibles = [];
    window.__destructibles.push(proxy);
  }

  blimp.group = group;
  blimp.nodes = nodes;
  blimp.shared = shared;
  blimp.dir = dir;
  blimp.speed = BLIMP_SPEED;
  blimp.traveled = 0;
  blimp.totalDist = start.distanceTo(end);

  voiceAnnounce('Dirigível avistado! Atire nele: a explosão dá dano em todos por perto!', false);
  showTemporaryMessage('🛩️ Dirigível sobrevoando o mapa — atirar nele causa dano em área!', 4000);
}

function _despawnBlimp() {
  if (blimp.group) {
    blimp.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { if (Array.isArray(o.material)) o.material.forEach(m => m.dispose()); else o.material.dispose(); }
    });
    weatherGroup.remove(blimp.group);
  }
  if (window.__destructibles && blimp.nodes.length) {
    window.__destructibles = window.__destructibles.filter(o => !blimp.nodes.some(n => n.proxy === o));
  }
  blimp.group = null;
  blimp.nodes = [];
  blimp.shared = null;
  blimp.phase = 'idle';
  blimp.timer = BLIMP_MIN_GAP + weatherRng() * (BLIMP_MAX_GAP - BLIMP_MIN_GAP);
}

function _explodeBlimp() {
  const pos = blimp.group.position.clone();
  createExplosion(pos, true, true, 0xffaa33, BLIMP_EXPLOSION_RADIUS * 1.4);
  // NOTA MULTIPLAYER: se dois jogadores acertarem o dirigível quase ao
  // mesmo tempo em telas diferentes, cada cliente detecta a "morte"
  // localmente e chama resolveBombDamage() uma vez — em teoria dá pra
  // acontecer uma explosão duplicada nesse caso raríssimo. Resolver
  // isso de vez exigiria o servidor ser dono do estado do dirigível,
  // fora do escopo do que dá pra fazer só no cliente.
  if (typeof resolveBombDamage === 'function') {
    resolveBombDamage(pos, false, BLIMP_EXPLOSION_DAMAGE, BLIMP_EXPLOSION_RADIUS, 'blimp');
  }
  if (typeof cameraShake === 'function') cameraShake(1.4, 0.9);
  if (typeof playSound === 'function') playSound('explosion');
  voiceAnnounce('Dirigível abatido!', false);
  showTemporaryMessage('💥 Dirigível abatido!', 3500);
  _despawnBlimp();
}

function _updateBlimp(dt) {
  blimp.timer -= dt;
  if (blimp.phase === 'idle') {
    if (blimp.timer <= 0) {
      blimp.phase = 'aviso';
      blimp.timer = BLIMP_WARNING_LEAD;
      voiceAnnounce('Dirigível se aproximando.', false);
      showTemporaryMessage('📡 Dirigível se aproximando! Atire nele: a explosão causa dano em área.', 3500);
      _wlog('dirigível: aviso (chega em ' + BLIMP_WARNING_LEAD + 's)');
    }
    return;
  }
  if (blimp.phase === 'aviso') {
    if (blimp.timer <= 0) { _spawnBlimp(); blimp.phase = 'voando'; _wlog('dirigível: voando'); }
    return;
  }
  if (blimp.phase === 'voando') {
    if (!blimp.group) { _despawnBlimp(); return; }
    blimp.nodes.forEach(n => n.posHolder.copy(blimp.group.position).addScaledVector(blimp.dir, n.localOffset));
    if (!blimp.shared.alive) { _explodeBlimp(); return; }
    blimp.group.position.addScaledVector(blimp.dir, blimp.speed * dt);
    blimp.traveled += blimp.speed * dt;
    blimp.group.rotation.z = Math.sin(performance.now() * 0.0004) * 0.02;
    if (blimp.traveled >= blimp.totalDist + 40) _despawnBlimp();
  }
}

// ================================================================
//  API PÚBLICA — chamada por environment.js (resetWeather) e
//  main.js (updateWeather a cada frame)
// ================================================================
// DEBUG: liga logs de fase no console (fica fácil ver o clima "andando"
// mesmo antes do primeiro evento aparecer na tela). Pra desligar, rode
// no console: window.__weatherDebug = false
window.__weatherDebug = true;
function _wlog(...args) { if (window.__weatherDebug) console.log('[CLIMA]', ...args); }

function resetWeather(mode) {
  weatherMapMode = mode;
  weatherPaused = false;
  if (scene.fog) weatherBaseFog = { color: scene.fog.color.getHex(), near: scene.fog.near, far: scene.fog.far };
  if (scene.background && scene.background.isColor) weatherBaseSky = scene.background.getHex();

  const seedSrc = (typeof onlineState !== 'undefined' && onlineState.roomId)
    ? ('sala:' + onlineState.roomId)
    : ('solo:' + Math.floor(Math.random() * 1e9));
  weatherRng = _mulberry32(_hashString(seedSrc));

  atmo.type = null; atmo.phase = 'idle'; atmo.intensity = 0; atmo.lastType = null;
  // Intervalo já é curto o suficiente (40–90s) pra não precisar de
  // nenhum hack de "primeiro evento mais rápido" — o próprio ciclo
  // normal já dá sinal de vida rápido.
  atmo.timer = ATMO_MIN_GAP + weatherRng() * (ATMO_MAX_GAP - ATMO_MIN_GAP);
  _hideAllAtmoEffects();

  _despawnBlimp();
  // Dirigível: aleatório cheio, só com teto de 3min pra poder aparecer
  // (BLIMP_MIN_GAP=0). Pode sortear bem pertinho de 0 (aparece rápido)
  // ou perto do teto (partida pode acabar antes — não aparece, de
  // propósito).
  blimp.timer = BLIMP_MIN_GAP + weatherRng() * (BLIMP_MAX_GAP - BLIMP_MIN_GAP);

  _wlog('resetWeather(' + mode + ') — próximo evento atmosférico em ~' + atmo.timer.toFixed(0) + 's, dirigível em ~' + blimp.timer.toFixed(0) + 's (teto 180s, pode não aparecer)');
}

// DEBUG: força um evento de clima na hora, sem esperar o timer, pra
// testar rápido pelo console do navegador (F12):
//   forceWeather('chuva')       forceWeather('neblina')
//   forceWeather('tempestade')  forceWeather('dirigivel')
function forceWeather(type) {
  if (type === 'dirigivel') {
    _despawnBlimp();
    blimp.phase = 'idle';
    blimp.timer = 0;
    _wlog('forceWeather: dirigível forçado.');
    return;
  }
  if (type !== 'chuva' && type !== 'neblina' && type !== 'tempestade') {
    console.warn('[CLIMA] tipo inválido. Use: chuva | neblina | tempestade | dirigivel');
    return;
  }
  atmo.type = type;
  atmo.phase = 'entrando';
  atmo.timer = ATMO_TRANSITION_IN;
  _announceAtmoIncoming(type);
  _wlog('forceWeather: ' + type + ' forçado.');
}
window.forceWeather = forceWeather;

// PEDIDO: pausar o jogo (ou voltar pro menu) tem que congelar o clima e
// o dirigível de verdade — nada de timer andando, nada de narrador
// falando, nada de dirigível se movendo enquanto a tela de pausa/menu
// está na frente. Chamado toda frame por main.js com o estado atual
// (idempotente, então não tem problema chamar sempre).
function setWeatherPaused(paused) {
  weatherPaused = !!paused;
}
window.setWeatherPaused = setWeatherPaused;

// Corte total, usado especificamente ao voltar pro menu principal (não
// é só uma pausa temporária — o jogador saiu da partida). Esconde
// qualquer efeito de clima na tela, tira o dirigível do ar se tiver um
// voando, e cancela qualquer fala do narrador que ainda estivesse na
// fila (senão ele terminaria de anunciar dirigível/clima já no menu).
function haltWeatherForMenu() {
  atmo.phase = 'idle'; atmo.type = null; atmo.intensity = 0;
  _hideAllAtmoEffects();
  if (blimp.group || blimp.phase !== 'idle') _despawnBlimp();
  if (typeof stopVoiceAnnouncer === 'function') stopVoiceAnnouncer();
  _wlog('clima/dirigível totalmente parados (voltou pro menu).');
}
window.haltWeatherForMenu = haltWeatherForMenu;

let _weatherHeartbeat = 0;
function updateWeather(dt) {
  if (!weatherMapMode || weatherPaused) return;
  const profile = (typeof MAP_WEATHER_PROFILES !== 'undefined' && MAP_WEATHER_PROFILES[weatherMapMode]) || [];

  // DEBUG: um "pulso" a cada ~10s mostrando quanto falta pro próximo
  // evento — assim dá pra confirmar que o sistema está rodando mesmo
  // que nada tenha aparecido na tela ainda.
  if (window.__weatherDebug) {
    _weatherHeartbeat += dt;
    if (_weatherHeartbeat >= 10) {
      _weatherHeartbeat = 0;
      _wlog('rodando — mapa=' + weatherMapMode + ' | fase atmo=' + atmo.phase + ' (faltam ' + Math.max(0, atmo.timer).toFixed(0) + 's) | fase dirigível=' + blimp.phase + ' (faltam ' + Math.max(0, blimp.timer).toFixed(0) + 's)');
    }
  }

  _updateAtmospheric(dt, profile);

  if (profile.includes('dirigivel')) {
    _updateBlimp(dt);
  } else if (blimp.phase !== 'idle' || blimp.group) {
    _despawnBlimp();
  }

  _updateDigitalRain(dt);
}