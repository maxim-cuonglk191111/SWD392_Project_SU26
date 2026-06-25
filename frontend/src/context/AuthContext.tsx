import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { authApi } from '../services/api';
import { socketService } from '../services/socket';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; username: string; displayName: string; avatarId?: number; role?: string }) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('lucy_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('lucy_user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { /* ignore */ }
    }
    if (token) {
      authApi.me().then(res => {
        setUser(res.data.user);
        localStorage.setItem('lucy_user', JSON.stringify(res.data.user));
        socketService.connect(token);
      }).catch(() => {
        logout();
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    const { user: u, token: t } = res.data;
    setUser(u);
    setToken(t);
    localStorage.setItem('lucy_token', t);
    localStorage.setItem('lucy_user', JSON.stringify(u));
    socketService.connect(t);
  };

  const register = async (data: any) => {
    const res = await authApi.register(data);
    const { user: u, token: t } = res.data;
    setUser(u);
    setToken(t);
    localStorage.setItem('lucy_token', t);
    localStorage.setItem('lucy_user', JSON.stringify(u));
    socketService.connect(t);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('lucy_token');
    localStorage.removeItem('lucy_user');
    socketService.disconnect();
  };

  const updateUser = (u: User) => {
    setUser(u);
    localStorage.setItem('lucy_user', JSON.stringify(u));
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
