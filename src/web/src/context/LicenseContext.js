import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { BACKEND_URL } from '../lib/config';

const LicenseContext = createContext(null);

// Route path → module codename mapping
export const ROUTE_MODULE_MAP = {
  '/': 'core',
  '/library': 'marmalade',
  '/movies': 'marmalade',
  '/tv': 'marmalade',
  '/anime': 'marmalade',
  '/playlists': 'playlists',
  '/collections': 'roux',
  '/music': 'marmalade',
  '/audiobooks': 'marmalade',
  '/live': 'iptv',
  '/streaming': 'streaming-logins',
  '/indexers': 'compote',
  '/automation': 'fondue',
  '/downloads': 'downloads',
  '/search': 'core',
  '/discover': 'nutmeg',
  '/history': 'truffle',
  '/watchlist': 'watchlist',
  '/settings': 'settings',
  '/help': 'core',
  // Gadgets
  '/weather': 'sorbet',
  '/podcasts': 'brioche',
  '/radio': 'nectar',
  '/photos': 'ganache',
  '/webvideo': 'bisque',
  '/analytics': 'truffle',
  '/notifications': 'pepper',
  '/requests': 'meringue',
  '/parental-controls': 'rind',
  '/processing': 'crucible',
  '/usenet': 'brine',
  // Settings sub-pages
  '/security': 'security',
  '/vpn': 'vpn',
  '/library-manager': 'libraries',
  '/browse': 'marmalade',
  '/log-viewer': 'logs',
  '/system': 'system',
  '/plugins': 'ripen',
  '/tasks': 'saffron',
  '/download-clients': 'churro',
  '/backups': 'sourdough',
  '/scrobbling': 'glaze',
  '/rss': 'sprout',
  '/disc-ripping': 'strudel',
  '/jellyseerr': 'parfait',
  '/requests-manager': 'menu',
  '/gaming': 'pretzel',
  '/ebooks': 'biscotti',
  '/music-library': 'treacle',
  '/for-you': 'sage',
  '/dvr': 'terrine',
  '/offline': 'popsicle',
  '/cloud-backup': 'preserves',
  '/cloud-sync': 'marshmallow',
  '/media-sync': 'chowder',
  '/themes': 'milk',
  '/dvr': 'iptv',
};

// Module → required tier
const MODULE_TIER = {
  // Standard
  core: 'standard', auth: 'standard', users: 'standard', settings: 'standard',
  setup: 'standard', dashboard: 'standard', preferences: 'standard', logs: 'standard',
  system: 'standard', marmalade: 'standard', tmdb: 'standard', libraries: 'standard',
  watchlist: 'standard', 'watch-progress': 'standard', playlists: 'standard',
  filesystem: 'standard', 'quality-profiles': 'standard', indexers: 'standard',
  'media-ops': 'standard', downloads: 'standard', 'next-up': 'standard',
  milk: 'standard', gelatin: 'standard', churro: 'standard', roux: 'standard',
  glaze: 'standard', sorbet: 'standard', brioche: 'standard', nectar: 'standard',
  ganache: 'standard', bisque: 'standard', ripen: 'standard',
  // Pro
  compote: 'pro', fondue: 'pro', saffron: 'pro', sourdough: 'pro',
  bastion: 'pro', truffle: 'pro', tunnel: 'pro', sprout: 'pro',
  drizzle: 'pro', meringue: 'pro', nutmeg: 'pro',
  'streaming-logins': 'pro', 'streaming-services': 'pro', iptv: 'pro',
  biscotti: 'pro', treacle: 'pro', sage: 'pro', terrine: 'pro',
  // Ultra
  security: 'ultra', rind: 'ultra', pepper: 'ultra', crucible: 'ultra',
  strudel: 'ultra', crumbs: 'ultra', taffy: 'ultra',
  cinnamon: 'ultra', waffle: 'ultra', custard: 'ultra', yeast: 'ultra',
  brine: 'ultra', ladle: 'ultra', 'watch-party': 'ultra', vpn: 'ultra',
  qbittorrent: 'ultra', subtitles: 'ultra', pretzel: 'ultra', parfait: 'ultra', menu: 'ultra',
  popsicle: 'ultra', preserves: 'ultra', marshmallow: 'ultra', chowder: 'ultra',
};

const TIER_RANK = { standard: 0, pro: 1, ultra: 2 };

export const LicenseProvider = ({ children }) => {
  const [tier, setTier] = useState('standard');
  const [unlockedModules, setUnlockedModules] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLicense = useCallback(async () => {
    try {
      // Cookie auth: the httpOnly wn_token is sent automatically.
      const res = await axios.get(`${BACKEND_URL}/api/cellar/status`);
      setTier(res.data.tier || 'standard');
      setUnlockedModules(res.data.modules_unlocked || []);
    } catch {
      setTier('standard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLicense(); }, [fetchLicense]);

  // Listen for license changes (dispatched from ActivationSettings)
  useEffect(() => {
    const handler = () => fetchLicense();
    window.addEventListener('watchnexus_license_changed', handler);
    return () => window.removeEventListener('watchnexus_license_changed', handler);
  }, [fetchLicense]);

  const isModuleUnlocked = useCallback((moduleName) => {
    if (!moduleName) return true;
    const required = MODULE_TIER[moduleName];
    if (!required) return true; // Unknown module = allow
    return TIER_RANK[tier] >= TIER_RANK[required];
  }, [tier]);

  const isRouteUnlocked = useCallback((path) => {
    const mod = ROUTE_MODULE_MAP[path];
    if (!mod) return true;
    return isModuleUnlocked(mod);
  }, [isModuleUnlocked]);

  const getRequiredTier = useCallback((moduleName) => {
    return MODULE_TIER[moduleName] || 'standard';
  }, []);

  const getRouteRequiredTier = useCallback((path) => {
    const mod = ROUTE_MODULE_MAP[path];
    return mod ? (MODULE_TIER[mod] || 'standard') : 'standard';
  }, []);

  const value = useMemo(() => ({
    tier, unlockedModules, loading,
    isModuleUnlocked, isRouteUnlocked,
    getRequiredTier, getRouteRequiredTier,
    refreshLicense: fetchLicense,
  }), [tier, unlockedModules, loading, isModuleUnlocked, isRouteUnlocked, getRequiredTier, getRouteRequiredTier, fetchLicense]);

  return (
    <LicenseContext.Provider value={value}>
      {children}
    </LicenseContext.Provider>
  );
};

export const useLicense = () => {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error('useLicense must be used within LicenseProvider');
  return ctx;
};
