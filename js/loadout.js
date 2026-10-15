// Loadout data (attachments, grenades, gear), stat computation, persistence and the menu UI.
import { ERAS } from './eras.js';

const SCI = (k) => k === 'future' || k === 'space';

export function opticsFor(eraKey, def) {
  const n = {
    ww2: [['iron', 'Iron Sights'], ['2x', 'M73 2.5x Scope'], ['4x', 'ZF4 4x Scope']],
    cold: [['iron', 'Iron Sights'], ['dot', 'Collimator Sight'], ['4x', 'PSO-1 4x Scope'], ['8x', 'ART 8x Scope']],
    modern: [['iron', 'Iron Sights'], ['dot', 'Red Dot'], ['holo', 'Holographic'], ['4x', '4x ACOG'], ['8x', '8x Sniper Scope']],
    future: [['iron', 'Holo-Iron'], ['dot', 'Smart Dot'], ['holo', 'Holo Mk.III'], ['4x', 'Digital 4x'], ['8x', 'Digital 8x']],
    space: [['iron', 'Suit Reticle'], ['dot', 'Target Dot'], ['holo', 'Holo HUD'], ['4x', 'Digital 4x'], ['8x', 'Long-range 8x']],
  }[eraKey];
  const base = { iron: {}, dot: { zoom: 0.72, ads: 1.0, mesh: 'dot' }, holo: { zoom: 0.68, ads: 0.97, mesh: 'holo' }, '2x': { zoom: 0.5, ads: 0.9, mesh: 'scope2' }, '4x': { zoom: 0.3, scope: true, ads: 0.8, mob: 0.98, mesh: 'scope4' }, '8x': { zoom: 0.17, scope: true, ads: 0.7, mob: 0.96, mesh: 'scope8' } };
  let list = n.map(([id, name]) => ({ id, name, ...base[id] }));
  const pistol = def.model === 'pistol', launcher = def.cls === 'Launcher', shotgun = def.cls === 'Shotgun';
  if (pistol || launcher || shotgun) list = list.filter(o => !o.scope && o.id !== '2x');
  if (def.builtinScope) list = list.filter(o => o.scope);
  for (const o of list) o.desc = o.id === 'iron' ? 'Default sights' : o.scope ? `${Math.round(1 / o.zoom)}x zoom · scope overlay · slower ADS` : `${(1 / o.zoom).toFixed(1)}x zoom · clear reticle`;
  return list;
}
export function muzzlesFor(eraKey, def) {
  const s = SCI(eraKey);
  let l = [
    { id: 'none', name: 'Standard', desc: 'No muzzle device' },
    { id: 'supp', name: s ? 'Signal Dampener' : 'Suppressor', desc: 'Much quieter · −25% range · −8% damage', mesh: 'supp' },
    { id: 'comp', name: s ? 'Recoil Vectoring' : 'Compensator', desc: '−25% recoil · +10% spread', mesh: 'comp' },
    { id: 'flash', name: s ? 'Flare Shroud' : 'Flash Hider', desc: 'No muzzle flash · −10% recoil', mesh: 'flash' },
  ];
  if (def.cls === 'Launcher' || def.kind === 'beam' || def.kind === 'rail' || def.kind === 'plasma') l = l.filter(o => o.id !== 'flash');
  if (def.cls === 'Launcher') l = l.slice(0, 1);
  return l;
}
export function undersFor(eraKey, def) {
  let l = [
    { id: 'none', name: 'None', desc: 'Nothing mounted' },
    { id: 'grip', name: eraKey === 'ww2' ? 'Foregrip' : 'Vertical Grip', desc: '−30% recoil · −3% mobility', mesh: 'grip' },
    { id: 'bipod', name: 'Bipod', desc: '−50% recoil while aiming · −8% mobility', mesh: 'bipod' },
    { id: 'laser', name: SCI(eraKey) ? 'Target Laser' : 'Laser Sight', desc: '−40% hip-fire spread · +15% ADS speed', mesh: 'laser' },
  ];
  if (eraKey === 'ww2') l = l.filter(o => o.id !== 'laser');
  if (def.model === 'pistol') l = l.filter(o => o.id === 'none' || o.id === 'laser');
  return l;
}
export function magsFor(eraKey, def) {
  return [
    { id: 'std', name: 'Standard', desc: `${def.mag} rounds` },
    { id: 'ext', name: SCI(eraKey) ? 'Extended Cell' : 'Extended Mag', desc: `+50% capacity (${Math.round(def.mag * 1.5)}) · +25% reload time · −3% mobility`, mesh: 'ext' },
    { id: 'fast', name: SCI(eraKey) ? 'Quick-swap Cell' : 'Fast Mag', desc: '−30% reload time', mesh: 'fast' },
  ];
}
export const SLOTS = [['optic', 'Optic', opticsFor], ['muzzle', 'Muzzle', muzzlesFor], ['under', 'Underbarrel', undersFor], ['mag', 'Magazine', magsFor]];

