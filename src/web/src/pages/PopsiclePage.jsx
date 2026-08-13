import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Trash2, Loader2, Film, Tv, Wifi, WifiOff, Settings } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { Layout } from '../components/layout/Layout';
import axios from 'axios';
import { BACKEND_URL } from '../lib/config';
import { useConfirm } from '../hooks/use-confirm';

const API = BACKEND_URL;
const STATUS_BADGE = { queued: { bg: 'bg-gray-500/15', text: 'text-gray-400', label: 'Queued' }, downloading: { bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'Downloading' }, completed: { bg: 'bg-green-500/15', text: 'text-green-400', label: 'Ready' }, expired: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'Expired' } };

const PopsiclePage = () => {
  const { confirm, ConfirmDialog } = useConfirm();
  const [downloads, setDownloads] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const fetch_ = useCallback(async () => { try { const [d, s] = await Promise.all([axios.get(`${API}/api/popsicle/downloads`), axios.get(`${API}/api/popsicle/settings`)]); setDownloads(d.data.downloads || []); setSettings(s.data); } catch {} finally { setLoading(false); } }, []);
  useEffect(() => { fetch_(); }, [fetch_]);

  const handleDelete = async (id) => { const ok = await confirm({ title: 'Remove', description: 'Remove?', confirmText: 'Remove' }); if (!ok) return; try { await axios.delete(`${API}/api/popsicle/downloads/${id}`); toast.success('Removed'); fetch_(); } catch {} };

  const handleSaveSettings = async () => { try { await axios.post(`${API}/api/popsicle/settings`, settings); toast.success('Settings saved'); setShowSettings(false); } catch {} };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6" data-testid="popsicle-page">
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-bold text-white flex items-center gap-3"><Download className="w-8 h-8 text-cyan-400" /> Offline Sync</h1><p className="text-gray-400 text-sm mt-1">Download media for offline viewing</p></div>
          <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)}><Settings className="w-4 h-4 mr-1" /> Settings</Button>
        </div>

        <AnimatePresence>{showSettings && settings && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-surface border border-white/10 rounded-2xl p-6 space-y-3">
            <h3 className="font-semibold text-white">Offline Sync Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><label className="text-xs text-gray-400 mb-1 block">Max Concurrent Downloads</label><input type="number" value={settings.max_downloads || 5} onChange={(e) => setSettings(p => ({ ...p, max_downloads: parseInt(e.target.value) }))} className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm" /></div>
              <div><label className="text-xs text-gray-400 mb-1 block">Default Quality</label><select value={settings.default_quality || '720p'} onChange={(e) => setSettings(p => ({ ...p, default_quality: e.target.value }))} className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm"><option value="480p">480p</option><option value="720p">720p</option><option value="1080p">1080p</option><option value="4k">4K</option></select></div>
              <div><label className="text-xs text-gray-400 mb-1 block">Auto-delete After (days)</label><input type="number" value={settings.auto_delete_days || 30} onChange={(e) => setSettings(p => ({ ...p, auto_delete_days: parseInt(e.target.value) }))} className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm" /></div>
            </div>
            <div className="flex gap-2"><Button onClick={handleSaveSettings} className="bg-cyan-600">Save</Button><Button variant="ghost" onClick={() => setShowSettings(false)}>Cancel</Button></div>
          </motion.div>
        )}</AnimatePresence>

        {loading ? <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div> : downloads.length === 0 ? (
          <div className="text-center py-20 text-gray-500"><WifiOff className="w-16 h-16 mx-auto mb-4 opacity-20" /><p className="text-lg font-medium">No offline downloads</p><p className="text-sm mt-1">Queue media from your library for offline viewing</p></div>
        ) : (
          <div className="space-y-2">{downloads.map(d => { const sc = STATUS_BADGE[d.status] || STATUS_BADGE.queued; return (
            <div key={d.id} className="bg-surface border border-white/10 rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center shrink-0">{d.media_type === 'tv' ? <Tv className="w-5 h-5 text-cyan-400" /> : <Film className="w-5 h-5 text-cyan-400" />}</div>
              <div className="flex-1 min-w-0"><p className="text-white font-medium truncate">{d.title}</p><div className="flex items-center gap-2 mt-1"><span className={`text-[11px] px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>{sc.label}</span><span className="text-[11px] text-gray-500">{d.quality}</span>{d.file_size > 0 && <span className="text-[11px] text-gray-500">{(d.file_size / 1048576).toFixed(0)} MB</span>}{d.expires_at && <span className="text-[11px] text-gray-500">Expires {new Date(d.expires_at).toLocaleDateString()}</span>}</div>{d.progress > 0 && d.progress < 100 && <div className="mt-2 h-1 bg-white/5 rounded-full"><div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${d.progress}%` }} /></div>}</div>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(d.id)} className="text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></Button>
            </div>
          ); })}</div>
        )}
      </div>
    <ConfirmDialog />
    </Layout>
  );
};

export default PopsiclePage;
