import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const uid = () => crypto.randomUUID();
const randomName = () => 'Player' + Math.floor(Math.random() * 9999);
const code = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

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
    const d = e => keys.current[e.key.toLowerCase()] = true;
    const u = e => keys.current[e.key.toLowerCase()] = false;
    addEventListener('keydown', d); addEventListener('keyup', u);
    return () => { removeEventListener('keydown', d); removeEventListener('keyup', u); };
  }, []);
  useEffect(() => {
    let raf;
    const loop = () => {
      if (state.screen === 'game') {
        let dx = 0, dy = 0;
        if (keys.current.w || keys.current.arrowup) dy -= 4;
        if (keys.current.s || keys.current.arrowdown) dy += 4;
        if (keys.current.a || keys.current.arrowleft) dx -= 4;
        if (keys.current.d || keys.current.arrowright) dx += 4;
        if (dx || dy) send({ type: 'move', dx, dy });
      }
      raf = requestAnimationFrame(loop);
    };
    loop(); return () => cancelAnimationFrame(raf);
  }, [state.screen]);

  if (state.screen === 'menu') return <main className="menu">
    <section className="card">
      <h1>Multiplayer Goblin Test</h1>
      <p>Real online test: public rooms, private codes, host transfer, kicks, AFK kick, and movement sync.</p>
      <label>Username</label><input value={name} onChange={e => setName(e.target.value)} />
      <div className="row"><button onClick={() => createRoom('public')}>Create Public</button><button onClick={() => createRoom('private')}>Create Private</button></div>
      <h2>Join Private</h2><div className="row"><input placeholder="CODE" value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())}/><button onClick={() => joinRoom(roomCode)}>Join</button></div>
    </section>
    <section className="card"><div className="between"><h2>Public Servers</h2><button onClick={refresh}>Refresh</button></div>{rooms.length === 0 && <p>No public servers.</p>}{rooms.map(r => <div className="server" key={r.code}><b>{r.code}</b><span>{r.count} players • Host: {r.host}</span><button onClick={() => joinRoom(r.code)}>Join</button></div>)}</section>
  </main>;

  return <main className="game">
    <header><div><small>{state.room.visibility} server</small><h1>Code: {state.room.code} <span>Host: {state.room.hostName}</span>{isHost && <em>You are host</em>}</h1></div><button className="danger" onClick={leave}>Leave Server</button></header>
    <section className="layout"><div className="void"><p className="hint">Move with WASD or arrow keys. Idle for 3 minutes = AFK kick.</p>{state.room.players.map(p => <div className={'name ' + (p.id === state.playerId ? 'me ' : '') + (p.isHost ? 'host ' : '') + (p.isAfk ? 'afk ' : '')} style={{left:p.x,top:p.y}} key={p.id}>{p.username}{p.isHost && ' HOST'}{p.isAfk && ' AFK'}</div>)}</div>
    <aside className="card"><h2>Players</h2>{state.room.players.map(p => <div className="player" key={p.id}><b>{p.username}</b><span>{p.isHost ? 'HOST' : p.isAfk ? 'AFK' : 'PLAYER'}</span>{isHost && p.id !== state.playerId && <button className="danger" onClick={() => kick(p.id)}>Kick</button>}</div>)}</aside></section>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
