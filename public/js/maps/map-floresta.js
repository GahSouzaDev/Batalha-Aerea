// ================================================================
//  MAPA "FLORESTA" — chão de grama, árvores em profusão e nuvens no
//  céu.
//
//  PERFORMANCE (CORREÇÃO): esse era o mapa mais lento de carregar dos
//  três novos. Causas:
//   1) a textura de grama (canvas com milhares de fillRect) era gerada
//      do zero toda vez — agora é cacheada (gerada 1x só).
//   2) cada uma das 260 árvores criava 3 geometrias PRÓPRIAS (tronco +
//      2 cones de folhagem) — 780 geometrias no total, cada uma com
//      seus buffers alocados na hora. Agora as árvores compartilham as
//      mesmas 3 geometrias (só a cor/posição/rotação/escala mudam por
//      árvore).
//   3) os 150 arbustos e as 35 nuvens (decoração, sem colisão) viravam
//      150+35 meshes separados — agora são 2 InstancedMesh (1 desenho
//      cada, muito mais barato de montar e de renderizar).
//  As árvores continuam sendo THREE.Group individuais (precisam de
//  colisão própria, então mantemos o boundingBox por árvore).
// ================================================================

// ---- textura de grama: gerada uma única vez e cacheada ----
let _forestGrassTextureCache = null;
function _buildGrassTexture() {
  if (_forestGrassTextureCache) return _forestGrassTextureCache;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3f7d3a';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 4500; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const shade = Math.random() * 50 - 25;
    ctx.fillStyle = `rgba(${50 + shade | 0},${110 + shade | 0},${45 + shade * 0.6 | 0},0.4)`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(90, 90);
  _forestGrassTextureCache = tex;
  return tex;
}

// ---- geometrias/materiais compartilhados entre todas as árvores ----
const _TREE_TRUNK_GEO = new THREE.CylinderGeometry(0.3, 0.4, 4, 8);
const _TREE_TRUNK_MAT = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.9 });
const _TREE_FOLIAGE_GEO_1 = new THREE.ConeGeometry(3.0, 6.2, 8);   // valores médios; escala por árvore ajusta o tamanho final
const _TREE_FOLIAGE_GEO_2 = new THREE.ConeGeometry(2.0, 3.5, 8);
const _TREE_FOLIAGE_MAT_A = new THREE.MeshStandardMaterial({ color: 0x2E8B57, roughness: 0.75 });
const _TREE_FOLIAGE_MAT_B = new THREE.MeshStandardMaterial({ color: 0x256b45, roughness: 0.75 });
const _BUSH_GEO = new THREE.SphereGeometry(1, 8, 6);
const _BUSH_MAT = new THREE.MeshStandardMaterial({ color: 0x3f7d3a, roughness: 0.9 });
const _CLOUD_GEO = new THREE.SphereGeometry(6, 16, 16);
let _cloudMat = null;
function _cloudMaterial() {
  if (!_cloudMat) _cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, fog: false });
  return _cloudMat;
}

