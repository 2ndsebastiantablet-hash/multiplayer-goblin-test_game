const AFK_MS = 180000;
const json = x => JSON.stringify(x);
const code = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const GRAVITY = 0.035;
const JUMP_VELOCITY = 0.34;
const MAX_FALL = -0.75;
const WORLD_MIN = -16;
const WORLD_MAX = 16;
const PLAYER_RADIUS = 0.32;
const BLOCK_EPS = 0.06;

function heightAt(x, z) {
  return Math.max(0, Math.floor(Math.sin(x * .33) * 1.6 + Math.cos(z * .27) * 1.4 + Math.sin((x + z) * .18) * 1.2 + 3));
}
function groundY(x, z) { return heightAt(Math.round(x), Math.round(z)) + .5; }
function canOccupy(x, z, y) {
  const samples = [[0, 0], [PLAYER_RADIUS, 0], [-PLAYER_RADIUS, 0], [0, PLAYER_RADIUS], [0, -PLAYER_RADIUS], [PLAYER_RADIUS, PLAYER_RADIUS], [PLAYER_RADIUS, -PLAYER_RADIUS], [-PLAYER_RADIUS, PLAYER_RADIUS], [-PLAYER_RADIUS, -PLAYER_RADIUS]];
  for (const [ox, oz] of samples) {
    if (groundY(x + ox, z + oz) > y + BLOCK_EPS) return false;
  }
  return true;
}
function supportedY(x, z) {
  const samples = [[0, 0], [PLAYER_RADIUS, 0], [-PLAYER_RADIUS, 0], [0, PLAYER_RADIUS], [0, -PLAYER_RADIUS]];
  return Math.max(...samples.map(([ox, oz]) => groundY(x + ox, z + oz)));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      const id = env.ROOMS.idFromName('global');
      return env.ROOMS.get(id).fetch(request);
    }
    return env.ASSETS.fetch(request);
  }
};

