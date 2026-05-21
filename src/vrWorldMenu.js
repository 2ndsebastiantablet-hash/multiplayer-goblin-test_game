import * as THREE from 'three';

function tex(title, sub = '', selected = false) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 240;
  const ctx = c.getContext('2d');
  ctx.fillStyle = selected ? 'rgba(250,204,21,.96)' : 'rgba(15,23,42,.94)'; ctx.fillRect(0,0,c.width,c.height);
  ctx.strokeStyle = selected ? '#fff' : '#67e8f9'; ctx.lineWidth = 10; ctx.strokeRect(8,8,c.width-16,c.height-16);
  ctx.fillStyle = selected ? '#111827' : '#fff'; ctx.font = 'bold 42px Arial'; ctx.textAlign = 'center'; ctx.fillText(title,512,92);
  ctx.fillStyle = selected ? '#1f2937' : '#cbd5e1'; ctx.font = '28px Arial'; ctx.fillText(sub,512,150);
  return new THREE.CanvasTexture(c);
}
function btn(title, sub, x, y, action, selected = false, w = 1.95) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w,.42), new THREE.MeshBasicMaterial({ map: tex(title, sub, selected), transparent: true }));
  m.position.set(x,y,0); m.userData.action = action; return m;
}
function clean(m){m.material?.map?.dispose?.();m.material?.dispose?.();m.geometry?.dispose?.();}

export function createVRWorldMenu({ optionLists, onCreatePlanet }) {
  const group = new THREE.Group();
  group.visible = false;
  group.position.set(0, 1.5, -3.05);
  const raycaster = new THREE.Raycaster(), temp = new THREE.Matrix4();
  const choices = { name: 'VR Planet', terrain: 'green_hills', flora: 'normal_trees', atmosphere: 'clear_blue_sky', structure: 'none' };
  const buttons = [];
  const lists = { terrain: optionLists?.terrain || [], flora: optionLists?.flora || [], atmosphere: optionLists?.atmosphere || [], structure: optionLists?.structure || [] };
  const labels = { terrain:'Terrain', flora:'Plants', atmosphere:'Sky', structure:'Structures' };
  const keys = ['terrain','flora','atmosphere','structure'];
  let onVisibilityChange = null;
  function labelFor(key) { return lists[key].find(([id]) => id === choices[key])?.[1] || choices[key]; }
  function cycle(key, dir) { const list = lists[key]; const i = Math.max(0, list.findIndex(([id]) => id === choices[key])); choices[key] = list[(i + dir + list.length) % list.length]?.[0] || choices[key]; rebuild(); }
  function setVisible(v) { group.visible = v; onVisibilityChange?.(v); }
  function applyPlanet() { setVisible(false); setTimeout(() => onCreatePlanet?.({ ...choices }), 80); }
  function rebuild() {
    while (buttons.length) { const b = buttons.pop(); group.remove(b); clean(b); }
    const title = btn('CREATE PLANET', 'Y opens/closes. Aim pointer + trigger to select.', 0, 1.55, null, true, 2.55); buttons.push(title); group.add(title);
    keys.forEach((key, row) => {
      const y = .82 - row * .62;
      const prev = btn('<', labels[key], -1.6, y, () => cycle(key, -1), false, .7);
      const mid = btn(labelFor(key), labels[key], 0, y, null, true, 1.95);
      const next = btn('>', labels[key], 1.6, y, () => cycle(key, 1), false, .7);
      buttons.push(prev, mid, next); group.add(prev, mid, next);
    });
    const apply = btn('APPLY + SAVE', 'build selected planet', 0, -1.85, applyPlanet, false, 2.4);
    buttons.push(apply); group.add(apply);
  }
  rebuild();
  function click(controller) {
    if (!group.visible) return;
    temp.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0,0,-1).applyMatrix4(temp);
    const hit = raycaster.intersectObjects(buttons, false)[0];
    hit?.object?.userData?.action?.();
  }
  function dispose() { while (buttons.length) clean(buttons.pop()); }
  return { group, click, toggle(){ setVisible(!group.visible); }, setPointerVisibilityCallback(fn){ onVisibilityChange = fn; }, dispose };
}
