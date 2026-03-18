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
    if (this.game.seasonManager.season === 'autumn') {
      return this.createMapleLeaf();
    }
    if (this.game.seasonManager.season === 'summer') {
      return this.createSeashellCollectible();
    }
    if (this.game.seasonManager.season === 'spring') {
      return this.createWaterDrop();
    }

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

  private createMapleLeaf(): THREE.Group {
    const group = new THREE.Group();
    const leafColors = [0xcc2200, 0xff4400, 0xff6600, 0xee3300];
    const color = leafColors[Math.floor(Math.random() * leafColors.length)];
    const mat = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.1,
      roughness: 0.4,
      emissive: color,
      emissiveIntensity: 0.3,
      side: THREE.DoubleSide,
    });

    // Canadian maple leaf from SVG path (based on Font Awesome canadian-maple-leaf)
    // Original is 512x512, centered at (256, 256). Scale and center it.
    const shape = new THREE.Shape();
    const sc = 0.0016; // scale to ~0.8 units wide
    const cx = 256, cy = 256; // center offset
    // Trace the outline points (simplified from SVG)
    const pts: [number, number][] = [
      [256, 0],     // top point
      [214, 79],    // left of top
      [173, 74],    // notch
      [128, 167],   // left upper lobe tip
      [158, 177],   // notch back
      [110, 240],   // left middle lobe
      [143, 244],   // notch back
      [25, 259],    // left lower lobe tip
      [40, 272],    // notch
      [56, 290],    // lower left
      [20, 330],    // bottom-left lobe
      [95, 313],    // notch back
      [96, 340],    // bottom indent
      [123, 409],   // left base
      [241, 389],   // left of stem base
      [247, 512],   // stem bottom-left
      [256, 512],   // stem bottom-center
      [265, 512],   // stem bottom-right
      [271, 389],   // right of stem base
      [389, 409],   // right base
      [416, 340],   // bottom indent
      [417, 313],   // notch back
      [492, 330],   // bottom-right lobe
      [456, 290],   // lower right
      [472, 272],   // notch
      [487, 259],   // right lower lobe tip
      [369, 244],   // notch back
      [402, 240],   // right middle lobe
      [354, 177],   // notch back
      [384, 167],   // right upper lobe tip
      [339, 74],    // notch
      [298, 79],    // right of top
    ];
    // Convert to centered, scaled coordinates (flip Y so top is up)
    shape.moveTo((pts[0][0] - cx) * sc, (cy - pts[0][1]) * sc);
    for (let i = 1; i < pts.length; i++) {
      shape.lineTo((pts[i][0] - cx) * sc, (cy - pts[i][1]) * sc);
    }
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false });
    const leaf = new THREE.Mesh(geo, mat);
    leaf.castShadow = true;
    group.add(leaf);

    // Stem
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.15, 6), stemMat);
    stem.position.set(0, -0.5, 0.015);
    group.add(stem);

    return group;
  }

  private createWaterDrop(): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x44aaff,
      metalness: 0.4,
      roughness: 0.1,
      emissive: 0x2288dd,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.85,
    });

    // 3D teardrop from spheres — round bottom, tapered top
    // Main body — sphere
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mat);
    body.position.y = -0.05;
    group.add(body);

    // Tapered top — cone pointing up
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 10), mat);
    tip.position.y = 0.22;
    group.add(tip);

    // Highlight gleam
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), hlMat);
    hl.position.set(0.08, 0.05, 0.15);
    group.add(hl);

    return group;
  }

  private createSeashellCollectible(): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.2,
    });

    // Simple clam shell — fan-shaped with minimal thickness
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 8, 1, false, 0, Math.PI), mat);
    shell.position.y = 0.0;
    shell.rotation.z = Math.PI / 2;
    shell.castShadow = true;
    group.add(shell);

    group.scale.setScalar(1.5);
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
      const s = this.game.seasonManager.season;
      if (s !== 'autumn' && s !== 'spring') {
        coin.mesh.rotation.z += dt * 0.5;
      }
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
