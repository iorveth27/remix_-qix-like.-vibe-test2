// ─── Grid ──────────────────────────────────────────────────────────────────
export const ASPECT_RATIO = 9 / 16;
export const FIELD_MARGIN = 0.05;
export const GRID_W = 100;
export const GRID_H = Math.round(GRID_W / ASPECT_RATIO);

// ─── Cell types ────────────────────────────────────────────────────────────
export const CELL = { EMPTY: 0, FILLED: 1, LINE: 2, NEWLINE: 3, EDGE: 4 } as const;

// ─── Gameplay timing ───────────────────────────────────────────────────────
/** Seconds for the player to cross the full field width */
export const CROSS_TIME_SECONDS = 2;
/** Seconds the player can stop while drawing before dying */
export const FUSE_MAX_TIME = 3;

// ─── Collision radii (world-space pixels) ─────────────────────────────────
export const QIX_RADIUS = 32;
export const SPIDER_RADIUS = 12;
export const SPARK_RADIUS = 8;

// ─── Spark speed ───────────────────────────────────────────────────────────
/** Fraction of the player crossing speed */
export const SPARK_SPEED = 0.5;

// ─── Win condition ─────────────────────────────────────────────────────────
export const WIN_PERCENT = 65;

// ─── QIX wandering ─────────────────────────────────────────────────────────
export const QIX_WANDER_JITTER = 0.3;

// ─── HUD layout ────────────────────────────────────────────────────────────
export const UI_HEIGHT_RESERVE = 90;

// ─── Level progression ─────────────────────────────────────────────────────
export const LEVEL_SPEED_SCALE = 1.1;
export const DISSOLVE_JITTER_TIME = 0.5;
export const DISSOLVE_GRAVITY = 900;
export const BONUS_PER_PERCENT = 1000;
export const LEVEL_CLEAR_DELAY = 1.2;
export const LEVEL_PALETTES: { base: string; bright: string; dark: string; glint: string }[] = [
  { base: '#d4924a', bright: '#f5d47a', dark: '#8b5a20', glint: '#fde68a' },
  { base: '#4a8cd4', bright: '#7abcff', dark: '#2a5090', glint: '#c0dcff' },
  { base: '#d44a8c', bright: '#ff7abf', dark: '#8c2a58', glint: '#ffc0e0' },
  { base: '#4ad44a', bright: '#7aff7a', dark: '#2a8c2a', glint: '#c0ffc0' },
  { base: '#8c4ad4', bright: '#bf7aff', dark: '#5a2a8c', glint: '#e0c0ff' },
  { base: '#4ad4c4', bright: '#7affef', dark: '#2a8c7c', glint: '#c0fff5' },
  { base: '#d47c4a', bright: '#ffaf7a', dark: '#8c4a20', glint: '#ffd0a0' },
  { base: '#c4d44a', bright: '#f5ff7a', dark: '#7c8c2a', glint: '#f0ffc0' },
  { base: '#d44a4a', bright: '#ff7a7a', dark: '#8c2a2a', glint: '#ffc0c0' },
  { base: '#4a4ad4', bright: '#7a7aff', dark: '#2a2a8c', glint: '#c0c0ff' },
];
