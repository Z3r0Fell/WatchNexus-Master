import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw, Download, CheckCircle2, AlertTriangle, Clock,
  Shield, Zap, Crown, Loader2, ArrowUpCircle, History,
  Settings, Bell, GitBranch, Server, ChevronRight, XCircle
} from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import { BACKEND_URL } from '../../lib/config';

const API = BACKEND_URL;

const TIER_ICON = { standard: Shield, pro: Zap, ultra: Crown };
const TIER_COLOR = { standard: '#6B7280', pro: '#3B82F6', ultra: '#8B5CF6' };

export const UpdateSettings = () => {
  const [currentInfo, setCurrentInfo] = useState(null);
  const [updateResult, setUpdateResult] = useState(null);
  const [updateSettings, setUpdateSettings] = useState(null);
  const [updateHistory, setUpdateHistory] = useState([]);
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const fetchCurrent = useCallback(async () => {
    try { const res = await axios.get(`${API}/api/system/updates/current`); setCurrentInfo(res.data); } catch { console.error('[UpdateSettings] Failed to fetch current updates'); toast.error('[UpdateSettings] Failed to fetch current updates');; }
  }, []);

  const fetchSettings = useCallback(async () => {
    try { const res = await axios.get(`${API}/api/system/updates/settings`); setUpdateSettings(res.data); } catch { console.error('[UpdateSettings] Failed to fetch update settings'); toast.error('[UpdateSettings] Failed to fetch update settings');; }
  }, []);

  const fetchHistory = useCallback(async () => {
    try { const res = await axios.get(`${API}/api/system/updates/history`); setUpdateHistory(res.data.history || []); } catch { console.error('[UpdateSettings] Failed to fetch update history'); toast.error('[UpdateSettings] Failed to fetch update history');; }
  }, []);

  useEffect(() => {
    Promise.all([fetchCurrent(), fetchSettings(), fetchHistory()]).finally(() => setLoading(false));
  }, [fetchCurrent, fetchSettings, fetchHistory]);

  const handleCheckUpdates = async () => {
    setChecking(true);
    setUpdateResult(null);
    try {
      const res = await axios.get(`${API}/api/system/updates/check`);
      setUpdateResult(res.data);
      fetchCurrent();
      if (res.data.main_update?.available) {
        toast.success(`Update available: v${res.data.main_update.latest_version}`);
      } else if (res.data.hotfix_patch?.available) {
        toast.info('Hotfix patch available');
      } else {
        toast.success('You\'re up to date!');
      }
    } catch (err) {
      toast.error('Failed to check for updates');
    } finally {
      setChecking(false);
    }
  };

  const handleApplyPatch = async (patch) => {
    try {
      const res = await axios.post(`${API}/api/system/updates/apply-patch`, { patch_id: patch.patch_id, description: patch.description });
      if (res.data.success) {
        toast.success(res.data.message);
        fetchHistory();
      }
    } catch { toast.error('Failed to apply patch'); }
  };

  const handleDismiss = async (version) => {
    try { await axios.post(`${API}/api/system/updates/dismiss`, { version }); setUpdateResult(null); } catch { console.error('[UpdateSettings] Failed to dismiss update'); toast.error('[UpdateSettings] Failed to dismiss update');; }
  };

  const handleSaveSettings = async () => {
    try { await axios.post(`${API}/api/system/updates/settings`, updateSettings); toast.success('Update settings saved'); setShowSettings(false); } catch { console.error('[UpdateSettings] Failed to save update settings'); toast.error('[UpdateSettings] Failed to save update settings');; }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  const TierIcon = TIER_ICON[currentInfo?.tier] || Shield;
  const tierColor = TIER_COLOR[currentInfo?.tier] || '#6B7280';
  const mainUpdate = updateResult?.main_update;
  const hotfix = updateResult?.hotfix_patch;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6" data-testid="update-settings">
      {/* Current Version Card */}
      <div className="bg-surface border border-white/10 rounded-2xl overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${tierColor}20` }}>
                <TierIcon className="w-7 h-7" style={{ color: tierColor }} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">WatchNexus v{currentInfo?.version}</h2>
                <p className="text-gray-400 text-sm mt-0.5">{currentInfo?.tier_name} Edition</p>
              </div>
            </div>
            <Button
              onClick={handleCheckUpdates}
              disabled={checking}
              className="bg-violet-600 hover:bg-violet-700"
              data-testid="check-updates-btn"
            >
              {checking ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Checking...</>
              ) : (
                <><RefreshCw className="w-4 h-4 mr-2" /> Check for Updates</>
              )}
            </Button>
          </div>

          {currentInfo?.last_checked && (
            <p className="text-xs text-gray-500 mt-4 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Last checked: {new Date(currentInfo.last_checked).toLocaleString()}
            </p>
          )}
        </div>

        {/* Update Channels */}
        <div className="px-6 py-3 bg-black/20 border-t border-white/5 flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Server className="w-3.5 h-3.5" />
            <span>License Server: <span className="text-gray-400">{currentInfo?.update_channels?.license_server || 'Not configured'}</span></span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <GitBranch className="w-3.5 h-3.5" />
            <span>Patch Repo: <span className="text-gray-400">{currentInfo?.update_channels?.patch_repo || 'Not configured'}</span></span>
          </div>
        </div>
      </div>

      {/* Update Available Banner */}
      <AnimatePresence>
        {mainUpdate?.available && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="bg-gradient-to-r from-violet-600/20 to-purple-600/20 border border-violet-500/30 rounded-2xl p-6"
            data-testid="update-available-banner"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
                  <ArrowUpCircle className="w-6 h-6 text-violet-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Update Available: v{mainUpdate.latest_version}</h3>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {mainUpdate.tier} build
                    {mainUpdate.release_date && ` — Released ${new Date(mainUpdate.release_date).toLocaleDateString()}`}
                    {mainUpdate.size_mb > 0 && ` — ${mainUpdate.size_mb} MB`}
                  </p>
                  {mainUpdate.mandatory && <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded mt-1 inline-block">Mandatory Update</span>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => handleDismiss(mainUpdate.latest_version)} className="text-gray-500">Dismiss</Button>
              </div>
            </div>

            {(mainUpdate.release_notes || mainUpdate.changelog) && (
              <div className="mt-4 p-4 bg-black/30 rounded-xl">
                <h4 className="text-sm font-semibold text-white mb-2">Release Notes</h4>
                <p className="text-sm text-gray-400 whitespace-pre-wrap">{mainUpdate.release_notes || mainUpdate.changelog}</p>
              </div>
            )}

            <div className="flex gap-3 mt-4">
              {mainUpdate.download_url && (
                <a href={mainUpdate.download_url} target="_blank" rel="noreferrer">
                  <Button className="bg-violet-600 hover:bg-violet-700" data-testid="download-update-btn">
                    <Download className="w-4 h-4 mr-2" /> Download v{mainUpdate.latest_version}
                  </Button>
                </a>
              )}
              <div className="text-xs text-gray-500 flex items-center gap-1 bg-black/20 rounded-lg px-3">
                <code className="font-mono">docker pull watchnexus/watchnexus:{mainUpdate.latest_version}-{mainUpdate.tier}</code>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hotfix Patch Banner */}
      <AnimatePresence>
        {hotfix?.available && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className={`border rounded-2xl p-5 ${hotfix.severity === 'critical' ? 'bg-red-500/10 border-red-500/30' : hotfix.severity === 'high' ? 'bg-orange-500/10 border-orange-500/30' : 'bg-blue-500/10 border-blue-500/30'}`}
            data-testid="hotfix-banner"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className={`w-5 h-5 ${hotfix.severity === 'critical' ? 'text-red-400' : hotfix.severity === 'high' ? 'text-orange-400' : 'text-blue-400'}`} />
                <div>
                  <h4 className="text-sm font-semibold text-white">Hotfix Patch: {hotfix.patch_id}</h4>
                  <p className="text-xs text-gray-400">{hotfix.description} — {hotfix.files} file(s) — Severity: {hotfix.severity}</p>
                </div>
              </div>
              <Button size="sm" onClick={() => handleApplyPatch(hotfix)}
                className={hotfix.severity === 'critical' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}
                data-testid="apply-patch-btn"
              >
                Apply Patch
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Up to Date */}
      {updateResult && !mainUpdate?.available && !hotfix?.available && (
        <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-5 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-400" />
          <div>
            <p className="text-sm font-medium text-green-400">You're up to date!</p>
            <p className="text-xs text-gray-500">WatchNexus v{currentInfo?.version} is the latest version for your {currentInfo?.tier_name} tier.</p>
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)} data-testid="update-settings-toggle">
          <Settings className="w-4 h-4 mr-1" /> Update Preferences
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)}>
          <History className="w-4 h-4 mr-1" /> Update History ({updateHistory.length})
        </Button>
      </div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && updateSettings && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="bg-surface border border-white/10 rounded-2xl p-6 space-y-4"
          >
            <h3 className="font-semibold text-white">Update Preferences</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Auto-Check for Updates</label>
                <select value={updateSettings.auto_check ? 'true' : 'false'} onChange={(e) => setUpdateSettings(p => ({ ...p, auto_check: e.target.value === 'true' }))}
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm">
                  <option value="true">Enabled</option><option value="false">Disabled</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Check Interval</label>
                <select value={updateSettings.check_interval_hours || 24} onChange={(e) => setUpdateSettings(p => ({ ...p, check_interval_hours: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm">
                  <option value="6">Every 6 hours</option><option value="12">Every 12 hours</option><option value="24">Daily</option><option value="168">Weekly</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Auto-Install Silent Patches</label>
                <select value={updateSettings.auto_install_patches ? 'true' : 'false'} onChange={(e) => setUpdateSettings(p => ({ ...p, auto_install_patches: e.target.value === 'true' }))}
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm">
                  <option value="true">Enabled (recommended)</option><option value="false">Manual only</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Update Channel</label>
                <select value={updateSettings.channel || 'stable'} onChange={(e) => setUpdateSettings(p => ({ ...p, channel: e.target.value }))}
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm">
                  <option value="stable">Stable</option><option value="beta">Beta</option><option value="nightly">Nightly</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveSettings} className="bg-violet-600 hover:bg-violet-700">Save</Button>
              <Button variant="ghost" onClick={() => setShowSettings(false)}>Cancel</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Update History */}
      <AnimatePresence>
        {showHistory && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="bg-surface border border-white/10 rounded-2xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-white/10">
              <h3 className="font-semibold text-white">Update History</h3>
            </div>
            {updateHistory.length === 0 ? (
              <div className="p-8 text-center text-gray-500"><History className="w-10 h-10 mx-auto mb-2 opacity-20" /><p className="text-sm">No updates applied yet</p></div>
            ) : (
              <div className="divide-y divide-white/5">
                {updateHistory.map((h) => (
                  <div key={h.id} className="px-6 py-3 flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">
                        {h.type === 'hotfix' ? 'Hotfix' : 'Update'}: {h.from_version} {h.to_version !== h.from_version ? `→ ${h.to_version}` : '(patch)'}
                      </p>
                      {h.notes && <p className="text-xs text-gray-500 truncate">{h.notes}</p>}
                    </div>
                    <span className="text-xs text-gray-500 shrink-0">{new Date(h.applied_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default UpdateSettings;
