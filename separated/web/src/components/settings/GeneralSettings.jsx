import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Folder, FolderSearch, LayoutDashboard, Eye, EyeOff, Check } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { toast } from 'sonner';

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
  const [visibleTabs, setVisibleTabs] = useState(() => {
    try {
      const saved = localStorage.getItem('watchnexus_visible_tabs');
      return saved ? JSON.parse(saved) : defaultVisibleTabs;
    } catch {
      return defaultVisibleTabs;
    }
  });

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
    // Dispatch event for Sidebar to listen to
    window.dispatchEvent(new Event('watchnexus_tabs_updated'));
    toast.success('Sidebar tabs updated');
  };

  const showAllTabs = () => {
    setVisibleTabs(hideableTabs.map(t => t.label));
  };

  const hideAllTabs = () => {
    setVisibleTabs([]);
  };

  return (
    <div className="space-y-6">
      {/* Paths Section */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-xl p-6 space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Folder className="w-5 h-5 text-violet-400" />
          General Settings
        </h2>

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
          </div>
        </div>

        <Button onClick={onSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700">
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </motion.div>

      {/* Sidebar Tab Visibility Section */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: 0.1 }}
        className="glass-card rounded-xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-pink-400" />
            Sidebar Tabs
          </h2>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={showAllTabs}
              className="text-xs hover:bg-white/10"
            >
              <Eye className="w-3 h-3 mr-1" /> Show All
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={hideAllTabs}
              className="text-xs hover:bg-white/10"
            >
              <EyeOff className="w-3 h-3 mr-1" /> Hide All
            </Button>
          </div>
        </div>
        
        <p className="text-sm text-gray-400">
          Choose which tabs appear in your sidebar. Home, Downloads, and Settings are always visible.
        </p>

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
          <Button 
            onClick={saveTabVisibility}
            className="bg-pink-600 hover:bg-pink-700"
            data-testid="save-tab-visibility"
          >
            <Check className="w-4 h-4 mr-2" /> Apply Changes
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
