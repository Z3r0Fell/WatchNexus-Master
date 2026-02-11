import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { 
  Video, Calendar, Clock, Play, Pause, Square, Trash2, Plus,
  RefreshCw, AlertTriangle, Check, X, HardDrive, Settings,
  ChevronRight, Radio, Film, Tv, Search
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// DVR Recording status
const RecordingStatus = {
  SCHEDULED: 'scheduled',
  RECORDING: 'recording',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

// Sample recordings (in production, this would come from backend)
const sampleRecordings = [
  {
    id: '1',
    title: 'Evening News',
    channel_name: 'CNN',
    channel_id: 'cnn',
    start_time: new Date(Date.now() + 3600000).toISOString(),
    end_time: new Date(Date.now() + 7200000).toISOString(),
    duration: 60,
    status: RecordingStatus.SCHEDULED,
    series_recording: false,
    file_path: null,
    file_size: null,
  },
  {
    id: '2',
    title: 'Monday Night Football',
    channel_name: 'ESPN',
    channel_id: 'espn',
    start_time: new Date(Date.now() - 1800000).toISOString(),
    end_time: new Date(Date.now() + 5400000).toISOString(),
    duration: 180,
    status: RecordingStatus.RECORDING,
    series_recording: true,
    file_path: null,
    file_size: '2.3 GB',
    progress: 45,
  },
  {
    id: '3',
    title: 'The Late Show',
    channel_name: 'CBS',
    channel_id: 'cbs',
    start_time: new Date(Date.now() - 86400000).toISOString(),
    end_time: new Date(Date.now() - 82800000).toISOString(),
    duration: 60,
    status: RecordingStatus.COMPLETED,
    series_recording: true,
    file_path: '/recordings/late_show_20250211.mp4',
    file_size: '1.8 GB',
  },
  {
    id: '4',
    title: 'Nature Documentary',
    channel_name: 'Discovery',
    channel_id: 'discovery',
    start_time: new Date(Date.now() - 172800000).toISOString(),
    end_time: new Date(Date.now() - 165600000).toISOString(),
    duration: 120,
    status: RecordingStatus.COMPLETED,
    series_recording: false,
    file_path: '/recordings/nature_doc_20250209.mp4',
    file_size: '3.2 GB',
  },
  {
    id: '5',
    title: 'Morning News',
    channel_name: 'NBC',
    channel_id: 'nbc',
    start_time: new Date(Date.now() - 259200000).toISOString(),
    end_time: new Date(Date.now() - 255600000).toISOString(),
    duration: 60,
    status: RecordingStatus.FAILED,
    series_recording: false,
    file_path: null,
    file_size: null,
    error: 'Stream unavailable',
  },
];

// DVR Settings
const defaultSettings = {
  recording_path: '/media/recordings',
  max_concurrent: 2,
  pre_padding: 5, // minutes before
  post_padding: 10, // minutes after
  auto_delete_watched: false,
  delete_after_days: 30,
  quality: 'original',
  format: 'mp4',
};

export const DVRPage = () => {
  const [recordings, setRecordings] = useState(sampleRecordings);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [showNewRecording, setShowNewRecording] = useState(false);
  const [settings, setSettings] = useState(defaultSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // New recording form
  const [newRecording, setNewRecording] = useState({
    channel_id: '',
    title: '',
    start_time: '',
    duration: 60,
    series_recording: false,
  });

  const getToken = () => localStorage.getItem('watchnexus_token');

  // Fetch IPTV channels for recording selection
  const fetchChannels = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/iptv/channels`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setChannels(res.data || []);
    } catch (err) {
      console.error('Failed to fetch channels:', err);
    }
  }, []);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Filter recordings by status
  const upcomingRecordings = recordings.filter(r => r.status === RecordingStatus.SCHEDULED);
  const activeRecordings = recordings.filter(r => r.status === RecordingStatus.RECORDING);
  const completedRecordings = recordings.filter(r => r.status === RecordingStatus.COMPLETED);
  const failedRecordings = recordings.filter(r => r.status === RecordingStatus.FAILED);

  // Search filter
  const filteredRecordings = (list) => {
    if (!searchQuery) return list;
    return list.filter(r => 
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.channel_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  // Handle new recording
  const handleCreateRecording = async (e) => {
    e.preventDefault();
    
    if (!newRecording.channel_id || !newRecording.title || !newRecording.start_time) {
      toast.error('Please fill in all required fields');
      return;
    }

    const channel = channels.find(c => c.id === newRecording.channel_id);
    const recording = {
      id: Date.now().toString(),
      ...newRecording,
      channel_name: channel?.name || 'Unknown',
      end_time: new Date(new Date(newRecording.start_time).getTime() + newRecording.duration * 60000).toISOString(),
      status: RecordingStatus.SCHEDULED,
      file_path: null,
      file_size: null,
    };

    setRecordings([...recordings, recording]);
    toast.success('Recording scheduled!');
    setShowNewRecording(false);
    setNewRecording({ channel_id: '', title: '', start_time: '', duration: 60, series_recording: false });
  };

  // Handle cancel/delete recording
  const handleCancelRecording = (recordingId) => {
    const recording = recordings.find(r => r.id === recordingId);
    if (recording.status === RecordingStatus.RECORDING) {
      if (!confirm('Stop this recording in progress?')) return;
    }
    
    setRecordings(recordings.filter(r => r.id !== recordingId));
    toast.success('Recording cancelled');
  };

  // Handle delete completed recording
  const handleDeleteRecording = (recordingId) => {
    if (!confirm('Delete this recording? The file will be removed.')) return;
    setRecordings(recordings.filter(r => r.id !== recordingId));
    toast.success('Recording deleted');
  };

  // Format duration
  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  // Recording Card Component
  const RecordingCard = ({ recording }) => {
    const isActive = recording.status === RecordingStatus.RECORDING;
    const isCompleted = recording.status === RecordingStatus.COMPLETED;
    const isFailed = recording.status === RecordingStatus.FAILED;
    const startTime = new Date(recording.start_time);
    const endTime = new Date(recording.end_time);

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-4 rounded-xl bg-surface border ${
          isActive ? 'border-red-500/50' : isFailed ? 'border-orange-500/50' : 'border-white/5'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              isActive ? 'bg-red-500/20' : isCompleted ? 'bg-green-500/20' : isFailed ? 'bg-orange-500/20' : 'bg-violet-500/20'
            }`}>
              {isActive ? (
                <div className="relative">
                  <Video className="w-6 h-6 text-red-400" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                </div>
              ) : isCompleted ? (
                <Check className="w-6 h-6 text-green-400" />
              ) : isFailed ? (
                <AlertTriangle className="w-6 h-6 text-orange-400" />
              ) : (
                <Calendar className="w-6 h-6 text-violet-400" />
              )}
            </div>
            
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{recording.title}</h3>
                {recording.series_recording && (
                  <span className="px-2 py-0.5 rounded bg-violet-500/20 text-violet-400 text-xs">Series</span>
                )}
              </div>
              <p className="text-sm text-gray-500">{recording.channel_name}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {startTime.toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                  {endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span>{formatDuration(recording.duration)}</span>
              </div>
              
              {/* Progress bar for active recordings */}
              {isActive && recording.progress && (
                <div className="mt-3">
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-red-500 rounded-full transition-all"
                      style={{ width: `${recording.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {recording.progress}% • {recording.file_size}
                  </p>
                </div>
              )}

              {/* File info for completed */}
              {isCompleted && recording.file_size && (
                <p className="text-xs text-gray-500 mt-2">
                  <HardDrive className="w-3 h-3 inline mr-1" />
                  {recording.file_size}
                </p>
              )}

              {/* Error message */}
              {isFailed && recording.error && (
                <p className="text-xs text-orange-400 mt-2">
                  Error: {recording.error}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isCompleted && (
              <Button size="sm" variant="outline">
                <Play className="w-4 h-4 mr-1" />
                Play
              </Button>
            )}
            {isActive && (
              <Button
                size="sm"
                variant="outline"
                className="text-red-400 hover:text-red-300"
                onClick={() => handleCancelRecording(recording.id)}
              >
                <Square className="w-4 h-4 mr-1" />
                Stop
              </Button>
            )}
            {!isActive && !isCompleted && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleCancelRecording(recording.id)}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
            {isCompleted && (
              <Button
                size="sm"
                variant="ghost"
                className="text-red-400"
                onClick={() => handleDeleteRecording(recording.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <Layout>
      <div data-testid="dvr-page" className="min-h-screen p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-600 to-rose-500 flex items-center justify-center">
                <Video className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  DVR Recording
                  <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">Relish DVR 📺</span>
                </h1>
                <p className="text-gray-400">Schedule and manage TV recordings</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => setShowSettings(true)}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
              <Button 
                className="bg-gradient-to-r from-red-600 to-rose-500"
                onClick={() => setShowNewRecording(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                New Recording
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-4 gap-4 mb-8"
        >
          <div className="p-4 rounded-xl bg-surface border border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{upcomingRecordings.length}</p>
                <p className="text-xs text-gray-500">Scheduled</p>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-surface border border-red-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <Video className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeRecordings.length}</p>
                <p className="text-xs text-gray-500">Recording</p>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-surface border border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Check className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedRecordings.length}</p>
                <p className="text-xs text-gray-500">Completed</p>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-surface border border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-500/20 flex items-center justify-center">
                <HardDrive className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">12.4 GB</p>
                <p className="text-xs text-gray-500">Storage Used</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6"
        >
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search recordings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="upcoming" className="space-y-6">
          <TabsList className="bg-surface border border-white/10">
            <TabsTrigger value="upcoming" className="data-[state=active]:bg-red-600">
              Upcoming ({upcomingRecordings.length})
            </TabsTrigger>
            <TabsTrigger value="active" className="data-[state=active]:bg-red-600">
              Recording ({activeRecordings.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="data-[state=active]:bg-red-600">
              Completed ({completedRecordings.length})
            </TabsTrigger>
            <TabsTrigger value="failed" className="data-[state=active]:bg-red-600">
              Failed ({failedRecordings.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              {filteredRecordings(upcomingRecordings).length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                  <h3 className="font-medium mb-2">No Upcoming Recordings</h3>
                  <p className="text-gray-400 text-sm mb-4">Schedule a recording from the TV Guide or click "New Recording"</p>
                  <Button onClick={() => setShowNewRecording(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Schedule Recording
                  </Button>
                </div>
              ) : (
                filteredRecordings(upcomingRecordings).map(recording => (
                  <RecordingCard key={recording.id} recording={recording} />
                ))
              )}
            </motion.div>
          </TabsContent>

          <TabsContent value="active">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              {filteredRecordings(activeRecordings).length === 0 ? (
                <div className="text-center py-12">
                  <Video className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                  <h3 className="font-medium mb-2">No Active Recordings</h3>
                  <p className="text-gray-400 text-sm">Scheduled recordings will appear here when they start</p>
                </div>
              ) : (
                filteredRecordings(activeRecordings).map(recording => (
                  <RecordingCard key={recording.id} recording={recording} />
                ))
              )}
            </motion.div>
          </TabsContent>

          <TabsContent value="completed">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              {filteredRecordings(completedRecordings).length === 0 ? (
                <div className="text-center py-12">
                  <Check className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                  <h3 className="font-medium mb-2">No Completed Recordings</h3>
                  <p className="text-gray-400 text-sm">Finished recordings will appear here</p>
                </div>
              ) : (
                filteredRecordings(completedRecordings).map(recording => (
                  <RecordingCard key={recording.id} recording={recording} />
                ))
              )}
            </motion.div>
          </TabsContent>

          <TabsContent value="failed">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              {filteredRecordings(failedRecordings).length === 0 ? (
                <div className="text-center py-12">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                  <h3 className="font-medium mb-2">No Failed Recordings</h3>
                  <p className="text-gray-400 text-sm">Recordings that fail to complete will appear here</p>
                </div>
              ) : (
                filteredRecordings(failedRecordings).map(recording => (
                  <RecordingCard key={recording.id} recording={recording} />
                ))
              )}
            </motion.div>
          </TabsContent>
        </Tabs>

        {/* New Recording Modal */}
        <AnimatePresence>
          {showNewRecording && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setShowNewRecording(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-md bg-surface rounded-2xl border border-white/10 p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Schedule Recording</h2>
                  <button onClick={() => setShowNewRecording(false)} className="text-gray-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateRecording} className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Title</label>
                    <Input
                      value={newRecording.title}
                      onChange={(e) => setNewRecording({ ...newRecording, title: e.target.value })}
                      placeholder="Recording name"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Channel</label>
                    <select
                      value={newRecording.channel_id}
                      onChange={(e) => setNewRecording({ ...newRecording, channel_id: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white"
                      required
                    >
                      <option value="">Select channel...</option>
                      {channels.map(channel => (
                        <option key={channel.id} value={channel.id}>{channel.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Start Time</label>
                    <Input
                      type="datetime-local"
                      value={newRecording.start_time}
                      onChange={(e) => setNewRecording({ ...newRecording, start_time: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Duration (minutes)</label>
                    <Input
                      type="number"
                      value={newRecording.duration}
                      onChange={(e) => setNewRecording({ ...newRecording, duration: parseInt(e.target.value) })}
                      min={5}
                      max={480}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-400">Record all episodes (series)</label>
                    <Switch
                      checked={newRecording.series_recording}
                      onCheckedChange={(checked) => setNewRecording({ ...newRecording, series_recording: checked })}
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowNewRecording(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1 bg-gradient-to-r from-red-600 to-rose-500">
                      <Calendar className="w-4 h-4 mr-2" />
                      Schedule
                    </Button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings Modal */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setShowSettings(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-md bg-surface rounded-2xl border border-white/10 p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">DVR Settings</h2>
                  <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Recording Path</label>
                    <Input
                      value={settings.recording_path}
                      onChange={(e) => setSettings({ ...settings, recording_path: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Max Concurrent Recordings</label>
                    <Input
                      type="number"
                      value={settings.max_concurrent}
                      onChange={(e) => setSettings({ ...settings, max_concurrent: parseInt(e.target.value) })}
                      min={1}
                      max={5}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">Pre-padding (min)</label>
                      <Input
                        type="number"
                        value={settings.pre_padding}
                        onChange={(e) => setSettings({ ...settings, pre_padding: parseInt(e.target.value) })}
                        min={0}
                        max={30}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">Post-padding (min)</label>
                      <Input
                        type="number"
                        value={settings.post_padding}
                        onChange={(e) => setSettings({ ...settings, post_padding: parseInt(e.target.value) })}
                        min={0}
                        max={60}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Quality</label>
                    <select
                      value={settings.quality}
                      onChange={(e) => setSettings({ ...settings, quality: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white"
                    >
                      <option value="original">Original Quality</option>
                      <option value="1080p">1080p</option>
                      <option value="720p">720p</option>
                      <option value="480p">480p</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-400">Auto-delete watched recordings</label>
                    <Switch
                      checked={settings.auto_delete_watched}
                      onCheckedChange={(checked) => setSettings({ ...settings, auto_delete_watched: checked })}
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowSettings(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      className="flex-1 bg-gradient-to-r from-red-600 to-rose-500"
                      onClick={() => {
                        toast.success('Settings saved');
                        setShowSettings(false);
                      }}
                    >
                      Save Settings
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
};
