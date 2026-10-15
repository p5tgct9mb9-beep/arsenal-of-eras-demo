// Arsenal of Eras — browser prototype demo. Game loop, player, weapons, waves, HUD.
import * as THREE from 'three';
import { ERAS, ERA_ORDER } from './eras.js';
import { buildWorld, collide, groundAt, rayWorld } from './world.js';
import { buildViewmodel, buildFlash } from './viewmodels.js';
import { Enemy } from './enemies.js';
import { FX } from './fx.js';
import * as A from './audio.js';
import { input, initInput, pollMove, lock, unlock, resetInput } from './input.js';

const $ = (id) => document.getElementById(id);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 1;
if (isTouch) document.body.classList.add('touchdev');

// ---------- renderer / scenes
const renderer = new THREE.WebGLRenderer({ antialias: !isTouch, powerPreference: 'high-performance' });
let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(pixelRatio);
renderer.autoClear = false;
renderer.info.autoReset = false;
$('game').appendChild(renderer.domElement);
const canvas = renderer.domElement;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 600); camera.rotation.order = 'YXZ';
const vmScene = new THREE.Scene(), vmCam = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
const vmHemi = new THREE.HemisphereLight(0xffffff, 0x404040, 1.1); vmScene.add(vmHemi);
const vmSun = new THREE.DirectionalLight(0xffffff, 0.9); vmSun.position.set(1, 2, 1.5); vmScene.add(vmSun);
const vmRoot = new THREE.Group(); vmScene.add(vmRoot);
const fx = new FX(scene);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h); camera.aspect = vmCam.aspect = w / h; camera.updateProjectionMatrix(); vmCam.updateProjectionMatrix();
}
addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 250)); resize();

// ---------- game state
const player = { pos: new THREE.Vector3(), vy: 0, onGround: true, yaw: 0, pitch: 0, hp: 100, alive: true, eye: new THREE.Vector3(0, 1.6, 0), moving: false, lastHit: -99, recoil: 0, bob: 0 };
const G = {
  state: 'title', eraKey: 'ww2', era: ERAS.ww2, world: null, enemies: [], wave: 0, toSpawn: 0, maxAlive: 4, spawnT: 0, interT: 0,
  score: 0, kills: 0, heads: 0, shots: 0, hits: 0, lowG: false, player, time: 0, god: false,
  onEnemyShot,
};
const W = { list: [], cur: 0, cool: 0, reloadT: 0, swapT: 0, swapTo: -1, ads: 0, kick: 0, latch: false, dryT: 0, flashT: 0 };
const projectiles = [];
const projGeo = new THREE.IcosahedronGeometry(0.12, 0);
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();

// ---------- UI wiring
function buildTitle() {
  const wrap = $('eras'); wrap.innerHTML = '';
  for (const k of ERA_ORDER) {
    const e = ERAS[k], best = +localStorage.getItem('aoe-best-' + k) || 0;
    const c = document.createElement('button'); c.className = 'era era-' + k; c.dataset.era = k;
    c.innerHTML = `<b>${e.name}</b><i>${e.year} · ${e.tag}</i><span>${e.weapons.map(w => w.name).join(' · ')}</span>${best ? `<em>Best: ${best}</em>` : ''}`;
    c.addEventListener('click', () => { A.initAudio(); startGame(k); });
    c.addEventListener('pointerenter', () => { if (G.state === 'title' && G.eraKey !== k) preview(k); });
    wrap.appendChild(c);
  }
}
$('btn-resume').onclick = () => resume();
$('btn-restart').onclick = () => { A.initAudio(); startGame(G.eraKey); };
$('btn-menu').onclick = () => toTitle();
$('btn-again').onclick = () => { A.initAudio(); startGame(G.eraKey); };
$('btn-menu2').onclick = () => toTitle();
$('controls').innerHTML = isTouch
  ? 'Left thumb: move (push to edge = sprint) · Drag right side: look · FIRE (drag it to aim) · AIM · R reload · ⇄ swap · ▲ jump'
  : 'WASD move · Shift sprint · Space jump · Mouse look · Click fire · Right-click aim · R reload · 1-3 / Q / wheel swap · Esc pause';

