// voice-chat.js
// ================================================================
//  CHAT DE VOZ — WebRTC em malha (cada participante conecta direto
//  com os outros, até 6 pessoas). O servidor (server.js) só repassa a
//  sinalização (offer/answer/ICE) pelo mesmo WebSocket do jogo — o
//  áudio em si nunca passa por ele. Sem áudio posicional: todo mundo
//  ouve todo mundo no mesmo volume base (ajustável por pessoa).
//
//  Funciona nos dois lugares:
//   - Sala Livre: conecta sozinho ao entrar (ver multiplayer.js).
//   - Sala privada/pública: conecta ao entrar no lobby, continua
//     ativo durante a partida também.
//
//  OBS: só usamos servidor STUN público (sem TURN) — em redes/NATs
//  muito restritivos a conexão direta pode falhar. Se isso virar
//  problema recorrente, um servidor TURN próprio resolve (fica pra
//  quando "escalar", como você mesmo comentou).
// ================================================================

const voiceChat = {
  enabled: false,          // conectado ao chat de voz da sala atual
  connecting: false,
  mode: (typeof localStorage !== 'undefined' && localStorage.getItem('voiceChatMode')) || 'ptt', // 'ptt' | 'open'
  micOn: false,
  localStream: null,
  peers: new Map(),        // id -> { pc, audioEl, name, color, muted(remoto/self), speaking, volume, locallyMuted, analyser }
  myId: null,
  myName: 'Piloto',
  myColor: '#00e5ff',
  mySpeaking: false,
  lastPlayerData: null,
};

let voiceAudioCtx = null;
function ensureVoiceAudioCtx() {
  if (!voiceAudioCtx) {
    try { voiceAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
  }
  if (voiceAudioCtx.state === 'suspended') voiceAudioCtx.resume();
  return voiceAudioCtx;
}

// PEDIDO DE CORREÇÃO (bug "não ouvi um dos 3, mesmo saindo/entrando de
// novo"): antes só tinha STUN, que só ajuda a achar um caminho DIRETO
// entre dois PCs. Se a rede de alguém tem NAT "fechado" (comum em wifi
// de operadora, 4G/5G, rede corporativa), o caminho direto NUNCA fecha
// — e como o problema é da rota em si, sair/entrar da sala ou recarregar
// a página não resolve nada (por isso persistiu do jeito que você
// descreveu). A solução de verdade é ter um servidor TURN, que retransmite
// o áudio quando o caminho direto não é possível. Abaixo já uso um TURN
// público gratuito (Open Relay Project, sem necessidade de conta) como
// rede de segurança. Funciona bem pro tamanho atual do jogo; se o
// número de gente jogando crescer muito, vale migrar pra um TURN próprio
// (ex.: coturn num servidor seu) pra não depender de limite de uso de
// um serviço gratuito de terceiros.
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];
const SPEAKING_THRESHOLD = 14; // amplitude média (0-255) acima disso conta como "falando"
const ICE_RECONNECT_TIMEOUT = 6000; // ms parado em "disconnected" antes de tentar recuperar sozinho

