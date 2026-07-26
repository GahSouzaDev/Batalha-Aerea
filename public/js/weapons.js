// weapons.js – COMPLETO COM ENVIO DE COR E TIPO NA EXPLOSÃO
const missiles = [];
const bombs = [];
const explosions = [];
const machineGunBullets = [];

let missileCooldown = 0;
const MISSILE_COOLDOWN = 0.5;
let bombCooldown = 0;
// PEDIDO: Bomba (1) com exatamente metade do tempo de recarga do Especial (3).
const BOMB_COOLDOWN = SPECIAL_COOLDOWN / 2;
let superCooldown = 0;
let superReady = true;
// PEDIDO: tecla 2 (agora bomba de área azul, ver fireHeavyBomb) com
// exatamente metade do tempo de recarga da Bomba (1).
const SUPER_COOLDOWN = BOMB_COOLDOWN / 2;
const BOMB_BLAST_RADIUS = 75;
const NORMAL_DMG = 50;
const SUPER_DMG = 100;
const BOMB_DMG = 120;
const MG_DAMAGE = 50;
const MIN_ALTITUDE_FOR_ABILITIES = 3;
// PEDIDO: cor do tiro da tecla 2 mantida igual à cor original dela
// (laranja/dourado do antigo míssil reforçado), só a explosão fica azul.
const HEAVY_BOMB_COLOR = 0xffaa00;
const HEAVY_BOMB_EXPLOSION_COLOR = 0x1e6bff;

const HOMING_ENABLED = true;
const HOMING_RANGE = 100;
const HOMING_ANGLE = 0.5;
const HOMING_TURN_SPEED = 0.5;

// PEDIDO (habilidade do AMX): parâmetro opcional "opts" pra permitir um
// míssil mais lento e com perseguição limitada no tempo, sem mexer no
// comportamento padrão (chamadas antigas continuam iguais, já que opts é
// opcional e cada campo tem fallback pro valor original).
// opts.speed          -> velocidade custom (padrão: 200)
// opts.life           -> tempo de vida custom (padrão: 5.5s)
// opts.homingDuration -> por quantos segundos ESTE míssil ainda persegue
//                        alvo (padrão: null = persegue enquanto existir,
//                        igual sempre foi pro tiro básico)
function spawnMissile(superMissile, origin, direction, isRemote, customColor, opts) {
  opts = opts || {};
  const color = customColor || (superMissile ? 0xffaa00 : 0x00e5ff);
  const speed = opts.speed || 200;
  const dir = direction.clone().normalize();
  const velocity = dir.clone().multiplyScalar(speed);

  const sphereMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.0, roughness: 0.15, metalness: 0.05 });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.50, 12, 12), sphereMat);
  sphere.position.copy(origin);
  sphere.castShadow = true;
  scene.add(sphere);

  const trail = createProjectileTrail(origin, color, 28);
  const light = new THREE.PointLight(color, 1.8, 10);
  light.position.copy(origin);
  scene.add(light);
  setTimeout(() => scene.remove(light), 120);

  missiles.push({
    mesh: sphere, trail, light,
    position: origin.clone(),
    velocity,
    super: superMissile,
    life: opts.life || 5.5,
    ownerId: isRemote ? 'remote' : 'local',
    color,
    age: 0,
    trailPositions: new Array(28).fill(0).map(() => origin.clone()),
    homingTimeLeft: (typeof opts.homingDuration === 'number') ? opts.homingDuration : null
  });
}

// PEDIDO: withTrail liga o rastro do tiro (igual ao rastro do míssil/tiro
// básico) nesta bomba especial. Usado no tiro da tecla 2 (fireHeavyBomb) e
// na habilidade 3 do Cessna (fireCessnaBomb, em abilities.js) — NÃO usado
// no Bombardeio do Boeing (dropBombardeio continua sem rastro).
function dropSpecialBomb(origin, velocity, color, damageFactor = 1.0, radiusFactor = 1.0, isRemote = false, sizeScale = 1.0, explosionColor = null, withTrail = false, withFireTrail = false, gravityMult = 1.0, fireTrailColor = null) {
  const bombMat = new THREE.MeshStandardMaterial({
    color: color || 0xff0000,
    roughness: 0.6,
    metalness: 0.4,
    emissive: color || 0xff0000,
    emissiveIntensity: 0.4
  });
  const bombMesh = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 10), bombMat);
  bombMesh.scale.setScalar(sizeScale);
  bombMesh.position.copy(origin);
  bombMesh.castShadow = true;
  scene.add(bombMesh);

  const trail = withTrail ? createProjectileTrail(origin, color || 0xff0000, 24) : null;

  bombs.push({
    mesh: bombMesh,
    trail,
    position: origin.clone(),
    velocity: velocity.clone(),
    alive: true,
    time: 0,
    isRemote: isRemote,
    isSpecial: true,
    color: color || 0xff0000,
    explosionColor: explosionColor || color || 0xff0000,
    damageFactor: damageFactor,
    radiusFactor: radiusFactor,
    fireTrail: withFireTrail,
    fireTimer: 0,
    fireTrailColor: fireTrailColor,
    // PEDIDO (bombas do B-2 Spirit caindo 2x mais rápido que as do A380):
    // multiplicador aplicado à gravidade só dessa bomba, em updateBombs.
    // Padrão 1.0 não muda em nada o comportamento de todas as outras.
    gravityMult: gravityMult
  });
}

