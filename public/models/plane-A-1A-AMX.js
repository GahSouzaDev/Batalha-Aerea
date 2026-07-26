// models/plane-amx.js
// ================================================================
// A-1A AMX (FAB) — chave interna "amx"
// Baseado na imagem de referência com fuselagem robusta, asas retas,
// cauda vertical única, intakes laterais e armamento sob as asas.
// Utiliza a textura bandeira.png conforme solicitado.
// ================================================================
PLANE_BUILDERS.amx = function (colorHex, options = {}) {
  const scene = options.scene || (typeof window !== 'undefined' && window.scene);
  const listener = options.listener || (typeof window !== 'undefined' && window.listener);

  const group = new THREE.Group();

  const useTexture = !colorHex || colorHex === 0xffffff;
  const baseColor = colorHex || 0xffffff;

  let planeMaterial, planeTailMaterial;
  if (useTexture) {
    // ===== TEXTURA SOLICITADA =====
    const planeTexture = new THREE.TextureLoader().load('img/bandeira.png');
    planeMaterial = new THREE.MeshStandardMaterial({ map: planeTexture });
    planeTailMaterial = new THREE.MeshStandardMaterial({ map: planeTexture });
  } else {
    planeMaterial = new THREE.MeshStandardMaterial({ color: baseColor });
    planeTailMaterial = new THREE.MeshStandardMaterial({ color: baseColor });
  }

  const gearMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
  const cabinMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const intakeMaterial = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
  const missileMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
  const nozzleMaterial = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8 });

  // ============================================================
  // FUSELAGEM — Corpo cilíndrico robusto, típico do AMX
  // ============================================================
  const bodyGeometry = new THREE.CylinderGeometry(0.22, 0.18, 4.0, 12);
  const body = new THREE.Mesh(bodyGeometry, planeMaterial);
  body.rotation.x = Math.PI / 2;
  body.position.y = 0.5;
  body.position.z = -0.2;
  group.add(body);

  // Nariz cônico (um pouco mais alongado)
  const noseGeometry = new THREE.ConeGeometry(0.2, 0.7, 12);
  const nose = new THREE.Mesh(noseGeometry, planeMaterial);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 0.5, -2.2);
  group.add(nose);

  // Entradas de ar laterais (Intakes — detalhe icônico do AMX)
  const intakeGeo = new THREE.BoxGeometry(0.3, 0.18, 0.6);
  const intakeLeft = new THREE.Mesh(intakeGeo, intakeMaterial);
  intakeLeft.position.set(-0.22, 0.5, -0.4);
  group.add(intakeLeft);
  
  const intakeRight = new THREE.Mesh(intakeGeo, intakeMaterial);
  intakeRight.position.set(0.22, 0.5, -0.4);
  group.add(intakeRight);

  // ============================================================
  // ASAS — retas, um pouco enflechadas, usando BoxGeometry
  // ============================================================
  const wingGeometry = new THREE.BoxGeometry(3.1, 0.04, 0.8);
  const wing = new THREE.Mesh(wingGeometry, planeMaterial);
  wing.position.set(0, 0.52, 0.3);
  group.add(wing);

  // Mísseis/Armas sob as asas
  const missileGeo = new THREE.CylinderGeometry(0.05, 0.09, 0.7, 6);
  const missile1 = new THREE.Mesh(missileGeo, missileMaterial);
  missile1.rotation.x = Math.PI / 2;
  missile1.position.set(-1.0, 0.42, 0.4);
  group.add(missile1);

  const missile2 = new THREE.Mesh(missileGeo, missileMaterial);
  missile2.rotation.x = Math.PI / 2;
  missile2.position.set(1.0, 0.42, 0.4);
  group.add(missile2);

  // ============================================================
  // CAUDA — uma única deriva vertical + dois estabilizadores horizontais
  // ============================================================
  // Cauda vertical
  const tailVerticalGeometry = new THREE.BoxGeometry(0.06, 0.7, 0.5);
  const tailVertical = new THREE.Mesh(tailVerticalGeometry, planeTailMaterial);
  tailVertical.position.set(0, 1, 1.8);
  group.add(tailVertical);

  // Estabilizadores horizontais
  const tailHorizGeo = new THREE.BoxGeometry(1, 0.04, 0.3);
  const stabLeft = new THREE.Mesh(tailHorizGeo, planeTailMaterial);
  stabLeft.position.set(-0.6, 0.5, 1.9);
  group.add(stabLeft);

  const stabRight = new THREE.Mesh(tailHorizGeo, planeTailMaterial);
  stabRight.position.set(0.6, 0.5, 1.9);
  group.add(stabRight);

  // ============================================================
  // MOTOR E EXAUSTÃO (único, pois é mono-motor)
  // ============================================================
  const nozzleGeometry = new THREE.CylinderGeometry(0.12, 0.16, 0.4, 12);
  const nozzle = new THREE.Mesh(nozzleGeometry, nozzleMaterial);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.set(0, 0.5, 2);
  group.add(nozzle);

  // Efeito de fogo (partículas) — única saída
  const fireMaterial = new THREE.PointsMaterial({
    color: 0xffd700,
    size: 0.08,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
  });

  function buildFireGeometry() {
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array(80 * 3);
    for (let i = 0; i < 80; i++) {
      verts[i * 3] = (Math.random() - 0.5) * 0.25;
      verts[i * 3 + 1] = (Math.random() - 0.5) * 0.25;
      verts[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    return geo;
  }

  const propeller = new THREE.Points(buildFireGeometry(), fireMaterial);
  propeller.position.set(0, 0.5, 2.3);
  propeller.rotation.x = Math.PI;
  group.add(propeller);

  const fireLight = new THREE.PointLight(0xff5500, 1.5, 4);
  fireLight.position.copy(propeller.position);
  group.add(fireLight);

  // Hélices invisíveis (mantidas por compatibilidade com o sistema do jogo)
  const propellerGeometry = new THREE.ConeGeometry(1.4, 5.5, 12);
  const propellerMaterialInvisible = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0 });
  const propeller1 = new THREE.Mesh(propellerGeometry, propellerMaterialInvisible);
  propeller1.visible = false;
  group.add(propeller1);
  const propeller2 = new THREE.Mesh(propellerGeometry, propellerMaterialInvisible);
  propeller2.visible = false;
  group.add(propeller2);
  const propeller3 = new THREE.Mesh(propellerGeometry, propellerMaterialInvisible);
  propeller3.visible = false;
  group.add(propeller3);

  // ============================================================
  // TREM DE POUSO
  // ============================================================
  const frontGearSupport = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.05), cabinMaterial);
  frontGearSupport.position.set(0, 0.2, -1.5);
  group.add(frontGearSupport);

  const frontWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 16), gearMaterial);
  frontWheel.rotation.x = Math.PI / 2;
  frontWheel.rotation.z = Math.PI / 2;
  frontWheel.position.set(0, -0.1, -1.5);
  group.add(frontWheel);

  const mainGearSupportGeo = new THREE.BoxGeometry(0.05, 0.6, 0.05);
  const mainGearSupportGeo2 = new THREE.BoxGeometry(0.05, 1.2, 0.05);

  const leftGearSupport = new THREE.Mesh(mainGearSupportGeo, cabinMaterial);
  leftGearSupport.position.set(-0.9, 0.2, 0.2);
  leftGearSupport.rotation.z = Math.PI / -12;
  group.add(leftGearSupport);

  const rightGearSupport = new THREE.Mesh(mainGearSupportGeo, cabinMaterial);
  rightGearSupport.position.set(0.9, 0.2, 0.2);
  rightGearSupport.rotation.z = -Math.PI / -12;
  group.add(rightGearSupport);

  const leftGearSupport1 = new THREE.Mesh(mainGearSupportGeo2, cabinMaterial);
  leftGearSupport1.position.set(0.4, 0.1, -0.5);
  leftGearSupport1.rotation.x = Math.PI / 2;
  group.add(leftGearSupport1);

  const rightGearSupport1 = new THREE.Mesh(mainGearSupportGeo2, cabinMaterial);
  rightGearSupport1.position.set(-0.4, 0.1, -0.5);
  rightGearSupport1.rotation.x = -Math.PI / 2;
  group.add(rightGearSupport1);

  const mainWheelGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.15, 16);
  const leftWheel = new THREE.Mesh(mainWheelGeometry, gearMaterial);
  leftWheel.rotation.x = Math.PI / 2;
  leftWheel.rotation.z = Math.PI / 2;
  leftWheel.position.set(-1, -0.2, 0.2);
  group.add(leftWheel);

  const rightWheel = new THREE.Mesh(mainWheelGeometry, gearMaterial);
  rightWheel.rotation.x = Math.PI / 2;
  rightWheel.rotation.z = Math.PI / 2;
  rightWheel.position.set(1, -0.2, 0.2);
  group.add(rightWheel);

  // ============================================================
  // CABINE (Canopy) E SENSORES
  // ============================================================
  const cabinGeometry = new THREE.SphereGeometry(0.2, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.7);
  const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
  cabin.position.set(0, 0.65, -1.0);
  group.add(cabin);

  // Radar/Sensor no nariz
  const sphereGeometry = new THREE.SphereGeometry(0.1, 10, 10);
  const sphere = new THREE.Mesh(sphereGeometry, black);
  sphere.position.set(0, 0.35, -1.9);
  group.add(sphere);

  // Luz de identificação
  const idLight = new THREE.PointLight(baseColor, 1.0, 4);
  idLight.position.set(0, 1.0, 0);
  group.add(idLight);

  group.position.set(0, 0, 2);

  // ===== ÁUDIO =====
  let sound = null;
  if (scene && listener) {
    const audioListener = listener || new THREE.AudioListener();
    if (!listener) scene.add(audioListener);
    sound = new THREE.Audio(audioListener);
    const audioLoader = new THREE.AudioLoader();
    audioLoader.load('Som de avião Caça.mp3', (buffer) => {
      sound.setBuffer(buffer);
      sound.setLoop(true);
      sound.setVolume(0.01);
      sound.play();
    });
    group.userData.sound = sound;
  } else {
    console.warn('Áudio não carregado: cena ou listener não fornecidos.');
  }

  // ===== SOMBRA =====
  let shadow = null;
  if (scene) {
    const shadowGeometry = new THREE.CircleGeometry(2.2, 32);
    const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
    shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    scene.add(shadow);
  }

  const planeBox = new THREE.Box3().setFromObject(group);

  // ===== VARIÁVEIS DE FÍSICA =====
  let speed = 0;
  let velocity = 0;
  const maxSpeed = 2.8; // Velocidade boa para um ataque ao solo
  const acceleration = 0.0032;
  const friction = 0.0025;
  const gravity = 0.3;
  const crashGravity = 0.9;
  const liftThreshold = 0.60;
  let isAccelerating = false;
  let isCrashed = false;
  let crashTimer = 0;
  const crashDuration = 1;
  const baseRotationSpeed = 0.012;
  let targetRoll = 0;
  let pitchAngle = 0;
  const maxPitchAngle = Math.PI / 4;
  const maxAltitude = 400;
  const liftFactor = 0.2;
  const pitchSpeed = 0.07;
  const baseVerticalSpeedUp = 0.09;
  const speedFactor = 2.5;
  const inclina = -1.5;
  const inclina2 = 1.5;

  // ===== ANIMAÇÃO DO FOGO =====
   function animateFire(currentSpeed) {
    const positions = propeller.geometry.attributes.position.array;
    // Calcula a velocidade de queda do fogo baseada na velocidade do avião (0 a 1)
    // Quanto mais rápido o avião, mais rápido as partículas saem do bico.
    const fireSpeed = 0.02 + (currentSpeed * 0.2); 
    
    for (let i = 0; i < 100; i++) {
      positions[i * 3 + 2] -= fireSpeed; // Agora a queda do fogo varia!
      if (positions[i * 3 + 2] < -0.5) {
        positions[i * 3] = (Math.random() - 0.5) * 0.3;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
        positions[i * 3 + 2] = 0.5;
      }
    }
    propeller.geometry.attributes.position.needsUpdate = true;
  }

  // ===== FUNÇÕES SET E UPDATE =====
  function setSpeed(value) { speed = value; }
  function setVelocity(value) { velocity = value; }
  function setIsAccelerating(value) { isAccelerating = value; }
  function setIsCrashed(value) { isCrashed = value; }
  function setCrashTimer(value) { crashTimer = value; }
  function setPitchAngle(value) { pitchAngle = value; }

   function update(frame, speedInput) {
    // Lê a velocidade atual (0 a 1, igual fizemos no ATR)
    const currentSpeed = Math.min(1, Math.max(0, speedInput || speed || 0));
    
    // Passa a velocidade calculada para a animação do fogo
    animateFire(currentSpeed);
  }

  function dispose() {
    if (shadow) {
      if (shadow.parent) shadow.parent.remove(shadow);
      shadow.geometry.dispose();
      shadow.material.dispose();
    }
  }

  return {
    group,
    sphere,
    propeller,
    fireLight,
    propeller1,
    propeller2,
    propeller3,
    shadow,
    planeBox,
    sound,
    speed,
    velocity,
    maxSpeed,
    acceleration,
    friction,
    gravity,
    crashGravity,
    liftThreshold,
    isAccelerating,
    isCrashed,
    crashTimer,
    crashDuration,
    pitchAngle,
    maxPitchAngle,
    maxAltitude,
    liftFactor,
    pitchSpeed,
    baseVerticalSpeedUp,
    speedFactor,
    baseRotationSpeed,
    inclina,
    inclina2,
    targetRoll,
    animateFire,
    setSpeed,
    setVelocity,
    setIsAccelerating,
    setIsCrashed,
    setCrashTimer,
    setPitchAngle,
    update,
    dispose,
    idLight,
    colorable: []
  };
};