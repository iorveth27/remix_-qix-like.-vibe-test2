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

/** A spark enemy that patrols the field perimeter */
export interface SparkState {
  pos: Point;
  dir: Point;
  /** Preferred rotation direction at junctions: 1 = CW, -1 = CCW */
  rotation: 1 | -1;
  migrating: boolean;
  migrateTarget: Point | null;
  migratePath: Point[];
}