// ================================================================
//  CONECTAR / DESCONECTAR
// ================================================================
function voiceChatConnect(playerData) {
  if (voiceChat.enabled || voiceChat.connecting) return;
  if (!onlineState.socket) return;
  voiceChat.connecting = true;
  voiceChat.lastPlayerData = playerData || voiceChat.lastPlayerData;
  voiceChat.myId = onlineState.socket.id;
  voiceChat.myName = (voiceChat.lastPlayerData && voiceChat.lastPlayerData.name) || 'Piloto';
  voiceChat.myColor = (voiceChat.lastPlayerData && voiceChat.lastPlayerData.color) || '#00e5ff';
  voiceChat.myPilot = (voiceChat.lastPlayerData && voiceChat.lastPlayerData.pilot) || (typeof selectedPilotIndex !== 'undefined' ? selectedPilotIndex : 1);
  // PTT começa mudo (só transmite segurando); "sempre ligado" começa com
  // o microfone ativo.
  voiceChat.micOn = (voiceChat.mode === 'open');

  navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false })
    .then((stream) => {
      voiceChat.localStream = stream;
      stream.getAudioTracks().forEach(t => { t.enabled = voiceChat.micOn; });
      bindVoiceSocketEvents();
      onlineState.socket.emit('voice-join', { name: voiceChat.myName, color: voiceChat.myColor, muted: !voiceChat.micOn, pilot: voiceChat.myPilot }, (res) => {
        voiceChat.connecting = false;
        if (!res || !res.success) {
          showTemporaryMessage && showTemporaryMessage('🎙️ ' + ((res && res.message) || 'Não foi possível entrar no chat de voz.'), 3000);
          stopLocalStream();
          return;
        }
        voiceChat.enabled = true;
        (res.participants || []).forEach(p => ensurePeer(p.id, p));
        renderVoicePanel();
        refreshAudioSettingsModalIfOpen();
        // CORREÇÃO: forçar reinício do loop de detecção de fala
        speakingLoopRunning = false;
        updateSelfSpeakingLoop();
        if (typeof updateMicButtonIcon === 'function') updateMicButtonIcon();
      });
    })
    .catch(() => {
      voiceChat.connecting = false;
      showTemporaryMessage && showTemporaryMessage('🎙️ Não foi possível acessar o microfone.', 3000);
    });
}

// Sai do chat de voz mas continua na sala/partida normalmente. Dá pra
// entrar de novo depois (botão "Entrar" nas configurações de áudio).
function voiceChatLeave() {
  if (!voiceChat.enabled && !voiceChat.connecting) return;
  if (onlineState.socket) { try { onlineState.socket.emit('voice-leave'); } catch (e) {} }
  voiceChat.peers.forEach((peer, id) => destroyPeer(id));
  voiceChat.peers.clear();
  stopLocalStream();
  voiceChat.enabled = false;
  voiceChat.connecting = false;
  renderVoicePanel();
  refreshAudioSettingsModalIfOpen();
  if (typeof updateMicButtonIcon === 'function') updateMicButtonIcon();
}

// Chamado quando o jogador sai da sala/partida por completo (voltar pro
// menu, fechar a sala livre etc.) — limpeza total.
function voiceChatDisconnect() {
  voiceChatLeave();
  removeVoicePanel();
}

function stopLocalStream() {
  if (voiceChat.localStream) {
    voiceChat.localStream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
    voiceChat.localStream = null;
  }
}

