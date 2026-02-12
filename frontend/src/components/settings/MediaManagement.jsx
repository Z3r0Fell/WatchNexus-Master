import React, { useState } from 'react';
import { FolderCog, Layers, Plus, Trash2 } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

const Toggle = ({ checked, onChange }) => (
  <label className="relative inline-flex items-center cursor-pointer">
    <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
    <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600" />
  </label>
);

export const MediaManagementSubTab = () => {
  const [renameEpisodes, setRenameEpisodes] = useState(true);
  const [useHardlinks, setUseHardlinks] = useState(true);
  const [importExtraFiles, setImportExtraFiles] = useState(true);
  const [standardFormat, setStandardFormat] = useState('{Series Title} - S{season:00}E{episode:00}');
  const [seriesFolder, setSeriesFolder] = useState('{Series Title} ({Series Year})');
  const [seasonFolder, setSeasonFolder] = useState('Season {season:00}');
  const [minFreeSpace, setMinFreeSpace] = useState(100);
  const [recyclingBin, setRecyclingBin] = useState('');

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
            <Toggle checked={renameEpisodes} onChange={(e) => setRenameEpisodes(e.target.checked)} />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Standard Episode Format</label>
            <Input value={standardFormat} onChange={(e) => setStandardFormat(e.target.value)} className="bg-white/5 border-white/10 font-mono text-sm" />
            <p className="text-xs text-gray-500 mt-1">Preview: Breaking Bad - S05E16</p>
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Series Folder Format</label>
            <Input value={seriesFolder} onChange={(e) => setSeriesFolder(e.target.value)} className="bg-white/5 border-white/10 font-mono text-sm" />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Season Folder Format</label>
            <Input value={seasonFolder} onChange={(e) => setSeasonFolder(e.target.value)} className="bg-white/5 border-white/10 font-mono text-sm" />
          </div>
        </div>
      </div>

      <div className="glass-card rounded-xl p-6">
        <h2 className="text-xl font-bold mb-4">Importing</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Use Hardlinks</p>
              <p className="text-sm text-gray-400">Create hardlinks instead of copying</p>
            </div>
            <Toggle checked={useHardlinks} onChange={(e) => setUseHardlinks(e.target.checked)} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Import Extra Files</p>
              <p className="text-sm text-gray-400">Import subtitles, nfo files</p>
            </div>
            <Toggle checked={importExtraFiles} onChange={(e) => setImportExtraFiles(e.target.checked)} />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Minimum Free Space (MB)</label>
            <Input type="number" value={minFreeSpace} onChange={(e) => setMinFreeSpace(parseInt(e.target.value))} className="bg-white/5 border-white/10 w-32" />
          </div>
        </div>
      </div>

      <div className="glass-card rounded-xl p-6">
        <h2 className="text-xl font-bold mb-4">File Management</h2>
        <div>
          <label className="text-sm text-gray-400 mb-2 block">Recycling Bin Path (Optional)</label>
          <Input value={recyclingBin} onChange={(e) => setRecyclingBin(e.target.value)} placeholder="/path/to/recycle/bin" className="bg-white/5 border-white/10" />
          <p className="text-xs text-gray-500 mt-1">Leave empty to permanently delete files</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button className="bg-violet-600 hover:bg-violet-700">Save Settings</Button>
      </div>
    </div>
  );
};

const ProfileCard = ({ profile, onEdit, onDelete }) => (
  <div className="p-4 rounded-xl bg-surface border border-white/10 hover:border-violet-500/30">
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
        <Button size="sm" variant="outline" className="border-white/20" onClick={onEdit}>Edit</Button>
        <Button size="sm" variant="ghost" className="hover:bg-red-500/20 text-red-400" onClick={onDelete}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
    <div className="flex flex-wrap gap-2">
      <span className="px-2 py-1 rounded text-xs font-medium bg-white/5 text-gray-300">{profile.qualities[0]}</span>
      <span className="px-2 py-1 rounded text-xs font-medium bg-white/5 text-gray-300">{profile.qualities[1]}</span>
      {profile.qualities[2] && <span className="px-2 py-1 rounded text-xs font-medium bg-white/5 text-gray-300">{profile.qualities[2]}</span>}
    </div>
  </div>
);

export const QualityProfilesSubTab = () => {
  const profiles = [
    { id: 1, name: 'Any', upgradeUntil: 'Bluray-1080p', qualities: ['WEB-720p', 'WEB-1080p', 'Bluray-1080p'] },
    { id: 2, name: 'HD - 720p/1080p', upgradeUntil: 'Bluray-1080p', qualities: ['WEB-720p', 'WEB-1080p'] },
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
            <p className="text-sm text-gray-400 mt-1">Define acceptable qualities for downloads</p>
          </div>
          <Button className="bg-violet-600 hover:bg-violet-700">
            <Plus className="w-4 h-4 mr-2" /> Add Profile
          </Button>
        </div>
        <div className="space-y-4">
          <ProfileCard profile={profiles[0]} onEdit={() => {}} onDelete={() => {}} />
          <ProfileCard profile={profiles[1]} onEdit={() => {}} onDelete={() => {}} />
          <ProfileCard profile={profiles[2]} onEdit={() => {}} onDelete={() => {}} />
        </div>
      </div>
    </div>
  );
};

const SeriesRow = ({ series, isSelected, onSelect }) => (
  <div onClick={onSelect} className={`p-3 border-b border-white/5 flex items-center gap-4 cursor-pointer hover:bg-white/5 ${isSelected ? 'bg-violet-500/10' : ''}`}>
    <span className="flex-1 font-medium">{series.title}</span>
    <span className={`w-24 text-sm ${series.status === 'continuing' ? 'text-green-400' : 'text-gray-400'}`}>
      {series.status === 'continuing' ? 'Continuing' : 'Ended'}
    </span>
    <span className="w-20 text-center">
      <span className={`inline-block w-3 h-3 rounded-full ${series.monitored ? 'bg-green-500' : 'bg-gray-600'}`} />
    </span>
  </div>
);

export const MassEditorSubTab = () => {
  const [selectedItems, setSelectedItems] = useState([]);
  const series1 = { id: 1, title: 'Breaking Bad', status: 'ended', monitored: true };
  const series2 = { id: 2, title: 'Game of Thrones', status: 'ended', monitored: true };
  const series3 = { id: 3, title: 'The Mandalorian', status: 'continuing', monitored: true };
  const series4 = { id: 4, title: 'Stranger Things', status: 'continuing', monitored: false };

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
          <SeriesRow series={series1} isSelected={selectedItems.includes(1)} onSelect={() => toggleSelect(1)} />
          <SeriesRow series={series2} isSelected={selectedItems.includes(2)} onSelect={() => toggleSelect(2)} />
          <SeriesRow series={series3} isSelected={selectedItems.includes(3)} onSelect={() => toggleSelect(3)} />
          <SeriesRow series={series4} isSelected={selectedItems.includes(4)} onSelect={() => toggleSelect(4)} />
        </div>
      </div>
    </div>
  );
};
