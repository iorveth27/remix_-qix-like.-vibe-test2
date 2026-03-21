import { CELL, GRID_W, GRID_H, DISSOLVE_JITTER_TIME, LEVEL_PALETTES } from './constants';
import type { Dimensions, DissolveParticle, Particle, FloatingText, Point } from './types';
import { ART_W, ART_H, getLevelArt, getLevelArtColors } from './game/pixelArt';

export interface RenderState {
  grid: Uint8Array;
  gridVersion: number;
  trailParticles: Particle[];
  trail: Point[];
  invalidLoop: Point[];
  invalidLoopTimer: number;
  playerDrawing: boolean;
  playerOnBorder: boolean;
  spiderPos: Point;
  particles: Particle[];
  floatingTexts: FloatingText[];
  captureFlash: number;
  damageFlash: number;
  qixEntities: { pos: Point; trail: Point[] }[];
  dissolveParticles: DissolveParticle[];
  isDissolving: boolean;
  dissolveTimer: number;
  level: number;
  sparks: { pos: Point; migrating: boolean }[];
  sparksEnabled: boolean;
  bossEnabled: boolean;
  fuseProgress: number;
  animationTime: number;
  bucketAngle: number;
  bucketTilt: number;
  bucketPitch: number;
  captureWaveProgress: number;
  showFullArt: boolean;
  levelClearProgress: number; // 0→1 over LEVEL_CLEAR_DELAY, drives the flash transition
}

const BUCKET_SVG = `<svg width="84" height="84" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Plastic Body (Vibrant Red/Pink Gloss) -->
    <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ff4d6d"/>
      <stop offset="15%" stop-color="#ff768b"/>
      <stop offset="40%" stop-color="#ff4d6d"/>
      <stop offset="85%" stop-color="#c81e31"/>
      <stop offset="100%" stop-color="#7a0410"/>
    </linearGradient>

    <!-- Doughnut Rim (Vertical Light to Dark) -->
    <linearGradient id="rimGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ff8a9c"/>
      <stop offset="60%" stop-color="#e8152e"/>
      <stop offset="100%" stop-color="#9d0618"/>
    </linearGradient>

    <!-- Sand Gradient inside the cavity -->
    <linearGradient id="sandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="50%" stop-color="#facc15"/>
      <stop offset="100%" stop-color="#ca8a04"/>
    </linearGradient>
  </defs>

  <!-- Ambient Drop Shadow -->
  <ellipse cx="50" cy="78" rx="24" ry="11" fill="rgba(0,0,0,0.2)"/>

  <!-- Tapered Body Base Ellipse -->
  <ellipse cx="50" cy="73" rx="20" ry="9" fill="url(#bodyGrad)"/>

  <!-- Tapered Body Trapezoid connecting the base to the rim -->
  <polygon points="21,30 30,73 70,73 79,30" fill="url(#bodyGrad)"/>

  <!-- Subtle shadow cast from the thick rim onto the bucket body -->
  <path d="M 20.5 30 Q 50 48 79.5 30 Z" fill="rgba(0,0,0,0.2)"/>

  <!-- Cute Kawaii Face -->
  <!-- Left Eye -->
  <polyline points="39,58 45,61 39,64" fill="none" stroke="#330b0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Right Eye -->
  <polyline points="61,58 55,61 61,64" fill="none" stroke="#330b0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Happy Open Mouth -->
  <path d="M 46 66 C 46 76, 54 76, 54 66 Z" fill="#330b0b" stroke="#330b0b" stroke-width="1.5" stroke-linejoin="round"/>
  <!-- Tiny red tongue sticking up -->
  <path d="M 48 70 C 48 74, 52 74, 52 70 Z" fill="#ff4d6d"/>

  <!-- Left-side Specular Highlight (Plastic Shine) -->
  <path d="M 27 45 Q 26 55 29 65" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.65"/>

  <!-- Giant Outer Rim Doughnut -->
  <ellipse cx="50" cy="30" rx="35" ry="16" fill="url(#rimGrad)"/>

  <!-- Inner Rim Wall (Dark Cavity Hole establishing the thickness) -->
  <ellipse cx="50" cy="30" rx="25" ry="9" fill="#5c000a"/>

  <!-- Elevated Sand filling the cavity -->
  <ellipse cx="50" cy="31" rx="24" ry="8" fill="url(#sandGrad)"/>

  <!-- Curving Sand Swirls/Rake texture details -->
  <g fill="none" stroke="#a16207" stroke-width="1.2" stroke-linecap="round" opacity="0.6">
    <path d="M 33 29 Q 40 27 50 31 T 66 29"/>
    <path d="M 37 32 Q 45 30 52 33 T 62 31"/>
    <path d="M 42 35 Q 48 33 55 35"/>
  </g>

  <!-- High-gloss Rim Specular Highlights -->
  <ellipse cx="22" cy="26" rx="4" ry="2" fill="#ffffff" transform="rotate(-30, 22, 26)" opacity="0.8"/>
  <ellipse cx="16" cy="31" rx="2" ry="2" fill="#ffffff" opacity="0.6"/>
</svg>`;

