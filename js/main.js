// Arsenal of Eras — browser prototype demo. Game loop, player, weapons, grenades, vehicles, waves, HUD.
import * as THREE from 'three';
import { ERAS, ERA_ORDER } from './eras.js';
import { buildWorld, collide, groundAt, rayWorld, insideAny, setBounds } from './world.js';
import { Campaign, MISSIONS, CAMP_ERA } from './campaign.js';
import { buildViewmodel, buildFlash, applyAttachments } from './viewmodels.js';
import { Enemy } from './enemies.js';
import { FX } from './fx.js';
import { Grenades } from './grenades.js';
import { Vehicle } from './vehicles.js';
import * as A from './audio.js';
import { input, initInput, pollMove, lock, unlock, resetInput } from './input.js';
import { openLoadout, getLoadout, weaponById, attFor, effStats, lethalsFor, tacticalsFor } from './loadout.js';

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
// loadout preview scene (rendered into a scissor rect)
const pvScene = new THREE.Scene(), pvCam = new THREE.PerspectiveCamera(30, 2, 0.05, 20);
pvScene.add(new THREE.HemisphereLight(0xffffff, 0x505060, 2.2)); const pvSun = new THREE.DirectionalLight(0xffffff, 1.6); pvSun.position.set(1, 2, 2); pvScene.add(pvSun);
pvCam.position.set(0, 0.1, 2.3); pvCam.lookAt(0, 0, 0);
let pvGun = null;
const fx = new FX(scene);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h); camera.aspect = vmCam.aspect = w / h; camera.updateProjectionMatrix(); vmCam.updateProjectionMatrix();
}
addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 250)); resize();

// ---------- game state
const player = { crouch: false, eyeH: 1.6, eyeOff: 0, pos: new THREE.Vector3(), vy: 0, onGround: true, yaw: 0, pitch: 0, hp: 100, maxHp: 100, alive: true, eye: new THREE.Vector3(0, 1.6, 0), moving: false, lastHit: -99, recoil: 0, bob: 0 };
const G = {
  state: 'title', eraKey: 'ww2', era: ERAS.ww2, world: null, enemies: [], wave: 0, toSpawn: 0, maxAlive: 4, spawnT: 0, interT: 0,
  score: 0, kills: 0, heads: 0, shots: 0, hits: 0, lowG: false, player, time: 0, god: false, lo: null,
  nades: { lethal: 2, tac: 2 }, nadeMax: 2, vehicle: null, inVeh: false,
  tgtPos: player.pos, tgtEye: player.eye, grenades: null,
  onEnemyShot, mode: 'survival', camp: null, campPrimary: 'garand',
};
const W = { list: [], cur: 0, cool: 0, reloadT: 0, swapT: 0, swapTo: -1, ads: 0, kick: 0, latch: false, dryT: 0, flashT: 0, throwT: 0 };
const projectiles = [];
const projGeo = new THREE.IcosahedronGeometry(0.12, 0);
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
let shake = 0;

G.grenades = new Grenades(scene, {
  explode: (p, def) => explode(p, { dmg: def.dmg, splash: def.radius, name: def.name, tracer: def.glow ? 0x80ff40 : 0xffa040, kind: 'grenade' }, null, 0.35),
  flash: (p) => flashbang(p),
  smoke: () => A.playSmoke(),
  bounce: (v) => A.playBounce(v),
});

// ---------- UI wiring
function buildTitle() {
  const wrap = $('eras'); wrap.innerHTML = '';
  const best = +localStorage.getItem('aoe-camp-dog-green') || 0;
  $('mode-campaign').querySelector('em').textContent = best ? `Best time ${fmtTime(best)}` : 'New · ~5–10 min';
  for (const k of ERA_ORDER) {
    const e = ERAS[k], best = +localStorage.getItem('aoe-best-' + k) || 0;
    const c = document.createElement('button'); c.className = 'era era-' + k; c.dataset.era = k;
    c.innerHTML = `<b>${e.name}</b><i>${e.year} · ${e.tag}</i><span>${e.primaries.length + e.secondaries.length} weapons · ${e.vehicle.name}</span>${best ? `<em>Best: ${best}</em>` : ''}`;
    c.addEventListener('click', () => { A.initAudio(); if (G.eraKey !== k || !G.world) preview(k); showLoadout(k, 'title'); });
    c.addEventListener('pointerenter', () => { if (G.state === 'title' && G.eraKey !== k) preview(k); });
    wrap.appendChild(c);
  }
}
function fmtTime(t) { t = Math.round(t); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; }
function titleView(v) { $('title').classList.toggle('surv', v === 'survival'); }
$('mode-survival').onclick = () => { A.initAudio(); titleView('survival'); };
$('surv-back').onclick = () => titleView('modes');
$('mode-campaign').onclick = () => { A.initAudio(); showCampaign(); };
function showCampaign() {
  G.state = 'menu'; show('title', false); show('briefing', false); show('mission', false); show('campaign', true);
  $('camp-tiles').innerHTML = MISSIONS.map(m => m.playable
    ? `<button class="mtile play" id="mt-${m.id}"><small>Mission ${m.n} · ${m.date}</small><b>${m.name}</b><i>${m.place}</i><span>${m.pov} · PLAY ▶</span></button>`
    : `<div class="mtile locked"><small>Mission ${m.n} · ${m.date}</small><b>🔒 ${m.name}</b><i>${m.place}</i><span>Coming soon</span></div>`).join('');
  $('mt-dog-green').onclick = () => showBriefing();
}
$('camp-back').onclick = () => toTitle();
const BRIEF_W = [['garand', 'M1 Garand', 'Semi-auto rifle · 8-round clip'], ['thompson', 'Thompson M1A1', 'SMG · close range'], ['bar', 'M1918 BAR', 'Automatic rifle · 20-round mag']];
function showBriefing() {
  G.state = 'menu'; show('campaign', false); show('briefing', true);
  const sel = localStorage.getItem('aoe-camp-primary') || 'garand';
  G.campPrimary = BRIEF_W.find(w => w[0] === sel) ? sel : 'garand';
  const draw = () => { $('brief-weapons').innerHTML = BRIEF_W.map(([id, n, d]) => `<button class="chip${id === G.campPrimary ? ' on' : ''}" data-w="${id}"><b>${n}</b><i>${d}</i></button>`).join(''); $('brief-weapons').querySelectorAll('[data-w]').forEach(b => b.onclick = () => { G.campPrimary = b.dataset.w; try { localStorage.setItem('aoe-camp-primary', G.campPrimary); } catch (e) {} draw(); }); };
  draw();
  const log = $('brief-radio'); log.innerHTML = '';
  [['RADIO', 'Naval bombardment lifting. First wave, stand by.'], ['RADIO', 'Dog Green is covered by machine guns in concrete on the bluff, with wire and obstacles on the sand.'], ['Sgt. Rourke', 'Get off the beach, open that draw, and the Navy will be listening for our call.']]
    .forEach(([w, t], i) => { const d = document.createElement('div'); d.style.animationDelay = (0.6 + i * 1.6) + 's'; d.innerHTML = `<b>${w}:</b> ${t}`; log.appendChild(d); });
  A.playRadio();
}
$('brief-back').onclick = () => showCampaign();
$('brief-go').onclick = () => { A.initAudio(); startCampaign(G.campPrimary); };
$('btn-m-replay').onclick = () => { A.initAudio(); startCampaign(G.campPrimary); };
$('btn-m-camp').onclick = () => { toTitle(); showCampaign(); };
$('btn-m-menu').onclick = () => toTitle();
$('btn-resume').onclick = () => resume();
$('btn-restart').onclick = () => { A.initAudio(); if (G.mode === 'campaign') startCampaign(G.campPrimary); else startGame(G.eraKey); };
$('btn-menu').onclick = () => toTitle();
$('btn-lo-pause').onclick = () => showLoadout(G.eraKey, 'pause');
$('btn-again').onclick = () => { A.initAudio(); startGame(G.eraKey); };
$('btn-lo-over').onclick = () => showLoadout(G.eraKey, 'over');
$('btn-menu2').onclick = () => toTitle();
$('controls').innerHTML = isTouch
  ? 'Left thumb: move (push to edge = sprint) · Drag right side: look · FIRE · AIM · R reload · ⇄ swap · ▲ jump · ▼ crouch · 💣 lethal · ☁ tactical · ENTER vehicle / USE'
  : 'WASD move · Shift sprint · Space jump · C crouch · Mouse look · Click fire · Right-click aim · R reload · 1-2 / Q / wheel swap · G grenade · T/F tactical · E vehicle / use · Esc pause';

