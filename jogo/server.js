const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});
app.use(express.static(path.join(__dirname, "public")));

// ===== DADOS =====
const rooms = new Map();
const sockets = new Map();
let roomCounter = 0;

// ===== CHAT DE VOZ (WebRTC, sinalização via este WebSocket) =====
// Cada sala (inclusive a Sala Livre) tem seu próprio "voiceRooms" — um
// Map(roomId -> Map(socketId -> {name,color,muted})). O áudio em si NUNCA
// passa pelo servidor: aqui só repassamos offer/answer/ICE entre os pares
// (malha WebRTC, cada participante conecta direto com os outros). Por
// isso o limite de 6 — acima disso o número de conexões P2P por pessoa
// (malha completa) fica pesado demais pro navegador aguentar bem.
const voiceRooms = new Map();
const VOICE_MAX_PARTICIPANTS = 6;

function voiceRoomFor(roomId) {
  let vr = voiceRooms.get(roomId);
  if (!vr) { vr = new Map(); voiceRooms.set(roomId, vr); }
  return vr;
}

function cleanupVoiceForSocket(socketId, roomId) {
  if (!roomId) return;
  const vr = voiceRooms.get(roomId);
  if (vr && vr.has(socketId)) {
    vr.delete(socketId);
    io.to(roomId).emit("voice-peer-left", { id: socketId });
    if (vr.size === 0) voiceRooms.delete(roomId);
  }
}
const MAX_HEALTH = 100;
const DAMAGE = {
  basic: 50, missile: 100, bomb: 100, mg: 34, field: 22,
  // NOVO — dano dos aviões/habilidades adicionados agora:
  'light-trail-orb': 25,       // explosão individual de cada bola do 737
  'biplano-mg': 34,            // super metralhadora do Hilson Bi-Mono
  'xwing-laser': 20,           // metralhadora laser do X-Wing (10 tiros/s)
  'heli-shockwave': 50,        // pulso de onda de choque (2 pulsos matam)
};
const VALID_PLANES = [
  "quatorzebis", "cessna", "biplano", "bimotor", "seneca",
  "jato", "amx", "f22", "sr71",
  "boing", "b737", "b2spirit",
  "heli", "ovni", "xwing"
];
const TAKEOFF_GRACE = 14;       // segundos de decolagem livre antes do combate liberar (salas normais)
const LOADING_TIMEOUT = 15000;  // espera máxima por quem está carregando os assets
const FIELD_RANGE = 15;         // alcance do campo de dano do Jato
const FIELD_HIT_COOLDOWN = 0.5;

// ===== SALA LIVRE =====
// PEDIDO: um mata-mata persistente, sempre "em andamento", sem lobby,
// sem host e sem "pronto" — dá pra entrar e sair a qualquer momento.
// Cada jogador tem sua PRÓPRIA janela de invulnerabilidade ao entrar
// (ou reaparecer depois de abatido), em vez de um cronômetro da sala
// inteira — assim quem já está lutando não é interrompido pela chegada
// de gente nova.
const FREE_ROOM_ID = "LIVRE";
const FREE_ROOM_MAX_PLAYERS = 24;
const FREE_TAKEOFF_GRACE = 10;   // segundos sem dano ao entrar/reaparecer
const FREE_RESPAWN_DELAY = 2800; // tempo abatido até reaparecer sozinho

const VALID_MAPS = ["cidade", "deserto", "floresta", "laboratorio"];
const VALID_MODES = ["ffa", "teams"];
const VALID_PLANE_MODES = ["livre", "sorteio"];

function genRoomId() { return (++roomCounter).toString(36).toUpperCase(); }

function makePlayer(socket, data) {
  const pilotNum = parseInt(data.pilot, 10);
  return {
    id: socket.id,
    name: (data.name || "Piloto").slice(0, 18),
    color: data.color || "#00e5ff",
    pilot: (pilotNum >= 1 && pilotNum <= 15) ? pilotNum : 1,
    planeType: VALID_PLANES.includes(data.planeType) ? data.planeType : "cessna",
    vote: null,
    team: null,
    ready: false,
    state: "alive",
    health: MAX_HEALTH,
    shield: 0,
    kills: 0,
    deaths: 0,
    position: { x: 0, y: 0.1, z: 0 },
    yaw: 0, pitch: 0, roll: 0,
    abilityActive: false,
    abilityTimer: 0,
    abilityCooldown: 0,
    invisible: false,
    invulnerable: false,
    fieldCooldowns: new Map(),
  };
}

