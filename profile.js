// profile.js — perfil persistente, carreira militar (patentes/medalhas/títulos)
// e ranking público. VERSÃO REFEITA DO ZERO — sem inconsistências:
//  • Chaves de medalha SEMPRE com hífen (igual aos arquivos de imagem e ao site).
//  • Exporta TODAS as funções que o server.js chama (recordMatchResults,
//    recordFirstBlood, unlockSecret etc.) — nada de "function not found".
//  • /api/profile/settings SEMPRE responde e salva selected_titles de verdade.
//  • /api/ranking devolve photoUrl + rankKey + titles (com nível real da medalha).
//
// DEPENDÊNCIA (já instalada): npm install multer
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db, authenticate } = require('./auth');
// PEDIDO: pra avisar o jogador NA HORA quando ele destrava um título (e pra
// entregar a "carteirinha" — foto, patente e títulos — de cada jogador que
// está numa sala, pros amigos/oponentes verem). accountSocketMap é o mesmo
// mapa userId -> socket.id atual que o friends.js já mantém.
const friendsModule = require('./friends');

// ==================== TABELAS + MIGRAÇÃO ====================
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS player_profile (
    user_id INTEGER PRIMARY KEY,
    preferred_plane TEXT DEFAULT 'cessna',
    sound_enabled INTEGER DEFAULT 1,
    music_enabled INTEGER DEFAULT 1,
    preferred_pilot INTEGER DEFAULT NULL,
    selected_titles TEXT DEFAULT NULL,
    photo_path TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS player_stats (
    user_id INTEGER PRIMARY KEY,
    matches_played INTEGER DEFAULT 0,
    kills INTEGER DEFAULT 0,
    deaths INTEGER DEFAULT 0,
    blimp_kills INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    mvps INTEGER DEFAULT 0,
    bomb_kills INTEGER DEFAULT 0,
    missile_kills INTEGER DEFAULT 0,
    login_days INTEGER DEFAULT 0,
    first_bloods INTEGER DEFAULT 0,
    last_survivals INTEGER DEFAULT 0,
    damage_taken INTEGER DEFAULT 0,
    best_alive_seconds INTEGER DEFAULT 0,
    playtime_seconds INTEGER DEFAULT 0,
    last_login_date TEXT DEFAULT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS player_medals (
    user_id INTEGER NOT NULL,
    medal_key TEXT NOT NULL,
    level INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, medal_key),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  // Migração tolerante pra bancos criados por versões antigas
  [
    'ALTER TABLE player_profile ADD COLUMN preferred_pilot INTEGER',
    'ALTER TABLE player_profile ADD COLUMN selected_titles TEXT',
    'ALTER TABLE player_stats ADD COLUMN wins INTEGER DEFAULT 0',
    'ALTER TABLE player_stats ADD COLUMN mvps INTEGER DEFAULT 0',
    'ALTER TABLE player_stats ADD COLUMN bomb_kills INTEGER DEFAULT 0',
    'ALTER TABLE player_stats ADD COLUMN missile_kills INTEGER DEFAULT 0',
    'ALTER TABLE player_stats ADD COLUMN login_days INTEGER DEFAULT 0',
    'ALTER TABLE player_stats ADD COLUMN first_bloods INTEGER DEFAULT 0',
    'ALTER TABLE player_stats ADD COLUMN last_survivals INTEGER DEFAULT 0',
    'ALTER TABLE player_stats ADD COLUMN damage_taken INTEGER DEFAULT 0',
    'ALTER TABLE player_stats ADD COLUMN best_alive_seconds INTEGER DEFAULT 0',
    'ALTER TABLE player_stats ADD COLUMN last_login_date TEXT',
  ].forEach(sql => db.run(sql, () => {})); // erro "coluna já existe" é ignorado
});

