/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { ASPECT_RATIO, CROSS_TIME_SECONDS, FIELD_MARGIN, GRID_H, GRID_W } from './constants';
import { Direction, type Dimensions, type FloatingText, type Particle, type Point } from './types';
import { playCaptureSound } from './audio';
import { renderFrame } from './renderer';
import { HUD } from './components/HUD';
import { Joystick } from './components/Joystick';
import { Overlays } from './components/Overlays';

const FUSE_MAX_TIME = 3;   // seconds before the fuse kills the player
const QIX_RADIUS = 16;     // collision radius for Qix
const SPIDER_RADIUS = 12;  // collision radius for spider
const SPARK_RADIUS = 8;
const SPARK_SPEED = 0.3; // fraction of player crossing speed

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [gameState, setGameState] = useState<'PLAYING' | 'GAMEOVER' | 'WIN'>('PLAYING');
  const [isPaused, setIsPaused] = useState(false);
  const [sparksEnabled, setSparksEnabled] = useState(() => localStorage.getItem('sparksEnabled') !== 'false');
  const [bossEnabled, setBossEnabled] = useState(() => localStorage.getItem('bossEnabled') !== 'false');
  const [fuseEnabled, setFuseEnabled] = useState(() => localStorage.getItem('fuseEnabled') !== 'false');
  const [dimensions, setDimensions] = useState<Dimensions>({ width: 0, height: 0, fieldWidth: 0, fieldHeight: 0, offsetX: 0, offsetY: 0 });
  const [capturedPercent, setCapturedPercent] = useState(0);
  const [lives, setLives] = useState(3);

  // Game loop refs
  const capturedPercentRef = useRef(0);
  const livesRef = useRef(3);
  const spiderPos = useRef<Point>({ x: 0, y: 0 });
  const spiderDir = useRef<Direction>(Direction.NONE);
  const qixPos = useRef<Point>({ x: 0, y: 0 });
  const qixVel = useRef<Point>({ x: 0, y: 0 });
  const particles = useRef<Particle[]>([]);
  const floatingTexts = useRef<FloatingText[]>([]);
  const captureFlash = useRef(0);
  const damageFlash = useRef(0);
  const fuseTimer = useRef(0);
  const grid = useRef<Uint8Array>(new Uint8Array(GRID_W * GRID_H));
  // Legacy edge seams: hSeams[y*GRID_W+x]=1 means a historical border ran between row y and y+1 at col x
  //                    vSeams[y*GRID_W+x]=1 means a historical border ran between col x and x+1 at row y
  const seamsH = useRef<Uint8Array>(new Uint8Array(GRID_W * GRID_H));
  const seamsV = useRef<Uint8Array>(new Uint8Array(GRID_W * GRID_H));
  const trail = useRef<Point[]>([]);
  const invalidLoop = useRef<Point[]>([]);
  const sparks = useRef<{ pos: Point; dir: Point; migrating: boolean }[]>([]);
  const isOnSafe = useRef<boolean>(true);
  const isTrailing = useRef<boolean>(false);
  const lastTime = useRef<number>(0);
  const animationTime = useRef<number>(0);
  const requestRef = useRef<number>();
  const gameStateRef = useRef(gameState);
  const isPausedRef = useRef(false);
  const sparksEnabledRef = useRef(true);
  const bossEnabledRef = useRef(true);
  const fuseEnabledRef = useRef(true);
  const hasStarted = useRef(false);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { sparksEnabledRef.current = sparksEnabled; localStorage.setItem('sparksEnabled', String(sparksEnabled)); }, [sparksEnabled]);
  useEffect(() => { bossEnabledRef.current = bossEnabled; localStorage.setItem('bossEnabled', String(bossEnabled)); }, [bossEnabled]);
  useEffect(() => { fuseEnabledRef.current = fuseEnabled; localStorage.setItem('fuseEnabled', String(fuseEnabled)); }, [fuseEnabled]);

  const startGame = () => {
    setGameState('PLAYING');
    setCapturedPercent(0);
    capturedPercentRef.current = 0;
    livesRef.current = 3;
    setLives(3);
    captureFlash.current = 0;
    damageFlash.current = 0;
    fuseTimer.current = 0;
    particles.current = [];
    floatingTexts.current = [];
    spiderPos.current = { x: 0, y: 0 };
    spiderDir.current = Direction.NONE;
    grid.current.fill(0);
    seamsH.current.fill(0);
    seamsV.current.fill(0);
    trail.current = [];
    invalidLoop.current = [];
    sparks.current = [
      { pos: { x: dimensions.fieldWidth * 0.25, y: dimensions.fieldHeight }, dir: { x: -1, y: 0 }, migrating: false },
      { pos: { x: dimensions.fieldWidth * 0.75, y: dimensions.fieldHeight }, dir: { x:  1, y: 0 }, migrating: false },
    ];
    isOnSafe.current = true;
    isTrailing.current = false;
    animationTime.current = 0;
    // Qix starts in center of field, moving diagonally
    qixPos.current = { x: dimensions.fieldWidth / 2, y: dimensions.fieldHeight / 2 };
    const angle = Math.PI / 4 + Math.floor(Math.random() * 4) * (Math.PI / 2);
    const speed = dimensions.fieldWidth * 0.25;
    qixVel.current = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
  };

  // Auto-start once dimensions are ready
  useEffect(() => {
    if (dimensions.fieldWidth > 0 && !hasStarted.current) {
      startGame();
      hasStarted.current = true;
    }
  }, [dimensions]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();

      let fWidth, fHeight;
      if (width / height > ASPECT_RATIO) {
        fHeight = height * (1 - FIELD_MARGIN * 2);
        fWidth = fHeight * ASPECT_RATIO;
      } else {
        fWidth = width * (1 - FIELD_MARGIN * 2);
        fHeight = fWidth / ASPECT_RATIO;
      }

      setDimensions({
        width,
        height,
        fieldWidth: fWidth,
        fieldHeight: fHeight,
        offsetX: (width - fWidth) / 2,
        offsetY: (height - fHeight) / 2,
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

    const getGridPos = (p: Point) => ({
      x: Math.round((p.x / dimensions.fieldWidth) * (GRID_W - 1)),
      y: Math.round((p.y / dimensions.fieldHeight) * (GRID_H - 1)),
    });

    const isSafe = (gx: number, gy: number) => {
      if (gx <= 0 || gx >= GRID_W - 1 || gy <= 0 || gy >= GRID_H - 1) return true;
      return grid.current[gy * GRID_W + gx] === 1;
    };

    // A safe cell is "perimeter" if it borders an uncaptured cell.
    // Border cells use grid state to determine if they've been absorbed into captured territory
    // (fillCapturedArea step 4 marks them grid=1 when their inward neighbor is captured).
    // The player may only walk on perimeter cells; captured interior is off-limits.
    const isPerimeter = (gx: number, gy: number) => {
      if (gx <= 0 || gx >= GRID_W - 1 || gy <= 0 || gy >= GRID_H - 1) {
        return grid.current[gy * GRID_W + gx] !== 1;
      }
      return !isSafe(gx + 1, gy) || !isSafe(gx - 1, gy) || !isSafe(gx, gy + 1) || !isSafe(gx, gy - 1);
    };

    // When the player closes a loop, flood-fill from the Qix position to find the
    // region that contains the Qix. Everything else gets captured.
    const fillCapturedArea = () => {
      // 1. Stamp trail into the grid as safe
      trail.current.forEach(p => {
        const gp = getGridPos(p);
        grid.current[gp.y * GRID_W + gp.x] = 1;
      });

      // 2. Flood fill from Qix position — marks all cells reachable from the Qix
      //    without crossing safe territory (these stay uncaptured)
      const qixGP = getGridPos(qixPos.current);
      const visited = new Uint8Array(GRID_W * GRID_H);

      if (!isSafe(qixGP.x, qixGP.y)) {
        const queue: [number, number][] = [[qixGP.x, qixGP.y]];
        visited[qixGP.y * GRID_W + qixGP.x] = 1;

        while (queue.length > 0) {
          const [cx, cy] = queue.shift()!;
          const neighbors: [number, number][] = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
          for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && !isSafe(nx, ny) && !visited[ny * GRID_W + nx]) {
              visited[ny * GRID_W + nx] = 1;
              queue.push([nx, ny]);
            }
          }
        }
      }

      // 3. Everything not reachable from the Qix gets filled (skip border cells first)
      for (let i = 0; i < GRID_W * GRID_H; i++) {
        const x = i % GRID_W;
        const y = Math.floor(i / GRID_W);
        const onBorder = x === 0 || x === GRID_W - 1 || y === 0 || y === GRID_H - 1;
        if (!visited[i] && !onBorder) grid.current[i] = 1;
      }

      // 4. Extend captured area to border cells whose inward neighbor is captured
      for (let x = 0; x < GRID_W; x++) {
        if (grid.current[1 * GRID_W + x] === 1) grid.current[0 * GRID_W + x] = 1;
        if (grid.current[(GRID_H - 2) * GRID_W + x] === 1) grid.current[(GRID_H - 1) * GRID_W + x] = 1;
      }
      for (let y = 0; y < GRID_H; y++) {
        if (grid.current[y * GRID_W + 1] === 1) grid.current[y * GRID_W + 0] = 1;
        if (grid.current[y * GRID_W + (GRID_W - 2)] === 1) grid.current[y * GRID_W + (GRID_W - 1)] = 1;
      }

      // 5. If the player is now on a non-perimeter cell (surrounded by newly captured
      //    territory), BFS-snap them to the nearest perimeter cell so they can't softlock.
      const playerGP = getGridPos(spiderPos.current);
      if (isSafe(playerGP.x, playerGP.y) && !isPerimeter(playerGP.x, playerGP.y)) {
        const bfsVisited = new Uint8Array(GRID_W * GRID_H);
        const bfsQueue: [number, number][] = [[playerGP.x, playerGP.y]];
        bfsVisited[playerGP.y * GRID_W + playerGP.x] = 1;
        let found: [number, number] | null = null;
        outer: while (bfsQueue.length > 0) {
          const [cx, cy] = bfsQueue.shift()!;
          const nbrs: [number, number][] = [[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]];
          for (const [nx, ny] of nbrs) {
            if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
            if (bfsVisited[ny * GRID_W + nx]) continue;
            bfsVisited[ny * GRID_W + nx] = 1;
            if (isSafe(nx, ny) && isPerimeter(nx, ny)) { found = [nx, ny]; break outer; }
            if (isSafe(nx, ny)) bfsQueue.push([nx, ny]);
          }
        }
        if (found) {
          spiderPos.current = {
            x: (found[0] / (GRID_W - 1)) * dimensions.fieldWidth,
            y: (found[1] / (GRID_H - 1)) * dimensions.fieldHeight,
          };
        }
      }

      // Snap sparks that ended up on non-perimeter cells; if they land within
      // collision range of the player (captured), respawn them at the far corner.
      // Delayed Edge Migration: mark sparks on now-internal cells as migrating.
      // They will finish traversing their current segment before snapping at the next vertex.
      sparks.current = sparks.current.map(spark => {
        const sgp = getGridPos(spark.pos);
        if (isSafe(sgp.x, sgp.y) && !isPerimeter(sgp.x, sgp.y)) {
          return { ...spark, migrating: true };
        }
        return spark;
      });

      let filledCount = 0;
      for (let i = 0; i < GRID_W * GRID_H; i++) {
        if (grid.current[i] === 1) filledCount++;
      }

      const percent = Math.floor((filledCount / (GRID_W * GRID_H)) * 100);
      const capturedThisTime = percent - capturedPercentRef.current;

      if (capturedThisTime > 0) {
        playCaptureSound();
        captureFlash.current = 0.6;

        trail.current.forEach((p, idx) => {
          if (idx % 2 === 0) {
            for (let i = 0; i < 2; i++) {
              particles.current.push({
                pos: { ...p },
                vel: { x: (Math.random() - 0.5) * 100, y: (Math.random() - 0.5) * 100 },
                color: '#10b981',
                life: 0.5 + Math.random() * 0.5,
                maxLife: 1,
                size: 2 + Math.random() * 3,
              });
            }
          }
        });

        floatingTexts.current.push({
          pos: { ...spiderPos.current },
          text: `+${capturedThisTime}%`,
          life: 1.5,
          maxLife: 1.5,
        });
      }

      setCapturedPercent(percent);
      capturedPercentRef.current = percent;
      trail.current = [];
      invalidLoop.current = [];
      isOnSafe.current = true;
      isTrailing.current = false;
      fuseTimer.current = 0;

      // Record the current active border edges as legacy seams so they persist
      // visually once future captures push the boundary further inward.
      for (let y = 0; y < GRID_H - 1; y++) {
        for (let x = 0; x < GRID_W; x++) {
          if ((grid.current[y * GRID_W + x] === 1) !== (grid.current[(y + 1) * GRID_W + x] === 1)) {
            seamsH.current[y * GRID_W + x] = 1;
          }
        }
      }
      for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W - 1; x++) {
          if ((grid.current[y * GRID_W + x] === 1) !== (grid.current[y * GRID_W + x + 1] === 1)) {
            seamsV.current[y * GRID_W + x] = 1;
          }
        }
      }
    };

    // Lose a life: reset spider, decrement lives
    const handleDeath = () => {
      livesRef.current -= 1;
      setLives(livesRef.current);
      damageFlash.current = 0.5;

      if (livesRef.current <= 0) {
        setGameState('GAMEOVER');
        return;
      }

      // Respawn on the nearest point on the physical field border
      const { fieldWidth: fw, fieldHeight: fh } = dimensions;
      const { x: dx, y: dy } = spiderPos.current;
      const dLeft = dx;
      const dRight = fw - dx;
      const dTop = dy;
      const dBottom = fh - dy;
      const minD = Math.min(dLeft, dRight, dTop, dBottom);
      if (minD === dLeft)        spiderPos.current = { x: 0,  y: Math.max(0, Math.min(fh, dy)) };
      else if (minD === dRight)  spiderPos.current = { x: fw, y: Math.max(0, Math.min(fh, dy)) };
      else if (minD === dTop)    spiderPos.current = { x: Math.max(0, Math.min(fw, dx)), y: 0 };
      else                       spiderPos.current = { x: Math.max(0, Math.min(fw, dx)), y: fh };

      spiderDir.current = Direction.NONE;
      trail.current = [];
      invalidLoop.current = [];
      sparks.current = [
        { pos: { x: dimensions.fieldWidth * 0.25, y: dimensions.fieldHeight }, dir: { x: -1, y: 0 }, migrating: false },
        { pos: { x: dimensions.fieldWidth * 0.75, y: dimensions.fieldHeight }, dir: { x:  1, y: 0 }, migrating: false },
      ];
      isOnSafe.current = true;
      isTrailing.current = false;
      fuseTimer.current = 0;
    };

    const update = (time: number) => {
      const dt = Math.min((time - lastTime.current) / 1000, 0.05); // cap dt to avoid spiral of death
      lastTime.current = time;

      if (gameStateRef.current === 'PLAYING' && !isPausedRef.current) {
        animationTime.current += dt * 1000;

        // Flash timers
        if (captureFlash.current > 0) captureFlash.current -= dt;
        if (damageFlash.current > 0) damageFlash.current -= dt;

        // Particles
        particles.current.forEach(p => {
          p.pos.x += p.vel.x * dt;
          p.pos.y += p.vel.y * dt;
          p.life -= dt;
        });
        particles.current = particles.current.filter(p => p.life > 0);

        // Floating texts
        floatingTexts.current.forEach(ft => { ft.pos.y -= 30 * dt; ft.life -= dt; });
        floatingTexts.current = floatingTexts.current.filter(ft => ft.life > 0);

        // ── Fuse (stall penalty while drawing) ──────────────────────────────
        if (fuseEnabledRef.current && isTrailing.current) {
          if (spiderDir.current === Direction.NONE) {
            fuseTimer.current += dt;
            if (fuseTimer.current >= FUSE_MAX_TIME) {
              handleDeath();
            }
          } else {
            fuseTimer.current = 0;
          }
        } else {
          fuseTimer.current = 0;
        }

        // ── Spider movement ──────────────────────────────────────────────────
        if (spiderDir.current !== Direction.NONE) {
          const speed = dimensions.fieldWidth / CROSS_TIME_SECONDS;
          const totalDist = speed * dt;
          const stepSize = 2;
          const numSteps = Math.ceil(totalDist / stepSize);
          const stepDist = totalDist / numSteps;

          for (let step = 0; step < numSteps; step++) {
            let nextX = spiderPos.current.x;
            let nextY = spiderPos.current.y;

            switch (spiderDir.current) {
              case Direction.UP:    nextY -= stepDist; break;
              case Direction.DOWN:  nextY += stepDist; break;
              case Direction.LEFT:  nextX -= stepDist; break;
              case Direction.RIGHT: nextX += stepDist; break;
            }

            // Border clamping
            if (nextX < 0) { nextX = 0; spiderDir.current = Direction.NONE; }
            if (nextX > dimensions.fieldWidth) { nextX = dimensions.fieldWidth; spiderDir.current = Direction.NONE; }
            if (nextY < 0) { nextY = 0; spiderDir.current = Direction.NONE; }
            if (nextY > dimensions.fieldHeight) { nextY = dimensions.fieldHeight; spiderDir.current = Direction.NONE; }

            const nextPos = { x: nextX, y: nextY };
            const gp = getGridPos(nextPos);
            const currentlySafe = isSafe(gp.x, gp.y);

            // Block movement into captured interior — player may only walk the perimeter.
            // When blocked, slide perpendicular toward the nearest perimeter cell so
            // the player smoothly rounds corners instead of hard-stopping.
            if (isOnSafe.current && currentlySafe && !isPerimeter(gp.x, gp.y)) {
              const isHoriz = spiderDir.current === Direction.LEFT || spiderDir.current === Direction.RIGHT;
              let nearestDist = Infinity;
              let nearestSign = 0;

              for (const sign of [-1, 1]) {
                for (let px = 1; px <= 40; px++) {
                  const tp = {
                    x: spiderPos.current.x + (isHoriz ? 0 : sign * px),
                    y: spiderPos.current.y + (isHoriz ? sign * px : 0),
                  };
                  const tgp = getGridPos(tp);
                  if (tgp.x < 0 || tgp.x >= GRID_W || tgp.y < 0 || tgp.y >= GRID_H) break;
                  if (!isSafe(tgp.x, tgp.y) || isPerimeter(tgp.x, tgp.y)) {
                    if (px < nearestDist) { nearestDist = px; nearestSign = sign; }
                    break;
                  }
                }
              }

              if (nearestSign !== 0) {
                const slideDist = Math.min(stepDist, nearestDist);
                const slidePos = {
                  x: spiderPos.current.x + (isHoriz ? 0 : nearestSign * slideDist),
                  y: spiderPos.current.y + (isHoriz ? nearestSign * slideDist : 0),
                };
                const slideGP = getGridPos(slidePos);
                if (isSafe(slideGP.x, slideGP.y)) spiderPos.current = slidePos;
              }
              // continue instead of break: retry forward movement from the slid position
              // so the player automatically rounds the corner without getting stuck
              continue;
            }

            if (isOnSafe.current && !currentlySafe) {
              // Leaving safe zone — start drawing
              isOnSafe.current = false;
              isTrailing.current = true;
              trail.current = [spiderPos.current, nextPos];
            } else if (!isOnSafe.current) {
              if (currentlySafe) {
                // Returned to safe zone — close the loop
                spiderPos.current = nextPos;
                if (isTrailing.current) fillCapturedArea();
                isOnSafe.current = true;
                isTrailing.current = false;
                spiderDir.current = Direction.NONE;
              } else if (isTrailing.current) {
                // Check self-intersection — non-lethal: trim trail back to hit point
                let hitIndex = -1;
                for (let i = 0; i < trail.current.length - 4; i++) {
                  if (Math.hypot(trail.current[i].x - nextX, trail.current[i].y - nextY) < 5) {
                    hitIndex = i;
                    break;
                  }
                }
                if (hitIndex >= 0) {
                  // Store the cut-off loop for red highlight, trim trail, snap player
                  invalidLoop.current = trail.current.slice(hitIndex);
                  trail.current = trail.current.slice(0, hitIndex + 1);
                  spiderPos.current = { ...trail.current[hitIndex] };
                } else {
                  invalidLoop.current = [];
                  trail.current.push(nextPos);
                }
              }
            }

            spiderPos.current = nextPos;
            if (spiderDir.current === Direction.NONE) break;
          }
        }

        // ── Qix movement ─────────────────────────────────────────────────────
        if (bossEnabledRef.current) {
          const speed = Math.hypot(qixVel.current.x, qixVel.current.y);
          let nextQx = qixPos.current.x + qixVel.current.x * dt;
          let nextQy = qixPos.current.y + qixVel.current.y * dt;

          // Bounce off safe zones and field edges (check each axis separately)
          const gpX = getGridPos({ x: nextQx, y: qixPos.current.y });
          const gpY = getGridPos({ x: qixPos.current.x, y: nextQy });
          const hitX = nextQx < 0 || nextQx > dimensions.fieldWidth || isSafe(gpX.x, gpX.y);
          const hitY = nextQy < 0 || nextQy > dimensions.fieldHeight || isSafe(gpY.x, gpY.y);

          if (hitX) {
            qixVel.current.x = -qixVel.current.x;
            nextQx = qixPos.current.x + qixVel.current.x * dt;
          }
          if (hitY) {
            qixVel.current.y = -qixVel.current.y;
            nextQy = qixPos.current.y + qixVel.current.y * dt;
          }

          // If still stuck (corner), add a slight nudge
          const finalGP = getGridPos({ x: nextQx, y: nextQy });
          if (isSafe(finalGP.x, finalGP.y)) {
            qixVel.current.x = -qixVel.current.x;
            qixVel.current.y = -qixVel.current.y;
            nextQx = qixPos.current.x;
            nextQy = qixPos.current.y;
          }

          // Re-normalise speed in case of floating-point drift
          const currentSpeed = Math.hypot(qixVel.current.x, qixVel.current.y);
          if (currentSpeed > 0 && Math.abs(currentSpeed - speed) > 1) {
            qixVel.current.x = (qixVel.current.x / currentSpeed) * speed;
            qixVel.current.y = (qixVel.current.y / currentSpeed) * speed;
          }

          qixPos.current = { x: nextQx, y: nextQy };
        }

        // ── Qix collision detection ──────────────────────────────────────────
        if (bossEnabledRef.current && isTrailing.current) {
          // Qix touches the incomplete trail
          const qixHitsTrail = trail.current.some(p =>
            Math.hypot(p.x - qixPos.current.x, p.y - qixPos.current.y) < QIX_RADIUS + 3,
          );
          // Qix touches the spider directly while drawing
          const qixHitsSpider =
            Math.hypot(spiderPos.current.x - qixPos.current.x, spiderPos.current.y - qixPos.current.y) <
            QIX_RADIUS + SPIDER_RADIUS;

          if (qixHitsTrail || qixHitsSpider) {
            handleDeath();
          }
        }

        // ── Spark movement (directional junction logic) ───────────────────
        if (sparksEnabledRef.current) {
          const { fieldWidth: fw, fieldHeight: fh } = dimensions;
          const baseSpeed = (fw / CROSS_TIME_SECONDS) * SPARK_SPEED;
          // Speed scales with captured area
          const sparkSpeed = baseSpeed * (1 + capturedPercentRef.current * 0.015);

          // While player is drawing, chase the trail entry point (last safe position)
          const sparkTarget = isTrailing.current && trail.current.length > 0
            ? trail.current[0]
            : spiderPos.current;

          const cardinals: Point[] = [
            { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
          ];

          for (let si = 0; si < sparks.current.length; si++) {
            let { pos, dir, migrating } = sparks.current[si];
            let remaining = sparkSpeed * dt;

            while (remaining > 0) {
              const step = Math.min(remaining, 2);
              remaining -= step;

              if (migrating) {
                // Delayed Edge Migration: move straight through captured territory,
                // ignoring the perimeter constraint, until we reach a vertex.
                const rawX = pos.x + dir.x * step;
                const rawY = pos.y + dir.y * step;
                const clampedX = Math.max(0, Math.min(fw, rawX));
                const clampedY = Math.max(0, Math.min(fh, rawY));
                const hitBoundary = clampedX !== rawX || clampedY !== rawY;

                pos = { x: clampedX, y: clampedY };

                if (hitBoundary) {
                  // Hit the field boundary — check if we landed on an active perimeter cell
                  const clampedGP = getGridPos(pos);
                  if (isSafe(clampedGP.x, clampedGP.y) && isPerimeter(clampedGP.x, clampedGP.y)) {
                    migrating = false;
                  } else {
                    // Still inside captured territory on the wall — turn 90° toward spark target
                    // so the spark smoothly walks the wall until it finds the active perimeter
                    const dx = sparkTarget.x - pos.x;
                    const dy = sparkTarget.y - pos.y;
                    if (dir.x !== 0) {
                      // Was moving horizontally, turn vertically
                      dir = { x: 0, y: dy >= 0 ? 1 : -1 };
                    } else {
                      // Was moving vertically, turn horizontally
                      dir = { x: dx >= 0 ? 1 : -1, y: 0 };
                    }
                  }
                } else {
                  // Check if we've organically reached a perimeter cell — migration done
                  const tryGP = getGridPos(pos);
                  if (isSafe(tryGP.x, tryGP.y) && isPerimeter(tryGP.x, tryGP.y)) {
                    migrating = false;
                  }
                }
              } else {
                // Normal movement: stay on the active perimeter
                const tryPos = {
                  x: Math.max(0, Math.min(fw, pos.x + dir.x * step)),
                  y: Math.max(0, Math.min(fh, pos.y + dir.y * step)),
                };
                const tryGP = getGridPos(tryPos);
                // Treat zero-movement (fully clamped at corner) as blocked so junction logic fires
                const didMove = tryPos.x !== pos.x || tryPos.y !== pos.y;

                if (didMove && isSafe(tryGP.x, tryGP.y) && isPerimeter(tryGP.x, tryGP.y)) {
                  pos = tryPos;
                } else {
                  // Junction / dead-end: evaluate candidates (no U-turn)
                  const backward = { x: -dir.x, y: -dir.y };
                  let bestDir: Point | null = null;
                  let bestDist = Infinity;

                  for (const d of cardinals) {
                    if (d.x === backward.x && d.y === backward.y) continue;
                    const cPos = {
                      x: Math.max(0, Math.min(fw, pos.x + d.x * 4)),
                      y: Math.max(0, Math.min(fh, pos.y + d.y * 4)),
                    };
                    // Skip directions where clamping produces no movement (e.g. left at x=0)
                    if (cPos.x === pos.x && cPos.y === pos.y) continue;
                    const cGP = getGridPos(cPos);
                    if (!isSafe(cGP.x, cGP.y) || !isPerimeter(cGP.x, cGP.y)) continue;
                    const dist = Math.hypot(cPos.x - sparkTarget.x, cPos.y - sparkTarget.y);
                    if (dist < bestDist) { bestDist = dist; bestDir = d; }
                  }

                  // Fall back to reversal if completely blocked
                  if (bestDir === null) bestDir = backward;
                  dir = bestDir;

                  const newPos = {
                    x: Math.max(0, Math.min(fw, pos.x + dir.x * step)),
                    y: Math.max(0, Math.min(fh, pos.y + dir.y * step)),
                  };
                  const newGP = getGridPos(newPos);
                  if (isSafe(newGP.x, newGP.y) && isPerimeter(newGP.x, newGP.y)) pos = newPos;
                }
              }
            }

            sparks.current[si] = { pos, dir, migrating };
          }

          // Spark–spark collision: reverse both when they meet
          if (sparks.current.length >= 2) {
            const s0 = sparks.current[0];
            const s1 = sparks.current[1];
            if (Math.hypot(s0.pos.x - s1.pos.x, s0.pos.y - s1.pos.y) < SPARK_RADIUS * 2) {
              sparks.current[0] = { pos: s0.pos, dir: { x: -s0.dir.x, y: -s0.dir.y }, migrating: s0.migrating };
              sparks.current[1] = { pos: s1.pos, dir: { x: -s1.dir.x, y: -s1.dir.y }, migrating: s1.migrating };
            }
          }

          // Spark–player collision (only while on boundary, and not during i-frames after damage)
          if (isOnSafe.current && damageFlash.current <= 0) {
            for (const spark of sparks.current) {
              if (spark.migrating) continue; // in-transit sparks don't hurt the player
              if (Math.hypot(spark.pos.x - spiderPos.current.x, spark.pos.y - spiderPos.current.y) < SPARK_RADIUS + SPIDER_RADIUS) {
                handleDeath();
                break;
              }
            }
          }
        }

        // Win condition
        if (capturedPercentRef.current >= 80) {
          setGameState('WIN');
        }
      }

      renderFrame(ctx, canvas, dimensions, {
        grid: grid.current,
        seamsH: seamsH.current,
        seamsV: seamsV.current,
        trail: trail.current,
        invalidLoop: invalidLoop.current,
        isTrailing: isTrailing.current,
        isOnSafe: isOnSafe.current,
        spiderPos: spiderPos.current,
        particles: particles.current,
        floatingTexts: floatingTexts.current,
        captureFlash: captureFlash.current,
        damageFlash: damageFlash.current,
        qixPos: qixPos.current,
        sparks: sparks.current.map(s => s.pos),
        sparksEnabled: sparksEnabledRef.current,
        bossEnabled: bossEnabledRef.current,
        fuseProgress: isTrailing.current ? fuseTimer.current / FUSE_MAX_TIME : 0,
        animationTime: animationTime.current,
      });

      requestRef.current = requestAnimationFrame(update);
    };

    lastTime.current = performance.now();
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
        const isOpposite =
          (spiderDir.current === Direction.UP    && newDir === Direction.DOWN)  ||
          (spiderDir.current === Direction.DOWN  && newDir === Direction.UP)    ||
          (spiderDir.current === Direction.LEFT  && newDir === Direction.RIGHT) ||
          (spiderDir.current === Direction.RIGHT && newDir === Direction.LEFT);

        if (!isOpposite) spiderDir.current = newDir;
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
      if (released && released === spiderDir.current) {
        spiderDir.current = Direction.NONE;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleJoystickMove = (dir: Direction) => {
    if (dir === Direction.NONE) {
      spiderDir.current = Direction.NONE;
      return;
    }
    const isOpposite =
      (spiderDir.current === Direction.UP    && dir === Direction.DOWN)  ||
      (spiderDir.current === Direction.DOWN  && dir === Direction.UP)    ||
      (spiderDir.current === Direction.LEFT  && dir === Direction.RIGHT) ||
      (spiderDir.current === Direction.RIGHT && dir === Direction.LEFT);

    if (!isOpposite) spiderDir.current = dir;
  };

  return (
    <div className="fixed inset-0 bg-stone-900 flex flex-col overflow-hidden touch-none select-none font-sans">
      <HUD
        isVisible={gameState === 'PLAYING'}
        capturedPercent={capturedPercent}
        lives={lives}
        onPause={() => setIsPaused(true)}
      />

      <div ref={containerRef} className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://i.pinimg.com/1200x/37/f9/e7/37f9e7f2464de08adc96ea62f3592b88.jpg"
            alt="Forest Background"
            className="w-full h-full object-cover opacity-70 brightness-75"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-stone-900/60 via-transparent to-stone-900/90" />
        </div>

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
          onRestart={() => { setIsPaused(false); startGame(); }}
          onResume={() => setIsPaused(false)}
        />

        {gameState === 'PLAYING' && <Joystick onMove={handleJoystickMove} />}
      </div>
    </div>
  );
}
