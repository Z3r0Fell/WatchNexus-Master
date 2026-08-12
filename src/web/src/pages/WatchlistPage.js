import { tmdbImageUrl } from '../lib/config';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { Bookmark, Film, Tv, Trash2, Plus } from 'lucide-react';
import { watchlistApi, tmdbApi } from '../services/api';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

export const WatchlistPage = () => {
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const fetchWatchlist = async () => {
    try {
      const res = await watchlistApi.get();
      setWatchlist(res.data || []);
    } catch (error) {
      console.error('Failed to fetch watchlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (e, tmdbId) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await watchlistApi.remove(tmdbId);
      setWatchlist(prev => prev.filter(item => item.tmdb_id !== tmdbId));
      toast.success('Removed from watchlist');
    } catch (error) {
      toast.error('Failed to remove from watchlist');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div data-testid="watchlist-page" className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center">
                <Bookmark className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">My Watchlist</h1>
                <p className="text-gray-400">{watchlist.length} items saved</p>
              </div>
            </div>
            <Link to="/movies">
              <Button className="bg-violet-600 hover:bg-violet-700">
                <Plus className="w-4 h-4 mr-2" /> Browse Movies
              </Button>
            </Link>
          </div>

          {/* Watchlist Grid */}
          {watchlist.length === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <Bookmark className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Your Watchlist is Empty</h3>
              <p className="text-gray-400 mb-6">Add movies and shows you want to watch later</p>
              <Link 
                to="/movies" 
                className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 rounded-lg font-medium transition-colors"
              >
                <Plus className="w-5 h-5" /> Browse Content
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {watchlist.map((item, index) => (
                <motion.div
                  key={item.tmdb_id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.03 }}
                  className="group"
                >
                  <Link 
                    to={`/${item.media_type}/${item.tmdb_id}`}
                    data-testid={`watchlist-item-${item.tmdb_id}`}
                    className="block relative aspect-[2/3] rounded-xl overflow-hidden media-card"
                  >
                    {item.poster_path ? (
                      <img 
                        src={tmdbImageUrl(item.poster_path, 'w342')} 
                        alt={item.title} 
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-violet-900/50 to-pink-900/50 flex items-center justify-center">
                        {item.media_type === 'tv' ? (
                          <Tv className="w-12 h-12 text-gray-600" />
                        ) : (
                          <Film className="w-12 h-12 text-gray-600" />
                        )}
                      </div>
                    )}

                    {/* Media Type Badge */}
                    <div className="absolute top-2 left-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        item.media_type === 'tv' ? 'bg-blue-500/80' : 'bg-violet-500/80'
                      }`}>
                        {item.media_type === 'tv' ? 'TV' : 'MOVIE'}
                      </span>
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={(e) => handleRemove(e, item.tmdb_id)}
                      className="absolute top-2 right-2 p-2 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                      data-testid={`remove-${item.tmdb_id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                      <p className="font-medium line-clamp-2">{item.title}</p>
                      {item.year && (
                        <p className="text-xs text-gray-400">{item.year}</p>
                      )}
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default WatchlistPage;
