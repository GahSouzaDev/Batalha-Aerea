// plane-model-realistic.js
// ================================================================
// MODELO 3D "REALISTA" (.glb) — alternativa aos aviões poligonais.
// ================================================================

if (typeof window !== 'undefined' && !window.__realisticModelV8Shown) {
  window.__realisticModelV8Shown = true;
  console.log('%c[MODELO REALISTA] ARQUIVO V8 CARREGADO', 'background:#0f0;color:#000;font-size:16px;font-weight:bold;');
}

const REALISTIC_MODEL_DEFAULT_PATH1 = 'models/Meshy_AI_Shadow_Wings_Over_Clo_0719002657_texture.glb';
const REALISTIC_MODEL_DEFAULT_PATH2 = 'models/Meshy_AI_ATR.glb';
const REALISTIC_MODEL_DEFAULT_PATH3 = 'models/Meshy_AI_caça.glb'; // usado pelo Gripen (chave "jato")
const REALISTIC_MODEL_DEFAULT_PATH4 = 'models/Meshy_AI_Nightshade_Twin_Prop__0718140943_texture.glb';
const REALISTIC_MODEL_DEFAULT_PATH5 = 'models/Meshy_AI_Sovni.glb';
const REALISTIC_MODEL_DEFAULT_PATH6 = 'models/Meshy_AI_A380.glb'; // usado pelo A380 (chave "boing")

// NOVOS CAMINHOS (ainda com fallback, mas já preparados)
const REALISTIC_MODEL_DEFAULT_PATH7 = 'models/Meshy_AI_amx.glb';
const REALISTIC_MODEL_DEFAULT_PATH8 = 'models/Meshy_AI_F_22_Raptor_0723131547_texture.glb';
const REALISTIC_MODEL_DEFAULT_PATH9 = 'models/Meshy_AI_Boeing_737_Flight_Tes_0723133039_texture.glb';
const REALISTIC_MODEL_DEFAULT_PATH10 = 'models/Meshy_AI_14bis.glb';
const REALISTIC_MODEL_DEFAULT_PATH11 = 'models/Meshy_AI_Red_German_WWI_Biplan_0724164544_texture.glb';
const REALISTIC_MODEL_DEFAULT_PATH12 = 'models/Meshy_AI_Violet_Twinjet_0724185339_texture.glb';
const REALISTIC_MODEL_DEFAULT_PATH13 = 'models/Meshy_AI_Silent_Shadow_Wing_0724222835_texture.glb';
const REALISTIC_MODEL_DEFAULT_PATH14 = 'models/Meshy_AI_White_Helicopter_in_F_0724231045_texture.glb';
const REALISTIC_MODEL_DEFAULT_PATH15 = 'models/Meshy_AI_Weathered_X_Wing_Star_0724233703_texture.glb';

