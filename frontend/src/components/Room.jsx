import React, { useEffect, useState } from 'react';
import socketService from '../services/socketService';
import { Mic, MicOff, Hand, Activity, Clock, Layers } from 'lucide-react';

export default function Room({ me }) {
  const [users, setUsers] = useState([]);
  const [latency, setLatency] = useState(0);
  const [stageInfo, setStageInfo] = useState({ stage: 1, topic: 'Loading...', timeLeft: 0 });

  useEffect(() => {
    socketService.on('room-users', (roomUsers) => {
      setUsers(roomUsers);
    });

    socketService.on('user-updated', (updatedUser) => {
      setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    });

    socketService.setLatencyCallback((lat) => {
      setLatency(lat);
    });

    socketService.on('stage-changed', (data) => {
      setStageInfo(prev => ({ ...prev, stage: data.stage, topic: data.topic, timeLeft: data.timeLeft }));
    });

    socketService.on('timer-update', (data) => {
      setStageInfo(prev => ({ ...prev, stage: data.stage, timeLeft: data.timeLeft }));
    });

    return () => {
      socketService.off('room-users');
      socketService.off('user-updated');
      socketService.off('stage-changed');
      socketService.off('timer-update');
    };
  }, []);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="p-8 pb-40 max-w-5xl mx-auto w-full min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60 tracking-tight">
          LISA Room
        </h1>
        <div className="glass-panel px-4 py-2 flex items-center gap-3 !rounded-full">
          <div className="relative flex items-center justify-center">
            <Activity size={16} className={latency < 100 ? 'text-green-400' : latency < 300 ? 'text-yellow-400' : 'text-red-400'} />
            {latency < 100 && <span className="absolute w-full h-full bg-green-400/50 rounded-full animate-ping"></span>}
          </div>
          <span className="font-semibold text-sm tracking-wide text-zinc-300">{latency} ms</span>
        </div>
      </div>

      {/* Stage Info Bar */}
      <div className="glass-panel p-6 mb-12 flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/20 text-primary flex items-center justify-center shadow-inner">
            <Layers size={24} />
          </div>
          <div>
            <div className="text-sm font-bold text-primary tracking-widest uppercase mb-1">Stage {stageInfo.stage} / 6</div>
            <div className="text-xl font-bold text-white">{stageInfo.topic}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-background/50 px-6 py-3 rounded-2xl border border-white/5">
          <Clock size={20} className={stageInfo.timeLeft < 60 ? 'text-red-400 animate-pulse' : 'text-accent'} />
          <span className={`text-3xl font-black tracking-widest font-mono ${stageInfo.timeLeft < 60 ? 'text-red-400' : 'text-white'}`}>
            {formatTime(stageInfo.timeLeft)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {users.map((user, idx) => {
          const gradients = [
            'from-violet-500 to-fuchsia-500',
            'from-cyan-500 to-blue-500',
            'from-emerald-400 to-cyan-400',
            'from-rose-500 to-orange-400',
            'from-indigo-500 to-purple-500'
          ];
          const grad = gradients[idx % gradients.length];
          const isMe = user.id === me?.id;
          const isSpeaking = !user.isMuted; // Simplification, would need audio level in reality

          return (
            <div key={user.id} className={`glass-panel p-6 flex flex-col items-center justify-center relative transition-all duration-500 group ${isMe ? 'ring-1 ring-white/30 bg-white/[0.05]' : 'hover:bg-white/[0.04]'} ${isSpeaking ? 'shadow-[0_0_30px_rgba(255,255,255,0.1)] -translate-y-1' : ''}`}>
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="relative mb-5">
                <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center text-4xl font-black shadow-2xl transition-transform duration-500 group-hover:scale-105 bg-gradient-to-br ${grad} text-white`}>
                  <span>{user.name.charAt(5) || user.name.charAt(0)}</span>
                </div>
                {isSpeaking && (
                  <div className="absolute -inset-2 bg-white/20 rounded-[2.5rem] -z-10 animate-pulse-glow"></div>
                )}
                
                <div className="absolute -bottom-2 -right-2 flex gap-1">
                  {user.isHandRaised && (
                    <div className="bg-surface border border-white/10 text-yellow-400 p-2 rounded-full shadow-lg z-10 animate-bounce">
                      <Hand size={14} className="fill-current" />
                    </div>
                  )}
                  <div className={`bg-surface border border-white/10 p-2 rounded-full shadow-lg z-10 ${user.isMuted ? 'text-red-400' : 'text-green-400'}`}>
                    {user.isMuted ? <MicOff size={14} /> : <Mic size={14} />}
                  </div>
                </div>
              </div>
              
              <span className="font-bold text-base text-center truncate w-full px-2 text-zinc-200">
                {user.name} {isMe && <span className="text-zinc-500 text-xs ml-1 uppercase tracking-wider">(You)</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
