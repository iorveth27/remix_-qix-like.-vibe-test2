export const ART_W = 20;
export const ART_H = 20;

function make(fn: (x: number, y: number) => number): number[] {
  const d: number[] = [];
  for (let y = 0; y < ART_H; y++)
    for (let x = 0; x < ART_W; x++)
      d.push(fn(x, y));
  return d;
}

// Level 1 — Burny Games logo
// Dome body: ellipse centre (9.5, 19), semi-axes (8.5, 11) — very wide, flat-ish base
// Three flame tongues rising from the top of the head
// Colors: 0=black, 1=golden body, 2=bright yellow highlight, 3=dark orange (shadow/tongue/flame base), 4=orange-red (flame tips)
function level1Art(): number[] {
  return make((x, y) => {
    const bx = x - 9.5;
    const by = y - 19;

    // ── Flame: three tapered tongues, y=0..9 ─────────────────────────────
    // tongue(cx, tipY, baseHalfWidth): narrow at tip, wide at base (y=9)
    const tongue = (cx: number, tipY: number, hw0: number): boolean => {
      if (y < tipY || y > 9) return false;
      const hw = 0.4 + hw0 * (y - tipY) / (9 - tipY);
      return Math.abs(x - cx) <= hw;
    };
    if (tongue(7,  0, 2.4) ||   // left tongue   (tallest)
        tongue(10, 1, 2.6) ||   // centre tongue
        tongue(13, 3, 1.8)) {   // right tongue  (shorter)
      return y <= 4 ? 4 : 3;   // orange-red tips → dark orange base
    }

    // ── Body: wide dome ellipse ───────────────────────────────────────────
    const bodyR = (bx / 8.5) * (bx / 8.5) + (by / 11) * (by / 11);
    if (bodyR >= 1) return 0;

    // Outline ring
    if (bodyR > 0.88) return 3;

    // Large black eyes
    if ((x - 7)  * (x - 7)  + (y - 13) * (y - 13) < 3.2) return 0;  // left
    if ((x - 12) * (x - 12) + (y - 13) * (y - 13) < 3.2) return 0;  // right

    // Wide open mouth + tongue
    const mouthR = (bx / 4.5) * (bx / 4.5) + ((y - 16) / 2.5) * ((y - 16) / 2.5);
    if (mouthR < 1 && y >= 14) {
      // Tongue: small warm ellipse at bottom of mouth
      if ((bx / 2.2) * (bx / 2.2) + ((y - 17.5) / 1.8) * ((y - 17.5) / 1.8) < 1) return 3;
      return 0; // mouth cavity
    }

    // Body shading: bright dome cap → golden middle → warm shadow bottom
    if (by < -7.5) return 2;   // bright top highlight
    if (by > -4)   return 3;   // darker warm shadow at bottom
    return 1;                  // golden yellow main body
  });
}

// Level 2 — Cat
// Colors: 0=bg, 1=warm brown fur, 2=cream belly/face, 3=dark eyes/shadow, 4=pink ears/blush
function level2Art(): number[] {
  return make((x, y) => {
    // ── Left ear: triangle, apex at (4.5, 0) ────────────────────────────────
    if (y < 4.5 && Math.abs(x - 4.5) < y * 0.85 + 0.4) {
      return (y >= 0.8 && Math.abs(x - 4.5) < y * 0.42) ? 4 : 1;
    }
    // ── Right ear: triangle, apex at (15, 0) ────────────────────────────────
    if (y < 4.5 && Math.abs(x - 15) < y * 0.85 + 0.4) {
      return (y >= 0.8 && Math.abs(x - 15) < y * 0.42) ? 4 : 1;
    }

    // ── Precompute radii used in multiple checks ──────────────────────────────
    const headR = ((x - 9.5) / 6) ** 2 + ((y - 7.5) / 4.8) ** 2;
    const bodyR = ((x - 9)   / 5.5) ** 2 + ((y - 14)  / 4.5) ** 2;

    // ── Tail: arc on right side — annular shell of circle at (14, 11.5) ──────
    const tR = Math.sqrt((x - 14) ** 2 + (y - 11.5) ** 2);
    if (tR >= 2.2 && tR <= 3.6 && x >= 13 && y <= 15 && y >= 8) return 1;

    // ── Paws ─────────────────────────────────────────────────────────────────
    if (y >= 16.5 && y <= 18.5 && ((x >= 4 && x <= 7.5) || (x >= 11 && x <= 14.5))) return 2;

    // ── Shadow ───────────────────────────────────────────────────────────────
    if (((x - 8.5) / 6) ** 2 + ((y - 19.6) / 1) ** 2 < 1) return 3;

    // ── Head ─────────────────────────────────────────────────────────────────
    if (headR < 1) {
      if ((x - 7)  ** 2 + (y - 7.5) ** 2 < 1.4) return 3;  // left eye
      if ((x - 12) ** 2 + (y - 7.5) ** 2 < 1.4) return 3;  // right eye
      if (((x - 5.5) / 1.8) ** 2 + ((y - 10) / 1.2) ** 2 < 1) return 4; // left blush
      if (((x - 13.5)/ 1.8) ** 2 + ((y - 10) / 1.2) ** 2 < 1) return 4; // right blush
      if ((x - 9.5) ** 2 + (y - 10) ** 2 < 0.6) return 3;  // nose
      // White face oval (below forehead)
      if (((x - 9.5) / 3.5) ** 2 + ((y - 9.5) / 3.2) ** 2 < 1 && y > 5.5) return 2;
      return 1; // brown fur
    }

    // ── Body ─────────────────────────────────────────────────────────────────
    if (bodyR < 1) {
      if (((x - 9) / 3.5) ** 2 + ((y - 14) / 4) ** 2 < 1) return 2; // cream belly
      return 1; // brown sides
    }

    return 0;
  });
}

