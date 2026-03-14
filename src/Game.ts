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
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
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
    this.update();
  }

  restart() {
    // Clear old objects
    this.laneHeightMap.reset();
    this.obstacleManager.reset();
    this.coinManager.reset();
    this.particleManager.reset();
    this.soundManager.reset();
    this.player.reset();
    this.trackManager.reset();
    this.start();
  }

  private update() {
    if (!this.running) return;

    const delta = this.clock.getDelta();
    // Cap delta to avoid physics explosions on tab-switch
    const dt = Math.min(delta, 0.05);

    // Increase speed over time
    this.speed = Math.min(this.speed + this.acceleration * dt, this.maxSpeed);

    // Process input
    const input = this.inputManager.consume();
    this.player.handleInput(input);

    // Update game objects
    this.player.update(dt);
    this.trackManager.update(dt);
    this.obstacleManager.update(dt);
    this.coinManager.update(dt);
    this.particleManager.update(dt);

    // Check collisions
    this.checkCollisions();

    // Update sound
    this.soundManager.setSlidingMuted(this.player.isJumping);
    this.soundManager.updateSlidingPitch(this.speed);

    // Update score (distance-based)
    this.score += Math.round(this.speed * dt);
    document.getElementById('score')!.textContent = this.score.toString();
    document.getElementById('coins-display')!.textContent = `Snowflakes: ${this.coins}`;

    // Vehicle upgrades based on score
    if (this.score >= 1500) {
      this.player.switchVehicle('rainbowSkis');
    } else if (this.score >= 1000) {
      this.player.switchVehicle('snowboard');
    } else if (this.score >= 500) {
      this.player.switchVehicle('skis');
    }

    // Wind at 1300 points
    if (this.score >= 1300) {
      this.soundManager.startWind();
    }

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
        this.endGame();
        return;
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

  private endGame() {
    this.gameOver = true;
    this.running = false;
    this.soundManager.reset();
    document.getElementById('game-over-screen')!.style.display = 'flex';
    document.getElementById('final-score')!.textContent = this.score.toString();
    document.getElementById('final-coins')!.textContent = `Snowflakes: ${this.coins}`;
  }
}
