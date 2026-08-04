// friends.js — sistema de amigos + desafiar amigo em tempo real
// ================================================================
//  REST: buscar jogador, enviar pedido, aceitar/recusar, listar amigos.
//  Socket.io: identificar qual conta está em qual conexão (pra saber se
//  um amigo está online agora) + o convite de "desafiar" (cria uma sala
//  do seu lado normalmente, como já existe, e só avisa o amigo em tempo
//  real com um convite pra entrar nela).
// ================================================================

const { db, authenticate, verifyToken } = require('./auth');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS friend_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user_id INTEGER NOT NULL,
        to_user_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | declined
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(from_user_id, to_user_id)
    )`);
});

// Mapa userId -> socket.id ATUAL (só existe enquanto o navegador estiver
// aberto e logado numa partida/menu). Usado pra saber se dá pra mandar
// uma notificação em tempo real (amigo online) ou não (offline).
const accountSocketMap = new Map();

// ==================== REST ====================
function mount(app) {
  // Busca por nickname (prefixo) — não devolve a própria conta, e
  // já informa o status atual (nenhum / pendente enviado / pendente
  // recebido / já são amigos), pra o cliente desenhar o botão certo.
  app.get('/api/friends/search', authenticate, (req, res) => {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ results: [] });
    db.all(
      `SELECT id, nickname, display_name FROM users
       WHERE nickname_lower LIKE ? AND id != ? LIMIT 15`,
      [q.toLowerCase() + '%', req.user.id],
      (err, rows) => {
        if (err) return res.status(500).json({ error: 'Erro na busca.' });
        if (!rows.length) return res.json({ results: [] });
        const ids = rows.map(r => r.id);
        const placeholders = ids.map(() => '?').join(',');
        db.all(
          `SELECT * FROM friend_requests WHERE
             (from_user_id = ? AND to_user_id IN (${placeholders}))
             OR (to_user_id = ? AND from_user_id IN (${placeholders}))`,
          [req.user.id, ...ids, req.user.id, ...ids],
          (err2, reqs) => {
            const results = rows.map(u => {
              const rel = (reqs || []).find(r => r.from_user_id === u.id || r.to_user_id === u.id);
              let status = 'none';
              if (rel) {
                if (rel.status === 'accepted') status = 'friends';
                else if (rel.status === 'pending') status = (rel.from_user_id === req.user.id) ? 'sent' : 'received';
              }
              return { id: u.id, nickname: u.nickname, displayName: u.display_name, status, online: accountSocketMap.has(u.id) };
            });
            res.json({ results });
          }
        );
      }
    );
  });

  // Lista de amigos + pedidos pendentes (enviados e recebidos)
  app.get('/api/friends', authenticate, (req, res) => {
    db.all(
      `SELECT fr.id, fr.status, fr.from_user_id, fr.to_user_id,
              u.nickname, u.display_name
       FROM friend_requests fr
       JOIN users u ON u.id = (CASE WHEN fr.from_user_id = ? THEN fr.to_user_id ELSE fr.from_user_id END)
       WHERE fr.from_user_id = ? OR fr.to_user_id = ?
       ORDER BY fr.updated_at DESC`,
      [req.user.id, req.user.id, req.user.id],
      (err, rows) => {
        if (err) return res.status(500).json({ error: 'Erro ao carregar amigos.' });
        const friends = [], incoming = [], outgoing = [];
        (rows || []).forEach(r => {
          const entry = { requestId: r.id, id: r.nickname === req.user.nickname ? null : null, nickname: r.nickname, displayName: r.display_name, online: false };
          const otherId = (r.from_user_id === req.user.id) ? r.to_user_id : r.from_user_id;
          entry.online = accountSocketMap.has(otherId);
          entry.userId = otherId;
          if (r.status === 'accepted') friends.push(entry);
          else if (r.status === 'pending' && r.to_user_id === req.user.id) incoming.push(entry);
          else if (r.status === 'pending' && r.from_user_id === req.user.id) outgoing.push(entry);
        });
        res.json({ friends, incoming, outgoing });
      }
    );
  });

  // Enviar pedido de amizade
  app.post('/api/friends/request', authenticate, (req, res) => {
    const nickname = (req.body?.nickname || '').trim().toLowerCase();
    if (!nickname) return res.status(400).json({ error: 'Informe o nickname.' });
    db.get('SELECT id, nickname FROM users WHERE nickname_lower = ?', [nickname], (err, target) => {
      if (err || !target) return res.status(404).json({ error: 'Jogador não encontrado.' });
      if (target.id === req.user.id) return res.status(400).json({ error: 'Você não pode adicionar a si mesmo.' });

      db.get(
        `SELECT * FROM friend_requests WHERE (from_user_id=? AND to_user_id=?) OR (from_user_id=? AND to_user_id=?)`,
        [req.user.id, target.id, target.id, req.user.id],
        (err2, existing) => {
          if (existing) {
            if (existing.status === 'accepted') return res.status(409).json({ error: 'Vocês já são amigos.' });
            if (existing.status === 'pending') return res.status(409).json({ error: 'Já existe um pedido pendente entre vocês.' });
          }
          const done = () => {
            db.run(
              'INSERT INTO friend_requests (from_user_id, to_user_id, status) VALUES (?, ?, \'pending\')',
              [req.user.id, target.id],
              function (err3) {
                if (err3) return res.status(500).json({ error: 'Erro ao enviar pedido.' });
                // Notifica o amigo em tempo real, se ele estiver online agora.
                const targetSocketId = accountSocketMap.get(target.id);
                if (targetSocketId && global.__batalhaIo) {
                  global.__batalhaIo.to(targetSocketId).emit('friend-request-received', {
                    requestId: this.lastID, fromNickname: req.user.nickname,
                  });
                }
                res.json({ ok: true });
              }
            );
          };
          // Se existia um pedido RECUSADO antes, apaga antes de criar um novo
          // (a constraint UNIQUE não deixaria inserir duplicado).
          if (existing && existing.status === 'declined') {
            db.run('DELETE FROM friend_requests WHERE id = ?', [existing.id], done);
          } else {
            done();
          }
        }
      );
    });
  });

  // Aceitar/recusar pedido recebido
  app.post('/api/friends/respond', authenticate, (req, res) => {
    const { requestId, accept } = req.body || {};
    db.get('SELECT * FROM friend_requests WHERE id = ? AND to_user_id = ?', [requestId, req.user.id], (err, row) => {
      if (err || !row) return res.status(404).json({ error: 'Pedido não encontrado.' });
      const newStatus = accept ? 'accepted' : 'declined';
      db.run('UPDATE friend_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, requestId], (err2) => {
        if (err2) return res.status(500).json({ error: 'Erro ao responder pedido.' });
        const requesterSocketId = accountSocketMap.get(row.from_user_id);
        if (requesterSocketId && global.__batalhaIo) {
          global.__batalhaIo.to(requesterSocketId).emit('friend-request-answered', {
            accepted: !!accept, byNickname: req.user.nickname,
          });
        }
        res.json({ ok: true });
      });
    });
  });

  // Remover amigo (desfaz a amizade)
  app.post('/api/friends/remove', authenticate, (req, res) => {
    const { userId } = req.body || {};
    db.run(
      `DELETE FROM friend_requests WHERE status='accepted' AND
       ((from_user_id=? AND to_user_id=?) OR (from_user_id=? AND to_user_id=?))`,
      [req.user.id, userId, userId, req.user.id],
      (err) => {
        if (err) return res.status(500).json({ error: 'Erro ao remover.' });
        res.json({ ok: true });
      }
    );
  });
}

// ==================== SOCKET.IO (identificação + desafio) ====================
// Chamado uma vez por conexão dentro do `io.on('connection', socket => {...})`
// já existente no server.js do jogo.
function registerSocketHandlers(io, socket) {
  global.__batalhaIo = io; // usado pelas rotas REST acima pra empurrar notificação

  // O cliente chama isso logo que conecta, SE estiver logado (ver
  // multiplayer.js) — sem isso, o socket simplesmente não é rastreado
  // como "essa conta está online agora" (jogador sem login continua
  // funcionando normalmente, só não aparece pra amigos nenhum).
  socket.on('auth-identify', (data) => {
    const payload = verifyToken(data && data.token);
    if (!payload) return;
    socket.accountId = payload.id;
    socket.accountNickname = payload.nickname;
    accountSocketMap.set(payload.id, socket.id);
  });

  // PEDIDO: "desafiar amigo" — o desafiante já criou a sala do jeito
  // normal (create-room, ver server.js) e manda aqui só o roomId; a
  // gente entrega o convite pro amigo em tempo real, SE ele estiver
  // online. Se não estiver, avisa o desafiante na hora (sem ficar
  // esperando à toa).
  socket.on('challenge-friend', (data, cb) => {
    if (!socket.accountId) { if (cb) cb({ success: false, message: 'Faça login pra desafiar amigos.' }); return; }
    const { friendUserId, roomId, roomName, password } = data || {};
    const targetSocketId = accountSocketMap.get(friendUserId);
    if (!targetSocketId) { if (cb) cb({ success: false, message: 'Seu amigo não está online agora.' }); return; }

    io.to(targetSocketId).emit('challenge-invite', {
      fromSocketId: socket.id,
      fromNickname: socket.accountNickname,
      roomId, roomName, password: !!password,
    });
    if (cb) cb({ success: true });
  });

  // Resposta do amigo desafiado (aceitar entra na sala pelo fluxo
  // normal de join-room no cliente; aqui só avisamos de volta quem
  // desafiou, pra ele saber o que aconteceu em vez de ficar esperando).
  socket.on('challenge-response', (data) => {
    const { fromSocketId, accept } = data || {};
    if (!fromSocketId) return;
    io.to(fromSocketId).emit('challenge-response', {
      accepted: !!accept,
      byNickname: socket.accountNickname || 'Seu amigo',
    });
  });

  socket.on('disconnect', () => {
    if (socket.accountId && accountSocketMap.get(socket.accountId) === socket.id) {
      accountSocketMap.delete(socket.accountId);
    }
  });
}

module.exports = { mount, registerSocketHandlers, accountSocketMap };