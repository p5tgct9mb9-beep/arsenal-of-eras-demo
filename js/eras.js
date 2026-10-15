// Era definitions: arena look, physics and 3-weapon loadouts.
// spread = degrees of cone (hip), rpm = rounds per minute, reload = seconds.
// sfx describes the WebAudio synth recipe used in audio.js.

export const ERAS = {
  ww2: {
    name: 'World War II', year: '1944', tag: 'Ruined Normandy village',
    sky: [0x8e8a80, 0xc9bda2], fog: 0xb1a68f, fogNear: 25, fogFar: 120,
    ground: [0x4f5233, 0x6b5d3c], hemi: [0xd8cdb4, 0x4a4535, 0.95], sun: [0xffe0b0, 0.9],
    gravity: 20, theme: 'ww2', stars: 0,
    buildingColors: [0x8b7d6b, 0x9a8a73, 0x7a6552, 0x6f6458], windowColor: 0x2a241e,
    enemy: { body: 0x5c6150, legs: 0x4b4f40, head: 0x4a5040, skin: 0xc49a7a, accent: 0x2b2b25, visor: null },
    enemyName: 'Grenadier', enemyDmg: 9, tracer: 0xffd890,
    weapons: [
      { id: 'garand', name: 'M1 Garand', model: 'garand', kind: 'bullet', auto: false, rpm: 320, dmg: 58, mag: 8, reserve: 64, spread: 0.5, reload: 2.1, recoil: 0.035, zoom: 0.8, ping: true,
        sfx: { t: 'gun', f: 2200, decay: 0.22, thump: 95, gain: 1.0 } },
      { id: 'thompson', name: 'Thompson M1A1', model: 'thompson', kind: 'bullet', auto: true, rpm: 720, dmg: 21, mag: 30, reserve: 180, spread: 2.2, reload: 2.4, recoil: 0.012, zoom: 0.85,
        sfx: { t: 'gun', f: 1400, decay: 0.12, thump: 120, gain: 0.75 } },
      { id: 'mg42', name: 'MG 42', model: 'mg42', kind: 'bullet', auto: true, rpm: 1200, dmg: 24, mag: 75, reserve: 225, spread: 3.0, reload: 4.4, recoil: 0.011, zoom: 0.85, slow: 0.82,
        sfx: { t: 'gun', f: 2600, decay: 0.09, thump: 100, gain: 0.7 } },
    ],
  },
  cold: {
    name: 'Cold War', year: '1983', tag: 'Frozen border checkpoint',
    sky: [0x5d6b7a, 0xb4bec6], fog: 0xaab4bc, fogNear: 18, fogFar: 95,
    ground: [0xc9d0d4, 0x9aa3a6], hemi: [0xdfe8f0, 0x6b6f72, 0.95], sun: [0xdbe6ff, 0.65],
    gravity: 20, theme: 'cold', stars: 0,
    buildingColors: [0x8a8d8f, 0x6f7477, 0x8c5b48, 0x7a7f6a], windowColor: 0x23272b,
    enemy: { body: 0x55603f, legs: 0x47503a, head: 0x3d4530, skin: 0xd2a98a, accent: 0x7a1f1f, visor: null },
    enemyName: 'Spetsnaz', enemyDmg: 10, tracer: 0xffb070,
    weapons: [
      { id: 'ak47', name: 'AK-47', model: 'ak47', kind: 'bullet', auto: true, rpm: 600, dmg: 31, mag: 30, reserve: 150, spread: 2.0, reload: 2.5, recoil: 0.018, zoom: 0.82,
        sfx: { t: 'gun', f: 1700, decay: 0.15, thump: 85, gain: 0.9 } },
      { id: 'm16a1', name: 'M16A1', model: 'm16a1', kind: 'bullet', auto: true, rpm: 750, dmg: 25, mag: 20, reserve: 160, spread: 1.3, reload: 2.2, recoil: 0.012, zoom: 0.78,
        sfx: { t: 'gun', f: 3000, decay: 0.11, thump: 110, gain: 0.8 } },
      { id: 'svd', name: 'Dragunov SVD', model: 'svd', kind: 'bullet', auto: false, rpm: 170, dmg: 90, mag: 10, reserve: 50, spread: 0.15, reload: 2.6, recoil: 0.05, zoom: 0.3, scope: true, pierce: 1,
        sfx: { t: 'gun', f: 2400, decay: 0.3, thump: 70, gain: 1.0 } },
    ],
  },
  modern: {
    name: 'Modern', year: '2026', tag: 'Desert port district',
    sky: [0x5f9bd6, 0xe9d7b0], fog: 0xe0cfa8, fogNear: 30, fogFar: 140,
    ground: [0xc7a873, 0xa98c5c], hemi: [0xfff1d6, 0x8a7350, 1.0], sun: [0xfff3dc, 1.1],
    gravity: 20, theme: 'modern', stars: 0,
    buildingColors: [0xd9c49b, 0xc8b089, 0xb89f78, 0xe1d3b4], windowColor: 0x2b2a28,
    enemy: { body: 0x9a8a64, legs: 0x7d6f50, head: 0x5d5a48, skin: 0xb48a6a, accent: 0x222222, visor: 0x111111 },
    enemyName: 'Insurgent', enemyDmg: 11, tracer: 0xfff0a0,
    weapons: [
      { id: 'm4a1', name: 'M4A1', model: 'm4a1', kind: 'bullet', auto: true, rpm: 800, dmg: 25, mag: 30, reserve: 180, spread: 1.4, reload: 2.1, recoil: 0.011, zoom: 0.75,
        sfx: { t: 'gun', f: 2800, decay: 0.11, thump: 115, gain: 0.8 } },
      { id: 'hk416', name: 'HK416', model: 'hk416', kind: 'bullet', auto: true, rpm: 850, dmg: 27, mag: 30, reserve: 180, spread: 1.2, reload: 2.3, recoil: 0.012, zoom: 0.72,
        sfx: { t: 'gun', f: 2500, decay: 0.12, thump: 105, gain: 0.82 } },
      { id: 'barrett', name: 'Barrett M82', model: 'barrett', kind: 'bullet', auto: false, rpm: 95, dmg: 160, mag: 10, reserve: 30, spread: 0.1, reload: 3.2, recoil: 0.09, zoom: 0.22, scope: true, pierce: 3, slow: 0.85,
        sfx: { t: 'gun', f: 1500, decay: 0.45, thump: 55, gain: 1.15 } },
    ],
  },
  future: {
    name: 'Futuristic', year: '2089', tag: 'Neon megacity plaza',
    sky: [0x07040f, 0x3a1450], fog: 0x1a0b2a, fogNear: 15, fogFar: 95,
    ground: [0x15161d, 0x22232c], hemi: [0x8a7cff, 0x101018, 0.8], sun: [0x66e0ff, 0.55],
    gravity: 18, theme: 'future', stars: 300,
    buildingColors: [0x23252f, 0x1b1d26, 0x2c2f3b, 0x30283a], windowColor: 0x0d0e14, neon: [0x00f0ff, 0xff2bd6, 0x8cff3a, 0xffb000],
    enemy: { body: 0x23262e, legs: 0x1a1c22, head: 0x2b2f38, skin: 0x2b2f38, accent: 0xff2bd6, visor: 0xff2bd6 },
    enemyName: 'Synth Trooper', enemyDmg: 12, tracer: 0xff40e0,
    weapons: [
      { id: 'smart', name: 'Smart Rifle', model: 'smart', kind: 'bullet', smart: true, auto: true, rpm: 660, dmg: 22, mag: 40, reserve: 200, spread: 1.4, reload: 2.0, recoil: 0.009, zoom: 0.75, tracer: 0x00f0ff,
        sfx: { t: 'smart', f: 3600, decay: 0.08, thump: 160, gain: 0.7 } },
      { id: 'railgun', name: 'Handheld Railgun', model: 'railgun', kind: 'rail', auto: false, rpm: 55, dmg: 220, mag: 4, reserve: 24, spread: 0.05, reload: 2.8, recoil: 0.08, zoom: 0.4, pierce: 8, tracer: 0x66ccff,
        sfx: { t: 'rail' } },
      { id: 'laser', name: 'Laser Rifle', model: 'laser', kind: 'beam', auto: true, rpm: 900, dmg: 12, mag: 100, reserve: 300, spread: 0.3, reload: 2.4, recoil: 0.002, zoom: 0.7, tracer: 0xff3030,
        sfx: { t: 'laser' } },
    ],
  },
  space: {
    name: 'Space', year: '2240', tag: 'Lunar outpost — low gravity',
    sky: [0x000000, 0x05060c], fog: 0x05060c, fogNear: 60, fogFar: 200,
    ground: [0x8d8d8f, 0x6e6e72], hemi: [0x9aa4c0, 0x202024, 0.55], sun: [0xffffff, 1.4],
    gravity: 5.2, theme: 'space', stars: 1600, planet: true,
    buildingColors: [0xe8e8ec, 0xd0d3da, 0xb7bcc6, 0xf0ece0], windowColor: 0x1b2a44, neon: [0x40a0ff, 0xffa030],
    enemy: { body: 0xd8d8dc, legs: 0xb0b0b8, head: 0xe6e6ea, skin: 0xe6e6ea, accent: 0xff7a00, visor: 0xffb000 },
    enemyName: 'Void Marine', enemyDmg: 12, tracer: 0x9cff60,
    weapons: [
      { id: 'plasma', name: 'Plasma Rifle', model: 'plasma', kind: 'plasma', auto: true, rpm: 450, dmg: 34, mag: 36, reserve: 180, spread: 0.9, reload: 2.2, recoil: 0.01, zoom: 0.75, speed: 70, splash: 1.4, adsX: 0.05, tracer: 0x80ff40,
        sfx: { t: 'plasma' } },
      { id: 'coilgun', name: 'Coilgun', model: 'coilgun', kind: 'rail', auto: false, rpm: 130, dmg: 115, mag: 8, reserve: 48, spread: 0.1, reload: 2.5, recoil: 0.05, zoom: 0.45, pierce: 2, tracer: 0x60d0ff,
        sfx: { t: 'coil' } },
      { id: 'missile', name: 'Micro-missile Launcher', model: 'missile', kind: 'missile', auto: false, rpm: 160, dmg: 110, mag: 6, reserve: 30, spread: 0.6, reload: 3.0, recoil: 0.06, zoom: 0.8, speed: 32, splash: 4.2, adsX: 0.09, tracer: 0xffa040,
        sfx: { t: 'missile' } },
    ],
  },
};

export const ERA_ORDER = ['ww2', 'cold', 'modern', 'future', 'space'];
