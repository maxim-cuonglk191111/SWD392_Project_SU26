import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Mic, Globe, Trophy, Zap } from 'lucide-react';
import { roomApi, userApi } from '../services/api';
import { Room } from '../types';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [filter, setFilter] = useState({ language: '', status: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      roomApi.getAll({ ...(filter.language && { language: filter.language }), ...(filter.status && { status: filter.status }) }),
      userApi.getLeaderboard(5),
    ]).then(([r, lb]) => {
      setRooms(r.data.rooms || []);
      setLeaderboard(lb.data.leaderboard || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [filter]);

  const langColors: Record<string, string> = { EN: 'text-blue-400', ZH: 'text-red-400', JP: 'text-pink-400' };
  const langFlags: Record<string, string> = { EN: '🇬🇧', ZH: '🇨🇳', JP: '🇯🇵' };

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-primary/20 to-secondary/10 rounded-2xl p-5 border border-primary/10">
        <div className="flex items-center gap-3">
          <Avatar id={user?.avatarId || 1} size="lg" />
          <div>
            <h2 className="text-lg font-bold">Chào mừng, {user?.displayName?.split(' ')[0] || 'LUCYer'}!</h2>
            <p className="text-sm text-text-secondary">Hôm nay bạn muốn học ngôn ngữ nào?</p>
          </div>
        </div>
        <div className="flex gap-3 mt-3">
          {['EN', 'ZH', 'JP'].map(lang => (
            <button key={lang} onClick={() => setFilter({ ...filter, language: lang })} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium border transition ${filter.language === lang ? 'border-primary bg-primary/20 text-primary' : 'border-white/10 text-text-secondary hover:border-white/30'}`}>
              <span>{langFlags[lang]}</span> {lang === 'EN' ? 'English' : lang === 'ZH' ? 'Chinese' : 'Japanese'}
            </button>
          ))}
          {filter.language && (
            <button onClick={() => setFilter({ ...filter, language: '' })} className="px-3 py-1.5 rounded-full text-sm text-error border border-error/30 hover:bg-error/10">✕ Clear</button>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { icon: Zap, label: 'XP', value: user?.xp || 0, color: 'text-yellow-400' },
          { icon: Trophy, label: 'Level', value: Math.floor((user?.xp || 0) / 100), color: 'text-primary' },
          { icon: Globe, label: 'Coins', value: user?.coin || 0, color: 'text-warning' },
          { icon: Users, label: 'Role', value: user?.role || 'LUCY', color: 'text-secondary' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-surface rounded-xl p-3 text-center">
            <Icon size={18} className={`mx-auto mb-1 ${color}`} />
            <div className={`text-lg font-bold ${color}`}>{value}</div>
            <div className="text-[10px] text-text-secondary">{label}</div>
          </div>
        ))}
      </div>

      {/* Active Rooms */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold flex items-center gap-2"><Mic size={18} className="text-primary" /> Phòng đang hoạt động</h3>
          <div className="flex gap-2">
            {['', 'WAITING', 'ACTIVE'].map(s => (
              <button key={s} onClick={() => setFilter({ ...filter, status: s })} className={`px-2 py-1 rounded-lg text-xs transition ${filter.status === s ? 'bg-primary text-white' : 'bg-surface2 text-text-secondary hover:text-white'}`}>
                {s === '' ? 'All' : s === 'WAITING' ? 'Waiting' : 'Active'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-surface rounded-xl animate-pulse" />)}</div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-8 text-text-secondary">
            <Mic size={40} className="mx-auto mb-2 opacity-30" />
            <p>Không có phòng nào đang hoạt động</p>
            <p className="text-xs mt-1">Hãy là người đầu tiên tạo phòng!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map(room => (
              <div key={room.id} onClick={() => navigate(`/room/${room.id}`)} className="bg-surface rounded-xl p-4 border border-white/5 hover:border-primary/30 cursor-pointer transition group">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-semibold ${langColors[room.language]}`}>{langFlags[room.language]} {room.language}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${room.status === 'ACTIVE' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>{room.status}</span>
                      {room.isRecording && <span className="text-xs px-2 py-0.5 rounded-full bg-error/20 text-error animate-pulse">🔴 Recording</span>}
                    </div>
                    <h4 className="font-semibold group-hover:text-primary transition">{room.title}</h4>
                    {room.level && <p className="text-xs text-text-secondary mt-0.5">{room.level.stage} · Level {room.level.levelNumber}: {room.level.title}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-text-secondary">
                      <span className="flex items-center gap-1"><Avatar seed={room.hostId.charCodeAt(0)} size="sm" /> 👑 Chủ phòng ẩn danh</span>
                      <span>{room.currentCount}/{room.maxParticipants} người</span>
                    </div>
                  </div>
                  <button className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-sm font-medium opacity-0 group-hover:opacity-100 transition">Tham gia</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <section>
          <h3 className="font-bold flex items-center gap-2 mb-3"><Trophy size={18} className="text-warning" /> Bảng xếp hạng XP</h3>
          <div className="bg-surface rounded-xl overflow-hidden">
            {leaderboard.map((u, i) => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0">
                <span className={`w-6 text-center font-bold text-sm ${i === 0 ? 'text-warning' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-400' : 'text-text-secondary'}`}>#{i + 1}</span>
                <Avatar id={u.avatarId} size="sm" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{u.displayName}</div>
                  <div className="text-xs text-text-secondary">{u.xp} XP</div>
                </div>
                {u.role !== 'LUCY' && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">{u.role}</span>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
