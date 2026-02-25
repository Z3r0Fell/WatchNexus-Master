import { useState } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { MonitorPlay, Search, Play, ExternalLink, FolderOpen, Plus, Bookmark } from 'lucide-react';
import { toast } from 'sonner';

const WebVideoPage = () => {
  const [playlists, setPlaylists] = useState([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newUrl, setNewUrl] = useState('');

  const handleAdd = () => {
    if (!newUrl) return toast.error('Enter a URL');
    setPlaylists(p => [...p, { name: newUrl.split('/').pop() || 'Playlist', url: newUrl, items: 0 }]);
    toast.success('Playlist imported');
    setNewUrl(''); setShowAdd(false);
  };

  return (
    <Layout>
      <div data-testid="web-video-page" className="min-h-screen p-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <MonitorPlay className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Web Video</h1>
                <p className="text-gray-400">Browse and stream web content</p>
              </div>
            </div>
            <Button onClick={() => setShowAdd(!showAdd)} className="bg-blue-600 hover:bg-blue-700" data-testid="add-web-video">
              <Plus className="w-4 h-4 mr-2" /> Import Playlist
            </Button>
          </div>
          {showAdd && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-xl p-4 mt-4">
              <div className="flex gap-3">
                <Input placeholder="Playlist or channel URL" value={newUrl} onChange={e => setNewUrl(e.target.value)}
                  className="bg-white/5 border-white/10 flex-1" />
                <Button onClick={handleAdd} className="bg-green-600 hover:bg-green-700">Import</Button>
              </div>
            </motion.div>
          )}
        </motion.div>
        {playlists.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 rounded-full bg-blue-600/20 flex items-center justify-center mb-6">
              <FolderOpen className="w-12 h-12 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold mb-2">No Web Video Playlists</h2>
            <p className="text-gray-400 text-center max-w-md mb-6">
              Import playlists and subscription feeds to browse and stream web video content directly within WatchNexus.
            </p>
            <Button onClick={() => setShowAdd(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" /> Import Your First Playlist
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default WebVideoPage;
