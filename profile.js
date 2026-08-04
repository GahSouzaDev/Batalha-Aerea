// profile.js — carreira militar completa: stats + patentes + condecorações
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db, authenticate } = require('./auth');

// ==================== PATENTES (por abates) ====================
const RANKS = [
  { k: 's2', n: 'Soldado de Segunda Classe (S2)', q: 0, img: 'soldado-de-segunda-classe(s2).png' },
  { k: 's1', n: 'Soldado de Primeira Classe (S1)', q: 25, img: 'soldado-de-primeira-classe(s1).png' },
  { k: 'cabo', n: 'Cabo', q: 75, img: 'cabo.png' },
  { k: '3s', n: 'Terceiro-Sargento', q: 150, img: 'terceiro-sargento.png' },
  { k: '2s', n: 'Segundo-Sargento', q: 300, img: 'segundo-sargento.png' },
  { k: '1s', n: 'Primeiro-Sargento', q: 500, img: 'primeiro-sargento.png' },
  { k: 'sub', n: 'Suboficial', q: 750, img: 'suboficial.png' },
  { k: 'asp', n: 'Aspirante a Oficial', q: 1000, img: 'aspirante-a-oficial.png' },
  { k: '2t', n: 'Segundo-Tenente', q: 1400, img: 'segundo-tenente.png' },
  { k: '1t', n: 'Primeiro-Tenente', q: 1900, img: 'primeiro-tenente.png' },
  { k: 'cap', n: 'Capitão', q: 2500, img: 'capitao.png' },
  { k: 'maj', n: 'Major', q: 3200, img: 'major.png' },
  { k: 'tc', n: 'Tenente-Coronel', q: 4000, img: 'tenente-coronel.png' },
  { k: 'cel', n: 'Coronel', q: 5000, img: 'coronel.png' },
  { k: 'brig', n: 'Brigadeiro', q: 6500, img: 'brigadeiro.png' },
  { k: 'mbrig', n: 'Major-Brigadeiro', q: 8000, img: 'major-brigadeiro.png' },
  { k: 'tbrig', n: 'Tenente-Brigadeiro', q: 10000, img: 'tenente-brigadeiro.png' },
];
function rankFor(kills) {
  let r = RANKS[0];
  for (const x of RANKS) if (kills >= x.q) r = x;
  return r;
}

// ==================== CONDECORAÇÕES ====================
// metric = função(stats, rankIndex) -> valor atual; th = [bronze, prata, ouro]
const H = 3600;
const MEDAL_DEFS = [
  { k: 'veterano_dos_ceus', th: [5 * H, 20 * H, 75 * H], m: s => s.playtime_seconds },
  { k: 'as_dos_ceus', th: [50, 250, 1000], m: s => s.kills },
  { k: 'mestre_da_sobrevivencia', th: [5, 15, 50], m: s => s.best_survival_streak },
  { k: 'fantasma_dos_ceus', th: [1.5, 2.5, 4.0], m: s => s.kills / Math.max(1, s.deaths) },
  { k: 'abatedor_de_dirigiveis', th: [10, 50, 250], m: s => s.blimp_kills },
  { k: 'bombardeiro_de_elite', th: [25, 100, 400], m: s => s.bomb_kills },
  { k: 'mestre_dos_misseis', th: [25, 100, 400], m: s => s.missile_kills },
  { k: 'heroi_da_esquadrilha', th: [10, 50, 200], m: s => s.mvps },
  { k: 'conquistador_dos_ceus', th: [25, 100, 500], m: s => s.wins },
  { k: 'piloto_veterano', th: [50, 250, 1000], m: s => s.matches_played },
  { k: 'implacavel', th: [300, 600, 1200], m: s => s.best_alive_seconds },
  { k: 'blindagem_viva', th: [500, 2000, 10000], m: s => s.best_damage_taken },
  { k: 'ultimo_no_ceu', th: [10, 50, 250], m: s => s.last_survivor },
  { k: 'primeiro_ataque', th: [10, 50, 250], m: s => s.first_bloods },
  { k: 'piloto_dedicado', th: [7, 30, 180], m: s => s.login_days },
  { k: 'orgulho_da_esquadrilha', th: [3, 10, 16], m: (s, ri) => ri + 1 }, // índice da patente (0-based): 3=Sargento, 10=Capitão, 16=Tenente-Brigadeiro
];
const SECRET_KEYS = ['fenix', 'kamikaze', 'tiro_perfeito', 'cacador_relampago', 'dominio_aereo', 'lenda_da_batalha_aerea'];
const CLIENT_REPORTABLE = ['tiro_perfeito'];