export class RoomsDO {
  constructor() {
    this.rooms = new Map();
    this.clients = new Map();
    setInterval(() => this.afk(), 1000);
  }
  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected websocket', { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const clientId = crypto.randomUUID();
    server.accept();
    this.clients.set(clientId, { ws: server });
    server.addEventListener('message', e => this.msg(clientId, e.data));
    server.addEventListener('close', () => this.drop(clientId));
    server.addEventListener('error', () => this.drop(clientId));
    return new Response(null, { status: 101, webSocket: client });
  }
  send(id, m) { try { this.clients.get(id)?.ws.send(json(m)); } catch {} }
  cast(room, m) { room.players.forEach(p => this.send(p.clientId, m)); }
  clean(room) {
    return { code: room.code, visibility: room.visibility, hostId: room.hostId, hostName: room.players.find(p => p.id === room.hostId)?.username || 'Unknown', players: room.players.map(({ clientId, ...p }) => p) };
  }
  publicRooms() {
    return [...this.rooms.values()].filter(r => r.visibility === 'public').map(r => ({ code: r.code, count: r.players.length, host: r.players.find(p => p.id === r.hostId)?.username || 'Unknown' }));
  }
  msg(clientId, raw) {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.type === 'listPublic') return this.send(clientId, { type: 'publicRooms', rooms: this.publicRooms() });
    if (m.type === 'createRoom') return this.createRoom(clientId, m);
    if (m.type === 'joinRoom') return this.joinRoom(clientId, m);
    if (m.type === 'leaveRoom') return this.drop(clientId);
    if (m.type === 'move') return this.move(clientId, m);
    if (m.type === 'kick') return this.hostRemove(clientId, m.targetId);
  }
  makePlayer(clientId, username, isHost, x, z) {
    return { id: crypto.randomUUID(), clientId, username, isHost, joinedAt: Date.now() + Math.random(), x, z, y: supportedY(x, z), vy: 0, grounded: true, rot: 0, pitch: 0, lastMovedAt: Date.now(), isAfk: false };
  }
  createRoom(clientId, m) {
    const roomCode = code();
    const p = this.makePlayer(clientId, m.username || 'Host', true, 0, 0);
    const room = { code: roomCode, visibility: m.visibility === 'private' ? 'private' : 'public', hostId: p.id, players: [p] };
    this.rooms.set(roomCode, room);
    Object.assign(this.clients.get(clientId), { roomCode, playerId: p.id });
    this.send(clientId, { type: 'joined', room: this.clean(room), playerId: p.id });
    this.allPublic();
  }
  joinRoom(clientId, m) {
    const room = this.rooms.get(String(m.code || '').toUpperCase());
    if (!room) return this.send(clientId, { type: 'error', message: 'No server found with that code.' });
    const spawn = room.players.length + 1;
    const p = this.makePlayer(clientId, m.username || 'Player', false, spawn, spawn);
    room.players.push(p);
    Object.assign(this.clients.get(clientId), { roomCode: room.code, playerId: p.id });
    this.send(clientId, { type: 'joined', room: this.clean(room), playerId: p.id });
    this.cast(room, { type: 'roomUpdate', room: this.clean(room) });
    this.allPublic();
  }
  move(clientId, m) {
    const c = this.clients.get(clientId);
    const room = this.rooms.get(c?.roomCode);
    if (!room) return;
    const p = room.players.find(q => q.id === c.playerId);
    if (!p) return;
    const dx = clamp(Number(m.dx || 0), -.22, .22);
    const dz = clamp(Number(m.dz || 0), -.22, .22);
    p.rot = Number.isFinite(Number(m.rot)) ? Number(m.rot) : p.rot;
    p.pitch = Number.isFinite(Number(m.pitch)) ? Number(m.pitch) : p.pitch;
    if (m.jump && p.grounded) { p.vy = JUMP_VELOCITY; p.grounded = false; }
    p.vy = clamp((p.vy || 0) - GRAVITY, MAX_FALL, JUMP_VELOCITY);
    p.y += p.vy;

    const tryX = clamp(p.x + dx, WORLD_MIN, WORLD_MAX);
    if (canOccupy(tryX, p.z, p.y)) p.x = tryX;
    const tryZ = clamp(p.z + dz, WORLD_MIN, WORLD_MAX);
    if (canOccupy(p.x, tryZ, p.y)) p.z = tryZ;

    const floor = supportedY(p.x, p.z);
    if (p.y <= floor) { p.y = floor; p.vy = 0; p.grounded = true; }
    else p.grounded = false;

    p.lastMovedAt = Date.now();
    p.isAfk = false;
    this.cast(room, { type: 'roomUpdate', room: this.clean(room) });
  }
  hostRemove(clientId, targetId) {
    const c = this.clients.get(clientId);
    const room = this.rooms.get(c?.roomCode);
    if (!room || room.hostId !== c.playerId || targetId === c.playerId) return;
    const target = room.players.find(p => p.id === targetId);
    if (!target) return;
    this.send(target.clientId, { type: 'kicked' });
    this.drop(target.clientId);
  }
  drop(clientId) {
    const c = this.clients.get(clientId);
    const room = this.rooms.get(c?.roomCode);
    if (room) {
      room.players = room.players.filter(p => p.clientId !== clientId);
      if (!room.players.length) this.rooms.delete(room.code);
      else {
        if (!room.players.some(p => p.id === room.hostId)) {
          const next = [...room.players].sort((a, b) => a.joinedAt - b.joinedAt)[0];
          room.hostId = next.id;
          room.players.forEach(p => p.isHost = p.id === next.id);
        }
        this.cast(room, { type: 'roomUpdate', room: this.clean(room) });
      }
    }
    try { this.clients.get(clientId)?.ws.close(); } catch {}
    this.clients.delete(clientId);
    this.allPublic();
  }
  afk() {
    const t = Date.now();
    for (const room of [...this.rooms.values()]) {
      for (const p of [...room.players]) if (t - p.lastMovedAt >= AFK_MS) { this.send(p.clientId, { type: 'kicked' }); this.drop(p.clientId); }
    }
  }
  allPublic() { for (const id of this.clients.keys()) this.send(id, { type: 'publicRooms', rooms: this.publicRooms() }); }
}
