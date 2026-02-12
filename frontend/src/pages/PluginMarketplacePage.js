import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { 
  Package, Search, Download, Star, ExternalLink, Check, X,
  RefreshCw, Filter, Grid, List, Shield, Code, Globe, Tv,
  MessageSquare, Palette, Calendar, Database, Bell, ChevronRight,
  Music, Image, Settings, Gamepad2, Monitor, Zap, Box, Layers,
  Play, Radio, Cloud, Sun, Eye, ArrowRight
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { PluginConverter } from '../components/PluginConverter';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Kodi category icons and colors
const kodiCategoryConfig = {
  video: { icon: Tv, color: 'blue', label: 'Video Add-ons', emoji: '📺' },
  audio: { icon: Music, color: 'green', label: 'Music Add-ons', emoji: '🎵' },
  image: { icon: Image, color: 'pink', label: 'Picture Add-ons', emoji: '🖼️' },
  program: { icon: Settings, color: 'purple', label: 'Program Add-ons', emoji: '⚙️' },
  script: { icon: Code, color: 'orange', label: 'Scripts', emoji: '📜' },
  service: { icon: Zap, color: 'yellow', label: 'Services', emoji: '⚡' },
  skin: { icon: Palette, color: 'violet', label: 'Skins', emoji: '🎨' },
  resource: { icon: Box, color: 'cyan', label: 'Resources', emoji: '📦' },
  context: { icon: Layers, color: 'rose', label: 'Context Menus', emoji: '📋' },
  subtitle: { icon: MessageSquare, color: 'teal', label: 'Subtitles', emoji: '💬' },
  metadata: { icon: Database, color: 'indigo', label: 'Metadata', emoji: '🗄️' },
  lyrics: { icon: Radio, color: 'fuchsia', label: 'Lyrics', emoji: '🎤' },
  screensaver: { icon: Monitor, color: 'slate', label: 'Screensavers', emoji: '🖥️' },
  weather: { icon: Sun, color: 'amber', label: 'Weather', emoji: '☀️' },
  repository: { icon: Cloud, color: 'sky', label: 'Repositories', emoji: '☁️' },
  game: { icon: Gamepad2, color: 'red', label: 'Games', emoji: '🎮' },
  other: { icon: Package, color: 'gray', label: 'Other', emoji: '📁' },
};

// WatchNexus plugin type config
const pluginTypeConfig = {
  metadata_provider: { icon: Database, color: 'blue', label: 'Metadata' },
  indexer_provider: { icon: Globe, color: 'green', label: 'Indexer' },
  subtitle_provider: { icon: MessageSquare, color: 'yellow', label: 'Subtitles' },
  notification_provider: { icon: Bell, color: 'pink', label: 'Notifications' },
  theme_provider: { icon: Palette, color: 'purple', label: 'Theme' },
  scheduled_task: { icon: Calendar, color: 'orange', label: 'Scheduled' },
};

export const PluginMarketplacePage = () => {
  const [activeTab, setActiveTab] = useState('kodi');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  
  // Kodi addons state
  const [kodiAddons, setKodiAddons] = useState([]);
  const [kodiCategories, setKodiCategories] = useState({});
  const [popularAddons, setPopularAddons] = useState([]);
  const [loadingKodi, setLoadingKodi] = useState(false);
  
  // WatchNexus plugins state
  const [installedPlugins, setInstalledPlugins] = useState([]);
  const [loadingPlugins, setLoadingPlugins] = useState(false);
  
  // UI state
  const [selectedAddon, setSelectedAddon] = useState(null);
  const [installing, setInstalling] = useState(null);

  const getToken = () => localStorage.getItem('token');
  const getAuthHeader = () => ({ Authorization: `Bearer ${getToken()}` });

  // Fetch Kodi categories
  const fetchKodiCategories = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/kodi/categories`, { headers: getAuthHeader() });
      setKodiCategories(res.data.categories || {});
    } catch (err) {
      console.error('Failed to fetch Kodi categories:', err);
    }
  }, []);

  // Fetch popular Kodi addons
  const fetchPopularAddons = useCallback(async () => {
    setLoadingKodi(true);
    try {
      const res = await axios.get(`${API_URL}/api/kodi/addons/popular?limit=12`, { headers: getAuthHeader() });
      setPopularAddons(res.data.addons || []);
    } catch (err) {
      console.error('Failed to fetch popular addons:', err);
    } finally {
      setLoadingKodi(false);
    }
  }, []);

  // Fetch Kodi addons by category or search
  const fetchKodiAddons = useCallback(async (category = null, query = '') => {
    setLoadingKodi(true);
    try {
      let url = `${API_URL}/api/kodi/addons?limit=100`;
      if (query) url += `&query=${encodeURIComponent(query)}`;
      if (category) url += `&category=${category}`;
      
      const res = await axios.get(url, { headers: getAuthHeader() });
      setKodiAddons(res.data.addons || []);
    } catch (err) {
      console.error('Failed to fetch Kodi addons:', err);
      toast.error('Failed to fetch addons');
    } finally {
      setLoadingKodi(false);
    }
  }, []);

  // Fetch installed WatchNexus plugins
  const fetchInstalledPlugins = useCallback(async () => {
    setLoadingPlugins(true);
    try {
      const res = await axios.get(`${API_URL}/api/gadgets/plugins`, { headers: getAuthHeader() });
      setInstalledPlugins(res.data || []);
    } catch (err) {
      console.error('Failed to fetch installed plugins:', err);
    } finally {
      setLoadingPlugins(false);
    }
  }, []);

  // Refresh Kodi repository
  const refreshKodiRepo = async () => {
    setLoadingKodi(true);
    try {
      await axios.post(`${API_URL}/api/kodi/refresh`, {}, { headers: getAuthHeader() });
      toast.success('Kodi repository refreshed');
      await fetchKodiCategories();
      await fetchPopularAddons();
    } catch (err) {
      toast.error('Failed to refresh repository');
    } finally {
      setLoadingKodi(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchKodiCategories();
    fetchPopularAddons();
    fetchInstalledPlugins();
  }, [fetchKodiCategories, fetchPopularAddons, fetchInstalledPlugins]);

  // Search handler
  useEffect(() => {
    if (activeTab === 'kodi' && searchQuery) {
      const debounce = setTimeout(() => {
        fetchKodiAddons(selectedCategory, searchQuery);
      }, 300);
      return () => clearTimeout(debounce);
    }
  }, [searchQuery, selectedCategory, activeTab, fetchKodiAddons]);

  // Category selection handler
  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    setSearchQuery('');
    fetchKodiAddons(category);
  };

  // Go back to categories
  const handleBackToCategories = () => {
    setSelectedCategory(null);
    setKodiAddons([]);
    setSearchQuery('');
  };

  // Kodi Addon Card
  const KodiAddonCard = ({ addon }) => {
    const categoryConfig = kodiCategoryConfig[addon.category] || kodiCategoryConfig.other;
    
    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="glass-card rounded-xl overflow-hidden hover:border-violet-500/30 transition-all cursor-pointer group"
        onClick={() => setSelectedAddon(addon)}
      >
        <div className="aspect-video bg-gradient-to-br from-violet-500/20 to-pink-500/20 relative overflow-hidden">
          {addon.icon ? (
            <img 
              src={addon.icon} 
              alt={addon.name}
              className="w-full h-full object-contain p-4"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">
              {categoryConfig.emoji}
            </div>
          )}
          <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium bg-${categoryConfig.color}-500/30 text-${categoryConfig.color}-300`}>
            {categoryConfig.label}
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-bold text-white truncate group-hover:text-violet-400 transition-colors">
            {addon.name}
          </h3>
          <p className="text-sm text-gray-400 mt-1 line-clamp-2">
            {addon.summary || addon.description || 'No description available'}
          </p>
          <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
            <span>{addon.provider}</span>
            <span>v{addon.version}</span>
          </div>
        </div>
      </motion.div>
    );
  };

  // Category Card (Kodi-style)
  const CategoryCard = ({ category, count }) => {
    const config = kodiCategoryConfig[category] || kodiCategoryConfig.other;
    const Icon = config.icon;
    
    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => handleCategorySelect(category)}
        className="glass-card rounded-xl p-6 text-left hover:border-violet-500/30 transition-all group"
      >
        <div className={`w-12 h-12 rounded-xl bg-${config.color}-500/20 flex items-center justify-center mb-4`}>
          <Icon className={`w-6 h-6 text-${config.color}-400`} />
        </div>
        <h3 className="font-bold text-white group-hover:text-violet-400 transition-colors">
          {config.label}
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {count} add-ons
        </p>
      </motion.button>
    );
  };

  // Installed Plugin Card
  const InstalledPluginCard = ({ plugin }) => {
    const config = pluginTypeConfig[plugin.plugin_type] || pluginTypeConfig.metadata_provider;
    const Icon = config.icon;
    
    return (
      <div className="glass-card rounded-xl p-4 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl bg-${config.color}-500/20 flex items-center justify-center flex-shrink-0`}>
          {plugin.icon ? (
            <span className="text-2xl">{plugin.icon}</span>
          ) : (
            <Icon className={`w-6 h-6 text-${config.color}-400`} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white truncate">{plugin.name}</h3>
          <p className="text-sm text-gray-400 truncate">{plugin.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            plugin.enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
          }`}>
            {plugin.enabled ? 'Enabled' : 'Disabled'}
          </span>
          <span className="text-xs text-gray-500">v{plugin.version}</span>
        </div>
      </div>
    );
  };

  // Addon Detail Modal
  const AddonDetailModal = ({ addon, onClose }) => {
    if (!addon) return null;
    
    const categoryConfig = kodiCategoryConfig[addon.category] || kodiCategoryConfig.other;
    
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="glass-card rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with image */}
          <div className="aspect-video bg-gradient-to-br from-violet-500/20 to-pink-500/20 relative">
            {addon.fanart ? (
              <img 
                src={addon.fanart} 
                alt={addon.name}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : addon.icon ? (
              <img 
                src={addon.icon} 
                alt={addon.name}
                className="w-full h-full object-contain p-8"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-6xl">
                {categoryConfig.emoji}
              </div>
            )}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Content */}
          <div className="p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-2xl font-bold text-white">{addon.name}</h2>
                <p className="text-gray-400">{addon.provider}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium bg-${categoryConfig.color}-500/20 text-${categoryConfig.color}-300`}>
                {categoryConfig.label}
              </span>
            </div>
            
            <p className="text-gray-300 mb-6">
              {addon.description || addon.summary || 'No description available'}
            </p>
            
            {/* Info grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-3 rounded-lg bg-white/5">
                <p className="text-xs text-gray-500">Version</p>
                <p className="font-medium">{addon.version}</p>
              </div>
              <div className="p-3 rounded-lg bg-white/5">
                <p className="text-xs text-gray-500">Platform</p>
                <p className="font-medium">{addon.platform || 'All'}</p>
              </div>
              <div className="p-3 rounded-lg bg-white/5">
                <p className="text-xs text-gray-500">License</p>
                <p className="font-medium">{addon.license || 'Unknown'}</p>
              </div>
              <div className="p-3 rounded-lg bg-white/5">
                <p className="text-xs text-gray-500">Category</p>
                <p className="font-medium">{addon.category}</p>
              </div>
            </div>
            
            {/* Dependencies */}
            {addon.dependencies && addon.dependencies.length > 0 && (
              <div className="mb-6">
                <h3 className="font-medium mb-2">Dependencies</h3>
                <div className="flex flex-wrap gap-2">
                  {addon.dependencies.slice(0, 8).map((dep, i) => (
                    <span key={i} className="px-2 py-1 rounded text-xs bg-white/5 text-gray-400">
                      {dep.addon} {dep.version && `>= ${dep.version}`}
                    </span>
                  ))}
                  {addon.dependencies.length > 8 && (
                    <span className="px-2 py-1 rounded text-xs bg-white/5 text-gray-500">
                      +{addon.dependencies.length - 8} more
                    </span>
                  )}
                </div>
              </div>
            )}
            
            {/* Actions */}
            <div className="flex gap-3">
              {addon.website && (
                <Button
                  variant="outline"
                  onClick={() => window.open(addon.website, '_blank')}
                  className="flex-1"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Website
                </Button>
              )}
              <Button
                className="flex-1 bg-violet-600 hover:bg-violet-700"
                disabled={installing === addon.id}
              >
                {installing === addon.id ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Install Add-on
              </Button>
            </div>
            
            <p className="text-xs text-gray-500 text-center mt-4">
              Note: Kodi add-on compatibility with WatchNexus may vary
            </p>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  return (
    <Layout>
      <div data-testid="plugin-marketplace-page" className="space-y-6 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Package className="w-8 h-8 text-violet-400" />
              Add-ons & Plugins
            </h1>
            <p className="text-gray-400 mt-1">
              Extend WatchNexus with add-ons from Kodi and the community
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={refreshKodiRepo}
              disabled={loadingKodi}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loadingKodi ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white/5 p-1 rounded-xl">
            <TabsTrigger value="kodi" className="data-[state=active]:bg-violet-600">
              <Globe className="w-4 h-4 mr-2" />
              Kodi Repository
            </TabsTrigger>
            <TabsTrigger value="installed" className="data-[state=active]:bg-violet-600">
              <Check className="w-4 h-4 mr-2" />
              Installed ({installedPlugins.length})
            </TabsTrigger>
            <TabsTrigger value="convert" className="data-[state=active]:bg-violet-600">
              <ArrowRight className="w-4 h-4 mr-2" />
              Convert Plugin
            </TabsTrigger>
          </TabsList>

          {/* Kodi Repository Tab */}
          <TabsContent value="kodi" className="mt-6">
            {/* Search bar */}
            <div className="flex gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Search add-ons..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10"
                />
              </div>
              {selectedCategory && (
                <Button variant="outline" onClick={handleBackToCategories}>
                  ← Back to Categories
                </Button>
              )}
            </div>

            {/* Loading state */}
            {loadingKodi && (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-violet-400" />
              </div>
            )}

            {/* Category grid (when no category selected and no search) */}
            {!loadingKodi && !selectedCategory && !searchQuery && (
              <>
                {/* Popular Add-ons */}
                {popularAddons.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <Star className="w-5 h-5 text-yellow-400" />
                      Popular Add-ons
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                      {popularAddons.map((addon) => (
                        <KodiAddonCard key={addon.id} addon={addon} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Categories */}
                <div>
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-violet-400" />
                    Browse by Category
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {Object.entries(kodiCategories)
                      .sort((a, b) => b[1] - a[1])
                      .map(([cat, count]) => (
                        <CategoryCard key={cat} category={cat} count={count} />
                      ))}
                  </div>
                </div>
              </>
            )}

            {/* Addon list (when category selected or searching) */}
            {!loadingKodi && (selectedCategory || searchQuery) && (
              <div>
                {selectedCategory && (
                  <h2 className="text-xl font-bold mb-4">
                    {kodiCategoryConfig[selectedCategory]?.label || selectedCategory}
                    <span className="text-gray-500 font-normal ml-2">
                      ({kodiAddons.length} add-ons)
                    </span>
                  </h2>
                )}
                {searchQuery && (
                  <h2 className="text-xl font-bold mb-4">
                    Search results for "{searchQuery}"
                    <span className="text-gray-500 font-normal ml-2">
                      ({kodiAddons.length} found)
                    </span>
                  </h2>
                )}
                
                {kodiAddons.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No add-ons found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {kodiAddons.map((addon) => (
                      <KodiAddonCard key={addon.id} addon={addon} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Installed Plugins Tab */}
          <TabsContent value="installed" className="mt-6">
            {loadingPlugins ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-violet-400" />
              </div>
            ) : installedPlugins.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No plugins installed</p>
                <p className="text-sm mt-2">Browse the Kodi repository to find add-ons</p>
              </div>
            ) : (
              <div className="space-y-3">
                {installedPlugins.map((plugin) => (
                  <InstalledPluginCard key={plugin.id} plugin={plugin} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Convert Plugin Tab */}
          <TabsContent value="convert" className="mt-6">
            <PluginConverter />
          </TabsContent>
        </Tabs>

        {/* Addon Detail Modal */}
        <AnimatePresence>
          {selectedAddon && (
            <AddonDetailModal 
              addon={selectedAddon} 
              onClose={() => setSelectedAddon(null)} 
            />
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
};

export default PluginMarketplacePage;
