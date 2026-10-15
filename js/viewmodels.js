// Low-poly first-person weapon viewmodels built only from primitives.
import * as THREE from 'three';

const L = (c) => new THREE.MeshLambertMaterial({ color: c });
const E = (c) => new THREE.MeshBasicMaterial({ color: c });
const geoCache = {};
function boxGeo(w, h, d) { const k = `b${w}|${h}|${d}`; return geoCache[k] || (geoCache[k] = new THREE.BoxGeometry(w, h, d)); }
function cylGeo(r1, r2, len, seg) { const k = `c${r1}|${r2}|${len}|${seg}`; if (!geoCache[k]) { const g = new THREE.CylinderGeometry(r1, r2, len, seg); g.rotateX(Math.PI / 2); geoCache[k] = g; } return geoCache[k]; }

function B(g, w, h, d, m, x, y, z, rx = 0, ry = 0, rz = 0) { const o = new THREE.Mesh(boxGeo(w, h, d), m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); g.add(o); return o; }
// cylinder along Z axis
function C(g, r, len, m, x, y, z, seg = 8, r2 = r) { const o = new THREE.Mesh(cylGeo(r, r2, len, seg), m); o.position.set(x, y, z); g.add(o); return o; }
function T(g, r, tube, m, x, y, z) { const o = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 5, 10), m); o.position.set(x, y, z); g.add(o); return o; }

const PAL = {
  wood: L(0x7a4a26), woodDark: L(0x5a3418), steel: L(0x3a3c40), black: L(0x1d1f22), dark: L(0x2a2c30),
  tan: L(0xb59a6a), olive: L(0x4f5638), white: L(0xdfe3e8), grey: L(0x80868e), gold: L(0xc9a040),
  glove: L(0x2d2a26), sleeveWW2: L(0x6b6a4a), sleeve: L(0x5a5e4a), sleeveTan: L(0x9c8c66), sleeveDark: L(0x222630), sleeveSpace: L(0xd8d8de),
  glass: L(0x223344),
};

let ARMS_ON = true;
function arms(g, sleeve, gripZ = 0.1, foreZ = -0.28, foreY = -0.02) {
  if (!ARMS_ON) return;
  // right hand on grip, left hand on foregrip
  B(g, 0.07, 0.09, 0.1, PAL.glove, 0.0, -0.08, gripZ);
  B(g, 0.07, 0.07, 0.4, sleeve, 0.05, -0.15, gripZ + 0.24, 0.4, -0.15, 0);
  B(g, 0.08, 0.07, 0.1, PAL.glove, -0.02, foreY - 0.05, foreZ);
  B(g, 0.065, 0.065, 0.42, sleeve, -0.12, foreY - 0.14, foreZ + 0.2, 0.35, 0.5, 0);
}

function matOf(k) { return PAL[k] || L(k); }

