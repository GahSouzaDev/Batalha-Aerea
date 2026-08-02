// physics.js
let lastUpdateSent = 0;
const localPlaneBox = new THREE.Box3();
const PITCH_SMOOTHING = 0.1;
const CRASH_SPEED_THRESHOLD = 0.6;
const COLLISION_DEATH_DELAY = 2200;

function updateFlight(dt) {
  if (state.isPaused) return;
  if (state.isCrashDying) return;
  const F = dt * 60;

  if (state.isDead || state.isSpectator) {
    if (state.isSpectator) {
      const spSpeed = 0.6;
      const fwd = new THREE.Vector3(Math.sin(cam.yaw), 0, Math.cos(cam.yaw));
      const right = new THREE.Vector3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
      const move = new THREE.Vector3();
      if (keys[keybinds.climbUp]) move.add(fwd);
      if (keys[keybinds.climbDown]) move.sub(fwd);
      if (move.lengthSq() > 0) camera.position.addScaledVector(move.normalize(), spSpeed * F);
      camera.lookAt(new THREE.Vector3(0, 20, 0));
      vehicle.position.copy(state.position);
      return;
    }
    state.fallVelocity = (state.fallVelocity || 0) - 0.02 * F;
    state.position.y += state.fallVelocity * F;
    state.pitch += 0.04 * F; state.roll += 0.05 * F;
    if (state.position.y <= GROUND_LEVEL) { state.position.y = GROUND_LEVEL; state.fallVelocity = 0; }
    vehicle.position.copy(state.position);
    vehicle.rotation.set(state.pitch, state.yaw, state.roll);
    return;
  }

  const spec = currentPlaneSpec;
  // PEDIDO: SR-71 invisível pode acelerar até 2x a velocidade máxima normal
  // dele, só durante os 5s da habilidade (rampa progressiva, igual ao
  // Bimotor, pra dar tempo de "sentir" o ganho de velocidade em vez de
  // já nascer no topo).
  const sr71TurboActive = state.specialActive && selectedPlaneType === 'sr71';
  const sr71Elapsed = sr71TurboActive ? (SR71_INVISIBLE_DURATION - state.specialTimer) : 0;
  const sr71Progress = sr71TurboActive ? Math.min(1, sr71Elapsed / SR71_INVISIBLE_DURATION) : 0;
  const sr71SpeedMult = sr71TurboActive ? (1 + sr71Progress * (SR71_INVISIBLE_SPEED_MULT - 1)) : 1;
  // PEDIDO: sobrecarga do Bimotor — ganha velocidade progressivamente ao
  // longo dos 5s da habilidade, até BIMOTOR_SPEED_MULT_MAX vezes a
  // velocidade máxima normal.
  const bimotorOverdrive = state.specialActive && selectedPlaneType === 'bimotor';
  const overdriveElapsed = bimotorOverdrive ? (BIMOTOR_OVERDRIVE_DURATION - state.specialTimer) : 0;
  const overdriveProgress = bimotorOverdrive ? Math.min(1, overdriveElapsed / BIMOTOR_OVERDRIVE_DURATION) : 0;
  const overdriveMult = bimotorOverdrive ? (1 + overdriveProgress * (BIMOTOR_SPEED_MULT_MAX - 1)) : 1;

  // PEDIDO: Impulso Hipersônico do F-22 — 3 fases dentro dos mesmos 5s de
  // toda habilidade: (1) 0-2s carrega energia (freia bastante, fica
  // invulnerável — ver abilities.js), (2) no instante em que a carga
  // termina dispara a onda de choque (triggerF22Shockwave, abilities.js) e
  // arremessa o avião pra frente por 1s a alta velocidade, (3) os 2s
  // finais são uma recuperação suave de volta à velocidade normal, pra não
  // ficar overpowered ganhando um "impulso grátis" pra sempre.
  const f22Boost = state.specialActive && selectedPlaneType === 'f22';
  const f22Elapsed = f22Boost ? (F22_BOOST_TOTAL - state.specialTimer) : 0;
  let f22SpeedMult = 1;
  let f22ForceDecel = false;
  let f22BurstAccel = false;
  if (f22Boost) {
    if (f22Elapsed < F22_BOOST_CHARGE) {
      f22ForceDecel = true;
    } else if (f22Elapsed < F22_BOOST_CHARGE + F22_BOOST_BURST) {
      f22BurstAccel = true;
      const burstProgress = (f22Elapsed - F22_BOOST_CHARGE) / F22_BOOST_BURST;
      f22SpeedMult = 1 + burstProgress * (F22_BOOST_SPEED_MULT - 1);
    } else {
      const recoverSpan = F22_BOOST_TOTAL - F22_BOOST_CHARGE - F22_BOOST_BURST;
      const recoverProgress = recoverSpan > 0 ? Math.min(1, (f22Elapsed - F22_BOOST_CHARGE - F22_BOOST_BURST) / recoverSpan) : 1;
      f22SpeedMult = F22_BOOST_SPEED_MULT - recoverProgress * (F22_BOOST_SPEED_MULT - 1);
    }
  }

  // PEDIDO: Hiper Velocidade do 14-Bis — chega a 5x a velocidade máxima
  // normal dele (rampa progressiva, mesmo padrão dos outros bônus de
  // velocidade), fica invulnerável e ganha manobrabilidade extra
  // enquanto durar (ver speedFactor/rotationSpeed mais abaixo).
  const quatorzebisHyper = state.specialActive && selectedPlaneType === 'quatorzebis';
  const quatorzebisElapsed = quatorzebisHyper ? (QUATORZEBIS_HYPER_DURATION - state.specialTimer) : 0;
  const quatorzebisProgress = quatorzebisHyper ? Math.min(1, quatorzebisElapsed / QUATORZEBIS_HYPER_DURATION) : 0;
  const quatorzebisSpeedMult = quatorzebisHyper ? (1 + quatorzebisProgress * (QUATORZEBIS_HYPER_SPEED_MULT - 1)) : 1;

  const effectiveMaxSpeed = spec.maxSpeed * sr71SpeedMult * overdriveMult * f22SpeedMult * quatorzebisSpeedMult;

  if (!state.isCrashed) {
    if (selectedPlaneType === 'heli') {
      // Helicóptero tem física própria e completamente diferente dos
      // aviões de asa fixa (ver updateHelicopterFlight, mais abaixo).
      updateHelicopterFlight(dt, spec);
    } else {
    if (f22ForceDecel) {
      // Fase de carga: freia rápido até uma fração baixa da velocidade
      // máxima normal do F-22, simulando "acumular energia" pro estouro.
      state.velocity -= spec.friction * F * 6;
      const chargeFloor = spec.maxSpeed * F22_CHARGE_TARGET_FACTOR;
      if (state.velocity < chargeFloor) state.velocity = chargeFloor;
    } else if ((state.isAccelerating || bimotorOverdrive || quatorzebisHyper) && state.velocity < effectiveMaxSpeed) {
      // ACELERAÇÃO MUITO MAIS RÁPIDA durante a sobrecarga do Bimotor, o
      // turbo de invisibilidade do SR-71, a rajada pós-estouro do F-22 e
      // a Hiper Velocidade do 14-Bis (todos 20x), pra conseguir chegar
      // perto do teto de velocidade dentro da janela curta de cada fase.
      const accelBoost = (bimotorOverdrive || sr71TurboActive || f22BurstAccel || quatorzebisHyper) ? 20 : 1;
      state.velocity += spec.acceleration * F * accelBoost;
    } else if (f22BurstAccel && state.velocity < effectiveMaxSpeed) {
      // Garante o impulso mesmo se o jogador não estiver segurando o
      // acelerador durante a rajada — o "empurrão" da onda de choque
      // independe do input do jogador.
      state.velocity += spec.acceleration * F * 20;
    } else if (!state.isAccelerating && !bimotorOverdrive && !quatorzebisHyper && state.velocity > 0) {
      state.velocity -= spec.friction * F;
    }
    if (state.velocity < 0) state.velocity = 0;
    if (state.velocity > effectiveMaxSpeed) state.velocity = effectiveMaxSpeed;

    let targetRoll = 0;
    const rollLeft = keys[keybinds.rollLeft];
    const rollRight = keys[keybinds.rollRight];
    const speedMultiplier = Math.min(state.velocity / effectiveMaxSpeed, 1) * spec.speedFactor;
    const rotationSpeed = spec.baseRotationSpeed * (1 + speedMultiplier);
    if (rollLeft) {
      state.yaw += rotationSpeed * F;
      targetRoll = state.velocity > 1.4 ? spec.inclina : (state.velocity > 0.3 ? spec.inclinaBoing : 0);
    }
    if (rollRight) {
      state.yaw -= rotationSpeed * F;
      targetRoll = state.velocity > 1.4 ? spec.inclina2 : (state.velocity > 0.3 ? spec.inclinaBoing2 : 0);
    }
    state.roll += (targetRoll - state.roll) * Math.min(1, 0.1 * F);

    let verticalSpeed = 0;
    let targetPitch = 0;
    const climb = keys[keybinds.climbUp];
    const descend = keys[keybinds.climbDown];
    if (climb && state.velocity > spec.liftThreshold && state.position.y < spec.maxAltitude) {
      verticalSpeed = spec.baseVerticalSpeedUp + spec.baseVerticalSpeedUp * (state.velocity / effectiveMaxSpeed) * spec.speedFactor;
      state.position.y += (verticalSpeed + state.velocity * 0.1) * F;
      targetPitch = verticalSpeed * 5;
    } else if (descend && state.position.y > GROUND_LEVEL) {
      verticalSpeed = -0.1;
      state.position.y += (verticalSpeed - state.velocity * 0.1) * F;
      targetPitch = verticalSpeed * 5;
    } else {
      targetPitch = 0;
    }

    if (descend && state.position.y <= GROUND_LEVEL + 0.05 && state.velocity > 0) {
      state.velocity -= 0.005 * F;
      if (state.velocity < 0) state.velocity = 0;
    }

    if (state.velocity < spec.liftThreshold && state.position.y > GROUND_LEVEL) {
      verticalSpeed = state.velocity === 0 ? -spec.gravity * 5 : -spec.gravity;
      state.position.y += verticalSpeed * F;
      targetPitch = verticalSpeed * 5;
    }

    state.pitch += (targetPitch - state.pitch) * Math.min(1, PITCH_SMOOTHING * F);
    state.pitch = THREE.MathUtils.clamp(state.pitch, -spec.maxPitchAngle, spec.maxPitchAngle);
    state.position.y = THREE.MathUtils.clamp(state.position.y, GROUND_LEVEL, spec.maxAltitude);

    state.position.x -= state.velocity * Math.sin(state.yaw) * F;
    state.position.z -= state.velocity * Math.cos(state.yaw) * F;

    vehicle.position.copy(state.position);
    vehicle.rotation.set(state.pitch, state.yaw, state.roll);
    if (mapColliders && mapColliders.length) {
      localPlaneBox.setFromObject(vehicle);
      for (let i = 0; i < mapColliders.length; i++) {
        const b = mapColliders[i];
        if (b.boundingBox && localPlaneBox.intersectsBox(b.boundingBox)) {
          triggerExplosiveCrash();
          break;
        }
      }
    }

    if (state.position.y <= GROUND_LEVEL) {
      state.position.y = GROUND_LEVEL;
      const speedRatio = state.velocity / effectiveMaxSpeed;
      if (speedRatio >= CRASH_SPEED_THRESHOLD) {
        triggerExplosiveCrash();
      }
    }
    } // fim do "else" (avião de asa fixa) do bloco "if (!state.isCrashed)"

  } else {
    state.position.y -= spec.crashGravity * 0.05 * F;
    state.pitch = spec.maxPitchAngle;
    state.crashTimer += dt;
    if (state.position.y <= GROUND_LEVEL) state.position.y = GROUND_LEVEL;
    if (state.crashTimer > 1.2) {
      state.isCrashed = false;
      state.velocity = 0;
      state.crashTimer = 0;
      state.pitch = 0; state.roll = 0;
    }
    vehicle.position.copy(state.position);
    vehicle.rotation.set(state.pitch, state.yaw, state.roll);
  }

  const speedRatio = state.velocity / spec.maxSpeed;
  if (localParts) {
    localParts.update(0, speedRatio);
    if (typeof matchEnded !== 'undefined' && matchEnded) {
      if (localParts.engineSound) localParts.engineSound.setVolume(0);
    } else {
      updateEngineSound(localParts, speedRatio);
    }
  }

  if (onlineState.socket) {
    lastUpdateSent += 1;
    if (lastUpdateSent > 4) {
      lastUpdateSent = 0;
      onlineState.socket.emit('update', {
        x: state.position.x, y: state.position.y, z: state.position.z,
        yaw: state.yaw, pitch: state.pitch, roll: state.roll,
        invisible: !!state.invisible, invulnerable: !!state.invulnerable
      });
    }
  }
}

