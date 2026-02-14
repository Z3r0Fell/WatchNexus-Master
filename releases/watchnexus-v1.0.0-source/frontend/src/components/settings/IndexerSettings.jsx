import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Server, Plus, Trash2, Globe, RefreshCw, Wifi, Radio, Package, FileSearch } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { toast } from 'sonner';
import { indexersApi, compoteApi } from '../../services/api';

export const IndexerSettings = () => {
  const [indexers, setIndexers] = useState([]);
  const [showAddIndexer, setShowAddIndexer] = useState(false);
  const [testingIndexer, setTestingIndexer] = useState(null);
  const [newIndexer, setNewIndexer] = useState({
    name: '', type: 'torznab', url: '', api_key: '', cloudflare_protected: false, search_path: '', cookie: '',
  });

  const fetchIndexers = useCallback(async () => {
    try { const res = await indexersApi.getAll(); setIndexers(res.data || []); } catch {}
  }, []);

  useEffect(() => { fetchIndexers(); }, [fetchIndexers]);

  const handleIndexerToggle = async (indexer) => {
    try {
      await compoteApi.updateIndexer(indexer.id, { enabled: !indexer.enabled });
      setIndexers(prev => prev.map(i => i.id === indexer.id ? { ...i, enabled: !i.enabled } : i));
      toast.success(`${indexer.name} ${indexer.enabled ? 'disabled' : 'enabled'}`);
    } catch { toast.error('Failed to update indexer'); }
  };

  const handleAddNewIndexer = async () => {
    if (!newIndexer.name || !newIndexer.url) { toast.error('Name and URL are required'); return; }
    try {
      await compoteApi.addIndexer(newIndexer.name, newIndexer.type, newIndexer.url, newIndexer.api_key, true, 50, {
        cloudflare_protected: newIndexer.cloudflare_protected, search_path: newIndexer.search_path, cookie: newIndexer.cookie,
      });
      toast.success(`Indexer "${newIndexer.name}" added`);
      setShowAddIndexer(false);
      setNewIndexer({ name: '', type: 'torznab', url: '', api_key: '', cloudflare_protected: false, search_path: '', cookie: '' });
      const res = await compoteApi.getIndexers(); setIndexers(res.data || []);
    } catch { toast.error('Failed to add indexer'); }
  };

  const handleTestIndexer = async (indexerId) => {
    setTestingIndexer(indexerId);
    try {
      const res = await compoteApi.testIndexer(indexerId);
      res.data.success ? toast.success(res.data.message || 'Connection successful') : toast.error(res.data.error || 'Connection failed');
    } catch (error) { toast.error('Test failed: ' + (error.response?.data?.detail || error.message)); }
    finally { setTestingIndexer(null); }
  };

  const handleDeleteIndexer = async (indexerId) => {
    try { await compoteApi.removeIndexer(indexerId); setIndexers(prev => prev.filter(i => i.id !== indexerId)); toast.success('Indexer removed'); }
    catch { toast.error('Failed to remove indexer'); }
  };

  const presets = [
    { name: '1337x', type: 'torznab', url: 'https://1337x.to', cf: true },
    { name: 'YTS Movies', type: 'torznab', url: 'https://yts.mx', cf: false },
    { name: 'EZTV', type: 'torznab', url: 'https://eztv.re', cf: false },
    { name: 'Nyaa', type: 'torznab', url: 'https://nyaa.si', cf: false },
    { name: 'ShowRSS', type: 'rss', url: 'https://showrss.info/other/all.rss', cf: false },
    { name: 'Custom RSS', type: 'rss', url: '', cf: false },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="indexer-settings">
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Server className="w-5 h-5 text-violet-400" /> Indexers (Compote)
            </h2>
            <p className="text-sm text-gray-400 mt-1">Configure torrent indexers, RSS feeds, and usenet sources</p>
          </div>
          <Button onClick={() => setShowAddIndexer(!showAddIndexer)} className="bg-violet-600 hover:bg-violet-700">
            <Plus className="w-4 h-4 mr-2" /> Add Indexer
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-sm text-gray-400 py-1">Quick Add:</span>
          {presets.map((preset) => (
            <button key={preset.name} onClick={() => {
              setNewIndexer({ name: preset.name, type: preset.type, url: preset.url, api_key: '', cloudflare_protected: preset.cf, search_path: '', cookie: '' });
              setShowAddIndexer(true);
            }} className="px-3 py-1 text-xs rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-colors">
              + {preset.name}
            </button>
          ))}
        </div>

        {showAddIndexer && (
          <div className="p-4 rounded-xl bg-surface border border-white/10 space-y-4">
            <h3 className="font-bold flex items-center gap-2"><Plus className="w-4 h-4 text-green-400" /> Add New Indexer</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Indexer Name *</label>
                <Input value={newIndexer.name} onChange={(e) => setNewIndexer(p => ({ ...p, name: e.target.value }))}
                  placeholder="My Indexer" className="bg-white/5 border-white/10" />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Type *</label>
                <select value={newIndexer.type} onChange={(e) => setNewIndexer(p => ({ ...p, type: e.target.value }))}
                  className="w-full h-10 px-3 rounded-md bg-white/5 border border-white/10 text-white">
                  <option value="torznab">Torrent (via Syrup)</option>
                  <option value="newznab">NZB (via Pulp)</option>
                  <option value="rss">RSS Feed</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-2 block">URL *</label>
              <Input value={newIndexer.url} onChange={(e) => setNewIndexer(p => ({ ...p, url: e.target.value }))}
                placeholder={newIndexer.type === 'rss' ? 'https://showrss.info/other/all.rss' : 'https://1337x.to'}
                className="bg-white/5 border-white/10" />
            </div>
            {newIndexer.type !== 'rss' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">API Key (if required)</label>
                  <Input value={newIndexer.api_key} onChange={(e) => setNewIndexer(p => ({ ...p, api_key: e.target.value }))}
                    placeholder="Optional for most torrent sites" className="bg-white/5 border-white/10" />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Search Path (optional)</label>
                  <Input value={newIndexer.search_path} onChange={(e) => setNewIndexer(p => ({ ...p, search_path: e.target.value }))}
                    placeholder="Auto-detected" className="bg-white/5 border-white/10" />
                </div>
              </div>
            )}
            <div className="pt-4 border-t border-white/10">
              <h4 className="text-sm font-medium mb-3">Advanced Options (Preserve)</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Cloudflare Protected</p>
                    <p className="text-xs text-gray-500">Preserve will handle challenge solving automatically</p>
                  </div>
                  <Switch checked={newIndexer.cloudflare_protected || false}
                    onCheckedChange={(checked) => setNewIndexer(p => ({ ...p, cloudflare_protected: checked }))} />
                </div>
                {newIndexer.cloudflare_protected && (
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Browser Cookie (optional fallback)</label>
                    <Input value={newIndexer.cookie || ''} onChange={(e) => setNewIndexer(p => ({ ...p, cookie: e.target.value }))}
                      placeholder="Usually not needed - Preserve handles this" className="bg-white/5 border-white/10" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => setShowAddIndexer(false)}>Cancel</Button>
              <Button onClick={handleAddNewIndexer} className="bg-green-600 hover:bg-green-700" disabled={!newIndexer.name || !newIndexer.url}>
                <Plus className="w-4 h-4 mr-2" /> Add Indexer
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="glass-card rounded-xl p-6">
        <h3 className="font-bold mb-4">Configured Indexers ({indexers.length})</h3>
        {indexers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Server className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No indexers configured</p><p className="text-sm">Add indexers above to search for content</p>
          </div>
        ) : (
          <div className="space-y-3">
            {indexers.map((indexer) => (
              <div key={indexer.id} className="flex items-center justify-between p-4 rounded-xl bg-surface border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${indexer.enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                    {indexer.type === 'rss' ? <Radio className="w-5 h-5" /> : indexer.type === 'newznab' ? <Package className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{indexer.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded ${indexer.type === 'torznab' ? 'bg-blue-500/20 text-blue-400' : indexer.type === 'newznab' ? 'bg-purple-500/20 text-purple-400' : 'bg-orange-500/20 text-orange-400'}`}>
                        {indexer.type.toUpperCase()}
                      </span>
                      {indexer.cloudflare_protected && <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400">CF</span>}
                    </div>
                    <p className="text-xs text-gray-500 truncate max-w-md">{indexer.url}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button size="sm" variant="outline" onClick={() => handleTestIndexer(indexer.id)} disabled={testingIndexer === indexer.id}>
                    {testingIndexer === indexer.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDeleteIndexer(indexer.id)} className="text-red-400 hover:bg-red-500/10">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Switch checked={indexer.enabled} onCheckedChange={() => handleIndexerToggle(indexer)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-card rounded-xl p-6">
        <h3 className="font-bold mb-4 flex items-center gap-2"><FileSearch className="w-5 h-5 text-blue-400" /> Built-in Modules Guide</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <h4 className="font-medium text-blue-400 mb-2">Syrup - Indexer Aggregator</h4>
            <ol className="text-sm text-blue-300 space-y-1 list-decimal list-inside">
              <li>Built-in torrent indexer aggregator</li><li>No external software needed</li>
              <li>Add torrent sites directly</li><li>Supports 1337x, YTS, EZTV, Nyaa, and more</li>
            </ol>
          </div>
          <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <h4 className="font-medium text-yellow-400 mb-2">Preserve - Challenge Solver</h4>
            <ol className="text-sm text-yellow-300 space-y-1 list-decimal list-inside">
              <li>Built-in Cloudflare protection bypass</li><li>Automatic - no configuration needed</li>
              <li>Browser fingerprinting & cookie handling</li><li>Smart rate limiting with backoff</li>
            </ol>
          </div>
          <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
            <h4 className="font-medium text-orange-400 mb-2">RSS Feed Support</h4>
            <ol className="text-sm text-orange-300 space-y-1 list-decimal list-inside">
              <li>Add any RSS feed with torrent links</li><li>ShowRSS.info for TV show tracking</li>
              <li>Private tracker personal feeds</li><li>Automatic magnet link extraction</li>
            </ol>
          </div>
          <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <h4 className="font-medium text-purple-400 mb-2">Pulp - NZB Handler</h4>
            <ol className="text-sm text-purple-300 space-y-1 list-decimal list-inside">
              <li>Built-in Usenet/NZB support</li><li>Supports Newznab API indexers</li>
              <li>Integrated download management</li><li>Works with any Newznab indexer</li>
            </ol>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
