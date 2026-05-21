const AFK_MS = 180000;
const json = x => JSON.stringify(x);
const code = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const GRAVITY = 0.035;
const JUMP_VELOCITY = 0.34;
const MAX_FALL = -0.75;
const WORLD_MIN = -32;
const WORLD_MAX = 32;
const PLAYER_RADIUS = 0.32;
const BLOCK_EPS = 0.06;
const TERRAIN_TYPES = {
  green_hills: { name: 'Green Hills', colors: { grass: '#4ade80', dirt: '#8b5a2b', stone: '#64748b', water: '#38bdf8', sky: '#87ceeb' } },
  desolate_wasteland: { name: 'Desolate Wasteland', colors: { grass: '#8a6f43', dirt: '#5b4630', stone: '#7c6f64', water: '#6b5f4a', sky: '#c0a070' } },
  crystal_fields: { name: 'Crystal Fields', colors: { grass: '#7dd3fc', dirt: '#4c1d95', stone: '#a78bfa', water: '#22d3ee', sky: '#312e81' } },
  red_alien_plains: { name: 'Red Alien Plains', colors: { grass: '#c2410c', dirt: '#7f1d1d', stone: '#9f1239', water: '#fb7185', sky: '#7f1d1d' } },
  jagged_highlands: { name: 'Jagged Highlands', colors: { grass: '#84cc16', dirt: '#57534e', stone: '#44403c', water: '#0ea5e9', sky: '#64748b' } },
  swamp_world: { name: 'Swamp World', colors: { grass: '#365314', dirt: '#3f3f1f', stone: '#52525b', water: '#166534', sky: '#475569' } },
  frozen_planet: { name: 'Frozen Planet', colors: { grass: '#e0f2fe', dirt: '#bae6fd', stone: '#94a3b8', water: '#60a5fa', sky: '#dbeafe' } },
  ash_planet: { name: 'Ash Planet', colors: { grass: '#27272a', dirt: '#3f3f46', stone: '#18181b', water: '#ef4444', sky: '#111827' } },
  mushroom_planet: { name: 'Mushroom Planet', colors: { grass: '#f9a8d4', dirt: '#7e22ce', stone: '#a855f7', water: '#f0abfc', sky: '#581c87' } },
  floating_island_world: { name: 'Floating Island World', colors: { grass: '#86efac', dirt: '#92400e', stone: '#78716c', water: '#38bdf8', sky: '#bfdbfe' } }
};
const PLANT_TRAITS = {
  normal_trees: { name: 'Normal Trees' },
  no_trees: { name: 'No Trees' },
  dead_trees: { name: 'Dead Trees' },
  weird_alien_plants: { name: 'Weird Alien Plants' },
  giant_mushrooms: { name: 'Giant Mushrooms' },
  crystal_plants: { name: 'Crystal Plants' },
  eyeball_flowers: { name: 'Eyeball Flowers' },
  tall_grass_forest: { name: 'Tall Grass Forest' },
  meat_plants: { name: 'Meat Plants' },
  floating_plants: { name: 'Floating Plants' }
};
const CLASSES = { wizard: { name: 'Wizard', speed: .95, jump: 1, radius: .3, eye: 1.45, role: 'healer' }, giant: { name: 'Giant', speed: .72, jump: .92, radius: .43, eye: 2.05, role: 'strength' }, dwarf: { name: 'Dwarf', speed: 1.35, jump: 1.08, radius: .25, eye: 1.05, role: 'infiltrator' }, captain: { name: 'Captain', speed: 1.05, jump: 1, radius: .32, eye: 1.55, role: 'leader' } };
function getClass(id) { return CLASSES[id] ? id : 'captain'; }
function cleanHex(value, fallback) { return /^#[0-9a-fA-F]{6}$/.test(value || '') ? value : fallback; }
function randSeed() { return Math.floor(Math.random() * 9999999); }
function defaultFlora(terrain) { if (terrain === 'desolate_wasteland' || terrain === 'ash_planet') return 'dead_trees'; if (terrain === 'crystal_fields') return 'crystal_plants'; if (terrain === 'mushroom_planet') return 'giant_mushrooms'; if (terrain === 'red_alien_plains') return 'weird_alien_plants'; if (terrain === 'frozen_planet') return 'no_trees'; return 'normal_trees'; }
function noise(x, z, seed = 1) { let n = Math.floor(x) * 374761393 + Math.floor(z) * 668265263 + seed * 982451653; n = (n ^ (n >> 13)) * 1274126177; return ((n ^ (n >> 16)) >>> 0) / 4294967295; }
function createWorld(config = {}) { const terrain = TERRAIN_TYPES[config.terrain] ? config.terrain : 'green_hills'; const flora = PLANT_TRAITS[config.flora] ? config.flora : defaultFlora(terrain); const base = TERRAIN_TYPES[terrain]; const colors = { grass: cleanHex(config.colors?.grass, base.colors.grass), dirt: cleanHex(config.colors?.dirt, base.colors.dirt), stone: cleanHex(config.colors?.stone, base.colors.stone), water: cleanHex(config.colors?.water, base.colors.water), sky: cleanHex(config.colors?.sky, base.colors.sky) }; return { id: crypto.randomUUID(), name: String(config.name || base.name).slice(0, 30), seed: config.seed || randSeed(), size: 65, terrain, terrainName: base.name, flora, floraName: PLANT_TRAITS[flora].name, colors, traits: { terrain, flora } }; }
function heightAt(x, z, world) { const seed = world?.seed || 1; const terrain = world?.terrain || world?.traits?.terrain || 'green_hills'; let h = Math.sin((x + seed * .001) * .22) * 1.7 + Math.cos((z - seed * .001) * .24) * 1.5 + Math.sin((x + z) * .11) * 1.2 + noise(x, z, seed) * 1.4; if (terrain === 'desolate_wasteland') h = h * .45 - .8; if (terrain === 'crystal_fields') h = h * .8 + (noise(x * 2, z * 2, seed) > .89 ? 2.7 : 0); if (terrain === 'red_alien_plains') h = h * .7 + Math.sin(x * .55) * .5; if (terrain === 'jagged_highlands') h = h * 1.45 + (noise(x, z, seed) > .78 ? 2.2 : 0); if (terrain === 'swamp_world') h = h * .25 - .4; if (terrain === 'frozen_planet') h = h * .65 + (noise(x, z, seed) > .92 ? 1.5 : 0); if (terrain === 'ash_planet') h = h * .75 + (noise(x * 3, z * 3, seed) > .94 ? 2 : 0); if (terrain === 'mushroom_planet') h = h * .55 + Math.sin((x - z) * .2); if (terrain === 'floating_island_world') h = h * .9 + (Math.sin(x * .18) + Math.cos(z * .18) > .9 ? 2 : 0); return Math.max(0, Math.floor(h + 4)); }
function groundY(x, z, world) { return heightAt(Math.round(x), Math.round(z), world) + .5; }
function canOccupy(x, z, y, world, radius = PLAYER_RADIUS) { const samples = [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius], [radius, radius], [radius, -radius], [-radius, radius], [-radius, -radius]]; for (const [ox, oz] of samples) if (groundY(x + ox, z + oz, world) > y + BLOCK_EPS) return false; return true; }
function supportedY(x, z, world, radius = PLAYER_RADIUS) { const samples = [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius]]; return Math.max(...samples.map(([ox, oz]) => groundY(x + ox, z + oz, world))); }
export default { async fetch(request, env) { const url = new URL(request.url); if (url.pathname === '/ws') { const id = env.ROOMS.idFromName('global'); return env.ROOMS.get(id).fetch(request); } return env.ASSETS.fetch(request); } };
export class RoomsDO {
  constructor() { this.rooms = new Map(); this.clients = new Map(); setInterval(() => this.afk(), 1000); }
  async fetch(request) { if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected websocket', { status: 426 }); const pair = new WebSocketPair(); const [client, server] = Object.values(pair); const clientId = crypto.randomUUID(); server.accept(); this.clients.set(clientId, { ws: server }); server.addEventListener('message', e => this.msg(clientId, e.data)); server.addEventListener('close', () => this.drop(clientId)); server.addEventListener('error', () => this.drop(clientId)); return new Response(null, { status: 101, webSocket: client }); }
  send(id, m) { try { this.clients.get(id)?.ws.send(json(m)); } catch {} }
  cast(room, m) { room.players.forEach(p => this.send(p.clientId, m)); }
  clean(room) { return { code: room.code, visibility: room.visibility, hostId: room.hostId, hostName: room.players.find(p => p.id === room.hostId)?.username || 'Unknown', world: room.world, savedWorlds: room.savedWorlds || [], players: room.players.map(({ clientId, ...p }) => p) }; }
  publicRooms() { return [...this.rooms.values()].filter(r => r.visibility === 'public').map(r => ({ code: r.code, count: r.players.length, host: r.players.find(p => p.id === r.hostId)?.username || 'Unknown', world: r.world?.name || 'Planet' })); }
  msg(clientId, raw) { let m; try { m = JSON.parse(raw); } catch { return; } if (m.type === 'listPublic') return this.send(clientId, { type: 'publicRooms', rooms: this.publicRooms() }); if (m.type === 'createRoom') return this.createRoom(clientId, m); if (m.type === 'joinRoom') return this.joinRoom(clientId, m); if (m.type === 'createPlanet') return this.createPlanet(clientId, m.world); if (m.type === 'loadPlanet') return this.loadPlanet(clientId, m.worldId); if (m.type === 'leaveRoom') return this.drop(clientId); if (m.type === 'move') return this.move(clientId, m); if (m.type === 'kick') return this.hostRemove(clientId, m.targetId); }
  makePlayer(clientId, username, isHost, x, z, character, world) { const char = getClass(character), cfg = CLASSES[char]; return { id: crypto.randomUUID(), clientId, username, character: char, className: cfg.name, role: cfg.role, speed: cfg.speed, eye: cfg.eye, isHost, joinedAt: Date.now() + Math.random(), x, z, y: supportedY(x, z, world, cfg.radius), vy: 0, grounded: true, rot: 0, pitch: 0, lastMovedAt: Date.now(), isAfk: false }; }
  createRoom(clientId, m) { const roomCode = code(), world = createWorld(); const p = this.makePlayer(clientId, m.username || 'Host', true, 0, 0, m.character, world); const room = { code: roomCode, visibility: m.visibility === 'private' ? 'private' : 'public', hostId: p.id, world, savedWorlds: [world], players: [p] }; this.rooms.set(roomCode, room); Object.assign(this.clients.get(clientId), { roomCode, playerId: p.id }); this.send(clientId, { type: 'joined', room: this.clean(room), playerId: p.id }); this.allPublic(); }
  joinRoom(clientId, m) { const room = this.rooms.get(String(m.code || '').toUpperCase()); if (!room) return this.send(clientId, { type: 'error', message: 'No server found with that code.' }); const spawn = room.players.length + 1; const p = this.makePlayer(clientId, m.username || 'Player', false, spawn, spawn, m.character, room.world); room.players.push(p); Object.assign(this.clients.get(clientId), { roomCode: room.code, playerId: p.id }); this.send(clientId, { type: 'joined', room: this.clean(room), playerId: p.id }); this.cast(room, { type: 'roomUpdate', room: this.clean(room) }); this.allPublic(); }
  createPlanet(clientId, config) { const c = this.clients.get(clientId), room = this.rooms.get(c?.roomCode); if (!room || room.hostId !== c.playerId) return; const world = createWorld(config || {}); room.world = world; room.savedWorlds = [world, ...(room.savedWorlds || [])].slice(0, 12); this.respawnPlayers(room); this.cast(room, { type: 'roomUpdate', room: this.clean(room) }); this.allPublic(); }
  loadPlanet(clientId, worldId) { const c = this.clients.get(clientId), room = this.rooms.get(c?.roomCode); if (!room || room.hostId !== c.playerId) return; const world = (room.savedWorlds || []).find(w => w.id === worldId); if (!world) return; room.world = world; this.respawnPlayers(room); this.cast(room, { type: 'roomUpdate', room: this.clean(room) }); this.allPublic(); }
  respawnPlayers(room) { room.players.forEach((p, i) => { const cfg = CLASSES[p.character] || CLASSES.captain; p.x = i; p.z = i; p.y = supportedY(p.x, p.z, room.world, cfg.radius); p.vy = 0; p.grounded = true; }); }
  move(clientId, m) { const c = this.clients.get(clientId), room = this.rooms.get(c?.roomCode); if (!room) return; const p = room.players.find(q => q.id === c.playerId); if (!p) return; const cfg = CLASSES[p.character] || CLASSES.captain; const dx = clamp(Number(m.dx || 0) * cfg.speed, -.28, .28), dz = clamp(Number(m.dz || 0) * cfg.speed, -.28, .28); p.rot = Number.isFinite(Number(m.rot)) ? Number(m.rot) : p.rot; p.pitch = Number.isFinite(Number(m.pitch)) ? Number(m.pitch) : p.pitch; if (m.jump && p.grounded) { p.vy = JUMP_VELOCITY * cfg.jump; p.grounded = false; } p.vy = clamp((p.vy || 0) - GRAVITY, MAX_FALL, JUMP_VELOCITY * 1.15); p.y += p.vy; const tryX = clamp(p.x + dx, WORLD_MIN, WORLD_MAX); if (canOccupy(tryX, p.z, p.y, room.world, cfg.radius)) p.x = tryX; const tryZ = clamp(p.z + dz, WORLD_MIN, WORLD_MAX); if (canOccupy(p.x, tryZ, p.y, room.world, cfg.radius)) p.z = tryZ; const floor = supportedY(p.x, p.z, room.world, cfg.radius); if (p.y <= floor) { p.y = floor; p.vy = 0; p.grounded = true; } else p.grounded = false; p.lastMovedAt = Date.now(); p.isAfk = false; this.cast(room, { type: 'roomUpdate', room: this.clean(room) }); }
  hostRemove(clientId, targetId) { const c = this.clients.get(clientId), room = this.rooms.get(c?.roomCode); if (!room || room.hostId !== c.playerId || targetId === c.playerId) return; const target = room.players.find(p => p.id === targetId); if (!target) return; this.send(target.clientId, { type: 'kicked' }); this.drop(target.clientId); }
  drop(clientId) { const c = this.clients.get(clientId), room = this.rooms.get(c?.roomCode); if (room) { room.players = room.players.filter(p => p.clientId !== clientId); if (!room.players.length) this.rooms.delete(room.code); else { if (!room.players.some(p => p.id === room.hostId)) { const next = [...room.players].sort((a, b) => a.joinedAt - b.joinedAt)[0]; room.hostId = next.id; room.players.forEach(p => p.isHost = p.id === next.id); } this.cast(room, { type: 'roomUpdate', room: this.clean(room) }); } } try { this.clients.get(clientId)?.ws.close(); } catch {} this.clients.delete(clientId); this.allPublic(); }
  afk() { const t = Date.now(); for (const room of [...this.rooms.values()]) for (const p of [...room.players]) if (t - p.lastMovedAt >= AFK_MS) { this.send(p.clientId, { type: 'kicked' }); this.drop(p.clientId); } }
  allPublic() { for (const id of this.clients.keys()) this.send(id, { type: 'publicRooms', rooms: this.publicRooms() }); }
}