// ================================================================
// ESPECIFICAÇÕES DOS MODELOS .GLB (COM CORES E VELOCIDADES INDIVIDUAIS)
// ================================================================
const REALISTIC_MODEL_SPECS = {
  cessna: {
    path: REALISTIC_MODEL_DEFAULT_PATH1, scale: 2.3, rotationY: Math.PI / -2, yOffset: 0.57,
    shadowRadius: 1.7, fires: [],
    propellers: [{ x: 0, y: 0.8, z: -1.95, speedMultiplier: 2.0, scale: 1.5 }], 
  },
  bimotor: {
    path: REALISTIC_MODEL_DEFAULT_PATH2, scale: 3.5, rotationY: Math.PI / -2, yOffset: 0.85,
    shadowRadius: 2.5,
    fires: [ 
      { x: 1.15, y: 0.9, z: 0.5, rotationY: Math.PI, speedMultiplier: 1.0, color: 0xff5500 }, 
      { x: -1.15, y: 0.9, z: 0.5, rotationY: Math.PI, speedMultiplier: 1.0, color: 0xff5500 }
    ],
    propellers: [ { x: 1.15, y: 1, z: -0.9, speedMultiplier: 2.0, scale: 1.3 }, { x: -1.15, y: 1, z: -0.9, speedMultiplier: 2.0, scale: 1.3 } ],
  },
  jato: {
    path: REALISTIC_MODEL_DEFAULT_PATH3, scale: 3.3, rotationY: Math.PI / -2, yOffset: 0.77,
    shadowRadius: 1.7,
    fires: [ { x: 0, y: 0.45, z: 3, rotationY: Math.PI, speedMultiplier: 1.0, color: 0xff5500 } ],
    propellers: [],
  },
  amx: {
    path: REALISTIC_MODEL_DEFAULT_PATH7, scale: 3.1, rotationY: Math.PI / -2, yOffset: 0.77,
    shadowRadius: 1.6,
    fires: [ { x: 0, y: 0.5, z: 3, rotationY: Math.PI, speedMultiplier: 1.0, color: 0x8888ff  } ],
    propellers: [],
  },
  f22: {
    path: REALISTIC_MODEL_DEFAULT_PATH8, scale: 3.4, rotationY: Math.PI / -2, yOffset: 0.77,
    shadowRadius: 1.8,
    fires: [ 
      { x: 0.33, y: 0.33, z: 3.3, rotationY: Math.PI, speedMultiplier: 1.0, color: 0x8888ff }, 
      { x: -0.33, y: 0.33, z: 3.3, rotationY: Math.PI, speedMultiplier: 1.0, color: 0x8888ff  } 
    ],
    propellers: [],
  },
  sr71: {
    path: REALISTIC_MODEL_DEFAULT_PATH4, scale: 4.5, rotationY: Math.PI / -2, yOffset: 0.77,
    shadowRadius: 2.5,
    fires: [ 
      { x: 1.56, y: 0.5, z: 4.2, rotationY: Math.PI, speedMultiplier: 1.0, color: 0xff0000 }, 
      { x: -1.56, y: 0.5, z: 4.2, rotationY: Math.PI, speedMultiplier: 1.0, color: 0xff0000 } 
    ],
    propellers: [],
  },
  ovni: {
    path: REALISTIC_MODEL_DEFAULT_PATH5, scale: 2.2, rotationY: Math.PI / -2, yOffset: 0.2,
    shadowRadius: 3.0, fires: [], propellers: [],
  },
  boing: {
    path: REALISTIC_MODEL_DEFAULT_PATH6, scale: 5, rotationY: Math.PI / -2, yOffset: 1.3,
    shadowRadius: 2.5,
    fires: [ 
      { x: 1.95, y: 0.3, z: -0.3, rotationY: Math.PI, speedMultiplier: 1.0, color: 0xff5500 }, 
      { x: -1.95, y: 0.3, z: -0.3, rotationY: Math.PI, speedMultiplier: 1.0, color: 0xff5500 }, 
      { x: 3.2, y: 0.4, z: 0.5, rotationY: Math.PI, speedMultiplier: 1.0, color: 0xff5500 }, 
      { x: -3.2, y: 0.4, z: 0.5, rotationY: Math.PI, speedMultiplier: 1.0, color: 0xff5500 } 
    ],
    propellers: [],
  },
  b737: {
    path: REALISTIC_MODEL_DEFAULT_PATH9, scale: 4.2, rotationY: Math.PI / -2, yOffset: 1.5,
    shadowRadius: 2.2,
    fires: [ 
      { x: 1.3, y: 0.27, z: 0, rotationY: Math.PI, speedMultiplier: 1.0, color: 0x8888ff }, 
      { x: -1.3, y: 0.27, z: 0, rotationY: Math.PI, speedMultiplier: 1.0, color: 0x8888ff  } 
    ],
    propellers: [],
  },
  quatorzebis: {
    path: REALISTIC_MODEL_DEFAULT_PATH10, scale: 2.4, rotationY: Math.PI / 180, yOffset: 0.77, 
    shadowRadius: 1.6, fires: [],
    propellers: [{ x: 0.05, y: 0.8, z: 2, speedMultiplier: 1.2, scale: 0.9 }], 
  },
  biplano: {
    path: REALISTIC_MODEL_DEFAULT_PATH11, scale: 2.1, rotationY: Math.PI / -2, yOffset: 0.77,
    shadowRadius: 1.7, fires: [],
    propellers: [{ x: 0, y: 1, z: -1.55, speedMultiplier: 2.0, scale: 2.0 }],
  },
  seneca: {
    path: REALISTIC_MODEL_DEFAULT_PATH12, scale: 3.2, rotationY: Math.PI / -2, yOffset: 0.65,
    shadowRadius: 2.2, fires: [],
    propellers: [ { x: 1, y: 0.7, z: -1.95, speedMultiplier: 1.0, scale: 1.5 }, { x: -1, y: 0.7, z: -1.95, speedMultiplier: 1.0, scale: 1.5 } ],
  },
  b2spirit: {
    path: REALISTIC_MODEL_DEFAULT_PATH13, scale: 4.6, rotationY: Math.PI / -2, yOffset: 0.2,
    shadowRadius: 2.4,
    fires: [ 
      { x: 0.9, y: 0.1, z: 2.35, rotationY: Math.PI, speedMultiplier: 1.0, color:0xff0000  }, 
      { x: -0.9, y: 0.1, z: 2.35, rotationY: Math.PI, speedMultiplier: 1.0, color: 0xff0000  } 
    ],
    propellers: [],
  },
  heli: {
    path: REALISTIC_MODEL_DEFAULT_PATH14, scale: 2.0, rotationY: Math.PI / -2, yOffset: 0.5,
    shadowRadius: 2.0, fires: [],
    propellers: [
      // Hélice principal (rotor de cima, disco horizontal — gira em torno
      // do eixo Y/vertical).
      { x: 0, y: 1.2, z: -0.3, axis: 'y', speedMultiplier: 0.6, scale: 4.0 },
      // PEDIDO: hélice de cauda, na ponta do "boom" traseiro (Z positivo =
      // cauda, mesma convenção do modelo poligonal) — disco vertical, de
      // lado, girando em torno do eixo X. Posição é uma estimativa (não
      // temos acesso à geometria exata do .glb); se não bater certinho com
      // a ponta do boom do seu modelo, me diga o quanto ajustar em X/Y/Z
      // que eu corrijo os números.
      { x: 0.1, y: 0.78, z: 1.65, axis: 'x', speedMultiplier: 1.4, scale: 0.55 },
    ],
  },
  xwing: {
    path: REALISTIC_MODEL_DEFAULT_PATH15, scale: 3.3, rotationY: Math.PI / -2, yOffset: 0.77,
    shadowRadius: 1.7,
    fires: [ 
      { x: 0.6, y: 0.1, z: 3.5, rotationY: Math.PI, speedMultiplier: 1.0, color: 0x8888ff }, 
      { x: -0.6, y: 0.1, z: 3.5, rotationY: Math.PI, speedMultiplier: 1.0, color: 0x8888ff },
       { x: 0.6, y: 1.4, z: 3.5, rotationY: Math.PI, speedMultiplier: 1.0, color: 0x8888ff }, 
      { x: -0.6, y: 1.4, z: 3.5, rotationY: Math.PI, speedMultiplier: 1.0, color: 0x8888ff }  
    ],
    propellers: [],
  },
};

