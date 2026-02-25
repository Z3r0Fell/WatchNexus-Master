import { useState } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Gamepad2, FolderOpen, Plus, Search, Play, RefreshCw } from 'lucide-react';
import { marmaladeLibrary } from '../../services/marmaladeApi';
import { toast } from 'sonner';

const GamesPage = () => {
  const [libraries, setLibraries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newLib, setNewLib] = useState({ name: '', path: '' });
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await marmaladeLibrary.getLibraries();
      setLibraries((res.data || []).filter(l => l.media_type === 'games'));
    } catch {} finally { setLoading(false); }
  };

  useState(() => { fetchData(); }, []);

  const handleAdd = async () => {
    if (!newLib.name || !newLib.path) return toast.error('Enter name and path');
    try {
      await marmaladeLibrary.addLibrary(newLib.name, newLib.path, 'games');
      toast.success('Game library added');
      setNewLib({ name: '', path: '' }); setShowAdd(false); fetchData();
    } catch { toast.error('Failed to add'); }
  };

  return (
    <Layout>
      <div data-testid="games-page" className="min-h-screen p-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
                <Gamepad2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Games</h1>
                <p className="text-gray-400">Your retro game collection</p>
              </div>
            </div>
            <Button onClick={() => setShowAdd(!showAdd)} className="bg-red-600 hover:bg-red-700" data-testid="add-game-library">
              <Plus className="w-4 h-4 mr-2" /> Add ROM Library
            </Button>
          </div>
          {showAdd && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-xl p-4 mt-4">
              <div className="flex gap-3">
                <Input placeholder="Library name (e.g., SNES ROMs)" value={newLib.name} onChange={e => setNewLib(p => ({...p, name: e.target.value}))} className="bg-white/5 border-white/10" />
                <Input placeholder="/path/to/roms" value={newLib.path} onChange={e => setNewLib(p => ({...p, path: e.target.value}))} className="bg-white/5 border-white/10 flex-1" />
                <Button onClick={handleAdd} className="bg-green-600 hover:bg-green-700">Add & Scan</Button>
              </div>
            </motion.div>
          )}
        </motion.div>
        {libraries.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 rounded-full bg-red-600/20 flex items-center justify-center mb-6">
              <FolderOpen className="w-12 h-12 text-red-400" />
            </div>
            <h2 className="text-xl font-bold mb-2">No Game Libraries</h2>
            <p className="text-gray-400 text-center max-w-md mb-6">
              Add your ROM collection to browse and launch retro games. Supports NES, SNES, Genesis, N64, GBA, PS1, and more via RetroArch integration.
            </p>
            <Button onClick={() => setShowAdd(true)} className="bg-red-600 hover:bg-red-700">
              <Plus className="w-4 h-4 mr-2" /> Add Your First ROM Library
            </Button>
          </div>
        )}
        {libraries.map(lib => (
          <div key={lib.id} className="glass-card rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{lib.name}</h3>
                <p className="text-sm text-gray-400">{lib.item_count || 0} ROMs &middot; {lib.path}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm"><RefreshCw className="w-4 h-4" /></Button>
                <Button size="sm" className="bg-red-600 hover:bg-red-700"><Play className="w-4 h-4 mr-1" /> Browse</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
};

export default GamesPage;