// Level 3 — Pixel-art heart (13×11, centered in 20×20)
// Colors: 0=bg, 1=black outline, 2=red fill, 3=dark red shadow, 4=bright red highlight
function level3Art(): number[] {
  const H = [
    [0,0,1,1,0,0,0,0,0,1,1,0,0],  // row 0 — two bump tops
    [0,1,2,2,1,0,1,0,1,2,2,1,0],  // row 1 — bump interiors + dip outline
    [1,2,4,2,2,1,2,1,2,2,2,2,1],  // row 2 — bumps separate, dip interior
    [1,4,2,2,2,2,1,2,2,2,2,2,1],  // row 3 — merge outline at dip
    [1,4,2,2,2,2,2,2,2,2,2,2,1],  // row 4 — fully merged, highlight top-left
    [1,2,2,2,2,2,2,2,2,2,2,2,1],  // row 5 — widest row
    [0,1,3,2,2,2,2,2,2,2,3,1,0],  // row 6 — taper begins, shadow creeps in
    [0,0,1,3,2,2,2,2,2,3,1,0,0],  // row 7
    [0,0,0,1,3,2,2,2,3,1,0,0,0],  // row 8
    [0,0,0,0,1,3,2,3,1,0,0,0,0],  // row 9
    [0,0,0,0,0,1,1,0,0,0,0,0,0],  // row 10 — 2-pixel tip
  ];
  const ox = 3, oy = 4; // center 13×11 in 20×20
  return make((x, y) => {
    const hx = x - ox, hy = y - oy;
    if (hx < 0 || hx >= 13 || hy < 0 || hy >= 11) return 0;
    return H[hy][hx];
  });
}

// Level 4 — Mona Lisa
// Colors: 0=black(dress/dark), 1=teal(bg), 2=skin, 3=brown(hair), 4=light teal(sky)
function level4Art(): number[] {
  const M = [
    [4,4,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,4,4], // 0  sky background
    [4,1,1,1,1,1,3,3,3,3,3,3,3,1,1,1,1,1,1,4], // 1  hair top
    [1,1,1,1,3,3,3,3,3,3,3,3,3,3,3,1,1,1,1,1], // 2  hair wider
    [1,1,1,3,3,3,3,2,2,2,2,2,3,3,3,3,1,1,1,1], // 3  forehead
    [1,1,1,3,3,2,2,2,2,2,2,2,2,2,3,3,1,1,1,1], // 4  upper face
    [1,1,3,3,2,2,2,2,2,2,2,2,2,2,2,3,3,1,1,1], // 5  face
    [1,1,3,3,2,2,2,0,2,2,2,0,2,2,2,3,3,1,1,1], // 6  eyes
    [1,1,3,3,2,2,2,2,2,2,2,2,2,2,2,3,3,1,1,1], // 7  mid face
    [1,1,3,3,2,2,2,2,2,0,2,2,2,2,2,3,3,1,1,1], // 8  nose
    [1,1,3,3,2,2,2,2,3,3,3,2,2,2,2,3,3,1,1,1], // 9  mouth
    [1,1,3,3,2,2,2,2,2,2,2,2,2,2,2,3,3,1,1,1], // 10 chin
    [1,1,3,3,3,2,2,2,2,2,2,2,2,2,3,3,3,1,1,1], // 11 jaw / neck top
    [1,1,3,3,3,3,2,2,2,2,2,2,2,3,3,3,3,1,1,1], // 12 neck
    [1,1,0,3,3,3,3,2,2,2,2,2,3,3,3,3,0,1,1,1], // 13 collar
    [1,0,0,0,3,3,3,2,2,4,4,2,2,3,3,0,0,0,1,1], // 14 dress top / décolletage
    [0,0,0,0,0,0,3,2,4,4,4,4,2,3,0,0,0,0,0,0], // 15 neckline fold
    [0,0,0,0,0,0,2,2,4,2,2,4,2,2,0,0,0,0,0,0], // 16 hands / chest
    [0,0,0,0,0,0,0,2,2,2,2,2,2,0,0,0,0,0,0,0], // 17 hands
    [0,0,0,0,0,0,0,0,2,2,2,2,0,0,0,0,0,0,0,0], // 18 hands bottom
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], // 19 dark base
  ];
  return make((x, y) => M[y][x]);
}

