/**
 * player.ts — spider movement, trail management, fuse timer,
 * sand grain particle spawning, and bucket tilt/pitch animation.
 *
 * Walking rules:
 *  - On border (playerOnBorder): may only enter LINE/EDGE cells, or EMPTY (starts drawing).
 *  - Drawing (playerDrawing): marks EMPTY cells as NEWLINE; returning to LINE/EDGE closes trail.
 *  - Touching a NEWLINE cell while drawing = lethal self-intersection.
 */

import { CELL, CROSS_TIME_SECONDS, FUSE_MAX_TIME, GRID_H, GRID_W } from '../constants';
import { Direction, type Dimensions } from '../types';
import { getGridPos, isEmptyCell, isTrailCell, isWalkable } from './grid';
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
  if (fuseEnabled && state.playerDrawing) {
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
  const speed     = dims.fieldWidth / CROSS_TIME_SECONDS;
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
    if (nextX < 0)                { nextX = 0;                state.spiderDir = Direction.NONE; }
    if (nextX > dims.fieldWidth)  { nextX = dims.fieldWidth;  state.spiderDir = Direction.NONE; }
    if (nextY < 0)                { nextY = 0;                state.spiderDir = Direction.NONE; }
    if (nextY > dims.fieldHeight) { nextY = dims.fieldHeight; state.spiderDir = Direction.NONE; }

    const nextPos = { x: nextX, y: nextY };
    const nextGP  = getGridPos(nextPos, dims);
    const currGP  = getGridPos(state.spiderPos, dims);

    if (state.playerOnBorder) {
      if (isWalkable(state.grid, nextGP.x, nextGP.y)) {
        // Normal walking along LINE/EDGE border
        state.spiderPos = nextPos;
      } else if (isEmptyCell(state.grid, nextGP.x, nextGP.y)) {
        // Stepping off border into void — begin drawing
        state.playerOnBorder = false;
        state.playerDrawing  = true;
        state.trail          = [{ ...state.spiderPos }, nextPos];
        state.grid[nextGP.y * GRID_W + nextGP.x] = CELL.NEWLINE;
        state.spiderPos = nextPos;
      } else {
        // FILLED or out-of-bounds — slide perpendicular toward nearest walkable
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
            if (isWalkable(state.grid, tgp.x, tgp.y)) {
              if (px < nearestDist) { nearestDist = px; nearestSign = sign; }
              break;
            }
            // Don't slide into EMPTY — that would start drawing unintentionally
            if (isEmptyCell(state.grid, tgp.x, tgp.y)) break;
          }
        }

        if (nearestSign !== 0) {
          const slideDist = Math.min(stepDist, nearestDist);
          const slidePos = {
            x: state.spiderPos.x + (isHoriz ? 0 : nearestSign * slideDist),
            y: state.spiderPos.y + (isHoriz ? nearestSign * slideDist : 0),
          };
          const slideGP = getGridPos(slidePos, dims);
          if (isWalkable(state.grid, slideGP.x, slideGP.y)) state.spiderPos = slidePos;
        }
        continue; // retry from slid position
      }
    } else if (state.playerDrawing) {
      if (isTrailCell(state.grid, nextGP.x, nextGP.y)) {
        if (nextGP.x !== currGP.x || nextGP.y !== currGP.y) {
          // Non-lethal self-intersection — find loop start in trail, trim it off
          let loopStartIdx = -1;
          for (let ti = 1; ti < state.trail.length; ti++) {
            const tgp = getGridPos(state.trail[ti], dims);
            if (tgp.x === nextGP.x && tgp.y === nextGP.y) { loopStartIdx = ti; break; }
          }
          if (loopStartIdx !== -1) {
            // Revert the loop's grid cells back to EMPTY (keep intersection cell as NEWLINE)
            for (let ti = loopStartIdx + 1; ti < state.trail.length; ti++) {
              const tgp = getGridPos(state.trail[ti], dims);
              if (state.grid[tgp.y * GRID_W + tgp.x] === CELL.NEWLINE) {
                state.grid[tgp.y * GRID_W + tgp.x] = CELL.EMPTY;
              }
            }
            state.invalidLoop      = state.trail.slice(loopStartIdx);
            state.invalidLoopTimer = 1.5;
            state.trail            = state.trail.slice(0, loopStartIdx + 1);
          }
          state.spiderPos = nextPos;
          continue;
        }
        // Still inside the same grid cell we already marked — just advance world pos
        state.spiderPos = nextPos;
      } else if (isWalkable(state.grid, nextGP.x, nextGP.y)) {
        // Closed trail — trigger territory capture
        state.trail.push(nextPos);
        state.spiderPos = nextPos;
        onCaptureArea();
        state.playerOnBorder = true;
        state.playerDrawing  = false;
        state.spiderDir      = Direction.NONE;
        break;
      } else if (isEmptyCell(state.grid, nextGP.x, nextGP.y)) {
        // Continue drawing through EMPTY space
        state.grid[nextGP.y * GRID_W + nextGP.x] = CELL.NEWLINE;
        state.trail.push(nextPos);
        state.spiderPos = nextPos;
      } else {
        // FILLED cell or out-of-bounds while drawing — stop
        state.spiderDir = Direction.NONE;
        break;
      }
    }

    // Bucket heading angle (smooth toward movement direction)
    const adx = state.spiderPos.x - nextPos.x;
    const ady = state.spiderPos.y - nextPos.y;
    if (adx !== 0 || ady !== 0) {
      const targetAngle = Math.atan2(-ady, -adx);
      let diff = targetAngle - state.bucketAngle;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      state.bucketAngle += diff * 0.3;
    }

    // Spawn sand grains along the active trail
    if (state.playerDrawing) {
      if (Math.random() < 0.6) {
        state.trailParticles.push({
          pos: { x: state.spiderPos.x + (Math.random() - 0.5) * 4, y: state.spiderPos.y + (Math.random() - 0.5) * 4 },
          vel: { x: (Math.random() - 0.5) * 15, y: (Math.random() - 0.5) * 15 },
          color: Math.random() > 0.5 ? '#E8A840' : '#C87A30',
          life: 10,
          maxLife: 10,
          size: 1.5 + Math.random() * 2,
        });
      }
    }

    if (state.spiderDir === Direction.NONE) break;
  }
}
