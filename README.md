# Bobsled Nina

A 3D endless runner game where you ride a bobsled down an infinite snowy track, dodging obstacles and collecting coins. Built with Three.js and TypeScript.

## Running the Game

```bash
npm install
npm run dev      # Start dev server
npm run build    # Build for production
```

## Controls

| Input | Action |
|-------|--------|
| Left Arrow / A | Move left |
| Right Arrow / D | Move right |
| Up Arrow / W / Space | Jump |
| Down Arrow / S | Duck |
| Touch swipes | Same as keyboard |

## Gameplay

The player rides down a 3-lane track that gets progressively faster. Dodge obstacles, duck under tree branches, jump over ice ridges, and collect coins along the way.

### Lanes & Terrain

- 3 lanes with independent heights (ground level, mid, or high)
- Ramps connect lane height changes smoothly
- Elevated lanes have support walls underneath

### Obstacles

| Type | How to Avoid |
|------|-------------|
| Ice Block | Dodge to another lane |
| Snowman | Dodge to another lane |
| Barrier | Dodge to another lane |
| Low Bar (ice ridge) | Jump over it |
| Tree Branch | Duck under it |

Obstacles block 1-2 lanes at a time and spawn more frequently as speed increases.

### Vehicle Upgrades

Vehicles upgrade automatically as your score increases:

| Score | Vehicle |
|-------|---------|
| 0 | Bobsled |
| 500 | Skis |
| 1000 | Snowboard |
| 1500 | Rainbow Skis |

### Scoring

- Score increases based on distance traveled
- Speed starts at 25 and accelerates up to 55
- Coins are tracked separately

## Project Structure

```
src/
  main.ts            - Entry point
  Game.ts            - Game loop, collision, scoring
  Player.ts          - Character model, physics, vehicle upgrades
  TrackManager.ts    - Infinite track generation with height variation
  ObstacleManager.ts - Obstacle spawning (5 types)
  CoinManager.ts     - Coin spawning and collection
  LaneHeightMap.ts   - Per-lane height map for ramps/elevation
  ParticleManager.ts - Snow spray and coin burst effects
  InputManager.ts    - Keyboard and touch input
```

## Tech Stack

- **Three.js** - 3D rendering
- **TypeScript** - Language
- **Vite** - Build tool / dev server
- Custom physics (no external physics engine)
