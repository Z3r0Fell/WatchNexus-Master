import { BACKEND_URL } from '../../lib/config';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, RefreshCw, Download, Trash2, Search, Filter, 
  AlertCircle, AlertTriangle, Info, Bug, Cpu, HardDrive, 
  MemoryStick, Activity, ChevronDown, ChevronUp, X
} from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import { useConfirm } from '../../hooks/use-confirm';

const LOG_LEVELS = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'];

const LevelIcon = ({ level }) => {
  switch (level?.toUpperCase()) {
    case 'ERROR':
    case 'CRITICAL':
      return <AlertCircle className="w-4 h-4 text-red-400" />;
    case 'WARNING':
      return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
    case 'DEBUG':
      return <Bug className="w-4 h-4 text-gray-400" />;
    default:
      return <Info className="w-4 h-4 text-blue-400" />;
  }
};

const LevelBadge = ({ level }) => {
  const colors = {
    DEBUG: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    INFO: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    WARNING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    ERROR: 'bg-red-500/20 text-red-400 border-red-500/30',
    CRITICAL: 'bg-red-600/30 text-red-300 border-red-500/40',
  };
  
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded border ${colors[level?.toUpperCase()] || colors.INFO}`}>
      {level}
    </span>
  );
};

const SystemMetricCard = ({ icon: Icon, label, value, subValue, color = 'violet' }) => {
  const colorClasses = {
    violet: 'bg-violet-500/20 text-violet-400',
    blue: 'bg-blue-500/20 text-blue-400',
    pink: 'bg-pink-500/20 text-pink-400',
    green: 'bg-green-500/20 text-green-400',
    yellow: 'bg-yellow-500/20 text-yellow-400',
    red: 'bg-red-500/20 text-red-400',
  };
  const cls = colorClasses[color] || colorClasses.violet;
  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10" data-testid={`system-metric-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${cls}`}>
          <Icon className={`w-5 h-5 ${cls.split(' ')[1]}`} />
        </div>
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className="text-lg font-semibold">{value}</p>
          {subValue && <p className="text-xs text-gray-500">{subValue}</p>}
        </div>
      </div>
    </div>
  );
};

export const ZestSettings = () => {
  const { confirm, ConfirmDialog } = useConfirm();
  const [logs, setLogs] = useState([]);
  const [logStats, setLogStats] = useState(null);
  const [systemHealth, setSystemHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [filters, setFilters] = useState({
    level: '',
    search: '',
    lines: 100
  });
  const [showFilters, setShowFilters] = useState(false);
  const [expandedLog, setExpandedLog] = useState(null);
  const intervalRef = useRef(null);

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.append('lines', filters.lines);
      if (filters.level) params.append('level', filters.level);
      if (filters.search) params.append('search', filters.search);
      
      const res = await axios.get(`${BACKEND_URL}/api/zest/logs?${params}`);
      setLogs(res.data.logs || []);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
      toast.error('Failed to fetch logs');
    }
  }, [filters]);

  const fetchLogStats = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/zest/stats`);
      setLogStats(res.data);
    } catch (err) {
      console.error('Failed to fetch log stats:', err);
    }
  };

  const fetchSystemHealth = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/zest/health`);
      setSystemHealth(res.data);
    } catch (err) {
      console.error('Failed to fetch system health:', err);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    await Promise.all([fetchLogs(), fetchLogStats(), fetchSystemHealth()]);
    setLoading(false);
  };

  const handleClearLogs = async () => {
    const ok = await confirm({ title: 'Clear Logs', description: 'Clear log file? A backup will be created.', confirmText: 'Clear' });
    if (!ok) return;
    try {
      const res = await axios.post(`${BACKEND_URL}/api/zest/logs/clear`);
      toast.success(res.data.message || 'Logs cleared');
      handleRefresh();
    } catch (err) {
      toast.error('Failed to clear logs');
    }
  };

  const handleDownloadLogs = () => {
    window.open(`${BACKEND_URL}/api/logs/download/watchnexus.log`, '_blank');
  };

  useEffect(() => {
    handleRefresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(handleRefresh, 5000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh]);

  useEffect(() => {
    fetchLogs();
  }, [filters, fetchLogs]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
      data-testid="zest-settings"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-yellow-400" />
            Log Viewer
            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">Zest</span>
          </h2>
          <p className="text-gray-400 text-sm mt-1">View application logs and system health</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'border-green-500 text-green-400' : 'border-white/10'}
            data-testid="auto-refresh-toggle"
          >
            <Activity className={`w-4 h-4 mr-1 ${autoRefresh ? 'animate-pulse' : ''}`} />
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading} className="border-white/10" data-testid="refresh-logs-btn">
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Health Cards */}
      {systemHealth && !systemHealth.error && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SystemMetricCard
            icon={Cpu}
            label="CPU Usage"
            value={`${systemHealth.cpu?.percent?.toFixed(1)}%`}
            subValue={`${systemHealth.cpu?.count} cores`}
            color="blue"
          />
          <SystemMetricCard
            icon={MemoryStick}
            label="Memory"
            value={`${systemHealth.memory?.percent?.toFixed(1)}%`}
            subValue={`${systemHealth.memory?.used_formatted} / ${systemHealth.memory?.total_formatted}`}
            color="violet"
          />
          <SystemMetricCard
            icon={HardDrive}
            label="Disk"
            value={`${systemHealth.disk?.percent?.toFixed(1)}%`}
            subValue={`${systemHealth.disk?.free_formatted} free`}
            color="pink"
          />
          <SystemMetricCard
            icon={Activity}
            label="Process Memory"
            value={systemHealth.process?.memory_rss_formatted}
            subValue={`PID: ${systemHealth.process?.pid}`}
            color="green"
          />
        </div>
      )}

      {/* Log Stats */}
      {logStats && (
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-400">
                {logStats.total_lines?.toLocaleString()} lines • {logStats.file_size_formatted}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {Object.entries(logStats.level_counts || {}).map(([level, count]) => (
                count > 0 && (
                  <span key={level} className="flex items-center gap-1 text-xs">
                    <LevelIcon level={level} />
                    <span className="text-gray-400">{count}</span>
                  </span>
                )
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search logs..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-violet-500"
              data-testid="log-search-input"
            />
            {filters.search && (
              <button
                onClick={() => setFilters(prev => ({ ...prev, search: '' }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Level Filter */}
          <select
            value={filters.level}
            onChange={(e) => setFilters(prev => ({ ...prev, level: e.target.value }))}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-violet-500"
          >
            <option value="">All Levels</option>
            {LOG_LEVELS.map(level => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>

          {/* Lines */}
          <select
            value={filters.lines}
            onChange={(e) => setFilters(prev => ({ ...prev, lines: parseInt(e.target.value) }))}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-violet-500"
          >
            <option value={50}>50 lines</option>
            <option value={100}>100 lines</option>
            <option value={250}>250 lines</option>
            <option value={500}>500 lines</option>
          </select>

          {/* Actions */}
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={handleDownloadLogs} className="border-white/10">
              <Download className="w-4 h-4 mr-1" /> Download
            </Button>
            <Button variant="outline" size="sm" onClick={handleClearLogs} className="border-red-500/30 text-red-400 hover:bg-red-500/10">
              <Trash2 className="w-4 h-4 mr-1" /> Clear
            </Button>
          </div>
        </div>
      </div>

      {/* Log Entries */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="max-h-[500px] overflow-y-auto">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No log entries found</p>
              {filters.search || filters.level ? (
                <p className="text-sm mt-1">Try adjusting your filters</p>
              ) : null}
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {logs.map((log, idx) => (
                <div
                  key={idx}
                  className="px-4 py-2 hover:bg-white/5 cursor-pointer transition-colors"
                  onClick={() => setExpandedLog(expandedLog === idx ? null : idx)}
                >
                  <div className="flex items-start gap-3">
                    <LevelIcon level={log.level} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <LevelBadge level={log.level} />
                        <span className="text-xs text-gray-500">{log.timestamp}</span>
                        <span className="text-xs text-gray-600">{log.logger}</span>
                      </div>
                      <p className={`text-sm ${expandedLog === idx ? '' : 'truncate'}`}>
                        {log.message}
                      </p>
                      <AnimatePresence>
                        {expandedLog === idx && (
                          <motion.pre
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mt-2 p-2 bg-black/30 rounded text-xs text-gray-400 overflow-x-auto"
                          >
                            {log.raw}
                          </motion.pre>
                        )}
                      </AnimatePresence>
                    </div>
                    {expandedLog === idx ? (
                      <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tips */}
      <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
        <p className="text-sm text-yellow-400">
          <strong>Tips:</strong> Use the search to find specific errors. Filter by ERROR or WARNING to troubleshoot issues.
          Logs are rotated automatically at 10MB with 7 backups kept.
        </p>
      </div>
        <ConfirmDialog />
    </motion.div>
  );
};
