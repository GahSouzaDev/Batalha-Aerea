PLANE_BUILDERS.boing = function (colorHex, options = {}) {
  // ===== OBTENDO CENA E LISTENER (GLOBAL OU PASSADO) =====
  const scene = options.scene || (typeof window !== 'undefined' && window.scene);
  const listener = options.listener || (typeof window !== 'undefined' && window.listener);

  // ===== GRUPO PRINCIPAL (SUBSTITUI O 'plane' DO SEGUNDO MODELO) =====
  const group = new THREE.Group();

  // ===== TEXTURAS E MATERIAIS (MANTENDO A LÓGICA ORIGINAL DE colorHex) =====
  const useTexture = !colorHex || colorHex === 0xffffff;
  const baseColor = colorHex || 0xffffff;

  let planeMaterial, planeTailMaterial;
  if (useTexture) {
    const planeTexture = new THREE.TextureLoader().load('img/image.png');
    planeMaterial = new THREE.MeshStandardMaterial({ map: planeTexture, metalness: 0.5, roughness: 0.5 });
    planeTailMaterial = new THREE.MeshStandardMaterial({ map: planeTexture, metalness: 0.5, roughness: 0.5 });
  } else {
    planeMaterial = new THREE.MeshStandardMaterial({ color: baseColor, metalness: 0.5, roughness: 0.5 });
    planeTailMaterial = new THREE.MeshStandardMaterial({ color: baseColor, metalness: 0.5, roughness: 0.5 });
  }

  // Materiais fixos (iguais ao segundo modelo)
  const gearMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
  const vidro = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
  const cabinMaterial = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
  const motorMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });

  // ============================================================
  // CONSTRUÇÃO DO AVIÃO – CÓPIA EXATA DO SEGUNDO MODELO
  // ============================================================

  // Corpo
  const bodyGeometry = new THREE.CylinderGeometry(0.5, 0.5, 5.2, 32);
  const body = new THREE.Mesh(bodyGeometry, planeMaterial);
  body.rotation.x = Math.PI / 2;
  body.position.y = 0.5;
  body.position.z = -0.2;
  group.add(body);

  const body2Geometry = new THREE.CylinderGeometry(0.1, 0.5, 2.2, 32);
  const body2 = new THREE.Mesh(body2Geometry, planeMaterial);
  body2.rotation.x = Math.PI / 2;
  body2.position.y = 0.5;
  body2.position.z = 3.5;
  group.add(body2);

  const body3Geometry = new THREE.CylinderGeometry(0.5, 0.01, 0.8, 25);
  const body3 = new THREE.Mesh(body3Geometry, planeMaterial);
  body3.rotation.x = Math.PI / 2;
  body3.position.y = 0.45;
  body3.position.z = -3.4;
  group.add(body3);

  // Esferas (vidros)
  const sphereGeometry = new THREE.SphereGeometry(0.3, 32, 32);
  const sphere = new THREE.Mesh(sphereGeometry, vidro);
  sphere.rotation.x = Math.PI / 2;
  sphere.position.y = 0.6;
  sphere.position.z = -3.3;
  group.add(sphere);

  const sphere1Geometry = new THREE.SphereGeometry(0.5, 32, 32);
  const sphere1 = new THREE.Mesh(sphere1Geometry, planeMaterial);
  sphere1.rotation.x = Math.PI / 2;
  sphere1.position.y = 0.5;
  sphere1.position.z = -2.9;
  group.add(sphere1);

  const sphere2Geometry = new THREE.SphereGeometry(0.2, 32, 32);
  const sphere2 = new THREE.Mesh(sphere2Geometry, vidro);
  sphere2.rotation.x = Math.PI / 2;
  sphere2.position.y = 0.65;
  sphere2.position.z = -2;
  sphere2.position.x = 0.3;
  group.add(sphere2);
  const sphere3 = new THREE.Mesh(sphere2Geometry, vidro);
  sphere3.rotation.x = Math.PI / 2;
  sphere3.position.y = 0.65;
  sphere3.position.z = -1.5;
  sphere3.position.x = 0.3;
  group.add(sphere3);
  const sphere4 = new THREE.Mesh(sphere2Geometry, vidro);
  sphere4.rotation.x = Math.PI / 2;
  sphere4.position.y = 0.65;
  sphere4.position.z = -1;
  sphere4.position.x = 0.3;
  group.add(sphere4);
  const sphere5 = new THREE.Mesh(sphere2Geometry, vidro);
  sphere5.rotation.x = Math.PI / 2;
  sphere5.position.y = 0.65;
  sphere5.position.z = -0.5;
  sphere5.position.x = 0.3;
  group.add(sphere5);
  const sphere6 = new THREE.Mesh(sphere2Geometry, vidro);
  sphere6.rotation.x = Math.PI / 2;
  sphere6.position.y = 0.65;
  sphere6.position.z = 0;
  sphere6.position.x = 0.3;
  group.add(sphere6);
  const sphere7 = new THREE.Mesh(sphere2Geometry, vidro);
  sphere7.rotation.x = Math.PI / 2;
  sphere7.position.y = 0.65;
  sphere7.position.z = 0.5;
  sphere7.position.x = 0.3;
  group.add(sphere7);
  const sphere8 = new THREE.Mesh(sphere2Geometry, vidro);
  sphere8.rotation.x = Math.PI / 2;
  sphere8.position.y = 0.65;
  sphere8.position.z = 1;
  sphere8.position.x = 0.3;
  group.add(sphere8);
  const sphere9 = new THREE.Mesh(sphere2Geometry, vidro);
  sphere9.rotation.x = Math.PI / 2;
  sphere9.position.y = 0.65;
  sphere9.position.z = 1.5;
  sphere9.position.x = 0.3;
  group.add(sphere9);
  const sphere10 = new THREE.Mesh(sphere2Geometry, vidro);
  sphere10.rotation.x = Math.PI / 2;
  sphere10.position.y = 0.65;
  sphere10.position.z = 2;
  sphere10.position.x = 0.3;
  group.add(sphere10);
  const sphere11 = new THREE.Mesh(sphere2Geometry, vidro);
  sphere11.rotation.x = Math.PI / 2;
  sphere11.position.y = 0.65;
  sphere11.position.z = -2;
  sphere11.position.x = -0.3;
  group.add(sphere11);
  const sphere12 = new THREE.Mesh(sphere2Geometry, vidro);
  sphere12.rotation.x = Math.PI / 2;
  sphere12.position.y = 0.65;
  sphere12.position.z = -1.5;
  sphere12.position.x = -0.3;
  group.add(sphere12);
  const sphere13 = new THREE.Mesh(sphere2Geometry, vidro);
  sphere13.rotation.x = Math.PI / 2;
  sphere13.position.y = 0.65;
  sphere13.position.z = -1;
  sphere13.position.x = -0.3;
  group.add(sphere13);
  const sphere14 = new THREE.Mesh(sphere2Geometry, vidro);
  sphere14.rotation.x = Math.PI / 2;
  sphere14.position.y = 0.65;
  sphere14.position.z = -0.5;
  sphere14.position.x = -0.3;
  group.add(sphere14);
  const sphere15 = new THREE.Mesh(sphere2Geometry, vidro);
  sphere15.rotation.x = Math.PI / 2;
  sphere15.position.y = 0.65;
  sphere15.position.z = 0;
  sphere15.position.x = -0.3;
  group.add(sphere15);
  const sphere16 = new THREE.Mesh(sphere2Geometry, vidro);
  sphere16.rotation.x = Math.PI / 2;
  sphere16.position.y = 0.65;
  sphere16.position.z = 0.5;
  sphere16.position.x = -0.3;
  group.add(sphere16);
  const sphere17 = new THREE.Mesh(sphere2Geometry, vidro);
  sphere17.rotation.x = Math.PI / 2;
  sphere17.position.y = 0.65;
  sphere17.position.z = 1;
  sphere17.position.x = -0.3;
  group.add(sphere17);
  const sphere18 = new THREE.Mesh(sphere2Geometry, vidro);
  sphere18.rotation.x = Math.PI / 2;
  sphere18.position.y = 0.65;
  sphere18.position.z = 1.5;
  sphere18.position.x = -0.3;
  group.add(sphere18);
  const sphere19 = new THREE.Mesh(sphere2Geometry, vidro);
  sphere19.rotation.x = Math.PI / 2;
  sphere19.position.y = 0.65;
  sphere19.position.z = 2;
  sphere19.position.x = -0.3;
  group.add(sphere19);
  const sphere20 = new THREE.Mesh(sphere2Geometry, vidro);
  sphere20.rotation.x = Math.PI / 2;
  sphere20.position.y = 0.65;
  sphere20.position.z = 2.5;
  sphere20.position.x = -0.28;
  group.add(sphere20);
  const sphere21 = new THREE.Mesh(sphere2Geometry, vidro);
  sphere21.rotation.x = Math.PI / 2;
  sphere21.position.y = 0.65;
  sphere21.position.z = 2.5;
  sphere21.position.x = 0.28;
  group.add(sphere21);

  // Asas
  const wingsGeometry = new THREE.BoxGeometry(7, 0.1, 1.8);
  const wings = new THREE.Mesh(wingsGeometry, planeMaterial);
  wings.position.y = 0.6;
  wings.position.z = 0.5;
  wings.position.x = -3;
  wings.rotation.y = -3;
  group.add(wings);

  const wings1Geometry = new THREE.BoxGeometry(7, 0.1, 1.8);
  const wings1 = new THREE.Mesh(wings1Geometry, planeMaterial);
  wings1.position.y = 0.6;
  wings1.position.z = 0.5;
  wings1.position.x = 3;
  wings1.rotation.y = 3;
  group.add(wings1);

  // Cauda vertical
  const tailVerticalGeometry = new THREE.BoxGeometry(0.1, 1.3, 0.5);
  const tailVertical = new THREE.Mesh(tailVerticalGeometry, planeTailMaterial);
  tailVertical.position.y = 1;
  tailVertical.position.z = 3.5;
  tailVertical.rotation.x = -3;
  group.add(tailVertical);

  // Texto (sempre com textura, como no segundo modelo)
  const textGeometry = new THREE.PlaneGeometry(0.4, 0.4);
  const textTexture = new THREE.TextureLoader().load('img/boeing.png');
  const textMaterial = new THREE.MeshBasicMaterial({ map: textTexture, transparent: true });
  const textMesh = new THREE.Mesh(textGeometry, textMaterial);
  textMesh.position.set(0.06, 0.1, 0);
  textMesh.rotation.y = Math.PI / 2;
  tailVertical.add(textMesh);

  // Cauda horizontal
  const tailHorizontalGeometry = new THREE.BoxGeometry(2, 0.1, 0.5);
  const tailHorizontal = new THREE.Mesh(tailHorizontalGeometry, planeMaterial);
  tailHorizontal.position.z = 3.5;
  tailHorizontal.position.y = 0.5;
  tailHorizontal.position.x = 0.6;
  tailHorizontal.rotation.y = 3;
  group.add(tailHorizontal);

  const tailHorizontal1Geometry = new THREE.BoxGeometry(2, 0.1, 0.5);
  const tailHorizontal1 = new THREE.Mesh(tailHorizontal1Geometry, planeMaterial);
  tailHorizontal1.position.z = 3.5;
  tailHorizontal1.position.y = 0.5;
  tailHorizontal1.position.x = -0.6;
  tailHorizontal1.rotation.y = -3;
  group.add(tailHorizontal1);

  // Fogo (partículas) – idêntico ao segundo modelo
  const fireMaterial = new THREE.PointsMaterial({
    color: 0xff4500,
    size: 0.1,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
  });

  const fireGeometry = new THREE.BufferGeometry();
  const fireVertices = new Float32Array(100 * 3);
  for (let i = 0; i < 100; i++) {
    fireVertices[i * 3] = (Math.random() - 0.5) * 0.3;
    fireVertices[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
    fireVertices[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
  }
  fireGeometry.setAttribute('position', new THREE.BufferAttribute(fireVertices, 3));

  const propeller = new THREE.Points(fireGeometry, fireMaterial);
  propeller.rotation.y = Math.PI;
  propeller.position.set(1.5, 0.3, 0.3);
  group.add(propeller);

  const propeller1 = new THREE.Points(fireGeometry, fireMaterial);
  propeller1.rotation.y = Math.PI;
  propeller1.position.set(-1.5, 0.3, 0.3);
  group.add(propeller1);

  const propeller2 = new THREE.Points(fireGeometry, fireMaterial);
  propeller2.rotation.y = Math.PI;
  propeller2.position.set(3, 0.3, 0.5);
  group.add(propeller2);

  const propeller3 = new THREE.Points(fireGeometry, fireMaterial);
  propeller3.rotation.y = Math.PI;
  propeller3.position.set(-3, 0.3, 0.5);
  group.add(propeller3);

  // Luzes do fogo
  const fireLight = new THREE.PointLight(0xff4500, 0.5, 5);
  fireLight.position.set(1.5, 0.3, 0.3);
  group.add(fireLight);
  const fireLight1 = new THREE.PointLight(0xff4500, 0.5, 5);
  fireLight1.position.set(-1.5, 0.3, 0.3);
  group.add(fireLight1);
  const fireLight2 = new THREE.PointLight(0xff4500, 0.5, 5);
  fireLight2.position.set(3, 0.3, 0.5);
  group.add(fireLight2);
  const fireLight3 = new THREE.PointLight(0xff4500, 0.5, 5);
  fireLight3.position.set(-3, 0.3, 0.5);
  group.add(fireLight3);

  // Trem de pouso
  const frontGearSupportGeometry = new THREE.BoxGeometry(0.05, 0.6, 0.05);
  const frontGearSupport = new THREE.Mesh(frontGearSupportGeometry, cabinMaterial);
  frontGearSupport.position.z = -2.4;
  frontGearSupport.position.y = 0.2;
  group.add(frontGearSupport);

  const frontWheelGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.1, 16);
  const frontWheel = new THREE.Mesh(frontWheelGeometry, gearMaterial);
  frontWheel.rotation.x = Math.PI / 2;
  frontWheel.rotation.z = Math.PI / 2;
  frontWheel.position.z = -2.4;
  frontWheel.position.y = -0.1;
  group.add(frontWheel);

  const mainGearSupportGeometry = new THREE.BoxGeometry(0.05, 0.6, 0.05);
  const mainGearSupportGeometry12 = new THREE.BoxGeometry(0.05, 1.2, 0.05);

  const leftGearSupport = new THREE.Mesh(mainGearSupportGeometry, cabinMaterial);
  leftGearSupport.position.x = -0.2;
  leftGearSupport.position.y = 0.2;
  leftGearSupport.position.z = -0.5;
  leftGearSupport.rotation.z = Math.PI / -12;
  group.add(leftGearSupport);
  const leftGearSupport3 = new THREE.Mesh(mainGearSupportGeometry, cabinMaterial);
  leftGearSupport3.position.x = -0.2;
  leftGearSupport3.position.y = 0.2;
  leftGearSupport3.position.z = 0.5;
  leftGearSupport3.rotation.z = Math.PI / -12;
  group.add(leftGearSupport3);

  const rightGearSupport = new THREE.Mesh(mainGearSupportGeometry, cabinMaterial);
  rightGearSupport.position.x = 0.2;
  rightGearSupport.position.y = 0.2;
  rightGearSupport.position.z = -0.5;
  rightGearSupport.rotation.x = -Math.PI / -12;
  group.add(rightGearSupport);
  const rightGearSupport3 = new THREE.Mesh(mainGearSupportGeometry, cabinMaterial);
  rightGearSupport3.position.x = 0.2;
  rightGearSupport3.position.y = 0.2;
  rightGearSupport3.position.z = 0.5;
  rightGearSupport3.rotation.z = -Math.PI / -12;
  group.add(rightGearSupport3);

  const leftGearSupport1 = new THREE.Mesh(mainGearSupportGeometry12, cabinMaterial);
  leftGearSupport1.position.x = 1.5;
  leftGearSupport1.position.y = 0.60;
  leftGearSupport1.position.z = 0.8;
  leftGearSupport1.rotation.x = Math.PI / 2;
  group.add(leftGearSupport1);
  const leftGearSupport2 = new THREE.Mesh(mainGearSupportGeometry12, cabinMaterial);
  leftGearSupport2.position.x = 2.5;
  leftGearSupport2.position.y = 0.60;
  leftGearSupport2.position.z = 1;
  leftGearSupport2.rotation.x = Math.PI / 2;
  group.add(leftGearSupport2);
  const leftGearSupport4 = new THREE.Mesh(mainGearSupportGeometry12, cabinMaterial);
  leftGearSupport4.position.x = 3.5;
  leftGearSupport4.position.y = 0.60;
  leftGearSupport4.position.z = 1.1;
  leftGearSupport4.rotation.x = Math.PI / 2;
  group.add(leftGearSupport4);
  const leftGearSupport5 = new THREE.Mesh(mainGearSupportGeometry12, cabinMaterial);
  leftGearSupport5.position.x = 4.5;
  leftGearSupport5.position.y = 0.60;
  leftGearSupport5.position.z = 1.2;
  leftGearSupport5.rotation.x = Math.PI / 2;
  group.add(leftGearSupport5);

  const rightGearSupport1 = new THREE.Mesh(mainGearSupportGeometry12, cabinMaterial);
  rightGearSupport1.position.x = -1.5;
  rightGearSupport1.position.y = 0.60;
  rightGearSupport1.position.z = 0.8;
  rightGearSupport1.rotation.x = -Math.PI / 2;
  group.add(rightGearSupport1);
  const rightGearSupport2 = new THREE.Mesh(mainGearSupportGeometry12, cabinMaterial);
  rightGearSupport2.position.x = -2.5;
  rightGearSupport2.position.y = 0.60;
  rightGearSupport2.position.z = 1;
  rightGearSupport2.rotation.x = -Math.PI / 2;
  group.add(rightGearSupport2);
  const rightGearSupport4 = new THREE.Mesh(mainGearSupportGeometry12, cabinMaterial);
  rightGearSupport4.position.x = -3.5;
  rightGearSupport4.position.y = 0.60;
  rightGearSupport4.position.z = 1.1;
  rightGearSupport4.rotation.x = -Math.PI / 2;
  group.add(rightGearSupport4);
  const rightGearSupport5 = new THREE.Mesh(mainGearSupportGeometry12, cabinMaterial);
  rightGearSupport5.position.x = -4.5;
  rightGearSupport5.position.y = 0.60;
  rightGearSupport5.position.z = 1.2;
  rightGearSupport5.rotation.x = -Math.PI / 2;
  group.add(rightGearSupport5);

  const mainWheelGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.15, 16);

  const leftWheel = new THREE.Mesh(mainWheelGeometry, gearMaterial);
  leftWheel.rotation.x = Math.PI / 2;
  leftWheel.rotation.z = Math.PI / 2;
  leftWheel.position.x = -0.25;
  leftWheel.position.y = -0.1;
  leftWheel.position.z = -0.5;
  group.add(leftWheel);
  const leftWheel1 = new THREE.Mesh(mainWheelGeometry, gearMaterial);
  leftWheel1.rotation.x = Math.PI / 2;
  leftWheel1.rotation.z = Math.PI / 2;
  leftWheel1.position.x = -0.25;
  leftWheel1.position.y = -0.1;
  leftWheel1.position.z = 0.5;
  group.add(leftWheel1);

  const rightWheel = new THREE.Mesh(mainWheelGeometry, gearMaterial);
  rightWheel.rotation.x = Math.PI / 2;
  rightWheel.rotation.z = Math.PI / 2;
  rightWheel.position.x = 0.25;
  rightWheel.position.y = -0.1;
  rightWheel.position.z = -0.5;
  group.add(rightWheel);
  const rightWheel1 = new THREE.Mesh(mainWheelGeometry, gearMaterial);
  rightWheel1.rotation.x = Math.PI / 2;
  rightWheel1.rotation.z = Math.PI / 2;
  rightWheel1.position.x = 0.25;
  rightWheel1.position.y = -0.1;
  rightWheel1.position.z = 0.5;
  group.add(rightWheel1);

  // Cabine
  const cabinGeometry = new THREE.CylinderGeometry(0.25, 0.25, 2, 20);
  const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
  cabin.rotation.x = Math.PI / 2;
  cabin.position.y = 0.70;
  cabin.position.z = -1.25;
  group.add(cabin);

  // Motores
  const motorGeometry = new THREE.CylinderGeometry(0.25, 0.25, 1, 10);
  const motor = new THREE.Mesh(motorGeometry, motorMaterial);
  motor.rotation.x = Math.PI / 2;
  motor.position.y = 0.3;
  motor.position.z = -0.5;
  motor.position.x = -1.5;
  group.add(motor);

  const motor2 = new THREE.Mesh(motorGeometry, motorMaterial);
  motor2.rotation.x = Math.PI / 2;
  motor2.position.y = 0.3;
  motor2.position.z = -0.2;
  motor2.position.x = -3;
  group.add(motor2);

  const motor1 = new THREE.Mesh(motorGeometry, motorMaterial);
  motor1.rotation.x = Math.PI / 2;
  motor1.position.y = 0.3;
  motor1.position.z = -0.5;
  motor1.position.x = 1.5;
  group.add(motor1);

  const motor3 = new THREE.Mesh(motorGeometry, motorMaterial);
  motor3.rotation.x = Math.PI / 2;
  motor3.position.y = 0.3;
  motor3.position.z = -0.2;
  motor3.position.x = 3;
  group.add(motor3);

  // Posicionar o avião na pista (igual ao segundo modelo)
  group.position.set(0, 0, 2);

  // ===== ÁUDIO (EXATAMENTE COMO NO SEGUNDO MODELO) =====
  let sound = null;
  if (scene && listener) {
    const audioListener = listener || new THREE.AudioListener();
    if (!listener) scene.add(audioListener);
    sound = new THREE.Audio(audioListener);
    const audioLoader = new THREE.AudioLoader();
    audioLoader.load('sr71.mp3', (buffer) => {
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

  // ===== SOMBRA (EXATAMENTE COMO NO SEGUNDO MODELO) =====
  let shadow = null;
  if (scene) {
    const shadowGeometry = new THREE.CircleGeometry(3.5, 32);
    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.5
    });
    shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    scene.add(shadow);
  }

  // ===== BOUNDING BOX (para colisão) =====
  const planeBox = new THREE.Box3().setFromObject(group);

  // ===== VARIÁVEIS DE FÍSICA (EXATAMENTE COMO NO SEGUNDO MODELO) =====
  let speed = 0;
  let velocity = 0;
  const maxSpeed = 1.5;
  const acceleration = 0.0022;
  const friction = 0.0022;
  const gravity = 0.2;
  const crashGravity = 0.9;
  const liftThreshold = 0.60;
  let isAccelerating = false;
  let isCrashed = false;
  let crashTimer = 0;
  const crashDuration = 1;
  let pitchAngle = 0;
  const maxPitchAngle = Math.PI / 4;
  const maxAltitude = 350;
  const liftFactor = 0.7;
  const pitchSpeed = 0.04;
  const baseVerticalSpeedUp = 0.050;
  const speedFactor = 0.15;
  const ai = 0.8;
  const baseRotationSpeed = 0.01;
  const inclinaBoing = -0.3;
  const inclinaBoing2 = 0.3;
  const inclina = -0.8;
  const inclina2 = 0.8;

  // ============================================================
  // FUNÇÃO DE ANIMAÇÃO DO FOGO (4 MOTORES + DINÂMICO)
  // ============================================================
  function animateFire(currentSpeed) {
    // Calcula a velocidade de expulsão baseada na velocidade do avião (0 a 1)
    const fireSpeed = 0.02 + (currentSpeed * 0.05); 

    const positions = propeller.geometry.attributes.position.array;
    const positions1 = propeller1.geometry.attributes.position.array;
    const positions2 = propeller2.geometry.attributes.position.array;
    const positions3 = propeller3.geometry.attributes.position.array;

    for (let i = 0; i < 100; i++) {
      positions[i * 3 + 2] -= fireSpeed;
      positions1[i * 3 + 2] -= fireSpeed;
      positions2[i * 3 + 2] -= fireSpeed;
      positions3[i * 3 + 2] -= fireSpeed;

      if (positions[i * 3 + 2] < -0.5) {
        positions[i * 3] = (Math.random() - 0.5) * 0.3;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
        positions[i * 3 + 2] = 0.5;
      }
      if (positions1[i * 3 + 2] < -0.5) {
        positions1[i * 3] = (Math.random() - 0.5) * 0.3;
        positions1[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
        positions1[i * 3 + 2] = 0.5;
      }
      if (positions2[i * 3 + 2] < -0.5) {
        positions2[i * 3] = (Math.random() - 0.5) * 0.3;
        positions2[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
        positions2[i * 3 + 2] = 0.5;
      }
      if (positions3[i * 3 + 2] < -0.5) {
        positions3[i * 3] = (Math.random() - 0.5) * 0.3;
        positions3[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
        positions3[i * 3 + 2] = 0.5;
      }
    }

    propeller.geometry.attributes.position.needsUpdate = true;
    propeller1.geometry.attributes.position.needsUpdate = true;
    propeller2.geometry.attributes.position.needsUpdate = true;
    propeller3.geometry.attributes.position.needsUpdate = true;
  }

  // ===== FUNÇÕES SET (IGUAIS AO SEGUNDO MODELO) =====
  function setSpeed(value) { speed = value; }
  function setVelocity(value) { velocity = value; }
  function setIsAccelerating(value) { isAccelerating = value; }
  function setIsCrashed(value) { isCrashed = value; }
  function setCrashTimer(value) { crashTimer = value; }
  function setPitchAngle(value) { pitchAngle = value; }

  // ============================================================
  // MÉTODO UPDATE (AGORA PASSA A VELOCIDADE PRO FOGO)
  // ============================================================
  function update(frame, speedInput) {
    // Pega a velocidade atual do avião (0 a 1) e passa para o fogo
    const currentSpeed = Math.min(1, Math.max(0, speedInput || speed || 0));
    animateFire(currentSpeed);
  }

  // ===== OBJETO RETORNADO =====
  return {
    group,                // substitui o 'plane' do segundo modelo
    motor,
    body3,
    propeller,
    propeller1,
    propeller2,
    propeller3,
    shadow,               // já foi adicionado à cena, mas pode ser útil referenciar
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
    baseRotationSpeed,
    inclinaBoing2,
    inclinaBoing,
    inclina2,
    body2,
    inclina,
    speedFactor,
    vidro,
    sphere1,
    sphereGeometry,
    ai,
    // Funções
    animateFire,
    setSpeed,
    setVelocity,
    setIsAccelerating,
    setIsCrashed,
    setCrashTimer,
    setPitchAngle,
    update,
    // Para compatibilidade com o original, também expomos 'idLight' (opcional)
    idLight: fireLight, 
    colorable: []       
  };
};