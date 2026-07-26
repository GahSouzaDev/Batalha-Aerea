// text-chat.js
// ================================================================
//  CHAT DE TEXTO DO LOBBY — pra quem não tem microfone (ou não quer
//  usar) ainda conseguir se comunicar enquanto escolhe avião/time.
//  Uma caixinha fixa no canto da tela, visível só enquanto o lobby
//  estiver aberto, e um "balão" flutuante temporário perto do avatar
//  de quem mandou a mensagem (se essa pessoa estiver no chat de voz).
// ================================================================

const textChatState = {
  messages: [],   // { id, name, color, text, ts }
  visible: false,
};

let chatBoxEl = null;
let chatLogEl = null;
let chatInputEl = null;
let chatVisibilityTimer = null;

function ensureChatBox() {
  if (chatBoxEl) return chatBoxEl;
  chatBoxEl = document.createElement('div');
  chatBoxEl.id = 'lobby-chat-box';
  chatBoxEl.className = 'hidden';
  chatBoxEl.innerHTML =
    '<div id="lobby-chat-log"></div>' +
    '<div id="lobby-chat-input-row">' +
      '<input type="text" id="lobby-chat-input" maxlength="200" placeholder="Digite uma mensagem...">' +
      '<button id="lobby-chat-send">➤</button>' +
    '</div>';
  // CORREÇÃO: antes ia sempre pro document.body (caixinha flutuante fixa
  // no canto da tela). Agora, se existir o "encaixe" no cabeçalho da
  // sala (do lado da logo, abaixo do botão VER AVIÃO — tem espaço
  // sobrando ali), a caixa nasce dentro dele, embutida no layout. Some
  // pro body como fallback só se o encaixe não existir por algum motivo.
  const slot = document.getElementById('lobby-chat-slot');
  (slot || document.body).appendChild(chatBoxEl);
  chatLogEl = chatBoxEl.querySelector('#lobby-chat-log');
  chatInputEl = chatBoxEl.querySelector('#lobby-chat-input');
  const sendBtn = chatBoxEl.querySelector('#lobby-chat-send');

  function send() {
    const text = chatInputEl.value.trim();
    if (!text || !onlineState.socket) return;
    onlineState.socket.emit('lobby-chat', { text });
    chatInputEl.value = '';
  }
  sendBtn.addEventListener('click', send);
  chatInputEl.addEventListener('keydown', (e) => {
    e.stopPropagation(); // não deixa a tecla "vazar" pros controles do jogo
    if (e.key === 'Enter') send();
  });
  chatInputEl.addEventListener('keyup', (e) => e.stopPropagation());

  return chatBoxEl;
}

function bindTextChatSocketEvents() {
  if (!onlineState.socket) return;
  onlineState.socket.on('lobby-chat', (msg) => {
    textChatState.messages.push(msg);
    if (textChatState.messages.length > 100) textChatState.messages.shift();
    appendChatLogRow(msg);
    showFloatingBubble(msg);
  });
}

function appendChatLogRow(msg) {
  ensureChatBox();
  const row = document.createElement('div');
  row.className = 'lobby-chat-row';
  const isMe = onlineState.socket && msg.id === onlineState.socket.id;
  row.innerHTML = '<span class="lobby-chat-dot" style="background:' + (msg.color || '#00e5ff') + ';"></span>' +
    '<span class="lobby-chat-name">' + (isMe ? 'Você' : escapeHtml(msg.name || 'Piloto')) + ':</span> ' +
    '<span class="lobby-chat-text"></span>';
  row.querySelector('.lobby-chat-text').textContent = msg.text;
  chatLogEl.appendChild(row);
  chatLogEl.scrollTop = chatLogEl.scrollHeight;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// Balãozinho flutuante de ~4s perto do avatar de quem falou, no painel
// de voz (#voice-panel). Se a pessoa não estiver no chat de voz (ou o
// painel não existir ainda), a mensagem some silenciosamente daqui —
// ela já apareceu no log da caixinha de texto de qualquer forma.
function showFloatingBubble(msg) {
  const panel = document.getElementById('voice-panel');
  if (!panel) return;
  const isMe = onlineState.socket && msg.id === onlineState.socket.id;
  const target = isMe
    ? panel.querySelector('[data-peer-id="self"]')
    : panel.querySelector('[data-peer-id="' + CSS.escape(msg.id) + '"]');
  if (!target) return;

  const bubble = document.createElement('div');
  bubble.className = 'voice-chat-bubble';
  bubble.textContent = msg.text.length > 60 ? (msg.text.slice(0, 60) + '…') : msg.text;
  target.appendChild(bubble);
  requestAnimationFrame(() => bubble.classList.add('show'));
  setTimeout(() => {
    bubble.classList.remove('show');
    setTimeout(() => bubble.remove(), 250);
  }, 4200);
}

function updateLobbyChatVisibility() {
  const lobby = document.getElementById('lobby-overlay');
  const shouldShow = !!(lobby && !lobby.classList.contains('hidden') && onlineState.socket);
  if (shouldShow === textChatState.visible) return;
  textChatState.visible = shouldShow;
  ensureChatBox().classList.toggle('hidden', !shouldShow);
}
if (!chatVisibilityTimer) chatVisibilityTimer = setInterval(updateLobbyChatVisibility, 350);

// Chamado toda vez que entramos numa sala online (join-room/create-room/
// join-free-room) — liga os listeners do socket atual (é sempre uma
// conexão nova).
function textChatOnConnect() {
  bindTextChatSocketEvents();
}

// Chamado ao sair da sala/partida (voltar pro menu etc.) — limpa o
// histórico e some com a caixinha.
function textChatReset() {
  textChatState.messages = [];
  if (chatLogEl) chatLogEl.innerHTML = '';
  if (chatBoxEl) chatBoxEl.classList.add('hidden');
  textChatState.visible = false;
}