function createProjectileTrail(position, color, count = 28) {
  const trailMat = new THREE.PointsMaterial({ color, size: 0.40, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.85, depthWrite: false, sizeAttenuation: true });
  const positions = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geometry, trailMat);
  scene.add(points);
  for (let i = 0; i < count; i++) { positions[i * 3] = position.x; positions[i * 3 + 1] = position.y; positions[i * 3 + 2] = position.z; }
  geometry.attributes.position.needsUpdate = true;
  return points;
}

function updateWeaponCooldowns(dt) {
  if (missileCooldown > 0) { missileCooldown -= dt; if (missileCooldown < 0) missileCooldown = 0; }
  if (bombCooldown > 0) { bombCooldown -= dt; if (bombCooldown < 0) bombCooldown = 0; }
  if (!superReady) {
    superCooldown -= dt;
    if (superCooldown <= 0) { superCooldown = 0; superReady = true; }
  }
}

function fireMissile(superMissile) {
  if (state.isCar) return;
  if (state.isPaused || state.isDead || state.isSpectator) return;
  if (!combatEnabled) { showTemporaryMessage('⛔ Aguarde liberar o combate!'); return; }
  if (superMissile) { if (!superReady) return; superReady = false; superCooldown = SUPER_COOLDOWN; }
  else { if (missileCooldown > 0) return; missileCooldown = MISSILE_COOLDOWN; }

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2(0, 0);
  raycaster.setFromCamera(mouse, camera);
  const dir = raycaster.ray.direction.clone();
  const targetPoint = camera.position.clone().add(dir.clone().multiplyScalar(100));
  const dirToTarget = targetPoint.clone().sub(state.position).normalize();
  const origin = state.position.clone().add(dirToTarget.clone().multiplyScalar(2.0));

  spawnMissile(superMissile, origin, dirToTarget, false);
  playSound('shot');
  const flash = new THREE.PointLight(superMissile ? 0xffaa00 : 0x00e5ff, 2.0, 6);
  flash.position.copy(origin);
  scene.add(flash);
  setTimeout(() => scene.remove(flash), 80);
  if (onlineState.socket) {
    onlineState.socket.emit('shot-fired', { isSuper: superMissile, origin: origin.toArray(), direction: dirToTarget.toArray(), weaponType: superMissile ? 'missile' : 'normal' });
  }
}

// PEDIDO: tecla 2 deixou de ser o míssil reforçado (homing) e virou um tiro
// de bomba igual ao da Rajada do Cessna — atirado pra frente na mira,
// explode ao tocar o chão/algo, mesma área (radiusFactor 0.5) e mesmo dano
// (metade da vida, precisa de 2 pra matar), só que com a cor do tiro igual
// ao antigo "2" (laranja) e a explosão azul (HEAVY_BOMB_EXPLOSION_COLOR).
// Recarga: metade do tempo da Bomba (1) — ver SUPER_COOLDOWN acima.
function fireHeavyBomb() {
  if (state.isCar) return;
  if (state.isPaused || state.isDead || state.isSpectator) return;
  if (!combatEnabled) { showTemporaryMessage('⛔ Aguarde liberar o combate!'); return; }
  if (!superReady) return;
  superReady = false;
  superCooldown = SUPER_COOLDOWN;

  const dir = getAimDirection();
  const origin = state.position.clone().add(dir.clone().multiplyScalar(2.2));
  const velocity = dir.clone().multiplyScalar(200);
  const damageFactor = (MAX_HEALTH / 2) / BOMB_DMG;
  dropSpecialBomb(origin, velocity, HEAVY_BOMB_COLOR, damageFactor, 0.5, false, 1.0, HEAVY_BOMB_EXPLOSION_COLOR, true);
  playSound('bomb_drop');

  const flash = new THREE.PointLight(HEAVY_BOMB_COLOR, 2.0, 8);
  flash.position.copy(origin);
  scene.add(flash);
  setTimeout(() => scene.remove(flash), 100);

  if (onlineState.socket) {
    onlineState.socket.emit('bomb-fired', {
      origin: origin.toArray(),
      velocity: velocity.toArray(),
      isSpecial: true,
      color: HEAVY_BOMB_COLOR,
      damageFactor: damageFactor,
      radiusFactor: 0.5,
      explosionColor: HEAVY_BOMB_EXPLOSION_COLOR,
      withTrail: true
    });
  }
}

function findNearestTarget(position, maxRange, maxAngle, ignoreId) {
  let bestTarget = null;
  let bestDist = Infinity;

  function checkTarget(targetPos, targetAlive, id) {
    if (!targetAlive) return;
    if (id === ignoreId) return;
    const toTarget = targetPos.clone().sub(position);
    const dist = toTarget.length();
    if (dist > maxRange || dist < 0.5) return;
    if (dist < bestDist) {
      bestDist = dist;
      bestTarget = { pos: targetPos.clone(), id };
    }
  }

  enemyBots.forEach(bot => {
    if (!bot.alive) return;
    checkTarget(bot.mesh.position, bot.alive, 'bot-' + bot.mesh.uuid);
  });

  if (onlineState.socket) {
    remotePlayers.forEach((rp, id) => {
      if (!rp.alive) return;
      checkTarget(rp.mesh.position, rp.alive, id);
    });
  }

  return bestTarget;
}

