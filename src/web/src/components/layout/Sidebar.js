import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  Film,
  Tv,
  Music,
  BookOpen,
  Radio,
  Download,
  Settings,
  Search,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Play,
  Layers,
  FolderOpen,
  Compass,
  ListVideo,
  Sparkles,
  Image,
  Gamepad2,
  Podcast,
  MonitorPlay,
  Cloud,
  Video,
  Shield,
  Wifi,
  Server,
  FileText,
  Library
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useGadgets } from '../../context/GadgetContext';
import { cn } from '../../lib/utils';

// Icon mapping for dynamic gadget sidebar entries
const ICON_MAP = {
  Image, Gamepad2, Radio, Podcast, MonitorPlay, Cloud, Video,
  Home, Film, Tv, Music, BookOpen, Download, Settings,
  Search, Play, Layers, FolderOpen, Compass, ListVideo, Sparkles,
  Shield, Wifi, Server, FileText, Library,
};

// All navigation items - Home, Downloads, Settings are always visible (not hideable)
const allNavItems = [
  { icon: Home, label: 'Home', path: '/', alwaysVisible: true },
  { icon: FolderOpen, label: 'Library', path: '/library', hideable: true },
  { icon: Film, label: 'Movies', path: '/movies', hideable: true },
  { icon: Tv, label: 'TV Shows', path: '/tv', hideable: true },
  { icon: Sparkles, label: 'Anime', path: '/anime', hideable: true },
  { icon: ListVideo, label: 'Playlists', path: '/playlists', hideable: true },
  { icon: Music, label: 'Music', path: '/music', hideable: true },
  { icon: BookOpen, label: 'Audiobooks', path: '/audiobooks', hideable: true },
  { icon: Radio, label: 'Live TV', path: '/live', hideable: true },
  { icon: Layers, label: 'Streaming', path: '/streaming', hideable: true },
  { icon: Compass, label: 'Indexers', path: '/indexers', hideable: true },
  // Gadget Pages
  { icon: Cloud, label: 'Weather', path: '/weather', hideable: true, isGadget: true },
  { icon: Podcast, label: 'Podcasts', path: '/podcasts', hideable: true, isGadget: true },
  { icon: Radio, label: 'Radio', path: '/radio', hideable: true, isGadget: true },
  { icon: Image, label: 'Photos', path: '/photos', hideable: true, isGadget: true },
  { icon: Video, label: 'Web Video', path: '/webvideo', hideable: true, isGadget: true },
  // Admin
  { icon: Shield, label: 'Security', path: '/security', hideable: true },
  { icon: Wifi, label: 'VPN Portal', path: '/vpn', hideable: true },
  { icon: Library, label: 'Lib Manager', path: '/library-manager', hideable: true },
  { icon: FileText, label: 'Log Viewer', path: '/log-viewer', hideable: true },
  { icon: Server, label: 'System', path: '/system', hideable: true },
  // Always visible
  { icon: Download, label: 'Downloads', path: '/downloads', alwaysVisible: true },
  { icon: Settings, label: 'Settings', path: '/settings', alwaysVisible: true },
];

// Default visible tabs (all except Live TV which users often don't use)
const defaultVisibleTabs = ['Library', 'Movies', 'TV Shows', 'Anime', 'Playlists', 'Music', 'Audiobooks', 'Streaming', 'Indexers', 'Weather', 'Podcasts', 'Radio', 'Photos', 'Web Video', 'Security', 'VPN Portal', 'Lib Manager', 'Log Viewer', 'System'];

// Get visible tabs from localStorage
const getVisibleTabs = () => {
  try {
    const saved = localStorage.getItem('watchnexus_visible_tabs');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error loading visible tabs:', e);
  }
  return defaultVisibleTabs;
};

export const Sidebar = () => {
  const [expanded, setExpanded] = useState(true);
  const [visibleTabs, setVisibleTabs] = useState(getVisibleTabs);
  const location = useLocation();
  const { logout, user } = useAuth();
  const { hooks } = useGadgets();

  // Listen for changes from settings page
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'watchnexus_visible_tabs') {
        setVisibleTabs(getVisibleTabs());
      }
    };
    
    const handleTabsUpdate = () => {
      setVisibleTabs(getVisibleTabs());
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('watchnexus_tabs_updated', handleTabsUpdate);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('watchnexus_tabs_updated', handleTabsUpdate);
    };
  }, []);

  // Build dynamic gadget sidebar items from active hooks
  const gadgetNavItems = (hooks?.sidebar_entries || []).map(entry => ({
    icon: ICON_MAP[entry.icon] || Sparkles,
    label: entry.label,
    path: entry.path,
    hideable: true,
    isGadget: true,
  }));

  // Combine static + gadget nav items (gadgets go before Downloads/Settings)
  const staticBeforeDownloads = allNavItems.filter(i => !i.alwaysVisible || i.path === '/');
  const staticAfter = allNavItems.filter(i => i.alwaysVisible && i.path !== '/');
  const combinedItems = [
    ...allNavItems.filter(i => i.path !== '/downloads' && i.path !== '/settings'),
    ...gadgetNavItems,
    ...allNavItems.filter(i => i.path === '/downloads' || i.path === '/settings'),
  ];

  // Filter nav items based on visibility settings
  const navItems = combinedItems.filter(item => 
    item.alwaysVisible || item.isGadget || visibleTabs.includes(item.label)
  );

  return (
    <motion.aside
      data-testid="sidebar"
      initial={false}
      animate={{ width: expanded ? 240 : 72 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="sidebar fixed left-0 top-0 h-screen z-50 flex flex-col"
    >
      {/* Logo */}
      <div className="p-4 flex items-center justify-between border-b border-white/5">
        <Link to="/" className="flex items-center gap-3">
          <img 
            src="/watchnexus-logo.svg" 
            alt="WatchNexus" 
            className="w-10 h-10 rounded-xl"
          />
          <AnimatePresence>
            {expanded && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="font-bold text-xl tracking-tight"
                style={{
                  background: `linear-gradient(90deg, var(--primary, #8B5CF6), var(--secondary, #EC4899))`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}
              >
                WatchNexus
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
        <button
          data-testid="sidebar-toggle"
          onClick={() => setExpanded(!expanded)}
          className="p-2 rounded-lg hover:bg-white/5 transition-colors"
        >
          {expanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {/* Search (expanded only) */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 border-b border-white/5"
          >
            <Link
              to="/search"
              data-testid="search-link"
              className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
            >
              <Search className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-400">Search...</span>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto hide-scrollbar">
        <ul className="space-y-1 px-3">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                    isActive
                      ? "text-white"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  )}
                  style={isActive ? {
                    backgroundColor: 'color-mix(in srgb, var(--primary, #8B5CF6) 20%, transparent)',
                    color: 'var(--primary, #8B5CF6)'
                  } : {}}
                >
                  <Icon 
                    className="w-5 h-5" 
                    style={isActive ? { color: 'var(--primary, #8B5CF6)' } : {}}
                  />
                  <AnimatePresence>
                    {expanded && (
                      <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="text-sm font-medium"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {isActive && expanded && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="ml-auto w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: 'var(--primary, #8B5CF6)' }}
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-white/5">
        <div className={cn("flex items-center", expanded ? "gap-3" : "justify-center")}>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-white">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex-1 min-w-0"
              >
                <p className="text-sm font-medium truncate">{user?.username || 'User'}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {expanded && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={logout}
                data-testid="logout-btn"
                className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  );
};
