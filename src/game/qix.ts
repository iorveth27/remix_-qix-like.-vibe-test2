/**
 * qix.ts — QIX erratic Verlet-based wandering movement.
 *
 * Improvements over the original:
 * - Segment trail: maintains the last N head positions for a "comet" visual.
 * - Dynamic jitter: Qix gets more erratic as captured territory grows.
 * - Center-bias: weak pull toward the open void so Qix stays dangerous.
 * - Continuous collision: point-to-segment distance check against trail waypoints
 *   prevents tunneling through thin player trails.
 */

import { LEVEL_SPEED_SCALE, LVL2_SPEED_MULT, QIX_RADIUS, QIX_WANDER_JITTER, SPIDER_RADIUS } from '../constants';
import type { Dimensions, QixEntity } from '../types';
import { getGridPos, isEmptyCell, isTrailCell } from './grid';
import type { GameState } from './GameState';

const QIX_TRAIL_LEN = 7;

/** Squared distance from point (px,py) to segment (ax,ay)-(bx,by). */
function pointToSegDistSq(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return (px - ax) ** 2 + (py - ay) ** 2;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return (px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2;
}

const QIX_RESPAWN_TIME = 5; // seconds

export function tickQixEntity(
  entity: QixEntity,
  state: GameState,
  dt: number,
  dims: Dimensions,
  onDeath: () => void,
): void {
  // ── Respawn countdown ────────────────────────────────────────────────────
  if (entity.dead) {
    entity.respawnTimer -= dt;
    if (entity.respawnTimer <= 0) {
      entity.dead = false;
      entity.respawnTimer = 0;
      entity.pos = { x: dims.fieldWidth / 2, y: dims.fieldHeight / 2 };
      entity.lastPos = { ...entity.pos };
      entity.trail = [];
      const a = Math.random() * Math.PI * 2;
      entity.angle = a;
      entity.vel = { x: Math.cos(a), y: Math.sin(a) };
    }
    return;
  }

  // Honour post-death invincibility frames (same guard as sparks)
  if (state.damageFlash > 0) return;

  const captureRatio = state.capturedPercent / 100;
  const speedMult = Math.pow(LEVEL_SPEED_SCALE, state.level - 1) * (state.level === 2 ? LVL2_SPEED_MULT : 1);
  const QIX_SPEED = dims.fieldWidth * 0.25 * (1 + captureRatio * 1.5) * speedMult;
  const dynamicJitter = QIX_WANDER_JITTER * (1 + captureRatio * 3);
  entity.angle += (Math.random() * 2 - 1) * dynamicJitter;

  // ── Center-bias: gentle pull toward void center ───────────────────────────
  const cx = dims.fieldWidth / 2;
  const cy = dims.fieldHeight / 2;
  const toCX = cx - entity.pos.x;
  const toCY = cy - entity.pos.y;
  const distToCenter = Math.hypot(toCX, toCY);
  const fieldDiag = Math.hypot(dims.fieldWidth, dims.fieldHeight) / 2;
  if (distToCenter > 0) {
    const centerAngle = Math.atan2(toCY, toCX);
    const avoidStrength = 0.04 * (distToCenter / fieldDiag);
    const angleDiff = Math.atan2(Math.sin(centerAngle - entity.angle), Math.cos(centerAngle - entity.angle));
    entity.angle += angleDiff * avoidStrength;
  }

  // ── Verlet: derive velocity from position history ────────────────────────
  let velX = entity.pos.x - entity.lastPos.x;
  let velY = entity.pos.y - entity.lastPos.y;

  // Blend wander direction into velocity
  const wanderBlend = 0.15;
  velX += Math.cos(entity.angle) * wanderBlend;
  velY += Math.sin(entity.angle) * wanderBlend;

  // Normalize to constant speed
  const spd = Math.hypot(velX, velY);
  if (spd > 0) {
    const step = QIX_SPEED * dt;
    velX = (velX / spd) * step;
    velY = (velY / spd) * step;
  }

  let nextX = entity.pos.x + velX;
  let nextY = entity.pos.y + velY;

  // ── Bounce off field edges and non-EMPTY territory ───────────────────────
  const gpX = getGridPos({ x: nextX, y: entity.pos.y }, dims);
  const gpY = getGridPos({ x: entity.pos.x, y: nextY }, dims);

  const hitX = nextX < 0 || nextX > dims.fieldWidth  || !isEmptyCell(state.grid, gpX.x, gpX.y);
  const hitY = nextY < 0 || nextY > dims.fieldHeight || !isEmptyCell(state.grid, gpY.x, gpY.y);

  if (hitX) {
    velX = -velX;
    nextX = entity.pos.x + velX;
    entity.angle = Math.PI - entity.angle;
  }
  if (hitY) {
    velY = -velY;
    nextY = entity.pos.y + velY;
    entity.angle = -entity.angle;
  }

  // Corner correction: if still stuck, reverse completely
  const finalGP = getGridPos({ x: nextX, y: nextY }, dims);
  if (!isEmptyCell(state.grid, finalGP.x, finalGP.y)) {
    velX = -velX;
    velY = -velY;
    nextX = entity.pos.x + velX;
    nextY = entity.pos.y + velY;
    entity.angle += Math.PI;
  }

  // Clamp to field bounds
  nextX = Math.max(0, Math.min(dims.fieldWidth,  nextX));
  nextY = Math.max(0, Math.min(dims.fieldHeight, nextY));

  // ── Update Verlet history + segment trail ────────────────────────────────
  entity.lastPos = { ...entity.pos };
  entity.trail.unshift({ ...entity.pos });
  if (entity.trail.length > QIX_TRAIL_LEN) entity.trail.length = QIX_TRAIL_LEN;
  entity.pos = { x: nextX, y: nextY };
  entity.vel = { x: velX, y: velY };

  // ── Collision detection ──────────────────────────────────────────────────
  if (state.playerDrawing) {
    const rSq = QIX_RADIUS * QIX_RADIUS;

    // Continuous: point-to-segment check against every trail waypoint pair
    if (state.trail.length >= 2) {
      for (let i = 1; i < state.trail.length; i++) {
        const A = state.trail[i - 1];
        const B = state.trail[i];
        if (pointToSegDistSq(nextX, nextY, A.x, A.y, B.x, B.y) < rSq) {
          onDeath();
          return;
        }
      }
    }

    // Grid-based fallback: 12 radial sample points for NEWLINE cells
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const checkPos = {
        x: nextX + Math.cos(angle) * QIX_RADIUS,
        y: nextY + Math.sin(angle) * QIX_RADIUS,
      };
      const gp = getGridPos(checkPos, dims);
      if (isTrailCell(state.grid, gp.x, gp.y)) {
        onDeath();
        return;
      }
    }

    // Direct spider collision
    if (Math.hypot(state.spiderPos.x - nextX, state.spiderPos.y - nextY) < QIX_RADIUS + SPIDER_RADIUS) {
      onDeath();
    }
  }
}
