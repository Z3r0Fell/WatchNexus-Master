import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download, Server, Search, Plus, Trash2, Loader2, Settings,
  RefreshCw, Pause, Play, Film, Tv, FolderSync, Clock,
  CheckCircle2, XCircle, HardDrive, ArrowDownToLine, Wifi
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { Layout } from '../components/layout/Layout';
import axios from 'axios';
import { BACKEND_URL } from '../lib/config';
import { useConfirm } from '../hooks/use-confirm';

const API = BACKEND_URL;
const STATUS_BADGE = { queued: { bg: 'bg-gray-500/15', text: 'text-gray-400', label: 'Queued' }, downloading: { bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'Downloading' }, completed: { bg: 'bg-green-500/15', text: 'text-green-400', label: 'Done' }, failed: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'Failed' }, paused: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Paused' } };

const ChowderPage = () => {
  const { confirm, ConfirmDialog } = useConfirm();
  const [tab, setTab] = useState('servers');
  const [servers, setServers] = useState([]);
  const [queue, setQueue] = useState({ items: [], total: 0 });
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddServer, setShowAddServer] = useState(false);
  const [newServer, setNewServer] = useState({ name: '', url: '', api_key: '', type: 'jellyfin', workers: 2 });
  const [browsingServer, setBrowsingServer] = useState(null);
  const [libraries, setLibraries] = useState([]);
  const [browsingLibrary, setBrowsingLibrary] = useState(null);
  const [libraryItems, setLibraryItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchServers = useCallback(async () => { try { const r = await axios.get(`${API}/api/chowder/servers`); setServers(r.data.servers || []); } catch {} }, []);
  const fetchQueue = useCallback(async () => { try { const r = await axios.get(`${API}/api/chowder/queue`); setQueue(r.data); } catch {} }, []);
  const fetchStats = useCallback(async () => { try { const r = await axios.get(`${API}/api/chowder/stats`); setStats(r.data); } catch {} }, []);
  const fetchHistory = useCallback(async () => { try { const r = await axios.get(`${API}/api/chowder/history`); setHistory(r.data.history || []); } catch {} }, []);

  useEffect(() => { Promise.all([fetchServers(), fetchQueue(), fetchStats(), fetchHistory()]).finally(() => setLoading(false)); }, [fetchServers, fetchQueue, fetchStats, fetchHistory]);

  const handleAddServer = async () => {
    if (!newServer.name || !newServer.url || !newServer.api_key) { toast.error('All fields required'); return; }
    try { const r = await axios.post(`${API}/api/chowder/servers`, newServer); if (r.data.success) { toast.success(r.data.message); fetchServers(); fetchStats(); setShowAddServer(false); setNewServer({ name: '', url: '', api_key: '', type: 'jellyfin', workers: 2 }); } }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleDeleteServer = async (id) => { const ok = await confirm({ title: 'Remove Server', description: 'Remove server?', confirmText: 'Remove' }); if (!ok) return; try { await axios.delete(`${API}/api/chowder/servers/${id}`); fetchServers(); fetchStats(); } catch {} };

  const handleBrowseServer = async (srv) => {
    setBrowsingServer(srv);
    setBrowsingLibrary(null);
    setLibraryItems([]);
    try { const r = await axios.get(`${API}/api/chowder/servers/${srv.id}/libraries`); setLibraries(r.data.libraries || []); } catch { toast.error('Failed to load libraries'); }
  };

  const handleBrowseLibrary = async (lib) => {
    setBrowsingLibrary(lib);
    try { const params = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''; const r = await axios.get(`${API}/api/chowder/servers/${browsingServer.id}/browse/${lib.id}?limit=50${params}`); setLibraryItems(r.data.items || []); }
    catch { toast.error('Failed to browse'); }
  };

  const handleQueueItem = async (item) => {
    try { const r = await axios.post(`${API}/api/chowder/queue`, { server_id: item.server_id, item_id: item.id, title: item.name, file_size: item.file_size, resolution: item.resolution }); if (r.data.success) { toast.success(r.data.message); fetchQueue(); } }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleRemoveQueue = async (id) => { try { await axios.delete(`${API}/api/chowder/queue/${id}`); fetchQueue(); } catch {} };
  const handlePauseAll = async () => { try { await axios.post(`${API}/api/chowder/queue/pause`); toast.success('Paused'); fetchQueue(); } catch {} };
  const handleResumeAll = async () => { try { await axios.post(`${API}/api/chowder/queue/resume`); toast.success('Resumed'); fetchQueue(); } catch {} };

  if (loading) return <Layout><div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-teal-400" /></div><ConfirmDialog />
    </Layout>;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6" data-testid="chowder-page">
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-bold text-white flex items-center gap-3"><ArrowDownToLine className="w-8 h-8 text-teal-400" /> Media Sync</h1><p className="text-gray-400 text-sm mt-1">{stats ? `${stats.servers} servers, ${stats.total_downloaded_gb} GB synced` : 'Sync from remote Jellyfin/Emby servers'}</p></div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => { fetchServers(); fetchQueue(); fetchStats(); fetchHistory(); toast.success('Refreshed'); }}><RefreshCw className="w-4 h-4" /></Button>
          </div>
        </div>

        {/* Stats */}
        {stats && <div className="grid grid-cols-2 md:grid-cols-5 gap-3">{[{ l: 'Servers', v: stats.servers, c: 'text-teal-400' }, { l: 'Queue', v: stats.queue_size, c: 'text-blue-400' }, { l: 'History', v: stats.history_count, c: 'text-green-400' }, { l: 'Sync Maps', v: stats.sync_mappings, c: 'text-violet-400' }, { l: 'Downloaded', v: `${stats.total_downloaded_gb} GB`, c: 'text-white' }].map(s => <div key={s.l} className="bg-surface border border-white/10 rounded-xl p-3 text-center"><p className={`text-xl font-bold ${s.c}`}>{s.v}</p><p className="text-[11px] text-gray-500">{s.l}</p></div>)}</div>}

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-white/10">{[{ id: 'servers', label: 'Servers', icon: Server }, { id: 'browse', label: 'Browse', icon: Search }, { id: 'queue', label: 'Queue', icon: Download, badge: queue.downloading }, { id: 'history', label: 'History', icon: Clock }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${tab === t.id ? 'text-teal-400 border-b-2 border-teal-400' : 'text-gray-500 hover:text-gray-300'}`} data-testid={`chowder-tab-${t.id}`}>
            <t.icon className="w-4 h-4" /> {t.label}
            {t.badge > 0 && <span className="bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{t.badge}</span>}
          </button>
        ))}</div>

        {/* Servers Tab */}
        {tab === 'servers' && (<div className="space-y-3">
          <div className="flex justify-end"><Button size="sm" onClick={() => setShowAddServer(!showAddServer)} className="bg-teal-600 hover:bg-teal-700"><Plus className="w-4 h-4 mr-1" /> Add Server</Button></div>
          <AnimatePresence>{showAddServer && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-surface border border-white/10 rounded-2xl p-6 space-y-3">
              <h3 className="font-semibold text-white">Add Remote Server</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input type="text" value={newServer.name} onChange={(e) => setNewServer(p => ({ ...p, name: e.target.value }))} placeholder="Server name" className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600" data-testid="chowder-srv-name" />
                <select value={newServer.type} onChange={(e) => setNewServer(p => ({ ...p, type: e.target.value }))} className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm"><option value="jellyfin">Jellyfin</option><option value="emby">Emby</option></select>
                <input type="url" value={newServer.url} onChange={(e) => setNewServer(p => ({ ...p, url: e.target.value }))} placeholder="http://server:8096" className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600" data-testid="chowder-srv-url" />
                <input type="password" value={newServer.api_key} onChange={(e) => setNewServer(p => ({ ...p, api_key: e.target.value }))} placeholder="API Key" className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600" data-testid="chowder-srv-key" />
              </div>
              <div className="flex gap-2"><Button onClick={handleAddServer} className="bg-teal-600">Connect</Button><Button variant="ghost" onClick={() => setShowAddServer(false)}>Cancel</Button></div>
            </motion.div>
          )}</AnimatePresence>
          {servers.length === 0 ? <div className="text-center py-16 text-gray-500"><Server className="w-14 h-14 mx-auto mb-3 opacity-20" /><p>No servers connected</p></div> : servers.map(srv => (
            <div key={srv.id} className="bg-surface border border-white/10 rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center shrink-0"><Wifi className="w-5 h-5 text-teal-400" /></div>
              <div className="flex-1"><p className="text-white font-medium">{srv.name}</p><div className="flex items-center gap-2 mt-1"><span className="text-[11px] text-gray-500">{srv.type}</span><span className="text-[11px] text-gray-500">{srv.url}</span>{srv.workers && <span className="text-[11px] text-gray-500">{srv.workers} workers</span>}</div></div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => { handleBrowseServer(srv); setTab('browse'); }} className="text-teal-400"><Search className="w-4 h-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => handleDeleteServer(srv.id)} className="text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
        </div>)}

        {/* Browse Tab */}
        {tab === 'browse' && (<div className="space-y-3">
          {!browsingServer ? <div className="text-center py-16 text-gray-500"><Search className="w-14 h-14 mx-auto mb-3 opacity-20" /><p>Select a server from the Servers tab to browse</p></div> : (<>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <button onClick={() => { setBrowsingServer(null); setBrowsingLibrary(null); }} className="hover:text-white">Servers</button><span>/</span>
              <button onClick={() => setBrowsingLibrary(null)} className="hover:text-white">{browsingServer.name}</button>
              {browsingLibrary && <><span>/</span><span className="text-white">{browsingLibrary.name}</span></>}
            </div>
            {!browsingLibrary ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{libraries.map(lib => (
                <button key={lib.id} onClick={() => handleBrowseLibrary(lib)} className="bg-surface border border-white/10 rounded-xl p-4 text-left hover:border-teal-500/40 transition-all">
                  <p className="text-white font-medium">{lib.name}</p><p className="text-xs text-gray-500 mt-1">{lib.type} &middot; {lib.item_count} items</p>
                </button>
              ))}</div>
            ) : (<>
              <div className="flex gap-3"><div className="flex-1 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" /><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleBrowseLibrary(browsingLibrary)} placeholder="Search in library..." className="w-full pl-10 pr-4 py-2 bg-surface border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600" /></div></div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">{libraryItems.map(item => (
                <div key={item.id} className="group relative rounded-xl overflow-hidden bg-white/[0.03] border border-white/5 hover:border-teal-500/40 transition-all">
                  {item.poster_url ? <img src={item.poster_url} alt={item.name} className="w-full aspect-[2/3] object-cover" loading="lazy" /> : <div className="w-full aspect-[2/3] bg-white/5 flex items-center justify-center">{item.type === 'Series' ? <Tv className="w-8 h-8 text-gray-700" /> : <Film className="w-8 h-8 text-gray-700" />}</div>}
                  <div className="absolute top-2 left-2"><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.type === 'Series' ? 'bg-cyan-500/80' : 'bg-violet-500/80'} text-white`}>{item.type === 'Series' ? 'TV' : item.type}</span></div>
                  {item.resolution && <div className="absolute top-2 right-2"><span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/70 text-white">{item.resolution}</span></div>}
                  <div className="p-2"><p className="text-white text-sm font-medium truncate">{item.name}</p>{item.year > 0 && <p className="text-[11px] text-gray-500">{item.year}</p>}</div>
                  <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button size="sm" onClick={() => handleQueueItem(item)} className="bg-teal-600 hover:bg-teal-700"><Download className="w-4 h-4 mr-1" /> Download</Button>
                  </div>
                </div>
              ))}</div>
            </>)}
          </>)}
        </div>)}

        {/* Queue Tab */}
        {tab === 'queue' && (<div className="space-y-3">
          {queue.items.length > 0 && <div className="flex gap-2 justify-end"><Button size="sm" variant="ghost" onClick={handlePauseAll}><Pause className="w-4 h-4 mr-1" /> Pause All</Button><Button size="sm" variant="ghost" onClick={handleResumeAll}><Play className="w-4 h-4 mr-1" /> Resume All</Button></div>}
          {queue.items.length === 0 ? <div className="text-center py-16 text-gray-500"><Download className="w-14 h-14 mx-auto mb-3 opacity-20" /><p>Download queue is empty</p></div> : queue.items.map(item => { const sc = STATUS_BADGE[item.status] || STATUS_BADGE.queued; return (
            <div key={item.id} className="bg-surface border border-white/10 rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center shrink-0"><Download className="w-5 h-5 text-teal-400" /></div>
              <div className="flex-1 min-w-0"><p className="text-white font-medium truncate">{item.title}</p><div className="flex items-center gap-2 mt-1"><span className={`text-[11px] px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>{sc.label}</span><span className="text-[11px] text-gray-500">{item.server_name}</span>{item.resolution && <span className="text-[11px] text-gray-500">{item.resolution}</span>}{item.file_size > 0 && <span className="text-[11px] text-gray-500">{(item.file_size/1048576).toFixed(0)} MB</span>}</div>{item.progress > 0 && item.progress < 100 && <div className="mt-2 h-1 bg-white/5 rounded-full"><div className="h-full bg-teal-500 rounded-full" style={{ width: `${item.progress}%` }} /></div>}</div>
              <Button size="sm" variant="ghost" onClick={() => handleRemoveQueue(item.id)} className="text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></Button>
            </div>
          ); })}
        </div>)}

        {/* History Tab */}
        {tab === 'history' && (<div className="space-y-2">
          {history.length === 0 ? <div className="text-center py-16 text-gray-500"><Clock className="w-14 h-14 mx-auto mb-3 opacity-20" /><p>No download history</p></div> : history.map((h, i) => (
            <div key={i} className="bg-surface border border-white/10 rounded-xl p-3 flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              <div className="flex-1 min-w-0"><p className="text-white text-sm truncate">{h.title}</p><div className="flex gap-2 mt-0.5"><span className="text-[11px] text-gray-500">{h.server}</span>{h.resolution && <span className="text-[11px] text-gray-500">{h.resolution}</span>}{h.file_size > 0 && <span className="text-[11px] text-gray-500">{(h.file_size/1048576).toFixed(0)} MB</span>}</div></div>
              <span className="text-[11px] text-gray-500 shrink-0">{h.completed_at ? new Date(h.completed_at).toLocaleDateString() : ''}</span>
            </div>
          ))}
        </div>)}
      </div>
    <ConfirmDialog />
    </Layout>
  );
};

export default ChowderPage;
