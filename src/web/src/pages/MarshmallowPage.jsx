import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Cloud, RefreshCw, Loader2, CheckCircle2, Settings, Wifi, WifiOff, Clock, List } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { Layout } from '../components/layout/Layout';
import axios from 'axios';
import { BACKEND_URL } from '../lib/config';

const API = BACKEND_URL;

const MarshmallowPage = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState({ enabled: false, provider: 'watchnexus-cloud', sync_interval: 60, categories: 'watchlist,progress,settings' });

  const fetch_ = useCallback(async () => { try { const res = await axios.get(`${API}/api/marshmallow/status`); setStatus(res.data); setConfig(prev => ({ ...prev, ...res.data })); } catch {} finally { setLoading(false); } }, []);
  useEffect(() => { fetch_(); }, [fetch_]);

  const handleSync = async () => {
    setSyncing(true);
    try { const res = await axios.post(`${API}/api/marshmallow/sync`); toast.success(`Synced ${res.data.items_synced} items`); fetch_(); } catch { toast.error('Sync failed'); }
    finally { setSyncing(false); }
  };

  const handleSaveConfig = async () => { try { await axios.post(`${API}/api/marshmallow/config`, config); toast.success('Sync settings saved'); fetch_(); setShowConfig(false); } catch {} };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6" data-testid="marshmallow-page">
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-bold text-white flex items-center gap-3"><Cloud className="w-8 h-8 text-pink-400" /> Cloud Sync</h1><p className="text-gray-400 text-sm mt-1">Sync your library across all devices</p></div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowConfig(!showConfig)}><Settings className="w-4 h-4 mr-1" /> Settings</Button>
            <Button size="sm" onClick={handleSync} disabled={syncing} className="bg-pink-600 hover:bg-pink-700">{syncing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />} Sync Now</Button>
          </div>
        </div>

        {/* Status Card */}
        {status && (
          <div className="bg-surface border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${status.enabled ? 'bg-pink-500/10' : 'bg-gray-500/10'}`}>
                {status.enabled ? <Wifi className="w-7 h-7 text-pink-400" /> : <WifiOff className="w-7 h-7 text-gray-500" />}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{status.enabled ? 'Sync Active' : 'Sync Disabled'}</h2>
                <p className="text-sm text-gray-400">{status.sync_provider || 'No provider configured'}</p>
              </div>
              <div className="ml-auto text-right">
                {status.last_sync && (<p className="text-sm text-gray-400"><Clock className="w-3.5 h-3.5 inline mr-1" />Last: {new Date(status.last_sync).toLocaleString()}</p>)}
                <p className="text-xs text-gray-500 mt-1">{status.items_synced || 0} items synced</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['watchlist', 'progress', 'settings'].map(cat => {
                const active = (status.categories || '').includes(cat);
                return (
                  <div key={cat} className={`rounded-xl p-4 border ${active ? 'border-pink-500/30 bg-pink-500/5' : 'border-white/5 bg-white/[0.02]'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {active ? <CheckCircle2 className="w-4 h-4 text-pink-400" /> : <div className="w-4 h-4 rounded-full border border-gray-600" />}
                      <span className="text-sm font-medium text-white capitalize">{cat}</span>
                    </div>
                    <p className="text-xs text-gray-500">{cat === 'watchlist' ? 'Sync your watchlist across devices' : cat === 'progress' ? 'Continue watching on any device' : 'App preferences and configurations'}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Config Panel */}
        {showConfig && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-surface border border-white/10 rounded-2xl p-6 space-y-4">
            <h3 className="font-semibold text-white">Sync Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="text-xs text-gray-400 mb-1 block">Enable Sync</label><select value={config.enabled ? 'true' : 'false'} onChange={(e) => setConfig(p => ({ ...p, enabled: e.target.value === 'true' }))} className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm"><option value="true">Enabled</option><option value="false">Disabled</option></select></div>
              <div><label className="text-xs text-gray-400 mb-1 block">Sync Interval (minutes)</label><input type="number" value={config.sync_interval || 60} onChange={(e) => setConfig(p => ({ ...p, sync_interval: parseInt(e.target.value) }))} className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm" /></div>
              <div className="md:col-span-2"><label className="text-xs text-gray-400 mb-1 block">Categories (comma-separated)</label><input type="text" value={config.categories || ''} onChange={(e) => setConfig(p => ({ ...p, categories: e.target.value }))} placeholder="watchlist,progress,settings" className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600" /></div>
            </div>
            <div className="flex gap-2"><Button onClick={handleSaveConfig} className="bg-pink-600">Save</Button><Button variant="ghost" onClick={() => setShowConfig(false)}>Cancel</Button></div>
          </motion.div>
        )}
      </div>
    </Layout>
  );
};

export default MarshmallowPage;
