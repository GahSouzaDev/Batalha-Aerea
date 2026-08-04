// social-client.js — perfil/amigos + CENTRAL DO PILOTO
// VERSÃO À PROVA DE CHAVE ERRADA: toda chave de medalha que chega da API é
// normalizada (underscore -> hífen) ANTES de qualquer uso, então as imagens
// (img/blindagem-viva-prata.png etc.) sempre existem e o SALVAR funciona com
// prova real (salva -> relê o perfil -> confirma na tela).
const LVLN = { 1: 'bronze', 2: 'prata', 3: 'ouro' };
const normKey = (k) => String(k || '').replace(/_/g, '-');
const RANKS_CLIENT = [
  { k: 's2', n: 'Soldado de Segunda Classe (S2)', q: 0, img: 'soldado-de-segunda-classe(s2).png' },
  { k: 's1', n: 'Soldado de Primeira Classe (S1)', q: 25, img: 'soldado-de-primeira-classe(s1).png' },
  { k: 'cabo', n: 'Cabo', q: 75, img: 'cabo.png' },
  { k: '3s', n: 'Terceiro-Sargento', q: 150, img: 'terceiro-sargento.png' },
  { k: '2s', n: 'Segundo-Sargento', q: 300, img: 'segundo-sargento.png' },
  { k: '1s', n: 'Primeiro-Sargento', q: 500, img: 'primeiro-sargento.png' },
  { k: 'sub', n: 'Suboficial', q: 750, img: 'suboficial.png' },
  { k: 'asp', n: 'Aspirante a Oficial', q: 1000, img: 'aspirante-a-oficial.png' },
  { k: '2t', n: 'Segundo-Tenente', q: 1400, img: 'segundo-tenente.png' },
  { k: '1t', n: 'Primeiro-Tenente', q: 1900, img: 'primeiro-tenente.png' },
  { k: 'cap', n: 'Capitão', q: 2500, img: 'capitao.png' },
  { k: 'maj', n: 'Major', q: 3200, img: 'major.png' },
  { k: 'tc', n: 'Tenente-Coronel', q: 4000, img: 'tenente-coronel.png' },
  { k: 'cel', n: 'Coronel', q: 5000, img: 'coronel.png' },
  { k: 'brig', n: 'Brigadeiro', q: 6500, img: 'brigadeiro.png' },
  { k: 'mbrig', n: 'Major-Brigadeiro', q: 8000, img: 'major-brigadeiro.png' },
  { k: 'tbrig', n: 'Tenente-Brigadeiro', q: 10000, img: 'tenente-brigadeiro.png' },
];
// Chaves com HÍFEN (padrão do banco e dos arquivos de imagem)
const MEDAL_NAMES = {
  'veterano-dos-ceus': 'Veterano dos Céus', 'as-dos-ceus': 'Ás dos Céus',
  'mestre-da-sobrevivencia': 'Mestre da Sobrevivência', 'fantasma-dos-ceus': 'Fantasma dos Céus',
  'abatedor-de-dirigiveis': 'Abatedor de Dirigíveis', 'bombardeiro-de-elite': 'Bombardeiro de Elite',
  'mestre-dos-misseis': 'Mestre dos Mísseis', 'heroi-da-esquadrilha': 'Herói da Esquadrilha',
  'conquistador-dos-ceus': 'Conquistador dos Céus', 'piloto-veterano': 'Piloto Veterano',
  'implacavel': 'Implacável', 'blindagem-viva': 'Blindagem Viva', 'ultimo-no-ceu': 'Último no Céu',
  'primeiro-ataque': 'Primeiro Ataque', 'piloto-dedicado': 'Piloto Dedicado',
  'orgulho-da-esquadrilha': 'Orgulho da Esquadrilha',
  'fenix': 'Fênix', 'kamikaze': 'Kamikaze', 'tiro-perfeito': 'Tiro Perfeito',
  'cacador-relampago': 'Caçador Relâmpago', 'dominio-aereo': 'Domínio Aéreo',
  'lenda-da-batalha-aerea': 'Lenda da Batalha Aérea',
};
const SECRET_MEDALS = ['fenix', 'kamikaze', 'tiro-perfeito', 'cacador-relampago', 'dominio-aereo', 'lenda-da-batalha-aerea'];
const socialState = { stats: null };

// Normaliza o /api/profile/me inteiro de uma vez (medalhas + títulos)
function normalizeMe(d) {
  if (!d) return d;
  if (d.medals) d.medals = d.medals.map(m => ({ medal_key: normKey(m.medal_key), level: m.level }));
  if (d.profile && d.profile.selectedTitles) d.profile.selectedTitles = d.profile.selectedTitles.map(normKey);
  return d;
}

