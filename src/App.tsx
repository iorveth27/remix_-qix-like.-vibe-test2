/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ASPECT_RATIO, CELL, DISSOLVE_GRAVITY, DISSOLVE_JITTER_TIME,
  FIELD_MARGIN, GRID_H, GRID_W, LEVEL_PALETTES,
  UI_HEIGHT_RESERVE,
} from './constants';
import { Direction, type Dimensions, type DissolveParticle, type QixEntity } from './types';
import { playCaptureSound } from './audio';
import { renderFrame } from './renderer';
import { HUD } from './components/HUD';
import { Joystick } from './components/Joystick';
import { Overlays } from './components/Overlays';
import { createGameState } from './game/GameState';
import type { GameState } from './game/GameState';
import { gridToWorld } from './game/grid';
import { fillCapturedArea } from './game/territory';
import { tickPlayer } from './game/player';
import { tickQixEntity } from './game/qix';
import { tickSparks } from './game/sparks';
import { tickParticles } from './game/particles';

type GameStage = 'PLAYING' | 'LEVEL_CLEAR' | 'DISSOLVE' | 'INTERSTITIAL' | 'GAMEOVER';

const getLevelGoal = (level: number) => level === 1 ? 50 : level === 2 ? 60 : level === 3 ? 65 : 75;

const FILL_WAVE_DURATION = 1.8; // seconds to animate filling remaining cells

const DIRS4 = [[-1,0],[1,0],[0,-1],[0,1]] as [number,number][];

/** BFS fill order: EMPTY cells sorted by distance from nearest non-EMPTY cell.
 *  Returns indices in the order they should be revealed (wave expanding inward). */
function computeFillOrder(grid: Uint8Array): number[] {
  const visited = new Uint8Array(GRID_W * GRID_H);
  const order: number[] = [];
  const q: number[] = [];
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const i = y * GRID_W + x;
      if (grid[i] === CELL.EMPTY) continue;
      for (const [ddx, ddy] of DIRS4) {
        const nx = x + ddx, ny = y + ddy;
        if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
        const ni = ny * GRID_W + nx;
        if (grid[ni] === CELL.EMPTY && !visited[ni]) {
          visited[ni] = 1; q.push(ni); order.push(ni);
        }
      }
    }
  }
  let head = 0;
  while (head < q.length) {
    const idx = q[head++];
    const x = idx % GRID_W, y = (idx / GRID_W) | 0;
    for (const [ddx, ddy] of DIRS4) {
      const nx = x + ddx, ny = y + ddy;
      if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
      const ni = ny * GRID_W + nx;
      if (grid[ni] === CELL.EMPTY && !visited[ni]) {
        visited[ni] = 1; q.push(ni); order.push(ni);
      }
    }
  }
  return order;
}