const bucketImg = new Image();
bucketImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(BUCKET_SVG);

const burnyLogoImg = new Image();
burnyLogoImg.src = '/burnygames_logo.png';

function hashFloat(a: number, b: number): number {
  let h = (a * 374761393 + b * 1103515245) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
}

// ── Golden sand tile pattern (32×32) — lazily rebuilt per palette ──────────
let patCanvas: HTMLCanvasElement | null = null;
let sandPattern: CanvasPattern | null = null;
let cachedPaletteIndex = -1;

function buildSandPattern(ctx: CanvasRenderingContext2D, palette: { base: string; bright: string; dark: string; glint: string }): CanvasPattern {
  if (!patCanvas) {
    patCanvas = document.createElement('canvas');
    patCanvas.width = 32;
    patCanvas.height = 32;
  }
  const patCtx = patCanvas.getContext('2d')!;
  patCtx.fillStyle = palette.base;
  patCtx.fillRect(0, 0, 32, 32);
  for (let gy = 0; gy < 32; gy++) {
    for (let gx = 0; gx < 32; gx++) {
      const v = hashFloat(gx * 31 + 7, gy * 17 + 3);
      const v2 = hashFloat(gx * 13 + 5, gy * 29 + 11);
      if (v < 0.12) {
        patCtx.fillStyle = palette.bright;
        patCtx.fillRect(gx, gy, 1, 1);
      } else if (v > 0.88) {
        patCtx.fillStyle = palette.dark;
        patCtx.fillRect(gx, gy, 1, 1);
      } else if (v2 > 0.92) {
        patCtx.fillStyle = palette.glint;
        patCtx.fillRect(gx, gy, 1, 1);
      }
    }
  }
  return ctx.createPattern(patCanvas, 'repeat')!;
}

// ── Per-level art canvas with sand-grain texture (built once, blitted each frame) ──
let artCanvas: HTMLCanvasElement | null = null;
let cachedArtLevel = -1;
let cachedArtDimsKey = '';

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function buildArtCanvas(level: number, dims: Dimensions): void {
  const w = Math.ceil(dims.fieldWidth);
  const h = Math.ceil(dims.fieldHeight);
  if (!artCanvas) artCanvas = document.createElement('canvas');
  artCanvas.width  = w;
  artCanvas.height = h;
  const ac = artCanvas.getContext('2d')!;

  const colors    = getLevelArtColors(level);
  const artPixels = getLevelArt(level);
  const rgbs      = colors.map(hexToRgb) as [number, number, number][];
  const cellW     = dims.fieldWidth  / ART_W;
  const cellH     = dims.fieldHeight / ART_H;

  const imageData = ac.createImageData(w, h);
  const data      = imageData.data;

  for (let ay = 0; ay < ART_H; ay++) {
    for (let ax = 0; ax < ART_W; ax++) {
      const ci         = artPixels[ay * ART_W + ax];
      const [br, bg, bb] = rgbs[ci];
      const x0 = Math.round(ax * cellW);
      const y0 = Math.round(ay * cellH);
      const x1 = Math.min(Math.round((ax + 1) * cellW), w);
      const y1 = Math.min(Math.round((ay + 1) * cellH), h);

      for (let py = y0; py < y1; py++) {
        for (let px = x0; px < x1; px++) {
          const v   = hashFloat(px + 313, py + 719);
          let r = br, g = bg, b = bb;
          if (v < 0.09) {
            // bright sand grain
            r = Math.min(255, r + 48); g = Math.min(255, g + 38); b = Math.min(255, b + 28);
          } else if (v > 0.91) {
            // dark sand grain
            r = Math.max(0, r - 38); g = Math.max(0, g - 38); b = Math.max(0, b - 32);
          } else if (v > 0.84) {
            // medium-dark grain
            r = Math.max(0, r - 18); g = Math.max(0, g - 18); b = Math.max(0, b - 14);
          }
          const idx = (py * w + px) * 4;
          data[idx]     = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
        }
      }
    }
  }

  ac.putImageData(imageData, 0, 0);
}

