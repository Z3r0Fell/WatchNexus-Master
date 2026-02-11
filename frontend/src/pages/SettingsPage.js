import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { settingsApi, indexersApi, streamingApi, mediaHealthApi, qbittorrentApi, torrentEngineApi, compoteApi } from '../services/api';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Settings, Server, Download, Subtitles, Shield, 
  Folder, Check, X, Plus, Trash2, ExternalLink, Globe,
  AlertTriangle, CheckCircle, RefreshCw, FileSearch, Wrench, HardDrive,
  Clock, Bell, Calendar, DownloadCloud, Tv, Radio, Play, Eye, EyeOff,
  ChevronDown, Wifi, WifiOff, Zap, Package, Film, Music, Book, FolderOpen,
  Palette, Paintbrush, Moon, Sun, Sparkles, Import, FileJson
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { JuiceColorPicker } from '../components/juice/JuiceColorPicker';

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

  // Download client mode: 'builtin' or 'qbittorrent'
  const [downloadClientMode, setDownloadClientMode] = useState('builtin');

  // Built-in torrent engine state
  const [engineStatus, setEngineStatus] = useState(null);
  const [engineTorrents, setEngineTorrents] = useState([]);
  const [testingEngine, setTestingEngine] = useState(false);
  const [engineSettings, setEngineSettings] = useState({
    // Queue Management
    max_active_downloads: 3,
    max_active_uploads: 3,
    max_active_torrents: 5,
    // Speed Limits (KB/s, 0 = unlimited)
    max_download_rate: 0,
    max_upload_rate: 0,
    // Connection Limits
    max_connections_global: 200,
    max_connections_per_torrent: 50,
    // Seeding Limits
    seed_ratio_limit: 1.0,
    seed_time_limit: 60,
    seed_ratio_action: 'pause',
    // Auto-cleanup
    remove_after_completion: false,
    remove_after_seeding: false,
    delete_files_on_remove: false,
    max_completed_torrents: 50,
    // Behavior
    sequential_download_default: false,
    add_paused: false,
    // Network
    enable_dht: true,
    enable_pex: true,
    enable_lsd: true,
  });
  const [savingEngineSettings, setSavingEngineSettings] = useState(false);

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

  // Indexer management state
  const [showAddIndexer, setShowAddIndexer] = useState(false);
  const [testingIndexer, setTestingIndexer] = useState(null);
  const [newIndexer, setNewIndexer] = useState({
    name: '',
    type: 'torznab',
    url: '',
    api_key: '',
    cloudflare_protected: false,
    search_path: '',
    cookie: '',
  });

  // Library management state
  const [libraries, setLibraries] = useState([]);
  const [loadingLibraries, setLoadingLibraries] = useState(false);
  const [scanningLibrary, setScanningLibrary] = useState(null);
  const [showAddLibrary, setShowAddLibrary] = useState(false);
  const [newLibrary, setNewLibrary] = useState({
    name: '',
    path: '',
    media_type: 'movies',
  });

  // Gelatin (External Access) state
  const [gelatinStatus, setGelatinStatus] = useState(null);
  const [activeTunnels, setActiveTunnels] = useState([]);
  const [creatingTunnel, setCreatingTunnel] = useState(false);
  const [accessToken, setAccessToken] = useState(null);

  // Milk (Theme Forge) state
  const [themeForgeConfig, setThemeForgeConfig] = useState(null);
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [customColors, setCustomColors] = useState({
    primary: '#8B5CF6',
    secondary: '#EC4899',
    background: '#0F0F0F',
    surface: '#1A1A1A',
    text_primary: '#FFFFFF',
  });
  const [savingTheme, setSavingTheme] = useState(false);

  // Fetch Theme Forge config
  const fetchThemeForgeConfig = useCallback(async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/milk/theme-forge`);
      setThemeForgeConfig(res.data);
      if (res.data.current_theme) {
        setSelectedTheme(res.data.current_theme.type);
        if (res.data.current_theme.colors) {
          setCustomColors(res.data.current_theme.colors);
        }
      }
    } catch (error) {
      console.error('Failed to fetch theme config:', error);
    }
  }, []);

  const handleSetTheme = async (themeType) => {
    try {
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/milk/set-theme?theme_type=${themeType}`);
      setSelectedTheme(themeType);
      toast.success('Theme applied!');
      fetchThemeForgeConfig();
    } catch (error) {
      toast.error('Failed to apply theme');
    }
  };

  const handleSaveCustomTheme = async () => {
    setSavingTheme(true);
    try {
      const themeData = {
        name: 'My Custom Theme',
        type: 'custom',
        colors: customColors,
      };
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/milk/custom-theme`, themeData);
      toast.success('Custom theme saved!');
      setSelectedTheme('custom');
      fetchThemeForgeConfig();
    } catch (error) {
      toast.error('Failed to save custom theme');
    } finally {
      setSavingTheme(false);
    }
  };

  // Fetch Gelatin status
  const fetchGelatinStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/gelatin/status`);
      setGelatinStatus(res.data);
    } catch (error) {
      console.error('Failed to fetch Gelatin status:', error);
    }
  }, []);

  const fetchActiveTunnels = useCallback(async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/gelatin/tunnels`);
      setActiveTunnels(res.data || []);
    } catch (error) {
      console.error('Failed to fetch tunnels:', error);
    }
  }, []);

  const handleCreateTunnel = async () => {
    setCreatingTunnel(true);
    try {
      const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/gelatin/tunnel/create`);
      toast.success('Tunnel created successfully');
      setActiveTunnels(prev => [...prev, res.data]);
      fetchGelatinStatus();
    } catch (error) {
      toast.error('Failed to create tunnel');
    } finally {
      setCreatingTunnel(false);
    }
  };

  const handleCloseTunnel = async (tunnelId) => {
    try {
      await axios.delete(`${process.env.REACT_APP_BACKEND_URL}/api/gelatin/tunnel/${tunnelId}`);
      toast.success('Tunnel closed');
      setActiveTunnels(prev => prev.filter(t => t.tunnel_id !== tunnelId));
      fetchGelatinStatus();
    } catch (error) {
      toast.error('Failed to close tunnel');
    }
  };

  const handleGenerateAccessToken = async () => {
    try {
      const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/gelatin/access-token`);
      setAccessToken(res.data);
      toast.success('Access token generated');
    } catch (error) {
      toast.error('Failed to generate token');
    }
  };

  // Fetch Marmalade libraries
  const fetchLibraries = useCallback(async () => {
    setLoadingLibraries(true);
    try {
      const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/marmalade/libraries`);
      setLibraries(res.data || []);
    } catch (error) {
      console.error('Failed to fetch libraries:', error);
    } finally {
      setLoadingLibraries(false);
    }
  }, []);

  const handleAddLibrary = async () => {
    if (!newLibrary.name || !newLibrary.path) {
      toast.error('Name and path are required');
      return;
    }
    try {
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/marmalade/libraries`, null, {
        params: newLibrary
      });
      toast.success(`Library "${newLibrary.name}" added`);
      setNewLibrary({ name: '', path: '', media_type: 'movies' });
      setShowAddLibrary(false);
      fetchLibraries();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add library');
    }
  };

  const handleDeleteLibrary = async (libraryId) => {
    try {
      await axios.delete(`${process.env.REACT_APP_BACKEND_URL}/api/marmalade/libraries/${libraryId}`);
      toast.success('Library removed');
      fetchLibraries();
    } catch (error) {
      toast.error('Failed to remove library');
    }
  };

  const handleScanLibrary = async (libraryId) => {
    setScanningLibrary(libraryId);
    try {
      const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/marmalade/libraries/${libraryId}/scan`);
      toast.success(`Scan complete: ${res.data.new} new, ${res.data.updated} updated`);
      fetchLibraries();
    } catch (error) {
      toast.error('Scan failed');
    } finally {
      setScanningLibrary(null);
    }
  };

  // Fetch built-in engine status and settings
  const fetchEngineStatus = useCallback(async () => {
    try {
      const res = await torrentEngineApi.getStatus();
      setEngineStatus(res.data);
    } catch (error) {
      setEngineStatus({ success: false, error: 'Engine not available' });
    }
  }, []);

  const fetchEngineSettings = useCallback(async () => {
    try {
      const res = await torrentEngineApi.getSettings();
      setEngineSettings(prev => ({ ...prev, ...res.data }));
    } catch (error) {
      console.error('Failed to fetch engine settings:', error);
    }
  }, []);

  const saveEngineSettings = async () => {
    setSavingEngineSettings(true);
    try {
      await torrentEngineApi.updateSettings(engineSettings);
      toast.success('Engine settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSavingEngineSettings(false);
    }
  };

  const fetchEngineTorrents = useCallback(async () => {
    try {
      const res = await torrentEngineApi.getTorrents();
      setEngineTorrents(res.data || []);
    } catch (error) {
      console.error('Failed to fetch engine torrents:', error);
    }
  }, []);

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
    fetchEngineStatus();
    fetchEngineSettings();
    fetchLibraries();
    fetchStreamingLogins();
    fetchGelatinStatus();
    fetchActiveTunnels();
    fetchThemeForgeConfig();
    
    // Load saved IPTV sources
    const savedIptv = localStorage.getItem('watchnexus_iptv_sources');
    if (savedIptv) {
      setIptvSources(JSON.parse(savedIptv));
    }
    
    // Load saved download client mode
    const savedMode = localStorage.getItem('watchnexus_download_mode');
    if (savedMode) {
      setDownloadClientMode(savedMode);
    }
  }, [fetchData, fetchScheduledScans, fetchNotifications, fetchEngineStatus, fetchEngineSettings, fetchLibraries, fetchGelatinStatus, fetchActiveTunnels]);

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
      await compoteApi.updateIndexer(indexer.id, { enabled: !indexer.enabled });
      setIndexers(prev => prev.map(i => 
        i.id === indexer.id ? { ...i, enabled: !i.enabled } : i
      ));
      toast.success(`${indexer.name} ${indexer.enabled ? 'disabled' : 'enabled'}`);
    } catch (error) {
      toast.error('Failed to update indexer');
    }
  };

  const handleAddNewIndexer = async () => {
    if (!newIndexer.name || !newIndexer.url) {
      toast.error('Name and URL are required');
      return;
    }
    try {
      await compoteApi.addIndexer(
        newIndexer.name,
        newIndexer.type,
        newIndexer.url,
        newIndexer.api_key,
        true,
        50,
        {
          cloudflare_protected: newIndexer.cloudflare_protected,
          search_path: newIndexer.search_path,
          cookie: newIndexer.cookie,
        }
      );
      toast.success(`Indexer "${newIndexer.name}" added`);
      setShowAddIndexer(false);
      setNewIndexer({ name: '', type: 'torznab', url: '', api_key: '', cloudflare_protected: false, search_path: '', cookie: '' });
      // Refresh indexers list
      const res = await compoteApi.getIndexers();
      setIndexers(res.data || []);
    } catch (error) {
      toast.error('Failed to add indexer');
    }
  };

  const handleTestIndexer = async (indexerId) => {
    setTestingIndexer(indexerId);
    try {
      const res = await compoteApi.testIndexer(indexerId);
      if (res.data.success) {
        toast.success(res.data.message || 'Connection successful');
      } else {
        toast.error(res.data.error || 'Connection failed');
      }
    } catch (error) {
      toast.error('Test failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setTestingIndexer(null);
    }
  };

  const handleDeleteIndexer = async (indexerId) => {
    try {
      await compoteApi.removeIndexer(indexerId);
      setIndexers(prev => prev.filter(i => i.id !== indexerId));
      toast.success('Indexer removed');
    } catch (error) {
      toast.error('Failed to remove indexer');
    }
  };

  // Media Health Checker functions
  const handleHealthScan = async () => {
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
        await handleHealthScan();
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
  const handleAddStreamingService = async () => {
    if (!selectedService || !serviceCredentials.email || !serviceCredentials.password) {
      toast.error('Please select a service and enter credentials');
      return;
    }
    try {
      const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/streaming-logins`, null, {
        params: {
          service_id: selectedService,
          email: serviceCredentials.email,
          password: serviceCredentials.password,
        }
      });
      toast.success(`${res.data.login.service_name} added successfully`);
      setSelectedService('');
      setServiceCredentials({ email: '', password: '' });
      fetchStreamingLogins();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add service');
    }
  };

  const handleDeleteStreamingService = async (serviceId) => {
    try {
      await axios.delete(`${process.env.REACT_APP_BACKEND_URL}/api/streaming-logins/${serviceId}`);
      toast.success('Streaming service removed');
      fetchStreamingLogins();
    } catch (error) {
      toast.error('Failed to remove service');
    }
  };

  const fetchStreamingLogins = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/streaming-logins`);
      // Transform backend response to match UI format
      const transformed = (res.data || []).map(login => ({
        id: login.service_id,
        name: login.service_name,
        icon: login.icon,
        color: login.color,
        email: login.email,
        deep_link: login.deep_link,
        login_url: login.login_url,
      }));
      setConfiguredServices(transformed);
    } catch (error) {
      console.error('Failed to fetch streaming logins:', error);
      // Fall back to localStorage
      const saved = localStorage.getItem('watchnexus_streaming_services');
      if (saved) setConfiguredServices(JSON.parse(saved));
    }
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
            <TabsTrigger value="library" className="data-[state=active]:bg-violet-600">Library</TabsTrigger>
            <TabsTrigger value="media-health" className="data-[state=active]:bg-violet-600">Media Health</TabsTrigger>
            <TabsTrigger value="indexers" className="data-[state=active]:bg-violet-600">Indexers</TabsTrigger>
            <TabsTrigger value="download" className="data-[state=active]:bg-violet-600">Download Client</TabsTrigger>
            <TabsTrigger value="iptv" className="data-[state=active]:bg-violet-600">IPTV</TabsTrigger>
            <TabsTrigger value="streaming" className="data-[state=active]:bg-violet-600">Streaming Services</TabsTrigger>
            <TabsTrigger value="subtitles" className="data-[state=active]:bg-violet-600">Subtitles</TabsTrigger>
            <TabsTrigger value="gelatin" className="data-[state=active]:bg-violet-600">External Access</TabsTrigger>
            <TabsTrigger value="theme-forge" className="data-[state=active]:bg-violet-600">Theme Forge</TabsTrigger>
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

          {/* Library Management */}
          <TabsContent value="library">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* Header */}
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <FolderOpen className="w-5 h-5 text-violet-400" />
                      Media Libraries (Marmalade)
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">
                      Add folders and drives to scan for media content
                    </p>
                  </div>
                  <Button 
                    onClick={() => setShowAddLibrary(!showAddLibrary)}
                    className="bg-violet-600 hover:bg-violet-700"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add Library
                  </Button>
                </div>

                {/* Add Library Form */}
                <AnimatePresence>
                  {showAddLibrary && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 rounded-xl bg-surface border border-white/10 space-y-4 mb-4">
                        <h3 className="font-bold flex items-center gap-2">
                          <Plus className="w-4 h-4 text-green-400" />
                          Add New Library
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="text-sm text-gray-400 mb-2 block">Library Name *</label>
                            <Input
                              value={newLibrary.name}
                              onChange={(e) => setNewLibrary(p => ({ ...p, name: e.target.value }))}
                              placeholder="Movies, TV Shows, Anime..."
                              className="bg-white/5 border-white/10"
                            />
                          </div>
                          <div>
                            <label className="text-sm text-gray-400 mb-2 block">Media Type *</label>
                            <select
                              value={newLibrary.media_type}
                              onChange={(e) => setNewLibrary(p => ({ ...p, media_type: e.target.value }))}
                              className="w-full h-10 px-3 rounded-md bg-white/5 border border-white/10 text-white"
                            >
                              <option value="movies">🎬 Movies</option>
                              <option value="tv">📺 TV Shows</option>
                              <option value="anime">🎌 Anime</option>
                              <option value="music">🎵 Music</option>
                              <option value="audiobooks">📚 Audiobooks</option>
                              <option value="other">📁 Other</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-sm text-gray-400 mb-2 block">Folder Path *</label>
                            <Input
                              value={newLibrary.path}
                              onChange={(e) => setNewLibrary(p => ({ ...p, path: e.target.value }))}
                              placeholder="/media/movies or D:\Movies"
                              className="bg-white/5 border-white/10"
                            />
                          </div>
                        </div>

                        <div className="flex gap-2 justify-end pt-2">
                          <Button variant="outline" onClick={() => setShowAddLibrary(false)}>Cancel</Button>
                          <Button 
                            onClick={handleAddLibrary}
                            className="bg-green-600 hover:bg-green-700"
                            disabled={!newLibrary.name || !newLibrary.path}
                          >
                            <Plus className="w-4 h-4 mr-2" /> Add Library
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Common Paths */}
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm text-gray-400 py-1">Quick paths:</span>
                  {[
                    { name: '/media/movies', type: 'movies' },
                    { name: '/media/tv', type: 'tv' },
                    { name: '/media/downloads', type: 'other' },
                    { name: '/mnt/nas/media', type: 'movies' },
                  ].map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => {
                        setNewLibrary({ 
                          name: preset.name.split('/').pop().charAt(0).toUpperCase() + preset.name.split('/').pop().slice(1), 
                          path: preset.name,
                          media_type: preset.type,
                        });
                        setShowAddLibrary(true);
                      }}
                      className="px-3 py-1 text-xs rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                    >
                      + {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Configured Libraries */}
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold">Configured Libraries ({libraries.length})</h3>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={fetchLibraries}
                    disabled={loadingLibraries}
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingLibraries ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                
                {loadingLibraries ? (
                  <div className="text-center py-8">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-violet-400" />
                    <p className="text-gray-400">Loading libraries...</p>
                  </div>
                ) : libraries.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No libraries configured</p>
                    <p className="text-sm">Add folders above to start scanning for media</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {libraries.map((library) => (
                      <motion.div 
                        key={library.id} 
                        className="flex items-center justify-between p-4 rounded-xl bg-surface border border-white/5 hover:border-white/10 transition-colors"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                            library.media_type === 'movies' ? 'bg-violet-500/20 text-violet-400' :
                            library.media_type === 'tv' ? 'bg-blue-500/20 text-blue-400' :
                            library.media_type === 'anime' ? 'bg-pink-500/20 text-pink-400' :
                            library.media_type === 'music' ? 'bg-green-500/20 text-green-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {library.media_type === 'movies' ? <Film className="w-6 h-6" /> :
                             library.media_type === 'tv' ? <Tv className="w-6 h-6" /> :
                             library.media_type === 'anime' ? <Play className="w-6 h-6" /> :
                             library.media_type === 'music' ? <Music className="w-6 h-6" /> :
                             library.media_type === 'audiobooks' ? <Book className="w-6 h-6" /> :
                             <Folder className="w-6 h-6" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{library.name}</p>
                              <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-gray-400">
                                {library.media_type.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500">{library.path}</p>
                            <p className="text-xs text-gray-600 mt-1">
                              {library.item_count || 0} items • 
                              Last scan: {library.last_scan ? new Date(library.last_scan).toLocaleDateString() : 'Never'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleScanLibrary(library.id)}
                            disabled={scanningLibrary === library.id}
                          >
                            {scanningLibrary === library.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <FileSearch className="w-4 h-4" />
                            )}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleDeleteLibrary(library.id)}
                            className="text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tips */}
              <div className="glass-card rounded-xl p-6">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                  Library Tips
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300">
                    <p><strong>Naming:</strong> Use standard naming like "Movie Name (2024).mkv" or "Show.S01E01.mkv" for best metadata matching.</p>
                  </div>
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-300">
                    <p><strong>Network:</strong> Network paths (NAS, SMB) work too! Use mount points like /mnt/nas/media.</p>
                  </div>
                  <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-300">
                    <p><strong>Scanning:</strong> Large libraries may take a while to scan. Marmalade extracts metadata from filenames.</p>
                  </div>
                  <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-300">
                    <p><strong>Formats:</strong> Supports .mp4, .mkv, .avi, .mov, .wmv, .flv, .webm and more.</p>
                  </div>
                </div>
              </div>
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
                <Button onClick={handleHealthScan} disabled={scanning} className="bg-violet-600 hover:bg-violet-700">
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* Header */}
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <Server className="w-5 h-5 text-violet-400" />
                      Indexers (Compote)
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">
                      Configure torrent indexers, RSS feeds, and usenet sources
                    </p>
                  </div>
                  <Button 
                    onClick={() => setShowAddIndexer(!showAddIndexer)}
                    className="bg-violet-600 hover:bg-violet-700"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add Indexer
                  </Button>
                </div>

                {/* Quick Add Presets */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-sm text-gray-400 py-1">Quick Add:</span>
                  {[
                    { name: '1337x', type: 'torznab', url: 'https://1337x.to', cf: true },
                    { name: 'YTS Movies', type: 'torznab', url: 'https://yts.mx', cf: false },
                    { name: 'EZTV', type: 'torznab', url: 'https://eztv.re', cf: false },
                    { name: 'Nyaa', type: 'torznab', url: 'https://nyaa.si', cf: false },
                    { name: 'ShowRSS', type: 'rss', url: 'https://showrss.info/other/all.rss', cf: false },
                    { name: 'Custom RSS', type: 'rss', url: '', cf: false },
                  ].map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => {
                        setNewIndexer({ 
                          name: preset.name, 
                          type: preset.type, 
                          url: preset.url,
                          api_key: '',
                          cloudflare_protected: preset.cf,
                          search_path: '',
                          cookie: '',
                        });
                        setShowAddIndexer(true);
                      }}
                      className="px-3 py-1 text-xs rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                    >
                      + {preset.name}
                    </button>
                  ))}
                </div>

                {/* Add Indexer Form */}
                {showAddIndexer && (
                  <div className="p-4 rounded-xl bg-surface border border-white/10 space-y-4">
                    <h3 className="font-bold flex items-center gap-2">
                      <Plus className="w-4 h-4 text-green-400" />
                      Add New Indexer
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-400 mb-2 block">Indexer Name *</label>
                        <Input
                          value={newIndexer.name}
                          onChange={(e) => setNewIndexer(p => ({ ...p, name: e.target.value }))}
                          placeholder="My Indexer"
                          className="bg-white/5 border-white/10"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-400 mb-2 block">Type *</label>
                        <select
                          value={newIndexer.type}
                          onChange={(e) => setNewIndexer(p => ({ ...p, type: e.target.value }))}
                          className="w-full h-10 px-3 rounded-md bg-white/5 border border-white/10 text-white"
                        >
                          <option value="torznab">Torrent (via Syrup)</option>
                          <option value="newznab">NZB (via Pulp)</option>
                          <option value="rss">RSS Feed</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">URL *</label>
                      <Input
                        value={newIndexer.url}
                        onChange={(e) => setNewIndexer(p => ({ ...p, url: e.target.value }))}
                        placeholder={
                          newIndexer.type === 'rss' 
                            ? 'https://showrss.info/other/all.rss' 
                            : 'https://1337x.to'
                        }
                        className="bg-white/5 border-white/10"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {newIndexer.type === 'torznab' && 'Torrent site URL - Syrup handles the scraping'}
                        {newIndexer.type === 'newznab' && 'NZB indexer API URL for Pulp'}
                        {newIndexer.type === 'rss' && 'Direct link to RSS/Atom feed'}
                      </p>
                    </div>

                    {newIndexer.type !== 'rss' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-gray-400 mb-2 block">API Key (if required)</label>
                          <Input
                            value={newIndexer.api_key}
                            onChange={(e) => setNewIndexer(p => ({ ...p, api_key: e.target.value }))}
                            placeholder="Optional for most torrent sites"
                            className="bg-white/5 border-white/10"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-gray-400 mb-2 block">Search Path (optional)</label>
                          <Input
                            value={newIndexer.search_path}
                            onChange={(e) => setNewIndexer(p => ({ ...p, search_path: e.target.value }))}
                            placeholder="Auto-detected"
                            className="bg-white/5 border-white/10"
                          />
                        </div>
                      </div>
                    )}

                    {/* Advanced Options */}
                    <div className="pt-4 border-t border-white/10">
                      <h4 className="text-sm font-medium mb-3">Advanced Options (Preserve)</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">Cloudflare Protected</p>
                            <p className="text-xs text-gray-500">Preserve will handle challenge solving automatically</p>
                          </div>
                          <Switch 
                            checked={newIndexer.cloudflare_protected || false}
                            onCheckedChange={(checked) => setNewIndexer(p => ({ ...p, cloudflare_protected: checked }))}
                          />
                        </div>
                        {newIndexer.cloudflare_protected && (
                          <div>
                            <label className="text-sm text-gray-400 mb-2 block">Browser Cookie (optional fallback)</label>
                            <Input
                              value={newIndexer.cookie || ''}
                              onChange={(e) => setNewIndexer(p => ({ ...p, cookie: e.target.value }))}
                              placeholder="Usually not needed - Preserve handles this"
                              className="bg-white/5 border-white/10"
                            />
                            <p className="text-xs text-gray-500 mt-1">Only needed if automatic solving fails</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end pt-4">
                      <Button variant="outline" onClick={() => setShowAddIndexer(false)}>Cancel</Button>
                      <Button 
                        onClick={handleAddNewIndexer}
                        className="bg-green-600 hover:bg-green-700"
                        disabled={!newIndexer.name || !newIndexer.url}
                      >
                        <Plus className="w-4 h-4 mr-2" /> Add Indexer
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Configured Indexers */}
              <div className="glass-card rounded-xl p-6">
                <h3 className="font-bold mb-4">Configured Indexers ({indexers.length})</h3>
                
                {indexers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Server className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No indexers configured</p>
                    <p className="text-sm">Add indexers above to search for content</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {indexers.map((indexer) => (
                      <div 
                        key={indexer.id} 
                        className="flex items-center justify-between p-4 rounded-xl bg-surface border border-white/5 hover:border-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            indexer.enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {indexer.type === 'rss' ? (
                              <Radio className="w-5 h-5" />
                            ) : indexer.type === 'newznab' ? (
                              <Package className="w-5 h-5" />
                            ) : (
                              <Globe className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{indexer.name}</p>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                indexer.type === 'torznab' ? 'bg-blue-500/20 text-blue-400' :
                                indexer.type === 'newznab' ? 'bg-purple-500/20 text-purple-400' :
                                'bg-orange-500/20 text-orange-400'
                              }`}>
                                {indexer.type.toUpperCase()}
                              </span>
                              {indexer.cloudflare_protected && (
                                <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400">CF</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 truncate max-w-md">{indexer.url}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleTestIndexer(indexer.id)}
                            disabled={testingIndexer === indexer.id}
                          >
                            {testingIndexer === indexer.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Wifi className="w-4 h-4" />
                            )}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleDeleteIndexer(indexer.id)}
                            className="text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <Switch 
                            checked={indexer.enabled} 
                            onCheckedChange={() => handleIndexerToggle(indexer)} 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Setup Guide */}
              <div className="glass-card rounded-xl p-6">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <FileSearch className="w-5 h-5 text-blue-400" />
                  Built-in Modules Guide
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Syrup - Aggregator */}
                  <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <h4 className="font-medium text-blue-400 mb-2">🍯 Syrup - Indexer Aggregator</h4>
                    <ol className="text-sm text-blue-300 space-y-1 list-decimal list-inside">
                      <li>Built-in torrent indexer aggregator</li>
                      <li>No external software needed</li>
                      <li>Add torrent sites directly - Syrup scrapes them</li>
                      <li>Supports 1337x, YTS, EZTV, Nyaa, and more</li>
                      <li>Smart parsing of quality, codec, and size</li>
                    </ol>
                  </div>

                  {/* Preserve - CF Bypass */}
                  <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                    <h4 className="font-medium text-yellow-400 mb-2">🛡️ Preserve - Challenge Solver</h4>
                    <ol className="text-sm text-yellow-300 space-y-1 list-decimal list-inside">
                      <li>Built-in Cloudflare protection bypass</li>
                      <li>Automatic - no configuration needed</li>
                      <li>Browser fingerprinting & cookie handling</li>
                      <li>Smart rate limiting with backoff</li>
                      <li>Enable "Cloudflare Protected" toggle</li>
                    </ol>
                  </div>

                  {/* RSS Feeds */}
                  <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                    <h4 className="font-medium text-orange-400 mb-2">📡 RSS Feed Support</h4>
                    <ol className="text-sm text-orange-300 space-y-1 list-decimal list-inside">
                      <li>Add any RSS feed with torrent links</li>
                      <li>ShowRSS.info for TV show tracking</li>
                      <li>Private tracker personal feeds</li>
                      <li>Automatic magnet link extraction</li>
                      <li>Great for new release automation</li>
                    </ol>
                  </div>

                  {/* Pulp - NZB */}
                  <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <h4 className="font-medium text-purple-400 mb-2">📰 Pulp - NZB Handler</h4>
                    <ol className="text-sm text-purple-300 space-y-1 list-decimal list-inside">
                      <li>Built-in Usenet/NZB support</li>
                      <li>Supports Newznab API indexers</li>
                      <li>Enter your NZB indexer credentials</li>
                      <li>Integrated download management</li>
                      <li>Works with any Newznab indexer</li>
                    </ol>
                  </div>
                </div>
              </div>
            </motion.div>
          </TabsContent>

          {/* Download Client */}
          <TabsContent value="download">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* Download Client Mode Selection */}
              <div className="glass-card rounded-xl p-6">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                  <Download className="w-5 h-5 text-violet-400" />
                  Download Client
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {/* Built-in Engine Option */}
                  <button
                    onClick={() => {
                      setDownloadClientMode('builtin');
                      localStorage.setItem('watchnexus_download_mode', 'builtin');
                    }}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      downloadClientMode === 'builtin'
                        ? 'border-violet-500 bg-violet-500/10'
                        : 'border-white/10 bg-surface hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        downloadClientMode === 'builtin' ? 'bg-violet-500' : 'bg-white/10'
                      }`}>
                        <Zap className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold">Built-in Engine</h3>
                        <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">Recommended</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400">
                      No external apps required! Fully integrated torrent engine with streaming support.
                    </p>
                  </button>
                  
                  {/* qBittorrent Option */}
                  <button
                    onClick={() => {
                      setDownloadClientMode('qbittorrent');
                      localStorage.setItem('watchnexus_download_mode', 'qbittorrent');
                    }}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      downloadClientMode === 'qbittorrent'
                        ? 'border-violet-500 bg-violet-500/10'
                        : 'border-white/10 bg-surface hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        downloadClientMode === 'qbittorrent' ? 'bg-violet-500' : 'bg-white/10'
                      }`}>
                        <Package className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold">qBittorrent</h3>
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">External App</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400">
                      Connect to external qBittorrent instance. Requires separate installation.
                    </p>
                  </button>
                </div>
              </div>

              {/* Built-in Engine Configuration */}
              {downloadClientMode === 'builtin' && (
                <div className="space-y-6">
                  {/* Status Card */}
                  <div className="glass-card rounded-xl p-6">
                    <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                      <Zap className="w-5 h-5 text-green-400" />
                      Engine Status
                    </h3>
                    <div className={`p-4 rounded-xl border ${engineStatus?.success ? 'bg-green-500/10 border-green-500/30' : 'bg-surface border-white/10'}`}>
                      <div className="flex items-center gap-3">
                        {engineStatus?.success ? <CheckCircle className="w-5 h-5 text-green-400" /> : <AlertTriangle className="w-5 h-5 text-yellow-400" />}
                        <div className="flex-1">
                          <p className={engineStatus?.success ? 'text-green-400 font-medium' : 'text-yellow-400'}>
                            {engineStatus?.success ? `${engineStatus.engine} - Running` : 'Engine Starting...'}
                          </p>
                          {engineStatus?.transfer && (
                            <p className="text-sm text-gray-400">
                              ↓ {engineStatus.transfer.download_rate_formatted} | ↑ {engineStatus.transfer.upload_rate_formatted} | 
                              {engineStatus.transfer.downloading} downloading | {engineStatus.transfer.seeding} seeding | 
                              DHT: {engineStatus.transfer.dht_nodes} nodes
                            </p>
                          )}
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => { setTestingEngine(true); fetchEngineStatus().finally(() => setTestingEngine(false)); }}
                          disabled={testingEngine}
                        >
                          <RefreshCw className={`w-4 h-4 ${testingEngine ? 'animate-spin' : ''}`} />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Queue Management */}
                  <div className="glass-card rounded-xl p-6">
                    <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                      <DownloadCloud className="w-5 h-5 text-blue-400" />
                      Queue Management
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm text-gray-400 mb-2 block">Max Active Downloads</label>
                        <Input 
                          type="number" 
                          min="1" 
                          max="20"
                          value={engineSettings.max_active_downloads}
                          onChange={(e) => setEngineSettings(p => ({ ...p, max_active_downloads: parseInt(e.target.value) || 3 }))}
                          className="bg-white/5 border-white/10"
                        />
                        <p className="text-xs text-gray-500 mt-1">Recommended: 3-5</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-400 mb-2 block">Max Active Uploads</label>
                        <Input 
                          type="number" 
                          min="1" 
                          max="20"
                          value={engineSettings.max_active_uploads}
                          onChange={(e) => setEngineSettings(p => ({ ...p, max_active_uploads: parseInt(e.target.value) || 3 }))}
                          className="bg-white/5 border-white/10"
                        />
                        <p className="text-xs text-gray-500 mt-1">Recommended: 2-4</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-400 mb-2 block">Max Total Active</label>
                        <Input 
                          type="number" 
                          min="1" 
                          max="30"
                          value={engineSettings.max_active_torrents}
                          onChange={(e) => setEngineSettings(p => ({ ...p, max_active_torrents: parseInt(e.target.value) || 5 }))}
                          className="bg-white/5 border-white/10"
                        />
                        <p className="text-xs text-gray-500 mt-1">Recommended: 5-10</p>
                      </div>
                    </div>
                  </div>

                  {/* Speed Limits */}
                  <div className="glass-card rounded-xl p-6">
                    <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                      <Zap className="w-5 h-5 text-yellow-400" />
                      Speed Limits
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-400 mb-2 block">Max Download Speed (KB/s)</label>
                        <Input 
                          type="number" 
                          min="0"
                          value={engineSettings.max_download_rate}
                          onChange={(e) => setEngineSettings(p => ({ ...p, max_download_rate: parseInt(e.target.value) || 0 }))}
                          className="bg-white/5 border-white/10"
                          placeholder="0 = Unlimited"
                        />
                        <p className="text-xs text-gray-500 mt-1">0 = Unlimited</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-400 mb-2 block">Max Upload Speed (KB/s)</label>
                        <Input 
                          type="number" 
                          min="0"
                          value={engineSettings.max_upload_rate}
                          onChange={(e) => setEngineSettings(p => ({ ...p, max_upload_rate: parseInt(e.target.value) || 0 }))}
                          className="bg-white/5 border-white/10"
                          placeholder="0 = Unlimited"
                        />
                        <p className="text-xs text-gray-500 mt-1">0 = Unlimited</p>
                      </div>
                    </div>
                  </div>

                  {/* Seeding Limits */}
                  <div className="glass-card rounded-xl p-6">
                    <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                      <Clock className="w-5 h-5 text-purple-400" />
                      Seeding Limits
                    </h3>
                    <p className="text-sm text-gray-400 mb-4">Stop seeding when either condition is met (whichever comes first)</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm text-gray-400 mb-2 block">Seed Ratio Limit</label>
                        <Input 
                          type="number" 
                          min="0"
                          step="0.1"
                          value={engineSettings.seed_ratio_limit}
                          onChange={(e) => setEngineSettings(p => ({ ...p, seed_ratio_limit: parseFloat(e.target.value) || 0 }))}
                          className="bg-white/5 border-white/10"
                          placeholder="1.0"
                        />
                        <p className="text-xs text-gray-500 mt-1">0 = Disabled | 1.0 = Equal upload</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-400 mb-2 block">Seed Time Limit (minutes)</label>
                        <Input 
                          type="number" 
                          min="0"
                          value={engineSettings.seed_time_limit}
                          onChange={(e) => setEngineSettings(p => ({ ...p, seed_time_limit: parseInt(e.target.value) || 0 }))}
                          className="bg-white/5 border-white/10"
                          placeholder="60"
                        />
                        <p className="text-xs text-gray-500 mt-1">0 = Disabled</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-400 mb-2 block">When Limit Reached</label>
                        <select
                          value={engineSettings.seed_ratio_action}
                          onChange={(e) => setEngineSettings(p => ({ ...p, seed_ratio_action: e.target.value }))}
                          className="w-full h-10 px-3 rounded-md bg-white/5 border border-white/10 text-white"
                        >
                          <option value="pause">Pause Torrent</option>
                          <option value="remove">Remove Torrent</option>
                          <option value="remove_with_data">Remove + Delete Files</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Auto-Cleanup */}
                  <div className="glass-card rounded-xl p-6">
                    <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                      <Trash2 className="w-5 h-5 text-red-400" />
                      Auto-Cleanup
                    </h3>
                    <p className="text-sm text-gray-400 mb-4">Automatically manage completed torrents to prevent buildup</p>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Remove After Download Complete</p>
                          <p className="text-sm text-gray-500">Immediately remove torrent when download finishes</p>
                        </div>
                        <Switch 
                          checked={engineSettings.remove_after_completion}
                          onCheckedChange={(checked) => setEngineSettings(p => ({ ...p, remove_after_completion: checked }))}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Remove After Seeding Limit</p>
                          <p className="text-sm text-gray-500">Remove torrent when seeding limit is reached</p>
                        </div>
                        <Switch 
                          checked={engineSettings.remove_after_seeding}
                          onCheckedChange={(checked) => setEngineSettings(p => ({ ...p, remove_after_seeding: checked }))}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Delete Files When Removing</p>
                          <p className="text-sm text-gray-500 text-red-400">⚠️ Will delete downloaded content!</p>
                        </div>
                        <Switch 
                          checked={engineSettings.delete_files_on_remove}
                          onCheckedChange={(checked) => setEngineSettings(p => ({ ...p, delete_files_on_remove: checked }))}
                        />
                      </div>
                      <div className="pt-4 border-t border-white/10">
                        <label className="text-sm text-gray-400 mb-2 block">Max Completed Torrents to Keep</label>
                        <Input 
                          type="number" 
                          min="0"
                          value={engineSettings.max_completed_torrents}
                          onChange={(e) => setEngineSettings(p => ({ ...p, max_completed_torrents: parseInt(e.target.value) || 0 }))}
                          className="bg-white/5 border-white/10 w-32"
                          placeholder="50"
                        />
                        <p className="text-xs text-gray-500 mt-1">0 = Keep all | Oldest will be auto-removed when exceeded</p>
                      </div>
                    </div>
                  </div>

                  {/* Connection Settings */}
                  <div className="glass-card rounded-xl p-6">
                    <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                      <Globe className="w-5 h-5 text-cyan-400" />
                      Connection Settings
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div>
                        <label className="text-sm text-gray-400 mb-2 block">Global Max Connections</label>
                        <Input 
                          type="number" 
                          min="10" 
                          max="1000"
                          value={engineSettings.max_connections_global}
                          onChange={(e) => setEngineSettings(p => ({ ...p, max_connections_global: parseInt(e.target.value) || 200 }))}
                          className="bg-white/5 border-white/10"
                        />
                        <p className="text-xs text-gray-500 mt-1">Recommended: 200-500</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-400 mb-2 block">Max Connections Per Torrent</label>
                        <Input 
                          type="number" 
                          min="5" 
                          max="200"
                          value={engineSettings.max_connections_per_torrent}
                          onChange={(e) => setEngineSettings(p => ({ ...p, max_connections_per_torrent: parseInt(e.target.value) || 50 }))}
                          className="bg-white/5 border-white/10"
                        />
                        <p className="text-xs text-gray-500 mt-1">Recommended: 50-100</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">DHT (Distributed Hash Table)</p>
                          <p className="text-sm text-gray-500">Find peers without trackers</p>
                        </div>
                        <Switch 
                          checked={engineSettings.enable_dht}
                          onCheckedChange={(checked) => setEngineSettings(p => ({ ...p, enable_dht: checked }))}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">PEX (Peer Exchange)</p>
                          <p className="text-sm text-gray-500">Share peers with other clients</p>
                        </div>
                        <Switch 
                          checked={engineSettings.enable_pex}
                          onCheckedChange={(checked) => setEngineSettings(p => ({ ...p, enable_pex: checked }))}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">LSD (Local Service Discovery)</p>
                          <p className="text-sm text-gray-500">Find peers on local network</p>
                        </div>
                        <Switch 
                          checked={engineSettings.enable_lsd}
                          onCheckedChange={(checked) => setEngineSettings(p => ({ ...p, enable_lsd: checked }))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Behavior */}
                  <div className="glass-card rounded-xl p-6">
                    <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                      <Settings className="w-5 h-5 text-gray-400" />
                      Behavior
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Sequential Download by Default</p>
                          <p className="text-sm text-gray-500">Download pieces in order (better for streaming)</p>
                        </div>
                        <Switch 
                          checked={engineSettings.sequential_download_default}
                          onCheckedChange={(checked) => setEngineSettings(p => ({ ...p, sequential_download_default: checked }))}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Add Torrents Paused</p>
                          <p className="text-sm text-gray-500">New torrents start paused for manual review</p>
                        </div>
                        <Switch 
                          checked={engineSettings.add_paused}
                          onCheckedChange={(checked) => setEngineSettings(p => ({ ...p, add_paused: checked }))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end">
                    <Button 
                      onClick={saveEngineSettings} 
                      disabled={savingEngineSettings}
                      className="bg-violet-600 hover:bg-violet-700"
                    >
                      {savingEngineSettings ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                      Save Engine Settings
                    </Button>
                  </div>
                </div>
              )}

              {/* qBittorrent Configuration */}
              {downloadClientMode === 'qbittorrent' && (
                <div className="glass-card rounded-xl p-6 space-y-6">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Package className="w-5 h-5 text-blue-400" />
                    qBittorrent Connection
                  </h3>

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
                </div>
              )}
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

          {/* Gelatin - External Access */}
          <TabsContent value="gelatin">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-xl p-6 space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Globe className="w-5 h-5 text-violet-400" />
                Gelatin - External Access
              </h2>
              <p className="text-gray-400">
                Make WatchNexus accessible from outside your local network for watch parties and remote streaming.
              </p>

              {/* Server Status */}
              {gelatinStatus && (
                <div className="p-4 rounded-xl bg-surface border border-white/5 space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <Server className="w-4 h-4 text-gray-400" />
                    Server Status
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-white/5">
                      <p className="text-xs text-gray-500 mb-1">Server ID</p>
                      <p className="font-mono text-sm">{gelatinStatus.server_id}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5">
                      <p className="text-xs text-gray-500 mb-1">Local IP</p>
                      <p className="font-mono text-sm">{gelatinStatus.local_ip}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 md:col-span-2">
                      <p className="text-xs text-gray-500 mb-1">LAN URL</p>
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-sm text-violet-400">{gelatinStatus.lan_url}</p>
                        <Button size="sm" variant="ghost" onClick={() => {
                          navigator.clipboard.writeText(gelatinStatus.lan_url);
                          toast.success('Copied to clipboard');
                        }}>
                          Copy
                        </Button>
                      </div>
                    </div>
                    {gelatinStatus.external_url && (
                      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 md:col-span-2">
                        <p className="text-xs text-green-400 mb-1">External URL (Active)</p>
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-sm text-green-400">{gelatinStatus.external_url}</p>
                          <Button size="sm" variant="ghost" onClick={() => {
                            navigator.clipboard.writeText(gelatinStatus.external_url);
                            toast.success('Copied to clipboard');
                          }}>
                            Copy
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {gelatinStatus.features?.map((feature) => (
                      <span key={feature} className="px-2 py-1 rounded-full bg-violet-500/20 text-violet-400 text-xs">
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tunnel Management */}
              <div className="p-4 rounded-xl bg-surface border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-gray-400" />
                    Network Tunnels
                  </h3>
                  <Button onClick={handleCreateTunnel} disabled={creatingTunnel} className="bg-violet-600 hover:bg-violet-700">
                    {creatingTunnel ? (
                      <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
                    ) : (
                      <><Plus className="w-4 h-4 mr-2" /> Create Tunnel</>
                    )}
                  </Button>
                </div>
                
                {activeTunnels.length > 0 ? (
                  <div className="space-y-2">
                    {activeTunnels.map((tunnel) => (
                      <div key={tunnel.tunnel_id} className="p-3 rounded-lg bg-white/5 flex items-center justify-between">
                        <div>
                          <p className="font-mono text-sm text-violet-400">{tunnel.public_url}</p>
                          <p className="text-xs text-gray-500">ID: {tunnel.tunnel_id} • Created: {new Date(tunnel.created_at).toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="ghost" onClick={() => {
                            navigator.clipboard.writeText(tunnel.public_url);
                            toast.success('URL copied');
                          }}>
                            Copy
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleCloseTunnel(tunnel.tunnel_id)} className="text-red-400 hover:bg-red-500/10">
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <WifiOff className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>No active tunnels</p>
                    <p className="text-sm">Create a tunnel to enable external access</p>
                  </div>
                )}
              </div>

              {/* Access Token */}
              <div className="p-4 rounded-xl bg-surface border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium flex items-center gap-2">
                      <Shield className="w-4 h-4 text-gray-400" />
                      Access Tokens
                    </h3>
                    <p className="text-sm text-gray-500">Generate tokens for secure guest access</p>
                  </div>
                  <Button onClick={handleGenerateAccessToken} variant="outline" className="border-white/10 hover:bg-white/5">
                    <Plus className="w-4 h-4 mr-2" /> Generate Token
                  </Button>
                </div>
                
                {accessToken && (
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <p className="text-xs text-green-400 mb-2">New Access Token (copy now, won't be shown again)</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2 rounded bg-black/20 text-sm font-mono break-all">{accessToken.token}</code>
                      <Button size="sm" onClick={() => {
                        navigator.clipboard.writeText(accessToken.token);
                        toast.success('Token copied');
                      }}>
                        Copy
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Permissions: {accessToken.permissions?.join(', ')} • Expires in {accessToken.expires_hours}h</p>
                  </div>
                )}
              </div>

              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <p className="text-sm text-blue-400">
                  <strong>Tip:</strong> Use external access for watch parties with friends who aren't on your local network.
                  The LAN URL works for devices connected to the same WiFi/network.
                </p>
              </div>
            </motion.div>
          </TabsContent>

          {/* Theme Forge (Milk) */}
          <TabsContent value="theme-forge">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-xl p-6 space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Palette className="w-5 h-5 text-violet-400" />
                Theme Forge
                <span className="text-xs bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full">Milk 🥛</span>
              </h2>
              <p className="text-gray-400">
                Customize the visual appearance of WatchNexus with built-in themes or create your own.
              </p>

              {/* Built-in Themes */}
              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-gray-400" />
                  Built-in Themes
                </h3>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {themeForgeConfig?.built_in?.map((theme) => (
                    <button
                      key={theme.type}
                      onClick={() => handleSetTheme(theme.type)}
                      className={`p-4 rounded-xl border transition-all text-left ${
                        selectedTheme === theme.type
                          ? 'border-violet-500 bg-violet-500/10'
                          : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: theme.preview_colors?.primary }}
                        />
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: theme.preview_colors?.secondary }}
                        />
                      </div>
                      <p className="font-medium">{theme.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{theme.description}</p>
                      {selectedTheme === theme.type && (
                        <div className="mt-2 flex items-center gap-1 text-violet-400 text-xs">
                          <Check className="w-3 h-3" /> Active
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Theme */}
              <div className="p-4 rounded-xl bg-surface border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium flex items-center gap-2">
                    <Paintbrush className="w-4 h-4 text-gray-400" />
                    Custom Theme
                  </h3>
                  <Button
                    onClick={handleSaveCustomTheme}
                    disabled={savingTheme}
                    className="bg-violet-600 hover:bg-violet-700"
                  >
                    {savingTheme ? 'Saving...' : 'Save & Apply'}
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <JuiceColorPicker
                    label="Primary Color"
                    color={customColors.primary}
                    onChange={(color) => setCustomColors(prev => ({ ...prev, primary: color }))}
                  />
                  <JuiceColorPicker
                    label="Secondary Color"
                    color={customColors.secondary}
                    onChange={(color) => setCustomColors(prev => ({ ...prev, secondary: color }))}
                  />
                  <JuiceColorPicker
                    label="Background"
                    color={customColors.background}
                    onChange={(color) => setCustomColors(prev => ({ ...prev, background: color }))}
                  />
                  <JuiceColorPicker
                    label="Surface"
                    color={customColors.surface}
                    onChange={(color) => setCustomColors(prev => ({ ...prev, surface: color }))}
                  />
                </div>

                {/* Preview */}
                <div className="p-4 rounded-lg" style={{ backgroundColor: customColors.background }}>
                  <p className="text-sm text-gray-500 mb-2">Preview</p>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: customColors.surface }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg" style={{ background: `linear-gradient(135deg, ${customColors.primary}, ${customColors.secondary})` }} />
                      <div>
                        <p style={{ color: customColors.text_primary || '#fff' }}>Sample Title</p>
                        <p className="text-sm" style={{ color: '#a1a1aa' }}>Sample description text</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button className="px-4 py-2 rounded-lg text-white text-sm" style={{ backgroundColor: customColors.primary }}>
                        Primary Button
                      </button>
                      <button className="px-4 py-2 rounded-lg text-white text-sm" style={{ backgroundColor: customColors.secondary }}>
                        Secondary
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Import/Export */}
              <div className="flex items-center gap-3 pt-2">
                <Button variant="outline" className="border-white/10 hover:bg-white/5">
                  <Import className="w-4 h-4 mr-2" /> Import Theme
                </Button>
                <Button variant="outline" className="border-white/10 hover:bg-white/5">
                  <FileJson className="w-4 h-4 mr-2" /> Export Theme
                </Button>
              </div>

              <div className="p-4 rounded-xl bg-pink-500/10 border border-pink-500/20">
                <p className="text-sm text-pink-400">
                  <strong>Tip:</strong> Changes are applied instantly. Use the preview to see how colors look together before saving.
                </p>
              </div>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default SettingsPage;
