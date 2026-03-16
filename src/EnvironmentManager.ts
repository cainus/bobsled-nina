import * as THREE from 'three';
import type { Game } from './Game';
import type { Season, TimeOfDay } from './SeasonManager';

export class EnvironmentManager {
  game: Game;

  isNight = false;
  isBlizzard = false;
  steepness = 0.5;
  steepnessTarget = 0.5;
  steepnessTimer = 0;

  private stars: THREE.Points | null = null;
  private moon: THREE.Mesh | null = null;
  private npcSnowmobiles: THREE.Group[] = [];
  private headlight: THREE.SpotLight | null = null;

  private bears: { mesh: THREE.Group; hasGrowled: boolean }[] = [];
  private nextBearScore = 0;
  private springClouds: THREE.Group[] = [];

  private ambientLight!: THREE.AmbientLight;
  private sunLight!: THREE.DirectionalLight;

  private prevSeason: Season = 'winter';
  private prevTime: TimeOfDay = 'morning';

  constructor(game: Game) {
    this.game = game;
  }

  setLights(ambient: THREE.AmbientLight, sun: THREE.DirectionalLight) {
    this.ambientLight = ambient;
    this.sunLight = sun;
  }

  updateSteepness(dt: number) {
    this.steepnessTimer -= dt;
    if (this.steepnessTimer <= 0) {
      this.steepnessTarget = 0.2 + Math.random() * 0.8;
      this.steepnessTimer = 3 + Math.random() * 5;
    }
    this.steepness += (this.steepnessTarget - this.steepness) * 2 * dt;
  }