// ================================================================
//  NOVO — Helicóptero: física própria, bem diferente da de asa fixa.
//  Reaproveita as MESMAS teclas dos aviões, só que com outro sentido:
//   - throttle (Space) = potência do motor (state.velocity vai de 0 até
//     spec.maxSpeed, exatamente como o acelerador normal de qualquer
//     avião — aqui ele representa "RPM", não velocidade de deslocamento).
//   - climbUp/climbDown (W/S) = frente/trás (reaproveitados; o
//     helicóptero não usa esses botões pra subir/descer).
//   - rollLeft/rollRight (A/D) = giro em torno do próprio eixo, sempre
//     disponível, em qualquer faixa de potência.
//  3 faixas de potência (frações de spec.maxSpeed):
//   1/3 (sustentação): motor mal sustenta o peso — sem deslocamento
//        horizontal (W/S não fazem nada), só gira no eixo. Sem potência
//        suficiente, desce aos poucos.
//   2/3 (voo pairado): mantém a altitude perfeitamente parado no ar
//        (nem sobe nem desce) e já desloca pra frente/trás com W/S.
//   3/3 (potência total): ganha altitude continuamente enquanto durar,
//        e tudo fica mais rápido nessa faixa (giro e deslocamento).
//  A inclinação lateral (roll) nas curvas é só estética, pra dar a
//  sensação de "deslizar no gelo" ao virar, igual aos aviões normais.
// ================================================================
// ================================================================
//  NOVO — Helicóptero: física própria, bem diferente da de asa fixa.
//  Reaproveita as MESMAS teclas dos aviões, só que com outro sentido:
//   - throttle (Space) = potência do motor (state.velocity vai de 0 até
//     spec.maxSpeed, exatamente como o acelerador normal de qualquer
//     avião — aqui ele representa "RPM", não velocidade de deslocamento).
//   - climbDown (W) = frente &nbsp; climbUp (S) = trás — CORRIGIDO: antes
//     estava invertido (S ia pra frente, W pra trás); agora W é frente e
//     S é trás, como o esperado.
//   - rollLeft/rollRight (A/D) = giro em torno do próprio eixo, sempre
//     disponível, em qualquer faixa de potência.
//  4 faixas de potência (quartos de spec.maxSpeed):
//   1/4: sem sustentação nenhuma — CAI se estiver no ar. Sem deslocamento
//        horizontal (W/S não fazem nada).
//   2/4: desce planando (não fica parado no ar) — já desloca pra
//        frente/trás, mas só a 50% da velocidade máxima de deslocamento.
//   3/4: plana SUBINDO um pouco — sobe na mesma taxa em que desce no 2/4
//        (só espelhada) — desloca mais rápido que no 2/4.
//   4/4: sobe rápido de verdade, e é a única faixa em que o deslocamento
//        pra frente/trás chega no máximo.
//  Rolagem/inércia: o deslocamento horizontal não para na hora quando
//  solta o botão — ele "desliza" suavemente até parar, dando uma sensação
//  de inércia real em vez de travar instantaneamente.
//  A inclinação lateral (roll) nas curvas continua só estética, pra dar
//  a sensação de "deslizar no gelo" ao virar, igual aos aviões normais.
// ================================================================
const HELI_Q1_MAX = 1 / 4;
const HELI_Q2_MAX = 2 / 4;
const HELI_Q3_MAX = 3 / 4;
const HELI_FALL_SPEED = 0.09;          // taxa de queda no 1/4 (sem sustentação)
const HELI_GLIDE_VERTICAL_SPEED = 0.035; // taxa de descida no 2/4 = taxa de subida no 3/4
const HELI_MOVE_EASE = 0.05;   // quão rápido o deslocamento horizontal se aproxima do alvo
const HELI_MOVE_COAST = 0.018; // quão devagar ele desacelera até parar quando solta o botão (inércia/deslize)
let heliHorizVelocity = 0; // velocidade horizontal atual (com inércia), positiva = frente

