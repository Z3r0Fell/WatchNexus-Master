import { useState, useEffect, useRef } from 'react';
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
  ChevronDown,
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
  Library,
  Store,
  Key,
  BarChart3,
  Bell,
  MessageSquare,
  Lock,
  Cog,
  HardDrive,
  HelpCircle,
  Activity,
  Timer,
  Archive,
  Rss,
  Disc,
  Clapperboard,
  ArrowDownToLine,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useGadgets } from '../../context/GadgetContext';
import { useLicense, ROUTE_MODULE_MAP } from '../../context/LicenseContext';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../LanguageSwitcher';

// Icon mapping for dynamic gadget sidebar entries
const ICON_MAP = {
  Image, Gamepad2, Radio, Podcast, MonitorPlay, Cloud, Video,
  Home, Film, Tv, Music, BookOpen, Download, Settings,
  Search, Play, Layers, FolderOpen, Compass, ListVideo, Sparkles,
  Shield, Wifi, Server, FileText, Library, Store, Key,
  BarChart3, Bell, MessageSquare, Lock, Cog, HardDrive, HelpCircle,
  Activity, Timer, Archive, Rss, Clapperboard,
};

// Media navigation items
const mediaNavItems = [
  { icon: Home, label: 'Home', path: '/', alwaysVisible: true },
  { icon: FolderOpen, label: 'Library', path: '/library', hideable: true },
  { icon: Film, label: 'Movies', path: '/movies', hideable: true },
  { icon: Tv, label: 'TV Shows', path: '/tv', hideable: true },
  { icon: Sparkles, label: 'Anime', path: '/anime', hideable: true },
  { icon: ListVideo, label: 'Playlists', path: '/playlists', hideable: true },
  { icon: Layers, label: 'Collections', path: '/collections', hideable: true },
  { icon: Music, label: 'Music', path: '/music', hideable: true },
  { icon: BookOpen, label: 'Audiobooks', path: '/audiobooks', hideable: true },
  { icon: Radio, label: 'Live TV', path: '/live', hideable: true },
  { icon: Layers, label: 'Streaming', path: '/streaming', hideable: true },
  { icon: Compass, label: 'Indexers', path: '/indexers', hideable: true },
  { icon: Film, label: 'Automation', path: '/automation', hideable: true },
];

// Gadget page items
const gadgetNavItems = [
  { icon: Cloud, label: 'Weather', path: '/weather', hideable: true, isGadget: true },
  { icon: Podcast, label: 'Podcasts', path: '/podcasts', hideable: true, isGadget: true },
  { icon: Radio, label: 'Radio', path: '/radio', hideable: true, isGadget: true },
  { icon: Image, label: 'Photos', path: '/photos', hideable: true, isGadget: true },
  { icon: Video, label: 'Web Video', path: '/webvideo', hideable: true, isGadget: true },
  { icon: BarChart3, label: 'Analytics', path: '/analytics', hideable: true, isGadget: true },
  { icon: Bell, label: 'Notifications', path: '/notifications', hideable: true, isGadget: true },
  { icon: MessageSquare, label: 'Requests', path: '/requests', hideable: true, isGadget: true },
  { icon: Lock, label: 'Parental', path: '/parental-controls', hideable: true, isGadget: true },
  { icon: Cog, label: 'Processing', path: '/processing', hideable: true, isGadget: true },
  { icon: HardDrive, label: 'Usenet', path: '/usenet', hideable: true, isGadget: true },
];

// Admin/Tools items (shown under Settings sub-menu)
const settingsSubItems = [
  { icon: Shield, label: 'Security', path: '/security', hideable: true },
  { icon: Wifi, label: 'VPN Portal', path: '/vpn', hideable: true },
  { icon: Library, label: 'Lib Manager', path: '/library-manager', hideable: true },
  { icon: Film, label: 'Browse Media', path: '/browse', hideable: true },
  { icon: FileText, label: 'Log Viewer', path: '/log-viewer', hideable: true },
  { icon: Server, label: 'System', path: '/system', hideable: true },
  { icon: Store, label: 'Marketplace', path: '/plugins', hideable: true },
  { icon: Timer, label: 'Tasks', path: '/tasks', hideable: true },
  { icon: Download, label: 'DL Clients', path: '/download-clients', hideable: true },
  { icon: Archive, label: 'Backups', path: '/backups', hideable: true },
  { icon: Activity, label: 'Scrobbling', path: '/scrobbling', hideable: true },
  { icon: Rss, label: 'RSS Feeds', path: '/rss', hideable: true },
  { icon: Disc, label: 'Disc Ripping', path: '/disc-ripping', hideable: true },
  { icon: MonitorPlay, label: 'Jellyseerr', path: '/jellyseerr', hideable: true },
  { icon: Clapperboard, label: 'Requests', path: '/requests-manager', hideable: true },
  { icon: Gamepad2, label: 'Gaming', path: '/gaming', hideable: true },
  { icon: BookOpen, label: 'Ebooks', path: '/ebooks', hideable: true },
  { icon: Music, label: 'Music Lib', path: '/music-library', hideable: true },
  { icon: Sparkles, label: 'For You', path: '/for-you', hideable: true },
  { icon: Tv, label: 'DVR', path: '/dvr', hideable: true },
  { icon: Download, label: 'Offline', path: '/offline', hideable: true },
  { icon: Cloud, label: 'Backup', path: '/cloud-backup', hideable: true },
  { icon: Cloud, label: 'Sync', path: '/cloud-sync', hideable: true },
  { icon: ArrowDownToLine, label: 'Media Sync', path: '/media-sync', hideable: true },
];

