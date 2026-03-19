import { GRID_W, GRID_H } from './constants';
import type { Dimensions, Particle, FloatingText, Point } from './types';

export interface RenderState {
  grid: Uint8Array;
  historyStack: Uint8Array[];
  trailParticles: Particle[];
  trail: Point[];
  invalidLoop: Point[];
  isTrailing: boolean;
  isOnSafe: boolean;
  spiderPos: Point;
  particles: Particle[];
  floatingTexts: FloatingText[];
  captureFlash: number;
  damageFlash: number;
  qixPos: Point;
  sparks: Point[];
  sparksEnabled: boolean;
  bossEnabled: boolean;
  fuseProgress: number; // 0 = none, 0–1 = how far along trail fuse has burned
  animationTime: number;
  bucketAngle: number;
  captureWaveMask: Uint8Array | null;
  captureWaveProgress: number;
}

const BUCKET_SVG = `<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="body" cx="50%" cy="50%" r="50%" fx="30%" fy="30%">
      <stop offset="0%" stop-color="#ff7b7b"/>
      <stop offset="70%" stop-color="#ef4444"/>
      <stop offset="100%" stop-color="#991b1b"/>
    </radialGradient>
    <radialGradient id="hole" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
      <stop offset="0%" stop-color="#7f1d1d"/>
      <stop offset="80%" stop-color="#450a0a"/>
      <stop offset="100%" stop-color="#280404"/>
    </radialGradient>
    <linearGradient id="handle" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#e2e8f0"/>
      <stop offset="50%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#94a3b8"/>
    </linearGradient>
  </defs>
  <circle cx="34" cy="34" r="28" fill="rgba(0,0,0,0.3)"/>
  <circle cx="32" cy="32" r="30" fill="#1e293b"/>
  <circle cx="32" cy="32" r="28" fill="url(#body)"/>
  <circle cx="32" cy="32" r="22" fill="#1e293b"/>
  <circle cx="32" cy="32" r="20" fill="url(#hole)"/>
  
  <!-- Sand pile inside -->
  <circle cx="32" cy="32" r="16" fill="#facc15"/>
  <circle cx="30" cy="30" r="12" fill="#fde047"/>
  
  <path d="M 32,6 A 26,26 0 0,1 32,58" fill="none" stroke="url(#handle)" stroke-width="6" stroke-linecap="round"/>
  
  <circle cx="32" cy="6" r="4.5" fill="#f8fafc" stroke="#1e293b" stroke-width="2"/>
  <circle cx="32" cy="58" r="4.5" fill="#f8fafc" stroke="#1e293b" stroke-width="2"/>
  
  <!-- Outer rim glossy reflection -->
  <path d="M 12,12 A 28,28 0 0,1 52,12" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.6"/>
</svg>`;

const bucketImg = new Image();
bucketImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(BUCKET_SVG);

function hashFloat(a: number, b: number): number {
  let h = (a * 374761393 + b * 1103515245) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
}

