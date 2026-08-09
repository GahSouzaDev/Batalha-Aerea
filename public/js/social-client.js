// social-client.js — perfil/amigos + CENTRAL DO PILOTO (texto claro, títulos escolhíveis, fotos no ranking)
// ATUALIZAÇÃO: títulos agora aparecem também na busca/lista de amigos
// (cada entrada vem com `titles` do servidor — ver friends.js), e a
// aba "Meu Perfil" ganhou um botão "🔄 Recalcular Medalhas" que chama
// /api/profile/recompute-medals — útil se alguma medalha que você já
// deveria ter (estatística já bateu o valor exigido) não apareceu
// sozinha ainda.
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
const MEDAL_NAMES = {
  veterano_dos_ceus: 'Veterano dos Céus', as_dos_ceus: 'Ás dos Céus', mestre_da_sobrevivencia: 'Mestre da Sobrevivência',
  fantasma_dos_ceus: 'Fantasma dos Céus', abatedor_de_dirigiveis: 'Abatedor de Dirigíveis', bombardeiro_de_elite: 'Bombardeiro de Elite',
  mestre_dos_misseis: 'Mestre dos Mísseis', heroi_da_esquadrilha: 'Herói da Esquadrilha', conquistador_dos_ceus: 'Conquistador dos Céus',
  piloto_veterano: 'Piloto Veterano', implacavel: 'Implacável', blindagem_viva: 'Blindagem Viva', ultimo_no_ceu: 'Último no Céu',
  primeiro_ataque: 'Primeiro Ataque', piloto_dedicado: 'Piloto Dedicado', orgulho_da_esquadrilha: 'Orgulho da Esquadrilha',
  fenix: 'Fênix', kamikaze: 'Kamikaze', tiro_perfeito: 'Tiro Perfeito', cacador_relampago: 'Caçador Relâmpago',
  dominio_aereo: 'Domínio Aéreo', lenda_da_batalha_aerea: 'Lenda da Batalha Aérea',
};
const LVLN = { 1: 'bronze', 2: 'prata', 3: 'ouro' };
const socialState = { stats: null };

// NOVO — badges de título (até 3) reaproveitados em qualquer lista de
// jogador (amigos, busca de amigos). `titles` = [{key, level}, ...].
function socialTitleBadgesHtml(titles) {
  if (!titles || !titles.length) return '';
  return titles.map(t => {
    const lvl = LVLN[t.level] || 'bronze';
    const img = 'img/' + String(t.key).replace(/_/g, '-') + '-' + lvl + '.png';
    const label = MEDAL_NAMES[t.key] || t.key;
    return '<img src="' + img + '" title="' + label + '" style="width:16px;height:16px;object-fit:contain;vertical-align:middle;margin-right:3px;filter:drop-shadow(0 0 3px rgba(254,186,2,.6));" onerror="this.style.display=\'none\'">';
  }).join('');
}

