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

  // Snowfall system
  private snowflakes: THREE.Mesh[] = [];
  private snowActive = false;
  private snowGeo = new THREE.SphereGeometry(0.08, 4, 4);
  private snowflakeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
  private readonly SNOWFLAKE_COUNT = 300;

  private smallGeo = new THREE.SphereGeometry(0.06, 4, 4);
  private snowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  private collectMat = new THREE.MeshBasicMaterial({ color: 0xaaeeff });
  private fireColors = [0xff4400, 0xff8800, 0xffcc00, 0xff2200];
  private fireTimer = 0;

  constructor(game: Game) {
    this.game = game;
  }

  update(dt: number) {
    // Start snowfall at 1000 points
    if (!this.snowActive && this.game.score >= 1000) {
      this.startSnowfall();
    }

    // Update snowflakes
    if (this.snowActive) {
      this.updateSnowfall(dt);
    }

    // Spawn snow spray behind sled
    this.sprayTimer += dt;
    if (this.sprayTimer > 0.03) {
      this.sprayTimer = 0;
      this.spawnSnowSpray();
    }

    // Fire particles in metal mode
    if (this.game.metalMode) {
      this.fireTimer += dt;
      if (this.fireTimer > 0.015) {
        this.fireTimer = 0;
        this.spawnFire();
      }
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

  private spawnFire() {
    const playerPos = this.game.player.group.position;
    for (let i = 0; i < 3; i++) {
      const color = this.fireColors[Math.floor(Math.random() * this.fireColors.length)];
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
      const size = 0.08 + Math.random() * 0.06;
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 4, 4), mat);
      // Spawn behind and slightly to the sides (from ski/runner positions)
      const side = (Math.random() - 0.5) * 1.0;
      mesh.position.set(
        playerPos.x + side,
        playerPos.y + 0.1 + Math.random() * 0.2,
        playerPos.z - 1.4 - Math.random() * 0.5
      );
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        1.5 + Math.random() * 2.5,
        -3 - Math.random() * 2
      );
      this.game.scene.add(mesh);
      this.particles.push({ mesh, velocity, life: 0.25 + Math.random() * 0.2 });
    }
  }

  spawnCollectBurst(position: THREE.Vector3) {
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(this.smallGeo, this.collectMat.clone());
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

  private startSnowfall() {
    this.snowActive = true;
    const playerZ = this.game.player.group.position.z;
    for (let i = 0; i < this.SNOWFLAKE_COUNT; i++) {
      const mesh = new THREE.Mesh(this.snowGeo, this.snowflakeMat);
      mesh.position.set(
        (Math.random() - 0.5) * 40,
        5 + Math.random() * 20,
        playerZ + Math.random() * 120
      );
      this.game.scene.add(mesh);
      this.snowflakes.push(mesh);
    }
  }

  private updateSnowfall(dt: number) {
    const playerZ = this.game.player.group.position.z;
    const windy = this.game.score >= 1300;
    const blizzard = this.game.score >= 6000 && this.game.score < 7000;
    for (const flake of this.snowflakes) {
      const fallSpeed = blizzard ? 6 + Math.random() * 2 : 3 + Math.random() * 0.5;
      flake.position.y -= fallSpeed * dt;
      if (blizzard) {
        // Blizzard — very heavy sideways with chaotic movement
        flake.position.x += (14 + Math.sin(Date.now() * 0.002 + flake.position.z) * 5) * dt;
        flake.position.z -= (4 + Math.random() * 2) * dt;
      } else if (windy) {
        // Strong sideways blow with gusting
        flake.position.x += (8 + Math.sin(Date.now() * 0.001 + flake.position.z) * 3) * dt;
        flake.position.z -= (2 + Math.random()) * dt;
      } else {
        flake.position.x += Math.sin(flake.position.y * 0.5) * 0.5 * dt;
      }

      // Reset snowflake if it falls below ground, gets too far behind, or blows off to the side
      if (flake.position.y < -1 || flake.position.z < playerZ - 15 || Math.abs(flake.position.x) > 30) {
        flake.position.set(
          windy ? -20 + Math.random() * 15 : (Math.random() - 0.5) * 40,
          15 + Math.random() * 10,
          playerZ + 20 + Math.random() * 100
        );
      }
    }
  }

  reset() {
    for (const p of this.particles) {
      this.game.scene.remove(p.mesh);
    }
    this.particles = [];
    for (const f of this.snowflakes) {
      this.game.scene.remove(f);
    }
    this.snowflakes = [];
    this.snowActive = false;
  }
}
