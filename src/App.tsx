/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ASPECT_RATIO, BONUS_PER_PERCENT, CELL, DISSOLVE_GRAVITY, DISSOLVE_JITTER_TIME,
  FIELD_MARGIN, FUSE_MAX_TIME, GRID_H, GRID_W, LEVEL_CLEAR_DELAY, LEVEL_PALETTES,
  UI_HEIGHT_RESERVE, WIN_PERCENT,
} from './constants';
import { Direction, type Dimensions, type DissolveParticle, type QixEntity } from './types';
import { playCaptureSound } from './audio';
import { renderFrame } from './renderer';
import { HUD } from './components/HUD';
import { Joystick } from './components/Joystick';
import { Overlays } from './components/Overlays';
import { createGameState } from './game/GameState';
import type { GameState } from './game/GameState';
import { getGridPos, gridToWorld, isWalkable } from './game/grid';
import { fillCapturedArea } from './game/territory';
import { tickPlayer } from './game/player';
import { tickQixEntity } from './game/qix';
import { tickSparks } from './game/sparks';
import { tickParticles } from './game/particles';

type GameStage = 'PLAYING' | 'LEVEL_CLEAR' | 'DISSOLVE' | 'INTERSTITIAL' | 'GAMEOVER';

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
  const [fuseEnabled,     setFuseEnabled]     = useState(() => localStorage.getItem('fuseEnabled') !== 'false');
  const [dimensions,      setDimensions]      = useState<Dimensions>({ width: 0, height: 0, fieldWidth: 0, fieldHeight: 0, offsetX: 0, offsetY: 0 });
  const [capturedPercent, setCapturedPercent] = useState(0);
  const [lives,           setLives]           = useState(3);
  const [level,           setLevel]           = useState(1);
  const [score,           setScore]           = useState(0);
  const [highscore,       setHighscore]       = useState(() => parseInt(localStorage.getItem('highscore') ?? '0', 10));
  const [levelBonus,      setLevelBonus]      = useState(0);
  const [loopKey,         setLoopKey]         = useState(0);

  const gs = useRef(createGameState());

  const lastTime            = useRef<number>(0);
  const requestRef          = useRef<number>();
  const gameStageRef        = useRef<GameStage>('PLAYING');
  const isPausedRef         = useRef(false);
  const sparksEnabledRef    = useRef(true);
  const bossEnabledRef      = useRef(true);
  const fuseEnabledRef      = useRef(true);
  const hasStarted = useRef(false);
  const highscoreRef = useRef(parseInt(localStorage.getItem('highscore') ?? '0', 10));
  const levelClearTimerRef = useRef(0);

  const setStage = (s: GameStage) => {
    gameStageRef.current = s;
    setGameStage(s);
  };

  useEffect(() => { isPausedRef.current  = isPaused;  }, [isPaused]);
  useEffect(() => { sparksEnabledRef.current = sparksEnabled; localStorage.setItem('sparksEnabled', String(sparksEnabled)); }, [sparksEnabled]);
  useEffect(() => { bossEnabledRef.current   = bossEnabled;   localStorage.setItem('bossEnabled',   String(bossEnabled));   }, [bossEnabled]);
  useEffect(() => { fuseEnabledRef.current   = fuseEnabled;   localStorage.setItem('fuseEnabled',   String(fuseEnabled));   }, [fuseEnabled]);

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
    };
  };

  const startGame = (dims: Dimensions, opts?: { level?: number; lives?: number; score?: number }) => {
    const lvl = opts?.level ?? 1;
    const state = createGameState(lvl);

    // Player starts at the middle of the top EDGE row so moving DOWN enters EMPTY immediately
    state.spiderPos = { x: dims.fieldWidth / 2, y: 0 };

    // QIX entities based on level
    state.qixEntities = [makeQix(dims.fieldWidth / 2, dims.fieldHeight / 2)];
    if (lvl >= 3) {
      state.qixEntities.push(makeQix(dims.fieldWidth * 2 / 3, dims.fieldHeight / 3));
    }

    state.lives = Math.min(opts?.lives ?? 3, 3);
    state.score = opts?.score ?? 0;
    state.level = lvl;

    // Sparks start on the bottom EDGE row
    const spark1gx = Math.round(0.25 * (GRID_W - 1));
    const spark1gy = GRID_H - 1;
    const spark2gx = Math.round(0.75 * (GRID_W - 1));
    const spark2gy = GRID_H - 1;
    state.sparks = [
      { pos: gridToWorld(spark1gx, spark1gy, dims), gx: spark1gx, gy: spark1gy, dir: { x: -1, y: 0 }, type: 'chaser',  migrating: false, targetGX: spark1gx, targetGY: spark1gy },
      { pos: gridToWorld(spark2gx, spark2gy, dims), gx: spark2gx, gy: spark2gy, dir: { x:  1, y: 0 }, type: 'random', migrating: false, targetGX: spark2gx, targetGY: spark2gy },
    ];

    gs.current = state;
    setLevel(lvl);
    setScore(state.score);
    setCapturedPercent(0);
    setLives(state.lives);
    setStage('PLAYING');
  };

  // Auto-start once dimensions are ready
  useEffect(() => {
    if (dimensions.fieldWidth > 0 && !hasStarted.current) {
      startGame(dimensions);
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

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Game loop
  useEffect(() => {
    if (gameStageRef.current === 'GAMEOVER') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleDeath = () => {
      const state = gs.current;
      state.lives      -= 1;
      state.damageFlash = 0.5;
      setLives(state.lives);

      // Sand grain death explosion
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

      if (state.lives <= 0) {
        setStage('GAMEOVER');
        return;
      }

      // Revert any active trail NEWLINE cells back to EMPTY
      for (let i = 0; i < GRID_W * GRID_H; i++) {
        if (state.grid[i] === CELL.NEWLINE) state.grid[i] = CELL.EMPTY;
      }

      // Respawn on the nearest EDGE/LINE cell on the physical border
      const { x: dx, y: dy } = state.spiderPos;
      let bestDist = Infinity;
      let bestPos  = { x: 0, y: 0 };

      const checkBorderCell = (gx: number, gy: number) => {
        if (!isWalkable(state.grid, gx, gy)) return;
        const wp   = gridToWorld(gx, gy, dimensions);
        const dist = Math.hypot(wp.x - dx, wp.y - dy);
        if (dist < bestDist) { bestDist = dist; bestPos = wp; }
      };

      // Physical border rows/cols first (EDGE cells adjacent to remaining EMPTY space)
      for (let x = 0; x < GRID_W; x++) { checkBorderCell(x, 0); checkBorderCell(x, GRID_H - 1); }
      for (let y = 1; y < GRID_H - 1; y++) { checkBorderCell(0, y); checkBorderCell(GRID_W - 1, y); }

      // Fallback: scan all LINE cells (interior perimeter seams bordering EMPTY)
      if (bestDist === Infinity) {
        for (let gy = 0; gy < GRID_H; gy++) {
          for (let gx = 0; gx < GRID_W; gx++) {
            checkBorderCell(gx, gy);
          }
        }
      }

      // Last resort: top-left corner
      if (bestDist === Infinity) bestPos = gridToWorld(0, 0, dimensions);

      state.spiderPos      = bestPos;
      state.spiderDir      = Direction.NONE;
      state.trail          = [];
      state.trailParticles = [];
      state.invalidLoop    = [];
      state.playerOnBorder = true;
      state.playerDrawing  = false;
      state.fuseTimer      = 0;

      // Reset sparks to the walkable cells farthest from the player's respawn position
      const respawnGP = getGridPos(bestPos, dimensions);
      const sparkCandidates: { gx: number; gy: number; dist: number }[] = [];
      for (let i = 0; i < GRID_W * GRID_H; i++) {
        const cgx = i % GRID_W, cgy = Math.floor(i / GRID_W);
        if (isWalkable(state.grid, cgx, cgy)) {
          sparkCandidates.push({ gx: cgx, gy: cgy, dist: Math.abs(cgx - respawnGP.x) + Math.abs(cgy - respawnGP.y) });
        }
      }
      sparkCandidates.sort((a, b) => b.dist - a.dist);
      const sp1 = sparkCandidates[0] ?? { gx: Math.round(0.25 * (GRID_W - 1)), gy: GRID_H - 1 };
      // sp2: farthest candidate that's also well-separated from sp1
      const sp2 = sparkCandidates.find(c => Math.abs(c.gx - sp1.gx) + Math.abs(c.gy - sp1.gy) > GRID_W / 3)
               ?? sparkCandidates[1]
               ?? { gx: Math.round(0.75 * (GRID_W - 1)), gy: GRID_H - 1 };
      state.sparks = [
        { pos: gridToWorld(sp1.gx, sp1.gy, dimensions), gx: sp1.gx, gy: sp1.gy, dir: { x: -1, y: 0 }, type: 'chaser',  migrating: false, targetGX: sp1.gx, targetGY: sp1.gy },
        { pos: gridToWorld(sp2.gx, sp2.gy, dimensions), gx: sp2.gx, gy: sp2.gy, dir: { x:  1, y: 0 }, type: 'random', migrating: false, targetGX: sp2.gx, targetGY: sp2.gy },
      ];
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

        tickPlayer(state, dt, dimensions, handleDeath, () => {
          const captured = fillCapturedArea(state, dimensions);
          if (captured > 0) {
            playCaptureSound();
            const earned = Math.round(Math.pow(captured, 1.8) * 80);
            state.score += earned;
            state.floatingTexts.push({
              pos: { ...state.spiderPos },
              text: `+${earned.toLocaleString()}`,
              life: 1.8,
              maxLife: 1.8,
            });
            if (state.score > (highscoreRef.current ?? 0)) {
              highscoreRef.current = state.score;
              setHighscore(state.score);
              localStorage.setItem('highscore', String(state.score));
            }
            setScore(state.score);
            setCapturedPercent(state.capturedPercent);
          }
        }, fuseEnabledRef.current);

        if (bossEnabledRef.current) {
          for (const entity of state.qixEntities) {
            tickQixEntity(entity, state, dt, dimensions, handleDeath);
          }
        }
        if (sparksEnabledRef.current) tickSparks(state, dt, dimensions, handleDeath);

        if (state.capturedPercent >= WIN_PERCENT) {
          const overCapture = Math.max(0, state.capturedPercent - WIN_PERCENT);
          const bonus = overCapture * BONUS_PER_PERCENT;
          state.levelBonus = bonus;
          state.score += bonus;
          setLevelBonus(bonus);
          setScore(state.score);
          if (state.score > highscoreRef.current) {
            highscoreRef.current = state.score;
            setHighscore(state.score);
            localStorage.setItem('highscore', String(state.score));
          }
          levelClearTimerRef.current = 0;
          setStage('LEVEL_CLEAR');
        }
      } else if (stage === 'LEVEL_CLEAR') {
        gs.current.animationTime += dt * 1000;
        levelClearTimerRef.current += dt;
        if (levelClearTimerRef.current >= LEVEL_CLEAR_DELAY) {
          const state = gs.current;
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
        qixEntities:         state.qixEntities.map(q => ({ pos: q.pos, trail: q.trail })),
        dissolveParticles:   state.dissolveParticles,
        isDissolving:        gameStageRef.current === 'DISSOLVE',
        dissolveTimer:       state.dissolveTimer,
        level:               state.level,
        sparks:              state.sparks.map(s => ({ pos: s.pos, migrating: s.migrating })),
        sparksEnabled:       sparksEnabledRef.current,
        bossEnabled:         bossEnabledRef.current,
        fuseProgress:        state.playerDrawing ? state.fuseTimer / FUSE_MAX_TIME : 0,
        animationTime:       state.animationTime,
        bucketAngle:         state.bucketAngle,
        bucketTilt:          state.bucketTilt,
        bucketPitch:         state.bucketPitch,
        captureWaveProgress: state.captureWaveProgress,
        showFullArt:         stage === 'DISSOLVE' || stage === 'INTERSTITIAL',
        levelClearProgress:  stage === 'LEVEL_CLEAR' ? Math.min(levelClearTimerRef.current / LEVEL_CLEAR_DELAY, 1) : 0,
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
        lives={lives}
        score={score}
        highscore={highscore}
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
          score={score}
          sparksEnabled={sparksEnabled}
          bossEnabled={bossEnabled}
          fuseEnabled={fuseEnabled}
          onToggleSparks={() => setSparksEnabled(v => !v)}
          onToggleBoss={() => setBossEnabled(v => !v)}
          onToggleFuse={() => setFuseEnabled(v => !v)}
          onRestart={() => {
            setIsPaused(false);
            startGame(dimensions);
            setLoopKey(k => k + 1);
          }}
          onResume={() => setIsPaused(false)}
          onNextLevel={() => {
            const state = gs.current;
            startGame(dimensions, { level: state.level + 1, lives: state.lives, score: state.score });
          }}
        />

        {gameStage === 'PLAYING' && <Joystick onMove={handleJoystickMove} />}
      </div>
    </div>
  );
}
