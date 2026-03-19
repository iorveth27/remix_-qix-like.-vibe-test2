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
          {/* Top Bar */}
          <div className="absolute top-6 left-0 right-0 px-6 grid grid-cols-3 items-start pointer-events-auto">
            {/* Left Header - Hearts */}
            <div className="flex justify-start items-center">
              <div className="bg-slate-700/80 rounded-full px-3 py-1 flex items-center gap-1.5 border-[3px] border-black shadow-[0_4px_0_#1e293b] relative overflow-hidden">
                {/* Glossy highlight for the hearts container */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-2 bg-white/10 rounded-full pointer-events-none" />
                {Array.from({ length: 3 }).map((_, i) => (
                  <div 
                    key={i} 
                    className="relative w-8 h-8 flex items-center justify-center transition-all duration-300"
                    style={{ 
                      filter: i < lives ? 'none' : 'grayscale(100%) brightness(50%)',
                      transform: i < lives ? 'scale(1)' : 'scale(0.8)'
                    }}
                  >
                    <span 
                      className="text-2xl absolute"
                      style={{ textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 4px 0 #000' }}
                    >
                      ❤️
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Center Progress */}
            <div className="flex justify-center items-start pointer-events-none mt-1">
              <div className="bg-[#46bcf3] border-[3px] border-black rounded-[20px] px-6 py-2 shadow-[0_6px_0_#1e293b] flex flex-col items-center pb-3 relative overflow-hidden">
                {/* Glossy top highlight */}
                <div className="absolute top-0 left-0 right-0 h-4 bg-white/20 rounded-t-[16px] pointer-events-none" />
                
                <span className="text-[24px] font-black text-white mb-2 leading-none relative z-10" style={{ WebkitTextStroke: '2px black', textShadow: '0 3px 0 #000' }}>
                  {capturedPercent} / 80
                </span>
                
                <div className="w-32 md:w-48 h-5 bg-slate-800 rounded-full border-[3px] border-black overflow-hidden relative shadow-[inset_0_3px_6px_rgba(0,0,0,0.6)]">
                  <div 
                    className="absolute top-0 bottom-0 left-0 bg-[#fde047] transition-all duration-300 border-r-[3px] border-black" 
                    style={{ width: `${Math.min(100, (capturedPercent / 80) * 100)}%` }} 
                  >
                    {/* Inner progress bar highlight */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-white/40 rounded-t-full pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Status - Settings */}
            <div className="flex justify-end items-center">
              <button
                onClick={onPause}
                className="w-14 h-14 rounded-full bg-[#46bcf3] border-[3px] border-black shadow-[0_5px_0_#1e293b,inset_0_-4px_0_rgba(0,0,0,0.15)] flex items-center justify-center hover:bg-[#3db0e5] active:translate-y-1 active:shadow-[0_1px_0_#1e293b,inset_0_-2px_0_rgba(0,0,0,0.15)] transition-all relative overflow-hidden group ml-1"
              >
                {/* Bright white/cyan highlight on the button body */}
                <div className="absolute top-1 left-2.5 w-4 h-2 bg-white/60 rounded-full -rotate-[25deg] pointer-events-none" />
                
                <Settings 
                  className="w-7 h-7 text-[#f8fafc] pointer-events-none transition-transform group-hover:rotate-45 duration-300" 
                  strokeWidth={2.5}
                  style={{ 
                    filter: 'drop-shadow(0px 3px 0px rgba(0,0,0,0.6)) drop-shadow(1px 1px 0px black) drop-shadow(-1px -1px 0px black) drop-shadow(1px -1px 0px black) drop-shadow(-1px 1px 0px black)' 
                  }} 
                />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
