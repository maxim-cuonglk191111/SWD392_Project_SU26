import React, { useEffect, useState, useRef } from 'react';
import socketService from './services/socketService';
import agoraService, { checkMicEnvironment } from './services/agoraService';
import Room from './components/Room';
import Controls from './components/Controls';
import {
  Loader2, Mic, AlertTriangle, WifiOff,
} from 'lucide-react';
import { IDENTITY_URL, BACKEND_URL } from './config';

// ─── Lobby step enum ──────────────────────────────────────────────────────────
const LOBBY_STEP = { CONFIG: 0, ROOM: 1 };

export default function App() {
  // ─── Auth & Identity ──────────────────────────────────────────────────────
  const [token, setToken] = useState(null);
  const [userId, setUserId] = useState(null);

  // ─── Room config ─────────────────────────────────────────────────────────
  const [language, setLanguage] = useState('english');
  const [level, setLevel]     = useState(1);
  const [nickname, setNickname] = useState('');
  const [customRoomId, setCustomRoomId] = useState('');

  // ─── Lobby state ─────────────────────────────────────────────────────────
  const [step, setStep]         = useState(LOBBY_STEP.CONFIG);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [me, setMe]             = useState(null);
  const [roomId, setRoomId]     = useState('');

  // ─── Env warning ─────────────────────────────────────────────────────────
  const [envWarning] = useState(() => {
    const e = checkMicEnvironment();
    return e.ok ? null : e.reason;
  });

  // ─── Cleanup khi unmount ────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      agoraService.leave();
      socketService.leaveRoom();
      socketService.disconnect();
    };
  }, []);

  // ─── Socket listeners ───────────────────────────────────────────────────
  useEffect(() => {
    if (step !== LOBBY_STEP.ROOM) return;

    socketService.on('your_info', (info) => {
      setMe(info);
    });

    socketService.on('user_updated', (updated) => {
      if (me && updated.id === me.id) {
        setMe(updated);
      }
    });

    socketService.on('speaker_approved', async ({ agoraToken }) => {
      setMe(prev => prev ? { ...prev, isMuted: false, isSpeaker: true } : null);
      if (agoraToken) {
        await agoraService.switchToPublisher(agoraToken);
      } else {
        await agoraService.switchToPublisher(null);
      }
    });

    socketService.on('speaker_revoked', async () => {
      setMe(prev => prev ? { ...prev, isMuted: true, isSpeaker: false } : null);
      await agoraService.switchToSubscriber();
    });

    socketService.on('speaker_error', ({ message }) => {
      setError(message);
      setTimeout(() => setError(null), 5000);
    });

    return () => {
      socketService.off('your_info');
      socketService.off('user_updated');
      socketService.off('speaker_approved');
      socketService.off('speaker_revoked');
      socketService.off('speaker_error');
    };
  }, [step, me]);

  // ─── Shared room-join logic (used by both guest & host) ─────────────────
  const joinRoom = async ({ id, role, username }) => {
    let tk = null;
    let uid = 0;

    // 1. Auth ẩn danh (timeout 5s — identity-service phải phản hồi nhanh)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const authRes = await fetch(`${IDENTITY_URL}/api/auth/login/anonymous`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: navigator.userAgent,
          role,
          username: username || undefined,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (authRes.ok) {
        const contentType = authRes.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const authData = await authRes.json();
          tk = authData.token;
          uid = authData.userId || 0;
        } else {
          console.warn('Identity returned non-JSON response, using dummy fallback.');
        }
      } else {
        console.warn(`Identity returned ${authRes.status}, using dummy token.`);
      }
    } catch (e) {
      console.warn('Identity service unreachable, using dummy token:', e.message);
    }

    // Fallback: dummy token nếu identity-service không trả lời
    if (!tk) {
      const namePart = encodeURIComponent(username || `User_${Math.floor(Math.random() * 10000)}`);
      tk = `dummy.token.${role.replace(' ', '_')}.${namePart}.${Date.now()}`;
      uid = `guest_${Date.now()}`;
    }

    setToken(tk);
    setUserId(uid);
    setRoomId(id);

    // 2. Socket auth — set token TRƯỚC khi connect()
    socketService.socket.auth = { token: tk };
    socketService.connect();

    // 3. Pre-flight (non-blocking, resolve sau 5s nếu server không reply)
    let preflightOk = false;
    try {
      const pfResult = await socketService.preflightCheck(id);
      preflightOk = pfResult.ok;
      if (!pfResult.available) {
        console.warn('Room full but allowing entry:', pfResult);
      }
    } catch (e) {
      console.warn('Preflight failed, proceeding anyway:', e.message);
    }

    // 4. Agora token (bọc try-catch, tự động fallback về empty token để luôn vào được phòng)
    let tokenData = { token: '' };
    try {
      const tokenRes = await fetch(
        `${BACKEND_URL}/api/token?channelName=${encodeURIComponent(id)}&uid=${uid}&role=${role === 'LUCY Pro' ? 'publisher' : 'subscriber'}`
      );
      if (tokenRes.ok) {
        const contentType = tokenRes.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          tokenData = await tokenRes.json();
        } else {
          console.warn('Backend returned non-JSON response for Agora token, using empty fallback.');
        }
      } else {
        console.warn(`Backend returned ${tokenRes.status} for Agora token, using empty fallback.`);
      }
    } catch (e) {
      console.warn('Failed to fetch Agora token, using empty fallback:', e.message);
    }

    // 5. Join Agora channel
    const agoraRole = role === 'LUCY Pro' ? 'publisher' : 'subscriber';
    try {
      const agoraRes = await agoraService.join(id, tokenData.token || null, uid, agoraRole);
      if (!agoraRes.success) {
        console.warn('Failed to join Agora channel, proceeding without voice connection');
      }
    } catch (e) {
      console.warn('Failed to join Agora channel, proceeding without voice connection:', e.message);
    }

    // 6. Join room qua Socket
    socketService.joinRoom(id, uid);

    setStep(LOBBY_STEP.ROOM);
  };

  // ─── Actions ────────────────────────────────────────────────────────────

  const handleJoinRoom = () => {
    setLoading(true);
    setError(null);

    const id = customRoomId.trim()
      ? customRoomId.trim().toLowerCase()
      : `${language.toLowerCase()}-${level}`;

    joinRoom({ id, role: 'LUCY', username: nickname.trim() || undefined })
      .catch(err => {
        setError(err.message || 'Không thể tham gia phòng học.');
        socketService.disconnect();
      })
      .finally(() => setLoading(false));
  };

  const handleJoinAsHost = () => {
    setLoading(true);
    setError(null);

    const id = customRoomId.trim()
      ? customRoomId.trim().toLowerCase()
      : `${language.toLowerCase()}-${level}`;

    joinRoom({ id, role: 'LUCY Pro', username: nickname.trim() || undefined })
      .catch(err => {
        setError(err.message || 'Không thể tạo phòng.');
        socketService.disconnect();
      })
      .finally(() => setLoading(false));
  };

  const handleToggleMute = () => {
    if (!me) return;
    if (me.role === 'LUCY' && !me.isSpeaker) return;
    socketService.toggleMute();
    agoraService.setMute(!me.isMuted);
  };

  const handleToggleHand = () => {
    socketService.raiseHand();
  };

  // ─── Render ────────────────────────────────────────────────────────────

  // ── CONFIG: Chọn phòng & nickname ─────────────────────────────────────
  if (step === LOBBY_STEP.CONFIG) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative bg-background overflow-hidden">
        <div className="absolute inset-0 overflow-hidden -z-10 pointer-events-none">
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/20 rounded-full mix-blend-screen filter blur-[100px] opacity-70 animate-blob"></div>
          <div className="absolute top-1/3 -right-20 w-96 h-96 bg-secondary/20 rounded-full mix-blend-screen filter blur-[100px] opacity-70 animate-blob" style={{ animationDelay: '2s' }}></div>
          <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-accent/20 rounded-full mix-blend-screen filter blur-[100px] opacity-50 animate-blob" style={{ animationDelay: '4s' }}></div>
        </div>

        <div className="glass-panel p-8 max-w-md w-full flex flex-col items-center">
          <div className="w-20 h-20 mb-4 rounded-3xl bg-gradient-to-br from-primary via-secondary to-accent p-1 shadow-2xl animate-float">
            <div className="w-full h-full bg-surface/90 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <Mic size={32} className="text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
            </div>
          </div>

          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 mb-1 tracking-tight">
            LUCY Voice Space
          </h1>
          <p className="text-zinc-400 text-xs font-medium mb-6 text-center px-4">
            Đăng nhập ẩn danh &amp; tham gia phòng luyện nói real-time.
          </p>

          {envWarning && (
            <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 w-full flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-amber-300 text-xs leading-relaxed">{envWarning}</p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 w-full flex items-start gap-2">
              <WifiOff size={14} className="text-red-400 mt-0.5 shrink-0" />
              <span className="text-red-400 text-xs">{error}</span>
            </div>
          )}

          <div className="w-full space-y-4 mb-6 text-left">
            <div>
              <label className="block text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-2">
                Biệt danh hiển thị <span className="font-normal normal-case text-zinc-600">(tùy chọn)</span>
              </label>
              <input
                type="text"
                placeholder="Nhập biệt danh..."
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                className="w-full bg-surface/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-primary/50 text-sm font-medium"
              />
            </div>

            <div>
              <label className="block text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-2">
                Mã phòng riêng <span className="font-normal normal-case text-zinc-600">(tùy chọn)</span>
              </label>
              <input
                type="text"
                placeholder="Để trống → vào phòng theo ngôn ngữ &amp; level"
                value={customRoomId}
                onChange={e => setCustomRoomId(e.target.value)}
                className="w-full bg-surface/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-primary/50 text-sm font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-2">Ngôn ngữ</label>
                <select
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                  disabled={!!customRoomId.trim()}
                  className="w-full bg-surface/50 border border-white/10 rounded-xl px-3 py-3 text-white focus:outline-none focus:border-primary/50 text-sm font-medium disabled:opacity-50"
                >
                  <option value="english" className="bg-background text-white">English</option>
                  <option value="chinese" className="bg-background text-white">Chinese</option>
                  <option value="japanese" className="bg-background text-white">Japanese</option>
                </select>
              </div>
              <div>
                <label className="block text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-2">Level (1–100)</label>
                <input
                  type="number" min="1" max="100"
                  value={level}
                  disabled={!!customRoomId.trim()}
                  onChange={e => setLevel(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                  className="w-full bg-surface/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 text-sm font-medium disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          <div className="w-full space-y-3">
            <button
              onClick={handleJoinRoom}
              disabled={loading}
              className="group relative w-full bg-white text-black hover:bg-zinc-100 py-3.5 px-6 rounded-2xl font-bold text-base transition-all duration-300 flex items-center justify-center overflow-hidden hover:scale-[1.02] active:scale-95 disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                {loading ? <Loader2 className="animate-spin" size={16} /> : null}
                {loading ? 'Đang vào phòng...' : 'Vào phòng học ngay'}
              </span>
            </button>

            <button
              onClick={handleJoinAsHost}
              disabled={loading}
              className="w-full bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 py-3 px-6 rounded-2xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <Mic size={16} />}
              {loading ? 'Đang tạo phòng...' : 'Tạo phòng Mentor (LUCY Pro)'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── ROOM ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen relative bg-background">
      <div className="fixed inset-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-primary/10 rounded-full mix-blend-screen filter blur-[120px] opacity-60 animate-blob"></div>
        <div className="absolute bottom-0 -right-20 w-[600px] h-[600px] bg-secondary/10 rounded-full mix-blend-screen filter blur-[120px] opacity-60 animate-blob" style={{ animationDelay: '3s' }}></div>
      </div>

      <Room me={me} roomId={roomId} />

      <Controls
        isMuted={me?.isMuted}
        isHandRaised={me?.isHandRaised}
        onToggleMute={handleToggleMute}
        onToggleHand={handleToggleHand}
      />
    </div>
  );
}
