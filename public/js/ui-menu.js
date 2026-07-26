// ui-menu.js
let useOriginalTexture = true;

// PEDIDO: cada avião tem duas fotos de card — uma pro modelo clássico
// (poligonal) e outra pro modelo realista — seguindo a convenção de nome
// "img/<tipo>-card.png" (clássico) e "img/<tipo>-realista-card.png"
// (realista). Ex.: cessna -> img/cessna-card.png / img/cessna-realista-card.png.
function planeCardImagePath(type, style) {
  const s = style || (typeof planeModelStyle !== 'undefined' ? planeModelStyle : 'poligonal');
  return s === 'realista' ? ('img/' + type + '-realista-card.png') : ('img/' + type + '-card.png');
}

// Atualiza a foto do carrossel (menu + lobby + troca de avião) pro estilo
// passado — chamado sempre que o toggle Clássico/Realista muda, pra
// imagem trocar junto na hora, sem precisar reconstruir nada.
function updatePlaneCardImages(style) {
  document.querySelectorAll('.carousel-photo').forEach(photo => {
    const type = photo.dataset.type;
    if (type) photo.style.backgroundImage = "url('" + planeCardImagePath(type, style) + "')";
  });
}

// PEDIDO: toggle vistoso "Clássico (poligonal, com textura/cor)" x
// "Realista (modelo 3D fixo, sem textura/cor)" — funciona igual no menu
// principal e no lobby. prefix: 'menu' ou 'lobby'.
function bindPlaneStyleToggle(prefix) {
  const toggle = document.getElementById(prefix + '-style-toggle');
  if (!toggle) return;
  const realisticCb = document.getElementById(prefix === 'menu' ? 'use-realistic-model' : 'lobby-use-realistic-model');
  const classicOptions = document.getElementById(prefix + '-classic-options');
  const note = document.getElementById(prefix + '-style-note');
  const buttons = toggle.querySelectorAll('.plane-style-btn');

  function applyStyle(style, opts) {
    const silent = opts && opts.silent;
    buttons.forEach(b => b.classList.toggle('active', b.dataset.style === style));
    if (realisticCb) realisticCb.checked = (style === 'realista');
    if (classicOptions) classicOptions.classList.toggle('disabled', style === 'realista');
    if (note) {
      note.textContent = style === 'realista'
        ? 'Modelo 3D realista: visual fixo, sem opção de textura ou cor.'
        : 'Modelo poligonal com textura original ou cor personalizada.';
    }
    updatePlaneCardImages(style);
    if (!silent) {
      planeModelStyle = style;
      if (typeof rebuildVehicle === 'function') { try { rebuildVehicle(); } catch (e) {} }
    }
  }

  buttons.forEach(btn => {
    btn.addEventListener('click', () => applyStyle(btn.dataset.style));
  });

  // PEDIDO: estado inicial agora é REALISTA por padrão (antes era o
  // poligonal/clássico). O checkbox correspondente já vem marcado
  // "checked" no HTML, então isso só reflete o que está marcado.
  applyStyle((realisticCb && realisticCb.checked) ? 'realista' : 'poligonal', { silent: true });
}

// Sincroniza um par de inputs (menu <-> lobby) nos dois sentidos, sem loop
// infinito, pra poder trocar cor/textura em qualquer uma das duas telas e
// ver refletido na outra (e no avião de verdade, via rebuildVehicle).
// CORREÇÃO: agora dispara o evento 'change' para atualizar as pílulas visuais.
function syncInputPair(idA, idB, isCheckbox, storageKey) {
  const a = document.getElementById(idA), b = document.getElementById(idB);
  if (!a || !b) return;
  const prop = isCheckbox ? 'checked' : 'value';
  
  // Restaura do localStorage se fornecido
  if (storageKey) {
    const saved = localStorage.getItem(storageKey);
    if (saved !== null) {
      if (isCheckbox) a[prop] = (saved === 'true');
      else a[prop] = saved;
    }
  }

  function updateBoth(val) {
    a[prop] = val;
    b[prop] = val;
    if (storageKey) localStorage.setItem(storageKey, String(val));
    a.dispatchEvent(new Event('change'));
    b.dispatchEvent(new Event('change'));
    if (typeof rebuildVehicle === 'function') { try { rebuildVehicle(); } catch (e) {} }
  }

  a.addEventListener('change', () => {
    const val = a[prop];
    b[prop] = val;
    if (storageKey) localStorage.setItem(storageKey, String(val));
    b.dispatchEvent(new Event('change'));
    if (typeof rebuildVehicle === 'function') { try { rebuildVehicle(); } catch (e) {} }
  });
  b.addEventListener('change', () => {
    const val = b[prop];
    a[prop] = val;
    if (storageKey) localStorage.setItem(storageKey, String(val));
    a.dispatchEvent(new Event('change'));
    if (typeof rebuildVehicle === 'function') { try { rebuildVehicle(); } catch (e) {} }
  });
}