export function lethalsFor(eraKey) {
  const n = ERAS[eraKey].lethals;
  const info = {
    frag: { desc: 'Bounces · 2.4 s fuse · 7 m blast', fuse: 2.4, radius: 7, dmg: 170, color: 0x4a5a3a },
    sticky: { desc: 'Sticks to surfaces & enemies · 2 s fuse', fuse: 2.0, radius: 6, dmg: 170, sticky: true, color: 0xb03030 },
    impact: { desc: 'Explodes on contact · 5.5 m blast', fuse: 5, radius: 5.5, dmg: 150, impact: true, color: 0x8a6a30 },
    plasma: { desc: 'Sticky plasma · 2.2 s fuse · 8 m blast', fuse: 2.2, radius: 8, dmg: 190, sticky: true, color: 0x60ff40, glow: true },
  };
  return Object.entries(n).map(([id, name]) => ({ id, name, ...info[id] }));
}
export function tacticalsFor(eraKey) {
  const n = ERAS[eraKey].tacticals;
  return [
    { id: 'smoke', name: n.smoke, desc: 'Smoke cloud for ~14 s · blocks enemy sight', fuse: 1.2, color: 0x9a9a9a },
    { id: 'flash', name: n.flash, desc: 'Stuns enemies in sight for ~3 s', fuse: 1.4, color: 0x707878 },
  ];
}
export function gearFor(eraKey) {
  return [
    { id: 'none', name: 'Standard Kit', desc: 'No perk' },
    { id: 'armor', name: ERAS[eraKey].armorName, desc: '+35 max HP · −5% mobility' },
    { id: 'nades', name: 'Grenadier Pouch', desc: '+1 lethal & +1 tactical' },
    { id: 'ammo', name: 'Bandolier', desc: '+50% reserve ammo' },
    { id: 'light', name: 'Lightweight', desc: '+10% move speed · faster ADS' },
  ];
}

// ---------- persistence
const KEY = (k) => 'aoe-loadout-v2-' + k;
export function getLoadout(eraKey) {
  const e = ERAS[eraKey];
  let lo = null; try { lo = JSON.parse(localStorage.getItem(KEY(eraKey))); } catch (x) {}
  lo = lo || {};
  if (!e.primaries.find(w => w.id === lo.p)) lo.p = e.primaries[0].id;
  if (!e.secondaries.find(w => w.id === lo.s)) lo.s = e.secondaries[0].id;
  lo.att = lo.att || {};
  if (!lethalsFor(eraKey).find(x => x.id === lo.lethal)) lo.lethal = lethalsFor(eraKey)[0].id;
  if (!tacticalsFor(eraKey).find(x => x.id === lo.tactical)) lo.tactical = 'smoke';
  if (!gearFor(eraKey).find(x => x.id === lo.gear)) lo.gear = 'none';
  return lo;
}
export function saveLoadout(eraKey, lo) { try { localStorage.setItem(KEY(eraKey), JSON.stringify(lo)); } catch (x) {} }
export function weaponById(eraKey, id) { const e = ERAS[eraKey]; return e.primaries.find(w => w.id === id) || e.secondaries.find(w => w.id === id); }
export function attFor(eraKey, lo, def) {
  const a = { ...(lo.att[def.id] || {}) };
  for (const [slot, , fn] of SLOTS) { const l = fn(eraKey, def); if (!l.find(o => o.id === a[slot])) a[slot] = slot === 'optic' ? (def.defOptic && l.find(o => o.id === def.defOptic) ? def.defOptic : l[0].id) : l[0].id; }
  return a;
}

