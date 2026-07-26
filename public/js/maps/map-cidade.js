// ================================================================
//  MAPA "CIDADE" — baseado exatamente no scene.js + buildings.js originais.
//  Registrado em MAP_REGISTRY. Pra criar um mapa novo de verdade:
//   1. Copie este arquivo, escreva sua própria função buildMapXxx()
//   2. Registre em MAP_REGISTRY.suachave = buildMapXxx
//   3. Adicione <script src="js/maps/seu-arquivo.js"> no index.html
//      (antes de main.js) e a chave em MAP_INFO (config.js)
// ================================================================
function buildMapClassico(group) {
  const textureLoader = sharedTextureLoader;

  const groundTexture = textureLoader.load('https://threejs.org/examples/textures/terrain/grasslight-big.jpg');
  groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
  groundTexture.repeat.set(50, 50);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ map: groundTexture }));
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  // Pista principal
  const runwayGeometry = new THREE.PlaneGeometry(9.5, 100);
  const runway = new THREE.Mesh(runwayGeometry, new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(0, 0.01, -46.5);
  group.add(runway);

  // Pista secundária texturizada
  const runwayTexture = textureLoader.load('img/terra.png');
  runwayTexture.wrapS = runwayTexture.wrapT = THREE.RepeatWrapping;
  runwayTexture.repeat.set(1, 5);
  const runway1 = new THREE.Mesh(runwayGeometry, new THREE.MeshStandardMaterial({ map: runwayTexture }));
  runway1.rotation.x = -Math.PI / 2;
  runway1.rotation.z = -Math.PI / 2;
  runway1.position.set(-400, 0.012, 400);
  group.add(runway1);

  function createRunwayStripe(x, z, width, length) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(width, length), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(x, 0.02, z);
    group.add(stripe);
    return stripe;
  }
  [-42, -32, -22, -12, -2, -52, -62, -72, -82, -92].forEach(z => createRunwayStripe(0, z, 2, 5));
  [-4, -3, -2, -1, 0, 1, 2, 3, 4].forEach(x => createRunwayStripe(x, 2, 0.5, 2));

  // Lagos
  function makeLake(shapePoints, x, z, repeatX, repeatY, opacity) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shapePoints.forEach(p => shape.bezierCurveTo(p[0], p[1], p[2], p[3], p[4], p[5]));
    const waterTexture = textureLoader.load('https://threejs.org/examples/textures/waternormals.jpg');
    waterTexture.wrapS = waterTexture.wrapT = THREE.RepeatWrapping;
    waterTexture.repeat.set(repeatX, repeatY);
    const lake = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({
      map: waterTexture, transparent: true, opacity, roughness: 0.25, metalness: 0.65, side: THREE.DoubleSide,
    }));
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(x, 0.02, z);
    group.add(lake);
    return lake;
  }
  makeLake([[60, -30, 120, 30, 45, 45], [60, 140, -15, 60, -30, 45], [-120, 30, -90, -60, 0, 0]], -130, -130, 1, 1, 0.85);
  makeLake([[80, -40, 300, 50, 60, 60], [170, 120, -20, 80, -50, 50], [-100, 20, -80, -50, 0, 0]], 165, -10, 1.2, 1.2, 0.9);
  makeLake([[130, -140, 100, 50, 60, 60], [250, 120, -210, 130, -150, 50], [-100, 20, -180, -150, 0, 0]], -150, 450, 1.2, 1.2, 0.9);

  // Nuvens
  const clouds = [];
  function createCloud(x, z) {
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(5, 20, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, fog: false }));
    cloud.position.set(x, 120, z);
    group.add(cloud);
    return cloud;
  }
  for (let i = 0; i < 100; i++) {
    clouds.push(createCloud(Math.random() * 200 - 100, Math.random() * 200 - 100));
  }

  const colliders = buildClassicBuildings(group);

  return { colliders, clouds };
}

// ================================================================
//  REGISTRO DE MAPAS
//  Cada mapa agora tem seu próprio arquivo (js/maps/map-deserto.js,
//  map-floresta.js, map-laboratorio.js), carregado logo depois deste
//  no index.html. Cada um deles registra sua própria chave no
//  MAP_REGISTRY assim que carrega (ver o final de cada arquivo). Os
//  valores abaixo são só um fallback pra nunca sobrar uma chave
//  "vazia" caso algum desses arquivos não seja incluído por engano.
// ================================================================
const MAP_REGISTRY = {
  cidade: buildMapClassico,
  deserto: buildMapClassico,
  floresta: buildMapClassico,
  laboratorio: buildMapClassico,
};

// Também expomos o clima permitido por mapa aqui perto do registro,
// pra ficar fácil de achar quando for mexer em mapas no futuro. É lido
// por weather.js (MAP_WEATHER_PROFILES) — 'laboratorio' fica de fora
// de propósito, ele já tem atmosfera própria (ver map-laboratorio.js).
const MAP_WEATHER_PROFILES = {
  cidade: ['chuva', 'neblina', 'dirigivel'],
  deserto: ['tempestade', 'dirigivel'],
  floresta: ['chuva', 'neblina', 'dirigivel'],
  laboratorio: [],
};