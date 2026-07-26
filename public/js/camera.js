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

function updateCamera(dt) {
  let yawInput = 0, pitchInput = 0;
  if (isAction('camLeft')) yawInput += 1;
  if (isAction('camRight')) yawInput -= 1;
  if (isAction('camUp')) pitchInput -= 1;
  if (isAction('camDown')) pitchInput += 1;

  cam.radius += (cam.targetRadius - cam.radius) * Math.min(1, 5 * dt);
  const vehicleQuat = getVehicleQuaternion();

  if (state.isSpectator) return;

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