  updateEnvironment() {
    const sm = this.game.seasonManager;
    sm.update(this.game.score);
    const config = sm.getConfig();
    const season = sm.season;
    const time = sm.timeOfDay;

    // Update sky and fog
    const bgColor = new THREE.Color(config.skyColor);
    this.game.scene.background = bgColor;
    const fogNear = time === 'night' ? 60 : 50;
    const fogFar = time === 'night' ? 160 : 140;
    this.game.scene.fog = new THREE.Fog(new THREE.Color(config.fogColor), fogNear, fogFar);

    // Update lighting
    this.ambientLight.intensity = config.ambientIntensity;
    this.sunLight.intensity = config.sunIntensity;
    this.sunLight.color.setHex(config.sunColor);

    this.isNight = time === 'night';

    // Update ground plane color per season
    const groundMat = this.game.groundMesh.material as THREE.MeshStandardMaterial;
    if (season === 'spring') {
      groundMat.color.setHex(0x2a6688);
    } else if (season === 'summer') {
      groundMat.color.setHex(0xf5deb3);
    } else if (season === 'autumn') {
      groundMat.color.setHex(0x5a8a45);
    } else {
      groundMat.color.setHex(0xf0f0f0);
    }

    // Stars at night
    if (config.showStars && !this.stars) {
      this.createStars();
    }
    if (!config.showStars && this.stars) {
      this.game.scene.remove(this.stars);
      this.stars = null;
    }

    // Bright moon at night (especially summer/autumn)
    if (this.isNight && !this.moon) {
      this.createMoon(season);
    }
    if (!this.isNight && this.moon) {
      this.game.scene.remove(this.moon);
      this.moon = null;
    }

    // Blizzard only in winter, 6000-7000 within winter's score range
    const winterBlizzard = season === 'winter' && time === 'night';
    if (winterBlizzard && !this.isBlizzard) {
      this.isBlizzard = true;
      this.game.soundManager.setWindVolume(0.45);
    } else if (!winterBlizzard && this.isBlizzard) {
      this.isBlizzard = false;
      this.game.soundManager.setWindVolume(0.18);
    }

    // Wind in winter
    if (season === 'winter' && this.game.score >= 1300) {
      this.game.soundManager.startWind();
    }

    // NPC snowmobiles during winter night
    if (this.isNight && season === 'winter' && this.npcSnowmobiles.length === 0) {
      this.spawnNpcSnowmobiles();
    }
    if ((!this.isNight || season !== 'winter') && this.npcSnowmobiles.length > 0) {
      this.removeNpcSnowmobiles();
    }
    for (const npc of this.npcSnowmobiles) {
      npc.position.y = 0.1 + Math.sin(Date.now() * 0.002 + npc.position.x) * 0.05;
    }

    // Snowmobile headlight in the dark
    const isSnowmobile = this.game.powerupManager.isSnowmobile;
    if (isSnowmobile && this.isNight && !this.headlight) {
      this.headlight = new THREE.SpotLight(0xffffcc, 8, 80, 0.5, 0.3, 1);
      this.headlight.position.set(0, 1.0, 1.8);
      this.headlight.target.position.set(0, -1, 30);
      this.headlight.castShadow = true;
      this.headlight.shadow.mapSize.width = 1024;
      this.headlight.shadow.mapSize.height = 1024;
      this.game.player.group.add(this.headlight);
      this.game.player.group.add(this.headlight.target);

      const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
      const glowMesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), glowMat);
      glowMesh.position.set(0, 0.6, 1.6);
      glowMesh.name = 'headlightGlow';
      this.game.player.group.add(glowMesh);
    }
    if (this.headlight && (!isSnowmobile || !this.isNight)) {
      this.game.player.group.remove(this.headlight.target);
      this.game.player.group.remove(this.headlight);
      this.headlight = null;
      const glow = this.game.player.group.getObjectByName('headlightGlow');
      if (glow) this.game.player.group.remove(glow);
    }

    // Spring clouds
    if (season === 'spring' && this.springClouds.length === 0) {
      this.spawnSpringClouds();
    }
    if (season !== 'spring' && this.springClouds.length > 0) {
      this.removeSpringClouds();
    }

    this.prevSeason = season;
    this.prevTime = time;
  }

  updateBears(dt: number) {
    // Bears only in winter/autumn
    const season = this.game.seasonManager.season;
    if (season === 'summer') return;
    if (this.game.score < 1700) return;

    if (this.nextBearScore === 0) {
      this.nextBearScore = 1700 + Math.floor(Math.random() * 1000);
    }

    if (this.game.score >= this.nextBearScore) {
      this.spawnBear();
      this.nextBearScore = this.game.score + 1000 + Math.floor(Math.random() * 1000);
    }

    const moveAmount = this.game.speed * dt;
    for (let i = this.bears.length - 1; i >= 0; i--) {
      const bear = this.bears[i];
      bear.mesh.position.z -= moveAmount;

      const growlDist = this.game.speed * 3;
      if (!bear.hasGrowled && bear.mesh.position.z < growlDist && bear.mesh.position.z > -5) {
        bear.hasGrowled = true;
        this.game.soundManager.playGrowl();
      }

      if (bear.mesh.position.z < -20) {
        this.game.scene.remove(bear.mesh);
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
    bear.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    this.game.scene.add(bear);
    this.bears.push({ mesh: bear, hasGrowled: false });
  }

  private createBear(): THREE.Group {
    const group = new THREE.Group();
    const furMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.9 });
    const darkFurMat = new THREE.MeshStandardMaterial({ color: 0x4a2e15, roughness: 0.95 });
    const noseMat = new THREE.MeshStandardMaterial({ color: 0x222222 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), furMat);
    body.position.y = 1.0;
    body.scale.set(1, 0.85, 1.3);
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), furMat);
    head.position.set(0, 1.6, -0.9);
    head.scale.set(1, 0.9, 1);
    head.castShadow = true;
    group.add(head);

    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), darkFurMat);
    snout.position.set(0, 1.5, -1.35);
    snout.scale.set(1, 0.7, 1.2);
    group.add(snout);

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), noseMat);
    nose.position.set(0, 1.55, -1.5);
    group.add(nose);

    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    for (const side of [-0.18, 0.18]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), eyeMat);
      eye.position.set(side, 1.7, -1.3);
      group.add(eye);
    }

    for (const side of [-0.3, 0.3]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), darkFurMat);
      ear.position.set(side, 2.0, -0.8);
      group.add(ear);
    }

    const legGeo = new THREE.CylinderGeometry(0.18, 0.2, 0.7, 8);
    const legPositions: [number, number][] = [[-0.45, -0.6], [0.45, -0.6], [-0.4, 0.5], [0.4, 0.5]];
    for (const [lx, lz] of legPositions) {
      const leg = new THREE.Mesh(legGeo, darkFurMat);
      leg.position.set(lx, 0.35, lz);
      leg.castShadow = true;
      group.add(leg);
    }

    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), furMat);
    tail.position.set(0, 1.2, 0.9);
    group.add(tail);

    group.scale.setScalar(1.4);
    return group;
  }

  private spawnSpringClouds() {
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
    const count = 6 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const cloud = new THREE.Group();
      const sphereCount = 3 + Math.floor(Math.random() * 2);
      for (let j = 0; j < sphereCount; j++) {
        const r = 1.5 + Math.random() * 1.5;
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), cloudMat);
        sphere.position.set((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 2);
        cloud.add(sphere);
      }
      cloud.position.set(
        (Math.random() - 0.5) * 80,
        15 + Math.random() * 15,
        (Math.random() - 0.5) * 80 + 40
      );
      this.game.scene.add(cloud);
      this.springClouds.push(cloud);
    }
  }

  private removeSpringClouds() {
    for (const cloud of this.springClouds) {
      this.game.scene.remove(cloud);
    }
    this.springClouds = [];
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
    this.game.scene.add(this.stars);
  }

  private createMoon(season: Season) {
    const brightness = season === 'winter' ? 0.6 : 0.9;
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xffffee });
    const moonGeo = new THREE.SphereGeometry(season === 'summer' ? 6 : 4, 16, 12);
    this.moon = new THREE.Mesh(moonGeo, moonMat);
    this.moon.position.set(40, 60, 80);
    this.game.scene.add(this.moon);

    // Moon glow light
    const moonLight = new THREE.PointLight(0xccccff, brightness, 200);
    moonLight.position.set(0, 0, 0);
    this.moon.add(moonLight);
  }

  private spawnNpcSnowmobiles() {
    for (const side of [-1, 1]) {
      const npc = new THREE.Group();

      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xddcc00 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 2.2), bodyMat);
      body.position.y = 0.2;
      body.castShadow = true;
      npc.add(body);

      const blackMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 1.0), blackMat);
      seat.position.set(0, 0.5, -0.3);
      npc.add(seat);

      const shieldMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.5 });
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.05), shieldMat);
      windshield.position.set(0, 0.65, 0.6);
      windshield.rotation.x = -0.3;
      npc.add(windshield);

      for (const ts of [-0.5, 0.5]) {
        const tread = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 2.4), blackMat);
        tread.position.set(ts, -0.05, 0);
        npc.add(tread);
      }

      const riderMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
      const riderBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.3, 6, 10), riderMat);
      riderBody.position.set(0, 0.85, -0.1);
      npc.add(riderBody);
      const riderHead = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), riderMat);
      riderHead.position.set(0, 1.25, -0.1);
      npc.add(riderHead);

      const headlight = new THREE.SpotLight(0xffffcc, 6, 60, 0.4, 0.4, 1);
      headlight.position.set(0, 0.5, 1.2);
      headlight.target.position.set(0, -1, 20);
      npc.add(headlight);
      npc.add(headlight.target);

      const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), glowMat);
      glow.position.set(0, 0.4, 1.15);
      npc.add(glow);

      npc.position.set(side * 16, 0.1, 5 + side * 3);
      this.game.scene.add(npc);
      this.npcSnowmobiles.push(npc);
    }
  }

  private removeNpcSnowmobiles() {
    for (const npc of this.npcSnowmobiles) {
      this.game.scene.remove(npc);
    }
    this.npcSnowmobiles = [];
  }

  resetBears() {
    for (const bear of this.bears) {
      this.game.scene.remove(bear.mesh);
    }
    this.bears = [];
    this.nextBearScore = 0;
  }

  resetEnvironment() {
    this.isNight = false;
    this.isBlizzard = false;
    this.prevSeason = 'winter';
    this.prevTime = 'morning';
    this.removeNpcSnowmobiles();
    this.game.scene.background = new THREE.Color(0x87ceeb);
    this.game.scene.fog = new THREE.Fog(0x87ceeb, 60, 140);
    this.ambientLight.intensity = 0.6;
    this.sunLight.intensity = 1.0;
    this.sunLight.color.setHex(0xffffff);
    if (this.stars) {
      this.game.scene.remove(this.stars);
      this.stars = null;
    }
    if (this.moon) {
      this.game.scene.remove(this.moon);
      this.moon = null;
    }
    if (this.headlight) {
      this.game.player.group.remove(this.headlight.target);
      this.game.player.group.remove(this.headlight);
      this.headlight = null;
      const glow = this.game.player.group.getObjectByName('headlightGlow');
      if (glow) this.game.player.group.remove(glow);
    }
    this.removeSpringClouds();
  }
}
