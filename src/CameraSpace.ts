export type CameraSide = 'left' | 'right';

// With the current forward-facing camera, world +X appears on screen-left
// and world -X appears on screen-right.
export function cameraSideX(distanceFromCenter: number, side: CameraSide): number {
  return side === 'left' ? distanceFromCenter : -distanceFromCenter;
}
