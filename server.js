require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const cors = require("cors");
process.on('uncaughtException', (err) => console.error('❌ [uncaughtException]', err));
process.on('unhandledRejection', (err) => console.error('❌ [unhandledRejection]', err));

const app = express();
app.use(cors()); // libera o site acessar /api/ranking etc.
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }, transports: ['websocket', 'polling'], allowEIO3: true, pingTimeout: 60000, pingInterval: 25000 });
app.use(express.json());
require("./auth").mount(app);
const profileModule = require("./profile");
const friendsModule = require("./friends");
profileModule.mount(app);
friendsModule.mount(app);
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));

const rooms = new Map();
const sockets = new Map();
let roomCounter = 0;
const voiceRooms = new Map();
const VOICE_MAX_PARTICIPANTS = 6;
function voiceRoomFor(roomId) { let vr = voiceRooms.get(roomId); if (!vr) { vr = new Map(); voiceRooms.set(roomId, vr); } return vr; }
function cleanupVoiceForSocket(socketId, roomId) { if (!roomId) return; const vr = voiceRooms.get(roomId); if (vr && vr.has(socketId)) { vr.delete(socketId); io.to(roomId).emit("voice-peer-left", { id: socketId }); if (vr.size === 0) voiceRooms.delete(roomId); } }

const MAX_HEALTH = 100;
const DAMAGE = { basic: 50, missile: 100, bomb: 100, mg: 34, field: 22, 'light-trail-orb': 25, 'biplano-mg': 34, 'xwing-laser': 20, 'heli-shockwave': 50, crash: 9999 };
const VALID_PLANES = ["quatorzebis", "cessna", "biplano", "bimotor", "seneca", "jato", "amx", "f22", "sr71", "boing", "b737", "b2spirit", "heli", "ovni", "xwing"];
const TAKEOFF_GRACE = 14, LOADING_TIMEOUT = 15000, FIELD_RANGE = 15, FIELD_HIT_COOLDOWN = 0.5;
const FREE_ROOM_ID = "LIVRE", FREE_ROOM_MAX_PLAYERS = 24, FREE_TAKEOFF_GRACE = 10, FREE_RESPAWN_DELAY = 2800;
const VALID_MAPS = ["cidade", "deserto", "floresta", "laboratorio"];
const VALID_MODES = ["ffa", "teams"];
const VALID_PLANE_MODES = ["livre", "sorteio"];
const MAP_WEATHER_PROFILES = { cidade: ["chuva", "neblina", "dirigivel"], deserto: ["tempestade", "dirigivel"], floresta: ["chuva", "neblina", "dirigivel"], laboratorio: [] };
const ATMO_GAP = 35, ATMO_ACTIVE = 35, ATMO_WARNING_LEAD = 8, ATMO_TRANSITION = 8, FREE_ATMO_GAP = 240, FREE_ATMO_ACTIVE = 120;
const BLIMP_BASE_GAP = 60, BLIMP_MIN_GAP_FLOOR = 5, BLIMP_WARNING_LEAD = 8, BLIMP_SPEED = 16, BLIMP_ALTITUDE_MIN = 65, BLIMP_ALTITUDE_MAX = 95, BLIMP_SPAWN_RADIUS = 650;

// ===== vida/dano por vida (pra medalhas Blindagem Viva / Implacável) =====
const lifeDamage = new Map();
const lifeStart = new Map();
function noteLifeStart(pid) { lifeStart.set(pid, Date.now()); lifeDamage.set(pid, 0); }

