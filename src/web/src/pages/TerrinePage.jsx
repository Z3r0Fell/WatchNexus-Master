import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tv, Plus, Trash2, Loader2, Clock, CheckCircle2, Radio, Calendar } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { Layout } from '../components/layout/Layout';
import axios from 'axios';
import { BACKEND_URL } from '../lib/config';

const API = BACKEND_URL;
const STATUS_BADGE = { scheduled: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Scheduled' }, recording: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'Recording' }, completed: { bg: 'bg-green-500/15', text: 'text-green-400', label: 'Completed' } };

const TerrinePage = () => {
  const [recordings, setRecordings] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newRec, setNewRec] = useState({ title: '', channel: '', start_time: '', end_time: '' });

  const fetch_ = useCallback(async () => { try { const [r, s] = await Promise.all([axios.get(`${API}/api/terrine/recordings`), axios.get(`${API}/api/terrine/stats`)]); setRecordings(r.data.recordings || []); setStats(s.data); } catch {} finally { setLoading(false); } }, []);
  useEffect(() => { fetch_(); }, [fetch_]);

  const handleAdd = async () => {
    if (!newRec.title || !newRec.channel) { toast.error('Title and channel required'); return; }
    try { const res = await axios.post(`${API}/api/terrine/recordings`, newRec); if (res.data.success) { toast.success(res.data.message); fetch_(); setShowAdd(false); setNewRec({ title: '', channel: '', start_time: '', end_time: '' }); } } catch (err) { toast.error('Failed'); }
  };

  const handleDelete = async (id) => { if (!window.confirm('Delete recording?')) return; try { await axios.delete(`${API}/api/terrine/recordings/${id}`); toast.success('Deleted'); fetch_(); } catch {} };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6" data-testid="terrine-page">
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-bold text-white flex items-center gap-3"><Tv className="w-8 h-8 text-red-400" /> DVR Recordings</h1><p className="text-gray-400 text-sm mt-1">{stats ? `${stats.scheduled} scheduled, ${stats.recording} recording, ${stats.completed} completed` : 'Schedule and manage TV recordings'}</p></div>
          <Button size="sm" onClick={() => setShowAdd(!showAdd)} className="bg-red-600 hover:bg-red-700"><Plus className="w-4 h-4 mr-1" /> Schedule</Button>
        </div>

        {stats && <div className="grid grid-cols-3 gap-3">{[{ l: 'Scheduled', v: stats.scheduled, c: 'text-amber-400' }, { l: 'Recording', v: stats.recording, c: 'text-red-400' }, { l: 'Completed', v: stats.completed, c: 'text-green-400' }].map(s => <div key={s.l} className="bg-surface border border-white/10 rounded-xl p-3 text-center"><p className={`text-xl font-bold ${s.c}`}>{s.v}</p><p className="text-[11px] text-gray-500">{s.l}</p></div>)}</div>}

        <AnimatePresence>{showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-surface border border-white/10 rounded-2xl p-6 space-y-3">
            <h3 className="font-semibold text-white">Schedule Recording</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input type="text" value={newRec.title} onChange={(e) => setNewRec(p => ({ ...p, title: e.target.value }))} placeholder="Program title" className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600" />
              <input type="text" value={newRec.channel} onChange={(e) => setNewRec(p => ({ ...p, channel: e.target.value }))} placeholder="Channel" className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600" />
              <input type="datetime-local" value={newRec.start_time} onChange={(e) => setNewRec(p => ({ ...p, start_time: e.target.value }))} className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm" />
              <input type="datetime-local" value={newRec.end_time} onChange={(e) => setNewRec(p => ({ ...p, end_time: e.target.value }))} className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm" />
            </div>
            <div className="flex gap-2"><Button onClick={handleAdd} className="bg-red-600">Schedule</Button><Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button></div>
          </motion.div>
        )}</AnimatePresence>

        {loading ? <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-red-400" /></div> : recordings.length === 0 ? (
          <div className="text-center py-20 text-gray-500"><Tv className="w-16 h-16 mx-auto mb-4 opacity-20" /><p>No recordings scheduled</p></div>
        ) : (
          <div className="space-y-2">{recordings.map(r => { const sc = STATUS_BADGE[r.status] || STATUS_BADGE.scheduled; return (
            <div key={r.id} className="bg-surface border border-white/10 rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0"><Radio className="w-5 h-5 text-red-400" /></div>
              <div className="flex-1 min-w-0"><p className="text-white font-medium truncate">{r.title}</p><div className="flex items-center gap-2 mt-1"><span className={`text-[11px] px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>{sc.label}</span><span className="text-[11px] text-gray-500">{r.channel}</span>{r.start_time && <span className="text-[11px] text-gray-500 flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" />{new Date(r.start_time).toLocaleString()}</span>}</div></div>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)} className="text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></Button>
            </div>
          ); })}</div>
        )}
      </div>
    </Layout>
  );
};

export default TerrinePage;
