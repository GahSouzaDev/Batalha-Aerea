// ================================================================
//  MAPA "LABORATÓRIO" — ambiente fechado/estilizado "Matrix": piso em
//  grade neon verde, névoa escura, colunas/pilares de servidor (com
//  colisão) e uma leve "chuva digital" de partículas verdes caindo.
//  Esse mapa NÃO participa do sistema de clima (weather.js) — ele já
//  tem sua própria atmosfera fixa, então nem sandstorm/chuva/neblina
//  nem o dirigível aparecem aqui (ver MAP_WEATHER_PROFILES).
//
//  PERFORMANCE (CORREÇÃO): a textura de grade (canvas) era gerada do
//  zero toda vez — agora é cacheada. Os 22 pilares também usavam uma
//  BoxGeometry NOVA por pilar (só pra poder ter alturas diferentes) e
//  um material clonado por pilar; agora é 1 geometria unitária
//  reaproveitada (a altura vira escala no eixo Y) e 1 material
//  compartilhado — e as faixinhas brilhantes (5 por pilar = 110 no
//  total) viraram um único InstancedMesh.
// ================================================================

// ---- textura de grade: gerada uma única vez e cacheada ----
let _labGridTextureCache = null;
function _buildGridTexture() {
  if (_labGridTextureCache) return _labGridTextureCache;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#020604';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(0,255,120,0.55)';
  ctx.lineWidth = 2;
  const step = 32;
  for (let i = 0; i <= size; i += step) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(0,255,140,0.9)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= size; i += step * 4) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(60, 60);
  _labGridTextureCache = tex;
  return tex;
}

// ---- geometria/material compartilhados dos pilares ----
// Geometria unitária (altura 1): cada pilar escala o eixo Y pra virar a
// altura de verdade, em vez de criar uma BoxGeometry nova por altura.
const _LAB_PILLAR_GEO = new THREE.BoxGeometry(6, 1, 6);
let _labPillarMat = null;
function _pillarMaterial() {
  if (!_labPillarMat) {
    _labPillarMat = new THREE.MeshStandardMaterial({ color: 0x0a0f0c, emissive: 0x00ff88, emissiveIntensity: 0.35, roughness: 0.4, metalness: 0.6 });
  }
  return _labPillarMat;
}
const _LAB_STRIPE_GEO = new THREE.BoxGeometry(6.05, 1, 6.05);
let _labStripeMat = null;
function _stripeMaterial() {
  if (!_labStripeMat) _labStripeMat = new THREE.MeshBasicMaterial({ color: 0x00ff99 });
  return _labStripeMat;
}

function buildMapLaboratorio(group) {
  const colliders = [];
  const _mtx = new THREE.Matrix4();
  const _pos = new THREE.Vector3();
  const _quat = new THREE.Quaternion();
  const _scale = new THREE.Vector3();

  // ===== CHÃO EM GRADE NEON =====
  const gridTexture = _buildGridTexture();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1300, 1300),
    new THREE.MeshStandardMaterial({ map: gridTexture, color: 0xffffff, emissive: 0x003318, emissiveIntensity: 0.4, roughness: 0.6, metalness: 0.3 })
  );
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  const runway = new THREE.Mesh(new THREE.PlaneGeometry(9, 100), new THREE.MeshStandardMaterial({ color: 0x001a0d, emissive: 0x00ff88, emissiveIntensity: 0.15 }));
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(0, 0.02, -46.5);
  group.add(runway);

  // Céu/névoa bem escuros com tingimento verde — a própria "cara" do
  // mapa já é a atmosfera do Matrix, por isso ele fica de fora do
  // ciclo dinâmico de clima.
  group.userData.skyColor = 0x02100a;
  group.userData.fogNear = 60;
  group.userData.fogFar = 420;
  group.userData.fogColor = 0x03170d;

  // ===== "COLUNAS DE SERVIDOR" (pilares com colisão) =====
  const pillarMat = _pillarMaterial();
  const stripeMat = _stripeMaterial();
  const pillarPositions = [];
  const ring1 = 8, ring2 = 14;
  for (let i = 0; i < ring1; i++) {
    const angle = (i / ring1) * Math.PI * 2;
    pillarPositions.push([Math.cos(angle) * 130, Math.sin(angle) * 130 - 20]);
  }
  for (let i = 0; i < ring2; i++) {
    const angle = (i / ring2) * Math.PI * 2 + 0.3;
    pillarPositions.push([Math.cos(angle) * 260, Math.sin(angle) * 260 - 20]);
  }

  const pillars = [];
  const stripeInstances = []; // { x, y, z, height }
  pillarPositions.forEach(([x, z]) => {
    const height = 26 + Math.random() * 18;
    const pillar = new THREE.Mesh(_LAB_PILLAR_GEO, pillarMat);
    pillar.position.set(x, height / 2, z);
    pillar.scale.set(1, height, 1);
    group.add(pillar);
    // colisão calculada direto (mais barato que setFromObject numa
    // geometria unitária escalada — o resultado é sempre a mesma caixa
    // 6x(altura)x6 centrada na posição do pilar).
    pillar.boundingBox = new THREE.Box3(
      new THREE.Vector3(x - 3, 0, z - 3),
      new THREE.Vector3(x + 3, height, z + 3)
    );
    pillars.push(pillar);

    // faixinhas horizontais brilhantes (cosmético) — só empilha os
    // dados aqui, vira um InstancedMesh só no final.
    for (let i = 0; i < 5; i++) {
      stripeInstances.push({ x, y: (i + 1) * (height / 6), z });
    }
  });
  colliders.push(...pillars);

  if (stripeInstances.length) {
    const stripeMesh = new THREE.InstancedMesh(_LAB_STRIPE_GEO, stripeMat, stripeInstances.length);
    stripeInstances.forEach((s, i) => {
      _pos.set(s.x, s.y, s.z);
      _quat.identity();
      _scale.set(1, 0.15, 1);
      _mtx.compose(_pos, _quat, _scale);
      stripeMesh.setMatrixAt(i, _mtx);
    });
    stripeMesh.instanceMatrix.needsUpdate = true;
    group.add(stripeMesh);
  }

  // ===== CHUVA DIGITAL (leve, sem custar caro) =====
  // Um único THREE.Points com glifos simples (quadradinhos verdes),
  // reciclado no update — não é geometria por coluna/letra (isso sim
  // pesaria), é uma nuvem de partículas caindo em looping.
  const DIGITAL_RAIN_COUNT = 700;
  const rainGeo = new THREE.BufferGeometry();
  const rainPositions = new Float32Array(DIGITAL_RAIN_COUNT * 3);
  const spread = 650;
  for (let i = 0; i < DIGITAL_RAIN_COUNT; i++) {
    rainPositions[i * 3] = (Math.random() - 0.5) * spread;
    rainPositions[i * 3 + 1] = Math.random() * 160;
    rainPositions[i * 3 + 2] = (Math.random() - 0.5) * spread;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rainMat = new THREE.PointsMaterial({ color: 0x00ff88, size: 0.9, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
  const digitalRain = new THREE.Points(rainGeo, rainMat);
  group.add(digitalRain);

  // Guarda referência pra o loop principal animar a queda (ver hook em
  // environment.js/main.js: window.__labDigitalRain).
  window.__labDigitalRain = digitalRain;

  return { colliders, clouds: [] };
}

if (typeof MAP_REGISTRY !== 'undefined') {
  MAP_REGISTRY.laboratorio = buildMapLaboratorio;
}