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

function arms(g, sleeve, gripZ = 0.1, foreZ = -0.28, foreY = -0.02) {
  // right hand on grip, left hand on foregrip
  B(g, 0.07, 0.09, 0.1, PAL.glove, 0.0, -0.08, gripZ);
  B(g, 0.07, 0.07, 0.4, sleeve, 0.05, -0.15, gripZ + 0.24, 0.4, -0.15, 0);
  B(g, 0.08, 0.07, 0.1, PAL.glove, -0.02, foreY - 0.05, foreZ);
  B(g, 0.065, 0.065, 0.42, sleeve, -0.12, foreY - 0.14, foreZ + 0.2, 0.35, 0.5, 0);
}

export function buildViewmodel(model) {
  const g = new THREE.Group();
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
  return { group: g, muzzle, top, mag, magHome: mag ? mag.position.clone() : null, glow };
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