// ---------- effective stats
export function effStats(eraKey, def, att, gear = 'none') {
  const s = { ...def, base: def };
  const opt = opticsFor(eraKey, def).find(o => o.id === att.optic) || {};
  s.att = att;
  s.zoom = opt.zoom || def.zoom; s.scope = !!opt.scope; s.optic = opt;
  s.adsSpeed = opt.ads || 1; s.mob = (def.slow || 1) * (opt.mob || 1);
  s.recoilMul = 1; s.spreadMul = 1; s.hipMul = 1; s.vol = 1; s.lowpass = 0; s.flashScale = 1; s.range = def.range; s.bipod = false;
  if (att.muzzle === 'supp') { s.vol = 0.32; s.lowpass = 1600; s.range *= 0.75; s.dmg *= 0.92; s.flashScale = 0.15; }
  if (att.muzzle === 'comp') { s.recoilMul *= 0.75; s.spreadMul *= 1.1; }
  if (att.muzzle === 'flash') { s.flashScale = 0; s.recoilMul *= 0.9; }
  if (att.under === 'grip') { s.recoilMul *= 0.7; s.mob *= 0.97; }
  if (att.under === 'bipod') { s.bipod = true; s.mob *= 0.92; }
  if (att.under === 'laser') { s.hipMul *= 0.6; s.adsSpeed *= 1.15; }
  if (att.mag === 'ext') { s.mag = Math.round(def.mag * 1.5); s.reload *= 1.25; s.mob *= 0.97; }
  if (att.mag === 'fast') s.reload *= 0.7;
  if (gear === 'ammo') s.reserve = Math.round(def.reserve * 1.5);
  if (gear === 'light') { s.mob *= 1.1; s.adsSpeed *= 1.15; }
  if (gear === 'armor') s.mob *= 0.95;
  return s;
}
export function bars(s) {
  const c = (x) => Math.max(0.03, Math.min(1, x));
  return {
    Damage: c(Math.sqrt(s.dmg * (s.pellets || 1) / 220)),
    'Fire rate': c(s.rpm / 1200),
    Range: c(s.range / 160),
    'Recoil ctrl': c(1 - (s.recoil * s.recoilMul * (s.bipod ? 0.75 : 1)) / 0.1),
    Mobility: c(((s.mob || 1) * 0.8 + (s.adsSpeed || 1) * 0.2 - 0.6) / 0.55),
  };
}

// ---------- UI
const $ = (id) => document.getElementById(id);
let ui = null;

export function openLoadout(eraKey, opts) {
  const e = ERAS[eraKey];
  const lo = getLoadout(eraKey);
  ui = { eraKey, lo, tab: 'p', opts };
  $('lo-era').textContent = `${e.name.toUpperCase()} · ${e.year}`;
  $('lo-deploy').textContent = opts.deployLabel || 'DEPLOY ▶';
  $('lo-back').onclick = () => { saveLoadout(eraKey, lo); opts.onBack(); };
  $('lo-deploy').onclick = () => { saveLoadout(eraKey, lo); opts.onDeploy(lo); };
  render();
}

function chip(label, desc, on, fn, extra = '') {
  const b = document.createElement('button'); b.className = 'chip' + (on ? ' on' : '') + extra;
  b.innerHTML = `<b>${label}</b><i>${desc}</i>`; b.onclick = fn; return b;
}

