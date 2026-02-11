import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FolderCog, FileText, FileType, Folder, FolderInput, FileCheck, Archive,
  FolderSearch, Layers, ListChecks, FolderOpen, Plus, Trash2, RefreshCw,
  Film, Tv, Music, Book, Edit2, Eye, EyeOff, ScanLine, Import,
  CheckSquare, Square
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import axios from 'axios';

// Media Management Component (Sonarr-like)
export const MediaManagementTab = ({ 
  mediaManagement, 
  setMediaManagement, 
  savingMediaManagement, 
  handleSaveMediaManagement,
  openFileBrowser 
}) => {
  return (
    <div className="space-y-6">
      <div className="glass-card rounded-xl p-6">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
          <FolderCog className="w-5 h-5 text-violet-400" />
          Media Management
        </h2>

        <div className="space-y-6">
          {/* File Naming Section */}
          <div className="border-b border-white/10 pb-6">
            <h3 className="font-bold flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-blue-400" />
              Episode/Movie Naming
            </h3>
            
            <div className="space-y-4">
              <label className="flex items-center gap-3">
                <Switch
                  checked={mediaManagement.rename_files}
                  onCheckedChange={(v) => setMediaManagement(p => ({ ...p, rename_files: v }))}
                />
                <div>
                  <span className="font-medium">Rename Files</span>
                  <p className="text-sm text-gray-400">Automatically rename files on import</p>
                </div>
              </label>

              <label className="flex items-center gap-3">
                <Switch
                  checked={mediaManagement.replace_illegal_chars}
                  onCheckedChange={(v) => setMediaManagement(p => ({ ...p, replace_illegal_chars: v }))}
                />
                <div>
                  <span className="font-medium">Replace Illegal Characters</span>
                  <p className="text-sm text-gray-400">Replace illegal characters in filenames</p>
                </div>
              </label>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">Colon Replacement</label>
                <select
                  value={mediaManagement.colon_replacement}
                  onChange={(e) => setMediaManagement(p => ({ ...p, colon_replacement: e.target.value }))}
                  className="w-full md:w-64 h-10 px-3 rounded-md bg-white/5 border border-white/10 text-white"
                >
                  <option value="delete">Delete</option>
                  <option value="dash">Replace with Dash</option>
                  <option value="space-dash">Replace with Space Dash</option>
                  <option value="space-dash-space">Replace with Space Dash Space</option>
                </select>
              </div>
            </div>
          </div>

          {/* Standard Formats */}
          <div className="border-b border-white/10 pb-6">
            <h3 className="font-bold flex items-center gap-2 mb-4">
              <FileType className="w-4 h-4 text-green-400" />
              Standard Formats
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Movie Format</label>
                <Input
                  value={mediaManagement.standard_movie_format}
                  onChange={(e) => setMediaManagement(p => ({ ...p, standard_movie_format: e.target.value }))}
                  className="bg-white/5 border-white/10 font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Available: {'{Movie Title}'}, {'{Release Year}'}, {'{Quality Full}'}, {'{Quality Title}'}, {'{MediaInfo Simple}'}
                </p>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">Series Format</label>
                <Input
                  value={mediaManagement.standard_series_format}
                  onChange={(e) => setMediaManagement(p => ({ ...p, standard_series_format: e.target.value }))}
                  className="bg-white/5 border-white/10 font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Available: {'{Series Title}'}, {'{season:00}'}, {'{episode:00}'}, {'{Episode Title}'}, {'{Quality Full}'}
                </p>
              </div>
            </div>
          </div>

          {/* Folders Section */}
          <div className="border-b border-white/10 pb-6">
            <h3 className="font-bold flex items-center gap-2 mb-4">
              <Folder className="w-4 h-4 text-yellow-400" />
              Folders
            </h3>
            
            <div className="space-y-4">
              <label className="flex items-center gap-3">
                <Switch
                  checked={mediaManagement.create_empty_folders}
                  onCheckedChange={(v) => setMediaManagement(p => ({ ...p, create_empty_folders: v }))}
                />
                <div>
                  <span className="font-medium">Create Empty Folders</span>
                  <p className="text-sm text-gray-400">Create empty season/series folders</p>
                </div>
              </label>

              <label className="flex items-center gap-3">
                <Switch
                  checked={mediaManagement.delete_empty_folders}
                  onCheckedChange={(v) => setMediaManagement(p => ({ ...p, delete_empty_folders: v }))}
                />
                <div>
                  <span className="font-medium">Delete Empty Folders</span>
                  <p className="text-sm text-gray-400">Delete empty folders during disk scan</p>
                </div>
              </label>
            </div>
          </div>

          {/* Importing Section */}
          <div className="border-b border-white/10 pb-6">
            <h3 className="font-bold flex items-center gap-2 mb-4">
              <FolderInput className="w-4 h-4 text-purple-400" />
              Importing
            </h3>
            
            <div className="space-y-4">
              <label className="flex items-center gap-3">
                <Switch
                  checked={mediaManagement.skip_free_space_check}
                  onCheckedChange={(v) => setMediaManagement(p => ({ ...p, skip_free_space_check: v }))}
                />
                <div>
                  <span className="font-medium">Skip Free Space Check</span>
                  <p className="text-sm text-gray-400">Skip checking for free disk space before import</p>
                </div>
              </label>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">Minimum Free Space (MB)</label>
                <Input
                  type="number"
                  value={mediaManagement.minimum_free_space}
                  onChange={(e) => setMediaManagement(p => ({ ...p, minimum_free_space: parseInt(e.target.value) || 100 }))}
                  className="bg-white/5 border-white/10 w-32"
                />
              </div>

              <label className="flex items-center gap-3">
                <Switch
                  checked={mediaManagement.use_hardlinks}
                  onCheckedChange={(v) => setMediaManagement(p => ({ ...p, use_hardlinks: v }))}
                />
                <div>
                  <span className="font-medium">Use Hardlinks Instead of Copy</span>
                  <p className="text-sm text-gray-400">Use hardlinks when importing from torrent download folder</p>
                </div>
              </label>

              <label className="flex items-center gap-3">
                <Switch
                  checked={mediaManagement.import_extra_files}
                  onCheckedChange={(v) => setMediaManagement(p => ({ ...p, import_extra_files: v }))}
                />
                <div>
                  <span className="font-medium">Import Extra Files</span>
                  <p className="text-sm text-gray-400">Import matching extra files (subtitles, nfo, etc.)</p>
                </div>
              </label>

              {mediaManagement.import_extra_files && (
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Extra File Extensions</label>
                  <Input
                    value={mediaManagement.extra_file_extensions}
                    onChange={(e) => setMediaManagement(p => ({ ...p, extra_file_extensions: e.target.value }))}
                    placeholder="srt,sub,idx,nfo"
                    className="bg-white/5 border-white/10"
                  />
                </div>
              )}
            </div>
          </div>

          {/* File Management Section */}
          <div className="border-b border-white/10 pb-6">
            <h3 className="font-bold flex items-center gap-2 mb-4">
              <FileCheck className="w-4 h-4 text-cyan-400" />
              File Management
            </h3>
            
            <div className="space-y-4">
              <label className="flex items-center gap-3">
                <Switch
                  checked={mediaManagement.unmonitor_deleted_files}
                  onCheckedChange={(v) => setMediaManagement(p => ({ ...p, unmonitor_deleted_files: v }))}
                />
                <div>
                  <span className="font-medium">Unmonitor Deleted Episodes/Movies</span>
                  <p className="text-sm text-gray-400">Unmonitor when files are deleted from disk</p>
                </div>
              </label>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">Propers and Repacks</label>
                <select
                  value={mediaManagement.propers_and_repacks}
                  onChange={(e) => setMediaManagement(p => ({ ...p, propers_and_repacks: e.target.value }))}
                  className="w-full md:w-64 h-10 px-3 rounded-md bg-white/5 border border-white/10 text-white"
                >
                  <option value="preferAndUpgrade">Prefer and Upgrade</option>
                  <option value="doNotUpgrade">Do Not Upgrade Automatically</option>
                  <option value="doNotPrefer">Do Not Prefer</option>
                </select>
              </div>

              <label className="flex items-center gap-3">
                <Switch
                  checked={mediaManagement.analyze_video_files}
                  onCheckedChange={(v) => setMediaManagement(p => ({ ...p, analyze_video_files: v }))}
                />
                <div>
                  <span className="font-medium">Analyze Video Files</span>
                  <p className="text-sm text-gray-400">Extract video information (duration, resolution)</p>
                </div>
              </label>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">Rescan Folder After Refresh</label>
                <select
                  value={mediaManagement.rescan_after_refresh}
                  onChange={(e) => setMediaManagement(p => ({ ...p, rescan_after_refresh: e.target.value }))}
                  className="w-full md:w-64 h-10 px-3 rounded-md bg-white/5 border border-white/10 text-white"
                >
                  <option value="always">Always</option>
                  <option value="afterManual">After Manual Refresh</option>
                  <option value="never">Never</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">Change File Date</label>
                <select
                  value={mediaManagement.change_file_date}
                  onChange={(e) => setMediaManagement(p => ({ ...p, change_file_date: e.target.value }))}
                  className="w-full md:w-64 h-10 px-3 rounded-md bg-white/5 border border-white/10 text-white"
                >
                  <option value="none">None</option>
                  <option value="localAirDate">Local Air Date</option>
                  <option value="utcAirDate">UTC Air Date</option>
                </select>
              </div>
            </div>
          </div>

          {/* Recycling Bin Section */}
          <div className="pb-6">
            <h3 className="font-bold flex items-center gap-2 mb-4">
              <Archive className="w-4 h-4 text-red-400" />
              Recycling Bin
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Recycling Bin Path</label>
                <div className="flex gap-2">
                  <Input
                    value={mediaManagement.recycling_bin}
                    onChange={(e) => setMediaManagement(p => ({ ...p, recycling_bin: e.target.value }))}
                    placeholder="/path/to/recycle (empty to disable)"
                    className="bg-white/5 border-white/10 flex-1"
                  />
                  <Button
                    type="button"
                    onClick={() => openFileBrowser(mediaManagement.recycling_bin || '/')}
                    className="bg-violet-600 hover:bg-violet-700 px-3"
                    title="Browse folders"
                  >
                    <FolderSearch className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Files will be moved here instead of permanently deleted</p>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">Recycling Bin Cleanup (days)</label>
                <Input
                  type="number"
                  value={mediaManagement.recycling_bin_cleanup}
                  onChange={(e) => setMediaManagement(p => ({ ...p, recycling_bin_cleanup: parseInt(e.target.value) || 7 }))}
                  className="bg-white/5 border-white/10 w-32"
                />
                <p className="text-xs text-gray-500 mt-1">Set to 0 to disable automatic cleanup</p>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button 
              onClick={handleSaveMediaManagement}
              disabled={savingMediaManagement}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {savingMediaManagement ? 'Saving...' : 'Save Media Management Settings'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Quality Profiles Tab
export const QualityProfilesTab = ({ qualityProfiles, setQualityProfiles }) => {
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
              Define quality preferences for automatic downloads
            </p>
          </div>
          <Button className="bg-violet-600 hover:bg-violet-700">
            <Plus className="w-4 h-4 mr-2" /> Add Profile
          </Button>
        </div>

        <div className="space-y-3">
          {qualityProfiles.map((profile) => (
            <div key={profile.id} className="p-4 rounded-xl bg-surface border border-white/10 hover:border-violet-500/30 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">{profile.name}</h4>
                  <p className="text-sm text-gray-400 mt-1">
                    Cutoff: <span className="text-violet-400">{profile.cutoff}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="hover:bg-violet-500/20">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="hover:bg-red-500/20 text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {profile.items.map((item) => (
                  <span key={item} className="px-2 py-1 text-xs rounded bg-white/5 text-gray-300">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Mass Editor Tab
export const MassEditorTab = ({ 
  libraries, 
  selectedItems, 
  setSelectedItems, 
  handleMassEdit 
}) => {
  const toggleSelectAll = () => {
    if (selectedItems.length === libraries.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(libraries.map(l => l.id));
    }
  };

  const toggleSelectItem = (itemId) => {
    if (selectedItems.includes(itemId)) {
      setSelectedItems(prev => prev.filter(id => id !== itemId));
    } else {
      setSelectedItems(prev => [...prev, itemId]);
    }
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
              Bulk edit multiple items at once
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">{selectedItems.length} selected</span>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedItems.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
            <Button size="sm" onClick={() => handleMassEdit('monitor', true)} className="bg-green-600 hover:bg-green-700">
              <Eye className="w-4 h-4 mr-1" /> Monitor
            </Button>
            <Button size="sm" onClick={() => handleMassEdit('monitor', false)} className="bg-gray-600 hover:bg-gray-700">
              <EyeOff className="w-4 h-4 mr-1" /> Unmonitor
            </Button>
            <Button size="sm" onClick={() => handleMassEdit('scan', true)} className="bg-blue-600 hover:bg-blue-700">
              <RefreshCw className="w-4 h-4 mr-1" /> Rescan
            </Button>
            <Button size="sm" onClick={() => handleMassEdit('rename', true)} className="bg-purple-600 hover:bg-purple-700">
              <FileText className="w-4 h-4 mr-1" /> Rename
            </Button>
            <Button size="sm" onClick={() => handleMassEdit('delete', true)} className="bg-red-600 hover:bg-red-700">
              <Trash2 className="w-4 h-4 mr-1" /> Delete
            </Button>
          </div>
        )}

        {/* Items Table */}
        <div className="border border-white/10 rounded-lg overflow-hidden">
          <div className="flex items-center gap-3 p-3 bg-white/5 border-b border-white/10">
            <button onClick={toggleSelectAll} className="text-gray-400 hover:text-white">
              {selectedItems.length === libraries.length ? (
                <CheckSquare className="w-5 h-5 text-violet-400" />
              ) : (
                <Square className="w-5 h-5" />
              )}
            </button>
            <span className="flex-1 font-medium">Library</span>
            <span className="w-24 text-center">Type</span>
            <span className="w-24 text-center">Items</span>
            <span className="w-32 text-center">Status</span>
          </div>
          
          {libraries.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <p>No libraries to edit</p>
            </div>
          ) : (
            libraries.map((lib) => (
              <div 
                key={lib.id} 
                className={`flex items-center gap-3 p-3 border-b border-white/5 hover:bg-white/5 ${
                  selectedItems.includes(lib.id) ? 'bg-violet-500/10' : ''
                }`}
              >
                <button onClick={() => toggleSelectItem(lib.id)} className="text-gray-400 hover:text-white">
                  {selectedItems.includes(lib.id) ? (
                    <CheckSquare className="w-5 h-5 text-violet-400" />
                  ) : (
                    <Square className="w-5 h-5" />
                  )}
                </button>
                <div className="flex-1 flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-violet-500/20 flex items-center justify-center text-violet-400">
                    {lib.media_type === 'movies' && <Film className="w-4 h-4" />}
                    {lib.media_type === 'tv' && <Tv className="w-4 h-4" />}
                    {lib.media_type === 'music' && <Music className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="font-medium">{lib.name}</p>
                    <p className="text-xs text-gray-500 truncate max-w-[200px]">{lib.path}</p>
                  </div>
                </div>
                <span className="w-24 text-center text-sm text-gray-400 capitalize">{lib.media_type}</span>
                <span className="w-24 text-center text-sm">{lib.item_count || 0}</span>
                <span className="w-32 text-center">
                  <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">
                    Monitored
                  </span>
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// Manual Import Tab
export const ManualImportTab = ({ 
  manualImportPath,
  setManualImportPath,
  manualImportFiles,
  setManualImportFiles,
  openFileBrowser,
  handleManualImportScan,
  handleImportFiles
}) => {
  return (
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
                onClick={() => openFileBrowser(manualImportPath || '/')}
                className="bg-violet-600 hover:bg-violet-700 px-3"
                title="Browse folders"
              >
                <FolderSearch className="w-4 h-4" />
              </Button>
              <Button
                onClick={handleManualImportScan}
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
                  onClick={() => handleImportFiles(manualImportFiles)}
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
};

export default {
  MediaManagementTab,
  QualityProfilesTab,
  MassEditorTab,
  ManualImportTab
};
