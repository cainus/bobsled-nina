import * as THREE from 'three';
import type { Game } from './Game';

export interface Obstacle {
  mesh: THREE.Object3D;
  collider?: THREE.Object3D; // if set, use this for collision instead of mesh
  active: boolean;
  jumpScored?: boolean;
  isSnowman?: boolean;
  isPineTree?: boolean;
  isBonus?: boolean;
  lane?: number; // track lane for spring wave offset
  floatsOnWave?: boolean; // if true, follows spring wave; if false, stays at base height
}

type ObstacleType = 'rock' | 'snowman' | 'pineTree' | 'lowObstacle' | 'treeBranch' | 'largeTree'
  | 'floaty' | 'turtle' | 'seashell' | 'leafPile' | 'oakTree' | 'log' | 'buoy' | 'wideRock';

export class ObstacleManager {
  game: Game;
  obstacles: Obstacle[] = [];
  spawnTimer = -3; // 3-second grace period at start
  private spawnInterval = 1.2; // seconds between spawns
  private readonly minSpawnInterval = 0.55;
  private spawnZ = 100; // spawn distance ahead

  constructor(game: Game) {
    this.game = game;
  }

  private getSpawnInterval(): number {
    // Decrease interval as speed increases
    const ratio = (this.game.speed - this.game.baseSpeed) / (this.game.maxSpeed - this.game.baseSpeed);
    return Math.max(this.minSpawnInterval, this.spawnInterval - ratio * 0.5);
  }

  update(dt: number) {
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.getSpawnInterval()) {
      this.spawnTimer = 0;
      this.spawnObstacle();
    }

    const moveAmount = this.game.speed * dt;

    for (const obs of this.obstacles) {
      if (!obs.active) continue;
      obs.mesh.position.z -= moveAmount;

      // Spring: logs float on the wave, rocks stay at track floor
      if (obs.lane !== undefined && this.game.seasonManager.season === 'spring') {
        if (obs.floatsOnWave) {
          const wave = this.game.trackManager.getSpringWaveOffset(obs.lane);
          const laneY = this.game.laneHeightMap.getHeight(obs.lane, obs.mesh.position.z);
          obs.mesh.position.y = laneY + wave;
        } else {
          obs.mesh.position.y = this.game.trackManager.currentBaseY;
        }
      }

      // Remove if behind camera
      if (obs.mesh.position.z < -15) {
        obs.active = false;
        this.game.scene.remove(obs.mesh);
      }
    }

