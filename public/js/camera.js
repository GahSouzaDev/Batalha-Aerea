// ================================================================
//  CÂMERA – SEM DECAIMENTO AUTOMÁTICO
//  (mouse e setas controlam, só reseta no botão direito)
// ================================================================
const cam = {
  yaw: 0, pitch: 0, radius: 9, targetRadius: 9,
  yawSpeed: 1.6, pitchSpeed: 0.9,
  pitchMin: -1.3, pitchMax: 1.3,
};
const FIXED_YAW_LIMIT = 0.55;
const FIXED_PITCH_LIMIT = 0.4;
const CAM_HEIGHT_OFFSET = 2.6;

renderer.domElement.addEventListener('wheel', (e) => {
  cam.targetRadius += e.deltaY * 0.012;
  cam.targetRadius = THREE.MathUtils.clamp(cam.targetRadius, 4, 26);
}, { passive: true });

function getVehicleQuaternion() {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(state.pitch, state.yaw, state.roll, 'YXZ'));
}

let cameraShakeIntensity = 0, cameraShakeDuration = 0;
function cameraShake(intensity, duration) {
  cameraShakeIntensity = Math.max(cameraShakeIntensity, intensity);
  cameraShakeDuration = Math.max(cameraShakeDuration, duration);
}
function updateCameraShake(dt) {
  if (cameraShakeDuration > 0) {
    cameraShakeDuration -= dt;
    const shake = cameraShakeIntensity * Math.min(1, cameraShakeDuration / 0.3);
    camera.position.x += (Math.random() - 0.5) * shake * 0.5;
    camera.position.y += (Math.random() - 0.5) * shake * 0.5;
    if (cameraShakeDuration <= 0) cameraShakeIntensity = 0;
  }
}

// ================================================================
//  CÂMERA LIVRE DE ESPECTADOR
//  PEDIDO: enquanto morto/no modo espectador, poder voar a câmera
//  livremente por qualquer direção (WASD + Espaço/Ctrl pra
//  subir/descer, mouse pra olhar em qualquer ângulo) pra ver toda a
//  cena, em vez de ficar travada olhando pro mesmo lugar de sempre.
// ================================================================
const spectatorCam = {
  pos: new THREE.Vector3(),
  yaw: 0, pitch: 0,
  active: false,
  speed: 34,
};

// Chamado uma vez ao entrar no modo espectador — nasce exatamente de
// onde a câmera de voo estava, pra não dar nenhum salto brusco.
function initSpectatorFreeCam() {
  spectatorCam.pos.copy(camera.position);
  const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  spectatorCam.yaw = e.y;
  spectatorCam.pitch = e.x;
  spectatorCam.active = true;
}
function endSpectatorFreeCam() {
  spectatorCam.active = false;
  if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
}

// Clicar na tela durante o espectador trava o cursor (pointer lock) pra
// olhar em qualquer direção sem esbarrar na borda da tela — só funciona
// com um clique de verdade (exigência do navegador), por isso não é
// chamado automaticamente ao morrer.
renderer.domElement.addEventListener('click', () => {
  if (state.isSpectator && document.pointerLockElement !== renderer.domElement) {
    renderer.domElement.requestPointerLock().catch(() => {});
  }
});

// Deltas de mouse acumulados especificamente pro modo espectador (ver
// listener de 'mousemove' em input.js — lá o mouse normal de voo fica
// desligado durante o espectador e passa a alimentar estes deltas).
let spectatorMouseDX = 0, spectatorMouseDY = 0;
function addSpectatorMouseDelta(dx, dy) { spectatorMouseDX += dx; spectatorMouseDY += dy; }

function updateSpectatorFreeCam(dt) {
  if (!spectatorCam.active) initSpectatorFreeCam();

  spectatorCam.yaw -= spectatorMouseDX * 0.0032;
  spectatorCam.pitch -= spectatorMouseDY * 0.0032;
  spectatorCam.pitch = THREE.MathUtils.clamp(spectatorCam.pitch, -1.5, 1.5);
  spectatorMouseDX = 0; spectatorMouseDY = 0;

  const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(spectatorCam.pitch, spectatorCam.yaw, 0, 'YXZ'));

  // Movimento livre: W/S anda pra frente/trás, A/D anda de lado,
  // Espaço sobe, Ctrl/Shift desce — tudo relativo pra onde a câmera
  // está olhando (voo livre tipo "modo câmera" de jogos de espectador).
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
  const up = new THREE.Vector3(0, 1, 0);
  const move = new THREE.Vector3();
  if (keys['KeyW']) move.add(forward);
  if (keys['KeyS']) move.sub(forward);
  if (keys['KeyD']) move.add(right);
  if (keys['KeyA']) move.sub(right);
  if (keys['Space']) move.add(up);
  if (keys['ControlLeft'] || keys['ShiftLeft']) move.sub(up);

  const boost = (keys['ShiftRight'] || keys['ShiftLeft']) ? 2.4 : 1;
  if (move.lengthSq() > 0) {
    move.normalize().multiplyScalar(spectatorCam.speed * boost * dt);
    spectatorCam.pos.add(move);
  }

  camera.position.copy(spectatorCam.pos);
  camera.quaternion.copy(quat);
  camera.fov += (58 - camera.fov) * Math.min(1, 3 * dt);
  camera.updateProjectionMatrix();
}

function updateCamera(dt) {
  let yawInput = 0, pitchInput = 0;
  if (isAction('camLeft')) yawInput += 1;
  if (isAction('camRight')) yawInput -= 1;
  if (isAction('camUp')) pitchInput -= 1;
  if (isAction('camDown')) pitchInput += 1;

  cam.radius += (cam.targetRadius - cam.radius) * Math.min(1, 5 * dt);
  const vehicleQuat = getVehicleQuaternion();

  if (state.isSpectator) { updateSpectatorFreeCam(dt); return; }
  endSpectatorFreeCam();

  // Entrada do teclado (setas) – soma ao mouse
  cam.yaw += yawInput * cam.yawSpeed * dt;
  cam.pitch += pitchInput * cam.pitchSpeed * dt;

  // Limites
  cam.yaw = THREE.MathUtils.clamp(cam.yaw, -FIXED_YAW_LIMIT, FIXED_YAW_LIMIT);
  cam.pitch = THREE.MathUtils.clamp(cam.pitch, -FIXED_PITCH_LIMIT, FIXED_PITCH_LIMIT);

  // NENHUM DECAIMENTO – a câmera fica exatamente onde o mouse/teclas colocarem
  // O reset só acontece no botão direito (feito no input.js)

  const lookQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(cam.pitch, cam.yaw, 0, 'YXZ'));
  const combined = vehicleQuat.clone().multiply(lookQuat);
  const offset = new THREE.Vector3(0, CAM_HEIGHT_OFFSET, cam.radius).applyQuaternion(combined);
  const desired = state.position.clone().add(offset);
  camera.position.lerp(desired, Math.min(1, 9 * dt));

  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(combined);
  const lookTarget = camera.position.clone().addScaledVector(forward, 50);
  camera.lookAt(lookTarget);

  const speedRatio = state.velocity / currentPlaneSpec.maxSpeed;
  const targetFov = 58 + Math.min(14, speedRatio * 14);
  camera.fov += (targetFov - camera.fov) * Math.min(1, 3 * dt);
  camera.updateProjectionMatrix();

  updateCameraShake(dt);
}