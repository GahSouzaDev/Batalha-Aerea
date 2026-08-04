// social-client.js — perfil/amigos + CENTRAL DO PILOTO (ranking/patentes/condecorações em tela cheia)
// Depende de auth-client.js (authState, authFetch, isLoggedIn).
const RANKS = [
  { k: 's2', n: 'Soldado de Segunda Classe (S2)', q: 0, img: 'soldado-de-segunda-classe(s2).png' },
  { k: 's1', n: 'Soldado de Primeira Classe (S1)', q: 25, img: 'soldado-de-primeira-classe(s1).png' },
  { k: 'cabo', n: 'Cabo', q: 75, img: 'cabo.png' }, { k: '3s', n: 'Terceiro-Sargento', q: 150, img: 'terceiro-sargento.png' },
  { k: '2s', n: 'Segundo-Sargento', q: 300, img: 'segundo-sargento.png' }, { k: '1s', n: 'Primeiro-Sargento', q: 500, img: 'primeiro-sargento.png' },
  { k: 'sub', n: 'Suboficial', q: 750, img: 'suboficial.png' }, { k: 'asp', n: 'Aspirante a Oficial', q: 1000, img: 'aspirante-a-oficial.png' },
  { k: '2t', n: 'Segundo-Tenente', q: 1400, img: 'segundo-tenente.png' }, { k: '1t', n: 'Primeiro-Tenente', q: 1900, img: 'primeiro-tenente.png' },
  { k: 'cap', n: 'Capitão', q: 2500, img: 'capitao.png' }, { k: 'maj', n: 'Major', q: 3200, img: 'major.png' },
  { k: 'tc', n: 'Tenente-Coronel', q: 4000, img: 'tenente-coronel.png' }, { k: 'cel', n: 'Coronel', q: 5000, img: 'coronel.png' },
  { k: 'brig', n: 'Brigadeiro', q: 6500, img: 'brigadeiro.png' }, { k: 'mbrig', n: 'Major-Brigadeiro', q: 8000, img: 'major-brigadeiro.png' },
  { k: 'tbrig', n: 'Tenente-Brigadeiro', q: 10000, img: 'tenente-brigadeiro.png' },
];
const MEDALS = [
  ['veterano_dos_ceus', 'Veterano dos Céus', '5/20/75 horas de voo'], ['as_dos_ceus', 'Ás dos Céus', '50/250/1000 abates'],
  ['mestre_da_sobrevivencia', 'Mestre da Sobrevivência', '5/15/50 partidas seguidas vivo'], ['fantasma_dos_ceus', 'Fantasma dos Céus', 'K/D 1.5/2.5/4.0'],
  ['abatedor_de_dirigiveis', 'Abatedor de Dirigíveis', '10/50/250 dirigíveis'], ['bombardeiro_de_elite', 'Bombardeiro de Elite', '25/100/400 mortes com bomba'],
  ['mestre_dos_misseis', 'Mestre dos Mísseis', '25/100/400 mortes com míssil'], ['heroi_da_esquadrilha', 'Herói da Esquadrilha', '10/50/200 MVPs'],
  ['conquistador_dos_ceus', 'Conquistador dos Céus', '25/100/500 vitórias'], ['piloto_veterano', 'Piloto Veterano', '50/250/1000 partidas'],
  ['implacavel', 'Implacável', '5/10/20 min vivo numa partida'], ['blindagem_viva', 'Blindagem Viva', '500/2.000/10.000 de dano sofrido'],
  ['ultimo_no_ceu', 'Último no Céu', '10/50/250 vezes último sobrevivente'], ['primeiro_ataque', 'Primeiro Ataque', '10/50/250 primeiros abates'],
  ['piloto_dedicado', 'Piloto Dedicado', '7/30/180 dias de login'], ['orgulho_da_esquadrilha', 'Orgulho da Esquadrilha', 'Sargento/Capitão/Tenente-Brigadeiro'],
];
const SECRETS = [
  ['fenix', 'Fênix', 'Vença após ser abatido 5 vezes no mesmo dia.'], ['kamikaze', 'Kamikaze', 'Destrua um dirigível e mate com a explosão.'],
  ['tiro_perfeito', 'Tiro Perfeito', '20 tiros seguidos sem errar.'], ['cacador_relampago', 'Caçador Relâmpago', '3 abates em menos de 20s.'],
  ['dominio_aereo', 'Domínio Aéreo', 'Vença uma partida sem morrer.'], ['lenda_da_batalha_aerea', 'Lenda da Batalha Aérea', 'Todas as medalhas Ouro.'],
];
const LVL = ['bronze', 'prata', 'ouro'];
const socialState = { stats: null };

