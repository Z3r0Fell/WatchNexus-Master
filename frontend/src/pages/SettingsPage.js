import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { settingsApi, indexersApi, streamingApi, mediaHealthApi } from '../services/api';
import { toast } from 'sonner';
import { 
  Settings, Server, Download, Subtitles, Shield, 
  Folder, Check, X, Plus, Trash2, ExternalLink, Globe,
  AlertTriangle, CheckCircle, RefreshCw, FileSearch, Wrench, HardDrive
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

export const SettingsPage = () => {
  const [settings, setSettings] = useState({
    download_path: '/media/downloads',
    library_path: '/media/library',
    auto_subtitles: true,
    subtitle_languages: ['en'],
    quality_preference: '1080p',
    oauth_client_id: '',
    oauth_client_secret: '',
  });
  const [indexers, setIndexers] = useState([]);
  const [streamingServices, setStreamingServices] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [settingsRes, indexersRes, streamingRes] = await Promise.all([
        settingsApi.get().catch(() => ({ data: settings })),
        indexersApi.getAll(),
        streamingApi.getAll(),
      ]);
      setSettings(settingsRes.data);
      setIndexers(indexersRes.data || []);
      setStreamingServices(streamingRes.data || []);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await settingsApi.update(settings);
      toast.success('Settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleIndexerToggle = async (indexer) => {
    try {
      const updated = { ...indexer, enabled: !indexer.enabled };
      await indexersApi.update(indexer.id, updated);
      setIndexers(prev => prev.map(i => i.id === indexer.id ? updated : i));
      toast.success(`${indexer.name} ${updated.enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error('Failed to update indexer');
    }
  };

  const handleStreamingToggle = async (service) => {
    try {
      await streamingApi.update(service.id, !service.enabled);
      setStreamingServices(prev => prev.map(s => 
        s.id === service.id ? { ...s, enabled: !s.enabled } : s
      ));
      toast.success(`${service.name} ${service.enabled ? 'disabled' : 'enabled'}`);
    } catch (error) {
      toast.error('Failed to update streaming service');
    }
  };

  return (
    <Layout>
      <div data-testid="settings-page" className="min-h-screen p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Settings</h1>
              <p className="text-gray-400">Configure your WatchNexus instance</p>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="bg-surface border border-white/10">
            <TabsTrigger value="general" className="data-[state=active]:bg-violet-600">
              General
            </TabsTrigger>
            <TabsTrigger value="indexers" className="data-[state=active]:bg-violet-600">
              Indexers
            </TabsTrigger>
            <TabsTrigger value="download" className="data-[state=active]:bg-violet-600">
              Download Client
            </TabsTrigger>
            <TabsTrigger value="subtitles" className="data-[state=active]:bg-violet-600">
              Subtitles
            </TabsTrigger>
            <TabsTrigger value="streaming" className="data-[state=active]:bg-violet-600">
              Streaming Services
            </TabsTrigger>
            <TabsTrigger value="auth" className="data-[state=active]:bg-violet-600">
              Authentication
            </TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card rounded-xl p-6 space-y-6"
            >
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Folder className="w-5 h-5 text-violet-400" />
                Library Paths
              </h2>
              
              <div className="grid gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Library Path</label>
                  <Input
                    value={settings.library_path}
                    onChange={(e) => setSettings(s => ({ ...s, library_path: e.target.value }))}
                    data-testid="library-path-input"
                    className="bg-white/5 border-white/10"
                    placeholder="/media/library"
                  />
                  <p className="text-xs text-gray-500 mt-1">Where your organized media files are stored</p>
                </div>
                
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Download Path</label>
                  <Input
                    value={settings.download_path}
                    onChange={(e) => setSettings(s => ({ ...s, download_path: e.target.value }))}
                    data-testid="download-path-input"
                    className="bg-white/5 border-white/10"
                    placeholder="/media/downloads"
                  />
                  <p className="text-xs text-gray-500 mt-1">Temporary location for downloads before processing</p>
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Quality Preference</label>
                  <select
                    value={settings.quality_preference}
                    onChange={(e) => setSettings(s => ({ ...s, quality_preference: e.target.value }))}
                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
                  >
                    <option value="2160p">4K (2160p)</option>
                    <option value="1080p">Full HD (1080p)</option>
                    <option value="720p">HD (720p)</option>
                    <option value="480p">SD (480p)</option>
                  </select>
                </div>
              </div>

              <Button
                onClick={handleSaveSettings}
                disabled={saving}
                data-testid="save-general-btn"
                className="bg-violet-600 hover:bg-violet-700"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </motion.div>
          </TabsContent>

          {/* Indexers */}
          <TabsContent value="indexers">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card rounded-xl p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Server className="w-5 h-5 text-violet-400" />
                  Indexers
                </h2>
                <Button variant="outline" className="bg-white/5 border-white/10">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Indexer
                </Button>
              </div>

              <div className="space-y-3">
                {indexers.map((indexer) => (
                  <div
                    key={indexer.id}
                    data-testid={`indexer-${indexer.id}`}
                    className="flex items-center justify-between p-4 rounded-xl bg-surface border border-white/5"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        indexer.enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        <Globe className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium">{indexer.name}</p>
                        <p className="text-sm text-gray-500 mono">{indexer.url}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        indexer.type === 'torrent' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'
                      }`}>
                        {indexer.type}
                      </span>
                      <Switch
                        checked={indexer.enabled}
                        onCheckedChange={() => handleIndexerToggle(indexer)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-sm text-yellow-400">
                  <strong>Note:</strong> Enable indexers and provide API keys to search and download real content.
                  Leave disabled for demo mode with mock data.
                </p>
              </div>
            </motion.div>
          </TabsContent>

          {/* Download Client */}
          <TabsContent value="download">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card rounded-xl p-6 space-y-6"
            >
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Download className="w-5 h-5 text-violet-400" />
                Download Client
              </h2>

              <div className="grid gap-4">
                <div className="p-4 rounded-xl bg-surface border border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <Download className="w-5 h-5 text-green-400" />
                      </div>
                      <div>
                        <p className="font-medium">Built-in Client</p>
                        <p className="text-sm text-gray-500">Integrated torrent downloader</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm">
                      Active
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">
                    WatchNexus includes a built-in download client. No external software needed.
                  </p>
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Max Concurrent Downloads</label>
                  <select className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white">
                    <option value="3">3 Downloads</option>
                    <option value="5">5 Downloads</option>
                    <option value="10">10 Downloads</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Speed Limit (0 = Unlimited)</label>
                  <Input
                    type="number"
                    placeholder="0"
                    className="bg-white/5 border-white/10"
                  />
                </div>
              </div>

              <Button className="bg-violet-600 hover:bg-violet-700">
                Save Download Settings
              </Button>
            </motion.div>
          </TabsContent>

          {/* Subtitles */}
          <TabsContent value="subtitles">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card rounded-xl p-6 space-y-6"
            >
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Subtitles className="w-5 h-5 text-violet-400" />
                Subtitle Settings
              </h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Auto-download Subtitles</p>
                    <p className="text-sm text-gray-500">Automatically fetch subtitles for new media</p>
                  </div>
                  <Switch
                    checked={settings.auto_subtitles}
                    onCheckedChange={(checked) => setSettings(s => ({ ...s, auto_subtitles: checked }))}
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Preferred Languages</label>
                  <div className="flex flex-wrap gap-2">
                    {['en', 'es', 'fr', 'de', 'pt', 'it', 'ja', 'ko', 'zh'].map((lang) => (
                      <button
                        key={lang}
                        onClick={() => {
                          const langs = settings.subtitle_languages || [];
                          const updated = langs.includes(lang)
                            ? langs.filter(l => l !== lang)
                            : [...langs, lang];
                          setSettings(s => ({ ...s, subtitle_languages: updated }));
                        }}
                        className={`px-3 py-1 rounded-full text-sm transition-all ${
                          settings.subtitle_languages?.includes(lang)
                            ? 'bg-violet-600 text-white'
                            : 'bg-white/5 text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        {lang.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">OpenSubtitles API Key</label>
                  <Input
                    type="password"
                    placeholder="Enter your OpenSubtitles API key"
                    className="bg-white/5 border-white/10"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Get a free API key at <a href="https://www.opensubtitles.com" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">opensubtitles.com</a>
                  </p>
                </div>
              </div>

              <Button onClick={handleSaveSettings} className="bg-violet-600 hover:bg-violet-700">
                Save Subtitle Settings
              </Button>
            </motion.div>
          </TabsContent>

          {/* Streaming Services */}
          <TabsContent value="streaming">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card rounded-xl p-6 space-y-6"
            >
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ExternalLink className="w-5 h-5 text-violet-400" />
                Streaming Services
              </h2>
              <p className="text-gray-400">
                Connect your streaming service accounts to access them from WatchNexus.
              </p>

              <div className="grid gap-3">
                {streamingServices.map((service) => (
                  <div
                    key={service.id}
                    data-testid={`streaming-${service.id}`}
                    className="flex items-center justify-between p-4 rounded-xl bg-surface border border-white/5"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: service.color }}
                      >
                        {service.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{service.name}</p>
                        {service.enabled && service.username && (
                          <p className="text-sm text-gray-500">{service.username}</p>
                        )}
                      </div>
                    </div>
                    <Switch
                      checked={service.enabled}
                      onCheckedChange={() => handleStreamingToggle(service)}
                    />
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <p className="text-sm text-blue-400">
                  <strong>Note:</strong> Enabling a streaming service will show deep links to search for content on that platform.
                  Direct streaming from these services requires their own apps/subscriptions.
                </p>
              </div>
            </motion.div>
          </TabsContent>

          {/* Authentication */}
          <TabsContent value="auth">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card rounded-xl p-6 space-y-6"
            >
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Shield className="w-5 h-5 text-violet-400" />
                Authentication
              </h2>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-surface border border-white/5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                      <Check className="w-4 h-4 text-violet-400" />
                    </div>
                    <p className="font-medium">JWT Authentication</p>
                  </div>
                  <p className="text-sm text-gray-400">
                    Built-in authentication using JWT tokens. Always enabled for local access.
                  </p>
                </div>

                <div className="border-t border-white/10 pt-4">
                  <h3 className="font-medium mb-4">Google OAuth (Optional)</h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Enable Google sign-in for external access. Create credentials at 
                    <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline ml-1">
                      Google Cloud Console
                    </a>
                  </p>
                  
                  <div className="grid gap-4">
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Client ID</label>
                      <Input
                        value={settings.oauth_client_id || ''}
                        onChange={(e) => setSettings(s => ({ ...s, oauth_client_id: e.target.value }))}
                        placeholder="your-client-id.apps.googleusercontent.com"
                        className="bg-white/5 border-white/10 mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Client Secret</label>
                      <Input
                        type="password"
                        value={settings.oauth_client_secret || ''}
                        onChange={(e) => setSettings(s => ({ ...s, oauth_client_secret: e.target.value }))}
                        placeholder="GOCSPX-..."
                        className="bg-white/5 border-white/10 mono text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Button onClick={handleSaveSettings} className="bg-violet-600 hover:bg-violet-700">
                Save Authentication Settings
              </Button>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};
