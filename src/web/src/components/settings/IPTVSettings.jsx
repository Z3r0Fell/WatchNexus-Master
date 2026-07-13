import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Radio, Plus, Trash2, List, Clock, Loader2 } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { SettingsTabHeader, SettingsTabContent } from './SettingsTabHeader';
import axios from 'axios';
import { BACKEND_URL } from '../../lib/config';

// Tabs for IPTV Settings
const IPTV_TABS = [
  { id: 'sources', label: 'IPTV Sources', icon: Radio },
  { id: 'epg', label: 'EPG Guide', icon: List },
  { id: 'schedule', label: 'Recording', icon: Clock },
];

export const IPTVSettings = () => {
  const [activeTab, setActiveTab] = useState('sources');
  const [iptvSources, setIptvSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newIptvSource, setNewIptvSource] = useState({ name: '', url: '', epg_url: '', type: 'm3u' });

  // Fetch IPTV sources from backend on mount
  useEffect(() => {
    fetchIptvSources();
  }, []);

  const fetchIptvSources = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${BACKEND_URL}/api/iptv/sources`, {
        
      });
      setIptvSources(response.data.sources || []);
    } catch (error) {
      console.error('Failed to fetch IPTV sources:', error);
      toast.error('Failed to load IPTV sources');
    } finally {
      setLoading(false);
    }
  };

  const handleAddIptvSource = async () => {
    if (!newIptvSource.name || !newIptvSource.url) {
      toast.error('Please enter name and URL');
      return;
    }
    
    try {
      setSaving(true);
      const params = new URLSearchParams({
        name: newIptvSource.name,
        url: newIptvSource.url,
        type: newIptvSource.type,
      });
      if (newIptvSource.epg_url) {
        params.append('epg_url', newIptvSource.epg_url);
      }
      
      const response = await axios.post(`${BACKEND_URL}/api/iptv/sources?${params.toString()}`, null, {
        
      });
      
      setIptvSources([...iptvSources, response.data]);
      setNewIptvSource({ name: '', url: '', epg_url: '', type: 'm3u' });
      toast.success('IPTV source added');
    } catch (error) {
      console.error('Failed to add IPTV source:', error);
      toast.error('Failed to add IPTV source');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteIptvSource = async (id) => {
    try {
      await axios.delete(`${BACKEND_URL}/api/iptv/sources/${id}`, {
        
      });
      setIptvSources(iptvSources.filter(s => s.id !== id));
      toast.success('IPTV source removed');
    } catch (error) {
      console.error('Failed to delete IPTV source:', error);
      toast.error('Failed to remove IPTV source');
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'sources':
        return (
          <SourcesTab 
            iptvSources={iptvSources}
            loading={loading}
            saving={saving}
            newIptvSource={newIptvSource}
            setNewIptvSource={setNewIptvSource}
            handleAddIptvSource={handleAddIptvSource}
            handleDeleteIptvSource={handleDeleteIptvSource}
          />
        );
      case 'epg':
        return <EPGTab />;
      case 'schedule':
        return <RecordingTab />;
      default:
        return null;
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6" data-testid="iptv-settings">
      <SettingsTabHeader
        title="IPTV Configuration"
        subtitle="Live TV channels, EPG guide, and recording"
        icon={Radio}
        tabs={IPTV_TABS}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        iconBgColor="from-pink-600 to-rose-500"
        help={{ title: "IPTV Configuration", description: "Set up live TV by adding M3U playlist sources and EPG (Electronic Program Guide) data. Configure recording options for DVR functionality. Supports standard IPTV providers and custom M3U playlists.", examples: ["M3U Source: Paste your IPTV provider's M3U playlist URL", "EPG: Add an XMLTV guide URL for program listings", "DVR: Record live TV to your library path"] }}
      />

      <SettingsTabContent activeTab={activeTab}>
        {renderTabContent()}
      </SettingsTabContent>
    </motion.div>
  );
};

// Sources Tab
const SourcesTab = ({ iptvSources, loading, saving, newIptvSource, setNewIptvSource, handleAddIptvSource, handleDeleteIptvSource }) => (
  <div className="space-y-6">
    <div className="bg-surface border border-white/10 rounded-2xl p-6 space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Plus className="w-5 h-5 text-green-400" />
        Add IPTV Source
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input 
          value={newIptvSource.name} 
          onChange={(e) => setNewIptvSource(p => ({ ...p, name: e.target.value }))}
          placeholder="Source Name (e.g., My IPTV)" 
          className="bg-white/5 border-white/10"
          data-testid="iptv-source-name"
        />
        <select 
          value={newIptvSource.type} 
          onChange={(e) => setNewIptvSource(p => ({ ...p, type: e.target.value }))}
          className="bg-white/5 border border-white/10 rounded-md px-3 text-white h-10 [&>option]:bg-[#1a1a1a] [&>option]:text-white"
          data-testid="iptv-source-type"
        >
          <option value="m3u">M3U Playlist</option>
          <option value="xtream">Xtream Codes</option>
        </select>
      </div>
      <Input 
        value={newIptvSource.url} 
        onChange={(e) => setNewIptvSource(p => ({ ...p, url: e.target.value }))}
        placeholder={newIptvSource.type === 'm3u' ? 'http://example.com/playlist.m3u' : 'http://server.com:port'}
        className="bg-white/5 border-white/10"
        data-testid="iptv-source-url"
      />
      <Input 
        value={newIptvSource.epg_url} 
        onChange={(e) => setNewIptvSource(p => ({ ...p, epg_url: e.target.value }))}
        placeholder="EPG URL (optional) - http://example.com/epg.xml" 
        className="bg-white/5 border-white/10"
        data-testid="iptv-epg-url"
      />
      <Button 
        onClick={handleAddIptvSource} 
        className="bg-violet-600 hover:bg-violet-700"
        disabled={saving}
        data-testid="iptv-add-source-btn"
      >
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
        {saving ? 'Adding...' : 'Add Source'}
      </Button>
    </div>

    <div className="bg-surface border border-white/10 rounded-2xl p-6">
      <h3 className="text-lg font-semibold mb-4">Configured Sources ({iptvSources.length})</h3>
      
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
        </div>
      ) : iptvSources.length > 0 ? (
        <div className="space-y-3">
          {iptvSources.map((source) => (
            <div key={source.id} className="p-4 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between" data-testid={`iptv-source-${source.id}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <Radio className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <p className="font-medium">{source.name}</p>
                  <p className="text-xs text-gray-500">{source.type?.toUpperCase() || 'M3U'} - {source.url?.substring(0, 40)}...</p>
                </div>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => handleDeleteIptvSource(source.id)} 
                className="text-red-400 border-red-500/30 hover:bg-red-500/20"
                data-testid={`iptv-delete-${source.id}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <Radio className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No IPTV sources configured</p>
          <p className="text-sm">Add an M3U playlist or Xtream Codes above</p>
        </div>
      )}
    </div>
    
    <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
      <p className="text-sm text-green-400">
        <strong>Sync enabled:</strong> Your IPTV sources are saved to your account and will sync across all your devices.
      </p>
    </div>
  </div>
);

// EPG Tab
const EPGTab = () => (
  <div className="space-y-6">
    <div className="bg-surface border border-white/10 rounded-2xl p-6">
      <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
        <List className="w-5 h-5 text-blue-400" />
        Electronic Program Guide
      </h3>
      <p className="text-sm text-gray-400 mb-4">Configure EPG sources for TV guide data</p>
      
      <div className="p-8 rounded-xl bg-black/30 border border-dashed border-white/10 text-center">
        <List className="w-12 h-12 mx-auto mb-3 text-gray-500" />
        <p className="text-gray-400">No EPG sources configured</p>
        <p className="text-sm text-gray-500">Add EPG URLs to your IPTV sources</p>
      </div>
    </div>
  </div>
);

// Recording Tab
const RecordingTab = () => (
  <div className="space-y-6">
    <div className="bg-surface border border-white/10 rounded-2xl p-6">
      <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-red-400" />
        Scheduled Recordings
      </h3>
      <p className="text-sm text-gray-400 mb-4">Schedule recordings for live TV programs</p>
      
      <div className="p-8 rounded-xl bg-black/30 border border-dashed border-white/10 text-center">
        <Clock className="w-12 h-12 mx-auto mb-3 text-gray-500" />
        <p className="text-gray-400">No recordings scheduled</p>
        <p className="text-sm text-gray-500">Select a program from the EPG to schedule</p>
      </div>
    </div>
    
    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
      <p className="text-sm text-red-400">
        <strong>Note:</strong> Recording feature requires FFmpeg to be installed on your server.
      </p>
    </div>
  </div>
);

export default IPTVSettings;