// ================================================================
//  SINALIZAÇÃO (eventos do socket do jogo)
// ================================================================
function bindVoiceSocketEvents() {
  const socket = onlineState.socket;

  socket.on('voice-peer-joined', (p) => {
    ensurePeer(p.id, p);
    renderVoicePanel();
    refreshAudioSettingsModalIfOpen();
  });

  socket.on('voice-peer-left', (data) => {
    destroyPeer(data.id);
    voiceChat.peers.delete(data.id);
    renderVoicePanel();
    refreshAudioSettingsModalIfOpen();
  });

  socket.on('voice-peer-mute', (data) => {
    const peer = voiceChat.peers.get(data.id);
    if (peer) { peer.muted = !!data.muted; renderVoicePanel(); refreshAudioSettingsModalIfOpen(); }
  });

  socket.on('voice-signal', async (msg) => {
    const from = msg.from, payload = msg.payload;
    let peer = voiceChat.peers.get(from);
    if (!peer) {
      peer = ensurePeer(from, { name: 'Piloto', color: '#00e5ff', muted: false });
    }
    if (!peer.pc) return;
    // Se a conexão com essa pessoa já tinha morrido (failed/closed) e
    // chegou uma OFERTA nova (o outro lado tentando reconectar), recria
    // a conexão do zero antes de processar — senão a oferta cai numa
    // conexão já quebrada e nunca funciona de verdade.
    if (payload.kind === 'offer' && (peer.pc.connectionState === 'failed' || peer.pc.connectionState === 'closed')) {
      rebuildPeerConnection(peer, from);
    }
    const pc = peer.pc;
    if (!pc) return;
    try {
      if (payload.kind === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        await flushPendingIce(peer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendVoiceSignal(from, { kind: 'answer', sdp: pc.localDescription });
      } else if (payload.kind === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        await flushPendingIce(peer);
      } else if (payload.kind === 'ice' && payload.candidate) {
        // CORREÇÃO DE BUG (voz sumindo só com uma pessoa específica, sem
        // erro visível): candidatos ICE costumam chegar rapidinho, às
        // vezes ANTES da oferta/resposta (SDP) terminar de ser
        // processada nesse mesmo par. Chamar addIceCandidate() nessa
        // hora falha silenciosamente (o catch abaixo engolia o erro) e
        // o candidato se perdia pra sempre — daquele specific par nunca
        // mais fechava conexão direita, mesmo saindo/entrando de novo,
        // porque o problema não era a sessão, era esse descarte. Agora
        // guardamos o candidato numa fila se a descrição remota ainda
        // não chegou, e aplicamos todos assim que ela chegar.
        if (pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(payload.candidate);
        } else {
          peer.pendingIce = peer.pendingIce || [];
          peer.pendingIce.push(payload.candidate);
        }
      }
    } catch (e) { /* sinalização realmente fora de ordem/tardia — ignora */ }
  });
}

async function flushPendingIce(peer) {
  if (!peer.pendingIce || !peer.pendingIce.length) return;
  const queued = peer.pendingIce;
  peer.pendingIce = [];
  for (const cand of queued) {
    try { await peer.pc.addIceCandidate(cand); } catch (e) { /* ignore */ }
  }
}

function sendVoiceSignal(to, payload) {
  if (!onlineState.socket) return;
  onlineState.socket.emit('voice-signal', { to, payload });
}

// ================================================================
//  PEERS (conexões WebRTC individuais)
// ================================================================
function ensurePeer(id, meta) {
  if (id === voiceChat.myId) return null;
  let peer = voiceChat.peers.get(id);
  if (peer) {
    peer.name = meta.name || peer.name;
    peer.color = meta.color || peer.color;
    peer.muted = !!meta.muted;
    peer.pilot = meta.pilot || peer.pilot;
    return peer;
  }
  peer = {
    pc: null, audioEl: null, name: meta.name || 'Piloto', color: meta.color || '#00e5ff',
    muted: !!meta.muted, pilot: meta.pilot || 1, speaking: false, volume: 1, locallyMuted: false, analyser: null, dataArr: null,
    pendingIce: [], connectionIssue: false, reconnectTimer: null, restartAttempts: 0,
  };
  voiceChat.peers.set(id, peer);
  setupPeerConnection(peer, id);
  return peer;
}

function setupPeerConnection(peer, id) {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  peer.pc = pc;

  if (voiceChat.localStream) {
    voiceChat.localStream.getTracks().forEach(t => pc.addTrack(t, voiceChat.localStream));
  }

  pc.onicecandidate = (e) => {
    if (e.candidate) sendVoiceSignal(id, { kind: 'ice', candidate: e.candidate });
  };

  pc.ontrack = (e) => {
    attachRemoteStream(peer, e.streams[0]);
  };

  // Desempate determinístico: entre os dois lados de cada par, só quem
  // tem o id "maior" cria a oferta — evita os dois criarem oferta ao
  // mesmo tempo (glare) numa malha onde todo mundo conecta com todo
  // mundo.
  const iAmOfferer = !!(voiceChat.myId && voiceChat.myId > id);
  if (iAmOfferer) {
    pc.onnegotiationneeded = async () => {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendVoiceSignal(id, { kind: 'offer', sdp: pc.localDescription });
      } catch (e) { /* ignore */ }
    };
  }

  // CORREÇÃO DE BUG: antes, se a conexão com uma pessoa específica
  // falhasse (rede/NAT restritivo, Wi-Fi ruim etc.), não existia
  // NENHUMA tentativa de recuperar — ela ficava muda pro resto da
  // sessão, e como o problema era de rede (não da sessão em si), sair
  // e entrar de novo ou recarregar a página não mudava nada. Agora,
  // ao cair, tentamos sozinhos: reiniciar a negociação ICE algumas
  // vezes e, se nada resolver, recriar a conexão do zero com essa
  // pessoa. Se mesmo assim continuar falhando, mostramos um aviso
  // visual (⚠️) no avatar dela em vez de falhar em silêncio.
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected') {
      peer.connectionIssue = false;
      peer.restartAttempts = 0;
      if (peer.reconnectTimer) { clearTimeout(peer.reconnectTimer); peer.reconnectTimer = null; }
      renderVoicePanel();
    } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
      scheduleReconnect(peer, id, iAmOfferer);
    }
  };
}

