import * as THREE from 'three';
import type { Season } from './SeasonManager';

const CHUNK_LENGTH = 40;

export class TrackDecorations {
  static createPineTree(season: Season): THREE.Group {
    const tree = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
    const isWinter = season === 'winter';
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
      if (isWinter) {
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.6, 8), snowMat);
        cap.position.y = 6;
        tree.add(cap);
      }
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
      if (isWinter) {
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 6), snowMat);
        cap.position.y = 7.3;
        tree.add(cap);
      }
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
      if (isWinter) {
        for (let i = 0; i < 2; i++) {
          const snow = new THREE.Mesh(new THREE.ConeGeometry(1.7 - i * 0.4, 0.35, 8), snowMat);
          snow.position.y = 2.4 + i * 1.1;
          tree.add(snow);
        }
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.5, 8), snowMat);
        cap.position.y = 4.5;
        tree.add(cap);
      }
    }

    const scale = 0.6 + Math.random() * 0.6;
    tree.scale.setScalar(scale);
    return tree;
  }

  static createPalmTree(): THREE.Group {
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

  static createOakTree(): THREE.Group {
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

  static createBeachUmbrella(): THREE.Group {
    const group = new THREE.Group();

    // Pole
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.5 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), poleMat);
    pole.position.y = 1.1;
    pole.castShadow = true;
    group.add(pole);

    // Colorful cone canopy
    const canopyColors = [0xff4444, 0x4488ff, 0xffcc00, 0xff6600, 0x44cc44];
    const color = canopyColors[Math.floor(Math.random() * canopyColors.length)];
    const canopyMat = new THREE.MeshStandardMaterial({ color });
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.0, 0.8, 8), canopyMat);
    canopy.position.y = 2.4;
    canopy.rotation.x = Math.PI; // flip upside down so it opens downward
    canopy.castShadow = true;
    group.add(canopy);

    const scale = 0.6 + Math.random() * 0.3;
    group.scale.setScalar(scale);
    return group;
  }

  static createBuoy(): THREE.Group {
    const group = new THREE.Group();

    // Red sphere
    const redMat = new THREE.MeshStandardMaterial({ color: 0xdd2222 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), redMat);
    body.position.y = 0.2;
    group.add(body);

    // White stripe
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.08, 6, 12), whiteMat);
    stripe.position.y = 0.2;
    stripe.rotation.x = Math.PI / 2;
    group.add(stripe);

    // Small top spike
    const spike = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 4), whiteMat);
    spike.position.y = 0.6;
    group.add(spike);

    return group;
  }

  static createSideRock(season: Season): THREE.Group {
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
    if (season === 'winter') {
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

  static createInuksuk(): THREE.Group {
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

  static createSpringDeciduousTree(): THREE.Group {
    const tree = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });

    // Trunk
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 3, 8), trunkMat);
    trunk.position.y = 1.5;
    trunk.castShadow = true;
    tree.add(trunk);

    // Bright green spherical foliage clusters
    const leafColors = [0x44bb33, 0x33cc44, 0x55dd55, 0x66ee44, 0x3da832];
    const foliagePositions: [number, number, number][] = [
      [0, 3.8, 0], [-0.7, 3.3, 0.3], [0.7, 3.3, -0.3],
      [0, 4.4, 0.2], [-0.4, 3.9, -0.4], [0.4, 3.9, 0.4],
    ];
    for (const [fx, fy, fz] of foliagePositions) {
      const color = leafColors[Math.floor(Math.random() * leafColors.length)];
      const foliage = new THREE.Mesh(
        new THREE.SphereGeometry(0.7 + Math.random() * 0.35, 8, 6),
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

  static addSeasonSides(chunk: THREE.Group, trackWidth: number, season: Season, baseY: number) {
    if (season === 'summer') TrackDecorations.addSummerSides(chunk, trackWidth);
    else if (season === 'autumn') TrackDecorations.addAutumnSides(chunk, trackWidth, season);
    else if (season === 'spring') TrackDecorations.addSpringSides(chunk, trackWidth, baseY, season);
    else TrackDecorations.addWinterSides(chunk, trackWidth, season);
  }

  private static addWinterSides(chunk: THREE.Group, trackWidth: number, season: Season) {
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
        const tree = TrackDecorations.createPineTree(season);
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
        const rock = TrackDecorations.createSideRock(season);
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
      const inuksuk = TrackDecorations.createInuksuk();
      inuksuk.position.set(
        side * (12 + Math.random() * 10),
        0,
        Math.random() * CHUNK_LENGTH
      );
      inuksuk.rotation.y = side * -0.3 + (Math.random() - 0.5) * 0.4;
      chunk.add(inuksuk);
    }
  }

  private static addSummerSides(chunk: THREE.Group, trackWidth: number) {
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x1565c0,
      metalness: 0.4,
      roughness: 0.15,
      transparent: true,
      opacity: 0.88,
    });

    // Water on both sides, flush against the track
    for (const side of [-1, 1]) {
      const waterGeo = new THREE.PlaneGeometry(30, CHUNK_LENGTH);
      const water = new THREE.Mesh(waterGeo, waterMat);
      water.rotation.x = -Math.PI / 2;
      water.position.set(side * (trackWidth / 2 + 16), -0.1, CHUNK_LENGTH / 2);
      chunk.add(water);
    }

    // Open ocean extends further on the left
    const deepWater = new THREE.Mesh(new THREE.PlaneGeometry(60, CHUNK_LENGTH), waterMat);
    deepWater.rotation.x = -Math.PI / 2;
    deepWater.position.set(-(trackWidth / 2 + 61), -0.1, CHUNK_LENGTH / 2);
    chunk.add(deepWater);

    // Sand beach right (closer to track)
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xf5deb3 });
    const sandGeo = new THREE.BoxGeometry(40, 0.5, CHUNK_LENGTH);
    const sand = new THREE.Mesh(sandGeo, sandMat);
    sand.position.set(trackWidth / 2 + 38, -0.1, CHUNK_LENGTH / 2);
    sand.receiveShadow = true;
    chunk.add(sand);

    // Palm trees on the beach
    const treeCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < treeCount; i++) {
      const palm = TrackDecorations.createPalmTree();
      palm.position.set(
        trackWidth / 2 + 20 + Math.random() * 15,
        0,
        Math.random() * CHUNK_LENGTH
      );
      chunk.add(palm);
    }

    // Beach umbrellas on the sand
    if (Math.random() > 0.3) {
      const umbrella = TrackDecorations.createBeachUmbrella();
      umbrella.position.set(
        trackWidth / 2 + 20 + Math.random() * 8,
        0.2,
        Math.random() * CHUNK_LENGTH
      );
      chunk.add(umbrella);
    }

    // Buoys along both track edges — evenly spaced like lane markers
    const buoyInterval = 10;
    for (const side of [-1, 1]) {
      for (let z = buoyInterval / 2; z < CHUNK_LENGTH; z += buoyInterval) {
        const buoy = TrackDecorations.createBuoy();
        buoy.position.set(
          side * (trackWidth / 2 + 2),
          0.0,
          z
        );
        chunk.add(buoy);
      }
    }

    // Extra buoys further out in the ocean (left side)
    if (Math.random() > 0.5) {
      const buoy = TrackDecorations.createBuoy();
      buoy.position.set(
        -(trackWidth / 2 + 8 + Math.random() * 15),
        0.0,
        Math.random() * CHUNK_LENGTH
      );
      chunk.add(buoy);
    }
  }

  private static addAutumnSides(chunk: THREE.Group, trackWidth: number, season: Season) {
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
        const oak = TrackDecorations.createOakTree();
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
        const rock = TrackDecorations.createSideRock(season);
        rock.position.set(
          side * (10 + Math.random() * 12),
          0,
          Math.random() * CHUNK_LENGTH
        );
        chunk.add(rock);
      }
    }
  }

  private static addSpringSides(chunk: THREE.Group, trackWidth: number, baseY: number, season: Season) {
    // High rocky embankments — raised terrain above the water
    const embankMat = new THREE.MeshStandardMaterial({ color: 0x5a6a4a, roughness: 0.85 });
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x4a8a3a, roughness: 0.8 });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x6a6a5a, roughness: 0.95 });
    for (const side of [-1, 1]) {
      // Rocky face along the water edge
      const faceGeo = new THREE.BoxGeometry(1.0, 5, CHUNK_LENGTH);
      const face = new THREE.Mesh(faceGeo, rockMat);
      face.position.set(side * (trackWidth / 2 + 0.8), baseY + 2.5, CHUNK_LENGTH / 2);
      face.castShadow = true;
      chunk.add(face);

      // Raised earth bank right above the rock face
      const bankGeo = new THREE.BoxGeometry(6, 3, CHUNK_LENGTH);
      const bank = new THREE.Mesh(bankGeo, embankMat);
      bank.position.set(side * (trackWidth / 2 + 3.8), baseY + 3.5, CHUNK_LENGTH / 2);
      bank.receiveShadow = true;
      chunk.add(bank);

      // Extended ground plane beyond — wide raised grass terrain
      const outerGeo = new THREE.BoxGeometry(40, 2, CHUNK_LENGTH);
      const outer = new THREE.Mesh(outerGeo, grassMat);
      outer.position.set(side * (trackWidth / 2 + 26), baseY + 4.0, CHUNK_LENGTH / 2);
      outer.receiveShadow = true;
      chunk.add(outer);
    }

    // Rocks along the canyon walls — lots of them
    for (const side of [-1, 1]) {
      const rockCount = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < rockCount; i++) {
        const rock = TrackDecorations.createSideRock(season);
        rock.position.set(
          side * (trackWidth / 2 + 1.5 + Math.random() * 4),
          baseY + 2 + Math.random() * 2,
          Math.random() * CHUNK_LENGTH
        );
        rock.scale.multiplyScalar(0.4 + Math.random() * 0.5);
        chunk.add(rock);
      }
    }

    // Large trees on top of the embankment — many and close to overhang the river
    for (const side of [-1, 1]) {
      const treeCount = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < treeCount; i++) {
        const usePine = Math.random() > 0.5;
        const tree = usePine ? TrackDecorations.createPineTree(season) : TrackDecorations.createSpringDeciduousTree();
        // Place close to the track edge so foliage overhangs the water
        const dist = trackWidth / 2 + 2 + Math.random() * 6;
        tree.position.set(
          side * dist,
          baseY + 4,
          Math.random() * CHUNK_LENGTH
        );
        // Make them large
        tree.scale.multiplyScalar(1.2 + Math.random() * 0.8);
        chunk.add(tree);
      }
    }

    // Spring wildflowers on embankment top
    const flowerColors = [0xff69b4, 0xffdd44, 0x9966cc, 0xffffff, 0xff8888, 0xaa55ff];
    for (const side of [-1, 1]) {
      const flowerCount = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < flowerCount; i++) {
        const color = flowerColors[Math.floor(Math.random() * flowerColors.length)];
        const flowerMat = new THREE.MeshStandardMaterial({ color });
        const flower = new THREE.Mesh(new THREE.SphereGeometry(0.08 + Math.random() * 0.06, 6, 4), flowerMat);
        flower.position.set(
          side * (trackWidth / 2 + 2 + Math.random() * 4),
          baseY + 5.1,
          Math.random() * CHUNK_LENGTH
        );
        chunk.add(flower);
      }
    }
  }
}
