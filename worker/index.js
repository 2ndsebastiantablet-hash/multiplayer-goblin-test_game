const AFK_MS = 3 * 60 * 1000;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const code = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
const json = data => JSON.stringify(data);

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
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.rooms = new Map();
    this.clients = new Map();
    setInterval(() => this.checkAfk(), 1000);
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected websocket', { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const clientId = crypto.randomUUID();
    server.accept();
    this.clients.set(clientId, { ws: server, roomCode: null, playerId: null });
    server.addEventListener('message', ev => this.onMessage(clientId, ev.data));
    server.addEventListener('close', () => this.disconnect(clientId));
    server.addEventListener('error', () => this.disconnect(clientId));
    return new Response(null, { status: 101, webSocket: client });
  }

  send(clientId, msg) { try { this.clients.get(clientId)?.ws.send(json(msg)); } catch {} }
  broadcast(room, msg) { for (const p of room.players) this.send(p.clientId, msg); }
  publicRooms() { return [...this.rooms.values()].filter(r => r.visibility === 'public').map(r => ({ code: r.code, count: r.players.length, host: r.players.find(p => p.id === r.hostId)?.username || 'Unknown' })); }
  pushPublicList(clientId) { this.send(clientId, { type: 'publicRooms', rooms: this.publicRooms() }); }

  onMessage(clientId, raw) {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === 'listPublic') return this.pushPublicList(clientId);
    if (msg.type === 'createRoom') return this.createRoom(clientId, msg);
    if (msg.type === 'joinRoom') return this.joinRoom(clientId, msg);
    if (msg.type === 'leaveRoom') return this.disconnect(clientId, true);
    if (msg.type === 'move') return this.move(clientId, msg);
    if (msg.type === 'kick') return this.kick(clientId, msg.targetId);
  }

  createRoom(clientId, msg) {
    const roomCode = code();
    const player = this.makePlayer(clientId, msg.username || 'Host', true);
    const room = { code: roomCode, visibility: msg.visibility === 'private' ? 'private' : 'public', hostId: player.id, players: [player] };
    this.rooms.set(roomCode, room);
    this.clients.get(clientId).roomCode = roomCode;
    this.clients.get(clientId).playerId = player.id;
    this.send(clientId, { type: 'joined', room: this.cleanRoom(room), playerId: player.id });
    this.broadcastPublicLists();
  }

  joinRoom(clientId, msg) {
    const room = this.rooms.get(String(msg.code || '').toUpperCase());
    if (!room) return this.send(clientId, { type: 'error', message: 'No server found with that code.' });
    const player = this.makePlayer(clientId, msg.username || 'Player', false);
    room.players.push(player);
    this.clients.get(clientId).roomCode = room.code;
    this.clients.get(clientId).playerId = player.id;
    this.send(clientId, { type: 'joined', room: this.cleanRoom(room), playerId: player.id });
    this.broadcast(room, { type: 'roomUpdate', room: this.cleanRoom(room) });
    this.broadcastPublicLists();
  }

  makePlayer(clientId, username, isHost) {
    return { id: crypto.randomUUID(), clientId, username, isHost, joinedAt: Date.now() + Math.random(), x: 80 + Math.random() * 620, y: 100 + Math.random() * 380, lastMovedAt: Date.now(), isAfk: false };
  }

  cleanRoom(room) {
    return { code: room.code, visibility: room.visibility, hostId: room.hostId, hostName: room.players.find(p => p.id === room.hostId)?.username || 'Unknown', players: room.players.map(({ clientId, ...p }) => p) };
  }

  move(clientId, msg) {
    const c = this.clients.get(clientId); if (!c?.roomCode) return;
    const room = this.rooms.get(c.roomCode); if (!room) return;
    const p = room.players.find(x => x.id === c.playerId); if (!p) return;
    p.x = clamp(p.x + Number(msg.dx || 0), 20, 760); p.y = clamp(p.y + Number(msg.dy || 0), 20, 520);
    p.lastMovedAt = Date.now(); p.isAfk = false;
    this.broadcast(room, { type: 'roomUpdate', room: this.cleanRoom(room) });
  }

  kick(clientId, targetId) {
    const c = this.clients.get(clientId); if (!c?.roomCode) return;
    const room = this.rooms.get(c.roomCode); if (!room) return;
    if (room.hostId !== c.playerId) return;
    if (targetId === c.playerId) return;
    const target = room.players.find(p => p.id === targetId); if (!target) return;
    this.send(target.clientId, { type: 'kicked' });
    this.removePlayer(target.clientId, true);
  }

  disconnect(clientId, intentional = false) {
    this.removePlayer(clientId, intentional);
    try { this.clients.get(clientId)?.ws.close(); } catch {}
    this.clients.delete(clientId);
  }

  removePlayer(clientId) {
    const c = this.clients.get(clientId); if (!c?.roomCode) return;
    const room = this.rooms.get(c.roomCode); if (!room) return;
    room.players = room.players.filter(p => p.clientId !== clientId);
    if (room.players.length === 0) this.rooms.delete(room.code);
    else {
      if (!room.players.some(p => p.id === room.hostId)) {
        const nextHost = [...room.players].sort((a, b) => a.joinedAt - b.joinedAt)[0];
        room.hostId = nextHost.id;
        room.players = room.players.map(p => ({ ...p, isHost: p.id === nextHost.id }));
      }
      this.broadcast(room, { type: 'roomUpdate', room: this.cleanRoom(room) });
    }
    this.broadcastPublicLists();
  }

  checkAfk() {
    const t = Date.now();
    for (const room of [...this.rooms.values()]) {
      for (const p of [...room.players]) {
        if (t - p.lastMovedAt >= AFK_MS) {
          p.isAfk = true;
          this.send(p.clientId, { type: 'kicked' });
          this.removePlayer(p.clientId);
        }
      }
    }
  }

  broadcastPublicLists() { for (const clientId of this.clients.keys()) this.pushPublicList(clientId); }
}
