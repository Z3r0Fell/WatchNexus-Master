import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Film, Tv, Star, Calendar, TrendingUp, Loader2, RefreshCw, Plus } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { Layout } from '../components/layout/Layout';
import axios from 'axios';
import { BACKEND_URL , tmdbImageUrl} from '../lib/config';

const API = BACKEND_URL;

const SagePage = () => {
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState({});

  const fetchRecs = useCallback(async () => {
    setLoading(true);
    try { const res = await axios.get(`${API}/api/sage/recommendations?limit=24`); setRecs(res.data.recommendations || []); } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRecs(); }, [fetchRecs]);

  const handleRequest = async (item) => {
    setRequesting(p => ({ ...p, [item.id]: true }));
    try {
      await axios.post(`${API}/api/menu/requests`, { media_type: item.media_type || 'movie', tmdb_id: item.id, title: item.title, poster_path: item.poster_path, overview: item.overview, vote_average: item.vote_average });
      toast.success(`'${item.title}' requested!`);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setRequesting(p => ({ ...p, [item.id]: false })); }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6" data-testid="sage-page">
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-bold text-white flex items-center gap-3"><Sparkles className="w-8 h-8 text-amber-400" /> For You</h1><p className="text-gray-400 text-sm mt-1">AI-powered recommendations based on your watch history</p></div>
          <Button variant="ghost" size="sm" onClick={fetchRecs}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
        </div>

        {loading ? <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-amber-400" /></div> : recs.length === 0 ? (
          <div className="text-center py-20 text-gray-500"><Sparkles className="w-16 h-16 mx-auto mb-4 opacity-20" /><p>No recommendations yet — start watching to build your profile!</p></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {recs.map(item => {
              const posterUrl = item.poster_path ? tmdbImageUrl(item.poster_path, 'w300') : null;
              return (
                <motion.div key={item.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="group relative rounded-xl overflow-hidden bg-white/[0.03] border border-white/5 hover:border-amber-500/40 transition-all">
                  {posterUrl ? <img src={posterUrl} alt={item.title} className="w-full aspect-[2/3] object-cover" loading="lazy" /> : <div className="w-full aspect-[2/3] bg-white/5 flex items-center justify-center"><Film className="w-8 h-8 text-gray-700" /></div>}
                  <div className="absolute top-2 left-2"><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.media_type === 'tv' ? 'bg-cyan-500/80' : 'bg-violet-500/80'} text-white`}>{item.media_type === 'tv' ? 'TV' : 'MOVIE'}</span></div>
                  {item.vote_average > 0 && <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-black/70 backdrop-blur px-1.5 py-0.5 rounded text-xs"><Star className="w-3 h-3 text-amber-400 fill-amber-400" /><span className="text-white font-medium">{item.vote_average.toFixed(1)}</span></div>}
                  <div className="absolute bottom-0 left-0 right-0 px-2 py-1"><span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">{item.reason === 'trending' ? 'Trending' : 'Top Rated'}</span></div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                    <p className="text-white text-sm font-semibold truncate">{item.title}</p>
                    {item.overview && <p className="text-gray-400 text-[11px] mt-1 line-clamp-2">{item.overview}</p>}
                    <Button size="sm" className="mt-2 bg-amber-600 hover:bg-amber-700 text-xs h-7 w-full" onClick={() => handleRequest(item)} disabled={requesting[item.id]}>
                      {requesting[item.id] ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />} Request
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SagePage;
