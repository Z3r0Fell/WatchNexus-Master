import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { 
  Radio, Play, Pause, Star, StarOff, Eye, EyeOff, Search, 
  Plus, RefreshCw, Trash2, Upload, Download, Tv, Calendar,
  ChevronRight, Grid, List, ExternalLink, Check, X, Settings,
  Clock, ChevronLeft
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// EPG Guide View Component with Timeline
const EPGGuideView = ({ channels }) => {
  const [epgData, setEpgData] = useState({});
  const [loading, setLoading] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedProgram, setSelectedProgram] = useState(null);
  const timelineRef = useRef(null);
  const getToken = () => localStorage.getItem('watchnexus_token');

  // Generate time slots for 24 hours
  const timeSlots = Array.from({ length: 48 }, (_, i) => {
    const hour = Math.floor(i / 2);
    const minute = (i % 2) * 30;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  });

  // Fetch EPG data for all channels
  useEffect(() => {
    const fetchEPG = async () => {
      if (channels.length === 0) return;
      
      setLoading(true);
      const data = {};
      
      for (const channel of channels.slice(0, 20)) { // Limit to first 20 channels
        try {
          const res = await axios.get(`${API_URL}/api/iptv/epg/${channel.id}`, {
            headers: { Authorization: `Bearer ${getToken()}` }
          });
          data[channel.id] = res.data || [];
        } catch (err) {
          data[channel.id] = [];
        }
      }
      
      setEpgData(data);
      setLoading(false);
    };
    
    fetchEPG();
  }, [channels]);

  // Scroll to current time on load
  useEffect(() => {
    if (timelineRef.current) {
      const now = new Date();
      const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
      const scrollPosition = (minutesSinceMidnight / (24 * 60)) * timelineRef.current.scrollWidth;
      timelineRef.current.scrollLeft = scrollPosition - 200;
    }
  }, [loading]);

  // Calculate position and width for a program
  const getProgramStyle = (program) => {
    const start = new Date(program.start);
    const end = new Date(program.end);
    const dayStart = new Date(currentDate);
    dayStart.setHours(0, 0, 0, 0);
    
    const startMinutes = (start - dayStart) / (1000 * 60);
    const duration = (end - start) / (1000 * 60);
    
    // Each 30 min = 100px
    const left = (startMinutes / 30) * 100;
    const width = (duration / 30) * 100;
    
    return { left: `${left}px`, width: `${Math.max(width, 50)}px` };
  };

  // Check if program is currently airing
  const isNowPlaying = (program) => {
    const now = new Date();
    const start = new Date(program.start);
    const end = new Date(program.end);
    return now >= start && now <= end;
  };

  const navigateDay = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + direction);
    setCurrentDate(newDate);
  };

  if (channels.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="text-center py-20">
          <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <h2 className="text-xl font-bold mb-2">TV Guide</h2>
          <p className="text-gray-400 mb-4">
            Add channels first to see the program guide.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Date Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigateDay(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-center">
            <p className="font-medium">{currentDate.toLocaleDateString('en-US', { weekday: 'long' })}</p>
            <p className="text-sm text-gray-400">{currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigateDay(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentDate(new Date())}
        >
          <Clock className="w-4 h-4 mr-2" />
          Now
        </Button>
      </div>

      {/* EPG Grid */}
      <div className="rounded-xl bg-surface border border-white/5 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-red-400" />
          </div>
        ) : (
          <div className="flex">
            {/* Channel Column */}
            <div className="w-48 flex-shrink-0 border-r border-white/5">
              {/* Time header placeholder */}
              <div className="h-12 border-b border-white/5 bg-surface/50 flex items-center justify-center">
                <span className="text-xs text-gray-500">Channels</span>
              </div>
              
              {/* Channel list */}
              {channels.slice(0, 20).map((channel) => (
                <div
                  key={channel.id}
                  className="h-16 border-b border-white/5 flex items-center gap-3 px-3 hover:bg-white/5"
                >
                  <div className="w-10 h-10 rounded-lg bg-black/30 overflow-hidden flex-shrink-0">
                    {channel.logo ? (
                      <img src={channel.logo} alt="" className="w-full h-full object-contain p-1" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Radio className="w-4 h-4 text-gray-600" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{channel.name}</p>
                    <p className="text-xs text-gray-500 truncate">{channel.group}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-x-auto" ref={timelineRef}>
              {/* Time header */}
              <div className="h-12 border-b border-white/5 bg-surface/50 flex" style={{ width: `${48 * 100}px` }}>
                {timeSlots.map((time, i) => (
                  <div
                    key={time}
                    className="w-[100px] flex-shrink-0 border-r border-white/5 flex items-center justify-center"
                  >
                    <span className="text-xs text-gray-500">{time}</span>
                  </div>
                ))}
              </div>

              {/* Program rows */}
              {channels.slice(0, 20).map((channel) => (
                <div
                  key={channel.id}
                  className="h-16 border-b border-white/5 relative"
                  style={{ width: `${48 * 100}px` }}
                >
                  {/* Time grid lines */}
                  {timeSlots.map((_, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 w-[100px] border-r border-white/5"
                      style={{ left: `${i * 100}px` }}
                    />
                  ))}

                  {/* Current time indicator */}
                  {(() => {
                    const now = new Date();
                    const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
                    const left = (minutesSinceMidnight / 30) * 100;
                    return (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                        style={{ left: `${left}px` }}
                      />
                    );
                  })()}

                  {/* Programs */}
                  {(epgData[channel.id] || []).map((program, idx) => {
                    const style = getProgramStyle(program);
                    const nowPlaying = isNowPlaying(program);
                    
                    return (
                      <div
                        key={idx}
                        className={`absolute top-1 bottom-1 rounded-lg px-2 py-1 cursor-pointer transition-all overflow-hidden ${
                          nowPlaying 
                            ? 'bg-red-500/30 border border-red-500/50' 
                            : 'bg-white/5 border border-white/10 hover:bg-white/10'
                        }`}
                        style={style}
                        onClick={() => setSelectedProgram(program)}
                      >
                        <p className="text-xs font-medium truncate">{program.title}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {new Date(program.start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    );
                  })}

                  {/* No EPG data message */}
                  {(!epgData[channel.id] || epgData[channel.id].length === 0) && (
                    <div className="absolute inset-1 flex items-center justify-center text-xs text-gray-600">
                      No program data available
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Program Details Modal */}
      <AnimatePresence>
        {selectedProgram && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setSelectedProgram(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg bg-surface rounded-2xl border border-white/10 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold">{selectedProgram.title}</h2>
                  {selectedProgram.episode_title && (
                    <p className="text-gray-400">{selectedProgram.episode_title}</p>
                  )}
                </div>
                <button onClick={() => setSelectedProgram(null)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Clock className="w-4 h-4" />
                    <span>
                      {new Date(selectedProgram.start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - 
                      {new Date(selectedProgram.end).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <span className="text-gray-500">•</span>
                  <span className="text-gray-400">{selectedProgram.duration_minutes} min</span>
                  {selectedProgram.category && (
                    <>
                      <span className="text-gray-500">•</span>
                      <span className="px-2 py-0.5 rounded bg-white/10 text-xs">{selectedProgram.category}</span>
                    </>
                  )}
                </div>

                {selectedProgram.season && selectedProgram.episode && (
                  <p className="text-sm text-gray-400">
                    Season {selectedProgram.season}, Episode {selectedProgram.episode}
                  </p>
                )}

                {selectedProgram.description && (
                  <p className="text-gray-300">{selectedProgram.description}</p>
                )}

                {selectedProgram.rating && (
                  <p className="text-sm text-gray-400">Rating: {selectedProgram.rating}</p>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <Button className="flex-1 bg-gradient-to-r from-red-600 to-rose-500">
                  <Play className="w-4 h-4 mr-2" />
                  Watch Now
                </Button>
                <Button variant="outline" className="flex-1">
                  <Calendar className="w-4 h-4 mr-2" />
                  Set Reminder
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="flex items-center justify-end gap-6 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-500/30 border border-red-500/50" />
          <span>Now Playing</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-white/5 border border-white/10" />
          <span>Scheduled</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-0.5 h-3 bg-red-500" />
          <span>Current Time</span>
        </div>
      </div>
    </motion.div>
  );
};

export const LiveTVPage = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [sources, setSources] = useState([]);
  const [channels, setChannels] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [showAddSource, setShowAddSource] = useState(false);
  const [refreshingSource, setRefreshingSource] = useState(null);
  
  // Add source form
  const [newSource, setNewSource] = useState({ name: '', url: '', epg_url: '' });
  const [addingSource, setAddingSource] = useState(false);

  const getToken = () => localStorage.getItem('watchnexus_token');

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/iptv/stats`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch IPTV stats:', err);
    }
  }, []);

  const fetchSources = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/iptv/sources`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setSources(res.data || []);
    } catch (err) {
      console.error('Failed to fetch IPTV sources:', err);
    }
  }, []);

  const fetchChannels = useCallback(async () => {
    try {
      const params = {};
      if (selectedGroup) params.group = selectedGroup;
      if (favoritesOnly) params.favorites_only = true;
      if (searchQuery) params.search = searchQuery;
      
      const res = await axios.get(`${API_URL}/api/iptv/channels`, {
        params,
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setChannels(res.data || []);
    } catch (err) {
      console.error('Failed to fetch channels:', err);
    }
  }, [selectedGroup, favoritesOnly, searchQuery]);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/iptv/groups`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setGroups(res.data || []);
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchSources(), fetchChannels(), fetchGroups()]);
    setLoading(false);
  }, [fetchStats, fetchSources, fetchChannels, fetchGroups]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels, selectedGroup, favoritesOnly, searchQuery]);

  const handleAddSource = async (e) => {
    e.preventDefault();
    if (!newSource.name || !newSource.url) {
      toast.error('Name and URL are required');
      return;
    }
    
    setAddingSource(true);
    try {
      await axios.post(`${API_URL}/api/iptv/sources`, null, {
        params: { name: newSource.name, url: newSource.url, epg_url: newSource.epg_url },
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      toast.success('Source added successfully');
      setShowAddSource(false);
      setNewSource({ name: '', url: '', epg_url: '' });
      fetchAll();
    } catch (err) {
      toast.error('Failed to add source');
    } finally {
      setAddingSource(false);
    }
  };

  const handleRefreshSource = async (sourceId) => {
    setRefreshingSource(sourceId);
    try {
      await axios.post(`${API_URL}/api/iptv/sources/${sourceId}/refresh`, null, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      toast.success('Source refreshed');
      fetchAll();
    } catch (err) {
      toast.error('Failed to refresh source');
    } finally {
      setRefreshingSource(null);
    }
  };

  const handleDeleteSource = async (sourceId) => {
    if (!confirm('Delete this source?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/iptv/sources/${sourceId}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      toast.success('Source deleted');
      fetchAll();
    } catch (err) {
      toast.error('Failed to delete source');
    }
  };

  const handleToggleFavorite = async (channelId) => {
    try {
      await axios.post(`${API_URL}/api/iptv/channels/${channelId}/favorite`, null, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      fetchChannels();
    } catch (err) {
      toast.error('Failed to toggle favorite');
    }
  };

  const handleExport = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/iptv/export`, {
        params: { favorites_only: favoritesOnly },
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      
      const blob = new Blob([res.data.content], { type: 'application/x-mpegurl' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.data.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Playlist exported');
    } catch (err) {
      toast.error('Failed to export playlist');
    }
  };

  return (
    <Layout>
      <div data-testid="live-tv-page" className="min-h-screen p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-600 to-rose-500 flex items-center justify-center">
                <Radio className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  Live TV
                  <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">Relish 📺</span>
                </h1>
                <p className="text-gray-400">IPTV channels and live streams</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {stats && (
                <div className="flex gap-4 text-sm text-gray-400">
                  <span>{stats.total_channels} channels</span>
                  <span>{stats.total_groups} groups</span>
                  <span>{stats.favorites_count} favorites</span>
                </div>
              )}
              <Button onClick={handleExport} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export M3U
              </Button>
              <Button onClick={() => setShowAddSource(true)} className="bg-gradient-to-r from-red-600 to-rose-500">
                <Plus className="w-4 h-4 mr-2" />
                Add Source
              </Button>
            </div>
          </div>
        </motion.div>

        <Tabs defaultValue="channels" className="space-y-6">
          <TabsList className="bg-surface border border-white/10">
            <TabsTrigger value="channels" className="data-[state=active]:bg-red-600">
              <Tv className="w-4 h-4 mr-2" />
              Channels
            </TabsTrigger>
            <TabsTrigger value="guide" className="data-[state=active]:bg-red-600">
              <Calendar className="w-4 h-4 mr-2" />
              Guide
            </TabsTrigger>
            <TabsTrigger value="sources" className="data-[state=active]:bg-red-600">
              <Settings className="w-4 h-4 mr-2" />
              Sources
            </TabsTrigger>
          </TabsList>

          {/* Channels Tab */}
          <TabsContent value="channels">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* Filters */}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="relative flex-1 min-w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    placeholder="Search channels..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <select
                  value={selectedGroup || ''}
                  onChange={(e) => setSelectedGroup(e.target.value || null)}
                  className="px-3 py-2 rounded-lg bg-surface border border-white/10 text-white"
                >
                  <option value="">All Groups</option>
                  {groups.map(group => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
                
                <Button
                  variant={favoritesOnly ? 'default' : 'outline'}
                  onClick={() => setFavoritesOnly(!favoritesOnly)}
                  size="sm"
                >
                  <Star className={`w-4 h-4 mr-2 ${favoritesOnly ? 'fill-current' : ''}`} />
                  Favorites
                </Button>
                
                <div className="flex gap-1 bg-surface rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white/10' : ''}`}
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded ${viewMode === 'list' ? 'bg-white/10' : ''}`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Channels */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-red-400" />
                </div>
              ) : channels.length === 0 ? (
                <div className="text-center py-20">
                  <Tv className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                  <h2 className="text-xl font-bold mb-2">No Channels</h2>
                  <p className="text-gray-400 mb-6">
                    Add an IPTV source (M3U playlist) to get started
                  </p>
                  <Button onClick={() => setShowAddSource(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Source
                  </Button>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  {channels.map((channel) => (
                    <motion.div
                      key={channel.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ scale: 1.03 }}
                      className="group relative p-4 rounded-xl bg-surface border border-white/5 hover:border-red-500/50 cursor-pointer"
                      onClick={() => setSelectedChannel(channel)}
                    >
                      <div className="relative w-full aspect-video rounded-lg bg-black/50 mb-3 overflow-hidden">
                        {channel.logo ? (
                          <img
                            src={channel.logo}
                            alt={channel.name}
                            className="w-full h-full object-contain p-2"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Radio className="w-8 h-8 text-gray-600" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="w-8 h-8 text-white" />
                        </div>
                      </div>
                      
                      <h3 className="font-medium text-sm truncate mb-1">{channel.name}</h3>
                      <p className="text-xs text-gray-500 truncate">{channel.group}</p>
                      
                      {/* Favorite button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFavorite(channel.id);
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {channel.is_favorite ? (
                          <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        ) : (
                          <StarOff className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {channels.map((channel) => (
                    <motion.div
                      key={channel.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-4 p-4 rounded-xl bg-surface border border-white/5 hover:border-red-500/50 cursor-pointer group"
                      onClick={() => setSelectedChannel(channel)}
                    >
                      <div className="w-16 h-10 rounded-lg bg-black/50 overflow-hidden flex-shrink-0">
                        {channel.logo ? (
                          <img src={channel.logo} alt="" className="w-full h-full object-contain p-1" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Radio className="w-4 h-4 text-gray-600" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{channel.name}</h3>
                        <p className="text-xs text-gray-500">{channel.group}</p>
                      </div>
                      
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleFavorite(channel.id);
                          }}
                          className="p-2 rounded-lg hover:bg-white/10"
                        >
                          {channel.is_favorite ? (
                            <Star className="w-4 h-4 text-yellow-400 fill-current" />
                          ) : (
                            <StarOff className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                        <Button variant="outline" size="sm">
                          <Play className="w-4 h-4 mr-1" />
                          Watch
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </TabsContent>

          {/* Guide Tab (EPG) */}
          <TabsContent value="guide">
            <EPGGuideView channels={channels} />
          </TabsContent>

          {/* Sources Tab */}
          <TabsContent value="sources">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              {sources.length === 0 ? (
                <div className="text-center py-12 bg-surface rounded-xl border border-white/5">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                  <h3 className="font-medium mb-2">No IPTV Sources</h3>
                  <p className="text-gray-400 text-sm mb-4">Add an M3U playlist URL to get started</p>
                  <Button onClick={() => setShowAddSource(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Source
                  </Button>
                </div>
              ) : (
                sources.map((source) => (
                  <motion.div
                    key={source.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-xl bg-surface border border-white/5"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{source.name}</h3>
                        <p className="text-sm text-gray-500 truncate max-w-md">{source.url}</p>
                        <div className="flex gap-4 mt-2 text-xs text-gray-400">
                          <span>{source.channel_count} channels</span>
                          {source.last_refresh && (
                            <span>Last refresh: {new Date(source.last_refresh).toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRefreshSource(source.id)}
                          disabled={refreshingSource === source.id}
                        >
                          <RefreshCw className={`w-4 h-4 ${refreshingSource === source.id ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteSource(source.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          </TabsContent>
        </Tabs>

        {/* Add Source Modal */}
        <AnimatePresence>
          {showAddSource && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setShowAddSource(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-md bg-surface rounded-2xl border border-white/10 p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Add IPTV Source</h2>
                  <button onClick={() => setShowAddSource(false)} className="text-gray-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <form onSubmit={handleAddSource} className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Source Name</label>
                    <Input
                      value={newSource.name}
                      onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                      placeholder="My IPTV"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">M3U/M3U8 URL</label>
                    <Input
                      value={newSource.url}
                      onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                      placeholder="http://example.com/playlist.m3u"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">EPG URL (Optional)</label>
                    <Input
                      value={newSource.epg_url}
                      onChange={(e) => setNewSource({ ...newSource, epg_url: e.target.value })}
                      placeholder="http://example.com/epg.xml"
                    />
                  </div>
                  
                  <div className="flex gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowAddSource(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-gradient-to-r from-red-600 to-rose-500"
                      disabled={addingSource}
                    >
                      {addingSource ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Add Source
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Channel Player Modal */}
        <AnimatePresence>
          {selectedChannel && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
              onClick={() => setSelectedChannel(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-4xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {selectedChannel.logo && (
                      <img src={selectedChannel.logo} alt="" className="w-10 h-10 object-contain" />
                    )}
                    <div>
                      <h2 className="text-xl font-bold">{selectedChannel.name}</h2>
                      <p className="text-sm text-gray-400">{selectedChannel.group}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedChannel(null)} className="text-gray-400 hover:text-white">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="aspect-video bg-black rounded-xl overflow-hidden">
                  <video
                    src={selectedChannel.stream_url}
                    autoPlay
                    controls
                    className="w-full h-full"
                  />
                </div>
                
                <div className="flex items-center justify-between mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleFavorite(selectedChannel.id)}
                  >
                    {selectedChannel.is_favorite ? (
                      <>
                        <Star className="w-4 h-4 mr-2 fill-current text-yellow-400" />
                        Favorited
                      </>
                    ) : (
                      <>
                        <StarOff className="w-4 h-4 mr-2" />
                        Add to Favorites
                      </>
                    )}
                  </Button>
                  
                  <a
                    href={selectedChannel.stream_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in External Player
                  </a>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
};
