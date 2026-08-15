import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Image, Plus, FolderOpen, RefreshCw, Trash2, Grid, X, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useConfirm } from '../../hooks/use-confirm';
import { BACKEND_URL } from '../../lib/config';

const API = BACKEND_URL;

export const PhotosPage = () => {
  const { confirm, ConfirmDialog } = useConfirm();
  const [libraries, setLibraries] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [selectedLib, setSelectedLib] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newLib, setNewLib] = useState({ name: '', path: '' });
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const getAuth = () => ({}); // Cookie auth: wn_token sent automatically

  const fetchLibraries = useCallback(async () => {
    try {
      setLoading(true);
      const resp = await axios.get(`${BACKEND_URL}/api/gadgets/photos/libraries`, { headers: getAuth() });
      setLibraries(resp.data.libraries || []);
    } catch (err) {
      toast.error('Failed to load libraries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLibraries();
  }, [fetchLibraries]);

  const addLibrary = async () => {
    if (!newLib.name || !newLib.path) return toast.error('Enter name and path');
    try {
      await axios.post(`${BACKEND_URL}/api/gadgets/photos/libraries`, newLib, { headers: getAuth() });
      toast.success('Library added');
      setNewLib({ name: '', path: '' });
      setShowAdd(false);
      fetchLibraries();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add library');
    }
  };

  const deleteLibrary = async (libId) => {
    const ok = await confirm({ title: 'Delete Library', description: 'Delete this library?', confirmText: 'Delete' });
    if (!ok) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/gadgets/photos/libraries/${libId}`, { headers: getAuth() });
      toast.success('Library deleted');
      setLibraries(l => l.filter(lib => lib.id !== libId));
      if (selectedLib?.id === libId) {
        setSelectedLib(null);
        setPhotos([]);
      }
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const scanLibrary = async (libId, e) => {
    e?.stopPropagation();
    try {
      await axios.post(`${BACKEND_URL}/api/gadgets/photos/scan/${libId}`, {}, { headers: getAuth() });
      toast.success('Scan started');
    } catch (err) {
      toast.error('Failed to start scan');
    }
  };

  const selectLibrary = async (lib) => {
    setSelectedLib(lib);
    try {
      const resp = await axios.get(`${BACKEND_URL}/api/gadgets/photos/${lib.id}`, { headers: getAuth() });
      setPhotos(resp.data.photos || []);
    } catch (err) {
      toast.error('Failed to load photos');
    }
  };

  const getPhotoUrl = (photoId) => `${BACKEND_URL}/api/gadgets/photos/file/${photoId}`;

  const navigateLightbox = (delta) => {
    setLightboxIndex(prev => {
      const next = prev + delta;
      if (next < 0) return photos.length - 1;
      if (next >= photos.length) return 0;
      return next;
    });
  };

  return (
    <Layout>
      <div data-testid="photos-page" className="min-h-screen p-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {selectedLib && (
                <Button variant="ghost" onClick={() => { setSelectedLib(null); setPhotos([]); }} className="mr-2">
                  <ChevronLeft className="w-5 h-5" />
                </Button>
              )}
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center">
                <Image className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">{selectedLib ? selectedLib.name : 'Photos'}</h1>
                <p className="text-gray-400">{selectedLib ? `${photos.length} photos` : `${libraries.length} libraries`}</p>
              </div>
            </div>
            {!selectedLib && (
              <Button onClick={() => setShowAdd(!showAdd)} className="bg-fuchsia-600 hover:bg-fuchsia-700" data-testid="add-photo-library">
                <Plus className="w-4 h-4 mr-2" /> Add Library
              </Button>
            )}
            {selectedLib && (
              <Button variant="outline" size="sm" onClick={(e) => scanLibrary(selectedLib.id, e)}>
                <RefreshCw className="w-4 h-4 mr-2" /> Scan
              </Button>
            )}
          </div>

          {showAdd && !selectedLib && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-xl p-4 mt-4">
              <div className="flex gap-3">
                <Input placeholder="Library name" value={newLib.name} onChange={e => setNewLib(p => ({ ...p, name: e.target.value }))}
                  className="bg-white/5 border-white/10" />
                <Input placeholder="/path/to/photos" value={newLib.path} onChange={e => setNewLib(p => ({ ...p, path: e.target.value }))}
                  className="bg-white/5 border-white/10 flex-1" />
                <Button onClick={addLibrary} className="bg-green-600 hover:bg-green-700">Add & Scan</Button>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-fuchsia-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !selectedLib ? (
          // Library List
          libraries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-24 h-24 rounded-full bg-fuchsia-600/20 flex items-center justify-center mb-6">
                <FolderOpen className="w-12 h-12 text-fuchsia-400" />
              </div>
              <h2 className="text-xl font-bold mb-2">No Photo Libraries</h2>
              <p className="text-gray-400 text-center max-w-md mb-6">Add a photo library to browse your images.</p>
              <Button onClick={() => setShowAdd(true)} className="bg-fuchsia-600 hover:bg-fuchsia-700">
                <Plus className="w-4 h-4 mr-2" /> Add Your First Library
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {libraries.map((lib) => (
                <motion.div key={lib.id} whileHover={{ scale: 1.02 }}
                  className="glass-card rounded-xl p-6 cursor-pointer group"
                  onClick={() => selectLibrary(lib)} data-testid={`library-${lib.id}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-fuchsia-600/30 flex items-center justify-center">
                      <Image className="w-8 h-8 text-fuchsia-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{lib.name}</h3>
                      <p className="text-sm text-gray-400 truncate">{lib.path}</p>
                      <p className="text-xs text-gray-500 mt-1">{lib.photo_count || 0} photos</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" onClick={(e) => scanLibrary(lib.id, e)}>
                      <RefreshCw className="w-4 h-4 mr-1" /> Scan
                    </Button>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deleteLibrary(lib.id); }} className="text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )
        ) : (
          // Photo Grid
          photos.length === 0 ? (
            <div className="text-center py-20">
              <Image className="w-20 h-20 mx-auto text-gray-600 mb-4" />
              <h2 className="text-xl font-bold mb-2">No Photos Found</h2>
              <p className="text-gray-400 mb-4">Scan the library to discover photos.</p>
              <Button onClick={(e) => scanLibrary(selectedLib.id, e)} className="bg-fuchsia-600 hover:bg-fuchsia-700">
                <RefreshCw className="w-4 h-4 mr-2" /> Scan Now
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {photos.map((photo, idx) => (
                <motion.div key={photo.id} whileHover={{ scale: 1.05 }}
                  className="aspect-square rounded-lg overflow-hidden cursor-pointer relative group"
                  onClick={() => setLightboxIndex(idx)}>
                  <img src={getPhotoUrl(photo.id)} alt={photo.filename}
                    className="w-full h-full object-cover" loading="lazy"
                    onError={(e) => { e.target.src = ''; e.target.className = 'w-full h-full bg-gray-800 flex items-center justify-center'; }} />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ZoomIn className="w-8 h-8 text-white" />
                  </div>
                </motion.div>
              ))}
            </div>
          )
        )}

        {/* Lightbox */}
        <AnimatePresence>
          {lightboxIndex !== null && photos[lightboxIndex] && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
              onClick={() => setLightboxIndex(null)}>
              <Button variant="ghost" className="absolute top-4 right-4 text-white" onClick={() => setLightboxIndex(null)}>
                <X className="w-6 h-6" />
              </Button>
              <Button variant="ghost" className="absolute left-4 top-1/2 -translate-y-1/2 text-white"
                onClick={(e) => { e.stopPropagation(); navigateLightbox(-1); }}>
                <ChevronLeft className="w-8 h-8" />
              </Button>
              <img src={getPhotoUrl(photos[lightboxIndex].id)} alt=""
                className="max-w-[90vw] max-h-[90vh] object-contain"
                onClick={(e) => e.stopPropagation()} />
              <Button variant="ghost" className="absolute right-4 top-1/2 -translate-y-1/2 text-white"
                onClick={(e) => { e.stopPropagation(); navigateLightbox(1); }}>
                <ChevronRight className="w-8 h-8" />
              </Button>
              <div className="absolute bottom-4 text-white text-center">
                <p className="font-medium">{photos[lightboxIndex].filename}</p>
                <p className="text-sm text-gray-400">{lightboxIndex + 1} / {photos.length}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    <ConfirmDialog />
    </Layout>
  );
};

export default PhotosPage;
