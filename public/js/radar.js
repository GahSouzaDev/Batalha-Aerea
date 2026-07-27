// radar.js
// ================================================================
//  RADAR TÁTICO — visual estilo aviônica militar:
//   • disco giratório com varredura contínua (efeito "sweep")
//   • contatos coloridos por facção: vermelho = inimigo, azul = aliado
//   • alcance configurável (zoom) com anéis de distância
//   • indicação de altitude relativa (▲ acima / ▼ abaixo)
//   • alerta sonoro quando um novo contato entra no alcance
//   • alvo travado (clique num ponto do radar) fica destacado
//   • seta na borda da tela apontando pro alvo travado quando ele
//     sai do campo de visão da câmera
// ================================================================

const RADAR_RANGES = [150, 300, 600, 1200]; // metros — presets de alcance/zoom
let radarRangeIndex = 1;
let radarSweepAngle = 0;
const RADAR_SWEEP_SPEED = 1.6; // rad/s

let radarSelectedId = null;          // alvo travado manualmente (clique no radar)
const radarPrevInRange = new Set();  // pra detectar quem "acabou de entrar" no alcance
let radarAudioCtx = null;

let radarCanvas, radarCtx, radarRangeLabel, radarZoomInBtn, radarZoomOutBtn;
const RADAR_SIZE = 190;        // px do canvas (resolução interna)
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_RADIUS = RADAR_CENTER - 10;

function initRadar() {
  radarCanvas = document.getElementById('radar-canvas');
  if (!radarCanvas) return;
  radarCanvas.width = RADAR_SIZE;
  radarCanvas.height = RADAR_SIZE;
  radarCtx = radarCanvas.getContext('2d');
  radarRangeLabel = document.getElementById('radar-range-label');
  radarZoomInBtn = document.getElementById('radar-zoom-in');
  radarZoomOutBtn = document.getElementById('radar-zoom-out');

  if (radarZoomInBtn) radarZoomInBtn.addEventListener('click', () => setRadarRange(radarRangeIndex - 1));
  if (radarZoomOutBtn) radarZoomOutBtn.addEventListener('click', () => setRadarRange(radarRangeIndex + 1));
  radarCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    setRadarRange(radarRangeIndex + (e.deltaY > 0 ? 1 : -1));
  }, { passive: false });
  radarCanvas.addEventListener('click', onRadarClick);

  updateRadarRangeLabel();
}

function setRadarRange(idx) {
  radarRangeIndex = Math.max(0, Math.min(RADAR_RANGES.length - 1, idx));
  updateRadarRangeLabel();
}

function updateRadarRangeLabel() {
  if (radarRangeLabel) radarRangeLabel.textContent = RADAR_RANGES[radarRangeIndex] + ' m';
}

// Clique no radar seleciona/destrava o contato mais próximo do ponto clicado.
function onRadarClick(e) {
  const rect = radarCanvas.getBoundingClientRect();
  const cx = (e.clientX - rect.left) * (RADAR_SIZE / rect.width);
  const cy = (e.clientY - rect.top) * (RADAR_SIZE / rect.height);
  const contacts = radarLastContacts || [];
  let best = null, bestDist = 16; // raio de tolerância em px (na resolução interna)
  contacts.forEach(c => {
    const d = Math.hypot(c.px - cx, c.py - cy);
    if (d < bestDist) { bestDist = d; best = c; }
  });
  radarSelectedId = best ? best.id : (radarSelectedId ? null : radarSelectedId);
}

let radarLastContacts = [];