// Parametric rifle/SMG/LMG builder used by the expanded weapon pools.
function genGun(g, p) {
  const body = matOf(p.col || 'black'), fur = matOf(p.fur || 'black');
  const rl = p.len || 0.34, hg = p.hg || 0.2, bar = p.bar || 0.2, bw = p.bw || 1;
  B(g, 0.065, 0.1, rl, body, 0, 0.02, -0.02);
  const front = -0.02 - rl / 2;
  if (hg > 0.01) B(g, 0.07, 0.075, hg, fur, 0, 0.012, front - hg / 2);
  if (p.jacket) { C(g, 0.03, hg + 0.1, PAL.steel, 0, 0.025, front - hg / 2 - 0.03, 6); }
  const hgEnd = front - hg;
  C(g, 0.014 * bw, bar, PAL.steel, 0, 0.025, hgEnd - bar / 2 + 0.03);
  const mz = hgEnd - bar + 0.03;
  switch (p.stock) {
    case 'wood': B(g, 0.06, 0.12, 0.28, fur, 0, -0.03, 0.27, 0.12); break;
    case 'black': B(g, 0.055, 0.1, 0.26, PAL.black, 0, -0.01, 0.28); break;
    case 'skel': B(g, 0.02, 0.02, 0.26, PAL.dark, 0, 0.03, 0.27); B(g, 0.02, 0.02, 0.24, PAL.dark, 0, -0.04, 0.26); B(g, 0.05, 0.1, 0.03, PAL.dark, 0, -0.005, 0.4); break;
    case 'tube': C(g, 0.016, 0.22, PAL.dark, 0, 0.02, 0.26); B(g, 0.05, 0.11, 0.06, PAL.black, 0, -0.01, 0.38); break;
  }
  let mag = null;
  switch (p.mag) {
    case 'straight': mag = B(g, 0.05, 0.17, 0.07, PAL.dark, 0, -0.1, -0.08, 0.1); break;
    case 'curved': mag = B(g, 0.05, 0.19, 0.075, PAL.dark, 0, -0.11, -0.1, 0.32); break;
    case 'drum': { mag = new THREE.Mesh(cylGeo(0.09, 0.09, 0.07, 10), PAL.black); mag.rotation.y = Math.PI / 2; mag.position.set(0, -0.1, -0.06); g.add(mag); break; }
    case 'box': mag = B(g, 0.11, 0.12, 0.13, PAL.olive, -0.07, -0.06, -0.06); break;
    case 'grip': mag = B(g, 0.04, 0.12, 0.05, PAL.dark, 0, -0.17, 0.06, -0.1); break;
  }
  B(g, 0.045, 0.12, 0.05, p.mag === 'grip' ? body : fur, 0, -0.08, p.mag === 'grip' ? 0.06 : 0.1, p.mag === 'grip' ? -0.1 : -0.25);
  if (p.handle) B(g, 0.03, 0.05, 0.16, body, 0, 0.1, -0.02);
  if (p.rail) B(g, 0.03, 0.02, rl + hg * 0.9, PAL.dark, 0, 0.08, -0.02 - hg * 0.45);
  else B(g, 0.012, 0.04, 0.012, PAL.steel, 0, 0.06, mz + 0.03);
  const glow = [];
  if (p.glow) { glow.push(B(g, 0.067, 0.012, rl * 0.8, E(p.glow), 0, 0.0, -0.02)); if (hg > 0.05) glow.push(B(g, 0.072, 0.01, hg * 0.7, E(p.glow), 0, 0.03, front - hg / 2)); }
  return { mag, mz, glow, gripZ: 0.1, foreZ: Math.max(front - hg * 0.55, -0.4) };
}

function pistol(g, p) {
  const body = matOf(p.col || 'black'), fur = matOf(p.fur || 'black'), k = p.big ? 1.25 : 1;
  B(g, 0.05 * k, 0.06 * k, 0.24 * k, body, 0, 0.045, -0.07);
  B(g, 0.045 * k, 0.04, 0.2 * k, fur === body ? PAL.dark : body, 0, 0.0, -0.06);
  B(g, 0.045 * k, 0.14, 0.065, fur, 0, -0.07, 0.03, -0.22);
  const mag = B(g, 0.035, 0.1, 0.045, PAL.dark, 0, -0.12, 0.045, -0.22);
  if (p.toggle) C(g, 0.016, 0.06, PAL.steel, 0, 0.085, 0.0, 6);
  B(g, 0.01, 0.02, 0.01, PAL.steel, 0, 0.083, -0.18 * k);
  const glow = []; if (p.glow) glow.push(B(g, 0.052 * k, 0.01, 0.18 * k, E(p.glow), 0, 0.02, -0.07));
  // hands: two-handed grip close together
  if (ARMS_ON) B(g, 0.07, 0.09, 0.09, PAL.glove, 0.0, -0.08, 0.04);
  if (ARMS_ON) { B(g, 0.06, 0.08, 0.09, PAL.glove, -0.045, -0.07, 0.02);
  B(g, 0.07, 0.07, 0.4, PAL.sleeveDark, 0.05, -0.15, 0.27, 0.4, -0.12, 0);
  B(g, 0.065, 0.065, 0.4, PAL.sleeveDark, -0.1, -0.14, 0.24, 0.4, 0.3, 0); }
  return { mag, mz: -0.07 - 0.12 * k - 0.01, glow };
}

