import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Search, Plus, Trash2, Loader2, FolderOpen, Play, Clock } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { Layout } from '../components/layout/Layout';
import axios from 'axios';
import { BACKEND_URL } from '../lib/config';

const API = BACKEND_URL;

const TreaclePage = () => {
  const [tracks, setTracks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [scanPath, setScanPath] = useState('');
  const [scanResults, setScanResults] = useState([]);
  const [newTrack, setNewTrack] = useState({ title: '', artist: '', album: '', file_path: '' });

  const fetchTracks = useCallback(async () => {
    try { const params = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ''; const res = await axios.get(`${API}/api/treacle/library${params}`); setTracks(res.data.tracks || []); } catch {} finally { setLoading(false); }
  }, [searchQuery]);

  const fetchStats = useCallback(async () => { try { const res = await axios.get(`${API}/api/treacle/stats`); setStats(res.data); } catch {} }, []);

  useEffect(() => { fetchTracks(); fetchStats(); }, [fetchTracks, fetchStats]);

  const handleAdd = async () => {
    if (!newTrack.title) { toast.error('Title required'); return; }
    try { const res = await axios.post(`${API}/api/treacle/tracks`, newTrack); if (res.data.success) { toast.success('Track added'); fetchTracks(); fetchStats(); setShowAdd(false); setNewTrack({ title: '', artist: '', album: '', file_path: '' }); } } catch (err) { toast.error('Failed'); }
  };

  const handleDelete = async (id) => { if (!window.confirm('Remove?')) return; try { await axios.delete(`${API}/api/treacle/tracks/${id}`); toast.success('Removed'); fetchTracks(); fetchStats(); } catch {} };

  const handleScan = async () => {
    if (!scanPath) return;
    try { const res = await axios.post(`${API}/api/treacle/scan`, { path: scanPath }); setScanResults(res.data.files || []); toast.success(`Found ${res.data.total} tracks`); } catch (err) { toast.error('Scan failed'); }
  };

  const handleImport = async () => {
    for (const f of scanResults) { await axios.post(`${API}/api/treacle/tracks`, { title: f.title, file_path: f.file_path, file_size: f.file_size, format: f.format }).catch(() => {}); }
    toast.success(`Imported ${scanResults.length} tracks`); fetchTracks(); fetchStats(); setShowScan(false); setScanResults([]);
  };

  const formatDuration = (s) => s > 0 ? `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}` : '';

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6" data-testid="treacle-page">
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-bold text-white flex items-center gap-3"><Music className="w-8 h-8 text-emerald-400" /> Music Library</h1><p className="text-gray-400 text-sm mt-1">{stats ? `${stats.total_tracks} tracks, ${stats.artists} artists, ${stats.albums} albums` : 'Manage your music collection'}</p></div>
          <div className="flex gap-2"><Button variant="ghost" size="sm" onClick={() => setShowScan(!showScan)}><FolderOpen className="w-4 h-4 mr-1" /> Scan</Button><Button size="sm" onClick={() => setShowAdd(!showAdd)} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4 mr-1" /> Add</Button></div>
        </div>

        <AnimatePresence>
          {showScan && (<motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-surface border border-white/10 rounded-2xl p-6 space-y-3"><h3 className="font-semibold text-white">Scan Music Directory</h3><div className="flex gap-3"><input type="text" value={scanPath} onChange={(e) => setScanPath(e.target.value)} placeholder="/path/to/music" className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600" /><Button onClick={handleScan} className="bg-emerald-600">Scan</Button></div>{scanResults.length > 0 && <div className="flex justify-between"><p className="text-sm text-gray-400">{scanResults.length} tracks</p><Button size="sm" onClick={handleImport} className="bg-green-600">Import All</Button></div>}</motion.div>)}
          {showAdd && (<motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-surface border border-white/10 rounded-2xl p-6 space-y-3"><h3 className="font-semibold text-white">Add Track</h3><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><input type="text" value={newTrack.title} onChange={(e) => setNewTrack(p => ({ ...p, title: e.target.value }))} placeholder="Title" className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600" /><input type="text" value={newTrack.artist} onChange={(e) => setNewTrack(p => ({ ...p, artist: e.target.value }))} placeholder="Artist" className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600" /><input type="text" value={newTrack.album} onChange={(e) => setNewTrack(p => ({ ...p, album: e.target.value }))} placeholder="Album" className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600" /></div><input type="text" value={newTrack.file_path} onChange={(e) => setNewTrack(p => ({ ...p, file_path: e.target.value }))} placeholder="File path" className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600" /><div className="flex gap-2"><Button onClick={handleAdd} className="bg-emerald-600">Add</Button><Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button></div></motion.div>)}
        </AnimatePresence>

        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" /><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search tracks, artists, albums..." className="w-full pl-10 pr-4 py-2.5 bg-surface border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" /></div>

        {loading ? <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-emerald-400" /></div> : tracks.length === 0 ? (
          <div className="text-center py-20 text-gray-500"><Music className="w-16 h-16 mx-auto mb-4 opacity-20" /><p>No tracks yet</p></div>
        ) : (
          <div className="bg-surface border border-white/10 rounded-2xl overflow-hidden">
            <table className="w-full"><thead><tr className="border-b border-white/10 text-xs text-gray-500 uppercase"><th className="text-left px-4 py-3">#</th><th className="text-left px-4 py-3">Title</th><th className="text-left px-4 py-3 hidden md:table-cell">Artist</th><th className="text-left px-4 py-3 hidden lg:table-cell">Album</th><th className="text-left px-4 py-3 hidden sm:table-cell">Duration</th><th className="px-4 py-3"></th></tr></thead>
            <tbody>{tracks.map((t, i) => (
              <tr key={t.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3 text-gray-500 text-sm">{i + 1}</td>
                <td className="px-4 py-3"><p className="text-white text-sm font-medium truncate max-w-[200px]">{t.title}</p>{t.format && <span className="text-[10px] text-gray-600 uppercase">{t.format}</span>}</td>
                <td className="px-4 py-3 text-gray-400 text-sm hidden md:table-cell truncate max-w-[150px]">{t.artist}</td>
                <td className="px-4 py-3 text-gray-400 text-sm hidden lg:table-cell truncate max-w-[150px]">{t.album}</td>
                <td className="px-4 py-3 text-gray-500 text-sm hidden sm:table-cell">{formatDuration(t.duration)}</td>
                <td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" onClick={() => handleDelete(t.id)} className="text-gray-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></Button></td>
              </tr>
            ))}</tbody></table>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default TreaclePage;
