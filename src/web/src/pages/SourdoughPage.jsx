import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Archive, Download, Upload, Clock, Calendar, Save,
  RefreshCw, Trash2, FileArchive, Settings, HardDrive, ShieldCheck
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/switch';
import { cn } from '../lib/utils';
import { formatFileSize } from '../lib/utils';
import { BACKEND_URL } from '../lib/config';

const API = BACKEND_URL;
const headers = { 'Content-Type': 'application/json' };

const TabButton = ({ active, onClick, icon: Icon, label }) => (
  <button
    onClick={onClick}
    data-testid={`sourdough-tab-${label.toLowerCase()}`}
    className={cn(
      "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
      active
        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
        : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
    )}
  >
    <Icon className="w-4 h-4" />
    {label}
  </button>
);

export const SourdoughPage = () => {
  const [backups, setBackups] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('backups');
  const [creating, setCreating] = useState(false);

  const fetchData = async () => {
    try {
      const [backupsRes, scheduleRes] = await Promise.all([
        axios.get(`${API}/api/sourdough/backups`, { headers }),
        axios.get(`${API}/api/sourdough/schedule`, { headers }),
      ]);
      setBackups(backupsRes.data || []);
      setSchedule(scheduleRes.data);
    } catch (e) {
      console.error('Sourdough fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const createBackup = async () => {
    setCreating(true);
    try {
      const res = await axios.post(`${API}/api/sourdough/backup`, {}, {
        
      });
      toast.success(`Backup initiated: ${res.data?.backup_name || 'creating...'}`);
      setTimeout(fetchData, 2000);
    } catch (e) {
      toast.error('Backup failed');
    } finally {
      setCreating(false);
    }
  };

  const exportConfig = async () => {
    try {
      const res = await axios.get(`${API}/api/sourdough/config/export`, {
        
      });
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `watchnexus-config-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Config exported');
    } catch (e) {
      toast.error('Export failed');
    }
  };

  const saveSchedule = async () => {
    try {
      await axios.put(`${API}/api/sourdough/schedule`, schedule, {
        headers: { 'Content-Type': 'application/json' }
      });
      toast.success('Schedule saved');
    } catch (e) {
      toast.error('Failed to save schedule');
    }
  };

  if (loading) return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </Layout>
  );

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl mx-auto p-6 space-y-6"
        data-testid="sourdough-page"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Backup & Restore</h1>
            <p className="text-sm text-gray-400 mt-1">Protect your configuration and media database</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={exportConfig} variant="outline" className="border-white/10" data-testid="sourdough-export-btn">
              <Download className="w-4 h-4 mr-2" /> Export Config
            </Button>
            <Button onClick={createBackup} disabled={creating} className="bg-emerald-600 hover:bg-emerald-700" data-testid="sourdough-backup-btn">
              {creating ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Archive className="w-4 h-4 mr-2" />}
              {creating ? 'Creating...' : 'Create Backup'}
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <TabButton active={tab === 'backups'} onClick={() => setTab('backups')} icon={Archive} label="Backups" />
          <TabButton active={tab === 'schedule'} onClick={() => setTab('schedule')} icon={Calendar} label="Schedule" />
        </div>

        {tab === 'backups' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {backups.length === 0 ? (
              <div className="p-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center">
                <FileArchive className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                <p className="text-lg text-gray-400">No backups yet</p>
                <p className="text-sm text-gray-600 mt-1">Create your first backup to protect your data</p>
                <Button onClick={createBackup} className="mt-4 bg-emerald-600 hover:bg-emerald-700">
                  <Archive className="w-4 h-4 mr-2" /> Create First Backup
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {backups.map((backup, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                      <FileArchive className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{backup.name}</p>
                      <p className="text-xs text-gray-500">
                        {backup.created ? new Date(backup.created).toLocaleString() : 'Unknown date'}
                        {backup.size ? ` - ${formatFileSize(backup.size)}` : ''}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="border-white/10 text-gray-400">
                      <Upload className="w-3.5 h-3.5 mr-1.5" /> Restore
                    </Button>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {tab === 'schedule' && schedule && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Automatic Backups</h3>
                <Switch
                  checked={schedule.enabled ?? false}
                  onCheckedChange={(v) => setSchedule({ ...schedule, enabled: v })}
                  data-testid="schedule-enabled"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Frequency</label>
                  <select
                    value={schedule.frequency || 'daily'}
                    onChange={(e) => setSchedule({ ...schedule, frequency: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
                    data-testid="schedule-frequency"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Time</label>
                  <Input
                    type="time"
                    value={schedule.time || '03:00'}
                    onChange={(e) => setSchedule({ ...schedule, time: e.target.value })}
                    className="bg-white/5 border-white/10"
                    data-testid="schedule-time"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Keep Last</label>
                  <Input
                    type="number"
                    value={schedule.keep_count || 7}
                    onChange={(e) => setSchedule({ ...schedule, keep_count: parseInt(e.target.value) || 7 })}
                    className="bg-white/5 border-white/10"
                    data-testid="schedule-keep-count"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={schedule.include_media ?? false}
                  onCheckedChange={(v) => setSchedule({ ...schedule, include_media: v })}
                />
                <span className="text-sm text-gray-300">Include media files in backup</span>
              </div>

              <Button onClick={saveSchedule} className="bg-emerald-600 hover:bg-emerald-700" data-testid="schedule-save-btn">
                <Save className="w-4 h-4 mr-2" /> Save Schedule
              </Button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </Layout>
  );
};

export default SourdoughPage;