// ================================================================
//  CARROSSEL DE PILOTO — a "foto" do piloto (avatar), 15 opções fixas.
//  Convenção de arquivo: img/piloto1.png até img/piloto15.png (você
//  fornece as imagens com esse nome). Só existe no menu principal —
//  a foto escolhida acompanha o jogador dali pra frente (aparece no
//  painel do chat de voz de quem estiver na mesma sala/sala livre).
// ================================================================
const PILOT_COUNT = 15;
function pilotImagePath(index) { return 'img/piloto' + index + '.png'; }

let selectedPilotIndex = 1;
if (typeof localStorage !== 'undefined') {
  const saved = parseInt(localStorage.getItem('selectedPilotIndex'), 10);
  if (saved >= 1 && saved <= PILOT_COUNT) selectedPilotIndex = saved;
}
window.selectedPilotIndex = selectedPilotIndex;

function renderPilotCarousel() {
  const photo = document.getElementById('menu-pilot-photo');
  const label = document.getElementById('menu-pilot-label');
  if (photo) photo.style.backgroundImage = "url('" + pilotImagePath(selectedPilotIndex) + "')";
  if (label) label.textContent = 'Piloto ' + selectedPilotIndex;
}

function selectPilotIndex(index) {
  selectedPilotIndex = ((index - 1) % PILOT_COUNT + PILOT_COUNT) % PILOT_COUNT + 1;
  window.selectedPilotIndex = selectedPilotIndex;
  if (typeof localStorage !== 'undefined') localStorage.setItem('selectedPilotIndex', String(selectedPilotIndex));
  renderPilotCarousel();
}

function bindPilotCarousel() {
  renderPilotCarousel();
  const prevBtn = document.getElementById('menu-pilot-prev');
  const nextBtn = document.getElementById('menu-pilot-next');
  if (prevBtn) prevBtn.addEventListener('click', () => { playSound('plane_switch'); selectPilotIndex(selectedPilotIndex - 1); });
  if (nextBtn) nextBtn.addEventListener('click', () => { playSound('plane_switch'); selectPilotIndex(selectedPilotIndex + 1); });
}

// ================================================================
//  ABA "AVIÃO / SALA" NO MEIO DO LOBBY — mesmo toggle amarelo do
//  Clássico/Realista, só que troca qual painel aparece: a habilidade
//  do seu avião, ou as configurações da sala (mapa/modo/etc, só o
//  host de fato edita — ver #lobby-host-settings em multiplayer.js).
// ================================================================
function bindLobbyInfoTabToggle() {
  const toggle = document.getElementById('lobby-info-tab-toggle');
  if (!toggle) return;
  const buttons = toggle.querySelectorAll('.plane-style-btn');
  const tabs = {
    aviao: document.getElementById('lobby-tab-aviao'),
    sala: document.getElementById('lobby-tab-sala'),
  };
  function showTab(tab) {
    buttons.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    Object.keys(tabs).forEach(key => { if (tabs[key]) tabs[key].classList.toggle('hidden', key !== tab); });
  }
  buttons.forEach(btn => btn.addEventListener('click', () => showTab(btn.dataset.tab)));
  showTab('aviao');
}

function statBar(val, max) { return Math.round((val / max) * 100); }

// prefix: 'menu' | 'lobby' | 'switch' (modal de troca de avião — treino
// com bots via pausa, ou sala livre ao morrer). scope é só usado pra
// decidir se emite 'set-plane' pro servidor.
function updatePlaneStats(type, prefix) {
  const spec = PLANE_SPECS[type] || PLANE_SPECS.cessna;
  const speedPct = statBar(spec.maxSpeed, 5);
  const agilityPct = statBar(spec.baseRotationSpeed, 0.05);
  const stabilityPct = 100 - statBar(spec.maxPitchAngle, Math.PI / 3);
  const sEl = document.getElementById(prefix + '-stat-speed');
  const aEl = document.getElementById(prefix + '-stat-agility');
  const stEl = document.getElementById(prefix + '-stat-stability');
  const titleEl = document.getElementById(prefix + '-special-title');
  const descEl = document.getElementById(prefix + '-special-desc-full');
  const powerImgEl = document.getElementById(prefix + '-power-img');
  if (sEl) sEl.style.width = speedPct + '%';
  if (aEl) aEl.style.width = agilityPct + '%';
  if (stEl) stEl.style.width = Math.max(10, stabilityPct) + '%';
  if (titleEl) titleEl.textContent = '⚡ ' + spec.specialLabel;
  if (descEl) descEl.textContent = spec.specialDesc;
  // Foto retangular da habilidade — 1 por avião, mesma ordem/índice de
  // PLANE_ORDER (15 aviões = img/poder1.png até img/poder15.png).
  if (powerImgEl) powerImgEl.style.backgroundImage = "url('img/poder" + (planeIndexOf(type) + 1) + ".png')";
}

