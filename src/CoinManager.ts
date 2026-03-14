import * as THREE from 'three';
import type { Game } from './Game';

export interface Coin {
  mesh: THREE.Object3D;
  baseY: number;
  active: boolean;
}

export class CoinManager {
  game: Game;
  coins: Coin[] = [];
  private spawnTimer = 0;
  private spawnInterval = 0.6;
  private spawnZ = 100;

  private flakeGroup: THREE.Group;

  constructor(game: Game) {
    this.game = game;
    this.flakeGroup = new THREE.Group();
  }

  private createSnowflake(): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xeeffff,
      metalness: 0.3,
      roughness: 0.1,
      emissive: 0x88ccff,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.9,
    });
    // 6 arms radiating from center
    for (let i = 0; i < 6; i++) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.03), mat);
      arm.rotation.z = (i / 6) * Math.PI * 2;
      arm.position.set(
        Math.sin(arm.rotation.z) * 0.2,
        Math.cos(arm.rotation.z) * 0.2,
        0
      );
      group.add(arm);
      // Small branch on each arm
      const branch = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.03), mat);
      branch.rotation.z = arm.rotation.z + 0.5;
      branch.position.set(
        Math.sin(arm.rotation.z) * 0.35 + Math.sin(arm.rotation.z + 0.5) * 0.06,
        Math.cos(arm.rotation.z) * 0.35 + Math.cos(arm.rotation.z + 0.5) * 0.06,
        0
      );
      group.add(branch);
    }
    // Center gem
    const center = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), mat);
    group.add(center);
    return group;
  }

  update(dt: number) {
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnCoins();
    }

    const moveAmount = this.game.speed * dt;
    const time = Date.now() * 0.003;

    for (const coin of this.coins) {
      if (!coin.active) continue;
      coin.mesh.position.z -= moveAmount;
      // Spin and float
      coin.mesh.rotation.y += dt * 2;
      coin.mesh.rotation.z += dt * 0.5;
      coin.mesh.position.y = coin.baseY + Math.sin(time + coin.mesh.position.z * 0.5) * 0.15;

      if (coin.mesh.position.z < -15) {
        coin.active = false;
        this.game.scene.remove(coin.mesh);
      }
    }

    this.coins = this.coins.filter(c => c.active);
  }

  private spawnCoins() {
    // Spawn a line of coins in a random lane
    const lane = Math.floor(Math.random() * 3) - 1;
    const count = 3 + Math.floor(Math.random() * 4);

    for (let i = 0; i < count; i++) {
      const coinZ = this.spawnZ + i * 2.5;
      const laneY = this.game.laneHeightMap.getHeight(lane, coinZ);
      const flake = this.createSnowflake();
      flake.position.set(
        lane * this.game.laneWidth,
        laneY + 1.2,
        this.spawnZ + i * 2.5
      );
      this.game.scene.add(flake);
      this.coins.push({ mesh: flake as any, baseY: laneY + 1.2, active: true });
    }
  }

  reset() {
    for (const coin of this.coins) {
      this.game.scene.remove(coin.mesh);
    }
    this.coins = [];
    this.spawnTimer = 0;
  }
}
