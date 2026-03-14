import * as THREE from 'three';
import type { Game } from './Game';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
}

export class ParticleManager {
  game: Game;
  private particles: Particle[] = [];

  // Snow spray particles behind the sled
  private sprayTimer = 0;

  private smallGeo = new THREE.SphereGeometry(0.06, 4, 4);
  private snowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  private goldMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });

  constructor(game: Game) {
    this.game = game;
  }

  update(dt: number) {
    // Spawn snow spray behind sled
    this.sprayTimer += dt;
    if (this.sprayTimer > 0.03) {
      this.sprayTimer = 0;
      this.spawnSnowSpray();
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.game.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
      p.velocity.y -= 8 * dt; // gravity
      p.mesh.material = p.mesh.material as THREE.MeshBasicMaterial;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = p.life;
    }
  }

  private spawnSnowSpray() {
    const playerPos = this.game.player.group.position;
    for (let i = 0; i < 2; i++) {
      const mesh = new THREE.Mesh(this.smallGeo, this.snowMat.clone());
      (mesh.material as THREE.MeshBasicMaterial).transparent = true;
      mesh.position.set(
        playerPos.x + (Math.random() - 0.5) * 1.2,
        playerPos.y + 0.1,
        playerPos.z - 1.2 + Math.random() * 0.3
      );
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        1 + Math.random() * 2,
        -2 - Math.random() * 2
      );
      this.game.scene.add(mesh);
      this.particles.push({ mesh, velocity, life: 0.4 + Math.random() * 0.3 });
    }
  }

  spawnCoinBurst(position: THREE.Vector3) {
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(this.smallGeo, this.goldMat.clone());
      (mesh.material as THREE.MeshBasicMaterial).transparent = true;
      mesh.position.copy(position);
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 5,
        2 + Math.random() * 4,
        (Math.random() - 0.5) * 5
      );
      this.game.scene.add(mesh);
      this.particles.push({ mesh, velocity, life: 0.5 + Math.random() * 0.3 });
    }
  }

  reset() {
    for (const p of this.particles) {
      this.game.scene.remove(p.mesh);
    }
    this.particles = [];
  }
}
