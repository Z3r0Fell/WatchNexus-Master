import { tmdbImageUrl, BACKEND_URL } from '../lib/config';
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { Compass, TrendingUp, Film, Tv, Star, Calendar, Search, Filter } from 'lucide-react';
import { tmdbApi, watchlistApi } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

const API_URL = BACKEND_URL;

export const DiscoverPage = () => {
  const [mediaType, setMediaType] = useState('movie');
  const [content, setContent] = useState([]);
  const [genres, setGenres] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [sortBy, setSortBy] = useState('popularity.desc');
  const [loading, setLoading] = useState(true);
  const [watchlist, setWatchlist] = useState([]);
  const [page, setPage] = useState(1);

  const sortOptions = [
    { value: 'popularity.desc', label: 'Most Popular' },
    { value: 'vote_average.desc', label: 'Highest Rated' },
    { value: 'release_date.desc', label: 'Newest First' },
    { value: 'release_date.asc', label: 'Oldest First' },
  ];

  const fetchContent = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        sort_by: sortBy,
        page,
        'vote_count.gte': 100,
      };
      if (selectedGenre) params.with_genres = selectedGenre;

      const res = await tmdbApi.discover(mediaType, params);
      setContent(res.data.results || []);
    } catch (error) {
      console.error('Failed to fetch content:', error);
    } finally {
      setLoading(false);
    }
  }, [mediaType, sortBy, selectedGenre, page]);

  const fetchGenres = useCallback(async () => {
    try {
      const res = await tmdbApi.getGenres(mediaType);
      setGenres(res.data.genres || []);
    } catch (error) {
      console.error('Failed to fetch genres:', error);
    }
  }, [mediaType]);

  const fetchWatchlist = async () => {
    try {
      const res = await watchlistApi.get();
      setWatchlist(res.data || []);
    } catch (error) {
      console.error('Failed to fetch watchlist:', error);
    }
  };

  useEffect(() => {
    fetchContent();
    fetchGenres();
    fetchWatchlist();
  }, [fetchContent, fetchGenres]);

  const handleAddToWatchlist = async (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await watchlistApi.add({
        tmdb_id: item.id,
        media_type: mediaType,
        title: item.title || item.name,
        poster_path: item.poster_path,
        year: (item.release_date || item.first_air_date)?.split('-')[0],
      });
      setWatchlist(prev => [...prev, { tmdb_id: item.id }]);
      toast.success('Added to watchlist');
    } catch (error) {
      toast.error('Failed to add to watchlist');
    }
  };

  const isInWatchlist = (id) => watchlist.some(w => w.tmdb_id === id);

  return (
    <Layout>
      <div data-testid="discover-page" className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center">
              <Compass className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Discover</h1>
              <p className="text-gray-400">Explore movies and TV shows</p>
            </div>
          </div>

          {/* Filters */}
          <div className="glass-card rounded-xl p-4 mb-8">
            <div className="flex flex-wrap items-center gap-4">
              {/* Media Type Toggle */}
              <div className="flex rounded-lg overflow-hidden border border-white/10">
                <button
                  onClick={() => { setMediaType('movie'); setPage(1); setSelectedGenre(''); }}
                  className={`px-4 py-2 flex items-center gap-2 transition-colors ${
                    mediaType === 'movie' ? 'bg-violet-600 text-white' : 'hover:bg-white/5'
                  }`}
                  data-testid="filter-movies"
                >
                  <Film className="w-4 h-4" /> Movies
                </button>
                <button
                  onClick={() => { setMediaType('tv'); setPage(1); setSelectedGenre(''); }}
                  className={`px-4 py-2 flex items-center gap-2 transition-colors ${
                    mediaType === 'tv' ? 'bg-violet-600 text-white' : 'hover:bg-white/5'
                  }`}
                  data-testid="filter-tv"
                >
                  <Tv className="w-4 h-4" /> TV Shows
                </button>
              </div>

              {/* Genre Filter */}
              <select
                value={selectedGenre}
                onChange={(e) => { setSelectedGenre(e.target.value); setPage(1); }}
                className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
                data-testid="genre-filter"
              >
                <option value="">All Genres</option>
                {genres.map(genre => (
                  <option key={genre.id} value={genre.id}>{genre.name}</option>
                ))}
              </select>

              {/* Sort Filter */}
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
                className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
                data-testid="sort-filter"
              >
                {sortOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Content Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {content.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.02 }}
                    className="group"
                  >
                    <Link 
                      to={`/${mediaType}/${item.id}`}
                      data-testid={`discover-item-${item.id}`}
                      className="block relative aspect-[2/3] rounded-xl overflow-hidden media-card"
                    >
                      {item.poster_path ? (
                        <img 
                          src={tmdbImageUrl(item.poster_path, 'w342')} 
                          alt={item.title || item.name} 
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-violet-900/50 to-pink-900/50 flex items-center justify-center">
                          {mediaType === 'tv' ? (
                            <Tv className="w-12 h-12 text-gray-600" />
                          ) : (
                            <Film className="w-12 h-12 text-gray-600" />
                          )}
                        </div>
                      )}

                      {/* Rating */}
                      {item.vote_average > 0 && (
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/60 flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                          <span className="text-xs font-medium">{item.vote_average.toFixed(1)}</span>
                        </div>
                      )}

                      {/* Add to Watchlist */}
                      {!isInWatchlist(item.id) && (
                        <button
                          onClick={(e) => handleAddToWatchlist(e, item)}
                          className="absolute top-2 left-2 p-2 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-violet-500/80"
                          title="Add to Watchlist"
                        >
                          <TrendingUp className="w-4 h-4" />
                        </button>
                      )}

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                        <p className="font-medium line-clamp-2">{item.title || item.name}</p>
                        <p className="text-xs text-gray-400">
                          {(item.release_date || item.first_air_date)?.split('-')[0]}
                        </p>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>

              {/* Pagination */}
              <div className="flex justify-center gap-2 mt-8">
                <Button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  variant="outline"
                  className="border-white/10"
                >
                  Previous
                </Button>
                <span className="px-4 py-2 text-gray-400">Page {page}</span>
                <Button
                  onClick={() => setPage(p => p + 1)}
                  variant="outline"
                  className="border-white/10"
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default DiscoverPage;