// ==================== PATENTES ====================
const RANKS = [
  { k: 's2', n: 'Soldado de Segunda Classe (S2)', q: 0 },
  { k: 's1', n: 'Soldado de Primeira Classe (S1)', q: 25 },
  { k: 'cabo', n: 'Cabo', q: 75 },
  { k: '3s', n: 'Terceiro-Sargento', q: 150 },
  { k: '2s', n: 'Segundo-Sargento', q: 300 },
  { k: '1s', n: 'Primeiro-Sargento', q: 500 },
  { k: 'sub', n: 'Suboficial', q: 750 },
  { k: 'asp', n: 'Aspirante a Oficial', q: 1000 },
  { k: '2t', n: 'Segundo-Tenente', q: 1400 },
  { k: '1t', n: 'Primeiro-Tenente', q: 1900 },
  { k: 'cap', n: 'Capitão', q: 2500 },
  { k: 'maj', n: 'Major', q: 3200 },
  { k: 'tc', n: 'Tenente-Coronel', q: 4000 },
  { k: 'cel', n: 'Coronel', q: 5000 },
  { k: 'brig', n: 'Brigadeiro', q: 6500 },
  { k: 'mbrig', n: 'Major-Brigadeiro', q: 8000 },
  { k: 'tbrig', n: 'Tenente-Brigadeiro', q: 10000 },
];
function rankForKills(kills) {
  let cur = RANKS[0];
  for (const r of RANKS) if ((kills || 0) >= r.q) cur = r;
  return cur;
}

// Chaves SECRETAS aceitas pelo report do cliente (Tiro Perfeito etc.)
const SECRET_MEDALS = ['fenix', 'kamikaze', 'tiro-perfeito', 'cacador-relampago', 'dominio-aereo', 'lenda-da-batalha-aerea'];

function ensureProfileRow(userId, cb) { db.run('INSERT OR IGNORE INTO player_profile (user_id) VALUES (?)', [userId], (err) => cb && cb(err)); }
function ensureStatsRow(userId, cb) { db.run('INSERT OR IGNORE INTO player_stats (user_id) VALUES (?)', [userId], (err) => cb && cb(err)); }

