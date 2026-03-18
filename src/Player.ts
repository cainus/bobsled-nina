import * as THREE from 'three';
import type { Game } from './Game';
import type { PlayerInput } from './InputManager';

export class Player {
  game: Game;
  group: THREE.Group;

  // Lane: -1, 0, 1
  currentLane = 0;
  targetLane = 0;
  private laneTransitionSpeed = 10;

  // Jump
  isJumping = false;
  jumpVelocity = 0;
  isOnWaterfallDrop = false;
  private readonly jumpForce = 12;
  private readonly gravity = -30;
  private groundY = 0.5;
  jumpMultiplier = 1;
  private spinning = false; // 360 Y-spin
  private backflipping = false; // backflip X-rotation
  private spinAngle = 0;
  private doubleJumpReady = false; // set when double-tap detected

  // Ramp launch
  private landSoundPlayed = false;
  private landingDipTimer = 0;
  private landingDipDepth = 0;
  private landingDipDuration = 0.8;
  private wasOnUpRamp = false;
  private readonly rampLaunchForce = 8;

  // Duck
  private isDucking = false;
  private duckTimer = 0;
  private readonly duckDuration = 0.6;

  // Vehicle + character meshes
  private vehicle!: THREE.Group;
  character!: THREE.Group;
  private normalCharacterScale = new THREE.Vector3(1, 1, 1);
  currentVehicle: 'bobsled' | 'skis' | 'snowboard' | 'rainbowSkis' | 'mountainBike' | 'motorbike' | 'kayak' | 'jetski' | 'rainbowKayak' | 'canoe' = 'skis';
  private isMetalMode = false;
  private readonly outfitColor = 0x2196f3;
  private readonly metalColor = 0x111111;
  private crankGroup: THREE.Group | null = null;
  private paddleGroup: THREE.Group | null = null;
  private blackHelmetGroup: THREE.Group | null = null;
  private leftLeg: THREE.Group | null = null;
  private rightLeg: THREE.Group | null = null;

  private isWaterVehicle(): boolean {
    return this.currentVehicle === 'kayak' || this.currentVehicle === 'rainbowKayak' || this.currentVehicle === 'canoe';
  }

  constructor(game: Game) {
    this.game = game;
    this.group = new THREE.Group();
    this.buildVehicle('skis');
    this.buildCharacter();
    this.group.position.set(0, this.groundY, 0);
    game.scene.add(this.group);
  }

  switchVehicle(type: 'bobsled' | 'skis' | 'snowboard' | 'rainbowSkis' | 'mountainBike' | 'motorbike' | 'kayak' | 'jetski' | 'rainbowKayak' | 'canoe') {
    if (this.currentVehicle === type) return;
    this.currentVehicle = type;
    // Remove old vehicle and character, rebuild
    this.group.remove(this.vehicle);
    this.group.remove(this.character);
    this.buildVehicle(type);
    this.buildCharacter();
  }

  private buildVehicle(type: 'bobsled' | 'skis' | 'snowboard' | 'rainbowSkis' | 'mountainBike' | 'motorbike' | 'kayak' | 'jetski' | 'rainbowKayak' | 'canoe') {
    this.vehicle = new THREE.Group();

    this.crankGroup = null;
    this.paddleGroup = null;

    switch (type) {
      case 'bobsled':
        this.buildBobsledParts();
        break;
      case 'skis':
        this.buildSkisParts();
        break;
      case 'snowboard':
        this.buildSnowboardParts();
        break;
      case 'rainbowSkis':
        this.buildRainbowSkisParts();
        break;
      case 'mountainBike':
        this.buildMountainBikeParts();
        break;
      case 'motorbike':
        this.buildMotorbikeParts();
        break;
      case 'kayak':
        this.buildKayakParts();
        break;
      case 'rainbowKayak':
        this.buildRainbowKayakParts();
        break;
      case 'jetski':
        this.buildJetskiParts();
        break;
      case 'canoe':
        this.buildCanoeParts();
        break;
    }

    this.vehicle.position.y = -0.1;
    this.group.add(this.vehicle);
  }

