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
import { useLicense } from '../../context/LicenseContext';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../LanguageSwitcher';

const ICON_MAP = {
  Image, Gamepad2, Radio, Podcast, MonitorPlay, Cloud, Video,
  Home, Film, Tv, Music, BookOpen, Download, Settings,
  Search, Play, Layers, FolderOpen, Compass, ListVideo, Sparkles,
  Shield, Wifi, Server, FileText, Library, Store, Key,
  BarChart3, Bell, MessageSquare, Lock, Cog, HardDrive, HelpCircle,
  Activity, Timer, Archive, Rss, Clapperboard,
};
import { toast } from 'sonner';

const mediaNavItems = [
  { icon: Home, labelKey: 'nav.home', path: '/', alwaysVisible: true },
  { icon: FolderOpen, labelKey: 'nav.library', path: '/library', hideable: true },
  { icon: Film, labelKey: 'media.movies', path: '/movies', hideable: true },
  { icon: Tv, labelKey: 'media.tv_shows', path: '/tv', hideable: true },
  { icon: Sparkles, labelKey: 'nav.anime', path: '/anime', hideable: true },
  { icon: ListVideo, labelKey: 'media.playlists', path: '/playlists', hideable: true },
  { icon: Layers, labelKey: 'nav.collections', path: '/collections', hideable: true },
  { icon: Music, labelKey: 'media.music', path: '/music', hideable: true },
  { icon: BookOpen, labelKey: 'nav.audiobooks', path: '/audiobooks', hideable: true },
  { icon: Radio, labelKey: 'nav.live_tv', path: '/live', hideable: true },
  { icon: Layers, labelKey: 'nav.streaming', path: '/streaming', hideable: true },
  { icon: Compass, labelKey: 'nav.indexers', path: '/indexers', hideable: true },
  { icon: Film, labelKey: 'nav.automation', path: '/automation', hideable: true },
];

const gadgetNavItems = [
<<<<<<< HEAD
  { icon: Cloud, label: 'Weather', path: '/weather', hideable: true, isGadget: true },
  { icon: Podcast, label: 'Podcasts', path: '/podcasts', hideable: true, isGadget: true },
  { icon: Radio, label: 'Radio', path: '/radio', hideable: true, isGadget: true },
  { icon: Image, label: 'Photos', path: '/photos', hideable: true, isGadget: true },
  { icon: Video, label: 'Web Video', path: '/webvideo', hideable: true, isGadget: true },
  { icon: Music, label: 'Spotify DL', path: '/spotdl', hideable: true, isGadget: true },
  { icon: BarChart3, label: 'Analytics', path: '/analytics', hideable: true, isGadget: true },
  { icon: Bell, label: 'Notifications', path: '/notifications', hideable: true, isGadget: true },
  { icon: MessageSquare, label: 'Requests', path: '/requests', hideable: true, isGadget: true },
  { icon: Lock, label: 'Parental', path: '/parental-controls', hideable: true, isGadget: true },
  { icon: Cog, label: 'Processing', path: '/processing', hideable: true, isGadget: true },
  { icon: HardDrive, label: 'Usenet', path: '/usenet', hideable: true, isGadget: true },
=======
  { icon: Cloud, labelKey: 'gadgets.weather', path: '/weather', hideable: true, isGadget: true },
  { icon: Podcast, labelKey: 'gadgets.podcasts', path: '/podcasts', hideable: true, isGadget: true },
  { icon: Radio, labelKey: 'gadgets.radio', path: '/radio', hideable: true, isGadget: true },
  { icon: Image, labelKey: 'gadgets.photos', path: '/photos', hideable: true, isGadget: true },
  { icon: Video, labelKey: 'gadgets.webvideo', path: '/webvideo', hideable: true, isGadget: true },
  { icon: BarChart3, labelKey: 'gadgets.analytics', path: '/analytics', hideable: true, isGadget: true },
  { icon: Bell, labelKey: 'gadgets.notifications', path: '/notifications', hideable: true, isGadget: true },
  { icon: MessageSquare, labelKey: 'nav.requests', path: '/requests', hideable: true, isGadget: true },
  { icon: Lock, labelKey: 'nav.parental', path: '/parental-controls', hideable: true, isGadget: true },
  { icon: Cog, labelKey: 'nav.processing', path: '/processing', hideable: true, isGadget: true },
  { icon: HardDrive, labelKey: 'nav.usenet', path: '/usenet', hideable: true, isGadget: true },
>>>>>>> 721ee8c8 (i18n: 64-language support with sidebar integration)
];