// ==================== FOTO DE PERFIL ====================
const AVATAR_DIR = path.join(__dirname, 'public', 'uploads', 'avatars');
if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATAR_DIR),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
    cb(null, `user_${req.user.id}_${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!ok.includes(file.mimetype)) return cb(new Error('Formato de imagem não aceito (use JPG, PNG, WEBP ou GIF).'));
    cb(null, true);
  },
});

// ==================== ROTAS ====================
function mount(app) {

  // ---- Perfil completo (config + foto + stats + patente + medalhas) ----
  app.get('/api/profile/me', authenticate, (req, res) => {
    ensureProfileRow(req.user.id, () => {
      ensureStatsRow(req.user.id, () => {
        touchLoginDay(req.user.id, () => {
          db.get('SELECT * FROM player_profile WHERE user_id = ?', [req.user.id], (err, profile) => {
            if (err) return res.status(500).json({ error: 'Erro ao carregar perfil.' });
            db.get('SELECT * FROM player_stats WHERE user_id = ?', [req.user.id], (err2, stats) => {
              if (err2) return res.status(500).json({ error: 'Erro ao carregar estatísticas.' });
              db.all('SELECT medal_key, level FROM player_medals WHERE user_id = ? AND level > 0', [req.user.id], (err3, medals) => {
                if (err3) return res.status(500).json({ error: 'Erro ao carregar medalhas.' });
                const kills = (stats && stats.kills) || 0;
                const rk = rankForKills(kills);
                const idx = RANKS.indexOf(rk);
                const next = RANKS[idx + 1] || null;
                let selectedTitles = [];
                try { selectedTitles = JSON.parse((profile && profile.selected_titles) || '[]'); } catch (e) { selectedTitles = []; }
                res.json({
                  profile: {
                    preferredPlane: profile.preferred_plane,
                    soundEnabled: !!profile.sound_enabled,
                    musicEnabled: !!profile.music_enabled,
                    preferredPilot: profile.preferred_pilot || null,
                    selectedTitles: Array.isArray(selectedTitles) ? selectedTitles : [],
                    photoUrl: profile.photo_path ? `/uploads/avatars/${profile.photo_path}` : null,
                  },
                  stats: {
                    matches_played: stats.matches_played || 0, kills: stats.kills || 0,
                    deaths: stats.deaths || 0, blimp_kills: stats.blimp_kills || 0,
                    playtime_seconds: stats.playtime_seconds || 0, wins: stats.wins || 0,
                    mvps: stats.mvps || 0, bomb_kills: stats.bomb_kills || 0,
                    missile_kills: stats.missile_kills || 0, login_days: stats.login_days || 0,
                  },
                  rank: { index: idx, key: rk.k, name: rk.n, current: kills, next: next ? { name: next.n, at: next.q } : null },
                  medals: medals || [],
                });
              });
            });
          });
        });
      });
    });
  });

  // ---- Salvar configurações (inclui TÍTULOS) — SEMPRE responde ----
  app.post('/api/profile/settings', authenticate, (req, res) => {
    const { preferredPlane, soundEnabled, musicEnabled, preferredPilot, selectedTitles } = req.body || {};
    ensureProfileRow(req.user.id, () => {
      const apply = (titlesJson) => {
        db.run(
          `UPDATE player_profile SET
            preferred_plane = COALESCE(?, preferred_plane),
            sound_enabled = COALESCE(?, sound_enabled),
            music_enabled = COALESCE(?, music_enabled),
            preferred_pilot = COALESCE(?, preferred_pilot),
            selected_titles = COALESCE(?, selected_titles),
            updated_at = CURRENT_TIMESTAMP
           WHERE user_id = ?`,
          [
            preferredPlane || null,
            soundEnabled === undefined ? null : (soundEnabled ? 1 : 0),
            musicEnabled === undefined ? null : (musicEnabled ? 1 : 0),
            (preferredPilot === undefined || preferredPilot === null) ? null : Math.min(16, Math.max(1, parseInt(preferredPilot, 10) || 1)),
            titlesJson,
            req.user.id,
          ],
          (err) => {
            if (err) return res.status(500).json({ error: 'Erro ao salvar configurações.' });
            res.json({ ok: true });
          }
        );
      };
      if (selectedTitles !== undefined) {
        // Normaliza pra hífen (padrão do banco/imagens) e limita a 3
        const list = (Array.isArray(selectedTitles) ? selectedTitles : [])
          .filter(k => typeof k === 'string')
          .map(k => k.replace(/_/g, '-'))
          .slice(0, 3);
        db.all('SELECT medal_key FROM player_medals WHERE user_id = ? AND level > 0', [req.user.id], (err, rows) => {
          if (err) return apply(JSON.stringify(list)); // falhou checagem? salva assim mesmo
          const owned = new Set((rows || []).map(r => r.medal_key));
          apply(JSON.stringify(list.filter(k => owned.has(k))));
        });
      } else {
        apply(null);
      }
    });
  });

  // ---- Upload de foto ----
  app.post('/api/profile/photo', authenticate, (req, res) => {
    upload.single('photo')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      if (!req.file) return res.status(400).json({ error: 'Nenhuma imagem enviada.' });
      ensureProfileRow(req.user.id, () => {
        db.get('SELECT photo_path FROM player_profile WHERE user_id = ?', [req.user.id], (err2, row) => {
          const oldFileName = row && row.photo_path;
          db.run('UPDATE player_profile SET photo_path = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [req.file.filename, req.user.id], (err3) => {
            if (err3) return res.status(500).json({ error: 'Erro ao salvar a foto.' });
            if (oldFileName && oldFileName !== req.file.filename) fs.unlink(path.join(AVATAR_DIR, oldFileName), () => {});
            res.json({ ok: true, photoUrl: `/uploads/avatars/${req.file.filename}` });
          });
        });
      });
    });
  });

  // ---- Ranking público (site + Central do Piloto) ----
  app.get('/api/ranking', (req, res) => {
    getLeaderboard((err, leaderboard) => {
      if (err) return res.status(500).json({ error: 'Erro ao carregar ranking.' });
      getTitles((err2, titles) => {
        if (err2) return res.status(500).json({ error: 'Erro ao carregar títulos.' });
        res.json({ leaderboard, titles });
      });
    });
  });
}

// ==================== ESTATÍSTICAS ====================
function _bump(userId, sql, params, thenEvaluate) {
  ensureStatsRow(userId, () => {
    db.run(sql, params, () => { if (thenEvaluate !== false) evaluateMedals(userId); });
  });
}
function recordKill(userId, weaponType) {
  if (!userId) return;
  const extraBomb = (weaponType === 'bomb' || weaponType === 'overdrive') ? ', bomb_kills = bomb_kills + 1' : '';
  const extraMissile = (weaponType === 'missile') ? ', missile_kills = missile_kills + 1' : '';
  _bump(userId, `UPDATE player_stats SET kills = kills + 1${extraBomb}${extraMissile}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, [userId]);
}
function recordDeath(userId, dmgTaken, aliveSec) {
  if (!userId) return;
  ensureStatsRow(userId, () => {
    db.run(
      `UPDATE player_stats SET deaths = deaths + 1,
        damage_taken = damage_taken + ?,
        best_alive_seconds = MAX(best_alive_seconds, ?),
        updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
      [Math.max(0, Math.round(dmgTaken || 0)), Math.max(0, Math.round(aliveSec || 0)), userId],
      () => evaluateMedals(userId)
    );
  });
}
function recordBlimpKill(userId) { if (userId) _bump(userId, 'UPDATE player_stats SET blimp_kills = blimp_kills + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [userId]); }
function recordMatchPlayed(userId, playtimeSeconds) { if (userId) _bump(userId, 'UPDATE player_stats SET matches_played = matches_played + 1, playtime_seconds = playtime_seconds + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [Math.max(0, Math.round(playtimeSeconds || 0))]); }
function recordWin(userId) { if (userId) _bump(userId, 'UPDATE player_stats SET wins = wins + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [userId]); }
function recordMvp(userId) { if (userId) _bump(userId, 'UPDATE player_stats SET mvps = mvps + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [userId]); }
function recordBombKill(userId) { if (userId) _bump(userId, 'UPDATE player_stats SET bomb_kills = bomb_kills + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [userId]); }
function recordMissileKill(userId) { if (userId) _bump(userId, 'UPDATE player_stats SET missile_kills = missile_kills + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [userId]); }
function recordLoginDay(userId) { if (userId) touchLoginDay(userId); }
function recordFirstBlood(userId) { if (userId) _bump(userId, 'UPDATE player_stats SET first_bloods = first_bloods + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [userId]); }

// Chamado pelo server.js no fim de partida (endMatch)
function recordMatchResults(userId, r) {
  if (!userId || !r) return;
  ensureStatsRow(userId, () => {
    db.run(
      `UPDATE player_stats SET
        matches_played = matches_played + 1,
        playtime_seconds = playtime_seconds + ?,
        wins = wins + ?,
        mvps = mvps + ?,
        last_survivals = last_survivals + ?,
        best_alive_seconds = MAX(best_alive_seconds, ?),
        updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
      [
        Math.max(0, Math.round(r.playtimeSeconds || 0)),
        r.win ? 1 : 0,
        r.mvp ? 1 : 0,
        r.lastSurvivor ? 1 : 0,
        Math.max(0, Math.round(r.aliveSeconds || 0)),
        userId,
      ],
      () => evaluateMedals(userId)
    );
  });
}

