import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Hand, Send, Gift, ArrowLeft, Users, Radio, Crown, Volume2, VolumeX } from 'lucide-react';
import { roomApi, giftApi } from '../services/api';
import { socketService } from '../services/socket';
import { audioService } from '../services/audioService';
import { Room, Participant, Message, Gift as GiftType } from '../types';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../context/AuthContext';
import { generateAnonymousIdentity } from '../utils/anonymous';

// Convert real participant data to anonymous identity (stable per room)
function anonymizeParticipant(p: any, roomId: string): Participant {
  const { anonymousName, anonymousAvatarSeed } = generateAnonymousIdentity(`${p.userId}:${roomId}`);
  return {
    id: p.userId,
    anonymousName,
    anonymousAvatarSeed,
    role: p.role || p.user?.role || 'LISTENER',
    handRaised: p.handRaised ?? false,
    isMuted: p.isMuted ?? true,
    isSpeaker: p.isSpeaker ?? false,
  };
}

export default function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // ─── State ──────────────────────────────────────────────────────────
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [gifts, setGifts] = useState<GiftType[]>([]);
  const [message, setMessage] = useState('');
  const [myRole, setMyRole] = useState<string>('LISTENER');
  const [isMuted, setIsMuted] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [showGifts, setShowGifts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [giftAnimation, setGiftAnimation] = useState<any>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [audioError, setAudioError] = useState('');
  const [activeSpeakers, setActiveSpeakers] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const visualizerRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  // ─── Audio Init ──────────────────────────────────────────────────────
  useEffect(() => {
    const initAudio = async () => {
      const ok = await audioService.init();
      setAudioReady(ok);
      if (!ok) setAudioError('Không thể truy cập microphone. Vui lòng cấp quyền.');
    };
    initAudio();
    return () => { audioService.destroy(); };
  }, []);

  // ─── Visualizer ─────────────────────────────────────────────────────
  const drawVisualizer = useCallback(() => {
    const canvas = visualizerRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const data = audioService.getFrequencyData() || new Uint8Array(64);
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const barWidth = w / data.length;
    data.forEach((val, i) => {
      const barH = (val / 255) * h;
      const gradient = ctx.createLinearGradient(0, h - barH, 0, h);
      gradient.addColorStop(0, '#6C5CE7');
      gradient.addColorStop(1, '#00CEC9');
      ctx.fillStyle = gradient;
      ctx.fillRect(i * barWidth, h - barH, barWidth - 1, barH);
    });
    animationRef.current = requestAnimationFrame(drawVisualizer);
  }, []);

  // ─── Socket Events ─────────────────────────────────────────────────
  useEffect(() => {
    if (!id || !user) { navigate('/home'); return; }

    const loadRoom = async () => {
      try {
        const res = await roomApi.getOne(id);
        setRoom(res.data.room);
        const myPart = res.data.room.participants?.find((p: any) => p.userId === user.id);
        if (myPart) {
          setMyRole(myPart.role);
          setParticipants(
            (res.data.room.participants || [])
              .map((p: any) => anonymizeParticipant(p, id))
          );
        } else {
          await roomApi.join(id);
          setMyRole('LISTENER');
          setParticipants(
            (res.data.room.participants || [])
              .map((p: any) => anonymizeParticipant(p, id))
          );
        }
      } catch { navigate('/home'); }
      setLoading(false);
    };

    const loadGifts = async () => {
      try { const res = await giftApi.getAll(); setGifts(res.data.gifts || []); } catch { /* ignore */ }
    };

    loadRoom();
    loadGifts();

    // ── Room update (already anonymous from backend) ────────────────────
    const handleRoomUpdate = (data: any) => {
      if (data.roomId !== id) return;
      setParticipants(data.participants);
      setRoom(prev => prev ? { ...prev, currentCount: data.currentCount } : null);
    };

    // ── Joined ───────────────────────────────────────────────────────
    const handleJoined = (data: any) => {
      if (data.roomId === id) setMyRole(data.role);
    };

    // ── Hand update ──────────────────────────────────────────────────
    const handleHandUpdate = (data: any) => {
      setParticipants(prev => prev.map(p => p.id === data.userId ? { ...p, handRaised: data.handRaised } : p));
      if (data.userId === user.id) setHandRaised(data.handRaised);
    };

    // ── Participant update ───────────────────────────────────────────
    const handleParticipantUpdate = (data: any) => {
      setParticipants(prev => prev.map(p => p.id === data.userId ? { ...p, ...data } : p));
      if (data.userId === user.id) {
        if (data.isMuted !== undefined) setIsMuted(data.isMuted);
        if (data.role) setMyRole(data.role);
      }
      // Cập nhật visualizer khi có speaker
      if (data.isMuted !== undefined) {
        setActiveSpeakers(prev => {
          const next = new Set(prev);
          if (data.isMuted) next.delete(data.userId);
          else next.add(data.userId);
          return next;
        });
      }
    };

    // ── Chat message ─────────────────────────────────────────────────
    const handleMessage = (data: Message) => {
      if (data.roomId === id) setMessages(prev => [...prev, data]);
    };

    // ── Gift received ────────────────────────────────────────────────
    const handleGiftReceived = (data: any) => {
      setGiftAnimation(data);
      setTimeout(() => setGiftAnimation(null), 3500);
    };

    // ── Audio chunk — PHÁT ÂM THANH ──────────────────────────────────
    const handleAudioChunk = (data: any) => {
      if (!audioReady || data.userId === user.id) return; // Không phát lại cho người gửi
      try {
        const binary = atob(data.chunk);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        audioService.playAudioChunk(data.userId, bytes.buffer, data.mimeType);

        // Highlight speaker
        setActiveSpeakers(prev => new Set(prev).add(data.userId));
        setTimeout(() => {
          setActiveSpeakers(prev => { const n = new Set(prev); n.delete(data.userId); return n; });
        }, 800);
      } catch (err) { console.warn('[Audio] Playback error:', err); }
    };

    // ── Notification ─────────────────────────────────────────────────
    const handleNotification = (data: any) => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(), roomId: id || '', content: data.message,
        type: 'SYSTEM', createdAt: new Date().toISOString(),
      }]);
    };

    // ── Stage changed ────────────────────────────────────────────────
    const handleStageChanged = (data: any) => {
      setRoom(prev => prev ? { ...prev, currentSubLevel: data.subLevel } : null);
    };

    // ── Kicked ─────────────────────────────────────────────────────
    const handleParticipantKicked = (data: any) => {
      if (data.userId === user.id) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(), roomId: id || '', content: `⚠️ Bạn đã bị chủ phòng kick khỏi phòng`,
          type: 'SYSTEM', createdAt: new Date().toISOString(),
        }]);
        setTimeout(() => navigate('/home'), 2000);
      } else {
        setParticipants(prev => prev.filter(p => p.id !== data.userId));
      }
    };

    // ── Leaved room ─────────────────────────────────────────────────
    const handleLeavedRoom = () => navigate('/home');

    // ── Room ended ──────────────────────────────────────────────────
    const handleRoomEnded = () => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(), roomId: id || '', content: '🔴 Chủ phòng đã kết thúc phòng',
        type: 'SYSTEM', createdAt: new Date().toISOString(),
      }]);
      setTimeout(() => navigate('/home'), 2000);
    };

    socketService.on('room_update', handleRoomUpdate);
    socketService.on('joined_room', handleJoined);
    socketService.on('hand_update', handleHandUpdate);
    socketService.on('participant_update', handleParticipantUpdate);
    socketService.on('message_received', handleMessage);
    socketService.on('gift_received', handleGiftReceived);
    socketService.on('audio_chunk', handleAudioChunk);
    socketService.on('notification', handleNotification);
    socketService.on('stage_changed', handleStageChanged);
    socketService.on('participant_kicked', handleParticipantKicked);
    socketService.on('leaved_room', handleLeavedRoom);
    socketService.on('room_ended', handleRoomEnded);

    socketService.joinRoom(id);

    return () => {
      socketService.off('room_update', handleRoomUpdate);
      socketService.off('joined_room', handleJoined);
      socketService.off('hand_update', handleHandUpdate);
      socketService.off('participant_update', handleParticipantUpdate);
      socketService.off('message_received', handleMessage);
      socketService.off('gift_received', handleGiftReceived);
      socketService.off('audio_chunk', handleAudioChunk);
      socketService.off('notification', handleNotification);
      socketService.off('stage_changed', handleStageChanged);
      socketService.off('participant_kicked', handleParticipantKicked);
      socketService.off('leaved_room', handleLeavedRoom);
      socketService.off('room_ended', handleRoomEnded);
      socketService.leaveRoom(id);
    };
  }, [id, user]);

  // Auto-scroll messages
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Visualizer animation
  useEffect(() => {
    if (!audioReady) return;
    const canvas = visualizerRef.current;
    if (canvas) { canvas.width = 200; canvas.height = 40; }
    drawVisualizer();
    return () => cancelAnimationFrame(animationRef.current);
  }, [audioReady, drawVisualizer]);

  // ─── Actions ─────────────────────────────────────────────────────────

  const sendMessage = () => {
    if (!message.trim() || !id) return;
    socketService.sendMessage(id, message.trim());
    setMessage('');
  };

  const toggleMic = () => {
    if (!id || !audioReady) return;
    if (myRole === 'LISTENER') {
      socketService.raiseHand(id);
      setHandRaised(!handRaised);
    } else {
      // Speaker: toggle capture
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      socketService.toggleMic(id);

      if (newMuted) {
        audioService.stopCapture();
      } else {
        audioService.startCapture((chunk, mimeType) => {
          socketService.emit('audio_chunk', { roomId: id, chunk, mimeType });
        });
      }
    }
  };

  const sendGiftTo = (receiverId: string, giftId?: string) => {
    if (!id) return;
    const gift = gifts.find(g => g.id === giftId) || gifts[0];
    if (gift) socketService.sendGift(id, gift.id, receiverId);
    setShowGifts(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  if (!room) return <div className="text-center py-20 text-text-secondary">Room not found</div>;

  const isHost = user?.id === room.hostId;
  const isSpeaker = myRole !== 'LISTENER';
  const speakers = participants.filter(p => p.isSpeaker || p.role === 'HOST' || p.role === 'MODERATOR');
  const listeners = participants.filter(p => p.role === 'LISTENER' && !p.isSpeaker);
  const langFlags: Record<string, string> = { EN: '🇬🇧', ZH: '🇨🇳', JP: '🇯🇵' };

  return (
    <div className="flex flex-col gap-3">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/home')} className="p-2 rounded-lg bg-surface hover:bg-surface2 transition">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">{langFlags[room.language]} {room.language}</span>
            {room.status === 'ACTIVE' && <Radio size={14} className="text-success animate-pulse" />}
            {room.isRecording && <span className="text-xs px-2 py-0.5 rounded-full bg-error/20 text-error animate-pulse">🔴 REC</span>}
          </div>
          <h1 className="font-bold">{room.title}</h1>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-sm"><Users size={14} /> {room.currentCount}/{room.maxParticipants}</div>
          {room.level && <div className="text-xs text-text-secondary">{room.level.stage} L{room.level.levelNumber}</div>}
        </div>
      </div>

      {/* ─── Audio Error Banner ─────────────────────────────────────── */}
      {audioError && (
        <div className="bg-error/10 border border-error/30 rounded-xl px-4 py-2 text-sm text-error flex items-center gap-2">
          <MicOff size={16} /> {audioError}
        </div>
      )}

      {/* ─── Main Grid ───────────────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-3 overflow-hidden">

        {/* ── Speakers Panel ────────────────────────────────────────── */}
        <div className="lg:col-span-2 bg-surface rounded-2xl overflow-hidden flex flex-col">
          <div className="p-3 border-b border-white/5">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-text-secondary">🎤 NGƯỜI ĐANG NÓI</h4>
              <div className="flex items-center gap-2">
                {audioReady
                  ? <span className="text-[10px] text-success flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> mic sẵn sàng</span>
                  : <span className="text-[10px] text-error">mic chưa sẵn sàng</span>
                }
              </div>
            </div>

            {/* Visualizer */}
            <canvas ref={visualizerRef} className="w-full h-10 rounded-lg bg-surface2 mb-2" />

            <div className="flex flex-wrap gap-2">
              {speakers.map(p => (
                <div key={p.id} className={`relative flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${activeSpeakers.has(p.id) ? 'bg-primary/20 ring-2 ring-primary' : 'bg-surface2'}`}>
                  <div className="relative">
                    <Avatar seed={p.anonymousAvatarSeed} size="lg" />
                    {p.isMuted && <MicOff size={12} className="absolute -bottom-0.5 -right-0.5 bg-error text-white rounded-full p-0.5" />}
                    {p.role === 'HOST' && <Crown size={11} className="absolute -top-1 -right-1 text-warning" />}
                    {activeSpeakers.has(p.id) && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                        {[0, 1, 2].map(i => (
                          <span key={i} className="w-0.5 bg-primary rounded-full animate-pulse" style={{ height: `${8 + Math.random() * 8}px`, animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium max-w-[60px] truncate">{p.anonymousName?.split(' ')[0]}</span>
                  {user?.id !== p.id && (
                    <button onClick={() => sendGiftTo(p.id)} className="absolute inset-0 opacity-0 hover:opacity-100 bg-black/40 rounded-xl flex items-center justify-center transition">
                      <Gift size={14} className="text-accent" />
                    </button>
                  )}
                </div>
              ))}
              {speakers.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-text-secondary py-2">
                  <Mic size={14} className="opacity-50" />
                  Không có ai đang nói. Giơ tay để được phát biểu!
                </div>
              )}
            </div>
          </div>

          {/* Listeners */}
          <div className="p-3 flex-1 overflow-y-auto">
            <h4 className="text-xs font-semibold text-text-secondary mb-2">👥 NGƯỜI NGHE ({listeners.length})</h4>
            <div className="grid grid-cols-8 gap-2">
              {listeners.map(p => (
                <div key={p.id} className="relative group flex flex-col items-center gap-0.5">
                  <div className="relative">
                    <Avatar seed={p.anonymousAvatarSeed} size="sm" />
                    {p.handRaised && <Hand size={10} className="absolute -top-1 -right-1 text-warning animate-bounce" />}
                  </div>
                  <span className="text-[9px] text-text-secondary max-w-[40px] truncate">{p.anonymousName?.split(' ')[0]}</span>
                  {user?.id !== p.id && (
                    <button onClick={() => sendGiftTo(p.id)} className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/30 rounded-lg flex items-center justify-center transition">
                      <Gift size={10} className="text-accent" />
                    </button>
                  )}
                  {isHost && p.handRaised && (
                    <button onClick={() => socketService.promoteSpeaker(id!, p.id)}
                      className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] bg-primary text-white px-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">
                      cho nói
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Chat */}
          <div className="h-36 border-t border-white/5 flex flex-col">
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {messages.filter(m => m.type !== 'SYSTEM').slice(-20).map(m => (
                <div key={m.id} className={`flex gap-1.5 ${m.user?.id === user?.id ? 'flex-row-reverse' : ''}`}>
                  {m.user && <Avatar seed={m.user.anonymousAvatarSeed} size="sm" />}
                  <div className={`max-w-[75%] rounded-xl px-3 py-1.5 text-sm ${m.user?.id === user?.id ? 'bg-primary/20' : 'bg-surface2'}`}>
                    {m.user && <span className="text-[9px] text-text-secondary block">{m.user.anonymousName}</span>}
                    <p>{m.content}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-2 flex gap-2 border-t border-white/5">
              <input value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Nhắn tin..." className="flex-1 bg-surface2 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
              <button onClick={sendMessage} className="p-2 rounded-xl bg-primary text-white hover:opacity-90 transition"><Send size={16} /></button>
            </div>
          </div>
        </div>

        {/* ── Sidebar: Room Info ─────────────────────────────────────── */}
        <div className="bg-surface rounded-2xl p-4 flex flex-col gap-4">
          {/* Room Status */}
          <div>
            <h4 className="text-xs font-semibold text-text-secondary mb-2">📋 THÔNG TIN PHÒNG</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-text-secondary">Trạng thái</span>
                <span className={`font-medium ${room.status === 'ACTIVE' ? 'text-success' : room.status === 'WAITING' ? 'text-warning' : 'text-error'}`}>{room.status}</span>
              </div>
              <div className="flex justify-between"><span className="text-text-secondary">Ngôn ngữ</span><span className="font-medium">{langFlags[room.language]} {room.language}</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">Người tham gia</span><span className="font-medium">{room.currentCount}/{room.maxParticipants}</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">Chủ phòng</span>
                <div className="flex items-center gap-1"><span className="font-medium">👑 Chủ phòng ẩn danh</span></div>
              </div>
            </div>
          </div>

          {/* Participants list with kick (host only) */}
          <div id="participants-list" className="hidden">
            <h4 className="text-xs font-semibold text-text-secondary mb-2">👥 DANH SÁCH THÀNH VIÊN</h4>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {participants.map(p => (
                <div key={p.id} className="flex items-center gap-2 bg-surface2 rounded-lg px-3 py-2">
                  <Avatar seed={p.anonymousAvatarSeed} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{p.anonymousName}</div>
                    <div className="text-[9px] text-text-secondary">{p.role}</div>
                  </div>
                  {isHost && p.id !== user?.id && (
                    <button onClick={() => {
                      if (confirm(`Kick ${p.anonymousName} khỏi phòng?`)) {
                        socketService.kickParticipant(id!, p.id);
                      }
                    }}
                      className="px-2 py-1 rounded-lg bg-error/20 text-error text-[10px] font-medium hover:bg-error/30 transition">
                      kick
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          {room.level && (
            <div>
              <h4 className="text-xs font-semibold text-text-secondary mb-2">📚 LEVEL HIỆN TẠI</h4>
              <div className="bg-surface2 rounded-xl p-3">
                <div className="text-sm font-bold text-primary">Level {room.level.levelNumber}</div>
                <div className="text-xs text-text-secondary mt-0.5">{room.level.title}</div>
                <div className="text-xs text-text-secondary">{room.level.stage}</div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="mt-auto space-y-2">
            <button onClick={() => setShowGifts(!showGifts)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-accent/20 text-accent font-medium text-sm hover:bg-accent/30 transition">
              <Gift size={16} /> Tặng quà
            </button>

            {isHost ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => { if (room.isRecording) socketService.stopRecording(id!); else socketService.startRecording(id!); }}
                    className={`py-2 rounded-xl text-xs font-medium text-center transition ${room.isRecording ? 'bg-error/20 text-error animate-pulse' : 'bg-surface2 text-text-secondary'}`}>
                    {room.isRecording ? '⏹ Dừng ghi' : '⏺ Ghi âm'}
                  </button>
                  <button onClick={() => {
                    const participantsEl = document.getElementById('participants-list');
                    if (participantsEl) participantsEl.classList.toggle('hidden');
                  }}
                    className="py-2 rounded-xl text-xs font-medium bg-warning/20 text-warning text-center hover:bg-warning/30 transition">
                    🚫 Kick người
                  </button>
                </div>
                <button onClick={() => {
                  if (confirm('Kết thúc phòng cho tất cả mọi người?')) {
                    socketService.endRoom(id!);
                  }
                }}
                  className="w-full py-2 rounded-xl text-xs font-medium bg-error/20 text-error text-center hover:bg-error/30 transition">
                  ⏹ Kết thúc phòng
                </button>
              </div>
            ) : (
              <button onClick={() => {
                if (confirm('Rời phòng?')) {
                  socketService.leaveRoom(id!);
                }
              }}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-surface2 text-text-secondary font-medium text-sm hover:bg-error/20 hover:text-error transition">
                🚪 Rời phòng
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Mic Controls ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-4 py-3 bg-surface/80 backdrop-blur-sm rounded-2xl border border-white/5">
        <div className="flex flex-col items-center">
          <button onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-full bg-surface2 hover:bg-surface transition text-text-secondary hover:text-white">
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <span className="text-[9px] text-text-secondary mt-0.5">Volume</span>
        </div>

        <button onClick={toggleMic} disabled={!audioReady && myRole !== 'LISTENER'}
          className={`p-5 rounded-full transition-all shadow-lg ${
            myRole === 'LISTENER'
              ? (handRaised ? 'bg-warning text-black shadow-warning/30 animate-pulse' : 'bg-surface2 text-text-secondary hover:text-white')
              : (isMuted ? 'bg-error text-white shadow-error/30' : 'bg-success text-white shadow-success/30 animate-pulse-glow')
          } ${!audioReady && myRole !== 'LISTENER' ? 'opacity-30 cursor-not-allowed' : ''}`}
        >
          {myRole === 'LISTENER' ? (
            handRaised ? <Hand size={28} /> : <Mic size={28} />
          ) : (
            isMuted ? <MicOff size={28} /> : <Mic size={28} />
          )}
        </button>

        {myRole === 'LISTENER' ? (
          <button onClick={toggleMic}
            className="flex flex-col items-center">
            <div className="text-[10px] text-text-secondary">{handRaised ? 'Hạ tay' : 'Giơ tay'}</div>
            {!audioReady && <div className="text-[9px] text-error">chưa có mic</div>}
          </button>
        ) : (
          <div className="flex flex-col items-center">
            <div className="text-[10px] text-text-secondary">{isMuted ? 'Bật mic' : 'Tắt mic'}</div>
            <div className="text-[9px] text-success">{isMuted ? '' : '🔴 LIVE'}</div>
          </div>
        )}
      </div>

      {/* ─── Gift Modal ───────────────────────────────────────────────── */}
      {showGifts && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={() => setShowGifts(false)}>
          <div className="bg-surface rounded-t-3xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold mb-3">Chọn quà tặng</h3>
            <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto">
              {gifts.map(g => (
                <button key={g.id} onClick={() => participants[0] && sendGiftTo(participants[0].id, g.id)}
                  className="bg-surface2 rounded-xl p-3 text-center hover:bg-surface hover:scale-105 transition active:scale-95">
                  <div className="text-2xl mb-0.5">{g.emoji}</div>
                  <div className="text-[10px] font-medium truncate">{g.name}</div>
                  <div className="text-[9px] text-warning">{g.coinCost} coins</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-text-secondary mt-3 text-center">Chọn người nhận bằng cách click vào avatar của họ trong danh sách</p>
          </div>
        </div>
      )}

      {/* ─── Gift Animation Overlay ───────────────────────────────────── */}
      {giftAnimation && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
          <div className="bg-surface border-2 border-accent/40 rounded-3xl px-8 py-6 text-center animate-gift-burst shadow-2xl shadow-accent/20">
            <div className="text-5xl mb-2">{giftAnimation.emoji}</div>
            <div className="font-bold text-lg">{giftAnimation.giftName}</div>
            <div className="text-sm text-text-secondary mt-1">{giftAnimation.senderName} → {giftAnimation.receiverName}</div>
          </div>
        </div>
      )}
    </div>
  );
}
