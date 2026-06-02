import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../../components/layout/Layout';
import axios from 'axios';
import { toast } from 'sonner';
import { Search, Database, Settings, Save, RefreshCw, Download, Globe, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

const API = process.env.REACT_APP_BACKEND_URL || '';

export const UsenetPage = () => {
  const [brineConfig, setBrineConfig] = useState(null);
  const [ladleConfig, setLadleConfig] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showBrineConfig, setShowBrineConfig] = useState(false);
  const [showLadleConfig, setShowLadleConfig] = useState(false);
  const [brineUrl, setBrineUrl] = useState('');
  const [brineApiKey, setBrineApiKey] = useState('');
  const [ladleUrl, setLadleUrl] = useState('');
  const [ladleApiKey, setLadleApiKey] = useState('');

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchConfigs = async () => {
    try {
      const [brineRes, ladleRes] = await Promise.all([
        axios.get(`${API}/api/gadgets/brine/config`, { headers }),
        axios.get(`${API}/api/gadgets/ladle/config`, { headers }),
      ]);
      setBrineConfig(brineRes.data);
      setLadleConfig(ladleRes.data);
      if (brineRes.data.url) setBrineUrl(brineRes.data.url);
      if (brineRes.data.api_key) setBrineApiKey(brineRes.data.api_key);
      if (ladleRes.data.url) setLadleUrl(ladleRes.data.url);
      if (ladleRes.data.api_key) setLadleApiKey(ladleRes.data.api_key);
    } catch (e) {
      console.error('Usenet config fetch error:', e);
        toast.error('Usenet config fetch error:');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfigs(); }, []);

  const saveBrineConfig = async () => {
    try {
      await axios.put(`${API}/api/gadgets/brine/config`, { url: brineUrl, api_key: brineApiKey }, { headers });
      toast.success('Indexer config saved');
      setShowBrineConfig(false);
      fetchConfigs();
    } catch (e) {
      toast.error('Failed to save config');
    }
  };

  const saveLadleConfig = async () => {
    try {
      await axios.put(`${API}/api/gadgets/ladle/config`, { url: ladleUrl, api_key: ladleApiKey }, { headers });
      toast.success('Downloader config saved');
      setShowLadleConfig(false);
      fetchConfigs();
    } catch (e) {
      toast.error('Failed to save config');
    }
  };

  const searchUsenet = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await axios.get(`${API}/api/gadgets/brine/search`, { headers, params: { q: searchQuery } });
      setSearchResults(Array.isArray(res.data) ? res.data : res.data.results || []);
    } catch (e) {
      toast.error('Search failed. Is your indexer configured?');
    } finally {
      setSearching(false);
    }
  };

  const grabRelease = async (item) => {
    try {
      await axios.post(`${API}/api/gadgets/ladle/add`, { nzb_url: item.link || item.url, title: item.title }, { headers });
      toast.success(`Added "${item.title}" to downloads`);
    } catch (e) {
      toast.error('Failed to add download');
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6" data-testid="usenet-page">
        <div>
          <h1 className="text-2xl font-bold text-white">Usenet</h1>
          <p className="text-gray-400 text-sm mt-1">Search indexers and manage downloads via Usenet</p>
        </div>

        {/* Config Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-violet-400" />
                <h3 className="text-white font-semibold">Indexer (Brine)</h3>
              </div>
              <span className={`px-2 py-1 rounded text-xs ${brineConfig?.configured ? 'bg-green-400/10 text-green-400' : 'bg-yellow-400/10 text-yellow-400'}`}>
                {brineConfig?.configured ? 'Connected' : 'Not Configured'}
              </span>
            </div>
            <p className="text-gray-500 text-xs mb-3">Prowlarr-compatible Usenet indexer</p>
            <Button variant="outline" size="sm" onClick={() => setShowBrineConfig(!showBrineConfig)} data-testid="configure-brine-btn">
              <Settings className="w-3 h-3 mr-1" /> Configure
            </Button>
            {showBrineConfig && (
              <div className="mt-4 space-y-3">
                <Input placeholder="Indexer URL (e.g. http://localhost:9696)" value={brineUrl} onChange={e => setBrineUrl(e.target.value)} data-testid="brine-url-input" />
                <Input placeholder="API Key" value={brineApiKey} onChange={e => setBrineApiKey(e.target.value)} data-testid="brine-apikey-input" />
                <Button size="sm" onClick={saveBrineConfig} data-testid="save-brine-btn"><Save className="w-3 h-3 mr-1" /> Save</Button>
              </div>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-blue-400" />
                <h3 className="text-white font-semibold">Downloader (Ladle)</h3>
              </div>
              <span className={`px-2 py-1 rounded text-xs ${ladleConfig?.configured ? 'bg-green-400/10 text-green-400' : 'bg-yellow-400/10 text-yellow-400'}`}>
                {ladleConfig?.configured ? 'Connected' : 'Not Configured'}
              </span>
            </div>
            <p className="text-gray-500 text-xs mb-3">SABnzbd-compatible Usenet downloader</p>
            <Button variant="outline" size="sm" onClick={() => setShowLadleConfig(!showLadleConfig)} data-testid="configure-ladle-btn">
              <Settings className="w-3 h-3 mr-1" /> Configure
            </Button>
            {showLadleConfig && (
              <div className="mt-4 space-y-3">
                <Input placeholder="SABnzbd URL (e.g. http://localhost:8080)" value={ladleUrl} onChange={e => setLadleUrl(e.target.value)} data-testid="ladle-url-input" />
                <Input placeholder="API Key" value={ladleApiKey} onChange={e => setLadleApiKey(e.target.value)} data-testid="ladle-apikey-input" />
                <Button size="sm" onClick={saveLadleConfig} data-testid="save-ladle-btn"><Save className="w-3 h-3 mr-1" /> Save</Button>
              </div>
            )}
          </motion.div>
        </div>

        {/* Search */}
        <div className="glass-card rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Search className="w-5 h-5 text-violet-400" /> Search Usenet
          </h2>
          <div className="flex gap-3">
            <Input
              placeholder="Search for movies, TV shows, music..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchUsenet()}
              className="flex-1"
              data-testid="usenet-search-input"
            />
            <Button onClick={searchUsenet} disabled={searching} data-testid="usenet-search-btn">
              {searching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              {searchResults.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors" data-testid={`usenet-result-${i}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{item.title}</p>
                    <p className="text-gray-500 text-xs">{item.size ? `${(item.size / 1024 / 1024 / 1024).toFixed(1)} GB` : ''} {item.indexer ? `- ${item.indexer}` : ''}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => grabRelease(item)} data-testid={`grab-usenet-${i}`}>
                    <Download className="w-3 h-3 mr-1" /> Grab
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default UsenetPage;
