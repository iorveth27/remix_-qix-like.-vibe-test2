/**
 * sparks.ts — Spark enemy: ghost-edge traversal, perimeter patrol,
 * junction direction picking, spark–spark and spark–player collisions.
 *
 * Ghost Edge Traversal (migrating === true):
 *   When territory is captured, a displaced spark does NOT teleport.  It
 *   continues its current trajectory along the internalized seam lines.
 *   Only when it reaches a vertex (no more seam in the forward direction)
 *   does it jump to the nearest active perimeter cell and resume normal patrol.
 */

import { CROSS_TIME_SECONDS, GRID_H, GRID_W, SPARK_RADIUS, SPARK_SPEED, SPIDER_RADIUS } from '../constants';
import type { Dimensions, Point } from '../types';
import { getGridPos, gridToWorld, isPerimeter, isSeamAdjacent, isSafe } from './grid';
import type { GameState } from './GameState';

const rotateCW  = (d: Point): Point => ({ x: -d.y, y:  d.x });
const rotateCCW = (d: Point): Point => ({ x:  d.y, y: -d.x });

/** Scan all grid cells and return the world-space position of the perimeter
 *  cell closest (Euclidean) to `from`.  Returns null if none exist. */
function nearestPerimeterPos(grid: Uint8Array, from: Point, dims: Dimensions): Point | null {
  let bestDist = Infinity;
  let bestPos: Point | null = null;
  for (let gy = 0; gy < GRID_H; gy++) {
    for (let gx = 0; gx < GRID_W; gx++) {
      if (!isPerimeter(grid, gx, gy)) continue;
      const wp   = gridToWorld(gx, gy, dims);
      const dist = Math.hypot(wp.x - from.x, wp.y - from.y);
      if (dist < bestDist) { bestDist = dist; bestPos = wp; }
    }
  }
  return bestPos;
}