// ==================== PERFIL ====================
async function socialOnLogin() {
  const g = document.getElementById('friends-guest-notice');
  const l = document.getElementById('friends-logged-area');
  const pb = document.getElementById('profile-photo-block');
  if (g) g.classList.add('hidden');
  if (l) l.classList.remove('hidden');
  if (pb) pb.classList.remove('hidden');
  try {
    const d = normalizeMe(await authFetch('/api/profile/me'));
    applyProfileToUI(d.profile);
    socialState.stats = d.stats;
    renderIdentityBadge(d);
  } catch (e) { console.warn('[social]', e.message); }
}
function applyProfileToUI(profile) {
  if (!profile) return;
  if (typeof setGameSoundMuted === 'function') setGameSoundMuted(!profile.soundEnabled);
  if (profile.preferredPlane && typeof PLANE_ORDER !== 'undefined' && typeof selectCarouselIndex === 'function') {
    const i = PLANE_ORDER.indexOf(profile.preferredPlane);
    if (i >= 0) selectCarouselIndex('menu', 'menu', i);
  }
  if (profile.photoUrl && typeof setCustomPilotPhoto === 'function') setCustomPilotPhoto(profile.photoUrl, false);
  const pp = profile.preferredPilot;
  if (pp && typeof selectPilotIndex === 'function') {
    if (pp === 16) {
      if (profile.photoUrl && typeof setCustomPilotPhoto === 'function') setCustomPilotPhoto(profile.photoUrl, true);
    } else selectPilotIndex(pp);
  }
}
let _saveDeb = null;
function socialSaveSettings(partial) {
  if (typeof isLoggedIn !== 'function' || !isLoggedIn()) return;
  clearTimeout(_saveDeb);
  _saveDeb = setTimeout(() => authFetch('/api/profile/settings', { method: 'POST', body: JSON.stringify(partial) }).catch(() => {}), 400);
}
document.addEventListener('DOMContentLoaded', () => {
  const m = document.getElementById('menu-mute-toggle');
  if (m) m.addEventListener('change', () => socialSaveSettings({ soundEnabled: !m.checked }));
  const mu = document.getElementById('menu-lobby-music-toggle');
  if (mu) mu.addEventListener('change', () => socialSaveSettings({ musicEnabled: mu.checked }));
  if (typeof window.selectPilotIndex === 'function' && !window.__pilotHooked) {
    window.__pilotHooked = true;
    const base = window.selectPilotIndex;
    window.selectPilotIndex = function (i) { base(i); socialSaveSettings({ preferredPilot: window.selectedPilotIndex }); };
  }
  const inp = document.getElementById('profile-photo-input');
  if (inp) inp.addEventListener('change', async () => {
    const f = inp.files && inp.files[0];
    if (!f || !isLoggedIn()) { inp.value = ''; return; }
    const fd = new FormData();
    fd.append('photo', f);
    try {
      const res = await fetch('/api/profile/photo', { method: 'POST', headers: { Authorization: `Bearer ${authState.token}` }, body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Erro ao enviar foto.');
      if (typeof setCustomPilotPhoto === 'function') setCustomPilotPhoto(d.photoUrl + '?t=' + Date.now(), true);
      if (typeof showTemporaryMessage === 'function') showTemporaryMessage('📷 Foto atualizada!', 1800);
    } catch (e) { if (typeof showTemporaryMessage === 'function') showTemporaryMessage('❌ ' + e.message, 2400); }
    finally { inp.value = ''; }
  });
});

// ==================== AMIGOS ====================
function socialEscapeHtml(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
function socialOpenFriendsModal() {
  const modal = document.getElementById('modal-friends');
  if (!modal) return;
  modal.classList.remove('hidden');
  const g = document.getElementById('friends-guest-notice'), l = document.getElementById('friends-logged-area');
  if (!isLoggedIn()) { if (g) g.classList.remove('hidden'); if (l) l.classList.add('hidden'); return; }
  if (g) g.classList.add('hidden');
  if (l) l.classList.remove('hidden');
  socialRefreshFriendsList();
}
function socialCloseFriendsModal() { const m = document.getElementById('modal-friends'); if (m) m.classList.add('hidden'); }
async function socialRefreshFriendsList() {
  try {
    const d = await authFetch('/api/friends');
    renderFriendRows('friends-incoming-list', d.incoming, 'incoming');
    renderFriendRows('friends-outgoing-list', d.outgoing, 'outgoing');
    renderFriendRows('friends-list', d.friends, 'friend');
  } catch (e) { console.warn('[social]', e.message); }
}
function friendRowHtml(e, kind) {
  const on = e.online ? '<span style="color:#4cff8b;">● online</span>' : '<span style="color:#7a8a99;">○ offline</span>';
  let act = '';
  if (kind === 'incoming') act = `<button class="btn-secondary btn-chip" data-action="accept" data-req="${e.requestId}">✅ Aceitar</button><button class="btn-secondary btn-chip" data-action="decline" data-req="${e.requestId}">❌ Recusar</button>`;
  else if (kind === 'outgoing') act = '<span style="font-size:11px;color:#7fbfd6;">Aguardando resposta...</span>';
  else act = `<button class="btn-secondary btn-chip" data-action="challenge" data-uid="${e.userId}" data-nick="${socialEscapeHtml(e.nickname)}" ${e.online ? '' : 'disabled'}>⚔️ Desafiar</button><button class="btn-secondary btn-chip" data-action="remove" data-uid="${e.userId}">🗑️</button>`;
  return `<div class="friend-row" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.08);"><div style="text-align:left;"><div style="font-weight:600;color:#E4EBFD;">${socialEscapeHtml(e.nickname)}</div><div style="font-size:11px;">${on}</div></div><div style="display:flex;gap:6px;">${act}</div></div>`;
}
function renderFriendRows(id, list, kind) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!list || !list.length) { el.innerHTML = '<div style="font-size:12px;color:#7a8a99;">Nada por aqui.</div>'; return; }
  el.innerHTML = list.map(x => friendRowHtml(x, kind)).join('');
}
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]'); if (!btn) return;
  const a = btn.dataset.action;
  try {
    if (a === 'accept' || a === 'decline') { await authFetch('/api/friends/respond', { method: 'POST', body: JSON.stringify({ requestId: Number(btn.dataset.req), accept: a === 'accept' }) }); socialRefreshFriendsList(); }
    if (a === 'remove') { await authFetch('/api/friends/remove', { method: 'POST', body: JSON.stringify({ userId: Number(btn.dataset.uid) }) }); socialRefreshFriendsList(); }
    if (a === 'add-friend') { await authFetch('/api/friends/request', { method: 'POST', body: JSON.stringify({ nickname: btn.dataset.nick }) }); if (typeof showTemporaryMessage === 'function') showTemporaryMessage('✅ Pedido enviado!', 1800); socialDoFriendSearch(); }
    if (a === 'challenge') socialChallengeFriend(Number(btn.dataset.uid), btn.dataset.nick);
  } catch (err) { if (typeof showTemporaryMessage === 'function') showTemporaryMessage('❌ ' + err.message, 2200); }
});
async function socialDoFriendSearch() {
  const input = document.getElementById('friends-search-input'), results = document.getElementById('friends-search-results');
  if (!input || !results) return;
  const q = input.value.trim();
  if (q.length < 2) { results.innerHTML = '<div style="font-size:12px;color:#7a8a99;">Digite pelo menos 2 letras.</div>'; return; }
  try {
    const d = await authFetch('/api/friends/search?q=' + encodeURIComponent(q));
    if (!d.results.length) { results.innerHTML = '<div style="font-size:12px;color:#7a8a99;">Ninguém encontrado.</div>'; return; }
    results.innerHTML = d.results.map(u => {
      let act = `<button class="btn-secondary btn-chip" data-action="add-friend" data-nick="${socialEscapeHtml(u.nickname)}">➕ Adicionar</button>`;
      if (u.status === 'friends') act = '<span style="font-size:11px;color:#4cff8b;">Já são amigos</span>';
      else if (u.status === 'sent') act = '<span style="font-size:11px;color:#7fbfd6;">Pedido enviado</span>';
      else if (u.status === 'received') act = '<span style="font-size:11px;color:#ffd23f;">Te chamou — veja "Pedidos recebidos"</span>';
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.08);"><div style="font-weight:600;color:#E4EBFD;">${socialEscapeHtml(u.nickname)}</div>${act}</div>`;
    }).join('');
  } catch (err) { results.innerHTML = `<div style="font-size:12px;color:#ff8080;">${socialEscapeHtml(err.message)}</div>`; }
}
function socialChallengeFriend(uid, nick) {
  if (!onlineState.socket || !onlineState.active) { if (typeof showTemporaryMessage === 'function') showTemporaryMessage('Crie uma sala primeiro e desafie de dentro dela.', 3200); return; }
  onlineState.socket.emit('challenge-friend', { friendUserId: uid, roomId: onlineState.roomId, roomName: 'Sala', password: false }, (res) => {
    if (!res || !res.success) { if (typeof showTemporaryMessage === 'function') showTemporaryMessage('❌ ' + ((res && res.message) || 'Não foi possível desafiar.'), 2600); }
    else if (typeof showTemporaryMessage === 'function') showTemporaryMessage(`⚔️ Convite enviado pra ${nick}!`, 2200);
  });
}
function socialOnFriendRequestReceived(d) { if (typeof showTemporaryMessage === 'function') showTemporaryMessage(`👥 ${d.fromNickname} quer ser seu amigo!`, 3000); socialRefreshFriendsList(); }
function socialOnFriendRequestAnswered(d) { if (typeof showTemporaryMessage === 'function') showTemporaryMessage(d.accepted ? `✅ ${d.byNickname} aceitou seu pedido!` : `${d.byNickname} recusou seu pedido.`, 3000); socialRefreshFriendsList(); }
function socialOnChallengeInvite(d) {
  const accept = confirm(`⚔️ ${d.fromNickname} te desafiou! Aceitar e entrar na sala dele?`);
  if (onlineState.socket) onlineState.socket.emit('challenge-response', { fromSocketId: d.fromSocketId, accept });
  if (!accept) return;
  if (typeof leaveOnlineIfNeeded === 'function') leaveOnlineIfNeeded();
  document.getElementById('main-menu')?.classList.add('hidden');
  const pd = {
    name: (document.getElementById('menu-name') || {}).value || 'Piloto',
    color: (document.getElementById('menu-color-custom') || {}).value || '#00e5ff',
    planeType: (typeof selectedPlaneType !== 'undefined') ? selectedPlaneType : 'cessna',
    pilot: (typeof selectedPilotIndex !== 'undefined') ? selectedPilotIndex : 1,
  };
  const pw = d.password ? (prompt('Senha da sala:') || '') : '';
  if (typeof connectOnline === 'function') connectOnline(d.roomId, pd, pw);
}
function socialOnChallengeResponse(d) { if (typeof showTemporaryMessage === 'function') showTemporaryMessage(d.accepted ? `✅ ${d.byNickname} aceitou o desafio!` : `${d.byNickname} recusou o desafio.`, 2800); }

