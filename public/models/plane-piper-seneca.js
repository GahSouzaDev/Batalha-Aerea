// ============================================================
// CONSTRUTOR DO AVIÃO PIPER SENECA (seneca)
// Bimotor leve, asa baixa e trem de pouso triciclo
// ============================================================
PLANE_BUILDERS.seneca = function (colorHex, options = {}) {
  // ===== OBTENDO CENA E LISTENER =====
  const scene = options.scene || (typeof window !== 'undefined' && window.scene);
  const listener = options.listener || (typeof window !== 'undefined' && window.listener);

  // ===== GRUPO PRINCIPAL =====
  const group = new THREE.Group();

  // ===== ESCALA =====
  const SCALE = 0.9; 

  // ============================================================
  // MATERIAIS COM TEXTURAS (ASAS E CORPO SEPARADOS)
  // ============================================================
  // Cor base padrão (Branco gelo se o jogador não escolher nenhuma)
  const baseColor = colorHex || 0xEEEEEE; 

  const useTexture = !colorHex || colorHex === 0xffffff;
  let wingMat, bodyMat;

  if (useTexture) {
    const loader = new THREE.TextureLoader();
    // Texturas independentes para asa e corpo
    const wingTexture = loader.load('img/seneca_wing.png');
    const bodyTexture = loader.load('img/seneca_body.png');

    wingMat = new THREE.MeshStandardMaterial({ 
      map: wingTexture, 
      roughness: 0.7, 
      metalness: 0.1 
    });
    bodyMat = new THREE.MeshStandardMaterial({ 
      map: bodyTexture, 
      roughness: 0.7, 
      metalness: 0.1 
    });
  } else {
    // Fallback para cor sólida
    wingMat = new THREE.MeshStandardMaterial({ 
      color: baseColor, 
      roughness: 0.7, 
      metalness: 0.1 
    });
    bodyMat = new THREE.MeshStandardMaterial({ 
      color: baseColor, 
      roughness: 0.7, 
      metalness: 0.1 
    });
  }

  // ===== MATERIAIS SÓLIDOS =====
  const metalMat = new THREE.MeshStandardMaterial({ 
    color: 0x444444, roughness: 0.3, metalness: 0.9 
  });
  const engineMat = new THREE.MeshStandardMaterial({ 
    color: 0x222222, roughness: 0.5, metalness: 0.6 
  });
  const woodMat = new THREE.MeshStandardMaterial({ 
    color: 0x8B5A2B, roughness: 0.6, metalness: 0 
  });
  const cockpitMat = new THREE.MeshStandardMaterial({ 
    color: 0x111111, roughness: 0.9, metalness: 0 
  });
  const glassMat = new THREE.MeshStandardMaterial({ 
    color: 0x87CEEB, transparent: true, opacity: 0.4, roughness: 0.1, metalness: 0 
  });
  const wheelMat = new THREE.MeshStandardMaterial({ 
    color: 0x111111 
  });
  const strutMat = new THREE.MeshStandardMaterial({ 
    color: 0x333333 
  });

  // ============================================================
  // CONSTRUÇÃO DO SENECA
  // ============================================================

  // --- 1. Fuselagem e Nariz (CORPO - usa bodyMat) ---
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.35, 4.8, 16), bodyMat);
  body.rotation.x = Math.PI / 2;
  body.position.set(0, 0.8, 0.0);
  group.add(body);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16), bodyMat);
  nose.position.set(0, 0.8, -2.4);
  group.add(nose);

  // --- 2. Cabine e Janelas (vidros) ---
  // Para-brisa frontal
  const windshield = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), glassMat);
  windshield.position.set(0, 0.8, -2.3);
  windshield.rotation.x = 45;
 
  group.add(windshield);

  // Janelas laterais
  for (let x of [-0.28, 0.28]) { // Lado esquerdo e direito
    for (let z of [-1.0, -0.2, 0.6]) {
      const windowMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.25), glassMat);
      windowMesh.position.set(x, 0.8, z);
      windowMesh.rotation.y = (x < 0) ? -Math.PI / 2 : Math.PI / 2;
      group.add(windowMesh);
    }
  }

  // --- 3. Asas Principais (ASAS - usa wingMat) ---
  // Asa única atravessando a fuselagem (asa baixa)
  const mainWing = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.05, 1.8), wingMat);
  mainWing.position.set(0, 0.55, -0.2);
  group.add(mainWing);

  // --- 4. Motores e Nacelas (Bimotor) ---
  function addNacelle(x) {
    const nacelleGroup = new THREE.Group();
    nacelleGroup.position.set(x, 0.55, -0.2);

    // Corpo da nacela (carena)
    const cowling = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.8, 12), bodyMat);
    cowling.position.set(0, 0, -0.8);
    cowling.rotation.x = Math.PI / 2;
    nacelleGroup.add(cowling);

    // Cone frontal da nacela (onde fica a hélice)
    const cone = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), engineMat);
    cone.position.set(0, 0, -0.4);
    nacelleGroup.add(cone);

    // Parte de trás do motor
    const back = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.1, 0.3, 12), metalMat);
    back.rotation.x = Math.PI / 2;
    back.position.set(0, 0, -1.3);
    nacelleGroup.add(back);

    group.add(nacelleGroup);
    return nacelleGroup;
  }
  const nacelleLeft = addNacelle(-1.2);
  const nacelleRight = addNacelle(1.2);

  // --- 5. Hélices (Tractor - na frente dos motores) ---
  function addPropeller(x) {
    const propGroup = new THREE.Group();
    propGroup.position.set(x, 0.55, -1.6);
    
    // Cubo da hélice
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 16), metalMat);
    hub.rotation.x = Math.PI / 2;
    propGroup.add(hub);

    // Pás de madeira
    const bladeGeo = new THREE.BoxGeometry(0.1, 0.95, 0.03);
    const blade1 = new THREE.Mesh(bladeGeo, woodMat);
    blade1.rotation.z = 0.2; 
    propGroup.add(blade1);
    
    const blade2 = new THREE.Mesh(bladeGeo, woodMat);
    blade2.rotation.z = Math.PI + 0.2; 
    propGroup.add(blade2);

    group.add(propGroup);
    return propGroup;
  }
  const propLeft = addPropeller(-1.2);
  const propRight = addPropeller(1.2);

  // --- 6. Cauda Traseira (CORPO - usa bodyMat) ---
  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 0.8, 2.4);
  // Estabilizador Vertical
  const vStab = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.6, 0.5), bodyMat);
  vStab.position.set(0, 0.3, 0);
  tailGroup.add(vStab);
  // Estabilizador Horizontal
  const hStab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.04, 0.5), bodyMat);
  hStab.position.set(0, 0, 0);
  tailGroup.add(hStab);
  group.add(tailGroup);

  // --- 7. Trem de Pouso (Triciclo) ---
  // Roda do Nariz
  const noseStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6), strutMat);
  noseStrut.position.set(0, 0.3, -2.2);
  group.add(noseStrut);
  const noseWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 12), wheelMat);
  noseWheel.rotation.z = Math.PI / 2;
  noseWheel.position.set(0, 0.05, -2.2);
  group.add(noseWheel);

  // Rodas Principais (sob as asas)
  function addMainWheel(x, z) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 6), strutMat);
    strut.position.set(x, 0.3, z);
    strut.rotation.z = (x > 0) ? 0.15 : -0.15;
    group.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 12), wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.05, z);
    group.add(wheel);
  }
  addMainWheel(-1.2, -0.2);
  addMainWheel(1.2, -0.2);

  // ===== ALINHAMENTO NA PISTA E ESCALA FINAL =====
  group.position.set(0, -0.2, 2);
  group.scale.set(SCALE, SCALE, SCALE);

  // ============================================================
  // SOMBRA E ÁUDIO
  // ============================================================
  let shadow = null;
  if (scene) {
    const shadowGeometry = new THREE.CircleGeometry(4.0 * SCALE, 32);
    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.5
    });
    shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    scene.add(shadow);
  }

  let sound = null;
  if (scene && listener) {
    const audioListener = listener || new THREE.AudioListener();
    if (!listener) scene.add(audioListener);
    sound = new THREE.Audio(audioListener);
    const audioLoader = new THREE.AudioLoader();
    audioLoader.load('Cessna sound effect _ Enjoy!.mp3', (buffer) => {
      sound.setBuffer(buffer);
      sound.setLoop(true);
      sound.setVolume(0.01);
      sound.setSpeed(200);
      sound.play();
    });
    group.userData.sound = sound;
  }

  // ============================================================
  // BOUNDING BOX E FÍSICA
  // ============================================================
  const planeBox = new THREE.Box3().setFromObject(group);

  let speed = 0, velocity = 0;
  // Seneca é um pouco mais rápido por ser bimotor
  const maxSpeed = 1.1, acceleration = 0.001, friction = 0.001;
  const gravity = 0.3, crashGravity = 0.9, liftThreshold = 0.40;
  let isAccelerating = false, isCrashed = false, crashTimer = 0;
  const crashDuration = 1, pitchAngle = 0, maxPitchAngle = Math.PI / 4;
  const maxAltitude = 120, liftFactor = 0.2, pitchSpeed = 0.04;
  const baseVerticalSpeedUp = 0.050, speedFactor = 0.2, ai = 0.8;
  const baseRotationSpeed = 0.05;
  const inclinaBoing = -0.3, inclinaBoing2 = 0.3, inclina = -0.5, inclina2 = 0.8;

  function setSpeed(value) { speed = value; }
  function setVelocity(value) { velocity = value; }
  function setIsAccelerating(value) { isAccelerating = value; }
  function setIsCrashed(value) { isCrashed = value; }
  function setCrashTimer(value) { crashTimer = value; }
  function setPitchAngle(value) { pitchAngle = value; }

  // ============================================================
  // MÉTODO UPDATE (Gira as DUAS hélices no eixo Z)
  // ============================================================
  function update(frame, speedInput) {
    const rotSpeed = 0.1 + (speedInput || speed || 0) * 2;
    // Rotaciona as pás e o cubo do motor esquerdo
    propLeft.children[0].rotation.z += rotSpeed; // hub
    propLeft.children[1].rotation.z += rotSpeed * 3; // blade1
    propLeft.children[2].rotation.z += rotSpeed * 3; // blade2

    // Rotaciona as pás e o cubo do motor direito
    propRight.children[0].rotation.z += rotSpeed;
    propRight.children[1].rotation.z += rotSpeed * 3;
    propRight.children[2].rotation.z += rotSpeed * 3;
  }

  // ============================================================
  // OBJETO RETORNADO
  // ============================================================
  return {
    group,
    mainWing, nacelleLeft, nacelleRight, propLeft, propRight, tailGroup,
    shadow, planeBox, sound,
    speed, velocity, maxSpeed, acceleration, friction, gravity, crashGravity, 
    liftThreshold, isAccelerating, isCrashed, crashTimer, crashDuration,
    pitchAngle, maxPitchAngle, maxAltitude, liftFactor, pitchSpeed,
    baseVerticalSpeedUp, baseRotationSpeed, inclinaBoing2, inclinaBoing,
    inclina2, inclina, speedFactor, ai,
    setSpeed, setVelocity, setIsAccelerating, setIsCrashed, setCrashTimer, setPitchAngle,
    update,
    idLight: null,
    colorable: ['wingMat', 'bodyMat'] 
  };
};