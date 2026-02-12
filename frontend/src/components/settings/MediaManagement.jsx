import React, { useState } from 'react';
import { FolderCog, Layers, Plus, Trash2 } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

// Media Management Sub-Tab - Sonarr-like settings
export const MediaManagementSubTab = () => {
  const [settings, setSettings] = useState({
    renameEpisodes: true,
    replaceIllegalCharacters: true,
    standardEpisodeFormat: '{Series Title} - S{season:00}E{episode:00} - {Episode Title}',
    seriesFolderFormat: '{Series Title} ({Series Year})',
    seasonFolderFormat: 'Season {season:00}',
    multiEpisodeStyle: 'prefixedRange',
    useHardlinks: true,
    importExtraFiles: true,
    extraFileExtensions: 'srt,nfo,sub',
    minFreeSpaceForImporting: 100,
    downloadProperAndRepacks: 'preferAndUpgrade',
    rescanAfterRefresh: 'always',
    recyclingBin: '',
  });

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const ToggleSwitch = ({ checked, onChange }) => (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
    </label>
  );

  return (
    <div className="space-y-6">
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
            <ToggleSwitch 
              checked={settings.renameEpisodes} 
              onChange={(e) => updateSetting('renameEpisodes', e.target.checked)} 
            />
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
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block">Season Folder Format</label>
            <Input
              value={settings.seasonFolderFormat}
              onChange={(e) => updateSetting('seasonFolderFormat', e.target.value)}
              className="bg-white/5 border-white/10 font-mono text-sm"
            />
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
            </select>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-xl p-6">
        <h2 className="text-xl font-bold mb-4">Importing</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Use Hardlinks</p>
              <p className="text-sm text-gray-400">Create hardlinks instead of copying files</p>
            </div>
            <ToggleSwitch 
              checked={settings.useHardlinks} 
              onChange={(e) => updateSetting('useHardlinks', e.target.checked)} 
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Import Extra Files</p>
              <p className="text-sm text-gray-400">Import subtitles, nfo files, etc.</p>
            </div>
            <ToggleSwitch 
              checked={settings.importExtraFiles} 
              onChange={(e) => updateSetting('importExtraFiles', e.target.checked)} 
            />
          </div>

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
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button className="bg-violet-600 hover:bg-violet-700">
          Save Media Management Settings
        </Button>
      </div>
    </div>
  );
};

// Quality Profiles Sub-Tab
export const QualityProfilesSubTab = () => {
  const profiles = [
    { id: 1, name: 'Any', upgradeUntil: 'Bluray-1080p', qualities: ['HDTV-720p', 'WEB-1080p', 'Bluray-1080p'] },
    { id: 2, name: 'HD - 720p/1080p', upgradeUntil: 'Bluray-1080p', qualities: ['WEB-720p', 'WEB-1080p', 'Bluray-1080p'] },
    { id: 3, name: 'Ultra-HD', upgradeUntil: 'Bluray-2160p', qualities: ['WEB-2160p', 'Bluray-2160p'] },
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
            <p className="text-sm text-gray-400 mt-1">Define which qualities are acceptable</p>
          </div>
          <Button className="bg-violet-600 hover:bg-violet-700">
            <Plus className="w-4 h-4 mr-2" /> Add Profile
          </Button>
        </div>

        <div className="space-y-4">
          {profiles.map((profile) => (
            <div key={profile.id} className="p-4 rounded-xl bg-surface border border-white/10 hover:border-violet-500/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-600/20 flex items-center justify-center">
                    <Layers className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <p className="font-semibold">{profile.name}</p>
                    <p className="text-xs text-gray-400">Upgrade until: {profile.upgradeUntil}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="border-white/20">Edit</Button>
                  <Button size="sm" variant="ghost" className="hover:bg-red-500/20 text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {profile.qualities.map((q) => (
                  <span key={q} className="px-2 py-1 rounded text-xs font-medium bg-white/5 text-gray-300">{q}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Mass Editor Sub-Tab
export const MassEditorSubTab = () => {
  const [selectedItems, setSelectedItems] = useState([]);
  
  const mockSeries = [
    { id: 1, title: 'Breaking Bad', status: 'ended', qualityProfile: 'HD', monitored: true },
    { id: 2, title: 'Game of Thrones', status: 'ended', qualityProfile: 'Ultra-HD', monitored: true },
    { id: 3, title: 'The Mandalorian', status: 'continuing', qualityProfile: 'Ultra-HD', monitored: true },
    { id: 4, title: 'Stranger Things', status: 'continuing', qualityProfile: 'HD', monitored: false },
  ];

  const toggleSelect = (id) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-xl p-6">
        <h2 className="text-xl font-bold mb-4">Mass Editor</h2>
        <p className="text-sm text-gray-400 mb-4">Edit multiple series at once</p>

        {selectedItems.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-violet-500/10 border border-violet-500/30 flex items-center justify-between">
            <span className="text-sm text-violet-300">{selectedItems.length} selected</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="border-white/20">Set Monitored</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700">Delete</Button>
            </div>
          </div>
        )}

        <div className="border border-white/10 rounded-lg overflow-hidden">
          <div className="bg-white/5 p-3 border-b border-white/10 flex items-center gap-4">
            <span className="flex-1 font-medium text-sm">Title</span>
            <span className="w-24 font-medium text-sm">Status</span>
            <span className="w-20 font-medium text-sm text-center">Monitored</span>
          </div>
          
          {mockSeries.map((series) => (
            <div 
              key={series.id}
              onClick={() => toggleSelect(series.id)}
              className={`p-3 border-b border-white/5 flex items-center gap-4 cursor-pointer hover:bg-white/5 ${
                selectedItems.includes(series.id) ? 'bg-violet-500/10' : ''
              }`}
            >
              <span className="flex-1 font-medium">{series.title}</span>
              <span className={`w-24 text-sm ${series.status === 'continuing' ? 'text-green-400' : 'text-gray-400'}`}>
                {series.status === 'continuing' ? 'Continuing' : 'Ended'}
              </span>
              <span className="w-20 text-center">
                <span className={`inline-block w-3 h-3 rounded-full ${series.monitored ? 'bg-green-500' : 'bg-gray-600'}`}></span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
