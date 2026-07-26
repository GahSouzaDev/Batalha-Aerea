// models/plane-f22.js
// ================================================================
// F-22 RAPTOR — chave interna "f22" (ver plane-specs.js).
//
// Diferente do Gripen (canard-delta, motor único, cauda única e reta),
// o Raptor tem uma silhueta bem diferente e é isso que precisa aparecer
// no modelo:
//  - Fuselagem larga e "achatada" (chined) — sem ser um cilindro fino.
//  - Asas trapezoidais moderadamente enflechadas (não uma delta pura).
//  - DUAS caudas verticais bem inclinadas pra fora (~25-30°) — a marca
//    registrada do Raptor, bem diferente da cauda única reta do Gripen.
//  - DOIS estabilizadores horizontais (stabilators) na cauda — coisa que
//    o Gripen não tem.
//  - Motor duplo, com dois bocais/exaustões e dois efeitos de fogo.
//  - Sem canards (isso é exclusivo do Gripen nesse jogo).
// ================================================================
PLANE_BUILDERS.f22 = function (colorHex, options = {}) {
  const scene = options.scene || (typeof window !== 'undefined' && window.scene);
  const listener = options.listener || (typeof window !== 'undefined' && window.listener);

  const group = new THREE.Group();

  const useTexture = !colorHex || colorHex === 0xffffff;
  const baseColor = colorHex || 0xffffff;

  let planeMaterial, planeTailMaterial;
  if (useTexture) {
    const planeTexture = new THREE.TextureLoader().load('img/camuflagem.png');
    planeMaterial = new THREE.MeshStandardMaterial({ map: planeTexture });
    planeTailMaterial = new THREE.MeshStandardMaterial({ map: planeTexture });
  } else {
    planeMaterial = new THREE.MeshStandardMaterial({ color: baseColor });
    planeTailMaterial = new THREE.MeshStandardMaterial({ color: baseColor });
  }

  const gearMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
  const cabinMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const nozzleMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.6, roughness: 0.4 });

  // ============================================================
  // FUSELAGEM — mais larga/achatada que um caça comum (efeito "chined"
  // do Raptor de verdade vem do formato facetado; aqui simulamos achatando
  // um cilindro no eixo X).
  // ============================================================
  const bodyGeometry = new THREE.CylinderGeometry(0.24, 0.16, 3.8, 8);
  const body = new THREE.Mesh(bodyGeometry, planeMaterial);
  body.rotation.x = Math.PI / 2;
  body.scale.set(1.35, 0.85, 1);
  body.position.y = 0.5;
  body.position.z = -0.2;
  group.add(body);

  // Nariz afilado e facetado
  const noseGeometry = new THREE.ConeGeometry(0.2, 0.7, 8);
  const nose = new THREE.Mesh(noseGeometry, planeMaterial);
  nose.rotation.x = -Math.PI / 2;
  nose.scale.set(1.35, 0.85, 1);
  nose.position.set(0, 0.5, -2.15);
  group.add(nose);

  // ============================================================
  // ASAS — usando ConeGeometry (mesma técnica 100% segura já usada em
  // TODOS os outros modelos do jogo). 
  // ============================================================
  const wingsGeometry = new THREE.ConeGeometry(2.2, 1.1, 4);
  const wings = new THREE.Mesh(wingsGeometry, planeMaterial);
  wings.rotation.x = Math.PI;
  wings.position.set(0, 0.1, 0.6);
  group.add(wings);

  // ============================================================
  // ESTABILIZADORES HORIZONTAIS (stabilators)
  // ============================================================
  const stabilatorGeometry = new THREE.ConeGeometry(1, 0.35, 3);

  const stabRight = new THREE.Mesh(stabilatorGeometry, planeTailMaterial);
  stabRight.rotation.x = Math.PI;
  stabRight.rotation.z = -Math.PI / 9;
  stabRight.position.set(0.75, 0.6, 2);
  group.add(stabRight);

  const stabLeft = new THREE.Mesh(stabilatorGeometry, planeTailMaterial);
  stabLeft.rotation.x = Math.PI;
  stabLeft.rotation.z = Math.PI / 9;
  stabLeft.position.set(-0.75, 0.6, 2);
  group.add(stabLeft);

  // ============================================================
  // CAUDAS VERTICAIS — DUAS, bem inclinadas pra fora (~28°).
  // ============================================================
  const tailVerticalGeometry = new THREE.BoxGeometry(0.08, 1.35, 0.7);

  const tailVerticalRight = new THREE.Mesh(tailVerticalGeometry, planeTailMaterial);
  tailVerticalRight.position.set(0.55, 1.1, 1.9);
  tailVerticalRight.rotation.z = -Math.PI / 6.3; // ~28° pra fora
  group.add(tailVerticalRight);

  const tailVerticalLeft = new THREE.Mesh(tailVerticalGeometry, planeTailMaterial);
  tailVerticalLeft.position.set(-0.55, 1.1, 1.9);
  tailVerticalLeft.rotation.z = Math.PI / 6.3;
  group.add(tailVerticalLeft);

  // ============================================================
  // MOTOR DUPLO — dois bocais de exaustão + dois efeitos de fogo
  // ============================================================
  const nozzleGeometry = new THREE.CylinderGeometry(0.18, 0.22, 1.5, 12);

  const nozzleRight = new THREE.Mesh(nozzleGeometry, nozzleMaterial);
  nozzleRight.rotation.x = Math.PI / 2;
  nozzleRight.position.set(0.32, 0.55, 1.9);
  group.add(nozzleRight);

  const nozzleLeft = new THREE.Mesh(nozzleGeometry, nozzleMaterial);
  nozzleLeft.rotation.x = Math.PI / 2;
  nozzleLeft.position.set(-0.32, 0.55, 1.9);
  group.add(nozzleLeft);

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

  const propellerRight = new THREE.Points(buildFireGeometry(), fireMaterial);
  propellerRight.position.set(0.32, 0.55, 2.55);
  group.add(propellerRight);

  const propellerLeft = new THREE.Points(buildFireGeometry(), fireMaterial);
  propellerLeft.position.set(-0.32, 0.55, 2.55);
  group.add(propellerLeft);

  // Compatibilidade: código legado em outros lugares às vezes espera uma
  // única referência "propeller" — mantemos apontando pro motor direito.
  const propeller = propellerRight;

  const fireLightRight = new THREE.PointLight(0x88ccff, 1.6, 5);
  fireLightRight.position.copy(propellerRight.position);
  group.add(fireLightRight);

  const fireLightLeft = new THREE.PointLight(0x88ccff, 1.6, 5);
  fireLightLeft.position.copy(propellerLeft.position);
  group.add(fireLightLeft);
  const fireLight = fireLightRight; // compatibilidade

  // Hélices invisíveis (mantidas só por compatibilidade)
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
  frontGearSupport.position.set(0, 0.2, -1.7);
  group.add(frontGearSupport);

  const frontWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 16), gearMaterial);
  frontWheel.rotation.x = Math.PI / 2;
  frontWheel.rotation.z = Math.PI / 2;
  frontWheel.position.set(0, -0.1, -1.7);
  group.add(frontWheel);

  const mainGearSupportGeometry = new THREE.BoxGeometry(0.05, 0.6, 0.05);
  const mainGearSupportGeometry12 = new THREE.BoxGeometry(0.05, 1.2, 0.05);

  const leftGearSupport = new THREE.Mesh(mainGearSupportGeometry, cabinMaterial);
  leftGearSupport.position.set(-1.05, 0.2, 0.4);
  leftGearSupport.rotation.z = Math.PI / -12;
  group.add(leftGearSupport);

  const rightGearSupport = new THREE.Mesh(mainGearSupportGeometry, cabinMaterial);
  rightGearSupport.position.set(1.05, 0.2, 0.4);
  rightGearSupport.rotation.z = -Math.PI / -12;
  group.add(rightGearSupport);

  const leftGearSupport1 = new THREE.Mesh(mainGearSupportGeometry12, cabinMaterial);
  leftGearSupport1.position.set(0.5, 0.1, -0.5);
  leftGearSupport1.rotation.x = Math.PI / 2;
  group.add(leftGearSupport1);

  const rightGearSupport1 = new THREE.Mesh(mainGearSupportGeometry12, cabinMaterial);
  rightGearSupport1.position.set(-0.5, 0.1, -0.5);
  rightGearSupport1.rotation.x = -Math.PI / 2;
  group.add(rightGearSupport1);

  const mainWheelGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.15, 16);
  const leftWheel = new THREE.Mesh(mainWheelGeometry, gearMaterial);
  leftWheel.rotation.x = Math.PI / 2;
  leftWheel.rotation.z = Math.PI / 2;
  leftWheel.position.set(-1.2, -0.2, 0.4);
  group.add(leftWheel);

  const rightWheel = new THREE.Mesh(mainWheelGeometry, gearMaterial);
  rightWheel.rotation.x = Math.PI / 2;
  rightWheel.rotation.z = Math.PI / 2;
  rightWheel.position.set(1.2, -0.2, 0.4);
  group.add(rightWheel);

  // Canopy (bolha da cabine)
  const cabinGeometry = new THREE.SphereGeometry(0.26, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.7);
  const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
  cabin.position.set(0, 0.68, -1.15);
  group.add(cabin);

  // Radar/sensor sob o nariz
  const sphereGeometry = new THREE.SphereGeometry(0.22, 20, 20);
  const sphere = new THREE.Mesh(sphereGeometry, black);
  sphere.position.set(0, 0.42, -1.85);
  group.add(sphere);

  const idLight = new THREE.PointLight(baseColor, 1.0, 4);
  idLight.position.set(0, 0.95, 0);
  group.add(idLight);

  group.position.set(0, 0, 2);

  // ===== ÁUDIO =====
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
      sound.play();
    });
    group.userData.sound = sound;
  } else {
    console.warn('Áudio não carregado: cena ou listener não fornecidos.');
  }

  // ===== SOMBRA =====
  let shadow = null;
  if (scene) {
    const shadowGeometry = new THREE.CircleGeometry(1.9, 32);
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
  const maxSpeed = 2.5;
  const acceleration = 0.0034;
  const friction = 0.0028;
  const gravity = 0.3;
  const crashGravity = 0.9;
  const liftThreshold = 0.55;
  let isAccelerating = false;
  let isCrashed = false;
  let crashTimer = 0;
  const crashDuration = 1;
  const baseRotationSpeed = 0.013;
  let targetRoll = 0;
  let pitchAngle = 0;
  const maxPitchAngle = Math.PI / 5;
  const maxAltitude = 400;
  const liftFactor = 0.2;
  const pitchSpeed = 0.07;
  const baseVerticalSpeedUp = 0.09;
  const speedFactor = 2.5;
  const inclina = -1.5;
  const inclina2 = 1.5;

  // ============================================================
  // ANIMAÇÃO DO FOGO (DINÂMICA COM VELOCIDADE) - CORRIGIDO
  // ============================================================
  function animateFire(currentSpeed) {
    // Calcula a velocidade do fogo baseada na velocidade do avião (0 a 1)
    const fireSpeed = 0.04 + (currentSpeed * 0.2); 

    [propellerRight, propellerLeft].forEach(p => {
      const positions = p.geometry.attributes.position.array;
      for (let i = 0; i < 60; i++) {
        positions[i * 3 + 2] += fireSpeed; // Exaustão sai pra trás (+z) em velocidade variável
        if (positions[i * 3 + 2] > 0.5) {
          positions[i * 3] = (Math.random() - 0.5) * 0.25;
          positions[i * 3 + 1] = (Math.random() - 0.5) * 0.25;
          positions[i * 3 + 2] = -0.5;
        }
      }
      p.geometry.attributes.position.needsUpdate = true;
    });
  }

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
    const currentSpeed = Math.min(1, Math.max(0, speedInput || speed || 0));
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