// ================================================================
//  SETUP THREE.JS
// ================================================================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 100, 600);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 3000);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
container.appendChild(renderer.domElement);

// ===== SOM POSICIONAL (o som do motor sai do avião de verdade) =====
const audioListener = new THREE.AudioListener();
camera.add(audioListener);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ================================================================
//  LUZES
// ================================================================
const hemi = new THREE.HemisphereLight(0x8fd8ff, 0x2a3a1a, 0.7);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4e0, 1.3);
sun.position.set(150, 220, 100);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -250;
sun.shadow.camera.right = 250;
sun.shadow.camera.top = 250;
sun.shadow.camera.bottom = -250;
sun.shadow.camera.far = 700;
sun.shadow.bias = -0.001;
scene.add(sun);
const rim = new THREE.DirectionalLight(0x4466ff, 0.2);
rim.position.set(-100, 60, -140);
scene.add(rim);
