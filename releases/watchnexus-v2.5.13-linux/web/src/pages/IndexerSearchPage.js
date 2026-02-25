import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { compoteApi } from '../services/api';
import { toast } from 'sonner';
import { 
  Search, Download, Film, Tv, Music, Book, 
  ArrowUpDown, Users, HardDrive, AlertTriangle,
  RefreshCw, Magnet, ExternalLink
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { formatFileSize } from '../lib/utils';
import { Link } from 'react-router-dom';

const MEDIA_TYPES = [
  { id: 'movies', label: 'Movies', icon: Film },
  { id: 'tv', label: 'TV Shows', icon: Tv },
  { id: 'audio', label: 'Music', icon: Music },
  { id: 'audiobooks', label: 'Audiobooks', icon: Book },
];

const SORT_OPTIONS = [
  { id: 'seeders', label: 'Most Seeds' },
  { id: 'size', label: 'Size' },
  { id: 'date', label: 'Newest' },
];

const QUALITY_BADGES = {
  '2160p': 'bg-purple-500/20 text-purple-400',
  '1080p': 'bg-blue-500/20 text-blue-400',
  '720p': 'bg-green-500/20 text-green-400',
  '480p': 'bg-yellow-500/20 text-yellow-400',
};

export const IndexerSearchPage = () => {
  const [query, setQuery] = useState('');
  const [mediaType, setMediaType] = useState('movies');
  const [sortBy, setSortBy] = useState('seeders');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [grabbing, setGrabbing] = useState({});
  const [searchDone, setSearchDone] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      toast.error('Please enter a search query');
      return;
    }
    
    setSearching(true);
    setSearchDone(false);
    
    try {
      const res = await compoteApi.search(query, mediaType, sortBy, 100);
      setResults(res.data.results || []);
      setSearchDone(true);
      
      if (res.data.results?.length === 0) {
        toast.info('No results found. Try a different search or add indexers in Settings.');
      }
    } catch (error) {
      console.error('Search failed:', error);
      toast.error('Search failed. Check your indexer configuration.');
    } finally {
      setSearching(false);
    }
  }, [query, mediaType, sortBy]);

  const handleGrab = async (result) => {
    const key = `${result.title}-${result.indexer}`;
    setGrabbing(prev => ({ ...prev, [key]: true }));
    
    try {
      // Check download mode preference
      const useBuiltin = localStorage.getItem('watchnexus_download_mode') !== 'qbittorrent';
      
      const res = await compoteApi.grab(
        result.title,
        result.download_url || null,
        result.magnet_url || null,
        result.size,
        useBuiltin
      );
      
      if (res.data.success) {
        toast.success(`Added "${result.title}" to downloads!`);
      } else {
        toast.warning(res.data.message);
      }
    } catch (error) {
      console.error('Grab failed:', error);
      toast.error('Failed to add download');
    } finally {
      setGrabbing(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <Layout>
      <div data-testid="indexer-search-page" className="min-h-screen p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-600 to-amber-500 flex items-center justify-center">
              <Search className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Compote Search</h1>
              <p className="text-gray-400">Search across all your indexers</p>
            </div>
          </div>
        </motion.div>

        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-xl p-6 mb-6"
        >
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Search for movies, TV shows, music..."
                className="bg-white/5 border-white/10 h-12 text-lg"
                data-testid="indexer-search-input"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={searching}
              className="bg-violet-600 hover:bg-violet-700 h-12 px-8"
              data-testid="indexer-search-button"
            >
              {searching ? (
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <Search className="w-5 h-5 mr-2" />
              )}
              Search
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 mt-4">
            {/* Media Type */}
            <div className="flex rounded-lg bg-white/5 p-1">
              {MEDIA_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setMediaType(type.id)}
                  className={`px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors text-sm ${
                    mediaType === type.id ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <type.icon className="w-4 h-4" />
                  {type.label}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-gray-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </motion.div>

        {/* Results */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {!searchDone && !searching && (
            <div className="glass-card rounded-xl p-12 text-center">
              <Search className="w-12 h-12 mx-auto mb-4 text-gray-600" />
              <h3 className="text-xl font-bold mb-2">Search for Content</h3>
              <p className="text-gray-400 mb-4">
                Enter a search query above to find movies, TV shows, and more from your indexers.
              </p>
              <p className="text-sm text-gray-500">
                Configure indexers in <Link to="/settings" className="text-violet-400 hover:underline">Settings</Link> for best results.
              </p>
            </div>
          )}

          {searching && (
            <div className="glass-card rounded-xl p-12 text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-violet-400" />
              <p className="text-gray-400">Searching indexers...</p>
            </div>
          )}

          {searchDone && results.length === 0 && (
            <div className="glass-card rounded-xl p-12 text-center">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
              <h3 className="text-xl font-bold mb-2">No Results Found</h3>
              <p className="text-gray-400">
                Try a different search query or add more indexers in Settings.
              </p>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-400 mb-4">Found {results.length} results</p>
              
              {results.map((result, index) => {
                const key = `${result.title}-${result.indexer}`;
                return (
                  <motion.div
                    key={`${key}-${index}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="glass-card rounded-xl p-4 hover:border-white/20 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      {/* Icon */}
                      <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                        {result.magnet_url ? (
                          <Magnet className="w-5 h-5 text-violet-400" />
                        ) : (
                          <Download className="w-5 h-5 text-violet-400" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate" title={result.title}>
                          {result.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {/* Quality */}
                          {result.quality && (
                            <span className={`text-xs px-2 py-0.5 rounded ${QUALITY_BADGES[result.quality] || 'bg-gray-500/20 text-gray-400'}`}>
                              {result.quality}
                            </span>
                          )}
                          {/* Codec */}
                          {result.codec && (
                            <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400">
                              {result.codec}
                            </span>
                          )}
                          {/* Source */}
                          {result.source && (
                            <span className="text-xs px-2 py-0.5 rounded bg-pink-500/20 text-pink-400">
                              {result.source}
                            </span>
                          )}
                          {/* Indexer */}
                          <span className="text-xs text-gray-500">{result.indexer}</span>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="hidden md:flex items-center gap-6 text-sm">
                        {/* Size */}
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-gray-400">
                            <HardDrive className="w-4 h-4" />
                            <span>{result.size_formatted || formatFileSize(result.size)}</span>
                          </div>
                        </div>
                        
                        {/* Seeders */}
                        <div className="text-right w-16">
                          <div className="flex items-center gap-1 text-green-400">
                            <Users className="w-4 h-4" />
                            <span>{result.seeders}</span>
                          </div>
                          <div className="flex items-center gap-1 text-red-400 text-xs">
                            <span>{result.leechers} lch</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        {result.info_url && (
                          <a 
                            href={result.info_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4 text-gray-400" />
                          </a>
                        )}
                        <Button
                          onClick={() => handleGrab(result)}
                          disabled={grabbing[key] || (!result.magnet_url && !result.download_url)}
                          className="bg-green-600 hover:bg-green-700"
                          data-testid={`grab-${index}`}
                        >
                          {grabbing[key] ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </Layout>
  );
};

export default IndexerSearchPage;