initInput(canvas, () => G.state === 'play', () => { if (G.state === 'play') pause(); });

function show(id, on) { $(id).classList.toggle('hidden', !on); }

function showLoadout(k, from) {
  G.loFrom = from; G.state = 'loadout'; unlock(); resetInput();
  show('title', false); show('pause', false); show('over', false); show('touch', false); show('loadout', true);
  if (from === 'title') show('hud', false);
  openLoadout(k, {
    deployLabel: from === 'pause' ? 'APPLY & RESUME ▶' : 'DEPLOY ▶',
    onBack: () => {
      show('loadout', false); clearPreview();
      if (from === 'title') toTitle(); else if (from === 'pause') { G.state = 'paused'; show('pause', true); } else { G.state = 'over'; show('over', true); }
    },
    onDeploy: (lo) => {
      show('loadout', false); clearPreview(); A.initAudio();
      if (from === 'pause') { applyLoadout(lo, true); resume(); } else startGame(k);
    },
    onPreview: (def, att) => setPreview(def, att, k),
  });
}
function clearPreview() { if (pvGun) { pvScene.remove(pvGun); pvGun = null; } }
function setPreview(def, att, k) {
  clearPreview();
  const vm = buildViewmodel(def.model, def.gen, { arms: false });
  applyAttachments(vm, att, k === 'future' || k === 'space');
  const g = new THREE.Group(); g.add(vm.group); vm.group.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(vm.group), c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
  vm.group.position.sub(c); const s = 2.1 / Math.max(sz.x, sz.y * 2.2, sz.z); g.scale.setScalar(s);
  pvGun = g; pvScene.add(g);
}

// ---------- world setup
function clearWorld() {
  if (G.camp) { G.camp.dispose(); G.camp = null; G.world = null; }
  if (G.world) G.world.dispose();
  setBounds(); document.body.classList.remove('campaign'); player.eyeOff = 0; input.crouch = false;
  $('fade').classList.remove('on'); $('subs').classList.remove('on'); $('objmarker').style.display = 'none';
  for (const e of G.enemies) e.dispose(scene);
  G.enemies = []; G.world = null;
  if (G.vehicle) { G.vehicle.dispose(); G.vehicle = null; }
  G.inVeh = false; A.engine(false);
  for (const p of projectiles) scene.remove(p.mesh); projectiles.length = 0;
  G.grenades.clear(); fx.clear();
}

function preview(k) { clearWorld(); G.eraKey = k; G.era = ERAS[k]; G.world = buildWorld(scene, G.era, k); }

const VM_SCALE = { pistol: 0.6 };
function applyLoadout(lo, midMatch = false) {
  G.lo = lo;
  const sci = G.era.theme === 'future' || G.era.theme === 'space';
  const keep = midMatch ? W.list.map(w => ({ id: w.def.id, mag: w.mag, reserve: w.reserve })) : [];
  vmRoot.clear(); W.list = [];
  for (const id of [lo.p, lo.s]) {
    const base = weaponById(G.eraKey, id), att = attFor(G.eraKey, lo, base);
    const def = effStats(G.eraKey, base, att, lo.gear);
    const vm = buildViewmodel(base.model, base.gen);
    const opticY = applyAttachments(vm, att, sci);
    const S = VM_SCALE[base.model] || 0.62;
    vm.adsY = opticY !== null ? -opticY * S : -vm.top * S + 0.004;
    const flash = buildFlash(def.tracer || G.era.tracer); vm.muzzle.add(flash);
    vm.group.visible = false; vm.group.scale.setScalar(S); vmRoot.add(vm.group);
    const k = keep.find(x => x.id === id);
    W.list.push({ def, mag: k ? Math.min(k.mag, def.mag) : def.mag, reserve: k ? k.reserve : def.reserve, vm, flash });
  }
  W.cur = 0; W.list[0].vm.group.visible = true; W.cool = 0; W.reloadT = 0; W.swapT = 0; W.ads = 0; W.kick = 0; W.latch = false; W.throwT = 0;
  G.lethal = lethalsFor(G.eraKey).find(x => x.id === lo.lethal);
  G.tactical = tacticalsFor(G.eraKey).find(x => x.id === lo.tactical);
  G.nadeMax = lo.gear === 'nades' ? 3 : 2;
  const newMax = lo.gear === 'armor' ? 135 : 100;
  if (midMatch) { player.hp = Math.min(player.hp, newMax); G.nades.lethal = Math.min(G.nades.lethal, G.nadeMax); G.nades.tac = Math.min(G.nades.tac, G.nadeMax); }
  player.maxHp = newMax;
  hudAll();
}

function spawnVehicle() {
  const cols = G.world.colliders;
  for (let i = 0; i < 60; i++) {
    const a = i * 2.39996, r = 10 + (i % 6) * 1.5, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!insideAny(cols, x, z, 3.6)) { G.vehicle = new Vehicle(scene, G.era, new THREE.Vector3(x, 0, z)); return; }
  }
}

