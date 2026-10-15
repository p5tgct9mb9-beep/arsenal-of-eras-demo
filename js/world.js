// Procedural low-poly arena. All boxes go into ONE InstancedMesh (+1 for glowing
// strips) so the whole map costs only a handful of draw calls on mobile.
import * as THREE from 'three';

export const HALF = 42;      // playable half-size (meters)
const STEP = 0.55;           // max step-up height

function rngFrom(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function buildWorld(scene, era, key) {
  const R = rngFrom(key + '-arena');
  const rand = (a, b) => a + R() * (b - a);
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const boxes = [], glows = [], colliders = [];
  const root = new THREE.Group(); scene.add(root);

  function add(x, z, w, h, d, color, o = {}) {
    const y = o.y || 0;
    boxes.push({ x, y: y + h / 2, z, w, h, d, rx: o.rx || 0, ry: o.ry || 0, rz: o.rz || 0, color });
    if (o.collide !== false) colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, minY: y, top: y + h });
  }
  function glow(x, y, z, w, h, d, color) { glows.push({ x, y, z, w, h, d, color }); }
  function free(x, z, w, d, margin) {
    if (Math.hypot(x, z) < 9 + Math.max(w, d) / 2) return false;
    if (Math.abs(x) + w / 2 > HALF - 2 || Math.abs(z) + d / 2 > HALF - 2) return false;
    for (const c of colliders) {
      if (x + w / 2 + margin > c.minX && x - w / 2 - margin < c.maxX && z + d / 2 + margin > c.minZ && z - d / 2 - margin < c.maxZ) return false;
    }
    return true;
  }
  function place(w, d, margin, tries = 40) {
    for (let i = 0; i < tries; i++) { const x = rand(-HALF + 3, HALF - 3), z = rand(-HALF + 3, HALF - 3); if (free(x, z, w, d, margin)) return [x, z]; }
    return null;
  }

  const T = era.theme;
  const bc = era.buildingColors;
  const neon = era.neon || [0xffffff];

  // --- perimeter walls
  const wallH = T === 'space' ? 2.6 : 4.5;
  const wallC = T === 'ww2' ? 0x6d6455 : T === 'cold' ? 0x7d8287 : T === 'modern' ? 0xbfa77e : T === 'future' ? 0x1e2029 : 0x9c9ca2;
  add(0, -HALF - 0.5, HALF * 2 + 2, wallH, 1, wallC); add(0, HALF + 0.5, HALF * 2 + 2, wallH, 1, wallC);
  add(-HALF - 0.5, 0, 1, wallH, HALF * 2, wallC); add(HALF + 0.5, 0, 1, wallH, HALF * 2, wallC);
  if (T === 'future') for (const s of [-1, 1]) { glow(0, wallH, s * (HALF + 0.5), HALF * 2 + 2, 0.12, 1.05, neon[0]); glow(s * (HALF + 0.5), wallH, 0, 1.05, 0.12, HALF * 2, neon[1]); }

  // --- buildings
  const nB = T === 'space' ? 6 : 8;
  for (let i = 0; i < nB; i++) {
    const w = rand(6, 11), d = rand(6, 11);
    const h = T === 'space' ? rand(3, 4.5) : T === 'future' ? rand(9, 16) : T === 'cold' ? rand(6, 12) : rand(4.5, 8);
    const p = place(w, d, 4.5); if (!p) continue;
    const [x, z] = p; const col = pick(bc);
    const ruined = T === 'ww2' && R() < 0.5;
    if (ruined) {
      // ruined: lower main block + broken chunks
      const hh = h * 0.6; add(x, z, w, hh, d, col);
      add(x - w * 0.25, z, w * 0.45, rand(1, 2.5), d * 0.9, col, { y: hh });
      add(x + w * 0.3, z + d * 0.2, w * 0.25, rand(0.5, 1.5), d * 0.4, col, { y: hh });
      for (let k = 0; k < 3; k++) add(x + rand(-w, w) * 0.7, z + (R() < 0.5 ? -1 : 1) * (d / 2 + rand(0.6, 1.4)), rand(0.6, 1.4), rand(0.3, 0.8), rand(0.6, 1.4), 0x7d7264, { ry: rand(0, 3) });
    } else add(x, z, w, h, d, col);
    // roof trim
    if (T !== 'future' && T !== 'space' && !ruined) add(x, z, w + 0.3, 0.3, d + 0.3, T === 'cold' ? 0x5b5f63 : 0x5b4d3f, { y: h - 0.3, collide: false });
    // windows / strips
    const floors = Math.max(1, Math.floor(h / 3.2));
    for (let f = 0; f < floors; f++) {
      const wy = 1.5 + f * 3.2; if (ruined && wy > h * 0.6 - 0.8) break;
      for (const side of [0, 1, 2, 3]) {
        const along = side < 2 ? w : d; const n = Math.max(1, Math.floor(along / 2.6));
        for (let k = 0; k < n; k++) {
          const off = (k - (n - 1) / 2) * (along / n);
          const wx = side < 2 ? x + off : x + (side === 2 ? -1 : 1) * (w / 2 + 0.03);
          const wz = side < 2 ? z + (side === 0 ? -1 : 1) * (d / 2 + 0.03) : z + off;
          const ww = side < 2 ? 1.1 : 0.08, wd = side < 2 ? 0.08 : 1.1;
          if (T === 'future' || T === 'space') { if (R() < 0.55) glow(wx, wy, wz, side < 2 ? 1.2 : 0.1, 0.35, side < 2 ? 0.1 : 1.2, R() < 0.5 ? neon[0] : neon[1 % neon.length]); else add(wx, wz, ww, 1.2, wd, era.windowColor, { y: wy - 0.6, collide: false }); }
          else add(wx, wz, ww, 1.3, wd, R() < 0.12 ? 0xd8b060 : era.windowColor, { y: wy - 0.6, collide: false });
        }
      }
    }
    if (T === 'future') { glow(x, h + 0.05, z - d / 2, w + 0.1, 0.15, 0.15, pick(neon)); glow(x, h + 0.05, z + d / 2, w + 0.1, 0.15, 0.15, pick(neon)); glow(x - w / 2, h / 2, z - d / 2, 0.15, h, 0.15, neon[0]); glow(x + w / 2, h / 2, z + d / 2, 0.15, h, 0.15, neon[1]); }
    if (T === 'space') { add(x + w * 0.3, z, 0.15, rand(3, 5), 0.15, 0xcccccc, { y: h, collide: false }); glow(x + w * 0.3, h + 4.6, z, 0.3, 0.3, 0.3, 0xff3020); glow(x, 0.3, z - d / 2 - 0.05, w, 0.12, 0.1, neon[1]); }
    if (T === 'cold' && R() < 0.6) add(x, z - d / 2 - 1, 2.4, 2.6, 2, 0x6a6e70); // entrance block
  }

  // --- cover props
  const cover = {
    ww2: [
      { n: 14, f: () => { const s = rand(1.0, 1.4); return [[0, 0, s, s, s, pick([0x7a5a34, 0x6b4c2a, 0x86663c])], ...(R() < 0.4 ? [[0.1, 0, s * 0.7, s * 0.7, s * 0.7, 0x6b4c2a, s]] : [])]; } },
      { n: 10, f: () => { const L = rand(2.5, 4.5), v = R() < 0.5; return [[0, 0, v ? 0.9 : L, 0.95, v ? L : 0.9, 0xb4a27c]]; } },
      { n: 6, f: () => [[0, 0, 1.6, 1.3, 1.6, 0x2c2c2c, 0, 'hedgehog']] },
      { n: 5, f: () => { const L = rand(4, 7), v = R() < 0.5; return [[0, 0, v ? 0.6 : L, 1.15, v ? L : 0.6, 0x8a8070]]; } },
    ],
    cold: [
      { n: 12, f: () => { const v = R() < 0.5; return [[0, 0, v ? 0.7 : 3, 1.05, v ? 3 : 0.7, 0xa3a7a9]]; } },
      { n: 12, f: () => { const s = rand(1.2, 1.6); return [[0, 0, s, s * 0.8, s * 1.3, pick([0x4f5a3a, 0x5a6442])], ...(R() < 0.4 ? [[0, 0, s * 0.9, s * 0.6, s * 0.9, 0x4f5a3a, s * 0.8]] : [])]; } },
      { n: 4, f: () => [[0, 0, 4, 2.0, 4, 0x8e9295], [0, -2.03, 2.4, 0.25, 0.08, 0x111111, 1.3, 'deco']] },
      { n: 8, f: () => [[0, 0, 0.8, 1.1, 0.8, pick([0x8a3a26, 0x3e5a6a])]] },
    ],
    modern: [
      { n: 9, f: () => { const v = R() < 0.5; return [[0, 0, v ? 2.4 : 6, 2.6, v ? 6 : 2.4, pick([0xa83a2a, 0x2a5a8a, 0x3a7a4a, 0xd07a20, 0x8a8a8a])]]; } },
      { n: 10, f: () => { const v = R() < 0.5; const o = []; for (let k = 0; k < 3; k++) o.push([v ? 0 : (k - 1) * 1.22, v ? (k - 1) * 1.22 : 0, 1.2, 1.4, 1.2, 0xc2a874]); return o; } },
      { n: 8, f: () => { const v = R() < 0.5; return [[0, 0, v ? 0.6 : 3.2, 1.0, v ? 3.2 : 0.6, 0xd2d0c8]]; } },
      { n: 8, f: () => { const s = rand(1, 1.3); return [[0, 0, s, s, s, pick([0x8a7a52, 0x6a5a3a])]]; } },
    ],
    future: [
      { n: 14, f: () => { const s = rand(1.2, 1.8); return [[0, 0, s, s, s, 0x2a2d38], [0, 0, s + 0.04, 0.08, s + 0.04, pick(neon), s, 'glow']]; } },
      { n: 10, f: () => { const v = R() < 0.5, L = rand(3, 5); return [[0, 0, v ? 0.5 : L, 1.2, v ? L : 0.5, 0x1d2029], [0, 0, v ? 0.52 : L, 0.08, v ? L : 0.52, pick(neon), 1.0, 'glow']]; } },
      { n: 6, f: () => [[0, 0, 1.2, 6, 1.2, 0x262934], [0, 0, 1.25, 0.12, 1.25, pick(neon), 3, 'glow']] },
    ],
    space: [
      { n: 12, f: () => { const s = rand(1.4, 2.0); return [[0, 0, s, s * 0.8, s * 1.4, 0xe4e4e8], [0, 0, s + 0.03, 0.15, s * 1.4 + 0.03, 0xff7a00, s * 0.4, 'deco']]; } },
      { n: 14, f: () => { const s = rand(1, 2.6); return [[0, 0, s, s * rand(0.5, 0.9), s * rand(0.8, 1.2), pick([0x7a7a7e, 0x6a6a6e, 0x88888c]), 0, 'rock']]; } },
      { n: 5, f: () => [[0, 0, 4, 0.12, 2.4, 0x1c3a7a, 1.2, 'deco'], [0, 0, 0.2, 1.2, 0.2, 0xaaaaaa]] },
    ],
  }[T];

  for (const grp of cover) {
    for (let i = 0; i < grp.n; i++) {
      const parts = grp.f();
      let w = 0, d = 0; for (const p of parts) { w = Math.max(w, Math.abs(p[0]) * 2 + p[2]); d = Math.max(d, Math.abs(p[1]) * 2 + p[4]); }
      const pos = place(w, d, 2.0); if (!pos) continue;
      for (const p of parts) {
        const [ox, oz, pw, ph, pd, col, py = 0, kind] = p;
        const x = pos[0] + ox, z = pos[1] + oz;
        if (kind === 'glow') glow(x, py + ph / 2, z, pw, ph, pd, col);
        else if (kind === 'deco') add(x, z, pw, ph, pd, col, { y: py, collide: false });
        else if (kind === 'hedgehog') {
          add(x, z, 2.0, 0.18, 0.18, col, { y: 0.5, rz: 0.6, ry: 0.4, collide: false });
          add(x, z, 2.0, 0.18, 0.18, col, { y: 0.5, rz: -0.6, ry: -0.4, collide: false });
          add(x, z, 0.18, 1.4, 0.18, col, { y: 0.0, rx: 0.5, collide: false });
          colliders.push({ minX: x - 0.7, maxX: x + 0.7, minZ: z - 0.7, maxZ: z + 0.7, minY: 0, top: 1.2 });
        } else if (kind === 'rock') add(x, z, pw, ph, pd, col, { y: -0.15, ry: rand(0, 1.5), rx: rand(-0.15, 0.15) });
        else add(x, z, pw, ph, pd, col, { y: py });
      }
    }
  }

  // --- distant skyline (no collision)
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rand(-0.1, 0.1), r = rand(58, 85);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (T === 'space') add(x, z, rand(14, 30), rand(4, 12), rand(14, 30), 0x5a5a60, { y: -2, ry: rand(0, 3), collide: false });
    else if (T === 'future') { const h = rand(25, 70); add(x, z, rand(8, 14), h, rand(8, 14), 0x15161e, { collide: false }); if (R() < 0.7) glow(x, h * rand(0.3, 0.95), z, 14.2, 0.4, 14.2, pick(neon)); }
    else add(x, z, rand(8, 16), T === 'cold' ? rand(10, 28) : rand(6, 16), rand(8, 16), T === 'cold' ? 0x737a80 : T === 'modern' ? 0xc8b48c : 0x6f665a, { collide: false });
  }

  // --- build instanced meshes
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const inst = new THREE.InstancedMesh(unit, mat, boxes.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  boxes.forEach((b, i) => {
    e.set(b.rx, b.ry, b.rz); q.setFromEuler(e); s.set(b.w, b.h, b.d); p.set(b.x, b.y, b.z);
    m4.compose(p, q, s); inst.setMatrixAt(i, m4);
    c.setHex(b.color).offsetHSL(0, 0, (R() - 0.5) * 0.04); inst.setColorAt(i, c);
  });
  inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  root.add(inst);
  if (glows.length) {
    const gi = new THREE.InstancedMesh(unit, new THREE.MeshBasicMaterial({ color: 0xffffff }), glows.length);
    glows.forEach((b, i) => { m4.compose(p.set(b.x, b.y, b.z), q.identity(), s.set(b.w, b.h, b.d)); gi.setMatrixAt(i, m4); gi.setColorAt(i, c.setHex(b.color)); });
    gi.instanceMatrix.needsUpdate = true; root.add(gi);
  }

  // --- ground with vertex color noise (+ craters on the Moon)
  const gg = new THREE.PlaneGeometry(240, 240, 60, 60); gg.rotateX(-Math.PI / 2);
  const cols = [], ca = new THREE.Color(era.ground[0]), cb = new THREE.Color(era.ground[1]), tmp = new THREE.Color();
  const craters = T === 'space' ? Array.from({ length: 22 }, () => [rand(-90, 90), rand(-90, 90), rand(3, 9)]) : [];
  const pos = gg.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    tmp.copy(ca).lerp(cb, R());
    for (const [cx, cz, cr] of craters) { const dd = Math.hypot(x - cx, z - cz) / cr; if (dd < 1) tmp.multiplyScalar(0.7 + 0.3 * dd); else if (dd < 1.3) tmp.multiplyScalar(1.12); }
    if (T === 'modern' && (Math.abs(x) < 2.5 || Math.abs(z) < 2.5)) tmp.setHex(0x55524c); // roads
    if (T === 'cold' && R() < 0.15) tmp.multiplyScalar(0.92);
    cols.push(tmp.r, tmp.g, tmp.b);
  }
  gg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const ground = new THREE.Mesh(gg, new THREE.MeshLambertMaterial({ vertexColors: true }));
  root.add(ground);
  if (T === 'future') { const grid = new THREE.GridHelper(HALF * 2, 28, neon[1], 0x2a7a90); grid.position.y = 0.02; grid.material.transparent = true; grid.material.opacity = 0.45; root.add(grid); }

  // --- sky
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(era.sky[0]) }, bot: { value: new THREE.Color(era.sky[1]) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y*1.6+0.1,0.0,1.0); gl_FragColor = vec4(mix(bot, top, h),1.0); }',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 16, 10), skyMat); sky.renderOrder = -1; root.add(sky);
  if (era.stars) {
    const n = era.stars, sp = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const u = R() * 2 - 1, th = R() * Math.PI * 2, r = 350, k = Math.sqrt(1 - u * u); sp[i * 3] = Math.cos(th) * k * r; sp[i * 3 + 1] = Math.abs(u) * r * (T === 'future' ? 1 : 1) + (T === 'future' ? 40 : -30); sp[i * 3 + 2] = Math.sin(th) * k * r; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    root.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: T === 'space' ? 1.6 : 1.1, sizeAttenuation: false, fog: false })));
  }
  if (era.planet) {
    const pl = new THREE.Mesh(new THREE.SphereGeometry(40, 20, 14), new THREE.MeshLambertMaterial({ color: 0x3a7ad8, emissive: 0x0a1a40, fog: false }));
    pl.position.set(-160, 120, -260); root.add(pl);
    const cl = new THREE.Mesh(new THREE.SphereGeometry(40.6, 16, 10), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, fog: false })); cl.position.copy(pl.position); cl.scale.set(1, 0.6, 1); root.add(cl);
  }
  if (T === 'modern' || T === 'ww2') {
    const sun = new THREE.Mesh(new THREE.SphereGeometry(10, 10, 8), new THREE.MeshBasicMaterial({ color: T === 'modern' ? 0xfff8e0 : 0xf0e0c0, fog: false }));
    sun.position.set(200, 160, -220); root.add(sun);
  }

  // --- lights / fog
  const hemi = new THREE.HemisphereLight(era.hemi[0], era.hemi[1], era.hemi[2]); root.add(hemi);
  const dl = new THREE.DirectionalLight(era.sun[0], era.sun[1]); dl.position.set(50, 80, -40); root.add(dl);
  scene.fog = new THREE.Fog(era.fog, era.fogNear, era.fogFar);
  scene.background = new THREE.Color(era.sky[1]);

  // --- spawn points on the outer ring
  const spawns = [];
  for (let i = 0; i < 40 && spawns.length < 18; i++) {
    const a = R() * Math.PI * 2, r = rand(30, HALF - 3);
    const x = Math.max(-HALF + 2, Math.min(HALF - 2, Math.cos(a) * r)), z = Math.max(-HALF + 2, Math.min(HALF - 2, Math.sin(a) * r));
    if (!insideAny(colliders, x, z, 1.0)) spawns.push(new THREE.Vector3(x, 0, z));
  }

  return {
    root, colliders, spawns, drawInfo: { boxes: boxes.length, glows: glows.length },
    dispose() { scene.remove(root); root.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); },
  };
}

