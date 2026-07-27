// ================================================================
//  smoke-trail.js — FUMAÇA DE DANO (indicador visual de vida baixa)
// ================================================================
//  PEDIDO: dois níveis de fumaça saindo do avião conforme a vida cai,
//  visível pra TODO MUNDO na sala (seu avião E os aviões remotos) — só
//  visual, NÃO mexe em física/velocidade/handling de jeito nenhum.
//    • abaixo de 90% de vida -> fumaça cinza clara, mais fina/rala.
//    • abaixo de 50% de vida -> fumaça escura, maior/mais densa.
//
//  MULTIPLAYER: não precisa de NENHUM evento novo de rede. A vida de
//  cada jogador já chega pra todo mundo hoje (snapshot do servidor via
//  multiplayer.js), então cada cliente só olha pra vida que já tem em
//  mãos — a sua própria (state.health) e a de cada avião remoto
//  (rp._lastHealth, já atualizado no socket.on('snapshot', ...)) — e
//  decide sozinho se aquele avião deve soltar fumaça. Como todo mundo
//  vê a mesma vida, todo mundo vê a mesma fumaça, sem servidor precisar
//  saber nada sobre isso.
// ================================================================

const SMOKE_TIER1_THRESHOLD = 0.90; // abaixo disso: fumaça leve (cinza clara)
const SMOKE_TIER2_THRESHOLD = 0.50; // abaixo disso: fumaça pesada (escura, maior)

const SMOKE_POOL_SIZE = 22; // partículas por avião, recicladas em anel (barato: nada é criado/destruído durante o jogo, só reaproveitado)

// ---- textura compartilhada (gerada 1x, igual ao padrão já usado em
// weather.js pra chuva/névoa) ----
let _smokeTexture = null;
function _buildSmokeTexture() {
  if (_smokeTexture) return _smokeTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  _smokeTexture = new THREE.CanvasTexture(canvas);
  return _smokeTexture;
}

