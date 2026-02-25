import { BACKEND_URL } from '../../lib/config';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package, RefreshCw, ExternalLink, Sparkles, CheckCircle, AlertTriangle, 
  Upload, Link2, Trash2, Loader2, Tv, Search, Download, X, 
  Database, MessageSquare, Bell, Palette, Globe, Settings, 
  Image, Gamepad2, Monitor, Sun, Zap, Shield, Layers, Box, Music,
  ChevronRight, ArrowLeft, Check
} from 'lucide-react';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import axios from 'axios';
import { useGadgets } from '../../context/GadgetContext';

const categoryIcons = {
  metadata: Database, subtitle: MessageSquare, notification: Bell,
  theme: Palette, video: Tv, audio: Music, indexer: Globe,
  system: Settings, image: Image, game: Gamepad2, screensaver: Monitor,
  weather: Sun, program: Zap, service: Shield, context: Layers, resource: Box,
};

const categoryColors = {
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

export const PluginsSettings = () => {
  const { installed, isInstalled, isActive, install, uninstall, activate, deactivate, refresh: refreshGadgets } = useGadgets();
  const [activeView, setActiveView] = useState('catalogue');
  const [plugins, setPlugins] = useState([]);
  const [loadingPlugins, setLoadingPlugins] = useState(false);
  const [togglingPlugin, setTogglingPlugin] = useState(null);
  const [showImportOptions, setShowImportOptions] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [kodiAddonUrl, setKodiAddonUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [uninstallingPlugin, setUninstallingPlugin] = useState(null);
  const [installingGadget, setInstallingGadget] = useState(null);
  const fileInputRef = useRef(null);

  // Catalogue state
  const [catalogueItems, setCatalogueItems] = useState([]);
  const [catalogueCategories, setCatalogueCategories] = useState({});
  const [loadingCatalogue, setLoadingCatalogue] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [catalogueSearch, setCatalogueSearch] = useState('');

  const handleInstallGadget = async (gadgetId, gadgetName) => {
    setInstallingGadget(gadgetId);
    try {
      if (isInstalled(gadgetId)) {
        await uninstall(gadgetId);
        toast.success(`"${gadgetName}" uninstalled`);
      } else {
        await install(gadgetId);
        toast.success(`"${gadgetName}" installed and activated!`);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to ${isInstalled(gadgetId) ? 'uninstall' : 'install'}`);
    } finally {
      setInstallingGadget(null);
    }
  };

  const handleToggleGadget = async (gadgetId, currentlyActive) => {
    try {
      if (currentlyActive) {
        await deactivate(gadgetId);
        toast.success('Gadget deactivated');
      } else {
        await activate(gadgetId);
        toast.success('Gadget activated');
      }
    } catch {
      toast.error('Failed to toggle gadget');
    }
  };

  const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // ==================== CATALOGUE ====================
  const fetchCatalogue = useCallback(async (category = null, query = '') => {
    setLoadingCatalogue(true);
    try {
      let url = `${BACKEND_URL}/api/gadgets/catalogue/search?`;
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
      const res = await axios.get(`${BACKEND_URL}/api/gadgets/catalogue/categories`, { headers: getAuthHeader() });
      setCatalogueCategories(res.data || {});
    } catch (err) {
      console.error('Failed to fetch catalogue categories:', err);
    }
  }, []);

  // ==================== INSTALLED GADGETS ====================
  const fetchPlugins = useCallback(async () => {
    setLoadingPlugins(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/gadgets/plugins`, { headers: getAuthHeader() });
      setPlugins(res.data || []);
    } catch {} finally {
      setLoadingPlugins(false);
    }
  }, []);

  useEffect(() => {
    fetchPlugins();
    fetchCatalogue();
    fetchCatalogueCategories();
  }, [fetchPlugins, fetchCatalogue, fetchCatalogueCategories]);

  const handleTogglePlugin = async (pluginId, currentStatus) => {
    setTogglingPlugin(pluginId);
    try {
      const action = currentStatus === 'active' ? 'disable' : 'enable';
      await axios.post(`${BACKEND_URL}/api/gadgets/plugins/${pluginId}/${action}`, {}, { headers: getAuthHeader() });
      toast.success(`Gadget ${action === 'enable' ? 'enabled' : 'disabled'}!`);
      fetchPlugins();
    } catch {
      toast.error('Failed to toggle gadget');
    } finally {
      setTogglingPlugin(null);
    }
  };

  const handleDiscoverPlugins = async () => {
    setLoadingPlugins(true);
    try {
      await axios.post(`${BACKEND_URL}/api/gadgets/discover`, {}, { headers: getAuthHeader() });
      toast.success('Gadget discovery complete!');
      fetchPlugins();
    } catch {
      toast.error('Failed to discover gadgets');
    } finally {
      setLoadingPlugins(false);
    }
  };

  const handleFileImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.zip')) { toast.error('Only .zip files are supported'); return; }
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(`${BACKEND_URL}/api/gadgets/import-file`, formData, {
        headers: { ...getAuthHeader(), 'Content-Type': 'multipart/form-data' }
      });
      toast.success(`Gadget "${res.data.name}" imported!`);
      fetchPlugins();
      setShowImportOptions(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to import gadget');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUrlImport = async () => {
    if (!importUrl || !importUrl.endsWith('.zip')) { toast.error('Enter a valid .zip URL'); return; }
    setImporting(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/gadgets/import-url`, null, {
        params: { url: importUrl }, headers: getAuthHeader()
      });
      toast.success(`Gadget "${res.data.name}" imported!`);
      fetchPlugins();
      setImportUrl('');
      setShowImportOptions(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleUninstallPlugin = async (pluginId, pluginName) => {
    if (!window.confirm(`Uninstall "${pluginName}"? This will delete all gadget files.`)) return;
    setUninstallingPlugin(pluginId);
    try {
      await axios.delete(`${BACKEND_URL}/api/gadgets/plugins/${pluginId}/uninstall`, { headers: getAuthHeader() });
      toast.success(`"${pluginName}" uninstalled`);
      fetchPlugins();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Uninstall failed');
    } finally {
      setUninstallingPlugin(null);
    }
  };

  const handleCategorySelect = (catKey) => {
    setSelectedCategory(catKey);
    fetchCatalogue(catKey, '');
    setCatalogueSearch('');
  };

  const handleCatalogueSearch = (query) => {
    setCatalogueSearch(query);
    fetchCatalogue(selectedCategory, query);
  };

  const pluginTypeColors = {
    metadata_provider: 'bg-blue-500/20 text-blue-400',
    indexer_provider: 'bg-green-500/20 text-green-400',
    subtitle_provider: 'bg-yellow-500/20 text-yellow-400',
    notification_provider: 'bg-pink-500/20 text-pink-400',
    theme_provider: 'bg-purple-500/20 text-purple-400',
    scheduled_task: 'bg-orange-500/20 text-orange-400',
    stream_provider: 'bg-cyan-500/20 text-cyan-400',
    auth_provider: 'bg-emerald-500/20 text-emerald-400',
    general: 'bg-gray-500/20 text-gray-400',
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="gadgets-settings">
      {/* Header */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold" data-testid="gadgets-title">Gadgets</h2>
              <p className="text-sm text-gray-400">Extend WatchNexus with powerful add-ons</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowImportOptions(!showImportOptions)} variant="outline" className="border-white/10 hover:bg-white/5" data-testid="import-gadget-btn">
              <Upload className="w-4 h-4 mr-2" /> Import
            </Button>
            <Button onClick={handleDiscoverPlugins} disabled={loadingPlugins} variant="outline" className="border-white/10 hover:bg-white/5" data-testid="discover-gadgets-btn">
              <RefreshCw className={`w-4 h-4 mr-2 ${loadingPlugins ? 'animate-spin' : ''}`} /> Discover
            </Button>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex rounded-lg bg-white/5 p-1 w-fit" data-testid="gadgets-view-toggle">
          <button
            onClick={() => setActiveView('catalogue')}
            data-testid="gadgets-catalogue-tab"
            className={`px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors ${
              activeView === 'catalogue' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Package className="w-4 h-4" /> Browse Catalogue
          </button>
          <button
            onClick={() => setActiveView('installed')}
            data-testid="gadgets-installed-tab"
            className={`px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors ${
              activeView === 'installed' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Check className="w-4 h-4" /> Installed ({plugins.length})
          </button>
        </div>
      </div>

      {/* Import Options Panel */}
      <AnimatePresence>
        {showImportOptions && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card rounded-xl p-5 space-y-4 border border-violet-500/20"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-violet-400 flex items-center gap-2">
                <Upload className="w-4 h-4" /> Import Gadget
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setShowImportOptions(false)} className="h-7 w-7">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Upload .zip File</label>
                <input ref={fileInputRef} type="file" accept=".zip" onChange={handleFileImport} className="hidden" data-testid="gadget-file-input" />
                <Button onClick={() => fileInputRef.current?.click()} disabled={importing} variant="outline" className="w-full border-white/10">
                  {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  Choose .zip File
                </Button>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Import from URL</label>
                <div className="flex gap-2">
                  <Input value={importUrl} onChange={(e) => setImportUrl(e.target.value)}
                    placeholder="https://example.com/gadget.zip" className="bg-white/5 border-white/10" data-testid="gadget-url-input" />
                  <Button onClick={handleUrlImport} disabled={importing || !importUrl} className="bg-violet-600 hover:bg-violet-700">
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Gadget archives must contain a <code className="bg-black/30 px-1 rounded">manifest.json</code> file.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== CATALOGUE VIEW ==================== */}
      {activeView === 'catalogue' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
          {/* Search */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Search gadgets..."
                value={catalogueSearch}
                onChange={(e) => handleCatalogueSearch(e.target.value)}
                className="pl-10 bg-white/5 border-white/10"
                data-testid="catalogue-search"
              />
            </div>
            {selectedCategory && (
              <Button variant="outline" onClick={() => { setSelectedCategory(null); fetchCatalogue(null, catalogueSearch); }} className="border-white/10" data-testid="clear-category-btn">
                <ArrowLeft className="w-4 h-4 mr-2" /> All Categories
              </Button>
            )}
          </div>

          {/* Category Grid */}
          {!selectedCategory && !catalogueSearch && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" data-testid="category-grid">
              {Object.entries(catalogueCategories).map(([key, cat]) => {
                const Icon = categoryIcons[key] || Package;
                const gradient = categoryColors[key] || 'from-gray-500 to-gray-600';
                return (
                  <motion.button
                    key={key}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleCategorySelect(key)}
                    className="rounded-xl bg-white/5 hover:bg-white/10 p-4 text-left transition-all border border-transparent hover:border-white/10"
                    data-testid={`category-${key}`}
                  >
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center mb-3`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-semibold text-sm">{cat.label}</h3>
                    <p className="text-xs text-gray-400 mt-1">{cat.count} {cat.count === 1 ? 'gadget' : 'gadgets'}</p>
                  </motion.button>
                );
              })}
            </div>
          )}

          {/* Gadgets List */}
          {(selectedCategory || catalogueSearch) && (
            <>
              {selectedCategory && (
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  {(() => { const Icon = categoryIcons[selectedCategory] || Package; return <Icon className="w-5 h-5 text-violet-400" />; })()}
                  {catalogueCategories[selectedCategory]?.label || selectedCategory}
                  <span className="text-sm font-normal text-gray-400">({catalogueItems.length})</span>
                </h3>
              )}
              {loadingCatalogue ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                </div>
              ) : catalogueItems.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No gadgets found</p>
                  <p className="text-sm mt-1">Try a different search or category</p>
                </div>
              ) : (
                <motion.div
                  className="grid grid-cols-1 md:grid-cols-2 gap-3"
                  initial="hidden" animate="show"
                  variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.03 } } }}
                >
                  {catalogueItems.map((gadget) => {
                    const CatIcon = categoryIcons[gadget.category] || Package;
                    const gradient = categoryColors[gadget.category] || 'from-gray-500 to-gray-600';
                    return (
                      <motion.div
                        key={gadget.id}
                        variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                        className="glass-card rounded-xl p-4 hover:bg-white/10 transition-all border border-transparent hover:border-white/10"
                        data-testid={`gadget-${gadget.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
                            <CatIcon className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="font-semibold text-sm truncate">{gadget.name}</h4>
                              <span className="text-[10px] text-gray-500 flex-shrink-0">v{gadget.version}</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-1 line-clamp-2">{gadget.description}</p>
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex flex-wrap gap-1">
                                {gadget.tags?.slice(0, 3).map(tag => (
                                  <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-gray-500">{tag}</span>
                                ))}
                              </div>
                              <Button size="sm" variant={isInstalled(gadget.id) ? "default" : "outline"} 
                                className={`text-xs h-6 px-2 ${isInstalled(gadget.id) ? 'bg-green-600 hover:bg-red-600' : 'border-white/10'}`}
                                disabled={installingGadget === gadget.id}
                                onClick={() => handleInstallGadget(gadget.id, gadget.name)}
                                data-testid={`install-${gadget.id}`}>
                                {installingGadget === gadget.id ? <Loader2 className="w-3 h-3 animate-spin" /> :
                                  isInstalled(gadget.id) ? <><Check className="w-3 h-3 mr-1" /> Installed</> : <><Download className="w-3 h-3 mr-1" /> Get</>}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </>
          )}

          {/* Show all gadgets when no category and no search */}
          {!selectedCategory && !catalogueSearch && catalogueItems.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-400" /> All Gadgets ({catalogueItems.length})
              </h3>
              <motion.div
                className="grid grid-cols-1 md:grid-cols-2 gap-3"
                initial="hidden" animate="show"
                variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.02 } } }}
              >
                {catalogueItems.map((gadget) => {
                  const CatIcon = categoryIcons[gadget.category] || Package;
                  const gradient = categoryColors[gadget.category] || 'from-gray-500 to-gray-600';
                  return (
                    <motion.div
                      key={gadget.id}
                      variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                      className="glass-card rounded-xl p-4 hover:bg-white/10 transition-all border border-transparent hover:border-white/10"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
                          <CatIcon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-semibold text-sm truncate">{gadget.name}</h4>
                            <span className="text-[10px] text-gray-500 flex-shrink-0">v{gadget.version}</span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{gadget.description}</p>
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex flex-wrap gap-1">
                              {gadget.tags?.slice(0, 3).map(tag => (
                                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-gray-500">{tag}</span>
                              ))}
                            </div>
                            <Button size="sm" variant={isInstalled(gadget.id) ? "default" : "outline"}
                              className={`text-xs h-6 px-2 ${isInstalled(gadget.id) ? 'bg-green-600 hover:bg-red-600' : 'border-white/10'}`}
                              disabled={installingGadget === gadget.id}
                              onClick={() => handleInstallGadget(gadget.id, gadget.name)}>
                              {installingGadget === gadget.id ? <Loader2 className="w-3 h-3 animate-spin" /> :
                                isInstalled(gadget.id) ? <><Check className="w-3 h-3 mr-1" /> Installed</> : <><Download className="w-3 h-3 mr-1" /> Get</>}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>
          )}
        </motion.div>
      )}

      {/* ==================== INSTALLED VIEW ==================== */}
      {activeView === 'installed' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {/* Ripen-installed gadgets */}
          {installed.length > 0 && (
            <>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Catalogue Gadgets ({installed.length})</h3>
              {installed.map((gadget) => {
                const CatIcon = categoryIcons[gadget.category] || Package;
                const gradient = categoryColors[gadget.category] || 'from-gray-500 to-gray-600';
                return (
                  <motion.div key={gadget.gadget_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="glass-card rounded-xl p-4 hover:bg-white/10 transition-all" data-testid={`ripen-${gadget.gadget_id}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
                          <CatIcon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium">{gadget.name}</h3>
                            <span className="text-xs text-gray-500">v{gadget.version}</span>
                            {gadget.hooks?.sidebar && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400">+ sidebar</span>
                            )}
                            {gadget.hooks?.route && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400">+ page</span>
                            )}
                            {gadget.hooks?.settings_panel && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">+ settings</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-400 line-clamp-1">{gadget.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`px-2 py-1 rounded-full text-xs ${
                          gadget.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {gadget.status === 'active' ? <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Active</span> : <span>Inactive</span>}
                        </div>
                        <Switch checked={gadget.status === 'active'}
                          onCheckedChange={() => handleToggleGadget(gadget.gadget_id, gadget.status === 'active')} />
                        <Button variant="ghost" size="icon"
                          onClick={() => handleInstallGadget(gadget.gadget_id, gadget.name)}
                          disabled={installingGadget === gadget.gadget_id}
                          className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10">
                          {installingGadget === gadget.gadget_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </>
          )}

          {/* Legacy plugins (from filesystem) */}
          {plugins.length > 0 && (
            <>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mt-6">Custom Gadgets ({plugins.length})</h3>
            plugins.map((plugin) => (
              <motion.div key={plugin.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-xl p-4 hover:bg-white/10 transition-all" data-testid={`installed-${plugin.id}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{plugin.name}</h3>
                      <span className="text-xs text-gray-500">v{plugin.version}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${pluginTypeColors[plugin.plugin_type] || 'bg-gray-500/20 text-gray-400'}`}>
                        {plugin.plugin_type?.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mb-2">{plugin.description}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>by {plugin.author}</span>
                      {plugin.homepage && (
                        <a href={plugin.homepage} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> Homepage
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`px-2 py-1 rounded-full text-xs ${
                      plugin.status === 'active' ? 'bg-green-500/20 text-green-400' :
                      plugin.status === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {plugin.status === 'active' ? <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Active</span> :
                       plugin.status === 'error' ? <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Error</span> : <span>Disabled</span>}
                    </div>
                    <Switch checked={plugin.status === 'active'} disabled={togglingPlugin === plugin.id}
                      onCheckedChange={() => handleTogglePlugin(plugin.id, plugin.status)} />
                    <Button variant="ghost" size="icon"
                      onClick={() => handleUninstallPlugin(plugin.id, plugin.name)}
                      disabled={uninstallingPlugin === plugin.id}
                      className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      data-testid={`uninstall-${plugin.id}`}
                    >
                      {uninstallingPlugin === plugin.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                {plugin.error_message && (
                  <div className="mt-3 p-2 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{plugin.error_message}</div>
                )}
              </motion.div>
            ))
          )}

          {/* Directory Info */}
          <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <p className="text-sm text-violet-400">
              <strong>Gadget Directory:</strong> <code className="bg-black/30 px-2 py-0.5 rounded">/plugins</code><br />
              <span className="text-gray-400 text-xs">Place gadget folders with a <code>manifest.json</code> to install them, or use the Import button.</span>
            </p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
