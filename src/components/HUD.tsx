import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings } from 'lucide-react';

const DIGIT_STRIP = '9876543210';

function AnimatedDigit({ digit, fontSize }: { digit: string; fontSize: number }) {
  const h = fontSize * 1.25;
  const idx = DIGIT_STRIP.indexOf(digit);
  return (
    <span style={{ display: 'inline-block', overflow: 'hidden', height: h, verticalAlign: 'middle' }}>
      <motion.span
        initial={{ y: -idx * h }}
        animate={{ y: -idx * h }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        {DIGIT_STRIP.split('').map(d => (
          <span key={d} style={{ height: h, lineHeight: `${h}px`, display: 'block' }}>{d}</span>
        ))}
      </motion.span>
    </span>
  );
}

export function AnimatedCounter({ value, fontSize }: { value: number; fontSize: number }) {
  const digits = String(value).split('');
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      {digits.map((digit, i) => (
        <span key={String(digits.length - i)}>
          <AnimatedDigit digit={digit} fontSize={fontSize} />
        </span>
      ))}
    </span>
  );
}

interface HUDProps {
  isVisible: boolean;
  level: number;
  capturedPercent: number;
  goalPercent: number;
  onPause: () => void;
}

export function HUD({ isVisible, level, capturedPercent, goalPercent, onPause }: HUDProps) {
  const remaining = Math.max(0, goalPercent - Math.round(capturedPercent));
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

            {/* Level pill — left */}
            <div
              className="flex items-center justify-center px-4 py-2 rounded-2xl pointer-events-auto"
              style={{
                background: 'rgba(255,255,255,0.08)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1.5px solid rgba(255, 200, 100, 0.3)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}
            >
              <span
                className="font-black tabular-nums"
                style={{
                  fontSize: '16px',
                  color: '#fde68a',
                  textShadow: '0 0 8px rgba(245,166,35,0.8), 0 2px 4px rgba(0,0,0,0.9)',
                  letterSpacing: '0.04em',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                <span style={{ opacity: 0.6 }}>Lvl</span>
                <AnimatedCounter value={level} fontSize={16} />
              </span>
            </div>

            {/* Progress % — centered */}
            <div
              className="flex items-center justify-center px-5 py-2 rounded-2xl pointer-events-auto flex-1"
              style={{
                background: 'rgba(255,255,255,0.08)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1.5px solid rgba(255, 200, 100, 0.3)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}
            >
              <span
                className="font-black tabular-nums"
                style={{
                  fontSize: '22px',
                  color: '#fde68a',
                  textShadow: '0 0 8px rgba(245,166,35,0.8), 0 2px 4px rgba(0,0,0,0.9)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {remaining === 0 ? (
                  <span>WIN!</span>
                ) : (
                  <>
                    <span style={{ opacity: 0.6 }}>Claim</span>
                    <AnimatedCounter value={remaining} fontSize={22} />
                    <span>%</span>
                  </>
                )}
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
