// Campaign mode — Mission 8 "Dog Green" (Omaha Beach, 6 June 1944), played as Cpl. Walter Hale (fictional).
// Builds its own beach map and runs a scripted mission on top of the shared FPS systems in main.js
// (player, weapons, grenades, enemies, FX, audio). All of the Hale squad is fictional; the landing is not.
import * as THREE from 'three';
import { collide, groundAt, rayWorld } from './world.js';
import { Enemy } from './enemies.js';
import { ERAS } from './eras.js';
import { Vehicle } from './vehicles.js';
import * as A from './audio.js';

export const MISSIONS = [
  { id: 'dog-green', n: 8, name: 'Dog Green', place: 'Omaha Beach, Normandy', date: '6 June 1944', pov: 'Cpl. Walter Hale', playable: true },
  { n: 2, name: 'Point Luck', place: 'Midway', date: 'June 1942' },
  { n: 3, name: "Devil's Gardens", place: 'El Alamein', date: 'Oct 1942' },
  { n: 4, name: 'Steel Winter', place: 'Stalingrad', date: 'Winter 1942–43' },
  { n: 9, name: 'Suribachi', place: 'Iwo Jima', date: 'Feb 1945' },
  { n: 12, name: 'Tidal Wall', place: 'Inchon', date: 'Sept 1950' },
  { n: 15, name: 'Ia Drang', place: 'Vietnam', date: 'Nov 1965' },
  { n: 21, name: 'Left Hook', place: '73 Easting', date: 'Feb 1991' },
  { n: 27, name: 'Phantom Fury', place: 'Fallujah', date: 'Nov 2004' },
];

export const CAMP_ERA = {
  ...ERAS.ww2, name: 'Omaha Beach', tag: 'D-Day', year: '1944',
  sky: [0x7c858b, 0xb9bfc1], fog: 0xa7aeb0, fogNear: 22, fogFar: 230,
  hemi: [0xdde1e4, 0x6a6656, 1.25], sun: [0xf0eee6, 0.7], enemyName: 'Defender', enemyDmg: 8,
};

const PLAT = 7.2;                 // plateau height above the beach
const NEST_FRONT = 2;             // MG nests only see things in front (+z) of them
const SPEAKERS = { rourke: 'Sgt. Rourke', alvarez: 'Pvt. Alvarez', kowalski: 'Pvt. Kowalski', brooks: 'Pvt. Brooks', cox: 'Coxswain', hale: 'Cpl. Hale', navy: 'Destroyer (radio)', beach: 'Beachmaster (radio)', ranger: 'Rangers (relayed)', hq: 'Radio' };

// ---------------------------------------------------------------- map
class Boxes {
  constructor() { this.list = []; }
  add(x, y, z, w, h, d, color, rx = 0, ry = 0, rz = 0) { this.list.push({ x, y, z, w, h, d, color, rx, ry, rz }); }
  build(root) {
    const n = this.list.length; const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    this.list.forEach((b, i) => { e.set(b.rx, b.ry, b.rz); q.setFromEuler(e); m.compose(new THREE.Vector3(b.x, b.y, b.z), q, new THREE.Vector3(b.w, b.h, b.d)); mesh.setMatrixAt(i, m); mesh.setColorAt(i, c.setHex(b.color)); });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    root.add(mesh); return mesh;
  }
}
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const L = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });

function buildBunker(root, x, y, z, w, h, d, big = false) {
  const g = new THREE.Group(); g.position.set(x, y, z); root.add(g);
  const mat = L(big ? 0x8a8780 : 0x908d84), dark = new THREE.MeshBasicMaterial({ color: 0x0c0c0c });
  const bx = (m, W, H, D, X, Y, Z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), m); o.position.set(X, Y, Z); g.add(o); return o; };
  bx(mat, w, h * 0.55, d, 0, h * 0.275, 0);                          // lower walls
  bx(mat, w * 0.3, h * 0.2, d, -w * 0.35, h * 0.65, 0); bx(mat, w * 0.3, h * 0.2, d, w * 0.35, h * 0.65, 0);
  bx(mat, w + 0.6, h * 0.26, d + 0.6, 0, h * 0.87, 0);              // roof slab
  bx(dark, w * 0.42, h * 0.16, 0.05, 0, h * 0.65, d / 2 + 0.01);     // embrasure slit
  if (big) { bx(dark, w * 0.18, h * 0.14, 0.05, -w * 0.33, h * 0.4, d / 2 + 0.01); bx(dark, w * 0.18, h * 0.14, 0.05, w * 0.33, h * 0.4, d / 2 + 0.01); }
  bx(dark, 1.0, 1.7, 0.05, 0, 0.85, -d / 2 - 0.01);                  // rear door
  return { group: g, mat };
}

function buildLCVP(root, x, z) {
  const g = new THREE.Group(); g.position.set(x, 0.25, z); root.add(g);
  const hull = L(0x76836f), deck = L(0x5e6650), ramp = L(0x6f7a66);
  const bx = (p, m, W, H, D, X, Y, Z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), m); o.position.set(X, Y, Z); p.add(o); return o; };
  bx(g, deck, 3.2, 0.35, 10.2, 0, 0.18, 0);
  bx(g, hull, 0.22, 1.9, 10.2, -1.7, 0.95, 0); bx(g, hull, 0.22, 1.9, 10.2, 1.7, 0.95, 0);
  bx(g, hull, 3.6, 2.1, 0.5, 0, 1.05, 5.1); bx(g, hull, 1.1, 0.8, 0.9, 0.9, 2.4, 4.6);   // stern + coxswain station
  bx(g, hull, 3.6, 0.5, 10.6, 0, -0.1, 0.1);
  const piv = new THREE.Group(); piv.position.set(0, 0.35, -5.15); g.add(piv);
  bx(piv, ramp, 3.1, 1.4, 0.2, 0, 0.7, 0); bx(piv, deck, 2.6, 0.12, 0.26, 0, 1.36, 0.05);
  return { group: g, ramp: piv };
}