function startGame(k) {
  clearWorld(); G.mode = 'survival'; pauseLabels();
  G.eraKey = k; G.era = ERAS[k]; G.lowG = G.era.gravity < 8;
  G.world = buildWorld(scene, G.era, k);
  for (let i = 0; i < 10; i++) G.enemies.push(new Enemy(scene, G.era));
  spawnVehicle();
  fx.gravity = G.era.gravity * 0.5;
  A.setMuffled(G.era.theme === 'space');
  vmHemi.color.setHex(G.era.hemi[0]); vmHemi.intensity = Math.max(0.8, G.era.hemi[2] + 0.2); vmSun.color.setHex(G.era.sun[0]);
  applyLoadout(getLoadout(k));
  Object.assign(player, { vy: 0, onGround: true, yaw: 0, pitch: 0, hp: player.maxHp, alive: true, lastHit: -99, recoil: 0 });
  player.pos.set(0, 0, 0);
  G.nades.lethal = G.nades.tac = G.nadeMax;
  Object.assign(G, { wave: 0, toSpawn: 0, spawnT: 0, interT: 2.5, score: 0, kills: 0, heads: 0, shots: 0, hits: 0, time: 0 });
  $('killfeed').innerHTML = '';
  resetInput();
  show('title', false); show('pause', false); show('over', false); show('loadout', false); show('hud', true); show('touch', isTouch);
  document.body.classList.remove('scoped', 'inveh');
  G.state = 'play';
  centerMsg(`${G.era.name.toUpperCase()} — GET READY`, 2.4);
  if (G.vehicle) feed(`<b>${G.era.vehicle.name}</b> available — find it and press ${isTouch ? 'ENTER' : 'E'}`);
  hudAll();
  if (!isTouch) lock();
}

function pauseLabels() {
  const c = G.mode === 'campaign';
  $('btn-restart').textContent = c ? 'Restart mission' : 'Restart era'; $('btn-menu').textContent = c ? 'Main menu' : 'Era select';
  $('btn-lo-pause').classList.toggle('hidden', c);
}
const campApi = {
  scene, fx, G, player, camera, isTouch,
  spawnEnemy(p) { let e = G.enemies.find(e => !e.active); if (!e) { e = new Enemy(scene, G.era); G.enemies.push(e); } e.spawn(p, 1); return e; },
  explode: (p, def, direct, selfMul) => explode(p, def, direct, selfMul),
  hurtPlayer: (d, f) => hurtPlayer(d, f), centerMsg: (t, d) => centerMsg(t, d), feed: (h) => feed(h),
  shake: (v) => { shake = Math.max(shake, v); },
  refill() { for (const w of W.list) { w.mag = w.def.mag; w.reserve = w.def.reserve; } G.nades.lethal = G.nades.tac = G.nadeMax; W.reloadT = 0; hudAll(); },
  complete: (s) => missionComplete(s),
};
function startCampaign(primary) {
  clearWorld(); G.mode = 'campaign'; pauseLabels();
  G.eraKey = 'ww2'; G.era = CAMP_ERA; G.lowG = false; G.campPrimary = primary;
  setBounds(-40, 40, -138, 60);
  G.camp = new Campaign(campApi);
  for (let i = 0; i < 8; i++) G.enemies.push(new Enemy(scene, G.era));
  fx.gravity = 10; A.setMuffled(false);
  vmHemi.color.setHex(0xd4d8dc); vmHemi.intensity = 1.0; vmSun.color.setHex(0xe8e8e2);
  applyLoadout({ p: primary, s: 'm1911', att: {}, lethal: 'frag', tactical: 'smoke', gear: 'nades' });
  Object.assign(player, { vy: 0, onGround: true, yaw: 0, pitch: 0, hp: player.maxHp, alive: true, lastHit: -99, recoil: 0, crouch: false, eyeH: 1.6, eyeOff: 0 });
  player.pos.set(-4, 1, 153.2);
  G.nades.lethal = G.nades.tac = G.nadeMax;
  Object.assign(G, { wave: 1, toSpawn: 0, spawnT: 0, interT: 0, score: 0, kills: 0, heads: 0, shots: 0, hits: 0, time: 0 });
  $('killfeed').innerHTML = '';
  resetInput();
  for (const id of ['title', 'pause', 'over', 'loadout', 'campaign', 'briefing', 'mission']) show(id, false);
  show('hud', true); show('touch', isTouch);
  document.body.classList.remove('scoped', 'inveh'); document.body.classList.add('campaign');
  G.state = 'play';
  G.camp.start();
  centerMsg('6 JUNE 1944 — OMAHA BEACH', 3);
  hudAll();
  if (!isTouch) lock();
}
function missionComplete(s) {
  G.state = 'complete'; unlock(); resetInput(); A.ambience(false);
  const key = 'aoe-camp-dog-green', prev = +localStorage.getItem(key) || 0, best = prev ? Math.min(prev, s.time) : s.time;
  try { localStorage.setItem(key, best); } catch (e) {}
  const acc = G.shots ? Math.round(100 * G.hits / G.shots) : 0;
  $('mission-stats').innerHTML = `<div><b>${fmtTime(s.time)}</b>Time${best === s.time ? ' · best' : ''}</div><div><b>${G.kills}</b>Kills</div><div><b>${acc}%</b>Accuracy</div><div><b>${s.deaths}</b>Deaths</div>`;
  $('mission-soon').innerHTML = MISSIONS.filter(m => !m.playable).map(m => `<div class="mtile locked"><small>Mission ${m.n}</small><b>🔒 ${m.name}</b><i>${m.place} · ${m.date}</i></div>`).join('');
  A.playHorn(true);
  setTimeout(() => { if (G.state === 'complete') { show('hud', false); show('touch', false); show('mission', true); } }, 600);
}
function pause() { G.state = 'paused'; resetInput(); show('pause', true); unlock(); A.engine(false); }
function resume() { A.initAudio(); show('pause', false); show('touch', isTouch); resetInput(); G.state = 'play'; if (!isTouch) lock(); if (G.camp && G.camp.phase === 'boat' && !G.camp.rampDown) A.engine(true, 0.7, false); }
function toTitle() {
  if (G.camp) { clearWorld(); preview('ww2'); }
  for (const id of ['campaign', 'briefing', 'mission']) show(id, false);
  titleView(G.mode === 'survival' && G.state !== 'title' && G.state !== 'menu' ? 'survival' : 'modes'); // survival players go back to the era grid
  G.state = 'title'; unlock(); show('pause', false); show('over', false); show('hud', false); show('touch', false); show('loadout', false); show('title', true);
  document.body.classList.remove('scoped', 'inveh'); vmRoot.clear(); buildTitle(); A.engine(false);
  if (G.inVeh) G.inVeh = false;
  for (const e of G.enemies) { e.active = false; e.group.visible = false; }
}

function gameOver() {
  G.state = 'over'; player.alive = false; unlock(); resetInput(); A.engine(false);
  const key = 'aoe-best-' + G.eraKey, best = Math.max(+localStorage.getItem(key) || 0, G.score);
  try { localStorage.setItem(key, best); } catch (e) {}
  $('over-stats').innerHTML = `<div><b>${G.wave}</b>Wave reached</div><div><b>${G.score}</b>Score</div><div><b>${G.kills}</b>Kills (${G.heads} HS)</div><div><b>${G.shots ? Math.round(100 * G.hits / G.shots) : 0}%</b>Accuracy</div><div><b>${best}</b>Best (${G.era.name})</div>`;
  A.playHorn(false);
  setTimeout(() => { if (G.state === 'over') { show('over', true); show('touch', false); } }, 900);
}

