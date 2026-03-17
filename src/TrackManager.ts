import * as THREE from 'three';
import type { Game } from './Game';
import type { Season } from './SeasonManager';
import { TrackDecorations } from './TrackDecorations';

const CHUNK_LENGTH = 40;
const VISIBLE_AHEAD = 160;
const SUMMER_RAMP_CHANCE = 0.14;

// Possible lane heights
const HEIGHTS = [0, 1.5, 3];
const RAMP_LENGTH = 6;
const WATERFALL_DROP = 16;

export class TrackManager {
  game: Game;
  private chunks: THREE.Group[] = [];
  private nextChunkZ = 0;

  // Current height of each lane at the far end of the last chunk (carry forward)
  private laneEndHeights: [number, number, number] = [0, 0, 0];

  // Waterfall system — cumulative world drop in Spring
  currentBaseY = 0;
  private chunksSinceLastWaterfall = 0;
  private waterfallZPositions: number[] = [];
  private waterfallCount = 0;

  // Dynamic spring wave
  springWaveTime = 0;

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
    const { season, laneColors, wallColor } = this.getSeasonMaterials();
    const laneW = this.game.laneWidth;
    const trackWidth = laneW * 3 + 2;
    const isFlatChunk = this.nextChunkZ < 40;

    // When leaving spring, ramp the floor back up to y=0
    if (season !== 'spring' && this.currentBaseY < 0) {
      this.addRiseChunk(laneColors, wallColor, trackWidth, laneW, season);
      return;
    }

    // Check if this should be a waterfall chunk
    const isWaterfallChunk = season === 'spring' && !isFlatChunk && this.shouldSpawnWaterfall();
    if (isWaterfallChunk) {
      this.addWaterfallChunk(laneColors, trackWidth, laneW);
      return;
    }

    if (season === 'spring') {
      this.chunksSinceLastWaterfall++;
    }

    const chunk = new THREE.Group();
    chunk.position.z = this.nextChunkZ;

    // Decide target heights for each lane in this chunk
    const startHeights: [number, number, number] = [...this.laneEndHeights];
    const endHeights: [number, number, number] = [...this.laneEndHeights];

    const isWaterSeason = season === 'spring' || season === 'summer';

    if (!isFlatChunk) {
      const rampChance = season === 'spring' ? 1.0 : season === 'summer' ? SUMMER_RAMP_CHANCE : 0.55;
      for (let i = 0; i < 3; i++) {
        if (Math.random() < rampChance) {
          const candidates = HEIGHTS.filter(h => h !== startHeights[i]);
          endHeights[i] = candidates[Math.floor(Math.random() * candidates.length)];
        }
      }
    }

    const baseY = this.currentBaseY;

