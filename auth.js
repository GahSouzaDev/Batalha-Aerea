// auth.js — sistema de contas do Batalha Aérea
// ================================================================
//  Seguindo o MESMO padrão já usado e testado no seu outro projeto
//  (FluxPRO/server.js): sqlite3 + bcryptjs + jsonwebtoken + dotenv +
//  express-rate-limit no login. Módulo separado só pra não inchar
//  ainda mais o server.js principal do jogo.
//
//  DEPENDÊNCIAS NOVAS — instale na pasta do projeto do jogo:
//
//      npm install sqlite3 bcryptjs jsonwebtoken dotenv express-rate-limit
//
//  CONFIGURAÇÃO — crie um arquivo `.env` na raiz do projeto do jogo
//  (do lado do server.js), igual o FluxPRO já usa, com:
//
//      JWT_SECRET=escolha-uma-frase-longa-e-aleatoria-aqui
//
//  Sem isso, o token não teria como ser assinado com segurança — é
//  exatamente a mesma exigência que o FluxPRO já faz.
//
//  BANCO: cria sozinho a pasta `database/` e o arquivo
//  `database/batalha.db` na primeira vez que o servidor subir — não
//  precisa instalar MySQL/Postgres nem nada externo.
// ================================================================

require("dotenv").config();
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET não definido! Defina no arquivo .env (mesmo esquema do FluxPRO).");
}
const JWT_SECRET = process.env.JWT_SECRET || "troque-isto-no-.env-antes-de-ir-pra-producao";
const TOKEN_EXPIRES_IN = "30d"; // jogo = fica logado por bastante tempo (diferente do FluxPRO, que é por turno de trabalho)

// ==================== BANCO DE DADOS ====================
const dbDir = path.join(__dirname, "database");
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
const db = new sqlite3.Database(path.join(dbDir, "batalha.db"));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nickname TEXT UNIQUE NOT NULL,
        nickname_lower TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  // PEDIDO: salvar progresso/estatísticas do jogador fica pra uma etapa
  // futura — quando chegar a hora, dá pra criar uma tabela nova (ex:
  // `player_stats`) referenciando `users.id`, sem mexer em nada disto
  // aqui.
});

// ==================== RATE LIMIT (mesmo esquema do FluxPRO) ====================
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Muitas tentativas de login. Tente novamente em 15 minutos." },
  keyGenerator: (req) => {
    const nickname = req.body?.nickname || "anonymous";
    const ipKey = ipKeyGenerator(req);
    return `login_${nickname}_${ipKey}`;
  },
  skip: (req) => !req.body?.nickname,
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  message: { error: "Muitas contas criadas a partir deste IP. Tente novamente mais tarde." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ==================== VALIDAÇÃO ====================
// Nickname: usado tanto pra LOGIN quanto como nome exibido no jogo —
// por isso é restrito (sem espaço, sem emoji, sem HTML) e com tamanho
// limitado, pra não ter "engraçadinho" colocando nome gigante/estranho.
const NICKNAME_MIN = 3;
const NICKNAME_MAX = 16;
const NICKNAME_RE = /^[A-Za-z0-9_]+$/;

const DISPLAY_NAME_MIN = 2;
const DISPLAY_NAME_MAX = 24;

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;
const PASSWORD_HAS_LETTER = /[A-Za-zÀ-ÖØ-öø-ÿ]/;
const PASSWORD_HAS_NUMBER = /\d/;
const PASSWORD_HAS_SYMBOL = /[^A-Za-zÀ-ÖØ-öø-ÿ0-9]/;

function validateNickname(nickname) {
  const errors = [];
  const n = (nickname || "").trim();
  if (n.length < NICKNAME_MIN || n.length > NICKNAME_MAX) {
    errors.push(`Nickname precisa ter entre ${NICKNAME_MIN} e ${NICKNAME_MAX} caracteres.`);
  } else if (!NICKNAME_RE.test(n)) {
    errors.push('Nickname só pode ter letras, números e "_", sem espaço ou acento.');
  }
  return errors;
}

function validateDisplayName(displayName) {
  const errors = [];
  const n = (displayName || "").trim();
  if (n.length < DISPLAY_NAME_MIN || n.length > DISPLAY_NAME_MAX) {
    errors.push(`Nome precisa ter entre ${DISPLAY_NAME_MIN} e ${DISPLAY_NAME_MAX} caracteres.`);
  } else if (/[<>]/.test(n)) {
    errors.push("Nome não pode conter os caracteres < ou >.");
  }
  return errors;
}

function validatePassword(password, confirmPassword) {
  const errors = [];
  const p = password || "";
  if (p.length < PASSWORD_MIN || p.length > PASSWORD_MAX) {
    errors.push(`Senha precisa ter entre ${PASSWORD_MIN} e ${PASSWORD_MAX} caracteres.`);
  } else {
    if (!PASSWORD_HAS_LETTER.test(p)) errors.push("Senha precisa ter pelo menos uma letra.");
    if (!PASSWORD_HAS_NUMBER.test(p)) errors.push("Senha precisa ter pelo menos um número.");
    if (!PASSWORD_HAS_SYMBOL.test(p)) errors.push("Senha precisa ter pelo menos um caractere especial (ex: ! @ # $ %).");
  }
  if (confirmPassword !== undefined && p !== confirmPassword) {
    errors.push("As senhas digitadas não são iguais.");
  }
  return errors;
}

function validateRegistration({ displayName, nickname, password, confirmPassword }) {
  return [
    ...validateDisplayName(displayName),
    ...validateNickname(nickname),
    ...validatePassword(password, confirmPassword),
  ];
}

// ==================== MIDDLEWARE (mesmo padrão do FluxPRO) ====================
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return res.status(401).json({ error: "Token não fornecido" });
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
};

