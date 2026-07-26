// scoreboard.js
// PEDIDO: o placar agora muda de acordo com o modo:
//  - Sala Livre: só o pódio dos 3 melhores por abates (mata-mata contínuo,
//    não interessa mostrar vida de todo mundo o tempo inteiro).
//  - Salas criadas (FFA custom ou Esquadrões): mostra a vida de cada
//    jogador de verdade + um ranking simples (abates/mortes), já que
//    aqui a vida importa de verdade e não reseta sozinha.
function isFreeRoomScoreboard(roomData) {
  if (roomData) return roomData.id === 'LIVRE';
  return typeof onlineState !== 'undefined' && !!onlineState.isFreeRoom;
}

function updateScoreboardFromRoom(roomData) {
  const container = document.getElementById('sb-list');
  const titleEl = document.querySelector('#scoreboard .sb-title');
  container.innerHTML = '';
  let players = [];
  const isFree = isFreeRoomScoreboard(roomData);

  if (roomData) {
    players = roomData.players.map(p => ({ id: p.id, name: p.name, color: p.color, health: p.health, state: p.state, ready: p.ready, kills: p.kills || 0, deaths: p.deaths || 0, team: p.team }));
  } else if (onlineState.active) {
    players.push({ id: onlineState.myId, name: document.getElementById('menu-name').value || 'Piloto', color: document.getElementById('menu-color-custom').value || '#00e5ff', health: state.health, state: state.isDead ? 'dead' : 'alive', ready: onlineState.ready, kills: state.kills, deaths: state.deaths, isSelf: true, team: myTeam });
    remotePlayers.forEach((rp, id) => {
      let name = 'Piloto'; let color = '#ffffff';
      if (rp.label && rp.label.nameEl) { name = rp.label.nameEl.textContent; color = rp.label.nameEl.style.color || '#fff'; }
      const realHealth = rp._lastHealth != null ? rp._lastHealth : 100;
      players.push({ id, name, color, health: rp.alive ? realHealth : 0, state: rp.alive ? 'alive' : 'dead', ready: true, kills: rp.kills || 0, deaths: rp.deaths || 0, team: rp.team });
    });
  } else {
    enemyBots.forEach((e, i) => { players.push({ id: 'bot-' + i, name: e.label ? e.label.nameEl.textContent : 'Bot', color: '#ff4444', health: e.health, state: e.alive ? 'alive' : 'dead', ready: true, kills: 0, deaths: 0 }); });
    players.push({ id: 'local', name: document.getElementById('menu-name').value || 'Piloto', color: document.getElementById('menu-color-custom').value || '#00e5ff', health: state.health, state: state.isDead ? 'dead' : 'alive', ready: true, kills: state.kills, deaths: state.deaths, isSelf: true });
  }

  if (players.length === 0) {
    if (titleEl) titleEl.textContent = isFree ? '🏆 TOP 3' : '🏆 PLACAR';
    container.innerHTML = '<div class="podium-empty">Aguardando...</div>';
    return;
  }

  if (isFree) {
    // ===== SALA LIVRE: pódio top 3 por abates =====
    if (titleEl) titleEl.textContent = '🏆 TOP 3';
    const top3 = [...players].sort((a, b) => (b.kills || 0) - (a.kills || 0)).slice(0, 3);
    const medals = ['🥇', '🥈', '🥉'];
    top3.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'podium-row rank-' + (i + 1) + (p.isSelf ? ' sb-self' : '');
      const medal = document.createElement('span');
      medal.className = 'podium-medal';
      medal.textContent = medals[i];
      const name = document.createElement('span');
      name.className = 'podium-name';
      name.style.color = p.color || '#ffffff';
      name.textContent = p.name || 'Anônimo';
      const kills = document.createElement('span');
      kills.className = 'podium-kills';
      kills.textContent = '⚔ ' + (p.kills || 0);
      row.appendChild(medal); row.appendChild(name); row.appendChild(kills);
      container.appendChild(row);
    });
    return;
  }

  // ===== SALA CRIADA (FFA custom / Esquadrões) e modo solo:
  // vida de cada jogador de verdade + ranking simples (abates/mortes) =====
  if (titleEl) titleEl.textContent = '🏆 PLACAR';
  players.sort((a, b) => { if (a.state === 'alive' && b.state !== 'alive') return -1; if (a.state !== 'alive' && b.state === 'alive') return 1; return (b.kills || 0) - (a.kills || 0); });

  players.forEach(p => {
    const div = document.createElement('div');
    div.className = 'sb-player';
    if (p.isSelf) div.classList.add('sb-self');
    const teamTag = p.team ? ('<span class="sb-team ' + p.team + '"></span>') : '';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'sb-name';
    nameSpan.innerHTML = teamTag;
    nameSpan.append(p.name || 'Anônimo');
    nameSpan.style.color = p.color || '#ffffff';
    div.appendChild(nameSpan);
    const healthDiv = document.createElement('div');
    healthDiv.className = 'sb-health';
    const fill = document.createElement('div');
    fill.className = 'sb-hfill';
    const pct = p.state === 'alive' ? Math.max(0, (p.health / MAX_HEALTH) * 100) : 0;
    fill.style.width = pct + '%';
    healthDiv.appendChild(fill);
    div.appendChild(healthDiv);
    const statusSpan = document.createElement('span');
    statusSpan.className = 'sb-status ' + (p.state === 'alive' ? 'alive' : 'dead');
    statusSpan.textContent = p.state === 'alive' ? 'VOANDO' : 'ABATIDO';
    div.appendChild(statusSpan);
    const killsSpan = document.createElement('span');
    killsSpan.className = 'sb-kills';
    killsSpan.textContent = '⚔' + (p.kills || 0) + ' 💀' + (p.deaths || 0);
    div.appendChild(killsSpan);
    container.appendChild(div);
  });
}

let scoreboardUpdateTimer = 0;
function updateScoreboardLoop(dt) { scoreboardUpdateTimer += dt; if (scoreboardUpdateTimer > 0.4) { scoreboardUpdateTimer = 0; updateScoreboardFromRoom(null); } }