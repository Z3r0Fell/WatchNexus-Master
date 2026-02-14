import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Download, Zap, Package, CheckCircle, AlertTriangle, RefreshCw, Check,
  DownloadCloud, Clock, Trash2, Globe, Wifi, WifiOff, Settings
} from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { toast } from 'sonner';
import { torrentEngineApi, qbittorrentApi } from '../../services/api';

export const DownloadSettings = () => {
  const [downloadClientMode, setDownloadClientMode] = useState('builtin');
  const [engineStatus, setEngineStatus] = useState(null);
  const [engineSettings, setEngineSettings] = useState({
    max_active_downloads: 3, max_active_uploads: 3, max_active_torrents: 5,
    max_download_rate: 0, max_upload_rate: 0, seed_ratio_limit: 1.0,
    seed_time_limit: 60, seed_ratio_action: 'pause',
    remove_after_completion: false, remove_after_seeding: false,
    delete_files_on_remove: false, max_completed_torrents: 50,
    max_connections_global: 200, max_connections_per_torrent: 50,
    enable_dht: true, enable_pex: true, enable_lsd: true,
    sequential_download_default: true, add_paused: false,
  });
  const [savingEngineSettings, setSavingEngineSettings] = useState(false);
  const [testingEngine, setTestingEngine] = useState(false);
  const [qbitConfig, setQbitConfig] = useState({ host: 'localhost', port: '8080', username: 'admin', password: '' });
  const [qbitStatus, setQbitStatus] = useState(null);
  const [testingQbit, setTestingQbit] = useState(false);

  const fetchEngineStatus = useCallback(async () => {
    try { const res = await torrentEngineApi.getStatus(); setEngineStatus(res.data); } catch { setEngineStatus({ success: false, error: 'Engine not available' }); }
  }, []);

  const fetchEngineSettings = useCallback(async () => {
    try { const res = await torrentEngineApi.getSettings(); setEngineSettings(prev => ({ ...prev, ...res.data })); } catch {}
  }, []);

  useEffect(() => {
    fetchEngineStatus(); fetchEngineSettings();
    const savedMode = localStorage.getItem('watchnexus_download_mode');
    if (savedMode) setDownloadClientMode(savedMode);
  }, [fetchEngineStatus, fetchEngineSettings]);

  const saveEngineSettings = async () => {
    setSavingEngineSettings(true);
    try { await torrentEngineApi.updateSettings(engineSettings); toast.success('Engine settings saved'); }
    catch { toast.error('Failed to save settings'); }
    finally { setSavingEngineSettings(false); }
  };

  const handleTestQbit = async () => {
    setTestingQbit(true);
    try {
      const res = await qbittorrentApi.testConnection(qbitConfig.host, parseInt(qbitConfig.port), qbitConfig.username, qbitConfig.password);
      setQbitStatus(res.data);
      res.data.success ? toast.success(`Connected to qBittorrent v${res.data.version}`) : toast.error(res.data.error || 'Connection failed');
    } catch { toast.error('Failed to connect to qBittorrent'); setQbitStatus({ success: false, error: 'Connection failed' }); }
    finally { setTestingQbit(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="download-settings">
      {/* Mode Selection */}
      <div className="glass-card rounded-xl p-6">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-4"><Download className="w-5 h-5 text-violet-400" /> Download Client</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button onClick={() => { setDownloadClientMode('builtin'); localStorage.setItem('watchnexus_download_mode', 'builtin'); }}
            className={`p-4 rounded-xl border-2 text-left transition-all ${downloadClientMode === 'builtin' ? 'border-violet-500 bg-violet-500/10' : 'border-white/10 bg-surface hover:border-white/20'}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${downloadClientMode === 'builtin' ? 'bg-violet-500' : 'bg-white/10'}`}>
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div><h3 className="font-bold">Built-in Engine</h3><span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">Recommended</span></div>
            </div>
            <p className="text-sm text-gray-400">No external apps required! Fully integrated torrent engine with streaming support.</p>
          </button>
          <button onClick={() => { setDownloadClientMode('qbittorrent'); localStorage.setItem('watchnexus_download_mode', 'qbittorrent'); }}
            className={`p-4 rounded-xl border-2 text-left transition-all ${downloadClientMode === 'qbittorrent' ? 'border-violet-500 bg-violet-500/10' : 'border-white/10 bg-surface hover:border-white/20'}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${downloadClientMode === 'qbittorrent' ? 'bg-violet-500' : 'bg-white/10'}`}>
                <Package className="w-5 h-5 text-white" />
              </div>
              <div><h3 className="font-bold">qBittorrent</h3><span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">External App</span></div>
            </div>
            <p className="text-sm text-gray-400">Connect to external qBittorrent instance. Requires separate installation.</p>
          </button>
        </div>
      </div>

      {/* Built-in Engine */}
      {downloadClientMode === 'builtin' && (
        <div className="space-y-6">
          <div className="glass-card rounded-xl p-6">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-4"><Zap className="w-5 h-5 text-green-400" /> Engine Status</h3>
            <div className={`p-4 rounded-xl border ${engineStatus?.success ? 'bg-green-500/10 border-green-500/30' : 'bg-surface border-white/10'}`}>
              <div className="flex items-center gap-3">
                {engineStatus?.success ? <CheckCircle className="w-5 h-5 text-green-400" /> : <AlertTriangle className="w-5 h-5 text-yellow-400" />}
                <div className="flex-1">
                  <p className={engineStatus?.success ? 'text-green-400 font-medium' : 'text-yellow-400'}>
                    {engineStatus?.success ? `${engineStatus.engine} - Running` : 'Engine Starting...'}
                  </p>
                  {engineStatus?.transfer && (
                    <p className="text-sm text-gray-400">
                      &darr; {engineStatus.transfer.download_rate_formatted} | &uarr; {engineStatus.transfer.upload_rate_formatted} | {engineStatus.transfer.downloading} downloading | {engineStatus.transfer.seeding} seeding | DHT: {engineStatus.transfer.dht_nodes} nodes
                    </p>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => { setTestingEngine(true); fetchEngineStatus().finally(() => setTestingEngine(false)); }} disabled={testingEngine}>
                  <RefreshCw className={`w-4 h-4 ${testingEngine ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-xl p-6">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-4"><DownloadCloud className="w-5 h-5 text-blue-400" /> Queue Management</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { key: 'max_active_downloads', label: 'Max Active Downloads', rec: '3-5' },
                { key: 'max_active_uploads', label: 'Max Active Uploads', rec: '2-4' },
                { key: 'max_active_torrents', label: 'Max Total Active', rec: '5-10' },
              ].map(({ key, label, rec }) => (
                <div key={key}>
                  <label className="text-sm text-gray-400 mb-2 block">{label}</label>
                  <Input type="number" min="1" max="30" value={engineSettings[key]}
                    onChange={(e) => setEngineSettings(p => ({ ...p, [key]: parseInt(e.target.value) || 3 }))}
                    className="bg-white/5 border-white/10" />
                  <p className="text-xs text-gray-500 mt-1">Recommended: {rec}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-xl p-6">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-4"><Zap className="w-5 h-5 text-yellow-400" /> Speed Limits</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'max_download_rate', label: 'Max Download Speed (KB/s)' },
                { key: 'max_upload_rate', label: 'Max Upload Speed (KB/s)' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-sm text-gray-400 mb-2 block">{label}</label>
                  <Input type="number" min="0" value={engineSettings[key]}
                    onChange={(e) => setEngineSettings(p => ({ ...p, [key]: parseInt(e.target.value) || 0 }))}
                    className="bg-white/5 border-white/10" placeholder="0 = Unlimited" />
                  <p className="text-xs text-gray-500 mt-1">0 = Unlimited</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-xl p-6">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-4"><Clock className="w-5 h-5 text-purple-400" /> Seeding Limits</h3>
            <p className="text-sm text-gray-400 mb-4">Stop seeding when either condition is met (whichever comes first)</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Seed Ratio Limit</label>
                <Input type="number" min="0" step="0.1" value={engineSettings.seed_ratio_limit}
                  onChange={(e) => setEngineSettings(p => ({ ...p, seed_ratio_limit: parseFloat(e.target.value) || 0 }))}
                  className="bg-white/5 border-white/10" placeholder="1.0" />
                <p className="text-xs text-gray-500 mt-1">0 = Disabled | 1.0 = Equal upload</p>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Seed Time Limit (minutes)</label>
                <Input type="number" min="0" value={engineSettings.seed_time_limit}
                  onChange={(e) => setEngineSettings(p => ({ ...p, seed_time_limit: parseInt(e.target.value) || 0 }))}
                  className="bg-white/5 border-white/10" placeholder="60" />
                <p className="text-xs text-gray-500 mt-1">0 = Disabled</p>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">When Limit Reached</label>
                <select value={engineSettings.seed_ratio_action}
                  onChange={(e) => setEngineSettings(p => ({ ...p, seed_ratio_action: e.target.value }))}
                  className="w-full h-10 px-3 rounded-md bg-white/5 border border-white/10 text-white">
                  <option value="pause">Pause Torrent</option><option value="remove">Remove Torrent</option>
                  <option value="remove_with_data">Remove + Delete Files</option>
                </select>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-xl p-6">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-4"><Trash2 className="w-5 h-5 text-red-400" /> Auto-Cleanup</h3>
            <p className="text-sm text-gray-400 mb-4">Automatically manage completed torrents to prevent buildup</p>
            <div className="space-y-4">
              {[
                { key: 'remove_after_completion', label: 'Remove After Download Complete', desc: 'Immediately remove torrent when download finishes' },
                { key: 'remove_after_seeding', label: 'Remove After Seeding Limit', desc: 'Remove torrent when seeding limit is reached' },
                { key: 'delete_files_on_remove', label: 'Delete Files When Removing', desc: 'Will delete downloaded content!', warn: true },
              ].map(({ key, label, desc, warn }) => (
                <div key={key} className="flex items-center justify-between">
                  <div><p className="font-medium">{label}</p><p className={`text-sm ${warn ? 'text-red-400' : 'text-gray-500'}`}>{desc}</p></div>
                  <Switch checked={engineSettings[key]} onCheckedChange={(checked) => setEngineSettings(p => ({ ...p, [key]: checked }))} />
                </div>
              ))}
              <div className="pt-4 border-t border-white/10">
                <label className="text-sm text-gray-400 mb-2 block">Max Completed Torrents to Keep</label>
                <Input type="number" min="0" value={engineSettings.max_completed_torrents}
                  onChange={(e) => setEngineSettings(p => ({ ...p, max_completed_torrents: parseInt(e.target.value) || 0 }))}
                  className="bg-white/5 border-white/10 w-32" placeholder="50" />
                <p className="text-xs text-gray-500 mt-1">0 = Keep all | Oldest will be auto-removed when exceeded</p>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-xl p-6">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-4"><Globe className="w-5 h-5 text-cyan-400" /> Connection Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {[
                { key: 'max_connections_global', label: 'Global Max Connections', rec: '200-500', min: 10, max: 1000 },
                { key: 'max_connections_per_torrent', label: 'Max Connections Per Torrent', rec: '50-100', min: 5, max: 200 },
              ].map(({ key, label, rec, min, max }) => (
                <div key={key}>
                  <label className="text-sm text-gray-400 mb-2 block">{label}</label>
                  <Input type="number" min={min} max={max} value={engineSettings[key]}
                    onChange={(e) => setEngineSettings(p => ({ ...p, [key]: parseInt(e.target.value) || 200 }))}
                    className="bg-white/5 border-white/10" />
                  <p className="text-xs text-gray-500 mt-1">Recommended: {rec}</p>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {[
                { key: 'enable_dht', label: 'DHT (Distributed Hash Table)', desc: 'Find peers without trackers' },
                { key: 'enable_pex', label: 'PEX (Peer Exchange)', desc: 'Share peers with other clients' },
                { key: 'enable_lsd', label: 'LSD (Local Service Discovery)', desc: 'Find peers on local network' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between">
                  <div><p className="font-medium">{label}</p><p className="text-sm text-gray-500">{desc}</p></div>
                  <Switch checked={engineSettings[key]} onCheckedChange={(checked) => setEngineSettings(p => ({ ...p, [key]: checked }))} />
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-xl p-6">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-4"><Settings className="w-5 h-5 text-gray-400" /> Behavior</h3>
            <div className="space-y-4">
              {[
                { key: 'sequential_download_default', label: 'Sequential Download by Default', desc: 'Download pieces in order (better for streaming)' },
                { key: 'add_paused', label: 'Add Torrents Paused', desc: 'New torrents start paused for manual review' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between">
                  <div><p className="font-medium">{label}</p><p className="text-sm text-gray-500">{desc}</p></div>
                  <Switch checked={engineSettings[key]} onCheckedChange={(checked) => setEngineSettings(p => ({ ...p, [key]: checked }))} />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={saveEngineSettings} disabled={savingEngineSettings} className="bg-violet-600 hover:bg-violet-700">
              {savingEngineSettings ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Save Engine Settings
            </Button>
          </div>
        </div>
      )}

      {/* qBittorrent */}
      {downloadClientMode === 'qbittorrent' && (
        <div className="glass-card rounded-xl p-6 space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-2"><Package className="w-5 h-5 text-blue-400" /> qBittorrent Connection</h3>
          <div className={`p-4 rounded-xl border ${qbitStatus?.success ? 'bg-green-500/10 border-green-500/30' : 'bg-surface border-white/10'}`}>
            <div className="flex items-center gap-3">
              {qbitStatus?.success ? <Wifi className="w-5 h-5 text-green-400" /> : <WifiOff className="w-5 h-5 text-gray-400" />}
              <div>
                <p className={qbitStatus?.success ? 'text-green-400 font-medium' : 'text-gray-400'}>
                  {qbitStatus?.success ? `Connected - v${qbitStatus.version}` : 'Not Connected'}
                </p>
                {qbitStatus?.error && <p className="text-sm text-red-400">{qbitStatus.error}</p>}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'host', label: 'Host', placeholder: 'localhost' },
              { key: 'port', label: 'Port', placeholder: '8080' },
              { key: 'username', label: 'Username', placeholder: 'admin' },
              { key: 'password', label: 'Password', placeholder: 'password', type: 'password' },
            ].map(({ key, label, placeholder, type }) => (
              <div key={key}>
                <label className="text-sm text-gray-400 mb-2 block">{label}</label>
                <Input type={type || 'text'} value={qbitConfig[key]} onChange={(e) => setQbitConfig(p => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder} className="bg-white/5 border-white/10" />
              </div>
            ))}
          </div>
          <Button onClick={handleTestQbit} disabled={testingQbit} className="bg-violet-600 hover:bg-violet-700">
            {testingQbit ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Wifi className="w-4 h-4 mr-2" />} Test Connection
          </Button>
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <h4 className="font-medium text-blue-400 mb-2">Setup Instructions</h4>
            <ol className="text-sm text-blue-300 space-y-1 list-decimal list-inside">
              <li>Install qBittorrent from qbittorrent.org</li><li>Enable Web UI in Tools - Options - Web UI</li>
              <li>Set username and password</li><li>Enter connection details above and test</li>
            </ol>
          </div>
        </div>
      )}
    </motion.div>
  );
};