// ================================================================
//  CARROSSEL DE AVIÕES — um avião grande por vez, com setas de
//  avançar/voltar. Loop infinito (passar do último volta pro primeiro
//  e vice-versa, sem "quebrar" a experiência). Usado no menu, no lobby
//  e no modal de troca de avião (treino com bots / sala livre ao
//  morrer) — todos compartilham a mesma lógica, só muda o prefixo dos
//  elementos e o "scope" (que decide se avisa o servidor).
// ================================================================
const carouselIndexes = {};

function planeIndexOf(type) {
  if (typeof PLANE_ORDER === 'undefined') return 0;
  const i = PLANE_ORDER.indexOf(type);
  return i >= 0 ? i : 0;
}

function currentCarouselType(prefix) {
  return PLANE_ORDER[carouselIndexes[prefix] || 0] || 'cessna';
}

function renderCarousel(prefix) {
  const type = currentCarouselType(prefix);
  const spec = PLANE_SPECS[type];
  if (!spec) return;
  const photo = document.getElementById(prefix + '-carousel-photo');
  const label = document.getElementById(prefix + '-carousel-label');
  if (photo) {
    photo.dataset.type = type;
    photo.style.backgroundImage = "url('" + planeCardImagePath(type) + "')";
  }
  if (label) label.textContent = (typeof PLANE_ICONS !== 'undefined' && PLANE_ICONS[type] || '🛩️') + ' ' + spec.label;
  updatePlaneStats(type, prefix);
}

// scope: 'menu' | 'lobby' | 'pause-bots' | 'free-room' — decide se
// avisa o servidor (lobby/sala livre) e se reconstrói o avião na hora.
function selectCarouselIndex(prefix, scope, index) {
  const n = (typeof PLANE_ORDER !== 'undefined' && PLANE_ORDER.length) || 1;
  carouselIndexes[prefix] = ((index % n) + n) % n;
  renderCarousel(prefix);
  const type = currentCarouselType(prefix);
  selectedPlaneType = type;
  window.selectedPlaneType = type;
  if (typeof localStorage !== 'undefined') localStorage.setItem('selectedPlaneType', type);
  if ((scope === 'lobby' || scope === 'free-room') && onlineState.socket) {
    onlineState.socket.emit('set-plane', type);
  }
  if (typeof rebuildVehicle === 'function') { try { rebuildVehicle(); } catch (e) {} }
}

// scope pode ser uma string fixa ('menu'/'lobby') ou uma função que
// resolve o scope na hora do clique (usado pelo modal de troca de
// avião, que serve tanto o treino com bots quanto a sala livre).
function bindCarousel(prefix, scope) {
  const resolveScope = () => (typeof scope === 'function' ? scope() : scope);
  const prevBtn = document.getElementById(prefix + '-carousel-prev');
  const nextBtn = document.getElementById(prefix + '-carousel-next');
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('selectedPlaneType') : null;
  const initType = stored || (prefix === 'menu' ? (selectedPlaneType || 'cessna') : (window.selectedPlaneType || 'cessna'));
  carouselIndexes[prefix] = planeIndexOf(initType);
  renderCarousel(prefix);
  if (prevBtn) prevBtn.addEventListener('click', () => {
    playSound('plane_switch');
    selectCarouselIndex(prefix, resolveScope(), (carouselIndexes[prefix] || 0) - 1);
  });
  if (nextBtn) nextBtn.addEventListener('click', () => {
    playSound('plane_switch');
    selectCarouselIndex(prefix, resolveScope(), (carouselIndexes[prefix] || 0) + 1);
  });
}