// ---------- waves
function startWave(n) {
  G.wave = n; G.toSpawn = 4 + n * 2; G.maxAlive = Math.min(3 + n, 10); G.spawnT = 0.5;
  centerMsg(`WAVE ${n}`, 2); A.playHorn(true); hudAll();
}
function aliveCount() { let c = 0; for (const e of G.enemies) if (e.alive) c++; return c; }
function spawnEnemy() {
  const e = G.enemies.find(e => !e.active); if (!e) return false;
  const sp = G.world.spawns.filter(s => s.distanceTo(G.tgtPos) > 20);
  const p = (sp.length ? sp : G.world.spawns)[Math.floor(Math.random() * (sp.length || G.world.spawns.length))];
  e.spawn(p, G.wave); G.toSpawn--; return true;
}
function updateWaves(dt) {
  if (G.interT > 0) { G.interT -= dt; if (G.interT <= 0) startWave(G.wave + 1); return; }
  if (G.toSpawn > 0 && aliveCount() < G.maxAlive) { G.spawnT -= dt; if (G.spawnT <= 0 && spawnEnemy()) G.spawnT = 0.8 + Math.random() * 0.6; }
  if (G.toSpawn <= 0 && aliveCount() === 0 && G.wave > 0) {
    const bonus = 250 * G.wave; G.score += bonus;
    for (const w of W.list) w.reserve = Math.max(w.reserve, w.def.reserve);
    G.nades.lethal = G.nades.tac = G.nadeMax;
    player.hp = Math.min(player.maxHp, player.hp + 35);
    centerMsg(`WAVE ${G.wave} CLEARED  +${bonus}`, 3); feed(`<b>Wave ${G.wave} cleared</b> · ammo & grenades resupplied`);
    if (G.vehicle && (!G.vehicle.alive || G.vehicle.hp < G.vehicle.spec.hp)) {
      if (!G.vehicle.alive && !G.inVeh) { G.vehicle.reset(); feed(`<b>${G.era.vehicle.name}</b> redeployed`); }
      else if (G.vehicle.alive) { G.vehicle.hp = Math.min(G.vehicle.spec.hp, G.vehicle.hp + G.vehicle.spec.hp * 0.5); feed(`<b>${G.era.vehicle.name}</b> repaired`); }
    }
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
function curSpread(def) {
  return def.spread * def.spreadMul * (1 - 0.65 * W.ads) * (def.hipMul + (1 - def.hipMul) * W.ads) * (player.moving ? 1.5 : 1) * (player.onGround ? 1 : 2);
}

function fire() {
  const w = curW(), def = w.def;
  w.mag--; W.cool = 60 / def.rpm; G.shots++;
  A.playShot(def.sfx, def.vol, def.lowpass);
  if (def.ping && w.mag === 0) A.playPing();
  W.kick = Math.min(1.6, W.kick + 1); W.flashT = def.flashScale > 0 ? 0.045 : 0;
  const rc = def.recoil * def.recoilMul * (def.bipod && W.ads > 0.5 ? 0.5 : 1);
  player.recoil += rc * (1 - 0.45 * W.ads) * (0.8 + Math.random() * 0.4);
  player.yaw += (Math.random() - 0.5) * rc * 0.4;
  const spread = curSpread(def);
  let dir = aimDir(spread);
  let target = null;
  if (def.smart || def.kind === 'missile') {
    target = smartTarget(def.smart ? 11 : 16);
    if (target && def.smart) { dir = new THREE.Vector3(target.pos.x, target.pos.y + 1.15, target.pos.z).sub(camera.position).normalize(); const j = aimDir(0.6).sub(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)); dir.add(j).normalize(); }
  }
  const from = muzzleWorld(new THREE.Vector3());
  const color = def.tracer || G.era.tracer;
  if (def.kind === 'plasma' || def.kind === 'missile') {
    const o = camera.position, t = Math.min(rayWorld(G.world.colliders, o, dir, 200), 200);
    launch(from, o.clone().addScaledVector(dir, t), def, color, target);
    return;
  }
  const pellets = def.pellets || 1;
  for (let i = 0; i < pellets; i++) hitscan(camera.position.clone(), i === 0 ? dir : aimDir(spread), def, from, color, i > 0);
}

function launch(from, aimPt, def, color, target = null) {
  const mesh = new THREE.Mesh(projGeo, new THREE.MeshBasicMaterial({ color }));
  if (def.kind === 'missile') mesh.scale.set(0.7, 0.7, 2.2);
  if (def.kind === 'shell') mesh.scale.set(0.9, 0.9, 2.6);
  mesh.position.copy(from); scene.add(mesh);
  const v = aimPt.clone().sub(from).normalize().multiplyScalar(def.speed);
  projectiles.push({ mesh, pos: mesh.position, vel: v, def, life: 4, target });
}

function falloff(def, t) { return t <= def.range ? 1 : Math.max(0.55, 1 - (t - def.range) / (def.range * 2.2)); }

function hitscan(o, d, def, from, color, quiet) {
  const worldT = rayWorld(G.world.colliders, o, d, 260);
  const hits = [];
  for (const e of G.enemies) { const t = e.rayHit(o, d, worldT); if (t < worldT) hits.push({ e, t, head: e._head }); }
  hits.sort((a, b) => a.t - b.t);
  const n = Math.min(hits.length, 1 + (def.pierce || 0));
  let endT = worldT;
  for (let i = 0; i < n; i++) {
    const h = hits[i]; const p = o.clone().addScaledVector(d, h.t);
    fx.burst(p, G.era.theme === 'future' || G.era.theme === 'space' ? 0xd0e8ff : 0x9a1a10, quiet ? 3 : 8, 3, 0.4);
    damageEnemy(h.e, def.dmg * (h.head ? 2 : 1) * (def.kind === 'bullet' ? falloff(def, h.t) : 1), h.head, def.name);
  }
  if (n > 0 && !def.pierce) endT = hits[0].t;
  const end = o.clone().addScaledVector(d, Math.min(endT, 200));
  if (worldT < 260 && (n === 0 || def.pierce)) {
    const wp = o.clone().addScaledVector(d, worldT - 0.05);
    if (G.camp) G.camp.onImpact(wp);
    fx.burst(wp, def.kind === 'bullet' ? 0xd8c8a0 : color, def.kind === 'rail' ? 18 : quiet ? 2 : 5, def.kind === 'rail' ? 5 : 2.5, 0.35);
  }
  if (def.kind === 'rail') { fx.tracer(from, end, color, 0.08, 0.4); fx.tracer(from, end, 0xffffff, 0.025, 0.25); for (let i = 0; i < 10; i++) fx.trail(from.clone().lerp(end, i / 10), color); }
  else if (def.kind === 'beam') fx.tracer(from, end, color, 0.035, 0.05);
  else if (Math.random() < (def.auto || quiet ? 0.5 : 1) * (def.vol < 1 ? 0.5 : 1)) fx.tracer(from, end, color, 0.022, 0.05);
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

// generic explosion; selfMul > 0 means it can hurt the player (grenades)
function explode(p, def, direct, selfMul = 0) {
  const big = def.kind !== 'plasma';
  fx.boom(p, def.splash * (big ? 1 : 0.6), def.tracer);
  const dist = p.distanceTo(G.tgtPos);
  if (big) { A.playExplosion(dist); shake = Math.max(shake, Math.max(0, (def.kind === 'shell' ? 0.5 : 0.4) - dist * 0.012)); }
  else A.playShot({ t: 'coil' }, 0.3, 1200);
  for (const e of G.enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(e.pos.x - p.x, e.pos.y + 1 - p.y, e.pos.z - p.z);
    if (e === direct) damageEnemy(e, def.dmg, false, def.name);
    else if (d < def.splash) damageEnemy(e, def.dmg * (1 - d / def.splash) * 0.85, false, def.name);
  }
  if (G.camp) G.camp.onExplosion(p, def.splash, def.name);
  if (selfMul > 0) {
    if (G.inVeh) { const d = p.distanceTo(G.vehicle.pos); if (d < def.splash + 2) damageVehicle(def.dmg * 0.3 * (1 - d / (def.splash + 2))); }
    else if (player.alive) {
      const d = Math.hypot(player.pos.x - p.x, player.pos.y + 0.9 - p.y, player.pos.z - p.z);
      if (d < def.splash && rayWorld(G.world.colliders, p, tmpV.set(player.pos.x - p.x, player.pos.y + 0.9 - p.y, player.pos.z - p.z).normalize(), d) >= d - 0.2) hurtPlayer(def.dmg * selfMul * (1 - d / def.splash), p);
    }
  }
}

function flashbang(p) {
  const dist = p.distanceTo(G.tgtPos);
  A.playFlashbang(dist);
  fx.boom(p, 2.2, 0xffffff); fx.burst(p, 0xffffff, 30, 7, 0.4, 0.2);
  let n = 0;
  for (const e of G.enemies) {
    if (!e.alive) continue;
    const h = tmpV.set(e.pos.x, e.pos.y + 1.6, e.pos.z), d = h.distanceTo(p);
    if (d > 18) continue;
    const dir = h.clone().sub(p).normalize();
    if (rayWorld(G.world.colliders, p.clone().add(new THREE.Vector3(0, 0.25, 0)), dir, d) < d - 0.3) continue;
    e.stunT = Math.max(e.stunT, 3.6 - d * 0.1); n++;
  }
  if (n) feed(`<span>[${G.tactical.name}]</span> ${n} ${G.era.enemyName}${n > 1 ? 's' : ''} stunned`);
  if (!G.inVeh && player.alive) {
    const to = p.clone().sub(camera.position), d = to.length(); to.divideScalar(d);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    if (d < 14 && rayWorld(G.world.colliders, camera.position, to, d) >= d - 0.3) {
      const k = (1 - d / 14) * Math.max(0.25, fwd.dot(to));
      const el = $('flashfx'); el.style.transition = 'none'; el.style.opacity = Math.min(0.95, k * 1.3); void el.offsetWidth; el.style.transition = 'opacity 1.8s ease-out'; el.style.opacity = 0;
    }
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
    if (pr.def.kind === 'missile' || pr.def.kind === 'shell') fx.trail(pr.pos, 0xbbbbbb); else if (Math.random() < 0.5) fx.trail(pr.pos, pr.def.tracer);
  }
}

function startReload() {
  const w = curW();
  if (W.reloadT > 0 || W.swapT > 0 || W.throwT > 0 || w.mag >= w.def.mag || w.reserve <= 0) return;
  W.reloadT = w.def.reload; A.playReload(w.def.reload);
}
function finishReload() { const w = curW(), need = w.def.mag - w.mag, take = Math.min(need, w.reserve); w.mag += take; w.reserve -= take; hudAll(); }
function swapTo(i) {
  if (i === W.cur || i < 0 || i >= W.list.length || W.swapT > 0 || W.throwT > 0) return;
  W.reloadT = 0; W.swapT = 0.5; W.swapTo = i; A.playSwap();
}

function throwNade(kind) {
  const def = kind === 'lethal' ? G.lethal : G.tactical, key = kind === 'lethal' ? 'lethal' : 'tac';
  if (G.nades[key] <= 0) { A.playDry(); centerMsg(`NO ${kind === 'lethal' ? 'LETHALS' : 'TACTICALS'} LEFT`, 1); return; }
  if (W.throwT > 0 || W.swapT > 0) return;
  G.nades[key]--; W.reloadT = 0; W.throwT = 0.55; A.playPin(); setTimeout(A.playThrow, 120);
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const o = camera.position.clone().addScaledVector(fwd, 0.6).add(new THREE.Vector3(0, -0.15, 0));
  const vel = fwd.multiplyScalar(G.lowG ? 12 : 16).add(new THREE.Vector3(0, G.lowG ? 2.5 : 4.5, 0));
  G.grenades.throw(o, vel, def, kind === 'lethal' ? 'lethal' : 'tac');
  hudNades();
}

function updateWeapons(dt) {
  if (input.swap !== null) { const s = input.swap; input.swap = null; swapTo(s === 'next' || s === 'prev' ? (W.cur + 1) % W.list.length : s); }
  if (input.reload) { input.reload = false; startReload(); }
  if (input.nade) { input.nade = false; throwNade('lethal'); }
  if (input.tac) { input.tac = false; throwNade('tac'); }
  W.cool -= dt;
  if (W.throwT > 0) W.throwT = Math.max(0, W.throwT - dt);
  if (W.swapT > 0) { const before = W.swapT; W.swapT -= dt; if (before > 0.25 && W.swapT <= 0.25) { curW().vm.group.visible = false; W.cur = W.swapTo; curW().vm.group.visible = true; hudAll(); } }
  if (W.reloadT > 0) { W.reloadT -= dt; if (W.reloadT <= 0) { W.reloadT = 0; finishReload(); } }
  const w = curW(), def = w.def;
  const busy = W.reloadT > 0 || W.swapT > 0 || W.throwT > 0;
  const wantAds = input.ads && !busy && !(input.sprint && player.moving);
  W.ads += ((wantAds ? 1 : 0) - W.ads) * Math.min(1, dt * 12 * def.adsSpeed);
  let trig = input.fire;
  if (!def.auto && !input.touch) { trig = input.fire && !W.latch; }
  if (input.fire && W.cool <= 0 && !busy && player.alive) {
    if (trig) {
      if (w.mag > 0) { fire(); if (!def.auto && !input.touch) W.latch = true; hudAmmo(); }
      else if (W.dryT <= 0) { A.playDry(); W.dryT = 0.35; if (w.reserve > 0) startReload(); }
    }
  }
  if (!input.fire) W.latch = false;
  W.dryT -= dt;
  if (w.mag === 0 && w.reserve > 0 && !busy && W.cool <= -0.15) startReload();
  // scope / fov
  const scoped = !!def.scope && W.ads > 0.85;
  document.body.classList.toggle('scoped', scoped);
  const fov = 75 * (1 + (def.zoom - 1) * W.ads);
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  // viewmodel animation
  const g = w.vm.group; g.visible = !scoped;
  const bobA = player.moving && player.onGround ? 1 - W.ads * 0.85 : 0;
  const bx = Math.sin(player.bob) * 0.012 * bobA, by = Math.abs(Math.cos(player.bob)) * 0.014 * bobA;
  const pst = w.vm.model === 'pistol';
  let x = THREE.MathUtils.lerp(pst ? 0.12 : 0.15, def.adsX || 0, W.ads) + bx, y = THREE.MathUtils.lerp(pst ? -0.11 : -0.15, w.vm.adsY, W.ads) - by, z = THREE.MathUtils.lerp(pst ? -0.46 : -0.36, pst ? -0.4 : -0.3, W.ads);
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
  if (W.throwT > 0) { const k = Math.sin((1 - W.throwT / 0.55) * Math.PI); y -= k * 0.3; rx -= k * 0.8; x += k * 0.05; }
  g.position.set(x, y, z); g.rotation.set(rx, ry, rz);
  if (W.flashT > 0) { W.flashT -= dt; w.flash.visible = true; w.flash.rotation.z = Math.random() * 3; w.flash.scale.setScalar((0.7 + Math.random() * 0.8) * Math.max(0.3, def.flashScale)); } else w.flash.visible = false;
  const lockEl = $('lock');
  if (def.smart || def.kind === 'missile') {
    const t = smartTarget(def.smart ? 11 : 16);
    if (t) { tmpV.set(t.pos.x, t.pos.y + 1.15, t.pos.z).project(camera); lockEl.style.transform = `translate(${(tmpV.x * 0.5 + 0.5) * innerWidth - 18}px,${(-tmpV.y * 0.5 + 0.5) * innerHeight - 18}px) rotate(45deg)`; lockEl.classList.add('on'); }
    else lockEl.classList.remove('on');
  } else lockEl.classList.remove('on');
}

// ---------- vehicles
function nearVehicle() { const v = G.vehicle; return v && v.alive && !G.inVeh && Math.hypot(v.pos.x - player.pos.x, v.pos.z - player.pos.z) < 4.6 && player.pos.y < 2.5; }
function enterVehicle() {
  const v = G.vehicle; G.inVeh = true; A.playClunk(); A.engine(true, 0, v.spec.type === 'hover');
  W.reloadT = 0; W.ads = 0; vmRoot.visible = false; document.body.classList.add('inveh'); document.body.classList.remove('nearveh'); $('prompt').classList.remove('on'); document.body.classList.remove('scoped');
  player.yaw = v.tYaw; player.pitch = -0.08;
  centerMsg(v.spec.name.toUpperCase(), 1.4); hudAll();
}
function exitVehicle(forced = false) {
  const v = G.vehicle; G.inVeh = false; A.engine(false); vmRoot.visible = true; document.body.classList.remove('inveh');
  const side = new THREE.Vector3(Math.cos(v.yaw), 0, -Math.sin(v.yaw));
  for (const s of [3.4, -3.4]) { player.pos.set(v.pos.x + side.x * s, 0, v.pos.z + side.z * s); if (!insideAny(G.world.colliders, player.pos.x, player.pos.z, 0.5)) break; }
  collide(G.world.colliders, player.pos, 0.4, 0); player.vy = 0; player.pitch = 0;
  if (!forced) A.playClunk();
  hudAll();
}
function damageVehicle(n) {
  const v = G.vehicle; if (!v || !v.alive || G.god) return;
  if (v.damage(n)) {
    fx.boom(v.pos.clone().add(new THREE.Vector3(0, 1.5, 0)), 6, 0xff8030); A.playExplosion(0); shake = 0.6;
    feed(`<b>${v.spec.name} destroyed!</b> Ejected`); centerMsg('VEHICLE DESTROYED', 2);
    exitVehicle(true); hurtPlayer(25, v.pos);
  }
  hudHp();
}
function updateVehicle(dt) {
  const v = G.vehicle; if (!v) return;
  if (!G.inVeh) { v.update(dt, null, G.world.colliders, fx); return; }
  pollMove(); input.nade = input.tac = input.reload = false; input.swap = null; input.jump = false;
  const sens = camera.fov / 75;
  player.yaw -= input.lookX * sens; player.pitch -= input.lookY * sens; input.lookX = input.lookY = 0;
  player.pitch = Math.max(-0.55, Math.min(0.4, player.pitch));
  // crosshair aim point
  const pivot = v.pivot(new THREE.Vector3());
  const look = new THREE.Vector3(-Math.sin(player.yaw) * Math.cos(player.pitch), Math.sin(player.pitch), -Math.cos(player.yaw) * Math.cos(player.pitch));
  const back = look.clone().negate().add(new THREE.Vector3(0, 0.34, 0)).normalize();
  const want = 9, tcam = rayWorld(G.world.colliders, pivot, back, want);
  camera.position.copy(pivot).addScaledVector(back, Math.max(2, Math.min(want, tcam - 0.4)));
  if (shake > 0.001) camera.position.add(tmpV.set((Math.random() - .5) * shake, (Math.random() - .5) * shake, 0));
  shake *= Math.exp(-dt * 6);
  camera.rotation.set(player.pitch, player.yaw, 0);
  const aimT = Math.min(rayWorld(G.world.colliders, camera.position, look, 300), 300);
  const aimPt = camera.position.clone().addScaledVector(look, aimT);
  const tp = aimPt.clone().sub(pivot); const aimPitch = Math.atan2(tp.y, Math.hypot(tp.x, tp.z));
  v.update(dt, { throttle: input.my, steer: input.mx, aimYaw: Math.atan2(-tp.x, -tp.z), aimPitch }, G.world.colliders, fx);
  A.engine(true, Math.abs(v.speed) / v.spec.speed, v.spec.type === 'hover');
  player.pos.set(v.pos.x, 0, v.pos.z); player.eye.copy(pivot); player.moving = Math.abs(v.speed) > 1;
  // zoom
  const fov = input.ads ? 45 : 70; camera.fov += (fov - camera.fov) * Math.min(1, dt * 8); camera.updateProjectionMatrix();
  // cannon
  if (input.fire && v.reloadT <= 0 && v.alive) {
    v.reloadT = v.spec.reload; G.shots++;
    const from = v.muzzle(new THREE.Vector3());
    const space = v.spec.type === 'rover' || v.spec.type === 'hover';
    launch(from, aimPt, { kind: 'shell', name: v.spec.cannon, dmg: 280, splash: 6, speed: space ? 110 : 140, tracer: v.spec.type === 'rover' ? 0x9cff60 : v.spec.type === 'hover' ? 0x00f0ff : 0xffc070 }, v.spec.type === 'rover' ? 0x9cff60 : 0xffd080);
    A.playCannon(0); shake = Math.max(shake, 0.25); fx.burst(from, 0xffc060, 16, 6, 0.3, 0.2); fx.burst(from, 0x777777, 14, 2, 1.0, -0.1);
    v.speed -= 0.8;
  }
  if (input.enter) { input.enter = false; exitVehicle(); return; }
  // roadkill
  if (Math.abs(v.speed) > 3) for (const e of G.enemies) if (e.alive && Math.hypot(e.pos.x - v.pos.x, e.pos.z - v.pos.z) < 2.8) damageEnemy(e, 999, false, 'Roadkill');
  $('ammo-veh').textContent = v.reloadT > 0 ? `RELOADING ${v.reloadT.toFixed(1)}s` : 'CANNON READY';
}

// ---------- player
function updatePlayer(dt) {
  pollMove();
  if (G.camp && !player.alive) { input.lookX = input.lookY = 0; input.enter = input.jump = false; camera.position.y = Math.max(player.pos.y + 0.4, camera.position.y - dt * 2); return; }
  const sens = camera.fov / 75;
  player.yaw -= input.lookX * sens; player.pitch -= input.lookY * sens; input.lookX = input.lookY = 0;
  player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch));
  const def = curW().def;
  const sprint = input.sprint && input.my > 0.3 && W.ads < 0.2;
  if (sprint && input.crouch) input.crouch = false;
  player.crouch = input.crouch;
  const speed = 6.2 * (sprint ? 1.45 : 1) * (1 - 0.45 * W.ads) * (def.mob || 1) * (player.crouch ? 0.55 : 1) * (G.camp ? G.camp.speedMul() : 1);
  const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  const fx_ = -sy * input.my + cy * input.mx, fz_ = -cy * input.my - sy * input.mx;
  const mag = Math.hypot(input.mx, input.my);
  player.moving = mag > 0.15;
  player.pos.x += fx_ * speed * dt; player.pos.z += fz_ * speed * dt;
  collide(G.world.colliders, player.pos, 0.4, player.pos.y);
  const v = G.vehicle;
  if (v) { const dx = player.pos.x - v.pos.x, dz = player.pos.z - v.pos.z, d = Math.hypot(dx, dz); if (d < 2.6 && d > 0.01 && player.pos.y < 2) { player.pos.x = v.pos.x + dx / d * 2.6; player.pos.z = v.pos.z + dz / d * 2.6; } }
  if (player.moving) player.bob += dt * speed * 1.6;
  const grav = G.era.gravity;
  if (input.jump && player.onGround) { player.vy = G.lowG ? 5.2 : 7.4; player.onGround = false; }
  input.jump = false;
  player.vy -= grav * dt; player.pos.y += player.vy * dt;
  const gnd = groundAt(G.world.colliders, player.pos.x, player.pos.z, 0.4, player.pos.y);
  if (player.pos.y <= gnd) { player.pos.y = gnd; player.vy = 0; player.onGround = true; } else player.onGround = player.pos.y - gnd < 0.02;
  if (G.camp) G.camp.constrainPlayer();
  player.recoil *= Math.exp(-dt * 7);
  shake *= Math.exp(-dt * 6);
  player.eyeH += ((player.crouch ? 1.0 : 1.6) - player.eyeH) * Math.min(1, dt * 12);
  player.eye.set(player.pos.x, player.pos.y + player.eyeH, player.pos.z);
  camera.position.copy(player.eye); camera.position.y += player.eyeOff || 0;
  camera.position.y += Math.abs(Math.cos(player.bob)) * 0.04 * (player.moving && player.onGround ? 1 : 0) * (1 - W.ads);
  if (shake > 0.001) camera.position.add(tmpV.set((Math.random() - .5) * shake, (Math.random() - .5) * shake, 0));
  camera.rotation.set(player.pitch + player.recoil, player.yaw, 0);
  if (player.alive && G.time - player.lastHit > 4.5 && player.hp < player.maxHp) { player.hp = Math.min(player.maxHp, player.hp + 14 * dt); hudHp(); }
  if (G.camp) {
    const u = G.camp.use;
    $('prompt').classList.toggle('on', !!u); document.body.classList.toggle('nearveh', !!u);
    if (u) $('prompt').textContent = `${isTouch ? 'Tap USE' : 'Press E'} — ${u.text}`;
    if (input.enter) { input.enter = false; if (u) G.camp.onUse(); }
    return;
  }
  // vehicle prompt / enter
  const near = nearVehicle();
  $('prompt').classList.toggle('on', near); document.body.classList.toggle('nearveh', near);
  if (near) $('prompt').textContent = `${isTouch ? 'Tap ENTER' : 'Press E'} — ${G.vehicle.spec.name}`;
  if (input.enter) { input.enter = false; if (near) enterVehicle(); }
}

