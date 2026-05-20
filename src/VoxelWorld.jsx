import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';

const SIZE = 34;
const HALF = Math.floor(SIZE / 2);

function hash2(x, z) {
  let n = x * 374761393 + z * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}
function heightAt(x, z) {
  const h = Math.sin(x * .33) * 1.6 + Math.cos(z * .27) * 1.4 + Math.sin((x + z) * .18) * 1.2 + hash2(x, z) * 1.5;
  return Math.max(0, Math.floor(h + 3));
}
function treeAt(x, z) {
  return heightAt(x, z) >= 3 && hash2(x + 99, z - 44) > .88 && Math.abs(x) > 2 && Math.abs(z) > 2;
}
function buildWorld(scene) {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const grass = new THREE.MeshLambertMaterial({ color: 0x4ade80 });
  const dirt = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
  const stone = new THREE.MeshLambertMaterial({ color: 0x64748b });
  const trunk = new THREE.MeshLambertMaterial({ color: 0x7c3f12 });
  const leaf = new THREE.MeshLambertMaterial({ color: 0x15803d });
  for (let x = -HALF; x <= HALF; x++) for (let z = -HALF; z <= HALF; z++) {
    const h = heightAt(x, z);
    for (let y = 0; y <= h; y++) {
      const b = new THREE.Mesh(box, y === h ? grass : y < h - 2 ? stone : dirt);
      b.position.set(x, y - .5, z);
      scene.add(b);
    }
    if (treeAt(x, z)) {
      const base = h + .5;
      for (let i = 0; i < 4; i++) {
        const t = new THREE.Mesh(box, trunk);
        t.position.set(x, base + i, z);
        scene.add(t);
      }
      for (let lx = -2; lx <= 2; lx++) for (let lz = -2; lz <= 2; lz++) for (let ly = 0; ly <= 2; ly++) {
        if (Math.abs(lx) + Math.abs(lz) + ly * .5 <= 3.2 && hash2(x + lx * 3, z + lz * 5 + ly) > .12) {
          const m = new THREE.Mesh(box, leaf);
          m.position.set(x + lx, base + 3 + ly, z + lz);
          scene.add(m);
        }
      }
    }
  }
}
function pill(color) {
  const g = new THREE.Group();
  const body = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x111827 });
  const white = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const c = new THREE.Mesh(new THREE.CapsuleGeometry(.35, .95, 8, 16), body);
  c.position.y = 1.05;
  g.add(c);
  for (const x of [-.12, .12]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(.055, 8, 8), white);
    e.position.set(x, 1.28, -.32);
    const p = new THREE.Mesh(new THREE.SphereGeometry(.027, 8, 8), dark);
    p.position.set(x, 1.28, -.36);
    g.add(e, p);
  }
  return g;
}
function label(model, text) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(2,6,23,.75)'; ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 42px Arial'; ctx.textAlign = 'center'; ctx.fillText(text, 256, 78);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
  s.position.y = 2.25; s.scale.set(2.7, .7, 1); model.add(s);
}
function hudTexture(room, locked) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(2,6,23,.82)'; ctx.fillRect(0, 0, 1024, 256);
  ctx.fillStyle = '#67e8f9'; ctx.font = 'bold 54px Arial'; ctx.textAlign = 'center';
  ctx.fillText('Empire Planet Test VR', 512, 70);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 38px Arial';
  ctx.fillText(`Code: ${room?.code || '---'}   Host: ${room?.hostName || '---'}`, 512, 135);
  ctx.fillStyle = '#cbd5e1'; ctx.font = '30px Arial';
  ctx.fillText(locked ? 'Mouse locked. ESC unlocks. Space jumps.' : 'Click world to lock mouse. WASD moves. Space jumps.', 512, 195);
  return new THREE.CanvasTexture(c);
}

