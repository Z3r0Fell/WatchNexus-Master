import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { libraryApi } from '../services/nexusApi';
import { toast } from 'sonner';
import {
  Film, Tv, Star, Calendar, Clock, ChevronLeft, ChevronRight,
  Play, Info, Bookmark, Search, X, Filter, Grid, LayoutList,
  RefreshCw
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';

const TMDB_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='300' fill='%23181818'%3E%3Crect width='200' height='300'/%3E%3Ctext x='100' y='150' text-anchor='middle' fill='%23444' font-size='14'%3ENo Poster%3C/text%3E%3C/svg%3E";

const GenrePill = ({ genre }) => (
  <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-medium text-gray-300">
    {genre}
  </span>
);

const MediaCard = ({ item, onClick }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    whileHover={{ scale: 1.05, zIndex: 10 }}
    transition={{ duration: 0.2 }}
    onClick={() => onClick(item)}
    data-testid={`media-card-${item.id}`}
    className="relative cursor-pointer group rounded-xl overflow-hidden"
    style={{ aspectRatio: '2/3' }}
  >
    <img
      src={item.poster_url || TMDB_PLACEHOLDER}
      alt={item.title}
      className="w-full h-full object-cover"
      loading="lazy"
    />
    {/* Hover overlay */}
    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <h3 className="text-sm font-bold leading-tight mb-1 line-clamp-2">{item.title}</h3>
        <div className="flex items-center gap-2 text-[10px] text-gray-300">
          {item.year && <span>{item.year}</span>}
          {item.rating > 0 && (
            <span className="flex items-center gap-0.5">
              <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />
              {item.rating?.toFixed(1)}
            </span>
          )}
          {item.runtime > 0 && <span>{item.runtime}m</span>}
        </div>
      </div>
    </div>
    {/* Rating badge */}
    {item.rating > 0 && (
      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[10px] font-bold text-yellow-400 flex items-center gap-0.5">
        <Star className="w-2.5 h-2.5 fill-yellow-400" />
        {item.rating?.toFixed(1)}
      </div>
    )}
  </motion.div>
);

const MediaDetail = ({ item, onClose }) => {
  if (!item) return null;
  const genres = item.genres ? item.genres.split(', ') : [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="relative max-w-4xl w-full rounded-2xl overflow-hidden bg-[#141414] border border-white/10"
        onClick={e => e.stopPropagation()}
        data-testid="media-detail-modal"
      >
        {/* Backdrop */}
        {item.backdrop_url ? (
          <div className="relative h-64 sm:h-80">
            <img src={item.backdrop_url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent" />
            <Button size="sm" variant="ghost" onClick={onClose}
              className="absolute top-4 right-4 bg-black/50 rounded-full h-8 w-8 p-0">
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={onClose}
            className="absolute top-4 right-4 z-10 bg-black/50 rounded-full h-8 w-8 p-0">
            <X className="w-4 h-4" />
          </Button>
        )}

        <div className="p-6 -mt-16 relative z-10">
          <div className="flex gap-5">
            {/* Poster */}
            <div className="flex-shrink-0 w-32 rounded-xl overflow-hidden shadow-2xl">
              <img src={item.poster_url || TMDB_PLACEHOLDER} alt={item.title} className="w-full" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold mb-2">{item.title}</h2>
              <div className="flex items-center gap-3 text-sm text-gray-400 mb-3 flex-wrap">
                {item.year && (
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {item.year}</span>
                )}
                {item.rating > 0 && (
                  <span className="flex items-center gap-1 text-yellow-400">
                    <Star className="w-3.5 h-3.5 fill-yellow-400" /> {item.rating?.toFixed(1)}
                  </span>
                )}
                {item.runtime > 0 && (
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {item.runtime}m</span>
                )}
                {item.media_type && (
                  <span className="flex items-center gap-1">
                    {item.media_type === 'tv' ? <Tv className="w-3.5 h-3.5" /> : <Film className="w-3.5 h-3.5" />}
                    {item.media_type === 'tv' ? 'TV Show' : 'Movie'}
                  </span>
                )}
              </div>

              {genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {genres.map(g => <GenrePill key={g} genre={g} />)}
                </div>
              )}

              {item.overview && (
                <p className="text-sm text-gray-300 leading-relaxed line-clamp-4">{item.overview}</p>
              )}

              <div className="mt-4 flex gap-2">
                <Button size="sm" className="bg-white text-black hover:bg-gray-200">
                  <Play className="w-4 h-4 mr-1.5 fill-black" /> Play
                </Button>
                <Button size="sm" variant="outline" className="border-white/20">
                  <Bookmark className="w-4 h-4 mr-1.5" /> Add to Watchlist
                </Button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const LibrarySection = ({ library, media, onItemClick }) => {
  const scrollRef = useState(null);
  if (!media || media.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          {library.name}
          <span className="text-xs text-gray-500 font-normal">{media.length} items</span>
        </h3>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-3">
        {media.map(item => (
          <MediaCard key={item.id} item={item} onClick={onItemClick} />
        ))}
      </div>
    </div>
  );
};

export default function MediaBrowserPage() {
  const [libraries, setLibraries] = useState([]);
  const [mediaByLib, setMediaByLib] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const libRes = await libraryApi.getAll();
      const libs = libRes.data || [];
      setLibraries(libs);

      // Fetch media for each library
      const mediaMap = {};
      await Promise.all(libs.map(async lib => {
        try {
          const mediaRes = await libraryApi.getMedia(lib.id, lib.media_type, 50, 0);
          mediaMap[lib.id] = mediaRes.data || [];
        } catch { mediaMap[lib.id] = []; }
      }));
      setMediaByLib(mediaMap);
    } catch { toast.error('Failed to load media'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Flatten all media for search
  const allMedia = Object.values(mediaByLib).flat();
  const filteredMedia = searchQuery
    ? allMedia.filter(m => m.title?.toLowerCase().includes(searchQuery.toLowerCase()))
    : null;

  return (
    <Layout>
      <div data-testid="media-browser" className="min-h-screen">
        {/* Hero / Header */}
        <div className="px-8 pt-8 pb-4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Browse</h1>
              <p className="text-sm text-gray-500 mt-1">
                {allMedia.length} titles across {libraries.length} libraries
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  placeholder="Search titles..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  data-testid="media-search-input"
                  className="pl-10 bg-white/5 border-white/10 w-64"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <Button size="sm" variant="ghost" onClick={load} data-testid="refresh-media-btn">
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 pb-8">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <RefreshCw className="w-8 h-8 animate-spin text-gray-600" />
            </div>
          ) : filteredMedia ? (
            /* Search Results */
            <div>
              <h3 className="text-lg font-semibold mb-4">
                Search: "{searchQuery}" ({filteredMedia.length} results)
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-3">
                {filteredMedia.map(item => (
                  <MediaCard key={item.id} item={item} onClick={setSelectedItem} />
                ))}
              </div>
              {filteredMedia.length === 0 && (
                <p className="text-center text-gray-500 py-12">No results found</p>
              )}
            </div>
          ) : libraries.length > 0 ? (
            /* Library Sections */
            libraries.map(lib => (
              <LibrarySection
                key={lib.id}
                library={lib}
                media={mediaByLib[lib.id] || []}
                onItemClick={setSelectedItem}
              />
            ))
          ) : (
            <div className="text-center py-24">
              <Film className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Media Yet</h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                Add libraries in the Library Manager and scan them to populate your media collection.
              </p>
            </div>
          )}
        </div>

        {/* Detail Modal */}
        <AnimatePresence>
          {selectedItem && (
            <MediaDetail item={selectedItem} onClose={() => setSelectedItem(null)} />
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
