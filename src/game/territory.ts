/**
 * territory.ts — fillCapturedArea: outer-border flood fill.
 *
 * Algorithm:
 *  1. Bresenham-stamp any trail gaps as NEWLINE.
 *  2. BFS to enumerate all connected EMPTY components.
 *  3. Identify outside via QIX position (QIX levels) or largest component (no QIX).
 *     All other components are enclosed → FILLED.
 *  4. NEWLINE → LINE.
 *  5. Rescue trapped QIX; set up ghost traversal for isolated sparks.
 */

import { CELL, GRID_H, GRID_W } from '../constants';
import { type Dimensions } from '../types';
import { getGridPos, gridToWorld, isEmptyCell, isWalkable } from './grid';
import type { GameState } from './GameState';

const DIRS4 = [[-1,0],[1,0],[0,-1],[0,1]] as [number,number][];

export function fillCapturedArea(state: GameState, dims: Dimensions): number {
  const { grid, trail, particles } = state;

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

  // ── 2. Find all connected EMPTY components ───────────────────────────────
  // After stamping NEWLINE, the open field splits into connected regions.
  // We enumerate ALL of them via BFS so we can identify inside vs outside.
  const compId = new Int32Array(GRID_W * GRID_H).fill(-1);
  const components: number[][] = [];

  for (let start = 0; start < GRID_W * GRID_H; start++) {
    if (grid[start] !== CELL.EMPTY || compId[start] >= 0) continue;
    const cid = components.length;
    const comp: number[] = [];
    const q = [start];
    compId[start] = cid;
    while (q.length > 0) {
      const idx = q.shift()!;
      comp.push(idx);
      const qx = idx % GRID_W, qy = (idx / GRID_W) | 0;
      for (const [ddx, ddy] of DIRS4) {
        const nx = qx + ddx, ny = qy + ddy;
        if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
        const ni = ny * GRID_W + nx;
        if (grid[ni] !== CELL.EMPTY || compId[ni] >= 0) continue;
        compId[ni] = cid;
        q.push(ni);
      }
    }
    components.push(comp);
  }

  // ── 3. Identify the "outside" component ──────────────────────────────────
  // Trail didn't split the field at all → bail out.
  if (components.length <= 1) {
    for (let i = 0; i < GRID_W * GRID_H; i++) {
      if (grid[i] === CELL.NEWLINE) grid[i] = CELL.EMPTY;
    }
    state.trail          = [];
    state.invalidLoop    = [];
    state.playerOnBorder = true;
    state.playerDrawing  = false;
    state.trailParticles = [];
    return 0;
  }

  // When QIX entities exist, use their grid positions to identify which
  // component is the open field. QIX always lives in EMPTY space; whichever
  // component contains a QIX is the outside — even when the player encloses
  // more than 50% of the field (making the inside larger than the outside).
  // Fall back to "largest component = outside" for levels without QIX (1 & 2),
  // where captures are small enough that largest reliably equals the open field.
  let outsideCid: number;

  const aliveQix = state.qixEntities.filter(e => !e.dead);
  if (aliveQix.length > 0) {
    let foundCid = -1;
    for (const entity of aliveQix) {
      const gp = getGridPos(entity.pos, dims);
      const cid = compId[gp.y * GRID_W + gp.x];
      if (cid >= 0) { foundCid = cid; break; }
    }
    // If QIX landed on a NEWLINE cell (extremely rare) fall back to largest.
    if (foundCid < 0) {
      foundCid = 0;
      for (let i = 1; i < components.length; i++) {
        if (components[i].length > components[foundCid].length) foundCid = i;
      }
    }
    outsideCid = foundCid;
  } else if (aliveQix.length === 0 && state.qixEntities.length > 0) {
    // All QIX dead — fall back to largest component
    outsideCid = 0;
    for (let i = 1; i < components.length; i++) {
      if (components[i].length > components[outsideCid].length) outsideCid = i;
    }
  } else {
    // No QIX — largest component is the open field.
    outsideCid = 0;
    for (let i = 1; i < components.length; i++) {
      if (components[i].length > components[outsideCid].length) outsideCid = i;
    }
  }

  // ── 4. Fill every component that is not the outside ──────────────────────
  for (let i = 0; i < components.length; i++) {
    if (i === outsideCid) continue;
    for (const idx of components[i]) grid[idx] = CELL.FILLED;
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

  // ── 8. Kill QIX entities enclosed in captured territory ──────────────────
  for (const entity of state.qixEntities.filter(e => !e.dead)) {
    const qixGP = getGridPos(entity.pos, dims);
    if (!isEmptyCell(grid, qixGP.x, qixGP.y)) {
      entity.dead = true;
      entity.respawnTimer = 5;
      entity.trail = [];
      // Burst particles
      for (let ei = 0; ei < 60; ei++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 40 + Math.random() * 120;
        const r = Math.random();
        state.particles.push({
          pos: { ...entity.pos },
          vel: { x: Math.cos(a) * spd, y: Math.sin(a) * spd },
          color: r > 0.5 ? '#ff6644' : r > 0.25 ? '#ffaa22' : '#ffffff',
          life: 0.4 + Math.random() * 0.5,
          maxLife: 1,
          size: 2 + Math.random() * 3,
        });
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
  state.trailParticles  = [];

  return capturedThisTime;
}
