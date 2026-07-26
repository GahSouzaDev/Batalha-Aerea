// ================================================================
//  weather.js — CLIMA DINÂMICO
//  A cada evento, um tipo é sorteado dentre os permitidos pro mapa
//  atual (ver MAP_WEATHER_PROFILES em map-cidade.js):
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
//  TIMING (modo solo/bots):
//   • Clima: 35s depois do início da partida, o 1º evento chega (com
//     aviso). Fica ativo por 35s. Some, fica limpo por 35s, e entra
//     outro clima — sempre sorteado (pode repetir o mesmo tipo).
//   • Dirigível: aparece 60s depois do início. Se for abatido, o
//     próximo demora a METADE do tempo anterior (60 -> 30 -> 15 -> ...,
//     com piso de 5s só por segurança). Se ele escapar sem ser
//     abatido, o intervalo volta ao padrão de 60s.
//
//  MULTIPLAYER: agora o clima é AUTORIDADE DO SERVIDOR (ver server.js —
//  room.weather). O servidor roda a mesma máquina de estados e manda
//  eventos ('weather-phase', 'blimp-phase', 'blimp-exploded') pra sala
//  inteira, então todo mundo vê a MESMA chuva/neblina/tempestade e o
//  MESMO dirigível, no mesmo lugar, ao mesmo tempo — sem depender de
//  RNG "combinado" entre clientes. Este arquivo só INTERPOLA
//  visualmente (fog/partículas/posição do dirigível) com base no que o
//  servidor mandou; quem decide QUANDO e O QUÊ é sempre o servidor.
//
//  SALA LIVRE ("modo livre"): usa o MESMO sistema de servidor acima,
//  só que com durações bem mais longas (clima ativo por 120s, limpo
//  por 240s — ver FREE_ATMO_* em server.js) e persistente: o clima
//  nunca "reseta" quando alguém entra ou sai, então quem entra pode já
//  cair chovendo, exatamente como quem já estava lá está vendo.
//
//  DIRIGÍVEL: os "nós de colisão" dele são espalhados ao longo do
//  corpo inteiro e plugados direto em window.__destructibles — o
//  mesmo array que balas de metralhadora, mísseis, bombas e o laser JÁ
//  verificam (ver weapons.js/abilities.js). Ou seja: qualquer arma que
//  já existe no jogo acerta o dirigível sem precisar mexer nesses
//  arquivos — incluindo bombas, que dão o dano grande de área
//  (BLIMP_EXPLOSION_DAMAGE) igual uma habilidade forte. Cada cliente só
//  detecta localmente os acertos das SUAS PRÓPRIAS armas (do jeito que
//  o resto do jogo já funciona); quem dá o tiro que mata avisa o
//  servidor (evento 'blimp-killed'), e o servidor manda a explosão pra
//  sala inteira ver.
// ================================================================

const weatherGroup = new THREE.Group();
scene.add(weatherGroup);

let weatherMapMode = null;
let weatherOnline = false; // true = sala multiplayer (servidor manda o clima)
let weatherRng = Math.random;
let weatherBaseFog = { color: 0x87CEEB, near: 100, far: 700 };
let weatherBaseSky = 0x87CEEB;
let weatherOverlayEl = null;

// PEDIDO: pausar o clima/dirigível junto com o resto do jogo (pausa ou
// menu principal) — ver setWeatherPaused()/main.js. Enquanto pausado,
// updateWeather() nem sequer mexe nos timers locais, então tudo fica
// congelado exatamente onde estava (nada de "correr por baixo dos
// panos" enquanto o jogo tá parado). Em modo online o servidor continua
// rodando (é autoridade da sala, não do seu cliente sozinho) — pausar
// só congela a INTERPOLAÇÃO visual local, então ao despausar você
// simplesmente retoma no ponto em que o servidor já está.
let weatherPaused = false;

// ---- clima atmosférico (chuva / neblina / tempestade) — modo SOLO ----
// PEDIDO: ciclo fixo de 35s — contagem pro 1º evento, duração do clima
// ativo, e intervalo até o próximo eventos são todos os mesmos 35s.
// Aviso (8s) e transições de entrada/saída (8s) continuam como antes.
const ATMO_GAP = 35;            // idle -> aviso (== intervalo entre eventos)
const ATMO_WARNING_LEAD = 8;    // aviso -> entrando
const ATMO_TRANSITION_IN = 8;   // entrando -> ativo
const ATMO_ACTIVE = 35;         // duração do clima ativo
const ATMO_TRANSITION_OUT = 8;  // saindo -> idle

