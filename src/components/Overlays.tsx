import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bug, Play, RotateCcw } from 'lucide-react';

interface OverlaysProps {
  gameState: 'PLAYING' | 'GAMEOVER' | 'WIN';
  isPaused: boolean;
  capturedPercent: number;
  sparksEnabled: boolean;
  bossEnabled: boolean;
  fuseEnabled: boolean;
  onToggleSparks: () => void;
  onToggleBoss: () => void;
  onToggleFuse: () => void;
  onRestart: () => void;
  onResume: () => void;
}

export function Overlays({ gameState, isPaused, capturedPercent, sparksEnabled, bossEnabled, fuseEnabled, onToggleSparks, onToggleBoss, onToggleFuse, onRestart, onResume }: OverlaysProps) {
  return (
    <AnimatePresence>
      {gameState === 'GAMEOVER' && (
        <motion.div
          key="gameover"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="z-10 bg-stone-50/90 backdrop-blur-xl p-10 rounded-[40px] border border-stone-200/50 flex flex-col items-center gap-6 shadow-2xl text-stone-900"
        >
          <h2 className="text-3xl font-serif font-medium">Game Over</h2>
          <p className="text-stone-600 text-center text-sm italic">You captured {capturedPercent}% of the territory.</p>
          <button
            onClick={onRestart}
            className="flex items-center justify-center w-full py-4 bg-stone-900 text-white rounded-full font-medium text-lg transition-all hover:bg-stone-800 active:scale-95 shadow-lg"
          >
            <RotateCcw className="mr-2 w-5 h-5" />
            Try Again
          </button>
        </motion.div>
      )}

      {gameState === 'WIN' && (
        <motion.div
          key="win"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="z-10 bg-stone-50/90 backdrop-blur-xl p-10 rounded-[40px] border border-stone-200/50 flex flex-col items-center gap-6 shadow-2xl text-stone-900"
        >
          <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
            <Bug className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-serif font-medium">Victory!</h2>
          <p className="text-stone-600 text-center text-sm italic">You captured the territory.</p>
          <button
            onClick={onRestart}
            className="flex items-center justify-center w-full py-4 bg-emerald-600 text-white rounded-full font-medium text-lg transition-all hover:bg-emerald-700 active:scale-95 shadow-lg shadow-emerald-600/20"
          >
            <RotateCcw className="mr-2 w-5 h-5" />
            Play Again
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
            className="bg-stone-50 p-10 rounded-[40px] border border-stone-200 shadow-2xl flex flex-col items-center gap-8 max-w-[300px] w-full"
          >
            <div className="text-center">
              <h2 className="text-3xl font-serif font-medium text-stone-900 mb-2">Paused</h2>
              <p className="text-stone-500 text-sm font-light italic">The forest waits for your return.</p>
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
                  className="w-full flex items-center justify-between px-5 py-3 rounded-2xl bg-stone-100 border border-stone-200 text-stone-700 font-medium transition-all hover:bg-stone-200 active:scale-95"
                >
                  <span className="text-sm">{label}</span>
                  <div className={`w-11 h-6 rounded-full transition-colors relative ${enabled ? 'bg-emerald-500' : 'bg-stone-300'}`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </div>
                </button>
              ))}

              <button
                onClick={onResume}
                className="w-full py-4 bg-stone-900 text-white rounded-full font-medium transition-all hover:bg-stone-800 active:scale-95 flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5 fill-current" />
                Resume
              </button>
              <button
                onClick={onRestart}
                className="w-full py-4 bg-stone-200 text-stone-600 rounded-full font-medium transition-all hover:bg-stone-300 active:scale-95 flex items-center justify-center gap-2"
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
