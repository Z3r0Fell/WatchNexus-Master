import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { marmaladeStatus, marmaladeLibrary, marmaladeMedia } from '../services/marmaladeApi';
import { toast } from 'sonner';
import { 
  FolderOpen, Film, Tv, Music, Book, Plus, RefreshCw, 
  Trash2, Search, Play, Clock, HardDrive, Settings,
  CheckCircle, AlertTriangle, Eye
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { formatFileSize } from '../lib/utils';
import { Link } from 'react-router-dom';

const MEDIA_TYPE_ICONS = {
  movie: Film,
  episode: Tv,
  music: Music,
  audiobook: Book,
  unknown: FolderOpen,
};

const MEDIA_TYPE_COLORS = {
  movie: 'from-violet-600 to-purple-500',
  episode: 'from-blue-600 to-cyan-500',
  music: 'from-green-600 to-emerald-500',
  audiobook: 'from-orange-600 to-amber-500',
  unknown: 'from-gray-600 to-gray-500',
};

export const LibraryPage = () => {
  const [serverStatus, setServerStatus] = useState(null);
  const [libraries, setLibraries] = useState([]);
  const [media, setMedia] = useState([]);
  const [recentMedia, setRecentMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLibrary, setSelectedLibrary] = useState(null);
  
  // New library form
  const [showAddLibrary, setShowAddLibrary] = useState(false);
  const [newLibrary, setNewLibrary] = useState({ name: '', path: '', media_type: 'movies' });

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, librariesRes, recentRes] = await Promise.all([
        marmaladeStatus.getStatus(),
        marmaladeLibrary.getLibraries(),
        marmaladeMedia.getRecent(12),
      ]);
      
      setServerStatus(statusRes.data);
      setLibraries(librariesRes.data);
      setRecentMedia(recentRes.data);
    } catch (error) {
      console.error('Failed to fetch library data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMedia = useCallback(async (libraryId = null) => {
    try {
      const res = await marmaladeMedia.getMedia({ library_id: libraryId, limit: 100 });
      setMedia(res.data);
    } catch (error) {
      console.error('Failed to fetch media:', error);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchMedia();
  }, [fetchData, fetchMedia]);

  const handleAddLibrary = async () => {
    if (!newLibrary.name || !newLibrary.path) {
      toast.error('Please enter library name and path');
      return;
    }
    
    try {
      await marmaladeLibrary.addLibrary(newLibrary.name, newLibrary.path, newLibrary.media_type);
      toast.success(`Library "${newLibrary.name}" added`);
      setNewLibrary({ name: '', path: '', media_type: 'movies' });
      setShowAddLibrary(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to add library');
    }
  };

  const handleRemoveLibrary = async (libraryId, libraryName) => {
    if (!confirm(`Remove library "${libraryName}"? This will remove all media entries.`)) return;
    
    try {
      await marmaladeLibrary.removeLibrary(libraryId);
      toast.success(`Library "${libraryName}" removed`);
      fetchData();
    } catch (error) {
      toast.error('Failed to remove library');
    }
  };

  const handleScanLibrary = async (libraryId) => {
    setScanning(prev => ({ ...prev, [libraryId]: true }));
    
    try {
      const res = await marmaladeLibrary.scanLibrary(libraryId);
      toast.success(`Scan complete: ${res.data.new} new, ${res.data.updated} updated, ${res.data.removed} removed`);
      fetchData();
      fetchMedia(selectedLibrary);
    } catch (error) {
      toast.error('Scan failed');
    } finally {
      setScanning(prev => ({ ...prev, [libraryId]: false }));
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchMedia(selectedLibrary);
      return;
    }
    
    try {
      const res = await marmaladeMedia.search(searchQuery);
      setMedia(res.data);
    } catch (error) {
      toast.error('Search failed');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <Layout>
      <div data-testid="library-page" className="min-h-screen p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-600 to-orange-500 flex items-center justify-center">
                <FolderOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Library</h1>
                <p className="text-gray-400">Your media collection</p>
              </div>
            </div>

            {/* Server Status */}
            {serverStatus && (
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-2">
                  {serverStatus.status === 'running' ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  )}
                  <span className="text-gray-400">Marmalade</span>
                </div>
                <span className="text-gray-500">|</span>
                <span className="text-gray-400">{serverStatus.libraries} libraries</span>
                <span className="text-gray-500">|</span>
                <span className="text-gray-400">{serverStatus.media_files} files</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Libraries Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-xl p-6 mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-violet-400" />
              Libraries
            </h2>
            <Button
              size="sm"
              onClick={() => setShowAddLibrary(!showAddLibrary)}
              className="bg-violet-600 hover:bg-violet-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Library
            </Button>
          </div>

          {/* Add Library Form */}
          {showAddLibrary && (
            <div className="bg-white/5 rounded-xl p-4 mb-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Name</label>
                  <Input
                    value={newLibrary.name}
                    onChange={(e) => setNewLibrary(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="My Movies"
                    className="bg-white/5 border-white/10"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Path</label>
                  <Input
                    value={newLibrary.path}
                    onChange={(e) => setNewLibrary(prev => ({ ...prev, path: e.target.value }))}
                    placeholder="/media/movies"
                    className="bg-white/5 border-white/10"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Type</label>
                  <select
                    value={newLibrary.media_type}
                    onChange={(e) => setNewLibrary(prev => ({ ...prev, media_type: e.target.value }))}
                    className="w-full h-10 px-3 rounded-md bg-white/5 border border-white/10 text-white"
                  >
                    <option value="movies">Movies</option>
                    <option value="tv">TV Shows</option>
                    <option value="music">Music</option>
                    <option value="audiobooks">Audiobooks</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAddLibrary(false)}>Cancel</Button>
                <Button onClick={handleAddLibrary} className="bg-green-600 hover:bg-green-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add
                </Button>
              </div>
            </div>
          )}

          {/* Library List */}
          {libraries.length === 0 ? (
            <div className="text-center py-8">
              <FolderOpen className="w-12 h-12 mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400">No libraries configured</p>
              <p className="text-sm text-gray-500">Add a library to start scanning your media</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {libraries.map((library) => {
                const Icon = MEDIA_TYPE_ICONS[library.media_type] || FolderOpen;
                const isScanning = scanning[library.id];
                
                return (
                  <div
                    key={library.id}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedLibrary === library.id
                        ? 'border-violet-500 bg-violet-500/10'
                        : 'border-white/10 bg-surface hover:border-white/20'
                    }`}
                    onClick={() => {
                      setSelectedLibrary(selectedLibrary === library.id ? null : library.id);
                      fetchMedia(selectedLibrary === library.id ? null : library.id);
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${MEDIA_TYPE_COLORS[library.media_type] || MEDIA_TYPE_COLORS.unknown} flex items-center justify-center`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-medium">{library.name}</h3>
                          <p className="text-xs text-gray-500">{library.item_count} items</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => { e.stopPropagation(); handleScanLibrary(library.id); }}
                          disabled={isScanning}
                        >
                          <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => { e.stopPropagation(); handleRemoveLibrary(library.id, library.name); }}
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{library.path}</p>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Recent Media */}
        {recentMedia.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              Recently Added
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {recentMedia.map((item) => {
                const Icon = MEDIA_TYPE_ICONS[item.media_type] || Film;
                return (
                  <Link key={item.id} to={`/watch/${item.id}`}>
                    <div className="glass-card rounded-xl overflow-hidden hover:border-white/20 transition-all group">
                      <div className="aspect-video bg-gradient-to-br from-violet-900/50 to-purple-900/50 flex items-center justify-center relative">
                        <Icon className="w-8 h-8 text-violet-400" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="w-8 h-8 text-white" />
                        </div>
                      </div>
                      <div className="p-3">
                        <h3 className="font-medium text-sm truncate">{item.title}</h3>
                        <p className="text-xs text-gray-500">
                          {item.year || ''} {item.width && item.height ? `• ${item.height}p` : ''}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Media Search & Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {/* Search Bar */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Search your library..."
                className="bg-white/5 border-white/10"
              />
            </div>
            <Button onClick={handleSearch} className="bg-violet-600 hover:bg-violet-700">
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </div>

          {/* Media Grid */}
          {media.length === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <Film className="w-12 h-12 mx-auto mb-4 text-gray-600" />
              <h3 className="text-xl font-bold mb-2">No Media Found</h3>
              <p className="text-gray-400">
                {libraries.length === 0
                  ? 'Add a library and scan to see your media here.'
                  : 'Scan your libraries to discover media files.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
              {media.map((item) => {
                const Icon = MEDIA_TYPE_ICONS[item.media_type] || Film;
                return (
                  <Link key={item.id} to={`/watch/${item.id}`}>
                    <div className="glass-card rounded-xl overflow-hidden hover:border-white/20 transition-all group">
                      <div className="aspect-[2/3] bg-gradient-to-br from-violet-900/50 to-purple-900/50 flex items-center justify-center relative">
                        <Icon className="w-10 h-10 text-violet-400" />
                        {item.watched && (
                          <div className="absolute top-2 right-2">
                            <Eye className="w-4 h-4 text-green-400" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="w-10 h-10 text-white" />
                        </div>
                      </div>
                      <div className="p-2">
                        <h3 className="font-medium text-xs truncate">{item.title}</h3>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-xs text-gray-500">{item.year || ''}</span>
                          <span className="text-xs text-gray-500">{formatFileSize(item.size)}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </Layout>
  );
};

export default LibraryPage;
