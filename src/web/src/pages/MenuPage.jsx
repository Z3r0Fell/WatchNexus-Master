import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Film, Tv, TrendingUp, Clock, CheckCircle2, XCircle,
  Loader2, Settings, RefreshCw, Plus, ThumbsUp, ThumbsDown, Trash2,
  Star, Calendar, Send, Clapperboard, AlertTriangle, ChevronRight
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { Layout } from '../components/layout/Layout';
import axios from 'axios';
import { BACKEND_URL , tmdbImageUrl} from '../lib/config';

const API = BACKEND_URL;

const STATUS_BADGE = {
  pending: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Pending' },
  approved: { bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'Approved' },
  available: { bg: 'bg-green-500/15', text: 'text-green-400', label: 'Available' },
  declined: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'Declined' },
};

const MenuPage = () => {
  const [tab, setTab] = useState('discover');
  const [subTab, setSubTab] = useState('trending');
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [radarrUrl, setRadarrUrl] = useState('');
  const [radarrKey, setRadarrKey] = useState('');
  const [sonarrUrl, setSonarrUrl] = useState('');
  const [sonarrKey, setSonarrKey] = useState('');
  const [filter, setFilter] = useState('all');
  const [requesting, setRequesting] = useState({});

  const fetchDiscover = useCallback(async (type = 'trending') => {
    setLoading(true);
    try {
      const endpoint = type === 'trending' ? 'discover/trending' :
                       type === 'movies' ? 'discover/movies' :
                       type === 'tv' ? 'discover/tv' :
                       'discover/upcoming';
      const res = await axios.get(`${API}/api/menu/${endpoint}`);
      setItems(res.data.results || []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, []);

  const fetchRequests = useCallback(async () => {
    try {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const res = await axios.get(`${API}/api/menu/requests${params}`);
      setRequests(res.data.results || []);
    } catch {}
  }, [filter]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/menu/requests/stats`);
      setStats(res.data);
    } catch {}
  }, []);

  useEffect(() => { fetchDiscover(subTab); }, [subTab, fetchDiscover]);
  useEffect(() => { fetchRequests(); fetchStats(); }, [fetchRequests, fetchStats]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await axios.get(`${API}/api/menu/search?query=${encodeURIComponent(searchQuery)}`);
      setItems(res.data.results || []);
      setTab('discover');
      setSubTab('search');
    } catch { toast.error('Search failed'); }
    finally { setSearching(false); }
  };

  const handleRequest = async (item) => {
    const id = `${item.media_type || (item.title ? 'movie' : 'tv')}_${item.id}`;
    setRequesting(prev => ({ ...prev, [id]: true }));
    try {
      const res = await axios.post(`${API}/api/menu/requests`, {
        media_type: item.media_type || (item.title ? 'movie' : 'tv'),
        tmdb_id: item.id,
        title: item.title || item.name,
        poster_path: item.poster_path,
        overview: item.overview,
        year: (item.release_date || item.first_air_date || '').slice(0, 4),
        vote_average: item.vote_average,
      });
      if (res.data.success) {
        toast.success(res.data.message);
        fetchRequests();
        fetchStats();
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Request failed');
    } finally {
      setRequesting(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleApprove = async (id) => {
    try { await axios.post(`${API}/api/menu/requests/${id}/approve`); toast.success('Approved'); fetchRequests(); fetchStats(); }
    catch { toast.error('Failed'); }
  };
  const handleDecline = async (id) => {
    try { await axios.post(`${API}/api/menu/requests/${id}/decline`); toast.success('Declined'); fetchRequests(); fetchStats(); }
    catch { toast.error('Failed'); }
  };
  const handleFulfill = async (id) => {
    try {
      const res = await axios.post(`${API}/api/menu/requests/${id}/fulfill`);
      toast.success(res.data.message);
      fetchRequests(); fetchStats();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this request?')) return;
    try { await axios.delete(`${API}/api/menu/requests/${id}`); toast.success('Deleted'); fetchRequests(); fetchStats(); }
    catch { toast.error('Failed'); }
  };

  const handleSaveService = async (type) => {
    const url = type === 'radarr' ? radarrUrl : sonarrUrl;
    const key = type === 'radarr' ? radarrKey : sonarrKey;
    try {
      const res = await axios.post(`${API}/api/menu/${type}/config`, { url, api_key: key });
      if (res.data.success) toast.success(`${type} connected!`);
      else toast.error(res.data.message);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const MediaCard = ({ item }) => {
    const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
    const id = `${mediaType}_${item.id}`;
    const posterUrl = item.poster_path ? tmdbImageUrl(item.poster_path, 'w300') : null;
    const year = (item.release_date || item.first_air_date || '').slice(0, 4);

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="group relative rounded-xl overflow-hidden bg-white/[0.03] border border-white/5 hover:border-violet-500/40 transition-all duration-300"
      >
        {posterUrl ? (
          <img src={posterUrl} alt={item.title || item.name} className="w-full aspect-[2/3] object-cover" loading="lazy" />
        ) : (
          <div className="w-full aspect-[2/3] bg-white/5 flex items-center justify-center">
            {mediaType === 'tv' ? <Tv className="w-8 h-8 text-gray-700" /> : <Film className="w-8 h-8 text-gray-700" />}
          </div>
        )}
        {/* Media type badge */}
        <div className="absolute top-2 left-2">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${mediaType === 'tv' ? 'bg-cyan-500/80 text-white' : 'bg-violet-500/80 text-white'}`}>
            {mediaType === 'tv' ? 'TV' : 'MOVIE'}
          </span>
        </div>
        {/* Rating badge */}
        {item.vote_average > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-black/70 backdrop-blur px-1.5 py-0.5 rounded text-xs">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span className="text-white font-medium">{item.vote_average.toFixed(1)}</span>
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
          <p className="text-white text-sm font-semibold truncate">{item.title || item.name}</p>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
            {year && <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" /> {year}</span>}
          </div>
          {item.overview && (
            <p className="text-gray-400 text-[11px] mt-1 line-clamp-2">{item.overview}</p>
          )}
          <Button
            size="sm"
            className="mt-2 bg-violet-600 hover:bg-violet-700 text-xs h-7 w-full"
            onClick={() => handleRequest(item)}
            disabled={requesting[id]}
            data-testid={`request-${id}`}
          >
            {requesting[id] ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
            Request
          </Button>
        </div>
      </motion.div>
    );
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6" data-testid="menu-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Clapperboard className="w-8 h-8 text-violet-400" />
              Discover & Request
            </h1>
            <p className="text-gray-400 text-sm mt-1">Browse, search, and request media for your library</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)} data-testid="menu-settings-btn">
            <Settings className="w-4 h-4 mr-1" /> Services
          </Button>
        </div>

        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="bg-surface border border-white/10 rounded-2xl p-6 space-y-4" data-testid="menu-settings-panel"
            >
              <h3 className="font-semibold text-white">Service Connections</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Radarr */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-orange-400 flex items-center gap-2"><Film className="w-4 h-4" /> Radarr (Movies)</h4>
                  <input type="url" value={radarrUrl} onChange={(e) => setRadarrUrl(e.target.value)} placeholder="http://localhost:7878"
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                    data-testid="menu-radarr-url" />
                  <input type="password" value={radarrKey} onChange={(e) => setRadarrKey(e.target.value)} placeholder="API Key"
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                    data-testid="menu-radarr-key" />
                  <Button size="sm" onClick={() => handleSaveService('radarr')} className="bg-orange-600 hover:bg-orange-700" data-testid="menu-radarr-save">
                    Test & Save
                  </Button>
                </div>
                {/* Sonarr */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-cyan-400 flex items-center gap-2"><Tv className="w-4 h-4" /> Sonarr (TV Shows)</h4>
                  <input type="url" value={sonarrUrl} onChange={(e) => setSonarrUrl(e.target.value)} placeholder="http://localhost:8989"
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                    data-testid="menu-sonarr-url" />
                  <input type="password" value={sonarrKey} onChange={(e) => setSonarrKey(e.target.value)} placeholder="API Key"
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                    data-testid="menu-sonarr-key" />
                  <Button size="sm" onClick={() => handleSaveService('sonarr')} className="bg-cyan-600 hover:bg-cyan-700" data-testid="menu-sonarr-save">
                    Test & Save
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats */}
        {stats && stats.total > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Total', value: stats.total, color: 'text-white' },
              { label: 'Pending', value: stats.pending, color: 'text-amber-400' },
              { label: 'Approved', value: stats.approved, color: 'text-blue-400' },
              { label: 'Available', value: stats.available, color: 'text-green-400' },
              { label: 'Declined', value: stats.declined, color: 'text-red-400' },
            ].map((s) => (
              <div key={s.label} className="bg-surface border border-white/10 rounded-xl p-3 text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[11px] text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search movies, TV shows, people..."
              className="w-full pl-10 pr-4 py-2.5 bg-surface border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              data-testid="menu-search-input" />
          </div>
          <Button onClick={handleSearch} disabled={searching} className="bg-violet-600 hover:bg-violet-700" data-testid="menu-search-btn">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>

        {/* Main Tabs */}
        <div className="flex items-center gap-1 border-b border-white/10">
          {[
            { id: 'discover', label: 'Discover', icon: TrendingUp },
            { id: 'requests', label: 'Requests', icon: Clock },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} data-testid={`menu-tab-${t.id}`}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t.id ? 'text-violet-400 border-b-2 border-violet-400' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
              {t.id === 'requests' && stats?.pending > 0 && (
                <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{stats.pending}</span>
              )}
            </button>
          ))}
        </div>

        {/* Discover Tab */}
        {tab === 'discover' && (
          <>
            <div className="flex items-center gap-2">
              {[
                { id: 'trending', label: 'Trending' },
                { id: 'movies', label: 'Movies' },
                { id: 'tv', label: 'TV Shows' },
                { id: 'upcoming', label: 'Upcoming' },
                ...(subTab === 'search' ? [{ id: 'search', label: 'Search Results' }] : []),
              ].map((st) => (
                <button key={st.id} onClick={() => { setSubTab(st.id); if (st.id !== 'search') fetchDiscover(st.id); }}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    subTab === st.id ? 'bg-violet-600 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'
                  }`}
                  data-testid={`menu-sub-${st.id}`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-violet-400" /></div>
            ) : items.length === 0 ? (
              <div className="text-center py-20 text-gray-500">
                <Film className="w-14 h-14 mx-auto mb-3 opacity-20" />
                <p>No results found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {items.filter(i => i.media_type !== 'person').map((item) => (
                  <MediaCard key={`${item.media_type || 'x'}-${item.id}`} item={item} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Requests Tab */}
        {tab === 'requests' && (
          <>
            <div className="flex items-center gap-1">
              {['all', 'pending', 'approved', 'available', 'declined'].map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    filter === f ? 'bg-violet-600 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {requests.length === 0 ? (
                <div className="text-center py-20 text-gray-500">
                  <Clock className="w-14 h-14 mx-auto mb-3 opacity-20" />
                  <p>No requests</p>
                </div>
              ) : (
                requests.map((req) => {
                  const sc = STATUS_BADGE[req.status] || STATUS_BADGE.pending;
                  const posterUrl = req.poster_path ? tmdbImageUrl(req.poster_path, 'w92') : null;
                  return (
                    <motion.div key={req.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="bg-surface border border-white/10 rounded-xl p-4 flex items-center gap-4"
                      data-testid={`menu-request-${req.id}`}
                    >
                      {posterUrl ? (
                        <img src={posterUrl} alt="" className="w-12 h-[72px] rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-12 h-[72px] rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                          {req.media_type === 'tv' ? <Tv className="w-5 h-5 text-gray-600" /> : <Film className="w-5 h-5 text-gray-600" />}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{req.title}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full ${sc.bg} ${sc.text} font-medium`}>{sc.label}</span>
                          <span className="text-[11px] text-gray-500">{req.media_type === 'tv' ? 'TV' : 'Movie'}</span>
                          {req.year && <span className="text-[11px] text-gray-500">{req.year}</span>}
                          {req.vote_average > 0 && (
                            <span className="text-[11px] text-gray-500 flex items-center gap-0.5">
                              <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" /> {req.vote_average.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {req.status === 'pending' && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => handleApprove(req.id)}
                              className="text-green-400 hover:bg-green-500/10" data-testid={`menu-approve-${req.id}`}>
                              <ThumbsUp className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDecline(req.id)}
                              className="text-red-400 hover:bg-red-500/10" data-testid={`menu-decline-${req.id}`}>
                              <ThumbsDown className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        {(req.status === 'approved' || req.status === 'pending') && (
                          <Button variant="ghost" size="sm" onClick={() => handleFulfill(req.id)}
                            className="text-violet-400 hover:bg-violet-500/10" title="Send to Sonarr/Radarr"
                            data-testid={`menu-fulfill-${req.id}`}>
                            <Send className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(req.id)}
                          className="text-gray-500 hover:text-red-400" data-testid={`menu-delete-${req.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default MenuPage;