// ==================== PERFIL ====================
async function socialOnLogin() {
  const g = document.getElementById('friends-guest-notice'), l = document.getElementById('friends-logged-area'), pb = document.getElementById('profile-photo-block');
  if (g) g.classList.add('hidden'); if (l) l.classList.remove('hidden'); if (pb) pb.classList.remove('hidden');
  try {
    const d = await authFetch('/api/profile/me');
    applyProfileToUI(d.profile);
    socialState.stats = d.stats;
  } catch (e) { console.warn('[social]', e.message); }
}
function applyProfileToUI(profile) {
  if (!profile) return;
  if (typeof setGameSoundMuted === 'function') setGameSoundMuted(!profile.soundEnabled);
  if (profile.preferredPlane && typeof PLANE_ORDER !== 'undefined' && typeof selectCarouselIndex === 'function') {
    const i = PLANE_ORDER.indexOf(profile.preferredPlane); if (i >= 0) selectCarouselIndex('menu', 'menu', i);
  }
  // 1) Se a conta tem foto própria, disponibiliza o slot "piloto 16"
  if (profile.photoUrl && typeof setCustomPilotPhoto === 'function') {
    setCustomPilotPhoto(profile.photoUrl, false);
  }
  // 2) restaura o piloto SALVO NA CONTA (1..15, ou 16 = sua foto).
  const pp = profile.preferredPilot;
  if (pp && typeof selectPilotIndex === 'function') {
    if (pp === 16) {
      if (profile.photoUrl && typeof setCustomPilotPhoto === 'function') setCustomPilotPhoto(profile.photoUrl, true);
    } else {
      selectPilotIndex(pp);
    }
  }
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
  // persiste o piloto escolhido na conta (intercepta a função global do ui-menu.js)
  if (typeof window.selectPilotIndex === 'function' && !window.__pilotHooked) {
    window.__pilotHooked = true;
    const base = window.selectPilotIndex;
    window.selectPilotIndex = function (i) { base(i); socialSaveSettings({ preferredPilot: window.selectedPilotIndex }); };
  }
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
  return `<div class="friend-row" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.08);"><div style="text-align:left;"><div style="font-weight:600;color:#E4EBFD;">${socialTitleBadgesHtml(e.titles)}${socialEscapeHtml(e.nickname)}</div><div style="font-size:11px;">${on}</div></div><div style="display:flex;gap:6px;">${act}</div></div>`;
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
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.08);"><div style="font-weight:600;color:#E4EBFD;">${socialTitleBadgesHtml(u.titles)}${socialEscapeHtml(u.nickname)}</div>${act}</div>`;
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

