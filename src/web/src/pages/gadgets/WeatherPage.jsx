import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Cloud, Sun, CloudRain, CloudSnow, Wind, Droplets, Search, MapPin, RefreshCw, Thermometer } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const getWeatherIcon = (icon) => {
  const icons = {
    'sun': <Sun className="w-16 h-16 text-yellow-400" />,
    'cloud-sun': <Cloud className="w-16 h-16 text-gray-300" />,
    'cloud': <Cloud className="w-16 h-16 text-gray-400" />,
    'cloud-drizzle': <CloudRain className="w-16 h-16 text-blue-300" />,
    'cloud-rain': <CloudRain className="w-16 h-16 text-blue-400" />,
    'snowflake': <CloudSnow className="w-16 h-16 text-blue-200" />,
    'bolt': <Cloud className="w-16 h-16 text-purple-400" />,
  };
  return icons[icon] || <Cloud className="w-16 h-16 text-gray-400" />;
};

const SmallIcon = ({ icon }) => {
  const icons = {
    'sun': <Sun className="w-6 h-6 text-yellow-400" />,
    'cloud-sun': <Cloud className="w-6 h-6 text-gray-300" />,
    'cloud': <Cloud className="w-6 h-6 text-gray-400" />,
    'cloud-drizzle': <CloudRain className="w-6 h-6 text-blue-300" />,
    'cloud-rain': <CloudRain className="w-6 h-6 text-blue-400" />,
    'snowflake': <CloudSnow className="w-6 h-6 text-blue-200" />,
    'bolt': <Cloud className="w-6 h-6 text-purple-400" />,
  };
  return icons[icon] || <Cloud className="w-6 h-6 text-gray-400" />;
};

export const WeatherPage = () => {
  const [weather, setWeather] = useState(null);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);

  const getAuth = () => {
    return {};
  };

  const fetchWeather = useCallback(async (lat, lon) => {
    try {
      setLoading(true);
      const resp = await axios.get(`${BACKEND_URL}/api/gadgets/weather`, {
        params: { lat, lon },
        headers: getAuth()
      });
      setWeather(resp.data);
    } catch (err) {
      toast.error('Failed to fetch weather');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const resp = await axios.get(`${BACKEND_URL}/api/gadgets/weather/settings`, { headers: getAuth() });
      setLocation(resp.data);
      fetchWeather(resp.data.lat, resp.data.lon);
    } catch (err) {
      // Use default
      fetchWeather(40.7128, -74.0060);
    }
  }, [fetchWeather]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const searchLocation = async () => {
    if (!searchQuery.trim()) return;
    try {
      const resp = await axios.get(`${BACKEND_URL}/api/gadgets/weather/search`, {
        params: { q: searchQuery },
        headers: getAuth()
      });
      setSearchResults(resp.data.results || []);
    } catch (err) {
      toast.error('Search failed');
    }
  };

  const selectLocation = async (loc) => {
    const newLoc = { lat: loc.lat, lon: loc.lon, name: loc.name, country: loc.country };
    setLocation(newLoc);
    setShowSearch(false);
    setSearchResults([]);
    setSearchQuery('');
    
    try {
      await axios.post(`${BACKEND_URL}/api/gadgets/weather/settings`, newLoc, { headers: getAuth() });
      fetchWeather(loc.lat, loc.lon);
      toast.success(`Location set to ${loc.name}`);
    } catch (err) {
      toast.error('Failed to save location');
    }
  };

  const formatDay = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Today';
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  return (
    <Layout>
      <div data-testid="weather-page" className="min-h-screen p-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
                <Cloud className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Weather</h1>
                <p className="text-gray-400">{location?.name || 'Loading...'}, {location?.country || ''}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => fetchWeather(location?.lat, location?.lon)} data-testid="refresh-weather">
                <RefreshCw className="w-4 h-4 mr-2" /> Refresh
              </Button>
              <Button onClick={() => setShowSearch(!showSearch)} className="bg-blue-600 hover:bg-blue-700" data-testid="change-location">
                <MapPin className="w-4 h-4 mr-2" /> Change Location
              </Button>
            </div>
          </div>

          {showSearch && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="glass-card rounded-xl p-4 mt-4">
              <div className="flex gap-3 mb-4">
                <Input
                  placeholder="Search city..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchLocation()}
                  className="bg-white/5 border-white/10 flex-1"
                  data-testid="location-search-input"
                />
                <Button onClick={searchLocation} className="bg-blue-600 hover:bg-blue-700">
                  <Search className="w-4 h-4" />
                </Button>
              </div>
              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {searchResults.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => selectLocation(r)}
                      className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/10 transition-colors"
                      data-testid={`location-result-${i}`}
                    >
                      <p className="font-medium">{r.name}</p>
                      <p className="text-sm text-gray-400">{r.country}</p>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : weather ? (
          <div className="space-y-6">
            {/* Current Weather */}
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="glass-card rounded-2xl p-8 bg-gradient-to-br from-blue-900/40 to-purple-900/40">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-7xl font-bold">{Math.round(weather.current?.temperature || 0)}°</span>
                    <span className="text-2xl text-gray-400">C</span>
                  </div>
                  <p className="text-xl text-gray-300 mt-2">{weather.current?.description}</p>
                  <p className="text-gray-400 mt-1">Feels like {Math.round(weather.current?.feels_like || 0)}°C</p>
                </div>
                <div className="text-right">
                  {getWeatherIcon(weather.current?.icon)}
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-gray-300">
                      <Droplets className="w-5 h-5" />
                      <span>{weather.current?.humidity}%</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <Wind className="w-5 h-5" />
                      <span>{Math.round(weather.current?.wind_speed || 0)} km/h</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* 7-Day Forecast */}
            <div>
              <h2 className="text-xl font-semibold mb-4">7-Day Forecast</h2>
              <div className="grid grid-cols-7 gap-3">
                {weather.forecast?.map((day, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass-card rounded-xl p-4 text-center"
                  >
                    <p className="font-medium text-sm mb-2">{formatDay(day.date)}</p>
                    <div className="flex justify-center my-3">
                      <SmallIcon icon={day.icon} />
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold">{Math.round(day.temp_max || 0)}°</p>
                      <p className="text-gray-400 text-sm">{Math.round(day.temp_min || 0)}°</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20">
            <Cloud className="w-20 h-20 mx-auto text-gray-600 mb-4" />
            <h2 className="text-xl font-bold mb-2">Weather Unavailable</h2>
            <p className="text-gray-400">Unable to fetch weather data. Please try again.</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default WeatherPage;
