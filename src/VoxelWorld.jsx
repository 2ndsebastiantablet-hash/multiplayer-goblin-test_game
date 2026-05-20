import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';

const SIZE = 34;
const HALF = Math.floor(SIZE / 2);
const DEFAULT_EYE_HEIGHT = 1.35;

function hash2(x, z) {
  let n = x * 374761393 + z * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}
function heightAt(x, z) {
  const h = Math.sin(x * .33) * 1.6 + Math.cos(z * .27) * 1.4 + Math.sin((x + z) * .18) * 1.2 + hash2(x, z) * 1.5;
  return Math.max(0, Math.floor(h + 3));
}
function groundY(x, z) { return heightAt(Math.round(x), Math.round(z)) + .5; }
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
      for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(box, trunk); t.position.set(x, base + i, z); scene.add(t); }
      for (let lx = -2; lx <= 2; lx++) for (let lz = -2; lz <= 2; lz++) for (let ly = 0; ly <= 2; ly++) {
        if (Math.abs(lx) + Math.abs(lz) + ly * .5 <= 3.2 && hash2(x + lx * 3, z + lz * 5 + ly) > .12) {
          const m = new THREE.Mesh(box, leaf); m.position.set(x + lx, base + 3 + ly, z + lz); scene.add(m);
        }
      }
    }
  }
}
function mat(color) { return new THREE.MeshLambertMaterial({ color }); }
function sphere(r, material, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 14), material);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); return m;
}
function box(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z); return m;
}
function cone(r, h, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 4), material);
  m.position.set(x, y, z); m.rotation.y = Math.PI / 4; return m;
}
function createGoblinModel(character = 'captain') {
  const g = new THREE.Group();
  const green = mat(0x43b047), dark = mat(0x111827), eye = mat(0xffffff), pupil = mat(0x020617);
  const leather = mat(0x8b4513), metal = mat(0x94a3b8), red = mat(0xdc2626), blue = mat(0x3b82f6), purple = mat(0x7c3aed), gold = mat(0xfacc15);
  let scale = 1;
  if (character === 'giant') scale = 1.45;
  if (character === 'dwarf') scale = .72;
  if (character === 'wizard') scale = 1.02;

  const body = sphere(.36, character === 'wizard' ? purple : character === 'giant' ? metal : character === 'dwarf' ? leather : blue, 0, .82 * scale, 0, character === 'giant' ? 1.25 : 1, character === 'dwarf' ? .85 : 1.3, 1);
  const head = sphere(.28, green, 0, 1.35 * scale, -.02);
  const nose = cone(.08, .18, green, 0, 1.32 * scale, -.28); nose.rotation.x = Math.PI / 2;
  const le = sphere(.045, eye, -.1, 1.42 * scale, -.25), re = sphere(.045, eye, .1, 1.42 * scale, -.25);
  const lp = sphere(.022, pupil, -.1, 1.42 * scale, -.29), rp = sphere(.022, pupil, .1, 1.42 * scale, -.29);
  const earL = cone(.11, .26, green, -.28, 1.36 * scale, 0); earL.rotation.z = Math.PI / 2;
  const earR = cone(.11, .26, green, .28, 1.36 * scale, 0); earR.rotation.z = -Math.PI / 2;
  const handL = sphere(.1 * scale, green, -.42 * scale, .82 * scale, -.02);
  const handR = sphere(.1 * scale, green, .42 * scale, .82 * scale, -.02);
  const footL = sphere(.12 * scale, dark, -.17 * scale, .16 * scale, -.06, 1.25, .65, 1.6);
  const footR = sphere(.12 * scale, dark, .17 * scale, .16 * scale, -.06, 1.25, .65, 1.6);
  g.add(body, head, nose, le, re, lp, rp, earL, earR, handL, handR, footL, footR);
  g.userData.parts = { handL, handR, footL, footR, body, head };

  if (character === 'wizard') {
    const hat = cone(.34, .75, purple, 0, 1.9 * scale, 0); hat.rotation.y = .2;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .06, 18), purple); brim.position.set(0, 1.62 * scale, 0);
    const staff = box(.05, 1.3, .05, leather, .55, .85, 0); const gem = sphere(.11, mat(0x67e8f9), .55, 1.55, 0);
    g.add(hat, brim, staff, gem);
  } else if (character === 'giant') {
    const shoulderL = sphere(.18, metal, -.55 * scale, 1.08 * scale, 0);
    const shoulderR = sphere(.18, metal, .55 * scale, 1.08 * scale, 0);
    const club = box(.16, 1.15, .16, leather, .72 * scale, .85 * scale, 0); club.rotation.z = -.22;
    const clubHead = sphere(.22, mat(0x78350f), .82 * scale, 1.42 * scale, 0, 1, 1.25, 1);
    g.add(shoulderL, shoulderR, club, clubHead);
  } else if (character === 'dwarf') {
    const hood = cone(.27, .32, dark, 0, 1.58 * scale, 0);
    const dagger = box(.04, .55, .04, metal, .35, .62, -.12); dagger.rotation.z = -.75;
    const pack = box(.28, .3, .16, leather, 0, .82 * scale, .2);
    g.add(hood, dagger, pack);
  } else {
    const helmet = new THREE.Mesh(new THREE.CylinderGeometry(.28, .3, .18, 14), metal); helmet.position.set(0, 1.57 * scale, 0);
    const plume = box(.08, .24, .05, red, 0, 1.78 * scale, 0);
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(.25, .25, .08, 18), gold); shield.position.set(-.52, .86, -.05); shield.rotation.x = Math.PI / 2;
    const sword = box(.04, .8, .04, metal, .52, .86, -.05); sword.rotation.z = -.5;
    g.add(helmet, plume, shield, sword);
  }
  return g;
}
function makeLittlePerson(seed) {
  const g = new THREE.Group();
  const colors = [0xf97316, 0xa78bfa, 0x38bdf8, 0xfacc15, 0xfb7185, 0x34d399];
  const bodyMat = mat(colors[seed % colors.length]), headMat = mat(0xffd7a8), handMat = mat(0xffd7a8), footMat = mat(0x111827);
  const body = sphere(.18, bodyMat, 0, .42, 0, 1, 1.25, 1), head = sphere(.15, headMat, 0, .78, 0);
  const lh = sphere(.07, handMat, -.23, .43, 0), rh = sphere(.07, handMat, .23, .43, 0), lf = sphere(.075, footMat, -.09, .12, -.03), rf = sphere(.075, footMat, .09, .12, -.03);
  g.add(body, head, lh, rh, lf, rf); g.userData.parts = { lh, rh, lf, rf, body, head }; return g;
}
function spawnLittlePeople(scene) {
  const people = [];
  for (let i = 0; i < 18; i++) {
    const angle = i * 2.399, radius = 4 + (i % 5) * 2.2, x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    const npc = makeLittlePerson(i); npc.position.set(x, groundY(x, z), z); npc.rotation.y = angle + Math.PI / 2;
    npc.userData.walk = { homeX: x, homeZ: z, angle, speed: .35 + (i % 4) * .08, radius: 1.5 + (i % 3) * .6, phase: i * .7 };
    scene.add(npc); people.push(npc);
  }
  return people;
}
function updateLittlePeople(people, time) {
  for (const npc of people) {
    const w = npc.userData.walk, t = time * w.speed + w.phase, x = w.homeX + Math.cos(t) * w.radius, z = w.homeZ + Math.sin(t) * w.radius;
    npc.position.lerp(new THREE.Vector3(x, groundY(x, z), z), .08); npc.rotation.y = -t + Math.PI / 2;
    const step = Math.sin(time * 8 + w.phase), p = npc.userData.parts;
    p.lf.position.z = -.03 + step * .08; p.rf.position.z = -.03 - step * .08; p.lh.position.z = -step * .06; p.rh.position.z = step * .06;
    p.body.position.y = .42 + Math.abs(step) * .025; p.head.position.y = .78 + Math.abs(step) * .025;
  }
}
function label(model, text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const ctx = c.getContext('2d'); ctx.fillStyle = 'rgba(2,6,23,.75)'; ctx.fillRect(0, 0, 512, 128); ctx.fillStyle = '#fff'; ctx.font = 'bold 42px Arial'; ctx.textAlign = 'center'; ctx.fillText(text, 256, 78);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true })); s.position.y = 2.6; s.scale.set(2.7, .7, 1); model.add(s);
}
function hudTexture(room, locked) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
  const ctx = c.getContext('2d'); ctx.fillStyle = 'rgba(2,6,23,.82)'; ctx.fillRect(0, 0, 1024, 256);
  ctx.fillStyle = '#67e8f9'; ctx.font = 'bold 54px Arial'; ctx.textAlign = 'center'; ctx.fillText('Empire Planet Test VR', 512, 70);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 38px Arial'; ctx.fillText(`Code: ${room?.code || '---'}   Host: ${room?.hostName || '---'}`, 512, 135);
  ctx.fillStyle = '#cbd5e1'; ctx.font = '30px Arial'; ctx.fillText(locked ? 'Mouse locked. ESC unlocks. Space jumps.' : 'Click world to lock mouse. WASD moves. Space jumps.', 512, 195);
  return new THREE.CanvasTexture(c);
}

