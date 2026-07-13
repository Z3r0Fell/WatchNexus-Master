import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Video, Play, Pause, Bookmark, Clock, User, Eye, Search, X, ExternalLink, BookmarkPlus, History } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

export const WebVideoPage = () => {
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [streamUrl, setStreamUrl] = useState('');
  const [bookmarks, setBookmarks] = useState([]);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('search');
  const videoRef = useRef(null);

  const getAuth = () => ({}); // Cookie auth: wn_token sent automatically

  const searchVideo = async () => {
    if (!url.trim()) return toast.error('Enter a video URL');
    try {
      setLoading(true);
      setVideoInfo(null);
      setStreamUrl('');
      const resp = await axios.get(`${BACKEND_URL}/api/gadgets/webvideo/info`, { params: { url }, headers: getAuth() });
      setVideoInfo(resp.data);
      setActiveTab('player');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to extract video');
    } finally {
      setLoading(false);
    }
  };

  const playVideo = async (formatId = 'best') => {
    try {
      setLoading(true);
      const resp = await axios.get(`${BACKEND_URL}/api/gadgets/webvideo/stream`, { params: { url, format_id: formatId }, headers: getAuth() });
      setStreamUrl(resp.data.stream_url);
      setPlaying(true);
      
      // Add to history
      if (videoInfo) {
        axios.post(`${BACKEND_URL}/api/gadgets/webvideo/history`, {
          video_id: videoInfo.id, url, title: videoInfo.title, thumbnail: videoInfo.thumbnail, duration: videoInfo.duration
        }, { headers: getAuth() }).catch(() => {});
      }
    } catch (err) {
      toast.error('Failed to get stream');
    } finally {
      setLoading(false);
    }
  };

  const loadBookmarks = async () => {
    try {
      const resp = await axios.get(`${BACKEND_URL}/api/gadgets/webvideo/bookmarks`, { headers: getAuth() });
      setBookmarks(resp.data.bookmarks || []);
    } catch (err) {
      toast.error('Failed to load bookmarks');
    }
  };

  const loadHistory = async () => {
    try {
      const resp = await axios.get(`${BACKEND_URL}/api/gadgets/webvideo/history`, { headers: getAuth() });
      setHistory(resp.data.history || []);
    } catch (err) {
      toast.error('Failed to load history');
    }
  };

  const addBookmark = async () => {
    if (!videoInfo) return;
    try {
      await axios.post(`${BACKEND_URL}/api/gadgets/webvideo/bookmarks`, {
        video_id: videoInfo.id, url, title: videoInfo.title, thumbnail: videoInfo.thumbnail, duration: videoInfo.duration
      }, { headers: getAuth() });
      toast.success('Bookmarked');
      loadBookmarks();
    } catch (err) {
      toast.error('Failed to bookmark');
    }
  };

  const removeBookmark = async (videoId) => {
    try {
      await axios.delete(`${BACKEND_URL}/api/gadgets/webvideo/bookmarks/${videoId}`, { headers: getAuth() });
      toast.success('Removed');
      setBookmarks(b => b.filter(v => v.video_id !== videoId));
    } catch (err) {
      toast.error('Failed to remove');
    }
  };

  const playFromList = (item) => {
    setUrl(item.url);
    setVideoInfo({
      id: item.video_id, title: item.title, thumbnail: item.thumbnail, duration: item.duration
    });
    setActiveTab('player');
  };

  const formatDuration = (s) => {
    if (!s) return '';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <Layout>
      <div data-testid="webvideo-page" className="min-h-screen p-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
                <Video className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Web Video</h1>
                <p className="text-gray-400">Stream videos from the web</p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="flex gap-3 mt-6">
            <Input placeholder="Paste video URL (YouTube, Vimeo, etc.)" value={url} onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchVideo()}
              className="bg-white/5 border-white/10 flex-1" data-testid="webvideo-url" />
            <Button onClick={searchVideo} disabled={loading} className="bg-red-600 hover:bg-red-700">
              {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            <Button variant={activeTab === 'search' ? 'default' : 'ghost'} size="sm"
              onClick={() => setActiveTab('search')} className={activeTab === 'search' ? 'bg-red-600' : ''}>
              <Search className="w-4 h-4 mr-1" /> Search
            </Button>
            <Button variant={activeTab === 'player' ? 'default' : 'ghost'} size="sm"
              onClick={() => setActiveTab('player')} className={activeTab === 'player' ? 'bg-red-600' : ''} disabled={!videoInfo}>
              <Play className="w-4 h-4 mr-1" /> Player
            </Button>
            <Button variant={activeTab === 'bookmarks' ? 'default' : 'ghost'} size="sm"
              onClick={() => { setActiveTab('bookmarks'); loadBookmarks(); }} className={activeTab === 'bookmarks' ? 'bg-red-600' : ''}>
              <Bookmark className="w-4 h-4 mr-1" /> Bookmarks
            </Button>
            <Button variant={activeTab === 'history' ? 'default' : 'ghost'} size="sm"
              onClick={() => { setActiveTab('history'); loadHistory(); }} className={activeTab === 'history' ? 'bg-red-600' : ''}>
              <History className="w-4 h-4 mr-1" /> History
            </Button>
          </div>
        </motion.div>

        {/* Content */}
        {activeTab === 'search' && !videoInfo && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 rounded-full bg-red-600/20 flex items-center justify-center mb-6">
              <Video className="w-12 h-12 text-red-400" />
            </div>
            <h2 className="text-xl font-bold mb-2">Stream Web Videos</h2>
            <p className="text-gray-400 text-center max-w-md mb-4">
              Paste a video URL from YouTube, Vimeo, Twitter, and 1000+ other sites.
            </p>
            <p className="text-xs text-gray-500">Powered by yt-dlp</p>
          </div>
        )}

        {(activeTab === 'player' || activeTab === 'search') && videoInfo && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Video Player */}
            <div className="aspect-video bg-black rounded-xl overflow-hidden relative">
              {streamUrl ? (
                <video ref={videoRef} src={streamUrl} controls autoPlay className="w-full h-full"
                  onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  {videoInfo.thumbnail && <img src={videoInfo.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />}
                  <div className="relative z-10 text-center">
                    <Button size="lg" onClick={() => playVideo()} disabled={loading}
                      className="bg-red-600 hover:bg-red-700 rounded-full w-20 h-20 mb-4">
                      {loading ? <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" /> : <Play className="w-10 h-10" />}
                    </Button>
                    <p className="text-white font-medium">Click to play</p>
                  </div>
                </div>
              )}
            </div>

            {/* Video Info */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold line-clamp-2">{videoInfo.title}</h2>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                    {videoInfo.uploader && (
                      <span className="flex items-center gap-1"><User className="w-4 h-4" /> {videoInfo.uploader}</span>
                    )}
                    {videoInfo.duration && (
                      <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {formatDuration(videoInfo.duration)}</span>
                    )}
                    {videoInfo.view_count && (
                      <span className="flex items-center gap-1"><Eye className="w-4 h-4" /> {(videoInfo.view_count / 1000000).toFixed(1)}M views</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={addBookmark}>
                    <BookmarkPlus className="w-4 h-4 mr-1" /> Bookmark
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.open(url, '_blank')}>
                    <ExternalLink className="w-4 h-4 mr-1" /> Source
                  </Button>
                </div>
              </div>
              {videoInfo.description && (
                <p className="text-gray-400 text-sm mt-4 line-clamp-3">{videoInfo.description}</p>
              )}

              {/* Quality Selector */}
              {videoInfo.formats?.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Quality</h4>
                  <div className="flex flex-wrap gap-2">
                    {videoInfo.formats.map((f, i) => (
                      <Button key={i} variant="outline" size="sm" onClick={() => playVideo(f.format_id)}>
                        {f.resolution} ({f.ext})
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'bookmarks' && (
          <div className="space-y-4">
            {bookmarks.length === 0 ? (
              <div className="text-center py-20">
                <Bookmark className="w-16 h-16 mx-auto text-gray-600 mb-4" />
                <h2 className="text-xl font-bold mb-2">No Bookmarks</h2>
                <p className="text-gray-400">Save videos to watch later.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bookmarks.map((item) => (
                  <motion.div key={item.id} whileHover={{ scale: 1.02 }}
                    className="glass-card rounded-xl overflow-hidden cursor-pointer group"
                    onClick={() => playFromList(item)}>
                    <div className="aspect-video relative">
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                          <Video className="w-12 h-12 text-gray-600" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="w-12 h-12 text-white" />
                      </div>
                      {item.duration && (
                        <span className="absolute bottom-2 right-2 bg-black/80 text-xs px-2 py-1 rounded">{formatDuration(item.duration)}</span>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-medium line-clamp-2">{item.title}</h3>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-gray-500">{new Date(item.added_at).toLocaleDateString()}</span>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); removeBookmark(item.video_id); }}
                          className="text-red-400 hover:text-red-300">
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            {history.length === 0 ? (
              <div className="text-center py-20">
                <History className="w-16 h-16 mx-auto text-gray-600 mb-4" />
                <h2 className="text-xl font-bold mb-2">No History</h2>
                <p className="text-gray-400">Videos you watch will appear here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {history.map((item) => (
                  <motion.div key={item.id} whileHover={{ scale: 1.02 }}
                    className="glass-card rounded-xl overflow-hidden cursor-pointer group"
                    onClick={() => playFromList(item)}>
                    <div className="aspect-video relative">
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                          <Video className="w-12 h-12 text-gray-600" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="w-12 h-12 text-white" />
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-medium line-clamp-2">{item.title}</h3>
                      <span className="text-xs text-gray-500">{new Date(item.watched_at).toLocaleString()}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default WebVideoPage;