function initRoomWeather(room) {
  const gap = room.isFreeRoom ? FREE_ATMO_GAP : ATMO_GAP;
  room.weather = { atmo: { type: null, phase: "idle", timer: gap, duration: gap, lastType: null }, blimp: { phase: "idle", timer: BLIMP_BASE_GAP, duration: BLIMP_BASE_GAP, alive: false, gap: BLIMP_BASE_GAP, spawn: null } };
}
function pickAtmoType(options, exclude) { let pool = options; if (exclude && options.length > 1) { const f = options.filter(k => k !== exclude); if (f.length) pool = f; } return pool[Math.floor(Math.random() * pool.length)]; }
function makeBlimpSpawn() {
  const angle = Math.random() * Math.PI * 2;
  const alt = BLIMP_ALTITUDE_MIN + Math.random() * (BLIMP_ALTITUDE_MAX - BLIMP_ALTITUDE_MIN);
  const start = { x: Math.cos(angle) * BLIMP_SPAWN_RADIUS, y: alt, z: Math.sin(angle) * BLIMP_SPAWN_RADIUS };
  const end = { x: -start.x, y: alt, z: -start.z };
  const dx = end.x - start.x, dz = end.z - start.z;
  const totalDist = Math.sqrt(dx * dx + dz * dz);
  return { start, dir: { x: dx / totalDist, y: 0, z: dz / totalDist }, speed: BLIMP_SPEED, totalDist, flightTime: (totalDist + 40) / BLIMP_SPEED };
}
function weatherSnapshot(room) { const w = room.weather; if (!w) return null; return { atmo: { type: w.atmo.type, phase: w.atmo.phase, timer: Math.max(0, w.atmo.timer), duration: w.atmo.duration }, blimp: { phase: w.blimp.phase, timer: Math.max(0, w.blimp.timer), duration: w.blimp.duration, spawn: w.blimp.spawn } }; }
function updateRoomWeather(room, dt) {
  const w = room.weather; if (!w) return;
  if (room.isFreeRoom) return;
  const profile = MAP_WEATHER_PROFILES[room.map] || [];
  const options = profile.filter(k => k === "chuva" || k === "neblina" || k === "tempestade");
  const a = w.atmo;
  if (!options.length) { if (a.phase !== "idle") { a.phase = "idle"; a.type = null; a.timer = ATMO_GAP; a.duration = ATMO_GAP; io.to(room.id).emit("weather-phase", { type: null, phase: "idle", duration: ATMO_GAP }); } }
  else {
    a.timer -= dt;
    if (a.timer <= 0) {
      if (a.phase === "idle") { a.type = pickAtmoType(options, a.lastType); a.lastType = a.type; a.phase = "aviso"; a.timer = ATMO_WARNING_LEAD; a.duration = ATMO_WARNING_LEAD; }
      else if (a.phase === "aviso") { a.phase = "entrando"; a.timer = ATMO_TRANSITION; a.duration = ATMO_TRANSITION; }
      else if (a.phase === "entrando") { a.phase = "ativo"; a.timer = ATMO_ACTIVE; a.duration = ATMO_ACTIVE; }
      else if (a.phase === "ativo") { a.phase = "saindo"; a.timer = ATMO_TRANSITION; a.duration = ATMO_TRANSITION; }
      else if (a.phase === "saindo") { a.phase = "idle"; a.type = null; a.timer = ATMO_GAP; a.duration = ATMO_GAP; }
      io.to(room.id).emit("weather-phase", { type: a.type, phase: a.phase, duration: a.duration });
    }
  }
  const b = w.blimp;
  if (!profile.includes("dirigivel")) { if (b.phase !== "idle") { b.phase = "idle"; b.alive = false; b.spawn = null; b.timer = b.gap; b.duration = b.gap; io.to(room.id).emit("blimp-phase", { phase: "idle" }); } return; }
  b.timer -= dt;
  if (b.timer <= 0) {
    if (b.phase === "idle") { b.phase = "aviso"; b.timer = BLIMP_WARNING_LEAD; b.duration = BLIMP_WARNING_LEAD; io.to(room.id).emit("blimp-phase", { phase: "aviso", duration: BLIMP_WARNING_LEAD }); }
    else if (b.phase === "aviso") { const spawn = makeBlimpSpawn(); b.phase = "voando"; b.alive = true; b.spawn = spawn; b.timer = spawn.flightTime; b.duration = spawn.flightTime; io.to(room.id).emit("blimp-phase", { phase: "voando", duration: spawn.flightTime, spawn }); }
    else if (b.phase === "voando") { b.phase = "idle"; b.alive = false; b.spawn = null; b.gap = BLIMP_BASE_GAP; b.timer = b.gap; b.duration = b.gap; io.to(room.id).emit("blimp-phase", { phase: "idle" }); }
  }
}
function genRoomId() { return (++roomCounter).toString(36).toUpperCase(); }
function safeAvatarPhotoUrl(url) { if (typeof url !== "string") return null; if (!url.startsWith("/uploads/avatars/")) return null; return url.slice(0, 300); }
function makePlayer(socket, data) {
  const pilotNum = parseInt(data.pilot, 10);
  return { id: socket.id, name: (data.name || "Piloto").slice(0, 18), color: data.color || "#00e5ff", accountId: socket.accountId || null, pilot: (pilotNum >= 1 && pilotNum <= 16) ? pilotNum : 1, customPhotoUrl: safeAvatarPhotoUrl(data.customPhotoUrl), planeType: VALID_PLANES.includes(data.planeType) ? data.planeType : "cessna", vote: null, team: null, ready: false, state: "alive", health: MAX_HEALTH, shield: 0, kills: 0, deaths: 0, position: { x: 0, y: 0.1, z: 0 }, yaw: 0, pitch: 0, roll: 0, abilityActive: false, abilityTimer: 0, abilityCooldown: 0, invisible: false, invulnerable: false, fieldCooldowns: new Map() };
}
function createRoom(hostSocket, data) {
  const id = genRoomId();
  const room = { id, name: data.roomName || ("Esquadrão " + id), password: data.password || "", maxPlayers: Math.min(10, Math.max(2, parseInt(data.maxPlayers) || 6)), map: VALID_MAPS.includes(data.map) ? data.map : "cidade", mode: VALID_MODES.includes(data.mode) ? data.mode : "ffa", planeMode: VALID_PLANE_MODES.includes(data.planeMode) ? data.planeMode : "livre", hostId: hostSocket.id, players: [], state: "waiting", prepTimer: 0, combatEnabled: false, playersLoaded: new Set(), loadingTimeout: null, isFreeRoom: false, firstBlood: false };
  rooms.set(id, room); initRoomWeather(room); return room;
}
function ensureFreeRoom() {
  let room = rooms.get(FREE_ROOM_ID);
  if (!room) { room = { id: FREE_ROOM_ID, name: "Sala Livre", password: "", maxPlayers: FREE_ROOM_MAX_PLAYERS, map: "cidade", mode: "ffa", planeMode: "livre", hostId: null, players: [], state: "playing", prepTimer: 0, combatEnabled: true, playersLoaded: new Set(), loadingTimeout: null, isFreeRoom: true, firstBlood: false }; rooms.set(FREE_ROOM_ID, room); initRoomWeather(room); }
  return room;
}
function randomFreeSpawn() { const angle = Math.random() * Math.PI * 2; const radius = 25 + Math.random() * 55; return { x: Math.cos(angle) * radius, y: 0.1, z: Math.sin(angle) * radius - 100 }; }
function scheduleTakeoffGrace(room, p) { setTimeout(() => { const r2 = rooms.get(room.id); if (!r2) return; const st = r2.players.find(pl => pl.id === p.id); if (st) st.invulnerable = false; }, FREE_TAKEOFF_GRACE * 1000); }
function reassignTeams(room) { if (room.mode !== "teams") { room.players.forEach(p => p.team = null); return; } room.players.forEach((p, idx) => { p.team = (idx % 2 === 0) ? "red" : "blue"; }); }
function addPlayer(socket, roomId, playerData) { const room = rooms.get(roomId); if (!room || room.players.length >= room.maxPlayers) return null; const p = makePlayer(socket, playerData); room.players.push(p); if (room.mode === "teams") reassignTeams(room); sockets.set(socket.id, roomId); socket.join(roomId); noteLifeStart(p.id); return p; }
function removePlayer(socketId) {
  const roomId = sockets.get(socketId); if (!roomId) return;
  cleanupVoiceForSocket(socketId, roomId);
  const room = rooms.get(roomId);
  if (room) {
    room.players = room.players.filter(p => p.id !== socketId);
    room.playersLoaded.delete(socketId);
    if (room.hostId === socketId && room.players.length) room.hostId = room.players[0].id;
    if (room.players.length === 0) { if (room.loadingTimeout) clearTimeout(room.loadingTimeout); if (!room.isFreeRoom) rooms.delete(roomId); }
    else { if (room.mode === "teams") reassignTeams(room); broadcastRoom(roomId); if (room.state === "playing") checkFFAEnd(room); if (room.state === "loading") checkAllLoaded(room); }
  }
  sockets.delete(socketId);
  io.to(roomId).emit("player-left", { id: socketId });
}
function roomState(roomId) {
  const room = rooms.get(roomId); if (!room) return null;
  return { id: room.id, name: room.name, map: room.map, mode: room.mode, planeMode: room.planeMode, maxPlayers: room.maxPlayers, hostId: room.hostId, state: room.state, players: room.players.map(p => ({ id: p.id, name: p.name, color: p.color, planeType: p.planeType, vote: p.vote, team: p.team, ready: p.ready, state: p.state, health: p.health, shield: p.shield, kills: p.kills, deaths: p.deaths })) };
}
function broadcastRoom(roomId) { const s = roomState(roomId); if (s) io.to(roomId).emit("room-update", s); }
function roomList() { const list = []; for (const [id, room] of rooms) if (room.state === "waiting") list.push({ id: room.id, name: room.name, players: room.players.length, maxPlayers: room.maxPlayers, hasPassword: !!room.password, map: room.map, mode: room.mode, planeMode: room.planeMode }); return list; }
function resetRoom(room) {
  room.state = "waiting"; room.prepTimer = 0; room.combatEnabled = false; room.playersLoaded = new Set(); room.firstBlood = false;
  if (room.loadingTimeout) { clearTimeout(room.loadingTimeout); room.loadingTimeout = null; }
  room.players.forEach(p => { p.ready = false; p.state = "alive"; p.health = MAX_HEALTH; p.shield = 0; p.kills = 0; p.deaths = 0; p.abilityActive = false; p.abilityTimer = 0; p.abilityCooldown = 0; p.invisible = false; p.invulnerable = false; p.vote = null; p.fieldCooldowns = new Map(); noteLifeStart(p.id); });
  if (room.weather) { room.weather.atmo.phase = "idle"; room.weather.atmo.type = null; room.weather.blimp.phase = "idle"; room.weather.blimp.alive = false; room.weather.blimp.spawn = null; io.to(room.id).emit("weather-phase", { type: null, phase: "idle", duration: 0 }); io.to(room.id).emit("blimp-phase", { phase: "idle" }); }
  broadcastRoom(room.id); io.to(room.id).emit("room-reset");
}
function snapshot(room) {
  return { players: room.players.map(p => ({ id: p.id, state: p.state, health: p.health, shield: p.shield, kills: p.kills, deaths: p.deaths, position: p.position, yaw: p.yaw, pitch: p.pitch, roll: p.roll, abilityActive: p.abilityActive, abilityTimer: p.abilityTimer, abilityCooldown: p.abilityCooldown, invisible: p.invisible, invulnerable: p.invulnerable, team: p.team, planeType: p.planeType })), prepTimer: room.prepTimer, combatEnabled: room.combatEnabled };
}
function spawnPositions(room) { room.players.forEach((p, idx) => { const row = Math.floor(idx / 2); const side = (idx % 2 === 0) ? -1 : 1; p.position = { x: side * 5, y: 0.1, z: -row * 10 + 2 }; p.yaw = 0; p.pitch = 0; p.roll = 0; }); }
function resolvePlaneSelection(room) {
  if (room.planeMode !== "sorteio") return;
  let winner;
  if (room.players.length <= 2) winner = VALID_PLANES[Math.floor(Math.random() * VALID_PLANES.length)];
  else {
    const tally = {}; room.players.forEach(p => { if (p.vote) tally[p.vote] = (tally[p.vote] || 0) + 1; });
    const entries = Object.entries(tally);
    if (!entries.length) winner = VALID_PLANES[Math.floor(Math.random() * VALID_PLANES.length)];
    else { const max = Math.max(...entries.map(e => e[1])); const top = entries.filter(e => e[1] === max).map(e => e[0]); winner = top[Math.floor(Math.random() * top.length)]; }
  }
  room.players.forEach(p => { p.planeType = winner; });
  return winner;
}
function startGame(roomId) {
  const room = rooms.get(roomId); if (!room || room.state !== "waiting") return;
  const sorteioResult = resolvePlaneSelection(room);
  room.state = "loading"; room.playersLoaded = new Set(); room.combatEnabled = false; room.prepTimer = 0; room.firstBlood = false;
  room.players.forEach(p => { p.state = "alive"; p.health = MAX_HEALTH; p.shield = 0; p.kills = 0; p.deaths = 0; p.invisible = false; p.invulnerable = true; p.abilityActive = false; p.abilityTimer = 0; p.abilityCooldown = 0; p.fieldCooldowns = new Map(); noteLifeStart(p.id); });
  spawnPositions(room);
  broadcastRoom(roomId);
  io.to(roomId).emit("match-loading", { mode: room.mode, map: room.map, planeMode: room.planeMode, sorteioResult, players: room.players.map(p => ({ id: p.id, name: p.name, color: p.color, planeType: p.planeType, team: p.team, position: p.position, yaw: p.yaw, health: p.health })), weather: weatherSnapshot(room) });
  if (room.loadingTimeout) clearTimeout(room.loadingTimeout);
  room.loadingTimeout = setTimeout(() => beginPlaying(room), LOADING_TIMEOUT);
}
function checkAllLoaded(room) { if (room.state !== "loading") return; if (room.players.length > 0 && room.playersLoaded.size >= room.players.length) beginPlaying(room); }
function beginPlaying(room) {
  if (room.state !== "loading") return;
  if (room.loadingTimeout) { clearTimeout(room.loadingTimeout); room.loadingTimeout = null; }
  room.state = "playing"; room.prepTimer = TAKEOFF_GRACE; room.combatEnabled = false; room.matchStartedAt = Date.now();
  initRoomWeather(room);
  broadcastRoom(room.id); io.to(room.id).emit("match-begin", { prepTime: TAKEOFF_GRACE });
}
function endMatch(room, resultMsg, winner) {
  room.state = "finished";
  const playtime = room.matchStartedAt ? (Date.now() - room.matchStartedAt) / 1000 : 0;
  // ===== carreira: vitórias / MVP / último sobrevivente =====
  let winnerIds = [];
  if (winner) {
    if (typeof winner === 'object') winnerIds = [winner.id];
    else if (winner === 'red' || winner === 'blue') winnerIds = room.players.filter(p => p.team === winner).map(p => p.id);
  }
  const alive = room.players.filter(p => p.state === 'alive');
  const mvp = room.players.reduce((a, b) => (b.kills > (a ? a.kills : 0) ? b : a), null);
  const mvpId = (mvp && mvp.kills > 0) ? mvp.id : null;
  const lastSurvId = (room.mode === 'ffa' && winnerIds.length === 1 && alive.length === 1) ? winnerIds[0] : null;
  room.players.forEach(p => profileModule.recordMatchResults(p.accountId, {
    playtimeSeconds: playtime, survived: p.state === 'alive', win: winnerIds.includes(p.id),
    mvp: p.id === mvpId, lastSurvivor: p.id === lastSurvId, aliveSeconds: p.state === 'alive' ? playtime : 0, deathsInMatch: p.deaths,
  }));
  io.to(room.id).emit("match-end", { message: resultMsg, winner, standings: room.players.map(p => ({ name: p.name, kills: p.kills, deaths: p.deaths })) });
  setTimeout(() => resetRoom(room), 8000);
}
function checkFFAEnd(room) {
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
  if (room.players.length === 0) return;
  if (alive.length === 0) { endMatch(room, "Fim de partida", null); return; }
  if (room.players.length <= 1) return;
  if (alive.length <= 1) { const w = alive[0] || null; endMatch(room, w ? (w.name + " venceu!") : "Fim de partida", w ? { id: w.id, name: w.name } : null); }
}
function scheduleFreeRespawn(room, playerId) {
  setTimeout(() => {
    const r2 = rooms.get(room.id); if (!r2) return;
    const p = r2.players.find(pl => pl.id === playerId); if (!p) return;
    const spawn = randomFreeSpawn();
    p.state = "alive"; p.health = MAX_HEALTH; p.shield = 0; p.position = spawn; p.yaw = Math.random() * Math.PI * 2; p.pitch = 0; p.roll = 0; p.invulnerable = true;
    p.abilityActive = false; p.abilityTimer = 0; p.abilityCooldown = 0; p.fieldCooldowns = new Map();
    noteLifeStart(p.id);
    io.to(r2.id).emit("player-respawned", { id: p.id, position: p.position, yaw: p.yaw });
    broadcastRoom(r2.id); scheduleTakeoffGrace(r2, p);
  }, FREE_RESPAWN_DELAY);
}
function applyDamage(room, targetId, dmg, shooterId, weaponType) {
  const target = room.players.find(p => p.id === targetId);
  if (!target || target.state !== "alive" || target.invulnerable) return;
  if (room.mode === "teams") { const sh = room.players.find(p => p.id === shooterId); if (sh && sh.team === target.team) return; }
  lifeDamage.set(targetId, (lifeDamage.get(targetId) || 0) + dmg);
  if (target.shield > 0) { const ab = Math.min(target.shield, dmg); target.shield -= ab; dmg -= ab; if (dmg <= 0) { io.to(room.id).emit("health-update", { id: targetId, health: target.health, shield: target.shield }); return; } }
  target.health = Math.max(0, target.health - dmg);
  if (target.health <= 0) {
    target.state = "dead"; target.health = 0; target.deaths++;
    const dmgTaken = lifeDamage.get(targetId) || 0;
    const aliveSec = (Date.now() - (lifeStart.get(targetId) || Date.now())) / 1000;
    profileModule.recordDeath(target.accountId, dmgTaken, aliveSec);
    const shooter = room.players.find(p => p.id === shooterId);
    if (shooter && shooter.id !== targetId) {
      shooter.kills++;
      profileModule.recordKill(shooter.accountId, weaponType);
      if (!room.firstBlood) { room.firstBlood = true; profileModule.recordFirstBlood(shooter.accountId); }
      if (room.isFreeRoom) { shooter.health = MAX_HEALTH; io.to(room.id).emit("health-update", { id: shooter.id, health: shooter.health, shield: shooter.shield }); }
    }
    io.to(room.id).emit("player-killed", { id: targetId, killerId: shooterId, weapon: weaponType, killerName: shooter ? shooter.name : null, targetName: target.name });
    broadcastRoom(room.id);
    if (room.isFreeRoom) scheduleFreeRespawn(room, target.id); else checkFFAEnd(room);
  } else {
    io.to(room.id).emit("health-update", { id: targetId, health: target.health, shield: target.shield });
  }
}

