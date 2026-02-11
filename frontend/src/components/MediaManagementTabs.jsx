import { 
  FolderCog, FileText, FileType, Folder, FolderInput, FileCheck, Archive,
  FolderSearch, Layers, ListChecks, FolderOpen, Plus, Trash2, RefreshCw,
  Film, Tv, Music, Edit2, Eye, EyeOff, ScanLine, Import,
  CheckSquare, Square
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';

export const MediaManagementTab = ({ 
  mediaManagement, 
  setMediaManagement, 
  savingMediaManagement, 
  handleSaveMediaManagement,
  openFileBrowser 
}) => (
  <div className="space-y-6">
    <div className="glass-card rounded-xl p-6">
      <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
        <FolderCog className="w-5 h-5 text-violet-400" />
        Media Management
      </h2>

      <div className="space-y-6">
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
              <span>Rename Files on Import</span>
            </label>
            <label className="flex items-center gap-3">
              <Switch
                checked={mediaManagement.replace_illegal_chars}
                onCheckedChange={(v) => setMediaManagement(p => ({ ...p, replace_illegal_chars: v }))}
              />
              <span>Replace Illegal Characters</span>
            </label>
          </div>
        </div>

        <div className="border-b border-white/10 pb-6">
          <h3 className="font-bold flex items-center gap-2 mb-4">
            <FileType className="w-4 h-4 text-green-400" />
            Naming Formats
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Movie Format</label>
              <Input
                value={mediaManagement.standard_movie_format}
                onChange={(e) => setMediaManagement(p => ({ ...p, standard_movie_format: e.target.value }))}
                className="bg-white/5 border-white/10 font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Series Format</label>
              <Input
                value={mediaManagement.standard_series_format}
                onChange={(e) => setMediaManagement(p => ({ ...p, standard_series_format: e.target.value }))}
                className="bg-white/5 border-white/10 font-mono text-sm"
              />
            </div>
          </div>
        </div>

        <div className="border-b border-white/10 pb-6">
          <h3 className="font-bold flex items-center gap-2 mb-4">
            <FolderInput className="w-4 h-4 text-purple-400" />
            Importing
          </h3>
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <Switch
                checked={mediaManagement.use_hardlinks}
                onCheckedChange={(v) => setMediaManagement(p => ({ ...p, use_hardlinks: v }))}
              />
              <span>Use Hardlinks Instead of Copy</span>
            </label>
            <label className="flex items-center gap-3">
              <Switch
                checked={mediaManagement.import_extra_files}
                onCheckedChange={(v) => setMediaManagement(p => ({ ...p, import_extra_files: v }))}
              />
              <span>Import Extra Files (subtitles, nfo)</span>
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
          </div>
        </div>

        <div className="border-b border-white/10 pb-6">
          <h3 className="font-bold flex items-center gap-2 mb-4">
            <Archive className="w-4 h-4 text-red-400" />
            Recycling Bin
          </h3>
          <div className="flex gap-2">
            <Input
              value={mediaManagement.recycling_bin}
              onChange={(e) => setMediaManagement(p => ({ ...p, recycling_bin: e.target.value }))}
              placeholder="/path/to/recycle (empty to disable)"
              className="bg-white/5 border-white/10 flex-1"
            />
            <Button onClick={() => openFileBrowser(mediaManagement.recycling_bin || '/')} className="bg-violet-600 hover:bg-violet-700 px-3">
              <FolderSearch className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSaveMediaManagement} disabled={savingMediaManagement} className="bg-violet-600 hover:bg-violet-700">
            {savingMediaManagement ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  </div>
);

export const QualityProfilesTab = ({ qualityProfiles }) => (
  <div className="space-y-6">
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Layers className="w-5 h-5 text-violet-400" />
          Quality Profiles
        </h2>
        <Button className="bg-violet-600 hover:bg-violet-700">
          <Plus className="w-4 h-4 mr-2" /> Add Profile
        </Button>
      </div>
      <div className="space-y-3">
        {qualityProfiles.map((profile) => (
          <div key={profile.id} className="p-4 rounded-xl bg-surface border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">{profile.name}</h4>
                <p className="text-sm text-gray-400">Cutoff: {profile.cutoff}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm"><Edit2 className="w-4 h-4" /></Button>
                <Button variant="ghost" size="sm" className="text-red-400"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {profile.items.map((item) => (
                <span key={item} className="px-2 py-1 text-xs rounded bg-white/5 text-gray-300">{item}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const MassEditorTab = ({ libraries, selectedItems, setSelectedItems, handleMassEdit }) => {
  const toggleAll = () => setSelectedItems(selectedItems.length === libraries.length ? [] : libraries.map(l => l.id));
  const toggle = (id) => setSelectedItems(selectedItems.includes(id) ? selectedItems.filter(i => i !== id) : [...selectedItems, id]);

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-violet-400" />
            Mass Editor
          </h2>
          <span className="text-sm text-gray-400">{selectedItems.length} selected</span>
        </div>

        {selectedItems.length > 0 && (
          <div className="flex gap-2 mb-4 p-3 rounded-lg bg-violet-500/10">
            <Button size="sm" onClick={() => handleMassEdit('scan', true)} className="bg-blue-600">
              <RefreshCw className="w-4 h-4 mr-1" /> Rescan
            </Button>
            <Button size="sm" onClick={() => handleMassEdit('delete', true)} className="bg-red-600">
              <Trash2 className="w-4 h-4 mr-1" /> Delete
            </Button>
          </div>
        )}

        <div className="border border-white/10 rounded-lg">
          <div className="flex items-center gap-3 p-3 bg-white/5 border-b border-white/10">
            <button onClick={toggleAll}>{selectedItems.length === libraries.length ? <CheckSquare className="w-5 h-5 text-violet-400" /> : <Square className="w-5 h-5" />}</button>
            <span className="flex-1 font-medium">Library</span>
            <span className="w-20 text-center">Type</span>
            <span className="w-20 text-center">Items</span>
          </div>
          {libraries.map((lib) => (
            <div key={lib.id} className={`flex items-center gap-3 p-3 border-b border-white/5 ${selectedItems.includes(lib.id) ? 'bg-violet-500/10' : ''}`}>
              <button onClick={() => toggle(lib.id)}>{selectedItems.includes(lib.id) ? <CheckSquare className="w-5 h-5 text-violet-400" /> : <Square className="w-5 h-5" />}</button>
              <div className="flex-1 flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-violet-500/20 flex items-center justify-center text-violet-400">
                  {lib.media_type === 'movies' ? <Film className="w-4 h-4" /> : lib.media_type === 'tv' ? <Tv className="w-4 h-4" /> : <Music className="w-4 h-4" />}
                </div>
                <span className="font-medium">{lib.name}</span>
              </div>
              <span className="w-20 text-center text-sm text-gray-400 capitalize">{lib.media_type}</span>
              <span className="w-20 text-center text-sm">{lib.item_count || 0}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const ManualImportTab = ({ manualImportPath, setManualImportPath, manualImportFiles, openFileBrowser, handleManualImportScan, handleImportFiles }) => (
  <div className="space-y-6">
    <div className="glass-card rounded-xl p-6">
      <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
        <FolderInput className="w-5 h-5 text-violet-400" />
        Manual Import
      </h2>
      <div className="space-y-4">
        <div className="flex gap-2">
          <Input value={manualImportPath} onChange={(e) => setManualImportPath(e.target.value)} placeholder="/downloads/completed" className="bg-white/5 border-white/10 flex-1" />
          <Button onClick={() => openFileBrowser(manualImportPath || '/')} className="bg-violet-600 px-3"><FolderSearch className="w-4 h-4" /></Button>
          <Button onClick={handleManualImportScan} className="bg-green-600"><ScanLine className="w-4 h-4 mr-2" /> Scan</Button>
        </div>
        {manualImportFiles.length > 0 ? (
          <div className="border border-white/10 rounded-lg">
            <div className="p-3 bg-white/5 flex justify-between">
              <span>{manualImportFiles.length} files found</span>
              <Button size="sm" onClick={() => handleImportFiles(manualImportFiles)} className="bg-green-600"><Import className="w-4 h-4 mr-2" /> Import All</Button>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {manualImportFiles.map((f, i) => (
                <div key={i} className="p-3 border-b border-white/5 flex items-center gap-3">
                  <Film className="w-5 h-5 text-violet-400" />
                  <span className="flex-1 truncate">{f.name}</span>
                  <span className="text-sm text-gray-400">{(f.size / 1073741824).toFixed(2)} GB</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-400 border border-dashed border-white/10 rounded-lg">
            <FolderInput className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Enter a path and click Scan to find files</p>
          </div>
        )}
      </div>
    </div>
  </div>
);
