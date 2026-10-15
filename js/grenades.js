// Thrown grenades: arc physics with bounces, fuses, sticky/impact variants, smoke clouds and flashbangs.
import * as THREE from 'three';

const geo = new THREE.IcosahedronGeometry(0.11, 0);
const smokeGeo = new THREE.IcosahedronGeometry(1, 1);

export class Grenades {
  constructor(scene, hooks) {
    this.scene = scene; this.hooks = hooks; this.list = []; this.smokes = [];
  }
  throw(origin, vel, def, kind) {
    const m = new THREE.Mesh(geo, def.glow ? new THREE.MeshBasicMaterial({ color: def.color }) : new THREE.MeshLambertMaterial({ color: def.color }));
    if (kind === 'tac') m.scale.set(0.8, 1.4, 0.8);
    m.position.copy(origin); this.scene.add(m);
    this.list.push({ m, pos: m.position, vel: vel.clone(), def, kind, t: def.fuse, stuck: null, off: new THREE.Vector3(), spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, 0) });
  }
  update(dt, g) {
    const cols = g.world.colliders, grav = g.era.gravity * 0.9;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const n = this.list[i]; n.t -= dt;
      if (n.stuck === 'world') { /* stays */ }
      else if (n.stuck) { if (n.stuck.alive || n.stuck.active) n.pos.copy(n.stuck.pos).add(n.off); else n.stuck = 'world'; }
      else {
        n.vel.y -= grav * dt;
        const prev = n.pos.clone();
        n.pos.addScaledVector(n.vel, dt);
        n.m.rotation.x += n.spin.x * dt; n.m.rotation.y += n.spin.y * dt;
        let hit = false;
        // ground
        if (n.pos.y < 0.1) { n.pos.y = 0.1; if (n.vel.y < 0) n.vel.y = -n.vel.y * 0.35; n.vel.x *= 0.65; n.vel.z *= 0.65; hit = 'ground'; n.spin.multiplyScalar(0.6); }
        // boxes
        for (const c of cols) {
          if (n.pos.x > c.minX && n.pos.x < c.maxX && n.pos.z > c.minZ && n.pos.z < c.maxZ && n.pos.y < c.top && n.pos.y > c.minY) {
            if (prev.y >= c.top - 0.02) { n.pos.y = c.top + 0.02; n.vel.y = Math.abs(n.vel.y) * 0.35; n.vel.x *= 0.65; n.vel.z *= 0.65; }
            else if (prev.x <= c.minX || prev.x >= c.maxX) { n.pos.x = prev.x; n.vel.x = -n.vel.x * 0.45; }
            else { n.pos.z = prev.z; n.vel.z = -n.vel.z * 0.45; }
            hit = 'world'; break;
          }
        }
        // enemies
        let hitE = null;
        for (const e of g.enemies) { if (!e.alive) continue; const dx = n.pos.x - e.pos.x, dz = n.pos.z - e.pos.z; if (dx * dx + dz * dz < 0.2 && n.pos.y > e.pos.y && n.pos.y < e.pos.y + 1.85) { hitE = e; break; } }
        if (hitE) { hit = 'enemy'; if (!n.def.sticky && !n.def.impact) { n.vel.x *= -0.3; n.vel.z *= -0.3; } }
        if (hit) {
          const sp = n.vel.length();
          if (n.def.impact && n.kind === 'lethal' && n.t < n.def.fuse - 0.05) { n.t = 0; }
          else if (n.def.sticky) { if (hitE) { n.stuck = hitE; n.off.copy(n.pos).sub(hitE.pos); } else n.stuck = 'world'; n.vel.set(0, 0, 0); this.hooks.bounce(0.6); }
          else if (sp > 1.5) this.hooks.bounce(Math.min(1, sp / 10));
        }
      }
      if (n.t <= 0) {
        this.scene.remove(n.m); n.m.material.dispose(); this.list.splice(i, 1);
        const p = n.pos.clone();
        if (n.kind === 'lethal') this.hooks.explode(p, n.def);
        else if (n.def.id === 'smoke') this.addSmoke(p, g.era.theme);
        else this.hooks.flash(p);
      }
    }
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i]; s.life -= dt; s.age += dt;
      const k = Math.min(1, s.age / 1.6), fade = Math.min(1, s.life / 2.5);
      s.r = 4.8 * k;
      s.group.children.forEach((m, j) => { const o = s.offs[j]; m.position.set(o.x * s.r * 0.55, 0.6 + o.y * s.r * 0.35 + k * 1.2, o.z * s.r * 0.55); m.scale.setScalar((0.9 + o.w) * s.r * 0.45 + 0.2); m.rotation.y += dt * 0.1 * (j % 2 ? 1 : -1); });
      s.mat.opacity = 0.82 * fade;
      if (s.life <= 0) { this.scene.remove(s.group); s.mat.dispose(); this.smokes.splice(i, 1); }
    }
  }
  addSmoke(p, theme) {
    const col = theme === 'future' ? 0x6a4a8a : theme === 'space' ? 0xb0b0b4 : theme === 'cold' ? 0xdadfe2 : 0xa8a8a2;
    const mat = new THREE.MeshLambertMaterial({ color: col, transparent: true, opacity: 0.8, depthWrite: false });
    const group = new THREE.Group(); group.position.set(p.x, 0, p.z);
    const offs = [];
    for (let j = 0; j < 7; j++) { const m = new THREE.Mesh(smokeGeo, mat); group.add(m); offs.push({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 0.5, z: Math.random() * 2 - 1, w: Math.random() * 0.5 }); }
    this.scene.add(group);
    this.smokes.push({ group, mat, offs, pos: new THREE.Vector3(p.x, 1.4, p.z), r: 0.5, life: 14, age: 0 });
    this.hooks.smoke(p);
  }
  // does the segment a->b pass through any smoke cloud?
  blocks(a, b) {
    for (const s of this.smokes) {
      if (s.r < 1.5 || s.life < 1) continue;
      const r = s.r * 0.85;
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L2 = dx * dx + dy * dy + dz * dz;
      let t = ((s.pos.x - a.x) * dx + (s.pos.y - a.y) * dy + (s.pos.z - a.z) * dz) / (L2 || 1); t = Math.max(0, Math.min(1, t));
      const px = a.x + dx * t - s.pos.x, py = (a.y + dy * t - s.pos.y) * 1.4, pz = a.z + dz * t - s.pos.z;
      if (px * px + py * py + pz * pz < r * r) return true;
    }
    return false;
  }
  clear() { for (const n of this.list) { this.scene.remove(n.m); n.m.material.dispose(); } for (const s of this.smokes) { this.scene.remove(s.group); s.mat.dispose(); } this.list = []; this.smokes = []; }
}