// ==================== TABELAS + MIGRAÇÃO ====================
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS player_profile (
    user_id INTEGER PRIMARY KEY, preferred_plane TEXT DEFAULT 'cessna',
    sound_enabled INTEGER DEFAULT 1, music_enabled INTEGER DEFAULT 1,
    photo_path TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS player_stats (
    user_id INTEGER PRIMARY KEY, matches_played INTEGER DEFAULT 0, kills INTEGER DEFAULT 0,
    deaths INTEGER DEFAULT 0, blimp_kills INTEGER DEFAULT 0, playtime_seconds INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS player_medals (
    user_id INTEGER, medal_key TEXT, level INTEGER DEFAULT 0, unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, medal_key))`);
  // migração de colunas novas (caso o banco já existisse)
  const NEW_COLS = [
    ['wins', 'INTEGER DEFAULT 0'], ['mvps', 'INTEGER DEFAULT 0'], ['bomb_kills', 'INTEGER DEFAULT 0'],
    ['missile_kills', 'INTEGER DEFAULT 0'], ['first_bloods', 'INTEGER DEFAULT 0'], ['last_survivor', 'INTEGER DEFAULT 0'],
    ['best_survival_streak', 'INTEGER DEFAULT 0'], ['current_survival_streak', 'INTEGER DEFAULT 0'],
    ['best_alive_seconds', 'INTEGER DEFAULT 0'], ['best_damage_taken', 'INTEGER DEFAULT 0'],
    ['login_days', 'INTEGER DEFAULT 0'], ['last_login_date', 'TEXT'], ['deaths_today', 'INTEGER DEFAULT 0'], ['deaths_today_date', 'TEXT'],
  ];
  db.all('PRAGMA table_info(player_stats)', [], (err, rows) => {
    if (err || !rows) return;
    const have = rows.map(r => r.name);
    NEW_COLS.forEach(([col, def]) => {
      if (!have.includes(col)) db.run(`ALTER TABLE player_stats ADD COLUMN ${col} ${def}`);
    });
  });
});
function ensureStatsRow(userId, cb) { db.run('INSERT OR IGNORE INTO player_stats (user_id) VALUES (?)', [userId], () => cb && cb()); }
function ensureProfileRow(userId, cb) { db.run('INSERT OR IGNORE INTO player_profile (user_id) VALUES (?)', [userId], () => cb && cb()); }

// ==================== AVALIAÇÃO DE MEDALHAS ====================
function evaluateMedals(userId) {
  if (!userId) return;
  db.get('SELECT * FROM player_stats WHERE user_id = ?', [userId], (err, s) => {
    if (err || !s) return;
    const rank = rankFor(s.kills || 0);
    const rankIndex = RANKS.indexOf(rank);
    db.all('SELECT medal_key, level FROM player_medals WHERE user_id = ?', [userId], (err2, rows) => {
      const owned = {}; (rows || []).forEach(r => owned[r.medal_key] = r.level);
      MEDAL_DEFS.forEach(def => {
        const val = def.m(s, rankIndex) || 0;
        let lvl = 0;
        if (val >= def.th[2]) lvl = 3; else if (val >= def.th[1]) lvl = 2; else if (val >= def.th[0]) lvl = 1;
        if (lvl > (owned[def.k] || 0)) {
          db.run(`INSERT INTO player_medals (user_id, medal_key, level) VALUES (?,?,?)
                  ON CONFLICT(user_id, medal_key) DO UPDATE SET level=excluded.level, unlocked_at=CURRENT_TIMESTAMP`, [userId, def.k, lvl], () => {
            // Lenda da Batalha Aérea: todas as 16 em ouro
            if (def.k === 'orgulho_da_esquadrilha' || true) checkLenda(userId);
          });
        }
      });
    });
  });
}
function checkLenda(userId) {
  db.all(`SELECT medal_key FROM player_medals WHERE user_id=? AND level=3 AND medal_key NOT IN ('lenda_da_batalha_aerea')`, [userId], (err, rows) => {
    if (err) return;
    const normal = MEDAL_DEFS.length; // 16 normais
    if ((rows || []).length >= normal) {
      db.run(`INSERT OR IGNORE INTO player_medals (user_id, medal_key, level) VALUES (?,?,1)`, [userId, 'lenda_da_batalha_aerea']);
    }
  });
}
function unlockSecret(userId, key) {
  if (!userId || !SECRET_KEYS.includes(key)) return;
  if (key === 'tiro_perfeito' && !CLIENT_REPORTABLE.includes(key)) return;
  db.run(`INSERT OR IGNORE INTO player_medals (user_id, medal_key, level) VALUES (?,?,1)`, [userId, key]);
}

// ==================== REGISTROS DE EVENTO ====================
const killTimes = new Map(); // userId -> [timestamps] (Caçador Relâmpago)
function recordKill(userId, weaponType) {
  if (!userId) return;
  ensureStatsRow(userId, () => {
    const bombSet = ['bomb', 'overdrive', 'light-trail-orb'];
    const missSet = ['missile', 'ability-missile', 'normal'];
    const isBomb = bombSet.includes(weaponType);
    const isMiss = missSet.includes(weaponType);
    db.run(`UPDATE player_stats SET kills=kills+1, bomb_kills=bomb_kills+?, missile_kills=missile_kills+?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?`,
      [isBomb ? 1 : 0, isMiss ? 1 : 0, userId], () => {
        // Caçador Relâmpago: 3 abates em 20s
        const now = Date.now();
        const arr = (killTimes.get(userId) || []).filter(t => now - t < 20000);
        arr.push(now); killTimes.set(userId, arr);
        if (arr.length >= 3) unlockSecret(userId, 'cacador_relampago');
        // Kamikaze: abate com explosão de dirigível
        if (weaponType === 'blimp') unlockSecret(userId, 'kamikaze');
        evaluateMedals(userId);
      });
  });
}
function recordDeath(userId, damageTaken, aliveSeconds) {
  if (!userId) return;
  ensureStatsRow(userId, () => {
    const today = new Date().toDateString();
    db.get('SELECT * FROM player_stats WHERE user_id=?', [userId], (err, s) => {
      if (err || !s) return;
      const dt = (s.deaths_today_date === today) ? (s.deaths_today || 0) + 1 : 1;
      db.run(`UPDATE player_stats SET deaths=deaths+1, current_survival_streak=0, deaths_today=?, deaths_today_date=?,
              best_damage_taken=MAX(best_damage_taken,?), best_alive_seconds=MAX(best_alive_seconds,?), updated_at=CURRENT_TIMESTAMP WHERE user_id=?`,
        [dt, today, Math.round(damageTaken || 0), Math.round(aliveSeconds || 0), userId], () => evaluateMedals(userId));
    });
  });
}
function recordBlimpKill(userId) { if (!userId) return; ensureStatsRow(userId, () => db.run('UPDATE player_stats SET blimp_kills=blimp_kills+1 WHERE user_id=?', [userId], () => evaluateMedals(userId))); }
function recordFirstBlood(userId) { if (!userId) return; ensureStatsRow(userId, () => db.run('UPDATE player_stats SET first_bloods=first_bloods+1 WHERE user_id=?', [userId], () => evaluateMedals(userId))); }
// fim de partida (salas criadas): resume tudo de uma vez
function recordMatchResults(userId, o) {
  if (!userId) return;
  ensureStatsRow(userId, () => {
    db.get('SELECT * FROM player_stats WHERE user_id=?', [userId], (err, s) => {
      if (err || !s) return;
      const streak = o.survived ? (s.current_survival_streak || 0) + 1 : 0;
      db.run(`UPDATE player_stats SET
        matches_played=matches_played+1, playtime_seconds=playtime_seconds+?,
        wins=wins+?, mvps=mvps+?, last_survivor=last_survivor+?,
        current_survival_streak=?, best_survival_streak=MAX(best_survival_streak,?),
        best_alive_seconds=MAX(best_alive_seconds,?), updated_at=CURRENT_TIMESTAMP WHERE user_id=?`,
        [Math.round(o.playtimeSeconds || 0), o.win ? 1 : 0, o.mvp ? 1 : 0, o.lastSurvivor ? 1 : 0,
         streak, streak, Math.round(o.aliveSeconds || 0), userId], () => {
        // Fênix: vencer após 5+ mortes no mesmo dia | Domínio Aéreo: vencer sem morrer
        const today = new Date().toDateString();
        if (o.win) {
          if ((s.deaths_today_date === today ? (s.deaths_today || 0) : 0) >= 5) unlockSecret(userId, 'fenix');
          if ((o.deathsInMatch || 0) === 0) unlockSecret(userId, 'dominio_aereo');
        }
        evaluateMedals(userId);
      });
    });
  });
}
function recordLogin(userId) {
  if (!userId) return;
  ensureStatsRow(userId, () => {
    const today = new Date().toDateString();
    const yest = new Date(Date.now() - 86400000).toDateString();
    db.get('SELECT last_login_date, login_days FROM player_stats WHERE user_id=?', [userId], (err, s) => {
      if (err || !s || s.last_login_date === today) return;
      const days = (s.last_login_date === yest) ? (s.login_days || 0) + 1 : 1;
      db.run('UPDATE player_stats SET login_days=?, last_login_date=? WHERE user_id=?', [days, today, userId], () => evaluateMedals(userId));
    });
  });
}

// ==================== CONSULTAS ====================
function getLeaderboard(cb) {
  db.all(`SELECT u.nickname, s.* FROM player_stats s JOIN users u ON u.id=s.user_id
          WHERE s.kills>0 OR s.matches_played>0 ORDER BY s.kills DESC LIMIT 20`, [], (err, rows) => {
    if (err) return cb(err, []);
    (rows || []).forEach(r => { const rk = rankFor(r.kills || 0); r.rankKey = rk.k; r.rankName = rk.n; r.rankImg = rk.img; });
    cb(null, rows || []);
  });
}
function getTitles(cb) {
  const Q = {
    topKills: `SELECT u.nickname, s.kills AS value FROM player_stats s JOIN users u ON u.id=s.user_id WHERE s.kills>0 ORDER BY s.kills DESC LIMIT 1`,
    topBlimps: `SELECT u.nickname, s.blimp_kills AS value FROM player_stats s JOIN users u ON u.id=s.user_id WHERE s.blimp_kills>0 ORDER BY s.blimp_kills DESC LIMIT 1`,
    topPlaytime: `SELECT u.nickname, s.playtime_seconds AS value FROM player_stats s JOIN users u ON u.id=s.user_id WHERE s.playtime_seconds>0 ORDER BY s.playtime_seconds DESC LIMIT 1`,
    topWins: `SELECT u.nickname, s.wins AS value FROM player_stats s JOIN users u ON u.id=s.user_id WHERE s.wins>0 ORDER BY s.wins DESC LIMIT 1`,
    topMvps: `SELECT u.nickname, s.mvps AS value FROM player_stats s JOIN users u ON u.id=s.user_id WHERE s.mvps>0 ORDER BY s.mvps DESC LIMIT 1`,
  };
  const res = {}; const keys = Object.keys(Q); let pend = keys.length;
  keys.forEach(k => db.get(Q[k], [], (e, r) => { res[k] = r || null; if (--pend === 0) cb(null, res); }));
}

// ==================== ROTAS ====================
const AVATAR_DIR = path.join(__dirname, 'public', 'uploads', 'avatars');
if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({ destination: (r, f, cb) => cb(null, AVATAR_DIR), filename: (r, f, cb) => cb(null, `user_${r.user.id}_${Date.now()}${(path.extname(f.originalname) || '.jpg').toLowerCase()}`) }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (r, f, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(f.mimetype)),
});
function mount(app) {
  app.get('/api/profile/me', authenticate, (req, res) => {
    recordLogin(req.user.id);
    ensureProfileRow(req.user.id, () => ensureStatsRow(req.user.id, () => {
      db.get('SELECT * FROM player_profile WHERE user_id=?', [req.user.id], (e1, profile) => {
        db.get('SELECT * FROM player_stats WHERE user_id=?', [req.user.id], (e2, stats) => {
          if (e1 || e2) return res.status(500).json({ error: 'Erro ao carregar perfil.' });
          const rank = rankFor(stats.kills || 0);
          const idx = RANKS.indexOf(rank);
          const next = RANKS[idx + 1] || null;
          db.all('SELECT medal_key, level FROM player_medals WHERE user_id=?', [req.user.id], (e3, medals) => {
            res.json({
              profile: { preferredPlane: profile.preferred_plane, soundEnabled: !!profile.sound_enabled, musicEnabled: !!profile.music_enabled, photoUrl: profile.photo_path ? `/uploads/avatars/${profile.photo_path}` : null },
              stats, rank: { key: rank.k, name: rank.n, img: rank.img, index: idx, next: next ? { key: next.k, name: next.n, img: next.img, at: next.q } : null, current: stats.kills || 0 },
              medals: medals || [],
            });
          });
        });
      });
    }));
  });
  app.post('/api/profile/settings', authenticate, (req, res) => {
    const { preferredPlane, soundEnabled, musicEnabled } = req.body || {};
    ensureProfileRow(req.user.id, () => db.run(
      `UPDATE player_profile SET preferred_plane=COALESCE(?,preferred_plane), sound_enabled=COALESCE(?,sound_enabled), music_enabled=COALESCE(?,music_enabled), updated_at=CURRENT_TIMESTAMP WHERE user_id=?`,
      [preferredPlane || null, soundEnabled === undefined ? null : (soundEnabled ? 1 : 0), musicEnabled === undefined ? null : (musicEnabled ? 1 : 0), req.user.id],
      err => err ? res.status(500).json({ error: 'Erro.' }) : res.json({ ok: true })));
  });
  app.post('/api/profile/photo', authenticate, (req, res) => {
    upload.single('photo')(req, res, (err) => {
      if (err || !req.file) return res.status(400).json({ error: (err && err.message) || 'Nenhuma imagem.' });
      db.get('SELECT photo_path FROM player_profile WHERE user_id=?', [req.user.id], (e, row) => {
        const old = row && row.photo_path;
        db.run('UPDATE player_profile SET photo_path=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?', [req.file.filename, req.user.id], () => {
          if (old && old !== req.file.filename) fs.unlink(path.join(AVATAR_DIR, old), () => {});
          res.json({ ok: true, photoUrl: `/uploads/avatars/${req.file.filename}` });
        });
      });
    });
  });
  app.get('/api/ranking', (req, res) => {
    getLeaderboard((e1, leaderboard) => getTitles((e2, titles) => {
      if (e1 || e2) return res.status(500).json({ error: 'Erro ao carregar ranking.' });
      res.json({ leaderboard, titles });
    }));
  });
}
module.exports = { mount, recordKill, recordDeath, recordBlimpKill, recordFirstBlood, recordMatchResults, recordLogin, unlockSecret, getLeaderboard, getTitles, RANKS, rankFor };