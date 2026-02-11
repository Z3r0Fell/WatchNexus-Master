import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Pause, SkipForward, SkipBack, Volume2, Maximize,
  Search, Download, Film, Tv, Music, BookOpen, Settings,
  Users, MessageCircle, Heart, Smile, Send, Library,
  Plus, Check, Clock, Star, ChevronRight, X, Subtitles
} from 'lucide-react';

// Mock data for the demo
const mockLibrary = [
  { id: 1, title: 'The Matrix', year: 1999, type: 'movie', rating: 8.7, poster: '🎬', duration: '2h 16m' },
  { id: 2, title: 'Breaking Bad', year: 2008, type: 'tv', rating: 9.5, poster: '📺', seasons: 5 },
  { id: 3, title: 'Inception', year: 2010, type: 'movie', rating: 8.8, poster: '🎬', duration: '2h 28m' },
  { id: 4, title: 'The Office', year: 2005, type: 'tv', rating: 9.0, poster: '📺', seasons: 9 },
  { id: 5, title: 'Interstellar', year: 2014, type: 'movie', rating: 8.6, poster: '🎬', duration: '2h 49m' },
  { id: 6, title: 'Dark', year: 2017, type: 'tv', rating: 8.8, poster: '📺', seasons: 3 },
];

const mockSearchResults = [
  { title: 'Dune (2021)', size: '15.2 GB', seeds: 1247, quality: '4K HDR' },
  { title: 'Dune (2021)', size: '4.5 GB', seeds: 892, quality: '1080p' },
  { title: 'Dune (2021)', size: '2.1 GB', seeds: 456, quality: '720p' },
];

const mockChat = [
  { user: 'Alice', message: 'This part is so good!', time: '2:34' },
  { user: 'Bob', message: '🔥🔥🔥', time: '2:35' },
  { user: 'You', message: 'Right?! The cinematography!', time: '2:36' },
];

const DemoSection = ({ title, description, children, isActive, onActivate }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className={`rounded-2xl overflow-hidden transition-all ${
      isActive ? 'ring-2 ring-violet-500' : 'glass'
    }`}
  >
    <button
      onClick={onActivate}
      className="w-full p-6 text-left hover:bg-white/5 transition-colors"
    >
      <h3 className="font-semibold text-lg mb-1">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </button>
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-t border-white/10"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  </motion.div>
);