function hurtPlayer(dmg, from) {
  if (G.god || !player.alive) return;
  player.hp -= dmg; player.lastHit = G.time; A.playHurt();
  const v = $('dmg'); v.style.opacity = Math.min(0.9, 0.35 + (player.maxHp - player.hp) / 160); clearTimeout(v._t); v._t = setTimeout(() => v.style.opacity = 0, 260);
  if (from) {
    const ang = Math.atan2(from.x - player.pos.x, from.z - player.pos.z), rel = ang - (player.yaw + Math.PI);
    const di = $('dmgdir'); di.style.transform = `rotate(${-rel}rad)`; di.classList.remove('on'); void di.offsetWidth; di.classList.add('on');
  }
  hudHp();
  if (player.hp <= 0) { player.hp = 0; hudHp(); if (G.camp) G.camp.onPlayerDeath(); else gameOver(); }
}

function onEnemyShot(e, muzzle, end, hit, dist) {
  fx.tracer(muzzle, end, G.era.tracer, 0.03, 0.08);
  A.playEnemyShot(G.era.primaries[0].sfx, dist);
  if (!hit || !player.alive) return;
  const dmg = G.era.enemyDmg * (1 + Math.min(0.5, (G.wave - 1) * 0.03));
  if (G.inVeh) { fx.burst(end, 0xffe0a0, 4, 3, 0.25); damageVehicle(dmg * 1.1); return; }
  hurtPlayer(dmg, e.pos);
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
  const w = curW(); if (!w) return;
  $('mag').textContent = w.mag; $('res').textContent = ' / ' + w.reserve; $('wname').textContent = w.def.name;
  $('mag').classList.toggle('low', w.mag <= Math.ceil(w.def.mag * 0.25));
}
function hudNades() {
  const l = G.nades.lethal, t = G.nades.tac;
  $('nades').innerHTML = `<span title="${G.lethal ? G.lethal.name : ''}">💣 ${l}</span><span title="${G.tactical ? G.tactical.name : ''}">${G.tactical && G.tactical.id === 'flash' ? '✷' : '☁'} ${t}</span>`;
  $('b-nade').innerHTML = `💣<small>${l}</small>`; $('b-tac').innerHTML = `${G.tactical && G.tactical.id === 'flash' ? '✷' : '☁'}<small>${t}</small>`;
  $('b-nade').classList.toggle('empty', l <= 0); $('b-tac').classList.toggle('empty', t <= 0);
}
function hudHp() {
  if (G.inVeh && G.vehicle) { const v = G.vehicle, h = Math.max(0, Math.round(v.hp)); $('hpfill').style.width = (100 * h / v.spec.hp) + '%'; $('hptext').textContent = h; $('hplbl').textContent = 'HULL'; $('hpfill').classList.toggle('low', h < v.spec.hp * 0.3); return; }
  const h = Math.max(0, Math.round(player.hp)); $('hpfill').style.width = (100 * h / player.maxHp) + '%'; $('hptext').textContent = h; $('hplbl').textContent = 'HP'; $('hpfill').classList.toggle('low', h < 35);
}
function hudAll() {
  hudAmmo(); hudHp(); hudNades();
  $('wave').textContent = G.wave ? 'WAVE ' + G.wave : 'WAVE —'; $('score').textContent = G.score;
  $('era-tag').textContent = G.era.name.toUpperCase();
  $('slots').innerHTML = W.list.map((w, i) => `<span class="${i === W.cur ? 'cur' : ''}">${i + 1} ${w.def.name}</span>`).join('');
  $('b-enter').textContent = G.camp ? 'USE' : G.inVeh ? 'EXIT' : 'ENTER';
  if (G.inVeh) $('wname').textContent = G.vehicle.spec.cannon;
}
function hudTick(dt) {
  if (!G.camp) { const left = G.toSpawn + aliveCount(); $('enemies').textContent = G.interT > 0 ? `NEXT WAVE ${Math.ceil(G.interT)}` : `HOSTILES ${left}`; }
  const r = W.reloadT > 0 && !G.inVeh; $('reloadbar').classList.toggle('on', r); if (r) $('reloadfill').style.width = (100 * (1 - W.reloadT / curW().def.reload)) + '%';
  if (msgT > 0) { msgT -= dt; if (msgT <= 0) $('center-msg').classList.remove('on'); }
  if (G.inVeh) { $('crosshair').style.setProperty('--gap', '10px'); $('crosshair').style.opacity = 1; hudHp(); return; }
  const spread = curSpread(curW().def);
  $('crosshair').style.setProperty('--gap', (6 + spread * 7 + W.kick * 6) + 'px');
  $('crosshair').style.opacity = 1 - W.ads * 0.7;
  const w = curW(); if (w.mag === 0 && w.reserve === 0) $('center-msg').classList.add('on'), $('center-msg').textContent = 'OUT OF AMMO — SWAP WEAPON', msgT = 0.2;
}