function buildMapFloresta(group) {
  const colliders = [];
  const _mtx = new THREE.Matrix4();
  const _pos = new THREE.Vector3();
  const _quat = new THREE.Quaternion();
  const _scale = new THREE.Vector3();
  const _euler = new THREE.Euler();

  // ===== CHÃO DE GRAMA =====
  const grassTexture = _buildGrassTexture();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1300, 1300),
    new THREE.MeshStandardMaterial({ map: grassTexture, color: 0xffffff, roughness: 1.0 })
  );
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  // Clareira central + pista de terra batida pra decolar
  const runway = new THREE.Mesh(new THREE.PlaneGeometry(9, 100), new THREE.MeshStandardMaterial({ color: 0x6b5636, roughness: 1.0 }));
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(0, 0.015, -46.5);
  group.add(runway);

  group.userData.skyColor = 0x9fd6ef;
  group.userData.fogNear = 90;
  group.userData.fogFar = 520;

  // ===== ÁRVORES ===== (geometria compartilhada, mas cada árvore ainda
  // é um Group próprio pra manter colisão individual)
  function createTree(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(_TREE_TRUNK_GEO, _TREE_TRUNK_MAT);
    trunk.position.y = 2; g.add(trunk);
    const foliageMat = Math.random() < 0.5 ? _TREE_FOLIAGE_MAT_A : _TREE_FOLIAGE_MAT_B;
    const foliageScale = (2.6 + Math.random()) / 3.0; // ajusta o cone-base pro tamanho variado que existia antes
    const foliage = new THREE.Mesh(_TREE_FOLIAGE_GEO_1, foliageMat);
    foliage.position.y = 5.6; foliage.scale.set(foliageScale, (5.5 + Math.random() * 2) / 6.2, foliageScale);
    g.add(foliage);
    const foliage2 = new THREE.Mesh(_TREE_FOLIAGE_GEO_2, foliageMat);
    foliage2.position.y = 7.6; g.add(foliage2);
    g.position.set(x, 0, z);
    g.rotation.y = Math.random() * Math.PI * 2;
    const scale = 0.85 + Math.random() * 0.5;
    g.scale.set(scale, scale, scale);
    group.add(g);
    g.boundingBox = new THREE.Box3().setFromObject(g);
    return g;
  }

  const trees = [];
  const clearRadius = 90; // mantém a área de decolagem/pouso livre de árvores
  for (let i = 0; i < 260; i++) {
    const x = (Math.random() - 0.5) * 1250;
    const z = (Math.random() - 0.5) * 1250;
    if (Math.hypot(x, z) < clearRadius) continue;
    trees.push(createTree(x, z));
  }

  // Alguns arbustos baixos (decoração, sem colisão) — 1 InstancedMesh
  // em vez de 150 meshes separados.
  const bushCount = 150;
  const bushMesh = new THREE.InstancedMesh(_BUSH_GEO, _BUSH_MAT, bushCount);
  let bushesPlaced = 0;
  for (let i = 0; i < bushCount; i++) {
    const x = (Math.random() - 0.5) * 1250;
    const z = (Math.random() - 0.5) * 1250;
    if (Math.hypot(x, z) < clearRadius * 0.6) continue;
    const s = 1 + Math.random();
    _pos.set(x, 0.6, z);
    _quat.identity();
    _scale.set(s, s * 0.6, s);
    _mtx.compose(_pos, _quat, _scale);
    bushMesh.setMatrixAt(bushesPlaced, _mtx);
    bushesPlaced++;
  }
  bushMesh.count = bushesPlaced;
  bushMesh.instanceMatrix.needsUpdate = true;
  group.add(bushMesh);

  // ===== NUVENS ===== — 1 InstancedMesh em vez de 35 meshes separados.
  const clouds = [];
  const cloudCount = 35;
  const cloudMesh = new THREE.InstancedMesh(_CLOUD_GEO, _cloudMaterial(), cloudCount);
  for (let i = 0; i < cloudCount; i++) {
    const x = (Math.random() - 0.5) * 1000;
    const z = (Math.random() - 0.5) * 1000;
    const y = 95 + Math.random() * 40;
    _pos.set(x, y, z);
    _quat.identity();
    _scale.set(1.6 + Math.random(), 0.6, 1.1 + Math.random() * 0.5);
    _mtx.compose(_pos, _quat, _scale);
    cloudMesh.setMatrixAt(i, _mtx);
  }
  cloudMesh.instanceMatrix.needsUpdate = true;
  group.add(cloudMesh);
  // `clouds` fica vazio de propósito: o array antigo existia pra permitir
  // animar nuvem por nuvem, mas nenhum outro arquivo lê esse retorno pra
  // floresta hoje — o clima (weather.js) tem seu próprio sistema de
  // partículas separado.

  colliders.push(...trees);
  return { colliders, clouds };
}

if (typeof MAP_REGISTRY !== 'undefined') {
  MAP_REGISTRY.floresta = buildMapFloresta;
}