// ==================== CENTRAL DO PILOTO ====================
let centralEl = null;
function ensureCentral() {
  if (centralEl) return centralEl;
  centralEl = document.createElement('div');
  centralEl.id = 'pilot-central';
  centralEl.style.cssText = 'position:fixed;inset:0;z-index:950;background:rgba(1,10,25,0.97);overflow-y:auto;display:none;padding:20px 14px 60px;color:#E4EBFD;';
  const st = document.createElement('style');
  st.textContent = `#pilot-central, #pilot-central *{box-sizing:border-box}
#pilot-central .pc-wrap{max-width:1080px;margin:0 auto;}
#pilot-central .pc-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:14px;}
#pilot-central .pc-title{font-family:var(--font-display,'Rajdhani');font-size:24px;font-weight:800;color:var(--gold,#FEBA02);letter-spacing:1px;}
#pilot-central .pc-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px;}
#pilot-central .pc-tab{padding:9px 16px;border:1px solid var(--line,rgba(254,186,2,.35));background:rgba(228,235,253,.05);color:#cfe6ff;cursor:pointer;font-family:var(--font-display);font-weight:700;font-size:13px;letter-spacing:.5px;}
#pilot-central .pc-tab.active{background:linear-gradient(135deg,var(--gold,#FEBA02),#c99000);color:#1a1200;border-color:transparent;}
#pilot-central .pc-card{background:rgba(1,31,67,.85);border:1px solid var(--line-soft,rgba(254,186,2,.16));border-radius:12px;padding:14px;margin-bottom:12px;color:#E4EBFD;}
#pilot-central .pc-sub{font-weight:800;color:var(--gold,#FEBA02);font-size:13px;letter-spacing:.5px;margin-bottom:10px;}
#pilot-central .pc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;}
#pilot-central .pc-rank{text-align:center;padding:10px 6px;border-radius:10px;border:1px solid rgba(255,255,255,.07);opacity:.45;}
#pilot-central .pc-rank.have{opacity:1;border-color:rgba(254,186,2,.5);background:rgba(254,186,2,.07);}
#pilot-central .pc-rank.now{opacity:1;border-color:#4cff8b;box-shadow:0 0 12px rgba(76,255,139,.35);}
#pilot-central .pc-rank img{width:56px;height:80px;object-fit:contain;margin:0 auto 6px;}
#pilot-central .pc-rank .n{font-size:10px;font-weight:700;color:#fff;}
#pilot-central .pc-rank .q{font-size:9.5px;color:var(--gold,#FEBA02);}
#pilot-central .pc-medal{text-align:center;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.07);}
#pilot-central .pc-medal img{width:52px;height:52px;object-fit:contain;margin:0 3px;opacity:.22;filter:grayscale(1);}
#pilot-central .pc-medal img.on{opacity:1;filter:none;}
#pilot-central .pc-medal .n{font-size:11px;font-weight:700;color:var(--gold,#FEBA02);margin-bottom:6px;}
#pilot-central .pc-medal .r{font-size:9.5px;color:#b9c8dd;margin-top:5px;}
#pilot-central .pc-row{display:grid;grid-template-columns:44px 40px 1fr auto;gap:10px;align-items:center;padding:8px 4px;border-bottom:1px solid rgba(255,255,255,.06);font-size:13px;color:#E4EBFD;}
#pilot-central .pc-row img.ri{width:34px;height:48px;object-fit:contain;}
#pilot-central .pc-who{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap;}
#pilot-central .pc-photo{width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid rgba(254,186,2,.45);flex-shrink:0;background:rgba(228,235,253,.08);}
#pilot-central .pc-ini{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;color:#00131a;flex-shrink:0;}
#pilot-central .pc-timg{width:20px;height:20px;object-fit:contain;filter:drop-shadow(0 0 4px rgba(254,186,2,.6));flex-shrink:0;}
#pilot-central .pc-nk{font-weight:700;color:#fff;min-width:0;}
#pilot-central .pc-nk small{display:block;font-size:10px;color:#b9c8dd;font-weight:500;}
#pilot-central .pc-st{color:#b9c8dd;font-size:11.5px;text-align:right;}
#pilot-central .pc-empty{text-align:center;color:#7a8a99;padding:30px;font-size:13px;}
#pilot-central .pc-chips{display:flex;flex-wrap:wrap;gap:8px;}
#pilot-central .pc-chip{display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.15);background:rgba(228,235,253,.05);color:#E4EBFD;cursor:pointer;font-size:11px;font-weight:700;transition:.15s;}
#pilot-central .pc-chip img{width:26px;height:26px;object-fit:contain;}
#pilot-central .pc-chip.on{border-color:#4cff8b;background:rgba(76,255,139,.15);box-shadow:0 0 10px rgba(76,255,139,.35);}
#pilot-central .pc-btn{margin-top:12px;padding:10px 22px;border:none;border-radius:8px;background:linear-gradient(135deg,#FEBA02,#c99000);color:#1a1200;font-weight:800;font-family:var(--font-display);cursor:pointer;}
#pilot-central .pc-btn:disabled{opacity:.6;cursor:wait;}
#pilot-central .pc-me-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;}
#pilot-central .pc-avatar{width:64px;height:64px;border-radius:50%;object-fit:cover;border:3px solid var(--gold,#FEBA02);}
#pilot-central .pc-me-name{font-size:18px;font-weight:800;color:#fff;}
#pilot-central .pc-me-rank{font-size:12px;color:var(--gold,#FEBA02);}
#pilot-central .pc-bar{flex:1;min-width:200px;height:12px;background:rgba(255,255,255,.08);border-radius:6px;overflow:hidden;}
#pilot-central .pc-barfill{height:100%;background:linear-gradient(90deg,#FEBA02,#ff8a00);}
#pilot-central .pc-statgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;text-align:center;font-size:12px;color:#b9c8dd;margin-top:14px;}
#pilot-central .pc-statgrid b{color:#fff;display:block;font-size:15px;}`;
  document.head.appendChild(st);
  document.body.appendChild(centralEl);
  return centralEl;
}
function pcEsc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
function pcFmtT(s) { const h = Math.floor(s / 3600), m = Math.round(s % 3600 / 60); return h > 0 ? h + 'h ' + m + 'min' : m + ' min'; }
// Imagens SEMPRE com chave hífen (padrão dos arquivos no disco)
function pcTitlesHtml(list, cls) {
  return (list || []).map(t => `<img class="${cls}" src="img/${normKey(t.key)}-${LVLN[t.level] || 'bronze'}.png" title="${pcEsc(MEDAL_NAMES[normKey(t.key)] || t.key)} (${LVLN[t.level] || 'bronze'})" onerror="this.style.display='none'">`).join('');
}

