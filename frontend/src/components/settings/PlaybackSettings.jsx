import { useState, useEffect } from 'react';
import { BACKEND_URL } from '../../lib/config';
import { 
  Play, FastForward, SkipForward, Clock, Zap, 
  Settings2, RefreshCw, Check, AlertTriangle
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = BACKEND_URL;

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const PlaybackSettings = () => {
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
      const res = await axios.get(`${API_URL}/api/settings/playback`, {
        headers: getAuthHeader()
      });
      if (res.data) {
        setSettings(prev => ({ ...prev, ...res.data }));
      }
    } catch (err) {
      console.log('Using default playback settings');
    }
  };

  const checkChromaprint = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/system/chromaprint-status`, {
        headers: getAuthHeader()
      });
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
      const res = await axios.post(`${API_URL}/api/marmalade/analyze-all-intros`, {}, {
        headers: getAuthHeader()
      });
      toast.success(`Queued ${res.data.queued || 0} series for analysis`);
    } catch (err) {
      toast.error('Failed to start analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-8" data-testid="playback-settings">
      {/* Skip Intro/Credits Section */}
      <div className="glass-card rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FastForward className="w-5 h-5 text-violet-400" />
          Skip Intro & Credits
        </h3>
        <p className="text-sm text-gray-400 mb-6">
          Automatically detect and skip intros, credits, and recaps in TV shows.
        </p>

        <div className="space-y-6">
          {/* Auto-skip toggles */}
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

          {/* Skip button duration */}
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

      {/* Auto-Play Next Episode */}
      <div className="glass-card rounded-xl p-6">
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

      {/* Intro Detection Settings */}
      <div className="glass-card rounded-xl p-6">
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
              <div>
                <p className="font-medium">Checking status...</p>
              </div>
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

          {/* Analyze button */}
          <Button
            onClick={handleAnalyzeAllSeries}
            disabled={analyzing || chromaprintStatus !== 'installed'}
            className="w-full bg-violet-600 hover:bg-violet-700 h-12"
          >
            {analyzing ? (
              <>
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 mr-2" />
                Analyze All TV Series
              </>
            )}
          </Button>
          <p className="text-xs text-gray-500 text-center">
            This will scan all TV episodes to detect intro/credits segments using audio fingerprinting.
          </p>
        </div>
      </div>

      {/* Default Segment Timings */}
      <div className="glass-card rounded-xl p-6">
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
            <label className="text-sm text-gray-400 block mb-2">Credits Offset (seconds from end)</label>
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

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-violet-600 hover:bg-violet-700 px-8"
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default PlaybackSettings;
