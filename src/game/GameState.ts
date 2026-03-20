/**
 * GameState — a single shared bag of mutable simulation state.
 */

import { CELL, GRID_H, GRID_W } from '../constants';
import {
  Direction,
  type FloatingText,
  type Particle,
  type Point,
  type SparkState,
} from '../types';

export interface GameState {
  // ── Territory ──────────────────────────────────────────────────────────
  /** 0=EMPTY, 1=FILLED, 2=LINE, 3=NEWLINE, 4=EDGE */
  grid: Uint8Array;
  /** 0→1 progress of the wave-reveal animation after each capture */
  captureWaveProgress: number;

  // ── Player ─────────────────────────────────────────────────────────────
  spiderPos: Point;
  spiderDir: Direction;
  /** Active drawing trail (world-space waypoints) */
  trail: Point[];
  /** Points of the most recent self-intersecting loop, shown in red */
  invalidLoop: Point[];
  /** Countdown (seconds) until invalidLoop is cleared; 0 = already cleared */
  invalidLoopTimer: number;
  /** True when player is on LINE/EDGE border (not drawing) */
  playerOnBorder: boolean;
  /** True when player is actively drawing a trail through EMPTY space */
  playerDrawing: boolean;
  /** Sand grain particles spawned along the active trail */
  trailParticles: Particle[];
  /** Seconds the player has been stalling while drawing */
  fuseTimer: number;

  // ── Bucket animation ───────────────────────────────────────────────────
  bucketAngle: number;
  bucketTilt: number;
  bucketPitch: number;

  // ── Enemies ────────────────────────────────────────────────────────────
  qixPos: Point;
  qixVel: Point;
  /** Previous QIX position for Verlet integration */
  qixLastPos: Point;
  /** Current wander angle for QIX erratic movement */
  qixAngle: number;
  sparks: SparkState[];

  // ── Visual effects ─────────────────────────────────────────────────────
  particles: Particle[];
  floatingTexts: FloatingText[];
  captureFlash: number;
  damageFlash: number;
  animationTime: number;

  // ── Scores ─────────────────────────────────────────────────────────────
  capturedPercent: number;
  lives: number;
}

/** Create a fresh GameState with EDGE border initialized */
export function createGameState(): GameState {
  const grid = new Uint8Array(GRID_W * GRID_H); // all 0 = EMPTY
  // Set perimeter cells to EDGE (4)
  for (let x = 0; x < GRID_W; x++) {
    grid[0 * GRID_W + x] = CELL.EDGE;
    grid[(GRID_H - 1) * GRID_W + x] = CELL.EDGE;
  }
  for (let y = 1; y < GRID_H - 1; y++) {
    grid[y * GRID_W + 0] = CELL.EDGE;
    grid[y * GRID_W + (GRID_W - 1)] = CELL.EDGE;
  }

  return {
    grid,
    captureWaveProgress: 1,

    spiderPos: { x: 0, y: 0 },
    spiderDir: Direction.NONE,
    trail: [],
    invalidLoop: [],
    invalidLoopTimer: 0,
    playerOnBorder: true,
    playerDrawing: false,
    trailParticles: [],
    fuseTimer: 0,

    bucketAngle: 0,
    bucketTilt: 0,
    bucketPitch: 1,

    qixPos: { x: 0, y: 0 },
    qixVel: { x: 0, y: 0 },
    qixLastPos: { x: 0, y: 0 },
    qixAngle: Math.PI / 4,
    sparks: [],

    particles: [],
    floatingTexts: [],
    captureFlash: 0,
    damageFlash: 0,
    animationTime: 0,

    capturedPercent: 0,
    lives: 3,
  };
}