async function socialOpenRankingModal() {
  const el = ensureCentral();
  el.style.display = 'block';
  el.innerHTML = '<div class="pc-wrap"><div class="pc-head"><div class="pc-title">🎖️ CENTRAL DO PILOTO</div><button class="btn-secondary btn-danger" id="pc-close">✕ FECHAR</button></div><div class="pc-tabs"><button class="pc-tab active" data-t="rank">🏆 RANKING</button><button class="pc-tab" data-t="pat">🎖️ PATENTES</button><button class="pc-tab" data-t="med">🏅 CONDECORAÇÕES</button><button class="pc-tab" data-t="me">👤 MEU PERFIL</button></div><div id="pc-body"><div class="pc-empty">Carregando...</div></div></div>';
  document.getElementById('pc-close').onclick = () => { el.style.display = 'none'; };
  let tab = 'rank', data = null, me = null;
  el.querySelectorAll('.pc-tab').forEach(b => b.onclick = () => {
    el.querySelectorAll('.pc-tab').forEach(x => x.classList.toggle('active', x === b));
    tab = b.dataset.t;
    draw();
  });

  async function load() {
    try { data = await (await fetch('/api/ranking')).json(); } catch (e) { data = null; }
    if (typeof isLoggedIn === 'function' && isLoggedIn()) {
      try { me = normalizeMe(await authFetch('/api/profile/me')); } catch (e) { me = null; }
    }
    draw();
  }

  function photoHtml(p, size) {
    if (p.photoUrl) return `<img class="pc-photo" style="width:${size}px;height:${size}px" src="${p.photoUrl}" onerror="this.outerHTML='<span class=&quot;pc-ini&quot; style=&quot;background:#FEBA02;width:${size}px;height:${size}px&quot;>${pcEsc((p.nickname || '?')[0].toUpperCase())}</span>'">`;
    return `<span class="pc-ini" style="background:#0583F2;width:${size}px;height:${size}px">${pcEsc((p.nickname || '?')[0].toUpperCase())}</span>`;
  }

  function draw() {
    const body = document.getElementById('pc-body');
    if (!body) return;
    if (tab === 'rank') {
      if (!data) { body.innerHTML = '<div class="pc-empty">Não deu pra carregar o ranking agora.</div>'; return; }
      const T = [['topKills', '🎯', 'Maior Abatedor'], ['topBlimps', '🎈', 'Caçador de Dirigíveis'], ['topPlaytime', '⏱️', 'Mais Horas Voadas'], ['topWins', '👑', 'Mais Vitórias'], ['topMvps', '🏆', 'Mais MVPs']];
      let h = '<div class="pc-card" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;text-align:center;">' + T.map(([k, ic, lb]) => {
        const r = data.titles && data.titles[k];
        return `<div><div style="font-size:11px;color:#b9c8dd;">${ic} ${lb}</div>${r ? `<div style="color:#4cff8b;font-weight:700;">👑 ${pcEsc(r.nickname)}</div><div style="font-size:11px;color:var(--gold,#FEBA02);">${k === 'topPlaytime' ? pcFmtT(r.value) : r.value}</div>` : '<div style="color:#7a8a99;">—</div>'}</div>`;
      }).join('') + '</div>';
      const L = (data.leaderboard || []).slice(0, 20);
      h += '<div class="pc-card">' + (L.length ? L.map((p, i) => {
        const rk = RANKS_CLIENT.find(x => x.k === p.rankKey) || RANKS_CLIENT[0];
        return `<div class="pc-row"><span style="font-weight:800;color:${i < 3 ? ['#FEBA02', '#cdd6e0', '#cd7f32'][i] : '#b9c8dd'};">${i < 3 ? ['🥇', '🥈', '🥉'][i] : (i + 1) + 'º'}</span><img class="ri" src="img/${rk.img}" onerror="this.style.visibility='hidden'"><span class="pc-who">${pcTitlesHtml(p.titles, 'pc-timg')}${photoHtml(p, 34)}<span class="pc-nk">${pcEsc(p.nickname)}<small>${rk.n}</small></span></span><span class="pc-st">⚔${p.kills} 💀${p.deaths} 🎈${p.blimp_kills}<br>${pcFmtT(p.playtime_seconds)}</span></div>`;
      }).join('') : '<div class="pc-empty">Ninguém jogou logado ainda — seja o primeiro!</div>') + '</div>';
      body.innerHTML = h;
    } else if (tab === 'pat') {
      const cur = me ? me.rank.index : -1;
      body.innerHTML = '<div class="pc-card"><div class="pc-grid">' + RANKS_CLIENT.map((r, i) => `<div class="pc-rank ${i === cur ? 'now' : (i < cur ? 'have' : '')}"><img src="img/${r.img}" onerror="this.style.opacity=.2"><div class="n">${r.n}</div><div class="q">${r.q} abates</div></div>`).join('') + '</div></div>';
    } else if (tab === 'med') {
      const owned = {};
      (me ? me.medals : []).forEach(m => { owned[m.medal_key] = m.level; });
      let h = '<div class="pc-card"><div class="pc-sub">🏅 CONDECORAÇÕES (Bronze / Prata / Ouro)</div><div class="pc-grid">' + Object.keys(MEDAL_NAMES).filter(k => !SECRET_MEDALS.includes(k)).map(k => {
        const lv = owned[k] || 0;
        return `<div class="pc-medal"><div class="n">${MEDAL_NAMES[k]}</div>${[1, 2, 3].map(i => `<img class="${lv >= i ? 'on' : ''}" src="img/${k}-${LVLN[i]}.png" onerror="this.style.opacity=${lv >= i ? 1 : .15}">`).join('')}<div class="r">${lv ? 'Nível: ' + LVLN[lv].toUpperCase() : 'Não conquistada'}</div></div>`;
      }).join('') + '</div></div>';
      h += '<div class="pc-card"><div class="pc-sub" style="color:#c99bff;">🔒 SECRETAS</div><div class="pc-grid">' + SECRET_MEDALS.map(k => {
        const has = owned[k];
        return `<div class="pc-medal" style="${has ? 'border-color:#c99bff;' : ''}"><div class="n" style="color:#c99bff;">${has ? MEDAL_NAMES[k] : '???'}</div><img class="${has ? 'on' : ''}" src="img/${k}.png" onerror="this.style.opacity=.15"><div class="r">${has ? 'Conquistada!' : 'Continue jogando para descobrir...'}</div></div>`;
      }).join('') + '</div></div>';
      body.innerHTML = h;
    } else {
      // ================= ABA MEU PERFIL + SALVAR TÍTULOS =================
      if (!me) { body.innerHTML = '<div class="pc-empty">🔑 Faça login para ver sua carreira militar.<br>Sem conta, o jogo funciona 100% — mas abates, patentes e medalhas só contam para quem está logado.</div>'; return; }
      const rk = me.rank;
      const owned = {};
      me.medals.filter(m => m.level > 0).forEach(m => { owned[m.medal_key] = m.level; });
      const ownedList = Object.keys(owned).map(k => ({ key: k, level: owned[k] }));
      let sel = (me.profile.selectedTitles || []).filter(k => owned[k]).slice(0, 3);

      function drawMe() {
        const avatar = me.profile.photoUrl || ('img/piloto' + (me.profile.preferredPilot || 1) + '.png');
        const myTitles = sel.filter(k => owned[k]).map(k => ({ key: k, level: owned[k] }));
        body.innerHTML = `<div class="pc-card"><div class="pc-me-row"><img class="pc-avatar" src="${avatar}" onerror="this.style.opacity=.3"><span style="display:flex;gap:4px;align-items:center;">${pcTitlesHtml(myTitles, 'pc-timg')}</span><div style="min-width:0;"><div class="pc-me-name">${pcEsc((typeof authState !== 'undefined' && authState.user) ? authState.user.nickname : 'Piloto')}</div><div class="pc-me-rank">🎖️ ${rk.name}${rk.next ? ` · faltam ${rk.next.at - rk.current} abates p/ ${rk.next.name}` : ' · patente máxima!'}</div></div></div><div class="pc-bar" style="width:100%"><div class="pc-barfill" style="width:${rk.next ? Math.min(100, (rk.current / rk.next.at) * 100) : 100}%"></div></div><div class="pc-statgrid"><div>🛫 Partidas<b>${me.stats.matches_played}</b></div><div>⚔ Abates<b>${me.stats.kills}</b></div><div>💀 Mortes<b>${me.stats.deaths}</b></div><div>🎈 Dirigíveis<b>${me.stats.blimp_kills}</b></div><div>👑 Vitórias<b>${me.stats.wins}</b></div><div>🏆 MVPs<b>${me.stats.mvps}</b></div><div>⏱ Voo<b>${pcFmtT(me.stats.playtime_seconds)}</b></div><div>📅 Logins<b>${me.stats.login_days}</b></div></div></div>` +
          (ownedList.length
            ? `<div class="pc-card"><div class="pc-sub">🎖️ TÍTULOS EXIBIDOS — escolha até 3 (aparecem ao lado da sua foto no ranking)</div><div class="pc-chips" id="pc-chips">` + ownedList.map(m => `<button class="pc-chip ${sel.includes(m.key) ? 'on' : ''}" data-k="${m.key}"><img src="img/${m.key}-${LVLN[m.level]}.png" onerror="this.style.display='none'"><span>${MEDAL_NAMES[m.key] || m.key} (${LVLN[m.level]})</span></button>`).join('') + `</div><button class="pc-btn" id="pc-save-titles">💾 SALVAR TÍTULOS</button><div style="font-size:11px;color:#b9c8dd;margin-top:8px;">Selecionados: ${sel.length}/3</div></div>`
            : `<div class="pc-card"><div class="pc-empty">Você ainda não conquistou nenhuma condecoração.</div></div>`);

        const chips = document.getElementById('pc-chips');
        if (chips) chips.querySelectorAll('.pc-chip').forEach(c => c.onclick = () => {
          const k = normKey(c.dataset.k);
          if (sel.includes(k)) sel = sel.filter(x => x !== k);
          else {
            if (sel.length >= 3) { if (typeof showTemporaryMessage === 'function') showTemporaryMessage('⚠️ Máximo de 3 títulos!', 1800); return; }
            sel.push(k);
          }
          drawMe();
        });

        // ===== BOTÃO SALVAR — feedback + prova round-trip =====
        const sv = document.getElementById('pc-save-titles');
        if (sv) sv.onclick = async () => {
          sv.disabled = true;
          sv.textContent = '⏳ SALVANDO...';
          const wanted = sel.slice();
          console.log('[social] salvando títulos:', wanted);
          try {
            await authFetch('/api/profile/settings', { method: 'POST', body: JSON.stringify({ selectedTitles: wanted }) });
            const check = normalizeMe(await authFetch('/api/profile/me'));
            me = check;
            socialState.stats = check.stats;
            sel = (me.profile.selectedTitles || []).filter(k => owned[k]).slice(0, 3);
            sv.textContent = '✅ TÍTULOS SALVOS!';
            renderIdentityBadge(me);
            if (sel.length === wanted.length) {
              if (typeof showTemporaryMessage === 'function') showTemporaryMessage('✅ Títulos salvos! Já aparecem no ranking do jogo e do site.', 2600);
            } else {
              if (typeof showTemporaryMessage === 'function') showTemporaryMessage('⚠️ Salvou parcialmente — só valem medalhas que você possui.', 2600);
            }
            console.log('[social] títulos confirmados no servidor:', sel);
            setTimeout(drawMe, 900);
          } catch (e) {
            sv.disabled = false;
            sv.textContent = '💾 SALVAR TÍTULOS';
            if (typeof showTemporaryMessage === 'function') showTemporaryMessage('❌ ' + e.message, 2600);
            console.error('[social] erro ao salvar títulos:', e);
          }
        };
      }
      drawMe();
    }
  }
  load();
}

