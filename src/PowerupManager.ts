import * as THREE from 'three';
import type { Game } from './Game';

interface Powerup {
  mesh: THREE.Group;
  active: boolean;
  type: 'bobsled' | 'metal' | 'snowboard' | 'helmet';
}

export class PowerupManager {
  game: Game;

  bobsledShield = false;
  bobsledHitsLeft = 0;
  isSnowmobile = false;
  private preShieldVehicle: 'skis' | 'snowboard' | 'rainbowSkis' = 'skis';
  private powerups: Powerup[] = [];
  private powerupSpawnTimer = 0;
  private nextSnowboardScore = 1500;

  snowboardMode = false;
  metalMode = false;

  helmetMode = false;
  helmetBouncesLeft = 0;
  private helmetMesh: THREE.Group | null = null;

  nextBigJumpScore = 2000;
  bigRamp: THREE.Group | null = null;
  bigRampActive = false;
  private waterfallActive = false;
  private springRampCount = 0;

  constructor(game: Game) {
    this.game = game;
  }

  update(dt: number) {
    this.powerupSpawnTimer += dt;
    if (this.powerupSpawnTimer > 12 + Math.random() * 15) {
      this.powerupSpawnTimer = 0;
      const isAutumn = this.game.seasonManager.season === 'autumn';
      const types: ('bobsled' | 'metal' | 'snowboard' | 'helmet')[] = ['metal'];
      if (!this.bobsledShield) {
        // Motorbike in autumn, bobsled/snowmobile in other seasons
        if (!isAutumn) types.push('bobsled');
        else types.push('bobsled'); // spawns motorbike mesh in autumn (handled in spawnPowerup)
      }
      const season = this.game.seasonManager.season;
      const noSnowboard = season === 'autumn' || season === 'spring' || season === 'summer';
      if (!this.snowboardMode && this.game.score >= this.nextSnowboardScore && !noSnowboard) types.push('snowboard');
      if (!this.helmetMode) types.push('helmet');
      if (this.metalMode && types.includes('metal')) types.splice(types.indexOf('metal'), 1);
      if (types.length === 0) return;
      const type = types[Math.floor(Math.random() * types.length)];
      this.spawnPowerup(type);
    }

    const moveAmount = this.game.speed * dt;
    const playerBox = this.game.player.getCollisionBox();

    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pu = this.powerups[i];
      if (!pu.active) continue;
      pu.mesh.position.z -= moveAmount;
      pu.mesh.rotation.y += dt * 2;

      const puBox = new THREE.Box3().setFromObject(pu.mesh);
      if (playerBox.intersectsBox(puBox)) {
        pu.active = false;
        this.game.scene.remove(pu.mesh);
        if (pu.type === 'bobsled') {
          this.activateShield();
        } else if (pu.type === 'metal') {
          this.activateMetalMode();
        } else if (pu.type === 'snowboard') {
          this.activateSnowboard();
        } else if (pu.type === 'helmet') {
          this.activateHelmet();
        }
        this.powerups.splice(i, 1);
        continue;
      }

      if (pu.mesh.position.z < -15) {
        pu.active = false;
        this.game.scene.remove(pu.mesh);
        this.powerups.splice(i, 1);
      }
    }
  }

  updateBigRamp(dt: number) {
    if (this.game.score >= this.nextBigJumpScore && !this.bigRampActive) {
      this.nextBigJumpScore = this.game.score + 1800 + Math.floor(Math.random() * 400);
      const isSpring = this.game.seasonManager.season === 'spring';
      if (isSpring && this.springRampCount < 2) {
        this.spawnWaterfall();
        this.springRampCount++;
      } else {
        this.spawnBigRamp();
      }
    }
    if (this.bigRamp) {
      this.bigRamp.position.z -= this.game.speed * dt;
      if (this.bigRampActive && this.bigRamp.position.z < 1 && !this.game.player.isJumping) {
        if (this.waterfallActive) {
          this.game.player.waterfallDrop();
        } else {
          this.game.player.bigLaunch();
        }
        this.bigRampActive = false;
        this.waterfallActive = false;
      }
      if (this.bigRamp.position.z < -20) {
        this.game.scene.remove(this.bigRamp);
        this.bigRamp = null;
        this.bigRampActive = false;
        this.waterfallActive = false;
      }
    }
  }

  handleObstacleHit(obstacle: { mesh: THREE.Object3D; isSnowman?: boolean; isPineTree?: boolean; active: boolean }): 'absorbed' | 'endGame' {
    const wasSnowman = obstacle.isSnowman;
    if (this.snowboardMode) {
      obstacle.active = false;
      if (wasSnowman) this.explodeSnowman(obstacle.mesh, false);
      this.game.scene.remove(obstacle.mesh);
      this.deactivateSnowboard();
      return 'absorbed';
    }
    if (this.metalMode) {
      obstacle.active = false;
      if (wasSnowman) this.explodeSnowman(obstacle.mesh, true);
      this.game.scene.remove(obstacle.mesh);
      this.deactivateMetalMode();
      return 'absorbed';
    }
    if (this.bobsledShield) {
      obstacle.active = false;
      if (wasSnowman) this.explodeSnowman(obstacle.mesh, false);
      if (obstacle.isPineTree) this.explodeTree(obstacle.mesh);
      this.game.scene.remove(obstacle.mesh);
      this.bobsledHitsLeft--;
      this.showShieldHit();
      if (this.bobsledHitsLeft <= 0) {
        this.deactivateShield();
      }
      return 'absorbed';
    }
    if (this.helmetMode) {
      this.helmetBouncesLeft--;
      const currentLane = this.game.player.targetLane;
      const otherLanes = [-1, 0, 1].filter(l => l !== currentLane);
      const newLane = otherLanes[Math.floor(Math.random() * otherLanes.length)];
      this.game.player.targetLane = newLane;
      this.game.player.currentLane = newLane;
      this.game.soundManager.playLand();
      this.showHelmetBounce();
      if (this.helmetBouncesLeft <= 0) {
        this.deactivateHelmet();
      }
      return 'absorbed';
    }
    return 'endGame';
  }

  private getDefaultVehicle(): 'skis' | 'rainbowSkis' | 'mountainBike' | 'kayak' | 'jetski' | 'rainbowKayak' {
    const season = this.game.seasonManager.season;
    if (season === 'autumn') return 'mountainBike';
    if (season === 'spring') return this.game.score >= 1500 ? 'rainbowKayak' : 'kayak';
    if (season === 'summer') return 'jetski';
    return this.game.score >= 1500 ? 'rainbowSkis' : 'skis';
  }

  private spawnPowerup(type: 'bobsled' | 'metal' | 'snowboard' | 'helmet') {
    const lane = Math.floor(Math.random() * 3) - 1;
    const laneY = this.game.laneHeightMap.getHeight(lane, 100);
    let mesh: THREE.Group;
    if (type === 'bobsled') {
      const isAutumn = this.game.seasonManager.season === 'autumn';
      mesh = isAutumn ? this.createMotorbikePowerupMesh()
        : this.game.score >= 6000 ? this.createSnowmobileMesh()
        : this.createPowerupMesh();
    } else if (type === 'metal') {
      mesh = this.createWalkmanMesh();
    } else if (type === 'snowboard') {
      mesh = this.createSnowboardPowerupMesh();
    } else {
      mesh = this.createHelmetPowerupMesh();
    }
    mesh.position.set(lane * this.game.laneWidth, laneY + 0.8, 100);
    this.game.scene.add(mesh);
    this.powerups.push({ mesh, active: true, type });
  }

  private activateShield() {
    const season = this.game.seasonManager.season;
    const isAutumn = season === 'autumn';
    const isSpring = season === 'spring';
    this.bobsledShield = true;
    this.bobsledHitsLeft = 3;
    this.isSnowmobile = isAutumn || (!isSpring && this.game.score >= 6000);
    const v = this.game.player.currentVehicle;
    if (v !== 'bobsled' && v !== 'motorbike' && v !== 'canoe') {
      this.preShieldVehicle = v as 'skis' | 'snowboard' | 'rainbowSkis';
    }
    if (isSpring) {
      this.game.player.switchVehicle('canoe');
    } else if (isAutumn) {
      this.game.player.switchVehicle('motorbike');
      this.game.soundManager.startMotor();
    } else {
      this.game.player.switchVehicle('bobsled');
      if (this.isSnowmobile) {
        this.game.player.setVehicleColors(0xddcc00, 0x222222);
        this.game.soundManager.startMotor();
      }
    }
    if (this.metalMode) {
      this.game.player.setVehicleBlack(true);
    }
    this.game.soundManager.playCollect();
    const el = document.getElementById('shield-display')!;
    el.style.display = 'block';
    el.textContent = isSpring ? '🛶 x3' : isAutumn ? '🏍️ x3' : this.isSnowmobile ? '🏔️ x3' : '🛷 x3';
  }

  private deactivateShield() {
    const wasMotorbike = this.game.player.currentVehicle === 'motorbike';
    this.bobsledShield = false;
    this.bobsledHitsLeft = 0;
    if (this.isSnowmobile || wasMotorbike) {
      this.game.soundManager.stopMotor();
    }
    this.isSnowmobile = false;
    this.game.player.switchVehicle(this.getDefaultVehicle());
    document.getElementById('shield-display')!.style.display = 'none';
  }

  private activateMetalMode() {
    this.metalMode = true;
    this.game.soundManager.startThrash();
    this.game.player.setMetalMode(true);
    const el = document.getElementById('metal-display')!;
    el.style.display = 'block';
  }

  private deactivateMetalMode() {
    this.metalMode = false;
    this.game.soundManager.stopThrash();
    this.game.player.setMetalMode(false);
    document.getElementById('metal-display')!.style.display = 'none';
    const el = document.createElement('div');
    el.textContent = 'METAL OVER!';
    el.style.cssText = 'position:absolute;top:45%;left:50%;transform:translate(-50%,-50%);color:#ff4444;font-size:32px;font-weight:bold;text-shadow:2px 2px 4px rgba(0,0,0,0.7);pointer-events:none;transition:all 0.5s ease-out;opacity:1;';
    document.getElementById('ui-overlay')!.appendChild(el);
    requestAnimationFrame(() => { el.style.top = '35%'; el.style.opacity = '0'; });
    setTimeout(() => el.remove(), 600);
  }

  private activateSnowboard() {
    this.snowboardMode = true;
    this.nextSnowboardScore = this.game.score + 1500;
    this.game.player.switchVehicle('snowboard');
    this.game.player.jumpMultiplier = 1.5;
    this.game.soundManager.playCollect();
    const el = document.getElementById('shield-display')!;
    el.style.display = 'block';
    el.textContent = '🏂 3x JUMP';
  }

  private deactivateSnowboard() {
    this.snowboardMode = false;
    this.game.player.jumpMultiplier = 1;
    this.game.player.switchVehicle(this.getDefaultVehicle());
    document.getElementById('shield-display')!.style.display = 'none';
  }

  private activateHelmet() {
    this.helmetMode = true;
    this.helmetBouncesLeft = 3;
    this.game.soundManager.playCollect();
    this.helmetMesh = new THREE.Group();
    const helmetMat = new THREE.MeshStandardMaterial({
      color: 0xff69b4,
      metalness: 0.4,
      roughness: 0.3,
    });
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.45),
      helmetMat
    );
    dome.position.y = 0.05;
    this.helmetMesh.add(dome);
    for (const side of [-1, 1]) {
      const guard = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 8, 6, 0, Math.PI, 0, Math.PI * 0.5),
        helmetMat
      );
      guard.position.set(side * 0.3, -0.1, 0);
      guard.rotation.z = side * -0.3;
      this.helmetMesh.add(guard);
    }
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0xff88cc,
      transparent: true,
      opacity: 0.6,
    });
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.02), visorMat);
    visor.position.set(0, 0.15, 0.35);
    visor.rotation.x = -0.5;
    this.helmetMesh.add(visor);

    this.helmetMesh.position.set(0, 1.65, 0);
    this.game.player.group.add(this.helmetMesh);
    const el = document.getElementById('shield-display')!;
    el.style.display = 'block';
    el.textContent = '⛑️ x3';
  }

  private deactivateHelmet() {
    this.helmetMode = false;
    this.helmetBouncesLeft = 0;
    if (this.helmetMesh) {
      this.game.player.group.remove(this.helmetMesh);
      this.helmetMesh = null;
    }
    document.getElementById('shield-display')!.style.display = 'none';
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

  private showHelmetBounce() {
    document.getElementById('shield-display')!.textContent = `⛑️ x${this.helmetBouncesLeft}`;
    const el = document.createElement('div');
    el.textContent = 'BOUNCE!';
    el.style.cssText = 'position:absolute;top:45%;left:50%;transform:translate(-50%,-50%);color:#ff69b4;font-size:32px;font-weight:bold;text-shadow:2px 2px 4px rgba(0,0,0,0.7);pointer-events:none;transition:all 0.5s ease-out;opacity:1;';
    document.getElementById('ui-overlay')!.appendChild(el);
    requestAnimationFrame(() => { el.style.top = '35%'; el.style.opacity = '0'; });
    setTimeout(() => el.remove(), 600);
  }

  explodeSnowman(mesh: THREE.Object3D, keepHat: boolean) {
    const worldPos = new THREE.Vector3();
    mesh.getWorldPosition(worldPos);

    mesh.updateMatrixWorld(true);
    const children = [...(mesh as THREE.Group).children];
    for (const child of children) {
      if (!(child instanceof THREE.Mesh)) continue;
      const childWorld = new THREE.Vector3();
      child.getWorldPosition(childWorld);

      const isHat = child.material instanceof THREE.MeshStandardMaterial &&
        child.material.color.getHex() === 0x111111 && child.position.y > 2.4;

      if (isHat && keepHat) {
        const hat = child.clone();
        hat.position.set(0, 1.8, 0);
        hat.scale.setScalar(1);
        this.game.player.group.add(hat);
        continue;
      }

      const debris = child.clone();
      debris.position.copy(childWorld);
      this.game.scene.add(debris);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        5 + Math.random() * 8,
        (Math.random() - 0.5) * 10
      );

      const startTime = Date.now();
      const animate = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed > 2) {
          this.game.scene.remove(debris);
          return;
        }
        debris.position.x += vel.x * 0.016;
        debris.position.y += vel.y * 0.016;
        debris.position.z += vel.z * 0.016;
        vel.y -= 15 * 0.016;
        debris.rotation.x += 0.1;
        debris.rotation.z += 0.08;
        requestAnimationFrame(animate);
      };
      animate();
    }
  }

  explodeTree(mesh: THREE.Object3D) {
    const worldPos = new THREE.Vector3();
    mesh.getWorldPosition(worldPos);
    mesh.updateMatrixWorld(true);

    const children = [...(mesh as THREE.Group).children];
    for (const child of children) {
      if (!(child instanceof THREE.Mesh)) continue;
      const childWorld = new THREE.Vector3();
      child.getWorldPosition(childWorld);

      const debris = child.clone();
      debris.position.copy(childWorld);
      const s = 0.5 + Math.random() * 0.8;
      debris.scale.multiplyScalar(s);
      this.game.scene.add(debris);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 12,
        4 + Math.random() * 10,
        -5 + (Math.random() - 0.5) * 8
      );

      const startTime = Date.now();
      const animate = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed > 2.5) {
          this.game.scene.remove(debris);
          return;
        }
        debris.position.x += vel.x * 0.016;
        debris.position.y += vel.y * 0.016;
        debris.position.z += vel.z * 0.016;
        vel.y -= 12 * 0.016;
        debris.rotation.x += 0.15;
        debris.rotation.y += 0.1;
        debris.rotation.z += 0.12;
        requestAnimationFrame(animate);
      };
      animate();
    }
  }

  private spawnBigRamp() {
    const group = new THREE.Group();
    const trackWidth = this.game.laneWidth * 3 + 2;
    const rampLength = 12;
    const rampHeight = 4;
    const season = this.game.seasonManager.season;
    const isAutumn = season === 'autumn';
    const isSpring = season === 'spring';

    const slopeLen = Math.sqrt(rampLength * rampLength + rampHeight * rampHeight);
    const angle = Math.atan2(rampHeight, rampLength);

    const rampColor = isAutumn ? 0x8B7355 : isSpring ? 0x2288bb : 0xbbeeFF;
    const rampMat = new THREE.MeshStandardMaterial({
      color: rampColor,
      metalness: isSpring ? 0.4 : 0.2,
      roughness: isSpring ? 0.15 : 0.3,
      transparent: isSpring,
      opacity: isSpring ? 0.85 : 1,
    });

    const rampGeo = new THREE.BoxGeometry(trackWidth - 0.5, 0.3, slopeLen);
    const ramp = new THREE.Mesh(rampGeo, rampMat);
    ramp.position.set(0, rampHeight / 2, rampLength / 2);
    ramp.rotation.x = -angle;
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    group.add(ramp);

    const wallColor = isAutumn ? 0x7a6040 : isSpring ? 0x66bbdd : 0xaaddee;
    const wallMat = new THREE.MeshStandardMaterial({ color: wallColor });
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, slopeLen), wallMat);
      wall.position.set(side * (trackWidth / 2 - 0.1), rampHeight / 2, rampLength / 2);
      wall.rotation.x = -angle;
      wall.castShadow = true;
      group.add(wall);
    }

    if (isSpring) {
      // Wave foam on top of the ramp
      const foamMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
      for (let i = 0; i < 5; i++) {
        const fw = 0.3 + Math.random() * 0.5;
        const fl = 1.5 + Math.random() * 2;
        const foam = new THREE.Mesh(new THREE.PlaneGeometry(fw, fl), foamMat);
        foam.rotation.x = -angle - Math.PI / 2;
        foam.position.set(
          (Math.random() - 0.5) * (trackWidth - 2),
          rampHeight / 2 + 0.2,
          rampLength / 2 + (Math.random() - 0.5) * 4
        );
        group.add(foam);
      }
      // Curling wave crest at the top
      const crestMat = new THREE.MeshStandardMaterial({ color: 0x44aadd, transparent: true, opacity: 0.7 });
      const crest = new THREE.Mesh(
        new THREE.TorusGeometry(1.5, 0.4, 8, 16, Math.PI),
        crestMat
      );
      crest.position.set(0, rampHeight + 0.5, rampLength + 1);
      crest.rotation.y = Math.PI / 2;
      crest.scale.set(trackWidth / 4, 1, 1);
      group.add(crest);
    }

    const supportColor = isAutumn ? 0x6b5535 : isSpring ? 0x1a6688 : 0x99ccdd;
    const supportMat = new THREE.MeshStandardMaterial({ color: supportColor });
    for (let i = 0; i < 3; i++) {
      const t = (i + 1) / 4;
      const supportH = rampHeight * t;
      const supportZ = rampLength * t;
      const support = new THREE.Mesh(new THREE.BoxGeometry(trackWidth - 1, supportH, 0.3), supportMat);
      support.position.set(0, supportH / 2, supportZ);
      group.add(support);
    }

    const lipGeo = new THREE.BoxGeometry(trackWidth - 0.5, 0.3, 2);
    const lip = new THREE.Mesh(lipGeo, rampMat);
    lip.position.set(0, rampHeight, rampLength + 1);
    lip.receiveShadow = true;
    group.add(lip);

    group.position.set(0, 0, 100);
    this.game.scene.add(group);
    this.bigRamp = group;
    this.bigRampActive = true;
  }

  private spawnWaterfall() {
    const group = new THREE.Group();
    const trackWidth = this.game.laneWidth * 3 + 2;
    const dropHeight = 8;

    const rockMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 });
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x1a7799, metalness: 0.4, roughness: 0.15,
      transparent: true, opacity: 0.75,
    });
    const foamMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });

    // Flat approach (water surface at track level leading to the edge)
    const approachGeo = new THREE.BoxGeometry(trackWidth, 0.2, 8);
    const approach = new THREE.Mesh(approachGeo, waterMat);
    approach.position.set(0, 0.1, 8);
    group.add(approach);

    // The cliff edge — rocky lip
    const lipGeo = new THREE.BoxGeometry(trackWidth + 1, 0.5, 1.5);
    const lip = new THREE.Mesh(lipGeo, rockMat);
    lip.position.set(0, 0.2, 4);
    lip.castShadow = true;
    group.add(lip);

    // Vertical cliff face with cascading water
    const cliffGeo = new THREE.BoxGeometry(trackWidth + 1, dropHeight, 0.8);
    const cliff = new THREE.Mesh(cliffGeo, rockMat);
    cliff.position.set(0, -dropHeight / 2 + 0.2, 3.5);
    cliff.castShadow = true;
    group.add(cliff);

    // Cascading water streaks on the cliff face
    for (let i = 0; i < 15; i++) {
      const fw = 0.2 + Math.random() * 0.6;
      const fh = dropHeight * (0.4 + Math.random() * 0.6);
      const foam = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), foamMat);
      foam.position.set(
        (Math.random() - 0.5) * (trackWidth - 1),
        -dropHeight / 2 + fh / 2 + Math.random(),
        3.1
      );
      group.add(foam);
    }

    // Rocky walls on sides of the falls
    for (const side of [-1, 1]) {
      const sideWall = new THREE.Mesh(new THREE.BoxGeometry(1.5, dropHeight + 2, 4), rockMat);
      sideWall.position.set(side * (trackWidth / 2 + 1), -dropHeight / 2 + 1, 4);
      sideWall.castShadow = true;
      group.add(sideWall);
    }

    // Mist/spray at the base
    const mistMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
    for (let i = 0; i < 8; i++) {
      const mist = new THREE.Mesh(new THREE.SphereGeometry(1.5 + Math.random() * 1.5, 6, 4), mistMat);
      mist.position.set(
        (Math.random() - 0.5) * trackWidth * 0.5,
        -dropHeight + 1 + Math.random() * 2,
        2 + Math.random() * 3
      );
      mist.scale.set(1, 0.4, 1);
      group.add(mist);
    }

    // Suppress obstacles after waterfall landing
    this.game.obstacleManager.spawnTimer = -5;

    group.position.set(0, 0, 100);
    this.game.scene.add(group);
    this.bigRamp = group;
    this.bigRampActive = true;
    this.waterfallActive = true;
  }

  private createPowerupMesh(): THREE.Group {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xe63946,
      emissive: 0xff4444,
      emissiveIntensity: 0.4,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.3, 1.8), bodyMat);
    body.position.y = 0.15;
    body.castShadow = true;
    group.add(body);

    const front = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.5, 0.35, 8, 1, false, 0, Math.PI),
      bodyMat);
    front.rotation.x = Math.PI / 2;
    front.rotation.z = Math.PI;
    front.position.set(0, 0.2, 1.0);
    group.add(front);

    const runnerMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.1 });
    for (const side of [-0.4, 0.4]) {
      const runner = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 2.0), runnerMat);
      runner.position.set(side, -0.05, 0);
      group.add(runner);
    }

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

  private createMotorbikePowerupMesh(): THREE.Group {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xcc2222,
      emissive: 0xaa0000,
      emissiveIntensity: 0.3,
      metalness: 0.4,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 1.4), bodyMat);
    body.position.y = 0.3;
    body.castShadow = true;
    group.add(body);
    // Wheels
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    for (const z of [-0.6, 0.6]) {
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.08, 8, 12), tireMat);
      tire.position.set(0, 0.0, z);
      tire.rotation.y = Math.PI / 2;
      group.add(tire);
    }
    // Shield icon above
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffaa00,
      emissiveIntensity: 0.6,
      metalness: 0.8,
      roughness: 0.1,
    });
    const shield = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), shieldMat);
    shield.position.y = 1.0;
    group.add(shield);
    group.scale.setScalar(0.8);
    return group;
  }

  private createWalkmanMesh(): THREE.Group {
    const group = new THREE.Group();
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

    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x88ff88,
      emissive: 0x44ff44,
      emissiveIntensity: 0.6,
    });
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.3, 0.02), screenMat);
    screen.position.set(0, 0.7, 0.14);
    group.add(screen);

    const btnMat = new THREE.MeshStandardMaterial({ color: 0xcc0000 });
    for (const x of [-0.15, 0, 0.15]) {
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 8), btnMat);
      btn.rotation.x = Math.PI / 2;
      btn.position.set(x, 0.35, 0.14);
      group.add(btn);
    }

    const cordMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 6), cordMat);
    cord.position.set(0, 1.3, 0);
    group.add(cord);

    for (const side of [-0.25, 0.25]) {
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), bodyMat);
      pad.position.set(side, 1.6, 0);
      group.add(pad);
    }
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.02, 6, 12, Math.PI), cordMat);
    band.position.set(0, 1.6, 0);
    group.add(band);

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

  private createSnowboardPowerupMesh(): THREE.Group {
    const group = new THREE.Group();
    const boardMat = new THREE.MeshStandardMaterial({
      color: 0x9c27b0,
      emissive: 0x6a1b9a,
      emissiveIntensity: 0.4,
    });
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 2.0), boardMat);
    board.position.y = 0.4;
    board.castShadow = true;
    group.add(board);
    const arrowMat = new THREE.MeshStandardMaterial({
      color: 0x00ff88,
      emissive: 0x00cc66,
      emissiveIntensity: 0.6,
    });
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.5, 4), arrowMat);
    arrow.position.y = 1.3;
    group.add(arrow);
    group.scale.setScalar(0.7);
    return group;
  }

  private createSnowmobileMesh(): THREE.Group {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xddcc00,
      emissive: 0xaa9900,
      emissiveIntensity: 0.3,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 2.2), bodyMat);
    body.position.y = 0.2;
    body.castShadow = true;
    group.add(body);
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 1.0), blackMat);
    seat.position.set(0, 0.5, -0.3);
    group.add(seat);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.5,
    });
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.05), shieldMat);
    windshield.position.set(0, 0.65, 0.6);
    windshield.rotation.x = -0.3;
    group.add(windshield);
    for (const side of [-0.5, 0.5]) {
      const tread = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 2.4), blackMat);
      tread.position.set(side, -0.05, 0);
      group.add(tread);
    }
    const boltMat = new THREE.MeshStandardMaterial({
      color: 0xffdd00,
      emissive: 0xffaa00,
      emissiveIntensity: 0.8,
    });
    const bolt = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), boltMat);
    bolt.position.y = 1.3;
    group.add(bolt);
    group.scale.setScalar(0.7);
    return group;
  }

  private createHelmetPowerupMesh(): THREE.Group {
    const group = new THREE.Group();
    const helmetMat = new THREE.MeshStandardMaterial({
      color: 0xff69b4,
      emissive: 0xff1493,
      emissiveIntensity: 0.3,
      metalness: 0.4,
      roughness: 0.3,
    });
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6),
      helmetMat
    );
    dome.position.y = 0.8;
    dome.castShadow = true;
    group.add(dome);
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.6,
      metalness: 0.8,
    });
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.05), visorMat);
    visor.position.set(0, 0.65, 0.45);
    group.add(visor);
    const starMat = new THREE.MeshStandardMaterial({
      color: 0xffff00,
      emissive: 0xffdd00,
      emissiveIntensity: 0.8,
    });
    for (let i = 0; i < 3; i++) {
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), starMat);
      const angle = (i / 3) * Math.PI * 2;
      star.position.set(Math.cos(angle) * 0.6, 1.2, Math.sin(angle) * 0.6);
      group.add(star);
    }
    group.scale.setScalar(0.8);
    return group;
  }

  reset() {
    for (const pu of this.powerups) {
      this.game.scene.remove(pu.mesh);
    }
    this.powerups = [];
    this.powerupSpawnTimer = 0;
    this.bobsledShield = false;
    this.bobsledHitsLeft = 0;
    this.isSnowmobile = false;
    this.metalMode = false;
    this.snowboardMode = false;
    this.nextSnowboardScore = 1500;
    this.helmetMode = false;
    this.helmetBouncesLeft = 0;
    if (this.helmetMesh) {
      this.game.player.group.remove(this.helmetMesh);
      this.helmetMesh = null;
    }
    this.nextBigJumpScore = 2000;
    if (this.bigRamp) {
      this.game.scene.remove(this.bigRamp);
      this.bigRamp = null;
    }
    this.bigRampActive = false;
    this.springRampCount = 0;
    this.game.soundManager.stopThrash();
    this.game.soundManager.stopMotor();
    document.getElementById('shield-display')!.style.display = 'none';
    document.getElementById('metal-display')!.style.display = 'none';
  }
}
