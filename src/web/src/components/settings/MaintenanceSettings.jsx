import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Database, Server, HardDrive, Cpu, Clock, RefreshCw,
  Trash2, Download, Activity, CheckCircle2, AlertTriangle,
  Archive, Zap, MemoryStick, Disc, Info, Shield, FileText,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import axios from 'axios';
import { toast } from 'sonner';
import { SettingsTabHeader, SettingsTabContent } from './SettingsTabHeader';
import { BACKEND_URL } from '../../lib/config';

const API_URL = BACKEND_URL;

const round1 = (n) => Math.round(n * 10) / 10;
const fmtUptime = (sec) => {
  if (typeof sec !== 'number' || !isFinite(sec)) return null;
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// Map the C# endpoint shapes onto what the tabs render.
// /api/system/stats → { memory_mb, threads, uptime_seconds, ... }; /api/system/info → { version, hostname, platform, architecture, dotnet_version, cpu_count }
export const normalizeSystemStats = (stats, info) => {
  if (!stats && !info) return null;
  const s = stats || {}, i = info || {};
  return {
    app: { name: 'WatchNexus', version: i.version, uptime: fmtUptime(s.uptime_seconds ?? i.uptime_seconds) },
    resources: { cpu_count: i.cpu_count, process_memory_mb: typeof s.memory_mb === 'number' ? round1(s.memory_mb) : undefined, threads: s.threads },
    system: { platform: i.platform, architecture: i.architecture, runtime: i.dotnet_version, hostname: i.hostname },
  };
};
// /api/db/stats → { size_bytes, path, tables }
export const normalizeDbStats = (d) => d && ({ ...d, size_mb: typeof d.size_bytes === 'number' ? round1(d.size_bytes / 1048576) : d.size_mb, status: d.status || (d.size_bytes > 0 ? 'healthy' : 'warning') });
// /api/db/backups → [{ name, size, created }]
export const normalizeBackups = (data) => (Array.isArray(data) ? data : (data?.backups || [])).map(b => ({
  filename: b.filename ?? b.name, size_mb: b.size_mb ?? (typeof b.size === 'number' ? round1(b.size / 1048576) : 0), created_at: b.created_at ?? b.created,
}));

// Tabs for Maintenance Settings
const MAINTENANCE_TABS = [
  { id: 'system', label: 'System Status', icon: Server },
  { id: 'database', label: 'Database', icon: Database },
  { id: 'cache', label: 'Cache & Services', icon: Zap },
  { id: 'logs', label: 'Server Logs', icon: FileText },
];

export const MaintenanceSettings = () => {
  const [activeTab, setActiveTab] = useState('system');
  const [systemStats, setSystemStats] = useState(null);
  const [dbStats, setDbStats] = useState(null);
  const [backups, setBackups] = useState([]);
  const [cacheStats, setCacheStats] = useState(null);
  const [torrentStatus, setTorrentStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [logs, setLogs] = useState([]);
  const [logFiles, setLogFiles] = useState([]);
  const [selectedLogFile, setSelectedLogFile] = useState('watchnexus.log');
  const [logLines, setLogLines] = useState(100);

  const fetchAllStats = useCallback(async () => {
    setLoading(true);
    try {
      const [systemRes, infoRes, dbRes, backupsRes, cacheRes, torrentRes, logFilesRes] = await Promise.all([
        axios.get(`${API_URL}/api/system/stats`).catch(() => ({ data: null })),
        axios.get(`${API_URL}/api/system/info`).catch(() => ({ data: null })),
        axios.get(`${API_URL}/api/db/stats`).catch(() => ({ data: null })),
        axios.get(`${API_URL}/api/db/backups`).catch(() => ({ data: { backups: [] } })),
        axios.get(`${API_URL}/api/cache/stats`).catch(() => ({ data: null })),
        axios.get(`${API_URL}/api/torrent/status`).catch(() => ({ data: null })),
        axios.get(`${API_URL}/api/logs/list`).catch(() => ({ data: { logs: [] } })),
      ]);
      setSystemStats(normalizeSystemStats(systemRes.data, infoRes.data));
      setDbStats(normalizeDbStats(dbRes.data));
      setBackups(normalizeBackups(backupsRes.data));
      setCacheStats(cacheRes.data);
      setTorrentStatus(torrentRes.data);
      setLogFiles(logFilesRes.data?.logs || []);
    } catch (error) { console.error('Failed to fetch stats:', error); }
    finally { setLoading(false); }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/logs/view`, { params: { filename: selectedLogFile, lines: logLines } });
      setLogs(res.data?.lines || []);
    } catch (error) { console.error('Failed to fetch logs:', error); }
  }, [selectedLogFile, logLines]);

  useEffect(() => {
    fetchAllStats();
    const interval = setInterval(fetchAllStats, 30000);
    return () => clearInterval(interval);
  }, [fetchAllStats]);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
      const interval = setInterval(fetchLogs, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab, fetchLogs]);

  const handleAction = async (action, endpoint, successMessage) => {
    setActionLoading(prev => ({ ...prev, [action]: true }));
    try {
      await axios.post(`${API_URL}${endpoint}`);
      toast.success(successMessage);
      fetchAllStats();
    } catch (error) { toast.error(error.response?.data?.detail || error.response?.data?.message || `Failed to ${action}`); }
    finally { setActionLoading(prev => ({ ...prev, [action]: false })); }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'system':
        return <SystemTab systemStats={systemStats} loading={loading} fetchAllStats={fetchAllStats} />;
      case 'database':
        return <DatabaseTab dbStats={dbStats} backups={backups} actionLoading={actionLoading} handleAction={handleAction} />;
      case 'cache':
        return <CacheTab cacheStats={cacheStats} torrentStatus={torrentStatus} actionLoading={actionLoading} handleAction={handleAction} />;
      case 'logs':
        return <LogsTab logs={logs} logFiles={logFiles} selectedLogFile={selectedLogFile} setSelectedLogFile={setSelectedLogFile} logLines={logLines} setLogLines={setLogLines} fetchLogs={fetchLogs} actionLoading={actionLoading} handleAction={handleAction} />;
      default:
        return null;
    }
  };

  if (loading && !systemStats) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6" data-testid="maintenance-settings">
      <SettingsTabHeader
        title="System Maintenance"
        subtitle="Monitor system health and perform maintenance tasks"
        icon={Shield}
        tabs={MAINTENANCE_TABS}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        iconBgColor="from-orange-600 to-red-500"
        version={systemStats?.app?.version}
        help={{ title: "System Maintenance", description: "Monitor server health, view resource usage, manage the database, and view application logs. Use this section to troubleshoot issues and keep your server running smoothly.", examples: ["System: CPU, RAM, and disk usage at a glance", "Database: Check SQLite health, size, and run optimizations", "Logs: View application logs to diagnose issues"] }}
      />

      <SettingsTabContent activeTab={activeTab}>
        {renderTabContent()}
      </SettingsTabContent>
    </motion.div>
  );
};

// System Tab
const SystemTab = ({ systemStats, loading, fetchAllStats }) => {
  const StatCard = ({ icon: Icon, title, value, subtitle, color = "violet", progress = null }) => {
    const colorClasses = {
      violet: 'bg-violet-500/20 text-violet-400',
      blue: 'bg-blue-500/20 text-blue-400',
      green: 'bg-green-500/20 text-green-400',
      orange: 'bg-orange-500/20 text-orange-400',
      purple: 'bg-purple-500/20 text-purple-400',
      red: 'bg-red-500/20 text-red-400',
      yellow: 'bg-yellow-500/20 text-yellow-400',
    };
    const cls = colorClasses[color] || colorClasses.violet;
    return (
    <div className="bg-black/30 border border-white/10 rounded-xl p-4">
      <div className="flex items-start justify-between mb-2">
        <div className={`w-10 h-10 rounded-lg ${cls}`}>
          <Icon className={`w-5 h-5 ${cls.split(' ')[1]}`} />
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
      {progress !== null && <Progress value={progress} className="mt-2 h-1.5" />}
    </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Server className="w-5 h-5 text-green-400" />
            Server Status
          </h3>
          <Button variant="outline" onClick={fetchAllStats} disabled={loading} className="border-white/20">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Activity} title="Status" value={systemStats?.app?.name || 'WatchNexus'} subtitle={systemStats?.app?.version ? `v${systemStats.app.version}` : undefined} color="green" />
          <StatCard icon={Clock} title="Uptime" value={systemStats?.app?.uptime || 'N/A'} subtitle={undefined} color="blue" />
          <StatCard icon={Cpu} title="CPU Cores" value={systemStats?.resources?.cpu_count ?? 'N/A'} color="orange" />
          <StatCard icon={MemoryStick} title="Process Memory" value={systemStats?.resources?.process_memory_mb != null ? `${systemStats.resources.process_memory_mb} MB` : 'N/A'} subtitle={systemStats?.resources?.threads != null ? `${systemStats.resources.threads} threads` : undefined} color="purple" />
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-black/30 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium">System Information</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Platform</span><span className="text-white">{systemStats?.system?.platform} {systemStats?.system?.platform_release}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Architecture</span><span className="text-white">{systemStats?.system?.architecture}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">.NET Runtime</span><span className="text-white">{systemStats?.system?.runtime}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Hostname</span><span className="text-white font-mono text-xs">{systemStats?.system?.hostname}</span></div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

// Database Tab
const DatabaseTab = ({ dbStats, backups, actionLoading, handleAction }) => {
  const StatusBadge = ({ status }) => {
    const colors = { healthy: 'bg-green-500/20 text-green-400 border-green-500/30', running: 'bg-green-500/20 text-green-400 border-green-500/30', warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', error: 'bg-red-500/20 text-red-400 border-red-500/30' };
    if (!status) return null;
    return <span className={`px-2 py-1 text-xs font-medium rounded-full border ${colors[status] || colors.error}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2"><Database className="w-5 h-5 text-violet-400" />Database Health</h3>
          <StatusBadge status={dbStats?.status} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-black/30 border border-white/10 rounded-xl p-4"><p className="text-gray-400 text-sm">Engine</p><p className="text-xl font-bold">{dbStats?.engine || 'SQLite'}</p><p className="text-xs text-gray-500">Mode: {dbStats?.mode || 'WAL'}</p></div>
          <div className="bg-black/30 border border-white/10 rounded-xl p-4"><p className="text-gray-400 text-sm">Size</p><p className="text-xl font-bold">{dbStats?.size_mb || 0} MB</p></div>
          <div className="bg-black/30 border border-white/10 rounded-xl p-4"><p className="text-gray-400 text-sm">Backups</p><p className="text-xl font-bold">{backups.length}</p></div>
          <div className="bg-black/30 border border-white/10 rounded-xl p-4"><p className="text-gray-400 text-sm">Tables</p><p className="text-xl font-bold">{dbStats?.tables ?? 'N/A'}</p></div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => handleAction('backup', '/api/db/backup', 'Backup created')} disabled={actionLoading.backup} className="border-white/20">{actionLoading.backup ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}Backup</Button>
        </div>

        {backups.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-400 mb-3">Recent Backups</h4>
            <div className="bg-black/30 border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-white/10"><th className="text-left p-3 text-gray-400">Filename</th><th className="text-left p-3 text-gray-400">Size</th><th className="text-left p-3 text-gray-400">Created</th></tr></thead>
                <tbody>{backups.slice(0, 5).map((backup, i) => (<tr key={backup.filename || i} className={i % 2 === 0 ? 'bg-white/5' : ''}><td className="p-3 font-mono text-xs">{backup.filename}</td><td className="p-3 text-gray-400">{backup.size_mb} MB</td><td className="p-3 text-gray-400">{backup.created_at ? new Date(backup.created_at).toLocaleString() : ''}</td></tr>))}</tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Cache Tab
const CacheTab = ({ cacheStats, torrentStatus, actionLoading, handleAction }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-surface border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Zap className="w-5 h-5 text-yellow-400" />Cache Management</h3>
        <div className="bg-black/30 border border-white/10 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2"><span className="text-sm text-gray-400">Cache Files</span><span className="text-lg font-bold text-white">{cacheStats?.entries ?? cacheStats?.tmdb_cache_entries ?? 0}</span></div>
          <div className="flex items-center justify-between"><span className="text-sm text-gray-400">Cache Size</span><span className="text-sm text-white">{round1((cacheStats?.size_bytes || 0) / 1048576)} MB</span></div>
        </div>
        <Button variant="outline" onClick={() => handleAction('clearCache', '/api/cache/clear', 'Cache cleared')} disabled={actionLoading.clearCache} className="border-white/20 w-full">{actionLoading.clearCache ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}Clear Cache</Button>
      </div>

      <div className="bg-surface border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2"><Download className="w-5 h-5 text-green-400" />Torrent Engine</h3>
          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${(torrentStatus?.status === 'running' || torrentStatus?.connected === true) ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>{torrentStatus?.status || (torrentStatus?.connected ? 'running' : 'Unknown')}</span>
        </div>
        <div className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between"><span className="text-sm text-gray-400">Engine</span><span className="text-sm text-white font-medium">{torrentStatus?.engine || 'Unknown'}</span></div>
          <div className="flex items-center justify-between"><span className="text-sm text-gray-400">Status</span><span className="flex items-center gap-2">{(torrentStatus?.status === 'running' || torrentStatus?.connected === true) ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <AlertTriangle className="w-4 h-4 text-yellow-400" />}<span className={(torrentStatus?.status === 'running' || torrentStatus?.connected === true) ? 'text-green-400' : 'text-yellow-400'}>{(torrentStatus?.status === 'running' || torrentStatus?.connected === true) ? 'Running' : 'Idle'}</span></span></div>
          <div className="flex items-center justify-between"><span className="text-sm text-gray-400">Active Downloads</span><span className="text-sm text-white">{torrentStatus?.active_downloads ?? torrentStatus?.active_torrents ?? 0}</span></div>
        </div>
      </div>
    </div>
  </div>
);

// Logs Tab
const LogsTab = ({ logs, logFiles, selectedLogFile, setSelectedLogFile, logLines, setLogLines, fetchLogs, actionLoading, handleAction }) => (
  <div className="space-y-6">
    <div className="bg-surface border border-white/10 rounded-2xl p-6">
      <h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><FileText className="w-5 h-5 text-blue-400" />Server Logs</h3>
      
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select value={selectedLogFile} onChange={(e) => setSelectedLogFile(e.target.value)} className="bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-sm text-white">
          {logFiles.map(file => (<option key={file.filename} value={file.filename}>{file.filename} ({file.size_kb} KB)</option>))}
        </select>
        <select value={logLines} onChange={(e) => setLogLines(Number(e.target.value))} className="bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-sm text-white">
          <option value={50}>Last 50 lines</option><option value={100}>Last 100 lines</option><option value={200}>Last 200 lines</option><option value={500}>Last 500 lines</option>
        </select>
        <Button variant="outline" size="sm" onClick={fetchLogs} className="border-white/20"><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
        <a href={`${API_URL}/api/logs/download/${selectedLogFile}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-black/30 border border-white/20 rounded-lg hover:bg-white/10"><Download className="w-4 h-4" />Download</a>
        <Button variant="outline" size="sm" onClick={() => handleAction('clearLogs', '/api/logs/clear', 'Old logs cleared')} disabled={actionLoading.clearLogs} className="border-white/20 text-red-400">{actionLoading.clearLogs ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}Clear Old</Button>
      </div>

      <div className="bg-black/50 border border-white/10 rounded-xl p-4 font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto">
        {logs.length > 0 ? (
          <div className="space-y-0.5">{logs.map((line, index) => (<div key={index} className={`whitespace-pre-wrap break-all ${line.includes('ERROR') ? 'text-red-400' : line.includes('WARNING') ? 'text-yellow-400' : line.includes('INFO') ? 'text-gray-300' : 'text-gray-500'}`}>{line}</div>))}</div>
        ) : (<p className="text-gray-500 text-center py-8">No logs available</p>)}
      </div>
      <p className="text-xs text-gray-500 mt-3">Logs auto-refresh every 5 seconds. Log files rotate at 10MB.</p>
    </div>
  </div>
);

export default MaintenanceSettings;