// Reúne bots (offline) + jogadores remotos (online) com posição relativa
// ao jogador local, já rotacionada pro referencial "nariz pra cima"
// (heading-up, como radares de caça reais).
function collectRadarContacts() {
  const range = RADAR_RANGES[radarRangeIndex];
  const list = [];
  const myPos = state.position;
  const yaw = state.yaw;
  const sinY = Math.sin(yaw), cosY = Math.cos(yaw);
  // Frente real do avião: (-sin(yaw), -cos(yaw)) — mesma convenção usada
  // pro voo/bombas (ver a velocidade da bomba em weapons.js). Isso tem que
  // ficar sempre assim, senão em ângulos grandes (ex: de costas) a frente
  // e as costas se invertem.
  // O eixo de "direita" segue a mesma rotação da frente (cos(yaw), -sin(yaw)).
  const fwdX = -sinY, fwdZ = -cosY;
  const rightX = cosY, rightZ = -sinY;

  function pushContact(id, pos, isAlly, name, isBlimp) {
    const dx = pos.x - myPos.x;
    const dz = pos.z - myPos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > range * 1.02) return;
    const rx = dx * rightX + dz * rightZ; // + = à direita do nariz
    const rz = dx * fwdX + dz * fwdZ;      // + = à frente do nariz
    list.push({
      id, name: name || (isAlly ? 'Aliado' : 'Inimigo'),
      isAlly, isBlimp: !!isBlimp, dist, altDiff: pos.y - myPos.y,
      relX: rx, relZ: rz,
      worldPos: pos,
    });
  }

  if (typeof enemyBots !== 'undefined') {
    enemyBots.forEach(bot => {
      if (!bot.alive) return;
      pushContact('bot-' + bot.mesh.uuid, bot.mesh.position, false, bot.name);
    });
  }
  if (typeof remotePlayers !== 'undefined') {
    remotePlayers.forEach((rp, id) => {
      if (!rp.alive || rp.invisible) return;
      const isAlly = (typeof myTeam !== 'undefined' && myTeam != null && rp.team === myTeam);
      pushContact(id, rp.mesh.position, isAlly, rp.label ? rp.label.nameEl.textContent : null);
    });
  }

  // PEDIDO: o dirigível também aparece no radar (pra todo mundo, sala
  // inteira ou solo) — não é aliado nem inimigo "de verdade", mas
  // precisa alertar do mesmo jeito que um contato normal (o beep de
  // "entrou no alcance" já dispara pra ele, já que isAlly=false).
  if (typeof getBlimpRadarContact === 'function') {
    const b = getBlimpRadarContact();
    if (b) pushContact('blimp', b.position, false, 'Dirigível', true);
  }

  return list;
}

function playRadarBeep(urgent) {
  try {
    if (!radarAudioCtx) radarAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = radarAudioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = urgent ? 1180 : 820;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(urgent ? 0.22 : 0.14, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + (urgent ? 0.28 : 0.16));
    osc.start(t);
    osc.stop(t + 0.3);
  } catch (e) { /* áudio bloqueado até a 1ª interação do usuário — ignora */ }
}

function updateRadar(dt) {
  if (!radarCanvas) return;
  radarSweepAngle = (radarSweepAngle + RADAR_SWEEP_SPEED * dt) % (Math.PI * 2);

  const range = RADAR_RANGES[radarRangeIndex];
  const contacts = collectRadarContacts();

  // detecta quem entrou no alcance agora (dispara o alerta sonoro) —
  // só inimigo alerta; aliado entrando é informação, não ameaça.
  const currentIds = new Set();
  let justEntered = false, justEnteredUrgent = false;
  contacts.forEach(c => {
    currentIds.add(c.id);
    if (!c.isAlly && !radarPrevInRange.has(c.id)) {
      justEntered = true;
      if (c.dist < range * 0.35) justEnteredUrgent = true;
    }
  });
  if (justEntered) playRadarBeep(justEnteredUrgent);
  radarPrevInRange.clear();
  currentIds.forEach(id => radarPrevInRange.add(id));

  // mantém o alvo travado só enquanto ele existir e estiver no alcance
  if (radarSelectedId && !contacts.find(c => c.id === radarSelectedId)) radarSelectedId = null;

  drawRadar(contacts, range);
  radarLastContacts = contacts;
  updateOffscreenArrow(contacts);
}

