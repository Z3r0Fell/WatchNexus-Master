import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Film, Search, Plus, Trash2, RefreshCw, CheckCircle, Clock,
  Calendar, ArrowUpDown, Star, Download, Eye, Settings, List
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';
import { BACKEND_URL } from '../lib/config';

const API = BACKEND_URL;
const headers = { 'Content-Type': 'application/json' };

const TabButton = ({ active, onClick, icon: Icon, label, count }) => (
  <button
    onClick={onClick}
    data-testid={`fondue-tab-${label.toLowerCase().replace(/\s/g, '-')}`}
    className={cn(
      "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
      active
        ? "bg-orange-500/15 text-orange-400 border border-orange-500/20"
        : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
    )}
  >
    <Icon className="w-4 h-4" />
    {label}
    {count !== undefined && (
      <span className="px-1.5 py-0.5 rounded-md text-xs bg-white/5">{count}</span>
    )}
  </button>
);

export const FonduePage = () => {
  const [movies, setMovies] = useState([]);
  const [queue, setQueue] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('library');
  const [searchQuery, setSearchQuery] = useState('');
  const [totalMovies, setTotalMovies] = useState(0);

  const fetchData = async () => {
    try {
      const [moviesRes, queueRes, configRes] = await Promise.all([
        axios.get(`${API}/api/fondue/movies?pageSize=100`, { headers }),
        axios.get(`${API}/api/fondue/queue`, { headers }),
        axios.get(`${API}/api/fondue/config`, { headers }),
      ]);
      setMovies(moviesRes.data?.movies || []);
      setTotalMovies(moviesRes.data?.total || 0);
      setQueue(queueRes.data?.items || []);
      setConfig(configRes.data);
    } catch (e) {
      console.error('Fondue fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const searchMovie = async (movieId) => {
    try {
      await axios.post(`${API}/api/fondue/movies/${movieId}/search`, {}, {
        
      });
      toast.success('Search initiated for movie');
    } catch (e) {
      toast.error('Search failed');
    }
  };

  const removeMovie = async (movieId) => {
    try {
      await axios.delete(`${API}/api/fondue/movies/${movieId}`, {
        
      });
      setMovies(prev => prev.filter(m => m.id !== movieId));
      toast.success('Movie removed');
    } catch (e) {
      toast.error('Failed to remove');
    }
  };

  const filteredMovies = searchQuery
    ? movies.filter(m => m.title?.toLowerCase().includes(searchQuery.toLowerCase()))
    : movies;

  if (loading) return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </Layout>
  );

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto p-6 space-y-6"
        data-testid="fondue-page"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Movie Automation</h1>
            <p className="text-sm text-gray-400 mt-1">Monitor, search, and auto-grab movies</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchData} variant="outline" className="border-white/10" data-testid="fondue-refresh-btn">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Movies', value: totalMovies, icon: Film, color: 'bg-orange-500/20 text-orange-400' },
            { label: 'Monitored', value: movies.filter(m => m.monitored).length, icon: Eye, color: 'bg-blue-500/20 text-blue-400' },
            { label: 'In Queue', value: queue.length, icon: Download, color: 'bg-green-500/20 text-green-400' },
            { label: 'Quality', value: config?.quality_profile || 'HD-1080p', icon: Star, color: 'bg-purple-500/20 text-purple-400' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]"
            >
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", stat.color)}>
                <stat.icon className="w-4 h-4" />
              </div>
              <p className="text-xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="flex gap-2">
          <TabButton active={tab === 'library'} onClick={() => setTab('library')} icon={Film} label="Library" count={totalMovies} />
          <TabButton active={tab === 'queue'} onClick={() => setTab('queue')} icon={Download} label="Queue" count={queue.length} />
          <TabButton active={tab === 'config'} onClick={() => setTab('config')} icon={Settings} label="Settings" />
        </div>

        {tab === 'library' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter movies..."
                  className="pl-10 bg-white/5 border-white/10"
                  data-testid="fondue-search"
                />
              </div>
            </div>

            {filteredMovies.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <Film className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">No movies in library</p>
                <p className="text-sm mt-1">Add movies from the Discover page to start monitoring</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredMovies.map((movie, i) => (
                  <motion.div
                    key={movie.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="group relative rounded-xl overflow-hidden bg-white/[0.03] border border-white/[0.06] hover:border-orange-500/30 transition-all"
                    data-testid={`fondue-movie-${movie.id}`}
                  >
                    {movie.poster_url ? (
                      <img src={movie.poster_url} alt={movie.title} className="w-full aspect-[2/3] object-cover" />
                    ) : (
                      <div className="w-full aspect-[2/3] bg-white/5 flex items-center justify-center">
                        <Film className="w-8 h-8 text-gray-600" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-sm font-semibold text-white truncate">{movie.title}</p>
                        <p className="text-xs text-gray-400">{movie.year || 'N/A'}</p>
                        <div className="flex gap-1.5 mt-2">
                          <Button size="sm" onClick={() => searchMovie(movie.id)} className="h-7 text-xs bg-orange-600/80 hover:bg-orange-600">
                            <Search className="w-3 h-3 mr-1" /> Search
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => removeMovie(movie.id)} className="h-7 text-xs text-red-400 hover:text-red-300">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    {movie.monitored && (
                      <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-orange-500 ring-2 ring-black" />
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {tab === 'queue' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              {queue.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Download className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Download queue is empty</p>
                  <p className="text-sm mt-1">Monitored movies will appear here when found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {queue.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02]">
                      <Download className="w-4 h-4 text-orange-400" />
                      <span className="text-sm text-gray-300">{item.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {tab === 'config' && config && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-5">
              <h3 className="text-lg font-semibold text-white">Fondue Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Quality Profile</label>
                  <Input value={config.quality_profile || ''} readOnly className="bg-white/5 border-white/10" />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Root Folder</label>
                  <Input value={config.root_folder || ''} readOnly className="bg-white/5 border-white/10" />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Minimum Availability</label>
                  <Input value={config.minimum_availability || ''} readOnly className="bg-white/5 border-white/10" />
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-400 pt-2">
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-green-400" /> Auto-search: {config.auto_search ? 'On' : 'Off'}
                </span>
                <span className="flex items-center gap-1.5">
                  <ArrowUpDown className="w-4 h-4 text-blue-400" /> Auto-upgrade: {config.auto_upgrade ? 'On' : 'Off'}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </Layout>
  );
};

export default FonduePage;