// ================================================================
//  MODAL "TROCAR DE AVIÃO" — usado em dois contextos:
//   1) Treino com bots, aberto pela pausa.
//   2) Sala Livre, aberto só quando você MORRE (enquanto vivo o avião
//      não muda — existe o próprio sistema de recuperar vida).
//  O parâmetro scope diz se, ao trocar, também avisamos o servidor.
// ================================================================
let switchPlaneScope = 'pause-bots';
function openSwitchPlaneModal(scope) {
  switchPlaneScope = scope || 'pause-bots';
  carouselIndexes['switch'] = planeIndexOf(window.selectedPlaneType || selectedPlaneType || 'cessna');
  renderCarousel('switch');
  document.getElementById('modal-switch-plane').classList.remove('hidden');
}
function closeSwitchPlaneModal() {
  document.getElementById('modal-switch-plane').classList.add('hidden');
}

// ================================================================
//  MÚSICA DO LOBBY + MUDO GERAL DO JOGO
//  - "Música do lobby": toca public/sons/musica-lobby.mp3 em loop
//    sempre que o menu principal ou o lobby estão na tela (mesma
//    detecção que já existe pra câmera de prévia do avião, ver
//    isMenuPreviewActive em menu-camera.js). Some sozinha ao entrar
//    na partida e volta ao voltar pro menu/lobby.
//  - "Sem som no jogo": muda os efeitos sonoros (sound.js) e o motor
//    (positional-audio.js) de uma vez só, com uma única variável
//    (gameSoundMuted) que os dois arquivos já checam.
//  Ambas as opções ficam disponíveis tanto no menu quanto no lobby
//  (sincronizadas — ver syncInputPair) e persistem entre sessões.
// ================================================================
let lobbyMusicEnabled = (typeof localStorage !== 'undefined'
  && localStorage.getItem('lobbyMusicEnabled') === 'false') ? false : true;
let gameSoundMuted = (typeof localStorage !== 'undefined'
  && localStorage.getItem('gameSoundMuted') === 'true');

let lobbyMusicAudio = null;
try {
  lobbyMusicAudio = new Audio('sons/musica-lobby.mp3');
  lobbyMusicAudio.loop = true;
  lobbyMusicAudio.volume = 0.35;
} catch (e) { /* ambiente sem Audio (ex: testes) — ignora */ }

function updateLobbyMusicPlayback() {
  if (!lobbyMusicAudio) return;
  const shouldPlay = lobbyMusicEnabled && typeof isMenuPreviewActive === 'function' && isMenuPreviewActive();
  if (shouldPlay) {
    if (lobbyMusicAudio.paused) lobbyMusicAudio.play().catch(() => { /* aguarda interação do usuário */ });
  } else if (!lobbyMusicAudio.paused) {
    lobbyMusicAudio.pause();
  }
}
setInterval(updateLobbyMusicPlayback, 400);
// Política de autoplay do navegador: só toca de fato após alguma
// interação — igual ao mesmo truque já usado pro som do motor.
window.addEventListener('click', updateLobbyMusicPlayback, { once: true });
window.addEventListener('keydown', updateLobbyMusicPlayback, { once: true });
window.addEventListener('touchstart', updateLobbyMusicPlayback, { once: true });

