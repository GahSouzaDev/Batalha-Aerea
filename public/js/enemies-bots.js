// enemies-bots.js
let enemyBots = [];
let botsEnabled = true;

function spawnEnemyBots() {
  enemyBots.forEach(b => {
    detachEngineSound(b.parts);
    if (b.mesh.parent) scene.remove(b.mesh);
    if (b.label) b.label.remove();
  });
  enemyBots = [];
  if (!botsEnabled) return;
  const names = ['Falcão', 'Corvo', 'Águia', 'Gavião'];
  for (let i = 0; i < 4; i++) {
    const type = PLANE_ORDER[(i + 1) % PLANE_ORDER.length];
    const parts = createPlaneInstance(type, 0xff4444, planeModelStyle);
    const grp = parts.group;
    const angle = (i / 4) * Math.PI * 2;
    const radius = 60 + i * 15;
    grp.position.set(Math.cos(angle) * radius, 20 + i * 6, Math.sin(angle) * radius - 150);
    scene.add(grp);
    attachEngineSound(parts, PLANE_SPECS[type].sound, false);
    const label = createEnemyLabel(names[i], '#ff4444');
    enemyBots.push({
      mesh: grp, parts, label, alive: true, health: 100,
      angle, radius, altitude: grp.position.y, speed: 8 + i * 1.5,
      center: new THREE.Vector3(0, 0, -150),
    });
  }
}

function updateEnemyBots(dt) {
  enemyBots.forEach(bot => {
    if (!bot.alive) return;
    bot.angle += (bot.speed / bot.radius) * dt;
    bot.mesh.position.x = bot.center.x + Math.cos(bot.angle) * bot.radius;
    bot.mesh.position.z = bot.center.z + Math.sin(bot.angle) * bot.radius;
    bot.mesh.position.y = bot.altitude + Math.sin(performance.now() * 0.0003 + bot.angle) * 3;
    const tangent = new THREE.Vector3(-Math.sin(bot.angle), 0, Math.cos(bot.angle));
    bot.mesh.rotation.y = Math.atan2(tangent.x, tangent.z);
    bot.mesh.rotation.z = -0.25;
    if (bot.parts) bot.parts.update(0, 0.6);
    if (bot.label) bot.label.updatePosition(bot.mesh.position.clone().add(new THREE.Vector3(0, 2, 0)));
    if (bot.label) bot.label.setHealth(Math.max(0, bot.health), 100);
  });
}

function flashBot(bot) {
  const mats = [];
  bot.mesh.traverse(o => { if (o.isMesh && o.material && o.material.color) mats.push(o.material); });
  const orig = mats.map(m => m.color.clone());
  mats.forEach(m => { m.color.setHex(0xffffff); if (m.emissive) m.emissive.setHex(0xffffff); });
  if (bot._flashTimer) clearTimeout(bot._flashTimer);
  bot._flashTimer = setTimeout(() => {
    mats.forEach((m, i) => m.color.copy(orig[i]));
    bot._flashTimer = null;
  }, 250);
}

function killBot(bot) {
  bot.alive = false;
  createExplosion(bot.mesh.position.clone(), true, false);
  scene.remove(bot.mesh);
  if (bot.label) bot.label.el.style.display = 'none';
  state.kills++;
  const botName = bot.label ? bot.label.nameEl.textContent : 'um inimigo';
  if (typeof pushKillFeed === 'function') pushKillFeed('🎯 Você abateu ' + botName);
  if (typeof announceKill === 'function') announceKill(_localPlayerName(), botName);
  playSound('victory');
  setTimeout(() => {
    if (!botsEnabled) return;
    bot.alive = true;
    bot.health = 100;
    bot.angle = Math.random() * Math.PI * 2;
    scene.add(bot.mesh);
    if (bot.label) bot.label.el.style.display = '';
  }, 4000);
}