export default function VoxelWorld({ room, playerId, onMove, look, onLockMouse }) {
  const mount = useRef(null);
  const data = useRef(null);
  const roomRef = useRef(room);
  const lookRef = useRef(look || { yaw: 0, pitch: 0, locked: false });
  const lastVrMove = useRef(0);
  roomRef.current = room;
  lookRef.current = look || lookRef.current;

  useEffect(() => {
    if (!mount.current) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 18, 55);
    const camera = new THREE.PerspectiveCamera(75, mount.current.clientWidth / mount.current.clientHeight, .1, 1000);
    const pitchNode = new THREE.Group();
    const rig = new THREE.Group();
    scene.add(rig);
    rig.add(pitchNode);
    pitchNode.add(camera);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.xr.enabled = true;
    renderer.setSize(mount.current.clientWidth, mount.current.clientHeight);
    mount.current.innerHTML = '';
    mount.current.appendChild(renderer.domElement);
    const vrButton = VRButton.createButton(renderer);
    vrButton.classList.add('vrButton');
    mount.current.appendChild(vrButton);
    rig.add(renderer.xr.getController(0), renderer.xr.getController(1));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(18, 30, 12); scene.add(sun);
    buildWorld(scene);
    const hudMat = new THREE.MeshBasicMaterial({ map: hudTexture(roomRef.current, lookRef.current.locked), transparent: true });
    const hud = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), hudMat);
    hud.position.set(0, 2.25, -3.4);
    rig.add(hud);
    data.current = { scene, camera, renderer, rig, pitchNode, models: new Map(), hudMat };
    const resize = () => { if (!mount.current) return; camera.aspect = mount.current.clientWidth / mount.current.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(mount.current.clientWidth, mount.current.clientHeight); };
    addEventListener('resize', resize);
    renderer.setAnimationLoop(() => {
      const local = roomRef.current?.players?.find(p => p.id === playerId);
      if (local) {
        rig.position.lerp(new THREE.Vector3(local.x, local.y, local.z), .35);
        if (!renderer.xr.isPresenting) {
          rig.rotation.y = lookRef.current.yaw;
          pitchNode.rotation.x = lookRef.current.pitch;
        }
      }
      if (renderer.xr.isPresenting && onMove) {
        const session = renderer.xr.getSession();
        const sources = session?.inputSources ? Array.from(session.inputSources) : [];
        const pad = sources.find(s => s.gamepad)?.gamepad;
        const a = pad?.axes || [];
        const sx = Math.abs(a[2] || a[0] || 0) > .18 ? (a[2] || a[0]) : 0;
        const sy = Math.abs(a[3] || a[1] || 0) > .18 ? (a[3] || a[1]) : 0;
        const jump = !!pad?.buttons?.some((b, i) => (i === 0 || i === 3) && b.pressed);
        const t = performance.now();
        if ((sx || sy || jump) && t - lastVrMove.current > 35) {
          const forward = camera.getWorldDirection(new THREE.Vector3());
          forward.y = 0; forward.normalize();
          const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
          const delta = forward.multiplyScalar(-sy * .16).add(right.multiplyScalar(sx * .16));
          onMove(delta.x, delta.z, { jump });
          lastVrMove.current = t;
        }
      }
      renderer.render(scene, camera);
    });
    return () => { removeEventListener('resize', resize); renderer.setAnimationLoop(null); renderer.dispose(); data.current = null; };
  }, [playerId, onMove]);

  useEffect(() => {
    if (!data.current || !room) return;
    const { scene, models, hudMat } = data.current;
    if (hudMat?.map) hudMat.map.dispose();
    hudMat.map = hudTexture(room, look?.locked); hudMat.needsUpdate = true;
    const alive = new Set();
    for (const p of room.players) {
      alive.add(p.id);
      let model = models.get(p.id);
      if (!model) {
        model = pill(p.id === playerId ? 0x67e8f9 : p.isHost ? 0xfde047 : 0xe2e8f0);
        label(model, p.username + (p.isHost ? ' HOST' : ''));
        scene.add(model);
        models.set(p.id, model);
      }
      model.position.lerp(new THREE.Vector3(p.x, p.y, p.z), .45);
      model.rotation.y = p.rot || 0;
      model.visible = !p.isAfk && p.id !== playerId;
    }
    for (const [id, model] of models) if (!alive.has(id)) { scene.remove(model); models.delete(id); }
  }, [room, playerId, look?.locked]);

  return <div className="world" ref={mount} onClick={onLockMouse}><p className="hint">{look?.locked ? 'Mouse locked: look around. Space jumps. ESC unlocks.' : 'Click world to lock mouse. WASD moves. Space jumps.'}</p></div>;
}