initInput(canvas, () => G.state === 'play', () => { if (G.state === 'play') pause(); });

function show(id, on) { $(id).classList.toggle('hidden', !on); }

// ---------- world setup
function clearWorld() {
  if (G.world) G.world.dispose();
  for (const e of G.enemies) e.dispose(scene);
  G.enemies = []; G.world = null;
  for (const p of projectiles) scene.remove(p.mesh); projectiles.length = 0;
  fx.clear();
}

function preview(k) {
  clearWorld(); G.eraKey = k; G.era = ERAS[k]; G.world = buildWorld(scene, G.era, k);
}

function setupWeapons() {
  vmRoot.clear(); W.list = [];
  for (const def of G.era.weapons) {
    const vm = buildViewmodel(def.model);
    const flash = buildFlash(def.tracer || G.era.tracer); vm.muzzle.add(flash);
    vm.group.visible = false; vm.group.scale.setScalar(0.62); vmRoot.add(vm.group);
    W.list.push({ def, mag: def.mag, reserve: def.reserve, vm, flash });
  }
  W.cur = 0; W.list[0].vm.group.visible = true; W.cool = 0; W.reloadT = 0; W.swapT = 0; W.ads = 0; W.kick = 0; W.latch = false;
}

function startGame(k) {
  clearWorld();
  G.eraKey = k; G.era = ERAS[k]; G.lowG = G.era.gravity < 8;
  G.world = buildWorld(scene, G.era, k);
  for (let i = 0; i < 10; i++) G.enemies.push(new Enemy(scene, G.era));
  fx.gravity = G.era.gravity * 0.5;
  A.setMuffled(G.era.theme === 'space');
  vmHemi.color.setHex(G.era.hemi[0]); vmHemi.intensity = Math.max(0.8, G.era.hemi[2] + 0.2); vmSun.color.setHex(G.era.sun[0]);
  setupWeapons();
  Object.assign(player, { vy: 0, onGround: true, yaw: 0, pitch: 0, hp: 100, alive: true, lastHit: -99, recoil: 0 });
  player.pos.set(0, 0, 0);
  Object.assign(G, { wave: 0, toSpawn: 0, spawnT: 0, interT: 2.5, score: 0, kills: 0, heads: 0, shots: 0, hits: 0, time: 0 });
  $('killfeed').innerHTML = '';
  resetInput();
  show('title', false); show('pause', false); show('over', false); show('hud', true); show('touch', isTouch);
  document.body.classList.toggle('scoped', false);
  G.state = 'play';
  centerMsg(`${G.era.name.toUpperCase()} — GET READY`, 2.4);
  hudAll();
  if (!isTouch) lock();
}

function pause() { G.state = 'paused'; resetInput(); show('pause', true); unlock(); }
function resume() { A.initAudio(); show('pause', false); resetInput(); G.state = 'play'; if (!isTouch) lock(); }
function toTitle() {
  G.state = 'title'; unlock(); show('pause', false); show('over', false); show('hud', false); show('touch', false); show('title', true);
  document.body.classList.remove('scoped'); vmRoot.clear(); buildTitle();
  for (const e of G.enemies) { e.active = false; e.group.visible = false; }
}

function gameOver() {
  G.state = 'over'; player.alive = false; unlock(); resetInput();
  const key = 'aoe-best-' + G.eraKey, best = Math.max(+localStorage.getItem(key) || 0, G.score);
  try { localStorage.setItem(key, best); } catch (e) {}
  $('over-stats').innerHTML = `<div><b>${G.wave}</b>Wave reached</div><div><b>${G.score}</b>Score</div><div><b>${G.kills}</b>Kills (${G.heads} HS)</div><div><b>${G.shots ? Math.round(100 * G.hits / G.shots) : 0}%</b>Accuracy</div><div><b>${best}</b>Best (${G.era.name})</div>`;
  A.playHorn(false);
  setTimeout(() => { show('over', true); show('touch', false); }, 900);
}