// Default visible tabs
const defaultVisibleTabs = [
  'Library', 'Movies', 'TV Shows', 'Anime', 'Playlists', 'Collections', 'Music', 'Audiobooks',
  'Streaming', 'Indexers', 'Automation', 'Weather', 'Podcasts', 'Radio', 'Photos', 'Web Video',
  'Analytics', 'Notifications', 'Requests', 'Parental', 'Processing', 'Usenet',
  'Security', 'VPN Portal', 'Lib Manager', 'Browse Media', 'Log Viewer', 'System', 'Marketplace',
  'Tasks', 'DL Clients', 'Backups', 'Scrobbling', 'RSS Feeds', 'Disc Ripping', 'Jellyseerr', 'Requests', 'Gaming',
  'Ebooks', 'Music Lib', 'For You', 'DVR', 'Offline', 'Backup', 'Sync', 'Media Sync',
];

// Get visible tabs from localStorage
const getVisibleTabs = () => {
  try {
    const saved = localStorage.getItem('watchnexus_visible_tabs');
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Error loading visible tabs:', e);
  }
  return defaultVisibleTabs;
};

export const Sidebar = () => {
  const [expanded, setExpanded] = useState(true);
  const [visibleTabs, setVisibleTabs] = useState(getVisibleTabs);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const location = useLocation();
  const { logout, user } = useAuth();
  const { hooks } = useGadgets();
  const { isRouteUnlocked, getRouteRequiredTier } = useLicense();
  const { t } = useTranslation();
  // Translate a nav label by derived key (e.g. "Live TV" -> "nav.live_tv"),
  // falling back to the original English label when no translation exists.
  const tl = (label) => t(`nav.${label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`, { defaultValue: label });

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

  // Auto-expand settings section if current path is a sub-item
  useEffect(() => {
    const isSettingsSubPath = settingsSubItems.some(item => location.pathname === item.path) || location.pathname === '/settings';
    if (isSettingsSubPath) {
      setSettingsOpen(true);
    }
  }, [location.pathname]);

  // Build dynamic gadget sidebar items from active hooks
  const dynamicGadgets = (hooks?.sidebar_entries || []).map(entry => ({
    icon: ICON_MAP[entry.icon] || Sparkles,
    label: entry.label,
    path: entry.path,
    hideable: true,
    isGadget: true,
  }));

  // Filter items based on visibility
  const isVisible = (item) => item.alwaysVisible || visibleTabs.includes(item.label);

  const visibleMedia = mediaNavItems.filter(isVisible);
  const visibleGadgets = [...gadgetNavItems, ...dynamicGadgets].filter(isVisible);
  const visibleSettingsSubs = settingsSubItems.filter(isVisible);

  const renderNavItem = (item) => {
    const isActive = location.pathname === item.path;
    const Icon = item.icon;
    const locked = !isRouteUnlocked(item.path);
    const requiredTier = locked ? getRouteRequiredTier(item.path) : null;
    return (
      <li key={item.path}>
        <Link
          to={item.path}
          data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
            locked ? "text-gray-600 hover:text-gray-500 hover:bg-white/[0.02]" :
            isActive ? "text-white" : "text-gray-400 hover:text-white hover:bg-white/5"
          )}
          style={(!locked && isActive) ? {
            backgroundColor: 'color-mix(in srgb, var(--primary, #8B5CF6) 20%, transparent)',
            color: 'var(--primary, #8B5CF6)',
          } : {}}
        >
          <Icon className="w-5 h-5" style={(!locked && isActive) ? { color: 'var(--primary, #8B5CF6)' } : locked ? { opacity: 0.35 } : {}} />
          <AnimatePresence>
            {expanded && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="text-sm font-medium flex-1"
              >
                {tl(item.label)}
              </motion.span>
            )}
          </AnimatePresence>
          {locked && expanded && (
            <Lock className="w-3.5 h-3.5 text-gray-600" />
          )}
          {!locked && isActive && expanded && (
            <motion.div
              layoutId="activeIndicator"
              className="ml-auto w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: 'var(--primary, #8B5CF6)' }}
            />
          )}
        </Link>
      </li>
    );
  };

  const isSettingsActive = location.pathname === '/settings';
  const isAnySubActive = settingsSubItems.some(item => location.pathname === item.path);

  // Sidebar scroll persistence using sessionStorage
  const navRef = useRef(null);
  const SCROLL_KEY = 'watchnexus_sidebar_scroll';

  const handleNavScroll = () => {
    if (navRef.current) {
      // Save to sessionStorage on every scroll
      sessionStorage.setItem(SCROLL_KEY, navRef.current.scrollTop.toString());
    }
  };

  // Restore scroll position after component mounts and on route change
  useEffect(() => {
    const savedScroll = sessionStorage.getItem(SCROLL_KEY);
    if (navRef.current && savedScroll) {
      const scrollValue = parseInt(savedScroll, 10);
      if (scrollValue > 0) {
        // Use setTimeout to ensure DOM is fully rendered
        setTimeout(() => {
          if (navRef.current) {
            navRef.current.scrollTop = scrollValue;
          }
        }, 50);
      }
    }
  }, [location.pathname]);

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
          <img src="/watchnexus-logo.png" alt="WatchNexus" className="w-10 h-10 rounded-xl" />
          <AnimatePresence>
            {expanded && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="font-bold text-xl tracking-tight"
                style={{
                  background: 'linear-gradient(90deg, var(--primary, #8B5CF6), var(--secondary, #EC4899))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
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

      {/* Search */}
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
      <nav
        ref={navRef}
        className="flex-1 py-4 overflow-y-auto hide-scrollbar"
        onScroll={handleNavScroll}
      >
        <ul className="space-y-1 px-3">
          {/* Media Items */}
          {visibleMedia.map(renderNavItem)}

          {/* Gadget Items */}
          {visibleGadgets.length > 0 && visibleGadgets.map(renderNavItem)}

          {/* Downloads - always visible */}
          {renderNavItem({ icon: Download, label: 'Downloads', path: '/downloads', alwaysVisible: true })}

          {/* Help - always visible */}
          {renderNavItem({ icon: HelpCircle, label: 'Help', path: '/help', alwaysVisible: true })}

          {/* Settings Section with collapsible sub-items */}
          <li>
            <div className="flex flex-col">
              {/* Settings main button */}
              <div className="flex items-center">
                <Link
                  to="/settings"
                  data-testid="nav-settings"
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 flex-1",
                    (isSettingsActive || isAnySubActive) ? "text-white" : "text-gray-400 hover:text-white hover:bg-white/5"
                  )}
                  style={(isSettingsActive && !isAnySubActive) ? {
                    backgroundColor: 'color-mix(in srgb, var(--primary, #8B5CF6) 20%, transparent)',
                    color: 'var(--primary, #8B5CF6)',
                  } : {}}
                >
                  <Settings className="w-5 h-5" style={(isSettingsActive || isAnySubActive) ? { color: 'var(--primary, #8B5CF6)' } : {}} />
                  <AnimatePresence>
                    {expanded && (
                      <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="text-sm font-medium"
                      >
                        Settings
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Link>
                {expanded && visibleSettingsSubs.length > 0 && (
                  <button
                    data-testid="settings-expand-toggle"
                    onClick={() => setSettingsOpen(!settingsOpen)}
                    className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                  >
                    <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", settingsOpen && "rotate-180")} />
                  </button>
                )}
              </div>

              {/* Settings sub-items */}
              <AnimatePresence>
                {expanded && settingsOpen && visibleSettingsSubs.length > 0 && (
                  <motion.ul
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="ml-4 pl-3 border-l border-white/10 space-y-0.5 mt-1"
                  >
                    {visibleSettingsSubs.map((item) => {
                      const isActive = location.pathname === item.path;
                      const Icon = item.icon;
                      const locked = !isRouteUnlocked(item.path);
                      return (
                        <li key={item.path}>
                          <Link
                            to={item.path}
                            data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                            className={cn(
                              "flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-200 text-sm",
                              locked ? "text-gray-600 hover:text-gray-500" :
                              isActive ? "text-white bg-white/10" : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                            )}
                          >
                            <Icon className="w-4 h-4" style={(!locked && isActive) ? { color: 'var(--primary, #8B5CF6)' } : locked ? { opacity: 0.35 } : {}} />
                            <span className="font-medium flex-1">{tl(item.label)}</span>
                            {locked && <Lock className="w-3 h-3 text-gray-600" />}
                          </Link>
                        </li>
                      );
                    })}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          </li>
        </ul>
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-white/5">
        <div className={cn("flex items-center", expanded ? "gap-3" : "justify-center")}>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-white">
              {user?.username?.charAt(0).toUpperCase() || user?.Username?.charAt(0).toUpperCase() || 'U'}
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
                <p className="text-sm font-medium truncate">{user?.username || user?.Username || 'User'}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email || user?.Email}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <LanguageSwitcher compact={!expanded} />
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