const atmo = { type: null, phase: 'idle', timer: 0, intensity: 0, lastType: null };

// ---- clima atmosférico — modo ONLINE (espelha o que o servidor manda) ----
// phaseStart é um timestamp local (performance.now()/1000); a partir
// dele + duration a gente calcula o progresso (t) da fase sem precisar
// que o servidor mande frame a frame.
const netAtmo = { type: null, phase: 'idle', phaseStart: 0, duration: 0 };

// ---- dirigível ----
// PEDIDO: 1º dirigível aparece 60s depois do início. Se for abatido, o
// próximo demora a METADE do tempo anterior (60 -> 30 -> 15 -> ...),
// com piso de 5s (só por segurança/performance, pra nunca virar spam
// instantâneo). Se ele escapar sem ser abatido, o intervalo volta ao
// padrão de 60s — só acelera quem realmente está abatendo o dirigível.
const BLIMP_BASE_GAP = 60;
const BLIMP_MIN_GAP_FLOOR = 5;
const BLIMP_WARNING_LEAD = 8;
const BLIMP_SPEED = 16;
const BLIMP_ALTITUDE_MIN = 65, BLIMP_ALTITUDE_MAX = 95;
const BLIMP_LENGTH = 42;
const BLIMP_SPAWN_RADIUS = 650;
const BLIMP_EXPLOSION_RADIUS = 55;
const BLIMP_EXPLOSION_DAMAGE = 90;
const BLIMP_HIT_NODES = 5;

const blimp = {
  phase: 'idle', timer: BLIMP_BASE_GAP, gap: BLIMP_BASE_GAP,
  group: null, nodes: [], shared: null,
  dir: new THREE.Vector3(), speed: 0, traveled: 0, totalDist: 0,
};

// ---- dirigível — modo ONLINE (espelha o servidor) ----
const netBlimp = { phase: 'idle', phaseStart: 0, duration: 0, spawn: null };

// ================================================================
//  RNG determinístico (só usado no modo SOLO — em modo online quem
//  decide o clima é sempre o servidor, não precisa de RNG combinado)
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
//  MÁQUINA DE ESTADOS — CLIMA ATMOSFÉRICO (MODO SOLO)
// ================================================================
// PEDIDO: evitar repetir o mesmo tipo de clima duas vezes seguidas por
// AZAR de sorteio consecutivo "travado" — mas se o mapa só tiver uma
// opção só, caímos de volta pra lista original (repetir é permitido e
// esperado — "pode ser que entre chuva, depois entre chuva de novo").
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
      atmo.timer = ATMO_ACTIVE;
      _wlog(atmo.type + ' ATIVO por ' + ATMO_ACTIVE + 's');
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
      _wlog(atmo.type + ' terminou. Próximo evento em ' + ATMO_GAP + 's.');
      atmo.type = null; atmo.phase = 'idle';
      atmo.timer = ATMO_GAP;
    }
  }

  if (atmo.phase === 'entrando' || atmo.phase === 'ativo' || atmo.phase === 'saindo') {
    if (rainPoints.visible) _updateRainParticles(dt);
    if (sandPoints.visible) _updateSandParticles(dt);
    if (fogPoints.visible) _updateFogParticles(dt);
  }
}

