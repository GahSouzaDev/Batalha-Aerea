// ================================================================
//  MAPA "DESERTO" — chão de areia, zero vegetação, 3 pirâmides bem
//  grandes (estilo Gizé) dispostas em triângulo, com colisão em
//  "degraus" que segue o formato afunilado da pirâmide (não é um cubo
//  gigante de ar em volta dela — a caixa de colisão fica mais estreita
//  conforme sobe, igual a pirâmide de verdade).
//
//  PERFORMANCE (CORREÇÃO): esse mapa tava demorando bem mais pra
//  carregar que o Clássico/Cidade, mesmo tendo bem menos coisa. Duas
//  causas de verdade:
//   1) a textura de areia (canvas com milhares de fillRect) era GERADA
//      DO ZERO toda vez que você entrava nesse mapa — agora ela é
//      construída UMA ÚNICA VEZ (cache em módulo) e só reaproveitada.
//   2) as pedras soltas/erosão eram uma malha (mesh+geometria) NOVA por
//      pedra (dezenas de objetos, cada um com sua própria geometria
//      alocada) — agora viram InstancedMesh (1 geometria + 1 material,
//      N instâncias), que é ordens de magnitude mais barato de montar
//      e de desenhar.
//
//  NOVIDADES:
//   - As pirâmides agora usam a textura externa "img/textura-piram.png"
//     (carregada via THREE.TextureLoader).
//   - A iluminação geral foi reduzida (lightIntensity = 0.65) para um
//     clima mais suave, menos ofuscante.
// ================================================================

// ---- textura de areia: gerada uma única vez e cacheada ----
let _desertSandTextureCache = null;
function _buildSandTexture() {
  if (_desertSandTextureCache) return _desertSandTextureCache;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#d9b271';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 3200; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const shade = Math.random() * 40 - 20;
    ctx.fillStyle = `rgba(${120 + shade | 0},${90 + shade * 0.7 | 0},${50 + shade * 0.4 | 0},0.35)`;
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  // Ondulações suaves de duna
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 10; i++) {
    ctx.strokeStyle = '#8a6a3d';
    ctx.lineWidth = 4 + Math.random() * 6;
    ctx.beginPath();
    const y0 = Math.random() * size;
    ctx.moveTo(0, y0);
    ctx.bezierCurveTo(size * 0.3, y0 + 30, size * 0.7, y0 - 30, size, y0);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(80, 80);
  _desertSandTextureCache = tex;
  return tex;
}

// ---- carregador de textura para as pirâmides (imagem externa) ----
let _pyramidTextureLoader = null;
let _pyramidTexture = null;
let _pyramidTextureLoaded = false;
const _pyramidTextureCallbacks = [];

function _loadPyramidTexture(callback) {
  if (_pyramidTextureLoaded) {
    callback(_pyramidTexture);
    return;
  }
  if (_pyramidTextureLoader === null) {
    _pyramidTextureLoader = new THREE.TextureLoader();
    _pyramidTextureLoader.load(
      'img/textura-piram.png',
      (tex) => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        _pyramidTexture = tex;
        _pyramidTextureLoaded = true;
        // Dispara todos os callbacks pendentes
        _pyramidTextureCallbacks.forEach(cb => cb(tex));
        _pyramidTextureCallbacks.length = 0;
      },
      undefined,
      (err) => {
        console.warn('Erro ao carregar textura das pirâmides, usando fallback procedural.', err);
        // Fallback: gera uma textura procedural simples (opcional)
        const fallbackTex = _buildFallbackPyramidTexture();
        _pyramidTexture = fallbackTex;
        _pyramidTextureLoaded = true;
        _pyramidTextureCallbacks.forEach(cb => cb(fallbackTex));
        _pyramidTextureCallbacks.length = 0;
      }
    );
  }
  _pyramidTextureCallbacks.push(callback);
}

// Fallback procedural (caso a imagem não seja encontrada)
function _buildFallbackPyramidTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#cdb27a';
  ctx.fillRect(0, 0, size, size);
  const block = 32;
  ctx.strokeStyle = '#a0885a';
  ctx.lineWidth = 2;
  for (let x = 0; x <= size; x += block) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
  }
  for (let y = 0; y <= size; y += block) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ---- geometrias/materiais compartilhados entre chamadas ----
const _DESERT_EROSION_ROCK_GEO = new THREE.BoxGeometry(1, 1, 1);
const _DESERT_LOOSE_ROCK_GEO = new THREE.DodecahedronGeometry(1, 0);
let _desertLooseRockMat = null;
function _looseRockMaterial() {
  if (!_desertLooseRockMat) _desertLooseRockMat = new THREE.MeshStandardMaterial({ color: 0xb69a6b, roughness: 1.0 });
  return _desertLooseRockMat;
}

