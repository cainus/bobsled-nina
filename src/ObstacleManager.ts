import * as THREE from 'three';
import type { Game } from './Game';

export interface Obstacle {
  mesh: THREE.Object3D;
  collider?: THREE.Object3D; // if set, use this for collision instead of mesh
  active: boolean;
}

type ObstacleType = 'iceBlock' | 'snowman' | 'barrier' | 'lowBar' | 'treeBranch';

export class ObstacleManager {
  game: Game;
  obstacles: Obstacle[] = [];
  private spawnTimer = 0;
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
    const types: ObstacleType[] = ['iceBlock', 'snowman', 'barrier', 'lowBar', 'treeBranch'];
    const type = types[Math.floor(Math.random() * types.length)];

    if (type === 'treeBranch') {
      // Tree branch spans 1-2 lanes from one side — must duck under
      const numLanes = Math.random() > 0.5 ? 2 : 1;
      const fromLeft = Math.random() > 0.5;
      const { group, collider } = this.createTreeBranch(numLanes, fromLeft);
      group.position.set(0, 0, this.spawnZ);
      this.game.scene.add(group);
      this.obstacles.push({ mesh: group, collider, active: true });
    } else {
      // Pick 1-2 lanes to block
      const lanes = [-1, 0, 1];
      const numBlocked = Math.random() > 0.6 ? 2 : 1;
      const shuffled = lanes.sort(() => Math.random() - 0.5);
      const blockedLanes = shuffled.slice(0, numBlocked);

      for (const lane of blockedLanes) {
        const mesh = this.createObstacle(type);
        mesh.position.set(
          lane * this.game.laneWidth,
          0,
          this.spawnZ
        );
        this.game.scene.add(mesh);
        this.obstacles.push({ mesh, active: true });
      }
    }
  }

  private createObstacle(type: ObstacleType): THREE.Object3D {
    const group = new THREE.Group();

    switch (type) {
      case 'iceBlock': {
        const geo = new THREE.BoxGeometry(1.8, 1.8, 1.2);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x88ccee,
          transparent: true,
          opacity: 0.8,
          metalness: 0.2,
          roughness: 0.1,
        });
        const block = new THREE.Mesh(geo, mat);
        block.position.y = 0.9;
        block.castShadow = true;
        group.add(block);
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
        // Carrot nose
        const noseGeo = new THREE.ConeGeometry(0.06, 0.3, 6);
        const noseMat = new THREE.MeshStandardMaterial({ color: 0xff6600 });
        const nose = new THREE.Mesh(noseGeo, noseMat);
        nose.position.set(0, 2.25, 0.35);
        nose.rotation.x = Math.PI / 2;
        group.add(nose);
        // Eyes
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        for (const side of [-0.1, 0.1]) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat);
          eye.position.set(side, 2.35, 0.3);
          group.add(eye);
        }
        break;
      }

      case 'barrier': {
        // Orange/yellow safety barrier
        const barGeo = new THREE.BoxGeometry(2.2, 1.2, 0.3);
        const barMat = new THREE.MeshStandardMaterial({ color: 0xff9800 });
        const bar = new THREE.Mesh(barGeo, barMat);
        bar.position.y = 0.6;
        bar.castShadow = true;
        group.add(bar);
        // Stripes
        const stripeGeo = new THREE.BoxGeometry(0.4, 1.2, 0.32);
        const stripeMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
        for (let i = -2; i <= 2; i += 2) {
          const stripe = new THREE.Mesh(stripeGeo, stripeMat);
          stripe.position.set(i * 0.35, 0.6, 0);
          group.add(stripe);
        }
        // Posts
        const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.3, 6);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x666666 });
        for (const px of [-0.9, 0.9]) {
          const post = new THREE.Mesh(postGeo, postMat);
          post.position.set(px, 0.65, 0);
          group.add(post);
        }
        break;
      }

      case 'lowBar': {
        // Low bar that you can jump over (or duck under the high version)
        // This is a ground-level ice ridge
        const ridgeGeo = new THREE.BoxGeometry(2.4, 0.6, 0.8);
        const ridgeMat = new THREE.MeshStandardMaterial({
          color: 0x99ddff,
          metalness: 0.1,
          roughness: 0.3,
        });
        const ridge = new THREE.Mesh(ridgeGeo, ridgeMat);
        ridge.position.y = 0.3;
        ridge.castShadow = true;
        group.add(ridge);
        break;
      }
    }

    return group;
  }

  private createTreeBranch(numLanes: number, fromLeft: boolean): { group: THREE.Group; collider: THREE.Object3D } {
    const group = new THREE.Group();
    const lw = this.game.laneWidth;
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32 });

    // Tree trunk on one side of the track
    const side = fromLeft ? -1 : 1;
    const trunkX = side * (lw * 1.5 + 1.5);
    const trunkGeo = new THREE.CylinderGeometry(0.4, 0.5, 6, 8);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(trunkX, 3, 0);
    trunk.castShadow = true;
    group.add(trunk);

    // Foliage on the trunk
    for (let i = 0; i < 2; i++) {
      const foliageGeo = new THREE.SphereGeometry(1.2 + i * 0.3, 8, 6);
      const foliage = new THREE.Mesh(foliageGeo, leafMat);
      foliage.position.set(trunkX, 5 + i * 1.2, 0);
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

    // Leaves/snow on the branch
    const clumpCount = numLanes * 2;
    for (let i = 0; i < clumpCount; i++) {
      const t = (i + 0.5) / clumpCount;
      const cx = trunkX + (-side * branchLength * t);
      const clumpGeo = new THREE.SphereGeometry(0.4 + Math.random() * 0.3, 6, 5);
      const isSnow = Math.random() > 0.5;
      const clumpMat = isSnow
        ? new THREE.MeshStandardMaterial({ color: 0xfafafa })
        : leafMat;
      const clump = new THREE.Mesh(clumpGeo, clumpMat);
      clump.position.set(cx, 2.1 + Math.random() * 0.3, (Math.random() - 0.5) * 0.5);
      group.add(clump);
    }

    return { group, collider: colliderMesh };
  }

  reset() {
    for (const obs of this.obstacles) {
      this.game.scene.remove(obs.mesh);
    }
    this.obstacles = [];
    this.spawnTimer = 0;
  }
}