// ---------- waves
function startWave(n) {
  G.wave = n; G.toSpawn = 4 + n * 2; G.maxAlive = Math.min(3 + n, 10); G.spawnT = 0.5;
  centerMsg(`WAVE ${n}`, 2); A.playHorn(true); hudAll();
}
function aliveCount() { let c = 0; for (const e of G.enemies) if (e.alive) c++; return c; }
function spawnEnemy() {
  const e = G.enemies.find(e => !e.active); if (!e) return false;
  const sp = G.world.spawns.filter(s => s.distanceTo(player.pos) > 20);
  const p = (sp.length ? sp : G.world.spawns)[Math.floor(Math.random() * (sp.length || G.world.spawns.length))];
  e.spawn(p, G.wave); G.toSpawn--; return true;
}
function updateWaves(dt) {
  if (G.interT > 0) { G.interT -= dt; if (G.interT <= 0) startWave(G.wave + 1); return; }
  if (G.toSpawn > 0 && aliveCount() < G.maxAlive) { G.spawnT -= dt; if (G.spawnT <= 0 && spawnEnemy()) G.spawnT = 0.8 + Math.random() * 0.6; }
  if (G.toSpawn <= 0 && aliveCount() === 0 && G.wave > 0) {
    const bonus = 250 * G.wave; G.score += bonus;
    for (const w of W.list) w.reserve = Math.max(w.reserve, w.def.reserve);
    player.hp = Math.min(100, player.hp + 35);
    centerMsg(`WAVE ${G.wave} CLEARED  +${bonus}`, 3); feed(`<b>Wave ${G.wave} cleared</b> · ammo resupplied`);
    G.interT = 5; hudAll();
  }
}

// ---------- weapons
function curW() { return W.list[W.cur]; }
function muzzleWorld(out) {
  const ads = W.ads;
  out.set(0.15 * (1 - ads), -0.12 + ads * 0.06, -0.6).applyQuaternion(camera.quaternion).add(camera.position);
  return out;
}
function aimDir(spreadDeg) {
  const d = new THREE.Vector3(0, 0, -1);
  if (spreadDeg > 0) {
    const s = THREE.MathUtils.degToRad(spreadDeg) * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2;
    d.x = Math.tan(s) * Math.cos(a); d.y = Math.tan(s) * Math.sin(a); d.normalize();
  }
  return d.applyQuaternion(camera.quaternion);
}
function smartTarget(maxDeg) {
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  let best = null, bestA = THREE.MathUtils.degToRad(maxDeg);
  for (const e of G.enemies) {
    if (!e.alive) continue;
    tmpV.set(e.pos.x, e.pos.y + 1.2, e.pos.z).sub(camera.position); const L = tmpV.length(); tmpV.divideScalar(L);
    const a = fwd.angleTo(tmpV); if (a >= bestA || L > 80) continue;
    if (rayWorld(G.world.colliders, camera.position, tmpV, L) < L - 0.4) continue;
    best = e; bestA = a;
  }
  return best;
}