function scheduleReconnect(peer, id, iAmOfferer) {
  if (peer.reconnectTimer) return; // já tem uma tentativa agendada
  peer.reconnectTimer = setTimeout(() => {
    peer.reconnectTimer = null;
    if (!voiceChat.peers.has(id)) return; // pessoa já saiu do chat, não faz nada
    const pc = peer.pc;
    if (!pc || pc.connectionState === 'connected') return;
    peer.restartAttempts = (peer.restartAttempts || 0) + 1;
    if (peer.restartAttempts <= 3) {
      if (iAmOfferer && typeof pc.restartIce === 'function') {
        try { pc.restartIce(); } catch (e) { /* ignore */ }
      }
      // Se eu não sou quem oferece, só espero a oferta de restart do
      // outro lado chegar (ele detecta a mesma falha e reinicia).
      scheduleReconnect(peer, id, iAmOfferer); // continua observando
    } else {
      // Esgotou as tentativas de ICE restart — recria a conexão do zero.
      if (pc.connectionState !== 'connected') {
        peer.connectionIssue = true;
        renderVoicePanel();
        refreshAudioSettingsModalIfOpen();
        if (iAmOfferer) rebuildPeerConnection(peer, id);
      }
    }
  }, ICE_RECONNECT_TIMEOUT);
}

function rebuildPeerConnection(peer, id) {
  try { peer.pc && peer.pc.close(); } catch (e) { /* ignore */ }
  peer.pc = null;
  peer.pendingIce = [];
  peer.restartAttempts = 0;
  setupPeerConnection(peer, id);
}

function attachRemoteStream(peer, stream) {
  if (!stream) return;
  const audio = document.createElement('audio');
  audio.autoplay = true;
  audio.volume = peer.locallyMuted ? 0 : peer.volume;
  audio.srcObject = stream;
  tryPlayAudio(audio);
  peer.audioEl = audio;
  document.body.appendChild(audio);

  const ctx = ensureVoiceAudioCtx();
  if (ctx) {
    try {
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser); // NÃO conecta no destino — só analisa, quem toca é o <audio>
      peer.analyser = analyser;
      peer.dataArr = new Uint8Array(analyser.frequencyBinCount);
    } catch (e) { /* navegador sem suporte — só não terá indicador de fala */ }
  }
}

// CORREÇÃO DE BUG: audio.play() pode falhar por política de autoplay do
// navegador (raro, mas acontece — geralmente num áudio específico entre
// vários) e antes esse erro era só engolido em silêncio, sem NENHUMA
// nova tentativa depois. Resultado: aquela pessoa ficava muda o resto
// da sessão inteira, sem aviso nenhum. Agora, se falhar, guardamos o
// elemento numa fila e tentamos de novo a cada clique/tecla — igual ao
// padrão que já existia pro som do motor (positional-audio.js).
const pendingVoiceAudio = new Set();
function tryPlayAudio(audio) {
  audio.play().then(() => pendingVoiceAudio.delete(audio)).catch(() => { pendingVoiceAudio.add(audio); });
}
function retryPendingVoiceAudio() {
  pendingVoiceAudio.forEach((audio) => {
    audio.play().then(() => pendingVoiceAudio.delete(audio)).catch(() => { /* tenta de novo no próximo gesto */ });
  });
}
window.addEventListener('click', retryPendingVoiceAudio);
window.addEventListener('keydown', retryPendingVoiceAudio);
window.addEventListener('touchstart', retryPendingVoiceAudio, { passive: true });

