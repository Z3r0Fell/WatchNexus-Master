import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { libraryApi } from '../services/nexusApi';
import { toast } from 'sonner';
import {
  FolderOpen, Plus, Trash2, RefreshCw, HardDrive, Film, Tv,
  Music, BookOpen, Scan, Play, Settings, CheckCircle, Clock,
  AlertCircle, X, FolderSearch
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';

const MEDIA_TYPES = [
  { value: 'Movies', label: 'Movies', icon: Film, color: 'bg-blue-500/15 text-blue-400' },
  { value: 'TvShows', label: 'TV Shows', icon: Tv, color: 'bg-violet-500/15 text-violet-400' },
  { value: 'Music', label: 'Music', icon: Music, color: 'bg-emerald-500/15 text-emerald-400' },
  { value: 'Audiobooks', label: 'Audiobooks', icon: BookOpen, color: 'bg-amber-500/15 text-amber-400' },
  { value: 'Anime', label: 'Anime', icon: Play, color: 'bg-pink-500/15 text-pink-400' },
];

const formatSize = (bytes) => {
  if (!bytes) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const ScanStatusBadge = ({ status }) => {
  const styles = {
    idle: 'bg-gray-500/15 text-gray-400',
    scanning: 'bg-amber-500/15 text-amber-400 animate-pulse',
    completed: 'bg-emerald-500/15 text-emerald-400',
    failed: 'bg-red-500/15 text-red-400',
  };
  const icons = {
    idle: Clock,
    scanning: RefreshCw,
    completed: CheckCircle,
    failed: AlertCircle,
  };
  const Icon = icons[status] || Clock;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs", styles[status] || styles.idle)}>
      <Icon className={cn("w-3 h-3", status === 'scanning' && "animate-spin")} />
      {status}
    </span>
  );
};

const LibraryCard = ({ library, onScan, onDelete, onToggle }) => {
  const typeInfo = MEDIA_TYPES.find(t => t.value.toLowerCase() === library.media_type) || MEDIA_TYPES[0];
  const Icon = typeInfo.icon;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", typeInfo.color)}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold">{library.name}</h3>
            <p className="text-xs text-gray-500 font-mono">{library.path}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => onScan(library.id)} data-testid={`scan-lib-${library.id}`}
            disabled={library.scan_status === 'scanning'}>
            <Scan className={cn("w-4 h-4", library.scan_status === 'scanning' && "animate-spin text-amber-400")} />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDelete(library.id)} data-testid={`delete-lib-${library.id}`}>
            <Trash2 className="w-4 h-4 text-red-400" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="px-3 py-2 rounded-lg bg-white/[0.03] text-center">
          <p className="text-gray-500">Items</p>
          <p className="font-semibold mt-0.5">{library.item_count || 0}</p>
        </div>
        <div className="px-3 py-2 rounded-lg bg-white/[0.03] text-center">
          <p className="text-gray-500">Size</p>
          <p className="font-semibold mt-0.5">{formatSize(library.total_size)}</p>
        </div>
        <div className="px-3 py-2 rounded-lg bg-white/[0.03] text-center">
          <p className="text-gray-500">Status</p>
          <div className="mt-0.5"><ScanStatusBadge status={library.scan_status} /></div>
        </div>
        <div className="px-3 py-2 rounded-lg bg-white/[0.03] text-center">
          <p className="text-gray-500">Last Scan</p>
          <p className="font-semibold mt-0.5">
            {library.last_scanned_at ? new Date(library.last_scanned_at).toLocaleDateString() : 'Never'}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default function LibraryManagerPage() {
  const [libraries, setLibraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', path: '', media_type: 'Movies' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await libraryApi.getAll();
      setLibraries(res.data || []);
    } catch { toast.error('Failed to load libraries'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!form.name || !form.path) return toast.error('Name and path required');
    try {
      await libraryApi.create(form);
      toast.success('Library added');
      setShowAdd(false);
      setForm({ name: '', path: '', media_type: 'Movies' });
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to add library'); }
  };

  const handleScan = async (id) => {
    try {
      await libraryApi.scan(id);
      toast.success('Scan started');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to start scan'); }
  };

  const handleDelete = async (id) => {
    try {
      await libraryApi.remove(id);
      toast.success('Library deleted');
      load();
    } catch { toast.error('Failed to delete library'); }
  };

  return (
    <Layout>
      <div data-testid="library-manager" className="p-8 max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Library Manager — Marmalade</h1>
                <p className="text-sm text-gray-500">{libraries.length} libraries configured</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={load} data-testid="refresh-libraries">
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              </Button>
              <Button size="sm" onClick={() => setShowAdd(!showAdd)} data-testid="add-library-btn"
                className="bg-orange-600 hover:bg-orange-700 text-white">
                <Plus className="w-4 h-4 mr-1" /> Add Library
              </Button>
            </div>
          </div>
        </motion.div>

        <AnimatePresence>
          {showAdd && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-4">
              <h3 className="text-sm font-semibold">Add New Library</h3>
              <div className="grid grid-cols-3 gap-3">
                <Input placeholder="Library Name" value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  data-testid="lib-name-input" className="bg-white/5 border-white/10 h-9 text-sm" />
                <Input placeholder="/path/to/media" value={form.path}
                  onChange={e => setForm(p => ({ ...p, path: e.target.value }))}
                  data-testid="lib-path-input" className="bg-white/5 border-white/10 h-9 text-sm" />
                <select value={form.media_type}
                  onChange={e => setForm(p => ({ ...p, media_type: e.target.value }))}
                  data-testid="lib-type-select"
                  className="bg-white/5 border border-white/10 rounded-lg h-9 text-sm px-3 text-gray-300">
                  {MEDIA_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button size="sm" onClick={handleAdd} data-testid="save-library-btn"
                  className="bg-orange-600 hover:bg-orange-700 text-white">Add Library</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {libraries.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {libraries.map(lib => (
              <LibraryCard key={lib.id} library={lib} onScan={handleScan}
                onDelete={handleDelete} onToggle={() => {}} />
            ))}
          </div>
        ) : !loading ? (
          <div className="text-center py-16">
            <FolderSearch className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Libraries Configured</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
              Add your first media library to start scanning and organizing your content.
            </p>
            <Button onClick={() => setShowAdd(true)} className="bg-orange-600 hover:bg-orange-700 text-white">
              <Plus className="w-4 h-4 mr-2" /> Add First Library
            </Button>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}