function setLobbyMusicEnabled(on) {
  lobbyMusicEnabled = !!on;
  if (typeof localStorage !== 'undefined') localStorage.setItem('lobbyMusicEnabled', String(lobbyMusicEnabled));
  updateLobbyMusicPlayback();
  // atualiza todos os checkboxes e pílulas
  document.querySelectorAll('.lobby-music-toggle, .menu-music-toggle').forEach(cb => cb.checked = lobbyMusicEnabled);
  document.querySelectorAll('.music-pill-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.value === (lobbyMusicEnabled ? 'on' : 'off')));
}

function setGameSoundMuted(on) {
  gameSoundMuted = !!on;
  if (typeof localStorage !== 'undefined') localStorage.setItem('gameSoundMuted', String(gameSoundMuted));
  if (typeof updateMuteButtonIcon === 'function') updateMuteButtonIcon();
  document.querySelectorAll('.mute-toggle').forEach(cb => cb.checked = gameSoundMuted);
  document.querySelectorAll('.sound-pill-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.value === (gameSoundMuted ? 'on' : 'off')));
}

function bindSoundToggles(prefix) {
  const musicCb = document.getElementById(prefix + '-lobby-music-toggle');
  const muteCb = document.getElementById(prefix + '-mute-toggle');
  if (musicCb) {
    musicCb.checked = lobbyMusicEnabled;
    musicCb.addEventListener('change', () => setLobbyMusicEnabled(musicCb.checked));
  }
  if (muteCb) {
    muteCb.checked = gameSoundMuted;
    muteCb.addEventListener('change', () => setGameSoundMuted(muteCb.checked));
  }
}

// ================================================================
//  PÍLULAS DE SOM/CONTROLE — mesmo componente visual do toggle
//  Clássico/Realista (duas opções lado a lado, uma "acesa"), só que
//  pra música/som/teclado-toque. Em vez de duplicar a lógica que já
//  funciona (bindSoundToggles, bindForceMobileControlsCheckbox em
//  mobile-controls.js), a pílula só pilota o checkbox escondido
//  correspondente e dispara um 'change' de verdade nele — todo o
//  resto continua exatamente como já era.
// ================================================================
function bindPillToggle(pillId, checkboxId) {
  const pill = document.getElementById(pillId);
  const cb = document.getElementById(checkboxId);
  if (!pill || !cb) return;
  const buttons = pill.querySelectorAll('.plane-style-btn');
  function applyFromCheckbox() {
    const val = cb.checked ? 'on' : 'off';
    buttons.forEach(b => b.classList.toggle('active', b.dataset.value === val));
  }
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const wantOn = btn.dataset.value === 'on';
      if (cb.checked !== wantOn) {
        cb.checked = wantOn;
        cb.dispatchEvent(new Event('change'));
      }
      applyFromCheckbox();
    });
  });
  // Reaplica sempre que o checkbox mudar por qualquer outro caminho
  // (ex.: sincronia menu<->lobby via syncInputPair).
  cb.addEventListener('change', applyFromCheckbox);
  applyFromCheckbox();
}

document.addEventListener('DOMContentLoaded', function() {
  if (typeof PLANE_ORDER === 'undefined') {
    console.error('PLANE_ORDER não definido. Verifique a ordem de carregamento dos scripts.');
    return;
  }
  
  // Restaurar nome do localStorage
  const savedName = localStorage.getItem('playerName');
  if (savedName) {
    document.getElementById('menu-name').value = savedName;
  }
  document.getElementById('menu-name').addEventListener('change', function() {
    localStorage.setItem('playerName', this.value);
  });

  bindCarousel('menu', 'menu');
  bindCarousel('lobby', 'lobby');
  bindCarousel('switch', () => switchPlaneScope);
  bindPilotCarousel();
  document.getElementById('modal-switch-plane-close').addEventListener('click', closeSwitchPlaneModal);

  bindSoundToggles('menu');
  bindSoundToggles('lobby');
  bindPillToggle('menu-music-pill', 'menu-lobby-music-toggle');
  bindPillToggle('menu-sound-pill', 'menu-mute-toggle');
  bindPillToggle('menu-mobile-pill', 'force-mobile-controls');
  // CORREÇÃO: música/som sumiam de vez dentro da sala porque só existia
  // o checkbox escondido de sincronia (lobby-lobby-music-toggle /
  // lobby-mute-toggle) — nenhuma pílula visível igual à do menu. Agora
  // o lobby tem as pílulas próprias (#lobby-music-pill / #lobby-sound-pill
  // no HTML), pilotando os mesmos checkboxes escondidos de sempre.
  bindPillToggle('lobby-music-pill', 'lobby-lobby-music-toggle');
  bindPillToggle('lobby-sound-pill', 'lobby-mute-toggle');
  
  // Sincroniza com localStorage e entre si
  syncInputPair('menu-lobby-music-toggle', 'lobby-lobby-music-toggle', true, 'lobbyMusicEnabled');
  syncInputPair('menu-mute-toggle', 'lobby-mute-toggle', true, 'gameSoundMuted');

  // CORREÇÃO: essa função existia mas nunca era chamada — por isso os
  // botões "✈️ Avião" / "⚙️ Sala" na sala não reagiam a clique nenhum,
  // e a aba de configurações (mapa/modo/etc, ver bindHostSettingsGrid
  // logo abaixo) ficava escondida pra sempre, mesmo sendo o host.
  bindLobbyInfoTabToggle();

  // CORREÇÃO: o host não conseguia alterar mapa/modo/modo de avião na
  // sala. Os botões de #lobby-env-options, #lobby-mode-options e
  // #lobby-planemode-options nunca eram criados (só os do modal "criar
  // sala" eram), e bindHostSettingsGrid() — a função que emite
  // 'set-room-settings' pro servidor — estava definida mas nunca era
  // chamada em lugar nenhum. As duas coisas juntas faziam os controles
  // do host parecerem completamente quebrados.
  buildIconGrid('lobby-env-options', envButtons, k => MAP_INFO[k].label, k => MAP_INFO[k].icon, 'env', 'env-btn');
  buildIconGrid('lobby-mode-options', modeButtons, k => MODE_INFO[k].label, k => MODE_INFO[k].icon, 'mode', 'mode-btn');
  buildIconGrid('lobby-planemode-options', planeModeButtons, k => PLANE_MODE_INFO[k].label, k => PLANE_MODE_INFO[k].icon, 'planemode', 'planemode-btn');
  bindHostSettingsGrid('lobby-env-options', 'env', 'map');
  bindHostSettingsGrid('lobby-mode-options', 'mode', 'mode');
  bindHostSettingsGrid('lobby-planemode-options', 'planemode', 'planeMode');
  
  const cb = document.getElementById('use-original-texture');
  if (cb) {
    useOriginalTexture = cb.checked;
    cb.addEventListener('change', function() {
      useOriginalTexture = this.checked;
    });
  }

  // PEDIDO: alternar entre avião poligonal (padrão) e modelo 3D realista (.glb)
  const rm = document.getElementById('use-realistic-model');
  if (rm) {
    planeModelStyle = rm.checked ? 'realista' : 'poligonal';
    updatePlaneCardImages(planeModelStyle);
    rm.addEventListener('change', function() {
      planeModelStyle = this.checked ? 'realista' : 'poligonal';
      updatePlaneCardImages(planeModelStyle);
    });
  }

  bindPlaneStyleToggle('menu');
  bindPlaneStyleToggle('lobby');
  syncInputPair('menu-color-custom', 'lobby-color-custom', false, 'playerColor');
  syncInputPair('use-original-texture', 'lobby-use-original-texture', true, 'useOriginalTexture');
});

