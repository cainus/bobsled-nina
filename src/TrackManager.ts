import * as THREE from 'three';
import type { Game } from './Game';

const CHUNK_LENGTH = 40;
const VISIBLE_AHEAD = 160;

// Possible lane heights
const HEIGHTS = [0, 1.5, 3];
const RAMP_LENGTH = 6;

export class TrackManager {
  game: Game;
  private chunks: THREE.Group[] = [];
  private nextChunkZ = 0;

  // Current height of each lane at the far end of the last chunk (carry forward)
  private laneEndHeights: [number, number, number] = [0, 0, 0];

  // Shared materials
  private wallMat: THREE.MeshStandardMaterial;
  private snowMat: THREE.MeshStandardMaterial;
  private rampMat: THREE.MeshStandardMaterial;
  private laneColors: number[];
  private dividerMat: THREE.MeshStandardMaterial;

  constructor(game: Game) {
    this.game = game;

    this.wallMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee });
    this.snowMat = new THREE.MeshStandardMaterial({ color: 0xfafafa });
    this.rampMat = new THREE.MeshStandardMaterial({
      color: 0xaaddee,
      metalness: 0.2,
      roughness: 0.3,
    });
    this.laneColors = [0xc2dff0, 0xd6eef8, 0xc2dff0];
    this.dividerMat = new THREE.MeshStandardMaterial({ color: 0x5599cc });

    this.spawnInitialChunks();
  }

  private spawnInitialChunks() {
    this.nextChunkZ = -CHUNK_LENGTH;
    this.laneEndHeights = [0, 0, 0];
    while (this.nextChunkZ < VISIBLE_AHEAD) {
      this.addChunk();
    }
  }

  private addChunk() {
    const chunk = new THREE.Group();
    chunk.position.z = this.nextChunkZ;

    const laneW = this.game.laneWidth;
    const trackWidth = laneW * 3 + 2;

    // Decide target heights for each lane in this chunk
    // First chunk stays flat to give player time
    const isFlatChunk = this.nextChunkZ < 40;
    const startHeights: [number, number, number] = [...this.laneEndHeights];
    const endHeights: [number, number, number] = [...this.laneEndHeights];

    if (!isFlatChunk) {
      for (let i = 0; i < 3; i++) {
        if (Math.random() < 0.55) {
          // Pick a new height different from current
          const candidates = HEIGHTS.filter(h => h !== startHeights[i]);
          endHeights[i] = candidates[Math.floor(Math.random() * candidates.length)];
        }
      }
    }

    // Build each lane
    for (let li = 0; li < 3; li++) {
      const laneIndex = li - 1; // -1, 0, 1
      const laneX = laneIndex * laneW;
      const sY = startHeights[li];
      const eY = endHeights[li];

      const laneMat = new THREE.MeshStandardMaterial({
        color: this.laneColors[li],
        metalness: 0.3,
        roughness: 0.2,
      });

      if (sY === eY) {
        // Flat lane at constant height
        const geo = new THREE.PlaneGeometry(laneW - 0.15, CHUNK_LENGTH);
        const mesh = new THREE.Mesh(geo, laneMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(laneX, sY, CHUNK_LENGTH / 2);
        mesh.receiveShadow = true;
        chunk.add(mesh);

        // Side support walls if elevated
        if (sY > 0) {
          this.addLaneSupportWall(chunk, laneX, sY, 0, CHUNK_LENGTH);
        }

        // Register height segment
        this.game.laneHeightMap.add({
          lane: laneIndex,
          startZ: this.nextChunkZ,
          endZ: this.nextChunkZ + CHUNK_LENGTH,
          startY: sY,
          endY: sY,
        });
      } else {
        // Lane changes height — flat section, ramp, flat section
        const rampStart = CHUNK_LENGTH * 0.3;
        const rampEnd = rampStart + RAMP_LENGTH;
        const flatAfter = CHUNK_LENGTH - rampEnd;

        // Flat at start height
        const flat1Geo = new THREE.PlaneGeometry(laneW - 0.15, rampStart);
        const flat1 = new THREE.Mesh(flat1Geo, laneMat);
        flat1.rotation.x = -Math.PI / 2;
        flat1.position.set(laneX, sY, rampStart / 2);
        flat1.receiveShadow = true;
        chunk.add(flat1);

        if (sY > 0) {
          this.addLaneSupportWall(chunk, laneX, sY, 0, rampStart);
        }

        // Ramp
        const rampGroup = this.createRamp(laneX, laneW - 0.15, sY, eY, rampStart, RAMP_LENGTH);
        chunk.add(rampGroup);

        // Flat at end height
        const flat2Geo = new THREE.PlaneGeometry(laneW - 0.15, flatAfter);
        const flat2 = new THREE.Mesh(flat2Geo, laneMat);
        flat2.rotation.x = -Math.PI / 2;
        flat2.position.set(laneX, eY, rampEnd + flatAfter / 2);
        flat2.receiveShadow = true;
        chunk.add(flat2);

        if (eY > 0) {
          this.addLaneSupportWall(chunk, laneX, eY, rampEnd, flatAfter);
        }

        // Register height segments: flat, ramp, flat
        this.game.laneHeightMap.add({
          lane: laneIndex,
          startZ: this.nextChunkZ,
          endZ: this.nextChunkZ + rampStart,
          startY: sY,
          endY: sY,
        });
        this.game.laneHeightMap.add({
          lane: laneIndex,
          startZ: this.nextChunkZ + rampStart,
          endZ: this.nextChunkZ + rampEnd,
          startY: sY,
          endY: eY,
        });
        this.game.laneHeightMap.add({
          lane: laneIndex,
          startZ: this.nextChunkZ + rampEnd,
          endZ: this.nextChunkZ + CHUNK_LENGTH,
          startY: eY,
          endY: eY,
        });
      }
    }

    // Lane dividers (at average height between adjacent lanes)
    // Left-center divider
    this.addDivider(chunk, -laneW / 2, startHeights, endHeights, 0, 1);
    // Center-right divider
    this.addDivider(chunk, laneW / 2, startHeights, endHeights, 1, 2);

    // Side walls
    const wallGeo = new THREE.BoxGeometry(0.6, 2.5, CHUNK_LENGTH);
    for (const side of [-1, 1]) {
      const wallX = side * (trackWidth / 2 + 0.3);
      const wall = new THREE.Mesh(wallGeo, this.wallMat);
      wall.position.set(wallX, 1.0, CHUNK_LENGTH / 2);
      wall.castShadow = true;
      wall.receiveShadow = true;
      chunk.add(wall);
    }

    // Snow banks
    const snowGeo = new THREE.BoxGeometry(2, 0.5, CHUNK_LENGTH);
    for (const side of [-1, 1]) {
      const snowX = side * (trackWidth / 2 + 1.3);
      const snow = new THREE.Mesh(snowGeo, this.snowMat);
      snow.position.set(snowX, 2.3, CHUNK_LENGTH / 2);
      chunk.add(snow);
    }

    // Decorative snow mounds
    if (Math.random() > 0.3) {
      const moundGeo = new THREE.SphereGeometry(
        3 + Math.random() * 4, 8, 6,
        0, Math.PI * 2, 0, Math.PI / 2
      );
      for (const side of [-1, 1]) {
        if (Math.random() > 0.5) {
          const mound = new THREE.Mesh(moundGeo, this.snowMat);
          mound.position.set(
            side * (12 + Math.random() * 8),
            0,
            Math.random() * CHUNK_LENGTH
          );
          chunk.add(mound);
        }
      }
    }

    // Pine trees
    if (Math.random() > 0.4) {
      for (let i = 0; i < 2; i++) {
        const tree = this.createTree();
        const side = Math.random() > 0.5 ? 1 : -1;
        tree.position.set(
          side * (10 + Math.random() * 10),
          0,
          Math.random() * CHUNK_LENGTH
        );
        chunk.add(tree);
      }
    }

    this.laneEndHeights = endHeights;
    this.game.scene.add(chunk);
    this.chunks.push(chunk);
    this.nextChunkZ += CHUNK_LENGTH;
  }

  private createRamp(
    laneX: number, width: number,
    fromY: number, toY: number,
    localZ: number, length: number
  ): THREE.Group {
    const group = new THREE.Group();
    const heightDiff = toY - fromY;
    const hw = width / 2 - 0.075;

    // Sloped box — a box rotated to form a smooth ramp
    const slopeLen = Math.sqrt(length * length + heightDiff * heightDiff);
    const angle = Math.atan2(heightDiff, length);

    const rampGeo = new THREE.BoxGeometry(width - 0.15, 0.25, slopeLen);
    const rampMat = new THREE.MeshStandardMaterial({ color: 0x55bbdd });
    const ramp = new THREE.Mesh(rampGeo, rampMat);
    ramp.position.set(laneX, (fromY + toY) / 2, localZ + length / 2);
    ramp.rotation.x = -angle;
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    group.add(ramp);

    // Side walls along the ramp
    const sideMat = new THREE.MeshStandardMaterial({ color: 0x4499bb });
    for (const side of [-1, 1]) {
      const sideGeo = new THREE.BoxGeometry(0.2, 0.5, slopeLen);
      const sideWall = new THREE.Mesh(sideGeo, sideMat);
      sideWall.position.set(laneX + side * hw, (fromY + toY) / 2, localZ + length / 2);
      sideWall.rotation.x = -angle;
      sideWall.castShadow = true;
      group.add(sideWall);
    }

    return group;
  }

  private addLaneSupportWall(chunk: THREE.Group, laneX: number, height: number, localZ: number, length: number) {
    const laneW = this.game.laneWidth;
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x4499bb });
    // Side edges — colored walls showing the elevation
    const sideGeo = new THREE.BoxGeometry(0.2, height, length);
    for (const side of [-1, 1]) {
      const sideWall = new THREE.Mesh(sideGeo, wallMat);
      sideWall.position.set(laneX + side * (laneW - 0.15) / 2, height / 2, localZ + length / 2);
      sideWall.receiveShadow = true;
      sideWall.castShadow = true;
      chunk.add(sideWall);
    }
    // Front face — visible wall facing the player
    const faceGeo = new THREE.BoxGeometry(laneW - 0.15, height, 0.2);
    const faceMat = new THREE.MeshStandardMaterial({ color: 0x3388aa });
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.set(laneX, height / 2, localZ + 0.1);
    face.receiveShadow = true;
    face.castShadow = true;
    chunk.add(face);
  }

  private addDivider(
    chunk: THREE.Group, x: number,
    startHeights: [number, number, number],
    endHeights: [number, number, number],
    li1: number, li2: number
  ) {
    // Simple divider at max height of the two adjacent lanes
    const h = Math.max(startHeights[li1], startHeights[li2], endHeights[li1], endHeights[li2]);
    const geo = new THREE.PlaneGeometry(0.18, CHUNK_LENGTH);
    const divider = new THREE.Mesh(geo, this.dividerMat);
    divider.rotation.x = -Math.PI / 2;
    divider.position.set(x, h + 0.01, CHUNK_LENGTH / 2);
    chunk.add(divider);
  }

  private createTree(): THREE.Group {
    const tree = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 2, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1;
    trunk.castShadow = true;
    tree.add(trunk);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32 });
    for (let i = 0; i < 3; i++) {
      const coneGeo = new THREE.ConeGeometry(1.8 - i * 0.4, 2.2, 8);
      const cone = new THREE.Mesh(coneGeo, leafMat);
      cone.position.y = 2.5 + i * 1.2;
      cone.castShadow = true;
      tree.add(cone);
    }

    const snowCap = new THREE.Mesh(
      new THREE.ConeGeometry(0.6, 0.6, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    snowCap.position.y = 6;
    tree.add(snowCap);

    const scale = 0.6 + Math.random() * 0.6;
    tree.scale.setScalar(scale);
    return tree;
  }

  update(dt: number) {
    const moveAmount = this.game.speed * dt;

    for (const chunk of this.chunks) {
      chunk.position.z -= moveAmount;
    }
    this.nextChunkZ -= moveAmount;

    // Scroll height map
    this.game.laneHeightMap.scroll(moveAmount);

    // Remove old chunks
    while (this.chunks.length > 0 && this.chunks[0].position.z < -CHUNK_LENGTH - 20) {
      const old = this.chunks.shift()!;
      this.game.scene.remove(old);
      old.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
        }
      });
    }

    // Add new chunks ahead
    while (this.nextChunkZ < VISIBLE_AHEAD) {
      this.addChunk();
    }
  }

  reset() {
    for (const chunk of this.chunks) {
      this.game.scene.remove(chunk);
      chunk.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
        }
      });
    }
    this.chunks = [];
    this.nextChunkZ = 0;
    this.laneEndHeights = [0, 0, 0];
    this.spawnInitialChunks();
  }
}
