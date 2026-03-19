/**
 * GameState — a single shared bag of mutable simulation state.
 *
 * All game systems (player, qix, sparks, territory) read from and write into
 * this object.  React refs in App.tsx point at the *same* underlying values;
 * the GameState is just a typed view so systems don't need to import React.
 */

import { GRID_H, GRID_W } from '../constants';
import {
  Direction,
  type FloatingText,
  type Particle,
  type Point,
  type SparkState,
} from '../types';

export interface GameState {
  // ── Territory ──────────────────────────────────────────────────────────
  /** 0 = uncaptured, 1 = captured / safe */
  grid: Uint8Array;
  /** Horizontal seam edges (edge below cell y) */
  seamsH: Uint8Array;
  /** Vertical seam edges (edge right of cell x) */
  seamsV: Uint8Array;
  /** Per-capture cell masks stored for rendering history and seam lines */
  historyStack: Uint8Array[];
  /** Cells newly captured in the most recent capture (for wave-reveal animation) */
  captureWaveMask: Uint8Array | null;
  /** 0 → 1 progress of the wave-reveal animation */
  captureWaveProgress: number;

  // ── Player ─────────────────────────────────────────────────────────────
  spiderPos: Point;
  spiderDir: Direction;
  /** Active drawing trail (world-space waypoints) */
  trail: Point[];
  /** Portion of the trail that was cut due to non-lethal self-intersection */
  invalidLoop: Point[];
  isOnSafe: boolean;
  isTrailing: boolean;
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

/** Create a fresh zeroed-out GameState (called on game start/restart) */
export function createGameState(): GameState {
  return {
    grid: new Uint8Array(GRID_W * GRID_H),
    seamsH: new Uint8Array(GRID_W * GRID_H),
    seamsV: new Uint8Array(GRID_W * GRID_H),
    historyStack: [],
    captureWaveMask: null,
    captureWaveProgress: 1,

    spiderPos: { x: 0, y: 0 },
    spiderDir: Direction.NONE,
    trail: [],
    invalidLoop: [],
    isOnSafe: true,
    isTrailing: false,
    trailParticles: [],
    fuseTimer: 0,

    bucketAngle: 0,
    bucketTilt: 0,
    bucketPitch: 1,

    qixPos: { x: 0, y: 0 },
    qixVel: { x: 0, y: 0 },
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
