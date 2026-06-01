import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { logsApi } from '../services/nexusApi';
import { toast } from 'sonner';
import {
  FileText, RefreshCw, Cpu, HardDrive, Activity, Clock,
  AlertCircle, AlertTriangle, Info, Bug, Search, Filter, Trash2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';

const LEVELS = ['ALL', 'DEBUG', 'INFO', 'WARNING', 'ERROR', 'FATAL'];
const LEVEL_STYLES = {
  DEBUG: 'text-gray-400',
  INFO: 'text-blue-400',
  WARNING: 'text-amber-400',
  ERROR: 'text-red-400',
  FATAL: 'text-red-600 font-bold',
};
const LEVEL_ICONS = {
  DEBUG: Bug,
  INFO: Info,
  WARNING: AlertTriangle,
  ERROR: AlertCircle,
  FATAL: AlertCircle,
};

export default function LogViewerPage() {
  const [logs, setLogs] = useState([]);
  const [totalLines, setTotalLines] = useState(0);
  const [logFile, setLogFile] = useState('');
  const [logFiles, setLogFiles] = useState([]);
  const [systemInfo, setSystemInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const logEndRef = useRef(null);
  const intervalRef = useRef(null);

  const loadLogs = useCallback(async () => {
    try {
      const levelParam = level === 'ALL' ? undefined : level;
      const res = await logsApi.getLatest(200, levelParam);
      setLogs(res.data.lines || []);
      setTotalLines(res.data.total || 0);
      setLogFile(res.data.file || '');
    } catch { console.error('[LogViewerPage] Failed to load logs'); }
    finally { setLoading(false); }
  }, [level]);

  const loadFiles = useCallback(async () => {
    try {
      const res = await logsApi.getFiles();
      setLogFiles(res.data || []);
    } catch { console.error('[LogViewerPage] Failed to load files'); }
  }, []);

  const loadSystem = useCallback(async () => {
    try {
      const res = await logsApi.getSystem();
      setSystemInfo(res.data);
    } catch { console.error('[LogViewerPage] Failed to load system info'); }
  }, []);

  useEffect(() => {
    loadLogs();
    loadFiles();
    loadSystem();
  }, [loadLogs, loadFiles, loadSystem]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(loadLogs, 3000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh, loadLogs]);

  const filteredLogs = searchTerm
    ? logs.filter(l => l.text?.toLowerCase().includes(searchTerm.toLowerCase()))
    : logs;

  const handleDeleteFile = async (filename) => {
    try {
      await logsApi.deleteFile(filename);
      toast.success('Log file deleted');
      loadFiles();
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <Layout>
      <div data-testid="log-viewer" className="p-8 max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-lime-500/15 flex items-center justify-center">
                <FileText className="w-5 h-5 text-lime-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Log Viewer — Zest</h1>
                <p className="text-sm text-gray-500">
                  {logFile ? `${logFile} (${totalLines} lines)` : 'No log files yet'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setAutoRefresh(!autoRefresh)}
                data-testid="auto-refresh-toggle"
                className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  autoRefresh ? "bg-lime-500/15 text-lime-400 border border-lime-500/20" : "bg-white/5 text-gray-400"
                )}>
                {autoRefresh ? 'Live' : 'Paused'}
              </button>
              <Button size="sm" variant="ghost" onClick={loadLogs}>
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              </Button>
            </div>
          </div>
        </motion.div>

        {/* System Diagnostics */}
        {systemInfo && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs text-gray-500">Uptime</span>
              </div>
              <p className="text-sm font-medium">
                {systemInfo.uptime_seconds ? `${Math.floor(systemInfo.uptime_seconds / 3600)}h ${Math.floor((systemInfo.uptime_seconds % 3600) / 60)}m` : '--'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-1">
                <HardDrive className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-xs text-gray-500">Memory</span>
              </div>
              <p className="text-sm font-medium">{systemInfo.memory_mb ? `${systemInfo.memory_mb.toFixed(0)} MB` : '--'}</p>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-1">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs text-gray-500">CPU Time</span>
              </div>
              <p className="text-sm font-medium">{systemInfo.cpu_time_seconds ? `${systemInfo.cpu_time_seconds.toFixed(1)}s` : '--'}</p>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs text-gray-500">Threads</span>
              </div>
              <p className="text-sm font-medium">{systemInfo.threads || '--'}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input placeholder="Search logs..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              data-testid="log-search" className="pl-9 bg-white/5 border-white/10 h-9 text-sm" />
          </div>
          <div className="flex gap-1">
            {LEVELS.map(l => (
              <button key={l} onClick={() => setLevel(l)}
                className={cn("px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                  level === l
                    ? "bg-lime-500/15 text-lime-400 border border-lime-500/20"
                    : "bg-white/5 text-gray-500 hover:text-gray-300"
                )}>{l}</button>
            ))}
          </div>
        </div>

        {/* Log Output */}
        <div className="rounded-xl border border-white/[0.06] bg-black/40 overflow-hidden">
          <div className="max-h-[500px] overflow-y-auto p-1 font-mono text-xs" data-testid="log-output">
            {filteredLogs.length > 0 ? filteredLogs.map((log, i) => {
              const LvlIcon = LEVEL_ICONS[log.level] || Info;
              return (
                <div key={i}
                  className={cn("flex items-start gap-2 px-3 py-1 hover:bg-white/[0.02] rounded",
                    log.level === 'ERROR' && "bg-red-500/5",
                    log.level === 'FATAL' && "bg-red-500/10"
                  )}>
                  <span className="text-gray-600 w-8 text-right shrink-0">{log.line_number}</span>
                  <LvlIcon className={cn("w-3 h-3 mt-0.5 shrink-0", LEVEL_STYLES[log.level])} />
                  <span className={cn("break-all", LEVEL_STYLES[log.level] || "text-gray-300")}>
                    {log.text}
                  </span>
                </div>
              );
            }) : (
              <div className="text-center py-12 text-gray-500">
                {loading ? 'Loading...' : 'No log entries found'}
              </div>
            )}
            <div ref={logEndRef} />
          </div>
        </div>

        {/* Log Files */}
        {logFiles.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold mb-3">Log Files</h3>
            <div className="space-y-1">
              {logFiles.map(f => (
                <div key={f.name}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">{f.name}</span>
                    <span className="text-xs text-gray-500">{(f.size / 1024).toFixed(1)} KB</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteFile(f.name)}>
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