function hasTargetLock() {
  if (!HOMING_ENABLED) return false;
  if (state.isDead || state.isSpectator || state.isPaused) return false;

  const dir = getAimDirection();
  const origin = state.position.clone().add(dir.clone().multiplyScalar(2.0));

  for (const bot of enemyBots) {
    if (!bot.alive) continue;
    const toTarget = bot.mesh.position.clone().sub(origin);
    const dist = toTarget.length();
    if (dist > HOMING_RANGE) continue;
    const angle = dir.angleTo(toTarget.normalize());
    if (angle < HOMING_ANGLE) {
      return true;
    }
  }

  if (onlineState.socket) {
    for (const [id, rp] of remotePlayers) {
      if (!rp.alive) continue;
      const toTarget = rp.mesh.position.clone().sub(origin);
      const dist = toTarget.length();
      if (dist > HOMING_RANGE) continue;
      const angle = dir.angleTo(toTarget.normalize());
      if (angle < HOMING_ANGLE) {
        return true;
      }
    }
  }

  return false;
}

function updateCrosshairLock() {
  const crosshair = document.getElementById('crosshair');
  if (!crosshair) return;

  const locked = hasTargetLock();
  if (locked) {
    crosshair.classList.add('locked');
  } else {
    crosshair.classList.remove('locked');
  }
}

function updateMissiles(dt) {
  updateCrosshairLock();

  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    m.life -= dt;
    m.age += dt;
    
    if (HOMING_ENABLED && !m.super && m.ownerId === 'local') {
      // PEDIDO (habilidade do AMX): se este míssil tiver um limite de
      // perseguição (homingTimeLeft !== null), ele conta regressivamente e,
      // ao zerar, o míssil para de perseguir e passa a voar reto na última
      // direção — o tiro básico (homingTimeLeft === null) continua
      // perseguindo pra sempre, igual sempre foi.
      let homingAllowed = true;
      if (m.homingTimeLeft !== null) {
        homingAllowed = m.homingTimeLeft > 0;
        m.homingTimeLeft -= dt;
      }
      if (homingAllowed) {
        const target = findNearestTarget(m.position, HOMING_RANGE, HOMING_ANGLE, 'local');
        if (target) {
          const toTarget = target.pos.clone().sub(m.position);
          const distToTarget = toTarget.length();
          if (distToTarget > 0.5) {
            const desiredDir = toTarget.normalize();
            const currentDir = m.velocity.clone().normalize();
            const angle = currentDir.angleTo(desiredDir);
            if (angle > 0.01) {
              const turnAmount = Math.min(HOMING_TURN_SPEED * dt, angle);
              const axis = new THREE.Vector3().crossVectors(currentDir, desiredDir).normalize();
              if (axis.length() > 0.001) {
                const quat = new THREE.Quaternion().setFromAxisAngle(axis, turnAmount);
                const newDir = currentDir.clone().applyQuaternion(quat).normalize();
                const speed = m.velocity.length();
                m.velocity.copy(newDir.multiplyScalar(speed));
              }
            }
          }
        }
      }
    }

    m.position.addScaledVector(m.velocity, dt);
    m.mesh.position.copy(m.position);

    const posAttr = m.trail.geometry.attributes.position;
    const posArray = posAttr.array;
    const count = posArray.length / 3;
    for (let j = count - 1; j > 0; j--) {
      posArray[j * 3] = posArray[(j - 1) * 3];
      posArray[j * 3 + 1] = posArray[(j - 1) * 3 + 1];
      posArray[j * 3 + 2] = posArray[(j - 1) * 3 + 2];
    }
    posArray[0] = m.position.x;
    posArray[1] = m.position.y;
    posArray[2] = m.position.z;
    posAttr.needsUpdate = true;

    if (m.position.y < GROUND_LEVEL + 0.2) { createExplosion(m.position, m.super, false); scene.remove(m.mesh); scene.remove(m.trail); missiles.splice(i, 1); continue; }

    let hit = false;
    if (m.ownerId === 'local') {
      for (const enemy of enemyBots) {
        if (!enemy.alive) continue;
        const dist = m.position.distanceTo(enemy.mesh.position);
        const baseThreshold = m.super ? 3.0 : 1.8;
        const threshold = baseThreshold * HITBOX_SCALE;
        if (dist < threshold) {
          const dmg = m.super ? SUPER_DMG : NORMAL_DMG;
          enemy.health -= dmg;
          createExplosion(m.position, m.super, false);
          cameraShake(0.5, 0.3);
          flashBot(enemy);
          playSound('hit');
          if (enemy.health <= 0) killBot(enemy);
          hit = true;
          break;
        }
      }
      if (!hit && onlineState.socket) {
        for (const [id, rp] of remotePlayers) {
          if (!rp.alive) continue;
          const dist = m.position.distanceTo(rp.mesh.position);
          const baseThreshold = m.super ? 3.0 : 1.8;
          const threshold = baseThreshold * HITBOX_SCALE;
          if (dist < threshold) {
            onlineState.socket.emit('hit', { targetId: id, weaponType: m.super ? 'missile' : 'normal' });
            createExplosion(m.position, m.super, false);
            cameraShake(0.5, 0.3);
            flashRemote(id);
            playSound('hit');
            hit = true;
            break;
          }
        }
      }
    } else if (m.ownerId === 'remote') {
      if (!state.isDead && !state.isSpectator && !state.invulnerable) {
        const dist = m.position.distanceTo(state.position);
        const baseThreshold = m.super ? 3.0 : 1.8;
        const threshold = baseThreshold * HITBOX_SCALE;
        if (dist < threshold) {
          createExplosion(m.position, m.super, false);
          cameraShake(0.6, 0.3);
          applyDamageToPlayer(m.super ? SUPER_DMG : NORMAL_DMG);
          flashVehicle();
          hit = true;
        }
      }
    }

    if (hit) { scene.remove(m.mesh); scene.remove(m.trail); missiles.splice(i, 1); continue; }

    if (window.__destructibles) {
      for (const obj of window.__destructibles) {
        if (!obj.alive) continue;
        const dist = m.position.distanceTo(obj.mesh.position);
        if (dist < 2.0 * HITBOX_SCALE) {
          obj.alive = false; obj.mesh.visible = false;
          createExplosion(obj.mesh.position.clone(), false, false);
          cameraShake(0.3, 0.2);
          hit = true;
          break;
        }
      }
      if (hit) { scene.remove(m.mesh); scene.remove(m.trail); missiles.splice(i, 1); continue; }
    }

    if (!hit && mapColliders && mapColliders.length) {
      for (const coll of mapColliders) {
        if (coll.boundingBox && coll.boundingBox.containsPoint(m.position)) {
          createExplosion(m.position, m.super, false);
          cameraShake(0.5, 0.3);
          playSound('hit');
          hit = true;
          break;
        }
      }
      if (hit) { scene.remove(m.mesh); scene.remove(m.trail); missiles.splice(i, 1); continue; }
    }

    if (m.life <= 0) { scene.remove(m.mesh); scene.remove(m.trail); missiles.splice(i, 1); }
  }
}

