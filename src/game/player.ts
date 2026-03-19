/**
 * player.ts — spider movement, trail management, fuse timer, self-intersection,
 * sand grain particle spawning, and bucket tilt/pitch animation.
 */

import { CROSS_TIME_SECONDS, FUSE_MAX_TIME, GRID_H, GRID_W } from '../constants';
import { Direction, type Dimensions } from '../types';
import { getGridPos, isPerimeter, isSafe } from './grid';
import type { GameState } from './GameState';

export function tickPlayer(
  state: GameState,
  dt: number,
  dims: Dimensions,
  onDeath: () => void,
  onCaptureArea: () => void,
  fuseEnabled: boolean,
): void {
  // ── Bucket tilt/pitch animation ─────────────────────────────────────────
  let targetTilt = 0;
  if (state.spiderDir === Direction.LEFT)  targetTilt =  0.25;
  if (state.spiderDir === Direction.RIGHT) targetTilt = -0.25;

  let targetPitch = 1;
  if (state.spiderDir === Direction.UP)   targetPitch = 1.15;
  if (state.spiderDir === Direction.DOWN) targetPitch = 0.85;

  state.bucketTilt  += (targetTilt  - state.bucketTilt)  * (dt * 12);
  state.bucketPitch += (targetPitch - state.bucketPitch) * (dt * 12);

  // ── Fuse (stall-while-drawing penalty) ──────────────────────────────────
  if (fuseEnabled && state.isTrailing) {
    if (state.spiderDir === Direction.NONE) {
      state.fuseTimer += dt;
      if (state.fuseTimer >= FUSE_MAX_TIME) {
        onDeath();
        return;
      }
    } else {
      state.fuseTimer = 0;
    }
  } else {
    state.fuseTimer = 0;
  }

  if (state.spiderDir === Direction.NONE) return;

  // ── Movement (sub-stepped to avoid tunnelling) ───────────────────────────
  const speed    = dims.fieldWidth / CROSS_TIME_SECONDS;
  const totalDist = speed * dt;
  const numSteps  = Math.ceil(totalDist / 2);
  const stepDist  = totalDist / numSteps;

  for (let step = 0; step < numSteps; step++) {
    let nextX = state.spiderPos.x;
    let nextY = state.spiderPos.y;

    switch (state.spiderDir) {
      case Direction.UP:    nextY -= stepDist; break;
      case Direction.DOWN:  nextY += stepDist; break;
      case Direction.LEFT:  nextX -= stepDist; break;
      case Direction.RIGHT: nextX += stepDist; break;
    }

    // Border clamping
    if (nextX < 0)                  { nextX = 0;                state.spiderDir = Direction.NONE; }
    if (nextX > dims.fieldWidth)    { nextX = dims.fieldWidth;  state.spiderDir = Direction.NONE; }
    if (nextY < 0)                  { nextY = 0;                state.spiderDir = Direction.NONE; }
    if (nextY > dims.fieldHeight)   { nextY = dims.fieldHeight; state.spiderDir = Direction.NONE; }

    const nextPos = { x: nextX, y: nextY };
    const gp = getGridPos(nextPos, dims);
    const currentlySafe = isSafe(state.grid, gp.x, gp.y);

    // Block movement into captured interior — slide perpendicular toward perimeter
    if (state.isOnSafe && currentlySafe && !isPerimeter(state.grid, gp.x, gp.y)) {
      const isHoriz = state.spiderDir === Direction.LEFT || state.spiderDir === Direction.RIGHT;
      let nearestDist = Infinity;
      let nearestSign = 0;

      for (const sign of [-1, 1]) {
        for (let px = 1; px <= 40; px++) {
          const tp = {
            x: state.spiderPos.x + (isHoriz ? 0 : sign * px),
            y: state.spiderPos.y + (isHoriz ? sign * px : 0),
          };
          const tgp = getGridPos(tp, dims);
          if (tgp.x < 0 || tgp.x >= GRID_W || tgp.y < 0 || tgp.y >= GRID_H) break;
          if (!isSafe(state.grid, tgp.x, tgp.y) || isPerimeter(state.grid, tgp.x, tgp.y)) {
            if (px < nearestDist) { nearestDist = px; nearestSign = sign; }
            break;
          }
        }
      }

      if (nearestSign !== 0) {
        const slideDist = Math.min(stepDist, nearestDist);
        const slidePos = {
          x: state.spiderPos.x + (isHoriz ? 0 : nearestSign * slideDist),
          y: state.spiderPos.y + (isHoriz ? nearestSign * slideDist : 0),
        };
        const slideGP = getGridPos(slidePos, dims);
        if (isSafe(state.grid, slideGP.x, slideGP.y)) state.spiderPos = slidePos;
      }
      // Retry from slid position so player automatically rounds corners
      continue;
    }

    if (state.isOnSafe && !currentlySafe) {
      // Leaving safe zone — start drawing
      state.isOnSafe = false;
      state.isTrailing = true;
      state.trail = [state.spiderPos, nextPos];
    } else if (!state.isOnSafe) {
      if (currentlySafe) {
        // Returned to safe zone — close the loop
        state.spiderPos = nextPos;
        if (state.isTrailing) onCaptureArea();
        state.isOnSafe = true;
        state.isTrailing = false;
        state.spiderDir = Direction.NONE;
      } else if (state.isTrailing) {
        // Check self-intersection — non-lethal: trim trail back to hit point
        let hitIndex = -1;
        for (let i = 0; i < state.trail.length - 4; i++) {
          if (Math.hypot(state.trail[i].x - nextX, state.trail[i].y - nextY) < 5) {
            hitIndex = i;
            break;
          }
        }
        if (hitIndex >= 0) {
          state.invalidLoop = state.trail.slice(hitIndex);
          const keepRatio = hitIndex / Math.max(1, state.trail.length);
          const keepCount = Math.ceil(state.trailParticles.length * keepRatio);
          state.trailParticles = state.trailParticles.slice(0, keepCount);
          state.trail = state.trail.slice(0, hitIndex + 1);
          state.spiderPos = { ...state.trail[hitIndex] };
        } else {
          state.invalidLoop = [];
          state.trail.push(nextPos);
        }
      }
    }

    const dx = nextPos.x - state.spiderPos.x;
    const dy = nextPos.y - state.spiderPos.y;

    if (dx !== 0 || dy !== 0) {
      const targetAngle = Math.atan2(dy, dx);
      let diff = targetAngle - state.bucketAngle;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      state.bucketAngle += diff * 0.3;
    }

    state.spiderPos = nextPos;

    // Spawn sand grains along the active trail
    if (state.isTrailing && (dx !== 0 || dy !== 0)) {
      if (Math.random() < 0.6) {
        state.trailParticles.push({
          pos: { x: nextPos.x + (Math.random() - 0.5) * 4, y: nextPos.y + (Math.random() - 0.5) * 4 },
          vel: { x: (Math.random() - 0.5) * 15, y: (Math.random() - 0.5) * 15 },
          color: Math.random() > 0.5 ? '#E8A840' : '#C87A30',
          life: 10,    // lives long to act as the visible trail path
          maxLife: 10,
          size: 1.5 + Math.random() * 2,
        });
      }
    }

    if (state.spiderDir === Direction.NONE) break;
  }
}