// ---------- main loop
const clock = new THREE.Clock();
let frameAcc = 0, frameN = 0, titleT = 0;
function portraitBlock() { return isTouch && innerHeight > innerWidth; }
function setTarget() {
  if (G.inVeh && G.vehicle) { G.tgtPos = G.vehicle.pos; G.tgtEye = G.vehicle.pivot(G._tgtEye || (G._tgtEye = new THREE.Vector3())); }
  else { G.tgtPos = player.pos; G.tgtEye = player.eye; }
}
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (G.state === 'play' && !portraitBlock()) {
    G.time += dt;
    if (G.camp) { updatePlayer(dt); updateWeapons(dt); }
    else if (G.inVeh) { updateVehicle(dt); if (!G.inVeh) updatePlayer(0); }
    else { updatePlayer(dt); updateWeapons(dt); updateVehicle(dt); }
    setTarget();
    for (const e of G.enemies) e.update(dt, G);
    G.grenades.update(dt, G);
    updateProjectiles(dt);
    if (G.camp) G.camp.update(dt); else updateWaves(dt);
    hudTick(dt);
  } else if (G.state === 'complete' && G.camp) {
    G.camp.updateSea(dt); G.camp.updateFx(dt);
    player.yaw += dt * 0.05; camera.rotation.set(-0.05, player.yaw, 0);
  } else if (G.state === 'title' || G.state === 'menu' || (G.state === 'loadout' && G.loFrom === 'title')) {
    titleT += dt * 0.08;
    camera.position.set(Math.cos(titleT) * 30, 14, Math.sin(titleT) * 30); camera.lookAt(0, 2, 0);
    if (camera.fov !== 75) { camera.fov = 75; camera.updateProjectionMatrix(); }
  } else if (G.state === 'over') {
    setTarget(); for (const e of G.enemies) e.update(dt, G);
    G.grenades.update(dt, G);
    camera.position.y = Math.max(player.pos.y + 0.4, camera.position.y - dt * 2); camera.rotation.z = Math.min(0.5, camera.rotation.z + dt);
  }
  fx.update(dt);
  renderer.info.reset();
  renderer.clear();
  renderer.render(scene, camera);
  if ((G.state === 'play' || G.state === 'paused') && !G.inVeh && !document.body.classList.contains('scoped')) { renderer.clearDepth(); renderer.render(vmScene, vmCam); }
  if (G.state === 'loadout' && pvGun) {
    const r = $('lo-preview').getBoundingClientRect();
    if (r.width > 10 && r.height > 10) {
      pvGun.rotation.y = Math.sin(performance.now() * 0.0006) * 0.6 + Math.PI * 0.5; pvGun.rotation.x = 0.08;
      pvCam.aspect = r.width / r.height; pvCam.updateProjectionMatrix();
      renderer.setScissorTest(true); renderer.setScissor(r.left, innerHeight - r.bottom, r.width, r.height); renderer.setViewport(r.left, innerHeight - r.bottom, r.width, r.height);
      renderer.setClearColor(0x39404a, 1); renderer.clear(); renderer.render(pvScene, pvCam); renderer.setClearColor(0x000000, 1);
      renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight);
    }
  }
  frameAcc += dt; frameN++;
  if (frameAcc > 2.5) { const avg = frameAcc / frameN; if (avg > 0.024 && pixelRatio > 1) { pixelRatio = Math.max(1, pixelRatio - 0.25); renderer.setPixelRatio(pixelRatio); resize(); } frameAcc = 0; frameN = 0; }
}

// ---------- boot
preview('ww2'); buildTitle(); $('loading').remove(); loop();
window.AOE = {
  G, W, player, startGame, toTitle, showLoadout, renderer, input, god: (on = true) => (G.god = on),
  startCampaign, showCampaign, showBriefing, campSkip: () => G.camp && G.camp.skip(), camp: () => G.camp && { phase: G.camp.phase, t: G.camp.t, deaths: G.camp.deaths, use: G.camp.use, obj: G.camp.obj, inBoat: G.camp.inBoat, boatZ: G.camp.boatZ, done: G.camp.done },
  enterVehicle: () => { if (G.vehicle) { player.pos.set(G.vehicle.pos.x + 3, 0, G.vehicle.pos.z); enterVehicle(); } }, exitVehicle: () => exitVehicle(),
  info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, pr: pixelRatio, world: G.world && G.world.drawInfo }),
};
