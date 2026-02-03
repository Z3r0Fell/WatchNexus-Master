import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { MediaCard } from '../components/media/MediaCard';
import { tmdbApi, watchlistApi } from '../services/api';
import { toast } from 'sonner';
import { Tv, Filter, ChevronDown } from 'lucide-react';
import { getTitle } from '../lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Button } from '../components/ui/button';

const sortOptions = [
  { value: 'popularity.desc', label: 'Most Popular' },
  { value: 'vote_average.desc', label: 'Top Rated' },
  { value: 'first_air_date.desc', label: 'Newest' },
  { value: 'first_air_date.asc', label: 'Oldest' },
];

export const TVShowsPage = () => {
  const [shows, setShows] = useState([]);
  const [genres, setGenres] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [sortBy, setSortBy] = useState('popularity.desc');

  useEffect(() => {
    fetchGenres();
    fetchWatchlist();
  }, []);

  useEffect(() => {
    fetchShows();
  }, [page, selectedGenre, sortBy]);

  const fetchGenres = async () => {
    try {
      const response = await tmdbApi.getGenres('tv');
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

  const fetchShows = async () => {
    setLoading(true);
    try {
      const response = await tmdbApi.discover('tv', {
        page,
        genre: selectedGenre,
        sort_by: sortBy,
      });
      if (page === 1) {
        setShows(response.data.results || []);
      } else {
        setShows(prev => [...prev, ...(response.data.results || [])]);
      }
      setTotalPages(response.data.total_pages || 1);
    } catch (error) {
      toast.error('Failed to load TV shows');
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
          tmdb_id: item.id,
          media_type: 'tv',
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

  const handleGenreChange = (genreId) => {
    setSelectedGenre(genreId === selectedGenre ? null : genreId);
    setPage(1);
  };

  const handleSortChange = (value) => {
    setSortBy(value);
    setPage(1);
  };

  return (
    <Layout>
      <div data-testid="tv-shows-page" className="min-h-screen p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
              <Tv className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">TV Shows</h1>
              <p className="text-gray-400">Explore series and episodes</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mt-6">
            {/* Sort Dropdown */}
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

            {/* Genre Pills */}
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
        </motion.div>

        {/* TV Shows Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {shows.map((show, index) => (
            <MediaCard
              key={`${show.id}-${index}`}
              item={{ ...show, media_type: 'tv' }}
              index={index}
              onAddToWatchlist={handleAddToWatchlist}
              isInWatchlist={watchlist.some(w => w.tmdb_id === show.id)}
            />
          ))}
          
          {/* Loading skeletons */}
          {loading && Array.from({ length: 12 }).map((_, i) => (
            <div key={`skeleton-${i}`} className="aspect-[2/3] skeleton rounded-xl" />
          ))}
        </div>

        {/* Load More */}
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
      </div>
    </Layout>
  );
};
