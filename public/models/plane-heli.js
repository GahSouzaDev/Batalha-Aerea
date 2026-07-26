PLANE_BUILDERS.heli = function (colorHex, options = {}) {
  // ===== OBTENDO CENA E LISTENER (GLOBAL OU PASSADO) =====
  const scene = options.scene || (typeof window !== 'undefined' && window.scene);
  const listener = options.listener || (typeof window !== 'undefined' && window.listener);

  // ===== GRUPO PRINCIPAL =====
  const group = new THREE.Group();

  // ============================================================
  // MATERIAIS COM TEXTURAS SEPARADAS (CORPO E CAUDA)
  // ============================================================
  const useTexture = !colorHex || colorHex === 0xffffff;
  const baseColor = colorHex || 0xffffff;

  let bodyMat, tailMat;
  if (useTexture) {
    const bodyTexture = new THREE.TextureLoader().load('img/heli_body.png');
    const tailTexture = new THREE.TextureLoader().load('img/heli_tail.png');
    bodyMat = new THREE.MeshStandardMaterial({ map: bodyTexture, roughness: 0.55, metalness: 0.25 });
    tailMat = new THREE.MeshStandardMaterial({ map: tailTexture, roughness: 0.55, metalness: 0.25 });
  } else {
    bodyMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.55, metalness: 0.25 });
    tailMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.55, metalness: 0.25 });
  }

  const gearMaterial   = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
  const detailMaterial = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.6 });
  const cabinGlassMat  = new THREE.MeshStandardMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0 });
  const sideGlassMat   = new THREE.MeshStandardMaterial({ color: 0x1a2a33, transparent: true, opacity: 0.75, roughness: 0.15, metalness: 0.1 });
  const rotorMaterial  = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const hubMaterial    = new THREE.MeshStandardMaterial({ color: 0x2f2f2f, roughness: 0.4, metalness: 0.7 });
  const bladeBlurMaterial = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0, side: THREE.DoubleSide });

  // ============================================================
  // CONSTRUÇÃO DO HELICÓPTERO
  // ============================================================
  // Convenção do arquivo: frente do veículo = Z negativo, cauda = Z positivo.

  // --- 1. CABINE (corpo principal, peça própria) ---
  const cabinBodyGeometry = new THREE.CylinderGeometry(0.36, 0.42, 2.0, 20);
  const cabinBody = new THREE.Mesh(cabinBodyGeometry, bodyMat);
  cabinBody.rotation.x = Math.PI / 2;
  cabinBody.position.set(0, 0.55, -0.6);
  group.add(cabinBody);

  // Calota do nariz (arredonda a ponta da frente da cabine)
  const noseCapGeometry = new THREE.SphereGeometry(0.36, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const noseCap = new THREE.Mesh(noseCapGeometry, bodyMat);
  noseCap.rotation.x = Math.PI / 2;
  noseCap.position.set(0, 0.55, -1.6);
  group.add(noseCap);

  // Bolha da cabine (vidro frontal / pára-brisa)
  const cockpitGeometry = new THREE.SphereGeometry(0.34, 20, 16);
  const cockpit = new THREE.Mesh(cockpitGeometry, cabinGlassMat);
  cockpit.scale.set(1, 0.85, 1.05);
  cockpit.position.set(0, 0.58, -1.65);
  group.add(cockpit);

  // Janelas laterais da cabine (vidro escurecido, uma de cada lado)
  const sideWindowGeometry = new THREE.PlaneGeometry(0.55, 0.32);
  const windowL = new THREE.Mesh(sideWindowGeometry, sideGlassMat);
  windowL.rotation.y = Math.PI / 2;
  windowL.position.set(0.375, 0.6, -0.45);
  group.add(windowL);
  const windowR = new THREE.Mesh(sideWindowGeometry, sideGlassMat);
  windowR.rotation.y = -Math.PI / 2;
  windowR.position.set(-0.375, 0.6, -0.45);
  group.add(windowR);

  // --- 2. DOMO DO MOTOR (atrás da cabine, embaixo do mastro) ---
  const engineDeckGeometry = new THREE.BoxGeometry(0.55, 0.28, 1.0);
  const engineDeck = new THREE.Mesh(engineDeckGeometry, bodyMat);
  engineDeck.position.set(0, 0.95, 0.05);
  group.add(engineDeck);

  const intakeGeometry = new THREE.CylinderGeometry(0.11, 0.13, 0.18, 10);
  const intakeL = new THREE.Mesh(intakeGeometry, detailMaterial);
  intakeL.position.set(-0.18, 1.1, -0.25);
  group.add(intakeL);
  const intakeR = new THREE.Mesh(intakeGeometry, detailMaterial);
  intakeR.position.set(0.18, 1.1, -0.25);
  group.add(intakeR);

  // Escapamentos do motor
  const exhaustGeometry = new THREE.CylinderGeometry(0.05, 0.06, 0.35, 10);
  const exhaustL = new THREE.Mesh(exhaustGeometry, detailMaterial);
  exhaustL.rotation.x = Math.PI / 2.6;
  exhaustL.position.set(-0.2, 0.85, 0.55);
  group.add(exhaustL);
  const exhaustR = new THREE.Mesh(exhaustGeometry, detailMaterial);
  exhaustR.rotation.x = Math.PI / 2.6;
  exhaustR.position.set(0.2, 0.85, 0.55);
  group.add(exhaustR);

  // --- 3. BOOM DA CAUDA (peça separada da cabine) ---
  const tailBoomGeometry = new THREE.CylinderGeometry(0.09, 0.17, 2.7, 16);
  const tailBoom = new THREE.Mesh(tailBoomGeometry, tailMat);
  tailBoom.rotation.x = Math.PI / 2;
  tailBoom.position.set(0, 0.65, 1.75);
  group.add(tailBoom);

  // Caixa de engrenagem do rotor de cauda (ponta do boom)
  const tailGearboxGeometry = new THREE.BoxGeometry(0.18, 0.22, 0.3);
  const tailGearbox = new THREE.Mesh(tailGearboxGeometry, tailMat);
  tailGearbox.position.set(0, 0.72, 3.05);
  group.add(tailGearbox);

  // Estabilizador vertical (aleta traseira, levemente inclinada para trás)
  const tailFinGeometry = new THREE.BoxGeometry(0.07, 0.6, 0.42);
  const tailFin = new THREE.Mesh(tailFinGeometry, tailMat);
  tailFin.position.set(0, 0.95, 2.95);
  tailFin.rotation.x = -0.18; // inclinação sutil para trás
  group.add(tailFin);

  // Estabilizador horizontal com pontas verticais nas quinas (tipo Black Hawk)
  const tailPlaneGeometry = new THREE.BoxGeometry(1.0, 0.06, 0.28);
  const tailPlane = new THREE.Mesh(tailPlaneGeometry, tailMat);
  tailPlane.position.set(0, 0.55, 2.55);
  group.add(tailPlane);

  const tailPlaneTipGeometry = new THREE.BoxGeometry(0.06, 0.3, 0.28);
  const tailPlaneTipL = new THREE.Mesh(tailPlaneTipGeometry, tailMat);
  tailPlaneTipL.position.set(-0.5, 0.55, 2.55);
  group.add(tailPlaneTipL);
  const tailPlaneTipR = new THREE.Mesh(tailPlaneTipGeometry, tailMat);
  tailPlaneTipR.position.set(0.5, 0.55, 2.55);
  group.add(tailPlaneTipR);

  // --- 4. ANTENA (sensor sob o nariz) ---
  const antennaGeometry = new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6);
  const antenna = new THREE.Mesh(antennaGeometry, detailMaterial);
  antenna.position.set(0, 0.2, -1.5);
  group.add(antenna);

  // --- 5. TREM DE POUSO (patins/skids) ---
  const skidGeometry = new THREE.CylinderGeometry(0.045, 0.045, 0.7, 10);
  const leftSkid = new THREE.Mesh(skidGeometry, gearMaterial);
  leftSkid.rotation.z = Math.PI / 2;
  leftSkid.position.set(0, -0.075, -0.8);
  group.add(leftSkid);

  const rightSkid = new THREE.Mesh(skidGeometry, gearMaterial);
  rightSkid.rotation.z = Math.PI / 2;
  rightSkid.position.set(0, -0.075, -0.1);
  group.add(rightSkid);

  const strutGeometry = new THREE.BoxGeometry(0.045, 0.5, 0.045);
  function addStrut(x, z) {
    const strut = new THREE.Mesh(strutGeometry, gearMaterial);
    strut.position.set(x, 0.13, z);
    
    group.add(strut);
  }
  addStrut(-0.3, -1.1);
  addStrut(0.3, -1.1);
  addStrut(0.3, 0);
  addStrut(-0.3, 0);

  // Barra de reforço entre os patins (cross-brace, detalhe estrutural)
  const braceGeometry = new THREE.CylinderGeometry(0.025, 0.025, 1.5, 8);
  const braceFront = new THREE.Mesh(braceGeometry, gearMaterial);
  braceFront.rotation.x = Math.PI / 2;
  braceFront.position.set(0.35, -0.075, -0.5);
  group.add(braceFront);
  const braceRear = new THREE.Mesh(braceGeometry, gearMaterial);
  braceRear.rotation.x = Math.PI / 2;
  braceRear.position.set(-0.35, -0.075, -0.5);
  group.add(braceRear);

  // ============================================================
  // ROTOR PRINCIPAL — cubo + 4 pás individuais com raiz de fixação
  // ============================================================
  const mastGeometry = new THREE.CylinderGeometry(0.055, 0.065, 0.55, 10);
  const mast = new THREE.Mesh(mastGeometry, detailMaterial);
  mast.position.set(0, 1.35, 0.05);
  group.add(mast);

  const hubGeometry = new THREE.CylinderGeometry(0.16, 0.18, 0.16, 12);
  const hub = new THREE.Mesh(hubGeometry, hubMaterial);
  hub.position.set(0, 1.65, 0.05);
  group.add(hub);

  const hubCapGeometry = new THREE.ConeGeometry(0.08, 0.14, 10);
  const hubCap = new THREE.Mesh(hubCapGeometry, hubMaterial);
  hubCap.position.set(0, 1.78, 0.05);
  group.add(hubCap);

  const mainRotorGroup = new THREE.Group();
  mainRotorGroup.position.set(0, 1.72, 0.05);
  group.add(mainRotorGroup);

  const mainBladeGeometry = new THREE.BoxGeometry(0.09, 3, 0.1);
  const mainBladeRootGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8);
  const mainBlades = [];
  for (let i = 0; i < 4; i++) {
    const bladeGroup = new THREE.Group();
    bladeGroup.rotation.y = (Math.PI / 2) * i; // 4 pás a 90° uma da outra

    const root = new THREE.Mesh(mainBladeRootGeometry, hubMaterial);
    root.rotation.z = Math.PI / 2;
    root.position.set(0.18, 0, 0);
    bladeGroup.add(root);

    const blade = new THREE.Mesh(mainBladeGeometry, rotorMaterial);
    blade.rotation.z = Math.PI / 2; // deita a pá na horizontal, saindo do cubo
    blade.position.set(0.18 + 0.725, 0, 0);
    bladeGroup.add(blade);

    mainRotorGroup.add(bladeGroup);
    mainBlades.push(bladeGroup);
  }

  // Disco de desfoque (aparece quando o rotor gira rápido)
  const bladeBlur = new THREE.Mesh(new THREE.CircleGeometry(2.3, 32), bladeBlurMaterial);
  bladeBlur.rotation.x = -Math.PI / 2;
  bladeBlur.position.set(0, 1.85, 0);
  group.add(bladeBlur);

  // ============================================================
  // ROTOR DE CAUDA — cubo pequeno + 2 pás, de lado na caixa de engrenagem
  // ============================================================
  const tailHubGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.05, 10);
  const tailHub = new THREE.Mesh(tailHubGeometry, hubMaterial);
  tailHub.rotation.z = Math.PI / 2;
  tailHub.position.set(0.1, 0.72, 3.12);
  group.add(tailHub);

  const tailRotorGroup = new THREE.Group();
  tailRotorGroup.rotation.y = Math.PI / 2; // vira o disco de lado
  tailRotorGroup.position.set(0.1, 0.72, 3.12);
  group.add(tailRotorGroup);

  const tailBladeGeometry = new THREE.BoxGeometry(0.045, 0.55, 0.06);
  const tailBladeA = new THREE.Mesh(tailBladeGeometry, rotorMaterial);
  tailBladeA.position.set(0, 0.28, 0);
  tailRotorGroup.add(tailBladeA);

  const tailBladeB = new THREE.Mesh(tailBladeGeometry, rotorMaterial);
  tailBladeB.rotation.z = Math.PI / 2;
  tailBladeB.position.set(0.28, 0, 0);
  tailRotorGroup.add(tailBladeB);

  // Referências mantidas por compatibilidade com o restante do jogo
  const propeller = mainRotorGroup;
  const propeller1 = tailRotorGroup;
  const propeller2 = new THREE.Mesh(mainBladeGeometry, rotorMaterial);
  propeller2.visible = false;
  group.add(propeller2);
  const propeller3 = new THREE.Mesh(tailBladeGeometry, rotorMaterial);
  propeller3.visible = false;
  group.add(propeller3);

  // Luz de identificação
  const idLight = new THREE.PointLight(baseColor, 1.0, 4);
  idLight.position.set(0, 1.1, 0.05);
  group.add(idLight);

  // Posicionar o helicóptero na pista
  group.position.set(0, 0, 2);

  // ===== ÁUDIO =====
  let sound = null;
  if (scene && listener) {
    const audioListener = listener || new THREE.AudioListener();
    if (!listener) scene.add(audioListener);
    sound = new THREE.Audio(audioListener);
    const audioLoader = new THREE.AudioLoader();
    const soundFile = options.sound || 'heli.mp3';
    audioLoader.load(soundFile, (buffer) => {
      sound.setBuffer(buffer);
      sound.setLoop(true);
      sound.setVolume(0.3);
      sound.play();
    });
    group.userData.sound = sound;
  } else {
    console.warn('Áudio não carregado: cena ou listener não fornecidos.');
  }

  // ===== SOMBRA =====
  let shadow = null;
  if (scene) {
    const shadowGeometry = new THREE.CircleGeometry(2.1, 32);
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
  const maxSpeed = 0.9;
  const acceleration = 0.001;
  const friction = 0.0012;
  const gravity = 0.25;
  const crashGravity = 0.9;
  const liftThreshold = 0.15; // helicóptero levanta voo com pouca velocidade
  let isAccelerating = false;
  let isCrashed = false;
  let crashTimer = 0;
  const crashDuration = 1;
  let pitchAngle = 0;
  const maxPitchAngle = Math.PI / 8;
  const maxAltitude = 100;
  const liftFactor = 0.9;
  const pitchSpeed = 0.04;
  const baseVerticalSpeedUp = 0.05;
  const speedFactor = 0.4;
  const baseRotationSpeed = 0.02;

  function setSpeed(value) { speed = value; }
  function setVelocity(value) { velocity = value; }
  function setIsAccelerating(value) { isAccelerating = value; }
  function setIsCrashed(value) { isCrashed = value; }
  function setCrashTimer(value) { crashTimer = value; }
  function setPitchAngle(value) { pitchAngle = value; }

  // ===== MÉTODO UPDATE (ROTORES) =====
  function update(frame, speedInput) {
    const currentSpeed = speedInput || speed || 0;

    // Rotor principal: sempre girando (nunca para, mesmo parado no chão),
    // mais rápido conforme a velocidade/aceleração.
    const mainRotSpeed = 0.6 + currentSpeed * 3;
    mainRotorGroup.rotation.y += mainRotSpeed;

    // Rotor de cauda: gira em torno do eixo X porque o disco está de lado.
    const tailRotSpeed = 1.0 + currentSpeed * 4;
    tailRotorGroup.rotation.x += tailRotSpeed;

    // Disco de desfoque aparece conforme o rotor acelera
    bladeBlur.material.opacity = Math.min(0.35, mainRotSpeed * 0.12);
  }

  // ===== OBJETO RETORNADO =====
  return {
    group,
    propeller,
    propeller1,
    propeller2,
    propeller3,
    mainRotorGroup,
    tailRotorGroup,
    mainBlades,
    hub,
    bladeBlur,
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
    colorable: ['bodyMat', 'tailMat']
  };
};