function render() {
  const { eraKey, lo } = ui, e = ERAS[eraKey];
  const tabs = $('lo-tabs'); tabs.innerHTML = '';
  const lethal = lethalsFor(eraKey).find(x => x.id === lo.lethal), tac = tacticalsFor(eraKey).find(x => x.id === lo.tactical), gear = gearFor(eraKey).find(x => x.id === lo.gear);
  const T = [['p', 'Primary', weaponById(eraKey, lo.p).name], ['s', 'Secondary', weaponById(eraKey, lo.s).name], ['l', 'Lethal', lethal.name], ['t', 'Tactical', tac.name], ['g', 'Gear', gear.name]];
  for (const [id, label, val] of T) {
    const b = document.createElement('button'); b.className = 'tab' + (ui.tab === id ? ' on' : ''); b.dataset.tab = id;
    b.innerHTML = `<small>${label}</small><b>${val}</b>`; b.onclick = () => { ui.tab = id; render(); }; tabs.appendChild(b);
  }
  const box = $('lo-opts'); const keepScroll = box.dataset.tab === ui.tab ? box.scrollTop : 0; box.innerHTML = ''; box.dataset.tab = ui.tab;
  const sec = (title) => { const h = document.createElement('h4'); h.textContent = title; box.appendChild(h); const d = document.createElement('div'); d.className = 'chips'; box.appendChild(d); return d; };
  const wDef = weaponById(eraKey, ui.tab === 's' ? lo.s : lo.p);
  if (ui.tab === 'p' || ui.tab === 's') {
    const pool = ui.tab === 'p' ? e.primaries : e.secondaries;
    const wl = sec(ui.tab === 'p' ? 'Primary weapon' : 'Sidearm');
    for (const w of pool) wl.appendChild(chip(w.name, `${w.cls} · ${w.mag} rds · ${w.rpm} rpm`, w.id === wDef.id, () => { if (ui.tab === 'p') lo.p = w.id; else lo.s = w.id; saveLoadout(eraKey, lo); render(); }, ' wpn'));
    const att = attFor(eraKey, lo, wDef);
    for (const [slot, label, fn] of SLOTS) {
      const list = fn(eraKey, wDef); const c = sec(label);
      for (const o of list) c.appendChild(chip(o.name, o.desc, att[slot] === o.id, () => { lo.att[wDef.id] = { ...att, [slot]: o.id }; saveLoadout(eraKey, lo); render(); }, ' att'));
    }
  } else if (ui.tab === 'l') { const c = sec('Lethal grenade (2 per life, refilled each wave)'); for (const o of lethalsFor(eraKey)) c.appendChild(chip(o.name, o.desc, lo.lethal === o.id, () => { lo.lethal = o.id; saveLoadout(eraKey, lo); render(); })); }
  else if (ui.tab === 't') { const c = sec('Tactical grenade (2 per life, refilled each wave)'); for (const o of tacticalsFor(eraKey)) c.appendChild(chip(o.name, o.desc, lo.tactical === o.id, () => { lo.tactical = o.id; saveLoadout(eraKey, lo); render(); })); }
  else { const c = sec('Armor / gear perk'); for (const o of gearFor(eraKey)) c.appendChild(chip(o.name, o.desc, lo.gear === o.id, () => { lo.gear = o.id; saveLoadout(eraKey, lo); render(); })); }
  box.scrollTop = keepScroll;
  // stats panel
  const att = attFor(eraKey, lo, wDef);
  const base = effStats(eraKey, wDef, attFor(eraKey, { att: {} }, wDef), 'none'), cur = effStats(eraKey, wDef, att, lo.gear);
  const bb = bars(base), bc = bars(cur);
  $('lo-wname').innerHTML = `<b>${wDef.name}</b> <small>${wDef.cls}</small>`;
  $('lo-stats').innerHTML = Object.keys(bc).map(k => {
    const b = bb[k] * 100, c = bc[k] * 100, lo_ = Math.min(b, c);
    return `<div class="stat"><span>${k}</span><div class="bar"><i class="cur" style="width:${lo_}%"></i>${c > b + 0.5 ? `<i class="up" style="left:${b}%;width:${c - b}%"></i>` : ''}${c < b - 0.5 ? `<i class="down" style="left:${c}%;width:${b - c}%"></i>` : ''}</div></div>`;
  }).join('') + `<p class="nums">${Math.round(cur.dmg)}${cur.pellets ? '×' + cur.pellets : ''} dmg · ${cur.rpm} rpm · ${cur.mag} mag · ${cur.reload.toFixed(1)}s reload · ${(1 / cur.zoom).toFixed(1)}x ADS${cur.vol < 1 ? ' · suppressed' : ''}</p>`;
  if (ui.opts.onPreview) ui.opts.onPreview(wDef, att);
}