function destroyPeer(id) {
  const peer = voiceChat.peers.get(id);
  if (!peer) return;
  if (peer.reconnectTimer) { clearTimeout(peer.reconnectTimer); peer.reconnectTimer = null; }
  if (peer.pc) { try { peer.pc.close(); } catch (e) {} }
  if (peer.audioEl) { peer.audioEl.pause(); peer.audioEl.srcObject = null; peer.audioEl.remove(); }
}

// ================================================================
//  MICROFONE — PTT (segurar) x SEMPRE LIGADO (alterna)
// ================================================================
function setMicOn(on) {
  if (!voiceChat.enabled) return;
  voiceChat.micOn = !!on;
  if (voiceChat.localStream) voiceChat.localStream.getAudioTracks().forEach(t => { t.enabled = voiceChat.micOn; });
  if (onlineState.socket) onlineState.socket.emit('voice-mute-changed', !voiceChat.micOn);
  if (typeof updateMicButtonIcon === 'function') updateMicButtonIcon();
  renderVoicePanel();
}
function voiceChatToggleMic() { setMicOn(!voiceChat.micOn); }

// Teclado (Shift por padrão, configurável em Controles ou nas
// Configurações de Áudio — os dois editam o mesmo keybinds.voicePTT).
function voiceChatHandlePTTKey(down, repeat) {
  if (!voiceChat.enabled) return;
  if (voiceChat.mode === 'ptt') {
    if (repeat) return;
    setMicOn(down);
  } else if (down && !repeat) {
    voiceChatToggleMic();
  }
}
// Gamepad — chamado todo frame com o estado atual do botão.
function voiceChatHandlePTTButton(pressed, justPressed) {
  if (!voiceChat.enabled) return;
  if (voiceChat.mode === 'ptt') {
    setMicOn(pressed);
  } else if (justPressed) {
    voiceChatToggleMic();
  }
}

function setVoiceChatMode(mode) {
  voiceChat.mode = (mode === 'open') ? 'open' : 'ptt';
  if (typeof localStorage !== 'undefined') localStorage.setItem('voiceChatMode', voiceChat.mode);
  // Ao trocar de modo, volta pro estado padrão dele (PTT = mudo até
  // segurar; sempre ligado = mic ativo).
  setMicOn(voiceChat.mode === 'open');
}

// ================================================================
//  DETECÇÃO DE "ESTÁ FALANDO" (local + remotos) — só pra UI, não afeta
//  o áudio em si.
// ================================================================
let localAnalyser = null, localDataArr = null;
function ensureLocalAnalyser() {
  if (!voiceChat.localStream) return null;
  const ctx = ensureVoiceAudioCtx();
  if (!ctx) return null;
  try {
    const src = ctx.createMediaStreamSource(voiceChat.localStream);
    localAnalyser = ctx.createAnalyser();
    localAnalyser.fftSize = 256;
    src.connect(localAnalyser);
    localDataArr = new Uint8Array(localAnalyser.frequencyBinCount);
  } catch (e) { /* ignore */ }
  return localAnalyser;
}

function averageAmplitude(analyser, arr) {
  analyser.getByteFrequencyData(arr);
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i];
  return sum / arr.length;
}

let speakingLoopRunning = false;
function updateSelfSpeakingLoop() {
  if (speakingLoopRunning) return;
  speakingLoopRunning = true;
  if (!localAnalyser) ensureLocalAnalyser();
  function tick() {
    if (!voiceChat.enabled) { speakingLoopRunning = false; return; }
    const wasSpeaking = voiceChat.mySpeaking;
    if (localAnalyser && voiceChat.micOn) {
      voiceChat.mySpeaking = averageAmplitude(localAnalyser, localDataArr) > SPEAKING_THRESHOLD;
    } else {
      voiceChat.mySpeaking = false;
    }
    let anyPeerChanged = false;
    voiceChat.peers.forEach((peer) => {
      const was = peer.speaking;
      if (peer.analyser && !peer.locallyMuted && !peer.muted) {
        peer.speaking = averageAmplitude(peer.analyser, peer.dataArr) > SPEAKING_THRESHOLD;
      } else {
        peer.speaking = false;
      }
      if (was !== peer.speaking) anyPeerChanged = true;
    });
    if (wasSpeaking !== voiceChat.mySpeaking || anyPeerChanged) renderVoicePanel();
    requestAnimationFrame(tick);
  }
  tick();
}

