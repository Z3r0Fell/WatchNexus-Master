import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { tmdbApi } from '../services/api';
import { marmaladeLibrary, marmaladeMedia, formatDuration } from '../services/marmaladeApi';
import { toast } from 'sonner';
import { 
  Sparkles, Star, Calendar, Play, Plus, Search, Loader2,
  HardDrive, Globe, FolderOpen, RefreshCw, Clock, Layers, Film
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Link } from 'react-router-dom';

const ANIME_GENRES = [
  { id: 16, name: 'Animation' },
  { id: 10759, name: 'Action & Adventure' },
  { id: 10765, name: 'Sci-Fi & Fantasy' },
  { id: 35, name: 'Comedy' },
  { id: 18, name: 'Drama' },
  { id: 10749, name: 'Romance' },
  { id: 80, name: 'Crime' },
  { id: 9648, name: 'Mystery' },
];

const AnimeCard = ({ anime }) => {
  const imageUrl = anime.poster_path 
    ? `https://image.tmdb.org/t/p/w342${anime.poster_path}`
    : '/placeholder-poster.png';
    
  return (
    <Link to={`/tv/${anime.id}`} data-testid={`anime-card-${anime.id}`}>
      <motion.div 
        className="group relative rounded-xl overflow-hidden bg-white/5"
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
      >
        <div className="aspect-[2/3] relative">
          <img 
            src={imageUrl}
            alt={anime.name || anime.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <Button size="sm" className="w-full bg-pink-600 hover:bg-pink-700">
                <Play className="w-4 h-4 mr-2" />
                Watch Now
              </Button>
            </div>
          </div>
        </div>
        {anime.vote_average > 0 && (
          <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded-md flex items-center gap-1">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            <span className="text-xs font-semibold">{anime.vote_average.toFixed(1)}</span>
          </div>
        )}
        <Badge className="absolute top-2 left-2 bg-pink-600/90 text-white text-xs">
          ANIME
        </Badge>
        <div className="p-3">
          <h3 className="font-semibold text-sm truncate">{anime.name || anime.title}</h3>
          <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
            <Calendar className="w-3 h-3" />
            <span>{anime.first_air_date?.slice(0, 4) || anime.release_date?.slice(0, 4) || 'TBA'}</span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
};

const AnimePage = () => {
  const [viewMode, setViewMode] = useState('library');
  
  // Library state
  const [libraries, setLibraries] = useState([]);
  const [localAnime, setLocalAnime] = useState([]);
  const [animeSeries, setAnimeSeries] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [librarySearch, setLibrarySearch] = useState('');
  const [scanning, setScanning] = useState({});
  const [showAddLibrary, setShowAddLibrary] = useState(false);
  const [newLibrary, setNewLibrary] = useState({ name: '', path: '' });

  // Discover state
  const [anime, setAnime] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeGenre, setActiveGenre] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('popularity.desc');

  // ===================== LIBRARY FUNCTIONS =====================
  const fetchLibraryData = useCallback(async () => {
    try {
      const [librariesRes, mediaRes] = await Promise.all([
        marmaladeLibrary.getLibraries(),
        marmaladeMedia.getMedia({ media_type: 'episode', limit: 500 }),
      ]);
      const animeLibraries = (librariesRes.data || []).filter(lib => lib.media_type === 'anime');
      setLibraries(animeLibraries);
      
      // Filter episodes from anime libraries
      const animeLibIds = new Set(animeLibraries.map(l => l.id));
      const animeEpisodes = (mediaRes.data || []);
      setLocalAnime(animeEpisodes);
      
      // Group by series
      const seriesMap = {};
      animeEpisodes.forEach(ep => {
        const key = ep.series_name || ep.title || 'Unknown';
        if (!seriesMap[key]) {
          seriesMap[key] = { name: key, episodes: [], poster_url: ep.poster_url, year: ep.year, tmdb_id: ep.tmdb_id };
        }
        seriesMap[key].episodes.push(ep);
      });
      setAnimeSeries(Object.values(seriesMap));
    } catch (error) {
      console.error('Failed to fetch anime library data:', error);
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  const handleAddLibrary = async () => {
    if (!newLibrary.name || !newLibrary.path) {
      toast.error('Please enter library name and path');
      return;
    }
    try {
      const addRes = await marmaladeLibrary.addLibrary(newLibrary.name, newLibrary.path, 'anime');
      toast.success(`Anime library "${newLibrary.name}" added`);
      setNewLibrary({ name: '', path: '' });
      setShowAddLibrary(false);
      await fetchLibraryData();
      if (addRes?.data?.id) handleScanLibrary(addRes.data.id);
    } catch (error) {
      toast.error('Failed to add library');
    }
  };

  const handleScanLibrary = async (libraryId) => {
    setScanning(prev => ({ ...prev, [libraryId]: true }));
    try {
      const res = await marmaladeLibrary.scanLibrary(libraryId);
      toast.success(`Scan complete: ${res.data?.new || 0} new items found`);
      fetchLibraryData();
    } catch (error) {
      toast.error('Scan failed');
    } finally {
      setScanning(prev => ({ ...prev, [libraryId]: false }));
    }
  };

  const filteredAnimeSeries = animeSeries.filter(s =>
    s.name.toLowerCase().includes(librarySearch.toLowerCase())
  );

  // ===================== DISCOVER FUNCTIONS =====================
  const fetchAnime = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        with_genres: activeGenre ? `16,${activeGenre}` : '16',
        with_original_language: 'ja',
        sort_by: sortBy,
        page: 1,
      };
      const res = await tmdbApi.discover('tv', params);
      setAnime(res.data.results || []);
    } catch (error) {
      console.error('Failed to fetch anime:', error);
    } finally {
      setLoading(false);
    }
  }, [activeGenre, sortBy]);

  const searchAnime = async () => {
    if (!searchQuery.trim()) { fetchAnime(); return; }
    setLoading(true);
    try {
      const res = await tmdbApi.search(searchQuery, 1, 'tv');
      const filtered = (res.data.results || []).filter(item => 
        item.origin_country?.includes('JP') && item.genre_ids?.includes(16)
      );
      setAnime(filtered);
    } catch (error) {
      console.error('Failed to search anime:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLibraryData();
  }, [fetchLibraryData]);

  useEffect(() => {
    if (viewMode === 'discover') fetchAnime();
  }, [fetchAnime, viewMode]);

  return (
    <Layout>
      <div data-testid="anime-page" className="min-h-screen p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-600 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Anime</h1>
                <p className="text-gray-400">
                  {viewMode === 'library'
                    ? `${filteredAnimeSeries.length} series in ${libraries.length} ${libraries.length === 1 ? 'library' : 'libraries'}`
                    : 'Discover Japanese animation'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* View Mode Toggle */}
              <div className="flex rounded-lg bg-white/5 p-1" data-testid="anime-view-toggle">
                <button
                  onClick={() => setViewMode('library')}
                  data-testid="anime-library-tab"
                  className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors text-sm font-medium ${
                    viewMode === 'library' ? 'bg-pink-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <HardDrive className="w-4 h-4" />
                  My Library
                </button>
                <button
                  onClick={() => setViewMode('discover')}
                  data-testid="anime-discover-tab"
                  className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors text-sm font-medium ${
                    viewMode === 'discover' ? 'bg-pink-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  Discover
                </button>
              </div>

              {viewMode === 'library' && (
                <Button
                  onClick={() => setShowAddLibrary(!showAddLibrary)}
                  className="bg-pink-600 hover:bg-pink-700"
                  data-testid="add-anime-library-btn"
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Library
                </Button>
              )}
            </div>
          </div>

          {/* Add Library Form */}
          {viewMode === 'library' && showAddLibrary && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="glass-card rounded-xl p-4 mb-6"
            >
              <h3 className="font-semibold mb-3">Add Anime Library</h3>
              <div className="flex gap-3">
                <Input
                  placeholder="Library Name (e.g., My Anime)"
                  value={newLibrary.name}
                  onChange={(e) => setNewLibrary(prev => ({ ...prev, name: e.target.value }))}
                  className="bg-white/5 border-white/10"
                />
                <Input
                  placeholder="Path (e.g., /home/user/Anime)"
                  value={newLibrary.path}
                  onChange={(e) => setNewLibrary(prev => ({ ...prev, path: e.target.value }))}
                  className="bg-white/5 border-white/10 flex-1"
                />
                <Button onClick={handleAddLibrary} className="bg-green-600 hover:bg-green-700">
                  Add & Scan
                </Button>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* ===================== LIBRARY VIEW ===================== */}
        {viewMode === 'library' && (
          <>
            {/* Search */}
            {localAnime.length > 0 && (
              <div className="relative max-w-md mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  placeholder="Search your anime..."
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10"
                  data-testid="anime-library-search"
                />
              </div>
            )}

            {/* Empty State */}
            {libraries.length === 0 && !libraryLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20"
              >
                <div className="w-24 h-24 rounded-full bg-pink-600/20 flex items-center justify-center mb-6">
                  <FolderOpen className="w-12 h-12 text-pink-400" />
                </div>
                <h2 className="text-xl font-bold mb-2">No Anime Libraries</h2>
                <p className="text-gray-400 text-center max-w-md mb-6">
                  Add your anime collection to start streaming. WatchNexus supports all popular video formats and will automatically detect series, seasons, and episodes.
                </p>
                <div className="flex gap-3">
                  <Button
                    onClick={() => setShowAddLibrary(true)}
                    className="bg-pink-600 hover:bg-pink-700"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add Your First Library
                  </Button>
                  <Button variant="outline" onClick={() => setViewMode('discover')}>
                    <Globe className="w-4 h-4 mr-2" /> Browse Online
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Libraries Section */}
            {libraries.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-pink-400" /> Your Libraries
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {libraries.map(lib => (
                    <div key={lib.id} className="glass-card rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{lib.name}</h3>
                          <p className="text-sm text-gray-400">{lib.item_count} episodes</p>
                          <p className="text-xs text-gray-500 truncate max-w-[200px]">{lib.path}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleScanLibrary(lib.id)}
                          disabled={scanning[lib.id]}
                        >
                          <RefreshCw className={`w-4 h-4 ${scanning[lib.id] ? 'animate-spin' : ''}`} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Anime Series Grid */}
            {filteredAnimeSeries.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-pink-400" /> All Anime ({filteredAnimeSeries.length})
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {filteredAnimeSeries.map((series, index) => (
                    <Link key={series.name} to={series.tmdb_id ? `/tv/${series.tmdb_id}` : '#'} data-testid={`local-anime-${index}`}>
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className="rounded-xl bg-white/5 hover:bg-white/10 transition-all overflow-hidden group"
                      >
                        <div className="aspect-[2/3] relative">
                          {series.poster_url ? (
                            <img src={series.poster_url} alt={series.name} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-pink-600/30 to-purple-500/30 flex items-center justify-center">
                              <Sparkles className="w-10 h-10 text-pink-400" />
                            </div>
                          )}
                          <Badge className="absolute top-2 left-2 bg-pink-600/90 text-white text-xs">ANIME</Badge>
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                            <span className="text-xs bg-pink-600/80 px-2 py-0.5 rounded-full">
                              {series.episodes.length} episodes
                            </span>
                          </div>
                        </div>
                        <div className="p-3">
                          <p className="font-medium truncate text-sm">{series.name}</p>
                          {series.year && <p className="text-xs text-gray-400">{series.year}</p>}
                        </div>
                      </motion.div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {libraryLoading && (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
              </div>
            )}
          </>
        )}

        {/* ===================== DISCOVER VIEW ===================== */}
        {viewMode === 'discover' && (
          <>
            {/* Search & Filters */}
            <div className="flex items-center gap-3 mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchAnime()}
                  placeholder="Search anime..."
                  className="pl-10 bg-white/5 border-white/10"
                  data-testid="anime-search-input"
                />
              </div>
              <Button onClick={searchAnime} className="bg-pink-600 hover:bg-pink-700">
                <Search className="w-4 h-4" />
              </Button>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex flex-wrap gap-2 mb-6"
            >
              <Button
                variant={activeGenre === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveGenre(null)}
                className={activeGenre === null ? 'bg-pink-600 hover:bg-pink-700' : ''}
              >
                All Anime
              </Button>
              {ANIME_GENRES.map(genre => (
                <Button
                  key={genre.id}
                  variant={activeGenre === genre.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveGenre(genre.id)}
                  className={activeGenre === genre.id ? 'bg-pink-600 hover:bg-pink-700' : ''}
                >
                  {genre.name}
                </Button>
              ))}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-8 px-3 text-sm rounded-md bg-white/5 border border-white/10 text-white ml-auto"
              >
                <option value="popularity.desc">Most Popular</option>
                <option value="vote_average.desc">Highest Rated</option>
                <option value="first_air_date.desc">Newest</option>
                <option value="first_air_date.asc">Oldest</option>
              </select>
            </motion.div>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
              </div>
            ) : anime.length === 0 ? (
              <div className="text-center py-16">
                <Sparkles className="w-16 h-16 mx-auto text-gray-600 mb-4" />
                <h3 className="text-xl font-semibold mb-2">No anime found</h3>
                <p className="text-gray-400">Try adjusting your filters or search</p>
              </div>
            ) : (
              <motion.div 
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                data-testid="anime-grid"
              >
                {anime.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <AnimeCard anime={item} />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default AnimePage;