function fire() {
  const w = curW(), def = w.def;
  w.mag--; W.cool = 60 / def.rpm; G.shots++;
  A.playShot(def.sfx);
  if (def.ping && w.mag === 0) A.playPing();
  W.kick = Math.min(1.6, W.kick + 1); W.flashT = 0.045;
  player.recoil += def.recoil * (1 - 0.45 * W.ads) * (0.8 + Math.random() * 0.4);
  player.yaw += (Math.random() - 0.5) * def.recoil * 0.4;
  let spread = def.spread * (1 - 0.65 * W.ads) * (player.moving ? 1.5 : 1) * (player.onGround ? 1 : 2);
  let dir = aimDir(spread);
  let target = null;
  if (def.smart || def.kind === 'missile') {
    target = smartTarget(def.smart ? 11 : 16);
    if (target && def.smart) { dir = new THREE.Vector3(target.pos.x, target.pos.y + 1.15, target.pos.z).sub(camera.position).normalize(); const j = aimDir(0.6).sub(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)); dir.add(j).normalize(); }
  }
  const from = muzzleWorld(new THREE.Vector3());
  const color = def.tracer || G.era.tracer;
  if (def.kind === 'plasma' || def.kind === 'missile') {
    const mesh = new THREE.Mesh(projGeo, new THREE.MeshBasicMaterial({ color }));
    if (def.kind === 'missile') mesh.scale.set(0.7, 0.7, 2.2);
    mesh.position.copy(from); scene.add(mesh);
    // aim projectile from muzzle to where the crosshair ray lands
    const o = camera.position, t = Math.min(rayWorld(G.world.colliders, o, dir, 200), 200);
    const aimPt = o.clone().addScaledVector(dir, t), v = aimPt.sub(from).normalize().multiplyScalar(def.speed);
    projectiles.push({ mesh, pos: mesh.position, vel: v, def, life: 4, target });
    return;
  }
  hitscan(camera.position.clone(), dir, def, from, color);
}

function hitscan(o, d, def, from, color) {
  const worldT = rayWorld(G.world.colliders, o, d, 260);
  const hits = [];
  for (const e of G.enemies) { const t = e.rayHit(o, d, worldT); if (t < worldT) hits.push({ e, t, head: e._head }); }
  hits.sort((a, b) => a.t - b.t);
  const n = Math.min(hits.length, 1 + (def.pierce || 0));
  let endT = worldT;
  for (let i = 0; i < n; i++) {
    const h = hits[i]; const p = o.clone().addScaledVector(d, h.t);
    fx.burst(p, G.era.theme === 'future' || G.era.theme === 'space' ? 0xd0e8ff : 0x9a1a10, 8, 3, 0.4);
    damageEnemy(h.e, def.dmg * (h.head ? 2 : 1) * (def.kind === 'bullet' && !def.scope ? Math.max(0.65, 1 - h.t / 140) : 1), h.head, def.name);
  }
  if (n > 0 && !def.pierce) endT = hits[0].t;
  if (n > 0 && def.pierce && n >= hits.length) endT = worldT;
  const end = o.clone().addScaledVector(d, Math.min(endT, 200));
  if (worldT < 260 && (n === 0 || def.pierce)) {
    const wp = o.clone().addScaledVector(d, worldT - 0.05);
    fx.burst(wp, def.kind === 'bullet' ? 0xd8c8a0 : color, def.kind === 'rail' ? 18 : 5, def.kind === 'rail' ? 5 : 2.5, 0.35);
  }
  if (def.kind === 'rail') { fx.tracer(from, end, color, 0.08, 0.4); fx.tracer(from, end, 0xffffff, 0.025, 0.25); for (let i = 0; i < 10; i++) fx.trail(from.clone().lerp(end, i / 10), color); }
  else if (def.kind === 'beam') fx.tracer(from, end, color, 0.035, 0.05);
  else if (Math.random() < (def.auto ? 0.6 : 1)) fx.tracer(from, end, color, 0.022, 0.05);
}

function damageEnemy(e, dmg, head, wname) {
  if (!e.alive) return;
  G.hits++;
  const killed = e.damage(Math.round(dmg));
  hitmarker(killed, head); A.playHit(killed, head);
  if (killed) {
    G.kills++; if (head) G.heads++;
    const pts = 100 + (head ? 50 : 0) + G.wave * 10; G.score += pts;
    feed(`<b class="you">YOU</b> <span>[${wname}]</span> ${G.era.enemyName}${head ? ' <em>✦ HEADSHOT</em>' : ''} <small>+${pts}</small>`);
    hudAll();
  }
}

