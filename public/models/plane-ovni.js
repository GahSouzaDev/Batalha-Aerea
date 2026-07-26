PLANE_BUILDERS.ovni = function (colorHex, options = {}) {
  // ===== OBTENDO CENA E LISTENER (GLOBAL OU PASSADO) =====
  const scene = options.scene || (typeof window !== 'undefined' && window.scene);
  const listener = options.listener || (typeof window !== 'undefined' && window.listener);

  // ===== GRUPO PRINCIPAL =====
  const group = new THREE.Group();

  // ===== TEXTURAS E MATERIAIS (COM SUPORTE A colorHex) =====
  const useTexture = !colorHex || colorHex === 0xffffff;
  const baseColor = colorHex || 0xffffff;

  let planeMaterial;
  if (useTexture) {
    const planeTexture = new THREE.TextureLoader().load('img/ovni.png');
    planeMaterial = new THREE.MeshStandardMaterial({ map: planeTexture, metalness: 0.1, roughness: 0.3 });
  } else {
    planeMaterial = new THREE.MeshStandardMaterial({ color: baseColor, metalness: 0.1, roughness: 0.3 });
  }

  const cabinMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.4 });

  // ============================================================
  // CONSTRUÇÃO DO OVNI – CÓPIA EXATA DA GEOMETRIA ORIGINAL
  // ============================================================

  // Corpo principal (disco achatado)
  const bodyGeometry = new THREE.SphereGeometry(3, 64, 64, 0, Math.PI * 2, 0, Math.PI / 6);
  const body = new THREE.Mesh(bodyGeometry, planeMaterial);
  body.scale.set(1.2, 0.2, 1.2);
  body.position.y = 0;
  group.add(body);

  // Anel de propulsão inferior (partículas roxas)
  const fireMaterial = new THREE.PointsMaterial({
    color: 0x800080,
    size: 0.1,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending
  });

  function createFireGeometry() {
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array(300 * 3);
    for (let i = 0; i < 300; i++) {
      const angle = (i / 300) * Math.PI * 2;
      const radius = 2.5 + Math.random() * 0.2;
      verts[i*3] = Math.cos(angle) * radius;
      verts[i*3+1] = (Math.random() - 0.5) * 0.1;
      verts[i*3+2] = Math.sin(angle) * radius;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    return geo;
  }

  const propeller = new THREE.Points(createFireGeometry(), fireMaterial);
  propeller.position.y = 0.2;
  group.add(propeller);

  const propeller1 = new THREE.Points(createFireGeometry(), fireMaterial);
  propeller1.position.y = 0.2;
  propeller1.rotation.y = 1.6;
  group.add(propeller1);

  const propeller2 = new THREE.Points(createFireGeometry(), fireMaterial);
  propeller2.position.y = 0.2;
  propeller2.rotation.y = 2.3;
  group.add(propeller2);

  const propeller3 = new THREE.Points(createFireGeometry(), fireMaterial);
  propeller3.position.y = 0.2;
  propeller3.rotation.y = 0.8;
  group.add(propeller3);

  // Luzes pulsantes nas bordas (amarelas)
  const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 0.5 });
  const lightGeometry = new THREE.SphereGeometry(0.2, 16, 16);
  const lights = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const light = new THREE.Mesh(lightGeometry, lightMaterial);
    light.position.set(Math.cos(angle) * 2.8, 0.4, Math.sin(angle) * 2.8);
    lights.push(light);
    group.add(light);
  }

  // Cúpula superior (cabine translúcida)
  const cabinGeometry = new THREE.SphereGeometry(1, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2);
  const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
  cabin.position.y = 0.6;
  cabin.scale.set(0.8, 0.5, 0.8);
  group.add(cabin);

  // Luz emitida pelo anel de propulsão
  const fireLight = new THREE.PointLight(0xFFFF00, 10, 4);
  fireLight.position.set(0, 0.2, 0);
  group.add(fireLight);

  // Luz de identificação (original)
  const idLight = new THREE.PointLight(baseColor, 1.2, 5);
  idLight.position.set(0, 0.9, 0);
  group.add(idLight);

  // Posicionar o OVNI na pista (igual ao segundo modelo)
  group.position.set(0, 0, 2);

  // ===== ÁUDIO (EXATAMENTE COMO NO SEGUNDO MODELO) =====
  let sound = null;
  if (scene && listener) {
    const audioListener = listener || new THREE.AudioListener();
    if (!listener) scene.add(audioListener);
    sound = new THREE.Audio(audioListener);
    const audioLoader = new THREE.AudioLoader();
    audioLoader.load('Decolagem do 777 Emirates. Se liga no som dos motores.mp3', (buffer) => {
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

  // ===== REFLEXO NO CHÃO (SUBSTITUINDO A SOMBRA) =====
  let shadow = null;
  if (scene) {
    const shadowGeometry = new THREE.CircleGeometry(3, 32);
    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFFF00,
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending
    });
    shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    scene.add(shadow);
  }

  // ===== BOUNDING BOX (para colisão) =====
  const planeBox = new THREE.Box3().setFromObject(group);

  // ===== VARIÁVEIS DE FÍSICA (AJUSTADAS PARA OVNI) =====
  let speed = 0;
  let velocity = 0;
  const maxSpeed = 3;
  const acceleration = 0.01;
  const friction = 0.01;
  const gravity = 0.3;
  const crashGravity = 0.9;
  const liftThreshold = 0.01;
  let isAccelerating = false;
  let isCrashed = false;
  let crashTimer = 0;
  const crashDuration = 1;
  let keys = { w: false, s: false, a: false, d: false };
  const baseRotationSpeed = 0.01;

  let targetRoll = 0;
  let pitchAngle = 0;
  const maxPitchAngle = Math.PI / 4;
  const maxAltitude = 1000;
  const liftFactor = 0.1;
  const pitchSpeed = 0.07;
  const baseVerticalSpeedUp = 0.1;
  const speedFactor = 3.0;
  const inclina = -1.8;
  const inclina2 = 1.8;
  const inclinaboeing1 = 1;
  const inclinaboeing2 = 1;

  // ===== FUNÇÃO DE ANIMAÇÃO (FOGO, LUZES, REFLEXO) =====
  function animateFire() {
    const positions = propeller.geometry.attributes.position.array;
    const positions1 = propeller1.geometry.attributes.position.array;
    const positions2 = propeller2.geometry.attributes.position.array;
    const positions3 = propeller3.geometry.attributes.position.array;

    for (let i = 0; i < 300; i++) {
      positions[i*3+1] -= 0.03;
      positions1[i*3+1] -= 0.03;
      positions2[i*3+1] -= 0.03;
      positions3[i*3+1] -= 0.03;

      if (positions[i*3+1] < -0.5) {
        const angle = (i / 300) * Math.PI * 2;
        const radius = 2.5 + Math.random() * 0.2;
        positions[i*3] = Math.cos(angle) * radius;
        positions[i*3+1] = 0.5;
        positions[i*3+2] = Math.sin(angle) * radius;
      }
      if (positions1[i*3+1] < -0.5) {
        const angle = (i / 300) * Math.PI * 2;
        const radius = 2.5 + Math.random() * 0.2;
        positions1[i*3] = Math.cos(angle) * radius;
        positions1[i*3+1] = 0.5;
        positions1[i*3+2] = Math.sin(angle) * radius;
      }
      if (positions2[i*3+1] < -0.5) {
        const angle = (i / 300) * Math.PI * 2;
        const radius = 2.5 + Math.random() * 0.2;
        positions2[i*3] = Math.cos(angle) * radius;
        positions2[i*3+1] = 0.5;
        positions2[i*3+2] = Math.sin(angle) * radius;
      }
      if (positions3[i*3+1] < -0.5) {
        const angle = (i / 300) * Math.PI * 2;
        const radius = 2.5 + Math.random() * 0.2;
        positions3[i*3] = Math.cos(angle) * radius;
        positions3[i*3+1] = 0.5;
        positions3[i*3+2] = Math.sin(angle) * radius;
      }
    }

    propeller.geometry.attributes.position.needsUpdate = true;
    propeller1.geometry.attributes.position.needsUpdate = true;
    propeller2.geometry.attributes.position.needsUpdate = true;
    propeller3.geometry.attributes.position.needsUpdate = true;

    // Pulso das luzes nas bordas
    const pulse = Math.sin(Date.now() * 0.002) * 0.1 + 0.5;
    lights.forEach(light => {
      light.scale.setScalar(pulse);
    });

    // Atualizar posição do reflexo no chão
    if (shadow) {
      shadow.position.x = group.position.x;
      shadow.position.z = group.position.z;

      // Controlar visibilidade da luz e reflexo com base na altura
      const heightLimit = 50;
      if (group.position.y > heightLimit) {
        fireLight.visible = false;
        shadow.visible = false;
      } else {
        fireLight.visible = true;
        shadow.visible = true;
        const opacity = Math.max(0, 0.5 * (1 - group.position.y / heightLimit));
        shadow.material.opacity = opacity;
      }
    }
  }

  // ===== FUNÇÕES SET (IGUAIS AO SEGUNDO MODELO) =====
  function setSpeed(value) { speed = value; }
  function setVelocity(value) { velocity = value; }
  function setIsAccelerating(value) { isAccelerating = value; }
  function setIsCrashed(value) { isCrashed = value; }
  function setCrashTimer(value) { crashTimer = value; }
  function setPitchAngle(value) { pitchAngle = value; }

  // ===== MÉTODO UPDATE =====
  function update(frame, speedInput) {
    animateFire();
    // Se desejar, pode adicionar lógica de movimento aqui usando speed
  }

  // ===== OBJETO RETORNADO =====
  return {
    group,                // substitui o 'plane' do segundo modelo
    propeller,
    propeller1,
    propeller2,
    propeller3,
    fireLight,
    shadow,               // já adicionado à cena
    planeBox,
    sound,
    // Variáveis de física (como no segundo modelo)
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
    inclinaboeing1,
    inclinaboeing2,
    targetRoll,
    // Funções
    animateFire,
    setSpeed,
    setVelocity,
    setIsAccelerating,
    setIsCrashed,
    setCrashTimer,
    setPitchAngle,
    update,
    // Para compatibilidade com o original
    idLight,
    colorable: []
  };
};