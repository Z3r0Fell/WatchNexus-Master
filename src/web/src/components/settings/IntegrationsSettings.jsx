import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Film, Server, Key, CheckCircle, XCircle, RefreshCw, Wifi, WifiOff, Eye, EyeOff } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import { integrationApi } from '../../services/nexusApi';
import { SettingsTabHeader, SettingsTabContent } from './SettingsTabHeader';

const TABS = [
  { id: 'tmdb', label: 'TMDB Metadata', icon: Film },
  { id: 'qbittorrent', label: 'qBittorrent', icon: Server },
];

export const IntegrationsSettings = () => {
  const [activeTab, setActiveTab] = useState('tmdb');
  const [loading, setLoading] = useState(true);

  // TMDB state
  const [tmdbKey, setTmdbKey] = useState('');
  const [tmdbStatus, setTmdbStatus] = useState({ has_key: false, source: 'none' });
  const [savingTmdb, setSavingTmdb] = useState(false);
  const [showTmdbKey, setShowTmdbKey] = useState(false);

  // qBittorrent state
  const [qbitSettings, setQbitSettings] = useState({
    host: 'localhost', port: 8080, username: 'admin', password: '', enabled: false,
  });
  const [savingQbit, setSavingQbit] = useState(false);
  const [testingQbit, setTestingQbit] = useState(false);
  const [qbitTestResult, setQbitTestResult] = useState(null);
  const [showQbitPass, setShowQbitPass] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await integrationApi.getAll();
      const data = res.data;
      if (data.tmdb) {
        setTmdbKey(data.tmdb.api_key || '');
        setTmdbStatus({ has_key: data.tmdb.has_key, source: data.tmdb.source });
      }
      if (data.qbittorrent) {
        setQbitSettings(data.qbittorrent);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSaveTmdb = async () => {
    setSavingTmdb(true);
    try {
      await integrationApi.updateTmdb(tmdbKey);
      toast.success('TMDB API key saved and validated');
      setTmdbStatus({ has_key: !!tmdbKey, source: 'user' });
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Invalid TMDB API key');
    }
    finally { setSavingTmdb(false); }
  };

  const handleSaveQbit = async () => {
    setSavingQbit(true);
    try {
      await integrationApi.updateQbit(qbitSettings);
      toast.success('qBittorrent settings saved');
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to save'); }
    finally { setSavingQbit(false); }
  };

  const handleTestQbit = async () => {
    setTestingQbit(true);
    setQbitTestResult(null);
    try {
      const res = await integrationApi.testQbit(qbitSettings);
      setQbitTestResult(res.data);
      if (res.data.success) toast.success('Connected to qBittorrent');
      else toast.error('Connection failed');
    } catch { toast.error('Connection test failed'); setQbitTestResult({ success: false }); }
    finally { setTestingQbit(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div data-testid="integrations-settings" className="space-y-6">
      <SettingsTabHeader
        title="Integrations"
        subtitle="Configure external service connections"
        icon={Film}
        tabs={TABS}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        iconColor="text-blue-400"
        iconBgColor="from-blue-600 to-cyan-500"
        help={{ title: "Integrations", description: "Connect WatchNexus to external services for metadata, artwork, and media information. TMDB provides movie/TV data, and Matrix enables federated chat functionality.", examples: ["TMDB: Get a free API key at themoviedb.org/settings/api", "Matrix: Connect to a Matrix homeserver for social features", "API keys are stored securely on your server"] }}
      />

      {activeTab === 'tmdb' && (
        <SettingsTabContent activeTab={activeTab}>
          <div className="space-y-6">
            {/* Status */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              {tmdbStatus.has_key ? (
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {tmdbStatus.has_key ? 'TMDB Connected' : 'TMDB Not Configured'}
                </p>
                <p className="text-xs text-gray-500">
                  {tmdbStatus.source === 'env' && 'Using server environment key'}
                  {tmdbStatus.source === 'user' && 'Using your personal API key'}
                  {tmdbStatus.source === 'none' && 'No API key configured - library scanning will not fetch metadata'}
                </p>
              </div>
            </div>

            {/* API Key Input */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-300">TMDB API Key</label>
              <p className="text-xs text-gray-500">
                Get your free API key from{' '}
                <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer"
                  className="text-blue-400 hover:underline">themoviedb.org</a>
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showTmdbKey ? 'text' : 'password'}
                    value={tmdbKey}
                    onChange={e => setTmdbKey(e.target.value)}
                    placeholder="Enter your TMDB API key (v3 auth)"
                    data-testid="tmdb-api-key-input"
                    className="bg-white/5 border-white/10 pr-10"
                  />
                  <button onClick={() => setShowTmdbKey(!showTmdbKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                    {showTmdbKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button onClick={handleSaveTmdb} disabled={savingTmdb} data-testid="save-tmdb-btn"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6">
                  {savingTmdb ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Save & Validate'}
                </Button>
              </div>
            </div>

            {/* Info */}
            <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
              <h4 className="text-sm font-medium text-blue-400 mb-2">What does TMDB provide?</h4>
              <ul className="text-xs text-gray-400 space-y-1.5 list-disc list-inside">
                <li>Movie and TV show metadata (titles, overviews, ratings)</li>
                <li>High-quality poster and backdrop artwork</li>
                <li>Genre classification and release dates</li>
                <li>Cast information and recommendations</li>
              </ul>
            </div>
          </div>
        </SettingsTabContent>
      )}

      {activeTab === 'qbittorrent' && (
        <SettingsTabContent activeTab={activeTab}>
          <div className="space-y-6">
            {/* Enable Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="flex items-center gap-3">
                {qbitSettings.enabled ? (
                  <Wifi className="w-5 h-5 text-emerald-400" />
                ) : (
                  <WifiOff className="w-5 h-5 text-gray-500" />
                )}
                <div>
                  <p className="text-sm font-medium">qBittorrent Integration</p>
                  <p className="text-xs text-gray-500">Connect to your qBittorrent instance for download management</p>
                </div>
              </div>
              <button
                onClick={() => setQbitSettings(p => ({ ...p, enabled: !p.enabled }))}
                data-testid="qbit-toggle"
                className={`relative w-12 h-6 rounded-full transition-colors ${qbitSettings.enabled ? 'bg-emerald-500' : 'bg-gray-600'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${qbitSettings.enabled ? 'translate-x-6' : ''}`} />
              </button>
            </div>

            {/* Connection Settings */}
            <motion.div initial={false} animate={{ opacity: qbitSettings.enabled ? 1 : 0.4 }}
              className={!qbitSettings.enabled ? 'pointer-events-none' : ''}>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400">Host</label>
                  <Input value={qbitSettings.host}
                    onChange={e => setQbitSettings(p => ({ ...p, host: e.target.value }))}
                    data-testid="qbit-host-input" placeholder="localhost"
                    className="bg-white/5 border-white/10" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400">Port</label>
                  <Input type="number" value={qbitSettings.port}
                    onChange={e => setQbitSettings(p => ({ ...p, port: parseInt(e.target.value) || 8080 }))}
                    data-testid="qbit-port-input" placeholder="8080"
                    className="bg-white/5 border-white/10" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400">Username</label>
                  <Input value={qbitSettings.username}
                    onChange={e => setQbitSettings(p => ({ ...p, username: e.target.value }))}
                    data-testid="qbit-user-input" placeholder="admin"
                    className="bg-white/5 border-white/10" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400">Password</label>
                  <div className="relative">
                    <Input type={showQbitPass ? 'text' : 'password'} value={qbitSettings.password}
                      onChange={e => setQbitSettings(p => ({ ...p, password: e.target.value }))}
                      data-testid="qbit-pass-input" placeholder="password"
                      className="bg-white/5 border-white/10 pr-10" />
                    <button onClick={() => setShowQbitPass(!showQbitPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                      {showQbitPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Test Result */}
              {qbitTestResult && (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                  className={`mt-4 p-3 rounded-lg border text-sm ${qbitTestResult.success ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                  {qbitTestResult.success ? (
                    <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Connected successfully</span>
                  ) : (
                    <span className="flex items-center gap-2"><XCircle className="w-4 h-4" /> Connection failed - check settings</span>
                  )}
                </motion.div>
              )}

              {/* Actions */}
              <div className="flex gap-2 mt-4">
                <Button onClick={handleTestQbit} disabled={testingQbit} data-testid="test-qbit-btn"
                  variant="outline" className="border-white/10">
                  {testingQbit ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : <Wifi className="w-4 h-4 mr-1.5" />}
                  Test Connection
                </Button>
                <Button onClick={handleSaveQbit} disabled={savingQbit} data-testid="save-qbit-btn"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {savingQbit ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : null}
                  Save Settings
                </Button>
              </div>
            </motion.div>

            {/* Info */}
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <h4 className="text-sm font-medium text-emerald-400 mb-2">qBittorrent Setup</h4>
              <ul className="text-xs text-gray-400 space-y-1.5 list-disc list-inside">
                <li>Enable the Web UI in qBittorrent: Tools &rarr; Options &rarr; Web UI</li>
                <li>Default port is 8080 with username "admin"</li>
                <li>Ensure qBittorrent is running on the same network as WatchNexus</li>
                <li>Once connected, you can manage torrents directly from the Downloads page</li>
              </ul>
            </div>
          </div>
        </SettingsTabContent>
      )}
    </div>
  );
};
