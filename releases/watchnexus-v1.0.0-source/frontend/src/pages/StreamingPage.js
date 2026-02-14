import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { streamingApi, tmdbApi } from '../services/api';
import { toast } from 'sonner';
import { 
  ExternalLink, Search, Play, Settings
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Input } from '../components/ui/input';
import { getTitle } from '../lib/utils';

const streamingLogos = {
  netflix: { color: '#E50914', name: 'Netflix' },
  disney: { color: '#113CCF', name: 'Disney+' },
  prime: { color: '#00A8E1', name: 'Prime Video' },
  hulu: { color: '#1CE783', name: 'Hulu' },
  hbo: { color: '#B000FF', name: 'HBO Max' },
  apple: { color: '#000000', name: 'Apple TV+' },
  peacock: { color: '#000000', name: 'Peacock' },
  paramount: { color: '#0064FF', name: 'Paramount+' },
};

export const StreamingPage = () => {
  const [services, setServices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const response = await streamingApi.getAll();
      setServices(response.data || []);
    } catch (error) {
      console.error('Failed to fetch streaming services:', error);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const response = await tmdbApi.search(searchQuery);
      setSearchResults(response.data.results?.filter(r => r.media_type !== 'person') || []);
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const enabledServices = services.filter(s => s.enabled);

  const openInService = (service, title) => {
    const url = `${service.deep_link_base}${encodeURIComponent(title)}`;
    window.open(url, '_blank');
  };

  return (
    <Layout>
      <div data-testid="streaming-page" className="min-h-screen p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-600 via-blue-600 to-green-600 flex items-center justify-center">
                <Play className="w-6 h-6 text-white fill-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Streaming Services</h1>
                <p className="text-gray-400">Search across your connected platforms</p>
              </div>
            </div>
            <Link
              to="/settings"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Manage Services
            </Link>
          </div>
        </motion.div>

        {/* Connected Services */}
        <section className="mb-8">
          <h2 className="text-lg font-bold mb-4">Connected Services</h2>
          <div className="flex flex-wrap gap-3">
            {services.map((service) => {
              const info = streamingLogos[service.id] || { color: '#666', name: service.name };
              return (
                <div
                  key={service.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    service.enabled
                      ? 'bg-white/10 border border-white/20'
                      : 'bg-white/5 border border-white/5 opacity-50'
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: info.color }}
                  >
                    {info.name.charAt(0)}
                  </div>
                  <span className="font-medium">{info.name}</span>
                  {service.enabled && (
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                  )}
                </div>
              );
            })}
          </div>
          {enabledServices.length === 0 && (
            <p className="text-gray-500 mt-4">
              No streaming services enabled. <Link to="/settings" className="text-violet-400 hover:underline">Configure in Settings</Link>
            </p>
          )}
        </section>

        {/* Search */}
        <section className="mb-8">
          <h2 className="text-lg font-bold mb-4">Search Streaming Services</h2>
          <form onSubmit={handleSearch} className="flex gap-3 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search for a movie or show..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="streaming-search-input"
                className="pl-12 bg-white/5 border-white/10 h-12"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 h-12 rounded-xl bg-violet-600 hover:bg-violet-700 font-medium transition-colors"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>
        </section>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <section>
            <h2 className="text-lg font-bold mb-4">Results</h2>
            <div className="space-y-4">
              {searchResults.map((item) => {
                const title = getTitle(item);
                const posterUrl = item.poster_path 
                  ? `https://image.tmdb.org/t/p/w92${item.poster_path}`
                  : null;

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card rounded-xl p-4"
                  >
                    <div className="flex gap-4">
                      {/* Poster */}
                      <div className="w-16 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-surface">
                        {posterUrl ? (
                          <img src={posterUrl} alt={title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-600">
                            {title?.charAt(0)}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold">{title}</h3>
                          <span className="px-2 py-0.5 rounded text-xs bg-violet-600/20 text-violet-400 uppercase">
                            {item.media_type}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 line-clamp-2 mb-3">
                          {item.overview}
                        </p>

                        {/* Service Links */}
                        <div className="flex flex-wrap gap-2">
                          {enabledServices.map((service) => {
                            const info = streamingLogos[service.id] || { color: '#666', name: service.name };
                            return (
                              <button
                                key={service.id}
                                onClick={() => openInService(service, title)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:scale-105"
                                style={{ backgroundColor: info.color }}
                              >
                                {info.name}
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            );
                          })}
                          <Link
                            to={`/${item.media_type}/${item.id}`}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-white/10 hover:bg-white/20 transition-colors"
                          >
                            View Details
                          </Link>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* Initial State */}
        {searchResults.length === 0 && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="flex justify-center gap-4 mb-6">
              {Object.entries(streamingLogos).slice(0, 4).map(([id, info]) => (
                <div
                  key={id}
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl opacity-50"
                  style={{ backgroundColor: info.color }}
                >
                  {info.name.charAt(0)}
                </div>
              ))}
            </div>
            <h2 className="text-xl font-bold mb-2">Search Across Platforms</h2>
            <p className="text-gray-400 max-w-md mx-auto">
              Search for movies and TV shows, then open them directly in your connected streaming services.
            </p>
          </motion.div>
        )}
      </div>
    </Layout>
  );
};