document.getElementById('btn-play-solo').addEventListener('click', () => {
  useOriginalTexture = document.getElementById('use-original-texture').checked;
  document.getElementById('main-menu').classList.add('hidden');
  leaveOnlineIfNeeded();
  currentMode = 'ffa';
  botsEnabled = true;
  showLoadingScreen(() => {});
  buildEnvironment('cidade');
  spawnEnemyBots();
  resetLocalStateForMenu();
  combatEnabled = false;
  prepTimer = 14;
  rebuildVehicle();
  document.getElementById('crosshair').classList.remove('hidden');
  playSound('start');
});

const envButtons = ['cidade', 'deserto', 'floresta', 'laboratorio'];
const modeButtons = ['ffa', 'teams'];
const planeModeButtons = ['livre', 'sorteio'];

function buildIconGrid(containerId, list, labelFn, iconFn, dataAttr, btnClass) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  list.forEach((key, idx) => {
    const btn = document.createElement('button');
    btn.className = btnClass;
    btn.dataset[dataAttr] = key;
    btn.innerHTML = '<div style="font-size:18px;">' + iconFn(key) + '</div><div style="font-size:9px;">' + labelFn(key) + '</div>';
    if (idx === 0) btn.classList.add('selected');
    btn.addEventListener('click', () => { el.querySelectorAll('button').forEach(b => b.classList.remove('selected')); btn.classList.add('selected'); });
    el.appendChild(btn);
  });
}

document.getElementById('btn-create-room').addEventListener('click', () => {
  document.getElementById('modal-create-room').classList.remove('hidden');
  buildIconGrid('menu-env-options', envButtons, k => MAP_INFO[k].label, k => MAP_INFO[k].icon, 'env', 'env-btn');
  buildIconGrid('menu-mode-options', modeButtons, k => MODE_INFO[k].label, k => MODE_INFO[k].icon, 'mode', 'mode-btn');
  buildIconGrid('menu-planemode-options', planeModeButtons, k => PLANE_MODE_INFO[k].label, k => PLANE_MODE_INFO[k].icon, 'planemode', 'planemode-btn');
});
document.getElementById('modal-create-close').addEventListener('click', () => document.getElementById('modal-create-room').classList.add('hidden'));