export function buildBeach(scene) {
  const root = new THREE.Group(); scene.add(root);
  const R = rng(1944);
  const B = new Boxes(), colliders = [];
  const col = (x0, x1, z0, z1, y0, y1) => { const c = { minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1), minY: y0, top: y1 }; colliders.push(c); return c; };
  const solid = (x, z, w, h, d, color, y = 0, collide = true) => { B.add(x, y + h / 2, z, w, h, d, color); if (collide) col(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y, y + h); };
  const EARTH = 0x6f6648, GRASS = 0x5b6b3a, CONC = 0x8d8a82, BAG = 0x8a7b5a, STEEL = 0x3b3833, WOOD = 0x5b4a36;

  // --- sand
  const gg = new THREE.PlaneGeometry(260, 420, 26, 84); gg.rotateX(-Math.PI / 2); gg.translate(0, 0, 70);
  const cols = [], tc = new THREE.Color(), pa = gg.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    const z = pa.getZ(i);
    if (z > 18) tc.setHex(0x8b7f62); else if (z < -30) tc.setHex(0x8a875e); else tc.setHex(0xb3a37d);
    tc.multiplyScalar(0.94 + R() * 0.1); cols.push(tc.r, tc.g, tc.b);
    if (z > 60) pa.setY(i, -(z - 60) * 0.04);
  }
  gg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  root.add(new THREE.Mesh(gg, L(0xffffff, { vertexColors: true })));

  // --- sea (low-poly animated plane)
  const sg = new THREE.PlaneGeometry(700, 520, 34, 24); sg.rotateX(-Math.PI / 2); sg.translate(0, 0, 260);
  const sea = new THREE.Mesh(sg, L(0x54646b, { flatShading: true, side: THREE.DoubleSide })); sea.position.y = 0.45; sea.position.z = 30; root.add(sea);
  const seaBase = Float32Array.from(sg.attributes.position.array);
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(700, 1.6), new THREE.MeshBasicMaterial({ color: 0xdfe3e0, transparent: true, opacity: 0.55, depthWrite: false }));
  foam.rotation.x = -Math.PI / 2; foam.position.set(0, 0.5, 30.3); root.add(foam);

  // --- sky
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(CAMP_ERA.sky[0]) }, bot: { value: new THREE.Color(CAMP_ERA.sky[1]) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y*1.4+0.1,0.0,1.0); gl_FragColor = vec4(mix(bot, top, h),1.0); }',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(480, 16, 10), skyMat); sky.renderOrder = -1; root.add(sky);
  root.add(new THREE.HemisphereLight(CAMP_ERA.hemi[0], CAMP_ERA.hemi[1], CAMP_ERA.hemi[2]));
  const dl = new THREE.DirectionalLight(CAMP_ERA.sun[0], CAMP_ERA.sun[1]); dl.position.set(-40, 80, 60); root.add(dl);
  scene.fog = new THREE.Fog(CAMP_ERA.fog, CAMP_ERA.fogNear, CAMP_ERA.fogFar);
  scene.background = new THREE.Color(CAMP_ERA.sky[1]);

  // --- beach obstacles: Czech hedgehogs, Belgian gates, log ramps
  const hedgehogs = [];
  const hedgehog = (x, z, solidOne = true) => {
    for (let k = 0; k < 3; k++) B.add(x, 0.72, z, 2.1, 0.17, 0.17, STEEL, 0, k * 2.094, 0.72);
    if (solidOne) { col(x - 0.6, x + 0.6, z - 0.6, z + 0.6, 0, 1.25); hedgehogs.push(new THREE.Vector3(x, 0, z)); }
  };
  const gate = (x, z) => {
    for (const s of [-1.4, 1.4]) B.add(x + s, 1.3, z, 0.16, 2.6, 0.16, STEEL);
    B.add(x, 2.5, z, 3.0, 0.16, 0.16, STEEL); B.add(x, 1.2, z, 3.0, 0.14, 0.14, STEEL);
    B.add(x - 0.7, 1.3, z, 0.12, 2.9, 0.12, STEEL, 0, 0, 0.5); B.add(x + 0.7, 1.3, z, 0.12, 2.9, 0.12, STEEL, 0, 0, -0.5);
    B.add(x, 0.9, z + 1.0, 0.12, 0.12, 2.4, STEEL, 0.7, 0, 0);
    col(x - 1.5, x + 1.5, z - 0.25, z + 0.25, 0, 2.6); hedgehogs.push(new THREE.Vector3(x, 0, z));
  };
  const logRamp = (x, z) => { B.add(x, 1.0, z, 0.3, 0.3, 4.4, WOOD, -0.45, 0, 0); B.add(x, 0.7, z + 1.4, 0.24, 1.4, 0.24, WOOD); B.add(x, 2.0, z + 2.0, 0.42, 0.12, 0.42, 0x4a4a3a); col(x - 0.2, x + 0.2, z + 1.25, z + 1.55, 0, 1.4); };
  for (const [z, kind] of [[26, 'gate'], [21, 'log'], [15, 'hog'], [8, 'hog'], [1, 'mix'], [-6, 'hog'], [-13, 'hog'], [-19, 'mix']]) {
    for (let x = -60; x <= 60; x += 6.5) {
      const xx = x + (R() - 0.5) * 3.2, zz = z + (R() - 0.5) * 3, inside = Math.abs(xx) < 39;
      if (Math.abs(xx + 4) < 2.6 && z > 20) continue; // keep the ramp exit clear
      if (kind === 'gate') { if (R() < 0.75) inside ? gate(xx, zz) : null; }
      else if (kind === 'log') { if (R() < 0.8) logRamp(xx, zz); }
      else if (kind === 'mix' && R() < 0.35) inside ? gate(xx, zz) : hedgehog(xx, zz, false);
      else if (R() < 0.8) hedgehog(xx, zz, inside);
    }
  }
  // craters + wreckage (decor)
  for (let i = 0; i < 22; i++) B.add((R() - 0.5) * 90, 0.02, -24 + R() * 50, 2 + R() * 2.5, 0.04, 2 + R() * 2.5, 0x5e5643, 0, R() * 3, 0);
  for (const [x, z, ry] of [[-26, 31, 0.3], [21, 33, -0.4]]) { B.add(x, 0.6, z, 3.4, 1.4, 9, 0x4a5246, 0, ry, 0.25); B.add(x, 1.5, z, 3, 0.4, 8, 0x3a3f36, 0, ry, 0.25); }

  // --- shingle bank (low ridge) with a stepped section at the breach point
  const SH = 0x77736a;
  solid(-22.25, -26, 36.5, 1.4, 4, SH); solid(22.25, -26, 36.5, 1.4, 4, SH);
  solid(-61, -26, 42, 1.4, 4, SH, 0, false); solid(61, -26, 42, 1.4, 4, SH, 0, false);
  solid(0, -24.6, 8, 0.45, 1.2, SH); solid(0, -25.8, 8, 0.9, 1.2, SH); solid(0, -27.1, 8, 1.35, 1.4, SH);
  for (let i = 0; i < 70; i++) { const x = -40 + R() * 80; if (Math.abs(x) > 4.5) B.add(x, 1.42, -24.4 - R() * 3.2, 0.25 + R() * 0.3, 0.12, 0.2 + R() * 0.3, 0x8a867c, R() * 0.4, R() * 3, R() * 0.4); }
  // --- wire (coils), breach gap in a separate mesh
  const coilG = new THREE.TorusGeometry(0.5, 0.025, 3, 9);
  const coilM = L(0x4d4842);
  const mkCoils = (xs) => { const im = new THREE.InstancedMesh(coilG, coilM, xs.length * 2); const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0.2)); let i = 0; for (const x of xs) for (const yy of [0.5, 1.25]) { m.compose(new THREE.Vector3(x, yy, -29.6 + (yy > 1 ? 0.15 : 0)), q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(i++, m); } root.add(im); return im; };
  const xsMain = [], xsGap = [];
  for (let x = -70; x <= 70; x += 0.55) (Math.abs(x) < 3.2 ? xsGap : xsMain).push(x);
  mkCoils(xsMain); const gapMesh = mkCoils(xsGap);
  for (let x = -60; x <= 60; x += 3) B.add(x, 0.7, -29.6, 0.08, 1.4, 0.08, WOOD);
  col(-45, -3, -30.1, -29.1, 0, 4).noRay = true; col(3, 45, -30.1, -29.1, 0, 4).noRay = true;
  const gapCol = col(-3, 3, -30.1, -29.1, 0, 4); gapCol.noRay = true;

  // --- bluff: terraced cliffs either side of a stepped draw
  const terr = [[-45, -55, 2.4], [-55, -65, 4.8], [-65, -74, PLAT]];
  for (const s of [-1, 1]) for (const [z0, z1, h] of terr) {
    const cx = s * 26, w = 40, cz = (z0 + z1) / 2, d = Math.abs(z1 - z0);
    solid(cx, cz, w, h, d, EARTH); B.add(cx, h + 0.05, cz, w, 0.12, d, GRASS);
    B.add(s * 70, h / 2, cz, 48, h, d, EARTH); B.add(s * 70, h + 0.05, cz, 48, 0.12, d, GRASS);
  }
  const NST = 16, top0 = -45, top1 = -74, sd = (top0 - top1) / NST;
  for (let i = 0; i < NST; i++) { const h = (i + 1) * (PLAT / NST), z = top0 - sd * (i + 0.5); solid(0, z, 12.2, h, sd + 0.02, i % 2 ? 0x77704f : 0x7d7552); }
  // plateau
  solid(0, -107, 84, PLAT, 66, EARTH); B.add(0, PLAT + 0.05, -107, 84, 0.12, 66, GRASS);
  B.add(-90, PLAT / 2, -107, 100, PLAT, 66, EARTH); B.add(90, PLAT / 2, -107, 100, PLAT, 66, EARTH);
  B.add(0, PLAT + 0.05, -107, 260, 0.1, 66, GRASS);
  solid(0, -140.5, 84, PLAT + 3, 1, 0x5d5a40); // far hedgerow line
  for (let x = -40; x <= 40; x += 4) B.add(x + R(), PLAT + 1.6 + R(), -139, 3.5, 3 + R() * 2, 3, 0x3f4a2c);
  // bluff-top scrub
  for (let i = 0; i < 26; i++) { const x = (R() < 0.5 ? -1 : 1) * (9 + R() * 60), z = -66 - R() * 7; B.add(x, PLAT + 0.4, z, 1 + R() * 1.5, 0.8 + R(), 1 + R(), 0x4a5632); }

  // --- trench line on the plateau (sandbags) + tobruk pits
  const trench = [[-20, -12], [-9, -1], [2, 10], [13, 21]];
  for (const [a, b] of trench) solid((a + b) / 2, -90, b - a, 1.1, 1.2, BAG, PLAT);
  for (const [a, b] of [[-15, -6], [6, 15]]) solid((a + b) / 2, -84, b - a, 0.9, 1.0, BAG, PLAT);
  solid(-17, -96, 3, 1.0, 3, CONC, PLAT); solid(18, -97, 3, 1.0, 3, CONC, PLAT);
  for (const z of [-104, -110]) solid(-6 + (z % 3), z, 7, 1.0, 1.0, BAG, PLAT);

  const insts = B.build(root);

  // --- bunkers (separate meshes so they can be destroyed)
  const nestA = buildBunker(root, -11, PLAT, -69.5, 5, 2.6, 4); col(-13.5, -8.5, -71.5, -67.5, PLAT, PLAT + 2.6);
  const nestB = buildBunker(root, 13, PLAT, -68.5, 5, 2.6, 4); col(10.5, 15.5, -70.5, -66.5, PLAT, PLAT + 2.6);
  const strong = buildBunker(root, 6, PLAT, -122, 12, 4.5, 8, true); col(0, 12, -126, -118, PLAT, PLAT + 4.5);

  // --- offshore: destroyer + decor landing craft
  const ship = new THREE.Group(); ship.position.set(-55, 0, 190); root.add(ship);
  const gm = L(0x6d757a), dm = L(0x50575b);
  const sbx = (m, W, H, D, X, Y, Z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), m); o.position.set(X, Y, Z); ship.add(o); return o; };
  sbx(gm, 104, 3.4, 10, 0, 1.5, 0); sbx(gm, 30, 0.8, 7, 46, 2.6, 0); sbx(dm, 14, 4, 6, 18, 5, 0); sbx(dm, 6, 5, 4, 20, 9, 0);
  sbx(dm, 2.2, 6, 2.2, 4, 7, 0); sbx(dm, 2.2, 6, 2.2, -6, 7, 0);
  const guns = [];
  for (const gx of [34, 26, -22, -32]) { sbx(dm, 3.6, 1.6, 3.6, gx, 4, 0); const b = sbx(dm, 4, 0.3, 0.3, gx + (gx > 0 ? 3 : -3), 4.2, 0); guns.push(new THREE.Vector3(ship.position.x + gx + (gx > 0 ? 5 : -5), 4.2, ship.position.z)); }
  const decorBoats = [buildLCVP(root, -24, 156), buildLCVP(root, 15, 162), buildLCVP(root, 30, 147)];
  const boat = buildLCVP(root, -4, 150);
  // wrecked Sherman hull (decor) handled by main via Vehicle class

  return {
    root, colliders, spawns: [], hedgehogs, gapCol, gapMesh, sea, seaBase, foam, nestA, nestB, strong, ship, guns, boat, decorBoats,
    drawInfo: { boxes: B.list.length },
    dispose() { scene.remove(root); root.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); },
  };
}

