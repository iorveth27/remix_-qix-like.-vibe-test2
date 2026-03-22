import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, RotateCcw, ArrowRight } from 'lucide-react';
import { AnimatedCounter } from './HUD';

type GameStage = 'PLAYING' | 'LEVEL_CLEAR' | 'DISSOLVE' | 'INTERSTITIAL' | 'GAMEOVER';

interface OverlaysProps {
  gameStage: GameStage;
  isPaused: boolean;
  capturedPercent: number;
  level: number;
  deathReason: 'QIX' | 'Crabs';
  onRestart: () => void;
  onResume: () => void;
  onNextLevel: () => void;
  onWipeProgress: () => void;
}

export function Overlays({
  gameStage, isPaused, capturedPercent, level, deathReason,
  onRestart, onResume, onNextLevel, onWipeProgress,
}: OverlaysProps) {
  const [shownLevel, setShownLevel] = useState(level + 1);

  useEffect(() => {
    if (gameStage === 'INTERSTITIAL') {
      setShownLevel(level);
      const id = setTimeout(() => setShownLevel(level + 1), 120);
      return () => clearTimeout(id);
    }
  }, [gameStage]);

  return (
    <AnimatePresence>
      {gameStage === 'GAMEOVER' && (
        <motion.div
          key="gameover"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="z-10 bg-black/80 backdrop-blur-2xl p-10 rounded-[48px] border-2 border-white/10 flex flex-col items-center gap-6 shadow-[0_0_40px_rgba(0,0,0,0.8)] text-white"
        >
          <h2 className="text-4xl font-sans font-bold tracking-tight">Game Over</h2>
          <div className="flex flex-col items-center gap-1">
            <p className="text-white/60 text-center text-sm font-medium uppercase tracking-widest">
              Captured {capturedPercent}%
            </p>
            <p className="text-white/40 text-center text-sm font-medium uppercase tracking-widest">
              Killed by {deathReason}
            </p>
          </div>
          <button
            onClick={onRestart}
            className="flex items-center justify-center w-full py-4 bg-amber-500 text-black rounded-full font-bold text-lg transition-all hover:bg-amber-400 active:scale-95 shadow-[0_0_20px_rgba(251,191,36,0.3)] mt-2"
          >
            <RotateCcw className="mr-2 w-5 h-5" />
            Try Again
          </button>
        </motion.div>
      )}

{gameStage === 'INTERSTITIAL' && (
        <motion.div
          key="interstitial"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="z-10 bg-black/80 backdrop-blur-2xl p-10 rounded-[48px] border-2 border-amber-500/30 flex flex-col items-center gap-6 shadow-[0_0_40px_rgba(251,191,36,0.2)] text-white"
        >
          <h2 className="text-5xl font-sans font-black tracking-tight text-amber-400 flex items-center gap-2">
            Level <AnimatedCounter value={shownLevel} fontSize={48} />
          </h2>
          <button
            onClick={onNextLevel}
            className="flex items-center justify-center w-full py-4 bg-amber-500 text-black rounded-full font-bold text-lg transition-all hover:bg-amber-400 active:scale-95 shadow-[0_0_20px_rgba(251,191,36,0.3)] mt-2"
          >
            <Play className="mr-2 w-5 h-5 fill-current" />
            Play
          </button>
        </motion.div>
      )}

      {isPaused && (
        <motion.div
          key="pause"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-50 bg-stone-950/60 backdrop-blur-sm flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-black/80 backdrop-blur-2xl p-10 rounded-[48px] border-2 border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.8)] flex flex-col items-center gap-8 max-w-[320px] w-full text-white"
          >
            <div className="text-center">
              <h2 className="text-4xl font-sans font-bold">Paused</h2>
            </div>
            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={onResume}
                className="w-full py-4 bg-amber-500 text-black rounded-full font-bold transition-all hover:bg-amber-400 active:scale-95 flex items-center justify-center gap-2 mt-2"
              >
                <Play className="w-5 h-5 fill-current" />
                Resume
              </button>
              <button
                onClick={onRestart}
                className="w-full py-4 bg-white/10 text-white border border-white/20 rounded-full font-bold transition-all hover:bg-white/20 active:scale-95 flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                Restart
              </button>
              <button
                onClick={onWipeProgress}
                className="w-full py-3 bg-transparent text-red-400/70 border border-red-500/20 rounded-full font-bold text-sm transition-all hover:bg-red-500/10 hover:text-red-400 active:scale-95 flex items-center justify-center gap-2 mt-1"
              >
                Reset all progress
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
