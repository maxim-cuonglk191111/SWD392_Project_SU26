import React, { useEffect, useState } from 'react';
import socketService from '../services/socketService';
import agoraService, { checkMicEnvironment } from '../services/agoraService';
import { 
  Mic, 
  MicOff, 
  Hand, 
  Activity, 
  Clock, 
  Layers, 
  Pin, 
  Gift, 
  Trophy, 
  Shield, 
  VolumeX, 
  Sparkles, 
  X,
  ExternalLink,
  MessageSquare,
  Volume2,
  Trash2,
  Download,
  Upload,
  FileText,
  File,
  Paperclip,
  AlertTriangle
} from 'lucide-react';

import { IDENTITY_URL, BACKEND_URL } from '../config';

export default function Room({ me, roomId }) {
  const [users, setUsers] = useState([]);
  const [latency, setLatency] = useState(0);
  const [stageInfo, setStageInfo] = useState({ stage: 1, topic: 'Loading...', timeLeft: 0 });
  const [handRaiseQueue, setHandRaiseQueue] = useState([]);
  const [pinnedDoc, setPinnedDoc] = useState(null);
  const [giftsFeed, setGiftsFeed] = useState([]);
  const [leaderboard, setLeaderboard] = useState({});
  const [latestGift, setLatestGift] = useState(null);
  const [toast, setToast] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [activeTab, setActiveTab] = useState('controls'); // 'controls' or 'chat'
  const [testingMic, setTestingMic] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [myVolume, setMyVolume] = useState(0);
  // Lỗi mic — null nếu ok, string nếu có vấn đề (HTTPS, permission, v.v.)
  const [micError, setMicError] = useState(() => {
    const { ok, reason } = checkMicEnvironment();
    return ok ? null : reason;
  });
  
  // Wallet Balance State
  const [balance, setBalance] = useState(0);
  
  // UI States
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [docInput, setDocInput] = useState('');
  const [materials, setMaterials] = useState([]);
  const [materialTab, setMaterialTab] = useState('syllabus'); // 'syllabus' or 'files'
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  
  const isHost = me?.role === 'LUCY Pro' || me?.role === 'LUCY Super';

  const gifts = [
    { name: '☕ Coffee', cost: 10, icon: '☕' },
    { name: '🌟 Star', cost: 50, icon: '🌟' },
    { name: '👑 Crown', cost: 100, icon: '👑' },
    { name: '🚀 Rocket', cost: 500, icon: '🚀' }
  ];

  // Fetch initial Wallet Balance from .NET Service
  useEffect(() => {
    if (me && me.userId) {
      fetch(`${IDENTITY_URL}/api/wallet/${me.userId}/balance`)
        .then(res => res.json())
        .then(data => {
          if (data && typeof data.balance === 'number') {
            setBalance(data.balance);
          }
        })
        .catch(err => console.error("Error fetching balance:", err));
    }
  }, [me]);

  useEffect(() => {
    socketService.on('room_users', (roomUsers) => {
      setUsers(roomUsers);
    });

    socketService.on('user_updated', (updatedUser) => {
      setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    });

    socketService.setLatencyCallback((lat) => {
      setLatency(lat);
    });

    socketService.on('stage_changed', (data) => {
      setStageInfo(prev => ({ ...prev, stage: data.stage, topic: data.topic, timeLeft: data.timeLeft }));
    });

    socketService.on('timer_update', (data) => {
      setStageInfo(prev => ({ ...prev, stage: data.stage, timeLeft: data.timeLeft }));
    });

    socketService.on('hand_raise_updated', (queue) => {
      setHandRaiseQueue(queue);
    });

    socketService.on('document_pinned', (docUrl) => {
      setPinnedDoc(docUrl);
    });

    socketService.on('materials_updated', (roomMaterials) => {
      setMaterials(roomMaterials);
    });

    socketService.on('gift_sent', (data) => {
      if (data.gift) {
        setGiftsFeed(prev => [data.gift, ...prev].slice(0, 5));
        setLatestGift(data.gift);
        setTimeout(() => setLatestGift(null), 3000);
      }
      setLeaderboard(data.leaderboard || {});
    });

    socketService.on('gift_transfer_success', (data) => {
      setBalance(data.balance);
      showToast(data.message || 'Tặng quà thành công!');
    });

    socketService.on('gift_transfer_error', (data) => {
      showToast(data.message || 'Lỗi giao dịch quà tặng.', 'error');
    });

    socketService.on('new_message', (msg) => {
      setMessages(prev => [...prev, msg].slice(-50));
    });

    return () => {
      socketService.off('room_users');
      socketService.off('user_updated');
      socketService.off('stage_changed');
      socketService.off('timer_update');
      socketService.off('hand_raise_updated');
      socketService.off('document_pinned');
      socketService.off('materials_updated');
      socketService.off('gift_sent');
      socketService.off('gift_transfer_success');
      socketService.off('gift_transfer_error');
      socketService.off('new_message');
    };
  }, []);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handlePinDoc = (e) => {
    e.preventDefault();
    if (docInput.trim()) {
      socketService.pinDocument(docInput.trim());
      setDocInput('');
      setPinModalOpen(false);
      showToast('Đã ghim tài liệu thành công!');
    }
  };

  const handleSendGift = (gift) => {
    socketService.sendGift(gift.name, gift.cost);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('roomId', roomId || 'lisa-stage-1');

    try {
      const res = await fetch(`${BACKEND_URL}/api/syllabus/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        showToast('Đã tải lên và bóc tách giáo trình thành công!');
      } else {
        showToast('Tải lên thất bại: ' + (data.error || 'Lỗi'), 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi kết nối khi tải file giáo trình.', 'error');
    }
  };

  const handleMaterialUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingMaterial(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('roomId', roomId || 'lisa-stage-1');
    formData.append('uploadedBy', me?.name || 'Anonymous');

    try {
      const res = await fetch(`${BACKEND_URL}/api/materials/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        showToast('Tải lên học liệu thành công!');
      } else {
        showToast('Tải lên học liệu thất bại: ' + (data.error || 'Lỗi'), 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi kết nối khi tải file học liệu.', 'error');
    } finally {
      setUploadingMaterial(false);
      e.target.value = '';
    }
  };

  const handleMaterialDelete = async (materialId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa học liệu này?')) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/materials/${roomId || 'lisa-stage-1'}/${materialId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        showToast('Đã xóa học liệu thành công!');
      } else {
        showToast('Xóa học liệu thất bại: ' + (data.error || 'Lỗi'), 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi kết nối khi xóa học liệu.', 'error');
    }
  };

  useEffect(() => {
    let interval;
    if (testingMic) {
      interval = setInterval(() => {
        const level = agoraService.getVolumeLevel();
        setMicVolume(Math.round(level * 100));
      }, 100);
    } else {
      setMicVolume(0);
    }
    return () => clearInterval(interval);
  }, [testingMic]);

  const handleToggleTestMic = async () => {
    const nextState = !testingMic;
    if (nextState) {
      try {
        setMicError(null);
        await agoraService.startEchoTest();
        setTestingMic(true);
      } catch (err) {
        setMicError(err.message);
        showToast(err.message, 'error');
        setTestingMic(false);
      }
    } else {
      agoraService.stopEchoTest();
      setTestingMic(false);
      setMicError(null);
    }
  };

  useEffect(() => {
    let interval;
    if (me && !me.isMuted) {
      interval = setInterval(() => {
        setMyVolume(Math.round(agoraService.getVolumeLevel() * 100));
      }, 150);
    } else {
      setMyVolume(0);
    }
    return () => clearInterval(interval);
  }, [me, me?.isMuted]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (chatInput.trim()) {
      socketService.sendMessage(chatInput.trim());
      setChatInput('');
    }
  };

  return (
    <div className="p-4 md:p-8 pb-40 max-w-7xl mx-auto w-full min-h-screen relative">
      
      {/* Latest Gift floating notification */}
      {latestGift && (
        <div className="fixed top-24 right-6 bg-gradient-to-r from-yellow-500/20 via-purple-600/20 to-pink-500/20 border border-yellow-500/30 rounded-2xl p-4 shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl z-[999] flex items-center gap-3 animate-float max-w-sm">
          <div className="text-3xl animate-bounce">🎁</div>
          <div>
            <div className="text-xs text-zinc-400 font-medium">Quà tặng gửi đến phòng</div>
            <div className="text-sm font-black text-white">
              <span className="text-primary">{latestGift.from}</span> đã tặng <span className="text-yellow-400">{latestGift.giftName}</span> (+{latestGift.coins} xu)
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white shadow-lg shadow-primary/20">L</div>
          <div>
            <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70 tracking-tight">LUCY LIVE SPACE</h1>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Level {stageInfo.stage * 15} - Stage {stageInfo.stage}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="glass-panel px-4 py-2 flex items-center gap-2 !rounded-full bg-white/[0.01]">
            <span className="text-yellow-500 font-bold">🪙</span>
            <span className="font-semibold text-xs tracking-wide text-zinc-300">Ví: {balance} xu</span>
          </div>
          <div className="glass-panel px-4 py-2 flex items-center gap-3 !rounded-full bg-white/[0.01]">
            <Activity size={14} className={latency < 100 ? 'text-green-400' : latency < 300 ? 'text-yellow-400' : 'text-red-400'} />
            <span className="font-semibold text-xs tracking-wide text-zinc-300">{latency} ms</span>
          </div>
        </div>
      </div>

      {/* Stage Info Bar */}
      <div className="glass-panel p-5 mb-8 flex flex-col md:flex-row md:items-center justify-between bg-white/[0.01] gap-4">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-inner border border-primary/10">
            <Layers size={20} />
          </div>
          <div>
            <div className="text-[10px] font-black text-primary tracking-widest uppercase mb-0.5">Tiến trình giáo trình</div>
            <div className="text-lg font-bold text-white leading-tight">{stageInfo.topic}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* AI Helper Suggestion Starter */}
          {isHost && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-2 flex items-center gap-2 text-primary font-bold text-xs max-w-sm">
              <Sparkles size={14} className="animate-pulse" />
              <span>Gợi ý thảo luận từ AI được cập nhật dựa trên level bài học!</span>
            </div>
          )}
          <div className="flex items-center gap-3 bg-background/50 px-5 py-2.5 rounded-xl border border-white/5 self-end md:self-auto">
            <Clock size={16} className={stageInfo.timeLeft < 60 ? 'text-red-400 animate-pulse' : 'text-accent'} />
            <span className={`text-xl font-black tracking-widest font-mono ${stageInfo.timeLeft < 60 ? 'text-red-400' : 'text-white'}`}>
              {formatTime(stageInfo.timeLeft)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Pinned Slides & Active Users */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Pin Document Section */}
          <div className="glass-panel p-5 relative overflow-hidden bg-white/[0.01]">
            <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-3">
              <div className="flex gap-4">
                <button 
                  onClick={() => setMaterialTab('syllabus')}
                  className={`text-sm font-bold pb-1 transition-all border-b-2 ${
                    materialTab === 'syllabus' 
                      ? 'text-white border-primary' 
                      : 'text-zinc-500 hover:text-zinc-300 border-transparent'
                  }`}
                >
                  Giáo trình & Slide
                </button>
                <button 
                  onClick={() => setMaterialTab('files')}
                  className={`text-sm font-bold pb-1 transition-all border-b-2 flex items-center gap-1.5 ${
                    materialTab === 'files' 
                      ? 'text-white border-primary' 
                      : 'text-zinc-500 hover:text-zinc-300 border-transparent'
                  }`}
                >
                  Tài liệu đính kèm
                  {materials.length > 0 && (
                    <span className="bg-primary/20 text-primary text-[10px] font-black px-1.5 py-0.5 rounded-full">
                      {materials.length}
                    </span>
                  )}
                </button>
              </div>

              <div className="flex gap-2">
                {materialTab === 'syllabus' ? (
                  isHost && (
                    <>
                      <label className="text-xs bg-accent/20 hover:bg-accent/30 text-accent px-3 py-1.5 rounded-lg font-bold border border-accent/20 transition-all cursor-pointer flex items-center gap-1.5">
                        <span>Tải lên giáo trình (.txt)</span>
                        <input 
                          type="file" 
                          accept=".txt" 
                          onChange={handleFileUpload} 
                          className="hidden" 
                        />
                      </label>
                      <button 
                        onClick={() => setPinModalOpen(true)}
                        className="text-xs bg-primary/20 hover:bg-primary/30 text-primary px-3 py-1.5 rounded-lg font-bold border border-primary/20 transition-all"
                      >
                        {pinnedDoc ? 'Ghim tài liệu mới' : 'Ghim tài liệu/Slide'}
                      </button>
                    </>
                  )
                ) : (
                  <label className="text-xs bg-primary/20 hover:bg-primary/30 text-primary px-3 py-1.5 rounded-lg font-bold border border-primary/20 transition-all cursor-pointer flex items-center gap-1.5">
                    <span>{uploadingMaterial ? 'Đang tải lên...' : 'Tải lên học liệu'}</span>
                    <input 
                      type="file" 
                      accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg" 
                      disabled={uploadingMaterial}
                      onChange={handleMaterialUpload} 
                      className="hidden" 
                    />
                  </label>
                )}
              </div>
            </div>

            {materialTab === 'syllabus' ? (
              <div>
                {pinnedDoc ? (
                  <div className="bg-background/80 border border-white/5 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center font-bold text-xs uppercase">Slide</div>
                      <div>
                        <div className="text-xs text-zinc-400">Tài liệu học tập hiện tại</div>
                        <a 
                          href={pinnedDoc} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-sm font-bold text-white hover:underline flex items-center gap-1.5"
                        >
                          {pinnedDoc.length > 40 ? pinnedDoc.substring(0, 40) + '...' : pinnedDoc}
                          <ExternalLink size={12} className="text-zinc-500" />
                        </a>
                      </div>
                    </div>
                    {isHost && (
                      <button 
                        onClick={() => socketService.pinDocument('')}
                        className="text-zinc-500 hover:text-white p-1"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="border border-dashed border-white/10 rounded-xl p-6 text-center text-zinc-500 text-xs font-semibold">
                    Chưa có tài liệu/slide nào được ghim trong phòng nghe này.
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {materials.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-1">
                    {materials.map((mat) => {
                      const ext = mat.name.split('.').pop()?.toLowerCase();
                      const isDoc = ['doc', 'docx', 'txt'].includes(ext);
                      const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(ext);
                      const isPdf = ext === 'pdf';
                      const isExcel = ['xls', 'xlsx'].includes(ext);
                      const isPowerpoint = ['ppt', 'pptx'].includes(ext);
                      
                      const sizeStr = mat.size >= 1024 * 1024 
                        ? `${(mat.size / (1024 * 1024)).toFixed(1)} MB` 
                        : `${(mat.size / 1024).toFixed(0)} KB`;

                      return (
                        <div key={mat.id} className="bg-background/50 border border-white/5 rounded-xl p-3 flex items-center justify-between hover:border-white/10 transition-all">
                          <div className="flex items-center gap-3 overflow-hidden mr-2">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-[9px] uppercase shrink-0 ${
                              isPdf ? 'bg-red-500/10 text-red-400' :
                              isDoc ? 'bg-blue-500/10 text-blue-400' :
                              isExcel ? 'bg-green-500/10 text-green-400' :
                              isPowerpoint ? 'bg-orange-500/10 text-orange-400' :
                              isImage ? 'bg-purple-500/10 text-purple-400' :
                              'bg-zinc-700/20 text-zinc-400'
                            }`}>
                              {isPdf && 'PDF'}
                              {isDoc && 'DOC'}
                              {isExcel && 'XLS'}
                              {isPowerpoint && 'PPT'}
                              {isImage && 'IMG'}
                              {!['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'gif'].includes(ext) && <Paperclip size={14} />}
                            </div>
                            <div className="overflow-hidden">
                              <div className="text-xs font-bold text-white truncate" title={mat.name}>
                                {mat.name}
                              </div>
                              <div className="text-[10px] text-zinc-500 font-semibold flex items-center gap-1.5 mt-0.5">
                                <span>{sizeStr}</span>
                                <span>•</span>
                                <span className="truncate">Bởi: {mat.uploadedBy}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <a 
                              href={mat.url} 
                              download={mat.name} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-1.5 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white rounded-lg transition-all"
                              title="Tải xuống học liệu"
                            >
                              <Download size={13} />
                            </a>
                            {isHost && (
                              <button
                                onClick={() => handleMaterialDelete(mat.id)}
                                className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all"
                                title="Xóa học liệu"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="border border-dashed border-white/10 rounded-xl p-6 text-center text-zinc-500 text-xs font-semibold">
                    Chưa có học liệu đính kèm nào được tải lên cho phòng này.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Active Users */}
          <div>
            <h3 className="text-zinc-400 font-bold text-xs uppercase tracking-wider mb-4">Danh sách thành viên ({users.length})</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {users.map((user) => {
                const isMe = user.id === me?.id;
                const isUserHost = user.role === 'LUCY Pro' || user.role === 'LUCY Super';
                const isSpeaking = !user.isMuted;

                return (
                  <div 
                    key={user.id} 
                    className={`glass-panel p-5 flex flex-col items-center justify-center relative transition-all duration-300 group ${
                      isMe ? 'ring-1 ring-white/20 bg-white/[0.03]' : 'hover:bg-white/[0.02]'
                    } ${isSpeaking ? 'shadow-[0_0_25px_rgba(139,92,246,0.15)] ring-1 ring-primary/30' : ''}`}
                  >
                    {/* User profile avatar */}
                    <div className="relative mb-4">
                      <div className={`w-16 h-16 rounded-[1.25rem] flex items-center justify-center text-xl font-black shadow-lg bg-gradient-to-br ${
                        isUserHost 
                          ? 'from-purple-500 to-indigo-600 text-white' 
                          : 'from-zinc-700 to-zinc-800 text-zinc-300'
                      }`}>
                        <span>{user.name.charAt(0)}</span>
                      </div>
                      
                      {isSpeaking && (
                        <div className="absolute -inset-1.5 bg-primary/20 rounded-[1.5rem] -z-10 animate-pulse-glow"></div>
                      )}

                      <div className="absolute -bottom-1 -right-1 flex gap-0.5">
                        {user.isHandRaised && (
                          <div className="bg-yellow-500 text-black p-1.5 rounded-lg shadow-lg z-10 animate-bounce">
                            <Hand size={10} className="fill-current" />
                          </div>
                        )}
                        <div className={`p-1.5 rounded-lg shadow-lg z-10 ${user.isMuted ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                          {user.isMuted ? <MicOff size={10} /> : <Mic size={10} />}
                        </div>
                      </div>
                    </div>

                    <div className="text-center w-full px-1">
                      <span className="font-bold text-sm truncate block text-zinc-200">
                        {user.name}
                      </span>
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5 flex items-center justify-center gap-1">
                        {isUserHost && <Shield size={8} className="text-primary" />}
                        {user.role} {isMe && '(Me)'}
                      </span>
                    </div>

                    {/* Host quick controls on member hover */}
                    {isHost && !isMe && !isUserHost && (
                      <div className="absolute inset-0 bg-background/90 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center gap-2 p-2 backdrop-blur-sm">
                        {user.isMuted ? (
                          <button
                            onClick={() => socketService.approveSpeaker(user.id)}
                            className="bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all"
                          >
                            <Mic size={12} />
                            Duyệt Mic
                          </button>
                        ) : (
                          <button
                            onClick={() => socketService.revokeSpeaker(user.id)}
                            className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all"
                          >
                            <MicOff size={12} />
                            Tắt Mic
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mic Test Utility */}
          <div className="glass-panel p-5 bg-white/[0.01]">
            <h3 className="text-zinc-300 font-bold text-sm flex items-center gap-2 mb-4">
              <Volume2 size={16} className="text-accent" />
              <span>Kiểm tra &amp; Cân chỉnh Micro</span>
            </h3>

            {/* Banner lỗi mic (HTTPS / quyền) */}
            {micError && (
              <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5">
                <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-amber-300 text-xs leading-relaxed">{micError}</p>
                  {micError.includes('HTTPS') && (
                    <p className="text-zinc-500 text-[10px] mt-1 font-semibold">
                      Ảnh hưởng: Cả Test Mic và nói chuyện trong phòng sẽ không hoạt động được.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex-1 w-full">
                <div className="flex justify-between text-xs font-semibold text-zinc-400 mb-2">
                  <span>Mức âm lượng micro: {micVolume}%</span>
                  <span className={micVolume > 20 && micVolume < 75 ? 'text-green-400 font-bold' : micVolume >= 75 ? 'text-red-400 font-bold animate-pulse' : 'text-zinc-500'}>
                    {micVolume === 0 ? 'Mute/Chưa test' : micVolume > 20 && micVolume < 75 ? 'Tốt (Ideal)' : micVolume >= 75 ? 'Quá to (Peak)!' : 'Quá nhỏ'}
                  </span>
                </div>

                {/* Volume bar indicator */}
                <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden border border-white/5 relative">
                  <div
                    className={`h-full transition-all duration-75 ${
                      micVolume > 75
                        ? 'bg-gradient-to-r from-green-500 via-yellow-400 to-red-500'
                        : micVolume > 20
                          ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                          : 'bg-zinc-600'
                    }`}
                    style={{ width: `${Math.min(micVolume, 100)}%` }}
                  ></div>
                  {micVolume > 0 && (
                    <div
                      className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_#fff] transition-all duration-75"
                      style={{ left: `${Math.min(micVolume, 98)}%` }}
                    ></div>
                  )}
                </div>
              </div>

              <button
                onClick={handleToggleTestMic}
                disabled={!!micError && !testingMic}
                title={micError && !testingMic ? micError : ''}
                className={`w-full md:w-auto px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
                  micError && !testingMic
                    ? 'bg-zinc-800 text-zinc-600 border border-white/5 cursor-not-allowed'
                    : testingMic
                      ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20'
                      : 'bg-accent/20 hover:bg-accent/30 text-accent border border-accent/20'
                }`}
              >
                {micError && !testingMic ? '⚠️ Mic không khả dụng' : testingMic ? 'Dừng kiểm tra' : 'Bắt đầu test mic'}
              </button>
            </div>
          </div>

        </div>

        {/* Right 1 Column: Queue, Gifts, Leaderboard & Chat */}
        <div className="space-y-6">

          {/* Tab Header */}
          <div className="flex bg-white/[0.02] border border-white/5 rounded-2xl p-1 gap-1">
            <button
              onClick={() => setActiveTab('controls')}
              className={`flex-1 py-2 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'controls' 
                  ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Activity size={12} />
              Điều khiển
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-2 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'chat' 
                  ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <MessageSquare size={12} />
              Trò chuyện ({messages.length})
            </button>
          </div>

          {activeTab === 'chat' ? (
            <div className="glass-panel p-5 bg-white/[0.01] flex flex-col h-[400px]">
              <h3 className="text-zinc-300 font-bold text-sm flex items-center gap-2 mb-4">
                <MessageSquare size={16} className="text-primary" />
                <span>Trò chuyện trực tuyến</span>
              </h3>

              {/* Chat messages list */}
              <div className="flex-1 overflow-y-auto mb-4 pr-1 space-y-3 scrollbar-thin">
                {messages.length > 0 ? (
                  messages.map(m => (
                    <div key={m.id} className="text-xs">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`font-black uppercase text-[8px] px-1.5 py-0.5 rounded ${
                          m.role === 'LUCY Pro' || m.role === 'LUCY Super' 
                            ? 'bg-primary/20 text-primary border border-primary/20' 
                            : 'bg-zinc-800 text-zinc-400'
                        }`}>
                          {m.role === 'LUCY Pro' ? 'Mentor' : m.role === 'LUCY Super' ? 'Creator' : 'Học viên'}
                        </span>
                        <span className="font-bold text-zinc-300">{m.sender}</span>
                        <span className="text-[9px] text-zinc-500 font-mono">
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="bg-surface/50 border border-white/5 rounded-xl px-3 py-2 text-zinc-300 max-w-[90%] break-words">
                        {m.text}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex items-center justify-center text-center text-zinc-500 text-xs font-semibold">
                    Chưa có tin nhắn nào. Gửi tin nhắn đầu tiên!
                  </div>
                )}
              </div>

              {/* Message form */}
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Nhập nội dung tin nhắn..."
                  className="flex-1 bg-surface border border-white/10 rounded-xl px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-primary/50 text-xs font-medium"
                />
                <button
                  type="submit"
                  className="bg-primary hover:bg-primary/80 text-white font-bold text-xs px-3 rounded-xl transition-all"
                >
                  Gửi
                </button>
              </form>
            </div>
          ) : (
            <>
              {/* Hand Raise Queue (Host Panel) */}
              <div className="glass-panel p-5 bg-white/[0.01]">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-zinc-300 font-bold text-sm flex items-center gap-2">
                    <Hand size={16} className="text-yellow-400" />
                    <span>Yêu cầu phát biểu (FIFO)</span>
                  </h3>
                  <span className="bg-yellow-400/20 text-yellow-400 text-[10px] font-black px-2 py-0.5 rounded-full">
                    {handRaiseQueue.length}
                  </span>
                </div>

                {handRaiseQueue.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {handRaiseQueue.map((user, index) => (
                      <div key={user.id} className="bg-surface/50 border border-white/5 rounded-xl p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-500 text-xs font-bold">#{index + 1}</span>
                          <div className="text-xs font-bold text-white">{user.name}</div>
                        </div>
                        {isHost ? (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => socketService.approveSpeaker(user.id)}
                              className="bg-primary text-white text-[10px] font-black px-2.5 py-1 rounded-md hover:bg-primary/80 transition-all"
                            >
                              Duyệt
                            </button>
                            <button
                              onClick={() => socketService.revokeSpeaker(user.id)}
                              className="bg-white/5 hover:bg-white/10 text-zinc-300 text-[10px] font-black px-2.5 py-1 rounded-md transition-all"
                            >
                              Hạ mic
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Đang đợi...</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-zinc-500 text-xs font-semibold py-4">
                    Chưa có ai giơ tay phát biểu.
                  </div>
                )}

                {isHost && users.some(u => !u.isMuted && u.role === 'LUCY') && (
                  <button
                    onClick={() => socketService.muteAll()}
                    className="w-full mt-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
                  >
                    <VolumeX size={14} />
                    Tắt micro cả phòng
                  </button>
                )}
              </div>

              {/* Virtual Gift Shop & Leaderboard */}
              <div className="glass-panel p-5 bg-white/[0.01]">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-zinc-300 font-bold text-sm flex items-center gap-2">
                    <Gift size={16} className="text-primary" />
                    <span>Gửi quà tặng Host</span>
                  </h3>
                  <span className="text-[10px] text-zinc-400 font-bold">Số dư: <span className="text-yellow-400 font-black">{balance} xu</span></span>
                </div>

                {/* Shop items */}
                <div className="grid grid-cols-2 gap-2 mb-5">
                  {gifts.map(g => (
                    <button
                      key={g.name}
                      onClick={() => handleSendGift(g)}
                      className="bg-surface hover:bg-white/5 border border-white/5 p-2.5 rounded-xl text-center transition-all flex flex-col items-center group active:scale-95"
                    >
                      <span className="text-xl group-hover:scale-110 transition-transform">{g.icon}</span>
                      <span className="text-xs font-bold text-zinc-200 mt-1">{g.name}</span>
                      <span className="text-[10px] text-yellow-500 font-bold mt-0.5">{g.cost} xu</span>
                    </button>
                  ))}
                </div>

                {/* Leaderboard */}
                <div className="border-t border-white/5 pt-4">
                  <h4 className="text-zinc-400 font-bold text-[10px] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Trophy size={12} className="text-yellow-500" />
                    <span>Bảng vinh danh xu</span>
                  </h4>

                  {Object.keys(leaderboard).length > 0 ? (
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      {Object.entries(leaderboard)
                        .sort(([, a], [, b]) => b - a)
                        .map(([name, coins], idx) => (
                          <div key={name} className="flex justify-between items-center text-xs font-medium">
                            <div className="flex items-center gap-2">
                              <span className={`w-4 h-4 rounded-full flex items-center justify-center font-bold text-[10px] ${
                                idx === 0 ? 'bg-yellow-400 text-black' : idx === 1 ? 'bg-zinc-300 text-black' : 'bg-orange-400 text-black'
                              }`}>{idx + 1}</span>
                              <span className="text-white font-semibold">{name}</span>
                            </div>
                            <span className="text-yellow-500 font-bold">{coins} xu</span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center text-zinc-500 text-[11px] font-semibold py-2">
                      Chưa có đóng góp xu nào trong phòng này.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

        </div>

      </div>

      {/* Slide Pinning Modal */}
      {pinModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm z-[9999]">
          <div className="glass-panel p-6 max-w-md w-full relative">
            <button 
              onClick={() => setPinModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              <X size={18} />
            </button>
            <h3 className="text-lg font-black text-white mb-2">Ghim tài liệu học tập</h3>
            <p className="text-zinc-400 text-xs mb-4">Nhập đường dẫn tài liệu giáo trình hoặc Slide học tập của phòng luyện nói này.</p>
            
            <form onSubmit={handlePinDoc} className="space-y-4">
              <input 
                type="url" 
                required
                value={docInput}
                onChange={(e) => setDocInput(e.target.value)}
                placeholder="Ví dụ: https://docs.google.com/presentation/..." 
                className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-primary/50 text-sm"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPinModalOpen(false)}
                  className="bg-white/5 hover:bg-white/10 text-zinc-300 px-4 py-2 rounded-xl text-xs font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="bg-primary text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-primary/80 transition-all"
                >
                  Xác nhận Ghim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 border rounded-2xl p-4 shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl z-[999] flex items-center gap-3 animate-float max-w-sm ${
          toast.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          <div className="text-xl">{toast.type === 'success' ? '✨' : '⚠️'}</div>
          <div>
            <div className="text-sm font-bold text-white">{toast.message}</div>
          </div>
        </div>
      )}

    </div>
  );
}