// ================================================================
//  MÁQUINA DE ESTADOS — CLIMA ATMOSFÉRICO (MODO ONLINE)
//  Aqui a gente NÃO decide fases — só espelha o que netAtmo recebeu do
//  servidor (via 'weather-phase') e interpola visualmente com base no
//  tempo decorrido desde a última fase recebida.
// ================================================================
function _updateAtmosphericOnline(dt, profile) {
  const options = profile.filter(k => k === 'chuva' || k === 'neblina' || k === 'tempestade');
  if (!options.length || !netAtmo.type || netAtmo.phase === 'idle') {
    if (atmo.phase !== 'idle') { atmo.phase = 'idle'; atmo.type = null; atmo.intensity = 0; _hideAllAtmoEffects(); }
    return;
  }

  atmo.type = netAtmo.type;
  atmo.phase = netAtmo.phase;

  const elapsed = Math.max(0, performance.now() / 1000 - netAtmo.phaseStart);
  const dur = netAtmo.duration > 0 ? netAtmo.duration : 0.0001;
  let t;
  if (netAtmo.phase === 'entrando') t = Math.min(1, elapsed / dur);
  else if (netAtmo.phase === 'ativo') t = 1;
  else if (netAtmo.phase === 'saindo') t = Math.max(0, 1 - elapsed / dur);
  else t = 0; // 'aviso' — ainda não deve aparecer nada visualmente

  atmo.intensity = t;
  if (t > 0) _applyAtmoIntensity(atmo.type, t);
  else _hideAllAtmoEffects();

  if (rainPoints.visible) _updateRainParticles(dt);
  if (sandPoints.visible) _updateSandParticles(dt);
  if (fogPoints.visible) _updateFogParticles(dt);
}

// ================================================================
//  DIRIGÍVEL — construção visual (compartilhada entre solo e online)
// ================================================================
// spawnData (opcional): { start:{x,y,z}, dir:{x,y,z}, speed, totalDist }
// Se não vier, gera localmente com weatherRng (modo SOLO). Se vier
// (modo ONLINE), usa exatamente o que o servidor mandou, pra todo
// mundo ver o dirigível no mesmo lugar.
function _spawnBlimp(spawnData) {
  let start, dir, speed, totalDist;
  if (spawnData) {
    start = new THREE.Vector3(spawnData.start.x, spawnData.start.y, spawnData.start.z);
    dir = new THREE.Vector3(spawnData.dir.x, spawnData.dir.y, spawnData.dir.z);
    speed = spawnData.speed || BLIMP_SPEED;
    totalDist = spawnData.totalDist;
  } else {
    const angle = weatherRng() * Math.PI * 2;
    start = new THREE.Vector3(
      Math.cos(angle) * BLIMP_SPAWN_RADIUS,
      BLIMP_ALTITUDE_MIN + weatherRng() * (BLIMP_ALTITUDE_MAX - BLIMP_ALTITUDE_MIN),
      Math.sin(angle) * BLIMP_SPAWN_RADIUS
    );
    const end = start.clone().multiplyScalar(-1);
    end.y = start.y;
    dir = end.clone().sub(start).normalize();
    speed = BLIMP_SPEED;
    totalDist = start.distanceTo(end);
  }

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
  blimp.speed = speed;
  blimp.traveled = 0;
  blimp.totalDist = totalDist;
  blimp.phase = 'voando';
}

// Some com a malha/colliders do dirigível (sem decidir nada sobre o
// PRÓXIMO ciclo — isso é responsabilidade de quem chama, ver
// _finishBlimpCycleSolo() e os handlers de socket mais abaixo).
function _despawnBlimpVisual() {
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
}

// ================================================================
//  DIRIGÍVEL — explosão (dano real, só quem acertou o tiro final)
// ================================================================
function _explodeBlimp() {
  if (!blimp.group) return;
  const pos = blimp.group.position.clone();
  createExplosion(pos, true, true, 0xffaa33, BLIMP_EXPLOSION_RADIUS * 1.4);
  // NOTA MULTIPLAYER: cada cliente só detecta localmente os acertos das
  // SUAS PRÓPRIAS armas (igual ao resto do jogo) — então só quem deu o
  // tiro final chega até aqui. resolveBombDamage já cuida de acertar
  // bots, jogadores remotos e você mesmo, e já avisa os outros clientes
  // da sala pra verem a explosão (via 'hit'/'bomb-exploded').
  if (typeof resolveBombDamage === 'function') {
    resolveBombDamage(pos, false, BLIMP_EXPLOSION_DAMAGE, BLIMP_EXPLOSION_RADIUS, 'blimp');
  }
  if (typeof cameraShake === 'function') cameraShake(1.4, 0.9);
  if (typeof playSound === 'function') playSound('explosion');
  voiceAnnounce('Dirigível abatido!', false);
  showTemporaryMessage('💥 Dirigível abatido!', 3500);

  _despawnBlimpVisual();

  if (weatherOnline) {
    // Quem entrega o tiro final avisa o servidor — ele decide o próximo
    // ciclo (metade do tempo) e replica a explosão pro resto da sala.
    if (typeof onlineState !== 'undefined' && onlineState.socket) {
      onlineState.socket.emit('blimp-killed', { position: { x: pos.x, y: pos.y, z: pos.z } });
    }
    blimp.phase = 'idle';
  } else {
    _finishBlimpCycleSolo(true);
  }
}

