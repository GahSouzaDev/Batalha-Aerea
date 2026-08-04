// loading-screen.js
let loadingOverlayEl = null;
let loadingBarEl = null;
let loadingLabelEl = null;
let loadingActive = false;
let loadingOnDoneCb = null;
let loadingShownAt = 0;
const LOADING_MIN_DURATION = 700;
const LOADING_MAX_DURATION = 12000;
let loadingSafetyTimer = null;

let loadingIdentityStyled = false;
function ensureLoadingIdentityStyle() {
  if (loadingIdentityStyled) return;
  loadingIdentityStyled = true;
  const st = document.createElement('style');
  st.id = 'loading-identity-style';
  st.textContent = `
#loading-identity{opacity:0;transform:translateY(14px);transition:opacity .5s ease, transform .5s ease;margin-top:18px;padding-top:16px;border-top:1px solid rgba(255,255,255,.12);}
#loading-identity.show{opacity:1;transform:none;}
#loading-identity .li-row{display:flex;align-items:center;gap:12px;justify-content:center;}
#loading-identity .li-photo-wrap{position:relative;flex-shrink:0;}
#loading-identity .li-photo{width:58px;height:58px;border-radius:50%;object-fit:cover;border:3px solid var(--gold,#FEBA02);box-shadow:0 0 18px rgba(254,186,2,.5);}
#loading-identity .li-rank-badge{position:absolute;bottom:-4px;right:-6px;width:24px;height:32px;object-fit:contain;filter:drop-shadow(0 2px 6px rgba(0,0,0,.7));}
#loading-identity .li-info{text-align:left;min-width:0;}
#loading-identity .li-name{font-family:var(--font-display,'Orbitron');font-weight:800;font-size:16px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;}
#loading-identity .li-rank-name{font-size:11.5px;color:var(--gold,#FEBA02);font-weight:700;white-space:nowrap;}
#loading-identity .li-titles{display:flex;gap:6px;justify-content:center;margin-top:12px;}
#loading-identity .li-title-slot{width:34px;height:34px;border-radius:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;}
#loading-identity .li-title-slot img{width:26px;height:26px;object-fit:contain;filter:drop-shadow(0 0 4px rgba(254,186,2,.6));}
#loading-identity .li-guest{font-size:11px;color:#8aa;margin-top:8px;}`;
  document.head.appendChild(st);
}

function ensureLoadingDom() {
  if (loadingOverlayEl) return;
  loadingOverlayEl = document.createElement('div');
  loadingOverlayEl.id = 'loading-overlay';
  loadingOverlayEl.className = 'overlay hidden';
  loadingOverlayEl.innerHTML = `
    <div class="overlay-card" style="max-width:400px; text-align:center;">
      <!-- LOGO GRANDE NO CENTRO -->
      <img src="img/logo.png" alt="Logo do jogo" style="max-width:80%; height:auto; display:block; margin:0 auto 12px auto; filter: drop-shadow(0 0 20px rgba(0,229,255,0.3));">
      <div class="overlay-title" style="font-size:18px;">🛬 Carregando a partida...</div>
      <div class="overlay-sub" id="loading-label">Preparando aviões e cenário</div>
      <div class="bar-track" style="height:10px;margin-top:10px;"><div class="bar-fill" id="loading-bar" style="width:0%;"></div></div>
      <!-- PEDIDO: cartão de identidade estilo "tela de partida encontrada"
           (foto, nome, patente/elo e até 3 títulos lado a lado) — só
           aparece depois de buscar os dados (ver populateLoadingIdentity). -->
      <div id="loading-identity"></div>
    </div>
  `;
  document.body.appendChild(loadingOverlayEl);
  loadingBarEl = document.getElementById('loading-bar');
  loadingLabelEl = document.getElementById('loading-label');
  ensureLoadingIdentityStyle();
}