function updateHelicopterFlight(dt, spec) {
  const F = dt * 60;
  const band = THREE.MathUtils.clamp(state.velocity / spec.maxSpeed, 0, 1);
  const inQ1 = band < HELI_Q1_MAX;
  const inQ2 = band >= HELI_Q1_MAX && band < HELI_Q2_MAX;
  const inQ3 = band >= HELI_Q2_MAX && band < HELI_Q3_MAX;
  const inQ4 = band >= HELI_Q3_MAX;

  // Potência do motor — acelera/desacelera exatamente como o acelerador
  // de qualquer avião (spec.acceleration/spec.friction).
  if (state.isAccelerating && state.velocity < spec.maxSpeed) {
    state.velocity += spec.acceleration * F;
  } else if (!state.isAccelerating && state.velocity > 0) {
    state.velocity -= spec.friction * F;
  }
  state.velocity = THREE.MathUtils.clamp(state.velocity, 0, spec.maxSpeed);

  // Giro em torno do próprio eixo — SEMPRE disponível, mais rápido no 4/4.
  let targetRoll = 0;
  const rollLeft = keys[keybinds.rollLeft];
  const rollRight = keys[keybinds.rollRight];
  const yawSpeedMult = inQ4 ? 1.8 : 1.0;
  const rotationSpeed = spec.baseRotationSpeed * yawSpeedMult;
  if (rollLeft) {
    state.yaw += rotationSpeed * F;
    targetRoll = spec.inclina;
  }
  if (rollRight) {
    state.yaw -= rotationSpeed * F;
    targetRoll = spec.inclina2;
  }
  state.roll += (targetRoll - state.roll) * Math.min(1, 0.12 * F);

  // Deslocamento pra frente/trás — CORRIGIDO: W (climbDown) = frente,
  // S (climbUp) = trás. Zero no 1/4; 50% no 2/4; mais rápido no 3/4;
  // máximo só no 4/4.
  let moveInput = 0;
  if (keys[keybinds.climbDown]) moveInput += 1; // W = frente
  if (keys[keybinds.climbUp]) moveInput -= 1;   // S = trás
  if (inQ1) moveInput = 0;

  const baseMoveSpeed = spec.heliMoveSpeed || 0.5;
  let moveSpeedFactor = 0;
  if (inQ2) moveSpeedFactor = 0.5;
  else if (inQ3) moveSpeedFactor = 0.75;
  else if (inQ4) moveSpeedFactor = 1.0;
  const targetHorizVelocity = moveInput * baseMoveSpeed * moveSpeedFactor;

  // Inércia: aproxima da velocidade-alvo rápido enquanto o botão está
  // pressionado, mas quando solta, desacelera BEM mais devagar — daí o
  // "desliza um pouco pra frente ainda" pedido.
  const easeRate = (moveInput !== 0) ? HELI_MOVE_EASE : HELI_MOVE_COAST;
  heliHorizVelocity += (targetHorizVelocity - heliHorizVelocity) * Math.min(1, easeRate * F);
  if (Math.abs(heliHorizVelocity) < 0.001) heliHorizVelocity = 0;

  if (heliHorizVelocity !== 0) {
    state.position.x -= heliHorizVelocity * Math.sin(state.yaw) * F;
    state.position.z -= heliHorizVelocity * Math.cos(state.yaw) * F;
  }
  // Leve inclinação de nariz ao andar pra frente/trás, senão fica "de pé"
  // o tempo todo feito uma prancha.
  const targetPitch = -Math.sign(heliHorizVelocity) * Math.min(1, Math.abs(heliHorizVelocity) / baseMoveSpeed) * 0.12;
  state.pitch += (targetPitch - state.pitch) * Math.min(1, PITCH_SMOOTHING * F);

  // Altitude — 4 comportamentos bem diferentes por quarto de potência:
  //  1/4: cai — se a potência estiver EXATAMENTE em zero (motor
  //       desligado/parado), cai de verdade (5x mais rápido), igual ao
  //       estol dos aviões normais quando state.velocity === 0. Com
  //       alguma potência (mas ainda dentro do 1/4), cai mais devagar.
  //  2/4: desce planando (perde altitude, mas mais devagar que a queda livre).
  //  3/4: sobe de leve, na mesma taxa em que desce no 2/4.
  //  4/4: sobe rápido.
  if (inQ1) {
    if (state.position.y > GROUND_LEVEL) {
      const fallRate = state.velocity === 0 ? HELI_FALL_SPEED * 5 : HELI_FALL_SPEED;
      state.position.y -= fallRate * F;
    }
  } else if (inQ2) {
    if (state.position.y > GROUND_LEVEL) state.position.y -= HELI_GLIDE_VERTICAL_SPEED * F;
  } else if (inQ3) {
    state.position.y += HELI_GLIDE_VERTICAL_SPEED * F;
  } else if (inQ4) {
    state.position.y += spec.baseVerticalSpeedUp * 1.6 * F;
  }
  state.position.y = THREE.MathUtils.clamp(state.position.y, GROUND_LEVEL, spec.maxAltitude);

  vehicle.position.copy(state.position);
  vehicle.rotation.set(state.pitch, state.yaw, state.roll);

  if (mapColliders && mapColliders.length) {
    localPlaneBox.setFromObject(vehicle);
    for (let i = 0; i < mapColliders.length; i++) {
      const b = mapColliders[i];
      if (b.boundingBox && localPlaneBox.intersectsBox(b.boundingBox)) {
        triggerExplosiveCrash();
        break;
      }
    }
  }

  // CORREÇÃO: a checagem de "pane ao tocar o chão com potência alta"
  // que existia aqui antes disparava já com a potência em ~23%, mesmo
  // parado no chão — e como só se ganha altitude na faixa 3 (>66%), isso
  // tornava IMPOSSÍVEL decolar (o helicóptero sempre explodia antes de
  // conseguir subir). Removida: nesse modelo de voo, sentar no chão
  // acelerando o motor é justamente como se decola, não uma pane.
}

