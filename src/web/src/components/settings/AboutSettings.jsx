import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Info, Tag, Calendar, CheckCircle2, Bug, Sparkles,
  ChevronDown, ChevronUp, ExternalLink, Github, Heart,
  Zap, Shield, Wrench, Code, Users, Crown, Star, 
  Gem, Award, Trophy, Coffee, Rocket, Scale, FileText,
  BookOpen, History
} from 'lucide-react';
import { Button } from '../ui/button';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Submenu tabs
const ABOUT_TABS = [
  { id: 'overview', label: 'Overview', icon: Info },
  { id: 'releases', label: 'Release History', icon: History },
  { id: 'credits', label: 'Credits', icon: Trophy },
  { id: 'legal', label: 'Legal & Trademarks', icon: Scale },
];

// Credits data
const CREDITS = {
  foundingMembers: { title: "Founding Members", icon: Crown, color: "from-yellow-500 to-amber-600", description: "The visionaries who believed from day one", members: [] },
  superSponsors: { title: "Super Sponsors", icon: Gem, color: "from-violet-500 to-purple-600", description: "Extraordinary supporters who made this possible", members: [] },
  codeContributors: { title: "Code Contributors", icon: Code, color: "from-blue-500 to-cyan-600", description: "The developers who shaped WatchNexus", members: [] },
  backers: { title: "Backers", icon: Heart, color: "from-pink-500 to-rose-600", description: "Our amazing crowdfunding supporters", members: [] },
  superFans: { title: "Super Fans", icon: Star, color: "from-orange-500 to-red-600", description: "Community champions and early adopters", members: [] }
};

const TIER_BADGES = {
  founding: { bg: 'bg-gradient-to-r from-yellow-500 to-amber-600', text: 'text-yellow-100' },
  superSponsor: { bg: 'bg-gradient-to-r from-violet-500 to-purple-600', text: 'text-violet-100' },
  contributor: { bg: 'bg-gradient-to-r from-blue-500 to-cyan-600', text: 'text-blue-100' },
  backer: { bg: 'bg-gradient-to-r from-pink-500 to-rose-600', text: 'text-pink-100' },
  superFan: { bg: 'bg-gradient-to-r from-orange-500 to-red-600', text: 'text-orange-100' },
};

