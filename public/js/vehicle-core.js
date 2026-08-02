// vehicle-core.js
const vehicle = new THREE.Group();
vehicle.rotation.order = 'YXZ';
scene.add(vehicle);

let localParts = null;
let selectedPlaneType = 'cessna';
let currentPlaneSpec = PLANE_SPECS.cessna;
// PEDIDO: escolher entre avião "poligonal" (geometria simples, o padrão
// de sempre) ou "realista" (modelo 3D .glb, ver plane-model-realistic.js).
let planeModelStyle = 'poligonal';

const GROUND_LEVEL = 0.1;
const MAX_HEALTH = 100;
const START_POS = new THREE.Vector3(0, GROUND_LEVEL, 2);

const state = {
  position: START_POS.clone(),
  velocity: 0,
  pitch: 0,
  pitchAngle: 0,
  yaw: 0,
  roll: 0,
  isAccelerating: false,
  isCrashed: false,
  crashTimer: 0,
  isPaused: false,
  isDead: false,
  isSpectator: false,
  health: MAX_HEALTH,
  maxHealth: MAX_HEALTH,
  shield: 0,
  kills: 0,
  deaths: 0,
  specialActive: false,
  specialTimer: 0,
  specialCooldown: 0,
  invisible: false,
  invulnerable: false,
  freeCam: false,
};

function currentVehicleColor() {
  return document.getElementById('menu-color-custom').value || '#00e5ff';
}

function createPlaneInstance(type, colorHex, modelStyle) {
  const style = modelStyle || planeModelStyle;
  const planeOptions = { scene: scene, listener: (typeof audioListener !== 'undefined' ? audioListener : undefined) };
  if (style === 'realista' && typeof createRealisticPlaneInstance === 'function') {
    // CORREÇÃO: o modelo realista (plane-model-realistic.js) tem seu
    // PRÓPRIO `createRealisticPlaneInstance(type, colorHex, options={})`,
    // com o MESMO bug de sombra dos construtores poligonais (só cria a
    // sombra se receber `scene` em options) — e essa chamada também não
    // passava nada. Se o jogador está usando o modelo realista (checkbox
    // "usar modelo realista" no menu), a correção anterior (feita só na
    // chamada dos construtores poligonais) não valia pra ele.
    return createRealisticPlaneInstance(type, colorHex, planeOptions);
  }
  const builder = PLANE_BUILDERS[type] || PLANE_BUILDERS.cessna;
  // CORREÇÃO CRÍTICA (achada só agora, depois de 4 mensagens sem sombra
  // nenhuma aparecer): TODOS os arquivos plane-*.js só criam a sombra (e
  // o áudio próprio deles) SE receberem `scene`/`listener` em `options`
  // — e essa chamada nunca passava `options` nenhum, então cada
  // construtor caía no fallback `window.scene`. Só que `scene-setup.js`
  // declara `const scene = new THREE.Scene()` — um `const` de topo de
  // arquivo NUNCA vira propriedade de `window` (isso só acontece com
  // `var` ou atribuição direta tipo `window.x = ...`). Ou seja,
  // `window.scene` sempre foi `undefined`, `scene` dentro de CADA
  // construtor de avião sempre foi `undefined`, e por isso o bloco `if
  // (scene) { ...cria a sombra... }` nunca rodava — pra NENHUM avião,
  // nunca, em nenhuma partida. Não era um bug de posição/visibilidade
  // (o que eu vinha mexendo); a sombra literalmente nunca existia. Agora
  // passamos a cena e o listener de áudio de verdade.
  return builder(colorHex, planeOptions);
}

function rebuildVehicle() {
  // Garante que o avião volte a aparecer depois de ter "sumido" numa
  // colisão fatal (ver triggerExplosiveCrash em physics.js).
  vehicle.visible = true;
  // CORREÇÃO: trocar de avião com uma habilidade antiga ainda ativa (laser,
  // mísseis em sequência, bombardeio) deixava esse timer rodando escondido
  // por baixo do avião novo — daí a mistura de habilidades.
  if (typeof stopAllSpecialTimers === 'function') stopAllSpecialTimers();
  detachEngineSound(localParts);
  // CORREÇÃO: liberar recursos do avião anterior (disco de sombra na scene,
  // luzes de fogo, partículas). Sem isso, cada troca de avião no menu
  // deixava um disco de sombra "fantasma" pra sempre na scene.
  if (localParts && typeof localParts.dispose === 'function') localParts.dispose();
  // CORREÇÃO ADICIONAL: só 2 dos 15 arquivos de avião (plane-*.js)
  // implementam dispose() de verdade — os outros 13 nunca removiam o
  // próprio disco de sombra da cena ao trocar de avião (o `dispose`
  // acima simplesmente não existia pra eles, então o `if` acima nem
  // rodava). Isso empilhava um disco de sombra "fantasma" a cada troca
  // de avião (menu, pausa, respawn) — com o tempo, dezenas deles
  // acumulados. Esta linha remove o disco antigo da cena INDEPENDENTE
  // do avião implementar dispose() ou não, cobrindo os 13 que faltavam.
  if (localParts && localParts.shadow && localParts.shadow.parent) {
    localParts.shadow.parent.remove(localParts.shadow);
  }
  const children = [...vehicle.children];
  children.forEach(c => vehicle.remove(c));
  const useOrigTexture = document.getElementById('use-original-texture')?.checked !== false;
  const color = useOrigTexture ? null : currentVehicleColor();
  const realisticEl = document.getElementById('use-realistic-model');
  planeModelStyle = (realisticEl && realisticEl.checked) ? 'realista' : 'poligonal';
  localParts = createPlaneInstance(selectedPlaneType, color, planeModelStyle);
  vehicle.add(localParts.group);
  applyPlaneProfile(selectedPlaneType);
  attachEngineSound(localParts, currentPlaneSpec.sound, true);
}