io.on("connection", (socket) => {
  friendsModule.registerSocketHandlers(io, socket);
  // medalha secreta reportada pelo cliente (Tiro Perfeito)
  socket.on("report-medal", (key) => profileModule.unlockSecret(socket.accountId, key));
  socket.on("list-rooms", (cb) => cb(roomList()));
  socket.on("create-room", (data, cb) => { const room = createRoom(socket, data); const p = addPlayer(socket, room.id, data.playerData || {}); if (!p) return cb({ success: false, message: "Erro ao criar sala." }); cb({ success: true, roomId: room.id }); broadcastRoom(room.id); });
  socket.on("join-room", (data, cb) => {
    const room = rooms.get(data.roomId);
    if (!room) return cb({ success: false, message: "Sala não encontrada." });
    if (room.password && room.password !== data.password) return cb({ success: false, message: "Senha incorreta." });
    if (room.players.length >= room.maxPlayers) return cb({ success: false, message: "Sala cheia." });
    if (room.state !== "waiting") return cb({ success: false, message: "Partida em andamento." });
    const p = addPlayer(socket, data.roomId, data.playerData || {});
    if (!p) return cb({ success: false, message: "Erro ao entrar." });
    cb({ success: true }); broadcastRoom(data.roomId);
  });
  socket.on("join-free-room", (playerData, cb) => {
    const room = ensureFreeRoom();
    if (room.players.length >= room.maxPlayers) { if (cb) cb({ success: false, message: "Sala Livre lotada no momento, tente novamente em instantes." }); return; }
    const p = makePlayer(socket, playerData || {});
    p.position = randomFreeSpawn(); p.yaw = Math.random() * Math.PI * 2; p.state = "alive"; p.health = MAX_HEALTH; p.invulnerable = true;
    room.players.push(p); sockets.set(socket.id, room.id); socket.join(room.id);
    noteLifeStart(p.id); scheduleTakeoffGrace(room, p);
    if (cb) cb({ success: true, roomId: room.id });
    broadcastRoom(room.id);
    socket.to(room.id).emit("player-joined", { id: p.id, name: p.name, color: p.color, planeType: p.planeType, team: p.team, position: p.position, yaw: p.yaw, health: p.health });
    socket.emit("free-room-enter", { map: room.map, mode: room.mode, players: room.players.map(pl => ({ id: pl.id, name: pl.name, color: pl.color, planeType: pl.planeType, team: pl.team, position: pl.position, yaw: pl.yaw, health: pl.health })), weather: weatherSnapshot(room) });
  });
  socket.on("leave-room", () => removePlayer(socket.id));
  socket.on("set-ready", (ready) => { const roomId = sockets.get(socket.id); const room = rooms.get(roomId); if (!room) return; const p = room.players.find(pl => pl.id === socket.id); if (!p) return; p.ready = !!ready; broadcastRoom(roomId); });
  socket.on("set-plane", (planeType) => { const roomId = sockets.get(socket.id); const room = rooms.get(roomId); if (!room || room.state !== "waiting") return; const p = room.players.find(pl => pl.id === socket.id); if (!p || !VALID_PLANES.includes(planeType)) return; if (room.planeMode === "sorteio") p.vote = planeType; else p.planeType = planeType; broadcastRoom(roomId); });
  socket.on("set-team", (team) => { const roomId = sockets.get(socket.id); const room = rooms.get(roomId); if (!room || room.mode !== "teams") return; const p = room.players.find(pl => pl.id === socket.id); if (!p || (team !== "red" && team !== "blue")) return; p.team = team; p.ready = false; broadcastRoom(roomId); });
  socket.on("set-room-settings", (data) => { const roomId = sockets.get(socket.id); const room = rooms.get(roomId); if (!room || room.hostId !== socket.id || room.state !== "waiting") return; let tc = false; if (data && VALID_MAPS.includes(data.map)) room.map = data.map; if (data && VALID_MODES.includes(data.mode) && data.mode !== room.mode) { room.mode = data.mode; tc = true; } if (data && VALID_PLANE_MODES.includes(data.planeMode)) room.planeMode = data.planeMode; if (tc) reassignTeams(room); room.players.forEach(p => { p.ready = false; p.vote = null; }); broadcastRoom(roomId); });
  socket.on("transfer-host", (targetId) => { const roomId = sockets.get(socket.id); const room = rooms.get(roomId); if (!room || room.hostId !== socket.id || !room.players.some(p => p.id === targetId)) return; room.hostId = targetId; broadcastRoom(roomId); });
  socket.on("start-game", () => {
    const roomId = sockets.get(socket.id); const room = rooms.get(roomId); if (!room || room.hostId !== socket.id || room.state !== "waiting") return;
    if (!room.players.every(p => p.ready)) { socket.emit("error", { message: "Nem todos estão prontos." }); return; }
    if (room.mode === "teams") { if (!room.players.some(p => p.team === "red") || !room.players.some(p => p.team === "blue")) { socket.emit("error", { message: "Precisa de pelo menos 1 piloto em cada esquadrão." }); return; } }
    startGame(roomId);
  });
  socket.on("client-loaded", () => { const roomId = sockets.get(socket.id); const room = rooms.get(roomId); if (!room || room.state !== "loading") return; room.playersLoaded.add(socket.id); checkAllLoaded(room); });
  socket.on("update", (data) => { const roomId = sockets.get(socket.id); const room = rooms.get(roomId); if (!room || room.state !== "playing") return; const p = room.players.find(pl => pl.id === socket.id); if (!p || p.state !== "alive") return; p.position = { x: data.x, y: data.y, z: data.z }; p.yaw = data.yaw; p.pitch = data.pitch; p.roll = data.roll; });
  socket.on("shot-fired", (d) => { const roomId = sockets.get(socket.id); const room = rooms.get(roomId); if (!room || room.state !== "playing" || !room.combatEnabled) return; socket.to(roomId).emit("shot-fired", { id: socket.id, origin: d.origin, direction: d.direction, weaponType: d.weaponType || "basic" }); });
  socket.on("bomb-fired", (d) => { const roomId = sockets.get(socket.id); const room = rooms.get(roomId); if (!room || room.state !== "playing" || !room.combatEnabled) return; socket.to(roomId).emit("bomb-fired", { id: socket.id, origin: d.origin, velocity: d.velocity }); });
  socket.on("mg-fired", (d) => { const roomId = sockets.get(socket.id); const room = rooms.get(roomId); if (!room || room.state !== "playing" || !room.combatEnabled) return; socket.to(roomId).emit("mg-fired", { id: socket.id, origin: d.origin, direction: d.direction, color: d.color, explosionColor: d.explosionColor, weaponType: d.weaponType, speed: d.speed }); });
  socket.on("shockwave-pulse", (d) => { const roomId = sockets.get(socket.id); const room = rooms.get(roomId); if (!room || room.state !== "playing" || !room.combatEnabled) return; socket.to(roomId).emit("shockwave-pulse", { id: socket.id, position: d.position, radius: d.radius, color: d.color }); });
  socket.on("laser-update", (d) => { const roomId = sockets.get(socket.id); const room = rooms.get(roomId); if (!room || room.state !== "playing" || !room.combatEnabled) return; if (!d.active) { socket.to(roomId).emit("laser-update", { id: socket.id, active: false }); return; } socket.to(roomId).emit("laser-update", { id: socket.id, position: d.position, direction: d.direction, active: true }); });
  socket.on("bomb-exploded", (data) => { const roomId = sockets.get(socket.id); if (!roomId) return; const room = rooms.get(roomId); if (!room || room.state !== "playing" || !room.combatEnabled) return; socket.to(roomId).emit("bomb-exploded", data); });
  socket.on("hit", (d) => {
    const roomId = sockets.get(socket.id); const room = rooms.get(roomId);
    if (!room || room.state !== "playing" || !room.combatEnabled) return;
    const shooter = room.players.find(p => p.id === socket.id); if (!shooter || shooter.state !== "alive") return;
    const target = room.players.find(p => p.id === d.targetId); if (!target || target.state !== "alive") return;
    applyDamage(room, d.targetId, DAMAGE[d.weaponType] || DAMAGE.basic, socket.id, d.weaponType);
  });
  socket.on("blimp-killed", (d) => {
    const roomId = sockets.get(socket.id); const room = rooms.get(roomId); if (!room || !room.weather) return;
    const b = room.weather.blimp; if (b.phase !== "voando" || !b.alive) return;
    b.alive = false; b.phase = "idle";
    profileModule.recordBlimpKill(socket.accountId);
    b.gap = room.isFreeRoom ? BLIMP_BASE_GAP : Math.max(BLIMP_MIN_GAP_FLOOR, b.gap / 2);
    b.timer = b.gap; b.duration = b.gap;
    const pos = (d && d.position) || (b.spawn ? b.spawn.start : { x: 0, y: 80, z: 0 });
    b.spawn = null;
    socket.to(room.id).emit("blimp-exploded", { position: pos, killerId: socket.id });
  });
  socket.on("ability-trigger", () => {
    const roomId = sockets.get(socket.id); const room = rooms.get(roomId);
    if (!room || room.state !== "playing" || !room.combatEnabled) return;
    const p = room.players.find(pl => pl.id === socket.id);
    if (!p || p.state !== "alive" || p.abilityCooldown > 0 || p.abilityActive) return;
    p.abilityActive = true; p.abilityTimer = 5.0; p.abilityCooldown = 22.0;
    io.to(roomId).emit("ability-activated", { id: socket.id, type: p.planeType });
  });
  socket.on("voice-join", (data, cb) => {
    const roomId = sockets.get(socket.id); if (!roomId) { if (cb) cb({ success: false, message: "Você precisa estar em uma sala." }); return; }
    const vr = voiceRoomFor(roomId);
    if (vr.has(socket.id)) { if (cb) cb({ success: true, roomId, participants: [...vr.entries()].filter(([id]) => id !== socket.id).map(([id, p]) => ({ id, ...p })) }); return; }
    if (vr.size >= VOICE_MAX_PARTICIPANTS) { if (cb) cb({ success: false, message: "Chat de voz cheio (máximo 6 pessoas)." }); return; }
    const name = ((data && data.name) || "Piloto").toString().slice(0, 18);
    const color = (data && data.color) || "#00e5ff";
    const muted = !!(data && data.muted);
    const pilotNum = parseInt(data && data.pilot, 10);
    const pilot = (pilotNum >= 1 && pilotNum <= 16) ? pilotNum : 1;
    const customPhotoUrl = safeAvatarPhotoUrl(data && data.customPhotoUrl);
    vr.set(socket.id, { name, color, muted, pilot, customPhotoUrl });
    if (cb) cb({ success: true, roomId, participants: [...vr.entries()].filter(([id]) => id !== socket.id).map(([id, p]) => ({ id, ...p })) });
    socket.to(roomId).emit("voice-peer-joined", { id: socket.id, name, color, muted, pilot, customPhotoUrl });
  });
  socket.on("voice-leave", () => cleanupVoiceForSocket(socket.id, sockets.get(socket.id)));
  socket.on("voice-mute-changed", (muted) => { const roomId = sockets.get(socket.id); const vr = roomId && voiceRooms.get(roomId); if (vr && vr.has(socket.id)) { vr.get(socket.id).muted = !!muted; socket.to(roomId).emit("voice-peer-mute", { id: socket.id, muted: !!muted }); } });
  socket.on("voice-signal", (data) => { if (!data || !data.to) return; const roomId = sockets.get(socket.id); const vr = roomId && voiceRooms.get(roomId); if (!vr || !vr.has(socket.id) || !vr.has(data.to)) return; io.to(data.to).emit("voice-signal", { from: socket.id, payload: data.payload }); });
  socket.on("lobby-chat", (data) => {
    const roomId = sockets.get(socket.id); if (!roomId) return;
    const room = rooms.get(roomId); const p = room && room.players.find(pl => pl.id === socket.id);
    const text = ((data && data.text) || "").toString().slice(0, 220).trim(); if (!text) return;
    io.to(roomId).emit("lobby-chat", { id: socket.id, name: (p && p.name) || (data && data.name) || "Piloto", color: (p && p.color) || (data && data.color) || "#00e5ff", text, ts: Date.now() });
  });
  socket.on("disconnect", () => removePlayer(socket.id));
});

