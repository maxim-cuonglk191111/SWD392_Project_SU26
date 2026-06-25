import { useState, useEffect } from 'react';
import { BookOpen, Globe, ChevronRight, Lock } from 'lucide-react';
import { levelApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Explore() {
  const { user } = useAuth();
  const [curriculum, setCurriculum] = useState<Record<string, Record<string, any[]>>>({});
  const [selectedLang, setSelectedLang] = useState('EN');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    levelApi.getCurriculum().then(r => setCurriculum(r.data.curriculum)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const langNames: Record<string, string> = { EN: 'English', ZH: 'Chinese', JP: 'Japanese' };
  const langColors: Record<string, string> = { EN: 'text-blue-400', ZH: 'text-red-400', JP: 'text-pink-400' };
  const stages = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
  const stageNames: Record<string, string> = { BEGINNER: 'Sơ cấp', INTERMEDIATE: 'Trung cấp', ADVANCED: 'Cao cấp' };
  const stageColors: Record<string, string> = { BEGINNER: 'text-green-400', INTERMEDIATE: 'text-yellow-400', ADVANCED: 'text-red-400' };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen size={22} className="text-primary" />
        <h2 className="text-xl font-bold">Lộ trình học tập</h2>
      </div>

      {/* Language Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {['EN', 'ZH', 'JP'].map(lang => (
          <button key={lang} onClick={() => setSelectedLang(lang)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition ${selectedLang === lang ? 'bg-primary text-white' : 'bg-surface text-text-secondary hover:text-white'}`}>
            <Globe size={16} className={selectedLang === lang ? '' : langColors[lang]} />
            {langNames[lang]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-32 bg-surface rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-5">
          {stages.map(stage => {
            const levels = curriculum[selectedLang]?.[stage] || [];
            return (
              <div key={stage}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-sm font-bold ${stageColors[stage]}`}>{stageNames[stage]}</span>
                  <span className="text-xs text-text-secondary">· {levels.length} levels</span>
                </div>
                <div className="space-y-2">
                  {levels.length === 0 ? (
                    <div className="text-center py-6 text-text-secondary text-sm border border-dashed border-white/10 rounded-xl">
                      <Lock size={20} className="mx-auto mb-1 opacity-50" />
                      Chưa có dữ liệu. Upload tài liệu để bắt đầu.
                    </div>
                  ) : (
                    levels.map((level: any) => (
                      <div key={level.id}
                        className="bg-surface rounded-xl p-4 border border-white/5 hover:border-primary/30 transition cursor-pointer group">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                            stage === 'BEGINNER' ? 'bg-green-500/20 text-green-400' :
                            stage === 'INTERMEDIATE' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {level.levelNumber}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm group-hover:text-primary transition">{level.title}</h4>
                            {(level.titleZh || level.titleJp) && (
                              <p className="text-xs text-text-secondary">{level.titleZh || level.titleJp}</p>
                            )}
                            {level.description && <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">{level.description}</p>}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-text-secondary">
                            <span>{level.duration || 60} min</span>
                            <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 text-primary transition" />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {user?.role !== 'LUCY' && (
        <div className="mt-4 p-4 bg-primary/10 border border-primary/20 rounded-xl">
          <p className="text-sm text-text-secondary mb-2">Bạn là {user?.role} — có thể upload tài liệu để tạo thêm levels</p>
          <a href="/create" className="text-sm text-primary font-semibold hover:underline">Upload tài liệu mới →</a>
        </div>
      )}
    </div>
  );
}
