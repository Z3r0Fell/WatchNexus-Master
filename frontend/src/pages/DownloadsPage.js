import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { downloadsApi, qbittorrentApi } from '../services/api';
import { toast } from 'sonner';
import { 
  Download, Pause, Play, Trash2, RefreshCw, 
  HardDrive, ArrowDown, ArrowUp, CheckCircle, AlertCircle, Clock,
  Server, Wifi, WifiOff, Settings
} from 'lucide-react';
import { formatFileSize } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Link } from 'react-router-dom';

const statusColors = {
  queued: 'text-gray-400',
  downloading: 'text-blue-400',
  seeding: 'text-green-400',
  completed: 'text-green-500',
  paused: 'text-yellow-400',
  pausedDL: 'text-yellow-400',
  pausedUP: 'text-yellow-400',
  error: 'text-red-400',
  stalledDL: 'text-orange-400',
  stalledUP: 'text-orange-400',
  uploading: 'text-purple-400',
  metaDL: 'text-blue-300',
  checkingDL: 'text-cyan-400',
  checkingUP: 'text-cyan-400',
};

const statusIcons = {
  queued: Clock,
  downloading: ArrowDown,
  seeding: ArrowUp,
  completed: CheckCircle,
  paused: Pause,
  pausedDL: Pause,
  pausedUP: Pause,
  error: AlertCircle,
  stalledDL: Clock,
  stalledUP: Clock,
  uploading: ArrowUp,
  metaDL: RefreshCw,
  checkingDL: RefreshCw,
  checkingUP: RefreshCw,
};