    // Build each lane
    for (let li = 0; li < 3; li++) {
      const laneIndex = li - 1;
      const laneX = laneIndex * laneW;
      const sY = startHeights[li];
      const eY = endHeights[li];

      const isWater = season === 'spring' || season === 'summer';
      const laneMat = new THREE.MeshStandardMaterial({
        color: laneColors[li],
        metalness: isWater ? 0.4 : 0.3,
        roughness: isWater ? 0.15 : 0.2,
        transparent: isWater,
        opacity: isWater ? 0.85 : 1,
      });

      if (isWaterSeason) {
        // Water season lanes: build into a per-lane group so we can animate Y as a unit
        const laneGroup = new THREE.Group();
        laneGroup.userData = { springLane: laneIndex, springBaseY: 0 };
        chunk.add(laneGroup);

        if (sY === eY) {
          const geo = new THREE.PlaneGeometry(laneW - 0.15, CHUNK_LENGTH);
          const mesh = new THREE.Mesh(geo, laneMat);
          mesh.rotation.x = -Math.PI / 2;
          mesh.position.set(laneX, sY + baseY, CHUNK_LENGTH / 2);
          mesh.receiveShadow = true;
          laneGroup.add(mesh);

          if (sY > 0) this.addLaneSupportWall(laneGroup, laneX, sY, 0, CHUNK_LENGTH, baseY);

          this.game.laneHeightMap.add({ lane: laneIndex, startZ: this.nextChunkZ, endZ: this.nextChunkZ + CHUNK_LENGTH, startY: sY + baseY, endY: sY + baseY });
        } else if (season === 'spring') {
          // Spring: two ramps per chunk for more frequent height changes
          const ramp1Start = CHUNK_LENGTH * 0.05;
          const ramp1End = ramp1Start + RAMP_LENGTH;
          const midCandidates = HEIGHTS.filter(h => h !== eY);
          const mY = midCandidates[Math.floor(Math.random() * midCandidates.length)];
          const ramp2Start = CHUNK_LENGTH * 0.55;
          const ramp2End = ramp2Start + RAMP_LENGTH;
          const flatBetween = ramp2Start - ramp1End;
          const flatAfter = CHUNK_LENGTH - ramp2End;

          if (ramp1Start > 0) {
            const f = new THREE.Mesh(new THREE.PlaneGeometry(laneW - 0.15, ramp1Start), laneMat);
            f.rotation.x = -Math.PI / 2;
            f.position.set(laneX, sY + baseY, ramp1Start / 2);
            f.receiveShadow = true;
            laneGroup.add(f);
          }
          this.game.laneHeightMap.add({ lane: laneIndex, startZ: this.nextChunkZ, endZ: this.nextChunkZ + ramp1Start, startY: sY + baseY, endY: sY + baseY });

          laneGroup.add(this.createRamp(laneX, laneW - 0.15, sY + baseY, eY + baseY, ramp1Start, RAMP_LENGTH));
          this.game.laneHeightMap.add({ lane: laneIndex, startZ: this.nextChunkZ + ramp1Start, endZ: this.nextChunkZ + ramp1End, startY: sY + baseY, endY: eY + baseY });

          const fb = new THREE.Mesh(new THREE.PlaneGeometry(laneW - 0.15, flatBetween), laneMat);
          fb.rotation.x = -Math.PI / 2;
          fb.position.set(laneX, eY + baseY, ramp1End + flatBetween / 2);
          fb.receiveShadow = true;
          laneGroup.add(fb);
          if (eY > 0) this.addLaneSupportWall(laneGroup, laneX, eY, ramp1End, flatBetween, baseY);
          this.game.laneHeightMap.add({ lane: laneIndex, startZ: this.nextChunkZ + ramp1End, endZ: this.nextChunkZ + ramp2Start, startY: eY + baseY, endY: eY + baseY });

          laneGroup.add(this.createRamp(laneX, laneW - 0.15, eY + baseY, mY + baseY, ramp2Start, RAMP_LENGTH));
          this.game.laneHeightMap.add({ lane: laneIndex, startZ: this.nextChunkZ + ramp2Start, endZ: this.nextChunkZ + ramp2End, startY: eY + baseY, endY: mY + baseY });

          if (flatAfter > 0) {
            const fa = new THREE.Mesh(new THREE.PlaneGeometry(laneW - 0.15, flatAfter), laneMat);
            fa.rotation.x = -Math.PI / 2;
            fa.position.set(laneX, mY + baseY, ramp2End + flatAfter / 2);
            fa.receiveShadow = true;
            laneGroup.add(fa);
            if (mY > 0) this.addLaneSupportWall(laneGroup, laneX, mY, ramp2End, flatAfter, baseY);
          }
          this.game.laneHeightMap.add({ lane: laneIndex, startZ: this.nextChunkZ + ramp2End, endZ: this.nextChunkZ + CHUNK_LENGTH, startY: mY + baseY, endY: mY + baseY });

          endHeights[li] = mY;
        } else {
          // Summer: single ramp per chunk, with rarer changes for longer rides.
          const rampStart = CHUNK_LENGTH * 0.5;
          const rampEnd = rampStart + RAMP_LENGTH;
          const flatAfter = CHUNK_LENGTH - rampEnd;

          const flat1 = new THREE.Mesh(new THREE.PlaneGeometry(laneW - 0.15, rampStart), laneMat);
          flat1.rotation.x = -Math.PI / 2;
          flat1.position.set(laneX, sY + baseY, rampStart / 2);
          flat1.receiveShadow = true;
          laneGroup.add(flat1);
          if (sY > 0) this.addLaneSupportWall(laneGroup, laneX, sY, 0, rampStart, baseY);

          laneGroup.add(this.createRamp(laneX, laneW - 0.15, sY + baseY, eY + baseY, rampStart, RAMP_LENGTH));

          const flat2 = new THREE.Mesh(new THREE.PlaneGeometry(laneW - 0.15, flatAfter), laneMat);
          flat2.rotation.x = -Math.PI / 2;
          flat2.position.set(laneX, eY + baseY, rampEnd + flatAfter / 2);
          flat2.receiveShadow = true;
          laneGroup.add(flat2);
          if (eY > 0) this.addLaneSupportWall(laneGroup, laneX, eY, rampEnd, flatAfter, baseY);

          this.game.laneHeightMap.add({ lane: laneIndex, startZ: this.nextChunkZ, endZ: this.nextChunkZ + rampStart, startY: sY + baseY, endY: sY + baseY });
          this.game.laneHeightMap.add({ lane: laneIndex, startZ: this.nextChunkZ + rampStart, endZ: this.nextChunkZ + rampEnd, startY: sY + baseY, endY: eY + baseY });
          this.game.laneHeightMap.add({ lane: laneIndex, startZ: this.nextChunkZ + rampEnd, endZ: this.nextChunkZ + CHUNK_LENGTH, startY: eY + baseY, endY: eY + baseY });
        }

        // Foam streaks
        const foamMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
        const foamCount = 2 + Math.floor(Math.random() * 3);
        for (let fi = 0; fi < foamCount; fi++) {
          const fw = 0.1 + Math.random() * 0.3;
          const fl = 2 + Math.random() * 5;
          const foam = new THREE.Mesh(new THREE.PlaneGeometry(fw, fl), foamMat);
          foam.rotation.x = -Math.PI / 2;
          foam.position.set(
            laneX + (Math.random() - 0.5) * (laneW - 0.5),
            sY + baseY + 0.02,
            Math.random() * CHUNK_LENGTH
          );
          laneGroup.add(foam);
        }
      } else if (sY === eY) {
        const geo = new THREE.PlaneGeometry(laneW - 0.15, CHUNK_LENGTH);
        const mesh = new THREE.Mesh(geo, laneMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(laneX, sY + baseY, CHUNK_LENGTH / 2);
        mesh.receiveShadow = true;
        chunk.add(mesh);

        if (sY > 0) {
          this.addLaneSupportWall(chunk, laneX, sY, 0, CHUNK_LENGTH, baseY);
        }

        this.game.laneHeightMap.add({
          lane: laneIndex,
          startZ: this.nextChunkZ,
          endZ: this.nextChunkZ + CHUNK_LENGTH,
          startY: sY + baseY,
          endY: sY + baseY,
        });
      } else {
        const rampStart = CHUNK_LENGTH * 0.3;
        const rampEnd = rampStart + RAMP_LENGTH;
        const flatAfter = CHUNK_LENGTH - rampEnd;

        const flat1Geo = new THREE.PlaneGeometry(laneW - 0.15, rampStart);
        const flat1 = new THREE.Mesh(flat1Geo, laneMat);
        flat1.rotation.x = -Math.PI / 2;
        flat1.position.set(laneX, sY + baseY, rampStart / 2);
        flat1.receiveShadow = true;
        chunk.add(flat1);

        if (sY > 0) {
          this.addLaneSupportWall(chunk, laneX, sY, 0, rampStart, baseY);
        }

        const rampGroup = this.createRamp(laneX, laneW - 0.15, sY + baseY, eY + baseY, rampStart, RAMP_LENGTH);
        chunk.add(rampGroup);

        const flat2Geo = new THREE.PlaneGeometry(laneW - 0.15, flatAfter);
        const flat2 = new THREE.Mesh(flat2Geo, laneMat);
        flat2.rotation.x = -Math.PI / 2;
        flat2.position.set(laneX, eY + baseY, rampEnd + flatAfter / 2);
        flat2.receiveShadow = true;
        chunk.add(flat2);

        if (eY > 0) {
          this.addLaneSupportWall(chunk, laneX, eY, rampEnd, flatAfter, baseY);
        }

        this.game.laneHeightMap.add({
          lane: laneIndex,
          startZ: this.nextChunkZ,
          endZ: this.nextChunkZ + rampStart,
          startY: sY + baseY,
          endY: sY + baseY,
        });
        this.game.laneHeightMap.add({
          lane: laneIndex,
          startZ: this.nextChunkZ + rampStart,
          endZ: this.nextChunkZ + rampEnd,
          startY: sY + baseY,
          endY: eY + baseY,
        });
        this.game.laneHeightMap.add({
          lane: laneIndex,
          startZ: this.nextChunkZ + rampEnd,
          endZ: this.nextChunkZ + CHUNK_LENGTH,
          startY: eY + baseY,
          endY: eY + baseY,
        });
      }
    }

    // Side walls — summer handles its own walls in addSummerSides
    if (season !== 'summer') {
      const isSpringWalls = season === 'spring';
      const wallH = isSpringWalls ? 5.0 : 2.5;
      const wallY = isSpringWalls ? baseY + 2.5 : 1.0;
      const springRockMat = new THREE.MeshStandardMaterial({ color: 0x6a6a5a, roughness: 0.95 });
      const wallMat2 = isSpringWalls ? springRockMat : new THREE.MeshStandardMaterial({ color: wallColor });
      const wallGeo = new THREE.BoxGeometry(isSpringWalls ? 1.2 : 0.6, wallH, CHUNK_LENGTH);
      for (const side of [-1, 1]) {
        const wallX = side * (trackWidth / 2 + (isSpringWalls ? 0.6 : 0.3));
        const wall = new THREE.Mesh(wallGeo, wallMat2);
        wall.position.set(wallX, wallY, CHUNK_LENGTH / 2);
        wall.castShadow = true;
        wall.receiveShadow = true;
        chunk.add(wall);
      }
    }

    // Side decoration depends on season
    TrackDecorations.addSeasonSides(chunk, trackWidth, season, this.currentBaseY);

    this.laneEndHeights = endHeights;
    this.game.scene.add(chunk);
    this.chunks.push(chunk);
    this.nextChunkZ += CHUNK_LENGTH;
  }

