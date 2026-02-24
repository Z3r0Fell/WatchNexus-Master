import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { MediaCard } from '../components/media/MediaCard';
import { tmdbApi, watchlistApi } from '../services/api';
import { marmaladeLibrary, marmaladeMedia, marmaladeStream, formatDuration } from '../services/marmaladeApi';
import { toast } from 'sonner';
import { 
  Film, Filter, ChevronDown, Plus, RefreshCw, Search, 
  FolderOpen, Play, Globe, HardDrive, Clock, Star
} from 'lucide-react';
import { getTitle, getMediaType, formatFileSize } from '../lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Link } from 'react-router-dom';

const sortOptions = [
  { value: 'popularity.desc', label: 'Most Popular' },
  { value: 'vote_average.desc', label: 'Top Rated' },
  { value: 'release_date.desc', label: 'Newest' },
  { value: 'release_date.asc', label: 'Oldest' },
];

export const MoviesPage = () => {
  // View mode: 'library' or 'discover'
  const [viewMode, setViewMode] = useState('library');

  // Library state
  const [libraries, setLibraries] = useState([]);
  const [localMovies, setLocalMovies] = useState([]);
  const [recentMovies, setRecentMovies] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [librarySearch, setLibrarySearch] = useState('');
  const [scanning, setScanning] = useState({});
  const [showAddLibrary, setShowAddLibrary] = useState(false);
  const [newLibrary, setNewLibrary] = useState({ name: '', path: '' });

  // Discover state
  const [movies, setMovies] = useState([]);
  const [genres, setGenres] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [sortBy, setSortBy] = useState('popularity.desc');

  // ===================== LIBRARY FUNCTIONS =====================
  const fetchLibraryData = useCallback(async () => {
    try {
      const [librariesRes, mediaRes, recentRes] = await Promise.all([
        marmaladeLibrary.getLibraries(),
        marmaladeMedia.getMedia({ media_type: 'movie', limit: 200 }),
        marmaladeMedia.getRecent(20),
      ]);
      const movieLibraries = (librariesRes.data || []).filter(lib => lib.media_type === 'movies');
      setLibraries(movieLibraries);
      setLocalMovies(mediaRes.data || []);
      const recentFiltered = (recentRes.data || []).filter(m => m.media_type === 'movie');
      setRecentMovies(recentFiltered.slice(0, 8));
    } catch (error) {
      console.error('Failed to fetch library data:', error);
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
      const addRes = await marmaladeLibrary.addLibrary(newLibrary.name, newLibrary.path, 'movies');
      toast.success(`Movie library "${newLibrary.name}" added`);
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

  const filteredLocalMovies = localMovies.filter(movie =>
    movie.title?.toLowerCase().includes(librarySearch.toLowerCase()) ||
    movie.series_name?.toLowerCase().includes(librarySearch.toLowerCase())
  );

  // ===================== DISCOVER FUNCTIONS =====================
  const fetchGenres = async () => {
    try {
      const response = await tmdbApi.getGenres('movie');
      setGenres(response.data.genres || []);
    } catch (error) {
      console.error('Failed to fetch genres:', error);
    }
  };

  const fetchWatchlist = async () => {
    try {
      const response = await watchlistApi.get();
      setWatchlist(response.data || []);
    } catch (error) {
      console.error('Failed to fetch watchlist:', error);
    }
  };

  const fetchMovies = async () => {
    setLoading(true);
    try {
      const response = await tmdbApi.discover('movie', {
        page, genre: selectedGenre, sort_by: sortBy,
      });
      if (page === 1) setMovies(response.data.results || []);
      else setMovies(prev => [...prev, ...(response.data.results || [])]);
      setTotalPages(response.data.total_pages || 1);
    } catch (error) {
      toast.error('Failed to load movies');
    } finally {
      setLoading(false);
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
          tmdb_id: item.id, media_type: 'movie',
          title: getTitle(item), poster_path: item.poster_path,
        });
        setWatchlist(prev => [...prev, { tmdb_id: item.id }]);
        toast.success('Added to watchlist');
      }
    } catch (error) {
      toast.error('Failed to update watchlist');
    }
  };

  const handleGenreChange = (genreId) => {
    setSelectedGenre(genreId === selectedGenre ? null : genreId);
    setPage(1);
  };

  const handleSortChange = (value) => {
    setSortBy(value);
    setPage(1);
  };

  // ===================== EFFECTS =====================
  useEffect(() => {
    fetchLibraryData();
    fetchGenres();
    fetchWatchlist();
  }, [fetchLibraryData]);

  useEffect(() => {
    if (viewMode === 'discover') fetchMovies();
  }, [page, selectedGenre, sortBy, viewMode]);

  return (
    <Layout>
      <div data-testid="movies-page" className="min-h-screen p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-pink-500 flex items-center justify-center">
                <Film className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Movies</h1>
                <p className="text-gray-400">
                  {viewMode === 'library'
                    ? `${localMovies.length} movies in ${libraries.length} ${libraries.length === 1 ? 'library' : 'libraries'}`
                    : 'Discover and explore films'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* View Mode Toggle */}
              <div className="flex rounded-lg bg-white/5 p-1" data-testid="movies-view-toggle">
                <button
                  onClick={() => setViewMode('library')}
                  data-testid="movies-library-tab"
                  className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors text-sm font-medium ${
                    viewMode === 'library' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <HardDrive className="w-4 h-4" />
                  My Library
                </button>
                <button
                  onClick={() => setViewMode('discover')}
                  data-testid="movies-discover-tab"
                  className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors text-sm font-medium ${
                    viewMode === 'discover' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  Discover
                </button>
              </div>

              {viewMode === 'library' && (
                <Button
                  onClick={() => setShowAddLibrary(!showAddLibrary)}
                  className="bg-violet-600 hover:bg-violet-700"
                  data-testid="add-movie-library-btn"
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
              <h3 className="font-semibold mb-3">Add Movie Library</h3>
              <div className="flex gap-3">
                <Input
                  placeholder="Library Name (e.g., My Movies)"
                  value={newLibrary.name}
                  onChange={(e) => setNewLibrary(prev => ({ ...prev, name: e.target.value }))}
                  className="bg-white/5 border-white/10"
                  data-testid="movie-library-name-input"
                />
                <Input
                  placeholder="Path (e.g., /home/user/Movies)"
                  value={newLibrary.path}
                  onChange={(e) => setNewLibrary(prev => ({ ...prev, path: e.target.value }))}
                  className="bg-white/5 border-white/10 flex-1"
                  data-testid="movie-library-path-input"
                />
                <Button onClick={handleAddLibrary} className="bg-green-600 hover:bg-green-700" data-testid="movie-library-add-btn">
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
            {localMovies.length > 0 && (
              <div className="relative max-w-md mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  placeholder="Search your movies..."
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10"
                  data-testid="movies-library-search"
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
                <div className="w-24 h-24 rounded-full bg-violet-600/20 flex items-center justify-center mb-6">
                  <FolderOpen className="w-12 h-12 text-violet-400" />
                </div>
                <h2 className="text-xl font-bold mb-2">No Movie Libraries</h2>
                <p className="text-gray-400 text-center max-w-md mb-6">
                  Add a movie library to start viewing your collection.
                  Supported formats: MP4, MKV, AVI, MOV, WMV, FLV, WebM, M4V
                </p>
                <div className="flex gap-3">
                  <Button
                    onClick={() => setShowAddLibrary(true)}
                    className="bg-violet-600 hover:bg-violet-700"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add Your First Library
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setViewMode('discover')}
                  >
                    <Globe className="w-4 h-4 mr-2" /> Browse Online
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Libraries Section */}
            {libraries.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-violet-400" /> Your Libraries
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {libraries.map(lib => (
                    <div key={lib.id} className="glass-card rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{lib.name}</h3>
                          <p className="text-sm text-gray-400">{lib.item_count} items</p>
                          <p className="text-xs text-gray-500 truncate max-w-[200px]">{lib.path}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleScanLibrary(lib.id)}
                          disabled={scanning[lib.id]}
                          data-testid={`scan-library-${lib.id}`}
                        >
                          <RefreshCw className={`w-4 h-4 ${scanning[lib.id] ? 'animate-spin' : ''}`} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recently Added */}
            {recentMovies.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-violet-400" /> Recently Added
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {recentMovies.map(movie => (
                    <Link key={movie.id} to={movie.tmdb_id ? `/movie/${movie.tmdb_id}` : '#'} data-testid={`recent-movie-${movie.id}`}>
                      <div className="rounded-xl bg-white/5 hover:bg-white/10 transition-all overflow-hidden group">
                        <div className="aspect-[2/3] relative">
                          {movie.poster_url ? (
                            <img src={movie.poster_url} alt={movie.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-violet-600/30 to-pink-500/30 flex items-center justify-center">
                              <Film className="w-12 h-12 text-violet-400" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                            <Button size="sm" className="w-full bg-violet-600 hover:bg-violet-700">
                              <Play className="w-4 h-4 mr-2" /> Watch
                            </Button>
                          </div>
                        </div>
                        <div className="p-3">
                          <p className="font-medium truncate text-sm">{movie.title}</p>
                          {movie.year && <p className="text-xs text-gray-400">{movie.year}</p>}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* All Local Movies */}
            {filteredLocalMovies.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Film className="w-5 h-5 text-violet-400" /> All Movies ({filteredLocalMovies.length})
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {filteredLocalMovies.map((movie, index) => (
                    <Link key={movie.id} to={movie.tmdb_id ? `/movie/${movie.tmdb_id}` : '#'} data-testid={`local-movie-${movie.id}`}>
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className="rounded-xl bg-white/5 hover:bg-white/10 transition-all overflow-hidden group"
                      >
                        <div className="aspect-[2/3] relative">
                          {movie.poster_url ? (
                            <img src={movie.poster_url} alt={movie.title} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-violet-600/30 to-pink-500/30 flex items-center justify-center">
                              <Film className="w-10 h-10 text-violet-400" />
                            </div>
                          )}
                          {movie.rating > 0 && (
                            <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded-md flex items-center gap-1">
                              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                              <span className="text-xs font-semibold">{movie.rating.toFixed(1)}</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                            <Button size="sm" className="w-full bg-violet-600 hover:bg-violet-700">
                              <Play className="w-4 h-4 mr-2" /> Watch
                            </Button>
                          </div>
                        </div>
                        <div className="p-3">
                          <p className="font-medium truncate text-sm">{movie.title}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                            {movie.year && <span>{movie.year}</span>}
                            {movie.duration > 0 && <span>{formatDuration(movie.duration)}</span>}
                          </div>
                        </div>
                      </motion.div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Loading */}
            {libraryLoading && (
              <div className="flex justify-center py-20">
                <RefreshCw className="w-8 h-8 animate-spin text-violet-500" />
              </div>
            )}
          </>
        )}

        {/* ===================== DISCOVER VIEW ===================== */}
        {viewMode === 'discover' && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10">
                    <Filter className="w-4 h-4 mr-2" />
                    {sortOptions.find(o => o.value === sortBy)?.label}
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-[#1E1E1E] border-white/10">
                  {sortOptions.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => handleSortChange(option.value)}
                      className={sortBy === option.value ? 'bg-violet-600/20 text-violet-400' : ''}
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex flex-wrap gap-2">
                {genres.map((genre) => (
                  <button
                    key={genre.id}
                    onClick={() => handleGenreChange(genre.id)}
                    data-testid={`genre-${genre.id}`}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      selectedGenre === genre.id
                        ? 'bg-violet-600 text-white'
                        : 'bg-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {genre.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Movies Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {movies.map((movie, index) => (
                <MediaCard
                  key={`${movie.id}-${index}`}
                  item={{ ...movie, media_type: 'movie' }}
                  index={index}
                  onAddToWatchlist={handleAddToWatchlist}
                  isInWatchlist={watchlist.some(w => w.tmdb_id === movie.id)}
                />
              ))}
              {loading && Array.from({ length: 12 }).map((_, i) => (
                <div key={`skeleton-${i}`} className="aspect-[2/3] skeleton rounded-xl" />
              ))}
            </div>

            {page < totalPages && !loading && (
              <div className="flex justify-center mt-8">
                <Button
                  onClick={() => setPage(p => p + 1)}
                  data-testid="load-more-btn"
                  className="bg-violet-600 hover:bg-violet-700 px-8"
                >
                  Load More
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};
