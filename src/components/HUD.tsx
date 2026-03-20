import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings } from 'lucide-react';

interface HUDProps {
  isVisible: boolean;
  capturedPercent: number;
  lives: number;
  onPause: () => void;
}

export function HUD({ isVisible, capturedPercent, lives, onPause }: HUDProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="absolute inset-0 pointer-events-none z-20 flex flex-col"
        >
          {/* Top Bar — glassmorphism pill */}
          <div className="absolute top-4 left-0 right-0 flex justify-center items-center gap-3 px-4 pointer-events-none">

            {/* Hearts pill */}
            <div
              className="flex items-center gap-1 px-3 py-2 rounded-2xl pointer-events-auto"
              style={{
                background: 'rgba(255,255,255,0.08)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1.5px solid rgba(255, 200, 100, 0.3)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}
            >
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="w-7 h-7 flex items-center justify-center transition-all duration-300"
                  style={{
                    filter: i < lives ? 'none' : 'grayscale(100%) brightness(40%)',
                    transform: i < lives ? 'scale(1)' : 'scale(0.75)',
                  }}
                >
                  <span className="text-xl leading-none select-none">❤️</span>
                </div>
              ))}
            </div>

            {/* Progress bar pill */}
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-2xl pointer-events-auto"
              style={{
                background: 'rgba(255,255,255,0.08)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1.5px solid rgba(255, 200, 100, 0.3)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
                minWidth: '200px',
              }}
            >
              {/* Progress track — star marker sits outside overflow-hidden */}
              <div className="relative flex-1" style={{ minWidth: '120px' }}>
                {/* 80% star — above the bar, anchored by left% on this wrapper */}
                <div
                  className="absolute z-10 pointer-events-none"
                  style={{ left: '80%', top: '-7px', transform: 'translateX(-50%)' }}
                >
                  <span style={{ fontSize: 36, lineHeight: 1, filter: 'drop-shadow(0 2px 6px rgba(180,120,0,0.9)) drop-shadow(0 0 14px rgba(255,200,0,0.5))' }}>⭐</span>
                </div>

                <div
                  className="relative h-5 rounded-full overflow-hidden"
                  style={{
                    background: 'rgba(0,0,0,0.35)',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
                  }}
                >
                  {/* Fill — multicolor desert gradient */}
                  <div
                    className="absolute left-0 top-0 bottom-0 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(capturedPercent, 2)}%`,
                      background: 'linear-gradient(90deg, #c8380a 0%, #f5a623 40%, #f5e642 75%, #b8e832 100%)',
                      boxShadow: '0 0 8px rgba(245,166,35,0.6)',
                    }}
                  >
                    {/* Glass sheen on fill */}
                    <div
                      className="absolute top-0 left-0 right-0 rounded-full pointer-events-none"
                      style={{
                        height: '40%',
                        background: 'linear-gradient(to bottom, rgba(255,255,255,0.35), transparent)',
                      }}
                    />
                  </div>

                </div>
              </div>

              {/* Percentage */}
              <span
                className="text-lg font-black leading-none tabular-nums"
                style={{
                  color: '#fde68a',
                  textShadow: '0 0 8px rgba(245,166,35,0.8), 0 2px 4px rgba(0,0,0,0.9)',
                  minWidth: '42px',
                  textAlign: 'right',
                }}
              >
                {capturedPercent}%
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
