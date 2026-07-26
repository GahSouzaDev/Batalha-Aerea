// environment.js
const envGroup = new THREE.Group();
scene.add(envGroup);
let clouds = [];
let mapColliders = [];

function clearEnv() {
  while (envGroup.children.length) {
    const c = envGroup.children[0];
    c.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) { if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose()); else obj.material.dispose(); }
    });
    envGroup.remove(c);
  }
  clouds = [];
  mapColliders = [];
  window.__labDigitalRain = null;
}

function buildEnvironment(mode) {
  clearEnv();
  scene.background = new THREE.Color(0x87CEEB);
  scene.fog = new THREE.Fog(0x87CEEB, 100, 700);

  envGroup.userData = {};
  const builder = MAP_REGISTRY[mode] || MAP_REGISTRY.cidade;
  const result = builder(envGroup) || {};
  clouds = result.clouds || [];
  mapColliders = result.colliders || [];
  window.__destructibles = [];

  // CORREÇÃO/NOVO: cada mapa pode pedir seu próprio céu/névoa "de base"
  // preenchendo envGroup.userData (ver map-deserto.js, map-floresta.js,
  // map-laboratorio.js) — sem isso todo mapa ficava preso ao azul-céu
  // de Cidade. O mapa Clássico/Cidade não define nada, então mantém o
  // visual de sempre (fallback acima).
  if (envGroup.userData) {
    if (envGroup.userData.skyColor != null) scene.background = new THREE.Color(envGroup.userData.skyColor);
    const fogColor = envGroup.userData.fogColor != null ? envGroup.userData.fogColor : envGroup.userData.skyColor;
    if (fogColor != null || envGroup.userData.fogNear != null || envGroup.userData.fogFar != null) {
      scene.fog = new THREE.Fog(
        fogColor != null ? fogColor : scene.fog.color.getHex(),
        envGroup.userData.fogNear != null ? envGroup.userData.fogNear : scene.fog.near,
        envGroup.userData.fogFar != null ? envGroup.userData.fogFar : scene.fog.far
      );
    }
  }

  // NOVO: liga/reinicia o sistema de clima dinâmico (chuva, neblina,
  // tempestade de areia, dirigível) pro mapa que acabou de carregar —
  // ver weather.js. Em 'laboratorio' o próprio resetWeather() não
  // agenda nada, porque MAP_WEATHER_PROFILES.laboratorio é vazio.
  if (typeof resetWeather === 'function') resetWeather(mode);
}