// ==================== ROTAS (registradas pelo server.js principal) ====================
// Recebe `app` (a instância do Express já criada no server.js do jogo)
// e pendura as rotas nele — assim o server.js só precisa fazer
// `require('./auth').mount(app)` uma vez.
function mount(app) {
  app.post("/api/auth/register", registerLimiter, (req, res) => {
    const { displayName, nickname, password, confirmPassword } = req.body || {};
    const errors = validateRegistration({ displayName, nickname, password, confirmPassword });
    if (errors.length) return res.status(400).json({ error: errors[0], errors });

    const nicknameTrim = nickname.trim();
    const nicknameLower = nicknameTrim.toLowerCase();

    db.get("SELECT id FROM users WHERE nickname_lower = ?", [nicknameLower], (err, existing) => {
      if (err) return res.status(500).json({ error: "Erro interno ao verificar nickname." });
      if (existing) return res.status(409).json({ error: "Esse nickname já está em uso. Escolha outro." });

      const hash = bcrypt.hashSync(password, 10);
      db.run(
        "INSERT INTO users (nickname, nickname_lower, display_name, password_hash) VALUES (?, ?, ?, ?)",
        [nicknameTrim, nicknameLower, displayName.trim(), hash],
        function (err2) {
          if (err2) return res.status(500).json({ error: "Erro interno ao criar a conta." });

          const user = { id: this.lastID, nickname: nicknameTrim, displayName: displayName.trim() };
          const token = jwt.sign({ id: user.id, nickname: user.nickname }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN });
          res.json({ token, user });
        }
      );
    });
  });

  app.post("/api/auth/login", loginLimiter, (req, res) => {
    const { nickname, password } = req.body || {};
    if (!nickname || !password) return res.status(400).json({ error: "Preencha nickname e senha." });

    const nicknameLower = nickname.trim().toLowerCase();
    db.get("SELECT * FROM users WHERE nickname_lower = ?", [nicknameLower], (err, row) => {
      // Mensagem genérica de propósito — não diz se foi o nickname ou a
      // senha que errou (evita que o formulário vire uma forma de
      // descobrir quais nicknames já existem cadastrados).
      if (err || !row || !bcrypt.compareSync(password, row.password_hash)) {
        return res.status(401).json({ error: "Nickname ou senha incorretos." });
      }
      const user = { id: row.id, nickname: row.nickname, displayName: row.display_name };
      const token = jwt.sign({ id: user.id, nickname: user.nickname }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN });
      res.json({ token, user });
    });
  });

  app.get("/api/auth/me", authenticate, (req, res) => {
    db.get("SELECT id, nickname, display_name FROM users WHERE id = ?", [req.user.id], (err, row) => {
      if (err || !row) return res.status(401).json({ error: "Conta não encontrada." });
      res.json({ user: { id: row.id, nickname: row.nickname, displayName: row.display_name } });
    });
  });
}

module.exports = {
  mount, authenticate,
  validateRegistration, validateNickname, validateDisplayName, validatePassword,
};