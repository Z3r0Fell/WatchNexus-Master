import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Folder, FolderSearch, LayoutDashboard, Eye, EyeOff, Check,
  Settings, Sliders, Palette, Bell, Loader2
} from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { SettingsTabHeader, SettingsTabContent } from './SettingsTabHeader';
import axios from 'axios';
import { BACKEND_URL } from '../../lib/config';

// Tabs for General Settings
const GENERAL_TABS = [
  { id: 'paths', label: 'Paths & Storage', icon: Folder },
  { id: 'sidebar', label: 'Sidebar Tabs', icon: LayoutDashboard },
  { id: 'preferences', label: 'Preferences', icon: Sliders },
];

// All hideable sidebar tabs
const hideableTabs = [
  { label: 'Library', description: 'Browse your local media collection' },
  { label: 'Movies', description: 'View your movie library' },
  { label: 'TV Shows', description: 'Browse TV series' },
  { label: 'Anime', description: 'Anime content section' },
  { label: 'Playlists', description: 'Custom playlists & collections' },
  { label: 'Music', description: 'Music library' },
  { label: 'Audiobooks', description: 'Audiobook collection' },
  { label: 'Live TV', description: 'IPTV & live channels' },
  { label: 'Streaming', description: 'Streaming service integration' },
  { label: 'Indexers', description: 'Search indexers for content' },
];

const defaultVisibleTabs = ['Library', 'Movies', 'TV Shows', 'Anime', 'Playlists', 'Music', 'Audiobooks', 'Streaming', 'Indexers'];

