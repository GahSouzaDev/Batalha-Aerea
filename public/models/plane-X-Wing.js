// ============================================================
// CONSTRUTOR DO AVIÃO X-WING (xwing)
// Caça estelar clássico com asas em "X" (S-foils abertas)
// ============================================================
PLANE_BUILDERS.xwing = function (colorHex, options = {}) {
  // ===== OBTENDO CENA E LISTENER =====
  const scene = options.scene || (typeof window !== 'undefined' && window.scene);
  const listener = options.listener || (typeof window !== 'undefined' && window.listener);

  // ===== GRUPO PRINCIPAL =====
  const group = new THREE.Group();

  // ===== ESCALA =====
  const SCALE = 2;

  // ============================================================
  // MATERIAIS COM TEXTURAS (ASAS E CORPO SEPARADOS)
  // ============================================================
  const baseColor = colorHex || 0xEEEEEE;

  const useTexture = !colorHex || colorHex === 0xffffff;
  let wingMat, bodyMat;

  if (useTexture) {
    const loader = new THREE.TextureLoader();
    const wingTexture = loader.load('img/xwing_wing.png');
    const bodyTexture = loader.load('img/xwing_body.png');

    wingMat = new THREE.MeshStandardMaterial({ map: wingTexture, roughness: 0.55, metalness: 0.35 });
    bodyMat = new THREE.MeshStandardMaterial({ map: bodyTexture, roughness: 0.55, metalness: 0.35 });
  } else {
    wingMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.55, metalness: 0.35 });
    bodyMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.55, metalness: 0.35 });
  }

  // ===== MATERIAIS SÓLIDOS =====
  const engineMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.25, metalness: 0.9 });
  const engineRingMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.3, metalness: 0.8 });
  const cockpitMat = new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.9, metalness: 0 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x2c3a40, transparent: true, opacity: 0.55, roughness: 0.15, metalness: 0.2 });
  const gearMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  const strutMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.5, metalness: 0.6 });
  const detailMat = new THREE.MeshStandardMaterial({ color: 0xb33030, roughness: 0.5, metalness: 0.2 }); // faixas vermelhas

  // ============================================================
  // CONSTRUÇÃO DO X-WING
  // ============================================================

  // --- 1. Fuselagem central afunilada (nariz longo -> corpo -> cauda) ---
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 2.4, 10), bodyMat);
  hull.rotation.x = Math.PI / 2;
  hull.position.set(0, 0.8, 0.15);
  group.add(hull);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.1, 10), bodyMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 0.8, -1.6);
  group.add(nose);

  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.08, 0.7, 10), bodyMat);
  tail.rotation.x = Math.PI / 2;
  tail.position.set(0, 0.8, 1.75);
  group.add(tail);

  // Painel dorsal atrás da cabine (leve elevação)
  const dorsalRidge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 1.0), bodyMat);
  dorsalRidge.position.set(0, 0.98, 0.4);
  group.add(dorsalRidge);

  // --- 2. Cabine e canopy inclinada ---
  const cockpitBase = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), cockpitMat);
  cockpitBase.scale.set(1, 0.85, 1.3);
  cockpitBase.position.set(0, 0.95, -0.5);
  group.add(cockpitBase);

  const cockpitGlass = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 12), glassMat);
  cockpitGlass.scale.set(0.95, 0.8, 1.2);
  cockpitGlass.position.set(0, 1.0, -0.57);
  cockpitGlass.rotation.x = -0.12;
  group.add(cockpitGlass);

  // Painel frontal abaixo da cabine (característico do X-Wing)
  const chinPanel = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.7), bodyMat);
  chinPanel.position.set(0, 0.62, -0.45);
  group.add(chinPanel);

  // --- 3. Asas em X (pylon + S-foil + faixa de detalhe) ---
  // >>> Movidas para trás (z maior) para ficar mais próximas do meio/traseira do corpo <
  function addWingArm(x, y, z, rotZ) {
    // Pylon robusto conectando ao corpo
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.35), strutMat);
    pylon.position.set(x * 0.55, y, z);
    pylon.rotation.z = rotZ * 0.5;
    group.add(pylon);

    // Pá da asa (S-foil), comprida e fina
    const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.28), wingMat);
    wingBlade.position.set(x * 1.55, y, z);
    wingBlade.rotation.z = rotZ;
    group.add(wingBlade);

    // Faixa de detalhe (vermelha) — agora FILHA do wingBlade,
    // então herda posição/rotação corretamente (corrige o bug de posição aleatória)
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.062, 0.3), detailMat);
    stripe.position.set(x > 0 ? 0.35 : -0.35, 0, 0); // perto da ponta, no espaço local da asa
    wingBlade.add(stripe);

    return { x: x * 2.4, y, z };
  }

  // Braços: (Cima-Esquerda, Baixo-Esquerda, Cima-Direita, Baixo-Direita)
  const wingTipTL = addWingArm(0.42, 0.55, 0.55, -0.42);
  const wingTipBL = addWingArm(0.42, 1.05, 0.55, 0.42);
  const wingTipTR = addWingArm(-0.42, 0.55, 0.55, 0.42);
  const wingTipBR = addWingArm(-0.42, 1.05, 0.55, -0.42);

  // --- 4. Motores (4x) — longos e projetados à frente das asas ---
  function addEngine(x, y, z) {
    const nacelleGroup = new THREE.Group();

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 1.3, 10), engineMat);
    body.rotation.x = Math.PI / 2;
    nacelleGroup.add(body);

    // Aro frontal do motor
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.02, 8, 16), engineRingMat);
    ring.rotation.y = Math.PI / 2;
    ring.position.z = -0.66;
    nacelleGroup.add(ring);

    // Ponta de mira (targeting array), fininha, saindo da frente
    const spike = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.55, 6), engineRingMat);
    spike.rotation.x = Math.PI / 2;
    spike.position.z = -0.95;
    nacelleGroup.add(spike);

    nacelleGroup.position.set(x, y, z);
    group.add(nacelleGroup);
    return { x, y, z: z + 0.5 }; // ponto de saída do fogo (traseira do motor)
  }

  const enginePositions = [
    addEngine(wingTipTL.x, wingTipTL.y, 0.95),
    addEngine(wingTipBL.x, wingTipBL.y, 0.95),
    addEngine(wingTipTR.x, wingTipTR.y, 0.95),
    addEngine(wingTipBR.x, wingTipBR.y, 0.95)
  ];

  // --- 5. Sistema de Exaustão (FOGO - 4 motores) ---
  const fireMaterial = new THREE.PointsMaterial({
    color: 0x44aaff,
    size: 0.08,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending
  });

  function createFireGeometry() {
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array(60 * 3);
    for (let i = 0; i < 60; i++) {
      verts[i*3] = (Math.random() - 0.5) * 0.15;
      verts[i*3+1] = (Math.random() - 0.5) * 0.15;
      verts[i*3+2] = (Math.random() - 0.5) * 0.5;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    return geo;
  }

  const fireParticles = enginePositions.map(pos => {
    const points = new THREE.Points(createFireGeometry(), fireMaterial);
    points.position.set(pos.x, pos.y, pos.z + 0.65);
    group.add(points);
    return points;
  });

  // Luzes dos motores — intensidade e alcance reduzidos para não "vazar" azul pelo casco
  const engineLights = enginePositions.map(pos => {
    const light = new THREE.PointLight(0x4488ff, 0.25, 1.5);
    light.position.set(pos.x, pos.y, pos.z + 0.65);
    group.add(light);
    return light;
  });

  // --- 6. Trem de Pouso ---
  const noseStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.15, 6), strutMat);
  noseStrut.position.set(0, 0.15, -0.8);
  group.add(noseStrut);
  const noseWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 12), gearMat);
  noseWheel.rotation.z = Math.PI / 2;
  noseWheel.position.set(0, 0.05, -0.8);
  group.add(noseWheel);

  function addMainWheel(x, z) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6), strutMat);
    strut.position.set(x, 0.1, z);
    group.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 12), gearMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.05, z);
    group.add(wheel);
  }
  addMainWheel(-0.3, 0.2);
  addMainWheel(0.3, 0.2);

  // ===== ALINHAMENTO NA PISTA E ESCALA FINAL =====
  group.position.set(0, -0.2, 2);
  group.scale.set(SCALE, SCALE, SCALE);

  // ============================================================
  // SOMBRA E ÁUDIO
  // ============================================================
  let shadow = null;
  if (scene) {
    const shadowGeometry = new THREE.CircleGeometry(2.5 * SCALE, 32);
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
    const soundFile = options.sound || 'Decolagem do 777 Emirates. Se liga no som dos motores.mp3';
    audioLoader.load(soundFile, (buffer) => {
      sound.setBuffer(buffer);
      sound.setLoop(true);
      sound.setVolume(0.01);
      sound.play();
    });
    group.userData.sound = sound;
  }

  // ============================================================
  // BOUNDING BOX E FÍSICA (Comportamento igual ao OVNI e X-Wing)
  // ============================================================
  const planeBox = new THREE.Box3().setFromObject(group);

  let speed = 0, velocity = 0;
  const maxSpeed = 1.55, acceleration = 0.0037, friction = 0.0025;
  const gravity = 0.01, crashGravity = 0.9, liftThreshold = 0.01;
  let isAccelerating = false, isCrashed = false, crashTimer = 0;
  const crashDuration = 1, pitchAngle = 0, maxPitchAngle = Math.PI / 4;
  const maxAltitude = 120, liftFactor = 0.2, pitchSpeed = 0.052;
  const baseVerticalSpeedUp = 0.105, speedFactor = 0.06, ai = 0.8;
  const baseRotationSpeed = 0.032;
  const inclinaBoing = -0.62, inclinaBoing2 = 0.62, inclina = -0.82, inclina2 = 0.82;

  function setSpeed(value) { speed = value; }
  function setVelocity(value) { velocity = value; }
  function setIsAccelerating(value) { isAccelerating = value; }
  function setIsCrashed(value) { isCrashed = value; }
  function setCrashTimer(value) { crashTimer = value; }
  function setPitchAngle(value) { pitchAngle = value; }

  // ============================================================
  // MÉTODO UPDATE (ANIMAÇÃO DINÂMICA DOS 4 MOTORES)
  // ============================================================
  function update(frame, speedInput) {
    const currentSpeed = Math.min(1, Math.max(0, speedInput || speed || 0));
    const fireSpeed = 0.02 + (currentSpeed * 0.15);

    fireParticles.forEach(points => {
      const positions = points.geometry.attributes.position.array;
      for (let i = 0; i < 60; i++) {
        positions[i*3+2] -= fireSpeed;
        if (positions[i*3+2] < -0.5) {
          positions[i*3] = (Math.random() - 0.5) * 0.15;
          positions[i*3+1] = (Math.random() - 0.5) * 0.15;
          positions[i*3+2] = 0.5;
        }
      }
      points.geometry.attributes.position.needsUpdate = true;
    });
  }

  // ============================================================
  // OBJETO RETORNADO
  // ============================================================
  return {
    group,
    body: hull, nose,
    enginePositions, fireParticles, engineLights,
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