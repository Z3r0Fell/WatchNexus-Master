import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Music, Search, Download, X, Clock, RefreshCw, Trash2, List, History, Settings, Play, ExternalLink, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

export const SpotdlPage = () => {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('track');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [downloads, setDownloads] = useState([]);
  const [activeTab, setActiveTab] = useState('search');
  const [keys, setKeys] = useState([]);
  const [newKey, setNewKey] = useState('');
  const [keyService, setKeyService] = useState('spotify');

  const loadDownloads = useCallback(async () => {
    try {
      const resp = await axios.get(`${BACKEND_URL}/api/gadgets/spotdl/downloads`);
      setDownloads(resp.data.downloads || []);
    } catch (err) {
      // Silent fail for polling
    }
  }, []);

  const loadKeys = useCallback(async () => {
    try {
      const resp = await axios.get(`${BACKEND_URL}/api/gadgets/spotdl/keys`);
      setKeys(resp.data.keys || []);
    } catch (err) {
      toast.error('Failed to load API keys');
    }
  }, []);

  // Poll downloads every 3s when active tab is downloads or history
  useEffect(() => {
    if (activeTab === 'downloads' || activeTab === 'history') {
      loadDownloads();
      const interval = setInterval(loadDownloads, 3000);
      return () => clearInterval(interval);
    }
  }, [activeTab, loadDownloads]);

  useEffect(() => {
    if (activeTab === 'settings') loadKeys();
  }, [activeTab, loadKeys]);

  const handleSearch = async () => {
    if (!query.trim()) return toast.error('Enter a search query');
    try {
      setSearchLoading(true);
      setSearchResults([]);
      const resp = await axios.get(`${BACKEND_URL}/api/gadgets/spotdl/search`, {
        params: { q: query, type: searchType }
      });
      setSearchResults(resp.data.results || []);
      if (resp.data.error) {
        toast.warning('Search may be incomplete: ' + resp.data.error);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Search failed');
    } finally {
      setSearchLoading(false);
    }
  };

  const queueDownload = async (url, title, artist) => {
    try {
      const resp = await axios.post(`${BACKEND_URL}/api/gadgets/spotdl/download`, {
        url, format: 'mp3'
      });
      toast.success(`Queued: ${title}`);
      // Refresh downloads
      loadDownloads();
      setActiveTab('downloads');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to queue download');
    }
  };

  const retryDownload = async (id) => {
    try {
      await axios.post(`${BACKEND_URL}/api/gadgets/spotdl/retry/${id}`);
      toast.success('Retry queued');
      loadDownloads();
    } catch (err) {
      toast.error('Failed to retry');
    }
  };

  const deleteDownload = async (id) => {
    try {
      await axios.delete(`${BACKEND_URL}/api/gadgets/spotdl/downloads/${id}`);
      toast.success('Download removed');
      setDownloads(d => d.filter(item => item.id !== id));
    } catch (err) {
      toast.error('Failed to remove');
    }
  };

  const addKey = async () => {
    if (!newKey.trim()) return toast.error('Enter a key value');
    try {
      await axios.post(`${BACKEND_URL}/api/gadgets/spotdl/keys`, {
        key: newKey, service: keyService
      });
      toast.success('Key added');
      setNewKey('');
      loadKeys();
    } catch (err) {
      toast.error('Failed to add key');
    }
  };

  const deleteKey = async (id) => {
    try {
      await axios.delete(`${BACKEND_URL}/api/gadgets/spotdl/keys/${id}`);
      toast.success('Key removed');
      setKeys(k => k.filter(item => item.id !== id));
    } catch (err) {
      toast.error('Failed to remove key');
    }
  };

  const formatDuration = (s) => {
    if (!s) return '';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed': return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'downloading': return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      default: return <Clock className="w-4 h-4 text-yellow-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-400';
      case 'failed': return 'text-red-400';
      case 'downloading': return 'text-blue-400';
      default: return 'text-yellow-400';
    }
  };

  return (
    <Layout>
      <div data-testid="spotdl-page" className="min-h-screen p-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <Music className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Spotify Downloader</h1>
                <p className="text-gray-400">Download music from Spotify & YouTube Music</p>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex gap-3 mt-6">
            <div className="flex gap-2">
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-300 outline-none focus:border-green-500/50"
              >
                <option value="track">Track</option>
                <option value="album">Album</option>
                <option value="playlist">Playlist</option>
                <option value="artist">Artist</option>
              </select>
            </div>
            <Input placeholder="Search for songs, albums, artists..." value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="bg-white/5 border-white/10 flex-1" data-testid="spotdl-search" />
            <Button onClick={handleSearch} disabled={searchLoading} className="bg-green-600 hover:bg-green-700">
              {searchLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            <Button variant={activeTab === 'search' ? 'default' : 'ghost'} size="sm"
              onClick={() => setActiveTab('search')} className={activeTab === 'search' ? 'bg-green-600' : ''}>
              <Search className="w-4 h-4 mr-1" /> Search
            </Button>
            <Button variant={activeTab === 'downloads' ? 'default' : 'ghost'} size="sm"
              onClick={() => { setActiveTab('downloads'); loadDownloads(); }} className={activeTab === 'downloads' ? 'bg-green-600' : ''}>
              <Download className="w-4 h-4 mr-1" /> Downloads
            </Button>
            <Button variant={activeTab === 'history' ? 'default' : 'ghost'} size="sm"
              onClick={() => { setActiveTab('history'); loadDownloads(); }} className={activeTab === 'history' ? 'bg-green-600' : ''}>
              <History className="w-4 h-4 mr-1" /> History
            </Button>
            <Button variant={activeTab === 'settings' ? 'default' : 'ghost'} size="sm"
              onClick={() => { setActiveTab('settings'); loadKeys(); }} className={activeTab === 'settings' ? 'bg-green-600' : ''}>
              <Settings className="w-4 h-4 mr-1" /> Settings
            </Button>
          </div>
        </motion.div>

        {/* ─── Search Tab ─── */}
        {activeTab === 'search' && (
          <div>
            {searchResults.length === 0 && !searchLoading && (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-24 h-24 rounded-full bg-green-600/20 flex items-center justify-center mb-6">
                  <Music className="w-12 h-12 text-green-400" />
                </div>
                <h2 className="text-xl font-bold mb-2">Download Music</h2>
                <p className="text-gray-400 text-center max-w-md mb-4">
                  Search for songs, albums, or playlists and download them as MP3.
                </p>
                <p className="text-xs text-gray-500">Powered by spotdl</p>
              </div>
            )}

            {searchLoading && (
              <div className="flex justify-center py-20">
                <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchResults.map((item, idx) => (
                  <motion.div key={item.id || idx} initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                    className="glass-card rounded-xl overflow-hidden group">
                    <div className="flex p-4 gap-4">
                      {/* Thumbnail */}
                      <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800">
                        {item.thumbnail ? (
                          <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Music className="w-8 h-8 text-gray-600" />
                          </div>
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm line-clamp-2">{item.title}</h3>
                        <p className="text-xs text-gray-400 mt-1">{item.artist}</p>
                        <div className="flex items-center gap-2 mt-2">
                          {item.duration > 0 && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {formatDuration(item.duration)}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Download button */}
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <Button size="sm" onClick={() => queueDownload(item.url, item.title, item.artist)}
                          className="bg-green-600 hover:bg-green-700">
                          <Download className="w-4 h-4" />
                        </Button>
                        {item.url && (
                          <Button variant="ghost" size="sm" onClick={() => window.open(item.url, '_blank')}
                            className="text-gray-400">
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Downloads Tab ─── */}
        {activeTab === 'downloads' && (
          <div className="space-y-4">
            {downloads.filter(d => d.status !== 'completed' && d.status !== 'failed').length === 0 ? (
              <div className="text-center py-20">
                <Download className="w-16 h-16 mx-auto text-gray-600 mb-4" />
                <h2 className="text-xl font-bold mb-2">No Active Downloads</h2>
                <p className="text-gray-400">Queued downloads will appear here.</p>
              </div>
            ) : (
              downloads.filter(d => d.status !== 'completed' && d.status !== 'failed').map((item) => (
                <motion.div key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="glass-card rounded-xl p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium line-clamp-1">{item.title || item.url}</h3>
                      {item.artist && <p className="text-sm text-gray-400">{item.artist}</p>}
                      <p className="text-xs text-gray-500 mt-1 truncate">{item.url}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-medium ${getStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                      {getStatusIcon(item.status)}
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{item.progress.toFixed(0)}%</span>
                      {item.status === 'downloading' && <span>Downloading...</span>}
                    </div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${item.progress}%` }} />
                    </div>
                  </div>
                  {item.errorMessage && (
                    <p className="text-xs text-red-400 mt-2">{item.errorMessage}</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    {item.status === 'failed' && (
                      <Button variant="outline" size="sm" onClick={() => retryDownload(item.id)}>
                        <RefreshCw className="w-3 h-3 mr-1" /> Retry
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => deleteDownload(item.id)}
                      className="text-red-400 hover:text-red-300">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* ─── History Tab ─── */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {downloads.filter(d => d.status === 'completed' || d.status === 'failed').length === 0 ? (
              <div className="text-center py-20">
                <History className="w-16 h-16 mx-auto text-gray-600 mb-4" />
                <h2 className="text-xl font-bold mb-2">No History</h2>
                <p className="text-gray-400">Completed and failed downloads appear here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {downloads.filter(d => d.status === 'completed' || d.status === 'failed').map((item) => (
                  <motion.div key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="glass-card rounded-xl p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium line-clamp-1">{item.title || item.url}</h3>
                        {item.artist && <p className="text-sm text-gray-400">{item.artist}</p>}
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span>{new Date(item.createdAt).toLocaleString()}</span>
                          {item.completedAt && (
                            <span>Completed: {new Date(item.completedAt).toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-medium ${getStatusColor(item.status)}`}>
                          {item.status}
                        </span>
                        {getStatusIcon(item.status)}
                        {item.status === 'failed' && (
                          <Button variant="ghost" size="sm" onClick={() => retryDownload(item.id)}
                            className="text-gray-400">
                            <RefreshCw className="w-3 h-3" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => deleteDownload(item.id)}
                          className="text-red-400 hover:text-red-300">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    {item.errorMessage && (
                      <p className="text-xs text-red-400 mt-2">{item.errorMessage}</p>
                    )}
                    {item.outputPath && (
                      <p className="text-xs text-green-400 mt-1 truncate">{item.outputPath}</p>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Settings Tab ─── */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl space-y-8">
            {/* Add Key */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-xl p-6">
              <h2 className="text-lg font-bold mb-1">Add Spotify API Key</h2>
              <p className="text-sm text-gray-400 mb-4">
                Add Spotify API client IDs for key rotation. Format: <code className="text-green-400">client_id:client_secret</code>
              </p>
              <div className="flex gap-3">
                <Input placeholder="client_id:client_secret" value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addKey()}
                  className="bg-white/5 border-white/10 flex-1" />
                <Button onClick={addKey} className="bg-green-600 hover:bg-green-700">
                  Add Key
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Environment variables <code className="text-green-400">SPOTIFY_CLIENT_ID</code> and <code className="text-green-400">SPOTIFY_CLIENT_SECRET</code> are always preferred.
              </p>
            </motion.div>

            {/* Keys List */}
            <div className="glass-card rounded-xl p-6">
              <h2 className="text-lg font-bold mb-1">API Keys</h2>
              <p className="text-sm text-gray-400 mb-4">
                Keys are used in round-robin. Keys with {'>'}5 failures are auto-deactivated.
              </p>
              {keys.length === 0 ? (
                <p className="text-sm text-gray-500">No API keys configured. Use environment variables or add keys above.</p>
              ) : (
                <div className="space-y-2">
                  {keys.map((key) => (
                    <div key={key.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${key.isActive ? 'bg-green-400' : 'bg-red-400'}`} />
                        <div>
                          <code className="text-sm text-gray-300">{key.preview}</code>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            <span>Service: {key.service}</span>
                            {key.isEnvKey && <span className="text-blue-400">(env var)</span>}
                            <span>Failures: {key.failureCount}/{key.maxFailures}</span>
                            {key.lastUsedAt && <span>Last used: {new Date(key.lastUsedAt).toLocaleString()}</span>}
                          </div>
                        </div>
                      </div>
                      {!key.isEnvKey && (
                        <Button variant="ghost" size="sm" onClick={() => deleteKey(key.id)}
                          className="text-red-400 hover:text-red-300">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SpotdlPage;
