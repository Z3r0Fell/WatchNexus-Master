import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { tmdbApi } from '../services/api';
import { Sparkles, Star, Calendar, Play, Plus, Filter, Search, Loader2 } from 'lucide-react';
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
        
        {/* Rating Badge */}
        {anime.vote_average > 0 && (
          <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded-md flex items-center gap-1">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            <span className="text-xs font-semibold">{anime.vote_average.toFixed(1)}</span>
          </div>
        )}
        
        {/* Anime Badge */}
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
  const [anime, setAnime] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeGenre, setActiveGenre] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('popularity.desc');

  const fetchAnime = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch anime from TMDB - Japanese animation (origin_country=JP, with_genres=16)
      const params = {
        with_genres: activeGenre ? `16,${activeGenre}` : '16', // 16 is Animation
        with_original_language: 'ja', // Japanese language = Anime
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
    if (!searchQuery.trim()) {
      fetchAnime();
      return;
    }
    
    setLoading(true);
    try {
      const res = await tmdbApi.search(searchQuery, 1, 'tv');
      // Filter for anime (Japanese animation)
      const filtered = (res.data.results || []).filter(item => 
        item.origin_country?.includes('JP') && 
        item.genre_ids?.includes(16)
      );
      setAnime(filtered);
    } catch (error) {
      console.error('Failed to search anime:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnime();
  }, [fetchAnime]);

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-600 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Anime</h1>
              <p className="text-gray-400">Discover Japanese animation</p>
            </div>
          </div>
          
          {/* Search */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchAnime()}
                placeholder="Search anime..."
                className="pl-10 w-64 bg-white/5 border-white/10"
                data-testid="anime-search-input"
              />
            </div>
            <Button onClick={searchAnime} className="bg-pink-600 hover:bg-pink-700">
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap gap-2"
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
          
          {/* Sort Dropdown */}
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

        {/* Anime Grid */}
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
      </div>
    </Layout>
  );
};

export default AnimePage;
