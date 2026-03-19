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
              <div className="bg-[#46bcf3] border-[3px] border-black rounded-[20px] px-3 py-2 shadow-[0_5px_0_#1e293b] flex flex-row items-center gap-2 relative overflow-hidden">
                {/* Glossy top highlight */}
                <div className="absolute top-0 left-0 right-0 h-3 bg-white/20 rounded-t-[16px] pointer-events-none" />
                
                {/* Progress Bar Track (0 to 100%) */}
                <div className="w-40 md:w-64 h-6 bg-slate-800 rounded-full border-[3px] border-black relative shadow-[inset_0_3px_6px_rgba(0,0,0,0.6)]">
                  
                  {/* Fill */}
                  <div 
                    className="absolute top-0 bottom-0 left-0 bg-[#fde047] transition-all duration-300 rounded-l-full overflow-hidden" 
                    style={{ 
                      width: `${Math.min(100, capturedPercent)}%`,
                      borderRight: capturedPercent > 0 ? '3px solid black' : 'none',
                      borderTopRightRadius: capturedPercent >= 98 ? '9999px' : '0',
                      borderBottomRightRadius: capturedPercent >= 98 ? '9999px' : '0'
                    }} 
                  >
                    {/* Inner progress bar highlight */}
                    <div className="absolute top-0 left-0 w-[500px] h-1.5 bg-white/40 pointer-events-none" />
                  </div>

                  {/* Goal Star at 80% */}
                  <div 
                    className="absolute top-1/2 z-20 flex flex-col items-center justify-center pointer-events-none" 
                    style={{ left: '80%', transform: 'translate(-50%, -50%)' }}
                  >
                    <div className="w-1.5 h-7 bg-white/20 absolute -z-10 rounded-full" />
                    <span 
                      className="text-[20px] leading-none" 
                      style={{ filter: 'drop-shadow(0px 2px 0px rgba(0,0,0,1)) drop-shadow(0px -1px 0px rgba(0,0,0,1)) drop-shadow(1px 0px 0px rgba(0,0,0,1)) drop-shadow(-1px 0px 0px rgba(0,0,0,1))' }}
                    >
                      ⭐
                    </span>
                  </div>
                </div>

                {/* Percentage Text on the Right */}
                <span className="text-[20px] font-black text-white leading-none relative z-10 w-12 text-right tracking-tight translate-y-[1px]" style={{ WebkitTextStroke: '2px black', textShadow: '0 3px 0 #000' }}>
                  {capturedPercent}%
                </span>
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
