# Naña's Run

3D endless runner game built with Three.js + TypeScript + Vite. No external assets except a few MP3 sound files — all models, textures, and most audio are procedurally generated in code.

## Quick Start

```bash
npm install
npm run dev    # Vite dev server
npm run build  # Production build
```

## Architecture

The game is split into managers coordinated by `Game.ts`:

| File | Purpose |
|------|---------|
| `Game.ts` | Main loop, initialization, mountains, camera, scoring |
| `Player.ts` | Character model, 9 vehicle types, physics, jump/duck/tricks |
| `TrackManager.ts` | Infinite 3-lane chunk generation, seasonal decoration |
| `ObstacleManager.ts` | 13 obstacle types, seasonal variants |
| `PowerupManager.ts` | Shield, metal mode, snowboard, helmet, big ramps, waterfalls |
| `CollisionManager.ts` | Box3 collision detection and response routing |
| `SeasonManager.ts` | Season + time-of-day system with lighting configs |
| `EnvironmentManager.ts` | Bears, NPCs, clouds, dynamic lighting |
| `ParticleManager.ts` | Snow, rain, blizzard, fire, collection bursts |
| `CoinManager.ts` | Seasonal collectibles (snowflakes, leaves, drops, shells) |
| `SoundManager.ts` | Web Audio API synthesis + MP3 loading |
| `LaneHeightMap.ts` | Height segments for ramps and lane elevation |
| `InputManager.ts` | Keyboard and touch input |
| `main.ts` | Entry point, UI screens, season picker |

## Key Concepts

- **Seasons**: Winter, Spring, Summer, Autumn — each has unique track style, vehicles, obstacles, collectibles, and 3 time-of-day phases (morning/sunset/night)
- **Vehicles**: skis, rainbowSkis, bobsled, snowboard, mountainBike, motorbike, kayak, rainbowKayak, canoe, jetski — auto-upgrade by score and season
- **Track**: 3 lanes with independent heights (0, 1.5, 3), connected by ramps. 40-unit chunks generated ahead of camera
- **No external dependencies** beyond Three.js — all models are built from primitives (BoxGeometry, SphereGeometry, etc.), textures use CanvasTexture

## Conventions

- All visual assets are procedural (no image files for models/textures)
- Sound effects are synthesized via Web Audio API oscillators/noise
- Season determines which vehicles, obstacles, and decorations spawn
- Score drives progression: speed increase, vehicle upgrades, time-of-day transitions, bear spawns, big ramps
- Crash animation continues scrolling the world (track/obstacles/coins move during death sequence)
- The crashed character follows terrain height (slides up ramps)
