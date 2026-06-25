import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mic } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AvatarGrid } from '../components/Avatar';

const ROLES = [
  { value: 'LUCY', label: 'LUCY (Free)', desc: 'Join rooms, learn anonymously, send gifts' },
  { value: 'PRO', label: 'PRO ($9.99)', desc: 'Create rooms, pin documents, manage learners' },
  { value: 'SUPER', label: 'SUPER ($19.99)', desc: 'Record podcasts, premium content, analytics' },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', username: '', displayName: '', role: 'LUCY', avatarId: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await register(form);
      navigate('/home');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-3">
            <Mic size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold">Join LUCY</h1>
          <p className="text-text-secondary text-sm">Create your language learning account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface rounded-2xl p-6 space-y-4">
          {error && (
            <div className="bg-error/10 border border-error/30 text-error text-sm rounded-lg px-4 py-2">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-sm text-text-secondary mb-1 block">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full bg-surface2 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-primary/50" placeholder="you@example.com" required />
            </div>
            <div className="col-span-2">
              <label className="text-sm text-text-secondary mb-1 block">Username</label>
              <input type="text" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className="w-full bg-surface2 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-primary/50" placeholder="cooluser" maxLength={20} required />
            </div>
            <div className="col-span-2">
              <label className="text-sm text-text-secondary mb-1 block">Display Name</label>
              <input type="text" value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} className="w-full bg-surface2 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-primary/50" placeholder="Cool User" maxLength={50} required />
            </div>
            <div className="col-span-2">
              <label className="text-sm text-text-secondary mb-1 block">Password</label>
              <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="w-full bg-surface2 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-primary/50" placeholder="Min 6 characters" required />
            </div>
          </div>

          <div>
            <label className="text-sm text-text-secondary mb-2 block">Choose Your Avatar</label>
            <AvatarGrid selected={form.avatarId} onSelect={id => setForm({ ...form, avatarId: id })} />
          </div>

          <div>
            <label className="text-sm text-text-secondary mb-2 block">Account Type</label>
            <div className="space-y-2">
              {ROLES.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setForm({ ...form, role: r.value })}
                  className={`w-full text-left rounded-lg px-4 py-3 border transition-all ${
                    form.role === r.value ? 'border-primary bg-primary/10' : 'border-white/10 bg-surface2 hover:border-white/20'
                  }`}
                >
                  <div className="font-semibold text-sm">{r.label}</div>
                  <div className="text-xs text-text-secondary">{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-primary/80 font-semibold text-white hover:opacity-90 transition disabled:opacity-50">
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <p className="text-center text-sm text-text-secondary">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-semibold hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