const patCanvas = document.createElement('canvas');
patCanvas.width = 32; patCanvas.height = 32;
const patCtx = patCanvas.getContext('2d')!;
patCtx.fillStyle = '#f9a8d4'; // Base pink
patCtx.fillRect(0, 0, 32, 32);
for (let gy = 0; gy < 32; gy++) {
  for (let gx = 0; gx < 32; gx++) {
    const v = hashFloat(gx * 31 + 7, gy * 17 + 3);
    if (v < 0.15) {
      patCtx.fillStyle = '#ffffff'; // White specks
      patCtx.fillRect(gx, gy, 1, 1);
    } else if (v > 0.85) {
      patCtx.fillStyle = '#be185d'; // Dark pink specks
      patCtx.fillRect(gx, gy, 1, 1);
    }
  }
}
let sandPattern: CanvasPattern | null = null;

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  dims: Dimensions,
  state: RenderState,
) {
  const {
    grid, historyStack, trailParticles, trail, invalidLoop, isTrailing, isOnSafe, spiderPos,
    particles, floatingTexts, captureFlash, damageFlash,
    qixPos, sparks, sparksEnabled, bossEnabled, fuseProgress, animationTime,
    bucketAngle, captureWaveMask, captureWaveProgress,
  } = state;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Black void field background
  ctx.fillStyle = '#000000';
  ctx.fillRect(dims.offsetX, dims.offsetY, dims.fieldWidth, dims.fieldHeight);

  // Damage flash / screen shake
  if (damageFlash > 0) {
    const shakeX = (Math.random() - 0.5) * 10;
    const shakeY = (Math.random() - 0.5) * 10;
    ctx.translate(shakeX, shakeY);
    ctx.save();
    ctx.fillStyle = `rgba(255, 0, 0, ${damageFlash * 0.3})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  // Glossy plastic/metal borders
  const borderThickness = 14;
  ctx.save();
  ctx.fillStyle = '#e2e8f0'; // slate-200 base
  ctx.shadowBlur = 15;
  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  
  // Base frame rectangles
  ctx.fillRect(dims.offsetX - borderThickness, dims.offsetY - borderThickness, dims.fieldWidth + borderThickness * 2, borderThickness);
  ctx.fillRect(dims.offsetX - borderThickness, dims.offsetY + dims.fieldHeight, dims.fieldWidth + borderThickness * 2, borderThickness);
  ctx.fillRect(dims.offsetX - borderThickness, dims.offsetY, borderThickness, dims.fieldHeight);
  ctx.fillRect(dims.offsetX + dims.fieldWidth, dims.offsetY, borderThickness, dims.fieldHeight);
  
  // Inner metallic shadow contour
  ctx.strokeStyle = '#94a3b8'; // slate-400
  ctx.lineWidth = 4;
  ctx.strokeRect(dims.offsetX, dims.offsetY, dims.fieldWidth, dims.fieldHeight);
  
  // Outer glossy highlight contour
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.strokeRect(dims.offsetX - borderThickness + 1.5, dims.offsetY - borderThickness + 1.5, dims.fieldWidth + borderThickness * 2 - 3, dims.fieldHeight + borderThickness * 2 - 3);
  ctx.restore();

  // Sand territory — captured cells rendered with textured sand blocks
  const cellW = dims.fieldWidth / (GRID_W - 1);
  const cellH = dims.fieldHeight / (GRID_H - 1);
  if (!sandPattern) sandPattern = ctx.createPattern(patCanvas, 'repeat')!;
  
  ctx.save();
  const maxHitRadius = Math.max(dims.fieldWidth, dims.fieldHeight) * 1.5;
  const currRadiusSq = Math.pow(maxHitRadius * captureWaveProgress, 2);

  historyStack.forEach((mask, i) => {
    const isLatest = i === historyStack.length - 1;

    // 1. Draw the textured sand blocks for this capture
    ctx.beginPath();
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        if (mask[y * GRID_W + x] === 1) {
          const rx = dims.offsetX + x * cellW;
          const ry = dims.offsetY + y * cellH;
          if (isLatest && captureWaveProgress < 1) {
            // Apply radial clip radius logic for Animated Pour
            const dx = (x * cellW) - spiderPos.x;
            const dy = (y * cellH) - spiderPos.y;
            if (dx * dx + dy * dy > currRadiusSq) continue;
          }
          ctx.rect(rx, ry, cellW + 0.5, cellH + 0.5);
        }
      }
    }
    ctx.fillStyle = sandPattern!;
    ctx.fill();

    // 2. Draw Legacy Edges: 1px seams over the fill for this specific capture
    ctx.save();
    if (isLatest && captureWaveProgress < 1) {
      // clip the stroke to the expanding radial pour as well
      ctx.beginPath();
      ctx.arc(dims.offsetX + spiderPos.x, dims.offsetY + spiderPos.y, Math.sqrt(currRadiusSq), 0, Math.PI * 2);
      ctx.clip();
    }
    
    ctx.beginPath();
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        if (mask[y * GRID_W + x] === 1) {
          const rx = dims.offsetX + x * cellW;
          const ry = dims.offsetY + y * cellH;
          // Top edge
          if (y === 0 || mask[(y - 1) * GRID_W + x] === 0) {
            ctx.moveTo(rx, ry); ctx.lineTo(rx + cellW, ry);
          }
          // Bottom edge
          if (y === GRID_H - 1 || mask[(y + 1) * GRID_W + x] === 0) {
            ctx.moveTo(rx, ry + cellH); ctx.lineTo(rx + cellW, ry + cellH);
          }
          // Left edge
          if (x === 0 || mask[y * GRID_W + (x - 1)] === 0) {
            ctx.moveTo(rx, ry); ctx.lineTo(rx, ry + cellH);
          }
          // Right edge
          if (x === GRID_W - 1 || mask[y * GRID_W + (x + 1)] === 0) {
            ctx.moveTo(rx + cellW, ry); ctx.lineTo(rx + cellW, ry + cellH);
          }
        }
      }
    }
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)'; // A dim red/orange stroke for legacy outlines
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  });
  ctx.restore();

  // Territory border lines — draw a bright edge wherever captured meets uncaptured on the global grid
  ctx.save();
  ctx.strokeStyle = 'rgba(245, 190, 80, 0.9)';
  ctx.lineWidth = 2;
  ctx.shadowBlur = 6;
  ctx.shadowColor = 'rgba(245, 160, 50, 0.7)';
  ctx.beginPath();
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      if (grid[y * GRID_W + x] !== 1) continue;
      const rx = dims.offsetX + x * cellW;
      const ry = dims.offsetY + y * cellH;
      // Right edge: neighbor to the right is uncaptured
      if (x + 1 < GRID_W && grid[y * GRID_W + (x + 1)] !== 1) {
        ctx.moveTo(rx + cellW, ry);
        ctx.lineTo(rx + cellW, ry + cellH);
      }
      // Bottom edge: neighbor below is uncaptured
      if (y + 1 < GRID_H && grid[(y + 1) * GRID_W + x] !== 1) {
        ctx.moveTo(rx, ry + cellH);
        ctx.lineTo(rx + cellW, ry + cellH);
      }
      // Left edge: neighbor to the left is uncaptured
      if (x - 1 >= 0 && grid[y * GRID_W + (x - 1)] !== 1) {
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx, ry + cellH);
      }
      // Top edge: neighbor above is uncaptured
      if (y - 1 >= 0 && grid[(y - 1) * GRID_W + x] !== 1) {
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx + cellW, ry);
      }
    }
  }
  ctx.stroke();
  ctx.restore();

  // Current trail — sandy grain dots
  if (isTrailing && trail.length > 1 && trailParticles.length > 0) {
    ctx.save();
    trailParticles.forEach(p => {
      const px = dims.offsetX + p.pos.x;
      const py = dims.offsetY + p.pos.y;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // Fuse: burning dot running from trail start toward player
    if (fuseProgress > 0 && trail.length > 1) {
      const fuseIdx = Math.min(
        Math.floor(fuseProgress * (trail.length - 1)),
        trail.length - 1,
      );
      const fp = trail[fuseIdx];
      const fx = dims.offsetX + fp.x;
      const fy = dims.offsetY + fp.y;
      ctx.save();
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#ff4500';
      ctx.fillStyle = '#ffff00';
      ctx.beginPath();
      ctx.arc(fx, fy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff4500';
      ctx.beginPath();
      ctx.arc(fx, fy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Invalid loop (self-intersection highlight)
  if (invalidLoop.length > 1) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 60, 60, 0.9)';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(255, 0, 0, 0.7)';
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(dims.offsetX + invalidLoop[0].x, dims.offsetY + invalidLoop[0].y);
    for (let i = 1; i < invalidLoop.length; i++) {
      ctx.lineTo(dims.offsetX + invalidLoop[i].x, dims.offsetY + invalidLoop[i].y);
    }
    ctx.lineTo(dims.offsetX + invalidLoop[0].x, dims.offsetY + invalidLoop[0].y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Qix
  if (bossEnabled) { const qx = dims.offsetX + qixPos.x;
  const qy = dims.offsetY + qixPos.y;
  const t = animationTime / 1000;
  ctx.save();
  ctx.shadowBlur = 25;
  ctx.shadowColor = 'rgba(255, 0, 255, 0.9)';
  const qixColors = ['#ff00ff', '#ff4400', '#ffff00', '#00ffff', '#ff00aa', '#aa00ff'];
  for (let i = 0; i < 6; i++) {
    const angle = t * 1.8 + (i * Math.PI / 3);
    const len = 18 + Math.sin(t * 2.5 + i * 1.3) * 7;
    ctx.strokeStyle = qixColors[i];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(qx, qy);
    ctx.lineTo(qx + Math.cos(angle) * len, qy + Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.restore();
  } // end bossEnabled

  if (damageFlash > 0) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // Success flash
  if (captureFlash > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(200, 140, 50, ${captureFlash * 0.4})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  // Particles
  particles.forEach(p => {
    const px = dims.offsetX + p.pos.x;
    const py = dims.offsetY + p.pos.y;
    const alpha = p.life / p.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(px, py, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // Floating texts
  floatingTexts.forEach(ft => {
    const tx = dims.offsetX + ft.pos.x;
    const ty = dims.offsetY + ft.pos.y;
    ctx.save();
    ctx.globalAlpha = ft.life / ft.maxLife;
    ctx.fillStyle = '#F5C86E';
    ctx.font = 'bold 20px Inter';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.fillText(ft.text, tx, ty);
    ctx.restore();
  });

  // Sparks
  if (sparksEnabled) for (let si = 0; si < sparks.length; si++) {
    const sp = sparks[si];
    const sx = dims.offsetX + sp.x;
    const sy = dims.offsetY + sp.y;
    const phase = animationTime / 80 + si * Math.PI;
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = '#ffdd00';
    // Outer glow ring
    ctx.strokeStyle = `rgba(255, 220, 0, ${0.6 + 0.4 * Math.sin(phase)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, 7 + Math.sin(phase * 1.3) * 2, 0, Math.PI * 2);
    ctx.stroke();
    // Core
    ctx.fillStyle = '#fff8c0';
    ctx.beginPath();
    ctx.arc(sx, sy, 4, 0, Math.PI * 2);
    ctx.fill();
    // Electric crackle lines
    ctx.strokeStyle = '#ffdd00';
    ctx.lineWidth = 1;
    for (let j = 0; j < 4; j++) {
      const angle = phase + j * (Math.PI / 2);
      const r1 = 5, r2 = 9 + Math.sin(phase * 2 + j) * 3;
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(angle) * r1, sy + Math.sin(angle) * r1);
      ctx.lineTo(sx + Math.cos(angle) * r2, sy + Math.sin(angle) * r2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Bucket (player) — top-down view, rotated toward movement direction
  const drawX = dims.offsetX + spiderPos.x;
  const drawY = dims.offsetY + spiderPos.y;

  // Safe-zone amber ring (drawn before rotation transform)
  if (isOnSafe) {
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = '#38bdf8'; // sky-400 theme 
    ctx.strokeStyle = 'rgba(56,189,248,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(drawX, drawY, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(drawX, drawY);
  ctx.rotate(bucketAngle);

  if (bucketImg.complete) {
    ctx.drawImage(bucketImg, -20, -20, 40, 40);
  } else {
    // Fallback
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
}
