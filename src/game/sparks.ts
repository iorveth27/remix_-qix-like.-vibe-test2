/**
 * sparks.ts — Spark enemies: LINE/EDGE patrol + ghost-edge traversal.
 *
 * Normal mode: walks along LINE/EDGE cells. At each junction picks next cell —
 * 'chaser' minimises Manhattan distance to player, 'random' picks randomly.
 * Dead ends trigger a direction reversal.
 *
 * Ghost mode (migrating): spark moves through FILLED cells in a straight line
 * toward a pre-computed target LINE/EDGE cell (set by territory.ts after a
 * capture that isolates the spark). Rendered translucent while migrating.
 */

import { CELL, CROSS_TIME_SECONDS, GRID_H, GRID_W, SPARK_RADIUS, SPARK_SPEED, SPIDER_RADIUS } from '../constants';
import type { Dimensions } from '../types';
import { getGridPos, gridToWorld, isWalkable } from './grid';
import type { GameState } from './GameState';

const DIRS = [
  { x:  0, y: -1 },
  { x:  1, y:  0 },
  { x:  0, y:  1 },
  { x: -1, y:  0 },
];

export function tickSparks(
  state: GameState,
  dt: number,
  dims: Dimensions,
  onDeath: () => void,
): void {
  const baseSpeed  = (dims.fieldWidth / CROSS_TIME_SECONDS) * SPARK_SPEED;
  const sparkSpeed = baseSpeed * (1 + state.capturedPercent * 0.015);

  const playerGP = getGridPos(state.spiderPos, dims);

  for (let si = 0; si < state.sparks.length; si++) {
    let { pos, gx, gy, dir, type, migrating, targetGX, targetGY } = state.sparks[si];
    let remaining = sparkSpeed * dt;

    // ── Ghost mode: move straight toward targetGX/targetGY ─────────────────
    if (migrating) {
      const target = gridToWorld(targetGX, targetGY, dims);
      const ddx = target.x - pos.x, ddy = target.y - pos.y;
      const dist = Math.hypot(ddx, ddy);
      if (dist > 0.5) {
        const step = Math.min(remaining, dist);
        pos = { x: pos.x + (ddx / dist) * step, y: pos.y + (ddy / dist) * step };
      } else {
        // Arrived at target — exit ghost mode
        pos        = { ...target };
        gx         = targetGX;
        gy         = targetGY;
        migrating  = false;
      }
      state.sparks[si] = { pos, gx, gy, dir, type, migrating, targetGX, targetGY };
      continue;
    }

    // ── Normal patrol along LINE/EDGE cells ─────────────────────────────────
    while (remaining > 0) {
      const tgx = gx + dir.x;
      const tgy = gy + dir.y;
      const target = gridToWorld(tgx, tgy, dims);
      const distToTarget = Math.hypot(target.x - pos.x, target.y - pos.y);

      if (distToTarget > 0.5) {
        const step = Math.min(remaining, distToTarget);
        pos = {
          x: pos.x + dir.x * step,
          y: pos.y + dir.y * step,
        };
        remaining -= step;
      } else {
        // Arrived at next cell — snap and pick new direction
        pos = { ...target };
        gx  = tgx;
        gy  = tgy;

        // Gather valid neighbors (walkable, no U-turn)
        const candidates: { x: number; y: number }[] = [];
        for (const d of DIRS) {
          if (d.x === -dir.x && d.y === -dir.y) continue;
          const nx = gx + d.x, ny = gy + d.y;
          if (isWalkable(state.grid, nx, ny)) candidates.push(d);
        }

        if (candidates.length === 0) {
          // Try U-turn (reversal)
          for (const d of DIRS) {
            const nx = gx + d.x, ny = gy + d.y;
            if (isWalkable(state.grid, nx, ny)) candidates.push(d);
          }
        }

        if (candidates.length === 0) {
          // Completely isolated — BFS through non-EMPTY cells, send to walkable
          // cell farthest from player to avoid spawning right on top of them.
          const bfsV = new Uint8Array(GRID_W * GRID_H);
          const bfsQ: [number, number][] = [[gx, gy]];
          bfsV[gy * GRID_W + gx] = 1;
          let bestGX = -1, bestGY = -1, bestDist = -1;
          while (bfsQ.length > 0) {
            const [bx, by] = bfsQ.shift()!;
            for (const d of DIRS) {
              const nx = bx + d.x, ny = by + d.y;
              if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
              if (bfsV[ny * GRID_W + nx]) continue;
              bfsV[ny * GRID_W + nx] = 1;
              if (isWalkable(state.grid, nx, ny)) {
                const dist = Math.abs(nx - playerGP.x) + Math.abs(ny - playerGP.y);
                if (dist > bestDist) { bestDist = dist; bestGX = nx; bestGY = ny; }
              }
              if (state.grid[ny * GRID_W + nx] !== CELL.EMPTY) bfsQ.push([nx, ny]);
            }
          }
          if (bestGX >= 0) { migrating = true; targetGX = bestGX; targetGY = bestGY; }
          remaining = 0;
          break;
        }

        // Pick next direction
        if (type === 'chaser') {
          let bestDist = Infinity;
          let bestDir  = candidates[0];
          for (const d of candidates) {
            const dist = Math.abs((gx + d.x) - playerGP.x) + Math.abs((gy + d.y) - playerGP.y);
            if (dist < bestDist) { bestDist = dist; bestDir = d; }
          }
          dir = bestDir;
        } else {
          dir = candidates[Math.floor(Math.random() * candidates.length)];
        }
      }
    }

    state.sparks[si] = { pos, gx, gy, dir, type, migrating, targetGX, targetGY };
  }

  // Spark–spark collision: reverse directions
  if (state.sparks.length >= 2) {
    const s0 = state.sparks[0];
    const s1 = state.sparks[1];
    if (!s0.migrating && !s1.migrating &&
        Math.hypot(s0.pos.x - s1.pos.x, s0.pos.y - s1.pos.y) < SPARK_RADIUS * 2) {
      state.sparks[0] = { ...s0, dir: { x: -s0.dir.x, y: -s0.dir.y } };
      state.sparks[1] = { ...s1, dir: { x: -s1.dir.x, y: -s1.dir.y } };
    }
  }

  // Spark–player collision (only when player is on border, with i-frame protection)
  if (state.playerOnBorder && state.damageFlash <= 0) {
    for (const spark of state.sparks) {
      if (spark.migrating) continue; // ghost sparks don't hurt
      if (Math.hypot(spark.pos.x - state.spiderPos.x, spark.pos.y - state.spiderPos.y) < SPARK_RADIUS + SPIDER_RADIUS) {
        onDeath();
        return;
      }
    }
  }
}