// PEDIDO: preenche o cartão de identidade com foto/nome/patente/títulos
// reais do jogador logado (via /api/profile/me, já usado em
// social-client.js). Sem login, mostra um cartão simples com o avatar de
// piloto escolhido — o jogo continua 100% funcional sem conta, só sem os
// dados de carreira militar.
async function populateLoadingIdentity() {
  const box = document.getElementById('loading-identity');
  if (!box) return;
  box.classList.remove('show');
  const LVLN_L = { 1: 'bronze', 2: 'prata', 3: 'ouro' };
  const RANKS_L = (typeof RANKS_CLIENT !== 'undefined') ? RANKS_CLIENT : null;
  const fallbackName = (document.getElementById('menu-name') || {}).value || 'Piloto';
  const guestAvatar = (typeof pilotImagePath === 'function' && typeof selectedPilotIndex !== 'undefined')
    ? pilotImagePath(selectedPilotIndex) : 'img/piloto1.png';

  let me = null;
  if (typeof isLoggedIn === 'function' && isLoggedIn()) {
    try { me = await authFetch('/api/profile/me'); } catch (e) { me = null; }
  }

  if (!me) {
    box.innerHTML = `<div class="li-row"><div class="li-photo-wrap"><img class="li-photo" src="${guestAvatar}" onerror="this.style.opacity=.3"></div><div class="li-info"><div class="li-name">${fallbackName}</div><div class="li-guest">🔓 Sem login — jogue logado pra ter patente e títulos</div></div></div>`;
    requestAnimationFrame(() => box.classList.add('show'));
    return;
  }

  const rk = RANKS_L ? (RANKS_L.find(x => x.k === me.rank.key) || RANKS_L[0]) : null;
  const avatar = me.profile.photoUrl || guestAvatar;
  const nickname = (typeof authState !== 'undefined' && authState.user) ? authState.user.nickname : fallbackName;
  const owned = {};
  (me.medals || []).forEach(m => { if (m.level > 0) owned[String(m.medal_key).replace(/_/g, '-')] = m.level; });
  const sel = (me.profile.selectedTitles || []).map(k => String(k).replace(/_/g, '-')).filter(k => owned[k]).slice(0, 3);
  const slots = [0, 1, 2].map(i => {
    const k = sel[i];
    if (!k) return '<div class="li-title-slot"></div>';
    return `<div class="li-title-slot"><img src="img/${k}-${LVLN_L[owned[k]] || 'bronze'}.png" title="${k}" onerror="this.parentElement.style.display='none'"></div>`;
  }).join('');

  box.innerHTML = `<div class="li-row"><div class="li-photo-wrap"><img class="li-photo" src="${avatar}" onerror="this.style.opacity=.3">${rk ? `<img class="li-rank-badge" src="img/${rk.img}" onerror="this.style.display='none'">` : ''}</div><div class="li-info"><div class="li-name">${nickname}</div><div class="li-rank-name">🎖️ ${rk ? rk.n : ''}${me.rank.next ? ` · ${me.rank.next.at - me.rank.current} p/ ${me.rank.next.name}` : ''}</div></div></div><div class="li-titles">${slots}</div>`;
  requestAnimationFrame(() => box.classList.add('show'));
}

function showLoadingScreen(onDone) {
  ensureLoadingDom();
  loadingActive = true;
  loadingOnDoneCb = onDone || null;
  loadingShownAt = performance.now();
  loadingOverlayEl.classList.remove('hidden');
  loadingBarEl.style.width = '5%';
  loadingLabelEl.textContent = 'Preparando aviões e cenário...';
  populateLoadingIdentity(); // PEDIDO: foto + nome + patente + títulos, estilo tela de partida encontrada

  if (loadingSafetyTimer) clearTimeout(loadingSafetyTimer);
  loadingSafetyTimer = setTimeout(() => finishLoading(), LOADING_MAX_DURATION);
}

function finishLoading() {
  if (!loadingActive) return;
  const elapsed = performance.now() - loadingShownAt;
  const wait = Math.max(0, LOADING_MIN_DURATION - elapsed);
  setTimeout(() => {
    loadingActive = false;
    if (loadingOverlayEl) loadingOverlayEl.classList.add('hidden');
    if (loadingSafetyTimer) { clearTimeout(loadingSafetyTimer); loadingSafetyTimer = null; }
    if (loadingOnDoneCb) { const cb = loadingOnDoneCb; loadingOnDoneCb = null; cb(); }
  }, wait);
}

function hideLoadingScreen() {
  if (loadingOverlayEl) loadingOverlayEl.classList.add('hidden');
  loadingActive = false;
  if (loadingSafetyTimer) { clearTimeout(loadingSafetyTimer); loadingSafetyTimer = null; }
}

assetLoadingManager.onStart = (url, loaded, total) => {
  if (!loadingActive) return;
  ensureLoadingDom();
  loadingBarEl.style.width = Math.round((loaded / total) * 100) + '%';
};
assetLoadingManager.onProgress = (url, loaded, total) => {
  if (!loadingActive) return;
  ensureLoadingDom();
  const pct = total > 0 ? Math.round((loaded / total) * 100) : 100;
  loadingBarEl.style.width = pct + '%';
  loadingLabelEl.textContent = 'Carregando recursos... ' + loaded + '/' + total;
};
assetLoadingManager.onLoad = () => {
  if (!loadingActive) return;
  loadingBarEl.style.width = '100%';
  loadingLabelEl.textContent = 'Pronto para decolar!';
  finishLoading();
};
assetLoadingManager.onError = (url) => {
  console.warn('Falha ao carregar asset (seguindo sem ele):', url);
};