// ==================== NOTIFICAÇÃO DE TÍTULO DESTRAVADO ====================
// PEDIDO: quando o servidor manda 'titles-unlocked' (ver
// profile.js/_notifyUnlocked), mostra um card grande e vistoso — bem
// diferente do showTemporaryMessage padrão — pra ficar óbvio que
// destravou uma condecoração nova. Empilha um card por título se vier
// mais de um de uma vez.
function socialOnTitlesUnlocked(d) {
  const list = (d && d.titles) || [];
  if (!list.length) return;
  let host = document.getElementById('title-unlock-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'title-unlock-host';
    host.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:1200;display:flex;flex-direction:column;gap:10px;align-items:center;pointer-events:none;';
    document.body.appendChild(host);
    if (!document.getElementById('title-unlock-style')) {
      const st = document.createElement('style');
      st.id = 'title-unlock-style';
      st.textContent = `
@keyframes tuIn{0%{opacity:0;transform:translateY(-24px) scale(.9)}60%{opacity:1;transform:translateY(4px) scale(1.03)}100%{opacity:1;transform:none}}
@keyframes tuOut{to{opacity:0;transform:translateY(-16px) scale(.95)}}
.tu-card{display:flex;align-items:center;gap:12px;padding:12px 20px;border-radius:14px;background:linear-gradient(135deg,rgba(20,15,0,.95),rgba(40,26,0,.95));border:1.5px solid var(--gold,#FEBA02);box-shadow:0 0 30px rgba(254,186,2,.45),0 10px 30px rgba(0,0,0,.5);animation:tuIn .5s cubic-bezier(.2,1,.3,1) both;}
.tu-card img{width:46px;height:46px;object-fit:contain;filter:drop-shadow(0 0 8px rgba(254,186,2,.7));}
.tu-card .tu-txt{text-align:left;}
.tu-card .tu-h{font-family:var(--font-display,'Orbitron');font-size:10px;letter-spacing:1.5px;color:var(--gold,#FEBA02);font-weight:800;}
.tu-card .tu-n{font-size:15px;font-weight:800;color:#fff;}
.tu-card .tu-l{font-size:11px;color:#b9c8dd;}`;
      document.head.appendChild(st);
    }
  }
  list.forEach((t, i) => {
    setTimeout(() => {
      const key = normKey(t.key);
      const lvlLabel = LVLN[t.level] || 'bronze';
      const card = document.createElement('div');
      card.className = 'tu-card';
      card.innerHTML = `<img src="img/${key}-${lvlLabel}.png" onerror="this.style.display='none'"><div class="tu-txt"><div class="tu-h">🎖️ NOVO TÍTULO DESTRAVADO</div><div class="tu-n">${pcEsc(MEDAL_NAMES[key] || t.name || key)}</div><div class="tu-l">Nível: ${lvlLabel.toUpperCase()}</div></div>`;
      host.appendChild(card);
      if (typeof playSound === 'function') { try { playSound('medal_unlock'); } catch (e) {} }
      setTimeout(() => { card.style.animation = 'tuOut .4s ease forwards'; setTimeout(() => card.remove(), 420); }, 4200);
    }, i * 550);
  });
  // A conquista pode ter mudado o que dá pra selecionar em "Meus
  // Títulos" — se a Central do Piloto estiver aberta na aba certa, ela
  // vai buscar de novo na próxima abertura. Aqui só atualiza o selo fixo.
  refreshIdentityBadge();
}