// ==================== PERFIL ====================
async function socialOnLogin() {
  const g = document.getElementById('friends-guest-notice'), l = document.getElementById('friends-logged-area'), pb = document.getElementById('profile-photo-block');
  if (g) g.classList.add('hidden'); if (l) l.classList.remove('hidden'); if (pb) pb.classList.remove('hidden');
  try { const d = await authFetch('/api/profile/me'); applyProfileToUI(d.profile); socialState.stats = d.stats; } catch (e) { console.warn('[social]', e.message); }
}
function applyProfileToUI(profile) {
  if (!profile) return;
  if (typeof setGameSoundMuted === 'function') setGameSoundMuted(!profile.soundEnabled);
  if (profile.preferredPlane && typeof PLANE_ORDER !== 'undefined' && typeof selectCarouselIndex === 'function') { const i = PLANE_ORDER.indexOf(profile.preferredPlane); if (i >= 0) selectCarouselIndex('menu', 'menu', i); }
  if (profile.photoUrl && typeof setCustomPilotPhoto === 'function') setCustomPilotPhoto(profile.photoUrl, false);
}
let _saveDeb = null;
function socialSaveSettings(partial) {
  if (typeof isLoggedIn !== 'function' || !isLoggedIn()) return;
  clearTimeout(_saveDeb);
  _saveDeb = setTimeout(() => authFetch('/api/profile/settings', { method: 'POST', body: JSON.stringify(partial) }).catch(() => {}), 400);
}
document.addEventListener('DOMContentLoaded', () => {
  const m = document.getElementById('menu-mute-toggle'); if (m) m.addEventListener('change', () => socialSaveSettings({ soundEnabled: !m.checked }));
  const mu = document.getElementById('menu-lobby-music-toggle'); if (mu) mu.addEventListener('change', () => socialSaveSettings({ musicEnabled: mu.checked }));
  const inp = document.getElementById('profile-photo-input');
  if (inp) inp.addEventListener('change', async () => {
    const f = inp.files && inp.files[0]; if (!f || !isLoggedIn()) { inp.value = ''; return; }
    const fd = new FormData(); fd.append('photo', f);
    try {
      const res = await fetch('/api/profile/photo', { method: 'POST', headers: { Authorization: `Bearer ${authState.token}` }, body: fd });
      const d = await res.json(); if (!res.ok) throw new Error(d.error || 'Erro ao enviar foto.');
      if (typeof setCustomPilotPhoto === 'function') setCustomPilotPhoto(d.photoUrl + '?t=' + Date.now(), true);
      if (typeof showTemporaryMessage === 'function') showTemporaryMessage('📷 Foto atualizada!', 1800);
    } catch (e) { if (typeof showTemporaryMessage === 'function') showTemporaryMessage('❌ ' + e.message, 2400); }
    finally { inp.value = ''; }
  });
});