// ================================================================
//  SOMBRA DE CADA AVIÃO ACOMPANHANDO A POSIÇÃO DE VERDADE
// ================================================================
// PEDIDO/BUG: cada construtor de avião (plane-*.js) já cria seu próprio
// disco de sombra (`shadow`) — mas todos fazem `scene.add(shadow)`
// direto na CENA, e nenhum lugar do jogo nunca atualizava a posição
// dela depois. Resultado: a sombra nascia certinha embaixo do avião na
// pista, mas ficava PARADA ali pra sempre assim que o avião decolava/se
// afastava — dava a impressão de "sombra sumindo" (na real, ela nunca
// te acompanhou).
//
// Solução: 1 função central que, a cada frame, copia a posição mundial
// (x/z) de cada avião — o seu, os bots e os remotos — pro disco de
// sombra correspondente (a altura Y da sombra já vem certa de cada
// arquivo de avião, só ajustamos x/z). É praticamente de graça em
// performance: não é sombra de verdade (shadow map/raycasting), é só
// copiar 2 números por avião por frame — nem chega perto de pesar.
const _shadowWorldPos = new THREE.Vector3();
function _syncPlaneShadowXZ(planeObject, shadowMesh) {
  if (!planeObject || !shadowMesh) return;
  planeObject.getWorldPosition(_shadowWorldPos);
  shadowMesh.position.x = _shadowWorldPos.x;
  shadowMesh.position.z = _shadowWorldPos.z;
}

function updatePlaneShadows() {
  // Seu avião
  // CORREÇÃO: a primeira versão usava `vehicle.visible` pra decidir se
  // mostra a sombra — mas `vehicle.visible` vira `false` sozinho em toda
  // colisão violenta (ver triggerExplosiveCrash em physics.js) e só volta
  // a `true` no respawn. Isso apagava a sombra bem antes do jogador
  // realmente morrer. Agora a sombra só depende do próprio estado de
  // vida/espectador, igual à fumaça de dano (smoke-trail.js).
  if (typeof vehicle !== 'undefined' && localParts && localParts.shadow) {
    localParts.shadow.visible = !state.isDead && !state.isSpectator;
    _syncPlaneShadowXZ(vehicle, localParts.shadow);
  }
  // Bots (treino solo/offline)
  if (typeof enemyBots !== 'undefined') {
    enemyBots.forEach(bot => {
      if (!bot.parts || !bot.parts.shadow) return;
      bot.parts.shadow.visible = !!bot.alive;
      if (bot.alive) _syncPlaneShadowXZ(bot.mesh, bot.parts.shadow);
    });
  }
  // Jogadores remotos (online)
  if (typeof remotePlayers !== 'undefined') {
    remotePlayers.forEach(rp => {
      if (!rp.parts || !rp.parts.shadow) return;
      rp.parts.shadow.visible = !!rp.alive;
      if (rp.alive) _syncPlaneShadowXZ(rp.mesh, rp.parts.shadow);
    });
  }
}
window.updatePlaneShadows = updatePlaneShadows;

function applyPlaneColor(hex) {
  const useOrigTexture = document.getElementById('use-original-texture')?.checked !== false;
  if (useOrigTexture) return;
  if (localParts && localParts.idLight) localParts.idLight.color.set(hex);
}

let flashTimeout = null;
function flashVehicle(duration = 0.4) {
  if (!localParts) return;
  const mats = [];
  localParts.group.traverse(o => { if (o.isMesh && o.material && o.material.color) mats.push(o.material); });
  const originalColors = mats.map(m => m.color.clone());
  const originalEmissive = mats.map(m => m.emissive ? m.emissive.clone() : null);
  mats.forEach(m => { m.color.setHex(0xff0000); if (m.emissive) m.emissive.setHex(0xff0000); });
  if (flashTimeout) clearTimeout(flashTimeout);
  flashTimeout = setTimeout(() => {
    mats.forEach((m, i) => { m.color.copy(originalColors[i]); if (m.emissive && originalEmissive[i]) m.emissive.copy(originalEmissive[i]); });
    flashTimeout = null;
  }, duration * 1000);
}

function applyPlaneProfile(key) {
  currentPlaneSpec = PLANE_SPECS[key] || PLANE_SPECS.cessna;
  const el = document.getElementById('val-model');
  if (el) el.textContent = currentPlaneSpec.label;
  const spEl = document.getElementById('special-name');
  if (spEl) spEl.textContent = currentPlaneSpec.specialLabel;
}