export function tickSparks(
  state: GameState,
  dt: number,
  dims: Dimensions,
  onDeath: () => void,
): void {
  const { fieldWidth: fw, fieldHeight: fh } = dims;
  const baseSpeed  = (fw / CROSS_TIME_SECONDS) * SPARK_SPEED;
  const sparkSpeed = baseSpeed * (1 + state.capturedPercent * 0.015);

  // While player is drawing, sparks chase the trail entry point (last safe position)
  const sparkTarget = state.isTrailing && state.trail.length > 0
    ? state.trail[0]
    : state.spiderPos;

  for (let si = 0; si < state.sparks.length; si++) {
    let { pos, dir, rotation, migrating, migrateTarget, migratePath } = state.sparks[si];
    let remaining = sparkSpeed * dt;

    while (remaining > 0) {
      const step = Math.min(remaining, 2);
      remaining -= step;

      if (migrating) {
        // ── Ghost Edge Traversal ──────────────────────────────────────────
        // Continue in the current direction along the internalized seam line.
        // On reaching a vertex (no seam ahead), jump to nearest active perimeter.
        const tryPos = {
          x: Math.max(0, Math.min(fw, pos.x + dir.x * step)),
          y: Math.max(0, Math.min(fh, pos.y + dir.y * step)),
        };
        const tryGP = getGridPos(tryPos, dims);

        if (isSafe(state.grid, tryGP.x, tryGP.y) && isPerimeter(state.grid, tryGP.x, tryGP.y)) {
          // Reached the active perimeter — resume normal patrol
          pos       = tryPos;
          migrating = false;
        } else if (isSafe(state.grid, tryGP.x, tryGP.y) &&
                   isSeamAdjacent(state.seamsH, state.seamsV, tryGP.x, tryGP.y)) {
          // Still on an internalized seam line — keep going
          pos = tryPos;
        } else {
          // Vertex reached (seam ended or field edge hit).
          // Jump instantly to the nearest active perimeter cell.
          const jump = nearestPerimeterPos(state.grid, pos, dims);
          if (jump) pos = jump;
          migrating = false;
          remaining = 0; // Stop advancing this tick after the jump
        }
      } else {
        // ── Normal perimeter patrol ───────────────────────────────────────
        const tryPos = {
          x: Math.max(0, Math.min(fw, pos.x + dir.x * step)),
          y: Math.max(0, Math.min(fh, pos.y + dir.y * step)),
        };
        const tryGP  = getGridPos(tryPos, dims);
        const didMove = tryPos.x !== pos.x || tryPos.y !== pos.y;

        if (didMove && isSafe(state.grid, tryGP.x, tryGP.y) && isPerimeter(state.grid, tryGP.x, tryGP.y)) {
          pos = tryPos;
        } else {
          // Junction: pick direction using rotation preference + shortest arc to player.
          const backward = { x: -dir.x, y: -dir.y };
          const rotTurn  = rotation === 1 ? rotateCW(dir)  : rotateCCW(dir);
          const antiTurn = rotation === 1 ? rotateCCW(dir) : rotateCW(dir);
          const priority = [rotTurn, dir, antiTurn, backward];

          const candidates: { d: Point; dist: number; priority: number }[] = [];
          for (let pi = 0; pi < priority.length; pi++) {
            const d    = priority[pi];
            const cPos = {
              x: Math.max(0, Math.min(fw, pos.x + d.x * 6)),
              y: Math.max(0, Math.min(fh, pos.y + d.y * 6)),
            };
            if (cPos.x === pos.x && cPos.y === pos.y) continue;
            const cGP = getGridPos(cPos, dims);
            if (!isSafe(state.grid, cGP.x, cGP.y) || !isPerimeter(state.grid, cGP.x, cGP.y)) continue;
            candidates.push({ d, dist: Math.hypot(cPos.x - sparkTarget.x, cPos.y - sparkTarget.y), priority: pi });
          }

          let bestDir: Point;
          if (candidates.length === 0) {
            bestDir = backward;
          } else if (candidates.length === 1) {
            bestDir = candidates[0].d;
          } else {
            // Bias strongly toward rotation preference unless other arc is >15% closer
            candidates.sort((a, b) => a.priority - b.priority);
            const rot  = candidates[0];
            const best = candidates.reduce((a, b) => b.dist < a.dist ? b : a);
            bestDir = best.dist < rot.dist * 0.85 ? best.d : rot.d;
          }

          if      (bestDir.x === rotateCW(dir).x  && bestDir.y === rotateCW(dir).y)  rotation = 1;
          else if (bestDir.x === rotateCCW(dir).x && bestDir.y === rotateCCW(dir).y) rotation = -1;

          dir = bestDir;
          const newPos = {
            x: Math.max(0, Math.min(fw, pos.x + dir.x * step)),
            y: Math.max(0, Math.min(fh, pos.y + dir.y * step)),
          };
          const newGP = getGridPos(newPos, dims);
          if (isSafe(state.grid, newGP.x, newGP.y) && isPerimeter(state.grid, newGP.x, newGP.y)) pos = newPos;
        }
      }
    }

    state.sparks[si] = { pos, dir, rotation, migrating, migrateTarget, migratePath };
  }

  // Spark–spark collision: reverse direction
  if (state.sparks.length >= 2) {
    const s0 = state.sparks[0];
    const s1 = state.sparks[1];
    if (Math.hypot(s0.pos.x - s1.pos.x, s0.pos.y - s1.pos.y) < SPARK_RADIUS * 2) {
      state.sparks[0] = { ...s0, dir: { x: -s0.dir.x, y: -s0.dir.y } };
      state.sparks[1] = { ...s1, dir: { x: -s1.dir.x, y: -s1.dir.y } };
    }
  }

  // Spark–player collision (only on boundary, with i-frames after damage)
  if (state.isOnSafe && state.damageFlash <= 0) {
    for (const spark of state.sparks) {
      if (spark.migrating) continue; // ghost sparks don't hurt
      if (Math.hypot(spark.pos.x - state.spiderPos.x, spark.pos.y - state.spiderPos.y) < SPARK_RADIUS + SPIDER_RADIUS) {
        onDeath();
        break;
      }
    }
  }
}
