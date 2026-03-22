export interface Point {
  x: number;
  y: number;
}

export interface Particle {
  pos: Point;
  vel: Point;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

export interface FloatingText {
  pos: Point;
  text: string;
  life: number;
  maxLife: number;
}

export interface Dimensions {
  width: number;
  height: number;
  fieldWidth: number;
  fieldHeight: number;
  offsetX: number;
  offsetY: number;
}

export enum Direction {
  NONE,
  UP,
  DOWN,
  LEFT,
  RIGHT,
}

/** A spark enemy that patrols the field border (LINE/EDGE cells) */
export interface SparkState {
  pos: Point;       // world-space position (for smooth rendering)
  gx: number;       // current grid cell x
  gy: number;       // current grid cell y
  dir: Point;       // cardinal unit direction vector
  type: 'chaser' | 'random';
  color: 'red' | 'blue';
  /** True while traversing captured territory to reach the active border */
  migrating: boolean;
  /** Ghost target grid cell (only valid when migrating) */
  targetGX: number;
  targetGY: number;
}

export interface QixEntity {
  pos: Point;
  vel: Point;
  lastPos: Point;
  angle: number;
  trail: Point[];
  dead: boolean;
  respawnTimer: number;
}

export interface DissolveParticle {
  x: number;       // canvas-space x
  y: number;       // canvas-space y
  vx: number;
  vy: number;
  fallDelay: number; // seconds after jitter ends before this particle starts falling
  color: string;
  size: number;    // pixel block side length in canvas pixels
}

