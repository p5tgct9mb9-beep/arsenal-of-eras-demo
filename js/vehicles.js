// One drivable low-poly tank per era. Hull drives with move input, turret follows the camera look.
import * as THREE from 'three';
import { collide } from './world.js';

const L = (c) => new THREE.MeshLambertMaterial({ color: c });
function box(p, m, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); p.add(o); return o; }
function cylZ(p, m, r, len, x, y, z, seg = 8, r2 = r) { const g = new THREE.CylinderGeometry(r, r2, len, seg); g.rotateX(Math.PI / 2); const o = new THREE.Mesh(g, m); o.position.set(x, y, z); p.add(o); return o; }
function cylY(p, m, r, h, x, y, z, seg = 10, r2 = r) { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, h, seg), m); o.position.set(x, y, z); p.add(o); return o; }
function cylX(p, m, r, len, x, y, z, seg = 10) { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateZ(Math.PI / 2); const o = new THREE.Mesh(g, m); o.position.set(x, y, z); p.add(o); return o; }

export class Vehicle {
  constructor(scene, era, pos) {
    this.spec = era.vehicle; this.scene = scene;
    const T = this.spec.type, c = this.spec.color;
    const hullM = L(c), darkM = L(0x2a2a28), trackM = L(0x222222), accM = L(T === 'rover' ? 0xff7a00 : T === 'hover' ? 0x111318 : new THREE.Color(c).multiplyScalar(0.8).getHex());
    this.mats = [hullM, darkM, trackM, accM];
    const g = this.group = new THREE.Group();
    const turret = this.turret = new THREE.Group(), gun = this.gun = new THREE.Group(), tip = this.tip = new THREE.Object3D();
    g.add(turret); turret.add(gun); gun.add(tip);
    let barrel = 3;
    this.glows = [];
    if (T === 'sherman') {
      box(g, trackM, 0.7, 1.0, 5.8, -1.35, 0.5, 0); box(g, trackM, 0.7, 1.0, 5.8, 1.35, 0.5, 0);
      box(g, hullM, 2.5, 1.0, 5.4, 0, 1.15, 0.1); box(g, hullM, 2.4, 0.9, 1.4, 0, 1.25, -2.5, -0.55);
      turret.position.set(0, 1.65, 0.2); cylY(turret, hullM, 1.05, 0.8, 0, 0.4, 0, 10, 1.15); box(turret, hullM, 0.9, 0.6, 0.5, 0, 0.4, -1.0);
      box(turret, darkM, 0.4, 0.25, 0.4, 0.45, 0.9, 0.3); gun.position.set(0, 0.42, -1.2); barrel = 2.4; cylZ(gun, darkM, 0.09, barrel, 0, 0, -barrel / 2);
    } else if (T === 't55') {
      box(g, trackM, 0.75, 0.95, 6.2, -1.45, 0.48, 0); box(g, trackM, 0.75, 0.95, 6.2, 1.45, 0.48, 0);
      box(g, hullM, 2.7, 0.75, 6.0, 0, 1.0, 0); box(g, hullM, 2.6, 0.6, 1.0, 0, 1.0, -3.0, -0.6);
      box(g, darkM, 0.5, 0.5, 1.4, -1.0, 1.55, 2.2);
      turret.position.set(0, 1.38, -0.3);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(1.25, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), hullM); dome.scale.set(1, 0.6, 1.05); turret.add(dome);
      gun.position.set(0, 0.35, -1.0); barrel = 3.4; cylZ(gun, darkM, 0.085, barrel, 0, 0, -barrel / 2); cylZ(gun, darkM, 0.14, 0.5, 0, 0, -barrel * 0.6);
    } else if (T === 'abrams') {
      box(g, trackM, 0.8, 1.0, 7.0, -1.6, 0.5, 0); box(g, trackM, 0.8, 1.0, 7.0, 1.6, 0.5, 0);
      box(g, hullM, 2.4, 0.9, 6.8, 0, 1.15, 0); box(g, hullM, 3.6, 0.15, 6.4, 0, 1.15, 0); box(g, hullM, 3.3, 0.5, 1.0, 0, 1.15, -3.4, -0.35);
      turret.position.set(0, 1.6, 0.3);
      box(turret, hullM, 2.9, 0.75, 3.0, 0, 0.38, 0); box(turret, hullM, 2.5, 0.6, 1.0, 0, 0.36, -1.7, 0.25); box(turret, accM, 2.4, 0.55, 0.9, 0, 0.36, 1.9);
      box(turret, darkM, 0.35, 0.3, 0.5, 0.8, 0.9, 0.2); cylZ(turret, darkM, 0.05, 0.6, 0.8, 0.95, -0.25);
      gun.position.set(0, 0.36, -2.0); barrel = 3.8; cylZ(gun, darkM, 0.1, barrel, 0, 0, -barrel / 2); cylZ(gun, darkM, 0.16, 0.6, 0, 0, -0.4);
    } else if (T === 'hover') {
      box(g, hullM, 3.0, 0.8, 5.8, 0, 1.05, 0); box(g, hullM, 2.6, 0.5, 1.4, 0, 1.0, -3.2, -0.45); box(g, accM, 1.0, 0.7, 5.0, -1.8, 0.9, 0.2); box(g, accM, 1.0, 0.7, 5.0, 1.8, 0.9, 0.2);
      const gl = new THREE.MeshBasicMaterial({ color: 0x00f0ff }); this.mats.push(gl);
      for (const [x, z] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 2.2], [1.8, 2.2]]) this.glows.push(cylY(g, gl, 0.5, 0.08, x, 0.5, z, 10));
      box(g, gl, 3.02, 0.06, 0.06, 0, 1.46, -2.9); box(g, new THREE.MeshBasicMaterial({ color: 0xff2bd6 }), 0.06, 0.06, 5.0, -2.31, 1.0, 0.2);
      turret.position.set(0, 1.45, 0.4); box(turret, hullM, 2.2, 0.6, 2.6, 0, 0.3, 0); box(turret, gl, 2.22, 0.05, 0.5, 0, 0.55, -1.0);
      gun.position.set(0, 0.32, -1.3); barrel = 3.0; box(gun, darkM, 0.12, 0.08, barrel, 0, 0.12, -barrel / 2); box(gun, darkM, 0.12, 0.08, barrel, 0, -0.12, -barrel / 2); box(gun, gl, 0.05, 0.16, barrel * 0.8, 0, 0, -barrel / 2);
      this.hoverY = 0.35;
    } else { // rover
      box(g, hullM, 2.4, 0.5, 4.6, 0, 1.05, 0); box(g, accM, 2.42, 0.12, 4.0, 0, 1.25, 0); box(g, darkM, 2.0, 0.4, 1.2, 0, 1.45, 1.2);
      this.wheels = [];
      for (const z of [-1.6, 0, 1.6]) for (const x of [-1.45, 1.45]) { this.wheels.push(cylX(g, trackM, 0.55, 0.5, x, 0.55, z, 12)); box(g, darkM, 0.2, 0.2, 0.2, x * 0.85, 0.7, z); }
      cylY(g, darkM, 0.03, 1.6, 0.9, 2.1, 1.8, 4); box(g, L(0x1c3a7a), 1.4, 0.04, 0.8, -0.5, 1.75, 1.6);
      turret.position.set(0, 1.35, -0.4); box(turret, hullM, 1.5, 0.6, 1.7, 0, 0.3, 0); box(turret, accM, 1.52, 0.08, 1.0, 0, 0.62, 0);
      gun.position.set(0, 0.32, -0.85); barrel = 2.4; cylZ(gun, darkM, 0.1, barrel, 0.2, 0, -barrel / 2); cylZ(gun, darkM, 0.1, barrel, -0.2, 0, -barrel / 2);
      const gm = new THREE.MeshBasicMaterial({ color: 0x9cff60 }); this.mats.push(gm); cylZ(gun, gm, 0.06, 0.05, 0.2, 0, -barrel - 0.02); cylZ(gun, gm, 0.06, 0.05, -0.2, 0, -barrel - 0.02);
    }
    tip.position.set(0, 0, -barrel - 0.2);
    scene.add(g);
    this.home = pos.clone();
    this.reset();
  }
  reset() {
    this.pos = this.group.position; this.pos.copy(this.home); this.pos.y = 0;
    this.yaw = Math.atan2(this.home.x, this.home.z); // face away from center-ish
    this.tYaw = this.yaw; this.pitch = 0; this.speed = 0; this.hp = this.spec.hp; this.alive = true; this.reloadT = 0; this.smokeT = 0; this.t = 0;
    this.group.rotation.set(0, this.yaw, 0); this.turret.rotation.set(0, 0, 0); this.gun.rotation.set(0, 0, 0);
    for (const m of this.mats) if (m._orig !== undefined) m.color.setHex(m._orig);
  }
  damage(n) { if (!this.alive) return false; this.hp -= n; if (this.hp <= 0) { this.hp = 0; this.alive = false; for (const m of this.mats) { m._orig = m.color.getHex(); m.color.multiplyScalar(0.22); } return true; } return false; }
  update(dt, ctrl, cols, fx) {
    this.t += dt;
    if (!this.alive) { this.smokeT -= dt; if (this.smokeT <= 0) { this.smokeT = 0.08; fx.trail(this.pos.clone().add(new THREE.Vector3((Math.random() - .5) * 1.5, 2 + Math.random(), (Math.random() - .5) * 1.5)), Math.random() < 0.3 ? 0xff7020 : 0x333333); } return; }
    this.reloadT = Math.max(0, this.reloadT - dt);
    const max = this.spec.speed;
    const target = ctrl ? (ctrl.throttle >= 0 ? ctrl.throttle * max : ctrl.throttle * max * 0.5) : 0;
    const acc = Math.abs(target) < Math.abs(this.speed) ? 9 : 5;
    this.speed += Math.max(-acc * dt, Math.min(acc * dt, target - this.speed));
    if (ctrl) this.yaw -= ctrl.steer * 1.15 * dt * (this.speed < -0.2 ? -1 : 1);
    const fx_ = -Math.sin(this.yaw), fz_ = -Math.cos(this.yaw);
    const bx = this.pos.x, bz = this.pos.z;
    this.pos.x += fx_ * this.speed * dt; this.pos.z += fz_ * this.speed * dt;
    // three circles along the hull for collision
    for (const o of [-1.7, 0, 1.7]) { const c = new THREE.Vector3(this.pos.x + fx_ * o, 0, this.pos.z + fz_ * o); const cx = c.x, cz = c.z; collide(cols, c, 1.45, 0, 3); this.pos.x += c.x - cx; this.pos.z += c.z - cz; }
    const moved = Math.hypot(this.pos.x - bx, this.pos.z - bz); if (Math.abs(this.speed) > 1 && moved < Math.abs(this.speed) * dt * 0.4) this.speed *= 0.7;
    this.group.rotation.y = this.yaw;
    if (this.hoverY) { this.pos.y = this.hoverY + Math.sin(this.t * 2.2) * 0.08; this.group.rotation.z = -(ctrl ? ctrl.steer : 0) * 0.06; this.group.rotation.x = this.speed * 0.006; }
    if (this.wheels) for (const w of this.wheels) w.rotation.x -= this.speed * dt / 0.55;
    if (ctrl) {
      let d = ctrl.aimYaw - this.tYaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      const rate = 2.4 * dt; this.tYaw += Math.max(-rate, Math.min(rate, d));
      this.pitch += Math.max(-dt, Math.min(dt, Math.max(-0.12, Math.min(0.4, ctrl.aimPitch)) - this.pitch));
    }
    this.turret.rotation.y = this.tYaw - this.yaw; this.gun.rotation.x = this.pitch;
  }
  muzzle(out) { return this.tip.getWorldPosition(out); }
  pivot(out) { return this.turret.getWorldPosition(out).add(new THREE.Vector3(0, 0.6, 0)); }
  dispose() { this.scene.remove(this.group); this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); for (const m of this.mats) m.dispose(); }
}
