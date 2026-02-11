import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { torrentEngineApi, qbittorrentApi } from '../services/api';
import { toast } from 'sonner';
import { 
  Download, Pause, Play, Trash2, RefreshCw, 
  HardDrive, ArrowDown, ArrowUp, CheckCircle, AlertCircle, Clock,
  Server, Wifi, WifiOff, Settings, Zap, Package, FileVideo, List
} from 'lucide-react';
import { formatFileSize } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Link } from 'react-router-dom';

const statusColors = {
  queued: 'text-gray-400',
  downloading: 'text-blue-400',
  downloading_metadata: 'text-blue-300',
  seeding: 'text-green-400',
  finished: 'text-green-500',
  completed: 'text-green-500',
  paused: 'text-yellow-400',
  error: 'text-red-400',
  allocating: 'text-cyan-400',
  checking: 'text-cyan-400',
};

const statusIcons = {
  queued: Clock,
  downloading: ArrowDown,
  downloading_metadata: RefreshCw,
  seeding: ArrowUp,
  finished: CheckCircle,
  completed: CheckCircle,
  paused: Pause,
  error: AlertCircle,
  allocating: HardDrive,
  checking: RefreshCw,
};

export const DownloadsPage = () => {
  const [engineTorrents, setEngineTorrents] = useState([]);
  const [engineStatus, setEngineStatus] = useState(null);
  const [qbitTorrents, setQbitTorrents] = useState([]);
  const [qbitStatus, setQbitStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadMode, setDownloadMode] = useState('builtin');
  const [selectedTorrent, setSelectedTorrent] = useState(null);
  const [torrentFiles, setTorrentFiles] = useState([]);

  // Fetch built-in engine status and torrents
  const fetchEngineData = useCallback(async () => {
    try {
      const [statusRes, torrentsRes] = await Promise.all([
        torrentEngineApi.getStatus(),
        torrentEngineApi.getTorrents()
      ]);
      setEngineStatus(statusRes.data);
      setEngineTorrents(torrentsRes.data || []);
    } catch (error) {
      console.error('Engine fetch failed:', error);
      setEngineStatus({ success: false });
    }
  }, []);

  // Fetch qBittorrent status and torrents
  const fetchQbitData = useCallback(async () => {
    try {
      const statusRes = await qbittorrentApi.getStatus();
      setQbitStatus(statusRes.data);
      
      if (statusRes.data?.success) {
        const torrentsRes = await qbittorrentApi.getTorrents('all', '', 100);
        setQbitTorrents(torrentsRes.data || []);
      }
    } catch (error) {
      console.error('qBittorrent fetch failed:', error);
      setQbitStatus({ success: false });
    }
  }, []);

  useEffect(() => {
    // Load saved download mode
    const savedMode = localStorage.getItem('watchnexus_download_mode') || 'builtin';
    setDownloadMode(savedMode);

    const fetchAll = async () => {
      await Promise.all([fetchEngineData(), fetchQbitData()]);
      setLoading(false);
    };
    
    fetchAll();
    
    // Poll for updates
    const interval = setInterval(() => {
      if (downloadMode === 'builtin') {
        fetchEngineData();
      } else {
        fetchQbitData();
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [fetchEngineData, fetchQbitData, downloadMode]);

  // Built-in engine actions
  const handleEnginePauseResume = async (torrent) => {
    try {
      if (torrent.state === 'paused') {
        await torrentEngineApi.resumeTorrent(torrent.id);
        toast.success('Torrent resumed');
      } else {
        await torrentEngineApi.pauseTorrent(torrent.id);
        toast.success('Torrent paused');
      }
      fetchEngineData();
    } catch (error) {
      toast.error('Failed to update torrent');
    }
  };

  const handleEngineDelete = async (torrentId, deleteFiles = false) => {
    try {
      await torrentEngineApi.removeTorrent(torrentId, deleteFiles);
      toast.success('Torrent removed');
      setSelectedTorrent(null);
      fetchEngineData();
    } catch (error) {
      toast.error('Failed to remove torrent');
    }
  };

  const handleEngineSetSequential = async (torrentId, enabled) => {
    try {
      await torrentEngineApi.setSequential(torrentId, enabled);
      toast.success(`Sequential download ${enabled ? 'enabled' : 'disabled'}`);
      fetchEngineData();
    } catch (error) {
      toast.error('Failed to update sequential mode');
    }
  };

  const fetchTorrentFiles = async (torrentId) => {
    try {
      const res = await torrentEngineApi.getFiles(torrentId);
      setTorrentFiles(res.data || []);
    } catch (error) {
      setTorrentFiles([]);
    }
  };

  // qBittorrent actions
  const handleQbitPauseResume = async (torrent) => {
    try {
      if (torrent.state.includes('paused')) {
        await qbittorrentApi.resumeTorrent(torrent.hash);
        toast.success('Torrent resumed');
      } else {
        await qbittorrentApi.pauseTorrent(torrent.hash);
        toast.success('Torrent paused');
      }
      fetchQbitData();
    } catch (error) {
      toast.error('Failed to update torrent');
    }
  };

  const handleQbitDelete = async (hash, deleteFiles = false) => {
    try {
      await qbittorrentApi.deleteTorrent(hash, deleteFiles);
      toast.success('Torrent removed');
      fetchQbitData();
    } catch (error) {
      toast.error('Failed to remove torrent');
    }
  };

  // Get current torrents based on mode
  const currentTorrents = downloadMode === 'builtin' ? engineTorrents : qbitTorrents;
  const isConnected = downloadMode === 'builtin' ? engineStatus?.success : qbitStatus?.success;

  // Calculate totals
  const totalDownSpeed = downloadMode === 'builtin'
    ? engineTorrents.reduce((sum, t) => sum + (t.download_rate || 0), 0)
    : qbitTorrents.reduce((sum, t) => sum + (t.dlspeed || 0), 0);
  
  const totalUpSpeed = downloadMode === 'builtin'
    ? engineTorrents.reduce((sum, t) => sum + (t.upload_rate || 0), 0)
    : qbitTorrents.reduce((sum, t) => sum + (t.upspeed || 0), 0);

  const activeTorrents = currentTorrents.filter(t => 
    t.state === 'downloading' || t.state === 'downloading_metadata' || t.is_downloading
  );

  return (
    <Layout>
      <div data-testid="downloads-page" className="min-h-screen p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-600 to-emerald-500 flex items-center justify-center">
                <Download className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Downloads</h1>
                <p className="text-gray-400">Manage your download queue</p>
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-6">
              <div className="text-right">
                <p className="text-sm text-gray-400">Active</p>
                <p className="text-2xl font-bold text-blue-400">{activeTorrents.length}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">↓ Speed</p>
                <p className="text-2xl font-bold text-green-400">{formatFileSize(totalDownSpeed)}/s</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">↑ Speed</p>
                <p className="text-2xl font-bold text-purple-400">{formatFileSize(totalUpSpeed)}/s</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Engine Status */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card rounded-xl p-4 mb-6"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              {/* Mode Toggle */}
              <div className="flex rounded-lg bg-white/5 p-1">
                <button
                  onClick={() => { setDownloadMode('builtin'); localStorage.setItem('watchnexus_download_mode', 'builtin'); }}
                  className={`px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors text-sm ${
                    downloadMode === 'builtin' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  Built-in
                </button>
                <button
                  onClick={() => { setDownloadMode('qbittorrent'); localStorage.setItem('watchnexus_download_mode', 'qbittorrent'); }}
                  className={`px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors text-sm ${
                    downloadMode === 'qbittorrent' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  qBittorrent
                </button>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-green-400 text-sm">
                      {downloadMode === 'builtin' 
                        ? 'Built-in Engine Running'
                        : `qBittorrent v${qbitStatus?.version}`}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-red-400 text-sm">Not Connected</span>
                  </>
                )}
              </div>

              {downloadMode === 'builtin' && engineStatus?.transfer && (
                <span className="text-xs text-gray-500">
                  DHT: {engineStatus.transfer.dht_nodes} nodes
                </span>
              )}
            </div>

            <Link to="/settings">
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Configure
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Torrent List */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {loading ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-violet-400" />
              <p className="text-gray-400">Loading downloads...</p>
            </div>
          ) : currentTorrents.length === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <Download className="w-12 h-12 mx-auto mb-4 text-gray-600" />
              <h3 className="text-xl font-bold mb-2">No Downloads</h3>
              <p className="text-gray-400 mb-4">
                Your download queue is empty. Search for content using Compote to get started!
              </p>
              <Link to="/">
                <Button className="bg-violet-600 hover:bg-violet-700">
                  Browse Content
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {currentTorrents.map((torrent) => {
                const isBuiltin = downloadMode === 'builtin';
                const id = isBuiltin ? torrent.id : torrent.hash;
                const name = torrent.name || 'Unknown';
                const progress = isBuiltin ? torrent.progress : (torrent.progress * 100);
                const state = torrent.state;
                const downloadRate = isBuiltin ? torrent.download_rate_formatted : formatFileSize(torrent.dlspeed) + '/s';
                const uploadRate = isBuiltin ? torrent.upload_rate_formatted : formatFileSize(torrent.upspeed) + '/s';
                const totalSize = isBuiltin ? torrent.total_size_formatted : formatFileSize(torrent.size);
                const eta = isBuiltin ? torrent.eta_formatted : 'N/A';
                const seeds = isBuiltin ? torrent.num_seeds : torrent.num_seeds;
                const peers = isBuiltin ? torrent.num_peers : torrent.num_leechs;
                
                const StatusIcon = statusIcons[state] || Clock;
                const statusColor = statusColors[state] || 'text-gray-400';
                const isPaused = state === 'paused' || state?.includes?.('paused');

                return (
                  <motion.div
                    key={id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`glass-card rounded-xl p-4 transition-all hover:border-white/20 ${
                      selectedTorrent === id ? 'border-violet-500/50' : ''
                    }`}
                    onClick={() => {
                      setSelectedTorrent(selectedTorrent === id ? null : id);
                      if (isBuiltin && selectedTorrent !== id) {
                        fetchTorrentFiles(id);
                      }
                    }}
                  >
                    <div className="flex items-center gap-4">
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        state === 'downloading' || state?.includes?.('downloading') 
                          ? 'bg-blue-500/20' 
                          : state === 'seeding' || state === 'finished'
                          ? 'bg-green-500/20'
                          : 'bg-white/10'
                      }`}>
                        <StatusIcon className={`w-5 h-5 ${statusColor}`} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{name}</h3>
                        <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                          <span className={statusColor}>{state}</span>
                          <span>{totalSize}</span>
                          {state === 'downloading' && <span>ETA: {eta}</span>}
                          <span>Seeds: {seeds}</span>
                          <span>Peers: {peers}</span>
                        </div>
                      </div>

                      {/* Speed */}
                      <div className="text-right hidden md:block">
                        <div className="flex items-center gap-1 text-green-400">
                          <ArrowDown className="w-3 h-3" />
                          <span className="text-sm">{downloadRate}</span>
                        </div>
                        <div className="flex items-center gap-1 text-purple-400">
                          <ArrowUp className="w-3 h-3" />
                          <span className="text-sm">{uploadRate}</span>
                        </div>
                      </div>

                      {/* Progress */}
                      <div className="w-32 hidden md:block">
                        <Progress value={progress} className="h-2 bg-white/10" />
                        <p className="text-xs text-gray-400 mt-1 text-right">{progress?.toFixed?.(1) || progress}%</p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            isBuiltin ? handleEnginePauseResume(torrent) : handleQbitPauseResume(torrent);
                          }}
                        >
                          {isPaused ? (
                            <Play className="w-4 h-4 text-green-400" />
                          ) : (
                            <Pause className="w-4 h-4 text-yellow-400" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Remove this torrent?')) {
                              isBuiltin ? handleEngineDelete(id, false) : handleQbitDelete(id, false);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {selectedTorrent === id && isBuiltin && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-4 pt-4 border-t border-white/10"
                      >
                        <div className="flex items-center gap-4 mb-4">
                          <Button
                            size="sm"
                            variant={torrent.sequential ? 'default' : 'outline'}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEngineSetSequential(id, !torrent.sequential);
                            }}
                          >
                            <Play className="w-4 h-4 mr-2" />
                            Sequential {torrent.sequential ? '(On)' : '(Off)'}
                          </Button>
                          <span className="text-xs text-gray-500">
                            Info Hash: {torrent.info_hash?.slice(0, 16)}...
                          </span>
                        </div>

                        {/* Files */}
                        {torrentFiles.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium flex items-center gap-2">
                              <List className="w-4 h-4" />
                              Files ({torrentFiles.length})
                            </h4>
                            <div className="max-h-48 overflow-y-auto space-y-1">
                              {torrentFiles.map((file) => (
                                <div key={file.index} className="flex items-center gap-3 p-2 rounded bg-white/5 text-sm">
                                  <FileVideo className="w-4 h-4 text-violet-400 flex-shrink-0" />
                                  <span className="flex-1 truncate">{file.path}</span>
                                  <span className="text-gray-400">{file.size_formatted}</span>
                                  <Progress value={file.progress} className="w-20 h-1.5" />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </Layout>
  );
};

export default DownloadsPage;