function dropBomb(isRemote, remoteOrigin, remoteVelocity) {
  if (!isRemote) {
    if (state.isCar) return;
    if (state.isPaused || state.isDead || state.isSpectator) return;
    if (!combatEnabled) { showTemporaryMessage('⛔ Aguarde liberar o combate!'); return; }
    if (bombCooldown > 0) return;
    if ((state.position.y - GROUND_LEVEL) < MIN_ALTITUDE_FOR_ABILITIES) {
      showTemporaryMessage('⛔ Muito baixo para soltar bomba!');
      return;
    }
  }
  const origin = isRemote ? remoteOrigin.clone() : state.position.clone();
  if (!isRemote) origin.y -= 0.6;
  const bombMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.6, metalness: 0.4, emissive: 0xff4400, emissiveIntensity: 0.15 });
  const bombMesh = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 10), bombMat);
  bombMesh.position.copy(origin);
  bombMesh.castShadow = true;
  scene.add(bombMesh);

  const velocity = isRemote
    ? remoteVelocity.clone()
    : new THREE.Vector3(-state.velocity * Math.sin(state.yaw), -1.5, -state.velocity * Math.cos(state.yaw));

  // PEDIDO: bomba da tecla 1 solta um rastro de fogo (igual ao efeito do
  // ATR na sobrecarga), pra dar pra ver bem quando ela foi solta.
  bombs.push({ mesh: bombMesh, position: origin.clone(), velocity, alive: true, time: 0, isRemote: !!isRemote, isSpecial: false, fireTrail: true, fireTimer: 0 });

  if (!isRemote) {
    bombCooldown = BOMB_COOLDOWN;
    playSound('bomb_drop');
    if (onlineState.socket) onlineState.socket.emit('bomb-fired', { origin: origin.toArray(), velocity: velocity.toArray() });
  }
}

