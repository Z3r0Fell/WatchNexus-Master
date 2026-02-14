/**
 * Drizzle - Playlist & Queue Engine UI Components
 * 
 * Codename: Drizzle
 * Like a continuous drizzle of content - never stops flowing.
 */

import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipForward, SkipBack, List, Plus, Trash2, GripVertical, Shuffle, Repeat, Clock, Film, Tv } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Helper function to format duration
const formatDuration = (seconds) => {
  if (!seconds) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Playlist Item Component
export const PlaylistItem = ({ item, index, isPlaying, onPlay, onRemove, draggable }) => {
  const isEpisode = item.media_type === 'episode';
  
  return (
    <div 
      className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
        isPlaying ? 'bg-primary/20 border border-primary/40' : 'hover:bg-accent/50'
      }`}
      data-testid={`playlist-item-${index}`}
    >
      {draggable && (
        <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
      )}
      
      <span className="w-6 text-center text-sm text-muted-foreground">
        {index + 1}
      </span>
      
      {/* Thumbnail */}
      <div className="relative w-16 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
        {item.poster_path ? (
          <img 
            src={`https://image.tmdb.org/t/p/w92${item.poster_path}`}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {isEpisode ? <Tv className="w-4 h-4" /> : <Film className="w-4 h-4" />}
          </div>
        )}
        {isPlaying && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Play className="w-4 h-4 text-white fill-white" />
          </div>
        )}
      </div>
      
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{item.title}</p>
        {isEpisode && (
          <p className="text-xs text-muted-foreground">
            S{item.season_number}E{item.episode_number}
            {item.show_title && ` • ${item.show_title}`}
          </p>
        )}
      </div>
      
      {/* Duration */}
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {formatDuration(item.duration)}
      </span>
      
      {/* Actions */}
      <div className="flex gap-1">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7"
          onClick={() => onPlay(item)}
          data-testid={`play-item-${index}`}
        >
          <Play className="w-3 h-3" />
        </Button>
        {onRemove && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 text-destructive"
            onClick={() => onRemove(item.id)}
            data-testid={`remove-item-${index}`}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  );
};

// Playlist Card Component
export const PlaylistCard = ({ playlist, onSelect, onDelete }) => {
  const typeColors = {
    custom: 'bg-blue-500/20 text-blue-400',
    season: 'bg-purple-500/20 text-purple-400',
    collection: 'bg-amber-500/20 text-amber-400',
    marathon: 'bg-red-500/20 text-red-400',
  };
  
  return (
    <Card 
      className="group cursor-pointer hover:border-primary/50 transition-all"
      onClick={() => onSelect(playlist)}
      data-testid={`playlist-card-${playlist.id}`}
    >
      <CardHeader className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{playlist.name}</CardTitle>
            <CardDescription className="text-xs mt-1">
              {playlist.item_count} items • {formatDuration(playlist.total_duration)}
            </CardDescription>
          </div>
          <Badge className={typeColors[playlist.playlist_type] || 'bg-muted'}>
            {playlist.playlist_type}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {playlist.auto_play_next && <Badge variant="outline" className="text-xs">Auto-play</Badge>}
          {playlist.shuffle && <Badge variant="outline" className="text-xs"><Shuffle className="w-3 h-3" /></Badge>}
          {playlist.repeat && <Badge variant="outline" className="text-xs"><Repeat className="w-3 h-3" /></Badge>}
        </div>
      </CardContent>
    </Card>
  );
};

