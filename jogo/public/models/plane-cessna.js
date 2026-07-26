PLANE_BUILDERS.cessna = function (colorHex, options = {}) {
  // ===== OBTENDO CENA E LISTENER (GLOBAL OU PASSADO) =====
  const scene = options.scene || (typeof window !== 'undefined' && window.scene);
  const listener = options.listener || (typeof window !== 'undefined' && window.listener);

  // ===== GRUPO PRINCIPAL =====
  const group = new THREE.Group();

  // ============================================================
  // MATERIAIS COM TEXTURAS SEPARADAS (ASA E CORPO)
  // ============================================================
  const useTexture = !colorHex || colorHex === 0xffffff;
  const baseColor = colorHex || 0xffffff;

  let bodyMat, wingMat;
  if (useTexture) {
    const bodyTexture = new THREE.TextureLoader().load('img/cessna_body.png');
    const wingTexture = new THREE.TextureLoader().load('img/cessna_wing.png');
    bodyMat = new THREE.MeshStandardMaterial({ map: bodyTexture });
    wingMat = new THREE.MeshStandardMaterial({ map: wingTexture });
  } else {
    bodyMat = new THREE.MeshStandardMaterial({ color: baseColor });
    wingMat = new THREE.MeshStandardMaterial({ color: baseColor });
  }

  const gearMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
  const cabinMaterial = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });

  // ============================================================
  // CONSTRUÇÃO DO CESSNA – GEOMETRIA ORIGINAL
  // ============================================================

  // Corpo (Usa bodyMat)
  const bodyGeometry = new THREE.CylinderGeometry(0.2, 0.2, 3.2, 32);
  const body = new THREE.Mesh(bodyGeometry, bodyMat);
  body.rotation.x = Math.PI / 2;
  body.position.y = 0.5;
  body.position.z = -0.2;
  group.add(body);

  // Asas (Usa wingMat)
  const wingsGeometry = new THREE.BoxGeometry(4, 0.1, 1);
  const wings = new THREE.Mesh(wingsGeometry, wingMat);
  wings.position.y = 0.92;
  wings.position.z = -0.5;
  group.add(wings);

  // Cauda vertical (Usa bodyMat)
  const tailVerticalGeometry = new THREE.BoxGeometry(0.1, 0.8, 0.5);
  const tailVertical = new THREE.Mesh(tailVerticalGeometry, bodyMat);
  tailVertical.position.y = 0.9;
  tailVertical.position.z = 1.2;
  group.add(tailVertical);

  // Texto (logotipo) - Mantido como estava
  const textGeometry = new THREE.PlaneGeometry(0.4, 0.4);
  let textMaterial;
  if (useTexture) {
    const textTexture = new THREE.TextureLoader().load('img/images.png');
    textMaterial = new THREE.MeshBasicMaterial({ map: textTexture, transparent: true });
  } else {
    textMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 });
  }
  const textMesh = new THREE.Mesh(textGeometry, textMaterial);
  textMesh.position.set(0.06, 0.1, 0);
  textMesh.rotation.y = Math.PI / 2;
  tailVertical.add(textMesh);

  // Cauda horizontal (Usa bodyMat)
  const tailHorizontalGeometry = new THREE.BoxGeometry(1.5, 0.1, 0.5);
  const tailHorizontal = new THREE.Mesh(tailHorizontalGeometry, bodyMat);
  tailHorizontal.position.z = 1.2;
  tailHorizontal.position.y = 0.5;
  group.add(tailHorizontal);

  // Hélice
  const propellerGeometry = new THREE.BoxGeometry(0.1, 1.2, 0.1);
  const propellerMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const propeller = new THREE.Mesh(propellerGeometry, propellerMaterial);
  propeller.position.z = -1.8;
  propeller.position.y = 0.5;
  group.add(propeller);

  // Hélices extras (invisíveis, mantidas por compatibilidade)
  const propeller1 = new THREE.Mesh(propellerGeometry, propellerMaterial);
  propeller1.visible = false;
  group.add(propeller1);
  const propeller2 = new THREE.Mesh(propellerGeometry, propellerMaterial);
  propeller2.visible = false;
  group.add(propeller2);
  const propeller3 = new THREE.Mesh(propellerGeometry, propellerMaterial);
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
  const cabinGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.8, 16);
  const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
  cabin.rotation.x = Math.PI / 2;
  cabin.position.set(0, 0.70, -0.5);
  group.add(cabin);

  // Luz de identificação
  const idLight = new THREE.PointLight(baseColor, 1.0, 4);
  idLight.position.set(0, 1.1, -0.5);
  group.add(idLight);

  // Posicionar o avião na pista
  group.position.set(0, 0, 2);

  // ===== ÁUDIO =====
  let sound = null;
  if (scene && listener) {
    const audioListener = listener || new THREE.AudioListener();
    if (!listener) scene.add(audioListener);
    sound = new THREE.Audio(audioListener);
    const audioLoader = new THREE.AudioLoader();
    audioLoader.load('bi-motor.mp3', (buffer) => {
      sound.setBuffer(buffer);
      sound.setLoop(true);
      sound.setVolume(0.5);
      sound.play();
    });
    group.userData.sound = sound;
  } else {
    console.warn('Áudio não carregado: cena ou listener não fornecidos.');
  }

  // ===== SOMBRA =====
  let shadow = null;
  if (scene) {
    const shadowGeometry = new THREE.CircleGeometry(1.7, 32);
    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.5
    });
    shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    scene.add(shadow);
  }

  // ===== BOUNDING BOX =====
  const planeBox = new THREE.Box3().setFromObject(group);

  // ===== VARIÁVEIS DE FÍSICA =====
  let speed = 0;
  let velocity = 0;
  const maxSpeed = 0.8;
  const acceleration = 0.001;
  const friction = 0.001;
  const gravity = 0.3;
  const crashGravity = 0.9;
  const liftThreshold = 0.25;
  let isAccelerating = false;
  let isCrashed = false;
  let crashTimer = 0;
  const crashDuration = 1;
  let pitchAngle = 0;
  const maxPitchAngle = Math.PI / 6;
  const maxAltitude = 100;
  const liftFactor = 0.7;
  const pitchSpeed = 0.05;
  const baseVerticalSpeedUp = 0.045;
  const speedFactor = 0.5;
  const baseRotationSpeed = 0.010;

  function setSpeed(value) { speed = value; }
  function setVelocity(value) { velocity = value; }
  function setIsAccelerating(value) { isAccelerating = value; }
  function setIsCrashed(value) { isCrashed = value; }
  function setCrashTimer(value) { crashTimer = value; }
  function setPitchAngle(value) { pitchAngle = value; }

  // ===== MÉTODO UPDATE (ROTAÇÃO DA HÉLICE) =====
  function update(frame, speedInput) {
    const rotSpeed = 0.2 + (speedInput || speed || 0);
    propeller.rotation.z += rotSpeed * 2;
  }

  // ===== OBJETO RETORNADO =====
  return {
    group,
    propeller,
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
    setSpeed,
    setVelocity,
    setIsAccelerating,
    setIsCrashed,
    setCrashTimer,
    setPitchAngle,
    update,
    idLight,
    // Agora o jogo consegue alterar a cor de ambos os materiais separadamente
    colorable: ['bodyMat', 'wingMat']
  };
};