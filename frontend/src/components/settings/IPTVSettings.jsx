import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Radio, Plus, Trash2, List, Settings, Clock } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { SettingsTabHeader, SettingsTabContent } from './SettingsTabHeader';

// Tabs for IPTV Settings
const IPTV_TABS = [
  { id: 'sources', label: 'IPTV Sources', icon: Radio },
  { id: 'epg', label: 'EPG Guide', icon: List },
  { id: 'schedule', label: 'Recording', icon: Clock },
];

export const IPTVSettings = () => {
  const [activeTab, setActiveTab] = useState('sources');
  const [iptvSources, setIptvSources] = useState([]);
  const [newIptvSource, setNewIptvSource] = useState({ name: '', url: '', epg_url: '', type: 'm3u' });

  useEffect(() => {
    const saved = localStorage.getItem('watchnexus_iptv_sources');
    if (saved) setIptvSources(JSON.parse(saved));
  }, []);

  const handleAddIptvSource = () => {
    if (!newIptvSource.name || !newIptvSource.url) { toast.error('Please enter name and URL'); return; }
    const updated = [...iptvSources, { ...newIptvSource, id: Date.now().toString() }];
    setIptvSources(updated);
    localStorage.setItem('watchnexus_iptv_sources', JSON.stringify(updated));
    setNewIptvSource({ name: '', url: '', epg_url: '', type: 'm3u' });
    toast.success('IPTV source added');
  };

  const handleDeleteIptvSource = (id) => {
    const updated = iptvSources.filter(s => s.id !== id);
    setIptvSources(updated);
    localStorage.setItem('watchnexus_iptv_sources', JSON.stringify(updated));
    toast.success('IPTV source removed');
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'sources':
        return (
          <SourcesTab 
            iptvSources={iptvSources}
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
      />

      <SettingsTabContent activeTab={activeTab}>
        {renderTabContent()}
      </SettingsTabContent>
    </motion.div>
  );
};

// Sources Tab
const SourcesTab = ({ iptvSources, newIptvSource, setNewIptvSource, handleAddIptvSource, handleDeleteIptvSource }) => (
  <div className="space-y-6">
    <div className="bg-surface border border-white/10 rounded-2xl p-6 space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Plus className="w-5 h-5 text-green-400" />
        Add IPTV Source
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input value={newIptvSource.name} onChange={(e) => setNewIptvSource(p => ({ ...p, name: e.target.value }))}
          placeholder="Source Name (e.g., My IPTV)" className="bg-white/5 border-white/10" />
        <select value={newIptvSource.type} onChange={(e) => setNewIptvSource(p => ({ ...p, type: e.target.value }))}
          className="bg-white/5 border border-white/10 rounded-md px-3 text-white h-10">
          <option value="m3u">M3U Playlist</option>
          <option value="xtream">Xtream Codes</option>
        </select>
      </div>
      <Input value={newIptvSource.url} onChange={(e) => setNewIptvSource(p => ({ ...p, url: e.target.value }))}
        placeholder={newIptvSource.type === 'm3u' ? 'http://example.com/playlist.m3u' : 'http://server.com:port'}
        className="bg-white/5 border-white/10" />
      <Input value={newIptvSource.epg_url} onChange={(e) => setNewIptvSource(p => ({ ...p, epg_url: e.target.value }))}
        placeholder="EPG URL (optional) - http://example.com/epg.xml" className="bg-white/5 border-white/10" />
      <Button onClick={handleAddIptvSource} className="bg-violet-600 hover:bg-violet-700">
        <Plus className="w-4 h-4 mr-2" /> Add Source
      </Button>
    </div>

    <div className="bg-surface border border-white/10 rounded-2xl p-6">
      <h3 className="text-lg font-semibold mb-4">Configured Sources ({iptvSources.length})</h3>
      {iptvSources.length > 0 ? (
        <div className="space-y-3">
          {iptvSources.map((source) => (
            <div key={source.id} className="p-4 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <Radio className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <p className="font-medium">{source.name}</p>
                  <p className="text-xs text-gray-500">{source.type.toUpperCase()} - {source.url.substring(0, 40)}...</p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => handleDeleteIptvSource(source.id)} className="text-red-400 border-red-500/30">
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
