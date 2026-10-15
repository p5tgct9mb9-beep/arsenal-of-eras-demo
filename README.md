# Arsenal of Eras — Prototype Demo (browser)

A small, playable **browser FPS prototype** for *Arsenal of Eras*, a Battlefield-style military shooter that spans five eras of warfare, by solo dev **LT Vasquez**.

> **This is a prototype / pitch demo, not the final game.** The full *Arsenal of Eras* is planned for Unreal Engine 5. This web build exists to try out the era/loadout idea quickly on any device, including phones.

**Play:** https://p5tgct9mb9-beep.github.io/arsenal-of-eras-demo/

## What's in the demo

- **Wave survival** against enemy bots. They run at you, strafe, and shoot back. Their hit chance drops with distance and when you're moving. Each wave adds more bots, and they get tougher.
- **Five eras.** Each one has its own arena look (sky, fog, lighting, props), its own enemies and its own 3-weapon loadout:

| Era | Arena | Loadout |
|---|---|---|
| World War II (1944) | Ruined Normandy village, sandbags, hedgehogs | M1 Garand (with the *ping*), Thompson, MG 42 |
| Cold War (1983) | Frozen border checkpoint, concrete & bunkers | AK-47, M16A1, Dragunov SVD (scoped) |
| Modern (2026) | Desert port, shipping containers, HESCO | M4A1, HK416, Barrett M82 (scoped) |
| Futuristic (2089) | Neon megacity plaza at night | Smart Rifle (auto-targets), Handheld Railgun (pierces), Laser Rifle |
| Space (2240) | Lunar outpost with a starfield and Earth in the sky. **Low gravity** | Plasma Rifle (splash), Coilgun, Micro-missile Launcher (homing, splash) |

- Every weapon has its own fire rate, damage, mag size, spread, recoil and reload time. Each also has a **synthesized WebAudio sound** (no audio files) and a low-poly first-person viewmodel built from primitives.
- The map is generated procedurally from boxes. It has cover, buildings, simple collision, and you can jump onto low props.
- HUD: ammo, health bar, wave, score, kill feed, crosshair that widens with spread, hitmarkers (headshot and kill variants), damage vignette with a direction arc, and a reload bar. Sniper scopes get a scope overlay.
- Game over screen with stats, plus a best score saved for each era. Restart, or go back to era select.

## Controls

**iPhone / touch (play in landscape):**
- Left thumb anywhere on the left side: virtual joystick to move. Push it fully forward to sprint.
- Drag on the right side: look around.
- **FIRE**: hold to shoot. You can keep your thumb on it and drag to aim while firing.
- **AIM**: toggles aim-down-sights or scope. **R**: reload. **⇄**: swap weapon. **▲**: jump. **II**: pause.
- If you hold the phone upright, a "rotate your phone" hint appears.
- Tip: in Safari, use *Share → Add to Home Screen* for a fullscreen-style launch. Turn the silent switch off to hear sound.

**Desktop:**
- Click to lock the mouse. **WASD** to move, **Shift** to sprint, **Space** to jump.
- **Mouse** to look, **left click** to fire, **right click** to aim.
- **R** to reload, **1 / 2 / 3**, **Q** or the mouse wheel to swap weapons.
- **Esc** pauses (it releases the mouse).

## Tech

- A plain static site with no build step: `index.html`, `style.css`, `js/*.js`.
- [Three.js r160](https://threejs.org/) loads as an ES module from the jsDelivr CDN through an import map.
- Kept light for phones:
  - The whole arena is drawn as one `InstancedMesh` for solid boxes and one for glowing strips.
  - All particles are a single `Points` draw call.
  - Lambert materials, no shadows.
  - `devicePixelRatio` is capped at 2, and resolution drops automatically if the frame rate falls.
- The viewmodel is drawn in a second pass so the gun never clips into walls.
- Hit detection uses analytic ray/AABB and ray/sphere tests instead of mesh raycasts.

| File | Purpose |
|---|---|
| `js/main.js` | Game loop, player movement, weapons, waves, HUD |
| `js/eras.js` | Era and weapon data. This is the place to tweak balance |
| `js/world.js` | Procedural arena, collision, ray tests |
| `js/enemies.js` | Bot model and AI |
| `js/viewmodels.js` | First-person weapon models built from primitives |
| `js/fx.js` | Tracers, particles, explosions |
| `js/audio.js` | Synthesized sound effects |
| `js/input.js` | Keyboard/mouse and touch controls |

To run it locally, serve the folder with any static server, for example `python3 -m http.server`, and open `http://localhost:8000`. Opening it straight from `file://` won't work because ES modules need a server.

## Known limitations (prototype)

- The bots use simple steering and don't use cover. They can bunch up behind large buildings.
- There are no vehicles, no multiplayer, no grenades, and no per-weapon attachments.
- The art is programmer art made from primitives, used as placeholders.
- iOS Safari can't do true fullscreen or pointer lock. Use landscape, and *Add to Home Screen* for the most room. Sound stays muted while the silent switch is on.
- An internet connection is needed the first time, because Three.js loads from a CDN.

© LT Vasquez. Arsenal of Eras is a work in progress.
