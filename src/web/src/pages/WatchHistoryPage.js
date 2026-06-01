import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { Clock, Play, Trash2, Film, Tv } from 'lucide-react';
import { progressApi } from '../services/api';
import { toast } from 'sonner';

export const WatchHistoryPage = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await progressApi.get();
      // Sort by updated_at descending (matches API response field)
      const sorted = (res.data || []).sort((a, b) => 
        new Date(b.updated_at) - new Date(a.updated_at)
      );
      setHistory(sorted);
    } catch (error) {
      console.error('Failed to fetch watch history:', error);
        toast.error('Failed to fetch watch history:');
    } finally {
      setLoading(false);
    }
  };

  const formatProgress = (progress) => {
    if (!progress) return '0%';
    return `${Math.round(progress)}%`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
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
      <div data-testid="watch-history-page" className="min-h-screen p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center">
              <Clock className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Watch History</h1>
              <p className="text-gray-400">Your viewing history across all content</p>
            </div>
          </div>

          {/* History List */}
          {history.length === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <Clock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">No Watch History</h3>
              <p className="text-gray-400 mb-6">Start watching something to build your history</p>
              <Link 
                to="/movies" 
                className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 rounded-lg font-medium transition-colors"
              >
                <Play className="w-5 h-5" /> Browse Movies
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((item, index) => (
                <motion.div
                  key={`${item.tmdb_id}-${item.season || ''}-${item.episode || ''}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="glass-card rounded-xl overflow-hidden"
                >
                  <Link 
                    to={`/${item.media_type}/${item.tmdb_id}`}
                    className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors"
                    data-testid={`history-item-${item.tmdb_id}`}
                  >
                    {/* Poster */}
                    <div className="w-16 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800">
                      {item.poster_path ? (
                        <img 
                          src={`https://image.tmdb.org/t/p/w154${item.poster_path}`} 
                          alt={item.title} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {item.media_type === 'tv' ? <Tv className="w-6 h-6 text-gray-600" /> : <Film className="w-6 h-6 text-gray-600" />}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{item.title}</h3>
                      {item.season && item.episode && (
                        <p className="text-sm text-gray-400">
                          Season {item.season}, Episode {item.episode}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(item.updated_at)}
                      </p>
                    </div>

                    {/* Progress */}
                    <div className="text-right">
                      <p className="text-sm font-medium text-violet-400">{formatProgress(item.progress)}</p>
                      <div className="w-24 h-1.5 bg-gray-700 rounded-full mt-2 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-violet-600 to-pink-600 rounded-full"
                          style={{ width: `${item.progress || 0}%` }}
                        />
                      </div>
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

export default WatchHistoryPage;
