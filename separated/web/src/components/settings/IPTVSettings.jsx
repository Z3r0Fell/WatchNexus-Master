import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Radio, Plus, Trash2 } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { toast } from 'sonner';

export const IPTVSettings = () => {
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-xl p-6 space-y-6" data-testid="iptv-settings">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Radio className="w-5 h-5 text-violet-400" /> IPTV Configuration
      </h2>
      <p className="text-gray-400">Add M3U playlists or Xtream Codes for live TV channels.</p>

      <div className="p-4 rounded-xl bg-surface border border-white/5 space-y-4">
        <h3 className="font-medium">Add IPTV Source</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input value={newIptvSource.name} onChange={(e) => setNewIptvSource(p => ({ ...p, name: e.target.value }))}
            placeholder="Source Name (e.g., My IPTV)" className="bg-white/5 border-white/10" />
          <select value={newIptvSource.type} onChange={(e) => setNewIptvSource(p => ({ ...p, type: e.target.value }))}
            className="bg-white/5 border border-white/10 rounded-md px-3 text-white">
            <option value="m3u">M3U Playlist</option><option value="xtream">Xtream Codes</option>
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

      {iptvSources.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium">Configured Sources ({iptvSources.length})</h3>
          {iptvSources.map((source) => (
            <div key={source.id} className="p-4 rounded-xl bg-surface border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <Radio className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <p className="font-medium">{source.name}</p>
                  <p className="text-xs text-gray-500">{source.type.toUpperCase()} - {source.url.substring(0, 40)}...</p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => handleDeleteIptvSource(source.id)} className="text-red-400">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {iptvSources.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Radio className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No IPTV sources configured</p><p className="text-sm">Add an M3U playlist or Xtream Codes above</p>
        </div>
      )}
    </motion.div>
  );
};
