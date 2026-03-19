/**
 * grid.ts — Pure grid-query helpers shared by all game systems.
 *
 * These functions replace the identical closures that were re-created on
 * every call to the `useEffect` game loop inside App.tsx.
 */

import { GRID_H, GRID_W } from '../constants';
import type { Dimensions, Point } from '../types';

/** Convert a world-space point to its nearest grid cell. */
export function getGridPos(p: Point, dims: Dimensions): { x: number; y: number } {
  return {
    x: Math.round((p.x / dims.fieldWidth)  * (GRID_W - 1)),
    y: Math.round((p.y / dims.fieldHeight) * (GRID_H - 1)),
  };
}

/**
 * Returns true when (gx, gy) is "safe" (captured or part of the border
 * perimeter that the player walks on).
 */
export function isSafe(grid: Uint8Array, gx: number, gy: number): boolean {
  if (gx <= 0 || gx >= GRID_W - 1 || gy <= 0 || gy >= GRID_H - 1) return true;
  return grid[gy * GRID_W + gx] === 1;
}

/**
 * A safe cell is a "perimeter" cell if at least one of its 4 neighbours is
 * uncaptured.  The player may only walk on perimeter cells.
 */
export function isPerimeter(grid: Uint8Array, gx: number, gy: number): boolean {
  if (gx <= 0 || gx >= GRID_W - 1 || gy <= 0 || gy >= GRID_H - 1) {
    return grid[gy * GRID_W + gx] !== 1;
  }
  return (
    !isSafe(grid, gx + 1, gy) ||
    !isSafe(grid, gx - 1, gy) ||
    !isSafe(grid, gx, gy + 1) ||
    !isSafe(grid, gx, gy - 1)
  );
}

/**
 * Returns true when (gx, gy) has at least one seam edge (territory-boundary
 * line) on any of its four sides.  Used for ghost-edge spark traversal.
 */
export function isSeamAdjacent(
  seamsH: Uint8Array,
  seamsV: Uint8Array,
  gx: number,
  gy: number,
): boolean {
  return !!(
    seamsH[gy * GRID_W + gx] ||
    (gy > 0 && seamsH[(gy - 1) * GRID_W + gx]) ||
    seamsV[gy * GRID_W + gx] ||
    (gx > 0 && seamsV[gy * GRID_W + (gx - 1)])
  );
}

/** Convert a grid cell back to a world-space centre point. */
export function gridToWorld(
  gx: number,
  gy: number,
  dims: Dimensions,
): { x: number; y: number } {
  return {
    x: (gx / (GRID_W - 1)) * dims.fieldWidth,
    y: (gy / (GRID_H - 1)) * dims.fieldHeight,
  };
}
