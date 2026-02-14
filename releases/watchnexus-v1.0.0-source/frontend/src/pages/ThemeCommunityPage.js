import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { 
  Palette, Search, Download, Star, ExternalLink, Check, X,
  RefreshCw, Grid, List, Eye, Heart, Share2, Upload,
  Moon, Sun, Monitor, Tv, Film, Music
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Sample community themes
const communityThemes = [
  {
    id: 'midnight-oled',
    name: 'Midnight OLED',
    description: 'True black theme optimized for OLED displays with deep purples and subtle accents.',
    author: 'DarkMaster',
    downloads: 15420,
    likes: 892,
    colors: {
      primary: '#7C3AED',
      secondary: '#A855F7',
      background: '#000000',
      surface: '#0A0A0A',
    },
    preview: 'linear-gradient(135deg, #000000 0%, #0A0A0A 50%, #7C3AED 100%)',
    featured: true,
  },
  {
    id: 'ocean-breeze',
    name: 'Ocean Breeze',
    description: 'Calming blue tones inspired by the deep sea, perfect for late night viewing.',
    author: 'AquaDesigns',
    downloads: 8932,
    likes: 654,
    colors: {
      primary: '#0EA5E9',
      secondary: '#06B6D4',
      background: '#0C1222',
      surface: '#1E293B',
    },
    preview: 'linear-gradient(135deg, #0C1222 0%, #1E293B 50%, #0EA5E9 100%)',
    featured: true,
  },
  {
    id: 'forest-green',
    name: 'Forest Green',
    description: 'Natural green hues that are easy on the eyes during extended viewing sessions.',
    author: 'NatureLover',
    downloads: 6543,
    likes: 432,
    colors: {
      primary: '#10B981',
      secondary: '#34D399',
      background: '#0D1F17',
      surface: '#1A2E23',
    },
    preview: 'linear-gradient(135deg, #0D1F17 0%, #1A2E23 50%, #10B981 100%)',
  },
  {
    id: 'sunset-warmth',
    name: 'Sunset Warmth',
    description: 'Warm orange and red tones reminiscent of a beautiful sunset.',
    author: 'WarmColors',
    downloads: 5678,
    likes: 387,
    colors: {
      primary: '#F97316',
      secondary: '#FB923C',
      background: '#1C1410',
      surface: '#2D2118',
    },
    preview: 'linear-gradient(135deg, #1C1410 0%, #2D2118 50%, #F97316 100%)',
  },
  {
    id: 'cherry-blossom',
    name: 'Cherry Blossom',
    description: 'Soft pinks inspired by Japanese cherry blossoms, elegant and feminine.',
    author: 'SakuraFan',
    downloads: 4321,
    likes: 543,
    colors: {
      primary: '#EC4899',
      secondary: '#F472B6',
      background: '#1A0A14',
      surface: '#2D1A24',
    },
    preview: 'linear-gradient(135deg, #1A0A14 0%, #2D1A24 50%, #EC4899 100%)',
    featured: true,
  },
  {
    id: 'neon-nights',
    name: 'Neon Nights',
    description: 'Vibrant neon colors on dark backgrounds, cyberpunk inspired.',
    author: 'CyberPunk',
    downloads: 7890,
    likes: 678,
    colors: {
      primary: '#22D3EE',
      secondary: '#A78BFA',
      background: '#0A0A0F',
      surface: '#14141F',
    },
    preview: 'linear-gradient(135deg, #0A0A0F 0%, #22D3EE 50%, #A78BFA 100%)',
  },
  {
    id: 'grayscale-minimal',
    name: 'Grayscale Minimal',
    description: 'Clean, minimal theme using only shades of gray for a distraction-free experience.',
    author: 'Minimalist',
    downloads: 3456,
    likes: 234,
    colors: {
      primary: '#6B7280',
      secondary: '#9CA3AF',
      background: '#111111',
      surface: '#1F1F1F',
    },
    preview: 'linear-gradient(135deg, #111111 0%, #1F1F1F 50%, #6B7280 100%)',
  },
  {
    id: 'royal-gold',
    name: 'Royal Gold',
    description: 'Luxurious gold accents on deep purple backgrounds, fit for royalty.',
    author: 'GoldMember',
    downloads: 4567,
    likes: 345,
    colors: {
      primary: '#EAB308',
      secondary: '#FCD34D',
      background: '#1A1033',
      surface: '#2D1F4D',
    },
    preview: 'linear-gradient(135deg, #1A1033 0%, #2D1F4D 50%, #EAB308 100%)',
  },
];

export const ThemeCommunityPage = () => {
  const [themes, setThemes] = useState(communityThemes);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('downloads');
  const [viewMode, setViewMode] = useState('grid');
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [previewTheme, setPreviewTheme] = useState(null);
  const [installedThemes, setInstalledThemes] = useState([]);
  const [installing, setInstalling] = useState(null);

  const getToken = () => localStorage.getItem('watchnexus_token');

  // Fetch installed themes from Milk API
  const fetchInstalledThemes = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/milk/themes`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const customThemes = Object.keys(res.data?.custom_themes || {});
      setInstalledThemes(customThemes);
    } catch (err) {
      console.error('Failed to fetch installed themes:', err);
    }
  }, []);

  useEffect(() => {
    fetchInstalledThemes();
  }, [fetchInstalledThemes]);

  // Filter and sort themes
  const filteredThemes = themes
    .filter(t => {
      if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !t.description.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'downloads') return b.downloads - a.downloads;
      if (sortBy === 'likes') return b.likes - a.likes;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return 0;
    });

  const featuredThemes = themes.filter(t => t.featured);

  const handleInstall = async (theme) => {
    setInstalling(theme.id);
    
    try {
      await axios.post(`${API_URL}/api/milk/custom-theme`, {
        name: theme.name,
        colors: theme.colors,
      }, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      
      toast.success(`${theme.name} installed!`);
      fetchInstalledThemes();
    } catch (err) {
      toast.error('Failed to install theme');
    } finally {
      setInstalling(null);
    }
  };

  const handleApply = async (theme) => {
    try {
      // First install if not installed
      if (!installedThemes.includes(theme.name)) {
        await axios.post(`${API_URL}/api/milk/custom-theme`, {
          name: theme.name,
          colors: theme.colors,
        }, {
          headers: { Authorization: `Bearer ${getToken()}` }
        });
      }
      
      // Then apply
      await axios.post(`${API_URL}/api/milk/set-theme`, {
        theme_name: theme.name,
      }, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      
      toast.success(`Applied ${theme.name}!`);
    } catch (err) {
      toast.error('Failed to apply theme');
    }
  };

  const ThemeCard = ({ theme }) => {
    const isInstalled = installedThemes.includes(theme.name);

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -2 }}
        className="rounded-xl bg-surface border border-white/5 hover:border-violet-500/50 overflow-hidden cursor-pointer transition-all"
        onClick={() => setSelectedTheme(theme)}
      >
        {/* Preview */}
        <div 
          className="h-32 relative"
          style={{ background: theme.preview }}
        >
          {/* Color swatches */}
          <div className="absolute bottom-2 right-2 flex gap-1">
            {Object.entries(theme.colors).slice(0, 4).map(([key, color]) => (
              <div
                key={key}
                className="w-6 h-6 rounded-full border-2 border-white/20"
                style={{ backgroundColor: color }}
                title={key}
              />
            ))}
          </div>
          
          {/* Preview button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setPreviewTheme(theme);
            }}
            className="absolute top-2 right-2 p-2 rounded-lg bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 hover:bg-black/70 transition-all"
          >
            <Eye className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Info */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-medium">{theme.name}</h3>
            {isInstalled && <Check className="w-4 h-4 text-green-400" />}
          </div>
          <p className="text-xs text-gray-500 mb-3">by {theme.author}</p>
          <p className="text-sm text-gray-400 line-clamp-2 mb-4">{theme.description}</p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Download className="w-3 h-3" />
                {theme.downloads.toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                <Heart className="w-3 h-3" />
                {theme.likes}
              </span>
            </div>
            
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleApply(theme);
              }}
              disabled={installing === theme.id}
              className="h-7 text-xs"
            >
              {installing === theme.id ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                'Apply'
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <Layout>
      <div data-testid="theme-community-page" className="min-h-screen p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-600 to-rose-500 flex items-center justify-center">
                <Palette className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  Theme Community
                  <span className="text-xs bg-pink-500/20 text-pink-400 px-2 py-0.5 rounded-full">Milk 🥛</span>
                </h1>
                <p className="text-gray-400">Browse and apply community-created themes</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button variant="outline">
                <Upload className="w-4 h-4 mr-2" />
                Share Theme
              </Button>
              <a href="/settings" className="block">
                <Button className="bg-gradient-to-r from-pink-600 to-rose-500">
                  <Palette className="w-4 h-4 mr-2" />
                  Theme Forge
                </Button>
              </a>
            </div>
          </div>
        </motion.div>

        {/* Featured Themes */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-8"
        >
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-400" />
            Featured Themes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {featuredThemes.slice(0, 3).map(theme => (
              <ThemeCard key={theme.id} theme={theme} />
            ))}
          </div>
        </motion.div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-wrap items-center gap-4 mb-6"
        >
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search themes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 rounded-lg bg-surface border border-white/10 text-white"
          >
            <option value="downloads">Most Downloads</option>
            <option value="likes">Most Liked</option>
            <option value="name">Name A-Z</option>
          </select>

          <div className="flex gap-1 bg-surface rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white/10' : ''}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-white/10' : ''}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </motion.div>

        {/* Theme Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
            : 'space-y-3'
          }
        >
          {filteredThemes.map(theme => (
            <ThemeCard key={theme.id} theme={theme} />
          ))}
        </motion.div>

        {filteredThemes.length === 0 && (
          <div className="text-center py-20">
            <Palette className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <h2 className="text-xl font-bold mb-2">No Themes Found</h2>
            <p className="text-gray-400">Try adjusting your search</p>
          </div>
        )}

        {/* Theme Detail Modal */}
        <AnimatePresence>
          {selectedTheme && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setSelectedTheme(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-2xl bg-surface rounded-2xl border border-white/10 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Preview Header */}
                <div 
                  className="h-48 relative"
                  style={{ background: selectedTheme.preview }}
                >
                  <div className="absolute bottom-4 left-4">
                    <h2 className="text-2xl font-bold text-white drop-shadow-lg">{selectedTheme.name}</h2>
                    <p className="text-white/70 drop-shadow">by {selectedTheme.author}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedTheme(null)} 
                    className="absolute top-4 right-4 p-2 rounded-lg bg-black/50 text-white hover:bg-black/70"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6">
                  <p className="text-gray-300 mb-6">{selectedTheme.description}</p>

                  {/* Color Palette */}
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-400 mb-3">Color Palette</h3>
                    <div className="grid grid-cols-4 gap-3">
                      {Object.entries(selectedTheme.colors).map(([key, color]) => (
                        <div key={key} className="text-center">
                          <div
                            className="w-full h-12 rounded-lg border border-white/10 mb-1"
                            style={{ backgroundColor: color }}
                          />
                          <p className="text-xs text-gray-500">{key}</p>
                          <p className="text-xs text-gray-600">{color}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-4 rounded-xl bg-white/5 text-center">
                      <Download className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                      <p className="text-xl font-bold">{selectedTheme.downloads.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">Downloads</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 text-center">
                      <Heart className="w-6 h-6 mx-auto mb-2 text-pink-400" />
                      <p className="text-xl font-bold">{selectedTheme.likes.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">Likes</p>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 flex justify-between">
                  <Button variant="outline" onClick={() => setSelectedTheme(null)}>
                    Close
                  </Button>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => handleInstall(selectedTheme)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Save to Library
                    </Button>
                    <Button
                      className="bg-gradient-to-r from-pink-600 to-rose-500"
                      onClick={() => {
                        handleApply(selectedTheme);
                        setSelectedTheme(null);
                      }}
                    >
                      <Palette className="w-4 h-4 mr-2" />
                      Apply Theme
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
};