// Explosão "ecoada" — outro jogador da sala abateu o dirigível. Só
// mostra o efeito visual (o dano de área já foi resolvido uma única
// vez, no cliente de quem realmente acertou o tiro).
function _explodeBlimpRemote(position) {
  const pos = position ? new THREE.Vector3(position.x, position.y, position.z)
    : (blimp.group ? blimp.group.position.clone() : null);
  if (pos) createExplosion(pos, true, true, 0xffaa33, BLIMP_EXPLOSION_RADIUS * 1.4);
  if (typeof cameraShake === 'function') cameraShake(0.6, 0.5);
  if (typeof playSound === 'function') playSound('explosion');
  voiceAnnounce('Dirigível abatido!', true);
  showTemporaryMessage('💥 Dirigível abatido!', 3500);
  _despawnBlimpVisual();
  blimp.phase = 'idle';
}

// ================================================================
//  DIRIGÍVEL — máquina de estados (MODO SOLO)
// ================================================================
function _finishBlimpCycleSolo(wasKilled) {
  blimp.gap = wasKilled ? Math.max(BLIMP_MIN_GAP_FLOOR, blimp.gap / 2) : BLIMP_BASE_GAP;
  blimp.phase = 'idle';
  blimp.timer = blimp.gap;
  _wlog('dirigível: próximo em ' + blimp.gap.toFixed(1) + 's' + (wasKilled ? ' (abatido — metade do tempo)' : ' (escapou — volta ao padrão)'));
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
    if (blimp.timer <= 0) {
      _spawnBlimp();
      voiceAnnounce('Dirigível avistado! Atire nele: a explosão dá dano em todos por perto!', false);
      showTemporaryMessage('🛩️ Dirigível sobrevoando o mapa — atirar nele causa dano em área!', 4000);
      _wlog('dirigível: voando');
    }
    return;
  }
  if (blimp.phase === 'voando') {
    if (!blimp.group) { _finishBlimpCycleSolo(false); return; }
    blimp.nodes.forEach(n => n.posHolder.copy(blimp.group.position).addScaledVector(blimp.dir, n.localOffset));
    if (!blimp.shared.alive) { _explodeBlimp(); return; }
    blimp.group.position.addScaledVector(blimp.dir, blimp.speed * dt);
    blimp.traveled += blimp.speed * dt;
    blimp.group.rotation.z = Math.sin(performance.now() * 0.0004) * 0.02;
    if (blimp.traveled >= blimp.totalDist + 40) {
      _despawnBlimpVisual();
      _finishBlimpCycleSolo(false);
    }
  }
}

// ================================================================
//  DIRIGÍVEL — movimento (MODO ONLINE)
//  As FASES (idle/aviso/voando) chegam via socket (ver
//  _bindWeatherSocketEvents). Aqui só aplicamos o movimento frame a
//  frame (mesma física de sempre) e detectamos localmente se FOMOS NÓS
//  quem acabou de abater o dirigível.
// ================================================================
function _updateBlimpOnline(dt) {
  if (netBlimp.phase !== 'voando' || !blimp.group) return;
  blimp.nodes.forEach(n => n.posHolder.copy(blimp.group.position).addScaledVector(blimp.dir, n.localOffset));
  if (blimp.shared && !blimp.shared.alive) { _explodeBlimp(); return; }
  blimp.group.position.addScaledVector(blimp.dir, blimp.speed * dt);
  blimp.group.rotation.z = Math.sin(performance.now() * 0.0004) * 0.02;
}

