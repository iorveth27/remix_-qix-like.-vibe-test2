/**
 * territory.ts — fillCapturedArea: Bresenham trail stamp, BFS flood-fill,
 * border extension, player snap, spark migration BFS.
 *
 * Returns the number of percentage points newly captured (0 if nothing changed).
 * Mutates GameState in place; callers are responsible for React state updates
 * (setCapturedPercent) and audio (playCaptureSound).
 */

import { GRID_H, GRID_W } from '../constants';
import type { Dimensions } from '../types';
import { getGridPos, gridToWorld, isPerimeter, isSafe } from './grid';
import type { GameState } from './GameState';

export function fillCapturedArea(state: GameState, dims: Dimensions): number {
  const { grid, seamsH, seamsV, trail, particles, floatingTexts } = state;

  // ── 1. Determine Qix BFS seed BEFORE stamping the trail ─────────────────
  // (After stamping, trail cells become safe and the seed check would fire wrong)
  const qixGPpre = getGridPos(state.qixPos, dims);
  const preSeedX = qixGPpre.x, preSeedY = qixGPpre.y;
  const preSeedValid = !isSafe(grid, preSeedX, preSeedY);

  // ── 2. Stamp trail into grid using Bresenham lines ───────────────────────
  const stampSeams = (x: number, y: number) => {
    if (y < GRID_H - 1) seamsH[y * GRID_W + x] = 1;
    if (y > 0) seamsH[(y - 1) * GRID_W + x] = 1;
    if (x < GRID_W - 1) seamsV[y * GRID_W + x] = 1;
    if (x > 0) seamsV[y * GRID_W + (x - 1)] = 1;
  };
  for (let ti = 0; ti < trail.length; ti++) {
    const gp = getGridPos(trail[ti], dims);
    if (ti === 0) {
      grid[gp.y * GRID_W + gp.x] = 1;
      stampSeams(gp.x, gp.y);
    } else {
      const prev = getGridPos(trail[ti - 1], dims);
      let x = prev.x, y = prev.y;
      const dx = Math.abs(gp.x - prev.x), sx = prev.x < gp.x ? 1 : -1;
      const dy = -Math.abs(gp.y - prev.y), sy = prev.y < gp.y ? 1 : -1;
      let err = dx + dy;
      while (true) {
        if (x >= 0 && x < GRID_W && y >= 0 && y < GRID_H) {
          grid[y * GRID_W + x] = 1;
          stampSeams(x, y);
        }
        if (x === gp.x && y === gp.y) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x += sx; }
        if (e2 <= dx) { err += dx; y += sy; }
      }
    }
  }

  // ── 3. Flood fill from Qix — mark cells reachable from Qix ──────────────
  const visited = new Uint8Array(GRID_W * GRID_H);
  let seedX = preSeedX, seedY = preSeedY;
  let foundSeed = preSeedValid;

  if (!foundSeed) {
    // Qix was on safe territory — scan outward for nearest uncaptured cell
    const scanV = new Uint8Array(GRID_W * GRID_H);
    const scanQ: [number, number][] = [[seedX, seedY]];
    scanV[seedY * GRID_W + seedX] = 1;
    outerScan: while (scanQ.length > 0) {
      const [cx, cy] = scanQ.shift()!;
      for (const [ddx, ddy] of [[-1,0],[1,0],[0,-1],[0,1]] as [number,number][]) {
        const nx = cx + ddx, ny = cy + ddy;
        if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
        if (scanV[ny * GRID_W + nx]) continue;
        scanV[ny * GRID_W + nx] = 1;
        if (!isSafe(grid, nx, ny)) { seedX = nx; seedY = ny; foundSeed = true; break outerScan; }
        scanQ.push([nx, ny]);
      }
    }
  }

  if (foundSeed) {
    const queue: [number, number][] = [[seedX, seedY]];
    visited[seedY * GRID_W + seedX] = 1;
    while (queue.length > 0) {
      const [cx, cy] = queue.shift()!;
      for (const [nx, ny] of [[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]] as [number,number][]) {
        if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H
            && !isSafe(grid, nx, ny) && !visited[ny * GRID_W + nx]) {
          visited[ny * GRID_W + nx] = 1;
          queue.push([nx, ny]);
        }
      }
    }
  }

  // ── 4. Capture everything not reachable from Qix ────────────────────────
  state.captureWaveMask = new Uint8Array(GRID_W * GRID_H);
  state.captureWaveProgress = foundSeed ? 0 : 1;
  if (foundSeed) {
    for (let i = 0; i < GRID_W * GRID_H; i++) {
      const x = i % GRID_W;
      const y = Math.floor(i / GRID_W);
      const onBorder = x === 0 || x === GRID_W - 1 || y === 0 || y === GRID_H - 1;
      if (!visited[i] && !onBorder) {
        if (grid[i] !== 1) state.captureWaveMask[i] = 1;
        grid[i] = 1;
      }
    }
  }

  // ── 5. Extend captured area to border cells whose inward neighbor is captured
  for (let x = 0; x < GRID_W; x++) {
    if (grid[1 * GRID_W + x] === 1) grid[0 * GRID_W + x] = 1;
    if (grid[(GRID_H - 2) * GRID_W + x] === 1) grid[(GRID_H - 1) * GRID_W + x] = 1;
  }
  for (let y = 0; y < GRID_H; y++) {
    if (grid[y * GRID_W + 1] === 1) grid[y * GRID_W + 0] = 1;
    if (grid[y * GRID_W + (GRID_W - 2)] === 1) grid[y * GRID_W + (GRID_W - 1)] = 1;
  }

  // ── 6. Snap player to nearest perimeter cell if surrounded by new territory
  const playerGP = getGridPos(state.spiderPos, dims);
  if (isSafe(grid, playerGP.x, playerGP.y) && !isPerimeter(grid, playerGP.x, playerGP.y)) {
    const bfsVisited = new Uint8Array(GRID_W * GRID_H);
    const bfsQueue: [number, number][] = [[playerGP.x, playerGP.y]];
    bfsVisited[playerGP.y * GRID_W + playerGP.x] = 1;
    let found: [number, number] | null = null;
    outer: while (bfsQueue.length > 0) {
      const [cx, cy] = bfsQueue.shift()!;
      for (const [nx, ny] of [[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]] as [number,number][]) {
        if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
        if (bfsVisited[ny * GRID_W + nx]) continue;
        bfsVisited[ny * GRID_W + nx] = 1;
        if (isSafe(grid, nx, ny) && isPerimeter(grid, nx, ny)) { found = [nx, ny]; break outer; }
        if (isSafe(grid, nx, ny)) bfsQueue.push([nx, ny]);
      }
    }
    if (found) state.spiderPos = gridToWorld(found[0], found[1], dims);
  }

  // ── 7. Spark delayed-edge migration ────────────────────────────────────
  // Find all perimeter cells reachable from the player via perimeter-only BFS
  const activePerimeter = new Uint8Array(GRID_W * GRID_H);
  {
    const playerGP2 = getGridPos(state.spiderPos, dims);
    if (isSafe(grid, playerGP2.x, playerGP2.y) && isPerimeter(grid, playerGP2.x, playerGP2.y)) {
      const pQ: [number, number][] = [[playerGP2.x, playerGP2.y]];
      activePerimeter[playerGP2.y * GRID_W + playerGP2.x] = 1;
      while (pQ.length > 0) {
        const [cx, cy] = pQ.shift()!;
        for (const [ddx, ddy] of [[-1,0],[1,0],[0,-1],[0,1]] as [number,number][]) {
          const nx = cx + ddx, ny = cy + ddy;
          if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
          if (activePerimeter[ny * GRID_W + nx]) continue;
          if (!isSafe(grid, nx, ny) || !isPerimeter(grid, nx, ny)) continue;
          activePerimeter[ny * GRID_W + nx] = 1;
          pQ.push([nx, ny]);
        }
      }
    }
  }

  // Sparks not on the active perimeter enter ghost mode: they continue their
  // current trajectory along the internalized seam lines and jump to the
  // nearest active perimeter cell when they reach a vertex.  No path is
  // pre-computed here — sparks.ts handles traversal each tick.
  state.sparks = state.sparks.map(spark => {
    const sgp = getGridPos(spark.pos, dims);
    if (activePerimeter[sgp.y * GRID_W + sgp.x]) return spark;
    return { ...spark, migrating: true, migrateTarget: null, migratePath: [] };
  });

  // ── 8. Count captured cells, emit effects, reset drawing state ──────────
  let filledCount = 0;
  for (let i = 0; i < GRID_W * GRID_H; i++) {
    if (grid[i] === 1) filledCount++;
  }
  const newPercent = Math.floor((filledCount / (GRID_W * GRID_H)) * 100);
  const capturedThisTime = newPercent - state.capturedPercent;

  if (capturedThisTime > 0) {
    state.captureFlash = 0.6;

    trail.forEach((p, idx) => {
      if (idx % 2 === 0) {
        for (let i = 0; i < 2; i++) {
          const rc = Math.random();
          particles.push({
            pos: { ...p },
            vel: { x: (Math.random() - 0.5) * 120, y: (Math.random() - 0.5) * 120 },
            color: rc > 0.6 ? '#E8A840' : rc > 0.3 ? '#C87A30' : '#F5D080',
            life: 0.4 + Math.random() * 0.6,
            maxLife: 1,
            size: 1.5 + Math.random() * 3,
          });
        }
      }
    });

    floatingTexts.push({
      pos: { ...state.spiderPos },
      text: `+${capturedThisTime}%`,
      life: 1.5,
      maxLife: 1.5,
    });
  }

  state.capturedPercent = newPercent;
  state.trail = [];
  state.invalidLoop = [];
  state.isOnSafe = true;
  state.isTrailing = false;
  state.fuseTimer = 0;
  state.historyStack.push(new Uint8Array(state.captureWaveMask));
  state.trailParticles = [];

  return capturedThisTime;
}
