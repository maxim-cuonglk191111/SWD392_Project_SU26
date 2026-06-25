import { useState, useEffect } from 'react';
import { Trophy, Mic, Gift, History, Wallet, Settings, Star, Crown, Radio } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { userApi, roomApi, progressApi, walletApi } from '../services/api';
import { Avatar, AvatarGrid } from '../components/Avatar';

export default function Profile() {
  const { user, updateUser, logout } = useAuth();
  const [tab, setTab] = useState('stats');
  const [stats, setStats] = useState<any>({});
  const [myRooms, setMyRooms] = useState<any[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>({});
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ displayName: user?.displayName || '', bio: user?.bio || '', avatarId: user?.avatarId || 1 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      userApi.getStats(),
      roomApi.getMyRooms(),
      progressApi.getAll(),
      walletApi.getBalance(),
    ]).then(([s, r, p, w]) => {
      setStats(s.data.stats);
      setMyRooms(r.data.rooms || []);
      setProgress(p.data.progress || []);
      setWallet(w.data);
    }).catch(console.error);
  }, [user]);

  const saveProfile = async () => {
    setLoading(true);
    try {
      const res = await userApi.updateProfile(editForm);
      updateUser({ ...user!, ...res.data.user });
      setEditMode(false);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const topup = async (amount: number) => {
    try {
      const res = await walletApi.topup(amount);
      setWallet({ ...wallet, balance: res.data.balance });
      if (user) updateUser({ ...user, coin: res.data.balance });
    } catch (e) { console.error(e); }
  };

  if (!user) return null;

  const tabs = [
    { key: 'stats', label: 'Thống kê', icon: Star },
    { key: 'rooms', label: 'Phòng của tôi', icon: Radio },
    { key: 'wallet', label: 'Ví', icon: Wallet },
    { key: 'settings', label: 'Cài đặt', icon: Settings },
  ];

  return (
    <div className="space-y-5">
      {/* Profile Header */}
      <div className="bg-gradient-to-r from-primary/20 to-secondary/10 rounded-2xl p-5 border border-primary/10">
        {editMode ? (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <Avatar id={editForm.avatarId} size="xl" />
              <div>
                <p className="text-sm text-text-secondary mb-2">Chọn avatar mới:</p>
                <AvatarGrid selected={editForm.avatarId} onSelect={id => setEditForm({ ...editForm, avatarId: id })} />
              </div>
            </div>
            <input value={editForm.displayName} onChange={e => setEditForm({ ...editForm, displayName: e.target.value })} className="w-full bg-surface2 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-primary/50" placeholder="Display name" />
            <textarea value={editForm.bio} onChange={e => setEditForm({ ...editForm, bio: e.target.value })} className="w-full bg-surface2 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-primary/50 resize-none h-20" placeholder="Bio..." />
            <div className="flex gap-2">
              <button onClick={saveProfile} disabled={loading} className="flex-1 py-2 rounded-xl bg-primary text-white font-medium hover:opacity-90 transition">{loading ? 'Saving...' : 'Save'}</button>
              <button onClick={() => setEditMode(false)} className="flex-1 py-2 rounded-xl bg-surface2 text-text-secondary font-medium">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-4">
            <Avatar id={user.avatarId} size="xl" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">{user.displayName}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${user.role === 'SUPER' ? 'bg-warning/20 text-warning' : user.role === 'PRO' ? 'bg-primary/20 text-primary' : 'bg-surface text-text-secondary'}`}>
                  {user.role === 'SUPER' && <Crown size={10} className="inline mr-1" />}
                  {user.role}
                </span>
              </div>
              <p className="text-sm text-text-secondary">@{user.username}</p>
              {user.bio && <p className="text-sm mt-1">{user.bio}</p>}
              <div className="flex gap-4 mt-3">
                <div className="text-center"><div className="font-bold text-primary">{user.xp}</div><div className="text-[10px] text-text-secondary">XP</div></div>
                <div className="text-center"><div className="font-bold text-warning">{user.coin}</div><div className="text-[10px] text-text-secondary">Coins</div></div>
                <div className="text-center"><div className="font-bold text-secondary">{stats.totalRoomsJoined || 0}</div><div className="text-[10px] text-text-secondary">Rooms</div></div>
              </div>
              <button onClick={() => setEditMode(true)} className="mt-3 text-xs text-primary hover:underline">Edit Profile</button>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition ${tab === t.key ? 'bg-primary text-white' : 'bg-surface text-text-secondary hover:text-white'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'stats' && (
        <div className="space-y-3">
          {[
            { label: 'Tổng XP', value: stats.currentXP || user.xp, icon: Trophy, color: 'text-yellow-400' },
            { label: 'Phòng đã tham gia', value: stats.totalRoomsJoined || 0, icon: Mic, color: 'text-primary' },
            { label: 'Quà đã gửi', value: stats.giftsSent || 0, icon: Gift, color: 'text-accent' },
            { label: 'Quà đã nhận', value: stats.giftsReceived || 0, icon: Gift, color: 'text-secondary' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3 bg-surface rounded-xl px-4 py-3">
              <s.icon size={20} className={s.color} />
              <span className="flex-1 text-sm">{s.label}</span>
              <span className={`font-bold ${s.color}`}>{s.value}</span>
            </div>
          ))}

          {progress.length > 0 && (
            <div className="bg-surface rounded-xl p-4">
              <h4 className="font-bold text-sm mb-3">Tiến độ học tập</h4>
              <div className="space-y-2">
                {progress.slice(0, 5).map((p: any) => (
                  <div key={p.id} className="flex items-center gap-3 text-sm">
                    <span className="text-xs text-text-secondary w-20">{p.level?.title?.substring(0, 15)}</span>
                    <div className="flex-1 bg-surface2 rounded-full h-2">
                      <div className="bg-primary rounded-full h-2" style={{ width: p.status === 'COMPLETED' ? '100%' : '50%' }} />
                    </div>
                    <span className={`text-xs ${p.status === 'COMPLETED' ? 'text-success' : 'text-warning'}`}>{p.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'rooms' && (
        <div className="space-y-3">
          {myRooms.length === 0 ? (
            <div className="text-center py-8 text-text-secondary"><Radio size={40} className="mx-auto mb-2 opacity-30" /><p>Chưa tạo phòng nào</p></div>
          ) : (
            myRooms.map((room: any) => (
              <div key={room.id} className="bg-surface rounded-xl p-4 border border-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-sm">{room.title}</h4>
                    <p className="text-xs text-text-secondary">{room._count?.participants || 0} participants</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${room.status === 'ENDED' ? 'bg-surface2 text-text-secondary' : 'bg-success/20 text-success'}`}>{room.status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'wallet' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-warning/20 to-warning/5 rounded-2xl p-5 border border-warning/20 text-center">
            <p className="text-sm text-text-secondary mb-1">Số dư</p>
            <div className="text-4xl font-bold text-warning">{wallet.balance ?? user.coin}</div>
            <p className="text-xs text-text-secondary mt-1">coins</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[100, 500, 1000].map(amount => (
              <button key={amount} onClick={() => topup(amount)} className="bg-surface rounded-xl p-3 text-center hover:bg-surface2 transition">
                <div className="font-bold text-warning">{amount}</div>
                <div className="text-[10px] text-text-secondary">coins</div>
                <div className="text-[10px] text-success mt-1">+{amount} bonus</div>
              </button>
            ))}
          </div>

          {wallet.transactions?.length > 0 && (
            <div className="bg-surface rounded-xl p-4">
              <h4 className="font-bold text-sm mb-3 flex items-center gap-2"><History size={16} /> Lịch sử giao dịch</h4>
              <div className="space-y-2">
                {wallet.transactions.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between text-sm">
                    <div><div className="text-xs text-text-secondary">{t.note || t.type}</div></div>
                    <div className={`font-semibold ${t.amount > 0 ? 'text-success' : 'text-error'}`}>{t.amount > 0 ? '+' : ''}{t.amount}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'settings' && (
        <div className="space-y-3">
          <button onClick={logout} className="w-full py-3 rounded-xl bg-error/10 text-error font-medium hover:bg-error/20 transition">
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}
