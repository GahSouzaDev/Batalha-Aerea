// ============================================================
// CONSTRUTOR DO AVIÃO B-2 SPIRIT (b2spirit) — VERSÃO CORRIGIDA
// Bomber stealth de asa voadora
// ============================================================
PLANE_BUILDERS.b2spirit = function (colorHex, options = {}) {
  // ===== OBTENDO CENA E LISTENER =====
  const scene = options.scene || (typeof window !== 'undefined' && window.scene);
  const listener = options.listener || (typeof window !== 'undefined' && window.listener);

  // ===== GRUPO PRINCIPAL =====
  const group = new THREE.Group();

  // ===== ESCALA =====
  const SCALE = 1; // Ajustado para caber na pista junto com os outros

  // ============================================================
  // MATERIAIS COM TEXTURAS (ASAS E CORPO SEPARADOS)
  // ============================================================
  const baseColor = colorHex || 0x1A1A1A; // Cinza escuro/Preto stealth

  const useTexture = !colorHex || colorHex === 0xffffff;
  let wingMat, bodyMat;

  if (useTexture) {
    const loader = new THREE.TextureLoader();
    const wingTexture = loader.load('img/b2_wing.png');
    const bodyTexture = loader.load('img/b2_body.png');

    wingMat = new THREE.MeshStandardMaterial({
      map: wingTexture,
      roughness: 0.85,
      metalness: 0.15
    });
    bodyMat = new THREE.MeshStandardMaterial({
      map: bodyTexture,
      roughness: 0.85,
      metalness: 0.15
    });
  } else {
    wingMat = new THREE.MeshStandardMaterial({
      color: baseColor,
      roughness: 0.85,
      metalness: 0.15
    });
    bodyMat = new THREE.MeshStandardMaterial({
      color: baseColor,
      roughness: 0.85,
      metalness: 0.15
    });
  }

  // ===== MATERIAIS SÓLIDOS =====
  const engineMat = new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.7, metalness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x00aaff, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0 });
  const gearMat = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
  const cabinMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });

  // ============================================================
  // CONSTRUÇÃO DO B-2 SPIRIT (SILHUETA SIMÉTRICA E LIMPA)
  // ============================================================

  // --- 1. Asa Principal (Aerofólio inteiro da asa voadora) ---
  // Silhueta refeita: bordo de ataque em sweep único e reto (nariz -> ponta),
  // e bordo de fuga em "W duplo", simétrico, com a ponta mais traseira NO
  // CENTRO (igual ao B-2 real, entre os escapamentos).
  const wingShape = new THREE.Shape();

  const NOSE   = { x: 0,    y: 3.2 };
  const TIP_R  = { x: 5.2,  y: -0.3 };
  const TIP_L  = { x: -5.2, y: -0.3 };

  // Pontos do bordo de fuga direito (da ponta da asa até o centro)
  const rightTrail = [
    { x: 4.3, y: -1.1 },  // pico externo
    { x: 3.5, y: -0.5 },  // vale (entalhe)
    { x: 1.7, y: -1.5 },  // pico interno
    { x: 0.8, y: -0.9 },  // vale interno
  ];
  const CENTER_AFT = { x: 0, y: -1.9 }; // ponto mais traseiro, no centro

  wingShape.moveTo(NOSE.x, NOSE.y);
  wingShape.lineTo(TIP_R.x, TIP_R.y);
  rightTrail.forEach(p => wingShape.lineTo(p.x, p.y));
  wingShape.lineTo(CENTER_AFT.x, CENTER_AFT.y);
  // Espelha o lado direito para o esquerdo (garante simetria perfeita)
  [...rightTrail].reverse().forEach(p => wingShape.lineTo(-p.x, p.y));
  wingShape.lineTo(TIP_L.x, TIP_L.y);
  wingShape.closePath();

  const wingExtrudeSettings = {
    depth: 0.09,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.02,
    bevelSegments: 1
  };
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, wingExtrudeSettings);
  wingGeo.center();
  const wing = new THREE.Mesh(wingGeo, wingMat);
  wing.rotation.x = -Math.PI / 2;
  wing.position.y = 0.2;
  wing.position.z = 0.55; // recentraliza no espaço do avião (compensa o center())
  group.add(wing);

  // --- 2. Cabine / Cockpit ---
  const cockpitBase = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.9), bodyMat);
  cockpitBase.position.set(0, 0.35, -1.1);
  group.add(cockpitBase);

  const cockpitGlass = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.07, 0.55), glassMat);
  cockpitGlass.position.set(0, 0.44, -1.25);
  group.add(cockpitGlass);

  // --- 3. Motores e Nacelas (Enterrados no centro) ---
  function addEngine(x, zCenter) {
    // Duto/nacele de entrada de ar (parte frontal do motor)
    const intake = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.19, 0.4, 12),
      engineMat
    );
    intake.rotation.x = Math.PI / 2;
    intake.position.set(x, 0.25, 2);
    group.add(intake);

    // Bocal de exaustão (afunila mais ainda, logo atrás do duto)
    const exhaust = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.12, 0.5, 12),
      engineMat
    );
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(x, 0.25, 1.7);
    group.add(exhaust);

    return zCenter - 0.35 - 0.25;
  }

  const nozzleExitR = addEngine(0.85, -0.1);
  const nozzleExitL = addEngine(-0.85, -0.1);

  // --- 4. Sistema de Exaustão com Partículas (FOGO VERMELHO) ---
  const fireMaterial = new THREE.PointsMaterial({
    color: 0xff1a1a,       // vermelho vivo
    size: 0.09,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending
  });

  function createFireGeometry() {
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array(80 * 3);
    for (let i = 0; i < 80; i++) {
      verts[i*3]   = (Math.random() - 0.5) * 0.2;
      verts[i*3+1] = (Math.random() - 0.5) * 0.2;
      verts[i*3+2] = (Math.random() - 0.5) * 0.5;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    return geo;
  }

  const exhaustParticles = new THREE.Points(createFireGeometry(), fireMaterial);
  exhaustParticles.rotation.x = Math.PI;
  exhaustParticles.position.set(0.85, 0.2, 2.7);
  group.add(exhaustParticles);

  const exhaustParticles1 = new THREE.Points(createFireGeometry(), fireMaterial);
  exhaustParticles1.rotation.x = Math.PI;
  exhaustParticles1.position.set(-0.85, 0.2, 2.7);
  group.add(exhaustParticles1);

  // Luzes dos exaustores (vermelhas também)
  const exhaustLight = new THREE.PointLight(0xff2200, 0.5, 4);
  exhaustLight.position.set(0.85, 0.2, nozzleExitR - 0.3);
  group.add(exhaustLight);

  const exhaustLight1 = new THREE.PointLight(0xff2200, 0.5, 4);
  exhaustLight1.position.set(-0.85, 0.2, nozzleExitL - 0.3);
  group.add(exhaustLight1);

  // --- 5. Trem de Pouso (Triciclo) ---
  const noseStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.15, 6), cabinMat);
  noseStrut.position.set(0, 0.1, 1.9);
  group.add(noseStrut);
  const noseWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 12), gearMat);
  noseWheel.rotation.z = Math.PI / 2;
  noseWheel.position.set(0, 0.05, 1.9);
  group.add(noseWheel);

  function addMainWheel(x, z) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6), cabinMat);
    strut.position.set(x, 0.1, z);
    strut.rotation.z = (x > 0) ? -0.1 : 0.1;
    group.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 12), gearMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.05, z);
    group.add(wheel);
  }
  addMainWheel(0.85, -0.45);
  addMainWheel(-0.85, -0.45);

  // ===== ALINHAMENTO NA PISTA E ESCALA FINAL =====
  group.position.set(0, -0.1, 2);
  group.scale.set(SCALE, SCALE, SCALE);

  // ============================================================
  // SOMBRA E ÁUDIO
  // ============================================================
  let shadow = null;
  if (scene) {
    const shadowGeometry = new THREE.CircleGeometry(5.2 * SCALE, 32);
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
    const soundFile = options.sound || 'boeing.mp3';
    audioLoader.load(soundFile, (buffer) => {
      sound.setBuffer(buffer);
      sound.setLoop(true);
      sound.setVolume(0.01);
      sound.setSpeed(200);
      sound.play();
    });
    group.userData.sound = sound;
  }

  // ============================================================
  // BOUNDING BOX E FÍSICA (Ajustada para o B-2)
  // ============================================================
  const planeBox = new THREE.Box3().setFromObject(group);

  let speed = 0, velocity = 0;
  const maxSpeed = 1.55, acceleration = 0.0012, friction = 0.001;
  const gravity = 0.3, crashGravity = 0.9, liftThreshold = 0.45;
  let isAccelerating = false, isCrashed = false, crashTimer = 0;
  const crashDuration = 1, pitchAngle = 0, maxPitchAngle = Math.PI / 7;
  const maxAltitude = 120, liftFactor = 0.2, pitchSpeed = 0.036;
  const baseVerticalSpeedUp = 0.057, speedFactor = 0.32, ai = 0.8;
  const baseRotationSpeed = 0.0145;
  const inclinaBoing = -0.32, inclinaBoing2 = 0.32, inclina = -0.53, inclina2 = 0.53;

  function setSpeed(value) { speed = value; }
  function setVelocity(value) { velocity = value; }
  function setIsAccelerating(value) { isAccelerating = value; }
  function setIsCrashed(value) { isCrashed = value; }
  function setCrashTimer(value) { crashTimer = value; }
  function setPitchAngle(value) { pitchAngle = value; }

  // ============================================================
  // MÉTODO UPDATE (ANIMAÇÃO DOS EXAUSTORES - COM ACELERAÇÃO DINÂMICA)
  // ============================================================
  function update(frame, speedInput) {
    // Calcula a velocidade normalizada do avião (0 a 1)
    const currentSpeed = Math.min(1, Math.max(0, speedInput || speed || 0));
    // Define a velocidade das partículas baseada na aceleração
    const fireSpeed = 0.02 + (currentSpeed * 0.15);

    const positions = exhaustParticles.geometry.attributes.position.array;
    const positions1 = exhaustParticles1.geometry.attributes.position.array;

    for (let i = 0; i < 80; i++) {
      // Substitui o 0.03 fixo pelo dinâmico (fireSpeed)
      positions[i*3+2] -= fireSpeed;
      positions1[i*3+2] -= fireSpeed;
      
      if (positions[i*3+2] < -0.5) {
        positions[i*3] = (Math.random() - 0.5) * 0.2;
        positions[i*3+1] = (Math.random() - 0.5) * 0.2;
        positions[i*3+2] = 0.5;
      }
      if (positions1[i*3+2] < -0.5) {
        positions1[i*3] = (Math.random() - 0.5) * 0.2;
        positions1[i*3+1] = (Math.random() - 0.5) * 0.2;
        positions1[i*3+2] = 0.5;
      }
    }
    exhaustParticles.geometry.attributes.position.needsUpdate = true;
    exhaustParticles1.geometry.attributes.position.needsUpdate = true;
  }

  // ============================================================
  // OBJETO RETORNADO
  // ============================================================
  return {
    group,
    wing, cockpitBase, cockpitGlass,
    exhaustParticles, exhaustParticles1,
    exhaustLight, exhaustLight1,
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