function buildMapDeserto(group) {
  const colliders = [];
  const _mtx = new THREE.Matrix4();
  const _pos = new THREE.Vector3();
  const _quat = new THREE.Quaternion();
  const _scale = new THREE.Vector3();

  // ===== CHÃO DE AREIA =====
  const sandTexture = _buildSandTexture();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshStandardMaterial({ map: sandTexture, color: 0xffffff, roughness: 1.0 })
  );
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  // Pista de pouso simples (compactada, mais escura que a areia solta)
  const runway = new THREE.Mesh(new THREE.PlaneGeometry(10, 110), new THREE.MeshStandardMaterial({ color: 0xc7a568, roughness: 0.95 }));
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(0, 0.015, -46.5);
  group.add(runway);
  [-42, -32, -22, -12, -2, -52, -62, -72, -82, -92].forEach(z => {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(2, 5), new THREE.MeshStandardMaterial({ color: 0xf2e6c9 }));
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(0, 0.02, z);
    group.add(stripe);
  });

  // Céu/fog com cara de deserto (bem mais claro/quente que o de Cidade)
  group.userData.skyColor = 0xe8d9a8;
  group.userData.fogNear = 150;
  group.userData.fogFar = 850;
  // Iluminação menos intensa (o motor deve ler este valor)
  group.userData.lightIntensity = 0.65;

  // ===== PIRÂMIDES =====
  // Acumula todas as pedrinhas de erosão das 3 pirâmides num único
  // InstancedMesh (em vez de 14 meshes separados POR pirâmide).
  const erosionInstances = []; // { x, y, z, s, rotY }

  // Lista de materiais das pirâmides para aplicar a textura quando carregar
  const pyramidMaterials = [];

  function createPyramid(x, z, baseSize, height, tint) {
    const g = new THREE.Group();

    // Material com textura que será carregada assincronamente
    // Inicialmente sem textura (ou com cor sólida)
    const stoneMat = new THREE.MeshStandardMaterial({
      color: tint,
      roughness: 0.95,
      metalness: 0.02,
      flatShading: true
    });
    pyramidMaterials.push(stoneMat);

    // radialSegments=4 + rotationY 45° -> pirâmide de base quadrada de
    // frente, igual às do Egito (não um cone redondo).
    const pyramidGeo = new THREE.ConeGeometry(baseSize / Math.SQRT2, height, 4, 1);
    const mesh = new THREE.Mesh(pyramidGeo, stoneMat);
    mesh.rotation.y = Math.PI / 4;
    mesh.position.y = height / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);

    // Leve variação de erosão (blocos salientes na base, cosmético)
    for (let i = 0; i < 14; i++) {
      const s = baseSize * (0.02 + Math.random() * 0.025);
      const angle = Math.random() * Math.PI * 2;
      const dist = baseSize / 2 * (0.85 + Math.random() * 0.2);
      erosionInstances.push({
        x: x + Math.cos(angle) * dist, y: s / 2, z: z + Math.sin(angle) * dist,
        s, rotY: Math.random() * Math.PI,
      });
    }

    g.position.set(x, 0, z);
    group.add(g);

    // ---- colisão em degraus (afunilando com a altura) ----
    const tiers = 8;
    const halfBase = baseSize / 2;
    for (let i = 0; i < tiers; i++) {
      const t0 = i / tiers, t1 = (i + 1) / tiers;
      const y0 = height * t0, y1 = height * t1;
      const half0 = halfBase * (1 - t0) * 0.98;
      const half1 = halfBase * (1 - t1) * 0.98;
      const halfTier = Math.max(half0, half1, 0.6);
      const min = new THREE.Vector3(x - halfTier, y0, z - halfTier);
      const max = new THREE.Vector3(x + halfTier, y1, z + halfTier);
      colliders.push({ boundingBox: new THREE.Box3(min, max), isPyramid: true });
    }

    return g;
  }

  // Disposição triangular estilo Gizé
  createPyramid(0, -260, 220, 150, 0xcdb27a);      // Quéops (a maior)
  createPyramid(-190, -60, 175, 120, 0xc7a86e);    // Quéfren
  createPyramid(150, -70, 140, 95, 0xd1b884);      // Miquerinos

  // ---- Carrega a textura externa e aplica a todos os materiais ----
  _loadPyramidTexture((texture) => {
    // Ajusta a repetição para cada pirâmide (opcional)
    // Como todas usam a mesma textura, definimos repeat de forma fixa
    // ou podemos calcular baseado no tamanho médio
    const baseRepeat = 4; // fator de repetição
    texture.repeat.set(baseRepeat, baseRepeat);
    pyramidMaterials.forEach(mat => {
      mat.map = texture;
      mat.color.set(0xffffff); // cor neutra para exibir a textura
      mat.needsUpdate = true;
    });
  });

  // Monta o InstancedMesh das pedras de erosão
  if (erosionInstances.length) {
    const erosionMat = new THREE.MeshStandardMaterial({ color: 0xc9ac79, roughness: 1.0 });
    const erosionMesh = new THREE.InstancedMesh(_DESERT_EROSION_ROCK_GEO, erosionMat, erosionInstances.length);
    erosionInstances.forEach((r, i) => {
      _pos.set(r.x, r.y, r.z);
      _quat.setFromEuler(new THREE.Euler(0, r.rotY, 0));
      _scale.set(r.s, r.s, r.s);
      _mtx.compose(_pos, _quat, _scale);
      erosionMesh.setMatrixAt(i, _mtx);
    });
    erosionMesh.instanceMatrix.needsUpdate = true;
    group.add(erosionMesh);
  }

  // Pedras soltas espalhadas (InstancedMesh)
  const looseCount = 40;
  const looseMesh = new THREE.InstancedMesh(_DESERT_LOOSE_ROCK_GEO, _looseRockMaterial(), looseCount);
  let placed = 0;
  for (let i = 0; i < looseCount; i++) {
    const rx = (Math.random() - 0.5) * 1000;
    const rz = (Math.random() - 0.5) * 1000;
    if (Math.hypot(rx, rz + 150) < 260) continue;
    const s = 1 + Math.random() * 3;
    _pos.set(rx, s * 0.4, rz);
    _quat.setFromEuler(new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI));
    _scale.set(s, s, s);
    _mtx.compose(_pos, _quat, _scale);
    looseMesh.setMatrixAt(placed, _mtx);
    placed++;
  }
  looseMesh.count = placed;
  looseMesh.instanceMatrix.needsUpdate = true;
  group.add(looseMesh);

  return { colliders, clouds: [] };
}

if (typeof MAP_REGISTRY !== 'undefined') {
  MAP_REGISTRY.deserto = buildMapDeserto;
}