// ================================================================
//  PAINEL FLUTUANTE DE PARTICIPANTES (avatares) — esquerda no
//  desktop, topo no mobile. Sem áudio posicional: é só indicador
//  visual de quem está no chat e quem está falando/mudo.
// ================================================================
let voicePanelEl = null;
function ensureVoicePanel() {
  if (voicePanelEl) return voicePanelEl;
  voicePanelEl = document.createElement('div');
  voicePanelEl.id = 'voice-panel';
  voicePanelEl.className = 'hidden';
  document.body.appendChild(voicePanelEl);
  return voicePanelEl;
}
function removeVoicePanel() {
  if (voicePanelEl) { voicePanelEl.remove(); voicePanelEl = null; }
}

function avatarInitial(name) { return (name || '?').trim().charAt(0).toUpperCase() || '?'; }

function renderVoicePanel() {
  const el = ensureVoicePanel();
  if (!voiceChat.enabled) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  el.innerHTML = '';

  const selfAvatar = buildAvatarEl(voiceChat.myName + ' (você)', voiceChat.myColor, voiceChat.mySpeaking, !voiceChat.micOn, 'self', voiceChat.myPilot);
  el.appendChild(selfAvatar);

  voiceChat.peers.forEach((peer, id) => {
    const av = buildAvatarEl(peer.name, peer.color, peer.speaking, peer.muted || peer.locallyMuted, id, peer.pilot, peer.connectionIssue);
    el.appendChild(av);
  });
}

function buildAvatarEl(name, color, speaking, muted, peerId, pilot, connectionIssue) {
  const wrap = document.createElement('div');
  wrap.className = 'voice-avatar' + (speaking ? ' speaking' : '') + (muted ? ' muted' : '') + (connectionIssue ? ' connection-issue' : '');
  wrap.title = name + (connectionIssue ? ' — problema de conexão (rede/NAT), tentando reconectar...' : '');
  if (peerId) wrap.dataset.peerId = peerId;
  const circle = document.createElement('div');
  circle.className = 'voice-avatar-circle';
  if (pilot && typeof pilotImagePath === 'function') {
    circle.style.backgroundImage = "url('" + pilotImagePath(pilot) + "')";
    circle.style.backgroundColor = color || '#00e5ff';
  } else {
    circle.style.background = color || '#00e5ff';
    circle.textContent = avatarInitial(name);
  }
  wrap.appendChild(circle);
  if (muted) {
    const badge = document.createElement('div');
    badge.className = 'voice-avatar-mute-badge';
    badge.textContent = '🔇';
    wrap.appendChild(badge);
  }
  if (connectionIssue) {
    const warn = document.createElement('div');
    warn.className = 'voice-avatar-warn-badge';
    warn.textContent = '⚠️';
    wrap.appendChild(warn);
  }
  const label = document.createElement('div');
  label.className = 'voice-avatar-label';
  label.textContent = name;
  wrap.appendChild(label);
  return wrap;
}

function refreshAudioSettingsModalIfOpen() {
  const modal = document.getElementById('modal-audio-settings');
  if (modal && !modal.classList.contains('hidden')) renderAudioSettingsModal();
}