function createRoom(hostSocket, data) {
  const id = genRoomId();
  const room = {
    id, name: data.roomName || ("Esquadrão " + id),
    password: data.password || "",
    maxPlayers: Math.min(10, Math.max(2, parseInt(data.maxPlayers) || 6)),
    map: VALID_MAPS.includes(data.map) ? data.map : "cidade",
    mode: VALID_MODES.includes(data.mode) ? data.mode : "ffa",
    planeMode: VALID_PLANE_MODES.includes(data.planeMode) ? data.planeMode : "livre",
    hostId: hostSocket.id,
    players: [],
    state: "waiting", // waiting -> loading -> playing -> finished
    prepTimer: 0,
    combatEnabled: false,
    playersLoaded: new Set(),
    loadingTimeout: null,
    isFreeRoom: false,
  };
  rooms.set(id, room);
  return room;
}

// Cria a Sala Livre na primeira vez que alguém tenta entrar (ou recupera
// a mesma sala se ela já existir — ela nunca é apagada, mesmo vazia).
function ensureFreeRoom() {
  let room = rooms.get(FREE_ROOM_ID);
  if (!room) {
    room = {
      id: FREE_ROOM_ID, name: "Sala Livre", password: "",
      maxPlayers: FREE_ROOM_MAX_PLAYERS, map: "cidade", mode: "ffa", planeMode: "livre",
      hostId: null, players: [], state: "playing",
      prepTimer: 0, combatEnabled: true,
      playersLoaded: new Set(), loadingTimeout: null,
      isFreeRoom: true,
    };
    rooms.set(FREE_ROOM_ID, room);
  }
  return room;
}

// Espalha os spawns da sala livre num raio amplo, longe do centro, pra
// gente que acabou de entrar não nascer em cima de quem já está voando.
function randomFreeSpawn() {
  const angle = Math.random() * Math.PI * 2;
  const radius = 25 + Math.random() * 55;
  return { x: Math.cos(angle) * radius, y: 0.1, z: Math.sin(angle) * radius - 100 };
}

function scheduleTakeoffGrace(room, p) {
  setTimeout(() => {
    const room2 = rooms.get(room.id);
    if (!room2) return;
    const stillThere = room2.players.find(pl => pl.id === p.id);
    if (stillThere) stillThere.invulnerable = false;
  }, FREE_TAKEOFF_GRACE * 1000);
}

function reassignTeams(room) {
  if (room.mode !== "teams") { room.players.forEach(p => p.team = null); return; }
  room.players.forEach((p, idx) => { p.team = (idx % 2 === 0) ? "red" : "blue"; });
}

function addPlayer(socket, roomId, playerData) {
  const room = rooms.get(roomId);
  if (!room) return null;
  if (room.players.length >= room.maxPlayers) return null;
  const p = makePlayer(socket, playerData);
  room.players.push(p);
  if (room.mode === "teams") reassignTeams(room);
  sockets.set(socket.id, roomId);
  socket.join(roomId);
  return p;
}

function removePlayer(socketId) {
  const roomId = sockets.get(socketId);
  if (!roomId) return;
  cleanupVoiceForSocket(socketId, roomId);
  const room = rooms.get(roomId);
  if (room) {
    room.players = room.players.filter(p => p.id !== socketId);
    room.playersLoaded.delete(socketId);
    if (room.hostId === socketId && room.players.length) room.hostId = room.players[0].id;
    if (room.players.length === 0) {
      if (room.loadingTimeout) clearTimeout(room.loadingTimeout);
      // A Sala Livre é persistente: continua existindo mesmo vazia, pronta
      // pro próximo piloto entrar direto sem precisar recriar nada.
      if (!room.isFreeRoom) rooms.delete(roomId);
    }
    else {
      if (room.mode === "teams") reassignTeams(room);
      broadcastRoom(roomId);
      if (room.state === "playing") checkFFAEnd(room);
      if (room.state === "loading") checkAllLoaded(room);
    }
  }
  sockets.delete(socketId);
  io.to(roomId).emit("player-left", { id: socketId });
}

