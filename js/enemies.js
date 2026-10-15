// Enemy bots: simple chase/strafe AI that shoots back with distance-based hit chance.
import * as THREE from 'three';
import { collide, rayWorld, rayBox } from './world.js';

const boxG = new THREE.BoxGeometry(1, 1, 1);
function part(parent, mat, w, h, d, x, y, z) { const m = new THREE.Mesh(boxG, mat); m.scale.set(w, h, d); m.position.set(x, y, z); parent.add(m); return m; }

export class Enemy {
  constructor(scene, era) {
    const c = era.enemy, T = era.theme;
    this.mats = {
      body: new THREE.MeshLambertMaterial({ color: c.body }), legs: new THREE.MeshLambertMaterial({ color: c.legs }),
      head: new THREE.MeshLambertMaterial({ color: c.head }), skin: new THREE.MeshLambertMaterial({ color: c.skin }),
      acc: new THREE.MeshLambertMaterial({ color: c.accent }), gun: new THREE.MeshLambertMaterial({ color: 0x1e1e1e }),
    };
    const g = this.group = new THREE.Group();
    const hipL = this.hipL = new THREE.Group(), hipR = this.hipR = new THREE.Group();
    hipL.position.set(-0.13, 0.86, 0); hipR.position.set(0.13, 0.86, 0); g.add(hipL, hipR);
    part(hipL, this.mats.legs, 0.19, 0.86, 0.22, 0, -0.43, 0); part(hipR, this.mats.legs, 0.19, 0.86, 0.22, 0, -0.43, 0);
    part(g, this.mats.body, 0.5, 0.62, 0.3, 0, 1.17, 0);
    part(g, this.mats.acc, 0.52, 0.1, 0.32, 0, 0.92, 0); // belt
    const head = this.head = new THREE.Group(); head.position.set(0, 1.62, 0); g.add(head);
    part(head, this.mats.skin, 0.24, 0.26, 0.24, 0, 0, 0);
    if (T === 'ww2') part(head, this.mats.head, 0.34, 0.12, 0.36, 0, 0.12, 0), part(head, this.mats.head, 0.3, 0.1, 0.3, 0, 0.04, -0.02);
    else if (T === 'cold') part(head, this.mats.head, 0.28, 0.1, 0.28, 0, 0.14, 0);
    else if (T === 'modern') { part(head, this.mats.head, 0.3, 0.14, 0.3, 0, 0.12, 0); part(head, new THREE.MeshLambertMaterial({ color: 0x111111 }), 0.25, 0.07, 0.04, 0, 0.0, 0.13); }
    else { part(head, this.mats.head, 0.32, 0.32, 0.32, 0, 0.03, 0); part(head, new THREE.MeshBasicMaterial({ color: c.visor }), 0.26, 0.09, 0.04, 0, 0.04, 0.16); }
    if (T === 'space') part(g, this.mats.acc, 0.34, 0.42, 0.18, 0, 1.2, -0.24); // life support pack
    if (T === 'future') part(g, new THREE.MeshBasicMaterial({ color: c.accent }), 0.06, 0.4, 0.31, 0.2, 1.2, 0);
    // arms + gun
    part(g, this.mats.body, 0.14, 0.14, 0.45, 0.28, 1.25, 0.18); part(g, this.mats.body, 0.14, 0.14, 0.45, -0.22, 1.25, 0.25);
    part(g, this.mats.gun, 0.08, 0.12, 0.75, 0.08, 1.28, 0.42);
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ color: era.tracer, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.flash.position.set(0.08, 1.28, 0.85); this.flash.visible = false; g.add(this.flash);
    g.visible = false; scene.add(g);
    this.pos = g.position; this.active = false; this.alive = false;
  }
  spawn(p, wave, rng) {
    this.pos.copy(p); this.pos.y = 0; this.group.rotation.set(0, 0, 0); this.group.visible = true;
    this.maxHp = this.hp = Math.round(100 * (1 + 0.1 * (wave - 1)));
    this.speed = 2.4 + Math.random() * 1.0 + Math.min(wave, 10) * 0.08;
    this.pref = 9 + Math.random() * 14; this.strafe = Math.random() < 0.5 ? 1 : -1; this.strafeT = 1 + Math.random() * 2;
    this.shootT = 1.2 + Math.random() * 1.5; this.walk = Math.random() * 6; this.deadT = 0; this.hitT = 0; this.flashT = 0;
    this.detour = 0; this.detourDir = 1; this.hold = false; this.range = 0; this.accMul = 1; this.active = true; this.alive = true; this.vy = 0; this.stunT = 0; this.head.rotation.set(0, 0, 0);
  }
  // returns distance along ray or Infinity; sets this._head
  rayHit(o, d, maxT) {
    if (!this.alive) return Infinity;
    // head sphere
    const hx = this.pos.x, hy = this.pos.y + 1.66, hz = this.pos.z, r = 0.2;
    const ox = o.x - hx, oy = o.y - hy, oz = o.z - hz; const b = ox * d.x + oy * d.y + oz * d.z; const cc = ox * ox + oy * oy + oz * oz - r * r; const disc = b * b - cc;
    let th = Infinity; if (disc >= 0) { const t = -b - Math.sqrt(disc); if (t > 0) th = t; }
    const tb = rayBox(o, d, this.pos.x - 0.32, this.pos.y, this.pos.z - 0.32, this.pos.x + 0.32, this.pos.y + 1.46, this.pos.z + 0.32, maxT);
    if (th < tb && th < maxT) { this._head = true; return th; }
    this._head = false; return tb < maxT ? tb : Infinity;
  }
  damage(n) { this.hp -= n; this.hitT = 0.1; this.mats.body.emissive.setHex(0x803030); if (this.hp <= 0) { this.alive = false; this.deadT = 0; return true; } return false; }
  update(dt, g) {
    if (!this.active) return;
    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) this.mats.body.emissive.setHex(0x000000); }
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.flash.visible = false; }
    if (!this.alive) {
      this.deadT += dt; const k = Math.min(1, this.deadT / 0.45);
      this.group.rotation.x = -k * Math.PI / 2 * 0.95;
      if (g.lowG) { this.pos.y += dt * 0.6; this.group.rotation.z += dt * 0.8; }
      else if (this.deadT > 2.2) this.pos.y -= dt * 0.8;
      if (this.deadT > 3.2) { this.active = false; this.group.visible = false; }
      return;
    }
    const P = g.tgtPos;
    if (this.stunT > 0) {
      this.stunT -= dt; this.head.rotation.z = Math.sin(this.stunT * 9) * 0.35;
      this.group.rotation.y += Math.sin(this.stunT * 5) * dt * 3;
      this.pos.x += Math.sin(this.stunT * 3 + this.walk) * dt * 0.8; collide(g.world.colliders, this.pos, 0.38, this.pos.y);
      if (this.stunT <= 0) this.head.rotation.z = 0;
      return;
    }
    const dx = P.x - this.pos.x, dz = P.z - this.pos.z, dist = Math.hypot(dx, dz) || 0.001;
    const fx = dx / dist, fz = dz / dist;
    this.group.rotation.y = Math.atan2(dx, dz);
    if (!this.hold) {
    this.strafeT -= dt; if (this.strafeT <= 0) { this.strafe *= -1; this.strafeT = 1.2 + Math.random() * 2.2; }
    let mx = 0, mz = 0;
    if (dist > this.pref) { mx += fx; mz += fz; } else if (dist < this.pref - 5) { mx -= fx * 0.6; mz -= fz * 0.6; }
    mx += -fz * this.strafe * 0.55; mz += fx * this.strafe * 0.55;
    if (this.detour > 0) { this.detour -= dt; mx = -fz * this.detourDir + fx * 0.3; mz = fx * this.detourDir + fz * 0.3; }
    // separation
    for (const o of g.enemies) { if (o === this || !o.alive) continue; const sx = this.pos.x - o.pos.x, sz = this.pos.z - o.pos.z, s2 = sx * sx + sz * sz; if (s2 < 2.2 && s2 > 1e-4) { mx += sx / s2 * 0.6; mz += sz / s2 * 0.6; } }
    const ml = Math.hypot(mx, mz);
    if (ml > 0.01) {
      const sp = this.speed * dt / ml; const bx = this.pos.x, bz = this.pos.z;
      this.pos.x += mx * sp; this.pos.z += mz * sp;
      collide(g.world.colliders, this.pos, 0.38, this.pos.y);
      const moved = Math.hypot(this.pos.x - bx, this.pos.z - bz);
      if (moved < this.speed * dt * 0.3 && this.detour <= 0) { this.detour = 0.8 + Math.random() * 0.8; this.detourDir = Math.random() < 0.5 ? 1 : -1; }
      this.walk += moved * 3.2;
    }
    if (g.vehicle && g.vehicle.alive !== undefined) { const v = g.vehicle, vx = this.pos.x - v.pos.x, vz = this.pos.z - v.pos.z, vd = Math.hypot(vx, vz); if (vd < 2.6 && vd > 0.01) { this.pos.x = v.pos.x + vx / vd * 2.6; this.pos.z = v.pos.z + vz / vd * 2.6; } }
    const sw = Math.sin(this.walk) * 0.6; this.hipL.rotation.x = sw; this.hipR.rotation.x = -sw;
    }
    // shooting
    this.shootT -= dt;
    if (this.shootT <= 0 && g.player.alive) {
      if (dist > (this.range || (g.inVeh ? 60 : 48))) { this.shootT = 0.5; return; }
      const o = new THREE.Vector3(this.pos.x, this.pos.y + 1.45, this.pos.z), tgt = g.tgtEye.clone().add(new THREE.Vector3(0, -0.25, 0));
      const d = tgt.clone().sub(o); const L = d.length(); d.divideScalar(L);
      if (rayWorld(g.world.colliders, o, d, L) < L - (g.inVeh ? 2.5 : 0.3) || g.grenades.blocks(o, tgt)) { this.shootT = 0.35 + Math.random() * 0.4; return; }
      let chance = Math.max(0.12, Math.min(0.68, 0.78 - dist * 0.013));
      if (g.inVeh) chance = Math.min(0.85, chance * 1.4); else if (g.player.moving) chance *= 0.65;
      chance *= this.accMul; chance *= Math.min(1.35, 1 + (g.wave - 1) * 0.03);
      const hit = Math.random() < chance;
      const muzzle = this.flash.getWorldPosition(new THREE.Vector3());
      const end = tgt.clone(); if (!hit) end.add(new THREE.Vector3((Math.random() - 0.5) * 2.4, (Math.random() - 0.3) * 1.4, (Math.random() - 0.5) * 2.4));
      else end.add(new THREE.Vector3(0, g.inVeh ? -0.6 : -0.3, 0));
      g.onEnemyShot(this, muzzle, end, hit, dist);
      this.flash.visible = true; this.flash.rotation.z = Math.random() * 3; this.flashT = 0.06;
      this.shootT = (0.9 + Math.random() * 1.1) * Math.max(0.55, 1 - (g.wave - 1) * 0.04);
    }
  }
  dispose(scene) { scene.remove(this.group); this.group.traverse(o => { if (o.material) o.material.dispose(); }); }
}
