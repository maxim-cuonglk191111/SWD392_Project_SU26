import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mic, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/home');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-4">
            <Mic size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold">LUCY</h1>
          <p className="text-text-secondary mt-1">Language Unity & Collaborative Youth</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-bold mb-4">Welcome back</h2>

          {error && (
            <div className="bg-error/10 border border-error/30 text-error text-sm rounded-lg px-4 py-2">{error}</div>
          )}

          <div>
            <label className="text-sm text-text-secondary mb-1 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-surface2 rounded-lg px-4 py-3 text-white placeholder-text-secondary/50 outline-none focus:ring-2 focus:ring-primary/50 transition"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="text-sm text-text-secondary mb-1 block">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-surface2 rounded-lg px-4 py-3 pr-12 text-white placeholder-text-secondary/50 outline-none focus:ring-2 focus:ring-primary/50 transition"
                placeholder="••••••••"
                required
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-white">
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-primary/80 font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <p className="text-center text-sm text-text-secondary">
            New to LUCY?{' '}
            <Link to="/register" className="text-primary font-semibold hover:underline">Create account</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