export default function VoxelWorld({ room, playerId, onMove, look, onLockMouse }) {
  const mount = useRef(null), data = useRef(null), roomRef = useRef(room), lookRef = useRef(look || { yaw: 0, pitch: 0, locked: false }), lastVrMove = useRef(0);
  roomRef.current = room; lookRef.current = look || lookRef.current;
  useEffect(() => {
    if (!mount.current) return;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x87ceeb); scene.fog = new THREE.Fog(0x87ceeb, 18, 55);
    const camera = new THREE.PerspectiveCamera(75, mount.current.clientWidth / mount.current.clientHeight, .1, 1000);
    const pitchNode = new THREE.Group(); pitchNode.position.y = DEFAULT_EYE_HEIGHT;
    const rig = new THREE.Group(); scene.add(rig); rig.add(pitchNode); pitchNode.add(camera);
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.xr.enabled = true; renderer.setSize(mount.current.clientWidth, mount.current.clientHeight);
    mount.current.innerHTML = ''; mount.current.appendChild(renderer.domElement); const vrButton = VRButton.createButton(renderer); vrButton.classList.add('vrButton'); mount.current.appendChild(vrButton);
    rig.add(renderer.xr.getController(0), renderer.xr.getController(1)); scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.2)); const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(18, 30, 12); scene.add(sun);
    buildWorld(scene); const people = spawnLittlePeople(scene);
    const hudMat = new THREE.MeshBasicMaterial({ map: hudTexture(roomRef.current, lookRef.current.locked), transparent: true }); const hud = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), hudMat); hud.position.set(0, 2.35, -3.4); rig.add(hud);
    data.current = { scene, camera, renderer, rig, pitchNode, models: new Map(), hudMat, people };
    const resize = () => { if (!mount.current) return; camera.aspect = mount.current.clientWidth / mount.current.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(mount.current.clientWidth, mount.current.clientHeight); };
    addEventListener('resize', resize);
    renderer.setAnimationLoop(() => {
      const local = roomRef.current?.players?.find(p => p.id === playerId);
      if (local) { rig.position.lerp(new THREE.Vector3(local.x, local.y, local.z), .35); pitchNode.position.y = local.eye || DEFAULT_EYE_HEIGHT; if (!renderer.xr.isPresenting) { rig.rotation.y = lookRef.current.yaw; pitchNode.rotation.x = lookRef.current.pitch; } }
      updateLittlePeople(people, performance.now() * .001);
      if (renderer.xr.isPresenting && onMove) {
        const session = renderer.xr.getSession(), sources = session?.inputSources ? Array.from(session.inputSources) : [], pad = sources.find(s => s.gamepad)?.gamepad, a = pad?.axes || [];
        const sx = Math.abs(a[2] || a[0] || 0) > .18 ? (a[2] || a[0]) : 0, sy = Math.abs(a[3] || a[1] || 0) > .18 ? (a[3] || a[1]) : 0;
        const jump = !!pad?.buttons?.some((b, i) => (i === 0 || i === 3) && b.pressed), t = performance.now();
        if ((sx || sy || jump) && t - lastVrMove.current > 35) { const forward = camera.getWorldDirection(new THREE.Vector3()); forward.y = 0; forward.normalize(); const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize(); const delta = forward.multiplyScalar(-sy * .16).add(right.multiplyScalar(sx * .16)); onMove(delta.x, delta.z, { jump }); lastVrMove.current = t; }
      }
      renderer.render(scene, camera);
    });
    return () => { removeEventListener('resize', resize); renderer.setAnimationLoop(null); renderer.dispose(); data.current = null; };
  }, [playerId, onMove]);

  useEffect(() => {
    if (!data.current || !room) return;
    const { scene, models, hudMat } = data.current;
    if (hudMat?.map) hudMat.map.dispose(); hudMat.map = hudTexture(room, look?.locked); hudMat.needsUpdate = true;
    const alive = new Set();
    for (const p of room.players) {
      alive.add(p.id);
      let model = models.get(p.id);
      if (!model || model.userData.character !== p.character) {
        if (model) scene.remove(model);
        model = createGoblinModel(p.character); model.userData.character = p.character;
        label(model, `${p.username} ${p.className || ''}${p.isHost ? ' HOST' : ''}`);
        scene.add(model); models.set(p.id, model);
      }
      model.position.lerp(new THREE.Vector3(p.x, p.y, p.z), .45); model.rotation.y = p.rot || 0; model.visible = !p.isAfk && p.id !== playerId;
    }
    for (const [id, model] of models) if (!alive.has(id)) { scene.remove(model); models.delete(id); }
  }, [room, playerId, look?.locked]);

  return <div className="world" ref={mount} onClick={onLockMouse}><p className="hint">{look?.locked ? 'Mouse locked. Each goblin class has different size and speed.' : 'Click world to lock mouse. Choose class before joining.'}</p></div>;
}