document.getElementById('modal-create-confirm').addEventListener('click', () => {
  useOriginalTexture = document.getElementById('use-original-texture').checked;
  const roomName = document.getElementById('create-room-name').value || 'Esquadrão';
  const password = document.getElementById('create-room-password').value || '';
  const maxPlayers = parseInt(document.getElementById('create-room-max').value) || 6;
  const map = document.querySelector('#menu-env-options .env-btn.selected')?.dataset.env || 'cidade';
  const mode = document.querySelector('#menu-mode-options .mode-btn.selected')?.dataset.mode || 'ffa';
  const planeMode = document.querySelector('#menu-planemode-options .planemode-btn.selected')?.dataset.planemode || 'livre';
  window.__pendingCreateRoom = {
    roomName, password, maxPlayers, map, mode, planeMode,
    playerData: {
      name: document.getElementById('menu-name').value || 'Piloto',
      color: document.getElementById('menu-color-custom').value,
      planeType: selectedPlaneType,
      useOriginalTexture: useOriginalTexture,
      pilot: selectedPilotIndex
    }
  };
  document.getElementById('modal-create-room').classList.add('hidden');
  document.getElementById('main-menu').classList.add('hidden');
  connectOnline(null, window.__pendingCreateRoom);
});

// PEDIDO: "SALA LIVRE" — mata-mata persistente, sem lobby/host/pronto.
// Entra direto na partida em andamento (ou cria se ainda não existir),
// com um tempo de decolagem sem dano só seu, e dá pra sair a qualquer
// momento (botão de menu na pausa) sem afetar mais ninguém.
document.getElementById('btn-join-free').addEventListener('click', () => {
  useOriginalTexture = document.getElementById('use-original-texture').checked;
  const playerData = {
    name: document.getElementById('menu-name').value || 'Piloto',
    color: document.getElementById('menu-color-custom').value,
    planeType: selectedPlaneType,
    useOriginalTexture: useOriginalTexture,
    pilot: selectedPilotIndex
  };
  document.getElementById('main-menu').classList.add('hidden');
  joinFreeRoom(playerData);
});

document.getElementById('btn-list-rooms').addEventListener('click', () => {
  document.getElementById('modal-list-rooms').classList.remove('hidden');
  refreshRoomList();
});
document.getElementById('modal-list-close').addEventListener('click', () => document.getElementById('modal-list-rooms').classList.add('hidden'));
document.getElementById('modal-list-refresh').addEventListener('click', refreshRoomList);

function refreshRoomList() {
  const container = document.getElementById('room-list-container');
  container.innerHTML = '<div style="text-align:center;color:#7fbfd6;opacity:0.4;padding:20px;font-size:13px;">Carregando...</div>';
  const tempSocket = io({ transports: ['websocket', 'polling'] });
  tempSocket.on('connect', () => {
    tempSocket.emit('list-rooms', (list) => {
      container.innerHTML = '';
      if (!list.length) { container.innerHTML = '<div style="text-align:center;color:#7fbfd6;opacity:0.5;padding:20px;font-size:13px;">Nenhuma sala aberta.</div>'; tempSocket.disconnect(); return; }
      list.forEach(r => {
        const div = document.createElement('div');
        div.className = 'room-item';
        div.innerHTML = '<div><b>' + r.name + '</b><br><span style="font-size:11px;color:#7fbfd6;">' + mapLabel(r.map) + ' | ' + modeLabel(r.mode) + ' | ' + planeModeLabel(r.planeMode) + ' | 👥 ' + r.players + '/' + r.maxPlayers + (r.hasPassword ? ' 🔒' : '') + '</span></div>';
        const joinBtn = document.createElement('button');
        joinBtn.className = 'btn-secondary';
        joinBtn.textContent = 'ENTRAR';
        joinBtn.style.cssText = 'padding:6px 14px;font-size:12px;';
        joinBtn.addEventListener('click', () => {
          let password = '';
          if (r.hasPassword) password = prompt('Senha da sala:') || '';
          document.getElementById('modal-list-rooms').classList.add('hidden');
          document.getElementById('main-menu').classList.add('hidden');
          useOriginalTexture = document.getElementById('use-original-texture').checked;
          const playerData = {
            name: document.getElementById('menu-name').value || 'Piloto',
            color: document.getElementById('menu-color-custom').value,
            planeType: selectedPlaneType,
            useOriginalTexture: useOriginalTexture,
            pilot: selectedPilotIndex
          };
          tempSocket.disconnect();
          connectOnline(r.id, playerData, password);
        });
        div.appendChild(joinBtn);
        container.appendChild(div);
      });
      tempSocket.disconnect();
    });
  });
}

