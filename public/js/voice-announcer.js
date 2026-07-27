// ================================================================
//  voice-announcer.js — NARRADOR POR VOZ (Web Speech API / SpeechSynthesis)
// ================================================================
//  Usa o sintetizador de voz do próprio navegador (window.speechSynthesis
//  — no Chrome/Edge isso é a engine de voz do Google) pra falar em voz
//  alta 3 tipos de evento:
//    1) "Preparar para decolagem!"  -> quando a partida começa (match-begin)
//    2) "Combate liberado!"         -> quando o tempo de preparo acaba
//    3) "Fulano abateu Sicrano!"    -> quando alguém é abatido, usando o
//                                       NOME que cada jogador colocou no menu
//
//  IMPORTANTE sobre multiplayer: o servidor já manda 'combat-enabled',
//  'match-begin' e 'player-killed' pra SALA INTEIRA (io.to(room.id).emit).
//  Isso significa que, se cada cliente falar esses eventos localmente ao
//  recebê-los (o que é exatamente o que este arquivo faz, plugado em
//  multiplayer.js), TODO MUNDO na sala ouve o mesmo anúncio no momento
//  certo — não é um áudio "só seu", é o efeito de um narrador de partida.
//  Cada jogador roda a fala no PRÓPRIO navegador (não existe um único
//  áudio compartilhado entre clientes — não dá pra "transmitir" fala já
//  sintetizada por socket sem gravar/mandar áudio —, mas como o gatilho
//  chega igual pra todos ao mesmo tempo, o efeito final é o mesmo).
// ================================================================

const VOICE_ANNOUNCER_STORAGE_KEY = 'voiceAnnouncerEnabled';
let voiceAnnouncerEnabled = (typeof localStorage !== 'undefined'
  && localStorage.getItem(VOICE_ANNOUNCER_STORAGE_KEY) === '0') ? false : true;

let voiceAnnouncerVoice = null;
let voiceAnnouncerQueue = [];
let voiceAnnouncerSpeaking = false;
const VOICE_ANNOUNCER_MAX_QUEUE = 5;

function _pickAnnouncerVoice() {
  if (!('speechSynthesis' in window)) return;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return;
  voiceAnnouncerVoice =
    voices.find(v => v.lang === 'pt-BR') ||
    voices.find(v => v.lang && v.lang.toLowerCase().startsWith('pt')) ||
    voices.find(v => v.default) ||
    voices[0];
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  _pickAnnouncerVoice();
  window.speechSynthesis.addEventListener('voiceschanged', _pickAnnouncerVoice);

  // Política de autoplay: em vários navegadores a primeira fala só sai
  // depois de alguma interação do usuário. "Aquecemos" o synth num
  // utterance mudo no primeiro clique/tecla, igual já é feito com o
  // AudioContext em sound.js.
  const _unlockSpeech = () => {
    try {
      const warm = new SpeechSynthesisUtterance(' ');
      warm.volume = 0;
      window.speechSynthesis.speak(warm);
    } catch (e) { /* ignore */ }
  };
  window.addEventListener('click', _unlockSpeech, { once: true });
  window.addEventListener('keydown', _unlockSpeech, { once: true });
}

// Liga/desliga o narrador (persiste a escolha no navegador do jogador).
function setVoiceAnnouncerEnabled(on) {
  voiceAnnouncerEnabled = !!on;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(VOICE_ANNOUNCER_STORAGE_KEY, voiceAnnouncerEnabled ? '1' : '0');
  }
  if (!voiceAnnouncerEnabled && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    voiceAnnouncerQueue = [];
    voiceAnnouncerSpeaking = false;
  }
}
function isVoiceAnnouncerEnabled() { return voiceAnnouncerEnabled; }

// PEDIDO: parar o narrador na hora (ex: voltando pro menu principal),
// sem mexer na preferência ligado/desligado do jogador (isso é o que
// diferencia essa função de setVoiceAnnouncerEnabled(false) — aqui é só
// "cala a boca agora", a preferência salva continua a mesma pra próxima
// partida).
function stopVoiceAnnouncer() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  voiceAnnouncerQueue = [];
  voiceAnnouncerSpeaking = false;
}
window.stopVoiceAnnouncer = stopVoiceAnnouncer;

function _processAnnouncerQueue() {
  if (voiceAnnouncerSpeaking) return;
  const next = voiceAnnouncerQueue.shift();
  if (!next) return;
  if (!('speechSynthesis' in window)) return;
  voiceAnnouncerSpeaking = true;
  const utter = new SpeechSynthesisUtterance(next);
  if (voiceAnnouncerVoice) utter.voice = voiceAnnouncerVoice;
  utter.lang = (voiceAnnouncerVoice && voiceAnnouncerVoice.lang) || 'pt-BR';
  utter.rate = 1.05;
  utter.pitch = 1.0;
  utter.volume = 0.65;
  const done = () => { voiceAnnouncerSpeaking = false; _processAnnouncerQueue(); };
  utter.onend = done;
  utter.onerror = done;
  window.speechSynthesis.speak(utter);
}

// dropIfBusy: usado pra avisos de fase (decolagem/combate) — se já tem
// bastante coisa na fila (vários abates seguidos, por ex.), não empilha
// mais um "combate liberado" atrasado que não faz mais sentido.
function voiceAnnounce(text, dropIfBusy) {
  if (!text || !voiceAnnouncerEnabled) return;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (dropIfBusy && voiceAnnouncerQueue.length > 1) return;
  voiceAnnouncerQueue.push(text);
  if (voiceAnnouncerQueue.length > VOICE_ANNOUNCER_MAX_QUEUE) voiceAnnouncerQueue.shift();
  _processAnnouncerQueue();
}

function _localPlayerName() {
  const el = document.getElementById('menu-name');
  return (el && el.value && el.value.trim()) || 'Piloto';
}

function announceTakeoff() {
  voiceAnnounce('Preparar para decolagem!', true);
}

function announceCombatStart() {
  voiceAnnounce('Combate liberado!', true);
}

// killerName pode vir null/undefined (ex: morte por colisão/queda, sem
// abatedor) — nesse caso falamos só que o alvo caiu em combate.
function announceKill(killerName, targetName) {
  const target = (targetName && String(targetName).trim()) || 'Alguém';
  const killer = killerName && String(killerName).trim();
  if (!killer || killer === target) {
    voiceAnnounce(target + ' explodiu!');
  } else {
    voiceAnnounce(killer + ' abateu ' + target + '!');
  }
}