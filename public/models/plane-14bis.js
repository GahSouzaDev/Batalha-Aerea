// ============================================================
// CONSTRUTOR DO AVIÃO 14-BIS (quatorzebis) - CORRIGIDO E ESCALADO
// ============================================================
PLANE_BUILDERS.quatorzebis = function (colorHex, options = {}) {
  // ===== OBTENDO CENA E LISTENER =====
  const scene = options.scene || (typeof window !== 'undefined' && window.scene);
  const listener = options.listener || (typeof window !== 'undefined' && window.listener);

  // ===== GRUPO PRINCIPAL =====
  const group = new THREE.Group();

  // ===== ESCALA (Ajuste este valor para aumentar ou diminuir o tamanho) =====
  // Os aviões do jogo costumam ter entre 2 e 3 unidades de comprimento.
  // Como seu modelo tem 6.0 de comprimento original, 0.4 vai deixá-lo com ~2.4 unidades.
  const SCALE = 0.45; 

  // ===== MATERIAIS =====
  const baseColor = colorHex || 0x3A6B9E; 

  const canvasMat = new THREE.MeshStandardMaterial({ 
    color: baseColor, 
    roughness: 0.9, 
    metalness: 0 
  });
  const bambooMat = new THREE.MeshStandardMaterial({ 
    color: 0xCDB38C, // Bambu seco
    roughness: 0.8, 
    metalness: 0 
  });
  const metalMat = new THREE.MeshStandardMaterial({ 
    color: 0x555555, // Aço escurecido
    roughness: 0.4, 
    metalness: 0.7 
  });
  const woodMat = new THREE.MeshStandardMaterial({ 
    color: 0x8B5A2B, // Madeira escura
    roughness: 0.6, 
    metalness: 0 
  });
  const seatMat = new THREE.MeshStandardMaterial({ 
    color: 0x4A2F1D 
  });
  const wheelMat = new THREE.MeshStandardMaterial({ 
    color: 0x111111 
  });

  // ============================================================
  // CONSTRUÇÃO DO 14-BIS – ESTRUTURA HISTÓRICA
  // ============================================================

  // --- 1. Estrutura Central (Fuselagem em Bambu) ---
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6.0, 8), bambooMat);
  spine.rotation.x = Math.PI / 2;
  spine.position.set(0, 1.4, -1.4);
  group.add(spine);

  const tubeLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 6.0, 8), bambooMat);
  tubeLeft.rotation.x = Math.PI / 2;
  tubeLeft.position.set(-0.25, 1.0, -1.4);
  group.add(tubeLeft);

  const tubeRight = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 6.0, 8), bambooMat);
  tubeRight.rotation.x = Math.PI / 2;
  tubeRight.position.set(0.25, 1.0, -1.4);
  group.add(tubeRight);

  // --- 2. Asa Dianteira (Canard) - AGORA TAMBÉM EM CAIXA (BIPLANO) ---
  // Asa superior dianteira (pequena)
  const canardUpperWing = new THREE.Mesh(new THREE.BoxGeometry(2, 0.06, 1), canvasMat);
  canardUpperWing.position.set(0, 2.0, -5.0);
  group.add(canardUpperWing);

  // Asa inferior dianteira (pequena)
  const canardLowerWing = new THREE.Mesh(new THREE.BoxGeometry(2, 0.06, 1), canvasMat);
  canardLowerWing.position.set(0, 0.1, -5.0);
  group.add(canardLowerWing);

  // Suportes verticais do Canard (para formar a "caixa")
  for (let x of [-0.3, 0.3]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2, 6), bambooMat);
      strut.position.set(x, 1, -4.45);
      group.add(strut);
  }

  // Hastes longas de suporte do Canard (presas à fuselagem central)
  for (let x of [-1.0, 1.0]) {
      const support = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.7, 6), bambooMat);
      support.position.set(x, 1.8, 1.5);
      support.rotation.z = (x > 0) ? -0.5 : 0.5;
      group.add(support);
  }

  // --- 3. Asas Principais Traseiras (Biplano Grande) ---
  // Asa Superior
  const upperWing = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.08, 2.8), canvasMat);
  upperWing.position.set(0, 2.6, 0.2);
  group.add(upperWing);

  // Asa Inferior
  const lowerWing = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.08, 2.8), canvasMat);
  lowerWing.position.set(0, 1.2, 0.2);
  group.add(lowerWing);

  // Montantes verticais e cabos de sustentação
  for (let x of [-4.5, -2.5, -0.5, 1.5, 3.5]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6), bambooMat);
    strut.position.set(x, 1.9, 0.2);
    group.add(strut);
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

  for (let x of [-4.5, -2.5, -0.5, 1.5, 3.5]) {
    addCable(x, 2.6, -1.2, x+0.8, 1.2, 1.2);
    addCable(x, 2.6, 1.2, x+0.8, 1.2, -1.2);
  }

  // --- 4. Compartimento do Piloto ---
  const seatGroup = new THREE.Group();
  seatGroup.position.set(0, 0.9, -0.2);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.3), seatMat);
  seat.position.set(0, 0.1, -1);
  seatGroup.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.05), seatMat);
  back.position.set(0, 0.5, -1);
  seatGroup.add(back);
  group.add(seatGroup);

  // --- 5. Motor V8 ---
  const engineGroup = new THREE.Group();
  engineGroup.position.set(0, 1.2, 1.4);
  const block = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.4), metalMat);
  engineGroup.add(block);
  
  for (let i = 0; i < 4; i++) {
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 8), metalMat);
    cyl.rotation.x = Math.PI / 2;
    cyl.position.set(-0.15 + i * 0.1, 0.25, 0.15);
    engineGroup.add(cyl);
    const cyl2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 8), metalMat);
    cyl2.rotation.x = Math.PI / 2;
    cyl2.position.set(-0.15 + i * 0.1, 0.25, -0.15);
    engineGroup.add(cyl2);
  }
  group.add(engineGroup);

  // --- 6. Hélice Propulsora (atrás do piloto) - CORRIGIDA ---
  const propGroup = new THREE.Group();
  propGroup.position.set(0, 1.3, 1.7);
  
  // Cubo da hélice
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 16), metalMat);
  hub.rotation.z = Math.PI / 2; // Aponta para Z
  propGroup.add(hub);

  // Pás de madeira AGORA EM PÉ (altas no eixo Y)
  const bladeGeo = new THREE.BoxGeometry(0.15, 2, 0.03);
  const blade1 = new THREE.Mesh(bladeGeo, woodMat);
  blade1.rotation.z = 0.0; // Posição vertical (apontando para cima)
  propGroup.add(blade1);
  
  const blade2 = new THREE.Mesh(bladeGeo, woodMat);
  blade2.rotation.z = Math.PI; // Posição vertical invertida (apontando para baixo)
  propGroup.add(blade2);
  group.add(propGroup);

  // --- 7. Cauda Traseira ---
  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 1.2, -5);
  const vStab = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.9, 1), canvasMat);
  vStab.position.set(1, -0.15, 0);
  tailGroup.add(vStab);
  const hStab = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.9, 1), canvasMat);
  hStab.position.set(-1, -0.15, 0);
  tailGroup.add(hStab);
  group.add(tailGroup);

  // --- 8. Trem de Pouso (4 rodas raiadas) ---
  function addWheel(x, z) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 6), metalMat);
    strut.position.set(x, 0.8, z);
    group.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 12), wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.3, z);
    group.add(wheel);
    const spokeMat = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.12, 4), spokeMat);
      spoke.rotation.z = Math.PI / 2;
      spoke.position.set(x + Math.cos(angle) * 0.07, 0.05, z + Math.sin(angle) * 0.07);
      group.add(spoke);
    }
  }
  addWheel(-1.5, -1.2);
  addWheel(1.5, -1.2);
  addWheel(-1.5, 1.1);
  addWheel(1.5, 1.1);

  // ===== ALINHAMENTO NA PISTA E ESCALA FINAL =====
  group.position.set(0, -0.3, 2);
  // Aplica a escala uniforme em todos os eixos para ficar do tamanho dos outros aviões
  group.scale.set(SCALE, SCALE, SCALE);

  // ============================================================
  // SOMBRA E ÁUDIO (SOMBRA REDIMENSIONADA COM A ESCALA)
  // ============================================================
  let shadow = null;
  if (scene) {
    const shadowGeometry = new THREE.CircleGeometry(3.5 * SCALE, 32); // Escala aplicada na sombra!
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
  // O Box3 vai calcular os limites automaticamente baseado na escala do `group`! Perfeito.
  const planeBox = new THREE.Box3().setFromObject(group);

  let speed = 0, velocity = 0;
  const maxSpeed = 0.9, acceleration = 0.001, friction = 0.001;
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
  // MÉTODO UPDATE (Gira a hélice no plano vertical)
  // ============================================================
  function update(frame, speedInput) {
    // Velocidade de rotação
    const rotSpeed = 0.1 + (speedInput || speed || 0);
    
    // Gira as pás no eixo Z (sentido do voo), para que girem num plano vertical
    blade1.rotation.z += rotSpeed * 3;
    blade2.rotation.z += rotSpeed * 3;
    
    // Acompanhamento visual do cubo
    hub.rotation.z += rotSpeed;
  }

  // ============================================================
  // OBJETO RETORNADO
  // ============================================================
  return {
    group,
    upperWing, lowerWing, canardUpperWing, canardLowerWing,
    engineGroup, propGroup, tailGroup,
    shadow, planeBox, sound,
    speed, velocity, maxSpeed, acceleration, friction, gravity, crashGravity, 
    liftThreshold, isAccelerating, isCrashed, crashTimer, crashDuration,
    pitchAngle, maxPitchAngle, maxAltitude, liftFactor, pitchSpeed,
    baseVerticalSpeedUp, baseRotationSpeed, inclinaBoing2, inclinaBoing,
    inclina2, inclina, speedFactor, ai,
    setSpeed, setVelocity, setIsAccelerating, setIsCrashed, setCrashTimer, setPitchAngle,
    update,
    idLight: null,
    colorable: ['canvasMat']
  };
};