function roomState(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  return {
    id: room.id, name: room.name, map: room.map, mode: room.mode, planeMode: room.planeMode,
    maxPlayers: room.maxPlayers, hostId: room.hostId, state: room.state,
    players: room.players.map(p => ({
      id: p.id, name: p.name, color: p.color, planeType: p.planeType, vote: p.vote,
      team: p.team, ready: p.ready, state: p.state,
      health: p.health, shield: p.shield, kills: p.kills, deaths: p.deaths,
    })),
  };
}

function broadcastRoom(roomId) {
  const s = roomState(roomId);
  if (s) io.to(roomId).emit("room-update", s);
}

function roomList() {
  const list = [];
  for (const [id, room] of rooms) {
    if (room.state === "waiting") {
      list.push({ id: room.id, name: room.name, players: room.players.length, maxPlayers: room.maxPlayers,
        hasPassword: !!room.password, map: room.map, mode: room.mode, planeMode: room.planeMode });
    }
  }
  return list;
}

function resetRoom(room) {
  room.state = "waiting";
  room.prepTimer = 0;
  room.combatEnabled = false;
  room.playersLoaded = new Set();
  if (room.loadingTimeout) { clearTimeout(room.loadingTimeout); room.loadingTimeout = null; }
  room.players.forEach(p => {
    p.ready = false; p.state = "alive"; p.health = MAX_HEALTH; p.shield = 0;
    p.kills = 0; p.deaths = 0; p.abilityActive = false; p.abilityTimer = 0; p.abilityCooldown = 0;
    p.invisible = false; p.invulnerable = false; p.vote = null; p.fieldCooldowns = new Map();
  });
  broadcastRoom(room.id);
  io.to(room.id).emit("room-reset");
}

function snapshot(room) {
  return {
    players: room.players.map(p => ({
      id: p.id, state: p.state, health: p.health, shield: p.shield, kills: p.kills, deaths: p.deaths,
      position: p.position, yaw: p.yaw, pitch: p.pitch, roll: p.roll,
      abilityActive: p.abilityActive, abilityTimer: p.abilityTimer, abilityCooldown: p.abilityCooldown,
      invisible: p.invisible, invulnerable: p.invulnerable, team: p.team, planeType: p.planeType,
    })),
    prepTimer: room.prepTimer, combatEnabled: room.combatEnabled,
  };
}

// ===== SPAWN NA PISTA (em linha, encarando a mesma direção) =====
function spawnPositions(room) {
  room.players.forEach((p, idx) => {
    const row = Math.floor(idx / 2);
    const side = (idx % 2 === 0) ? -1 : 1;
    p.position = { x: side * 5, y: 0.1, z: -row * 10 + 2 };
    p.yaw = 0; p.pitch = 0; p.roll = 0;
  });
}

// ===== RESOLVER MODO SORTEIO/VOTAÇÃO =====
function resolvePlaneSelection(room) {
  if (room.planeMode !== "sorteio") return;
  let winner;
  if (room.players.length <= 2) {
    winner = VALID_PLANES[Math.floor(Math.random() * VALID_PLANES.length)];
  } else {
    const tally = {};
    room.players.forEach(p => { if (p.vote) tally[p.vote] = (tally[p.vote] || 0) + 1; });
    const entries = Object.entries(tally);
    if (entries.length === 0) {
      winner = VALID_PLANES[Math.floor(Math.random() * VALID_PLANES.length)];
    } else {
      const maxVotes = Math.max(...entries.map(e => e[1]));
      const top = entries.filter(e => e[1] === maxVotes).map(e => e[0]);
      winner = top[Math.floor(Math.random() * top.length)];
    }
  }
  room.players.forEach(p => { p.planeType = winner; });
  return winner;
}

function startGame(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.state !== "waiting") return;
  const sorteioResult = resolvePlaneSelection(room);

  room.state = "loading";
  room.playersLoaded = new Set();
  room.combatEnabled = false;
  room.prepTimer = 0;
  room.players.forEach(p => {
    p.state = "alive"; p.health = MAX_HEALTH; p.shield = 0; p.kills = 0; p.deaths = 0;
    p.invisible = false; p.invulnerable = true;
    p.abilityActive = false; p.abilityTimer = 0; p.abilityCooldown = 0;
    p.fieldCooldowns = new Map();
  });
  spawnPositions(room);

  broadcastRoom(roomId);
  io.to(roomId).emit("match-loading", {
    mode: room.mode, map: room.map, planeMode: room.planeMode, sorteioResult,
    players: room.players.map(p => ({
      id: p.id, name: p.name, color: p.color, planeType: p.planeType,
      team: p.team, position: p.position, yaw: p.yaw, health: p.health,
    })),
  });

  if (room.loadingTimeout) clearTimeout(room.loadingTimeout);
  room.loadingTimeout = setTimeout(() => beginPlaying(room), LOADING_TIMEOUT);
}