// Medalha secreta reportada pelo cliente (ex: Tiro Perfeito)
function unlockSecret(userId, key) {
  if (!userId || !key) return;
  const k = String(key).replace(/_/g, '-');
  if (!SECRET_MEDALS.includes(k)) return;
  db.get('SELECT level FROM player_medals WHERE user_id = ? AND medal_key = ?', [userId, k], (err, row) => {
    const already = row && row.level > 0;
    setMedalLevel(userId, k, 1);
    if (!already) _notifyUnlocked(userId, [{ key: k, level: 1 }]);
  });
}

// Dia de login (Piloto Dedicado) — 1x por dia, checado no /api/profile/me
function touchLoginDay(userId, cb) {
  const today = new Date().toISOString().slice(0, 10);
  db.get('SELECT last_login_date FROM player_stats WHERE user_id = ?', [userId], (err, row) => {
    if (err || (row && row.last_login_date === today)) return cb && cb();
    db.run('UPDATE player_stats SET login_days = login_days + 1, last_login_date = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [today, userId], () => {
      evaluateMedals(userId);
      cb && cb();
    });
  });
}

// ==================== MEDALHAS ====================
function setMedalLevel(userId, key, level) {
  if (!userId || !key || !(level > 0)) return;
  const k = String(key).replace(/_/g, '-');
  db.run(
    `INSERT INTO player_medals (user_id, medal_key, level) VALUES (?, ?, ?)
     ON CONFLICT(user_id, medal_key) DO UPDATE SET level = MAX(level, excluded.level), updated_at = CURRENT_TIMESTAMP`,
    [userId, k, level]
  );
}
function _lvlFor(value, tiers) {
  let lv = 0;
  tiers.forEach((t, i) => { if (value >= t) lv = i + 1; });
  return lv;
}
// PEDIDO: manda uma notificação em tempo real pro dono da conta quando ele
// destrava (ou sobe de nível) um título — SE ele estiver com um socket ativo
// agora (accountSocketMap, mantido pelo friends.js). Se ele não estiver
// online (ex: acabou de acontecer via job de fim de partida com o socket já
// desconectado), simplesmente não manda nada — na próxima vez que abrir a
// Central do Piloto o título já vai estar lá, só não veio o "toast" na hora.
function _notifyUnlocked(userId, unlocked) {
  if (!unlocked.length) return;
  const socketId = friendsModule.accountSocketMap.get(userId);
  if (socketId && global.__batalhaIo) {
    global.__batalhaIo.to(socketId).emit('titles-unlocked', {
      titles: unlocked.map(u => ({ key: u.key, level: u.level, name: MEDAL_LABELS[u.key] || u.key })),
    });
  }
}
// Nomes usados só pro texto da notificação (o cliente já tem os nomes
// completos em social-client.js/MEDAL_NAMES — isso aqui é só o fallback do
// servidor, texto simples sem acento problemático de encoding).
const MEDAL_LABELS = {
  'veterano-dos-ceus': 'Veterano dos Ceus', 'as-dos-ceus': 'As dos Ceus',
  'fantasma-dos-ceus': 'Fantasma dos Ceus', 'abatedor-de-dirigiveis': 'Abatedor de Dirigiveis',
  'bombardeiro-de-elite': 'Bombardeiro de Elite', 'mestre-dos-misseis': 'Mestre dos Misseis',
  'heroi-da-esquadrilha': 'Heroi da Esquadrilha', 'conquistador-dos-ceus': 'Conquistador dos Ceus',
  'piloto-veterano': 'Piloto Veterano', 'piloto-dedicado': 'Piloto Dedicado',
  'orgulho-da-esquadrilha': 'Orgulho da Esquadrilha', 'blindagem-viva': 'Blindagem Viva',
  'implacavel': 'Implacavel', 'primeiro-ataque': 'Primeiro Ataque', 'ultimo-no-ceu': 'Ultimo no Ceu',
  'fenix': 'Fenix', 'kamikaze': 'Kamikaze', 'tiro-perfeito': 'Tiro Perfeito',
  'cacador-relampago': 'Cacador Relampago', 'dominio-aereo': 'Dominio Aereo',
  'lenda-da-batalha-aerea': 'Lenda da Batalha Aerea',
};
function evaluateMedals(userId) {
  if (!userId) return;
  db.get('SELECT * FROM player_stats WHERE user_id = ?', [userId], (err, s) => {
    if (err || !s) return;
    // PEDIDO: lê o nível ATUAL de cada medalha antes de recalcular, pra
    // saber exatamente quais subiram de nível nesta chamada (é isso que
    // dispara a notificação — nunca notifica de novo um título que o
    // jogador já tinha).
    db.all('SELECT medal_key, level FROM player_medals WHERE user_id = ?', [userId], (err2, existing) => {
      const before = {};
      (existing || []).forEach(r => { before[r.medal_key] = r.level; });
      const kd = (s.deaths > 0) ? (s.kills / s.deaths) : (s.kills > 0 ? 99 : 0);
      const targets = [
        ['veterano-dos-ceus', _lvlFor((s.playtime_seconds || 0) / 3600, [5, 20, 75])],
        ['as-dos-ceus', _lvlFor(s.kills || 0, [50, 250, 1000])],
        ['fantasma-dos-ceus', _lvlFor(kd, [1.5, 2.5, 4.0])],
        ['abatedor-de-dirigiveis', _lvlFor(s.blimp_kills || 0, [10, 50, 250])],
        ['bombardeiro-de-elite', _lvlFor(s.bomb_kills || 0, [25, 100, 400])],
        ['mestre-dos-misseis', _lvlFor(s.missile_kills || 0, [25, 100, 400])],
        ['heroi-da-esquadrilha', _lvlFor(s.mvps || 0, [10, 50, 200])],
        ['conquistador-dos-ceus', _lvlFor(s.wins || 0, [25, 100, 500])],
        ['piloto-veterano', _lvlFor(s.matches_played || 0, [50, 250, 1000])],
        ['piloto-dedicado', _lvlFor(s.login_days || 0, [7, 30, 180])],
        ['orgulho-da-esquadrilha', _lvlFor(s.kills || 0, [300, 2500, 10000])],
        ['blindagem-viva', _lvlFor(s.damage_taken || 0, [500, 2000, 10000])],
        ['implacavel', _lvlFor(s.best_alive_seconds || 0, [300, 600, 1200])],
        ['primeiro-ataque', _lvlFor(s.first_bloods || 0, [10, 50, 250])],
        ['ultimo-no-ceu', _lvlFor(s.last_survivals || 0, [10, 50, 250])],
      ];
      const unlocked = [];
      targets.forEach(([key, level]) => {
        if (level > 0 && level > (before[key] || 0)) unlocked.push({ key, level });
        setMedalLevel(userId, key, level);
      });
      _notifyUnlocked(userId, unlocked);
    });
  });
}

