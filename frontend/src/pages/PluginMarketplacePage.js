import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { 
  Package, Search, Download, Star, ExternalLink, Check, X,
  RefreshCw, Filter, Grid, List, Shield, Code, Globe,
  MessageSquare, Palette, Calendar, Database, Bell, ChevronRight
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Plugin type icons and colors
const pluginTypeConfig = {
  metadata_provider: { icon: Database, color: 'blue', label: 'Metadata' },
  indexer_provider: { icon: Globe, color: 'green', label: 'Indexer' },
  subtitle_provider: { icon: MessageSquare, color: 'yellow', label: 'Subtitles' },
  notification_provider: { icon: Bell, color: 'pink', label: 'Notifications' },
  theme_provider: { icon: Palette, color: 'purple', label: 'Theme' },
  scheduled_task: { icon: Calendar, color: 'orange', label: 'Scheduled' },
};

// Sample marketplace plugins (in production, this would come from an API)
const marketplacePlugins = [
  {
    id: 'anidb-metadata',
    name: 'AniDB Metadata',
    description: 'Fetch anime metadata from AniDB including episode titles, air dates, and detailed information.',
    author: 'WatchNexus',
    version: '1.2.0',
    plugin_type: 'metadata_provider',
    downloads: 12450,
    rating: 4.8,
    verified: true,
    homepage: 'https://github.com/watchnexus/plugin-anidb',
    installed: false,
    featured: true,
  },
  {
    id: 'discord-notify',
    name: 'Discord Notifications',
    description: 'Send notifications to Discord channels when new media is added or downloads complete.',
    author: 'WatchNexus',
    version: '2.0.1',
    plugin_type: 'notification_provider',
    downloads: 8923,
    rating: 4.9,
    verified: true,
    homepage: 'https://github.com/watchnexus/plugin-discord',
    installed: true,
    featured: true,
  },
  {
    id: 'telegram-notify',
    name: 'Telegram Notifications',
    description: 'Get instant notifications on Telegram when media is added, downloads finish, or watch parties start.',
    author: 'community',
    version: '1.1.0',
    plugin_type: 'notification_provider',
    downloads: 5621,
    rating: 4.6,
    verified: false,
    homepage: 'https://github.com/user/watchnexus-telegram',
    installed: false,
  },
  {
    id: 'trakt-sync',
    name: 'Trakt.tv Sync',
    description: 'Sync your watch history, ratings, and watchlist with Trakt.tv automatically.',
    author: 'community',
    version: '1.5.2',
    plugin_type: 'metadata_provider',
    downloads: 15234,
    rating: 4.7,
    verified: true,
    homepage: 'https://github.com/user/watchnexus-trakt',
    installed: false,
    featured: true,
  },
  {
    id: 'opensubtitles-enhanced',
    name: 'OpenSubtitles Enhanced',
    description: 'Enhanced OpenSubtitles integration with better search, auto-download, and subtitle sync.',
    author: 'community',
    version: '2.1.0',
    plugin_type: 'subtitle_provider',
    downloads: 9876,
    rating: 4.5,
    verified: false,
    homepage: 'https://github.com/user/os-enhanced',
    installed: false,
  },
  {
    id: 'plex-theme',
    name: 'Plex-Inspired Theme',
    description: 'A dark theme inspired by the Plex media server interface.',
    author: 'community',
    version: '1.0.0',
    plugin_type: 'theme_provider',
    downloads: 3421,
    rating: 4.3,
    verified: false,
    homepage: 'https://github.com/user/watchnexus-plex-theme',
    installed: false,
  },
  {
    id: 'jackett-indexer',
    name: 'Jackett Integration',
    description: 'Connect Jackett as an indexer source for expanded torrent site coverage.',
    author: 'WatchNexus',
    version: '1.0.0',
    plugin_type: 'indexer_provider',
    downloads: 7890,
    rating: 4.8,
    verified: true,
    homepage: 'https://github.com/watchnexus/plugin-jackett',
    installed: false,
  },
  {
    id: 'auto-organize',
    name: 'Auto Organize',
    description: 'Automatically rename and organize downloaded media files based on metadata.',
    author: 'community',
    version: '1.3.0',
    plugin_type: 'scheduled_task',
    downloads: 6543,
    rating: 4.4,
    verified: false,
    homepage: 'https://github.com/user/watchnexus-auto-organize',
    installed: false,
  },
  {
    id: 'email-notify',
    name: 'Email Notifications',
    description: 'Send email notifications for important events like download completion and new releases.',
    author: 'community',
    version: '1.0.0',
    plugin_type: 'notification_provider',
    downloads: 2134,
    rating: 4.2,
    verified: false,
    homepage: 'https://github.com/user/watchnexus-email',
    installed: false,
  },
  {
    id: 'fanart-enhanced',
    name: 'Fanart.tv Enhanced',
    description: 'Fetch high-quality artwork from Fanart.tv including logos, banners, and backgrounds.',
    author: 'WatchNexus',
    version: '1.1.0',
    plugin_type: 'metadata_provider',
    downloads: 4567,
    rating: 4.6,
    verified: true,
    homepage: 'https://github.com/watchnexus/plugin-fanart',
    installed: false,
  },
];

export const PluginMarketplacePage = () => {
  const [plugins, setPlugins] = useState(marketplacePlugins);
  const [installedPlugins, setInstalledPlugins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [sortBy, setSortBy] = useState('downloads');
  const [viewMode, setViewMode] = useState('grid');
  const [selectedPlugin, setSelectedPlugin] = useState(null);
  const [installing, setInstalling] = useState(null);

  const getToken = () => localStorage.getItem('watchnexus_token');

  // Fetch installed plugins
  const fetchInstalledPlugins = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/gadgets/plugins`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setInstalledPlugins(res.data || []);
      
      // Update marketplace plugins with installed status
      setPlugins(prev => prev.map(p => ({
        ...p,
        installed: (res.data || []).some(ip => ip.id === p.id)
      })));
    } catch (err) {
      console.error('Failed to fetch installed plugins:', err);
    }
  }, []);

  useEffect(() => {
    fetchInstalledPlugins();
  }, [fetchInstalledPlugins]);

  // Filter and sort plugins
  const filteredPlugins = plugins
    .filter(p => {
      if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !p.description.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (selectedType !== 'all' && p.plugin_type !== selectedType) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'downloads') return b.downloads - a.downloads;
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'newest') return b.version.localeCompare(a.version);
      return 0;
    });

  const featuredPlugins = plugins.filter(p => p.featured);

  const handleInstall = async (plugin) => {
    setInstalling(plugin.id);
    // Simulate installation (in production, this would download and install the plugin)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setPlugins(prev => prev.map(p => 
      p.id === plugin.id ? { ...p, installed: true } : p
    ));
    toast.success(`${plugin.name} installed successfully!`);
    setInstalling(null);
    fetchInstalledPlugins();
  };

  const handleUninstall = async (plugin) => {
    if (!confirm(`Uninstall ${plugin.name}?`)) return;
    
    setPlugins(prev => prev.map(p => 
      p.id === plugin.id ? { ...p, installed: false } : p
    ));
    toast.success(`${plugin.name} uninstalled`);
    fetchInstalledPlugins();
  };

  const PluginCard = ({ plugin, compact = false }) => {
    const typeConfig = pluginTypeConfig[plugin.plugin_type] || { icon: Package, color: 'gray', label: 'Other' };
    const TypeIcon = typeConfig.icon;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -2 }}
        className={`p-4 rounded-xl bg-surface border border-white/5 hover:border-violet-500/50 cursor-pointer transition-all ${compact ? '' : 'h-full'}`}
        onClick={() => setSelectedPlugin(plugin)}
      >
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-12 h-12 rounded-xl bg-${typeConfig.color}-500/20 flex items-center justify-center flex-shrink-0`}>
            <TypeIcon className={`w-6 h-6 text-${typeConfig.color}-400`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium truncate">{plugin.name}</h3>
              {plugin.verified && (
                <Shield className="w-4 h-4 text-blue-400 flex-shrink-0" title="Verified" />
              )}
            </div>
            <p className="text-xs text-gray-500">by {plugin.author} • v{plugin.version}</p>
          </div>
        </div>

        <p className="text-sm text-gray-400 mb-4 line-clamp-2">{plugin.description}</p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Download className="w-3 h-3" />
              {plugin.downloads.toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 fill-current text-yellow-400" />
              {plugin.rating}
            </span>
          </div>
          
          {plugin.installed ? (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <Check className="w-3 h-3" />
              Installed
            </span>
          ) : (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleInstall(plugin);
              }}
              disabled={installing === plugin.id}
              className="h-7 text-xs"
            >
              {installing === plugin.id ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <>
                  <Download className="w-3 h-3 mr-1" />
                  Install
                </>
              )}
            </Button>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <Layout>
      <div data-testid="plugin-marketplace-page" className="min-h-screen p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-pink-500 flex items-center justify-center">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  Plugin Marketplace
                  <span className="text-xs bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full">Gadgets 🔧</span>
                </h1>
                <p className="text-gray-400">Extend WatchNexus with community plugins</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={fetchInstalledPlugins}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <a href="https://github.com/watchnexus/plugins" target="_blank" rel="noopener noreferrer">
                <Button variant="outline">
                  <Code className="w-4 h-4 mr-2" />
                  Create Plugin
                </Button>
              </a>
            </div>
          </div>
        </motion.div>

        {/* Featured Plugins */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-8"
        >
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-400" />
            Featured Plugins
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {featuredPlugins.slice(0, 3).map(plugin => (
              <PluginCard key={plugin.id} plugin={plugin} />
            ))}
          </div>
        </motion.div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-wrap items-center gap-4 mb-6"
        >
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search plugins..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 rounded-lg bg-surface border border-white/10 text-white"
          >
            <option value="all">All Types</option>
            {Object.entries(pluginTypeConfig).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 rounded-lg bg-surface border border-white/10 text-white"
          >
            <option value="downloads">Most Downloads</option>
            <option value="rating">Highest Rated</option>
            <option value="name">Name A-Z</option>
            <option value="newest">Newest</option>
          </select>

          <div className="flex gap-1 bg-surface rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white/10' : ''}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-white/10' : ''}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </motion.div>

        {/* Plugin Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
            : 'space-y-3'
          }
        >
          {filteredPlugins.map(plugin => (
            <PluginCard key={plugin.id} plugin={plugin} compact={viewMode === 'list'} />
          ))}
        </motion.div>

        {filteredPlugins.length === 0 && (
          <div className="text-center py-20">
            <Package className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <h2 className="text-xl font-bold mb-2">No Plugins Found</h2>
            <p className="text-gray-400">Try adjusting your search or filters</p>
          </div>
        )}

        {/* Plugin Detail Modal */}
        <AnimatePresence>
          {selectedPlugin && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setSelectedPlugin(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-2xl bg-surface rounded-2xl border border-white/10 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="p-6 border-b border-white/10">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`w-16 h-16 rounded-xl bg-${pluginTypeConfig[selectedPlugin.plugin_type]?.color || 'gray'}-500/20 flex items-center justify-center`}>
                        {(() => {
                          const Icon = pluginTypeConfig[selectedPlugin.plugin_type]?.icon || Package;
                          return <Icon className={`w-8 h-8 text-${pluginTypeConfig[selectedPlugin.plugin_type]?.color || 'gray'}-400`} />;
                        })()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-2xl font-bold">{selectedPlugin.name}</h2>
                          {selectedPlugin.verified && (
                            <Shield className="w-5 h-5 text-blue-400" title="Verified by WatchNexus" />
                          )}
                        </div>
                        <p className="text-gray-400">by {selectedPlugin.author}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <span className={`px-2 py-0.5 rounded bg-${pluginTypeConfig[selectedPlugin.plugin_type]?.color || 'gray'}-500/20 text-${pluginTypeConfig[selectedPlugin.plugin_type]?.color || 'gray'}-400`}>
                            {pluginTypeConfig[selectedPlugin.plugin_type]?.label || 'Plugin'}
                          </span>
                          <span className="text-gray-500">v{selectedPlugin.version}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setSelectedPlugin(null)} className="text-gray-400 hover:text-white">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  <p className="text-gray-300 mb-6">{selectedPlugin.description}</p>

                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="p-4 rounded-xl bg-white/5 text-center">
                      <Download className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                      <p className="text-2xl font-bold">{selectedPlugin.downloads.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">Downloads</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 text-center">
                      <Star className="w-6 h-6 mx-auto mb-2 text-yellow-400" />
                      <p className="text-2xl font-bold">{selectedPlugin.rating}</p>
                      <p className="text-xs text-gray-500">Rating</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 text-center">
                      <Code className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                      <p className="text-2xl font-bold">v{selectedPlugin.version}</p>
                      <p className="text-xs text-gray-500">Version</p>
                    </div>
                  </div>

                  {selectedPlugin.homepage && (
                    <a
                      href={selectedPlugin.homepage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-violet-400 hover:underline mb-6"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View on GitHub
                    </a>
                  )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setSelectedPlugin(null)}>
                    Close
                  </Button>
                  {selectedPlugin.installed ? (
                    <Button
                      variant="outline"
                      className="text-red-400 hover:text-red-300"
                      onClick={() => {
                        handleUninstall(selectedPlugin);
                        setSelectedPlugin(null);
                      }}
                    >
                      Uninstall
                    </Button>
                  ) : (
                    <Button
                      className="bg-gradient-to-r from-violet-600 to-pink-500"
                      onClick={() => {
                        handleInstall(selectedPlugin);
                        setSelectedPlugin(null);
                      }}
                      disabled={installing === selectedPlugin.id}
                    >
                      {installing === selectedPlugin.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Download className="w-4 h-4 mr-2" />
                      )}
                      Install Plugin
                    </Button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
};
