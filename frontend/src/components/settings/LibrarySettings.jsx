import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen, Plus, Trash2, RefreshCw, Film, Tv, Music,
  FolderSearch, FolderCog, Layers, ListChecks, FolderInput,
  ScanLine, Import, ChevronRight, Home, Database
} from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

export const LibrarySettings = ({
  // Libraries state
  libraries,
  loadingLibraries,
  scanningLibrary,
  showAddLibrary,
  setShowAddLibrary,
  newLibrary,
  setNewLibrary,
  onAddLibrary,
  onDeleteLibrary,
  onScanLibrary,
  // File browser
  onOpenFileBrowser,
  // Sub-tab state
  librarySubTab,
  setLibrarySubTab,
  // Manual import
  manualImportPath,
  setManualImportPath,
  manualImportFiles,
  onManualImportScan,
  onImportFiles
}) => {
  const getMediaTypeIcon = (type) => {
    switch (type) {
      case 'movies': return '🎬';
      case 'tv': return '📺';
      case 'anime': return '🎌';
      case 'music': return '🎵';
      case 'audiobooks': return '📚';
      default: return '📁';
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Sub-tabs for Library section */}
      <div className="flex gap-2 border-b border-white/10 pb-4 flex-wrap">
        <SubTabButton 
          active={librarySubTab === 'libraries'} 
          onClick={() => setLibrarySubTab('libraries')}
          icon={<FolderOpen className="w-4 h-4" />}
          label="Libraries"
        />
        <SubTabButton 
          active={librarySubTab === 'media-management'} 
          onClick={() => setLibrarySubTab('media-management')}
          icon={<FolderCog className="w-4 h-4" />}
          label="Media Management"
        />
        <SubTabButton 
          active={librarySubTab === 'quality-profiles'} 
          onClick={() => setLibrarySubTab('quality-profiles')}
          icon={<Layers className="w-4 h-4" />}
          label="Quality Profiles"
        />
        <SubTabButton 
          active={librarySubTab === 'mass-editor'} 
          onClick={() => setLibrarySubTab('mass-editor')}
          icon={<ListChecks className="w-4 h-4" />}
          label="Mass Editor"
        />
        <SubTabButton 
          active={librarySubTab === 'manual-import'} 
          onClick={() => setLibrarySubTab('manual-import')}
          icon={<FolderInput className="w-4 h-4" />}
          label="Manual Import"
        />
      </div>

      {/* Libraries Sub-Tab */}
      {librarySubTab === 'libraries' && (
        <LibrariesSubTab
          libraries={libraries}
          loadingLibraries={loadingLibraries}
          scanningLibrary={scanningLibrary}
          showAddLibrary={showAddLibrary}
          setShowAddLibrary={setShowAddLibrary}
          newLibrary={newLibrary}
          setNewLibrary={setNewLibrary}
          onAddLibrary={onAddLibrary}
          onDeleteLibrary={onDeleteLibrary}
          onScanLibrary={onScanLibrary}
          onOpenFileBrowser={onOpenFileBrowser}
          getMediaTypeIcon={getMediaTypeIcon}
        />
      )}

      {/* Media Management Sub-Tab */}
      {librarySubTab === 'media-management' && (
        <MediaManagementSubTab />
      )}

      {/* Quality Profiles Sub-Tab */}
      {librarySubTab === 'quality-profiles' && (
        <QualityProfilesSubTab />
      )}

      {/* Mass Editor Sub-Tab */}
      {librarySubTab === 'mass-editor' && (
        <MassEditorSubTab />
      )}

      {/* Manual Import Sub-Tab */}
      {librarySubTab === 'manual-import' && (
        <ManualImportSubTab
          manualImportPath={manualImportPath}
          setManualImportPath={setManualImportPath}
          manualImportFiles={manualImportFiles}
          onManualImportScan={onManualImportScan}
          onImportFiles={onImportFiles}
          onOpenFileBrowser={onOpenFileBrowser}
        />
      )}
    </motion.div>
  );
};