// ==================== RANKING / TÍTULOS ====================
function getLeaderboard(cb) {
  db.all(
    `SELECT u.nickname, s.user_id, s.kills, s.deaths, s.blimp_kills, s.matches_played,
            s.playtime_seconds, s.wins, s.mvps, s.bomb_kills, s.missile_kills,
            p.photo_path, p.selected_titles
     FROM player_stats s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN player_profile p ON p.user_id = u.id
     ORDER BY s.kills DESC LIMIT 20`,
    [],
    (err, rows) => {
      if (err) return cb(err, []);
      rows = rows || [];
      if (!rows.length) return cb(null, []);
      const out = [];
      let pending = rows.length;
      rows.forEach(r => {
        db.all('SELECT medal_key, level FROM player_medals WHERE user_id = ? AND level > 0', [r.user_id], (e2, meds) => {
          const medals = meds || [];
          const lvl = {};
          medals.forEach(m => { lvl[m.medal_key] = m.level; });
          let sel = [];
          try { sel = JSON.parse(r.selected_titles || '[]'); } catch (e) { sel = []; }
          out.push({
            nickname: r.nickname,
            kills: r.kills || 0, deaths: r.deaths || 0, blimp_kills: r.blimp_kills || 0,
            matches_played: r.matches_played || 0, playtime_seconds: r.playtime_seconds || 0,
            wins: r.wins || 0, mvps: r.mvps || 0, bomb_kills: r.bomb_kills || 0, missile_kills: r.missile_kills || 0,
            photoUrl: r.photo_path ? `/uploads/avatars/${r.photo_path}` : null,
            rankKey: rankForKills(r.kills || 0).k,
            // Só entrega títulos que o jogador REALMENTE possui (com o nível real)
            titles: (Array.isArray(sel) ? sel : [])
              .map(k => String(k).replace(/_/g, '-'))
              .filter(k => lvl[k])
              .slice(0, 3)
              .map(k => ({ key: k, level: lvl[k] })),
            medalSummary: {
              b: medals.filter(m => m.level >= 1).length,
              p: medals.filter(m => m.level >= 2).length,
              o: medals.filter(m => m.level >= 3).length,
            },
          });
          if (--pending === 0) { out.sort((a, b) => b.kills - a.kills); cb(null, out); }
        });
      });
    }
  );
}
function getTitles(cb) {
  const queries = {
    topKills: `SELECT u.nickname, s.kills as value FROM player_stats s JOIN users u ON u.id=s.user_id WHERE s.kills > 0 ORDER BY s.kills DESC LIMIT 1`,
    topBlimps: `SELECT u.nickname, s.blimp_kills as value FROM player_stats s JOIN users u ON u.id=s.user_id WHERE s.blimp_kills > 0 ORDER BY s.blimp_kills DESC LIMIT 1`,
    topPlaytime: `SELECT u.nickname, s.playtime_seconds as value FROM player_stats s JOIN users u ON u.id=s.user_id WHERE s.playtime_seconds > 0 ORDER BY s.playtime_seconds DESC LIMIT 1`,
    topWins: `SELECT u.nickname, s.wins as value FROM player_stats s JOIN users u ON u.id=s.user_id WHERE s.wins > 0 ORDER BY s.wins DESC LIMIT 1`,
    topMvps: `SELECT u.nickname, s.mvps as value FROM player_stats s JOIN users u ON u.id=s.user_id WHERE s.mvps > 0 ORDER BY s.mvps DESC LIMIT 1`,
  };
  const result = {};
  const keys = Object.keys(queries);
  let pending = keys.length;
  keys.forEach((key) => {
    db.get(queries[key], [], (err, row) => {
      result[key] = row || null;
      if (--pending === 0) cb(null, result);
    });
  });
}

