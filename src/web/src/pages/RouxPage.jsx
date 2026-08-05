import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Layers, Plus, Trash2, RefreshCw, Star, Zap, Film, Calendar,
  Ghost, Folder, Sparkles, Filter, ChevronRight
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';

const API = process.env.REACT_APP_BACKEND_URL || '';
const headers = { 'Content-Type': 'application/json' };

const collectionIcons = {
  star: Star,
  calendar: Calendar,
  zap: Zap,
  ghost: Ghost,
  film: Film,
  folder: Folder,
  sparkles: Sparkles,
};

export const RouxPage = () => {
  const [collections, setCollections] = useState([]);
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [collectionItems, setCollectionItems] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  const fetchData = async () => {
    try {
      const [colRes, presetRes] = await Promise.all([
        axios.get(`${API}/api/roux/collections`, { headers }),
        axios.get(`${API}/api/roux/presets`, { headers }),
      ]);
      setCollections(Array.isArray(colRes.data) ? colRes.data : []);
      setPresets(Array.isArray(presetRes.data) ? presetRes.data : []);
    } catch (e) {
      console.error('Roux fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const viewCollection = async (collectionId) => {
    try {
      const res = await axios.get(`${API}/api/roux/collections/${collectionId}`, {
        
      });
      setSelectedCollection(collectionId);
      setCollectionItems(res.data?.items || []);
    } catch (e) {
      toast.error('Failed to load collection');
    }
  };

  const createCollection = async () => {
    if (!newName.trim()) return;
    try {
      await axios.post(`${API}/api/roux/collections`, { name: newName, type: 'manual' }, {
        headers: { 'Content-Type': 'application/json' }
      });
      toast.success(`Collection "${newName}" created`);
      setNewName('');
      setShowCreate(false);
      fetchData();
    } catch (e) {
      toast.error('Failed to create');
    }
  };

  const refreshCollection = async (collectionId) => {
    try {
      await axios.post(`${API}/api/roux/collections/${collectionId}/refresh`, {}, {
        
      });
      toast.success('Collection refreshing');
    } catch (e) {
      toast.error('Refresh failed');
    }
  };

  const deleteCollection = async (collectionId) => {
    try {
      await axios.delete(`${API}/api/roux/collections/${collectionId}`, {
        
      });
      setCollections(prev => prev.filter(c => c.id !== collectionId));
      if (selectedCollection === collectionId) {
        setSelectedCollection(null);
        setCollectionItems([]);
      }
      toast.success('Collection deleted');
    } catch (e) {
      toast.error('Failed to delete');
    }
  };

  if (loading) return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </Layout>
  );

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto p-6 space-y-6"
        data-testid="roux-page"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Collections</h1>
            <p className="text-sm text-gray-400 mt-1">Smart & manual collections for your library</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchData} variant="outline" className="border-white/10" data-testid="roux-refresh-btn">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button onClick={() => setShowCreate(!showCreate)} className="bg-violet-600 hover:bg-violet-700" data-testid="roux-create-btn">
              <Plus className="w-4 h-4 mr-2" /> New Collection
            </Button>
          </div>
        </div>

        {showCreate && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-white/[0.03] border border-violet-500/20 flex items-center gap-3"
          >
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Collection name..."
              className="bg-white/5 border-white/10 flex-1"
              onKeyDown={(e) => e.key === 'Enter' && createCollection()}
              data-testid="roux-new-name"
            />
            <Button onClick={createCollection} size="sm" className="bg-violet-600 hover:bg-violet-700">Create</Button>
            <Button onClick={() => setShowCreate(false)} size="sm" variant="ghost">Cancel</Button>
          </motion.div>
        )}

        {/* Smart Presets */}
        {presets.length > 0 && !selectedCollection && (
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Presets</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {presets.map(p => (
                <button
                  key={p.id}
                  className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.04] hover:border-violet-500/30 hover:bg-violet-500/5 transition-all text-left"
                  data-testid={`preset-${p.id}`}
                >
                  <Sparkles className="w-4 h-4 text-violet-400 mb-1.5" />
                  <p className="text-sm font-medium text-white">{p.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Collection detail view */}
        {selectedCollection && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={() => { setSelectedCollection(null); setCollectionItems([]); }} className="text-sm text-gray-400 hover:text-white">
                Collections
              </button>
              <ChevronRight className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-white">{selectedCollection}</span>
            </div>

            {collectionItems.length === 0 ? (
              <div className="p-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center">
                <Layers className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p className="text-gray-400">This collection is empty</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {collectionItems.map((item, i) => (
                  <motion.div
                    key={item.id || i}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="rounded-xl overflow-hidden bg-white/[0.03] border border-white/[0.06]"
                  >
                    {item.poster_url ? (
                      <img src={item.poster_url} alt={item.title} className="w-full aspect-[2/3] object-cover" />
                    ) : (
                      <div className="w-full aspect-[2/3] bg-white/5 flex items-center justify-center">
                        <Film className="w-8 h-8 text-gray-600" />
                      </div>
                    )}
                    <div className="p-2.5">
                      <p className="text-sm font-medium text-white truncate">{item.title}</p>
                      <p className="text-xs text-gray-500">{item.year || ''} {item.rating ? `- ${item.rating.toFixed(1)}` : ''}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Collections grid */}
        {!selectedCollection && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {collections.map((col, i) => {
              const Icon = collectionIcons[col.icon] || Folder;
              return (
                <motion.div
                  key={col.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-violet-500/20 transition-all cursor-pointer group"
                  onClick={() => viewCollection(col.id)}
                  data-testid={`collection-${col.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-violet-400" />
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {col.auto_refresh && (
                        <button onClick={(e) => { e.stopPropagation(); refreshCollection(col.id); }} className="p-1.5 rounded-lg hover:bg-white/5">
                          <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); deleteCollection(col.id); }} className="p-1.5 rounded-lg hover:bg-red-500/10">
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  </div>
                  <h3 className="text-base font-semibold text-white mt-3">{col.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{col.description || `${col.type} collection`}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="px-2 py-0.5 rounded text-xs bg-white/5 text-gray-400 capitalize">{col.type}</span>
                    <span className="text-xs text-gray-600">{col.item_count || 0} items</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </Layout>
  );
};

export default RouxPage;
