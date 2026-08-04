// profile.js — perfil persistente do jogador (ligado à CONTA, não ao
// navegador/link do servidor)
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db, authenticate } = require('./auth');

// ==================== TABELAS ====================
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS player_profile (
        user_id INTEGER PRIMARY KEY,
        preferred_plane TEXT DEFAULT 'cessna',
        sound_enabled INTEGER DEFAULT 1,
        music_enabled INTEGER DEFAULT 1,
        photo_path TEXT,
        preferred_pilot INTEGER DEFAULT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS player_stats (
        user_id INTEGER PRIMARY KEY,
        matches_played INTEGER DEFAULT 0,
        kills INTEGER DEFAULT 0,
        deaths INTEGER DEFAULT 0,
        blimp_kills INTEGER DEFAULT 0,
        playtime_seconds INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // MIGRAÇÃO segura: adiciona colunas em bancos antigos sem quebrar.
    db.run(`ALTER TABLE player_profile ADD COLUMN preferred_pilot INTEGER DEFAULT NULL`, (err) => {
        if (err && !/duplicate column/i.test(err.message)) {
            console.error('[profile] erro na migração preferred_pilot:', err);
        }
    });
});

function ensureProfileRow(userId, cb) {
    db.run('INSERT OR IGNORE INTO player_profile (user_id) VALUES (?)', [userId], (err) => cb && cb(err));
}

function ensureStatsRow(userId, cb) {
    db.run('INSERT OR IGNORE INTO player_stats (user_id) VALUES (?)', [userId], (err) => cb && cb(err));
}

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
        const okTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!okTypes.includes(file.mimetype)) return cb(new Error('Formato de imagem não aceito (use JPG, PNG, WEBP ou GIF).'));
        cb(null, true);
    },
});

