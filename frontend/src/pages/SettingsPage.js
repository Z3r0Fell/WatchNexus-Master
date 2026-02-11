import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { settingsApi, indexersApi, streamingApi, mediaHealthApi, qbittorrentApi } from '../services/api';
import { toast } from 'sonner';
import { 
  Settings, Server, Download, Subtitles, Shield, 
  Folder, Check, X, Plus, Trash2, ExternalLink, Globe,
  AlertTriangle, CheckCircle, RefreshCw, FileSearch, Wrench, HardDrive,
  Clock, Bell, Calendar, DownloadCloud, Tv, Radio, Play, Eye, EyeOff,
  ChevronDown, Wifi, WifiOff
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

// All streaming services with their icons/colors
const STREAMING_SERVICES = [
  { id: 'netflix', name: 'Netflix', color: '#E50914', icon: '🎬' },
  { id: 'disney', name: 'Disney+', color: '#113CCF', icon: '🏰' },
  { id: 'prime', name: 'Amazon Prime Video', color: '#00A8E1', icon: '📦' },
  { id: 'hulu', name: 'Hulu', color: '#1CE783', icon: '📺' },
  { id: 'hbomax', name: 'HBO Max', color: '#5822B4', icon: '🎭' },
  { id: 'peacock', name: 'Peacock', color: '#000000', icon: '🦚' },
  { id: 'paramount', name: 'Paramount+', color: '#0064FF', icon: '⭐' },
  { id: 'appletv', name: 'Apple TV+', color: '#555555', icon: '🍎' },
  { id: 'crunchyroll', name: 'Crunchyroll', color: '#F47521', icon: '🍥' },
  { id: 'funimation', name: 'Funimation', color: '#5B0BB5', icon: '🎌' },
  { id: 'youtube', name: 'YouTube Premium', color: '#FF0000', icon: '▶️' },
  { id: 'showtime', name: 'Showtime', color: '#FF0000', icon: '🎪' },
  { id: 'starz', name: 'Starz', color: '#000000', icon: '⭐' },
  { id: 'discovery', name: 'Discovery+', color: '#0033A0', icon: '🌍' },
  { id: 'britbox', name: 'BritBox', color: '#C8102E', icon: '🇬🇧' },
  { id: 'curiosity', name: 'CuriosityStream', color: '#FF6B00', icon: '🔬' },
  { id: 'mubi', name: 'MUBI', color: '#000000', icon: '🎥' },
  { id: 'criterion', name: 'Criterion Channel', color: '#000000', icon: '🎞️' },
  { id: 'shudder', name: 'Shudder', color: '#000000', icon: '👻' },
  { id: 'tubi', name: 'Tubi', color: '#FA382F', icon: '📱' },
  { id: 'pluto', name: 'Pluto TV', color: '#000000', icon: '🪐' },
  { id: 'vudu', name: 'Vudu', color: '#3399FF', icon: '💿' },
  { id: 'rakuten', name: 'Rakuten Viki', color: '#0B1E3F', icon: '🇰🇷' },
  { id: 'hidive', name: 'HIDIVE', color: '#00AEEF', icon: '🎌' },
];

export const SettingsPage = () => {
  const [settings, setSettings] = useState({
    download_path: '/media/downloads',
    library_path: '/media/library',
    auto_subtitles: true,
    subtitle_languages: ['en'],
    quality_preference: '1080p',
  });
  const [indexers, setIndexers] = useState([]);
  const [saving, setSaving] = useState(false);
  
  // Media Health Checker state
  const [healthScanPath, setHealthScanPath] = useState('');
  const [healthResults, setHealthResults] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [repairing, setRepairing] = useState(null);
  const [redownloading, setRedownloading] = useState(null);
  
  // Scheduled scans state
  const [scheduledScans, setScheduledScans] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [newScanForm, setNewScanForm] = useState({
    directory: '',
    schedule_type: 'daily',
    schedule_time: '03:00',
    notify_on_issues: true,
    auto_repair: false,
  });

  // qBittorrent state
  const [qbitConfig, setQbitConfig] = useState({
    host: 'localhost',
    port: '8080',
    username: 'admin',
    password: '',
  });
  const [qbitStatus, setQbitStatus] = useState(null);
  const [testingQbit, setTestingQbit] = useState(false);

  // IPTV state
  const [iptvSources, setIptvSources] = useState([]);
  const [newIptvSource, setNewIptvSource] = useState({
    name: '',
    url: '',
    epg_url: '',
    type: 'm3u',
  });

  // Streaming Services state
  const [configuredServices, setConfiguredServices] = useState([]);
  const [selectedService, setSelectedService] = useState('');
  const [serviceCredentials, setServiceCredentials] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState({});

  const fetchData = useCallback(async () => {
    try {
      const [settingsRes, indexersRes] = await Promise.all([
        settingsApi.get().catch(() => ({ data: settings })),
        indexersApi.getAll(),
      ]);
      setSettings(settingsRes.data || settings);
      setIndexers(indexersRes.data || []);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  }, []);

  const fetchScheduledScans = useCallback(async () => {
    try {
      const res = await mediaHealthApi.getScheduledScans();
      setScheduledScans(res.data || []);
    } catch (error) {
      console.error('Failed to fetch scheduled scans:', error);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await mediaHealthApi.getNotifications(true);
      setNotifications(res.data || []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchScheduledScans();
    fetchNotifications();
    
    // Load saved streaming services from localStorage
    const saved = localStorage.getItem('watchnexus_streaming_services');
    if (saved) {
      setConfiguredServices(JSON.parse(saved));
    }
    
    // Load saved IPTV sources
    const savedIptv = localStorage.getItem('watchnexus_iptv_sources');
    if (savedIptv) {
      setIptvSources(JSON.parse(savedIptv));
    }
  }, [fetchData, fetchScheduledScans, fetchNotifications]);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await settingsApi.update(settings);
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleIndexerToggle = async (indexer) => {
    try {
      await indexersApi.update(indexer.id, !indexer.enabled);
      setIndexers(prev => prev.map(i => 
        i.id === indexer.id ? { ...i, enabled: !i.enabled } : i
      ));
      toast.success(`${indexer.name} ${indexer.enabled ? 'disabled' : 'enabled'}`);
    } catch (error) {
      toast.error('Failed to update indexer');
    }
  };

  // Media Health Checker functions
  const handleScanLibrary = async () => {
    if (!healthScanPath.trim()) {
      toast.error('Please enter a directory path to scan');
      return;
    }
    setScanning(true);
    setHealthResults([]);
    try {
      const res = await mediaHealthApi.scanLibrary(healthScanPath);
      setHealthResults(res.data || []);
      const issues = (res.data || []).filter(r => r.status !== 'healthy');
      if (issues.length > 0) {
        toast.warning(`Found ${issues.length} file(s) with issues`);
      } else {
        toast.success('All files are healthy!');
      }
    } catch (error) {
      toast.error('Failed to scan library');
    } finally {
      setScanning(false);
    }
  };

  const handleRepairFile = async (filePath) => {
    setRepairing(filePath);
    try {
      const res = await mediaHealthApi.repairFile(filePath);
      if (res.data.success) {
        toast.success(res.data.message);
        await handleScanLibrary();
      } else {
        toast.error(res.data.message);
      }
    } catch (error) {
      toast.error('Failed to repair file');
    } finally {
      setRepairing(null);
    }
  };

  const handleRedownload = async (filePath) => {
    setRedownloading(filePath);
    try {
      const filename = filePath.split('/').pop();
      const title = filename.replace(/\.[^/.]+$/, '').replace(/[._-]/g, ' ');
      const res = await mediaHealthApi.requestRedownload(filePath, title, 'movie');
      toast.success(res.data.message);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to queue re-download');
    } finally {
      setRedownloading(null);
    }
  };

  const handleCreateScheduledScan = async () => {
    if (!newScanForm.directory.trim()) {
      toast.error('Please enter a directory to scan');
      return;
    }
    try {
      await mediaHealthApi.createScheduledScan(newScanForm);
      toast.success('Scheduled scan created');
      setNewScanForm({
        directory: '',
        schedule_type: 'daily',
        schedule_time: '03:00',
        notify_on_issues: true,
        auto_repair: false,
      });
      fetchScheduledScans();
    } catch (error) {
      toast.error('Failed to create scheduled scan');
    }
  };

  const handleDeleteScheduledScan = async (scanId) => {
    try {
      await mediaHealthApi.deleteScheduledScan(scanId);
      toast.success('Scheduled scan deleted');
      fetchScheduledScans();
    } catch (error) {
      toast.error('Failed to delete scheduled scan');
    }
  };

  const handleRunScanNow = async (scanId) => {
    setScanning(true);
    try {
      const res = await mediaHealthApi.runScheduledScanNow(scanId);
      toast.success(`Scan complete: ${res.data.total_files} files`);
      fetchScheduledScans();
      fetchNotifications();
    } catch (error) {
      toast.error('Failed to run scan');
    } finally {
      setScanning(false);
    }
  };

  // qBittorrent functions
  const handleTestQbit = async () => {
    setTestingQbit(true);
    try {
      const res = await qbittorrentApi.testConnection(
        qbitConfig.host,
        parseInt(qbitConfig.port),
        qbitConfig.username,
        qbitConfig.password
      );
      setQbitStatus(res.data);
      if (res.data.success) {
        toast.success(`Connected to qBittorrent v${res.data.version}`);
      } else {
        toast.error(res.data.error || 'Connection failed');
      }
    } catch (error) {
      toast.error('Failed to connect to qBittorrent');
      setQbitStatus({ success: false, error: 'Connection failed' });
    } finally {
      setTestingQbit(false);
    }
  };

  // IPTV functions
  const handleAddIptvSource = () => {
    if (!newIptvSource.name || !newIptvSource.url) {
      toast.error('Please enter name and URL');
      return;
    }
    const updated = [...iptvSources, { ...newIptvSource, id: Date.now().toString() }];
    setIptvSources(updated);
    localStorage.setItem('watchnexus_iptv_sources', JSON.stringify(updated));
    setNewIptvSource({ name: '', url: '', epg_url: '', type: 'm3u' });
    toast.success('IPTV source added');
  };

  const handleDeleteIptvSource = (id) => {
    const updated = iptvSources.filter(s => s.id !== id);
    setIptvSources(updated);
    localStorage.setItem('watchnexus_iptv_sources', JSON.stringify(updated));
    toast.success('IPTV source removed');
  };

  // Streaming Services functions
  const handleAddStreamingService = () => {
    if (!selectedService || !serviceCredentials.email || !serviceCredentials.password) {
      toast.error('Please select a service and enter credentials');
      return;
    }
    const service = STREAMING_SERVICES.find(s => s.id === selectedService);
    const newService = {
      ...service,
      email: serviceCredentials.email,
      password: serviceCredentials.password,
      addedAt: new Date().toISOString(),
    };
    const updated = [...configuredServices, newService];
    setConfiguredServices(updated);
    localStorage.setItem('watchnexus_streaming_services', JSON.stringify(updated));
    setSelectedService('');
    setServiceCredentials({ email: '', password: '' });
    toast.success(`${service.name} added successfully`);
  };

  const handleDeleteStreamingService = (id) => {
    const updated = configuredServices.filter(s => s.id !== id);
    setConfiguredServices(updated);
    localStorage.setItem('watchnexus_streaming_services', JSON.stringify(updated));
    toast.success('Streaming service removed');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': return 'bg-green-500/20 text-green-400';
      case 'warning': return 'bg-yellow-500/20 text-yellow-400';
      case 'repairable': return 'bg-orange-500/20 text-orange-400';
      default: return 'bg-red-500/20 text-red-400';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-5 h-5" />;
      case 'warning': return <AlertTriangle className="w-5 h-5" />;
      case 'repairable': return <Wrench className="w-5 h-5" />;
      default: return <X className="w-5 h-5" />;
    }
  };

  // Get services not yet configured
  const availableServices = STREAMING_SERVICES.filter(
    s => !configuredServices.some(cs => cs.id === s.id)
  );

  return (
    <Layout>
      <div data-testid="settings-page" className="min-h-screen p-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Settings</h1>
              <p className="text-gray-400">Configure WatchNexus to your preferences</p>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="bg-surface border border-white/10 flex-wrap gap-1">
            <TabsTrigger value="general" className="data-[state=active]:bg-violet-600">General</TabsTrigger>
            <TabsTrigger value="media-health" className="data-[state=active]:bg-violet-600">Media Health</TabsTrigger>
            <TabsTrigger value="indexers" className="data-[state=active]:bg-violet-600">Indexers</TabsTrigger>
            <TabsTrigger value="download" className="data-[state=active]:bg-violet-600">Download Client</TabsTrigger>
            <TabsTrigger value="iptv" className="data-[state=active]:bg-violet-600">IPTV</TabsTrigger>
            <TabsTrigger value="streaming" className="data-[state=active]:bg-violet-600">Streaming Services</TabsTrigger>
            <TabsTrigger value="subtitles" className="data-[state=active]:bg-violet-600">Subtitles</TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-xl p-6 space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Folder className="w-5 h-5 text-violet-400" />
                General Settings
              </h2>

              <div className="grid gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Download Path</label>
                  <Input
                    value={settings.download_path}
                    onChange={(e) => setSettings({ ...settings, download_path: e.target.value })}
                    placeholder="/media/downloads"
                    className="bg-white/5 border-white/10"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Library Path</label>
                  <Input
                    value={settings.library_path}
                    onChange={(e) => setSettings({ ...settings, library_path: e.target.value })}
                    placeholder="/media/library"
                    className="bg-white/5 border-white/10"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Quality Preference</label>
                  <select
                    value={settings.quality_preference}
                    onChange={(e) => setSettings({ ...settings, quality_preference: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
                  >
                    <option value="4k">4K / 2160p</option>
                    <option value="1080p">1080p</option>
                    <option value="720p">720p</option>
                    <option value="480p">480p</option>
                  </select>
                </div>
              </div>

              <Button onClick={handleSaveSettings} disabled={saving} className="bg-violet-600 hover:bg-violet-700">
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </motion.div>
          </TabsContent>

          {/* Media Health */}
          <TabsContent value="media-health">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-xl p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <HardDrive className="w-5 h-5 text-violet-400" />
                    Media Health Checker
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">Scan for corrupted or incomplete files</p>
                </div>
              </div>

              {/* Scan Input */}
              <div className="flex gap-3">
                <Input
                  value={healthScanPath}
                  onChange={(e) => setHealthScanPath(e.target.value)}
                  placeholder="/media/library or /path/to/movies"
                  className="bg-white/5 border-white/10 flex-1"
                />
                <Button onClick={handleScanLibrary} disabled={scanning} className="bg-violet-600 hover:bg-violet-700">
                  {scanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4" />}
                  <span className="ml-2">{scanning ? 'Scanning...' : 'Scan'}</span>
                </Button>
              </div>

              {/* Results */}
              {healthResults.length > 0 && (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  <div className="flex gap-2 text-sm mb-3">
                    <span className="px-2 py-1 rounded bg-green-500/20 text-green-400">
                      {healthResults.filter(r => r.status === 'healthy').length} Healthy
                    </span>
                    <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">
                      {healthResults.filter(r => r.status === 'warning').length} Warnings
                    </span>
                    <span className="px-2 py-1 rounded bg-red-500/20 text-red-400">
                      {healthResults.filter(r => ['error', 'corrupt'].includes(r.status)).length} Errors
                    </span>
                  </div>
                  {healthResults.map((result, index) => (
                    <div key={index} className="p-3 rounded-lg bg-surface border border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getStatusColor(result.status)}`}>
                          {getStatusIcon(result.status)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{result.file_path.split('/').pop()}</p>
                          <p className="text-xs text-gray-500 truncate">{result.file_path}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {result.repairable && (
                          <Button size="sm" variant="outline" onClick={() => handleRepairFile(result.file_path)}
                            disabled={repairing === result.file_path} className="text-orange-400 border-orange-500/30">
                            {repairing === result.file_path ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
                          </Button>
                        )}
                        {result.status !== 'healthy' && (
                          <Button size="sm" variant="outline" onClick={() => handleRedownload(result.file_path)}
                            disabled={redownloading === result.file_path} className="text-blue-400 border-blue-500/30">
                            {redownloading === result.file_path ? <RefreshCw className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Scheduled Scans */}
              <div className="border-t border-white/10 pt-6 space-y-4">
                <h3 className="font-bold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-violet-400" />
                  Scheduled Scans
                  {notifications.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs ml-2">
                      {notifications.length} alerts
                    </span>
                  )}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Input value={newScanForm.directory} onChange={(e) => setNewScanForm(p => ({ ...p, directory: e.target.value }))}
                    placeholder="/media/movies" className="bg-white/5 border-white/10" />
                  <select value={newScanForm.schedule_type} onChange={(e) => setNewScanForm(p => ({ ...p, schedule_type: e.target.value }))}
                    className="bg-white/5 border border-white/10 rounded-md px-3 text-white">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                  <Input type="time" value={newScanForm.schedule_time} 
                    onChange={(e) => setNewScanForm(p => ({ ...p, schedule_time: e.target.value }))}
                    className="bg-white/5 border-white/10" />
                  <Button onClick={handleCreateScheduledScan} className="bg-violet-600 hover:bg-violet-700">
                    <Plus className="w-4 h-4 mr-2" /> Add
                  </Button>
                </div>

                {scheduledScans.length > 0 && (
                  <div className="space-y-2">
                    {scheduledScans.map((scan) => (
                      <div key={scan.id} className="p-3 rounded-lg bg-surface border border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Calendar className="w-5 h-5 text-violet-400" />
                          <div>
                            <p className="font-medium">{scan.directory}</p>
                            <p className="text-xs text-gray-500">{scan.schedule_type} at {scan.schedule_time}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleRunScanNow(scan.id)} disabled={scanning}>
                            <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDeleteScheduledScan(scan.id)} className="text-red-400">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </TabsContent>

          {/* Indexers */}
          <TabsContent value="indexers">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-xl p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Server className="w-5 h-5 text-violet-400" />
                  Indexers (Compote)
                </h2>
                <Button variant="outline" className="bg-white/5 border-white/10">
                  <Plus className="w-4 h-4 mr-2" /> Add Indexer
                </Button>
              </div>

              <div className="space-y-3">
                {indexers.map((indexer) => (
                  <div key={indexer.id} className="flex items-center justify-between p-4 rounded-xl bg-surface border border-white/5">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        indexer.enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        <Globe className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium">{indexer.name}</p>
                        <p className="text-sm text-gray-500">{indexer.url}</p>
                      </div>
                    </div>
                    <Switch checked={indexer.enabled} onCheckedChange={() => handleIndexerToggle(indexer)} />
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-sm text-yellow-400">
                  <strong>Note:</strong> Enable indexers and provide API keys to search real content.
                </p>
              </div>
            </motion.div>
          </TabsContent>

          {/* Download Client */}
          <TabsContent value="download">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-xl p-6 space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Download className="w-5 h-5 text-violet-400" />
                qBittorrent Configuration
              </h2>

              {/* Status */}
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
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Host</label>
                  <Input value={qbitConfig.host} onChange={(e) => setQbitConfig(p => ({ ...p, host: e.target.value }))}
                    placeholder="localhost" className="bg-white/5 border-white/10" />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Port</label>
                  <Input value={qbitConfig.port} onChange={(e) => setQbitConfig(p => ({ ...p, port: e.target.value }))}
                    placeholder="8080" className="bg-white/5 border-white/10" />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Username</label>
                  <Input value={qbitConfig.username} onChange={(e) => setQbitConfig(p => ({ ...p, username: e.target.value }))}
                    placeholder="admin" className="bg-white/5 border-white/10" />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Password</label>
                  <Input type="password" value={qbitConfig.password} 
                    onChange={(e) => setQbitConfig(p => ({ ...p, password: e.target.value }))}
                    placeholder="••••••••" className="bg-white/5 border-white/10" />
                </div>
              </div>

              <Button onClick={handleTestQbit} disabled={testingQbit} className="bg-violet-600 hover:bg-violet-700">
                {testingQbit ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Wifi className="w-4 h-4 mr-2" />}
                Test Connection
              </Button>

              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <h4 className="font-medium text-blue-400 mb-2">Setup Instructions</h4>
                <ol className="text-sm text-blue-300 space-y-1 list-decimal list-inside">
                  <li>Install qBittorrent from qbittorrent.org</li>
                  <li>Enable Web UI in Tools → Options → Web UI</li>
                  <li>Set username and password</li>
                  <li>Enter connection details above and test</li>
                </ol>
              </div>
            </motion.div>
          </TabsContent>

          {/* IPTV */}
          <TabsContent value="iptv">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-xl p-6 space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Radio className="w-5 h-5 text-violet-400" />
                IPTV Configuration
              </h2>
              <p className="text-gray-400">Add M3U playlists or Xtream Codes for live TV channels.</p>

              {/* Add New Source */}
              <div className="p-4 rounded-xl bg-surface border border-white/5 space-y-4">
                <h3 className="font-medium">Add IPTV Source</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input value={newIptvSource.name} onChange={(e) => setNewIptvSource(p => ({ ...p, name: e.target.value }))}
                    placeholder="Source Name (e.g., My IPTV)" className="bg-white/5 border-white/10" />
                  <select value={newIptvSource.type} onChange={(e) => setNewIptvSource(p => ({ ...p, type: e.target.value }))}
                    className="bg-white/5 border border-white/10 rounded-md px-3 text-white">
                    <option value="m3u">M3U Playlist</option>
                    <option value="xtream">Xtream Codes</option>
                  </select>
                </div>
                <Input value={newIptvSource.url} onChange={(e) => setNewIptvSource(p => ({ ...p, url: e.target.value }))}
                  placeholder={newIptvSource.type === 'm3u' ? 'http://example.com/playlist.m3u' : 'http://server.com:port'}
                  className="bg-white/5 border-white/10" />
                <Input value={newIptvSource.epg_url} onChange={(e) => setNewIptvSource(p => ({ ...p, epg_url: e.target.value }))}
                  placeholder="EPG URL (optional) - http://example.com/epg.xml"
                  className="bg-white/5 border-white/10" />
                <Button onClick={handleAddIptvSource} className="bg-violet-600 hover:bg-violet-700">
                  <Plus className="w-4 h-4 mr-2" /> Add Source
                </Button>
              </div>

              {/* Configured Sources */}
              {iptvSources.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-medium">Configured Sources ({iptvSources.length})</h3>
                  {iptvSources.map((source) => (
                    <div key={source.id} className="p-4 rounded-xl bg-surface border border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                          <Radio className="w-5 h-5 text-violet-400" />
                        </div>
                        <div>
                          <p className="font-medium">{source.name}</p>
                          <p className="text-xs text-gray-500">{source.type.toUpperCase()} • {source.url.substring(0, 40)}...</p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleDeleteIptvSource(source.id)} className="text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {iptvSources.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Radio className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No IPTV sources configured</p>
                  <p className="text-sm">Add an M3U playlist or Xtream Codes above</p>
                </div>
              )}
            </motion.div>
          </TabsContent>

          {/* Streaming Services */}
          <TabsContent value="streaming">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-xl p-6 space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Tv className="w-5 h-5 text-violet-400" />
                Streaming Service Logins
              </h2>
              <p className="text-gray-400">Save your streaming service credentials for quick access tracking.</p>

              {/* Add New Service */}
              <div className="p-4 rounded-xl bg-surface border border-white/5 space-y-4">
                <h3 className="font-medium">Add Streaming Service</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative">
                    <select value={selectedService} onChange={(e) => setSelectedService(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white appearance-none">
                      <option value="">Select Service...</option>
                      {availableServices.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.icon} {service.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                  <Input value={serviceCredentials.email} 
                    onChange={(e) => setServiceCredentials(p => ({ ...p, email: e.target.value }))}
                    placeholder="Email / Username" className="bg-white/5 border-white/10" />
                  <div className="relative">
                    <Input type={showPassword['new'] ? 'text' : 'password'} value={serviceCredentials.password}
                      onChange={(e) => setServiceCredentials(p => ({ ...p, password: e.target.value }))}
                      placeholder="Password" className="bg-white/5 border-white/10 pr-10" />
                    <button type="button" onClick={() => setShowPassword(p => ({ ...p, new: !p.new }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                      {showPassword['new'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button onClick={handleAddStreamingService} disabled={!selectedService} className="bg-violet-600 hover:bg-violet-700">
                  <Plus className="w-4 h-4 mr-2" /> Add Service
                </Button>
              </div>

              {/* Configured Services */}
              {configuredServices.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-medium">Configured Services ({configuredServices.length})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {configuredServices.map((service, index) => (
                      <div key={`${service.id}-${index}`} className="p-4 rounded-xl border border-white/5 flex items-center justify-between"
                        style={{ backgroundColor: `${service.color}15` }}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                            style={{ backgroundColor: `${service.color}30` }}>
                            {service.icon}
                          </div>
                          <div>
                            <p className="font-medium">{service.name}</p>
                            <p className="text-xs text-gray-400">{service.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a href={`https://${service.id === 'prime' ? 'primevideo.com' : service.id === 'disney' ? 'disneyplus.com' : service.id + '.com'}`}
                            target="_blank" rel="noopener noreferrer"
                            className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                            <ExternalLink className="w-4 h-4 text-gray-400" />
                          </a>
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteStreamingService(service.id)}
                            className="text-red-400 hover:bg-red-500/10">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {configuredServices.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Tv className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No streaming services configured</p>
                  <p className="text-sm">Add your subscriptions above for easy access</p>
                </div>
              )}

              <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-sm text-yellow-400">
                  <strong>Note:</strong> Credentials are stored locally for your convenience.
                  WatchNexus does not share or sync this data.
                </p>
              </div>
            </motion.div>
          </TabsContent>

          {/* Subtitles */}
          <TabsContent value="subtitles">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-xl p-6 space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Subtitles className="w-5 h-5 text-violet-400" />
                Subtitle Settings
              </h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-surface border border-white/5">
                  <div>
                    <p className="font-medium">Auto-download Subtitles</p>
                    <p className="text-sm text-gray-500">Automatically fetch subtitles for new media</p>
                  </div>
                  <Switch checked={settings.auto_subtitles}
                    onCheckedChange={(checked) => setSettings({ ...settings, auto_subtitles: checked })} />
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Preferred Languages</label>
                  <select multiple className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white h-32">
                    <option value="en" selected>English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="it">Italian</option>
                    <option value="pt">Portuguese</option>
                    <option value="ja">Japanese</option>
                    <option value="ko">Korean</option>
                    <option value="zh">Chinese</option>
                    <option value="ar">Arabic</option>
                  </select>
                </div>
              </div>

              <Button onClick={handleSaveSettings} disabled={saving} className="bg-violet-600 hover:bg-violet-700">
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default SettingsPage;