function drawRadar(contacts, range) {
  const ctx = radarCtx;
  ctx.clearRect(0, 0, RADAR_SIZE, RADAR_SIZE);

  ctx.save();
  ctx.beginPath();
  ctx.arc(RADAR_CENTER, RADAR_CENTER, RADAR_RADIUS, 0, Math.PI * 2);
  ctx.clip();

  // fundo
  ctx.fillStyle = 'rgba(2,14,20,0.78)';
  ctx.fillRect(0, 0, RADAR_SIZE, RADAR_SIZE);

  // anéis de alcance
  ctx.strokeStyle = 'rgba(0,229,255,0.28)';
  ctx.lineWidth = 1;
  [0.34, 0.67, 1.0].forEach(f => {
    ctx.beginPath();
    ctx.arc(RADAR_CENTER, RADAR_CENTER, RADAR_RADIUS * f, 0, Math.PI * 2);
    ctx.stroke();
  });
  // cruz central
  ctx.beginPath();
  ctx.moveTo(RADAR_CENTER, RADAR_CENTER - RADAR_RADIUS);
  ctx.lineTo(RADAR_CENTER, RADAR_CENTER + RADAR_RADIUS);
  ctx.moveTo(RADAR_CENTER - RADAR_RADIUS, RADAR_CENTER);
  ctx.lineTo(RADAR_CENTER + RADAR_RADIUS, RADAR_CENTER);
  ctx.stroke();

  // varredura giratória com rastro
  ctx.save();
  ctx.translate(RADAR_CENTER, RADAR_CENTER);
  ctx.rotate(radarSweepAngle);
  const trailSpan = 1.15;
  const sweepGradient = ctx.createLinearGradient(0, 0, RADAR_RADIUS, 0);
  sweepGradient.addColorStop(0, 'rgba(76,255,139,0.35)');
  sweepGradient.addColorStop(1, 'rgba(76,255,139,0)');
  ctx.fillStyle = sweepGradient;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, RADAR_RADIUS, -trailSpan, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(76,255,139,0.9)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(RADAR_RADIUS, 0);
  ctx.stroke();
  ctx.restore();

  // marcas de distância nos anéis
  ctx.fillStyle = 'rgba(180,230,255,0.55)';
  ctx.font = '8px Rajdhani, Arial';
  ctx.fillText(Math.round(range * 0.34) + '', RADAR_CENTER + 3, RADAR_CENTER - RADAR_RADIUS * 0.34 + 3);
  ctx.fillText(Math.round(range * 0.67) + '', RADAR_CENTER + 3, RADAR_CENTER - RADAR_RADIUS * 0.67 + 3);
  ctx.fillText(range + 'm', RADAR_CENTER + 3, RADAR_CENTER - RADAR_RADIUS + 9);

  // contatos
  const scale = RADAR_RADIUS / range;
  contacts.forEach(c => {
    const px = RADAR_CENTER + c.relX * scale;
    const py = RADAR_CENTER - c.relZ * scale;
    c.px = px; c.py = py;

    const isSelected = c.id === radarSelectedId;
    const color = c.isBlimp ? '#ffaa33' : (c.isAlly ? '#3aa0ff' : '#ff3b3b');

    if (isSelected) {
      const pulse = 5 + Math.sin(performance.now() / 140) * 2;
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(px, py, 7 + pulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.shadowColor = color;
    ctx.shadowBlur = 5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, isSelected ? 4 : 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // indicador de altitude relativa
    if (Math.abs(c.altDiff) > 4) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 8px Arial';
      ctx.fillText(c.altDiff > 0 ? '▲' : '▼', px + 5, py - (c.altDiff > 0 ? 3 : -8));
    }
  });

  // avião do jogador no centro
  ctx.fillStyle = '#e4ebfd';
  ctx.beginPath();
  ctx.moveTo(RADAR_CENTER, RADAR_CENTER - 6);
  ctx.lineTo(RADAR_CENTER - 4, RADAR_CENTER + 5);
  ctx.lineTo(RADAR_CENTER + 4, RADAR_CENTER + 5);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // borda externa
  ctx.strokeStyle = 'rgba(0,229,255,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(RADAR_CENTER, RADAR_CENTER, RADAR_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
}

// ================================================================
//  SETA DE ALVO FORA DA TELA — só aparece quando existe um alvo
//  travado (radarSelectedId) e ele está fora do campo de visão da
//  câmera (atrás ou fora da janela). Fica na borda da tela apontando
//  na direção certa, com a distância em metros embaixo da seta.
// ================================================================
let radarArrowEl = null;
function ensureRadarArrowEl() {
  if (radarArrowEl) return radarArrowEl;
  radarArrowEl = document.createElement('div');
  radarArrowEl.id = 'radar-target-arrow';
  radarArrowEl.innerHTML = '<div class="rta-arrow">▲</div><div class="rta-dist"></div>';
  document.body.appendChild(radarArrowEl);
  return radarArrowEl;
}

function updateOffscreenArrow(contacts) {
  const el = ensureRadarArrowEl();
  const target = contacts.find(c => c.id === radarSelectedId);
  if (!target) { el.style.display = 'none'; return; }

  const worldPos = target.worldPos.clone().add(new THREE.Vector3(0, 1, 0));
  const v = worldPos.project(camera);
  const behind = v.z > 1;
  const onScreen = !behind && v.x >= -1 && v.x <= 1 && v.y >= -1 && v.y <= 1;

  if (onScreen) { el.style.display = 'none'; return; }

  el.style.display = 'flex';
  const w = window.innerWidth, h = window.innerHeight;
  const cx = w / 2, cy = h / 2;
  let dx = v.x, dy = -v.y;
  if (behind) { dx = -dx; dy = -dy; } // alvo atrás da câmera: inverte pra apontar do jeito certo

  const angle = Math.atan2(dy, dx);
  const margin = 46;
  const maxX = cx - margin, maxY = cy - margin;
  const cosA = Math.cos(angle) || 0.0001, sinA = Math.sin(angle) || 0.0001;
  const scale = Math.min(maxX / Math.abs(cosA), maxY / Math.abs(sinA));
  const ex = cx + Math.cos(angle) * scale;
  const ey = cy + Math.sin(angle) * scale;

  el.style.left = ex + 'px';
  el.style.top = ey + 'px';
  el.querySelector('.rta-arrow').style.transform = `rotate(${angle + Math.PI / 2}rad)`;
  el.querySelector('.rta-dist').textContent = Math.round(target.dist) + 'm';
}

document.addEventListener('DOMContentLoaded', initRadar);