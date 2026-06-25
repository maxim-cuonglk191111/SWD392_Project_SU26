import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Hand, Send, Gift, ArrowLeft, Users, Radio, Lock, Crown } from 'lucide-react';
import { roomApi, giftApi } from '../services/api';
import { socketService } from '../services/socket';
import { Room, Participant, Message, Gift as GiftType } from '../types';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../context/AuthContext';

export default function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const token = localStorage.getItem('lucy_token');

  useEffect(() => {
    if (!id || !token) { navigate('/home'); return; }

    socketService.connect(token);

    const loadRoom = async () => {
      try {
        const res = await roomApi.getOne(id);
        setRoom(res.data.room);
        setParticipants(res.data.room.participants?.map((p: any) => ({
          id: p.userId, username: p.user.username, displayName: p.user.displayName,
          avatarId: p.user.avatarId, role: p.role, handRaised: p.handRaised,
          isMuted: p.isMuted, isSpeaker: p.isSpeaker,
        })) || []);
      } catch { navigate('/home'); }
      setLoading(false);
    };

    const loadGifts = async () => {
      try { const res = await giftApi.getAll(); setGifts(res.data.gifts || []); } catch { /* ignore */ }
    };

    loadRoom();
    loadGifts();

    // Socket listeners
    const handleRoomUpdate = (data: any) => {
      if (data.roomId === id) {
        setParticipants(data.participants);
        setRoom(prev => prev ? { ...prev, currentCount: data.currentCount } : null);
      }
    };

    const handleJoined = (data: any) => { if (data.roomId === id) setMyRole(data.role); };
    const handleHandUpdate = (data: any) => {
      setParticipants(prev => prev.map(p => p.id === data.userId ? { ...p, handRaised: data.handRaised } : p));
    };
    const handleParticipantUpdate = (data: any) => {
      setParticipants(prev => prev.map(p => p.id === data.userId ? { ...p, ...data } : p));
      if (data.userId === user?.id) {
        if (data.isMuted !== undefined) setIsMuted(data.isMuted);
        if (data.role) setMyRole(data.role);
      }
    };
    const handleMessage = (data: Message) => {
      if (data.roomId === id) setMessages(prev => [...prev, data]);
    };
    const handleGiftReceived = (data: any) => {
      setGiftAnimation(data);
      setTimeout(() => setGiftAnimation(null), 3000);
    };
    const handleNotification = (data: any) => {
      setMessages(prev => [...prev, { id: Date.now().toString(), roomId: id || '', content: data.message, type: 'SYSTEM', createdAt: new Date().toISOString() }]);
    };
    const handleStageChanged = (data: any) => {
      setRoom(prev => prev ? { ...prev, currentSubLevel: data.subLevel } : null);
    };
    const handleParticipantKicked = (data: any) => {
      if (data.userId === user?.id) navigate('/home');
      else setParticipants(prev => prev.filter(p => p.id !== data.userId));
    };

    socketService.on('room_update', handleRoomUpdate);
    socketService.on('joined_room', handleJoined);
    socketService.on('hand_update', handleHandUpdate);
    socketService.on('participant_update', handleParticipantUpdate);
    socketService.on('message_received', handleMessage);
    socketService.on('gift_received', handleGiftReceived);
    socketService.on('notification', handleNotification);
    socketService.on('stage_changed', handleStageChanged);
    socketService.on('participant_kicked', handleParticipantKicked);

    socketService.joinRoom(id);

    return () => {
      socketService.off('room_update', handleRoomUpdate);
      socketService.off('joined_room', handleJoined);
      socketService.off('hand_update', handleHandUpdate);
      socketService.off('participant_update', handleParticipantUpdate);
      socketService.off('message_received', handleMessage);
      socketService.off('gift_received', handleGiftReceived);
      socketService.off('notification', handleNotification);
      socketService.off('stage_changed', handleStageChanged);
      socketService.off('participant_kicked', handleParticipantKicked);
      socketService.leaveRoom(id);
    };
  }, [id]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = () => {
    if (!message.trim() || !id) return;
    socketService.sendMessage(id, message.trim());
    setMessage('');
  };

  const toggleMic = () => {
    if (!id) return;
    if (myRole === 'LISTENER') {
      socketService.raiseHand(id);
      setHandRaised(!handRaised);
    } else {
      socketService.toggleMic(id);
      setIsMuted(!isMuted);
    }
  };

  const sendGiftTo = (receiverId: string) => {
    if (!id) return;
    // Use first gift for demo
    if (gifts.length > 0) {
      socketService.sendGift(id, gifts[0].id, receiverId);
    }
    setShowGifts(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>;
  if (!room) return <div className="text-center py-20 text-text-secondary">Room not found</div>;

  const isHost = user?.id === room.hostId;
  const speakers = participants.filter(p => p.isSpeaker || p.role === 'HOST' || p.role === 'MODERATOR');
  const listeners = participants.filter(p => p.role === 'LISTENER' && !p.isSpeaker);
  const langFlags: Record<string, string> = { EN: '🇬🇧', ZH: '🇨🇳', JP: '🇯🇵' };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-3">
      {/* Room Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/home')} className="p-2 rounded-lg bg-surface hover:bg-surface2 transition"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">{langFlags[room.language]} {room.language}</span>
            {room.status === 'ACTIVE' && <Radio size={14} className="text-success animate-pulse" />}
            {room.isRecording && <span className="text-xs px-2 py-0.5 rounded-full bg-error/20 text-error animate-pulse">REC</span>}
          </div>
          <h1 className="font-bold">{room.title}</h1>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-sm text-text-secondary"><Users size={14} /> {room.currentCount}/{room.maxParticipants}</div>
          {room.level && <div className="text-xs text-text-secondary">{room.level.stage} L{room.level.levelNumber}</div>}
        </div>
      </div>

      <div className="flex-1 flex gap-3 overflow-hidden">
        {/* Main Panel */}
        <div className="flex-1 flex flex-col bg-surface rounded-2xl overflow-hidden">
          {/* Speakers */}
          <div className="p-3 border-b border-white/5">
            <h4 className="text-xs font-semibold text-text-secondary mb-2">🎤 SPEAKERS</h4>
            <div className="flex flex-wrap gap-2">
              {speakers.map(p => (
                <div key={p.id} className="relative group">
                  <div className="flex flex-col items-center gap-1">
                    <div className="relative">
                      <Avatar id={p.avatarId} size="lg" />
                      {p.isMuted && <MicOff size={12} className="absolute -bottom-1 -right-1 bg-error text-white rounded-full p-0.5" />}
                      {p.role === 'HOST' && <Crown size={12} className="absolute -top-1 -right-1 text-warning" />}
                    </div>
                    <span className="text-xs font-medium max-w-[60px] truncate">{p.displayName?.split(' ')[0]}</span>
                  </div>
                  {/* Gift button for non-self */}
                  {user?.id !== p.id && (
                    <button onClick={() => sendGiftTo(p.id)} className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/40 rounded-lg flex items-center justify-center transition">
                      <Gift size={16} className="text-accent" />
                    </button>
                  )}
                </div>
              ))}
              {speakers.length === 0 && <p className="text-xs text-text-secondary">No speakers yet. Hand raise to speak!</p>}
            </div>
          </div>

          {/* Listeners */}
          <div className="flex-1 p-3 overflow-y-auto">
            <h4 className="text-xs font-semibold text-text-secondary mb-2">👥 LISTENERS</h4>
            <div className="grid grid-cols-6 gap-2">
              {listeners.map(p => (
                <div key={p.id} className="relative group">
                  <div className="flex flex-col items-center gap-1">
                    <div className="relative">
                      <Avatar id={p.avatarId} size="md" />
                      {p.handRaised && <Hand size={12} className="absolute -top-1 -right-1 text-warning animate-bounce" />}
                    </div>
                    <span className="text-[10px] text-text-secondary max-w-[50px] truncate">{p.displayName?.split(' ')[0]}</span>
                  </div>
                  {user?.id !== p.id && (
                    <button onClick={() => sendGiftTo(p.id)} className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/40 rounded-lg flex items-center justify-center transition">
                      <Gift size={14} className="text-accent" />
                    </button>
                  )}
                  {isHost && p.handRaised && (
                    <button onClick={() => socketService.promoteSpeaker(id!, p.id)} className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] bg-primary text-white px-1 rounded opacity-0 group-hover:opacity-100">promote</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Chat */}
          <div className="h-40 border-t border-white/5 flex flex-col">
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.filter(m => m.type !== 'SYSTEM').slice(-30).map(m => (
                <div key={m.id} className={`flex gap-2 ${m.user?.id === user?.id ? 'flex-row-reverse' : ''}`}>
                  {m.user && <Avatar id={m.user.avatarId} size="sm" />}
                  <div className={`max-w-[70%] rounded-xl px-3 py-2 text-sm ${m.user?.id === user?.id ? 'bg-primary/20 text-primary-foreground' : 'bg-surface2'}`}>
                    {m.user && <span className="text-[10px] text-text-secondary">{m.user.displayName}</span>}
                    <p>{m.content}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-2 flex gap-2 border-t border-white/5">
              <input value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder="Say something..." className="flex-1 bg-surface2 rounded-xl px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
              <button onClick={sendMessage} className="p-2 rounded-xl bg-primary text-white hover:opacity-90 transition"><Send size={18} /></button>
            </div>
          </div>
        </div>
      </div>

      {/* Mic Controls */}
      <div className="flex items-center justify-center gap-3 py-2">
        <button onClick={() => setShowGifts(!showGifts)} className="p-3 rounded-full bg-surface2 hover:bg-accent/20 transition"><Gift size={22} className="text-accent" /></button>
        <button onClick={toggleMic}
          className={`p-4 rounded-full transition ${myRole === 'LISTENER' ? (handRaised ? 'bg-warning text-black' : 'bg-surface2 text-text-secondary hover:text-white') : (isMuted ? 'bg-error text-white' : 'bg-success text-white animate-pulse-glow')}`}>
          {myRole === 'LISTENER' ? (handRaised ? <Hand size={24} /> : <Mic size={24} />) : (isMuted ? <MicOff size={24} /> : <Mic size={24} />)}
        </button>
        {isHost && (
          <button onClick={() => { socketService.stopRecording(id!); navigate('/home'); }} className="p-3 rounded-full bg-error/20 text-error hover:bg-error/30 transition"><Lock size={22} /></button>
        )}
      </div>

      {/* Gift Modal */}
      {showGifts && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={() => setShowGifts(false)}>
          <div className="bg-surface rounded-t-3xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold mb-3">Send a Gift</h3>
            <div className="grid grid-cols-4 gap-3 max-h-60 overflow-y-auto">
              {gifts.map(g => (
                <button key={g.id} onClick={() => { if (participants[0]) sendGiftTo(participants[0].id); setShowGifts(false); }} className="bg-surface2 rounded-xl p-3 text-center hover:bg-surface hover:scale-105 transition">
                  <div className="text-2xl mb-1">{g.emoji}</div>
                  <div className="text-xs font-medium">{g.name}</div>
                  <div className="text-[10px] text-warning">{g.coinCost} coins</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Gift Animation */}
      {giftAnimation && (
        <div className="fixed top-1/3 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="bg-surface border border-accent/30 rounded-2xl px-6 py-4 text-center animate-gift-burst">
            <div className="text-4xl mb-2">{giftAnimation.emoji}</div>
            <div className="text-sm font-bold">{giftAnimation.giftName}</div>
            <div className="text-xs text-text-secondary">{giftAnimation.senderName} → {giftAnimation.receiverName}</div>
          </div>
        </div>
      )}
    </div>
  );
}