function explode(p, def, direct) {
  fx.boom(p, def.splash * (def.kind === 'missile' ? 1 : 0.6), def.tracer);
  const dist = p.distanceTo(player.pos);
  if (def.kind === 'missile') { A.playExplosion(dist); shake = Math.max(shake, Math.max(0, 0.35 - dist * 0.012)); }
  else A.playShot({ t: 'coil' }, 0.3, 1200);
  for (const e of G.enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(e.pos.x - p.x, e.pos.y + 1 - p.y, e.pos.z - p.z);
    if (e === direct) damageEnemy(e, def.dmg, false, def.name);
    else if (d < def.splash) damageEnemy(e, def.dmg * (1 - d / def.splash) * 0.8, false, def.name);
  }
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const pr = projectiles[i]; pr.life -= dt;
    if (pr.target && pr.target.alive && pr.def.kind === 'missile') {
      tmpV.set(pr.target.pos.x, pr.target.pos.y + 1.1, pr.target.pos.z).sub(pr.pos).normalize().multiplyScalar(pr.def.speed);
      pr.vel.lerp(tmpV, Math.min(1, dt * 3.5)).setLength(pr.def.speed);
    }
    const step = pr.vel.length() * dt; const d = tmpV2.copy(pr.vel).normalize();
    let hitT = rayWorld(G.world.colliders, pr.pos, d, step), hitE = null;
    for (const e of G.enemies) { const t = e.rayHit(pr.pos, d, Math.min(hitT, step) + 0.25); if (t < hitT + 0.25 && t <= step + 0.25) { hitT = t; hitE = e; } }
    if (hitT < step || hitE || pr.life <= 0) {
      pr.pos.addScaledVector(d, Math.min(hitT, step));
      explode(pr.pos.clone(), pr.def, hitE);
      scene.remove(pr.mesh); pr.mesh.material.dispose(); projectiles.splice(i, 1); continue;
    }
    pr.pos.addScaledVector(d, step); pr.mesh.lookAt(tmpV.copy(pr.pos).add(d));
    if (pr.def.kind === 'missile') fx.trail(pr.pos, 0xbbbbbb); else if (Math.random() < 0.5) fx.trail(pr.pos, pr.def.tracer);
  }
}

function startReload() {
  const w = curW();
  if (W.reloadT > 0 || W.swapT > 0 || w.mag >= w.def.mag || w.reserve <= 0) return;
  W.reloadT = w.def.reload; A.playReload(w.def.reload);
}
function finishReload() { const w = curW(), need = w.def.mag - w.mag, take = Math.min(need, w.reserve); w.mag += take; w.reserve -= take; hudAll(); }
function swapTo(i) {
  if (i === W.cur || i < 0 || i >= W.list.length || W.swapT > 0) return;
  W.reloadT = 0; W.swapT = 0.5; W.swapTo = i; A.playSwap();
}

