import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { marmaladeLibrary, marmaladeMedia, marmaladeStream, formatDuration } from '../services/marmaladeApi';
import { toast } from 'sonner';
import { 
  Music, Play, Pause, Plus, RefreshCw, Search, 
  Clock, SkipForward, SkipBack, Volume2, Repeat, Shuffle,
  Disc, User, ListMusic, FolderOpen
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { formatFileSize } from '../lib/utils';

export const MusicPage = () => {
  const [libraries, setLibraries] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [recentTracks, setRecentTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [scanning, setScanning] = useState({});
  
  // Audio player state
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState(null);
  
  // Show add library form
  const [showAddLibrary, setShowAddLibrary] = useState(false);
  const [newLibrary, setNewLibrary] = useState({ name: '', path: '' });

  const fetchData = useCallback(async () => {
    try {
      const [librariesRes, mediaRes, recentRes] = await Promise.all([
        marmaladeLibrary.getLibraries(),
        marmaladeMedia.getMedia({ media_type: 'music', limit: 100 }),
        marmaladeMedia.getRecent(20),
      ]);
      
      // Filter for music libraries only
      const musicLibraries = (librariesRes.data || []).filter(lib => lib.media_type === 'music');
      setLibraries(musicLibraries);
      setTracks(mediaRes.data || []);
      
      // Filter recent for music only
      const recentMusic = (recentRes.data || []).filter(m => m.media_type === 'music');
      setRecentTracks(recentMusic.slice(0, 8));
    } catch (error) {
      console.error('Failed to fetch music data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    
    // Create audio element for playback
    const audio = new Audio();
    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      // Auto-play next track
      handleNextTrack();
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
      const addRes = await marmaladeLibrary.addLibrary(newLibrary.name, newLibrary.path, 'music');
      toast.success(`Music library "${newLibrary.name}" added`);
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
      toast.success(`Scan complete: ${res.data.new} new tracks found`);
      fetchData();
    } catch (error) {
      toast.error('Scan failed');
    } finally {
      setScanning(prev => ({ ...prev, [libraryId]: false }));
    }
  };

  const playTrack = (track) => {
    if (!audioElement) return;
    
    const streamUrl = marmaladeStream.getStreamUrl(track.id);
    audioElement.src = streamUrl;
    audioElement.play();
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  const togglePlayPause = () => {
    if (!audioElement || !currentTrack) return;
    
    if (isPlaying) {
      audioElement.pause();
    } else {
      audioElement.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleNextTrack = () => {
    if (!currentTrack || tracks.length === 0) return;
    const currentIndex = tracks.findIndex(t => t.id === currentTrack.id);
    const nextIndex = (currentIndex + 1) % tracks.length;
    playTrack(tracks[nextIndex]);
  };

  const handlePrevTrack = () => {
    if (!currentTrack || tracks.length === 0) return;
    const currentIndex = tracks.findIndex(t => t.id === currentTrack.id);
    const prevIndex = currentIndex === 0 ? tracks.length - 1 : currentIndex - 1;
    playTrack(tracks[prevIndex]);
  };

  const filteredTracks = tracks.filter(track => 
    track.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    track.series_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const hasNoLibraries = libraries.length === 0;
  const hasNoTracks = tracks.length === 0 && !loading;

  return (
    <Layout>
      <div data-testid="music-page" className="min-h-screen p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-600 to-orange-500 flex items-center justify-center">
                <Music className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Music</h1>
                <p className="text-gray-400">
                  {tracks.length} tracks in {libraries.length} {libraries.length === 1 ? 'library' : 'libraries'}
                </p>
              </div>
            </div>
            
            <Button
              onClick={() => setShowAddLibrary(!showAddLibrary)}
              className="bg-pink-600 hover:bg-pink-700"
              data-testid="add-music-library-btn"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Music Library
            </Button>
          </div>

          {/* Add Library Form */}
          {showAddLibrary && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="glass-card rounded-xl p-4 mb-6"
            >
              <h3 className="font-semibold mb-3">Add Music Library</h3>
              <div className="flex gap-3">
                <Input
                  placeholder="Library Name (e.g., My Music)"
                  value={newLibrary.name}
                  onChange={(e) => setNewLibrary(prev => ({ ...prev, name: e.target.value }))}
                  className="bg-white/5 border-white/10"
                />
                <Input
                  placeholder="Path (e.g., /home/user/Music)"
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
          {!hasNoTracks && (
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Search tracks..."
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
            <div className="w-24 h-24 rounded-full bg-pink-600/20 flex items-center justify-center mb-6">
              <FolderOpen className="w-12 h-12 text-pink-400" />
            </div>
            <h2 className="text-xl font-bold mb-2">No Music Libraries</h2>
            <p className="text-gray-400 text-center max-w-md mb-6">
              Add a music library to start streaming your collection. 
              Supported formats: MP3, FLAC, WAV, AAC, OGG, M4A, WMA
            </p>
            <Button
              onClick={() => setShowAddLibrary(true)}
              className="bg-pink-600 hover:bg-pink-700"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Your First Library
            </Button>
          </motion.div>
        )}

        {/* Libraries Section */}
        {libraries.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Disc className="w-5 h-5 text-pink-400" /> Your Libraries
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {libraries.map(lib => (
                <div key={lib.id} className="glass-card rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{lib.name}</h3>
                      <p className="text-sm text-gray-400">{lib.item_count} tracks</p>
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
        {recentTracks.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-pink-400" /> Recently Added
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {recentTracks.map(track => (
                <button
                  key={track.id}
                  onClick={() => playTrack(track)}
                  className={`p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-left ${
                    currentTrack?.id === track.id ? 'ring-2 ring-pink-500' : ''
                  }`}
                >
                  <div className="w-full aspect-square rounded-lg bg-gradient-to-br from-pink-600/30 to-orange-500/30 flex items-center justify-center mb-3">
                    {track.poster_url ? (
                      <img src={track.poster_url} alt={track.title} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <Music className="w-12 h-12 text-pink-400" />
                    )}
                  </div>
                  <p className="font-medium truncate">{track.title}</p>
                  <p className="text-sm text-gray-400">{formatDuration(track.duration)}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* All Tracks */}
        {filteredTracks.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ListMusic className="w-5 h-5 text-pink-400" /> All Tracks ({filteredTracks.length})
            </h2>
            <div className="glass-card rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="p-3 text-left text-sm text-gray-400">#</th>
                    <th className="p-3 text-left text-sm text-gray-400">Title</th>
                    <th className="p-3 text-left text-sm text-gray-400">Duration</th>
                    <th className="p-3 text-left text-sm text-gray-400">Size</th>
                    <th className="p-3 text-left text-sm text-gray-400">Format</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTracks.map((track, index) => (
                    <tr 
                      key={track.id}
                      onClick={() => playTrack(track)}
                      className={`cursor-pointer hover:bg-white/5 transition-colors ${
                        currentTrack?.id === track.id ? 'bg-pink-600/20' : ''
                      }`}
                    >
                      <td className="p-3">
                        {currentTrack?.id === track.id && isPlaying ? (
                          <div className="w-4 h-4 flex items-center justify-center">
                            <div className="flex gap-0.5">
                              <div className="w-1 h-3 bg-pink-500 animate-pulse" />
                              <div className="w-1 h-4 bg-pink-500 animate-pulse delay-75" />
                              <div className="w-1 h-2 bg-pink-500 animate-pulse delay-150" />
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-500">{index + 1}</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div>
                          <p className="font-medium">{track.title}</p>
                          {track.series_name && (
                            <p className="text-sm text-gray-400">{track.series_name}</p>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-gray-400">{formatDuration(track.duration)}</td>
                      <td className="p-3 text-gray-400">{formatFileSize(track.size)}</td>
                      <td className="p-3 text-gray-400 uppercase">{track.container || track.codec_audio}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Now Playing Bar */}
        {currentTrack && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="fixed bottom-0 left-0 right-0 bg-[#1a1a1a] border-t border-white/10 p-4"
          >
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-pink-600 to-orange-500 flex items-center justify-center">
                  <Music className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-medium">{currentTrack.title}</p>
                  <p className="text-sm text-gray-400">{formatDuration(currentTrack.duration)}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={handlePrevTrack}>
                  <SkipBack className="w-5 h-5" />
                </Button>
                <Button 
                  onClick={togglePlayPause}
                  className="w-12 h-12 rounded-full bg-pink-600 hover:bg-pink-700"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={handleNextTrack}>
                  <SkipForward className="w-5 h-5" />
                </Button>
              </div>
              
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon">
                  <Shuffle className="w-5 h-5 text-gray-400" />
                </Button>
                <Button variant="ghost" size="icon">
                  <Repeat className="w-5 h-5 text-gray-400" />
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
            <RefreshCw className="w-8 h-8 animate-spin text-pink-500" />
          </div>
        )}
      </div>
    </Layout>
  );
};
