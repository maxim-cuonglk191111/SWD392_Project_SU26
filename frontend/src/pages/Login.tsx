import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [selectedRole, setSelectedRole] = useState<'LUCY' | 'PRO' | 'SUPER'>('LUCY');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const roles = [
    { name: 'Ẩn danh', sub: 'Học viên', value: 'LUCY' as const },
    { name: 'Pro', sub: 'Mentor', value: 'PRO' as const },
    { name: 'Super', sub: 'Creator', value: 'SUPER' as const },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;

    setLoading(true);
    setError('');

    // Generate credentials behind the scenes for anonymous entry
    const cleanNickname = nickname.trim();
    const uniqueSuffix = Math.floor(Math.random() * 1000000);
    const email = `anon_${cleanNickname.toLowerCase().replace(/[^a-z0-9]/g, '')}_${uniqueSuffix}@lucy.com`;
    const password = `pass_${uniqueSuffix}`;
    const username = `${cleanNickname.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Math.floor(Math.random() * 10000)}`;

    try {
      await register({
        email,
        password,
        username,
        displayName: cleanNickname,
        role: selectedRole,
      });
      navigate('/home');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Đăng nhập không thành công. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#13131a] border border-white/5 rounded-[32px] p-8 shadow-2xl text-center">
        {/* Glowing Mic Icon */}
        <div className="w-20 h-20 mx-auto mb-6 p-[2px] bg-gradient-to-tr from-accent via-[#a855f7] to-secondary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
          <div className="w-full h-full bg-[#13131a] rounded-2xl flex items-center justify-center">
            <Mic size={36} className="text-white" />
          </div>
        </div>

        {/* Title & Subtitle */}
        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">LUCY Voice Space</h1>
        <p className="text-text-secondary text-sm font-medium leading-relaxed max-w-[280px] mx-auto mb-8">
          Đăng nhập ẩn danh và tham gia phòng luyện nói tiếng Anh real-time.
        </p>

        {error && (
          <div className="mb-4 bg-error/10 border border-error/30 text-error text-sm rounded-lg px-4 py-2 text-left">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Nickname Input */}
          <div>
            <label className="text-xs font-bold text-text-secondary tracking-widest block text-left mb-2">
              BIỆT DANH (NICKNAME)
            </label>
            <input
              type="text"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              className="w-full bg-[#181824] border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-text-secondary/40 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200"
              placeholder="Ví dụ: Alex, Linda,..."
              required
              minLength={2}
              maxLength={20}
            />
          </div>

          {/* User Role Selection */}
          <div>
            <label className="text-xs font-bold text-text-secondary tracking-widest block text-left mb-2">
              VAI TRÒ NGƯỜI DÙNG
            </label>
            <div className="grid grid-cols-3 gap-3">
              {roles.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setSelectedRole(r.value)}
                  className={`flex flex-col items-center justify-center py-4 px-3 rounded-xl border transition-all duration-200 ${
                    selectedRole === r.value
                      ? 'border-primary bg-primary/10 text-white shadow-lg shadow-primary/10'
                      : 'border-white/5 bg-[#181824] text-text-secondary hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className={`font-bold text-sm ${selectedRole === r.value ? 'text-white' : 'text-text-secondary'}`}>
                    {r.name}
                  </span>
                  <span className="text-[10px] text-text-secondary/70 mt-1">
                    {r.sub}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white hover:bg-white/90 active:scale-[0.98] text-black font-bold py-3.5 px-4 rounded-xl transition-all duration-200 shadow-xl shadow-white/5 disabled:opacity-50 mt-6"
          >
            {loading ? 'Đang kết nối...' : 'Vào phòng học'}
          </button>
        </form>
      </div>
    </div>
  );
}