// ==================== AMIGOS ====================
function socialEscapeHtml(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
function socialOpenFriendsModal() {
  const modal = document.getElementById('modal-friends'); if (!modal) return;
  modal.classList.remove('hidden');
  const g = document.getElementById('friends-guest-notice'), l = document.getElementById('friends-logged-area');
  if (!isLoggedIn()) { if (g) g.classList.remove('hidden'); if (l) l.classList.add('hidden'); return; }
  if (g) g.classList.add('hidden'); if (l) l.classList.remove('hidden');
  socialRefreshFriendsList();
}
function socialCloseFriendsModal() { const m = document.getElementById('modal-friends'); if (m) m.classList.add('hidden'); }
async function socialRefreshFriendsList() {
  try { const d = await authFetch('/api/friends'); renderFriendRows('friends-incoming-list', d.incoming, 'incoming'); renderFriendRows('friends-outgoing-list', d.outgoing, 'outgoing'); renderFriendRows('friends-list', d.friends, 'friend'); } catch (e) { console.warn('[social]', e.message); }
}
function friendRowHtml(e, kind) {
  const on = e.online ? '<span style="color:#4cff8b;">● online</span>' : '<span style="color:#7a8a99;">○ offline</span>';
  let act = '';
  if (kind === 'incoming') act = `<button class="btn-secondary btn-chip" data-action="accept" data-req="${e.requestId}">✅ Aceitar</button><button class="btn-secondary btn-chip" data-action="decline" data-req="${e.requestId}">❌ Recusar</button>`;
  else if (kind === 'outgoing') act = '<span style="font-size:11px;color:#7fbfd6;">Aguardando resposta...</span>';
  else act = `<button class="btn-secondary btn-chip" data-action="challenge" data-uid="${e.userId}" data-nick="${socialEscapeHtml(e.nickname)}" ${e.online ? '' : 'disabled'}>⚔️ Desafiar</button><button class="btn-secondary btn-chip" data-action="remove" data-uid="${e.userId}">🗑️</button>`;
  return `<div class="friend-row" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.08);"><div style="text-align:left;"><div style="font-weight:600;">${socialEscapeHtml(e.nickname)}</div><div style="font-size:11px;">${on}</div></div><div style="display:flex;gap:6px;">${act}</div></div>`;
}
function renderFriendRows(id, list, kind) { const el = document.getElementById(id); if (!el) return; if (!list || !list.length) { el.innerHTML = '<div style="font-size:12px;color:#7a8a99;">Nada por aqui.</div>'; return; } el.innerHTML = list.map(x => friendRowHtml(x, kind)).join(''); }
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
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.08);"><div style="font-weight:600;">${socialEscapeHtml(u.nickname)}</div>${act}</div>`;
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
  const pd = { name: (document.getElementById('menu-name') || {}).value || 'Piloto', color: (document.getElementById('menu-color-custom') || {}).value || '#00e5ff', planeType: (typeof selectedPlaneType !== 'undefined') ? selectedPlaneType : 'cessna', pilot: (typeof selectedPilotIndex !== 'undefined') ? selectedPilotIndex : 1 };
  const pw = d.password ? (prompt('Senha da sala:') || '') : '';
  if (typeof connectOnline === 'function') connectOnline(d.roomId, pd, pw);
}
function socialOnChallengeResponse(d) { if (typeof showTemporaryMessage === 'function') showTemporaryMessage(d.accepted ? `✅ ${d.byNickname} aceitou o desafio!` : `${d.byNickname} recusou o desafio.`, 2800); }

