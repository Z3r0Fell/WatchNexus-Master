import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { marmaladeLibrary, getMarmaladeImageUrl } from '../services/marmaladeApi';
import { toast } from 'sonner';
import {
  Film, Tv, Music, Book, Folder, Play, Clock, Star,
  Grid3X3, List, RefreshCw, Search, Filter, ChevronRight
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { VideoPlayer } from '../components/VideoPlayer';

// Fallback image for items without posters
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=300&h=450&fit=crop';

const LibraryCard = ({ item, onClick }) => {
  const [imageError, setImageError] = useState(false);
  
  // Get image URL based on item type
  const imageUrl = item.ImageTags?.Primary
    ? getMarmaladeImageUrl(item.Id, 'Primary', { maxWidth: 300 })
    : FALLBACK_IMAGE;

  // Format runtime
  const formatRuntime = (ticks) => {
    if (!ticks) return '';
    const minutes = Math.floor(ticks / 600000000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(item)}
      className="group cursor-pointer"
    >
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-surface border border-white/5">
        <img
          src={imageError ? FALLBACK_IMAGE : imageUrl}
          alt={item.Name}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
        />
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        
        {/* Play button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-14 h-14 rounded-full bg-violet-600/80 flex items-center justify-center">
            <Play className="w-7 h-7 text-white ml-1" fill="white" />
          </div>
        </div>
        
        {/* Progress bar if partially watched */}
        {item.UserData?.PlayedPercentage > 0 && item.UserData?.PlayedPercentage < 100 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800">
            <div 
              className="h-full bg-violet-500"
              style={{ width: `${item.UserData.PlayedPercentage}%` }}
            />
          </div>
        )}
        
        {/* Watched indicator */}
        {item.UserData?.Played && (
          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
            <span className="text-white text-xs">✓</span>
          </div>
        )}
        
        {/* Rating badge */}
        {item.CommunityRating && (
          <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/70 flex items-center gap-1">
            <Star className="w-3 h-3 text-yellow-400" fill="currentColor" />
            <span className="text-white text-xs">{item.CommunityRating.toFixed(1)}</span>
          </div>
        )}
      </div>
      
      <div className="mt-3 space-y-1">
        <h3 className="font-medium text-white truncate group-hover:text-violet-400 transition-colors">
          {item.Name}
        </h3>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          {item.ProductionYear && <span>{item.ProductionYear}</span>}
          {item.RunTimeTicks && (
            <>
              <span>•</span>
              <span>{formatRuntime(item.RunTimeTicks)}</span>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const LibrarySection = ({ title, icon: Icon, items, onItemClick, onViewAll }) => {
  if (!items || items.length === 0) return null;
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Icon className="w-5 h-5 text-violet-400" />
          {title}
        </h2>
        {onViewAll && (
          <Button variant="ghost" size="sm" onClick={onViewAll} className="text-violet-400">
            View All <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {items.slice(0, 6).map((item) => (
          <LibraryCard key={item.Id} item={item} onClick={onItemClick} />
        ))}
      </div>
    </div>
  );
};

export const LibraryPage = () => {
  const navigate = useNavigate();
  const [libraries, setLibraries] = useState([]);
  const [selectedLibrary, setSelectedLibrary] = useState(null);
  const [items, setItems] = useState([]);
  const [continueWatching, setContinueWatching] = useState([]);
  const [latestItems, setLatestItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [selectedItem, setSelectedItem] = useState(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [marmaladeUserId, setMarmaladeUserId] = useState(null);
  const [connectionError, setConnectionError] = useState(null);

  // Load libraries on mount
  useEffect(() => {
    loadLibraries();
  }, []);

  const loadLibraries = async () => {
    setLoading(true);
    setConnectionError(null);
    
    try {
      // For demo, use a hardcoded user ID or get from Marmalade auth
      // In production, this would come from the Marmalade authentication
      const userId = 'demo-user-id';
      setMarmaladeUserId(userId);
      
      const response = await marmaladeLibrary.getLibraries(userId);
      setLibraries(response.data?.Items || []);
      
      // Load continue watching and latest
      await Promise.all([
        loadContinueWatching(userId),
        loadLatestItems(userId),
      ]);
      
    } catch (error) {
      console.error('Failed to load libraries:', error);
      if (error.response?.status === 503 || error.response?.status === 520) {
        setConnectionError('Marmalade server is not running. Start the server to browse your library.');
      } else {
        setConnectionError('Failed to connect to media server.');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadContinueWatching = async (userId) => {
    try {
      const response = await marmaladeLibrary.getResume(userId, {
        limit: 10,
        mediaTypes: 'Video',
      });
      setContinueWatching(response.data?.Items || []);
    } catch (error) {
      console.error('Failed to load continue watching:', error);
    }
  };

  const loadLatestItems = async (userId) => {
    try {
      const response = await marmaladeLibrary.getLatest(userId, {
        limit: 12,
      });
      setLatestItems(response.data || []);
    } catch (error) {
      console.error('Failed to load latest items:', error);
    }
  };

  const loadLibraryItems = async (libraryId) => {
    setLoading(true);
    try {
      const response = await marmaladeLibrary.getItems(marmaladeUserId, {
        parentId: libraryId,
        sortBy: 'SortName',
        sortOrder: 'Ascending',
        includeItemTypes: 'Movie,Series,MusicAlbum,AudioBook',
        recursive: true,
        fields: 'PrimaryImageAspectRatio,SortName,DateCreated,ProductionYear,CommunityRating',
        limit: 100,
      });
      setItems(response.data?.Items || []);
    } catch (error) {
      console.error('Failed to load library items:', error);
      toast.error('Failed to load library items');
    } finally {
      setLoading(false);
    }
  };

  const handleLibrarySelect = (library) => {
    setSelectedLibrary(library);
    loadLibraryItems(library.Id);
  };

  const handleItemClick = (item) => {
    setSelectedItem(item);
    // For movies and episodes, show player directly
    if (item.Type === 'Movie' || item.Type === 'Episode') {
      setShowPlayer(true);
    } else {
      // For series, navigate to details or show episodes
      navigate(`/${item.Type.toLowerCase()}/${item.Id}`);
    }
  };

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !marmaladeUserId) return;
    
    setLoading(true);
    try {
      const response = await marmaladeLibrary.search(marmaladeUserId, searchQuery, {
        limit: 50,
        includeItemTypes: 'Movie,Series,Episode,MusicAlbum,AudioBook',
        fields: 'PrimaryImageAspectRatio,ProductionYear,CommunityRating',
      });
      setItems(response.data?.Items || []);
      setSelectedLibrary({ Name: `Search: "${searchQuery}"` });
    } catch (error) {
      console.error('Search failed:', error);
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, marmaladeUserId]);

  const handleClosePlayer = () => {
    setShowPlayer(false);
    setSelectedItem(null);
  };

  // Get stream URL for selected item
  const getStreamUrl = (item) => {
    if (!item) return '';
    const baseUrl = process.env.REACT_APP_BACKEND_URL;
    return `${baseUrl}/api/marmalade/Videos/${item.Id}/stream?static=true`;
  };

  // Get library icon based on collection type
  const getLibraryIcon = (collectionType) => {
    switch (collectionType) {
      case 'movies': return Film;
      case 'tvshows': return Tv;
      case 'music': return Music;
      case 'books': return Book;
      default: return Folder;
    }
  };

  return (
    <Layout>
      <div data-testid="library-page" className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              {selectedLibrary ? selectedLibrary.Name : 'My Library'}
            </h1>
            <p className="text-gray-400 mt-1">
              {selectedLibrary ? `${items.length} items` : 'Browse your personal media collection'}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search library..."
                data-testid="library-search-input"
                className="w-48 md:w-64 bg-white/5 border-white/10"
              />
              <Button onClick={handleSearch} variant="outline" className="border-white/10">
                <Search className="w-4 h-4" />
              </Button>
            </div>
            
            {/* View toggle */}
            <div className="flex bg-surface rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-violet-600' : 'hover:bg-white/10'}`}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-violet-600' : 'hover:bg-white/10'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            
            {/* Refresh */}
            <Button onClick={loadLibraries} variant="outline" className="border-white/10">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Connection Error */}
        {connectionError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-xl bg-orange-500/10 border border-orange-500/30"
          >
            <h3 className="text-orange-400 font-bold mb-2">Media Server Not Connected</h3>
            <p className="text-orange-300/80 mb-4">{connectionError}</p>
            <p className="text-sm text-gray-400">
              In the meantime, you can browse content from TMDB using the Movies and TV Shows sections.
            </p>
          </motion.div>
        )}

        {/* Loading State */}
        {loading && !connectionError && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <RefreshCw className="w-12 h-12 text-violet-500 animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Loading library...</p>
            </div>
          </div>
        )}

        {/* Library Content */}
        {!loading && !connectionError && (
          <>
            {/* Library Folders */}
            {!selectedLibrary && libraries.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold">Libraries</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {libraries.map((library) => {
                    const Icon = getLibraryIcon(library.CollectionType);
                    return (
                      <motion.button
                        key={library.Id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleLibrarySelect(library)}
                        className="p-6 rounded-xl bg-surface border border-white/5 hover:border-violet-500/50 transition-colors text-left"
                      >
                        <Icon className="w-10 h-10 text-violet-400 mb-3" />
                        <h3 className="font-medium text-white">{library.Name}</h3>
                        <p className="text-sm text-gray-400">{library.ChildCount || 0} items</p>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Continue Watching */}
            {!selectedLibrary && continueWatching.length > 0 && (
              <LibrarySection
                title="Continue Watching"
                icon={Clock}
                items={continueWatching}
                onItemClick={handleItemClick}
              />
            )}

            {/* Recently Added */}
            {!selectedLibrary && latestItems.length > 0 && (
              <LibrarySection
                title="Recently Added"
                icon={Star}
                items={latestItems}
                onItemClick={handleItemClick}
              />
            )}

            {/* Library Items Grid */}
            {selectedLibrary && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSelectedLibrary(null);
                      setItems([]);
                    }}
                    className="text-violet-400"
                  >
                    ← Back to Libraries
                  </Button>
                </div>
                
                {items.length > 0 ? (
                  <div className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4'
                      : 'space-y-2'
                  }>
                    {items.map((item) => (
                      viewMode === 'grid' ? (
                        <LibraryCard key={item.Id} item={item} onClick={handleItemClick} />
                      ) : (
                        <motion.div
                          key={item.Id}
                          whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                          onClick={() => handleItemClick(item)}
                          className="flex items-center gap-4 p-3 rounded-lg cursor-pointer border border-transparent hover:border-white/10"
                        >
                          <div className="w-12 h-16 rounded overflow-hidden bg-surface flex-shrink-0">
                            {item.ImageTags?.Primary ? (
                              <img
                                src={getMarmaladeImageUrl(item.Id, 'Primary', { maxWidth: 100 })}
                                alt={item.Name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Film className="w-6 h-6 text-gray-600" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-white truncate">{item.Name}</h3>
                            <p className="text-sm text-gray-400">
                              {item.ProductionYear} {item.Type && `• ${item.Type}`}
                            </p>
                          </div>
                          <Play className="w-5 h-5 text-gray-400" />
                        </motion.div>
                      )
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20">
                    <Folder className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">This library is empty</p>
                  </div>
                )}
              </div>
            )}

            {/* No Libraries */}
            {!selectedLibrary && libraries.length === 0 && !loading && (
              <div className="text-center py-20">
                <Folder className="w-20 h-20 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-400 mb-2">No Libraries Found</h3>
                <p className="text-gray-500 max-w-md mx-auto">
                  Your Marmalade server does not have any libraries configured yet.
                  Add media folders in the Marmalade settings to get started.
                </p>
              </div>
            )}
          </>
        )}

        {/* Video Player Modal */}
        {showPlayer && selectedItem && (
          <div className="fixed inset-0 z-50 bg-black">
            <VideoPlayer
              src={getStreamUrl(selectedItem)}
              poster={selectedItem.ImageTags?.Primary ? getMarmaladeImageUrl(selectedItem.Id, 'Backdrop', { maxWidth: 1920 }) : ''}
              title={selectedItem.Name}
              subtitle={selectedItem.ProductionYear?.toString()}
              onClose={handleClosePlayer}
              startTime={selectedItem.UserData?.PlaybackPositionTicks ? selectedItem.UserData.PlaybackPositionTicks / 10000000 : 0}
            />
          </div>
        )}
      </div>
    </Layout>
  );
};

export default LibraryPage;
