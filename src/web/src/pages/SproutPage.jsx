import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Rss, Plus, Trash2, RefreshCw, Copy, ExternalLink,
  Key, Settings, Film, Tv, Globe, Lock, CheckCircle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/switch';
import { cn } from '../lib/utils';

const API = process.env.REACT_APP_BACKEND_URL || '';

const TabButton = ({ active, onClick, icon: Icon, label }) => (
  <button
    onClick={onClick}
    data-testid={`sprout-tab-${label.toLowerCase()}`}
    className={cn(
      "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
      active
        ? "bg-green-500/15 text-green-400 border border-green-500/20"
        : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
    )}
  >
    <Icon className="w-4 h-4" />
    {label}
  </button>
);

export const SproutPage = () => {
  const [feeds, setFeeds] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('feeds');

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const [feedsRes, configRes] = await Promise.all([
        axios.get(`${API}/api/sprout/feeds`, { headers }),
        axios.get(`${API}/api/sprout/config`, { headers }),
      ]);
      setFeeds(Array.isArray(feedsRes.data) ? feedsRes.data : []);
      setConfig(configRes.data);
    } catch (e) {
      console.error('Sprout fetch error:', e);
        toast.error('Sprout fetch error:');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const copyFeedUrl = (url) => {
    navigator.clipboard.writeText(url);
    toast.success('Feed URL copied to clipboard');
  };

  const generateApiKey = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API}/api/sprout/generate-key`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.api_key) {
        setConfig(prev => ({ ...prev, api_key: res.data.api_key }));
        toast.success('New API key generated');
      }
    } catch (e) {
      toast.error('Failed to generate key');
    }
  };

  const saveConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/api/sprout/config`, config, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      toast.success('RSS settings saved');
    } catch (e) {
      toast.error('Failed to save');
    }
  };

  if (loading) return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </Layout>
  );

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl mx-auto p-6 space-y-6"
        data-testid="sprout-page"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">RSS Feeds</h1>
            <p className="text-sm text-gray-400 mt-1">Generate RSS feeds from your library</p>
          </div>
          <Button onClick={fetchData} variant="outline" className="border-white/10" data-testid="sprout-refresh-btn">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        <div className="flex gap-2">
          <TabButton active={tab === 'feeds'} onClick={() => setTab('feeds')} icon={Rss} label="Feeds" />
          <TabButton active={tab === 'settings'} onClick={() => setTab('settings')} icon={Settings} label="Settings" />
        </div>

        {tab === 'feeds' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {feeds.length === 0 ? (
              <div className="p-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center">
                <Rss className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                <p className="text-lg text-gray-400">No feeds available</p>
                <p className="text-sm text-gray-600 mt-1">Configure RSS settings to generate feeds</p>
              </div>
            ) : (
              feeds.map((feed, i) => {
                const icons = { recent: RefreshCw, movies: Film, tv: Tv };
                const Icon = icons[feed.id] || Rss;
                return (
                  <motion.div
                    key={feed.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-green-500/20 transition-all"
                    data-testid={`feed-${feed.id}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-white">{feed.name}</h3>
                          <span className="px-2 py-0.5 rounded text-xs bg-white/5 text-gray-400">
                            {feed.item_count} items
                          </span>
                          <span className="px-2 py-0.5 rounded text-xs bg-green-500/10 text-green-400">
                            {feed.format?.toUpperCase() || 'RSS'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <code className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded font-mono truncate flex-1">
                            {feed.url}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyFeedUrl(feed.url)}
                            className="text-gray-400 hover:text-white"
                            data-testid={`copy-feed-${feed.id}`}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(feed.url, '_blank')}
                            className="text-gray-400 hover:text-white"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </motion.div>
        )}

        {tab === 'settings' && config && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">Feed Settings</h3>
                  <p className="text-sm text-gray-400">Configure RSS feed generation</p>
                </div>
                <Switch
                  checked={config.enabled ?? true}
                  onCheckedChange={(v) => setConfig({ ...config, enabled: v })}
                  data-testid="sprout-enabled"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Site Title</label>
                  <Input
                    value={config.site_title || ''}
                    onChange={(e) => setConfig({ ...config, site_title: e.target.value })}
                    className="bg-white/5 border-white/10"
                    data-testid="sprout-site-title"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Items Per Feed</label>
                  <Input
                    type="number"
                    value={config.items_per_feed || 50}
                    onChange={(e) => setConfig({ ...config, items_per_feed: parseInt(e.target.value) || 50 })}
                    className="bg-white/5 border-white/10"
                    data-testid="sprout-items-per-feed"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-1 block">Description</label>
                <Input
                  value={config.site_description || ''}
                  onChange={(e) => setConfig({ ...config, site_description: e.target.value })}
                  className="bg-white/5 border-white/10"
                  data-testid="sprout-description"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={config.include_posters ?? true}
                    onCheckedChange={(v) => setConfig({ ...config, include_posters: v })}
                  />
                  <span className="text-sm text-gray-300">Include poster images in feeds</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={config.require_api_key ?? true}
                    onCheckedChange={(v) => setConfig({ ...config, require_api_key: v })}
                  />
                  <span className="text-sm text-gray-300">Require API key for feed access</span>
                </div>
              </div>

              {/* API Key */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-3">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-medium text-white">Feed API Key</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm text-gray-400 bg-white/5 px-3 py-2 rounded font-mono">
                    {config.api_key || 'No key generated'}
                  </code>
                  {config.api_key && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { navigator.clipboard.writeText(config.api_key); toast.success('Key copied'); }}
                      className="text-gray-400"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={generateApiKey}
                    className="bg-green-600/20 text-green-400 hover:bg-green-600/30"
                    data-testid="sprout-generate-key"
                  >
                    <Key className="w-3.5 h-3.5 mr-1.5" /> Generate
                  </Button>
                </div>
              </div>

              <Button onClick={saveConfig} className="bg-green-600 hover:bg-green-700" data-testid="sprout-save-btn">
                <CheckCircle className="w-4 h-4 mr-2" /> Save Settings
              </Button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </Layout>
  );
};

export default SproutPage;
