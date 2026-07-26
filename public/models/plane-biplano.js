// ============================================================
// CONSTRUTOR DO AVIÃO HILSON BI-MONO (biplano)
// Baseado em um caça biplano clássico com motor em linha
// ============================================================
PLANE_BUILDERS.biplano = function (colorHex, options = {}) {
  // ===== OBTENDO CENA E LISTENER =====
  const scene = options.scene || (typeof window !== 'undefined' && window.scene);
  const listener = options.listener || (typeof window !== 'undefined' && window.listener);

  // ===== GRUPO PRINCIPAL =====
  const group = new THREE.Group();

  // ===== ESCALA =====
  const SCALE = 0.7; 

  // ============================================================
  // MATERIAIS COM TEXTURAS (ASAS E CORPO SEPARADOS)
  // ============================================================
  const baseColor = colorHex || 0x4F5D55; 

  // Verifica se deve usar textura ou cor sólida (padrão do seu jogo)
  const useTexture = !colorHex || colorHex === 0xffffff;
  let wingMat, bodyMat;

  if (useTexture) {
    const loader = new THREE.TextureLoader();
    // Carrega as duas texturas separadas (coloque seus arquivos .png na pasta img)
    const wingTexture = loader.load('img/biplano_wing.png');
    const bodyTexture = loader.load('img/biplano_body.png');

    wingMat = new THREE.MeshStandardMaterial({ 
      map: wingTexture, 
      roughness: 0.8, 
      metalness: 0.1 
    });
    bodyMat = new THREE.MeshStandardMaterial({ 
      map: bodyTexture, 
      roughness: 0.8, 
      metalness: 0.1 
    });
  } else {
    // Se for cor sólida, ambos usam a mesma cor base
    wingMat = new THREE.MeshStandardMaterial({ 
      color: baseColor, 
      roughness: 0.8, 
      metalness: 0.1 
    });
    bodyMat = new THREE.MeshStandardMaterial({ 
      color: baseColor, 
      roughness: 0.8, 
      metalness: 0.1 
    });
  }

  // ===== MATERIAIS SÓLIDOS (SUPORTES, HÉLICE, ETC) =====
  const metalMat = new THREE.MeshStandardMaterial({ 
    color: 0x555555, roughness: 0.4, metalness: 0.7 
  });
  const woodMat = new THREE.MeshStandardMaterial({ 
    color: 0x8B5A2B, roughness: 0.6, metalness: 0 
  });
  const cockpitMat = new THREE.MeshStandardMaterial({ 
    color: 0x222222, roughness: 0.9, metalness: 0 
  });
  const glassMat = new THREE.MeshStandardMaterial({ 
    color: 0x87CEEB, transparent: true, opacity: 0.3, roughness: 0.1, metalness: 0 
  });
  const wheelMat = new THREE.MeshStandardMaterial({ 
    color: 0x111111 
  });
  const strutMat = new THREE.MeshStandardMaterial({ 
    color: 0x444444 
  });

  // ============================================================
  // CONSTRUÇÃO DO BIPLANO
  // ============================================================

  // --- 1. Fuselagem (CORPO - usa bodyMat) ---
  const bodyGeo = new THREE.CylinderGeometry(0.15, 0.35, 4.0, 16);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.rotation.x = Math.PI / 2;
  body.position.set(0, 0.8, 0.2);
  group.add(body);

  // Cone/Nariz (CORPO - usa bodyMat)
  const noseGeo = new THREE.SphereGeometry(0.35, 16, 16);
  const nose = new THREE.Mesh(noseGeo, bodyMat);
  nose.position.set(0, 0.8, -1.8);
  group.add(nose);

  // --- 2. Cockpit ---
  for (let z of [-0.3, 0.7]) {
    const seatBack = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.15, 8), cockpitMat);
    seatBack.position.set(0, 1, z);
    group.add(seatBack);
  }
  const windshield = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), glassMat);
  windshield.position.set(0, 1.1, -1.0);
  windshield.rotation.y = 0;
  group.add(windshield);

  // --- 3. Asas (ASAS - usa wingMat) ---
  // Asa Superior
  const upperWing = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.06, 1.5), wingMat);
  upperWing.position.set(0, 1.7, -0.7);
  group.add(upperWing);

  // Asa Inferior
  const lowerWing = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.06, 1.2), wingMat);
  lowerWing.position.set(0, 0.6, -0.5);
  group.add(lowerWing);

  // --- 4. Montantes (Suportes das asas) ---
  for (let x of [-2.0, -0.8, 0.8, 2.0]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6), strutMat);
    strut.position.set(x, 1.15, -0.7);
    strut.rotation.z = 0.5;
    group.add(strut);
    const diag = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6), strutMat);
    diag.position.set(x, 1.15, -0.7);
    diag.rotation.z = -0.5;
    group.add(diag);
  }

  function addCable(x1, y1, z1, x2, y2, z2) {
    const start = new THREE.Vector3(x1, y1, z1);
    const end = new THREE.Vector3(x2, y2, z2);
    const dir = new THREE.Vector3().subVectors(end, start);
    const len = dir.length();
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const cable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.005, len, 4),
      new THREE.MeshBasicMaterial({ color: 0x888888 })
    );
    cable.position.copy(mid);
    cable.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    group.add(cable);
  }
  for (let x of [-2.0, -0.8, 0.8, 2.0]) {
    addCable(x, 1.7, -1.2, x, 0.6, 0);
    addCable(x, 1.7, 0, x, 0.6, -1);
  }

  // --- 5. Motor e Escapamentos ---
  for (let x of [-0.35, 0.35]) {
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.2, 6), metalMat);
    exhaust.position.set(x, 1, -1.6);
    group.add(exhaust);
  }

  // --- 6. Hélice ---
  const propGroup = new THREE.Group();
  propGroup.position.set(0, 0.8, -2.2);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 16), metalMat);
  hub.rotation.z = Math.PI / 2;
  propGroup.add(hub);

  const bladeGeo = new THREE.BoxGeometry(0.12, 1.6, 0.03);
  const blade1 = new THREE.Mesh(bladeGeo, woodMat);
  blade1.rotation.z = 0.15; 
  propGroup.add(blade1);
  const blade2 = new THREE.Mesh(bladeGeo, woodMat);
  blade2.rotation.z = Math.PI + 0.15; 
  propGroup.add(blade2);
  group.add(propGroup);

  // --- 7. Cauda Traseira (CORPO - usa bodyMat) ---
  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 0.8, 2.2);
  const vStab = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.7, 0.5), bodyMat);
  vStab.position.set(0, 0.35, 0);
  tailGroup.add(vStab);
  const hStab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.04, 0.5), bodyMat);
  hStab.position.set(0, 0, 0);
  tailGroup.add(hStab);
  group.add(tailGroup);

  // --- 8. Trem de Pouso ---
  function addWheel(x, z) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.5, 6), metalMat);
    strut.position.set(x, 0.4, z);
    strut.rotation.z = (x > 0) ? 0.1 : -0.1;
    group.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 12), wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.15, z);
    group.add(wheel);
  }
  addWheel(-0.8, -0.8);
  addWheel(0.8, -0.8);

  const tailStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), metalMat);
  tailStrut.position.set(0, 0.5, 2.2);
  group.add(tailStrut);
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 12), wheelMat);
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, 0.3, 2.2);
  group.add(tailWheel);

  // ===== ALINHAMENTO NA PISTA E ESCALA FINAL =====
  group.position.set(0, -0.2, 2);
  group.scale.set(SCALE, SCALE, SCALE);

  // ============================================================
  // SOMBRA E ÁUDIO
  // ============================================================
  let shadow = null;
  if (scene) {
    const shadowGeometry = new THREE.CircleGeometry(3.5 * SCALE, 32);
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
  const maxSpeed = 0.95, acceleration = 0.001, friction = 0.001;
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
  // MÉTODO UPDATE
  // ============================================================
  function update(frame, speedInput) {
    const rotSpeed = 0.1 + (speedInput || speed || 0) * 2;
    blade1.rotation.z += rotSpeed * 3;
    blade2.rotation.z += rotSpeed * 3;
    hub.rotation.z += rotSpeed;
  }

  // ============================================================
  // OBJETO RETORNADO
  // ============================================================
  return {
    group,
    upperWing, lowerWing, 
    propGroup, tailGroup,
    shadow, planeBox, sound,
    speed, velocity, maxSpeed, acceleration, friction, gravity, crashGravity, 
    liftThreshold, isAccelerating, isCrashed, crashTimer, crashDuration,
    pitchAngle, maxPitchAngle, maxAltitude, liftFactor, pitchSpeed,
    baseVerticalSpeedUp, baseRotationSpeed, inclinaBoing2, inclinaBoing,
    inclina2, inclina, speedFactor, ai,
    setSpeed, setVelocity, setIsAccelerating, setIsCrashed, setCrashTimer, setPitchAngle,
    update,
    idLight: null,
    // Agora o sistema do jogo consegue acessar ambos os materiais para mudar cor
    colorable: ['wingMat', 'bodyMat'] 
  };
};