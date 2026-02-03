import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { MediaCard } from '../components/media/MediaCard';
import { tmdbApi, watchlistApi } from '../services/api';
import { toast } from 'sonner';
import { Search, X, Film, Tv, Users } from 'lucide-react';
import { getTitle, getMediaType } from '../lib/utils';
import { Input } from '../components/ui/input';

export const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchWatchlist();
  }, []);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setQuery(q);
      handleSearch(q);
    }
  }, [searchParams]);

  const fetchWatchlist = async () => {
    try {
      const response = await watchlistApi.get();
      setWatchlist(response.data || []);
    } catch (error) {
      console.error('Failed to fetch watchlist:', error);
    }
  };

  const handleSearch = async (searchQuery) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await tmdbApi.search(searchQuery);
      setResults(response.data.results || []);
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchParams({ q: query });
      handleSearch(query);
    }
  };

  const handleAddToWatchlist = async (item) => {
    try {
      const isInWatchlist = watchlist.some(w => w.tmdb_id === item.id);
      
      if (isInWatchlist) {
        await watchlistApi.remove(item.id);
        setWatchlist(prev => prev.filter(w => w.tmdb_id !== item.id));
        toast.success('Removed from watchlist');
      } else {
        await watchlistApi.add({
          tmdb_id: item.id,
          media_type: getMediaType(item),
          title: getTitle(item),
          poster_path: item.poster_path,
        });
        setWatchlist(prev => [...prev, { tmdb_id: item.id }]);
        toast.success('Added to watchlist');
      }
    } catch (error) {
      toast.error('Failed to update watchlist');
    }
  };

  const filteredResults = results.filter(item => {
    if (filter === 'all') return true;
    return item.media_type === filter;
  });

  const movies = results.filter(r => r.media_type === 'movie');
  const tvShows = results.filter(r => r.media_type === 'tv');
  const people = results.filter(r => r.media_type === 'person');

  return (
    <Layout>
      <div data-testid="search-page" className="min-h-screen p-8">
        {/* Search Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto mb-8"
        >
          <form onSubmit={handleSubmit} className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search movies, TV shows, people..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              data-testid="search-input"
              className="w-full pl-12 pr-12 py-4 text-lg bg-white/5 border-white/10 rounded-full focus:border-violet-500 focus:ring-violet-500"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setResults([]);
                  setSearchParams({});
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            )}
          </form>
        </motion.div>

        {/* Filter Tabs */}
        {results.length > 0 && (
          <div className="flex justify-center gap-2 mb-8">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                filter === 'all'
                  ? 'bg-violet-600 text-white'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              All ({results.length})
            </button>
            <button
              onClick={() => setFilter('movie')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                filter === 'movie'
                  ? 'bg-violet-600 text-white'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              <Film className="w-4 h-4" />
              Movies ({movies.length})
            </button>
            <button
              onClick={() => setFilter('tv')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                filter === 'tv'
                  ? 'bg-violet-600 text-white'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              <Tv className="w-4 h-4" />
              TV Shows ({tvShows.length})
            </button>
            <button
              onClick={() => setFilter('person')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                filter === 'person'
                  ? 'bg-violet-600 text-white'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              <Users className="w-4 h-4" />
              People ({people.length})
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* No Results */}
        {!loading && query && results.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <p className="text-gray-400 text-lg">No results found for "{query}"</p>
            <p className="text-gray-500 mt-2">Try different keywords or check for typos</p>
          </motion.div>
        )}

        {/* Results Grid */}
        {!loading && filteredResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
          >
            {filteredResults.map((item, index) => {
              if (item.media_type === 'person') {
                return (
                  <div
                    key={item.id}
                    className="flex flex-col items-center text-center p-4 glass-card rounded-xl"
                  >
                    <div className="w-24 h-24 rounded-full overflow-hidden mb-3 bg-surface">
                      {item.profile_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w185${item.profile_path}`}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl text-gray-600">
                          {item.name?.charAt(0)}
                        </div>
                      )}
                    </div>
                    <p className="font-medium line-clamp-1">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.known_for_department}</p>
                  </div>
                );
              }

              return (
                <MediaCard
                  key={item.id}
                  item={item}
                  index={index}
                  onAddToWatchlist={handleAddToWatchlist}
                  isInWatchlist={watchlist.some(w => w.tmdb_id === item.id)}
                />
              );
            })}
          </motion.div>
        )}

        {/* Initial State */}
        {!query && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <div className="w-24 h-24 rounded-full bg-surface flex items-center justify-center mx-auto mb-6">
              <Search className="w-12 h-12 text-gray-600" />
            </div>
            <h2 className="text-xl font-bold mb-2">Search WatchNexus</h2>
            <p className="text-gray-400 max-w-md mx-auto">
              Find movies, TV shows, and people. Search by title, actor name, or keywords.
            </p>
          </motion.div>
        )}
      </div>
    </Layout>
  );
};