function updateWeapons(dt) {
  if (input.swap !== null) { const s = input.swap; input.swap = null; swapTo(s === 'next' ? (W.cur + 1) % 3 : s === 'prev' ? (W.cur + 2) % 3 : s); }
  if (input.reload) { input.reload = false; startReload(); }
  W.cool -= dt;
  if (W.swapT > 0) { const before = W.swapT; W.swapT -= dt; if (before > 0.25 && W.swapT <= 0.25) { curW().vm.group.visible = false; W.cur = W.swapTo; curW().vm.group.visible = true; hudAll(); } }
  if (W.reloadT > 0) { W.reloadT -= dt; if (W.reloadT <= 0) { W.reloadT = 0; finishReload(); } }
  const w = curW(), def = w.def;
  const wantAds = input.ads && W.reloadT <= 0 && W.swapT <= 0 && !(input.sprint && player.moving);
  W.ads += ((wantAds ? 1 : 0) - W.ads) * Math.min(1, dt * 12);
  let trig = input.fire;
  if (!def.auto && !input.touch) { trig = input.fire && !W.latch; }
  if (input.fire && W.cool <= 0 && W.reloadT <= 0 && W.swapT <= 0 && player.alive) {
    if (trig) {
      if (w.mag > 0) { fire(); if (!def.auto && !input.touch) W.latch = true; hudAmmo(); }
      else if (W.dryT <= 0) { A.playDry(); W.dryT = 0.35; if (w.reserve > 0) startReload(); }
    }
  }
  if (!input.fire) W.latch = false;
  W.dryT -= dt;
  if (w.mag === 0 && w.reserve > 0 && W.reloadT <= 0 && W.swapT <= 0 && W.cool <= -0.15) startReload();
  // scope / fov
  const scoped = !!def.scope && W.ads > 0.85;
  document.body.classList.toggle('scoped', scoped);
  const fov = 75 * (1 + (def.zoom - 1) * W.ads);
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  // viewmodel animation
  const g = w.vm.group; g.visible = !scoped;
  const bobA = player.moving && player.onGround ? 1 - W.ads * 0.85 : 0;
  const bx = Math.sin(player.bob) * 0.012 * bobA, by = Math.abs(Math.cos(player.bob)) * 0.014 * bobA;
  let x = THREE.MathUtils.lerp(0.15, def.adsX || 0, W.ads) + bx, y = THREE.MathUtils.lerp(-0.15, -w.vm.top * 0.62 + 0.004, W.ads) - by, z = THREE.MathUtils.lerp(-0.36, -0.3, W.ads);
  let rx = 0, ry = 0, rz = 0;
  W.kick *= Math.exp(-dt * 16);
  z += W.kick * 0.04 * (1 - W.ads * 0.5); rx += W.kick * 0.07;
  if (input.sprint && player.moving && W.ads < 0.1) { ry += 0.5; rx -= 0.25; x -= 0.04; y -= 0.04; }
  if (W.reloadT > 0) {
    const ph = 1 - W.reloadT / def.reload, dip = Math.sin(ph * Math.PI);
    rx -= dip * 0.55; rz += dip * 0.35; y -= dip * 0.06;
    if (w.vm.mag) w.vm.mag.position.y = w.vm.magHome.y - Math.sin(Math.min(1, ph * 1.6) * Math.PI) * 0.3;
  } else if (w.vm.mag) w.vm.mag.position.copy(w.vm.magHome);
  if (W.swapT > 0) { const k = W.swapT > 0.25 ? (0.5 - W.swapT) / 0.25 : W.swapT / 0.25; y -= k * 0.35; rx -= k * 0.6; }
  g.position.set(x, y, z); g.rotation.set(rx, ry, rz);
  // flash
  if (W.flashT > 0) { W.flashT -= dt; w.flash.visible = true; w.flash.rotation.z = Math.random() * 3; w.flash.scale.setScalar(0.7 + Math.random() * 0.8); } else w.flash.visible = false;
  for (const m of w.vm.glow) m.material.color && (m.material.opacity = 1);
  // smart lock marker
  const lockEl = $('lock');
  if (def.smart || def.kind === 'missile') {
    const t = smartTarget(def.smart ? 11 : 16);
    if (t) { tmpV.set(t.pos.x, t.pos.y + 1.15, t.pos.z).project(camera); lockEl.style.transform = `translate(${(tmpV.x * 0.5 + 0.5) * innerWidth - 18}px,${(-tmpV.y * 0.5 + 0.5) * innerHeight - 18}px) rotate(45deg)`; lockEl.classList.add('on'); }
    else lockEl.classList.remove('on');
  } else lockEl.classList.remove('on');
}

