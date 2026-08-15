import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../../components/layout/Layout';
import axios from 'axios';
import { BACKEND_URL } from '../../lib/config';
import { toast } from 'sonner';
import { BarChart3, Clock, Film, Tv, TrendingUp, Calendar, PlayCircle, Activity } from 'lucide-react';
import { Button } from '../../components/ui/button';

const API = BACKEND_URL;
const headers = { 'Content-Type': 'application/json' };

const StatCard = ({ icon: Icon, label, value, color, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="glass-card rounded-xl p-5"
    data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}
  >
    <div className="flex items-center gap-3 mb-2">
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <p className="text-sm text-gray-400">{label}</p>
    </div>
    <p className="text-2xl font-bold text-white">{value}</p>
  </motion.div>
);

export const AnalyticsPage = () => {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [period, setPeriod] = useState(30);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [statsRes, recentRes] = await Promise.all([
        axios.get(`${API}/api/truffle/stats?days=${period}`, { headers }),
        axios.get(`${API}/api/truffle/recent?limit=20`, { headers }),
      ]);
      setStats(statsRes.data);
      setRecent(recentRes.data);
    } catch (e) {
      console.error('Analytics fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, [period]);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6" data-testid="analytics-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Watch Analytics</h1>
            <p className="text-gray-400 text-sm mt-1">Track your viewing habits and discover insights</p>
          </div>
          <div className="flex gap-2">
            {[7, 30, 90].map(d => (
              <Button
                key={d}
                variant={period === d ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriod(d)}
                data-testid={`period-${d}`}
              >
                {d}d
              </Button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="glass-card rounded-xl p-5 h-24 animate-pulse" />
            ))}
          </div>
        ) : stats && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={PlayCircle} label="Total Plays" value={stats.total_plays} color="bg-violet-600" delay={0} />
              <StatCard icon={Clock} label="Watch Hours" value={`${stats.total_watch_hours?.toFixed(1) ?? 0}h`} color="bg-blue-600" delay={0.05} />
              <StatCard icon={Film} label="Movies" value={stats.movies_watched} color="bg-pink-600" delay={0.1} />
              <StatCard icon={Tv} label="Episodes" value={stats.episodes_watched} color="bg-emerald-600" delay={0.15} />
            </div>

            {stats.top_genres && stats.top_genres.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-violet-400" /> Top Genres
                </h2>
                <div className="flex flex-wrap gap-2">
                  {stats.top_genres.map((g, i) => (
                    <span key={i} className="px-3 py-1.5 rounded-full bg-violet-600/20 text-violet-300 text-sm font-medium">
                      {typeof g === 'string' ? g : g.genre || g.name}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
          </>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" /> Recent Activity
          </h2>
          {recent.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No watch activity yet. Start watching something!</p>
          ) : (
            <div className="space-y-3">
              {recent.map((item, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-violet-600/20 flex items-center justify-center flex-shrink-0">
                    {item.media_type === 'tv' ? <Tv className="w-5 h-5 text-violet-400" /> : <Film className="w-5 h-5 text-violet-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">{item.title}</p>
                    <p className="text-gray-500 text-xs">{item.media_type} - {new Date(item.played_at || item.timestamp).toLocaleDateString()}</p>
                  </div>
                  <span className="text-xs text-gray-400">{item.duration_minutes ? `${item.duration_minutes}m` : ''}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </Layout>
  );
};

export default AnalyticsPage;
