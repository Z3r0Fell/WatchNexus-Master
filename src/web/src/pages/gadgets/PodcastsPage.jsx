import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Podcast, Plus, Play, Pause, RefreshCw, Trash2, Clock, Rss, ListPlus, ChevronLeft, SkipBack, SkipForward } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useConfirm } from '../../hooks/use-confirm';
import { BACKEND_URL } from '../../lib/config';

const API = BACKEND_URL;

export const PodcastsPage = () => {
  const { confirm, ConfirmDialog } = useConfirm();
  const [subscriptions, setSubscriptions] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [selectedPodcast, setSelectedPodcast] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [feedUrl, setFeedUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentEpisode, setCurrentEpisode] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  const getAuth = () => ({}); // Cookie auth: wn_token sent automatically

  const fetchSubscriptions = useCallback(async () => {
    try {
      setLoading(true);
      const resp = await axios.get(`${BACKEND_URL}/api/gadgets/podcasts`, { headers: getAuth() });
      setSubscriptions(resp.data.subscriptions || []);
    } catch (err) {
      toast.error('Failed to load podcasts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const subscribe = async () => {
    if (!feedUrl.trim()) return toast.error('Enter an RSS feed URL');
    try {
      const resp = await axios.post(`${BACKEND_URL}/api/gadgets/podcasts`, { feed_url: feedUrl }, { headers: getAuth() });
      toast.success(`Subscribed to ${resp.data.subscription?.title}`);
      setFeedUrl('');
      setShowAdd(false);
      fetchSubscriptions();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to subscribe');
    }
  };

  const unsubscribe = async (subId) => {
    const ok = await confirm({ title: 'Unsubscribe', description: 'Unsubscribe from this podcast?', confirmText: 'Unsubscribe' });
    if (!ok) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/gadgets/podcasts/${subId}`, { headers: getAuth() });
      toast.success('Unsubscribed');
      setSubscriptions(s => s.filter(p => p.id !== subId));
      if (selectedPodcast?.id === subId) {
        setSelectedPodcast(null);
        setEpisodes([]);
      }
    } catch (err) {
      toast.error('Failed to unsubscribe');
    }
  };

  const selectPodcast = async (podcast) => {
    setSelectedPodcast(podcast);
    try {
      const resp = await axios.get(`${BACKEND_URL}/api/gadgets/podcasts/${podcast.id}/episodes`, { headers: getAuth() });
      setEpisodes(resp.data.episodes || []);
    } catch (err) {
      toast.error('Failed to load episodes');
    }
  };

  const refreshPodcast = async (subId, e) => {
    e?.stopPropagation();
    try {
      const resp = await axios.post(`${BACKEND_URL}/api/gadgets/podcasts/${subId}/refresh`, {}, { headers: getAuth() });
      toast.success(`Found ${resp.data.new_episodes} new episodes`);
      if (selectedPodcast?.id === subId) selectPodcast(selectedPodcast);
    } catch (err) {
      toast.error('Failed to refresh');
    }
  };

  const playEpisode = (episode) => {
    setCurrentEpisode(episode);
    setIsPlaying(true);
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const seek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    if (audioRef.current) {
      audioRef.current.currentTime = pct * audioRef.current.duration;
    }
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const skip = (delta) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime + delta);
    }
  };

  return (
    <Layout>
      <div data-testid="podcasts-page" className="min-h-screen p-8 pb-32">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {selectedPodcast ? (
                <Button variant="ghost" onClick={() => { setSelectedPodcast(null); setEpisodes([]); }} className="mr-2">
                  <ChevronLeft className="w-5 h-5" />
                </Button>
              ) : null}
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
                <Podcast className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">{selectedPodcast ? selectedPodcast.title : 'Podcasts'}</h1>
                <p className="text-gray-400">{selectedPodcast ? `${episodes.length} episodes` : `${subscriptions.length} subscriptions`}</p>
              </div>
            </div>
            {!selectedPodcast && (
              <Button onClick={() => setShowAdd(!showAdd)} className="bg-orange-600 hover:bg-orange-700" data-testid="add-podcast">
                <Plus className="w-4 h-4 mr-2" /> Subscribe
              </Button>
            )}
            {selectedPodcast && (
              <Button variant="outline" size="sm" onClick={(e) => refreshPodcast(selectedPodcast.id, e)}>
                <RefreshCw className="w-4 h-4 mr-2" /> Refresh
              </Button>
            )}
          </div>

          {showAdd && !selectedPodcast && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-xl p-4 mt-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><Rss className="w-4 h-4" /> Add RSS Feed</h3>
              <div className="flex gap-3">
                <Input placeholder="https://example.com/feed.xml" value={feedUrl} onChange={e => setFeedUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && subscribe()}
                  className="bg-white/5 border-white/10 flex-1" data-testid="podcast-feed-input" />
                <Button onClick={subscribe} className="bg-green-600 hover:bg-green-700">Subscribe</Button>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !selectedPodcast ? (
          // Subscription List
          subscriptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-24 h-24 rounded-full bg-orange-600/20 flex items-center justify-center mb-6">
                <Podcast className="w-12 h-12 text-orange-400" />
              </div>
              <h2 className="text-xl font-bold mb-2">No Podcast Subscriptions</h2>
              <p className="text-gray-400 text-center max-w-md mb-6">Subscribe to your favorite podcasts via RSS feeds.</p>
              <Button onClick={() => setShowAdd(true)} className="bg-orange-600 hover:bg-orange-700">
                <Plus className="w-4 h-4 mr-2" /> Add Your First Podcast
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subscriptions.map((sub) => (
                <motion.div key={sub.id} whileHover={{ scale: 1.02 }}
                  className="glass-card rounded-xl overflow-hidden cursor-pointer group"
                  onClick={() => selectPodcast(sub)} data-testid={`podcast-${sub.id}`}>
                  <div className="flex gap-4 p-4">
                    {sub.image ? (
                      <img src={sub.image} alt="" className="w-20 h-20 rounded-lg object-cover" />
                    ) : (
                      <div className="w-20 h-20 rounded-lg bg-orange-600/30 flex items-center justify-center">
                        <Podcast className="w-8 h-8 text-orange-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{sub.title}</h3>
                      <p className="text-sm text-gray-400 truncate">{sub.author}</p>
                      <p className="text-xs text-gray-500 mt-1">{sub.episode_count} episodes</p>
                    </div>
                  </div>
                  <div className="px-4 pb-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" onClick={(e) => refreshPodcast(sub.id, e)}>
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); unsubscribe(sub.id); }} className="text-red-400 hover:text-red-300">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )
        ) : (
          // Episode List
          <div className="space-y-3">
            {episodes.map((ep) => (
              <motion.div key={ep.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className={`glass-card rounded-xl p-4 flex gap-4 ${currentEpisode?.id === ep.id ? 'ring-2 ring-orange-500' : ''}`}>
                {ep.image || selectedPodcast.image ? (
                  <img src={ep.image || selectedPodcast.image} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-orange-600/30 flex items-center justify-center flex-shrink-0">
                    <Podcast className="w-6 h-6 text-orange-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold line-clamp-1">{ep.title}</h3>
                  <p className="text-sm text-gray-400 line-clamp-2 mt-1">{ep.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    {ep.duration && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {Math.floor(ep.duration / 60)} min
                      </span>
                    )}
                    {ep.published && <span>{new Date(ep.published).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => playEpisode(ep)}
                    className={currentEpisode?.id === ep.id ? 'bg-orange-600' : 'bg-white/10 hover:bg-white/20'}>
                    {currentEpisode?.id === ep.id && isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Audio Player */}
        <AnimatePresence>
          {currentEpisode && (
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
              className="fixed bottom-0 left-0 right-0 bg-[#1a1a1a]/95 backdrop-blur-xl border-t border-white/10 p-4 z-50">
              <audio ref={audioRef} src={currentEpisode.audio_url} autoPlay onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)} />
              
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-4">
                  {currentEpisode.image || selectedPodcast?.image ? (
                    <img src={currentEpisode.image || selectedPodcast?.image} alt="" className="w-14 h-14 rounded-lg object-cover" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-orange-600/30 flex items-center justify-center">
                      <Podcast className="w-6 h-6 text-orange-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{currentEpisode.title}</p>
                    <p className="text-sm text-gray-400 truncate">{selectedPodcast?.title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => skip(-15)}>
                      <SkipBack className="w-5 h-5" />
                    </Button>
                    <Button size="lg" onClick={togglePlay} className="bg-orange-600 hover:bg-orange-700 rounded-full w-12 h-12">
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => skip(30)}>
                      <SkipForward className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-12">{formatTime(progress)}</span>
                  <div className="flex-1 h-1 bg-white/10 rounded-full cursor-pointer" onClick={seek}>
                    <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }} />
                  </div>
                  <span className="text-xs text-gray-400 w-12 text-right">{formatTime(duration)}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    <ConfirmDialog />
    </Layout>
  );
};

export default PodcastsPage;
