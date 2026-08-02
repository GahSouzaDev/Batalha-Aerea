// auth-client.js — tela de escolha "sem login / entrar / criar conta"
// ================================================================
//  Roda ANTES de qualquer coisa aparecer: decide se mostra a tela de
//  login/cadastro, ou se já pula direto pro menu (token salvo válido),
//  ou se o jogador escolhe "jogar sem login" (comportamento de sempre).
//
//  Guarda o token em localStorage (não sessionStorage como o FluxPRO)
//  de propósito: aqui é um jogo, faz sentido continuar logado entre
//  visitas, diferente de um sistema de ponto/turno de trabalho.
// ================================================================

const AUTH_TOKEN_KEY = 'batalha_token';
const AUTH_USER_KEY = 'batalha_user';

const authState = {
  token: localStorage.getItem(AUTH_TOKEN_KEY),
  user: JSON.parse(localStorage.getItem(AUTH_USER_KEY) || 'null'),
};

function isLoggedIn() { return !!(authState.token && authState.user); }

function authSaveSession(token, user) {
  authState.token = token;
  authState.user = user;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

function authClearSession() {
  authState.token = null;
  authState.user = null;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

// Chamada única pro back-end, com o mesmo formato de erro em todo lugar
// ({ error: "..." }) — igual ao padrão que o FluxPRO já usa.
async function authFetch(url, options = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  if (authState.token) headers['Authorization'] = `Bearer ${authState.token}`;
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro inesperado. Tente novamente.');
  return data;
}

// ================================================================
//  LIBERAR O JOGO (esconde a tela de login/cadastro, mostra o menu)
// ================================================================
function authEnterGame() {
  const gate = document.getElementById('auth-gate-overlay');
  const menu = document.getElementById('main-menu');
  if (gate) gate.classList.add('hidden');
  if (menu) menu.classList.remove('hidden');

  if (isLoggedIn()) {
    const nameInput = document.getElementById('menu-name');
    if (nameInput) nameInput.value = authState.user.nickname;
    authShowLoggedInBadge();
  }
  // Avisa o resto do jogo (menu-camera.js/refreshMenuCollapseUI etc.)
  // que agora tem overlay de menu pra cuidar da câmera de prévia.
  if (typeof refreshMenuCollapseUI === 'function') refreshMenuCollapseUI();
}

// Pequeno indicador "Logado como X · Sair" logo abaixo do campo de nome
// — só aparece se estiver logado, criado na hora (não polui o HTML pra
// quem está jogando sem conta).
function authShowLoggedInBadge() {
  const nameInput = document.getElementById('menu-name');
  if (!nameInput || !nameInput.parentElement) return;
  let badge = document.getElementById('auth-logged-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'auth-logged-badge';
    badge.style.cssText = 'font-size:11px;color:#7fbfd6;margin-top:4px;display:flex;align-items:center;gap:6px;';
    nameInput.insertAdjacentElement('afterend', badge);
  }
  badge.innerHTML = `🔑 Logado como <b style="color:#4cff8b;">${authState.user.nickname}</b> · <a href="#" id="auth-logout-link" style="color:#ff6a6a;text-decoration:underline;">Sair</a>`;
  // Enquanto logado, o nome no jogo É o nickname da conta — trava o
  // campo pra não ficar inconsistente (se quiser jogar com outro nome,
  // é só sair da conta).
  nameInput.value = authState.user.nickname;
  nameInput.readOnly = true;
  const logoutLink = document.getElementById('auth-logout-link');
  if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      authClearSession();
      location.reload();
    });
  }
}

// ================================================================
//  NAVEGAÇÃO ENTRE AS 3 ETAPAS DA TELA (escolha / login / cadastro)
// ================================================================
function authShowStep(step) {
  ['choice', 'login', 'register'].forEach((s) => {
    const el = document.getElementById('auth-step-' + s);
    if (el) el.classList.toggle('hidden', s !== step);
  });
}

function authShowError(elId, message) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = message;
  el.style.display = message ? 'block' : 'none';
}

