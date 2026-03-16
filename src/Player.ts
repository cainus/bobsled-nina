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
  private jumpVelocity = 0;
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
  private wasOnUpRamp = false;
  private readonly rampLaunchForce = 8;

  // Duck
  private isDucking = false;
  private duckTimer = 0;
  private readonly duckDuration = 0.6;

  // Vehicle + character meshes
  private vehicle!: THREE.Group;
  private character!: THREE.Group;
  private normalCharacterScale = new THREE.Vector3(1, 1, 1);
  currentVehicle: 'bobsled' | 'skis' | 'snowboard' | 'rainbowSkis' | 'mountainBike' | 'motorbike' | 'kayak' | 'jetski' | 'rainbowKayak' | 'canoe' = 'skis';
  private isMetalMode = false;
  private readonly outfitColor = 0x2196f3;
  private readonly metalColor = 0x111111;
  private crankGroup: THREE.Group | null = null;
  private leftLeg: THREE.Group | null = null;
  private rightLeg: THREE.Group | null = null;

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
    // Sled body - sleek shape
    const bodyGeo = new THREE.BoxGeometry(1.6, 0.4, 2.8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe63946 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0;
    body.castShadow = true;
    this.vehicle.add(body);

    // Front curved part
    const frontGeo = new THREE.CylinderGeometry(0.3, 0.8, 0.5, 8, 1, false, 0, Math.PI);
    const frontMat = new THREE.MeshStandardMaterial({ color: 0xe63946 });
    const front = new THREE.Mesh(frontGeo, frontMat);
    front.rotation.x = Math.PI / 2;
    front.rotation.z = Math.PI;
    front.position.set(0, 0.1, 1.55);
    this.vehicle.add(front);

    // Runners (metal blades underneath)
    const runnerGeo = new THREE.BoxGeometry(0.1, 0.15, 3.0);
    const runnerMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.2 });
    for (const side of [-0.7, 0.7]) {
      const runner = new THREE.Mesh(runnerGeo, runnerMat);
      runner.position.set(side, -0.25, 0);
      this.vehicle.add(runner);
    }

    // Side rails
    const railGeo = new THREE.BoxGeometry(0.12, 0.35, 2.4);
    const railMat = new THREE.MeshStandardMaterial({ color: 0xcc2233 });
    for (const side of [-0.75, 0.75]) {
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(side, 0.3, -0.1);
      this.vehicle.add(rail);
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

      // Ski tip - curved front
      const tipGeo = new THREE.CylinderGeometry(0.02, 0.09, 0.3, 6, 1, false, 0, Math.PI);
      const tip = new THREE.Mesh(tipGeo, skiMat);
      tip.rotation.x = Math.PI / 2;
      tip.rotation.z = Math.PI;
      tip.position.set(side, 0.02, 1.5);
      this.vehicle.add(tip);

      // Binding
      const bindingGeo = new THREE.BoxGeometry(0.2, 0.1, 0.25);
      const binding = new THREE.Mesh(bindingGeo, metalMat);
      binding.position.set(side, 0.03, 0);
      this.vehicle.add(binding);
    }

    // Ski poles
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const basketMat = new THREE.MeshStandardMaterial({ color: 0xff4444 });
    for (const side of [-0.55, 0.55]) {
      // Pole shaft
      const poleGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.8, 6);
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(side, 0.7, -0.3);
      pole.rotation.x = -0.25;
      pole.castShadow = true;
      this.vehicle.add(pole);

      // Pole handle/grip
      const gripGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.15, 6);
      const grip = new THREE.Mesh(gripGeo, new THREE.MeshStandardMaterial({ color: 0x222222 }));
      grip.position.set(side, 1.55, -0.5);
      grip.rotation.x = -0.25;
      this.vehicle.add(grip);

      // Pole basket (small disc near bottom)
      const basketGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.02, 8);
      const basket = new THREE.Mesh(basketGeo, basketMat);
      basket.position.set(side, 0.05, -0.15);
      this.vehicle.add(basket);
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

      // Ski tip - gold
      const tipGeo = new THREE.CylinderGeometry(0.02, 0.09, 0.3, 6, 1, false, 0, Math.PI);
      const tipMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.6, roughness: 0.2 });
      const tip = new THREE.Mesh(tipGeo, tipMat);
      tip.rotation.x = Math.PI / 2;
      tip.rotation.z = Math.PI;
      tip.position.set(side, 0.02, 1.5);
      this.vehicle.add(tip);

      // Binding
      const bindingGeo = new THREE.BoxGeometry(0.2, 0.1, 0.25);
      const binding = new THREE.Mesh(bindingGeo, metalMat);
      binding.position.set(side, 0.03, 0);
      this.vehicle.add(binding);
    }

    // Gold ski poles
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.6, roughness: 0.2 });
    const basketMat = new THREE.MeshStandardMaterial({ color: 0xff00ff });
    for (const side of [-0.55, 0.55]) {
      const poleGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.8, 6);
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(side, 0.7, -0.3);
      pole.rotation.x = -0.25;
      pole.castShadow = true;
      this.vehicle.add(pole);

      const gripGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.15, 6);
      const grip = new THREE.Mesh(gripGeo, new THREE.MeshStandardMaterial({ color: 0x222222 }));
      grip.position.set(side, 1.55, -0.5);
      grip.rotation.x = -0.25;
      this.vehicle.add(grip);

      const basketGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.02, 8);
      const basket = new THREE.Mesh(basketGeo, basketMat);
      basket.position.set(side, 0.05, -0.15);
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

    // Nose - rounded front
    const noseGeo = new THREE.CylinderGeometry(0.04, 0.35, 0.3, 8, 1, false, 0, Math.PI);
    const nose = new THREE.Mesh(noseGeo, boardMat);
    nose.rotation.x = Math.PI / 2;
    nose.rotation.z = Math.PI;
    nose.position.set(0, 0.0, 1.45);
    this.vehicle.add(nose);

    // Tail - slight uptick
    const tailGeo = new THREE.CylinderGeometry(0.04, 0.35, 0.25, 8, 1, false, 0, Math.PI);
    const tail = new THREE.Mesh(tailGeo, boardMat);
    tail.rotation.x = -Math.PI / 2;
    tail.position.set(0, 0.0, -1.0);
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

    // Paddle — shaft stored across the front deck
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 1.6, 6),
      paddleMat
    );
    shaft.position.set(0, 0.22, 0.6);
    shaft.rotation.z = Math.PI / 2;
    this.vehicle.add(shaft);

    // Paddle blades on each end
    for (const side of [-0.8, 0.8]) {
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.02, 0.3),
        bladeMat
      );
      blade.position.set(side, 0.22, 0.6);
      blade.rotation.y = side > 0 ? 0.3 : -0.3;
      this.vehicle.add(blade);
    }

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

    // Bow point — gold
    const bowMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.6, roughness: 0.2 });
    const bow = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 8), bowMat);
    bow.rotation.x = -Math.PI / 2;
    bow.position.set(0, -0.02, 1.7);
    this.vehicle.add(bow);
    // Stern point
    const stern = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.4, 8), bowMat);
    stern.rotation.x = Math.PI / 2;
    stern.position.set(0, -0.02, -1.3);
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

    // Gold paddle
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.6 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 6), shaftMat);
    shaft.position.set(0, 0.22, 0.6);
    shaft.rotation.z = Math.PI / 2;
    this.vehicle.add(shaft);
    for (const side of [-0.8, 0.8]) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.3), bowMat);
      blade.position.set(side, 0.22, 0.6);
      blade.rotation.y = side > 0 ? 0.3 : -0.3;
      this.vehicle.add(blade);
    }
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
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf4c7a1, roughness: 0.8 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x6b3a2a, roughness: 0.9 });
    const outfitMat = new THREE.MeshStandardMaterial({ color: this.outfitColor });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1565c0 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x333333 });

    // --- Torso --- rounded capsule shape
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.35, 8, 16), outfitMat);
    torso.position.y = 0.8;
    torso.castShadow = true;
    this.character.add(torso);

    // Jacket collar / zip detail
    const zipMat = new THREE.MeshStandardMaterial({ color: 0x1976d2 });
    const zip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.02), zipMat);
    zip.position.set(0, 0.8, 0.28);
    this.character.add(zip);

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
      const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), eyeWhiteMat);
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

    // Helmet — black ski helmet, open face
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.2 });
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.45),
      helmetMat
    );
    helmet.position.y = 1.46;
    headGroup.add(helmet);

    // Helmet side coverage — ear guards
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 });
    for (const side of [-1, 1]) {
      const earGuard = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 6, 0, Math.PI, 0, Math.PI * 0.5),
        rimMat
      );
      earGuard.position.set(side * 0.28, 1.38, 0);
      earGuard.rotation.z = side * -0.3;
      headGroup.add(earGuard);
    }

    // Helmet rim
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.02, 8, 20), rimMat);
    rim.position.set(0, 1.39, 0);
    rim.rotation.x = Math.PI / 2;
    headGroup.add(rim);

    // Vent slots on top
    const ventMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
    for (let i = -1; i <= 1; i++) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.01, 0.12), ventMat);
      vent.position.set(i * 0.08, 1.72, 0);
      headGroup.add(vent);
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
    this.character.add(headGroup);

    // --- Arms --- connected at shoulders, hands on ski poles
    const hasSkiPoles = this.currentVehicle === 'skis' || this.currentVehicle === 'rainbowSkis';
    // Pole grips are at vehicle (±0.55, 1.55, -0.5) with vehicle.y=-0.1, char.y=0.15
    // So in character space: (±0.55, 1.30, -0.5)
    const handY = hasSkiPoles ? 1.20 : 0.40;
    const handZ = hasSkiPoles ? -0.38 : 0.24;

    for (const side of [-1, 1]) {
      const sx = side * 0.3;
      const handX = hasSkiPoles ? side * 0.52 : side * 0.42;

      // Shoulder joint
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), outfitMat);
      shoulder.position.set(sx, 0.95, 0.02);
      shoulder.castShadow = true;
      this.character.add(shoulder);

      // Upper arm — angled toward hand position
      const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.18, 6, 12), outfitMat);
      if (hasSkiPoles) {
        upperArm.position.set(side * 0.38, 1.0, -0.12);
        upperArm.rotation.x = 0.3;
        upperArm.rotation.z = side * -0.25;
      } else {
        upperArm.position.set(side * 0.38, 0.78, 0.06);
        upperArm.rotation.x = -0.3;
        upperArm.rotation.z = side * -0.2;
      }
      upperArm.castShadow = true;
      this.character.add(upperArm);

      // Forearm
      const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.16, 6, 12), outfitMat);
      if (hasSkiPoles) {
        forearm.position.set(side * 0.46, 1.15, -0.28);
        forearm.rotation.x = 0.6;
      } else {
        forearm.position.set(side * 0.42, 0.56, 0.16);
        forearm.rotation.x = -0.5;
      }
      forearm.castShadow = true;
      this.character.add(forearm);

      // Glove — at grip position
      const glove = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), darkMat);
      glove.position.set(handX, handY, handZ);
      this.character.add(glove);
      // Thumb
      const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.04, 4, 8), darkMat);
      thumb.position.set(handX + side * -0.06, handY, handZ + 0.03);
      thumb.rotation.z = side * 0.5;
      this.character.add(thumb);
    }

    // --- Legs --- capsule-shaped, grouped for pedaling animation
    this.leftLeg = null;
    this.rightLeg = null;
    const isBike = this.currentVehicle === 'mountainBike';
    const isKayak = this.currentVehicle === 'kayak' || this.currentVehicle === 'rainbowKayak' || this.currentVehicle === 'canoe';
    const legSides: [number, THREE.Group | null][] = [];

    for (const side of [-0.15, 0.15]) {
      const legGroup = isBike ? new THREE.Group() : null;
      const parent = legGroup ?? this.character;

      // Thigh
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.15, 6, 12), pantsMat);
      thigh.castShadow = true;
      // Shin
      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.12, 6, 12), pantsMat);
      shin.castShadow = true;
      // Boot
      const boot = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.1, 6, 12), darkMat);
      boot.rotation.x = Math.PI / 2;
      boot.scale.set(1, 1.3, 0.8);
      // Boot sole
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.28), darkMat);

      if (isBike) {
        thigh.position.set(0, -0.15, 0);
        shin.position.set(0, -0.38, 0.05);
        boot.position.set(0, -0.48, 0.1);
        sole.position.set(0, -0.54, 0.1);
        parent.add(thigh, shin, boot, sole);
        legGroup!.position.set(side, 0.5, 0.05);
        this.character.add(legGroup!);
      } else if (isKayak) {
        // Legs stretched forward inside kayak cockpit
        thigh.position.set(side, 0.15, 0.25);
        thigh.rotation.x = -1.2; // angled forward
        shin.position.set(side, 0.0, 0.55);
        shin.rotation.x = -1.4;
        boot.position.set(side, -0.05, 0.75);
        boot.rotation.x = 0;
        sole.position.set(side, -0.1, 0.75);
        this.character.add(thigh, shin, boot, sole);
      } else {
        thigh.position.set(side, 0.35, 0.05);
        thigh.rotation.x = -0.15;
        shin.position.set(side, 0.12, 0.1);
        shin.rotation.x = -0.1;
        boot.position.set(side, 0.02, 0.16);
        sole.position.set(side, -0.04, 0.16);
        parent.add(thigh, shin, boot, sole);
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

    // Kayak/canoe seated position: lower body, legs stretched forward
    if (this.currentVehicle === 'kayak' || this.currentVehicle === 'rainbowKayak' || this.currentVehicle === 'canoe') {
      this.character.position.y = -0.25;
      this.character.rotation.x = -0.3; // lean back slightly
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

  waterfallDrop() {
    this.isJumping = true;
    this.landSoundPlayed = false;
    // Strong downward velocity — feels like dropping off a cliff
    this.jumpVelocity = -15;
    this.game.soundManager.playSplash();
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
      : season === 'summer' ? 'jetski'
      : 'skis';
    this.currentVehicle = defaultVehicle;
    this.buildVehicle(defaultVehicle);
    this.buildCharacter();
  }

  handleInput(input: PlayerInput) {
    const inBobsled = this.currentVehicle === 'bobsled';

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
    const canJump = !inBobsled || this.game.isSnowmobile;
    if (input.jump && !this.isJumping && canJump) {
      this.isJumping = true;
      this.landSoundPlayed = false;
      this.doubleJumpReady = input.doubleJump;
      const onRamp = this.game.laneHeightMap.isUpRamp(this.targetLane, 0);
      const rampBoost = onRamp ? 2 : 1;
      this.jumpVelocity = this.jumpForce * this.jumpMultiplier * rampBoost;
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

    // Get ground height from lane height map
    const laneHeight = this.game.laneHeightMap.getHeight(this.targetLane, 0);
    this.groundY = laneHeight + 0.5;

    // Ramp launch — pop into the air after cresting an up ramp
    const onUpRamp = this.game.laneHeightMap.isUpRamp(this.targetLane, 0);
    if (this.wasOnUpRamp && !onUpRamp && !this.isJumping) {
      this.isJumping = true;
      this.landSoundPlayed = false;
      if (this.doubleJumpReady) {
        // Double-tap on ramp = super jump with trick
        this.jumpVelocity = this.rampLaunchForce * 2.0;
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
        this.jumpVelocity = this.rampLaunchForce;
      }
    }
    this.wasOnUpRamp = onUpRamp;

    // Jump physics
    if (this.isJumping) {
      // Play land sound slightly early when about to hit ground
      const nextY = this.group.position.y + this.jumpVelocity * dt;
      if (this.jumpVelocity < 0 && !this.landSoundPlayed && nextY <= this.groundY + 0.3) {
        if (this.currentVehicle === 'kayak' || this.currentVehicle === 'rainbowKayak' || this.currentVehicle === 'canoe') {
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
        this.jumpVelocity = 0;
        this.spinning = false;
        this.backflipping = false;
        this.group.rotation.x = 0;
        this.group.rotation.y = 0;
        // Landing dip for water vehicles — scales with fall speed
        const inWater = this.currentVehicle === 'kayak' || this.currentVehicle === 'rainbowKayak' || this.currentVehicle === 'canoe';
        if (inWater) {
          this.landingDipTimer = 0.8;
          this.landingDipDepth = Math.min(fallSpeed * 0.04, 1.2);
          this.landingDipDepth = Math.max(this.landingDipDepth, 0.15);
        }
      }
    } else {
      // Snap/lerp to ground height (handles ramps and dropping from high to low lane)
      const targetY = this.groundY;
      if (this.group.position.y > targetY + 0.1) {
        // Falling from a higher lane — apply gravity
        this.isJumping = true;
        this.landSoundPlayed = false;
        this.jumpVelocity = 0;
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
    const inWaterVehicle = this.currentVehicle === 'kayak' || this.currentVehicle === 'rainbowKayak' || this.currentVehicle === 'canoe';
    if (inWaterVehicle && !this.isJumping) {
      // Constant water bobbing
      const bob = Math.sin(Date.now() * 0.005) * 0.1;
      const tilt = Math.sin(Date.now() * 0.004 + 1) * 0.03;
      // Landing dip
      let dip = 0;
      if (this.landingDipTimer > 0) {
        this.landingDipTimer -= dt;
        dip = -Math.sin(this.landingDipTimer / 0.8 * Math.PI) * this.landingDipDepth;
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
