import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { settingsApi, indexersApi, streamingApi, mediaHealthApi } from '../services/api';
import { toast } from 'sonner';
import { 
  Settings, Server, Download, Subtitles, Shield, 
  Folder, Check, X, Plus, Trash2, ExternalLink, Globe,
  AlertTriangle, CheckCircle, RefreshCw, FileSearch, Wrench, HardDrive,
  Clock, Bell, Calendar, DownloadCloud
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

  useEffect(() => {
    fetchData();
    fetchScheduledScans();
    fetchNotifications();
  }, []);

  const fetchScheduledScans = async () => {
    try {
      const res = await mediaHealthApi.getScheduledScans();
      setScheduledScans(res.data || []);
    } catch (error) {
      console.error('Failed to fetch scheduled scans:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await mediaHealthApi.getNotifications(true);
      setNotifications(res.data || []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

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
      console.error('Scan error:', error);
      toast.error('Failed to scan library');
    } finally {
      setScanning(false);
    }
  };

  const handleCheckSingleFile = async (filePath) => {
    try {
      const res = await mediaHealthApi.checkFile(filePath);
      return res.data;
    } catch (error) {
      toast.error('Failed to check file');
      return null;
    }
  };

  const handleRepairFile = async (filePath) => {
    setRepairing(filePath);
    try {
      const res = await mediaHealthApi.repairFile(filePath);
      if (res.data.success) {
        toast.success(res.data.message);
        // Re-scan to update results
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

  const handleRedownload = async (filePath, result) => {
    setRedownloading(filePath);
    try {
      // Extract title from filename
      const filename = filePath.split('/').pop();
      const title = filename.replace(/\.[^/.]+$/, '').replace(/[._-]/g, ' ');
      
      const res = await mediaHealthApi.requestRedownload(filePath, title, 'movie');
      toast.success(res.data.message);
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to queue re-download';
      toast.error(message);
    } finally {
      setRedownloading(null);
    }
  };

  // Scheduled Scans functions
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
      const { total_files, healthy_files, warning_files, error_files } = res.data;
      toast.success(`Scan complete: ${total_files} files (${healthy_files} healthy, ${warning_files} warnings, ${error_files} errors)`);
      fetchScheduledScans();
      fetchNotifications();
    } catch (error) {
      toast.error('Failed to run scan');
    } finally {
      setScanning(false);
    }
  };

  const handleMarkNotificationRead = async (notificationId) => {
    try {
      await mediaHealthApi.markNotificationRead(notificationId);
      fetchNotifications();
    } catch (error) {
      console.error('Failed to mark notification read');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': return 'bg-green-500/20 text-green-400';
      case 'warning': return 'bg-yellow-500/20 text-yellow-400';
      case 'repairable': return 'bg-orange-500/20 text-orange-400';
      case 'error': return 'bg-red-500/20 text-red-400';
      case 'corrupt': return 'bg-red-600/20 text-red-500';
      default: return 'bg-gray-500/20 text-gray-400';
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
          <TabsList className="bg-surface border border-white/10 flex-wrap">
            <TabsTrigger value="general" className="data-[state=active]:bg-violet-600">
              General
            </TabsTrigger>
            <TabsTrigger value="media-health" className="data-[state=active]:bg-violet-600">
              Media Health
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

          {/* Media Health Checker */}
          <TabsContent value="media-health">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card rounded-xl p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <HardDrive className="w-5 h-5 text-violet-400" />
                    Media Health Checker
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">
                    Scan your media library for corrupted, incomplete, or problematic files
                  </p>
                </div>
              </div>

              {/* Scan Input */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Directory to Scan</label>
                  <div className="flex gap-3">
                    <Input
                      value={healthScanPath}
                      onChange={(e) => setHealthScanPath(e.target.value)}
                      placeholder="/media/library or /path/to/movies"
                      data-testid="health-scan-path-input"
                      className="bg-white/5 border-white/10 flex-1"
                    />
                    <Button
                      onClick={handleScanLibrary}
                      disabled={scanning}
                      data-testid="scan-library-btn"
                      className="bg-violet-600 hover:bg-violet-700"
                    >
                      {scanning ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Scanning...
                        </>
                      ) : (
                        <>
                          <FileSearch className="w-4 h-4 mr-2" />
                          Scan Library
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Enter the full path to your media directory. Supports .mp4, .mkv, .avi, .mov, and more.
                  </p>
                </div>
              </div>

              {/* Results */}
              {healthResults.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Scan Results ({healthResults.length} files)</h3>
                    <div className="flex gap-2 text-sm">
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
                  </div>

                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {healthResults.map((result, index) => (
                      <div
                        key={index}
                        data-testid={`health-result-${index}`}
                        className="p-4 rounded-xl bg-surface border border-white/5"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${getStatusColor(result.status)}`}>
                              {getStatusIcon(result.status)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate" title={result.file_path}>
                                {result.file_path.split('/').pop()}
                              </p>
                              <p className="text-xs text-gray-500 truncate" title={result.file_path}>
                                {result.file_path}
                              </p>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {result.video_codec && (
                                  <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs">
                                    {result.video_codec}
                                  </span>
                                )}
                                {result.audio_codec && (
                                  <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 text-xs">
                                    {result.audio_codec}
                                  </span>
                                )}
                                {result.duration && (
                                  <span className="px-2 py-0.5 rounded bg-gray-500/20 text-gray-400 text-xs">
                                    {Math.floor(result.duration / 60)}m {Math.floor(result.duration % 60)}s
                                  </span>
                                )}
                                <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(result.status)}`}>
                                  {result.status}
                                </span>
                              </div>
                              
                              {/* Issues and Warnings */}
                              {(result.issues?.length > 0 || result.warnings?.length > 0) && (
                                <div className="mt-3 space-y-1">
                                  {result.issues?.map((issue, i) => (
                                    <p key={`issue-${i}`} className="text-xs text-red-400 flex items-start gap-1">
                                      <X className="w-3 h-3 mt-0.5 flex-shrink-0" /> {issue}
                                    </p>
                                  ))}
                                  {result.warnings?.map((warning, i) => (
                                    <p key={`warning-${i}`} className="text-xs text-yellow-400 flex items-start gap-1">
                                      <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {warning}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Repair Button */}
                          {result.repairable && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRepairFile(result.file_path)}
                              disabled={repairing === result.file_path}
                              className="bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20 flex-shrink-0"
                            >
                              {repairing === result.file_path ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Wrench className="w-4 h-4 mr-1" />
                                  Repair
                                </>
                              )}
                            </Button>
                          )}
                          
                          {/* Re-download Button */}
                          {result.status !== 'healthy' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRedownload(result.file_path, result)}
                              disabled={redownloading === result.file_path}
                              data-testid={`redownload-btn-${result.file_path}`}
                              className="bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 flex-shrink-0"
                            >
                              {redownloading === result.file_path ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <DownloadCloud className="w-4 h-4 mr-1" />
                                  Re-download
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Scheduled Scans Section */}
              <div className="border-t border-white/10 pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold flex items-center gap-2">
                      <Clock className="w-5 h-5 text-violet-400" />
                      Scheduled Scans
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                      Automatically scan your library on a schedule
                    </p>
                  </div>
                  {notifications.length > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-sm">
                      <Bell className="w-4 h-4" />
                      {notifications.length} unread
                    </div>
                  )}
                </div>

                {/* New Scheduled Scan Form */}
                <div className="p-4 rounded-xl bg-surface border border-white/5 space-y-4">
                  <h4 className="font-medium">Add New Scheduled Scan</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                      value={newScanForm.directory}
                      onChange={(e) => setNewScanForm(prev => ({ ...prev, directory: e.target.value }))}
                      placeholder="/media/movies"
                      data-testid="scheduled-scan-directory"
                      className="bg-white/5 border-white/10"
                    />
                    <select
                      value={newScanForm.schedule_type}
                      onChange={(e) => setNewScanForm(prev => ({ ...prev, schedule_type: e.target.value }))}
                      className="bg-white/5 border border-white/10 rounded-md px-3 text-white"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                    <Input
                      type="time"
                      value={newScanForm.schedule_time}
                      onChange={(e) => setNewScanForm(prev => ({ ...prev, schedule_time: e.target.value }))}
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={newScanForm.notify_on_issues}
                        onCheckedChange={(checked) => setNewScanForm(prev => ({ ...prev, notify_on_issues: checked }))}
                      />
                      Notify on issues
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={newScanForm.auto_repair}
                        onCheckedChange={(checked) => setNewScanForm(prev => ({ ...prev, auto_repair: checked }))}
                      />
                      Auto-repair
                    </label>
                  </div>
                  <Button
                    onClick={handleCreateScheduledScan}
                    data-testid="create-scheduled-scan-btn"
                    className="bg-violet-600 hover:bg-violet-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Scheduled Scan
                  </Button>
                </div>

                {/* Existing Scheduled Scans */}
                {scheduledScans.length > 0 && (
                  <div className="space-y-2">
                    {scheduledScans.map((scan) => (
                      <div
                        key={scan.id}
                        className="p-4 rounded-xl bg-surface border border-white/5 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-violet-400" />
                          </div>
                          <div>
                            <p className="font-medium">{scan.directory}</p>
                            <p className="text-sm text-gray-400">
                              {scan.schedule_type} at {scan.schedule_time}
                              {scan.last_scan && ` • Last: ${new Date(scan.last_scan).toLocaleDateString()}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRunScanNow(scan.id)}
                            disabled={scanning}
                            className="text-violet-400 border-violet-500/30"
                          >
                            <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteScheduledScan(scan.id)}
                            className="text-red-400 border-red-500/30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Info Box */}
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <h4 className="font-medium text-blue-400 mb-2">What does this check?</h4>
                <ul className="text-sm text-blue-300 space-y-1 list-disc list-inside">
                  <li>Container integrity and metadata</li>
                  <li>Video/audio codec compatibility</li>
                  <li>Keyframe distribution for smooth seeking</li>
                  <li>Audio/video sync issues</li>
                  <li>moov atom positioning (affects streaming start)</li>
                  <li>Duration consistency between streams</li>
                </ul>
              </div>
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
                Download Client (qBittorrent)
              </h2>

              <div className="grid gap-4">
                <div className="p-4 rounded-xl bg-surface border border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Download className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="font-medium">qBittorrent</p>
                        <p className="text-sm text-gray-500">External torrent client via Web API</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-sm">
                      Recommended
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Host</label>
                    <Input
                      placeholder="localhost"
                      defaultValue="localhost"
                      data-testid="qbit-host"
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Port</label>
                    <Input
                      type="number"
                      placeholder="8080"
                      defaultValue="8080"
                      data-testid="qbit-port"
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Username</label>
                    <Input
                      placeholder="admin"
                      defaultValue="admin"
                      data-testid="qbit-username"
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Password</label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      data-testid="qbit-password"
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    className="border-white/10"
                    data-testid="qbit-test-btn"
                  >
                    Test Connection
                  </Button>
                  <Button className="bg-violet-600 hover:bg-violet-700">
                    Save Settings
                  </Button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <h4 className="font-medium text-blue-400 mb-2">Setup Instructions</h4>
                <ol className="text-sm text-blue-300 space-y-1 list-decimal list-inside">
                  <li>Install qBittorrent from <a href="https://www.qbittorrent.org" target="_blank" rel="noopener noreferrer" className="underline">qbittorrent.org</a></li>
                  <li>Enable Web UI in Tools → Options → Web UI</li>
                  <li>Set username and password</li>
                  <li>Enter connection details above and test</li>
                </ol>
              </div>
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