// ================================================================
//  VALIDAÇÃO NO CLIENTE (mesmas regras do servidor — feedback na hora,
//  sem precisar esperar a resposta do fetch pra avisar campo vazio/
//  errado; o servidor SEMPRE valida de novo, então não tem risco de
//  burlar isso mandando a requisição direto)
// ================================================================
function authValidateRegisterClientSide({ displayName, nickname, password, confirmPassword }) {
  if (!displayName || displayName.trim().length < 2) return 'Digite seu nome (mínimo 2 caracteres).';
  if (displayName.trim().length > 24) return 'Nome muito longo (máximo 24 caracteres).';
  if (!/^[A-Za-z0-9_]{3,16}$/.test(nickname || '')) return 'Nickname precisa ter 3-16 caracteres, só letras/números/"_", sem espaço.';
  if (!password || password.length < 8) return 'Senha precisa ter pelo menos 8 caracteres.';
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(password)) return 'Senha precisa ter pelo menos uma letra.';
  if (!/\d/.test(password)) return 'Senha precisa ter pelo menos um número.';
  if (!/[^A-Za-zÀ-ÖØ-öø-ÿ0-9]/.test(password)) return 'Senha precisa ter pelo menos um caractere especial (ex: ! @ # $).';
  if (password !== confirmPassword) return 'As senhas digitadas não são iguais.';
  return null;
}

// ================================================================
//  AÇÕES
// ================================================================
async function authDoLogin() {
  const nickname = document.getElementById('auth-login-nickname').value.trim();
  const password = document.getElementById('auth-login-password').value;
  const btn = document.getElementById('auth-btn-do-login');
  authShowError('auth-login-error', '');

  if (!nickname || !password) { authShowError('auth-login-error', 'Preencha nickname e senha.'); return; }

  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = 'ENTRANDO...';
  try {
    const data = await authFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ nickname, password }) });
    authSaveSession(data.token, data.user);
    authEnterGame();
  } catch (err) {
    authShowError('auth-login-error', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function authDoRegister() {
  const displayName = document.getElementById('auth-reg-name').value;
  const nickname = document.getElementById('auth-reg-nickname').value.trim();
  const password = document.getElementById('auth-reg-password').value;
  const confirmPassword = document.getElementById('auth-reg-confirm').value;
  const btn = document.getElementById('auth-btn-do-register');
  authShowError('auth-register-error', '');

  const clientError = authValidateRegisterClientSide({ displayName, nickname, password, confirmPassword });
  if (clientError) { authShowError('auth-register-error', clientError); return; }

  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = 'CRIANDO CONTA...';
  try {
    const data = await authFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ displayName, nickname, password, confirmPassword }),
    });
    authSaveSession(data.token, data.user);
    authEnterGame();
  } catch (err) {
    authShowError('auth-register-error', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// ================================================================
//  INICIALIZAÇÃO
// ================================================================
async function authInit() {
  // Já tem token salvo de uma visita anterior? Confirma com o servidor
  // antes de confiar nele (pode ter expirado, ou a conta pode ter sido
  // removida) — só então libera direto pro menu, sem passar pela tela
  // de escolha.
  if (authState.token) {
    try {
      const data = await authFetch('/api/auth/me');
      authState.user = data.user;
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
      authEnterGame();
      return;
    } catch (err) {
      authClearSession();
      // segue pro fluxo normal (mostra a tela de escolha)
    }
  }

  const btnGuest = document.getElementById('auth-btn-guest');
  const btnGoLogin = document.getElementById('auth-btn-go-login');
  const btnGoRegister = document.getElementById('auth-btn-go-register');
  const btnBack1 = document.getElementById('auth-btn-back-1');
  const btnBack2 = document.getElementById('auth-btn-back-2');
  const btnDoLogin = document.getElementById('auth-btn-do-login');
  const btnDoRegister = document.getElementById('auth-btn-do-register');

  if (btnGuest) btnGuest.addEventListener('click', authEnterGame);
  if (btnGoLogin) btnGoLogin.addEventListener('click', () => authShowStep('login'));
  if (btnGoRegister) btnGoRegister.addEventListener('click', () => authShowStep('register'));
  if (btnBack1) btnBack1.addEventListener('click', () => authShowStep('choice'));
  if (btnBack2) btnBack2.addEventListener('click', () => authShowStep('login'));
  if (btnDoLogin) btnDoLogin.addEventListener('click', authDoLogin);
  if (btnDoRegister) btnDoRegister.addEventListener('click', authDoRegister);

  // Enter dentro dos campos de senha já dispara o botão certo (mesmo
  // padrão de conveniência que o login.html do FluxPRO já usa).
  const loginPwd = document.getElementById('auth-login-password');
  if (loginPwd) loginPwd.addEventListener('keypress', (e) => { if (e.key === 'Enter') authDoLogin(); });
  const confirmPwd = document.getElementById('auth-reg-confirm');
  if (confirmPwd) confirmPwd.addEventListener('keypress', (e) => { if (e.key === 'Enter') authDoRegister(); });
}

document.addEventListener('DOMContentLoaded', authInit);