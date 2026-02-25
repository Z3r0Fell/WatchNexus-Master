import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Radio, Search, Play, Pause, Volume2, Heart, Globe } from 'lucide-react';

const PRESET_STATIONS = [
  { name: 'ChillHop Radio', genre: 'Lo-Fi', url: '#', country: 'Internet', listeners: '12.4K' },
  { name: 'Jazz24', genre: 'Jazz', url: '#', country: 'US', listeners: '8.2K' },
  { name: 'Classical KUSC', genre: 'Classical', url: '#', country: 'US', listeners: '5.1K' },
  { name: 'BBC Radio 1', genre: 'Pop', url: '#', country: 'UK', listeners: '45.3K' },
  { name: 'SomaFM Groove Salad', genre: 'Ambient', url: '#', country: 'US', listeners: '3.8K' },
  { name: 'NTS Radio', genre: 'Eclectic', url: '#', country: 'UK', listeners: '7.6K' },
  { name: 'FIP Radio', genre: 'World', url: '#', country: 'FR', listeners: '9.1K' },
  { name: 'Nightwave Plaza', genre: 'Vaporwave', url: '#', country: 'Internet', listeners: '2.3K' },
];

const GENRES = ['All', 'Lo-Fi', 'Jazz', 'Classical', 'Pop', 'Ambient', 'Eclectic', 'World', 'Rock', 'Electronic'];

const RadioPage = () => {
  const [search, setSearch] = useState('');
  const [activeGenre, setActiveGenre] = useState('All');
  const [playing, setPlaying] = useState(null);
  const [favorites, setFavorites] = useState([]);

  const filtered = PRESET_STATIONS.filter(s =>
    (activeGenre === 'All' || s.genre === activeGenre) &&
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div data-testid="radio-page" className="min-h-screen p-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <Radio className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Internet Radio</h1>
              <p className="text-gray-400">Thousands of stations at your fingertips</p>
            </div>
          </div>
          <div className="flex gap-3 items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input placeholder="Search stations..." value={search} onChange={e => setSearch(e.target.value)}
                className="pl-10 bg-white/5 border-white/10" data-testid="radio-search" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {GENRES.map(g => (
              <Button key={g} size="sm" variant={activeGenre === g ? 'default' : 'outline'}
                onClick={() => setActiveGenre(g)}
                className={activeGenre === g ? 'bg-green-600 hover:bg-green-700' : 'border-white/10'}>
                {g}
              </Button>
            ))}
          </div>
        </motion.div>

        {/* Now Playing */}
        {playing && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-xl p-4 mb-6 border border-green-500/30 bg-green-500/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-600 flex items-center justify-center">
                  <Volume2 className="w-5 h-5 text-white animate-pulse" />
                </div>
                <div>
                  <p className="font-semibold">Now Playing: {playing.name}</p>
                  <p className="text-sm text-gray-400">{playing.genre} &middot; {playing.country}</p>
                </div>
              </div>
              <Button onClick={() => setPlaying(null)} variant="ghost" size="sm" className="text-red-400">
                <Pause className="w-5 h-5" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Stations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((station, i) => (
            <motion.div key={station.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`glass-card rounded-xl p-4 hover:bg-white/10 transition-all cursor-pointer ${playing?.name === station.name ? 'ring-2 ring-green-500' : ''}`}
              onClick={() => setPlaying(station)}
              data-testid={`station-${i}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{station.name}</h3>
                  <p className="text-sm text-gray-400">{station.genre}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                    <Globe className="w-3 h-3" /> {station.country}
                    <span>&middot;</span>
                    <span>{station.listeners} listeners</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8"
                    onClick={e => { e.stopPropagation(); setFavorites(p => p.includes(station.name) ? p.filter(f => f !== station.name) : [...p, station.name]); }}>
                    <Heart className={`w-4 h-4 ${favorites.includes(station.name) ? 'fill-red-400 text-red-400' : 'text-gray-500'}`} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-green-400" onClick={e => { e.stopPropagation(); setPlaying(station); }}>
                    {playing?.name === station.name ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default RadioPage;
