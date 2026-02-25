/**
 * FolderBrowser - Directory picker component for library path selection
 * OS-aware: Works on Windows, Linux, and macOS
 */

import React, { useState, useEffect } from 'react';
import { Folder, FolderOpen, ChevronRight, ChevronUp, Loader2, Home, HardDrive, Monitor } from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const FolderBrowser = ({ onSelect, initialPath, selectedPath }) => {
  const [currentPath, setCurrentPath] = useState(initialPath || '');
  const [items, setItems] = useState([]);
  const [drives, setDrives] = useState([]);
  const [parentPath, setParentPath] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedPath, setExpandedPath] = useState(selectedPath || '');
  const [osType, setOsType] = useState('unknown'); // 'windows', 'linux', 'darwin'

  useEffect(() => {
    // Fetch initial path and detect OS
    fetchDirectories(currentPath || getDefaultPath());
  }, []);

  useEffect(() => {
    if (currentPath) {
      fetchDirectories(currentPath);
    }
  }, [currentPath]);

  const getDefaultPath = () => {
    // Will be determined by the backend based on OS
    return '';
  };

  const fetchDirectories = async (path) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/api/filesystem/browse`, {
        params: { path: path || '' },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Get OS type from response
      if (res.data.os_type) {
        setOsType(res.data.os_type);
      }
      
      // Get drives/mount points from response
      if (res.data.drives && res.data.drives.length > 0) {
        setDrives(res.data.drives);
      }
      
      // Update current path from response if it was adjusted
      if (res.data.current_path) {
        setCurrentPath(res.data.current_path);
      }
      
      // Filter only directories
      const directories = (res.data.items || []).filter(item => item.type === 'directory');
      setItems(directories);
      setParentPath(res.data.parent_path);
    } catch (err) {
      console.error('Filesystem browse error:', err);
      setError('Failed to browse filesystem');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (path) => {
    setCurrentPath(path);
    setExpandedPath(path);
    onSelect(path);
  };

  const handleSelect = (dir) => {
    setExpandedPath(dir.path);
    onSelect(dir.path);
  };

  // Dynamic quick paths based on OS
  const getQuickPaths = () => {
    // If we have drives from the backend, use those
    if (drives.length > 0) {
      return drives.slice(0, 5).map(d => ({
        name: d.name,
        path: d.path,
        icon: d.name.includes(':') ? HardDrive : d.path === '/' ? Monitor : Folder
      }));
    }
    
    // Fallback based on detected OS
    if (osType === 'windows') {
      return [
        { name: 'C:', path: 'C:\\', icon: HardDrive },
        { name: 'D:', path: 'D:\\', icon: HardDrive },
        { name: 'Documents', path: 'C:\\Users', icon: Folder },
      ];
    } else if (osType === 'darwin') {
      return [
        { name: 'Home', path: '/Users', icon: Home },
        { name: 'Volumes', path: '/Volumes', icon: HardDrive },
        { name: 'Root', path: '/', icon: Monitor },
      ];
    } else {
      // Linux default
      return [
        { name: 'Home', path: '/home', icon: Home },
        { name: 'Media', path: '/media', icon: HardDrive },
        { name: 'Root', path: '/', icon: Monitor },
      ];
    }
  };

  const quickPaths = getQuickPaths();

  return (
    <div className="border border-white/10 rounded-lg bg-black/30" data-testid="folder-browser">
      {/* Quick Access - OS-aware drives */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-white/10 bg-white/5">
        {quickPaths.map(qp => (
          <Button 
            key={qp.path}
            variant="ghost" 
            size="sm" 
            className="h-7 text-xs hover:bg-white/10"
            onClick={() => handleNavigate(qp.path)}
          >
            <qp.icon className="w-3 h-3 mr-1" />
            {qp.name}
          </Button>
        ))}
      </div>
      
      {/* Current Path */}
      <div className="flex items-center gap-2 p-2 border-b border-white/10 text-sm bg-white/5">
        <Folder className="w-4 h-4 text-gray-400" />
        <span className="text-gray-300 truncate flex-1 font-mono text-xs">{currentPath || 'Select a location'}</span>
        {parentPath && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 px-2 hover:bg-white/10"
            onClick={() => handleNavigate(parentPath)}
          >
            <ChevronUp className="w-4 h-4" />
          </Button>
        )}
      </div>
      
      {/* Directory List */}
      <ScrollArea className="h-48">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-32 text-sm text-red-400">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-gray-500">
            No subdirectories found
          </div>
        ) : (
          <div className="p-1">
            {items.filter(item => !item.is_parent).map(dir => (
              <div 
                key={dir.path}
                className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                  expandedPath === dir.path 
                    ? 'bg-violet-500/20 text-violet-300' 
                    : 'hover:bg-white/10 text-gray-300'
                }`}
                onClick={() => handleNavigate(dir.path)}
                data-testid={`folder-${dir.name}`}
              >
                {expandedPath === dir.path ? (
                  <FolderOpen className="w-4 h-4 text-violet-400" />
                ) : (
                  <Folder className="w-4 h-4 text-gray-500" />
                )}
                <span className="flex-1 truncate text-sm">{dir.name}</span>
                {dir.item_count > 0 && (
                  <span className="text-xs text-gray-500">{dir.item_count}</span>
                )}
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
      
      {/* Selected Path */}
      {expandedPath && (
        <div className="p-2 border-t border-white/10 bg-violet-500/10">
          <p className="text-xs text-gray-400">Selected:</p>
          <p className="text-sm font-mono truncate text-violet-300">{expandedPath}</p>
        </div>
      )}
    </div>
  );
};

export default FolderBrowser;
