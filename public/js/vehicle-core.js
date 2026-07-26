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
  if (style === 'realista' && typeof createRealisticPlaneInstance === 'function') {
    return createRealisticPlaneInstance(type, colorHex);
  }
  const builder = PLANE_BUILDERS[type] || PLANE_BUILDERS.cessna;
  return builder(colorHex);
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