// ==================== "CARTEIRINHA" PRA SALAS (rooms) ====================
// PEDIDO: pra amigos/oponentes verem a patente/títulos de cada jogador
// dentro da sala (lobby, placar) — não só no ranking do site. Devolve
// sempre um objeto válido (mesmo pra quem não tem conta = sem login),
// pronto pra ir direto no payload da sala.
function getPlayerBadge(userId, cb) {
  if (!userId) { cb({ rankKey: null, titles: [], photoUrl: null }); return; }
  db.get('SELECT kills FROM player_stats WHERE user_id = ?', [userId], (err, s) => {
    const rk = rankForKills((s && s.kills) || 0);
    db.get('SELECT selected_titles, photo_path FROM player_profile WHERE user_id = ?', [userId], (err2, profile) => {
      let sel = [];
      try { sel = JSON.parse((profile && profile.selected_titles) || '[]'); } catch (e) { sel = []; }
      if (!Array.isArray(sel) || !sel.length) { cb({ rankKey: rk.k, titles: [], photoUrl: profile && profile.photo_path ? `/uploads/avatars/${profile.photo_path}` : null }); return; }
      db.all('SELECT medal_key, level FROM player_medals WHERE user_id = ? AND level > 0', [userId], (err3, medals) => {
        const lvl = {};
        (medals || []).forEach(m => { lvl[m.medal_key] = m.level; });
        const titles = sel.map(k => String(k).replace(/_/g, '-')).filter(k => lvl[k]).slice(0, 3).map(k => ({ key: k, level: lvl[k] }));
        cb({ rankKey: rk.k, titles, photoUrl: profile && profile.photo_path ? `/uploads/avatars/${profile.photo_path}` : null });
      });
    });
  });
}

module.exports = {
  mount,
  recordKill, recordDeath, recordBlimpKill, recordMatchPlayed,
  recordMatchResults, recordWin, recordMvp, recordBombKill, recordMissileKill,
  recordLoginDay, recordFirstBlood, unlockSecret,
  setMedalLevel, evaluateMedals,
  getLeaderboard, getTitles, getPlayerBadge,
};