function triggerExplosiveCrash() {
  if (state.isDead || state.isCrashDying || state.invulnerable) return;

  // Jato com habilidade ativa: ignora colisão
  if (selectedPlaneType === 'jato' && state.specialActive) {
    cameraShake(0.2, 0.1);
    return;
  }

  // REVERTIDO A PEDIDO: colisão estrutural (bater no chão forte ou em
  // prédio/obstáculo) volta a matar na hora, sempre — igual era antes de
  // eu ter mudado isso pra dano parcial. Zera a vida incondicionalmente.
  state.health = 0;
  state.shield = 0;
  state.velocity = 0;
  state.isAccelerating = false;
  state.isCrashDying = true;

  vehicle.visible = false;
  createExplosion(state.position.clone(), true, true);
  cameraShake(1.4, 1.0);
  playSound('explosion');
  showTemporaryMessage('💥 COLISÃO VIOLENTA!', 2000);
  document.getElementById('crosshair').classList.add('hidden');
  if (localParts && localParts.engineSound) localParts.engineSound.setVolume(0);

  if (onlineState.socket) {
    onlineState.socket.emit('hit', { targetId: onlineState.myId, weaponType: 'crash' });
  }

  setTimeout(() => {
    if (state.isDead) { state.isCrashDying = false; return; }
    killPlayer(true);
  }, COLLISION_DEATH_DELAY);
}

function triggerSoftCrash() {
  if (state.isCrashed || state.invulnerable) return;
  state.isCrashed = true;
  state.crashTimer = 0;
  state.velocity = 0;
  createExplosion(state.position.clone(), false, false);
  cameraShake(0.4, 0.25);
  playSound('hit');
  applyDamageToPlayer(15);
  showTemporaryMessage('⚠️ Colisão!', 1000);
}