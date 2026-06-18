import React from 'react';
import { Mic, MicOff, Hand } from 'lucide-react';

export default function Controls({ isMuted, isHandRaised, onToggleMute, onToggleHand }) {
  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 flex justify-center items-center gap-4 glass-panel !rounded-[3rem] px-8 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50">
      <button 
        onClick={onToggleMute}
        className={`relative flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300 ${
          isMuted 
            ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20' 
            : 'bg-white text-black hover:bg-zinc-200 hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.3)]'
        }`}
      >
        {isMuted ? <MicOff size={28} /> : <Mic size={28} />}
        {!isMuted && <div className="absolute inset-0 rounded-full border border-white animate-pulse-glow pointer-events-none"></div>}
      </button>

      <button 
        onClick={onToggleHand}
        className={`flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300 ${
          isHandRaised 
            ? 'bg-yellow-400 text-black shadow-[0_0_20px_rgba(250,204,21,0.4)] animate-bounce hover:bg-yellow-300' 
            : 'bg-surface border border-white/10 text-white hover:bg-white/10 hover:scale-105 active:scale-95'
        }`}
      >
        <Hand size={28} className={isHandRaised ? 'fill-current' : ''} />
      </button>
    </div>
  );
}
