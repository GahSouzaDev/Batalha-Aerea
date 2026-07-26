PLANE_BUILDERS.sr71 = function (colorHex, options = {}) {
  // ===== OBTENDO CENA E LISTENER (GLOBAL OU PASSADO) =====
  const scene = options.scene || (typeof window !== 'undefined' && window.scene);
  const listener = options.listener || (typeof window !== 'undefined' && window.listener);

  // ===== GRUPO PRINCIPAL =====
  const group = new THREE.Group();

  // ===== TEXTURAS E MATERIAIS (COM SUPORTE A colorHex) =====
  const useTexture = !colorHex || colorHex === 0xffffff;
  const baseColor = colorHex || 0xffffff;

  let planeMaterial, planeTailMaterial;
  if (useTexture) {
    const planeTexture = new THREE.TextureLoader().load('img/camuflagem.png');
    planeMaterial = new THREE.MeshStandardMaterial({ map: planeTexture, metalness: 0.9, roughness: 1 });
    planeTailMaterial = new THREE.MeshStandardMaterial({ map: planeTexture, metalness: 0.9, roughness: 1 });
  } else {
    planeMaterial = new THREE.MeshStandardMaterial({ color: baseColor, metalness: 0.9, roughness: 1 });
    planeTailMaterial = new THREE.MeshStandardMaterial({ color: baseColor, metalness: 0.9, roughness: 1 });
  }

  const gearMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
  const cabinMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 });

  // ============================================================
  // CONSTRUÇÃO DO SR-71 – CÓPIA EXATA DA GEOMETRIA ORIGINAL
  // ============================================================

  // Corpo principal
  const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.1, 4.2, 32);
  const body = new THREE.Mesh(bodyGeometry, planeMaterial);
  body.rotation.x = Math.PI / 2;
  body.position.y = 0.5;
  body.position.z = -0.2;
  group.add(body);

  const body1Geometry = new THREE.CylinderGeometry(0.01, 0.3, 1, 32);
  const body1 = new THREE.Mesh(body1Geometry, planeMaterial);
  body1.rotation.x = Math.PI / 2;
  body1.position.y = 0.5;
  body1.position.z = 2.4;
  group.add(body1);

  const body2Geometry = new THREE.BoxGeometry(0.1, 3, 1.7);
  const body2 = new THREE.Mesh(body2Geometry, planeMaterial);
  body2.rotation.x = Math.PI / 2;
  body2.rotation.y = Math.PI / 2;
  body2.position.y = 0.6;
  body2.position.z = 0.1;
  group.add(body2);

  // Asas (triângulo)
  const wingsGeometry = new THREE.ConeGeometry(2.85, 0.2, 3);
  const wings = new THREE.Mesh(wingsGeometry, planeMaterial);
  wings.rotation.x = Math.PI / 1;
  wings.position.y = 0.5;
  wings.position.z = 1.7;
  group.add(wings);

  // Cauda vertical dupla
  const tailVerticalGeometry = new THREE.BoxGeometry(0.1, 1.5, 0.5);
  const tailVertical = new THREE.Mesh(tailVerticalGeometry, planeTailMaterial);
  tailVertical.rotation.x = Math.PI / 1;
  tailVertical.rotation.y = Math.PI / 1;
  tailVertical.position.y = 0.8;
  tailVertical.position.z = 2.7;
  tailVertical.position.x = -1.5;
  group.add(tailVertical);

  const tailVertical2 = new THREE.Mesh(tailVerticalGeometry, planeTailMaterial);
  tailVertical2.rotation.x = Math.PI / 1;
  tailVertical2.rotation.y = Math.PI / 1;
  tailVertical2.position.y = 0.8;
  tailVertical2.position.z = 2.7;
  tailVertical2.position.x = 1.5;
  group.add(tailVertical2);

  // Cauda horizontal (triângulo)
  const tailHorizontalGeometry = new THREE.ConeGeometry(1, 0.3, 3);
  const tailHorizontal = new THREE.Mesh(tailHorizontalGeometry, planeMaterial);
  tailHorizontal.rotation.x = Math.PI / 1;
  tailHorizontal.position.z = -1.8;
  tailHorizontal.position.y = 0.5;
  group.add(tailHorizontal);

  // Fogo (partículas) – duplo, como no segundo modelo
  const fireMaterial = new THREE.PointsMaterial({
    color: 0xff0000,
    size: 0.1,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
  });

  function createFireGeometry() {
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array(100 * 3);
    for (let i = 0; i < 100; i++) {
      verts[i*3] = (Math.random() - 0.5) * 0.3;
      verts[i*3+1] = (Math.random() - 0.5) * 0.3;
      verts[i*3+2] = (Math.random() - 0.5) * 0.5;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    return geo;
  }

  const propeller = new THREE.Points(createFireGeometry(), fireMaterial);
  propeller.rotation.y = Math.PI;
  propeller.position.set(1.5, 0.63, 3.3);
  group.add(propeller);

  const propeller1 = new THREE.Points(createFireGeometry(), fireMaterial);
  propeller1.rotation.y = Math.PI;
  propeller1.position.set(-1.5, 0.63, 3.3);
  group.add(propeller1);

  // Luzes do fogo
  const fireLight = new THREE.PointLight(0xff4500, 0.5, 5);
  fireLight.position.set(1.5, 0.63, 3);
  group.add(fireLight);

  const fireLight1 = new THREE.PointLight(0xff4500, 0.5, 5);
  fireLight1.position.set(-1.5, 0.63, 3);
  group.add(fireLight1);

  // Hélices invisíveis (mantidas por compatibilidade)
  const propellerGeometry = new THREE.ConeGeometry(0.4, 0.5, 32);
  const propellerMaterial2 = new THREE.MeshStandardMaterial({
    color: 0xff4500,
    emissive: 0xff4500,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.9
  });
  const propeller2 = new THREE.Mesh(propellerGeometry, propellerMaterial2);
  propeller2.visible = false;
  group.add(propeller2);

  const propeller3 = new THREE.Mesh(propellerGeometry, propellerMaterial2);
  propeller3.visible = false;
  group.add(propeller3);

  // Trem de pouso
  const frontGearSupport = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.05), cabinMaterial);
  frontGearSupport.position.set(0, 0.2, -1);
  group.add(frontGearSupport);

  const frontWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 16), gearMaterial);
  frontWheel.rotation.x = Math.PI / 2;
  frontWheel.rotation.z = Math.PI / 2;
  frontWheel.position.set(0, -0.1, -1);
  group.add(frontWheel);

  const mainGearSupportGeometry = new THREE.BoxGeometry(0.05, 0.6, 0.05);
  const mainGearSupportGeometry12 = new THREE.BoxGeometry(0.05, 1.2, 0.05);

  const leftGearSupport = new THREE.Mesh(mainGearSupportGeometry, cabinMaterial);
  leftGearSupport.position.set(-0.9, 0.2, 1.5);
  leftGearSupport.rotation.z = Math.PI / -12;
  group.add(leftGearSupport);

  const rightGearSupport = new THREE.Mesh(mainGearSupportGeometry, cabinMaterial);
  rightGearSupport.position.set(0.9, 0.2, 1.5);
  rightGearSupport.rotation.z = -Math.PI / -12;
  group.add(rightGearSupport);

  const leftGearSupport1 = new THREE.Mesh(mainGearSupportGeometry12, cabinMaterial);
  leftGearSupport1.position.set(0.5, 0.5, 2.4);
  leftGearSupport1.rotation.x = Math.PI / 2;
  group.add(leftGearSupport1);

  const rightGearSupport1 = new THREE.Mesh(mainGearSupportGeometry12, cabinMaterial);
  rightGearSupport1.position.set(-0.5, 0.5, 2.4);
  rightGearSupport1.rotation.x = -Math.PI / 2;
  group.add(rightGearSupport1);

  const mainWheelGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.15, 16);
  const leftWheel = new THREE.Mesh(mainWheelGeometry, gearMaterial);
  leftWheel.rotation.x = Math.PI / 2;
  leftWheel.rotation.z = Math.PI / 2;
  leftWheel.position.set(-1, -0.2, 1.5);
  group.add(leftWheel);

  const rightWheel = new THREE.Mesh(mainWheelGeometry, gearMaterial);
  rightWheel.rotation.x = Math.PI / 2;
  rightWheel.rotation.z = Math.PI / 2;
  rightWheel.position.set(1, -0.2, 1.5);
  group.add(rightWheel);

  // Cabines (duplas)
  const cabinGeometry = new THREE.CylinderGeometry(0.25, 0.25, 2.2, 16);
  const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
  cabin.rotation.x = Math.PI / 2;
  cabin.position.set(-1.5, 0.6, 2.1);
  group.add(cabin);

  const cabin9Geometry = new THREE.CylinderGeometry(0.20, 0.01, 0.5, 16);
  const cabin9 = new THREE.Mesh(cabin9Geometry, cabinMaterial);
  cabin9.rotation.x = Math.PI / 2;
  cabin9.position.set(-1.5, 0.6, 0.8);
  group.add(cabin9);

  const cabin1Geometry = new THREE.CylinderGeometry(0.25, 0.25, 2.2, 16);
  const cabin1 = new THREE.Mesh(cabin1Geometry, cabinMaterial);
  cabin1.rotation.x = Math.PI / 2;
  cabin1.position.set(1.5, 0.6, 2.1);
  group.add(cabin1);

  const cabin8Geometry = new THREE.CylinderGeometry(0.20, 0.01, 0.5, 16);
  const cabin8 = new THREE.Mesh(cabin8Geometry, cabinMaterial);
  cabin8.rotation.x = Math.PI / 2;
  cabin8.position.set(1.5, 0.6, 0.8);
  group.add(cabin8);

  const cabin2Geometry = new THREE.CylinderGeometry(0.1, 0.25, 4.2, 16);
  const cabin2 = new THREE.Mesh(cabin2Geometry, cabinMaterial);
  cabin2.rotation.x = Math.PI / 2;
  cabin2.position.set(0, 0.6, 0.5);
  group.add(cabin2);

  // Esfera (radar?)
  const sphereGeometry = new THREE.SphereGeometry(0.3, 32, 32);
  const sphere = new THREE.Mesh(sphereGeometry, black);
  sphere.rotation.x = Math.PI / 2;
  sphere.position.set(0, 0.6, -1.7);
  group.add(sphere);

  // Luz de identificação (original)
  const idLight = new THREE.PointLight(baseColor, 1.0, 4);
  idLight.position.set(0, 1.0, 0.5);
  group.add(idLight);

  // Posicionar o avião na pista (igual ao segundo modelo)
  group.position.set(0, 0, 2);

  // ===== ÁUDIO (EXATAMENTE COMO NO SEGUNDO MODELO) =====
  let sound = null;
  if (scene && listener) {
    const audioListener = listener || new THREE.AudioListener();
    if (!listener) scene.add(audioListener);
    sound = new THREE.Audio(audioListener);
    const audioLoader = new THREE.AudioLoader();
    audioLoader.load('boeing.mp3', (buffer) => {
      sound.setBuffer(buffer);
      sound.setLoop(true);
      sound.setVolume(0.01);
      sound.setSpeed(200);
      sound.play();
    });
    group.userData.sound = sound;
  } else {
    console.warn('Áudio não carregado: cena ou listener não fornecidos.');
  }

  // ===== SOMBRA (EXATAMENTE COMO NO SEGUNDO MODELO) =====
  let shadow = null;
  if (scene) {
    const shadowGeometry = new THREE.CircleGeometry(2.5, 32);
    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.5
    });
    shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    scene.add(shadow);
  }

  // ===== BOUNDING BOX (para colisão) =====
  const planeBox = new THREE.Box3().setFromObject(group);

  // ===== VARIÁVEIS DE FÍSICA (AJUSTADAS PARA SR-71) =====
  let speed = 0;
  let velocity = 0;
  const maxSpeed = 5;
  const acceleration = 0.004;
  const friction = 0.0035;
  const gravity = 0.3;
  const crashGravity = 0.9;
  const liftThreshold = 0.80;
  let isAccelerating = false;
  let isCrashed = false;
  let crashTimer = 0;
  const crashDuration = 1;
  let keys = { w: false, s: false, a: false, d: false };
  const baseRotationSpeed = 0.01;
  let targetRoll = 0;
  let pitchAngle = 0;
  const maxPitchAngle = Math.PI / 4;
  const maxAltitude = 500;
  const liftFactor = 0.2;
  const pitchSpeed = 0.07;
  const baseVerticalSpeedUp = 0.095;
  const speedFactor = 1.88;
  const inclina = -1.6;
  const inclina2 = 1.6;

  // ============================================================
  // FUNÇÃO DE ANIMAÇÃO DO FOGO (DUPLO + DINÂMICO)
  // ============================================================
  function animateFire(currentSpeed) {
    // Calcula a velocidade de expulsão baseada na velocidade do avião (0 a 1)
    const fireSpeed = 0.04 + (currentSpeed * 0.3); 
    
    const positions = propeller.geometry.attributes.position.array;
    const positions1 = propeller1.geometry.attributes.position.array;
    for (let i = 0; i < 100; i++) {
      // Usa a velocidade variável nos dois jatos
      positions[i*3+2] -= fireSpeed;
      positions1[i*3+2] -= fireSpeed;
      if (positions[i*3+2] < -0.5) {
        positions[i*3] = (Math.random() - 0.5) * 0.3;
        positions[i*3+1] = (Math.random() - 0.5) * 0.3;
        positions[i*3+2] = 0.5;
      }
      if (positions1[i*3+2] < -0.5) {
        positions1[i*3] = (Math.random() - 0.5) * 0.3;
        positions1[i*3+1] = (Math.random() - 0.5) * 0.3;
        positions1[i*3+2] = 0.5;
      }
    }
    propeller.geometry.attributes.position.needsUpdate = true;
    propeller1.geometry.attributes.position.needsUpdate = true;
  }

  // ===== FUNÇÕES SET (IGUAIS AO SEGUNDO MODELO) =====
  function setSpeed(value) { speed = value; }
  function setVelocity(value) { velocity = value; }
  function setIsAccelerating(value) { isAccelerating = value; }
  function setIsCrashed(value) { isCrashed = value; }
  function setCrashTimer(value) { crashTimer = value; }
  function setPitchAngle(value) { pitchAngle = value; }

  // ============================================================
  // MÉTODO UPDATE (AGORA PASSA A VELOCIDADE PRO FOGO)
  // ============================================================
  function update(frame, speedInput) {
    // Pega a velocidade atual do avião (0 a 1) e passa para o fogo
    const currentSpeed = Math.min(1, Math.max(0, speedInput || speed || 0));
    animateFire(currentSpeed);
  }

  // ===== OBJETO RETORNADO =====
  return {
    group,                // substitui o 'plane' do segundo modelo
    sphere,
    propeller,
    propeller1,
    propeller2,
    propeller3,
    fireLight,
    fireLight1,
    shadow,               // já adicionado à cena
    planeBox,
    sound,
    // Variáveis de física
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
    // Funções
    animateFire,
    setSpeed,
    setVelocity,
    setIsAccelerating,
    setIsCrashed,
    setCrashTimer,
    setPitchAngle,
    update,
    // Para compatibilidade com o original
    idLight,
    colorable: []
  };
};