export const DownloadsPage = () => {
  const [downloads, setDownloads] = useState([]);
  const [qbitTorrents, setQbitTorrents] = useState([]);
  const [qbitStatus, setQbitStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qbitConnected, setQbitConnected] = useState(false);

  const fetchQbitStatus = useCallback(async () => {
    try {
      const response = await qbittorrentApi.getStatus();
      setQbitStatus(response.data);
      setQbitConnected(response.data?.success === true);
      
      if (response.data?.success) {
        // Fetch torrents if connected
        const torrentsRes = await qbittorrentApi.getTorrents('all', '', 100);
        setQbitTorrents(torrentsRes.data || []);
      }
    } catch (error) {
      console.error('qBittorrent status check failed:', error);
      setQbitConnected(false);
    }
  }, []);

  const fetchDownloads = useCallback(async () => {
    try {
      const response = await downloadsApi.getAll();
      setDownloads(response.data || []);
    } catch (error) {
      console.error('Failed to fetch downloads:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDownloads();
    fetchQbitStatus();
    
    // Poll for updates every 3 seconds
    const interval = setInterval(() => {
      fetchQbitStatus();
      fetchDownloads();
    }, 3000);
    
    return () => clearInterval(interval);
  }, [fetchDownloads, fetchQbitStatus]);

  const handleQbitPauseResume = async (torrent) => {
    try {
      if (torrent.state.includes('paused')) {
        await qbittorrentApi.resumeTorrent(torrent.hash);
        toast.success('Torrent resumed');
      } else {
        await qbittorrentApi.pauseTorrent(torrent.hash);
        toast.success('Torrent paused');
      }
      fetchQbitStatus();
    } catch (error) {
      toast.error('Failed to update torrent');
    }
  };

  const handleQbitDelete = async (hash, deleteFiles = false) => {
    try {
      await qbittorrentApi.deleteTorrent(hash, deleteFiles);
      toast.success('Torrent removed');
      fetchQbitStatus();
    } catch (error) {
      toast.error('Failed to remove torrent');
    }
  };

  const handlePauseResume = async (download) => {
    try {
      const newStatus = download.status === 'paused' ? 'downloading' : 'paused';
      await downloadsApi.update(download.id, newStatus);
      setDownloads(prev => prev.map(dl => 
        dl.id === download.id ? { ...dl, status: newStatus } : dl
      ));
      toast.success(newStatus === 'paused' ? 'Download paused' : 'Download resumed');
    } catch (error) {
      toast.error('Failed to update download');
    }
  };

  const handleDelete = async (downloadId) => {
    try {
      await downloadsApi.delete(downloadId);
      setDownloads(prev => prev.filter(dl => dl.id !== downloadId));
      toast.success('Download removed');
    } catch (error) {
      toast.error('Failed to remove download');
    }
  };

  // Categorize qBittorrent torrents
  const activeTorrents = qbitTorrents.filter(t => t.is_downloading);
  const seedingTorrents = qbitTorrents.filter(t => t.state === 'uploading' || t.state === 'stalledUP');
  const completedTorrents = qbitTorrents.filter(t => t.is_complete && !t.state.includes('UP'));
  const pausedTorrents = qbitTorrents.filter(t => t.state.includes('paused'));

  // Queue from local downloads
  const queuedDownloads = downloads.filter(d => d.status === 'queued' || d.status === 'searching');

  // Calculate total speeds
  const totalDownSpeed = qbitTorrents.reduce((sum, t) => sum + (t.dlspeed || 0), 0);
  const totalUpSpeed = qbitTorrents.reduce((sum, t) => sum + (t.upspeed || 0), 0);

  return (
    <Layout>
      <div data-testid="downloads-page" className="min-h-screen p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
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

        {/* qBittorrent Status */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`mb-6 p-4 rounded-xl border ${
            qbitConnected 
              ? 'bg-green-500/10 border-green-500/30' 
              : 'bg-orange-500/10 border-orange-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {qbitConnected ? (
                <Wifi className="w-5 h-5 text-green-400" />
              ) : (
                <WifiOff className="w-5 h-5 text-orange-400" />
              )}
              <div>
                <p className={`font-medium ${qbitConnected ? 'text-green-400' : 'text-orange-400'}`}>
                  {qbitConnected ? 'qBittorrent Connected' : 'qBittorrent Not Connected'}
                </p>
                <p className="text-sm text-gray-400">
                  {qbitConnected 
                    ? `v${qbitStatus?.version || 'Unknown'} • API v${qbitStatus?.api_version || 'Unknown'}`
                    : 'Configure qBittorrent in Settings to enable real downloads'
                  }
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchQbitStatus}
                className="border-white/10"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Link to="/settings">
                <Button variant="outline" size="sm" className="border-white/10">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Empty State */}
        {qbitTorrents.length === 0 && downloads.length === 0 && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div className="w-24 h-24 rounded-full bg-surface flex items-center justify-center mb-6">
              <HardDrive className="w-12 h-12 text-gray-600" />
            </div>
            <h2 className="text-xl font-bold mb-2">No Downloads</h2>
            <p className="text-gray-400 text-center max-w-md">
              Your download queue is empty. Use Compote search in Settings to find and grab content.
            </p>
          </motion.div>
        )}

        {/* Active Downloads (qBittorrent) */}
        {activeTorrents.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <ArrowDown className="w-5 h-5 text-blue-400" />
              Downloading ({activeTorrents.length})
            </h2>
            <div className="space-y-3">
              {activeTorrents.map((torrent) => (
                <QbitTorrentItem
                  key={torrent.hash}
                  torrent={torrent}
                  onPauseResume={handleQbitPauseResume}
                  onDelete={handleQbitDelete}
                />
              ))}
            </div>
          </section>
        )}

        {/* Seeding (qBittorrent) */}
        {seedingTorrents.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <ArrowUp className="w-5 h-5 text-purple-400" />
              Seeding ({seedingTorrents.length})
            </h2>
            <div className="space-y-3">
              {seedingTorrents.map((torrent) => (
                <QbitTorrentItem
                  key={torrent.hash}
                  torrent={torrent}
                  onPauseResume={handleQbitPauseResume}
                  onDelete={handleQbitDelete}
                />
              ))}
            </div>
          </section>
        )}

        {/* Queued Downloads (Local) */}
        {queuedDownloads.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-400" />
              Queue ({queuedDownloads.length})
            </h2>
            <div className="space-y-3">
              {queuedDownloads.map((download) => (
                <DownloadItem
                  key={download.id}
                  download={download}
                  onPauseResume={handlePauseResume}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </section>
        )}

        {/* Paused (qBittorrent) */}
        {pausedTorrents.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Pause className="w-5 h-5 text-yellow-400" />
              Paused ({pausedTorrents.length})
            </h2>
            <div className="space-y-3">
              {pausedTorrents.map((torrent) => (
                <QbitTorrentItem
                  key={torrent.hash}
                  torrent={torrent}
                  onPauseResume={handleQbitPauseResume}
                  onDelete={handleQbitDelete}
                />
              ))}
            </div>
          </section>
        )}

        {/* Completed (qBittorrent) */}
        {completedTorrents.length > 0 && (
          <section>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Completed ({completedTorrents.length})
            </h2>
            <div className="space-y-3">
              {completedTorrents.map((torrent) => (
                <QbitTorrentItem
                  key={torrent.hash}
                  torrent={torrent}
                  onPauseResume={handleQbitPauseResume}
                  onDelete={handleQbitDelete}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
};

const QbitTorrentItem = ({ torrent, onPauseResume, onDelete }) => {
  const StatusIcon = statusIcons[torrent.state] || Clock;
  const isPaused = torrent.state.includes('paused');
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      data-testid={`torrent-${torrent.hash}`}
      className="glass-card rounded-xl p-4"
    >
      <div className="flex items-center gap-4">
        {/* Status Icon */}
        <div className={`w-10 h-10 rounded-lg bg-surface flex items-center justify-center ${statusColors[torrent.state] || 'text-gray-400'}`}>
          <StatusIcon className="w-5 h-5" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium truncate">{torrent.name}</h3>
            {torrent.category && (
              <span className="px-2 py-0.5 rounded text-xs bg-violet-600/20 text-violet-400 uppercase">
                {torrent.category}
              </span>
            )}
          </div>
          
          {/* Progress */}
          {torrent.progress < 100 && (
            <div className="mt-2">
              <Progress value={torrent.progress} className="h-2" />
              <div className="flex justify-between mt-1 text-xs text-gray-500">
                <span>{torrent.size_formatted}</span>
                <span>{torrent.progress.toFixed(1)}%</span>
              </div>
            </div>
          )}

          {/* Speed & Stats */}
          <div className="flex items-center gap-4 mt-1 text-sm">
            {torrent.is_downloading && torrent.dlspeed > 0 && (
              <span className="text-green-400">↓ {torrent.speed_formatted}</span>
            )}
            {torrent.upspeed > 0 && (
              <span className="text-purple-400">↑ {formatFileSize(torrent.upspeed)}/s</span>
            )}
            <span className="text-gray-500">Seeds: {torrent.seeds}</span>
            <span className="text-gray-500">Ratio: {torrent.ratio}</span>
          </div>

          {torrent.is_complete && (
            <p className="text-sm text-gray-500 mt-1">
              {torrent.size_formatted} • Completed
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onPauseResume(torrent)}
            className="hover:bg-white/10"
          >
            {isPaused ? (
              <Play className="w-4 h-4" />
            ) : (
              <Pause className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(torrent.hash, false)}
            className="hover:bg-red-500/20 text-red-400"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

const DownloadItem = ({ download, onPauseResume, onDelete }) => {
  const StatusIcon = statusIcons[download.status] || Clock;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      data-testid={`download-${download.id}`}
      className="glass-card rounded-xl p-4"
    >
      <div className="flex items-center gap-4">
        {/* Status Icon */}
        <div className={`w-10 h-10 rounded-lg bg-surface flex items-center justify-center ${statusColors[download.status]}`}>
          <StatusIcon className="w-5 h-5" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium truncate">{download.title}</h3>
            <span className="px-2 py-0.5 rounded text-xs bg-violet-600/20 text-violet-400 uppercase">
              {download.media_type}
            </span>
          </div>
          
          {/* Progress */}
          {download.status !== 'completed' && download.progress !== undefined && (
            <div className="mt-2">
              <Progress value={download.progress} className="h-2" />
              <div className="flex justify-between mt-1 text-xs text-gray-500">
                <span>{download.status === 'searching' ? 'Searching indexers...' : 'Queued'}</span>
                <span>{download.progress?.toFixed(1) || 0}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {download.status !== 'completed' && download.status !== 'searching' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onPauseResume(download)}
              className="hover:bg-white/10"
            >
              {download.status === 'paused' ? (
                <Play className="w-4 h-4" />
              ) : (
                <Pause className="w-4 h-4" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(download.id)}
            className="hover:bg-red-500/20 text-red-400"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default DownloadsPage;
