import { useState, useEffect, useCallback } from 'react';
import { motion, Reorder } from 'framer-motion';
import { Captions, GripVertical, Check, Plus, Trash2, Settings, RefreshCw, TestTube } from 'lucide-react';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { toast } from 'sonner';
import { BACKEND_URL } from '../../lib/config';
import axios from 'axios';

// Subtitle service providers
const SUBTITLE_PROVIDERS = [
  { id: 'opensubtitles', name: 'OpenSubtitles', description: 'World\'s largest subtitle database', icon: '🎬', requiresAuth: true },
  { id: 'addic7ed', name: 'Addic7ed', description: 'Community-driven TV show subtitles', icon: '📺', requiresAuth: true },
  { id: 'podnapisi', name: 'Podnapisi', description: 'Slovenian-based multilingual database', icon: '🌐', requiresAuth: false },
  { id: 'subscene', name: 'Subscene', description: 'User-submitted subtitles', icon: '📝', requiresAuth: false },
  { id: 'yifysubtitles', name: 'YIFY Subtitles', description: 'YIFY movie subtitles', icon: '🎥', requiresAuth: false },
];

const LANGUAGES = [
  { code: 'en', name: 'English' }, { code: 'es', name: 'Spanish' }, { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' }, { code: 'it', name: 'Italian' }, { code: 'pt', name: 'Portuguese' },
  { code: 'ja', name: 'Japanese' }, { code: 'ko', name: 'Korean' }, { code: 'zh', name: 'Chinese' },
  { code: 'ar', name: 'Arabic' }, { code: 'ru', name: 'Russian' }, { code: 'hi', name: 'Hindi' },
  { code: 'pl', name: 'Polish' }, { code: 'nl', name: 'Dutch' }, { code: 'sv', name: 'Swedish' },
];

export const SubtitleSettings = () => {
  const [settings, setSettings] = useState({
    auto_subtitles: true,
    subtitle_languages: ['en'],
    providers: [],
    provider_configs: {}
  });
  const [providerOrder, setProviderOrder] = useState([]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(null);
  const [showAddProvider, setShowAddProvider] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/garnish/settings`);
      if (res.data) {
        setSettings(res.data);
        setProviderOrder(res.data.providers || []);
      }
    } catch (err) {
      console.error('Failed to fetch subtitle settings:', err);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post(`${BACKEND_URL}/api/garnish/settings`, {
        ...settings,
        providers: providerOrder
      });
      toast.success('Subtitle settings saved');
    } catch { toast.error('Failed to save settings'); }
    finally { setSaving(false); }
  };

  const handleAddProvider = (providerId) => {
    if (!providerOrder.includes(providerId)) {
      setProviderOrder([...providerOrder, providerId]);
      setShowAddProvider(false);
    }
  };

  const handleRemoveProvider = (providerId) => {
    setProviderOrder(providerOrder.filter(id => id !== providerId));
  };

  const handleTestProvider = async (providerId) => {
    setTesting(providerId);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/garnish/test/${providerId}`);
      if (res.data.success) {
        toast.success(`${providerId} is working!`);
      } else {
        toast.error(`${providerId} test failed: ${res.data.error}`);
      }
    } catch (err) {
      toast.error(`Failed to test ${providerId}`);
    }
    setTesting(null);
  };

  const handleProviderConfig = (providerId, key, value) => {
    setSettings(prev => ({
      ...prev,
      provider_configs: {
        ...prev.provider_configs,
        [providerId]: {
          ...prev.provider_configs?.[providerId],
          [key]: value
        }
      }
    }));
  };

  const handleLanguageToggle = (langCode) => {
    setSettings(prev => ({
      ...prev,
      subtitle_languages: prev.subtitle_languages.includes(langCode)
        ? prev.subtitle_languages.filter(l => l !== langCode)
        : [...prev.subtitle_languages, langCode]
    }));
  };

  const availableProviders = SUBTITLE_PROVIDERS.filter(p => !providerOrder.includes(p.id));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="subtitle-settings">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Captions className="w-5 h-5 text-green-400" /> Subtitle Settings
            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Garnish</span>
          </h2>
          <p className="text-gray-400 text-sm mt-1">Configure subtitle providers and language preferences</p>
        </div>
      </div>

      {/* Auto-download toggle */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Auto-download Subtitles</p>
            <p className="text-sm text-gray-500">Automatically fetch subtitles when media is added</p>
          </div>
          <Switch
            checked={settings.auto_subtitles}
            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, auto_subtitles: checked }))}
          />
        </div>
      </div>

      {/* Provider Priority */}
      <div className="glass-card rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium flex items-center gap-2">
              <Settings className="w-4 h-4 text-gray-400" /> Provider Priority
            </h3>
            <p className="text-sm text-gray-500">Drag to reorder. First provider is tried first.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddProvider(!showAddProvider)}
            className="border-white/10"
            disabled={availableProviders.length === 0}
            data-testid="add-provider-btn"
          >
            <Plus className="w-4 h-4 mr-1" /> Add Provider
          </Button>
        </div>

        {/* Add provider dropdown */}
        {showAddProvider && availableProviders.length > 0 && (
          <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
            {availableProviders.map(provider => (
              <button
                key={provider.id}
                onClick={() => handleAddProvider(provider.id)}
                className="w-full p-3 rounded-lg bg-white/5 hover:bg-white/10 text-left transition-colors flex items-center gap-3"
              >
                <span className="text-xl">{provider.icon}</span>
                <div className="flex-1">
                  <p className="font-medium">{provider.name}</p>
                  <p className="text-xs text-gray-500">{provider.description}</p>
                </div>
                <Plus className="w-4 h-4 text-gray-400" />
              </button>
            ))}
          </div>
        )}

        {/* Reorderable provider list */}
        <Reorder.Group axis="y" values={providerOrder} onReorder={setProviderOrder} className="space-y-2">
          {providerOrder.map((providerId, index) => {
            const provider = SUBTITLE_PROVIDERS.find(p => p.id === providerId);
            if (!provider) return null;

            return (
              <Reorder.Item
                key={providerId}
                value={providerId}
                className="p-4 rounded-xl bg-white/5 border border-white/10 cursor-grab active:cursor-grabbing"
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="w-4 h-4 text-gray-500" />
                  <span className="w-8 h-8 flex items-center justify-center text-lg bg-white/5 rounded-lg">
                    {provider.icon}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{provider.name}</p>
                      <span className="text-xs text-gray-500">#{index + 1}</span>
                    </div>
                    <p className="text-xs text-gray-500">{provider.description}</p>
                  </div>
                  
                  {/* Auth config for providers that need it */}
                  {provider.requiresAuth && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Username"
                        value={settings.provider_configs?.[providerId]?.username || ''}
                        onChange={(e) => handleProviderConfig(providerId, 'username', e.target.value)}
                        className="w-24 px-2 py-1 text-xs rounded bg-white/5 border border-white/10"
                      />
                      <input
                        type="password"
                        placeholder="API Key"
                        value={settings.provider_configs?.[providerId]?.api_key || ''}
                        onChange={(e) => handleProviderConfig(providerId, 'api_key', e.target.value)}
                        className="w-24 px-2 py-1 text-xs rounded bg-white/5 border border-white/10"
                      />
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTestProvider(providerId)}
                    disabled={testing === providerId}
                    className="text-gray-400 hover:text-white"
                  >
                    {testing === providerId ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <TestTube className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveProvider(providerId)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>

        {providerOrder.length === 0 && (
          <div className="p-8 text-center text-gray-400 border border-dashed border-white/10 rounded-xl">
            <Captions className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No subtitle providers configured</p>
            <p className="text-sm">Click "Add Provider" to get started</p>
          </div>
        )}
      </div>

      {/* Language Preferences */}
      <div className="glass-card rounded-xl p-4 space-y-4">
        <h3 className="font-medium">Preferred Languages</h3>
        <p className="text-sm text-gray-500">Select languages in order of preference</p>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => handleLanguageToggle(lang.code)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all flex items-center gap-1.5 ${
                settings.subtitle_languages.includes(lang.code)
                  ? 'bg-green-500/20 border-green-500/50 text-green-400 border'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:border-white/20'
              }`}
            >
              {settings.subtitle_languages.includes(lang.code) && <Check className="w-3 h-3" />}
              {lang.name}
            </button>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700" data-testid="save-subtitle-settings-btn">
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      {/* Tips */}
      <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
        <p className="text-sm text-green-400">
          <strong>Tip:</strong> OpenSubtitles requires a free account. Drag providers to set the search order - the first matching subtitle will be used.
        </p>
      </div>
    </motion.div>
  );
};
