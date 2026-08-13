import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gamepad2, Search, Plus, Trash2, Star, Play, FolderOpen,
  Loader2, Settings, RefreshCw, Heart, Clock, BarChart3,
  Monitor, ChevronDown, Upload, Scan
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { Layout } from '../components/layout/Layout';
import axios from 'axios';
import { BACKEND_URL } from '../lib/config';
import { useConfirm } from '../hooks/use-confirm';

const API = BACKEND_URL;

const EMULATORJS_CDN = 'https://cdn.emulatorjs.org/stable/data';

const PretzelPage = () => {
  const { confirm, ConfirmDialog } = useConfirm();
  const [games, setGames] = useState([]);
  const [systems, setSystems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSystem, setSelectedSystem] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddGame, setShowAddGame] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [scanPath, setScanPath] = useState('');
  const [scanResults, setScanResults] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [playingGame, setPlayingGame] = useState(null);
  const [newGame, setNewGame] = useState({ title: '', system: 'nes', file_path: '', file_name: '' });

  const fetchGames = useCallback(async () => {
    try {
      const params = selectedSystem !== 'all' ? `?system=${selectedSystem}` : '';
      const res = await axios.get(`${API}/api/pretzel/games${params}`);
      setGames(res.data.games || []);
    } catch {} finally { setLoading(false); }
  }, [selectedSystem]);

  const fetchSystems = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/pretzel/systems`);
      setSystems(res.data || []);
    } catch {}
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/pretzel/stats`);
      setStats(res.data);
    } catch {}
  }, []);

  useEffect(() => { fetchSystems(); fetchStats(); }, [fetchSystems, fetchStats]);
  useEffect(() => { fetchGames(); }, [fetchGames]);

  const handleAddGame = async () => {
    if (!newGame.title || !newGame.system) { toast.error('Title and system required'); return; }
    try {
      const res = await axios.post(`${API}/api/pretzel/games`, newGame);
      if (res.data.success) { toast.success(res.data.message); fetchGames(); fetchStats(); setShowAddGame(false); setNewGame({ title: '', system: 'nes', file_path: '', file_name: '' }); }
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleDelete = async (id) => {
    const ok = await confirm({ title: 'Remove Game', description: 'Remove this game?', confirmText: 'Remove' });
    if (!ok) return;
    try { await axios.delete(`${API}/api/pretzel/games/${id}`); toast.success('Removed'); fetchGames(); fetchStats(); }
    catch { toast.error('Failed'); }
  };

  const handleFavorite = async (id) => {
    try { const res = await axios.post(`${API}/api/pretzel/games/${id}/favorite`); fetchGames(); }
    catch { toast.error('Failed'); }
  };

  const handlePlay = async (game) => {
    await axios.post(`${API}/api/pretzel/games/${game.id}/play`).catch(() => {});
    setPlayingGame(game);
    fetchGames();
  };

  const handleScan = async () => {
    if (!scanPath) { toast.error('Enter a directory path'); return; }
    setScanning(true);
    try {
      const res = await axios.post(`${API}/api/pretzel/scan`, { path: scanPath });
      setScanResults(res.data.files || []);
      if (res.data.total === 0) toast.info('No ROM files found');
      else toast.success(`Found ${res.data.total} ROM files`);
    } catch (err) { toast.error(err.response?.data?.message || 'Scan failed'); }
    finally { setScanning(false); }
  };

  const handleImportScanned = async () => {
    const files = scanResults.filter(f => f.detected_system).map(f => ({
      title: f.title, system: f.detected_system, file_path: f.file_path, file_name: f.file_name, file_size: f.file_size,
    }));
    if (files.length === 0) { toast.error('No importable files'); return; }
    try {
      const res = await axios.post(`${API}/api/pretzel/scan/import`, { files });
      toast.success(res.data.message); fetchGames(); fetchStats(); setShowScan(false); setScanResults([]);
    } catch { toast.error('Import failed'); }
  };

  const filteredGames = games.filter(g =>
    !searchQuery || g.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Emulator Overlay ──────────────────────────────────────────────
  if (playingGame) {
    return (
      <Layout>
        <div className="fixed inset-0 z-50 bg-black flex flex-col" data-testid="pretzel-emulator">
          <div className="flex items-center justify-between px-4 py-2 bg-black/90 border-b border-white/10">
            <div className="flex items-center gap-3">
              <Gamepad2 className="w-5 h-5 text-violet-400" />
              <span className="text-white font-medium">{playingGame.title}</span>
              <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded">{playingGame.system_name}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setPlayingGame(null)} className="text-gray-400 hover:text-white">
              Exit Game
            </Button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center space-y-4 max-w-lg">
              <div className="w-full aspect-[4/3] bg-gray-900 rounded-2xl border border-white/10 flex items-center justify-center">
                <div className="text-center space-y-3">
                  <Gamepad2 className="w-16 h-16 mx-auto text-violet-400/50" />
                  <p className="text-white font-medium">{playingGame.title}</p>
                  <p className="text-sm text-gray-400">
                    EmulatorJS core: <span className="font-mono text-violet-400">{playingGame.core}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    ROM: {playingGame.file_name || 'Not specified'}
                  </p>
                  <p className="text-xs text-gray-600 mt-4 max-w-sm mx-auto">
                    Emulation requires ROM files to be accessible at a URL.
                    Configure your ROM directory in Settings and point file paths to served URLs.
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-600">
                Powered by <a href="https://emulatorjs.org" target="_blank" rel="noreferrer" className="text-violet-400 hover:underline">EmulatorJS</a> &middot; Press ESC or click Exit to return
              </p>
            </div>
          </div>
        </div>
      <ConfirmDialog />
    </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6" data-testid="pretzel-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Gamepad2 className="w-8 h-8 text-violet-400" />
              Gaming Console
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              {stats ? `${stats.total_games} games across ${Object.keys(stats.systems || {}).length} systems` : 'Browser-based retro gaming'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowScan(!showScan)} data-testid="pretzel-scan-btn">
              <Scan className="w-4 h-4 mr-1" /> Scan
            </Button>
            <Button size="sm" onClick={() => setShowAddGame(!showAddGame)} className="bg-violet-600 hover:bg-violet-700" data-testid="pretzel-add-btn">
              <Plus className="w-4 h-4 mr-1" /> Add Game
            </Button>
          </div>
        </div>

        {/* Stats */}
        {stats && stats.total_games > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-surface border border-white/10 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-white">{stats.total_games}</p>
              <p className="text-[11px] text-gray-500">Games</p>
            </div>
            <div className="bg-surface border border-white/10 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-violet-400">{Object.keys(stats.systems || {}).length}</p>
              <p className="text-[11px] text-gray-500">Systems</p>
            </div>
            <div className="bg-surface border border-white/10 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-amber-400">{stats.total_plays}</p>
              <p className="text-[11px] text-gray-500">Play Sessions</p>
            </div>
            <div className="bg-surface border border-white/10 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-cyan-400">{stats.save_states}</p>
              <p className="text-[11px] text-gray-500">Save States</p>
            </div>
          </div>
        )}

        {/* Scan Panel */}
        <AnimatePresence>
          {showScan && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="bg-surface border border-white/10 rounded-2xl p-6 space-y-4" data-testid="pretzel-scan-panel">
              <h3 className="font-semibold text-white">Scan for ROMs</h3>
              <div className="flex gap-3">
                <input type="text" value={scanPath} onChange={(e) => setScanPath(e.target.value)} placeholder="/path/to/roms"
                  className="flex-1 px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                  data-testid="pretzel-scan-path" />
                <Button onClick={handleScan} disabled={scanning} className="bg-violet-600 hover:bg-violet-700" data-testid="pretzel-scan-go">
                  {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Scan'}
                </Button>
              </div>
              {scanResults.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-400">{scanResults.length} files found</p>
                    <Button size="sm" onClick={handleImportScanned} className="bg-green-600 hover:bg-green-700">Import All</Button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {scanResults.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-gray-400 bg-black/20 rounded px-2 py-1">
                        <span className="text-violet-400 font-mono w-20 shrink-0">{f.detected_system || '?'}</span>
                        <span className="truncate">{f.title}</span>
                        <span className="text-gray-600 ml-auto shrink-0">{(f.file_size / 1024).toFixed(0)}KB</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add Game Panel */}
        <AnimatePresence>
          {showAddGame && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="bg-surface border border-white/10 rounded-2xl p-6 space-y-4" data-testid="pretzel-add-panel">
              <h3 className="font-semibold text-white">Add Game</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input type="text" value={newGame.title} onChange={(e) => setNewGame(prev => ({ ...prev, title: e.target.value }))} placeholder="Game title"
                  className="px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                  data-testid="pretzel-add-title" />
                <select value={newGame.system} onChange={(e) => setNewGame(prev => ({ ...prev, system: e.target.value }))}
                  className="px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                  data-testid="pretzel-add-system">
                  {systems.map((s) => <option key={s.id} value={s.id}>{s.value?.name || s.id}</option>)}
                </select>
                <input type="text" value={newGame.file_path} onChange={(e) => setNewGame(prev => ({ ...prev, file_path: e.target.value, file_name: e.target.value.split('/').pop() }))} placeholder="ROM file path"
                  className="md:col-span-2 px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                  data-testid="pretzel-add-path" />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddGame} className="bg-violet-600 hover:bg-violet-700" data-testid="pretzel-add-save">Add to Library</Button>
                <Button variant="ghost" onClick={() => setShowAddGame(false)}>Cancel</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search + System Filter */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search games..."
              className="w-full pl-10 pr-4 py-2.5 bg-surface border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              data-testid="pretzel-search" />
          </div>
          <select value={selectedSystem} onChange={(e) => setSelectedSystem(e.target.value)}
            className="px-3 py-2.5 bg-surface border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50"
            data-testid="pretzel-system-filter">
            <option value="all">All Systems</option>
            {systems.map((s) => <option key={s.id} value={s.id}>{s.value?.name || s.id}</option>)}
          </select>
        </div>

        {/* Game Grid */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-violet-400" /></div>
        ) : filteredGames.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <Gamepad2 className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">No games in library</p>
            <p className="text-sm mt-1">Add games manually or scan a ROM directory to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredGames.map((game) => (
              <motion.div key={game.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="group relative rounded-xl overflow-hidden bg-white/[0.03] border border-white/5 hover:border-violet-500/40 transition-all"
                data-testid={`pretzel-game-${game.id}`}
              >
                {/* Cover / Placeholder */}
                {game.cover_url ? (
                  <img src={game.cover_url} alt={game.title} className="w-full aspect-square object-cover" loading="lazy" />
                ) : (
                  <div className="w-full aspect-square bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                    <Gamepad2 className="w-10 h-10 text-gray-700" />
                  </div>
                )}

                {/* System Badge */}
                <div className="absolute top-2 left-2">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-500/80 text-white uppercase">
                    {game.system}
                  </span>
                </div>

                {/* Favorite */}
                {game.favorite && (
                  <Heart className="absolute top-2 right-2 w-4 h-4 text-red-400 fill-red-400" />
                )}

                {/* Info Bar */}
                <div className="p-2.5">
                  <p className="text-white text-sm font-medium truncate">{game.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
                    {game.play_count > 0 && <span className="flex items-center gap-0.5"><Play className="w-2.5 h-2.5" /> {game.play_count}</span>}
                    {game.last_played && <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {new Date(game.last_played).toLocaleDateString()}</span>}
                  </div>
                </div>

                {/* Hover Actions */}
                <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button size="sm" onClick={() => handlePlay(game)} className="bg-violet-600 hover:bg-violet-700 h-9">
                    <Play className="w-4 h-4 mr-1" /> Play
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleFavorite(game.id)} className="text-gray-300 hover:text-red-400 h-9">
                    <Heart className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(game.id)} className="text-gray-300 hover:text-red-400 h-9">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    <ConfirmDialog />
    </Layout>
  );
};

export default PretzelPage;