// ==================== CENTRAL DO PILOTO (tela cheia) ====================
let centralEl = null;
function ensureCentral() {
  if (centralEl) return centralEl;
  centralEl = document.createElement('div');
  centralEl.id = 'pilot-central';
  centralEl.style.cssText = 'position:fixed;inset:0;z-index:950;background:rgba(1,10,25,0.97);overflow-y:auto;display:none;padding:20px 14px 60px;';
  const st = document.createElement('style');
  st.textContent = `
  #pilot-central .pc-wrap{max-width:1080px;margin:0 auto;}
  #pilot-central .pc-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:14px;}
  #pilot-central .pc-title{font-family:var(--font-display,'Rajdhani');font-size:24px;font-weight:800;color:var(--gold,#FEBA02);letter-spacing:1px;}
  #pilot-central .pc-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px;}
  #pilot-central .pc-tab{padding:9px 16px;border:1px solid var(--line,rgba(254,186,2,.35));background:rgba(228,235,253,.05);color:var(--text-mute,#cfe);cursor:pointer;font-family:var(--font-display);font-weight:700;font-size:13px;letter-spacing:.5px;}
  #pilot-central .pc-tab.active{background:linear-gradient(135deg,var(--gold,#FEBA02),#c99000);color:#1a1200;border-color:transparent;}
  #pilot-central .pc-card{background:rgba(1,31,67,.85);border:1px solid var(--line-soft,rgba(254,186,2,.16));border-radius:12px;padding:14px;margin-bottom:12px;}
  #pilot-central .pc-rankrow{display:flex;align-items:center;gap:16px;flex-wrap:wrap;}
  #pilot-central .pc-rankimg{width:86px;height:120px;object-fit:contain;filter:drop-shadow(0 0 12px rgba(254,186,2,.4));}
  #pilot-central .pc-bar{flex:1;min-width:200px;height:12px;background:rgba(255,255,255,.08);border-radius:6px;overflow:hidden;}
  #pilot-central .pc-barfill{height:100%;background:linear-gradient(90deg,#FEBA02,#ff8a00);}
  #pilot-central .pc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;}
  #pilot-central .pc-rank{text-align:center;padding:10px 6px;border-radius:10px;border:1px solid rgba(255,255,255,.07);opacity:.45;}
  #pilot-central .pc-rank.have{opacity:1;border-color:rgba(254,186,2,.5);background:rgba(254,186,2,.07);}
  #pilot-central .pc-rank.now{opacity:1;border-color:#4cff8b;box-shadow:0 0 12px rgba(76,255,139,.35);}
  #pilot-central .pc-rank img{width:56px;height:80px;object-fit:contain;margin:0 auto 6px;}
  #pilot-central .pc-rank .n{font-size:10px;font-weight:700;color:#fff;} #pilot-central .pc-rank .q{font-size:9.5px;color:var(--gold,#FEBA02);}
  #pilot-central .pc-medal{text-align:center;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.07);}
  #pilot-central .pc-medal img{width:52px;height:52px;object-fit:contain;margin:0 3px;opacity:.22;filter:grayscale(1);}
  #pilot-central .pc-medal img.on{opacity:1;filter:none;}
  #pilot-central .pc-medal .n{font-size:11px;font-weight:700;color:var(--gold,#FEBA02);margin-bottom:6px;}
  #pilot-central .pc-medal .r{font-size:9.5px;color:var(--text-mute);margin-top:5px;}
  #pilot-central .pc-row{display:grid;grid-template-columns:44px 40px 1fr auto;gap:10px;align-items:center;padding:8px 4px;border-bottom:1px solid rgba(255,255,255,.06);font-size:13px;}
  #pilot-central .pc-row img{width:34px;height:48px;object-fit:contain;}
  #pilot-central .pc-empty{text-align:center;color:#7a8a99;padding:30px;font-size:13px;}`;
  document.head.appendChild(st);
  document.body.appendChild(centralEl);
  return centralEl;
}
function pcEsc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
async function socialOpenRankingModal() {
  const el = ensureCentral();
  el.style.display = 'block';
  el.innerHTML = '<div class="pc-wrap"><div class="pc-head"><div class="pc-title">🎖️ CENTRAL DO PILOTO</div><button class="btn-secondary btn-danger" id="pc-close">✕ FECHAR</button></div><div class="pc-tabs"><button class="pc-tab active" data-t="rank">🏆 RANKING</button><button class="pc-tab" data-t="pat">🎖️ PATENTES</button><button class="pc-tab" data-t="med">🏅 CONDECORAÇÕES</button><button class="pc-tab" data-t="me">👤 MEU PERFIL</button></div><div id="pc-body"><div class="pc-empty">Carregando...</div></div></div>';
  document.getElementById('pc-close').onclick = () => { el.style.display = 'none'; };
  let tab = 'rank', data = null, me = null;
  el.querySelectorAll('.pc-tab').forEach(b => b.onclick = () => { el.querySelectorAll('.pc-tab').forEach(x => x.classList.toggle('active', x === b)); tab = b.dataset.t; draw(); });
  async function load() {
    try { data = await (await fetch('/api/ranking')).json(); } catch (e) { data = null; }
    if (isLoggedIn()) { try { me = await authFetch('/api/profile/me'); } catch (e) { me = null; } }
    draw();
  }
  function fmtT(s) { const h = Math.floor(s / 3600), m = Math.round(s % 3600 / 60); return h > 0 ? h + 'h ' + m + 'min' : m + ' min'; }
  function draw() {
    const body = document.getElementById('pc-body');
    if (tab === 'rank') {
      if (!data) { body.innerHTML = '<div class="pc-empty">Não deu pra carregar o ranking agora.</div>'; return; }
      const T = [['topKills', '🎯 Maior Abatedor'], ['topBlimps', '🎈 Caçador de Dirigíveis'], ['topPlaytime', '⏱️ Mais Horas Voadas'], ['topWins', '👑 Mais Vitórias'], ['topMvps', '🏆 Mais MVPs']];
      let h = '<div class="pc-card" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;">' + T.map(([k, lb]) => { const r = data.titles && data.titles[k]; return `<div style="text-align:center;"><div style="font-size:11px;color:var(--text-mute);">${lb}</div>${r ? `<div style="color:#4cff8b;font-weight:700;">👑 ${pcEsc(r.nickname)}</div><div style="font-size:11px;color:var(--gold);">${k === 'topPlaytime' ? fmtT(r.value) : r.value}</div>` : '<div style="color:#7a8a99;">—</div>'}</div>`; }).join('') + '</div>';
      const L = (data.leaderboard || []).slice(0, 20);
      h += '<div class="pc-card">' + (L.length ? L.map((p, i) => { const rk = RANKS.find(x => x.k === p.rankKey) || RANKS[0]; return `<div class="pc-row"><span style="font-weight:800;color:${i < 3 ? ['#FEBA02', '#cdd6e0', '#cd7f32'][i] : 'var(--text-mute)'};">${i < 3 ? ['🥇', '🥈', ''][i] : (i + 1) + 'º'}</span><img src="img/${rk.img}" onerror="this.style.visibility='hidden'"><span style="font-weight:700;">${pcEsc(p.nickname)}<div style="font-size:10px;color:var(--text-mute);font-weight:500;">${rk.n}</div></span><span style="color:var(--text-mute);font-size:11.5px;text-align:right;">⚔${p.kills} 💀${p.deaths} 🎈${p.blimp_kills}<br>${fmtT(p.playtime_seconds)}</span></div>`; }).join('') : '<div class="pc-empty">Ninguém jogou logado ainda — seja o primeiro!</div>') + '</div>';
      body.innerHTML = h;
    } else if (tab === 'pat') {
      const cur = me ? me.rank.index : -1;
      body.innerHTML = '<div class="pc-card"><div class="pc-grid">' + RANKS.map((r, i) => `<div class="pc-rank ${i === cur ? 'now' : (i < cur ? 'have' : '')}"><img src="img/${r.img}" onerror="this.style.opacity=.2"><div class="n">${r.n}</div><div class="q">${r.q} abates</div></div>`).join('') + '</div></div>';
    } else if (tab === 'med') {
      const owned = {}; (me ? me.medals : []).forEach(m => owned[m.medal_key] = m.level);
      let h = '<div class="pc-card"><div class="pc-grid">' + MEDALS.map(([k, n, r]) => { const lv = owned[k] || 0; return `<div class="pc-medal"><div class="n">${n}</div>${[0, 1, 2].map(i => `<img class="${lv >= i + 1 ? 'on' : ''}" src="img/${k.replace(/_/g, '-')}-${LVL[i]}.png" title="${LVL[i]}" onerror="this.style.opacity=${lv >= i + 1 ? 1 : .15}">`).join('')}<div class="r">${r}</div></div>`; }).join('') + '</div></div>';
      h += '<div class="pc-card"><div style="font-size:12px;color:#c99bff;font-weight:700;margin-bottom:10px;">🔒 CONDECORAÇÕES SECRETAS</div><div class="pc-grid">' + SECRETS.map(([k, n, r]) => { const has = owned[k]; return `<div class="pc-medal" style="${has ? 'border-color:#c99bff;' : ''}"><div class="n" style="color:#c99bff;">${has ? n : '???'}</div><img class="${has ? 'on' : ''}" src="img/${k.replace(/_/g, '-')}.png" onerror="this.style.opacity=.15"><div class="r">${has ? r : 'Continue jogando para descobrir...'}</div></div>`; }).join('') + '</div></div>';
      body.innerHTML = h;
    } else {
      if (!me) { body.innerHTML = '<div class="pc-empty">🔑 Faça login para ver sua carreira militar.<br>Sem conta, o jogo funciona 100% — mas abates, patentes e medalhas só contam para quem está logado.</div>'; return; }
      const rk = me.rank; const next = rk.next;
      const pct = next ? Math.min(100, Math.round(((rk.current - rk.at0 !== undefined ? rk.current : rk.current) / next.at) * 100)) : 100;
      body.innerHTML = `<div class="pc-card"><div class="pc-rankrow"><img class="pc-rankimg" src="img/${rk.img}" onerror="this.style.opacity=.2"><div style="flex:1;min-width:220px;"><div style="font-size:18px;font-weight:800;color:var(--gold);">${rk.name}</div><div style="font-size:12px;color:var(--text-mute);margin:4px 0 8px;">⚔ ${rk.current} abates ${next ? `· faltam ${next.at - rk.current} para ${next.name}` : '· patente máxima alcançada!'}</div><div class="pc-bar"><div class="pc-barfill" style="width:${next ? Math.min(100, (rk.current / next.at) * 100) : 100}%"></div></div></div></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-top:14px;text-align:center;font-size:12px;">
      <div>🛫 Partidas<br><b>${me.stats.matches_played}</b></div><div>⚔ Abates<br><b>${me.stats.kills}</b></div><div>💀 Mortes<br><b>${me.stats.deaths}</b></div><div>🎈 Dirigíveis<br><b>${me.stats.blimp_kills}</b></div><div>👑 Vitórias<br><b>${me.stats.wins}</b></div><div>🏆 MVPs<br><b>${me.stats.mvps}</b></div><div>⏱ Tempo de voo<br><b>${fmtT(me.stats.playtime_seconds)}</b></div><div>📅 Dias de login<br><b>${me.stats.login_days}</b></div></div></div>`;
    }
  }
  load();
}

