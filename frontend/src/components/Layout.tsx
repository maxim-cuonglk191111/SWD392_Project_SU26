import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Compass, PlusCircle, User, Mic } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  const navItems = [
    { to: '/home', icon: Home, label: 'Home' },
    { to: '/explore', icon: Compass, label: 'Explore' },
    ...(user?.role !== 'LUCY' ? [{ to: '/create', icon: PlusCircle, label: 'Create' }] : []),
    { to: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Mic size={16} className="text-white" />
            </div>
            <span className="font-bold text-lg">LUCY</span>
            {user && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/20 text-primary border border-primary/30">
                {user.role}
              </span>
            )}
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-text-secondary">{user.xp} XP</div>
                <div className="text-xs text-warning font-semibold">{user.coin} coins</div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-4 pb-20">
        {children}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-md border-t border-white/5 safe-area-pb">
        <div className="max-w-4xl mx-auto flex justify-around py-2">
          {navItems.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to || (to === '/home' && location.pathname === '/');
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-col items-center gap-1 px-4 py-1 rounded-lg transition-all ${
                  active ? 'text-primary' : 'text-text-secondary hover:text-white'
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
