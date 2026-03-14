import * as THREE from 'three';
import { Player } from './Player';
import { TrackManager } from './TrackManager';
import { ObstacleManager } from './ObstacleManager';
import { CoinManager } from './CoinManager';
import { InputManager } from './InputManager';
import { ParticleManager } from './ParticleManager';

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
      65,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );
    this.camera.position.set(0, 8, -12);
    this.camera.lookAt(0, 2, 20);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.prepend(this.renderer.domElement);

    this.clock = new THREE.Clock();
    this.inputManager = new InputManager();
    this.player = new Player(this);
    this.trackManager = new TrackManager(this);
    this.obstacleManager = new ObstacleManager(this);
    this.coinManager = new CoinManager(this);
    this.particleManager = new ParticleManager(this);

    this.setupLighting();
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
    const fillLight = new THREE.HemisphereLight(0x87ceeb, 0x444444, 0.4);
    this.scene.add(fillLight);
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
    this.update();
  }

  restart() {
    // Clear old objects
    this.obstacleManager.reset();
    this.coinManager.reset();
    this.particleManager.reset();
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

    // Update score (distance-based)
    this.score += Math.round(this.speed * dt);
    document.getElementById('score')!.textContent = this.score.toString();
    document.getElementById('coins-display')!.textContent = `Coins: ${this.coins}`;

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
      const obstacleBox = new THREE.Box3().setFromObject(obstacle.mesh);
      // Shrink collision box slightly for fairness
      obstacleBox.expandByScalar(-0.15);
      if (playerBox.intersectsBox(obstacleBox)) {
        this.endGame();
        return;
      }
    }

    // Check coins
    for (const coin of this.coinManager.coins) {
      if (!coin.active) continue;
      const coinBox = new THREE.Box3().setFromObject(coin.mesh);
      if (playerBox.intersectsBox(coinBox)) {
        coin.active = false;
        this.scene.remove(coin.mesh);
        this.coins++;
        this.particleManager.spawnCoinBurst(coin.mesh.position);
      }
    }
  }

  private endGame() {
    this.gameOver = true;
    this.running = false;
    document.getElementById('game-over-screen')!.style.display = 'flex';
    document.getElementById('final-score')!.textContent = this.score.toString();
    document.getElementById('final-coins')!.textContent = `Coins: ${this.coins}`;
  }
}