export function buildViewmodel(model, gen = null, opts = {}) {
  const g = new THREE.Group();
  ARMS_ON = opts.arms !== false;
  const muzzle = new THREE.Object3D();
  let mag = null;
  let glow = [];
  switch (model) {
    case 'garand':
      B(g, 0.07, 0.09, 0.62, PAL.wood, 0, -0.02, -0.12);
      B(g, 0.065, 0.13, 0.28, PAL.wood, 0, -0.06, 0.28, 0.12);
      B(g, 0.05, 0.06, 0.22, PAL.steel, 0, 0.04, 0.02);
      C(g, 0.017, 0.5, PAL.steel, 0, 0.04, -0.45);
      B(g, 0.02, 0.04, 0.02, PAL.steel, 0, 0.08, 0.1);
      B(g, 0.012, 0.04, 0.012, PAL.steel, 0, 0.075, -0.68);
      muzzle.position.set(0, 0.04, -0.72);
      arms(g, PAL.sleeveWW2, 0.12, -0.3);
      break;
    case 'thompson':
      B(g, 0.07, 0.1, 0.34, PAL.steel, 0, 0.02, -0.05);
      B(g, 0.06, 0.12, 0.26, PAL.wood, 0, -0.03, 0.27, 0.1);
      C(g, 0.022, 0.32, PAL.steel, 0, 0.03, -0.36, 8);
      for (let i = 0; i < 4; i++) T(g, 0.026, 0.006, PAL.dark, 0, 0.03, -0.25 - i * 0.04);
      B(g, 0.045, 0.12, 0.05, PAL.wood, 0, -0.07, -0.2);
      B(g, 0.045, 0.11, 0.05, PAL.wood, 0, -0.07, 0.07);
      mag = B(g, 0.04, 0.2, 0.06, PAL.black, 0, -0.12, -0.06);
      muzzle.position.set(0, 0.03, -0.53);
      arms(g, PAL.sleeveWW2, 0.07, -0.2);
      break;
    case 'mg42':
      B(g, 0.08, 0.11, 0.42, PAL.black, 0, 0.02, -0.05);
      C(g, 0.035, 0.42, PAL.dark, 0, 0.04, -0.47, 8);
      for (let i = 0; i < 4; i++) B(g, 0.072, 0.02, 0.04, PAL.steel, 0, 0.04, -0.33 - i * 0.08);
      B(g, 0.07, 0.11, 0.26, PAL.woodDark, 0, -0.01, 0.3, 0.08);
      B(g, 0.05, 0.1, 0.05, PAL.woodDark, 0, -0.08, 0.08);
      mag = B(g, 0.1, 0.12, 0.12, PAL.olive, -0.07, -0.06, -0.06);
      B(g, 0.01, 0.2, 0.01, PAL.steel, 0.03, -0.06, -0.55, 0.4); B(g, 0.01, 0.2, 0.01, PAL.steel, -0.03, -0.06, -0.55, 0.4);
      muzzle.position.set(0, 0.04, -0.7);
      arms(g, PAL.sleeveWW2, 0.1, -0.12, 0.02);
      break;
    case 'ak47':
      B(g, 0.07, 0.1, 0.36, PAL.steel, 0, 0.02, -0.02);
      B(g, 0.075, 0.08, 0.22, PAL.wood, 0, 0.0, -0.3);
      B(g, 0.05, 0.035, 0.2, PAL.wood, 0, 0.065, -0.26);
      C(g, 0.016, 0.3, PAL.steel, 0, 0.02, -0.52);
      B(g, 0.06, 0.12, 0.28, PAL.wood, 0, -0.03, 0.3, 0.12);
      B(g, 0.045, 0.12, 0.05, PAL.woodDark, 0, -0.08, 0.1, -0.25);
      mag = B(g, 0.05, 0.2, 0.08, PAL.dark, 0, -0.13, -0.1, 0.3);
      B(g, 0.012, 0.05, 0.012, PAL.steel, 0, 0.06, -0.64);
      muzzle.position.set(0, 0.02, -0.68);
      arms(g, PAL.sleeve, 0.11, -0.3);
      break;
    case 'm16a1':
      B(g, 0.065, 0.11, 0.34, PAL.black, 0, 0.02, 0);
      C(g, 0.04, 0.26, PAL.black, 0, 0.01, -0.3, 3);
      C(g, 0.013, 0.24, PAL.steel, 0, 0.01, -0.52);
      B(g, 0.03, 0.05, 0.16, PAL.black, 0, 0.1, 0.0);
      B(g, 0.015, 0.08, 0.015, PAL.black, 0, 0.06, -0.42);
      B(g, 0.06, 0.1, 0.3, PAL.black, 0, -0.01, 0.32);
      B(g, 0.045, 0.12, 0.05, PAL.black, 0, -0.08, 0.12, -0.25);
      mag = B(g, 0.05, 0.16, 0.07, PAL.grey, 0, -0.1, -0.08);
      muzzle.position.set(0, 0.01, -0.65);
      arms(g, PAL.sleeve, 0.12, -0.3);
      break;
    case 'svd':
      B(g, 0.06, 0.09, 0.4, PAL.steel, 0, 0.02, -0.02);
      B(g, 0.07, 0.07, 0.26, PAL.wood, 0, 0.0, -0.34);
      C(g, 0.015, 0.4, PAL.steel, 0, 0.02, -0.66);
      B(g, 0.05, 0.03, 0.3, PAL.wood, 0, -0.04, 0.34); B(g, 0.05, 0.12, 0.04, PAL.wood, 0, -0.06, 0.2); B(g, 0.05, 0.14, 0.04, PAL.wood, 0, -0.07, 0.46);
      C(g, 0.03, 0.3, PAL.black, 0, 0.12, -0.04, 8); C(g, 0.038, 0.06, PAL.black, 0, 0.12, -0.2, 8);
      mag = B(g, 0.05, 0.13, 0.08, PAL.dark, 0, -0.08, -0.08, 0.2);
      muzzle.position.set(0, 0.02, -0.88);
      arms(g, PAL.sleeve, 0.12, -0.32);
      break;
    case 'm4a1':
    case 'hk416': {
      const body = model === 'm4a1' ? PAL.black : PAL.tan;
      B(g, 0.065, 0.1, 0.32, body, 0, 0.02, 0);
      B(g, 0.07, 0.07, 0.28, PAL.dark, 0, 0.02, -0.3);
      B(g, 0.03, 0.02, 0.62, PAL.dark, 0, 0.08, -0.15);
      C(g, 0.014, 0.18, PAL.steel, 0, 0.02, -0.53);
      C(g, 0.022, 0.06, PAL.black, 0, 0.02, -0.63, 6);
      B(g, 0.05, 0.08, 0.26, body, 0, 0.0, 0.3); B(g, 0.03, 0.1, 0.2, PAL.dark, 0, -0.04, 0.26);
      B(g, 0.045, 0.12, 0.05, body, 0, -0.08, 0.12, -0.25);
      if (model === 'hk416') { B(g, 0.03, 0.1, 0.035, PAL.black, 0, -0.06, -0.32); B(g, 0.05, 0.06, 0.1, PAL.black, 0, 0.13, 0.0); B(g, 0.04, 0.04, 0.01, PAL.glass, 0, 0.13, -0.05); }
      else { B(g, 0.05, 0.05, 0.08, PAL.black, 0, 0.12, -0.02); B(g, 0.04, 0.035, 0.005, PAL.glass, 0, 0.125, -0.06); glow.push(B(g, 0.006, 0.006, 0.006, E(0xff2020), 0, 0.125, -0.065)); }
      mag = B(g, 0.05, 0.17, 0.07, model === 'm4a1' ? PAL.dark : PAL.black, 0, -0.1, -0.07, 0.12);
      muzzle.position.set(0, 0.02, -0.68);
      arms(g, model === 'm4a1' ? PAL.sleeveTan : PAL.sleeve, 0.12, -0.3);
      break;
    }
    case 'barrett':
      B(g, 0.09, 0.13, 0.6, PAL.dark, 0, 0.02, -0.05);
      C(g, 0.025, 0.5, PAL.black, 0, 0.03, -0.6);
      B(g, 0.08, 0.05, 0.08, PAL.black, 0, 0.03, -0.86);
      B(g, 0.07, 0.12, 0.2, PAL.black, 0, 0.0, 0.34);
      B(g, 0.05, 0.12, 0.05, PAL.black, 0, -0.09, 0.15, -0.25);
      C(g, 0.035, 0.32, PAL.black, 0, 0.15, 0.0, 8); C(g, 0.045, 0.07, PAL.black, 0, 0.15, -0.18, 8); C(g, 0.04, 0.05, PAL.black, 0, 0.15, 0.17, 8);
      mag = B(g, 0.06, 0.1, 0.12, PAL.black, 0, -0.09, 0.0);
      muzzle.position.set(0, 0.03, -0.92);
      arms(g, PAL.sleeveTan, 0.15, -0.35);
      break;
    case 'smart': {
      const cy = E(0x00f0ff);
      B(g, 0.08, 0.11, 0.5, PAL.white, 0, 0.02, -0.1);
      B(g, 0.06, 0.08, 0.2, PAL.dark, 0, 0.0, -0.42);
      B(g, 0.07, 0.11, 0.22, PAL.white, 0, -0.01, 0.28);
      B(g, 0.05, 0.12, 0.05, PAL.dark, 0, -0.08, 0.1, -0.25);
      glow.push(B(g, 0.082, 0.012, 0.4, cy, 0, 0.0, -0.1));
      B(g, 0.09, 0.07, 0.01, PAL.dark, 0, 0.13, 0.02); glow.push(B(g, 0.08, 0.06, 0.004, E(0x0a6a80), 0, 0.13, 0.014));
      B(g, 0.02, 0.05, 0.02, PAL.dark, 0, 0.09, 0.02);
      mag = B(g, 0.055, 0.14, 0.09, PAL.dark, 0, -0.1, -0.08);
      muzzle.position.set(0, 0.0, -0.54);
      arms(g, PAL.sleeveDark, 0.12, -0.32);
      break;
    }
    case 'railgun': {
      const bl = E(0x66ccff);
      B(g, 0.1, 0.12, 0.34, PAL.dark, 0, 0.0, 0.05);
      B(g, 0.02, 0.03, 0.6, PAL.steel, 0, 0.05, -0.38); B(g, 0.02, 0.03, 0.6, PAL.steel, 0, -0.03, -0.38);
      for (let i = 0; i < 5; i++) glow.push(B(g, 0.07, 0.11, 0.025, bl, 0, 0.01, -0.15 - i * 0.11));
      B(g, 0.08, 0.1, 0.18, PAL.dark, 0, 0.0, 0.3);
      B(g, 0.05, 0.12, 0.05, PAL.black, 0, -0.09, 0.12, -0.25);
      mag = B(g, 0.08, 0.08, 0.1, PAL.grey, 0.07, 0.0, 0.08);
      muzzle.position.set(0, 0.01, -0.7);
      arms(g, PAL.sleeveDark, 0.12, -0.12, 0.05);
      break;
    }
    case 'laser': {
      const r = E(0xff3030);
      B(g, 0.09, 0.12, 0.44, PAL.grey, 0, 0.02, -0.05);
      C(g, 0.045, 0.2, PAL.dark, 0, 0.02, -0.36, 8);
      glow.push(C(g, 0.03, 0.02, r, 0, 0.02, -0.465, 8));
      for (let i = 0; i < 4; i++) B(g, 0.13, 0.015, 0.03, PAL.dark, 0, 0.08, -0.15 - i * 0.05);
      glow.push(B(g, 0.092, 0.015, 0.3, E(0xff6060), 0, -0.02, -0.05));
      B(g, 0.06, 0.12, 0.05, PAL.dark, 0, -0.09, 0.1, -0.25);
      mag = B(g, 0.06, 0.06, 0.14, E(0xff4040), 0, -0.06, -0.12);
      muzzle.position.set(0, 0.02, -0.48);
      arms(g, PAL.sleeveDark, 0.12, -0.3);
      break;
    }
    case 'plasma': {
      const gr = E(0x80ff40);
      B(g, 0.11, 0.13, 0.4, PAL.white, 0, 0.0, -0.02);
      glow.push(new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), gr)); glow[0].position.set(0, 0.09, -0.06); g.add(glow[0]);
      C(g, 0.04, 0.2, PAL.grey, 0, 0.0, -0.32, 6, 0.055);
      glow.push(C(g, 0.025, 0.01, gr, 0, 0.0, -0.425, 6));
      B(g, 0.06, 0.12, 0.05, PAL.dark, 0, -0.1, 0.08, -0.25);
      mag = B(g, 0.07, 0.1, 0.1, PAL.gold, 0, -0.09, -0.1);
      muzzle.position.set(0, 0.0, -0.45);
      arms(g, PAL.sleeveSpace, 0.1, -0.28);
      break;
    }
    case 'coilgun': {
      const bl = E(0x60d0ff);
      B(g, 0.08, 0.1, 0.3, PAL.white, 0, 0.0, 0.08);
      C(g, 0.02, 0.6, PAL.steel, 0, 0.02, -0.35);
      for (let i = 0; i < 6; i++) glow.push(T(g, 0.04, 0.012, i % 2 ? bl : PAL.gold, 0, 0.02, -0.12 - i * 0.08));
      B(g, 0.06, 0.12, 0.05, PAL.dark, 0, -0.08, 0.12, -0.25);
      mag = B(g, 0.06, 0.07, 0.12, PAL.grey, 0, -0.07, 0.0);
      muzzle.position.set(0, 0.02, -0.66);
      arms(g, PAL.sleeveSpace, 0.13, -0.3, 0.0);
      break;
    }
    case 'gen': {
      const r = genGun(g, gen || {}); mag = r.mag; glow = r.glow; muzzle.position.set(0, 0.025, r.mz);
      if (opts.arms !== false) arms(g, gen && gen.glow ? PAL.sleeveDark : PAL.sleeve, r.gripZ, r.foreZ);
      break;
    }
    case 'pistol': {
      const r = pistol(g, gen || {}); mag = r.mag; glow = r.glow; muzzle.position.set(0, 0.045, r.mz);
      break;
    }
    case 'missile': {
      const o = E(0xffa040);
      B(g, 0.16, 0.16, 0.6, PAL.white, 0.0, 0.04, -0.15);
      for (let i = 0; i < 4; i++) { const x = (i % 2 ? 0.04 : -0.04), y = 0.04 + (i < 2 ? 0.04 : -0.04); C(g, 0.026, 0.02, PAL.black, x, y, -0.455, 6); }
      glow.push(B(g, 0.162, 0.02, 0.1, o, 0, 0.13, -0.3));
      B(g, 0.06, 0.06, 0.12, PAL.dark, -0.1, 0.14, -0.05);
      B(g, 0.06, 0.12, 0.05, PAL.dark, 0, -0.09, 0.05, -0.25);
      mag = B(g, 0.12, 0.1, 0.12, PAL.gold, 0, -0.08, 0.1);
      muzzle.position.set(0, 0.04, -0.48);
      arms(g, PAL.sleeveSpace, 0.06, -0.3);
      break;
    }
  }
  g.add(muzzle);
  // highest point of the weapon (used to align aim-down-sights)
  let top = 0; g.updateMatrixWorld(true);
  const bb = new THREE.Box3(); g.traverse(o => { if (o.isMesh && o.material !== PAL.glove && !String(o.material.uuid).startsWith('x')) { bb.setFromObject(o); if (Math.abs(o.position.x) < 0.06) top = Math.max(top, bb.max.y); } });
  const attG = new THREE.Group(); g.add(attG);
  return { group: g, muzzle, top, attG, muzzleHome: muzzle.position.clone(), model, mag, magHome: mag ? mag.position.clone() : null, glow };
}

