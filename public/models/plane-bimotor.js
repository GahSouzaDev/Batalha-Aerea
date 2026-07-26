PLANE_BUILDERS.bimotor = function (colorHex, options = {}) {
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
    const planeTexture = new THREE.TextureLoader().load('img/antigo.png');
    planeMaterial = new THREE.MeshStandardMaterial({ map: planeTexture, metalness: 0, roughness: 0 });
    planeTailMaterial = new THREE.MeshStandardMaterial({ map: planeTexture, metalness: 0.1, roughness: 0 });
  } else {
    planeMaterial = new THREE.MeshStandardMaterial({ color: baseColor, metalness: 0, roughness: 0 });
    planeTailMaterial = new THREE.MeshStandardMaterial({ color: baseColor, metalness: 0.1, roughness: 0 });
  }

  const gearMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
  const cabinMaterial = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
  const motorMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });

  // ============================================================
  // CONSTRUÇÃO DO BIMOTOR – CÓPIA EXATA DA GEOMETRIA ORIGINAL
  // ============================================================

  // Corpo
  const bodyGeometry = new THREE.CylinderGeometry(0.2, 0.3, 5.2, 32);
  const body = new THREE.Mesh(bodyGeometry, planeMaterial);
  body.rotation.x = Math.PI / 2;
  body.position.y = 0.5;
  body.position.z = -0.2;
  group.add(body);

  // Esfera (nariz)
  const sphereGeometry = new THREE.SphereGeometry(0.3, 32, 32);
  const sphere = new THREE.Mesh(sphereGeometry, planeMaterial);
  sphere.rotation.x = Math.PI / 2;
  sphere.position.y = 0.5;
  sphere.position.z = -2.9;
  group.add(sphere);

  // Asas
  const wingsGeometry = new THREE.BoxGeometry(7, 0.1, 1.8);
  const wings = new THREE.Mesh(wingsGeometry, planeMaterial);
  wings.position.y = 1;
  wings.position.z = -0.5;
  group.add(wings);

  // Cauda vertical
  const tailVerticalGeometry = new THREE.BoxGeometry(0.1, 0.8, 0.5);
  const tailVertical = new THREE.Mesh(tailVerticalGeometry, planeTailMaterial);
  tailVertical.position.y = 0.9;
  tailVertical.position.z = 2.2;
  group.add(tailVertical);

  // Texto (logotipo)
  const textGeometry = new THREE.PlaneGeometry(0.4, 0.4);
  let textMaterial;
  if (useTexture) {
    const textTexture = new THREE.TextureLoader().load('img/ATR.png');
    textMaterial = new THREE.MeshBasicMaterial({ map: textTexture, transparent: true });
  } else {
    textMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 });
  }
  const textMesh = new THREE.Mesh(textGeometry, textMaterial);
  textMesh.position.set(0.06, 0.1, 0);
  textMesh.rotation.y = Math.PI / 2;
  tailVertical.add(textMesh);

  // Cauda horizontal
  const tailHorizontalGeometry = new THREE.BoxGeometry(3, 0.1, 0.5);
  const tailHorizontal = new THREE.Mesh(tailHorizontalGeometry, planeMaterial);
  tailHorizontal.position.z = 2;
  tailHorizontal.position.y = 0.5;
  group.add(tailHorizontal);

  // Hélices (visíveis)
  const propellerGeometry = new THREE.BoxGeometry(0.1, 1.5, 0.1);
  const propellerMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const propeller = new THREE.Mesh(propellerGeometry, propellerMaterial);
  propeller.position.set(1.2, 0.8, -1.5);
  group.add(propeller);

  const propeller1 = new THREE.Mesh(propellerGeometry, propellerMaterial);
  propeller1.position.set(-1.2, 0.8, -1.5);
  group.add(propeller1);

  // Hélices extras (invisíveis – mantidas por compatibilidade)
  const propeller2 = new THREE.Mesh(propellerGeometry, propellerMaterial);
  propeller2.visible = false;
  group.add(propeller2);
  const propeller3 = new THREE.Mesh(propellerGeometry, propellerMaterial);
  propeller3.visible = false;
  group.add(propeller3);

  // Trem de pouso
  const frontGearSupport = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.05), cabinMaterial);
  frontGearSupport.position.set(0, 0.2, -2.4);
  group.add(frontGearSupport);

  const frontWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 16), gearMaterial);
  frontWheel.rotation.x = Math.PI / 2;
  frontWheel.rotation.z = Math.PI / 2;
  frontWheel.position.set(0, -0.1, -2.4);
  group.add(frontWheel);

  const mainGearSupportGeometry = new THREE.BoxGeometry(0.05, 0.6, 0.05);
  const mainGearSupportGeometry12 = new THREE.BoxGeometry(0.05, 1.2, 0.05);

  const leftGearSupport = new THREE.Mesh(mainGearSupportGeometry, cabinMaterial);
  leftGearSupport.position.set(-0.2, 0.2, -0.5);
  leftGearSupport.rotation.z = Math.PI / -12;
  group.add(leftGearSupport);

  const rightGearSupport = new THREE.Mesh(mainGearSupportGeometry, cabinMaterial);
  rightGearSupport.position.set(0.2, 0.2, -0.5);
  rightGearSupport.rotation.z = -Math.PI / -12;
  group.add(rightGearSupport);

  const leftGearSupport1 = new THREE.Mesh(mainGearSupportGeometry12, cabinMaterial);
  leftGearSupport1.position.set(0.5, 0.65, -0.7);
  leftGearSupport1.rotation.z = Math.PI / -3;
  group.add(leftGearSupport1);

  const rightGearSupport1 = new THREE.Mesh(mainGearSupportGeometry12, cabinMaterial);
  rightGearSupport1.position.set(-0.5, 0.65, -0.7);
  rightGearSupport1.rotation.z = -Math.PI / -3;
  group.add(rightGearSupport1);

  const mainWheelGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.15, 16);
  const leftWheel = new THREE.Mesh(mainWheelGeometry, gearMaterial);
  leftWheel.rotation.x = Math.PI / 2;
  leftWheel.rotation.z = Math.PI / 2;
  leftWheel.position.set(-0.25, -0.1, -0.5);
  group.add(leftWheel);

  const rightWheel = new THREE.Mesh(mainWheelGeometry, gearMaterial);
  rightWheel.rotation.x = Math.PI / 2;
  rightWheel.rotation.z = Math.PI / 2;
  rightWheel.position.set(0.25, -0.1, -0.5);
  group.add(rightWheel);

  // Cabine
  const cabinGeometry = new THREE.CylinderGeometry(0.25, 0.25, 2, 20);
  const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
  cabin.rotation.x = Math.PI / 2;
  cabin.position.set(0, 0.70, -1.25);
  group.add(cabin);

  // Motores
  const motorGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.8, 10);
  const motor = new THREE.Mesh(motorGeometry, motorMaterial);
  motor.rotation.x = Math.PI / 2;
  motor.position.set(-1.19, 0.8, -1.19);
  group.add(motor);

  const motor1 = new THREE.Mesh(motorGeometry, motorMaterial);
  motor1.rotation.x = Math.PI / 2;
  motor1.position.set(1.19, 0.8, -1.19);
  group.add(motor1);

  // ============================================================
  // EFEITO DE FOGO (TURBO-HÉLICE) – IGUAL AO F-22
  // ============================================================
  const fireMaterial = new THREE.PointsMaterial({
    color: 0x88ccff,
    size: 0.1,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending
  });

  function buildFireGeometry() {
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array(60 * 3);
    for (let i = 0; i < 60; i++) {
      verts[i * 3] = (Math.random() - 0.5) * 0.25;
      verts[i * 3 + 1] = (Math.random() - 0.5) * 0.25;
      verts[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    return geo;
  }

  // Fogo do motor esquerdo (posição atrás do motor)
  const fireLeft = new THREE.Points(buildFireGeometry(), fireMaterial);
  fireLeft.position.set(-1.19, 0.8, -0.7); // atrás do motor (z positivo)
  group.add(fireLeft);

  // Fogo do motor direito
  const fireRight = new THREE.Points(buildFireGeometry(), fireMaterial);
  fireRight.position.set(1.19, 0.8, -0.7);
  group.add(fireRight);

  // Luzes do fogo
  const fireLightLeft = new THREE.PointLight(0x88ccff, 1.6, 5);
  fireLightLeft.position.copy(fireLeft.position);
  group.add(fireLightLeft);

  const fireLightRight = new THREE.PointLight(0x88ccff, 1.6, 5);
  fireLightRight.position.copy(fireRight.position);
  group.add(fireLightRight);

  // Referência única para compatibilidade (aponta para o esquerdo)
  const fireLight = fireLightLeft;

  // Luz de identificação (original)
  const idLight = new THREE.PointLight(baseColor, 1.0, 5);
  idLight.position.set(0, 1.2, -1.25);
  group.add(idLight);

  // Posicionar o avião na pista
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

  // ===== VARIÁVEIS DE FÍSICA =====
  let speed = 0;
  let velocity = 0;
  const maxSpeed = 1;
  const acceleration = 0.001;
  const friction = 0.001;
  const gravity = 0.3;
  const crashGravity = 0.9;
  const liftThreshold = 0.40;
  let isAccelerating = false;
  let isCrashed = false;
  let crashTimer = 0;
  const crashDuration = 1;
  let pitchAngle = 0;
  const maxPitchAngle = Math.PI / 4;
  const maxAltitude = 120;
  const liftFactor = 0.2;
  const pitchSpeed = 0.04;
  const baseVerticalSpeedUp = 0.050;
  const speedFactor = 0.2;
  const ai = 0.8;
  const baseRotationSpeed = 0.05;
  const inclinaBoing = -0.3;
  const inclinaBoing2 = 0.3;
  const inclina = -0.5;
  const inclina2 = 0.8;

  // ===== FUNÇÕES DE ANIMAÇÃO DO FOGO =====
  function animateFire(currentSpeed) {
    // Velocidade do fogo proporcional à velocidade do avião
    const speedFactor = 0.02 * (1 + Math.abs(currentSpeed || 0) * 5);
    [fireLeft, fireRight].forEach(p => {
      const positions = p.geometry.attributes.position.array;
      for (let i = 0; i < 60; i++) {
        // Move as partículas para trás (+z)
        positions[i * 3 + 2] += speedFactor;
        // Se ultrapassar o limite, reseta
        if (positions[i * 3 + 2] > 0.5) {
          positions[i * 3] = (Math.random() - 0.5) * 0.25;
          positions[i * 3 + 1] = (Math.random() - 0.5) * 0.25;
          positions[i * 3 + 2] = -0.5;
        }
      }
      p.geometry.attributes.position.needsUpdate = true;
    });
  }

  // ===== FUNÇÕES SET (IGUAIS AO SEGUNDO MODELO) =====
  function setSpeed(value) { speed = value; }
  function setVelocity(value) { velocity = value; }
  function setIsAccelerating(value) { isAccelerating = value; }
  function setIsCrashed(value) { isCrashed = value; }
  function setCrashTimer(value) { crashTimer = value; }
  function setPitchAngle(value) { pitchAngle = value; }

  // ===== MÉTODO UPDATE (ROTAÇÃO DAS HÉLICES + FOGO) =====
  function update(frame, speedInput) {
    // Rotação das hélices (como no original)
    const rotSpeed = 0.2 + (speedInput || speed || 0);
    propeller.rotation.z += rotSpeed * 2;
    propeller1.rotation.z += rotSpeed * 2;
    if (propeller2.visible) propeller2.rotation.z += rotSpeed;
    if (propeller3.visible) propeller3.rotation.z += rotSpeed;

    // Anima o fogo com a velocidade atual
    animateFire(speedInput || speed || 0);
  }

  // ===== DISPOSE (LIMPEZA) =====
  function dispose() {
    if (shadow) {
      if (shadow.parent) shadow.parent.remove(shadow);
      shadow.geometry.dispose();
      shadow.material.dispose();
    }
    // Opcional: descartar geometrias e materiais do fogo
    [fireLeft, fireRight].forEach(p => {
      p.geometry.dispose();
      p.material.dispose();
    });
  }

  // ===== OBJETO RETORNADO =====
  return {
    group,
    motor,
    propeller,
    propeller1,
    propeller2,
    propeller3,
    shadow,
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
    baseRotationSpeed,
    inclinaBoing2,
    inclinaBoing,
    inclina2,
    inclina,
    speedFactor,
    ai,
    // Funções
    setSpeed,
    setVelocity,
    setIsAccelerating,
    setIsCrashed,
    setCrashTimer,
    setPitchAngle,
    // Método update (hélices + fogo)
    update,
    // Referências ao fogo (opcional)
    fireLeft,
    fireRight,
    fireLightLeft,
    fireLightRight,
    fireLight,
    dispose,
    // Compatibilidade
    idLight,
    colorable: []
  };
};