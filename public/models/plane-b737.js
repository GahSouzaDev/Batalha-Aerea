// models/plane-boeing737.js
// ================================================================
// BOEING 737-800 (RYANAIR) — chave interna "b737"
// Remodelado e com rotações corrigidas conforme solicitação do usuário.
// ================================================================
PLANE_BUILDERS.b737 = function (colorHex, options = {}) {
  const scene = options.scene || (typeof window !== 'undefined' && window.scene);
  const listener = options.listener || (typeof window !== 'undefined' && window.listener);

  const group = new THREE.Group();

  // ===== MATERIAIS =====
  const useTexture = !colorHex || colorHex === 0xffffff;
  const baseColor = colorHex || 0xffffff;

  let planeMaterial, planeTailMaterial;
  if (useTexture) {
    const planeTexture = new THREE.TextureLoader().load('img/gol.png');
        const planeTexture2 = new THREE.TextureLoader().load('img/gol.png');
    planeMaterial = new THREE.MeshStandardMaterial({ map: planeTexture, metalness: 0.2, roughness: 0.7 });
    planeTailMaterial = new THREE.MeshStandardMaterial({ map: planeTexture2, metalness: 0.2, roughness: 0.7 });
  } else {
    planeMaterial = new THREE.MeshStandardMaterial({ color: baseColor, metalness: 0.2, roughness: 0.7 });
    planeTailMaterial = new THREE.MeshStandardMaterial({ color: baseColor, metalness: 0.2, roughness: 0.7 });
  }

  const blueMat = new THREE.MeshStandardMaterial({ color: 0x003399, metalness: 0.1, roughness: 0.8 });
  const yellowMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, metalness: 0.1, roughness: 0.8 });
  const blackMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const gearMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
  const cabinMat = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
  const motorMat = new THREE.MeshBasicMaterial({ color: 0x444444 });

  // ============================================================
  // FUSELAGEM
  // ============================================================
  const bodyGeo = new THREE.CylinderGeometry(0.28, 0.28, 4.8, 24);
  const body = new THREE.Mesh(bodyGeo, planeMaterial);
  body.rotation.x = Math.PI / 2;
  body.position.y = 0.5;
  body.position.z = 0;
  group.add(body);

  const noseGeo = new THREE.ConeGeometry(0.28, 0.6, 24);
  const nose = new THREE.Mesh(noseGeo, planeMaterial);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 0.5, -2.7);
  group.add(nose);

  // ============================================================
  // CAUDA (Correções aplicadas: gira 180 no X)
  // ============================================================
  const tailGeo = new THREE.BoxGeometry(0.05, 1.4, 0.7);
  const tail = new THREE.Mesh(tailGeo, blueMat);
  tail.position.set(0, 1.2, 2.4);
  tail.rotation.x = Math.PI; // Gira 180º no eixo X
  group.add(tail);

  // Topo arredondado da cauda
  const tailCone = new THREE.ConeGeometry(0.04, 0.25, 8);
  const tailConeMesh = new THREE.Mesh(tailCone, blueMat);
  tailConeMesh.position.set(0, 1.8, 2.8);
  tailConeMesh.rotation.x = Math.PI / 3; // Acompanha o X
  group.add(tailConeMesh);

  // Harpa Amarela
  const harpGeo = new THREE.ConeGeometry(0.15, 0.25, 4);
  const harp = new THREE.Mesh(harpGeo, yellowMat);
  harp.position.set(0, 0.4, 2.45);
  harp.rotation.x = Math.PI / 9; // Acompanha o X
  group.add(harp);

  // ============================================================
  // ESTABILIZADORES HORIZONTAIS (Correções: 180 no Z e 90 no X)
  // ============================================================
  const tailHorizGeo = new THREE.BoxGeometry(1.5, 0.04, 0.5);
  
  const tailHL = new THREE.Mesh(tailHorizGeo, planeMaterial);
  tailHL.position.set(-0.8, 0.55, 2.4);
  // Aplica 90º no X e 180º no Z (mantendo o enflechamento no Y)

  group.add(tailHL);
  
  const tailHR = new THREE.Mesh(tailHorizGeo, planeMaterial);
  tailHR.position.set(0.8, 0.55, 2.4);
 
  group.add(tailHR);

  // ============================================================
  // ASAS E WINGLETS
  // ============================================================
  const wingGeo = new THREE.BoxGeometry(3.4, 0.04, 0.8);
  const wingL = new THREE.Mesh(wingGeo, planeMaterial);
  wingL.position.set(-1.7, 0.55, 0.4);
  wingL.rotation.y = 0.1;
  group.add(wingL);

  const wingR = new THREE.Mesh(wingGeo, planeMaterial);
  wingR.position.set(1.7, 0.55, 0.4);
  wingR.rotation.y = -0.1;
  group.add(wingR);

  const wingletGeo = new THREE.BoxGeometry(0.35, 0.4, 0.04);
  const wingletL = new THREE.Mesh(wingletGeo, blueMat);
  wingletL.position.set(-3.3, 0.7, 0.45);
  wingletL.rotation.y = 8;
  wingletL.rotation.z = 0.1;
  group.add(wingletL);

  const wingletR = new THREE.Mesh(wingletGeo, blueMat);
  wingletR.position.set(3.3, 0.7, 0.45);
  wingletR.rotation.y = -8;
  wingletR.rotation.z = -0.1;
  group.add(wingletR);

  // ============================================================
  // 2 MOTORES E EXAUSTÃO
  // ============================================================
  const motorGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.5, 12);
  const motorL = new THREE.Mesh(motorGeo, motorMat);
  motorL.rotation.x = Math.PI / 2;
  motorL.position.set(-1.0, 0.4, 0.15);
  group.add(motorL);

  const motorR = new THREE.Mesh(motorGeo, motorMat);
  motorR.rotation.x = Math.PI / 2;
  motorR.position.set(1.0, 0.4, 0.15);
  group.add(motorR);

  const tubeGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.1, 12);
  const tubeL = new THREE.Mesh(tubeGeo, blackMat);
  tubeL.rotation.x = Math.PI / 2;
  tubeL.position.set(-1.0, 0.4, 0.4);
  group.add(tubeL);

  const tubeR = new THREE.Mesh(tubeGeo, blackMat);
  tubeR.rotation.x = Math.PI / 2;
  tubeR.position.set(1.0, 0.4, 0.4);
  group.add(tubeR);

  // Fogo e Partículas
  const fireMat = new THREE.PointsMaterial({
    color: 0xff5500, size: 0.08, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending
  });

  function buildFireGeo() {
    const g = new THREE.BufferGeometry();
    const v = new Float32Array(80 * 3);
    for (let i = 0; i < 80; i++) {
      v[i*3] = (Math.random() - 0.5) * 0.25;
      v[i*3+1] = (Math.random() - 0.5) * 0.25;
      v[i*3+2] = (Math.random() - 0.5) * 0.6;
    }
    g.setAttribute('position', new THREE.BufferAttribute(v, 3));
    return g;
  }

  const propeller = new THREE.Points(buildFireGeo(), fireMat);
  propeller.position.set(-1.0, 0.4, 0.9);
  group.add(propeller);

  const propeller1 = new THREE.Points(buildFireGeo(), fireMat);
  propeller1.position.set(1.0, 0.4, 0.9);
  group.add(propeller1);

  const fireLight = new THREE.PointLight(0xff5500, 1.0, 3);
  fireLight.position.copy(propeller.position);
  group.add(fireLight);

  const fireLight1 = new THREE.PointLight(0xff5500, 1.0, 3);
  fireLight1.position.copy(propeller1.position);
  group.add(fireLight1);

  const invPropGeo = new THREE.ConeGeometry(0.2, 0.5, 8);
  const invPropMat = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0 });
  const propeller2 = new THREE.Mesh(invPropGeo, invPropMat);
  propeller2.visible = false;
  group.add(propeller2);
  const propeller3 = new THREE.Mesh(invPropGeo, invPropMat);
  propeller3.visible = false;
  group.add(propeller3);

  // ============================================================
  // CABINE E JANELAS
  // ============================================================
  const canopyGeo = new THREE.SphereGeometry(0.15, 12, 12, 0, Math.PI * 2, 0, Math.PI / 1.5);
  const canopy = new THREE.Mesh(canopyGeo, cabinMat);
  canopy.position.set(0, 0.6, -2.6);
  group.add(canopy);

  const winGeo = new THREE.SphereGeometry(0.03, 8, 8);
  for (let z = -1.0; z < 2.0; z += 0.35) {
    const wL = new THREE.Mesh(winGeo, cabinMat);
    wL.position.set(-0.24, 0.65, z);
    group.add(wL);
    const wR = new THREE.Mesh(winGeo, cabinMat);
    wR.position.set(0.24, 0.65, z);
    group.add(wR);
  }

  // ============================================================
  // TREM DE POUSO
  // ============================================================
  const frontGear = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.05), cabinMat);
  frontGear.position.set(0, 0.2, -1.8);
  group.add(frontGear);

  const frontWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.08, 16), gearMat);
  frontWheel.rotation.x = Math.PI / 2;
  frontWheel.rotation.z = Math.PI / 2;
  frontWheel.position.set(0, -0.1, -1.8);
  group.add(frontWheel);

  const mainGear = new THREE.BoxGeometry(0.05, 0.6, 0.05);
  const mL = new THREE.Mesh(mainGear, cabinMat);
  mL.position.set(-0.3, 0.2, 0.2);
  mL.rotation.z = Math.PI / -12;
  group.add(mL);
  const mR = new THREE.Mesh(mainGear, cabinMat);
  mR.position.set(0.3, 0.2, 0.2);
  mR.rotation.z = -Math.PI / -12;
  group.add(mR);

  const mWheel = new THREE.CylinderGeometry(0.1, 0.1, 0.15, 16);
  const wL = new THREE.Mesh(mWheel, gearMat);
  wL.rotation.x = Math.PI / 2;
  wL.rotation.z = Math.PI / 2;
  wL.position.set(-0.35, -0.1, 0.2);
  group.add(wL);
  const wR = new THREE.Mesh(mWheel, gearMat);
  wR.rotation.x = Math.PI / 2;
  wR.rotation.z = Math.PI / 2;
  wR.position.set(0.35, -0.1, 0.2);
  group.add(wR);

  // ===== LUZ =====
  const idLight = new THREE.PointLight(baseColor, 1.0, 4);
  idLight.position.set(0, 1.0, -0.5);
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
  }

  // ===== SOMBRA =====
  let shadow = null;
  if (scene) {
    const shadowGeo = new THREE.CircleGeometry(2.8, 32);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
    shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    scene.add(shadow);
  }

  const planeBox = new THREE.Box3().setFromObject(group);

  // ===== FÍSICA =====
  let speed = 0, velocity = 0;
  const maxSpeed = 2.0, acceleration = 0.0022, friction = 0.002, gravity = 0.2;
  const crashGravity = 0.9, liftThreshold = 0.55, crashDuration = 1;
  let isAccelerating = false, isCrashed = false, crashTimer = 0;
  let pitchAngle = 0;
  const maxPitchAngle = Math.PI / 4, maxAltitude = 350, liftFactor = 0.6, pitchSpeed = 0.04;
  const baseVerticalSpeedUp = 0.050, speedFactor = 0.5, ai = 0.8, baseRotationSpeed = 0.02;
  const inclina = -0.8, inclina2 = 0.8;

  // ============================================================
  // FUNÇÃO DE ANIMAÇÃO DO FOGO (DUPLO + DINÂMICO)
  // ============================================================
  function animateFire(currentSpeed) {
    // Calcula a velocidade de expulsão baseada na velocidade do avião (0 a 1)
    const fireSpeed = 0.05 + (currentSpeed * 0.5); 

    [propeller, propeller1].forEach(p => {
      const pos = p.geometry.attributes.position.array;
      for (let i = 0; i < 80; i++) {
        pos[i*3+2] += fireSpeed; // A velocidade do fogo varia!
        if (pos[i*3+2] > 0.6) {
          pos[i*3] = (Math.random() - 0.5) * 0.25;
          pos[i*3+1] = (Math.random() - 0.5) * 0.25;
          pos[i*3+2] = -0.6;
        }
      }
      p.geometry.attributes.position.needsUpdate = true;
    });
  }

  function setSpeed(v) { speed = v; }
  function setVelocity(v) { velocity = v; }
  function setIsAccelerating(v) { isAccelerating = v; }
  function setIsCrashed(v) { isCrashed = v; }
  function setCrashTimer(v) { crashTimer = v; }
  function setPitchAngle(v) { pitchAngle = v; }

  // ============================================================
  // MÉTODO UPDATE (AGORA PASSA A VELOCIDADE PRO FOGO)
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
    if (sound) {
      sound.stop();
      sound.disconnect();
    }
  }

  return {
    group, body, sphere: null, propeller, propeller1, propeller2, propeller3,
    fireLight, fireLight1, shadow, planeBox, sound,
    speed, velocity, maxSpeed, acceleration, friction, gravity, crashGravity,
    liftThreshold, isAccelerating, isCrashed, crashTimer, crashDuration,
    pitchAngle, maxPitchAngle, maxAltitude, liftFactor, pitchSpeed,
    baseVerticalSpeedUp, speedFactor, ai, baseRotationSpeed, inclina, inclina2,
    animateFire, setSpeed, setVelocity, setIsAccelerating, setIsCrashed,
    setCrashTimer, setPitchAngle, update,
    dispose,
    idLight, colorable: []
  };
};