const settingsSubItems = [
  { icon: Shield, labelKey: 'nav.security', path: '/security', hideable: true },
  { icon: Wifi, labelKey: 'nav.vpn', path: '/vpn', hideable: true },
  { icon: Library, labelKey: 'nav.lib_manager', path: '/library-manager', hideable: true },
  { icon: Film, labelKey: 'nav.browse_media', path: '/browse', hideable: true },
  { icon: FileText, labelKey: 'nav.log_viewer', path: '/log-viewer', hideable: true },
  { icon: Server, labelKey: 'nav.system', path: '/system', hideable: true },
  { icon: Store, labelKey: 'nav.marketplace', path: '/plugins', hideable: true },
  { icon: Timer, labelKey: 'nav.tasks', path: '/tasks', hideable: true },
  { icon: Download, labelKey: 'nav.dl_clients', path: '/download-clients', hideable: true },
  { icon: Archive, labelKey: 'nav.backups', path: '/backups', hideable: true },
  { icon: Activity, labelKey: 'nav.scrobbling', path: '/scrobbling', hideable: true },
  { icon: Rss, labelKey: 'nav.rss', path: '/rss', hideable: true },
  { icon: Disc, labelKey: 'nav.disc_ripping', path: '/disc-ripping', hideable: true },
  { icon: MonitorPlay, labelKey: 'nav.jellyseerr', path: '/jellyseerr', hideable: true },
  { icon: Clapperboard, labelKey: 'nav.requests_mgr', path: '/requests-manager', hideable: true },
  { icon: Gamepad2, labelKey: 'nav.gaming', path: '/gaming', hideable: true },
  { icon: BookOpen, labelKey: 'nav.ebooks', path: '/ebooks', hideable: true },
  { icon: Music, labelKey: 'nav.music_lib', path: '/music-library', hideable: true },
  { icon: Sparkles, labelKey: 'nav.for_you', path: '/for-you', hideable: true },
  { icon: Tv, labelKey: 'nav.dvr', path: '/dvr', hideable: true },
  { icon: Download, labelKey: 'nav.offline', path: '/offline', hideable: true },
  { icon: Cloud, labelKey: 'nav.cloud_backup', path: '/cloud-backup', hideable: true },
  { icon: Cloud, labelKey: 'nav.cloud_sync', path: '/cloud-sync', hideable: true },
  { icon: ArrowDownToLine, labelKey: 'nav.media_sync', path: '/media-sync', hideable: true },
];

const DEFAULT_VISIBLE_KEYS = mediaNavItems.filter(i => i.hideable).map(i => i.labelKey)
  .concat(gadgetNavItems.filter(i => i.hideable).map(i => i.labelKey))
  .concat(settingsSubItems.filter(i => i.hideable).map(i => i.labelKey));

const LEGACY_LABEL_TO_KEY = {};
mediaNavItems.forEach(i => {
  const fallback = i.labelKey.split('.').pop().replace(/_/g, ' ');
  LEGACY_LABEL_TO_KEY[fallback] = i.labelKey;
});
gadgetNavItems.forEach(i => {
  const fallback = i.labelKey.split('.').pop().replace(/_/g, ' ');
  LEGACY_LABEL_TO_KEY[fallback] = i.labelKey;
});
settingsSubItems.forEach(i => {
  const fallback = i.labelKey.split('.').pop().replace(/_/g, ' ');
  LEGACY_LABEL_TO_KEY[fallback] = i.labelKey;
});
LEGACY_LABEL_TO_KEY['Live TV'] = 'nav.live_tv';
LEGACY_LABEL_TO_KEY['Web Video'] = 'gadgets.webvideo';
LEGACY_LABEL_TO_KEY['Lib Manager'] = 'nav.lib_manager';
LEGACY_LABEL_TO_KEY['Browse Media'] = 'nav.browse_media';
LEGACY_LABEL_TO_KEY['Log Viewer'] = 'nav.log_viewer';
LEGACY_LABEL_TO_KEY['DL Clients'] = 'nav.dl_clients';
LEGACY_LABEL_TO_KEY['Music Lib'] = 'nav.music_lib';
LEGACY_LABEL_TO_KEY['For You'] = 'nav.for_you';
LEGACY_LABEL_TO_KEY['VPN Portal'] = 'nav.vpn';
LEGACY_LABEL_TO_KEY['Requests'] = 'nav.requests_mgr';
LEGACY_LABEL_TO_KEY['Parental'] = 'nav.parental';

