/**
 * AddToPlaylistButton - Add media to playlist component
 * Provides a dropdown to add movies/TV shows to user playlists
 */

import React, { useState, useEffect } from 'react';
import { ListPlus, Plus, Check, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { toast } from 'sonner';
import axios from 'axios';
import { BACKEND_URL } from '../../lib/config';
import { usePrompt } from '../../hooks/use-prompt';

const API_URL = BACKEND_URL;

export const AddToPlaylistButton = ({ 
  mediaItem, // { tmdb_id, title, media_type, poster_path, backdrop_path, duration }
  variant = "ghost",
  size = "icon",
  className = "",
  showLabel = false,
  onSuccess,
}) => {
  const { prompt: promptName, PromptDialog: PromptNameDialog } = usePrompt();
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(null);
  const [open, setOpen] = useState(false);

  // Fetch playlists when dropdown opens
  useEffect(() => {
    if (open) {
      fetchPlaylists();
    }
  }, [open]);

  const fetchPlaylists = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/drizzle/playlists`, {
        credentials: 'include',
      });
      const data = await res.json();
      setPlaylists(data.playlists || []);
    } catch (err) {
      console.error('Failed to fetch playlists:', err);
      toast.error('Failed to load playlists');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToPlaylist = async (playlistId, playlistName) => {
    if (!mediaItem) {
      toast.error('No media item specified');
      return;
    }

    setAdding(playlistId);
    try {
      const itemData = {
        media_type: mediaItem.media_type || 'movie',
        tmdb_id: mediaItem.tmdb_id || mediaItem.id,
        title: mediaItem.title || mediaItem.name,
        poster_path: mediaItem.poster_path,
        backdrop_path: mediaItem.backdrop_path,
        duration: mediaItem.duration || mediaItem.runtime * 60 || 0,
        // TV-specific fields
        season_number: mediaItem.season_number,
        episode_number: mediaItem.episode_number,
        show_title: mediaItem.show_title,
        show_tmdb_id: mediaItem.show_tmdb_id,
      };

      const res = await fetch(`${API_URL}/api/drizzle/playlists/${playlistId}/items`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(itemData),
        credentials: 'include',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Failed to add to playlist');
      }

      toast.success(`Added to "${playlistName}"`);
      setOpen(false);
      onSuccess?.();
    } catch (err) {
      console.error('Failed to add to playlist:', err);
      toast.error(err.message || 'Failed to add to playlist');
    } finally {
      setAdding(null);
    }
  };

  const handleCreatePlaylist = async () => {
    const name = await promptName({ title: 'Create Playlist', description: 'Enter a name for your new playlist:', placeholder: 'My Playlist' });
    if (!name) return;

    try {
      const params = new URLSearchParams({ name });
      const res = await fetch(`${API_URL}/api/drizzle/playlists?${params}`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!res.ok) throw new Error('Failed to create playlist');
      
      const newPlaylist = await res.json();
      toast.success('Playlist created!');
      
      // Add the current item to the new playlist
      await handleAddToPlaylist(newPlaylist.id, newPlaylist.name);
      
      // Refresh playlists
      fetchPlaylists();
    } catch (err) {
      toast.error('Failed to create playlist');
    }
  };

  return (
    <>
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={variant} 
          size={size}
          className={className}
          data-testid="add-to-playlist-btn"
        >
          <ListPlus className="w-4 h-4" />
          {showLabel && <span className="ml-2">Add to Playlist</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-surface border-white/10">
        <DropdownMenuLabel className="text-gray-400">Add to Playlist</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          </div>
        ) : playlists.length === 0 ? (
          <div className="py-2 px-2 text-sm text-gray-400 text-center">
            No playlists yet
          </div>
        ) : (
          playlists.map((playlist) => (
            <DropdownMenuItem
              key={playlist.id}
              onClick={() => handleAddToPlaylist(playlist.id, playlist.name)}
              disabled={adding === playlist.id}
              className="cursor-pointer hover:bg-white/10"
              data-testid={`playlist-option-${playlist.id}`}
            >
              {adding === playlist.id ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2 opacity-0" />
              )}
              <span className="flex-1 truncate">{playlist.name}</span>
              <span className="text-xs text-gray-500 ml-2">{playlist.item_count || 0}</span>
            </DropdownMenuItem>
          ))
        )}
        
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem 
          onClick={handleCreatePlaylist}
          className="cursor-pointer hover:bg-violet-600/20 text-violet-400"
          data-testid="create-new-playlist-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create New Playlist
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <PromptNameDialog />
    </>
  );
};

export default AddToPlaylistButton;
