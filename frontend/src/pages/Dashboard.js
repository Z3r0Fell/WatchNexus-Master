import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { HeroBanner } from '../components/media/HeroBanner';
import { MediaRow } from '../components/media/MediaRow';
import { tmdbApi, watchlistApi, progressApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Play, Clock, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatTime, getTitle, getMediaType } from '../lib/utils';

export const Dashboard = () => {
  const { user } = useAuth();
  const [trending, setTrending] = useState([]);
  const [nowPlaying, setNowPlaying] = useState([]);
  const [onTheAir, setOnTheAir] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [continueWatching, setContinueWatching] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [trendingRes, nowPlayingRes, onTheAirRes, watchlistRes, progressRes] = await Promise.all([
        tmdbApi.getTrending('all', 'week'),
        tmdbApi.getNowPlaying(),
        tmdbApi.getOnTheAir(),
        watchlistApi.get().catch(() => ({ data: [] })),
        progressApi.get().catch(() => ({ data: [] })),
      ]);

      setTrending(trendingRes.data.results || []);
      setNowPlaying(nowPlayingRes.data.results || []);
      setOnTheAir(onTheAirRes.data.results || []);
      setWatchlist(watchlistRes.data || []);
      setContinueWatching(progressRes.data || []);
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

  return (
    <Layout>
      <div data-testid="dashboard" className="min-h-screen">
        {/* Hero Banner */}
        <HeroBanner items={trending.slice(0, 5)} />

        {/* Continue Watching */}
        {continueWatching.length > 0 && (
          <section className="py-6 px-8">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-violet-400" />
              Continue Watching
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {continueWatching.slice(0, 5).map((item) => (
                <Link
                  key={item.id}
                  to={`/${item.media_type}/${item.tmdb_id}`}
                  data-testid={`continue-${item.tmdb_id}`}
                  className="relative group rounded-xl overflow-hidden glass-card hover:ring-2 hover:ring-violet-500/50 transition-all"
                >
                  <div className="aspect-video relative">
                    {item.backdrop_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w500${item.backdrop_path}`}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-surface flex items-center justify-center">
                        <span className="text-2xl text-gray-600">{item.title?.charAt(0)}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="font-medium text-sm line-clamp-1">{item.title}</p>
                      {item.season && item.episode && (
                        <p className="text-xs text-gray-400">S{item.season} E{item.episode}</p>
                      )}
                      {/* Progress bar */}
                      <div className="mt-2 h-1 bg-white/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-violet-500 rounded-full"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatTime(item.current_time)} / {formatTime(item.duration)}
                      </p>
                    </div>
                    {/* Play overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-12 h-12 rounded-full bg-violet-600 flex items-center justify-center shadow-lg">
                        <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
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
          <section className="py-6 px-8">
            <h2 className="text-xl font-bold mb-4">My Watchlist</h2>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
              {watchlist.slice(0, 8).map((item) => (
                <Link
                  key={item.id}
                  to={`/${item.media_type}/${item.tmdb_id}`}
                  className="aspect-[2/3] rounded-xl overflow-hidden media-card"
                >
                  {item.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-surface flex items-center justify-center">
                      <span className="text-2xl text-gray-600">{item.title?.charAt(0)}</span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Bottom Padding */}
        <div className="h-12" />
      </div>
    </Layout>
  );
};
