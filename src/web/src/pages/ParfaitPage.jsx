import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Film, Tv, TrendingUp, Clock, CheckCircle2, XCircle,
  Loader2, Settings, ExternalLink, RefreshCw, ChevronDown,
  AlertTriangle, Plus, ThumbsUp, ThumbsDown, Trash2, Eye
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { Layout } from '../components/layout/Layout';
import axios from 'axios';
import { BACKEND_URL } from '../lib/config';

const API = BACKEND_URL;

const STATUS_COLORS = {
  pending: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', label: 'Pending' },
  approved: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', label: 'Approved' },
  available: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30', label: 'Available' },
  declined: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30', label: 'Declined' },
  processing: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30', label: 'Processing' },
};

const MEDIA_STATUS = {
  1: 'Unknown', 2: 'Pending', 3: 'Processing', 4: 'Partially Available', 5: 'Available',
};

const ParfaitPage = () => {
  const [connected, setConnected] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('requests');
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState(null);
  const [discover, setDiscover] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [configUrl, setConfigUrl] = useState('');
  const [configKey, setConfigKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState('');
  const [filter, setFilter] = useState('all');

  const fetchStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/parfait/status`);
      setConnected(res.data.connected);
      setConfigured(res.data.configured);
      setVersion(res.data.version || '');
      if (!res.data.configured) setShowConfig(true);
    } catch { setConnected(false); }
  }, []);

  const fetchRequests = useCallback(async () => {
    try {
      const filterParam = filter !== 'all' ? `&filter=${filter}` : '';
      const res = await axios.get(`${API}/api/parfait/requests?take=30${filterParam}`);
      setRequests(res.data.results || []);
    } catch { console.error('[ParfaitPage] Failed to fetch requests'); toast.error('[ParfaitPage] Failed to fetch requests');; }
  }, [filter]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/parfait/stats`);
      setStats(res.data);
    } catch { console.error('[ParfaitPage] Failed to fetch stats'); toast.error('[ParfaitPage] Failed to fetch stats');; }
  }, []);

  const fetchDiscover = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/parfait/discover/trending`);
      setDiscover(res.data.results || []);
    } catch { console.error('[ParfaitPage] Failed to fetch discover'); toast.error('[ParfaitPage] Failed to fetch discover');; }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchStatus();
      setLoading(false);
    })();
  }, [fetchStatus]);

  useEffect(() => {
    if (connected) {
      fetchRequests();
      fetchStats();
      fetchDiscover();
    }
  }, [connected, fetchRequests, fetchStats, fetchDiscover]);

  const handleSaveConfig = async () => {
    if (!configUrl || !configKey) { toast.error('URL and API key are required'); return; }
    setSaving(true);
    try {
      const res = await axios.post(`${API}/api/parfait/config`, { url: configUrl, api_key: configKey });
      if (res.data.success) {
        toast.success(res.data.message);
        setShowConfig(false);
        await fetchStatus();
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save config');
    } finally { setSaving(false); }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await axios.get(`${API}/api/parfait/search?query=${encodeURIComponent(searchQuery)}`);
      setSearchResults(res.data.results || []);
      setTab('search');
    } catch { toast.error('Search failed'); }
    finally { setSearching(false); }
  };

  const handleApprove = async (id) => {
    try {
      await axios.post(`${API}/api/parfait/requests/${id}/approve`);
      toast.success('Request approved');
      fetchRequests();
      fetchStats();
    } catch { toast.error('Failed to approve'); }
  };

  const handleDecline = async (id) => {
    try {
      await axios.post(`${API}/api/parfait/requests/${id}/decline`);
      toast.success('Request declined');
      fetchRequests();
      fetchStats();
    } catch { toast.error('Failed to decline'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this request?')) return;
    try {
      await axios.delete(`${API}/api/parfait/requests/${id}`);
      toast.success('Request deleted');
      fetchRequests();
      fetchStats();
    } catch { toast.error('Failed to delete'); }
  };

  const handleRequest = async (mediaType, mediaId) => {
    try {
      await axios.post(`${API}/api/parfait/requests`, { mediaType, mediaId, seasons: mediaType === 'tv' ? 'all' : undefined });
      toast.success('Request submitted!');
      fetchRequests();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Request failed');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6" data-testid="parfait-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Jellyseerr</h1>
            <p className="text-gray-400 text-sm mt-1">
              {connected ? (
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                  Connected {version && `(v${version})`}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                  Not connected
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowConfig(!showConfig); }}
              data-testid="parfait-config-btn"
            >
              <Settings className="w-4 h-4 mr-1" /> Configure
            </Button>
            {connected && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { fetchRequests(); fetchStats(); fetchDiscover(); toast.success('Refreshed'); }}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Config Panel */}
        <AnimatePresence>
          {showConfig && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-surface border border-white/10 rounded-2xl p-6 space-y-4"
              data-testid="parfait-config-panel"
            >
              <h3 className="font-semibold text-white">Jellyseerr Connection</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Jellyseerr URL</label>
                  <input
                    type="url"
                    value={configUrl}
                    onChange={(e) => setConfigUrl(e.target.value)}
                    placeholder="http://localhost:5055"
                    className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    data-testid="parfait-url-input"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">API Key</label>
                  <input
                    type="password"
                    value={configKey}
                    onChange={(e) => setConfigKey(e.target.value)}
                    placeholder="Your Jellyseerr API key"
                    className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    data-testid="parfait-key-input"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">Find your API key in Jellyseerr &gt; Settings &gt; General.</p>
              <div className="flex gap-2">
                <Button onClick={handleSaveConfig} disabled={saving} className="bg-violet-600 hover:bg-violet-700" data-testid="parfait-save-btn">
                  {saving ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Testing...</> : 'Save & Connect'}
                </Button>
                <Button variant="ghost" onClick={() => setShowConfig(false)}>Cancel</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Bar */}
        {connected && stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Total', value: stats.total || 0, color: 'text-white' },
              { label: 'Pending', value: stats.pending || 0, color: 'text-amber-400' },
              { label: 'Approved', value: stats.approved || 0, color: 'text-blue-400' },
              { label: 'Available', value: stats.available || 0, color: 'text-green-400' },
              { label: 'Declined', value: stats.declined || 0, color: 'text-red-400' },
            ].map((s) => (
              <div key={s.label} className="bg-surface border border-white/10 rounded-xl p-4 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Search + Tabs */}
        {connected && (
          <>
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search movies & TV shows..."
                  className="w-full pl-10 pr-4 py-2.5 bg-surface border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  data-testid="parfait-search-input"
                />
              </div>
              <Button onClick={handleSearch} disabled={searching} className="bg-violet-600 hover:bg-violet-700" data-testid="parfait-search-btn">
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>

            <div className="flex items-center gap-1 border-b border-white/10 pb-1">
              {[
                { id: 'requests', label: 'Requests', icon: Clock },
                { id: 'discover', label: 'Discover', icon: TrendingUp },
                ...(searchResults.length > 0 ? [{ id: 'search', label: 'Search Results', icon: Search }] : []),
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  data-testid={`parfait-tab-${t.id}`}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                    tab === t.id ? 'text-violet-400 border-b-2 border-violet-400' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <t.icon className="w-4 h-4" /> {t.label}
                </button>
              ))}

              {tab === 'requests' && (
                <div className="ml-auto flex items-center gap-1">
                  {['all', 'pending', 'approved', 'available', 'declined'].map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-3 py-1 text-xs rounded-full transition-colors ${
                        filter === f ? 'bg-violet-600 text-white' : 'text-gray-500 hover:bg-white/5'
                      }`}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Requests Tab */}
            {tab === 'requests' && (
              <div className="space-y-2">
                {requests.length === 0 ? (
                  <div className="text-center py-16 text-gray-500">
                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No requests found</p>
                  </div>
                ) : (
                  requests.map((req) => {
                    const status = req.status === 1 ? 'pending' : req.status === 2 ? 'approved' : req.status === 3 ? 'declined' : 'available';
                    const sc = STATUS_COLORS[status] || STATUS_COLORS.pending;
                    const media = req.media || {};
                    const posterPath = media.posterPath ? `https://image.tmdb.org/t/p/w92${media.posterPath}` : null;
                    return (
                      <div key={req.id} className="bg-surface border border-white/10 rounded-xl p-4 flex items-center gap-4" data-testid={`request-${req.id}`}>
                        {posterPath ? (
                          <img src={posterPath} alt="" className="w-12 h-18 rounded-lg object-cover" />
                        ) : (
                          <div className="w-12 h-18 rounded-lg bg-white/5 flex items-center justify-center">
                            {media.mediaType === 'tv' ? <Tv className="w-5 h-5 text-gray-600" /> : <Film className="w-5 h-5 text-gray-600" />}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{media.title || media.name || `Request #${req.id}`}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${sc.bg} ${sc.text} ${sc.border} border`}>
                              {sc.label}
                            </span>
                            <span className="text-xs text-gray-500">
                              {media.mediaType === 'tv' ? 'TV Show' : 'Movie'}
                            </span>
                            {req.requestedBy?.displayName && (
                              <span className="text-xs text-gray-500">by {req.requestedBy.displayName}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {status === 'pending' && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => handleApprove(req.id)} className="text-green-400 hover:bg-green-500/10" data-testid={`approve-${req.id}`}>
                                <ThumbsUp className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDecline(req.id)} className="text-red-400 hover:bg-red-500/10" data-testid={`decline-${req.id}`}>
                                <ThumbsDown className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(req.id)} className="text-gray-500 hover:text-red-400" data-testid={`delete-${req.id}`}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Discover Tab */}
            {tab === 'discover' && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {discover.length === 0 ? (
                  <div className="col-span-full text-center py-16 text-gray-500">
                    <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No trending content</p>
                  </div>
                ) : (
                  discover.map((item) => {
                    const posterUrl = item.posterPath ? `https://image.tmdb.org/t/p/w300${item.posterPath}` : null;
                    const mediaType = item.mediaType || (item.title ? 'movie' : 'tv');
                    return (
                      <div key={`${mediaType}-${item.id}`} className="group relative rounded-xl overflow-hidden bg-white/5 border border-white/5 hover:border-violet-500/30 transition-all">
                        {posterUrl ? (
                          <img src={posterUrl} alt={item.title || item.name} className="w-full aspect-[2/3] object-cover" />
                        ) : (
                          <div className="w-full aspect-[2/3] bg-white/5 flex items-center justify-center">
                            <Film className="w-8 h-8 text-gray-700" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                          <p className="text-white text-sm font-medium truncate">{item.title || item.name}</p>
                          <p className="text-gray-400 text-xs">{mediaType === 'tv' ? 'TV' : 'Movie'} &middot; {(item.releaseDate || item.firstAirDate || '').slice(0, 4)}</p>
                          <Button
                            size="sm"
                            className="mt-2 bg-violet-600 hover:bg-violet-700 text-xs h-7"
                            onClick={() => handleRequest(mediaType, item.id)}
                          >
                            <Plus className="w-3 h-3 mr-1" /> Request
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Search Results Tab */}
            {tab === 'search' && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {searchResults.length === 0 ? (
                  <div className="col-span-full text-center py-16 text-gray-500">
                    <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No results found</p>
                  </div>
                ) : (
                  searchResults.map((item) => {
                    const posterUrl = item.posterPath ? `https://image.tmdb.org/t/p/w300${item.posterPath}` : null;
                    const mediaType = item.mediaType || (item.title ? 'movie' : 'tv');
                    return (
                      <div key={`${mediaType}-${item.id}`} className="group relative rounded-xl overflow-hidden bg-white/5 border border-white/5 hover:border-violet-500/30 transition-all">
                        {posterUrl ? (
                          <img src={posterUrl} alt={item.title || item.name} className="w-full aspect-[2/3] object-cover" />
                        ) : (
                          <div className="w-full aspect-[2/3] bg-white/5 flex items-center justify-center">
                            <Film className="w-8 h-8 text-gray-700" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                          <p className="text-white text-sm font-medium truncate">{item.title || item.name}</p>
                          <p className="text-gray-400 text-xs">{mediaType === 'tv' ? 'TV' : 'Movie'} &middot; {(item.releaseDate || item.firstAirDate || '').slice(0, 4)}</p>
                          <Button
                            size="sm"
                            className="mt-2 bg-violet-600 hover:bg-violet-700 text-xs h-7"
                            onClick={() => handleRequest(mediaType, item.id)}
                          >
                            <Plus className="w-3 h-3 mr-1" /> Request
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}

        {/* Not Connected State */}
        {!connected && !showConfig && (
          <div className="text-center py-20 space-y-4">
            <AlertTriangle className="w-16 h-16 mx-auto text-amber-400/50" />
            <h2 className="text-xl font-semibold text-white">Jellyseerr Not Connected</h2>
            <p className="text-gray-400 max-w-md mx-auto">
              Configure your Jellyseerr instance URL and API key to enable media request management.
            </p>
            <Button onClick={() => setShowConfig(true)} className="bg-violet-600 hover:bg-violet-700" data-testid="parfait-setup-btn">
              <Settings className="w-4 h-4 mr-2" /> Setup Connection
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ParfaitPage;
