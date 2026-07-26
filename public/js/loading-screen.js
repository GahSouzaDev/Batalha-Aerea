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
    </div>
  `;
  document.body.appendChild(loadingOverlayEl);
  loadingBarEl = document.getElementById('loading-bar');
  loadingLabelEl = document.getElementById('loading-label');
}

function showLoadingScreen(onDone) {
  ensureLoadingDom();
  loadingActive = true;
  loadingOnDoneCb = onDone || null;
  loadingShownAt = performance.now();
  loadingOverlayEl.classList.remove('hidden');
  loadingBarEl.style.width = '5%';
  loadingLabelEl.textContent = 'Preparando aviões e cenário...';

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