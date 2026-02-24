import { BACKEND_URL } from '../lib/config';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { 
  Package, Search, Download, Star, ExternalLink, Check, X,
  RefreshCw, Filter, Grid, List, Shield, Code, Globe, Tv,
  MessageSquare, Palette, Calendar, Database, Bell, ChevronRight,
  Music, Image, Settings, Gamepad2, Monitor, Zap, Box, Layers,
  Play, Radio, Cloud, Sun, Eye, ArrowRight, Upload, Link
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { PluginConverter } from '../components/PluginConverter';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = BACKEND_URL;

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

// Catalogue category icon mapping
const catalogueCategoryIcons = {
  metadata: Database,
  subtitle: MessageSquare,
  notification: Bell,
  theme: Palette,
  video: Tv,
  audio: Music,
  indexer: Globe,
  system: Settings,
  image: Image,
  game: Gamepad2,
  screensaver: Monitor,
  weather: Sun,
  program: Zap,
  service: Shield,
  context: Layers,
  resource: Box,
};

const catalogueCategoryColors = {
  metadata: 'from-indigo-500 to-blue-600',
  subtitle: 'from-teal-500 to-emerald-600',
  notification: 'from-pink-500 to-rose-600',
  theme: 'from-violet-500 to-purple-600',
  video: 'from-blue-500 to-cyan-600',
  audio: 'from-green-500 to-lime-600',
  indexer: 'from-amber-500 to-orange-600',
  system: 'from-slate-500 to-gray-600',
  image: 'from-fuchsia-500 to-pink-600',
  game: 'from-red-500 to-orange-600',
  screensaver: 'from-sky-500 to-blue-600',
  weather: 'from-yellow-500 to-amber-600',
  program: 'from-cyan-500 to-teal-600',
  service: 'from-emerald-500 to-green-600',
  context: 'from-rose-500 to-red-600',
  resource: 'from-orange-500 to-yellow-600',
};

export const PluginMarketplacePage = () => {
  const [activeTab, setActiveTab] = useState('catalogue');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  
  // Catalogue state
  const [catalogueItems, setCatalogueItems] = useState([]);
  const [catalogueCategories, setCatalogueCategories] = useState({});
  const [loadingCatalogue, setLoadingCatalogue] = useState(false);
  const [catalogueSearch, setCatalogueSearch] = useState('');
  const [selectedCatCategory, setSelectedCatCategory] = useState(null);
  
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
  
  // Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);

  const getToken = () => localStorage.getItem('token');
  const getAuthHeader = () => ({ Authorization: `Bearer ${getToken()}` });

  // Fetch Gadgets Catalogue
  const fetchCatalogue = useCallback(async (category = null, query = '') => {
    setLoadingCatalogue(true);
    try {
      let url = `${API_URL}/api/gadgets/catalogue/search?`;
      if (query) url += `q=${encodeURIComponent(query)}&`;
      if (category) url += `category=${category}&`;
      const res = await axios.get(url, { headers: getAuthHeader() });
      setCatalogueItems(res.data.items || []);
    } catch (err) {
      console.error('Failed to fetch catalogue:', err);
    } finally {
      setLoadingCatalogue(false);
    }
  }, []);

  const fetchCatalogueCategories = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/gadgets/catalogue/categories`, { headers: getAuthHeader() });
      setCatalogueCategories(res.data || {});
    } catch (err) {
      console.error('Failed to fetch catalogue categories:', err);
    }
  }, []);

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
    fetchCatalogue();
    fetchCatalogueCategories();
    fetchKodiCategories();
    fetchPopularAddons();
    fetchInstalledPlugins();
  }, [fetchCatalogue, fetchCatalogueCategories, fetchKodiCategories, fetchPopularAddons, fetchInstalledPlugins]);

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

  // Import plugin from file
  const handleImportFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.name.endsWith('.zip')) {
      toast.error('Only .zip files are supported');
      return;
    }
    
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await axios.post(`${API_URL}/api/gadgets/import-file`, formData, {
        headers: { ...getAuthHeader(), 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success(`Plugin "${res.data.name}" imported successfully!`);
      fetchInstalledPlugins();
      setShowImportModal(false);
    } catch (err) {
      console.error('Import failed:', err);
      toast.error(err.response?.data?.detail || 'Failed to import plugin');
    } finally {
      setImporting(false);
    }
  };

  // Import plugin from URL
  const handleImportUrl = async () => {
    if (!importUrl) {
      toast.error('Please enter a URL');
      return;
    }
    
    if (!importUrl.endsWith('.zip')) {
      toast.error('URL must point to a .zip file');
      return;
    }
    
    setImporting(true);
    try {
      const res = await axios.post(`${API_URL}/api/gadgets/import-url`, null, {
        params: { url: importUrl },
        headers: getAuthHeader()
      });
      
      toast.success(`Plugin "${res.data.name}" imported successfully!`);
      fetchInstalledPlugins();
      setShowImportModal(false);
      setImportUrl('');
    } catch (err) {
      console.error('Import failed:', err);
      toast.error(err.response?.data?.detail || 'Failed to import plugin from URL');
    } finally {
      setImporting(false);
    }
  };

  // Enable/disable plugin
  const handleTogglePlugin = async (plugin) => {
    try {
      const endpoint = plugin.status === 'active' 
        ? `/api/gadgets/plugins/${plugin.id}/disable`
        : `/api/gadgets/plugins/${plugin.id}/enable`;
      
      await axios.post(`${API_URL}${endpoint}`, {}, { headers: getAuthHeader() });
      toast.success(`Plugin ${plugin.status === 'active' ? 'disabled' : 'enabled'}`);
      fetchInstalledPlugins();
    } catch (err) {
      toast.error('Failed to toggle plugin');
    }
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
    const isActive = plugin.status === 'active';
    
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
            isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
          }`}>
            {isActive ? 'Active' : plugin.status || 'Installed'}
          </span>
          <span className="text-xs text-gray-500">v{plugin.version}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleTogglePlugin(plugin)}
            className={isActive ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'}
          >
            {isActive ? 'Disable' : 'Enable'}
          </Button>
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
            <TabsTrigger value="catalogue" className="data-[state=active]:bg-violet-600" data-testid="catalogue-tab">
              <Package className="w-4 h-4 mr-2" />
              Gadgets Catalogue
            </TabsTrigger>
            <TabsTrigger value="kodi" className="data-[state=active]:bg-violet-600" data-testid="kodi-tab">
              <Globe className="w-4 h-4 mr-2" />
              Kodi Repository
            </TabsTrigger>
            <TabsTrigger value="installed" className="data-[state=active]:bg-violet-600" data-testid="installed-tab">
              <Check className="w-4 h-4 mr-2" />
              Installed ({installedPlugins.length})
            </TabsTrigger>
            <TabsTrigger value="convert" className="data-[state=active]:bg-violet-600" data-testid="convert-tab">
              <ArrowRight className="w-4 h-4 mr-2" />
              Convert Plugin
            </TabsTrigger>
          </TabsList>

          {/* Gadgets Catalogue Tab */}
          <TabsContent value="catalogue" className="mt-6" data-testid="catalogue-content">
            {/* Search */}
            <div className="flex gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  placeholder="Search gadgets catalogue..."
                  value={catalogueSearch}
                  onChange={(e) => {
                    setCatalogueSearch(e.target.value);
                    fetchCatalogue(selectedCatCategory, e.target.value);
                  }}
                  className="pl-10 bg-white/5 border-white/10"
                  data-testid="catalogue-search"
                />
              </div>
              {selectedCatCategory && (
                <Button variant="outline" onClick={() => { setSelectedCatCategory(null); fetchCatalogue(null, catalogueSearch); }} data-testid="clear-cat-filter">
                  <X className="w-4 h-4 mr-2" /> Clear Filter
                </Button>
              )}
            </div>

            {/* Category Cards */}
            {!selectedCatCategory && !catalogueSearch && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
                {Object.entries(catalogueCategories).map(([key, cat]) => {
                  const Icon = catalogueCategoryIcons[key] || Package;
                  const gradient = catalogueCategoryColors[key] || 'from-gray-500 to-gray-600';
                  return (
                    <motion.button
                      key={key}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { setSelectedCatCategory(key); fetchCatalogue(key, ''); }}
                      className="rounded-xl bg-white/5 hover:bg-white/10 p-4 text-left transition-all"
                      data-testid={`cat-${key}`}
                    >
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center mb-3`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="font-semibold text-sm">{cat.label}</h3>
                      <p className="text-xs text-gray-400 mt-1">{cat.count} gadgets</p>
                    </motion.button>
                  );
                })}
              </div>
            )}

            {/* Gadgets Grid */}
            {loadingCatalogue ? (
              <div className="flex justify-center py-16">
                <RefreshCw className="w-8 h-8 animate-spin text-violet-500" />
              </div>
            ) : catalogueItems.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No gadgets found</p>
                <p className="text-sm mt-1">Try a different search or category</p>
              </div>
            ) : (
              <>
                {selectedCatCategory && (
                  <h2 className="text-lg font-semibold mb-4">
                    {catalogueCategories[selectedCatCategory]?.label || selectedCatCategory} ({catalogueItems.length})
                  </h2>
                )}
                <motion.div
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                  initial="hidden"
                  animate="show"
                  variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }}
                >
                  {catalogueItems.map((gadget) => {
                    const catConfig = catalogueCategoryIcons[gadget.category] ? { icon: catalogueCategoryIcons[gadget.category] } : { icon: Package };
                    const CatIcon = catConfig.icon;
                    const gradient = catalogueCategoryColors[gadget.category] || 'from-gray-500 to-gray-600';
                    return (
                      <motion.div
                        key={gadget.id}
                        variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                        className="glass-card rounded-xl p-5 hover:bg-white/10 transition-all"
                        data-testid={`gadget-${gadget.id}`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
                            <CatIcon className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm">{gadget.name}</h3>
                            <p className="text-xs text-gray-400 mt-1 line-clamp-2">{gadget.description}</p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {gadget.tags?.slice(0, 3).map(tag => (
                                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-gray-400">{tag}</span>
                              ))}
                            </div>
                            <div className="flex items-center justify-between mt-3">
                              <span className="text-[10px] text-gray-500">v{gadget.version} by {gadget.author}</span>
                              <Button size="sm" variant="outline" className="text-xs h-7" data-testid={`install-${gadget.id}`}>
                                {gadget.status === 'installed' ? <><Check className="w-3 h-3 mr-1" /> Installed</> : <><Download className="w-3 h-3 mr-1" /> Install</>}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </>
            )}
          </TabsContent>

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
            {/* Import button header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Installed Plugins</h2>
              <Button 
                onClick={() => setShowImportModal(true)}
                className="bg-violet-600 hover:bg-violet-700"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import Plugin
              </Button>
            </div>
            
            {loadingPlugins ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-violet-400" />
              </div>
            ) : installedPlugins.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No plugins installed</p>
                <p className="text-sm mt-2">Import a plugin ZIP file or browse the Kodi repository</p>
                <Button 
                  onClick={() => setShowImportModal(true)}
                  variant="outline"
                  className="mt-4"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Import Plugin
                </Button>
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

        {/* Import Plugin Modal */}
        <AnimatePresence>
          {showImportModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowImportModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="glass-card rounded-2xl max-w-md w-full p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Upload className="w-5 h-5 text-violet-400" />
                    Import Plugin
                  </h2>
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="p-1 rounded-full hover:bg-white/10"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Import from file */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Import from ZIP file
                  </label>
                  <label className="flex items-center justify-center gap-2 p-8 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:border-violet-500/50 transition-colors">
                    <Upload className="w-6 h-6 text-gray-400" />
                    <span className="text-gray-400">Click to select a .zip file</span>
                    <input
                      type="file"
                      accept=".zip"
                      className="hidden"
                      onChange={handleImportFile}
                      disabled={importing}
                    />
                  </label>
                </div>

                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-2 bg-gray-900 text-gray-500 text-sm">or</span>
                  </div>
                </div>

                {/* Import from URL */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Import from URL
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="https://example.com/plugin.zip"
                        value={importUrl}
                        onChange={(e) => setImportUrl(e.target.value)}
                        className="pl-10 bg-white/5 border-white/10"
                        disabled={importing}
                      />
                    </div>
                    <Button
                      onClick={handleImportUrl}
                      disabled={!importUrl || importing}
                      className="bg-violet-600 hover:bg-violet-700"
                    >
                      {importing ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-gray-500 text-center">
                  Plugins must have a valid manifest.json file in the root of the ZIP archive.
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
};

export default PluginMarketplacePage;
