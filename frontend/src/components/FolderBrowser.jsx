/**
 * FolderBrowser - Directory picker component for library path selection
 */

import React, { useState, useEffect } from 'react';
import { Folder, FolderOpen, ChevronRight, ChevronUp, Loader2, Home, HardDrive } from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const FolderBrowser = ({ onSelect, initialPath = '/', selectedPath }) => {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [directories, setDirectories] = useState([]);
  const [parentPath, setParentPath] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedPath, setExpandedPath] = useState(selectedPath || '');

  useEffect(() => {
    fetchDirectories(currentPath);
  }, [currentPath]);

  const fetchDirectories = async (path) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/api/filesystem/browse`, {
        params: { path },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.error) {
        setError(res.data.error);
        setDirectories([]);
      } else {
        setDirectories(res.data.directories || []);
        setParentPath(res.data.parent);
      }
    } catch (err) {
      setError('Failed to browse filesystem');
      setDirectories([]);
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

  const quickPaths = [
    { name: 'Home', path: '/home', icon: Home },
    { name: 'Media', path: '/media', icon: HardDrive },
    { name: 'Root', path: '/', icon: Folder },
  ];

  return (
    <div className="border rounded-lg bg-background" data-testid="folder-browser">
      {/* Quick Access */}
      <div className="flex gap-1 p-2 border-b bg-muted/30">
        {quickPaths.map(qp => (
          <Button 
            key={qp.path}
            variant="ghost" 
            size="sm" 
            className="h-7 text-xs"
            onClick={() => handleNavigate(qp.path)}
          >
            <qp.icon className="w-3 h-3 mr-1" />
            {qp.name}
          </Button>
        ))}
      </div>
      
      {/* Current Path */}
      <div className="flex items-center gap-2 p-2 border-b text-sm bg-muted/20">
        <Folder className="w-4 h-4 text-muted-foreground" />
        <span className="text-muted-foreground truncate flex-1">{currentPath}</span>
        {parentPath && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 px-2"
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
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-32 text-sm text-destructive">
            {error}
          </div>
        ) : directories.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            No subdirectories found
          </div>
        ) : (
          <div className="p-1">
            {directories.map(dir => (
              <div 
                key={dir.path}
                className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                  expandedPath === dir.path 
                    ? 'bg-primary/20 text-primary' 
                    : 'hover:bg-accent'
                }`}
                onClick={() => handleSelect(dir)}
                onDoubleClick={() => handleNavigate(dir.path)}
                data-testid={`folder-${dir.name}`}
              >
                {expandedPath === dir.path ? (
                  <FolderOpen className="w-4 h-4 text-primary" />
                ) : (
                  <Folder className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="flex-1 truncate text-sm">{dir.name}</span>
                {dir.has_children && (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
      
      {/* Selected Path */}
      {expandedPath && (
        <div className="p-2 border-t bg-muted/30">
          <p className="text-xs text-muted-foreground">Selected:</p>
          <p className="text-sm font-mono truncate">{expandedPath}</p>
        </div>
      )}
    </div>
  );
};

export default FolderBrowser;