// ==================== SELO NO MENU (foto + nome + patente + títulos) ====================
// PEDIDO: "as fotinhas dos títulos na frente do meu nome". IMPORTANTE:
// esta função só desenha alguma coisa SE existir um container real no seu
// HTML com id="player-identity-slot" — ela NUNCA cria elemento flutuante
// novo na tela. Você já tem foto e nome em algum lugar do seu menu; quando
// me mandar esse trecho do HTML eu te digo exatamente o id certo pra
// colocar ali (ou eu mesmo adiciono os 3 ícones de título do lado do que
// já existe, sem duplicar nada).
function renderIdentityBadge(me) {
  const box = document.getElementById('player-identity-slot');
  if (!box) return; // nada de auto-criar UI nova — só usa o que já existe
  if (!me || !me.profile) { box.innerHTML = ''; return; }
  const rk = RANKS_CLIENT.find(x => x.k === me.rank.key) || RANKS_CLIENT[0];
  const avatar = me.profile.photoUrl || ('img/piloto' + (me.profile.preferredPilot || 1) + '.png');
  const nickname = (typeof authState !== 'undefined' && authState.user) ? authState.user.nickname : 'Piloto';
  const owned = {};
  (me.medals || []).filter(m => m.level > 0).forEach(m => { owned[m.medal_key] = m.level; });
  const sel = (me.profile.selectedTitles || []).filter(k => owned[k]).slice(0, 3).map(k => ({ key: k, level: owned[k] }));
  box.innerHTML = pcTitlesHtml(sel, 'pid-timg');
}
async function refreshIdentityBadge() {
  if (typeof isLoggedIn !== 'function' || !isLoggedIn()) { renderIdentityBadge(null); return; }
  try { renderIdentityBadge(normalizeMe(await authFetch('/api/profile/me'))); } catch (e) { /* silencioso */ }
}