// ---------------------------------------------------------------- squadmates
const ALLY_ERA = { enemy: { body: 0x6b6844, legs: 0x5b5a40, head: 0x4f5535, skin: 0xc9a07e, accent: 0x3a3828 }, theme: 'cold', tracer: 0xffe0a0 };
class Ally {
  constructor(scene, id, slot) {
    this.e = new Enemy(scene, ALLY_ERA); this.id = id; this.name = SPEAKERS[id]; this.slot = slot;
    const g = this.e.group; g.visible = true; this.pos = g.position; this.e.alive = true;
    if (id === 'kowalski') { const pack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.22), L(0x4a4a34)); pack.position.set(0, 1.2, -0.26); g.add(pack); const ant = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.1, 0.02), L(0x222222)); ant.position.set(0.12, 1.9, -0.3); g.add(ant); }
    if (id === 'rourke') { const st = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.02), L(0xd0b040)); st.position.set(0.26, 1.3, 0.05); g.add(st); }
    this.target = new THREE.Vector3(); this.walk = 0; this.shootT = 1 + Math.random() * 2; this.face = 0; this.crouch = false; this.stuckT = 0;
  }
}

// ---------------------------------------------------------------- mission
export class Campaign {
  constructor(api) {
    this.api = api; const { scene } = api;
    this.w = buildBeach(scene);
    api.G.world = this.w;
    this.allies = [['rourke', -3], ['alvarez', 3], ['kowalski', -7], ['brooks', 7]].map(([id, s]) => new Ally(scene, id, s));
    // splash columns
    this.splashes = [];
    const cg = new THREE.CylinderGeometry(0.5, 1.3, 1, 7, 1, true); cg.translate(0, 0.5, 0);
    for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(cg, new THREE.MeshLambertMaterial({ color: 0xe6ebec, transparent: true, opacity: 0.8, depthWrite: false })); m.visible = false; this.w.root.add(m); this.splashes.push({ m, t: 0 }); }
    this.nests = [
      { id: 'A', name: 'MG bunker', muzzle: new THREE.Vector3(-11, PLAT + 1.7, -67.3), center: new THREE.Vector3(-11, PLAT + 1.3, -69.5), front: -67.5, mesh: this.w.nestA, alive: true, burst: 0, pause: 1, fireT: 0, suppress: 0, aimP: false, aim: new THREE.Vector3(), sway: new THREE.Vector3() },
      { id: 'B', name: 'MG bunker', muzzle: new THREE.Vector3(13, PLAT + 1.7, -66.3), center: new THREE.Vector3(13, PLAT + 1.3, -68.5), front: -66.5, mesh: this.w.nestB, alive: true, burst: 0, pause: 2, fireT: 0, suppress: 0, aimP: false, aim: new THREE.Vector3(), sway: new THREE.Vector3() },
      { id: 'C', name: 'strongpoint', muzzle: new THREE.Vector3(6, PLAT + 2.9, -117.8), center: new THREE.Vector3(6, PLAT + 2, -122), front: -118, mesh: this.w.strong, alive: true, burst: 0, pause: 3, fireT: 0, suppress: 0, aimP: false, aim: new THREE.Vector3(), sway: new THREE.Vector3(), weak: true },
    ];
    // M4 Sherman landed with the first waves, firing on the bluff (decor + atmosphere)
    this.tank = new Vehicle(scene, CAMP_ERA, new THREE.Vector3(19, 0, 12));
    this.tank.yaw = 0; this.tank.group.rotation.y = 0; this.tank.turret.rotation.y = -0.12; this.tank.gun.rotation.x = 0.16; this.tankT = 6;
    this.w.colliders.push({ minX: 17.4, maxX: 20.6, minZ: 9, maxZ: 15, minY: 0, top: 2.3 });
    this.smokers = [];
    this.timeline = [];
    this.shells = [];
    this.groups = { bluff: [], draw: [], trench: [], strong: [] };
    this.$ = (id) => document.getElementById(id);
  }

  // ---------- lifecycle
  start() {
    const { G, player } = this.api;
    this.t = 0; this.phase = ''; this.pt = 0; this.deaths = 0; this.inBoat = true; this.rampDown = false; this.rampK = 0;
    this.boatZ = 150; this.dunkT = 0; this.dunked = false; this.shore = 30; this.landT = -1; this.graceT = 0;
    this.use = null; this.placing = 0; this.fuse = 0; this.satchel = 0; this.done = false; this.deadT = 0; this.ambT = 2;
    this.checkpoint = { x: -4, y: 0, z: 33, yaw: 0 };
    G.wave = 1;
    Object.assign(player, { yaw: 0, pitch: -0.05 });
    this.go('boat');
    A.ambience(true);
  }
  dispose() { A.ambience(false); A.engine(false); A.setMuffled(false); this.tank.dispose(); this.w.dispose(); for (const a of this.allies) a.e.dispose(this.api.scene); this.setUnderwater(0); }

  // timeline entries belong to the phase that queued them; switching phase drops the rest unless keep
  say(who, text, delay = 0, dur = 0, keep = false) { this.timeline.push({ at: this.t + delay, fn: () => this.sub(who, text, dur), ph: this.phase, keep }); }
  later(delay, fn, keep = true) { this.timeline.push({ at: this.t + delay, fn, ph: this.phase, keep }); }
  sub(who, text, dur) {
    const el = this.$('subs'); const radio = who === 'navy' || who === 'beach' || who === 'ranger' || who === 'hq';
    el.innerHTML = `<b class="${radio ? 'radio' : ''}">${radio ? '📻 ' : ''}${SPEAKERS[who] || who}:</b> ${text}`; el.classList.add('on');
    if (radio) A.playRadio();
    clearTimeout(this._subT); this._subT = setTimeout(() => el.classList.remove('on'), (dur || Math.max(2.6, text.length * 0.065)) * 1000);
    this.subLog = (this.subLog || []).concat(`${SPEAKERS[who] || who}: ${text}`);
  }
  objective(text, marker = null, label = '') {
    this.obj = text; this.marker = marker; this.markerLabel = label;
    const el = this.$('objective'); el.innerHTML = `<i>OBJECTIVE</i> ${text}`; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    A.playHorn(true);
  }
  setCheckpoint(x, y, z, quiet) { this.checkpoint = { x, y, z, yaw: 0 }; if (!quiet) this.api.feed('<b>✔ Checkpoint</b> reached'); }

  go(ph) {
    this.timeline = this.timeline.filter(t => t.keep);
    this.phase = ph; this.pt = 0; const { G, player } = this.api; const w = this.w;
    if (ph === 'boat') {
      this.objective('Survive the run-in and the ramp drop');
      this.say('cox', 'Two minutes! Keep your heads down!', 0.6);
      this.say('rourke', "Listen up! When that ramp drops, you move. Obstacle to obstacle — don't bunch up.", 4);
      this.say('rourke', "Hale, you've got the Bangalore. Get it to the wire and we're off this beach.", 9);
      this.say('brooks', 'Look at that bluff…', 13.5);
      this.say('cox', 'Thirty seconds!', 16.5);
      A.engine(true, 0.7, false);
    } else if (ph === 'beach') {
      this.setCheckpoint(-4, 0, 33, true);
      this.objective('Move from obstacle to obstacle to the shingle bank', new THREE.Vector3(0, 1.6, -23.5), 'SHINGLE');
      this.say('rourke', 'Get to the hedgehogs! Keep moving up!', 0.4);
      this.say('alvarez', 'MG on the bluff — stay low!', 6);
      this.later(3, () => this.api.feed(this.api.isTouch ? 'Tip: <b>▼</b> crouch behind cover · <b>☁</b> smoke blinds MGs' : 'Tip: <b>C</b> crouches behind obstacles · smoke <b>T</b> blocks MG sight'));
      this.spawnGroup('bluff', [[-24, -66.5], [25, -66.5], [-3, -77]], PLAT, { range: 95, accMul: 0.35 });
      this.cp2 = false;
    } else if (ph === 'bangalore') {
      this.setCheckpoint(0, 0, -21.5);
      this.objective('Blow the wire with the Bangalore torpedo', new THREE.Vector3(0, 1.8, -28.4), 'WIRE');
      this.say('rourke', "Wire's too thick! Hale — Bangalore, now!", 0.3);
    } else if (ph === 'draw') {
      this.setCheckpoint(0, 0, -33);
      this.objective('Open the path up the bluff — climb the draw', new THREE.Vector3(0, PLAT + 1.4, -74), 'DRAW');
      this.spawnGroup('draw', [[-4, -79], [5, -80], [1, -84]], PLAT, { range: 60, accMul: 0.75 });
      this.say('alvarez', 'Riflemen up top!', 4);
      this.say('brooks', "That MG's raking the draw — keep moving!", 9);
    } else if (ph === 'bunker') {
      this.objective('Destroy the MG bunker — grenade through the slit, or satchel on the door', new THREE.Vector3(-11, PLAT + 1.2, -72.6), 'BUNKER');
      this.say('rourke', "We're behind that bunker. Frag through the slit, or put a satchel on the door!", 0.5);
    } else if (ph === 'trench') {
      this.setCheckpoint(-2, PLAT, -76);
      this.spawnGroup('trench', [[-16, -91.6], [-6, -91.8], [-1, -92], [6, -91.7], [11, -91.6], [17, -91.8]], PLAT, { range: 55, accMul: 0.9 });
      this.spawnGroup('strong', [[-1, -116], [13, -116.5]], PLAT, { range: 55, accMul: 0.6 });
      this.objective('Clear the trench line', null, '');
      this.say('rourke', "Bunker's out! Trench line ahead — clear it!", 0.6);
    } else if (ph === 'radio') {
      this.setCheckpoint(-3, PLAT, -88);
      const k = this.ally('kowalski'); k.target.set(-2.5, PLAT, -88.6);
      this.objective('Call destroyer fire on the strongpoint — reach Kowalski’s radio', null, 'RADIO');
      this.say('rourke', "Trench is clear. That strongpoint's still pinning the beach. Kowalski — get the Navy!", 0.5);
      this.say('kowalski', "Hale, over here — I've got the destroyer's net!", 5);
    } else if (ph === 'barrage') {
      this.objective('Destroyer fire inbound — stay down', null, '');
      this.say('hale', 'Navy, this is Dog Green. Fire mission: concrete strongpoint at the head of the draw. Over.', 0.2, 4);
      this.say('navy', 'Dog Green, we are closing the beach. Shot, over.', 4.6, 3);
      this.say('hale', 'Shot, out. Everybody down!', 7.4, 2.4);
      const sp = new THREE.Vector3(6, PLAT + 2, -122);
      const salvo = (d, p, last) => this.later(d, () => this.fireShip(p, last));
      salvo(6, new THREE.Vector3(13, PLAT + 1.5, -68.5));
      salvo(8, sp.clone().add(new THREE.Vector3(-7, 0, 5)));
      salvo(9.4, sp.clone().add(new THREE.Vector3(3, 1, -2)));
      salvo(10.6, sp.clone().add(new THREE.Vector3(-2, 0.5, 1)));
      salvo(11.8, sp.clone(), true);
    } else if (ph === 'relay') {
      this.objective('Relay word from the Rangers at Pointe du Hoc', null, '');
      this.say('navy', 'Rounds complete. Good luck up there, Dog Green.', 0.3, 3);
      this.say('rourke', 'That tin can came in so close she nearly scraped the sand.', 3.6, 3.2);
      this.say('kowalski', 'Rangers on the net — Pointe du Hoc. They took the cliff. The big guns had been moved inland; they found them and knocked them out.', 7.2, 6);
      this.say('kowalski', "They're holding, but they need help.", 13.4, 2.6);
      this.say('rourke', 'Hale — pass it to the beachmaster.', 16.2, 2.4);
      this.say('hale', 'Beachmaster, Dog Green. Draw is open, strongpoint destroyed. Rangers at Pointe du Hoc holding, guns destroyed, request reinforcement. Over.', 18.8, 5.5);
      this.say('beach', 'Copy all, Dog Green. Next waves coming through your draw. Well done.', 24.6, 3.6);
      this.later(29, () => this.complete());
    }
  }

  ally(id) { return this.allies.find(a => a.id === id); }
  spawnGroup(name, pts, y, o) {
    const { G } = this.api;
    for (const [x, z] of pts) {
      const e = this.api.spawnEnemy(new THREE.Vector3(x, 0, z));
      e.pos.y = y; e.hold = true; e.range = o.range; e.accMul = o.accMul; e.shootT = 2 + Math.random() * 2; e.group.rotation.y = 0;
      this.groups[name].push(e);
    }
  }
  aliveIn(name) { return this.groups[name].filter(e => e.alive).length; }

  // ---------- per-frame
  update(dt) {
    const { G, player, camera, fx } = this.api;
    this.t += dt; this.pt += dt;
    for (let i = this.timeline.length - 1; i >= 0; i--) if (this.timeline[i].at <= this.t) { const f = this.timeline[i].fn; this.timeline.splice(i, 1); f(); }
    this.updateSea(dt);
    this.updateBoat(dt);
    this.updateNests(dt);
    this.updateAllies(dt);
    this.updateShells(dt);
    this.updateFx(dt);
    // respawn timer
    if (this.deadT > 0) { this.deadT -= dt; if (this.deadT <= 0) this.respawn(); }
    const P = player.pos;
    switch (this.phase) {
      case 'beach':
        if (!this.cp2 && P.z < 5) { this.cp2 = true; this.setCheckpoint(P.x, 0, Math.max(P.z, -2)); this.say('rourke', 'Good, Hale! Next row — keep going for the shingle!'); }
        if (P.z < -21 && player.alive) this.go('bangalore');
        break;
      case 'bangalore': this.updateBangalore(dt); break;
      case 'draw': if (P.y > PLAT - 0.6 && P.z < -71) this.go('bunker'); break;
      case 'bunker': this.updateSatchel(dt); if (!this.nests[0].alive && this.pt > 0.5 && !this._bk) { this._bk = true; this.later(2.2, () => this.go('trench')); } break;
      case 'trench': {
        const n = this.aliveIn('trench');
        const el = this.$('objective'); if (el && this.obj === 'Clear the trench line') el.innerHTML = `<i>OBJECTIVE</i> Clear the trench line <em>${n} left</em>`;
        let best = null, bd = 1e9; for (const e of this.groups.trench) if (e.alive) { const d = e.pos.distanceTo(P); if (d < bd) { bd = d; best = e; } }
        this.marker = best ? best.pos.clone().add(new THREE.Vector3(0, 2.1, 0)) : null; this.markerLabel = 'ENEMY';
        if (n === 0 && !this._tr) { this._tr = true; this.later(1.2, () => this.go('radio')); }
        break;
      }
      case 'radio': { const k = this.ally('kowalski'); this.marker = k.pos.clone().add(new THREE.Vector3(0, 2.2, 0)); break; }
    }
    // a frag that reaches the bunker drops in through the slit / doorway instead of bouncing away
    const nA = this.nests[0];
    if (nA.alive && (this.phase === 'bunker' || this.phase === 'draw')) for (const n of G.grenades.list) {
      if (n.kind !== 'lethal' || n.stuck) continue; const q = n.pos;
      if (q.x > -14.1 && q.x < -7.9 && q.z > -72.2 && q.z < -66.8 && q.y > PLAT && q.y < PLAT + 3.3) { n.stuck = 'world'; n.vel.set(0, 0, 0); q.y = PLAT + 0.9; if (!this._inTip) { this._inTip = true; this.say('rourke', "It's in! Get down!", 0, 1.6); } }
    }
    // contextual USE
    this.use = this.findUse();
    this.updateMarker();
  }

  // ---------- boat run-in and ramp drop
  updateBoat(dt) {
    const { player, fx, G } = this.api; const b = this.w.boat;
    const stopZ = 42;
    if (this.boatZ > stopZ) {
      this.boatZ = Math.max(stopZ, this.boatZ - dt * 5.6);
      if (this.phase === 'boat') {
        // incoming fire: splashes and rounds pinging off the ramp
        this._spT = (this._spT || 0) - dt;
        if (this._spT <= 0) { this._spT = 1.1 + Math.random() * 1.6; this.splash(new THREE.Vector3(-4 + (Math.random() - 0.5) * 40, 0.4, this.boatZ - 8 - Math.random() * 30)); }
        if (this.boatZ < 110 && Math.random() < dt * 5) { A.playRicochet(); fx.burst(new THREE.Vector3(-4 + (Math.random() - 0.5) * 2.4, 2 + Math.random() * 0.4, this.boatZ - 5.3), 0xffe0a0, 4, 3, 0.15); }
      }
      if (this.boatZ <= stopZ && !this.rampDown) {
        A.engine(false); this.rampDown = true; A.playClunk();
        this.say('cox', 'Ramp going down!', 0, 1.6); this.say('rourke', 'GO, GO, GO!', 1.0, 2);
        this.landT = this.t;
      }
    }
    const bob = this.rampDown ? Math.sin(this.t * 1.4) * 0.04 : Math.sin(this.t * 1.7) * 0.16;
    b.group.position.set(-4, 0.25 + bob, this.boatZ); b.group.rotation.x = this.rampDown ? 0 : Math.sin(this.t * 1.3) * 0.035; b.group.rotation.z = this.rampDown ? 0 : Math.sin(this.t * 0.9) * 0.025;
    if (this.rampDown && this.rampK < 1) { this.rampK = Math.min(1, this.rampK + dt * 1.4); b.ramp.rotation.x = -this.rampK * this.rampK * 1.38; if (this.rampK >= 1) { this.splash(new THREE.Vector3(-4, 0.4, this.boatZ - 7)); A.playSplosh(); } }
    this.w.decorBoats.forEach((d, i) => {
      const z = Math.max(41 + i * 3, this.boatZ + [6, 12, -3][i]);
      d.group.position.set(d.group.position.x, 0.25 + Math.sin(this.t * 1.6 + i) * 0.15, z);
      if (z <= 41 + i * 3 + 0.01 && d.ramp.rotation.x > -1.38) d.ramp.rotation.x = Math.max(-1.38, d.ramp.rotation.x - dt * 1.6);
    });
    // allies ride in the boat
    if (this.inBoat || this.phase === 'boat') for (const a of this.allies) if (!a.left) { a.pos.set(-4 + (a.slot > 0 ? 0.8 : -0.8), b.group.position.y + 0.35, this.boatZ - 2.4 + Math.abs(a.slot) * 0.5); a.e.group.rotation.y = Math.PI; }
    if (this.rampDown && this.rampK >= 1) {
      for (const [i, a] of this.allies.entries()) if (!a.left && this.t - this.landT > 1.4 + i * 0.5) { a.left = true; a.pos.y = 0; a.pos.z = this.boatZ - 6.5; a.target.set(-4 + a.slot * 1.6, 0, 26); }
    }
    // underwater moment after leaving the ramp
    if (this.dunkT > 0) {
      this.dunkT -= dt;
      if (this.dunkT <= 0) { A.setMuffled(false); this.setUnderwater(0); A.playSplash(2); this.api.shake(0.25); for (let i = 0; i < 4; i++) A.playCrack(); this.go('beach'); }
    }
  }
  constrainPlayer() {
    const { player } = this.api;
    if (!this.inBoat) {
      if (this.dunkT <= 0) player.eyeOff = 0;
      if (this.dunkT > 0) { player.eyeOff = -1.35 * Math.sin(Math.min(1, (1.7 - this.dunkT) / 0.35) * Math.PI / 2) * Math.min(1, this.dunkT / 0.3); }
      return;
    }
    const b = this.w.boat.group.position;
    let lx = player.pos.x - b.x, lz = player.pos.z - b.z;
    lx = Math.max(-1.25, Math.min(1.25, lx));
    if (!this.rampDown || this.rampK < 1) lz = Math.max(-4.6, Math.min(4.4, lz));
    else lz = Math.min(4.4, lz);
    const deck = b.y + 0.35;
    if (lz < -5.1) { // stepped off the ramp
      const k = Math.min(1, (-5.1 - lz) / 2.0); player.pos.set(b.x + lx, deck * (1 - k), b.z + lz);
      if (lz < -6.9) { this.inBoat = false; player.pos.y = 0; player.vy = 0; this.dunkT = 1.7; A.setMuffled(true, 320); A.playSplosh(); this.setUnderwater(1); this.graceT = 3; }
      return;
    }
    player.pos.set(b.x + lx, deck, b.z + lz); player.vy = 0; player.onGround = true;
  }
  setUnderwater(k) { const el = this.$('underwater'); if (el) el.style.opacity = k ? 0.85 : 0; }
  speedMul() { const { player } = this.api; let m = 1; if (!this.inBoat && player.pos.z > this.shore - 0.5) m *= 0.62; if (this.dunkT > 0) m *= 0.3; return m; }

  updateSea(dt) {
    const w = this.w;
    if (this.landT >= 0) this.shore = Math.max(21, 30 - (this.t - this.landT) * 0.03); // the tide comes in behind you
    w.sea.position.z = this.shore; w.foam.position.z = this.shore + 0.3; w.foam.material.opacity = 0.35 + Math.sin(this.t * 1.3) * 0.2;
    this._seaF = (this._seaF || 0) + 1; if (this._seaF % 2) return;
    const p = w.sea.geometry.attributes.position, base = w.seaBase, t = this.t;
    for (let i = 0; i < p.count; i++) { const x = base[i * 3], z = base[i * 3 + 2]; p.array[i * 3 + 1] = Math.sin(x * 0.09 + t * 1.1) * 0.22 + Math.cos(z * 0.07 + t * 0.8) * 0.28 * Math.min(1, z / 40); }
    p.needsUpdate = true; w.sea.geometry.computeVertexNormals();
  }
  splash(p) {
    const s = this.splashes.find(s => s.t <= 0) || this.splashes[0];
    s.m.position.copy(p); s.m.position.y = 0.3; s.t = 1.4; s.m.visible = true; s.h = 6 + Math.random() * 5;
    this.api.fx.burst(p, 0xe8eef0, 18, 7, 0.9, 1);
    A.playSplash(p.distanceTo(this.api.player.pos));
  }

  // ---------- MG nests
  canSee(from, to) {
    const d = to.clone().sub(from), L2 = d.length(); d.divideScalar(L2);
    return rayWorld(this.w.colliders, from, d, L2) >= L2 - 0.35 && !this.api.G.grenades.blocks(from, to);
  }
  updateNests(dt) {
    const { player, fx, G } = this.api;
    const ph = this.phase;
    if (this.graceT > 0) this.graceT -= dt;
    for (const n of this.nests) {
      if (!n.alive) continue;
      const active = n.id === 'C' ? (ph === 'trench' || ph === 'radio' || ph === 'barrage') : (ph !== 'boat' || this.boatZ < 120);
      if (!active) continue;
      if (n.suppress > 0) { n.suppress -= dt; continue; }
      if (n.burst <= 0) {
        n.pause -= dt; if (n.pause > 0) continue;
        n.burst = 1.1 + Math.random() * 0.9; n.pause = 1.0 + Math.random() * 1.4;
        const pz = player.pos.z, canP = player.alive && !this.inBoat && pz > n.front + NEST_FRONT && player.pos.distanceTo(n.muzzle) < 150 && this.dunkT <= 0;
        n.aimP = canP && Math.random() < (n.weak ? 0.75 : 0.55);
        if (!n.aimP) {
          // sweep the beach or an ally, or the boat ramp during the run-in
          const al = this.allies[Math.floor(Math.random() * 4)];
          if (ph === 'boat') n.aim.set(-4 + (Math.random() - 0.5) * 6, 1.5, this.boatZ - 6);
          else if (al.left && al.pos.z > n.front) n.aim.copy(al.pos).add(new THREE.Vector3((Math.random() - 0.5) * 4, 0.3, (Math.random() - 0.5) * 4));
          else n.aim.set((Math.random() - 0.5) * 50, 0, -20 + Math.random() * 45);
        }
        n.sway.set((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3);
      }
      n.burst -= dt; n.fireT -= dt;
      while (n.fireT <= 0) { n.fireT += 0.075; this.nestShot(n); }
    }
  }
  nestShot(n) {
    const { player, fx, G } = this.api;
    const chest = new THREE.Vector3(player.pos.x, player.pos.y + (player.crouch ? 0.75 : 1.15), player.pos.z);
    const dist = n.muzzle.distanceTo(chest);
    A.playMG(dist);
    let end;
    if (n.aimP) {
      const see = this.canSee(n.muzzle, chest);
      let p = (n.weak ? 0.09 : 0.12) * (player.moving ? 0.75 : 1) * (player.crouch ? 0.6 : 1);
      if (see && this.graceT <= 0 && Math.random() < p && !G.god) { this.api.hurtPlayer(8, n.muzzle); end = chest.clone(); }
      else {
        end = chest.clone().add(n.sway).add(new THREE.Vector3((Math.random() - 0.5) * 2.8, (Math.random() - 0.6) * 1.4, (Math.random() - 0.5) * 2.8));
        if (see) A.playCrack();
      }
      n.sway.multiplyScalar(0.97);
    } else {
      end = n.aim.clone().add(n.sway).add(new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 0.8, (Math.random() - 0.5) * 3));
      n.sway.x += (Math.random() - 0.5) * 0.6;
    }
    const d = end.clone().sub(n.muzzle); const L2 = d.length(); d.divideScalar(L2);
    const t = Math.min(rayWorld(this.w.colliders, n.muzzle, d, L2 + 30), L2 + 30);
    const hit = n.muzzle.clone().addScaledVector(d, t);
    if (Math.random() < 0.55) fx.tracer(n.muzzle, hit, 0xffd890, 0.035, 0.07);
    if (Math.random() < 0.5) fx.burst(hit, hit.z > this.shore ? 0xdfe6e8 : 0xc8b890, 3, 2.5, 0.35);
    if (this.inBoat && this.phase === 'boat' && Math.random() < 0.3) { A.playRicochet(); }
  }
  destroyNest(n, by) {
    if (!n.alive) return;
    const { fx } = this.api;
    n.alive = false; n.burst = 0;
    const c = n.center;
    fx.boom(c.clone(), n.id === 'C' ? 9 : 5.5, 0xffa040); fx.boom(n.muzzle.clone(), 3, 0xffd080);
    A.playExplosion(c.distanceTo(this.api.player.pos)); this.api.shake(0.5);
    n.mesh.mat.color.setHex(0x3a3734);
    n.mesh.group.children.forEach((m, i) => { if (i >= 1 && i <= 3) { m.rotation.z = (Math.random() - 0.5) * 0.5; m.position.y -= n.id === 'C' ? 1.2 : 0.5; } });
    n.mesh.group.rotation.z = (Math.random() - 0.5) * 0.08;
    this.smokers.push({ p: c.clone().add(new THREE.Vector3(0, 1.5, 0)), t: 0 });
    for (const e of this.api.G.enemies) if (e.alive && e.pos.distanceTo(c) < (n.id === 'C' ? 10 : 5)) e.damage(999);
    this.api.feed(`<b>${n.id === 'C' ? 'Strongpoint' : 'MG bunker'} destroyed</b>${by ? ` · ${by}` : ''}`);
  }

  // ---------- interactions
  findUse() {
    const { player } = this.api; if (!player.alive) return null; const P = player.pos;
    if (this.phase === 'bangalore' && this.fuse <= 0 && Math.hypot(P.x, P.z + 28) < 3.2) return { id: 'bangalore', text: this.placing > 0 ? `Placing Bangalore… ${Math.round(100 * this.placing / 2)}%` : 'Place Bangalore torpedo' };
    if (this.phase === 'bunker' && this.nests[0].alive && this.satchel <= 0 && Math.hypot(P.x + 11, P.z + 72.6) < 2.8 && P.y > PLAT - 1) return { id: 'satchel', text: 'Set satchel charge' };
    if (this.phase === 'radio') { const k = this.ally('kowalski'); if (k.pos.distanceTo(P) < 3.2) return { id: 'radio', text: 'Call destroyer fire (radio)' }; }
    return null;
  }
  onUse() {
    const u = this.use; if (!u) return;
    if (u.id === 'bangalore' && this.placing <= 0) { this.placing = 0.001; A.playClunk(); }
    else if (u.id === 'satchel') { this.satchel = 4; A.playClunk(); this.api.centerMsg('SATCHEL SET — GET CLEAR', 2); this.say('hale', 'Satchel set!', 0, 1.6); }
    else if (u.id === 'radio') { A.playRadio(); this.go('barrage'); }
  }
  updateBangalore(dt) {
    const { player } = this.api; const P = player.pos;
    if (this.placing > 0 && this.fuse <= 0) {
      if (Math.hypot(P.x, P.z + 28) > 3.6 || !player.alive) { this.placing = 0; this.api.centerMsg('PLACEMENT INTERRUPTED', 1.2); }
      else { this.placing += dt; if (this.placing >= 2) { this.placing = 0; this.fuse = 5; this.say('hale', 'Fire in the hole!', 0, 2); this.api.centerMsg('FUSE LIT — GET BACK', 1.6); A.playPin(); } }
    }
    if (this.fuse > 0) {
      const before = Math.ceil(this.fuse); this.fuse -= dt; const now = Math.ceil(this.fuse);
      if (now !== before && this.fuse > 0) { this.api.centerMsg(`${now}`, 0.8); A.playPing(); }
      if (this.fuse <= 0) this.blowWire();
    }
  }
  blowWire() {
    const w = this.w; const p = new THREE.Vector3(0, 0.6, -29.6);
    this.api.explode(p, { dmg: 140, splash: 6, name: 'Bangalore torpedo', tracer: 0xffa040, kind: 'grenade' }, null, 0.6);
    for (let i = -2; i <= 2; i++) this.api.fx.boom(new THREE.Vector3(i * 1.2, 0.5, -29.6), 2.5, 0xffa040);
    this.api.shake(0.7);
    const i = w.colliders.indexOf(w.gapCol); if (i >= 0) w.colliders.splice(i, 1);
    w.gapMesh.visible = false; this.fuse = 0;
    this.smokers.push({ p: p.clone(), t: 0, life: 10 });
    this.say('rourke', "Wire's open! Up the draw — move, move!", 1.2, 0, true);
    this.later(0.2, () => this.go('draw'));
  }
  updateSatchel(dt) {
    if (this.satchel > 0) {
      const b = Math.ceil(this.satchel); this.satchel -= dt;
      if (Math.ceil(this.satchel) !== b && this.satchel > 0) A.playPing();
      if (this.satchel <= 0) this.api.explode(new THREE.Vector3(-11, PLAT + 0.6, -72.2), { dmg: 220, splash: 7, name: 'Satchel charge', tracer: 0xffa040, kind: 'grenade' }, null, 0.6);
    }
  }
  onExplosion(p, splash, name) {
    const n = this.nests[0];
    if (n.alive && (this.phase === 'bunker' || this.phase === 'draw') && p.distanceTo(n.center) < 5.2) this.destroyNest(n, name || 'grenade');
  }
  onImpact(p) {
    for (const n of this.nests) if (n.alive && p.distanceTo(n.muzzle) < 1.7) { if (n.suppress <= 0 && !this._supTip) { this._supTip = true; this.api.feed('<b>MG suppressed</b> — fire at the slit to pin it down'); } n.suppress = Math.max(n.suppress, 1.6); n.burst = 0; }
  }

  // ---------- destroyer fire support
  fireShip(p, last) {
    const { fx } = this.api; const g = this.w.guns[Math.floor(Math.random() * this.w.guns.length)];
    fx.boom(g.clone(), 4, 0xffd080); fx.burst(g.clone(), 0x888888, 20, 4, 1.4, -0.1);
    A.playCannon(80);
    this.later(0.1, () => A.playWhistle(1.25));
    this.shells.push({ t: 1.35, p, last });
  }
  updateShells(dt) {
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i]; s.t -= dt; if (s.t > 0) continue; this.shells.splice(i, 1);
      const { fx, G, player } = this.api;
      this.shellHits = (this.shellHits || 0) + 1;
      fx.boom(s.p.clone(), 8, 0xffa040); fx.burst(s.p.clone(), 0x6a5a40, 40, 10, 1.4, 1); fx.burst(s.p.clone(), 0x444444, 30, 4, 2.2, -0.15);
      A.playExplosion(s.p.distanceTo(player.pos) * 0.5); this.api.shake(0.6);
      for (const e of G.enemies) if (e.alive && e.pos.distanceTo(s.p) < 9) e.damage(999);
      for (const n of this.nests) if (n.alive && n.center.distanceTo(s.p) < 6 && (n.id !== 'C' || s.last)) this.destroyNest(n, 'destroyer fire');
      if (s.last) { this.later(1.5, () => { for (const e of this.groups.strong) if (e.alive) e.damage(999); this.go('relay'); }); }
    }
  }

  updateFx(dt) {
    const { fx, player } = this.api;
    for (const s of this.splashes) if (s.t > 0) { s.t -= dt; const k = 1 - s.t / 1.4; s.m.scale.set(1 + k, s.h * Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5) * (1 - Math.max(0, k - 0.5)), 1 + k); s.m.material.opacity = 0.8 * (1 - k); if (s.t <= 0) s.m.visible = false; }
    for (const s of this.smokers) { s.t += dt; if (s.life && s.t > s.life) continue; if (Math.random() < dt * 14) fx.trail(s.p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 1.5, (Math.random() - 0.5) * 1.5)), Math.random() < 0.2 ? 0xff8030 : 0x3a3a3a); }
    // the Sherman keeps firing at the right-hand bunker until it is gone
    if (this.phase !== 'boat' && this.nests[1].alive) {
      this.tankT -= dt;
      if (this.tankT <= 0) {
        this.tankT = 7 + Math.random() * 5; const m = this.tank.muzzle(new THREE.Vector3());
        fx.burst(m, 0xffc060, 14, 6, 0.3, 0.2); fx.burst(m, 0x777777, 12, 2, 1.0, -0.1); A.playCannon(m.distanceTo(player.pos));
        const hit = this.nests[1].center.clone().add(new THREE.Vector3((Math.random() - 0.5) * 8, -1 - Math.random() * 2, 3 + Math.random() * 2));
        this.later(0.4, () => { fx.boom(hit, 3, 0xffa040); fx.burst(hit, 0x6a5a40, 20, 6, 1, 1); });
      }
    }
    // distant shelling on the beach for atmosphere (never on top of the player)
    if (this.phase !== 'boat' && this.phase !== 'relay' && !this.done) {
      this.ambT -= dt;
      if (this.ambT <= 0) {
        this.ambT = 2.5 + Math.random() * 4;
        const p = new THREE.Vector3((Math.random() - 0.5) * 70, 0.2, -18 + Math.random() * 44);
        if (p.distanceTo(player.pos) > 16) { if (p.z > this.shore) this.splash(p); else { fx.boom(p, 3.5, 0xffa040); fx.burst(p, 0xb8a882, 30, 8, 1.2, 1); A.playExplosion(p.distanceTo(player.pos)); } }
      }
    }
  }

  // ---------- allies
  updateAllies(dt) {
    const { player, fx, G } = this.api; const cols = this.w.colliders; const P = player.pos;
    const ph = this.phase;
    this._reT = (this._reT || 0) - dt; const retarget = this._reT <= 0; if (retarget) this._reT = 1.5;
    for (const [i, a] of this.allies.entries()) {
      const e = a.e;
      if (!a.left) { this.animAlly(a, 0); continue; }
      if (retarget) this.allyTarget(a, i);
      // waypoints through the wire gap / draw mouth
      let tx = a.target.x, tz = a.target.z;
      if (a.pos.z > -29 && tz < -30) { tx = Math.max(-1.6, Math.min(1.6, a.pos.x)); tz = -31; if (Math.abs(a.pos.x) > 2.2) tz = -24; }
      else if (a.pos.z > -44 && tz < -46) { tx = Math.max(-4, Math.min(4, tx)); tz = -46; if (Math.abs(a.pos.x) > 5) tz = -43; }
      const dx = tx - a.pos.x, dz = tz - a.pos.z, dd = Math.hypot(dx, dz);
      let moved = 0;
      if (dd > 0.6) {
        const sp = (dd > 8 ? 5.2 : 4) * (a.pos.z > this.shore ? 0.65 : 1) * dt, bx = a.pos.x, bz = a.pos.z;
        a.pos.x += dx / dd * Math.min(sp, dd); a.pos.z += dz / dd * Math.min(sp, dd);
        collide(cols, a.pos, 0.38, a.pos.y);
        moved = Math.hypot(a.pos.x - bx, a.pos.z - bz);
        if (moved < sp * 0.25) { a.stuckT += dt; a.pos.x += (i % 2 ? 1 : -1) * sp * 0.7; collide(cols, a.pos, 0.38, a.pos.y); } else a.stuckT = 0;
        e.group.rotation.y = Math.atan2(dx, dz);
      }
      // keep out of the player's face
      const px = a.pos.x - P.x, pz = a.pos.z - P.z, pd = Math.hypot(px, pz);
      if (pd < 1.7 && pd > 0.01 && Math.abs(a.pos.y - P.y) < 1.5) { a.pos.x = P.x + px / pd * 1.7; a.pos.z = P.z + pz / pd * 1.7; collide(cols, a.pos, 0.38, a.pos.y); }
      const gy = groundAt(cols, a.pos.x, a.pos.z, 0.38, a.pos.y + 0.1); a.pos.y += (gy - a.pos.y) * Math.min(1, dt * 12);
      // catch-up if badly stuck or left far behind
      if ((a.stuckT > 4 || a.pos.distanceTo(P) > 45) && !this.inBoat && ph !== 'beach' && ph !== 'boat') { a.pos.set(P.x + (i - 1.5) * 1.5, P.y, P.z + 4); a.stuckT = 0; }
      a.walk += moved * 3.2; this.animAlly(a, moved);
      // shooting
      a.shootT -= dt;
      if (a.shootT <= 0 && moved < 0.05) {
        a.shootT = 1.2 + Math.random() * 1.8;
        let tgt = null, best = 75;
        for (const en of G.enemies) if (en.alive) { const d = en.pos.distanceTo(a.pos); if (d < best) { best = d; tgt = en; } }
        const from = new THREE.Vector3(a.pos.x, a.pos.y + 1.45, a.pos.z);
        let aim = null;
        if (tgt) { const c = new THREE.Vector3(tgt.pos.x, tgt.pos.y + 1.2, tgt.pos.z); if (this.canSee(from, c)) aim = c; }
        if (!aim) { const n = this.nests.find(n => n.alive && n.front < a.pos.z && n.muzzle.distanceTo(a.pos) < 110); if (n && ph !== 'boat') aim = n.muzzle.clone(); }
        if (aim) {
          e.group.rotation.y = Math.atan2(aim.x - a.pos.x, aim.z - a.pos.z);
          const end = aim.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 1.2));
          const mz = e.flash.getWorldPosition(new THREE.Vector3());
          fx.tracer(mz, end, 0xffe0a0, 0.025, 0.06); e.flash.visible = true; e.flashT = 0.05; setTimeout(() => (e.flash.visible = false), 50);
          A.playEnemyShot({ t: 'gun', f: 2100, decay: 0.2, thump: 95, gain: 0.9 }, from.distanceTo(P) + 8);
          if (tgt && aim && tgt.alive && Math.random() < (ph === 'trench' ? 0.16 : 0.1) && tgt.pos.distanceTo(aim) < 3) {
            if (tgt.damage(45)) this.api.feed(`<b>${a.name}</b> <span>[M1 Garand]</span> Defender`);
          }
        }
      }
    }
  }
  allyTarget(a, i) {
    const { player } = this.api; const P = player.pos; const ph = this.phase;
    const lane = [-6, 4, -11, 9][i];
    if (ph === 'beach' || ph === 'boat') {
      const want = Math.max(-21, Math.min(P.z - 2 + (i % 2) * 2, 26)), wx = P.x * 0.4 + lane;
      if (want < -19) { a.target.set(wx, 0, -22.6); return; }
      let best = null, bd = 1e9; for (const h of this.w.hedgehogs) { const d = Math.abs(h.x - wx) * 0.6 + Math.abs(h.z - want); if (d < bd) { bd = d; best = h; } }
      a.target.set(best.x + (i % 2 ? 0.4 : -0.4), 0, best.z + 1.1);
    } else if (ph === 'bangalore') a.target.set(lane * 0.7 + (lane > 0 ? 3 : -3), 0, -22.6);
    else if (ph === 'draw') a.target.set(Math.max(-4.5, Math.min(4.5, lane * 0.5)), 0, Math.max(P.z + 4 + i, -72));
    else if (ph === 'bunker') a.target.set(lane * 0.4, PLAT, -74.5 - (i % 2));
    else if (ph === 'trench' || ph === 'radio' || ph === 'barrage' || ph === 'relay') {
      if (a.id === 'kowalski' && ph !== 'trench') return;
      a.target.set(lane * 1.1, PLAT, ph === 'trench' ? -79 - (i % 2) : -88.8);
    }
  }
  animAlly(a, moved) { const sw = moved > 0.001 ? Math.sin(a.walk) * 0.6 : 0; a.e.hipL.rotation.x = sw; a.e.hipR.rotation.x = -sw; }

  // ---------- HUD marker
  updateMarker() {
    const el = this.$('objmarker'); const { camera, player } = this.api;
    if (!this.marker || !player.alive) { el.style.display = 'none'; return; }
    const v = this.marker.clone().project(camera);
    let x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight;
    const behind = v.z > 1;
    if (behind) { x = innerWidth - x; y = innerHeight * 0.72; }
    x = Math.max(40, Math.min(innerWidth - 40, x)); y = Math.max(60, Math.min(innerHeight * 0.72, y));
    el.style.display = 'block'; el.style.transform = `translate(${x}px,${y}px)`;
    el.querySelector('span').textContent = `${this.markerLabel ? this.markerLabel + ' ' : ''}${Math.round(this.marker.distanceTo(player.pos))}m`;
  }

  // ---------- death / checkpoint
  onPlayerDeath() {
    const { player } = this.api;
    if (this.deadT > 0) return;
    player.alive = false; this.deaths++; this.deadT = 2.6; this.placing = 0;
    const f = this.$('fade'); f.innerHTML = '<b>You were hit</b><span>Returning to last checkpoint…</span>'; f.classList.add('on');
  }
  respawn() {
    const { player, G } = this.api; const c = this.checkpoint;
    player.pos.set(c.x, c.y, c.z); player.yaw = c.yaw; player.pitch = 0; player.vy = 0; player.alive = true; player.hp = player.maxHp; player.lastHit = -99;
    this.api.refill(); this.graceT = 3; this.$('fade').classList.remove('on');
    for (const n of this.nests) n.burst = 0, n.pause = 1.5 + Math.random();
    this.api.centerMsg('CHECKPOINT', 1.4);
  }

  // ---------- debug skip (hidden; used by the automated tests)
  skip() {
    const { player } = this.api; const ph = this.phase;
    const tp = (x, y, z) => { player.pos.set(x, y, z); player.vy = 0; player.yaw = 0; };
    if (ph === 'boat') {
      if (!this.rampDown) { this.boatZ = 42.01; return 'boat→ramp'; }
      this.rampK = 1; this.inBoat = false; this.dunkT = 0; this.setUnderwater(0); A.setMuffled(false); player.eyeOff = 0;
      for (const a of this.allies) if (!a.left) { a.left = true; a.pos.set(-4 + a.slot, 0, 34); }
      tp(-4, 0, 33); this.go('beach'); return 'ramp→beach';
    }
    if (ph === 'beach') { this.inBoat = false; this.dunkT = 0; tp(0, 0, -22); return 'beach→bangalore'; }
    if (ph === 'bangalore') { tp(0, 0, -20); this.blowWire(); return 'bangalore→draw'; }
    if (ph === 'draw') { tp(-3, PLAT, -75); return 'draw→bunker'; }
    if (ph === 'bunker') { this.destroyNest(this.nests[0], 'skip'); return 'bunker→trench'; }
    if (ph === 'trench') { for (const e of this.groups.trench) if (e.alive) e.damage(999); return 'trench→radio'; }
    if (ph === 'radio') { const k = this.ally('kowalski'); tp(k.pos.x + 1.5, PLAT, k.pos.z); this.use = this.findUse(); return 'radio (stand at Kowalski)'; }
    return ph;
  }

  complete() {
    if (this.done) return; this.done = true;
    this.api.complete({ time: this.t, deaths: this.deaths });
  }
}
