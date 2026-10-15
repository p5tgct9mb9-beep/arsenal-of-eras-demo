// Pooled visual effects: tracers/beams, particles (one Points draw call), explosion flashes.
import * as THREE from 'three';

export class FX {
  constructor(scene) {
    this.scene = scene;
    // tracers
    const tg = new THREE.BoxGeometry(1, 1, 1); tg.translate(0, 0, 0.5);
    this.tracers = [];
    for (let i = 0; i < 28; i++) {
      const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      m.visible = false; m.frustumCulled = false; scene.add(m); this.tracers.push({ m, life: 0, max: 1 });
    }
    this.ti = 0;
    // particles
    this.N = 500;
    const pg = new THREE.BufferGeometry();
    this.pp = new Float32Array(this.N * 3).fill(-9999); this.pc = new Float32Array(this.N * 3);
    pg.setAttribute('position', new THREE.BufferAttribute(this.pp, 3)); pg.setAttribute('color', new THREE.BufferAttribute(this.pc, 3));
    this.pts = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.16, vertexColors: true, sizeAttenuation: true, transparent: true, depthWrite: false }));
    this.pts.frustumCulled = false; scene.add(this.pts);
    this.pv = new Float32Array(this.N * 3); this.pl = new Float32Array(this.N); this.pgv = new Float32Array(this.N); this.pi = 0;
    // explosion flashes
    this.booms = [];
    const sg = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); m.visible = false; scene.add(m); this.booms.push({ m, life: 0, r: 1 }); }
    this.gravity = 9.8;
    this._c = new THREE.Color();
  }
  tracer(from, to, color, width = 0.03, life = 0.06) {
    const t = this.tracers[this.ti++ % this.tracers.length];
    const len = from.distanceTo(to); if (len < 0.05) return;
    t.m.position.copy(from); t.m.lookAt(to); t.m.scale.set(width, width, len);
    t.m.material.color.setHex(color); t.m.material.opacity = 1; t.m.visible = true; t.life = life; t.max = life;
  }
  burst(p, color, n = 8, speed = 4, life = 0.5, grav = 1) {
    this._c.setHex(color);
    for (let k = 0; k < n; k++) {
      const i = this.pi++ % this.N;
      this.pp[i * 3] = p.x; this.pp[i * 3 + 1] = p.y; this.pp[i * 3 + 2] = p.z;
      const v = speed * (0.4 + Math.random() * 0.6);
      let x = Math.random() * 2 - 1, y = Math.random() * 2 - 1, z = Math.random() * 2 - 1; const l = Math.hypot(x, y, z) || 1;
      this.pv[i * 3] = x / l * v; this.pv[i * 3 + 1] = y / l * v + speed * 0.3; this.pv[i * 3 + 2] = z / l * v;
      const f = 0.75 + Math.random() * 0.5;
      this.pc[i * 3] = this._c.r * f; this.pc[i * 3 + 1] = this._c.g * f; this.pc[i * 3 + 2] = this._c.b * f;
      this.pl[i] = life * (0.6 + Math.random() * 0.6); this.pgv[i] = grav;
    }
  }
  trail(p, color) { const i = this.pi++ % this.N; this._c.setHex(color); this.pp[i * 3] = p.x; this.pp[i * 3 + 1] = p.y; this.pp[i * 3 + 2] = p.z; this.pv[i * 3] = (Math.random() - .5) * .4; this.pv[i * 3 + 1] = Math.random() * .4; this.pv[i * 3 + 2] = (Math.random() - .5) * .4; this.pc[i * 3] = this._c.r; this.pc[i * 3 + 1] = this._c.g; this.pc[i * 3 + 2] = this._c.b; this.pl[i] = 0.5; this.pgv[i] = 0; }
  boom(p, r, color = 0xffa040) {
    const b = this.booms.find(b => b.life <= 0) || this.booms[0];
    b.m.position.copy(p); b.m.material.color.setHex(color); b.m.visible = true; b.life = 0.35; b.r = r;
    this.burst(p, 0xffc060, 30, r * 3, 0.7, 0.6); this.burst(p, 0x555555, 20, r * 1.5, 1.2, -0.2);
  }
  update(dt) {
    for (const t of this.tracers) if (t.life > 0) { t.life -= dt; t.m.material.opacity = Math.max(0, t.life / t.max); if (t.life <= 0) t.m.visible = false; }
    const g = this.gravity;
    for (let i = 0; i < this.N; i++) {
      if (this.pl[i] <= 0) continue;
      this.pl[i] -= dt;
      if (this.pl[i] <= 0) { this.pp[i * 3 + 1] = -9999; continue; }
      this.pv[i * 3 + 1] -= g * this.pgv[i] * dt;
      this.pp[i * 3] += this.pv[i * 3] * dt; this.pp[i * 3 + 1] += this.pv[i * 3 + 1] * dt; this.pp[i * 3 + 2] += this.pv[i * 3 + 2] * dt;
      if (this.pp[i * 3 + 1] < 0.02) { this.pp[i * 3 + 1] = 0.02; this.pv[i * 3 + 1] *= -0.3; }
    }
    this.pts.geometry.attributes.position.needsUpdate = true; this.pts.geometry.attributes.color.needsUpdate = true;
    for (const b of this.booms) if (b.life > 0) { b.life -= dt; const k = 1 - b.life / 0.35; b.m.scale.setScalar(0.3 + k * b.r); b.m.material.opacity = Math.max(0, 1 - k); if (b.life <= 0) b.m.visible = false; }
  }
  clear() { this.pl.fill(0); this.pp.fill(-9999); for (const t of this.tracers) { t.life = 0; t.m.visible = false; } for (const b of this.booms) { b.life = 0; b.m.visible = false; } }
}