document.getElementById('lobby-ready-btn').addEventListener('click', () => {
  if (!onlineState.socket) return;
  onlineState.socket.emit('set-ready', !onlineState.ready);
});
// O antigo botão único "MUDAR ESQUADRÃO" (#lobby-team-btn) foi removido —
// já foi substituído pelos botões "ENTRAR" de cada coluna de time (ver
// multiplayer.js/renderLobby, mais direto: já mostra o time de destino).
document.getElementById('lobby-start-btn').addEventListener('click', () => { if (onlineState.socket) onlineState.socket.emit('start-game'); });
document.getElementById('lobby-leave-btn').addEventListener('click', () => {
  if (onlineState.socket) onlineState.socket.emit('leave-room');
  leaveOnlineIfNeeded();
  document.getElementById('main-menu').classList.remove('hidden');
});

function bindHostSettingsGrid(containerId, dataAttr, eventKey) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || !onlineState.socket || !onlineState.isHost) return;
    const payload = {}; payload[eventKey] = btn.dataset[dataAttr];
    onlineState.socket.emit('set-room-settings', payload);
  });
}

function openTutorialModal() { document.getElementById('modal-tutorial').classList.remove('hidden'); }
function openControlsModal() {
  document.getElementById('modal-controls').classList.remove('hidden');
  renderControlsConfig();
  // PEDIDO: poder configurar os botões do controle Xbox também. Não existe
  // um container próprio pra isso no HTML, então criamos um logo abaixo do
  // container de teclado, só na primeira vez.
  const keyboardContainer = document.getElementById('controls-config-container');
  if (keyboardContainer && !document.getElementById('gamepad-config-container') && keyboardContainer.parentNode) {
    const heading = document.createElement('div');
    heading.textContent = '🎮 Controle (Xbox)';
    heading.style.cssText = 'margin-top:14px;font-weight:700;font-size:13px;color:#00e5ff;';
    const gpContainer = document.createElement('div');
    gpContainer.id = 'gamepad-config-container';
    keyboardContainer.parentNode.insertBefore(heading, keyboardContainer.nextSibling);
    keyboardContainer.parentNode.insertBefore(gpContainer, heading.nextSibling);
  }
  if (typeof renderGamepadConfig === 'function') renderGamepadConfig('gamepad-config-container');
}
// CORREÇÃO: tutorial e controles agora têm botão também dentro da sala
// (não só no menu principal) — os dois apontam pras mesmas funções acima.
['btn-tutorial', 'lobby-btn-tutorial'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', openTutorialModal);
});
['btn-controls-config', 'lobby-btn-controls-config'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', openControlsModal);
});
document.getElementById('modal-tutorial-close').addEventListener('click', () => document.getElementById('modal-tutorial').classList.add('hidden'));
document.getElementById('modal-controls-close').addEventListener('click', () => document.getElementById('modal-controls').classList.add('hidden'));

const KEY_LABELS = {
  throttle: 'Acelerar (Espaço)', climbUp: 'Subir o Nariz', climbDown: 'Descer o Nariz / Freio',
  rollLeft: 'Rolar/Curvar Esquerda', rollRight: 'Rolar/Curvar Direita',
  bomb: 'Soltar Bomba', missile: 'Bomba de Área Azul', special: 'Habilidade Especial', freeCam: 'Soltar/Prender Câmera',
  camUp: 'Olhar Cima', camDown: 'Olhar Baixo', camLeft: 'Olhar Esquerda', camRight: 'Olhar Direita',
  voicePTT: 'Chat de Voz (PTT/Mutar)',
};

function renderControlsConfig() {
  const container = document.getElementById('controls-config-container');
  container.innerHTML = '<div style="font-size:11px;color:#7fbfd6;margin-bottom:8px;">Atirar é sempre no clique esquerdo do mouse.</div>';
  Object.keys(KEY_LABELS).forEach(action => {
    const row = document.createElement('div');
    row.className = 'control-row';
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.08);';
    const label = document.createElement('span');
    label.textContent = KEY_LABELS[action];
    label.style.fontSize = '13px';
    const btn = document.createElement('button');
    btn.className = 'btn-secondary';
    btn.style.cssText = 'padding:4px 12px;font-size:12px;min-width:90px;';
    btn.textContent = keybinds[action].replace('Key', '').replace('Digit', '');
    btn.addEventListener('click', () => {
      btn.textContent = '...';
      const handler = (e) => {
        e.preventDefault();
        keybinds[action] = e.code;
        btn.textContent = e.code.replace('Key', '').replace('Digit', '');
        window.removeEventListener('keydown', handler, true);
      };
      window.addEventListener('keydown', handler, true);
    });
    row.appendChild(label); row.appendChild(btn);
    container.appendChild(row);
  });
}
document.getElementById('controls-reset-default').addEventListener('click', () => { keybinds = { ...DEFAULT_KEYBINDS }; renderControlsConfig(); });