// ==================== MONTAGEM DAS ROTAS ====================
function mount(app) {
    app.get('/api/profile/me', authenticate, (req, res) => {
        ensureProfileRow(req.user.id, () => {
            ensureStatsRow(req.user.id, () => {
                db.get('SELECT * FROM player_profile WHERE user_id = ?', [req.user.id], (err, profile) => {
                    if (err) return res.status(500).json({ error: 'Erro ao carregar perfil.' });
                    db.get('SELECT * FROM player_stats WHERE user_id = ?', [req.user.id], (err2, stats) => {
                        if (err2) return res.status(500).json({ error: 'Erro ao carregar estatísticas.' });
                        res.json({
                            profile: {
                                preferredPlane: profile.preferred_plane,
                                soundEnabled: !!profile.sound_enabled,
                                musicEnabled: !!profile.music_enabled,
                                preferredPilot: profile.preferred_pilot,
                                photoUrl: profile.photo_path ? `/uploads/avatars/${profile.photo_path}` : null,
                            },
                            stats: {
                                matchesPlayed: stats.matches_played,
                                kills: stats.kills,
                                deaths: stats.deaths,
                                blimpKills: stats.blimp_kills,
                                playtimeSeconds: stats.playtime_seconds,
                            },
                        });
                    });
                });
            });
        });
    });

    app.post('/api/profile/settings', authenticate, (req, res) => {
        const { preferredPlane, soundEnabled, musicEnabled, preferredPilot } = req.body || {};

        let pilotVal = null;
        if (preferredPilot !== undefined && preferredPilot !== null) {
            const parsed = parseInt(preferredPilot, 10);
            if (!isNaN(parsed)) pilotVal = Math.max(1, Math.min(16, parsed));
        }

        ensureProfileRow(req.user.id, () => {
            db.run(
                `UPDATE player_profile SET
                    preferred_plane = COALESCE(?, preferred_plane),
                    sound_enabled = COALESCE(?, sound_enabled),
                    music_enabled = COALESCE(?, music_enabled),
                    preferred_pilot = COALESCE(?, preferred_pilot),
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?`,
                [
                    preferredPlane || null,
                    soundEnabled === undefined ? null : (soundEnabled ? 1 : 0),
                    musicEnabled === undefined ? null : (musicEnabled ? 1 : 0),
                    pilotVal,
                    req.user.id,
                ],
                (err) => {
                    if (err) return res.status(500).json({ error: 'Erro ao salvar configurações.' });
                    res.json({ ok: true });
                }
            );
        });
    });

    app.post('/api/profile/photo', authenticate, (req, res) => {
        upload.single('photo')(req, res, (err) => {
            if (err) return res.status(400).json({ error: err.message });
            if (!req.file) return res.status(400).json({ error: 'Nenhuma imagem enviada.' });

            ensureProfileRow(req.user.id, () => {
                db.get('SELECT photo_path FROM player_profile WHERE user_id = ?', [req.user.id], (err2, row) => {
                    const oldFileName = row && row.photo_path;
                    db.run(
                        'UPDATE player_profile SET photo_path = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
                        [req.file.filename, req.user.id],
                        (err3) => {
                            if (err3) return res.status(500).json({ error: 'Erro ao salvar a foto.' });
                            if (oldFileName && oldFileName !== req.file.filename) {
                                const oldPath = path.join(AVATAR_DIR, oldFileName);
                                fs.unlink(oldPath, () => {});
                            }
                            res.json({ ok: true, photoUrl: `/uploads/avatars/${req.file.filename}` });
                        }
                    );
                });
            });
        });
    });

    // ================================================================
    //  RANKING / TÍTULOS — PÚBLICA + CORS LIBERADO
    //  Essa rota é consultada pelo SITE ESTÁTICO do GitHub Pages
    //  (batalhaaerea.gahsouza.com.br) pra exibir o ranking ao vivo.
    //  Sem o header Access-Control-Allow-Origin: * o navegador bloqueia
    //  a leitura (CORS), por isso ele está aqui de propósito.
    // ================================================================
    app.get('/api/ranking', (req, res) => {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET');
        res.set('Cache-Control', 'no-store');

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
function recordKill(userId) {
    if (!userId) return;
    ensureStatsRow(userId, () => {
        db.run('UPDATE player_stats SET kills = kills + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [userId]);
    });
}

function recordDeath(userId) {
    if (!userId) return;
    ensureStatsRow(userId, () => {
        db.run('UPDATE player_stats SET deaths = deaths + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [userId]);
    });
}

function recordBlimpKill(userId) {
    if (!userId) return;
    ensureStatsRow(userId, () => {
        db.run('UPDATE player_stats SET blimp_kills = blimp_kills + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [userId]);
    });
}

function recordMatchPlayed(userId, playtimeSeconds) {
    if (!userId) return;
    ensureStatsRow(userId, () => {
        db.run(
            'UPDATE player_stats SET matches_played = matches_played + 1, playtime_seconds = playtime_seconds + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
            [Math.max(0, Math.round(playtimeSeconds || 0)), userId]
        );
    });
}

// ==================== RANKING / TÍTULOS ====================
function getLeaderboard(cb) {
    db.all(
        `SELECT u.nickname, u.display_name, s.kills, s.deaths, s.blimp_kills, s.matches_played, s.playtime_seconds
         FROM player_stats s
         JOIN users u ON u.id = s.user_id
         ORDER BY s.kills DESC
         LIMIT 20`,
        [],
        (err, rows) => cb(err, rows || [])
    );
}

function getTitles(cb) {
    const queries = {
        topKills: `SELECT u.nickname, s.kills as value FROM player_stats s JOIN users u ON u.id=s.user_id WHERE s.kills > 0 ORDER BY s.kills DESC LIMIT 1`,
        topBlimps: `SELECT u.nickname, s.blimp_kills as value FROM player_stats s JOIN users u ON u.id=s.user_id WHERE s.blimp_kills > 0 ORDER BY s.blimp_kills DESC LIMIT 1`,
        topPlaytime: `SELECT u.nickname, s.playtime_seconds as value FROM player_stats s JOIN users u ON u.id=s.user_id WHERE s.playtime_seconds > 0 ORDER BY s.playtime_seconds DESC LIMIT 1`,
    };

    const result = {};
    const keys = Object.keys(queries);
    let pending = keys.length;

    keys.forEach((key) => {
        db.get(queries[key], [], (err, row) => {
            result[key] = row || null;
            pending--;
            if (pending === 0) cb(null, result);
        });
    });
}

module.exports = {
    mount, recordKill, recordDeath, recordBlimpKill, recordMatchPlayed,
    getLeaderboard, getTitles,
};