function checkAllLoaded(room) {
  if (room.state !== "loading") return;
  if (room.players.length > 0 && room.playersLoaded.size >= room.players.length) beginPlaying(room);
}

function beginPlaying(room) {
  if (room.state !== "loading") return;
  if (room.loadingTimeout) { clearTimeout(room.loadingTimeout); room.loadingTimeout = null; }
  room.state = "playing";
  room.prepTimer = TAKEOFF_GRACE;
  room.combatEnabled = false;
  broadcastRoom(room.id);
  io.to(room.id).emit("match-begin", { prepTime: TAKEOFF_GRACE });
}

function endMatch(room, resultMsg, winner) {
  room.state = "finished";
  io.to(room.id).emit("match-end", {
    message: resultMsg, winner,
    standings: room.players.map(p => ({ name: p.name, kills: p.kills, deaths: p.deaths })),
  });
  setTimeout(() => resetRoom(room), 8000);
}

function checkFFAEnd(room) {
  // A Sala Livre nunca acaba — é um mata-mata contínuo, sem placar final
  // nem tela de vitória; dá pra entrar e sair o quanto quiser.
  if (room.state !== "playing" || room.isFreeRoom) return;
  if (room.mode === "teams") {
    const red = room.players.filter(p => p.team === "red" && p.state === "alive");
    const blue = room.players.filter(p => p.team === "blue" && p.state === "alive");
    if (room.players.filter(p => p.team === 'red').length === 0 || room.players.filter(p => p.team === 'blue').length === 0) return;
    if (red.length === 0) { endMatch(room, "Esquadrão Azul venceu!", "blue"); return; }
    if (blue.length === 0) { endMatch(room, "Esquadrão Vermelho venceu!", "red"); return; }
    return;
  }
  const alive = room.players.filter(p => p.state === "alive");
  if (room.players.length <= 1) return;
  if (alive.length <= 1) {
    const winner = alive[0] || null;
    endMatch(room, winner ? (winner.name + " venceu!") : "Fim de partida", winner ? { id: winner.id, name: winner.name } : null);
  }
}

// ===== SALA LIVRE: reaparece sozinho após ser abatido, com uma nova
// janela de invulnerabilidade — sem afetar mais ninguém na sala. =====
function scheduleFreeRespawn(room, playerId) {
  setTimeout(() => {
    const room2 = rooms.get(room.id);
    if (!room2) return;
    const p = room2.players.find(pl => pl.id === playerId);
    if (!p) return; // já saiu da sala
    const spawn = randomFreeSpawn();
    p.state = "alive";
    p.health = MAX_HEALTH;
    p.shield = 0;
    p.position = spawn;
    p.yaw = Math.random() * Math.PI * 2;
    p.pitch = 0; p.roll = 0;
    p.invulnerable = true;
    p.abilityActive = false; p.abilityTimer = 0; p.abilityCooldown = 0;
    p.fieldCooldowns = new Map();
    io.to(room2.id).emit("player-respawned", { id: p.id, position: p.position, yaw: p.yaw });
    broadcastRoom(room2.id);
    scheduleTakeoffGrace(room2, p);
  }, FREE_RESPAWN_DELAY);
}

