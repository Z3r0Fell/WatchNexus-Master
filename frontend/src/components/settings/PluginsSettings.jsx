import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Package, RefreshCw, ExternalLink, Sparkles, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { toast } from 'sonner';
import axios from 'axios';

export const PluginsSettings = () => {
  const [plugins, setPlugins] = useState([]);
  const [loadingPlugins, setLoadingPlugins] = useState(false);
  const [togglingPlugin, setTogglingPlugin] = useState(null);

  const fetchPlugins = useCallback(async () => {
    setLoadingPlugins(true);
    try { const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/gadgets/plugins`); setPlugins(res.data || []); }
    catch {} finally { setLoadingPlugins(false); }
  }, []);

  useEffect(() => { fetchPlugins(); }, [fetchPlugins]);

  const handleTogglePlugin = async (pluginId, currentStatus) => {
    setTogglingPlugin(pluginId);
    try {
      const action = currentStatus === 'active' ? 'disable' : 'enable';
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/gadgets/plugins/${pluginId}/${action}`);
      toast.success(`Plugin ${action === 'enable' ? 'enabled' : 'disabled'}!`); fetchPlugins();
    } catch { toast.error('Failed to toggle plugin'); }
    finally { setTogglingPlugin(null); }
  };

  const handleDiscoverPlugins = async () => {
    setLoadingPlugins(true);
    try { await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/gadgets/discover`); toast.success('Plugin discovery complete!'); fetchPlugins(); }
    catch { toast.error('Failed to discover plugins'); }
    finally { setLoadingPlugins(false); }
  };

  const pluginTypeColors = {
    metadata_provider: 'bg-blue-500/20 text-blue-400',
    indexer_provider: 'bg-green-500/20 text-green-400',
    subtitle_provider: 'bg-yellow-500/20 text-yellow-400',
    notification_provider: 'bg-pink-500/20 text-pink-400',
    theme_provider: 'bg-purple-500/20 text-purple-400',
    scheduled_task: 'bg-orange-500/20 text-orange-400',
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-xl p-6 space-y-6" data-testid="plugins-settings">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Package className="w-5 h-5 text-violet-400" /> Plugins
          <span className="text-xs bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full">Gadgets</span>
        </h2>
        <Button onClick={handleDiscoverPlugins} disabled={loadingPlugins} variant="outline" className="border-white/10 hover:bg-white/5">
          <RefreshCw className={`w-4 h-4 mr-2 ${loadingPlugins ? 'animate-spin' : ''}`} /> Discover Plugins
        </Button>
      </div>
      <p className="text-gray-400">Extend WatchNexus functionality with custom plugins.</p>

      <div className="flex flex-wrap gap-2">
        {Object.entries(pluginTypeColors).map(([type, color]) => (
          <span key={type} className={`px-2 py-1 rounded-full text-xs ${color}`}>{type.replace('_', ' ')}</span>
        ))}
      </div>

      <div className="space-y-3">
        {loadingPlugins && plugins.length === 0 ? (
          <div className="text-center py-8 text-gray-500"><RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" /> Loading plugins...</div>
        ) : plugins.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No plugins installed</p>
            <p className="text-sm mt-1">Place plugins in the plugins directory and click "Discover Plugins"</p>
          </div>
        ) : (
          plugins.map((plugin) => (
            <motion.div key={plugin.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-surface border border-white/5 hover:border-white/10 transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium">{plugin.name}</h3>
                    <span className="text-xs text-gray-500">v{plugin.version}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${pluginTypeColors[plugin.plugin_type] || 'bg-gray-500/20 text-gray-400'}`}>
                      {plugin.plugin_type?.replace('_', ' ')}
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
                </div>
              </div>
              {plugin.error_message && (
                <div className="mt-3 p-2 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{plugin.error_message}</div>
              )}
            </motion.div>
          ))
        )}
      </div>

      <div className="p-4 rounded-xl bg-white/5 border border-white/10">
        <h3 className="font-medium mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-400" /> Example Plugins (Bundled)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-black/20">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                <Package className="w-4 h-4" />
              </div>
              <div><p className="font-medium text-sm">AniDB Metadata</p><p className="text-xs text-gray-500">Anime metadata from AniDB</p></div>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-black/20">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Package className="w-4 h-4" />
              </div>
              <div><p className="font-medium text-sm">Discord Notifications</p><p className="text-xs text-gray-500">Send alerts to Discord</p></div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
        <p className="text-sm text-violet-400">
          <strong>Plugin Directory:</strong> <code className="bg-black/30 px-2 py-0.5 rounded">/plugins</code><br />
          <span className="text-gray-400 text-xs">Place plugin folders with a <code>manifest.json</code> to install them.</span>
        </p>
      </div>
    </motion.div>
  );
};
