# Arsenal of Eras — Prototype Demo (browser)

A small, playable **browser FPS prototype** for *Arsenal of Eras*, a Battlefield-style military shooter that spans five eras of warfare, by solo dev **LT Vasquez**.

> **This is a prototype / pitch demo, not the final game.** The full *Arsenal of Eras* is planned for Unreal Engine 5. This web build exists to try out the era/loadout idea quickly on any device, including phones.

**Play:** https://p5tgct9mb9-beep.github.io/arsenal-of-eras-demo/

## What's in the demo

- **Wave survival** against enemy bots. They run at you, strafe and shoot back, and they also go after your tank. Each wave adds more of them, and they get tougher.
- **Five eras.** Each has its own arena look, enemies, weapon pool, grenades and tank:

| Era | Primaries | Sidearms | Tank |
|---|---|---|---|
| World War II (1944) | M1 Garand, Thompson, MG 42, Kar98k, BAR, StG 44 | Colt M1911, Luger P08 | M4 Sherman |
| Cold War (1983) | AK-47, M16A1, Dragunov SVD, M60, PPSh-41, Uzi | Makarov PM, M1911A1 | T-55 |
| Modern (2026) | M4A1, HK416, Barrett M82, SCAR-H, AK-12, M249 | Glock 17, Desert Eagle | M1A2 Abrams |
| Futuristic (2089) | Smart Rifle, Handheld Railgun, Laser Rifle, Pulse SMG, Arc Shotgun | Mag Pistol, Ion Blaster | HT-9 Hover Tank |
| Space (2240, low gravity) | Plasma Rifle, Coilgun, Micro-missile Launcher, Gauss SMG, Ion Repeater | Plasma Pistol, Needler | LRV-T Lunar Rover Tank |

### Loadout menu
You go through it after picking an era. You can also open it from **Pause → Loadout** (it applies right away) or from the game-over screen. Each era's loadout is saved in `localStorage`.
- **Primary and Secondary:** pick from the era's pool.
- **Attachments** for each weapon. They change real stats:
  - **Optic:** iron sights, red dot / collimator, holographic, 2.5x / 4x / 8x scopes. The choices fit the era. Optics change how far aiming zooms in, and 4x and 8x add a scope overlay and slow down aiming.
  - **Muzzle:** the suppressor makes shots much quieter and muffled and draws fewer tracers, but costs 25% range (damage drops off sooner) and 8% damage. The compensator cuts recoil but adds spread. The flash hider removes the muzzle flash and cuts recoil a little.
  - **Underbarrel:** the grip cuts recoil by 30%, the bipod halves recoil while aiming, and the laser tightens hip-fire spread and speeds up aiming. Each one costs a little mobility.
  - **Magazine:** extended mag means +50% rounds but a slower reload. Fast mag means a 30% faster reload.
- **Lethal:** frag, sticky (Semtex / sticky bomb), or impact. Space has a sticky **plasma grenade**.
- **Tactical:** smoke or flash (named for the era).
- **Gear perk:** armor (+35 HP, slightly slower), Grenadier pouch (+1 of each grenade), Bandolier (+50% reserve ammo), or Lightweight (+10% speed, faster aiming).
- Stat bars for **Damage, Fire rate, Range, Recoil control and Mobility** update as you change things. Gains show in green and losses in red.
- A spinning 3D preview shows the weapon with its attachments. The same attachments also appear on your in-game gun.

### Grenades
- They fly in an arc, bounce off the ground and walls, and run on a fuse. Sticky ones stick to walls and to bots. Impact grenades go off on contact.
- Blast damage falls off with distance. You can hurt yourself, but at reduced damage.
- **Smoke** makes a cloud that lasts about 14 seconds and blocks the bots' line of sight.
- **Flash** stuns bots that can see it for about 3 seconds, and whites out your screen if you look at it.
- You get 2 of each per life, and they refill every wave.

### Vehicles
- One tank spawns near the middle of every arena. Walk up to it and press **E** or tap **ENTER**.
- Move input drives and steers the hull. The turret turns toward wherever you look, and the camera switches to third person.
- **Fire** shoots the main cannon: a shell with splash damage and a reload of about 2–3 seconds.
- Running bots over at speed kills them ("Roadkill").
- The tank has its own hull HP, and bots shoot at it while you're inside. If it's destroyed you're thrown out and take some damage. The wreck comes back at the end of the wave, and a damaged tank gets repaired.

### Also included
- Synthesized WebAudio sound for weapons, grenades and the engine. Low-poly viewmodels built from primitives.
- HUD: ammo, grenade counts, HP or hull, wave, score, kill feed, hitmarkers, damage direction, scope overlay, and a smart-lock marker.

## Controls

**iPhone / touch (landscape):**
- **Left thumb:** movement joystick, or drive the tank. Push it fully forward to sprint.
- **Drag on the right side:** look, or aim the turret.
- **FIRE:** hold to shoot, or to fire the cannon.
- **AIM:** aim down sights, or zoom in the tank.
- **R:** reload. **⇄:** swap weapon. **▲:** jump.
- **💣:** throw your lethal grenade. **☁ / ✷:** throw your tactical grenade. **ENTER / EXIT:** get in or out of the tank (only shows up when you're near it). **II:** pause.
- The loadout lists scroll with your finger, and the buttons are big enough to tap easily.
- Tip: use Safari *Share → Add to Home Screen*. Turn the silent switch off to hear sound.

**Desktop:**
- Click to lock the mouse. **WASD** to move, **Shift** to sprint, **Space** to jump. **Mouse** to look, **left click** to fire, **right click** to aim.
- **R** reload. **1 / 2**, **Q** or the wheel to swap weapons.
- **G** lethal grenade. **T** or **F** tactical grenade. **E** get in or out of the vehicle.
- **Esc** pauses. The pause menu has **Loadout**, Restart and Era select.

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
| `js/eras.js` | Era data, weapon pools, grenade names and vehicle specs. This is the place to tweak balance |
| `js/loadout.js` | Attachment, grenade and gear data, stat math, saving, and the loadout menu UI |
| `js/grenades.js` | Grenade physics, smoke clouds and flash |
| `js/vehicles.js` | Era tanks: models, driving and turret |
| `js/world.js` | Procedural arena, collision, ray tests |
| `js/enemies.js` | Bot model and AI |
| `js/viewmodels.js` | First-person weapon models built from primitives |
| `js/fx.js` | Tracers, particles, explosions |
| `js/audio.js` | Synthesized sound effects |
| `js/input.js` | Keyboard/mouse and touch controls |

To run it locally, serve the folder with any static server, for example `python3 -m http.server`, and open `http://localhost:8000`. Opening it straight from `file://` won't work because ES modules need a server.

## Known limitations (prototype)

- The bots use simple steering and don't use cover. They can bunch up behind large buildings.
- There are no aircraft yet; each era has one tank. Tank collision is approximate (three circles along the hull), and the third-person camera can clip through thin geometry.
- Bots use the same simple steering for everything. They don't flank the tank or take cover from grenades.
- There's no multiplayer and no progression or unlocks; everything is available from the start.
- The art is programmer art made from primitives, used as placeholders.
- iOS Safari can't do true fullscreen or pointer lock. Use landscape, and *Add to Home Screen* for the most room. Sound stays muted while the silent switch is on.
- An internet connection is needed the first time, because Three.js loads from a CDN.

© LT Vasquez. Arsenal of Eras is a work in progress.
