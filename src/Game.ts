import * as THREE from 'three';
import { Player } from './Player';
import { TrackManager } from './TrackManager';
import { ObstacleManager } from './ObstacleManager';
import { CoinManager } from './CoinManager';
import { InputManager } from './InputManager';
import { ParticleManager } from './ParticleManager';
import { SoundManager } from './SoundManager';
import { LaneHeightMap } from './LaneHeightMap';

export class Game {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  player: Player;
  trackManager: TrackManager;
  obstacleManager: ObstacleManager;
  coinManager: CoinManager;
  inputManager: InputManager;
  particleManager: ParticleManager;
  soundManager: SoundManager;
  laneHeightMap: LaneHeightMap;

  clock: THREE.Clock;
  running = false;
  gameOver = false;
  score = 0;
  coins = 0;
  speed = 0;
  readonly baseSpeed = 25;
  readonly maxSpeed = 55;
  readonly acceleration = 0.3; // speed increase per second

  // Lane positions: -1 = left, 0 = center, 1 = right
  readonly laneWidth = 3;

  // Power-ups
  private bobsledShield = false;
  private bobsledHitsLeft = 0;
  private preShieldVehicle: 'skis' | 'snowboard' | 'rainbowSkis' = 'skis';
  private powerups: { mesh: THREE.Group; active: boolean; type: 'bobsled' | 'metal' }[] = [];
  private powerupSpawnTimer = 0;

  // Heavy metal mode
  private metalMode = false;

  // Environment transitions
  private isNight = false;
  private isBlizzard = false;
  private stars: THREE.Points | null = null;
  private ambientLight!: THREE.AmbientLight;
  private sunLight!: THREE.DirectionalLight;

  // Dynamic steepness (always downhill)
  private steepness = 0.5; // 0 = gentle, 1 = steep
  private steepnessTarget = 0.5;
  private steepnessTimer = 0;

