import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import VoxelWorld from './VoxelWorld.jsx';
import './styles.css';

const randomName = () => 'Player' + Math.floor(Math.random() * 9999);
const CHARACTERS = [
  { id: 'wizard', name: 'Wizard', role: 'Healer', desc: 'A goblin in a tall robe and pointy hat. Slower, support-focused.' },
  { id: 'giant', name: 'Giant', role: 'Strength', desc: 'A huge armored goblin bruiser. Slow but strongest and tallest.' },
  { id: 'dwarf', name: 'Dwarf', role: 'Infiltrator', desc: 'A tiny fast goblin sneaky scout. Short, quick, and hard to spot.' },
  { id: 'captain', name: 'Captain', role: 'Leader / Foot Soldier', desc: 'A balanced goblin commander with a helmet and shield.' }
];
const TERRAIN_TYPES = [['green_hills','Green Hills'],['desolate_wasteland','Desolate Wasteland'],['crystal_fields','Crystal Fields'],['red_alien_plains','Red Alien Plains'],['jagged_highlands','Jagged Highlands'],['swamp_world','Swamp World'],['frozen_planet','Frozen Planet'],['ash_planet','Ash Planet'],['mushroom_planet','Mushroom Planet'],['floating_island_world','Floating Island World']];
const PLANT_TRAITS = [['normal_trees','Normal Trees'],['no_trees','No Trees'],['dead_trees','Dead Trees'],['weird_alien_plants','Weird Alien Plants'],['giant_mushrooms','Giant Mushrooms'],['crystal_plants','Crystal Plants'],['eyeball_flowers','Eyeball Flowers'],['tall_grass_forest','Tall Grass Forest'],['meat_plants','Meat Plants'],['floating_plants','Floating Plants']];
const ATMOSPHERE_TRAITS = [['clear_blue_sky','Clear Blue Sky'],['purple_alien_sky','Purple Alien Sky'],['red_war_sky','Red War Sky'],['foggy_world','Foggy World'],['night_world','Night World'],['two_suns','Two Suns'],['green_toxic_air','Green Toxic Air'],['stormy_planet','Stormy Planet'],['space_view','Space View'],['golden_heaven_sky','Golden Heaven Sky']];
const STRUCTURE_TRAITS = [['none','No Structures'],['flying_houses','Flying Houses'],['ancient_totems','Ancient Totems'],['broken_empire_camps','Broken Empire Camps'],['alien_shrines','Alien Shrines'],['crystal_towers','Crystal Towers'],['abandoned_villages','Abandoned Villages'],['floating_bridges','Floating Bridges'],['resource_drills','Resource Drills'],['crash_site','Crash Site']];