const sharedGLTFLoader = (typeof THREE !== 'undefined' && typeof THREE.GLTFLoader === 'function')
  ? new THREE.GLTFLoader(assetLoadingManager)
  : null;

const _realisticModelCache = {};
const _realisticModelPending = {};

function _loadRealisticModelScene(path, onReady) {
  if (_realisticModelCache[path]) { onReady(_realisticModelCache[path]); return; }
  if (!sharedGLTFLoader) { console.warn('THREE.GLTFLoader não encontrado'); return; }
  if (!_realisticModelPending[path]) _realisticModelPending[path] = [];
  _realisticModelPending[path].push(onReady);
  if (_realisticModelPending[path].length > 1) return;

  sharedGLTFLoader.load(path, (gltf) => {
    _realisticModelCache[path] = gltf.scene;
    _realisticModelPending[path].forEach(cb => cb(gltf.scene));
    _realisticModelPending[path] = [];
  }, undefined, (err) => {
    console.error('Falha ao carregar modelo realista:', path, err);
    _realisticModelPending[path] = [];
  });
}

// ================================================================
// SISTEMA DE FOGO DINÂMICO (COM VELOCIDADE E COR INDIVIDUAL)
// ================================================================
function _createEngineFireFX(localPositions) {
  const emitters = (localPositions || []).map((pos, i) => {
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array(60 * 3);
    for (let i2 = 0; i2 < 60; i2++) {
      verts[i2 * 3] = (Math.random() - 0.5) * 0.3;
      verts[i2 * 3 + 1] = (Math.random() - 0.5) * 0.3;
      verts[i2 * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    
    // ===== CRIA UM MATERIAL ÚNICO COM A COR ESPECÍFICA DO MOTOR =====
    const fireMaterial = new THREE.PointsMaterial({
      color: pos.color || 0xff4500, // Define a cor (fallback para laranja se não definida)
      size: 0.1, 
      transparent: true, 
      opacity: 0.8, 
      blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(geo, fireMaterial);
    points.position.set(pos.x, pos.y, pos.z);
    if (pos.rotationY !== undefined) points.rotation.y = pos.rotationY;
    
    points.userData.speedMultiplier = pos.speedMultiplier || 1.0;

    let light = null;
    // Cria uma luz somente para o primeiro motor (para não pesar o jogo com 20 PointLights)
    if (i === 0) {
      light = new THREE.PointLight(pos.color || 0xff4500, 0.5, 5);
      light.position.copy(points.position);
    }
    return { points, light, material: fireMaterial };
  });

  function animate(currentSpeed) {
    const baseFireSpeed = 0.02 + (currentSpeed * 0.15);

    emitters.forEach(({ points }) => {
      const multiplier = points.userData.speedMultiplier || 1.0;
      const fireSpeed = baseFireSpeed * multiplier;

      const positions = points.geometry.attributes.position.array;
      for (let i = 0; i < 60; i++) {
        positions[i * 3 + 2] -= fireSpeed;
        if (positions[i * 3 + 2] < -0.5) {
          positions[i * 3] = (Math.random() - 0.5) * 0.3;
          positions[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
          positions[i * 3 + 2] = 0.5;
        }
      }
      points.geometry.attributes.position.needsUpdate = true;
    });
  }

  function dispose() {
    emitters.forEach(({ points, material }) => { 
      points.geometry.dispose(); 
      material.dispose(); 
    });
  }
  return { emitters, animate, dispose };
}

// ================================================================
// PÁ SINTÉTICA (fallback quando o .glb não tem a hélice já modelada)
// ================================================================
// CORREÇÃO: antes a caixa da pá era SEMPRE comprida no eixo Y (vertical),
// o que funciona pra hélice "de nariz" (gira em torno de Z) e pra hélice
// "de cauda" (gira em torno de X) — mas pra hélice PRINCIPAL de
// helicóptero (gira em torno do próprio Y, o eixo vertical) isso fazia a
// pá girar "em cima do próprio comprimento": sem nenhum efeito visual,
// parecia travada mesmo girando de verdade nos números. Agora a
// orientação da pá muda de acordo com o eixo de giro, sempre perpendicular
// a ele. Também foi corrigida a 2ª pá: antes era uma cópia sobreposta e
// invisível (mesma caixa, sem deslocamento real); agora forma uma cruz de
// verdade (90° da primeira), ficando parecida com um rotor real girando.
function _createSyntheticBladeGroup(pos) {
  const sizeScale = pos.scale || 1.0;
  const axis = pos.axis || 'z';
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });

  // Comprimento sempre no eixo perpendicular ao giro; espessura nos
  // outros dois.
  const bladeGeo = (axis === 'y')
    ? new THREE.BoxGeometry(0.8 * sizeScale, 0.02 * sizeScale, 0.08 * sizeScale) // deitada, girando em torno de Y
    : new THREE.BoxGeometry(0.08 * sizeScale, 0.8 * sizeScale, 0.02 * sizeScale); // em pé, girando em torno de X ou Z

  const g = new THREE.Group();
  const b1 = new THREE.Mesh(bladeGeo, bladeMat);
  g.add(b1);
  const b2 = new THREE.Mesh(bladeGeo, bladeMat);
  // 2ª pá girada 90° pra formar uma cruz de verdade (não mais sobreposta).
  if (axis === 'y') b2.rotation.y = Math.PI / 2;
  else if (axis === 'x') b2.rotation.x = Math.PI / 2;
  else b2.rotation.z = Math.PI / 2;
  g.add(b2);

  g.position.set(pos.x, pos.y, pos.z);
  g.userData.axis = axis;
  g.userData.speedMultiplier = pos.speedMultiplier || 1.0;
  return g;
}

// ===== BUILDER GENÉRICO =====
function createRealisticPlaneInstance(type, colorHex, options = {}) {
  const scene = options.scene || (typeof window !== 'undefined' && window.scene);
  const listener = options.listener || (typeof window !== 'undefined' && window.listener);
  const spec = REALISTIC_MODEL_SPECS[type] || REALISTIC_MODEL_SPECS.cessna;

  const group = new THREE.Group();
  group.position.set(0, 0, 2);

  let idLight = null;
  if (colorHex) {
    idLight = new THREE.PointLight(colorHex, 1.0, 4);
    idLight.position.set(0, 1.1, 0);
    group.add(idLight);
  }

  let shadow = null;
  if (scene) {
    const shadowGeometry = new THREE.CircleGeometry(spec.shadowRadius, 32);
    const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
    shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    scene.add(shadow);
  }

  const fireFX = _createEngineFireFX(spec.fires);
  fireFX.emitters.forEach(({ points, light }) => { group.add(points); if (light) group.add(light); });

  const modelHolder = new THREE.Group();
  group.add(modelHolder);

  let meshList = [];
  let spinningParts = [];
  const propSpecs = spec.propellers || [];

  _loadRealisticModelScene(spec.path, (cachedScene) => {
    const modelRoot = cachedScene.clone(true);
    modelRoot.scale.setScalar(spec.scale);
    modelRoot.rotation.y = spec.rotationY;
    modelRoot.position.y = spec.yOffset;

    spinningParts = [];
    meshList = [];
    const foundRotorMeshes = [];
    modelRoot.traverse(obj => {
      // CORREÇÃO: regex agora também pega "rotor" (ex: "tail_rotor",
      // "rotor_cauda") — antes só reconhecia propeller/helice/blade, então
      // uma hélice de cauda nomeada assim no .glb passava despercebida e
      // nunca girava.
      if (obj.isMesh && /propeller|helice|blade|rotor/i.test(obj.name || '')) foundRotorMeshes.push(obj);
      if (obj.isMesh && obj.material) {
        obj.material = Array.isArray(obj.material)
          ? obj.material.map(m => m.clone())
          : obj.material.clone();
        meshList.push(obj);
      }
    });

    // ================================================================
    // CORREÇÃO: antes isso era tudo-ou-nada — só criava pás sintéticas se
    // o .glb inteiro não tivesse NENHUMA peça nomeada de hélice/rotor.
    // Bastava o modelo ter UMA peça nomeada (ex: a hélice de nariz) pra
    // hélice de CAUDA sintética nunca ser criada, mesmo pedida na spec.
    // Agora cada hélice da spec (principal, cauda, etc.) é resolvida
    // individualmente: usa a peça já nomeada no .glb se existir nessa
    // posição da lista; senão cria uma pá sintética própria ali.
    // ================================================================
    propSpecs.forEach((pos, index) => {
      const foundMesh = foundRotorMeshes[index];
      if (foundMesh) {
        foundMesh.userData.axis = pos.axis || 'z';
        foundMesh.userData.speedMultiplier = pos.speedMultiplier || 1.0;
        spinningParts.push(foundMesh);
      } else {
        const synthetic = _createSyntheticBladeGroup(pos);
        modelHolder.add(synthetic);
        spinningParts.push(synthetic);
      }
    });

    modelHolder.add(modelRoot);
  });

  let sound = null;
  if (scene && listener) {
    const audioListener = listener || new THREE.AudioListener();
    if (!listener) scene.add(audioListener);
    sound = new THREE.Audio(audioListener);
    group.userData.sound = sound;
  }

  const planeBox = new THREE.Box3().setFromObject(group);

  // ================================================================
  // MÉTODO UPDATE
  // ================================================================
  function update(frame, speedInput) {
    // Calcula velocidade de 0 a 1 e passa para o fogo
    const currentSpeed = Math.min(1, Math.max(0, speedInput || 0));
    fireFX.animate(currentSpeed);
    
    const baseRotSpeed = 0.2 + (speedInput || 0);
    spinningParts.forEach(p => {
      const axis = p.userData.axis || 'z';
      const multiplier = p.userData.speedMultiplier || 1.0;
      const finalSpeed = baseRotSpeed * multiplier;
      
      if (axis === 'z') p.rotation.z += finalSpeed;
      else if (axis === 'y') p.rotation.y += finalSpeed;
      else if (axis === 'x') p.rotation.x += finalSpeed;
    });
  }

  function dispose() {
    if (shadow) {
      if (shadow.parent) shadow.parent.remove(shadow);
      shadow.geometry.dispose();
      shadow.material.dispose();
    }
    fireFX.dispose();
    meshList.forEach(obj => {
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else if (obj.material) obj.material.dispose();
    });
  }

  return {
    group, shadow, planeBox, sound, idLight,
    get colorable() { return meshList; },
    update,
    dispose,
  };
}