  // Side bears (appear at 1700 pts, max once per 1000 pts)
  private bears: { mesh: THREE.Group; hasGrowled: boolean }[] = [];
  private nextBearScore = 0; // score threshold for next bear spawn

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 60, 140);

    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );
    this.camera.position.set(0, 12, -14);
    this.camera.lookAt(0, 0, 25);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.prepend(this.renderer.domElement);

    this.clock = new THREE.Clock();
    this.laneHeightMap = new LaneHeightMap();
    this.inputManager = new InputManager();
    this.player = new Player(this);
    this.trackManager = new TrackManager(this);
    this.obstacleManager = new ObstacleManager(this);
    this.coinManager = new CoinManager(this);
    this.particleManager = new ParticleManager(this);
    this.soundManager = new SoundManager(this);

    this.setupLighting();
    this.setupGround();
    this.setupResizeHandler();

    // Render initial frame
    this.renderer.render(this.scene, this.camera);
  }

  private setupLighting() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    const sun = this.sunLight;
    sun.position.set(10, 20, -5);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 100;
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -10;
    this.scene.add(sun);

    // Subtle blue fill light from the sky
    const fillLight = new THREE.HemisphereLight(0xdce8f0, 0x444444, 0.4);
    this.scene.add(fillLight);
  }

  private setupGround() {
    const groundGeo = new THREE.PlaneGeometry(500, 500);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Distant mountain range
    this.createMountains();
  }

  private createMountains() {
    const mountainMat = new THREE.MeshStandardMaterial({ color: 0x8899aa });
    const snowPeakMat = new THREE.MeshStandardMaterial({ color: 0xf0f4f8 });

    // Mountain peaks placed within fog range so they're visible but misty
    // Camera is at z=-14, fog ends at 140 units from camera (z=126)
    // Place mountains at z=80-120 so peaks poke through the fog
    const peaks = [
      { x: -70, z: 100, size: 40, height: 60 },
      { x: -25, z: 115, size: 50, height: 80 },
      { x: 30, z: 105, size: 45, height: 70 },
      { x: 80, z: 110, size: 55, height: 85 },
      { x: -110, z: 95, size: 45, height: 55 },
      { x: 120, z: 100, size: 40, height: 50 },
      { x: -50, z: 120, size: 60, height: 55 },
      { x: 55, z: 120, size: 50, height: 50 },
    ];

    for (const peak of peaks) {
      // Mountain body
      const geo = new THREE.ConeGeometry(peak.size, peak.height, 7);
      const mountain = new THREE.Mesh(geo, mountainMat);
      mountain.position.set(peak.x, peak.height / 2 - 8, peak.z);
      mountain.rotation.y = Math.random() * Math.PI;
      this.scene.add(mountain);

      // Snow cap on upper portion
      const capSize = peak.size * 0.5;
      const capHeight = peak.height * 0.4;
      const capGeo = new THREE.ConeGeometry(capSize, capHeight, 7);
      const cap = new THREE.Mesh(capGeo, snowPeakMat);
      cap.position.set(peak.x, peak.height - 8 - capHeight / 2, peak.z);
      cap.rotation.y = mountain.rotation.y;
      this.scene.add(cap);
    }
  }

  private updateBears(dt: number) {
    // Schedule first bear at a random point between 1700-2700
    if (this.nextBearScore === 0) {
      this.nextBearScore = 1700 + Math.floor(Math.random() * 1000);
    }

    // Spawn bear when score passes the threshold
    if (this.score >= this.nextBearScore) {
      this.spawnBear();
      this.nextBearScore = this.score + 1000 + Math.floor(Math.random() * 1000);
    }

    const moveAmount = this.speed * dt;
    for (let i = this.bears.length - 1; i >= 0; i--) {
      const bear = this.bears[i];
      bear.mesh.position.z -= moveAmount;

      // Growl when bear is approaching (~3s ahead at current speed)
      const growlDist = this.speed * 3;
      if (!bear.hasGrowled && bear.mesh.position.z < growlDist && bear.mesh.position.z > -5) {
        bear.hasGrowled = true;
        this.soundManager.playGrowl();
      }

      // Remove when far behind
      if (bear.mesh.position.z < -20) {
        this.scene.remove(bear.mesh);
        this.bears.splice(i, 1);
      }
    }
  }

  private spawnBear() {
    const bear = this.createBear();
    const side = Math.random() > 0.5 ? 1 : -1;
    bear.position.set(
      side * (8 + Math.random() * 5),
      0,
      100
    );
    // Face toward the track
    bear.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    this.scene.add(bear);
    this.bears.push({ mesh: bear, hasGrowled: false });
  }

  private createBear(): THREE.Group {
    const group = new THREE.Group();
    const furMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.9 });
    const darkFurMat = new THREE.MeshStandardMaterial({ color: 0x4a2e15, roughness: 0.95 });
    const noseMat = new THREE.MeshStandardMaterial({ color: 0x222222 });

    // Body — large oval
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), furMat);
    body.position.y = 1.0;
    body.scale.set(1, 0.85, 1.3);
    body.castShadow = true;
    group.add(body);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), furMat);
    head.position.set(0, 1.6, -0.9);
    head.scale.set(1, 0.9, 1);
    head.castShadow = true;
    group.add(head);

    // Snout
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), darkFurMat);
    snout.position.set(0, 1.5, -1.35);
    snout.scale.set(1, 0.7, 1.2);
    group.add(snout);

    // Nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), noseMat);
    nose.position.set(0, 1.55, -1.5);
    group.add(nose);

    // Eyes
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    for (const side of [-0.18, 0.18]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), eyeMat);
      eye.position.set(side, 1.7, -1.3);
      group.add(eye);
    }

    // Ears
    for (const side of [-0.3, 0.3]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), darkFurMat);
      ear.position.set(side, 2.0, -0.8);
      group.add(ear);
    }

    // Legs — 4 stubby cylinders
    const legGeo = new THREE.CylinderGeometry(0.18, 0.2, 0.7, 8);
    const legPositions: [number, number][] = [[-0.45, -0.6], [0.45, -0.6], [-0.4, 0.5], [0.4, 0.5]];
    for (const [lx, lz] of legPositions) {
      const leg = new THREE.Mesh(legGeo, darkFurMat);
      leg.position.set(lx, 0.35, lz);
      leg.castShadow = true;
      group.add(leg);
    }

    // Tail
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), furMat);
    tail.position.set(0, 1.2, 0.9);
    group.add(tail);

    // Scale up a bit — bears are big
    group.scale.setScalar(1.4);
    return group;
  }

  private resetBears() {
    for (const bear of this.bears) {
      this.scene.remove(bear.mesh);
    }
    this.bears = [];
    this.nextBearScore = 0;
  }

  private updateEnvironment() {
    // Blizzard: 6000-7000 points — heavy snow, loud wind
    if (this.score >= 6000 && this.score < 7000) {
      if (!this.isBlizzard) {
        this.isBlizzard = true;
        this.soundManager.setWindVolume(0.45);
      }
    } else if (this.isBlizzard) {
      this.isBlizzard = false;
      this.soundManager.setWindVolume(0.18);
    }

    // Night: 5000-10000 points
    if (this.score >= 5000 && this.score < 10000) {
      if (!this.isNight) {
        this.isNight = true;
        this.createStars();
      }
      // Gradual transition to night
      const nightProgress = Math.min((this.score - 5000) / 1000, 1);
      const bgR = 0x87 * (1 - nightProgress * 0.85);
      const bgG = 0xce * (1 - nightProgress * 0.85);
      const bgB = 0xeb * (1 - nightProgress * 0.7);
      const bgColor = new THREE.Color(bgR / 255, bgG / 255, bgB / 255);
      this.scene.background = bgColor;
      this.scene.fog = new THREE.Fog(bgColor, 60, 140);
      this.ambientLight.intensity = 0.6 - nightProgress * 0.35;
      this.sunLight.intensity = 1.0 - nightProgress * 0.7;
      this.sunLight.color.setHex(
        nightProgress > 0.5 ? 0x8888cc : 0xffffff
      );
    } else if (this.score >= 10000 && this.isNight) {
      // Transition back to day
      this.isNight = false;
      this.scene.background = new THREE.Color(0x87ceeb);
      this.scene.fog = new THREE.Fog(0x87ceeb, 60, 140);
      this.ambientLight.intensity = 0.6;
      this.sunLight.intensity = 1.0;
      this.sunLight.color.setHex(0xffffff);
      if (this.stars) {
        this.scene.remove(this.stars);
        this.stars = null;
      }
    }
  }

  private createStars() {
    if (this.stars) return;
    const starCount = 500;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 300;
      positions[i * 3 + 1] = 30 + Math.random() * 70;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 300;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.5,
      transparent: true,
      opacity: 0.8,
    });
    this.stars = new THREE.Points(geo, mat);
    this.scene.add(this.stars);
  }

  private resetEnvironment() {
    this.isNight = false;
    this.isBlizzard = false;
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 60, 140);
    this.ambientLight.intensity = 0.6;
    this.sunLight.intensity = 1.0;
    this.sunLight.color.setHex(0xffffff);
    if (this.stars) {
      this.scene.remove(this.stars);
      this.stars = null;
    }
  }

  private resetPowerups() {
    for (const pu of this.powerups) {
      this.scene.remove(pu.mesh);
    }
    this.powerups = [];
    this.powerupSpawnTimer = 0;
    this.bobsledShield = false;
    this.bobsledHitsLeft = 0;
    this.metalMode = false;
    this.soundManager.stopThrash();
    document.getElementById('shield-display')!.style.display = 'none';
    document.getElementById('metal-display')!.style.display = 'none';
  }

  private setupResizeHandler() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  start() {
    this.running = true;
    this.gameOver = false;
    this.score = 0;
    this.coins = 0;
    this.speed = this.baseSpeed;
    this.clock.start();
    this.soundManager.startSliding();
    this.soundManager.loadGrunts();
    this.soundManager.loadGrowls();
    this.update();
  }

  restart() {
    // Clear old objects
    this.laneHeightMap.reset();
    this.obstacleManager.reset();
    this.coinManager.reset();
    this.particleManager.reset();
    this.soundManager.reset();
    this.resetBears();
    this.resetPowerups();
    this.resetEnvironment();
    this.player.reset();
    this.trackManager.reset();
    this.start();
  }

  private update() {
    if (!this.running) return;

    const delta = this.clock.getDelta();
    // Cap delta to avoid physics explosions on tab-switch
    const dt = Math.min(delta, 0.05);

    // Dynamic steepness — changes every few seconds
    this.steepnessTimer -= dt;
    if (this.steepnessTimer <= 0) {
      this.steepnessTarget = 0.2 + Math.random() * 0.8;
      this.steepnessTimer = 3 + Math.random() * 5;
    }
    this.steepness += (this.steepnessTarget - this.steepness) * 2 * dt;

    // Update camera tilt based on steepness
    const camY = 10 + this.steepness * 4;
    const lookY = 2 - this.steepness * 4;
    this.camera.position.y = camY;
    this.camera.lookAt(0, lookY, 25);

    // Increase speed over time — steepness gives a speed boost
    const steepnessBoost = this.steepness * 12;
    const metalBoost = this.metalMode ? this.maxSpeed * 0.5 : 0;
    this.speed = Math.min(this.speed + this.acceleration * dt, this.maxSpeed + steepnessBoost + metalBoost);

    // Process input
    const input = this.inputManager.consume();
    this.player.handleInput(input);

    // Update game objects
    this.player.update(dt);
    this.trackManager.update(dt);
    this.obstacleManager.update(dt);
    this.coinManager.update(dt);
    this.particleManager.update(dt);

    // Update bobsled power-ups
    this.updatePowerups(dt);

    // Check collisions
    this.checkCollisions();

    // Update sound
    this.soundManager.setSlidingMuted(this.player.isJumping);
    this.soundManager.updateSlidingPitch(this.speed);

    // Update score (distance-based, 2x in metal mode)
    this.score += Math.round(this.speed * dt * (this.metalMode ? 2 : 1));
    document.getElementById('score')!.textContent = this.score.toString();
    document.getElementById('coins-display')!.textContent = `Snowflakes: ${this.coins}`;

    // Vehicle upgrades based on score (skip if in bobsled power-up)
    if (!this.bobsledShield) {
      if (this.score >= 1500) {
        this.player.switchVehicle('rainbowSkis');
      } else if (this.score >= 1000) {
        this.player.switchVehicle('snowboard');
      }
    }

    // Wind at 1300 points
    if (this.score >= 1300) {
      this.soundManager.startWind();
    }

    // Bears at 1700 points
    if (this.score >= 1700) {
      this.updateBears(dt);
    }

    // Environment transitions
    this.updateEnvironment();

    // Render
    this.renderer.render(this.scene, this.camera);

    if (!this.gameOver) {
      requestAnimationFrame(() => this.update());
    }
  }

  private checkCollisions() {
    const playerBox = this.player.getCollisionBox();

    // Check obstacles
    for (const obstacle of this.obstacleManager.obstacles) {
      if (!obstacle.active) continue;
      // Force world matrix update so child colliders have correct positions
      obstacle.mesh.updateMatrixWorld(true);
      const colliderObj = obstacle.collider ?? obstacle.mesh;
      const obstacleBox = new THREE.Box3().setFromObject(colliderObj);
      // Shrink collision box slightly for fairness
      obstacleBox.expandByScalar(-0.15);
      if (playerBox.intersectsBox(obstacleBox)) {
        if (this.metalMode) {
          // Metal mode ends on hit — destroy obstacle but survive
          obstacle.active = false;
          this.scene.remove(obstacle.mesh);
          this.deactivateMetalMode();
          continue;
        }
        if (this.bobsledShield) {
          // Destroy obstacle and use a shield hit
          obstacle.active = false;
          this.scene.remove(obstacle.mesh);
          this.bobsledHitsLeft--;
          this.showShieldHit();
          if (this.bobsledHitsLeft <= 0) {
            this.deactivateShield();
          }
          continue;
        }
        this.endGame();
        return;
      }

      // Jump bonus — player is in the air and obstacle passes underneath
      if (this.player.isJumping && !obstacle.jumpScored) {
        const obsZ = obstacle.mesh.position.z;
        const playerX = this.player.group.position.x;
        const obsX = obstacle.mesh.position.x;
        // Check if obstacle is in the same lane (close in X) and just passed the player
        if (Math.abs(obsX - playerX) < this.laneWidth * 0.7 &&
            obsZ < 1 && obsZ > -3) {
          obstacle.jumpScored = true;
          this.score += 50;
          this.showJumpBonus();
        }
      }
    }

    // Check snowflake collectibles
    for (const coin of this.coinManager.coins) {
      if (!coin.active) continue;
      const coinBox = new THREE.Box3().setFromObject(coin.mesh);
      if (playerBox.intersectsBox(coinBox)) {
        coin.active = false;
        this.scene.remove(coin.mesh);
        this.coins++;
        this.particleManager.spawnCollectBurst(coin.mesh.position);
        this.soundManager.playCollect();
      }
    }
  }

  private updatePowerups(dt: number) {
    // Spawn power-ups periodically
    this.powerupSpawnTimer += dt;
    if (this.powerupSpawnTimer > 12 + Math.random() * 15) {
      this.powerupSpawnTimer = 0;
      const type = Math.random() > 0.5 ? 'bobsled' : 'metal';
      if (type === 'bobsled' && this.bobsledShield) return;
      if (type === 'metal' && this.metalMode) return;
      this.spawnPowerup(type);
    }

    const moveAmount = this.speed * dt;
    const playerBox = this.player.getCollisionBox();

    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pu = this.powerups[i];
      if (!pu.active) continue;
      pu.mesh.position.z -= moveAmount;
      pu.mesh.rotation.y += dt * 2;

      // Check collection
      const puBox = new THREE.Box3().setFromObject(pu.mesh);
      if (playerBox.intersectsBox(puBox)) {
        pu.active = false;
        this.scene.remove(pu.mesh);
        if (pu.type === 'bobsled') {
          this.activateShield();
        } else {
          this.activateMetalMode();
        }
        this.powerups.splice(i, 1);
        continue;
      }

      if (pu.mesh.position.z < -15) {
        pu.active = false;
        this.scene.remove(pu.mesh);
        this.powerups.splice(i, 1);
      }
    }
  }

  private spawnPowerup(type: 'bobsled' | 'metal') {
    const lane = Math.floor(Math.random() * 3) - 1;
    const laneY = this.laneHeightMap.getHeight(lane, 100);
    const mesh = type === 'bobsled' ? this.createPowerupMesh() : this.createWalkmanMesh();
    mesh.position.set(lane * this.laneWidth, laneY + 0.8, 100);
    this.scene.add(mesh);
    this.powerups.push({ mesh, active: true, type });
  }

  private createPowerupMesh(): THREE.Group {
    const group = new THREE.Group();
    // Miniature bobsled with a glow
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xe63946,
      emissive: 0xff4444,
      emissiveIntensity: 0.4,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.3, 1.8), bodyMat);
    body.position.y = 0.15;
    body.castShadow = true;
    group.add(body);

    // Front curve
    const front = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.5, 0.35, 8, 1, false, 0, Math.PI),
      bodyMat);
    front.rotation.x = Math.PI / 2;
    front.rotation.z = Math.PI;
    front.position.set(0, 0.2, 1.0);
    group.add(front);

    // Runners
    const runnerMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.1 });
    for (const side of [-0.4, 0.4]) {
      const runner = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 2.0), runnerMat);
      runner.position.set(side, -0.05, 0);
      group.add(runner);
    }

    // Floating shield icon above
    const shieldGeo = new THREE.OctahedronGeometry(0.3, 0);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffaa00,
      emissiveIntensity: 0.6,
      metalness: 0.8,
      roughness: 0.1,
    });
    const shield = new THREE.Mesh(shieldGeo, shieldMat);
    shield.position.y = 1.2;
    group.add(shield);

    group.scale.setScalar(0.8);
    return group;
  }

  private activateShield() {
    this.bobsledShield = true;
    this.bobsledHitsLeft = 3;
    const v = this.player.currentVehicle;
    if (v !== 'bobsled') {
      this.preShieldVehicle = v as 'skis' | 'snowboard' | 'rainbowSkis';
    }
    this.player.switchVehicle('bobsled');
    this.soundManager.playCollect();
    // Show shield indicator
    const el = document.getElementById('shield-display')!;
    el.style.display = 'block';
    el.textContent = '🛷 x3';
  }

  private deactivateShield() {
    this.bobsledShield = false;
    this.bobsledHitsLeft = 0;
    // Revert to appropriate vehicle for current score
    if (this.score >= 1500) {
      this.player.switchVehicle('rainbowSkis');
    } else if (this.score >= 1000) {
      this.player.switchVehicle('snowboard');
    } else {
      this.player.switchVehicle(this.preShieldVehicle);
    }
    document.getElementById('shield-display')!.style.display = 'none';
  }

  private createWalkmanMesh(): THREE.Group {
    const group = new THREE.Group();
    // Walkman body
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      emissive: 0x440066,
      emissiveIntensity: 0.4,
      metalness: 0.6,
      roughness: 0.3,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.25), bodyMat);
    body.position.y = 0.5;
    body.castShadow = true;
    group.add(body);

    // Screen/display
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x88ff88,
      emissive: 0x44ff44,
      emissiveIntensity: 0.6,
    });
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.3, 0.02), screenMat);
    screen.position.set(0, 0.7, 0.14);
    group.add(screen);

    // Buttons
    const btnMat = new THREE.MeshStandardMaterial({ color: 0xcc0000 });
    for (const x of [-0.15, 0, 0.15]) {
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 8), btnMat);
      btn.rotation.x = Math.PI / 2;
      btn.position.set(x, 0.35, 0.14);
      group.add(btn);
    }

    // Headphone cord
    const cordMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 6), cordMat);
    cord.position.set(0, 1.3, 0);
    group.add(cord);

    // Headphone pads
    for (const side of [-0.25, 0.25]) {
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), bodyMat);
      pad.position.set(side, 1.6, 0);
      group.add(pad);
    }
    // Headband
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.02, 6, 12, Math.PI), cordMat);
    band.position.set(0, 1.6, 0);
    group.add(band);

    // Floating lightning bolt above
    const boltMat = new THREE.MeshStandardMaterial({
      color: 0xffdd00,
      emissive: 0xffaa00,
      emissiveIntensity: 0.8,
    });
    const bolt = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), boltMat);
    bolt.position.y = 2.2;
    group.add(bolt);

    group.scale.setScalar(0.7);
    return group;
  }

  private activateMetalMode() {
    this.metalMode = true;
    this.soundManager.startThrash();
    this.player.setMetalMode(true);
    const el = document.getElementById('metal-display')!;
    el.style.display = 'block';
  }

  private deactivateMetalMode() {
    this.metalMode = false;
    this.soundManager.stopThrash();
    this.player.setMetalMode(false);
    document.getElementById('metal-display')!.style.display = 'none';
    // Show end notification
    const el = document.createElement('div');
    el.textContent = 'METAL OVER!';
    el.style.cssText = 'position:absolute;top:45%;left:50%;transform:translate(-50%,-50%);color:#ff4444;font-size:32px;font-weight:bold;text-shadow:2px 2px 4px rgba(0,0,0,0.7);pointer-events:none;transition:all 0.5s ease-out;opacity:1;';
    document.getElementById('ui-overlay')!.appendChild(el);
    requestAnimationFrame(() => { el.style.top = '35%'; el.style.opacity = '0'; });
    setTimeout(() => el.remove(), 600);
  }

  private showShieldHit() {
    document.getElementById('shield-display')!.textContent = `🛷 x${this.bobsledHitsLeft}`;
    const el = document.createElement('div');
    el.textContent = 'CRASH!';
    el.style.cssText = 'position:absolute;top:45%;left:50%;transform:translate(-50%,-50%);color:#ff4444;font-size:32px;font-weight:bold;text-shadow:2px 2px 4px rgba(0,0,0,0.7);pointer-events:none;transition:all 0.5s ease-out;opacity:1;';
    document.getElementById('ui-overlay')!.appendChild(el);
    requestAnimationFrame(() => {
      el.style.top = '35%';
      el.style.opacity = '0';
    });
    setTimeout(() => el.remove(), 600);
  }

  private showJumpBonus() {
    const el = document.createElement('div');
    el.textContent = '+50';
    el.style.cssText = 'position:absolute;top:40%;left:50%;transform:translate(-50%,-50%);color:#ffd700;font-size:36px;font-weight:bold;text-shadow:2px 2px 4px rgba(0,0,0,0.7);pointer-events:none;transition:all 0.6s ease-out;opacity:1;';
    document.getElementById('ui-overlay')!.appendChild(el);
    requestAnimationFrame(() => {
      el.style.top = '30%';
      el.style.opacity = '0';
    });
    setTimeout(() => el.remove(), 700);
  }

  private endGame() {
    this.gameOver = true;
    this.running = false;
    this.soundManager.reset();
    document.getElementById('game-over-screen')!.style.display = 'flex';
    document.getElementById('final-score')!.textContent = this.score.toString();
    document.getElementById('final-coins')!.textContent = `Snowflakes: ${this.coins}`;
  }
}