// ================================================================
//  MODAL "CONFIGURAÇÕES DE ÁUDIO" — PTT x sempre ligado, rebind de
//  tecla/botão, entrar/sair do chat, e lista de participantes com
//  volume/mudo individual.
// ================================================================
function ensureAudioSettingsModal() {
  let modal = document.getElementById('modal-audio-settings');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.className = 'modal hidden';
  modal.id = 'modal-audio-settings';
  modal.innerHTML =
    '<div class="modal-content" style="max-width:440px;">' +
      '<button class="modal-close" id="audio-settings-close">&times;</button>' +
      '<div class="overlay-title" style="font-size:18px;">🎙️ Chat de Voz</div>' +
      '<div id="audio-settings-body"></div>' +
    '</div>';
  document.body.appendChild(modal);
  document.getElementById('audio-settings-close').addEventListener('click', () => modal.classList.add('hidden'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
  return modal;
}

function openAudioSettingsModal() {
  ensureAudioSettingsModal().classList.remove('hidden');
  renderAudioSettingsModal();
}

function renderAudioSettingsModal() {
  const body = document.getElementById('audio-settings-body');
  if (!body) return;
  body.innerHTML = '';

  // ----- status + entrar/sair -----
  const statusRow = document.createElement('div');
  statusRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;';
  statusRow.innerHTML = '<span style="font-size:13px;color:' + (voiceChat.enabled ? 'var(--success)' : 'var(--text-mute)') + ';">' +
    (voiceChat.enabled ? '🟢 Conectado ao chat de voz' : (voiceChat.connecting ? '🟡 Conectando...' : '⚪ Desconectado')) + '</span>';
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'btn-secondary' + (voiceChat.enabled ? ' btn-danger' : ' btn-confirm');
  toggleBtn.style.cssText = 'padding:6px 14px;font-size:12px;';
  toggleBtn.textContent = voiceChat.enabled ? 'Sair do Chat' : 'Entrar no Chat';
  toggleBtn.addEventListener('click', () => {
    if (voiceChat.enabled) voiceChatLeave();
    else voiceChatConnect(voiceChat.lastPlayerData);
    setTimeout(renderAudioSettingsModal, 150);
  });
  statusRow.appendChild(toggleBtn);
  body.appendChild(statusRow);

  // ----- modo PTT x sempre ligado -----
  const modeLabel = document.createElement('div');
  modeLabel.className = 'setup-group-label';
  modeLabel.textContent = 'Modo do Microfone';
  body.appendChild(modeLabel);
  const modeToggle = document.createElement('div');
  modeToggle.className = 'plane-style-toggle';
  modeToggle.style.marginBottom = '12px';
  modeToggle.innerHTML =
    '<button type="button" class="plane-style-btn' + (voiceChat.mode === 'ptt' ? ' active' : '') + '" data-mode="ptt">🎤 Aperte para Falar</button>' +
    '<button type="button" class="plane-style-btn' + (voiceChat.mode === 'open' ? ' active' : '') + '" data-mode="open">📡 Sempre Ligado</button>';
  modeToggle.querySelectorAll('.plane-style-btn').forEach(btn => {
    btn.addEventListener('click', () => { setVoiceChatMode(btn.dataset.mode); renderAudioSettingsModal(); });
  });
  body.appendChild(modeToggle);

  // ----- rebind tecla (PTT) -----
  const keyRow = document.createElement('div');
  keyRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.08);';
  const keyLabel = document.createElement('span');
  keyLabel.style.fontSize = '13px';
  keyLabel.textContent = voiceChat.mode === 'ptt' ? 'Tecla (segurar p/ falar)' : 'Tecla (alternar mudo)';
  const keyBtn = document.createElement('button');
  keyBtn.className = 'btn-secondary';
  keyBtn.style.cssText = 'padding:4px 12px;font-size:12px;min-width:90px;';
  keyBtn.textContent = keybinds.voicePTT.replace('Key', '').replace('Digit', '');
  keyBtn.addEventListener('click', () => {
    keyBtn.textContent = '...';
    const handler = (e) => {
      e.preventDefault();
      keybinds.voicePTT = e.code;
      keyBtn.textContent = e.code.replace('Key', '').replace('Digit', '');
      window.removeEventListener('keydown', handler, true);
    };
    window.addEventListener('keydown', handler, true);
  });
  keyRow.appendChild(keyLabel); keyRow.appendChild(keyBtn);
  body.appendChild(keyRow);

  // ----- rebind botão do gamepad -----
  const gpRow = document.createElement('div');
  gpRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 0;margin-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.08);';
  const gpLabel = document.createElement('span');
  gpLabel.style.fontSize = '13px';
  gpLabel.textContent = 'Botão do Controle';
  const gpBtn = document.createElement('button');
  gpBtn.className = 'btn-secondary';
  gpBtn.style.cssText = 'padding:4px 12px;font-size:12px;min-width:90px;';
  gpBtn.textContent = (typeof GAMEPAD_BUTTON_LABELS !== 'undefined' && GAMEPAD_BUTTON_LABELS[gamepadBinds.mic]) || '?';
  gpBtn.addEventListener('click', () => {
    gpBtn.textContent = '...';
    const captureStart = performance.now();
    const poll = setInterval(() => {
      const gp = (typeof getActiveGamepad === 'function') ? getActiveGamepad() : null;
      if (!gp) { if (performance.now() - captureStart > 8000) { clearInterval(poll); gpBtn.textContent = GAMEPAD_BUTTON_LABELS[gamepadBinds.mic]; } return; }
      for (let i = 0; i < gp.buttons.length; i++) {
        if (gp.buttons[i].pressed) {
          gamepadBinds.mic = i;
          gpBtn.textContent = GAMEPAD_BUTTON_LABELS[i] || ('#' + i);
          clearInterval(poll);
          return;
        }
      }
      if (performance.now() - captureStart > 8000) { clearInterval(poll); gpBtn.textContent = GAMEPAD_BUTTON_LABELS[gamepadBinds.mic]; }
    }, 50);
  });
  gpRow.appendChild(gpLabel); gpRow.appendChild(gpBtn);
  body.appendChild(gpRow);

  // ----- lista de participantes (volume / mutar individualmente) -----
  const listLabel = document.createElement('div');
  listLabel.className = 'setup-group-label';
  listLabel.textContent = 'Participantes (' + (voiceChat.peers.size + (voiceChat.enabled ? 1 : 0)) + '/6)';
  body.appendChild(listLabel);

  const list = document.createElement('div');
  list.style.cssText = 'display:flex;flex-direction:column;gap:6px;max-height:200px;overflow-y:auto;';

  if (voiceChat.enabled) {
    const meRow = document.createElement('div');
    meRow.className = 'lobby-player';
    meRow.innerHTML = '<span class="dot" style="background:' + voiceChat.myColor + ';"></span>' +
      '<span class="name">' + voiceChat.myName + ' (você)</span>' +
      '<span style="font-size:11px;color:var(--text-mute);">' + (voiceChat.micOn ? '🎤 ativo' : '🔇 mudo') + '</span>';
    list.appendChild(meRow);
  }

  voiceChat.peers.forEach((peer, id) => {
    const row = document.createElement('div');
    row.className = 'lobby-player';
    row.style.flexWrap = 'wrap';
    const muteBtn = document.createElement('button');
    muteBtn.className = 'btn-secondary';
    muteBtn.style.cssText = 'padding:3px 8px;font-size:11px;';
    muteBtn.textContent = peer.locallyMuted ? '🔇' : '🔊';
    muteBtn.addEventListener('click', () => {
      peer.locallyMuted = !peer.locallyMuted;
      if (peer.audioEl) peer.audioEl.volume = peer.locallyMuted ? 0 : peer.volume;
      muteBtn.textContent = peer.locallyMuted ? '🔇' : '🔊';
    });
    const vol = document.createElement('input');
    vol.type = 'range'; vol.min = '0'; vol.max = '100'; vol.value = String(Math.round(peer.volume * 100));
    vol.style.cssText = 'width:70px;';
    vol.addEventListener('input', () => {
      peer.volume = vol.value / 100;
      if (peer.audioEl && !peer.locallyMuted) peer.audioEl.volume = peer.volume;
    });
    row.innerHTML = '<span class="dot" style="background:' + peer.color + ';"></span>' +
      '<span class="name">' + peer.name + (peer.muted ? ' 🔇' : '') + '</span>';
    row.appendChild(vol);
    row.appendChild(muteBtn);
    list.appendChild(row);
  });

  if (!voiceChat.enabled && voiceChat.peers.size === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'text-align:center;color:var(--text-mute);opacity:0.5;font-size:12px;padding:10px;';
    empty.textContent = 'Você não está no chat de voz.';
    list.appendChild(empty);
  }

  body.appendChild(list);
}