export function insideAny(cols, x, z, r) {
  for (const c of cols) if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return true;
  return false;
}

// Push a circle (x,z,r) out of every collider that is taller than the feet can step over.
export function collide(cols, pos, r, feetY, height = 1.8) {
  for (const c of cols) {
    if (c.top <= feetY + STEP || c.minY >= feetY + height) continue;
    const cx = Math.max(c.minX, Math.min(pos.x, c.maxX)), cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    let dx = pos.x - cx, dz = pos.z - cz; const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; pos.x += dx * k; pos.z += dz * k; }
    else { // center inside the box: push along the shallowest axis
      const l = pos.x - c.minX, rr = c.maxX - pos.x, b = pos.z - c.minZ, f = c.maxZ - pos.z, m = Math.min(l, rr, b, f);
      if (m === l) pos.x = c.minX - r; else if (m === rr) pos.x = c.maxX + r; else if (m === b) pos.z = c.minZ - r; else pos.z = c.maxZ + r;
    }
  }
  pos.x = Math.max(-HALF + r, Math.min(HALF - r, pos.x)); pos.z = Math.max(-HALF + r, Math.min(HALF - r, pos.z));
}

export function groundAt(cols, x, z, r, feetY) {
  let g = 0;
  for (const c of cols) {
    if (c.top > feetY + STEP) continue;
    if (x + r * 0.7 > c.minX && x - r * 0.7 < c.maxX && z + r * 0.7 > c.minZ && z - r * 0.7 < c.maxZ) g = Math.max(g, c.top);
  }
  return g;
}

// Ray vs all collider AABBs + ground plane. Returns distance or Infinity.
export function rayWorld(cols, o, d, maxT = 300) {
  let best = maxT;
  if (d.y < -1e-6) { const t = -o.y / d.y; if (t > 0 && t < best) best = t; }
  for (const c of cols) {
    const t = rayBox(o, d, c.minX, c.minY, c.minZ, c.maxX, c.top, c.maxZ, best);
    if (t < best) best = t;
  }
  return best;
}

export function rayBox(o, d, x0, y0, z0, x1, y1, z1, maxT = Infinity) {
  let tmin = 0, tmax = maxT;
  const ax = [[o.x, d.x, x0, x1], [o.y, d.y, y0, y1], [o.z, d.z, z0, z1]];
  for (const [oo, dd, lo, hi] of ax) {
    if (Math.abs(dd) < 1e-9) { if (oo < lo || oo > hi) return Infinity; continue; }
    let t1 = (lo - oo) / dd, t2 = (hi - oo) / dd; if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return Infinity;
  }
  return tmin;
}
