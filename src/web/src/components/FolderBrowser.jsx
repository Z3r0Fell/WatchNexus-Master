/**
 * FolderBrowser v2 - Complete rewrite with OS-specific handling
 * Handles Windows, macOS, and Linux with proper path separators and root detection
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Folder, FolderOpen, ChevronRight, ChevronUp, Loader2, 
  Home, HardDrive, Monitor, RefreshCw, AlertCircle, 
  Check, X, Database, Laptop
} from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import axios from 'axios';
import { BACKEND_URL } from '../lib/config';

const API_URL = BACKEND_URL;

// OS-specific icons and colors
const OS_CONFIG = {
  windows: {
    icon: Monitor,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    driveIcon: HardDrive,
    name: 'Windows'
  },
  darwin: {
    icon: Laptop,
    color: 'text-gray-300',
    bgColor: 'bg-gray-500/20',
    driveIcon: Database,
    name: 'macOS'
  },
  linux: {
    icon: Monitor,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    driveIcon: Folder,
    name: 'Linux'
  },
  unknown: {
    icon: Monitor,
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20',
    driveIcon: Folder,
    name: 'Unknown OS'
  }
};

const FolderBrowser = ({ onSelect, initialPath = '', selectedPath = '' }) => {
  // State
  const [currentPath, setCurrentPath] = useState('');
  const [displayPath, setDisplayPath] = useState('');
  const [items, setItems] = useState([]);
  const [drives, setDrives] = useState([]);
  const [parentPath, setParentPath] = useState(null);
  const [isRoot, setIsRoot] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [osType, setOsType] = useState('unknown');
  const [pathSeparator, setPathSeparator] = useState('/');
  const [homeDirectory, setHomeDirectory] = useState('');
  const [mediaCount, setMediaCount] = useState(0);
  
  // Refs to prevent duplicate fetches
  const fetchingRef = useRef(false);
  const lastFetchedPath = useRef('');

  // Fetch directory contents
  const fetchDirectory = useCallback(async (path = '') => {
    // Prevent duplicate fetches
    if (fetchingRef.current && path === lastFetchedPath.current) {
      return;
    }
    
    fetchingRef.current = true;
    lastFetchedPath.current = path;
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${API_URL}/api/filesystem/browse`, {
        params: { path }
      });

      const data = response.data;
      
      // Update all state from response
      setCurrentPath(data.current_path || path);
      setDisplayPath(data.current_path || path);
      setItems(data.items || []);
      setDrives(data.drives || []);
      setParentPath(data.parent_path);
      setIsRoot(data.is_root || false);
      setOsType(data.os_type || 'unknown');
      setPathSeparator(data.path_separator || '/');
      setHomeDirectory(data.home_directory || '');
      setMediaCount(data.media_files_in_current || 0);
      
      // Notify parent of the current path
      if (data.current_path) {
        onSelect(data.current_path);
      }
      
    } catch (err) {
      console.error('FolderBrowser fetch error:', err);
      const errorMsg = err.response?.data?.detail || 'Failed to browse filesystem';
      setError(errorMsg);
      setItems([]);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [onSelect]);

  // Initial load
  useEffect(() => {
    fetchDirectory(initialPath || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle folder click - navigate into folder
  const handleFolderClick = useCallback((folderPath) => {
    if (loading || fetchingRef.current) return;
    fetchDirectory(folderPath);
  }, [fetchDirectory, loading]);

  // Handle go up
  const handleGoUp = useCallback(() => {
    if (parentPath && !loading && !fetchingRef.current) {
      fetchDirectory(parentPath);
    }
  }, [parentPath, fetchDirectory, loading]);

  // Handle drive/quick access click
  const handleDriveClick = useCallback((drivePath) => {
    if (loading || fetchingRef.current) return;
    fetchDirectory(drivePath);
  }, [fetchDirectory, loading]);

  // Refresh current directory
  const handleRefresh = useCallback(() => {
    if (!loading && !fetchingRef.current) {
      fetchDirectory(currentPath);
    }
  }, [currentPath, fetchDirectory, loading]);

  // Get OS config
  const osConfig = OS_CONFIG[osType] || OS_CONFIG.unknown;
  const OsIcon = osConfig.icon;
  const DriveIcon = osConfig.driveIcon;

  // Format path for display
  const formatPath = (path) => {
    if (!path) return 'Select a location';
    
    // Truncate long paths
    if (path.length > 50) {
      const parts = path.split(pathSeparator);
      if (parts.length > 3) {
        return `${parts[0]}${pathSeparator}...${pathSeparator}${parts.slice(-2).join(pathSeparator)}`;
      }
    }
    return path;
  };

  // Render drive/quick access buttons
  const renderDrives = () => {
    if (!drives || drives.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1.5 p-2 border-b border-white/10 bg-gradient-to-r from-white/5 to-transparent">
        {drives.slice(0, 8).map((drive, idx) => (
          <Button
            key={`${drive.path}-${idx}`}
            variant="ghost"
            size="sm"
            className={`h-7 text-xs font-medium transition-all hover:scale-105 ${
              currentPath === drive.path 
                ? `${osConfig.bgColor} ${osConfig.color}` 
                : 'hover:bg-white/10 text-gray-400 hover:text-white'
            }`}
            onClick={() => handleDriveClick(drive.path)}
            disabled={loading}
            data-testid={`drive-${drive.name.replace(/[^a-zA-Z0-9]/g, '-')}`}
          >
            <DriveIcon className="w-3 h-3 mr-1.5" />
            {drive.name}
          </Button>
        ))}
      </div>
    );
  };

  // Render current path bar
  const renderPathBar = () => (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-black/40">
      <div className={`p-1 rounded ${osConfig.bgColor}`}>
        <Folder className={`w-4 h-4 ${osConfig.color}`} />
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 leading-none mb-0.5">Current Path</p>
        <p className="text-sm font-mono text-gray-200 truncate" title={currentPath}>
          {formatPath(currentPath)}
        </p>
      </div>
      
      <div className="flex items-center gap-1">
        {/* Go Up Button */}
        {parentPath && !isRoot && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-white/10"
            onClick={handleGoUp}
            disabled={loading}
            title="Go to parent folder"
            data-testid="go-up-btn"
          >
            <ChevronUp className="w-4 h-4" />
          </Button>
        )}
        
        {/* Refresh Button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-white/10"
          onClick={handleRefresh}
          disabled={loading}
          title="Refresh"
          data-testid="refresh-btn"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </div>
  );

  // Render folder list
  const renderFolderList = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
          <Loader2 className={`w-8 h-8 animate-spin ${osConfig.color}`} />
          <p className="text-sm mt-2">Loading directories...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-48 text-center px-4">
          <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
          <p className="text-sm text-red-400 font-medium">Error</p>
          <p className="text-xs text-gray-500 mt-1">{error}</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3"
            onClick={handleRefresh}
          >
            <RefreshCw className="w-4 h-4 mr-1" /> Retry
          </Button>
        </div>
      );
    }

    const directories = items.filter(item => item.type === 'directory' && !item.is_parent);

    if (directories.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-48 text-center px-4">
          <Folder className="w-10 h-10 text-gray-600 mb-2" />
          <p className="text-sm text-gray-400">No subdirectories</p>
          {mediaCount > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {mediaCount} media file{mediaCount !== 1 ? 's' : ''} found
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="p-1.5 space-y-0.5">
        {directories.map((dir, idx) => (
          <div
            key={`${dir.path}-${idx}`}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer
              transition-all duration-150 group
              ${selectedPath === dir.path || currentPath === dir.path
                ? `${osConfig.bgColor} ring-1 ring-white/20`
                : 'hover:bg-white/10'
              }
              ${dir.permission_denied ? 'opacity-50' : ''}
            `}
            onClick={() => handleFolderClick(dir.path)}
            data-testid={`folder-item-${dir.name}`}
          >
            {/* Folder Icon */}
            <div className={`p-1.5 rounded transition-colors ${
              selectedPath === dir.path 
                ? osConfig.bgColor 
                : 'bg-white/5 group-hover:bg-white/10'
            }`}>
              {selectedPath === dir.path ? (
                <FolderOpen className={`w-4 h-4 ${osConfig.color}`} />
              ) : (
                <Folder className="w-4 h-4 text-gray-500 group-hover:text-gray-300" />
              )}
            </div>
            
            {/* Folder Name */}
            <span className={`flex-1 truncate text-sm font-medium ${
              selectedPath === dir.path ? 'text-white' : 'text-gray-300 group-hover:text-white'
            }`}>
              {dir.name}
            </span>
            
            {/* Item Count / Status */}
            <div className="flex items-center gap-2">
              {dir.permission_denied ? (
                <span className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Locked
                </span>
              ) : dir.item_count !== undefined && (
                <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                  {dir.item_count}
                </span>
              )}
              
              {/* Navigate Arrow */}
              <ChevronRight className={`w-4 h-4 transition-transform ${
                selectedPath === dir.path ? osConfig.color : 'text-gray-600'
              } group-hover:translate-x-0.5`} />
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render OS indicator
  const renderOsIndicator = () => (
    <div className="flex items-center justify-between px-3 py-1.5 border-t border-white/10 bg-black/30">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <OsIcon className={`w-3 h-3 ${osConfig.color}`} />
        <span>{osConfig.name}</span>
        {isRoot && <span className="text-gray-600">(root)</span>}
      </div>
      {mediaCount > 0 && (
        <span className="text-xs text-emerald-400">
          {mediaCount} media files
        </span>
      )}
    </div>
  );

  return (
    <div 
      className="border border-white/10 rounded-xl bg-[#1a1a1a] overflow-hidden shadow-xl"
      data-testid="folder-browser"
      data-os={osType}
    >
      {/* Quick Access Drives */}
      {renderDrives()}
      
      {/* Current Path Bar */}
      {renderPathBar()}
      
      {/* Folder List */}
      <ScrollArea className="h-56">
        {renderFolderList()}
      </ScrollArea>
      
      {/* OS Indicator */}
      {renderOsIndicator()}
      
      {/* Selected Path Display */}
      {selectedPath && selectedPath !== currentPath && (
        <div className="px-3 py-2 border-t border-white/10 bg-gradient-to-r from-emerald-500/10 to-transparent">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-emerald-400 font-medium">Selected</p>
              <p className="text-sm font-mono text-gray-300 truncate">{selectedPath}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FolderBrowser;
