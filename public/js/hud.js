// ================================================================
//  LABELS 2D FLUTUANTES (nome + vida) PARA INIMIGOS/JOGADORES REMOTOS
// ================================================================
function createEnemyLabel(name, color) {
  const el = document.createElement('div');
  el.className = 'enemy-label';
  el.innerHTML = `<div class="enemy-name" style="color:${color}">${name}</div><div class="enemy-hpbar"><div class="enemy-hpfill"></div></div>`;
  document.getElementById('enemy-labels').appendChild(el);
  const nameEl = el.querySelector('.enemy-name');
  const fillEl = el.querySelector('.enemy-hpfill');
  return {
    el, nameEl,
    updatePosition(worldPos) {
      const v = worldPos.clone().project(camera);
      if (v.z > 1) { el.style.display = 'none'; return; }
      el.style.display = '';
      const x = (v.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
      el.style.transform = `translate(${x}px, ${y}px)`;
    },
    setHealth(h, max) {
      fillEl.style.width = Math.max(0, (h / max) * 100) + '%';
    },
    remove() { el.remove(); }
  };
}

// ================================================================
//  KILL FEED — "quem abateu quem", mensagens que aparecem no topo da
//  tela e somem sozinhas depois de alguns segundos. Funciona tanto
//  offline (bots) quanto online (via evento 'player-killed').
// ================================================================
function pushKillFeed(text) {
  const container = document.getElementById('kill-feed');
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'kill-feed-row';
  row.textContent = text;
  container.appendChild(row);
  requestAnimationFrame(() => row.classList.add('show'));
  setTimeout(() => {
    row.classList.remove('show');
    setTimeout(() => row.remove(), 400);
  }, 4000);
  while (container.children.length > 5) container.removeChild(container.firstChild);
}

// ================================================================
//  HUD
// ================================================================
const elAlt = document.getElementById('val-alt');
const elSpeed = document.getElementById('val-speed');
const elHeading = document.getElementById('val-heading');
const elHealth = document.getElementById('val-health');
const elKills = document.getElementById('val-kills');
const elState = document.getElementById('val-state');
const altFill = document.getElementById('alt-fill');
const altPercent = document.getElementById('alt-percent');
const healthFill = document.getElementById('health-fill');
const healthPercent = document.getElementById('health-percent');
const shieldFill = document.getElementById('shield-fill');
const shieldPercent = document.getElementById('shield-percent');
const compassNeedle = document.getElementById('compass-needle');
const specialCdEl = document.getElementById('special-cooldown');
const missileCdEl = document.getElementById('missile-cooldown');
const superCdEl = document.getElementById('super-cooldown');
const bombCdEl = document.getElementById('bomb-cooldown');
const takeoffBanner = document.getElementById('takeoff-banner');
const takeoffTimerEl = document.getElementById('takeoff-timer');

function updateHUD() {
  const alt = state.position.y - GROUND_LEVEL;
  const speedKmh = state.velocity * 130; // conversão só pra exibição (unidades originais do jogo)
  let headingDeg = (THREE.MathUtils.radToDeg(state.yaw) % 360 + 360) % 360;

  elAlt.textContent = alt.toFixed(1) + ' m';
  elSpeed.textContent = speedKmh.toFixed(0) + ' km/h';
  elHeading.textContent = String(Math.round(headingDeg)).padStart(3, '0') + '°';
  elHealth.textContent = Math.max(0, Math.round(state.health));
  elKills.textContent = state.kills;
  elState.textContent = state.isCrashed ? 'CAINDO!' : (state.isDead ? 'ABATIDO' : (state.isSpectator ? 'ESPECTADOR' : 'VOANDO'));
  elState.style.color = state.isCrashed ? '#ffaa00' : (state.isDead ? '#ff2a6a' : (state.isSpectator ? '#ffaa00' : '#4cff8b'));
  compassNeedle.style.transform = 'translate(-50%,-100%) rotate(' + (-headingDeg) + 'deg)';

  const maxAlt = currentPlaneSpec ? currentPlaneSpec.maxAltitude : BALANCE_MAX_ALTITUDE;
  const altPct = Math.min(100, (alt / maxAlt) * 100);
  altFill.style.width = altPct.toFixed(0) + '%';
  altPercent.textContent = Math.round(altPct) + '%';

  const healthPct = (Math.max(0, state.health) / state.maxHealth) * 100;
  healthFill.style.width = healthPct + '%';
  healthPercent.textContent = Math.round(healthPct) + '%';
  // PEDIDO: vida muda de cor conforme vai acabando — verde (100-75),
  // amarelo (75-35), vermelho (abaixo de 35).
  if (healthPct > 75) {
    healthFill.style.background = '#4cff8b';
  } else if (healthPct > 35) {
    healthFill.style.background = '#ffd23f';
  } else {
    healthFill.style.background = '#ff3b3b';
  }

  const shieldPct = (state.shield / 100) * 100;
  shieldFill.style.width = shieldPct + '%';
  shieldPercent.textContent = Math.round(shieldPct) + '%';

  if (missileCooldown <= 0) { missileCdEl.textContent = 'OK'; missileCdEl.className = 'cooldown ready'; }
  else { missileCdEl.textContent = missileCooldown.toFixed(1) + 's'; missileCdEl.className = 'cooldown'; }

  if (superReady) { superCdEl.textContent = 'OK'; superCdEl.className = 'cooldown ready'; }
  else { superCdEl.textContent = Math.ceil(superCooldown) + 's'; superCdEl.className = 'cooldown'; }

  if (bombCooldown <= 0) { bombCdEl.textContent = 'OK'; bombCdEl.className = 'cooldown ready'; }
  else { bombCdEl.textContent = Math.ceil(bombCooldown) + 's'; bombCdEl.className = 'cooldown'; }

  if (state.specialCooldown <= 0 && !state.specialActive) { specialCdEl.textContent = 'OK'; specialCdEl.className = 'cooldown ready'; }
  else if (state.specialActive) { specialCdEl.textContent = Math.ceil(state.specialTimer) + 's'; specialCdEl.className = 'cooldown'; }
  else { specialCdEl.textContent = Math.ceil(state.specialCooldown) + 's'; specialCdEl.className = 'cooldown'; }
  document.getElementById('special-name').textContent = currentPlaneSpec ? currentPlaneSpec.specialLabel : 'Especial';

  if (!combatEnabled && !state.isDead && !state.isSpectator) {
    takeoffBanner.classList.add('show');
    takeoffTimerEl.textContent = Math.ceil(prepTimer);
  } else {
    takeoffBanner.classList.remove('show');
  }

  remotePlayers.forEach(rp => { if (!rp.alive || rp.invisible) return; rp.label.updatePosition(rp.mesh.position.clone().add(new THREE.Vector3(0, 2, 0))); });
}