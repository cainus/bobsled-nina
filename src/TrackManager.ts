import * as THREE from 'three';
import type { Game } from './Game';
import type { Season } from './SeasonManager';

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

  // Shared materials (updated per season)
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
      color: 0xddeeFF,
      metalness: 0.2,
      roughness: 0.3,
    });
    this.laneColors = [0xf2f7fb, 0xf8fbfd, 0xf2f7fb];
    this.dividerMat = new THREE.MeshStandardMaterial({ color: 0x99bbcc });

    this.spawnInitialChunks();
  }

  private getSeasonMaterials() {
    const season = this.game.seasonManager.season;
    const config = this.game.seasonManager.getConfig();

    return {
      season,
      laneColors: config.laneColors,
      wallColor: config.wallColor,
      groundColor: config.groundColor,
    };
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

    const { season, laneColors, wallColor } = this.getSeasonMaterials();
    const laneW = this.game.laneWidth;
    const trackWidth = laneW * 3 + 2;

    // Decide target heights for each lane in this chunk
    const isFlatChunk = this.nextChunkZ < 40;
    const startHeights: [number, number, number] = [...this.laneEndHeights];
    const endHeights: [number, number, number] = [...this.laneEndHeights];

    if (!isFlatChunk) {
      for (let i = 0; i < 3; i++) {
        if (Math.random() < 0.55) {
          const candidates = HEIGHTS.filter(h => h !== startHeights[i]);
          endHeights[i] = candidates[Math.floor(Math.random() * candidates.length)];
        }
      }
    }

    // Build each lane
    for (let li = 0; li < 3; li++) {
      const laneIndex = li - 1;
      const laneX = laneIndex * laneW;
      const sY = startHeights[li];
      const eY = endHeights[li];

      const laneMat = new THREE.MeshStandardMaterial({
        color: laneColors[li],
        metalness: 0.3,
        roughness: 0.2,
      });

      if (sY === eY) {
        const geo = new THREE.PlaneGeometry(laneW - 0.15, CHUNK_LENGTH);
        const mesh = new THREE.Mesh(geo, laneMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(laneX, sY, CHUNK_LENGTH / 2);
        mesh.receiveShadow = true;
        chunk.add(mesh);

        if (sY > 0) {
          this.addLaneSupportWall(chunk, laneX, sY, 0, CHUNK_LENGTH);
        }

        this.game.laneHeightMap.add({
          lane: laneIndex,
          startZ: this.nextChunkZ,
          endZ: this.nextChunkZ + CHUNK_LENGTH,
          startY: sY,
          endY: sY,
        });
      } else {
        const rampStart = CHUNK_LENGTH * 0.3;
        const rampEnd = rampStart + RAMP_LENGTH;
        const flatAfter = CHUNK_LENGTH - rampEnd;

        const flat1Geo = new THREE.PlaneGeometry(laneW - 0.15, rampStart);
        const flat1 = new THREE.Mesh(flat1Geo, laneMat);
        flat1.rotation.x = -Math.PI / 2;
        flat1.position.set(laneX, sY, rampStart / 2);
        flat1.receiveShadow = true;
        chunk.add(flat1);

        if (sY > 0) {
          this.addLaneSupportWall(chunk, laneX, sY, 0, rampStart);
        }

        const rampGroup = this.createRamp(laneX, laneW - 0.15, sY, eY, rampStart, RAMP_LENGTH);
        chunk.add(rampGroup);

        const flat2Geo = new THREE.PlaneGeometry(laneW - 0.15, flatAfter);
        const flat2 = new THREE.Mesh(flat2Geo, laneMat);
        flat2.rotation.x = -Math.PI / 2;
        flat2.position.set(laneX, eY, rampEnd + flatAfter / 2);
        flat2.receiveShadow = true;
        chunk.add(flat2);

        if (eY > 0) {
          this.addLaneSupportWall(chunk, laneX, eY, rampEnd, flatAfter);
        }

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

    // Side walls
    const wallMat = new THREE.MeshStandardMaterial({ color: wallColor });
    const wallGeo = new THREE.BoxGeometry(0.6, 2.5, CHUNK_LENGTH);
    for (const side of [-1, 1]) {
      const wallX = side * (trackWidth / 2 + 0.3);
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(wallX, 1.0, CHUNK_LENGTH / 2);
      wall.castShadow = true;
      wall.receiveShadow = true;
      chunk.add(wall);
    }

    // Side decoration depends on season
    if (season === 'summer') {
      this.addSummerSides(chunk, trackWidth);
    } else if (season === 'autumn') {
      this.addAutumnSides(chunk, trackWidth);
    } else {
      this.addWinterSides(chunk, trackWidth);
    }

    this.laneEndHeights = endHeights;
    this.game.scene.add(chunk);
    this.chunks.push(chunk);
    this.nextChunkZ += CHUNK_LENGTH;
  }

  private addWinterSides(chunk: THREE.Group, trackWidth: number) {
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xfafafa });

    // Snow banks
    const snowGeo = new THREE.BoxGeometry(2, 0.5, CHUNK_LENGTH);
    for (const side of [-1, 1]) {
      const snowX = side * (trackWidth / 2 + 1.3);
      const snow = new THREE.Mesh(snowGeo, snowMat);
      snow.position.set(snowX, 2.3, CHUNK_LENGTH / 2);
      chunk.add(snow);
    }

    // Snow mounds
    for (const side of [-1, 1]) {
      if (Math.random() > 0.3) {
        const moundGeo = new THREE.SphereGeometry(
          3 + Math.random() * 4, 8, 6,
          0, Math.PI * 2, 0, Math.PI / 2
        );
        const mound = new THREE.Mesh(moundGeo, snowMat);
        mound.position.set(
          side * (12 + Math.random() * 8),
          0,
          Math.random() * CHUNK_LENGTH
        );
        chunk.add(mound);
      }
    }

    // Pine trees
    for (const side of [-1, 1]) {
      const treeCount = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < treeCount; i++) {
        const tree = this.createPineTree();
        tree.position.set(
          side * (9 + Math.random() * 20),
          0,
          Math.random() * CHUNK_LENGTH
        );
        chunk.add(tree);
      }
    }

    // Side rocks
    for (const side of [-1, 1]) {
      if (Math.random() > 0.4) {
        const rock = this.createSideRock();
        rock.position.set(
          side * (10 + Math.random() * 12),
          0,
          Math.random() * CHUNK_LENGTH
        );
        chunk.add(rock);
      }
    }

    // Rare inuksuk
    if (Math.random() < 0.08) {
      const side = Math.random() > 0.5 ? 1 : -1;
      const inuksuk = this.createInuksuk();
      inuksuk.position.set(
        side * (12 + Math.random() * 10),
        0,
        Math.random() * CHUNK_LENGTH
      );
      inuksuk.rotation.y = side * -0.3 + (Math.random() - 0.5) * 0.4;
      chunk.add(inuksuk);
    }
  }

  private addSummerSides(chunk: THREE.Group, trackWidth: number) {
    // Water on both sides
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x2196f3,
      metalness: 0.3,
      roughness: 0.2,
      transparent: true,
      opacity: 0.75,
    });
    for (const side of [-1, 1]) {
      const waterGeo = new THREE.PlaneGeometry(30, CHUNK_LENGTH);
      const water = new THREE.Mesh(waterGeo, waterMat);
      water.rotation.x = -Math.PI / 2;
      water.position.set(
        side * (trackWidth / 2 + 16),
        -0.1,
        CHUNK_LENGTH / 2
      );
      chunk.add(water);
    }

    // Sand banks along edges
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xf5deb3 });
    for (const side of [-1, 1]) {
      const bankGeo = new THREE.BoxGeometry(3, 0.4, CHUNK_LENGTH);
      const bank = new THREE.Mesh(bankGeo, sandMat);
      bank.position.set(side * (trackWidth / 2 + 1.5), 1.8, CHUNK_LENGTH / 2);
      chunk.add(bank);
    }

    // Palm trees
    for (const side of [-1, 1]) {
      const treeCount = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < treeCount; i++) {
        const palm = this.createPalmTree();
        palm.position.set(
          side * (8 + Math.random() * 12),
          0,
          Math.random() * CHUNK_LENGTH
        );
        chunk.add(palm);
      }
    }
  }

  private addAutumnSides(chunk: THREE.Group, trackWidth: number) {
    // Grass/dirt banks
    const dirtMat = new THREE.MeshStandardMaterial({ color: 0x8B7355 });
    for (const side of [-1, 1]) {
      const bankGeo = new THREE.BoxGeometry(2, 0.5, CHUNK_LENGTH);
      const bank = new THREE.Mesh(bankGeo, dirtMat);
      bank.position.set(side * (trackWidth / 2 + 1.3), 2.3, CHUNK_LENGTH / 2);
      chunk.add(bank);
    }

    // Rolling hills — irregular terrain using stretched/squashed shapes, kept off-track
    const hillColors = [0x8B6914, 0xA0522D, 0x6B8E23, 0xCD853F, 0x7a9a3a, 0x9B7B3A];
    for (const side of [-1, 1]) {
      const hillCount = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < hillCount; i++) {
        const color = hillColors[Math.floor(Math.random() * hillColors.length)];
        const baseRadius = 4 + Math.random() * 8;
        const hillGeo = new THREE.SphereGeometry(
          baseRadius, 8, 6,
          0, Math.PI * 2, 0, Math.PI / 2
        );
        const hill = new THREE.Mesh(hillGeo, new THREE.MeshStandardMaterial({ color }));
        // Stretch to make ridges rather than domes
        const scaleX = 0.6 + Math.random() * 1.2;
        const scaleY = 0.3 + Math.random() * 0.5;
        const scaleZ = 0.8 + Math.random() * 1.5;
        hill.scale.set(scaleX, scaleY, scaleZ);
        hill.rotation.y = Math.random() * Math.PI;
        // Keep well away from the track
        hill.position.set(
          side * (25 + Math.random() * 15),
          -0.5,
          Math.random() * CHUNK_LENGTH
        );
        chunk.add(hill);
      }
    }

    // Oak trees with colored leaves
    for (const side of [-1, 1]) {
      const treeCount = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < treeCount; i++) {
        const oak = this.createOakTree();
        oak.position.set(
          side * (9 + Math.random() * 15),
          0,
          Math.random() * CHUNK_LENGTH
        );
        chunk.add(oak);
      }
    }

    // Side rocks
    for (const side of [-1, 1]) {
      if (Math.random() > 0.5) {
        const rock = this.createSideRock();
        rock.position.set(
          side * (10 + Math.random() * 12),
          0,
          Math.random() * CHUNK_LENGTH
        );
        chunk.add(rock);
      }
    }
  }

  private createRamp(
    laneX: number, width: number,
    fromY: number, toY: number,
    localZ: number, length: number
  ): THREE.Group {
    const group = new THREE.Group();
    const heightDiff = toY - fromY;
    const hw = width / 2 - 0.075;

    const slopeLen = Math.sqrt(length * length + heightDiff * heightDiff);
    const angle = Math.atan2(heightDiff, length);

    const isAutumn = this.game.seasonManager.season === 'autumn';
    const rampColor = isAutumn ? 0x8B7355 : 0xbbeeFF;
    const sideColor = isAutumn ? 0x7a6040 : 0xaaddee;

    const rampGeo = new THREE.BoxGeometry(width - 0.15, 0.25, slopeLen);
    const rampMat = new THREE.MeshStandardMaterial({ color: rampColor });
    const ramp = new THREE.Mesh(rampGeo, rampMat);
    ramp.position.set(laneX, (fromY + toY) / 2, localZ + length / 2);
    ramp.rotation.x = -angle;
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    group.add(ramp);

    const sideMat = new THREE.MeshStandardMaterial({ color: sideColor });
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
    const isAutumn = this.game.seasonManager.season === 'autumn';
    const wallMat = new THREE.MeshStandardMaterial({ color: isAutumn ? 0x7a6040 : 0xaaddee });
    const sideGeo = new THREE.BoxGeometry(0.2, height, length);
    for (const side of [-1, 1]) {
      const sideWall = new THREE.Mesh(sideGeo, wallMat);
      sideWall.position.set(laneX + side * (laneW - 0.15) / 2, height / 2, localZ + length / 2);
      sideWall.receiveShadow = true;
      sideWall.castShadow = true;
      chunk.add(sideWall);
    }
    const faceGeo = new THREE.BoxGeometry(laneW - 0.15, height, 0.2);
    const faceMat = new THREE.MeshStandardMaterial({ color: isAutumn ? 0x6b5535 : 0x99ccdd });
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.set(laneX, height / 2, localZ + 0.1);
    face.receiveShadow = true;
    face.castShadow = true;
    chunk.add(face);
  }

  private createPineTree(): THREE.Group {
    const tree = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const variant = Math.floor(Math.random() * 3);

    if (variant === 0) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 2, 6), trunkMat);
      trunk.position.y = 1;
      trunk.castShadow = true;
      tree.add(trunk);
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x2b5440 });
      for (let i = 0; i < 3; i++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(1.8 - i * 0.4, 2.2, 8), leafMat);
        cone.position.y = 2.5 + i * 1.2;
        cone.castShadow = true;
        tree.add(cone);
      }
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.6, 8), snowMat);
      cap.position.y = 6;
      tree.add(cap);
    } else if (variant === 1) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 3, 6), trunkMat);
      trunk.position.y = 1.5;
      trunk.castShadow = true;
      tree.add(trunk);
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x345548 });
      for (let i = 0; i < 5; i++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(1.0 - i * 0.15, 1.4, 6), leafMat);
        cone.position.y = 2.8 + i * 0.9;
        cone.castShadow = true;
        tree.add(cone);
      }
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 6), snowMat);
      cap.position.y = 7.3;
      tree.add(cap);
    } else {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.5, 6), trunkMat);
      trunk.position.y = 0.75;
      trunk.castShadow = true;
      tree.add(trunk);
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x1f4030 });
      for (let i = 0; i < 2; i++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(2.0 - i * 0.4, 1.8, 8), leafMat);
        cone.position.y = 1.8 + i * 1.1;
        cone.castShadow = true;
        tree.add(cone);
      }
      for (let i = 0; i < 2; i++) {
        const snow = new THREE.Mesh(new THREE.ConeGeometry(1.7 - i * 0.4, 0.35, 8), snowMat);
        snow.position.y = 2.4 + i * 1.1;
        tree.add(snow);
      }
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.5, 8), snowMat);
      cap.position.y = 4.5;
      tree.add(cap);
    }

    const scale = 0.6 + Math.random() * 0.6;
    tree.scale.setScalar(scale);
    return tree;
  }

  private createPalmTree(): THREE.Group {
    const tree = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.9 });

    // Curved trunk — stack of slightly offset cylinders
    const segments = 6;
    let x = 0, y = 0;
    const lean = (Math.random() - 0.5) * 0.3;
    for (let i = 0; i < segments; i++) {
      const segH = 0.8;
      const radius = 0.2 - i * 0.02;
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius + 0.02, segH, 8), trunkMat);
      x += lean;
      y += segH;
      seg.position.set(x, y - segH / 2, 0);
      seg.castShadow = true;
      tree.add(seg);

      // Ring marks on trunk
      if (i % 2 === 0) {
        const ringMat = new THREE.MeshStandardMaterial({ color: 0x7a5a10 });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.01, 0.015, 4, 8), ringMat);
        ring.position.set(x, y - segH, 0);
        ring.rotation.x = Math.PI / 2;
        tree.add(ring);
      }
    }

    // Palm fronds — flat cones fanning out from the top
    const frondMat = new THREE.MeshStandardMaterial({ color: 0x228B22 });
    const frondCount = 7;
    const topY = y;
    const topX = x;
    for (let i = 0; i < frondCount; i++) {
      const angle = (i / frondCount) * Math.PI * 2;
      const frondGeo = new THREE.ConeGeometry(0.4, 2.5, 4);
      const frond = new THREE.Mesh(frondGeo, frondMat);
      frond.position.set(
        topX + Math.sin(angle) * 0.8,
        topY + 0.3,
        Math.cos(angle) * 0.8
      );
      // Droop outward
      frond.rotation.z = Math.sin(angle) * 1.0;
      frond.rotation.x = Math.cos(angle) * 1.0;
      frond.castShadow = true;
      tree.add(frond);
    }

    // Coconuts
    const coconutMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * Math.PI * 2;
      const coconut = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), coconutMat);
      coconut.position.set(topX + Math.sin(ang) * 0.25, topY - 0.1, Math.cos(ang) * 0.25);
      tree.add(coconut);
    }

    const scale = 0.7 + Math.random() * 0.5;
    tree.scale.setScalar(scale);
    return tree;
  }

  private createOakTree(): THREE.Group {
    const tree = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });

    // Trunk
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 3, 8), trunkMat);
    trunk.position.y = 1.5;
    trunk.castShadow = true;
    tree.add(trunk);

    // Branches
    for (const side of [-1, 1]) {
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.5, 6), trunkMat);
      branch.position.set(side * 0.5, 2.8, 0);
      branch.rotation.z = side * 0.6;
      tree.add(branch);
    }

    // Foliage — rounded clusters of autumn-colored spheres
    const leafColors = [0xcc3333, 0xff8800, 0xffcc00, 0x88aa22, 0x8B4513];
    const foliagePositions: [number, number, number][] = [
      [0, 3.8, 0], [-0.8, 3.4, 0.3], [0.8, 3.4, -0.3],
      [0, 4.3, 0.2], [-0.5, 4.0, -0.4], [0.5, 4.0, 0.4],
    ];
    for (const [fx, fy, fz] of foliagePositions) {
      const color = leafColors[Math.floor(Math.random() * leafColors.length)];
      const foliage = new THREE.Mesh(
        new THREE.SphereGeometry(0.7 + Math.random() * 0.3, 8, 6),
        new THREE.MeshStandardMaterial({ color })
      );
      foliage.position.set(fx, fy, fz);
      foliage.castShadow = true;
      tree.add(foliage);
    }

    const scale = 0.7 + Math.random() * 0.5;
    tree.scale.setScalar(scale);
    return tree;
  }

  private createSideRock(): THREE.Group {
    const group = new THREE.Group();
    const colors = [0x777777, 0x666666, 0x888888, 0x6a6a6a];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });

    const size = 1.5 + Math.random() * 2;
    const main = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 1), mat);
    main.position.y = size * 0.6;
    main.rotation.set(Math.random() * 0.5, Math.random() * 3, Math.random() * 0.3);
    main.scale.set(1, 0.7 + Math.random() * 0.3, 1 + Math.random() * 0.3);
    main.castShadow = true;
    group.add(main);

    // Snow cap only in winter
    if (this.game.seasonManager.season === 'winter') {
      const snowMat = new THREE.MeshStandardMaterial({ color: 0xfafafa });
      const snowGeo = new THREE.SphereGeometry(size * 0.6, 6, 4, 0, Math.PI * 2, 0, Math.PI * 0.4);
      const snow = new THREE.Mesh(snowGeo, snowMat);
      snow.position.set(0, size * 1.1, 0);
      group.add(snow);
    }

    if (Math.random() > 0.4) {
      const smallSize = size * 0.4 + Math.random() * 0.5;
      const small = new THREE.Mesh(new THREE.DodecahedronGeometry(smallSize, 0),
        new THREE.MeshStandardMaterial({ color: 0x707070, roughness: 0.95 }));
      small.position.set(size * 0.7, smallSize * 0.5, size * 0.3);
      small.rotation.set(Math.random(), Math.random(), Math.random());
      small.castShadow = true;
      group.add(small);
    }

    return group;
  }

  private createInuksuk(): THREE.Group {
    const group = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6b6b6b, roughness: 0.95 });
    const darkStoneMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 });

    const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 0.6), stoneMat);
    base.position.y = 0.18;
    base.castShadow = true;
    group.add(base);

    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.8, 0.5), darkStoneMat);
    leftLeg.position.set(-0.4, 0.75, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.8, 0.5), darkStoneMat);
    rightLeg.position.set(0.4, 0.75, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    const mid = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.55), stoneMat);
    mid.position.y = 1.3;
    mid.castShadow = true;
    group.add(mid);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.45), darkStoneMat);
    torso.position.y = 1.8;
    torso.castShadow = true;
    group.add(torso);

    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.35), stoneMat);
      arm.position.set(side * 0.6, 1.75, 0);
      arm.rotation.z = side * -0.15;
      arm.castShadow = true;
      group.add(arm);
    }

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), darkStoneMat);
    head.position.y = 2.4;
    head.scale.set(1, 0.8, 0.9);
    head.castShadow = true;
    group.add(head);

    const snowMat = new THREE.MeshStandardMaterial({ color: 0xfafafa });
    const snow = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 6, 4, 0, Math.PI * 2, 0, Math.PI * 0.4),
      snowMat
    );
    snow.position.y = 2.6;
    group.add(snow);

    const scale = 0.8 + Math.random() * 0.4;
    group.scale.setScalar(scale);
    return group;
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