// ── Offscreen territory cache (FILLED + borders + LINE cells) ─────────────
// Rebuilt only when gridVersion or canvas dimensions change — O(1) per frame otherwise.
let territoryCanvas: HTMLCanvasElement | null = null;
let territoryCtx: CanvasRenderingContext2D | null = null;
let cachedGridVersion = -1;
let cachedDimsKey = '';

// ── Pre-generate star positions for the background sky ───────────────────
const STAR_COUNT = 80;
const stars: { x: number; y: number; r: number; twinkle: number }[] = [];
for (let i = 0; i < STAR_COUNT; i++) {
  stars.push({
    x: hashFloat(i * 37 + 1, i * 13 + 7),
    y: hashFloat(i * 53 + 3, i * 19 + 5) * 0.65, // concentrate in upper 65%
    r: 0.5 + hashFloat(i * 97, i * 41) * 1.2,
    twinkle: hashFloat(i * 23, i * 67) * Math.PI * 2,
  });
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  dims: Dimensions,
  state: RenderState,
) {
  const {
    grid, gridVersion, trailParticles, trail, invalidLoop, invalidLoopTimer, playerDrawing,
    spiderPos, particles, floatingTexts, captureFlash, damageFlash, qixEntities, dissolveParticles,
    isDissolving, dissolveTimer, level, sparks,
    sparksEnabled, bossEnabled, fuseProgress, animationTime, bucketTilt, bucketPitch,
    captureWaveProgress, showFullArt, levelClearProgress,
  } = state;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ── Desert-dusk starry sky background (whole canvas) ─────────────────────
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGrad.addColorStop(0, '#0d0820'); // deep midnight purple
  skyGrad.addColorStop(0.4, '#1a1040'); // dusk purple-blue
  skyGrad.addColorStop(0.7, '#2d1b6e'); // warm violet horizon
  skyGrad.addColorStop(0.88, '#7c3e1a'); // amber sunset band
  skyGrad.addColorStop(1, '#3d1a06'); // dark sienna sand floor
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Stars
  const t = animationTime / 1000;
  ctx.save();
  for (const star of stars) {
    const sx = star.x * canvas.width;
    const sy = star.y * canvas.height;
    const alpha = 0.5 + 0.5 * Math.sin(t * 0.8 + star.twinkle);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(sx, sy, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Sand dune silhouette at canvas bottom
  ctx.save();
  ctx.fillStyle = '#1a0a02';
  ctx.beginPath();
  ctx.moveTo(0, canvas.height);
  const duneW = canvas.width;
  const duneBaseY = canvas.height;
  ctx.lineTo(0, duneBaseY - canvas.height * 0.06);
  ctx.quadraticCurveTo(duneW * 0.15, duneBaseY - canvas.height * 0.14, duneW * 0.32, duneBaseY - canvas.height * 0.07);
  ctx.quadraticCurveTo(duneW * 0.48, duneBaseY - canvas.height * 0.00, duneW * 0.60, duneBaseY - canvas.height * 0.09);
  ctx.quadraticCurveTo(duneW * 0.75, duneBaseY - canvas.height * 0.18, duneW * 0.88, duneBaseY - canvas.height * 0.08);
  ctx.quadraticCurveTo(duneW * 0.95, duneBaseY - canvas.height * 0.03, duneW, duneBaseY - canvas.height * 0.05);
  ctx.lineTo(duneW, canvas.height);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Desert sand void inside game field (dark sand, not pure black)
  ctx.save();
  const fieldBg = ctx.createLinearGradient(dims.offsetX, dims.offsetY, dims.offsetX, dims.offsetY + dims.fieldHeight);
  fieldBg.addColorStop(0, '#0a0510');
  fieldBg.addColorStop(1, '#1a0e04');
  ctx.fillStyle = fieldBg;
  ctx.fillRect(dims.offsetX, dims.offsetY, dims.fieldWidth, dims.fieldHeight);
  ctx.restore();

  // Damage flash / screen shake — ctx.save() BEFORE translate so restore() fully undoes it
  if (damageFlash > 0) {
    ctx.save();
    const shakeX = (Math.random() - 0.5) * 10;
    const shakeY = (Math.random() - 0.5) * 10;
    ctx.translate(shakeX, shakeY);
    ctx.fillStyle = `rgba(255, 0, 0, ${damageFlash * 0.3})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // note: restore() is deferred to after QIX so the whole field shakes
  }

  // ── Warm wooden/sand frame border ────────────────────────────────────────
  const borderThickness = 10;
  ctx.save();
  const frameGrad = ctx.createLinearGradient(
    dims.offsetX - borderThickness, dims.offsetY - borderThickness,
    dims.offsetX - borderThickness + borderThickness * 2 + dims.fieldWidth, dims.offsetY - borderThickness + borderThickness * 2 + dims.fieldHeight,
  );
  frameGrad.addColorStop(0, '#c8832a');
  frameGrad.addColorStop(0.3, '#e8a84a');
  frameGrad.addColorStop(0.7, '#b86820');
  frameGrad.addColorStop(1, '#8b4a10');
  ctx.fillStyle = frameGrad;
  ctx.shadowBlur = 12;
  ctx.shadowColor = 'rgba(200, 120, 40, 0.5)';
  ctx.fillRect(dims.offsetX - borderThickness, dims.offsetY - borderThickness, dims.fieldWidth + borderThickness * 2, borderThickness);
  ctx.fillRect(dims.offsetX - borderThickness, dims.offsetY + dims.fieldHeight, dims.fieldWidth + borderThickness * 2, borderThickness);
  ctx.fillRect(dims.offsetX - borderThickness, dims.offsetY, borderThickness, dims.fieldHeight);
  ctx.fillRect(dims.offsetX + dims.fieldWidth, dims.offsetY, borderThickness, dims.fieldHeight);
  // Bright amber inner edge line
  ctx.strokeStyle = 'rgba(255, 210, 100, 0.9)';
  ctx.lineWidth = 2;
  ctx.shadowBlur = 8;
  ctx.shadowColor = '#ffcc50';
  ctx.strokeRect(dims.offsetX, dims.offsetY, dims.fieldWidth, dims.fieldHeight);
  // Outer highlight
  ctx.strokeStyle = 'rgba(255, 240, 180, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = 0;
  ctx.strokeRect(dims.offsetX - borderThickness + 1, dims.offsetY - borderThickness + 1, dims.fieldWidth + borderThickness * 2 - 2, dims.fieldHeight + borderThickness * 2 - 2);
  ctx.restore();

  const cellW = dims.fieldWidth / (GRID_W - 1);
  const cellH = dims.fieldHeight / (GRID_H - 1);

  // Rebuild sand pattern if palette changed
  const paletteIndex = (level - 1) % LEVEL_PALETTES.length;
  if (paletteIndex !== cachedPaletteIndex) {
    cachedPaletteIndex = paletteIndex;
    sandPattern = buildSandPattern(ctx, LEVEL_PALETTES[paletteIndex]);
    // Also invalidate the territory cache so it's rebuilt with the new pattern
    cachedGridVersion = -1;
  }
  if (!sandPattern) sandPattern = buildSandPattern(ctx, LEVEL_PALETTES[paletteIndex]);

  // ── Dissolve / Art Reveal: sand-textured pixel art, dissolve particles on top ──
  if (isDissolving || showFullArt) {
    const fw = dims.fieldWidth, fh = dims.fieldHeight;
    const ox = dims.offsetX,    oy = dims.offsetY;

    if (level === 1 && burnyLogoImg.complete && burnyLogoImg.naturalWidth > 0) {
      // Dark background fill then logo centred/fitted inside the field
      ctx.fillStyle = '#0d0820';
      ctx.fillRect(ox, oy, fw, fh);
      const imgW = burnyLogoImg.naturalWidth, imgH = burnyLogoImg.naturalHeight;
      const scale = Math.min(fw / imgW, fh / imgH);
      const dw = imgW * scale, dh = imgH * scale;
      ctx.drawImage(burnyLogoImg, ox + (fw - dw) / 2, oy + (fh - dh) / 2, dw, dh);
    } else {
      // Rebuild art canvas if level or field size changed
      const artDimsKey = `${Math.ceil(fw)}x${Math.ceil(fh)}`;
      if (cachedArtLevel !== level || cachedArtDimsKey !== artDimsKey) {
        cachedArtLevel   = level;
        cachedArtDimsKey = artDimsKey;
        buildArtCanvas(level, dims);
      }
      ctx.drawImage(artCanvas!, ox, oy);
    }

    if (isDissolving) {
      const jittering = dissolveTimer < DISSOLVE_JITTER_TIME;
      const sorted = [...dissolveParticles].sort((a, b) => a.color < b.color ? -1 : a.color > b.color ? 1 : 0);
      let currentColor = '';
      for (const p of sorted) {
        if (p.color !== currentColor) {
          ctx.fillStyle = p.color;
          currentColor = p.color;
        }
        const rx = jittering ? p.x + (Math.random() - 0.5) * 8 : p.x;
        const ry = jittering ? p.y + (Math.random() - 0.5) * 8 : p.y;
        ctx.fillRect(rx, ry, p.size, p.size);
      }
    }

    if (damageFlash > 0) ctx.restore();
    return;
  }

  // ── Territory cache: FILLED + borders + LINE cells ────────────────────────
  // Only rebuilt when gridVersion or canvas dimensions change.
  const dimsKey = `${canvas.width}x${canvas.height}x${dims.offsetX}x${dims.offsetY}x${dims.fieldWidth}x${dims.fieldHeight}`;
  if (gridVersion !== cachedGridVersion || dimsKey !== cachedDimsKey) {
    cachedGridVersion = gridVersion;
    cachedDimsKey = dimsKey;

    if (!territoryCanvas) {
      territoryCanvas = document.createElement('canvas');
      territoryCtx = territoryCanvas.getContext('2d')!;
    }
    territoryCanvas.width = canvas.width;
    territoryCanvas.height = canvas.height;
    const tc = territoryCtx!;
    tc.clearRect(0, 0, canvas.width, canvas.height);

    // FILLED cells — sand texture
    tc.beginPath();
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        if (grid[y * GRID_W + x] === CELL.FILLED) {
          tc.rect(dims.offsetX + x * cellW, dims.offsetY + y * cellH, cellW + 0.5, cellH + 0.5);
        }
      }
    }
    tc.fillStyle = sandPattern!;
    tc.fill();

    // Territory border lines — batched single path + single shadow stroke
    tc.strokeStyle = 'rgba(245, 190, 80, 0.9)';
    tc.lineWidth = 2;
    tc.shadowBlur = 6;
    tc.shadowColor = 'rgba(245, 160, 50, 0.7)';
    tc.beginPath();
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        if (grid[y * GRID_W + x] !== CELL.FILLED) continue;
        const rx = dims.offsetX + x * cellW;
        const ry = dims.offsetY + y * cellH;
        if (x + 1 < GRID_W && grid[y * GRID_W + (x + 1)] !== CELL.FILLED) {
          tc.moveTo(rx + cellW, ry); tc.lineTo(rx + cellW, ry + cellH);
        }
        if (y + 1 < GRID_H && grid[(y + 1) * GRID_W + x] !== CELL.FILLED) {
          tc.moveTo(rx, ry + cellH); tc.lineTo(rx + cellW, ry + cellH);
        }
        if (x - 1 >= 0 && grid[y * GRID_W + (x - 1)] !== CELL.FILLED) {
          tc.moveTo(rx, ry); tc.lineTo(rx, ry + cellH);
        }
        if (y - 1 >= 0 && grid[(y - 1) * GRID_W + x] !== CELL.FILLED) {
          tc.moveTo(rx, ry); tc.lineTo(rx + cellW, ry);
        }
      }
    }
    tc.stroke();
    tc.shadowBlur = 0;

    // LINE cells — batched path + single shadow fill
    tc.fillStyle = '#e8a840';
    tc.shadowBlur = 6;
    tc.shadowColor = 'rgba(232, 168, 64, 0.7)';
    tc.beginPath();
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        if (grid[y * GRID_W + x] === CELL.LINE) {
          tc.rect(dims.offsetX + x * cellW, dims.offsetY + y * cellH, cellW + 0.5, cellH + 0.5);
        }
      }
    }
    tc.fill();
    tc.shadowBlur = 0;
  }

  // Blit the cached territory (one drawImage per frame)
  ctx.drawImage(territoryCanvas!, 0, 0);

  // Capture wave glow — drawn live on top (only active for ~0.6s after a capture)
  if (captureWaveProgress < 1) {
    ctx.save();
    ctx.beginPath();
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        if (grid[y * GRID_W + x] === CELL.FILLED) {
          ctx.rect(dims.offsetX + x * cellW, dims.offsetY + y * cellH, cellW + 0.5, cellH + 0.5);
        }
      }
    }
    ctx.fillStyle = `rgba(255, 230, 100, ${(1 - captureWaveProgress) * 0.45})`;
    ctx.fill();
    ctx.restore();
  }

  // ── NEWLINE (3) cells — white-hot active trail glow ──────────────────────
  ctx.save();
  ctx.fillStyle = 'rgba(255, 240, 160, 0.95)';
  ctx.shadowBlur = 10;
  ctx.shadowColor = 'rgba(255, 210, 80, 0.9)';
  ctx.beginPath();
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      if (grid[y * GRID_W + x] === CELL.NEWLINE) {
        ctx.rect(dims.offsetX + x * cellW, dims.offsetY + y * cellH, cellW + 0.5, cellH + 0.5);
      }
    }
  }
  ctx.fill();
  ctx.restore();

  // ── Invalid loop — red highlight (fades over 1.5 s) ──────────────────────
  if (invalidLoop.length > 1 && invalidLoopTimer > 0) {
    const alpha = Math.min(1, invalidLoopTimer / 0.4); // fade during last 0.4 s
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = 'rgba(255, 60, 60, 0.9)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(255, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.moveTo(dims.offsetX + invalidLoop[0].x, dims.offsetY + invalidLoop[0].y);
    for (let i = 1; i < invalidLoop.length; i++) {
      ctx.lineTo(dims.offsetX + invalidLoop[i].x, dims.offsetY + invalidLoop[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Current trail — sandy grain dots
  if (playerDrawing && trail.length > 1 && trailParticles.length > 0) {
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

  // QIX entities
  if (bossEnabled) {
    const t = animationTime / 1000;

    // Color palettes per entity
    const entityColorSets = [
      ['#ff00ff', '#ff4400', '#ffff00', '#00ffff', '#ff00aa', '#aa00ff'], // entity 0: magenta
      ['#00ffff', '#00ff44', '#00ffaa', '#44ff00', '#aaffff', '#00ccff'], // entity 1: cyan/green
    ];

    for (let ei = 0; ei < qixEntities.length; ei++) {
      const entity = qixEntities[ei];
      const qixColors = entityColorSets[ei % entityColorSets.length];
      const shadowColor = ei === 0 ? 'rgba(255, 0, 255, 0.95)' : 'rgba(0, 255, 200, 0.95)';
      const trailShadow = ei === 0 ? 'rgba(255, 0, 255, 0.6)' : 'rgba(0, 255, 200, 0.6)';

      // Derive velocity direction from trail for squash/stretch
      const velX = entity.trail.length > 0 ? entity.pos.x - entity.trail[0].x : 0;
      const velY = entity.trail.length > 0 ? entity.pos.y - entity.trail[0].y : 0;
      const velAngle = Math.atan2(velY, velX);
      const velMag = Math.hypot(velX, velY);
      const stretchAmt = Math.min(velMag / 3, 1);

      // Draw ghost trail segments (most recent = index 0, oldest = last)
      const allPositions = [entity.pos, ...entity.trail];
      for (let seg = allPositions.length - 1; seg >= 1; seg--) {
        const pos = allPositions[seg];
        const alpha = 0.12 * (1 - seg / allPositions.length);
        const scale = 1 - seg / allPositions.length * 0.6;
        const sx = dims.offsetX + pos.x;
        const sy = dims.offsetY + pos.y;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.shadowBlur = 12;
        ctx.shadowColor = trailShadow;
        for (let i = 0; i < 6; i++) {
          const angle = t * 1.8 + (i * Math.PI / 3);
          const baseLen = (36 + Math.sin(t * 2.5 + i * 1.3) * 14) * scale;
          ctx.strokeStyle = qixColors[i];
          ctx.lineWidth = 2 * scale;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.cos(angle) * baseLen, sy + Math.sin(angle) * baseLen);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Draw the main Qix head with squash/stretch
      const qx = dims.offsetX + entity.pos.x;
      const qy = dims.offsetY + entity.pos.y;
      ctx.save();
      ctx.shadowBlur = 35;
      ctx.shadowColor = shadowColor;
      for (let i = 0; i < 6; i++) {
        const angle = t * 1.8 + (i * Math.PI / 3);
        const baseLen = 36 + Math.sin(t * 2.5 + i * 1.3) * 14;
        const dot = Math.cos(angle - velAngle);
        const len = baseLen * (1 + dot * 0.45 * stretchAmt);
        ctx.strokeStyle = qixColors[i];
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(qx, qy);
        ctx.lineTo(qx + Math.cos(angle) * len, qy + Math.sin(angle) * len);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // End of shaken region — restore transform saved before the shake translate
  if (damageFlash > 0) {
    ctx.restore();
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

  // Floating texts — high-contrast white + black stroke, readable over any sand colour
  floatingTexts.forEach(ft => {
    const tx = dims.offsetX + ft.pos.x;
    const ty = dims.offsetY + ft.pos.y;
    const alpha = ft.life / ft.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 22px Inter, sans-serif';
    ctx.textAlign = 'center';
    // Thick black stroke for legibility over any background colour
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(ft.text, tx, ty);
    // Bright white fill
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 0;
    ctx.fillText(ft.text, tx, ty);
    ctx.restore();
  });

  // Sparks
  if (sparksEnabled) for (let si = 0; si < sparks.length; si++) {
    const spark = sparks[si];
    const sx = dims.offsetX + spark.pos.x;
    const sy = dims.offsetY + spark.pos.y;
    const phase = animationTime / 80 + si * Math.PI;
    const alpha = spark.migrating ? 0.35 : 1; // ghost sparks are translucent
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = spark.migrating ? 6 : 18;
    ctx.shadowColor = '#ffdd00';
    ctx.strokeStyle = `rgba(255, 220, 0, ${0.6 + 0.4 * Math.sin(phase)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, 7 + Math.sin(phase * 1.3) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = spark.migrating ? 'rgba(200,200,255,0.6)' : '#fff8c0';
    ctx.beginPath();
    ctx.arc(sx, sy, 4, 0, Math.PI * 2);
    ctx.fill();
    if (!spark.migrating) {
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
    }
    ctx.restore();
  }

  // Bucket (player)
  const drawX = dims.offsetX + spiderPos.x;
  const drawY = dims.offsetY + spiderPos.y;

  ctx.save();
  ctx.translate(drawX, drawY);
  ctx.scale(1, bucketPitch);
  ctx.rotate(bucketTilt);

  if (bucketImg.complete) {
    ctx.drawImage(bucketImg, -22, -22, 44, 44);
  } else {
    ctx.fillStyle = '#ff4d6d';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // ── Level-clear transition flash: golden bloom that sweeps in then fades ──
  if (levelClearProgress > 0) {
    // sin curve: peaks at ~40% through the delay, fully gone by 100%
    const flashAlpha = Math.sin(levelClearProgress * Math.PI) * 0.55;
    const grad = ctx.createRadialGradient(
      dims.offsetX + dims.fieldWidth / 2, dims.offsetY + dims.fieldHeight / 2, 0,
      dims.offsetX + dims.fieldWidth / 2, dims.offsetY + dims.fieldHeight / 2,
      Math.max(dims.fieldWidth, dims.fieldHeight) * 0.75,
    );
    grad.addColorStop(0,   `rgba(255, 230, 80, ${flashAlpha})`);
    grad.addColorStop(0.5, `rgba(255, 140, 20, ${flashAlpha * 0.6})`);
    grad.addColorStop(1,   `rgba(0, 0, 0, 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(dims.offsetX, dims.offsetY, dims.fieldWidth, dims.fieldHeight);
  }

}
