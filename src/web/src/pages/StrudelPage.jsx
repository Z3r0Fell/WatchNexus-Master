import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Disc, Play, Square, RotateCw, CircleDot, ChevronDown, ChevronRight,
  Film, Volume2, Subtitles, Settings, Clock, HardDrive, CheckCircle2,
  XCircle, Loader2, Info, Trash2, SkipForward, Download, Layers,
  Monitor, Cpu, AlertTriangle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';

const API = process.env.REACT_APP_BACKEND_URL || '';

const profileDescriptions = {
  direct: { label: 'Direct Copy', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  '1080p-h265-crf20': { label: '1080p HEVC', color: 'text-violet-400', bg: 'bg-violet-500/10' },
  '1080p-h264-crf18': { label: '1080p H.264', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  '720p-h265-crf22': { label: '720p Compact', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  '4k-passthrough': { label: '4K UHD', color: 'text-rose-400', bg: 'bg-rose-500/10' },
  'nvenc-h265-crf24': { label: 'NVENC GPU', color: 'text-green-400', bg: 'bg-green-500/10' },
  'qsv-h265-crf22': { label: 'QuickSync', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
};

const streamIcons = { video: Film, audio: Volume2, subtitle: Subtitles };

const statusConfig = {
  pending: { icon: Clock, color: 'text-gray-400', label: 'Pending' },
  scanning: { icon: Loader2, color: 'text-blue-400', label: 'Scanning', spin: true },
  ripping: { icon: Disc, color: 'text-violet-400', label: 'Ripping', spin: true },
  transcoding: { icon: Cpu, color: 'text-amber-400', label: 'Transcoding', spin: true },
  extracting: { icon: Layers, color: 'text-cyan-400', label: 'Extracting', spin: true },
  importing: { icon: Download, color: 'text-green-400', label: 'Importing', spin: true },
  complete: { icon: CheckCircle2, color: 'text-emerald-400', label: 'Complete' },
  failed: { icon: XCircle, color: 'text-red-400', label: 'Failed' },
  cancelled: { icon: Square, color: 'text-gray-500', label: 'Cancelled' },
};

export const StrudelPage = () => {
  const [activeTab, setActiveTab] = useState('rip');
  const [status, setStatus] = useState(null);
  const [drives, setDrives] = useState([]);
  const [scanResult, setScanResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [history, setHistory] = useState([]);
  const [config, setConfig] = useState(null);
  const [selectedTitles, setSelectedTitles] = useState({});
  const [expandedTitles, setExpandedTitles] = useState({});
  const [selectedProfile, setSelectedProfile] = useState('1080p-h265-crf20');
  const [outputFormat, setOutputFormat] = useState('mkv');
  const [loading, setLoading] = useState(true);

  const headers = useCallback(() => {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const h = headers();
      const [statusRes, drivesRes, jobsRes, profilesRes, historyRes, configRes] = await Promise.all([
        axios.get(`${API}/api/strudel/status`, { headers: h }),
        axios.get(`${API}/api/strudel/drives`, { headers: h }),
        axios.get(`${API}/api/strudel/jobs`, { headers: h }),
        axios.get(`${API}/api/strudel/profiles`, { headers: h }),
        axios.get(`${API}/api/strudel/history`, { headers: h }),
        axios.get(`${API}/api/strudel/config`, { headers: h }),
      ]);
      setStatus(statusRes.data);
      setDrives(drivesRes.data?.drives || []);
      setJobs(jobsRes.data?.jobs || []);
      setProfiles(Array.isArray(profilesRes.data) ? profilesRes.data : []);
      setHistory(historyRes.data?.history || []);
      setConfig(configRes.data);
    } catch (e) {
      console.error('Strudel fetch error:', e);
        toast.error('Strudel fetch error:');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Poll jobs every 5 seconds if any are active
  useEffect(() => {
    const hasActive = jobs.some(j => ['ripping', 'transcoding', 'scanning', 'extracting', 'importing'].includes(j?.status));
    if (!hasActive) return;
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/api/strudel/jobs`, { headers: headers() });
        setJobs(res.data?.jobs || []);
      } catch { console.error('[StrudelPage] Poll jobs failed'); toast.error('[StrudelPage] Poll jobs failed');; }
    }, 5000);
    return () => clearInterval(interval);
  }, [jobs, headers]);

  const scanDisc = async (driveIndex) => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await axios.post(`${API}/api/strudel/scan`, { DriveIndex: driveIndex }, { headers: headers() });
      const jobId = res.data?.job_id;
      toast.success('Scanning disc...');

      // Poll for scan results
      const poll = setInterval(async () => {
        try {
          const scanRes = await axios.get(`${API}/api/strudel/scan/${jobId}`, { headers: headers() });
          if (scanRes.data?.Status === 'complete' || scanRes.data?.Status === 'failed' || scanRes.data?.Status === 'no_titles') {
            clearInterval(poll);
            setScanResult(scanRes.data);
            setScanning(false);
            if (scanRes.data?.Status === 'complete') {
              toast.success(`Found ${scanRes.data.TitleCount} titles on ${scanRes.data.DiscLabel}`);
              // Auto-select longest title
              const titles = scanRes.data.Titles || [];
              if (titles.length > 0) {
                const longest = titles.reduce((a, b) => (a.SizeBytes > b.SizeBytes ? a : b));
                setSelectedTitles({ [longest.Index]: true });
              }
            } else {
              toast.error(scanRes.data?.Error || 'No titles found');
            }
          }
        } catch { console.error('[StrudelPage] Poll scan results failed'); toast.error('[StrudelPage] Poll scan results failed');; }
      }, 2000);
    } catch (e) {
      setScanning(false);
      toast.error(e.response?.data?.error || 'Scan failed');
    }
  };

  const startRip = async () => {
    const selected = Object.entries(selectedTitles).filter(([, v]) => v).map(([k]) => parseInt(k));
    if (selected.length === 0) { toast.error('Select at least one title'); return; }
    try {
      const res = await axios.post(`${API}/api/strudel/rip`, {
        DriveIndex: scanResult?.DriveIndex || 0,
        DiscLabel: scanResult?.DiscLabel || 'Unknown',
        Titles: selected,
        TranscodeProfile: selectedProfile,
        OutputFormat: outputFormat,
      }, { headers: headers() });
      toast.success(`Rip started: ${res.data?.disc_label}`);
      setActiveTab('queue');
      fetchAll();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to start rip');
    }
  };

  const cancelJob = async (jobId) => {
    try {
      await axios.delete(`${API}/api/strudel/jobs/${jobId}`, { headers: headers() });
      toast.success('Job cancelled');
      fetchAll();
    } catch { toast.error('Failed to cancel'); }
  };

  const retryJob = async (jobId) => {
    try {
      await axios.post(`${API}/api/strudel/jobs/${jobId}/retry`, {}, { headers: headers() });
      toast.success('Job restarted');
      fetchAll();
    } catch { toast.error('Failed to retry'); }
  };

  const ejectDrive = async (driveIndex) => {
    try {
      await axios.post(`${API}/api/strudel/eject/${driveIndex}`, {}, { headers: headers() });
      toast.success('Eject command sent');
    } catch { toast.error('Eject failed'); }
  };

  const toggleTitle = (idx) => setSelectedTitles(prev => ({ ...prev, [idx]: !prev[idx] }));
  const toggleExpand = (idx) => setExpandedTitles(prev => ({ ...prev, [idx]: !prev[idx] }));

  const tabs = [
    { id: 'rip', label: 'Rip Disc', icon: Disc },
    { id: 'queue', label: 'Job Queue', icon: Layers, badge: jobs.filter(j => j?.status !== 'complete' && j?.status !== 'failed').length },
    { id: 'profiles', label: 'Profiles', icon: Settings },
    { id: 'history', label: 'History', icon: Clock },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6" data-testid="strudel-page">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
            <Disc className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Optical Disc Ripping</h1>
            <p className="text-gray-400 text-sm">Strudel &mdash; Extract video, audio, and subtitles from DVD &amp; Blu-ray</p>
          </div>
        </div>

        {/* Tool Status */}
        {status?.tools && (
          <div className="flex flex-wrap gap-3" data-testid="tool-status">
            {Object.entries(status.tools).map(([name, info]) => (
              <div key={name} className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border",
                info.installed ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" : info.required ? "bg-red-500/5 border-red-500/20 text-red-400" : "bg-gray-500/5 border-gray-500/20 text-gray-500"
              )}>
                {info.installed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                {name} {info.required && !info.installed && '(required)'}
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-white/[0.03] rounded-lg p-1 w-fit" data-testid="strudel-tabs">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                activeTab === tab.id ? "bg-violet-600/20 text-violet-300" : "text-gray-400 hover:text-gray-200 hover:bg-white/[0.03]"
              )} data-testid={`tab-${tab.id}`}>
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.badge > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-violet-600 text-white text-[10px] rounded-full">{tab.badge}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'rip' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Drives */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5" data-testid="drives-panel">
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-violet-400" /> Optical Drives
              </h3>
              {drives.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <HardDrive className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No optical drives detected</p>
                  <p className="text-xs text-gray-600 mt-1">Connect a USB or SATA DVD/Blu-ray drive to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {drives.map(drive => (
                    <div key={drive.Index} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.04] rounded-lg px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Disc className={cn("w-5 h-5", drive.HasDisc ? "text-violet-400" : "text-gray-600")} />
                        <div>
                          <p className="text-sm font-medium text-gray-200">{drive.Name}</p>
                          <p className="text-xs text-gray-500">{drive.Device} &middot; {drive.HasDisc ? 'Disc present' : 'Empty'}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => scanDisc(drive.Index)} disabled={scanning} data-testid={`scan-drive-${drive.Index}`} className="text-xs">
                          {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Play className="w-3.5 h-3.5 mr-1" />}
                          Scan
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => ejectDrive(drive.Index)} data-testid={`eject-drive-${drive.Index}`} className="text-xs text-gray-400">
                          <CircleDot className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Scan Results */}
            {scanResult && scanResult.Titles && scanResult.Titles.length > 0 && (
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5" data-testid="scan-results">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                      <Info className="w-4 h-4 text-blue-400" />
                      {scanResult.DiscLabel}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {scanResult.DiscType?.toUpperCase()} &middot; {scanResult.TitleCount} title{scanResult.TitleCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <select value={selectedProfile} onChange={e => setSelectedProfile(e.target.value)}
                      className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-gray-300" data-testid="profile-select">
                      {profiles.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <select value={outputFormat} onChange={e => setOutputFormat(e.target.value)}
                      className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-gray-300" data-testid="format-select">
                      <option value="mkv">MKV</option>
                      <option value="mp4">MP4</option>
                    </select>
                  </div>
                </div>

                {/* Titles */}
                <div className="space-y-1">
                  {scanResult.Titles.map(title => (
                    <div key={title.Index} className="border border-white/[0.04] rounded-lg overflow-hidden">
                      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02]" onClick={() => toggleExpand(title.Index)}>
                        <input type="checkbox" checked={!!selectedTitles[title.Index]} onChange={() => toggleTitle(title.Index)} onClick={e => e.stopPropagation()}
                          className="w-4 h-4 rounded border-gray-600 text-violet-600 focus:ring-violet-500" data-testid={`title-check-${title.Index}`} />
                        {expandedTitles[title.Index] ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                        <Film className="w-4 h-4 text-violet-400" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-200 truncate">
                            Title {title.Index} {title.SuggestedFilename && <span className="text-gray-500">({title.SuggestedFilename})</span>}
                          </p>
                        </div>
                        <span className="text-xs text-gray-500 tabular-nums">{title.Duration}</span>
                        <span className="text-xs text-gray-500 tabular-nums">{title.SizeHuman}</span>
                        <span className="text-xs text-gray-600">{title.Chapters} ch</span>
                      </div>

                      {expandedTitles[title.Index] && title.Streams && (
                        <div className="border-t border-white/[0.04] bg-white/[0.01] px-4 py-2 space-y-1">
                          {title.Streams.map(stream => {
                            const Icon = streamIcons[stream.Type] || Info;
                            return (
                              <div key={stream.Index} className="flex items-center gap-3 py-1 text-xs">
                                <Icon className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                                <span className={cn("font-medium w-16",
                                  stream.Type === 'video' ? 'text-blue-400' :
                                  stream.Type === 'audio' ? 'text-amber-400' : 'text-green-400'
                                )}>{stream.Type}</span>
                                <span className="text-gray-400 w-28 truncate">{stream.CodecName || stream.CodecShort || stream.CodecId}</span>
                                {stream.Resolution && <span className="text-gray-500">{stream.Resolution}</span>}
                                {stream.Channels > 0 && <span className="text-gray-500">{stream.Channels}ch</span>}
                                {stream.LanguageName && <span className="text-gray-500">{stream.LanguageName}</span>}
                                {stream.Bitrate && <span className="text-gray-600">{stream.Bitrate}</span>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Rip Button */}
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    {Object.values(selectedTitles).filter(Boolean).length} title{Object.values(selectedTitles).filter(Boolean).length !== 1 ? 's' : ''} selected
                    &middot; Profile: {profileDescriptions[selectedProfile]?.label || selectedProfile}
                    &middot; Format: {outputFormat.toUpperCase()}
                  </p>
                  <Button onClick={startRip} disabled={Object.values(selectedTitles).filter(Boolean).length === 0} data-testid="start-rip-btn"
                    className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white">
                    <Play className="w-4 h-4 mr-2" /> Start Rip
                  </Button>
                </div>
              </div>
            )}

            {/* Legal Notice */}
            <div className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/10 rounded-lg px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-400/80 leading-relaxed">
                Strudel requires user-installed third-party tools (MakeMKV, HandBrake). Users are responsible for ensuring compliance with applicable laws regarding disc copying in their jurisdiction. WatchNexus does not provide or distribute any decryption tools.
              </p>
            </div>
          </motion.div>
        )}

        {activeTab === 'queue' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3" data-testid="job-queue">
            {jobs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Layers className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No rip jobs in queue</p>
                <p className="text-xs text-gray-600 mt-1">Scan a disc and start ripping to see jobs here</p>
              </div>
            ) : jobs.map((job, i) => {
              const cfg = statusConfig[job?.status] || statusConfig.pending;
              const StatusIcon = cfg.icon;
              const progress = job?.status === 'ripping' ? job.rip_progress :
                             job?.status === 'transcoding' ? job.transcode_progress : 0;
              return (
                <div key={job?.id || i} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4" data-testid={`job-${job?.id}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <StatusIcon className={cn("w-5 h-5", cfg.color, cfg.spin && "animate-spin")} />
                      <div>
                        <p className="text-sm font-medium text-gray-200">{job?.disc_label || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">
                          {cfg.label} &middot; {job?.selected_titles?.length || 0} title(s)
                          &middot; {profileDescriptions[job?.transcode_profile]?.label || job?.transcode_profile}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {['ripping', 'transcoding', 'pending'].includes(job?.status) && (
                        <Button size="sm" variant="ghost" onClick={() => cancelJob(job.id)} className="text-gray-500 hover:text-red-400" data-testid={`cancel-${job?.id}`}>
                          <Square className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {job?.status === 'failed' && (
                        <Button size="sm" variant="ghost" onClick={() => retryJob(job.id)} className="text-gray-500 hover:text-violet-400" data-testid={`retry-${job?.id}`}>
                          <RotateCw className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {['complete', 'failed', 'cancelled'].includes(job?.status) && (
                        <Button size="sm" variant="ghost" onClick={() => cancelJob(job.id)} className="text-gray-500 hover:text-red-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {['ripping', 'transcoding'].includes(job?.status) && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{cfg.label}</span>
                        <span>{progress?.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-violet-600 to-purple-500 rounded-full transition-all duration-500"
                          style={{ width: `${progress || 0}%` }} />
                      </div>
                    </div>
                  )}
                  {job?.error && (
                    <p className="mt-2 text-xs text-red-400/80 bg-red-500/5 rounded-lg px-3 py-1.5">{job.error}</p>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}

        {activeTab === 'profiles' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} data-testid="profiles-panel">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {profiles.map(p => {
                const desc = profileDescriptions[p.id] || { label: p.name, color: 'text-gray-400', bg: 'bg-gray-500/10' };
                return (
                  <div key={p.id} className={cn("bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 transition-all hover:border-white/[0.1]",
                    selectedProfile === p.id && "border-violet-500/30 bg-violet-500/[0.03]")}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-md", desc.bg, desc.color)}>{desc.label}</span>
                      {p.hw_accel !== 'none' && p.hw_accel !== 'auto' && (
                        <Monitor className="w-3.5 h-3.5 text-gray-500" />
                      )}
                    </div>
                    <h4 className="text-sm font-medium text-gray-200">{p.name}</h4>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{p.description}</p>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.04]">
                      <span className="text-[10px] text-gray-600 uppercase tracking-wider">
                        {p.video_encoder} {p.video_quality > 0 ? `CRF ${p.video_quality}` : ''} &middot; {p.output_format?.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-gray-600">{p.estimated_size}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} data-testid="history-panel">
            {history.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No rip history yet</p>
                <p className="text-xs text-gray-600 mt-1">Completed rips will appear here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((h, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.04] rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-200">{h?.disc_label || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">
                          {h?.selected_titles?.length || 0} title(s) &middot; {h?.transcode_profile}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-600">{h?.completed_at ? new Date(h.completed_at).toLocaleDateString() : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </Layout>
  );
};

export default StrudelPage;