// Cria o "emissor" de um avião: um pool fixo de sprites recicláveis
// (não usa THREE.Points porque cada partícula precisa da própria
// opacidade/escala animada independentemente, o que Points não permite
// sem shader customizado — com poucos aviões na tela, sprites indivi-
// duais são baratos o suficiente).
function createSmokeEmitter() {
  const texture = _buildSmokeTexture();
  const sprites = [];
  for (let i = 0; i < SMOKE_POOL_SIZE; i++) {
    const mat = new THREE.SpriteMaterial({
      map: texture, transparent: true, opacity: 0, depthWrite: false,
      color: 0xaaaaaa,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.visible = false;
    sprite.scale.set(0.001, 0.001, 0.001);
    scene.add(sprite);
    sprites.push({ sprite, mat, life: 0, maxLife: 1, baseOpacity: 0, baseScale: 1, vel: new THREE.Vector3() });
  }
  return { sprites, cursor: 0, spawnTimer: 0 };
}

// Libera os sprites de um emissor da cena — chamado quando um jogador
// remoto sai da sala/partida (ver multiplayer.js), senão a fumaça dele
// ficaria "fantasma" flutuando pra sempre onde ele desapareceu.
function disposeSmokeEmitter(emitter) {
  if (!emitter) return;
  emitter.sprites.forEach(p => {
    scene.remove(p.sprite);
    p.mat.dispose();
  });
  emitter.sprites.length = 0;
}
window.disposeSmokeEmitter = disposeSmokeEmitter;

// Mesmo padrão de offset já usado no rastro de fogo do Bimotor (ver
// abilities.js/spawnFireTrailPuff): local (0, y, +Z) rotacionado pelo
// quaternion do avião cai atrás da cauda, já que "pra frente" do avião
// é -Z local.
const _smokeTailOffset = new THREE.Vector3();
function _tailWorldPos(planeGroup) {
  _smokeTailOffset.set(0, 0.1, 2.0).applyQuaternion(planeGroup.quaternion);
  return planeGroup.position.clone().add(_smokeTailOffset);
}

function _healthTier(hpFrac) {
  if (hpFrac <= SMOKE_TIER2_THRESHOLD) return 2;
  if (hpFrac <= SMOKE_TIER1_THRESHOLD) return 1;
  return 0;
}

function _spawnSmokeParticle(emitter, planeGroup, tier) {
  const slot = emitter.sprites[emitter.cursor];
  emitter.cursor = (emitter.cursor + 1) % emitter.sprites.length;

  const pos = _tailWorldPos(planeGroup);
  pos.x += (Math.random() - 0.5) * 0.3;
  pos.y += (Math.random() - 0.5) * 0.2;
  pos.z += (Math.random() - 0.5) * 0.3;

  const dark = tier === 2;
  slot.sprite.position.copy(pos);
  slot.sprite.visible = true;
  slot.mat.color.setHex(dark ? 0x2c2c2c : 0xcfcfcf);
  slot.baseOpacity = dark ? 0.55 : 0.38;
  slot.mat.opacity = slot.baseOpacity;
  slot.baseScale = dark ? (1.7 + Math.random() * 0.6) : (0.9 + Math.random() * 0.4);
  slot.sprite.scale.set(slot.baseScale * 0.5, slot.baseScale * 0.5, slot.baseScale * 0.5);
  slot.maxLife = dark ? (1.8 + Math.random() * 0.4) : (1.1 + Math.random() * 0.3);
  slot.life = slot.maxLife;
  // sobe devagar e se espalha um pouco lateralmente — leitura de fumaça
  // subindo, sem precisar simular vento de verdade.
  slot.vel.set((Math.random() - 0.5) * 0.6, 0.9 + Math.random() * 0.5, (Math.random() - 0.5) * 0.6);
}

// alive=false: avião morreu/saiu — não solta fumaça NOVA, mas deixa a
// que já estava solta terminar de subir/sumir naturalmente (não corta
// tudo de repente, fica mais natural).
function updateSmokeEmitter(emitter, planeGroup, hpFrac, dt, alive) {
  const tier = alive ? _healthTier(hpFrac) : 0;

  if (tier > 0) {
    emitter.spawnTimer -= dt;
    const interval = tier === 2 ? 0.05 : 0.11;
    if (emitter.spawnTimer <= 0) {
      emitter.spawnTimer = interval;
      _spawnSmokeParticle(emitter, planeGroup, tier);
    }
  }

  emitter.sprites.forEach(p => {
    if (p.life <= 0) return;
    p.life -= dt;
    if (p.life <= 0) { p.sprite.visible = false; p.mat.opacity = 0; return; }
    p.sprite.position.addScaledVector(p.vel, dt);
    const t = 1 - p.life / p.maxLife; // 0 = acabou de nascer, 1 = morrendo
    p.mat.opacity = (1 - t) * p.baseOpacity;
    const scale = p.baseScale * (0.5 + t * 1.2); // cresce enquanto se dissipa, igual fumaça de verdade
    p.sprite.scale.set(scale, scale, scale);
  });
}

// ================================================================
//  API — chamada a cada frame por main.js, dentro do bloco de
//  simulação rodando (mesmo padrão de updateWeather/updateMissiles).
// ================================================================
let _localSmoke = null;

function updatePlaneSmoke(dt) {
  if (typeof vehicle === 'undefined' || !localParts) return;

  if (!_localSmoke) _localSmoke = createSmokeEmitter();
  const myHpFrac = (state.maxHealth ? state.health / state.maxHealth : 1);
  const myAlive = !state.isDead && !state.isSpectator && !state.isCrashed;
  updateSmokeEmitter(_localSmoke, vehicle, myHpFrac, dt, myAlive);

  if (typeof remotePlayers !== 'undefined') {
    remotePlayers.forEach(rp => {
      if (!rp.mesh) return;
      if (!rp._smoke) rp._smoke = createSmokeEmitter();
      const hpFrac = (rp._lastHealth != null ? rp._lastHealth / MAX_HEALTH : 1);
      updateSmokeEmitter(rp._smoke, rp.mesh, hpFrac, dt, !!rp.alive);
    });
  }
}
window.updatePlaneSmoke = updatePlaneSmoke;