// ================================================================
//  SOCKET — eventos do servidor (só em modo ONLINE)
// ================================================================
function _bindWeatherSocketEvents(socket) {
  if (!socket || socket.__weatherBound) return;
  socket.__weatherBound = true;

  socket.on('weather-phase', (d) => {
    netAtmo.type = d.type || null;
    netAtmo.phase = d.phase;
    netAtmo.duration = d.duration || 0;
    netAtmo.phaseStart = performance.now() / 1000;
    if (d.phase === 'aviso' && d.type) _announceAtmoIncoming(d.type);
    if (d.phase === 'saindo' && d.type) _announceAtmoClearing(d.type);
    _wlog('[servidor] clima: ' + d.phase + (d.type ? ' (' + d.type + ')' : '') + ' por ~' + (d.duration || 0).toFixed(0) + 's');
  });

  socket.on('blimp-phase', (d) => {
    netBlimp.phase = d.phase;
    netBlimp.duration = d.duration || 0;
    netBlimp.phaseStart = performance.now() / 1000;
    if (d.phase === 'aviso') {
      voiceAnnounce('Dirigível se aproximando.', false);
      showTemporaryMessage('📡 Dirigível se aproximando! Atire nele: a explosão causa dano em área.', 3500);
    } else if (d.phase === 'voando' && d.spawn) {
      netBlimp.spawn = d.spawn;
      _spawnBlimp(d.spawn);
      voiceAnnounce('Dirigível avistado! Atire nele: a explosão dá dano em todos por perto!', false);
      showTemporaryMessage('🛩️ Dirigível sobrevoando o mapa — atirar nele causa dano em área!', 4000);
    } else if (d.phase === 'idle') {
      if (blimp.group) _despawnBlimpVisual();
      blimp.phase = 'idle';
    }
    _wlog('[servidor] dirigível: ' + d.phase);
  });

  socket.on('blimp-exploded', (d) => { _explodeBlimpRemote(d && d.position); });
}

// ================================================================
//  ENTRADA TARDIA (SALA LIVRE / RECONEXÃO) — o servidor manda o estado
//  atual completo (weatherSnapshot) junto do 'match-loading'/
//  'free-room-enter'; usamos isso pra já nascer sincronizado, em vez
//  de esperar o próximo evento (senão quem entra numa Sala Livre já
//  chovendo só veria a chuva minutos depois, no próximo ciclo).
// ================================================================
function applyWeatherSnapshot(snap) {
  if (!snap || !weatherOnline) return;
  const now = performance.now() / 1000;

  if (snap.atmo) {
    netAtmo.type = snap.atmo.type || null;
    netAtmo.phase = snap.atmo.phase || 'idle';
    netAtmo.duration = snap.atmo.duration || 0;
    const elapsedAlready = Math.max(0, (snap.atmo.duration || 0) - (snap.atmo.timer || 0));
    netAtmo.phaseStart = now - elapsedAlready;
  }

  if (snap.blimp) {
    netBlimp.phase = snap.blimp.phase || 'idle';
    netBlimp.duration = snap.blimp.duration || 0;
    const elapsedAlready = Math.max(0, (snap.blimp.duration || 0) - (snap.blimp.timer || 0));
    netBlimp.phaseStart = now - elapsedAlready;
    if (snap.blimp.phase === 'voando' && snap.blimp.spawn) {
      netBlimp.spawn = snap.blimp.spawn;
      _spawnBlimp(snap.blimp.spawn);
      // já estava voando há um tempo — avança a posição pro ponto certo
      blimp.group.position.addScaledVector(blimp.dir, blimp.speed * elapsedAlready);
    }
  }
  _wlog('estado de clima recebido do servidor (entrada tardia).');
}
window.applyWeatherSnapshot = applyWeatherSnapshot;

// ================================================================
//  RADAR — exposto pra radar.js poder mostrar o dirigível como contato
//  (ver collectRadarContacts() em radar.js).
// ================================================================
function getBlimpRadarContact() {
  if (!blimp.group || blimp.phase !== 'voando') return null;
  return { position: blimp.group.position };
}
window.getBlimpRadarContact = getBlimpRadarContact;

