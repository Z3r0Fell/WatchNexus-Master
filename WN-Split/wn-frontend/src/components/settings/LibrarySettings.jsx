import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen, Plus, Trash2, RefreshCw, FolderSearch, FolderCog,
  Layers, ListChecks, FolderInput, ScanLine, Import
} from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { MediaManagementSubTab, QualityProfilesSubTab, MassEditorSubTab } from './MediaManagement';

export const LibrarySettings = ({
  libraries, loadingLibraries, scanningLibrary, showAddLibrary,
  setShowAddLibrary, newLibrary, setNewLibrary, onAddLibrary,
  onDeleteLibrary, onScanLibrary, onOpenFileBrowser, librarySubTab,
  setLibrarySubTab, manualImportPath, setManualImportPath,
  manualImportFiles, onManualImportScan, onImportFiles
}) => {
  const getMediaTypeIcon = (type) => {
    const icons = { movies: '🎬', tv: '📺', anime: '🎌', music: '🎵', audiobooks: '📚' };
    return icons[type] || '📁';
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex gap-2 border-b border-white/10 pb-4 flex-wrap">
        {[
          { id: 'libraries', icon: <FolderOpen className="w-4 h-4" />, label: 'Libraries' },
          { id: 'media-management', icon: <FolderCog className="w-4 h-4" />, label: 'Media Management' },
          { id: 'quality-profiles', icon: <Layers className="w-4 h-4" />, label: 'Quality Profiles' },
          { id: 'mass-editor', icon: <ListChecks className="w-4 h-4" />, label: 'Mass Editor' },
          { id: 'manual-import', icon: <FolderInput className="w-4 h-4" />, label: 'Manual Import' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setLibrarySubTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              librarySubTab === tab.id 
                ? 'bg-violet-600 text-white' 
                : 'bg-white/5 hover:bg-white/10 text-gray-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {librarySubTab === 'libraries' && (
        <LibrariesTab
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
      {librarySubTab === 'media-management' && <MediaManagementSubTab />}
      {librarySubTab === 'quality-profiles' && <QualityProfilesSubTab />}
      {librarySubTab === 'mass-editor' && <MassEditorSubTab />}
      {librarySubTab === 'manual-import' && (
        <ManualImportTab
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

const LibrariesTab = ({
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
          <p className="text-sm text-gray-400 mt-1">Add folders to scan for media content</p>
        </div>
        <Button onClick={() => setShowAddLibrary(!showAddLibrary)} className="bg-violet-600 hover:bg-violet-700">
          <Plus className="w-4 h-4 mr-2" /> Add Library
        </Button>
      </div>

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
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Folder Path *</label>
                  <div className="flex gap-2">
                    <Input
                      value={newLibrary.path}
                      onChange={(e) => setNewLibrary(p => ({ ...p, path: e.target.value }))}
                      placeholder="/media/movies"
                      className="bg-white/5 border-white/10 flex-1"
                    />
                    <Button
                      type="button"
                      onClick={() => onOpenFileBrowser(newLibrary.path || '/')}
                      className="bg-violet-600 hover:bg-violet-700 px-3"
                    >
                      <FolderSearch className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={onAddLibrary} className="bg-green-600 hover:bg-green-700">
                  <Plus className="w-4 h-4 mr-2" /> Add Library
                </Button>
                <Button variant="outline" onClick={() => setShowAddLibrary(false)} className="border-white/20">
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
            <div key={lib.id} className="p-4 rounded-xl bg-surface border border-white/10 hover:border-violet-500/30 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-3xl">{getMediaTypeIcon(lib.media_type)}</div>
                  <div>
                    <p className="font-medium">{lib.name}</p>
                    <p className="text-sm text-gray-400">{lib.path}</p>
                    <p className="text-xs text-gray-500">
                      {lib.item_count || 0} items • Last scanned: {lib.last_scanned || 'Never'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onScanLibrary(lib.id)}
                    disabled={scanningLibrary === lib.id}
                    className="border-white/20"
                  >
                    <RefreshCw className={`w-4 h-4 ${scanningLibrary === lib.id ? 'animate-spin' : ''}`} />
                    <span className="ml-2">Scan</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDeleteLibrary(lib.id)}
                    className="hover:bg-red-500/20 text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  </div>
);

const ManualImportTab = ({
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
              placeholder="/downloads/completed"
              className="bg-white/5 border-white/10 flex-1"
            />
            <Button
              type="button"
              onClick={() => onOpenFileBrowser(manualImportPath || '/')}
              className="bg-violet-600 hover:bg-violet-700 px-3"
            >
              <FolderSearch className="w-4 h-4" />
            </Button>
            <Button onClick={onManualImportScan} className="bg-green-600 hover:bg-green-700">
              <ScanLine className="w-4 h-4 mr-2" /> Scan
            </Button>
          </div>
        </div>

        {manualImportFiles.length > 0 ? (
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
                  <FolderOpen className="w-5 h-5 text-violet-400" />
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
        ) : (
          <div className="p-8 text-center text-gray-400 border border-dashed border-white/10 rounded-lg">
            <FolderInput className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Enter a path and click Scan to find importable files</p>
          </div>
        )}
      </div>
    </div>
  </div>
);
