/**
 * qix.ts — Qix (boss) bouncing movement and collision detection.
 */

import { QIX_RADIUS, SPIDER_RADIUS } from '../constants';
import type { Dimensions } from '../types';
import { getGridPos, isSafe } from './grid';
import type { GameState } from './GameState';

export function tickQix(
  state: GameState,
  dt: number,
  dims: Dimensions,
  onDeath: () => void,
): void {
  const speed = Math.hypot(state.qixVel.x, state.qixVel.y);
  let nextQx = state.qixPos.x + state.qixVel.x * dt;
  let nextQy = state.qixPos.y + state.qixVel.y * dt;

  // Bounce off safe zones and field edges (check each axis separately)
  const gpX = getGridPos({ x: nextQx, y: state.qixPos.y }, dims);
  const gpY = getGridPos({ x: state.qixPos.x, y: nextQy }, dims);
  const hitX = nextQx < 0 || nextQx > dims.fieldWidth  || isSafe(state.grid, gpX.x, gpX.y);
  const hitY = nextQy < 0 || nextQy > dims.fieldHeight || isSafe(state.grid, gpY.x, gpY.y);

  if (hitX) {
    state.qixVel.x = -state.qixVel.x;
    nextQx = state.qixPos.x + state.qixVel.x * dt;
  }
  if (hitY) {
    state.qixVel.y = -state.qixVel.y;
    nextQy = state.qixPos.y + state.qixVel.y * dt;
  }

  // If still stuck (corner), reverse both and hold position
  const finalGP = getGridPos({ x: nextQx, y: nextQy }, dims);
  if (isSafe(state.grid, finalGP.x, finalGP.y)) {
    state.qixVel.x = -state.qixVel.x;
    state.qixVel.y = -state.qixVel.y;
    nextQx = state.qixPos.x;
    nextQy = state.qixPos.y;
  }

  // Re-normalise speed in case of floating-point drift
  const currentSpeed = Math.hypot(state.qixVel.x, state.qixVel.y);
  if (currentSpeed > 0 && Math.abs(currentSpeed - speed) > 1) {
    state.qixVel.x = (state.qixVel.x / currentSpeed) * speed;
    state.qixVel.y = (state.qixVel.y / currentSpeed) * speed;
  }

  state.qixPos = { x: nextQx, y: nextQy };

  // Collision detection (only while player is drawing a trail)
  if (state.isTrailing) {
    const qixHitsTrail = state.trail.some(p =>
      Math.hypot(p.x - state.qixPos.x, p.y - state.qixPos.y) < QIX_RADIUS + 3,
    );
    const qixHitsSpider =
      Math.hypot(state.spiderPos.x - state.qixPos.x, state.spiderPos.y - state.qixPos.y) <
      QIX_RADIUS + SPIDER_RADIUS;

    if (qixHitsTrail || qixHitsSpider) onDeath();
  }
}
