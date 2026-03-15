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
  private spinning = false;
  private spinAngle = 0;

  // Ramp launch
  private landSoundPlayed = false;
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
  currentVehicle: 'bobsled' | 'skis' | 'snowboard' | 'rainbowSkis' = 'skis';
  private isMetalMode = false;
  private readonly outfitColor = 0x2196f3;
  private readonly metalColor = 0x111111;

  constructor(game: Game) {
    this.game = game;
    this.group = new THREE.Group();
    this.buildVehicle('skis');
    this.buildCharacter();
    this.group.position.set(0, this.groundY, 0);
    game.scene.add(this.group);
  }

  switchVehicle(type: 'bobsled' | 'skis' | 'snowboard' | 'rainbowSkis') {
    if (this.currentVehicle === type) return;
    this.currentVehicle = type;
    // Remove old vehicle and character, rebuild
    this.group.remove(this.vehicle);
    this.group.remove(this.character);
    this.buildVehicle(type);
    this.buildCharacter();
  }

  private buildVehicle(type: 'bobsled' | 'skis' | 'snowboard' | 'rainbowSkis') {
    this.vehicle = new THREE.Group();

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

  private buildCharacter() {
    this.character = new THREE.Group();
    const skinColor = 0xf4c7a1;
    const hairColor = 0x6b3a2a;
    const outfitColor = 0x2196f3; // blue winter outfit

    // Body (torso)
    const torsoGeo = new THREE.BoxGeometry(0.7, 0.8, 0.5);
    const torsoMat = new THREE.MeshStandardMaterial({ color: outfitColor });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 0.8;
    torso.castShadow = true;
    this.character.add(torso);

    // Head group — counter-rotated on snowboard so she looks forward
    const headGroup = new THREE.Group();

    const headGeo = new THREE.SphereGeometry(0.28, 12, 10);
    const headMat = new THREE.MeshStandardMaterial({ color: skinColor });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.42;
    head.castShadow = true;
    headGroup.add(head);

    // Hair (cap/helmet shape covering top of head)
    const hairGeo = new THREE.SphereGeometry(0.30, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6);
    const hairMat = new THREE.MeshStandardMaterial({ color: hairColor });
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.y = 1.44;
    headGroup.add(hair);

    // Ponytail - a series of small spheres trailing back
    const ptMat = new THREE.MeshStandardMaterial({ color: hairColor });
    for (let i = 0; i < 5; i++) {
      const size = 0.12 - i * 0.012;
      const ptGeo = new THREE.SphereGeometry(size, 8, 6);
      const pt = new THREE.Mesh(ptGeo, ptMat);
      pt.position.set(0, 1.35 - i * 0.1, -0.25 - i * 0.12);
      headGroup.add(pt);
    }

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.04, 6, 6);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    for (const side of [-0.1, 0.1]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(side, 1.45, 0.25);
      headGroup.add(eye);
    }

    // Goggles strap
    const goggleStrapGeo = new THREE.TorusGeometry(0.13, 0.02, 6, 12);
    const goggleMat = new THREE.MeshStandardMaterial({ color: 0xff9800 });
    for (const side of [-0.1, 0.1]) {
      const goggle = new THREE.Mesh(goggleStrapGeo, goggleMat);
      goggle.position.set(side, 1.48, 0.22);
      headGroup.add(goggle);
    }

    // On snowboard, body is rotated 90°, so counter-rotate head to look forward
    if (this.currentVehicle === 'snowboard') {
      headGroup.rotation.y = -Math.PI / 2;
    }

    this.character.add(headGroup);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    const armMat = new THREE.MeshStandardMaterial({ color: outfitColor });
    for (const side of [-0.45, 0.45]) {
      const arm = new THREE.Mesh(armGeo, armMat);
      arm.position.set(side, 0.7, 0.1);
      arm.rotation.x = -0.3;
      arm.castShadow = true;
      this.character.add(arm);
    }

    // Gloves
    const gloveGeo = new THREE.SphereGeometry(0.1, 8, 6);
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    for (const side of [-0.45, 0.45]) {
      const glove = new THREE.Mesh(gloveGeo, gloveMat);
      glove.position.set(side, 0.42, 0.2);
      this.character.add(glove);
    }

    // Legs
    const legGeo = new THREE.BoxGeometry(0.25, 0.5, 0.25);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1565c0 }); // darker blue pants
    for (const side of [-0.18, 0.18]) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(side, 0.25, 0.1);
      leg.rotation.x = -0.2;
      leg.castShadow = true;
      this.character.add(leg);
    }

    // Boots
    const bootGeo = new THREE.BoxGeometry(0.26, 0.15, 0.35);
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    for (const side of [-0.18, 0.18]) {
      const boot = new THREE.Mesh(bootGeo, bootMat);
      boot.position.set(side, 0.04, 0.18);
      this.character.add(boot);
    }

    this.character.position.y = 0.15;

    // Snowboard stance: body sideways, head turned to face forward
    if (this.currentVehicle === 'snowboard') {
      this.character.rotation.y = Math.PI / 2;
    }

    this.group.add(this.character);
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
    this.group.rotation.y = 0;
    this.currentLane = 0;
    this.targetLane = 0;
    this.isJumping = false;
    this.isDucking = false;
    this.jumpVelocity = 0;
    this.groundY = 0.5;
    this.group.position.set(0, this.groundY, 0);
    this.character.scale.copy(this.normalCharacterScale);
    if (this.currentVehicle !== 'skis') {
      this.switchVehicle('skis');
    }
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
      this.jumpVelocity = this.jumpForce * this.jumpMultiplier;
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
      this.jumpVelocity = this.rampLaunchForce;
    }
    this.wasOnUpRamp = onUpRamp;

    // Jump physics
    if (this.isJumping) {
      // Play land sound slightly early when about to hit ground
      const nextY = this.group.position.y + this.jumpVelocity * dt;
      if (this.jumpVelocity < 0 && !this.landSoundPlayed && nextY <= this.groundY + 0.3) {
        this.game.soundManager.playLand();
        this.landSoundPlayed = true;
      }
      this.jumpVelocity += this.gravity * dt;
      this.group.position.y += this.jumpVelocity * dt;
      // 360 spin animation
      if (this.spinning) {
        this.spinAngle += dt * 8;
        this.group.rotation.y = this.spinAngle;
        if (this.spinAngle >= Math.PI * 2) {
          this.spinning = false;
          this.group.rotation.y = 0;
        }
      }

      if (this.group.position.y <= this.groundY) {
        this.group.position.y = this.groundY;
        this.isJumping = false;
        this.jumpVelocity = 0;
        this.spinning = false;
        this.group.rotation.y = 0;
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

    // Gentle bobbing motion while sliding
    if (!this.isJumping && !this.isDucking) {
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