export const DemoPage = () => {
  const [activeDemo, setActiveDemo] = useState('library');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [downloadQueue, setDownloadQueue] = useState([]);

  const addToQueue = (item) => {
    if (!downloadQueue.find(q => q.title === item.title)) {
      setDownloadQueue([...downloadQueue, { ...item, progress: 0 }]);
    }
  };

  return (
    <div className="pt-24 pb-16" data-testid="demo-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6">
            <Play className="w-4 h-4 text-violet-400" />
            <span className="text-sm">Interactive Demo</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            See WatchNexus <span className="gradient-text">in Action</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Explore the key features without installing. Click each section to interact.
          </p>
        </motion.div>

        {/* Demo Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Library Demo */}
          <DemoSection
            title="📚 Media Library (Marmalade)"
            description="Browse your organized media collection"
            isActive={activeDemo === 'library'}
            onActivate={() => setActiveDemo('library')}
          >
            <div className="p-6 bg-surface/50">
              {/* Library Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-400 text-sm">All</button>
                  <button className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white text-sm flex items-center gap-1">
                    <Film className="w-4 h-4" /> Movies
                  </button>
                  <button className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white text-sm flex items-center gap-1">
                    <Tv className="w-4 h-4" /> TV
                  </button>
                </div>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search..."
                    className="pl-8 pr-3 py-1.5 rounded-lg bg-black/30 border border-white/10 text-sm w-40"
                  />
                </div>
              </div>

              {/* Library Grid */}
              <div className="grid grid-cols-3 gap-3">
                {mockLibrary.map((item) => (
                  <motion.div
                    key={item.id}
                    whileHover={{ scale: 1.05 }}
                    className="relative rounded-lg bg-black/30 p-3 cursor-pointer group"
                  >
                    <div className="text-4xl mb-2 text-center">{item.poster}</div>
                    <h4 className="font-medium text-sm truncate">{item.title}</h4>
                    <p className="text-gray-500 text-xs">{item.year}</p>
                    <div className="absolute inset-0 bg-black/80 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="w-8 h-8 text-violet-400" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </DemoSection>

          {/* Search & Download Demo */}
          <DemoSection
            title="🍯 Search & Download (Syrup + Fondue)"
            description="Find and acquire content from indexers"
            isActive={activeDemo === 'search'}
            onActivate={() => setActiveDemo('search')}
          >
            <div className="p-6 bg-surface/50">
              {/* Search Input */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search for movies, TV shows..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/30 border border-white/10 focus:border-violet-500/50 focus:outline-none"
                />
              </div>

              {/* Results */}
              {searchQuery && (
                <div className="space-y-2">
                  <p className="text-gray-400 text-sm mb-3">Results for "{searchQuery}":</p>
                  {mockSearchResults.map((result, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-black/30"
                    >
                      <div>
                        <p className="font-medium text-sm">{result.title}</p>
                        <p className="text-gray-500 text-xs">
                          {result.quality} • {result.size} • {result.seeds} seeds
                        </p>
                      </div>
                      <button
                        onClick={() => addToQueue(result)}
                        className="p-2 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30"
                      >
                        {downloadQueue.find(q => q.title === result.title) ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Download Queue */}
              {downloadQueue.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-gray-400 text-sm mb-2">Download Queue:</p>
                  {downloadQueue.map((item, index) => (
                    <div key={index} className="flex items-center gap-3 p-2 rounded-lg bg-black/20">
                      <Download className="w-4 h-4 text-violet-400 animate-pulse" />
                      <div className="flex-1">
                        <p className="text-sm">{item.quality}</p>
                        <div className="h-1 bg-black/50 rounded-full mt-1">
                          <div className="h-1 bg-violet-500 rounded-full w-1/3 animate-pulse" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DemoSection>

          {/* Video Player Demo */}
          <DemoSection
            title="🎬 Video Player"
            description="Stream media with full playback controls"
            isActive={activeDemo === 'player'}
            onActivate={() => setActiveDemo('player')}
          >
            <div className="p-6 bg-surface/50">
              {/* Video Preview */}
              <div className="relative aspect-video bg-black rounded-xl mb-4 overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-6xl">🎬</div>
                </div>
                
                {/* Player Controls */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                  {/* Progress Bar */}
                  <div className="h-1 bg-white/20 rounded-full mb-3 cursor-pointer">
                    <div className="h-1 bg-violet-500 rounded-full w-1/3" />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="p-2 rounded-lg hover:bg-white/10"
                      >
                        {isPlaying ? (
                          <Pause className="w-5 h-5" />
                        ) : (
                          <Play className="w-5 h-5" />
                        )}
                      </button>
                      <button className="p-2 rounded-lg hover:bg-white/10">
                        <SkipBack className="w-4 h-4" />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-white/10">
                        <SkipForward className="w-4 h-4" />
                      </button>
                      <span className="text-sm">45:32 / 2:16:00</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button className="p-2 rounded-lg hover:bg-white/10">
                        <Subtitles className="w-4 h-4" />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-white/10">
                        <Volume2 className="w-4 h-4" />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-white/10">
                        <Maximize className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Now Playing Info */}
              <div className="flex items-center gap-4">
                <div className="text-3xl">🎬</div>
                <div>
                  <h4 className="font-semibold">The Matrix</h4>
                  <p className="text-gray-400 text-sm">1999 • 2h 16m • 8.7★</p>
                </div>
              </div>
            </div>
          </DemoSection>

          {/* Watch Party Demo */}
          <DemoSection
            title="🍲 Watch Party (Potluck)"
            description="Watch together with synchronized playback"
            isActive={activeDemo === 'party'}
            onActivate={() => setActiveDemo('party')}
          >
            <div className="p-6 bg-surface/50">
              {/* Party Header */}
              <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-violet-500/10 border border-violet-500/30">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-violet-400" />
                  <div>
                    <p className="font-medium text-sm">Movie Night</p>
                    <p className="text-gray-400 text-xs">Code: <span className="font-mono text-violet-400">ABC123</span></p>
                  </div>
                </div>
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 rounded-full bg-pink-500 flex items-center justify-center text-xs">A</div>
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-xs">B</div>
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-xs">Y</div>
                </div>
              </div>

              {/* Mini Player */}
              <div className="relative aspect-video bg-black rounded-lg mb-4 overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center text-4xl">🎬</div>
                <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-red-500/80 text-xs">
                  SYNCED
                </div>
              </div>

              {/* Chat */}
              <div className="h-40 overflow-y-auto mb-3 space-y-2 p-3 rounded-lg bg-black/30">
                {mockChat.map((msg, index) => (
                  <div key={index} className={`flex gap-2 ${msg.user === 'You' ? 'justify-end' : ''}`}>
                    {msg.user !== 'You' && (
                      <div className="w-6 h-6 rounded-full bg-violet-500/30 flex items-center justify-center text-xs">
                        {msg.user[0]}
                      </div>
                    )}
                    <div className={`px-3 py-1.5 rounded-lg text-sm ${
                      msg.user === 'You' ? 'bg-violet-500/30' : 'bg-white/5'
                    }`}>
                      {msg.message}
                    </div>
                  </div>
                ))}
              </div>

              {/* Chat Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm"
                />
                <button className="p-2 rounded-lg bg-violet-500/20 text-violet-400">
                  <Send className="w-4 h-4" />
                </button>
                <button className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white">
                  <Smile className="w-4 h-4" />
                </button>
              </div>
            </div>
          </DemoSection>

          {/* Settings Demo */}
          <DemoSection
            title="⚙️ Settings & Configuration"
            description="Customize every aspect of WatchNexus"
            isActive={activeDemo === 'settings'}
            onActivate={() => setActiveDemo('settings')}
          >
            <div className="p-6 bg-surface/50">
              {/* Settings Tabs */}
              <div className="flex flex-wrap gap-2 mb-4">
                {['General', 'Library', 'Indexers', 'Theme', 'Plugins'].map((tab) => (
                  <button
                    key={tab}
                    className={`px-3 py-1.5 rounded-lg text-sm ${
                      tab === 'Theme' ? 'bg-violet-500/20 text-violet-400' : 'text-gray-400'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Theme Settings */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Theme Preset</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Default', 'Cinema', 'Midnight', 'Ocean', 'Forest', 'Custom'].map((theme) => (
                      <button
                        key={theme}
                        className={`p-2 rounded-lg text-xs ${
                          theme === 'Default' 
                            ? 'bg-violet-500/20 border border-violet-500/50 text-violet-400' 
                            : 'bg-white/5 text-gray-400'
                        }`}
                      >
                        {theme}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Accent Color (Juice 🧃)</label>
                  <div className="flex gap-2">
                    {['#8B5CF6', '#EC4899', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'].map((color) => (
                      <button
                        key={color}
                        className="w-8 h-8 rounded-lg"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <button className="w-full py-2 rounded-lg bg-gradient-to-r from-violet-600 to-pink-500 text-sm font-medium">
                  Save Theme
                </button>
              </div>
            </div>
          </DemoSection>

          {/* Subtitles Demo */}
          <DemoSection
            title="🌿 Subtitles (Garnish)"
            description="Find and download subtitles automatically"
            isActive={activeDemo === 'subtitles'}
            onActivate={() => setActiveDemo('subtitles')}
          >
            <div className="p-6 bg-surface/50">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-black/30">
                  <div className="flex items-center gap-3">
                    <Subtitles className="w-5 h-5 text-green-400" />
                    <div>
                      <p className="text-sm">The.Matrix.1999.1080p.BluRay.srt</p>
                      <p className="text-gray-500 text-xs">English • Addic7ed • ★★★★☆</p>
                    </div>
                  </div>
                  <button className="p-2 rounded-lg bg-green-500/20 text-green-400">
                    <Download className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-black/30">
                  <div className="flex items-center gap-3">
                    <Subtitles className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm">The.Matrix.1999.720p.srt</p>
                      <p className="text-gray-500 text-xs">English • OpenSubtitles • ★★★☆☆</p>
                    </div>
                  </div>
                  <button className="p-2 rounded-lg bg-white/5 text-gray-400">
                    <Download className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-black/30">
                  <div className="flex items-center gap-3">
                    <Subtitles className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm">The.Matrix.1999.Spanish.srt</p>
                      <p className="text-gray-500 text-xs">Spanish • Addic7ed • ★★★★★</p>
                    </div>
                  </div>
                  <button className="p-2 rounded-lg bg-white/5 text-gray-400">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-lg bg-violet-500/10 border border-violet-500/30">
                <p className="text-sm text-violet-400">
                  💡 Tip: Enable auto-download in settings to automatically fetch subtitles for new media.
                </p>
              </div>
            </div>
          </DemoSection>
        </div>

        {/* Full Experience CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-16 p-12 rounded-3xl glass gradient-border text-center"
        >
          <h2 className="text-3xl font-bold mb-4">
            Ready for the Full Experience?
          </h2>
          <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
            This demo shows just a glimpse of what WatchNexus can do. 
            Download now to unlock all features with your own media library.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/download"
              className="flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 text-white font-semibold"
            >
              <Download className="w-5 h-5" />
              Download WatchNexus
            </a>
            <a
              href="/features"
              className="flex items-center gap-2 px-8 py-4 rounded-xl border border-white/20 text-white font-semibold hover:bg-white/5 transition-colors"
            >
              Explore All Features
              <ChevronRight className="w-5 h-5" />
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
