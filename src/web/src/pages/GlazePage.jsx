import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Activity, Link2, Clock, CheckCircle, Settings, RefreshCw,
  ExternalLink, Play, History, Save
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/switch';
import { cn } from '../lib/utils';

const API = process.env.REACT_APP_BACKEND_URL || '';

const TabButton = ({ active, onClick, icon: Icon, label }) => (
  <button
    onClick={onClick}
    data-testid={`glaze-tab-${label.toLowerCase()}`}
    className={cn(
      "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
      active
        ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
        : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
    )}
  >
    <Icon className="w-4 h-4" />
    {label}
  </button>
);

export const GlazePage = () => {
  const [config, setConfig] = useState(null);
  const [tab, setTab] = useState('trakt');
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const [configRes, historyRes] = await Promise.all([
        axios.get(`${API}/api/glaze/config`, { headers }),
        axios.get(`${API}/api/glaze/trakt/history?limit=20`, { headers }),
      ]);
      setConfig(configRes.data);
      setHistory(historyRes.data || []);
    } catch (e) {
      console.error('Glaze fetch error:', e);
        toast.error('Glaze fetch error:');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const saveConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/api/glaze/config`, config, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      toast.success('Scrobbling settings saved');
    } catch (e) {
      toast.error('Failed to save settings');
    }
  };

  const syncTrakt = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/api/glaze/trakt/sync`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Trakt sync initiated');
    } catch (e) {
      toast.error('Sync failed');
    }
  };

  const authorizeTrakt = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API}/api/glaze/trakt/authorize`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.authorization_url) {
        window.open(res.data.authorization_url, '_blank');
        toast.success('Follow the authorization page to connect Trakt');
      }
    } catch (e) {
      toast.error('Authorization failed');
    }
  };

  if (loading) return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </Layout>
  );

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl mx-auto p-6 space-y-6"
        data-testid="glaze-page"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Scrobbling</h1>
            <p className="text-sm text-gray-400 mt-1">Trakt.tv & Last.fm integration</p>
          </div>
          <Button onClick={saveConfig} className="bg-amber-600 hover:bg-amber-700" data-testid="glaze-save-btn">
            <Save className="w-4 h-4 mr-2" /> Save Settings
          </Button>
        </div>

        <div className="flex gap-2">
          <TabButton active={tab === 'trakt'} onClick={() => setTab('trakt')} icon={Activity} label="Trakt.tv" />
          <TabButton active={tab === 'lastfm'} onClick={() => setTab('lastfm')} icon={Activity} label="Last.fm" />
          <TabButton active={tab === 'history'} onClick={() => setTab('history')} icon={History} label="History" />
        </div>

        {tab === 'trakt' && config && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">Trakt.tv</h3>
                  <p className="text-sm text-gray-400">Sync your watch history and collections</p>
                </div>
                <Switch
                  checked={config.trakt?.enabled ?? false}
                  onCheckedChange={(v) => setConfig({ ...config, trakt: { ...config.trakt, enabled: v } })}
                  data-testid="trakt-enabled-switch"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Client ID</label>
                  <Input
                    value={config.trakt?.client_id ?? ''}
                    onChange={(e) => setConfig({ ...config, trakt: { ...config.trakt, client_id: e.target.value } })}
                    placeholder="Enter Trakt Client ID"
                    className="bg-white/5 border-white/10"
                    data-testid="trakt-client-id"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Access Token</label>
                  <Input
                    value={config.trakt?.access_token ?? ''}
                    onChange={(e) => setConfig({ ...config, trakt: { ...config.trakt, access_token: e.target.value } })}
                    placeholder="Auto-filled after authorization"
                    className="bg-white/5 border-white/10"
                    data-testid="trakt-access-token"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={config.trakt?.auto_scrobble ?? true}
                    onCheckedChange={(v) => setConfig({ ...config, trakt: { ...config.trakt, auto_scrobble: v } })}
                  />
                  <span className="text-sm text-gray-300">Auto-scrobble</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={config.trakt?.sync_collection ?? false}
                    onCheckedChange={(v) => setConfig({ ...config, trakt: { ...config.trakt, sync_collection: v } })}
                  />
                  <span className="text-sm text-gray-300">Sync Collection</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={config.trakt?.sync_watchlist ?? false}
                    onCheckedChange={(v) => setConfig({ ...config, trakt: { ...config.trakt, sync_watchlist: v } })}
                  />
                  <span className="text-sm text-gray-300">Sync Watchlist</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button onClick={authorizeTrakt} variant="outline" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10" data-testid="trakt-authorize-btn">
                  <ExternalLink className="w-4 h-4 mr-2" /> Authorize Trakt
                </Button>
                <Button onClick={syncTrakt} variant="outline" className="border-white/10 text-gray-300 hover:bg-white/5" data-testid="trakt-sync-btn">
                  <RefreshCw className="w-4 h-4 mr-2" /> Sync Now
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {tab === 'lastfm' && config && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">Last.fm</h3>
                  <p className="text-sm text-gray-400">Scrobble music plays to your profile</p>
                </div>
                <Switch
                  checked={config.lastfm?.enabled ?? false}
                  onCheckedChange={(v) => setConfig({ ...config, lastfm: { ...config.lastfm, enabled: v } })}
                  data-testid="lastfm-enabled-switch"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">API Key</label>
                  <Input
                    value={config.lastfm?.api_key ?? ''}
                    onChange={(e) => setConfig({ ...config, lastfm: { ...config.lastfm, api_key: e.target.value } })}
                    placeholder="Enter Last.fm API Key"
                    className="bg-white/5 border-white/10"
                    data-testid="lastfm-api-key"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Session Key</label>
                  <Input
                    value={config.lastfm?.session_key ?? ''}
                    onChange={(e) => setConfig({ ...config, lastfm: { ...config.lastfm, session_key: e.target.value } })}
                    placeholder="Auto-filled after authorization"
                    className="bg-white/5 border-white/10"
                    data-testid="lastfm-session-key"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Switch
                  checked={config.lastfm?.auto_scrobble ?? true}
                  onCheckedChange={(v) => setConfig({ ...config, lastfm: { ...config.lastfm, auto_scrobble: v } })}
                />
                <span className="text-sm text-gray-300">Auto-scrobble music</span>
              </div>
            </div>
          </motion.div>
        )}

        {tab === 'history' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <h3 className="text-lg font-semibold text-white mb-4">Scrobble History</h3>
              {history.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No scrobble history yet</p>
                  <p className="text-sm mt-1">Start watching content with scrobbling enabled</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] transition-colors">
                      <Play className="w-4 h-4 text-amber-400" />
                      <span className="text-sm text-gray-300">{item.title || 'Unknown'}</span>
                      <span className="ml-auto text-xs text-gray-500">{item.scrobbled_at || ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </motion.div>
    </Layout>
  );
};

export default GlazePage;