function App() {
  const [name, setName] = useState(localStorage.name || randomName());
  const [character, setCharacter] = useState(localStorage.character || 'captain');
  const [roomCode, setRoomCode] = useState('');
  const [rooms, setRooms] = useState([]);
  const [planetOpen, setPlanetOpen] = useState(false);
  const [planet, setPlanet] = useState({ name: 'Custom Planet', terrain: 'green_hills', flora: 'normal_trees', atmosphere: 'clear_blue_sky', structure: 'none' });
  const [savingPlanet, setSavingPlanet] = useState(false);
  const [state, setState] = useState({ screen: 'menu', room: null, playerId: null });
  const [look, setLook] = useState({ yaw: 0, pitch: 0, locked: false });
  const lookRef = useRef(look);
  const ws = useRef(null);
  const keys = useRef({});
  const me = useMemo(() => state.room?.players?.find(p => p.id === state.playerId), [state]);
  const isHost = !!me?.isHost;
  lookRef.current = look;

  function connect() {
    if (ws.current?.readyState === WebSocket.OPEN) return ws.current;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${proto}//${location.host}/ws`);
    ws.current = socket;
    socket.onmessage = ev => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'publicRooms') setRooms(msg.rooms);
      if (msg.type === 'joined') setState({ screen: 'game', room: msg.room, playerId: msg.playerId });
      if (msg.type === 'roomUpdate') {
        setSavingPlanet(false);
        setState(s => s.room?.code === msg.room.code ? { ...s, room: msg.room } : s);
      }
      if (msg.type === 'kicked') setState({ screen: 'menu', room: null, playerId: null });
      if (msg.type === 'error') { setSavingPlanet(false); alert(msg.message); }
    };
    socket.onopen = () => socket.send(JSON.stringify({ type: 'listPublic' }));
    return socket;
  }
  function send(msg) { const socket = connect(); const go = () => socket.send(JSON.stringify(msg)); socket.readyState === WebSocket.OPEN ? go() : socket.addEventListener('open', go, { once: true }); }
  function rememberChoice() { localStorage.name = name; localStorage.character = character; }
  function createRoom(visibility) { rememberChoice(); send({ type: 'createRoom', visibility, username: name || randomName(), character }); }
  function joinRoom(c) { rememberChoice(); send({ type: 'joinRoom', code: c.trim().toUpperCase(), username: name || randomName(), character }); }
  function refresh() { send({ type: 'listPublic' }); }
  function leave() { send({ type: 'leaveRoom' }); setState({ screen: 'menu', room: null, playerId: null }); }
  function kick(id) { send({ type: 'kick', targetId: id }); }
  const createPlanet = useCallback((customPlanet = planet) => { setSavingPlanet(true); send({ type: 'createPlanet', world: customPlanet }); }, [planet]);
  function loadPlanet(id) { setSavingPlanet(true); send({ type: 'loadPlanet', worldId: id }); }
  const sendMove = useCallback((dx, dz, extra = {}) => send({ type: 'move', dx, dz, ...extra }), []);

  useEffect(() => { connect(); const t = setInterval(refresh, 60000); return () => clearInterval(t); }, []);
  useEffect(() => { const d = e => { keys.current[e.key.toLowerCase()] = true; }; const u = e => { keys.current[e.key.toLowerCase()] = false; }; addEventListener('keydown', d); addEventListener('keyup', u); return () => { removeEventListener('keydown', d); removeEventListener('keyup', u); }; }, []);
  useEffect(() => { const mouse = e => { if (document.pointerLockElement !== document.body) return; setLook(v => ({ yaw: v.yaw - e.movementX * 0.0025, pitch: Math.max(-1.25, Math.min(1.25, v.pitch - e.movementY * 0.0025)), locked: true })); }; const lockChange = () => setLook(v => ({ ...v, locked: document.pointerLockElement === document.body })); addEventListener('mousemove', mouse); document.addEventListener('pointerlockchange', lockChange); return () => { removeEventListener('mousemove', mouse); document.removeEventListener('pointerlockchange', lockChange); }; }, []);
  useEffect(() => { let raf; const loop = () => { if (state.screen === 'game') { const yaw = lookRef.current.yaw; const forward = { x: -Math.sin(yaw), z: -Math.cos(yaw) }; const right = { x: Math.cos(yaw), z: -Math.sin(yaw) }; let mx = 0, mz = 0; if (keys.current.w || keys.current.arrowup) { mx += forward.x; mz += forward.z; } if (keys.current.s || keys.current.arrowdown) { mx -= forward.x; mz -= forward.z; } if (keys.current.a || keys.current.arrowleft) { mx -= right.x; mz -= right.z; } if (keys.current.d || keys.current.arrowright) { mx += right.x; mz += right.z; } const len = Math.hypot(mx, mz) || 1; const moving = mx || mz; const jump = !!keys.current[' ']; if (moving || jump) sendMove((mx / len) * 0.12, (mz / len) * 0.12, { jump, rot: yaw, pitch: lookRef.current.pitch }); } raf = requestAnimationFrame(loop); }; loop(); return () => cancelAnimationFrame(raf); }, [state.screen, sendMove]);

  if (state.screen === 'menu') return <main className="menu"><section className="card wideCard"><h1>Choose Your Goblin Class</h1><p>Choose a class, then create or join a server.</p><label>Username</label><input value={name} onChange={e => setName(e.target.value)} /><div className="characterGrid">{CHARACTERS.map(c => <button key={c.id} className={'characterCard ' + (character === c.id ? 'selected' : '')} onClick={() => setCharacter(c.id)}><b>{c.name}</b><span>{c.role}</span><small>{c.desc}</small></button>)}</div><div className="row"><button onClick={() => createRoom('public')}>Create Public</button><button onClick={() => createRoom('private')}>Create Private</button></div><h2>Join Private</h2><div className="row"><input placeholder="CODE" value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())}/><button onClick={() => joinRoom(roomCode)}>Join</button></div></section><section className="card"><div className="between"><h2>Public Servers</h2><button onClick={refresh}>Refresh</button></div>{rooms.length === 0 && <p>No public servers.</p>}{rooms.map(r => <div className="server" key={r.code}><b>{r.code}</b><span>{r.count} players • {r.world || 'Planet'} • Host: {r.host}</span><button onClick={() => joinRoom(r.code)}>Join</button></div>)}</section></main>;

  return <main className="game"><header><div><small>{state.room.visibility} server</small><h1>Code: {state.room.code} <span>{state.room.world?.name || 'Planet'}</span>{isHost && <em>You are host</em>}</h1></div><div className="row">{isHost && <button onClick={() => setPlanetOpen(v => !v)}>Create Planet</button>}<button className="danger" onClick={leave}>Leave Server</button></div></header>{planetOpen && isHost && <section className="planetPanel card"><div className="between"><h2>Create / Load Planet</h2><button onClick={() => setPlanetOpen(false)}>Close</button></div><label>Planet Name</label><input value={planet.name} onChange={e => setPlanet({ ...planet, name: e.target.value })}/><label>Terrain Type</label><select value={planet.terrain} onChange={e => setPlanet({ ...planet, terrain: e.target.value })}>{TERRAIN_TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><label>Plant / Tree Trait</label><select value={planet.flora} onChange={e => setPlanet({ ...planet, flora: e.target.value })}>{PLANT_TRAITS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><label>Atmosphere / Sky Trait</label><select value={planet.atmosphere} onChange={e => setPlanet({ ...planet, atmosphere: e.target.value })}>{ATMOSPHERE_TRAITS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><label>Structure Trait</label><select value={planet.structure} onChange={e => setPlanet({ ...planet, structure: e.target.value })}>{STRUCTURE_TRAITS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><button disabled={savingPlanet} onClick={() => createPlanet()}>{savingPlanet ? 'Building Planet...' : 'Apply + Save Planet'}</button><h3>Saved Planets</h3><div className="savedWorlds">{(state.room.savedWorlds || []).map(w => <button disabled={savingPlanet} key={w.id} onClick={() => loadPlanet(w.id)}>{w.name}<small>{w.terrainName} • {w.floraName || 'Plants'} • {w.atmosphereName || 'Sky'} • {w.structureName || 'No Structures'}</small></button>)}</div></section>}<section className="layout"><VoxelWorld room={state.room} playerId={state.playerId} onMove={sendMove} look={look} onLockMouse={() => document.body.requestPointerLock?.()} /><aside className="card"><h2>Players</h2><p className="tiny">Host can create terrain, plants, atmosphere, and structures.</p>{state.room.players.map(p => <div className="player" key={p.id}><b>{p.username}</b><span>{p.className || p.character || 'Goblin'} • {p.isHost ? 'HOST' : p.isAfk ? 'AFK' : 'PLAYER'}</span>{isHost && p.id !== state.playerId && <button className="danger" onClick={() => kick(p.id)}>Kick</button>}</div>)}</aside></section></main>;
}

createRoot(document.getElementById('root')).render(<App />);