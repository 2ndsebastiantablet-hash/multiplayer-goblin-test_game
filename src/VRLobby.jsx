import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';

function makeTexture(title, sub = '', selected = false) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = selected ? 'rgba(250,204,21,.96)' : 'rgba(15,23,42,.96)'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = selected ? '#fff' : '#67e8f9'; ctx.lineWidth = 12; ctx.strokeRect(8, 8, c.width - 16, c.height - 16);
  ctx.fillStyle = selected ? '#111827' : '#fff'; ctx.font = 'bold 58px Arial'; ctx.textAlign = 'center'; ctx.fillText(title, 512, 105);
  ctx.fillStyle = selected ? '#1f2937' : '#cbd5e1'; ctx.font = '34px Arial'; ctx.fillText(sub, 512, 168);
  return new THREE.CanvasTexture(c);
}
function makeButton(title, sub, x, y, action, selected = false) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.05, .5), new THREE.MeshBasicMaterial({ map: makeTexture(title, sub, selected), transparent: true }));
  mesh.position.set(x, y, 0); mesh.userData.action = action; return mesh;
}
function clean(mesh) { mesh.material?.map?.dispose?.(); mesh.material?.dispose?.(); mesh.geometry?.dispose?.(); }

export default function VRLobby({ character, setCharacter, createRoom, joinFirstPublic, rooms }) {
  const mount = useRef(null), live = useRef({ character, rooms }); live.current = { character, rooms };
  useEffect(() => {
    if (!mount.current) return;
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#020617');
    const camera = new THREE.PerspectiveCamera(70, mount.current.clientWidth / mount.current.clientHeight, .1, 100); camera.position.set(0, 1.65, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.xr.enabled = true; renderer.setSize(mount.current.clientWidth, mount.current.clientHeight);
    mount.current.innerHTML = ''; mount.current.appendChild(renderer.domElement);
    const vrButton = VRButton.createButton(renderer); vrButton.classList.add('vrButton'); mount.current.appendChild(vrButton);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.3));
    const panel = new THREE.Group(); panel.position.set(0, 1.55, -2.7); scene.add(panel);
    const classes = [['wizard','Wizard'], ['giant','Giant'], ['dwarf','Dwarf'], ['captain','Captain']];
    const buttons = [], raycaster = new THREE.Raycaster(), temp = new THREE.Matrix4();
    function rebuild() {
      while (buttons.length) { const b = buttons.pop(); panel.remove(b); clean(b); }
      const title = makeButton('GOBLIN VR LOBBY', 'Aim + trigger to select. Use this before entering the game.', 0, 1.1, null, true); buttons.push(title); panel.add(title);
      classes.forEach(([id, label], i) => { const b = makeButton(label, live.current.character === id ? 'SELECTED' : 'choose class', i % 2 ? 1.1 : -1.1, .35 - Math.floor(i / 2) * .6, () => setCharacter(id), live.current.character === id); buttons.push(b); panel.add(b); });
      const pub = makeButton('CREATE PUBLIC', 'start shared server', -1.1, -1.15, () => createRoom('public'));
      const priv = makeButton('CREATE PRIVATE', 'start code server', 1.1, -1.15, () => createRoom('private'));
      const join = makeButton('JOIN PUBLIC', live.current.rooms?.length ? 'join first public server' : 'no public servers', 0, -1.75, () => joinFirstPublic());
      buttons.push(pub, priv, join); panel.add(pub, priv, join);
    }
    rebuild();
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-3)]);
    function addController(i) { const c = renderer.xr.getController(i); c.add(new THREE.Line(lineGeo.clone(), new THREE.LineBasicMaterial({ color: 0x67e8f9 }))); scene.add(c); c.addEventListener('selectend', () => { temp.identity().extractRotation(c.matrixWorld); raycaster.ray.origin.setFromMatrixPosition(c.matrixWorld); raycaster.ray.direction.set(0,0,-1).applyMatrix4(temp); const hit = raycaster.intersectObjects(buttons, false)[0]; hit?.object?.userData?.action?.(); setTimeout(rebuild, 60); }); }
    addController(0); addController(1);
    const resize = () => { if (!mount.current) return; camera.aspect = mount.current.clientWidth / mount.current.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(mount.current.clientWidth, mount.current.clientHeight); };
    addEventListener('resize', resize); renderer.setAnimationLoop(() => renderer.render(scene, camera));
    return () => { removeEventListener('resize', resize); renderer.setAnimationLoop(null); renderer.dispose(); scene.traverse(o => { if (o.geometry) o.geometry.dispose?.(); if (o.material) { o.material.map?.dispose?.(); o.material.dispose?.(); } }); };
  }, [setCharacter, createRoom, joinFirstPublic]);
  return <section className="card vrLobbyCard"><h2>VR Lobby</h2><p className="tiny">Quest/Oculus: press Enter VR here, aim at buttons, and use either trigger to select.</p><div className="vrLobby" ref={mount}></div></section>;
}