// ==================== CENTRAL DO PILOTO (tela cheia, texto CLARO) ====================
let centralEl = null;
function ensureCentral() {
  if (centralEl) return centralEl;
  centralEl = document.createElement('div');
  centralEl.id = 'pilot-central';
  centralEl.style.cssText = 'position:fixed;inset:0;z-index:950;background:rgba(1,10,25,0.97);overflow-y:auto;display:none;padding:20px 14px 60px;color:#E4EBFD;';
  const st = document.createElement('style');
  st.textContent = `
  #pilot-central, #pilot-central *{box-sizing:border-box}
  #pilot-central .pc-wrap{max-width:1080px;margin:0 auto;}
  #pilot-central .pc-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:14px;}
  #pilot-central .pc-title{font-family:var(--font-display,'Rajdhani');font-size:24px;font-weight:800;color:var(--gold,#FEBA02);letter-spacing:1px;}
  #pilot-central .pc-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px;}
  #pilot-central .pc-tab{padding:9px 16px;border:1px solid var(--line,rgba(254,186,2,.35));background:rgba(228,235,253,.05);color:#cfe6ff;cursor:pointer;font-family:var(--font-display);font-weight:700;font-size:13px;letter-spacing:.5px;}
  #pilot-central .pc-tab.active{background:linear-gradient(135deg,var(--gold,#FEBA02),#c99000);color:#1a1200;border-color:transparent;}
  #pilot-central .pc-card{background:rgba(1,31,67,.85);border:1px solid var(--line-soft,rgba(254,186,2,.16));border-radius:12px;padding:14px;margin-bottom:12px;color:#E4EBFD;}
  #pilot-central .pc-sub{font-weight:800;color:var(--gold,#FEBA02);font-size:13px;letter-spacing:.5px;margin-bottom:10px;}
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
  #pilot-central .pc-medal .r{font-size:9.5px;color:#b9c8dd;margin-top:5px;}
  #pilot-central .pc-row{display:grid;grid-template-columns:44px 40px 1fr auto;gap:10px;align-items:center;padding:8px 4px;border-bottom:1px solid rgba(255,255,255,.06);font-size:13px;color:#E4EBFD;}
  #pilot-central .pc-row img.ri{width:34px;height:48px;object-fit:contain;}
  #pilot-central .pc-who{display:flex;align-items:center;gap:8px;min-width:0;}
  #pilot-central .pc-photo{width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid rgba(254,186,2,.45);flex-shrink:0;background:rgba(228,235,253,.08);}
  #pilot-central .pc-ini{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;color:#00131a;flex-shrink:0;}
  #pilot-central .pc-timg{width:20px;height:20px;object-fit:contain;filter:drop-shadow(0 0 4px rgba(254,186,2,.6));flex-shrink:0;}
  #pilot-central .pc-nk{font-weight:700;color:#fff;min-width:0;} #pilot-central .pc-nk small{display:block;font-size:10px;color:#b9c8dd;font-weight:500;}
  #pilot-central .pc-st{color:#b9c8dd;font-size:11.5px;text-align:right;}
  #pilot-central .pc-empty{text-align:center;color:#7a8a99;padding:30px;font-size:13px;}
  #pilot-central .pc-chips{display:flex;flex-wrap:wrap;gap:8px;}
  #pilot-central .pc-chip{display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.15);background:rgba(228,235,253,.05);color:#E4EBFD;cursor:pointer;font-size:11px;font-weight:700;transition:.15s;}
  #pilot-central .pc-chip img{width:26px;height:26px;object-fit:contain;}
  #pilot-central .pc-chip.on{border-color:#4cff8b;background:rgba(76,255,139,.15);box-shadow:0 0 10px rgba(76,255,139,.35);}
  #pilot-central .pc-btn{margin-top:12px;padding:10px 22px;border:none;border-radius:8px;background:linear-gradient(135deg,#FEBA02,#c99000);color:#1a1200;font-weight:800;font-family:var(--font-display);cursor:pointer;}
  #pilot-central .pc-btn.secondary{background:rgba(228,235,253,.08);color:#E4EBFD;border:1px solid rgba(254,186,2,.35);}
  #pilot-central .pc-me-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;}
  #pilot-central .pc-avatar{width:64px;height:64px;border-radius:50%;object-fit:cover;border:3px solid var(--gold,#FEBA02);}
  #pilot-central .pc-me-name{font-size:18px;font-weight:800;color:#fff;} #pilot-central .pc-me-rank{font-size:12px;color:var(--gold,#FEBA02);}
  #pilot-central .pc-statgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;text-align:center;font-size:12px;color:#b9c8dd;margin-top:14px;}
  #pilot-central .pc-statgrid b{color:#fff;display:block;font-size:15px;}`;
  document.head.appendChild(st);
  document.body.appendChild(centralEl);
  return centralEl;
}
function pcEsc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
function pcFmtT(s) { const h = Math.floor(s / 3600), m = Math.round(s % 3600 / 60); return h > 0 ? h + 'h ' + m + 'min' : m + ' min'; }
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
  function photoHtml(p, size) {
    if (p.photoUrl) return `<img class="pc-photo" style="width:${size}px;height:${size}px" src="${p.photoUrl}" onerror="this.outerHTML='<span class=&quot;pc-ini&quot; style=&quot;background:#FEBA02;width:${size}px;height:${size}px&quot;>${pcEsc((p.nickname || '?')[0].toUpperCase())}</span>'">`;
    return `<span class="pc-ini" style="background:#0583F2;width:${size}px;height:${size}px">${pcEsc((p.nickname || '?')[0].toUpperCase())}</span>`;
  }
  function titlesHtml(list, cls) { return (list || []).map(t => `<img class="${cls}" src="img/${t.key.replace(/_/g, '-')}-${LVLN[t.level] || 'bronze'}.png" title="${pcEsc(MEDAL_NAMES[t.key] || t.key)}" onerror="this.style.display='none'">`).join(''); }
  function draw() {
    const body = document.getElementById('pc-body');
    if (tab === 'rank') {
      if (!data) { body.innerHTML = '<div class="pc-empty">Não deu pra carregar o ranking agora.</div>'; return; }
      const T = [['topKills', '🎯', 'Maior Abatedor'], ['topBlimps', '🎈', 'Caçador de Dirigíveis'], ['topPlaytime', '⏱️', 'Mais Horas Voadas'], ['topWins', '👑', 'Mais Vitórias'], ['topMvps', '🏆', 'Mais MVPs']];
      let h = '<div class="pc-card" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;text-align:center;">' + T.map(([k, lb]) => { const r = data.titles && data.titles[k]; return `<div><div style="font-size:11px;color:#b9c8dd;">${lb}</div>${r ? `<div style="color:#4cff8b;font-weight:700;">👑 ${pcEsc(r.nickname)}</div><div style="font-size:11px;color:var(--gold);">${k === 'topPlaytime' ? pcFmtT(r.value) : r.value}</div>` : '<div style="color:#7a8a99;">—</div>'}</div>`; }).join('') + '</div>';
      const L = (data.leaderboard || []).slice(0, 20);
      h += '<div class="pc-card">' + (L.length ? L.map((p, i) => {
        const rk = RANKS.find(x => x.k === p.rankKey) || RANKS[0];
        return `<div class="pc-row"><span style="font-weight:800;color:${i < 3 ? ['#FEBA02', '#cdd6e0', '#cd7f32'][i] : '#b9c8dd'};">${i < 3 ? ['🥇', '🥈', '🥉'][i] : (i + 1) + 'º'}</span><img class="ri" src="img/${rk.img}" onerror="this.style.visibility='hidden'"><span class="pc-who">${titlesHtml(p.titles, 'pc-timg')}${photoHtml(p, 34)}<span class="pc-nk">${pcEsc(p.nickname)}<small>${rk.n}</small></span></span><span class="pc-st">⚔${p.kills} 💀${p.deaths} 🎈${p.blimp_kills}<br>${pcFmtT(p.playtime_seconds)}</span></div>`;
      }).join('') : '<div class="pc-empty">Ninguém jogou em sala criada ainda — seja o primeiro!</div>') + '</div>';
      body.innerHTML = h;
    } else if (tab === 'pat') {
      const cur = me ? me.rank.index : -1;
      body.innerHTML = '<div class="pc-card"><div class="pc-grid">' + RANKS.map((r, i) => `<div class="pc-rank ${i === cur ? 'now' : (i < cur ? 'have' : '')}"><img src="img/${r.img}" onerror="this.style.opacity=.2"><div class="n">${r.n}</div><div class="q">${r.q} abates</div></div>`).join('') + '</div></div>';
    } else if (tab === 'med') {
      const owned = {}; (me ? me.medals : []).forEach(m => owned[m.medal_key] = m.level);
      let h = '<div class="pc-card"><div class="pc-sub">🏅 CONDECORAÇÕES (Bronze / Prata / Ouro)</div><div class="pc-grid">' + Object.keys(MEDAL_NAMES).filter(k => !['fenix', 'kamikaze', 'tiro_perfeito', 'cacador_relampago', 'dominio_aereo', 'lenda_da_batalha_aerea'].includes(k)).map(k => { const lv = owned[k] || 0; return `<div class="pc-medal"><div class="n">${MEDAL_NAMES[k]}</div>${[1, 2, 3].map(i => `<img class="${lv >= i ? 'on' : ''}" src="img/${k.replace(/_/g, '-')}-${LVLN[i]}.png" onerror="this.style.opacity=${lv >= i ? 1 : .15}">`).join('')}<div class="r">${lv ? 'Nível: ' + LVLN[lv].toUpperCase() : 'Não conquistada'}</div></div>`; }).join('') + '</div></div>';
      h += '<div class="pc-card"><div class="pc-sub" style="color:#c99bff;">🔒 SECRETAS</div><div class="pc-grid">' + ['fenix', 'kamikaze', 'tiro_perfeito', 'cacador_relampago', 'dominio_aereo', 'lenda_da_batalha_aerea'].map(k => { const has = owned[k]; return `<div class="pc-medal" style="${has ? 'border-color:#c99bff;' : ''}"><div class="n" style="color:#c99bff;">${has ? MEDAL_NAMES[k] : '???'}</div><img class="${has ? 'on' : ''}" src="img/${k.replace(/_/g, '-')}.png" onerror="this.style.opacity=.15"><div class="r">${has ? 'Conquistada!' : 'Continue jogando para descobrir...'}</div></div>`; }).join('') + '</div></div>';
      body.innerHTML = h;
    } else {
      if (!me) { body.innerHTML = '<div class="pc-empty">🔑 Faça login para ver sua carreira militar.<br>Sem conta, o jogo funciona 100% — mas abates, patentes e medalhas só contam em SALA CRIADA, e só pra quem está logado.</div>'; return; }
      const rk = me.rank;
      const owned = me.medals.filter(m => m.level > 0);
      let sel = (me.profile.selectedTitles || []).slice(0, 3);
      function drawMe() {
        const avatar = me.profile.photoUrl || ('img/piloto' + (me.profile.preferredPilot || 1) + '.png');
        body.innerHTML = `<div class="pc-card"><div class="pc-me-row"><img class="pc-avatar" src="${avatar}" onerror="this.style.opacity=.3"><span style="display:flex;gap:4px;align-items:center;">${titlesHtml(sel.map(k => { const m = owned.find(x => x.medal_key === k); return m ? { key: k, level: m.level } : null; }).filter(Boolean), 'pc-timg')}</span><div><div class="pc-me-name">${pcEsc((typeof authState !== 'undefined' && authState.user) ? authState.user.nickname : 'Piloto')}</div><div class="pc-me-rank">🎖️ ${rk.name}${rk.next ? ` · faltam ${rk.next.at - rk.current} abates p/ ${rk.next.name}` : ' · patente máxima!'}</div></div></div>
        <div class="pc-bar" style="width:100%"><div class="pc-barfill" style="width:${rk.next ? Math.min(100, (rk.current / rk.next.at) * 100) : 100}%"></div></div>
        <div class="pc-statgrid"><div>🛫 Partidas<b>${me.stats.matches_played}</b></div><div>⚔ Abates<b>${me.stats.kills}</b></div><div>💀 Mortes<b>${me.stats.deaths}</b></div><div>🎈 Dirigíveis<b>${me.stats.blimp_kills}</b></div><div>👑 Vitórias<b>${me.stats.wins}</b></div><div>🏆 MVPs<b>${me.stats.mvps}</b></div><div>⏱ Voo<b>${pcFmtT(me.stats.playtime_seconds)}</b></div><div>📅 Logins<b>${me.stats.login_days}</b></div></div>
        <div style="margin-top:12px;font-size:11px;color:#b9c8dd;">📌 Só conta o que é jogado em <b>sala criada</b> (Todos Contra Todos / Esquadrões) — treino com bots e Sala Livre não somam pra sua carreira.</div>
        <button class="pc-btn secondary" id="pc-recompute-btn" style="margin-top:10px;">🔄 Recalcular Medalhas</button>
        </div>
        <div class="pc-card"><div class="pc-sub">🎖️ TÍTULOS EXIBIDOS — escolha até 3 (aparecem ao lado da sua foto no ranking, no lobby e na lista de amigos)</div>
        ${owned.length ? '<div class="pc-chips" id="pc-chips">' + owned.map(m => `<button class="pc-chip ${sel.includes(m.medal_key) ? 'on' : ''}" data-k="${m.medal_key}"><img src="img/${m.medal_key.replace(/_/g, '-')}-${LVLN[m.level]}.png" onerror="this.style.display='none'"><span>${MEDAL_NAMES[m.medal_key] || m.medal_key} (${LVLN[m.level]})</span></button>`).join('') + '</div><button class="pc-btn" id="pc-save-titles">💾 SALVAR TÍTULOS</button><div style="font-size:11px;color:#b9c8dd;margin-top:8px;">Selecionados: ' + sel.length + '/3</div>' : '<div class="pc-empty">Você ainda não conquistou nenhuma condecoração. Jogue em sala criada pra começar a desbloquear.</div>'}</div>`;
        const chips = document.getElementById('pc-chips');
        if (chips) chips.querySelectorAll('.pc-chip').forEach(c => c.onclick = () => {
          const k = c.dataset.k;
          if (sel.includes(k)) sel = sel.filter(x => x !== k);
          else { if (sel.length >= 3) { if (typeof showTemporaryMessage === 'function') showTemporaryMessage('⚠️ Máximo de 3 títulos!', 1800); return; } sel.push(k); }
          drawMe();
        });
        const sv = document.getElementById('pc-save-titles');
        if (sv) sv.onclick = async () => {
          try { await authFetch('/api/profile/settings', { method: 'POST', body: JSON.stringify({ selectedTitles: sel }) }); me.profile.selectedTitles = sel; if (typeof showTemporaryMessage === 'function') showTemporaryMessage('✅ Títulos salvos!', 1800); drawMe(); } catch (e) { if (typeof showTemporaryMessage === 'function') showTemporaryMessage('❌ ' + e.message, 2200); }
        };
        const rc = document.getElementById('pc-recompute-btn');
        if (rc) rc.onclick = async () => {
          rc.disabled = true; rc.textContent = 'Recalculando...';
          try {
            await authFetch('/api/profile/recompute-medals', { method: 'POST' });
            me = await authFetch('/api/profile/me');
            owned.length = 0; owned.push(...me.medals.filter(m => m.level > 0));
            sel = (me.profile.selectedTitles || []).slice(0, 3);
            if (typeof showTemporaryMessage === 'function') showTemporaryMessage('✅ Medalhas recalculadas!', 2000);
            drawMe();
          } catch (e) {
            if (typeof showTemporaryMessage === 'function') showTemporaryMessage('❌ ' + e.message, 2200);
            rc.disabled = false; rc.textContent = '🔄 Recalcular Medalhas';
          }
        };
      }
      drawMe();
    }
  }
  load();
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
        else if (name === 'hit_confirm') { if (pendingShot || streak > 0) { streak++; pendingShot = false; clearTimeout(pendingTimer); } else streak = 1; if (streak >= 20 && isLoggedIn() && onlineState.socket) { onlineState.socket.emit('report-medal', 'tiro_perfeito'); streak = 0; } }
      } catch (e) {}
      return real.apply(this, [name, ...rest]);
    };
    wrapped.__tpWrapped = true;
    window.playSound = wrapped;
  }
  if (window.playSound) wrap(); else document.addEventListener('DOMContentLoaded', wrap);
})();

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  const bf = document.getElementById('btn-friends'), lbf = document.getElementById('lobby-btn-friends'), br = document.getElementById('btn-ranking'), cf = document.getElementById('modal-friends-close'), cr = document.getElementById('modal-ranking-close'), sb = document.getElementById('friends-search-btn'), si = document.getElementById('friends-search-input');
  if (bf) bf.addEventListener('click', socialOpenFriendsModal);
  if (lbf) lbf.addEventListener('click', socialOpenFriendsModal);
  if (br) br.addEventListener('click', socialOpenRankingModal);
  if (cf) cf.addEventListener('click', socialCloseFriendsModal);
  if (cr) cr.addEventListener('click', () => document.getElementById('modal-ranking')?.classList.add('hidden'));
  if (sb) sb.addEventListener('click', socialDoFriendSearch);
  if (si) si.addEventListener('keypress', (e) => { if (e.key === 'Enter') socialDoFriendSearch(); });
});