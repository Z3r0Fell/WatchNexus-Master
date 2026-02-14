import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Database, Server, HardDrive, Cpu, Clock, RefreshCw,
  Trash2, Download, Activity, CheckCircle2, AlertTriangle,
  Archive, Zap, MemoryStick, Disc, Info, Shield, FileText,
  ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export const MaintenanceSettings = () => {
  const [systemStats, setSystemStats] = useState(null);
  const [dbStats, setDbStats] = useState(null);
  const [backups, setBackups] = useState([]);
  const [cacheStats, setCacheStats] = useState(null);
  const [torrentStatus, setTorrentStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  
  // Log viewer state
  const [logs, setLogs] = useState([]);
  const [logFiles, setLogFiles] = useState([]);
  const [selectedLogFile, setSelectedLogFile] = useState('watchnexus.log');
  const [logExpanded, setLogExpanded] = useState(false);
  const [logLines, setLogLines] = useState(100);

  const fetchAllStats = useCallback(async () => {
    setLoading(true);
    try {
      const [systemRes, dbRes, backupsRes, cacheRes, torrentRes, logFilesRes] = await Promise.all([
        axios.get(`${API_URL}/api/system/stats`).catch(() => ({ data: null })),
        axios.get(`${API_URL}/api/db/stats`).catch(() => ({ data: null })),
        axios.get(`${API_URL}/api/db/backups`).catch(() => ({ data: { backups: [] } })),
        axios.get(`${API_URL}/api/cache/stats`).catch(() => ({ data: null })),
        axios.get(`${API_URL}/api/torrent/status`).catch(() => ({ data: null })),
        axios.get(`${API_URL}/api/logs/list`).catch(() => ({ data: { logs: [] } })),
      ]);
      
      setSystemStats(systemRes.data);
      setDbStats(dbRes.data);
      setBackups(backupsRes.data?.backups || []);
      setCacheStats(cacheRes.data);
      setTorrentStatus(torrentRes.data);
      setLogFiles(logFilesRes.data?.logs || []);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/logs/view`, {
        params: { filename: selectedLogFile, lines: logLines }
      });
      setLogs(res.data?.lines || []);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  }, [selectedLogFile, logLines]);

  useEffect(() => {
    fetchAllStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchAllStats, 30000);
    return () => clearInterval(interval);
  }, [fetchAllStats]);

  useEffect(() => {
    if (logExpanded) {
      fetchLogs();
      // Auto-refresh logs every 5 seconds when expanded
      const interval = setInterval(fetchLogs, 5000);
      return () => clearInterval(interval);
    }
  }, [logExpanded, fetchLogs]);

  const handleAction = async (action, endpoint, successMessage) => {
    setActionLoading(prev => ({ ...prev, [action]: true }));
    try {
      await axios.post(`${API_URL}${endpoint}`);
      toast.success(successMessage);
      fetchAllStats();
    } catch (error) {
      toast.error(error.response?.data?.message || `Failed to ${action}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [action]: false }));
    }
  };

  const StatCard = ({ icon: Icon, title, value, subtitle, color = "violet", progress = null }) => (
    <div className="bg-black/30 border border-white/10 rounded-xl p-4">
      <div className="flex items-start justify-between mb-2">
        <div className={`w-10 h-10 rounded-lg bg-${color}-500/20 flex items-center justify-center`}>
          <Icon className={`w-5 h-5 text-${color}-400`} />
        </div>
        {progress !== null && (
          <span className={`text-sm font-medium ${progress > 80 ? 'text-red-400' : progress > 60 ? 'text-yellow-400' : 'text-green-400'}`}>
            {progress}%
          </span>
        )}
      </div>
      <h3 className="text-2xl font-bold text-white">{value}</h3>
      <p className="text-sm text-gray-400">{title}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      {progress !== null && (
        <Progress value={progress} className="mt-2 h-1.5" />
      )}
    </div>
  );

  const StatusBadge = ({ status }) => {
    const colors = {
      healthy: 'bg-green-500/20 text-green-400 border-green-500/30',
      running: 'bg-green-500/20 text-green-400 border-green-500/30',
      warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      error: 'bg-red-500/20 text-red-400 border-red-500/30',
      stopped: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${colors[status] || colors.error}`}>
        {status?.charAt(0).toUpperCase() + status?.slice(1)}
      </span>
    );
  };

  if (loading && !systemStats) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
      data-testid="maintenance-settings"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield className="w-5 h-5 text-violet-400" />
            System Maintenance
          </h2>
          <p className="text-gray-400 text-sm">Monitor system health and perform maintenance tasks</p>
        </div>
        <Button 
          variant="outline" 
          onClick={fetchAllStats}
          disabled={loading}
          className="border-white/20"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Server Status */}
      <div className="bg-surface border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Server className="w-5 h-5 text-violet-400" />
          Server Status
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Activity}
            title="Status"
            value={systemStats?.app?.name || 'WatchNexus'}
            subtitle={`v${systemStats?.app?.version || '1.2.0'}`}
            color="green"
          />
          <StatCard
            icon={Clock}
            title="Uptime"
            value={systemStats?.app?.uptime || 'N/A'}
            subtitle={`Started ${systemStats?.app?.started_at ? new Date(systemStats.app.started_at).toLocaleString() : 'N/A'}`}
            color="blue"
          />
          <StatCard
            icon={Cpu}
            title="CPU Usage"
            value={`${systemStats?.resources?.cpu_percent || 0}%`}
            subtitle={`${systemStats?.resources?.cpu_count || 0} cores`}
            color="orange"
            progress={systemStats?.resources?.cpu_percent}
          />
          <StatCard
            icon={MemoryStick}
            title="Memory"
            value={`${systemStats?.resources?.memory_used_gb || 0} GB`}
            subtitle={`of ${systemStats?.resources?.memory_total_gb || 0} GB`}
            color="purple"
            progress={systemStats?.resources?.memory_percent}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-black/30 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium">System Information</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Platform</span>
                <span className="text-white">{systemStats?.system?.platform} {systemStats?.system?.platform_release}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Architecture</span>
                <span className="text-white">{systemStats?.system?.architecture}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Python</span>
                <span className="text-white">{systemStats?.system?.python_version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Hostname</span>
                <span className="text-white font-mono text-xs">{systemStats?.system?.hostname}</span>
              </div>
            </div>
          </div>

          <div className="bg-black/30 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <HardDrive className="w-4 h-4 text-green-400" />
              <span className="text-sm font-medium">Disk Usage</span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Used</span>
                <span className="text-white">{systemStats?.resources?.disk_used_gb || 0} GB / {systemStats?.resources?.disk_total_gb || 0} GB</span>
              </div>
              <Progress value={systemStats?.resources?.disk_percent || 0} className="h-2" />
              <div className="flex justify-between text-xs text-gray-500">
                <span>{systemStats?.resources?.disk_free_gb || 0} GB free</span>
                <span className={systemStats?.resources?.disk_percent > 80 ? 'text-red-400' : 'text-green-400'}>
                  {systemStats?.resources?.disk_percent || 0}% used
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Database Health */}
      <div className="bg-surface border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Database className="w-5 h-5 text-violet-400" />
            Database Health
          </h3>
          <StatusBadge status={dbStats?.status} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={Database}
            title="Engine"
            value={dbStats?.engine || 'SQLite'}
            subtitle={`Mode: ${dbStats?.mode || 'WAL'}`}
            color="blue"
          />
          <StatCard
            icon={Disc}
            title="Database Size"
            value={`${dbStats?.size_mb || 0} MB`}
            subtitle={dbStats?.path?.split('/').pop()}
            color="violet"
          />
          <StatCard
            icon={Archive}
            title="Backups"
            value={dbStats?.backups || 0}
            subtitle="Rolling backups kept"
            color="green"
          />
          <StatCard
            icon={Activity}
            title="Total Records"
            value={(dbStats?.users_count || 0) + (dbStats?.library_count || 0) + (dbStats?.watchlist_count || 0)}
            subtitle={`${dbStats?.users_count || 0} users, ${dbStats?.library_count || 0} library items`}
            color="orange"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => handleAction('vacuum', '/api/db/vacuum', 'Database optimized successfully')}
            disabled={actionLoading.vacuum}
            className="border-white/20"
          >
            {actionLoading.vacuum ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
            Optimize Database
          </Button>
          <Button
            variant="outline"
            onClick={() => handleAction('backup', '/api/db/backup', 'Backup created successfully')}
            disabled={actionLoading.backup}
            className="border-white/20"
          >
            {actionLoading.backup ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Create Backup
          </Button>
        </div>

        {/* Backup List */}
        {backups.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-400 mb-3">Recent Backups</h4>
            <div className="bg-black/30 border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-3 text-gray-400 font-medium">Filename</th>
                    <th className="text-left p-3 text-gray-400 font-medium">Size</th>
                    <th className="text-left p-3 text-gray-400 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.slice(0, 5).map((backup, index) => (
                    <tr key={backup.filename} className={index % 2 === 0 ? 'bg-white/5' : ''}>
                      <td className="p-3 font-mono text-xs text-white">{backup.filename}</td>
                      <td className="p-3 text-gray-400">{backup.size_mb} MB</td>
                      <td className="p-3 text-gray-400">{new Date(backup.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Cache & Services */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cache Management */}
        <div className="bg-surface border border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Cache Management
          </h3>
          
          <div className="bg-black/30 border border-white/10 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">TMDB Cache Entries</span>
              <span className="text-lg font-bold text-white">{cacheStats?.tmdb_cache_entries || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Cache TTL</span>
              <span className="text-sm text-white">{Math.round((cacheStats?.cache_ttl_seconds || 3600) / 60)} minutes</span>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => handleAction('clearCache', '/api/cache/clear', 'Cache cleared successfully')}
            disabled={actionLoading.clearCache}
            className="border-white/20 w-full"
          >
            {actionLoading.clearCache ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            Clear TMDB Cache
          </Button>
        </div>

        {/* Torrent Engine Status */}
        <div className="bg-surface border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Download className="w-5 h-5 text-green-400" />
              Torrent Engine
            </h3>
            <StatusBadge status={torrentStatus?.status} />
          </div>
          
          <div className="bg-black/30 border border-white/10 rounded-xl p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Engine</span>
                <span className="text-sm text-white font-medium">{torrentStatus?.engine || 'LTorrent'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Status</span>
                <span className="flex items-center gap-2">
                  {torrentStatus?.status === 'running' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  )}
                  <span className={torrentStatus?.status === 'running' ? 'text-green-400' : 'text-yellow-400'}>
                    {torrentStatus?.status === 'running' ? 'Running' : 'Idle'}
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Active Torrents</span>
                <span className="text-sm text-white">{torrentStatus?.active_torrents || 0}</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-4">
            Fondue is WatchNexus's built-in torrent engine using LTorrent. 
            100% Python, no external dependencies required.
          </p>
        </div>
      </div>

      {/* Version Info */}
      <div className="bg-surface border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">WatchNexus v{systemStats?.app?.version || '1.2.0'}</h3>
            <p className="text-sm text-gray-400">Unified Media Pipeline - Your Personal Netflix, Plex & Jellyfin in One</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Built with SQLite (WAL mode)</p>
            <p className="text-xs text-gray-500">Torrent engine: LTorrent (Pure Python)</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default MaintenanceSettings;