// Muzzle flash: two crossed additive planes
export function buildFlash(color) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const g = new THREE.Group();
  const p = new THREE.PlaneGeometry(0.16, 0.16);
  const a = new THREE.Mesh(p, m); const b = new THREE.Mesh(p, m); b.rotation.y = Math.PI / 2; const c = new THREE.Mesh(p, m); c.rotation.x = Math.PI / 2;
  g.add(a, b, c); g.visible = false;
  return g;
}

// Visible attachment meshes. Returns the optic center height (for ADS alignment) or null.
export function applyAttachments(vm, att, sci) {
  const a = vm.attG; while (a.children.length) a.remove(a.children[0]);
  vm.muzzle.position.copy(vm.muzzleHome);
  if (vm.mag) { vm.mag.scale.set(1, 1, 1); }
  const top = vm.top, mzZ = vm.muzzleHome.z, mzY = vm.muzzleHome.y;
  const metal = sci ? PAL.grey : PAL.black, lens = E(sci ? 0x40e0ff : 0xff2020);
  let opticY = null;
  const isP = vm.model === 'pistol';
  const oz = isP ? -0.06 : -0.04;
  switch (att.optic) {
    case 'dot': B(a, 0.04, 0.045, 0.06, metal, 0, top + 0.022, oz); B(a, 0.03, 0.028, 0.004, PAL.glass, 0, top + 0.03, oz - 0.031); B(a, 0.006, 0.006, 0.004, lens, 0, top + 0.03, oz - 0.034); opticY = top + 0.03; break;
    case 'holo': B(a, 0.055, 0.012, 0.09, metal, 0, top + 0.006, oz); B(a, 0.006, 0.05, 0.006, metal, -0.025, top + 0.035, oz - 0.04); B(a, 0.006, 0.05, 0.006, metal, 0.025, top + 0.035, oz - 0.04); B(a, 0.056, 0.006, 0.006, metal, 0, top + 0.06, oz - 0.04); B(a, 0.044, 0.04, 0.003, E(sci ? 0x104050 : 0x203018), 0, top + 0.035, oz - 0.04); B(a, 0.006, 0.006, 0.004, lens, 0, top + 0.035, oz - 0.043); opticY = top + 0.035; break;
    case '2x': C(a, 0.018, 0.16, PAL.black, 0, top + 0.03, oz, 8); B(a, 0.015, 0.025, 0.02, PAL.black, 0, top + 0.012, oz); opticY = top + 0.03; break;
    case '4x': C(a, 0.024, 0.2, metal, 0, top + 0.04, oz, 8); C(a, 0.032, 0.05, metal, 0, top + 0.04, oz - 0.12, 8); B(a, 0.02, 0.03, 0.04, metal, 0, top + 0.015, oz); opticY = top + 0.04; break;
    case '8x': C(a, 0.028, 0.28, metal, 0, top + 0.045, oz + 0.02, 8); C(a, 0.04, 0.07, metal, 0, top + 0.045, oz - 0.14, 8); B(a, 0.02, 0.035, 0.05, metal, 0, top + 0.017, oz); opticY = top + 0.045; break;
  }
  switch (att.muzzle) {
    case 'supp': C(a, isP ? 0.02 : 0.026, isP ? 0.12 : 0.17, PAL.dark, 0, mzY, mzZ - (isP ? 0.06 : 0.085), 8); vm.muzzle.position.z = mzZ - (isP ? 0.12 : 0.17); break;
    case 'comp': B(a, 0.04, 0.04, 0.06, metal, 0, mzY, mzZ - 0.03); B(a, 0.042, 0.01, 0.01, PAL.dark, 0, mzY + 0.02, mzZ - 0.03); vm.muzzle.position.z = mzZ - 0.06; break;
    case 'flash': C(a, 0.02, 0.06, PAL.dark, 0, mzY, mzZ - 0.03, 5); vm.muzzle.position.z = mzZ - 0.06; break;
  }
  const uz = isP ? -0.12 : Math.max(mzZ * 0.55, -0.42);
  switch (att.under) {
    case 'grip': B(a, 0.035, 0.11, 0.04, metal, 0, -0.07, uz); break;
    case 'bipod': B(a, 0.012, 0.012, 0.2, metal, 0.02, -0.035, uz - 0.08, 0.15); B(a, 0.012, 0.012, 0.2, metal, -0.02, -0.035, uz - 0.08, 0.15); B(a, 0.04, 0.025, 0.03, metal, 0, -0.03, uz + 0.02); break;
    case 'laser': B(a, 0.03, 0.03, 0.07, metal, isP ? 0 : 0.045, isP ? -0.03 : 0.0, uz); B(a, 0.012, 0.012, 0.004, E(0xff1010), isP ? 0 : 0.045, isP ? -0.03 : 0.0, uz - 0.037); break;
  }
  if (vm.mag && att.mag === 'ext') vm.mag.scale.set(1, 1.5, 1.1);
  if (vm.mag && att.mag === 'fast') { const m2 = vm.mag.clone(); m2.position.x += 0.055; a.add(m2); const t = B(a, 0.11, 0.02, 0.05, E(0x3a3a3a), vm.mag.position.x + 0.027, vm.mag.position.y, vm.mag.position.z, vm.mag.rotation.x); t.material = PAL.olive; }
  return opticY;
}