const getVisibleTabs = () => {
  try {
    const saved = localStorage.getItem('watchnexus_visible_tabs');
    if (saved) {
      const parsed = JSON.parse(saved);
      const migrated = parsed.map(key => LEGACY_LABEL_TO_KEY[key] || key);
      return migrated;
    }
  } catch (e) {
    console.error('Error loading visible tabs:', e);
      toast.error('Error loading visible tabs:');
  }
  return DEFAULT_VISIBLE_KEYS;
};

export const Sidebar = () => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const [visibleTabs, setVisibleTabs] = useState(getVisibleTabs);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const location = useLocation();
  const { logout, user } = useAuth();
  const { hooks } = useGadgets();
  const { isRouteUnlocked, getRouteRequiredTier } = useLicense();
  const navRef = useRef(null);
  const SCROLL_KEY = 'watchnexus_sidebar_scroll';

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'watchnexus_visible_tabs') setVisibleTabs(getVisibleTabs());
    };
    const handleTabsUpdate = () => setVisibleTabs(getVisibleTabs());
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('watchnexus_tabs_updated', handleTabsUpdate);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('watchnexus_tabs_updated', handleTabsUpdate);
    };
  }, []);

  useEffect(() => {
    const isSettingsSubPath = settingsSubItems.some(item => location.pathname === item.path) || location.pathname === '/settings';
    if (isSettingsSubPath) setSettingsOpen(true);
  }, [location.pathname]);

  const dynamicGadgets = (hooks?.sidebar_entries || []).map(entry => ({
    icon: ICON_MAP[entry.icon] || Sparkles,
    labelKey: entry.labelKey || entry.label,
    path: entry.path,
    hideable: true,
    isGadget: true,
  }));

  const isVisible = (item) => item.alwaysVisible || visibleTabs.includes(item.labelKey);

  const visibleMedia = mediaNavItems.filter(isVisible);
  const visibleGadgets = [...gadgetNavItems, ...dynamicGadgets].filter(isVisible);
  const visibleSettingsSubs = settingsSubItems.filter(isVisible);

  const renderNavItem = (item) => {
    const isActive = location.pathname === item.path;
    const Icon = item.icon;
    const locked = !isRouteUnlocked(item.path);
    return (
      <li key={item.path}>
        <Link
          to={item.path}
          data-testid={`nav-${item.labelKey.replace(/\./g, '-')}`}
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
                {t(item.labelKey)}
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

  const handleNavScroll = () => {
    if (navRef.current) {
      sessionStorage.setItem(SCROLL_KEY, navRef.current.scrollTop.toString());
    }
  };

  useEffect(() => {
    const savedScroll = sessionStorage.getItem(SCROLL_KEY);
    if (navRef.current && savedScroll) {
      const scrollValue = parseInt(savedScroll, 10);
      if (scrollValue > 0) {
        setTimeout(() => {
          if (navRef.current) navRef.current.scrollTop = scrollValue;
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
                {t('app.name')}
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
              <span className="text-sm text-gray-400">{t('media.search_placeholder')}</span>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      <nav
        ref={navRef}
        className="flex-1 py-4 overflow-y-auto hide-scrollbar"
        onScroll={handleNavScroll}
      >
        <ul className="space-y-1 px-3">
          {visibleMedia.map(renderNavItem)}
          {visibleGadgets.length > 0 && visibleGadgets.map(renderNavItem)}
          {renderNavItem({ icon: Download, labelKey: 'gadgets.downloads', path: '/downloads', alwaysVisible: true })}
          {renderNavItem({ icon: HelpCircle, labelKey: 'nav.help', path: '/help', alwaysVisible: true })}

          <li>
            <div className="flex flex-col">
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
                        {t('nav.settings')}
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
                            data-testid={`nav-${item.labelKey.replace(/\./g, '-')}`}
                            className={cn(
                              "flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-200 text-sm",
                              locked ? "text-gray-600 hover:text-gray-500" :
                              isActive ? "text-white bg-white/10" : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                            )}
                          >
                            <Icon className="w-4 h-4" style={(!locked && isActive) ? { color: 'var(--primary, #8B5CF6)' } : locked ? { opacity: 0.35 } : {}} />
                            <span className="font-medium flex-1">{t(item.labelKey)}</span>
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

      <div className="p-4 border-t border-white/5 space-y-2">
        {expanded ? <LanguageSwitcher /> : <div className="flex justify-center"><LanguageSwitcher compact /></div>}
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
