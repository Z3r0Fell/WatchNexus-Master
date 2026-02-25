import { useState, useEffect, useCallback } from 'react';
import { BACKEND_URL } from '../../lib/config';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, FastForward, SkipForward, Clock, Zap, 
  Settings2, RefreshCw, Check, AlertTriangle, Volume2, Maximize,
  History, Trash2, Film, Tv, X, AlertCircle
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { toast } from 'sonner';
import axios from 'axios';
import { SettingsTabHeader, SettingsTabContent } from './SettingsTabHeader';
import { progressApi } from '../../services/api';

const API_URL = BACKEND_URL;

// Tabs for Playback Settings
const PLAYBACK_TABS = [
  { id: 'skip', label: 'Skip Intro/Credits', icon: FastForward },
  { id: 'autoplay', label: 'Auto-Play', icon: SkipForward },
  { id: 'detection', label: 'Detection Engine', icon: Zap },
  { id: 'player', label: 'Player Options', icon: Play },
  { id: 'history', label: 'Watch History', icon: History },
];

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const PlaybackSettings = () => {
  const [activeTab, setActiveTab] = useState('skip');
  const [settings, setSettings] = useState({
    auto_skip_intro: false,
    auto_skip_credits: false,
    skip_button_duration: 5,
    intro_detection_enabled: true,
    credits_detection_enabled: true,
    default_intro_start: 0,
    default_intro_end: 90,
    default_credits_offset: 90,
    auto_play_next: true,
    next_episode_countdown: 15,
    default_volume: 100,
    remember_volume: true,
    default_quality: 'auto',
    theater_mode: false,
  });
  
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [chromaprintStatus, setChromaprintStatus] = useState('unknown');

  useEffect(() => {
    fetchSettings();
    checkChromaprint();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/settings/playback`, { headers: getAuthHeader() });
      if (res.data) setSettings(prev => ({ ...prev, ...res.data }));
    } catch (err) {
      console.log('Using default playback settings');
    }
  };

  const checkChromaprint = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/system/chromaprint-status`, { headers: getAuthHeader() });
      setChromaprintStatus(res.data.installed ? 'installed' : 'not_installed');
    } catch {
      setChromaprintStatus('unknown');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/settings/playback`, settings, {
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' }
      });
      toast.success('Playback settings saved');
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleAnalyzeAllSeries = async () => {
    setAnalyzing(true);
    try {
      const res = await axios.post(`${API_URL}/api/marmalade/analyze-all-intros`, {}, { headers: getAuthHeader() });
      toast.success(`Queued ${res.data.queued || 0} series for analysis`);
    } catch (err) {
      toast.error('Failed to start analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'skip':
        return <SkipTab settings={settings} setSettings={setSettings} />;
      case 'autoplay':
        return <AutoplayTab settings={settings} setSettings={setSettings} />;
      case 'detection':
        return (
          <DetectionTab 
            settings={settings} 
            setSettings={setSettings}
            chromaprintStatus={chromaprintStatus}
            analyzing={analyzing}
            handleAnalyzeAllSeries={handleAnalyzeAllSeries}
          />
        );
      case 'player':
        return <PlayerTab settings={settings} setSettings={setSettings} />;
      case 'history':
        return <HistoryTab />;
      default:
        return null;
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6" data-testid="playback-settings">
      <SettingsTabHeader
        title="Playback Settings"
        subtitle="Configure video playback, skip behavior, and detection"
        icon={Play}
        tabs={PLAYBACK_TABS}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        iconBgColor="from-green-600 to-emerald-500"
      />

      <SettingsTabContent activeTab={activeTab}>
        {renderTabContent()}
      </SettingsTabContent>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700 px-8">
          {saving ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><Check className="w-4 h-4 mr-2" />Save Settings</>}
        </Button>
      </div>
    </motion.div>
  );
};

// Skip Tab
const SkipTab = ({ settings, setSettings }) => (
  <div className="space-y-6">
    <div className="bg-surface border border-white/10 rounded-2xl p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <FastForward className="w-5 h-5 text-violet-400" />
        Skip Intro & Credits
      </h3>
      <p className="text-sm text-gray-400 mb-6">
        Automatically detect and skip intros, credits, and recaps in TV shows.
      </p>

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between p-4 rounded-lg bg-white/5">
            <div>
              <p className="font-medium">Auto-skip Intros</p>
              <p className="text-xs text-gray-500">Automatically skip intro sequences</p>
            </div>
            <Switch
              checked={settings.auto_skip_intro}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, auto_skip_intro: checked }))}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-white/5">
            <div>
              <p className="font-medium">Auto-skip Credits</p>
              <p className="text-xs text-gray-500">Automatically skip end credits</p>
            </div>
            <Switch
              checked={settings.auto_skip_credits}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, auto_skip_credits: checked }))}
            />
          </div>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-lg bg-white/5">
          <div className="flex-1">
            <p className="font-medium">Skip Button Display Time</p>
            <p className="text-xs text-gray-500">How long the skip button stays visible (seconds)</p>
          </div>
          <Input
            type="number"
            min="3"
            max="15"
            value={settings.skip_button_duration}
            onChange={(e) => setSettings(prev => ({ ...prev, skip_button_duration: parseInt(e.target.value) || 5 }))}
            className="w-20 bg-white/5 border-white/10"
          />
        </div>
      </div>
    </div>

    {/* Default Segment Timings */}
    <div className="bg-surface border border-white/10 rounded-2xl p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-violet-400" />
        Default Segment Timings
      </h3>
      <p className="text-sm text-gray-400 mb-6">
        Fallback timings used when automatic detection is unavailable.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="p-4 rounded-lg bg-white/5">
          <label className="text-sm text-gray-400 block mb-2">Intro Start (seconds)</label>
          <Input
            type="number"
            min="0"
            max="300"
            value={settings.default_intro_start}
            onChange={(e) => setSettings(prev => ({ ...prev, default_intro_start: parseInt(e.target.value) || 0 }))}
            className="bg-white/5 border-white/10"
          />
        </div>

        <div className="p-4 rounded-lg bg-white/5">
          <label className="text-sm text-gray-400 block mb-2">Intro End (seconds)</label>
          <Input
            type="number"
            min="0"
            max="300"
            value={settings.default_intro_end}
            onChange={(e) => setSettings(prev => ({ ...prev, default_intro_end: parseInt(e.target.value) || 90 }))}
            className="bg-white/5 border-white/10"
          />
        </div>

        <div className="p-4 rounded-lg bg-white/5">
          <label className="text-sm text-gray-400 block mb-2">Credits Offset (from end)</label>
          <Input
            type="number"
            min="0"
            max="300"
            value={settings.default_credits_offset}
            onChange={(e) => setSettings(prev => ({ ...prev, default_credits_offset: parseInt(e.target.value) || 90 }))}
            className="bg-white/5 border-white/10"
          />
        </div>
      </div>
    </div>
  </div>
);

// Autoplay Tab
const AutoplayTab = ({ settings, setSettings }) => (
  <div className="space-y-6">
    <div className="bg-surface border border-white/10 rounded-2xl p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <SkipForward className="w-5 h-5 text-violet-400" />
        Auto-Play Next Episode
      </h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg bg-white/5">
          <div>
            <p className="font-medium">Auto-play Next Episode</p>
            <p className="text-xs text-gray-500">Automatically play the next episode when one ends</p>
          </div>
          <Switch
            checked={settings.auto_play_next}
            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, auto_play_next: checked }))}
          />
        </div>

        {settings.auto_play_next && (
          <div className="flex items-center gap-4 p-4 rounded-lg bg-white/5">
            <div className="flex-1">
              <p className="font-medium">Countdown Duration</p>
              <p className="text-xs text-gray-500">Seconds before auto-playing next episode</p>
            </div>
            <Input
              type="number"
              min="5"
              max="60"
              value={settings.next_episode_countdown}
              onChange={(e) => setSettings(prev => ({ ...prev, next_episode_countdown: parseInt(e.target.value) || 15 }))}
              className="w-20 bg-white/5 border-white/10"
            />
          </div>
        )}
      </div>
    </div>
  </div>
);

// Detection Tab
const DetectionTab = ({ settings, setSettings, chromaprintStatus, analyzing, handleAnalyzeAllSeries }) => (
  <div className="space-y-6">
    <div className="bg-surface border border-white/10 rounded-2xl p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Zap className="w-5 h-5 text-violet-400" />
        Intro Detection (Chromaprint)
      </h3>

      {/* Chromaprint status */}
      <div className={`flex items-center gap-3 p-4 rounded-lg mb-6 ${
        chromaprintStatus === 'installed' ? 'bg-green-500/10 border border-green-500/20' :
        chromaprintStatus === 'not_installed' ? 'bg-yellow-500/10 border border-yellow-500/20' :
        'bg-white/5'
      }`}>
        {chromaprintStatus === 'installed' ? (
          <>
            <Check className="w-5 h-5 text-green-400" />
            <div>
              <p className="font-medium text-green-400">Chromaprint Installed</p>
              <p className="text-xs text-gray-400">Audio fingerprinting is available for automatic intro detection</p>
            </div>
          </>
        ) : chromaprintStatus === 'not_installed' ? (
          <>
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <div>
              <p className="font-medium text-yellow-400">Chromaprint Not Found</p>
              <p className="text-xs text-gray-400">Install fpcalc for automatic audio fingerprint-based intro detection</p>
            </div>
          </>
        ) : (
          <>
            <Clock className="w-5 h-5 text-gray-400" />
            <div><p className="font-medium">Checking status...</p></div>
          </>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg bg-white/5">
          <div>
            <p className="font-medium">Enable Intro Detection</p>
            <p className="text-xs text-gray-500">Analyze audio to detect intro sequences</p>
          </div>
          <Switch
            checked={settings.intro_detection_enabled}
            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, intro_detection_enabled: checked }))}
          />
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg bg-white/5">
          <div>
            <p className="font-medium">Enable Credits Detection</p>
            <p className="text-xs text-gray-500">Analyze audio to detect end credits</p>
          </div>
          <Switch
            checked={settings.credits_detection_enabled}
            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, credits_detection_enabled: checked }))}
          />
        </div>

        <Button
          onClick={handleAnalyzeAllSeries}
          disabled={analyzing || chromaprintStatus !== 'installed'}
          className="w-full bg-violet-600 hover:bg-violet-700 h-12"
        >
          {analyzing ? <><RefreshCw className="w-5 h-5 mr-2 animate-spin" />Analyzing...</> : <><Zap className="w-5 h-5 mr-2" />Analyze All TV Series</>}
        </Button>
        <p className="text-xs text-gray-500 text-center">
          This will scan all TV episodes to detect intro/credits segments using audio fingerprinting.
        </p>
      </div>
    </div>
  </div>
);

// Player Tab
const PlayerTab = ({ settings, setSettings }) => (
  <div className="space-y-6">
    <div className="bg-surface border border-white/10 rounded-2xl p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Volume2 className="w-5 h-5 text-violet-400" />
        Audio Settings
      </h3>

      <div className="space-y-4">
        <div className="flex items-center gap-4 p-4 rounded-lg bg-white/5">
          <div className="flex-1">
            <p className="font-medium">Default Volume</p>
            <p className="text-xs text-gray-500">Initial volume level (0-100)</p>
          </div>
          <Input
            type="number"
            min="0"
            max="100"
            value={settings.default_volume || 100}
            onChange={(e) => setSettings(prev => ({ ...prev, default_volume: parseInt(e.target.value) || 100 }))}
            className="w-20 bg-white/5 border-white/10"
          />
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg bg-white/5">
          <div>
            <p className="font-medium">Remember Volume</p>
            <p className="text-xs text-gray-500">Save volume level between sessions</p>
          </div>
          <Switch
            checked={settings.remember_volume ?? true}
            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, remember_volume: checked }))}
          />
        </div>
      </div>
    </div>

    <div className="bg-surface border border-white/10 rounded-2xl p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Maximize className="w-5 h-5 text-violet-400" />
        Display Options
      </h3>

      <div className="space-y-4">
        <div className="p-4 rounded-lg bg-white/5">
          <label className="text-sm text-gray-400 block mb-2">Default Quality</label>
          <select
            value={settings.default_quality || 'auto'}
            onChange={(e) => setSettings(prev => ({ ...prev, default_quality: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
          >
            <option value="auto">Auto (Adaptive)</option>
            <option value="4k">4K / 2160p</option>
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
            <option value="480p">480p</option>
          </select>
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg bg-white/5">
          <div>
            <p className="font-medium">Theater Mode by Default</p>
            <p className="text-xs text-gray-500">Start videos in theater mode</p>
          </div>
          <Switch
            checked={settings.theater_mode ?? false}
            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, theater_mode: checked }))}
          />
        </div>
      </div>
    </div>
  </div>
);

// History Tab - Watch History Management
const HistoryTab = () => {
  const [watchHistory, setWatchHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  const fetchWatchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await progressApi.get();
      setWatchHistory(res.data || []);
    } catch (err) {
      console.error('Failed to fetch watch history:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWatchHistory();
  }, [fetchWatchHistory]);

  const handleRemoveItem = async (item) => {
    try {
      await progressApi.delete(item.tmdb_id, item.media_type, item.season, item.episode);
      setWatchHistory(prev => prev.filter(h => 
        !(h.tmdb_id === item.tmdb_id && h.season === item.season && h.episode === item.episode)
      ));
      toast.success(`Removed "${item.title}" from history`);
    } catch (err) {
      toast.error('Failed to remove item');
    }
  };

  const handleClearAll = async () => {
    setClearing(true);
    try {
      await progressApi.clearAll();
      setWatchHistory([]);
      setShowClearAllConfirm(false);
      toast.success('Watch history cleared');
    } catch (err) {
      toast.error('Failed to clear watch history');
    } finally {
      setClearing(false);
    }
  };

  const formatTime = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <History className="w-5 h-5 text-violet-400" />
              Watch History
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              {watchHistory.length} item{watchHistory.length !== 1 ? 's' : ''} in your watch history
            </p>
          </div>
          <Button 
            onClick={() => setShowClearAllConfirm(true)} 
            variant="outline" 
            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            disabled={watchHistory.length === 0}
            data-testid="clear-all-history-btn"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear All History
          </Button>
        </div>

        {/* Clear All Confirmation Dialog */}
        <AnimatePresence>
          {showClearAllConfirm && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 overflow-hidden"
            >
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-red-400">Clear All Watch History?</h4>
                    <p className="text-sm text-gray-400 mt-1">
                      This will permanently delete your entire watch history including all progress for movies and TV shows. 
                      This action cannot be undone.
                    </p>
                    <div className="flex gap-3 mt-4">
                      <Button 
                        onClick={handleClearAll}
                        disabled={clearing}
                        className="bg-red-600 hover:bg-red-700"
                        data-testid="confirm-clear-all-btn"
                      >
                        {clearing ? (
                          <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Clearing...</>
                        ) : (
                          <><Trash2 className="w-4 h-4 mr-2" />Yes, Clear Everything</>
                        )}
                      </Button>
                      <Button 
                        onClick={() => setShowClearAllConfirm(false)}
                        variant="outline"
                        className="border-white/20"
                        data-testid="cancel-clear-all-btn"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* History List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-violet-400" />
          </div>
        ) : watchHistory.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No watch history</p>
            <p className="text-sm text-gray-500">Items you watch will appear here</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
            {watchHistory.map((item, index) => (
              <motion.div 
                key={`${item.tmdb_id}-${item.season || ''}-${item.episode || ''}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.02 }}
                className="p-3 rounded-xl bg-black/30 border border-white/5 hover:border-white/10 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  {/* Thumbnail */}
                  <div className="w-16 h-10 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                    {item.backdrop_path ? (
                      <img 
                        src={`https://image.tmdb.org/t/p/w200${item.backdrop_path}`} 
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {item.media_type === 'tv' ? <Tv className="w-5 h-5 text-gray-600" /> : <Film className="w-5 h-5 text-gray-600" />}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{item.title}</p>
                      <span className={`px-1.5 py-0.5 rounded text-xs ${item.media_type === 'tv' ? 'bg-blue-500/20 text-blue-400' : 'bg-violet-500/20 text-violet-400'}`}>
                        {item.media_type === 'tv' ? 'TV' : 'Movie'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      {item.season && item.episode && (
                        <span>S{item.season} E{item.episode}</span>
                      )}
                      <span>{formatTime(item.current_time)} / {formatTime(item.duration)}</span>
                      <span className="text-violet-400">{item.progress?.toFixed(0) || 0}%</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden hidden sm:block">
                    <div 
                      className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full"
                      style={{ width: `${item.progress || 0}%` }}
                    />
                  </div>

                  {/* Remove button */}
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleRemoveItem(item)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:bg-red-500/10 p-2"
                    data-testid={`remove-history-${item.tmdb_id}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
        <p className="text-sm text-blue-400">
          <strong>Tip:</strong> You can also remove items from the Continue Watching section on your dashboard by hovering and clicking the X.
        </p>
      </div>
    </div>
  );
};

export default PlaybackSettings;
