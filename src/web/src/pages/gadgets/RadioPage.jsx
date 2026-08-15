import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Radio, Play, Pause, Heart, Search, Globe, Music, Volume2, Star, X } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

import { BACKEND_URL } from '../../lib/config';

export const RadioPage = () => {
  const [stations, setStations] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [countries, setCountries] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [activeTab, setActiveTab] = useState('popular');
  const [currentStation, setCurrentStation] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  const getAuth = () => ({}); // Cookie auth: wn_token sent automatically

  const fetchStations = useCallback(async (params = {}) => {
    try {
      setLoading(true);
      const resp = await axios.get(`${BACKEND_URL}/api/gadgets/radio/stations`, { params, headers: getAuth() });
      setStations(resp.data.stations || []);
    } catch (err) {
      toast.error('Failed to load stations');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFavorites = useCallback(async () => {
    try {
      const resp = await axios.get(`${BACKEND_URL}/api/gadgets/radio/favorites`, { headers: getAuth() });
      setFavorites(resp.data.favorites || []);
    } catch (err) {
      console.error('Failed to load favorites');
    }
  }, []);

  const fetchFilters = useCallback(async () => {
    try {
      const [countriesResp, tagsResp] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/gadgets/radio/countries`, { headers: getAuth() }),
        axios.get(`${BACKEND_URL}/api/gadgets/radio/tags`, { headers: getAuth() })
      ]);
      setCountries(countriesResp.data.countries || []);
      setTags(tagsResp.data.tags || []);
    } catch (err) {
      console.error('Failed to load filters');
    }
  }, []);

  useEffect(() => {
    fetchStations();
    fetchFavorites();
    fetchFilters();
  }, [fetchStations, fetchFavorites, fetchFilters]);

  const search = () => {
    if (searchQuery.trim()) {
      fetchStations({ q: searchQuery });
      setActiveTab('search');
    }
  };

  const filterByCountry = (country) => {
    setSelectedCountry(country);
    setSelectedTag('');
    fetchStations({ country });
    setActiveTab('country');
  };

  const filterByTag = (tag) => {
    setSelectedTag(tag);
    setSelectedCountry('');
    fetchStations({ tag });
    setActiveTab('genre');
  };

  const playStation = (station) => {
    if (currentStation?.id === station.id && isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      setCurrentStation(station);
      setIsPlaying(true);
      if (audioRef.current) {
        audioRef.current.src = station.url;
        audioRef.current.play().catch(() => toast.error('Failed to play stream'));
      }
    }
  };

  const toggleFavorite = async (station) => {
    const isFav = favorites.some(f => f.station_id === station.id);
    try {
      if (isFav) {
        await axios.delete(`${BACKEND_URL}/api/gadgets/radio/favorites/${station.id}`, { headers: getAuth() });
        setFavorites(f => f.filter(s => s.station_id !== station.id));
        toast.success('Removed from favorites');
      } else {
        await axios.post(`${BACKEND_URL}/api/gadgets/radio/favorites`, {
          station_id: station.id, name: station.name, url: station.url,
          favicon: station.favicon, country: station.country, tags: station.tags
        }, { headers: getAuth() });
        setFavorites(f => [...f, { ...station, station_id: station.id }]);
        toast.success('Added to favorites');
      }
    } catch (err) {
      toast.error('Failed to update favorites');
    }
  };

  const isFavorite = (stationId) => favorites.some(f => f.station_id === stationId);

  const displayStations = activeTab === 'favorites' 
    ? favorites.map(f => ({ ...f, id: f.station_id }))
    : stations;

  return (
    <Layout>
      <div data-testid="radio-page" className="min-h-screen p-8 pb-32">
        <audio ref={audioRef} onError={() => toast.error('Stream unavailable')} />

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <Radio className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Internet Radio</h1>
                <p className="text-gray-400">Thousands of stations worldwide</p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="flex gap-3 mt-6">
            <Input placeholder="Search stations..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              className="bg-white/5 border-white/10 flex-1" data-testid="radio-search" />
            <Button onClick={search} className="bg-green-600 hover:bg-green-700">
              <Search className="w-4 h-4" />
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
            <Button variant={activeTab === 'popular' ? 'default' : 'ghost'} size="sm" 
              onClick={() => { fetchStations(); setActiveTab('popular'); }}
              className={activeTab === 'popular' ? 'bg-green-600' : ''}>
              <Star className="w-4 h-4 mr-1" /> Popular
            </Button>
            <Button variant={activeTab === 'favorites' ? 'default' : 'ghost'} size="sm" 
              onClick={() => setActiveTab('favorites')}
              className={activeTab === 'favorites' ? 'bg-green-600' : ''}>
              <Heart className="w-4 h-4 mr-1" /> Favorites ({favorites.length})
            </Button>
            <Button variant={activeTab === 'country' ? 'default' : 'ghost'} size="sm" 
              onClick={() => setActiveTab('country')}
              className={activeTab === 'country' ? 'bg-green-600' : ''}>
              <Globe className="w-4 h-4 mr-1" /> By Country
            </Button>
            <Button variant={activeTab === 'genre' ? 'default' : 'ghost'} size="sm" 
              onClick={() => setActiveTab('genre')}
              className={activeTab === 'genre' ? 'bg-green-600' : ''}>
              <Music className="w-4 h-4 mr-1" /> By Genre
            </Button>
          </div>
        </motion.div>

        {/* Country/Tag Selector */}
        {activeTab === 'country' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Select Country</h3>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              {countries.map((c) => (
                <Button key={c.code} variant={selectedCountry === c.name ? 'default' : 'outline'} size="sm"
                  onClick={() => filterByCountry(c.name)}
                  className={selectedCountry === c.name ? 'bg-green-600' : ''}>
                  {c.name} ({c.count})
                </Button>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'genre' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Select Genre</h3>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              {tags.map((t) => (
                <Button key={t.name} variant={selectedTag === t.name ? 'default' : 'outline'} size="sm"
                  onClick={() => filterByTag(t.name)}
                  className={selectedTag === t.name ? 'bg-green-600' : ''}>
                  {t.name} ({t.count})
                </Button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Station List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayStations.length === 0 ? (
          <div className="text-center py-20">
            <Radio className="w-20 h-20 mx-auto text-gray-600 mb-4" />
            <h2 className="text-xl font-bold mb-2">No Stations Found</h2>
            <p className="text-gray-400">{activeTab === 'favorites' ? 'Add some favorites!' : 'Try a different search'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayStations.map((station) => (
              <motion.div key={station.id} whileHover={{ scale: 1.02 }}
                className={`glass-card rounded-xl p-4 ${currentStation?.id === station.id ? 'ring-2 ring-green-500' : ''}`}>
                <div className="flex gap-4">
                  {station.favicon ? (
                    <img src={station.favicon} alt="" className="w-16 h-16 rounded-lg object-cover bg-white/10"
                      onError={(e) => { e.target.style.display = 'none'; }} />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-green-600/30 flex items-center justify-center">
                      <Radio className="w-6 h-6 text-green-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{station.name}</h3>
                    <p className="text-sm text-gray-400 truncate">{station.country}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {station.tags?.slice(0, 3).map((tag, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 bg-white/10 rounded-full">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-4">
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => playStation(station)}
                      className={currentStation?.id === station.id && isPlaying ? 'bg-green-600' : 'bg-white/10 hover:bg-white/20'}>
                      {currentStation?.id === station.id && isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleFavorite(station)}
                      className={isFavorite(station.id) ? 'text-red-400' : ''}>
                      <Heart className={`w-4 h-4 ${isFavorite(station.id) ? 'fill-red-400' : ''}`} />
                    </Button>
                  </div>
                  {station.bitrate && <span className="text-xs text-gray-500">{station.bitrate} kbps</span>}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Now Playing */}
        <AnimatePresence>
          {currentStation && (
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
              className="fixed bottom-0 left-0 right-0 bg-[#1a1a1a]/95 backdrop-blur-xl border-t border-white/10 p-4 z-50">
              <div className="max-w-4xl mx-auto flex items-center gap-4">
                {currentStation.favicon ? (
                  <img src={currentStation.favicon} alt="" className="w-14 h-14 rounded-lg object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-green-600/30 flex items-center justify-center">
                    <Radio className="w-6 h-6 text-green-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{currentStation.name}</p>
                  <p className="text-sm text-gray-400 truncate">{currentStation.country}</p>
                </div>
                <div className="flex items-center gap-2">
                  {isPlaying && (
                    <div className="flex items-center gap-1 text-green-400">
                      <Volume2 className="w-4 h-4 animate-pulse" />
                      <span className="text-xs">LIVE</span>
                    </div>
                  )}
                  <Button size="lg" onClick={() => playStation(currentStation)} className="bg-green-600 hover:bg-green-700 rounded-full w-12 h-12">
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleFavorite(currentStation)}>
                    <Heart className={`w-5 h-5 ${isFavorite(currentStation.id) ? 'fill-red-400 text-red-400' : ''}`} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { audioRef.current?.pause(); setCurrentStation(null); setIsPlaying(false); }}>
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
};

export default RadioPage;