  private addRiseChunk(laneColors: number[], wallColor: number, trackWidth: number, laneW: number, season: Season) {
    const chunk = new THREE.Group();
    chunk.position.z = this.nextChunkZ;

    const riseAmount = -this.currentBaseY;
    const baseY = this.currentBaseY;
    const targetBaseY = baseY + riseAmount;

    const isWater = season === 'summer';
    const laneMat = new THREE.MeshStandardMaterial({
      color: laneColors[1],
      metalness: isWater ? 0.4 : 0.3,
      roughness: isWater ? 0.15 : 0.2,
      transparent: isWater,
      opacity: isWater ? 0.85 : 1,
    });

    for (let li = 0; li < 3; li++) {
      const laneIndex = li - 1;
      const laneX = laneIndex * laneW;

      // Ramp up from current baseY to targetBaseY over the full chunk
      const rampGroup = this.createRamp(laneX, laneW - 0.15, baseY, targetBaseY, 0, CHUNK_LENGTH, true);
      chunk.add(rampGroup);

      this.game.laneHeightMap.add({
        lane: laneIndex,
        startZ: this.nextChunkZ,
        endZ: this.nextChunkZ + CHUNK_LENGTH,
        startY: baseY,
        endY: targetBaseY,
      });
    }

    // Side walls
    const wallMat2 = new THREE.MeshStandardMaterial({ color: wallColor });
    const wallH = 2.5 + riseAmount;
    const wallGeo = new THREE.BoxGeometry(0.6, wallH, CHUNK_LENGTH);
    for (const side of [-1, 1]) {
      const wallX = side * (trackWidth / 2 + 0.3);
      const wall = new THREE.Mesh(wallGeo, wallMat2);
      wall.position.set(wallX, baseY + wallH / 2, CHUNK_LENGTH / 2);
      wall.castShadow = true;
      wall.receiveShadow = true;
      chunk.add(wall);
    }

    // Add season-appropriate side decorations
    TrackDecorations.addSeasonSides(chunk, trackWidth, season, this.currentBaseY);

    this.currentBaseY = targetBaseY;
    this.laneEndHeights = [0, 0, 0];

    // Suppress obstacles during rise
    if (this.game.obstacleManager) {
      this.game.obstacleManager.spawnTimer = -2;
    }

    this.game.scene.add(chunk);
    this.chunks.push(chunk);
    this.nextChunkZ += CHUNK_LENGTH;
  }