    // Cleanup inactive
    this.obstacles = this.obstacles.filter(o => o.active);
  }

  private spawnObstacle() {
    const season = this.game.seasonManager.season;
    let types: ObstacleType[];
    if (season === 'spring') {
      types = ['rock', 'log', 'treeBranch', 'wideRock'];
    } else if (season === 'summer') {
      types = ['rock', 'floaty', 'buoy', 'seashell'];
    } else if (season === 'autumn') {
      types = ['leafPile', 'oakTree', 'rock', 'log', 'leafPile', 'treeBranch', 'largeTree'];
    } else {
      types = ['rock', 'pineTree', 'lowObstacle', 'treeBranch', 'largeTree'];
      // Snowmen are rare — 5% chance
      if (Math.random() < 0.05) {
        types = ['snowman'];
      }
    }
    let type: ObstacleType = types[Math.floor(Math.random() * types.length)];

    if (type === 'largeTree') {
      // Large tree that spans 2 adjacent lanes
      const lanes = [-1, 0, 1].filter(
        lane => !this.game.laneHeightMap.isOnOrNearRamp(lane, this.spawnZ)
      );
      if (lanes.length < 2) return;
      // Pick 2 adjacent lanes
      const pairs: [number, number][] = [];
      if (lanes.includes(-1) && lanes.includes(0)) pairs.push([-1, 0]);
      if (lanes.includes(0) && lanes.includes(1)) pairs.push([0, 1]);
      if (pairs.length === 0) return;
      const pair = pairs[Math.floor(Math.random() * pairs.length)];
      const centerX = ((pair[0] + pair[1]) / 2) * this.game.laneWidth;
      const laneY = this.game.laneHeightMap.getHeight(pair[0], this.spawnZ);
      const tree = this.createLargeTree();
      tree.position.set(centerX, laneY, this.spawnZ);
      this.game.scene.add(tree);
      this.obstacles.push({ mesh: tree, active: true, isPineTree: true });
      return;
    }

    if (type === 'wideRock') {
      // Wide rock spans 2 adjacent lanes — pinned to track floor
      const lanes = [-1, 0, 1].filter(
        lane => !this.game.laneHeightMap.isOnOrNearRamp(lane, this.spawnZ)
      );
      if (lanes.length < 2) return;
      const pairs: [number, number][] = [];
      if (lanes.includes(-1) && lanes.includes(0)) pairs.push([-1, 0]);
      if (lanes.includes(0) && lanes.includes(1)) pairs.push([0, 1]);
      if (pairs.length === 0) return;
      const pair = pairs[Math.floor(Math.random() * pairs.length)];
      const centerX = ((pair[0] + pair[1]) / 2) * this.game.laneWidth;
      const floorY = season === 'spring' ? this.game.trackManager.currentBaseY
        : this.game.laneHeightMap.getHeight(pair[0], this.spawnZ);
      const rock = this.createWideRock();
      rock.position.set(centerX, floorY, this.spawnZ);
      this.game.scene.add(rock);
      this.obstacles.push({ mesh: rock, active: true, lane: pair[0], floatsOnWave: false });
      return;
    }

    if (type === 'treeBranch') {
      // Tree branch spans 1-2 lanes from one side — must duck under
      const numLanes = Math.random() > 0.5 ? 2 : 1;
      const fromLeft = Math.random() > 0.5;
      const { group, collider } = this.createTreeBranch(numLanes, fromLeft);
      const branchLane = fromLeft ? -1 : 1;
      const branchY = this.game.laneHeightMap.getHeight(branchLane, this.spawnZ);
      group.position.set(0, branchY, this.spawnZ);
      this.game.scene.add(group);
      this.obstacles.push({ mesh: group, collider, active: true });
    } else {
      // Pick 1-2 lanes to block, excluding lanes on up ramps
      const lanes = [-1, 0, 1].filter(
        lane => !this.game.laneHeightMap.isOnOrNearRamp(lane, this.spawnZ)
      );
      if (lanes.length === 0) return;
      const numBlocked = Math.random() > 0.6 ? 2 : 1;
      const shuffled = lanes.sort(() => Math.random() - 0.5);
      const blockedLanes = shuffled.slice(0, numBlocked);

      for (const lane of blockedLanes) {
        const mesh = this.createObstacle(type);
        const isSpring = season === 'spring';
        const floats = isSpring && type === 'log';
        const isRock = type === 'rock';
        let spawnY: number;
        if (isSpring && isRock) {
          // Rocks sit on the track floor (baseY), not on elevated lanes
          spawnY = this.game.trackManager.currentBaseY;
        } else if (floats) {
          spawnY = this.game.laneHeightMap.getHeight(lane, this.spawnZ)
            + this.game.trackManager.getSpringWaveOffset(lane);
        } else {
          spawnY = this.game.laneHeightMap.getHeight(lane, this.spawnZ);
        }
        mesh.position.set(
          lane * this.game.laneWidth,
          spawnY,
          this.spawnZ
        );
        this.game.scene.add(mesh);
        this.obstacles.push({
          mesh, active: true,
          isSnowman: type === 'snowman',
          isPineTree: type === 'pineTree',
          isBonus: type === 'leafPile',
          lane: isSpring ? lane : undefined,
          floatsOnWave: floats,
        });
      }
    }
  }

  private createObstacle(type: ObstacleType): THREE.Object3D {
    const group = new THREE.Group();

    switch (type) {
      case 'rock': {
        const variant = Math.floor(Math.random() * 3);
        this.buildRockVariant(group, variant);
        break;
      }

      case 'snowman': {
        const snowMat = new THREE.MeshStandardMaterial({ color: 0xfafafa });
        // Bottom ball
        const bot = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), snowMat);
        bot.position.y = 0.7;
        bot.castShadow = true;
        group.add(bot);
        // Middle ball
        const mid = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), snowMat);
        mid.position.y = 1.6;
        mid.castShadow = true;
        group.add(mid);
        // Head
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), snowMat);
        head.position.y = 2.25;
        head.castShadow = true;
        group.add(head);
        // Carrot nose — big and orange, facing the player (-Z)
        const noseGeo = new THREE.ConeGeometry(0.08, 0.45, 8);
        const noseMat = new THREE.MeshStandardMaterial({ color: 0xff6600 });
        const nose = new THREE.Mesh(noseGeo, noseMat);
        nose.position.set(0, 2.22, -0.38);
        nose.rotation.x = -Math.PI / 2;
        group.add(nose);
        // Eyes — coal lumps
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        for (const side of [-0.12, 0.12]) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), eyeMat);
          eye.position.set(side, 2.35, -0.32);
          group.add(eye);
        }
        // Mouth — curved line of coal dots
        for (let i = -2; i <= 2; i++) {
          const dot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 5), eyeMat);
          const angle = (i / 2) * 0.4;
          dot.position.set(Math.sin(angle) * 0.15, 2.1 + Math.cos(angle) * 0.04 - 0.04, -0.33);
          group.add(dot);
        }
        // Top hat
        const hatBrimGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.04, 10);
        const hatMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const brim = new THREE.Mesh(hatBrimGeo, hatMat);
        brim.position.set(0, 2.55, 0);
        group.add(brim);
        const hatTopGeo = new THREE.CylinderGeometry(0.2, 0.22, 0.3, 10);
        const hatTop = new THREE.Mesh(hatTopGeo, hatMat);
        hatTop.position.set(0, 2.72, 0);
        hatTop.castShadow = true;
        group.add(hatTop);
        break;
      }

      case 'pineTree': {
        const pineVariant = Math.floor(Math.random() * 3);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
        const snowMat = new THREE.MeshStandardMaterial({ color: 0xfafafa });

        if (pineVariant === 0) {
          // Classic tall pine — 3 tiers
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 1.5, 6), trunkMat);
          trunk.position.y = 0.75;
          trunk.castShadow = true;
          group.add(trunk);
          const leafMat = new THREE.MeshStandardMaterial({ color: 0x2b5440 });
          for (let i = 0; i < 3; i++) {
            const cone = new THREE.Mesh(new THREE.ConeGeometry(1.0 - i * 0.2, 1.2, 8), leafMat);
            cone.position.y = 1.6 + i * 0.7;
            cone.castShadow = true;
            group.add(cone);
          }
          const cap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.4, 8), snowMat);
          cap.position.y = 3.5;
          group.add(cap);
        } else if (pineVariant === 1) {
          // Short bushy pine — wider, fewer tiers
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.0, 6), trunkMat);
          trunk.position.y = 0.5;
          trunk.castShadow = true;
          group.add(trunk);
          const leafMat = new THREE.MeshStandardMaterial({ color: 0x1f4030 });
          for (let i = 0; i < 2; i++) {
            const cone = new THREE.Mesh(new THREE.ConeGeometry(1.3 - i * 0.3, 1.5, 8), leafMat);
            cone.position.y = 1.2 + i * 1.0;
            cone.castShadow = true;
            group.add(cone);
          }
          // Heavy snow on branches
          for (let i = 0; i < 2; i++) {
            const snow = new THREE.Mesh(new THREE.ConeGeometry(1.1 - i * 0.3, 0.3, 8), snowMat);
            snow.position.y = 1.7 + i * 1.0;
            group.add(snow);
          }
        } else {
          // Tall narrow spruce
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 2.0, 6), trunkMat);
          trunk.position.y = 1.0;
          trunk.castShadow = true;
          group.add(trunk);
          const leafMat = new THREE.MeshStandardMaterial({ color: 0x345548 });
          for (let i = 0; i < 5; i++) {
            const cone = new THREE.Mesh(new THREE.ConeGeometry(0.7 - i * 0.1, 0.8, 6), leafMat);
            cone.position.y = 1.8 + i * 0.55;
            cone.castShadow = true;
            group.add(cone);
          }
          const cap = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 6), snowMat);
          cap.position.y = 4.6;
          group.add(cap);
        }
        break;
      }

      case 'lowObstacle': {
        const variant = Math.floor(Math.random() * 3);
        if (variant === 0) {
          // Low flat rock formation
          const slateMat = new THREE.MeshStandardMaterial({ color: 0x6b6b6b, roughness: 0.85 });
          const slab = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 0), slateMat);
          slab.position.y = 0.25;
          slab.scale.set(1.8, 0.4, 1.2);
          slab.rotation.set(0.1, 0.5, 0.05);
          slab.castShadow = true;
          group.add(slab);
          for (const offset of [-0.6, 0.5]) {
            const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3, 0),
              new THREE.MeshStandardMaterial({ color: 0x7a7a7a, roughness: 0.9 }));
            pebble.position.set(offset, 0.18, 0.2 * Math.sign(offset));
            pebble.rotation.set(Math.random(), Math.random(), Math.random());
            pebble.scale.set(1, 0.5, 1);
            pebble.castShadow = true;
            group.add(pebble);
          }
          const snowPatch = new THREE.Mesh(
            new THREE.SphereGeometry(0.35, 5, 4, 0, Math.PI * 2, 0, Math.PI * 0.35),
            new THREE.MeshStandardMaterial({ color: 0xfafafa }));
          snowPatch.position.set(0.1, 0.45, 0);
          group.add(snowPatch);
        } else if (variant === 1) {
          // Fallen log — single horizontal trunk, slightly askew
          const barkMat = new THREE.MeshStandardMaterial({ color: 0x6d4c2e, roughness: 0.9 });
          const logGeo = new THREE.CylinderGeometry(0.25, 0.3, 2.4, 8);
          const log = new THREE.Mesh(logGeo, barkMat);
          const logAngle = (Math.random() - 0.5) * 0.6;
          log.rotation.z = Math.PI / 2;
          log.rotation.y = logAngle;
          log.position.y = 0.3;
          log.castShadow = true;
          group.add(log);
          // Cut ends — lighter wood color
          const endMat = new THREE.MeshStandardMaterial({ color: 0xc4a46c, roughness: 0.7 });
          for (const side of [-1.2, 1.2]) {
            const endCap = new THREE.Mesh(new THREE.CircleGeometry(0.27, 8), endMat);
            endCap.position.set(side, 0.3, 0);
            endCap.rotation.y = Math.sign(side) * Math.PI / 2;
            group.add(endCap);
          }
          // Snow dusting on top
          const snowGeo = new THREE.BoxGeometry(1.8, 0.06, 0.3);
          const snow = new THREE.Mesh(snowGeo, new THREE.MeshStandardMaterial({ color: 0xfafafa }));
          snow.position.set(0, 0.55, 0);
          group.add(snow);
        } else {
          // Log pile — two logs stacked with one on top, askew
          const pileAngle = (Math.random() - 0.5) * 0.5;
          const barkMat = new THREE.MeshStandardMaterial({ color: 0x5a3d1e, roughness: 0.95 });
          const barkMat2 = new THREE.MeshStandardMaterial({ color: 0x7a5533, roughness: 0.85 });
          const endMat = new THREE.MeshStandardMaterial({ color: 0xc4a46c, roughness: 0.7 });
          // Bottom two logs
          for (const offset of [-0.28, 0.28]) {
            const log = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 2.0, 8), barkMat);
            log.rotation.z = Math.PI / 2;
            log.position.set(0, 0.24, offset);
            log.castShadow = true;
            group.add(log);
            for (const side of [-1.0, 1.0]) {
              const endCap = new THREE.Mesh(new THREE.CircleGeometry(0.23, 8), endMat);
              endCap.position.set(side, 0.24, offset);
              endCap.rotation.y = Math.sign(side) * Math.PI / 2;
              group.add(endCap);
            }
          }
          // Top log
          const topLog = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 2.2, 8), barkMat2);
          topLog.rotation.z = Math.PI / 2;
          topLog.position.set(0, 0.62, 0);
          topLog.castShadow = true;
          group.add(topLog);
          for (const side of [-1.1, 1.1]) {
            const endCap = new THREE.Mesh(new THREE.CircleGeometry(0.21, 8), endMat);
            endCap.position.set(side, 0.62, 0);
            endCap.rotation.y = Math.sign(side) * Math.PI / 2;
            group.add(endCap);
          }
          // Snow on top
          const snow = new THREE.Mesh(
            new THREE.BoxGeometry(1.6, 0.05, 0.25),
            new THREE.MeshStandardMaterial({ color: 0xfafafa }));
          snow.position.set(0, 0.83, 0);
          group.add(snow);
          // Rotate pile askew
          group.rotation.y = pileAngle;
        }
        break;
      }

      case 'floaty': {
        // Round pool floaty — colorful torus
        const colors = [0xff69b4, 0xff4444, 0x44aaff, 0xffcc00, 0x44dd44];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const floatyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4 });
        const torus = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.25, 10, 16), floatyMat);
        torus.position.y = 0.35;
        torus.rotation.x = Math.PI / 2;
        torus.castShadow = true;
        group.add(torus);
        // White stripe
        const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.08, 8, 16), stripeMat);
        stripe.position.y = 0.35;
        stripe.rotation.x = Math.PI / 2;
        group.add(stripe);
        break;
      }

      case 'turtle': {
        // Sea turtle — green dome shell with flippers
        const shellMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.7 });
        const shell = new THREE.Mesh(
          new THREE.SphereGeometry(0.6, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
          shellMat
        );
        shell.position.y = 0.15;
        shell.castShadow = true;
        group.add(shell);
        // Shell pattern
        const patternMat = new THREE.MeshStandardMaterial({ color: 0x1b5e20 });
        for (let i = 0; i < 6; i++) {
          const hex = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 6), patternMat);
          const a = (i / 6) * Math.PI * 2;
          hex.position.set(Math.sin(a) * 0.3, 0.45, Math.cos(a) * 0.3);
          hex.rotation.x = Math.PI / 2 - 0.3;
          group.add(hex);
        }
        // Head
        const skinMat = new THREE.MeshStandardMaterial({ color: 0x4caf50 });
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), skinMat);
        head.position.set(0, 0.2, -0.65);
        group.add(head);
        // Eyes
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        for (const side of [-0.08, 0.08]) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), eyeMat);
          eye.position.set(side, 0.28, -0.75);
          group.add(eye);
        }
        // Flippers
        for (const side of [-1, 1]) {
          const flipper = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.2), skinMat);
          flipper.position.set(side * 0.55, 0.1, -0.1);
          flipper.rotation.y = side * 0.4;
          group.add(flipper);
        }
        break;
      }

      case 'seashell': {
        // Spiral seashell
        const shellMat = new THREE.MeshStandardMaterial({ color: 0xfce4b8, roughness: 0.5 });
        const innerMat = new THREE.MeshStandardMaterial({ color: 0xffb6c1 });
        // Main shell body — cone spiral approximation
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.0, 12), shellMat);
        cone.position.y = 0.5;
        cone.rotation.z = 0.3;
        cone.castShadow = true;
        group.add(cone);
        // Spiral ridges
        for (let i = 0; i < 4; i++) {
          const ridge = new THREE.Mesh(new THREE.TorusGeometry(0.35 - i * 0.06, 0.03, 6, 12), shellMat);
          ridge.position.set(0, 0.3 + i * 0.18, 0);
          ridge.rotation.x = Math.PI / 2;
          group.add(ridge);
        }
        // Opening
        const opening = new THREE.Mesh(new THREE.CircleGeometry(0.25, 10), innerMat);
        opening.position.set(0, 0.2, 0.15);
        opening.rotation.x = -0.3;
        group.add(opening);
        group.scale.setScalar(1.2);
        break;
      }

      case 'leafPile': {
        // Pile of autumn-colored leaves
        const leafColors = [0xcc3333, 0xff8800, 0xffcc00, 0x88aa22, 0x8B4513];
        const pileCount = 8 + Math.floor(Math.random() * 5);
        for (let i = 0; i < pileCount; i++) {
          const color = leafColors[Math.floor(Math.random() * leafColors.length)];
          const leafMat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
          const leaf = new THREE.Mesh(
            new THREE.SphereGeometry(0.2 + Math.random() * 0.15, 6, 4),
            leafMat
          );
          leaf.scale.set(1, 0.3, 1.2);
          leaf.position.set(
            (Math.random() - 0.5) * 0.8,
            0.1 + Math.random() * 0.3,
            (Math.random() - 0.5) * 0.8
          );
          leaf.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.3);
          group.add(leaf);
        }
        break;
      }

      case 'oakTree': {
        // Oak tree obstacle on the lane
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 2, 8), trunkMat);
        trunk.position.y = 1;
        trunk.castShadow = true;
        group.add(trunk);
        const leafColors = [0xcc3333, 0xff8800, 0xffcc00, 0x6b8e23];
        for (let i = 0; i < 4; i++) {
          const color = leafColors[Math.floor(Math.random() * leafColors.length)];
          const foliage = new THREE.Mesh(
            new THREE.SphereGeometry(0.6 + Math.random() * 0.2, 8, 6),
            new THREE.MeshStandardMaterial({ color })
          );
          const a = (i / 4) * Math.PI * 2;
          foliage.position.set(Math.sin(a) * 0.3, 2.2 + Math.random() * 0.5, Math.cos(a) * 0.3);
          foliage.castShadow = true;
          group.add(foliage);
        }
        break;
      }

      case 'log': {
        // Fallen log — reuse the winter log obstacle
        const barkMat = new THREE.MeshStandardMaterial({ color: 0x6d4c2e, roughness: 0.9 });
        const logGeo = new THREE.CylinderGeometry(0.25, 0.3, 2.4, 8);
        const log = new THREE.Mesh(logGeo, barkMat);
        log.rotation.z = Math.PI / 2;
        log.rotation.y = (Math.random() - 0.5) * 0.6;
        log.position.y = 0.3;
        log.castShadow = true;
        group.add(log);
        const endMat = new THREE.MeshStandardMaterial({ color: 0xc4a46c, roughness: 0.7 });
        for (const side of [-1.2, 1.2]) {
          const endCap = new THREE.Mesh(new THREE.CircleGeometry(0.27, 8), endMat);
          endCap.position.set(side, 0.3, 0);
          endCap.rotation.y = Math.sign(side) * Math.PI / 2;
          group.add(endCap);
        }
        // Some leaves on top instead of snow
        const leafColors = [0xcc3333, 0xff8800, 0xffcc00];
        for (let i = 0; i < 3; i++) {
          const color = leafColors[Math.floor(Math.random() * leafColors.length)];
          const leaf = new THREE.Mesh(
            new THREE.SphereGeometry(0.12, 5, 4),
            new THREE.MeshStandardMaterial({ color })
          );
          leaf.scale.set(1, 0.3, 1);
          leaf.position.set((Math.random() - 0.5) * 1.5, 0.55, (Math.random() - 0.5) * 0.2);
          group.add(leaf);
        }
        break;
      }

      case 'buoy': {
        // Tall red/white navigation buoy
        const buoyRedMat = new THREE.MeshStandardMaterial({ color: 0xdd2222, roughness: 0.5 });
        const buoyWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        // Red cylinder body
        const buoyBody = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 1.2, 10), buoyRedMat);
        buoyBody.position.y = 0.6;
        buoyBody.castShadow = true;
        group.add(buoyBody);
        // White stripe bands
        for (const bandY of [0.35, 0.7, 1.05]) {
          const band = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.08, 10), buoyWhiteMat);
          band.position.y = bandY;
          group.add(band);
        }
        // Tapered top
        const buoyTop = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 8), buoyRedMat);
        buoyTop.position.y = 1.35;
        buoyTop.castShadow = true;
        group.add(buoyTop);
        // Small light on top
        const lightMat = new THREE.MeshStandardMaterial({ color: 0xffff44, emissive: 0xffff00, emissiveIntensity: 0.6 });
        const light = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), lightMat);
        light.position.y = 1.55;
        group.add(light);
        break;
      }

    }

    return group;
  }

  private createLargeTree(): THREE.Group {
    const group = new THREE.Group();
    const isAutumn = this.game.seasonManager.season === 'autumn';
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3527 });
    const fallLeafColors = [0xcc3333, 0xff8800, 0xffcc00, 0x6b8e23, 0x8B4513];

    // Thick trunk
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 4, 8), trunkMat);
    trunk.position.y = 2;
    trunk.castShadow = true;
    group.add(trunk);

    // Foliage layers — pine stays green in all seasons
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x254a38 });
    for (let i = 0; i < 4; i++) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(2.5 - i * 0.4, 2.0, 8), leafMat);
      cone.position.y = 3.5 + i * 1.2;
      cone.castShadow = true;
      group.add(cone);
    }

    if (!isAutumn) {
      // Snow on top layers (winter only)
      const snowMat = new THREE.MeshStandardMaterial({ color: 0xfafafa });
      for (let i = 0; i < 3; i++) {
        const snow = new THREE.Mesh(
          new THREE.ConeGeometry(2.2 - i * 0.4, 0.4, 8), snowMat);
        snow.position.y = 4.3 + i * 1.2;
        group.add(snow);
      }
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.6, 8), snowMat);
      cap.position.y = 8.5;
      group.add(cap);
    }

    return group;
  }

  private createWideRock(): THREE.Group {
    const group = new THREE.Group();
    const laneW = this.game.laneWidth;
    const mat = new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.9 });

    // Main wide boulder
    const main = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4, 1), mat);
    main.position.y = 0.9;
    main.scale.set(laneW * 0.5, 0.7, 0.9);
    main.rotation.set(0.2, 0.5, 0.1);
    main.castShadow = true;
    group.add(main);

    // Secondary rocks on each side
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.95 });
    for (const side of [-1, 1]) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 0), darkMat);
      rock.position.set(side * 1.2, 0.6, (Math.random() - 0.5) * 0.5);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.scale.set(1, 0.8, 1.1);
      rock.castShadow = true;
      group.add(rock);
    }

    // Moss patches
    const mossMat = new THREE.MeshStandardMaterial({ color: 0x4a7a3a, roughness: 0.9 });
    for (let i = 0; i < 3; i++) {
      const moss = new THREE.Mesh(
        new THREE.SphereGeometry(0.3 + Math.random() * 0.2, 5, 4, 0, Math.PI * 2, 0, Math.PI * 0.3),
        mossMat
      );
      moss.position.set((Math.random() - 0.5) * 2, 1.2 + Math.random() * 0.3, (Math.random() - 0.5) * 0.5);
      group.add(moss);
    }

    return group;
  }

  private buildRockVariant(group: THREE.Group, variant: number) {
    const season = this.game.seasonManager.season;
    const isAutumn = season === 'autumn';
    const isSpring = season === 'spring';
    const fallLeafColors = [0xcc3333, 0xff8800, 0xffcc00, 0x6b8e23, 0x8B4513];
    const capColor = isAutumn
      ? fallLeafColors[Math.floor(Math.random() * fallLeafColors.length)]
      : isSpring ? 0x5a8a4a
      : 0xfafafa;
    const snowCapMat = new THREE.MeshStandardMaterial({ color: capColor });

    switch (variant) {
      case 0: {
        // Tall boulder with smaller rock on top
        const mat = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.9 });
        const main = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 0), mat);
        main.position.y = 0.9;
        main.rotation.set(0.3, 0.7, 0.2);
        main.scale.set(1, 0.85, 1.1);
        main.castShadow = true;
        group.add(main);
        const top = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 0),
          new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.95 }));
        top.position.set(0.2, 1.6, 0.1);
        top.rotation.set(0.5, 1.2, 0.4);
        top.castShadow = true;
        group.add(top);
        const snow = new THREE.Mesh(
          new THREE.SphereGeometry(0.5, 6, 4, 0, Math.PI * 2, 0, Math.PI * 0.4), snowCapMat);
        snow.position.set(0, 1.7, 0);
        group.add(snow);
        break;
      }
      case 1: {
        // Wide granite slab — dark gray, broad and squat
        const mat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.85 });
        const slab = new THREE.Mesh(new THREE.DodecahedronGeometry(1.0, 1), mat);
        slab.position.y = 0.7;
        slab.scale.set(1.4, 0.7, 1.0);
        slab.rotation.set(0.15, 0.9, 0.1);
        slab.castShadow = true;
        group.add(slab);
        // Crack detail — thin dark strip
        const crackMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 1.0 });
        const crack = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.8), crackMat);
        crack.position.set(0.1, 0.7, 0);
        crack.rotation.y = 0.3;
        group.add(crack);
        // Snow streak
        const snow = new THREE.Mesh(
          new THREE.SphereGeometry(0.6, 5, 4, 0, Math.PI * 2, 0, Math.PI * 0.3), snowCapMat);
        snow.position.set(-0.1, 1.15, 0.1);
        group.add(snow);
        break;
      }
      case 2: {
        // Rock cluster — 3 medium rocks grouped together
        const colors = [0x8a8a8a, 0x6e6e6e, 0x7a7a7a];
        const positions: [number, number, number][] = [[0, 0.65, 0], [-0.5, 0.5, 0.3], [0.45, 0.55, -0.2]];
        const sizes = [0.65, 0.5, 0.55];
        for (let i = 0; i < 3; i++) {
          const mat = new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.9 });
          const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(sizes[i], 0), mat);
          rock.position.set(...positions[i]);
          rock.rotation.set(i * 1.1, i * 0.8, i * 0.5);
          rock.castShadow = true;
          group.add(rock);
        }
        // Snow on the tallest one
        const snow = new THREE.Mesh(
          new THREE.SphereGeometry(0.35, 5, 4, 0, Math.PI * 2, 0, Math.PI * 0.4), snowCapMat);
        snow.position.set(0, 1.15, 0);
        group.add(snow);
        break;
      }
      case 3: {
        // Jagged spire — tall and narrow, reddish-brown
        const mat = new THREE.MeshStandardMaterial({ color: 0x8b6b4a, roughness: 0.8 });
        const spire = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2.2, 5), mat);
        spire.position.y = 1.1;
        spire.rotation.set(0.1, 0.4, 0.15);
        spire.castShadow = true;
        group.add(spire);
        // Base rubble
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x7a6040, roughness: 0.9 });
        const base = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), baseMat);
        base.position.set(0.3, 0.35, 0.2);
        base.scale.set(1.2, 0.6, 1.0);
        base.rotation.set(0.3, 1.5, 0);
        base.castShadow = true;
        group.add(base);
        // Snow on spire tip
        const snow = new THREE.Mesh(
          new THREE.SphereGeometry(0.25, 5, 4, 0, Math.PI * 2, 0, Math.PI * 0.4), snowCapMat);
        snow.position.set(0.05, 2.2, 0);
        group.add(snow);
        break;
      }
    }
  }

  private createTreeBranch(numLanes: number, fromLeft: boolean): { group: THREE.Group; collider: THREE.Object3D } {
    const group = new THREE.Group();
    const lw = this.game.laneWidth;
    const isAutumn = this.game.seasonManager.season === 'autumn';
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });

    // Tree trunk on one side of the track
    const side = fromLeft ? -1 : 1;
    const trunkX = side * (lw * 1.5 + 1.5);
    const trunkGeo = new THREE.CylinderGeometry(0.4, 0.5, 6, 8);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(trunkX, 3, 0);
    trunk.castShadow = true;
    group.add(trunk);

    // Pine foliage on the trunk — always green
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2b5440 });
    for (let i = 0; i < 3; i++) {
      const foliageGeo = new THREE.ConeGeometry(1.4 - i * 0.3, 1.8, 8);
      const foliage = new THREE.Mesh(foliageGeo, leafMat);
      foliage.position.set(trunkX, 4.5 + i * 1.1, 0);
      foliage.castShadow = true;
      group.add(foliage);
    }

    // Overhanging branch — extends across 1-2 lanes, slightly askew
    // Branch sits at y ~1.8 so standing players hit it, ducking players pass under
    const branchAngle = (Math.random() - 0.5) * 0.4;
    const branchLength = numLanes * lw + 1;
    const branchX = trunkX + (-side * branchLength / 2);
    const branchGeo = new THREE.CylinderGeometry(0.15, 0.2, branchLength, 6);
    const branch = new THREE.Mesh(branchGeo, trunkMat);
    branch.rotation.z = Math.PI / 2;
    branch.rotation.y = branchAngle;
    branch.position.set(branchX, 1.8, 0);
    branch.castShadow = true;
    group.add(branch);

    // Collision box — only the branch part (not trunk/foliage), matches askew angle
    const colliderGeo = new THREE.BoxGeometry(branchLength, 0.5, 1.2);
    const colliderMesh = new THREE.Mesh(colliderGeo);
    colliderMesh.visible = false;
    colliderMesh.position.set(branchX, 1.8, 0);
    colliderMesh.rotation.y = branchAngle;
    group.add(colliderMesh);

    // Clumps on the branch — needles (no snow in autumn)
    const clumpCount = numLanes * 3;
    for (let i = 0; i < clumpCount; i++) {
      const t = (i + 0.5) / clumpCount;
      const cx = trunkX + (-side * branchLength * t);
      const isWinter = this.game.seasonManager.season === 'winter';
      if (isWinter && Math.random() > 0.5) {
        const snowGeo = new THREE.SphereGeometry(0.3 + Math.random() * 0.2, 5, 4);
        const snowClump = new THREE.Mesh(snowGeo, new THREE.MeshStandardMaterial({ color: 0xfafafa }));
        snowClump.position.set(cx, 2.15 + Math.random() * 0.2, (Math.random() - 0.5) * 0.4);
        group.add(snowClump);
      } else {
        const needleGeo = new THREE.ConeGeometry(0.3 + Math.random() * 0.2, 0.5, 5);
        const needle = new THREE.Mesh(needleGeo, leafMat);
        needle.position.set(cx, 2.3 + Math.random() * 0.2, (Math.random() - 0.5) * 0.4);
        group.add(needle);
      }
    }

    return { group, collider: colliderMesh };
  }

  reset() {
    for (const obs of this.obstacles) {
      this.game.scene.remove(obs.mesh);
    }
    this.obstacles = [];
    this.spawnTimer = -3;
  }
}