// PEDIDO: pluga o listener de 'titles-unlocked' assim que o socket da
// partida existir (multiplayer.js cria/recria onlineState.socket em
// outro arquivo, então observamos em vez de assumir que já existe aqui).
(function watchSocketForTitles() {
  setInterval(() => {
    if (typeof onlineState !== 'undefined' && onlineState.socket && !onlineState.socket.__titlesHooked) {
      onlineState.socket.__titlesHooked = true;
      onlineState.socket.on('titles-unlocked', socialOnTitlesUnlocked);
    }
  }, 1000);
})();

// ==================== SELO DE JOGADOR PRA LOBBY/SALA (drop-in) ====================
// PEDIDO: "os títulos aparecerem no sistema de salas pros meus amigos e
// oponentes verem". O server.js agora manda rankKey/titles/photoUrl de
// cada jogador dentro do payload de 'room-update' (ver roomState() no
// server.js). Essa função transforma UM jogador desse payload num HTML
// prontinho — chame ela de dentro de onde quer que você desenhe a lista
// de jogadores da sala (provavelmente no seu multiplayer.js/lobby.js,
// que não veio nesses arquivos — cole o trecho que monta cada linha de
// jogador que eu plugo certinho pra você, mas por enquanto isso já
// funciona standalone, só chamando renderPlayerBadgeInline(p) pra cada
// jogador de data.players):
//
//   room.players.forEach(p => {
//     row.innerHTML += renderPlayerBadgeInline(p) + `<span>${p.name}</span>...`;
//   });
//
function renderPlayerBadgeInline(p) {
  const rk = RANKS_CLIENT.find(x => x.k === p.rankKey);
  const rankImg = rk ? `<img class="pbi-rank" src="img/${rk.img}" title="${pcEsc(rk.n)}" onerror="this.style.display='none'">` : '';
  const photo = p.photoUrl
    ? `<img class="pbi-photo" src="${p.photoUrl}" onerror="this.outerHTML='<span class=&quot;pbi-ini&quot;>${pcEsc((p.name || '?')[0].toUpperCase())}</span>'">`
    : `<span class="pbi-ini">${pcEsc((p.name || '?')[0].toUpperCase())}</span>`;
  const titles = (p.titles || []).map(t => `<img class="pbi-t" src="img/${normKey(t.key)}-${LVLN[t.level] || 'bronze'}.png" title="${pcEsc(MEDAL_NAMES[normKey(t.key)] || t.key)}" onerror="this.style.display='none'">`).join('');
  if (!document.getElementById('pbi-style')) {
    const st = document.createElement('style');
    st.id = 'pbi-style';
    st.textContent = `.pbi-wrap{display:inline-flex;align-items:center;gap:4px;vertical-align:middle;}.pbi-photo,.pbi-ini{width:24px;height:24px;border-radius:50%;object-fit:cover;border:1.5px solid rgba(254,186,2,.5);}.pbi-ini{display:inline-flex;align-items:center;justify-content:center;background:#0583F2;color:#fff;font-weight:800;font-size:11px;}.pbi-rank{width:13px;height:19px;object-fit:contain;}.pbi-t{width:15px;height:15px;object-fit:contain;filter:drop-shadow(0 0 3px rgba(254,186,2,.6));}`;
    document.head.appendChild(st);
  }
  return `<span class="pbi-wrap">${photo}${rankImg}${titles}</span>`;
}