// ---------- player
let shake = 0;
function updatePlayer(dt) {
  pollMove();
  const sens = camera.fov / 75;
  player.yaw -= input.lookX * sens; player.pitch -= input.lookY * sens; input.lookX = input.lookY = 0;
  player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch));
  const def = curW().def;
  const sprint = input.sprint && input.my > 0.3 && W.ads < 0.2;
  const speed = 6.2 * (sprint ? 1.45 : 1) * (1 - 0.45 * W.ads) * (def.slow || 1);
  const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  const fx_ = -sy * input.my + cy * input.mx, fz_ = -cy * input.my - sy * input.mx;
  const mag = Math.hypot(input.mx, input.my);
  player.moving = mag > 0.15;
  player.pos.x += fx_ * speed * dt; player.pos.z += fz_ * speed * dt;
  collide(G.world.colliders, player.pos, 0.4, player.pos.y);
  if (player.moving) player.bob += dt * speed * 1.6;
  // vertical
  const grav = G.era.gravity;
  if (input.jump && player.onGround) { player.vy = G.lowG ? 5.2 : 7.4; player.onGround = false; }
  input.jump = false;
  player.vy -= grav * dt; player.pos.y += player.vy * dt;
  const gnd = groundAt(G.world.colliders, player.pos.x, player.pos.z, 0.4, player.pos.y);
  if (player.pos.y <= gnd) { player.pos.y = gnd; player.vy = 0; player.onGround = true; } else player.onGround = player.pos.y - gnd < 0.02;
  // camera
  player.recoil *= Math.exp(-dt * 7);
  shake *= Math.exp(-dt * 6);
  player.eye.set(player.pos.x, player.pos.y + 1.6, player.pos.z);
  camera.position.copy(player.eye);
  camera.position.y += Math.abs(Math.cos(player.bob)) * 0.04 * (player.moving && player.onGround ? 1 : 0) * (1 - W.ads);
  if (shake > 0.001) camera.position.add(tmpV.set((Math.random() - .5) * shake, (Math.random() - .5) * shake, 0));
  camera.rotation.set(player.pitch + player.recoil, player.yaw, 0);
  // regen
  if (player.alive && G.time - player.lastHit > 4.5 && player.hp < 100) { player.hp = Math.min(100, player.hp + 14 * dt); hudHp(); }
}

function onEnemyShot(e, muzzle, end, hit, dist) {
  fx.tracer(muzzle, end, G.era.tracer, 0.03, 0.08);
  A.playEnemyShot(G.era.weapons[0].sfx, dist);
  if (!hit || !player.alive) return;
  const dmg = G.era.enemyDmg * (1 + Math.min(0.5, (G.wave - 1) * 0.03));
  if (!G.god) player.hp -= dmg;
  player.lastHit = G.time; A.playHurt();
  const v = $('dmg'); v.style.opacity = Math.min(0.9, 0.35 + (100 - player.hp) / 160); clearTimeout(v._t); v._t = setTimeout(() => v.style.opacity = 0, 260);
  // direction indicator
  const ang = Math.atan2(e.pos.x - player.pos.x, e.pos.z - player.pos.z), rel = ang - (player.yaw + Math.PI);
  const di = $('dmgdir'); di.style.transform = `rotate(${-rel}rad)`; di.classList.remove('on'); void di.offsetWidth; di.classList.add('on');
  hudHp();
  if (player.hp <= 0) { player.hp = 0; hudHp(); gameOver(); }
}

