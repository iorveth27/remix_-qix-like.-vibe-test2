/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { ASPECT_RATIO, CELL, FIELD_MARGIN, FUSE_MAX_TIME, GRID_H, GRID_W, UI_HEIGHT_RESERVE, WIN_PERCENT } from './constants';
import { Direction, type Dimensions } from './types';
import { playCaptureSound } from './audio';
import { renderFrame } from './renderer';
import { HUD } from './components/HUD';
import { Joystick } from './components/Joystick';
import { Overlays } from './components/Overlays';
import { createGameState } from './game/GameState';
import { getGridPos, gridToWorld, isWalkable } from './game/grid';
import { fillCapturedArea } from './game/territory';
import { tickPlayer } from './game/player';
import { tickQix } from './game/qix';
import { tickSparks } from './game/sparks';
import { tickParticles } from './game/particles';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);

  const [gameState,       setGameState]       = useState<'PLAYING' | 'GAMEOVER' | 'WIN'>('PLAYING');
  const [isPaused,        setIsPaused]        = useState(false);
  const [sparksEnabled,   setSparksEnabled]   = useState(() => localStorage.getItem('sparksEnabled') !== 'false');
  const [bossEnabled,     setBossEnabled]     = useState(() => localStorage.getItem('bossEnabled') !== 'false');
  const [fuseEnabled,     setFuseEnabled]     = useState(() => localStorage.getItem('fuseEnabled') !== 'false');
  const [dimensions,      setDimensions]      = useState<Dimensions>({ width: 0, height: 0, fieldWidth: 0, fieldHeight: 0, offsetX: 0, offsetY: 0 });
  const [capturedPercent, setCapturedPercent] = useState(0);
  const [lives,           setLives]           = useState(3);

  const gs = useRef(createGameState());

  const lastTime         = useRef<number>(0);
  const requestRef       = useRef<number>();
  const gameStateRef     = useRef(gameState);
  const isPausedRef      = useRef(false);
  const sparksEnabledRef = useRef(true);
  const bossEnabledRef   = useRef(true);
  const fuseEnabledRef   = useRef(true);
  const hasStarted       = useRef(false);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { isPausedRef.current  = isPaused;  }, [isPaused]);
  useEffect(() => { sparksEnabledRef.current = sparksEnabled; localStorage.setItem('sparksEnabled', String(sparksEnabled)); }, [sparksEnabled]);
  useEffect(() => { bossEnabledRef.current   = bossEnabled;   localStorage.setItem('bossEnabled',   String(bossEnabled));   }, [bossEnabled]);
  useEffect(() => { fuseEnabledRef.current   = fuseEnabled;   localStorage.setItem('fuseEnabled',   String(fuseEnabled));   }, [fuseEnabled]);

  const startGame = (dims: Dimensions) => {
    const state = createGameState();

    // Player starts at the middle of the top EDGE row so moving DOWN enters EMPTY immediately
    state.spiderPos = { x: dims.fieldWidth / 2, y: 0 };

    // QIX starts at center with random Verlet-seeded velocity
    const angle = Math.PI / 4 + Math.floor(Math.random() * 4) * (Math.PI / 2);
    const speed = dims.fieldWidth * 0.25;
    const dt0   = 1 / 60;
    state.qixPos     = { x: dims.fieldWidth / 2, y: dims.fieldHeight / 2 };
    state.qixLastPos = {
      x: state.qixPos.x - Math.cos(angle) * speed * dt0,
      y: state.qixPos.y - Math.sin(angle) * speed * dt0,
    };
    state.qixVel   = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
    state.qixAngle = angle;

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
    setGameState('PLAYING');
    setCapturedPercent(0);
    setLives(3);
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
    if (gameState !== 'PLAYING') return;
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
        setGameState('GAMEOVER');
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

      // Top and bottom rows
      for (let x = 0; x < GRID_W; x++) { checkBorderCell(x, 0); checkBorderCell(x, GRID_H - 1); }
      // Left and right columns (excluding corners already covered)
      for (let y = 1; y < GRID_H - 1; y++) { checkBorderCell(0, y); checkBorderCell(GRID_W - 1, y); }

      // Fallback: top-left corner (always EDGE)
      if (bestDist === Infinity) bestPos = { x: 0, y: 0 };

      state.spiderPos      = bestPos;
      state.spiderDir      = Direction.NONE;
      state.trail          = [];
      state.trailParticles = [];
      state.invalidLoop    = [];
      state.playerOnBorder = true;
      state.playerDrawing  = false;
      state.fuseTimer      = 0;

      // Reset sparks to border positions
      const spark1gx = Math.round(0.25 * (GRID_W - 1));
      const spark1gy = GRID_H - 1;
      const spark2gx = Math.round(0.75 * (GRID_W - 1));
      const spark2gy = GRID_H - 1;
      state.sparks = [
        { pos: gridToWorld(spark1gx, spark1gy, dimensions), gx: spark1gx, gy: spark1gy, dir: { x: -1, y: 0 }, type: 'chaser',  migrating: false, targetGX: spark1gx, targetGY: spark1gy },
        { pos: gridToWorld(spark2gx, spark2gy, dimensions), gx: spark2gx, gy: spark2gy, dir: { x:  1, y: 0 }, type: 'random', migrating: false, targetGX: spark2gx, targetGY: spark2gy },
      ];
    };

    const update = (time: number) => {
      const dt = Math.min((time - lastTime.current) / 1000, 0.05);
      lastTime.current = time;

      if (gameStateRef.current === 'PLAYING' && !isPausedRef.current) {
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
            setCapturedPercent(state.capturedPercent);
          }
        }, fuseEnabledRef.current);

        if (bossEnabledRef.current)   tickQix(state, dt, dimensions, handleDeath);
        if (sparksEnabledRef.current) tickSparks(state, dt, dimensions, handleDeath);

        if (state.capturedPercent >= WIN_PERCENT) setGameState('WIN');
      }

      const state = gs.current;
      renderFrame(ctx, canvas, dimensions, {
        grid:                state.grid,
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
        qixPos:              state.qixPos,
        sparks:              state.sparks.map(s => ({ pos: s.pos, migrating: s.migrating })),
        sparksEnabled:       sparksEnabledRef.current,
        bossEnabled:         bossEnabledRef.current,
        fuseProgress:        state.playerDrawing ? state.fuseTimer / FUSE_MAX_TIME : 0,
        animationTime:       state.animationTime,
        bucketAngle:         state.bucketAngle,
        bucketTilt:          state.bucketTilt,
        bucketPitch:         state.bucketPitch,
        captureWaveProgress: state.captureWaveProgress,
        isMoving:            state.spiderDir !== Direction.NONE,
      });

      requestRef.current = requestAnimationFrame(update);
    };

    lastTime.current   = performance.now();
    requestRef.current = requestAnimationFrame(update);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [dimensions]);

  // Keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameStateRef.current !== 'PLAYING') return;
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
        isVisible={gameState === 'PLAYING'}
        capturedPercent={capturedPercent}
        lives={lives}
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
          gameState={gameState}
          isPaused={isPaused}
          capturedPercent={capturedPercent}
          sparksEnabled={sparksEnabled}
          bossEnabled={bossEnabled}
          fuseEnabled={fuseEnabled}
          onToggleSparks={() => setSparksEnabled(v => !v)}
          onToggleBoss={() => setBossEnabled(v => !v)}
          onToggleFuse={() => setFuseEnabled(v => !v)}
          onRestart={() => { setIsPaused(false); startGame(dimensions); }}
          onResume={() => setIsPaused(false)}
        />

        {gameState === 'PLAYING' && <Joystick onMove={handleJoystickMove} />}
      </div>
    </div>
  );
}
