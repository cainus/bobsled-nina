import * as THREE from 'three';
import type { Game } from './Game';

const CHUNK_LENGTH = 40;
const VISIBLE_AHEAD = 160;

export class TrackManager {
  game: Game;
  private chunks: THREE.Group[] = [];
  private nextChunkZ = 0;

  // Shared materials
  private iceMat: THREE.MeshStandardMaterial;
  private wallMat: THREE.MeshStandardMaterial;
  private snowMat: THREE.MeshStandardMaterial;

  constructor(game: Game) {
    this.game = game;

    this.iceMat = new THREE.MeshStandardMaterial({
      color: 0xd6eef8,
      metalness: 0.3,
      roughness: 0.2,
    });
    this.wallMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee });
    this.snowMat = new THREE.MeshStandardMaterial({ color: 0xfafafa });

    this.spawnInitialChunks();
  }

  private spawnInitialChunks() {
    this.nextChunkZ = -CHUNK_LENGTH;
    while (this.nextChunkZ < VISIBLE_AHEAD) {
      this.addChunk();
    }
  }

  private addChunk() {
    const chunk = new THREE.Group();
    // Position the chunk group at the spawn Z; children use local coords (0 to CHUNK_LENGTH)
    chunk.position.z = this.nextChunkZ;

    // Ice track surface — 3 distinct lane strips
    const trackWidth = this.game.laneWidth * 3 + 2;
    const laneColors = [0xc2dff0, 0xd6eef8, 0xc2dff0]; // left, center, right
    const laneW = this.game.laneWidth;
    for (let i = -1; i <= 1; i++) {
      const laneGeo = new THREE.PlaneGeometry(laneW - 0.15, CHUNK_LENGTH);
      const laneMat = new THREE.MeshStandardMaterial({
        color: laneColors[i + 1],
        metalness: 0.3,
        roughness: 0.2,
      });
      const lane = new THREE.Mesh(laneGeo, laneMat);
      lane.rotation.x = -Math.PI / 2;
      lane.position.set(i * laneW, 0, CHUNK_LENGTH / 2);
      lane.receiveShadow = true;
      chunk.add(lane);
    }

    // Lane divider strips between lanes
    const dividerGeo = new THREE.PlaneGeometry(0.18, CHUNK_LENGTH);
    const dividerMat = new THREE.MeshStandardMaterial({ color: 0x5599cc });
    for (const lx of [-laneW / 2, laneW / 2]) {
      const divider = new THREE.Mesh(dividerGeo, dividerMat);
      divider.rotation.x = -Math.PI / 2;
      divider.position.set(lx, 0.01, CHUNK_LENGTH / 2);
      chunk.add(divider);
    }

    // Side walls (ice/snow walls of the bobsled track)
    const wallGeo = new THREE.BoxGeometry(0.6, 2.5, CHUNK_LENGTH);
    for (const side of [-1, 1]) {
      const wallX = side * (trackWidth / 2 + 0.3);
      const wall = new THREE.Mesh(wallGeo, this.wallMat);
      wall.position.set(wallX, 1.0, CHUNK_LENGTH / 2);
      wall.castShadow = true;
      wall.receiveShadow = true;
      chunk.add(wall);
    }

    // Snow banks on top of walls
    const snowGeo = new THREE.BoxGeometry(2, 0.5, CHUNK_LENGTH);
    for (const side of [-1, 1]) {
      const snowX = side * (trackWidth / 2 + 1.3);
      const snow = new THREE.Mesh(snowGeo, this.snowMat);
      snow.position.set(snowX, 2.3, CHUNK_LENGTH / 2);
      chunk.add(snow);
    }

    // Decorative snow mounds in background
    if (Math.random() > 0.3) {
      const moundGeo = new THREE.SphereGeometry(
        3 + Math.random() * 4,
        8,
        6,
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

    // Occasional pine trees
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

    this.game.scene.add(chunk);
    this.chunks.push(chunk);
    this.nextChunkZ += CHUNK_LENGTH;
  }

  private createTree(): THREE.Group {
    const tree = new THREE.Group();
    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 2, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1;
    trunk.castShadow = true;
    tree.add(trunk);

    // Foliage layers
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32 });
    for (let i = 0; i < 3; i++) {
      const coneGeo = new THREE.ConeGeometry(1.8 - i * 0.4, 2.2, 8);
      const cone = new THREE.Mesh(coneGeo, leafMat);
      cone.position.y = 2.5 + i * 1.2;
      cone.castShadow = true;
      tree.add(cone);
    }

    // Snow on top
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

    // Move all chunks toward the player
    for (const chunk of this.chunks) {
      chunk.position.z -= moveAmount;
    }
    this.nextChunkZ -= moveAmount;

    // Remove chunks that are behind the camera
    while (this.chunks.length > 0 && this.chunks[0].position.z < -CHUNK_LENGTH - 20) {
      const old = this.chunks.shift()!;
      this.game.scene.remove(old);
      // Dispose geometries
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
    this.spawnInitialChunks();
  }
}
