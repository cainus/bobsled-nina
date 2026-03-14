import * as THREE from 'three';
import type { Game } from './Game';

export interface Obstacle {
  mesh: THREE.Object3D;
  active: boolean;
}

type ObstacleType = 'iceBlock' | 'snowman' | 'barrier' | 'lowBar';

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
    // Pick 1-2 lanes to block
    const lanes = [-1, 0, 1];
    const numBlocked = Math.random() > 0.6 ? 2 : 1;
    const shuffled = lanes.sort(() => Math.random() - 0.5);
    const blockedLanes = shuffled.slice(0, numBlocked);

    const types: ObstacleType[] = ['iceBlock', 'snowman', 'barrier', 'lowBar'];
    const type = types[Math.floor(Math.random() * types.length)];

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

  reset() {
    for (const obs of this.obstacles) {
      this.game.scene.remove(obs.mesh);
    }
    this.obstacles = [];
    this.spawnTimer = 0;
  }
}
