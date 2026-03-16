import * as THREE from 'three';
import { Player } from './Player';
import { TrackManager } from './TrackManager';
import { ObstacleManager } from './ObstacleManager';
import { CoinManager } from './CoinManager';
import { InputManager } from './InputManager';
import { ParticleManager } from './ParticleManager';
import { SoundManager } from './SoundManager';
import { LaneHeightMap } from './LaneHeightMap';
import { PowerupManager } from './PowerupManager';
import { EnvironmentManager } from './EnvironmentManager';
import { CollisionManager } from './CollisionManager';
import { SeasonManager } from './SeasonManager';

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
  powerupManager: PowerupManager;
  environmentManager: EnvironmentManager;
  collisionManager: CollisionManager;
  seasonManager: SeasonManager;

  clock: THREE.Clock;
  running = false;
  gameOver = false;
  score = 0;
  coins = 0;
  speed = 0;
  readonly baseSpeed = 25;
  readonly maxSpeed = 55;
  readonly acceleration = 0.3;

  readonly laneWidth = 3;

  // Crash animation
  private crashedCharacter: THREE.Group | null = null;

  // Smooth camera follow for waterfall drops
  private cameraCurrentY = 10;
  private cameraLookDownOffset = 0;

  private ambientLight!: THREE.AmbientLight;
  private sunLight!: THREE.DirectionalLight;
  groundMesh!: THREE.Mesh;
  private mountainMeshes: THREE.Object3D[] = [];
  private currentMountainSeason: string = '';

  constructor() {
    // Minimal setup — actual init is async via load()
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 60, 140);

    this.camera = new THREE.PerspectiveCamera(
      70, window.innerWidth / window.innerHeight, 0.1, 200
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
    this.seasonManager = new SeasonManager();
    this.inputManager = new InputManager();
    // These are initialized in load() but typed as definite
    this.player = null!;
    this.trackManager = null!;
    this.obstacleManager = null!;
    this.coinManager = null!;
    this.particleManager = null!;
    this.soundManager = null!;
    this.powerupManager = null!;
    this.environmentManager = null!;
    this.collisionManager = null!;
  }

  async load(onProgress: (pct: number) => void): Promise<void> {
    const step = (pct: number) => new Promise<void>(resolve => {
      onProgress(pct);
      requestAnimationFrame(() => resolve());
    });

    await step(5);
    this.player = new Player(this);

    await step(15);
    this.setupLighting();
    this.setupGround();

    await step(30);
    this.trackManager = new TrackManager(this);

    await step(60);
    this.obstacleManager = new ObstacleManager(this);
    this.coinManager = new CoinManager(this);

    await step(75);
    this.particleManager = new ParticleManager(this);
    this.soundManager = new SoundManager(this);
    this.powerupManager = new PowerupManager(this);

    await step(90);
    this.environmentManager = new EnvironmentManager(this);
    this.collisionManager = new CollisionManager(this);
    this.environmentManager.setLights(this.ambientLight, this.sunLight);
    this.setupResizeHandler();

    await step(100);
    this.renderer.render(this.scene, this.camera);
  }

  // Convenience accessors used by PowerupManager
  get isSnowmobile() { return this.powerupManager.isSnowmobile; }
  get snowboardMode() { return this.powerupManager.snowboardMode; }
  get metalMode() { return this.powerupManager.metalMode; }

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

    const fillLight = new THREE.HemisphereLight(0xdce8f0, 0x444444, 0.4);
    this.scene.add(fillLight);
  }

  private setupGround() {
    const groundGeo = new THREE.PlaneGeometry(500, 500);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0 });
    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.position.y = -0.05;
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);

    this.createMountains();
  }

  createMountains() {
    const season = this.seasonManager.season;
    if (this.currentMountainSeason === season && this.mountainMeshes.length > 0) return;
    this.currentMountainSeason = season;

    // Remove old mountains
    for (const m of this.mountainMeshes) {
      this.scene.remove(m);
    }
    this.mountainMeshes = [];

    const isAutumn = season === 'autumn';
    const isSummer = season === 'summer';

    const mountainColor = isAutumn ? 0x8a7a55 : isSummer ? 0x5a8a55 : 0x8899aa;
    const mountainMat = new THREE.MeshStandardMaterial({ color: mountainColor });

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

    // Generate a canvas texture with splotchy autumn tree colors
    const autumnTexture = isAutumn ? this.createAutumnTreeTexture() : null;

    for (const peak of peaks) {
      const geo = new THREE.ConeGeometry(peak.size, peak.height, 12);

      if (isAutumn) {
        const autumnMat = new THREE.MeshStandardMaterial({ map: autumnTexture });
        const mountain = new THREE.Mesh(geo, autumnMat);
        mountain.position.set(peak.x, peak.height / 2 - 5, peak.z);
        mountain.rotation.y = Math.random() * Math.PI;
        this.scene.add(mountain);
        this.mountainMeshes.push(mountain);
      } else {
        const mountain = new THREE.Mesh(geo, mountainMat);
        mountain.position.set(peak.x, peak.height / 2 - 5, peak.z);
        mountain.rotation.y = Math.random() * Math.PI;
        this.scene.add(mountain);
        this.mountainMeshes.push(mountain);
        const capColor = isSummer ? 0x4a8a3f : 0xf0f4f8;
        const capSize = peak.size * 0.5;
        const capHeight = peak.height * 0.4;
        const capGeo = new THREE.ConeGeometry(capSize, capHeight, 12);
        const cap = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({ color: capColor }));
        cap.position.set(peak.x, peak.height - 5 - capHeight / 2, peak.z);
        cap.rotation.y = mountain.rotation.y;
        this.scene.add(cap);
        this.mountainMeshes.push(cap);
      }
    }

    // Small wispy clouds around the mountains
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    for (let i = 0; i < 8; i++) {
      const cloud = new THREE.Group();
      const blobCount = 3 + Math.floor(Math.random() * 3);
      for (let j = 0; j < blobCount; j++) {
        const r = 3 + Math.random() * 5;
        const blob = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), cloudMat);
        blob.position.set(
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 4
        );
        blob.scale.set(1, 0.4 + Math.random() * 0.3, 0.8);
        cloud.add(blob);
      }
      const peak = peaks[Math.floor(Math.random() * peaks.length)];
      cloud.position.set(
        peak.x + (Math.random() - 0.5) * peak.size * 0.8,
        peak.height * (0.3 + Math.random() * 0.4),
        peak.z + (Math.random() - 0.5) * 20
      );
      this.scene.add(cloud);
      this.mountainMeshes.push(cloud);
    }
  }

  private createAutumnTreeTexture(): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Dark ground base — warm brown
    ctx.fillStyle = '#3a2a18';
    ctx.fillRect(0, 0, size, size);

    // Fall tree colors — mostly warm tones with some green
    const treeColors = [
      '#3a5a28', '#4a6a30',             // evergreen (sparse)
      '#8a4422', '#9a5528', '#7a3a18', // deep red/maroon
      '#8a4422', '#9a5528',             // extra maroon weight
      '#bb7722', '#aa6618', '#cc8833', // golden/amber
      '#bb7722', '#cc8833',             // extra gold weight
      '#cc5522', '#bb4418', '#dd6630', // orange
      '#ddaa22', '#ccaa30', '#dd9920', // bright gold
      '#6a4a22', '#7a5a2a',             // brown
      '#aa3320', '#993318',             // red
    ];

    // Draw hundreds of tiny tree shapes packed together
    for (let i = 0; i < 500; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const treeH = 3 + Math.random() * 6;
      const treeW = 2 + Math.random() * 4;
      const color = treeColors[Math.floor(Math.random() * treeColors.length)];

      ctx.fillStyle = color;

      // Draw a tiny tree: triangle crown with a darker shade at base
      ctx.beginPath();
      ctx.moveTo(x, y - treeH);
      ctx.lineTo(x - treeW / 2, y);
      ctx.lineTo(x + treeW / 2, y);
      ctx.closePath();
      ctx.fill();

      // Second smaller triangle on top for layered look
      if (Math.random() > 0.4) {
        ctx.beginPath();
        ctx.moveTo(x, y - treeH - 1.5);
        ctx.lineTo(x - treeW * 0.35, y - treeH * 0.4);
        ctx.lineTo(x + treeW * 0.35, y - treeH * 0.4);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Add shadow/depth between trees
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 1 + Math.random() * 3;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 20, 8, 0.5)';
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3);
    return texture;
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
    this.cameraCurrentY = 10;
    this.cameraLookDownOffset = 0;
    this.coins = 0;
    this.speed = this.baseSpeed;

    // Apply season before rebuilding track so chunks match
    this.seasonManager.update(0);
    this.environmentManager.updateEnvironment();
    this.currentMountainSeason = '';
    this.createMountains();
    this.laneHeightMap.reset();
    this.player.reset();
    this.trackManager.reset();

    this.clock.start();
    this.soundManager.startSliding();
    this.soundManager.loadGrunts();
    this.soundManager.loadGrowls();
    this.renderer.render(this.scene, this.camera);
    this.update();
  }

  pause() {
    this.running = false;
    this.soundManager.suspend();
    document.getElementById('pause-screen')!.style.display = 'flex';
  }

  resume() {
    this.running = true;
    document.getElementById('pause-screen')!.style.display = 'none';
    this.soundManager.resumeCtx();
    this.clock.start();
    this.update();
  }

  restart() {
    if (this.crashedCharacter) {
      this.scene.remove(this.crashedCharacter);
      this.crashedCharacter = null;
    }
    this.laneHeightMap.reset();
    this.obstacleManager.reset();
    this.coinManager.reset();
    this.particleManager.reset();
    this.soundManager.reset();
    this.environmentManager.resetBears();
    this.powerupManager.reset();
    this.environmentManager.resetEnvironment();
    this.seasonManager.update(0);
    this.currentMountainSeason = '';
    this.player.reset();
    this.trackManager.reset();
    this.start();
  }

  private update() {
    if (!this.running) return;

    const delta = this.clock.getDelta();
    const dt = Math.min(delta, 0.05);

    // Dynamic steepness
    this.environmentManager.updateSteepness(dt);
    const steepness = this.environmentManager.steepness;

    // Update camera — smooth follow for waterfall drops
    const playerGroundY = this.laneHeightMap.getHeight(this.player.targetLane, 0);
    const targetCamY = playerGroundY + 10 + steepness * 4;
    this.cameraCurrentY += (targetCamY - this.cameraCurrentY) * Math.min(dt * 3, 1);
    this.camera.position.y = this.cameraCurrentY;

    // Tilt camera to look over player during falls
    const isFalling = this.player.isJumping && this.player.jumpVelocity < -2;
    const targetLookDown = isFalling ? -2.0 : 0;
    this.cameraLookDownOffset += (targetLookDown - this.cameraLookDownOffset) * Math.min(dt * 4, 1);
    const lookY = playerGroundY + 2 - steepness * 4 + this.cameraLookDownOffset;
    this.camera.lookAt(0, lookY, 25);

    // Move background elements to follow waterfall drops
    const baseY = this.trackManager.currentBaseY;
    this.groundMesh.position.y = baseY - 0.05;
    for (const m of this.mountainMeshes) {
      (m as any)._origY ??= m.position.y;
      m.position.y = (m as any)._origY + baseY;
    }

    // Increase speed over time
    const steepnessBoost = steepness * 12;
    let modeBoost = 0;
    if (this.metalMode) modeBoost = this.maxSpeed * 1.0;
    if (this.isSnowmobile) modeBoost = Math.max(modeBoost, this.maxSpeed * 1.0);
    this.speed = Math.min(this.speed + this.acceleration * dt, this.maxSpeed + steepnessBoost + modeBoost);

    // Process input
    const input = this.inputManager.consume();
    this.player.handleInput(input);

    // Update game objects
    this.player.update(dt);
    this.trackManager.update(dt);
    this.obstacleManager.update(dt);
    this.coinManager.update(dt);
    this.particleManager.update(dt);

    // Big jump ramp
    this.powerupManager.updateBigRamp(dt);

    // Update power-ups
    this.powerupManager.update(dt);

    // Check collisions
    this.collisionManager.checkCollisions();

    // Update sound
    this.soundManager.setSlidingMuted(this.player.isJumping);
    this.soundManager.updateSlidingPitch(this.speed);
    if (this.isSnowmobile) {
      this.soundManager.setMotorPitch(this.player.isJumping);
    }

    // Update score
    let scoreMultiplier = 1;
    if (this.metalMode) scoreMultiplier = 2;
    if (this.isSnowmobile) scoreMultiplier = Math.max(scoreMultiplier, 2);
    this.score += Math.round(this.speed * dt * scoreMultiplier);
    document.getElementById('score')!.textContent = this.score.toString();
    document.getElementById('coins-display')!.textContent = `Snowflakes: ${this.coins}`;

    // Vehicle upgrades based on score (not in autumn — mountain bike stays)
    if (!this.powerupManager.bobsledShield && !this.snowboardMode) {
      const season = this.seasonManager.season;
      if (season === 'autumn') {
        if (this.player.currentVehicle !== 'mountainBike' && this.player.currentVehicle !== 'bobsled' && this.player.currentVehicle !== 'motorbike') {
          this.player.switchVehicle('mountainBike');
        }
      } else if (this.score >= 1500) {
        if (season === 'spring') {
          this.player.switchVehicle('rainbowKayak');
        } else {
          this.player.switchVehicle('rainbowSkis');
        }
      }
    }

    // Bears
    this.environmentManager.updateBears(dt);

    // Environment transitions (handles wind, night, seasons)
    this.environmentManager.updateEnvironment();

    // Update mountains if season changed
    this.createMountains();

    // Render
    this.renderer.render(this.scene, this.camera);

    if (!this.gameOver) {
      requestAnimationFrame(() => this.update());
    }
  }

  endGame() {
    this.gameOver = true;
    this.running = false;
    this.soundManager.reset();

    const { character, startPos } = this.player.ejectCrash();
    const crashSpeed = this.speed;
    character.position.copy(startPos);
    character.position.y = startPos.y + 0.15;
    this.scene.add(character);
    this.crashedCharacter = character;

    const vehicleWorldPos = this.player.group.position.clone();

    const crashLane = this.player.targetLane;
    const vel = { x: (Math.random() - 0.5) * 3, y: 6, z: crashSpeed * 0.6 };
    const startTime = Date.now();
    let landed = false;
    let slideSpeed = 0;

    const animateCrash = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const dt = 0.016;

      // Move all track chunks and obstacles back so scene scrolls
      this.trackManager.update(dt);
      this.obstacleManager.update(dt);
      this.coinManager.update(dt);

      // Ground height at character's current position (follows ramps)
      const groundY = this.laneHeightMap.getHeight(crashLane, character.position.z) + 0.15;

      if (!landed) {
        character.position.x += vel.x * dt;
        character.position.y += vel.y * dt;
        character.position.z += vel.z * dt;
        vel.y -= 25 * dt;

        character.rotation.x += 8 * dt;
        const spread = Math.min(elapsed * 5, 1);
        character.scale.set(1 + spread * 0.5, 1, 1);

        if (character.position.y <= groundY && vel.y < 0) {
          landed = true;
          character.position.y = groundY;
          character.rotation.x = Math.PI / 2;
          character.scale.set(1.5, 1, 1);
          slideSpeed = crashSpeed * 0.3;
          this.soundManager.playLand();
        }
      } else {
        character.position.z += slideSpeed * dt;
        character.position.y = this.laneHeightMap.getHeight(crashLane, character.position.z) + 0.15;
        slideSpeed *= 0.92;
      }

      if (elapsed < 1.8) {
        requestAnimationFrame(animateCrash);
      } else {
        document.getElementById('game-over-screen')!.style.display = 'flex';
        document.getElementById('final-score')!.textContent = this.score.toString();
        document.getElementById('final-coins')!.textContent = `Snowflakes: ${this.coins}`;
      }

      this.renderer.render(this.scene, this.camera);
    };

    animateCrash();
  }
}
