import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Search, Plus, Trash2, Loader2, FolderOpen, Star, BookOpenCheck, Headphones, Image } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { Layout } from '../components/layout/Layout';
import axios from 'axios';
import { BACKEND_URL } from '../lib/config';

const API = BACKEND_URL;
const TYPE_ICONS = { ebook: BookOpen, comic: Image, audiobook: Headphones };
const TYPE_COLORS = { ebook: 'bg-blue-500/80', comic: 'bg-amber-500/80', audiobook: 'bg-violet-500/80' };

const BiscottiPage = () => {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [scanPath, setScanPath] = useState('');
  const [scanResults, setScanResults] = useState([]);
  const [newItem, setNewItem] = useState({ title: '', type: 'ebook', author: '', file_path: '' });

  const fetchItems = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (searchQuery) params.set('search', searchQuery);
      const res = await axios.get(`${API}/api/biscotti/items?${params}`);
      setItems(res.data.items || []);
    } catch { console.error('[BiscottiPage] Failed to fetch items'); } finally { setLoading(false); toast.error('[BiscottiPage] Failed to fetch items');; }
  }, [typeFilter, searchQuery]);

  const fetchStats = useCallback(async () => {
    try { const res = await axios.get(`${API}/api/biscotti/stats`); setStats(res.data); } catch { console.error('[BiscottiPage] Failed to fetch stats'); toast.error('[BiscottiPage] Failed to fetch stats');; }
  }, []);

  useEffect(() => { fetchItems(); fetchStats(); }, [fetchItems, fetchStats]);

  const handleAdd = async () => {
    if (!newItem.title) { toast.error('Title required'); return; }
    try {
      const res = await axios.post(`${API}/api/biscotti/items`, newItem);
      if (res.data.success) { toast.success(res.data.message); fetchItems(); fetchStats(); setShowAdd(false); setNewItem({ title: '', type: 'ebook', author: '', file_path: '' }); }
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove?')) return;
    try { await axios.delete(`${API}/api/biscotti/items/${id}`); toast.success('Removed'); fetchItems(); fetchStats(); } catch { toast.error('Failed'); }
  };

  const handleScan = async () => {
    if (!scanPath) return;
    try { const res = await axios.post(`${API}/api/biscotti/scan`, { path: scanPath }); setScanResults(res.data.files || []); toast.success(`Found ${res.data.total} files`); }
    catch (err) { toast.error(err.response?.data?.message || 'Scan failed'); }
  };

  const handleImportScan = async () => {
    for (const f of scanResults) {
      await axios.post(`${API}/api/biscotti/items`, { title: f.title, type: f.type, file_path: f.file_path, file_size: f.file_size }).catch(() => {});
    }
    toast.success(`Imported ${scanResults.length} items`); fetchItems(); fetchStats(); setShowScan(false); setScanResults([]);
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6" data-testid="biscotti-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3"><BookOpen className="w-8 h-8 text-blue-400" /> Library</h1>
            <p className="text-gray-400 text-sm mt-1">{stats ? `${stats.ebooks} ebooks, ${stats.comics} comics, ${stats.audiobooks} audiobooks` : 'Ebooks, comics & audiobooks'}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowScan(!showScan)}><FolderOpen className="w-4 h-4 mr-1" /> Scan</Button>
            <Button size="sm" onClick={() => setShowAdd(!showAdd)} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-1" /> Add</Button>
          </div>
        </div>

        <AnimatePresence>
          {showScan && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-surface border border-white/10 rounded-2xl p-6 space-y-3">
              <h3 className="font-semibold text-white">Scan Directory</h3>
              <div className="flex gap-3">
                <input type="text" value={scanPath} onChange={(e) => setScanPath(e.target.value)} placeholder="/path/to/books" className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
                <Button onClick={handleScan} className="bg-blue-600">Scan</Button>
              </div>
              {scanResults.length > 0 && (<div className="flex items-center justify-between"><p className="text-sm text-gray-400">{scanResults.length} files</p><Button size="sm" onClick={handleImportScan} className="bg-green-600">Import All</Button></div>)}
            </motion.div>
          )}
          {showAdd && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-surface border border-white/10 rounded-2xl p-6 space-y-3">
              <h3 className="font-semibold text-white">Add Item</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input type="text" value={newItem.title} onChange={(e) => setNewItem(p => ({ ...p, title: e.target.value }))} placeholder="Title" className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none" />
                <input type="text" value={newItem.author} onChange={(e) => setNewItem(p => ({ ...p, author: e.target.value }))} placeholder="Author" className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none" />
                <select value={newItem.type} onChange={(e) => setNewItem(p => ({ ...p, type: e.target.value }))} className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm"><option value="ebook">Ebook</option><option value="comic">Comic</option><option value="audiobook">Audiobook</option></select>
              </div>
              <input type="text" value={newItem.file_path} onChange={(e) => setNewItem(p => ({ ...p, file_path: e.target.value }))} placeholder="File path" className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none" />
              <div className="flex gap-2"><Button onClick={handleAdd} className="bg-blue-600">Add</Button><Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button></div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className="w-full pl-10 pr-4 py-2.5 bg-surface border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
          </div>
          <div className="flex gap-1">{['all', 'ebook', 'comic', 'audiobook'].map(t => (<button key={t} onClick={() => setTypeFilter(t)} className={`px-3 py-1.5 text-xs rounded-lg ${typeFilter === t ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-white/5'}`}>{t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}s</button>))}</div>
        </div>

        {loading ? <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-400" /></div> : items.length === 0 ? (
          <div className="text-center py-20 text-gray-500"><BookOpen className="w-16 h-16 mx-auto mb-4 opacity-20" /><p>No items yet</p></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {items.map(item => { const Icon = TYPE_ICONS[item.type] || BookOpen; return (
              <div key={item.id} className="group relative rounded-xl overflow-hidden bg-white/[0.03] border border-white/5 hover:border-blue-500/40 transition-all">
                <div className="w-full aspect-[2/3] bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center"><Icon className="w-10 h-10 text-gray-700" /></div>
                <div className="absolute top-2 left-2"><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${TYPE_COLORS[item.type] || 'bg-gray-500/80'} text-white uppercase`}>{item.type}</span></div>
                {item.progress > 0 && <div className="absolute bottom-[72px] left-0 right-0 h-1 bg-black/50"><div className="h-full bg-blue-500" style={{ width: `${item.progress}%` }} /></div>}
                <div className="p-2.5"><p className="text-white text-sm font-medium truncate">{item.title}</p>{item.author && <p className="text-gray-500 text-[11px] truncate">{item.author}</p>}</div>
                <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Button size="sm" variant="ghost" onClick={() => handleDelete(item.id)} className="text-red-400"><Trash2 className="w-4 h-4" /></Button></div>
              </div>
            ); })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default BiscottiPage;