// Complete Release History
const RELEASES = [
  // 2.8.x Series - Current
  {
    version: '2.8.2.2', date: '2026-03-22', type: 'patch', title: 'System Tray Icon',
    highlights: ['System tray icon on launch', 'Windows & Linux support', 'Quick-access Open & Quit menu'],
    changes: [
      { type: 'feature', text: 'System tray icon now loads on launch for both Windows and Linux, confirming WatchNexus is running' },
      { type: 'feature', text: 'Windows: Native WinForms NotifyIcon with branded "W" icon, double-click to open browser, right-click context menu' },
      { type: 'feature', text: 'Linux: GTK AppIndicator3 tray icon via embedded Python helper (supports AyatanaAppIndicator3 and legacy)' },
      { type: 'improvement', text: 'Headless/server environments are auto-detected and gracefully skip tray icon initialization' },
      { type: 'improvement', text: 'Icon resolves from bundled watchnexus-logo.png with procedural fallback on Windows' },
    ]
  },
  {
    version: '2.8.2.1', date: '2026-03-22', type: 'patch', title: 'Searchable Help & Documentation Page',
    highlights: ['Dedicated /help page', 'Searchable help topics', '40+ documented topics'],
    changes: [
      { type: 'feature', text: 'New Help & Documentation page (/help) — a searchable, categorized reference guide aggregating all help content in one place' },
      { type: 'feature', text: '40+ help topics organized into 13 categories (General, Playback, Downloads, Subtitles, Streaming, IPTV, Integrations, External Access, Appearance, Users, Libraries, Indexers, System, Gadgets)' },
      { type: 'feature', text: 'Full-text search across all help topics — searches titles, descriptions, and examples' },
      { type: 'feature', text: 'Expandable/collapsible categories and individual topics with smooth animations' },
      { type: 'feature', text: 'Help link added to sidebar navigation for quick access from any page' },
      { type: 'improvement', text: 'Each topic includes detailed description and practical setup examples' },
    ]
  },
  {
    version: '2.8.2', date: '2026-03-22', type: 'patch', title: 'Help Tooltips & Sidebar UX Fix',
    highlights: ['Help icons on every settings page', 'Sidebar scroll position preserved'],
    changes: [
      { type: 'feature', text: 'Added visible help icons (question marks) next to every settings section heading and individual options' },
      { type: 'feature', text: 'Clicking a help icon opens a detailed popover with description, purpose, and setup examples' },
      { type: 'feature', text: 'Help coverage: General, Playback, Downloads, Subtitles, Streaming, IPTV, Integrations, Gelatin, Themes, Users, Maintenance, API Management, Indexers, Libraries, Media Health, Quality Profiles, and Gadgets' },
      { type: 'fix', text: 'Fixed sidebar jumping to the top when navigating — scroll position now persists across page changes' },
      { type: 'improvement', text: 'New reusable HelpTooltip component for consistent help UX across the app' },
      { type: 'improvement', text: 'SettingsTabHeader now supports a help prop for easy help integration' },
    ]
  },
  {
    version: '2.8.1', date: '2026-03-22', type: 'patch', title: 'Bug Fixes & New Frontend Pages',
    highlights: ['Fixed dropdown readability', 'Settings save fixed', 'Media playback pipeline restored', '6 new gadget pages'],
    changes: [
      { type: 'fix', text: 'Fixed unreadable dropdown menus — select options now have proper dark backgrounds on all platforms' },
      { type: 'fix', text: 'Settings now save correctly — backend accepts both raw JSON and {value: ...} wrapper format' },
      { type: 'fix', text: 'Added bulk PUT /api/settings endpoint for saving multiple settings at once' },
      { type: 'fix', text: 'Fixed user preferences not persisting (was sending query params instead of JSON body)' },
      { type: 'fix', text: 'Restored media playback pipeline — added 10 missing Marmalade endpoints including /stream/{id}' },
      { type: 'fix', text: 'Meringue requests no longer require TMDB ID — users can submit by title only' },
      { type: 'fix', text: 'Added missing POST /api/pepper/channels for notification channel creation' },
      { type: 'feature', text: 'New Analytics page (/analytics) — watch stats, top genres, recent activity' },
      { type: 'feature', text: 'New Notifications page (/notifications) — channel management, test, history' },
      { type: 'feature', text: 'New Requests page (/requests) — submit and track media requests' },
      { type: 'feature', text: 'New Parental Controls page (/parental-controls) — PIN, rating limits, genre blocking' },
      { type: 'feature', text: 'New Processing page (/processing) — submit and monitor transcode jobs' },
      { type: 'feature', text: 'New Usenet page (/usenet) — Brine indexer & Ladle downloader config + search' },
      { type: 'improvement', text: 'Sidebar updated with 6 new navigation items for all new gadget pages' },
      { type: 'improvement', text: 'All module versions bumped to 2.8.1' },
    ]
  },
  {
    version: '2.8.0', date: '2026-03-19', type: 'minor', title: 'Five New Native Features + Usenet',
    highlights: ['Watch Analytics (Truffle)', 'Notifications (Pepper)', 'User Requests (Meringue)', 'Parental Controls (Rind)', 'Media Processing (Crucible)', 'Usenet support (Brine + Ladle)'],
    changes: [
      { type: 'feature', text: 'Truffle: Watch Analytics with play tracking, stats by type/hour/day, Year Wrapped' },
      { type: 'feature', text: 'Pepper: Notification Hub — Discord, Telegram, Slack, Pushover with 7 event types' },
      { type: 'feature', text: 'Meringue: User Request System with admin approve/reject/fulfill workflow' },
      { type: 'feature', text: 'Rind: Parental Controls — rating filters, genre restrictions, PIN lock' },
      { type: 'feature', text: 'Crucible: Media Processing Pipeline — 7 transcode profiles, job queue, FFprobe analysis' },
      { type: 'feature', text: 'Brine: Usenet Indexer — Prowlarr/Newznab-compatible proxy with NZB search' },
      { type: 'feature', text: 'Ladle: Usenet Downloader — SABnzbd proxy with queue management and speed controls' },
      { type: 'improvement', text: 'All Jellyfin references removed, functionality preserved as Media Bridge (Custard)' },
      { type: 'improvement', text: '31 total modules registered' },
    ]
  },
  // 2.5.x Series
  {
    version: '2.5.13', date: '2025-02-25', type: 'patch', title: 'Theme Mode Sync',
    highlights: ['Dark/Light mode syncs across devices', 'Complete settings sync'],
    changes: [
      { type: 'feature', text: 'Theme mode (dark/light) now syncs to your account across all devices' },
      { type: 'improvement', text: 'ThemeContext loads preference from backend on startup' },
      { type: 'improvement', text: 'All user preferences now sync: IPTV, sidebar tabs, download mode, theme mode' },
    ]
  },
  {
    version: '2.5.12', date: '2025-02-25', type: 'patch', title: 'Cross-Device Settings Sync',
    highlights: ['IPTV sources saved to database', 'User preferences sync across devices', 'All localStorage settings migrated to backend'],
    changes: [
      { type: 'feature', text: 'IPTV sources now persist to database - sync across all your devices' },
      { type: 'feature', text: 'Sidebar tab visibility settings sync to your account' },
      { type: 'feature', text: 'Download client mode (builtin vs qBittorrent) syncs across devices' },
      { type: 'feature', text: 'New database tables: iptv_sources, user_preferences' },
      { type: 'feature', text: 'New API endpoints: /iptv/sources, /user/preferences' },
      { type: 'fix', text: 'User delete cascade now includes iptv_sources and user_preferences' },
      { type: 'improvement', text: 'Green "Sync enabled" badges on settings pages indicate cloud-synced data' },
    ]
  },
  {
    version: '2.5.11', date: '2025-02-25', type: 'patch', title: 'Code Audit & Bug Fixes',
    highlights: ['Deep code audit with fixes', 'User delete cascade fix', 'Unsupported gadgets hidden'],
    changes: [
      { type: 'fix', text: 'User deletion now properly cascades to all related tables (sessions, watchlist, progress, etc.)' },
      { type: 'fix', text: 'Fixed "Cannot delete yourself" button - delete button now hidden for current user' },
      { type: 'fix', text: 'Added "You" badge to identify current user in Users & Access' },
      { type: 'fix', text: 'skip_segments table renamed to skip_markers to match database schema' },
      { type: 'fix', text: 'Unsupported gadgets (Photos, Radio, Podcasts) no longer show in sidebar' },
      { type: 'improvement', text: 'Comprehensive code audit ensuring all features work as intended' },
    ]
  },
  {
    version: '2.5.10', date: '2025-02-25', type: 'patch', title: 'OS-Aware File Browsing & Dark Mode Fixes',
    highlights: ['OS-aware file browser (Win/Linux/Mac)', 'Dark mode dropdown fixes', 'Browse buttons for Media Health'],
    changes: [
      { type: 'fix', text: 'File browser now detects OS and shows correct paths (C:\\ for Windows, /home for Linux, /Users for macOS)' },
      { type: 'fix', text: 'All select dropdowns now have proper dark backgrounds in dark mode' },
      { type: 'feature', text: 'Added Browse button to Media Health scan path input' },
      { type: 'feature', text: 'Added Browse button to Scheduled Scans directory input' },
      { type: 'fix', text: 'Preconfigured indexers now auto-add with correct URL when clicked' },
      { type: 'fix', text: 'Indexer toggle handles broken entries by recreating from preset' },
    ]
  },
  {
    version: '2.5.9', date: '2025-02-25', type: 'minor', title: 'Watch History Management',
    highlights: ['X button on Continue Watching cards', 'Watch History tab in Settings', 'Clear all with confirmation'],
    changes: [
      { type: 'feature', text: 'Added X button (top-right) on Continue Watching cards to remove items' },
      { type: 'feature', text: 'New "Watch History" tab in Playback Settings' },
      { type: 'feature', text: 'Clear individual items or entire watch history' },
      { type: 'feature', text: 'Confirmation dialog before clearing all history (Crunchyroll-style)' },
      { type: 'feature', text: 'Backend API: DELETE /watch-progress endpoints' },
      { type: 'fix', text: 'Fixed server.py uvicorn startup for standalone execution' },
    ]
  },
  {
    version: '2.5.8', date: '2025-02-25', type: 'minor', title: 'Settings UX Overhaul - Tabbed Navigation',
    highlights: ['Tabbed submenus for ALL Settings pages', 'Consistent navigation', 'Better discoverability'],
    changes: [
      { type: 'feature', text: 'Tabbed interface: General, Playback, Users, IPTV, Streaming, Theme Forge, Gelatin, Maintenance, Subtitles, About' },
      { type: 'improvement', text: 'Reusable SettingsTabHeader component for consistent styling' },
      { type: 'improvement', text: 'Each settings page now has 3-5 organized sub-tabs' },
    ]
  },
  {
    version: '2.5.7', date: '2025-02-25', type: 'patch', title: 'Scaffolding Cleanup & Legal Compliance',
    highlights: ['Removed dummy pages', 'Legal section', 'Copyright-safe icons'],
    changes: [
      { type: 'improvement', text: 'Removed non-functional gadget pages (Radio, Photos, Podcasts, WebVideo)' },
      { type: 'feature', text: 'Gadgets show "Coming Soon" badge for unsupported items' },
      { type: 'feature', text: 'Added Legal & Trademarks section with full disclaimers' },
      { type: 'fix', text: 'Replaced streaming service letter logos with generic Play icons' },
    ]
  },
  {
    version: '2.5.6', date: '2025-02-25', type: 'minor', title: 'Gadgets Catalogue & Library Views',
    highlights: ['45 Gadgets catalogue', 'Library/Discover views', 'Anime category'],
    changes: [
      { type: 'feature', text: 'Gadgets Catalogue: 45 extensions across 16 categories' },
      { type: 'feature', text: 'Movies/TV Shows: Dual Library + TMDB Discover view' },
      { type: 'feature', text: 'Anime: Distinct category with dedicated library' },
      { type: 'improvement', text: 'Renamed "Plugins" to "Gadgets" throughout app' },
      { type: 'feature', text: 'Ripen lifecycle engine for gadget management' },
    ]
  },
  {
    version: '2.5.5', date: '2025-02-24', type: 'minor', title: 'Theming System & Security Patch',
    highlights: ['Full theme customization', 'Security fix', 'Credits section'],
    changes: [
      { type: 'feature', text: 'Theme Forge: Light/dark mode with custom color themes' },
      { type: 'security', text: 'Patched unauthenticated media streaming endpoint' },
      { type: 'fix', text: 'Fixed CSS variable mismatches causing invisible elements' },
      { type: 'feature', text: 'Added Credits section to About page' },
    ]
  },
  {
    version: '2.5.4', date: '2025-02-23', type: 'patch', title: 'Quality Profiles & Download Fixes',
    highlights: ['Quality profile system', 'Download queue fixes', 'Better error handling'],
    changes: [
      { type: 'feature', text: 'Quality Profiles: Create custom quality preferences like Sonarr/Radarr' },
      { type: 'fix', text: 'Fixed download queue not updating in real-time' },
      { type: 'improvement', text: 'Better error messages for failed downloads' },
    ]
  },
  {
    version: '2.5.3', date: '2025-02-22', type: 'patch', title: 'Subtitle Provider Improvements',
    highlights: ['Multiple subtitle providers', 'Provider priority', 'Auto-download'],
    changes: [
      { type: 'feature', text: 'Garnish: OpenSubtitles, Addic7ed, Podnapisi support' },
      { type: 'feature', text: 'Drag-to-reorder provider priority' },
      { type: 'feature', text: 'Auto-download subtitles on media import' },
    ]
  },
  {
    version: '2.5.2', date: '2025-02-21', type: 'patch', title: 'IPTV & Live TV Enhancements',
    highlights: ['M3U playlist support', 'EPG guide', 'Xtream Codes'],
    changes: [
      { type: 'feature', text: 'Relish IPTV: M3U playlist import' },
      { type: 'feature', text: 'Xtream Codes API support' },
      { type: 'feature', text: 'Electronic Program Guide (EPG) integration' },
    ]
  },
  {
    version: '2.5.1', date: '2025-02-20', type: 'patch', title: 'External Access & Tunneling',
    highlights: ['Gelatin tunnels', 'Remote access', 'Guest tokens'],
    changes: [
      { type: 'feature', text: 'Gelatin: Create secure tunnels for external access' },
      { type: 'feature', text: 'Guest access tokens with configurable permissions' },
      { type: 'feature', text: 'Server status dashboard with connection info' },
    ]
  },
  {
    version: '2.5.0', date: '2025-02-19', type: 'major', title: 'Multi-Platform Client Release',
    highlights: ['5 client apps', 'System tray', 'Auto-updater'],
    changes: [
      { type: 'feature', text: 'Android, Android TV, Fire TV, Roku, Kodi clients' },
      { type: 'feature', text: 'Beacon: System tray application for server management' },
      { type: 'feature', text: 'Tiramisu: Auto-update system for seamless upgrades' },
      { type: 'feature', text: 'Client sync across devices' },
    ]
  },
  // 2.4.x Series
  {
    version: '2.4.0', date: '2025-02-18', type: 'minor', title: 'Indexer Management Overhaul',
    highlights: ['Compote indexer system', 'Preset indexers', 'Health checks'],
    changes: [
      { type: 'feature', text: 'Compote: Unified indexer management (Torznab, Newznab, RSS)' },
      { type: 'feature', text: 'Preset indexers: 1337x, RARBG, YTS, EZTV, Nyaa, and more' },
      { type: 'feature', text: 'Indexer health checks and status monitoring' },
      { type: 'feature', text: 'Priority ordering for search results' },
    ]
  },
  // 2.3.x Series
  {
    version: '2.3.0', date: '2025-02-17', type: 'minor', title: 'Media Health & Maintenance',
    highlights: ['Sieve health checker', 'Scheduled scans', 'Auto-repair'],
    changes: [
      { type: 'feature', text: 'Sieve: Media health checker for corrupt/incomplete files' },
      { type: 'feature', text: 'Scheduled health scans (daily, weekly, monthly)' },
      { type: 'feature', text: 'Auto-repair with redownload option' },
      { type: 'feature', text: 'Email/Discord notifications for issues' },
    ]
  },
  // 2.2.x Series
  {
    version: '2.2.0', date: '2025-02-16', type: 'minor', title: 'Streaming Service Integration',
    highlights: ['Cream streaming hub', 'Deep links', 'Service tracking'],
    changes: [
      { type: 'feature', text: 'Cream: Streaming service credential management' },
      { type: 'feature', text: 'Deep link integration for one-click playback' },
      { type: 'feature', text: 'Track content availability across services' },
      { type: 'feature', text: 'Netflix, Disney+, Prime, HBO Max, Hulu support' },
    ]
  },
  // 2.1.x Series
  {
    version: '2.1.0', date: '2025-02-15', type: 'minor', title: 'Download Engine Improvements',
    highlights: ['Fondue torrent engine', 'Seeding controls', 'Queue management'],
    changes: [
      { type: 'feature', text: 'Fondue: Built-in Python torrent engine (no dependencies)' },
      { type: 'feature', text: 'Seeding ratio limits and actions' },
      { type: 'feature', text: 'Download queue with priority management' },
      { type: 'feature', text: 'Sequential downloading for instant playback' },
    ]
  },
  // 2.0.x Series
  {
    version: '2.0.0', date: '2025-02-14', type: 'major', title: 'Major UI/UX Redesign',
    highlights: ['Glass-morphism design', 'New navigation', 'Dashboard overhaul'],
    changes: [
      { type: 'feature', text: 'Complete UI redesign with glass-morphism aesthetic' },
      { type: 'feature', text: 'New sidebar navigation with collapsible sections' },
      { type: 'feature', text: 'Dashboard with Continue Watching, Trending, Recently Added' },
      { type: 'feature', text: 'Responsive design for mobile/tablet/desktop' },
    ]
  },
  // 1.x Series
  {
    version: '1.2.1', date: '2025-02-14', type: 'patch', title: 'Logging & Start Script Improvements',
    highlights: ['File logging', 'Log viewer', 'Better start scripts'],
    changes: [
      { type: 'feature', text: 'File-based logging with rotation (10MB, 7 backups)' },
      { type: 'feature', text: 'Log viewer in Maintenance tab with color-coded levels' },
      { type: 'feature', text: 'Port conflict detection in start script' },
      { type: 'feature', text: 'Stop/status commands for server management' },
    ]
  },
  {
    version: '1.2.0', date: '2025-02-14', type: 'minor', title: 'Maintenance Dashboard',
    highlights: ['System monitoring', 'Database backups', 'Cache management'],
    changes: [
      { type: 'feature', text: 'Server status: uptime, CPU, memory, disk usage' },
      { type: 'feature', text: 'Database health with WAL mode indicator' },
      { type: 'feature', text: 'Backup management with rolling backups' },
      { type: 'feature', text: 'TMDB cache statistics and clear option' },
    ]
  },
  {
    version: '1.1.0', date: '2025-02-14', type: 'minor', title: 'SQLite Migration - Zero Dependencies',
    highlights: ['SQLite database', 'No MongoDB', 'Auto backups'],
    changes: [
      { type: 'feature', text: 'Migrated from MongoDB to SQLite - zero external dependencies!' },
      { type: 'feature', text: 'WAL mode for concurrent access' },
      { type: 'feature', text: 'Automatic backups on startup (7 rolling)' },
      { type: 'feature', text: 'Scheduled VACUUM every 24 hours' },
    ]
  },
  {
    version: '1.0.2', date: '2025-02-14', type: 'patch', title: 'LTorrent Integration',
    highlights: ['Pure Python torrent', 'Magnet links', 'Sequential download'],
    changes: [
      { type: 'feature', text: 'LTorrent: Pure Python torrent library (no system deps)' },
      { type: 'feature', text: 'Magnet link and .torrent file support' },
      { type: 'feature', text: 'Sequential download for streaming while downloading' },
    ]
  },
  {
    version: '1.0.1', date: '2025-02-13', type: 'patch', title: 'Self-Contained Server',
    highlights: ['Static file serving', 'Standalone deployment', 'Release packages'],
    changes: [
      { type: 'feature', text: 'Frontend served by FastAPI backend' },
      { type: 'feature', text: 'Single server for API and UI' },
      { type: 'feature', text: 'Release package generator script' },
    ]
  },
  {
    version: '1.0.0', date: '2025-02-12', type: 'major', title: 'Initial Release',
    highlights: ['Core media browsing', 'TMDB integration', 'Multi-user support'],
    changes: [
      { type: 'feature', text: 'Media discovery with TMDB integration' },
      { type: 'feature', text: 'User authentication (local + Google OAuth)' },
      { type: 'feature', text: 'Watchlist and watch progress tracking' },
      { type: 'feature', text: 'Library management with media scanning' },
      { type: 'feature', text: 'Media server API compatibility layer' },
    ]
  },
];