  private shouldSpawnWaterfall(): boolean {
    const minChunks = 24;
    const maxChunks = 40;
    if (this.chunksSinceLastWaterfall < minChunks) return false;
    if (this.chunksSinceLastWaterfall >= maxChunks) return true;
    return Math.random() < 0.5;
  }

  private addWaterfallChunk(laneColors: number[], trackWidth: number, laneW: number) {
    const chunk = new THREE.Group();
    chunk.position.z = this.nextChunkZ;

    const baseY = this.currentBaseY;
    const dropAmount = this.waterfallCount === 0 ? WATERFALL_DROP : WATERFALL_DROP / 2;

    // Force all lanes to height 0 (relative) for a clean cliff edge
    const approachLen = CHUNK_LENGTH * 0.6;
    const dropLen = CHUNK_LENGTH * 0.4;
    const dropStartZ = approachLen;

    const laneMat = new THREE.MeshStandardMaterial({
      color: laneColors[1],
      metalness: 0.4,
      roughness: 0.15,
      transparent: true,
      opacity: 0.85,
    });

    for (let li = 0; li < 3; li++) {
      const laneIndex = li - 1;
      const laneX = laneIndex * laneW;
      const sY = this.laneEndHeights[li];

      // If lane is elevated, ramp down to 0 first
      if (sY > 0) {
        const rampLen = Math.min(RAMP_LENGTH, approachLen * 0.5);
        // Flat at current height
        const flat1 = new THREE.Mesh(
          new THREE.PlaneGeometry(laneW - 0.15, 2),
          laneMat
        );
        flat1.rotation.x = -Math.PI / 2;
        flat1.position.set(laneX, sY + baseY, 1);
        flat1.receiveShadow = true;
        chunk.add(flat1);

        // Ramp down
        const rampGroup = this.createRamp(laneX, laneW - 0.15, sY + baseY, baseY, 2, rampLen);
        chunk.add(rampGroup);

        // Flat approach after ramp
        const flatLen = approachLen - 2 - rampLen;
        if (flatLen > 0) {
          const flat2 = new THREE.Mesh(
            new THREE.PlaneGeometry(laneW - 0.15, flatLen),
            laneMat
          );
          flat2.rotation.x = -Math.PI / 2;
          flat2.position.set(laneX, baseY, 2 + rampLen + flatLen / 2);
          flat2.receiveShadow = true;
          chunk.add(flat2);
        }

        this.game.laneHeightMap.add({
          lane: laneIndex,
          startZ: this.nextChunkZ,
          endZ: this.nextChunkZ + 2,
          startY: sY + baseY,
          endY: sY + baseY,
        });
        this.game.laneHeightMap.add({
          lane: laneIndex,
          startZ: this.nextChunkZ + 2,
          endZ: this.nextChunkZ + 2 + rampLen,
          startY: sY + baseY,
          endY: baseY,
        });
        this.game.laneHeightMap.add({
          lane: laneIndex,
          startZ: this.nextChunkZ + 2 + rampLen,
          endZ: this.nextChunkZ + approachLen,
          startY: baseY,
          endY: baseY,
        });
      } else {
        // Flat approach at baseY
        const flat = new THREE.Mesh(
          new THREE.PlaneGeometry(laneW - 0.15, approachLen),
          laneMat
        );
        flat.rotation.x = -Math.PI / 2;
        flat.position.set(laneX, baseY, approachLen / 2);
        flat.receiveShadow = true;
        chunk.add(flat);

        this.game.laneHeightMap.add({
          lane: laneIndex,
          startZ: this.nextChunkZ,
          endZ: this.nextChunkZ + approachLen,
          startY: baseY,
          endY: baseY,
        });
      }

      // Foam on approach
      const foamMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
      const foamCount = 3 + Math.floor(Math.random() * 3);
      for (let fi = 0; fi < foamCount; fi++) {
        const fw = 0.15 + Math.random() * 0.3;
        const fl = 1.5 + Math.random() * 3;
        const foam = new THREE.Mesh(new THREE.PlaneGeometry(fw, fl), foamMat);
        foam.rotation.x = -Math.PI / 2;
        foam.position.set(
          laneX + (Math.random() - 0.5) * (laneW - 0.5),
          baseY + 0.02,
          Math.random() * approachLen
        );
        chunk.add(foam);
      }

      // Steep drop ramp — all lanes drop together
      const dropTopY = baseY;
      const dropBottomY = baseY - dropAmount;

      const rampGroup = this.createRamp(laneX, laneW - 0.15, dropTopY, dropBottomY, dropStartZ, dropLen, true);
      chunk.add(rampGroup);

      this.game.laneHeightMap.add({
        lane: laneIndex,
        startZ: this.nextChunkZ + dropStartZ,
        endZ: this.nextChunkZ + CHUNK_LENGTH,
        startY: dropTopY,
        endY: dropBottomY,
      });
    }

    // Vertical rock face under the cliff
    const rockFaceMat = new THREE.MeshStandardMaterial({ color: 0x2a6088, roughness: 0.4, metalness: 0.3 });
    const rockFace = new THREE.Mesh(
      new THREE.BoxGeometry(trackWidth + 3, dropAmount, 1.5),
      rockFaceMat
    );
    rockFace.position.set(0, baseY - dropAmount / 2, dropStartZ + 0.5);
    rockFace.castShadow = true;
    chunk.add(rockFace);

    // Cascading water streaks on the cliff face
    const waterStreakMat = new THREE.MeshStandardMaterial({
      color: 0xccddff,
      transparent: true,
      opacity: 0.5,
      metalness: 0.3,
      roughness: 0.1,
    });
    for (let i = 0; i < 15; i++) {
      const sw = 0.15 + Math.random() * 0.25;
      const sh = dropAmount * (0.5 + Math.random() * 0.5);
      const streak = new THREE.Mesh(
        new THREE.PlaneGeometry(sw, sh),
        waterStreakMat
      );
      streak.position.set(
        (Math.random() - 0.5) * (trackWidth + 1),
        baseY - dropAmount / 2 + (Math.random() - 0.5) * 2,
        dropStartZ + 0.2
      );
      chunk.add(streak);
    }

    // Mist spheres at the base of the waterfall
    const mistMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.25,
    });
    for (let i = 0; i < 8; i++) {
      const mist = new THREE.Mesh(
        new THREE.SphereGeometry(1 + Math.random() * 1.5, 8, 6),
        mistMat
      );
      mist.position.set(
        (Math.random() - 0.5) * trackWidth,
        baseY - dropAmount + 0.5,
        dropStartZ + dropLen * 0.3 + Math.random() * dropLen * 0.5
      );
      chunk.add(mist);
    }

    // Side walls for this chunk — extend from top to bottom
    const springRockMat = new THREE.MeshStandardMaterial({ color: 0x6a6a5a, roughness: 0.95 });
    const wallH = 5.0 + dropAmount;
    const wallGeo = new THREE.BoxGeometry(1.2, wallH, CHUNK_LENGTH);
    for (const side of [-1, 1]) {
      const wallX = side * (trackWidth / 2 + 0.6);
      const wall = new THREE.Mesh(wallGeo, springRockMat);
      wall.position.set(wallX, baseY - dropAmount / 2 + 2.5, CHUNK_LENGTH / 2);
      wall.castShadow = true;
      wall.receiveShadow = true;
      chunk.add(wall);
    }

    TrackDecorations.addSeasonSides(chunk, trackWidth, this.game.seasonManager.season, this.currentBaseY);

    // Update state
    this.currentBaseY -= dropAmount;
    this.laneEndHeights = [0, 0, 0];
    this.chunksSinceLastWaterfall = 0;
    this.waterfallCount++;

    // Record waterfall position (the drop edge in world Z)
    this.waterfallZPositions.push(this.nextChunkZ + dropStartZ);

    // Suppress obstacles after waterfall
    if (this.game.obstacleManager) {
      this.game.obstacleManager.spawnTimer = -3;
    }

    this.game.scene.add(chunk);
    this.chunks.push(chunk);
    this.nextChunkZ += CHUNK_LENGTH;
  }

  private createRamp(
    laneX: number, width: number,
    fromY: number, toY: number,
    localZ: number, length: number,
    skipSideWalls = false
  ): THREE.Group {
    const group = new THREE.Group();
    const heightDiff = toY - fromY;
    const hw = width / 2 - 0.075;

    const slopeLen = Math.sqrt(length * length + heightDiff * heightDiff);
    const angle = Math.atan2(heightDiff, length);

    const season = this.game.seasonManager.season;
    const rampColor = season === 'autumn' ? 0x8B7355
      : season === 'spring' ? 0x4499cc
      : season === 'summer' ? 0x1a99cc
      : 0xbbeeFF;
    const sideColor = season === 'autumn' ? 0x7a6040
      : season === 'spring' ? 0x88ccee
      : season === 'summer' ? 0x1188bb
      : 0xaaddee;

    const rampGeo = new THREE.BoxGeometry(width - 0.15, 0.25, slopeLen);
    const rampMat = new THREE.MeshStandardMaterial({ color: rampColor });
    const ramp = new THREE.Mesh(rampGeo, rampMat);
    ramp.position.set(laneX, (fromY + toY) / 2, localZ + length / 2);
    ramp.rotation.x = -angle;
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    group.add(ramp);

    if (!skipSideWalls) {
      const sideMat = new THREE.MeshStandardMaterial({ color: sideColor });
      for (const side of [-1, 1]) {
        const sideGeo = new THREE.BoxGeometry(0.2, 0.5, slopeLen);
        const sideWall = new THREE.Mesh(sideGeo, sideMat);
        sideWall.position.set(laneX + side * hw, (fromY + toY) / 2, localZ + length / 2);
        sideWall.rotation.x = -angle;
        sideWall.castShadow = true;
        group.add(sideWall);
      }
    }

    return group;
  }

  private addLaneSupportWall(chunk: THREE.Group, laneX: number, height: number, localZ: number, length: number, yOffset = 0) {
    const laneW = this.game.laneWidth;
    const season = this.game.seasonManager.season;
    const wallColor = season === 'autumn' ? 0x7a6040
      : season === 'spring' ? 0x2a7090
      : season === 'summer' ? 0x1188bb
      : 0xaaddee;
    const faceColor = season === 'autumn' ? 0x6b5535
      : season === 'spring' ? 0x1a5a78
      : season === 'summer' ? 0x0e7799
      : 0x99ccdd;
    const wallMat = new THREE.MeshStandardMaterial({ color: wallColor });
    const sideGeo = new THREE.BoxGeometry(0.2, height, length);
    for (const side of [-1, 1]) {
      const sideWall = new THREE.Mesh(sideGeo, wallMat);
      sideWall.position.set(laneX + side * (laneW - 0.15) / 2, yOffset + height / 2, localZ + length / 2);
      sideWall.receiveShadow = true;
      sideWall.castShadow = true;
      chunk.add(sideWall);
    }
    const faceGeo = new THREE.BoxGeometry(laneW - 0.15, height, 0.2);
    const faceMat = new THREE.MeshStandardMaterial({ color: faceColor });
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.set(laneX, yOffset + height / 2, localZ + 0.1);
    face.receiveShadow = true;
    face.castShadow = true;
    chunk.add(face);
  }

  update(dt: number) {
    const moveAmount = this.game.speed * dt;

    for (const chunk of this.chunks) {
      chunk.position.z -= moveAmount;
    }
    this.nextChunkZ -= moveAmount;

    // Scroll height map and waterfall positions
    this.game.laneHeightMap.scroll(moveAmount);
    for (let i = 0; i < this.waterfallZPositions.length; i++) {
      this.waterfallZPositions[i] -= moveAmount;
    }
    this.waterfallZPositions = this.waterfallZPositions.filter(z => z > -80);

    // Update waterfall sound based on nearest waterfall
    const nearest = this.waterfallZPositions.length > 0
      ? this.waterfallZPositions.reduce((a, b) => Math.abs(a) < Math.abs(b) ? a : b)
      : null;
    this.game.soundManager.updateWaterfallSound(nearest);

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

    // Animate water lane heights
    this.springWaveTime += dt;
    const animSeason = this.game.seasonManager.season;
    if (animSeason === 'spring' || animSeason === 'summer') {
      const t = this.springWaveTime;
      const isSummer = animSeason === 'summer';
      for (const chunk of this.chunks) {
        for (const child of chunk.children) {
          const ud = child.userData;
          if (ud && ud.springLane !== undefined) {
            const lane = ud.springLane as number;
            // Spring: each lane bobs independently with big phase offsets
            // Summer: wave rolls from right to left across lanes
            const phase = isSummer ? (1 - lane) * 0.6 : (lane + 1) * 2.3;
            const amp = isSummer ? 1.0 : 1.2;
            const wave = Math.sin(t * 1.8 + phase) * amp;
            child.position.y = wave;
          }
        }
      }
    }

  }

  isNearWaterfall(): boolean {
    for (const z of this.waterfallZPositions) {
      if (z > -10 && z < 25) return true;
    }
    return false;
  }

  getSpringWaveOffset(lane: number): number {
    const s = this.game.seasonManager.season;
    if (s !== 'spring' && s !== 'summer') return 0;
    const isSummer = s === 'summer';
    const phase = isSummer ? (1 - lane) * 0.6 : (lane + 1) * 2.3;
    const amp = isSummer ? 1.0 : 1.2;
    return Math.sin(this.springWaveTime * 1.8 + phase) * amp;
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
    this.currentBaseY = 0;
    this.chunksSinceLastWaterfall = 0;
    this.waterfallCount = 0;
    this.waterfallZPositions = [];
    this.springWaveTime = 0;
    this.spawnInitialChunks();
  }
}
