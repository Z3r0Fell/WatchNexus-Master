import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { marmaladeLibrary, marmaladeMedia, marmaladeStream, formatDuration } from '../services/marmaladeApi';
import { toast } from 'sonner';
import { 
  BookOpen, Play, Pause, Plus, RefreshCw, Search, 
  Clock, SkipForward, SkipBack, Volume2, Bookmark,
  User, FolderOpen, Headphones, FastForward, Rewind
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { formatFileSize } from '../lib/utils';

export const AudiobooksPage = () => {
  const [libraries, setLibraries] = useState([]);
  const [audiobooks, setAudiobooks] = useState([]);
  const [recentBooks, setRecentBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [scanning, setScanning] = useState({});
  
  // Audio player state
  const [currentBook, setCurrentBook] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  
  // Show add library form
  const [showAddLibrary, setShowAddLibrary] = useState(false);
  const [newLibrary, setNewLibrary] = useState({ name: '', path: '' });

  const fetchData = useCallback(async () => {
    try {
      const [librariesRes, mediaRes, recentRes] = await Promise.all([
        marmaladeLibrary.getLibraries(),
        marmaladeMedia.getMedia({ media_type: 'audiobook', limit: 100 }),
        marmaladeMedia.getRecent(20),
      ]);
      
      // Filter for audiobook libraries only
      const audiobookLibraries = (librariesRes.data || []).filter(lib => lib.media_type === 'audiobooks');
      setLibraries(audiobookLibraries);
      setAudiobooks(mediaRes.data || []);
      
      // Filter recent for audiobooks only
      const recentAudiobooks = (recentRes.data || []).filter(m => m.media_type === 'audiobook');
      setRecentBooks(recentAudiobooks.slice(0, 8));
    } catch (error) {
      console.error('Failed to fetch audiobook data:', error);
        toast.error('Failed to fetch audiobook data:');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    
    // Create audio element for playback
    const audio = new Audio();
    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
    });
    audio.addEventListener('ended', () => {
      setIsPlaying(false);
    });
    setAudioElement(audio);
    
    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [fetchData]);

  const handleAddLibrary = async () => {
    if (!newLibrary.name || !newLibrary.path) {
      toast.error('Please enter library name and path');
      return;
    }
    
    try {
      const addRes = await marmaladeLibrary.addLibrary(newLibrary.name, newLibrary.path, 'audiobooks');
      toast.success(`Audiobook library "${newLibrary.name}" added`);
      setNewLibrary({ name: '', path: '' });
      setShowAddLibrary(false);
      await fetchData();
      
      // Auto-scan
      if (addRes?.data?.id) {
        handleScanLibrary(addRes.data.id);
      }
    } catch (error) {
      toast.error('Failed to add library');
    }
  };

  const handleScanLibrary = async (libraryId) => {
    setScanning(prev => ({ ...prev, [libraryId]: true }));
    try {
      const res = await marmaladeLibrary.scanLibrary(libraryId);
      toast.success(`Scan complete: ${res.data.new} new audiobooks found`);
      fetchData();
    } catch (error) {
      toast.error('Scan failed');
    } finally {
      setScanning(prev => ({ ...prev, [libraryId]: false }));
    }
  };

  const playAudiobook = (book) => {
    if (!audioElement) return;
    
    const streamUrl = marmaladeStream.getStreamUrl(book.id);
    audioElement.src = streamUrl;
    audioElement.playbackRate = playbackRate;
    audioElement.play();
    setCurrentBook(book);
    setIsPlaying(true);
  };

  const togglePlayPause = () => {
    if (!audioElement || !currentBook) return;
    
    if (isPlaying) {
      audioElement.pause();
    } else {
      audioElement.play();
    }
    setIsPlaying(!isPlaying);
  };

  const skipForward = (seconds = 30) => {
    if (audioElement) {
      audioElement.currentTime = Math.min(audioElement.currentTime + seconds, audioElement.duration || 0);
    }
  };

  const skipBackward = (seconds = 30) => {
    if (audioElement) {
      audioElement.currentTime = Math.max(audioElement.currentTime - seconds, 0);
    }
  };

  const changePlaybackRate = () => {
    const rates = [0.75, 1, 1.25, 1.5, 1.75, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (audioElement) {
      audioElement.playbackRate = nextRate;
    }
  };

  const filteredBooks = audiobooks.filter(book => 
    book.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    book.series_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const hasNoLibraries = libraries.length === 0;
  const hasNoBooks = audiobooks.length === 0 && !loading;

  return (
    <Layout>
      <div data-testid="audiobooks-page" className="min-h-screen p-8 pb-32">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-600 to-yellow-500 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Audiobooks</h1>
                <p className="text-gray-400">
                  {audiobooks.length} audiobooks in {libraries.length} {libraries.length === 1 ? 'library' : 'libraries'}
                </p>
              </div>
            </div>
            
            <Button
              onClick={() => setShowAddLibrary(!showAddLibrary)}
              className="bg-amber-600 hover:bg-amber-700"
              data-testid="add-audiobook-library-btn"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Audiobook Library
            </Button>
          </div>

          {/* Add Library Form */}
          {showAddLibrary && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="glass-card rounded-xl p-4 mb-6"
            >
              <h3 className="font-semibold mb-3">Add Audiobook Library</h3>
              <div className="flex gap-3">
                <Input
                  placeholder="Library Name (e.g., My Audiobooks)"
                  value={newLibrary.name}
                  onChange={(e) => setNewLibrary(prev => ({ ...prev, name: e.target.value }))}
                  className="bg-white/5 border-white/10"
                />
                <Input
                  placeholder="Path (e.g., /home/user/Audiobooks)"
                  value={newLibrary.path}
                  onChange={(e) => setNewLibrary(prev => ({ ...prev, path: e.target.value }))}
                  className="bg-white/5 border-white/10 flex-1"
                />
                <Button onClick={handleAddLibrary} className="bg-green-600 hover:bg-green-700">
                  Add & Scan
                </Button>
              </div>
            </motion.div>
          )}

          {/* Search */}
          {!hasNoBooks && (
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Search audiobooks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/5 border-white/10"
              />
            </div>
          )}
        </motion.div>

        {/* Empty State */}
        {hasNoLibraries && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div className="w-24 h-24 rounded-full bg-amber-600/20 flex items-center justify-center mb-6">
              <FolderOpen className="w-12 h-12 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold mb-2">No Audiobook Libraries</h2>
            <p className="text-gray-400 text-center max-w-md mb-6">
              Add an audiobook library to start listening. 
              Supported formats: MP3, M4A, M4B, FLAC, WAV, AAC, OGG
            </p>
            <Button
              onClick={() => setShowAddLibrary(true)}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Your First Library
            </Button>
          </motion.div>
        )}

        {/* Libraries Section */}
        {libraries.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Headphones className="w-5 h-5 text-amber-400" /> Your Libraries
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {libraries.map(lib => (
                <div key={lib.id} className="glass-card rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{lib.name}</h3>
                      <p className="text-sm text-gray-400">{lib.item_count} audiobooks</p>
                      <p className="text-xs text-gray-500 truncate max-w-[200px]">{lib.path}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleScanLibrary(lib.id)}
                      disabled={scanning[lib.id]}
                    >
                      <RefreshCw className={`w-4 h-4 ${scanning[lib.id] ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recently Added */}
        {recentBooks.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" /> Recently Added
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {recentBooks.map(book => (
                <button
                  key={book.id}
                  onClick={() => playAudiobook(book)}
                  className={`p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-left ${
                    currentBook?.id === book.id ? 'ring-2 ring-amber-500' : ''
                  }`}
                >
                  <div className="w-full aspect-square rounded-lg bg-gradient-to-br from-amber-600/30 to-yellow-500/30 flex items-center justify-center mb-3">
                    {book.poster_url ? (
                      <img src={book.poster_url} alt={book.title} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <BookOpen className="w-12 h-12 text-amber-400" />
                    )}
                  </div>
                  <p className="font-medium truncate">{book.title}</p>
                  <p className="text-sm text-gray-400">{formatDuration(book.duration)}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* All Audiobooks Grid */}
        {filteredBooks.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-400" /> All Audiobooks ({filteredBooks.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredBooks.map((book) => (
                <button
                  key={book.id}
                  onClick={() => playAudiobook(book)}
                  className={`group relative rounded-xl overflow-hidden bg-white/5 hover:bg-white/10 transition-all ${
                    currentBook?.id === book.id ? 'ring-2 ring-amber-500' : ''
                  }`}
                >
                  <div className="aspect-square bg-gradient-to-br from-amber-600/30 to-yellow-500/30 flex items-center justify-center">
                    {book.poster_url ? (
                      <img src={book.poster_url} alt={book.title} className="w-full h-full object-cover" />
                    ) : (
                      <BookOpen className="w-16 h-16 text-amber-400" />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="w-12 h-12 text-white" />
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="font-medium truncate text-sm">{book.title}</p>
                    <p className="text-xs text-gray-400">{formatDuration(book.duration)}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(book.size)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Now Playing Bar */}
        {currentBook && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="fixed bottom-0 left-0 right-0 bg-[#1a1a1a] border-t border-white/10 p-4"
          >
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-600 to-yellow-500 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-medium">{currentBook.title}</p>
                  <p className="text-sm text-gray-400">
                    {formatDuration(currentTime)} / {formatDuration(currentBook.duration)}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => skipBackward(30)} title="Back 30s">
                  <Rewind className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => skipBackward(10)} title="Back 10s">
                  <SkipBack className="w-4 h-4" />
                </Button>
                <Button 
                  onClick={togglePlayPause}
                  className="w-12 h-12 rounded-full bg-amber-600 hover:bg-amber-700"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => skipForward(10)} title="Forward 10s">
                  <SkipForward className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => skipForward(30)} title="Forward 30s">
                  <FastForward className="w-5 h-5" />
                </Button>
              </div>
              
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  onClick={changePlaybackRate}
                  className="text-sm font-mono"
                  title="Change playback speed"
                >
                  {playbackRate}x
                </Button>
                <Button variant="ghost" size="icon" title="Bookmark">
                  <Bookmark className="w-5 h-5 text-gray-400" />
                </Button>
                <Button variant="ghost" size="icon">
                  <Volume2 className="w-5 h-5 text-gray-400" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        )}
      </div>
    </Layout>
  );
};
