import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { HardDrive, RefreshCw, FileSearch, Wrench, Clock, Calendar, Plus, Trash2, DownloadCloud, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { mediaHealthApi } from '../../services/api';

export const MediaHealthSettings = () => {
  const [healthScanPath, setHealthScanPath] = useState('');
  const [healthResults, setHealthResults] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [repairing, setRepairing] = useState(null);
  const [redownloading, setRedownloading] = useState(null);
  const [scheduledScans, setScheduledScans] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [newScanForm, setNewScanForm] = useState({
    directory: '', schedule_type: 'daily', schedule_time: '03:00', notify_on_issues: true, auto_repair: false,
  });

  const fetchScheduledScans = useCallback(async () => {
    try { const res = await mediaHealthApi.getScheduledScans(); setScheduledScans(res.data || []); } catch {}
  }, []);

  const fetchNotifications = useCallback(async () => {
    try { const res = await mediaHealthApi.getNotifications(true); setNotifications(res.data || []); } catch {}
  }, []);

  useEffect(() => { fetchScheduledScans(); fetchNotifications(); }, [fetchScheduledScans, fetchNotifications]);

  const handleHealthScan = async () => {
    if (!healthScanPath.trim()) { toast.error('Please enter a directory path to scan'); return; }
    setScanning(true); setHealthResults([]);
    try {
      const res = await mediaHealthApi.scanLibrary(healthScanPath);
      setHealthResults(res.data || []);
      const issues = (res.data || []).filter(r => r.status !== 'healthy');
      issues.length > 0 ? toast.warning(`Found ${issues.length} file(s) with issues`) : toast.success('All files are healthy!');
    } catch { toast.error('Failed to scan library'); }
    finally { setScanning(false); }
  };

  const handleRepairFile = async (filePath) => {
    setRepairing(filePath);
    try {
      const res = await mediaHealthApi.repairFile(filePath);
      res.data.success ? toast.success(res.data.message) : toast.error(res.data.message);
      if (res.data.success) await handleHealthScan();
    } catch { toast.error('Failed to repair file'); }
    finally { setRepairing(null); }
  };

  const handleRedownload = async (filePath) => {
    setRedownloading(filePath);
    try {
      const filename = filePath.split('/').pop();
      const title = filename.replace(/\.[^/.]+$/, '').replace(/[._-]/g, ' ');
      const res = await mediaHealthApi.requestRedownload(filePath, title, 'movie');
      toast.success(res.data.message);
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to queue re-download'); }
    finally { setRedownloading(null); }
  };

  const handleCreateScheduledScan = async () => {
    if (!newScanForm.directory.trim()) { toast.error('Please enter a directory to scan'); return; }
    try {
      await mediaHealthApi.createScheduledScan(newScanForm);
      toast.success('Scheduled scan created');
      setNewScanForm({ directory: '', schedule_type: 'daily', schedule_time: '03:00', notify_on_issues: true, auto_repair: false });
      fetchScheduledScans();
    } catch { toast.error('Failed to create scheduled scan'); }
  };

  const handleDeleteScheduledScan = async (scanId) => {
    try { await mediaHealthApi.deleteScheduledScan(scanId); toast.success('Scheduled scan deleted'); fetchScheduledScans(); }
    catch { toast.error('Failed to delete scheduled scan'); }
  };

  const handleRunScanNow = async (scanId) => {
    setScanning(true);
    try {
      const res = await mediaHealthApi.runScheduledScanNow(scanId);
      toast.success(`Scan complete: ${res.data.total_files} files`);
      fetchScheduledScans(); fetchNotifications();
    } catch { toast.error('Failed to run scan'); }
    finally { setScanning(false); }
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-xl p-6 space-y-6" data-testid="media-health-settings">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-violet-400" />
            Media Health Checker
          </h2>
          <p className="text-sm text-gray-400 mt-1">Scan for corrupted or incomplete files</p>
        </div>
      </div>

      <div className="flex gap-3">
        <Input value={healthScanPath} onChange={(e) => setHealthScanPath(e.target.value)}
          placeholder="/media/library or /path/to/movies" className="bg-white/5 border-white/10 flex-1" />
        <Button onClick={handleHealthScan} disabled={scanning} className="bg-violet-600 hover:bg-violet-700">
          {scanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4" />}
          <span className="ml-2">{scanning ? 'Scanning...' : 'Scan'}</span>
        </Button>
      </div>

      {healthResults.length > 0 && (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          <div className="flex gap-2 text-sm mb-3">
            <span className="px-2 py-1 rounded bg-green-500/20 text-green-400">{healthResults.filter(r => r.status === 'healthy').length} Healthy</span>
            <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">{healthResults.filter(r => r.status === 'warning').length} Warnings</span>
            <span className="px-2 py-1 rounded bg-red-500/20 text-red-400">{healthResults.filter(r => ['error', 'corrupt'].includes(r.status)).length} Errors</span>
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

      <div className="border-t border-white/10 pt-6 space-y-4">
        <h3 className="font-bold flex items-center gap-2">
          <Clock className="w-5 h-5 text-violet-400" />
          Scheduled Scans
          {notifications.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs ml-2">{notifications.length} alerts</span>
          )}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input value={newScanForm.directory} onChange={(e) => setNewScanForm(p => ({ ...p, directory: e.target.value }))}
            placeholder="/media/movies" className="bg-white/5 border-white/10" />
          <select value={newScanForm.schedule_type} onChange={(e) => setNewScanForm(p => ({ ...p, schedule_type: e.target.value }))}
            className="bg-white/5 border border-white/10 rounded-md px-3 text-white">
            <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
          </select>
          <Input type="time" value={newScanForm.schedule_time}
            onChange={(e) => setNewScanForm(p => ({ ...p, schedule_time: e.target.value }))} className="bg-white/5 border-white/10" />
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
  );
};
