// ─── Grid ──────────────────────────────────────────────────────────────────
export const ASPECT_RATIO = 9 / 16;
export const FIELD_MARGIN = 0.05;
export const GRID_W = 100;
export const GRID_H = Math.round(GRID_W / ASPECT_RATIO);

// ─── Gameplay timing ───────────────────────────────────────────────────────
/** Seconds for the player to cross the full field width */
export const CROSS_TIME_SECONDS = 2;
/** Seconds the player can stop while drawing before dying */
export const FUSE_MAX_TIME = 3;

// ─── Collision radii (world-space pixels) ─────────────────────────────────
export const QIX_RADIUS = 16;
export const SPIDER_RADIUS = 12;
export const SPARK_RADIUS = 8;

// ─── Spark speed ───────────────────────────────────────────────────────────
/** Fraction of the player crossing speed */
export const SPARK_SPEED = 0.3;

// ─── Win condition ─────────────────────────────────────────────────────────
export const WIN_PERCENT = 80;

// ─── HUD layout ────────────────────────────────────────────────────────────
export const UI_HEIGHT_RESERVE = 110;
