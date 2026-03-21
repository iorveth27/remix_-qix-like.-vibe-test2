/**
 * territory.ts — fillCapturedArea: dual-seed BFS fill.
 *
 * Algorithm:
 *  1. Bresenham-stamp any trail gaps as NEWLINE.
 *  2. Two BFS from seeds perpendicular to player's last direction.
 *  3. Overlap check: if region1 + region2 > totalEmpty, both seeds are in
 *     the same connected component (trail too short to divide the field).
 *     In that case, revert NEWLINE→EMPTY and return 0 (no capture).
 *  4. Fill the smaller enclosed region with FILLED; NEWLINE→LINE.
 *  5. Rescue trapped QIX and set up ghost traversal for isolated sparks.
 */

import { CELL, GRID_H, GRID_W } from '../constants';
import { Direction, type Dimensions } from '../types';
import { getGridPos, gridToWorld, isEmptyCell, isWalkable } from './grid';
import type { GameState } from './GameState';

const DIRS4 = [[-1,0],[1,0],[0,-1],[0,1]] as [number,number][];

export function fillCapturedArea(state: GameState, dims: Dimensions): number {
  const { grid, trail, particles, floatingTexts } = state;

  // ── 1. Bresenham-stamp trail gaps as NEWLINE ─────────────────────────────
  for (let ti = 1; ti < trail.length; ti++) {
    const p0 = getGridPos(trail[ti - 1], dims);
    const p1 = getGridPos(trail[ti],     dims);
    let x = p0.x, y = p0.y;
    const dx = Math.abs(p1.x - p0.x), sx = p0.x < p1.x ? 1 : -1;
    const dy = -Math.abs(p1.y - p0.y), sy = p0.y < p1.y ? 1 : -1;
    let err = dx + dy;
    while (true) {
      if (x >= 0 && x < GRID_W && y >= 0 && y < GRID_H) {
        if (grid[y * GRID_W + x] === CELL.EMPTY) grid[y * GRID_W + x] = CELL.NEWLINE;
      }
      if (x === p1.x && y === p1.y) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      else          { err += dx; y += sy; }
    }
  }

  // ── 2. Compute seed positions based on player's last direction ────────────
  const cp = getGridPos(state.spiderPos, dims);
  const cx = cp.x, cy = cp.y;

  let seed1 = { x: -1, y: -1 }, seed2 = { x: -1, y: -1 };
  switch (state.spiderDir) {
    case Direction.LEFT:
      seed1 = { x: cx + 1, y: cy - 1 };
      seed2 = { x: cx + 1, y: cy + 1 };
      break;
    case Direction.RIGHT:
      seed1 = { x: cx - 1, y: cy - 1 };
      seed2 = { x: cx - 1, y: cy + 1 };
      break;
    case Direction.UP:
      seed1 = { x: cx - 1, y: cy + 1 };
      seed2 = { x: cx + 1, y: cy + 1 };
      break;
    case Direction.DOWN:
      seed1 = { x: cx - 1, y: cy - 1 };
      seed2 = { x: cx + 1, y: cy - 1 };
      break;
    default:
      seed1 = { x: cx + 1, y: cy };
      seed2 = { x: cx - 1, y: cy };
      break;
  }

  // ── 3. BFS from each seed through EMPTY cells ────────────────────────────
  const bfsEmpty = (sx: number, sy: number): number[] => {
    if (sx < 0 || sx >= GRID_W || sy < 0 || sy >= GRID_H) return [];
    if (!isEmptyCell(grid, sx, sy)) return [];

    const visited = new Uint8Array(GRID_W * GRID_H);
    const queue: [number, number][] = [[sx, sy]];
    const cells: number[] = [];
    visited[sy * GRID_W + sx] = 1;

    while (queue.length > 0) {
      const [qx, qy] = queue.shift()!;
      cells.push(qy * GRID_W + qx);
      for (const [ddx, ddy] of DIRS4) {
        const nx = qx + ddx, ny = qy + ddy;
        if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
        if (visited[ny * GRID_W + nx]) continue;
        if (!isEmptyCell(grid, nx, ny)) continue;
        visited[ny * GRID_W + nx] = 1;
        queue.push([nx, ny]);
      }
    }
    return cells;
  };

  const region1 = bfsEmpty(seed1.x, seed1.y);
  const region2 = bfsEmpty(seed2.x, seed2.y);

  // ── 4. Overlap check — detect degenerate (non-enclosing) trail ───────────
  let totalEmpty = 0;
  for (let i = 0; i < GRID_W * GRID_H; i++) {
    if (grid[i] === CELL.EMPTY) totalEmpty++;
  }

  // If both seeds are in the same connected component their counts sum > totalEmpty.
  // Also guard the single-valid-seed case: if the only valid region covers > 50%
  // of empty space it is the exterior, not an enclosed area.
  const r1ok = region1.length > 0;
  const r2ok = region2.length > 0;
  const overlap = region1.length + region2.length > totalEmpty;

  let toFill: number[] = [];
  if (r1ok && r2ok && !overlap) {
    // Valid partition — fill the smaller enclosed region
    toFill = region1.length <= region2.length ? region1 : region2;
  } else if (r1ok && !r2ok && region1.length <= totalEmpty * 0.5) {
    toFill = region1; // seed2 was on NEWLINE/invalid; r1 is the enclosed area
  } else if (r2ok && !r1ok && region2.length <= totalEmpty * 0.5) {
    toFill = region2;
  }
  // else: degenerate trail (both seeds in same component, or both invalid) → fill nothing

  if (toFill.length === 0) {
    // No meaningful enclosure — revert NEWLINE→EMPTY and bail out
    for (let i = 0; i < GRID_W * GRID_H; i++) {
      if (grid[i] === CELL.NEWLINE) grid[i] = CELL.EMPTY;
    }
    state.trail          = [];
    state.invalidLoop    = [];
    state.playerOnBorder = true;
    state.playerDrawing  = false;
    state.fuseTimer      = 0;
    state.trailParticles = [];
    return 0;
  }

  // ── 5. Apply fill ─────────────────────────────────────────────────────────
  for (const idx of toFill) {
    grid[idx] = CELL.FILLED;
  }

  // ── 6. Convert NEWLINE → LINE ────────────────────────────────────────────
  for (let i = 0; i < GRID_W * GRID_H; i++) {
    if (grid[i] === CELL.NEWLINE) grid[i] = CELL.LINE;
  }

  // ── 7. Ghost-edge traversal: sparks isolated by the new capture ──────────
  const playerGP = getGridPos(state.spiderPos, dims);
  for (const spark of state.sparks) {
    if (spark.migrating) continue; // already in ghost mode
    if (isWalkable(grid, spark.gx, spark.gy)) continue; // still on active border — fine
    // Spark is stranded: BFS through non-EMPTY cells to find all reachable walkable
    // cells, then send it to the one farthest from the player (avoids instant death).
    const bv  = new Uint8Array(GRID_W * GRID_H);
    const bq: [number, number][] = [[spark.gx, spark.gy]];
    bv[spark.gy * GRID_W + spark.gx] = 1;
    let bestGX = -1, bestGY = -1, bestDist = -1;
    while (bq.length > 0) {
      const [bx, by] = bq.shift()!;
      for (const [ddx, ddy] of DIRS4) {
        const nx = bx + ddx, ny = by + ddy;
        if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
        if (bv[ny * GRID_W + nx]) continue;
        bv[ny * GRID_W + nx] = 1;
        if (isWalkable(grid, nx, ny)) {
          const d = Math.abs(nx - playerGP.x) + Math.abs(ny - playerGP.y);
          if (d > bestDist) { bestDist = d; bestGX = nx; bestGY = ny; }
        }
        if (grid[ny * GRID_W + nx] !== CELL.EMPTY) bq.push([nx, ny]);
      }
    }
    if (bestGX >= 0) {
      spark.migrating = true;
      spark.targetGX  = bestGX;
      spark.targetGY  = bestGY;
    }
  }

  // ── 8. Handle QIX entities trapped in non-EMPTY territory ────────────────
  for (const entity of state.qixEntities) {
    const qixGP = getGridPos(entity.pos, dims);
    if (!isEmptyCell(grid, qixGP.x, qixGP.y)) {
      const qbfs = new Uint8Array(GRID_W * GRID_H);
      const qqueue: [number, number][] = [[qixGP.x, qixGP.y]];
      qbfs[qixGP.y * GRID_W + qixGP.x] = 1;
      let rescued = false;
      while (qqueue.length > 0 && !rescued) {
        const [qx, qy] = qqueue.shift()!;
        for (const [ddx, ddy] of DIRS4) {
          const nx = qx + ddx, ny = qy + ddy;
          if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
          if (qbfs[ny * GRID_W + nx]) continue;
          qbfs[ny * GRID_W + nx] = 1;
          if (isEmptyCell(grid, nx, ny)) {
            entity.pos     = gridToWorld(nx, ny, dims);
            entity.lastPos = { ...entity.pos };
            rescued = true;
            break;
          }
          qqueue.push([nx, ny]);
        }
      }
    }
  }

  // ── 9. Count captured cells, emit effects, reset drawing state ───────────
  let filledCount = 0;
  for (let i = 0; i < GRID_W * GRID_H; i++) {
    if (grid[i] === CELL.FILLED || grid[i] === CELL.LINE) filledCount++;
  }
  const newPercent       = Math.floor((filledCount / (GRID_W * GRID_H)) * 100);
  const capturedThisTime = newPercent - state.capturedPercent;

  if (capturedThisTime > 0) {
    state.captureFlash        = 0.6;
    state.captureWaveProgress = 0;

    trail.forEach((p, idx) => {
      if (idx % 2 === 0) {
        for (let i = 0; i < 2; i++) {
          const rc = Math.random();
          particles.push({
            pos:  { ...p },
            vel:  { x: (Math.random() - 0.5) * 120, y: (Math.random() - 0.5) * 120 },
            color: rc > 0.6 ? '#E8A840' : rc > 0.3 ? '#C87A30' : '#F5D080',
            life: 0.4 + Math.random() * 0.6,
            maxLife: 1,
            size: 1.5 + Math.random() * 3,
          });
        }
      }
    });

    // Score floating text is pushed by App.tsx (which knows the exponential formula)
  }

  state.capturedPercent = newPercent;
  if (capturedThisTime > 0) state.gridVersion++;
  state.trail           = [];
  state.invalidLoop     = [];
  state.playerOnBorder  = true;
  state.playerDrawing   = false;
  state.fuseTimer       = 0;
  state.trailParticles  = [];

  return capturedThisTime;
}