function updateBombs(dt) {
  for (let i = bombs.length - 1; i >= 0; i--) {
    const b = bombs[i];
    if (!b.alive) continue;
    b.time += dt;
    b.velocity.y -= 15 * (b.gravityMult || 1) * dt;
    b.velocity.x *= (1 - 0.02 * dt);
    b.velocity.z *= (1 - 0.02 * dt);
    b.position.addScaledVector(b.velocity, dt);

    // PEDIDO: rastro de fogo (igual ao efeito do ATR na sobrecarga) pras
    // bombas marcadas com fireTrail — bomba da tecla 1 e Bombardeio do
    // Boeing. Solta uma fumaça/labareda atrás da bomba a cada intervalo
    // enquanto ela cai, pra dar pra ver o caminho dela.
    if (b.fireTrail) {
      b.fireTimer -= dt;
      if (b.fireTimer <= 0) {
        b.fireTimer = 0.05;
        spawnFireTrailPuff(b.position.clone(), b.fireTrailColor);
      }
    }

    // PEDIDO: rastro do tiro (tracante) atualizado a cada frame igual ao
    // rastro do míssil, só pras bombas especiais que nasceram com trail
    // (tecla 2 / habilidade 3 do Cessna).
    if (b.trail) {
      const posAttr = b.trail.geometry.attributes.position;
      const posArray = posAttr.array;
      const count = posArray.length / 3;
      for (let j = count - 1; j > 0; j--) {
        posArray[j * 3] = posArray[(j - 1) * 3];
        posArray[j * 3 + 1] = posArray[(j - 1) * 3 + 1];
        posArray[j * 3 + 2] = posArray[(j - 1) * 3 + 2];
      }
      posArray[0] = b.position.x;
      posArray[1] = b.position.y;
      posArray[2] = b.position.z;
      posAttr.needsUpdate = true;
    }

    if (b.position.y < GROUND_LEVEL) {
      b.alive = false;
      const isSpecial = b.isSpecial || false;
      const damage = isSpecial ? BOMB_DMG * (b.damageFactor || 0.5) : BOMB_DMG;
      const radius = isSpecial ? BOMB_BLAST_RADIUS * (b.radiusFactor || 0.5) : BOMB_BLAST_RADIUS;
      const explColor = b.explosionColor || b.color || 0xff8800;
      createExplosion(b.position, true, true, explColor, radius);
      cameraShake(1.2, 0.8);
      playSound('explosion');
      scene.remove(b.mesh);
      if (b.trail) scene.remove(b.trail);
      bombs.splice(i, 1);
      resolveBombDamage(b.position, b.isRemote, damage, radius);
      continue;
    }

    if (window.__destructibles) {
      let hitObj = false;
      for (const obj of window.__destructibles) {
        if (!obj.alive) continue;
        const dist = b.position.distanceTo(obj.mesh.position);
        if (dist < 2.5 * HITBOX_SCALE) {
          obj.alive = false; obj.mesh.visible = false; b.alive = false;
          const isSpecial = b.isSpecial || false;
          const damage = isSpecial ? BOMB_DMG * (b.damageFactor || 0.5) : BOMB_DMG;
          const radius = isSpecial ? BOMB_BLAST_RADIUS * (b.radiusFactor || 0.5) : BOMB_BLAST_RADIUS;
          const color = b.explosionColor || b.color || 0xff8800;
          createExplosion(b.position, true, true, color, radius);
          if (b.trail) scene.remove(b.trail);
          hitObj = true;
          break;
        }
      }
      if (hitObj) continue;
      if (!b.alive) continue;
    }

    if (mapColliders && mapColliders.length) {
      let hitColl = false;
      for (const coll of mapColliders) {
        if (coll.boundingBox && coll.boundingBox.containsPoint(b.position)) {
          b.alive = false;
          const isSpecial = b.isSpecial || false;
          const damage = isSpecial ? BOMB_DMG * (b.damageFactor || 0.5) : BOMB_DMG;
          const radius = isSpecial ? BOMB_BLAST_RADIUS * (b.radiusFactor || 0.5) : BOMB_BLAST_RADIUS;
          const color = b.explosionColor || b.color || 0xff8800;
          createExplosion(b.position, true, true, color, radius);
          if (b.trail) scene.remove(b.trail);
          hitColl = true;
          break;
        }
      }
      if (hitColl) continue;
    }

    b.mesh.position.copy(b.position);
    b.mesh.rotation.x += dt * 3;
    b.mesh.rotation.z += dt * 2;
  }
}

function resolveBombDamage(position, isRemoteBomb, damage = BOMB_DMG, radius = BOMB_BLAST_RADIUS, weaponType = 'bomb', suppressBroadcast = false) {
  enemyBots.forEach(e => {
    if (!e.alive) return;
    const dist = Math.hypot(e.mesh.position.x - position.x, e.mesh.position.z - position.z);
    if (dist < radius) {
      e.health -= damage;
      flashBot(e);
      playSound('hit');
      if (e.health <= 0) killBot(e);
    }
  });

  if (!isRemoteBomb && onlineState.socket) {
    remotePlayers.forEach((rp, id) => {
      if (!rp.alive) return;
      const dist = Math.hypot(rp.mesh.position.x - position.x, rp.mesh.position.z - position.z);
      if (dist < radius) {
        onlineState.socket.emit('hit', { targetId: id, weaponType });
        flashRemote(id);
        playSound('hit');
      }
    });
  }

  if (!state.isDead && !state.isSpectator && !state.invulnerable) {
    const distSelf = Math.hypot(state.position.x - position.x, state.position.z - position.z);
    if (distSelf < radius) {
      applyDamageToPlayer(damage);
      flashVehicle();
      cameraShake(0.6, 0.4);
    }
  }

  if (onlineState.socket && !suppressBroadcast) {
    let colorToSend = 0xff8800;
    if (weaponType === 'overdrive') colorToSend = 0xffee66;
    else if (weaponType === 'bomb') colorToSend = 0xff8800;
    else if (weaponType === 'shockwave') colorToSend = 0xbfe9ff;
    onlineState.socket.emit('bomb-exploded', {
      position: position.toArray(),
      radius: radius,
      color: colorToSend,
      weaponType: weaponType || 'bomb'
    });
  }
}

