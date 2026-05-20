import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

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

export default function VoxelWorld({ room, playerId }) {
  const mount = useRef(null);
  const data = useRef(null);
  const roomRef = useRef(room);
  roomRef.current = room;

  useEffect(() => {
    if (!mount.current) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 18, 55);
    const camera = new THREE.PerspectiveCamera(75, mount.current.clientWidth / mount.current.clientHeight, .1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.current.clientWidth, mount.current.clientHeight);
    mount.current.innerHTML = '';
    mount.current.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(18, 30, 12); scene.add(sun);
    buildWorld(scene);
    data.current = { scene, camera, renderer, models: new Map() };
    const resize = () => { if (!mount.current) return; camera.aspect = mount.current.clientWidth / mount.current.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(mount.current.clientWidth, mount.current.clientHeight); };
    addEventListener('resize', resize);
    let raf;
    const loop = () => {
      const local = roomRef.current?.players?.find(p => p.id === playerId);
      if (local) {
        camera.position.lerp(new THREE.Vector3(local.x, local.y + 1.45, local.z), .35);
        const yaw = local.rot || 0;
        camera.rotation.set(0, yaw, 0);
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); renderer.dispose(); data.current = null; };
  }, [playerId]);

  useEffect(() => {
    if (!data.current || !room) return;
    const { scene, models } = data.current;
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
  }, [room, playerId]);

  return <div className="world" ref={mount}><p className="hint">First-person voxel world loading...</p></div>;
}
