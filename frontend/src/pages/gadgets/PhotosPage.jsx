import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../../components/layout/Layout';
import { marmaladeLibrary, marmaladeMedia } from '../../services/marmaladeApi';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Image, FolderOpen, Plus, Search, RefreshCw, Grid, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';

const PhotosPage = () => {
  const [libraries, setLibraries] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newLib, setNewLib] = useState({ name: '', path: '' });
  const [lightboxImg, setLightboxImg] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const libRes = await marmaladeLibrary.getLibraries();
      setLibraries((libRes.data || []).filter(l => l.media_type === 'photos'));
    } catch {} finally { setLoading(false); }
  }, []);

  useState(() => { fetchData(); }, []);

  const handleAdd = async () => {
    if (!newLib.name || !newLib.path) return toast.error('Enter name and path');
    try {
      await marmaladeLibrary.addLibrary(newLib.name, newLib.path, 'photos');
      toast.success('Photo library added');
      setNewLib({ name: '', path: '' }); setShowAdd(false); fetchData();
    } catch { toast.error('Failed to add'); }
  };

  return (
    <Layout>
      <div data-testid="photos-page" className="min-h-screen p-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center">
                <Image className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Photos</h1>
                <p className="text-gray-400">Your photo gallery</p>
              </div>
            </div>
            <Button onClick={() => setShowAdd(!showAdd)} className="bg-fuchsia-600 hover:bg-fuchsia-700" data-testid="add-photo-library">
              <Plus className="w-4 h-4 mr-2" /> Add Library
            </Button>
          </div>
          {showAdd && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-xl p-4 mt-4">
              <div className="flex gap-3">
                <Input placeholder="Library name" value={newLib.name} onChange={e => setNewLib(p => ({...p, name: e.target.value}))} className="bg-white/5 border-white/10" />
                <Input placeholder="/path/to/photos" value={newLib.path} onChange={e => setNewLib(p => ({...p, path: e.target.value}))} className="bg-white/5 border-white/10 flex-1" />
                <Button onClick={handleAdd} className="bg-green-600 hover:bg-green-700">Add & Scan</Button>
              </div>
            </motion.div>
          )}
        </motion.div>
        {libraries.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 rounded-full bg-fuchsia-600/20 flex items-center justify-center mb-6">
              <FolderOpen className="w-12 h-12 text-fuchsia-400" />
            </div>
            <h2 className="text-xl font-bold mb-2">No Photo Libraries</h2>
            <p className="text-gray-400 text-center max-w-md mb-6">Add a photo library to browse your images. Supports JPEG, PNG, RAW, HEIF, WebP, and more.</p>
            <Button onClick={() => setShowAdd(true)} className="bg-fuchsia-600 hover:bg-fuchsia-700">
              <Plus className="w-4 h-4 mr-2" /> Add Your First Library
            </Button>
          </div>
        )}
        {libraries.map(lib => (
          <div key={lib.id} className="glass-card rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{lib.name}</h3>
                <p className="text-sm text-gray-400">{lib.item_count || 0} photos &middot; {lib.path}</p>
              </div>
              <Button variant="ghost" size="sm"><RefreshCw className="w-4 h-4" /></Button>
            </div>
          </div>
        ))}
        {lightboxImg && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center" onClick={() => setLightboxImg(null)}>
            <img src={lightboxImg} className="max-w-[90vw] max-h-[90vh] object-contain" alt="" />
          </div>
        )}
      </div>
    </Layout>
  );
};

export default PhotosPage;