export const AboutSettings = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [systemInfo, setSystemInfo] = useState(null);
  const [expandedVersion, setExpandedVersion] = useState('2.8.2.2');

  useEffect(() => {
    const fetchSystemInfo = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/system/info`);
        setSystemInfo(res.data);
      } catch (error) {
        console.error('Failed to fetch system info:', error);
      }
    };
    fetchSystemInfo();
  }, []);

  const getTypeIcon = (type) => {
    switch (type) {
      case 'feature': return <Sparkles className="w-3.5 h-3.5 text-violet-400" />;
      case 'fix': return <Bug className="w-3.5 h-3.5 text-red-400" />;
      case 'improvement': return <Zap className="w-3.5 h-3.5 text-yellow-400" />;
      case 'security': return <Shield className="w-3.5 h-3.5 text-green-400" />;
      case 'docs': return <Code className="w-3.5 h-3.5 text-blue-400" />;
      default: return <Wrench className="w-3.5 h-3.5 text-gray-400" />;
    }
  };

  const getTypeBadge = (type) => {
    const colors = { major: 'bg-violet-500/20 text-violet-400 border-violet-500/30', minor: 'bg-blue-500/20 text-blue-400 border-blue-500/30', patch: 'bg-green-500/20 text-green-400 border-green-500/30' };
    return colors[type] || colors.patch;
  };

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab systemInfo={systemInfo} />;
      case 'releases':
        return <ReleasesTab releases={RELEASES} expandedVersion={expandedVersion} setExpandedVersion={setExpandedVersion} getTypeIcon={getTypeIcon} getTypeBadge={getTypeBadge} />;
      case 'credits':
        return <CreditsTab credits={CREDITS} tierBadges={TIER_BADGES} />;
      case 'legal':
        return <LegalTab />;
      default:
        return null;
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6" data-testid="about-settings">
      {/* Header with Tab Navigation */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center">
            <Info className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">About WatchNexus</h2>
            <p className="text-sm text-gray-400">Version {systemInfo?.version || '2.8.2.2'}</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2" data-testid="about-tabs">
          {ABOUT_TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                data-testid={`about-tab-${tab.id}`}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {renderTabContent()}
      </motion.div>
    </motion.div>
  );
};

// Overview Tab
const OverviewTab = ({ systemInfo }) => (
  <div className="space-y-6">
    {/* Version Banner */}
    <div className="bg-gradient-to-r from-violet-500/20 to-purple-500/20 border border-violet-500/30 rounded-2xl p-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-2xl font-bold text-white mb-2">WatchNexus v{systemInfo?.version || '2.8.2.2'}</h3>
          <p className="text-gray-300">Unified Media Pipeline - Your Personal Media Server</p>
          <p className="text-sm text-gray-400 mt-2">A self-hosted media server that replaces Sonarr, Radarr, Prowlarr, qBittorrent, and Bazarr.</p>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <Heart className="w-5 h-5 text-red-400" />
          <span className="text-sm text-gray-400">Made with love</span>
        </div>
      </div>
    </div>

    {/* Stats */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-surface border border-white/10 rounded-xl p-4 text-center">
        <p className="text-3xl font-bold text-violet-400">{RELEASES.length}</p>
        <p className="text-sm text-gray-400">Releases</p>
      </div>
      <div className="bg-surface border border-white/10 rounded-xl p-4 text-center">
        <p className="text-3xl font-bold text-pink-400">45+</p>
        <p className="text-sm text-gray-400">Gadgets</p>
      </div>
      <div className="bg-surface border border-white/10 rounded-xl p-4 text-center">
        <p className="text-3xl font-bold text-cyan-400">5</p>
        <p className="text-sm text-gray-400">Client Apps</p>
      </div>
      <div className="bg-surface border border-white/10 rounded-xl p-4 text-center">
        <p className="text-3xl font-bold text-amber-400">0</p>
        <p className="text-sm text-gray-400">Dependencies</p>
      </div>
    </div>

    {/* Tech Stack */}
    <div className="bg-surface border border-white/10 rounded-2xl p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Code className="w-5 h-5 text-violet-400" />
        Technology Stack
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Backend', value: 'C# / .NET 10' },
          { label: 'Frontend', value: 'React + Tailwind' },
          { label: 'Database', value: 'SQLite (EF Core)' },
          { label: 'Torrent Engine', value: 'Built-in + qBit' },
        ].map(item => (
          <div key={item.label} className="bg-black/30 border border-white/10 rounded-xl p-4">
            <p className="text-sm text-gray-400">{item.label}</p>
            <p className="text-white font-medium">{item.value}</p>
          </div>
        ))}
      </div>
    </div>

    {/* Special Thanks */}
    <div className="bg-surface border border-white/10 rounded-2xl p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Coffee className="w-5 h-5 text-amber-400" />
        Special Thanks
      </h3>
      <div className="text-gray-300 text-sm space-y-2">
        <p><strong>Open Source:</strong> FFmpeg, LTorrent, FastAPI, React, Tailwind CSS</p>
        <p><strong>Communities:</strong> r/selfhosted, r/homelab</p>
        <p><strong>APIs:</strong> TMDB, Addic7ed, OpenSubtitles, and all indexer providers</p>
      </div>
    </div>

    {/* Footer */}
    <div className="text-center text-xs text-gray-500 py-4">
      <p>WatchNexus is open source and self-hosted.</p>
      <p className="mt-1">Your media, your server, your rules.</p>
    </div>
  </div>
);

// Releases Tab
const ReleasesTab = ({ releases, expandedVersion, setExpandedVersion, getTypeIcon, getTypeBadge }) => (
  <div className="bg-surface border border-white/10 rounded-2xl overflow-hidden">
    <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Tag className="w-5 h-5 text-violet-400" />
        Release History
      </h3>
      <span className="text-sm text-gray-400">{releases.length} releases</span>
    </div>
    <div className="divide-y divide-white/10 max-h-[600px] overflow-y-auto">
      {releases.map((release) => (
        <div key={release.version} className="group">
          <div
            className="px-6 py-4 cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-between"
            onClick={() => setExpandedVersion(expandedVersion === release.version ? null : release.version)}
          >
            <div className="flex items-center gap-4">
              <span className="text-lg font-bold text-white">v{release.version}</span>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getTypeBadge(release.type)}`}>{release.type}</span>
              <span className="text-sm text-gray-300 hidden sm:block">{release.title}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{release.date}</span>
              {expandedVersion === release.version ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </div>
          </div>
          {expandedVersion === release.version && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="px-6 pb-6">
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Highlights</p>
                <div className="flex flex-wrap gap-2">
                  {release.highlights.map((h, i) => (
                    <span key={i} className="px-3 py-1.5 text-xs bg-black/30 border border-white/10 rounded-full text-gray-300">{h}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Changes</p>
                <div className="space-y-2">
                  {release.changes.map((change, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      {getTypeIcon(change.type)}
                      <span className="text-gray-300">{change.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      ))}
    </div>
  </div>
);

// Credits Tab
const CreditsTab = ({ credits, tierBadges }) => (
  <div className="space-y-6">
    <div className="bg-surface border border-white/10 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-violet-500/10 to-purple-500/10">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          Credits & Acknowledgements
        </h3>
        <p className="text-sm text-gray-400 mt-1">WatchNexus exists thanks to these amazing people</p>
      </div>
      <div className="p-6 space-y-8">
        {Object.entries(credits).map(([key, tier]) => (
          <CreditTier key={key} tier={tier} badge={tierBadges[key.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')] || tierBadges.backer} />
        ))}
        {/* Become a Supporter CTA */}
        <div className="p-6 bg-gradient-to-r from-violet-500/20 to-pink-500/20 border border-violet-500/30 rounded-xl text-center">
          <Rocket className="w-8 h-8 text-violet-400 mx-auto mb-3" />
          <h4 className="text-lg font-bold text-white mb-2">Want to see your name here?</h4>
          <p className="text-gray-300 text-sm mb-4">Support WatchNexus development and join our community</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button className="bg-violet-600 hover:bg-violet-700" onClick={() => window.open('https://github.com/sponsors/watchnexus', '_blank')}>
              <Heart className="w-4 h-4 mr-2" /> Become a Sponsor
            </Button>
            <Button variant="outline" className="border-white/20 hover:bg-white/10" onClick={() => window.open('https://github.com/watchnexus/watchnexus', '_blank')}>
              <Github className="w-4 h-4 mr-2" /> Contribute Code
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Legal Tab
const LegalTab = () => (
  <div className="space-y-6">
    <div className="bg-surface border border-white/10 rounded-2xl p-6">
      <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
        <Scale className="w-5 h-5 text-amber-400" />
        Legal & Trademarks
      </h3>
      
      <div className="space-y-6">
        {/* Trademark Notice */}
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <h4 className="font-medium text-amber-400 mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4" /> Trademark Notice
          </h4>
          <p className="text-sm text-gray-300">
            All product names, logos, and brands mentioned in WatchNexus are property of their respective owners. 
            This includes but is not limited to: TMDB, Plex, Kodi, Sonarr, Radarr, Prowlarr, qBittorrent, 
            Bazarr, Discord, Telegram, Slack, Trakt, OpenSubtitles, Netflix, Disney+, Prime Video, Hulu, HBO Max, 
            Apple TV+, Peacock, Paramount+, Crunchyroll, and any other third-party services referenced.
          </p>
        </div>

        {/* Usage Disclaimer */}
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <h4 className="font-medium text-blue-400 mb-2 flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> Usage Disclaimer
          </h4>
          <p className="text-sm text-gray-300">
            Any use of third-party trademarks, service marks, or logos is for identification and reference purposes 
            only and does not imply endorsement, affiliation, or sponsorship by the respective trademark holders.
            WatchNexus does not display or use official logos of third-party services.
          </p>
        </div>

        {/* API Data */}
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
          <h4 className="font-medium text-green-400 mb-2 flex items-center gap-2">
            <Code className="w-4 h-4" /> API Data Attribution
          </h4>
          <p className="text-sm text-gray-300">
            Media metadata, images, and information are provided by third-party APIs (such as The Movie Database - TMDB) 
            under their respective terms of service. WatchNexus does not claim ownership of this content. 
            This product uses the TMDB API but is not endorsed or certified by TMDB.
          </p>
        </div>

        {/* User Responsibility */}
        <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
          <h4 className="font-medium text-violet-400 mb-2 flex items-center gap-2">
            <Users className="w-4 h-4" /> User Responsibility
          </h4>
          <p className="text-sm text-gray-300">
            Users are solely responsible for ensuring their use of WatchNexus complies with all applicable laws 
            and the terms of service of any integrated third-party services. WatchNexus is a tool for managing 
            personal media libraries and does not host, distribute, or provide access to copyrighted content.
          </p>
        </div>

        {/* Warranty Disclaimer */}
        <div className="p-4 rounded-xl bg-gray-500/10 border border-gray-500/20">
          <h4 className="font-medium text-gray-400 mb-2 flex items-center gap-2">
            <Shield className="w-4 h-4" /> Warranty Disclaimer
          </h4>
          <p className="text-sm text-gray-400">
            WatchNexus is provided "as is" without warranty of any kind, express or implied. The developers are 
            not responsible for how users choose to use this software. Use at your own risk.
          </p>
        </div>
      </div>
    </div>
  </div>
);

// Credit Tier Component
const CreditTier = ({ tier, badge }) => {
  const Icon = tier.icon;
  const hasMembers = tier.members && tier.members.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tier.color} flex items-center justify-center shadow-lg`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h4 className="font-bold text-white flex items-center gap-2">
            {tier.title}
            {hasMembers && <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-400">{tier.members.length}</span>}
          </h4>
          <p className="text-xs text-gray-400">{tier.description}</p>
        </div>
      </div>
      {hasMembers ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pl-13">
          {tier.members.map((member, idx) => (
            <div key={idx} className="group relative bg-black/30 border border-white/10 rounded-xl p-3 hover:bg-white/5">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full overflow-hidden bg-gradient-to-br from-gray-700 to-gray-800">
                {member.avatar ? <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-lg font-bold text-gray-500">{member.name.charAt(0).toUpperCase()}</div>}
              </div>
              <p className="text-sm font-medium text-white text-center truncate">{member.name}</p>
              {member.title && <p className="text-xs text-gray-500 text-center truncate">{member.title}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="pl-13">
          <div className="bg-black/20 border border-dashed border-white/10 rounded-xl p-6 text-center">
            <Icon className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Be the first {tier.title.toLowerCase().slice(0, -1)}!</p>
            <p className="text-xs text-gray-600 mt-1">Support WatchNexus to appear here</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AboutSettings;
