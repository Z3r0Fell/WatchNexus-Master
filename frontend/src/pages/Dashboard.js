import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { HeroBanner } from '../components/media/HeroBanner';
import { MediaRow } from '../components/media/MediaRow';
import { tmdbApi, watchlistApi, progressApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Play, Clock, TrendingUp, Tv, ChevronRight, Film, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatTime, getTitle, getMediaType } from '../lib/utils';

export const Dashboard = () => {
  const { user } = useAuth();
  const [trending, setTrending] = useState([]);
  const [nowPlaying, setNowPlaying] = useState([]);
  const [onTheAir, setOnTheAir] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [continueWatching, setContinueWatching] = useState([]);
  const [nextUp, setNextUp] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  const fetchData = async () => {
    try {
      const [trendingRes, nowPlayingRes, onTheAirRes, watchlistRes, progressRes, nextUpRes] = await Promise.all([
        tmdbApi.getTrending('all', 'week'),
        tmdbApi.getNowPlaying(),
        tmdbApi.getOnTheAir(),
        watchlistApi.get().catch(() => ({ data: [] })),
        progressApi.get().catch(() => ({ data: [] })),
        progressApi.getNextUp().catch(() => ({ data: [] })),
      ]);

      setTrending(trendingRes.data.results || []);
      setNowPlaying(nowPlayingRes.data.results || []);
      setOnTheAir(onTheAirRes.data.results || []);
      setWatchlist(watchlistRes.data || []);
      setContinueWatching(progressRes.data || []);
      setNextUp(nextUpRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load content');
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

  // Calculate remaining time for continue watching items
  const getRemainingTime = (item) => {
    const remaining = item.duration - item.current_time;
    if (remaining < 60) return `${remaining}s left`;
    if (remaining < 3600) return `${Math.floor(remaining / 60)}m left`;
    return `${Math.floor(remaining / 3600)}h ${Math.floor((remaining % 3600) / 60)}m left`;
  };

  return (
    <Layout>
      <div data-testid="dashboard" className="min-h-screen">
        {/* Hero Banner */}
        <HeroBanner items={trending.slice(0, 5)} />

        {/* Continue Watching Section */}
        {continueWatching.length > 0 && (
          <section data-testid="continue-watching-section" className="py-6 px-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Clock className="w-5 h-5 text-violet-400" />
                Continue Watching
                <span className="text-sm font-normal text-gray-500 ml-2">
                  for {user?.username || 'You'}
                </span>
              </h2>
              {continueWatching.length > 5 && (
                <Link 
                  to="/history" 
                  className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1"
                >
                  View All <ChevronRight className="w-4 h-4" />
                </Link>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              <AnimatePresence>
                {continueWatching.slice(0, 5).map((item, index) => (
                  <motion.div
                    key={`continue-${item.tmdb_id}-${item.season || ''}-${item.episode || ''}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link
                      to={`/${item.media_type}/${item.tmdb_id}`}
                      data-testid={`continue-${item.tmdb_id}`}
                      className="relative group rounded-xl overflow-hidden glass-card hover:ring-2 hover:ring-violet-500/50 transition-all block"
                    >
                      <div className="aspect-video relative">
                        {item.backdrop_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w500${item.backdrop_path}`}
                            alt={item.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : item.poster_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                            alt={item.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-violet-900/50 to-pink-900/50 flex items-center justify-center">
                            <Film className="w-12 h-12 text-gray-600" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                        
                        {/* Media type badge */}
                        <div className="absolute top-2 left-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            item.media_type === 'tv' ? 'bg-blue-500/80' : 'bg-violet-500/80'
                          }`}>
                            {item.media_type === 'tv' ? 'TV' : 'Movie'}
                          </span>
                        </div>
                        
                        {/* Content info */}
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <p className="font-semibold text-sm line-clamp-1">{item.title}</p>
                          {item.season && item.episode && (
                            <p className="text-xs text-violet-300 font-medium">
                              Season {item.season}, Episode {item.episode}
                            </p>
                          )}
                          
                          {/* Progress bar */}
                          <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${item.progress}%` }}
                              transition={{ duration: 0.5, delay: index * 0.05 }}
                            />
                          </div>
                          
                          {/* Time remaining */}
                          <div className="flex justify-between items-center mt-1.5">
                            <p className="text-xs text-gray-400">
                              {formatTime(item.current_time)} / {formatTime(item.duration)}
                            </p>
                            <p className="text-xs text-violet-400 font-medium">
                              {getRemainingTime(item)}
                            </p>
                          </div>
                        </div>
                        
                        {/* Play overlay */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
                          <motion.div 
                            className="w-14 h-14 rounded-full bg-gradient-to-r from-violet-600 to-pink-600 flex items-center justify-center shadow-xl"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Play className="w-6 h-6 text-white fill-white ml-1" />
                          </motion.div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}

        {/* Next Up Section (TV Shows only) */}
        {nextUp.length > 0 && (
          <section data-testid="next-up-section" className="py-6 px-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-pink-400" />
                Next Up
                <span className="text-sm font-normal text-gray-500 ml-2">
                  Episodes to watch next
                </span>
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              <AnimatePresence>
                {nextUp.slice(0, 5).map((item, index) => (
                  <motion.div
                    key={`nextup-${item.tmdb_id}-${item.season}-${item.episode}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link
                      to={`/tv/${item.tmdb_id}`}
                      data-testid={`nextup-${item.tmdb_id}`}
                      className="relative group rounded-xl overflow-hidden glass-card hover:ring-2 hover:ring-pink-500/50 transition-all block"
                    >
                      <div className="aspect-video relative">
                        {item.backdrop_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w500${item.backdrop_path}`}
                            alt={item.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : item.poster_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                            alt={item.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-pink-900/50 to-violet-900/50 flex items-center justify-center">
                            <Tv className="w-12 h-12 text-gray-600" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                        
                        {/* Next Up badge */}
                        <div className="absolute top-2 left-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            item.is_continue 
                              ? 'bg-yellow-500/80 text-yellow-100' 
                              : 'bg-pink-500/80'
                          }`}>
                            {item.is_continue ? 'Resume' : 'New Episode'}
                          </span>
                        </div>
                        
                        {/* Content info */}
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <p className="font-semibold text-sm line-clamp-1">{item.title}</p>
                          <p className="text-xs text-pink-300 font-medium">
                            S{item.season} E{item.episode}
                            {!item.is_continue && (
                              <span className="text-gray-400 ml-1">• Ready to watch</span>
                            )}
                          </p>
                          
                          {/* Progress bar for continued items */}
                          {item.is_continue && item.progress > 0 && (
                            <>
                              <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
                                <motion.div
                                  className="h-full bg-gradient-to-r from-pink-500 to-violet-500 rounded-full"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${item.progress}%` }}
                                  transition={{ duration: 0.5, delay: index * 0.05 }}
                                />
                              </div>
                              <p className="text-xs text-gray-400 mt-1">
                                {Math.round(item.progress)}% watched
                              </p>
                            </>
                          )}
                        </div>
                        
                        {/* Play overlay */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
                          <motion.div 
                            className="w-14 h-14 rounded-full bg-gradient-to-r from-pink-600 to-violet-600 flex items-center justify-center shadow-xl"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Play className="w-6 h-6 text-white fill-white ml-1" />
                          </motion.div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}

        {/* Trending This Week */}
        <MediaRow
          title={
            <span className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-pink-500" />
              Trending This Week
            </span>
          }
          items={trending}
          onAddToWatchlist={handleAddToWatchlist}
          watchlist={watchlist}
          loading={loading}
        />

        {/* Now Playing in Theaters */}
        <MediaRow
          title="Now Playing in Theaters"
          items={nowPlaying}
          onAddToWatchlist={handleAddToWatchlist}
          watchlist={watchlist}
          loading={loading}
        />

        {/* Currently Airing TV Shows */}
        <MediaRow
          title="Currently Airing TV Shows"
          items={onTheAir}
          onAddToWatchlist={handleAddToWatchlist}
          watchlist={watchlist}
          loading={loading}
        />

        {/* My Watchlist */}
        {watchlist.length > 0 && (
          <section data-testid="watchlist-section" className="py-6 px-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">My Watchlist</h2>
              {watchlist.length > 8 && (
                <Link 
                  to="/watchlist" 
                  className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1"
                >
                  View All ({watchlist.length}) <ChevronRight className="w-4 h-4" />
                </Link>
              )}
            </div>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
              {watchlist.slice(0, 8).map((item, index) => (
                <motion.div
                  key={item.id || `watchlist-${item.tmdb_id}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <Link
                    to={`/${item.media_type}/${item.tmdb_id}`}
                    data-testid={`watchlist-${item.tmdb_id}`}
                    className="aspect-[2/3] rounded-xl overflow-hidden media-card block relative group"
                  >
                    {item.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
                        alt={item.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-violet-900/50 to-pink-900/50 flex items-center justify-center">
                        <span className="text-3xl text-gray-500">{item.title?.charAt(0)}</span>
                      </div>
                    )}
                    {/* Hover overlay with title */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                      <p className="text-xs font-medium line-clamp-2">{item.title}</p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Empty State - No Content */}
        {!loading && continueWatching.length === 0 && watchlist.length === 0 && (
          <section className="py-12 px-8">
            <div className="glass-card rounded-xl p-8 text-center max-w-lg mx-auto">
              <Sparkles className="w-12 h-12 text-violet-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Welcome to WatchNexus!</h3>
              <p className="text-gray-400 mb-6">
                Start by exploring trending content or adding items to your watchlist.
                Your watch history will appear here.
              </p>
              <Link 
                to="/discover"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-pink-600 rounded-lg font-medium hover:from-violet-500 hover:to-pink-500 transition-all"
              >
                <TrendingUp className="w-5 h-5" />
                Discover Content
              </Link>
            </div>
          </section>
        )}

        {/* Bottom Padding */}
        <div className="h-12" />
      </div>
    </Layout>
  );
};