// ==================== TIRO PERFEITO (cliente reporta) ====================
(function () {
  let streak = 0, pendingShot = false, pendingTimer = null;
  function wrap() {
    const real = window.playSound;
    if (!real || real.__tpWrapped) return;
    const wrapped = function (name, ...rest) {
      try {
        if (name === 'shot') { pendingShot = true; clearTimeout(pendingTimer); pendingTimer = setTimeout(() => { pendingShot = false; streak = 0; }, 2000); }
        else if (name === 'hit_confirm') {
          if (pendingShot || streak > 0) { streak++; pendingShot = false; clearTimeout(pendingTimer); }
          else streak = 1;
          if (streak >= 20 && typeof isLoggedIn === 'function' && isLoggedIn() && onlineState.socket) {
            onlineState.socket.emit('report-medal', 'tiro-perfeito');
            streak = 0;
          }
        }
      } catch (e) {}
      return real.apply(this, [name, ...rest]);
    };
    wrapped.__tpWrapped = true;
    window.playSound = wrapped;
  }
  if (window.playSound) wrap();
  else document.addEventListener('DOMContentLoaded', wrap);
})();

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  const bf = document.getElementById('btn-friends'), lbf = document.getElementById('lobby-btn-friends'), br = document.getElementById('btn-ranking'), cf = document.getElementById('modal-friends-close'), cr = document.getElementById('modal-ranking-close'), sb = document.getElementById('friends-search-btn'), si = document.getElementById('friends-search-input');
  if (bf) bf.addEventListener('click', socialOpenFriendsModal);
  if (lbf) lbf.addEventListener('click', socialOpenFriendsModal);
  if (br) br.addEventListener('click', socialOpenRankingModal);
  if (cf) cf.addEventListener('click', socialCloseFriendsModal);
  if (cr) cr.addEventListener('click', () => { const m = document.getElementById('modal-ranking'); if (m) m.classList.add('hidden'); });
  if (sb) sb.addEventListener('click', socialDoFriendSearch);
  if (si) si.addEventListener('keypress', (e) => { if (e.key === 'Enter') socialDoFriendSearch(); });
});