import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { downloadsApi } from '../services/api';
import { toast } from 'sonner';
import { 
  Download, Pause, Play, Trash2, RefreshCw, 
  HardDrive, ArrowDown, ArrowUp, CheckCircle, AlertCircle, Clock
} from 'lucide-react';
import { formatFileSize } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';

const statusColors = {
  queued: 'text-gray-400',
  downloading: 'text-blue-400',
  seeding: 'text-green-400',
  completed: 'text-green-500',
  paused: 'text-yellow-400',
  error: 'text-red-400',
};

const statusIcons = {
  queued: Clock,
  downloading: ArrowDown,
  seeding: ArrowUp,
  completed: CheckCircle,
  paused: Pause,
  error: AlertCircle,
};

export const DownloadsPage = () => {
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDownloads();
    // Simulate download progress
    const interval = setInterval(simulateProgress, 2000);
    return () => clearInterval(interval);
  }, []);

  const fetchDownloads = async () => {
    try {
      const response = await downloadsApi.getAll();
      setDownloads(response.data || []);
    } catch (error) {
      console.error('Failed to fetch downloads:', error);
    } finally {
      setLoading(false);
    }
  };

  const simulateProgress = () => {
    setDownloads(prev => prev.map(dl => {
      if (dl.status === 'downloading' && dl.progress < 100) {
        const newProgress = Math.min(dl.progress + Math.random() * 5, 100);
        return {
          ...dl,
          progress: newProgress,
          downloaded: Math.floor(dl.size * newProgress / 100),
          speed: Math.floor(Math.random() * 10000000) + 1000000,
          status: newProgress >= 100 ? 'completed' : 'downloading',
        };
      }
      return dl;
    }));
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

  const activeDownloads = downloads.filter(d => d.status === 'downloading');
  const completedDownloads = downloads.filter(d => d.status === 'completed');
  const queuedDownloads = downloads.filter(d => d.status === 'queued' || d.status === 'paused');

  const totalSpeed = activeDownloads.reduce((sum, d) => sum + (d.speed || 0), 0);

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
                <p className="text-2xl font-bold text-blue-400">{activeDownloads.length}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">Speed</p>
                <p className="text-2xl font-bold text-green-400">{formatFileSize(totalSpeed)}/s</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">Completed</p>
                <p className="text-2xl font-bold">{completedDownloads.length}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Empty State */}
        {downloads.length === 0 && !loading && (
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
              Your download queue is empty. Browse movies and TV shows to add items to your download queue.
            </p>
          </motion.div>
        )}

        {/* Active Downloads */}
        {activeDownloads.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <ArrowDown className="w-5 h-5 text-blue-400" />
              Downloading ({activeDownloads.length})
            </h2>
            <div className="space-y-3">
              {activeDownloads.map((download) => (
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

        {/* Queued Downloads */}
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

        {/* Completed Downloads */}
        {completedDownloads.length > 0 && (
          <section>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Completed ({completedDownloads.length})
            </h2>
            <div className="space-y-3">
              {completedDownloads.map((download) => (
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

        {/* Mock Notice */}
        <div className="mt-8 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
          <p className="text-sm text-yellow-400">
            <strong>Demo Mode:</strong> Downloads are simulated. Configure indexers in Settings to enable real downloads.
          </p>
        </div>
      </div>
    </Layout>
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
          {download.status !== 'completed' && (
            <div className="mt-2">
              <Progress value={download.progress} className="h-2" />
              <div className="flex justify-between mt-1 text-xs text-gray-500">
                <span>{formatFileSize(download.downloaded)} / {formatFileSize(download.size)}</span>
                <span>{download.progress.toFixed(1)}%</span>
              </div>
            </div>
          )}

          {/* Speed */}
          {download.status === 'downloading' && download.speed > 0 && (
            <p className="text-sm text-green-400 mt-1 mono">
              {formatFileSize(download.speed)}/s
            </p>
          )}

          {download.status === 'completed' && (
            <p className="text-sm text-gray-500 mt-1">
              {formatFileSize(download.size)} • Completed
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {download.status !== 'completed' && (
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
