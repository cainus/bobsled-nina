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
  private isJumping = false;
  private jumpVelocity = 0;
  private readonly jumpForce = 12;
  private readonly gravity = -30;
  private groundY = 0.5;

  // Duck
  private isDucking = false;
  private duckTimer = 0;
  private readonly duckDuration = 0.6;

  // Bobsled + character meshes
  private bobsled!: THREE.Group;
  private character!: THREE.Group;
  private normalCharacterScale = new THREE.Vector3(1, 1, 1);

  constructor(game: Game) {
    this.game = game;
    this.group = new THREE.Group();
    this.buildBobsled();
    this.buildCharacter();
    this.group.position.set(0, this.groundY, 0);
    game.scene.add(this.group);
  }

  private buildBobsled() {
    this.bobsled = new THREE.Group();

    // Sled body - sleek shape
    const bodyGeo = new THREE.BoxGeometry(1.6, 0.4, 2.8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe63946 }); // red sled
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0;
    body.castShadow = true;
    this.bobsled.add(body);

    // Front curved part
    const frontGeo = new THREE.CylinderGeometry(0.3, 0.8, 0.5, 8, 1, false, 0, Math.PI);
    const frontMat = new THREE.MeshStandardMaterial({ color: 0xe63946 });
    const front = new THREE.Mesh(frontGeo, frontMat);
    front.rotation.x = Math.PI / 2;
    front.rotation.z = Math.PI;
    front.position.set(0, 0.1, 1.55);
    this.bobsled.add(front);

    // Runners (metal blades underneath)
    const runnerGeo = new THREE.BoxGeometry(0.1, 0.15, 3.0);
    const runnerMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.2 });
    for (const side of [-0.7, 0.7]) {
      const runner = new THREE.Mesh(runnerGeo, runnerMat);
      runner.position.set(side, -0.25, 0);
      this.bobsled.add(runner);
    }

    // Side rails
    const railGeo = new THREE.BoxGeometry(0.12, 0.35, 2.4);
    const railMat = new THREE.MeshStandardMaterial({ color: 0xcc2233 });
    for (const side of [-0.75, 0.75]) {
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(side, 0.3, -0.1);
      this.bobsled.add(rail);
    }

    this.bobsled.position.y = -0.1;
    this.group.add(this.bobsled);
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

    // Head
    const headGeo = new THREE.SphereGeometry(0.28, 12, 10);
    const headMat = new THREE.MeshStandardMaterial({ color: skinColor });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.42;
    head.castShadow = true;
    this.character.add(head);

    // Hair (cap/helmet shape covering top of head)
    const hairGeo = new THREE.SphereGeometry(0.30, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6);
    const hairMat = new THREE.MeshStandardMaterial({ color: hairColor });
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.y = 1.44;
    this.character.add(hair);

    // Ponytail - a series of small spheres trailing back
    const ponytailGroup = new THREE.Group();
    const ptMat = new THREE.MeshStandardMaterial({ color: hairColor });
    for (let i = 0; i < 5; i++) {
      const size = 0.12 - i * 0.012;
      const ptGeo = new THREE.SphereGeometry(size, 8, 6);
      const pt = new THREE.Mesh(ptGeo, ptMat);
      pt.position.set(0, 1.35 - i * 0.1, -0.25 - i * 0.12);
      this.character.add(pt);
    }
    this.character.add(ponytailGroup);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.04, 6, 6);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    for (const side of [-0.1, 0.1]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(side, 1.45, 0.25);
      this.character.add(eye);
    }

    // Goggles strap
    const goggleStrapGeo = new THREE.TorusGeometry(0.13, 0.02, 6, 12);
    const goggleMat = new THREE.MeshStandardMaterial({ color: 0xff9800 });
    for (const side of [-0.1, 0.1]) {
      const goggle = new THREE.Mesh(goggleStrapGeo, goggleMat);
      goggle.position.set(side, 1.48, 0.22);
      this.character.add(goggle);
    }

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
    this.group.add(this.character);
  }

  reset() {
    this.currentLane = 0;
    this.targetLane = 0;
    this.isJumping = false;
    this.isDucking = false;
    this.jumpVelocity = 0;
    this.group.position.set(0, this.groundY, 0);
    this.character.scale.copy(this.normalCharacterScale);
  }

  handleInput(input: PlayerInput) {
    if (input.left && this.targetLane < 1) {
      this.targetLane++;
    }
    if (input.right && this.targetLane > -1) {
      this.targetLane--;
    }
    if (input.jump && !this.isJumping) {
      this.isJumping = true;
      this.jumpVelocity = this.jumpForce;
      this.isDucking = false;
      this.character.scale.copy(this.normalCharacterScale);
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

    // Jump physics
    if (this.isJumping) {
      this.jumpVelocity += this.gravity * dt;
      this.group.position.y += this.jumpVelocity * dt;
      if (this.group.position.y <= this.groundY) {
        this.group.position.y = this.groundY;
        this.isJumping = false;
        this.jumpVelocity = 0;
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
