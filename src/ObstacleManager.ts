import * as THREE from 'three';
import type { Game } from './Game';

export interface Obstacle {
  mesh: THREE.Object3D;
  collider?: THREE.Object3D; // if set, use this for collision instead of mesh
  active: boolean;
  jumpScored?: boolean;
  isSnowman?: boolean;
}

type ObstacleType = 'rock' | 'snowman' | 'pineTree' | 'lowObstacle' | 'treeBranch' | 'largeTree';

export class ObstacleManager {
  game: Game;
  obstacles: Obstacle[] = [];
  private spawnTimer = -3; // 3-second grace period at start
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
    const types: ObstacleType[] = ['rock', 'pineTree', 'lowObstacle', 'treeBranch', 'largeTree'];
    let type: ObstacleType = types[Math.floor(Math.random() * types.length)];
    // Snowmen are rare — 5% chance
    if (Math.random() < 0.05) type = 'snowman';

    if (type === 'largeTree') {
      // Large tree that spans 2 adjacent lanes
      const lanes = [-1, 0, 1].filter(
        lane => !this.game.laneHeightMap.isUpRamp(lane, this.spawnZ)
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
      this.obstacles.push({ mesh: tree, active: true });
      return;
    }

    if (type === 'treeBranch') {
      // Tree branch spans 1-2 lanes from one side — must duck under
      const numLanes = Math.random() > 0.5 ? 2 : 1;
      const fromLeft = Math.random() > 0.5;
      const { group, collider } = this.createTreeBranch(numLanes, fromLeft);
      group.position.set(0, 0, this.spawnZ);
      this.game.scene.add(group);
      this.obstacles.push({ mesh: group, collider, active: true });
    } else {
      // Pick 1-2 lanes to block, excluding lanes on up ramps
      const lanes = [-1, 0, 1].filter(
        lane => !this.game.laneHeightMap.isUpRamp(lane, this.spawnZ)
      );
      if (lanes.length === 0) return;
      const numBlocked = Math.random() > 0.6 ? 2 : 1;
      const shuffled = lanes.sort(() => Math.random() - 0.5);
      const blockedLanes = shuffled.slice(0, numBlocked);

      for (const lane of blockedLanes) {
        const mesh = this.createObstacle(type);
        const laneY = this.game.laneHeightMap.getHeight(lane, this.spawnZ);
        mesh.position.set(
          lane * this.game.laneWidth,
          laneY,
          this.spawnZ
        );
        this.game.scene.add(mesh);
        this.obstacles.push({ mesh, active: true, isSnowman: type === 'snowman' });
      }
    }
  }

  private createObstacle(type: ObstacleType): THREE.Object3D {
    const group = new THREE.Group();

    switch (type) {
      case 'rock': {
        const variant = Math.floor(Math.random() * 4);
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
          // Fallen log — single horizontal trunk
          const barkMat = new THREE.MeshStandardMaterial({ color: 0x6d4c2e, roughness: 0.9 });
          const logGeo = new THREE.CylinderGeometry(0.25, 0.3, 2.4, 8);
          const log = new THREE.Mesh(logGeo, barkMat);
          log.rotation.z = Math.PI / 2;
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
          // Log pile — two logs stacked with one on top
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
        }
        break;
      }

    }

    return group;
  }

  private createLargeTree(): THREE.Group {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3527 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x254a38 });

    // Thick trunk
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 4, 8), trunkMat);
    trunk.position.y = 2;
    trunk.castShadow = true;
    group.add(trunk);

    // Large foliage layers
    for (let i = 0; i < 4; i++) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(2.5 - i * 0.4, 2.0, 8), leafMat);
      cone.position.y = 3.5 + i * 1.2;
      cone.castShadow = true;
      group.add(cone);
    }

    // Snow on top layers
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xfafafa });
    for (let i = 0; i < 3; i++) {
      const snow = new THREE.Mesh(
        new THREE.ConeGeometry(2.2 - i * 0.4, 0.4, 8), snowMat);
      snow.position.y = 4.3 + i * 1.2;
      group.add(snow);
    }

    // Snow cap
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.6, 8), snowMat);
    cap.position.y = 8.5;
    group.add(cap);

    return group;
  }

  private buildRockVariant(group: THREE.Group, variant: number) {
    const snowCapMat = new THREE.MeshStandardMaterial({ color: 0xfafafa });

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
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2b5440 });

    // Tree trunk on one side of the track
    const side = fromLeft ? -1 : 1;
    const trunkX = side * (lw * 1.5 + 1.5);
    const trunkGeo = new THREE.CylinderGeometry(0.4, 0.5, 6, 8);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(trunkX, 3, 0);
    trunk.castShadow = true;
    group.add(trunk);

    // Pine foliage on the trunk
    for (let i = 0; i < 3; i++) {
      const foliageGeo = new THREE.ConeGeometry(1.4 - i * 0.3, 1.8, 8);
      const foliage = new THREE.Mesh(foliageGeo, leafMat);
      foliage.position.set(trunkX, 4.5 + i * 1.1, 0);
      foliage.castShadow = true;
      group.add(foliage);
    }

    // Overhanging branch — extends across 1-2 lanes
    // Branch sits at y ~1.8 so standing players hit it, ducking players pass under
    const branchLength = numLanes * lw + 1;
    const branchX = trunkX + (-side * branchLength / 2);
    const branchGeo = new THREE.CylinderGeometry(0.15, 0.2, branchLength, 6);
    const branch = new THREE.Mesh(branchGeo, trunkMat);
    branch.rotation.z = Math.PI / 2; // horizontal
    branch.position.set(branchX, 1.8, 0);
    branch.castShadow = true;
    group.add(branch);

    // Collision box — only the branch part (not trunk/foliage)
    // Use an invisible box matching branch dimensions for collision
    const colliderGeo = new THREE.BoxGeometry(branchLength, 0.5, 0.8);
    const colliderMesh = new THREE.Mesh(colliderGeo);
    colliderMesh.visible = false;
    colliderMesh.position.set(branchX, 1.8, 0);
    group.add(colliderMesh);

    // Pine needle clumps and snow on the branch
    const clumpCount = numLanes * 3;
    for (let i = 0; i < clumpCount; i++) {
      const t = (i + 0.5) / clumpCount;
      const cx = trunkX + (-side * branchLength * t);
      const isSnow = Math.random() > 0.5;
      if (isSnow) {
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