// Sub-tab button component
const SubTabButton = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
      active 
        ? 'bg-violet-600 text-white' 
        : 'bg-white/5 hover:bg-white/10 text-gray-300'
    }`}
  >
    {icon}
    {label}
  </button>
);

// Libraries Sub-Tab
const LibrariesSubTab = ({
  libraries, loadingLibraries, scanningLibrary, showAddLibrary,
  setShowAddLibrary, newLibrary, setNewLibrary, onAddLibrary,
  onDeleteLibrary, onScanLibrary, onOpenFileBrowser, getMediaTypeIcon
}) => (
  <div className="space-y-6">
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-violet-400" />
            Media Libraries (Marmalade)
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Add folders and drives to scan for media content
          </p>
        </div>
        <Button 
          onClick={() => setShowAddLibrary(!showAddLibrary)}
          className="bg-violet-600 hover:bg-violet-700"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Library
        </Button>
      </div>

      {/* Add Library Form */}
      <AnimatePresence>
        {showAddLibrary && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-xl bg-surface border border-white/10 space-y-4 mb-4">
              <h3 className="font-bold flex items-center gap-2">
                <Plus className="w-4 h-4 text-green-400" />
                Add New Library
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Library Name *</label>
                  <Input
                    value={newLibrary.name}
                    onChange={(e) => setNewLibrary(p => ({ ...p, name: e.target.value }))}
                    placeholder="Movies, TV Shows, Anime..."
                    className="bg-white/5 border-white/10"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Media Type *</label>
                  <select
                    value={newLibrary.media_type}
                    onChange={(e) => setNewLibrary(p => ({ ...p, media_type: e.target.value }))}
                    className="w-full h-10 px-3 rounded-md bg-white/5 border border-white/10 text-white"
                  >
                    <option value="movies">🎬 Movies</option>
                    <option value="tv">📺 TV Shows</option>
                    <option value="anime">🎌 Anime</option>
                    <option value="music">🎵 Music</option>
                    <option value="audiobooks">📚 Audiobooks</option>
                    <option value="other">📁 Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Folder Path *</label>
                  <div className="flex gap-2">
                    <Input
                      value={newLibrary.path}
                      onChange={(e) => setNewLibrary(p => ({ ...p, path: e.target.value }))}
                      placeholder="/media/movies or D:\Movies"
                      className="bg-white/5 border-white/10 flex-1"
                    />
                    <Button
                      type="button"
                      onClick={() => onOpenFileBrowser(newLibrary.path || '/')}
                      className="bg-violet-600 hover:bg-violet-700 px-3"
                      title="Browse folders"
                    >
                      <FolderSearch className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Common Paths */}
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-gray-500">Common paths:</span>
                {['/media', '/home/user/Videos', '/mnt/storage', 'D:\\Videos'].map(path => (
                  <button
                    key={path}
                    onClick={() => setNewLibrary(p => ({ ...p, path }))}
                    className="px-2 py-1 text-xs rounded bg-white/5 hover:bg-white/10 text-gray-400"
                  >
                    {path}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={onAddLibrary} className="bg-green-600 hover:bg-green-700">
                  <Plus className="w-4 h-4 mr-2" /> Add Library
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowAddLibrary(false)}
                  className="border-white/20"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Libraries List */}
      <div className="space-y-3">
        <h3 className="font-bold">Configured Libraries ({libraries.length})</h3>
        {loadingLibraries ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-violet-400" />
          </div>
        ) : libraries.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No libraries configured</p>
            <p className="text-sm">Add a folder to start scanning for media</p>
          </div>
        ) : (
          libraries.map((lib) => (
            <LibraryCard 
              key={lib.id}
              library={lib}
              scanningLibrary={scanningLibrary}
              onScan={onScanLibrary}
              onDelete={onDeleteLibrary}
              getMediaTypeIcon={getMediaTypeIcon}
            />
          ))
        )}
      </div>
    </div>

    {/* Library Tips */}
    <div className="glass-card rounded-xl p-6">
      <h3 className="font-bold mb-4">Tips</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-300">
          <p><strong>Scanning:</strong> Large libraries may take a while. Marmalade extracts metadata from filenames.</p>
        </div>
        <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-300">
          <p><strong>Formats:</strong> Supports .mp4, .mkv, .avi, .mov, .wmv, .flv, .webm and more.</p>
        </div>
      </div>
    </div>
  </div>
);

// Library Card Component
const LibraryCard = ({ library, scanningLibrary, onScan, onDelete, getMediaTypeIcon }) => (
  <div className="p-4 rounded-xl bg-surface border border-white/10 hover:border-violet-500/30 transition-colors">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="text-3xl">{getMediaTypeIcon(library.media_type)}</div>
        <div>
          <p className="font-medium">{library.name}</p>
          <p className="text-sm text-gray-400">{library.path}</p>
          <p className="text-xs text-gray-500">
            {library.item_count || 0} items • Last scanned: {library.last_scanned || 'Never'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onScan(library.id)}
          disabled={scanningLibrary === library.id}
          className="border-white/20"
        >
          {scanningLibrary === library.id ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          <span className="ml-2">Scan</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDelete(library.id)}
          className="hover:bg-red-500/20 text-red-400"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  </div>
);

// Media Management Sub-Tab - Sonarr-like settings
const MediaManagementSubTab = () => {
  const [settings, setSettings] = React.useState({
    // Naming
    renameEpisodes: true,
    replaceIllegalCharacters: true,
    standardEpisodeFormat: '{Series Title} - S{season:00}E{episode:00} - {Episode Title}',
    dailyEpisodeFormat: '{Series Title} - {Air-Date} - {Episode Title}',
    animeEpisodeFormat: '{Series Title} - S{season:00}E{episode:00} - {Episode Title}',
    seriesFolderFormat: '{Series Title} ({Series Year})',
    seasonFolderFormat: 'Season {season:00}',
    multiEpisodeStyle: 'prefixedRange',
    // Importing
    skipFreeSpaceCheck: false,
    minFreeSpaceForImporting: 100,
    useHardlinks: true,
    importExtraFiles: true,
    extraFileExtensions: 'srt,nfo,sub',
    // File Management
    ignoreDeletedEpisodes: false,
    downloadProperAndRepacks: 'preferAndUpgrade',
    analyseVideoFiles: true,
    rescanAfterRefresh: 'always',
    changeFileDate: 'none',
    recyclingBin: '',
    recyclingBinCleanupDays: 7,
  });

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Episode Naming */}
      <div className="glass-card rounded-xl p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <FolderCog className="w-5 h-5 text-violet-400" />
          Episode Naming
        </h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Rename Episodes</p>
              <p className="text-sm text-gray-400">Rename episode files when importing</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={settings.renameEpisodes}
                onChange={(e) => updateSetting('renameEpisodes', e.target.checked)}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
            </label>
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block">Standard Episode Format</label>
            <Input
              value={settings.standardEpisodeFormat}
              onChange={(e) => updateSetting('standardEpisodeFormat', e.target.value)}
              className="bg-white/5 border-white/10 font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Preview: Breaking Bad - S05E16 - Felina</p>
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block">Series Folder Format</label>
            <Input
              value={settings.seriesFolderFormat}
              onChange={(e) => updateSetting('seriesFolderFormat', e.target.value)}
              className="bg-white/5 border-white/10 font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Preview: Breaking Bad (2008)</p>
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block">Season Folder Format</label>
            <Input
              value={settings.seasonFolderFormat}
              onChange={(e) => updateSetting('seasonFolderFormat', e.target.value)}
              className="bg-white/5 border-white/10 font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Preview: Season 05</p>
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block">Multi-Episode Style</label>
            <select
              value={settings.multiEpisodeStyle}
              onChange={(e) => updateSetting('multiEpisodeStyle', e.target.value)}
              className="w-full h-10 px-3 rounded-md bg-white/5 border border-white/10 text-white"
            >
              <option value="extend">Extend (S01E01-02-03)</option>
              <option value="duplicate">Duplicate (S01E01, S01E02, S01E03)</option>
              <option value="prefixedRange">Prefixed Range (S01E01-E03)</option>
              <option value="scene">Scene (S01E01E02E03)</option>
              <option value="range">Range (S01E01-03)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Importing */}
      <div className="glass-card rounded-xl p-6">
        <h2 className="text-xl font-bold mb-4">Importing</h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Use Hardlinks</p>
              <p className="text-sm text-gray-400">Create hardlinks instead of copying files (saves disk space)</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={settings.useHardlinks}
                onChange={(e) => updateSetting('useHardlinks', e.target.checked)}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Import Extra Files</p>
              <p className="text-sm text-gray-400">Import subtitles, nfo files, etc.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={settings.importExtraFiles}
                onChange={(e) => updateSetting('importExtraFiles', e.target.checked)}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
            </label>
          </div>

          {settings.importExtraFiles && (
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Extra File Extensions</label>
              <Input
                value={settings.extraFileExtensions}
                onChange={(e) => updateSetting('extraFileExtensions', e.target.value)}
                placeholder="srt,nfo,sub,idx"
                className="bg-white/5 border-white/10"
              />
            </div>
          )}

          <div>
            <label className="text-sm text-gray-400 mb-2 block">Minimum Free Space (MB)</label>
            <Input
              type="number"
              value={settings.minFreeSpaceForImporting}
              onChange={(e) => updateSetting('minFreeSpaceForImporting', parseInt(e.target.value))}
              className="bg-white/5 border-white/10 w-32"
            />
          </div>
        </div>
      </div>

      {/* File Management */}
      <div className="glass-card rounded-xl p-6">
        <h2 className="text-xl font-bold mb-4">File Management</h2>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Propers and Repacks</label>
            <select
              value={settings.downloadProperAndRepacks}
              onChange={(e) => updateSetting('downloadProperAndRepacks', e.target.value)}
              className="w-full h-10 px-3 rounded-md bg-white/5 border border-white/10 text-white"
            >
              <option value="preferAndUpgrade">Prefer and Upgrade</option>
              <option value="doNotUpgrade">Do Not Upgrade</option>
              <option value="doNotPrefer">Do Not Prefer</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block">Rescan Series Folder</label>
            <select
              value={settings.rescanAfterRefresh}
              onChange={(e) => updateSetting('rescanAfterRefresh', e.target.value)}
              className="w-full h-10 px-3 rounded-md bg-white/5 border border-white/10 text-white"
            >
              <option value="always">Always</option>
              <option value="afterManual">After Manual Refresh</option>
              <option value="never">Never</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block">Recycling Bin Path (Optional)</label>
            <Input
              value={settings.recyclingBin}
              onChange={(e) => updateSetting('recyclingBin', e.target.value)}
              placeholder="/path/to/recycle/bin"
              className="bg-white/5 border-white/10"
            />
            <p className="text-xs text-gray-500 mt-1">Leave empty to permanently delete files</p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button className="bg-violet-600 hover:bg-violet-700">
          Save Media Management Settings
        </Button>
      </div>
    </div>
  );
};

// Quality Profiles Sub-Tab - Sonarr-like quality profiles
const QualityProfilesSubTab = () => {
  const [profiles, setProfiles] = React.useState([
    {
      id: 1,
      name: 'Any',
      upgradeUntil: 'Bluray-1080p',
      cutoff: 'Bluray-1080p',
      qualities: ['HDTV-720p', 'HDTV-1080p', 'WEB-480p', 'WEB-720p', 'WEB-1080p', 'Bluray-720p', 'Bluray-1080p'],
    },
    {
      id: 2,
      name: 'HD - 720p/1080p',
      upgradeUntil: 'Bluray-1080p',
      cutoff: 'WEB-1080p',
      qualities: ['HDTV-720p', 'HDTV-1080p', 'WEB-720p', 'WEB-1080p', 'Bluray-720p', 'Bluray-1080p'],
    },
    {
      id: 3,
      name: 'Ultra-HD',
      upgradeUntil: 'Bluray-2160p',
      cutoff: 'WEB-2160p',
      qualities: ['WEB-2160p', 'Bluray-2160p', 'Remux-2160p'],
    },
  ]);

  const allQualities = [
    { id: 'SDTV', name: 'SDTV', resolution: '480p' },
    { id: 'WEB-480p', name: 'WEB 480p', resolution: '480p' },
    { id: 'DVD', name: 'DVD', resolution: '480p' },
    { id: 'HDTV-720p', name: 'HDTV 720p', resolution: '720p' },
    { id: 'WEB-720p', name: 'WEB 720p', resolution: '720p' },
    { id: 'Bluray-720p', name: 'Bluray 720p', resolution: '720p' },
    { id: 'HDTV-1080p', name: 'HDTV 1080p', resolution: '1080p' },
    { id: 'WEB-1080p', name: 'WEB 1080p', resolution: '1080p' },
    { id: 'Bluray-1080p', name: 'Bluray 1080p', resolution: '1080p' },
    { id: 'Remux-1080p', name: 'Remux 1080p', resolution: '1080p' },
    { id: 'WEB-2160p', name: 'WEB 2160p', resolution: '4K' },
    { id: 'Bluray-2160p', name: 'Bluray 2160p', resolution: '4K' },
    { id: 'Remux-2160p', name: 'Remux 2160p', resolution: '4K' },
  ];

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Layers className="w-5 h-5 text-violet-400" />
              Quality Profiles
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Define which qualities are acceptable and preferred for downloads
            </p>
          </div>
          <Button className="bg-violet-600 hover:bg-violet-700">
            <Plus className="w-4 h-4 mr-2" /> Add Profile
          </Button>
        </div>

        <div className="space-y-4">
          {profiles.map((profile) => (
            <div key={profile.id} className="p-4 rounded-xl bg-surface border border-white/10 hover:border-violet-500/30 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-600/20 flex items-center justify-center">
                    <Layers className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <p className="font-semibold">{profile.name}</p>
                    <p className="text-xs text-gray-400">
                      Upgrade until: {profile.upgradeUntil}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="border-white/20">
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="hover:bg-red-500/20 text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {profile.qualities.map((quality) => (
                  <span 
                    key={quality}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      quality === profile.cutoff 
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-white/5 text-gray-300'
                    }`}
                  >
                    {quality}
                    {quality === profile.cutoff && ' (cutoff)'}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quality Definitions */}
      <div className="glass-card rounded-xl p-6">
        <h2 className="text-xl font-bold mb-4">Quality Definitions</h2>
        <p className="text-sm text-gray-400 mb-4">
          Configure size limits for each quality level
        </p>
        
        <div className="space-y-3">
          {allQualities.slice(6).map((quality) => (
            <div key={quality.id} className="flex items-center justify-between p-3 rounded-lg bg-surface border border-white/10">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  quality.resolution === '4K' ? 'bg-purple-500/20 text-purple-400' :
                  quality.resolution === '1080p' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {quality.resolution}
                </span>
                <span className="font-medium">{quality.name}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span>Min: 0 MB</span>
                <span>Max: Unlimited</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Mass Editor Sub-Tab - Sonarr-like mass editor
const MassEditorSubTab = () => {
  const [selectedItems, setSelectedItems] = React.useState([]);
  const [filterStatus, setFilterStatus] = React.useState('all');
  
  // Mock data for demo
  const mockSeries = [
    { id: 1, title: 'Breaking Bad', status: 'ended', qualityProfile: 'HD - 720p/1080p', path: '/media/tv/Breaking Bad', monitored: true },
    { id: 2, title: 'Game of Thrones', status: 'ended', qualityProfile: 'Ultra-HD', path: '/media/tv/Game of Thrones', monitored: true },
    { id: 3, title: 'The Mandalorian', status: 'continuing', qualityProfile: 'Ultra-HD', path: '/media/tv/The Mandalorian', monitored: true },
    { id: 4, title: 'Stranger Things', status: 'continuing', qualityProfile: 'HD - 720p/1080p', path: '/media/tv/Stranger Things', monitored: false },
    { id: 5, title: 'The Witcher', status: 'continuing', qualityProfile: 'HD - 720p/1080p', path: '/media/tv/The Witcher', monitored: true },
  ];

  const toggleSelectAll = () => {
    if (selectedItems.length === mockSeries.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(mockSeries.map(s => s.id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-violet-400" />
              Mass Editor
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Edit multiple series at once
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-10 px-3 rounded-md bg-white/5 border border-white/10 text-white text-sm"
            >
              <option value="all">All Series</option>
              <option value="monitored">Monitored</option>
              <option value="unmonitored">Unmonitored</option>
              <option value="continuing">Continuing</option>
              <option value="ended">Ended</option>
            </select>
          </div>
        </div>

        {/* Selected actions bar */}
        {selectedItems.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-violet-500/10 border border-violet-500/30 flex items-center justify-between">
            <span className="text-sm text-violet-300">
              {selectedItems.length} item(s) selected
            </span>
            <div className="flex gap-2">
              <select className="h-8 px-2 rounded bg-white/10 border border-white/20 text-sm">
                <option value="">Change Quality Profile...</option>
                <option value="any">Any</option>
                <option value="hd">HD - 720p/1080p</option>
                <option value="uhd">Ultra-HD</option>
              </select>
              <Button size="sm" variant="outline" className="border-white/20">
                Set Monitored
              </Button>
              <Button size="sm" variant="outline" className="border-white/20">
                Set Unmonitored
              </Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700">
                Delete Selected
              </Button>
            </div>
          </div>
        )}

        {/* Series table */}
        <div className="border border-white/10 rounded-lg overflow-hidden">
          <div className="bg-white/5 p-3 border-b border-white/10 flex items-center gap-4">
            <input 
              type="checkbox"
              checked={selectedItems.length === mockSeries.length}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-gray-600 bg-transparent"
            />
            <span className="flex-1 font-medium text-sm">Title</span>
            <span className="w-32 font-medium text-sm">Status</span>
            <span className="w-40 font-medium text-sm">Quality Profile</span>
            <span className="w-24 font-medium text-sm text-center">Monitored</span>
          </div>
          
          {mockSeries.map((series) => (
            <div 
              key={series.id}
              className={`p-3 border-b border-white/5 flex items-center gap-4 hover:bg-white/5 transition-colors ${
                selectedItems.includes(series.id) ? 'bg-violet-500/10' : ''
              }`}
            >
              <input 
                type="checkbox"
                checked={selectedItems.includes(series.id)}
                onChange={() => toggleSelect(series.id)}
                className="w-4 h-4 rounded border-gray-600 bg-transparent"
              />
              <span className="flex-1 font-medium">{series.title}</span>
              <span className={`w-32 text-sm ${
                series.status === 'continuing' ? 'text-green-400' : 'text-gray-400'
              }`}>
                {series.status === 'continuing' ? 'Continuing' : 'Ended'}
              </span>
              <span className="w-40 text-sm text-gray-300">{series.qualityProfile}</span>
              <span className="w-24 text-center">
                {series.monitored ? (
                  <span className="inline-block w-3 h-3 rounded-full bg-green-500"></span>
                ) : (
                  <span className="inline-block w-3 h-3 rounded-full bg-gray-600"></span>
                )}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 text-sm text-gray-400">
          Showing {mockSeries.length} series
        </div>
      </div>
    </div>
  );
};

// Manual Import Sub-Tab
const ManualImportSubTab = ({ 
  manualImportPath, setManualImportPath, manualImportFiles,
  onManualImportScan, onImportFiles, onOpenFileBrowser
}) => (
  <div className="space-y-6">
    <div className="glass-card rounded-xl p-6">
      <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
        <FolderInput className="w-5 h-5 text-violet-400" />
        Manual Import
      </h2>

      <div className="space-y-4">
        <div>
          <label className="text-sm text-gray-400 mb-2 block">Path to Import</label>
          <div className="flex gap-2">
            <Input
              value={manualImportPath}
              onChange={(e) => setManualImportPath(e.target.value)}
              placeholder="/downloads/completed or D:\Downloads"
              className="bg-white/5 border-white/10 flex-1"
            />
            <Button
              type="button"
              onClick={() => onOpenFileBrowser(manualImportPath || '/')}
              className="bg-violet-600 hover:bg-violet-700 px-3"
              title="Browse folders"
            >
              <FolderSearch className="w-4 h-4" />
            </Button>
            <Button
              onClick={onManualImportScan}
              className="bg-green-600 hover:bg-green-700"
            >
              <ScanLine className="w-4 h-4 mr-2" /> Scan
            </Button>
          </div>
        </div>

        {manualImportFiles.length > 0 && (
          <div className="border border-white/10 rounded-lg overflow-hidden">
            <div className="p-3 bg-white/5 border-b border-white/10 flex justify-between items-center">
              <span className="font-medium">{manualImportFiles.length} files found</span>
              <Button
                size="sm"
                onClick={() => onImportFiles(manualImportFiles)}
                className="bg-green-600 hover:bg-green-700"
              >
                <Import className="w-4 h-4 mr-2" /> Import All
              </Button>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {manualImportFiles.map((file, index) => (
                <div key={index} className="p-3 border-b border-white/5 flex items-center gap-3">
                  <Film className="w-5 h-5 text-violet-400" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-xs text-gray-500 truncate">{file.path}</p>
                  </div>
                  <span className="text-sm text-gray-400">
                    {(file.size / (1024 * 1024 * 1024)).toFixed(2)} GB
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {manualImportFiles.length === 0 && (
          <div className="p-8 text-center text-gray-400 border border-dashed border-white/10 rounded-lg">
            <FolderInput className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Enter a path and click Scan to find importable files</p>
          </div>
        )}
      </div>
    </div>
  </div>
);