export const GeneralSettings = ({ 
  settings, 
  setSettings, 
  onSave, 
  saving,
  onOpenFileBrowser
}) => {
  const [activeTab, setActiveTab] = useState('paths');
  const [visibleTabs, setVisibleTabs] = useState(defaultVisibleTabs);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [savingTabs, setSavingTabs] = useState(false);

  // Load preferences from backend on mount
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${BACKEND_URL}/api/user/preferences`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data.visible_tabs && response.data.visible_tabs.length > 0) {
          setVisibleTabs(response.data.visible_tabs);
        }
      } catch (error) {
        console.error('Failed to fetch preferences:', error);
        // Fall back to localStorage for backwards compatibility
        try {
          const saved = localStorage.getItem('watchnexus_visible_tabs');
          if (saved) setVisibleTabs(JSON.parse(saved));
        } catch {}
      } finally {
        setLoadingPrefs(false);
      }
    };
    fetchPreferences();
  }, []);

  const toggleTab = (tabLabel) => {
    setVisibleTabs(prev => {
      const newTabs = prev.includes(tabLabel)
        ? prev.filter(t => t !== tabLabel)
        : [...prev, tabLabel];
      return newTabs;
    });
  };

  const saveTabVisibility = () => {
    localStorage.setItem('watchnexus_visible_tabs', JSON.stringify(visibleTabs));
    window.dispatchEvent(new Event('watchnexus_tabs_updated'));
    toast.success('Sidebar tabs updated');
  };

  const showAllTabs = () => setVisibleTabs(hideableTabs.map(t => t.label));
  const hideAllTabs = () => setVisibleTabs([]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'paths':
        return (
          <PathsTab 
            settings={settings} 
            setSettings={setSettings} 
            onSave={onSave} 
            saving={saving}
            onOpenFileBrowser={onOpenFileBrowser}
          />
        );
      case 'sidebar':
        return (
          <SidebarTab 
            visibleTabs={visibleTabs}
            toggleTab={toggleTab}
            showAllTabs={showAllTabs}
            hideAllTabs={hideAllTabs}
            saveTabVisibility={saveTabVisibility}
          />
        );
      case 'preferences':
        return <PreferencesTab />;
      default:
        return null;
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6" data-testid="general-settings">
      <SettingsTabHeader
        title="General Settings"
        subtitle="Configure paths, preferences, and sidebar visibility"
        icon={Settings}
        tabs={GENERAL_TABS}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        iconBgColor="from-gray-600 to-gray-700"
      />

      <SettingsTabContent activeTab={activeTab}>
        {renderTabContent()}
      </SettingsTabContent>
    </motion.div>
  );
};

// Paths Tab
const PathsTab = ({ settings, setSettings, onSave, saving, onOpenFileBrowser }) => (
  <div className="space-y-6">
    <div className="bg-surface border border-white/10 rounded-2xl p-6 space-y-6">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Folder className="w-5 h-5 text-violet-400" />
        Storage Paths
      </h3>

      <div className="grid gap-4">
        <div>
          <label className="text-sm text-gray-400 mb-2 block">Download Path</label>
          <div className="flex gap-2">
            <Input
              value={settings.download_path}
              onChange={(e) => setSettings({ ...settings, download_path: e.target.value })}
              placeholder="/media/downloads"
              className="bg-white/5 border-white/10 flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenFileBrowser?.('download_path')}
              className="border-white/10 hover:bg-white/5"
              data-testid="browse-download-path"
            >
              <FolderSearch className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-1">Where downloaded media is temporarily stored</p>
        </div>

        <div>
          <label className="text-sm text-gray-400 mb-2 block">Library Path</label>
          <div className="flex gap-2">
            <Input
              value={settings.library_path}
              onChange={(e) => setSettings({ ...settings, library_path: e.target.value })}
              placeholder="/media/library"
              className="bg-white/5 border-white/10 flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenFileBrowser?.('library_path')}
              className="border-white/10 hover:bg-white/5"
              data-testid="browse-library-path"
            >
              <FolderSearch className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-1">Where organized media is stored permanently</p>
        </div>

        <div>
          <label className="text-sm text-gray-400 mb-2 block">Quality Preference</label>
          <select
            value={settings.quality_preference}
            onChange={(e) => setSettings({ ...settings, quality_preference: e.target.value })}
            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
          >
            <option value="4k">4K / 2160p</option>
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
            <option value="480p">480p</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">Preferred quality when downloading media</p>
        </div>
      </div>

      <Button onClick={onSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700">
        {saving ? 'Saving...' : 'Save Settings'}
      </Button>
    </div>
  </div>
);

// Sidebar Tab
const SidebarTab = ({ visibleTabs, toggleTab, showAllTabs, hideAllTabs, saveTabVisibility }) => (
  <div className="space-y-6">
    <div className="bg-surface border border-white/10 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-pink-400" />
            Sidebar Visibility
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Choose which tabs appear in your sidebar. Home, Downloads, and Settings are always visible.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={showAllTabs} className="text-xs hover:bg-white/10">
            <Eye className="w-3 h-3 mr-1" /> Show All
          </Button>
          <Button variant="ghost" size="sm" onClick={hideAllTabs} className="text-xs hover:bg-white/10">
            <EyeOff className="w-3 h-3 mr-1" /> Hide All
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {hideableTabs.map(tab => {
          const isVisible = visibleTabs.includes(tab.label);
          return (
            <button
              key={tab.label}
              onClick={() => toggleTab(tab.label)}
              className={`p-3 rounded-lg border transition-all text-left ${
                isVisible 
                  ? 'bg-violet-600/20 border-violet-500/50 text-white' 
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
              }`}
              data-testid={`toggle-tab-${tab.label.toLowerCase().replace(' ', '-')}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{tab.label}</span>
                {isVisible && <Check className="w-4 h-4 text-violet-400" />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-between items-center pt-2">
        <span className="text-xs text-gray-500">
          {visibleTabs.length} of {hideableTabs.length} tabs visible
        </span>
        <Button onClick={saveTabVisibility} className="bg-pink-600 hover:bg-pink-700" data-testid="save-tab-visibility">
          <Check className="w-4 h-4 mr-2" /> Apply Changes
        </Button>
      </div>
    </div>
  </div>
);

// Preferences Tab
const PreferencesTab = () => (
  <div className="space-y-6">
    <div className="bg-surface border border-white/10 rounded-2xl p-6 space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Sliders className="w-5 h-5 text-blue-400" />
        Display Preferences
      </h3>
      
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="p-4 rounded-lg bg-white/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Show Ratings</p>
              <p className="text-xs text-gray-500">Display TMDB/IMDB ratings on media cards</p>
            </div>
            <input type="checkbox" defaultChecked className="w-4 h-4 rounded bg-white/10" />
          </div>
        </div>
        
        <div className="p-4 rounded-lg bg-white/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Show Genres</p>
              <p className="text-xs text-gray-500">Display genre tags on media items</p>
            </div>
            <input type="checkbox" defaultChecked className="w-4 h-4 rounded bg-white/10" />
          </div>
        </div>
        
        <div className="p-4 rounded-lg bg-white/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">24-hour Time</p>
              <p className="text-xs text-gray-500">Use 24-hour time format</p>
            </div>
            <input type="checkbox" className="w-4 h-4 rounded bg-white/10" />
          </div>
        </div>
        
        <div className="p-4 rounded-lg bg-white/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Compact Mode</p>
              <p className="text-xs text-gray-500">Use smaller cards and tighter spacing</p>
            </div>
            <input type="checkbox" className="w-4 h-4 rounded bg-white/10" />
          </div>
        </div>
      </div>
    </div>

    <div className="bg-surface border border-white/10 rounded-2xl p-6 space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Bell className="w-5 h-5 text-amber-400" />
        Notifications
      </h3>
      
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="p-4 rounded-lg bg-white/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Download Complete</p>
              <p className="text-xs text-gray-500">Notify when downloads finish</p>
            </div>
            <input type="checkbox" defaultChecked className="w-4 h-4 rounded bg-white/10" />
          </div>
        </div>
        
        <div className="p-4 rounded-lg bg-white/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">New Episodes</p>
              <p className="text-xs text-gray-500">Notify when new episodes are available</p>
            </div>
            <input type="checkbox" defaultChecked className="w-4 h-4 rounded bg-white/10" />
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default GeneralSettings;
