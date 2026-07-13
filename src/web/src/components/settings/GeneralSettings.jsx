import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Folder, FolderSearch, LayoutDashboard, Eye, EyeOff, Check,
  Settings, Sliders, Palette, Bell, Loader2
} from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { HelpTooltip } from '../ui/HelpTooltip';
import { SettingsTabHeader, SettingsTabContent } from './SettingsTabHeader';
import axios from 'axios';
import { BACKEND_URL } from '../../lib/config';

// Tabs for General Settings
const GENERAL_TABS = [
  { id: 'paths', label: 'Paths & Storage', icon: Folder },
  { id: 'sidebar', label: 'Sidebar Tabs', icon: LayoutDashboard },
  { id: 'preferences', label: 'Preferences', icon: Sliders },
];

// All hideable sidebar tabs - includes media, gadgets, and admin/tools
const hideableTabs = [
  // Media
  { label: 'Library', description: 'Browse your local media collection', group: 'Media' },
  { label: 'Movies', description: 'View your movie library', group: 'Media' },
  { label: 'TV Shows', description: 'Browse TV series', group: 'Media' },
  { label: 'Anime', description: 'Anime content section', group: 'Media' },
  { label: 'Playlists', description: 'Custom playlists & collections', group: 'Media' },
  { label: 'Music', description: 'Music library', group: 'Media' },
  { label: 'Audiobooks', description: 'Audiobook collection', group: 'Media' },
  { label: 'Live TV', description: 'IPTV & live channels', group: 'Media' },
  { label: 'Streaming', description: 'Streaming service integration', group: 'Media' },
  { label: 'Indexers', description: 'Search indexers for content', group: 'Media' },
  // Gadgets
  { label: 'Weather', description: 'Weather dashboard gadget', group: 'Gadgets' },
  { label: 'Podcasts', description: 'Podcast player gadget', group: 'Gadgets' },
  { label: 'Radio', description: 'Internet radio gadget', group: 'Gadgets' },
  { label: 'Photos', description: 'Photo gallery gadget', group: 'Gadgets' },
  { label: 'Web Video', description: 'Web video player gadget', group: 'Gadgets' },
  // Admin / Settings sub-items
  { label: 'Security', description: 'Security dashboard & audit logs', group: 'Admin' },
  { label: 'VPN Portal', description: 'WireGuard VPN management', group: 'Admin' },
  { label: 'Lib Manager', description: 'Library management tools', group: 'Admin' },
  { label: 'Browse Media', description: 'Browse media files on disk', group: 'Admin' },
  { label: 'Log Viewer', description: 'View application logs', group: 'Admin' },
  { label: 'System', description: 'System info & health', group: 'Admin' },
  { label: 'Marketplace', description: 'Plugin marketplace', group: 'Admin' },
];

