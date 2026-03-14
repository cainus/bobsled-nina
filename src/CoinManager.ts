import * as THREE from 'three';
import type { Game } from './Game';

export interface Coin {
  mesh: THREE.Mesh;
  active: boolean;
}

export class CoinManager {
  game: Game;
  coins: Coin[] = [];
  private spawnTimer = 0;
  private spawnInterval = 0.6;
  private spawnZ = 100;

  private coinGeo: THREE.CylinderGeometry;
  private coinMat: THREE.MeshStandardMaterial;

  constructor(game: Game) {
    this.game = game;
    this.coinGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.1, 12);
    this.coinMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.7,
      roughness: 0.2,
      emissive: 0xaa8800,
      emissiveIntensity: 0.3,
    });
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
      coin.mesh.rotation.y += dt * 3;
      coin.mesh.position.y = 1.2 + Math.sin(time + coin.mesh.position.z * 0.5) * 0.15;

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
      const mesh = new THREE.Mesh(this.coinGeo, this.coinMat);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(
        lane * this.game.laneWidth,
        1.2,
        this.spawnZ + i * 2.5
      );
      mesh.castShadow = true;
      this.game.scene.add(mesh);
      this.coins.push({ mesh, active: true });
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
