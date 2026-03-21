import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, RotateCcw, ArrowRight } from 'lucide-react';

type GameStage = 'PLAYING' | 'LEVEL_CLEAR' | 'DISSOLVE' | 'INTERSTITIAL' | 'GAMEOVER';

interface OverlaysProps {
  gameStage: GameStage;
  isPaused: boolean;
  capturedPercent: number;
  level: number;
  score: number;
  sparksEnabled: boolean;
  bossEnabled: boolean;
  fuseEnabled: boolean;
  onToggleSparks: () => void;
  onToggleBoss: () => void;
  onToggleFuse: () => void;
  onRestart: () => void;
  onResume: () => void;
  onNextLevel: () => void;
}

export function Overlays({
  gameStage, isPaused, capturedPercent, level, score,
  sparksEnabled, bossEnabled, fuseEnabled,
  onToggleSparks, onToggleBoss, onToggleFuse, onRestart, onResume, onNextLevel,
}: OverlaysProps) {
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
              Level {level} — {capturedPercent}% captured
            </p>
            <p className="text-amber-400 text-center text-lg font-bold tabular-nums">
              {score.toLocaleString()} pts
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
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-5xl font-sans font-black tracking-tight text-amber-400">
              Level {level + 1}
            </h2>
            <p className="text-white/60 text-sm font-medium uppercase tracking-widest">
              Get ready...
            </p>
          </div>
          <p className="text-white/50 text-base tabular-nums">
            Score: {score.toLocaleString()}
          </p>
          <button
            onClick={onNextLevel}
            className="flex items-center justify-center w-full py-4 bg-amber-500 text-black rounded-full font-bold text-lg transition-all hover:bg-amber-400 active:scale-95 shadow-[0_0_20px_rgba(251,191,36,0.3)] mt-2"
          >
            <ArrowRight className="mr-2 w-5 h-5" />
            Next Level
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
              <h2 className="text-4xl font-sans font-bold mb-2">Paused</h2>
              <p className="text-white/50 text-sm font-medium tracking-wide uppercase">Sandbox settings</p>
            </div>
            <div className="flex flex-col gap-3 w-full">
              {/* Toggles */}
              {[
                { label: 'Sparks', enabled: sparksEnabled, onToggle: onToggleSparks },
                { label: 'Boss', enabled: bossEnabled, onToggle: onToggleBoss },
                { label: 'Fuse', enabled: fuseEnabled, onToggle: onToggleFuse },
              ].map(({ label, enabled, onToggle }) => (
                <button
                  key={label}
                  onClick={onToggle}
                  className="w-full flex items-center justify-between px-6 py-4 rounded-full bg-white/5 border border-white/10 text-white font-bold transition-all hover:bg-white/10 active:scale-95"
                >
                  <span className="text-sm tracking-wide">{label}</span>
                  <div className={`w-12 h-7 rounded-full transition-colors relative shadow-inner ${enabled ? 'bg-amber-500' : 'bg-white/20'}`}>
                    <div className={`absolute top-1 w-5 h-5 rounded-full bg-black shadow transition-transform ${enabled ? 'translate-x-[22px]' : 'translate-x-1'}`} />
                  </div>
                </button>
              ))}

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
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
