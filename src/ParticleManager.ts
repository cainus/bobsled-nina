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
  private blizzardFlakes: THREE.Mesh[] = [];
  private blizzardActive = false;
  private rainDrops: THREE.Mesh[] = [];
  private rainActive = false;
  private cameraDropTimer = 0;
  private cameraDropElements: { el: HTMLElement; life: number }[] = [];

  private smallGeo = new THREE.SphereGeometry(0.06, 4, 4);
  private snowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  private collectMat = new THREE.MeshBasicMaterial({ color: 0xaaeeff });
  private fireColors = [0xff4400, 0xff8800, 0xffcc00, 0xff2200];
  private fireTimer = 0;

  constructor(game: Game) {
    this.game = game;
  }

  update(dt: number) {
    // Snowfall only in winter
    const isWinter = this.game.seasonManager.season === 'winter';
    if (!this.snowActive && isWinter && this.game.score >= 1000) {
      this.startSnowfall();
    }
    if (this.snowActive && !isWinter) {
      this.stopSnowfall();
    }

    // Blizzard only in winter
    const isBlizzard = isWinter && this.game.environmentManager.isBlizzard;
    if (isBlizzard && !this.blizzardActive) {
      this.startBlizzardFlakes();
    } else if (!isBlizzard && this.blizzardActive) {
      this.stopBlizzardFlakes();
    }

    // Rain in spring (all times of day)
    const isSpring = this.game.seasonManager.season === 'spring';
    const springRainTime = isSpring;
    if (springRainTime && !this.rainActive) {
      this.startRain();
    } else if (!springRainTime && this.rainActive) {
      this.stopRain();
    }

    // Update snowflakes
    if (this.snowActive) {
      this.updateSnowfall(dt);
    }
    if (this.blizzardActive) {
      this.updateBlizzardFlakes(dt);
    }
    if (this.rainActive) {
      this.updateRain(dt);
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

  private stopSnowfall() {
    this.snowActive = false;
    for (const f of this.snowflakes) {
      this.game.scene.remove(f);
    }
    this.snowflakes = [];
  }

  private updateSnowfall(dt: number) {
    const playerZ = this.game.player.group.position.z;
    const windy = this.game.score >= 1300;
    const blizzard = this.game.score >= 6000 && this.game.score < 7000;
    const isNight = this.game.environmentManager.isNight;

    // At night, hide most snowflakes so visibility stays clear
    for (let i = 0; i < this.snowflakes.length; i++) {
      this.snowflakes[i].visible = !isNight || i < 20;
    }

    for (const flake of this.snowflakes) {
      if (!flake.visible) continue;
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

  private startBlizzardFlakes() {
    this.blizzardActive = true;
    const playerZ = this.game.player.group.position.z;
    // 500 extra flakes, many close to camera
    for (let i = 0; i < 500; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
      const size = 0.05 + Math.random() * 0.12;
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 4, 4), mat);
      mesh.position.set(
        (Math.random() - 0.5) * 30,
        Math.random() * 15,
        playerZ - 10 + Math.random() * 60  // many close to/behind camera
      );
      this.game.scene.add(mesh);
      this.blizzardFlakes.push(mesh);
    }
  }

  private updateBlizzardFlakes(dt: number) {
    const playerZ = this.game.player.group.position.z;
    for (const flake of this.blizzardFlakes) {
      flake.position.y -= (5 + Math.random() * 3) * dt;
      flake.position.x += (12 + Math.sin(Date.now() * 0.003 + flake.position.y * 2) * 6) * dt;
      flake.position.z -= (3 + Math.random() * 2) * dt;

      if (flake.position.y < -1 || flake.position.z < playerZ - 15 || Math.abs(flake.position.x) > 25) {
        flake.position.set(
          -15 + Math.random() * 10,
          2 + Math.random() * 12,
          playerZ - 5 + Math.random() * 40
        );
      }
    }
  }

  private stopBlizzardFlakes() {
    this.blizzardActive = false;
    for (const f of this.blizzardFlakes) {
      this.game.scene.remove(f);
    }
    this.blizzardFlakes = [];
  }

  private startRain() {
    this.rainActive = true;
    const playerZ = this.game.player.group.position.z;
    const rainMat = new THREE.MeshBasicMaterial({ color: 0x8899aa, transparent: true, opacity: 0.6 });
    const rainGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.4, 4);
    for (let i = 0; i < 1500; i++) {
      const drop = new THREE.Mesh(rainGeo, rainMat);
      drop.position.set(
        (Math.random() - 0.5) * 40,
        Math.random() * 20,
        playerZ + Math.random() * 100
      );
      this.game.scene.add(drop);
      this.rainDrops.push(drop);
    }
  }

  private updateRain(dt: number) {
    const playerZ = this.game.player.group.position.z;
    for (const drop of this.rainDrops) {
      drop.position.y -= 30 * dt;
      if (drop.position.y < 0 || drop.position.z < playerZ - 15) {
        drop.position.set(
          (Math.random() - 0.5) * 40,
          15 + Math.random() * 10,
          playerZ + 10 + Math.random() * 90
        );
      }
    }

    // Camera raindrop splashes
    this.cameraDropTimer -= dt;
    if (this.cameraDropTimer <= 0) {
      this.cameraDropTimer = 0.1 + Math.random() * 0.3;
      this.spawnCameraDrop();
    }

    // Update existing camera drops
    for (let i = this.cameraDropElements.length - 1; i >= 0; i--) {
      const cd = this.cameraDropElements[i];
      cd.life -= dt;
      if (cd.life <= 0) {
        cd.el.remove();
        this.cameraDropElements.splice(i, 1);
      } else {
        cd.el.style.opacity = String(cd.life * 0.8);
      }
    }
  }

  private spawnCameraDrop() {
    const el = document.createElement('div');
    const size = 30 + Math.random() * 60;
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    el.style.cssText = `
      position: fixed;
      left: ${x}%;
      top: ${y}%;
      width: ${size}px;
      height: ${size * 1.3}px;
      border-radius: 50%;
      background: radial-gradient(ellipse, rgba(180,200,220,0.3) 0%, rgba(180,200,220,0.1) 40%, transparent 70%);
      pointer-events: none;
      z-index: 10;
    `;
    document.body.appendChild(el);
    this.cameraDropElements.push({ el, life: 0.8 + Math.random() * 0.6 });
  }

  private stopRain() {
    this.rainActive = false;
    for (const drop of this.rainDrops) {
      this.game.scene.remove(drop);
    }
    this.rainDrops = [];
    for (const cd of this.cameraDropElements) {
      cd.el.remove();
    }
    this.cameraDropElements = [];
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
    this.stopBlizzardFlakes();
    this.stopRain();
  }
}