// ---------- HUD
let msgT = 0;
function centerMsg(t, dur) { const el = $('center-msg'); el.textContent = t; el.classList.add('on'); msgT = dur; }
function feed(html) {
  const f = $('killfeed'), d = document.createElement('div'); d.innerHTML = html; f.prepend(d);
  while (f.children.length > 5) f.lastChild.remove();
  setTimeout(() => d.classList.add('out'), 3600); setTimeout(() => d.remove(), 4200);
}
let hmT;
function hitmarker(kill, head) { const h = $('hitmarker'); h.className = 'on' + (kill ? ' kill' : '') + (head ? ' head' : ''); clearTimeout(hmT); hmT = setTimeout(() => h.className = '', kill ? 260 : 120); }
function hudAmmo() {
  const w = curW(); $('mag').textContent = w.mag; $('res').textContent = ' / ' + w.reserve; $('wname').textContent = w.def.name;
  $('mag').classList.toggle('low', w.mag <= Math.ceil(w.def.mag * 0.25));
}
function hudHp() { const h = Math.max(0, Math.round(player.hp)); $('hpfill').style.width = h + '%'; $('hptext').textContent = h; $('hpfill').classList.toggle('low', h < 35); }
function hudAll() {
  hudAmmo(); hudHp();
  $('wave').textContent = G.wave ? 'WAVE ' + G.wave : 'WAVE —'; $('score').textContent = G.score;
  $('era-tag').textContent = G.era.name.toUpperCase();
  $('slots').innerHTML = W.list.map((w, i) => `<span class="${i === W.cur ? 'cur' : ''}">${i + 1} ${w.def.name}</span>`).join('');
}
function hudTick(dt) {
  const left = G.toSpawn + aliveCount(); $('enemies').textContent = G.interT > 0 ? `NEXT WAVE ${Math.ceil(G.interT)}` : `HOSTILES ${left}`;
  const r = W.reloadT > 0; $('reloadbar').classList.toggle('on', r); if (r) $('reloadfill').style.width = (100 * (1 - W.reloadT / curW().def.reload)) + '%';
  if (msgT > 0) { msgT -= dt; if (msgT <= 0) $('center-msg').classList.remove('on'); }
  const spread = curW().def.spread * (1 - 0.65 * W.ads) * (player.moving ? 1.5 : 1) * (player.onGround ? 1 : 2);
  $('crosshair').style.setProperty('--gap', (6 + spread * 7 + W.kick * 6) + 'px');
  $('crosshair').style.opacity = 1 - W.ads * 0.7;
  const w = curW(); if (w.mag === 0 && w.reserve === 0) $('center-msg').classList.add('on'), $('center-msg').textContent = 'OUT OF AMMO — SWAP WEAPON', msgT = 0.2;
}

// ---------- main loop
const clock = new THREE.Clock();
let frameAcc = 0, frameN = 0, titleT = 0;
function portraitBlock() { return isTouch && innerHeight > innerWidth; }
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (G.state === 'play' && !portraitBlock()) {
    G.time += dt;
    updatePlayer(dt); updateWeapons(dt);
    for (const e of G.enemies) e.update(dt, G);
    updateProjectiles(dt); updateWaves(dt); hudTick(dt);
  } else if (G.state === 'title') {
    titleT += dt * 0.08;
    camera.position.set(Math.cos(titleT) * 30, 14, Math.sin(titleT) * 30); camera.lookAt(0, 2, 0);
    if (camera.fov !== 75) { camera.fov = 75; camera.updateProjectionMatrix(); }
  } else if (G.state === 'over') {
    for (const e of G.enemies) e.update(dt, G);
    camera.position.y = Math.max(player.pos.y + 0.4, camera.position.y - dt * 2); camera.rotation.z = Math.min(0.5, camera.rotation.z + dt);
  }
  fx.update(dt);
  renderer.info.reset();
  renderer.clear();
  renderer.render(scene, camera);
  if ((G.state === 'play' || G.state === 'paused') && !document.body.classList.contains('scoped')) { renderer.clearDepth(); renderer.render(vmScene, vmCam); }
  // adaptive resolution for weaker phones
  frameAcc += dt; frameN++;
  if (frameAcc > 2.5) { const avg = frameAcc / frameN; if (avg > 0.024 && pixelRatio > 1) { pixelRatio = Math.max(1, pixelRatio - 0.25); renderer.setPixelRatio(pixelRatio); resize(); } frameAcc = 0; frameN = 0; }
}

// ---------- boot
preview('ww2'); buildTitle(); $('loading').remove(); loop();
window.AOE = { G, W, player, startGame, toTitle, renderer, input, god: (on = true) => (G.god = on), info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, pr: pixelRatio, world: G.world && G.world.drawInfo }) };