  private buildBobsledParts() {
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe63946 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0xcc2233 });
    const runnerMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.2 });

    // Main hull — the cockpit area
    const bodyGeo = new THREE.BoxGeometry(1.4, 0.35, 2.4);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, 0.0, -0.1);
    body.castShadow = true;
    this.vehicle.add(body);

    // Nose — tapered front using a scaled box
    const noseGeo = new THREE.BoxGeometry(1.0, 0.3, 0.8);
    const nose = new THREE.Mesh(noseGeo, bodyMat);
    nose.position.set(0, 0.05, 1.4);
    nose.castShadow = true;
    this.vehicle.add(nose);

    // Nose tip — small rounded end
    const noseTipGeo = new THREE.BoxGeometry(0.6, 0.25, 0.4);
    const noseTip = new THREE.Mesh(noseTipGeo, bodyMat);
    noseTip.position.set(0, 0.08, 1.85);
    this.vehicle.add(noseTip);

    // Nose cap — curved upturn
    const capGeo = new THREE.SphereGeometry(0.3, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const cap = new THREE.Mesh(capGeo, bodyMat);
    cap.position.set(0, 0.08, 2.0);
    cap.scale.set(1, 0.6, 0.8);
    this.vehicle.add(cap);

    // Side rails — cockpit walls
    for (const side of [-0.65, 0.65]) {
      const railGeo = new THREE.BoxGeometry(0.12, 0.4, 2.2);
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(side, 0.3, -0.1);
      this.vehicle.add(rail);
    }

    // Back wall
    const backGeo = new THREE.BoxGeometry(1.4, 0.4, 0.12);
    const back = new THREE.Mesh(backGeo, railMat);
    back.position.set(0, 0.3, -1.2);
    this.vehicle.add(back);

    // Runners (metal blades underneath)
    const runnerGeo = new THREE.BoxGeometry(0.1, 0.12, 3.2);
    for (const side of [-0.6, 0.6]) {
      const runner = new THREE.Mesh(runnerGeo, runnerMat);
      runner.position.set(side, -0.22, 0.1);
      this.vehicle.add(runner);
    }
  }

  private buildSkisParts() {
    const skiMat = new THREE.MeshStandardMaterial({ color: 0x1565c0 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8, roughness: 0.2 });

    // Two skis
    for (const side of [-0.25, 0.25]) {
      // Ski body - long thin board
      const skiGeo = new THREE.BoxGeometry(0.18, 0.06, 2.4);
      const ski = new THREE.Mesh(skiGeo, skiMat);
      ski.position.set(side, -0.05, 0.2);
      ski.castShadow = true;
      this.vehicle.add(ski);

      // Ski tip - flat upturned front
      const tipGeo = new THREE.BoxGeometry(0.18, 0.06, 0.25);
      const tip = new THREE.Mesh(tipGeo, skiMat);
      tip.position.set(side, 0.02, 1.48);
      tip.rotation.x = -0.3;
      this.vehicle.add(tip);

      // Binding
      const bindingGeo = new THREE.BoxGeometry(0.2, 0.1, 0.25);
      const binding = new THREE.Mesh(bindingGeo, metalMat);
      binding.position.set(side, 0.03, 0);
      this.vehicle.add(binding);
    }

    if (this.game.seasonManager.season === 'summer') {
      // Waterski handle — triangle bar held in front
      const handleMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
      // Horizontal bar (the grip)
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), handleMat);
      bar.position.set(0, 0.90, 0.50);
      bar.rotation.z = Math.PI / 2;
      this.vehicle.add(bar);
      // Two arms forming the V from bar ends to a point ahead
      for (const side of [-0.25, 0.25]) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 6), handleMat);
        arm.position.set(side / 2, 0.90, 0.85);
        arm.rotation.x = Math.PI / 2;
        arm.rotation.z = side > 0 ? 0.15 : -0.15;
        this.vehicle.add(arm);
      }
      // Junction point where rope connects
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), handleMat);
      knot.position.set(0, 0.90, 1.20);
      this.vehicle.add(knot);
    } else {
      // Ski poles — horizontal from hands, extending backward
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
      const basketMat = new THREE.MeshStandardMaterial({ color: 0xff4444 });
      for (const side of [-0.30, 0.30]) {
        const handVY = 0.90;
        const handVZ = 0.46;
        const poleLen = 1.3;

        const poleGeo = new THREE.CylinderGeometry(0.02, 0.02, poleLen, 6);
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(side, handVY, handVZ - poleLen / 2);
        pole.rotation.x = Math.PI / 2;
        pole.castShadow = true;
        this.vehicle.add(pole);

        const gripGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.15, 6);
        const grip = new THREE.Mesh(gripGeo, new THREE.MeshStandardMaterial({ color: 0x222222 }));
        grip.position.set(side, handVY, handVZ);
        grip.rotation.x = Math.PI / 2;
        this.vehicle.add(grip);

        const basketGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.02, 8);
        const basket = new THREE.Mesh(basketGeo, basketMat);
        basket.position.set(side, handVY, handVZ - poleLen);
        basket.rotation.x = Math.PI / 2;
        this.vehicle.add(basket);
      }
    }
  }

  private buildRainbowSkisParts() {
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.8, roughness: 0.2 });
    const rainbowColors = [0xff0000, 0xff8800, 0xffff00, 0x00cc00, 0x0088ff, 0x8800ff];

    // Two rainbow skis
    for (const side of [-0.25, 0.25]) {
      // Ski built from rainbow segments
      const segLength = 2.4 / rainbowColors.length;
      for (let i = 0; i < rainbowColors.length; i++) {
        const segGeo = new THREE.BoxGeometry(0.18, 0.06, segLength);
        const segMat = new THREE.MeshStandardMaterial({
          color: rainbowColors[i],
          metalness: 0.4,
          roughness: 0.3,
        });
        const seg = new THREE.Mesh(segGeo, segMat);
        seg.position.set(side, -0.05, -1.0 + segLength / 2 + i * segLength);
        seg.castShadow = true;
        this.vehicle.add(seg);
      }

      // Ski tip - gold flat upturned front
      const tipMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.6, roughness: 0.2 });
      const tipGeo = new THREE.BoxGeometry(0.18, 0.06, 0.25);
      const tip = new THREE.Mesh(tipGeo, tipMat);
      tip.position.set(side, 0.02, 1.48);
      tip.rotation.x = -0.3;
      this.vehicle.add(tip);

      // Binding
      const bindingGeo = new THREE.BoxGeometry(0.2, 0.1, 0.25);
      const binding = new THREE.Mesh(bindingGeo, metalMat);
      binding.position.set(side, 0.03, 0);
      this.vehicle.add(binding);
    }

    // Gold ski poles — horizontal from hands, extending backward
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.6, roughness: 0.2 });
    const basketMat = new THREE.MeshStandardMaterial({ color: 0xff00ff });
    for (const side of [-0.30, 0.30]) {
      const handVY = 0.90;
      const handVZ = 0.46;
      const poleLen = 1.3;

      const poleGeo = new THREE.CylinderGeometry(0.02, 0.02, poleLen, 6);
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(side, handVY, handVZ - poleLen / 2);
      pole.rotation.x = Math.PI / 2;
      pole.castShadow = true;
      this.vehicle.add(pole);

      const gripGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.15, 6);
      const grip = new THREE.Mesh(gripGeo, new THREE.MeshStandardMaterial({ color: 0x222222 }));
      grip.position.set(side, handVY, handVZ);
      grip.rotation.x = Math.PI / 2;
      this.vehicle.add(grip);

      const basketGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.02, 8);
      const basket = new THREE.Mesh(basketGeo, basketMat);
      basket.position.set(side, handVY, handVZ - poleLen);
      basket.rotation.x = Math.PI / 2;
      this.vehicle.add(basket);
    }
  }

  private buildSnowboardParts() {
    // Single wide board
    const boardMat = new THREE.MeshStandardMaterial({ color: 0x9c27b0 }); // purple board
    const boardGeo = new THREE.BoxGeometry(0.7, 0.08, 2.2);
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.set(0, -0.05, 0.2);
    board.castShadow = true;
    this.vehicle.add(board);

    // Board graphic stripe
    const stripeGeo = new THREE.BoxGeometry(0.5, 0.085, 0.8);
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xff4081 });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.set(0, -0.045, 0.2);
    this.vehicle.add(stripe);

    // Nose - flat upturned front
    const noseGeo = new THREE.BoxGeometry(0.7, 0.08, 0.3);
    const nose = new THREE.Mesh(noseGeo, boardMat);
    nose.position.set(0, 0.02, 1.45);
    nose.rotation.x = -0.3;
    this.vehicle.add(nose);

    // Tail - flat uptick
    const tailGeo = new THREE.BoxGeometry(0.7, 0.08, 0.25);
    const tail = new THREE.Mesh(tailGeo, boardMat);
    tail.position.set(0, 0.02, -1.0);
    tail.rotation.x = 0.3;
    this.vehicle.add(tail);

    // Bindings
    const bindingMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    for (const z of [-0.15, 0.5]) {
      const bindingGeo = new THREE.BoxGeometry(0.35, 0.12, 0.2);
      const binding = new THREE.Mesh(bindingGeo, bindingMat);
      binding.position.set(0, 0.04, z);
      this.vehicle.add(binding);

      // Binding straps
      const strapGeo = new THREE.BoxGeometry(0.4, 0.06, 0.04);
      const strapMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
      const strap = new THREE.Mesh(strapGeo, strapMat);
      strap.position.set(0, 0.1, z);
      this.vehicle.add(strap);
    }

    // Edge highlights (metal edges)
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.6, roughness: 0.3 });
    for (const side of [-0.35, 0.35]) {
      const edgeGeo = new THREE.BoxGeometry(0.03, 0.08, 2.2);
      const edge = new THREE.Mesh(edgeGeo, edgeMat);
      edge.position.set(side, -0.05, 0.2);
      this.vehicle.add(edge);
    }
  }

  private buildMountainBikeParts() {
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xcc4400, metalness: 0.5, roughness: 0.3 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.2 });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });

    // Wheels — rotate into YZ plane so they face sideways (thin edge toward camera)
    for (const z of [-0.8, 0.8]) {
      // Tire
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.1, 10, 16), tireMat);
      tire.position.set(0, 0.0, z);
      tire.rotation.y = Math.PI / 2;
      tire.castShadow = true;
      this.vehicle.add(tire);
      // Rim
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 8, 16), metalMat);
      rim.position.set(0, 0.0, z);
      rim.rotation.y = Math.PI / 2;
      this.vehicle.add(rim);
      // Hub — axle runs along X
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 8), metalMat);
      hub.position.set(0, 0.0, z);
      hub.rotation.z = Math.PI / 2;
      this.vehicle.add(hub);
      // Spokes — radiate in YZ plane
      for (let i = 0; i < 8; i++) {
        const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.32, 4), metalMat);
        const angle = (i / 8) * Math.PI * 2;
        spoke.position.set(0, Math.sin(angle) * 0.16, z + Math.cos(angle) * 0.16);
        spoke.rotation.x = angle;
        this.vehicle.add(spoke);
      }
    }

    // Frame — diamond shape connecting wheels
    // Down tube (bottom bracket to front)
    const downTube = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6), frameMat);
    downTube.position.set(0, 0.15, 0);
    downTube.rotation.x = Math.PI / 2;
    this.vehicle.add(downTube);

    // Seat tube (vertical)
    const seatTube = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6), frameMat);
    seatTube.position.set(0, 0.35, -0.3);
    this.vehicle.add(seatTube);

    // Top tube
    const topTube = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 6), frameMat);
    topTube.position.set(0, 0.6, 0.1);
    topTube.rotation.x = Math.PI / 2;
    this.vehicle.add(topTube);

    // Fork to front wheel
    for (const side of [-0.04, 0.04]) {
      const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), metalMat);
      fork.position.set(side, 0.25, 0.7);
      fork.rotation.x = 0.15;
      this.vehicle.add(fork);
    }

    // Handlebars
    const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), blackMat);
    handlebar.position.set(0, 0.65, 0.75);
    handlebar.rotation.z = Math.PI / 2;
    this.vehicle.add(handlebar);
    // Grips
    for (const side of [-0.35, 0.35]) {
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 8), blackMat);
      grip.position.set(side, 0.65, 0.75);
      grip.rotation.z = Math.PI / 2;
      this.vehicle.add(grip);
    }

    // Seat
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.35), blackMat);
    seat.position.set(0, 0.72, -0.3);
    this.vehicle.add(seat);

    // Pedals/cranks — rotating crank group
    const crankMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.7 });
    this.crankGroup = new THREE.Group();
    this.crankGroup.userData = { animCrank: true };
    this.crankGroup.position.set(0, -0.05, 0);
    for (const side of [-0.15, 0.15]) {
      const pedal = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.06), crankMat);
      pedal.position.set(side, 0, 0);
      this.crankGroup.add(pedal);
    }
    // Crank arm connecting the two pedals
    const crankArm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6), crankMat);
    crankArm.rotation.z = Math.PI / 2;
    this.crankGroup.add(crankArm);
    this.vehicle.add(this.crankGroup);
  }

  private buildMotorbikeParts() {
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.3 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, metalness: 0.4, roughness: 0.3 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.8, roughness: 0.2 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.1 });

    // Wheels
    for (const z of [-0.9, 0.9]) {
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.12, 10, 16), tireMat);
      tire.position.set(0, 0.0, z);
      tire.rotation.y = Math.PI / 2;
      tire.castShadow = true;
      this.vehicle.add(tire);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 8, 16), chromeMat);
      rim.position.set(0, 0.0, z);
      rim.rotation.y = Math.PI / 2;
      this.vehicle.add(rim);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.14, 8), metalMat);
      hub.position.set(0, 0.0, z);
      hub.rotation.z = Math.PI / 2;
      this.vehicle.add(hub);
    }

    // Engine block — chunky box between wheels
    const engine = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.6), frameMat);
    engine.position.set(0, -0.05, 0);
    engine.castShadow = true;
    this.vehicle.add(engine);

    // Exhaust pipes
    for (const side of [-0.3, 0.3]) {
      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.8, 8), chromeMat);
      exhaust.position.set(side, -0.1, -0.6);
      exhaust.rotation.x = 0.3;
      this.vehicle.add(exhaust);
    }

    // Fuel tank — red, on top of frame
    const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.4, 8, 12), redMat);
    tank.position.set(0, 0.3, 0.1);
    tank.rotation.x = Math.PI / 2;
    tank.castShadow = true;
    this.vehicle.add(tank);

    // Frame tubes
    // Down tube to front wheel
    const downTube = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.4, 6), frameMat);
    downTube.position.set(0, 0.1, 0);
    downTube.rotation.x = Math.PI / 2;
    this.vehicle.add(downTube);
    // Seat stay to rear
    const seatStay = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.8, 6), frameMat);
    seatStay.position.set(0, 0.15, -0.45);
    seatStay.rotation.x = 0.5;
    this.vehicle.add(seatStay);

    // Front forks
    for (const side of [-0.05, 0.05]) {
      const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.6, 6), chromeMat);
      fork.position.set(side, 0.2, 0.75);
      fork.rotation.x = 0.2;
      this.vehicle.add(fork);
    }

    // Handlebars
    const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.8, 6), frameMat);
    handlebar.position.set(0, 0.55, 0.8);
    handlebar.rotation.z = Math.PI / 2;
    this.vehicle.add(handlebar);
    // Grips
    for (const side of [-0.4, 0.4]) {
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 8),
        new THREE.MeshStandardMaterial({ color: 0x333333 }));
      grip.position.set(side, 0.55, 0.8);
      grip.rotation.z = Math.PI / 2;
      this.vehicle.add(grip);
    }

    // Seat
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x333333 }));
    seat.position.set(0, 0.45, -0.35);
    this.vehicle.add(seat);

    // Headlight
    const headlightMat = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffff88, emissiveIntensity: 0.3 });
    const headlight = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), headlightMat);
    headlight.position.set(0, 0.35, 0.95);
    this.vehicle.add(headlight);

    // Rear fender
    const fender = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.5), frameMat);
    fender.position.set(0, 0.15, -0.7);
    fender.rotation.x = -0.2;
    this.vehicle.add(fender);

    // Tail light
    const tailMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.2 });
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.06, 0.04), tailMat);
    tail.position.set(0, 0.2, -0.95);
    this.vehicle.add(tail);
  }

  private buildKayakParts() {
    const hullMat = new THREE.MeshStandardMaterial({ color: 0xe64a19, roughness: 0.4 }); // red-orange
    const deckMat = new THREE.MeshStandardMaterial({ color: 0xff8a50 }); // lighter orange top
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xffcc02, metalness: 0.3, roughness: 0.4 });
    const paddleMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xffcc02, metalness: 0.2, roughness: 0.4 });

    // Hull — long narrow capsule shape
    const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 2.2, 8, 16), hullMat);
    hull.rotation.x = Math.PI / 2;
    hull.position.set(0, -0.05, 0.1);
    hull.scale.set(0.7, 1, 0.5);
    hull.castShadow = true;
    this.vehicle.add(hull);

    // Deck — flat top surface
    const deckGeo = new THREE.BoxGeometry(0.44, 0.06, 2.4);
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.set(0, 0.1, 0.1);
    this.vehicle.add(deck);

    // Cockpit opening — rim ring where player sits
    const cockpitRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.03, 8, 16),
      rimMat
    );
    cockpitRim.position.set(0, 0.14, 0);
    cockpitRim.rotation.x = Math.PI / 2;
    this.vehicle.add(cockpitRim);

    // Cockpit interior dark
    const cockpitMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const cockpit = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.08, 12), cockpitMat);
    cockpit.position.set(0, 0.1, 0);
    this.vehicle.add(cockpit);

    // Bow point (front)
    const bow = new THREE.Mesh(
      new THREE.ConeGeometry(0.15, 0.5, 8),
      hullMat
    );
    bow.rotation.x = Math.PI / 2;
    bow.position.set(0, 0.05, 1.5);
    this.vehicle.add(bow);

    // Stern point (back)
    const stern = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.4, 8),
      hullMat
    );
    stern.rotation.x = -Math.PI / 2;
    stern.position.set(0, 0.05, -1.2);
    this.vehicle.add(stern);

    // Paddle — in a group for animation
    this.paddleGroup = new THREE.Group();
    this.paddleGroup.userData = { animPaddle: true };
    this.paddleGroup.position.set(0, 0.3, 0.2);
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 2.2, 6),
      paddleMat
    );
    shaft.rotation.z = Math.PI / 2;
    this.paddleGroup.add(shaft);
    for (const side of [-1.1, 1.1]) {
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.02, 0.35),
        bladeMat
      );
      blade.position.set(side, 0, 0);
      blade.rotation.y = side > 0 ? 0.3 : -0.3;
      this.paddleGroup.add(blade);
    }
    this.vehicle.add(this.paddleGroup);

    // Decorative stripe along hull
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffee58 });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 2.2), stripeMat);
    stripe.position.set(0, 0.0, 0.1);
    this.vehicle.add(stripe);
  }

  private buildRainbowKayakParts() {
    const rainbowColors = [0xff0000, 0xff8800, 0xffff00, 0x00cc00, 0x0088ff, 0x8800ff];
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.8, roughness: 0.2 });

    // Hull built from rainbow segments
    const segCount = rainbowColors.length;
    const hullLen = 2.8;
    const segLen = hullLen / segCount;
    for (let i = 0; i < segCount; i++) {
      const segMat = new THREE.MeshStandardMaterial({ color: rainbowColors[i], metalness: 0.3, roughness: 0.3 });
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, segLen), segMat);
      seg.position.set(0, -0.05, -hullLen / 2 + segLen / 2 + i * segLen + 0.2);
      seg.castShadow = true;
      this.vehicle.add(seg);
    }

    // Bow point (front) — gold, matching regular kayak orientation
    const bowMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.6, roughness: 0.2 });
    const bow = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 8), bowMat);
    bow.rotation.x = Math.PI / 2;
    bow.position.set(0, 0.05, 1.5);
    this.vehicle.add(bow);
    // Stern point (back)
    const stern = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 8), bowMat);
    stern.rotation.x = -Math.PI / 2;
    stern.position.set(0, 0.05, -1.2);
    this.vehicle.add(stern);

    // Cockpit rim — gold
    const rimGeo = new THREE.TorusGeometry(0.32, 0.04, 8, 16);
    const rim = new THREE.Mesh(rimGeo, bowMat);
    rim.position.set(0, 0.1, 0);
    rim.rotation.x = Math.PI / 2;
    this.vehicle.add(rim);

    // Cockpit interior
    const interiorMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const interior = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.15, 12), interiorMat);
    interior.position.set(0, 0.02, 0);
    this.vehicle.add(interior);

    // Gold paddle — in a group for animation
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.6 });
    this.paddleGroup = new THREE.Group();
    this.paddleGroup.userData = { animPaddle: true };
    this.paddleGroup.position.set(0, 0.3, 0.2);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.2, 6), shaftMat);
    shaft.rotation.z = Math.PI / 2;
    this.paddleGroup.add(shaft);
    for (const side of [-0.8, 0.8]) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.3), bowMat);
      blade.position.set(side, 0, 0);
      blade.rotation.y = side > 0 ? 0.3 : -0.3;
      this.paddleGroup.add(blade);
    }
    this.vehicle.add(this.paddleGroup);
  }

  private buildCanoeParts() {
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.5 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.7 });

    // Hull
    const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 2.4, 6, 12), hullMat);
    hull.position.set(0, -0.05, 0.1);
    hull.rotation.x = Math.PI / 2;
    hull.scale.set(1, 1, 0.5);
    hull.castShadow = true;
    this.vehicle.add(hull);

    for (const z of [1.5, -1.2]) {
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.5, 8), hullMat);
      tip.rotation.x = z > 0 ? -Math.PI / 2 : Math.PI / 2;
      tip.position.set(0, 0, z);
      this.vehicle.add(tip);
    }

    for (const side of [-0.33, 0.33]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 2.6), woodMat);
      rail.position.set(side, 0.12, 0.1);
      this.vehicle.add(rail);
    }

    const thwart = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 0.08), woodMat);
    thwart.position.set(0, 0.1, 0.3);
    this.vehicle.add(thwart);

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.3), woodMat);
    seat.position.set(0, 0.05, -0.1);
    this.vehicle.add(seat);

    const paddleMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6), paddleMat);
    shaft.position.set(0.4, 0.3, 0.4);
    shaft.rotation.z = 0.3;
    this.vehicle.add(shaft);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 0.35), paddleMat);
    blade.position.set(0.6, -0.15, 0.4);
    this.vehicle.add(blade);
  }

  private buildJetskiParts() {
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x1565c0, roughness: 0.3 }); // blue hull
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.3 });
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.2 });
    const grateMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.6, roughness: 0.3 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x00bcd4 }); // cyan accent

    // Main hull — streamlined body
    const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.8, 8, 16), hullMat);
    hull.rotation.x = Math.PI / 2;
    hull.position.set(0, -0.05, 0.1);
    hull.scale.set(0.8, 1, 0.55);
    hull.castShadow = true;
    this.vehicle.add(hull);

    // Upper deck — white
    const deckGeo = new THREE.BoxGeometry(0.55, 0.1, 2.0);
    const deck = new THREE.Mesh(deckGeo, whiteMat);
    deck.position.set(0, 0.12, 0.1);
    this.vehicle.add(deck);

    // Bow — pointed front
    const bow = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 8), hullMat);
    bow.rotation.x = Math.PI / 2;
    bow.position.set(0, 0.05, 1.35);
    this.vehicle.add(bow);

    // Front accent stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 1.2), accentMat);
    stripe.position.set(0, 0.18, 0.4);
    this.vehicle.add(stripe);

    // Seat — elongated black cushion
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.7), seatMat);
    seat.position.set(0, 0.22, -0.1);
    this.vehicle.add(seat);

    // Seat back rest
    const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.08), seatMat);
    backrest.position.set(0, 0.32, -0.45);
    this.vehicle.add(backrest);

    // Handlebar column
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 6), metalMat);
    column.position.set(0, 0.42, 0.35);
    column.rotation.x = -0.3;
    this.vehicle.add(column);

    // Handlebars — horizontal bar
    const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.6, 6), metalMat);
    handlebar.position.set(0, 0.6, 0.42);
    handlebar.rotation.z = Math.PI / 2;
    this.vehicle.add(handlebar);

    // Grips
    for (const side of [-0.3, 0.3]) {
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 8), seatMat);
      grip.position.set(side, 0.6, 0.42);
      grip.rotation.z = Math.PI / 2;
      this.vehicle.add(grip);
    }

    // Small windshield
    const windshieldMat = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.4,
      metalness: 0.3,
    });
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.03), windshieldMat);
    windshield.position.set(0, 0.45, 0.55);
    windshield.rotation.x = -0.4;
    this.vehicle.add(windshield);

    // Intake grate on back
    for (let i = 0; i < 5; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.015, 0.04), grateMat);
      slat.position.set(0, 0.05 + i * 0.04, -0.85 - i * 0.02);
      this.vehicle.add(slat);
    }

    // Grate frame
    const grateFrame = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.03), metalMat);
    grateFrame.position.set(0, 0.13, -0.92);
    this.vehicle.add(grateFrame);

    // Side panels — blue accent
    for (const side of [-0.3, 0.3]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.15, 1.0), hullMat);
      panel.position.set(side, 0.08, 0.1);
      this.vehicle.add(panel);
    }

    // Rear platform / step
    const rearPlatform = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.3), whiteMat);
    rearPlatform.position.set(0, 0.08, -0.7);
    this.vehicle.add(rearPlatform);
  }

  private buildCharacter() {
    this.character = new THREE.Group();
    const isSummerLook = this.game.seasonManager.season === 'summer';
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf4c7a1, roughness: 0.8 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x6b3a2a, roughness: 0.9 });
    const outfitMat = new THREE.MeshStandardMaterial({ color: isSummerLook ? 0xf8f4ee : this.outfitColor });
    const accentMat = new THREE.MeshStandardMaterial({ color: isSummerLook ? 0xff6f91 : 0x1976d2 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: isSummerLook ? 0x111111 : 0x1565c0 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x333333 });

    // --- Torso --- rounded capsule shape, leaned forward for tuck
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.35, 8, 16), outfitMat);
    torso.position.set(0, 0.8, 0.08);
    torso.rotation.x = 0.25;
    torso.castShadow = true;
    this.character.add(torso);

    // Jacket collar / zip detail
    const zip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.02), accentMat);
    zip.position.set(0, 0.8, 0.28);
    this.character.add(zip);

    if (isSummerLook) {
      const bottoms = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.18, 0.3), pantsMat);
      bottoms.position.set(0, 0.48, 0.02);
      bottoms.castShadow = true;
      this.character.add(bottoms);
    }

    // --- Head group ---
    const headGroup = new THREE.Group();

    // Head — smooth sphere
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 16), skinMat);
    head.position.y = 1.42;
    head.castShadow = true;
    headGroup.add(head);

    // Cheeks — subtle blush
    const cheekMat = new THREE.MeshStandardMaterial({ color: 0xf0a89a, roughness: 0.9 });
    for (const side of [-0.18, 0.18]) {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), cheekMat);
      cheek.position.set(side, 1.38, 0.24);
      cheek.scale.set(1, 0.7, 0.5);
      headGroup.add(cheek);
    }

    // Nose — small bump
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), skinMat);
    nose.position.set(0, 1.40, 0.3);
    headGroup.add(nose);

    // Eyes — white with dark iris
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const irisMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    for (const side of [-0.1, 0.1]) {
      // White
      const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), eyeWhiteMat);
      eyeWhite.position.set(side, 1.46, 0.25);
      eyeWhite.scale.set(1, 1.1, 0.5);
      headGroup.add(eyeWhite);
      // Iris
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), irisMat);
      iris.position.set(side, 1.46, 0.28);
      headGroup.add(iris);
      // Pupil
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), pupilMat);
      pupil.position.set(side, 1.46, 0.30);
      headGroup.add(pupil);
      // Highlight
      const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 6), hlMat);
      hl.position.set(side + 0.02, 1.48, 0.305);
      headGroup.add(hl);
    }

    // Eyebrows
    const browMat = new THREE.MeshStandardMaterial({ color: 0x5a3520 });
    for (const side of [-0.1, 0.1]) {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.02), browMat);
      brow.position.set(side, 1.53, 0.27);
      brow.rotation.z = side > 0 ? -0.1 : 0.1;
      headGroup.add(brow);
    }

    // Mouth — small curved shape
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0xcc6666 });
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 8, 12, Math.PI), mouthMat);
    mouth.position.set(0, 1.35, 0.28);
    mouth.rotation.x = Math.PI;
    headGroup.add(mouth);

    // Helmet — black ski helmet, open face (in a group so it can be hidden)
    this.blackHelmetGroup = new THREE.Group();
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.2 });
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.45),
      helmetMat
    );
    helmet.position.y = 1.46;
    this.blackHelmetGroup.add(helmet);

    // Helmet side coverage — ear guards
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 });
    for (const side of [-1, 1]) {
      const earGuard = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 6, 0, Math.PI, 0, Math.PI * 0.5),
        rimMat
      );
      earGuard.position.set(side * 0.28, 1.38, 0);
      earGuard.rotation.z = side * -0.3;
      this.blackHelmetGroup.add(earGuard);
    }

    // (helmet rim removed)

    // Vent slots on top
    const ventMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
    for (let i = -1; i <= 1; i++) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.01, 0.12), ventMat);
      vent.position.set(i * 0.08, 1.72, 0);
      this.blackHelmetGroup.add(vent);
    }
    headGroup.add(this.blackHelmetGroup);
    if (isSummerLook) {
      this.blackHelmetGroup.visible = false;
    }

    // Hair peeking out from under helmet — bangs at forehead
    const bangs = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.15),
      hairMat
    );
    bangs.position.set(0, 1.42, 0.02);
    headGroup.add(bangs);

    // Hair at sides visible under ear guards
    for (const side of [-0.22, 0.22]) {
      const sideHair = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), hairMat);
      sideHair.position.set(side, 1.32, 0.05);
      sideHair.scale.set(1, 1.3, 0.8);
      headGroup.add(sideHair);
    }

    // Hair covering entire back half of head — extends from helmet down to ponytail
    const backHair = new THREE.Mesh(
      new THREE.SphereGeometry(0.31, 14, 10, Math.PI * 0.7, Math.PI * 1.6),
      hairMat
    );
    backHair.position.set(0, 1.42, 0);
    headGroup.add(backHair);

    // Ponytail — emerges from back/bottom of helmet
    for (let i = 0; i < 7; i++) {
      const size = 0.1 - i * 0.008;
      const pt = new THREE.Mesh(new THREE.SphereGeometry(size, 12, 10), hairMat);
      pt.position.set(0, 1.28 - i * 0.08, -0.3 - i * 0.1);
      headGroup.add(pt);
    }

    // Goggles — torus rings with colored lens
    const goggleFrameMat = new THREE.MeshStandardMaterial({ color: 0xff6600, metalness: 0.3 });
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      transparent: true,
      opacity: 0.5,
      metalness: 0.6,
    });
    for (const side of [-0.11, 0.11]) {
      const frame = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 10, 16), goggleFrameMat);
      frame.position.set(side, 1.48, 0.26);
      headGroup.add(frame);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.075, 16), lensMat);
      lens.position.set(side, 1.48, 0.265);
      headGroup.add(lens);
    }
    // Goggle bridge
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.02), goggleFrameMat);
    bridge.position.set(0, 1.48, 0.27);
    headGroup.add(bridge);
    // Goggle strap
    const strapMat = new THREE.MeshStandardMaterial({ color: 0xff8800 });
    for (const side of [-1, 1]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.15), strapMat);
      strap.position.set(side * 0.2, 1.48, 0.18);
      headGroup.add(strap);
    }

    if (this.currentVehicle === 'snowboard') {
      headGroup.rotation.y = -Math.PI / 2;
    }
    // Shift head forward to match torso lean
    headGroup.position.z = 0.30;
    this.character.add(headGroup);

    // --- Arms --- connected at shoulders, two-segment (upper arm + forearm)
    const hasSkiPoles = this.currentVehicle === 'skis' || this.currentVehicle === 'rainbowSkis';
    const hasHandlebars = this.currentVehicle === 'mountainBike' || this.currentVehicle === 'motorbike' || this.currentVehicle === 'jetski';

    // Handlebar grip positions in character space
    let handleGripX = 0, handleGripY = 0, handleGripZ = 0;
    if (this.currentVehicle === 'mountainBike') {
      handleGripX = 0.35; handleGripY = 0.60; handleGripZ = 0.75;
    } else if (this.currentVehicle === 'motorbike') {
      handleGripX = 0.40; handleGripY = 0.80; handleGripZ = 1.1;
    } else if (this.currentVehicle === 'jetski') {
      handleGripX = 0.30; handleGripY = 0.55; handleGripZ = 0.42;
    }

    for (const side of [-1, 1]) {
      const sx = side * 0.3;

      // Shoulder joint
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), outfitMat);
      shoulder.position.set(sx, 0.95, 0.02);
      shoulder.castShadow = true;
      this.character.add(shoulder);

      let handX: number, handY: number, handZ: number;

      if (hasSkiPoles) {
        // Upper arm — tuck pose
        const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.28, 8), outfitMat);
        upperArm.position.set(side * 0.34, 0.72, 0.14);
        upperArm.rotation.x = -0.5;
        upperArm.rotation.z = side * -0.12;
        upperArm.castShadow = true;
        this.character.add(upperArm);

        const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.26, 8), outfitMat);
        forearm.position.set(side * 0.32, 0.56, 0.32);
        forearm.rotation.x = -1.4;
        forearm.rotation.z = side * -0.08;
        forearm.castShadow = true;
        this.character.add(forearm);

        handX = side * 0.30; handY = 0.65; handZ = 0.46;
      } else if (hasHandlebars) {
        // Arms reaching forward and down to grip handlebars
        handX = side * handleGripX; handY = handleGripY; handZ = handleGripZ;

        const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.28, 8), outfitMat);
        upperArm.position.set(side * 0.34, 0.76, 0.18);
        upperArm.rotation.x = -0.8; // angled forward and down
        upperArm.rotation.z = side * -0.15;
        upperArm.castShadow = true;
        this.character.add(upperArm);

        const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.26, 8), outfitMat);
        forearm.position.set(side * 0.35, 0.58, 0.38);
        forearm.rotation.x = -1.2; // bent forward toward handlebars
        forearm.rotation.z = side * -0.1;
        forearm.castShadow = true;
        this.character.add(forearm);
      } else {
        // Default arm pose
        const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.28, 8), outfitMat);
        upperArm.position.set(side * 0.38, 0.78, 0.06);
        upperArm.rotation.x = -0.3;
        upperArm.rotation.z = side * -0.2;
        upperArm.castShadow = true;
        this.character.add(upperArm);

        const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.26, 8), outfitMat);
        forearm.position.set(side * 0.42, 0.56, 0.16);
        forearm.rotation.x = -0.5;
        forearm.castShadow = true;
        this.character.add(forearm);

        handX = side * 0.42; handY = 0.40; handZ = 0.24;
      }

      // Glove
      const handMat = isSummerLook ? skinMat : darkMat;
      const glove = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), handMat);
      glove.position.set(handX, handY, handZ);
      this.character.add(glove);
      // Thumb
      const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.04, 4, 8), handMat);
      thumb.position.set(handX + side * -0.06, handY, handZ + 0.03);
      thumb.rotation.z = side * 0.5;
      this.character.add(thumb);
    }

    // --- Legs --- capsule-shaped, grouped for pedaling animation
    this.leftLeg = null;
    this.rightLeg = null;
    const isBike = this.currentVehicle === 'mountainBike';
    const isKayak = this.isWaterVehicle();
    const isBobsled = this.currentVehicle === 'bobsled';
    const isSeated = isKayak || isBobsled;
    const legSides: [number, THREE.Group | null][] = [];

    for (const side of [-0.15, 0.15]) {
      const legGroup = isBike ? (() => { const g = new THREE.Group(); g.userData = { animLeg: side < 0 ? 'left' : 'right' }; return g; })() : null;
      const parent = legGroup ?? this.character;

      // Thigh
      const legMat = isSummerLook ? skinMat : pantsMat;
      const footMat = isSummerLook ? skinMat : darkMat;
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.15, 6, 12), legMat);
      thigh.castShadow = true;
      // Shin
      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.12, 6, 12), legMat);
      shin.castShadow = true;
      // Boot
      const boot = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.1, 6, 12), footMat);
      boot.rotation.x = Math.PI / 2;
      boot.scale.set(1, 1.3, 0.8);
      // Boot sole
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.28), isSummerLook ? accentMat : darkMat);

      if (isBike) {
        thigh.position.set(0, -0.15, 0);
        shin.position.set(0, -0.42, 0.05);
        boot.position.set(0, -0.56, 0.1);
        sole.position.set(0, -0.62, 0.1);
        parent.add(thigh, shin, boot, sole);
        legGroup!.position.set(side, 0.5, 0.05);
        this.character.add(legGroup!);
      } else if (isSeated) {
        // Legs stretched forward inside cockpit
        thigh.position.set(side, 0.15, 0.25);
        thigh.rotation.x = -1.2;
        shin.position.set(side, 0.0, 0.55);
        shin.rotation.x = -1.4;
        boot.position.set(side, -0.05, 0.75);
        boot.rotation.x = 0;
        sole.position.set(side, -0.1, 0.75);
        this.character.add(thigh, shin, boot, sole);
      } else if (this.currentVehicle === 'snowboard') {
        // Snowboard stance — feet in bindings
        // Character rotated PI/2: char +X → vehicle -Z
        // Bindings at vehicle z=-0.15 and z=0.5 → char x=0.15 and x=-0.5
        const footX = side > 0 ? -0.5 : 0.15;
        // Hip stays near center, leg angles out to reach binding
        const hipX = side > 0 ? -0.12 : 0.08;

        const hipJoint = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), legMat);
        hipJoint.position.set(hipX, 0.45, 0.0);
        parent.add(hipJoint);

        thigh.position.set((hipX + footX) * 0.5, 0.30, 0.05);
        thigh.rotation.x = -0.5;
        thigh.rotation.z = (footX - hipX) * 0.4; // angle outward toward foot
        parent.add(thigh);

        const knee = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 6), legMat);
        knee.position.set((hipX + footX * 2) / 3, 0.10, 0.12);
        parent.add(knee);

        shin.position.set(footX * 0.85, -0.04, 0.10);
        shin.rotation.x = 0.4;
        shin.rotation.z = (footX - hipX) * 0.2;
        parent.add(shin);

        boot.position.set(footX, -0.16, 0.06);
        boot.scale.set(1.1, 1.5, 0.9);
        sole.position.set(footX, -0.22, 0.06);
        sole.scale.set(1.2, 1, 1.2);
        parent.add(boot, sole);
      } else {
        // Legs in deep tuck — wider stance over skis, knees well bent
        const legX = side * 1.67;

        // Hip joint sphere — connects leg to torso
        const hipJoint = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), legMat);
        hipJoint.position.set(legX, 0.45, 0.08);
        parent.add(hipJoint);

        thigh.position.set(legX, 0.30, 0.16);
        thigh.rotation.x = -0.7;
        parent.add(thigh);

        // Knee joint sphere
        const knee = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 6), legMat);
        knee.position.set(legX, 0.10, 0.28);
        parent.add(knee);

        shin.position.set(legX, -0.04, 0.24);
        shin.rotation.x = 0.6;
        parent.add(shin);

        boot.position.set(legX, -0.16, 0.18);
        boot.scale.set(1.1, 1.5, 0.9);
        sole.position.set(legX, -0.22, 0.18);
        sole.scale.set(1.2, 1, 1.2);
        parent.add(boot, sole);
      }
      legSides.push([side, legGroup]);
    }

    if (isBike) {
      this.leftLeg = legSides[0][1];
      this.rightLeg = legSides[1][1];
    }

    this.character.position.y = 0.15;

    // Snowboard stance: body sideways, head turned to face forward
    if (this.currentVehicle === 'snowboard') {
      this.character.rotation.y = Math.PI / 2;
    }

    // Seated vehicles: lower body, legs stretched forward
    if (this.isWaterVehicle()) {
      this.character.position.y = -0.25;
      this.character.rotation.x = -0.3;
    } else if (this.currentVehicle === 'bobsled') {
      this.character.position.y = -0.35;
      this.character.rotation.x = -0.2;
    } else if (this.currentVehicle === 'motorbike') {
      this.character.position.y = -0.15;
      this.character.position.z = -0.3;
      this.character.rotation.x = 0.3;
    } else if (this.currentVehicle === 'mountainBike') {
      this.character.rotation.x = 0.35;
    } else if (this.currentVehicle === 'jetski') {
      this.character.rotation.x = 0.25;
    }

    this.group.add(this.character);
  }

  ejectCrash(): { character: THREE.Group; vehicle: THREE.Group; startPos: THREE.Vector3 } {
    const startPos = this.group.position.clone();
    // Remove character from group but keep it in scene
    this.group.remove(this.character);
    // Spread limbs — scale arms/legs wider
    this.character.rotation.x = -0.3; // lean forward
    return { character: this.character, vehicle: this.vehicle, startPos };
  }

  bigLaunch() {
    this.isJumping = true;
    this.landSoundPlayed = false;
    this.jumpVelocity = this.jumpForce * 2.5;
    this.game.soundManager.playGrunt();
    // 20% chance of front flip
    if (Math.random() < 0.2) {
      this.backflipping = true;
      this.spinning = false;
      this.spinAngle = 0;
    }
  }

  setBlackHelmetVisible(visible: boolean) {
    if (this.blackHelmetGroup) {
      this.blackHelmetGroup.visible = visible;
    }
  }

  setMetalMode(active: boolean) {
    this.isMetalMode = active;
    const targetColor = new THREE.Color(active ? this.metalColor : this.outfitColor);
    const pantsColor = new THREE.Color(active ? 0x000000 : 0x1565c0);
    this.character.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        const hex = child.material.color.getHex();
        if (hex === this.outfitColor || hex === this.metalColor) {
          child.material.color.copy(targetColor);
        }
        if (hex === 0x1565c0 || hex === 0x000000) {
          child.material.color.copy(pantsColor);
        }
      }
    });
    // Also color the vehicle if it's a bobsled
    if (this.currentVehicle === 'bobsled') {
      this.setVehicleBlack(active);
    }
  }

  setVehicleColors(primary: number, secondary: number) {
    const bobsledRed = 0xe63946;
    const bobsledRail = 0xcc2233;
    this.vehicle.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        const hex = child.material.color.getHex();
        if (hex === bobsledRed) child.material.color.setHex(primary);
        if (hex === bobsledRail) child.material.color.setHex(secondary);
      }
    });
  }

  setVehicleBlack(black: boolean) {
    const bobsledRed = 0xe63946;
    const bobsledRail = 0xcc2233;
    this.vehicle.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        const hex = child.material.color.getHex();
        if (black) {
          if (hex === bobsledRed || hex === bobsledRail) {
            child.material.color.setHex(0x111111);
          }
        } else {
          if (hex === 0x111111) {
            // Can't distinguish which was red vs rail, but close enough
            child.material.color.setHex(bobsledRed);
          }
        }
      }
    });
  }

  reset() {
    this.isMetalMode = false;
    this.jumpMultiplier = 1;
    this.spinning = false;
    this.backflipping = false;
    this.doubleJumpReady = false;
    this.crankGroup = null;
    this.leftLeg = null;
    this.rightLeg = null;
    this.currentLane = 0;
    this.targetLane = 0;
    this.isJumping = false;
    this.isDucking = false;
    this.jumpVelocity = 0;
    this.groundY = 0.5;
    this.group.position.set(0, this.groundY, 0);
    this.group.rotation.set(0, 0, 0);
    // Remove all children (vehicle, character, and any extras like snowman hat)
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
    const season = this.game.seasonManager.season;
    const defaultVehicle = season === 'autumn' ? 'mountainBike'
      : season === 'spring' ? 'kayak'
      : season === 'summer' ? 'skis'
      : 'skis';
    this.currentVehicle = defaultVehicle;
    this.buildVehicle(defaultVehicle);
    this.buildCharacter();
  }

  handleInput(input: PlayerInput) {
    const inBobsled = this.currentVehicle === 'bobsled';
    const noJump = inBobsled || this.currentVehicle === 'canoe';

    if (input.left && this.targetLane < 1) {
      const nextLane = this.targetLane + 1;
      if (inBobsled) {
        // Bobsled can't move to a higher lane directly — must use ramp
        const currentH = this.game.laneHeightMap.getHeight(this.targetLane, 0);
        const nextH = this.game.laneHeightMap.getHeight(nextLane, 0);
        if (nextH <= currentH + 0.1) {
          this.targetLane = nextLane;
        }
      } else {
        this.targetLane = nextLane;
      }
    }
    if (input.right && this.targetLane > -1) {
      const nextLane = this.targetLane - 1;
      if (inBobsled) {
        const currentH = this.game.laneHeightMap.getHeight(this.targetLane, 0);
        const nextH = this.game.laneHeightMap.getHeight(nextLane, 0);
        if (nextH <= currentH + 0.1) {
          this.targetLane = nextLane;
        }
      } else {
        this.targetLane = nextLane;
      }
    }
    const canJump = !noJump || this.game.isSnowmobile;
    if (input.jump && !this.isJumping && canJump) {
      this.isJumping = true;
      this.landSoundPlayed = false;
      this.landingDipTimer = 0;
      // Ensure position is at or above ground so jump isn't immediately cancelled
      if (this.group.position.y < this.groundY) {
        this.group.position.y = this.groundY;
      }
      this.doubleJumpReady = input.doubleJump;
      const onRamp = this.game.laneHeightMap.isUpRamp(this.targetLane, 0);
      const isSpring = this.game.seasonManager.season === 'spring';
      const rampBoost = onRamp ? (isSpring ? 1.7 : 2) : 1;
      this.jumpVelocity = this.jumpForce * this.jumpMultiplier * rampBoost * (isSpring ? 0.85 : 1);
      this.isDucking = false;
      this.character.scale.copy(this.normalCharacterScale);
      this.game.soundManager.playGrunt();
      // 25% chance of 360 spin when on snowboard
      if (this.currentVehicle === 'snowboard' && Math.random() < 0.25) {
        this.spinning = true;
        this.spinAngle = 0;
      }
    }
    if (input.duck && !this.isJumping) {
      this.isDucking = true;
      this.duckTimer = this.duckDuration;
      this.character.scale.set(1, 0.5, 1);
      this.character.position.y = -0.1;
    }
  }

  update(dt: number) {
    // Smooth lane transition
    const targetX = this.targetLane * this.game.laneWidth;
    this.group.position.x += (targetX - this.group.position.x) * this.laneTransitionSpeed * dt;
    this.currentLane = this.targetLane;

    // Get ground height from lane height map + spring wave
    const laneHeight = this.game.laneHeightMap.getHeight(this.targetLane, 0);
    const waveOffset = this.game.trackManager.getSpringWaveOffset(this.targetLane);
    this.groundY = laneHeight + 0.5 + waveOffset;

    // Ramp launch — pop into the air after cresting an up ramp
    const onUpRamp = this.game.laneHeightMap.isUpRamp(this.targetLane, 0);
    const springDampen = this.game.seasonManager.season === 'spring' ? 0.75 : 1;
    if (this.wasOnUpRamp && !onUpRamp && !this.isJumping) {
      this.isJumping = true;
      this.landSoundPlayed = false;
      if (this.doubleJumpReady) {
        // Double-tap on ramp = super jump with trick
        this.jumpVelocity = this.rampLaunchForce * 2.0 * springDampen;
        this.doubleJumpReady = false;
        this.game.soundManager.playGrunt();
        const trick = Math.random();
        if (trick < 0.2) {
          // 20% chance: 360 spin (Y-axis)
          this.spinning = true;
          this.backflipping = false;
          this.spinAngle = 0;
        } else if (trick < 0.4) {
          // 20% chance: backflip (X-axis)
          this.backflipping = true;
          this.spinning = false;
          this.spinAngle = 0;
        }
      } else {
        this.jumpVelocity = this.rampLaunchForce * springDampen;
      }
    }
    this.wasOnUpRamp = onUpRamp;

    // Jump physics
    if (this.isJumping) {
      // Play land sound slightly early when about to hit ground
      const nextY = this.group.position.y + this.jumpVelocity * dt;
      if (this.jumpVelocity < 0 && !this.landSoundPlayed && nextY <= this.groundY + 0.3) {
        if (this.isWaterVehicle()) {
          this.game.soundManager.playSplash();
        } else {
          this.game.soundManager.playLand();
        }
        this.landSoundPlayed = true;
      }
      this.jumpVelocity += this.gravity * dt;
      this.group.position.y += this.jumpVelocity * dt;
      // Trick animations — rotate entire group so vehicle spins too
      if (this.spinning) {
        this.spinAngle += dt * 8;
        this.group.rotation.y = this.spinAngle;
        if (this.spinAngle >= Math.PI * 2) {
          this.spinning = false;
          this.group.rotation.y = 0;
        }
      }
      if (this.backflipping) {
        this.spinAngle += dt * 8;
        this.group.rotation.x = -this.spinAngle;
        if (this.spinAngle >= Math.PI * 2) {
          this.backflipping = false;
          this.group.rotation.x = 0;
        }
      }

      if (this.group.position.y <= this.groundY) {
        const fallSpeed = Math.abs(this.jumpVelocity);
        this.group.position.y = this.groundY;
        this.isJumping = false;
        this.isOnWaterfallDrop = false;
        this.jumpVelocity = 0;
        this.spinning = false;
        this.backflipping = false;
        this.group.rotation.x = 0;
        this.group.rotation.y = 0;
        // Landing dip for water vehicles — scales with fall speed
        const inWater = this.isWaterVehicle();
        if (inWater) {
          const bigDrop = fallSpeed > 10;
          this.landingDipDuration = bigDrop ? 1.4 : 0.8;
          this.landingDipTimer = this.landingDipDuration;
          this.landingDipDepth = bigDrop ? 2.5 : Math.min(fallSpeed * 0.04, 1.2);
          this.landingDipDepth = Math.max(this.landingDipDepth, 0.15);
        }
      }
    } else {
      // Snap/lerp to ground height (handles ramps and dropping from high to low lane)
      const targetY = this.groundY;
      if (this.group.position.y > targetY + 0.1) {
        const dropAmount = this.group.position.y - targetY;
        this.isJumping = true;
        this.landSoundPlayed = false;
        this.jumpVelocity = dropAmount > 2 ? -8 : 0;
        if (dropAmount > 2) this.game.soundManager.playSplash();
      } else {
        this.group.position.y = targetY;
      }
    }

    // Duck timer
    if (this.isDucking) {
      this.duckTimer -= dt;
      if (this.duckTimer <= 0) {
        this.isDucking = false;
        this.character.scale.copy(this.normalCharacterScale);
        this.character.position.y = 0.15;
      }
    }

    // Animate kayak paddle — alternating side-to-side stroke
    if (this.paddleGroup && !this.isJumping) {
      const paddleSpeed = 3;
      const t = Date.now() * 0.001 * paddleSpeed;
      // Rock side to side
      this.paddleGroup.rotation.z = Math.sin(t) * 0.5;
      // Dip the paddle on each side
      this.paddleGroup.rotation.x = Math.sin(t * 2) * 0.15;
      this.paddleGroup.position.y = 0.3 + Math.sin(t) * 0.05;
    }

    // Animate mountain bike pedals and legs
    if (this.crankGroup && !this.isJumping) {
      this.crankGroup.rotation.x += dt * this.game.speed * 0.3;
      const pedalAngle = this.crankGroup.rotation.x;
      if (this.leftLeg) {
        this.leftLeg.rotation.x = Math.sin(pedalAngle) * 0.6;
      }
      if (this.rightLeg) {
        this.rightLeg.rotation.x = Math.sin(pedalAngle + Math.PI) * 0.6;
      }
    }

    // Bobbing motion
    const inWaterVehicle = this.isWaterVehicle();
    if (inWaterVehicle && !this.isJumping) {
      // Constant water bobbing
      const bob = Math.sin(Date.now() * 0.005) * 0.1;
      const tilt = Math.sin(Date.now() * 0.004 + 1) * 0.03;
      // Landing dip — submerge then pop up above water
      let dip = 0;
      if (this.landingDipTimer > 0) {
        this.landingDipTimer -= dt;
        const t = 1 - this.landingDipTimer / this.landingDipDuration; // 0→1
        if (t < 0.4) {
          // Plunge down
          dip = -Math.sin(t / 0.4 * Math.PI / 2) * this.landingDipDepth;
        } else if (t < 0.7) {
          // Rise back up and pop above surface
          const rise = (t - 0.4) / 0.3; // 0→1
          dip = -this.landingDipDepth + (this.landingDipDepth + this.landingDipDepth * 0.35) * rise;
        } else {
          // Settle back to surface
          const settle = (t - 0.7) / 0.3; // 0→1
          dip = this.landingDipDepth * 0.35 * (1 - settle);
        }
      }
      this.group.position.y = this.groundY + bob + dip;
      this.group.rotation.z = tilt;
    } else if (!this.isJumping && !this.isDucking) {
      const bob = Math.sin(Date.now() * 0.008) * 0.03;
      this.character.position.y = 0.15 + bob;
    }
  }

  getCollisionBox(): THREE.Box3 {
    const pos = this.group.position;
    const halfW = 0.5;
    const height = this.isDucking ? 0.7 : 1.5;
    const halfD = 0.6;
    return new THREE.Box3(
      new THREE.Vector3(pos.x - halfW, pos.y - 0.2, pos.z - halfD),
      new THREE.Vector3(pos.x + halfW, pos.y + height, pos.z + halfD)
    );
  }
}
