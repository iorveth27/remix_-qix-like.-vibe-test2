/**
 * particles.ts — tick all particle arrays and floating texts forward by dt.
 */

import type { GameState } from './GameState';

export function tickParticles(state: GameState, dt: number): void {
  state.particles.forEach(p => {
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;
    p.life -= dt;
  });
  state.particles = state.particles.filter(p => p.life > 0);

  state.trailParticles.forEach(p => {
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;
    p.life -= dt;
  });
  state.trailParticles = state.trailParticles.filter(p => p.life > 0);

  state.floatingTexts.forEach(ft => { ft.pos.y -= 30 * dt; ft.life -= dt; });
  state.floatingTexts = state.floatingTexts.filter(ft => ft.life > 0);
}