setInterval(() => {
  const dt = 50 / 1000;
  for (const [, room] of rooms) {
    if (room.state === "playing") {
      updateRoomWeather(room, dt);
      if (room.prepTimer > 0) { room.prepTimer -= dt; if (room.prepTimer <= 0) { room.prepTimer = 0; room.combatEnabled = true; room.players.forEach(p => p.invulnerable = false); io.to(room.id).emit("combat-enabled"); } }
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
              if (Math.sqrt(dx * dx + dy * dy + dz * dz) < FIELD_RANGE) { p.fieldCooldowns.set(other.id, FIELD_HIT_COOLDOWN); applyDamage(room, other.id, DAMAGE.field, p.id, "field"); }
            });
          }
          if (p.abilityTimer <= 0) { p.abilityActive = false; p.abilityTimer = 0; p.invisible = false; p.fieldCooldowns.clear(); }
        } else if (p.abilityCooldown > 0) { p.abilityCooldown -= dt; if (p.abilityCooldown < 0) p.abilityCooldown = 0; }
      });
      io.to(room.id).emit("snapshot", snapshot(room));
    }
  }
}, 50);

const PORT = process.env.PORT || 3001;
server.listen(PORT, "127.0.0.1", () => { console.log(`✅ Servidor de Batalha Aérea rodando em http://localhost:${PORT}`); console.log(`✅ Aguardando conexões...`); });