function applyDamage(room, targetId, dmg, shooterId, weaponType) {
  const target = room.players.find(p => p.id === targetId);
  if (!target || target.state !== "alive") return;
  if (target.invulnerable) return;
  if (room.mode === "teams") {
    const shooter = room.players.find(p => p.id === shooterId);
    if (shooter && shooter.team === target.team) return; // fogo amigo desligado
  }
  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, dmg);
    target.shield -= absorbed;
    dmg -= absorbed;
    if (dmg <= 0) { io.to(room.id).emit("health-update", { id: targetId, health: target.health, shield: target.shield }); return; }
  }
  target.health = Math.max(0, target.health - dmg);
  if (target.health <= 0) {
    target.state = "dead";
    target.health = 0;
    target.deaths++;
    const shooter = room.players.find(p => p.id === shooterId);
    if (shooter && shooter.id !== targetId) {
      shooter.kills++;
      // PEDIDO: Sala Livre — abater alguém cura o atirador por completo.
      // Só nesse modo: nas salas criadas a vida fica como está até a
      // partida acabar (aviões de suporte que curam vêm depois).
      if (room.isFreeRoom) {
        shooter.health = MAX_HEALTH;
        io.to(room.id).emit("health-update", { id: shooter.id, health: shooter.health, shield: shooter.shield });
      }
    }
    // PEDIDO: manda os nomes junto pro feed de abates do cliente poder
    // mostrar "Fulano abateu Ciclano" sem precisar de outra consulta.
    io.to(room.id).emit("player-killed", {
      id: targetId, killerId: shooterId, weapon: weaponType,
      killerName: shooter ? shooter.name : null, targetName: target.name,
    });
    broadcastRoom(room.id);
    if (room.isFreeRoom) {
      scheduleFreeRespawn(room, target.id);
    } else {
      checkFFAEnd(room);
    }
  } else {
    io.to(room.id).emit("health-update", { id: targetId, health: target.health, shield: target.shield });
  }
}

