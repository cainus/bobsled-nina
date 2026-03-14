/**
 * Stores lane height segments that scroll with the track.
 * Each segment defines the height for a lane over a Z range.
 */

export interface LaneSegment {
  /** World-Z start (scrolls with track) */
  startZ: number;
  /** World-Z end */
  endZ: number;
  /** Height at start */
  startY: number;
  /** Height at end */
  endY: number;
  /** Lane index: -1, 0, 1 */
  lane: number;
}

export class LaneHeightMap {
  segments: LaneSegment[] = [];

  /** Add a segment */
  add(seg: LaneSegment) {
    this.segments.push(seg);
  }

  /** Get the ground height for a lane at a given world Z */
  getHeight(lane: number, worldZ: number): number {
    for (const seg of this.segments) {
      if (seg.lane !== lane) continue;
      if (worldZ >= seg.startZ && worldZ <= seg.endZ) {
        const t = (worldZ - seg.startZ) / (seg.endZ - seg.startZ);
        return seg.startY + (seg.endY - seg.startY) * t;
      }
    }
    return 0; // default ground level
  }

  /** Check if a lane is on an upward ramp at a given world Z */
  isUpRamp(lane: number, worldZ: number): boolean {
    for (const seg of this.segments) {
      if (seg.lane !== lane) continue;
      if (worldZ >= seg.startZ && worldZ <= seg.endZ) {
        return seg.endY > seg.startY;
      }
    }
    return false;
  }

  /** Scroll all segments by an amount (track moves toward player) */
  scroll(amount: number) {
    for (const seg of this.segments) {
      seg.startZ -= amount;
      seg.endZ -= amount;
    }
    // Remove segments fully behind the camera
    this.segments = this.segments.filter(s => s.endZ > -30);
  }

  reset() {
    this.segments = [];
  }
}