// ================================================================
//  NOVO — Helicóptero: anel de onda de choque (visual). Diferente de
//  createExplosion (que é uma explosão de partículas), isso aqui é só
//  um anel grosso se expandindo rapidamente a partir do ponto de origem,
//  bem visível, sem nenhuma partícula/fumaça — exatamente o "só a onda
//  de choque, sem explosão" que foi pedido. Dois anéis (um deitado, um
//  em pé) dão a leitura de "esfera de energia se expandindo em todas as
//  direções" sem precisar de geometria 3D complexa.
// ================================================================
function spawnShockwaveRing(position, color, maxRadius) {
  const tubeRadius = Math.max(0.12, maxRadius * 0.05);
  const geometry = new THREE.TorusGeometry(1, tubeRadius, 14, 48);
  const material = new THREE.MeshBasicMaterial({
    color: color, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const ringFlat = new THREE.Mesh(geometry, material);
  ringFlat.position.copy(position);
  ringFlat.rotation.x = Math.PI / 2;
  scene.add(ringFlat);

  const ringUp = new THREE.Mesh(geometry, material.clone());
  ringUp.position.copy(position);
  ringUp.rotation.y = Math.PI / 2;
  scene.add(ringUp);

  const light = new THREE.PointLight(color, 4.5, maxRadius * 1.6);
  light.position.copy(position);
  scene.add(light);

  const duration = 650;
  const startRadius = 1.5;
  const start = performance.now();
  (function animateRing() {
    const t = Math.min(1, (performance.now() - start) / duration);
    const r = startRadius + t * (maxRadius - startRadius);
    ringFlat.scale.setScalar(r);
    ringUp.scale.setScalar(r);
    ringFlat.material.opacity = 0.95 * (1 - t);
    ringUp.material.opacity = 0.85 * (1 - t);
    light.intensity = 4.5 * (1 - t);
    if (t >= 1) {
      scene.remove(ringFlat); ringFlat.geometry.dispose(); ringFlat.material.dispose();
      scene.remove(ringUp); ringUp.material.dispose();
      scene.remove(light);
      return;
    }
    requestAnimationFrame(animateRing);
  })();
}

function createExplosion(position, isSuper, isBomb, customColor, customRadius) {
  const count = isBomb ? 3000 : (isSuper ? 400 : 150);
  const radius = customRadius || (isBomb ? 120 : (isSuper ? 12 : 5));
  const color1 = customColor || (isBomb ? 0xff8800 : (isSuper ? 0xffaa44 : 0xff6600));
  const color2 = customColor || (isBomb ? 0xffff44 : (isSuper ? 0xff4400 : 0xffcc44));

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const velocities = [];
  const lifetimes = [];
  const col1 = new THREE.Color(color1);
  const col2 = new THREE.Color(color2);

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = radius * (0.05 + Math.random() * 0.95);
    positions[i * 3] = position.x + Math.sin(phi) * Math.cos(theta) * r * 0.15;
    positions[i * 3 + 1] = position.y + Math.cos(phi) * r * 0.15;
    positions[i * 3 + 2] = position.z + Math.sin(phi) * Math.sin(theta) * r * 0.15;
    const c = col1.clone().lerp(col2, Math.random());
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
    sizes[i] = (0.3 + Math.random() * 1.2) * (isBomb ? 5.0 : 1.6);
    const speed = (0.6 + Math.random() * 4) * (isBomb ? 8 : 2.0);
    velocities.push((Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed + (isBomb ? 6 : 0.8), (Math.random() - 0.5) * speed);
    lifetimes.push(isBomb ? (1.6 + Math.random() * 3.0) : (0.6 + Math.random() * 1.8));
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const material = new THREE.PointsMaterial({ size: isBomb ? 4.5 : 1.0, vertexColors: true, transparent: true, opacity: 1.0, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
  const points = new THREE.Points(geometry, material);
  scene.add(points);
  explosions.push({ points, velocities, lifetimes, age: 0, duration: isBomb ? 4.0 : 1.3, super: isSuper, bomb: isBomb });

  if (isBomb || isSuper) {
    const ringMat = new THREE.MeshBasicMaterial({ color: color1, transparent: true, opacity: 0.7, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.8, 40), ringMat);
    ring.position.copy(position);
    ring.position.y += 0.3;
    ring.rotation.x = -Math.PI / 2;
    scene.add(ring);
    explosions.push({ ring, ringMat, age: 0, duration: isBomb ? 2.0 : 0.9, bomb: isBomb, ringScale: 1, maxScale: isBomb ? 280 : 45 });
  }

  const flash = new THREE.PointLight(color1, isBomb ? 10 : 3, isBomb ? 200 : 40);
  flash.position.copy(position);
  scene.add(flash);
  setTimeout(() => scene.remove(flash), isBomb ? 500 : 180);

  if (isBomb && window.__destructibles) {
    for (const obj of window.__destructibles) {
      if (!obj.alive) continue;
      const dist = position.distanceTo(obj.mesh.position);
      if (dist < radius * 0.5) { obj.alive = false; obj.mesh.visible = false; }
    }
  }
  cameraShake(isBomb ? 1.6 : (isSuper ? 0.8 : 0.4), isBomb ? 1.2 : 0.35);
}

function updateExplosions(dt) {
  for (let i = explosions.length - 1; i >= 0; i--) {
    const exp = explosions[i];
    if (exp.ring) {
      exp.age += dt;
      const progress = exp.age / exp.duration;
      if (progress >= 1) { scene.remove(exp.ring); exp.ringMat.dispose(); explosions.splice(i, 1); continue; }
      const scale = 1 + progress * (exp.maxScale || 45);
      exp.ring.scale.set(scale, scale, scale);
      exp.ringMat.opacity = 0.7 * (1 - progress);
      continue;
    }
    exp.age += dt;
    const posAttr = exp.points.geometry.attributes.position;
    const posArray = posAttr.array;
    const sizeAttr = exp.points.geometry.attributes.size;
    const sizeArray = sizeAttr.array;
    let allDead = true;
    for (let j = 0; j < exp.lifetimes.length; j++) {
      const life = exp.lifetimes[j];
      const progress = exp.age / life;
      if (progress < 1) {
        allDead = false;
        posArray[j * 3] += exp.velocities[j * 3] * dt;
        posArray[j * 3 + 1] += exp.velocities[j * 3 + 1] * dt + (exp.bomb ? 1.5 : 0.3) * dt;
        posArray[j * 3 + 2] += exp.velocities[j * 3 + 2] * dt;
        exp.velocities[j * 3] *= (1 - dt * 2.0);
        exp.velocities[j * 3 + 1] *= (1 - dt * 2.0);
        exp.velocities[j * 3 + 2] *= (1 - dt * 2.0);
        sizeArray[j] *= (1 - dt * 3.0);
        if (sizeArray[j] < 0.03) sizeArray[j] = 0.03;
      } else { posArray[j * 3] = 99999; posArray[j * 3 + 1] = 99999; posArray[j * 3 + 2] = 99999; sizeArray[j] = 0; }
    }
    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    exp.points.material.opacity = Math.max(0, 1 - exp.age / exp.duration);
    if (allDead || exp.age > exp.duration + 0.8) { scene.remove(exp.points); exp.points.geometry.dispose(); exp.points.material.dispose(); explosions.splice(i, 1); }
  }
}

const MG_SPEED = 78;
const MG_FIRE_RATE = 0.2;

// PEDIDO (Super Metralhadora do Hilson Bi-Mono): generalizado pra aceitar
// cor/dano customizados por quem chama, em vez de ficar preso ao Cessna.
// Nenhum outro código que já chamava essa função precisa mudar, já que
// "opts" é opcional e cada campo cai de volta no valor original.
// ================================================================
//  Constrói o mesh visual de um projétil da metralhadora.
//  - Padrão ("mg"): bolinha esférica brilhante, comportamento original.
//  - Laser ("bolt: true"): feixe alongado (cilindro fino + núcleo mais
//    fino por dentro), orientado na direção do disparo, visualmente bem
//    diferente da bolinha padrão — para não parecer "tiro normal
//    recolorido".
// ================================================================
function buildBulletMesh(opts, color, dir) {
  if (opts.bolt) {
    const boltLength = opts.boltLength != null ? opts.boltLength : 2.4;
    const boltRadius = opts.boltRadius != null ? opts.boltRadius : 0.055;

    const group = new THREE.Group();

    // Núcleo brilhante (mais fino, cor mais clara/branca no centro)
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const core = new THREE.Mesh(new THREE.CylinderGeometry(boltRadius * 0.4, boltRadius * 0.4, boltLength, 6), coreMat);
    group.add(core);

    // Casca externa translúcida com glow aditivo (dá o efeito "laser")
    const glowMat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(boltRadius, boltRadius * 1.3, boltLength, 8), glowMat);
    group.add(glow);

    // Cilindros são criados ao longo do eixo Y por padrão; alinhamos ao
    // eixo Z (frente) e depois rotacionamos o grupo inteiro para a
    // direção real do disparo.
    core.rotation.x = Math.PI / 2;
    glow.rotation.x = Math.PI / 2;

    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize());
    group.quaternion.copy(quat);

    group.userData.isBolt = true;
    return group;
  }

  const bulletMat = new THREE.MeshStandardMaterial({
    color: color,
    emissive: color,
    emissiveIntensity: 1.5
  });
  const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), bulletMat);
  bullet.castShadow = true;
  return bullet;
}

function fireMachineGun(opts = {}) {
  if (state.isCar || state.isPaused || state.isDead || state.isSpectator) return;
  if (!combatEnabled) return;

  const color = opts.color != null ? opts.color : 0xff8800;
  const explosionColor = opts.explosionColor != null ? opts.explosionColor : color;
  const damage = opts.damage != null ? opts.damage : MG_DAMAGE;
  const weaponType = opts.weaponType || 'mg';
  const speed = opts.speed != null ? opts.speed : MG_SPEED;

  const dir = getAimDirection();

  // Deslocamento lateral do cano: permite disparar alternando entre dois
  // pontos (ex: canhões esquerdo/direito do X-Wing), em vez de sempre
  // sair do centro da nave. sideOffset > 0 = direita, < 0 = esquerda.
  const sideOffset = opts.sideOffset || 0;
  // Vetor "direita" derivado da própria direção de mira (evita depender
  // de uma função externa de rotação da nave).
  const worldUp = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(dir, worldUp).normalize();
  if (right.lengthSq() < 0.0001) right.set(1, 0, 0);

  const origin = state.position.clone()
    .add(dir.clone().multiplyScalar(2.2))
    .add(right.multiplyScalar(sideOffset));
  origin.y += 0.1;

  const bullet = buildBulletMesh(opts, color, dir);
  bullet.position.copy(origin);
  scene.add(bullet);

  const velocity = dir.clone().multiplyScalar(speed);
  const light = new THREE.PointLight(color, 1.2, 6);
  light.position.copy(origin);
  scene.add(light);
  setTimeout(() => scene.remove(light), 100);

  machineGunBullets.push({
    mesh: bullet,
    position: origin.clone(),
    velocity: velocity,
    life: 1.2,
    damage: damage,
    explosionColor: explosionColor,
    weaponType: weaponType,
  });

  if (onlineState.socket) {
    onlineState.socket.emit('mg-fired', {
      origin: origin.toArray(),
      direction: dir.toArray(),
      color: color,
      explosionColor: explosionColor,
      weaponType: weaponType,
      speed: speed,
      bolt: !!opts.bolt,
      boltLength: opts.boltLength,
      boltRadius: opts.boltRadius,
      sideOffset: sideOffset
    });
  }

  playSound('shot');
}

function updateMachineGunBullets(dt) {
  for (let i = machineGunBullets.length - 1; i >= 0; i--) {
    const b = machineGunBullets[i];
    const explColor = b.explosionColor || 0xff8800;
    b.life -= dt;
    b.position.addScaledVector(b.velocity, dt);
    b.mesh.position.copy(b.position);

    if (b.position.y < GROUND_LEVEL) {
      createExplosion(b.position, false, false, explColor);
      cameraShake(0.2, 0.1);
      scene.remove(b.mesh);
      machineGunBullets.splice(i, 1);
      continue;
    }

    if (b.life <= 0) {
      scene.remove(b.mesh);
      machineGunBullets.splice(i, 1);
      continue;
    }

    let hit = false;
    for (const bot of enemyBots) {
      if (!bot.alive) continue;
      const dist = b.position.distanceTo(bot.mesh.position);
      if (dist < 1.2 * HITBOX_SCALE) {
        bot.health -= b.damage;
        createExplosion(b.position, false, false, explColor);
        cameraShake(0.2, 0.1);
        flashBot(bot);
        playSound('hit');
        if (bot.health <= 0) killBot(bot);
        hit = true;
        break;
      }
    }
    if (!hit && onlineState.socket) {
      for (const [id, rp] of remotePlayers) {
        if (!rp.alive) continue;
        const dist = b.position.distanceTo(rp.mesh.position);
        if (dist < 1.2 * HITBOX_SCALE) {
          onlineState.socket.emit('hit', { targetId: id, weaponType: b.weaponType || 'mg' });
          createExplosion(b.position, false, false, explColor);
          cameraShake(0.2, 0.1);
          flashRemote(id);
          playSound('hit');
          hit = true;
          break;
        }
      }
    }
    if (!hit && window.__destructibles) {
      for (const obj of window.__destructibles) {
        if (!obj.alive) continue;
        const dist = b.position.distanceTo(obj.mesh.position);
        if (dist < 1.5 * HITBOX_SCALE) {
          obj.alive = false; obj.mesh.visible = false;
          createExplosion(obj.mesh.position.clone(), false, false, explColor);
          hit = true;
          break;
        }
      }
    }
    if (!hit && mapColliders && mapColliders.length) {
      for (const coll of mapColliders) {
        if (coll.boundingBox && coll.boundingBox.containsPoint(b.position)) {
          createExplosion(b.position, false, false, explColor);
          hit = true;
          break;
        }
      }
    }
    if (hit) { scene.remove(b.mesh); machineGunBullets.splice(i, 1); }
  }
}

function flashRemote(id) {
  const rp = remotePlayers.get(id);
  if (!rp || !rp.mesh) return;
  const mats = [];
  rp.mesh.traverse(o => { if (o.isMesh && o.material && o.material.color) mats.push(o.material); });
  const orig = mats.map(m => m.color.clone());
  mats.forEach(m => { m.color.setHex(0xff0000); if (m.emissive) m.emissive.setHex(0xff0000); });
  if (rp._flashTimer) clearTimeout(rp._flashTimer);
  rp._flashTimer = setTimeout(() => {
    mats.forEach((m, i) => m.color.copy(orig[i]));
    rp._flashTimer = null;
  }, 250);
}

function getAimDirection() {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  return raycaster.ray.direction.clone().normalize();
}