// ===== SOCKET HANDLERS =====
io.on("connection", (socket) => {
  socket.on("list-rooms", (cb) => cb(roomList()));

  socket.on("create-room", (data, cb) => {
    const room = createRoom(socket, data);
    const p = addPlayer(socket, room.id, data.playerData || {});
    if (!p) return cb({ success: false, message: "Erro ao criar sala." });
    cb({ success: true, roomId: room.id });
    broadcastRoom(room.id);
  });

  socket.on("join-room", (data, cb) => {
    const room = rooms.get(data.roomId);
    if (!room) return cb({ success: false, message: "Sala não encontrada." });
    if (room.password && room.password !== data.password) return cb({ success: false, message: "Senha incorreta." });
    if (room.players.length >= room.maxPlayers) return cb({ success: false, message: "Sala cheia." });
    if (room.state !== "waiting") return cb({ success: false, message: "Partida em andamento." });
    const p = addPlayer(socket, data.roomId, data.playerData || {});
    if (!p) return cb({ success: false, message: "Erro ao entrar." });
    cb({ success: true });
    broadcastRoom(data.roomId);
  });

  // PEDIDO: SALA LIVRE — entra direto na partida contínua, sem senha,
  // sem lobby, sem esperar host ninguém ficar "pronto". Ganha um tempo
  // de decolagem sem dano só seu (os outros jogadores continuam o
  // combate deles normalmente).
  socket.on("join-free-room", (playerData, cb) => {
    const room = ensureFreeRoom();
    if (room.players.length >= room.maxPlayers) {
      if (cb) cb({ success: false, message: "Sala Livre lotada no momento, tente novamente em instantes." });
      return;
    }
    const p = makePlayer(socket, playerData || {});
    p.position = randomFreeSpawn();
    p.yaw = Math.random() * Math.PI * 2;
    p.state = "alive";
    p.health = MAX_HEALTH;
    p.invulnerable = true;
    room.players.push(p);
    sockets.set(socket.id, room.id);
    socket.join(room.id);
    scheduleTakeoffGrace(room, p);
    if (cb) cb({ success: true, roomId: room.id });
    broadcastRoom(room.id);
    // CORREÇÃO: quem já está voando na Sala Livre nunca ficava sabendo que
    // alguém novo entrou — só o próprio jogador recebia a lista completa
    // (evento "free-room-enter" logo abaixo). Sem isso, o avião do novo
    // jogador nunca aparecia pra quem já estava na sala.
    socket.to(room.id).emit("player-joined", {
      id: p.id, name: p.name, color: p.color, planeType: p.planeType,
      team: p.team, position: p.position, yaw: p.yaw, health: p.health,
    });
    socket.emit("free-room-enter", {
      map: room.map, mode: room.mode,
      players: room.players.map(pl => ({
        id: pl.id, name: pl.name, color: pl.color, planeType: pl.planeType,
        team: pl.team, position: pl.position, yaw: pl.yaw, health: pl.health,
      })),
    });
  });

  socket.on("leave-room", () => { removePlayer(socket.id); });

  socket.on("set-ready", (ready) => {
    const roomId = sockets.get(socket.id); const room = rooms.get(roomId); if (!room) return;
    const p = room.players.find(pl => pl.id === socket.id); if (!p) return;
    p.ready = !!ready;
    broadcastRoom(roomId);
  });

  socket.on("set-plane", (planeType) => {
    const roomId = sockets.get(socket.id); const room = rooms.get(roomId); if (!room) return;
    if (room.state !== "waiting") return;
    const p = room.players.find(pl => pl.id === socket.id); if (!p) return;
    if (!VALID_PLANES.includes(planeType)) return;
    if (room.planeMode === "sorteio") p.vote = planeType;
    else p.planeType = planeType;
    broadcastRoom(roomId);
  });

  socket.on("set-team", (team) => {
    const roomId = sockets.get(socket.id); const room = rooms.get(roomId); if (!room || room.mode !== "teams") return;
    const p = room.players.find(pl => pl.id === socket.id); if (!p) return;
    if (team !== "red" && team !== "blue") return;
    p.team = team; p.ready = false;
    broadcastRoom(roomId);
  });

  socket.on("set-room-settings", (data) => {
    const roomId = sockets.get(socket.id); const room = rooms.get(roomId); if (!room) return;
    if (room.hostId !== socket.id || room.state !== "waiting") return;
    let teamsChanged = false;
    if (data && VALID_MAPS.includes(data.map)) room.map = data.map;
    if (data && VALID_MODES.includes(data.mode) && data.mode !== room.mode) { room.mode = data.mode; teamsChanged = true; }
    if (data && VALID_PLANE_MODES.includes(data.planeMode)) room.planeMode = data.planeMode;
    if (teamsChanged) reassignTeams(room);
    room.players.forEach(p => { p.ready = false; p.vote = null; });
    broadcastRoom(roomId);
  });

  socket.on("transfer-host", (targetId) => {
    const roomId = sockets.get(socket.id); const room = rooms.get(roomId); if (!room) return;
    if (room.hostId !== socket.id) return;
    if (!room.players.some(p => p.id === targetId)) return;
    room.hostId = targetId;
    broadcastRoom(roomId);
  });

  socket.on("start-game", () => {
    const roomId = sockets.get(socket.id); const room = rooms.get(roomId); if (!room) return;
    if (room.hostId !== socket.id || room.state !== "waiting") return;
    if (!room.players.every(p => p.ready)) { socket.emit("error", { message: "Nem todos estão prontos." }); return; }
    if (room.mode === "teams") {
      const hasRed = room.players.some(p => p.team === "red");
      const hasBlue = room.players.some(p => p.team === "blue");
      if (!hasRed || !hasBlue) { socket.emit("error", { message: "Precisa de pelo menos 1 piloto em cada esquadrão." }); return; }
    }
    startGame(roomId);
  });

  socket.on("client-loaded", () => {
    const roomId = sockets.get(socket.id); const room = rooms.get(roomId); if (!room || room.state !== "loading") return;
    room.playersLoaded.add(socket.id);
    checkAllLoaded(room);
  });

  socket.on("update", (data) => {
    const roomId = sockets.get(socket.id); const room = rooms.get(roomId);
    if (!room || room.state !== "playing") return;
    const p = room.players.find(pl => pl.id === socket.id);
    if (!p || p.state !== "alive") return;
    p.position = { x: data.x, y: data.y, z: data.z };
    p.yaw = data.yaw; p.pitch = data.pitch; p.roll = data.roll;
  });

  socket.on("shot-fired", (d) => {
    const roomId = sockets.get(socket.id); const room = rooms.get(roomId);
    if (!room || room.state !== "playing" || !room.combatEnabled) return;
    socket.to(roomId).emit("shot-fired", { id: socket.id, origin: d.origin, direction: d.direction, weaponType: d.weaponType || "basic" });
  });

  socket.on("bomb-fired", (d) => {
    const roomId = sockets.get(socket.id); const room = rooms.get(roomId);
    if (!room || room.state !== "playing" || !room.combatEnabled) return;
    socket.to(roomId).emit("bomb-fired", { id: socket.id, origin: d.origin, velocity: d.velocity });
  });

  socket.on("mg-fired", (d) => {
    const roomId = sockets.get(socket.id); const room = rooms.get(roomId);
    if (!room || room.state !== "playing" || !room.combatEnabled) return;
    socket.to(roomId).emit("mg-fired", {
      id: socket.id, origin: d.origin, direction: d.direction,
      color: d.color, explosionColor: d.explosionColor, weaponType: d.weaponType, speed: d.speed
    });
  });

  // NOVO — pulso de onda de choque do Helicóptero: só repassa pra sala
  // (o dano de verdade já foi resolvido no cliente de quem usou a
  // habilidade, via resolveBombDamage + evento 'hit' individual — isso
  // aqui é só pra todo mundo ver o anel se expandindo).
  socket.on("shockwave-pulse", (d) => {
    const roomId = sockets.get(socket.id); const room = rooms.get(roomId);
    if (!room || room.state !== "playing" || !room.combatEnabled) return;
    socket.to(roomId).emit("shockwave-pulse", { id: socket.id, position: d.position, radius: d.radius, color: d.color });
  });

  socket.on("laser-update", (d) => {
    const roomId = sockets.get(socket.id); const room = rooms.get(roomId);
    if (!room || room.state !== "playing" || !room.combatEnabled) return;
    if (!d.active) { socket.to(roomId).emit("laser-update", { id: socket.id, active: false }); return; }
    socket.to(roomId).emit("laser-update", { id: socket.id, position: d.position, direction: d.direction, active: true });
  });

  // ===== NOVO: RETRANSMISSÃO DA EXPLOSÃO (BOMB-EXPLODED) =====
  socket.on("bomb-exploded", (data) => {
    const roomId = sockets.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room || room.state !== "playing" || !room.combatEnabled) return;
    // Retransmite para todos os OUTROS jogadores na sala
    socket.to(roomId).emit("bomb-exploded", data);
  });

  socket.on("hit", (d) => {
    const roomId = sockets.get(socket.id); const room = rooms.get(roomId);
    if (!room || room.state !== "playing" || !room.combatEnabled) return;
    const shooter = room.players.find(p => p.id === socket.id);
    if (!shooter || shooter.state !== "alive") return;
    const target = room.players.find(p => p.id === d.targetId);
    if (!target || target.state !== "alive") return;
    const dmg = DAMAGE[d.weaponType] || DAMAGE.basic;
    applyDamage(room, d.targetId, dmg, socket.id, d.weaponType);
  });

  socket.on("ability-trigger", () => {
    const roomId = sockets.get(socket.id); const room = rooms.get(roomId);
    if (!room || room.state !== "playing" || !room.combatEnabled) return;
    const p = room.players.find(pl => pl.id === socket.id);
    if (!p || p.state !== "alive" || p.abilityCooldown > 0 || p.abilityActive) return;
    p.abilityActive = true;
    p.abilityTimer = 5.0;
    p.abilityCooldown = 22.0;
    io.to(roomId).emit("ability-activated", { id: socket.id, type: p.planeType });
  });

  // ===== CHAT DE VOZ =====
  // Entrar no chat de voz da sala atual (sala criada OU sala livre — as
  // duas já usam socket.join(roomId) em join-room/create-room/join-free-room,
  // então "a sala atual" é sempre sockets.get(socket.id)).
  socket.on("voice-join", (data, cb) => {
    const roomId = sockets.get(socket.id);
    if (!roomId) { if (cb) cb({ success: false, message: "Você precisa estar em uma sala." }); return; }
    const vr = voiceRoomFor(roomId);
    if (vr.has(socket.id)) {
      if (cb) cb({ success: true, roomId, participants: [...vr.entries()].filter(([id]) => id !== socket.id).map(([id, p]) => ({ id, ...p })) });
      return;
    }
    if (vr.size >= VOICE_MAX_PARTICIPANTS) {
      if (cb) cb({ success: false, message: "Chat de voz cheio (máximo 6 pessoas)." });
      return;
    }
    const name = ((data && data.name) || "Piloto").toString().slice(0, 18);
    const color = (data && data.color) || "#00e5ff";
    const muted = !!(data && data.muted);
    const pilotNum = parseInt(data && data.pilot, 10);
    const pilot = (pilotNum >= 1 && pilotNum <= 15) ? pilotNum : 1;
    vr.set(socket.id, { name, color, muted, pilot });
    const participants = [...vr.entries()].filter(([id]) => id !== socket.id).map(([id, p]) => ({ id, ...p }));
    if (cb) cb({ success: true, roomId, participants });
    socket.to(roomId).emit("voice-peer-joined", { id: socket.id, name, color, muted, pilot });
  });

  socket.on("voice-leave", () => {
    const roomId = sockets.get(socket.id);
    cleanupVoiceForSocket(socket.id, roomId);
  });

  socket.on("voice-mute-changed", (muted) => {
    const roomId = sockets.get(socket.id);
    const vr = roomId && voiceRooms.get(roomId);
    if (vr && vr.has(socket.id)) {
      vr.get(socket.id).muted = !!muted;
      socket.to(roomId).emit("voice-peer-mute", { id: socket.id, muted: !!muted });
    }
  });

  // Sinalização WebRTC pura (offer/answer/ICE candidates) — sempre
  // repassada direto pro par de destino, nunca em broadcast pra sala
  // inteira, já que cada par negocia sua própria conexão P2P.
  socket.on("voice-signal", (data) => {
    if (!data || !data.to) return;
    const roomId = sockets.get(socket.id);
    const vr = roomId && voiceRooms.get(roomId);
    // Só repassa se ambos ainda estiverem no mesmo chat de voz (evita
    // vazar sinalização pra fora da sala).
    if (!vr || !vr.has(socket.id) || !vr.has(data.to)) return;
    io.to(data.to).emit("voice-signal", { from: socket.id, payload: data.payload });
  });

  // ===== CHAT DE TEXTO DO LOBBY =====
  // Mesma sala (roomId) de sempre — funciona no lobby e, se a pessoa
  // continuar mandando mensagem já em partida, também funciona lá.
  socket.on("lobby-chat", (data) => {
    const roomId = sockets.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    const p = room && room.players.find(pl => pl.id === socket.id);
    const text = ((data && data.text) || "").toString().slice(0, 220).trim();
    if (!text) return;
    const name = (p && p.name) || (data && data.name) || "Piloto";
    const color = (p && p.color) || (data && data.color) || "#00e5ff";
    io.to(roomId).emit("lobby-chat", { id: socket.id, name, color, text, ts: Date.now() });
  });

  socket.on("disconnect", () => { removePlayer(socket.id); });
});

