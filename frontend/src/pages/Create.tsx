import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Mic, CheckCircle } from 'lucide-react';
import { roomApi, levelApi, documentApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Create() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'room' | 'document'>('room');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Room form
  const [roomForm, setRoomForm] = useState({ title: '', description: '', language: 'EN', levelId: '', maxParticipants: 50 });
  const [levels, setLevels] = useState<any[]>([]);

  // Document form
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docLang, setDocLang] = useState('EN');
  const [docResult, setDocResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadLevels = (lang: string) => {
    setRoomForm({ ...roomForm, language: lang, levelId: '' });
    levelApi.getAll({ language: lang }).then(r => setLevels(r.data.levels || [])).catch(console.error);
  };

  const createRoom = async () => {
    if (!roomForm.title.trim()) { setError('Vui lòng nhập tên phòng'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await roomApi.create(roomForm);
      navigate(`/room/${res.data.room.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const uploadDocument = async () => {
    if (!docFile) { setError('Vui lòng chọn file'); return; }
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', docFile);
      fd.append('language', docLang);
      const res = await documentApi.upload(fd);
      setDocResult(res.data);
      setSuccess(`Upload thành công! Đã tạo ${res.data.levelsCreated || 0} levels từ tài liệu.`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.role === 'LUCY') {
    return (
      <div className="text-center py-20">
        <Mic size={48} className="mx-auto mb-4 text-text-secondary opacity-30" />
        <h2 className="text-xl font-bold mb-2">PRO hoặc SUPER cần thiết</h2>
        <p className="text-text-secondary text-sm">Nâng cấp tài khoản để tạo phòng hoặc upload tài liệu</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold">Tạo mới</h2>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'room', label: 'Tạo Phòng', icon: Mic },
          { key: 'document', label: 'Upload Tài liệu', icon: Upload },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${tab === t.key ? 'bg-primary text-white' : 'bg-surface text-text-secondary hover:text-white'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {error && <div className="bg-error/10 border border-error/30 text-error text-sm rounded-xl px-4 py-3">{error}</div>}
      {success && <div className="bg-success/10 border border-success/30 text-success text-sm rounded-xl px-4 py-3 flex items-center gap-2"><CheckCircle size={16} /> {success}</div>}

      {tab === 'room' && (
        <div className="bg-surface rounded-2xl p-5 space-y-4">
          <h3 className="font-bold">Tạo phòng học mới</h3>

          <div>
            <label className="text-sm text-text-secondary mb-1 block">Tên phòng</label>
            <input value={roomForm.title} onChange={e => setRoomForm({ ...roomForm, title: e.target.value })} className="w-full bg-surface2 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/50" placeholder="Survival English - Level 1-5" />
          </div>

          <div>
            <label className="text-sm text-text-secondary mb-1 block">Mô tả (tùy chọn)</label>
            <textarea value={roomForm.description} onChange={e => setRoomForm({ ...roomForm, description: e.target.value })} className="w-full bg-surface2 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/50 resize-none h-20" placeholder="Phòng học cho người mới bắt đầu..." />
          </div>

          <div>
            <label className="text-sm text-text-secondary mb-2 block">Ngôn ngữ</label>
            <div className="flex gap-2">
              {[{ v: 'EN', n: '🇬🇧 English' }, { v: 'ZH', n: '🇨🇳 Chinese' }, { v: 'JP', n: '🇯🇵 Japanese' }].map(l => (
                <button key={l.v} onClick={() => loadLevels(l.v)} className={`px-4 py-2 rounded-xl text-sm transition ${roomForm.language === l.v ? 'bg-primary text-white' : 'bg-surface2 text-text-secondary hover:text-white'}`}>{l.n}</button>
              ))}
            </div>
          </div>

          {levels.length > 0 && (
            <div>
              <label className="text-sm text-text-secondary mb-1 block">Level (tùy chọn)</label>
              <select value={roomForm.levelId} onChange={e => setRoomForm({ ...roomForm, levelId: e.target.value })} className="w-full bg-surface2 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/50">
                <option value="">Không chọn level</option>
                {levels.map((l: any) => <option key={l.id} value={l.id}>Level {l.levelNumber}: {l.title}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="text-sm text-text-secondary mb-1 block">Số người tối đa: {roomForm.maxParticipants}</label>
            <input type="range" min="5" max="200" value={roomForm.maxParticipants} onChange={e => setRoomForm({ ...roomForm, maxParticipants: parseInt(e.target.value) })} className="w-full accent-primary" />
          </div>

          <button onClick={createRoom} disabled={loading} className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-primary/80 font-semibold text-white hover:opacity-90 transition disabled:opacity-50">
            {loading ? 'Đang tạo...' : 'Tạo phòng ngay'}
          </button>
        </div>
      )}

      {tab === 'document' && (
        <div className="bg-surface rounded-2xl p-5 space-y-4">
          <h3 className="font-bold">Upload tài liệu Word/PDF</h3>
          <p className="text-sm text-text-secondary">Hệ thống sẽ tự động phân tích và tạo các level học từ nội dung tài liệu. Hỗ trợ file .docx và .pdf</p>

          <div className="flex gap-2">
            {[{ v: 'EN', n: '🇬🇧 English' }, { v: 'ZH', n: '🇨🇳 Chinese' }, { v: 'JP', n: '🇯🇵 Japanese' }].map(l => (
              <button key={l.v} onClick={() => setDocLang(l.v)} className={`px-4 py-2 rounded-xl text-sm transition ${docLang === l.v ? 'bg-primary text-white' : 'bg-surface2 text-text-secondary'}`}>{l.n}</button>
            ))}
          </div>

          <input ref={fileRef} type="file" accept=".docx,.pdf" onChange={e => setDocFile(e.target.files?.[0] || null)} className="hidden" />

          <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-primary/30 rounded-2xl p-8 text-center cursor-pointer hover:border-primary/60 transition">
            {docFile ? (
              <div>
                <FileText size={32} className="mx-auto mb-2 text-primary" />
                <p className="font-medium">{docFile.name}</p>
                <p className="text-xs text-text-secondary mt-1">{(docFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <div>
                <Upload size={32} className="mx-auto mb-2 text-text-secondary opacity-50" />
                <p className="text-text-secondary text-sm">Click để chọn file .docx hoặc .pdf</p>
                <p className="text-xs text-text-secondary mt-1">Tối đa 50MB</p>
              </div>
            )}
          </div>

          {docResult && docResult.levelsCreated > 0 && (
            <div className="bg-success/10 border border-success/30 rounded-xl p-4">
              <p className="text-sm font-medium text-success">Thành công!</p>
              <p className="text-xs text-text-secondary mt-1">Đã tạo {docResult.levelsCreated} levels từ tài liệu. Truy cập Explore để xem.</p>
            </div>
          )}

          <button onClick={uploadDocument} disabled={loading || !docFile} className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-primary/80 font-semibold text-white hover:opacity-90 transition disabled:opacity-50">
            {loading ? 'Đang phân tích...' : 'Upload & Phân tích'}
          </button>
        </div>
      )}
    </div>
  );
}
