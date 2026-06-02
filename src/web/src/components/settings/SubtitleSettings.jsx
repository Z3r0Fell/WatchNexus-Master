import { useState, useEffect, useCallback } from 'react';
import { motion, Reorder } from 'framer-motion';
import { Captions, GripVertical, Check, Plus, Trash2, Settings, RefreshCw, TestTube, Languages, Sliders } from 'lucide-react';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { toast } from 'sonner';
import { BACKEND_URL } from '../../lib/config';
import axios from 'axios';
import { SettingsTabHeader, SettingsTabContent } from './SettingsTabHeader';

// Tabs for Subtitle Settings
const SUBTITLE_TABS = [
  { id: 'providers', label: 'Providers', icon: Settings },
  { id: 'languages', label: 'Languages', icon: Languages },
  { id: 'preferences', label: 'Preferences', icon: Sliders },
];

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
  const [activeTab, setActiveTab] = useState('providers');
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
    } catch (err) { console.error('Failed to fetch subtitle settings:', err); toast.error('Failed to fetch subtitle settings:');; }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post(`${BACKEND_URL}/api/garnish/settings`, { ...settings, providers: providerOrder });
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

  const handleRemoveProvider = (providerId) => { setProviderOrder(providerOrder.filter(id => id !== providerId)); };

  const handleTestProvider = async (providerId) => {
    setTesting(providerId);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/garnish/test/${providerId}`);
      res.data.success ? toast.success(`${providerId} is working!`) : toast.error(`${providerId} test failed: ${res.data.error}`);
    } catch { toast.error(`Failed to test ${providerId}`); }
    setTesting(null);
  };

  const handleProviderConfig = (providerId, key, value) => {
    setSettings(prev => ({
      ...prev,
      provider_configs: { ...prev.provider_configs, [providerId]: { ...prev.provider_configs?.[providerId], [key]: value } }
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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'providers':
        return (
          <ProvidersTab
            providerOrder={providerOrder}
            setProviderOrder={setProviderOrder}
            settings={settings}
            showAddProvider={showAddProvider}
            setShowAddProvider={setShowAddProvider}
            availableProviders={availableProviders}
            handleAddProvider={handleAddProvider}
            handleRemoveProvider={handleRemoveProvider}
            handleTestProvider={handleTestProvider}
            handleProviderConfig={handleProviderConfig}
            testing={testing}
          />
        );
      case 'languages':
        return <LanguagesTab settings={settings} handleLanguageToggle={handleLanguageToggle} />;
      case 'preferences':
        return <PreferencesTab settings={settings} setSettings={setSettings} />;
      default:
        return null;
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6" data-testid="subtitle-settings">
      <SettingsTabHeader
        title="Subtitle Settings"
        subtitle="Configure subtitle providers and language preferences"
        icon={Captions}
        tabs={SUBTITLE_TABS}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        iconBgColor="from-green-600 to-emerald-500"
        version="Garnish"
        help={{ title: "Subtitle Settings", description: "Configure automatic subtitle downloading from multiple providers. Set your preferred languages and providers will be searched in priority order. Supports OpenSubtitles, Addic7ed, Subscene, and more.", examples: ["Add your preferred languages in order of priority", "OpenSubtitles requires a free API key from opensubtitles.com", "Enable auto-download to fetch subtitles when media is added"] }}
      />

      <SettingsTabContent activeTab={activeTab}>
        {renderTabContent()}
      </SettingsTabContent>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700 px-8" data-testid="save-subtitle-settings-btn">
          {saving ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><Check className="w-4 h-4 mr-2" />Save Settings</>}
        </Button>
      </div>
    </motion.div>
  );
};

// Providers Tab
const ProvidersTab = ({ providerOrder, setProviderOrder, settings, showAddProvider, setShowAddProvider, availableProviders, handleAddProvider, handleRemoveProvider, handleTestProvider, handleProviderConfig, testing }) => (
  <div className="space-y-6">
    <div className="bg-surface border border-white/10 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Settings className="w-5 h-5 text-violet-400" />
            Provider Priority
          </h3>
          <p className="text-sm text-gray-500">Drag to reorder. First provider is tried first.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowAddProvider(!showAddProvider)} className="border-white/10" disabled={availableProviders.length === 0}>
          <Plus className="w-4 h-4 mr-1" /> Add Provider
        </Button>
      </div>

      {showAddProvider && availableProviders.length > 0 && (
        <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
          {availableProviders.map(provider => (
            <button key={provider.id} onClick={() => handleAddProvider(provider.id)}
              className="w-full p-3 rounded-lg bg-white/5 hover:bg-white/10 text-left transition-colors flex items-center gap-3">
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

      <Reorder.Group axis="y" values={providerOrder} onReorder={setProviderOrder} className="space-y-2">
        {providerOrder.map((providerId, index) => {
          const provider = SUBTITLE_PROVIDERS.find(p => p.id === providerId);
          if (!provider) return null;
          return (
            <Reorder.Item key={providerId} value={providerId} className="p-4 rounded-xl bg-black/30 border border-white/10 cursor-grab active:cursor-grabbing">
              <div className="flex items-center gap-3">
                <GripVertical className="w-4 h-4 text-gray-500" />
                <span className="w-8 h-8 flex items-center justify-center text-lg bg-white/5 rounded-lg">{provider.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{provider.name}</p>
                    <span className="text-xs text-gray-500">#{index + 1}</span>
                  </div>
                  <p className="text-xs text-gray-500">{provider.description}</p>
                </div>
                {provider.requiresAuth && (
                  <div className="flex items-center gap-2">
                    <input type="text" placeholder="Username" value={settings.provider_configs?.[providerId]?.username || ''}
                      onChange={(e) => handleProviderConfig(providerId, 'username', e.target.value)}
                      className="w-24 px-2 py-1 text-xs rounded bg-white/5 border border-white/10" />
                    <input type="password" placeholder="API Key" value={settings.provider_configs?.[providerId]?.api_key || ''}
                      onChange={(e) => handleProviderConfig(providerId, 'api_key', e.target.value)}
                      className="w-24 px-2 py-1 text-xs rounded bg-white/5 border border-white/10" />
                  </div>
                )}
                <Button variant="ghost" size="sm" onClick={() => handleTestProvider(providerId)} disabled={testing === providerId} className="text-gray-400">
                  {testing === providerId ? <RefreshCw className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleRemoveProvider(providerId)} className="text-red-400 hover:bg-red-500/10">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Reorder.Item>
          );
        })}
      </Reorder.Group>

      {providerOrder.length === 0 && (
        <div className="p-8 text-center text-gray-400 border border-dashed border-white/10 rounded-xl">
          <Captions className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No subtitle providers configured</p>
          <p className="text-sm">Click "Add Provider" to get started</p>
        </div>
      )}
    </div>

    <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
      <p className="text-sm text-green-400">
        <strong>Tip:</strong> OpenSubtitles requires a free account. Drag providers to set the search order.
      </p>
    </div>
  </div>
);

// Languages Tab
const LanguagesTab = ({ settings, handleLanguageToggle }) => (
  <div className="space-y-6">
    <div className="bg-surface border border-white/10 rounded-2xl p-6 space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Languages className="w-5 h-5 text-blue-400" />
        Preferred Languages
      </h3>
      <p className="text-sm text-gray-400">Select languages in order of preference for subtitle downloads</p>
      
      <div className="flex flex-wrap gap-2">
        {LANGUAGES.map(lang => (
          <button key={lang.code} onClick={() => handleLanguageToggle(lang.code)}
            className={`px-4 py-2 rounded-lg text-sm transition-all flex items-center gap-2 ${
              settings.subtitle_languages.includes(lang.code)
                ? 'bg-green-500/20 border-green-500/50 text-green-400 border'
                : 'bg-white/5 border border-white/10 text-gray-400 hover:border-white/20'
            }`}>
            {settings.subtitle_languages.includes(lang.code) && <Check className="w-3 h-3" />}
            {lang.name}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-500 mt-4">
        Selected: {settings.subtitle_languages.length} language(s)
      </p>
    </div>
  </div>
);

// Preferences Tab
const PreferencesTab = ({ settings, setSettings }) => (
  <div className="space-y-6">
    <div className="bg-surface border border-white/10 rounded-2xl p-6 space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Sliders className="w-5 h-5 text-amber-400" />
        Subtitle Preferences
      </h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg bg-white/5">
          <div>
            <p className="font-medium">Auto-download Subtitles</p>
            <p className="text-xs text-gray-500">Automatically fetch subtitles when media is added</p>
          </div>
          <Switch checked={settings.auto_subtitles}
            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, auto_subtitles: checked }))} />
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg bg-white/5">
          <div>
            <p className="font-medium">Prefer Hearing Impaired</p>
            <p className="text-xs text-gray-500">Prioritize subtitles with [HI] tags</p>
          </div>
          <Switch checked={settings.prefer_hi || false}
            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, prefer_hi: checked }))} />
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg bg-white/5">
          <div>
            <p className="font-medium">Auto-sync Subtitles</p>
            <p className="text-xs text-gray-500">Attempt to sync subtitles with audio</p>
          </div>
          <Switch checked={settings.auto_sync || false}
            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, auto_sync: checked }))} />
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg bg-white/5">
          <div>
            <p className="font-medium">Embedded Subtitles First</p>
            <p className="text-xs text-gray-500">Prefer embedded subtitles over downloaded ones</p>
          </div>
          <Switch checked={settings.embedded_first || false}
            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, embedded_first: checked }))} />
        </div>
      </div>
    </div>
  </div>
);

export default SubtitleSettings;