// Level 5 — Rubber Duck
// Colors: 0=bg(dark), 1=yellow body, 2=dark golden wing, 3=black outline/eye, 4=orange-red beak
function level5Art(): number[] {
  const D = [
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], //  0
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], //  1
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], //  2
    [0,0,0,0,0,3,3,3,3,0,0,0,0,0,0,0,0,0,0,0], //  3  head top
    [0,0,0,0,3,1,1,1,1,3,0,0,0,0,0,0,0,0,0,0], //  4  head
    [0,0,0,3,1,1,1,1,1,1,3,3,0,0,0,0,0,0,0,0], //  5  head wider
    [0,0,0,3,1,3,1,1,1,1,1,3,4,4,3,0,0,0,0,0], //  6  eye + beak
    [0,0,0,3,1,1,1,1,1,1,1,3,4,3,0,0,0,0,0,0], //  7  beak lower
    [0,0,0,3,3,1,1,1,1,1,3,3,0,0,0,0,0,0,0,0], //  8  neck
    [0,0,0,2,1,1,1,1,1,1,1,1,3,0,0,0,0,0,0,0], //  9  body + wing shadow
    [0,0,2,2,1,1,1,1,1,1,1,1,1,3,0,0,0,0,0,0], // 10  wing shadow widens
    [0,0,2,2,3,1,1,1,1,1,1,1,1,1,3,0,0,0,0,0], // 11  wing shadow + dark dot
    [0,0,2,1,1,1,1,1,1,1,1,1,1,1,3,0,0,0,0,0], // 12  body
    [0,0,1,1,1,1,1,1,1,1,1,1,1,1,3,0,0,0,0,0], // 13  body widest
    [0,0,3,1,1,1,1,1,1,1,1,1,1,3,0,0,0,0,0,0], // 14  body narrows
    [0,0,3,3,1,1,1,1,1,1,1,1,3,3,0,0,0,0,0,0], // 15  bottom
    [0,0,0,3,3,3,3,3,3,3,3,3,3,0,0,0,0,0,0,0], // 16  base
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], // 17
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], // 18
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], // 19
  ];
  return make((x, y) => D[y][x]);
}

// Level 6 — Spiral
function level6Art(): number[] {
  const cx = 9.5, cy = 9.5;
  return make((x, y) => {
    const dx = x - cx, dy = y - cy;
    const r = Math.sqrt(dx*dx + dy*dy);
    if (r < 3) return 2;
    const theta = Math.atan2(dy, dx);
    const a = 1.5, b = 0.22;
    for (let wrap = 0; wrap <= 3; wrap++) {
      const wt = theta + wrap * 2 * Math.PI;
      if (wt < -0.5) continue;
      if (Math.abs(r - a * Math.exp(b * wt)) < 1.5) return wrap === 0 ? 3 : 1;
    }
    return 0;
  });
}

// Level 7 — Flame
function level7Art(): number[] {
  const cx = 9.5;
  return make((x, y) => {
    const dx = Math.abs(x - cx);
    if (dx < (13 - y) / 4 && y > 8) return 2;
    if (dx < (16 - y) / 3.5 && y > 5) return 2;
    if (dx < (18 - y) / 2.2 && y > 2) return 1;
    if (dx < (20 - y) / 3.8 && y > 0) return 4;
    return 0;
  });
}

