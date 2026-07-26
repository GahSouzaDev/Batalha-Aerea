PLANE_BUILDERS.jato = function (colorHex, options = {}) {
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
    const planeTexture = new THREE.TextureLoader().load('img/bandeira.png');
    const planeTexture1 = new THREE.TextureLoader().load('img/corpo-griper.png');
    planeMaterial = new THREE.MeshStandardMaterial({ map: planeTexture1 });
    planeTailMaterial = new THREE.MeshStandardMaterial({ map: planeTexture });
  } else {
    planeMaterial = new THREE.MeshStandardMaterial({ color: baseColor });
    planeTailMaterial = new THREE.MeshStandardMaterial({ color: baseColor });
  }

  const gearMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
  const cabinMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 });

  // ============================================================
  // CONSTRUÇÃO DO JATO – CÓPIA EXATA DA GEOMETRIA ORIGINAL
  // ============================================================

  // Corpo
  const bodyGeometry = new THREE.CylinderGeometry(0.2, 0.15, 3.6, 32);
  const body = new THREE.Mesh(bodyGeometry, planeMaterial);
  body.rotation.x = Math.PI / 2;
  body.position.y = 0.5;
  body.position.z = -0.2;
  group.add(body);

  // Asas (triângulo)
  const wingsGeometry = new THREE.ConeGeometry(2.5, 1, 3);
  const wings = new THREE.Mesh(wingsGeometry, planeMaterial);
  wings.rotation.x = Math.PI / 1;
  wings.position.y = 0.10;
  wings.position.z = 0.5;
  group.add(wings);

  // Cauda vertical (dupla)
  const tailVerticalGeometry = new THREE.BoxGeometry(0.1, 1.5, 0.5);
  const tailVertical = new THREE.Mesh(tailVerticalGeometry, planeTailMaterial);
  tailVertical.position.y = 0.9;
  tailVertical.position.z = 1.2;
  group.add(tailVertical);

  const tailVertical2 = new THREE.Mesh(tailVerticalGeometry, planeTailMaterial);
  tailVertical2.position.y = 0.9;
  tailVertical2.position.z = 1.2;
  group.add(tailVertical2);

  // Texto (logotipo)
  const textGeometry = new THREE.PlaneGeometry(0.4, 0.4);
  let textMaterial;
  if (useTexture) {
    const textTexture = new THREE.TextureLoader().load('img/FAB.png');
    textMaterial = new THREE.MeshBasicMaterial({ map: textTexture, transparent: true });
  } else {
    textMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 });
  }
  const textMesh = new THREE.Mesh(textGeometry, textMaterial);
  textMesh.position.set(0.06, 0.1, 0);
  textMesh.rotation.y = Math.PI / 2;
  tailVertical.add(textMesh);

  // Cauda horizontal (triângulo)
  const tailHorizontalGeometry = new THREE.ConeGeometry(1, 0.5, 3);
  const tailHorizontal = new THREE.Mesh(tailHorizontalGeometry, planeMaterial);
  tailHorizontal.rotation.x = Math.PI / 1;
  tailHorizontal.position.z = -1.5;
  tailHorizontal.position.y = 0.3;
  group.add(tailHorizontal);

  // Fogo (partículas) – igual ao segundo modelo
  const fireMaterial = new THREE.PointsMaterial({
    color: 0xff4500,
    size: 0.1,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
  });

  const fireGeometry = new THREE.BufferGeometry();
  const fireVertices = new Float32Array(100 * 3);
  for (let i = 0; i < 100; i++) {
    fireVertices[i * 3] = (Math.random() - 0.5) * 0.3;
    fireVertices[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
    fireVertices[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
  }
  fireGeometry.setAttribute('position', new THREE.BufferAttribute(fireVertices, 3));

  const propeller = new THREE.Points(fireGeometry, fireMaterial);
  propeller.rotation.y = Math.PI;
  propeller.position.set(0, 0.3, 2);
  group.add(propeller);

  // Luz do fogo
  const fireLight = new THREE.PointLight(0xff4500, 2, 5);
  fireLight.position.set(0, 0.3, 2);
  group.add(fireLight);

  // Hélices invisíveis (mantidas por compatibilidade)
  const propellerGeometry = new THREE.ConeGeometry(1.4, 5.5, 132);
  const propellerMaterial2 = new THREE.MeshStandardMaterial({
    color: 0xff4500,
    emissive: 0xff4500,
    emissiveIntensity: 1,
    transparent: true,
    opacity: 10.9
  });
  const propeller1 = new THREE.Mesh(propellerGeometry, propellerMaterial2);
  propeller1.visible = false;
  group.add(propeller1);
  const propeller2 = new THREE.Mesh(propellerGeometry, propellerMaterial2);
  propeller2.visible = false;
  group.add(propeller2);
  const propeller3 = new THREE.Mesh(propellerGeometry, propellerMaterial2);
  propeller3.visible = false;
  group.add(propeller3);

  // Trem de pouso
  const frontGearSupport = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.05), cabinMaterial);
  frontGearSupport.position.set(0, 0.2, -1.6);
  group.add(frontGearSupport);

  const frontWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 16), gearMaterial);
  frontWheel.rotation.x = Math.PI / 2;
  frontWheel.rotation.z = Math.PI / 2;
  frontWheel.position.set(0, -0.1, -1.6);
  group.add(frontWheel);

  const mainGearSupportGeometry = new THREE.BoxGeometry(0.05, 0.6, 0.05);
  const mainGearSupportGeometry12 = new THREE.BoxGeometry(0.05, 1.2, 0.05);

  const leftGearSupport = new THREE.Mesh(mainGearSupportGeometry, cabinMaterial);
  leftGearSupport.position.set(-1, 0.2, 0.5);
  leftGearSupport.rotation.z = Math.PI / -12;
  group.add(leftGearSupport);

  const rightGearSupport = new THREE.Mesh(mainGearSupportGeometry, cabinMaterial);
  rightGearSupport.position.set(1, 0.2, 0.5);
  rightGearSupport.rotation.z = -Math.PI / -12;
  group.add(rightGearSupport);

  const leftGearSupport1 = new THREE.Mesh(mainGearSupportGeometry12, cabinMaterial);
  leftGearSupport1.position.set(0.5, 0.1, -0.4);
  leftGearSupport1.rotation.x = Math.PI / 2;
  group.add(leftGearSupport1);

  const rightGearSupport1 = new THREE.Mesh(mainGearSupportGeometry12, cabinMaterial);
  rightGearSupport1.position.set(-0.5, 0.1, -0.4);
  rightGearSupport1.rotation.x = -Math.PI / 2;
  group.add(rightGearSupport1);

  const mainWheelGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.15, 16);
  const leftWheel = new THREE.Mesh(mainWheelGeometry, gearMaterial);
  leftWheel.rotation.x = Math.PI / 2;
  leftWheel.rotation.z = Math.PI / 2;
  leftWheel.position.set(-1.1, -0.2, 0.5);
  group.add(leftWheel);

  const rightWheel = new THREE.Mesh(mainWheelGeometry, gearMaterial);
  rightWheel.rotation.x = Math.PI / 2;
  rightWheel.rotation.z = Math.PI / 2;
  rightWheel.position.set(1.1, -0.2, 0.5);
  group.add(rightWheel);

  // Cabine
  const cabinGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.8, 16);
  const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
  cabin.rotation.x = Math.PI / 2;
  cabin.position.set(0, 0.3, 1.5);
  group.add(cabin);

  // Esfera (radar?)
  const sphereGeometry = new THREE.SphereGeometry(0.3, 32, 32);
  const sphere = new THREE.Mesh(sphereGeometry, black);
  sphere.rotation.x = Math.PI / 2;
  sphere.position.set(0, 0.60, -1.1);
  group.add(sphere);

  // Luz de identificação (original)
  const idLight = new THREE.PointLight(baseColor, 1.0, 4);
  idLight.position.set(0, 0.9, 0);
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
    audioLoader.load('Som de avião Caça.mp3', (buffer) => {
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
    const shadowGeometry = new THREE.CircleGeometry(1.7, 32);
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

  // ===== VARIÁVEIS DE FÍSICA (EXATAMENTE COMO NO SEGUNDO MODELO) =====
  let speed = 0;
  let velocity = 0;
  const maxSpeed = 2.5;
  const acceleration = 0.003;
  const friction = 0.0025;
  const gravity = 0.3;
  const crashGravity = 0.9;
  const liftThreshold = 0.60;
  let isAccelerating = false;
  let isCrashed = false;
  let crashTimer = 0;
  const crashDuration = 1;
  let keys = { w: false, s: false, a: false, d: false };
  const baseRotationSpeed = 0.01;
  let targetRoll = 0;
  let pitchAngle = 0;
  const maxPitchAngle = Math.PI / 4;
  const maxAltitude = 400;
  const liftFactor = 0.2;
  const pitchSpeed = 0.07;
  const baseVerticalSpeedUp = 0.08;
  const speedFactor = 2.5;
  const inclina = -1.5;
  const inclina2 = 1.5;

  // ============================================================
  // FUNÇÃO DE ANIMAÇÃO DO FOGO (CORRIGIDA PARA VELOCIDADE DINÂMICA)
  // ============================================================
  function animateFire(currentSpeed) {
    const positions = propeller.geometry.attributes.position.array;
    // Calcula a velocidade de queda do fogo baseada na velocidade do avião (0 a 1)
    // Quanto mais rápido o avião, mais rápido as partículas saem do bico.
    const fireSpeed = 0.03 + (currentSpeed * 0.2); 
    
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

  // ===== FUNÇÕES SET (IGUAIS AO SEGUNDO MODELO) =====
  function setSpeed(value) { speed = value; }
  function setVelocity(value) { velocity = value; }
  function setIsAccelerating(value) { isAccelerating = value; }
  function setIsCrashed(value) { isCrashed = value; }
  function setCrashTimer(value) { crashTimer = value; }
  function setPitchAngle(value) { pitchAngle = value; }

  // ============================================================
  // MÉTODO UPDATE (CORRIGIDO)
  // ============================================================
  function update(frame, speedInput) {
    // Lê a velocidade atual (0 a 1, igual fizemos no ATR)
    const currentSpeed = Math.min(1, Math.max(0, speedInput || speed || 0));
    
    // Passa a velocidade calculada para a animação do fogo
    animateFire(currentSpeed);
  }

  // ===== OBJETO RETORNADO =====
  return {
    group,                // substitui o 'plane' do segundo modelo
    sphere,
    propeller,
    fireLight,
    propeller1,
    propeller2,
    propeller3,
    shadow,               // já adicionado à cena
    planeBox,
    sound,
    // Variáveis de física (como no segundo modelo)
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