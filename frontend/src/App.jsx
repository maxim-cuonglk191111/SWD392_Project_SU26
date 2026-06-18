import React, { useEffect, useState } from 'react';
import socketService from './services/socketService';
import agoraService from './services/agoraService';
import Room from './components/Room';
import Controls from './components/Controls';
import { Loader2, Mic } from 'lucide-react';

const ROOM_ID = 'lisa-stage-1';

function App() {
  const [joined, setJoined] = useState(false);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    socketService.on('your-info', (info) => {
      setMe(info);
    });

    socketService.on('user-updated', (updatedUser) => {
      if (me && updatedUser.id === me.id) {
        setMe(updatedUser);
      }
    });

    return () => {
      socketService.off('your-info');
      socketService.off('user-updated');
    };
  }, [me]);

  const handleJoin = async () => {
    setLoading(true);
    setError(null);
    try {
      socketService.connect();
      socketService.joinRoom(ROOM_ID);

      const res = await fetch(`http://localhost:5000/api/token?channelName=${ROOM_ID}`);
      const data = await res.json();
      
      if (data.token) {
        // UID 0 lets Agora assign a random UID
        await agoraService.join(ROOM_ID, data.token, 0);
        setJoined(true);
      } else {
        throw new Error('Failed to fetch token');
      }
    } catch (err) {
      console.error(err);
      setError('Could not join room. Check backend and Agora credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMute = () => {
    if (me) {
      const newMutedState = !me.isMuted;
      socketService.toggleMute();
      agoraService.setMute(newMutedState);
    }
  };

  const handleToggleHand = () => {
    socketService.toggleHand();
  };

  if (!joined) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative bg-background overflow-hidden">
        {/* Animated Background blobs */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/20 rounded-full mix-blend-screen filter blur-[100px] opacity-70 animate-blob"></div>
          <div className="absolute top-1/3 -right-20 w-96 h-96 bg-secondary/20 rounded-full mix-blend-screen filter blur-[100px] opacity-70 animate-blob" style={{ animationDelay: '2s' }}></div>
          <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-accent/20 rounded-full mix-blend-screen filter blur-[100px] opacity-50 animate-blob" style={{ animationDelay: '4s' }}></div>
        </div>

        <div className="glass-panel p-10 max-w-md w-full text-center flex flex-col items-center">
          <div className="w-24 h-24 mb-6 rounded-3xl bg-gradient-to-br from-primary via-secondary to-accent p-1 shadow-2xl animate-float">
            <div className="w-full h-full bg-surface/90 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <Mic size={40} className="text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
            </div>
          </div>
          
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 mb-3 tracking-tight">Audio Room</h1>
          <p className="text-zinc-400 text-sm font-medium mb-10 px-6">Join the real-time conversation. Experience ultra-low latency voice chat.</p>
          
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm w-full">
              {error}
            </div>
          )}

          <button 
            onClick={handleJoin}
            disabled={loading}
            className="group relative w-full bg-white text-black hover:bg-zinc-100 py-4 px-6 rounded-2xl font-bold text-lg transition-all duration-300 flex items-center justify-center overflow-hidden hover:scale-[1.02] active:scale-95"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <span className="relative flex items-center gap-2">
              {loading ? <Loader2 className="animate-spin" /> : 'Enter Room'}
            </span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative bg-background">
       {/* Ambient Background blobs */}
       <div className="fixed inset-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-primary/10 rounded-full mix-blend-screen filter blur-[120px] opacity-60 animate-blob"></div>
          <div className="absolute bottom-0 -right-20 w-[600px] h-[600px] bg-secondary/10 rounded-full mix-blend-screen filter blur-[120px] opacity-60 animate-blob" style={{ animationDelay: '3s' }}></div>
        </div>

      <Room me={me} />
      
      <Controls 
        isMuted={me?.isMuted} 
        isHandRaised={me?.isHandRaised}
        onToggleMute={handleToggleMute}
        onToggleHand={handleToggleHand}
      />
    </div>
  );
}

export default App;
