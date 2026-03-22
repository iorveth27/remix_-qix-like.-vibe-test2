import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings } from 'lucide-react';
interface HUDProps {
  isVisible: boolean;
  level: number;
  capturedPercent: number;
  goalPercent: number;
  onPause: () => void;
}

export function HUD({ isVisible, level, capturedPercent, goalPercent, onPause }: HUDProps) {
  const current = Math.round(capturedPercent);
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="absolute inset-0 pointer-events-none z-20 flex flex-col"
        >
          <div className="absolute top-4 left-0 right-0 flex justify-center items-center gap-3 px-4 pointer-events-none">

            {/* Progress — centered */}
            <div
              className="flex flex-col items-center justify-center px-5 py-2 rounded-2xl pointer-events-auto flex-1 gap-0.5"
              style={{
                background: 'rgba(255,255,255,0.08)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1.5px solid rgba(255, 200, 100, 0.3)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}
            >
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: 'rgba(253, 230, 138, 0.55)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                Level {level}
              </span>
              <span
                className="font-black tabular-nums leading-none"
                style={{
                  fontSize: '22px',
                  color: '#fde68a',
                  textShadow: '0 0 8px rgba(245,166,35,0.8), 0 2px 4px rgba(0,0,0,0.9)',
                }}
              >
                {current}%<span style={{ fontSize: '13px', opacity: 0.6 }}> / {goalPercent}%</span>
              </span>
            </div>

            {/* Settings button */}
            <button
              onClick={onPause}
              className="w-11 h-11 rounded-2xl flex items-center justify-center pointer-events-auto transition-all duration-150 active:scale-95 group"
              style={{
                background: 'rgba(255,255,255,0.08)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1.5px solid rgba(255, 200, 100, 0.3)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}
            >
              <Settings
                className="w-5 h-5 transition-transform group-hover:rotate-45 duration-300"
                strokeWidth={2.5}
                style={{ color: '#fde68a', filter: 'drop-shadow(0 0 4px rgba(245,166,35,0.7))' }}
              />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