// ===== TICK =====
setInterval(() => {
  const dt = 50 / 1000;
  for (const [, room] of rooms) {
    if (room.state === "playing") {
      if (room.prepTimer > 0) {
        room.prepTimer -= dt;
        if (room.prepTimer <= 0) {
          room.prepTimer = 0;
          room.combatEnabled = true;
          room.players.forEach(p => p.invulnerable = false);
          io.to(room.id).emit("combat-enabled");
        }
      }
      room.players.forEach(p => {
        if (p.abilityActive) {
          p.abilityTimer -= dt;
          if (p.planeType === "sr71") p.invisible = true;
          if (p.planeType === "jato" && room.combatEnabled) {
            p.fieldCooldowns.forEach((v, k) => { const nv = v - dt; if (nv <= 0) p.fieldCooldowns.delete(k); else p.fieldCooldowns.set(k, nv); });
            room.players.forEach(other => {
              if (other.id === p.id || other.state !== "alive") return;
              if (room.mode === "teams" && other.team === p.team) return;
              if (p.fieldCooldowns.has(other.id)) return;
              const dx = other.position.x - p.position.x, dy = other.position.y - p.position.y, dz = other.position.z - p.position.z;
              const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
              if (dist < FIELD_RANGE) {
                p.fieldCooldowns.set(other.id, FIELD_HIT_COOLDOWN);
                applyDamage(room, other.id, DAMAGE.field, p.id, "field");
              }
            });
          }
          if (p.abilityTimer <= 0) {
            p.abilityActive = false; p.abilityTimer = 0;
            p.invisible = false;
            p.fieldCooldowns.clear();
          }
        } else if (p.abilityCooldown > 0) {
          p.abilityCooldown -= dt;
          if (p.abilityCooldown < 0) p.abilityCooldown = 0;
        }
      });
      io.to(room.id).emit("snapshot", snapshot(room));
    }
  }
}, 50);

const PORT = process.env.PORT || 3001;
server.listen(PORT, "127.0.0.1", () => {
  console.log(`✅ Servidor de Batalha Aérea rodando em http://localhost:${PORT}`);
  console.log(`✅ Aguardando conexões...`);
});