// ==================== TIRO PERFEITO (cliente reporta) ====================
(function () {
  let streak = 0, pendingShot = false, pendingTimer = null;
  const origPlay = window.playSound;
  function wrap() {
    const real = window.playSound;
    if (!real || real.__tpWrapped) return;
    const wrapped = function (name, ...rest) {
      try {
        if (name === 'shot') { pendingShot = true; clearTimeout(pendingTimer); pendingTimer = setTimeout(() => { pendingShot = false; streak = 0; }, 2000); }
        else if (name === 'hit_confirm') { if (pendingShot || streak > 0) { streak++; pendingShot = false; clearTimeout(pendingTimer); } else streak = 1; if (streak >= 20 && isLoggedIn() && onlineState.socket) { onlineState.socket.emit('report-medal', 'tiro_perfeito'); streak = 0; } }
      } catch (e) {}
      return real.apply(this, [name, ...rest]);
    };
    wrapped.__tpWrapped = true;
    window.playSound = wrapped;
  }
  if (origPlay) wrap(); else document.addEventListener('DOMContentLoaded', wrap);
})();

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  const bf = document.getElementById('btn-friends'), lbf = document.getElementById('lobby-btn-friends'), br = document.getElementById('btn-ranking'), cf = document.getElementById('modal-friends-close'), cr = document.getElementById('modal-ranking-close'), sb = document.getElementById('friends-search-btn'), si = document.getElementById('friends-search-input');
  if (bf) bf.addEventListener('click', socialOpenFriendsModal);
  if (lbf) lbf.addEventListener('click', socialOpenFriendsModal);
  if (br) br.addEventListener('click', socialOpenRankingModal);
  if (cf) cf.addEventListener('click', socialCloseFriendsModal);
  if (cr) cr.addEventListener('click', socialOpenRankingModal && (() => document.getElementById('modal-ranking')?.classList.add('hidden')));
  if (sb) sb.addEventListener('click', socialDoFriendSearch);
  if (si) si.addEventListener('keypress', (e) => { if (e.key === 'Enter') socialDoFriendSearch(); });
});