function createDissolveParticles(state: GameState, dims: Dimensions): DissolveParticle[] {
  const particles: DissolveParticle[] = [];
  const cellW = dims.fieldWidth / (GRID_W - 1);
  const cellH = dims.fieldHeight / (GRID_H - 1);
  const palette = LEVEL_PALETTES[(state.level - 1) % LEVEL_PALETTES.length];
  for (let gy = 0; gy < GRID_H; gy++) {
    for (let gx = 0; gx < GRID_W; gx++) {
      const cell = state.grid[gy * GRID_W + gx];
      if (cell === CELL.FILLED || cell === CELL.LINE) {
        const r = Math.random();
        const color = r < 0.12 ? palette.bright : r > 0.88 ? palette.dark : palette.base;
        particles.push({
          x: dims.offsetX + gx * cellW,
          y: dims.offsetY + gy * cellH,
          vx: (Math.random() - 0.5) * 30,
          vy: -10 + Math.random() * 20,
          fallDelay: Math.random() * 0.3,
          color,
          size: Math.ceil(Math.max(cellW, cellH)) + 1,
        });
      }
    }
  }
  return particles;
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);

  const [gameStage,       setGameStage]       = useState<GameStage>('PLAYING');
  const [isPaused,        setIsPaused]        = useState(false);
  const [sparksEnabled,   setSparksEnabled]   = useState(() => localStorage.getItem('sparksEnabled') !== 'false');
  const [bossEnabled,     setBossEnabled]     = useState(() => localStorage.getItem('bossEnabled') !== 'false');
  const [dimensions,      setDimensions]      = useState<Dimensions>({ width: 0, height: 0, fieldWidth: 0, fieldHeight: 0, offsetX: 0, offsetY: 0 });
  const [capturedPercent, setCapturedPercent] = useState(0);
  const [level,           setLevel]           = useState(1);
  const [deathReason,     setDeathReason]     = useState<'QIX' | 'Crabs'>('QIX');
  const [loopKey,         setLoopKey]         = useState(0);
  const [ftueHint,        setFtueHint]        = useState<string | null>(null);

  const gs = useRef(createGameState());

  const lastTime            = useRef<number>(0);
  const requestRef          = useRef<number>();
  const gameStageRef        = useRef<GameStage>('PLAYING');
  const isPausedRef         = useRef(false);
  const sparksEnabledRef    = useRef(true);
  const bossEnabledRef      = useRef(true);
  const hasStarted = useRef(false);
  const levelClearTimerRef  = useRef(0);
  const fillWaveCellsRef    = useRef<number[]>([]);
  const fillWaveIndexRef    = useRef(0);
  const savedLevelRef = useRef(parseInt(localStorage.getItem('savedLevel') ?? '1', 10) || 1);
  const enemiesFrozenRef   = useRef(false);
  const ftueStepRef        = useRef<'swipe' | 'connect' | 'done'>('done');
  const ftueHintTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFirstInputRef    = useRef<() => void>(() => {});
  const ftueFirstCaptureDoneRef = useRef(false);
  const ftueLevel3ShownRef      = useRef(false);
  const ftueOnFirstCaptureRef  = useRef<() => void>(() => {});

  const setStage = (s: GameStage) => {
    gameStageRef.current = s;
    setGameStage(s);
  };

  const showFTUEHint = (text: string, autofadeMs?: number) => {
    if (ftueHintTimerRef.current) clearTimeout(ftueHintTimerRef.current);
    setFtueHint(text);
    if (autofadeMs) {
      ftueHintTimerRef.current = setTimeout(() => setFtueHint(null), autofadeMs);
    }
  };

  ftueOnFirstCaptureRef.current = () => {
    if (gs.current.level === 1 && !ftueFirstCaptureDoneRef.current) {
      ftueFirstCaptureDoneRef.current = true;
      showFTUEHint('Claim the rest', 3500);
    }
  };

  // Re-assigned each render so closures in event handlers stay fresh via the ref
  handleFirstInputRef.current = () => {
    const lvl = gs.current.level;
    if (lvl === 1 && ftueStepRef.current === 'swipe') {
      ftueStepRef.current = 'connect';
      showFTUEHint('Connect the line', 3500);
    } else if (lvl === 2 && enemiesFrozenRef.current) {
      enemiesFrozenRef.current = false;
      if (ftueHintTimerRef.current) clearTimeout(ftueHintTimerRef.current);
      setFtueHint(null);
    }
  };

  useEffect(() => { isPausedRef.current  = isPaused;  }, [isPaused]);
  useEffect(() => { sparksEnabledRef.current = sparksEnabled; localStorage.setItem('sparksEnabled', String(sparksEnabled)); }, [sparksEnabled]);
  useEffect(() => { bossEnabledRef.current   = bossEnabled;   localStorage.setItem('bossEnabled',   String(bossEnabled));   }, [bossEnabled]);

  const makeQix = (x: number, y: number): QixEntity => {
    const angle = Math.PI / 4 + Math.floor(Math.random() * 4) * (Math.PI / 2);
    const speed = 1; // placeholder — actual speed computed from dims in tickQixEntity
    const dt0 = 1 / 60;
    const pos = { x, y };
    return {
      pos,
      vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      lastPos: { x: x - Math.cos(angle) * speed * dt0, y: y - Math.sin(angle) * speed * dt0 },
      angle,
      trail: [],
      dead: false,
      respawnTimer: 0,
    };
  };

  const startGame = (dims: Dimensions, opts?: { level?: number }) => {
    const lvl = opts?.level ?? 1;
    const state = createGameState(lvl);

    // Player starts at the middle of the top EDGE row so moving DOWN enters EMPTY immediately
    state.spiderPos = { x: dims.fieldWidth / 2, y: 0 };

    state.level = lvl;

    // Persist current level so game over restarts from here
    savedLevelRef.current = lvl;
    localStorage.setItem('savedLevel', String(lvl));

    // FTUE: enemies and hints vary by level
    if (ftueHintTimerRef.current) clearTimeout(ftueHintTimerRef.current);

    if (lvl === 1) {
      // Tutorial level — no enemies
      state.qixEntities = [];
      state.sparks = [];
      enemiesFrozenRef.current = false;
      ftueStepRef.current = 'swipe';
      ftueFirstCaptureDoneRef.current = false;
      ftueLevel3ShownRef.current      = false;
      setFtueHint('Swipe to move');
    } else if (lvl === 2) {
      // 1 spark (frozen until first input), 1 QIX
      state.qixEntities = [makeQix(dims.fieldWidth / 2, dims.fieldHeight / 2)];
      const sgx = Math.round(0.5 * (GRID_W - 1)), sgy = GRID_H - 1;
      state.sparks = [
        { pos: gridToWorld(sgx, sgy, dims), gx: sgx, gy: sgy, dir: { x: -1, y: 0 }, type: 'chaser', color: 'red', migrating: false, targetGX: sgx, targetGY: sgy },
      ];
      enemiesFrozenRef.current = true;
      ftueStepRef.current = 'done';
      showFTUEHint('Avoid enemies');
    } else {
      // Normal levels (3+)
      if (lvl === 4) {
        // 1 QIX, 4 crabs (2 red + 2 blue)
        state.qixEntities = [makeQix(dims.fieldWidth / 2, dims.fieldHeight / 2)];
        const gxA = Math.round(0.20 * (GRID_W - 1)), gxB = Math.round(0.40 * (GRID_W - 1));
        const gxC = Math.round(0.60 * (GRID_W - 1)), gxD = Math.round(0.80 * (GRID_W - 1));
        const gy  = GRID_H - 1;
        state.sparks = [
          { pos: gridToWorld(gxA, gy, dims), gx: gxA, gy, dir: { x: -1, y: 0 }, type: 'chaser',  color: 'red',  migrating: false, targetGX: gxA, targetGY: gy },
          { pos: gridToWorld(gxB, gy, dims), gx: gxB, gy, dir: { x:  1, y: 0 }, type: 'random',  color: 'red',  migrating: false, targetGX: gxB, targetGY: gy },
          { pos: gridToWorld(gxC, gy, dims), gx: gxC, gy, dir: { x: -1, y: 0 }, type: 'random',  color: 'blue', migrating: false, targetGX: gxC, targetGY: gy },
          { pos: gridToWorld(gxD, gy, dims), gx: gxD, gy, dir: { x:  1, y: 0 }, type: 'chaser',  color: 'blue', migrating: false, targetGX: gxD, targetGY: gy },
        ];
      } else if (lvl === 5) {
        // 2 QIX, 2 crabs
        state.qixEntities = [
          makeQix(dims.fieldWidth / 3,     dims.fieldHeight / 2),
          makeQix(dims.fieldWidth * 2 / 3, dims.fieldHeight / 2),
        ];
        const s1gx = Math.round(0.25 * (GRID_W - 1)), s1gy = GRID_H - 1;
        const s2gx = Math.round(0.75 * (GRID_W - 1)), s2gy = GRID_H - 1;
        state.sparks = [
          { pos: gridToWorld(s1gx, s1gy, dims), gx: s1gx, gy: s1gy, dir: { x: -1, y: 0 }, type: 'chaser', color: 'red',  migrating: false, targetGX: s1gx, targetGY: s1gy },
          { pos: gridToWorld(s2gx, s2gy, dims), gx: s2gx, gy: s2gy, dir: { x:  1, y: 0 }, type: 'random', color: 'blue', migrating: false, targetGX: s2gx, targetGY: s2gy },
        ];
      } else {
        // lvl 3 and 6+: 1 QIX (2 from lvl 6+), 2 red crabs
        state.qixEntities = [makeQix(dims.fieldWidth / 2, dims.fieldHeight / 2)];
        if (lvl >= 6) state.qixEntities.push(makeQix(dims.fieldWidth * 2 / 3, dims.fieldHeight / 3));
        const s1gx = Math.round(0.25 * (GRID_W - 1)), s1gy = GRID_H - 1;
        const s2gx = Math.round(0.75 * (GRID_W - 1)), s2gy = GRID_H - 1;
        state.sparks = [
          { pos: gridToWorld(s1gx, s1gy, dims), gx: s1gx, gy: s1gy, dir: { x: -1, y: 0 }, type: 'chaser', color: 'red', migrating: false, targetGX: s1gx, targetGY: s1gy },
          { pos: gridToWorld(s2gx, s2gy, dims), gx: s2gx, gy: s2gy, dir: { x:  1, y: 0 }, type: 'random', color: 'red', migrating: false, targetGX: s2gx, targetGY: s2gy },
        ];
      }
      enemiesFrozenRef.current = false;
      ftueStepRef.current = 'done';
      if (lvl === 3 && !ftueLevel3ShownRef.current) {
        ftueLevel3ShownRef.current = true;
        showFTUEHint('Have fun!', 3500);
      } else {
        setFtueHint(null);
      }
    }

    gs.current = state;
    setCapturedPercent(0);
    setStage('PLAYING');
    // Delay level number update so the HUD slides in at the old number first,
    // then the digit animation fires once the HUD is visible.
    setTimeout(() => setLevel(lvl), 120);
  };

  // Auto-start once dimensions are ready — resume from last saved level
  useEffect(() => {
    if (dimensions.fieldWidth > 0 && !hasStarted.current) {
      startGame(dimensions, { level: savedLevelRef.current });
      hasStarted.current = true;
    }
  }, [dimensions]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      const MAX_AVAIL_HEIGHT = height - UI_HEIGHT_RESERVE - (height * FIELD_MARGIN);

      let fWidth, fHeight;
      if (width / MAX_AVAIL_HEIGHT > ASPECT_RATIO) {
        fHeight = MAX_AVAIL_HEIGHT;
        fWidth  = fHeight * ASPECT_RATIO;
      } else {
        fWidth  = width * (1 - FIELD_MARGIN * 2);
        fHeight = fWidth / ASPECT_RATIO;
        if (fHeight > MAX_AVAIL_HEIGHT) {
          fHeight = MAX_AVAIL_HEIGHT;
          fWidth  = fHeight * ASPECT_RATIO;
        }
      }

      setDimensions({
        width,
        height,
        fieldWidth:  fWidth,
        fieldHeight: fHeight,
        offsetX: (width - fWidth) / 2,
        offsetY: UI_HEIGHT_RESERVE + (height - UI_HEIGHT_RESERVE - fHeight) / 2,
      });
    };

    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener('resize', handleResize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Game loop
  useEffect(() => {
    if (gameStageRef.current === 'GAMEOVER') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleDeath = (reason: 'QIX' | 'Crabs') => {
      setDeathReason(reason);
      const state = gs.current;
      state.damageFlash = 0.5;

      // Death explosion particles
      for (let ei = 0; ei < 150; ei++) {
        const eAngle = Math.random() * Math.PI * 2;
        const eSpeed = 60 + Math.random() * 180;
        const er     = Math.random();
        state.particles.push({
          pos:  { x: state.spiderPos.x, y: state.spiderPos.y },
          vel:  { x: Math.cos(eAngle) * eSpeed, y: Math.sin(eAngle) * eSpeed },
          color: er > 0.5 ? '#E8A840' : er > 0.25 ? '#C87A30' : '#F5D080',
          life: 0.4 + Math.random() * 0.6,
          maxLife: 1,
          size: 2 + Math.random() * 4,
        });
      }

      setStage('GAMEOVER');
    };

    const update = (time: number) => {
      const dt = Math.min((time - lastTime.current) / 1000, 0.05);
      lastTime.current = time;

      const stage = gameStageRef.current;

      if (stage === 'PLAYING' && !isPausedRef.current) {
        const state = gs.current;
        state.animationTime += dt * 1000;

        // Wave-reveal progress
        if (state.captureWaveProgress < 1) {
          state.captureWaveProgress = Math.min(1, state.captureWaveProgress + dt / 0.8);
        }

        // Flash timers
        if (state.captureFlash > 0) state.captureFlash -= dt;
        if (state.damageFlash  > 0) state.damageFlash  -= dt;
        if (state.invalidLoopTimer > 0) {
          state.invalidLoopTimer -= dt;
          if (state.invalidLoopTimer <= 0) { state.invalidLoop = []; state.invalidLoopTimer = 0; }
        }

        tickParticles(state, dt);

        tickPlayer(state, dt, dimensions, () => {
          const captured = fillCapturedArea(state, dimensions);
          if (captured > 0) {
            playCaptureSound();
            setCapturedPercent(state.capturedPercent);
            ftueOnFirstCaptureRef.current();
            state.floatingTexts.push({
              pos: { x: state.spiderPos.x, y: state.spiderPos.y - 20 },
              text: `-${captured}%`,
              life: 1.5,
              maxLife: 1.5,
            });
          }
        });

        if (bossEnabledRef.current && !enemiesFrozenRef.current) {
          for (const entity of state.qixEntities) {
            tickQixEntity(entity, state, dt, dimensions, () => handleDeath('QIX'));
          }
        }
        if (sparksEnabledRef.current && !enemiesFrozenRef.current) {
          tickSparks(state, dt, dimensions, () => handleDeath('Crabs'));
        }

        if (state.capturedPercent >= getLevelGoal(state.level)) {
          // Remove enemies so they don't render during the fill animation
          state.qixEntities        = [];
          state.sparks             = [];
          state.captureFlash       = 0;  // suppress capture-flash glow during fill
          state.captureWaveProgress = 1; // suppress post-capture shimmer during fill
          // Compute BFS fill order: wave expanding from captured territory inward
          fillWaveCellsRef.current  = computeFillOrder(state.grid);
          fillWaveIndexRef.current  = 0;
          levelClearTimerRef.current = 0;
          setStage('LEVEL_CLEAR');
        }
      } else if (stage === 'LEVEL_CLEAR') {
        const state = gs.current;
        state.animationTime += dt * 1000;
        levelClearTimerRef.current += dt;

        // Progressively fill remaining EMPTY cells in BFS wave order.
        // Ease-out: fills fast at first, slows as it converges.
        const cells = fillWaveCellsRef.current;
        const t = Math.min(levelClearTimerRef.current / FILL_WAVE_DURATION, 1);
        const fillRatio = 1 - (1 - t) * (1 - t); // ease-out quadratic
        const targetIdx = Math.floor(fillRatio * cells.length);
        let changed = false;
        while (fillWaveIndexRef.current < targetIdx) {
          const ci = cells[fillWaveIndexRef.current++];
          if (state.grid[ci] === CELL.EMPTY) { state.grid[ci] = CELL.FILLED; changed = true; }
        }
        if (changed) state.gridVersion++;

        // Transition to DISSOLVE as soon as all cells are filled
        if (fillWaveIndexRef.current >= cells.length) {
          state.dissolveParticles = createDissolveParticles(state, dimensions);
          state.dissolveTimer = 0;
          setStage('DISSOLVE');
        }
      } else if (stage === 'DISSOLVE') {
        const state = gs.current;
        state.animationTime += dt * 1000;
        state.dissolveTimer += dt;
        const fallElapsed = state.dissolveTimer - DISSOLVE_JITTER_TIME;
        if (fallElapsed > 0) {
          for (const p of state.dissolveParticles) {
            if (fallElapsed > p.fallDelay) {
              p.vy += DISSOLVE_GRAVITY * dt;
              p.vx *= 0.995;
              p.x += p.vx * dt;
              p.y += p.vy * dt;
            }
          }
        }
        // Transition to INTERSTITIAL once all particles are off-screen
        if (state.dissolveTimer > DISSOLVE_JITTER_TIME + 2.8) {
          setStage('INTERSTITIAL');
        }
      }

      const state = gs.current;
      renderFrame(ctx, canvas, dimensions, {
        grid:                state.grid,
        gridVersion:         state.gridVersion,
        trailParticles:      state.trailParticles,
        trail:               state.trail,
        invalidLoop:         state.invalidLoop,
        invalidLoopTimer:    state.invalidLoopTimer,
        playerDrawing:       state.playerDrawing,
        playerOnBorder:      state.playerOnBorder,
        spiderPos:           state.spiderPos,
        particles:           state.particles,
        floatingTexts:       state.floatingTexts,
        captureFlash:        state.captureFlash,
        damageFlash:         state.damageFlash,
        qixEntities:         state.qixEntities.filter(q => !q.dead).map(q => ({ pos: q.pos, trail: q.trail })),
        dissolveParticles:   state.dissolveParticles,
        isDissolving:        gameStageRef.current === 'DISSOLVE',
        dissolveTimer:       state.dissolveTimer,
        level:               state.level,
        sparks:              state.sparks.map(s => ({ pos: s.pos, migrating: s.migrating, color: s.color })),
        sparksEnabled:       sparksEnabledRef.current,
        bossEnabled:         bossEnabledRef.current,
        animationTime:       state.animationTime,
        bucketAngle:         state.bucketAngle,
        bucketTilt:          state.bucketTilt,
        bucketPitch:         state.bucketPitch,
        captureWaveProgress: state.captureWaveProgress,
        showFullArt:         stage === 'DISSOLVE' || stage === 'INTERSTITIAL',
        levelClearProgress:  0,
      });

      requestRef.current = requestAnimationFrame(update);
    };

    lastTime.current   = performance.now();
    requestRef.current = requestAnimationFrame(update);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [dimensions, loopKey]);

  // Keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameStageRef.current !== 'PLAYING') return;
      let newDir = Direction.NONE;
      switch (e.key) {
        case 'ArrowUp':    case 'w': case 'W': newDir = Direction.UP;    break;
        case 'ArrowDown':  case 's': case 'S': newDir = Direction.DOWN;  break;
        case 'ArrowLeft':  case 'a': case 'A': newDir = Direction.LEFT;  break;
        case 'ArrowRight': case 'd': case 'D': newDir = Direction.RIGHT; break;
      }
      if (newDir !== Direction.NONE) {
        handleFirstInputRef.current();
        const state = gs.current;
        const isOpposite =
          (state.spiderDir === Direction.UP    && newDir === Direction.DOWN)  ||
          (state.spiderDir === Direction.DOWN  && newDir === Direction.UP)    ||
          (state.spiderDir === Direction.LEFT  && newDir === Direction.RIGHT) ||
          (state.spiderDir === Direction.RIGHT && newDir === Direction.LEFT);
        if (!isOpposite) state.spiderDir = newDir;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const dirMap: Record<string, Direction> = {
        'ArrowUp': Direction.UP, 'w': Direction.UP, 'W': Direction.UP,
        'ArrowDown': Direction.DOWN, 's': Direction.DOWN, 'S': Direction.DOWN,
        'ArrowLeft': Direction.LEFT, 'a': Direction.LEFT, 'A': Direction.LEFT,
        'ArrowRight': Direction.RIGHT, 'd': Direction.RIGHT, 'D': Direction.RIGHT,
      };
      const released = dirMap[e.key];
      if (released && released === gs.current.spiderDir) gs.current.spiderDir = Direction.NONE;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup',   handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup',   handleKeyUp);
    };
  }, []);

  const handleJoystickMove = (dir: Direction) => {
    if (dir === Direction.NONE) { gs.current.spiderDir = Direction.NONE; return; }
    handleFirstInputRef.current();
    const state = gs.current;
    const isOpposite =
      (state.spiderDir === Direction.UP    && dir === Direction.DOWN)  ||
      (state.spiderDir === Direction.DOWN  && dir === Direction.UP)    ||
      (state.spiderDir === Direction.LEFT  && dir === Direction.RIGHT) ||
      (state.spiderDir === Direction.RIGHT && dir === Direction.LEFT);
    if (!isOpposite) state.spiderDir = dir;
  };

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden touch-none select-none font-sans" style={{ background: '#0d0820' }}>
      <HUD
        isVisible={gameStage === 'PLAYING' || gameStage === 'LEVEL_CLEAR'}
        level={level}
        capturedPercent={capturedPercent}
        goalPercent={getLevelGoal(level)}
        onPause={() => setIsPaused(true)}
      />

      <div ref={containerRef} className="flex-1 relative flex items-center justify-center overflow-hidden">

        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          className="absolute inset-0 z-1"
        />

        <Overlays
          gameStage={gameStage}
          isPaused={isPaused}
          capturedPercent={capturedPercent}
          level={level}
          deathReason={deathReason}
          onRestart={() => {
            setIsPaused(false);
            startGame(dimensions, { level: savedLevelRef.current });
            setLoopKey(k => k + 1);
          }}
          onResume={() => setIsPaused(false)}
          onNextLevel={() => {
            startGame(dimensions, { level: gs.current.level + 1 });
          }}
          onDebugWin={() => {
            setIsPaused(false);
            const state = gs.current;
            for (let i = 0; i < state.grid.length; i++) {
              if (state.grid[i] === CELL.EMPTY) state.grid[i] = CELL.FILLED;
            }
            state.gridVersion++;
            state.capturedPercent = 100;
            state.qixEntities = [];
            state.sparks = [];
            state.captureWaveProgress = 1;
            fillWaveCellsRef.current = [];
            fillWaveIndexRef.current = 0;
            levelClearTimerRef.current = 0;
            setCapturedPercent(100);
            setStage('LEVEL_CLEAR');
          }}
          onWipeProgress={() => {
            localStorage.removeItem('savedLevel');
            localStorage.removeItem('sparksEnabled');
            localStorage.removeItem('bossEnabled');
            savedLevelRef.current = 1;
            setSparksEnabled(true);
            setBossEnabled(true);
            setIsPaused(false);
            startGame(dimensions, { level: 1 });
            setLoopKey(k => k + 1);
          }}
        />

        {gameStage === 'PLAYING' && <Joystick onMove={handleJoystickMove} />}

        {/* FTUE hint messages */}
        <AnimatePresence>
          {ftueHint && gameStage === 'PLAYING' && (
            <motion.div
              key={ftueHint}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.6 } }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-6 pointer-events-none z-30"
            >
              {/* Animated joystick illustration — only shown for the "Swipe to move" hint */}
              {ftueHint === 'Swipe to move' && (
                <div className="relative flex items-center justify-center" style={{ width: 80, height: 80 }}>
                  {/* Base ring */}
                  <div
                    style={{
                      position: 'absolute',
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      border: '2px solid rgba(253,230,138,0.3)',
                      background: 'rgba(255,255,255,0.05)',
                    }}
                  />
                  {/* Animated knob */}
                  <motion.div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'rgba(253,230,138,0.7)',
                      boxShadow: '0 0 16px rgba(245,166,35,0.6)',
                      position: 'absolute',
                    }}
                    animate={{
                      x: [0, 22, 0, -22, 0],
                      y: [0, 0, 22, 0, -22],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      times: [0, 0.25, 0.5, 0.75, 1],
                    }}
                  />
                </div>
              )}
              <p
                style={{
                  fontFamily: 'sans-serif',
                  fontWeight: 700,
                  fontSize: 'clamp(16px, 4vw, 22px)',
                  color: '#fde68a',
                  textShadow: '0 0 20px rgba(245,166,35,0.7), 0 2px 8px rgba(0,0,0,0.9)',
                  textAlign: 'center',
                  maxWidth: '80%',
                  lineHeight: 1.4,
                  letterSpacing: '0.01em',
                }}
              >
                {ftueHint}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