// Level 8 — Frog Face
function level8Art(): number[] {
  const cx = 9.5, cy = 10;
  return make((x, y) => {
    const dx = x - cx, dy = y - cy;
    const r = Math.sqrt(dx*dx + dy*dy);
    if ((x-5)*(x-5) + (y-3)*(y-3) < 2.25) return 3;
    if ((x-14)*(x-14) + (y-3)*(y-3) < 2.25) return 3;
    if ((x-5)*(x-5) + (y-3)*(y-3) < 5) return 1;
    if ((x-14)*(x-14) + (y-3)*(y-3) < 5) return 1;
    if ((x-13)*(x-13) + (y-5)*(y-5) < 3) return 2;
    if ((x-8)*(x-8) + (y-9)*(y-9) < 1) return 3;
    if ((x-11)*(x-11) + (y-9)*(y-9) < 1) return 3;
    const adx = Math.abs(dx);
    if (y >= 13 && y <= 15 && adx < 6 && y >= 13 + (adx/6)*(adx/6)*2) return 3;
    if (r < 9) return 1;
    return 0;
  });
}

// Level 9 — Flower
function level9Art(): number[] {
  const cx = 9.5, cy = 9.5;
  return make((x, y) => {
    const dx = x - cx, dy = y - cy;
    const r = Math.sqrt(dx*dx + dy*dy);
    if (r < 3) return 2;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const cos = Math.cos(a), sin = Math.sin(a);
      const pcx = cx + cos * 5, pcy = cy + sin * 5;
      const ddx = x - pcx, ddy = y - pcy;
      const lx = ddx*cos + ddy*sin, ly = -ddx*sin + ddy*cos;
      const pv = (lx/3)*(lx/3) + (ly/2)*(ly/2);
      if (pv < 0.6) return 4;
      if (pv < 0.8) return 3;
      if (pv < 1.0) return 1;
    }
    return 0;
  });
}

// Level 10 — Crescent Moon
function level10Art(): number[] {
  const cx = 9.5, cy = 9.5;
  const stars: [number, number][] = [[16,3],[3,5],[17,14],[2,15],[14,17]];
  return make((x, y) => {
    for (const [sx, sy] of stars) {
      if ((x-sx)*(x-sx) + (y-sy)*(y-sy) < 1.5) return 2;
    }
    const dx = x - cx, dy = y - cy;
    const r = Math.sqrt(dx*dx + dy*dy);
    const subDx = x - (cx - 4), subDy = y - (cy + 1);
    if (subDx*subDx + subDy*subDy < 64) return 0;
    if (r < 8) return r < 6 ? 4 : 1;
    return 0;
  });
}

export function getLevelArt(level: number): number[] {
  const idx = ((level - 1) % 10) + 1;
  switch (idx) {
    case 1:  return level1Art();
    case 2:  return level2Art();
    case 3:  return level3Art();
    case 4:  return level4Art();
    case 5:  return level5Art();
    case 6:  return level6Art();
    case 7:  return level7Art();
    case 8:  return level8Art();
    case 9:  return level9Art();
    case 10: return level10Art();
    default: return level1Art();
  }
}

// Per-level art colors: [background, body, highlight, shadow, accent]
// Each color is a sandy/warm variant suited to sand-art aesthetics.
const LEVEL_ART_COLORS: [string, string, string, string, string][] = [
  ['#080808', '#e89018', '#f8d858', '#b84a00', '#b81008'], // 1: burny logo
  ['#0d0a08', '#8B5A2B', '#f0e0c8', '#2a1200', '#f4a0b8'], // 2: cat
  ['#080808', '#111111', '#cc2020', '#881010', '#ff4422'], // 3: heart
  ['#0d0d0d', '#2d6b58', '#c87c50', '#5a2a12', '#8ab5a0'], // 4: mona lisa
  ['#080808', '#f0c020', '#c08010', '#151510', '#e03010'], // 5: rubber duck
  ['#78a0a0', '#3ab8a8', '#70f8e8', '#18807a', '#b0f0e8'], // 6: spiral
  ['#a88870', '#c87040', '#f8a870', '#843820', '#f8e0b0'], // 7: flame
  ['#889870', '#a8c038', '#e0f870', '#688018', '#e8f8b0'], // 8: frog
  ['#a07878', '#c43a3a', '#f87070', '#881818', '#f8c0c0'], // 9: flower
  ['#686888', '#3838b8', '#7070f0', '#181878', '#c0c0f8'], // 10: moon
];

export function getLevelArtColors(level: number): [string, string, string, string, string] {
  return LEVEL_ART_COLORS[((level - 1) % 10)];
}