const defaultVisibleTabs = [
  'Library', 'Movies', 'TV Shows', 'Anime', 'Playlists', 'Music', 'Audiobooks', 'Streaming', 'Indexers',
  'Weather', 'Podcasts', 'Radio', 'Photos', 'Web Video',
  'Security', 'VPN Portal', 'Lib Manager', 'Browse Media', 'Log Viewer', 'System', 'Marketplace',
];

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
        const response = await axios.get(`${BACKEND_URL}/api/user/preferences`, {
          
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

  const saveTabVisibility = async () => {
    try {
      setSavingTabs(true);
      await axios.put(`${BACKEND_URL}/api/user/preferences`, 
        { visible_tabs: visibleTabs },
        { headers: { 'Content-Type': 'application/json' } }
      );
      // Also update localStorage for backwards compatibility and immediate sidebar update
      localStorage.setItem('watchnexus_visible_tabs', JSON.stringify(visibleTabs));
      window.dispatchEvent(new Event('watchnexus_tabs_updated'));
      toast.success('Sidebar tabs updated and synced to your account');
    } catch (error) {
      console.error('Failed to save preferences:', error);
      toast.error('Failed to save tab preferences');
    } finally {
      setSavingTabs(false);
    }
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
            savingTabs={savingTabs}
            loadingPrefs={loadingPrefs}
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
        help={{ title: "General Settings", description: "Core application settings including file storage locations, quality preferences, sidebar customization, and display options. Changes are saved per-user and sync across sessions.", examples: ["Storage Paths: Set where downloads and libraries are stored", "Quality: Default resolution for media downloads", "Sidebar: Toggle which pages appear in navigation"] }}
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
        <HelpTooltip
          title="Storage Paths"
          description="Configure where WatchNexus stores your media files. The download path is used for temporary storage during downloads, and the library path is where your organized media collection lives."
          examples={[
            "Download Path: /media/downloads or D:\\Downloads\\WatchNexus",
            "Library Path: /media/library or D:\\Media\\Library",
            "Ensure the paths exist and the application has read/write access"
          ]}
        />
      </h3>

      <div className="grid gap-4">
        <div>
          <label className="text-sm text-gray-400 mb-2 block">
            Download Path
            <HelpTooltip title="Download Path" description="The folder where media is temporarily stored while downloading. Files are moved to the library path after processing is complete." examples={["Linux: /media/downloads", "Windows: D:\\Downloads\\WatchNexus"]} />
          </label>
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
          <label className="text-sm text-gray-400 mb-2 block">
            Library Path
            <HelpTooltip title="Library Path" description="The main folder where your organized media collection is stored. WatchNexus scans this directory to populate your library with movies, TV shows, and other media." examples={["Linux: /media/library", "Windows: D:\\Media\\Library", "Network: /mnt/nas/media"]} />
          </label>
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
          <label className="text-sm text-gray-400 mb-2 block">
            Quality Preference
            <HelpTooltip title="Quality Preference" description="Sets the default video quality for downloads and streaming. Higher quality means larger file sizes and more bandwidth usage." examples={["4K (2160p): Best quality, ~20-60 GB per movie", "1080p: Great quality, ~5-15 GB per movie", "720p: Good quality, ~2-5 GB per movie", "480p: Standard, ~1-2 GB per movie"]} />
          </label>
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
const SidebarTab = ({ visibleTabs, toggleTab, showAllTabs, hideAllTabs, saveTabVisibility, savingTabs, loadingPrefs }) => (
  <div className="space-y-6">
    <div className="bg-surface border border-white/10 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-pink-400" />
            Sidebar Visibility
            <HelpTooltip
              title="Sidebar Visibility"
              description="Control which navigation items appear in your sidebar. Toggle items on or off to customize your experience. Home, Downloads, and Settings are always visible and cannot be hidden."
              examples={["Click a tab to toggle its visibility", "Use 'Show All' to enable everything at once", "Changes sync to your account across all devices"]}
            />
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

      {loadingPrefs ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
        </div>
      ) : (
        <div className="space-y-4">
          {['Media', 'Gadgets', 'Admin'].map(group => {
            const groupTabs = hideableTabs.filter(t => t.group === group);
            if (groupTabs.length === 0) return null;
            return (
              <div key={group}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{group}</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                  {groupTabs.map(tab => {
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
                        data-testid={`toggle-tab-${tab.label.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{tab.label}</span>
                          {isVisible && <Check className="w-4 h-4 text-violet-400" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-between items-center pt-2">
        <span className="text-xs text-gray-500">
          {visibleTabs.length} of {hideableTabs.length} tabs visible
        </span>
        <Button 
          onClick={saveTabVisibility} 
          className="bg-pink-600 hover:bg-pink-700" 
          disabled={savingTabs}
          data-testid="save-tab-visibility"
        >
          {savingTabs ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
          {savingTabs ? 'Saving...' : 'Apply Changes'}
        </Button>
      </div>
    </div>
    
    <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
      <p className="text-sm text-green-400">
        <strong>Sync enabled:</strong> Your sidebar preferences are saved to your account and will sync across all your devices.
      </p>
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
        <HelpTooltip
          title="Display Preferences"
          description="Customize how media information is displayed throughout the application. These settings affect all pages and views."
          examples={["Enable ratings to see TMDB scores on cards", "Compact mode reduces card sizes for more items per row", "24-hour time shows 14:30 instead of 2:30 PM"]}
        />
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
        <HelpTooltip
          title="Notification Preferences"
          description="Control which events trigger in-app notifications. For external notification channels (Discord, email, webhooks), visit the Notifications page."
          examples={["Enable 'Download Complete' to be notified when a download finishes", "Enable 'New Episodes' to know when tracked shows release new episodes"]}
        />
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
