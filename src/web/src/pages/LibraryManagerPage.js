import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { libraryApi } from '../services/nexusApi';
import { toast } from 'sonner';
import {
  FolderOpen, Plus, Trash2, RefreshCw, Film, Tv,
  Music, BookOpen, Scan, Play, CheckCircle, Clock,
  AlertCircle, X, FolderSearch, Database, HardDrive,
  ChevronRight, Search, RotateCcw
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';
import { useConfirm } from '../hooks/use-confirm';

const MEDIA_TYPES = [
  { value: 'Movie', label: 'Movies', icon: Film, color: 'bg-blue-500/15 text-blue-400', accent: 'border-blue-500/30' },
  { value: 'TvShow', label: 'TV Shows', icon: Tv, color: 'bg-violet-500/15 text-violet-400', accent: 'border-violet-500/30' },
  { value: 'Music', label: 'Music', icon: Music, color: 'bg-emerald-500/15 text-emerald-400', accent: 'border-emerald-500/30' },
  { value: 'Anime', label: 'Anime', icon: Play, color: 'bg-pink-500/15 text-pink-400', accent: 'border-pink-500/30' },
  { value: 'Podcast', label: 'Podcasts', icon: BookOpen, color: 'bg-amber-500/15 text-amber-400', accent: 'border-amber-500/30' },
];

const formatSize = (bytes) => {
  if (!bytes) return '--';
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
  const icons = { idle: Clock, scanning: RefreshCw, completed: CheckCircle, failed: AlertCircle };
  const Icon = icons[status] || Clock;
  return (
    <span data-testid={`scan-status-${status}`} className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium", styles[status] || styles.idle)}>
      <Icon className={cn("w-3 h-3", status === 'scanning' && "animate-spin")} />
      {status === 'idle' ? 'Ready' : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const LibraryCard = ({ library, onScan, onDelete, scanning, scanResult }) => {
  const typeInfo = MEDIA_TYPES.find(t => t.value.toLowerCase() === library.media_type?.toLowerCase()) || MEDIA_TYPES[0];
  const Icon = typeInfo.icon;
  const isScanning = scanning === library.id;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      data-testid={`library-card-${library.id}`}
      className={cn("p-5 rounded-2xl bg-white/[0.02] border transition-all duration-300",
        isScanning ? "border-amber-500/30 shadow-lg shadow-amber-500/5" : "border-white/[0.05] hover:border-white/10")}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", typeInfo.color)}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{library.name}</h3>
            <p className="text-xs text-gray-500 font-mono truncate max-w-[200px]">{library.path}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => onScan(library.id)} data-testid={`scan-lib-${library.id}`}
            disabled={isScanning} className="h-8 w-8 p-0">
            {isScanning ? (
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
            ) : (
              <Scan className="w-4 h-4 text-gray-400 hover:text-white" />
            )}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDelete(library.id)} data-testid={`delete-lib-${library.id}`}
            className="h-8 w-8 p-0">
            <Trash2 className="w-4 h-4 text-red-400/60 hover:text-red-400" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="px-3 py-2 rounded-lg bg-white/[0.03] text-center">
          <p className="text-gray-500">Items</p>
          <p className="font-semibold mt-0.5 text-white">{library.item_count || 0}</p>
        </div>
        <div className="px-3 py-2 rounded-lg bg-white/[0.03] text-center">
          <p className="text-gray-500">Size</p>
          <p className="font-semibold mt-0.5 text-white">{formatSize(library.total_size)}</p>
        </div>
        <div className="px-3 py-2 rounded-lg bg-white/[0.03] text-center">
          <p className="text-gray-500">Status</p>
          <div className="mt-0.5"><ScanStatusBadge status={isScanning ? 'scanning' : (library.scan_status || 'idle')} /></div>
        </div>
        <div className="px-3 py-2 rounded-lg bg-white/[0.03] text-center">
          <p className="text-gray-500">Last Scan</p>
          <p className="font-semibold mt-0.5 text-white">
            {library.last_scanned_at ? new Date(library.last_scanned_at).toLocaleDateString() : 'Never'}
          </p>
        </div>
      </div>

      {/* Scan result banner */}
      <AnimatePresence>
        {scanResult && scanResult.library_id === library.id && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
            <div className="flex items-center gap-2 text-emerald-400 mb-1">
              <CheckCircle className="w-3.5 h-3.5" />
              <span className="font-semibold">Scan Complete</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-gray-400 mt-1.5">
              <span>New: <span className="text-white font-medium">{scanResult.new || 0}</span></span>
              <span>Updated: <span className="text-white font-medium">{scanResult.updated || 0}</span></span>
              <span>Total: <span className="text-white font-medium">{scanResult.total || 0}</span></span>
            </div>
            {scanResult.errors && scanResult.errors.length > 0 && (
              <p className="text-red-400 mt-1.5">
                <AlertCircle className="w-3 h-3 inline mr-1" />{scanResult.error_count} errors
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default function LibraryManagerPage() {
  const { confirm, ConfirmDialog } = useConfirm();
  const [libraries, setLibraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', path: '', media_type: 'Movie' });
  const [scanning, setScanning] = useState(null);
  const [scanResult, setScanResult] = useState(null);

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
      setForm({ name: '', path: '', media_type: 'Movie' });
      load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to add library'); }
  };

  const handleScan = async (id) => {
    setScanning(id);
    setScanResult(null);
    try {
      const res = await libraryApi.scan(id);
      const result = res.data;
      setScanResult({ ...result, library_id: id });
      if (result.error) {
        toast.error(`Scan error: ${result.error}`);
      } else {
        toast.success(`Scan complete: ${result.new || 0} new, ${result.total || 0} total items`);
      }
      load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Scan failed'); }
    finally { setScanning(null); }
  };

  const handleDelete = async (id) => {
    const ok = await confirm({ title: 'Delete Library', description: 'Delete this library and all its media entries?', confirmText: 'Delete' });
    if (!ok) return;
    try {
      await libraryApi.remove(id);
      toast.success('Library deleted');
      load();
    } catch { toast.error('Failed to delete library'); }
  };

  const totalItems = libraries.reduce((sum, l) => sum + (l.item_count || 0), 0);
  const totalSize = libraries.reduce((sum, l) => sum + (l.total_size || 0), 0);

  return (
    <Layout>
      <div data-testid="library-manager" className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Library Manager</h1>
                <p className="text-sm text-gray-500">Marmalade - {libraries.length} libraries, {totalItems} items, {formatSize(totalSize)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={load} data-testid="refresh-libraries" className="h-9 px-3">
                <RefreshCw className={cn("w-4 h-4 mr-1.5", loading && "animate-spin")} /> Refresh
              </Button>
              <Button size="sm" onClick={() => setShowAdd(!showAdd)} data-testid="add-library-btn"
                className="bg-orange-600 hover:bg-orange-700 text-white h-9 px-4">
                <Plus className="w-4 h-4 mr-1.5" /> Add Library
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Stats Row */}
        {libraries.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <Database className="w-5 h-5 text-blue-400" />
              <div><p className="text-xs text-gray-500">Total Libraries</p><p className="text-lg font-bold">{libraries.length}</p></div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <Film className="w-5 h-5 text-violet-400" />
              <div><p className="text-xs text-gray-500">Total Items</p><p className="text-lg font-bold">{totalItems}</p></div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <HardDrive className="w-5 h-5 text-emerald-400" />
              <div><p className="text-xs text-gray-500">Total Size</p><p className="text-lg font-bold">{formatSize(totalSize)}</p></div>
            </div>
          </div>
        )}

        {/* Add Library Form */}
        <AnimatePresence>
          {showAdd && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Add New Library</h3>
                <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)} className="h-7 w-7 p-0">
                  <X className="w-4 h-4" />
                </Button>
              </div>
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

        {/* Library Grid */}
        {libraries.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {libraries.map(lib => (
              <LibraryCard key={lib.id} library={lib} onScan={handleScan}
                onDelete={handleDelete} scanning={scanning} scanResult={scanResult} />
            ))}
          </div>
        ) : !loading ? (
          <div className="text-center py-16">
            <FolderSearch className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Libraries Configured</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
              Add your first media library to start scanning and organizing your content with TMDB metadata.
            </p>
            <Button onClick={() => setShowAdd(true)} data-testid="add-first-library-btn"
              className="bg-orange-600 hover:bg-orange-700 text-white">
              <Plus className="w-4 h-4 mr-2" /> Add First Library
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-8 h-8 text-gray-600 animate-spin" />
          </div>
        )}
      </div>
    <ConfirmDialog />
    </Layout>
  );
}
