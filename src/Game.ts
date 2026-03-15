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

  private ambientLight!: THREE.AmbientLight;
  private sunLight!: THREE.DirectionalLight;

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
    this.powerupManager = new PowerupManager(this);
    this.environmentManager = new EnvironmentManager(this);
    this.collisionManager = new CollisionManager(this);

    this.setupLighting();
    this.setupGround();
    this.setupResizeHandler();

    // Share light references with environment manager
    this.environmentManager.setLights(this.ambientLight, this.sunLight);

    // Render initial frame
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
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.createMountains();
  }

  private createMountains() {
    const mountainMat = new THREE.MeshStandardMaterial({ color: 0x8899aa });
    const snowPeakMat = new THREE.MeshStandardMaterial({ color: 0xf0f4f8 });

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
      const geo = new THREE.ConeGeometry(peak.size, peak.height, 7);
      const mountain = new THREE.Mesh(geo, mountainMat);
      mountain.position.set(peak.x, peak.height / 2 - 8, peak.z);
      mountain.rotation.y = Math.random() * Math.PI;
      this.scene.add(mountain);

      const capSize = peak.size * 0.5;
      const capHeight = peak.height * 0.4;
      const capGeo = new THREE.ConeGeometry(capSize, capHeight, 7);
      const cap = new THREE.Mesh(capGeo, snowPeakMat);
      cap.position.set(peak.x, peak.height - 8 - capHeight / 2, peak.z);
      cap.rotation.y = mountain.rotation.y;
      this.scene.add(cap);
    }
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

    // Update camera tilt based on steepness
    const camY = 10 + steepness * 4;
    const lookY = 2 - steepness * 4;
    this.camera.position.y = camY;
    this.camera.lookAt(0, lookY, 25);

    // Increase speed over time
    const steepnessBoost = steepness * 12;
    let modeBoost = 0;
    if (this.metalMode) modeBoost = this.maxSpeed * 0.5;
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

    // Vehicle upgrades based on score
    if (!this.powerupManager.bobsledShield && !this.snowboardMode) {
      if (this.score >= 1500) {
        this.player.switchVehicle('rainbowSkis');
      }
    }

    // Wind at 1300 points
    if (this.score >= 1300) {
      this.soundManager.startWind();
    }

    // Bears
    this.environmentManager.updateBears(dt);

    // Environment transitions
    this.environmentManager.updateEnvironment();

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
