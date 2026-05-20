import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import VoxelWorld from './VoxelWorld.jsx';
import './styles.css';

const randomName = () => 'Player' + Math.floor(Math.random() * 9999);

function App() {
  const [name, setName] = useState(localStorage.name || randomName());
  const [roomCode, setRoomCode] = useState('');
  const [rooms, setRooms] = useState([]);
  const [state, setState] = useState({ screen: 'menu', room: null, playerId: null });
  const ws = useRef(null);
  const keys = useRef({});
  const me = useMemo(() => state.room?.players?.find(p => p.id === state.playerId), [state]);
  const isHost = !!me?.isHost;

  function connect() {
    if (ws.current?.readyState === WebSocket.OPEN) return ws.current;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${proto}//${location.host}/ws`);
    ws.current = socket;
    socket.onmessage = ev => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'publicRooms') setRooms(msg.rooms);
      if (msg.type === 'joined') setState({ screen: 'game', room: msg.room, playerId: msg.playerId });
      if (msg.type === 'roomUpdate') setState(s => s.room?.code === msg.room.code ? { ...s, room: msg.room } : s);
      if (msg.type === 'kicked') setState({ screen: 'menu', room: null, playerId: null });
      if (msg.type === 'error') alert(msg.message);
    };
    socket.onopen = () => socket.send(JSON.stringify({ type: 'listPublic' }));
    return socket;
  }

  function send(msg) {
    const socket = connect();
    const go = () => socket.send(JSON.stringify(msg));
    socket.readyState === WebSocket.OPEN ? go() : socket.addEventListener('open', go, { once: true });
  }

  function createRoom(visibility) {
    localStorage.name = name;
    send({ type: 'createRoom', visibility, username: name || randomName() });
  }
  function joinRoom(c) {
    localStorage.name = name;
    send({ type: 'joinRoom', code: c.trim().toUpperCase(), username: name || randomName() });
  }
  function refresh() { send({ type: 'listPublic' }); }
  function leave() { send({ type: 'leaveRoom' }); setState({ screen: 'menu', room: null, playerId: null }); }
  function kick(id) { send({ type: 'kick', targetId: id }); }

  useEffect(() => { connect(); const t = setInterval(refresh, 60000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const d = e => { keys.current[e.key.toLowerCase()] = true; };
    const u = e => { keys.current[e.key.toLowerCase()] = false; };
    addEventListener('keydown', d); addEventListener('keyup', u);
    return () => { removeEventListener('keydown', d); removeEventListener('keyup', u); };
  }, []);

  useEffect(() => {
    let raf;
    const loop = () => {
      if (state.screen === 'game') {
        let dx = 0, dz = 0;
        if (keys.current.w || keys.current.arrowup) dz -= 0.16;
        if (keys.current.s || keys.current.arrowdown) dz += 0.16;
        if (keys.current.a || keys.current.arrowleft) dx -= 0.16;
        if (keys.current.d || keys.current.arrowright) dx += 0.16;
        if (dx || dz) send({ type: 'move', dx, dz });
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [state.screen]);

  if (state.screen === 'menu') return <main className="menu">
    <section className="card">
      <h1>Empire Planet Test</h1>
      <p>First-person desktop mode plus a separate WebXR VR mode for Meta Quest. Same backend, same rooms, same future game systems.</p>
      <label>Username</label><input value={name} onChange={e => setName(e.target.value)} />
      <div className="row"><button onClick={() => createRoom('public')}>Create Public</button><button onClick={() => createRoom('private')}>Create Private</button></div>
      <a className="vrLink" href="/vr.html">Open VR Mode</a>
      <h2>Join Private</h2><div className="row"><input placeholder="CODE" value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())}/><button onClick={() => joinRoom(roomCode)}>Join</button></div>
    </section>
    <section className="card"><div className="between"><h2>Public Servers</h2><button onClick={refresh}>Refresh</button></div>{rooms.length === 0 && <p>No public servers.</p>}{rooms.map(r => <div className="server" key={r.code}><b>{r.code}</b><span>{r.count} players • Host: {r.host}</span><button onClick={() => joinRoom(r.code)}>Join</button></div>)}</section>
  </main>;

  return <main className="game">
    <header><div><small>{state.room.visibility} server</small><h1>Code: {state.room.code} <span>Host: {state.room.hostName}</span>{isHost && <em>You are host</em>}</h1></div><div className="row"><a className="vrLink small" href="/vr.html">VR Mode</a><button className="danger" onClick={leave}>Leave Server</button></div></header>
    <section className="layout">
      <VoxelWorld room={state.room} playerId={state.playerId} />
      <aside className="card"><h2>Players</h2><p className="tiny">First-person desktop: WASD / arrow keys. VR: use Quest Browser and press Enter VR.</p>{state.room.players.map(p => <div className="player" key={p.id}><b>{p.username}</b><span>{p.isHost ? 'HOST' : p.isAfk ? 'AFK' : 'PLAYER'}</span>{isHost && p.id !== state.playerId && <button className="danger" onClick={() => kick(p.id)}>Kick</button>}</div>)}</aside>
    </section>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);