// ================================================================
//  API PÚBLICA — chamada por environment.js (resetWeather) e
//  main.js (updateWeather a cada frame)
// ================================================================
// DEBUG: liga logs de fase no console (fica fácil ver o clima "andando"
// mesmo antes do primeiro evento aparecer na tela). Pra desligar, rode
// no console: window.__weatherDebug = false
window.__weatherDebug = true;
function _wlog(...args) { if (window.__weatherDebug) console.log('[CLIMA]', ...args); }

function _isOnlineRoom() {
  return typeof onlineState !== 'undefined' && !!onlineState.socket && !!onlineState.roomId;
}

function resetWeather(mode) {
  weatherMapMode = mode;
  weatherPaused = false;
  if (scene.fog) weatherBaseFog = { color: scene.fog.color.getHex(), near: scene.fog.near, far: scene.fog.far };
  if (scene.background && scene.background.isColor) weatherBaseSky = scene.background.getHex();

  _hideAllAtmoEffects();
  _despawnBlimpVisual();

  weatherOnline = _isOnlineRoom();

  atmo.type = null; atmo.phase = 'idle'; atmo.intensity = 0; atmo.lastType = null;
  blimp.phase = 'idle';

  if (weatherOnline) {
    // O SERVIDOR é quem manda em tudo daqui pra frente — o estado local
    // só existe pra INTERPOLAR visualmente o que ele mandar. Se o
    // jogador está entrando no meio de uma partida/Sala Livre já em
    // andamento, applyWeatherSnapshot() (chamado por multiplayer.js)
    // corrige o estado inicial logo em seguida.
    netAtmo.type = null; netAtmo.phase = 'idle'; netAtmo.duration = 0; netAtmo.phaseStart = 0;
    netBlimp.phase = 'idle'; netBlimp.duration = 0; netBlimp.phaseStart = 0; netBlimp.spawn = null;
    _bindWeatherSocketEvents(onlineState.socket);
    _wlog('resetWeather(' + mode + ') — modo ONLINE: clima e dirigível controlados pelo servidor.');
  } else {
    weatherRng = _mulberry32(_hashString('solo:' + Math.floor(Math.random() * 1e9)));
    atmo.timer = ATMO_GAP;
    blimp.gap = BLIMP_BASE_GAP;
    blimp.timer = BLIMP_BASE_GAP;
    _wlog('resetWeather(' + mode + ') — modo SOLO: 1º clima em ' + ATMO_GAP + 's, dirigível em ' + BLIMP_BASE_GAP + 's.');
  }
}

// DEBUG: força um evento de clima na hora, sem esperar o timer, pra
// testar rápido pelo console do navegador (F12). Só funciona em modo
// SOLO — em sala multiplayer quem manda é o servidor.
function forceWeather(type) {
  if (weatherOnline) {
    console.warn('[CLIMA] em sala multiplayer o clima é controlado pelo servidor — forceWeather não tem efeito aqui.');
    return;
  }
  if (type === 'dirigivel') {
    _despawnBlimpVisual();
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

// PEDIDO: pausar o jogo (ou voltar pro menu) tem que congelar a
// interpolação visual local. Em modo online o relógio do servidor
// continua rodando (é autoridade da sala, não do seu cliente sozinho);
// ao despausar, a gente só retoma exibindo o que ele já mandou.
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
  if (blimp.group || blimp.phase !== 'idle') { _despawnBlimpVisual(); blimp.phase = 'idle'; }
  if (typeof stopVoiceAnnouncer === 'function') stopVoiceAnnouncer();
  _wlog('clima/dirigível totalmente parados (voltou pro menu).');
}
window.haltWeatherForMenu = haltWeatherForMenu;

let _weatherHeartbeat = 0;
function updateWeather(dt) {
  if (!weatherMapMode || weatherPaused) return;
  const profile = (typeof MAP_WEATHER_PROFILES !== 'undefined' && MAP_WEATHER_PROFILES[weatherMapMode]) || [];

  if (weatherOnline) {
    _updateAtmosphericOnline(dt, profile);
    if (profile.includes('dirigivel')) {
      _updateBlimpOnline(dt);
    } else if (blimp.group) {
      _despawnBlimpVisual();
      blimp.phase = 'idle';
    }
  } else {
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
      _despawnBlimpVisual();
      blimp.phase = 'idle';
      blimp.timer = blimp.gap;
    }
  }

  _updateDigitalRain(dt);
}