import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const WORLD_SIZE = 34;
const HALF = Math.floor(WORLD_SIZE / 2);

function hash2(x, z) {
  let n = x * 374761393 + z * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

function heightAt(x, z) {
  const h = Math.sin(x * 0.33) * 1.6 + Math.cos(z * 0.27) * 1.4 + Math.sin((x + z) * 0.18) * 1.2 + hash2(x, z) * 1.5;
  return Math.max(0, Math.floor(h + 3));
}

function treeAt(x, z) {
  const h = heightAt(x, z);
  return h >= 3 && hash2(x + 99, z - 44) > 0.88 && Math.abs(x) > 2 && Math.abs(z) > 2;
}

function buildWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const grass = new THREE.MeshLambertMaterial({ color: 0x4ade80 });
  const dirt = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
  const stone = new THREE.MeshLambertMaterial({ color: 0x64748b });
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7c3f12 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x15803d });

  for (let x = -HALF; x <= HALF; x++) {
    for (let z = -HALF; z <= HALF; z++) {
      const h = heightAt(x, z);
      for (let y = 0; y <= h; y++) {
        const mat = y === h ? grass : y < h - 2 ? stone : dirt;
        const block = new THREE.Mesh(box, mat);
        block.position.set(x, y - 0.5, z);
        group.add(block);
      }
      if (treeAt(x, z)) {
        const baseY = h + 0.5;
        for (let i = 0; i < 4; i++) {
          const trunk = new THREE.Mesh(box, trunkMat);
          trunk.position.set(x, baseY + i, z);
          group.add(trunk);
        }
        for (let lx = -2; lx <= 2; lx++) for (let lz = -2; lz <= 2; lz++) for (let ly = 0; ly <= 2; ly++) {
          const dist = Math.abs(lx) + Math.abs(lz) + ly * 0.5;
          if (dist <= 3.2 && hash2(x + lx * 3, z + lz * 5 + ly) > 0.12) {
            const leaf = new THREE.Mesh(box, leafMat);
            leaf.position.set(x + lx, baseY + 3 + ly, z + lz);
            group.add(leaf);
          }
        }
      }
    }
  }
}

function createPill(color) {
  const root = new THREE.Group();
  const body = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x111827 });
  const white = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const capsule = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.95, 8, 16), body);
  capsule.position.y = 1.05;
  root.add(capsule);
  const eyeGeo = new THREE.SphereGeometry(0.055, 8, 8);
  const eye1 = new THREE.Mesh(eyeGeo, white);
  const eye2 = new THREE.Mesh(eyeGeo, white);
  eye1.position.set(-0.12, 1.28, -0.32);
  eye2.position.set(0.12, 1.28, -0.32);
  root.add(eye1, eye2);
  const pupilGeo = new THREE.SphereGeometry(0.027, 8, 8);
  const p1 = new THREE.Mesh(pupilGeo, dark);
  const p2 = new THREE.Mesh(pupilGeo, dark);
  p1.position.set(-0.12, 1.28, -0.36);
  p2.position.set(0.12, 1.28, -0.36);
  root.add(p1, p2);
  const footGeo = new THREE.BoxGeometry(0.22, 0.12, 0.38);
  const f1 = new THREE.Mesh(footGeo, dark);
  const f2 = new THREE.Mesh(footGeo, dark);
  f1.position.set(-0.18, 0.25, -0.08);
  f2.position.set(0.18, 0.25, -0.08);
  root.add(f1, f2);
  return root;
}

function addNameLabel(model, text) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(2,6,23,.75)';
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 42px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(text, 256, 78);
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
  label.position.y = 2.25;
  label.scale.set(2.7, 0.7, 1);
  model.add(label);
}

export default function VoxelWorld({ room, playerId }) {
  const mount = useRef(null);
  const data = useRef(null);

  useEffect(() => {
    if (!mount.current) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 18, 55);
    const camera = new THREE.PerspectiveCamera(65, mount.current.clientWidth / mount.current.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.current.clientWidth, mount.current.clientHeight);
    mount.current.innerHTML = '';
    mount.current.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(18, 30, 12);
    scene.add(sun);
    buildWorld(scene);
    data.current = { scene, camera, renderer, models: new Map() };
    const resize = () => {
      if (!mount.current) return;
      camera.aspect = mount.current.clientWidth / mount.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.current.clientWidth, mount.current.clientHeight);
    };
    addEventListener('resize', resize);
    let raf;
    const loop = () => {
      const local = room?.players?.find(p => p.id === playerId);
      if (local) {
        camera.position.lerp(new THREE.Vector3(local.x, local.y + 8, local.z + 10), 0.08);
        camera.lookAt(local.x, local.y + 1.2, local.z);
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); renderer.dispose(); data.current = null; };
  }, []);

  useEffect(() => {
    if (!data.current || !room) return;
    const { scene, models } = data.current;
    const alive = new Set();
    for (const p of room.players) {
      alive.add(p.id);
      let model = models.get(p.id);
      if (!model) {
        const color = p.id === playerId ? 0x67e8f9 : p.isHost ? 0xfde047 : 0xe2e8f0;
        model = createPill(color);
        addNameLabel(model, p.username + (p.isHost ? ' HOST' : ''));
        scene.add(model);
        models.set(p.id, model);
      }
      model.position.lerp(new THREE.Vector3(p.x, p.y, p.z), 0.45);
      model.rotation.y = p.rot || 0;
      model.visible = !p.isAfk;
    }
    for (const [id, model] of models) if (!alive.has(id)) { scene.remove(model); models.delete(id); }
  }, [room, playerId]);

  return <div className="world" ref={mount}><p className="hint">Loading voxel world...</p></div>;
}