// Active Queue Panel
export const ActiveQueuePanel = ({ onClose }) => {
  const [queueState, setQueueState] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchQueueState();
  }, []);
  
  const fetchQueueState = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/drizzle/queue`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setQueueState(data);
    } catch (err) {
      console.error('Failed to fetch queue:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleClearQueue = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/drizzle/queue`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setQueueState({ active: false, queue: null });
      toast.success('Queue cleared');
    } catch (err) {
      toast.error('Failed to clear queue');
    }
  };
  
  if (loading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Loading queue...
      </div>
    );
  }
  
  if (!queueState?.active) {
    return (
      <div className="p-6 text-center" data-testid="empty-queue">
        <List className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground mb-2">No active queue</p>
        <p className="text-xs text-muted-foreground">
          Start a playlist to begin continuous playback
        </p>
      </div>
    );
  }
  
  const queue = queueState.queue;
  
  return (
    <div className="p-4" data-testid="active-queue-panel">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">{queue.playlist_name}</h3>
          <p className="text-xs text-muted-foreground">
            {queue.current_index + 1} of {queue.total_items} • {queue.items_remaining} remaining
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleClearQueue}>
          Clear
        </Button>
      </div>
      
      {queue.current_item && (
        <Card className="bg-primary/10 border-primary/30">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-8 rounded bg-muted overflow-hidden">
                {queue.current_item.poster_path && (
                  <img 
                    src={`https://image.tmdb.org/t/p/w92${queue.current_item.poster_path}`}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">Now Playing</p>
                <p className="text-xs text-muted-foreground truncate">
                  {queue.current_item.title}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        {queue.auto_play_next && (
          <Badge variant="secondary" className="text-xs">Auto-play next</Badge>
        )}
        {queue.auto_skip_intros && (
          <Badge variant="secondary" className="text-xs">Skip intros</Badge>
        )}
      </div>
    </div>
  );
};

// Play Season Button
export const PlaySeasonButton = ({ showTmdbId, showTitle, seasonNumber, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  
  const handlePlaySeason = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        show_tmdb_id: showTmdbId,
        show_title: showTitle,
        season_number: seasonNumber
      });
      
      const res = await fetch(`${API_URL}/api/drizzle/play-season?${params}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Failed to create playlist');
      
      const data = await res.json();
      toast.success(`Season ${seasonNumber} playlist created!`);
      onSuccess?.(data.playlist);
    } catch (err) {
      toast.error('Failed to create season playlist');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Button 
      variant="outline" 
      size="sm"
      onClick={handlePlaySeason}
      disabled={loading}
      data-testid="play-season-btn"
    >
      <Play className="w-4 h-4 mr-2" />
      {loading ? 'Creating...' : 'Play Season'}
    </Button>
  );
};

// Play Collection Button
export const PlayCollectionButton = ({ collectionId, collectionName, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  
  const handlePlayCollection = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        collection_id: collectionId,
        collection_name: collectionName
      });
      
      const res = await fetch(`${API_URL}/api/drizzle/play-collection?${params}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Failed to create playlist');
      
      const data = await res.json();
      toast.success(`${collectionName} playlist created!`);
      onSuccess?.(data.playlist);
    } catch (err) {
      toast.error('Failed to create collection playlist');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Button 
      variant="outline" 
      size="sm"
      onClick={handlePlayCollection}
      disabled={loading}
      data-testid="play-collection-btn"
    >
      <List className="w-4 h-4 mr-2" />
      {loading ? 'Creating...' : 'Play All'}
    </Button>
  );
};

// Main Playlists Page Component
export const PlaylistsManager = () => {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  
  useEffect(() => {
    fetchPlaylists();
  }, []);
  
  const fetchPlaylists = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/drizzle/playlists`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setPlaylists(data.playlists || []);
    } catch (err) {
      console.error('Failed to fetch playlists:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCreatePlaylist = async () => {
    const name = prompt('Enter playlist name:');
    if (!name) return;
    
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ name });
      const res = await fetch(`${API_URL}/api/drizzle/playlists?${params}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const newPlaylist = await res.json();
      setPlaylists([newPlaylist, ...playlists]);
      toast.success('Playlist created!');
    } catch (err) {
      toast.error('Failed to create playlist');
    }
  };
  
  const handleDeletePlaylist = async (playlistId) => {
    if (!window.confirm('Delete this playlist?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/drizzle/playlists/${playlistId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setPlaylists(playlists.filter(p => p.id !== playlistId));
      if (selectedPlaylist?.id === playlistId) {
        setSelectedPlaylist(null);
      }
      toast.success('Playlist deleted');
    } catch (err) {
      toast.error('Failed to delete playlist');
    }
  };
  
  const handleSetActiveQueue = async (playlistId) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/drizzle/queue/set/${playlistId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Playlist set as active queue!');
    } catch (err) {
      toast.error('Failed to set queue');
    }
  };
  
  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading playlists...
      </div>
    );
  }
  
  return (
    <div className="p-6" data-testid="playlists-manager">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Playlists</h1>
          <p className="text-muted-foreground">Manage your media playlists</p>
        </div>
        <Button onClick={handleCreatePlaylist} data-testid="create-playlist-btn">
          <Plus className="w-4 h-4 mr-2" />
          New Playlist
        </Button>
      </div>
      
      {playlists.length === 0 ? (
        <Card className="p-8 text-center">
          <List className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No playlists yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first playlist or use "Play Season" on a TV show
          </p>
          <Button onClick={handleCreatePlaylist}>
            <Plus className="w-4 h-4 mr-2" />
            Create Playlist
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {playlists.map(playlist => (
            <PlaylistCard 
              key={playlist.id}
              playlist={playlist}
              onSelect={() => {
                setSelectedPlaylist(playlist);
                handleSetActiveQueue(playlist.id);
              }}
              onDelete={() => handleDeletePlaylist(playlist.id)}
            />
          ))}
        </div>
      )}
      
      {/* Active Queue Sidebar */}
      <div className="fixed right-4 bottom-4 w-80">
        <Card>
          <CardHeader className="p-3 border-b">
            <CardTitle className="text-sm flex items-center gap-2">
              <Play className="w-4 h-4" />
              Now Playing
            </CardTitle>
          </CardHeader>
          <ActiveQueuePanel />
        </Card>
      </div>
    </div>
  );
};

export default PlaylistsManager;
